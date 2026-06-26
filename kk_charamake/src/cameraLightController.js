import * as THREE from 'three';

// ─── カメラプリセット ────────────────────────────────────────────
export const CAMERA_PRESETS = [
  { id:'full_body',  label:'全身',       position:[0,0.9,2.6],   target:[0,0.85,0], fov:35, zoom:1 },
  { id:'upper_body', label:'上半身',     position:[0,1.2,1.6],   target:[0,1.1,0],  fov:35, zoom:1 },
  { id:'face_up',    label:'顔アップ',   position:[0,1.52,0.8],  target:[0,1.52,0], fov:30, zoom:1 },
  { id:'side_face',  label:'横顔',       position:[0.8,1.52,0.3],target:[0,1.52,0], fov:30, zoom:1 },
  { id:'angle_up',   label:'斜め上',     position:[0.8,2.2,1.8], target:[0,1.0,0],  fov:35, zoom:1 },
  { id:'angle_down', label:'斜め下',     position:[0.8,0.4,1.8], target:[0,0.9,0],  fov:35, zoom:1 },
  { id:'back',       label:'背面',       position:[0,0.9,-2.6],  target:[0,0.85,0], fov:35, zoom:1 },
  { id:'feet',       label:'足元',       position:[0,0.2,1.2],   target:[0,0.1,0],  fov:40, zoom:1 },
  { id:'bust_up',    label:'バストアップ',position:[0,1.1,1.2],  target:[0,1.0,0],  fov:30, zoom:1 },
  { id:'sns_icon',   label:'SNSアイコン',position:[0,1.55,0.6],  target:[0,1.55,0], fov:25, zoom:1 },
];

// ─── ライトプリセット ────────────────────────────────────────────
export const LIGHT_PRESETS = [
  { id:'standard',  label:'標準',     mainIntensity:1.4, mainAngle:0,   subIntensity:0.5, rimIntensity:0.35, ambient:0.7,  shadow:true,  shadowDark:0.5 },
  { id:'bright',    label:'明るい',   mainIntensity:2.0, mainAngle:30,  subIntensity:0.8, rimIntensity:0.5,  ambient:1.0,  shadow:true,  shadowDark:0.3 },
  { id:'dark',      label:'暗め',     mainIntensity:0.8, mainAngle:0,   subIntensity:0.2, rimIntensity:0.2,  ambient:0.3,  shadow:true,  shadowDark:0.8 },
  { id:'studio',    label:'スタジオ', mainIntensity:1.8, mainAngle:0,   subIntensity:1.0, rimIntensity:0.8,  ambient:0.9,  shadow:false, shadowDark:0.3 },
  { id:'backlight', label:'逆光',     mainIntensity:0.3, mainAngle:180, subIntensity:0.2, rimIntensity:2.0,  ambient:0.5,  shadow:true,  shadowDark:0.9 },
  { id:'sunset',    label:'夕方',     mainIntensity:1.2, mainAngle:90,  subIntensity:0.3, rimIntensity:0.8,  ambient:0.5,  shadow:true,  shadowDark:0.6 },
  { id:'night',     label:'夜',       mainIntensity:0.3, mainAngle:180, subIntensity:0.1, rimIntensity:0.5,  ambient:0.1,  shadow:true,  shadowDark:1.0 },
  { id:'anime',     label:'アニメ風', mainIntensity:1.5, mainAngle:20,  subIntensity:0.8, rimIntensity:0.0,  ambient:1.2,  shadow:false, shadowDark:0.2 },
];

function defaultState() {
  return {
    camera: {
      position: [0, 0.9, 2.6],
      target:   [0, 0.85, 0],
      fov:      35,
      zoom:     1,
    },
    light: {
      mainIntensity: 1.4,
      mainAngle:     0,
      subIntensity:  0.5,
      rimIntensity:  0.35,
      ambient:       0.7,
      shadow:        true,
      shadowDark:    0.5,
    },
    background: {
      color:    '#0a0c14',
      gradient: false,
      floor:    true,
      grid:     false,
    },
  };
}

// ─── CameraLightController ───────────────────────────────────────
export class CameraLightController {
  constructor({ camera, controls, scene, ambLight, keyLight, fillLight, rimLight, floorMesh, gridHelper }) {
    this._camera   = camera;
    this._controls = controls;
    this._scene    = scene;
    this._amb      = ambLight;
    this._key      = keyLight;
    this._fill     = fillLight;
    this._rim      = rimLight;
    this._floor    = floorMesh;
    this._grid     = gridHelper;
    this._state    = defaultState();
    this._gradTex  = null;
  }

  setCameraPreset(id) {
    const p = CAMERA_PRESETS.find(x => x.id === id);
    if (!p) return;
    this._state.camera.position = [...p.position];
    this._state.camera.target   = [...p.target];
    this._state.camera.fov      = p.fov;
    this._state.camera.zoom     = p.zoom;
    this._applyCamera();
  }

  setLightPreset(id) {
    const p = LIGHT_PRESETS.find(x => x.id === id);
    if (!p) return;
    const { label: _l, id: _i, ...fields } = p;
    Object.assign(this._state.light, fields);
    this._applyLight();
  }

  setCameraValue(key, value) {
    if (key in this._state.camera) {
      this._state.camera[key] = value;
      this._applyCamera();
    }
  }

  setLightValue(key, value) {
    if (key in this._state.light) {
      this._state.light[key] = value;
      this._applyLight();
    }
  }

  setBackgroundValue(key, value) {
    if (key in this._state.background) {
      this._state.background[key] = value;
      this._applyBackground();
    }
  }

  apply() {
    this._applyCamera();
    this._applyLight();
    this._applyBackground();
  }

  reset() {
    this._state = defaultState();
    this.apply();
  }

  getState() { return this._state; }

  // ── 内部適用 ─────────────────────────────────────────────────
  _applyCamera() {
    if (!this._camera || !this._controls) return;
    const cam = this._state.camera;
    this._camera.position.set(...cam.position);
    this._controls.target.set(...cam.target);
    this._camera.fov  = cam.fov;
    this._camera.zoom = cam.zoom;
    this._camera.updateProjectionMatrix();
    this._controls.update();
  }

  _applyLight() {
    if (!this._key) return;
    const lt = this._state.light;
    // メインライト: angleをY軸回転として位置を計算
    const rad = (lt.mainAngle * Math.PI) / 180;
    const r = 2.5;
    this._key.position.set(
      Math.sin(rad) * r,
      2.5,
      Math.cos(rad) * r,
    );
    this._key.intensity  = lt.mainIntensity;
    this._key.castShadow = lt.shadow;
    if (this._fill) this._fill.intensity = lt.subIntensity;
    if (this._rim)  this._rim.intensity  = lt.rimIntensity;
    if (this._amb)  this._amb.intensity  = lt.ambient;
  }

  _applyBackground() {
    if (!this._scene) return;
    const bg = this._state.background;
    if (bg.gradient) {
      if (this._gradTex) this._gradTex.dispose();
      this._gradTex = this._makeGradientTexture(bg.color);
      this._scene.background = this._gradTex;
    } else {
      if (this._gradTex) { this._gradTex.dispose(); this._gradTex = null; }
      this._scene.background = new THREE.Color(bg.color);
    }
    if (this._floor) this._floor.visible = bg.floor;
    if (this._grid)  this._grid.visible  = bg.grid;
  }

  _makeGradientTexture(baseColor) {
    const c = new THREE.Color(baseColor);
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const clamp = v => Math.min(255, Math.round(v));
    const top = `rgb(${clamp(c.r*255*1.5)},${clamp(c.g*255*1.5)},${clamp(c.b*255*1.5)})`;
    const bot = `rgb(${clamp(c.r*255*0.3)},${clamp(c.g*255*0.3)},${clamp(c.b*255*0.3)})`;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // ── シリアライズ ──────────────────────────────────────────────
  serialize() {
    return JSON.parse(JSON.stringify(this._state));
  }

  deserialize(data) {
    if (!data) return;
    if (data.camera)     Object.assign(this._state.camera,     data.camera);
    if (data.light)      Object.assign(this._state.light,      data.light);
    if (data.background) Object.assign(this._state.background, data.background);
    this.apply();
  }
}
