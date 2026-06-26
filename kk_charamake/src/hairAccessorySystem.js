import * as THREE from 'three';

// ─── マテリアル作成ヘルパー ────────────────────────────────────
function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: opts.roughness ?? 0.35,
    metalness: opts.metalness ?? 0.25,
    side: THREE.DoubleSide,
  });
}

// ─── 形状ヘルパー ───────────────────────────────────────────────
function starShape(pts, ro, ri) {
  const s = new THREE.Shape();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? ro : ri;
    i === 0 ? s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
             : s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function heartShape(size) {
  const s = new THREE.Shape();
  const w = size, h = size;
  s.moveTo(0, -h * 0.4);
  s.bezierCurveTo(-w * 0.6, -h * 0.8, -w, -h * 0.1, -w, h * 0.2);
  s.bezierCurveTo(-w, h * 0.7, -w * 0.5, h, 0, h * 0.6);
  s.bezierCurveTo(w * 0.5, h, w, h * 0.7, w, h * 0.2);
  s.bezierCurveTo(w, -h * 0.1, w * 0.6, -h * 0.8, 0, -h * 0.4);
  return s;
}

// ─── プリセット形状ファクトリ ───────────────────────────────────
function makeRibbon(hex, scale = 1) {
  const g = new THREE.Group();
  const m = mat(hex);
  const bw = 0.045 * scale, bh = 0.030 * scale, bd = 0.013 * scale;
  const L = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
  L.position.set(-bw * 0.55, 0, 0); L.rotation.z = 0.45;
  const R = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m.clone());
  R.position.set(bw * 0.55, 0, 0); R.rotation.z = -0.45;
  const K = new THREE.Mesh(new THREE.SphereGeometry(bh * 0.38, 8, 6), m.clone());
  g.add(L, R, K);
  return g;
}

function makeStar(hex) {
  const shape = starShape(5, 0.038, 0.015);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.011, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, mat(hex));
  mesh.position.z = -0.0055;
  const g = new THREE.Group(); g.add(mesh);
  return g;
}

function makeHeart(hex) {
  const shape = heartShape(0.030);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.011, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, mat(hex));
  mesh.rotation.x = Math.PI;
  mesh.position.set(0, 0.030, 0.0055);
  const g = new THREE.Group(); g.add(mesh);
  return g;
}

function makeFlower(hex) {
  const g = new THREE.Group();
  const m = mat(hex);
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffff88, roughness: 0.5 })
  );
  g.add(center);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), m.clone());
    petal.scale.set(1.2, 0.65, 0.5);
    petal.position.set(Math.cos(a) * 0.021, Math.sin(a) * 0.021, 0);
    g.add(petal);
  }
  return g;
}

function makeHairpin(hex) {
  const g = new THREE.Group();
  const m = mat(hex, { metalness: 0.75, roughness: 0.18 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.076, 6), m);
  rod.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), m.clone());
  tip.position.set(0.038, 0, 0);
  g.add(rod, tip);
  return g;
}

function makeDoubleHairpin(hex) {
  const g = new THREE.Group();
  const p1 = makeHairpin(hex); p1.position.y = 0.009;
  const p2 = makeHairpin(hex); p2.position.y = -0.009;
  g.add(p1, p2);
  return g;
}

function makeChain(hex) {
  const g = new THREE.Group();
  const m = mat(hex, { metalness: 0.85, roughness: 0.12 });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0038, 6, 14), m.clone());
    ring.position.x = (i - 1) * 0.025;
    ring.rotation.y = i % 2 === 0 ? 0 : Math.PI / 2;
    g.add(ring);
  }
  return g;
}

function makeCrown(hex) {
  const g = new THREE.Group();
  const m = mat(hex, { metalness: 0.82, roughness: 0.1 });
  const base = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.006, 6, 18, Math.PI * 2), m);
  base.rotation.x = Math.PI / 2;
  g.add(base);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.026, 4), m.clone());
    spike.position.set(Math.cos(a) * 0.033, 0.016, Math.sin(a) * 0.033);
    g.add(spike);
  }
  return g;
}

function makeTiara(hex) {
  const g = new THREE.Group();
  const m = mat(hex, { metalness: 0.88, roughness: 0.1 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.0048, 6, 22, Math.PI), m);
  band.rotation.x = Math.PI / 2;
  band.rotation.z = Math.PI;
  g.add(band);
  const gemMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, roughness: 0.08, metalness: 0.9 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.011), gemMat);
  gem.position.set(0, 0.043, 0);
  g.add(gem);
  [-0.024, 0.024].forEach(x => {
    const sg = new THREE.Mesh(new THREE.OctahedronGeometry(0.008), gemMat.clone());
    sg.position.set(x, 0.035, 0);
    g.add(sg);
  });
  return g;
}

// ─── プリセット一覧 ─────────────────────────────────────────────
export const HAIR_ACCESSORY_PRESETS = [
  { id: 'ribbon_s',   label: 'リボン',          defaultColor: '#ff88bb', create: c => makeRibbon(c, 1)   },
  { id: 'ribbon_l',   label: 'リボン(大)',        defaultColor: '#ff66aa', create: c => makeRibbon(c, 1.8) },
  { id: 'star',       label: '星',               defaultColor: '#ffdd00', create: c => makeStar(c)         },
  { id: 'heart',      label: 'ハート',            defaultColor: '#ff3366', create: c => makeHeart(c)        },
  { id: 'flower',     label: '花',               defaultColor: '#ffaacc', create: c => makeFlower(c)       },
  { id: 'hairpin',    label: 'ヘアピン',          defaultColor: '#aaddff', create: c => makeHairpin(c)     },
  { id: 'hairpin_d',  label: 'ダブルヘアピン',    defaultColor: '#aaddff', create: c => makeDoubleHairpin(c) },
  { id: 'chain',      label: 'チェーン',          defaultColor: '#dddddd', create: c => makeChain(c)        },
  { id: 'crown',      label: '王冠',              defaultColor: '#ffcc00', create: c => makeCrown(c)        },
  { id: 'tiara',      label: 'ティアラ',          defaultColor: '#ffcc00', create: c => makeTiara(c)        },
];

// ─── ツヤプリセット ─────────────────────────────────────────────
export const HAIR_SHINE_PRESETS = {
  matte:  { label: 'マット',   roughness: 1.00, metalness: 0.00, envMapIntensity: 0.00 },
  normal: { label: '普通',     roughness: 0.70, metalness: 0.00, envMapIntensity: 0.30 },
  shiny:  { label: 'ツヤあり', roughness: 0.28, metalness: 0.08, envMapIntensity: 0.85 },
  anime:  { label: 'アニメ風', roughness: 0.40, metalness: 0.10, envMapIntensity: 1.00 },
  game:   { label: 'ゲーム風', roughness: 0.18, metalness: 0.32, envMapIntensity: 1.50 },
};

// ─── ベース形状 (3D作成用) ─────────────────────────────────────
export const BASE_SHAPES = [
  { id: 'ribbon',  label: 'リボン',   create: c => makeRibbon(c) },
  { id: 'star',    label: '星',       create: c => makeStar(c) },
  { id: 'heart',   label: 'ハート',   create: c => makeHeart(c) },
  { id: 'flower',  label: '花',       create: c => makeFlower(c) },
  { id: 'sphere',  label: '球',       create: c => new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), mat(c)) },
  { id: 'box',     label: 'プレート', create: c => new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.038, 0.008), mat(c)) },
  { id: 'torus',   label: 'リング',   create: c => new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 20), mat(c, { metalness: 0.7, roughness: 0.2 })) },
  { id: 'cone',    label: '棒',       create: c => new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.007, 0.06, 6), mat(c, { metalness: 0.5, roughness: 0.3 })) },
  { id: 'crown',   label: '王冠',     create: c => makeCrown(c) },
  { id: 'tiara',   label: 'ティアラ', create: c => makeTiara(c) },
];

// ─── ユーザー作成アクセサリー (セッション内) ──────────────────
export const userAccessories = [];
