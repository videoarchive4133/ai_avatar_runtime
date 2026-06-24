import bpy
import sys
from pathlib import Path

argv = sys.argv
if "--" not in argv:
    raise SystemExit("usage: blender --background --python tools/convert_vrm_to_glb.py -- input.vrm output.glb")

args = argv[argv.index("--") + 1:]
if len(args) < 2:
    raise SystemExit("usage: input.vrm output.glb")

src = Path(args[0]).resolve()
dst = Path(args[1]).resolve()
dst.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

bpy.ops.preferences.addon_enable(module="VRM_Addon_for_Blender-release")

bpy.ops.import_scene.vrm(filepath=str(src))

print("Objects after import:")
for obj in bpy.context.scene.objects:
    print(obj.name, obj.type)

bpy.ops.export_scene.gltf(
    filepath=str(dst),
    export_format="GLB",
    export_apply=False,
    export_yup=True,
    export_animations=True,
)

print(f"converted: {src} -> {dst}")
