"""
KoiKatsuのAssetBundleからスケルトン付きGLBを直接生成する。
pygltflib を使用。
"""
import UnityPy, struct, json, os, math
import numpy as np
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Accessor, BufferView, Buffer,
    Skin, Material, Image, Texture, TextureInfo,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER,
    FLOAT, UNSIGNED_SHORT, UNSIGNED_BYTE, UNSIGNED_INT,
    SCALAR, VEC2, VEC3, VEC4, MAT4,
)
from pygltflib import BLEND, OPAQUE

KK = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
OUT = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
os.makedirs(OUT, exist_ok=True)

# ── 座標変換 ─────────────────────────────────────────────────────────────────
def u2g_pos(x, y, z):
    """Unity (left-hand Y-up) → glTF (right-hand Y-up)"""
    return [-x, y, z]

def u2g_quat(qx, qy, qz, qw):
    """Unityクォータニオン → glTFクォータニオン (w,x,y,z → x,y,z,w)"""
    return [-qx, qy, qz, -qw]  # mirror X axis

# ── ボーン階層収集 ───────────────────────────────────────────────────────────
def collect_bones(go_obj):
    """GameObject → list of (name, parent_name, lpos, lrot, lscale)"""
    result = []
    def walk(go, parent):
        try:
            t = go.m_Transform.read()
            name = go.m_Name
            lp = t.m_LocalPosition
            lr = t.m_LocalRotation
            ls = t.m_LocalScale
            result.append({
                'name': name,
                'parent': parent,
                'pos': [lp.x, lp.y, lp.z],
                'rot': [lr.x, lr.y, lr.z, lr.w],
                'scale': [ls.x, ls.y, ls.z],
            })
            for child_ptr in t.m_Children:
                try:
                    child_go = child_ptr.read().m_GameObject.read()
                    walk(child_go, name)
                except: pass
        except: pass
    walk(go_obj, None)
    return result

# ── 4x4行列 ─────────────────────────────────────────────────────────────────
def mat4_identity():
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

def quat_to_mat4(qx, qy, qz, qw):
    """クォータニオン → 4x4回転行列 (column-major)"""
    x2,y2,z2 = qx+qx, qy+qy, qz+qz
    xx,yy,zz = qx*x2, qy*y2, qz*z2
    xy,xz,yz = qx*y2, qx*z2, qy*z2
    wx,wy,wz = qw*x2, qw*y2, qw*z2
    return [
        1-(yy+zz), xy+wz,    xz-wy,    0,
        xy-wz,    1-(xx+zz), yz+wx,    0,
        xz+wy,    yz-wx,    1-(xx+yy), 0,
        0,        0,        0,        1,
    ]

def mat4_mul(a, b):
    result = [0]*16
    for row in range(4):
        for col in range(4):
            for k in range(4):
                result[row*4+col] += a[row*4+k] * b[k*4+col]
    return result

def mat4_translate(tx, ty, tz):
    m = mat4_identity()
    m[12], m[13], m[14] = tx, ty, tz
    return m

def mat4_scale(sx, sy, sz):
    m = mat4_identity()
    m[0], m[5], m[10] = sx, sy, sz
    return m

def mat4_inverse(m):
    """4x4行列の逆行列 (numpy使用)"""
    arr = np.array(m, dtype=np.float32).reshape(4,4).T
    inv = np.linalg.inv(arr)
    return inv.T.flatten().tolist()

# ── GLBバイナリ構築ヘルパー ──────────────────────────────────────────────────
class GLBBuilder:
    def __init__(self):
        self.gltf = GLTF2()
        self.gltf.scene = 0
        self.gltf.scenes = [Scene(nodes=[])]
        self.gltf.nodes = []
        self.gltf.meshes = []
        self.gltf.skins = []
        self.gltf.materials = []
        self.gltf.textures = []
        self.gltf.images = []
        self.gltf.accessors = []
        self.gltf.bufferViews = []
        self.gltf.buffers = [Buffer()]
        self._blobs = []
        self._offset = 0

    def add_blob(self, data: bytes) -> tuple:
        bv = BufferView(buffer=0, byteOffset=self._offset, byteLength=len(data))
        idx = len(self.gltf.bufferViews)
        self.gltf.bufferViews.append(bv)
        self._blobs.append(data)
        self._offset += len(data)
        # Pad to 4 bytes
        pad = (4 - len(data) % 4) % 4
        if pad:
            self._blobs.append(b'\x00' * pad)
            self._offset += pad
        return idx, len(data)

    def add_accessor(self, data: np.ndarray, component_type, type_str, target=None, bv_target=None):
        flat = data.flatten()
        raw = flat.astype(self._dtype(component_type)).tobytes()
        bv_idx, _ = self.add_blob(raw)
        if bv_target is not None:
            self.gltf.bufferViews[bv_idx].target = bv_target
        acc = Accessor(
            bufferView=bv_idx,
            byteOffset=0,
            componentType=component_type,
            count=len(data),
            type=type_str,
        )
        if type_str in (VEC2, VEC3, VEC4, MAT4):
            mn = flat.min(axis=0) if flat.ndim > 1 else [float(flat.min())]
            mx = flat.max(axis=0) if flat.ndim > 1 else [float(flat.max())]
        else:
            mn = [float(flat.min())]
            mx = [float(flat.max())]
        acc.min = [float(x) for x in np.array(mn).flatten()[:data.shape[-1] if data.ndim > 1 else 1]]
        acc.max = [float(x) for x in np.array(mx).flatten()[:data.shape[-1] if data.ndim > 1 else 1]]
        idx = len(self.gltf.accessors)
        self.gltf.accessors.append(acc)
        return idx

    def _dtype(self, ct):
        return {FLOAT: np.float32, UNSIGNED_SHORT: np.uint16, UNSIGNED_BYTE: np.uint8, UNSIGNED_INT: np.uint32}[ct]

    def build(self, outpath):
        total = sum(len(b) for b in self._blobs)
        self.gltf.buffers[0].byteLength = total
        self.gltf.set_binary_blob(b''.join(self._blobs))
        self.gltf.save_binary(outpath)

# ── メッシュ → GLB ──────────────────────────────────────────────────────────
def smr_to_glb(env, smr, out_path, tex_path=None):
    """1つのSkinnedMeshRendererをGLBとして保存"""
    mesh = smr.m_Mesh.read()
    vdata = mesh.m_VertexData
    if not vdata or vdata.m_VertexCount == 0:
        return False

    verts_raw = mesh.m_Vertices
    if not verts_raw:
        return False
    n = len(verts_raw) // 3

    # 頂点 (Unity left-hand → glTF right-hand: X反転)
    verts = np.array([[-verts_raw[i*3], verts_raw[i*3+1], verts_raw[i*3+2]] for i in range(n)], dtype=np.float32)

    # 法線
    norms_raw = mesh.m_Normals
    norms = None
    if norms_raw and len(norms_raw) >= n*3:
        norms = np.array([[-norms_raw[i*3], norms_raw[i*3+1], norms_raw[i*3+2]] for i in range(n)], dtype=np.float32)

    # UV
    uvs_raw = mesh.m_UV
    uvs = None
    if uvs_raw and len(uvs_raw) >= n*2:
        uvs = np.array([[uvs_raw[i*2], 1.0 - uvs_raw[i*2+1]] for i in range(n)], dtype=np.float32)

    # インデックス
    idx_buf = mesh.m_IndexBuffer
    fmt = '<H' if mesh.m_IndexFormat == 0 else '<I'
    idx_size = 2 if mesh.m_IndexFormat == 0 else 4
    count = len(idx_buf) // idx_size
    indices_flat = list(struct.unpack_from(f'<{count}{fmt[1]}', idx_buf))
    # 三角形を逆順 (Unityはwindingが逆)
    tris = []
    for i in range(0, len(indices_flat)-2, 3):
        tris.append(indices_flat[i])
        tris.append(indices_flat[i+2])
        tris.append(indices_flat[i+1])
    indices = np.array(tris, dtype=np.uint32)

    # スキンウェイト
    skin = mesh.m_Skin
    joints0 = None
    weights0 = None
    if skin:
        joints0 = np.zeros((n, 4), dtype=np.uint16)
        weights0 = np.zeros((n, 4), dtype=np.float32)
        for vi, sw in enumerate(skin):
            for k in range(4):
                joints0[vi, k] = getattr(sw, f'boneIndex_{k}_', 0)
                weights0[vi, k] = getattr(sw, f'weight_{k}_', 0.0)
        # 正規化
        totals = weights0.sum(axis=1, keepdims=True)
        totals = np.where(totals == 0, 1, totals)
        weights0 /= totals

    # ボーン階層 (SkinnedMeshRendererのm_Bones)
    bones_list = smr.m_Bones
    bone_names = []
    for bp in bones_list:
        try:
            bone_names.append(bp.read().m_GameObject.read().m_Name)
        except:
            bone_names.append(f'bone_{len(bone_names)}')

    # バインドポーズ (glTFのinverse bind matrices)
    bind_poses = mesh.m_BindPose  # list of Matrix4x4 objects
    inv_bind_mats = []
    for bp in bind_poses:
        # Unityのbind_poseはobject-to-bone space (inverse bind matrix)
        # 座標変換が必要
        try:
            m = bp
            # Matrix4x4: col0=(e00,e10,e20,e30), col1=(e01,...) etc.
            mat = [
                m.e00, m.e10, m.e20, m.e30,
                m.e01, m.e11, m.e21, m.e31,
                m.e02, m.e12, m.e22, m.e32,
                m.e03, m.e13, m.e23, m.e33,
            ]
            inv_bind_mats.append(mat)
        except:
            inv_bind_mats.append(mat4_identity())

    # GLB構築
    b = GLBBuilder()

    # ノード (ボーン)
    bone_node_idx = {}
    for i, bname in enumerate(bone_names):
        node = Node(name=bname)
        node_idx = len(b.gltf.nodes)
        bone_node_idx[i] = node_idx
        b.gltf.nodes.append(node)

    # Accessors
    pos_acc = b.add_accessor(verts, FLOAT, VEC3, bv_target=ARRAY_BUFFER)
    attr = {'POSITION': pos_acc}

    if norms is not None:
        attr['NORMAL'] = b.add_accessor(norms, FLOAT, VEC3, bv_target=ARRAY_BUFFER)

    if uvs is not None:
        attr['TEXCOORD_0'] = b.add_accessor(uvs, FLOAT, VEC2, bv_target=ARRAY_BUFFER)

    if joints0 is not None:
        attr['JOINTS_0'] = b.add_accessor(joints0, UNSIGNED_SHORT, VEC4, bv_target=ARRAY_BUFFER)
        attr['WEIGHTS_0'] = b.add_accessor(weights0, FLOAT, VEC4, bv_target=ARRAY_BUFFER)

    idx_acc = b.add_accessor(indices, UNSIGNED_INT, SCALAR, bv_target=ELEMENT_ARRAY_BUFFER)

    # マテリアル
    mat_idx = None
    if tex_path and os.path.exists(tex_path):
        with open(tex_path, 'rb') as f:
            img_data = f.read()
        bv_idx, _ = b.add_blob(img_data)
        img = Image(bufferView=bv_idx, mimeType='image/png')
        b.gltf.images.append(img)
        tex = Texture(source=0)
        b.gltf.textures.append(tex)
        mat = Material()
        mat.pbrMetallicRoughness = type('PBR', (), {
            'baseColorTexture': TextureInfo(index=0),
            'metallicFactor': 0.0,
            'roughnessFactor': 0.9,
        })()
        mat.doubleSided = True
        b.gltf.materials.append(mat)
        mat_idx = 0

    # Primitive + Mesh
    prim = Primitive(attributes=attr, indices=idx_acc)
    if mat_idx is not None:
        prim.material = mat_idx
    mesh_obj = Mesh(primitives=[prim])
    b.gltf.meshes.append(mesh_obj)

    # Skin (inverse bind matrices)
    if inv_bind_mats:
        ibm_data = np.array(inv_bind_mats, dtype=np.float32)  # shape (N, 16)
        ibm_acc = b.add_accessor(ibm_data, FLOAT, MAT4)
        skin = Skin(
            joints=list(bone_node_idx.values()),
            inverseBindMatrices=ibm_acc,
            name='skin',
        )
        b.gltf.skins.append(skin)

    # Mesh ノード (SkinnedMesh本体)
    mesh_node_idx = len(b.gltf.nodes)
    mesh_node = Node(name='cf_mesh', mesh=0)
    if b.gltf.skins:
        mesh_node.skin = 0
    b.gltf.nodes.append(mesh_node)

    b.gltf.scenes[0].nodes = [mesh_node_idx] + list(bone_node_idx.values())[:1]
    b.build(out_path)
    return True

# ── ベースボディ抽出 ─────────────────────────────────────────────────────────
def extract_body():
    print("=== ベースボディ抽出 ===")
    env = UnityPy.load(f"{KK}/abdata/chara/oo_base.unity3d")
    tex_path = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted/cf_body_00_t.png"

    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vcount = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
        if vcount == 8302:
            out = f"{OUT}/cf_body_base.glb"
            ok = smr_to_glb(env, smr, out, tex_path)
            print(f"  {'OK' if ok else 'FAIL'}: {out} ({vcount} verts, {len(smr.m_Bones)} bones)")
            break

# ── 頭部抽出 ─────────────────────────────────────────────────────────────────
def extract_heads():
    print("\n=== 頭部抽出 ===")
    import glob
    head_bundles = sorted(glob.glob(f"{KK}/abdata/chara/bo_head_*.unity3d"))

    for bundle_path in head_bundles[:3]:  # まず最初の3つ
        bname = os.path.basename(bundle_path).replace('.unity3d', '')
        env = UnityPy.load(bundle_path)
        tex_path = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted/cf_face_00_t.png"
        best = None
        best_v = 0
        for obj in env.objects:
            if obj.type.name != 'SkinnedMeshRenderer': continue
            smr = obj.read()
            if not smr.m_Mesh: continue
            mesh = smr.m_Mesh.read()
            vcount = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
            if vcount > best_v:
                best_v = vcount
                best = smr
        if best:
            out = f"{OUT}/{bname}.glb"
            ok = smr_to_glb(env, best, out, tex_path)
            print(f"  {'OK' if ok else 'FAIL'}: {bname} ({best_v} verts)")

# ── 前髪抽出 ─────────────────────────────────────────────────────────────────
def extract_hair_front():
    print("\n=== 前髪抽出 ===")
    import glob
    bundles = sorted(glob.glob(f"{KK}/abdata/chara/bo_hair_f_*.unity3d"))

    for bundle_path in bundles[:5]:
        bname = os.path.basename(bundle_path).replace('.unity3d', '')
        env = UnityPy.load(bundle_path)
        best = None
        best_v = 0
        for obj in env.objects:
            if obj.type.name != 'SkinnedMeshRenderer': continue
            smr = obj.read()
            if not smr.m_Mesh: continue
            mesh = smr.m_Mesh.read()
            vcount = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
            if vcount > best_v:
                best_v = vcount
                best = smr
        if best:
            out = f"{OUT}/{bname}.glb"
            # テクスチャを探す
            tex_path = None
            for obj in env.objects:
                if obj.type.name == 'Texture2D':
                    tex = obj.read()
                    if tex.m_Name.endswith('_t') and 'hair' in tex.m_Name.lower():
                        tmp = f"/tmp/hair_tex_{tex.m_Name}.png"
                        try:
                            tex.image.save(tmp)
                            tex_path = tmp
                        except: pass
                        break
            ok = smr_to_glb(env, best, out, tex_path)
            print(f"  {'OK' if ok else 'FAIL'}: {bname} ({best_v} verts)")

if __name__ == '__main__':
    extract_body()
    extract_heads()
    extract_hair_front()
    print("\n完了!")
