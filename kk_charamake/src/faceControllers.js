import * as THREE from 'three';

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
    this._bonesL  = {};   // boneName → THREE.Bone
    this._bonesR  = {};
    this._restL   = {};   // boneName → { pos: Vector3, rot: Euler, scale: Vector3 }
    this._restR   = {};
    this.centerL  = new THREE.Vector3();
    this.centerR  = new THREE.Vector3();
  }

  // ── サブクラスでオーバーライド ──────────────────────────────
  get boneNamesL() { return []; }
  get boneNamesR() { return []; }

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
  // params: { scale, posX, posY, posZ, rotation }  値はすべて -100〜100 (rotation は -180〜180°)
  // side  : 'both' | 'left' | 'right'
  apply(params, side = 'both') {
    if (side === 'both' || side === 'left')  this._applySide('L', params);
    if (side === 'both' || side === 'right') this._applySide('R', params);
  }

  // サブクラスでオーバーライド
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

export class EyeController extends FacePartController {
  get boneNamesL() { return EYE_BONE_SUFFIXES.map(s => `cf_J_Eye${s}_L`); }
  get boneNamesR() { return EYE_BONE_SUFFIXES.map(s => `cf_J_Eye${s}_R`); }

  _applySide(side, params) {
    const bones  = side === 'L' ? this._bonesL : this._bonesR;
    const rests  = side === 'L' ? this._restL  : this._restR;
    const center = side === 'L' ? this.centerL : this.centerR;

    // X 軸方向は左右で反転（左右対称になるよう）
    const xSign = side === 'R' ? -1 : 1;

    // 係数変換
    // scale: 0=等倍, +100=約2.2倍, -100=約0.1倍（最小0.05にクランプ）
    const scaleFactor = Math.max(0.05, 1.0 + (params.scale ?? 0) * 0.012);
    const dx    = (params.posX     ?? 0) * xSign * 0.0004;   // ±100 → ±0.04 units
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
