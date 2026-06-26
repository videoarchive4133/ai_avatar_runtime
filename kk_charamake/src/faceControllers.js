import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  共通パラメータデフォルト値
// ═══════════════════════════════════════════════════════════════
export function makeFaceParams(overrides = {}) {
  return {
    scale:     0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FacePartController  — 顔パーツ操作の共通基底クラス
//
//  継承して使うことで EyebrowController / NoseController /
//  MouthController / EarController を同じパターンで実装できる。
//
//  サブクラスで定義すべきもの:
//    get boneNamesL() → string[]   左側ボーン名一覧
//    get boneNamesR() → string[]   右側ボーン名一覧
//    _applySide(side, params)      実際のボーン変形ロジック
// ═══════════════════════════════════════════════════════════════
export class FacePartController {
  constructor(character) {
    this.character = character;
    this._bonesL  = {};
    this._bonesR  = {};
    this._restL   = {};
    this._restR   = {};
    this.centerL  = new THREE.Vector3();
    this.centerR  = new THREE.Vector3();
    this._params  = {};
  }

  // ── サブクラスでオーバーライド ──────────────────────────────
  get boneNamesL() { return []; }
  get boneNamesR() { return []; }

  // ── 汎用パラメータ setter / getter ─────────────────────────
  setValue(name, value) { this._params[name] = value; }
  getValue(name)        { return this._params[name];  }

  // ── 初期化：head パーツが attach されたあとに呼ぶ ──────────
  init() {
    this._bonesL = {}; this._bonesR = {};
    this._restL  = {}; this._restR  = {};

    const headGroup = this.character.parts['head'];
    if (!headGroup) return false;

    const setL = new Set(this.boneNamesL);
    const setR = new Set(this.boneNamesR);

    headGroup.traverse(obj => {
      if (!obj.name) return;
      const rest = {
        pos:   obj.position.clone(),
        rot:   obj.rotation.clone(),
        scale: obj.scale.clone(),
      };
      if (setL.has(obj.name)) { this._bonesL[obj.name] = obj; this._restL[obj.name] = rest; }
      if (setR.has(obj.name)) { this._bonesR[obj.name] = obj; this._restR[obj.name] = rest; }
    });

    this._computeCenter('L');
    this._computeCenter('R');

    return Object.keys(this._bonesL).length > 0;
  }

  _computeCenter(side) {
    const rests  = side === 'L' ? this._restL : this._restR;
    const center = new THREE.Vector3();
    let   count  = 0;
    for (const name in rests) { center.add(rests[name].pos); count++; }
    if (count) center.divideScalar(count);
    if (side === 'L') this.centerL.copy(center);
    else              this.centerR.copy(center);
  }

  // ── 変形適用 ────────────────────────────────────────────────
  apply(params, side = 'both') {
    if (side === 'both' || side === 'left')  this._applySide('L', params);
    if (side === 'both' || side === 'right') this._applySide('R', params);
  }

  _applySide(_side, _params) {}

  // ── 初期状態へ戻す ─────────────────────────────────────────
  reset(side = 'both') {
    const doSide = s => {
      const bones = s === 'L' ? this._bonesL : this._bonesR;
      const rests = s === 'L' ? this._restL  : this._restR;
      for (const name in bones) {
        const bone = bones[name], rest = rests[name];
        if (bone && rest) {
          bone.position.copy(rest.pos);
          bone.rotation.copy(rest.rot);
          bone.scale.copy(rest.scale);
        }
      }
    };
    if (side === 'both' || side === 'left')  doSide('L');
    if (side === 'both' || side === 'right') doSide('R');
  }

  // ── 保存 / 復元 ─────────────────────────────────────────────
  serialize()          { return { ...this._params }; }
  deserialize(_data)   {}
}

// ═══════════════════════════════════════════════════════════════
//  EyeController  — 目の位置・大きさ・回転制御
//
//  ボーン構造 (bo_head_00.glb より):
//    cf_J_Eye_rz_L/R   … 目の親ボーン（回転 Z 軸制御）
//    cf_J_Eye01_s_L/R  … まぶた形状ボーン 1〜8
//    …
//    cf_J_Eye08_s_L/R
//
//  全ボーンは bo_head_00_arm の直下にフラットに並んでいる。
//  親子関係はないため、スケール・回転は「ボーン群の重心」を
//  基準に全ボーンの position を個別に動かして表現する。
// ═══════════════════════════════════════════════════════════════
const EYE_BONE_SUFFIXES = ['_rz', '01_s', '02_s', '03_s', '04_s', '05_s', '06_s', '07_s', '08_s'];

function _eyeParamsDefault() {
  return { scale: 0, posX: 0, posY: 0, posZ: 0, rotation: 0 };
}

export class EyeController extends FacePartController {
  constructor(character) {
    super(character);
    // 目調整の UI 状態（左右同時 / 個別）
    this._state = {
      syncLR: true,
      both:   _eyeParamsDefault(),
      left:   _eyeParamsDefault(),
      right:  _eyeParamsDefault(),
    };
  }

  get boneNamesL() { return EYE_BONE_SUFFIXES.map(s => `cf_J_Eye${s}_L`); }
  get boneNamesR() { return EYE_BONE_SUFFIXES.map(s => `cf_J_Eye${s}_R`); }

  // ── 状態アクセサ ─────────────────────────────────────────────
  // UI コードが直接変異できるよう、ライブ参照を返す
  getState() { return this._state; }

  setValue(name, value) { this._state[name] = value; }
  getValue(name)        { return this._state[name];  }

  // ── 現在の _state を 3D へ適用 ──────────────────────────────
  applyState() {
    if (this._state.syncLR) {
      this.apply(this._state.both, 'both');
    } else {
      this.apply(this._state.left,  'left');
      this.apply(this._state.right, 'right');
    }
  }

  // ── 全パラメータをデフォルトに戻す ─────────────────────────
  resetState() {
    this._state.both  = _eyeParamsDefault();
    this._state.left  = _eyeParamsDefault();
    this._state.right = _eyeParamsDefault();
    this.reset('both');
  }

  // ── 保存 / 復元 ─────────────────────────────────────────────
  serialize() {
    return {
      syncLR: this._state.syncLR,
      both:   { ...this._state.both  },
      left:   { ...this._state.left  },
      right:  { ...this._state.right },
    };
  }

  deserialize(data) {
    if (!data) return;
    this._state.syncLR = data.syncLR ?? true;
    if (data.both)  Object.assign(this._state.both,  data.both);
    if (data.left)  Object.assign(this._state.left,  data.left);
    if (data.right) Object.assign(this._state.right, data.right);
  }

  // ── ボーン変形ロジック（変更不可） ─────────────────────────
  _applySide(side, params) {
    const bones  = side === 'L' ? this._bonesL : this._bonesR;
    const rests  = side === 'L' ? this._restL  : this._restR;
    const center = side === 'L' ? this.centerL : this.centerR;

    // X 軸方向は左右で反転（左右対称になるよう）
    const xSign = side === 'R' ? -1 : 1;

    // scale: 0=等倍, +100=約2.2倍, -100=約0.1倍（最小0.05にクランプ）
    const scaleFactor = Math.max(0.05, 1.0 + (params.scale ?? 0) * 0.012);
    const dx    = (params.posX     ?? 0) * xSign * 0.0004;
    const dy    = (params.posY     ?? 0) * 0.0004;
    const dz    = (params.posZ     ?? 0) * 0.0004;
    const rotRad = (params.rotation ?? 0) * (Math.PI / 180) * xSign;
    const cos   = Math.cos(rotRad), sin = Math.sin(rotRad);

    for (const name in bones) {
      const bone = bones[name], rest = rests[name];
      if (!bone || !rest) continue;

      let px = rest.pos.x, py = rest.pos.y;
      const pz = rest.pos.z;

      // 1. 重心を基準にスケール
      let ox = (px - center.x) * scaleFactor;
      let oy = (py - center.y) * scaleFactor;
      px = center.x + ox;
      py = center.y + oy;

      // 2. 重心を基準に回転（XY平面内）
      const rx = px - center.x, ry = py - center.y;
      px = center.x + rx * cos - ry * sin;
      py = center.y + rx * sin + ry * cos;

      // 3. 位置オフセット
      bone.position.set(px + dx, py + dy, pz + dz);
      bone.rotation.copy(rest.rot);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  FaceEditor  — 全顔パーツコントローラーの統合管理クラス
//
//  使い方:
//    const faceEditor = new FaceEditor(character);
//    faceEditor.reinitForHead();           // head 付け替え後
//    faceEditor.eye.getState().syncLR = false;  // UI から変更
//    faceEditor.eye.applyState();          // 3D へ反映
//    const json = faceEditor.serialize();  // 保存
//    faceEditor.deserialize(json);         // 復元
//
//  将来の追加方法:
//    class EyebrowController extends FacePartController { ... }
//    // FaceEditor コンストラクタに this.eyebrow = new EyebrowController(character) を追加
//    // reinitForHead / serialize / deserialize / reset に eyebrow を追加するだけ
// ═══════════════════════════════════════════════════════════════
export class FaceEditor {
  constructor(character) {
    this.character = character;
    this.eye       = new EyeController(character);
    // ── 将来実装予定 ────────────────────────────────────────────
    // this.eyebrow   = new EyebrowController(character);
    // this.nose      = new NoseController(character);
    // this.mouth     = new MouthController(character);
    // this.faceShape = new FaceShapeController(character);
    // this.ear       = new EarController(character);
  }

  // head が付け替えられたあとに呼ぶ（ボーン参照を更新）
  reinitForHead() {
    this.eye.init();
    // 将来: this.eyebrow.init(); this.nose.init(); ...
  }

  // 全パーツの調整値を 3D へ一括適用
  applyAll() {
    this.eye.applyState();
    // 将来: this.eyebrow.applyState(); ...
  }

  // 指定パーツ（省略時は全パーツ）をリセット
  reset(partName) {
    if (!partName || partName === 'eye') this.eye.resetState();
    // 将来: if (!partName || partName === 'eyebrow') this.eyebrow.resetState();
  }

  // JSON 保存用シリアライズ
  // → { eye: {...}, eyebrow: {...}, ... }
  serialize() {
    return {
      eye: this.eye.serialize(),
      // 将来: eyebrow: this.eyebrow.serialize(), ...
    };
  }

  // JSON 読込復元
  deserialize(data) {
    if (!data) return;
    if (data.eye) this.eye.deserialize(data.eye);
    // 将来: if (data.eyebrow) this.eyebrow.deserialize(data.eyebrow);
  }
}
