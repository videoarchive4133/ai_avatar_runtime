"""
KKキャラクター組み立てスクリプト
- 各パーツGLB(ボディ・頭・髪・制服)を読み込み
- 適切な色を適用
- 単一GLBとして出力
使い方: blender --background --python assemble_character.py
"""
import bpy, os, math

MODELS_DIR = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/models"
BASE_GLB   = "/home/k/Desktop/ai_avatar_runtime/kk_charamake/public/kk_character.glb"
OUT_GLB    = "/home/k/Desktop/ai_avatar_runtime/viewer_three_vrm/public/assets/kk_assembled.glb"

# キャラクター設定 (参照画像に合わせた黒髪セーラー服キャラ)
CONFIG = {
    "skin_color":    (0.98, 0.85, 0.76),   # 白い肌（少し黄み）
    "hair_color":    (0.02, 0.02, 0.03),   # ほぼ黒
    "uniform_color": (0.05, 0.06, 0.15),   # 濃紺
    "collar_color":  (0.95, 0.95, 0.95),   # 白いカラー
    "ribbon_color":  (0.60, 0.03, 0.07),   # 深紅
    "socks_color":   (0.92, 0.92, 0.92),   # 白いソックス
    "shoes_color":   (0.04, 0.04, 0.05),   # 黒い靴
}

PARTS = [
    # (ファイル名, スロット名, 色の種類)
    ("cf_body_base.glb",  "body",       "skin"),
    ("bo_head_00.glb",    "head",       "skin"),
    ("bo_hair_b_13.glb",  "hair_back",  "hair"),
    ("bo_hair_f_13.glb",  "hair_front", "hair"),
    ("co_top_00.glb",     "top",        "uniform"),
    ("co_bot_00.glb",     "bottom",     "uniform"),
    ("co_socks_00.glb",   "socks",      "socks"),
    ("co_shoes_00.glb",   "shoes",      "shoes"),
]

COLOR_MAP = {
    "skin":    CONFIG["skin_color"],
    "hair":    CONFIG["hair_color"],
    "uniform": CONFIG["uniform_color"],
    "socks":   CONFIG["socks_color"],
    "shoes":   CONFIG["shoes_color"],
}

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for d in [bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
              bpy.data.images, bpy.data.collections]:
        for item in list(d):
            d.remove(item)

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def apply_color(objects, color_rgb):
    r, g, b = color_rgb
    for obj in objects:
        if obj.type != 'MESH':
            continue
        for slot in obj.material_slots:
            if not slot.material:
                # マテリアルがない場合は新規作成
                mat = bpy.data.materials.new(name=f"mat_{obj.name}")
                mat.use_nodes = True
                obj.data.materials.append(mat)
                slot.material = mat
            m = slot.material
            if m.use_nodes and m.node_tree:
                for node in m.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        node.inputs['Base Color'].default_value = (r, g, b, 1.0)
                        node.inputs['Metallic'].default_value = 0.0
                        node.inputs['Roughness'].default_value = 0.85
            else:
                m.diffuse_color = (r, g, b, 1.0)

def main():
    clear_scene()
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)

    all_objects = []

    for (filename, slot, color_type) in PARTS:
        path = os.path.join(MODELS_DIR, filename)
        if not os.path.exists(path):
            print(f"[SKIP] {path} not found")
            continue
        print(f"[LOAD] {filename} ({slot})")
        objects = import_glb(path)
        color = COLOR_MAP.get(color_type)
        if color:
            apply_color(objects, color)
        all_objects.extend(objects)

    if not all_objects:
        print("[ERROR] パーツが1つも読み込まれませんでした")
        return

    # 全オブジェクトを選択してエクスポート
    bpy.ops.object.select_all(action='DESELECT')
    for obj in all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = all_objects[0]

    print(f"[EXPORT] {OUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format='GLB',
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_colors=True,
        export_skins=True,
        export_animations=False,
    )
    print(f"[DONE] {OUT_GLB}")

main()
