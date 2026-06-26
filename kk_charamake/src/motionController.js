// MotionController – keyframe-based animation for kk_charamake
// Manages pose + expression keyframes, playback, interpolation, and presets.

// ─── イージング ───────────────────────────────────────────────
export const EASING_TYPES = [
  { id: 'linear',      label: 'Linear' },
  { id: 'ease-in',     label: 'Ease In' },
  { id: 'ease-out',    label: 'Ease Out' },
  { id: 'ease-in-out', label: 'Ease In Out' },
];

function applyEasing(t, type) {
  switch (type) {
    case 'ease-in':     return t * t;
    case 'ease-out':    return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:            return t;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpBones(a, b, t) {
  const result = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const ra = (a ?? {})[k] ?? { x: 0, y: 0, z: 0 };
    const rb = (b ?? {})[k] ?? { x: 0, y: 0, z: 0 };
    result[k] = { x: lerp(ra.x, rb.x, t), y: lerp(ra.y, rb.y, t), z: lerp(ra.z, rb.z, t) };
  }
  return result;
}

function lerpValues(a, b, t) {
  const result = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const va = (a ?? {})[k] ?? 0;
    const vb = (b ?? {})[k] ?? 0;
    result[k] = lerp(va, vb, t);
  }
  return result;
}

let _kfSeq = 0;
function mkId() { return `kf_${String(++_kfSeq).padStart(3, '0')}`; }
function cloneJson(v) { return JSON.parse(JSON.stringify(v)); }

function defaultPoseSnap() { return { preset: '', syncLR: false, bones: {} }; }
function defaultExprSnap() { return { preset: '', values: {} }; }

// ─── モーションプリセット ─────────────────────────────────────
export const MOTION_PRESETS = [
  {
    id: 'idle', label: '待機', loop: true, duration: 3.0,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, chest:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.75, easing: 'ease-in-out', pose: { bones: { head:{x:3,y:2,z:0}, chest:{x:2,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 1.5,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, chest:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 2.25, easing: 'ease-in-out', pose: { bones: { head:{x:2,y:-2,z:0}, chest:{x:1,y:0,z:1} } }, expression: { values: {} }, memo: '' },
      { time: 3.0,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, chest:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'wave', label: '手を振る', loop: false, duration: 2.0,
    keyframes: [
      { time: 0.0,  easing: 'ease-in',     pose: { bones: { rightUpperArm:{x:-30,y:0,z:20}, rightLowerArm:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '開始' },
      { time: 0.35, easing: 'ease-in-out', pose: { bones: { rightUpperArm:{x:-75,y:0,z:15}, rightLowerArm:{x:-15,y:0,z:0}, rightHand:{x:0,y:25,z:0} } }, expression: { values: {} }, memo: 'ハイ' },
      { time: 0.7,  easing: 'ease-in-out', pose: { bones: { rightUpperArm:{x:-75,y:0,z:15}, rightLowerArm:{x:-15,y:0,z:0}, rightHand:{x:0,y:-25,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 1.05, easing: 'ease-in-out', pose: { bones: { rightUpperArm:{x:-75,y:0,z:15}, rightLowerArm:{x:-15,y:0,z:0}, rightHand:{x:0,y:25,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 1.4,  easing: 'ease-in-out', pose: { bones: { rightUpperArm:{x:-75,y:0,z:15}, rightLowerArm:{x:-15,y:0,z:0}, rightHand:{x:0,y:-25,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 2.0,  easing: 'ease-out',    pose: { bones: { rightUpperArm:{x:0,y:0,z:-50}, rightLowerArm:{x:0,y:0,z:0}, rightHand:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '戻る' },
    ],
  },
  {
    id: 'nod', label: 'うなずく', loop: false, duration: 1.5,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.3,  easing: 'ease-in-out', pose: { bones: { head:{x:22,y:0,z:0}, neck:{x:6,y:0,z:0} } }, expression: { values: {} }, memo: 'うなずき1' },
      { time: 0.6,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.9,  easing: 'ease-in-out', pose: { bones: { head:{x:22,y:0,z:0}, neck:{x:6,y:0,z:0} } }, expression: { values: {} }, memo: 'うなずき2' },
      { time: 1.2,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 1.5,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'headshake', label: '首を振る', loop: false, duration: 1.5,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.3,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:-32,z:0}, neck:{x:0,y:-10,z:0} } }, expression: { values: {} }, memo: '← 左' },
      { time: 0.6,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:32,z:0},  neck:{x:0,y:10,z:0}  } }, expression: { values: {} }, memo: '右 →' },
      { time: 0.9,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:-32,z:0}, neck:{x:0,y:-10,z:0} } }, expression: { values: {} }, memo: '← 左' },
      { time: 1.2,  easing: 'ease-in-out', pose: { bones: { head:{x:0,y:32,z:0},  neck:{x:0,y:10,z:0}  } }, expression: { values: {} }, memo: '右 →' },
      { time: 1.5,  easing: 'ease-out',    pose: { bones: { head:{x:0,y:0,z:0}, neck:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'jump', label: 'ジャンプ', loop: false, duration: 1.5,
    keyframes: [
      { time: 0.0,  easing: 'ease-in', pose: { bones: {
        hips:{x:-12,y:0,z:0}, chest:{x:-5,y:0,z:0},
        leftUpperLeg:{x:-15,y:0,z:-5}, leftLowerLeg:{x:18,y:0,z:0},
        rightUpperLeg:{x:-15,y:0,z:5}, rightLowerLeg:{x:18,y:0,z:0},
        leftUpperArm:{x:15,y:0,z:-30}, rightUpperArm:{x:15,y:0,z:30},
      } }, expression: { values: {} }, memo: 'タメ' },
      { time: 0.4,  easing: 'ease-out', pose: { bones: {
        hips:{x:0,y:0,z:0}, chest:{x:-10,y:0,z:0},
        leftUpperLeg:{x:-22,y:-8,z:-5}, leftLowerLeg:{x:32,y:0,z:0}, leftFoot:{x:-15,y:0,z:0},
        rightUpperLeg:{x:-22,y:8,z:5},  rightLowerLeg:{x:32,y:0,z:0}, rightFoot:{x:-15,y:0,z:0},
        leftUpperArm:{x:-35,y:0,z:-25}, rightUpperArm:{x:-35,y:0,z:25},
      } }, expression: { values: {} }, memo: '空中' },
      { time: 0.85, easing: 'ease-in', pose: { bones: {
        hips:{x:0,y:0,z:0}, chest:{x:-10,y:0,z:0},
        leftUpperLeg:{x:-22,y:-8,z:-5}, leftLowerLeg:{x:32,y:0,z:0}, leftFoot:{x:-15,y:0,z:0},
        rightUpperLeg:{x:-22,y:8,z:5},  rightLowerLeg:{x:32,y:0,z:0}, rightFoot:{x:-15,y:0,z:0},
        leftUpperArm:{x:-35,y:0,z:-25}, rightUpperArm:{x:-35,y:0,z:25},
      } }, expression: { values: {} }, memo: '落下' },
      { time: 1.1,  easing: 'ease-out', pose: { bones: {
        hips:{x:-20,y:0,z:0}, chest:{x:5,y:0,z:0},
        leftUpperLeg:{x:-20,y:0,z:-5}, leftLowerLeg:{x:35,y:0,z:0},
        rightUpperLeg:{x:-20,y:0,z:5},  rightLowerLeg:{x:35,y:0,z:0},
        leftUpperArm:{x:0,y:0,z:-40},  rightUpperArm:{x:0,y:0,z:40},
      } }, expression: { values: {} }, memo: '着地' },
      { time: 1.5,  easing: 'ease-in-out', pose: { bones: { hips:{x:0,y:0,z:0} } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'walk', label: '歩く', loop: true, duration: 1.0,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: {
        hips:{x:0,y:0,z:0},
        leftUpperLeg:{x:-25,y:0,z:0}, leftLowerLeg:{x:10,y:0,z:0}, leftFoot:{x:-5,y:0,z:0},
        rightUpperLeg:{x:20,y:0,z:0}, rightLowerLeg:{x:0,y:0,z:0},  rightFoot:{x:5,y:0,z:0},
        leftUpperArm:{x:15,y:0,z:-50},  leftLowerArm:{x:10,y:0,z:0},
        rightUpperArm:{x:-10,y:0,z:50}, rightLowerArm:{x:5,y:0,z:0},
      } }, expression: { values: {} }, memo: '左踏み出し' },
      { time: 0.25, easing: 'ease-in-out', pose: { bones: {
        hips:{x:0,y:5,z:0},
        leftUpperLeg:{x:0,y:0,z:0}, leftLowerLeg:{x:0,y:0,z:0}, rightLowerLeg:{x:5,y:0,z:0},
        leftUpperArm:{x:0,y:0,z:-50}, rightUpperArm:{x:0,y:0,z:50},
      } }, expression: { values: {} }, memo: '中間' },
      { time: 0.5,  easing: 'ease-in-out', pose: { bones: {
        hips:{x:0,y:0,z:0},
        leftUpperLeg:{x:20,y:0,z:0},  leftLowerLeg:{x:0,y:0,z:0},  leftFoot:{x:5,y:0,z:0},
        rightUpperLeg:{x:-25,y:0,z:0}, rightLowerLeg:{x:10,y:0,z:0}, rightFoot:{x:-5,y:0,z:0},
        leftUpperArm:{x:-10,y:0,z:-50}, leftLowerArm:{x:5,y:0,z:0},
        rightUpperArm:{x:15,y:0,z:50},  rightLowerArm:{x:10,y:0,z:0},
      } }, expression: { values: {} }, memo: '右踏み出し' },
      { time: 0.75, easing: 'ease-in-out', pose: { bones: {
        hips:{x:0,y:5,z:0},
        rightUpperLeg:{x:0,y:0,z:0}, leftLowerLeg:{x:5,y:0,z:0},
        leftUpperArm:{x:0,y:0,z:-50}, rightUpperArm:{x:0,y:0,z:50},
      } }, expression: { values: {} }, memo: '中間' },
      { time: 1.0,  easing: 'ease-in-out', pose: { bones: {
        hips:{x:0,y:0,z:0},
        leftUpperLeg:{x:-25,y:0,z:0}, leftLowerLeg:{x:10,y:0,z:0}, leftFoot:{x:-5,y:0,z:0},
        rightUpperLeg:{x:20,y:0,z:0}, rightLowerLeg:{x:0,y:0,z:0},  rightFoot:{x:5,y:0,z:0},
        leftUpperArm:{x:15,y:0,z:-50},  leftLowerArm:{x:10,y:0,z:0},
        rightUpperArm:{x:-10,y:0,z:50}, rightLowerArm:{x:5,y:0,z:0},
      } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'run', label: '走る', loop: true, duration: 0.6,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:-5,y:0,z:0}, hips:{x:-5,y:0,z:0},
        leftUpperLeg:{x:-45,y:0,z:0}, leftLowerLeg:{x:22,y:0,z:0}, leftFoot:{x:-10,y:0,z:0},
        rightUpperLeg:{x:32,y:0,z:0}, rightLowerLeg:{x:5,y:0,z:0},  rightFoot:{x:5,y:0,z:0},
        leftUpperArm:{x:32,y:0,z:-55},  leftLowerArm:{x:-40,y:0,z:0},
        rightUpperArm:{x:-28,y:0,z:55}, rightLowerArm:{x:-30,y:0,z:0},
      } }, expression: { values: {} }, memo: '左踏み出し' },
      { time: 0.15, easing: 'ease-in-out', pose: { bones: { chest:{x:-8,y:0,z:0}, hips:{x:-8,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.3,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:-5,y:0,z:0}, hips:{x:-5,y:0,z:0},
        leftUpperLeg:{x:32,y:0,z:0},  leftLowerLeg:{x:5,y:0,z:0},  leftFoot:{x:5,y:0,z:0},
        rightUpperLeg:{x:-45,y:0,z:0}, rightLowerLeg:{x:22,y:0,z:0}, rightFoot:{x:-10,y:0,z:0},
        leftUpperArm:{x:-28,y:0,z:-55}, leftLowerArm:{x:-30,y:0,z:0},
        rightUpperArm:{x:32,y:0,z:55},  rightLowerArm:{x:-40,y:0,z:0},
      } }, expression: { values: {} }, memo: '右踏み出し' },
      { time: 0.45, easing: 'ease-in-out', pose: { bones: { chest:{x:-8,y:0,z:0}, hips:{x:-8,y:0,z:0} } }, expression: { values: {} }, memo: '' },
      { time: 0.6,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:-5,y:0,z:0}, hips:{x:-5,y:0,z:0},
        leftUpperLeg:{x:-45,y:0,z:0}, leftLowerLeg:{x:22,y:0,z:0}, leftFoot:{x:-10,y:0,z:0},
        rightUpperLeg:{x:32,y:0,z:0}, rightLowerLeg:{x:5,y:0,z:0},  rightFoot:{x:5,y:0,z:0},
        leftUpperArm:{x:32,y:0,z:-55},  leftLowerArm:{x:-40,y:0,z:0},
        rightUpperArm:{x:-28,y:0,z:55}, rightLowerArm:{x:-30,y:0,z:0},
      } }, expression: { values: {} }, memo: '' },
    ],
  },
  {
    id: 'bow', label: 'お辞儀', loop: false, duration: 2.5,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: {} }, expression: { values: {} }, memo: '開始' },
      { time: 0.7,  easing: 'ease-in',     pose: { bones: {
        hips:{x:35,y:0,z:0}, chest:{x:35,y:0,z:0}, head:{x:-15,y:0,z:0},
        leftUpperArm:{x:0,y:0,z:-65}, leftLowerArm:{x:-10,y:0,z:0},
        rightUpperArm:{x:0,y:0,z:65}, rightLowerArm:{x:-10,y:0,z:0},
      } }, expression: { values: {} }, memo: 'お辞儀' },
      { time: 1.6,  easing: 'ease-in-out', pose: { bones: {
        hips:{x:35,y:0,z:0}, chest:{x:35,y:0,z:0}, head:{x:-15,y:0,z:0},
        leftUpperArm:{x:0,y:0,z:-65}, leftLowerArm:{x:-10,y:0,z:0},
        rightUpperArm:{x:0,y:0,z:65}, rightLowerArm:{x:-10,y:0,z:0},
      } }, expression: { values: {} }, memo: '保持' },
      { time: 2.5,  easing: 'ease-out',    pose: { bones: {} }, expression: { values: {} }, memo: '戻る' },
    ],
  },
  {
    id: 'peace', label: 'ピース', loop: false, duration: 1.5,
    keyframes: [
      { time: 0.0,  easing: 'ease-in',     pose: { bones: {} }, expression: { values: {} }, memo: '開始' },
      { time: 0.6,  easing: 'ease-out',    pose: { bones: {
        rightUpperArm:{x:-55,y:0,z:15}, rightLowerArm:{x:-45,y:0,z:0}, rightHand:{x:0,y:-20,z:0},
        leftUpperArm:{x:0,y:0,z:-50},
      } }, expression: { values: {} }, memo: 'ピース' },
      { time: 1.5,  easing: 'ease-in-out', pose: { bones: {
        rightUpperArm:{x:-55,y:0,z:15}, rightLowerArm:{x:-45,y:0,z:0}, rightHand:{x:0,y:-20,z:0},
        leftUpperArm:{x:0,y:0,z:-50},
      } }, expression: { values: {} }, memo: '保持' },
    ],
  },
  {
    id: 'dance', label: 'ダンス短め', loop: true, duration: 2.0,
    keyframes: [
      { time: 0.0,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:5,y:10,z:0}, hips:{x:-5,y:-10,z:0},
        leftUpperArm:{x:-20,y:0,z:-40}, rightUpperArm:{x:-20,y:0,z:40},
        leftUpperLeg:{x:5,y:0,z:0}, rightUpperLeg:{x:-5,y:0,z:0},
      } }, expression: { values: {} }, memo: '1' },
      { time: 0.25, easing: 'ease-in-out', pose: { bones: {
        chest:{x:-5,y:-10,z:5}, hips:{x:5,y:10,z:-5},
        leftUpperArm:{x:-30,y:0,z:-35}, rightUpperArm:{x:-10,y:0,z:45},
        leftUpperLeg:{x:-5,y:0,z:0}, rightUpperLeg:{x:5,y:0,z:0},
      } }, expression: { values: {} }, memo: '2' },
      { time: 0.5,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:5,y:-10,z:0}, hips:{x:-5,y:10,z:0},
        leftUpperArm:{x:-10,y:0,z:-45}, rightUpperArm:{x:-30,y:0,z:35},
        leftUpperLeg:{x:5,y:0,z:5}, rightUpperLeg:{x:-5,y:0,z:-5},
      } }, expression: { values: {} }, memo: '3' },
      { time: 0.75, easing: 'ease-in-out', pose: { bones: {
        chest:{x:0,y:10,z:-5}, hips:{x:0,y:-10,z:5},
        leftUpperArm:{x:-20,y:0,z:-35}, rightUpperArm:{x:-20,y:0,z:35},
        leftUpperLeg:{x:0,y:0,z:-5}, rightUpperLeg:{x:0,y:0,z:5},
      } }, expression: { values: {} }, memo: '4' },
      { time: 1.0,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:5,y:10,z:0}, hips:{x:-5,y:-10,z:0},
        leftUpperArm:{x:-20,y:0,z:-40}, rightUpperArm:{x:-20,y:0,z:40},
        leftUpperLeg:{x:5,y:0,z:0}, rightUpperLeg:{x:-5,y:0,z:0},
      } }, expression: { values: {} }, memo: '5' },
      { time: 1.25, easing: 'ease-in-out', pose: { bones: {
        chest:{x:-5,y:-10,z:5}, hips:{x:5,y:10,z:-5},
        leftUpperArm:{x:-30,y:0,z:-35}, rightUpperArm:{x:-10,y:0,z:45},
      } }, expression: { values: {} }, memo: '6' },
      { time: 1.5,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:0,y:0,z:0}, hips:{x:0,y:0,z:0},
        leftUpperArm:{x:-40,y:0,z:-20}, rightUpperArm:{x:-40,y:0,z:20},
        leftLowerArm:{x:-20,y:0,z:0},   rightLowerArm:{x:-20,y:0,z:0},
      } }, expression: { values: {} }, memo: '7' },
      { time: 1.75, easing: 'ease-in-out', pose: { bones: {
        chest:{x:0,y:15,z:0}, hips:{x:0,y:-15,z:0},
        leftUpperArm:{x:-50,y:0,z:-15}, rightUpperArm:{x:-50,y:0,z:15},
        leftLowerArm:{x:-30,y:0,z:0},   rightLowerArm:{x:-30,y:0,z:0},
      } }, expression: { values: {} }, memo: '8' },
      { time: 2.0,  easing: 'ease-in-out', pose: { bones: {
        chest:{x:5,y:10,z:0}, hips:{x:-5,y:-10,z:0},
        leftUpperArm:{x:-20,y:0,z:-40}, rightUpperArm:{x:-20,y:0,z:40},
        leftUpperLeg:{x:5,y:0,z:0}, rightUpperLeg:{x:-5,y:0,z:0},
      } }, expression: { values: {} }, memo: '' },
    ],
  },
];

// ─── MotionController ─────────────────────────────────────────
export class MotionController {
  constructor(poseCtrl = null, exprCtrl = null) {
    this.poseCtrl  = poseCtrl;
    this.exprCtrl  = exprCtrl;

    this._keyframes = [];
    this._loop      = true;
    this._speed     = 1.0;
    this._duration  = 3.0;
    this._preset    = '';

    this._playing   = false;
    this._time      = 0;

    // State saved before playback begins, restored on stop
    this._savedPose     = null;
    this._savedPoseSyncLR = true;
    this._savedExpr     = null;

    // UI update callback: (currentTime: number) => void
    this.onTimeUpdate = null;
  }

  // ── Keyframe CRUD ─────────────────────────────────────────────

  addKeyframe(time, poseSnap, exprSnap, opts = {}) {
    const kf = {
      id:         mkId(),
      time:       Math.max(0, Math.min(+time || 0, this._duration)),
      easing:     opts.easing ?? 'ease-in-out',
      pose:       cloneJson(poseSnap ?? defaultPoseSnap()),
      expression: cloneJson(exprSnap ?? defaultExprSnap()),
      camera:     opts.camera ?? null,
      memo:       opts.memo   ?? '',
    };
    this._keyframes.push(kf);
    this._sortKf();
    this._preset = '';
    return kf.id;
  }

  captureKeyframe(time, opts = {}) {
    const poseSnap = this.poseCtrl ? this.poseCtrl.serialize()   : defaultPoseSnap();
    const exprSnap = this.exprCtrl ? this.exprCtrl.serialize()   : defaultExprSnap();
    return this.addKeyframe(time, poseSnap, exprSnap, opts);
  }

  removeKeyframe(id) {
    this._keyframes = this._keyframes.filter(k => k.id !== id);
    this._preset = '';
  }

  moveKeyframe(id, newTime) {
    const kf = this._keyframes.find(k => k.id === id);
    if (kf) { kf.time = Math.max(0, Math.min(+newTime || 0, this._duration)); this._sortKf(); }
    this._preset = '';
  }

  updateKeyframe(id, changes) {
    const kf = this._keyframes.find(k => k.id === id);
    if (!kf) return;
    if (changes.time       !== undefined) kf.time       = Math.max(0, Math.min(+changes.time || 0, this._duration));
    if (changes.easing     !== undefined) kf.easing     = changes.easing;
    if (changes.memo       !== undefined) kf.memo       = changes.memo;
    if (changes.pose       !== undefined) kf.pose       = changes.pose;
    if (changes.expression !== undefined) kf.expression = changes.expression;
    if (changes.camera     !== undefined) kf.camera     = changes.camera;
    this._sortKf();
    this._preset = '';
  }

  captureToKeyframe(id) {
    const kf = this._keyframes.find(k => k.id === id);
    if (!kf) return;
    if (this.poseCtrl) kf.pose = this.poseCtrl.serialize();
    if (this.exprCtrl) kf.expression = this.exprCtrl.serialize();
    this._preset = '';
  }

  getKeyframes()    { return [...this._keyframes]; }
  getKeyframe(id)   { return this._keyframes.find(k => k.id === id) ?? null; }
  clearKeyframes()  { this._keyframes = []; this._preset = ''; }

  _sortKf() { this._keyframes.sort((a, b) => a.time - b.time); }

  // ── Preset ────────────────────────────────────────────────────

  applyPreset(id) {
    const p = MOTION_PRESETS.find(p => p.id === id);
    if (!p) return;
    this.stop();
    this._preset   = id;
    this._loop     = p.loop     ?? true;
    this._duration = p.duration ?? 3.0;
    this._keyframes = p.keyframes.map(kf => ({
      id:         mkId(),
      time:       kf.time,
      easing:     kf.easing     ?? 'ease-in-out',
      pose:       cloneJson(kf.pose       ?? defaultPoseSnap()),
      expression: cloneJson(kf.expression ?? defaultExprSnap()),
      camera:     kf.camera ?? null,
      memo:       kf.memo   ?? '',
    }));
  }

  getPreset() { return this._preset; }

  // ── Settings ─────────────────────────────────────────────────

  setLoop(v)     { this._loop     = !!v; }
  setSpeed(v)    { this._speed    = Math.max(0.1, Math.min(5.0, +v || 1)); }
  setDuration(v) {
    this._duration = Math.max(0.1, +v || 3);
    this._keyframes.forEach(kf => { kf.time = Math.min(kf.time, this._duration); });
  }
  getLoop()     { return this._loop; }
  getSpeed()    { return this._speed; }
  getDuration() { return this._duration; }
  isPlaying()   { return this._playing; }
  getCurrentTime() { return this._time; }

  // ── Playback ─────────────────────────────────────────────────

  play() {
    if (this._playing || this._keyframes.length < 2) return;
    if (this.poseCtrl) {
      this._savedPose      = cloneJson(this.poseCtrl.getState());
      this._savedPoseSyncLR = this.poseCtrl.isSyncLR();
    }
    if (this.exprCtrl) {
      this._savedExpr = cloneJson(this.exprCtrl.serialize());
    }
    this._playing = true;
  }

  pause() {
    if (this._keyframes.length < 2) return;
    this._playing = !this._playing;
    if (this._playing && this._time >= this._duration) this._time = 0;
  }

  stop() {
    const wasPlaying = this._playing || this._time > 0;
    this._playing = false;
    this._time    = 0;
    if (this.poseCtrl && this._savedPose) {
      this.poseCtrl.deserialize(this._savedPose);
      this.poseCtrl.setSyncLR(this._savedPoseSyncLR);
      this.poseCtrl.applyState();
    }
    if (this.exprCtrl && this._savedExpr) {
      try { this.exprCtrl.deserialize(this._savedExpr); this.exprCtrl.applyState(); } catch (_) {}
    }
    if (wasPlaying && this.onTimeUpdate) this.onTimeUpdate(0);
  }

  seek(time) {
    this._time = Math.max(0, Math.min(+time || 0, this._duration));
    if (this._keyframes.length >= 2) this._applyAtTime(this._time);
    if (this.onTimeUpdate) this.onTimeUpdate(this._time);
  }

  // ── Update – called every frame from render loop ─────────────

  update(dt) {
    if (!this._playing) return;
    if (this._keyframes.length < 2) { this._playing = false; return; }

    this._time += dt * this._speed;

    if (this._time >= this._duration) {
      if (this._loop) {
        this._time = this._time % this._duration;
      } else {
        this._time = this._duration;
        this._applyAtTime(this._time);
        this._playing = false;
        if (this.onTimeUpdate) this.onTimeUpdate(this._time);
        return;
      }
    }

    this._applyAtTime(this._time);
    if (this.onTimeUpdate) this.onTimeUpdate(this._time);
  }

  // ── Interpolation ────────────────────────────────────────────

  _applyAtTime(t) {
    const kfs = this._keyframes;
    if (kfs.length === 0) return;

    let kfA, kfB, alpha;
    if (t <= kfs[0].time) {
      kfA = kfB = kfs[0]; alpha = 0;
    } else if (t >= kfs[kfs.length - 1].time) {
      kfA = kfB = kfs[kfs.length - 1]; alpha = 0;
    } else {
      let i = 0;
      for (; i < kfs.length - 1; i++) {
        if (kfs[i].time <= t && t < kfs[i + 1].time) break;
      }
      kfA = kfs[i]; kfB = kfs[i + 1];
      const span = kfB.time - kfA.time;
      alpha = span > 0 ? (t - kfA.time) / span : 0;
      alpha = applyEasing(alpha, kfA.easing);
    }

    // Pose
    if (this.poseCtrl) {
      const bonesA = kfA.pose?.bones ?? {};
      const bonesB = kfB.pose?.bones ?? {};
      const bones  = lerpBones(bonesA, bonesB, alpha);
      const prevSyncLR = this.poseCtrl.isSyncLR();
      const prevBones  = this.poseCtrl._state.bones;
      this.poseCtrl.setSyncLR(false);
      this.poseCtrl._state.bones = bones;
      this.poseCtrl.applyState();
      this.poseCtrl._state.bones = prevBones;
      this.poseCtrl.setSyncLR(prevSyncLR);
    }

    // Expression
    if (this.exprCtrl) {
      try {
        const valsA = kfA.expression?.values ?? {};
        const valsB = kfB.expression?.values ?? {};
        const vals  = lerpValues(valsA, valsB, alpha);
        this.exprCtrl.deserialize({ preset: '', values: vals });
        this.exprCtrl.applyState();
      } catch (_) {}
    }
  }

  // ── Serialize / Deserialize ──────────────────────────────────

  serialize() {
    return {
      loop:      this._loop,
      speed:     this._speed,
      duration:  this._duration,
      preset:    this._preset,
      keyframes: this._keyframes.map(kf => cloneJson(kf)),
    };
  }

  deserialize(data) {
    if (!data) return;
    this._loop     = data.loop     ?? true;
    this._speed    = data.speed    ?? 1.0;
    this._duration = data.duration ?? 3.0;
    this._preset   = data.preset   ?? '';
    this._keyframes = (data.keyframes ?? []).map(kf => ({
      id:         kf.id     ?? mkId(),
      time:       kf.time   ?? 0,
      easing:     kf.easing ?? 'ease-in-out',
      pose:       cloneJson(kf.pose       ?? defaultPoseSnap()),
      expression: cloneJson(kf.expression ?? defaultExprSnap()),
      camera:     kf.camera ?? null,
      memo:       kf.memo   ?? '',
    }));
    this._sortKf();
  }
}
