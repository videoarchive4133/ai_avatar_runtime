import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });

const blobStore = new Map();
const originalCreateObjectURL = URL.createObjectURL.bind(URL);
const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
const originalFetch = global.fetch.bind(global);

URL.createObjectURL = (blob) => {
  const id = `blob:nodedata:${crypto.randomUUID()}`;
  blobStore.set(id, blob);
  return id;
};

URL.revokeObjectURL = (id) => {
  blobStore.delete(id);
  return originalRevokeObjectURL(id);
};

global.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (blobStore.has(url)) {
    const blob = blobStore.get(url);
    const arrayBuffer = await blob.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    });
  }
  return originalFetch(input, init);
};

function loadArrayBuffer(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function makeLoader(PluginCtor) {
  const loader = new GLTFLoader();
  loader.register((parser) => new PluginCtor(parser));
  return loader;
}

async function parseVrm(filePath) {
  const loader = makeLoader(VRMLoaderPlugin);
  return new Promise((resolve, reject) => {
    loader.parse(loadArrayBuffer(filePath), '', resolve, reject);
  });
}

async function parseVrma(filePath) {
  const loader = makeLoader(VRMAnimationLoaderPlugin);
  return new Promise((resolve, reject) => {
    loader.parse(loadArrayBuffer(filePath), '', resolve, reject);
  });
}

function boneAngleDeg(bone, baseline) {
  return THREE.MathUtils.radToDeg(bone.quaternion.angleTo(baseline));
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDir, '..', '..');
  const modelPath = path.join(root, 'assets/vrm/AliciaSolid_vrm-0.51.vrm');
  const candidateNames = [
    'walk.vrma',
    'walk_fixed.vrma',
    'walk_fixed_roll_pos.vrma',
    'walk_fixed_roll_neg.vrma',
    'walk_fixed_pitch_pos.vrma',
    'walk_fixed_pitch_neg.vrma',
    'walk_bad_foot.vrma',
    'cmu_walk_69_01.vrma',
    'cmu_walk_69_02.vrma',
    'walk_m_001.vrma',
    'walk_m_002.vrma',
    'walk_f_001.vrma',
    'walk_fem_m_001.vrma',
    'walk_fem_m_002.vrma',
  ];

  const vrmGltf = await parseVrm(modelPath);
  const vrm = vrmGltf.userData.vrm;
  vrm.scene.updateMatrixWorld(true);

  const baseline = {
    rightLowerLeg: vrm.humanoid.getRawBoneNode('rightLowerLeg').quaternion.clone(),
    rightFoot: vrm.humanoid.getRawBoneNode('rightFoot').quaternion.clone(),
  };

  const results = [];
  for (const candidateName of candidateNames) {
    const animationPath = path.join(root, 'assets/motions_vrma', candidateName);
    if (!fs.existsSync(animationPath)) {
      continue;
    }
    const animationGltf = await parseVrma(animationPath);
    const vrmAnimation = animationGltf.userData.vrmAnimations?.[0] ?? animationGltf.userData.vrmAnimation ?? null;
    if (!vrmAnimation) {
      throw new Error(`VRMA animation not found: ${candidateName}`);
    }
    const clip = createVRMAnimationClip(vrmAnimation, vrm);
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const action = mixer.clipAction(clip);
    action.reset().play();

    const samples = [];
    for (const time of [0, 0.1]) {
      mixer.setTime(time);
      vrm.scene.updateMatrixWorld(true);
      vrm.update(0);
      vrm.scene.updateMatrixWorld(true);
      const rightLowerLeg = vrm.humanoid.getRawBoneNode('rightLowerLeg');
      const rightFoot = vrm.humanoid.getRawBoneNode('rightFoot');
      samples.push({
        time,
        rightLowerLeg: +boneAngleDeg(rightLowerLeg, baseline.rightLowerLeg).toFixed(2),
        rightFoot: +boneAngleDeg(rightFoot, baseline.rightFoot).toFixed(2),
      });
    }

    const score = +samples.reduce((sum, sample) => sum + sample.rightLowerLeg + sample.rightFoot, 0).toFixed(2);
    results.push({ candidateName, samples, score });
    mixer.stopAllAction();
  }

  results.sort((a, b) => a.score - b.score);
  console.log(JSON.stringify({ modelPath, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
