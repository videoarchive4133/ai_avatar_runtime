import * as THREE from 'three';

// ─── ボーン候補名（先に見つかったものを使用）─────────────────────
const BONE_CANDIDATES = {
  head:          ['cf_J_Head',         'Head',          'head'],
  neck:          ['cf_J_Neck',         'Neck',          'neck'],
  chest:         ['cf_J_Spine02',      'cf_J_Spine03',  'Spine2',       'Chest'],
  hips:          ['cf_J_Hips',         'cf_J_Kosi01',   'Hips',         'cf_J_Spine01', 'Spine'],
  leftShoulder:  ['cf_J_Shoulder_L',   'LeftShoulder',  'L_shoulder'],
  leftUpperArm:  ['cf_J_ArmUp00_L',    'LeftArm',       'LeftUpperArm', 'L_arm'],
  leftLowerArm:  ['cf_J_ArmLow01_L',   'LeftForeArm',   'LeftLowerArm', 'L_forearm'],
  leftHand:      ['cf_J_Hand_L',       'LeftHand',      'L_hand'],
  rightShoulder: ['cf_J_Shoulder_R',   'RightShoulder', 'R_shoulder'],
  rightUpperArm: ['cf_J_ArmUp00_R',    'RightArm',      'RightUpperArm','R_arm'],
  rightLowerArm: ['cf_J_ArmLow01_R',   'RightForeArm',  'RightLowerArm','R_forearm'],
  rightHand:     ['cf_J_Hand_R',       'RightHand',     'R_hand'],
  leftUpperLeg:  ['cf_J_LegUp01_L',    'LeftUpLeg',     'LeftUpperLeg', 'L_thigh'],
  leftLowerLeg:  ['cf_J_LegLow01_L',   'LeftLeg',       'LeftLowerLeg', 'L_shin'],
  leftFoot:      ['cf_J_Foot01_L',     'LeftFoot',      'L_foot'],
  leftToes:      ['cf_J_Toes01_L',     'LeftToeBase',   'L_toe'],
  rightUpperLeg: ['cf_J_LegUp01_R',    'RightUpLeg',    'RightUpperLeg','R_thigh'],
  rightLowerLeg: ['cf_J_LegLow01_R',   'RightLeg',      'RightLowerLeg','R_shin'],
  rightFoot:     ['cf_J_Foot01_R',     'RightFoot',     'R_foot'],
  rightToes:     ['cf_J_Toes01_R',     'RightToeBase',  'R_toe'],
};

// 右側ボーンのsyncLR鏡像元（右 → 左のキーマップ）
const MIRROR_SRC = {
  rightShoulder: 'leftShoulder',
  rightUpperArm: 'leftUpperArm',
  rightLowerArm: 'leftLowerArm',
  rightHand:     'leftHand',
  rightUpperLeg: 'leftUpperLeg',
  rightLowerLeg: 'leftLowerLeg',
  rightFoot:     'leftFoot',
  rightToes:     'leftToes',
};

function defaultRot() { return { x: 0, y: 0, z: 0 }; }

function defaultBones() {
  const r = {};
  for (const key of Object.keys(BONE_CANDIDATES)) r[key] = defaultRot();
  return r;
}

// ─── ポーズプリセット ────────────────────────────────────────────
// 回転値はすべてレストポーズからのデルタ（度数）
export const POSE_PRESETS = [
  {
    id: 'tpose', label: 'Tポーズ',
    bones: {
      leftUpperArm:  { x: 0, y: 0, z: 20 },
      rightUpperArm: { x: 0, y: 0, z: -20 },
    },
  },
  {
    id: 'apose', label: 'Aポーズ',
    bones: {
      leftUpperArm:  { x: 0, y: 0, z: -20 },
      rightUpperArm: { x: 0, y: 0, z:  20 },
    },
  },
  {
    id: 'attention', label: '気を付け',
    bones: {
      leftUpperArm:  { x:  0, y:  10, z: -75 },
      leftLowerArm:  { x:  0, y:   0, z: -10 },
      rightUpperArm: { x:  0, y: -10, z:  75 },
      rightLowerArm: { x:  0, y:   0, z:  10 },
    },
  },
  {
    id: 'guts', label: 'ガッツポーズ',
    bones: {
      leftUpperArm:  { x: -130, y:   0, z: -20 },
      leftLowerArm:  { x: -100, y:   0, z:   0 },
      leftHand:      { x:    0, y: -20, z:   0 },
      rightUpperArm: { x:   20, y:   0, z:  55 },
      rightLowerArm: { x:   15, y:   0, z:   0 },
    },
  },
  {
    id: 'wave', label: '手を振る',
    bones: {
      rightUpperArm: { x: -80, y:  0, z:  15 },
      rightLowerArm: { x: -25, y:  0, z:   0 },
      rightHand:     { x:   0, y: 30, z:  10 },
      leftUpperArm:  { x:   0, y:  0, z: -55 },
      leftLowerArm:  { x:  10, y:  0, z:   0 },
    },
  },
  {
    id: 'peace', label: 'ピース',
    bones: {
      rightUpperArm: { x: -55, y:   0, z:  15 },
      rightLowerArm: { x: -45, y:   0, z:   0 },
      rightHand:     { x:   0, y: -20, z:   0 },
      leftUpperArm:  { x:   0, y:   0, z: -50 },
    },
  },
  {
    id: 'cross', label: '腕組み',
    bones: {
      leftUpperArm:  { x: -15, y:  35, z: -65 },
      leftLowerArm:  { x: -75, y:   0, z:   0 },
      leftHand:      { x:   0, y:  20, z:   0 },
      rightUpperArm: { x: -15, y: -35, z:  65 },
      rightLowerArm: { x: -75, y:   0, z:   0 },
      rightHand:     { x:   0, y: -20, z:   0 },
    },
  },
  {
    id: 'sit', label: '座る',
    bones: {
      hips:          { x:  -90, y: 0, z:  0 },
      leftUpperLeg:  { x:  -90, y: 0, z: -5 },
      leftLowerLeg:  { x:   90, y: 0, z:  0 },
      leftFoot:      { x:  -15, y: 0, z:  0 },
      rightUpperLeg: { x:  -90, y: 0, z:  5 },
      rightLowerLeg: { x:   90, y: 0, z:  0 },
      rightFoot:     { x:  -15, y: 0, z:  0 },
      leftUpperArm:  { x:    0, y: 0, z: -30 },
      rightUpperArm: { x:    0, y: 0, z:  30 },
    },
  },
  {
    id: 'jump', label: 'ジャンプ',
    bones: {
      chest:         { x:  -10, y:  0, z:  0 },
      leftUpperArm:  { x:  -25, y:  0, z: -25 },
      leftLowerArm:  { x:  -20, y:  0, z:   0 },
      rightUpperArm: { x:  -25, y:  0, z:  25 },
      rightLowerArm: { x:  -20, y:  0, z:   0 },
      leftUpperLeg:  { x:  -30, y: -8, z:  -5 },
      leftLowerLeg:  { x:   40, y:  0, z:   0 },
      leftFoot:      { x:  -20, y:  0, z:   0 },
      rightUpperLeg: { x:  -30, y:  8, z:   5 },
      rightLowerLeg: { x:   40, y:  0, z:   0 },
      rightFoot:     { x:  -20, y:  0, z:   0 },
    },
  },
  {
    id: 'bow', label: 'お辞儀',
    bones: {
      hips:          { x:   30, y: 0, z: 0 },
      chest:         { x:   30, y: 0, z: 0 },
      head:          { x:  -15, y: 0, z: 0 },
      leftUpperArm:  { x:    0, y: 0, z: -65 },
      leftLowerArm:  { x:  -10, y: 0, z:   0 },
      rightUpperArm: { x:    0, y: 0, z:  65 },
      rightLowerArm: { x:  -10, y: 0, z:   0 },
    },
  },
];

// ─── UI 用ボーングループ定義 ────────────────────────────────────
export const POSE_BONE_GROUPS = [
  { group: 'ボディ', isBody: true, bones: [
    { key: 'head',  label: '頭' },
    { key: 'neck',  label: '首' },
    { key: 'chest', label: '胸' },
    { key: 'hips',  label: '腰' },
  ]},
  { group: '左腕', isLeft: true, bones: [
    { key: 'leftShoulder', label: '肩' },
    { key: 'leftUpperArm', label: '上腕' },
    { key: 'leftLowerArm', label: '肘' },
    { key: 'leftHand',     label: '手首' },
  ]},
  { group: '右腕', isRight: true, bones: [
    { key: 'rightShoulder', label: '肩' },
    { key: 'rightUpperArm', label: '上腕' },
    { key: 'rightLowerArm', label: '肘' },
    { key: 'rightHand',     label: '手首' },
  ]},
  { group: '左脚', isLeft: true, bones: [
    { key: 'leftUpperLeg', label: '太もも' },
    { key: 'leftLowerLeg', label: '膝' },
    { key: 'leftFoot',     label: '足首' },
    { key: 'leftToes',     label: 'つま先' },
  ]},
  { group: '右脚', isRight: true, bones: [
    { key: 'rightUpperLeg', label: '太もも' },
    { key: 'rightLowerLeg', label: '膝' },
    { key: 'rightFoot',     label: '足首' },
    { key: 'rightToes',     label: 'つま先' },
  ]},
];

// ─── PoseController ──────────────────────────────────────────────
export class PoseController {
  constructor(character) {
    this.character = character;
    this._bones    = {};   // key → THREE.Object3D
    this._restRot  = {};   // key → { x, y, z } ラジアン（レストポーズ）
    this._state    = {
      preset: '',
      syncLR: true,
      bones:  defaultBones(),
    };
  }

  init() {
    if (!this.character) return false;
    const boneMap = this.character.baseBoneMap ?? {};
    this._bones   = {};
    this._restRot = {};

    for (const [key, candidates] of Object.entries(BONE_CANDIDATES)) {
      for (const name of candidates) {
        if (boneMap[name]) {
          this._bones[key]   = boneMap[name];
          this._restRot[key] = {
            x: boneMap[name].rotation.x,
            y: boneMap[name].rotation.y,
            z: boneMap[name].rotation.z,
          };
          break;
        }
      }
    }
    return Object.keys(this._bones).length > 0;
  }

  setRotation(boneKey, axis, degrees) {
    if (!this._state.bones[boneKey]) this._state.bones[boneKey] = defaultRot();
    this._state.bones[boneKey][axis] = degrees;
    this._state.preset = '';
  }

  getRotation(boneKey) {
    return this._state.bones[boneKey] ?? defaultRot();
  }

  setPreset(id) {
    const preset = POSE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    this._state.preset = id;
    this._state.bones  = defaultBones();
    for (const [key, rot] of Object.entries(preset.bones)) {
      this._state.bones[key] = { ...defaultRot(), ...rot };
    }
  }

  getPreset()    { return this._state.preset; }
  getState()     { return this._state; }
  isSyncLR()     { return this._state.syncLR; }
  setSyncLR(v)   { this._state.syncLR = v; }

  applyState() {
    const DEG    = Math.PI / 180;
    const syncLR = this._state.syncLR;

    for (const [key, bone] of Object.entries(this._bones)) {
      const rest = this._restRot[key];
      if (!rest) continue;

      let rot = this._state.bones[key] ?? defaultRot();

      // syncLR: 右側は左側の鏡像を使う
      if (syncLR && MIRROR_SRC[key]) {
        const srcKey = MIRROR_SRC[key];
        const src    = this._state.bones[srcKey] ?? defaultRot();
        rot = { x: src.x, y: -src.y, z: -src.z };
      }

      bone.rotation.set(
        rest.x + rot.x * DEG,
        rest.y + rot.y * DEG,
        rest.z + rot.z * DEG,
        bone.rotation.order,
      );
    }
  }

  resetState() {
    this._state.preset = '';
    this._state.bones  = defaultBones();
    this.applyState();
  }

  serialize() {
    return {
      preset: this._state.preset,
      syncLR: this._state.syncLR,
      bones:  JSON.parse(JSON.stringify(this._state.bones)),
    };
  }

  deserialize(data) {
    if (!data) return;
    this._state.preset = data.preset ?? '';
    this._state.syncLR = data.syncLR ?? true;
    if (data.bones) {
      for (const [key, rot] of Object.entries(data.bones)) {
        if (this._state.bones[key]) Object.assign(this._state.bones[key], rot);
        else this._state.bones[key] = { ...defaultRot(), ...rot };
      }
    }
  }
}
