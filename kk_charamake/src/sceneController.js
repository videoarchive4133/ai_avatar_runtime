import * as THREE from 'three';

// ─── 背景プリセット ────────────────────────────────────────────
export const BACKGROUND_PRESETS = [
  { id: 'none',      label: 'なし',      color: '#0a0c14', gradient: false },
  { id: 'white',     label: '白背景',    color: '#ffffff', gradient: false },
  { id: 'black',     label: '黒背景',    color: '#000000', gradient: false },
  { id: 'gray',      label: 'グレー背景', color: '#7a7a7a', gradient: false },
  { id: 'studio',    label: 'スタジオ',  color: '#1a1a1a', gradient: true  },
  { id: 'classroom', label: '教室',      color: '#d4c9a8', gradient: true  },
  { id: 'room',      label: '部屋',      color: '#c8b89a', gradient: true  },
  { id: 'outdoor',   label: '屋外',      color: '#87ceeb', gradient: true  },
  { id: 'night',     label: '夜',        color: '#060c18', gradient: true  },
  { id: 'stage',     label: 'ステージ',  color: '#0a0010', gradient: true  },
];

// ─── 小物タイプ定義 ────────────────────────────────────────────
export const PROP_TYPES = [
  { id: 'chair',       label: '椅子' },
  { id: 'desk',        label: '机' },
  { id: 'microphone',  label: 'マイク' },
  { id: 'light_stand', label: 'ライトスタンド' },
  { id: 'box',         label: '箱' },
  { id: 'pedestal',    label: '台座' },
  { id: 'sign',        label: '看板' },
  { id: 'flower',      label: '花' },
  { id: 'book',        label: '本' },
  { id: 'camera_prop', label: 'カメラ' },
];

// ─── プリミティブ生成ヘルパー ───────────────────────────────────
function _mat(color, roughness = 0.7, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function _box(w, h, d, color, roughness, metalness) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _mat(color, roughness, metalness));
  m.castShadow = true; m.receiveShadow = true; m.userData.noPaint = true;
  return m;
}

function _cyl(rt, rb, h, seg, color, roughness, metalness) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), _mat(color, roughness, metalness));
  m.castShadow = true; m.receiveShadow = true; m.userData.noPaint = true;
  return m;
}

function _sph(r, color, roughness, metalness) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), _mat(color, roughness, metalness));
  m.castShadow = true; m.receiveShadow = true; m.userData.noPaint = true;
  return m;
}

// 将来GLBへ差し替え可能な設計: userData.propType を保持し buildPropMesh(type) で生成
export function buildPropMesh(type) {
  const group = new THREE.Group();
  group.userData.propType = type;

  switch (type) {
    case 'chair': {
      const seat = _box(0.5, 0.05, 0.5, 0x8B4513);
      seat.position.y = 0.45;
      group.add(seat);
      const back = _box(0.5, 0.5, 0.05, 0x7A3B10);
      back.position.set(0, 0.725, -0.225);
      group.add(back);
      for (const [x, z] of [[0.2,0.2],[-0.2,0.2],[0.2,-0.2],[-0.2,-0.2]]) {
        const leg = _box(0.045, 0.45, 0.045, 0x6B3410);
        leg.position.set(x, 0.225, z);
        group.add(leg);
      }
      break;
    }
    case 'desk': {
      const top = _box(1.2, 0.05, 0.6, 0xD2691E);
      top.position.y = 0.755;
      group.add(top);
      for (const [x, z] of [[0.55,0.25],[-0.55,0.25],[0.55,-0.25],[-0.55,-0.25]]) {
        const leg = _box(0.05, 0.76, 0.05, 0xA0522D);
        leg.position.set(x, 0.38, z);
        group.add(leg);
      }
      break;
    }
    case 'microphone': {
      const base = _cyl(0.15, 0.15, 0.03, 12, 0x333333, 0.5, 0.5);
      base.position.y = 0.015;
      group.add(base);
      const pole = _cyl(0.012, 0.012, 1.2, 8, 0x444444, 0.3, 0.7);
      pole.position.y = 0.63;
      group.add(pole);
      const head = _sph(0.07, 0x222222, 0.6, 0.3);
      head.position.y = 1.28;
      group.add(head);
      break;
    }
    case 'light_stand': {
      const base = _cyl(0.3, 0.3, 0.02, 12, 0x222222, 0.8, 0.3);
      base.position.y = 0.01;
      group.add(base);
      const pole = _cyl(0.02, 0.02, 1.8, 8, 0x555555, 0.5, 0.5);
      pole.position.y = 0.91;
      group.add(pole);
      const disc = _cyl(0.2, 0.2, 0.05, 16, 0xffffcc, 0.5, 0.1);
      disc.position.y = 1.82;
      group.add(disc);
      break;
    }
    case 'box': {
      const b = _box(0.5, 0.5, 0.5, 0x996633);
      b.position.y = 0.25;
      group.add(b);
      break;
    }
    case 'pedestal': {
      const ped = _cyl(0.4, 0.5, 0.5, 16, 0xcccccc, 0.3, 0.1);
      ped.position.y = 0.25;
      group.add(ped);
      break;
    }
    case 'sign': {
      const board = _box(0.8, 0.5, 0.05, 0xfefefe, 0.8, 0.0);
      board.position.y = 1.4;
      group.add(board);
      const pole = _cyl(0.025, 0.025, 1.2, 8, 0x888888, 0.5, 0.5);
      pole.position.y = 0.6;
      group.add(pole);
      break;
    }
    case 'flower': {
      const stem = _cyl(0.015, 0.015, 0.5, 8, 0x228B22, 0.8);
      stem.position.y = 0.25;
      group.add(stem);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const petal = _sph(0.06, 0xff69b4, 0.7);
        petal.position.set(Math.cos(a) * 0.08, 0.52, Math.sin(a) * 0.08);
        group.add(petal);
      }
      const center = _sph(0.05, 0xFFD700, 0.6);
      center.position.y = 0.52;
      group.add(center);
      break;
    }
    case 'book': {
      const cover = _box(0.2, 0.28, 0.04, 0x4169E1, 0.8);
      cover.position.y = 0.14;
      group.add(cover);
      const pages = _box(0.18, 0.265, 0.033, 0xf5f5dc, 0.9);
      pages.position.set(0.005, 0.14, 0.004);
      group.add(pages);
      break;
    }
    case 'camera_prop': {
      const body = _box(0.3, 0.2, 0.15, 0x1a1a1a, 0.5, 0.3);
      body.position.y = 0.1;
      group.add(body);
      const lens = _cyl(0.06, 0.07, 0.15, 16, 0x222222, 0.3, 0.5);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.1, 0.15);
      group.add(lens);
      break;
    }
    default: {
      const dflt = _box(0.3, 0.3, 0.3, 0x666666);
      dflt.position.y = 0.15;
      group.add(dflt);
    }
  }

  return group;
}

function _disposePropMesh(group) {
  group.traverse(o => {
    if (o.isMesh) {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    }
  });
}

function _makeGradient(baseColor) {
  const c = new THREE.Color(baseColor);
  const canvas = document.createElement('canvas');
  canvas.width = 2; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const clamp = v => Math.min(255, Math.round(v));
  const top = `rgb(${clamp(c.r*255*1.4)},${clamp(c.g*255*1.4)},${clamp(c.b*255*1.4)})`;
  const bot = `rgb(${clamp(c.r*255*0.3)},${clamp(c.g*255*0.3)},${clamp(c.b*255*0.3)})`;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(canvas);
}

function defaultFloor() {
  return { enabled: true, color: '#222222', roughness: 0.7, reflection: 0.05, grid: false };
}

let _propCounter = 0;

// ─── SceneController ─────────────────────────────────────────────
export class SceneController {
  constructor({ scene, floorMesh, gridHelper }) {
    this._scene    = scene;
    this._floor    = floorMesh;
    this._grid     = gridHelper;
    this._state    = {
      backgroundPreset: 'none',
      floor: defaultFloor(),
      props: [],
    };
    this._propMeshes = new Map(); // id → THREE.Group
    this._gradTex    = null;
  }

  // ── 背景 ────────────────────────────────────────────────────
  setBackgroundPreset(id) {
    this._state.backgroundPreset = id;
    this._applyBackground();
  }

  // ── 床 ──────────────────────────────────────────────────────
  setFloorValue(key, value) {
    if (key in this._state.floor) {
      this._state.floor[key] = value;
      this._applyFloor();
    }
  }

  // ── 小物 ────────────────────────────────────────────────────
  addProp(type) {
    _propCounter++;
    const id = `prop_${String(_propCounter).padStart(3, '0')}`;
    this._state.props.push({ id, type, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
    const mesh = buildPropMesh(type);
    mesh.name = id;
    this._scene.add(mesh);
    this._propMeshes.set(id, mesh);
    return id;
  }

  removeProp(id) {
    const mesh = this._propMeshes.get(id);
    if (mesh) {
      this._scene.remove(mesh);
      _disposePropMesh(mesh);
      this._propMeshes.delete(id);
    }
    this._state.props = this._state.props.filter(p => p.id !== id);
  }

  setPropTransform(id, transform) {
    const prop = this._state.props.find(p => p.id === id);
    if (!prop) return;
    if (transform.position !== undefined) prop.position = [...transform.position];
    if (transform.rotation !== undefined) prop.rotation = [...transform.rotation];
    if (transform.scale    !== undefined) prop.scale    = transform.scale;
    this._applyPropTransform(id);
  }

  // ── 全体適用 ─────────────────────────────────────────────────
  apply() {
    this._applyBackground();
    this._applyFloor();
    for (const p of this._state.props) this._applyPropTransform(p.id);
  }

  reset() {
    for (const [, mesh] of this._propMeshes) {
      this._scene.remove(mesh);
      _disposePropMesh(mesh);
    }
    this._propMeshes.clear();
    if (this._gradTex) { this._gradTex.dispose(); this._gradTex = null; }
    this._state = { backgroundPreset: 'none', floor: defaultFloor(), props: [] };
    this.apply();
  }

  getState() { return this._state; }

  // ── シリアライズ ──────────────────────────────────────────────
  serialize() {
    return JSON.parse(JSON.stringify(this._state));
  }

  deserialize(data) {
    if (!data) return;
    // 既存の小物を全削除
    for (const [, mesh] of this._propMeshes) {
      this._scene.remove(mesh);
      _disposePropMesh(mesh);
    }
    this._propMeshes.clear();
    if (this._gradTex) { this._gradTex.dispose(); this._gradTex = null; }

    this._state = { backgroundPreset: 'none', floor: defaultFloor(), props: [] };

    if (data.backgroundPreset) this._state.backgroundPreset = data.backgroundPreset;
    if (data.floor) Object.assign(this._state.floor, data.floor);

    if (Array.isArray(data.props)) {
      for (const p of data.props) {
        const propState = {
          id:       p.id,
          type:     p.type,
          position: Array.isArray(p.position) ? [...p.position] : [0, 0, 0],
          rotation: Array.isArray(p.rotation) ? [...p.rotation] : [0, 0, 0],
          scale:    typeof p.scale === 'number' ? p.scale : 1,
        };
        this._state.props.push(propState);

        const mesh = buildPropMesh(p.type);
        mesh.name = p.id;
        this._scene.add(mesh);
        this._propMeshes.set(p.id, mesh);
        this._applyPropTransform(p.id);

        // カウンター更新（重複IDを避ける）
        const num = parseInt(p.id.replace('prop_', ''), 10);
        if (!isNaN(num) && num > _propCounter) _propCounter = num;
      }
    }

    this._applyBackground();
    this._applyFloor();
  }

  // ── 内部適用 ─────────────────────────────────────────────────
  _applyBackground() {
    if (!this._scene) return;
    const preset = BACKGROUND_PRESETS.find(p => p.id === this._state.backgroundPreset);
    if (!preset) return;

    if (preset.gradient) {
      if (this._gradTex) this._gradTex.dispose();
      this._gradTex = _makeGradient(preset.color);
      this._scene.background = this._gradTex;
    } else {
      if (this._gradTex) { this._gradTex.dispose(); this._gradTex = null; }
      this._scene.background = new THREE.Color(preset.color);
    }
  }

  _applyFloor() {
    const f = this._state.floor;
    if (this._floor) {
      this._floor.visible = f.enabled;
      const mat = this._floor.material;
      if (mat) {
        mat.color.set(f.color);
        mat.roughness  = f.roughness;
        mat.metalness  = f.reflection;
        mat.needsUpdate = true;
      }
    }
    if (this._grid) this._grid.visible = f.grid;
  }

  _applyPropTransform(id) {
    const prop = this._state.props.find(p => p.id === id);
    const mesh = this._propMeshes.get(id);
    if (!prop || !mesh) return;
    const DEG = Math.PI / 180;
    mesh.position.set(prop.position[0], prop.position[1], prop.position[2]);
    mesh.rotation.set(
      prop.rotation[0] * DEG,
      prop.rotation[1] * DEG,
      prop.rotation[2] * DEG,
    );
    mesh.scale.setScalar(prop.scale);
  }
}
