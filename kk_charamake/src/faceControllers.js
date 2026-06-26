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
//  EyebrowController  — 眉の位置・大きさ・角度・太さ制御
//
//  ボーン構造 (bo_head_00.glb より):
//    cf_J_Mayuge_L/R      … 眉の主制御ボーン
//    cf_J_MayuMid_s_L/R  … 眉中央形状ボーン
//    cf_J_MayuTip_s_L/R  … 眉先端形状ボーン
//
//  EyeController と同じ「重心基準の位置操作」方式。
//  thickness は Y 方向のスケールを個別に適用して眉の太さを表現する。
// ═══════════════════════════════════════════════════════════════
const EYEBROW_BONE_NAMES_L = ['cf_J_Mayuge_L', 'cf_J_MayuMid_s_L', 'cf_J_MayuTip_s_L'];
const EYEBROW_BONE_NAMES_R = ['cf_J_Mayuge_R', 'cf_J_MayuMid_s_R', 'cf_J_MayuTip_s_R'];

function _eyebrowParamsDefault() {
  return { scale: 0, posX: 0, posY: 0, posZ: 0, rotation: 0, thickness: 0 };
}

export class EyebrowController extends FacePartController {
  constructor(character) {
    super(character);
    this._state = {
      syncLR: true,
      both:   _eyebrowParamsDefault(),
      left:   _eyebrowParamsDefault(),
      right:  _eyebrowParamsDefault(),
    };
  }

  get boneNamesL() { return EYEBROW_BONE_NAMES_L; }
  get boneNamesR() { return EYEBROW_BONE_NAMES_R; }

  getState() { return this._state; }
  setValue(name, value) { this._state[name] = value; }
  getValue(name)        { return this._state[name];  }

  applyState() {
    if (this._state.syncLR) {
      this.apply(this._state.both, 'both');
    } else {
      this.apply(this._state.left,  'left');
      this.apply(this._state.right, 'right');
    }
  }

  resetState() {
    this._state.both  = _eyebrowParamsDefault();
    this._state.left  = _eyebrowParamsDefault();
    this._state.right = _eyebrowParamsDefault();
    this.reset('both');
  }

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

  _applySide(side, params) {
    const bones  = side === 'L' ? this._bonesL : this._bonesR;
    const rests  = side === 'L' ? this._restL  : this._restR;
    const center = side === 'L' ? this.centerL : this.centerR;

    // X 軸方向は左右で反転（左右対称になるよう）
    const xSign = side === 'R' ? -1 : 1;

    // scale: 全体の大きさ, thickness: Y 方向の太さ
    const scaleFactor     = Math.max(0.05, 1.0 + (params.scale     ?? 0) * 0.012);
    const thickFactor     = Math.max(0.05, 1.0 + (params.thickness ?? 0) * 0.015);
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

      // 1. 重心を基準に X スケール（大きさ）・Y スケール（太さ）
      let ox = (px - center.x) * scaleFactor;
      let oy = (py - center.y) * thickFactor;
      px = center.x + ox;
      py = center.y + oy;

      // 2. 重心を基準に回転（XY 平面内）
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
//  NoseController  — 鼻の位置・大きさ・幅・角度制御
//
//  ボーン構造:
//    head グループ内の名前に "nose" を含むボーンをすべて収集。
//    見つからない場合は baseBoneMap（ボディ側）にフォールバック。
//    左右対称部位のため syncLR は持たず、単一の params で制御する。
//
//  適用ロジック:
//    全体 → 重心基準でスケール（大きさ・幅）・回転
//    tip  骨名に "t"  を含む → tipScale を追加適用
//    base 骨名に "b"  を含む → bridgeHeight を Y オフセット追加
// ═══════════════════════════════════════════════════════════════
function _noseParamsDefault() {
  return { scale: 0, posY: 0, width: 0, posZ: 0, bridgeHeight: 0, tipScale: 0, rotation: 0 };
}

export class NoseController extends FacePartController {
  constructor(character) {
    super(character);
    this._nBones  = {};
    this._nRests  = {};
    this._nCenter = new THREE.Vector3();
    this._state   = { params: _noseParamsDefault() };
  }

  // ── ボーン収集：head グループ優先 → baseBoneMap フォールバック ──
  init() {
    this._nBones  = {};
    this._nRests  = {};

    const collect = obj => {
      if (!obj.name || !/nose/i.test(obj.name)) return;
      if (this._nBones[obj.name]) return;
      this._nBones[obj.name] = obj;
      this._nRests[obj.name] = {
        pos:   obj.position.clone(),
        rot:   obj.rotation.clone(),
        scale: obj.scale.clone(),
      };
    };

    const headGroup = this.character.parts['head'];
    if (headGroup) headGroup.traverse(collect);

    if (Object.keys(this._nBones).length === 0) {
      const boneMap = this.character.baseBoneMap ?? {};
      for (const name in boneMap) collect(boneMap[name]);
    }

    // 重心を計算
    const center = new THREE.Vector3();
    let count = 0;
    for (const name in this._nRests) { center.add(this._nRests[name].pos); count++; }
    if (count) center.divideScalar(count);
    this._nCenter.copy(center);

    return Object.keys(this._nBones).length > 0;
  }

  getState() { return this._state; }

  applyState() { this._applyNose(this._state.params); }

  resetState() {
    this._state.params = _noseParamsDefault();
    for (const name in this._nBones) {
      const bone = this._nBones[name], rest = this._nRests[name];
      if (bone && rest) {
        bone.position.copy(rest.pos);
        bone.rotation.copy(rest.rot);
        bone.scale.copy(rest.scale);
      }
    }
  }

  serialize()       { return { ...this._state.params }; }
  deserialize(data) { if (data) Object.assign(this._state.params, data); }

  _applyNose(params) {
    if (Object.keys(this._nBones).length === 0) return;

    const scaleFactor = Math.max(0.05, 1.0 + (params.scale       ?? 0) * 0.012);
    const widthFactor = Math.max(0.05, 1.0 + (params.width       ?? 0) * 0.012);
    const tipFactor   = Math.max(0.05, 1.0 + (params.tipScale    ?? 0) * 0.015);
    const dy          = (params.posY         ?? 0) * 0.0004;
    const dz          = (params.posZ         ?? 0) * 0.0004;
    const bridgeDy    = (params.bridgeHeight  ?? 0) * 0.0006;
    const rotRad      = (params.rotation      ?? 0) * (Math.PI / 180);
    const cos = Math.cos(rotRad), sin = Math.sin(rotRad);
    const cx = this._nCenter.x, cy = this._nCenter.y;

    for (const name in this._nBones) {
      const bone = this._nBones[name], rest = this._nRests[name];
      if (!bone || !rest) continue;

      const isTip  = /[_.]?t(?:ip)?$/i.test(name);
      const isBase = /bas/i.test(name);

      // 1. 重心基準でスケール（X=幅、Y=高さ方向は均一）
      let px = cx + (rest.pos.x - cx) * scaleFactor * widthFactor;
      let py = cy + (rest.pos.y - cy) * scaleFactor;
      const pz = rest.pos.z;

      // 2. 重心基準で X 軸回転（鼻の角度 = 前後傾き）
      const ry = py - cy, rz_from_center = pz - this._nCenter.z;
      py = cy + ry * cos - rz_from_center * sin;
      // ※ Z は centroid から離れる量が小さいため簡易近似

      // 3. 位置オフセット
      const extraDy = isBase ? bridgeDy : 0;
      bone.position.set(px, py + dy + extraDy, pz + dz);
      bone.rotation.copy(rest.rot);

      // 4. 鼻先だけ追加スケール
      if (isTip) {
        bone.scale.set(
          rest.scale.x * tipFactor,
          rest.scale.y * tipFactor,
          rest.scale.z * tipFactor,
        );
      } else {
        bone.scale.copy(rest.scale);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  FaceShapeController  — 顔の輪郭・頬・顎・額の形状制御
//
//  ボーン収集:
//    head グループ内のボーンを名前パターンで 5 グループに分類。
//    chin / cheek / jaw / forehead / 汎用 face-shape。
//    左右対称（L/R）ボーンは両方まとめて収集し一括適用する。
//
//  パラメータ → 適用グループの対応:
//    faceWidth     → cheek + jaw + face  (X スケール)
//    faceHeight    → chin + face         (Y スケール)
//    chinLength    → chin               (Y オフセット)
//    chinSharp     → chin tip           (X スケール反転)
//    cheekRound    → cheek              (X/Z スケール)
//    cheekBone     → cheek (upper)      (Y/Z オフセット)
//    jawAngle      → jaw               (X オフセット)
//    foreheadWidth → forehead + face    (X スケール)
// ═══════════════════════════════════════════════════════════════
const FACE_SHAPE_GROUP_PATTERNS = {
  chin:     /chin/i,
  cheek:    /cheek/i,
  jaw:      /jaw/i,
  forehead: /forehead|brow(?!_)|front/i,
  face:     /(?:cf[_s]+face|cf[_s]+head)[_s]/i,
};

function _faceShapeParamsDefault() {
  return {
    faceWidth:     0,
    faceHeight:    0,
    chinLength:    0,
    chinSharp:     0,
    cheekRound:    0,
    cheekBone:     0,
    jawAngle:      0,
    foreheadWidth: 0,
  };
}

export class FaceShapeController extends FacePartController {
  constructor(character) {
    super(character);
    // グループ別ボーン + レスト
    this._groups = { chin: {}, cheek: {}, jaw: {}, forehead: {}, face: {} };
    this._rests  = {};
    this._center = new THREE.Vector3();
    this._state  = { params: _faceShapeParamsDefault() };
  }

  // ── 初期化：head グループからボーンを分類収集 ──────────────
  init() {
    this._groups  = { chin: {}, cheek: {}, jaw: {}, forehead: {}, face: {} };
    this._rests   = {};

    const headGroup = this.character.parts['head'];
    if (!headGroup) return false;

    headGroup.traverse(obj => {
      if (!obj.name) return;
      const name = obj.name;
      // どのグループにも属するか判定（最初にマッチしたグループに登録）
      for (const [grp, pat] of Object.entries(FACE_SHAPE_GROUP_PATTERNS)) {
        if (pat.test(name) && !this._groups[grp][name]) {
          this._groups[grp][name] = obj;
          if (!this._rests[name]) {
            this._rests[name] = {
              pos:   obj.position.clone(),
              rot:   obj.rotation.clone(),
              scale: obj.scale.clone(),
            };
          }
          break;
        }
      }
    });

    // 全収集ボーンの重心
    const center = new THREE.Vector3();
    let count = 0;
    for (const name in this._rests) { center.add(this._rests[name].pos); count++; }
    if (count) center.divideScalar(count);
    this._center.copy(center);

    return count > 0;
  }

  getState()  { return this._state; }

  applyState()  { this._applyFaceShape(this._state.params); }

  resetState() {
    this._state.params = _faceShapeParamsDefault();
    for (const name in this._rests) {
      const grp = this._findGroupBone(name);
      if (grp && this._rests[name]) {
        grp.position.copy(this._rests[name].pos);
        grp.rotation.copy(this._rests[name].rot);
        grp.scale.copy(this._rests[name].scale);
      }
    }
  }

  _findGroupBone(name) {
    for (const g of Object.values(this._groups)) {
      if (g[name]) return g[name];
    }
    return null;
  }

  serialize()       { return { ...this._state.params }; }
  deserialize(data) { if (data) Object.assign(this._state.params, data); }

  // ── ボーン変形適用 ───────────────────────────────────────
  _applyFaceShape(params) {
    const cx = this._center.x, cy = this._center.y;

    // 係数計算
    const wF  = Math.max(0.05, 1.0 + (params.faceWidth     ?? 0) * 0.010); // X
    const hF  = Math.max(0.05, 1.0 + (params.faceHeight    ?? 0) * 0.010); // Y
    const crF = Math.max(0.05, 1.0 + (params.cheekRound    ?? 0) * 0.012); // X/Z
    const fwF = Math.max(0.05, 1.0 + (params.foreheadWidth ?? 0) * 0.010); // X
    const chinDy   = (params.chinLength ?? 0) * 0.0005;
    const chinShX  = Math.max(0.05, 1.0 - (params.chinSharp ?? 0) * 0.008); // 小さいほど尖る
    const cheekBDy = (params.cheekBone ?? 0) * 0.0004;
    const jawDx    = (params.jawAngle  ?? 0) * 0.0003;

    // ── chin グループ ──────────────────────────────────────
    for (const name in this._groups.chin) {
      const bone = this._groups.chin[name], rest = this._rests[name];
      if (!bone || !rest) continue;
      const isTip = /tip|t$/i.test(name);
      const sx = isTip ? chinShX : 1.0;
      bone.scale.set(rest.scale.x * sx, rest.scale.y * hF, rest.scale.z);
      bone.position.set(rest.pos.x, rest.pos.y + chinDy, rest.pos.z);
      bone.rotation.copy(rest.rot);
    }

    // ── cheek グループ ─────────────────────────────────────
    for (const name in this._groups.cheek) {
      const bone = this._groups.cheek[name], rest = this._rests[name];
      if (!bone || !rest) continue;
      // L/R 対称：L 側は +X, R 側は -X から中心に向かう
      const xSign = /[_.]L$/i.test(name) ? 1 : (/[_.]R$/i.test(name) ? -1 : 1);
      const ox = (rest.pos.x - cx) * crF;
      const isUpper = /up|hi/i.test(name);
      bone.position.set(cx + ox, rest.pos.y + (isUpper ? cheekBDy : 0), rest.pos.z);
      bone.scale.set(rest.scale.x * wF, rest.scale.y, rest.scale.z * crF);
      bone.rotation.copy(rest.rot);
    }

    // ── jaw グループ ──────────────────────────────────────
    for (const name in this._groups.jaw) {
      const bone = this._groups.jaw[name], rest = this._rests[name];
      if (!bone || !rest) continue;
      const xSign = /[_.]L$/i.test(name) ? 1 : (/[_.]R$/i.test(name) ? -1 : 1);
      bone.position.set(rest.pos.x + xSign * jawDx, rest.pos.y, rest.pos.z);
      bone.scale.set(rest.scale.x * wF, rest.scale.y, rest.scale.z);
      bone.rotation.copy(rest.rot);
    }

    // ── forehead グループ ─────────────────────────────────
    for (const name in this._groups.forehead) {
      const bone = this._groups.forehead[name], rest = this._rests[name];
      if (!bone || !rest) continue;
      const ox = (rest.pos.x - cx) * fwF;
      bone.position.set(cx + ox, rest.pos.y, rest.pos.z);
      bone.scale.set(rest.scale.x * fwF, rest.scale.y, rest.scale.z);
      bone.rotation.copy(rest.rot);
    }

    // ── face 汎用グループ ─────────────────────────────────
    for (const name in this._groups.face) {
      const bone = this._groups.face[name], rest = this._rests[name];
      if (!bone || !rest) continue;
      const ox = (rest.pos.x - cx) * wF * fwF;
      const oy = (rest.pos.y - cy) * hF;
      bone.position.set(cx + ox, cy + oy, rest.pos.z);
      bone.scale.copy(rest.scale);
      bone.rotation.copy(rest.rot);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  EarController  — 耳の位置・大きさ・角度・開き制御
//
//  ボーン収集:
//    head グループ内の名前に "ear" を含むボーンをすべて収集。
//    骨名の末尾が "_R" なら右耳、それ以外は左耳に分類する。
//    見つからない場合は baseBoneMap にフォールバック。
//
//  パラメータ:
//    scale  : 耳の大きさ      (重心基準 XYZ スケール)
//    posY   : 耳の高さ        (Y オフセット)
//    posZ   : 耳の前後位置    (Z オフセット)
//    posX   : 耳の左右位置    (X オフセット、左右で符号反転)
//    rotX   : 耳の角度（前後）(X 軸回転をレスト回転に加算)
//    rotY   : 耳の角度（左右）(Y 軸回転、左右で符号反転)
//    spread : 耳の開き        (X 方向に外側へ押し出す)
// ═══════════════════════════════════════════════════════════════
function _earParamsDefault() {
  return { scale: 0, posY: 0, posZ: 0, posX: 0, rotX: 0, rotY: 0, spread: 0 };
}

export class EarController extends FacePartController {
  constructor(character) {
    super(character);
    this._state = {
      syncLR: true,
      both:   _earParamsDefault(),
      left:   _earParamsDefault(),
      right:  _earParamsDefault(),
    };
  }

  // ── ボーン収集：head グループ優先 → baseBoneMap フォールバック ──
  init() {
    this._bonesL = {}; this._bonesR = {};
    this._restL  = {}; this._restR  = {};

    const collect = obj => {
      if (!obj.name || !/ear/i.test(obj.name)) return;
      const isR   = /[_.]R$/i.test(obj.name);
      const bones = isR ? this._bonesR : this._bonesL;
      const rests = isR ? this._restR  : this._restL;
      if (bones[obj.name]) return;
      bones[obj.name] = obj;
      rests[obj.name] = {
        pos:   obj.position.clone(),
        rot:   obj.rotation.clone(),
        scale: obj.scale.clone(),
      };
    };

    const headGroup = this.character.parts['head'];
    if (headGroup) headGroup.traverse(collect);

    if (Object.keys(this._bonesL).length === 0 && Object.keys(this._bonesR).length === 0) {
      const boneMap = this.character.baseBoneMap ?? {};
      for (const name in boneMap) collect(boneMap[name]);
    }

    this._computeCenter('L');
    this._computeCenter('R');

    return Object.keys(this._bonesL).length > 0 || Object.keys(this._bonesR).length > 0;
  }

  getState() { return this._state; }
  setValue(name, value) { this._state[name] = value; }
  getValue(name)        { return this._state[name];  }

  applyState() {
    if (this._state.syncLR) {
      this._applySide('L', this._state.both);
      this._applySide('R', this._state.both);
    } else {
      this._applySide('L', this._state.left);
      this._applySide('R', this._state.right);
    }
  }

  resetState() {
    this._state.both  = _earParamsDefault();
    this._state.left  = _earParamsDefault();
    this._state.right = _earParamsDefault();
    this.reset('both');
  }

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

  _applySide(side, params) {
    const bones  = side === 'L' ? this._bonesL : this._bonesR;
    const rests  = side === 'L' ? this._restL  : this._restR;
    const center = side === 'L' ? this.centerL : this.centerR;

    const xSign = side === 'R' ? -1 : 1;

    const scaleFactor = Math.max(0.05, 1.0 + (params.scale  ?? 0) * 0.012);
    const spreadDx    = (params.spread ?? 0) * 0.0004 * xSign;
    const dx          = (params.posX  ?? 0) * xSign * 0.0004 + spreadDx;
    const dy          = (params.posY  ?? 0) * 0.0004;
    const dz          = (params.posZ  ?? 0) * 0.0004;
    const rotXRad     = (params.rotX  ?? 0) * (Math.PI / 180);
    const rotYRad     = (params.rotY  ?? 0) * (Math.PI / 180) * xSign;

    for (const name in bones) {
      const bone = bones[name], rest = rests[name];
      if (!bone || !rest) continue;

      // 1. 重心基準でスケール
      const px = center.x + (rest.pos.x - center.x) * scaleFactor;
      const py = center.y + (rest.pos.y - center.y) * scaleFactor;
      const pz = center.z + (rest.pos.z - center.z) * scaleFactor;

      // 2. 位置オフセット
      bone.position.set(px + dx, py + dy, pz + dz);

      // 3. 回転オフセット（レスト回転に加算）
      bone.rotation.set(
        rest.rot.x + rotXRad,
        rest.rot.y + rotYRad,
        rest.rot.z,
        rest.rot.order,
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  FaceEditor  — 全顔パーツコントローラーの統合管理クラス
//
//  使い方:
//    const faceEditor = new FaceEditor(character);
//    faceEditor.reinitForHead();                   // head 付け替え後
//    faceEditor.eye.getState().syncLR = false;     // UI から変更
//    faceEditor.eye.applyState();                  // 3D へ反映
//    const json = faceEditor.serialize();          // 保存
//    faceEditor.deserialize(json);                 // 復元
// ═══════════════════════════════════════════════════════════════
export class FaceEditor {
  constructor(character) {
    this.character = character;
    this.eye       = new EyeController(character);
    this.eyebrow   = new EyebrowController(character);
    this.nose      = new NoseController(character);
    this.faceShape = new FaceShapeController(character);
    this.ear       = new EarController(character);
    // this.mouth = new MouthController(character); // 未実装
    // NOTE: ExpressionController はこの FaceEditor インスタンスを受け取って別途生成する
  }

  // head が付け替えられたあとに呼ぶ（ボーン参照を更新）
  reinitForHead() {
    this.eye.init();
    this.eyebrow.init();
    this.nose.init();
    this.faceShape.init();
    this.ear.init();
  }

  // 全パーツの調整値を 3D へ一括適用
  applyAll() {
    this.eye.applyState();
    this.eyebrow.applyState();
    this.nose.applyState();
    this.faceShape.applyState();
    this.ear.applyState();
  }

  // 指定パーツ（省略時は全パーツ）をリセット
  reset(partName) {
    if (!partName || partName === 'eye')       this.eye.resetState();
    if (!partName || partName === 'eyebrow')   this.eyebrow.resetState();
    if (!partName || partName === 'nose')      this.nose.resetState();
    if (!partName || partName === 'faceShape') this.faceShape.resetState();
    if (!partName || partName === 'ear')       this.ear.resetState();
  }

  // JSON 保存用シリアライズ
  serialize() {
    return {
      eye:       this.eye.serialize(),
      eyebrow:   this.eyebrow.serialize(),
      nose:      this.nose.serialize(),
      faceShape: this.faceShape.serialize(),
      ear:       this.ear.serialize(),
    };
  }

  // JSON 読込復元（未知キーは無視するので後方互換あり）
  deserialize(data) {
    if (!data) return;
    if (data.eye)       this.eye.deserialize(data.eye);
    if (data.eyebrow)   this.eyebrow.deserialize(data.eyebrow);
    if (data.nose)      this.nose.deserialize(data.nose);
    if (data.faceShape) this.faceShape.deserialize(data.faceShape);
    if (data.ear)       this.ear.deserialize(data.ear);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ExpressionController  — 表情の重ね掛けコントローラー
//
//  設計:
//    FaceEditor の eye / eyebrow に、表情スライダー値から算出した
//    デルタ（差分）を加算して骨を動かす。
//    FaceEditor の _state は変更せず、骨だけ上書きするので
//    「顔の基本調整」と「表情」を独立して管理できる。
//
//    適用順: faceEditor.applyAll() → expressionController.applyState()
//    これを守ることで表情が常に基本調整の上に重なる。
// ═══════════════════════════════════════════════════════════════

// ── params を加算合成（表情デルタを基本調整パラメータに重ねる）──
function _mergeExprParams(base, delta) {
  const result = { ...base };
  for (const k in delta) {
    if (typeof delta[k] === 'number') result[k] = (result[k] ?? 0) + delta[k];
  }
  return result;
}

// ── 表情スライダー値 → 目デルタ ────────────────────────────────
function _eyeDeltaFromExpr(vals) {
  const t = k => (vals[k] ?? 0) / 100;
  return {
    scale:    -22 * t('smile') - 18 * t('anger') + 40 * t('surprise') - 55 * t('sleepy') - 95 * t('eyeClose'),
    posY:      6  * t('surprise') - 5 * t('sad'),
    posX:      0,
    posZ:      0,
    rotation:  0,
  };
}

// ── 表情スライダー値 → 眉デルタ ────────────────────────────────
function _eyebrowDeltaFromExpr(vals) {
  const t = k => (vals[k] ?? 0) / 100;
  return {
    scale:     0,
    posX:      0,
    posY:      12 * t('smile') - 20 * t('anger') - 8 * t('sad') + 28 * t('surprise') + 5 * t('blush') - 12 * t('sleepy'),
    posZ:      0,
    rotation:  -35 * t('anger') + 30 * t('sad'),
    thickness:  0,
  };
}

// ── 表情プリセット定義 ──────────────────────────────────────────
export const EXPRESSION_PRESETS = [
  { id: 'normal',    label: '通常',       values: {} },
  { id: 'smile',     label: '笑顔',       values: { smile: 80, blush: 20, mouthCorner: 50, mouthOpen: 15 } },
  { id: 'anger',     label: '怒り',       values: { anger: 85, mouthCorner: -55 } },
  { id: 'cry',       label: '泣き',       values: { sad: 85, blush: 40, eyeClose: 20, mouthOpen: 25, mouthCorner: -30 } },
  { id: 'surprise',  label: '驚き',       values: { surprise: 90, mouthOpen: 55 } },
  { id: 'blush',     label: '照れ',       values: { blush: 90, smile: 35, mouthCorner: 25 } },
  { id: 'jito',      label: 'ジト目',     values: { sleepy: 65, anger: 25, mouthCorner: -15 } },
  { id: 'sleepy',    label: '眠そう',     values: { sleepy: 90, eyeClose: 35, mouthOpen: 10 } },
  { id: 'wink_l',    label: 'ウィンク左', values: { smile: 55, mouthCorner: 35 }, winkL: true },
  { id: 'wink_r',    label: 'ウィンク右', values: { smile: 55, mouthCorner: 35 }, winkR: true },
  { id: 'heart',     label: 'ハート目',   values: { smile: 70, blush: 45, surprise: 20 } },
];

function _defaultExprValues() {
  return { smile: 0, anger: 0, sad: 0, surprise: 0, blush: 0, sleepy: 0, eyeClose: 0, mouthOpen: 0, mouthCorner: 0 };
}

export class ExpressionController {
  constructor(faceEditor) {
    this.faceEditor = faceEditor;
    this._preset    = 'normal';
    this._values    = _defaultExprValues();
    this._winkL     = false;
    this._winkR     = false;
  }

  setPreset(id) {
    const preset = EXPRESSION_PRESETS.find(p => p.id === id);
    if (!preset) return;
    this._preset = id;
    this._values = { ..._defaultExprValues(), ...preset.values };
    this._winkL  = preset.winkL ?? false;
    this._winkR  = preset.winkR ?? false;
  }

  setValue(key, value) {
    this._values[key] = value;
    this._winkL = false;
    this._winkR = false;
    this._preset = '';
  }

  getValue(key)  { return this._values[key] ?? 0; }
  getValues()    { return this._values; }
  getPreset()    { return this._preset; }

  applyState() {
    const fe = this.faceEditor;
    if (!fe) return;

    // ── 目へのオーバーレイ ────────────────────────────────────
    const eyeDelta = _eyeDeltaFromExpr(this._values);
    const eyeState = fe.eye.getState();
    if (eyeState.syncLR) {
      const base = eyeState.both;
      fe.eye._applySide('L', this._winkL
        ? _mergeExprParams(base, { ...eyeDelta, scale: eyeDelta.scale - 95 })
        : _mergeExprParams(base, eyeDelta));
      fe.eye._applySide('R', this._winkR
        ? _mergeExprParams(base, { ...eyeDelta, scale: eyeDelta.scale - 95 })
        : _mergeExprParams(base, eyeDelta));
    } else {
      fe.eye._applySide('L', this._winkL
        ? _mergeExprParams(eyeState.left,  { ...eyeDelta, scale: eyeDelta.scale - 95 })
        : _mergeExprParams(eyeState.left,  eyeDelta));
      fe.eye._applySide('R', this._winkR
        ? _mergeExprParams(eyeState.right, { ...eyeDelta, scale: eyeDelta.scale - 95 })
        : _mergeExprParams(eyeState.right, eyeDelta));
    }

    // ── 眉へのオーバーレイ ────────────────────────────────────
    const ebDelta = _eyebrowDeltaFromExpr(this._values);
    const ebState = fe.eyebrow.getState();
    if (ebState.syncLR) {
      const merged = _mergeExprParams(ebState.both, ebDelta);
      fe.eyebrow._applySide('L', merged);
      fe.eyebrow._applySide('R', merged);
    } else {
      fe.eyebrow._applySide('L', _mergeExprParams(ebState.left,  ebDelta));
      fe.eyebrow._applySide('R', _mergeExprParams(ebState.right, ebDelta));
    }
  }

  resetState() {
    this._preset = 'normal';
    this._values = _defaultExprValues();
    this._winkL  = false;
    this._winkR  = false;
    // 顔のベース状態を再適用して表情をクリア
    this.faceEditor?.applyAll();
  }

  serialize() {
    return {
      preset: this._preset,
      values: { ...this._values },
    };
  }

  deserialize(data) {
    if (!data) return;
    this._preset = data.preset ?? 'normal';
    if (data.values) Object.assign(this._values, data.values);
    // wink フラグをプリセット定義から復元
    const preset = EXPRESSION_PRESETS.find(p => p.id === this._preset);
    this._winkL  = preset?.winkL ?? false;
    this._winkR  = preset?.winkR ?? false;
  }
}
