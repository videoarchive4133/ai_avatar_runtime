#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { BVHLoader } from '../viewer_three_vrm/node_modules/three/examples/jsm/loaders/BVHLoader.js';
import { GLTFExporter } from '../viewer_three_vrm/node_modules/three/examples/jsm/exporters/GLTFExporter.js';

class FileReaderPolyfill {
  constructor() {
    this.onload = null;
    this.onloadend = null;
    this.onerror = null;
    this.result = null;
  }

  _finish(onload) {
    onload?.({ target: this });
    this.onloadend?.({ target: this });
  }

  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this._finish(this.onload);
      })
      .catch((error) => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
        this._finish(this.onload);
      })
      .catch((error) => this.onerror?.(error));
  }
}

globalThis.FileReader = FileReaderPolyfill;

class VRMAnimationExporterPlugin {
  constructor(writer) {
    this.writer = writer;
    this.name = 'VRMC_vrm_animation';
  }

  afterParse(input) {
    if (!Array.isArray(input)) {
      return;
    }

    const root = input[0];
    const vrmBoneMap = root.userData?.vrmBoneMap;
    if (!vrmBoneMap) {
      return;
    }

    const humanBones = {};
    for (const [boneName, bone] of vrmBoneMap) {
      const node = this.writer.nodeMap.get(bone);
      if (node != null) {
        humanBones[boneName] = { node };
      }
    }

    const gltf = this.writer.json;
    gltf.extensionsUsed ??= [];
    if (!gltf.extensionsUsed.includes(this.name)) {
      gltf.extensionsUsed.push(this.name);
    }
    gltf.extensions ??= {};
    gltf.extensions[this.name] = {
      specVersion: '1.0',
      humanoid: { humanBones },
    };
  }
}

function findBone(root, ...names) {
  for (const name of names) {
    const bone = root.getObjectByName(name);
    if (bone) {
      return bone;
    }
  }
  return null;
}

function buildVrmBoneMap(root) {
  const entries = [
    ['hips', findBone(root, 'Hips')],
    ['spine', findBone(root, 'LowerBack', 'Spine')],
    ['chest', findBone(root, 'Spine', 'Spine1')],
    ['upperChest', findBone(root, 'Spine1', 'Neck')],
    ['neck', findBone(root, 'Neck1', 'Neck')],
    ['head', findBone(root, 'Head')],
    ['leftUpperLeg', findBone(root, 'LeftUpLeg')],
    ['leftLowerLeg', findBone(root, 'LeftLeg')],
    ['leftFoot', findBone(root, 'LeftFoot')],
    ['leftToes', findBone(root, 'LeftToeBase')],
    ['rightUpperLeg', findBone(root, 'RightUpLeg')],
    ['rightLowerLeg', findBone(root, 'RightLeg')],
    ['rightFoot', findBone(root, 'RightFoot')],
    ['rightToes', findBone(root, 'RightToeBase')],
    ['leftShoulder', findBone(root, 'LeftShoulder')],
    ['leftUpperArm', findBone(root, 'LeftArm')],
    ['leftLowerArm', findBone(root, 'LeftForeArm')],
    ['leftHand', findBone(root, 'LeftHand')],
    ['rightShoulder', findBone(root, 'RightShoulder')],
    ['rightUpperArm', findBone(root, 'RightArm')],
    ['rightLowerArm', findBone(root, 'RightForeArm')],
    ['rightHand', findBone(root, 'RightHand')],
  ];

  return new Map(entries.filter(([, bone]) => bone != null));
}

function makeOutputDir(outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

function loadBvh(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return new BVHLoader().parse(text);
}

async function exportVrma({ sourcePath, outputPath, clipName }) {
  const bvh = loadBvh(sourcePath);
  const root = bvh.skeleton.bones[0];

  root.userData.vrmBoneMap = buildVrmBoneMap(root);

  root.traverse((obj) => {
    if (obj.isBone) {
      obj.position.multiplyScalar(0.01);
    }
  });
  root.updateWorldMatrix(false, true);

  const clip = bvh.clip.clone();
  clip.name = clipName || path.basename(sourcePath, path.extname(sourcePath));
  clip.tracks = clip.tracks.filter((track) => {
    return track.name === 'Hips.position' || track.name.endsWith('.quaternion');
  });
  clip.tracks.forEach((track) => {
    if (track.name === 'Hips.position') {
      track.values = track.values.map((value) => value * 0.01);
    }
  });

  const exporter = new GLTFExporter();
  exporter.register((writer) => new VRMAnimationExporterPlugin(writer));

  const arrayBuffer = await exporter.parseAsync(root, {
    animations: [clip],
    binary: true,
  });

  makeOutputDir(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

function printUsage() {
  console.error('Usage: node tools/bvh_to_vrma.mjs SOURCE_BVH OUTPUT_VRMA [CLIP_NAME]');
}

async function main(argv) {
  const [sourcePath, outputPath, clipName] = argv;
  if (!sourcePath || !outputPath) {
    printUsage();
    process.exit(1);
  }

  await exportVrma({
    sourcePath: path.resolve(sourcePath),
    outputPath: path.resolve(outputPath),
    clipName,
  });
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
