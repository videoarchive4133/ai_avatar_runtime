import bpy
import sys
from pathlib import Path

argv = sys.argv
if "--" not in argv:
    raise SystemExit("usage: blender --background --python tools/convert_fbx_motion_to_glb.py -- input.fbx output.glb")

args = argv[argv.index("--") + 1:]
if len(args) < 2:
    raise SystemExit("missing input/output")

src = Path(args[0]).resolve()
dst = Path(args[1]).resolve()
dst.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

bpy.ops.import_scene.fbx(filepath=str(src))

bpy.ops.export_scene.gltf(
    filepath=str(dst),
    export_format="GLB",
    export_animations=True,
    export_apply=False,
)

print(f"converted: {src} -> {dst}")
