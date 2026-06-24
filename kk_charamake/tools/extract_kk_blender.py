"""
KoiKatsuキャラクターパーツをUnityPy+Blenderで抽出してGLBに変換するスクリプト。
Blenderのバックグラウンドモードで実行する。
使い方: blender --background --python extract_kk_blender.py
"""
import bpy, os, sys, math
import mathutils

# UnityPyをBlenderのPythonで使うためにパスを追加
sys.path.append('/home/k/.local/lib/python3.12/site-packages')
import UnityPy

KK = "/media/k/10128B6C128B559E/[ScrewThisNoise] Koikatsu BetterRepack RX22 SPLIT/[ScrewThisNoise] Koikatsu BetterRepack RX22"
OUT = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
os.makedirs(OUT, exist_ok=True)

# ── ユーティリティ ──────────────────────────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col)

def unity_pos_to_blender(x, y, z):
    """UnityのLeft-handed Y-up → BlenderのRight-handed Z-up"""
    return mathutils.Vector((-x, z, y))

def unity_rot_to_blender(qx, qy, qz, qw):
    """Unityクォータニオン → Blenderクォータニオン"""
    return mathutils.Quaternion((-qw, qx, -qz, -qy))

# ── ボーン階層を再帰的に収集 ────────────────────────────────────────────────────

def collect_bones(go_obj, parent_name=None, bones_dict=None, depth=0):
    """GameObject → {name: {parent, pos, rot, scale}} を返す"""
    if bones_dict is None:
        bones_dict = {}
    try:
        t = go_obj.m_Transform.read()
        name = go_obj.m_Name
        lp = t.m_LocalPosition
        lr = t.m_LocalRotation
        ls = t.m_LocalScale
        bones_dict[name] = {
            'parent': parent_name,
            'pos': (lp.x, lp.y, lp.z),
            'rot': (lr.x, lr.y, lr.z, lr.w),
            'scale': (ls.x, ls.y, ls.z),
        }
        for child_ptr in t.m_Children:
            child_t = child_ptr.read()
            child_go = child_t.m_GameObject.read()
            collect_bones(child_go, name, bones_dict, depth+1)
    except Exception as e:
        pass
    return bones_dict

# ── Blenderアーマチュアを作成 ────────────────────────────────────────────────────

def create_armature(bones_dict, arm_name='KK_Armature'):
    """bones_dictからBlenderアーマチュアを作成し、オブジェクトを返す"""
    arm_data = bpy.data.armatures.new(arm_name)
    arm_obj = bpy.data.objects.new(arm_name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    # アーマチュア全体の変換 (Y-up → Z-up)
    arm_obj.rotation_euler = (math.radians(90), 0, 0)

    bpy.ops.object.mode_set(mode='EDIT')

    bone_objects = {}

    # まず全ボーンを作成
    for name, info in bones_dict.items():
        bone = arm_data.edit_bones.new(name)
        bone.head = (0, 0, 0)
        bone.tail = (0, 0.05, 0)  # デフォルトの長さ
        bone_objects[name] = bone

    # 親子関係を設定 & 位置を設定
    # ワールド位置を計算するために再帰的に処理
    def get_world_pos(name, bones_dict):
        info = bones_dict[name]
        lp = mathutils.Vector(info['pos'])
        lr = mathutils.Quaternion((info['rot'][3], info['rot'][0], info['rot'][1], info['rot'][2]))
        parent = info['parent']
        if parent and parent in bones_dict:
            p_pos, p_rot = get_world_pos(parent, bones_dict)
            world_pos = p_pos + p_rot @ lp
            world_rot = p_rot @ lr
        else:
            world_pos = lp
            world_rot = lr
        return world_pos, world_rot

    world_cache = {}
    for name in bones_dict:
        try:
            wp, wr = get_world_pos(name, bones_dict)
            world_cache[name] = (wp, wr)
        except:
            world_cache[name] = (mathutils.Vector((0,0,0)), mathutils.Quaternion())

    for name, (wp, wr) in world_cache.items():
        if name in bone_objects:
            # Unityの座標系をBlenderに変換
            bpos = mathutils.Vector((wp.x, wp.y, wp.z))
            bone_objects[name].head = bpos
            # tail = head + 少し先
            bone_objects[name].tail = bpos + mathutils.Vector((0, 0.05, 0))

    # 親子関係
    for name, info in bones_dict.items():
        parent = info['parent']
        if parent and parent in bone_objects and name in bone_objects:
            bone_objects[name].parent = bone_objects[parent]

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj, bone_objects

# ── メッシュ + スキニング ────────────────────────────────────────────────────────

def extract_smr_to_blender(smr, arm_obj, bone_idx_to_name, mesh_name='mesh'):
    """SkinnedMeshRendererからBlenderメッシュオブジェクトを作成"""
    mesh_ptr = smr.m_Mesh
    if not mesh_ptr:
        return None
    mesh = mesh_ptr.read()
    vdata = mesh.m_VertexData
    if not vdata or vdata.m_VertexCount == 0:
        return None

    # 頂点データ
    verts_raw = mesh.m_Vertices  # flat list [x,y,z, x,y,z, ...]
    if not verts_raw:
        return None

    n = len(verts_raw) // 3
    vertices = [(-verts_raw[i*3], verts_raw[i*3+2], verts_raw[i*3+1]) for i in range(n)]

    # インデックス (三角形)
    idx_buf = mesh.m_IndexBuffer
    if not idx_buf:
        return None

    import struct
    fmt = '<H' if mesh.m_IndexFormat == 0 else '<I'
    idx_size = 2 if mesh.m_IndexFormat == 0 else 4
    indices = list(struct.unpack_from(f'<{len(idx_buf)//idx_size}{fmt[1]}', idx_buf))

    # SubMesh ごとに面を構築
    faces = []
    for sub in mesh.m_SubMeshes:
        start = sub.firstByte // idx_size if hasattr(sub, 'firstByte') else sub.indexCount
        count = sub.indexCount
        for j in range(0, count - 2, 3):
            i0 = indices[start + j]
            i1 = indices[start + j + 1]
            i2 = indices[start + j + 2]
            if i0 != i1 and i1 != i2 and i2 != i0:
                faces.append((i0, i1, i2))

    if not faces:
        # SubMeshがなければ全体を使う
        for j in range(0, len(indices) - 2, 3):
            i0, i1, i2 = indices[j], indices[j+1], indices[j+2]
            if i0 != i1 and i1 != i2 and i2 != i0:
                faces.append((i0, i1, i2))

    # UVs
    uvs_raw = mesh.m_UV
    has_uv = uvs_raw and len(uvs_raw) >= n * 2

    # Blenderメッシュ作成
    bl_mesh = bpy.data.meshes.new(mesh_name)
    bl_mesh.from_pydata(vertices, [], faces)
    bl_mesh.update()

    if has_uv:
        uv_layer = bl_mesh.uv_layers.new(name='UVMap')
        for poly in bl_mesh.polygons:
            for li in poly.loop_indices:
                vi = bl_mesh.loops[li].vertex_index
                uv_layer.data[li].uv = (uvs_raw[vi*2], uvs_raw[vi*2+1])

    mesh_obj = bpy.data.objects.new(mesh_name, bl_mesh)
    bpy.context.scene.collection.objects.link(mesh_obj)

    # アーマチュアモディファイアを設定
    mod = mesh_obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm_obj
    mesh_obj.parent = arm_obj

    # 頂点グループ (ボーンウェイト)
    skin = mesh.m_Skin
    if skin and bone_idx_to_name:
        vg_cache = {}
        for vi, sw in enumerate(skin):
            for k in range(4):
                bi = getattr(sw, f'boneIndex_{k}_', 0)
                w = getattr(sw, f'weight_{k}_', 0.0)
                if w <= 0: continue
                bone_name = bone_idx_to_name.get(bi)
                if not bone_name: continue
                if bone_name not in vg_cache:
                    vg_cache[bone_name] = mesh_obj.vertex_groups.new(name=bone_name)
                vg_cache[bone_name].add([vi], w, 'REPLACE')

    return mesh_obj

# ── メイン抽出処理 ──────────────────────────────────────────────────────────────

def extract_base_body():
    print("\n=== ベースボディ抽出中 ===")
    clear_scene()

    env = UnityPy.load(f"{KK}/abdata/chara/oo_base.unity3d")

    # スケルトンを取得
    bones_dict = None
    for path, obj in env.container.items():
        if 'p_cf_body_bone.prefab' in path and obj.type.name == 'GameObject':
            go = obj.read()
            bones_dict = collect_bones(go)
            print(f"  ボーン数: {len(bones_dict)}")
            break

    if not bones_dict:
        print("  ERROR: スケルトン見つからず")
        return

    arm_obj, bone_objects = create_armature(bones_dict)

    # SkinnedMeshRenderer (女性ボディ o_body_a, 8302 verts) を探す
    for obj in env.objects:
        if obj.type.name == 'SkinnedMeshRenderer':
            smr = obj.read()
            mesh_ptr = smr.m_Mesh
            if not mesh_ptr: continue
            mesh = mesh_ptr.read()
            vcount = mesh.m_VertexData.m_VertexCount if mesh.m_VertexData else 0
            if vcount != 8302: continue  # メインボディのみ

            # bone index → name マッピング
            bones_list = smr.m_Bones
            bone_idx_to_name = {}
            for i, bp in enumerate(bones_list):
                try:
                    t = bp.read()
                    go = t.m_GameObject.read()
                    bone_idx_to_name[i] = go.m_Name
                except:
                    pass

            print(f"  ボーンインデックスマップ: {len(bone_idx_to_name)} entries")
            mesh_obj = extract_smr_to_blender(smr, arm_obj, bone_idx_to_name, 'cf_body')
            if mesh_obj:
                print(f"  メッシュ作成: {len(mesh_obj.data.vertices)} 頂点")

                # テクスチャ適用
                mat = bpy.data.materials.new('cf_body_mat')
                mat.use_nodes = True
                bsdf = mat.node_tree.nodes['Principled BSDF']
                tn = mat.node_tree.nodes.new('ShaderNodeTexImage')
                tex_path = f"{OUT}/../cf_body_00_t.png"
                if not os.path.exists(tex_path):
                    tex_path = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/extracted/cf_body_00_t.png"
                if os.path.exists(tex_path):
                    tn.image = bpy.data.images.load(tex_path)
                    mat.node_tree.links.new(bsdf.inputs['Base Color'], tn.outputs['Color'])
                mesh_obj.data.materials.append(mat)
            break

    # GLBエクスポート
    out_path = f"{OUT}/cf_body_base.glb"
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB')
    print(f"  保存: {out_path}")

def extract_hair_front():
    print("\n=== 前髪抽出中 ===")

    env = UnityPy.load(f"{KK}/abdata/chara/bo_hair_f_00.unity3d")

    # 各前髪パーツを抽出
    count = 0
    for path, obj in env.container.items():
        if obj.type.name != 'GameObject': continue
        if 'p_cf_hair_f_' not in path: continue

        prefab_name = path.split('/')[-1].replace('.prefab', '')
        clear_scene()

        go = obj.read()
        bones_dict = collect_bones(go)
        if not bones_dict: continue

        arm_obj, _ = create_armature(bones_dict, f'arm_{prefab_name}')

        # この prefab 配下の SkinnedMeshRenderer を探す
        for sobj in env.objects:
            if sobj.type.name != 'SkinnedMeshRenderer': continue
            smr = sobj.read()
            if not smr.m_Mesh: continue

            bones_list = smr.m_Bones
            bone_idx_to_name = {}
            for i, bp in enumerate(bones_list):
                try:
                    bone_idx_to_name[i] = bp.read().m_GameObject.read().m_Name
                except: pass

            mobj = extract_smr_to_blender(smr, arm_obj, bone_idx_to_name, prefab_name)
            if mobj:
                out_path = f"{OUT}/{prefab_name}.glb"
                bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB')
                count += 1
                break

        if count >= 5:  # テスト用: 最初の5パーツのみ
            break

    print(f"  {count} 前髪パーツ保存")

# ── 実行 ────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    extract_base_body()
    # extract_hair_front()  # 後で有効化
    print("\n完了!")
