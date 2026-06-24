import argparse
import os
import sys

import bpy


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_bvh(input_path):
    bpy.ops.import_anim.bvh(
        filepath=input_path,
        global_scale=1.0,
        rotate_mode='XYZ',
    )


def export_fbx(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=output_path,
        use_selection=False,
        add_leaf_bones=False,
        bake_anim=True,
        bake_anim_use_all_bones=True,
        bake_anim_force_startend_keying=True,
        axis_forward='-Z',
        axis_up='Y',
        object_types={'ARMATURE'},
    )


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args(argv)

    reset_scene()
    import_bvh(args.input)
    export_fbx(args.output)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
