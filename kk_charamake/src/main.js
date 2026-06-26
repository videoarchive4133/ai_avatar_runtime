import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { KKCharacter } from './characterAssembler.js';
import { HAIR_ACCESSORY_PRESETS, HAIR_SHINE_PRESETS, BASE_SHAPES, userAccessories } from './hairAccessorySystem.js';
import { FaceEditor, ExpressionController, EXPRESSION_PRESETS } from './faceControllers.js';
import { PoseController, POSE_PRESETS, POSE_BONE_GROUPS } from './poseController.js';

// ═══════════════════════════════════════════════════════════════
//  ステータス / ローディング (UIより先に定義)
// ═══════════════════════════════════════════════════════════════
function setLoading(visible, msg = '') {
  document.getElementById('loading-overlay').classList.toggle('hidden', !visible);
  if (msg) document.getElementById('loading-msg').textContent = msg;
}
function setStatus(msg) {
  console.log('[KK]', msg);
}


// ═══════════════════════════════════════════════════════════════
//  Three.js セットアップ (WebGL失敗時もUIは動作する)
// ═══════════════════════════════════════════════════════════════
const canvas   = document.getElementById('three-canvas');
const viewport = document.getElementById('viewport');

let renderer = null, scene = null, camera = null, controls = null;
let character = null;

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c14);

  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  camera.position.set(0, 0.9, 2.6);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;
  controls.minDistance    = 0.3;
  controls.maxDistance    = 6;
  controls.update();

  // ライティング
  const ambLight = new THREE.AmbientLight(0xc8d0ff, 0.7);
  scene.add(ambLight);

  const keyLight = new THREE.DirectionalLight(0xfff8e8, 1.4);
  keyLight.position.set(1.2, 2.5, 1.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far  = 10;
  keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -2;
  keyLight.shadow.camera.right = keyLight.shadow.camera.top = 2;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x80a0ff, 0.5);
  fillLight.position.set(-1.5, 1.5, -0.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffe0f0, 0.35);
  rimLight.position.set(0, 2, -2);
  scene.add(rimLight);

  // フロア
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.noPaint = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(8, 16, 0x151a28, 0x151a28);
  grid.position.y = 0.001;
  grid.userData.noPaint = true;
  scene.add(grid);

  // KKCharacter
  character = new KKCharacter(scene);
  character.root.rotation.y = Math.PI; // GLBは-Z向きなので180度回転
  character.onProgress = msg => setStatus(msg);

  // カメラコントロールイベント
  const CAM = {
    reset: () => { camera.position.set(0, 0.9, 2.6);  controls.target.set(0, 0.85, 0); },
    front: () => { camera.position.set(0, 0.9, 2.6);  controls.target.set(0, 0.85, 0); },
    side:  () => { camera.position.set(2.6, 0.9, 0);  controls.target.set(0, 0.85, 0); },
    top:   () => { camera.position.set(0, 3.2, 0.01); controls.target.set(0, 0, 0);    },
    face:  () => { camera.position.set(0, 1.52, 0.8); controls.target.set(0, 1.52, 0); },
  };
  ['reset','front','side','top','face'].forEach(k =>
    document.getElementById(`cam-${k}`)?.addEventListener('click', () => { CAM[k](); controls.update(); })
  );

  let wireframe = false;
  document.getElementById('btn-wire')?.addEventListener('click', () => {
    wireframe = !wireframe;
    scene.traverse(o => {
      if ((o.isMesh || o.isSkinnedMesh) && o.material)
        [o.material].flat().forEach(m => { m.wireframe = wireframe; });
    });
  });
  document.getElementById('sl-light')?.addEventListener('input', e => {
    keyLight.intensity = parseFloat(e.target.value);
  });

  // リサイズ + レンダーループ
  function onResize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(viewport);
  // 初回はレイアウト完了後に実行
  requestAnimationFrame(() => { onResize(); });

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();

  // ベースボディ読込
  initCharacter();

} catch (e) {
  console.error('Three.js初期化エラー:', e);
  setLoading(false);
  const vp = document.getElementById('viewport');
  if (vp) {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#3a4060;font-size:13px;';
    msg.textContent = '3Dビューポート利用不可';
    vp.appendChild(msg);
  }
}

// ═══════════════════════════════════════════════════════════════
//  KKCharacter ベースボディ読込
// ═══════════════════════════════════════════════════════════════
async function initCharacter() {
  if (!character) return;
  setLoading(true, 'ベースボディ読込中...');
  try {
    await character.loadBase('/models/cf_body_base.glb');
  } catch (e) {
    console.error('ベースボディ読込失敗:', e);
  }
  setLoading(false);
}

// ═══════════════════════════════════════════════════════════════
//  体型スライダー → ボーンスケーリング
// ═══════════════════════════════════════════════════════════════
const BODY_MORPHS = {
  height:     { bones: ['cf_s_spine01','cf_s_spine02','cf_s_spine03','cf_s_leg_L','cf_s_leg_R'], axis: 'y',  range: 0.25 },
  head_size:  { bones: ['cf_s_head'],                                                             axis: 'xyz',range: 0.2  },
  bust:       { bones: ['cf_s_bust01_L','cf_s_bust01_R','cf_s_bust02_L','cf_s_bust02_R',
                         'cf_s_bust03_L','cf_s_bust03_R'],                                        axis: 'xyz',range: 0.6  },
  bust_soft:  { bones: [],                                                                        axis: 'xyz',range: 0    },
  waist:      { bones: ['cf_s_waist01','cf_s_waist02'],                                           axis: 'xz', range: 0.3  },
  shoulder:   { bones: ['cf_s_shoulder02_L','cf_s_shoulder02_R'],                                 axis: 'xyz',range: 0.35 },
  hips:       { bones: ['cf_s_thigh01_L','cf_s_thigh01_R'],                                      axis: 'xz', range: 0.4  },
  leg_len:    { bones: ['cf_s_leg01_L','cf_s_leg01_R','cf_s_leg02_L','cf_s_leg02_R',
                         'cf_s_leg03_L','cf_s_leg03_R'],                                          axis: 'y',  range: 0.3  },
  leg_thick:  { bones: ['cf_s_thigh02_L','cf_s_thigh02_R','cf_s_thigh03_L','cf_s_thigh03_R'],    axis: 'xz', range: 0.4  },
  nose_size:   { bones: ['cf_s_nose','cf_J_nose_t'],                                              axis: 'xyz',range: 0.5  },
  nose_height: { bones: ['cf_s_nose','cf_J_nose_base'],                                           axis: 'y',  range: 0.5  },
  nose_width:  { bones: ['cf_s_nose'],                                                             axis: 'xz', range: 0.4  },
  nose_tip:    { bones: ['cf_J_nose_t'],                                                           axis: 'xyz',range: 0.6  },
  nose_bridge: { bones: ['cf_J_nose_base'],                                                        axis: 'y',  range: 0.35 },
};

function applyBodyMorph(key, value) {
  if (!character) return;
  const morph = BODY_MORPHS[key];
  if (!morph || !morph.bones.length) return;
  const boneMap = character.baseBoneMap;
  for (const boneName of morph.bones) {
    const bone = boneMap[boneName];
    if (!bone) continue;
    const s = 1.0 + value * morph.range;
    if (morph.axis === 'xyz') bone.scale.set(s, s, s);
    else if (morph.axis === 'y')  bone.scale.set(1, s, 1);
    else if (morph.axis === 'xz') bone.scale.set(s, 1, s);
  }
}

// ═══════════════════════════════════════════════════════════════
//  アイテム定義
// ═══════════════════════════════════════════════════════════════
const HAIR_F_IDS = ['00','06','08','09','10','11','12','13','20','50'];
const HAIR_B_IDS = ['00','06','08','09','10','11','12','13','20','50'];
const HAIR_O_IDS = ['00','50'];
const TOP_IDS    = ['00','00_01','01','02','03','04','05','06','09','10','12','13','19','20','21','22','23','24','50','52','53','54','55'];
const BOT_IDS    = ['00','02','03','04','05','06','09','13','19','20','21','22','24','50','55'];
const BRA_IDS    = ['00','08','10','100','18','50','51','56'];
const GLOVE_IDS  = ['00','02','04','05','06','08','09','10','20','24','50','53'];
const PANST_IDS  = ['00','04','20','50','54'];
const SHOES_IDS  = ['00','01','02','04','05','06','09','10','12','13','19','20','21','22','24','50','53'];
const SHORTS_IDS = ['00','100','20','50','51'];
const SOCKS_IDS  = ['00','01','02','06','08','09','19','20','24','50','53'];
const JACKET_IDS = { a: ['00','06','10'], b: ['00','06','10','50'], c: ['00','06'] };
const SAILOR_IDS = { a: ['00','50'], b: ['00'], c: ['00','50'] };

function hairItems(prefix, ids) {
  return [
    { label: 'なし', url: null, thumb: null },
    ...ids.map(id => ({
      label: id,
      url:   `/models/bo_${prefix}_${id}.glb`,
      thumb: `/thumbs/p_cf_${prefix}_${id}.png`,
    })),
  ];
}

function clothesItems(prefix, ids) {
  return [
    { label: 'なし', url: null, thumb: null },
    ...ids.map(id => ({
      label: `No.${id}`,
      url:   `/models/${prefix}_${id}.glb`,
      thumb: null,
    })),
  ];
}

function hairThumbItems(prefix, ids) {
  return [
    { label: 'なし', thumb: null },
    ...ids.map(id => ({ label: id, thumb: `/thumbs/p_cf_${prefix}_${id}.png` })),
  ];
}

function faceThumbItems(prefix, ids) {
  return [
    { label: 'なし', thumb: null },
    ...ids.map(id => ({ label: id, thumb: `/thumbs/${prefix}_${id}.png` })),
  ];
}

const HAIR_S_IDS   = ['00']; // 実在するモデルのみ (bo_hair_s_00.glb)
const EYE_IDS      = Array.from({length: 18}, (_,i) => String(i).padStart(3,'0'));
const EYEBROW_IDS  = Array.from({length: 15}, (_,i) => String(i).padStart(3,'0'));
const EYELINE_IDS  = Array.from({length: 14}, (_,i) => String(i).padStart(3,'0'));
const MAKEUP_IDS   = ['02','03','04','05','06','07','08','09','10','11','12','13','14'];

const CATEGORIES = {
  body: {
    label: '体型',
    subs: [
      {
        key: 'body_shape', label: '体型', type: 'sliders',
        groups: [
          { group: '上半身', items: [
            { key: 'height',     label: '身長',      def: 0 },
            { key: 'head_size',  label: '頭の大きさ', def: 0 },
            { key: 'bust',       label: '胸の大きさ', def: 0 },
            { key: 'bust_soft',  label: '柔らかさ',   def: 0.5 },
            { key: 'waist',      label: 'ウエスト',   def: 0 },
            { key: 'shoulder',   label: '肩幅',       def: 0 },
          ]},
          { group: '下半身', items: [
            { key: 'hips',      label: 'ヒップ',   def: 0 },
            { key: 'leg_len',   label: '脚の長さ', def: 0 },
            { key: 'leg_thick', label: '脚の太さ', def: 0 },
          ]},
        ],
      },
    ],
  },
  face: {
    label: '顔',
    subs: [
      { key: 'head',    label: '輪郭',   type: 'parts', slot: 'head',
        items: [
          { label: 'なし',     url: null, thumb: null },
          { label: 'タイプ00', url: '/models/bo_head_00.glb', thumb: '/thumbs/p_cf_head_00.png' },
          { label: 'タイプ50', url: '/models/bo_head_50.glb', thumb: null },
        ],
      },
      { key: 'head_adjust', label: '輪郭調整', type: 'face_shape_panel' },
      { key: 'eye',      label: '目',         type: 'thumb_only',
        items: faceThumbItems('thumb_hitomi', EYE_IDS),
      },
      { key: 'eye_adjust', label: '目調整', type: 'eye_adjust_panel' },
      { key: 'eyebrow',  label: '眉',         type: 'thumb_only',
        items: faceThumbItems('thumb_mayuge', EYEBROW_IDS),
      },
      { key: 'eyebrow_adjust', label: '眉調整', type: 'eyebrow_adjust_panel' },
      { key: 'eyebrow_custom', label: '眉カスタム', type: 'bezier_editor' },
      { key: 'nose',        label: '鼻',       type: 'nose_panel' },
      { key: 'nose_adjust', label: '鼻調整', type: 'nose_adjust_panel' },
      { key: 'face_deco', label: '顔デコ',  type: 'face_deco_panel' },
      { key: 'mole',      label: 'ほくろ',  type: 'mole_panel' },
      { key: 'tattoo',    label: 'タトゥー', type: 'tattoo_panel' },
      { key: 'ear_acc',    label: '耳アクセ', type: 'ear_panel' },
      { key: 'ear_adjust', label: '耳調整',   type: 'ear_adjust_panel' },
      { key: 'mouth',      label: '口元',     type: 'mouth_panel' },
      { key: 'eyeline',  label: 'アイライン', type: 'thumb_only',
        items: [
          { label: 'なし', thumb: null },
          ...EYELINE_IDS.map(id => ({ label: id, thumb: `/thumbs/thumb_eyeline_up_${id}.png` })),
        ],
      },
      { key: 'makeup',   label: 'メイク',     type: 'thumb_only',
        items: [
          { label: 'なし', thumb: null },
          ...MAKEUP_IDS.map(id => ({ label: id, thumb: `/thumbs/thumb_face_paint_${id}.png` })),
        ],
      },
    ],
  },
  hair: {
    label: '髪型',
    subs: [
      { key: 'hair_front', label: '前髪',   type: 'parts', slot: 'hair_front', color: true,
        items: hairItems('hair_f', HAIR_F_IDS),
      },
      { key: 'hair_back',  label: '後ろ髪', type: 'parts', slot: 'hair_back',  color: true,
        items: hairItems('hair_b', HAIR_B_IDS),
      },
      { key: 'hair_ahoge', label: 'アホ毛', type: 'parts', slot: 'hair_ahoge', color: true,
        items: [
          { label: 'なし', url: null, thumb: null },
          ...HAIR_O_IDS.map(id => ({
            label: `No.${id}`, url: `/models/bo_hair_o_${id}.glb`, thumb: null,
          })),
        ],
      },
      { key: 'hair_side',  label: '横髪',   type: 'parts', slot: 'hair_side', color: true,
        items: hairItems('hair_s', HAIR_S_IDS),
      },
      { key: 'hair_acc_shine', label: '髪アクセ・ツヤ', type: 'hair_acc_shine' },
    ],
  },
  clothes: {
    label: '服装',
    subs: [
      { key: 'clothes_top',    label: 'トップス',   type: 'parts', slot: 'clothes_top',    color: true,
        items: clothesItems('co_top', TOP_IDS),
      },
      { key: 'clothes_bot',    label: 'ボトムス',   type: 'parts', slot: 'clothes_bot',    color: true,
        items: clothesItems('co_bot', BOT_IDS),
      },
      { key: 'clothes_bra',    label: 'ブラ',       type: 'parts', slot: 'clothes_bra',    color: true,
        items: clothesItems('co_bra', BRA_IDS),
      },
      { key: 'clothes_gloves', label: 'グローブ',   type: 'parts', slot: 'clothes_gloves', color: true,
        items: clothesItems('co_gloves', GLOVE_IDS),
      },
      { key: 'clothes_panst',  label: 'パンスト',   type: 'parts', slot: 'clothes_panst',  color: true,
        items: clothesItems('co_panst', PANST_IDS),
      },
      { key: 'clothes_shoes',  label: '靴',         type: 'parts', slot: 'clothes_shoes',  color: true,
        items: clothesItems('co_shoes', SHOES_IDS),
      },
      { key: 'clothes_shorts', label: 'ショーツ',   type: 'parts', slot: 'clothes_shorts', color: true,
        items: clothesItems('co_shorts', SHORTS_IDS),
      },
      { key: 'clothes_socks',  label: 'ソックス',   type: 'parts', slot: 'clothes_socks',  color: true,
        items: clothesItems('co_socks', SOCKS_IDS),
      },
      { key: 'jacket_a',       label: 'ジャケA',    type: 'parts', slot: 'jacket_a',       color: true,
        items: clothesItems('cpo_jacket_a', JACKET_IDS.a),
      },
      { key: 'jacket_b',       label: 'ジャケB',    type: 'parts', slot: 'jacket_b',       color: true,
        items: clothesItems('cpo_jacket_b', JACKET_IDS.b),
      },
      { key: 'jacket_c',       label: 'ジャケC',    type: 'parts', slot: 'jacket_c',       color: true,
        items: clothesItems('cpo_jacket_c', JACKET_IDS.c),
      },
      { key: 'sailor_a',       label: 'セーラーA',  type: 'parts', slot: 'sailor_a',       color: true,
        items: clothesItems('cpo_sailor_a', SAILOR_IDS.a),
      },
      { key: 'sailor_b',       label: 'セーラーB',  type: 'parts', slot: 'sailor_b',       color: true,
        items: clothesItems('cpo_sailor_b', SAILOR_IDS.b),
      },
      { key: 'sailor_c',       label: 'セーラーC',  type: 'parts', slot: 'sailor_c',       color: true,
        items: clothesItems('cpo_sailor_c', SAILOR_IDS.c),
      },
    ],
  },
  accessory: {
    label: 'アクセ',
    subs: [
      { key: 'neck',     label: '首',   type: 'neck_panel' },
      { key: 'shoulder', label: '肩',   type: 'shoulder_panel' },
      { key: 'arm',      label: '腕',   type: 'arm_panel' },
      { key: 'hand',     label: '手',   type: 'hand_panel' },
      { key: 'chest',    label: '胸元', type: 'chest_panel' },
      { key: 'navel',    label: 'へそ', type: 'navel_panel' },
      { key: 'groin',    label: '鼠径部', type: 'groin_panel' },
      { key: 'thigh',    label: '太もも', type: 'thigh_panel' },
      { key: 'ankle',    label: '足首', type: 'ankle_panel' },
      { key: 'foot',     label: '足',   type: 'foot_panel' },
      { key: 'acc', label: 'アクセサリー', type: 'thumb_only',
        items: (() => {
          const names = [
            '3rdeye','ahoge01','ahoge02','ahoge03','ahoge04','ahoge05',
            'aku01_tuno','beret','cat','ear_clover01','ear_flower01',
            'flower01','glasses01','glasses02','glasses03','hairpin01',
            'hairpin02','halo01','headband01','horn01','kemomimi01',
            'kemomimi02','ribbon01','ribbon02','tiara01','witch_hat',
          ];
          return [
            { label: 'なし', thumb: null },
            ...names.map(n => ({ label: n, thumb: `/thumbs/p_acs_${n}.png` })),
          ];
        })(),
      },
    ],
  },
  expression: {
    label: '表情',
    subs: [
      { key: 'expression_editor', label: '表情エディタ', type: 'expression_panel' },
    ],
  },
  pose: {
    label: 'ポーズ',
    subs: [
      { key: 'pose_editor', label: 'ポーズエディタ', type: 'pose_panel' },
    ],
  },
  param: {
    label: '設定',
    subs: [
      { key: 'chara_info', label: 'キャラ情報', type: 'info' },
    ],
  },
};

const HAIR_COLORS = [
  '#0a0500','#1a0a00','#3d2000','#5c3010','#8b5e3c','#c4956a','#f0c9a0','#ffddb0',
  '#ffffff','#f5e6c8','#ffd700','#ff8c00','#dc143c','#ff1493','#c71585','#8b008b',
  '#4b0082','#0000cd','#1e90ff','#00bfff','#3d3d3d','#696969','#a9a9a9','#d3d3d3',
];

// ═══════════════════════════════════════════════════════════════
//  UI 状態
// ═══════════════════════════════════════════════════════════════
let currentCat = 'face';
let currentSub = null;
const uiState  = {};

// ─── 髪アクセサリー状態 ──────────────────────────────────────
const hairAccState = {
  presetId: null,
  target: 'hair_front',
  color: '#ff88bb',
  pos: [0.0, 1.45, 0.0],
  rot: [0.0, 0.0, 0.0],
  scale: 1.0,
};

// ─── 髪ツヤ状態 ───────────────────────────────────────────────
const hairShineState = {
  preset: 'normal',
  roughness: 0.70,
  metalness: 0.00,
  envMapIntensity: 0.30,
};

// ─── 顔パーツ編集（FaceEditor） ──────────────────────────────
// head attach 後に faceEditor.reinitForHead() で初期化する
let faceEditor          = null;
// ─── 表情コントローラー ───────────────────────────────────────
// faceEditor の eye/eyebrow に表情デルタを重ね掛けする
let expressionController = null;
// ─── ポーズコントローラー ─────────────────────────────────────
let poseController = null;

// ═══════════════════════════════════════════════════════════════
//  UI 描画
// ═══════════════════════════════════════════════════════════════
function renderSubTabs(catKey) {
  const cat = CATEGORIES[catKey];
  if (!cat) return;
  const subTabsEl = document.getElementById('sub-tabs');
  subTabsEl.innerHTML = '';

  if (!currentSub || !cat.subs.find(s => s.key === currentSub)) {
    currentSub = cat.subs[0]?.key;
  }

  cat.subs.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'sub-tab' + (sub.key === currentSub ? ' active' : '');
    btn.textContent = sub.label;
    btn.addEventListener('click', () => {
      currentSub = sub.key;
      subTabsEl.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContent(sub);
    });
    subTabsEl.appendChild(btn);
  });

  const activeSub = cat.subs.find(s => s.key === currentSub);
  if (activeSub) renderContent(activeSub);
}

function renderContent(sub) {
  const area = document.getElementById('content-area');
  area.innerHTML = '';

  const colorPanel = document.getElementById('color-panel');
  colorPanel.classList.toggle('hidden', !sub.color);
  if (sub.color) buildColorPanel(sub.slot);

  switch (sub.type) {
    case 'parts':         buildPartsGrid(area, sub);   break;
    case 'thumb_only':    buildThumbGrid(area, sub);   break;
    case 'sliders':       buildSliderPanel(area, sub); break;
    case 'info':          buildInfoPanel(area);        break;
    case 'bezier_editor': buildBezierEditor(area);     break;
    case 'eye_adjust_panel':     buildEyeAdjustPanel(area);     break;
    case 'eyebrow_adjust_panel': buildEyebrowAdjustPanel(area); break;
    case 'nose_panel':           buildNosePanel(area);           break;
    case 'nose_adjust_panel':    buildNoseAdjustPanel(area);    break;
    case 'face_shape_panel':     buildFaceShapePanel(area);     break;
    case 'ear_adjust_panel':     buildEarAdjustPanel(area);     break;
    case 'expression_panel':     buildExpressionPanel(area);    break;
    case 'pose_panel':           buildPosePanel(area);          break;
    case 'face_deco_panel': buildFaceDecoPanel(area);  break;
    case 'mole_panel':      buildMolePanel(area);      break;
    case 'tattoo_panel':    buildTattooPanel(area);    break;
    case 'hair_acc_shine':  buildHairAccShinePanel(area); break;
    case 'ear_panel':       buildEarPanel(area);       break;
    case 'mouth_panel':     buildMouthPanel(area);     break;
    case 'neck_panel':      buildNeckPanel(area);      break;
    case 'shoulder_panel':  buildShoulderPanel(area);  break;
    case 'arm_panel':       buildArmPanel(area);       break;
    case 'hand_panel':      buildHandPanel(area);      break;
    case 'chest_panel':     buildChestPanel(area);     break;
    case 'navel_panel':     buildNavelPanel(area);     break;
    case 'groin_panel':     buildGroinPanel(area);     break;
    case 'thigh_panel':     buildThighPanel(area);     break;
    case 'ankle_panel':     buildAnklePanel(area);     break;
    case 'foot_panel':      buildFootPanel(area);      break;
  }
}

function buildPartsGrid(area, sub) {
  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  const selIdx = uiState[sub.key] ?? 0;

  sub.items.forEach((item, i) => {
    const cell = makeThumbCell(item, i === selIdx);
    cell.addEventListener('click', () => {
      uiState[sub.key] = i;
      grid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      if (character) {
        setLoading(true, `${sub.slot} 読込中...`);
        character.attach(sub.slot, item.url).then(() => {
          // グローバル非表示中なら新しく付けた服も非表示にする
          if (_globalClothesHidden && character.parts[sub.slot]) {
            _setGroupVisible(character.parts[sub.slot], false);
          }
          // head を付け替えたら顔コントローラを再初期化して調整値を再適用
          if (sub.slot === 'head' && faceEditor) {
            faceEditor.reinitForHead();
            faceEditor.applyAll();
          }
        }).finally(() => setLoading(false));
      }
    });
    grid.appendChild(cell);
  });
  area.appendChild(grid);
}

function buildThumbGrid(area, sub) {
  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  const selIdx = uiState[sub.key] ?? 0;

  sub.items.forEach((item, i) => {
    const cell = makeThumbCell(item, i === selIdx);
    cell.addEventListener('click', () => {
      uiState[sub.key] = i;
      grid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
    });
    grid.appendChild(cell);
  });
  area.appendChild(grid);
}

function makeThumbCell(item, selected) {
  const cell = document.createElement('div');
  cell.className = 'thumb-item' + (selected ? ' selected' : '');

  if (item.url === null && item.thumb === null) {
    cell.classList.add('thumb-none');
    cell.textContent = '×';
  } else if (item.thumb) {
    const img = document.createElement('img');
    img.src = item.thumb;
    img.loading = 'lazy';
    img.onerror = () => {
      img.style.display = 'none';
      cell.style.cssText += ';display:flex;align-items:center;justify-content:center;font-size:9px;color:#3a4060;';
      cell.textContent = item.label;
    };
    const lbl = document.createElement('div');
    lbl.className = 'thumb-label';
    lbl.textContent = item.label;
    cell.appendChild(img);
    cell.appendChild(lbl);
  } else {
    cell.style.cssText += ';display:flex;align-items:center;justify-content:center;font-size:10px;color:#7a8090;';
    cell.textContent = item.label;
  }
  return cell;
}

function buildSliderPanel(area, sub) {
  sub.groups.forEach(group => {
    const grpEl = document.createElement('div');
    grpEl.className = 'slider-group';
    const lbl = document.createElement('div');
    lbl.className = 'slider-group-label';
    lbl.textContent = group.group;
    grpEl.appendChild(lbl);

    group.items.forEach(sl => {
      const row = document.createElement('div');
      row.className = 'sl-row';
      const nm = document.createElement('span');
      nm.className = 'sl-name';
      nm.textContent = sl.label;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = -100; inp.max = 100; inp.step = 1;
      const currentVal = uiState[sl.key] ?? sl.def;
      inp.value = Math.round(currentVal * 100);
      const vl = document.createElement('span');
      vl.className = 'sl-val';
      vl.textContent = inp.value;
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value) / 100;
        uiState[sl.key] = v;
        vl.textContent = inp.value;
        applyBodyMorph(sl.key, v);
      });
      row.appendChild(nm);
      row.appendChild(inp);
      row.appendChild(vl);
      grpEl.appendChild(row);
    });
    area.appendChild(grpEl);
  });
}

function buildInfoPanel(area) {
  area.innerHTML = `
    <div class="slider-group">
      <div class="slider-group-label">キャラ名</div>
      <div class="sl-row">
        <input type="text" id="info-name"
          value="${document.getElementById('chara-name')?.value || '新しいキャラ'}"
          style="flex:1;background:#1e2236;border:1px solid #2a3050;border-radius:3px;
                 color:#eee;padding:4px 8px;font-size:12px;outline:none;" />
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="hbtn" id="info-save">保存 (JSON)</button>
      <button class="hbtn" id="info-load-btn">読込 (JSON)</button>
      <button class="hbtn red" id="info-init">初期化</button>
    </div>
    <div style="margin-top:16px;color:#3a4060;font-size:10px;line-height:1.6;">
      装着中のパーツ、体型スライダー、顔・服の選択状態を<br>
      JSONファイルに保存・読込できます。
    </div>
  `;
  document.getElementById('info-name')?.addEventListener('input', e => {
    const nameEl = document.getElementById('chara-name');
    if (nameEl) nameEl.value = e.target.value;
  });
  document.getElementById('info-save')?.addEventListener('click', saveJSON);
  document.getElementById('info-load-btn')?.addEventListener('click', loadJSONFromFile);
  document.getElementById('info-init')?.addEventListener('click', initAll);
}

// ═══════════════════════════════════════════════════════════════
//  目調整パネル
// ═══════════════════════════════════════════════════════════════

// スライダー定義: key / label / min / max / step
const EYE_SLIDERS = [
  { key: 'scale',    label: '目の大きさ', min: -100, max: 100, step: 1 },
  { key: 'posY',     label: '目の高さ',   min: -100, max: 100, step: 1 },
  { key: 'posX',     label: '左右位置',   min: -100, max: 100, step: 1 },
  { key: 'posZ',     label: '前後位置',   min: -100, max: 100, step: 1 },
  { key: 'rotation', label: '回転',       min: -180, max: 180, step: 1 },
];

function _initFaceEditorIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (character?.parts['head']) faceEditor.eye.init();
}

function _reapplyExpression() {
  expressionController?.applyState();
}

function _applyEyeState() {
  faceEditor?.eye.applyState();
  _reapplyExpression();
}

function _buildEyeSlidersSection(area, side) {
  // side: 'both' | 'left' | 'right'
  const params = faceEditor.eye.getState()[side];

  EYE_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min  = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = params[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      params[sl.key] = v;
      vl.textContent  = inp.value;
      _applyEyeState();
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });
}

function buildEyeAdjustPanel(area) {
  area.innerHTML = '';

  _initFaceEditorIfNeeded();
  const eyeState = faceEditor.eye.getState(); // ライブ参照

  // ── 左右同時編集チェックボックス ──────────────────────────
  const syncRow = document.createElement('div');
  syncRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';

  const chk = document.createElement('input');
  chk.type    = 'checkbox';
  chk.id      = 'eye-sync-lr';
  chk.checked = eyeState.syncLR;
  chk.style.accentColor = 'var(--accent)';

  const chkLbl = document.createElement('label');
  chkLbl.htmlFor   = 'eye-sync-lr';
  chkLbl.textContent = '左右同時編集';
  chkLbl.style.cssText = 'cursor:pointer;font-size:13px;';

  syncRow.appendChild(chk);
  syncRow.appendChild(chkLbl);
  area.appendChild(syncRow);

  // ── スライダーエリア（syncLR に応じて再描画）───────────────
  const sliderArea = document.createElement('div');
  area.appendChild(sliderArea);

  function renderSliders() {
    sliderArea.innerHTML = '';
    if (eyeState.syncLR) {
      _buildEyeSlidersSection(sliderArea, 'both');
    } else {
      const lblL = document.createElement('div');
      lblL.className = 'nose-sep';
      lblL.textContent = '左目';
      sliderArea.appendChild(lblL);
      _buildEyeSlidersSection(sliderArea, 'left');

      const lblR = document.createElement('div');
      lblR.className = 'nose-sep';
      lblR.textContent = '右目';
      sliderArea.appendChild(lblR);
      _buildEyeSlidersSection(sliderArea, 'right');
    }
  }

  chk.addEventListener('change', () => {
    eyeState.syncLR = chk.checked;
    renderSliders();
  });

  renderSliders();

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '10px';
  resetBtn.textContent  = '目調整リセット';
  resetBtn.addEventListener('click', () => {
    faceEditor.eye.resetState();
    renderSliders();
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  眉調整パネル
// ═══════════════════════════════════════════════════════════════

const EYEBROW_SLIDERS = [
  { key: 'posY',      label: '眉の高さ',   min: -100, max: 100, step: 1 },
  { key: 'posX',      label: '眉の左右位置', min: -100, max: 100, step: 1 },
  { key: 'posZ',      label: '眉の前後位置', min: -100, max: 100, step: 1 },
  { key: 'rotation',  label: '眉の角度',   min: -180, max: 180, step: 1 },
  { key: 'scale',     label: '眉の大きさ', min: -100, max: 100, step: 1 },
  { key: 'thickness', label: '眉の太さ',   min: -100, max: 100, step: 1 },
];

function _initEyebrowIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (character?.parts['head']) faceEditor.eyebrow.init();
}

function _applyEyebrowState() {
  faceEditor?.eyebrow.applyState();
  _reapplyExpression();
}

function _buildEyebrowSlidersSection(area, side) {
  const params = faceEditor.eyebrow.getState()[side];

  EYEBROW_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = params[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      params[sl.key] = v;
      vl.textContent  = inp.value;
      _applyEyebrowState();
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });
}

function buildEyebrowAdjustPanel(area) {
  area.innerHTML = '';

  _initEyebrowIfNeeded();
  const eyebrowState = faceEditor.eyebrow.getState(); // ライブ参照

  // ── 左右同時編集チェックボックス ──────────────────────────
  const syncRow = document.createElement('div');
  syncRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';

  const chk = document.createElement('input');
  chk.type    = 'checkbox';
  chk.id      = 'eyebrow-sync-lr';
  chk.checked = eyebrowState.syncLR;
  chk.style.accentColor = 'var(--accent)';

  const chkLbl = document.createElement('label');
  chkLbl.htmlFor    = 'eyebrow-sync-lr';
  chkLbl.textContent = '左右同時編集';
  chkLbl.style.cssText = 'cursor:pointer;font-size:13px;';

  syncRow.appendChild(chk);
  syncRow.appendChild(chkLbl);
  area.appendChild(syncRow);

  // ── スライダーエリア（syncLR に応じて再描画）───────────────
  const sliderArea = document.createElement('div');
  area.appendChild(sliderArea);

  function renderSliders() {
    sliderArea.innerHTML = '';
    if (eyebrowState.syncLR) {
      _buildEyebrowSlidersSection(sliderArea, 'both');
    } else {
      const lblL = document.createElement('div');
      lblL.className = 'nose-sep';
      lblL.textContent = '左眉';
      sliderArea.appendChild(lblL);
      _buildEyebrowSlidersSection(sliderArea, 'left');

      const lblR = document.createElement('div');
      lblR.className = 'nose-sep';
      lblR.textContent = '右眉';
      sliderArea.appendChild(lblR);
      _buildEyebrowSlidersSection(sliderArea, 'right');
    }
  }

  chk.addEventListener('change', () => {
    eyebrowState.syncLR = chk.checked;
    renderSliders();
  });

  renderSliders();

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '10px';
  resetBtn.textContent  = '眉調整リセット';
  resetBtn.addEventListener('click', () => {
    faceEditor.eyebrow.resetState();
    renderSliders();
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  鼻調整パネル（NoseController）
// ═══════════════════════════════════════════════════════════════
const NOSE_ADJUST_SLIDERS = [
  { key: 'scale',       label: '鼻の大きさ',   min: -100, max: 100, step: 1 },
  { key: 'posY',        label: '鼻の高さ',     min: -100, max: 100, step: 1 },
  { key: 'width',       label: '鼻の幅',       min: -100, max: 100, step: 1 },
  { key: 'posZ',        label: '鼻の前後位置', min: -100, max: 100, step: 1 },
  { key: 'bridgeHeight',label: '鼻筋の高さ',   min: -100, max: 100, step: 1 },
  { key: 'tipScale',    label: '鼻先の大きさ', min: -100, max: 100, step: 1 },
  { key: 'rotation',    label: '鼻の角度',     min: -180, max: 180, step: 1 },
];

function _initNoseIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (character?.parts['head']) faceEditor.nose.init();
}

function _applyNoseState() {
  faceEditor?.nose.applyState();
}

function buildNoseAdjustPanel(area) {
  area.innerHTML = '';

  _initNoseIfNeeded();
  const noseState = faceEditor.nose.getState(); // ライブ参照

  const params = noseState.params;

  // ── スライダー ──────────────────────────────────────────────
  NOSE_ADJUST_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = params[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      params[sl.key] = parseFloat(inp.value);
      vl.textContent  = inp.value;
      _applyNoseState();
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '10px';
  resetBtn.textContent  = '鼻調整リセット';
  resetBtn.addEventListener('click', () => {
    faceEditor.nose.resetState();
    // スライダーを再描画するためパネルを再構築
    buildNoseAdjustPanel(area);
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  輪郭調整パネル（FaceShapeController）
// ═══════════════════════════════════════════════════════════════
const FACE_SHAPE_SLIDERS = [
  { key: 'faceWidth',     label: '顔の横幅',  min: -100, max: 100, step: 1 },
  { key: 'faceHeight',    label: '顔の縦幅',  min: -100, max: 100, step: 1 },
  { key: 'chinLength',    label: '顎の長さ',  min: -100, max: 100, step: 1 },
  { key: 'chinSharp',     label: '顎の尖り',  min: -100, max: 100, step: 1 },
  { key: 'cheekRound',    label: '頬の丸み',  min: -100, max: 100, step: 1 },
  { key: 'cheekBone',     label: '頬骨',      min: -100, max: 100, step: 1 },
  { key: 'jawAngle',      label: 'エラ',      min: -100, max: 100, step: 1 },
  { key: 'foreheadWidth', label: '額の広さ',  min: -100, max: 100, step: 1 },
];

function _initFaceShapeIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (character?.parts['head']) faceEditor.faceShape.init();
}

function _applyFaceShapeState() {
  faceEditor?.faceShape.applyState();
}

function buildFaceShapePanel(area) {
  area.innerHTML = '';

  _initFaceShapeIfNeeded();
  const params = faceEditor.faceShape.getState().params; // ライブ参照

  FACE_SHAPE_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = params[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      params[sl.key] = parseFloat(inp.value);
      vl.textContent  = inp.value;
      _applyFaceShapeState();
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });

  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '10px';
  resetBtn.textContent  = '輪郭調整リセット';
  resetBtn.addEventListener('click', () => {
    faceEditor.faceShape.resetState();
    buildFaceShapePanel(area);
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  耳調整パネル（EarController）
// ═══════════════════════════════════════════════════════════════
const EAR_ADJUST_SLIDERS = [
  { key: 'scale',  label: '耳の大きさ',      min: -100, max: 100, step: 1 },
  { key: 'posY',   label: '耳の高さ',        min: -100, max: 100, step: 1 },
  { key: 'posZ',   label: '耳の前後位置',    min: -100, max: 100, step: 1 },
  { key: 'posX',   label: '耳の左右位置',    min: -100, max: 100, step: 1 },
  { key: 'rotX',   label: '耳の角度（前後）', min: -180, max: 180, step: 1 },
  { key: 'rotY',   label: '耳の角度（左右）', min: -180, max: 180, step: 1 },
  { key: 'spread', label: '耳の開き',        min: -100, max: 100, step: 1 },
];

function _initEarIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (character?.parts['head']) faceEditor.ear.init();
}

function _applyEarState() {
  faceEditor?.ear.applyState();
}

function _buildEarSlidersSection(area, side) {
  const params = faceEditor.ear.getState()[side];

  EAR_ADJUST_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = params[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      params[sl.key] = parseFloat(inp.value);
      vl.textContent  = inp.value;
      _applyEarState();
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });
}

function buildEarAdjustPanel(area) {
  area.innerHTML = '';

  _initEarIfNeeded();
  const earState = faceEditor.ear.getState(); // ライブ参照

  // ── 左右同時編集チェックボックス ──────────────────────────
  const syncRow = document.createElement('div');
  syncRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';

  const chk = document.createElement('input');
  chk.type    = 'checkbox';
  chk.id      = 'ear-sync-lr';
  chk.checked = earState.syncLR;
  chk.style.accentColor = 'var(--accent)';

  const chkLbl = document.createElement('label');
  chkLbl.htmlFor    = 'ear-sync-lr';
  chkLbl.textContent = '左右同時編集';
  chkLbl.style.cssText = 'cursor:pointer;font-size:13px;';

  syncRow.appendChild(chk);
  syncRow.appendChild(chkLbl);
  area.appendChild(syncRow);

  // ── スライダーエリア（syncLR に応じて再描画）───────────────
  const sliderArea = document.createElement('div');
  area.appendChild(sliderArea);

  function renderSliders() {
    sliderArea.innerHTML = '';
    if (earState.syncLR) {
      _buildEarSlidersSection(sliderArea, 'both');
    } else {
      const lblL = document.createElement('div');
      lblL.className = 'nose-sep';
      lblL.textContent = '左耳';
      sliderArea.appendChild(lblL);
      _buildEarSlidersSection(sliderArea, 'left');

      const lblR = document.createElement('div');
      lblR.className = 'nose-sep';
      lblR.textContent = '右耳';
      sliderArea.appendChild(lblR);
      _buildEarSlidersSection(sliderArea, 'right');
    }
  }

  chk.addEventListener('change', () => {
    earState.syncLR = chk.checked;
    renderSliders();
  });

  renderSliders();

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '10px';
  resetBtn.textContent  = '耳調整リセット';
  resetBtn.addEventListener('click', () => {
    faceEditor.ear.resetState();
    renderSliders();
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  鼻パネル（形プリセット＋サイズスライダー）
// ═══════════════════════════════════════════════════════════════
const NOSE_SHAPES = [
  {
    label: '自然',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.42, h*0.25);
      ctx.bezierCurveTo(w*0.38, h*0.55, w*0.28, h*0.65, w*0.30, h*0.75);
      ctx.bezierCurveTo(w*0.38, h*0.82, w*0.62, h*0.82, w*0.70, h*0.75);
      ctx.bezierCurveTo(w*0.72, h*0.65, w*0.62, h*0.55, w*0.58, h*0.25);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.5, h*0.72, w*0.07, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke();
    },
  },
  {
    label: '小さめ',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.44, h*0.35);
      ctx.bezierCurveTo(w*0.41, h*0.58, w*0.32, h*0.65, w*0.34, h*0.73);
      ctx.bezierCurveTo(w*0.40, h*0.78, w*0.60, h*0.78, w*0.66, h*0.73);
      ctx.bezierCurveTo(w*0.68, h*0.65, w*0.59, h*0.58, w*0.56, h*0.35);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.5, h*0.70, w*0.055, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke();
    },
  },
  {
    label: '高め',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.43, h*0.18);
      ctx.bezierCurveTo(w*0.38, h*0.50, w*0.26, h*0.62, w*0.28, h*0.76);
      ctx.bezierCurveTo(w*0.37, h*0.84, w*0.63, h*0.84, w*0.72, h*0.76);
      ctx.bezierCurveTo(w*0.74, h*0.62, w*0.62, h*0.50, w*0.57, h*0.18);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.5, h*0.74, w*0.08, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke();
    },
  },
  {
    label: '丸み',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.43, h*0.30);
      ctx.bezierCurveTo(w*0.38, h*0.52, w*0.24, h*0.62, w*0.26, h*0.74);
      ctx.bezierCurveTo(w*0.34, h*0.84, w*0.66, h*0.84, w*0.74, h*0.74);
      ctx.bezierCurveTo(w*0.76, h*0.62, w*0.62, h*0.52, w*0.57, h*0.30);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.5, h*0.73, w*0.10, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke();
    },
  },
  {
    label: '細め',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.46, h*0.22);
      ctx.bezierCurveTo(w*0.43, h*0.52, w*0.34, h*0.63, w*0.36, h*0.74);
      ctx.bezierCurveTo(w*0.42, h*0.80, w*0.58, h*0.80, w*0.64, h*0.74);
      ctx.bezierCurveTo(w*0.66, h*0.63, w*0.57, h*0.52, w*0.54, h*0.22);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(w*0.5, h*0.71, w*0.055, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke();
    },
  },
  {
    label: '上向き',
    draw(ctx, w, h) {
      ctx.beginPath();
      ctx.moveTo(w*0.43, h*0.30);
      ctx.bezierCurveTo(w*0.38, h*0.55, w*0.27, h*0.58, w*0.30, h*0.68);
      ctx.bezierCurveTo(w*0.38, h*0.76, w*0.62, h*0.76, w*0.70, h*0.68);
      ctx.bezierCurveTo(w*0.73, h*0.58, w*0.62, h*0.55, w*0.57, h*0.30);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
      // 鼻孔が上向き
      ctx.save(); ctx.translate(w*0.38, h*0.66); ctx.rotate(-0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, w*0.055, w*0.035, 0, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(w*0.62, h*0.66); ctx.rotate(0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, w*0.055, w*0.035, 0, 0, Math.PI*2);
      ctx.strokeStyle = '#c8a080'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    },
  },
];

const NOSE_SLIDERS = [
  { key: 'nose_size',   label: '大きさ',      def: 0 },
  { key: 'nose_height', label: '高さ',        def: 0 },
  { key: 'nose_width',  label: '幅',          def: 0 },
  { key: 'nose_tip',    label: '先端の大きさ', def: 0 },
  { key: 'nose_bridge', label: '鼻筋の高さ',  def: 0 },
];

function buildNosePanel(area) {
  area.innerHTML = '';

  // ── 形プリセット ──────────────────────────────
  const shapeSep = document.createElement('div');
  shapeSep.className = 'nose-sep';
  shapeSep.textContent = '形のプリセット';
  area.appendChild(shapeSep);

  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  let selShape = uiState.nose_shape ?? 0;

  NOSE_SHAPES.forEach((shape, i) => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item' + (i === selShape ? ' selected' : '');
    cell.style.background = '#0d0f18';

    const cvs = document.createElement('canvas');
    cvs.width = 72; cvs.height = 72;
    cvs.style.cssText = 'width:100%;height:100%;display:block;';
    const ctx = cvs.getContext('2d');
    shape.draw(ctx, 72, 72);

    const lbl = document.createElement('div');
    lbl.className = 'thumb-label';
    lbl.textContent = shape.label;

    cell.appendChild(cvs);
    cell.appendChild(lbl);
    cell.addEventListener('click', () => {
      uiState.nose_shape = i;
      selShape = i;
      grid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
    });
    grid.appendChild(cell);
  });
  area.appendChild(grid);

  // ── サイズ・形状スライダー ───────────────────
  const sliderSep = document.createElement('div');
  sliderSep.className = 'nose-sep';
  sliderSep.textContent = 'サイズ調整';
  area.appendChild(sliderSep);

  NOSE_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';
    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = -100; inp.max = 100; inp.step = 1;
    const cur = uiState[sl.key] ?? sl.def;
    inp.value = Math.round(cur * 100);
    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value) / 100;
      uiState[sl.key] = v;
      vl.textContent = inp.value;
      applyBodyMorph(sl.key, v);
    });
    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });

  // リセットボタン
  const resetBtn = document.createElement('button');
  resetBtn.className = 'hbtn';
  resetBtn.style.marginTop = '8px';
  resetBtn.textContent = 'リセット';
  resetBtn.addEventListener('click', () => {
    NOSE_SLIDERS.forEach(sl => {
      uiState[sl.key] = sl.def;
      applyBodyMorph(sl.key, sl.def);
    });
    buildNosePanel(area);
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  顔デコ (30種 Canvas 描画アイテム)
// ═══════════════════════════════════════════════════════════════
const FACE_DECOS = [
  // ── そばかす ──
  { group: 'そばかす', label: '軽め', draw(ctx, w, h) {
    ctx.fillStyle = '#b0603560';
    [[.38,.42],[.62,.42],[.42,.40],[.58,.40],[.36,.46],[.64,.46]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w, y*h, 2.5, 0, Math.PI*2); ctx.fill();
    });
  }},
  { group: 'そばかす', label: 'ナチュラル', draw(ctx, w, h) {
    ctx.fillStyle = '#a06030';
    [[.32,.40],[.35,.44],[.38,.42],[.40,.46],[.43,.40],[.45,.44],
     [.55,.44],[.57,.40],[.60,.46],[.62,.42],[.65,.44],[.68,.40]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w, y*h, 1.8, 0, Math.PI*2); ctx.fill();
    });
  }},
  { group: 'そばかす', label: '濃いめ', draw(ctx, w, h) {
    ctx.fillStyle = '#80401c';
    [[.27,.38],[.30,.42],[.33,.40],[.36,.44],[.39,.42],[.41,.46],[.43,.40],[.45,.44],
     [.55,.44],[.57,.40],[.59,.46],[.61,.42],[.64,.44],[.67,.40],[.70,.42],[.73,.38]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w, y*h, 2, 0, Math.PI*2); ctx.fill();
    });
  }},
  { group: 'そばかす', label: 'サイド', draw(ctx, w, h) {
    ctx.fillStyle = '#a06030';
    [[.16,.44],[.20,.48],[.18,.52],[.14,.50],[.82,.44],[.84,.48],[.82,.52],[.86,.50]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w, y*h, 2, 0, Math.PI*2); ctx.fill();
    });
  }},
  { group: 'そばかす', label: '鼻周り', draw(ctx, w, h) {
    ctx.fillStyle = '#905030';
    [[.40,.52],[.43,.55],[.46,.53],[.50,.54],[.54,.53],[.57,.55],[.60,.52]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w, y*h, 2, 0, Math.PI*2); ctx.fill();
    });
  }},
  { group: 'そばかす', label: '全体', draw(ctx, w, h) {
    ctx.fillStyle = '#904030';
    for (let i = 0; i < 22; i++) {
      const x = 0.22 + ((Math.sin(i*2.7+1)*0.5+0.5)*0.56);
      const y = 0.33 + ((Math.cos(i*1.6+0.5)*0.5+0.5)*0.36);
      ctx.beginPath(); ctx.arc(x*w, y*h, 1.5, 0, Math.PI*2); ctx.fill();
    }
  }},
  // ── チーク ──
  { group: 'チーク', label: '丸チーク', draw(ctx, w, h) {
    [[.28,.55],[.72,.55]].forEach(([cx,cy]) => {
      const g = ctx.createRadialGradient(cx*w,cy*h,0,cx*w,cy*h,w*.16);
      g.addColorStop(0,'rgba(255,130,130,0.65)'); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  }},
  { group: 'チーク', label: '楕円チーク', draw(ctx, w, h) {
    ctx.globalAlpha = 0.55;
    [[.27,.55,-0.3],[.73,.55,0.3]].forEach(([cx,cy,rot]) => {
      ctx.save(); ctx.translate(cx*w, cy*h); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, 0, w*.16, h*.09, 0, 0, Math.PI*2);
      ctx.fillStyle = '#ff9090'; ctx.fill(); ctx.restore();
    });
    ctx.globalAlpha = 1;
  }},
  { group: 'チーク', label: 'ハートチーク', draw(ctx, w, h) {
    function heart(cx, cy, s) {
      ctx.beginPath(); ctx.moveTo(cx, cy+s*.3);
      ctx.bezierCurveTo(cx-s,cy-s*.4, cx-s*1.4,cy+s*.6, cx,cy+s*1.2);
      ctx.bezierCurveTo(cx+s*1.4,cy+s*.6, cx+s,cy-s*.4, cx,cy+s*.3);
      ctx.fillStyle = 'rgba(255,100,140,0.6)'; ctx.fill();
    }
    heart(w*.28, h*.52, w*.07); heart(w*.72, h*.52, w*.07);
  }},
  { group: 'チーク', label: '三角チーク', draw(ctx, w, h) {
    ctx.globalAlpha = 0.55;
    [[w*.28,h*.53],[w*.72,h*.53]].forEach(([cx,cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy-h*.09); ctx.lineTo(cx+w*.10, cy+h*.055); ctx.lineTo(cx-w*.10, cy+h*.055);
      ctx.closePath(); ctx.fillStyle = '#ff9090'; ctx.fill();
    });
    ctx.globalAlpha = 1;
  }},
  { group: 'チーク', label: '横ライン', draw(ctx, w, h) {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(w*.25, h*(.51+i*.03), w*.14, h*.01, 0, 0, Math.PI*2);
      ctx.fillStyle = '#ffaaaa'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(w*.75, h*(.51+i*.03), w*.14, h*.01, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }},
  { group: 'チーク', label: '花チーク', draw(ctx, w, h) {
    [[w*.28,h*.54],[w*.72,h*.54]].forEach(([cx,cy]) => {
      for (let a = 0; a < Math.PI*2; a += Math.PI/3) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, -w*.07, w*.03, w*.07, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,160,160,0.7)'; ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, cy, w*.025, 0, Math.PI*2);
      ctx.fillStyle = '#ffcc88'; ctx.fill();
    });
  }},
  // ── マーク ──
  { group: 'マーク', label: '★スター', draw(ctx, w, h) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i*Math.PI/5) - Math.PI/2, r = i%2===0 ? w*.18 : w*.07;
      i===0 ? ctx.moveTo(w*.5+Math.cos(a)*r, h*.45+Math.sin(a)*r)
             : ctx.lineTo(w*.5+Math.cos(a)*r, h*.45+Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fillStyle = '#ffd700'; ctx.fill();
  }},
  { group: 'マーク', label: '♥ハート', draw(ctx, w, h) {
    const cx=w*.5, cy=h*.48, s=w*.16;
    ctx.beginPath(); ctx.moveTo(cx, cy+s*.3);
    ctx.bezierCurveTo(cx-s,cy-s*.4, cx-s*1.4,cy+s*.6, cx,cy+s*1.2);
    ctx.bezierCurveTo(cx+s*1.4,cy+s*.6, cx+s,cy-s*.4, cx,cy+s*.3);
    ctx.fillStyle = '#ff4466'; ctx.fill();
  }},
  { group: 'マーク', label: '◆ダイヤ', draw(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(w*.5,h*.28); ctx.lineTo(w*.70,h*.50); ctx.lineTo(w*.5,h*.72); ctx.lineTo(w*.30,h*.50);
    ctx.closePath(); ctx.fillStyle = '#88ddff'; ctx.fill();
    ctx.strokeStyle = '#44aaee'; ctx.lineWidth = 1.5; ctx.stroke();
  }},
  { group: 'マーク', label: '✕クロス', draw(ctx, w, h) {
    ctx.strokeStyle = '#ff6060'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*.34,h*.34); ctx.lineTo(w*.66,h*.66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.66,h*.34); ctx.lineTo(w*.34,h*.66); ctx.stroke();
  }},
  { group: 'マーク', label: '〇リング', draw(ctx, w, h) {
    ctx.beginPath(); ctx.arc(w*.5, h*.5, w*.22, 0, Math.PI*2);
    ctx.strokeStyle = '#8888ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(w*.5, h*.5, w*.13, 0, Math.PI*2);
    ctx.strokeStyle = '#aaaaff'; ctx.lineWidth = 2; ctx.stroke();
  }},
  { group: 'マーク', label: '✦星座', draw(ctx, w, h) {
    [[.28,.43,w*.065],[.50,.35,w*.055],[.72,.43,w*.065],[.35,.58,w*.05],[.65,.58,w*.05]].forEach(([x,y,r]) => {
      ctx.beginPath();
      for (let i=0;i<10;i++) {
        const a=(i*Math.PI/5)-Math.PI/2, ir=i%2===0?r:r*.4;
        i===0?ctx.moveTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir):ctx.lineTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir);
      }
      ctx.closePath(); ctx.fillStyle = '#ffeea0'; ctx.fill();
    });
  }},
  // ── 傷 ──
  { group: '傷', label: '一文字', draw(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255,150,130,0.4)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*.28, h*.45); ctx.lineTo(w*.72, h*.45); ctx.stroke();
    ctx.strokeStyle = '#c06050'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(w*.28, h*.45); ctx.lineTo(w*.72, h*.45); ctx.stroke();
  }},
  { group: '傷', label: '斜め傷', draw(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255,150,130,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*.36, h*.28); ctx.lineTo(w*.58, h*.64); ctx.stroke();
    ctx.strokeStyle = '#c06050'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(w*.36, h*.28); ctx.lineTo(w*.58, h*.64); ctx.stroke();
  }},
  { group: '傷', label: 'バツ傷', draw(ctx, w, h) {
    ctx.strokeStyle = '#b05040'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    [[w*.30,h*.30,w*.58,h*.60],[w*.58,h*.30,w*.30,h*.60]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  }},
  { group: '傷', label: '縫い目', draw(ctx, w, h) {
    ctx.strokeStyle = '#804040'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*.20, h*.50); ctx.lineTo(w*.80, h*.50); ctx.stroke();
    for (let x = .23; x < .79; x += .07) {
      ctx.beginPath(); ctx.moveTo(x*w, h*.46); ctx.lineTo((x+.035)*w, h*.54); ctx.stroke();
    }
  }},
  { group: '傷', label: '古傷', draw(ctx, w, h) {
    ctx.strokeStyle = '#d09a88'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*.40,h*.30); ctx.bezierCurveTo(w*.36,h*.44,w*.44,h*.52,w*.40,h*.66); ctx.stroke();
    ctx.strokeStyle = '#a07060'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*.40,h*.30); ctx.bezierCurveTo(w*.36,h*.44,w*.44,h*.52,w*.40,h*.66); ctx.stroke();
  }},
  { group: '傷', label: 'ひっかき', draw(ctx, w, h) {
    ctx.strokeStyle = '#c07060'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    [[.26,.36,.74,.50],[.28,.47,.72,.58],[.24,.58,.68,.66]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1*w,y1*h); ctx.lineTo(x2*w,y2*h); ctx.stroke();
    });
  }},
  // ── その他 ──
  { group: 'その他', label: 'バンドエイド', draw(ctx, w, h) {
    ctx.save(); ctx.translate(w*.5, h*.46); ctx.rotate(-0.2);
    ctx.fillStyle = '#f0c090'; ctx.strokeStyle = '#d0a070'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(-w*.20, -h*.07, w*.40, h*.14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dea870';
    ctx.fillRect(-w*.09,-h*.07,w*.05,h*.14); ctx.fillRect(w*.04,-h*.07,w*.05,h*.14);
    ctx.fillStyle = '#c09060';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i*w*.025,0,1.5,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }},
  { group: 'その他', label: '涙マーク', draw(ctx, w, h) {
    ctx.fillStyle = '#70aaff';
    ctx.beginPath(); ctx.arc(w*.5, h*.40, w*.12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w*.50, h*.52);
    ctx.bezierCurveTo(w*.42,h*.60, w*.42,h*.70, w*.50,h*.72);
    ctx.bezierCurveTo(w*.58,h*.70, w*.58,h*.60, w*.50,h*.52);
    ctx.fill();
  }},
  { group: 'その他', label: '部族マーク', draw(ctx, w, h) {
    ctx.strokeStyle = '#2040a0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w*.5,h*.26); ctx.lineTo(w*.66,h*.50); ctx.lineTo(w*.5,h*.74); ctx.lineTo(w*.34,h*.50); ctx.closePath();
    ctx.stroke();
    [[w*.34,h*.50,w*.14,h*.42],[w*.34,h*.50,w*.14,h*.58],[w*.66,h*.50,w*.86,h*.42],[w*.66,h*.50,w*.86,h*.58]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  }},
  { group: 'その他', label: '渦巻き', draw(ctx, w, h) {
    ctx.strokeStyle = '#8844aa'; ctx.lineWidth = 2; ctx.beginPath();
    for (let a = 0; a < Math.PI*4; a += 0.08) {
      const r = a*w*.024, x = w*.5+Math.cos(a)*r, y = h*.5+Math.sin(a)*r;
      a===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
  }},
  { group: 'その他', label: '花びら', draw(ctx, w, h) {
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 - Math.PI/2;
      ctx.save(); ctx.translate(w*.5,h*.5); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0,-w*.11,w*.07,w*.11,0,0,Math.PI*2);
      ctx.fillStyle = `hsl(${i*60},70%,75%)`; ctx.globalAlpha = 0.8; ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(w*.5,h*.5,w*.045,0,Math.PI*2); ctx.fillStyle = '#ffee88'; ctx.fill();
  }},
  { group: 'その他', label: 'ドット群', draw(ctx, w, h) {
    ctx.fillStyle = '#5577cc';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      ctx.beginPath(); ctx.arc(w*(.20+c*.15), h*(.28+r*.11), 2.5, 0, Math.PI*2); ctx.fill();
    }
  }},
];

const faceDecoState = { selIdx: -1 };

function buildFaceDecoPanel(area) {
  area.innerHTML = '';
  const groups = [...new Set(FACE_DECOS.map(d => d.group))];
  groups.forEach(grp => {
    const sep = document.createElement('div');
    sep.className = 'nose-sep'; sep.textContent = grp;
    area.appendChild(sep);

    const grid = document.createElement('div');
    grid.className = 'thumb-grid';
    FACE_DECOS.forEach((deco, i) => {
      if (deco.group !== grp) return;
      const cell = document.createElement('div');
      cell.className = 'thumb-item' + (i === faceDecoState.selIdx ? ' selected' : '');
      cell.style.background = '#0d0f18';
      const cvs = document.createElement('canvas');
      cvs.width = 72; cvs.height = 72;
      cvs.style.cssText = 'width:100%;height:100%;display:block;';
      deco.draw(cvs.getContext('2d'), 72, 72);
      const lbl = document.createElement('div');
      lbl.className = 'thumb-label'; lbl.textContent = deco.label;
      cell.appendChild(cvs); cell.appendChild(lbl);
      cell.addEventListener('click', () => {
        faceDecoState.selIdx = i;
        area.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
      });
      grid.appendChild(cell);
    });
    area.appendChild(grid);
  });
}

// ═══════════════════════════════════════════════════════════════
//  共通：顔ガイド描画
// ═══════════════════════════════════════════════════════════════
function drawFaceGuide(ctx, w, h) {
  ctx.beginPath();
  ctx.ellipse(w*.5, h*.46, w*.37, h*.44, 0, 0, Math.PI*2);
  ctx.strokeStyle = '#2a3050'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = '#1e2438'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*.18, h*.37); ctx.lineTo(w*.82, h*.37); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*.36, h*.55); ctx.lineTo(w*.64, h*.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*.36, h*.67); ctx.lineTo(w*.64, h*.67); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#1e2438'; ctx.font = '8px sans-serif';
  ctx.fillText('目', w*.84, h*.39); ctx.fillText('鼻', w*.66, h*.57); ctx.fillText('口', w*.66, h*.69);
}

// ═══════════════════════════════════════════════════════════════
//  ほくろパネル
// ═══════════════════════════════════════════════════════════════
const MOLE_CW = 240, MOLE_CH = 300;

const MOLE_SHAPES = [
  { label: '丸', draw(ctx, cx, cy, r, color) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
  }},
  { label: '雫', draw(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r*1.2);
    ctx.bezierCurveTo(cx+r, cy-r*.5, cx+r*.8, cy+r, cx, cy+r*1.2);
    ctx.bezierCurveTo(cx-r*.8, cy+r, cx-r, cy-r*.5, cx, cy-r*1.2);
    ctx.fillStyle = color; ctx.fill();
  }},
  { label: '楕円', draw(ctx, cx, cy, r, color) {
    ctx.beginPath(); ctx.ellipse(cx, cy, r*.65, r, 0, 0, Math.PI*2); ctx.fillStyle = color; ctx.fill();
  }},
  { label: '小豆', draw(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy-r);
    ctx.bezierCurveTo(cx+r, cy-r*.4, cx+r, cy+r*.4, cx, cy+r);
    ctx.bezierCurveTo(cx-r, cy+r*.4, cx-r, cy-r*.4, cx, cy-r);
    ctx.fillStyle = color; ctx.fill();
  }},
];

const moleState = { list: [], selIdx: -1, newShape: 0, newSize: 6, newColor: '#1a0a00' };

function redrawMoleCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, MOLE_CW, MOLE_CH);
  drawFaceGuide(ctx, MOLE_CW, MOLE_CH);
  moleState.list.forEach((m, i) => {
    MOLE_SHAPES[m.shape].draw(ctx, m.x, m.y, m.size, m.color);
    if (i === moleState.selIdx) {
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size+4, 0, Math.PI*2);
      ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  });
}

function buildMolePanel(area) {
  area.innerHTML = '';

  const placeSep = document.createElement('div');
  placeSep.className = 'nose-sep'; placeSep.textContent = '配置エリア（クリックで追加）';
  area.appendChild(placeSep);

  const cvs = document.createElement('canvas');
  cvs.width = MOLE_CW; cvs.height = MOLE_CH;
  cvs.style.cssText = 'width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  area.appendChild(cvs);
  redrawMoleCanvas(cvs);

  const hint = document.createElement('div');
  hint.className = 'bez-hint'; hint.textContent = 'クリック→追加  ドラッグ→移動  右クリック→削除';
  area.appendChild(hint);

  const styleSep = document.createElement('div');
  styleSep.className = 'nose-sep'; styleSep.textContent = '形・スタイル';
  area.appendChild(styleSep);

  const shapeRow = document.createElement('div');
  shapeRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';
  MOLE_SHAPES.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'hbtn';
    btn.style.cssText = 'flex:1;padding:3px 2px;font-size:10px;';
    btn.textContent = s.label;
    if (i === moleState.newShape) btn.style.borderColor = 'var(--accent)';
    btn.addEventListener('click', () => {
      moleState.newShape = i;
      shapeRow.querySelectorAll('.hbtn').forEach((b, j) => { b.style.borderColor = j===i ? 'var(--accent)' : ''; });
      if (moleState.selIdx >= 0) { moleState.list[moleState.selIdx].shape = i; redrawMoleCanvas(cvs); }
    });
    shapeRow.appendChild(btn);
  });
  area.appendChild(shapeRow);

  const szRow = document.createElement('div'); szRow.className = 'sl-row';
  const szNm = document.createElement('span'); szNm.className = 'sl-name'; szNm.textContent = '大きさ';
  const szInp = document.createElement('input');
  szInp.type = 'range'; szInp.min = 2; szInp.max = 22; szInp.step = 0.5; szInp.value = moleState.newSize;
  const szVl = document.createElement('span'); szVl.className = 'sl-val'; szVl.textContent = moleState.newSize;
  szInp.addEventListener('input', () => {
    moleState.newSize = parseFloat(szInp.value); szVl.textContent = szInp.value;
    if (moleState.selIdx >= 0) { moleState.list[moleState.selIdx].size = moleState.newSize; redrawMoleCanvas(cvs); }
  });
  szRow.appendChild(szNm); szRow.appendChild(szInp); szRow.appendChild(szVl);
  area.appendChild(szRow);

  const colorRow = document.createElement('div'); colorRow.className = 'sl-row';
  const colorNm = document.createElement('span'); colorNm.className = 'sl-name'; colorNm.textContent = '色';
  const colorInp = document.createElement('input');
  colorInp.type = 'color'; colorInp.value = moleState.newColor; colorInp.className = 'bez-color-picker';
  colorInp.addEventListener('input', () => {
    moleState.newColor = colorInp.value;
    if (moleState.selIdx >= 0) { moleState.list[moleState.selIdx].color = moleState.newColor; redrawMoleCanvas(cvs); }
  });
  colorRow.appendChild(colorNm); colorRow.appendChild(colorInp);
  area.appendChild(colorRow);

  const delBtn = document.createElement('button');
  delBtn.className = 'hbtn'; delBtn.style.cssText = 'margin-top:8px;width:100%;';
  delBtn.textContent = '選択したほくろを削除';
  delBtn.addEventListener('click', () => {
    if (moleState.selIdx >= 0) { moleState.list.splice(moleState.selIdx, 1); moleState.selIdx = -1; redrawMoleCanvas(cvs); }
  });
  area.appendChild(delBtn);

  let dragging = false, dragIdx = -1;

  cvs.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX-rect.left)*(MOLE_CW/rect.width), my = (e.clientY-rect.top)*(MOLE_CH/rect.height);
    for (let i = moleState.list.length-1; i >= 0; i--) {
      const m = moleState.list[i];
      if (Math.hypot(mx-m.x, my-m.y) <= m.size+6) {
        moleState.list.splice(i, 1);
        if (moleState.selIdx >= i) moleState.selIdx = Math.max(-1, moleState.selIdx-1);
        redrawMoleCanvas(cvs); break;
      }
    }
  });

  cvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX-rect.left)*(MOLE_CW/rect.width), my = (e.clientY-rect.top)*(MOLE_CH/rect.height);
    let hit = -1;
    for (let i = moleState.list.length-1; i >= 0; i--) {
      if (Math.hypot(mx-moleState.list[i].x, my-moleState.list[i].y) <= moleState.list[i].size+6) { hit = i; break; }
    }
    if (hit >= 0) {
      moleState.selIdx = hit; dragging = true; dragIdx = hit; cvs.setPointerCapture(e.pointerId);
    } else {
      moleState.list.push({ x: mx, y: my, size: moleState.newSize, shape: moleState.newShape, color: moleState.newColor });
      moleState.selIdx = moleState.list.length - 1;
    }
    redrawMoleCanvas(cvs);
  });
  cvs.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = cvs.getBoundingClientRect();
    const m = moleState.list[dragIdx];
    if (m) { m.x = (e.clientX-rect.left)*(MOLE_CW/rect.width); m.y = (e.clientY-rect.top)*(MOLE_CH/rect.height); redrawMoleCanvas(cvs); }
  });
  cvs.addEventListener('pointerup', () => { dragging = false; dragIdx = -1; });
}

// ═══════════════════════════════════════════════════════════════
//  タトゥーパネル
// ═══════════════════════════════════════════════════════════════
const TATTOO_CW = 240, TATTOO_CH = 300;

const TATTOO_PRESETS = [
  { label: 'バラ', draw(ctx, w, h) {
    ctx.strokeStyle = 'rgba(180,40,60,0.5)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(w*.5, h*.40, w*.14, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#a02030'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w*.5, h*.40, w*.08, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#204020'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*.5,h*.54); ctx.bezierCurveTo(w*.48,h*.64,w*.52,h*.72,w*.50,h*.82); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.50,h*.66); ctx.bezierCurveTo(w*.36,h*.62,w*.32,h*.74,w*.40,h*.74); ctx.stroke();
  }},
  { label: '蝶', draw(ctx, w, h) {
    ctx.strokeStyle = '#6644aa'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(100,80,180,0.25)';
    ctx.beginPath(); ctx.moveTo(w*.5,h*.5); ctx.bezierCurveTo(w*.30,h*.28,w*.08,h*.32,w*.12,h*.52); ctx.bezierCurveTo(w*.16,h*.70,w*.40,h*.68,w*.5,h*.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.5,h*.5); ctx.bezierCurveTo(w*.34,h*.54,w*.20,h*.58,w*.22,h*.68); ctx.bezierCurveTo(w*.24,h*.76,w*.44,h*.74,w*.5,h*.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.5,h*.5); ctx.bezierCurveTo(w*.70,h*.28,w*.92,h*.32,w*.88,h*.52); ctx.bezierCurveTo(w*.84,h*.70,w*.60,h*.68,w*.5,h*.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.5,h*.5); ctx.bezierCurveTo(w*.66,h*.54,w*.80,h*.58,w*.78,h*.68); ctx.bezierCurveTo(w*.76,h*.76,w*.56,h*.74,w*.5,h*.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4433aa';
    ctx.beginPath(); ctx.ellipse(w*.5,h*.5,w*.025,h*.12,0,0,Math.PI*2); ctx.fill();
  }},
  { label: '龍', draw(ctx, w, h) {
    ctx.strokeStyle = '#2040c0'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w*.5,h*.16);
    ctx.bezierCurveTo(w*.72,h*.20,w*.80,h*.36,w*.74,h*.46);
    ctx.bezierCurveTo(w*.68,h*.56,w*.56,h*.54,w*.58,h*.62);
    ctx.bezierCurveTo(w*.60,h*.70,w*.72,h*.74,w*.70,h*.84);
    ctx.stroke();
    ctx.fillStyle = '#4060d0';
    ctx.beginPath(); ctx.ellipse(w*.5,h*.16,w*.06,w*.05,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#4060d0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w*.47,h*.12); ctx.lineTo(w*.42,h*.06); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.53,h*.12); ctx.lineTo(w*.58,h*.06); ctx.stroke();
  }},
  { label: '星群', draw(ctx, w, h) {
    [[.28,.34,8],[.66,.28,6],[.72,.56,9],[.34,.66,7],[.50,.44,11]].forEach(([x,y,r]) => {
      ctx.beginPath();
      for (let i=0;i<10;i++) {
        const a=(i*Math.PI/5)-Math.PI/2, ir=i%2===0?r:r*.4;
        i===0?ctx.moveTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir):ctx.lineTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir);
      }
      ctx.closePath(); ctx.fillStyle = '#ffcc00'; ctx.fill();
    });
    ctx.fillStyle = '#ffeea0';
    [[.44,.24],[.60,.46],[.30,.56],[.74,.38],[.48,.70]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w,y*h,2,0,Math.PI*2); ctx.fill();
    });
  }},
  { label: '翼', draw(ctx, w, h) {
    ctx.fillStyle = 'rgba(40,40,40,0.2)'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*.5,h*.56); ctx.bezierCurveTo(w*.36,h*.40,w*.12,h*.36,w*.08,h*.52); ctx.bezierCurveTo(w*.10,h*.66,w*.36,h*.66,w*.5,h*.56); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    [h*.44,h*.51,h*.57].forEach(y => { ctx.beginPath(); ctx.moveTo(w*.5,h*.56); ctx.quadraticCurveTo(w*.28,y,w*.12,y+h*.02); ctx.stroke(); });
    ctx.fillStyle = 'rgba(40,40,40,0.2)'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w*.5,h*.56); ctx.bezierCurveTo(w*.64,h*.40,w*.88,h*.36,w*.92,h*.52); ctx.bezierCurveTo(w*.90,h*.66,w*.64,h*.66,w*.5,h*.56); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    [h*.44,h*.51,h*.57].forEach(y => { ctx.beginPath(); ctx.moveTo(w*.5,h*.56); ctx.quadraticCurveTo(w*.72,y,w*.88,y+h*.02); ctx.stroke(); });
  }},
  { label: '炎', draw(ctx, w, h) {
    const grd = ctx.createLinearGradient(w*.5,h*.18,w*.5,h*.82);
    grd.addColorStop(0,'#ff4400'); grd.addColorStop(0.4,'#ff8800'); grd.addColorStop(1,'#ffcc00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(w*.5,h*.18);
    ctx.bezierCurveTo(w*.58,h*.28,w*.72,h*.26,w*.68,h*.44);
    ctx.bezierCurveTo(w*.80,h*.36,w*.82,h*.54,w*.70,h*.60);
    ctx.bezierCurveTo(w*.76,h*.68,w*.70,h*.78,w*.60,h*.80);
    ctx.bezierCurveTo(w*.68,h*.70,w*.60,h*.62,w*.60,h*.72);
    ctx.bezierCurveTo(w*.58,h*.82,w*.50,h*.84,w*.50,h*.80);
    ctx.bezierCurveTo(w*.50,h*.84,w*.42,h*.82,w*.40,h*.72);
    ctx.bezierCurveTo(w*.40,h*.62,w*.32,h*.70,w*.40,h*.80);
    ctx.bezierCurveTo(w*.30,h*.78,w*.24,h*.68,w*.30,h*.60);
    ctx.bezierCurveTo(w*.18,h*.54,w*.20,h*.36,w*.32,h*.44);
    ctx.bezierCurveTo(w*.28,h*.26,w*.42,h*.28,w*.5,h*.18);
    ctx.fill();
  }},
  { label: '波', draw(ctx, w, h) {
    ctx.strokeStyle = '#1060c0'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = h*(.30+i*.11);
      ctx.beginPath();
      for (let x = 0; x <= 1.0; x += 0.05) {
        const wx = w*(x*.80+.10), wy = y + Math.sin(x*Math.PI*2)*h*.04;
        x===0 ? ctx.moveTo(wx,wy) : ctx.lineTo(wx,wy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#3088ee'; ctx.lineWidth = 1.5;
    [[.20,.30],[.46,.34],[.72,.30],[.30,.41],[.62,.37]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*w,y*h,w*.05,-Math.PI,0); ctx.stroke();
    });
  }},
  { label: '月と星', draw(ctx, w, h) {
    ctx.fillStyle = '#e8e070';
    ctx.beginPath(); ctx.arc(w*.48,h*.44,w*.20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0a0c14';
    ctx.beginPath(); ctx.arc(w*.60,h*.40,w*.16,0,Math.PI*2); ctx.fill();
    [[.74,.28,6],[.24,.30,5],[.80,.62,4]].forEach(([x,y,r]) => {
      ctx.fillStyle = '#e8e070'; ctx.beginPath();
      for (let i=0;i<10;i++) {
        const a=(i*Math.PI/5)-Math.PI/2, ir=i%2===0?r:r*.4;
        i===0?ctx.moveTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir):ctx.lineTo(x*w+Math.cos(a)*ir,y*h+Math.sin(a)*ir);
      }
      ctx.closePath(); ctx.fill();
    });
  }},
];

const tattooState = {
  list: [], selIdx: -1, presetSel: -1,
  newSize: 55, newRot: 0,
  activeUrl: null, activeLabel: null,
};

function redrawTattooCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, TATTOO_CW, TATTOO_CH);
  drawFaceGuide(ctx, TATTOO_CW, TATTOO_CH);
  tattooState.list.forEach((t, i) => {
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot); ctx.globalAlpha = 0.85;
    if (t.presetIdx >= 0) {
      const tmp = document.createElement('canvas'); tmp.width = t.size; tmp.height = t.size;
      TATTOO_PRESETS[t.presetIdx].draw(tmp.getContext('2d'), t.size, t.size);
      ctx.drawImage(tmp, -t.size/2, -t.size/2);
    } else if (t.img) {
      ctx.drawImage(t.img, -t.size/2, -t.size/2, t.size, t.size);
    }
    ctx.globalAlpha = 1;
    if (i === tattooState.selIdx) {
      ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-t.size/2-4, -t.size/2-4, t.size+8, t.size+8);
    }
    ctx.restore();
  });
}

function buildTattooPanel(area) {
  area.innerHTML = '';

  const presetSep = document.createElement('div');
  presetSep.className = 'nose-sep'; presetSep.textContent = 'サンプル（選択してから配置エリアをクリック）';
  area.appendChild(presetSep);

  const presetGrid = document.createElement('div');
  presetGrid.className = 'thumb-grid';
  const uploadLbl = document.createElement('div');
  uploadLbl.style.cssText = 'font-size:10px;color:var(--text-lo);margin:4px 0;';
  uploadLbl.textContent = '選択中: なし';

  TATTOO_PRESETS.forEach((preset, i) => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item' + (i === tattooState.presetSel ? ' selected' : '');
    cell.style.background = '#0d0f18';
    const cvs = document.createElement('canvas'); cvs.width = 72; cvs.height = 72;
    cvs.style.cssText = 'width:100%;height:100%;display:block;';
    preset.draw(cvs.getContext('2d'), 72, 72);
    const lbl = document.createElement('div'); lbl.className = 'thumb-label'; lbl.textContent = preset.label;
    cell.appendChild(cvs); cell.appendChild(lbl);
    cell.addEventListener('click', () => {
      tattooState.presetSel = i; tattooState.activeUrl = null; tattooState.activeLabel = preset.label;
      presetGrid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      uploadLbl.textContent = `選択中: ${preset.label}`;
    });
    presetGrid.appendChild(cell);
  });
  area.appendChild(presetGrid);

  const uploadSep = document.createElement('div');
  uploadSep.className = 'nose-sep'; uploadSep.textContent = '画像アップロード';
  area.appendChild(uploadSep);

  area.appendChild(uploadLbl);

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'hbtn'; uploadBtn.style.cssText = 'width:100%;margin-bottom:8px;';
  uploadBtn.textContent = '画像を選択 (PNG / JPG)';
  uploadBtn.addEventListener('click', () => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        tattooState.activeUrl = ev.target.result;
        tattooState.activeLabel = f.name.replace(/\.[^.]+$/, '');
        tattooState.presetSel = -1;
        presetGrid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
        uploadLbl.textContent = `選択中: ${tattooState.activeLabel}`;
      };
      reader.readAsDataURL(f);
    });
    inp.click();
  });
  area.appendChild(uploadBtn);

  const placeSep = document.createElement('div');
  placeSep.className = 'nose-sep'; placeSep.textContent = '配置エリア（クリックで設置）';
  area.appendChild(placeSep);

  const faceCvs = document.createElement('canvas');
  faceCvs.width = TATTOO_CW; faceCvs.height = TATTOO_CH;
  faceCvs.style.cssText = 'width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  area.appendChild(faceCvs);
  redrawTattooCanvas(faceCvs);

  const hint2 = document.createElement('div');
  hint2.className = 'bez-hint'; hint2.textContent = 'クリック→設置  ドラッグ→移動  右クリック→削除';
  area.appendChild(hint2);

  const adjSep = document.createElement('div');
  adjSep.className = 'nose-sep'; adjSep.textContent = 'サイズ・回転';
  area.appendChild(adjSep);

  [
    { label: '大きさ', key: 'newSize', min: 20, max: 180, step: 2, isRot: false },
    { label: '回転',   key: 'newRot',  min: -180, max: 180, step: 1, isRot: true },
  ].forEach(sl => {
    const row = document.createElement('div'); row.className = 'sl-row';
    const nm = document.createElement('span'); nm.className = 'sl-name'; nm.textContent = sl.label;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = sl.isRot ? Math.round(tattooState[sl.key] * 180 / Math.PI) : tattooState[sl.key];
    const vl = document.createElement('span'); vl.className = 'sl-val'; vl.textContent = inp.value;
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      tattooState[sl.key] = sl.isRot ? v * Math.PI / 180 : v;
      vl.textContent = inp.value;
      if (tattooState.selIdx >= 0) {
        const t = tattooState.list[tattooState.selIdx];
        if (sl.isRot) t.rot = tattooState.newRot; else t.size = tattooState.newSize;
        redrawTattooCanvas(faceCvs);
      }
    });
    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });

  const delTBtn = document.createElement('button');
  delTBtn.className = 'hbtn'; delTBtn.style.cssText = 'margin-top:8px;width:100%;';
  delTBtn.textContent = '選択したタトゥーを削除';
  delTBtn.addEventListener('click', () => {
    if (tattooState.selIdx >= 0) { tattooState.list.splice(tattooState.selIdx, 1); tattooState.selIdx = -1; redrawTattooCanvas(faceCvs); }
  });
  area.appendChild(delTBtn);

  let dragging = false, dragIdx = -1;

  const gc = e => {
    const rect = faceCvs.getBoundingClientRect();
    return { mx: (e.clientX-rect.left)*(TATTOO_CW/rect.width), my: (e.clientY-rect.top)*(TATTOO_CH/rect.height) };
  };

  faceCvs.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { mx, my } = gc(e);
    for (let i = tattooState.list.length-1; i >= 0; i--) {
      const t = tattooState.list[i], d = t.size/2+8;
      if (Math.abs(mx-t.x) <= d && Math.abs(my-t.y) <= d) {
        tattooState.list.splice(i, 1);
        if (tattooState.selIdx >= i) tattooState.selIdx = Math.max(-1, tattooState.selIdx-1);
        redrawTattooCanvas(faceCvs); break;
      }
    }
  });

  faceCvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    const { mx, my } = gc(e);
    let hit = -1;
    for (let i = tattooState.list.length-1; i >= 0; i--) {
      const t = tattooState.list[i], d = t.size/2+8;
      if (Math.abs(mx-t.x) <= d && Math.abs(my-t.y) <= d) { hit = i; break; }
    }
    if (hit >= 0) {
      tattooState.selIdx = hit; dragging = true; dragIdx = hit; faceCvs.setPointerCapture(e.pointerId);
    } else {
      const hasPreset = tattooState.presetSel >= 0;
      const hasUpload = !!tattooState.activeUrl;
      if (!hasPreset && !hasUpload) return;
      const entry = { x: mx, y: my, size: tattooState.newSize, rot: tattooState.newRot, presetIdx: hasPreset ? tattooState.presetSel : -1, img: null, label: tattooState.activeLabel };
      if (hasUpload && !hasPreset) {
        const img = new Image();
        img.src = tattooState.activeUrl;
        img.onload = () => { entry.img = img; redrawTattooCanvas(faceCvs); };
      }
      tattooState.list.push(entry);
      tattooState.selIdx = tattooState.list.length - 1;
    }
    redrawTattooCanvas(faceCvs);
  });
  faceCvs.addEventListener('pointermove', e => {
    if (!dragging) return;
    const { mx, my } = gc(e);
    const t = tattooState.list[dragIdx];
    if (t) { t.x = mx; t.y = my; redrawTattooCanvas(faceCvs); }
  });
  faceCvs.addEventListener('pointerup', () => { dragging = false; dragIdx = -1; });
}

// ═══════════════════════════════════════════════════════════════
//  耳アクセサリーパネル
// ═══════════════════════════════════════════════════════════════
const EAR_TEMPLATES = [
  // ── スタッド ──
  { label: '丸スタッド', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.22;
    const g=ctx.createRadialGradient(cx-r*.3,cy-r*.3,r*.08,cx,cy,r);
    g.addColorStop(0,'#ffe8d0');g.addColorStop(.4,'#d4a0d0');g.addColorStop(1,'#8040a0');
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.arc(cx-r*.25,cy-r*.25,r*.12,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();
    ctx.beginPath();ctx.moveTo(cx,cy+r);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: '四角スタッド', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.44,s=w*.2;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);
    const g=ctx.createLinearGradient(-s,-s,s,s);
    g.addColorStop(0,'#e0d0ff');g.addColorStop(1,'#6030c0');
    ctx.fillStyle=g;ctx.fillRect(-s,-s,s*2,s*2);
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1;ctx.strokeRect(-s,-s,s*2,s*2);
    ctx.restore();
    ctx.beginPath();ctx.moveTo(cx,cy+s*1.4);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: '星スタッド', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.42,r=w*.24,n=5;
    ctx.beginPath();
    for(let i=0;i<n*2;i++){const a=Math.PI/n*i-Math.PI/2,rd=i%2?r*.42:r;i===0?ctx.moveTo(cx+Math.cos(a)*rd,cy+Math.sin(a)*rd):ctx.lineTo(cx+Math.cos(a)*rd,cy+Math.sin(a)*rd);}
    ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();ctx.strokeStyle='#c8a000';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy+r);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: 'ハートスタッド', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.42,s=w*.22;
    ctx.save();ctx.translate(cx,cy);ctx.scale(s/10,s/10);
    ctx.beginPath();ctx.moveTo(0,3);ctx.bezierCurveTo(-10,-5,-12,7,0,10);ctx.bezierCurveTo(12,7,10,-5,0,3);
    ctx.fillStyle='#ff4477';ctx.fill();ctx.restore();
    ctx.beginPath();ctx.moveTo(cx,cy+s*1.1);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: '花スタッド', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.42,r=w*.1,n=6;
    for(let i=0;i<n;i++){const a=Math.PI*2/n*i;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*1.6,cy+Math.sin(a)*r*1.6,r,0,Math.PI*2);ctx.fillStyle=i%2?'#ff88cc':'#ffaae0';ctx.fill();}
    ctx.beginPath();ctx.arc(cx,cy,r*.8,0,Math.PI*2);ctx.fillStyle='#ffe060';ctx.fill();
    ctx.beginPath();ctx.moveTo(cx,cy+r*2.8);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: 'クリスタル', group: 'スタッド', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.42;
    const pts=[[cx,cy-w*.26],[cx+w*.18,cy-w*.06],[cx+w*.12,cy+w*.18],[cx-w*.12,cy+w*.18],[cx-w*.18,cy-w*.06]];
    ctx.beginPath();ctx.moveTo(...pts[0]);pts.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();
    const g=ctx.createLinearGradient(cx-w*.2,cy-w*.28,cx+w*.1,cy+w*.2);
    g.addColorStop(0,'#c0f0ff');g.addColorStop(.5,'#60c0f0');g.addColorStop(1,'#2060a0');
    ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#a0e0ff';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy+w*.18);ctx.lineTo(cx,h*.88);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  // ── フープ ──
  { label: '細フープ', group: 'フープ', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.3;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#c0c0c0';ctx.lineWidth=w*.035;ctx.stroke();
  }},
  { label: '中フープ', group: 'フープ', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.3;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#d4a030';ctx.lineWidth=w*.07;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='rgba(255,220,100,.4)';ctx.lineWidth=w*.025;ctx.stroke();
  }},
  { label: '太フープ', group: 'フープ', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.28;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    const g=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
    g.addColorStop(0,'#3a3a3a');g.addColorStop(.5,'#c0c0c0');g.addColorStop(1,'#3a3a3a');
    ctx.strokeStyle=g;ctx.lineWidth=w*.14;ctx.stroke();
  }},
  { label: '三連フープ', group: 'フープ', draw(ctx, w, h) {
    [[h*.32,w*.22,'#c8a030'],[h*.5,w*.17,'#c0c0c0'],[h*.66,w*.13,'#c08030']].forEach(([cy,r,c])=>{
      ctx.beginPath();ctx.arc(w*.5,cy,r,0,Math.PI*2);ctx.strokeStyle=c;ctx.lineWidth=w*.04;ctx.stroke();
    });
  }},
  { label: 'ツイストフープ', group: 'フープ', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.3,n=24;
    for(let i=0;i<n;i++){const a=Math.PI*2/n*i,a2=Math.PI*2/n*(i+1);ctx.beginPath();ctx.arc(cx,cy,r,a,a2);ctx.strokeStyle=i%2?'#d4a030':'#c0c0c0';ctx.lineWidth=w*.1;ctx.stroke();}
  }},
  { label: 'チェーンフープ', group: 'フープ', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.28,n=16;
    for(let i=0;i<n;i++){const a=Math.PI*2/n*i;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r,w*.05,w*.02,a,0,Math.PI*2);ctx.strokeStyle='#b8902a';ctx.lineWidth=1;ctx.stroke();}
  }},
  // ── ドロップ ──
  { label: 'しずくドロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.06;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.26);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.28);
    ctx.bezierCurveTo(cx+w*.2,ty+h*.38,cx+w*.2,ty+h*.6,cx,ty+h*.66);
    ctx.bezierCurveTo(cx-w*.2,ty+h*.6,cx-w*.2,ty+h*.38,cx,ty+h*.28);
    const g=ctx.createLinearGradient(cx-w*.18,ty+h*.3,cx+w*.1,ty+h*.66);
    g.addColorStop(0,'#c0f0c0');g.addColorStop(1,'#204020');
    ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#80c080';ctx.lineWidth=1;ctx.stroke();
  }},
  { label: '羽ドロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.04;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.24);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.26);ctx.lineTo(cx,ty+h*.84);ctx.strokeStyle='#888';ctx.lineWidth=w*.025;ctx.stroke();
    for(let i=0;i<10;i++){const y=ty+h*.3+i*h*.05,s=(i<5?1:-1)*(1-i/14);ctx.beginPath();ctx.moveTo(cx,y);ctx.bezierCurveTo(cx+w*.25*s,y-h*.02,cx+w*.3*s,y+h*.02,cx+w*.15*s,y+h*.04);ctx.strokeStyle=`rgba(220,200,180,${.8-i*.04})`;ctx.lineWidth=1.5;ctx.stroke();}
  }},
  { label: '十字ドロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.04;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.24);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    const cx2=cx,cy2=ty+h*.52;
    ctx.beginPath();ctx.rect(cx2-w*.05,cy2-w*.28,w*.1,w*.56);ctx.rect(cx2-w*.18,cy2-w*.11,w*.36,w*.1);
    const g=ctx.createLinearGradient(cx2-w*.2,cy2,cx2+w*.2,cy2);
    g.addColorStop(0,'#888');g.addColorStop(.5,'#fff');g.addColorStop(1,'#888');
    ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#606060';ctx.lineWidth=.5;ctx.stroke();
  }},
  { label: '月ドロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.04;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.24);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    const mx=cx,my=ty+h*.52,mr=w*.26;
    ctx.beginPath();ctx.arc(mx,my,mr,0,Math.PI*2);ctx.fillStyle='#ffd040';ctx.fill();
    ctx.beginPath();ctx.arc(mx+mr*.38,my-mr*.12,mr*.76,0,Math.PI*2);ctx.fillStyle='#0d0f18';ctx.fill();
    ctx.beginPath();ctx.arc(mx,my,mr,0,Math.PI*2);ctx.strokeStyle='#ffa000';ctx.lineWidth=1;ctx.stroke();
  }},
  { label: 'ダイヤドロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.04;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.24);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    const mx=cx,my=ty+h*.5,s=w*.22;
    ctx.beginPath();ctx.moveTo(mx,my-s);ctx.lineTo(mx+s*.8,my-s*.1);ctx.lineTo(mx,my+s);ctx.lineTo(mx-s*.8,my-s*.1);ctx.closePath();
    const g=ctx.createLinearGradient(mx-s,my-s,mx+s,my+s);
    g.addColorStop(0,'#fff');g.addColorStop(.3,'#a0d0ff');g.addColorStop(.6,'#4090d0');g.addColorStop(1,'#104080');
    ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#80c0ff';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.moveTo(mx-s*.8,my-s*.1);ctx.lineTo(mx,my-s*.1+s*.4);ctx.lineTo(mx+s*.8,my-s*.1);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=.8;ctx.stroke();
  }},
  { label: 'クラスタードロップ', group: 'ドロップ', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.04;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,ty+h*.14);ctx.lineTo(cx,ty+h*.22);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.02;ctx.stroke();
    const gems=[{x:cx,y:ty+h*.34,r:w*.14,c:'#ff6080'},{x:cx+w*.18,y:ty+h*.46,r:w*.09,c:'#8060ff'},{x:cx-w*.18,y:ty+h*.46,r:w*.09,c:'#60b0ff'},{x:cx+w*.08,y:ty+h*.62,r:w*.1,c:'#60d060'},{x:cx-w*.08,y:ty+h*.64,r:w*.08,c:'#ffd040'}];
    gems.forEach(g=>{ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,Math.PI*2);ctx.fillStyle=g.c;ctx.fill();ctx.beginPath();ctx.arc(g.x-g.r*.3,g.y-g.r*.3,g.r*.2,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();});
  }},
  // ── チャーム ──
  { label: '星チャーム', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();}
    const sy=ty+h*.58,r=w*.22,n=5;
    ctx.beginPath();for(let i=0;i<n*2;i++){const a=Math.PI/n*i-Math.PI/2,rd=i%2?r*.42:r;i===0?ctx.moveTo(cx+Math.cos(a)*rd,sy+Math.sin(a)*rd):ctx.lineTo(cx+Math.cos(a)*rd,sy+Math.sin(a)*rd);}
    ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();ctx.strokeStyle='#c8a000';ctx.lineWidth=1;ctx.stroke();
  }},
  { label: 'クローバーチャーム', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,0,0,Math.PI*2);ctx.strokeStyle='#c0c0c0';ctx.lineWidth=1;ctx.stroke();}
    const cy2=ty+h*.6,r=w*.12;
    [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(cx+dx*r,cy2+dy*r,r,0,Math.PI*2);ctx.fillStyle='#50c050';ctx.fill();});
    ctx.beginPath();ctx.moveTo(cx,cy2+r);ctx.lineTo(cx,cy2+r+h*.1);ctx.strokeStyle='#308030';ctx.lineWidth=w*.025;ctx.stroke();
  }},
  { label: 'ハート鎖', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,Math.PI/4,0,Math.PI*2);ctx.strokeStyle='#ff88aa';ctx.lineWidth=1;ctx.stroke();}
    const cy2=ty+h*.58,s=w*.22;
    ctx.save();ctx.translate(cx,cy2);ctx.scale(s/10,s/10);
    ctx.beginPath();ctx.moveTo(0,3);ctx.bezierCurveTo(-10,-5,-12,7,0,10);ctx.bezierCurveTo(12,7,10,-5,0,3);
    ctx.fillStyle='#ff4477';ctx.fill();ctx.restore();
  }},
  { label: 'キーチャーム', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();}
    const kcy=ty+h*.48;
    ctx.beginPath();ctx.arc(cx,kcy,w*.16,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,kcy+w*.16);ctx.lineTo(cx,kcy+w*.16+h*.2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.05;ctx.stroke();
    [[cx+w*.05,kcy+w*.24],[cx+w*.05,kcy+w*.32]].forEach(([tx,ty2])=>{ctx.beginPath();ctx.moveTo(tx,ty2);ctx.lineTo(tx+w*.08,ty2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.04;ctx.stroke();});
  }},
  { label: 'リボンチャーム', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,0,0,Math.PI*2);ctx.strokeStyle='#ffaacc';ctx.lineWidth=1;ctx.stroke();}
    const ry=ty+h*.58;
    ctx.beginPath();ctx.moveTo(cx,ry);ctx.bezierCurveTo(cx-w*.3,ry-h*.14,cx-w*.28,ry+h*.14,cx,ry);ctx.bezierCurveTo(cx+w*.3,ry-h*.14,cx+w*.28,ry+h*.14,cx,ry);ctx.fillStyle='#ff88cc';ctx.fill();
    ctx.beginPath();ctx.arc(cx,ry,w*.04,0,Math.PI*2);ctx.fillStyle='#ff3388';ctx.fill();
  }},
  { label: '蝶チャーム', group: 'チャーム', draw(ctx, w, h) {
    const cx=w*.5,ty=h*.02;
    ctx.beginPath();ctx.arc(cx,ty+h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(cx,ty+h*.16+i*h*.07,w*.02,h*.04,0,0,Math.PI*2);ctx.strokeStyle='#c0c0c0';ctx.lineWidth=1;ctx.stroke();}
    const by=ty+h*.57;
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(cx,by);ctx.bezierCurveTo(cx+sx*w*.32,by+sy*h*.04,cx+sx*w*.3,by+sy*h*.2,cx,by+sy*h*.06);ctx.fillStyle=sx<0?'rgba(100,180,255,.85)':'rgba(255,140,200,.85)';ctx.fill();ctx.strokeStyle='rgba(80,80,200,.5)';ctx.lineWidth=.8;ctx.stroke();});
    ctx.beginPath();ctx.moveTo(cx,by-h*.08);ctx.lineTo(cx,by+h*.1);ctx.strokeStyle='#404040';ctx.lineWidth=1.5;ctx.stroke();
  }},
  // ── その他 ──
  { label: 'イヤーカフ', group: 'その他', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.32;
    ctx.beginPath();ctx.arc(cx,cy,r,Math.PI*.1,Math.PI*.9);
    ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.1;ctx.stroke();
    [Math.PI*.1,Math.PI*.9].forEach(a=>{ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,w*.08,0,Math.PI*2);ctx.fillStyle='#d4b040';ctx.fill();});
  }},
  { label: 'クリップ', group: 'その他', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5;
    ctx.beginPath();ctx.arc(cx,cy,w*.28,0,Math.PI*2);ctx.strokeStyle='#c0c0c0';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,w*.1,0,Math.PI*2);ctx.fillStyle='#e8e8e8';ctx.fill();
    ctx.beginPath();ctx.moveTo(cx+w*.28,cy);ctx.lineTo(cx+w*.42,cy-h*.1);ctx.moveTo(cx+w*.28,cy);ctx.lineTo(cx+w*.42,cy+h*.1);ctx.strokeStyle='#b0b0b0';ctx.lineWidth=w*.04;ctx.stroke();
    [cy-h*.1,cy+h*.1].forEach(y=>{ctx.beginPath();ctx.arc(cx+w*.44,y,w*.06,0,Math.PI*2);ctx.fillStyle='#d0d0d0';ctx.fill();});
  }},
  { label: 'クラスター', group: 'その他', draw(ctx, w, h) {
    const gems=[{x:w*.5,y:h*.24,r:w*.15,c:'#ff8080'},{x:w*.3,y:h*.42,r:w*.11,c:'#80a0ff'},{x:w*.7,y:h*.42,r:w*.11,c:'#80ff90'},{x:w*.38,y:h*.62,r:w*.1,c:'#ffd060'},{x:w*.62,y:h*.62,r:w*.1,c:'#d060ff'},{x:w*.5,y:h*.74,r:w*.08,c:'#ff80c0'}];
    [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]].forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(gems[a].x,gems[a].y);ctx.lineTo(gems[b].x,gems[b].y);ctx.strokeStyle='rgba(180,180,180,.4)';ctx.lineWidth=1;ctx.stroke();});
    gems.forEach(g=>{ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,Math.PI*2);ctx.fillStyle=g.c;ctx.fill();ctx.beginPath();ctx.arc(g.x-g.r*.3,g.y-g.r*.3,g.r*.22,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.75)';ctx.fill();});
    ctx.beginPath();ctx.arc(w*.5,h*.1,w*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  { label: 'タッセル', group: 'その他', draw(ctx, w, h) {
    const cx=w*.5;
    ctx.beginPath();ctx.arc(cx,h*.08,h*.08,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,h*.18,w*.1,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();
    const n=9;
    for(let i=0;i<n;i++){const x=cx-w*.3+w*.6/(n-1)*i,len=h*.3+Math.sin(i*1.3)*h*.08;ctx.beginPath();ctx.moveTo(x,h*.28);ctx.lineTo(x+Math.sin(i)*w*.04,h*.28+len);ctx.strokeStyle=`hsl(${i*40},60%,60%)`;ctx.lineWidth=w*.025;ctx.stroke();}
    ctx.beginPath();ctx.moveTo(cx-w*.3,h*.6);ctx.lineTo(cx+w*.3,h*.6);ctx.strokeStyle='rgba(180,160,120,.5)';ctx.lineWidth=1;ctx.stroke();
  }},
  { label: '軟骨ピアス', group: 'その他', draw(ctx, w, h) {
    const cx=w*.5,cy=h*.5,r=w*.28;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#c0c0c0';ctx.lineWidth=w*.06;ctx.stroke();
    [cx+r,cx-r].forEach(x=>{ctx.beginPath();ctx.arc(x,cy,w*.08,0,Math.PI*2);ctx.fillStyle='#d8d8d8';ctx.fill();});
  }},
  { label: 'ダングル', group: 'その他', draw(ctx, w, h) {
    const cx=w*.5;
    ctx.beginPath();ctx.arc(cx,h*.07,h*.07,Math.PI,0);ctx.strokeStyle='#bbb';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.14);ctx.lineTo(cx,h*.28);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.03;ctx.stroke();
    [[cx,h*.3,cx+w*.16,h*.4,cx,h*.5,cx-w*.16,h*.4,'#a0d0ff','#60a0d0'],[cx,h*.52,cx+w*.12,h*.59,cx,h*.66,cx-w*.12,h*.59,'#ffd080','#c0a040']].forEach(([x0,y0,x1,y1,x2,y2,x3,y3,fc,sc])=>{
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fillStyle=fc;ctx.fill();ctx.strokeStyle=sc;ctx.lineWidth=1;ctx.stroke();
      if(x2!==cx||y2!==h*.66){ctx.beginPath();ctx.moveTo(cx,y2);ctx.lineTo(cx,y2+h*.06);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.03;ctx.stroke();}
    });
  }},
];

// 耳テンプレート選択状態
const earTemplateState = { selIdx: -1 };

// 耳ペイント状態
const EAR_PW = 220, EAR_PH = 220;
const earPaintState = {
  tool: 'pen',
  color: '#d4a030',
  size: 8,
  wet: 0,
  opacity: 1,
  drawing: false,
  startX: 0, startY: 0,
  imageData: null,
  customList: [],
};

function drawEarGuide(ctx, w, h) {
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#2a3555';
  ctx.lineWidth = 1;
  // 耳の輪郭ガイド
  ctx.beginPath();
  ctx.moveTo(w*.38,h*.1);
  ctx.bezierCurveTo(w*.16,h*.16,w*.12,h*.42,w*.16,h*.56);
  ctx.bezierCurveTo(w*.18,h*.74,w*.28,h*.86,w*.42,h*.9);
  ctx.bezierCurveTo(w*.56,h*.94,w*.68,h*.84,w*.7,h*.66);
  ctx.bezierCurveTo(w*.74,h*.5,w*.72,h*.24,w*.62,h*.12);
  ctx.bezierCurveTo(w*.56,h*.04,w*.46,h*.04,w*.38,h*.1);
  ctx.stroke();
  // 耳穴ガイド
  ctx.beginPath();
  ctx.ellipse(w*.44,h*.5,w*.14,h*.24,-.15,0,Math.PI*2);
  ctx.stroke();
  // 耳たぶ
  ctx.beginPath();
  ctx.moveTo(w*.28,h*.76);
  ctx.bezierCurveTo(w*.3,h*.86,w*.42,h*.94,w*.52,h*.9);
  ctx.stroke();
  ctx.restore();
}

function buildEarPanel(area) {
  area.innerHTML = '';

  // ── テンプレートグリッド ──
  const groups = [...new Set(EAR_TEMPLATES.map(t=>t.group))];
  groups.forEach(grp => {
    const sep = document.createElement('div');
    sep.className = 'nose-sep'; sep.textContent = grp;
    area.appendChild(sep);

    const grid = document.createElement('div');
    grid.className = 'thumb-grid';
    EAR_TEMPLATES.forEach((tmpl, i) => {
      if (tmpl.group !== grp) return;
      const cell = document.createElement('div');
      cell.className = 'thumb-item' + (i === earTemplateState.selIdx ? ' selected' : '');
      cell.style.background = '#0d0f18';
      const cvs = document.createElement('canvas'); cvs.width = 72; cvs.height = 72;
      cvs.style.cssText = 'width:100%;height:100%;display:block;';
      tmpl.draw(cvs.getContext('2d'), 72, 72);
      const lbl = document.createElement('div'); lbl.className = 'thumb-label'; lbl.textContent = tmpl.label;
      cell.appendChild(cvs); cell.appendChild(lbl);
      cell.addEventListener('click', () => {
        earTemplateState.selIdx = i;
        area.querySelectorAll('.ear-tmpl-item').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
      });
      cell.classList.add('ear-tmpl-item');
      grid.appendChild(cell);
    });
    area.appendChild(grid);
  });

  // カスタムリスト
  if (earPaintState.customList.length > 0) {
    const csep = document.createElement('div');
    csep.className = 'nose-sep'; csep.textContent = 'カスタム';
    area.appendChild(csep);
    const cgrid = document.createElement('div');
    cgrid.className = 'thumb-grid';
    earPaintState.customList.forEach((dataUrl, ci) => {
      const cell = document.createElement('div');
      cell.className = 'thumb-item';
      cell.style.background = '#0d0f18';
      const img = document.createElement('img'); img.src = dataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
      cell.appendChild(img);
      cgrid.appendChild(cell);
    });
    area.appendChild(cgrid);
  }

  // ── 3Dペイントセクション ──
  const paintSep = document.createElement('div');
  paintSep.className = 'nose-sep'; paintSep.textContent = '3Dペイント（１から作成）';
  area.appendChild(paintSep);

  // ツールバー
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;';

  const tools = [
    { id:'pen', label:'ペン' }, { id:'eraser', label:'消しゴム' },
    { id:'circle', label:'円' }, { id:'rect', label:'四角' }, { id:'triangle', label:'三角' },
  ];
  const toolBtns = {};
  tools.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'hbtn' + (earPaintState.tool===t.id?' active':'');
    btn.style.cssText = 'padding:3px 8px;font-size:10px;' + (earPaintState.tool===t.id?'background:#2a3050;border-color:var(--accent);color:var(--accent);':'');
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      earPaintState.tool = t.id;
      Object.values(toolBtns).forEach(b => {b.style.background='';b.style.borderColor='';b.style.color='';});
      btn.style.background = '#2a3050'; btn.style.borderColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
    });
    toolBtns[t.id] = btn;
    toolbar.appendChild(btn);
  });
  area.appendChild(toolbar);

  // カラー・サイズ・濡れ行
  const ctrlRow = document.createElement('div');
  ctrlRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;';

  // 色ピッカー
  const colorLbl = document.createElement('span'); colorLbl.style.cssText='font-size:10px;color:var(--text-lo);'; colorLbl.textContent='色:';
  const colorPick = document.createElement('input'); colorPick.type='color'; colorPick.value=earPaintState.color;
  colorPick.style.cssText='width:32px;height:24px;border:none;background:none;cursor:pointer;padding:0;border-radius:3px;';
  colorPick.addEventListener('input', () => { earPaintState.color = colorPick.value; });

  // カラースウォッチ
  const swatchRow = document.createElement('div'); swatchRow.style.cssText='display:flex;gap:3px;flex-wrap:wrap;';
  ['#d4a030','#c0c0c0','#ff4477','#4477ff','#44cc44','#ff8800','#cc44cc','#ffffff','#111111','#8b4513'].forEach(c => {
    const sw = document.createElement('div');
    sw.style.cssText = `width:18px;height:18px;background:${c};border-radius:3px;cursor:pointer;border:2px solid ${c===earPaintState.color?'var(--accent)':'transparent'};`;
    sw.addEventListener('click', () => {
      earPaintState.color = c; colorPick.value = c;
      swatchRow.querySelectorAll('div').forEach(s => s.style.borderColor='transparent');
      sw.style.borderColor = 'var(--accent)';
    });
    swatchRow.appendChild(sw);
  });

  ctrlRow.appendChild(colorLbl); ctrlRow.appendChild(colorPick);
  area.appendChild(ctrlRow);
  area.appendChild(swatchRow);

  // ブラシサイズ
  const szRow = document.createElement('div'); szRow.className = 'sl-row'; szRow.style.marginTop='6px';
  const szLbl = document.createElement('span'); szLbl.className='sl-name'; szLbl.textContent='ブラシ';
  const szSlider = document.createElement('input'); szSlider.type='range'; szSlider.min=1; szSlider.max=40; szSlider.step=1; szSlider.value=earPaintState.size;
  const szVal = document.createElement('span'); szVal.className='sl-val'; szVal.textContent=earPaintState.size+'px';
  szSlider.addEventListener('input', () => { earPaintState.size=parseInt(szSlider.value); szVal.textContent=earPaintState.size+'px'; });
  szRow.appendChild(szLbl); szRow.appendChild(szSlider); szRow.appendChild(szVal);
  area.appendChild(szRow);

  // 不透明度
  const opRow = document.createElement('div'); opRow.className = 'sl-row';
  const opLbl = document.createElement('span'); opLbl.className='sl-name'; opLbl.textContent='不透明度';
  const opSlider = document.createElement('input'); opSlider.type='range'; opSlider.min=5; opSlider.max=100; opSlider.step=5; opSlider.value=Math.round(earPaintState.opacity*100);
  const opVal = document.createElement('span'); opVal.className='sl-val'; opVal.textContent=Math.round(earPaintState.opacity*100)+'%';
  opSlider.addEventListener('input', () => { earPaintState.opacity=parseInt(opSlider.value)/100; opVal.textContent=opSlider.value+'%'; });
  opRow.appendChild(opLbl); opRow.appendChild(opSlider); opRow.appendChild(opVal);
  area.appendChild(opRow);

  // 濡れ（ぼかし）
  const wetRow = document.createElement('div'); wetRow.className = 'sl-row';
  const wetLbl = document.createElement('span'); wetLbl.className='sl-name'; wetLbl.textContent='濡れ';
  const wetSlider = document.createElement('input'); wetSlider.type='range'; wetSlider.min=0; wetSlider.max=20; wetSlider.step=1; wetSlider.value=earPaintState.wet;
  const wetVal = document.createElement('span'); wetVal.className='sl-val'; wetVal.textContent=earPaintState.wet;
  wetSlider.addEventListener('input', () => { earPaintState.wet=parseInt(wetSlider.value); wetVal.textContent=earPaintState.wet; });
  wetRow.appendChild(wetLbl); wetRow.appendChild(wetSlider); wetRow.appendChild(wetVal);
  area.appendChild(wetRow);

  // ペイントキャンバス
  const paintSep2 = document.createElement('div');
  paintSep2.className = 'nose-sep'; paintSep2.style.marginTop='8px'; paintSep2.textContent = 'キャンバス（耳ガイド付き）';
  area.appendChild(paintSep2);

  // ガイドレイヤー（背景、読み取り専用）
  const guideWrap = document.createElement('div');
  guideWrap.style.cssText = 'position:relative;width:220px;height:220px;margin:0 auto 6px;';

  const guideCvs = document.createElement('canvas'); guideCvs.width=EAR_PW; guideCvs.height=EAR_PH;
  guideCvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:4px;background:#080a12;border:1px solid #2a3050;';
  drawEarGuide(guideCvs.getContext('2d'), EAR_PW, EAR_PH);

  // ペイントレイヤー（ユーザー描画）
  const paintCvs = document.createElement('canvas'); paintCvs.width=EAR_PW; paintCvs.height=EAR_PH;
  paintCvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none;user-select:none;';

  // 保存済みの描画内容があれば復元
  if (earPaintState.imageData) {
    paintCvs.getContext('2d').putImageData(earPaintState.imageData, 0, 0);
  }

  guideWrap.appendChild(guideCvs);
  guideWrap.appendChild(paintCvs);
  area.appendChild(guideWrap);

  const paintHint = document.createElement('div');
  paintHint.className = 'bez-hint'; paintHint.textContent = 'ドラッグで描画  形状ツール：クリック→ドラッグで形を決める';
  area.appendChild(paintHint);

  // ボタン行
  const btnRow = document.createElement('div'); btnRow.style.cssText='display:flex;gap:6px;margin-top:6px;';
  const clrBtn = document.createElement('button'); clrBtn.className='hbtn'; clrBtn.style.flex='1'; clrBtn.textContent='クリア';
  clrBtn.addEventListener('click', () => {
    paintCvs.getContext('2d').clearRect(0,0,EAR_PW,EAR_PH);
    earPaintState.imageData = null;
  });
  const saveBtn = document.createElement('button'); saveBtn.className='hbtn'; saveBtn.style.cssText='flex:1;background:#1a2a1a;border-color:#2a4a2a;color:#7fc87f;';
  saveBtn.textContent='カスタム保存';
  saveBtn.addEventListener('click', () => {
    // ガイド + 描画を合成してサムネとして保存
    const tc = document.createElement('canvas'); tc.width=72; tc.height=72;
    const tx = tc.getContext('2d');
    tx.drawImage(guideCvs, 0,0,72,72);
    tx.drawImage(paintCvs, 0,0,72,72);
    earPaintState.customList.push(tc.toDataURL());
    earPaintState.imageData = paintCvs.getContext('2d').getImageData(0,0,EAR_PW,EAR_PH);
    buildEarPanel(area);
  });
  btnRow.appendChild(clrBtn); btnRow.appendChild(saveBtn);
  area.appendChild(btnRow);

  // ── ペイントイベント ──
  const ctx = paintCvs.getContext('2d');

  const getPos = e => {
    const rect = paintCvs.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(EAR_PW/rect.width), y:(e.clientY-rect.top)*(EAR_PH/rect.height) };
  };

  const applyStyle = () => {
    ctx.globalAlpha = earPaintState.opacity;
    ctx.shadowBlur = earPaintState.wet * 2;
    ctx.shadowColor = earPaintState.color;
    ctx.lineWidth = earPaintState.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (earPaintState.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = earPaintState.color;
      ctx.fillStyle = earPaintState.color;
    }
  };

  paintCvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    paintCvs.setPointerCapture(e.pointerId);
    earPaintState.drawing = true;
    const {x,y} = getPos(e);
    earPaintState.startX = x; earPaintState.startY = y;
    earPaintState.imageData = ctx.getImageData(0,0,EAR_PW,EAR_PH);
    applyStyle();
    if (earPaintState.tool === 'pen' || earPaintState.tool === 'eraser') {
      ctx.beginPath(); ctx.moveTo(x,y);
    }
  });

  paintCvs.addEventListener('pointermove', e => {
    if (!earPaintState.drawing) return;
    const {x,y} = getPos(e);
    applyStyle();
    const t = earPaintState.tool;
    if (t === 'pen' || t === 'eraser') {
      ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y);
    } else {
      // 形状プレビュー: スナップショットから復元して描画
      ctx.putImageData(earPaintState.imageData,0,0);
      applyStyle();
      const sx=earPaintState.startX, sy=earPaintState.startY;
      ctx.beginPath();
      if (t==='circle') {
        const rx=Math.abs(x-sx)/2, ry=Math.abs(y-sy)/2;
        ctx.ellipse(sx+(x-sx)/2, sy+(y-sy)/2, rx, ry, 0, 0, Math.PI*2);
      } else if (t==='rect') {
        ctx.rect(sx,sy,x-sx,y-sy);
      } else if (t==='triangle') {
        ctx.moveTo((sx+x)/2,sy); ctx.lineTo(x,y); ctx.lineTo(sx,y); ctx.closePath();
      }
      ctx.stroke();
      if (t!=='eraser') { ctx.globalAlpha=earPaintState.opacity*.3; ctx.fill(); ctx.globalAlpha=earPaintState.opacity; }
    }
  });

  paintCvs.addEventListener('pointerup', e => {
    if (!earPaintState.drawing) return;
    earPaintState.drawing = false;
    const {x,y} = getPos(e);
    const t = earPaintState.tool;
    applyStyle();
    if (t !== 'pen' && t !== 'eraser') {
      ctx.putImageData(earPaintState.imageData,0,0);
      applyStyle();
      const sx=earPaintState.startX, sy=earPaintState.startY;
      ctx.beginPath();
      if (t==='circle') {
        const rx=Math.abs(x-sx)/2, ry=Math.abs(y-sy)/2;
        ctx.ellipse(sx+(x-sx)/2, sy+(y-sy)/2, rx, ry, 0, 0, Math.PI*2);
      } else if (t==='rect') {
        ctx.rect(sx,sy,x-sx,y-sy);
      } else if (t==='triangle') {
        ctx.moveTo((sx+x)/2,sy); ctx.lineTo(x,y); ctx.lineTo(sx,y); ctx.closePath();
      }
      ctx.stroke();
      if (t!=='eraser') { ctx.globalAlpha=earPaintState.opacity*.35; ctx.fill(); }
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.shadowBlur=0;
    earPaintState.imageData = ctx.getImageData(0,0,EAR_PW,EAR_PH);
  });
}

// ═══════════════════════════════════════════════════════════════
//  口元パネル
// ═══════════════════════════════════════════════════════════════
const MOUTH_TEMPLATES = [
  // ── 唇形状 ──
  { label: '普通唇', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.54;
    ctx.beginPath();ctx.moveTo(cx-w*.32,cy);ctx.bezierCurveTo(cx-w*.18,cy-h*.1,cx+w*.18,cy-h*.1,cx+w*.32,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.04;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.32,cy);ctx.bezierCurveTo(cx-w*.18,cy+h*.12,cx+w*.18,cy+h*.12,cx+w*.32,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.04;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.15,cy-h*.01);ctx.bezierCurveTo(cx-w*.06,cy-h*.06,cx+w*.06,cy-h*.06,cx+w*.15,cy-h*.01);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.025;ctx.stroke();
  }},
  { label: '薄唇', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.55;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy);ctx.bezierCurveTo(cx-w*.16,cy-h*.06,cx+w*.16,cy-h*.06,cx+w*.3,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy);ctx.bezierCurveTo(cx-w*.16,cy+h*.07,cx+w*.16,cy+h*.07,cx+w*.3,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.12,cy);ctx.bezierCurveTo(cx,cy-h*.04,cx+w*.12,cy);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.02;ctx.stroke();
  }},
  { label: '厚唇', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.52;
    ctx.beginPath();ctx.moveTo(cx-w*.34,cy);ctx.bezierCurveTo(cx-w*.2,cy-h*.14,cx+w*.2,cy-h*.14,cx+w*.34,cy);ctx.strokeStyle='#dd5566';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.34,cy);ctx.bezierCurveTo(cx-w*.2,cy+h*.18,cx+w*.2,cy+h*.18,cx+w*.34,cy);ctx.strokeStyle='#dd5566';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.18,cy-h*.01);ctx.bezierCurveTo(cx-w*.07,cy-h*.09,cx+w*.07,cy-h*.09,cx+w*.18,cy-h*.01);ctx.strokeStyle='#bb3344';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  { label: 'アヒル唇', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.52;
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.12,cy-h*.16,cx+w*.12,cy-h*.16,cx+w*.28,cy);ctx.strokeStyle='#ee6677';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.1,cy+h*.1,cx+w*.1,cy+h*.1,cx+w*.28,cy);ctx.strokeStyle='#ee6677';ctx.lineWidth=w*.05;ctx.stroke();
    // くちばし出っ張り
    ctx.beginPath();ctx.moveTo(cx-w*.1,cy-h*.04);ctx.bezierCurveTo(cx,cy-h*.18,cx,cy-h*.18,cx+w*.1,cy-h*.04);ctx.strokeStyle='#cc4455';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  { label: 'ハート唇', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.48;
    // 上唇ハート型
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.28,cy-h*.12,cx-w*.12,cy-h*.14,cx,cy-h*.05);ctx.bezierCurveTo(cx+w*.12,cy-h*.14,cx+w*.28,cy-h*.12,cx+w*.28,cy);ctx.strokeStyle='#ff4466';ctx.lineWidth=w*.04;ctx.stroke();
    // 下唇
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.16,cy+h*.14,cx+w*.16,cy+h*.14,cx+w*.28,cy);ctx.strokeStyle='#ff4466';ctx.lineWidth=w*.04;ctx.stroke();
  }},
  { label: '笑顔口', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.52;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.04);ctx.bezierCurveTo(cx-w*.18,cy+h*.14,cx+w*.18,cy+h*.14,cx+w*.3,cy-h*.04);ctx.strokeStyle='#cc5566';ctx.lineWidth=w*.04;ctx.stroke();
    ctx.beginPath();ctx.arc(cx-w*.3,cy-h*.04,w*.03,0,Math.PI*2);ctx.arc(cx+w*.3,cy-h*.04,w*.03,0,Math.PI*2);ctx.fillStyle='#aa4455';ctx.fill();
  }},
  { label: '猫口', group: '唇', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.54;
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.16,cy+h*.1,cx-w*.04,cy+h*.08,cx,cy);ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx+w*.04,cy+h*.08,cx+w*.16,cy+h*.1,cx+w*.28,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.04;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy);ctx.bezierCurveTo(cx-w*.14,cy-h*.09,cx,cy-h*.07,cx,cy);ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx,cy-h*.07,cx+w*.14,cy-h*.09,cx+w*.28,cy);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.04;ctx.stroke();
    // 中央V
    ctx.beginPath();ctx.moveTo(cx-w*.06,cy-h*.05);ctx.lineTo(cx,cy-h*.1);ctx.lineTo(cx+w*.06,cy-h*.05);ctx.strokeStyle='#cc6677';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  // ── 歯 ──
  { label: '普通の歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.58;
    // 口の輪郭
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.1);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.3,cy-h*.1);ctx.bezierCurveTo(cx+w*.3,cy+h*.08,cx-w*.3,cy+h*.08,cx-w*.3,cy-h*.1);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    // 上の歯列
    ctx.fillStyle='#f5f0e8';
    for(let i=0;i<6;i++){const x=cx-w*.25+i*w*.1;ctx.beginPath();ctx.roundRect(x,cy-h*.16,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();}
    // 下の歯列
    ctx.fillStyle='#f0ece0';
    for(let i=0;i<5;i++){const x=cx-w*.2+i*w*.1;ctx.beginPath();ctx.roundRect(x,cy-h*.04,w*.09,h*.08,2);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();}
  }},
  { label: 'すきっ歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.58;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.1);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.3,cy-h*.1);ctx.bezierCurveTo(cx+w*.3,cy+h*.08,cx-w*.3,cy+h*.08,cx-w*.3,cy-h*.1);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.fillStyle='#f5f0e8';
    for(let i=0;i<6;i++){
      const x=cx-w*.25+i*w*.1;
      if(i===2){ctx.beginPath();ctx.roundRect(x,cy-h*.16,w*.07,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();continue;}
      if(i===3){ctx.beginPath();ctx.roundRect(x+w*.02,cy-h*.16,w*.07,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();continue;}
      ctx.beginPath();ctx.roundRect(x,cy-h*.16,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();
    }
  }},
  { label: '出っ歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.6;
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy-h*.08);ctx.bezierCurveTo(cx-w*.18,cy-h*.16,cx+w*.18,cy-h*.16,cx+w*.28,cy-h*.08);ctx.bezierCurveTo(cx+w*.28,cy+h*.06,cx-w*.28,cy+h*.06,cx-w*.28,cy-h*.08);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.fillStyle='#f5f0e8';
    // 前2本だけ大きく突出
    for(let i=0;i<6;i++){
      const x=cx-w*.25+i*w*.1;
      if(i===2||i===3){ctx.beginPath();ctx.roundRect(x,cy-h*.2,w*.1,h*.14,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();}
      else{ctx.beginPath();ctx.roundRect(x,cy-h*.15,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();}
    }
    ctx.fillStyle='#cc8844';ctx.beginPath();ctx.rect(cx-w*.02,cy-h*.09,w*.04,h*.15);ctx.fill();
  }},
  { label: '八重歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.58;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.1);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.3,cy-h*.1);ctx.bezierCurveTo(cx+w*.3,cy+h*.08,cx-w*.3,cy+h*.08,cx-w*.3,cy-h*.1);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.fillStyle='#f5f0e8';
    for(let i=0;i<6;i++){const x=cx-w*.25+i*w*.1;ctx.beginPath();ctx.roundRect(x,cy-h*.16,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();}
    // 八重歯 (少し前に出て、下に長い犬歯)
    ctx.fillStyle='#f0ece0';
    ctx.beginPath();ctx.moveTo(cx-w*.15,cy-h*.19);ctx.lineTo(cx-w*.1,cy-h*.07);ctx.lineTo(cx-w*.05,cy-h*.19);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+w*.05,cy-h*.19);ctx.lineTo(cx+w*.1,cy-h*.07);ctx.lineTo(cx+w*.15,cy-h*.19);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();
  }},
  { label: 'ギザギザ歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.56;
    ctx.beginPath();ctx.moveTo(cx-w*.32,cy-h*.08);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.32,cy-h*.08);ctx.bezierCurveTo(cx+w*.32,cy+h*.1,cx-w*.32,cy+h*.1,cx-w*.32,cy-h*.08);ctx.fillStyle='#cc3344';ctx.fill();ctx.strokeStyle='#992233';ctx.lineWidth=w*.02;ctx.stroke();
    // 上ギザギザ歯
    ctx.fillStyle='#f5f0e8';
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy-h*.07);
    const n=8;for(let i=0;i<=n;i++){const x=cx-w*.28+i*(w*.56/n);const y=i%2===0?cy-h*.17:cy-h*.07;ctx.lineTo(x,y);}
    ctx.lineTo(cx+w*.28,cy-h*.07);ctx.closePath();ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();
    // 下ギザギザ歯
    ctx.beginPath();ctx.moveTo(cx-w*.26,cy-h*.01);
    const m=7;for(let i=0;i<=m;i++){const x=cx-w*.26+i*(w*.52/m);const y=i%2===0?cy+h*.06:cy-h*.01;ctx.lineTo(x,y);}
    ctx.lineTo(cx+w*.26,cy-h*.01);ctx.closePath();ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=.5;ctx.stroke();
  }},
  { label: 'ドラキュラ歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.56;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.08);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.3,cy-h*.08);ctx.bezierCurveTo(cx+w*.3,cy+h*.1,cx-w*.3,cy+h*.1,cx-w*.3,cy-h*.08);ctx.fillStyle='#8b0000';ctx.fill();ctx.strokeStyle='#660000';ctx.lineWidth=w*.02;ctx.stroke();
    ctx.fillStyle='#f5f0e8';
    for(let i=0;i<6;i++){const x=cx-w*.25+i*w*.1;if(i===1||i===4)continue;ctx.beginPath();ctx.roundRect(x,cy-h*.17,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();}
    // 左右の牙
    ctx.fillStyle='#fffaf0';
    ctx.beginPath();ctx.moveTo(cx-w*.15,cy-h*.18);ctx.lineTo(cx-w*.08,cy+h*.04);ctx.lineTo(cx-w*.05,cy-h*.18);ctx.fill();ctx.strokeStyle='#e8e0d0';ctx.lineWidth=.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+w*.05,cy-h*.18);ctx.lineTo(cx+w*.08,cy+h*.04);ctx.lineTo(cx+w*.15,cy-h*.18);ctx.fill();ctx.strokeStyle='#e8e0d0';ctx.lineWidth=.5;ctx.stroke();
    // 血
    ctx.beginPath();ctx.arc(cx-w*.065,cy+h*.04,w*.012,0,Math.PI*2);ctx.fillStyle='#cc0011';ctx.fill();
    ctx.beginPath();ctx.arc(cx+w*.065,cy+h*.04,w*.012,0,Math.PI*2);ctx.fillStyle='#cc0011';ctx.fill();
  }},
  { label: '金歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.58;
    ctx.beginPath();ctx.moveTo(cx-w*.3,cy-h*.1);ctx.bezierCurveTo(cx-w*.2,cy-h*.18,cx+w*.2,cy-h*.18,cx+w*.3,cy-h*.1);ctx.bezierCurveTo(cx+w*.3,cy+h*.08,cx-w*.3,cy+h*.08,cx-w*.3,cy-h*.1);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    for(let i=0;i<6;i++){
      const x=cx-w*.25+i*w*.1;
      const gold=(i===2||i===3);
      ctx.fillStyle=gold?'#c8a030':'#f5f0e8';
      ctx.beginPath();ctx.roundRect(x,cy-h*.16,w*.09,h*.1,2);ctx.fill();
      ctx.strokeStyle=gold?'#a07820':'#ddd8c8';ctx.lineWidth=.5;ctx.stroke();
      if(gold){ctx.beginPath();ctx.arc(x+w*.045,cy-h*.13,w*.015,0,Math.PI*2);ctx.fillStyle='rgba(255,255,200,.6)';ctx.fill();}
    }
  }},
  { label: '兎歯', group: '歯', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.58;
    ctx.beginPath();ctx.moveTo(cx-w*.28,cy-h*.08);ctx.bezierCurveTo(cx-w*.18,cy-h*.16,cx+w*.18,cy-h*.16,cx+w*.28,cy-h*.08);ctx.bezierCurveTo(cx+w*.28,cy+h*.08,cx-w*.28,cy+h*.08,cx-w*.28,cy-h*.08);ctx.strokeStyle='#aa4455';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.fillStyle='#f5f0e8';
    for(let i=0;i<6;i++){const x=cx-w*.25+i*w*.1;ctx.beginPath();ctx.roundRect(x,cy-h*.15,w*.09,h*.1,2);ctx.fill();ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.stroke();}
    // 正面2本だけ長く大きく
    ctx.fillStyle='#f8f4ec';
    ctx.beginPath();ctx.roundRect(cx-w*.12,cy-h*.22,w*.11,h*.18,3);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.roundRect(cx+w*.01,cy-h*.22,w*.11,h*.18,3);ctx.fill();ctx.strokeStyle='#ddd8c8';ctx.lineWidth=1;ctx.stroke();
    // 線
    ctx.beginPath();ctx.moveTo(cx-w*.06,cy-h*.22);ctx.lineTo(cx-w*.04,cy-h*.06);ctx.strokeStyle='#e0dcd0';ctx.lineWidth=.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+w*.06,cy-h*.22);ctx.lineTo(cx+w*.04,cy-h*.06);ctx.strokeStyle='#e0dcd0';ctx.lineWidth=.5;ctx.stroke();
  }},
];

// 口元パネル状態
const MOUTH_PW = 240, MOUTH_PH = 200;
const mouthState = {
  selTmplIdx: -1,
  lipColor: '#cc6677',
  teethColor: '#f5f0e8',
  lipThick: 5,
};
const mouthPaintState = {
  tool: 'pen', color: '#cc6677', size: 8, wet: 0, opacity: 1,
  drawing: false, startX: 0, startY: 0, imageData: null, customList: [],
};

function drawMouthGuide(ctx, w, h) {
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = '#2a3555';
  ctx.lineWidth = 1;
  // 上唇輪郭ガイド
  ctx.beginPath();
  ctx.moveTo(w*.2,h*.48);
  ctx.bezierCurveTo(w*.28,h*.34,w*.42,h*.32,w*.5,h*.38);
  ctx.bezierCurveTo(w*.58,h*.32,w*.72,h*.34,w*.8,h*.48);
  ctx.stroke();
  // 下唇輪郭ガイド
  ctx.beginPath();
  ctx.moveTo(w*.2,h*.48);
  ctx.bezierCurveTo(w*.28,h*.66,w*.72,h*.66,w*.8,h*.48);
  ctx.stroke();
  // 歯の境界線
  ctx.beginPath();
  ctx.moveTo(w*.22,h*.47);
  ctx.lineTo(w*.78,h*.47);
  ctx.stroke();
  ctx.restore();
}

function buildMouthPanel(area) {
  area.innerHTML = '';

  // ── テンプレートグリッド ──
  const groups = [...new Set(MOUTH_TEMPLATES.map(t=>t.group))];
  groups.forEach(grp => {
    const sep = document.createElement('div');
    sep.className = 'nose-sep'; sep.textContent = grp;
    area.appendChild(sep);
    const grid = document.createElement('div');
    grid.className = 'thumb-grid';
    MOUTH_TEMPLATES.forEach((tmpl, i) => {
      if (tmpl.group !== grp) return;
      const cell = document.createElement('div');
      cell.className = 'thumb-cell' + (mouthState.selTmplIdx===i?' selected':'');
      const cvs = document.createElement('canvas'); cvs.width=72; cvs.height=72;
      const tc = cvs.getContext('2d');
      tc.fillStyle='#181c2e'; tc.fillRect(0,0,72,72);
      tmpl.draw(tc, 72, 72);
      cell.appendChild(cvs);
      const lbl = document.createElement('div'); lbl.className='thumb-label'; lbl.textContent=tmpl.label;
      cell.appendChild(lbl);
      cell.addEventListener('click', () => {
        mouthState.selTmplIdx = i;
        buildMouthPanel(area);
      });
      grid.appendChild(cell);
    });
    area.appendChild(grid);
  });

  // ── カスタム保存済みリスト ──
  if (mouthPaintState.customList.length > 0) {
    const sep = document.createElement('div');
    sep.className = 'nose-sep'; sep.textContent = 'カスタム保存';
    area.appendChild(sep);
    const grid2 = document.createElement('div'); grid2.className = 'thumb-grid';
    mouthPaintState.customList.forEach((url, ci) => {
      const cell = document.createElement('div'); cell.className = 'thumb-cell';
      const img = document.createElement('img'); img.src = url; img.width = 72; img.height = 72;
      cell.appendChild(img);
      grid2.appendChild(cell);
    });
    area.appendChild(grid2);
  }

  // ── 色・スライダー設定 ──
  const sep2 = document.createElement('div'); sep2.className = 'nose-sep'; sep2.textContent = '色・形調整';
  area.appendChild(sep2);

  // 唇の色
  const lipRow = document.createElement('div'); lipRow.className = 'ear-tool-row';
  const lipLbl = document.createElement('span'); lipLbl.className = 'ear-tool-lbl'; lipLbl.textContent = '唇の色';
  const lipPick = document.createElement('input'); lipPick.type='color'; lipPick.value=mouthState.lipColor; lipPick.className='bez-color-picker';
  lipPick.addEventListener('input', e => {
    mouthState.lipColor = e.target.value;
    mouthPaintState.color = e.target.value;
  });
  const lipSwatches = document.createElement('div'); lipSwatches.style.cssText='display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;';
  ['#cc6677','#dd4466','#ff2255','#ee88aa','#ffaacc','#c06080','#aa3355','#883344','#ff6666','#ffaa88','#8b0000','#d2691e'].forEach(c=>{
    const sw=document.createElement('div');
    sw.style.cssText=`width:16px;height:16px;background:${c};border-radius:50%;cursor:pointer;border:1px solid #333;`;
    sw.addEventListener('click',()=>{ mouthState.lipColor=c; lipPick.value=c; mouthPaintState.color=c; });
    lipSwatches.appendChild(sw);
  });
  lipRow.appendChild(lipLbl); lipRow.appendChild(lipPick);
  area.appendChild(lipRow); area.appendChild(lipSwatches);

  // 歯の色
  const teethRow = document.createElement('div'); teethRow.className = 'ear-tool-row';
  teethRow.style.marginTop='6px';
  const teethLbl = document.createElement('span'); teethLbl.className = 'ear-tool-lbl'; teethLbl.textContent = '歯の色';
  const teethPick = document.createElement('input'); teethPick.type='color'; teethPick.value=mouthState.teethColor; teethPick.className='bez-color-picker';
  teethPick.addEventListener('input', e => { mouthState.teethColor = e.target.value; });
  const teethSwatches = document.createElement('div'); teethSwatches.style.cssText='display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;';
  ['#f5f0e8','#fffaf0','#fffff0','#e8dcc8','#c8a030','#c0c0c0','#e8e0d0','#ddd','#8b4513','#cc0011','#4a4a4a','#111'].forEach(c=>{
    const sw=document.createElement('div');
    sw.style.cssText=`width:16px;height:16px;background:${c};border-radius:50%;cursor:pointer;border:1px solid #444;`;
    sw.addEventListener('click',()=>{ mouthState.teethColor=c; teethPick.value=c; });
    teethSwatches.appendChild(sw);
  });
  teethRow.appendChild(teethLbl); teethRow.appendChild(teethPick);
  area.appendChild(teethRow); area.appendChild(teethSwatches);

  // 唇の厚さスライダー
  const thickRow = document.createElement('div'); thickRow.className='ear-tool-row'; thickRow.style.marginTop='6px';
  const thickLbl=document.createElement('span'); thickLbl.className='ear-tool-lbl'; thickLbl.textContent='唇の厚さ';
  const thickSlider=document.createElement('input'); thickSlider.type='range'; thickSlider.min=1; thickSlider.max=10; thickSlider.step=0.5; thickSlider.value=mouthState.lipThick; thickSlider.style.flex='1';
  const thickVal=document.createElement('span'); thickVal.className='sl-val'; thickVal.textContent=mouthState.lipThick;
  thickSlider.addEventListener('input',e=>{ mouthState.lipThick=parseFloat(e.target.value); thickVal.textContent=e.target.value; });
  thickRow.appendChild(thickLbl); thickRow.appendChild(thickSlider); thickRow.appendChild(thickVal);
  area.appendChild(thickRow);

  // ── 2D ペイントキャンバス ──
  const sep3 = document.createElement('div'); sep3.className = 'nose-sep'; sep3.textContent = '2Dペイント（1から作る）';
  area.appendChild(sep3);

  // ペイントツールバー
  const toolRow = document.createElement('div'); toolRow.className = 'ear-tool-row';
  const toolDefs = [
    { key:'pen', label:'ペン' }, { key:'eraser', label:'消す' },
    { key:'circle', label:'円' }, { key:'rect', label:'□' },
  ];
  toolDefs.forEach(td => {
    const btn = document.createElement('button'); btn.className='ear-tool-btn'+(mouthPaintState.tool===td.key?' active':'');
    btn.textContent=td.label;
    btn.addEventListener('click',()=>{ mouthPaintState.tool=td.key; buildMouthPanel(area); });
    toolRow.appendChild(btn);
  });
  area.appendChild(toolRow);

  // サイズ・濡れスライダー
  [
    { label:'サイズ', key:'size',    min:2, max:40, step:1 },
    { label:'濡れ',   key:'wet',     min:0, max:20, step:1 },
    { label:'透明度', key:'opacity', min:.1, max:1, step:.05 },
  ].forEach(def => {
    const row=document.createElement('div'); row.className='ear-tool-row';
    const lbl=document.createElement('span'); lbl.className='ear-tool-lbl'; lbl.textContent=def.label;
    const sl=document.createElement('input'); sl.type='range'; sl.min=def.min; sl.max=def.max; sl.step=def.step; sl.value=mouthPaintState[def.key]; sl.style.flex='1';
    const vl=document.createElement('span'); vl.className='sl-val'; vl.textContent=mouthPaintState[def.key];
    sl.addEventListener('input',e=>{ mouthPaintState[def.key]=parseFloat(e.target.value); vl.textContent=e.target.value; });
    row.appendChild(lbl); row.appendChild(sl); row.appendChild(vl); area.appendChild(row);
  });

  // カラーピッカー（ペイント用）
  const pcRow=document.createElement('div'); pcRow.className='ear-tool-row';
  const pcLbl=document.createElement('span'); pcLbl.className='ear-tool-lbl'; pcLbl.textContent='色';
  const pcPick=document.createElement('input'); pcPick.type='color'; pcPick.value=mouthPaintState.color; pcPick.className='bez-color-picker';
  pcPick.addEventListener('input',e=>{ mouthPaintState.color=e.target.value; });
  pcRow.appendChild(pcLbl); pcRow.appendChild(pcPick);
  area.appendChild(pcRow);

  // キャンバス二層
  const wrap = document.createElement('div'); wrap.style.cssText=`position:relative;width:${MOUTH_PW}px;height:${MOUTH_PH}px;margin:6px auto;border:1px solid #2a3555;border-radius:4px;overflow:hidden;`;
  const guideCvs = document.createElement('canvas'); guideCvs.width=MOUTH_PW; guideCvs.height=MOUTH_PH; guideCvs.style.cssText='position:absolute;top:0;left:0;pointer-events:none;';
  const paintCvs = document.createElement('canvas'); paintCvs.width=MOUTH_PW; paintCvs.height=MOUTH_PH; paintCvs.style.cssText='position:absolute;top:0;left:0;cursor:crosshair;';
  // ガイド描画
  const gc = guideCvs.getContext('2d');
  gc.fillStyle='#12172a'; gc.fillRect(0,0,MOUTH_PW,MOUTH_PH);
  if (mouthState.selTmplIdx >= 0) {
    MOUTH_TEMPLATES[mouthState.selTmplIdx].draw(gc, MOUTH_PW, MOUTH_PH);
  }
  drawMouthGuide(gc, MOUTH_PW, MOUTH_PH);
  // ペイント層を復元
  if (mouthPaintState.imageData) paintCvs.getContext('2d').putImageData(mouthPaintState.imageData, 0, 0);
  wrap.appendChild(guideCvs); wrap.appendChild(paintCvs);
  area.appendChild(wrap);

  // セーブ・クリアボタン
  const btnRow = document.createElement('div'); btnRow.style.cssText='display:flex;gap:6px;margin:4px 0;';
  const clrBtn = document.createElement('button'); clrBtn.className='deco-action-btn'; clrBtn.textContent='クリア';
  clrBtn.addEventListener('click',()=>{ paintCvs.getContext('2d').clearRect(0,0,MOUTH_PW,MOUTH_PH); mouthPaintState.imageData=null; });
  const saveBtn = document.createElement('button'); saveBtn.className='deco-action-btn'; saveBtn.textContent='保存';
  saveBtn.addEventListener('click',()=>{
    const tc2=document.createElement('canvas'); tc2.width=72; tc2.height=72;
    const tx=tc2.getContext('2d'); tx.drawImage(guideCvs,0,0,72,72); tx.drawImage(paintCvs,0,0,72,72);
    mouthPaintState.customList.push(tc2.toDataURL());
    mouthPaintState.imageData=paintCvs.getContext('2d').getImageData(0,0,MOUTH_PW,MOUTH_PH);
    buildMouthPanel(area);
  });
  btnRow.appendChild(clrBtn); btnRow.appendChild(saveBtn);
  area.appendChild(btnRow);

  // 3Dペイントボタン
  const p3dBtn = document.createElement('button'); p3dBtn.className='deco-action-btn'; p3dBtn.textContent='3Dペイントで口元を塗る';
  p3dBtn.style.cssText='width:100%;margin-top:4px;background:#1e3a5a;';
  p3dBtn.addEventListener('click', () => {
    const partSel = document.getElementById('p3d-part');
    if (partSel) partSel.value='head';
    if (typeof enterPaint3d === 'function') enterPaint3d();
    else document.getElementById('btn-paint3d')?.click();
  });
  area.appendChild(p3dBtn);

  // ── ペイントイベント ──
  const ctx = paintCvs.getContext('2d');
  const getPos = e => {
    const rect = paintCvs.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(MOUTH_PW/rect.width), y:(e.clientY-rect.top)*(MOUTH_PH/rect.height) };
  };
  const applyStyle = () => {
    ctx.globalAlpha = mouthPaintState.opacity;
    ctx.shadowBlur = mouthPaintState.wet * 2;
    ctx.shadowColor = mouthPaintState.color;
    ctx.lineWidth = mouthPaintState.size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (mouthPaintState.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle='rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = mouthPaintState.color; ctx.fillStyle = mouthPaintState.color;
    }
  };
  paintCvs.addEventListener('pointerdown', e => {
    e.preventDefault(); paintCvs.setPointerCapture(e.pointerId);
    mouthPaintState.drawing = true;
    const {x,y} = getPos(e);
    mouthPaintState.startX=x; mouthPaintState.startY=y;
    mouthPaintState.imageData = ctx.getImageData(0,0,MOUTH_PW,MOUTH_PH);
    applyStyle();
    if (mouthPaintState.tool==='pen'||mouthPaintState.tool==='eraser') { ctx.beginPath(); ctx.moveTo(x,y); }
  });
  paintCvs.addEventListener('pointermove', e => {
    if (!mouthPaintState.drawing) return;
    const {x,y} = getPos(e);
    applyStyle();
    const t = mouthPaintState.tool;
    if (t==='pen'||t==='eraser') {
      ctx.lineTo(x,y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y);
    } else {
      ctx.putImageData(mouthPaintState.imageData,0,0); applyStyle();
      const sx=mouthPaintState.startX, sy=mouthPaintState.startY;
      ctx.beginPath();
      if (t==='circle'){const rx=Math.abs(x-sx)/2,ry=Math.abs(y-sy)/2;ctx.ellipse(sx+(x-sx)/2,sy+(y-sy)/2,rx,ry,0,0,Math.PI*2);}
      else if(t==='rect'){ctx.rect(sx,sy,x-sx,y-sy);}
      ctx.stroke();
      ctx.globalAlpha=mouthPaintState.opacity*.3; ctx.fill(); ctx.globalAlpha=mouthPaintState.opacity;
    }
  });
  paintCvs.addEventListener('pointerup', e => {
    if (!mouthPaintState.drawing) return;
    mouthPaintState.drawing = false;
    const {x,y} = getPos(e);
    const t = mouthPaintState.tool; applyStyle();
    if (t!=='pen'&&t!=='eraser') {
      ctx.putImageData(mouthPaintState.imageData,0,0); applyStyle();
      const sx=mouthPaintState.startX, sy=mouthPaintState.startY;
      ctx.beginPath();
      if(t==='circle'){const rx=Math.abs(x-sx)/2,ry=Math.abs(y-sy)/2;ctx.ellipse(sx+(x-sx)/2,sy+(y-sy)/2,rx,ry,0,0,Math.PI*2);}
      else if(t==='rect'){ctx.rect(sx,sy,x-sx,y-sy);}
      ctx.stroke(); ctx.globalAlpha=mouthPaintState.opacity*.35; ctx.fill();
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.shadowBlur=0;
    mouthPaintState.imageData = ctx.getImageData(0,0,MOUTH_PW,MOUTH_PH);
  });
}

// ═══════════════════════════════════════════════════════════════
//  首パネル（アクセ・タトゥー・ほくろ・3Dペイント）
// ═══════════════════════════════════════════════════════════════
const NECK_ACC_TEMPLATES = [
  // ── チョーカー ──
  { label: '細チョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.moveTo(w*.1,cy);ctx.lineTo(w*.9,cy);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.04;ctx.stroke();
    [w*.1,w*.9].forEach(x=>{ctx.beginPath();ctx.arc(x,cy,w*.03,0,Math.PI*2);ctx.fillStyle='#d4b040';ctx.fill();});
  }},
  { label: '太チョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.08,cy-h*.06,w*.84,h*.12,h*.05);ctx.fillStyle='#1a1a1a';ctx.fill();ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();
    for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(w*.2+i*w*.15,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();}
  }},
  { label: 'チェーンチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    for(let i=0;i<12;i++){
      const x=w*.1+i*w*.068;
      ctx.beginPath();ctx.ellipse(x,cy,w*.03,h*.025,i%2===0?0:Math.PI/2,0,Math.PI*2);
      ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    }
  }},
  { label: 'レースチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.moveTo(w*.08,cy-h*.05);ctx.lineTo(w*.92,cy-h*.05);ctx.lineTo(w*.92,cy+h*.05);ctx.lineTo(w*.08,cy+h*.05);ctx.closePath();ctx.fillStyle='rgba(255,220,240,0.15)';ctx.fill();ctx.strokeStyle='#e8c8d8';ctx.lineWidth=.5;ctx.stroke();
    for(let i=0;i<9;i++){const x=w*.12+i*w*.096;ctx.beginPath();ctx.moveTo(x,cy-h*.05);ctx.bezierCurveTo(x-w*.02,cy,x+w*.02,cy,x,cy+h*.05);ctx.strokeStyle='#e8c8d8';ctx.lineWidth=.5;ctx.stroke();}
  }},
  { label: 'スパイクチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.08,cy-h*.04,w*.84,h*.08,h*.04);ctx.fillStyle='#1a1a2a';ctx.fill();
    for(let i=0;i<9;i++){const x=w*.12+i*w*.096;ctx.beginPath();ctx.moveTo(x-w*.02,cy-h*.04);ctx.lineTo(x,cy-h*.1);ctx.lineTo(x+w*.02,cy-h*.04);ctx.fillStyle='#888';ctx.fill();}
  }},
  { label: 'クロスチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38,cx=w*.5;
    ctx.beginPath();ctx.moveTo(w*.08,cy);ctx.lineTo(cx-w*.08,cy);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+w*.08,cy);ctx.lineTo(w*.92,cy);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=w*.03;ctx.stroke();
    const cw=w*.06,ch=h*.1;
    ctx.beginPath();ctx.rect(cx-cw*.3,cy-ch*.5,cw*.6,ch);ctx.fillStyle='#c8a030';ctx.fill();
    ctx.beginPath();ctx.rect(cx-cw*.5,cy-ch*.2,cw,ch*.4);ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label: '蝶チョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38,cx=w*.5;
    ctx.beginPath();ctx.moveTo(w*.08,cy);ctx.lineTo(cx-w*.14,cy);ctx.moveTo(cx+w*.14,cy);ctx.lineTo(w*.92,cy);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=w*.03;ctx.stroke();
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx+sx*w*.14,cy+sy*h*.04,cx+sx*w*.12,cy+sy*h*.08,cx,cy+sy*h*.04);ctx.fillStyle=sx<0?'rgba(120,180,255,.9)':'rgba(255,140,200,.9)';ctx.fill();});
    ctx.beginPath();ctx.arc(cx,cy,w*.018,0,Math.PI*2);ctx.fillStyle='#333';ctx.fill();
  }},
  { label: 'フラワーチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38,cx=w*.5;
    ctx.beginPath();ctx.moveTo(w*.08,cy);ctx.lineTo(cx-w*.1,cy);ctx.moveTo(cx+w*.1,cy);ctx.lineTo(w*.92,cy);ctx.strokeStyle='#3d2000';ctx.lineWidth=w*.02;ctx.stroke();
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.085,cy+Math.sin(a)*h*.07,w*.05,h*.04,a,0,Math.PI*2);ctx.fillStyle=['#ff88aa','#ffaacc','#ff66aa'][i%3];ctx.fill();}
    ctx.beginPath();ctx.arc(cx,cy,w*.028,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label: 'リボンチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38,cx=w*.5;
    ctx.beginPath();ctx.moveTo(w*.08,cy);ctx.lineTo(cx-w*.1,cy);ctx.moveTo(cx+w*.1,cy);ctx.lineTo(w*.92,cy);ctx.strokeStyle='#cc2244';ctx.lineWidth=w*.035;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx-w*.16,cy-h*.08,cx-w*.14,cy+h*.08,cx,cy);ctx.bezierCurveTo(cx+w*.16,cy-h*.08,cx+w*.14,cy+h*.08,cx,cy);ctx.fillStyle='#ee3366';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,w*.022,0,Math.PI*2);ctx.fillStyle='#aa1133';ctx.fill();
  }},
  { label: 'ジュエルチョーカー', group: 'チョーカー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.08,cy-h*.04,w*.84,h*.08,h*.04);ctx.fillStyle='#0a0a0a';ctx.fill();
    const gems=[['#ff4488',w*.2],['#4488ff',w*.32],['#44ff88',w*.44],['#ffdd44',w*.56],['#ff4488',w*.68],['#4488ff',w*.8]];
    gems.forEach(([c,x])=>{ctx.beginPath();ctx.arc(x,cy,w*.04,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();ctx.beginPath();ctx.arc(x-w*.013,cy-h*.013,w*.012,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();});
  }},
  // ── ネックレス ──
  { label: '一連パール', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy,w*.36,Math.PI*.85,Math.PI*.15);ctx.strokeStyle='transparent';ctx.stroke();
    const n=14;for(let i=0;i<n;i++){const a=Math.PI*.85+i*(Math.PI*.3/(n-1));ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.36,cy+Math.sin(a)*w*.36,w*.028,0,Math.PI*2);ctx.fillStyle='#f0e8f0';ctx.fill();ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.36-w*.007,cy+Math.sin(a)*w*.36-h*.007,w*.008,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fill();}
  }},
  { label: '二連パール', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5;
    [h*.34,h*.44].forEach((cy,li)=>{
      const n=li===0?14:16,r=w*.38+li*w*.04;
      for(let i=0;i<n;i++){const a=Math.PI*.82+i*(Math.PI*.36/(n-1));const px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;ctx.beginPath();ctx.arc(px,py,w*.024,0,Math.PI*2);ctx.fillStyle='#f0e8f0';ctx.fill();ctx.beginPath();ctx.arc(px-w*.006,py-h*.006,w*.007,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.8)';ctx.fill();}
    });
  }},
  { label: '星ペンダント', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy-h*.06,w*.3,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.72);ctx.lineTo(cx,cy+h*.02);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    const r=w*.1;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,ir=i%2===0?r:r*.4;i===0?ctx.moveTo(cx+Math.cos(a)*ir,h*.68+Math.sin(a)*ir):ctx.lineTo(cx+Math.cos(a)*ir,h*.68+Math.sin(a)*ir);}ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label: '月ペンダント', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy-h*.06,w*.3,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.7);ctx.lineTo(cx,cy+h*.02);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,h*.72,w*.1,0,Math.PI*2);ctx.fillStyle='#e8e070';ctx.fill();
    ctx.beginPath();ctx.arc(cx+w*.06,h*.70,w*.082,0,Math.PI*2);ctx.fillStyle='#0a0c14';ctx.fill();
  }},
  { label: 'ハートペンダント', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy-h*.06,w*.3,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.7);ctx.lineTo(cx,cy+h*.02);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    const hcy=h*.72,r=w*.07;ctx.beginPath();ctx.moveTo(cx,hcy+r*.5);ctx.bezierCurveTo(cx,hcy-r*.3,cx-r*1.5,hcy-r*.3,cx-r*1.5,hcy+r*.3);ctx.bezierCurveTo(cx-r*1.5,hcy+r,cx,hcy+r*1.6,cx,hcy+r*.5);ctx.bezierCurveTo(cx,hcy+r*1.6,cx+r*1.5,hcy+r,cx+r*1.5,hcy+r*.3);ctx.bezierCurveTo(cx+r*1.5,hcy-r*.3,cx,hcy-r*.3,cx,hcy+r*.5);ctx.fillStyle='#ff2244';ctx.fill();
  }},
  { label: 'クロスペンダント', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy-h*.06,w*.3,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.68);ctx.lineTo(cx,cy+h*.02);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();
    const bx=cx,by=h*.71,cw2=w*.04,ch2=h*.1;ctx.beginPath();ctx.rect(bx-cw2*.4,by-ch2*.55,cw2*.8,ch2);ctx.fillStyle='#c8a030';ctx.fill();ctx.beginPath();ctx.rect(bx-cw2*.65,by-ch2*.22,cw2*1.3,ch2*.35);ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label: 'クリスタルペンダント', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.38;
    ctx.beginPath();ctx.arc(cx,cy-h*.06,w*.3,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#8888cc';ctx.lineWidth=w*.016;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.68);ctx.lineTo(cx,cy+h*.02);ctx.strokeStyle='#8888cc';ctx.lineWidth=w*.016;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.66);ctx.lineTo(cx-w*.06,h*.73);ctx.lineTo(cx,h*.82);ctx.lineTo(cx+w*.06,h*.73);ctx.closePath();
    const g=ctx.createLinearGradient(cx-w*.06,h*.66,cx+w*.06,h*.82);g.addColorStop(0,'rgba(180,200,255,.9)');g.addColorStop(.5,'rgba(100,140,255,.6)');g.addColorStop(1,'rgba(200,220,255,.8)');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#aabbff';ctx.lineWidth=.5;ctx.stroke();
  }},
  { label: '金チェーン', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.4;
    for(let i=0;i<16;i++){
      const a=Math.PI*.78+i*(Math.PI*.44/15);const x=cx+Math.cos(a)*w*.38,y=cy+Math.sin(a)*w*.38;
      ctx.beginPath();ctx.ellipse(x,y,w*.025,h*.018,a+Math.PI/2,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.016;ctx.stroke();
    }
  }},
  { label: 'ロングネックレス', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5;
    ctx.beginPath();ctx.arc(cx,h*.3,w*.44,Math.PI*.75,Math.PI*.25);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.12,h*.54);ctx.lineTo(cx,h*.82);ctx.lineTo(cx+w*.12,h*.54);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,h*.82,w*.04,0,Math.PI*2);ctx.fillStyle='#e8d080';ctx.fill();
  }},
  { label: 'Yネックレス', group: 'ネックレス', draw(ctx,w,h) {
    const cx=w*.5,cy=h*.34;
    ctx.beginPath();ctx.arc(cx,cy,w*.38,Math.PI*.8,Math.PI*.2);ctx.strokeStyle='#c8c8c8';ctx.lineWidth=w*.015;ctx.stroke();
    const lx1=cx-Math.cos(Math.PI*.2)*w*.38,ly1=cy+Math.sin(Math.PI*.2)*w*.38;
    const lx2=cx+Math.cos(Math.PI*.2)*w*.38,ly2=cy+Math.sin(Math.PI*.2)*w*.38;
    ctx.beginPath();ctx.moveTo(lx1,ly1);ctx.lineTo(cx,h*.68);ctx.moveTo(lx2,ly2);ctx.lineTo(cx,h*.68);ctx.strokeStyle='#c8c8c8';ctx.lineWidth=w*.015;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,h*.68);ctx.lineTo(cx,h*.82);ctx.strokeStyle='#c8c8c8';ctx.lineWidth=w*.015;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,h*.82,w*.03,0,Math.PI*2);ctx.fillStyle='#e0d8f0';ctx.fill();
  }},
  // ── カラー・首輪 ──
  { label: '首輪', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.06,w*.88,h*.12,h*.06);ctx.fillStyle='#1a0a00';ctx.fill();ctx.strokeStyle='#3d2000';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,cy+h*.07,w*.04,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label: 'リングカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.ellipse(w*.5,cy,w*.4,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#c8c8c8';ctx.lineWidth=w*.05;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,cy+h*.07,w*.035,0,Math.PI*2);ctx.strokeStyle='#c8c8c8';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  { label: 'スタッズカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.055,w*.88,h*.11,h*.055);ctx.fillStyle='#0a0a0a';ctx.fill();
    for(let i=0;i<10;i++){const x=w*.1+i*w*.09;ctx.beginPath();ctx.arc(x,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();}
  }},
  { label: 'リボンカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38,cx=w*.5;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.04,w*.88,h*.08,h*.04);ctx.fillStyle='#cc2244';ctx.fill();
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.bezierCurveTo(cx-w*.14,cy-h*.07,cx-w*.12,cy+h*.07,cx,cy);ctx.bezierCurveTo(cx+w*.14,cy-h*.07,cx+w*.12,cy+h*.07,cx,cy);ctx.fillStyle='#ee3366';ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#aa1133';ctx.fill();
  }},
  { label: 'モフモフカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    for(let i=0;i<18;i++){const x=w*.08+i*w*.048;const oy=Math.sin(i*.8)*h*.015;ctx.beginPath();ctx.arc(x,cy+oy,w*.038,0,Math.PI*2);ctx.fillStyle=i%2===0?'#f0f0f0':'#e0e0e0';ctx.fill();}
    ctx.beginPath();ctx.arc(w*.5,cy+h*.065,w*.03,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label: 'ビジューカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.04,w*.88,h*.08,h*.04);ctx.fillStyle='#1a0a1a';ctx.fill();
    const cols=['#ff4488','#4488ff','#ffdd44','#44ffaa','#ff8844'];
    for(let i=0;i<8;i++){const x=w*.12+i*w*.107;ctx.beginPath();ctx.arc(x,cy,w*.034,0,Math.PI*2);ctx.fillStyle=cols[i%5];ctx.fill();ctx.beginPath();ctx.arc(x-w*.01,cy-h*.01,w*.01,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.7)';ctx.fill();}
  }},
  { label: '着物衿', group: 'カラー', draw(ctx,w,h) {
    const cx=w*.5;
    ctx.beginPath();ctx.moveTo(cx-w*.32,h*.22);ctx.lineTo(cx-w*.1,h*.72);ctx.lineTo(cx,h*.62);ctx.lineTo(cx+w*.1,h*.72);ctx.lineTo(cx+w*.32,h*.22);ctx.strokeStyle='#f0e8d0';ctx.lineWidth=w*.06;ctx.stroke();ctx.strokeStyle='#e8d8b8';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-w*.2,h*.22);ctx.lineTo(cx-w*.06,h*.64);ctx.lineTo(cx,h*.56);ctx.lineTo(cx+w*.06,h*.64);ctx.lineTo(cx+w*.2,h*.22);ctx.strokeStyle='#cc2244';ctx.lineWidth=w*.022;ctx.stroke();
  }},
  { label: 'ベルカラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.04,w*.88,h*.08,h*.04);ctx.fillStyle='#cc6600';ctx.fill();
    const bx=w*.5,by=cy+h*.08;
    ctx.beginPath();ctx.arc(bx,by,w*.04,0,Math.PI);ctx.lineTo(bx-w*.04,by);ctx.fillStyle='#c8a030';ctx.fill();ctx.strokeStyle='#a08820';ctx.lineWidth=w*.012;ctx.stroke();
    ctx.beginPath();ctx.arc(bx,by+h*.03,w*.008,0,Math.PI*2);ctx.fillStyle='#806810';ctx.fill();
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx,cy+h*.04);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.014;ctx.stroke();
  }},
  { label: 'チェーンリーシュ', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.04,w*.88,h*.08,h*.04);ctx.fillStyle='#1a1a1a';ctx.fill();
    const n=8;for(let i=0;i<n;i++){const x=w*.5+(i-n/2)*w*.06;const y=cy+h*.07+i*h*.025;ctx.beginPath();ctx.ellipse(x,y,w*.022,h*.016,i%2===0?0:Math.PI/2,0,Math.PI*2);ctx.strokeStyle='#888';ctx.lineWidth=w*.014;ctx.stroke();}
  }},
  { label: '金属カラー', group: 'カラー', draw(ctx,w,h) {
    const cy=h*.38;
    const g=ctx.createLinearGradient(0,cy-h*.07,0,cy+h*.07);g.addColorStop(0,'#e0e0e0');g.addColorStop(.4,'#c0c0c0');g.addColorStop(.6,'#a0a0a0');g.addColorStop(1,'#d0d0d0');
    ctx.beginPath();ctx.roundRect(w*.06,cy-h*.065,w*.88,h*.13,h*.04);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#808080';ctx.lineWidth=1;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,cy+h*.072,w*.038,0,Math.PI*2);ctx.strokeStyle='#a0a0a0';ctx.lineWidth=w*.022;ctx.stroke();
  }},
];

// 首パネル状態
const NECK_CW = 240, NECK_CH = 300;
const neckAccState  = { selIdx: -1 };
const neckTattooState = { list:[], selIdx:-1, presetSel:-1, newSize:55, newRot:0, activeUrl:null };
const neckMoleState = {
  list:[], selIdx:-1,
  newShape:0, newSize:7, newColor:'#1a0a00',
};
const neckPaintState = {
  tool:'pen', color:'#c8a030', size:10, wet:0, opacity:1,
  drawing:false, startX:0, startY:0, imageData:null,
};

function drawNeckGuide(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = '#2a3555';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  // 首の輪郭
  ctx.beginPath();
  ctx.moveTo(w*.36, h*.04);
  ctx.bezierCurveTo(w*.3, h*.12, w*.28, h*.28, w*.3, h*.42);
  ctx.bezierCurveTo(w*.32, h*.56, w*.28, h*.64, w*.18, h*.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w*.64, h*.04);
  ctx.bezierCurveTo(w*.7, h*.12, w*.72, h*.28, w*.7, h*.42);
  ctx.bezierCurveTo(w*.68, h*.56, w*.72, h*.64, w*.82, h*.72);
  ctx.stroke();
  // 鎖骨ライン
  ctx.beginPath();
  ctx.moveTo(w*.04, h*.76);
  ctx.bezierCurveTo(w*.2, h*.7, w*.38, h*.72, w*.5, h*.74);
  ctx.bezierCurveTo(w*.62, h*.72, w*.8, h*.7, w*.96, h*.76);
  ctx.stroke();
  // 喉仏ガイド
  ctx.beginPath();
  ctx.ellipse(w*.5, h*.38, w*.06, h*.04, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function redrawNeckTattooCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, NECK_CW, NECK_CH);
  drawNeckGuide(ctx, NECK_CW, NECK_CH);
  neckTattooState.list.forEach((t, i) => {
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot); ctx.globalAlpha = 0.85;
    if (t.presetIdx >= 0) {
      const tmp = document.createElement('canvas'); tmp.width = t.size; tmp.height = t.size;
      TATTOO_PRESETS[t.presetIdx].draw(tmp.getContext('2d'), t.size, t.size);
      ctx.drawImage(tmp, -t.size/2, -t.size/2);
    } else if (t.img) {
      ctx.drawImage(t.img, -t.size/2, -t.size/2, t.size, t.size);
    }
    ctx.globalAlpha = 1;
    if (i === neckTattooState.selIdx) {
      ctx.strokeStyle='#4a9eff'; ctx.lineWidth=1.5;
      ctx.strokeRect(-t.size/2-4,-t.size/2-4,t.size+8,t.size+8);
    }
    ctx.restore();
  });
}

function redrawNeckMoleCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, NECK_CW, NECK_CH);
  drawNeckGuide(ctx, NECK_CW, NECK_CH);
  neckMoleState.list.forEach((m, i) => {
    ctx.save();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    if (m.shape === 0) { ctx.arc(m.x, m.y, m.size, 0, Math.PI*2); }
    else if (m.shape === 1) { ctx.ellipse(m.x, m.y, m.size*1.4, m.size*.7, 0, 0, Math.PI*2); }
    else { ctx.rect(m.x-m.size*.7, m.y-m.size*.7, m.size*1.4, m.size*1.4); }
    ctx.fill();
    if (i === neckMoleState.selIdx) { ctx.strokeStyle='#4a9eff'; ctx.lineWidth=1.5; ctx.stroke(); }
    ctx.restore();
  });
}

function buildNeckPanel(area) {
  area.innerHTML = '';

  // ── 内部タブ ──
  const tabs = [
    { key:'acc',   label:'アクセ' },
    { key:'tattoo',label:'タトゥー' },
    { key:'mole',  label:'ほくろ' },
    { key:'paint', label:'3Dペイント' },
  ];
  let activeTab = area._neckTab || 'acc';

  const tabRow = document.createElement('div');
  tabRow.style.cssText='display:flex;gap:3px;margin-bottom:8px;';
  const sections = {};

  const showTab = key => {
    activeTab = key; area._neckTab = key;
    Object.entries(sections).forEach(([k,el])=>{ el.style.display = k===key?'':'none'; });
    tabRow.querySelectorAll('.neck-tab').forEach(b=>{ b.classList.toggle('p3d-active', b.dataset.tab===key); });
  };

  tabs.forEach(t=>{
    const btn=document.createElement('button'); btn.className='p3d-btn neck-tab'; btn.dataset.tab=t.key;
    btn.textContent=t.label; btn.style.flex='1';
    btn.addEventListener('click',()=>showTab(t.key));
    tabRow.appendChild(btn);
  });
  area.appendChild(tabRow);

  // ══ アクセセクション ══
  const accSec = document.createElement('div');
  sections.acc = accSec;
  const groups = [...new Set(NECK_ACC_TEMPLATES.map(t=>t.group))];
  groups.forEach(grp=>{
    const sep=document.createElement('div'); sep.className='nose-sep'; sep.textContent=grp;
    accSec.appendChild(sep);
    const grid=document.createElement('div'); grid.className='thumb-grid';
    NECK_ACC_TEMPLATES.forEach((tmpl,i)=>{
      if(tmpl.group!==grp) return;
      const cell=document.createElement('div');
      cell.className='thumb-cell'+(neckAccState.selIdx===i?' selected':'');
      const cvs=document.createElement('canvas'); cvs.width=72; cvs.height=72;
      const tc=cvs.getContext('2d'); tc.fillStyle='#0d0f18'; tc.fillRect(0,0,72,72);
      tmpl.draw(tc,72,72);
      cell.appendChild(cvs);
      const lbl=document.createElement('div'); lbl.className='thumb-label'; lbl.textContent=tmpl.label;
      cell.appendChild(lbl);
      cell.addEventListener('click',()=>{ neckAccState.selIdx=i; buildNeckPanel(area); });
      grid.appendChild(cell);
    });
    accSec.appendChild(grid);
  });
  area.appendChild(accSec);

  // ══ タトゥーセクション ══
  const tatSec = document.createElement('div');
  sections.tattoo = tatSec;

  const tPresetSep=document.createElement('div'); tPresetSep.className='nose-sep'; tPresetSep.textContent='プリセット（選んで配置エリアをクリック）';
  tatSec.appendChild(tPresetSep);
  const tGrid=document.createElement('div'); tGrid.className='thumb-grid';
  const tUploadLbl=document.createElement('div'); tUploadLbl.style.cssText='font-size:10px;color:var(--text-lo);margin:4px 0;'; tUploadLbl.textContent='選択中: なし';

  TATTOO_PRESETS.forEach((preset,i)=>{
    const cell=document.createElement('div'); cell.className='thumb-item'+(i===neckTattooState.presetSel?' selected':'');
    cell.style.background='#0d0f18';
    const cvs=document.createElement('canvas'); cvs.width=72; cvs.height=72; cvs.style.cssText='width:100%;height:100%;display:block;';
    preset.draw(cvs.getContext('2d'),72,72);
    const lbl=document.createElement('div'); lbl.className='thumb-label'; lbl.textContent=preset.label;
    cell.appendChild(cvs); cell.appendChild(lbl);
    cell.addEventListener('click',()=>{
      neckTattooState.presetSel=i; neckTattooState.activeUrl=null;
      tGrid.querySelectorAll('.thumb-item').forEach(c=>c.classList.remove('selected'));
      cell.classList.add('selected'); tUploadLbl.textContent=`選択中: ${preset.label}`;
    });
    tGrid.appendChild(cell);
  });
  tatSec.appendChild(tGrid);

  const tUploadSep=document.createElement('div'); tUploadSep.className='nose-sep'; tUploadSep.textContent='画像アップロード';
  tatSec.appendChild(tUploadSep); tatSec.appendChild(tUploadLbl);
  const tUpBtn=document.createElement('button'); tUpBtn.className='hbtn'; tUpBtn.style.cssText='width:100%;margin-bottom:8px;'; tUpBtn.textContent='画像を選択 (PNG/JPG)';
  tUpBtn.addEventListener('click',()=>{
    const inp=Object.assign(document.createElement('input'),{type:'file',accept:'image/*'});
    inp.addEventListener('change',e=>{
      const f=e.target.files[0]; if(!f) return;
      const reader=new FileReader();
      reader.onload=ev=>{ neckTattooState.activeUrl=ev.target.result; neckTattooState.presetSel=-1; tGrid.querySelectorAll('.thumb-item').forEach(c=>c.classList.remove('selected')); tUploadLbl.textContent=`選択中: ${f.name}`; };
      reader.readAsDataURL(f);
    });
    inp.click();
  });
  tatSec.appendChild(tUpBtn);

  const tPlaceSep=document.createElement('div'); tPlaceSep.className='nose-sep'; tPlaceSep.textContent='配置エリア（クリックで設置）';
  tatSec.appendChild(tPlaceSep);
  const tCvs=document.createElement('canvas'); tCvs.width=NECK_CW; tCvs.height=NECK_CH;
  tCvs.style.cssText='width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  tatSec.appendChild(tCvs); redrawNeckTattooCanvas(tCvs);

  const tHint=document.createElement('div'); tHint.className='bez-hint'; tHint.textContent='クリック→設置  ドラッグ→移動  右クリック→削除';
  tatSec.appendChild(tHint);

  const tAdjSep=document.createElement('div'); tAdjSep.className='nose-sep'; tAdjSep.textContent='サイズ・回転';
  tatSec.appendChild(tAdjSep);
  [
    {label:'大きさ',key:'newSize',min:20,max:160,step:2,isRot:false},
    {label:'回転',key:'newRot',min:-180,max:180,step:1,isRot:true},
  ].forEach(sl=>{
    const row=document.createElement('div'); row.className='sl-row';
    const nm=document.createElement('span'); nm.className='sl-name'; nm.textContent=sl.label;
    const inp=document.createElement('input'); inp.type='range'; inp.min=sl.min; inp.max=sl.max; inp.step=sl.step;
    inp.value=sl.isRot?Math.round(neckTattooState[sl.key]*180/Math.PI):neckTattooState[sl.key];
    const vl=document.createElement('span'); vl.className='sl-val'; vl.textContent=inp.value;
    inp.addEventListener('input',()=>{
      const v=parseFloat(inp.value); neckTattooState[sl.key]=sl.isRot?v*Math.PI/180:v; vl.textContent=inp.value;
      if(neckTattooState.selIdx>=0){ const t=neckTattooState.list[neckTattooState.selIdx]; if(sl.isRot)t.rot=neckTattooState.newRot; else t.size=neckTattooState.newSize; redrawNeckTattooCanvas(tCvs); }
    });
    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl); tatSec.appendChild(row);
  });
  const tDelBtn=document.createElement('button'); tDelBtn.className='hbtn'; tDelBtn.style.cssText='margin-top:8px;width:100%;'; tDelBtn.textContent='選択したタトゥーを削除';
  tDelBtn.addEventListener('click',()=>{ if(neckTattooState.selIdx>=0){neckTattooState.list.splice(neckTattooState.selIdx,1);neckTattooState.selIdx=-1;redrawNeckTattooCanvas(tCvs);} });
  tatSec.appendChild(tDelBtn);

  let tDragging=false,tDragIdx=-1;
  const tGC=e=>{ const r=tCvs.getBoundingClientRect(); return{mx:(e.clientX-r.left)*(NECK_CW/r.width),my:(e.clientY-r.top)*(NECK_CH/r.height)}; };
  tCvs.addEventListener('contextmenu',e=>{ e.preventDefault(); const{mx,my}=tGC(e); for(let i=neckTattooState.list.length-1;i>=0;i--){const t=neckTattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){neckTattooState.list.splice(i,1);if(neckTattooState.selIdx>=i)neckTattooState.selIdx=Math.max(-1,neckTattooState.selIdx-1);redrawNeckTattooCanvas(tCvs);break;}} });
  tCvs.addEventListener('pointerdown',e=>{ e.preventDefault(); const{mx,my}=tGC(e); let hit=-1; for(let i=neckTattooState.list.length-1;i>=0;i--){const t=neckTattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){hit=i;break;}} if(hit>=0){neckTattooState.selIdx=hit;tDragging=true;tDragIdx=hit;tCvs.setPointerCapture(e.pointerId);}else{const hasP=neckTattooState.presetSel>=0,hasU=!!neckTattooState.activeUrl;if(!hasP&&!hasU)return;const entry={x:mx,y:my,size:neckTattooState.newSize,rot:neckTattooState.newRot,presetIdx:hasP?neckTattooState.presetSel:-1,img:null};if(hasU&&!hasP){const img=new Image();img.src=neckTattooState.activeUrl;img.onload=()=>{entry.img=img;redrawNeckTattooCanvas(tCvs);};}neckTattooState.list.push(entry);neckTattooState.selIdx=neckTattooState.list.length-1;}redrawNeckTattooCanvas(tCvs); });
  tCvs.addEventListener('pointermove',e=>{ if(!tDragging)return; const{mx,my}=tGC(e); const t=neckTattooState.list[tDragIdx]; if(t){t.x=mx;t.y=my;redrawNeckTattooCanvas(tCvs);} });
  tCvs.addEventListener('pointerup',()=>{tDragging=false;tDragIdx=-1;});
  area.appendChild(tatSec);

  // ══ ほくろセクション ══
  const moleSec = document.createElement('div');
  sections.mole = moleSec;

  const mPlaceSep=document.createElement('div'); mPlaceSep.className='nose-sep'; mPlaceSep.textContent='配置エリア（クリックで追加）';
  moleSec.appendChild(mPlaceSep);
  const mCvs=document.createElement('canvas'); mCvs.width=NECK_CW; mCvs.height=NECK_CH;
  mCvs.style.cssText='width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  moleSec.appendChild(mCvs); redrawNeckMoleCanvas(mCvs);

  const mHint=document.createElement('div'); mHint.className='bez-hint'; mHint.textContent='クリック→追加  ドラッグ→移動  右クリック→削除';
  moleSec.appendChild(mHint);

  const mStyleSep=document.createElement('div'); mStyleSep.className='nose-sep'; mStyleSep.textContent='形・スタイル';
  moleSec.appendChild(mStyleSep);
  const mShapeRow=document.createElement('div'); mShapeRow.style.cssText='display:flex;gap:4px;margin-bottom:8px;';
  [{label:'丸'},{label:'楕円'},{label:'四角'}].forEach((s,i)=>{
    const btn=document.createElement('button'); btn.className='hbtn'; btn.style.cssText='flex:1;padding:3px 2px;font-size:10px;'; btn.textContent=s.label;
    if(i===neckMoleState.newShape) btn.style.borderColor='var(--accent)';
    btn.addEventListener('click',()=>{ neckMoleState.newShape=i; mShapeRow.querySelectorAll('.hbtn').forEach((b,j)=>{b.style.borderColor=j===i?'var(--accent)':'';}); if(neckMoleState.selIdx>=0){neckMoleState.list[neckMoleState.selIdx].shape=i;redrawNeckMoleCanvas(mCvs);}});
    mShapeRow.appendChild(btn);
  });
  moleSec.appendChild(mShapeRow);

  const mSzRow=document.createElement('div'); mSzRow.className='sl-row';
  const mSzNm=document.createElement('span'); mSzNm.className='sl-name'; mSzNm.textContent='大きさ';
  const mSzInp=document.createElement('input'); mSzInp.type='range'; mSzInp.min=2; mSzInp.max=18; mSzInp.step=0.5; mSzInp.value=neckMoleState.newSize;
  const mSzVl=document.createElement('span'); mSzVl.className='sl-val'; mSzVl.textContent=neckMoleState.newSize;
  mSzInp.addEventListener('input',()=>{ neckMoleState.newSize=parseFloat(mSzInp.value); mSzVl.textContent=mSzInp.value; if(neckMoleState.selIdx>=0){neckMoleState.list[neckMoleState.selIdx].size=neckMoleState.newSize;redrawNeckMoleCanvas(mCvs);}});
  mSzRow.appendChild(mSzNm); mSzRow.appendChild(mSzInp); mSzRow.appendChild(mSzVl);
  moleSec.appendChild(mSzRow);

  const mColorRow=document.createElement('div'); mColorRow.className='sl-row';
  const mColorNm=document.createElement('span'); mColorNm.className='sl-name'; mColorNm.textContent='色';
  const mColorInp=document.createElement('input'); mColorInp.type='color'; mColorInp.value=neckMoleState.newColor; mColorInp.className='bez-color-picker';
  mColorInp.addEventListener('input',e=>{ neckMoleState.newColor=e.target.value; if(neckMoleState.selIdx>=0){neckMoleState.list[neckMoleState.selIdx].color=e.target.value;redrawNeckMoleCanvas(mCvs);}});
  mColorRow.appendChild(mColorNm); mColorRow.appendChild(mColorInp);
  moleSec.appendChild(mColorRow);

  const mDelBtn=document.createElement('button'); mDelBtn.className='hbtn'; mDelBtn.style.cssText='margin-top:8px;width:100%;'; mDelBtn.textContent='選択したほくろを削除';
  mDelBtn.addEventListener('click',()=>{ if(neckMoleState.selIdx>=0){neckMoleState.list.splice(neckMoleState.selIdx,1);neckMoleState.selIdx=-1;redrawNeckMoleCanvas(mCvs);}});
  moleSec.appendChild(mDelBtn);

  let mDragging=false,mDragIdx=-1;
  mCvs.addEventListener('contextmenu',e=>{ e.preventDefault(); const r=mCvs.getBoundingClientRect(); const mx=(e.clientX-r.left)*(NECK_CW/r.width),my=(e.clientY-r.top)*(NECK_CH/r.height); for(let i=neckMoleState.list.length-1;i>=0;i--){if(Math.hypot(mx-neckMoleState.list[i].x,my-neckMoleState.list[i].y)<=neckMoleState.list[i].size+6){neckMoleState.list.splice(i,1);if(neckMoleState.selIdx>=i)neckMoleState.selIdx=Math.max(-1,neckMoleState.selIdx-1);redrawNeckMoleCanvas(mCvs);break;}}});
  mCvs.addEventListener('pointerdown',e=>{ e.preventDefault(); const r=mCvs.getBoundingClientRect(); const mx=(e.clientX-r.left)*(NECK_CW/r.width),my=(e.clientY-r.top)*(NECK_CH/r.height); let hit=-1; for(let i=neckMoleState.list.length-1;i>=0;i--){if(Math.hypot(mx-neckMoleState.list[i].x,my-neckMoleState.list[i].y)<=neckMoleState.list[i].size+6){hit=i;break;}} if(hit>=0){neckMoleState.selIdx=hit;mDragging=true;mDragIdx=hit;mCvs.setPointerCapture(e.pointerId);}else{neckMoleState.list.push({x:mx,y:my,size:neckMoleState.newSize,shape:neckMoleState.newShape,color:neckMoleState.newColor});neckMoleState.selIdx=neckMoleState.list.length-1;}redrawNeckMoleCanvas(mCvs);});
  mCvs.addEventListener('pointermove',e=>{ if(!mDragging)return; const r=mCvs.getBoundingClientRect(); const m=neckMoleState.list[mDragIdx]; if(m){m.x=(e.clientX-r.left)*(NECK_CW/r.width);m.y=(e.clientY-r.top)*(NECK_CH/r.height);redrawNeckMoleCanvas(mCvs);}});
  mCvs.addEventListener('pointerup',()=>{mDragging=false;mDragIdx=-1;});
  area.appendChild(moleSec);

  // ══ 3Dペイントセクション ══
  const paintSec = document.createElement('div');
  sections.paint = paintSec;

  const pHintSep=document.createElement('div'); pHintSep.className='nose-sep'; pHintSep.textContent='3Dモデルペイント';
  paintSec.appendChild(pHintSep);

  const pDesc=document.createElement('div'); pDesc.style.cssText='font-size:11px;color:var(--text-lo);line-height:1.6;margin:8px 0;padding:0 4px;';
  pDesc.textContent='3Dペイントで首・鎖骨エリアを直接塗ることができます。ブラシ・消しゴム・色・濡れ効果を使ってオリジナルのタトゥーやアートを描いてください。';
  paintSec.appendChild(pDesc);

  const pNote=document.createElement('div'); pNote.style.cssText='font-size:10px;color:var(--text-lo);padding:6px 8px;background:rgba(255,200,0,.07);border-radius:4px;margin-bottom:8px;';
  pNote.textContent='💡 首・体エリアを選択して塗るのがおすすめ';
  paintSec.appendChild(pNote);

  // 服を隠して塗るボタン（首）
  const pNeckHideBtn=document.createElement('button'); pNeckHideBtn.className='deco-action-btn';
  pNeckHideBtn.textContent='🩲 服を隠して素体を塗る（推奨）';
  pNeckHideBtn.style.cssText='width:100%;background:#3a1e5a;margin:0 0 6px;border:1px solid #8040c0;';
  pNeckHideBtn.addEventListener('click',()=>{
    const ps=document.getElementById('p3d-part');if(ps)ps.value='body';
    if(typeof hideClothesForPaint==='function')hideClothesForPaint(['clothes_top','clothes_bra']);
    if(typeof enterPaint3d==='function')enterPaint3d();else document.getElementById('btn-paint3d')?.click();
  });
  paintSec.appendChild(pNeckHideBtn);
  const pNeckHint=document.createElement('div');pNeckHint.style.cssText='font-size:10px;color:var(--text-lo);padding:0 4px 8px;';pNeckHint.textContent='✕ ペイント終了ボタンで服が自動復元されます';paintSec.appendChild(pNeckHint);

  // 部位選択ボタン群
  const pBtnRow=document.createElement('div'); pBtnRow.style.cssText='display:flex;flex-direction:column;gap:6px;';
  [
    {label:'首・ボディ全体を3Dペイント', part:'body'},
    {label:'頭・顔・首を3Dペイント', part:'head'},
    {label:'全パーツを3Dペイント', part:'all'},
  ].forEach(({label,part})=>{
    const btn=document.createElement('button'); btn.className='deco-action-btn'; btn.textContent=label;
    btn.style.cssText='width:100%;background:#1e3a5a;margin:0;';
    btn.addEventListener('click',()=>{
      const partSel=document.getElementById('p3d-part');
      if(partSel) partSel.value=part;
      if(typeof enterPaint3d==='function') enterPaint3d();
      else document.getElementById('btn-paint3d')?.click();
    });
    pBtnRow.appendChild(btn);
  });
  paintSec.appendChild(pBtnRow);

  // 3Dペイント簡易ツール設定
  const pToolSep=document.createElement('div'); pToolSep.className='nose-sep'; pToolSep.textContent='よく使う色プリセット（3Dペイント連動）';
  paintSec.appendChild(pToolSep);
  const pSwatches=document.createElement('div'); pSwatches.style.cssText='display:flex;flex-wrap:wrap;gap:4px;';
  ['#1a0a00','#2d1500','#8b0000','#000080','#004400','#c8a030','#1a1a1a','#4b0082','#800000','#003333','#2a0028','#401000'].forEach(c=>{
    const sw=document.createElement('div');
    sw.style.cssText=`width:20px;height:20px;background:${c};border-radius:3px;cursor:pointer;border:1px solid #333;`;
    sw.title=c;
    sw.addEventListener('click',()=>{
      const cpick=document.getElementById('p3d-color');
      if(cpick){ cpick.value=c; cpick.dispatchEvent(new Event('input')); }
      if(paint3d) paint3d.color=c;
    });
    pSwatches.appendChild(sw);
  });
  paintSec.appendChild(pSwatches);
  area.appendChild(paintSec);

  showTab(activeTab);
}

// ═══════════════════════════════════════════════════════════════
//  肩パネル
// ═══════════════════════════════════════════════════════════════
const SHOULDER_ACC_TEMPLATES = [
  // ── ショルダーパッド ──
  { label: 'シンプルパッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    ctx.beginPath(); ctx.ellipse(w*.25,h*.38,w*.18,h*.1,-.3,0,Math.PI*2); ctx.fillStyle='#3a3a5a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(w*.75,h*.38,w*.18,h*.1,.3,0,Math.PI*2); ctx.fillStyle='#3a3a5a'; ctx.fill();
  }},
  { label: 'アーマーパッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.2,h*.36,-.3],[w*.8,h*.36,.3]].forEach(([cx,cy,a])=>{
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-w*.18,0); ctx.lineTo(0,-h*.12); ctx.lineTo(w*.18,0); ctx.lineTo(w*.14,h*.08); ctx.lineTo(-w*.14,h*.08); ctx.closePath();
      ctx.fillStyle='#4a6080'; ctx.fill(); ctx.strokeStyle='#7090b0'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
    });
  }},
  { label: 'スパイクパッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.38,-.28],[w*.78,h*.38,.28]].forEach(([cx,cy,a])=>{
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0,0,w*.16,h*.08,0,0,Math.PI*2); ctx.fillStyle='#1a1a2e'; ctx.fill();
      for(let i=0;i<5;i++){const sx=(i-2)*w*.055; ctx.beginPath(); ctx.moveTo(sx-w*.02,-h*.08); ctx.lineTo(sx,-h*.18); ctx.lineTo(sx+w*.02,-h*.08); ctx.fillStyle='#606080'; ctx.fill();}
      ctx.restore();
    });
  }},
  { label: '花パッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.37],[w*.78,h*.37]].forEach(([cx,cy])=>{
      for(let i=0;i<6;i++){ const a=i*Math.PI/3; ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.06,h*.05,a,0,Math.PI*2); ctx.fillStyle='#e8a0b0'; ctx.fill();}
      ctx.beginPath(); ctx.arc(cx,cy,w*.04,0,Math.PI*2); ctx.fillStyle='#ffd700'; ctx.fill();
    });
  }},
  { label: '蝶パッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.37],[w*.78,h*.37]].forEach(([cx,cy])=>{
      [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{
        ctx.beginPath(); ctx.ellipse(cx+sx*w*.08,cy+sy*h*.05,w*.07,h*.04,0,0,Math.PI*2);
        ctx.fillStyle=`rgba(180,120,220,0.7)`; ctx.fill();
      });
      ctx.beginPath(); ctx.moveTo(cx,cy-h*.08); ctx.lineTo(cx,cy+h*.08); ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.stroke();
    });
  }},
  { label: '羽根パッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.2,h*.5,1],[w*.8,h*.5,-1]].forEach(([cx,cy,dir])=>{
      for(let i=0;i<5;i++){
        const fy=cy-i*h*.07;
        ctx.beginPath(); ctx.ellipse(cx+dir*i*w*.025,fy,w*.06+i*w*.01,h*.03,dir*-.5,0,Math.PI*2);
        ctx.fillStyle=`rgba(240,240,255,${0.5+i*.1})`; ctx.fill(); ctx.strokeStyle='#aaa'; ctx.lineWidth=.5; ctx.stroke();
      }
    });
  }},
  { label: 'ファーパッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.38,-.3],[w*.78,h*.38,.3]].forEach(([cx,cy,a])=>{
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
      for(let i=0;i<20;i++){
        const fx=(Math.random()-.5)*w*.32, fy=(Math.random()-.5)*h*.16;
        ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+(Math.random()-.5)*w*.06,fy-h*.06);
        ctx.strokeStyle='#e0d8cc'; ctx.lineWidth=1.5; ctx.stroke();
      }
      ctx.restore();
    });
  }},
  { label: 'クリスタルパッド', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.37],[w*.78,h*.37]].forEach(([cx,cy])=>{
      [[0,-h*.12,w*.06],[- w*.07,-h*.06,w*.04],[w*.07,-h*.06,w*.04]].forEach(([dx,dy,r])=>{
        ctx.beginPath(); ctx.moveTo(cx+dx,cy+dy-r); ctx.lineTo(cx+dx+r,cy+dy+r); ctx.lineTo(cx+dx-r,cy+dy+r); ctx.closePath();
        ctx.fillStyle='rgba(160,220,255,0.6)'; ctx.fill(); ctx.strokeStyle='#80d8ff'; ctx.lineWidth=1; ctx.stroke();
      });
    });
  }},
  { label: 'チェーンエポレット', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.22,h*.36,-.25],[w*.78,h*.36,.25]].forEach(([cx,cy,a])=>{
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
      ctx.fillStyle='#c8a030'; ctx.fillRect(-w*.14,-h*.04,w*.28,h*.08);
      for(let i=0;i<4;i++){
        const x=-w*.1+i*w*.065;
        ctx.beginPath(); ctx.moveTo(x,h*.04); ctx.lineTo(x-w*.01,h*.12); ctx.lineTo(x+w*.01,h*.12); ctx.closePath(); ctx.fillStyle='#c8a030'; ctx.fill();
        for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(x,h*.04+j*h*.04,w*.012,0,Math.PI*2);ctx.fillStyle='#e0b840';ctx.fill();}
      }
      ctx.restore();
    });
  }},
  { label: '騎士エポレット', group: 'ショルダーパッド', draw(ctx,w,h) {
    [[w*.21,h*.36,-.3],[w*.79,h*.36,.3]].forEach(([cx,cy,a])=>{
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-w*.16,-h*.06); ctx.lineTo(0,-h*.14); ctx.lineTo(w*.16,-h*.06); ctx.lineTo(w*.18,h*.06); ctx.lineTo(-w*.18,h*.06); ctx.closePath();
      ctx.fillStyle='#2a4a6a'; ctx.fill(); ctx.strokeStyle='#c8a030'; ctx.lineWidth=2; ctx.stroke();
      for(let i=-1;i<=1;i++){ctx.beginPath();ctx.arc(i*w*.08,0,w*.025,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();}
      ctx.restore();
    });
  }},
  // ── アームバンド ──
  { label: '細バンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.18,h*.62],[w*.82,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.1,h*.04,0,0,Math.PI*2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.025; ctx.stroke();
    });
  }},
  { label: '太バンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.11,h*.05,0,0,Math.PI*2); ctx.fillStyle='#1a1a2a'; ctx.fill(); ctx.strokeStyle='#404060'; ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.11,h*.05,0,0,Math.PI*2); ctx.strokeStyle='#555588'; ctx.lineWidth=w*.025; ctx.stroke();
    });
  }},
  { label: 'ビジューバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.11,h*.045,0,0,Math.PI*2); ctx.strokeStyle='#2a1a3a'; ctx.lineWidth=w*.04; ctx.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*w*.11,cy+Math.sin(a)*h*.045,w*.018,0,Math.PI*2); ctx.fillStyle=['#ff88cc','#cc88ff','#88ccff','#ffd700'][i%4]; ctx.fill();}
    });
  }},
  { label: 'スパイクバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.11,h*.04,0,0,Math.PI*2); ctx.strokeStyle='#111'; ctx.lineWidth=w*.04; ctx.stroke();
      for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.11,oy=Math.sin(a)*h*.04; ctx.beginPath(); ctx.moveTo(cx+ox*.9,cy+oy*.9); ctx.lineTo(cx+ox*1.35,cy+oy*1.35); ctx.strokeStyle='#888'; ctx.lineWidth=w*.025; ctx.stroke();}
    });
  }},
  { label: '花バンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.11,h*.04,0,0,Math.PI*2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=2; ctx.stroke();
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5; for(let p=0;p<4;p++){const pa=a+p*Math.PI/2,fx=cx+Math.cos(a)*w*.11+Math.cos(pa)*w*.025,fy=cy+Math.sin(a)*h*.04+Math.sin(pa)*h*.02; ctx.beginPath(); ctx.arc(fx,fy,w*.015,0,Math.PI*2); ctx.fillStyle='#ffb0c8'; ctx.fill();} ctx.beginPath(); ctx.arc(cx+Math.cos(a)*w*.11,cy+Math.sin(a)*h*.04,w*.015,0,Math.PI*2); ctx.fillStyle='#ffd700'; ctx.fill();}
    });
  }},
  { label: 'レースバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.strokeStyle='rgba(240,220,240,.2)'; ctx.lineWidth=w*.04; ctx.stroke();
      for(let i=0;i<10;i++){const a=i*Math.PI/5; ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.04); ctx.lineTo(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.07); ctx.strokeStyle='rgba(220,200,220,0.6)'; ctx.lineWidth=1; ctx.stroke();}
    });
  }},
  { label: 'チェーンバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      for(let i=0;i<12;i++){const a=i*Math.PI/6; ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*w*.11,cy+Math.sin(a)*h*.045,w*.025,h*.018,a,0,Math.PI*2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.018; ctx.stroke();}
    });
  }},
  { label: 'メッシュバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.save(); ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.clip();
      for(let i=-5;i<=5;i++){ctx.beginPath(); ctx.moveTo(cx+i*w*.025-w*.12,cy-h*.06); ctx.lineTo(cx+i*w*.025+w*.12,cy+h*.06); ctx.strokeStyle='rgba(180,180,200,0.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx-i*w*.025-w*.12,cy-h*.06); ctx.lineTo(cx-i*w*.025+w*.12,cy+h*.06); ctx.strokeStyle='rgba(180,180,200,0.5)'; ctx.lineWidth=1; ctx.stroke();}
      ctx.restore(); ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.strokeStyle='#555'; ctx.lineWidth=2; ctx.stroke();
    });
  }},
  { label: 'ゴールドカフ', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      const g=ctx.createLinearGradient(cx-w*.12,cy,cx+w*.12,cy);
      g.addColorStop(0,'#a06010'); g.addColorStop(.5,'#f0c840'); g.addColorStop(1,'#a06010');
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.08,h*.03,0,0,Math.PI*2); ctx.fillStyle='#1a1a1a'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=1; ctx.stroke();
    });
  }},
  { label: 'インカントバンド', group: 'アームバンド', draw(ctx,w,h) {
    [[w*.17,h*.62],[w*.83,h*.62]].forEach(([cx,cy])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.fillStyle='#1a0a28'; ctx.fill();
      for(let i=0;i<6;i++){const a=i*Math.PI/3; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.035,w*.018,0,Math.PI*2); const g2=ctx.createRadialGradient(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.035,0,cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.035,w*.018); g2.addColorStop(0,'#ffffff'); g2.addColorStop(1,'#8040e0'); ctx.fillStyle=g2; ctx.fill();}
      ctx.beginPath(); ctx.ellipse(cx,cy,w*.12,h*.055,0,0,Math.PI*2); ctx.strokeStyle='#6020c0'; ctx.lineWidth=1.5; ctx.stroke();
    });
  }},
  // ── タスキ・ストラップ ──
  { label: '細タスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.02; ctx.stroke();
  }},
  { label: '太タスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.28,h*.12); ctx.lineTo(w*.72,h*.88); ctx.strokeStyle='#2a2a4a'; ctx.lineWidth=w*.05; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.28,h*.12); ctx.lineTo(w*.72,h*.88); ctx.strokeStyle='#4a4a6a'; ctx.lineWidth=w*.03; ctx.setLineDash([w*.04,w*.02]); ctx.stroke(); ctx.setLineDash([]);
  }},
  { label: '花タスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='#e8a0b0'; ctx.lineWidth=w*.015; ctx.stroke();
    for(let i=0;i<5;i++){const t=.1+i*.18,fx=w*.3+t*(w*.4),fy=h*.15+t*(h*.7); for(let p=0;p<5;p++){const pa=p*Math.PI*2/5; ctx.beginPath(); ctx.ellipse(fx+Math.cos(pa)*w*.025,fy+Math.sin(pa)*h*.018,w*.02,h*.015,0,0,Math.PI*2); ctx.fillStyle='#ffb0c0'; ctx.fill();} ctx.beginPath(); ctx.arc(fx,fy,w*.01,0,Math.PI*2); ctx.fillStyle='#ffd700'; ctx.fill();}
  }},
  { label: 'リボンタスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='#e040a0'; ctx.lineWidth=w*.02; ctx.stroke();
    const rx=w*.5,ry=h*.5;
    [[rx-w*.06,ry-h*.03],[rx+w*.06,ry-h*.03]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.055,h*.04,0,0,Math.PI*2);ctx.fillStyle='rgba(230,60,150,.7)';ctx.fill();});
    ctx.beginPath(); ctx.arc(rx,ry,w*.018,0,Math.PI*2); ctx.fillStyle='#ff80c0'; ctx.fill();
  }},
  { label: 'チェーンタスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    const steps=12;
    for(let i=0;i<steps;i++){const t=i/steps,nx=(i+.5)/steps; const x1=w*.3+t*w*.4,y1=h*.15+t*h*.7,x2=w*.3+nx*w*.4,y2=h*.15+nx*h*.7; ctx.beginPath(); ctx.ellipse((x1+x2)/2,(y1+y2)/2,w*.022,h*.016,Math.atan2(y2-y1,x2-x1),0,Math.PI*2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.018; ctx.stroke();}
  }},
  { label: 'クロスタスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    [[w*.3,h*.15,w*.7,h*.85],[w*.7,h*.15,w*.3,h*.85]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.018; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(w*.5,h*.5,w*.025,0,Math.PI*2); ctx.fillStyle='#c8a030'; ctx.fill();
  }},
  { label: 'スカーフタスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.28,h*.12); ctx.bezierCurveTo(w*.45,h*.3,w*.55,h*.55,w*.72,h*.88);
    ctx.strokeStyle='#e08030'; ctx.lineWidth=w*.045; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*.28,h*.12); ctx.bezierCurveTo(w*.45,h*.3,w*.55,h*.55,w*.72,h*.88);
    ctx.strokeStyle='rgba(240,160,80,.3)'; ctx.lineWidth=w*.03; ctx.setLineDash([w*.05,w*.025]); ctx.stroke(); ctx.setLineDash([]);
  }},
  { label: 'レースタスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='rgba(240,220,240,.3)'; ctx.lineWidth=w*.04; ctx.stroke();
    for(let i=0;i<8;i++){const t=i/7,cx=w*.3+t*w*.4,cy=h*.15+t*h*.7; ctx.beginPath(); ctx.moveTo(cx-w*.03,cy-h*.02); ctx.lineTo(cx+w*.03,cy-h*.02); ctx.lineTo(cx,cy+h*.03); ctx.closePath(); ctx.strokeStyle='rgba(220,200,220,0.6)'; ctx.lineWidth=.8; ctx.stroke();}
  }},
  { label: 'ビジュータスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='#2a1a3a'; ctx.lineWidth=w*.03; ctx.stroke();
    for(let i=0;i<8;i++){const t=.05+i*.12,gx=w*.3+t*w*.4,gy=h*.15+t*h*.7; ctx.beginPath(); ctx.arc(gx,gy,w*.022,0,Math.PI*2); ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700','#88ccff'][i%4]; ctx.fill();}
  }},
  { label: '翼タスキ', group: 'タスキ・ストラップ', draw(ctx,w,h) {
    ctx.beginPath(); ctx.moveTo(w*.3,h*.15); ctx.lineTo(w*.7,h*.85); ctx.strokeStyle='#c8a030'; ctx.lineWidth=w*.015; ctx.stroke();
    [[w*.3,h*.2,1],[w*.7,h*.8,-1]].forEach(([wx,wy,dir])=>{
      for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(wx+dir*(i+1)*w*.04,wy-i*h*.04,w*.05,h*.025,-dir*.6,0,Math.PI*2);ctx.fillStyle=`rgba(240,240,255,${0.4+i*.1})`;ctx.fill();ctx.strokeStyle='#aaa';ctx.lineWidth=.5;ctx.stroke();}
    });
  }},
];

const SHOULDER_CW = 240, SHOULDER_CH = 300;
const shoulderAccState   = { selIdx: -1 };
const shoulderTattooState = { list:[], selIdx:-1, presetSel:-1, newSize:55, newRot:0, activeUrl:null };
const shoulderMoleState   = { list:[], selIdx:-1, newShape:0, newSize:7, newColor:'#1a0a00' };

function drawShoulderGuide(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = '#2a3050';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  // 首
  ctx.beginPath(); ctx.moveTo(w*.42,h*.02); ctx.lineTo(w*.42,h*.18); ctx.moveTo(w*.58,h*.02); ctx.lineTo(w*.58,h*.18);
  // 左肩カーブ
  ctx.moveTo(w*.42,h*.18); ctx.bezierCurveTo(w*.3,h*.22,w*.1,h*.28,w*.05,h*.45);
  // 右肩カーブ
  ctx.moveTo(w*.58,h*.18); ctx.bezierCurveTo(w*.7,h*.22,w*.9,h*.28,w*.95,h*.45);
  // 左腕アウトライン
  ctx.moveTo(w*.05,h*.45); ctx.bezierCurveTo(w*.02,h*.55,w*.04,h*.75,w*.1,h*.95);
  ctx.moveTo(w*.25,h*.45); ctx.bezierCurveTo(w*.22,h*.6,w*.2,h*.75,w*.22,h*.95);
  // 右腕アウトライン
  ctx.moveTo(w*.75,h*.45); ctx.bezierCurveTo(w*.78,h*.6,w*.8,h*.75,w*.78,h*.95);
  ctx.moveTo(w*.95,h*.45); ctx.bezierCurveTo(w*.98,h*.55,w*.96,h*.75,w*.9,h*.95);
  // 胸ライン
  ctx.moveTo(w*.05,h*.45); ctx.bezierCurveTo(w*.15,h*.48,w*.35,h*.5,w*.42,h*.5);
  ctx.moveTo(w*.95,h*.45); ctx.bezierCurveTo(w*.85,h*.48,w*.65,h*.5,w*.58,h*.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function redrawShoulderTattooCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, SHOULDER_CW, SHOULDER_CH);
  drawShoulderGuide(ctx, SHOULDER_CW, SHOULDER_CH);
  shoulderTattooState.list.forEach((t, i) => {
    ctx.save();
    ctx.translate(t.x, t.y);
    if (t.rot) ctx.rotate(t.rot);
    const hs = t.size / 2;
    ctx.globalAlpha = i === shoulderTattooState.selIdx ? 1 : 0.85;
    if (t.img) {
      ctx.drawImage(t.img, -hs, -hs, t.size, t.size);
    } else if (t.presetIdx >= 0 && TATTOO_PRESETS[t.presetIdx]) {
      TATTOO_PRESETS[t.presetIdx].draw(ctx, t.size, t.size);
    }
    if (i === shoulderTattooState.selIdx) {
      ctx.strokeStyle = '#4af'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
      ctx.strokeRect(-hs - 2, -hs - 2, t.size + 4, t.size + 4);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}

function redrawShoulderMoleCanvas(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, SHOULDER_CW, SHOULDER_CH);
  drawShoulderGuide(ctx, SHOULDER_CW, SHOULDER_CH);
  shoulderMoleState.list.forEach((m, i) => {
    ctx.save();
    ctx.fillStyle = m.color;
    ctx.globalAlpha = i === shoulderMoleState.selIdx ? 1 : 0.85;
    if (m.shape === 0) { ctx.beginPath(); ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2); ctx.fill(); }
    else if (m.shape === 1) { ctx.beginPath(); ctx.ellipse(m.x, m.y, m.size * 1.4, m.size * .7, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillRect(m.x - m.size, m.y - m.size * .6, m.size * 2, m.size * 1.2); }
    if (i === shoulderMoleState.selIdx) { ctx.strokeStyle = '#4af'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, m.size + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  });
}

function buildShoulderPanel(area) {
  area.innerHTML = '';

  const tabs = [
    { key:'acc',   label:'アクセ' },
    { key:'tattoo',label:'タトゥー' },
    { key:'mole',  label:'ほくろ' },
    { key:'paint', label:'3Dペイント' },
  ];
  let activeTab = area._shoulderTab || 'acc';

  const tabRow = document.createElement('div');
  tabRow.style.cssText = 'display:flex;gap:3px;margin-bottom:8px;';
  const sections = {};

  const showTab = key => {
    activeTab = key; area._shoulderTab = key;
    Object.entries(sections).forEach(([k,el]) => { el.style.display = k === key ? '' : 'none'; });
    tabRow.querySelectorAll('.shoulder-tab').forEach(b => { b.classList.toggle('p3d-active', b.dataset.tab === key); });
  };

  tabs.forEach(t => {
    const btn = document.createElement('button'); btn.className = 'p3d-btn shoulder-tab'; btn.dataset.tab = t.key;
    btn.textContent = t.label; btn.style.flex = '1';
    btn.addEventListener('click', () => showTab(t.key));
    tabRow.appendChild(btn);
  });
  area.appendChild(tabRow);

  // ══ アクセセクション ══
  const accSec = document.createElement('div');
  sections.acc = accSec;
  const grps = [...new Set(SHOULDER_ACC_TEMPLATES.map(t => t.group))];
  grps.forEach(grp => {
    const sep = document.createElement('div'); sep.className = 'nose-sep'; sep.textContent = grp;
    accSec.appendChild(sep);
    const grid = document.createElement('div'); grid.className = 'thumb-grid';
    SHOULDER_ACC_TEMPLATES.forEach((tmpl, i) => {
      if (tmpl.group !== grp) return;
      const cell = document.createElement('div');
      cell.className = 'thumb-cell' + (shoulderAccState.selIdx === i ? ' selected' : '');
      const cvs = document.createElement('canvas'); cvs.width = 72; cvs.height = 72;
      const tc = cvs.getContext('2d'); tc.fillStyle = '#0d0f18'; tc.fillRect(0, 0, 72, 72);
      tmpl.draw(tc, 72, 72);
      cell.appendChild(cvs);
      const lbl = document.createElement('div'); lbl.className = 'thumb-label'; lbl.textContent = tmpl.label;
      cell.appendChild(lbl);
      cell.addEventListener('click', () => { shoulderAccState.selIdx = i; buildShoulderPanel(area); });
      grid.appendChild(cell);
    });
    accSec.appendChild(grid);
  });
  area.appendChild(accSec);

  // ══ タトゥーセクション ══
  const tatSec = document.createElement('div');
  sections.tattoo = tatSec;

  const tPresetSep = document.createElement('div'); tPresetSep.className = 'nose-sep'; tPresetSep.textContent = 'プリセット（選んで配置エリアをクリック）';
  tatSec.appendChild(tPresetSep);
  const tGrid = document.createElement('div'); tGrid.className = 'thumb-grid';
  const tUploadLbl = document.createElement('div'); tUploadLbl.style.cssText = 'font-size:10px;color:var(--text-lo);margin:4px 0;'; tUploadLbl.textContent = '選択中: なし';

  TATTOO_PRESETS.forEach((preset, i) => {
    const cell = document.createElement('div'); cell.className = 'thumb-item' + (i === shoulderTattooState.presetSel ? ' selected' : '');
    cell.style.background = '#0d0f18';
    const cvs = document.createElement('canvas'); cvs.width = 72; cvs.height = 72; cvs.style.cssText = 'width:100%;height:100%;display:block;';
    preset.draw(cvs.getContext('2d'), 72, 72);
    const lbl = document.createElement('div'); lbl.className = 'thumb-label'; lbl.textContent = preset.label;
    cell.appendChild(cvs); cell.appendChild(lbl);
    cell.addEventListener('click', () => {
      shoulderTattooState.presetSel = i; shoulderTattooState.activeUrl = null;
      tGrid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected'); tUploadLbl.textContent = `選択中: ${preset.label}`;
    });
    tGrid.appendChild(cell);
  });
  tatSec.appendChild(tGrid);

  const tUploadSep = document.createElement('div'); tUploadSep.className = 'nose-sep'; tUploadSep.textContent = '画像アップロード';
  tatSec.appendChild(tUploadSep); tatSec.appendChild(tUploadLbl);
  const tUpBtn = document.createElement('button'); tUpBtn.className = 'hbtn'; tUpBtn.style.cssText = 'width:100%;margin-bottom:8px;'; tUpBtn.textContent = '画像を選択 (PNG/JPG)';
  tUpBtn.addEventListener('click', () => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => { shoulderTattooState.activeUrl = ev.target.result; shoulderTattooState.presetSel = -1; tGrid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected')); tUploadLbl.textContent = `選択中: ${f.name}`; };
      reader.readAsDataURL(f);
    });
    inp.click();
  });
  tatSec.appendChild(tUpBtn);

  const tPlaceSep = document.createElement('div'); tPlaceSep.className = 'nose-sep'; tPlaceSep.textContent = '配置エリア（クリックで設置）';
  tatSec.appendChild(tPlaceSep);
  const tCvs = document.createElement('canvas'); tCvs.width = SHOULDER_CW; tCvs.height = SHOULDER_CH;
  tCvs.style.cssText = 'width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  tatSec.appendChild(tCvs); redrawShoulderTattooCanvas(tCvs);

  const tHint = document.createElement('div'); tHint.className = 'bez-hint'; tHint.textContent = 'クリック→設置  ドラッグ→移動  右クリック→削除';
  tatSec.appendChild(tHint);

  const tAdjSep = document.createElement('div'); tAdjSep.className = 'nose-sep'; tAdjSep.textContent = 'サイズ・回転';
  tatSec.appendChild(tAdjSep);
  [
    { label:'大きさ', key:'newSize', min:20, max:160, step:2, isRot:false },
    { label:'回転',   key:'newRot',  min:-180, max:180, step:1, isRot:true  },
  ].forEach(sl => {
    const row = document.createElement('div'); row.className = 'sl-row';
    const nm  = document.createElement('span'); nm.className = 'sl-name'; nm.textContent = sl.label;
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = sl.isRot ? Math.round(shoulderTattooState[sl.key] * 180 / Math.PI) : shoulderTattooState[sl.key];
    const vl  = document.createElement('span'); vl.className = 'sl-val'; vl.textContent = inp.value;
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value); shoulderTattooState[sl.key] = sl.isRot ? v * Math.PI / 180 : v; vl.textContent = inp.value;
      if (shoulderTattooState.selIdx >= 0) { const t = shoulderTattooState.list[shoulderTattooState.selIdx]; if (sl.isRot) t.rot = shoulderTattooState.newRot; else t.size = shoulderTattooState.newSize; redrawShoulderTattooCanvas(tCvs); }
    });
    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl); tatSec.appendChild(row);
  });
  const tDelBtn = document.createElement('button'); tDelBtn.className = 'hbtn'; tDelBtn.style.cssText = 'margin-top:8px;width:100%;'; tDelBtn.textContent = '選択したタトゥーを削除';
  tDelBtn.addEventListener('click', () => { if (shoulderTattooState.selIdx >= 0) { shoulderTattooState.list.splice(shoulderTattooState.selIdx, 1); shoulderTattooState.selIdx = -1; redrawShoulderTattooCanvas(tCvs); } });
  tatSec.appendChild(tDelBtn);

  let tDragging = false, tDragIdx = -1;
  const tGC = e => { const r = tCvs.getBoundingClientRect(); return { mx:(e.clientX-r.left)*(SHOULDER_CW/r.width), my:(e.clientY-r.top)*(SHOULDER_CH/r.height) }; };
  tCvs.addEventListener('contextmenu', e => { e.preventDefault(); const {mx,my}=tGC(e); for (let i=shoulderTattooState.list.length-1;i>=0;i--){const t=shoulderTattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){shoulderTattooState.list.splice(i,1);if(shoulderTattooState.selIdx>=i)shoulderTattooState.selIdx=Math.max(-1,shoulderTattooState.selIdx-1);redrawShoulderTattooCanvas(tCvs);break;}}});
  tCvs.addEventListener('pointerdown', e => { e.preventDefault(); const {mx,my}=tGC(e); let hit=-1; for(let i=shoulderTattooState.list.length-1;i>=0;i--){const t=shoulderTattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){hit=i;break;}} if(hit>=0){shoulderTattooState.selIdx=hit;tDragging=true;tDragIdx=hit;tCvs.setPointerCapture(e.pointerId);}else{const hasP=shoulderTattooState.presetSel>=0,hasU=!!shoulderTattooState.activeUrl;if(!hasP&&!hasU)return;const entry={x:mx,y:my,size:shoulderTattooState.newSize,rot:shoulderTattooState.newRot,presetIdx:hasP?shoulderTattooState.presetSel:-1,img:null};if(hasU&&!hasP){const img=new Image();img.src=shoulderTattooState.activeUrl;img.onload=()=>{entry.img=img;redrawShoulderTattooCanvas(tCvs);};}shoulderTattooState.list.push(entry);shoulderTattooState.selIdx=shoulderTattooState.list.length-1;}redrawShoulderTattooCanvas(tCvs);});
  tCvs.addEventListener('pointermove', e => { if(!tDragging)return; const {mx,my}=tGC(e); const t=shoulderTattooState.list[tDragIdx]; if(t){t.x=mx;t.y=my;redrawShoulderTattooCanvas(tCvs);}});
  tCvs.addEventListener('pointerup', () => { tDragging=false; tDragIdx=-1; });
  area.appendChild(tatSec);

  // ══ ほくろセクション ══
  const moleSec = document.createElement('div');
  sections.mole = moleSec;

  const mPlaceSep = document.createElement('div'); mPlaceSep.className = 'nose-sep'; mPlaceSep.textContent = '配置エリア（クリックで追加）';
  moleSec.appendChild(mPlaceSep);
  const mCvs = document.createElement('canvas'); mCvs.width = SHOULDER_CW; mCvs.height = SHOULDER_CH;
  mCvs.style.cssText = 'width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  moleSec.appendChild(mCvs); redrawShoulderMoleCanvas(mCvs);

  const mHint = document.createElement('div'); mHint.className = 'bez-hint'; mHint.textContent = 'クリック→追加  ドラッグ→移動  右クリック→削除';
  moleSec.appendChild(mHint);

  const mStyleSep = document.createElement('div'); mStyleSep.className = 'nose-sep'; mStyleSep.textContent = '形・スタイル';
  moleSec.appendChild(mStyleSep);
  const mShapeRow = document.createElement('div'); mShapeRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';
  [{ label:'丸' },{ label:'楕円' },{ label:'四角' }].forEach((s, i) => {
    const btn = document.createElement('button'); btn.className = 'hbtn'; btn.style.cssText = 'flex:1;padding:3px 2px;font-size:10px;'; btn.textContent = s.label;
    if (i === shoulderMoleState.newShape) btn.style.borderColor = 'var(--accent)';
    btn.addEventListener('click', () => { shoulderMoleState.newShape = i; mShapeRow.querySelectorAll('.hbtn').forEach((b,j) => { b.style.borderColor = j===i ? 'var(--accent)' : ''; }); if (shoulderMoleState.selIdx >= 0) { shoulderMoleState.list[shoulderMoleState.selIdx].shape = i; redrawShoulderMoleCanvas(mCvs); } });
    mShapeRow.appendChild(btn);
  });
  moleSec.appendChild(mShapeRow);

  const mSzRow = document.createElement('div'); mSzRow.className = 'sl-row';
  const mSzNm  = document.createElement('span'); mSzNm.className = 'sl-name'; mSzNm.textContent = '大きさ';
  const mSzInp = document.createElement('input'); mSzInp.type = 'range'; mSzInp.min = 2; mSzInp.max = 18; mSzInp.step = 0.5; mSzInp.value = shoulderMoleState.newSize;
  const mSzVl  = document.createElement('span'); mSzVl.className = 'sl-val'; mSzVl.textContent = shoulderMoleState.newSize;
  mSzInp.addEventListener('input', () => { shoulderMoleState.newSize = parseFloat(mSzInp.value); mSzVl.textContent = mSzInp.value; if (shoulderMoleState.selIdx >= 0) { shoulderMoleState.list[shoulderMoleState.selIdx].size = shoulderMoleState.newSize; redrawShoulderMoleCanvas(mCvs); } });
  mSzRow.appendChild(mSzNm); mSzRow.appendChild(mSzInp); mSzRow.appendChild(mSzVl);
  moleSec.appendChild(mSzRow);

  const mColorRow = document.createElement('div'); mColorRow.className = 'sl-row';
  const mColorNm  = document.createElement('span'); mColorNm.className = 'sl-name'; mColorNm.textContent = '色';
  const mColorInp = document.createElement('input'); mColorInp.type = 'color'; mColorInp.value = shoulderMoleState.newColor; mColorInp.className = 'bez-color-picker';
  mColorInp.addEventListener('input', e => { shoulderMoleState.newColor = e.target.value; if (shoulderMoleState.selIdx >= 0) { shoulderMoleState.list[shoulderMoleState.selIdx].color = e.target.value; redrawShoulderMoleCanvas(mCvs); } });
  mColorRow.appendChild(mColorNm); mColorRow.appendChild(mColorInp);
  moleSec.appendChild(mColorRow);

  const mDelBtn = document.createElement('button'); mDelBtn.className = 'hbtn'; mDelBtn.style.cssText = 'margin-top:8px;width:100%;'; mDelBtn.textContent = '選択したほくろを削除';
  mDelBtn.addEventListener('click', () => { if (shoulderMoleState.selIdx >= 0) { shoulderMoleState.list.splice(shoulderMoleState.selIdx, 1); shoulderMoleState.selIdx = -1; redrawShoulderMoleCanvas(mCvs); } });
  moleSec.appendChild(mDelBtn);

  let mDragging = false, mDragIdx = -1;
  mCvs.addEventListener('contextmenu', e => { e.preventDefault(); const r = mCvs.getBoundingClientRect(); const mx=(e.clientX-r.left)*(SHOULDER_CW/r.width),my=(e.clientY-r.top)*(SHOULDER_CH/r.height); for(let i=shoulderMoleState.list.length-1;i>=0;i--){if(Math.hypot(mx-shoulderMoleState.list[i].x,my-shoulderMoleState.list[i].y)<=shoulderMoleState.list[i].size+6){shoulderMoleState.list.splice(i,1);if(shoulderMoleState.selIdx>=i)shoulderMoleState.selIdx=Math.max(-1,shoulderMoleState.selIdx-1);redrawShoulderMoleCanvas(mCvs);break;}}});
  mCvs.addEventListener('pointerdown', e => { e.preventDefault(); const r = mCvs.getBoundingClientRect(); const mx=(e.clientX-r.left)*(SHOULDER_CW/r.width),my=(e.clientY-r.top)*(SHOULDER_CH/r.height); let hit=-1; for(let i=shoulderMoleState.list.length-1;i>=0;i--){if(Math.hypot(mx-shoulderMoleState.list[i].x,my-shoulderMoleState.list[i].y)<=shoulderMoleState.list[i].size+6){hit=i;break;}} if(hit>=0){shoulderMoleState.selIdx=hit;mDragging=true;mDragIdx=hit;mCvs.setPointerCapture(e.pointerId);}else{shoulderMoleState.list.push({x:mx,y:my,size:shoulderMoleState.newSize,shape:shoulderMoleState.newShape,color:shoulderMoleState.newColor});shoulderMoleState.selIdx=shoulderMoleState.list.length-1;}redrawShoulderMoleCanvas(mCvs);});
  mCvs.addEventListener('pointermove', e => { if(!mDragging)return; const r=mCvs.getBoundingClientRect(); const m=shoulderMoleState.list[mDragIdx]; if(m){m.x=(e.clientX-r.left)*(SHOULDER_CW/r.width);m.y=(e.clientY-r.top)*(SHOULDER_CH/r.height);redrawShoulderMoleCanvas(mCvs);}});
  mCvs.addEventListener('pointerup', () => { mDragging=false; mDragIdx=-1; });
  area.appendChild(moleSec);

  // ══ 3Dペイントセクション ══
  const paintSec = document.createElement('div');
  sections.paint = paintSec;

  const pHintSep = document.createElement('div'); pHintSep.className = 'nose-sep'; pHintSep.textContent = '3Dモデルペイント';
  paintSec.appendChild(pHintSep);

  const pDesc = document.createElement('div'); pDesc.style.cssText = 'font-size:11px;color:var(--text-lo);line-height:1.6;margin:8px 0;padding:0 4px;';
  pDesc.textContent = '3Dペイントで肩・上腕エリアを直接塗ることができます。ブラシ・消しゴム・色・濡れ効果を使ってオリジナルのタトゥーやアートを描いてください。';
  paintSec.appendChild(pDesc);

  const pNote = document.createElement('div'); pNote.style.cssText = 'font-size:10px;color:var(--text-lo);padding:6px 8px;background:rgba(255,200,0,.07);border-radius:4px;margin-bottom:8px;';
  pNote.textContent = '💡 ボディ・全体を選択して肩を塗るのがおすすめ';
  paintSec.appendChild(pNote);

  // 服を隠して塗るボタン（肩）
  const pShHideBtn = document.createElement('button'); pShHideBtn.className = 'deco-action-btn';
  pShHideBtn.textContent = '🩲 服を隠して素体を塗る（推奨）';
  pShHideBtn.style.cssText = 'width:100%;background:#3a1e5a;margin:0 0 4px;border:1px solid #8040c0;';
  pShHideBtn.addEventListener('click', () => {
    const ps = document.getElementById('p3d-part'); if (ps) ps.value = 'body';
    if (typeof hideClothesForPaint === 'function') hideClothesForPaint(['clothes_top','clothes_bra']);
    if (typeof enterPaint3d === 'function') enterPaint3d(); else document.getElementById('btn-paint3d')?.click();
  });
  paintSec.appendChild(pShHideBtn);
  const pShHint = document.createElement('div'); pShHint.style.cssText = 'font-size:10px;color:var(--text-lo);padding:0 4px 8px;'; pShHint.textContent = '✕ ペイント終了ボタンで服が自動復元されます'; paintSec.appendChild(pShHint);

  const pBtnRow = document.createElement('div'); pBtnRow.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  [
    { label:'肩・ボディ全体を3Dペイント', part:'body' },
    { label:'全パーツを3Dペイント',       part:'all'  },
  ].forEach(({ label, part }) => {
    const btn = document.createElement('button'); btn.className = 'deco-action-btn'; btn.textContent = label;
    btn.style.cssText = 'width:100%;background:#1e3a5a;margin:0;';
    btn.addEventListener('click', () => {
      const partSel = document.getElementById('p3d-part');
      if (partSel) partSel.value = part;
      if (typeof enterPaint3d === 'function') enterPaint3d();
      else document.getElementById('btn-paint3d')?.click();
    });
    pBtnRow.appendChild(btn);
  });
  paintSec.appendChild(pBtnRow);

  const pToolSep = document.createElement('div'); pToolSep.className = 'nose-sep'; pToolSep.textContent = 'よく使う色プリセット（3Dペイント連動）';
  paintSec.appendChild(pToolSep);
  const pSwatches = document.createElement('div'); pSwatches.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  ['#1a0a00','#2d1500','#8b0000','#000080','#004400','#c8a030','#1a1a1a','#4b0082','#800000','#003333','#2a0028','#401000'].forEach(c => {
    const sw = document.createElement('div');
    sw.style.cssText = `width:20px;height:20px;background:${c};border-radius:3px;cursor:pointer;border:1px solid #333;`;
    sw.title = c;
    sw.addEventListener('click', () => {
      const cpick = document.getElementById('p3d-color');
      if (cpick) { cpick.value = c; cpick.dispatchEvent(new Event('input')); }
      if (paint3d) paint3d.color = c;
    });
    pSwatches.appendChild(sw);
  });
  paintSec.appendChild(pSwatches);
  area.appendChild(paintSec);

  showTab(activeTab);
}

// ═══════════════════════════════════════════════════════════════
//  汎用ボディパネルビルダー
// ═══════════════════════════════════════════════════════════════
function buildGenericBodyPanel(area, cfg) {
  const {tabKey,templates,accState,tattooState,moleState,cw,ch,drawGuide,paint3dBtns,paint3dDesc,paint3dNote,clothesSlots} = cfg;
  area.innerHTML = '';
  const tabs=[{key:'acc',label:'アクセ'},{key:'tattoo',label:'タトゥー'},{key:'mole',label:'ほくろ'},{key:'paint',label:'3Dペイント'}];
  let activeTab = area[`_${tabKey}Tab`] || 'acc';
  const tabRow=document.createElement('div'); tabRow.style.cssText='display:flex;gap:3px;margin-bottom:8px;';
  const sections={};
  const showTab=key=>{
    activeTab=key; area[`_${tabKey}Tab`]=key;
    Object.entries(sections).forEach(([k,el])=>{el.style.display=k===key?'':'none';});
    tabRow.querySelectorAll(`.${tabKey}-tab`).forEach(b=>{b.classList.toggle('p3d-active',b.dataset.tab===key);});
  };
  tabs.forEach(t=>{
    const btn=document.createElement('button'); btn.className=`p3d-btn ${tabKey}-tab`; btn.dataset.tab=t.key;
    btn.textContent=t.label; btn.style.flex='1';
    btn.addEventListener('click',()=>showTab(t.key)); tabRow.appendChild(btn);
  });
  area.appendChild(tabRow);

  // ── アクセ ──
  const accSec=document.createElement('div'); sections.acc=accSec;
  [...new Set(templates.map(t=>t.group))].forEach(grp=>{
    const sep=document.createElement('div'); sep.className='nose-sep'; sep.textContent=grp; accSec.appendChild(sep);
    const grid=document.createElement('div'); grid.className='thumb-grid';
    templates.forEach((tmpl,i)=>{
      if(tmpl.group!==grp)return;
      const cell=document.createElement('div'); cell.className='thumb-cell'+(accState.selIdx===i?' selected':'');
      const cvs=document.createElement('canvas'); cvs.width=72; cvs.height=72;
      const tc=cvs.getContext('2d'); tc.fillStyle='#0d0f18'; tc.fillRect(0,0,72,72); tmpl.draw(tc,72,72);
      cell.appendChild(cvs);
      const lbl=document.createElement('div'); lbl.className='thumb-label'; lbl.textContent=tmpl.label; cell.appendChild(lbl);
      cell.addEventListener('click',()=>{accState.selIdx=i; buildGenericBodyPanel(area,cfg);});
      grid.appendChild(cell);
    });
    accSec.appendChild(grid);
  });
  area.appendChild(accSec);

  // ── 共通redraw ──
  const redrawTat=tCvs=>{
    const ctx=tCvs.getContext('2d'); ctx.clearRect(0,0,cw,ch); drawGuide(ctx,cw,ch);
    tattooState.list.forEach((t,i)=>{
      ctx.save(); ctx.translate(t.x,t.y); if(t.rot)ctx.rotate(t.rot);
      const hs=t.size/2; ctx.globalAlpha=i===tattooState.selIdx?1:.85;
      if(t.img)ctx.drawImage(t.img,-hs,-hs,t.size,t.size);
      else if(t.presetIdx>=0&&TATTOO_PRESETS[t.presetIdx])TATTOO_PRESETS[t.presetIdx].draw(ctx,t.size,t.size);
      if(i===tattooState.selIdx){ctx.strokeStyle='#4af';ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.strokeRect(-hs-2,-hs-2,t.size+4,t.size+4);ctx.setLineDash([]);}
      ctx.restore();
    });
  };
  const redrawMol=mCvs=>{
    const ctx=mCvs.getContext('2d'); ctx.clearRect(0,0,cw,ch); drawGuide(ctx,cw,ch);
    moleState.list.forEach((m,i)=>{
      ctx.save(); ctx.fillStyle=m.color; ctx.globalAlpha=i===moleState.selIdx?1:.85;
      if(m.shape===0){ctx.beginPath();ctx.arc(m.x,m.y,m.size,0,Math.PI*2);ctx.fill();}
      else if(m.shape===1){ctx.beginPath();ctx.ellipse(m.x,m.y,m.size*1.4,m.size*.7,0,0,Math.PI*2);ctx.fill();}
      else{ctx.fillRect(m.x-m.size,m.y-m.size*.6,m.size*2,m.size*1.2);}
      if(i===moleState.selIdx){ctx.strokeStyle='#4af';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(m.x,m.y,m.size+4,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    });
  };

  // ── タトゥー ──
  const tatSec=document.createElement('div'); sections.tattoo=tatSec;
  const tPreSep=document.createElement('div'); tPreSep.className='nose-sep'; tPreSep.textContent='プリセット（選んで配置エリアをクリック）'; tatSec.appendChild(tPreSep);
  const tGrid=document.createElement('div'); tGrid.className='thumb-grid';
  const tUpLbl=document.createElement('div'); tUpLbl.style.cssText='font-size:10px;color:var(--text-lo);margin:4px 0;'; tUpLbl.textContent='選択中: なし';
  TATTOO_PRESETS.forEach((preset,i)=>{
    const cell=document.createElement('div'); cell.className='thumb-item'+(i===tattooState.presetSel?' selected':''); cell.style.background='#0d0f18';
    const cvs=document.createElement('canvas'); cvs.width=72; cvs.height=72; cvs.style.cssText='width:100%;height:100%;display:block;';
    preset.draw(cvs.getContext('2d'),72,72);
    const lbl=document.createElement('div'); lbl.className='thumb-label'; lbl.textContent=preset.label;
    cell.appendChild(cvs); cell.appendChild(lbl);
    cell.addEventListener('click',()=>{tattooState.presetSel=i;tattooState.activeUrl=null;tGrid.querySelectorAll('.thumb-item').forEach(c=>c.classList.remove('selected'));cell.classList.add('selected');tUpLbl.textContent=`選択中: ${preset.label}`;});
    tGrid.appendChild(cell);
  });
  tatSec.appendChild(tGrid);
  const tUpSep=document.createElement('div'); tUpSep.className='nose-sep'; tUpSep.textContent='画像アップロード'; tatSec.appendChild(tUpSep); tatSec.appendChild(tUpLbl);
  const tUpBtn=document.createElement('button'); tUpBtn.className='hbtn'; tUpBtn.style.cssText='width:100%;margin-bottom:8px;'; tUpBtn.textContent='画像を選択 (PNG/JPG)';
  tUpBtn.addEventListener('click',()=>{const inp=Object.assign(document.createElement('input'),{type:'file',accept:'image/*'});inp.addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{tattooState.activeUrl=ev.target.result;tattooState.presetSel=-1;tGrid.querySelectorAll('.thumb-item').forEach(c=>c.classList.remove('selected'));tUpLbl.textContent=`選択中: ${f.name}`;};r.readAsDataURL(f);});inp.click();});
  tatSec.appendChild(tUpBtn);
  const tPlSep=document.createElement('div'); tPlSep.className='nose-sep'; tPlSep.textContent='配置エリア（クリックで設置）'; tatSec.appendChild(tPlSep);
  const tCvs=document.createElement('canvas'); tCvs.width=cw; tCvs.height=ch;
  tCvs.style.cssText='width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  tatSec.appendChild(tCvs); redrawTat(tCvs);
  const tHint=document.createElement('div'); tHint.className='bez-hint'; tHint.textContent='クリック→設置  ドラッグ→移動  右クリック→削除'; tatSec.appendChild(tHint);
  const tAdjSep=document.createElement('div'); tAdjSep.className='nose-sep'; tAdjSep.textContent='サイズ・回転'; tatSec.appendChild(tAdjSep);
  [{label:'大きさ',key:'newSize',min:20,max:160,step:2,isRot:false},{label:'回転',key:'newRot',min:-180,max:180,step:1,isRot:true}].forEach(sl=>{
    const row=document.createElement('div'); row.className='sl-row';
    const nm=document.createElement('span'); nm.className='sl-name'; nm.textContent=sl.label;
    const inp=document.createElement('input'); inp.type='range'; inp.min=sl.min; inp.max=sl.max; inp.step=sl.step;
    inp.value=sl.isRot?Math.round(tattooState[sl.key]*180/Math.PI):tattooState[sl.key];
    const vl=document.createElement('span'); vl.className='sl-val'; vl.textContent=inp.value;
    inp.addEventListener('input',()=>{const v=parseFloat(inp.value);tattooState[sl.key]=sl.isRot?v*Math.PI/180:v;vl.textContent=inp.value;if(tattooState.selIdx>=0){const t=tattooState.list[tattooState.selIdx];if(sl.isRot)t.rot=tattooState.newRot;else t.size=tattooState.newSize;redrawTat(tCvs);}});
    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl); tatSec.appendChild(row);
  });
  const tDelBtn=document.createElement('button'); tDelBtn.className='hbtn'; tDelBtn.style.cssText='margin-top:8px;width:100%;'; tDelBtn.textContent='選択したタトゥーを削除';
  tDelBtn.addEventListener('click',()=>{if(tattooState.selIdx>=0){tattooState.list.splice(tattooState.selIdx,1);tattooState.selIdx=-1;redrawTat(tCvs);}});
  tatSec.appendChild(tDelBtn);
  let tDrag=false,tDragI=-1;
  const tGC=e=>{const r=tCvs.getBoundingClientRect();return{mx:(e.clientX-r.left)*(cw/r.width),my:(e.clientY-r.top)*(ch/r.height)};};
  tCvs.addEventListener('contextmenu',e=>{e.preventDefault();const{mx,my}=tGC(e);for(let i=tattooState.list.length-1;i>=0;i--){const t=tattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){tattooState.list.splice(i,1);if(tattooState.selIdx>=i)tattooState.selIdx=Math.max(-1,tattooState.selIdx-1);redrawTat(tCvs);break;}}});
  tCvs.addEventListener('pointerdown',e=>{e.preventDefault();const{mx,my}=tGC(e);let hit=-1;for(let i=tattooState.list.length-1;i>=0;i--){const t=tattooState.list[i],d=t.size/2+8;if(Math.abs(mx-t.x)<=d&&Math.abs(my-t.y)<=d){hit=i;break;}}if(hit>=0){tattooState.selIdx=hit;tDrag=true;tDragI=hit;tCvs.setPointerCapture(e.pointerId);}else{const hasP=tattooState.presetSel>=0,hasU=!!tattooState.activeUrl;if(!hasP&&!hasU)return;const entry={x:mx,y:my,size:tattooState.newSize,rot:tattooState.newRot,presetIdx:hasP?tattooState.presetSel:-1,img:null};if(hasU&&!hasP){const img=new Image();img.src=tattooState.activeUrl;img.onload=()=>{entry.img=img;redrawTat(tCvs);};}tattooState.list.push(entry);tattooState.selIdx=tattooState.list.length-1;}redrawTat(tCvs);});
  tCvs.addEventListener('pointermove',e=>{if(!tDrag)return;const{mx,my}=tGC(e);const t=tattooState.list[tDragI];if(t){t.x=mx;t.y=my;redrawTat(tCvs);}});
  tCvs.addEventListener('pointerup',()=>{tDrag=false;tDragI=-1;});
  area.appendChild(tatSec);

  // ── ほくろ ──
  const moleSec=document.createElement('div'); sections.mole=moleSec;
  const mPlSep=document.createElement('div'); mPlSep.className='nose-sep'; mPlSep.textContent='配置エリア（クリックで追加）'; moleSec.appendChild(mPlSep);
  const mCvs=document.createElement('canvas'); mCvs.width=cw; mCvs.height=ch;
  mCvs.style.cssText='width:100%;max-width:240px;display:block;cursor:crosshair;background:#080a12;border:1px solid #2a3050;border-radius:4px;margin:0 auto 6px;touch-action:none;user-select:none;';
  moleSec.appendChild(mCvs); redrawMol(mCvs);
  const mHint=document.createElement('div'); mHint.className='bez-hint'; mHint.textContent='クリック→追加  ドラッグ→移動  右クリック→削除'; moleSec.appendChild(mHint);
  const mStSep=document.createElement('div'); mStSep.className='nose-sep'; mStSep.textContent='形・スタイル'; moleSec.appendChild(mStSep);
  const mShRow=document.createElement('div'); mShRow.style.cssText='display:flex;gap:4px;margin-bottom:8px;';
  [{label:'丸'},{label:'楕円'},{label:'四角'}].forEach((s,i)=>{
    const btn=document.createElement('button'); btn.className='hbtn'; btn.style.cssText='flex:1;padding:3px 2px;font-size:10px;'; btn.textContent=s.label;
    if(i===moleState.newShape)btn.style.borderColor='var(--accent)';
    btn.addEventListener('click',()=>{moleState.newShape=i;mShRow.querySelectorAll('.hbtn').forEach((b,j)=>{b.style.borderColor=j===i?'var(--accent)':'';});if(moleState.selIdx>=0){moleState.list[moleState.selIdx].shape=i;redrawMol(mCvs);}});
    mShRow.appendChild(btn);
  });
  moleSec.appendChild(mShRow);
  const mSzRow=document.createElement('div'); mSzRow.className='sl-row';
  const mSzNm=document.createElement('span'); mSzNm.className='sl-name'; mSzNm.textContent='大きさ';
  const mSzIn=document.createElement('input'); mSzIn.type='range'; mSzIn.min=2; mSzIn.max=18; mSzIn.step=0.5; mSzIn.value=moleState.newSize;
  const mSzVl=document.createElement('span'); mSzVl.className='sl-val'; mSzVl.textContent=moleState.newSize;
  mSzIn.addEventListener('input',()=>{moleState.newSize=parseFloat(mSzIn.value);mSzVl.textContent=mSzIn.value;if(moleState.selIdx>=0){moleState.list[moleState.selIdx].size=moleState.newSize;redrawMol(mCvs);}});
  mSzRow.appendChild(mSzNm); mSzRow.appendChild(mSzIn); mSzRow.appendChild(mSzVl); moleSec.appendChild(mSzRow);
  const mClRow=document.createElement('div'); mClRow.className='sl-row';
  const mClNm=document.createElement('span'); mClNm.className='sl-name'; mClNm.textContent='色';
  const mClIn=document.createElement('input'); mClIn.type='color'; mClIn.value=moleState.newColor; mClIn.className='bez-color-picker';
  mClIn.addEventListener('input',e=>{moleState.newColor=e.target.value;if(moleState.selIdx>=0){moleState.list[moleState.selIdx].color=e.target.value;redrawMol(mCvs);}});
  mClRow.appendChild(mClNm); mClRow.appendChild(mClIn); moleSec.appendChild(mClRow);
  const mDelBtn=document.createElement('button'); mDelBtn.className='hbtn'; mDelBtn.style.cssText='margin-top:8px;width:100%;'; mDelBtn.textContent='選択したほくろを削除';
  mDelBtn.addEventListener('click',()=>{if(moleState.selIdx>=0){moleState.list.splice(moleState.selIdx,1);moleState.selIdx=-1;redrawMol(mCvs);}});
  moleSec.appendChild(mDelBtn);
  let mDrag=false,mDragI=-1;
  mCvs.addEventListener('contextmenu',e=>{e.preventDefault();const r=mCvs.getBoundingClientRect();const mx=(e.clientX-r.left)*(cw/r.width),my=(e.clientY-r.top)*(ch/r.height);for(let i=moleState.list.length-1;i>=0;i--){if(Math.hypot(mx-moleState.list[i].x,my-moleState.list[i].y)<=moleState.list[i].size+6){moleState.list.splice(i,1);if(moleState.selIdx>=i)moleState.selIdx=Math.max(-1,moleState.selIdx-1);redrawMol(mCvs);break;}}});
  mCvs.addEventListener('pointerdown',e=>{e.preventDefault();const r=mCvs.getBoundingClientRect();const mx=(e.clientX-r.left)*(cw/r.width),my=(e.clientY-r.top)*(ch/r.height);let hit=-1;for(let i=moleState.list.length-1;i>=0;i--){if(Math.hypot(mx-moleState.list[i].x,my-moleState.list[i].y)<=moleState.list[i].size+6){hit=i;break;}}if(hit>=0){moleState.selIdx=hit;mDrag=true;mDragI=hit;mCvs.setPointerCapture(e.pointerId);}else{moleState.list.push({x:mx,y:my,size:moleState.newSize,shape:moleState.newShape,color:moleState.newColor});moleState.selIdx=moleState.list.length-1;}redrawMol(mCvs);});
  mCvs.addEventListener('pointermove',e=>{if(!mDrag)return;const r=mCvs.getBoundingClientRect();const m=moleState.list[mDragI];if(m){m.x=(e.clientX-r.left)*(cw/r.width);m.y=(e.clientY-r.top)*(ch/r.height);redrawMol(mCvs);}});
  mCvs.addEventListener('pointerup',()=>{mDrag=false;mDragI=-1;});
  area.appendChild(moleSec);

  // ── 3Dペイント ──
  const paintSec=document.createElement('div'); sections.paint=paintSec;
  const pHSep=document.createElement('div'); pHSep.className='nose-sep'; pHSep.textContent='3Dモデルペイント'; paintSec.appendChild(pHSep);
  const pDesc=document.createElement('div'); pDesc.style.cssText='font-size:11px;color:var(--text-lo);line-height:1.6;margin:8px 0;padding:0 4px;'; pDesc.textContent=paint3dDesc; paintSec.appendChild(pDesc);
  if(paint3dNote){const pN=document.createElement('div');pN.style.cssText='font-size:10px;color:var(--text-lo);padding:6px 8px;background:rgba(255,200,0,.07);border-radius:4px;margin-bottom:8px;';pN.textContent=paint3dNote;paintSec.appendChild(pN);}
  const pBR=document.createElement('div'); pBR.style.cssText='display:flex;flex-direction:column;gap:6px;';

  // 服を隠して塗るボタン（clothesSlotsが指定されている場合）
  if(clothesSlots&&clothesSlots.length>0){
    const hideBtn=document.createElement('button'); hideBtn.className='deco-action-btn';
    hideBtn.textContent='🩲 服を隠して素体を塗る（推奨）';
    hideBtn.style.cssText='width:100%;background:#3a1e5a;margin:0;border:1px solid #8040c0;';
    hideBtn.title='この部位を覆う服を一時的に非表示にしてペイントモードに入ります。終了時に自動復元されます。';
    hideBtn.addEventListener('click',()=>{
      const ps=document.getElementById('p3d-part');if(ps)ps.value='body';
      if(typeof hideClothesForPaint==='function')hideClothesForPaint(clothesSlots);
      if(typeof enterPaint3d==='function')enterPaint3d();
      else document.getElementById('btn-paint3d')?.click();
    });
    pBR.appendChild(hideBtn);
    const hint=document.createElement('div'); hint.style.cssText='font-size:10px;color:var(--text-lo);padding:3px 4px;';
    hint.textContent='✕ ペイント終了ボタンで服が自動復元されます';
    pBR.appendChild(hint);
  }

  (paint3dBtns||[{label:'ボディ全体を3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}]).forEach(({label,part})=>{
    const btn=document.createElement('button'); btn.className='deco-action-btn'; btn.textContent=label; btn.style.cssText='width:100%;background:#1e3a5a;margin:0;';
    btn.addEventListener('click',()=>{const ps=document.getElementById('p3d-part');if(ps)ps.value=part;if(typeof enterPaint3d==='function')enterPaint3d();else document.getElementById('btn-paint3d')?.click();});
    pBR.appendChild(btn);
  });
  paintSec.appendChild(pBR);
  const pTSep=document.createElement('div'); pTSep.className='nose-sep'; pTSep.textContent='よく使う色プリセット（3Dペイント連動）'; paintSec.appendChild(pTSep);
  const pSw=document.createElement('div'); pSw.style.cssText='display:flex;flex-wrap:wrap;gap:4px;';
  ['#1a0a00','#2d1500','#8b0000','#000080','#004400','#c8a030','#1a1a1a','#4b0082','#800000','#003333','#2a0028','#401000'].forEach(c=>{
    const sw=document.createElement('div'); sw.style.cssText=`width:20px;height:20px;background:${c};border-radius:3px;cursor:pointer;border:1px solid #333;`; sw.title=c;
    sw.addEventListener('click',()=>{const cp=document.getElementById('p3d-color');if(cp){cp.value=c;cp.dispatchEvent(new Event('input'));}if(paint3d)paint3d.color=c;});
    pSw.appendChild(sw);
  });
  paintSec.appendChild(pSw); area.appendChild(paintSec);
  showTab(activeTab);
}


// ═══════════════════════════════════════════════════════════════
//  胸元パネル
// ═══════════════════════════════════════════════════════════════
const CHEST_TEMPLATES = [
  // ── ブローチ ──
  { label:'丸ブローチ', group:'ブローチ', draw(ctx,w,h){
    const g=ctx.createRadialGradient(w*.5,h*.38,0,w*.5,h*.38,w*.18);g.addColorStop(0,'#ffd700');g.addColorStop(1,'#a06010');
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.18,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.1,0,Math.PI*2);ctx.fillStyle='rgba(255,255,200,.4)';ctx.fill();
  }},
  { label:'花ブローチ', group:'ブローチ', draw(ctx,w,h){
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(w*.5+Math.cos(a)*w*.12,h*.38+Math.sin(a)*h*.1,w*.08,h*.06,a,0,Math.PI*2);ctx.fillStyle='#e8a0b0';ctx.fill();}
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.06,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label:'星ブローチ', group:'ブローチ', draw(ctx,w,h){
    ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;ctx.lineTo(w*.5+Math.cos(a)*w*.17,h*.38+Math.sin(a)*h*.15);ctx.lineTo(w*.5+Math.cos(b)*w*.07,h*.38+Math.sin(b)*h*.06);}
    ctx.closePath();ctx.fillStyle='#c8a030';ctx.fill();ctx.strokeStyle='#ffd700';ctx.lineWidth=1;ctx.stroke();
  }},
  { label:'翼ブローチ', group:'ブローチ', draw(ctx,w,h){
    [[-1,1]].forEach(([d])=>{
      ctx.save();ctx.translate(w*.5,h*.38);ctx.scale(d,1);
      ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(w*.08,-h*.08,w*.22,-h*.1,w*.24,0);ctx.bezierCurveTo(w*.22,h*.06,w*.08,h*.04,0,0);
      ctx.fillStyle='rgba(240,240,255,.9)';ctx.fill();ctx.strokeStyle='#aac';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
    });
    ctx.save();ctx.translate(w*.5,h*.38);ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(w*.08,-h*.08,w*.22,-h*.1,w*.24,0);ctx.bezierCurveTo(w*.22,h*.06,w*.08,h*.04,0,0);ctx.fillStyle='rgba(240,240,255,.9)';ctx.fill();ctx.strokeStyle='#aac';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
  }},
  { label:'蝶ブローチ', group:'ブローチ', draw(ctx,w,h){
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(w*.5+sx*w*.1,h*.38+sy*h*.07,w*.09,h*.06,0,0,Math.PI*2);ctx.fillStyle=`rgba(180,100,220,.75)`;ctx.fill();});
    ctx.beginPath();ctx.moveTo(w*.5,h*.24);ctx.lineTo(w*.5,h*.52);ctx.strokeStyle='#333';ctx.lineWidth=1.5;ctx.stroke();
  }},
  { label:'クリスタルブローチ', group:'ブローチ', draw(ctx,w,h){
    [[w*.5,h*.28,h*.12],[w*.38,h*.42,h*.08],[w*.62,h*.42,h*.08]].forEach(([cx,cy,r])=>{
      ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx+r*.7,cy+r*.7);ctx.lineTo(cx-r*.7,cy+r*.7);ctx.closePath();
      ctx.fillStyle='rgba(140,210,255,.65)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=1;ctx.stroke();
    });
  }},
  { label:'薔薇ブローチ', group:'ブローチ', draw(ctx,w,h){
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5,r=w*.08+i*w*.02;ctx.beginPath();ctx.arc(w*.5+Math.cos(a)*r*.5,h*.38+Math.sin(a)*r*.45,r,0,Math.PI*2);ctx.fillStyle=`rgba(200,50,80,${.4+i*.1})`;ctx.fill();}
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.04,0,Math.PI*2);ctx.fillStyle='#ff8080';ctx.fill();
  }},
  { label:'ハートブローチ', group:'ブローチ', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.46);ctx.bezierCurveTo(w*.2,h*.3,w*.2,h*.2,w*.5,h*.28);ctx.bezierCurveTo(w*.8,h*.2,w*.8,h*.3,w*.5,h*.46);
    ctx.fillStyle='#e03060';ctx.fill();ctx.strokeStyle='#ff6090';ctx.lineWidth=1.5;ctx.stroke();
  }},
  { label:'リボンブローチ', group:'ブローチ', draw(ctx,w,h){
    [[w*.32,h*.38],[w*.68,h*.38]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.15,h*.1,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,140,.8)';ctx.fill();});
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.04,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();
  }},
  { label:'騎士ブローチ', group:'ブローチ', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.26);ctx.lineTo(w*.64,h*.34);ctx.lineTo(w*.64,h*.48);ctx.lineTo(w*.5,h*.52);ctx.lineTo(w*.36,h*.48);ctx.lineTo(w*.36,h*.34);ctx.closePath();
    ctx.fillStyle='#2a4a6a';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(w*.5,h*.32);ctx.lineTo(w*.5,h*.46);ctx.moveTo(w*.4,h*.39);ctx.lineTo(w*.6,h*.39);ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();
  }},
  // ── 胸飾り ──
  { label:'胸鎧', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.25,h*.2);ctx.lineTo(w*.75,h*.2);ctx.lineTo(w*.8,h*.7);ctx.lineTo(w*.5,h*.78);ctx.lineTo(w*.2,h*.7);ctx.closePath();
    ctx.fillStyle='#3a5070';ctx.fill();ctx.strokeStyle='#7090b0';ctx.lineWidth=1.5;ctx.stroke();
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(w*.3,h*(.32+i*.14));ctx.lineTo(w*.7,h*(.32+i*.14));ctx.strokeStyle='#5080a0';ctx.lineWidth=1;ctx.stroke();}
  }},
  { label:'胸十字', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.15);ctx.lineTo(w*.5,h*.75);ctx.moveTo(w*.25,h*.38);ctx.lineTo(w*.75,h*.38);
    ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.06;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,h*.38,w*.06,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label:'胸チェーン', group:'胸飾り', draw(ctx,w,h){
    for(let i=0;i<8;i++){const t=i/7,x=w*.2+t*w*.6,y=h*.35+Math.sin(t*Math.PI)*h*.08;ctx.beginPath();ctx.arc(x,y,w*.02,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();if(i>0){ctx.beginPath();const px=w*.2+(i-1)/7*w*.6,py=h*.35+Math.sin((i-1)/7*Math.PI)*h*.08;ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.stroke();}}
  }},
  { label:'胸紋章', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.18);ctx.lineTo(w*.7,h*.32);ctx.lineTo(w*.68,h*.58);ctx.lineTo(w*.5,h*.66);ctx.lineTo(w*.32,h*.58);ctx.lineTo(w*.3,h*.32);ctx.closePath();
    ctx.fillStyle='rgba(200,160,48,.15)';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;ctx.beginPath();ctx.lineTo(w*.5+Math.cos(a)*w*.1,h*.42+Math.sin(a)*h*.09);ctx.lineTo(w*.5+Math.cos(b)*w*.04,h*.42+Math.sin(b)*h*.035);}
    ctx.closePath();ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label:'胸コルセット', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.roundRect(w*.2,h*.15,w*.6,h*.6,h*.04);ctx.fillStyle='rgba(30,10,40,.6)';ctx.fill();ctx.strokeStyle='#8040a0';ctx.lineWidth=1.5;ctx.stroke();
    for(let i=0;i<5;i++){const y=h*(.22+i*.1);[[w*.3,w*.36],[w*.64,w*.7]].forEach(([x1,x2])=>{ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.strokeStyle='#c080f0';ctx.lineWidth=1;ctx.stroke();});}
    for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(w*.5,h*(.22+i*.1));ctx.lineTo(w*.5,h*(.22+(i+1)*.1));ctx.strokeStyle='#c080f0';ctx.lineWidth=1.5;ctx.stroke();}
  }},
  { label:'胸リボン', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.2,h*.2);ctx.lineTo(w*.8,h*.65);ctx.moveTo(w*.8,h*.2);ctx.lineTo(w*.2,h*.65);ctx.strokeStyle='#e04080';ctx.lineWidth=w*.025;ctx.stroke();
    [[w*.32,h*.35],[w*.68,h*.35]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.12,h*.08,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,120,.8)';ctx.fill();});
    ctx.beginPath();ctx.arc(w*.5,h*.425,w*.04,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();
  }},
  { label:'胸レース', group:'胸飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.15,h*.25);ctx.lineTo(w*.85,h*.25);ctx.lineTo(w*.85,h*.7);ctx.lineTo(w*.15,h*.7);ctx.closePath();ctx.fillStyle='rgba(240,220,240,.08)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();
    for(let i=0;i<7;i++){const x=w*.18+i*w*.1;ctx.beginPath();ctx.moveTo(x,h*.25);ctx.bezierCurveTo(x-w*.03,h*.4,x+w*.03,h*.4,x,h*.55);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=.8;ctx.stroke();}
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(w*.15,h*(.35+i*.12));ctx.lineTo(w*.85,h*(.35+i*.12));ctx.strokeStyle='rgba(220,190,220,.3)';ctx.lineWidth=.5;ctx.stroke();}
  }},
  { label:'胸ビジュー', group:'胸飾り', draw(ctx,w,h){
    const pts=[[w*.5,h*.22],[w*.35,h*.38],[w*.5,h*.54],[w*.65,h*.38],[w*.5,h*.22]];
    for(let i=0;i<pts.length-1;i++){ctx.beginPath();ctx.moveTo(pts[i][0],pts[i][1]);ctx.lineTo(pts[i+1][0],pts[i+1][1]);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();}
    [[w*.5,h*.22],[w*.35,h*.38],[w*.5,h*.54],[w*.65,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.04,0,Math.PI*2);ctx.fillStyle='#e8c840';ctx.fill();});
    [[w*.42,h*.3],[w*.58,h*.3],[w*.42,h*.46],[w*.58,h*.46]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.025,0,Math.PI*2);ctx.fillStyle='#cc88ff';ctx.fill();});
  }},
  { label:'胸花飾り', group:'胸飾り', draw(ctx,w,h){
    [[w*.3,h*.32],[w*.7,h*.32],[w*.5,h*.55]].forEach(([fx,fy])=>{
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(fx+Math.cos(a)*w*.06,fy+Math.sin(a)*h*.05,w*.05,h*.04,0,0,Math.PI*2);ctx.fillStyle='#ffb0c8';ctx.fill();}
      ctx.beginPath();ctx.arc(fx,fy,w*.025,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
    });
    [[w*.3,h*.32,w*.5,h*.55],[w*.7,h*.32,w*.5,h*.55]].forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle='#60a060';ctx.lineWidth=1.5;ctx.stroke();});
  }},
  { label:'胸ハーネス', group:'胸飾り', draw(ctx,w,h){
    [[w*.2,h*.15,w*.8,h*.15],[w*.2,h*.15,w*.35,h*.65],[w*.8,h*.15,w*.65,h*.65],[w*.35,h*.65,w*.65,h*.65],[w*.3,h*.4,w*.7,h*.4]].forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=w*.03;ctx.stroke();});
    [[w*.2,h*.15],[w*.8,h*.15],[w*.35,h*.65],[w*.65,h*.65],[w*.3,h*.4],[w*.7,h*.4]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.025,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();});
  }},
  // ── ハーネス・デコ ──
  { label:'スターハーネス', group:'デコルテ装飾', draw(ctx,w,h){
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const x=w*.5+Math.cos(a)*w*.22,y=h*.42+Math.sin(a)*h*.18;ctx.beginPath();ctx.moveTo(w*.5,h*.42);ctx.lineTo(x,y);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(x,y,w*.025,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();}
    ctx.beginPath();ctx.arc(w*.5,h*.42,w*.04,0,Math.PI*2);ctx.fillStyle='#e8c840';ctx.fill();
  }},
  { label:'キラキラデコ', group:'デコルテ装飾', draw(ctx,w,h){
    for(let i=0;i<15;i++){const x=w*(.2+Math.random()*.6),y=h*(.15+Math.random()*.6);ctx.beginPath();for(let j=0;j<4;j++){const a=j*Math.PI/2,r=w*.03;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.strokeStyle=`hsl(${Math.random()*60+30},90%,70%)`;ctx.lineWidth=1;ctx.stroke();}
  }},
  { label:'蝶々デコ', group:'デコルテ装飾', draw(ctx,w,h){
    [[w*.28,h*.3],[w*.72,h*.3],[w*.5,h*.6]].forEach(([cx,cy])=>{
      [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(cx+sx*w*.07,cy+sy*h*.05,w*.065,h*.04,0,0,Math.PI*2);ctx.fillStyle='rgba(160,100,220,.7)';ctx.fill();});
      ctx.beginPath();ctx.moveTo(cx,cy-h*.07);ctx.lineTo(cx,cy+h*.07);ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();
    });
  }},
  { label:'レースデコ', group:'デコルテ装飾', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.1,h*.25);ctx.bezierCurveTo(w*.3,h*.15,w*.7,h*.15,w*.9,h*.25);ctx.strokeStyle='rgba(220,200,220,.7)';ctx.lineWidth=w*.04;ctx.stroke();
    for(let i=0;i<9;i++){const t=i/8,x=w*.1+t*w*.8,y=h*.25+Math.sin(t*Math.PI)*h*.05;ctx.beginPath();ctx.arc(x,y,w*.015,0,Math.PI*2);ctx.fillStyle='rgba(220,200,220,.8)';ctx.fill();}
  }},
  { label:'チェーンデコ', group:'デコルテ装飾', draw(ctx,w,h){
    for(let i=0;i<10;i++){const t=i/9,x=w*.15+t*w*.7,y=h*.28+Math.sin(t*Math.PI)*h*.12;const nx=w*.15+(i+1)/9*w*.7,ny=h*.28+Math.sin((i+1)/9*Math.PI)*h*.12;ctx.beginPath();ctx.ellipse((x+nx)/2,(y+ny)/2,w*.025,h*.018,Math.atan2(ny-y,nx-x),0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();}
    ctx.beginPath();ctx.arc(w*.5,h*.4,w*.035,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();
  }},
  { label:'紋章デコ', group:'デコルテ装飾', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.15);ctx.lineTo(w*.72,h*.28);ctx.lineTo(w*.72,h*.55);ctx.lineTo(w*.5,h*.65);ctx.lineTo(w*.28,h*.55);ctx.lineTo(w*.28,h*.28);ctx.closePath();ctx.fillStyle='rgba(200,160,48,.12)';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=1.5;ctx.stroke();
    ctx.font=`${w*.2}px serif`;ctx.fillStyle='#c8a030';ctx.textAlign='center';ctx.fillText('✦',w*.5,h*.46);
  }},
  { label:'ボタン列', group:'デコルテ装飾', draw(ctx,w,h){
    for(let i=0;i<6;i++){const y=h*(.2+i*.12);ctx.beginPath();ctx.arc(w*.5,y,w*.04,0,Math.PI*2);ctx.fillStyle='#e8d8c8';ctx.fill();ctx.strokeStyle='#888';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();[[-.01,-.01],[.01,-.01],[-.01,.01],[.01,.01]].forEach(([dx,dy],j)=>{if(j===0)ctx.moveTo(w*.5+dx*w*.04,y+dy*h*.04);else ctx.lineTo(w*.5+dx*w*.04,y+dy*h*.04);});ctx.strokeStyle='#666';ctx.lineWidth=.5;ctx.stroke();}
  }},
  { label:'ピアスデコ', group:'デコルテ装飾', draw(ctx,w,h){
    [[w*.32,h*.28],[w*.68,h*.28]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px,py,w*.04,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();ctx.strokeStyle='#e8c840';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(px,py,w*.025,0,Math.PI*2);ctx.fillStyle='#1a1a1a';ctx.fill();ctx.beginPath();ctx.moveTo(px,py+w*.04);ctx.lineTo(px-w*.025,py+h*.12);ctx.lineTo(px+w*.025,py+h*.12);ctx.closePath();ctx.fillStyle='#c8a030';ctx.fill();});
  }},
];

const CHEST_CW=240,CHEST_CH=260;
const chestAccState={selIdx:-1};
const chestTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const chestMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawChestGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(w*.38,0);ctx.lineTo(w*.38,h*.15);
  ctx.moveTo(w*.62,0);ctx.lineTo(w*.62,h*.15);
  ctx.moveTo(w*.38,h*.15);ctx.bezierCurveTo(w*.2,h*.2,w*.05,h*.28,w*.02,h*.42);
  ctx.moveTo(w*.62,h*.15);ctx.bezierCurveTo(w*.8,h*.2,w*.95,h*.28,w*.98,h*.42);
  ctx.moveTo(w*.02,h*.42);ctx.bezierCurveTo(w*.1,h*.55,w*.3,h*.7,w*.5,h*.75);
  ctx.moveTo(w*.98,h*.42);ctx.bezierCurveTo(w*.9,h*.55,w*.7,h*.7,w*.5,h*.75);
  ctx.moveTo(w*.38,h*.15);ctx.bezierCurveTo(w*.42,h*.35,w*.5,h*.4,w*.5,h*.42);
  ctx.moveTo(w*.62,h*.15);ctx.bezierCurveTo(w*.58,h*.35,w*.5,h*.4,w*.5,h*.42);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildChestPanel(area){buildGenericBodyPanel(area,{tabKey:'chest',templates:CHEST_TEMPLATES,accState:chestAccState,tattooState:chestTattooState,moleState:chestMoleState,cw:CHEST_CW,ch:CHEST_CH,drawGuide:drawChestGuide,clothesSlots:['clothes_top','clothes_bra'],paint3dBtns:[{label:'胸元・ボディを3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで胸元・デコルテエリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して胸元を塗るのがおすすめ'});}


// ═══════════════════════════════════════════════════════════════
//  へそパネル
// ═══════════════════════════════════════════════════════════════
const NAVEL_TEMPLATES = [
  // ── ボディジュエル ──
  { label:'バーベルピアス', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.3);ctx.lineTo(w*.5,h*.68);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.03;ctx.stroke();
    [h*.28,h*.7].forEach(y=>{ctx.beginPath();ctx.arc(w*.5,y,w*.045,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});
  }},
  { label:'リングピアス', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.16,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.03;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,h*.34,w*.04,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label:'星ジュエル', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;ctx.lineTo(w*.5+Math.cos(a)*w*.15,h*.5+Math.sin(a)*h*.13);ctx.lineTo(w*.5+Math.cos(b)*w*.06,h*.5+Math.sin(b)*h*.05);}
    ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();
  }},
  { label:'花ジュエル', group:'ボディジュエル', draw(ctx,w,h){
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(w*.5+Math.cos(a)*w*.12,h*.5+Math.sin(a)*h*.1,w*.07,h*.05,a,0,Math.PI*2);ctx.fillStyle='#ff88cc';ctx.fill();}
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.05,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label:'ダイヤジュエル', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.32);ctx.lineTo(w*.66,h*.5);ctx.lineTo(w*.5,h*.68);ctx.lineTo(w*.34,h*.5);ctx.closePath();ctx.fillStyle='rgba(140,210,255,.8)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(w*.5,h*.36);ctx.lineTo(w*.62,h*.5);ctx.lineTo(w*.5,h*.64);ctx.lineTo(w*.38,h*.5);ctx.closePath();ctx.fillStyle='rgba(200,240,255,.5)';ctx.fill();
  }},
  { label:'月ジュエル', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.15,0,Math.PI*2);ctx.fillStyle='rgba(200,180,120,.7)';ctx.fill();
    ctx.beginPath();ctx.arc(w*.58,h*.46,w*.12,0,Math.PI*2);ctx.fillStyle='#0d0f18';ctx.fill();
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.04,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();
  }},
  { label:'ハートジュエル', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.6);ctx.bezierCurveTo(w*.25,h*.42,w*.25,h*.3,w*.5,h*.38);ctx.bezierCurveTo(w*.75,h*.3,w*.75,h*.42,w*.5,h*.6);
    ctx.fillStyle='#e03060';ctx.fill();ctx.strokeStyle='#ff6090';ctx.lineWidth=1.5;ctx.stroke();
  }},
  { label:'スパイクジュエル', group:'ボディジュエル', draw(ctx,w,h){
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(w*.5+Math.cos(a)*w*.08,h*.5+Math.sin(a)*h*.07);ctx.lineTo(w*.5+Math.cos(a)*w*.2,h*.5+Math.sin(a)*h*.17);ctx.strokeStyle='#888';ctx.lineWidth=w*.025;ctx.stroke();}
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.07,0,Math.PI*2);ctx.fillStyle='#1a1a2a';ctx.fill();
  }},
  { label:'ぶら下がり', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.arc(w*.5,h*.32,w*.05,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();
    ctx.beginPath();ctx.moveTo(w*.5,h*.37);ctx.lineTo(w*.5,h*.55);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,h*.6,w*.07,0,Math.PI*2);ctx.fillStyle='rgba(140,210,255,.8)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=1;ctx.stroke();
  }},
  { label:'クラウンジュエル', group:'ボディジュエル', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.32,h*.58);ctx.lineTo(w*.32,h*.36);ctx.lineTo(w*.38,h*.44);ctx.lineTo(w*.5,h*.32);ctx.lineTo(w*.62,h*.44);ctx.lineTo(w*.68,h*.36);ctx.lineTo(w*.68,h*.58);ctx.closePath();
    ctx.fillStyle='#c8a030';ctx.fill();ctx.strokeStyle='#ffd700';ctx.lineWidth=1;ctx.stroke();
    [[w*.38,h*.38],[w*.5,h*.34],[w*.62,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.03,0,Math.PI*2);ctx.fillStyle='#e03060';ctx.fill();});
  }},
  // ── タトゥー飾り ──
  { label:'蓮タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(w*.5+Math.cos(a)*w*.1,h*.5+Math.sin(a)*h*.08,w*.06,h*.05,a,0,Math.PI*2);ctx.strokeStyle='rgba(200,160,220,.8)';ctx.lineWidth=1;ctx.stroke();}
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.04,0,Math.PI*2);ctx.fillStyle='rgba(220,180,240,.6)';ctx.fill();
  }},
  { label:'太陽タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(w*.5+Math.cos(a)*w*.12,h*.5+Math.sin(a)*h*.1);ctx.lineTo(w*.5+Math.cos(a)*w*.22,h*.5+Math.sin(a)*h*.18);ctx.strokeStyle='rgba(240,180,40,.8)';ctx.lineWidth=w*.02;ctx.stroke();}
    ctx.beginPath();ctx.arc(w*.5,h*.5,w*.1,0,Math.PI*2);ctx.fillStyle='rgba(240,180,40,.4)';ctx.fill();ctx.strokeStyle='rgba(240,180,40,.8)';ctx.lineWidth=1.5;ctx.stroke();
  }},
  { label:'矢印タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.2,h*.5);ctx.lineTo(w*.8,h*.5);ctx.moveTo(w*.65,h*.38);ctx.lineTo(w*.8,h*.5);ctx.lineTo(w*.65,h*.62);ctx.strokeStyle='rgba(100,160,220,.9)';ctx.lineWidth=w*.025;ctx.stroke();
  }},
  { label:'幾何学タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    [[w*.5,h*.28,h*.14],[w*.5,h*.5,h*.14]].forEach(([cx,cy,r])=>{ctx.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI*2/3-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}ctx.closePath();ctx.strokeStyle='rgba(100,200,180,.8)';ctx.lineWidth=1;ctx.stroke();});
  }},
  { label:'波紋タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(w*.5,h*.5,i*w*.08,0,Math.PI*2);ctx.strokeStyle=`rgba(100,180,220,${.6-i*.1})`;ctx.lineWidth=1;ctx.stroke();}
  }},
  { label:'花輪タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=w*.18;const fx=w*.5+Math.cos(a)*r,fy=h*.5+Math.sin(a)*r*0.85;ctx.beginPath();ctx.arc(fx,fy,w*.03,0,Math.PI*2);ctx.fillStyle=i%2===0?'#ffb0c8':'#ff8060';ctx.fill();}
  }},
  { label:'稲妻タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.6,h*.2);ctx.lineTo(w*.42,h*.5);ctx.lineTo(w*.54,h*.5);ctx.lineTo(w*.38,h*.8);ctx.strokeStyle='rgba(220,200,60,.9)';ctx.lineWidth=w*.03;ctx.stroke();
  }},
  { label:'天使タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    [[-1,1]].forEach(d=>{ctx.save();ctx.translate(w*.5,h*.42);ctx.scale(d,1);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(w*.1,-h*.1,w*.22,-h*.08,w*.2,h*.02);ctx.bezierCurveTo(w*.18,h*.08,w*.06,h*.06,0,0);ctx.fillStyle='rgba(240,240,255,.85)';ctx.fill();ctx.restore();});
    ctx.save();ctx.translate(w*.5,h*.42);ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(w*.1,-h*.1,w*.22,-h*.08,w*.2,h*.02);ctx.bezierCurveTo(w*.18,h*.08,w*.06,h*.06,0,0);ctx.fillStyle='rgba(240,240,255,.85)';ctx.fill();ctx.restore();
    ctx.beginPath();ctx.arc(w*.5,h*.32,w*.06,0,Math.PI*2);ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(w*.5,h*.44,w*.04,0,Math.PI*2);ctx.fillStyle='#f0c8a0';ctx.fill();
  }},
  { label:'悪魔タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.38,h*.36);ctx.bezierCurveTo(w*.3,h*.2,w*.42,h*.18,w*.5,h*.28);ctx.bezierCurveTo(w*.58,h*.18,w*.7,h*.2,w*.62,h*.36);
    ctx.strokeStyle='rgba(200,40,40,.9)';ctx.lineWidth=w*.02;ctx.stroke();
    ctx.beginPath();ctx.moveTo(w*.5,h*.36);ctx.lineTo(w*.46,h*.68);ctx.moveTo(w*.5,h*.36);ctx.lineTo(w*.54,h*.68);ctx.moveTo(w*.38,h*.58);ctx.bezierCurveTo(w*.46,h*.56,w*.54,h*.56,w*.62,h*.58);
    ctx.strokeStyle='rgba(200,40,40,.9)';ctx.lineWidth=w*.02;ctx.stroke();
  }},
  { label:'宝石タトゥー', group:'タトゥー飾り', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.5,h*.28);ctx.lineTo(w*.68,h*.38);ctx.lineTo(w*.68,h*.6);ctx.lineTo(w*.5,h*.7);ctx.lineTo(w*.32,h*.6);ctx.lineTo(w*.32,h*.38);ctx.closePath();ctx.fillStyle='rgba(100,180,255,.25)';ctx.fill();ctx.strokeStyle='rgba(100,180,255,.8)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.moveTo(w*.5,h*.28);ctx.lineTo(w*.68,h*.38);ctx.lineTo(w*.5,h*.5);ctx.moveTo(w*.68,h*.38);ctx.lineTo(w*.68,h*.6);ctx.lineTo(w*.5,h*.5);ctx.strokeStyle='rgba(140,200,255,.5)';ctx.lineWidth=.8;ctx.stroke();
  }},
];

const NAVEL_CW=240,NAVEL_CH=220;
const navelAccState={selIdx:-1};
const navelTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const navelMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawNavelGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(w*.28,0);ctx.bezierCurveTo(w*.18,h*.2,w*.14,h*.5,w*.18,h*.95);
  ctx.moveTo(w*.72,0);ctx.bezierCurveTo(w*.82,h*.2,w*.86,h*.5,w*.82,h*.95);
  ctx.moveTo(w*.28,0);ctx.bezierCurveTo(w*.38,h*.05,w*.62,h*.05,w*.72,0);
  ctx.moveTo(w*.5,h*.38);ctx.arc(w*.5,h*.38,w*.04,0,Math.PI*2);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildNavelPanel(area){buildGenericBodyPanel(area,{tabKey:'navel',templates:NAVEL_TEMPLATES,accState:navelAccState,tattooState:navelTattooState,moleState:navelMoleState,cw:NAVEL_CW,ch:NAVEL_CH,drawGuide:drawNavelGuide,clothesSlots:['clothes_top','clothes_bot','clothes_bra'],paint3dBtns:[{label:'腹部・ボディを3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで腹部・へそ周辺エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して腹部を塗るのがおすすめ'});}


// ═══════════════════════════════════════════════════════════════
//  鼠径部パネル
// ═══════════════════════════════════════════════════════════════
const GROIN_TEMPLATES = [
  // ── ヒップバンド ──
  { label:'細ヒップバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.32);ctx.bezierCurveTo(w*.2,h*.28,w*.8,h*.28,w*.95,h*.32);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.025;ctx.stroke();
  }},
  { label:'太ヒップバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.3);ctx.bezierCurveTo(w*.2,h*.26,w*.8,h*.26,w*.95,h*.3);ctx.bezierCurveTo(w*.8,h*.36,w*.2,h*.36,w*.05,h*.32);ctx.closePath();ctx.fillStyle='#1a1a2a';ctx.fill();ctx.strokeStyle='#404060';ctx.lineWidth=1;ctx.stroke();
  }},
  { label:'レースバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.28);ctx.bezierCurveTo(w*.2,h*.24,w*.8,h*.24,w*.95,h*.28);ctx.strokeStyle='rgba(220,190,220,.6)';ctx.lineWidth=w*.04;ctx.stroke();
    for(let i=0;i<9;i++){const t=i/8,x=w*.08+t*w*.84,y=h*.28-h*.02*(1-Math.sin(t*Math.PI));ctx.beginPath();ctx.arc(x,y,w*.015,0,Math.PI*2);ctx.fillStyle='rgba(220,190,220,.7)';ctx.fill();}
  }},
  { label:'チェーンバンド', group:'ヒップバンド', draw(ctx,w,h){
    for(let i=0;i<10;i++){const t=i/9,x=w*.07+t*w*.86,y=h*.3-Math.sin(t*Math.PI)*h*.02;const nx=w*.07+(i+1)/9*w*.86,ny=h*.3-Math.sin((i+1)/9*Math.PI)*h*.02;ctx.beginPath();ctx.ellipse((x+nx)/2,(y+ny)/2,w*.022,h*.016,Math.atan2(ny-y,nx-x),0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.018;ctx.stroke();}
  }},
  { label:'リボンバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.3);ctx.bezierCurveTo(w*.2,h*.26,w*.8,h*.26,w*.95,h*.3);ctx.strokeStyle='#e040a0';ctx.lineWidth=w*.025;ctx.stroke();
    [[w*.35,h*.3],[w*.65,h*.3]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.12,h*.07,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,140,.7)';ctx.fill();});
    ctx.beginPath();ctx.arc(w*.5,h*.3,w*.025,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();
  }},
  { label:'ビジューバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.3);ctx.bezierCurveTo(w*.2,h*.26,w*.8,h*.26,w*.95,h*.3);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.04;ctx.stroke();
    for(let i=0;i<8;i++){const t=i/7,x=w*.1+t*w*.8,y=h*.28;ctx.beginPath();ctx.arc(x,y,w*.022,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700','#88ccff'][i%4];ctx.fill();}
  }},
  { label:'スタッズバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.3);ctx.bezierCurveTo(w*.2,h*.26,w*.8,h*.26,w*.95,h*.3);ctx.strokeStyle='#111';ctx.lineWidth=w*.04;ctx.stroke();
    for(let i=0;i<10;i++){const t=i/9,x=w*.08+t*w*.84,y=h*.27;ctx.beginPath();ctx.rect(x-w*.015,y-h*.012,w*.03,h*.024);ctx.fillStyle='#888';ctx.fill();}
  }},
  { label:'ゴールドバンド', group:'ヒップバンド', draw(ctx,w,h){
    const g=ctx.createLinearGradient(0,h*.24,0,h*.34);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');
    ctx.beginPath();ctx.moveTo(w*.05,h*.34);ctx.bezierCurveTo(w*.2,h*.3,w*.8,h*.3,w*.95,h*.34);ctx.bezierCurveTo(w*.8,h*.24,w*.2,h*.24,w*.05,h*.28);ctx.closePath();ctx.fillStyle=g;ctx.fill();
  }},
  { label:'蝶バンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.3);ctx.bezierCurveTo(w*.2,h*.26,w*.8,h*.26,w*.95,h*.3);ctx.strokeStyle='#4a3080';ctx.lineWidth=w*.02;ctx.stroke();
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(w*.5+sx*w*.09,h*.3+sy*h*.06,w*.08,h*.05,0,0,Math.PI*2);ctx.fillStyle='rgba(150,80,220,.7)';ctx.fill();});
    ctx.beginPath();ctx.moveTo(w*.5,h*.2);ctx.lineTo(w*.5,h*.4);ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();
  }},
  { label:'フリルバンド', group:'ヒップバンド', draw(ctx,w,h){
    ctx.beginPath();ctx.moveTo(w*.05,h*.28);ctx.bezierCurveTo(w*.2,h*.24,w*.8,h*.24,w*.95,h*.28);ctx.strokeStyle='#e8c0d0';ctx.lineWidth=w*.015;ctx.stroke();
    for(let i=0;i<10;i++){const t=i/9,x=w*.07+t*w*.86,y=h*.28;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-w*.03,y+h*.04,x+w*.03,y+h*.06,x,y+h*.08);ctx.strokeStyle='rgba(240,180,210,.7)';ctx.lineWidth=1;ctx.stroke();}
  }},
  // ── ガーター ──
  { label:'シンプルガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.02;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-h*.07);ctx.lineTo(cx,h*.28);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);});
  }},
  { label:'リボンガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#e040a0';ctx.lineWidth=w*.025;ctx.stroke();[[cx-w*.06,cy],[cx+w*.06,cy]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.055,h*.035,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,140,.7)';ctx.fill();});ctx.beginPath();ctx.arc(cx,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();});
  }},
  { label:'花ガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#60a860';ctx.lineWidth=w*.015;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.06,w*.04,h*.03,0,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.025,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});
  }},
  { label:'ビジューガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.12,cy+Math.sin(a)*h*.07,w*.02,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700'][i%3];ctx.fill();}});
  }},
  { label:'レースガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.13,h*.08,0,0,Math.PI*2);ctx.fillStyle='rgba(240,220,240,.08)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.09,cy+Math.sin(a)*h*.06);ctx.lineTo(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.09);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();}});
  }},
  { label:'スパイクガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.12,oy=Math.sin(a)*h*.07;ctx.beginPath();ctx.moveTo(cx+ox*.9,cy+oy*.9);ctx.lineTo(cx+ox*1.35,cy+oy*1.35);ctx.strokeStyle='#888';ctx.lineWidth=w*.022;ctx.stroke();}});
  }},
  { label:'チェーンガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.12,cy+Math.sin(a)*h*.07,w*.02,h*.015,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.015;ctx.stroke();}});
  }},
  { label:'メッシュガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,w*.13,h*.08,0,0,Math.PI*2);ctx.clip();for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(cx+i*w*.025-w*.13,cy-h*.09);ctx.lineTo(cx+i*w*.025+w*.13,cy+h*.09);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.moveTo(cx-i*w*.025-w*.13,cy-h*.09);ctx.lineTo(cx-i*w*.025+w*.13,cy+h*.09);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();}ctx.restore();ctx.beginPath();ctx.ellipse(cx,cy,w*.13,h*.08,0,0,Math.PI*2);ctx.strokeStyle='#555';ctx.lineWidth=2;ctx.stroke();});
  }},
  { label:'ゴールドガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.13,cy,cx+w*.13,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.13,h*.08,0,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=w*.04;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy+h*.07,w*.03,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});
  }},
  { label:'蝶ガーター', group:'ガーター', draw(ctx,w,h){
    [[w*.3,h*.55],[w*.7,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.12,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#4a3080';ctx.lineWidth=w*.02;ctx.stroke();[[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(cx+sx*w*.07,cy+sy*h*.045,w*.065,h*.04,0,0,Math.PI*2);ctx.fillStyle='rgba(150,80,220,.65)';ctx.fill();});ctx.beginPath();ctx.moveTo(cx,cy-h*.06);ctx.lineTo(cx,cy+h*.06);ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();});
  }},
];

const GROIN_CW=240,GROIN_CH=280;
const groinAccState={selIdx:-1};
const groinTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const groinMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawGroinGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(w*.22,0);ctx.bezierCurveTo(w*.14,h*.2,w*.12,h*.45,w*.2,h*.75);ctx.bezierCurveTo(w*.28,h*.9,w*.38,h*.95,w*.5,h*.95);
  ctx.moveTo(w*.78,0);ctx.bezierCurveTo(w*.86,h*.2,w*.88,h*.45,w*.8,h*.75);ctx.bezierCurveTo(w*.72,h*.9,w*.62,h*.95,w*.5,h*.95);
  ctx.moveTo(w*.22,0);ctx.bezierCurveTo(w*.35,h*.06,w*.65,h*.06,w*.78,0);
  ctx.moveTo(w*.2,h*.32);ctx.bezierCurveTo(w*.35,h*.28,w*.65,h*.28,w*.8,h*.32);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildGroinPanel(area){buildGenericBodyPanel(area,{tabKey:'groin',templates:GROIN_TEMPLATES,accState:groinAccState,tattooState:groinTattooState,moleState:groinMoleState,cw:GROIN_CW,ch:GROIN_CH,drawGuide:drawGroinGuide,clothesSlots:['clothes_bot','clothes_shorts','clothes_panst'],paint3dBtns:[{label:'腰・ボディを3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで腰・鼠径部エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して腰エリアを塗るのがおすすめ'});}


// ═══════════════════════════════════════════════════════════════
//  太もも・足首・足パネル
// ═══════════════════════════════════════════════════════════════
const THIGH_TEMPLATES = [
  // ── タイバンド ──
  { label:'細バンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.06,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.02;ctx.stroke();});}},
  { label:'太バンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.fillStyle='#1a1a2a';ctx.fill();ctx.strokeStyle='#404060';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#555588';ctx.lineWidth=w*.03;ctx.stroke();});}},
  { label:'ビジューバンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.04;ctx.stroke();for(let i=0;i<7;i++){const a=i*Math.PI/3.5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.07,w*.02,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700'][i%3];ctx.fill();}});}},
  { label:'スパイクバンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.04;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.14,oy=Math.sin(a)*h*.07;ctx.beginPath();ctx.moveTo(cx+ox*.9,cy+oy*.9);ctx.lineTo(cx+ox*1.35,cy+oy*1.35);ctx.strokeStyle='#888';ctx.lineWidth=w*.02;ctx.stroke();}});}},
  { label:'花バンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;for(let p=0;p<4;p++){const pa=a+p*Math.PI/2,fx=cx+Math.cos(a)*w*.14+Math.cos(pa)*w*.02,fy=cy+Math.sin(a)*h*.07+Math.sin(pa)*h*.015;ctx.beginPath();ctx.arc(fx,fy,w*.013,0,Math.PI*2);ctx.fillStyle='#ffb0c8';ctx.fill();}ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.07,w*.012,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();}});}},
  { label:'レースバンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.08,0,0,Math.PI*2);ctx.fillStyle='rgba(240,220,240,.08)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=w*.04;ctx.stroke();for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.06);ctx.lineTo(cx+Math.cos(a)*w*.17,cy+Math.sin(a)*h*.1);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'チェーンバンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.07,w*.022,h*.016,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.016;ctx.stroke();}});}},
  { label:'メッシュバンド', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.08,0,0,Math.PI*2);ctx.clip();for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(cx+i*w*.025-w*.15,cy-h*.09);ctx.lineTo(cx+i*w*.025+w*.15,cy+h*.09);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.moveTo(cx-i*w*.025-w*.15,cy-h*.09);ctx.lineTo(cx-i*w*.025+w*.15,cy+h*.09);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();}ctx.restore();ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.08,0,0,Math.PI*2);ctx.strokeStyle='#555';ctx.lineWidth=2;ctx.stroke();});}},
  { label:'ゴールドカフ', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.15,cy,cx+w*.15,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.08,0,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.04,0,0,Math.PI*2);ctx.fillStyle='#1a1a1a';ctx.fill();ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.08,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'リボンガーター', group:'タイバンド', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#e040a0';ctx.lineWidth=w*.025;ctx.stroke();[[cx-w*.05,cy],[cx+w*.05,cy]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.045,h*.03,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,140,.75)';ctx.fill();});ctx.beginPath();ctx.arc(cx,cy,w*.018,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();});}},
  // ── ガーター ──
  { label:'シンプルガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.06,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.02;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-h*.06);ctx.lineTo(cx,h*.3);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);});}},
  { label:'リボンガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.065,0,0,Math.PI*2);ctx.strokeStyle='#e040a0';ctx.lineWidth=w*.025;ctx.stroke();[[cx-w*.06,cy],[cx+w*.06,cy]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.055,h*.035,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,140,.7)';ctx.fill();});ctx.beginPath();ctx.arc(cx,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();});}},
  { label:'花ガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.065,0,0,Math.PI*2);ctx.strokeStyle='#60a860';ctx.lineWidth=w*.015;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.12,cy+Math.sin(a)*h*.055,w*.04,h*.03,0,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.025,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'レースガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.07,0,0,Math.PI*2);ctx.fillStyle='rgba(240,220,240,.08)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=w*.04;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.055);ctx.lineTo(cx+Math.cos(a)*w*.16,cy+Math.sin(a)*h*.09);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'チェーンガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.065,w*.02,h*.014,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.014;ctx.stroke();}});}},
  { label:'ビジューガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.065,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.065,w*.02,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700'][i%3];ctx.fill();}});}},
  { label:'スパイクガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.065,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.14,oy=Math.sin(a)*h*.065;ctx.beginPath();ctx.moveTo(cx+ox*.9,cy+oy*.9);ctx.lineTo(cx+ox*1.35,cy+oy*1.35);ctx.strokeStyle='#888';ctx.lineWidth=w*.02;ctx.stroke();}});}},
  { label:'ゴールドガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.15,cy,cx+w*.15,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.075,0,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=w*.04;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy+h*.075,w*.028,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'蝶ガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.14,h*.065,0,0,Math.PI*2);ctx.strokeStyle='#4a3080';ctx.lineWidth=w*.02;ctx.stroke();[[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.ellipse(cx+sx*w*.07,cy+sy*h*.045,w*.065,h*.038,0,0,Math.PI*2);ctx.fillStyle='rgba(150,80,220,.65)';ctx.fill();});ctx.beginPath();ctx.moveTo(cx,cy-h*.06);ctx.lineTo(cx,cy+h*.06);ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'メッシュガーター', group:'ガーター', draw(ctx,w,h){[[w*.28,h*.58],[w*.72,h*.58]].forEach(([cx,cy])=>{ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.075,0,0,Math.PI*2);ctx.clip();for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(cx+i*w*.025-w*.15,cy-h*.08);ctx.lineTo(cx+i*w*.025+w*.15,cy+h*.08);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.moveTo(cx-i*w*.025-w*.15,cy-h*.08);ctx.lineTo(cx-i*w*.025+w*.15,cy+h*.08);ctx.strokeStyle='rgba(180,180,200,.5)';ctx.lineWidth=1;ctx.stroke();}ctx.restore();ctx.beginPath();ctx.ellipse(cx,cy,w*.15,h*.075,0,0,Math.PI*2);ctx.strokeStyle='#555';ctx.lineWidth=2;ctx.stroke();})}},
  // ── タトゥー飾り ──
  { label:'炎タトゥー', group:'タトゥー飾り', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([fx,fy])=>{for(let i=0;i<5;i++){const a=(i-.5)*Math.PI*.4,r=h*.2+i*h*.04;ctx.beginPath();ctx.moveTo(fx,fy);ctx.bezierCurveTo(fx+Math.cos(a)*r*.3,fy-r*.3,fx+Math.cos(a)*r*.6,fy-r*.6,fx+Math.cos(a)*r*.5,fy-r);ctx.strokeStyle=`rgba(240,${100+i*30},20,.8)`;ctx.lineWidth=w*.02;ctx.stroke();}});}},
  { label:'龍タトゥー', group:'タトゥー飾り', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([dx,dy])=>{ctx.beginPath();ctx.moveTo(dx,dy+h*.18);ctx.bezierCurveTo(dx-w*.06,dy,dx+w*.06,dy-h*.1,dx,dy-h*.2);ctx.strokeStyle='rgba(180,60,20,.9)';ctx.lineWidth=w*.03;ctx.stroke();ctx.beginPath();ctx.arc(dx,dy-h*.2,w*.04,0,Math.PI*2);ctx.fillStyle='rgba(220,80,30,.8)';ctx.fill();});}},
  { label:'薔薇タトゥー', group:'タトゥー飾り', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([rx,ry])=>{for(let i=0;i<4;i++){const a=i*Math.PI/2,r=w*.04+i*w*.02;ctx.beginPath();ctx.arc(rx+Math.cos(a)*r*.4,ry+Math.sin(a)*r*.4,r,0,Math.PI*2);ctx.fillStyle=`rgba(200,40,60,${.4+i*.1})`;ctx.fill();}ctx.beginPath();ctx.arc(rx,ry,w*.025,0,Math.PI*2);ctx.fillStyle='#ff6080';ctx.fill();});}},
];

const THIGH_CW=240,THIGH_CH=300;
const thighAccState={selIdx:-1};
const thighTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const thighMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawThighGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(w*.18,0);ctx.bezierCurveTo(w*.1,h*.3,w*.12,h*.65,w*.2,h*.98);
  ctx.moveTo(w*.42,0);ctx.bezierCurveTo(w*.36,h*.3,ctx.moveTo=undefined||w*.34,h*.65,w*.36,h*.98);
  ctx.moveTo(w*.58,0);ctx.bezierCurveTo(w*.64,h*.3,w*.66,h*.65,w*.64,h*.98);
  ctx.moveTo(w*.82,0);ctx.bezierCurveTo(w*.9,h*.3,w*.88,h*.65,w*.8,h*.98);
  ctx.moveTo(w*.18,0);ctx.bezierCurveTo(w*.28,h*.04,w*.36,h*.04,w*.42,0);
  ctx.moveTo(w*.58,0);ctx.bezierCurveTo(w*.68,h*.04,w*.76,h*.04,w*.82,0);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildThighPanel(area){buildGenericBodyPanel(area,{tabKey:'thigh',templates:THIGH_TEMPLATES,accState:thighAccState,tattooState:thighTattooState,moleState:thighMoleState,cw:THIGH_CW,ch:THIGH_CH,drawGuide:drawThighGuide,clothesSlots:['clothes_bot','clothes_shorts','clothes_panst','clothes_socks'],paint3dBtns:[{label:'脚・ボディを3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで太もも・脚エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して脚を塗るのがおすすめ'});}

// ─── 足首 ───
const ANKLE_TEMPLATES = [
  { label:'細チェーン', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.018,h*.013,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.014;ctx.stroke();}});}},
  { label:'太チェーン', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.025,h*.018,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.02;ctx.stroke();}});}},
  { label:'ビジューアンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.03;ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.018,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700'][i%3];ctx.fill();}});}},
  { label:'花アンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;for(let p=0;p<4;p++){const pa=a+p*Math.PI/2;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.1+Math.cos(pa)*w*.018,cy+Math.sin(a)*h*.07+Math.sin(pa)*h*.012,w*.012,0,Math.PI*2);ctx.fillStyle='#ffb0c8';ctx.fill();}ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.01,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();}});}},
  { label:'星アンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1.5;ctx.stroke();[0,1,2,3].forEach(i=>{const a=i*Math.PI/2;const sx=cx+Math.cos(a)*w*.1,sy=cy+Math.sin(a)*h*.07;ctx.beginPath();for(let j=0;j<5;j++){const sa=j*Math.PI*2/5-Math.PI/2,sb=sa+Math.PI/5;ctx.lineTo(sx+Math.cos(sa)*w*.028,sy+Math.sin(sa)*h*.022);ctx.lineTo(sx+Math.cos(sb)*w*.012,sy+Math.sin(sb)*h*.009);}ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();});});}},
  { label:'ハートアンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#e03060';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy+h*.09);ctx.bezierCurveTo(cx-w*.04,cy+h*.04,cx-w*.04,cy,cx,cy+h*.02);ctx.bezierCurveTo(cx+w*.04,cy,cx+w*.04,cy+h*.04,cx,cy+h*.09);ctx.fillStyle='#e03060';ctx.fill();});}},
  { label:'レースアンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.11,h*.075,0,0,Math.PI*2);ctx.fillStyle='rgba(240,220,240,.08)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=w*.035;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.055);ctx.lineTo(cx+Math.cos(a)*w*.13,cy+Math.sin(a)*h*.09);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'スパイクアンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.07,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.03;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.1,oy=Math.sin(a)*h*.07;ctx.beginPath();ctx.moveTo(cx+ox*.9,cy+oy*.9);ctx.lineTo(cx+ox*1.4,cy+oy*1.4);ctx.strokeStyle='#888';ctx.lineWidth=w*.018;ctx.stroke();}});}},
  { label:'ゴールドアンクレット', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.11,cy,cx+w*.11,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.11,h*.075,0,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=w*.035;ctx.stroke();});}},
  { label:'タトゥーリング', group:'アンクレット', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{for(let i=1;i<=3;i++){ctx.beginPath();ctx.ellipse(cx,cy,w*.08+i*w*.01,h*.055+i*h*.01,0,0,Math.PI*2);ctx.strokeStyle=`rgba(100,160,220,${.7-i*.15})`;ctx.lineWidth=1;ctx.stroke();}});}},
  // ── レッグリング ──
  { label:'シングルリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.35],[w*.72,h*.35],[w*.28,h*.65],[w*.72,h*.65]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.08,h*.05,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.02;ctx.stroke();});}},
  { label:'ダブルリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.38],[w*.72,h*.38],[w*.28,h*.62],[w*.72,h*.62]].forEach(([cx,cy])=>{[h*.03,0,-h*.03].forEach(dy=>{ctx.beginPath();ctx.ellipse(cx,cy+dy,w*.08,h*.045,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();});});}},
  { label:'花リング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.08,h*.055,0,0,Math.PI*2);ctx.strokeStyle='#60a860';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.055,w*.025,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.015,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'ビジューリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.08,h*.055,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.025;ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.055,w*.016,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700'][i%3];ctx.fill();}});}},
  { label:'スパイクリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.08,h*.055,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.025;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,ox=Math.cos(a)*w*.08,oy=Math.sin(a)*h*.055;ctx.beginPath();ctx.moveTo(cx+ox*.9,cy+oy*.9);ctx.lineTo(cx+ox*1.5,cy+oy*1.5);ctx.strokeStyle='#888';ctx.lineWidth=w*.016;ctx.stroke();}});}},
  { label:'チェーンリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.055,w*.016,h*.012,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.012;ctx.stroke();}});}},
  { label:'ゴールドリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.09,cy,cx+w*.09,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.09,h*.062,0,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=w*.03;ctx.stroke();});}},
  { label:'レースリング', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.09,h*.062,0,0,Math.PI*2);ctx.fillStyle='rgba(240,220,240,.06)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=w*.03;ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.065,cy+Math.sin(a)*h*.045);ctx.lineTo(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07);ctx.strokeStyle='rgba(220,190,220,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'ダブルチェーン', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.45],[w*.28,h*.6],[w*.72,h*.45],[w*.72,h*.6]].forEach(([cx,cy])=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.05,w*.015,h*.011,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.012;ctx.stroke();}});}},
  { label:'タトゥーアンクレット', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.5],[w*.72,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07,w*.01,0,Math.PI*2);ctx.fillStyle='rgba(100,80,180,.8)';ctx.fill();}for(let i=0;i<12;i++){const a=i*Math.PI/6,na=(i+1)*Math.PI/6;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.07);ctx.lineTo(cx+Math.cos(na)*w*.1,cy+Math.sin(na)*h*.07);ctx.strokeStyle='rgba(100,80,180,.6)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'ベルアンクレット', group:'レッグリング', draw(ctx,w,h){[[w*.28,h*.45],[w*.72,h*.45]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.08,h*.055,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<3;i++){const bx=cx+(i-1)*w*.06,by=cy+h*.055;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-w*.015,by+h*.06);ctx.lineTo(bx+w*.015,by+h*.06);ctx.closePath();ctx.fillStyle='#c8a030';ctx.fill();ctx.beginPath();ctx.arc(bx,by+h*.065,w*.012,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();}});}},
];

const ANKLE_CW=240,ANKLE_CH=220;
const ankleAccState={selIdx:-1};
const ankleTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const ankleMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawAnkleGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(w*.2,0);ctx.bezierCurveTo(w*.14,h*.3,w*.16,h*.65,w*.22,h*.95);
  ctx.moveTo(w*.38,0);ctx.bezierCurveTo(w*.34,h*.3,ctx.moveTo=undefined||w*.32,h*.65,w*.3,h*.95);
  ctx.moveTo(w*.62,0);ctx.bezierCurveTo(w*.66,h*.3,w*.68,h*.65,w*.7,h*.95);
  ctx.moveTo(w*.8,0);ctx.bezierCurveTo(w*.86,h*.3,w*.84,h*.65,w*.78,h*.95);
  ctx.moveTo(w*.2,0);ctx.bezierCurveTo(w*.28,h*.04,w*.32,h*.04,w*.38,0);
  ctx.moveTo(w*.62,0);ctx.bezierCurveTo(w*.7,h*.04,w*.74,h*.04,w*.8,0);
  ctx.moveTo(w*.22,h*.6);ctx.bezierCurveTo(w*.28,h*.58,w*.32,h*.58,w*.38,h*.6);
  ctx.moveTo(w*.62,h*.6);ctx.bezierCurveTo(w*.68,h*.58,w*.72,h*.58,w*.78,h*.6);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildAnklePanel(area){buildGenericBodyPanel(area,{tabKey:'ankle',templates:ANKLE_TEMPLATES,accState:ankleAccState,tattooState:ankleTattooState,moleState:ankleMoleState,cw:ANKLE_CW,ch:ANKLE_CH,drawGuide:drawAnkleGuide,clothesSlots:['clothes_socks','clothes_shoes','clothes_panst'],paint3dBtns:[{label:'足首・脚を3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで足首エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して足首エリアを塗るのがおすすめ'});}

// ─── 足 ───
const FOOT_TEMPLATES = [
  // ── 足指輪 ──
  { label:'シンプル指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.38,h*.78],[w*.5,h*.78],[w*.62,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.014;ctx.stroke();});}},
  { label:'ゴールド指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.04,cy,cx+w*.04,cy);g.addColorStop(0,'#a06010');g.addColorStop(.5,'#f0c840');g.addColorStop(1,'#a06010');ctx.beginPath();ctx.ellipse(cx,cy,w*.045,h*.028,0,0,Math.PI*2);ctx.strokeStyle=g;ctx.lineWidth=w*.02;ctx.stroke();});}},
  { label:'花指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#60a860';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.04,cy+Math.sin(a)*h*.025,w*.015,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.01,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'ビジュー指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#2a1a3a';ctx.lineWidth=w*.02;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-h*.025,w*.018,0,Math.PI*2);ctx.fillStyle='#cc88ff';ctx.fill();});}},
  { label:'チェーン指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.04,cy+Math.sin(a)*h*.025,w*.013,h*.009,a,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.01;ctx.stroke();}});}},
  { label:'スター指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;ctx.lineTo(cx+Math.cos(a)*w*.022,cy-h*.025+Math.sin(a)*h*.018);ctx.lineTo(cx+Math.cos(b)*w*.009,cy-h*.025+Math.sin(b)*h*.007);}ctx.closePath();ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'ハート指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#e03060';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-h*.02);ctx.bezierCurveTo(cx-w*.02,cy-h*.03,cx-w*.03,cy-h*.01,cx,cy);ctx.bezierCurveTo(cx+w*.03,cy-h*.01,cx+w*.02,cy-h*.03,cx,cy-h*.02);ctx.fillStyle='#e03060';ctx.fill();});}},
  { label:'スパイク指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.04,h*.025,0,0,Math.PI*2);ctx.strokeStyle='#111';ctx.lineWidth=w*.02;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*w*.04*.9,cy+Math.sin(a)*h*.025*.9);ctx.lineTo(cx+Math.cos(a)*w*.06,cy+Math.sin(a)*h*.04);ctx.strokeStyle='#888';ctx.lineWidth=w*.012;ctx.stroke();}});}},
  { label:'ダブル指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.75],[w*.25,h*.82],[w*.5,h*.75],[w*.5,h*.82],[w*.75,h*.75],[w*.75,h*.82]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.035,h*.02,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'タトゥー指輪', group:'足指輪', draw(ctx,w,h){[[w*.25,h*.78],[w*.5,h*.78],[w*.75,h*.78]].forEach(([cx,cy])=>{for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.04,cy+Math.sin(a)*h*.025,w*.007,0,Math.PI*2);ctx.fillStyle='rgba(100,80,180,.8)';ctx.fill();}});}},
  // ── 甲飾り ──
  { label:'甲チェーン', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.55],[w*.75,h*.55]].forEach(([cx,cy])=>{for(let i=0;i<6;i++){const t=i/5,x1=cx-w*.08+t*w*.16,y1=cy-h*.15+t*h*.25;const x2=cx-w*.08+(i+1)/5*w*.16,y2=cy-h*.15+(i+1)/5*h*.25;ctx.beginPath();ctx.ellipse((x1+x2)/2,(y1+y2)/2,w*.018,h*.013,Math.atan2(y2-y1,x2-x1),0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=w*.014;ctx.stroke();}ctx.beginPath();ctx.arc(cx,cy+h*.1,w*.025,0,Math.PI*2);ctx.fillStyle='#c8a030';ctx.fill();});}},
  { label:'甲ビジュー', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.55],[w*.75,h*.55]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const t=i/4,x=cx-w*.06+t*w*.12,y=cy-h*.12+t*h*.22;ctx.beginPath();ctx.arc(x,y,w*.022,0,Math.PI*2);ctx.fillStyle=['#ff88cc','#cc88ff','#ffd700','#88ccff','#ff88cc'][i];ctx.fill();}});}},
  { label:'甲レース', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.55],[w*.75,h*.55]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.1,cy-h*.18);ctx.lineTo(cx+w*.1,cy-h*.18);ctx.lineTo(cx+w*.06,cy+h*.1);ctx.lineTo(cx-w*.06,cy+h*.1);ctx.closePath();ctx.fillStyle='rgba(240,220,240,.06)';ctx.fill();ctx.strokeStyle='rgba(220,190,220,.4)';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(cx-w*.08+i*w*.055,cy-h*.18);ctx.lineTo(cx-w*.06+i*w*.04,cy+h*.1);ctx.strokeStyle='rgba(220,190,220,.35)';ctx.lineWidth=.6;ctx.stroke();}});}},
  { label:'甲タトゥー', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.55],[w*.75,h*.55]].forEach(([fx,fy])=>{ctx.beginPath();ctx.moveTo(fx,fy-h*.18);for(let i=0;i<3;i++){const a=i*Math.PI*2/3-Math.PI/2;ctx.lineTo(fx+Math.cos(a)*w*.08,fy-h*.02+Math.sin(a)*h*.1);}ctx.closePath();ctx.strokeStyle='rgba(100,160,220,.8)';ctx.lineWidth=1.5;ctx.stroke();});}},
  { label:'甲スター', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.5],[w*.75,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI/5;ctx.lineTo(cx+Math.cos(a)*w*.1,cy+Math.sin(a)*h*.15);ctx.lineTo(cx+Math.cos(b)*w*.04,cy+Math.sin(b)*h*.06);}ctx.closePath();ctx.fillStyle='rgba(200,160,48,.3)';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'甲花飾り', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.5],[w*.75,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.07,cy+Math.sin(a)*h*.1,w*.05,h*.035,a,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.025,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'甲クリスタル', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.5],[w*.75,h*.5]].forEach(([cx,cy])=>{[[cx,cy-h*.15,h*.12],[cx-w*.06,cy,h*.08],[cx+w*.06,cy,h*.08]].forEach(([fx,fy,r])=>{ctx.beginPath();ctx.moveTo(fx,fy-r);ctx.lineTo(fx+r*.6,fy+r*.8);ctx.lineTo(cx,fy+r*.4);ctx.lineTo(fx-r*.6,fy+r*.8);ctx.closePath();ctx.fillStyle='rgba(140,210,255,.55)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=.8;ctx.stroke();});});}},
  { label:'甲ハート', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.5],[w*.75,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy+h*.12);ctx.bezierCurveTo(cx-w*.1,cy-h*.02,cx-w*.1,cy-h*.1,cx,cy-h*.04);ctx.bezierCurveTo(cx+w*.1,cy-h*.1,cx+w*.1,cy-h*.02,cx,cy+h*.12);ctx.fillStyle='rgba(220,60,100,.3)';ctx.fill();ctx.strokeStyle='#e03060';ctx.lineWidth=1.5;ctx.stroke();});}},
  { label:'甲リボン', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.5],[w*.75,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.12,cy-h*.08);ctx.lineTo(cx+w*.12,cy+h*.08);ctx.strokeStyle='#e04080';ctx.lineWidth=w*.02;ctx.stroke();[[cx-w*.05,cy-h*.04],[cx+w*.05,cy+h*.04]].forEach(([bx,by])=>{ctx.beginPath();ctx.ellipse(bx,by,w*.055,h*.04,0,0,Math.PI*2);ctx.fillStyle='rgba(220,60,120,.7)';ctx.fill();});ctx.beginPath();ctx.arc(cx,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#ff80c0';ctx.fill();});}},
  { label:'甲ベル', group:'甲飾り', draw(ctx,w,h){[[w*.25,h*.45],[w*.75,h*.45]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.07,h*.05,0,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<3;i++){const bx=cx+(i-1)*w*.05,by=cy+h*.05;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-w*.012,by+h*.06);ctx.lineTo(bx+w*.012,by+h*.06);ctx.closePath();ctx.fillStyle='#c8a030';ctx.fill();ctx.beginPath();ctx.arc(bx,by+h*.065,w*.01,0,Math.PI*2);ctx.fillStyle='#888';ctx.fill();}});}},
];

const FOOT_CW=240,FOOT_CH=200;
const footAccState={selIdx:-1};
const footTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const footMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawFootGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  // 左足
  ctx.moveTo(w*.04,h*.05);ctx.bezierCurveTo(w*.02,h*.3,w*.04,h*.6,w*.1,h*.88);
  ctx.bezierCurveTo(w*.18,h*.96,w*.36,h*.98,w*.42,h*.92);
  ctx.bezierCurveTo(w*.44,h*.8,w*.42,h*.6,w*.38,h*.05);
  ctx.moveTo(w*.04,h*.05);ctx.bezierCurveTo(w*.14,h*.02,w*.3,h*.02,w*.38,h*.05);
  // 右足
  ctx.moveTo(w*.62,h*.05);ctx.bezierCurveTo(w*.58,h*.3,w*.56,h*.6,w*.58,h*.88);
  ctx.bezierCurveTo(w*.64,h*.96,w*.82,h*.98,w*.9,h*.92);
  ctx.bezierCurveTo(w*.96,h*.8,w*.98,h*.6,w*.96,h*.05);
  ctx.moveTo(w*.62,h*.05);ctx.bezierCurveTo(w*.72,h*.02,w*.88,h*.02,w*.96,h*.05);
  // つま先横線
  for(let i=0;i<5;i++){const x=w*.08+i*w*.06;ctx.moveTo(x,h*.08);ctx.lineTo(x,h*.18);}
  for(let i=0;i<5;i++){const x=w*.65+i*w*.06;ctx.moveTo(x,h*.08);ctx.lineTo(x,h*.18);}
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildFootPanel(area){buildGenericBodyPanel(area,{tabKey:'foot',templates:FOOT_TEMPLATES,accState:footAccState,tattooState:footTattooState,moleState:footMoleState,cw:FOOT_CW,ch:FOOT_CH,drawGuide:drawFootGuide,clothesSlots:['clothes_socks','clothes_shoes'],paint3dBtns:[{label:'足・脚を3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで足・甲エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して足エリアを塗るのがおすすめ'});}



// ─── 腕パネル ───────────────────────────────────────────────
const ARM_TEMPLATES = [
  // ── アームバンド ──
  { label:'アームバンド', group:'アームバンド', draw(ctx,w,h){ctx.beginPath();ctx.rect(w*.12,h*.38,w*.32,h*.18);ctx.fillStyle='rgba(60,80,160,.25)';ctx.fill();ctx.strokeStyle='#6080e0';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.rect(w*.56,h*.38,w*.32,h*.18);ctx.fillStyle='rgba(60,80,160,.25)';ctx.fill();ctx.stroke();}},
  { label:'ゴールドバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.16,h*.09,0,0,Math.PI*2);ctx.fillStyle='rgba(200,160,48,.2)';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=2.5;ctx.stroke();});}},
  { label:'スパイクバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.16,cy-h*.07,w*.32,h*.14);ctx.fillStyle='rgba(40,40,40,.4)';ctx.fill();ctx.strokeStyle='#666';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<5;i++){const sx=cx-w*.12+i*w*.06;ctx.beginPath();ctx.moveTo(sx,cy-h*.07);ctx.lineTo(sx+w*.025,cy-h*.14);ctx.lineTo(sx+w*.05,cy-h*.07);ctx.fillStyle='#888';ctx.fill();}});}},
  { label:'フラワーバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.16,cy-h*.07,w*.32,h*.14);ctx.fillStyle='rgba(220,100,120,.2)';ctx.fill();ctx.strokeStyle='#e06080';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<3;i++){const fx=cx-w*.08+i*w*.08;for(let j=0;j<5;j++){const a=j*Math.PI*2/5;ctx.beginPath();ctx.ellipse(fx+Math.cos(a)*w*.03,cy+Math.sin(a)*h*.03,w*.02,h*.015,a,0,Math.PI*2);ctx.fillStyle='#ffaabb';ctx.fill();}}});}},
  { label:'メタルバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.44],[w*.72,h*.44]].forEach(([cx,cy])=>{for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cx,cy+i*h*.05,w*.16,h*.04,0,0,Math.PI*2);ctx.fillStyle='rgba(160,160,180,.2)';ctx.fill();ctx.strokeStyle='#a0a0c0';ctx.lineWidth=1.5;ctx.stroke();}});}},
  { label:'チェーンバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{for(let i=0;i<6;i++){const lx=cx-w*.13+i*w*.05;ctx.beginPath();ctx.ellipse(lx,cy,w*.025,h*.07,Math.PI/4,0,Math.PI*2);ctx.strokeStyle='#c0a040';ctx.lineWidth=1.5;ctx.stroke();}});}},
  { label:'パールバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{for(let i=0;i<8;i++){const a=i*Math.PI*2/8;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.14,cy+Math.sin(a)*h*.08,w*.025,0,Math.PI*2);ctx.fillStyle='#f0f0f8';ctx.fill();ctx.strokeStyle='#c8c8e0';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'クリスタルバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.16,cy-h*.07,w*.32,h*.14);ctx.fillStyle='rgba(100,180,255,.15)';ctx.fill();ctx.strokeStyle='#60c0ff';ctx.lineWidth=1.5;ctx.stroke();[[cx-w*.08,cy],[cx,cy-h*.04],[cx+w*.08,cy]].forEach(([fx,fy])=>{ctx.beginPath();ctx.moveTo(fx,fy-h*.07);ctx.lineTo(fx+w*.03,fy+h*.04);ctx.lineTo(fx-w*.03,fy+h*.04);ctx.closePath();ctx.fillStyle='rgba(120,200,255,.5)';ctx.fill();});});}},
  { label:'タトゥーバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{ctx.beginPath();ctx.setLineDash([3,2]);ctx.moveTo(cx-w*.16,cy);ctx.lineTo(cx+w*.16,cy);ctx.strokeStyle='rgba(80,40,160,.7)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);for(let i=0;i<4;i++){const fx=cx-w*.1+i*w*.07;ctx.beginPath();ctx.moveTo(fx,cy-h*.07);ctx.lineTo(fx+w*.03,cy);ctx.lineTo(fx,cy+h*.07);ctx.strokeStyle='rgba(80,40,160,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'シルクバンド', group:'アームバンド', draw(ctx,w,h){[[w*.28,h*.47],[w*.72,h*.47]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.16,cy,cx+w*.16,cy);g.addColorStop(0,'rgba(200,80,120,.6)');g.addColorStop(.5,'rgba(255,140,180,.8)');g.addColorStop(1,'rgba(200,80,120,.6)');ctx.beginPath();ctx.rect(cx-w*.16,cy-h*.06,w*.32,h*.12);ctx.fillStyle=g;ctx.fill();})}},
  // ── アームカバー ──
  { label:'レースカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.3],[w*.65,h*.3]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.09,cy+h*.5);ctx.lineTo(cx+w*.09,cy+h*.5);ctx.closePath();ctx.fillStyle='rgba(255,240,250,.25)';ctx.fill();ctx.strokeStyle='rgba(220,180,210,.7)';ctx.lineWidth=1;ctx.stroke();for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(cx-w*.09*i/5,cy+h*.1*i);ctx.lineTo(cx+w*.09*i/5,cy+h*.1*i);ctx.strokeStyle='rgba(220,180,210,.4)';ctx.lineWidth=.8;ctx.stroke();}});}},
  { label:'メッシュカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.strokeStyle='rgba(100,120,200,.6)';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<4;i++){for(let j=0;j<3;j++){ctx.beginPath();ctx.rect(cx-w*.08+j*w*.055,cy+h*.12+i*h*.1,w*.04,h*.07);ctx.strokeStyle='rgba(100,120,200,.3)';ctx.lineWidth=.5;ctx.stroke();}}});}},
  { label:'ビニールカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.1,cy,cx+w*.1,cy);g.addColorStop(0,'rgba(80,200,255,.3)');g.addColorStop(.5,'rgba(180,240,255,.5)');g.addColorStop(1,'rgba(80,200,255,.3)');ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(80,200,255,.6)';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'ストライプカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle='rgba(60,60,80,.3)';ctx.fill();ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(cx-w*.08+i*w*.04,cy+h*.05);ctx.lineTo(cx-w*.1+i*w*.04,cy+h*.55);ctx.strokeStyle='rgba(100,180,255,.5)';ctx.lineWidth=1.5;ctx.stroke();}});}},
  { label:'フリルカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.5);ctx.lineTo(cx+w*.1,cy+h*.5);ctx.closePath();ctx.fillStyle='rgba(255,200,220,.3)';ctx.fill();ctx.strokeStyle='#f080a0';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<6;i++){const fx=cx-w*.08+i*w*.033,fy=cy+h*.5;ctx.beginPath();ctx.arc(fx,fy,w*.02,Math.PI,0);ctx.strokeStyle='#f080a0';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'サテンカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.1,cy,cx+w*.1,cy);g.addColorStop(0,'rgba(120,60,180,.4)');g.addColorStop(.4,'rgba(200,140,255,.6)');g.addColorStop(1,'rgba(120,60,180,.4)');ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle=g;ctx.fill();});}},
  { label:'タトゥースリーブ', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle='rgba(20,10,40,.5)';ctx.fill();for(let i=0;i<6;i++){const fy=cy+h*.08+i*h*.08;ctx.beginPath();ctx.moveTo(cx-w*.07,fy);ctx.bezierCurveTo(cx-w*.04,fy-h*.04,cx+w*.04,fy-h*.04,cx+w*.07,fy);ctx.strokeStyle='rgba(140,80,200,.6)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'ジュエルカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle='rgba(60,160,220,.2)';ctx.fill();ctx.strokeStyle='#40a0e0';ctx.lineWidth=1;ctx.stroke();[[cx-w*.04,cy+h*.15],[cx+w*.03,cy+h*.27],[cx-w*.03,cy+h*.4]].forEach(([fx,fy])=>{ctx.beginPath();ctx.moveTo(fx,fy-h*.05);ctx.lineTo(fx+w*.035,fy);ctx.lineTo(fx,fy+h*.05);ctx.lineTo(fx-w*.035,fy);ctx.closePath();ctx.fillStyle='rgba(100,200,255,.5)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=.8;ctx.stroke();});});}},
  { label:'ブラックカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle='rgba(20,20,25,.6)';ctx.fill();ctx.strokeStyle='rgba(80,80,100,.8)';ctx.lineWidth=1.5;ctx.stroke();});}},
  { label:'ホワイトカバー', group:'アームカバー', draw(ctx,w,h){[[w*.21,h*.28],[w*.65,h*.28]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-w*.1,cy+h*.55);ctx.lineTo(cx+w*.1,cy+h*.55);ctx.closePath();ctx.fillStyle='rgba(240,240,255,.5)';ctx.fill();ctx.strokeStyle='rgba(200,200,240,.8)';ctx.lineWidth=1.5;ctx.stroke();});}},
  // ── リストバンド ──
  { label:'リストバンド', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.06,w*.18,h*.12);ctx.fillStyle='rgba(60,100,200,.3)';ctx.fill();ctx.strokeStyle='#4080e0';ctx.lineWidth=2;ctx.stroke();});}},
  { label:'リストルビー', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.05,w*.18,h*.1);ctx.fillStyle='rgba(40,40,40,.4)';ctx.fill();ctx.strokeStyle='#888';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,w*.04,0,Math.PI*2);ctx.fillStyle='rgba(200,40,60,.8)';ctx.fill();ctx.strokeStyle='#ff8080';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'チェーンリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const lx=cx-w*.08+i*w*.04;ctx.beginPath();ctx.ellipse(lx,cy,w*.02,h*.05,Math.PI/4,0,Math.PI*2);ctx.strokeStyle='#c0a040';ctx.lineWidth=1.5;ctx.stroke();}});}},
  { label:'パールリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.08,cy+Math.sin(a)*h*.05,w*.02,0,Math.PI*2);ctx.fillStyle='#f0f0f8';ctx.fill();ctx.strokeStyle='#c8c8e0';ctx.lineWidth=.8;ctx.stroke();}});}},
  { label:'ハートリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.05,w*.18,h*.1);ctx.fillStyle='rgba(220,60,100,.2)';ctx.fill();ctx.strokeStyle='#e03060';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy+h*.03);ctx.bezierCurveTo(cx-w*.05,cy-h*.01,cx-w*.05,cy-h*.05,cx,cy-h*.02);ctx.bezierCurveTo(cx+w*.05,cy-h*.05,cx+w*.05,cy-h*.01,cx,cy+h*.03);ctx.fillStyle='rgba(220,60,100,.7)';ctx.fill();});}},
  { label:'スポーツリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.1,cy-h*.07,w*.2,h*.14);ctx.fillStyle='rgba(255,80,40,.3)';ctx.fill();ctx.strokeStyle='#ff5020';ctx.lineWidth=2;ctx.stroke();for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(cx+i*w*.05,cy-h*.07);ctx.lineTo(cx+i*w*.05,cy+h*.07);ctx.strokeStyle='rgba(255,200,100,.5)';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'ゴールドリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.ellipse(cx,cy,w*.1,h*.06,0,0,Math.PI*2);ctx.fillStyle='rgba(200,160,48,.2)';ctx.fill();ctx.strokeStyle='#c8a030';ctx.lineWidth=2.5;ctx.stroke();});}},
  { label:'ダイヤリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.05,w*.18,h*.1);ctx.fillStyle='rgba(200,230,255,.2)';ctx.fill();ctx.strokeStyle='#90c8ff';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<3;i++){const fx=cx-w*.04+i*w*.04;ctx.beginPath();ctx.moveTo(fx,cy-h*.04);ctx.lineTo(fx+w*.025,cy);ctx.lineTo(fx,cy+h*.04);ctx.lineTo(fx-w*.025,cy);ctx.closePath();ctx.fillStyle='rgba(140,200,255,.5)';ctx.fill();}});}},
  { label:'タトゥーリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.05,w*.18,h*.1);ctx.fillStyle='rgba(20,10,40,.5)';ctx.fill();ctx.beginPath();ctx.moveTo(cx-w*.07,cy);ctx.bezierCurveTo(cx-w*.04,cy-h*.05,cx+w*.04,cy-h*.05,cx+w*.07,cy);ctx.bezierCurveTo(cx+w*.04,cy+h*.05,cx-w*.04,cy+h*.05,cx-w*.07,cy);ctx.strokeStyle='rgba(140,80,200,.7)';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'シルクリスト', group:'リストバンド', draw(ctx,w,h){[[w*.21,h*.77],[w*.65,h*.77]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.09,cy,cx+w*.09,cy);g.addColorStop(0,'rgba(200,80,120,.5)');g.addColorStop(.5,'rgba(255,140,180,.7)');g.addColorStop(1,'rgba(200,80,120,.5)');ctx.beginPath();ctx.rect(cx-w*.09,cy-h*.05,w*.18,h*.1);ctx.fillStyle=g;ctx.fill();})}},
];

const ARM_CW=240,ARM_CH=300;
const armAccState={selIdx:-1};
const armTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const armMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawArmGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  // 左腕
  ctx.moveTo(w*.04,h*.03);ctx.bezierCurveTo(w*.02,h*.2,w*.04,h*.55,w*.08,h*.85);
  ctx.bezierCurveTo(w*.1,h*.95,w*.24,h*.97,w*.3,h*.9);
  ctx.bezierCurveTo(w*.34,h*.75,w*.34,h*.45,w*.32,h*.03);
  ctx.moveTo(w*.04,h*.03);ctx.bezierCurveTo(w*.12,h*.01,w*.24,h*.01,w*.32,h*.03);
  // リスト横線（左）
  ctx.moveTo(w*.06,h*.8);ctx.lineTo(w*.3,h*.8);
  // 右腕
  ctx.moveTo(w*.56,h*.03);ctx.bezierCurveTo(w*.54,h*.2,w*.56,h*.55,w*.6,h*.85);
  ctx.bezierCurveTo(w*.62,h*.95,w*.76,h*.97,w*.82,h*.9);
  ctx.bezierCurveTo(w*.86,h*.75,w*.86,h*.45,w*.84,h*.03);
  ctx.moveTo(w*.56,h*.03);ctx.bezierCurveTo(w*.64,h*.01,w*.76,h*.01,w*.84,h*.03);
  // リスト横線（右）
  ctx.moveTo(w*.58,h*.8);ctx.lineTo(w*.82,h*.8);
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildArmPanel(area){buildGenericBodyPanel(area,{tabKey:'arm',templates:ARM_TEMPLATES,accState:armAccState,tattooState:armTattooState,moleState:armMoleState,cw:ARM_CW,ch:ARM_CH,drawGuide:drawArmGuide,clothesSlots:['clothes_top','clothes_sleeve'],paint3dBtns:[{label:'腕・袖を3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで腕エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して腕・手首エリアを塗るのがおすすめ'});}

// ─── 手パネル ───────────────────────────────────────────────
const HAND_TEMPLATES = [
  // ── 指輪 ──
  { label:'シルバーリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='#c0c0d0';ctx.lineWidth=3;ctx.stroke();});}},
  { label:'ゴールドリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-w*.07,w*.03,0,Math.PI*2);ctx.fillStyle='rgba(200,160,48,.6)';ctx.fill();});}},
  { label:'ルビーリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-w*.1);ctx.lineTo(cx+w*.04,cy-w*.07);ctx.lineTo(cx,cy-w*.04);ctx.lineTo(cx-w*.04,cy-w*.07);ctx.closePath();ctx.fillStyle='rgba(200,40,60,.8)';ctx.fill();});}},
  { label:'ダイヤリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='#e0e8ff';ctx.lineWidth=2;ctx.stroke();[[cx,cy-w*.09],[cx-w*.04,cy-w*.06],[cx+w*.04,cy-w*.06]].forEach(([fx,fy])=>{ctx.beginPath();ctx.moveTo(fx,fy-h*.04);ctx.lineTo(fx+w*.025,fy);ctx.lineTo(fx,fy+h*.04);ctx.lineTo(fx-w*.025,fy);ctx.closePath();ctx.fillStyle='rgba(180,220,255,.7)';ctx.fill();});});}},
  { label:'フラワーリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.065,0,Math.PI*2);ctx.strokeStyle='#c8a030';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.055,cy+Math.sin(a)*w*.055,w*.02,w*.015,a,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.015,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'スカルリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='#666';ctx.lineWidth=2.5;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy-w*.05,w*.04,0,Math.PI*2);ctx.fillStyle='rgba(220,220,220,.7)';ctx.fill();ctx.strokeStyle='#888';ctx.lineWidth=1;ctx.stroke();[[cx-w*.015,cy-w*.06],[cx+w*.015,cy-w*.06]].forEach(([ex,ey])=>{ctx.beginPath();ctx.arc(ex,ey,w*.008,0,Math.PI*2);ctx.fillStyle='#222';ctx.fill();});});}},
  { label:'バンドリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,cy,w*.07-i*w*.015,0,Math.PI*2);ctx.strokeStyle=i%2===0?'#c8a030':'#fff';ctx.lineWidth=2;ctx.stroke();}});}},
  { label:'タトゥーリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.strokeStyle='rgba(80,40,160,.7)';ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);});}},
  { label:'ハートリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.065,0,Math.PI*2);ctx.strokeStyle='#e03060';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-w*.1);ctx.bezierCurveTo(cx-w*.05,cy-w*.135,cx-w*.05,cy-w*.1,cx,cy-w*.09);ctx.bezierCurveTo(cx+w*.05,cy-w*.1,cx+w*.05,cy-w*.135,cx,cy-w*.1);ctx.fillStyle='rgba(220,60,100,.7)';ctx.fill();});}},
  { label:'クロスリング', group:'指輪', draw(ctx,w,h){[[w*.22,h*.5],[w*.67,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.065,0,Math.PI*2);ctx.strokeStyle='#c0c0d0';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-w*.1);ctx.lineTo(cx,cy-w*.04);ctx.moveTo(cx-w*.03,cy-w*.075);ctx.lineTo(cx+w*.03,cy-w*.075);ctx.strokeStyle='#c0c0d0';ctx.lineWidth=2;ctx.stroke();});}},
  // ── グローブ ──
  { label:'レースグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(255,240,250,.3)';ctx.fill();ctx.strokeStyle='rgba(220,180,210,.7)';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<4;i++){const fx=cx-w*.07+i*w*.05;ctx.beginPath();ctx.moveTo(fx,cy-h*.05);ctx.lineTo(fx,cy-h*.2);ctx.strokeStyle='rgba(220,180,210,.5)';ctx.lineWidth=w*.03;ctx.stroke();}});}},
  { label:'ビニールグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.15,cy,cx+w*.15,cy);g.addColorStop(0,'rgba(80,200,255,.4)');g.addColorStop(.5,'rgba(180,240,255,.6)');g.addColorStop(1,'rgba(80,200,255,.4)');ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='rgba(80,200,255,.7)';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'ブラックグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(20,20,25,.65)';ctx.fill();ctx.strokeStyle='rgba(80,80,100,.8)';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'ホワイトグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(240,240,255,.5)';ctx.fill();ctx.strokeStyle='rgba(200,200,240,.8)';ctx.lineWidth=1;ctx.stroke();});}},
  { label:'スポーツグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(255,80,40,.25)';ctx.fill();ctx.strokeStyle='#ff5020';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.rect(cx-w*.08,cy-h*.02,w*.16,h*.12);ctx.fillStyle='rgba(20,20,20,.4)';ctx.fill();});}},
  { label:'ネットグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.strokeStyle='rgba(100,100,200,.5)';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<3;i++){for(let j=0;j<4;j++){ctx.beginPath();ctx.rect(cx-w*.12+i*w*.08,cy-h*.04+j*h*.07,w*.06,h*.05);ctx.strokeStyle='rgba(100,100,200,.25)';ctx.lineWidth=.5;ctx.stroke();}}});}},
  { label:'フリルグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(255,200,220,.35)';ctx.fill();ctx.strokeStyle='#f080a0';ctx.lineWidth=1;ctx.stroke();for(let i=0;i<6;i++){const fx=cx-w*.12+i*w*.05,fy=cy+h*.25;ctx.beginPath();ctx.arc(fx,fy,w*.025,Math.PI,0);ctx.strokeStyle='#f080a0';ctx.lineWidth=1;ctx.stroke();}});}},
  { label:'メタルグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle='rgba(140,140,160,.4)';ctx.fill();ctx.strokeStyle='#a0a0c0';ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(cx-w*.14,cy+h*.05+i*h*.06);ctx.bezierCurveTo(cx-w*.08,cy+h*.04+i*h*.06,cx+w*.08,cy+h*.04+i*h*.06,cx+w*.14,cy+h*.05+i*h*.06);ctx.strokeStyle='rgba(200,200,220,.4)';ctx.lineWidth=.8;ctx.stroke();}});}},
  { label:'絹グローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{const g=ctx.createLinearGradient(cx-w*.15,cy,cx+w*.15,cy);g.addColorStop(0,'rgba(120,60,180,.4)');g.addColorStop(.4,'rgba(200,140,255,.55)');g.addColorStop(1,'rgba(120,60,180,.4)');ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.25);ctx.bezierCurveTo(cx-w*.16,cy-h*.05,cx+w*.16,cy-h*.05,cx+w*.15,cy+h*.25);ctx.fillStyle=g;ctx.fill();});}},
  { label:'ショートグローブ', group:'グローブ', draw(ctx,w,h){[[w*.18,h*.6],[w*.62,h*.6]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx-w*.15,cy+h*.15);ctx.bezierCurveTo(cx-w*.16,cy-h*.02,cx+w*.16,cy-h*.02,cx+w*.15,cy+h*.15);ctx.fillStyle='rgba(80,60,140,.3)';ctx.fill();ctx.strokeStyle='#6040a0';ctx.lineWidth=1.5;ctx.stroke();});}},
  // ── 手飾り ──
  { label:'ネイルアート', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.3],[w*.62,h*.3]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const fx=cx-w*.1+i*w*.05;ctx.beginPath();ctx.moveTo(fx-w*.015,cy);ctx.bezierCurveTo(fx-w*.015,cy-h*.07,fx+w*.015,cy-h*.07,fx+w*.015,cy);ctx.fillStyle=`hsl(${i*40+300},80%,65%)`;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=.5;ctx.stroke();}});}},
  { label:'ハンドチェーン', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<6;i++){const lx=cx-w*.1+i*w*.04;ctx.beginPath();ctx.ellipse(lx,cy,w*.018,h*.04,Math.PI/4,0,Math.PI*2);ctx.strokeStyle='#c0a040';ctx.lineWidth=1.2;ctx.stroke();}ctx.beginPath();ctx.arc(cx+w*.02,cy-h*.1,w*.04,0,Math.PI*2);ctx.strokeStyle='#c0a040';ctx.lineWidth=1.5;ctx.stroke();});}},
  { label:'指タトゥー', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.45],[w*.62,h*.45]].forEach(([cx,cy])=>{for(let i=0;i<4;i++){const fx=cx-w*.07+i*w*.05;ctx.beginPath();ctx.moveTo(fx,cy);ctx.bezierCurveTo(fx-w*.02,cy-h*.06,fx+w*.02,cy-h*.06,fx,cy);ctx.strokeStyle='rgba(80,40,160,.5)';ctx.lineWidth=1.2;ctx.setLineDash([2,2]);ctx.stroke();ctx.setLineDash([]);}});}},
  { label:'ハンドスタンプ', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx,cy,w*.07,0,Math.PI*2);ctx.fillStyle='rgba(200,80,120,.15)';ctx.fill();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.05,cy+Math.sin(a)*h*.05,w*.015,w*.01,a,0,Math.PI*2);ctx.fillStyle='#e05080';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.015,0,Math.PI*2);ctx.fillStyle='#e05080';ctx.fill();});}},
  { label:'ブレスレット', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.72],[w*.62,h*.72]].forEach(([cx,cy])=>{for(let i=0;i<8;i++){const a=i*Math.PI*2/8;ctx.beginPath();ctx.arc(cx+Math.cos(a)*w*.09,cy+Math.sin(a)*h*.06,w*.02,0,Math.PI*2);const cols=['#c8a030','#e03060','#4080ff','#80e040','#ff8020','#c040c0','#40c0c0','#f0f0f0'];ctx.fillStyle=cols[i];ctx.fill();}});}},
  { label:'ハンドタトゥー', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy-h*.15);ctx.bezierCurveTo(cx-w*.1,cy-h*.05,cx-w*.12,cy+h*.1,cx-w*.04,cy+h*.18);ctx.bezierCurveTo(cx+w*.04,cy+h*.22,cx+w*.1,cy+h*.1,cx+w*.06,cy-h*.05);ctx.bezierCurveTo(cx+w*.12,cy-h*.12,cx+w*.04,cy-h*.18,cx,cy-h*.15);ctx.strokeStyle='rgba(80,40,160,.6)';ctx.lineWidth=1.2;ctx.stroke();});}},
  { label:'クリスタルネイル', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.3],[w*.62,h*.3]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const fx=cx-w*.1+i*w*.05;ctx.beginPath();ctx.moveTo(fx,cy);ctx.lineTo(fx-w*.012,cy-h*.07);ctx.lineTo(fx,cy-h*.1);ctx.lineTo(fx+w*.012,cy-h*.07);ctx.closePath();ctx.fillStyle='rgba(140,210,255,.55)';ctx.fill();ctx.strokeStyle='#80d8ff';ctx.lineWidth=.8;ctx.stroke();}});}},
  { label:'花飾り', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.5],[w*.62,h*.5]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.ellipse(cx+Math.cos(a)*w*.06,cy+Math.sin(a)*h*.06,w*.04,h*.03,a,0,Math.PI*2);ctx.fillStyle='#ffb0c0';ctx.fill();}ctx.beginPath();ctx.arc(cx,cy,w*.02,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();});}},
  { label:'パールネイル', group:'手飾り', draw(ctx,w,h){[[w*.18,h*.3],[w*.62,h*.3]].forEach(([cx,cy])=>{for(let i=0;i<5;i++){const fx=cx-w*.1+i*w*.05;ctx.beginPath();ctx.moveTo(fx-w*.015,cy);ctx.bezierCurveTo(fx-w*.015,cy-h*.07,fx+w*.015,cy-h*.07,fx+w*.015,cy);ctx.fillStyle='rgba(240,230,255,.7)';ctx.fill();ctx.beginPath();ctx.arc(fx,cy-h*.05,w*.01,0,Math.PI*2);ctx.fillStyle='#f0f0f8';ctx.fill();}});}},
];

const HAND_CW=240,HAND_CH=260;
const handAccState={selIdx:-1};
const handTattooState={list:[],selIdx:-1,presetSel:-1,newSize:55,newRot:0,activeUrl:null};
const handMoleState={list:[],selIdx:-1,newShape:0,newSize:7,newColor:'#1a0a00'};
function drawHandGuide(ctx,w,h){
  ctx.save();ctx.strokeStyle='#2a3050';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();
  // 左手 手のひら
  ctx.moveTo(w*.04,h*.55);ctx.bezierCurveTo(w*.03,h*.35,w*.05,h*.3,w*.12,h*.28);
  ctx.bezierCurveTo(w*.18,h*.26,w*.28,h*.28,w*.34,h*.32);
  ctx.bezierCurveTo(w*.38,h*.38,w*.38,h*.55,w*.36,h*.72);
  ctx.bezierCurveTo(w*.3,h*.82,w*.12,h*.84,w*.06,h*.76);
  ctx.bezierCurveTo(w*.03,h*.68,w*.04,h*.6,w*.04,h*.55);
  // 左手 指
  for(let i=0;i<4;i++){const fx=w*.1+i*w*.06;ctx.moveTo(fx,h*.28);ctx.lineTo(fx,h*.06+i%2*h*.04);}
  ctx.moveTo(w*.04,h*.52);ctx.lineTo(w*.0,h*.38);// 親指
  // 右手 手のひら
  ctx.moveTo(w*.54,h*.55);ctx.bezierCurveTo(w*.53,h*.35,w*.55,h*.3,w*.62,h*.28);
  ctx.bezierCurveTo(w*.68,h*.26,w*.78,h*.28,w*.84,h*.32);
  ctx.bezierCurveTo(w*.88,h*.38,w*.88,h*.55,w*.86,h*.72);
  ctx.bezierCurveTo(w*.8,h*.82,w*.62,h*.84,w*.56,h*.76);
  ctx.bezierCurveTo(w*.53,h*.68,w*.54,h*.6,w*.54,h*.55);
  // 右手 指
  for(let i=0;i<4;i++){const fx=w*.6+i*w*.06;ctx.moveTo(fx,h*.28);ctx.lineTo(fx,h*.06+i%2*h*.04);}
  ctx.moveTo(w*.54,h*.52);ctx.lineTo(w*.5,h*.38);// 親指
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function buildHandPanel(area){buildGenericBodyPanel(area,{tabKey:'hand',templates:HAND_TEMPLATES,accState:handAccState,tattooState:handTattooState,moleState:handMoleState,cw:HAND_CW,ch:HAND_CH,drawGuide:drawHandGuide,clothesSlots:['clothes_glove','clothes_sleeve'],paint3dBtns:[{label:'手・指を3Dペイント',part:'body'},{label:'全パーツを3Dペイント',part:'all'}],paint3dDesc:'3Dペイントで手・指エリアを直接塗ることができます。',paint3dNote:'💡 ボディを選択して手・指エリアを塗るのがおすすめ'});}



// ═══════════════════════════════════════════════════════════════
//  ベジェ眉エディタ
// ═══════════════════════════════════════════════════════════════
const BEZ_W = 320, BEZ_H = 160;
const BEZ_PT_R = 7, BEZ_CP_R = 5;

const bezState = {
  pts: null,
  thickness: 5,
  color: '#2a1a0a',
  blur: 1.5,
  selIdx: -1,
  customList: [],
};

function bezDefaultPts() {
  return [
    { x: 48,  y: 100, cx1: 48,  cy1: 72,  cx2: 88,  cy2: 55 },
    { x: 128, y: 52,  cx1: 105, cy1: 52,  cx2: 152, cy2: 50 },
    { x: 208, y: 60,  cx1: 178, cy1: 50,  cx2: 232, cy2: 60 },
    { x: 272, y: 92,  cx1: 248, cy1: 72,  cx2: 282, cy2: 98 },
  ];
}

function bezDraw(cvs) {
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, BEZ_W, BEZ_H);

  // 顔ガイド楕円
  ctx.beginPath();
  ctx.ellipse(BEZ_W / 2, BEZ_H * 1.05, BEZ_W * 0.36, BEZ_H * 0.88, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#242840';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 目の位置ガイド線
  ctx.beginPath();
  ctx.moveTo(30, BEZ_H * 0.68);
  ctx.lineTo(BEZ_W - 30, BEZ_H * 0.68);
  ctx.strokeStyle = '#1e2438';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const pts = bezState.pts;
  if (!pts || pts.length < 2) {
    if (pts) pts.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, BEZ_PT_R, 0, Math.PI * 2);
      ctx.fillStyle = i === bezState.selIdx ? '#4a9eff' : '#ff6b9d';
      ctx.fill();
    });
    return;
  }

  // 眉カーブ描画
  ctx.save();
  if (bezState.blur > 0) ctx.filter = `blur(${bezState.blur}px)`;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.bezierCurveTo(
      pts[i].cx2, pts[i].cy2,
      pts[i + 1].cx1, pts[i + 1].cy1,
      pts[i + 1].x, pts[i + 1].y
    );
  }
  ctx.strokeStyle = bezState.color;
  ctx.lineWidth = bezState.thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  // コントロールハンドル（選択中のみ）
  const sel = bezState.selIdx;
  if (sel >= 0 && sel < pts.length) {
    const pt = pts[sel];
    const drawHandle = (hx, hy) => {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = '#3a5080';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, BEZ_CP_R, 0, Math.PI * 2);
      ctx.fillStyle = '#3a8fff';
      ctx.strokeStyle = '#8abfff';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    };
    if (sel > 0) drawHandle(pt.cx1, pt.cy1);
    if (sel < pts.length - 1) drawHandle(pt.cx2, pt.cy2);
  }

  // アンカーポイント
  pts.forEach((pt, i) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, BEZ_PT_R, 0, Math.PI * 2);
    ctx.fillStyle = i === sel ? '#4a9eff' : '#ff6b9d';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  });
}

function bezHitTest(mx, my) {
  const pts = bezState.pts;
  const sel = bezState.selIdx;
  if (sel >= 0 && sel < pts.length) {
    const pt = pts[sel];
    if (sel > 0 && Math.hypot(mx - pt.cx1, my - pt.cy1) <= BEZ_CP_R + 4)
      return { idx: sel, part: 'cp1' };
    if (sel < pts.length - 1 && Math.hypot(mx - pt.cx2, my - pt.cy2) <= BEZ_CP_R + 4)
      return { idx: sel, part: 'cp2' };
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    if (Math.hypot(mx - pts[i].x, my - pts[i].y) <= BEZ_PT_R + 4)
      return { idx: i, part: 'anchor' };
  }
  return null;
}

function bezRenderThumb(pts, thickness, color, blur) {
  const thumb = document.createElement('canvas');
  thumb.width = 72; thumb.height = 72;
  const tc = thumb.getContext('2d');
  const sx = 72 / BEZ_W * 0.88, sy = 72 / BEZ_H * 0.88;
  tc.translate(72 * 0.06, 72 * 0.06);
  tc.scale(sx, sy);
  if (blur > 0) tc.filter = `blur(${blur * sx}px)`;
  tc.beginPath();
  tc.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    tc.bezierCurveTo(
      pts[i].cx2, pts[i].cy2,
      pts[i + 1].cx1, pts[i + 1].cy1,
      pts[i + 1].x, pts[i + 1].y
    );
  }
  tc.strokeStyle = color;
  tc.lineWidth = thickness;
  tc.lineCap = 'round';
  tc.lineJoin = 'round';
  tc.stroke();
  return thumb.toDataURL('image/png');
}

function buildBezierEditor(area) {
  if (!bezState.pts) bezState.pts = bezDefaultPts();

  area.innerHTML = '';

  // キャンバス
  const cvs = document.createElement('canvas');
  cvs.width = BEZ_W;
  cvs.height = BEZ_H;
  cvs.className = 'bez-canvas';
  area.appendChild(cvs);
  bezDraw(cvs);

  // 操作ヒント
  const hint = document.createElement('div');
  hint.className = 'bez-hint';
  hint.textContent = '空き→点追加  ドラッグ→移動  ハンドル→曲線調整';
  area.appendChild(hint);

  // ツールバー
  const toolbar = document.createElement('div');
  toolbar.className = 'bez-toolbar';

  const delBtn = document.createElement('button');
  delBtn.className = 'hbtn';
  delBtn.textContent = '選択点を削除';
  delBtn.addEventListener('click', () => {
    const { pts, selIdx } = bezState;
    if (selIdx >= 0 && pts.length > 2) {
      pts.splice(selIdx, 1);
      bezState.selIdx = Math.max(0, selIdx - 1);
      bezDraw(cvs);
    }
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'hbtn';
  resetBtn.textContent = 'リセット';
  resetBtn.addEventListener('click', () => {
    bezState.pts = bezDefaultPts();
    bezState.selIdx = -1;
    bezDraw(cvs);
  });

  toolbar.appendChild(delBtn);
  toolbar.appendChild(resetBtn);
  area.appendChild(toolbar);

  // スライダー群
  [
    { label: '太さ', key: 'thickness', min: 1, max: 20, step: 0.5 },
    { label: 'ぼかし', key: 'blur',      min: 0, max: 6,  step: 0.5 },
  ].forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';
    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = bezState[sl.key];
    inp.style.flex = '1';
    inp.style.accentColor = 'var(--accent)';
    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = bezState[sl.key];
    inp.addEventListener('input', () => {
      bezState[sl.key] = parseFloat(inp.value);
      vl.textContent = inp.value;
      bezDraw(cvs);
    });
    row.appendChild(nm);
    row.appendChild(inp);
    row.appendChild(vl);
    area.appendChild(row);
  });

  // 色
  const colorRow = document.createElement('div');
  colorRow.className = 'sl-row';
  const colorLbl = document.createElement('span');
  colorLbl.className = 'sl-name';
  colorLbl.textContent = '色';
  const colorInp = document.createElement('input');
  colorInp.type = 'color';
  colorInp.value = bezState.color;
  colorInp.className = 'bez-color-picker';
  colorInp.addEventListener('input', () => { bezState.color = colorInp.value; bezDraw(cvs); });
  colorRow.appendChild(colorLbl);
  colorRow.appendChild(colorInp);
  area.appendChild(colorRow);

  // グリッドへ追加ボタン
  const applyBtn = document.createElement('button');
  applyBtn.className = 'hbtn bez-apply-btn';
  applyBtn.textContent = 'グリッドへ追加 ＋';
  area.appendChild(applyBtn);

  // カスタム眉グリッド
  const sep = document.createElement('div');
  sep.className = 'bez-sep';
  sep.textContent = 'カスタム眉';
  area.appendChild(sep);

  const customGrid = document.createElement('div');
  customGrid.className = 'thumb-grid';
  renderCustomGrid(customGrid);
  area.appendChild(customGrid);

  applyBtn.addEventListener('click', () => {
    const { pts, thickness, color, blur } = bezState;
    if (pts.length < 2) return;
    const dataUrl = bezRenderThumb([...pts.map(p => ({ ...p }))], thickness, color, blur);
    const label = `カスタム${bezState.customList.length + 1}`;
    bezState.customList.push({ dataUrl, label });
    renderCustomGrid(customGrid);
  });

  // マウス操作
  let dragging = false;
  let dragInfo = null;

  cvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const sx = BEZ_W / rect.width, sy = BEZ_H / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;

    const hit = bezHitTest(mx, my);
    if (hit) {
      bezState.selIdx = hit.idx;
      dragging = true;
      dragInfo = hit;
      cvs.setPointerCapture(e.pointerId);
    } else {
      const newPt = {
        x: mx, y: my,
        cx1: mx - 22, cy1: my - 12,
        cx2: mx + 22, cy2: my - 12,
      };
      const insIdx = bezState.pts.findIndex(p => p.x > mx);
      if (insIdx === -1) { bezState.pts.push(newPt); bezState.selIdx = bezState.pts.length - 1; }
      else { bezState.pts.splice(insIdx, 0, newPt); bezState.selIdx = insIdx; }
    }
    bezDraw(cvs);
  });

  cvs.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = cvs.getBoundingClientRect();
    const sx = BEZ_W / rect.width, sy = BEZ_H / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;
    const pt = bezState.pts[dragInfo.idx];
    if (dragInfo.part === 'anchor') {
      const dx = mx - pt.x, dy = my - pt.y;
      pt.x = mx; pt.y = my;
      pt.cx1 += dx; pt.cy1 += dy;
      pt.cx2 += dx; pt.cy2 += dy;
    } else if (dragInfo.part === 'cp1') {
      pt.cx1 = mx; pt.cy1 = my;
    } else {
      pt.cx2 = mx; pt.cy2 = my;
    }
    bezDraw(cvs);
  });

  cvs.addEventListener('pointerup', () => { dragging = false; dragInfo = null; });
}

function renderCustomGrid(grid) {
  grid.innerHTML = '';
  if (bezState.customList.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;color:var(--text-lo);font-size:11px;padding:8px;text-align:center;';
    empty.textContent = 'まだカスタム眉がありません';
    grid.appendChild(empty);
    return;
  }
  bezState.customList.forEach((item, i) => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item';
    cell.style.background = '#0d0f18';
    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;padding:2px;';
    const lbl = document.createElement('div');
    lbl.className = 'thumb-label';
    lbl.textContent = item.label;
    cell.appendChild(img);
    cell.appendChild(lbl);
    const delX = document.createElement('div');
    delX.className = 'bez-cell-del';
    delX.textContent = '×';
    delX.addEventListener('click', e => {
      e.stopPropagation();
      bezState.customList.splice(i, 1);
      renderCustomGrid(grid);
    });
    cell.appendChild(delX);
    grid.appendChild(cell);
  });
}

// ═══════════════════════════════════════════════════════════════
//  髪アクセサリー・ツヤ パネル
// ═══════════════════════════════════════════════════════════════

const HAIR_SLOTS_SHINE = ['hair_front', 'hair_back', 'hair_ahoge', 'hair_side'];

function _applyAccessory() {
  if (!character) return;
  character.detachAccessory('main');
  if (!hairAccState.presetId) return;
  const all = [...HAIR_ACCESSORY_PRESETS, ...userAccessories];
  const preset = all.find(p => p.id === hairAccState.presetId);
  if (!preset) return;
  const mesh = preset.create(hairAccState.color);
  character.attachAccessory('main', mesh, {
    pos:   [...hairAccState.pos],
    rot:   [...hairAccState.rot],
    scale: hairAccState.scale,
  });
}

function _updateAccessoryTransform() {
  if (!character || !character.accessories.main) return;
  const acc = character.accessories.main.group;
  acc.position.set(...hairAccState.pos);
  acc.rotation.set(...hairAccState.rot);
  acc.scale.setScalar(hairAccState.scale);
}

function _applyHairShine() {
  if (!character) return;
  HAIR_SLOTS_SHINE.forEach(slot => character.setHairShine(slot, hairShineState));
}

function _buildTransformControls(area) {
  area.innerHTML = '';
  if (!hairAccState.presetId) return;

  const sep = document.createElement('div');
  sep.className = 'nose-sep'; sep.textContent = '位置・回転・スケール';
  area.appendChild(sep);

  const sliderDefs = [
    { label: 'X 位置',  get: () => hairAccState.pos[0],      set: v => { hairAccState.pos[0] = v; _updateAccessoryTransform(); }, min: -0.20, max: 0.20, step: 0.002 },
    { label: 'Y 位置',  get: () => hairAccState.pos[1],      set: v => { hairAccState.pos[1] = v; _updateAccessoryTransform(); }, min:  0.80, max: 1.80, step: 0.002 },
    { label: 'Z 位置',  get: () => hairAccState.pos[2],      set: v => { hairAccState.pos[2] = v; _updateAccessoryTransform(); }, min: -0.20, max: 0.20, step: 0.002 },
    { label: '回転 X',  get: () => Math.round(hairAccState.rot[0] * 180 / Math.PI), set: v => { hairAccState.rot[0] = v * Math.PI / 180; _updateAccessoryTransform(); }, min: -180, max: 180, step: 1 },
    { label: '回転 Y',  get: () => Math.round(hairAccState.rot[1] * 180 / Math.PI), set: v => { hairAccState.rot[1] = v * Math.PI / 180; _updateAccessoryTransform(); }, min: -180, max: 180, step: 1 },
    { label: '回転 Z',  get: () => Math.round(hairAccState.rot[2] * 180 / Math.PI), set: v => { hairAccState.rot[2] = v * Math.PI / 180; _updateAccessoryTransform(); }, min: -180, max: 180, step: 1 },
    { label: 'サイズ',  get: () => hairAccState.scale,        set: v => { hairAccState.scale = v; _updateAccessoryTransform(); }, min: 0.10, max: 5.00, step: 0.05 },
  ];

  sliderDefs.forEach(sl => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10px;color:var(--text-lo);width:52px;flex-shrink:0;';
    lbl.textContent = sl.label;
    const input = document.createElement('input');
    input.type = 'range'; input.min = sl.min; input.max = sl.max; input.step = sl.step;
    input.value = sl.get();
    input.style.flex = '1';
    const valSpan = document.createElement('span');
    valSpan.style.cssText = 'font-size:10px;color:var(--text);width:40px;text-align:right;flex-shrink:0;';
    valSpan.textContent = typeof sl.get() === 'number' && sl.step < 1 ? sl.get().toFixed(3) : sl.get();
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valSpan.textContent = sl.step < 1 ? v.toFixed(3) : v;
      sl.set(v);
    });
    row.appendChild(lbl); row.appendChild(input); row.appendChild(valSpan);
    area.appendChild(row);
  });
}

function _buildAccTab(area, refreshPanel) {
  // 装着先セレクト
  const tgtRow = document.createElement('div');
  tgtRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';
  const tgtLbl = document.createElement('span');
  tgtLbl.style.cssText = 'font-size:11px;color:var(--text-lo);';
  tgtLbl.textContent = '装着先：';
  const tgtSel = document.createElement('select');
  tgtSel.style.cssText = 'background:#12141e;color:var(--text);border:1px solid #252840;border-radius:4px;padding:2px 6px;font-size:11px;';
  [{ value: 'hair_front', label: '前髪' }, { value: 'hair_back', label: '後ろ髪' },
   { value: 'hair_side',  label: '横髪' }, { value: 'hair_ahoge', label: 'アホ毛' }]
    .forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      if (o.value === hairAccState.target) opt.selected = true;
      tgtSel.appendChild(opt);
    });
  tgtSel.addEventListener('change', () => { hairAccState.target = tgtSel.value; });
  tgtRow.appendChild(tgtLbl); tgtRow.appendChild(tgtSel);
  area.appendChild(tgtRow);

  // カラーピッカー
  const colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';
  const colorLbl = document.createElement('span');
  colorLbl.style.cssText = 'font-size:11px;color:var(--text-lo);';
  colorLbl.textContent = '色：';
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color'; colorPicker.value = hairAccState.color;
  colorPicker.style.cssText = 'width:36px;height:22px;border:none;background:none;cursor:pointer;';
  colorPicker.addEventListener('input', () => {
    hairAccState.color = colorPicker.value;
    if (hairAccState.presetId) _applyAccessory();
  });
  colorRow.appendChild(colorLbl); colorRow.appendChild(colorPicker);
  area.appendChild(colorRow);

  // プリセットグリッド
  const gridSep = document.createElement('div');
  gridSep.className = 'nose-sep'; gridSep.textContent = 'プリセット';
  area.appendChild(gridSep);

  const grid = document.createElement('div');
  grid.className = 'thumb-grid';

  const transformArea = document.createElement('div');

  const noneCell = document.createElement('div');
  noneCell.className = 'thumb-item thumb-none' + (!hairAccState.presetId ? ' selected' : '');
  noneCell.textContent = '×';
  noneCell.addEventListener('click', () => {
    hairAccState.presetId = null;
    grid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
    noneCell.classList.add('selected');
    character?.detachAccessory('main');
    _buildTransformControls(transformArea);
  });
  grid.appendChild(noneCell);

  [...HAIR_ACCESSORY_PRESETS, ...userAccessories].forEach(p => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item' + (p.id === hairAccState.presetId ? ' selected' : '');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;';
    const dot = document.createElement('div');
    dot.style.cssText = `width:26px;height:26px;border-radius:50%;background:${p.defaultColor ?? '#aaaaaa'};border:1px solid #333;margin-bottom:2px;`;
    const lbl = document.createElement('div');
    lbl.className = 'thumb-label'; lbl.textContent = p.label;
    cell.appendChild(dot); cell.appendChild(lbl);
    cell.addEventListener('click', () => {
      hairAccState.presetId = p.id;
      hairAccState.color = p.defaultColor ?? hairAccState.color;
      colorPicker.value = hairAccState.color;
      grid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      _applyAccessory();
      _buildTransformControls(transformArea);
    });
    grid.appendChild(cell);
  });
  area.appendChild(grid);
  area.appendChild(transformArea);
  _buildTransformControls(transformArea);

  // ユーザー作成
  if (userAccessories.length > 0) {
    const uSep = document.createElement('div');
    uSep.className = 'nose-sep'; uSep.textContent = 'カスタム';
    area.appendChild(uSep);
  }
}

function _buildShineTab(area) {
  // プリセットボタン
  const pSep = document.createElement('div');
  pSep.className = 'nose-sep'; pSep.textContent = 'プリセット';
  area.appendChild(pSep);

  const presetRow = document.createElement('div');
  presetRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;';

  function markPresetBtn(activeKey) {
    presetRow.querySelectorAll('button').forEach(b => {
      const isActive = b.dataset.presetKey === activeKey;
      b.style.background = isActive ? '#2a3050' : '';
      b.style.borderColor = isActive ? 'var(--accent)' : '';
      b.style.color = isActive ? 'var(--accent)' : '';
    });
  }

  Object.entries(HAIR_SHINE_PRESETS).forEach(([key, preset]) => {
    const btn = document.createElement('button');
    btn.className = 'hbtn'; btn.dataset.presetKey = key;
    btn.style.cssText = 'font-size:10px;padding:3px 9px;';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      Object.assign(hairShineState, { preset: key, ...preset });
      markPresetBtn(key);
      syncSliders();
      _applyHairShine();
    });
    presetRow.appendChild(btn);
  });
  // カスタムボタン
  const customBtn = document.createElement('button');
  customBtn.className = 'hbtn'; customBtn.dataset.presetKey = 'custom';
  customBtn.style.cssText = 'font-size:10px;padding:3px 9px;';
  customBtn.textContent = 'カスタム';
  presetRow.appendChild(customBtn);
  area.appendChild(presetRow);
  markPresetBtn(hairShineState.preset);

  // スライダー
  const cSep = document.createElement('div');
  cSep.className = 'nose-sep'; cSep.textContent = '詳細設定';
  area.appendChild(cSep);

  const slideDefs = [
    { key: 'roughness',       label: '粗さ',    min: 0, max: 1, step: 0.01 },
    { key: 'metalness',       label: '金属感',   min: 0, max: 1, step: 0.01 },
    { key: 'envMapIntensity', label: '反射率',   min: 0, max: 2, step: 0.05 },
  ];

  const sliderInputs = {};

  function syncSliders() {
    slideDefs.forEach(sd => {
      const inp = sliderInputs[sd.key];
      if (!inp) return;
      inp.value = hairShineState[sd.key] ?? 0;
      inp.nextElementSibling.textContent = (hairShineState[sd.key] ?? 0).toFixed(2);
    });
  }

  slideDefs.forEach(sd => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:10px;color:var(--text-lo);width:56px;flex-shrink:0;';
    lbl.textContent = sd.label;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = sd.min; inp.max = sd.max; inp.step = sd.step;
    inp.value = hairShineState[sd.key] ?? 0;
    inp.style.flex = '1';
    const valSpan = document.createElement('span');
    valSpan.style.cssText = 'font-size:10px;color:var(--text);width:34px;text-align:right;flex-shrink:0;';
    valSpan.textContent = (hairShineState[sd.key] ?? 0).toFixed(2);
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      hairShineState[sd.key] = v;
      hairShineState.preset = 'custom';
      valSpan.textContent = v.toFixed(2);
      markPresetBtn('custom');
      _applyHairShine();
    });
    sliderInputs[sd.key] = inp;
    row.appendChild(lbl); row.appendChild(inp); row.appendChild(valSpan);
    area.appendChild(row);
  });
}

function _buildCreateTab(area) {
  const sep = document.createElement('div');
  sep.className = 'nose-sep'; sep.textContent = 'ベース形状を選択';
  area.appendChild(sep);

  let selShapeId = BASE_SHAPES[0].id;
  let createColor = '#ff88bb';

  const shapeGrid = document.createElement('div');
  shapeGrid.className = 'thumb-grid';
  BASE_SHAPES.forEach(shape => {
    const cell = document.createElement('div');
    cell.className = 'thumb-item' + (shape.id === selShapeId ? ' selected' : '');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;';
    const lbl = document.createElement('div');
    lbl.className = 'thumb-label'; lbl.textContent = shape.label;
    cell.appendChild(lbl);
    cell.addEventListener('click', () => {
      selShapeId = shape.id;
      shapeGrid.querySelectorAll('.thumb-item').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
    });
    shapeGrid.appendChild(cell);
  });
  area.appendChild(shapeGrid);

  // オプション行
  const optRow = document.createElement('div');
  optRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;';
  const cLbl = document.createElement('span');
  cLbl.style.cssText = 'font-size:11px;color:var(--text-lo);';
  cLbl.textContent = '色：';
  const cPicker = document.createElement('input');
  cPicker.type = 'color'; cPicker.value = createColor;
  cPicker.style.cssText = 'width:36px;height:22px;border:none;background:none;cursor:pointer;';
  cPicker.addEventListener('input', () => { createColor = cPicker.value; });
  optRow.appendChild(cLbl); optRow.appendChild(cPicker);
  area.appendChild(optRow);

  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:10px;';
  const nLbl = document.createElement('span');
  nLbl.style.cssText = 'font-size:11px;color:var(--text-lo);';
  nLbl.textContent = '名前：';
  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.value = 'カスタム';
  nameInp.style.cssText = 'flex:1;background:#12141e;color:var(--text);border:1px solid #252840;border-radius:4px;padding:3px 6px;font-size:11px;';
  nameRow.appendChild(nLbl); nameRow.appendChild(nameInp);
  area.appendChild(nameRow);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;';

  const previewBtn = document.createElement('button');
  previewBtn.className = 'hbtn'; previewBtn.style.cssText = 'flex:1;font-size:11px;';
  previewBtn.textContent = 'プレビュー';
  previewBtn.addEventListener('click', () => {
    if (!character) return;
    const shape = BASE_SHAPES.find(s => s.id === selShapeId);
    if (!shape) return;
    character.detachAccessory('main');
    character.attachAccessory('main', shape.create(createColor), {
      pos: [...hairAccState.pos], rot: [...hairAccState.rot], scale: hairAccState.scale,
    });
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'hbtn';
  saveBtn.style.cssText = 'flex:1;font-size:11px;background:rgba(80,200,100,0.1);border-color:rgba(80,200,100,0.4);';
  saveBtn.textContent = '保存して登録';
  saveBtn.addEventListener('click', () => {
    const shape = BASE_SHAPES.find(s => s.id === selShapeId);
    if (!shape) return;
    const label = nameInp.value.trim() || `カスタム${userAccessories.length + 1}`;
    const id = `user_${Date.now()}`;
    const capturedShapeId = selShapeId;
    const capturedColor = createColor;
    userAccessories.push({
      id,
      label,
      defaultColor: capturedColor,
      create: c => BASE_SHAPES.find(s => s.id === capturedShapeId)?.create(c) ?? new THREE.Group(),
      _userDef: { id, label, baseShapeId: capturedShapeId, color: capturedColor },
    });
    alert(`「${label}」をアクセサリー一覧に追加しました。`);
  });

  btnRow.appendChild(previewBtn); btnRow.appendChild(saveBtn);
  area.appendChild(btnRow);

  // カスタム保存済み一覧
  if (userAccessories.length > 0) {
    const dlSep = document.createElement('div');
    dlSep.className = 'nose-sep'; dlSep.textContent = `カスタム登録済み (${userAccessories.length}件)`;
    area.appendChild(dlSep);
    const dlBtn = document.createElement('button');
    dlBtn.className = 'hbtn';
    dlBtn.style.cssText = 'width:100%;font-size:11px;margin-top:4px;';
    dlBtn.textContent = 'JSONで書き出し';
    dlBtn.addEventListener('click', () => {
      const data = userAccessories.map(a => a._userDef);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'hair_accessories.json' });
      a.click(); URL.revokeObjectURL(a.href);
    });
    area.appendChild(dlBtn);
  }
}

function buildHairAccShinePanel(area) {
  area.innerHTML = '';

  const TAB_DEFS = [
    { key: 'acc',    label: 'アクセサリー',   build: a => _buildAccTab(a)    },
    { key: 'shine',  label: 'ツヤ設定',        build: a => _buildShineTab(a)  },
    { key: 'create', label: '3Dアクセ作成',    build: a => _buildCreateTab(a) },
  ];
  let activeTabKey = 'acc';

  const tabRow = document.createElement('div');
  tabRow.style.cssText = 'display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap;';
  area.appendChild(tabRow);

  const contentWrap = document.createElement('div');
  area.appendChild(contentWrap);

  const tabContents = {};
  TAB_DEFS.forEach(t => {
    const content = document.createElement('div');
    tabContents[t.key] = content;
    content.style.display = t.key === activeTabKey ? '' : 'none';
    contentWrap.appendChild(content);

    const btn = document.createElement('button');
    btn.className = 'sub-tab' + (t.key === activeTabKey ? ' active' : '');
    btn.style.cssText = 'font-size:10px;padding:3px 8px;';
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      activeTabKey = t.key;
      tabRow.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(tabContents).forEach(c => { c.style.display = 'none'; });
      content.style.display = '';
      if (!content._built) { t.build(content); content._built = true; }
    });
    tabRow.appendChild(btn);
  });

  // 初期タブをビルド
  const initDef = TAB_DEFS.find(t => t.key === activeTabKey);
  if (initDef) { initDef.build(tabContents[activeTabKey]); tabContents[activeTabKey]._built = true; }
}

function buildColorPanel(slot) {
  const swRow = document.getElementById('color-swatches-main');
  if (!swRow) return;
  swRow.innerHTML = '';
  HAIR_COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => {
      document.getElementById('color-picker-main').value = c;
      character?.setColor(slot, c);
    });
    swRow.appendChild(sw);
  });
  const picker = document.getElementById('color-picker-main');
  if (picker) {
    picker.oninput = null;
    picker.oninput = e => character?.setColor(slot, e.target.value);
  }
}

// ═══════════════════════════════════════════════════════════════
//  表情エディタパネル（ExpressionController）
// ═══════════════════════════════════════════════════════════════

const EXPRESSION_SLIDERS = [
  { key: 'smile',      label: '笑顔',    min: 0,    max: 100, step: 1 },
  { key: 'anger',      label: '怒り',    min: 0,    max: 100, step: 1 },
  { key: 'sad',        label: '悲しみ',  min: 0,    max: 100, step: 1 },
  { key: 'surprise',   label: '驚き',    min: 0,    max: 100, step: 1 },
  { key: 'blush',      label: '照れ',    min: 0,    max: 100, step: 1 },
  { key: 'sleepy',     label: '眠たさ',  min: 0,    max: 100, step: 1 },
  { key: 'eyeClose',   label: '目の閉じ', min: 0,   max: 100, step: 1 },
  { key: 'mouthOpen',  label: '口の開き', min: 0,   max: 100, step: 1 },
  { key: 'mouthCorner',label: '口角',    min: -100, max: 100, step: 1 },
];

function _initExpressionIfNeeded() {
  if (!faceEditor) faceEditor = new FaceEditor(character);
  if (!expressionController || expressionController.faceEditor !== faceEditor) {
    expressionController = new ExpressionController(faceEditor);
  }
}

function buildExpressionPanel(area) {
  area.innerHTML = '';
  _initExpressionIfNeeded();

  // ── プリセットグリッド ─────────────────────────────────────
  const presetSep = document.createElement('div');
  presetSep.className = 'nose-sep';
  presetSep.textContent = '表情プリセット';
  area.appendChild(presetSep);

  const presetGrid = document.createElement('div');
  presetGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:12px;';
  area.appendChild(presetGrid);

  function renderPresets() {
    presetGrid.innerHTML = '';
    const currentPreset = expressionController.getPreset();
    EXPRESSION_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'hbtn' + (p.id === currentPreset ? ' active' : '');
      btn.style.cssText = 'font-size:11px;padding:4px 2px;' +
        (p.id === currentPreset ? 'background:rgba(100,160,255,0.2);border-color:var(--accent);color:var(--accent);' : '');
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        expressionController.setPreset(p.id);
        expressionController.applyState();
        buildExpressionPanel(area);
      });
      presetGrid.appendChild(btn);
    });
  }
  renderPresets();

  // ── スライダー ──────────────────────────────────────────────
  const sliderSep = document.createElement('div');
  sliderSep.className = 'nose-sep';
  sliderSep.textContent = '表情スライダー';
  area.appendChild(sliderSep);

  const vals = expressionController.getValues();

  EXPRESSION_SLIDERS.forEach(sl => {
    const row = document.createElement('div');
    row.className = 'sl-row';

    const nm = document.createElement('span');
    nm.className = 'sl-name';
    nm.textContent = sl.label;

    const inp = document.createElement('input');
    inp.type  = 'range';
    inp.min   = sl.min; inp.max = sl.max; inp.step = sl.step;
    inp.value = vals[sl.key] ?? 0;

    const vl = document.createElement('span');
    vl.className = 'sl-val';
    vl.textContent = inp.value;

    inp.addEventListener('input', () => {
      expressionController.setValue(sl.key, parseFloat(inp.value));
      vl.textContent = inp.value;
      expressionController.applyState();
      // プリセットのハイライトをクリア
      presetGrid.querySelectorAll('.hbtn').forEach(b => {
        b.classList.remove('active');
        b.style.background = '';
        b.style.borderColor = '';
        b.style.color = '';
      });
    });

    row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
    area.appendChild(row);
  });

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className    = 'hbtn';
  resetBtn.style.marginTop = '12px';
  resetBtn.textContent  = '表情リセット';
  resetBtn.addEventListener('click', () => {
    expressionController.resetState();
    buildExpressionPanel(area);
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  ポーズエディタパネル
// ═══════════════════════════════════════════════════════════════
function _initPoseIfNeeded() {
  if (!poseController) {
    poseController = new PoseController(character);
    poseController.init();
  } else if (!poseController.character) {
    poseController.character = character;
    poseController.init();
  }
}

function buildPosePanel(area) {
  area.innerHTML = '';
  _initPoseIfNeeded();

  // ── プリセットグリッド ────────────────────────────────────
  const presetSep = document.createElement('div');
  presetSep.className = 'nose-sep';
  presetSep.textContent = 'ポーズプリセット';
  area.appendChild(presetSep);

  const presetGrid = document.createElement('div');
  presetGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:12px;';
  area.appendChild(presetGrid);

  function renderPresets() {
    presetGrid.innerHTML = '';
    const cur = poseController.getPreset();
    POSE_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      const active = p.id === cur;
      btn.className = 'hbtn' + (active ? ' active' : '');
      btn.style.cssText = 'font-size:11px;padding:4px 2px;' +
        (active ? 'background:rgba(100,160,255,0.2);border-color:var(--accent);color:var(--accent);' : '');
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        poseController.setPreset(p.id);
        poseController.applyState();
        buildPosePanel(area);
      });
      presetGrid.appendChild(btn);
    });
  }
  renderPresets();

  // ── 左右連動チェックボックス ──────────────────────────────
  const syncRow = document.createElement('div');
  syncRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const chk = document.createElement('input');
  chk.type = 'checkbox'; chk.id = 'pose-sync-lr';
  chk.checked = poseController.isSyncLR();
  chk.style.accentColor = 'var(--accent)';
  const chkLbl = document.createElement('label');
  chkLbl.htmlFor = 'pose-sync-lr';
  chkLbl.textContent = '左右同時編集';
  chkLbl.style.cssText = 'cursor:pointer;font-size:13px;';
  syncRow.appendChild(chk); syncRow.appendChild(chkLbl);
  area.appendChild(syncRow);

  // ── ボーングループスライダー ──────────────────────────────
  const boneArea = document.createElement('div');
  area.appendChild(boneArea);

  function renderBoneGroups() {
    boneArea.innerHTML = '';
    const syncLR = poseController.isSyncLR();

    POSE_BONE_GROUPS.forEach(grp => {
      // syncLR ON 時は右側グループをスキップ（左側で連動制御）
      if (syncLR && grp.isRight) {
        const note = document.createElement('div');
        note.style.cssText = 'color:#5a6080;font-size:11px;margin:4px 0 8px;padding:4px 8px;border:1px solid #2a3050;border-radius:4px;';
        note.textContent = `${grp.group} ← 左と連動中`;
        boneArea.appendChild(note);
        return;
      }

      const grpLbl = document.createElement('div');
      grpLbl.className = 'nose-sep';
      grpLbl.textContent = grp.group + (syncLR && grp.isLeft ? '（右も連動）' : '');
      boneArea.appendChild(grpLbl);

      grp.bones.forEach(boneDef => {
        const boneRot = poseController.getRotation(boneDef.key);

        const boneLbl = document.createElement('div');
        boneLbl.style.cssText = 'font-size:11px;color:#8090b0;margin:6px 0 2px;';
        boneLbl.textContent = boneDef.label;
        boneArea.appendChild(boneLbl);

        [
          { axis: 'x', label: 'Rotation X' },
          { axis: 'y', label: 'Rotation Y' },
          { axis: 'z', label: 'Rotation Z' },
        ].forEach(({ axis, label }) => {
          const row = document.createElement('div');
          row.className = 'sl-row';

          const nm = document.createElement('span');
          nm.className = 'sl-name';
          nm.style.fontSize = '11px';
          nm.textContent = label;

          const inp = document.createElement('input');
          inp.type = 'range'; inp.min = -180; inp.max = 180; inp.step = 1;
          inp.value = boneRot[axis] ?? 0;

          const vl = document.createElement('span');
          vl.className = 'sl-val';
          vl.textContent = inp.value + '°';

          inp.addEventListener('input', () => {
            const v = parseFloat(inp.value);
            poseController.setRotation(boneDef.key, axis, v);
            poseController.applyState();
            vl.textContent = inp.value + '°';
            // プリセットハイライトをクリア
            presetGrid.querySelectorAll('.hbtn').forEach(b => {
              b.classList.remove('active');
              b.style.background = ''; b.style.borderColor = ''; b.style.color = '';
            });
          });

          row.appendChild(nm); row.appendChild(inp); row.appendChild(vl);
          boneArea.appendChild(row);
        });
      });
    });
  }

  chk.addEventListener('change', () => {
    poseController.setSyncLR(chk.checked);
    poseController.applyState();
    renderBoneGroups();
  });

  renderBoneGroups();

  // ── リセットボタン ────────────────────────────────────────
  const resetBtn = document.createElement('button');
  resetBtn.className = 'hbtn';
  resetBtn.style.marginTop = '12px';
  resetBtn.textContent = 'ポーズリセット';
  resetBtn.addEventListener('click', () => {
    poseController.resetState();
    buildPosePanel(area);
  });
  area.appendChild(resetBtn);
}

// ═══════════════════════════════════════════════════════════════
//  セーブ / ロード / 初期化
// ═══════════════════════════════════════════════════════════════
function saveJSON() {
  const data = {
    version: 4,
    name: document.getElementById('chara-name')?.value || '新しいキャラ',
    state: { ...uiState },
    hairAcc: {
      presetId: hairAccState.presetId,
      target:   hairAccState.target,
      color:    hairAccState.color,
      pos:      [...hairAccState.pos],
      rot:      [...hairAccState.rot],
      scale:    hairAccState.scale,
    },
    hairShine: {
      preset:          hairShineState.preset,
      roughness:       hairShineState.roughness,
      metalness:       hairShineState.metalness,
      envMapIntensity: hairShineState.envMapIntensity,
    },
    face:       faceEditor          ? faceEditor.serialize()          : {},
    expression: expressionController ? expressionController.serialize() : null,
    pose:       poseController       ? poseController.serialize()       : null,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${data.name}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadJSONFromFile() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  inp.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async ev => {
      try {
        const d = JSON.parse(ev.target.result);
        await applyLoadedData(d);
      } catch (err) {
        alert('ロードエラー: ' + err.message);
      }
    };
    r.readAsText(f);
  });
  inp.click();
}

async function applyLoadedData(d) {
  setLoading(true, 'キャラデータ適用中...');
  if (d.name) {
    const nameEl = document.getElementById('chara-name');
    if (nameEl) nameEl.value = d.name;
  }
  Object.assign(uiState, d.state || {});

  for (const key of Object.keys(BODY_MORPHS)) {
    if (uiState[key] !== undefined) applyBodyMorph(key, uiState[key]);
  }

  if (character) {
    const slots = {
      head:        findSlotItem('head',        uiState.head),
      hair_front:  findSlotItem('hair_front',  uiState.hair_front),
      hair_back:   findSlotItem('hair_back',   uiState.hair_back),
      hair_side:   findSlotItem('hair_side',   uiState.hair_side),
      clothes_top: findSlotItem('clothes_top', uiState.clothes_top),
      clothes_bot: findSlotItem('clothes_bot', uiState.clothes_bot),
    };
    for (const [slot, item] of Object.entries(slots)) {
      if (item) await character.attach(slot, item.url);
    }
    // head ロード後に FaceEditor 初期化
    if (slots.head) {
      if (!faceEditor) faceEditor = new FaceEditor(character);
      faceEditor.reinitForHead();
    }
  }

  // 髪アクセサリー復元
  if (d.hairAcc) {
    const ha = d.hairAcc;
    hairAccState.presetId = ha.presetId ?? null;
    hairAccState.target   = ha.target   ?? 'hair_front';
    hairAccState.color    = ha.color    ?? '#ff88bb';
    hairAccState.pos      = Array.isArray(ha.pos) ? [...ha.pos] : [0, 1.45, 0];
    hairAccState.rot      = Array.isArray(ha.rot) ? [...ha.rot] : [0, 0, 0];
    hairAccState.scale    = ha.scale    ?? 1.0;
    _applyAccessory();
  }

  // 髪ツヤ復元
  if (d.hairShine) {
    Object.assign(hairShineState, d.hairShine);
    _applyHairShine();
  }

  // 顔調整復元 (v4: d.face / v3以前: d.eye → 自動変換して後方互換)
  const faceData = d.face ?? (d.eye ? { eye: d.eye } : null);
  if (faceData) {
    if (!faceEditor) faceEditor = new FaceEditor(character);
    faceEditor.deserialize(faceData);
    faceEditor.applyAll();
  }

  // 表情復元（expression キーがない古いデータはスキップ）
  if (d.expression) {
    if (!faceEditor) faceEditor = new FaceEditor(character);
    if (!expressionController || expressionController.faceEditor !== faceEditor) {
      expressionController = new ExpressionController(faceEditor);
    }
    expressionController.deserialize(d.expression);
    expressionController.applyState();
  }

  // ポーズ復元（pose キーがない古いデータはスキップ）
  if (d.pose) {
    if (!poseController) poseController = new PoseController(character);
    if (!poseController._bones || Object.keys(poseController._bones).length === 0) {
      poseController.init();
    }
    poseController.deserialize(d.pose);
    poseController.applyState();
  }

  setLoading(false);
  renderSubTabs(currentCat);
}

function findSlotItem(subKey, idx) {
  if (idx === undefined || idx === null) return null;
  for (const catDef of Object.values(CATEGORIES)) {
    for (const sub of catDef.subs) {
      if (sub.key === subKey && sub.items) return sub.items[idx] ?? null;
    }
  }
  return null;
}

async function initAll() {
  if (!confirm('初期化しますか？')) return;
  character?.reset();
  Object.keys(uiState).forEach(k => delete uiState[k]);
  await initCharacter();
  renderSubTabs(currentCat);
}

// ═══════════════════════════════════════════════════════════════
//  メインタブ切替
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('.main-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCat = tab.dataset.cat;
    currentSub = null;
    renderSubTabs(currentCat);
  });
});

document.getElementById('btn-save')?.addEventListener('click', saveJSON);
document.getElementById('btn-load')?.addEventListener('click', loadJSONFromFile);
document.getElementById('btn-init')?.addEventListener('click', initAll);

// ═══════════════════════════════════════════════════════════════
//  3D モデルペイント
// ═══════════════════════════════════════════════════════════════
const PAINT3D_SIZE = 1024;

class ModelPainter {
  constructor() {
    this.texMap = new Map(); // mesh.uuid → { canvas, ctx, texture, undoStack }
  }

  _ensure(mesh) {
    if (this.texMap.has(mesh.uuid)) return this.texMap.get(mesh.uuid);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PAINT3D_SIZE;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
    // 既存マテリアルの emissive レイヤーとして重ねる（非破壊）
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => {
      if (!m) return;
      if (!m.userData.p3dOrig) {
        m.userData.p3dOrig = {
          emissive: m.emissive?.clone?.() ?? new THREE.Color(0),
          emissiveMap: m.emissiveMap ?? null,
          emissiveIntensity: m.emissiveIntensity ?? 0,
        };
      }
      m.emissiveMap = texture;
      m.emissiveIntensity = 1.0;
      m.needsUpdate = true;
    });
    const info = { canvas, ctx, texture, undoStack: [] };
    this.texMap.set(mesh.uuid, info);
    return info;
  }

  getAllMeshes() {
    if (!scene) return [];
    const out = [];
    scene.traverse(o => {
      if ((o.isMesh || o.isSkinnedMesh) && !o.userData.noPaint) out.push(o);
    });
    return out;
  }

  getMeshesByPart(part) {
    return this.getAllMeshes().filter(m => {
      if (part === 'all') return true;
      const n = (m.name || '').toLowerCase();
      if (part === 'body')    return n.includes('body') || n.includes('skin') || n.includes('cf_o') || n === '';
      if (part === 'head')    return n.includes('head') || n.includes('face') || n.includes('cf_o_eyeline') || n.includes('cf_o_tooth');
      if (part === 'hair')    return n.includes('hair') || n.includes('ahoge');
      if (part === 'clothes') return n.includes('cloth') || n.includes('co_') || n.includes('cpo_') || n.includes('top') || n.includes('bot') || n.includes('bra') || n.includes('sock') || n.includes('shoe');
      return true;
    });
  }

  saveUndo(mesh) {
    const info = this._ensure(mesh);
    const snap = info.ctx.getImageData(0, 0, PAINT3D_SIZE, PAINT3D_SIZE);
    info.undoStack.push(snap);
    if (info.undoStack.length > 30) info.undoStack.shift();
  }

  undoLast() {
    // 最後に変更されたメッシュのアンドゥ
    let candidate = null;
    this.texMap.forEach(info => { if (info.undoStack.length > 0) candidate = info; });
    if (!candidate) return;
    candidate.ctx.putImageData(candidate.undoStack.pop(), 0, 0);
    candidate.texture.needsUpdate = true;
  }

  paintAtUV(mesh, uv, tool, color, size, opacity, wet, prevUV) {
    const info = this._ensure(mesh);
    const { ctx, texture } = info;
    const W = PAINT3D_SIZE;
    const px = uv.x * W;
    const py = (1 - uv.y) * W; // UV の Y 反転

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.shadowBlur = wet * 3;
    ctx.shadowColor = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle   = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
    }
    if (prevUV) {
      const ppx = prevUV.x * W, ppy = (1 - prevUV.y) * W;
      ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(px, py, size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    texture.needsUpdate = true;
  }

  clearPart(part) {
    this.getMeshesByPart(part).forEach(m => {
      const info = this.texMap.get(m.uuid);
      if (!info) return;
      this.saveUndo(m);
      info.ctx.clearRect(0, 0, PAINT3D_SIZE, PAINT3D_SIZE);
      info.texture.needsUpdate = true;
    });
  }

  clearAll() {
    this.texMap.forEach(info => {
      info.ctx.clearRect(0, 0, PAINT3D_SIZE, PAINT3D_SIZE);
      info.texture.needsUpdate = true;
    });
  }

  // ペイントレイヤーを全マテリアルから除去（終了時）
  detachAll() {
    if (!scene) return;
    scene.traverse(o => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        if (!m?.userData?.p3dOrig) return;
        const orig = m.userData.p3dOrig;
        m.emissiveMap = orig.emissiveMap;
        m.emissiveIntensity = orig.emissiveIntensity;
        if (m.emissive && orig.emissive) m.emissive.set(orig.emissive);
        m.needsUpdate = true;
        delete m.userData.p3dOrig;
      });
    });
  }

  // 全テクスチャを再アタッチ（シーン再構築後の復元用）
  reattach() {
    this.texMap.forEach((info, uuid) => {
      if (!scene) return;
      scene.traverse(o => {
        if (o.uuid !== uuid && !((o.isMesh || o.isSkinnedMesh) && this.texMap.has(o.uuid))) return;
        if (o.uuid === uuid) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { if (m) { m.emissiveMap = info.texture; m.emissiveIntensity = 1; m.needsUpdate = true; }});
        }
      });
    });
  }
}

const modelPainter = new ModelPainter();

const paint3d = {
  active: false,
  tool: 'brush',
  color: '#ff0000',
  size: 30,
  opacity: 0.85,
  wet: 0,
  part: 'all',
  painting: false,
  prevUV: null,
  prevMesh: null,
};

const _p3dRay = scene ? new THREE.Raycaster() : null;

function _p3dNDC(e) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function _p3dHit(e) {
  if (!scene || !camera || !_p3dRay) return null;
  _p3dRay.setFromCamera(_p3dNDC(e), camera);
  const meshes = modelPainter.getMeshesByPart(paint3d.part);
  const hits = _p3dRay.intersectObjects(meshes, false);
  return (hits.length > 0 && hits[0].uv) ? hits[0] : null;
}

// ─── 着衣の表示管理 ───────────────────────────────────────────
let _clothesHidden = {}; // slot -> true (ペイント中に隠したスロット)
let _globalClothesHidden = false; // グローバル非表示トグル

function _setGroupVisible(group, visible) {
  if (!group) return;
  group.traverse(obj => { obj.visible = visible; });
}

// 指定スロットの服を隠す（exitPaint3dで自動復元）
function hideClothesForPaint(slots) {
  _clothesHidden = {};
  if (!character) return;
  const targets = slots || Object.keys(character.parts);
  targets.forEach(slot => {
    if (character.parts[slot]) {
      _clothesHidden[slot] = true;
      _setGroupVisible(character.parts[slot], false);
    }
  });
}

// ペイント終了時に復元
function restoreClothesAfterPaint() {
  if (!character) return;
  Object.keys(_clothesHidden).forEach(slot => {
    if (character.parts[slot] && !_globalClothesHidden) {
      _setGroupVisible(character.parts[slot], true);
    }
  });
  _clothesHidden = {};
}

// グローバル着衣トグル
function toggleAllClothes() {
  _globalClothesHidden = !_globalClothesHidden;
  if (!character) return;
  Object.values(character.parts).forEach(g => _setGroupVisible(g, !_globalClothesHidden));
  const btn = document.getElementById('btn-toggle-clothes');
  if (btn) {
    btn.style.color = _globalClothesHidden ? 'var(--accent)' : '';
    btn.style.borderColor = _globalClothesHidden ? 'var(--accent)' : '';
    btn.title = _globalClothesHidden ? '着衣を表示する' : '着衣を非表示にする';
  }
}

function enterPaint3d() {
  paint3d.active = true;
  if (controls) controls.enabled = false;
  if (canvas) canvas.style.cursor = 'crosshair';
  document.getElementById('paint3d-bar')?.classList.remove('hidden');
  const btn = document.getElementById('btn-paint3d');
  if (btn) { btn.style.color = 'var(--accent)'; btn.style.borderColor = 'var(--accent)'; }
}

function exitPaint3d() {
  paint3d.active = false;
  paint3d.painting = false;
  if (controls) controls.enabled = true;
  if (canvas) canvas.style.cursor = '';
  document.getElementById('paint3d-bar')?.classList.add('hidden');
  const btn = document.getElementById('btn-paint3d');
  if (btn) { btn.style.color = ''; btn.style.borderColor = ''; }
  restoreClothesAfterPaint(); // ペイント中に隠した服を自動復元
}

// Three.js canvas へのペイントイベント
if (canvas) {
  canvas.addEventListener('pointerdown', e => {
    if (!paint3d.active) return;
    e.preventDefault(); e.stopPropagation();
    const hit = _p3dHit(e);
    if (!hit) { paint3d.painting = false; return; }
    paint3d.painting = true;
    paint3d.prevMesh = hit.object;
    paint3d.prevUV = null;
    modelPainter.saveUndo(hit.object);
    modelPainter.paintAtUV(hit.object, hit.uv, paint3d.tool, paint3d.color, paint3d.size, paint3d.opacity, paint3d.wet, null);
    paint3d.prevUV = hit.uv.clone();
    canvas.setPointerCapture(e.pointerId);
  }, { capture: true });

  canvas.addEventListener('pointermove', e => {
    if (!paint3d.active || !paint3d.painting) return;
    e.preventDefault();
    const hit = _p3dHit(e);
    if (!hit) return;
    const sameObj = hit.object === paint3d.prevMesh;
    modelPainter.paintAtUV(hit.object, hit.uv, paint3d.tool, paint3d.color, paint3d.size, paint3d.opacity, paint3d.wet, sameObj ? paint3d.prevUV : null);
    paint3d.prevUV = hit.uv.clone();
    paint3d.prevMesh = hit.object;
  }, { capture: true });

  canvas.addEventListener('pointerup', e => {
    if (!paint3d.active) return;
    paint3d.painting = false;
    paint3d.prevUV = null;
  }, { capture: true });
}

document.getElementById('btn-paint3d')?.addEventListener('click', () => {
  if (paint3d.active) exitPaint3d(); else enterPaint3d();
});

// ── ペイントツールバー UI ──
(function initPaint3dUI() {
  const bar = document.getElementById('paint3d-bar');
  if (!bar) return;

  const brushBtn  = document.getElementById('p3d-brush');
  const eraserBtn = document.getElementById('p3d-eraser');
  [brushBtn, eraserBtn].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      paint3d.tool = btn === brushBtn ? 'brush' : 'eraser';
      brushBtn.classList.toggle('p3d-active', paint3d.tool === 'brush');
      eraserBtn.classList.toggle('p3d-active', paint3d.tool === 'eraser');
    });
  });

  document.getElementById('p3d-color')?.addEventListener('input', e => { paint3d.color = e.target.value; });

  bar.querySelectorAll('.p3d-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      paint3d.color = sw.dataset.c;
      const cp = document.getElementById('p3d-color');
      if (cp) cp.value = paint3d.color;
      bar.querySelectorAll('.p3d-swatch').forEach(s => s.style.outline = 'none');
      sw.style.outline = '2px solid var(--accent)';
    });
  });

  const sliders = [
    { id: 'p3d-size',    valId: 'p3d-size-val',    suffix: 'px', key: 'size',    fn: v => parseInt(v) },
    { id: 'p3d-opacity', valId: 'p3d-opacity-val', suffix: '%',  key: 'opacity', fn: v => parseInt(v)/100 },
    { id: 'p3d-wet',     valId: 'p3d-wet-val',     suffix: '',   key: 'wet',     fn: v => parseInt(v) },
  ];
  sliders.forEach(s => {
    const sl = document.getElementById(s.id), vl = document.getElementById(s.valId);
    if (!sl) return;
    sl.addEventListener('input', () => { paint3d[s.key] = s.fn(sl.value); if (vl) vl.textContent = sl.value + s.suffix; });
  });

  document.getElementById('p3d-part')?.addEventListener('change', e => { paint3d.part = e.target.value; });
  document.getElementById('p3d-undo')?.addEventListener('click', () => modelPainter.undoLast());
  document.getElementById('p3d-clear')?.addEventListener('click', () => { if (confirm('この部位のペイントをクリアしますか？')) modelPainter.clearPart(paint3d.part); });
  document.getElementById('p3d-clear-all')?.addEventListener('click', () => { if (confirm('全てのペイントをクリアしますか？')) modelPainter.clearAll(); });
  document.getElementById('p3d-exit')?.addEventListener('click', exitPaint3d);
document.getElementById('btn-toggle-clothes')?.addEventListener('click', toggleAllClothes);
})();

// ═══════════════════════════════════════════════════════════════
//  初期表示
// ═══════════════════════════════════════════════════════════════
renderSubTabs('face');
document.querySelector('.main-tab[data-cat="face"]')?.classList.add('active');
document.querySelector('.main-tab[data-cat="body"]')?.classList.remove('active');
