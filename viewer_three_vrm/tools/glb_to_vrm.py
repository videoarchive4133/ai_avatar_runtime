"""
GLB → VRM 変換スクリプト (Blender 4.x + VRM Add-on)
使い方: blender --background --python glb_to_vrm.py -- <input.glb> <output_dir>
"""
import bpy
import sys
import os
import math

argv = sys.argv
sep = argv.index('--') if '--' in argv else len(argv)
args = argv[sep + 1:]

if len(args) < 2:
    print('[ERROR] Usage: blender --background --python glb_to_vrm.py -- <input.glb> <output_dir>')
    sys.exit(1)

INPUT_GLB  = args[0]
OUTPUT_DIR = args[1]
os.makedirs(OUTPUT_DIR, exist_ok=True)

base_name   = os.path.splitext(os.path.basename(INPUT_GLB))[0]
OUTPUT_VRM  = os.path.join(OUTPUT_DIR, base_name + '.vrm')
OUTPUT_GLB  = os.path.join(OUTPUT_DIR, base_name + '_clean.glb')

print(f'[GLB→VRM] 入力: {INPUT_GLB}')
print(f'[GLB→VRM] 出力先: {OUTPUT_DIR}')

# ── シーンをクリア ────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for d in [bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
          bpy.data.images, bpy.data.collections]:
    for item in list(d):
        try: d.remove(item)
        except: pass

# ── GLB インポート ────────────────────────────────────────────────────────────
bpy.ops.import_scene.gltf(filepath=INPUT_GLB)
print(f'[GLB→VRM] インポート完了: {len(bpy.data.objects)}オブジェクト')

# ── メッシュ クリーンアップ ────────────────────────────────────────────────────
mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']
print(f'[GLB→VRM] メッシュ数: {len(mesh_objs)}')

bpy.ops.object.select_all(action='DESELECT')
for obj in mesh_objs:
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # 重複頂点を結合（ほつれ対策）
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    # 法線を外向きに再計算
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
print('[GLB→VRM] メッシュクリーンアップ完了')

# ── アーマチュア（ボーン）を検索 ────────────────────────────────────────────
armature_objs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
has_armature = len(armature_objs) > 0
print(f'[GLB→VRM] アーマチュア: {"あり" if has_armature else "なし"}')

# ── VRM ヒューマノイドボーンのマッピング ──────────────────────────────────────
# 一般的なボーン名パターン → VRM humanoid bone名
VRM_BONE_MAP = {
    # hips
    'hips':        'hips',  'pelvis': 'hips', 'root': 'hips',
    'hip':         'hips',

    # spine chain
    'spine':       'spine',
    'spine1':      'chest', 'spine_01': 'chest', 'chest': 'chest',
    'spine2':      'upperChest', 'spine_02': 'upperChest',

    # neck / head
    'neck':        'neck',
    'head':        'head',

    # shoulders
    'leftshoulder':  'leftShoulder',  'shoulder_l': 'leftShoulder',
    'rightshoulder': 'rightShoulder', 'shoulder_r': 'rightShoulder',

    # upper arms
    'leftarm':   'leftUpperArm', 'upperarm_l': 'leftUpperArm',
    'rightarm':  'rightUpperArm', 'upperarm_r': 'rightUpperArm',
    'left_arm':  'leftUpperArm', 'right_arm':  'rightUpperArm',

    # lower arms
    'leftforearm':  'leftLowerArm', 'lowerarm_l': 'leftLowerArm',
    'rightforearm': 'rightLowerArm', 'lowerarm_r': 'rightLowerArm',
    'left_forearm': 'leftLowerArm', 'right_forearm': 'rightLowerArm',

    # hands
    'lefthand':  'leftHand',  'hand_l': 'leftHand',
    'righthand': 'rightHand', 'hand_r': 'rightHand',
    'left_hand': 'leftHand',  'right_hand': 'rightHand',

    # upper legs
    'leftupleg':  'leftUpperLeg', 'thigh_l': 'leftUpperLeg',
    'rightupleg': 'rightUpperLeg', 'thigh_r': 'rightUpperLeg',
    'left_upleg': 'leftUpperLeg', 'right_upleg': 'rightUpperLeg',

    # lower legs
    'leftleg':  'leftLowerLeg', 'calf_l': 'leftLowerLeg', 'shin_l': 'leftLowerLeg',
    'rightleg': 'rightLowerLeg', 'calf_r': 'rightLowerLeg', 'shin_r': 'rightLowerLeg',
    'left_leg': 'leftLowerLeg', 'right_leg': 'rightLowerLeg',

    # feet
    'leftfoot':  'leftFoot',  'foot_l': 'leftFoot',
    'rightfoot': 'rightFoot', 'foot_r': 'rightFoot',
    'left_foot': 'leftFoot',  'right_foot': 'rightFoot',

    # toes
    'lefttoebase':  'leftToes', 'toe_l': 'leftToes',
    'righttoebase': 'rightToes', 'toe_r': 'rightToes',
}

vrm_possible = False

if has_armature:
    arm = armature_objs[0]
    bone_names = [b.name for b in arm.data.bones]
    print(f'[GLB→VRM] ボーン一覧: {bone_names}')

    # VRM アドオンが有効か確認
    vrm_addon_enabled = 'vrm' in [a.module for a in bpy.context.preferences.addons]
    if not vrm_addon_enabled:
        bpy.ops.preferences.addon_enable(module='vrm')
        vrm_addon_enabled = 'vrm' in [a.module for a in bpy.context.preferences.addons]

    print(f'[GLB→VRM] VRMアドオン: {"有効" if vrm_addon_enabled else "無効"}')

    if vrm_addon_enabled:
        # アーマチュアを選択してVRM1.0ヒューマノイドを初期化
        bpy.ops.object.select_all(action='DESELECT')
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm

        # VRM メタ情報を設定
        if hasattr(arm, 'vrm_addon_extension'):
            ext = arm.vrm_addon_extension
            if hasattr(ext, 'vrm1'):
                meta = ext.vrm1.meta
                meta.vrm_name      = base_name
                meta.authors.clear()
                meta.authors.add().value = 'Auto-converted'
                meta.avatar_permission = 'onlySeparatelyLicensedPerson'
                meta.commercial_usage  = 'personalNonProfit'

            # ヒューマノイドボーンを自動マッピング
            if hasattr(ext, 'vrm1') and hasattr(ext.vrm1, 'humanoid'):
                humanoid = ext.vrm1.humanoid
                hbones   = humanoid.human_bones

                mapped = 0
                for bone in arm.data.bones:
                    key = bone.name.lower().replace('-', '_').replace(' ', '_')
                    vrm_bone = VRM_BONE_MAP.get(key)
                    if vrm_bone and hasattr(hbones, vrm_bone):
                        getattr(hbones, vrm_bone).node.bone_name = bone.name
                        print(f'[GLB→VRM] ボーンマップ: {bone.name} → {vrm_bone}')
                        mapped += 1

                print(f'[GLB→VRM] マッピング済みボーン数: {mapped}')
                vrm_possible = mapped >= 6  # 最低限のボーンが揃っている場合

        if vrm_possible:
            try:
                bpy.ops.export_scene.vrm(
                    filepath        = OUTPUT_VRM,
                    check_existing  = False,
                )
                print(f'[GLB→VRM] VRM出力成功: {OUTPUT_VRM}')
            except Exception as e:
                print(f'[GLB→VRM] VRM出力失敗: {e}')
                vrm_possible = False

# ── VRMが作れなかった場合はクリーン済みGLBを出力 ────────────────────────────
if not vrm_possible:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath         = OUTPUT_GLB,
        use_selection    = True,
        export_format    = 'GLB',
        export_texcoords = True,
        export_normals   = True,
        export_materials = 'EXPORT',
        export_colors    = True,
        export_skins     = True,
        export_animations= False,
    )
    print(f'[GLB→VRM] クリーンGLB出力: {OUTPUT_GLB}')

print('[GLB→VRM] 完了')
