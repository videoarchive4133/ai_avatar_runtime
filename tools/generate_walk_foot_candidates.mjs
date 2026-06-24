#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import * as THREE from '../viewer_three_vrm/node_modules/three/build/three.module.js';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const COMPONENTS_BY_TYPE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
};
const TARGET_BONES = [
  ['LeftLowerLeg', 'leftLowerLeg', ['LeftLeg']],
  ['LeftFoot', 'leftFoot', ['LeftFoot']],
  ['LeftToes', 'leftToes', ['LeftToeBase']],
  ['RightLowerLeg', 'rightLowerLeg', ['RightLeg']],
  ['RightFoot', 'rightFoot', ['RightFoot']],
  ['RightToes', 'rightToes', ['RightToeBase']],
];
const PAIRS = [
  ['LowerLeg', 'LeftLowerLeg', 'RightLowerLeg'],
  ['Foot', 'LeftFoot', 'RightFoot'],
  ['Toes', 'LeftToes', 'RightToes'],
];
const CANDIDATE_DEGREES = 10;
const DIFFERENCE_THRESHOLD_DEG = 30;
const QUATERNION_DIGITS = 5;
const EULER_DIGITS = 2;

function parseArgs(argv) {
  const options = {
    input: path.resolve('assets/motions_vrma/walk.vrma'),
    outputDir: path.resolve('assets/motions_vrma'),
    diagnostics: path.resolve('docs/WALK_FOOT_DIAGNOSTICS.md'),
    writeCandidates: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      options.input = path.resolve(argv[++index]);
    } else if (arg === '--output-dir') {
      options.outputDir = path.resolve(argv[++index]);
    } else if (arg === '--diagnostics') {
      options.diagnostics = path.resolve(argv[++index]);
    } else if (arg === '--no-candidates') {
      options.writeCandidates = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error(`Not a GLB/VRMA file: ${filePath}`);
  }

  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    chunks.push({ type, dataStart, dataEnd, length });
    offset = dataEnd;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === GLB_JSON_CHUNK);
  const binChunk = chunks.find((chunk) => chunk.type === GLB_BIN_CHUNK);
  if (!jsonChunk || !binChunk) {
    throw new Error(`VRMA must contain JSON and BIN chunks: ${filePath}`);
  }

  const jsonText = buffer
    .toString('utf8', jsonChunk.dataStart, jsonChunk.dataEnd)
    .replace(/\0+$/u, '')
    .trim();

  return {
    filePath,
    buffer,
    json: JSON.parse(jsonText),
    chunks,
    binChunk,
  };
}

function assertFloatAccessor(json, accessorIndex, expectedType) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) {
    throw new Error(`Accessor not found: ${accessorIndex}`);
  }
  if (accessor.sparse) {
    throw new Error(`Sparse accessors are not supported: ${accessorIndex}`);
  }
  if (accessor.componentType !== FLOAT) {
    throw new Error(`Only FLOAT accessors are supported: ${accessorIndex}`);
  }
  if (expectedType && accessor.type !== expectedType) {
    throw new Error(`Accessor ${accessorIndex} expected ${expectedType}, got ${accessor.type}`);
  }
  return accessor;
}

function accessorByteOffset(glb, accessorIndex, elementIndex = 0) {
  const accessor = glb.json.accessors[accessorIndex];
  const bufferView = glb.json.bufferViews?.[accessor.bufferView];
  if (!bufferView) {
    throw new Error(`bufferView not found for accessor: ${accessorIndex}`);
  }

  const components = COMPONENTS_BY_TYPE[accessor.type];
  const componentSize = 4;
  const packedStride = components * componentSize;
  const stride = bufferView.byteStride ?? packedStride;
  return glb.binChunk.dataStart
    + (bufferView.byteOffset ?? 0)
    + (accessor.byteOffset ?? 0)
    + elementIndex * stride;
}

function readScalarAccessor(glb, accessorIndex) {
  const accessor = assertFloatAccessor(glb.json, accessorIndex, 'SCALAR');
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    values.push(glb.buffer.readFloatLE(accessorByteOffset(glb, accessorIndex, index)));
  }
  return values;
}

function readQuaternionAccessor(glb, accessorIndex) {
  const accessor = assertFloatAccessor(glb.json, accessorIndex, 'VEC4');
  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const byteOffset = accessorByteOffset(glb, accessorIndex, index);
    values.push(new THREE.Quaternion(
      glb.buffer.readFloatLE(byteOffset),
      glb.buffer.readFloatLE(byteOffset + 4),
      glb.buffer.readFloatLE(byteOffset + 8),
      glb.buffer.readFloatLE(byteOffset + 12),
    ).normalize());
  }
  return values;
}

function writeQuaternionAccessor(glb, outputBuffer, accessorIndex, quaternions) {
  const accessor = assertFloatAccessor(glb.json, accessorIndex, 'VEC4');
  if (quaternions.length !== accessor.count) {
    throw new Error(`Quaternion count mismatch for accessor ${accessorIndex}`);
  }

  for (let index = 0; index < accessor.count; index += 1) {
    const quaternion = quaternions[index].clone().normalize();
    const byteOffset = accessorByteOffset(glb, accessorIndex, index);
    outputBuffer.writeFloatLE(quaternion.x, byteOffset);
    outputBuffer.writeFloatLE(quaternion.y, byteOffset + 4);
    outputBuffer.writeFloatLE(quaternion.z, byteOffset + 8);
    outputBuffer.writeFloatLE(quaternion.w, byteOffset + 12);
  }
}

function resolveNodeIndex(json, label) {
  const target = TARGET_BONES.find(([boneLabel]) => boneLabel === label);
  if (!target) {
    throw new Error(`Unknown target bone: ${label}`);
  }

  const [, humanBoneName, fallbackNames] = target;
  const humanBones = json.extensions?.VRMC_vrm_animation?.humanoid?.humanBones ?? {};
  const nodeFromHumanoid = humanBones[humanBoneName]?.node;
  if (Number.isInteger(nodeFromHumanoid)) {
    return nodeFromHumanoid;
  }

  for (const nodeName of fallbackNames) {
    const nodeIndex = json.nodes?.findIndex((node) => node.name === nodeName);
    if (nodeIndex >= 0) {
      return nodeIndex;
    }
  }

  return -1;
}

function getRotationTrack(glb, label) {
  const nodeIndex = resolveNodeIndex(glb.json, label);
  if (nodeIndex < 0) {
    return null;
  }

  const animation = glb.json.animations?.[0];
  const channel = animation?.channels?.find((candidate) => (
    candidate.target?.node === nodeIndex && candidate.target?.path === 'rotation'
  ));
  if (!animation || !channel) {
    return null;
  }

  const sampler = animation.samplers?.[channel.sampler];
  if (!sampler) {
    return null;
  }

  return {
    label,
    nodeIndex,
    nodeName: glb.json.nodes?.[nodeIndex]?.name ?? `node:${nodeIndex}`,
    samplerIndex: channel.sampler,
    inputAccessor: sampler.input,
    outputAccessor: sampler.output,
    times: readScalarAccessor(glb, sampler.input),
    quaternions: readQuaternionAccessor(glb, sampler.output),
  };
}

function getTracks(glb) {
  const tracks = new Map();
  for (const [label] of TARGET_BONES) {
    tracks.set(label, getRotationTrack(glb, label));
  }
  return tracks;
}

function angleDeg(left, right) {
  return THREE.MathUtils.radToDeg(left.angleTo(right));
}

function formatNumber(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatVector(values, digits) {
  return values.map((value) => formatNumber(value, digits)).join(', ');
}

function quaternionToArray(quaternion) {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function quaternionToEulerDeg(quaternion) {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    THREE.MathUtils.radToDeg(euler.x),
    THREE.MathUtils.radToDeg(euler.y),
    THREE.MathUtils.radToDeg(euler.z),
  ];
}

function pairStats(leftTrack, rightTrack) {
  if (!leftTrack || !rightTrack) {
    return null;
  }

  const frameCount = Math.min(leftTrack.quaternions.length, rightTrack.quaternions.length);
  let maxFrame = 0;
  let maxDifference = -Infinity;
  let totalDifference = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const difference = angleDeg(leftTrack.quaternions[frame], rightTrack.quaternions[frame]);
    totalDifference += difference;
    if (difference > maxDifference) {
      maxDifference = difference;
      maxFrame = frame;
    }
  }

  return {
    frameCount,
    averageDifference: totalDifference / frameCount,
    maxDifference,
    maxFrame,
    maxTime: rightTrack.times[maxFrame] ?? leftTrack.times[maxFrame] ?? 0,
  };
}

function buildFootDiagnosticsRows(leftTrack, rightTrack) {
  const frameCount = Math.min(leftTrack.quaternions.length, rightTrack.quaternions.length);
  const rows = [];

  for (let frame = 0; frame < frameCount; frame += 1) {
    const left = leftTrack.quaternions[frame];
    const right = rightTrack.quaternions[frame];
    const difference = angleDeg(left, right);
    if (difference < DIFFERENCE_THRESHOLD_DEG) {
      continue;
    }

    rows.push({
      frame,
      time: rightTrack.times[frame] ?? leftTrack.times[frame] ?? 0,
      leftQuaternion: quaternionToArray(left),
      leftEuler: quaternionToEulerDeg(left),
      rightQuaternion: quaternionToArray(right),
      rightEuler: quaternionToEulerDeg(right),
      difference,
    });
  }

  return rows;
}

function buildDiagnosticsMarkdown({ inputPath, glb, tracks }) {
  const lines = [
    '# Walk Foot Diagnostics',
    '',
    `Input: \`${path.relative(process.cwd(), inputPath)}\``,
    '',
    '## Target Tracks',
    '',
    '| Humanoid bone | glTF node | sampler | input accessor | output accessor | frames |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  ];

  for (const [label] of TARGET_BONES) {
    const track = tracks.get(label);
    if (!track) {
      lines.push(`| ${label} | missing | n/a | n/a | n/a | n/a |`);
      continue;
    }
    lines.push(
      `| ${label} | ${track.nodeName} (#${track.nodeIndex}) | ${track.samplerIndex} | `
      + `${track.inputAccessor} | ${track.outputAccessor} | ${track.quaternions.length} |`,
    );
  }

  lines.push(
    '',
    '## Left/Right Pair Summary',
    '',
    '| Pair | frames | average angle difference deg | max angle difference deg | max frame | max time sec |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  );

  for (const [pairName, leftLabel, rightLabel] of PAIRS) {
    const stats = pairStats(tracks.get(leftLabel), tracks.get(rightLabel));
    if (!stats) {
      lines.push(`| ${pairName} | n/a | n/a | n/a | n/a | n/a |`);
      continue;
    }
    lines.push(
      `| ${pairName} | ${stats.frameCount} | ${formatNumber(stats.averageDifference, 2)} | `
      + `${formatNumber(stats.maxDifference, 2)} | ${stats.maxFrame} | ${formatNumber(stats.maxTime, 4)} |`,
    );
  }

  const leftFoot = tracks.get('LeftFoot');
  const rightFoot = tracks.get('RightFoot');
  const rows = leftFoot && rightFoot ? buildFootDiagnosticsRows(leftFoot, rightFoot) : [];
  lines.push(
    '',
    `## RightFoot Outliers`,
    '',
    `Frames below are LeftFoot/RightFoot rotation pairs with angle difference >= ${DIFFERENCE_THRESHOLD_DEG} degrees.`,
    '',
    '| frame | time sec | leftFoot quaternion xyzw | leftFoot euler XYZ deg | rightFoot quaternion xyzw | rightFoot euler XYZ deg | left/right angle difference deg |',
    '| ---: | ---: | --- | --- | --- | --- | ---: |',
  );

  if (rows.length === 0) {
    lines.push('| n/a | n/a | n/a | n/a | n/a | n/a | n/a |');
  } else {
    for (const row of rows) {
      lines.push(
        `| ${row.frame} | ${formatNumber(row.time, 4)} | `
        + `${formatVector(row.leftQuaternion, QUATERNION_DIGITS)} | `
        + `${formatVector(row.leftEuler, EULER_DIGITS)} | `
        + `${formatVector(row.rightQuaternion, QUATERNION_DIGITS)} | `
        + `${formatVector(row.rightEuler, EULER_DIGITS)} | `
        + `${formatNumber(row.difference, 2)} |`,
      );
    }
  }

  lines.push(
    '',
    '## Candidate Generation',
    '',
    'The generated candidates bake a local correction into only the `RightFoot` rotation track. ',
    '`RightLowerLeg`, `RightToes`, and all left-side tracks are left unchanged.',
    '',
    '| Candidate | RightFoot correction |',
    '| --- | --- |',
    `| \`walk_fixed_roll_pos.vrma\` | post-multiply XYZ roll +${CANDIDATE_DEGREES} deg |`,
    `| \`walk_fixed_roll_neg.vrma\` | post-multiply XYZ roll -${CANDIDATE_DEGREES} deg |`,
    `| \`walk_fixed_pitch_pos.vrma\` | post-multiply XYZ pitch +${CANDIDATE_DEGREES} deg |`,
    `| \`walk_fixed_pitch_neg.vrma\` | post-multiply XYZ pitch -${CANDIDATE_DEGREES} deg |`,
    '',
    `Animation: \`${glb.json.animations?.[0]?.name ?? 'unnamed'}\``,
    '',
  );

  return `${lines.join('\n')}\n`;
}

function correctionFor(axis, degrees) {
  const radians = THREE.MathUtils.degToRad(degrees);
  const euler = axis === 'roll'
    ? new THREE.Euler(0, 0, radians, 'XYZ')
    : new THREE.Euler(radians, 0, 0, 'XYZ');
  return new THREE.Quaternion().setFromEuler(euler);
}

function writeCandidate({ glb, rightFootTrack, outputPath, correction }) {
  const outputBuffer = Buffer.from(glb.buffer);
  const corrected = rightFootTrack.quaternions.map((quaternion) => (
    quaternion.clone().multiply(correction).normalize()
  ));
  writeQuaternionAccessor(glb, outputBuffer, rightFootTrack.outputAccessor, corrected);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outputBuffer);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const glb = readGlb(options.input);
  const tracks = getTracks(glb);
  const diagnostics = buildDiagnosticsMarkdown({ inputPath: options.input, glb, tracks });

  fs.mkdirSync(path.dirname(options.diagnostics), { recursive: true });
  fs.writeFileSync(options.diagnostics, diagnostics);

  const written = [];
  if (options.writeCandidates) {
    const rightFootTrack = tracks.get('RightFoot');
    if (!rightFootTrack) {
      throw new Error('RightFoot rotation track was not found');
    }

    const variants = [
      ['walk_fixed_roll_pos.vrma', 'roll', CANDIDATE_DEGREES],
      ['walk_fixed_roll_neg.vrma', 'roll', -CANDIDATE_DEGREES],
      ['walk_fixed_pitch_pos.vrma', 'pitch', CANDIDATE_DEGREES],
      ['walk_fixed_pitch_neg.vrma', 'pitch', -CANDIDATE_DEGREES],
    ];

    for (const [fileName, axis, degrees] of variants) {
      const outputPath = path.join(options.outputDir, fileName);
      writeCandidate({
        glb,
        rightFootTrack,
        outputPath,
        correction: correctionFor(axis, degrees),
      });
      written.push(outputPath);
    }
  }

  console.log(JSON.stringify({
    diagnostics: options.diagnostics,
    candidates: written,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
