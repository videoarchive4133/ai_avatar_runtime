"""
KoiKatsuのAssetBundleからスケルトン付きGLBを生成する完全版。
MeshHandlerを使用してvertex dataを正しく取得する。
"""
import UnityPy, struct, os, json
import numpy as np
from UnityPy.helpers.MeshHelper import MeshHandler

KK = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
OUT = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
os.makedirs(OUT, exist_ok=True)

EXTRACTED = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted"

# ── glTF定数 ─────────────────────────────────────────────────────────────────
FLOAT        = 5126
UNSIGNED_INT  = 5125
UNSIGNED_SHORT= 5123
UNSIGNED_BYTE = 5121
ARRAY_BUFFER  = 34962
ELEMENT_ARRAY = 34963

# ── GLBライター ───────────────────────────────────────────────────────────────
class GLBWriter:
    def __init__(self):
        self.json_data = {
            'asset': {'version': '2.0', 'generator': 'kk_glb_export'},
            'scene': 0,
            'scenes': [{'nodes': []}],
            'nodes': [],
            'meshes': [],
            'skins': [],
            'materials': [],
            'textures': [],
            'images': [],
            'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
            'accessors': [],
            'bufferViews': [],
            'buffers': [{'byteLength': 0}],
        }
        self.blobs = []
        self.offset = 0

    def add_blob(self, data: bytes, target: int = None) -> int:
        """バイナリデータを追加してbufferViewインデックスを返す"""
        bv = {'buffer': 0, 'byteOffset': self.offset, 'byteLength': len(data)}
        if target: bv['target'] = target
        idx = len(self.json_data['bufferViews'])
        self.json_data['bufferViews'].append(bv)
        self.blobs.append(data)
        self.offset += len(data)
        # 4バイトアライメント
        pad = (-len(data)) % 4
        if pad:
            self.blobs.append(b'\x00' * pad)
            self.offset += pad
        return idx

    def add_accessor(self, arr: np.ndarray, comp_type: int, type_str: str,
                     target: int = None) -> int:
        """numpy配列をアクセサとして追加しインデックスを返す"""
        raw = arr.flatten().tobytes()
        bv_idx = self.add_blob(raw, target)
        count = len(arr)
        acc = {
            'bufferView': bv_idx, 'byteOffset': 0,
            'componentType': comp_type, 'count': count, 'type': type_str,
        }
        flat = arr.flatten()
        if type_str == 'SCALAR':
            acc['min'] = [float(flat.min())]
            acc['max'] = [float(flat.max())]
        elif type_str in ('VEC2', 'VEC3', 'VEC4'):
            cols = int(type_str[3])
            mn = arr.reshape(-1, cols).min(axis=0).tolist()
            mx = arr.reshape(-1, cols).max(axis=0).tolist()
            acc['min'] = [float(x) for x in mn]
            acc['max'] = [float(x) for x in mx]
        idx = len(self.json_data['accessors'])
        self.json_data['accessors'].append(acc)
        return idx

    def add_texture(self, png_path: str) -> int:
        """PNGテクスチャを追加しtextureインデックスを返す"""
        with open(png_path, 'rb') as f:
            data = f.read()
        bv_idx = self.add_blob(data)
        img_idx = len(self.json_data['images'])
        self.json_data['images'].append({'bufferView': bv_idx, 'mimeType': 'image/png'})
        tex_idx = len(self.json_data['textures'])
        self.json_data['textures'].append({'sampler': 0, 'source': img_idx})
        return tex_idx

    def add_material(self, tex_idx: int = None, double_sided: bool = True,
                     name: str = 'mat') -> int:
        mat = {
            'name': name,
            'doubleSided': double_sided,
            'pbrMetallicRoughness': {
                'metallicFactor': 0.0,
                'roughnessFactor': 0.8,
            }
        }
        if tex_idx is not None:
            mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_idx}
        idx = len(self.json_data['materials'])
        self.json_data['materials'].append(mat)
        return idx

    def save(self, path: str):
        # JSON chunk
        json_bytes = json.dumps(self.json_data, separators=(',', ':')).encode('utf-8')
        pad = (-len(json_bytes)) % 4
        json_bytes += b' ' * pad

        # Binary chunk
        bin_bytes = b''.join(self.blobs)
        self.json_data['buffers'][0]['byteLength'] = len(bin_bytes)
        # 再度JSONをエンコード
        json_bytes2 = json.dumps(self.json_data, separators=(',', ':')).encode('utf-8')
        pad2 = (-len(json_bytes2)) % 4
        json_bytes2 += b' ' * pad2

        total = 12 + 8 + len(json_bytes2) + 8 + len(bin_bytes)
        with open(path, 'wb') as f:
            # GLB header
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            # JSON chunk
            f.write(struct.pack('<II', len(json_bytes2), 0x4E4F534A))
            f.write(json_bytes2)
            # BIN chunk
            f.write(struct.pack('<II', len(bin_bytes), 0x004E4942))
            f.write(bin_bytes)

# ── SkinnedMeshRenderer → GLB ────────────────────────────────────────────────
def extract_smr_to_glb(env, smr, out_path, tex_path=None, name='mesh'):
    """SkinnedMeshRendererをスケルトン付きGLBとして保存"""
    mesh = smr.m_Mesh.read()
    handler = MeshHandler(mesh)
    handler.process()

    if handler.m_Vertices is None:
        print(f"  SKIP: vertices=None ({name})")
        return False

    verts = np.array(handler.m_Vertices, dtype=np.float32)  # (N, 3) already X-negated by MeshHandler
    norms = np.array(handler.m_Normals, dtype=np.float32) if handler.m_Normals is not None else None
    uvs   = np.array(handler.m_UV0, dtype=np.float32) if handler.m_UV0 is not None else None
    bi    = np.array(handler.m_BoneIndices, dtype=np.uint16) if handler.m_BoneIndices is not None else None
    bw    = np.array(handler.m_BoneWeights, dtype=np.float32) if handler.m_BoneWeights is not None else None

    # UV Y反転 (Unity → glTF)
    if uvs is not None:
        uvs[:, 1] = 1.0 - uvs[:, 1]

    # 三角形インデックス
    tris_raw = handler.get_triangles()
    if not tris_raw:
        return False
    tris_all = []
    for sub in tris_raw:
        tris_all.extend(sub)
    # Windingを反転 (Unity left-hand → glTF right-hand)
    indices = np.array(tris_all, dtype=np.uint32)  # (F, 3)
    indices[:, [1, 2]] = indices[:, [2, 1]]  # swap to reverse winding

    N = len(verts)

    # ボーン名リスト
    bones_smr = smr.m_Bones
    bone_names = []
    bone_transforms = []  # (lpos, lrot, lscale) per bone
    for bp in bones_smr:
        try:
            t = bp.read()
            go = t.m_GameObject.read()
            bone_names.append(go.m_Name)
            lp = t.m_LocalPosition
            lr = t.m_LocalRotation
            ls = t.m_LocalScale
            bone_transforms.append({
                'pos': [lp.x, lp.y, lp.z],
                'rot': [lr.x, lr.y, lr.z, lr.w],
                'scale': [ls.x, ls.y, ls.z],
            })
        except:
            bone_names.append(f'bone_{len(bone_names)}')
            bone_transforms.append({'pos':[0,0,0],'rot':[0,0,0,1],'scale':[1,1,1]})

    # Bind poses (inverse bind matrices)
    bind_poses = mesh.m_BindPose  # list of Matrix4x4
    inv_bind_mats = []
    for bp in bind_poses:
        try:
            # Column-major in Unity, column-major in glTF
            # Unity→glTF requires negating X row and X column
            mat = [
                bp.e00, bp.e10, bp.e20, bp.e30,
                bp.e01, bp.e11, bp.e21, bp.e31,
                bp.e02, bp.e12, bp.e22, bp.e32,
                bp.e03, bp.e13, bp.e23, bp.e33,
            ]
            inv_bind_mats.append(mat)
        except:
            inv_bind_mats.append([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])

    nb = len(bone_names)
    writer = GLBWriter()

    # テクスチャ
    tex_idx = None
    if tex_path and os.path.exists(tex_path):
        tex_idx = writer.add_texture(tex_path)

    mat_idx = writer.add_material(tex_idx, name=name)

    # Accessors
    pos_acc = writer.add_accessor(verts, FLOAT, 'VEC3', ARRAY_BUFFER)
    attr = {'POSITION': pos_acc}

    if norms is not None:
        attr['NORMAL'] = writer.add_accessor(norms, FLOAT, 'VEC3', ARRAY_BUFFER)

    if uvs is not None:
        attr['TEXCOORD_0'] = writer.add_accessor(uvs, FLOAT, 'VEC2', ARRAY_BUFFER)

    if bi is not None and bw is not None:
        # 最大bone index
        max_bi = int(bi.max()) if len(bi) > 0 else 0
        attr['JOINTS_0'] = writer.add_accessor(bi, UNSIGNED_SHORT, 'VEC4', ARRAY_BUFFER)
        attr['WEIGHTS_0'] = writer.add_accessor(bw, FLOAT, 'VEC4', ARRAY_BUFFER)

    idx_acc = writer.add_accessor(indices.flatten(), UNSIGNED_INT, 'SCALAR', ELEMENT_ARRAY)

    # Mesh
    prim = {'attributes': attr, 'indices': idx_acc, 'material': mat_idx}
    writer.json_data['meshes'].append({'name': name, 'primitives': [prim]})

    # Bone nodes (全ボーンをノードとして追加)
    bone_node_start = len(writer.json_data['nodes'])
    for i, (bname, bt) in enumerate(zip(bone_names, bone_transforms)):
        # 座標変換: Unity(left-hand) → glTF(right-hand) negate X
        p = bt['pos']
        r = bt['rot']
        s = bt['scale']
        node = {
            'name': bname,
            'translation': [-p[0], p[1], p[2]],
            'rotation': [-r[0], r[1], r[2], -r[3]],  # quat: negate X,W
            'scale': [s[0], s[1], s[2]],
        }
        writer.json_data['nodes'].append(node)

    # Skin
    if inv_bind_mats:
        ibm = np.array(inv_bind_mats, dtype=np.float32)  # (N, 16)
        ibm_acc = writer.add_accessor(ibm, FLOAT, 'MAT4')
        joints = list(range(bone_node_start, bone_node_start + nb))
        writer.json_data['skins'].append({
            'name': f'{name}_skin',
            'joints': joints,
            'inverseBindMatrices': ibm_acc,
        })

    # Mesh node
    mesh_node_idx = len(writer.json_data['nodes'])
    mesh_node = {'name': name, 'mesh': 0}
    if writer.json_data['skins']:
        mesh_node['skin'] = 0
    writer.json_data['nodes'].append(mesh_node)

    writer.json_data['scenes'][0]['nodes'] = [mesh_node_idx]

    writer.save(out_path)
    print(f"  OK: {os.path.basename(out_path)} | {N} verts | {len(indices)} faces | {nb} bones")
    return True

# ── バンドルからベストSMRを抽出 ────────────────────────────────────────────────
def extract_best_smr(bundle_path, out_path, tex_path=None, min_verts=100, name=None):
    """バンドルから最大のSkinnedMeshRendererを抽出"""
    env = UnityPy.load(bundle_path)
    best_smr = None
    best_v = 0
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vdata = mesh.m_VertexData
        vc = vdata.m_VertexCount if vdata else 0
        if vc > best_v and vc >= min_verts:
            best_v = vc
            best_smr = smr
    if best_smr:
        n = name or os.path.basename(bundle_path).replace('.unity3d', '')
        return extract_smr_to_glb(env, best_smr, out_path, tex_path, n)
    return False

# ── 全パーツの一括抽出 ────────────────────────────────────────────────────────
def list_bundles(prefix):
    """chara/フォルダからprefixに一致するunity3dファイルをリストアップ"""
    chara_dir = f"{KK}/abdata/chara"
    return sorted(
        os.path.join(chara_dir, f)
        for f in os.listdir(chara_dir)
        if f.startswith(prefix) and f.endswith('.unity3d')
    )

def extract_all():

    # ── ベースボディ ──
    print("\n=== ベースボディ ===")
    env = UnityPy.load(f"{KK}/abdata/chara/oo_base.unity3d")
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vdata = mesh.m_VertexData
        if vdata and vdata.m_VertexCount == 8302:
            extract_smr_to_glb(env, smr, f"{OUT}/cf_body_base.glb",
                               f"{EXTRACTED}/cf_body_00_t.png", 'cf_body')
            break

    # ── 頭部 ──
    print("\n=== 頭部 ===")
    for bundle in list_bundles("bo_head_"):
        bname = os.path.basename(bundle).replace('.unity3d', '')
        out = f"{OUT}/{bname}.glb"
        tex = f"{EXTRACTED}/cf_face_00_t.png"
        extract_best_smr(bundle, out, tex, min_verts=500, name=bname)

    # ── 前髪 ──
    print("\n=== 前髪 ===")
    for bundle in list_bundles("bo_hair_f_"):
        bname = os.path.basename(bundle).replace('.unity3d', '')
        out = f"{OUT}/{bname}.glb"
        # テクスチャをバンドル内から抽出
        env = UnityPy.load(bundle)
        tex = None
        for obj2 in env.objects:
            if obj2.type.name == 'Texture2D':
                t2 = obj2.read()
                if t2.m_Name and '_t' in t2.m_Name:
                    tmp = f"/tmp/kk_hair_tex_{t2.m_Name}.png"
                    try:
                        t2.image.save(tmp)
                        tex = tmp
                        break
                    except: pass
        extract_best_smr(bundle, out, tex, min_verts=100, name=bname)

    # ── 後ろ髪 ──
    print("\n=== 後ろ髪 ===")
    for bundle in list_bundles("bo_hair_b_"):
        bname = os.path.basename(bundle).replace('.unity3d', '')
        out = f"{OUT}/{bname}.glb"
        env = UnityPy.load(bundle)
        tex = None
        for obj2 in env.objects:
            if obj2.type.name == 'Texture2D':
                t2 = obj2.read()
                if t2.m_Name and '_t' in t2.m_Name:
                    tmp = f"/tmp/kk_hair_tex_{t2.m_Name}.png"
                    try:
                        t2.image.save(tmp)
                        tex = tmp
                        break
                    except: pass
        extract_best_smr(bundle, out, tex, min_verts=100, name=bname)

    # ── トップス ──
    print("\n=== トップス ===")
    for bundle in list_bundles("co_top_"):
        bname = os.path.basename(bundle).replace('.unity3d', '')
        out = f"{OUT}/{bname}.glb"
        env = UnityPy.load(bundle)
        tex = None
        for obj2 in env.objects:
            if obj2.type.name == 'Texture2D':
                t2 = obj2.read()
                if t2.m_Name and '_t' in t2.m_Name and 'cf_' in t2.m_Name:
                    tmp = f"/tmp/kk_top_tex_{t2.m_Name}.png"
                    try:
                        t2.image.save(tmp)
                        tex = tmp
                        break
                    except: pass
        extract_best_smr(bundle, out, tex, min_verts=200, name=bname)

    # ── ボトムス ──
    print("\n=== ボトムス ===")
    for bundle in list_bundles("co_bot_"):
        bname = os.path.basename(bundle).replace('.unity3d', '')
        out = f"{OUT}/{bname}.glb"
        extract_best_smr(bundle, out, None, min_verts=200, name=bname)

    # マニフェスト生成
    manifest = {}
    for glb in sorted(os.listdir(OUT)):
        if glb.endswith('.glb'):
            manifest[glb.replace('.glb','')] = f'/models/{glb}'
    with open(f"{OUT}/../model-manifest.json", 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"\n=== 完了: {len(manifest)} GLBファイル ===")

if __name__ == '__main__':
    extract_all()
