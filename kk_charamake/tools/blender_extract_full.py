"""
KKキャラクターをBlenderで正確にGLB化する。
- ベースボディ: 完全なスケルトン + 体メッシュ (Tポーズ)
- 各パーツ: 独立したGLB、ボーンはIBM^-1でTポーズ位置に配置
使い方: blender --background --python blender_extract_full.py
"""
import bpy, sys, os, math
import mathutils
import numpy as np

sys.path.insert(0, '/home/k/.local/lib/python3.12/site-packages')
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

KK   = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
OUT  = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
TEXDIR = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted"
os.makedirs(OUT, exist_ok=True)

HIP_OFFSET = 1.1435  # 腰のワールドY座標（体メッシュを正しく配置するためのオフセット）

# ── ヘルパー ──────────────────────────────────────────────────────────────────

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for i in list(bpy.data.images): bpy.data.images.remove(i)

def unity_to_blender_pos(x, y, z):
    """Unity Y-up Left-hand → Blender Z-up Right-hand"""
    return mathutils.Vector((x, z, y))  # Unity(X,Y,Z) → Blender(X,Z,Y) but we handle axis in armature

def mat4_from_unity(ibm):
    """Unity Matrix4x4 (eXY: row X, col Y) → numpy 4x4 row-major"""
    return np.array([
        [ibm.e00, ibm.e01, ibm.e02, ibm.e03],
        [ibm.e10, ibm.e11, ibm.e12, ibm.e13],
        [ibm.e20, ibm.e21, ibm.e22, ibm.e23],
        [ibm.e30, ibm.e31, ibm.e32, ibm.e33],
    ], dtype=np.float64)

# ── スケルトン作成 ─────────────────────────────────────────────────────────────

def build_armature_from_ibm(bone_names, ibms, arm_name='Armature'):
    """IBMからTポーズのアーマチュアを作成"""
    arm_data = bpy.data.armatures.new(arm_name)
    arm_obj  = bpy.data.objects.new(arm_name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')

    bones = {}
    for i, (bname, ibm_data) in enumerate(zip(bone_names, ibms)):
        ibm = mat4_from_unity(ibm_data)
        try:
            bind = np.linalg.inv(ibm)  # = ボーンのワールド変換行列
        except:
            bind = np.eye(4)
        # Unity col3 = translation in Unity coords
        tx = bind[0, 3]
        ty = bind[1, 3]
        tz = bind[2, 3]
        # Unity(X,Y,Z) → Blender(X,Z,Y) ただし armature は Z-up
        head = mathutils.Vector((tx, tz, ty))

        eb = arm_data.edit_bones.new(bname)
        eb.head = head
        eb.tail = head + mathutils.Vector((0, 0, 0.03))  # 短い tail
        eb.use_connect = False
        bones[bname] = eb

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

# ── メッシュ作成 ──────────────────────────────────────────────────────────────

def build_mesh(smr, arm_obj, mesh_name, tex_path=None, y_offset=0.0):
    """SkinnedMeshRenderer → Blenderメッシュオブジェクト"""
    mesh_obj_u = smr.m_Mesh.read()
    handler = MeshHandler(mesh_obj_u)
    handler.process()

    if handler.m_Vertices is None:
        print(f"  SKIP {mesh_name}: no vertices")
        return None

    verts_raw = np.array(handler.m_Vertices, dtype=np.float32)  # (N,3) MeshHandlerがX反転済み

    # Unity(X,Y,Z) → Blender(X,Z,Y): MeshHandlerはすでにX反転→X=-X_unity
    # Blenderは Z-up なので: bl_x = unity_x_negated, bl_y = unity_z, bl_z = unity_y
    # MeshHandlerの頂点: m_Vertices[i] = (-x_unity, y_unity, z_unity)
    n = len(verts_raw)
    verts_bl = [(v[0], v[2], v[1] + y_offset) for v in verts_raw]  # X, Z, Y+offset

    # 三角形
    tris_raw = handler.get_triangles()
    if not tris_raw: return None
    faces = []
    for sub in tris_raw:
        for tri in sub:
            i0, i1, i2 = tri
            faces.append((i0, i2, i1))  # winding反転

    # Blenderメッシュ
    bl_mesh = bpy.data.meshes.new(mesh_name)
    bl_mesh.from_pydata(verts_bl, [], faces)
    bl_mesh.update()

    # UV
    if handler.m_UV0 is not None:
        uvs = np.array(handler.m_UV0, dtype=np.float32)
        uv_layer = bl_mesh.uv_layers.new(name='UVMap')
        for poly in bl_mesh.polygons:
            for li in poly.loop_indices:
                vi = bl_mesh.loops[li].vertex_index
                uv_layer.data[li].uv = (uvs[vi, 0], 1.0 - uvs[vi, 1])

    obj = bpy.data.objects.new(mesh_name, bl_mesh)
    bpy.context.scene.collection.objects.link(obj)

    # アーマチュアモディファイア
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm_obj
    obj.parent = arm_obj

    # 頂点グループ（ボーンウェイト）
    if handler.m_BoneIndices is not None and handler.m_BoneWeights is not None:
        bi = np.array(handler.m_BoneIndices, dtype=np.int32)
        bw = np.array(handler.m_BoneWeights, dtype=np.float32)
        bone_names_smr = []
        for bp in smr.m_Bones:
            try: bone_names_smr.append(bp.read().m_GameObject.read().m_Name)
            except: bone_names_smr.append(f'bone_{len(bone_names_smr)}')

        vgs = {}
        for vi in range(n):
            for k in range(4):
                idx = bi[vi, k]
                w   = bw[vi, k]
                if w <= 0 or idx >= len(bone_names_smr): continue
                bname = bone_names_smr[idx]
                if bname not in vgs:
                    vgs[bname] = obj.vertex_groups.new(name=bname)
                vgs[bname].add([vi], w, 'ADD')

    # テクスチャ
    if tex_path and os.path.exists(tex_path):
        mat = bpy.data.materials.new(mesh_name + '_mat')
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.8
        bsdf.inputs['Metallic'].default_value = 0.0
        tn = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tn.image = bpy.data.images.load(tex_path)
        mat.node_tree.links.new(bsdf.inputs['Base Color'], tn.outputs['Color'])
        bl_mesh.materials.append(mat)

    return obj

# ── GLBエクスポート ────────────────────────────────────────────────────────────

def export_glb(out_path):
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,
    )
    sz = os.path.getsize(out_path) // 1024
    print(f"  → {os.path.basename(out_path)} ({sz} KB)")

# ── ベースボディ ──────────────────────────────────────────────────────────────

def extract_body():
    print("\n=== ベースボディ ===")
    clear()
    env = UnityPy.load(f"{KK}/abdata/chara/oo_base.unity3d")

    best_smr = None
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        if mesh.m_VertexData and mesh.m_VertexData.m_VertexCount == 8302:
            best_smr = smr
            break

    if not best_smr:
        print("  ERROR: body SMR not found")
        return

    # ボーン名とIBM
    bone_names = []
    ibms = best_smr.m_Mesh.read().m_BindPose
    for bp in best_smr.m_Bones:
        try: bone_names.append(bp.read().m_GameObject.read().m_Name)
        except: bone_names.append(f'bone_{len(bone_names)}')

    arm_obj = build_armature_from_ibm(bone_names, ibms, 'Body_Armature')
    tex = f"{TEXDIR}/cf_body_00_t.png"
    mesh_obj = build_mesh(best_smr, arm_obj, 'cf_body', tex, y_offset=HIP_OFFSET)

    if mesh_obj:
        print(f"  body: {len(mesh_obj.data.vertices)} verts")
        export_glb(f"{OUT}/cf_body_base.glb")

# ── 頭部 ──────────────────────────────────────────────────────────────────────

def extract_head(bundle_path, out_name):
    print(f"\n=== {out_name} ===")
    clear()
    env = UnityPy.load(bundle_path)

    # 最大のSMR (cf_O_face)
    best_smr, best_v = None, 0
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vc = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
        if vc > best_v and vc >= 500:
            best_v, best_smr = vc, smr

    if not best_smr:
        print(f"  SKIP: no SMR")
        return

    ibms = best_smr.m_Mesh.read().m_BindPose
    bone_names = []
    for bp in best_smr.m_Bones:
        try: bone_names.append(bp.read().m_GameObject.read().m_Name)
        except: bone_names.append(f'bone_{len(bone_names)}')

    # 頭部IBMのY中心を計算
    y_offset = HIP_OFFSET  # 頭部も腰ベースのIBMを持つ場合
    arm_obj = build_armature_from_ibm(bone_names, ibms, f'{out_name}_arm')
    tex = f"{TEXDIR}/cf_face_00_t.png"
    mesh_obj = build_mesh(best_smr, arm_obj, out_name, tex, y_offset=y_offset)

    if mesh_obj:
        print(f"  head: {len(mesh_obj.data.vertices)} verts")
        export_glb(f"{OUT}/{out_name}.glb")

# ── 髪 ───────────────────────────────────────────────────────────────────────

def extract_hair(bundle_path, out_name, hair_type='front'):
    print(f"  {out_name}...")
    clear()
    env = UnityPy.load(bundle_path)

    best_smr, best_v = None, 0
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vc = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
        if vc > best_v:
            best_v, best_smr = vc, smr

    if not best_smr or best_v < 100:
        return

    ibms = best_smr.m_Mesh.read().m_BindPose
    bone_names = []
    for bp in best_smr.m_Bones:
        try: bone_names.append(bp.read().m_GameObject.read().m_Name)
        except: bone_names.append(f'bone_{len(bone_names)}')

    # 髪のIBM^-1からY中心を計算してオフセット
    hair_y_positions = []
    for ibm_data in ibms:
        ibm = mat4_from_unity(ibm_data)
        try:
            bind = np.linalg.inv(ibm)
            hair_y_positions.append(bind[1, 3])
        except: pass

    # 髪はcf_j_head (Y=1.515) に取り付く。IBMのYオフセットを正規化
    hair_y_min = min(hair_y_positions) if hair_y_positions else 0
    # 髪IBMのY範囲がわからないのでHIP_OFFSETを使う
    y_offset = HIP_OFFSET

    # テクスチャを内部から探す
    tex = None
    for obj2 in env.objects:
        if obj2.type.name == 'Texture2D':
            t2 = obj2.read()
            if t2.m_Name and '_t' in t2.m_Name:
                tmp = f"/tmp/kk_{out_name}_tex.png"
                try:
                    t2.image.save(tmp)
                    tex = tmp
                    break
                except: pass

    arm_obj = build_armature_from_ibm(bone_names, ibms, f'{out_name}_arm')
    mesh_obj = build_mesh(best_smr, arm_obj, out_name, tex, y_offset=y_offset)
    if mesh_obj:
        export_glb(f"{OUT}/{out_name}.glb")

# ── 服 ────────────────────────────────────────────────────────────────────────

def extract_clothes(bundle_path, out_name):
    print(f"  {out_name}...")
    clear()
    env = UnityPy.load(bundle_path)

    best_smr, best_v = None, 0
    for obj in env.objects:
        if obj.type.name != 'SkinnedMeshRenderer': continue
        smr = obj.read()
        if not smr.m_Mesh: continue
        mesh = smr.m_Mesh.read()
        vc = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
        if vc > best_v and vc >= 200:
            best_v, best_smr = vc, smr

    if not best_smr: return

    ibms = best_smr.m_Mesh.read().m_BindPose
    bone_names = []
    for bp in best_smr.m_Bones:
        try: bone_names.append(bp.read().m_GameObject.read().m_Name)
        except: bone_names.append(f'bone_{len(bone_names)}')

    tex = None
    for obj2 in env.objects:
        if obj2.type.name == 'Texture2D':
            t2 = obj2.read()
            if t2.m_Name and '_t' in t2.m_Name and 'cf_' in t2.m_Name:
                tmp = f"/tmp/kk_{out_name}_tex.png"
                try:
                    t2.image.save(tmp)
                    tex = tmp
                    break
                except: pass

    arm_obj = build_armature_from_ibm(bone_names, ibms, f'{out_name}_arm')
    mesh_obj = build_mesh(best_smr, arm_obj, out_name, tex, y_offset=HIP_OFFSET)
    if mesh_obj:
        export_glb(f"{OUT}/{out_name}.glb")

# ── メイン ────────────────────────────────────────────────────────────────────

def main():
    chara_dir = f"{KK}/abdata/chara"

    # ベースボディ
    extract_body()

    # 頭部
    print("\n=== 頭部 ===")
    for fname in sorted(os.listdir(chara_dir)):
        if fname.startswith('bo_head_') and fname.endswith('.unity3d'):
            extract_head(f"{chara_dir}/{fname}", fname.replace('.unity3d',''))

    # 前髪
    print("\n=== 前髪 ===")
    for fname in sorted(os.listdir(chara_dir)):
        if fname.startswith('bo_hair_f_') and fname.endswith('.unity3d'):
            extract_hair(f"{chara_dir}/{fname}", fname.replace('.unity3d',''), 'front')

    # 後ろ髪
    print("\n=== 後ろ髪 ===")
    for fname in sorted(os.listdir(chara_dir)):
        if fname.startswith('bo_hair_b_') and fname.endswith('.unity3d'):
            extract_hair(f"{chara_dir}/{fname}", fname.replace('.unity3d',''), 'back')

    # 服 (トップス)
    print("\n=== トップス ===")
    for fname in sorted(os.listdir(chara_dir)):
        if fname.startswith('co_top_') and fname.endswith('.unity3d'):
            extract_clothes(f"{chara_dir}/{fname}", fname.replace('.unity3d',''))

    # 服 (ボトムス)
    print("\n=== ボトムス ===")
    for fname in sorted(os.listdir(chara_dir)):
        if fname.startswith('co_bot_') and fname.endswith('.unity3d'):
            extract_clothes(f"{chara_dir}/{fname}", fname.replace('.unity3d',''))

    print("\n=== 全完了 ===")
    print(f"出力: {len([f for f in os.listdir(OUT) if f.endswith('.glb')])} GLBファイル")

main()
