#!/usr/bin/env python3
"""
不足している全GLBを一括抽出する。
既存のglbがあればスキップ。新フォーマット(m_VertexData)に対応。
"""
import UnityPy, struct, os, glob
import numpy as np

KK = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
OUT = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
os.makedirs(OUT, exist_ok=True)

CHARA_DIR = glob.escape(f"{KK}/abdata/chara/")

import sys
sys.path.insert(0, os.path.dirname(__file__))
from kk_to_glb import (smr_to_glb, GLBBuilder, u2g_pos, u2g_quat,
                        mat4_identity, quat_to_mat4, mat4_mul, mat4_translate, mat4_scale)
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Accessor, BufferView, Buffer,
    Skin, Material, PbrMetallicRoughness, Image, Texture, TextureInfo,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER,
    FLOAT, UNSIGNED_SHORT, UNSIGNED_INT,
    SCALAR, VEC2, VEC3, VEC4, MAT4,
)

# フォーマット別バイトサイズ (Unity VertexAttributeFormat)
FMT_SIZE = {0: 4, 1: 2, 2: 1, 3: 2, 4: 2, 11: 4, 12: 4}  # fmt → bytes per component


# ── 新フォーマット用パーサ ────────────────────────────────────────────────────
def parse_vertex_data(mesh, n):
    """
    m_VertexData のストリームバッファから頂点データを抽出。
    戻り値: (verts, norms, uvs) - それぞれ float32 ndarray または None
    """
    vdata = mesh.m_VertexData
    raw = vdata.m_DataSize  # bytes

    channels = vdata.m_Channels

    # stream ごとの stride = max(offset + dim * bytes_per_component)
    stream_stride = {}
    for ch in channels:
        if ch.dimension == 0:
            continue
        s = getattr(ch, 'stream', 0)
        bpc = FMT_SIZE.get(ch.format, 4)
        end = ch.offset + ch.dimension * bpc
        stream_stride[s] = max(stream_stride.get(s, 0), end)

    # ストリーム開始位置 (16バイトアライメント)
    sorted_streams = sorted(stream_stride.keys())
    stream_start = {}
    pos = 0
    for s in sorted_streams:
        stream_start[s] = pos
        size = n * stream_stride[s]
        pos += size
        if pos % 16 != 0:
            pos += 16 - (pos % 16)

    def read_channel_f32(ch_idx):
        """チャンネルを float32 として読む。fmt=0以外は変換。"""
        ch = channels[ch_idx]
        if ch.dimension == 0:
            return None
        s = getattr(ch, 'stream', 0)
        stride = stream_stride[s]
        base = stream_start[s]
        offset = ch.offset
        dim = ch.dimension
        fmt = ch.format
        bpc = FMT_SIZE.get(fmt, 4)
        result = np.zeros((n, dim), dtype=np.float32)
        for i in range(n):
            addr = base + i * stride + offset
            if fmt == 0:  # float32
                vals = struct.unpack_from(f'<{dim}f', raw, addr)
            elif fmt == 1:  # float16
                vals = [struct.unpack_from('<e', raw, addr + k * 2)[0] for k in range(dim)]
            elif fmt in (2, 3):  # SNorm8 / UNorm16 → skip (tangents etc.)
                vals = [0.0] * dim
            else:
                vals = [0.0] * dim
            result[i] = vals
        return result

    # ch[0]=POSITION, ch[1]=NORMAL, ch[3]=UV (あるいは ch[2] がUVの場合も)
    pos3 = read_channel_f32(0)
    norm3 = read_channel_f32(1) if channels[1].dimension > 0 else None

    # UV: ch[3] が float32 UV のはず。なければ ch[2] を試す
    uv2 = None
    for uv_idx in [3, 2]:
        if len(channels) > uv_idx and channels[uv_idx].dimension == 2 and channels[uv_idx].format == 0:
            uv2 = read_channel_f32(uv_idx)
            break

    return pos3, norm3, uv2


def smr_to_glb_new(env, smr, out_path, tex_path=None):
    """新フォーマット (m_VertexData) 対応 GLB 保存"""
    mesh = smr.m_Mesh.read()
    vdata = mesh.m_VertexData
    if not vdata or vdata.m_VertexCount == 0:
        return False
    n = vdata.m_VertexCount

    pos3, norm3, uv2 = parse_vertex_data(mesh, n)
    if pos3 is None:
        return False

    # Unity left-hand → glTF right-hand (X反転)
    verts = np.column_stack([-pos3[:, 0], pos3[:, 1], pos3[:, 2]]).astype(np.float32)
    norms = None
    if norm3 is not None:
        norms = np.column_stack([-norm3[:, 0], norm3[:, 1], norm3[:, 2]]).astype(np.float32)
    uvs = None
    if uv2 is not None:
        uvs = np.column_stack([uv2[:, 0], 1.0 - uv2[:, 1]]).astype(np.float32)

    # インデックス
    idx_buf = mesh.m_IndexBuffer
    if isinstance(idx_buf, list):
        idx_buf = bytes(idx_buf)
    fmt = '<H' if mesh.m_IndexFormat == 0 else '<I'
    idx_size = 2 if mesh.m_IndexFormat == 0 else 4
    count = len(idx_buf) // idx_size
    indices_flat = list(struct.unpack_from(f'<{count}{fmt[1]}', idx_buf))
    tris = []
    for i in range(0, len(indices_flat) - 2, 3):
        tris.append(indices_flat[i])
        tris.append(indices_flat[i + 2])
        tris.append(indices_flat[i + 1])
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
        totals = weights0.sum(axis=1, keepdims=True)
        totals = np.where(totals == 0, 1, totals)
        weights0 /= totals

    # ボーン名
    bones_list = smr.m_Bones
    bone_names = []
    for bp in bones_list:
        try:
            bone_names.append(bp.read().m_GameObject.read().m_Name)
        except:
            bone_names.append(f'bone_{len(bone_names)}')

    # バインドポーズ
    bind_poses = mesh.m_BindPose
    inv_bind_mats = []
    for bp in bind_poses:
        try:
            m = bp
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

    bone_node_idx = {}
    for i, bname in enumerate(bone_names):
        node = Node(name=bname)
        node_idx = len(b.gltf.nodes)
        bone_node_idx[i] = node_idx
        b.gltf.nodes.append(node)

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
        mat.pbrMetallicRoughness = PbrMetallicRoughness(
            baseColorTexture=TextureInfo(index=0),
            metallicFactor=0.0,
            roughnessFactor=0.9,
        )
        mat.doubleSided = True
        b.gltf.materials.append(mat)
        mat_idx = 0

    prim = Primitive(attributes=attr, indices=idx_acc)
    if mat_idx is not None:
        prim.material = mat_idx
    mesh_obj = Mesh(primitives=[prim])
    b.gltf.meshes.append(mesh_obj)

    if inv_bind_mats:
        ibm_data = np.array(inv_bind_mats, dtype=np.float32)
        ibm_acc = b.add_accessor(ibm_data, FLOAT, MAT4)
        skin_obj = Skin(
            joints=list(bone_node_idx.values()),
            inverseBindMatrices=ibm_acc,
            name='skin',
        )
        b.gltf.skins.append(skin_obj)

    mesh_node_idx = len(b.gltf.nodes)
    mesh_node = Node(name='cf_mesh', mesh=0)
    if b.gltf.skins:
        mesh_node.skin = 0
    b.gltf.nodes.append(mesh_node)

    b.gltf.scenes[0].nodes = [mesh_node_idx] + list(bone_node_idx.values())[:1]
    b.build(out_path)
    return True


def extract_bundle(bundle_path, out_name=None):
    bname = os.path.basename(bundle_path).replace('.unity3d', '')
    out_name = out_name or bname
    out_path = f"{OUT}/{out_name}.glb"

    if os.path.exists(out_path):
        print(f"  SKIP: {out_name}")
        return True

    try:
        env = UnityPy.load(bundle_path)
    except Exception as e:
        print(f"  FAIL (load): {bname}: {e}")
        return False

    best = None
    best_v = 0
    best_is_new = False

    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer':
            continue
        try:
            smr = obj.read()
            if not smr.m_Mesh:
                continue
            mesh = smr.m_Mesh.read()
            vdata = mesh.m_VertexData
            vcount = vdata.m_VertexCount if vdata else 0
            is_new = vcount > 0 and not mesh.m_Vertices
            if vcount > best_v:
                best_v = vcount
                best = smr
                best_is_new = is_new
        except:
            pass

    if best is None or best_v == 0:
        print(f"  FAIL (no mesh): {bname}")
        return False

    tex_path = None
    for obj in env.objects:
        if obj.type.name == 'Texture2D':
            try:
                tex = obj.read()
                if tex.m_Name:
                    tmp = f"/tmp/kk_tex_{tex.m_Name}.png"
                    tex.image.save(tmp)
                    tex_path = tmp
                    break
            except:
                pass

    if best_is_new:
        ok = smr_to_glb_new(env, best, out_path, tex_path)
    else:
        ok = smr_to_glb(env, best, out_path, tex_path)

    status = 'OK' if ok else 'FAIL'
    fmt = 'new' if best_is_new else 'legacy'
    print(f"  {status} [{fmt}]: {out_name} ({best_v} verts)")
    return ok


def extract_pattern(pattern, label):
    print(f"\n=== {label} ===")
    files = sorted(glob.glob(CHARA_DIR + pattern))
    if not files:
        print(f"  なし: {pattern}")
        return
    for f in files:
        extract_bundle(f)


# ── 抽出実行 ─────────────────────────────────────────────────────────────────
extract_pattern("bo_hair_f_*.unity3d", "前髪")
extract_pattern("bo_hair_b_*.unity3d", "後髪")
extract_pattern("bo_hair_s_*.unity3d", "サイド髪")
extract_pattern("bo_hair_o_*.unity3d", "アホ毛/オーナメント")
extract_pattern("bo_head_*.unity3d", "頭部")
extract_pattern("co_top_*.unity3d", "トップス")
extract_pattern("co_bot_*.unity3d", "ボトムス")
extract_pattern("co_bra_*.unity3d", "ブラ")
extract_pattern("co_gloves_*.unity3d", "グローブ")
extract_pattern("co_panst_*.unity3d", "パンスト")
extract_pattern("co_shoes_*.unity3d", "靴")
extract_pattern("co_shorts_*.unity3d", "ショーツ")
extract_pattern("co_socks_*.unity3d", "ソックス")
extract_pattern("cpo_jacket_a_*.unity3d", "ジャケットA")
extract_pattern("cpo_jacket_b_*.unity3d", "ジャケットB")
extract_pattern("cpo_jacket_c_*.unity3d", "ジャケットC")
extract_pattern("cpo_sailor_a_*.unity3d", "セーラーA")
extract_pattern("cpo_sailor_b_*.unity3d", "セーラーB")
extract_pattern("cpo_sailor_c_*.unity3d", "セーラーC")

print("\n=== 完了 ===")
all_glbs = sorted(glob.glob(f"{OUT}/*.glb"))
print(f"合計GLBファイル数: {len(all_glbs)}")
