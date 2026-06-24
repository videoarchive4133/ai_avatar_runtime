import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';

// ── home screen ───────────────────────────────────────────
const RECENT_KEY = 'ava_recent_projects';

function getRecentProjects() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecentProject(name, url) {
  const list = getRecentProjects().filter(p => p.name !== name);
  list.unshift({ name, url, date: new Date().toISOString() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  renderRecentGrid();
}

function removeRecentProject(name) {
  const list = getRecentProjects().filter(p => p.name !== name);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  renderRecentGrid();
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return diffMin + '分前';
  if (diffHr < 24) return diffHr + '時間前';
  if (diffDay < 7) return diffDay + '日前';
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function renderRecentGrid() {
  const grid = document.getElementById('recent-grid');
  if (!grid) return;
  const newCard = document.getElementById('home-new-card');
  grid.innerHTML = '';
  grid.appendChild(newCard);

  const projects = getRecentProjects();
  projects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'home-project-card';
    const ext = (proj.url || '').split('.').pop().toLowerCase();
    const badge = (ext === 'vrm') ? 'VRM' : (ext === 'glb' || ext === 'gltf') ? 'GLB' : '';
    const escName = proj.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    card.innerHTML = `
      <div class="home-project-thumb" style="position:relative;">◈${badge ? `<span style="position:absolute;top:6px;right:6px;background:rgba(255,255,255,0.88);color:#3c3c43;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.18);">${badge}</span>` : ''}</div>
      <div class="home-project-info">
        <div class="home-project-name">${escName}</div>
        <div class="home-project-date">${fmtDate(proj.date)}</div>
      </div>
      <button class="home-project-remove" title="削除">✕</button>
    `;
    card.querySelector('.home-project-name').setAttribute('title', proj.name);
    card.addEventListener('click', () => openEditor(proj.url, proj.name));
    card.querySelector('.home-project-remove').addEventListener('click', e => {
      e.stopPropagation();
      removeRecentProject(proj.name);
    });
    grid.appendChild(card);
  });
}

let _thumbsRendered = false;

function showHome() {
  document.getElementById('home-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  renderRecentGrid();
  if (!_thumbsRendered) {
    _thumbsRendered = true;
    requestAnimationFrame(renderAllSampleThumbs);
  }
}

function openEditor(url, name, isMannequin = false) {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  if (isMannequin) {
    loadMannequinFromHome();
  } else if (url) {
    loadFromHome(url, name);
  }
}

// these functions are defined later after Three.js init, so we call via window refs
function loadFromHome(url, name) {
  loadMainModel(url, name).then(() => {
    if (name) saveRecentProject(name, url);
  });
}

function loadMannequinFromHome() {
  document.getElementById('model-name').textContent = '';
  clearAllObjects();
  const root = createBaseMannequin();
  scene.add(root);
  const id = Math.random().toString(36).slice(2);
  sceneObjects.push({ id, name: '素体', root, vrm: null, mixer: null, clips: [], currentAction: null });
  selectObject(id);
  document.getElementById('model-name').textContent = '素体';
  document.getElementById('empty-hint').style.display = 'none';
  requestAnimationFrame(() => {
    orbitCtrl.target.set(0, 1.0, 0);
    camera.position.set(0, 1.3, 3.2);
    orbitCtrl.update();
  });
}

// 新規作成 → 性別選択モーダルを表示
function openNewModel() {
  const modal = document.getElementById('new-model-modal');
  if (modal) { modal.style.display = 'flex'; }
}
document.getElementById('home-btn-new').addEventListener('click', openNewModel);
document.getElementById('home-new-card').addEventListener('click', openNewModel);

(function() {
  const modal  = document.getElementById('new-model-modal');
  const female = document.getElementById('new-model-female');
  const male   = document.getElementById('new-model-male');
  const cancel = document.getElementById('new-model-cancel');
  function closeModal() { if (modal) modal.style.display = 'none'; }
  if (female) female.addEventListener('click', () => { closeModal(); openEditor('/samples/vroid_base.vrm', '新規作成（女性）'); });
  if (male)   male.addEventListener('click',   () => { closeModal(); openEditor('/samples/vroid_male.vrm',  '新規作成（男性）'); });
  if (cancel) cancel.addEventListener('click', closeModal);
  if (modal)  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  // ホバースタイル
  [female, male].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'var(--accent,#e0529c)'; btn.style.background = 'var(--accent-dim,rgba(224,82,156,0.1))'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'var(--border,#3a3a3c)'; btn.style.background = 'var(--panel2,#2c2c2e)'; });
  });
})();

document.getElementById('home-btn-open').addEventListener('click', () => {
  const fi = document.createElement('input');
  fi.type = 'file'; fi.accept = '.vrm,.glb,.gltf';
  fi.addEventListener('change', () => {
    const f = fi.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    openEditor(url, f.name);
    saveRecentProject(f.name, url); // URL kept for recent project re-open
  });
  fi.click();
});

document.getElementById('home-clear-recent').addEventListener('click', () => {
  localStorage.removeItem(RECENT_KEY);
  renderRecentGrid();
});

document.querySelectorAll('.home-sample-card').forEach(card => {
  card.addEventListener('click', () => {
    const url = card.dataset.url;
    const name = card.dataset.name;
    const isMannequin = !!card.dataset.mannequin;
    openEditor(url, name, isMannequin);
    if (url) saveRecentProject(name, url);
  });
});

// Home screen sample search
(function() {
  const sampleSection = document.getElementById('sample-section');
  if (!sampleSection) return;
  const hdr = sampleSection.querySelector('.home-section-hdr');
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0 0 12px 0;';
  const searchInp = document.createElement('input');
  searchInp.type = 'text';
  searchInp.placeholder = 'テンプレートを検索...';
  searchInp.style.cssText = 'width:100%;padding:8px 12px;background:#fff;border:1px solid #d2d2d7;border-radius:8px;color:#1d1d1f;font-size:13px;outline:none;';
  searchInp.addEventListener('input', () => {
    const q = searchInp.value.toLowerCase();
    document.querySelectorAll('.home-sample-card').forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      card.style.display = !q || name.includes(q) ? '' : 'none';
    });
  });
  searchWrap.appendChild(searchInp);
  if (hdr) hdr.after(searchWrap);
})();

document.getElementById('btn-home').addEventListener('click', showHome);
document.getElementById('btn-focus-face')?.addEventListener('click', focusFace);

// show home on startup
showHome();

// ── renderer ──────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;

// ── scene ─────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.FogExp2(0x0d1117, 0.06);
scene.add(new THREE.HemisphereLight(0xbbd4ff, 0x334155, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(1.5, 4, 2.5);
sun.castShadow = true;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8899ff, 0.8);
fill.position.set(-2, 1, -1);
scene.add(fill);
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a2234, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ── camera & controls ─────────────────────────────────────
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
camera.position.set(0, 1.3, 3.2);
const orbitCtrl = new OrbitControls(camera, canvas);
orbitCtrl.target.set(0, 1.0, 0);
orbitCtrl.enableDamping = true;
orbitCtrl.dampingFactor = 0.07;
orbitCtrl.minDistance = 0.3;
orbitCtrl.maxDistance = 15;
orbitCtrl.update();

// ── transform controls ────────────────────────────────────
const transformControls = new TransformControls(camera, canvas);
transformControls.addEventListener('dragging-changed', e => { orbitCtrl.enabled = !e.value; });
transformControls.addEventListener('change', () => refreshTransformInspector());
transformControls.setSpace('world');
scene.add(transformControls);

function setTransformMode(mode) {
  transformControls.setMode(mode);
  document.querySelectorAll('.tc-btn[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const modeNames = { translate:'移動', rotate:'回転', scale:'拡縮' };
  const el = document.getElementById('status-mode');
  if (el) el.textContent = modeNames[mode] || mode;
}

document.querySelectorAll('.tc-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    setTransformMode(btn.dataset.mode);
    document.querySelectorAll('.tc-btn[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
  });
});

function refreshTransformInspector() {
  if (!currentRoot) return;
  document.querySelectorAll('.tf-input[data-prop]').forEach(inp => {
    const [prop, axis] = inp.dataset.prop.split('.');
    const val = currentRoot[prop][axis];
    if (document.activeElement !== inp)
      inp.value = parseFloat(val.toFixed(4));
  });
}

// ── scene extras ─────────────────────────────────────────
let _autoRotate = false;
let _autoRotateSpeed = 0.3;
let _wireframeMode = false;
let _autoBlink = false;
let _autoBlinkTimer = 0;
const _gridHelper = new THREE.GridHelper(4, 20, 0x2a2a4a, 0x1e1e30);
_gridHelper.visible = false;
scene.add(_gridHelper);

// ── resize ────────────────────────────────────────────────
const vpEl = document.getElementById('viewport');
function resize() {
  if (vpEl.clientWidth === 0 || vpEl.clientHeight === 0) return;
  const w = vpEl.clientWidth || window.innerWidth;
  const h = vpEl.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(vpEl);
resize();

// ── state ─────────────────────────────────────────────────
// Multi-object scene management
const sceneObjects = []; // [{id, name, root, vrm, mixer, clips, currentAction}]
let selectedId = null;

// Convenience refs to selected object's data (updated by selectObject())
let currentVrm    = null;
let currentRoot   = null;
let mixer         = null;
let currentAction = null;
let animClips     = [];
let animSpeedFactor = 1.0;

function getSelectedObj() {
  return sceneObjects.find(o => o.id === selectedId) || null;
}

function selectObject(id) {
  selectedId = id;
  const obj = getSelectedObj();
  currentRoot   = obj?.root   || null;
  currentVrm    = obj?.vrm    || null;
  mixer         = obj?.mixer  || null;
  animClips     = obj?.clips  || [];
  currentAction = obj?.currentAction || null;
  transformControls.detach();
  if (currentRoot) transformControls.attach(currentRoot);
  const toolbar = document.getElementById('transform-toolbar');
  if (toolbar) toolbar.classList.toggle('visible', !!currentRoot);
  // update status bar object name
  const nameEl2 = document.getElementById('status-obj');
  if (nameEl2) nameEl2.textContent = obj?.name || '';
  buildAllPanels();
}

function clearAllObjects() {
  transformControls.detach();
  // dispose hair parts first (before deepDispose removes them via the main scene)
  if (currentRoot) {
    const hairParts = currentRoot.userData._hairParts;
    if (hairParts && hairParts.length > 0) {
      hairParts.forEach(hairRoot => {
        currentRoot.remove(hairRoot);
        const hairVrm = hairRoot.userData._hairVrm;
        if (hairVrm) { VRMUtils.deepDispose(hairVrm.scene); }
        else { hairRoot.traverse(obj => { obj.geometry?.dispose(); [].concat(obj.material || []).forEach(m => m?.dispose?.()); }); }
      });
      currentRoot.userData._hairParts = [];
    }
  }
  sceneObjects.forEach(o => {
    scene.remove(o.root);
    if (o.mixer) { o.mixer.stopAllAction(); o.mixer.uncacheRoot(o.root); }
    if (o.vrm) VRMUtils.deepDispose(o.vrm.scene);
    else o.root.traverse(obj => {
      obj.geometry?.dispose();
      [].concat(obj.material || []).forEach(m => m?.dispose?.());
    });
  });
  sceneObjects.length = 0;
  selectedId = null;
  currentVrm = null; currentRoot = null; mixer = null;
  _selHairId = null;
  animClips = []; currentAction = null;
  // Dispose previous environment texture
  if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
  _currentEnvPreset = 'none';
  document.getElementById('transform-toolbar')?.classList.remove('visible');
  const nameEl = document.getElementById('model-name');
  if (nameEl) nameEl.textContent = '';
  const nameEl2 = document.getElementById('status-obj');
  if (nameEl2) nameEl2.textContent = '';
}

function removeObject(id) {
  const idx = sceneObjects.findIndex(o => o.id === id);
  if (idx < 0) return;
  const obj = sceneObjects[idx];
  if (obj.mixer) { obj.mixer.stopAllAction(); obj.mixer.uncacheRoot(obj.root); }
  scene.remove(obj.root);
  if (obj.vrm) VRMUtils.deepDispose(obj.vrm.scene);
  else obj.root.traverse(o => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach(m => m?.dispose?.());
  });
  sceneObjects.splice(idx, 1);
  if (selectedId === id) {
    const next = sceneObjects[0];
    if (next) selectObject(next.id);
    else {
      selectedId = null; currentRoot = null; currentVrm = null;
      mixer = null; animClips = []; currentAction = null;
      transformControls.detach();
      document.getElementById('transform-toolbar')?.classList.remove('visible');
      const nameEl = document.getElementById('model-name');
      if (nameEl) nameEl.textContent = '';
      const nameEl2 = document.getElementById('status-obj');
      if (nameEl2) nameEl2.textContent = '';
      _clearParams('オブジェクトを追加してください');
      buildAllPanels();
    }
  } else {
    buildAllPanels();
  }
}

const loader = new GLTFLoader();
loader.register(p => new VRMLoaderPlugin(p));

// ── file picker helper ────────────────────────────────────
function pickFile(accept, cb) {
  const fi = document.createElement('input');
  fi.type = 'file'; fi.accept = accept;
  fi.addEventListener('change', () => { const f = fi.files?.[0]; if (f) cb(f); });
  fi.click();
}

// ── sample thumbnail renderer ─────────────────────────────
// Uses the main renderer + WebGLRenderTarget + readRenderTargetPixels.
// readRenderTargetPixels reads directly from GPU memory — no
// preserveDrawingBuffer needed, and works in Tauri WebView.
async function renderSampleThumb(imgEl, url, isMannequin) {
  const W = 256, H = 256;

  // render target sized for the thumbnail
  const rt = new THREE.WebGLRenderTarget(W, H, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  const ts = new THREE.Scene();
  ts.background = new THREE.Color(0xebebed);
  ts.add(new THREE.AmbientLight(0xffffff, 1.8));
  const tSun = new THREE.DirectionalLight(0xffffff, 3.2);
  tSun.position.set(1.2, 4, 2);
  ts.add(tSun);
  ts.add(Object.assign(new THREE.DirectionalLight(0xddeeff, 1.0), { position: new THREE.Vector3(-1.5, 1, -1) }));
  const tc = new THREE.PerspectiveCamera(28, 1, 0.01, 100);

  let root = null, vrm = null;
  try {
    if (isMannequin) {
      root = createBaseMannequin();
    } else {
      const tl = new GLTFLoader();
      tl.register(p => new VRMLoaderPlugin(p));
      const gltf = await tl.loadAsync(url);   // yields here; main loop may run
      if (gltf.userData.vrm) {
        vrm = gltf.userData.vrm;
        VRMUtils.rotateVRM0(vrm);
        root = vrm.scene;
      } else {
        root = gltf.scene;
        const b = new THREE.Box3().setFromObject(root);
        const s = b.getSize(new THREE.Vector3());
        const m = Math.max(s.x, s.y, s.z);
        if (m > 0) root.scale.setScalar(2.0 / m);
      }
    }
    ts.add(root);

    let cy = 1.3, dist = 0.5;
    if (vrm?.humanoid) {
      const hNode = vrm.humanoid.getRawBoneNode(VRMHumanBoneName.Head);
      if (hNode) {
        const hp = new THREE.Vector3();
        hNode.getWorldPosition(hp);
        cy   = hp.y - 0.04;
        dist = 0.52;
      }
    } else {
      const b = new THREE.Box3().setFromObject(root);
      const s = b.getSize(new THREE.Vector3());
      cy   = b.max.y - s.y * 0.12;
      dist = s.y * 0.34;
    }
    tc.position.set(0, cy, dist);
    tc.lookAt(0, cy, 0);

    // --- synchronous block: no rAF can interrupt between these lines ---
    // Use the MAIN renderer (confirmed working) with an offscreen RT.
    const prevToneMapping = renderer.toneMapping;
    const prevExposure   = renderer.toneMappingExposure;
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setRenderTarget(rt);
    renderer.render(ts, tc);

    const pixels = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, pixels);

    // restore main renderer state
    renderer.setRenderTarget(null);
    renderer.toneMapping         = prevToneMapping;
    renderer.toneMappingExposure = prevExposure;
    // -------------------------------------------------------------------

    // WebGL framebuffer is Y-flipped vs canvas coordinates
    const flipped = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      const srcRow = (H - 1 - y) * W * 4;
      flipped.set(pixels.subarray(srcRow, srcRow + W * 4), y * W * 4);
    }

    // 2D canvas → toDataURL always works (no WebGL quirks)
    const c2d = document.createElement('canvas');
    c2d.width = W; c2d.height = H;
    c2d.getContext('2d').putImageData(new ImageData(flipped, W, H), 0, 0);

    imgEl.onload = () => imgEl.classList.add('loaded');
    imgEl.src = c2d.toDataURL('image/png');
  } catch (e) {
    console.warn('[thumb]', url || 'mannequin', e.message);
  } finally {
    rt.dispose();
    if (root) ts.remove(root);
    if (vrm) {
      VRMUtils.deepDispose(vrm.scene);
    } else if (root) {
      root.traverse(o => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach(m => m?.dispose?.());
      });
    }
    // Dispose temporary lights
    ts.children.forEach(c => {
      if (c.isLight) { c.shadow?.map?.dispose?.(); }
    });
    ts.clear();
  }
}

async function renderAllSampleThumbs() {
  for (const card of document.querySelectorAll('.home-sample-card')) {
    const img = card.querySelector('img.thumb-img');
    if (!img) continue;
    await renderSampleThumb(img, card.dataset.url, !!card.dataset.mannequin);
  }
}

// ── coded mannequin (no file needed) ─────────────────────
function createBaseMannequin() {
  const root = new THREE.Group();
  root.name = '素体';

  const skin = new THREE.MeshStandardMaterial({ color: 0xffd5b8, roughness: 0.72, metalness: 0 });

  const cap = (rx, len) => new THREE.Mesh(new THREE.CapsuleGeometry(rx, len, 8, 20), skin.clone());
  const sph = (r)       => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), skin.clone());

  // Head
  const head = sph(0.113); head.name = 'Head';
  head.position.set(0, 1.543, 0);

  // Neck
  const neck = cap(0.050, 0.068); neck.name = 'Neck';
  neck.position.set(0, 1.405, 0);

  // Chest (wider at shoulders)
  const chest = cap(0.128, 0.235); chest.name = 'Chest';
  chest.scale.set(1.2, 1, 0.85);
  chest.position.set(0, 1.210, 0);

  // Waist (narrower)
  const waist = cap(0.088, 0.110); waist.name = 'Waist';
  waist.scale.set(1.0, 1, 0.80);
  waist.position.set(0, 1.005, 0);

  // Hips (wider)
  const hips = cap(0.135, 0.095); hips.name = 'Hips';
  hips.scale.set(1.15, 1, 0.90);
  hips.position.set(0, 0.875, 0);

  // Upper arms
  const lUA = cap(0.038, 0.220); lUA.name = 'L.UpperArm'; lUA.position.set( 0.225, 1.210, 0);
  const rUA = cap(0.038, 0.220); rUA.name = 'R.UpperArm'; rUA.position.set(-0.225, 1.210, 0);

  // Lower arms
  const lLA = cap(0.029, 0.195); lLA.name = 'L.LowerArm'; lLA.position.set( 0.262, 0.985, 0);
  const rLA = cap(0.029, 0.195); rLA.name = 'R.LowerArm'; rLA.position.set(-0.262, 0.985, 0);

  // Hands
  const lH = sph(0.040); lH.name = 'L.Hand'; lH.scale.set(1.1, 0.78, 0.55); lH.position.set( 0.292, 0.805, 0);
  const rH = sph(0.040); rH.name = 'R.Hand'; rH.scale.set(1.1, 0.78, 0.55); rH.position.set(-0.292, 0.805, 0);

  // Upper legs
  const lUL = cap(0.058, 0.285); lUL.name = 'L.UpperLeg'; lUL.position.set( 0.093, 0.635, 0);
  const rUL = cap(0.058, 0.285); rUL.name = 'R.UpperLeg'; rUL.position.set(-0.093, 0.635, 0);

  // Lower legs
  const lLL = cap(0.042, 0.265); lLL.name = 'L.LowerLeg'; lLL.position.set( 0.093, 0.295, 0);
  const rLL = cap(0.042, 0.265); rLL.name = 'R.LowerLeg'; rLL.position.set(-0.093, 0.295, 0);

  // Feet (horizontal capsule)
  const lF = cap(0.033, 0.098); lF.name = 'L.Foot';
  lF.rotation.z = Math.PI / 2; lF.position.set( 0.108, 0.042, 0.038);
  const rF = cap(0.033, 0.098); rF.name = 'R.Foot';
  rF.rotation.z = Math.PI / 2; rF.position.set(-0.108, 0.042, 0.038);

  [head, neck, chest, waist, hips, lUA, rUA, lLA, rLA, lH, rH, lUL, rUL, lLL, rLL, lF, rF]
    .forEach(m => { m.castShadow = true; root.add(m); });

  root.userData._baseScale = 2.0;
  return root;
}

// ── add primitive shape ────────────────────────────────────
function addPrimitive(type) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.65, metalness: 0.05 });
  const specs = {
    box:      [new THREE.BoxGeometry(0.5, 0.5, 0.5),               'Box'],
    sphere:   [new THREE.SphereGeometry(0.3, 32, 24),              'Sphere'],
    cylinder: [new THREE.CylinderGeometry(0.25, 0.25, 0.8, 24),    'Cylinder'],
    capsule:  [new THREE.CapsuleGeometry(0.22, 0.55, 8, 16),       'Capsule'],
    plane:    [new THREE.PlaneGeometry(1, 1),                       'Plane'],
    torus:    [new THREE.TorusGeometry(0.28, 0.09, 16, 32),        'Torus'],
  };
  if (!specs[type]) return;
  const [geo, name] = specs[type];
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  // Spread new objects slightly rather than piling them up
  mesh.position.set((sceneObjects.length % 5) * 0.7 - 1.4, 0.5, Math.floor(sceneObjects.length / 5) * -0.7);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const id = Math.random().toString(36).slice(2);
  sceneObjects.push({ id, name, root: mesh, vrm: null, mixer: null, clips: [], currentAction: null });
  selectObject(id);
  document.getElementById('empty-hint').style.display = 'none';
  setStatus(name + ' を追加'); setTimeout(() => setStatus(''), 2000);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#f87171' : '#7cf';
}

// ── bone name → Japanese ──────────────────────────────────
function boneJaName(name) {
  if (!name) return name;
  const norm = name.toLowerCase().replace(/[_.\s-]/g, '');
  const exact = {
    hips:'腰', pelvis:'骨盤', spine:'背骨', spine1:'背骨1', spine2:'背骨2', spine3:'背骨3',
    chest:'胸', upperchest:'上胸', neck:'首', head:'頭', jaw:'あご', tongue:'舌',
    lefteye:'左目', righteye:'右目',
    leftshoulder:'左肩', rightshoulder:'右肩',
    leftupperarm:'左上腕', leftlowerarm:'左前腕', lefthand:'左手首',
    rightupperarm:'右上腕', rightlowerarm:'右前腕', righthand:'右手首',
    leftupperleg:'左太もも', leftlowerleg:'左すね', leftfoot:'左足首', lefttoes:'左つま先',
    rightupperleg:'右太もも', rightlowerleg:'右すね', rightfoot:'右足首', righttoes:'右つま先',
    leftthumbproximal:'左親指根', leftthumbintermediate:'左親指中', leftthumpdistal:'左親指先',
    leftindexproximal:'左人差指根', leftindexintermediate:'左人差指中', leftindexdistal:'左人差指先',
    leftmiddleproximal:'左中指根', leftmiddleintermediate:'左中指中', leftmiddledistal:'左中指先',
    leftringproximal:'左薬指根', leftringintermediate:'左薬指中', leftringdistal:'左薬指先',
    leftlittleproximal:'左小指根', leftlittleintermediate:'左小指中', leftlittledistal:'左小指先',
    rightthumbproximal:'右親指根', rightthumbintermediate:'右親指中', rightthumpdistal:'右親指先',
    rightindexproximal:'右人差指根', rightindexintermediate:'右人差指中', rightindexdistal:'右人差指先',
    rightmiddleproximal:'右中指根', rightmiddleintermediate:'右中指中', rightmiddledistal:'右中指先',
    rightringproximal:'右薬指根', rightringintermediate:'右薬指中', rightringdistal:'右薬指先',
    rightlittleproximal:'右小指根', rightlittleintermediate:'右小指中', rightlittledistal:'右小指先',
  };
  if (exact[norm]) return exact[norm];
  const isLeft  = /left/i.test(name);
  const isRight = /right/i.test(name);
  const side = isLeft ? '左' : isRight ? '右' : '';
  const parts = [
    [/thumb/i,'親指'],[/index/i,'人差指'],[/middle/i,'中指'],[/ring/i,'薬指'],[/little|pinky/i,'小指'],
    [/finger/i,'指'],[/proximal/i,'根'],[/intermediate/i,'中'],[/distal/i,'先'],
    [/shoulder/i,'肩'],[/upper.*arm|upperarm/i,'上腕'],[/lower.*arm|forearm|lowerarm/i,'前腕'],[/hand/i,'手首'],
    [/thigh|upper.*leg|upperleg/i,'太もも'],[/shin|calf|lower.*leg|lowerleg/i,'すね'],
    [/foot|ankle/i,'足首'],[/toe/i,'つま先'],[/upper.*chest|upperchest/i,'上胸'],[/chest/i,'胸'],
    [/spine/i,'背骨'],[/hips|pelvis/i,'腰'],[/neck/i,'首'],[/head/i,'頭'],[/jaw|chin/i,'あご'],
    [/eye/i,'目'],[/brow/i,'眉'],
  ];
  for (const [re, ja] of parts) if (re.test(name)) return side + ja;
  return name;
}

// ── add asset to scene (keeps existing objects) ───────────
async function addToScene(url, name) {
  setStatus('読み込み中...');
  try {
    const gltf = await loader.loadAsync(url);
    let root, vrm = null;

    if (gltf.userData.vrm) {
      vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      root = vrm.scene;
    } else {
      root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) root.scale.setScalar(2.0 / maxDim);
      root.position.x -= center.x * root.scale.x;
      root.position.y -= box.min.y * root.scale.y;
      root.position.z -= center.z * root.scale.z;
      if (sceneObjects.length > 0) root.position.x += sceneObjects.length * 0.5;
    }

    scene.add(root);

    // Skull sphere patch for base body (cf_face lacks back-of-head geometry)
    {
      let cfFace = null;
      root.traverse(obj => { if (obj.isMesh && obj.name === 'cf_face') cfFace = obj; });
      if (cfFace) {
        // Use world-space BB to avoid local coordinate axis confusion
        root.updateWorldMatrix(true, true);
        const worldBB = new THREE.Box3().setFromObject(cfFace);
        const ws = worldBB.getSize(new THREE.Vector3());
        const wc = worldBB.getCenter(new THREE.Vector3());

        cfFace.visible = false;

        const lr = ws.x * 0.50; // radius = half head width in world space
        const sm = [].concat(cfFace.material)[0];
        const skull = new THREE.Mesh(
          new THREE.SphereGeometry(lr, 32, 24),
          new THREE.MeshStandardMaterial({
            color: sm?.color?.clone() ?? new THREE.Color(0xffe0d0),
            roughness: sm?.roughness ?? 0.5,
            metalness: sm?.metalness ?? 0.0,
          })
        );
        skull.name = 'skull_sphere';

        // Place sphere center at back of head:
        // VRM faces +Z, so -Z is behind. Center at min.z + lr so sphere front ≈ face center.
        const sphereWorldPos = new THREE.Vector3(wc.x, wc.y, worldBB.min.z + lr);
        const parentInvMat = new THREE.Matrix4().copy(cfFace.parent.matrixWorld).invert();
        skull.position.copy(sphereWorldPos.applyMatrix4(parentInvMat));
        cfFace.parent.add(skull);
      }
    }

    const clips = gltf.animations || [];
    const objMixer = clips.length > 0 ? new THREE.AnimationMixer(root) : null;
    const id = Math.random().toString(36).slice(2);
    const sceneObj = { id, name: name || 'Object', root, vrm, mixer: objMixer, clips, currentAction: null };
    sceneObjects.push(sceneObj);

    selectObject(id);
    if (name) document.getElementById('model-name').textContent = name;
    document.getElementById('empty-hint').style.display = 'none';
    const typeLabel = vrm ? 'VRM' : 'GLB';
    const animLabel = clips.length > 0 ? ` / アニメ ${clips.length}件` : '';
    setStatus(typeLabel + animLabel);
    setTimeout(() => setStatus(''), 3000);
    return sceneObj;
  } catch (e) {
    const errMsg = e?.message || String(e);
    setStatus(`読み込みエラー (${name}): ${errMsg}`, true);
    console.error('[addToScene]', name, e);
    return null;
  }
}

// ── load main model (clears scene + loads one) ────────────
async function loadMainModel(url, name) {
  document.getElementById('model-name').textContent = '';
  clearAllObjects();
  const obj = await addToScene(url, name);
  if (obj) {
    // Ensure object is selected and panels are built
    if (!selectedId && sceneObjects.length > 0) selectObject(sceneObjects[0].id);
    focusFace();
    buildAllPanels();
  }
}

const loadModel = loadMainModel;

// ── focus face ────────────────────────────────────────────
function focusFace() {
  if (!currentRoot) return;
  requestAnimationFrame(() => {
    let headPos = new THREE.Vector3();
    let found = false;
    if (currentVrm?.humanoid) {
      const headNode = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.Head);
      if (headNode) { headNode.getWorldPosition(headPos); found = true; }
    }
    if (!found) {
      const box = new THREE.Box3().setFromObject(currentRoot);
      const size = box.getSize(new THREE.Vector3());
      headPos.set((box.min.x + box.max.x) / 2, box.max.y - size.y * 0.1, (box.min.z + box.max.z) / 2);
    }
    // Use current camera horizontal direction but reset distance
    const camDir = new THREE.Vector3().subVectors(camera.position, orbitCtrl.target).normalize();
    camDir.y = 0; if (camDir.lengthSq() < 0.01) camDir.set(0, 0, 1);
    camDir.normalize().multiplyScalar(0.45);
    orbitCtrl.target.copy(headPos);
    camera.position.set(headPos.x + camDir.x, headPos.y, headPos.z + camDir.z);
    orbitCtrl.update();
  });
}

// ── VRM material categorizer ──────────────────────────────
function categorizeVRMMaterials() {
  const cats = { skin:[], hair:[], eyes:[], brows:[], body:[], tops:[], bottoms:[], shoes:[], other:[] };
  if (!currentRoot) return cats;
  const seen = new Set();
  currentRoot.traverse(obj => {
    if (!obj.isMesh) return;
    [].concat(obj.material || []).forEach(m => {
      if (!m || seen.has(m.uuid)) return;
      seen.add(m.uuid);
      const n = m.name || '';
      if      (/eyebrow|eyelash|brow(?!n)|EyelashAndBrows/i.test(n))                   cats.brows.push(m);
      else if (/eyeiris|iris|pupil|eyewhite|sclera|EyeHighlight|Eye(?!lash|brow)/i.test(n)) cats.eyes.push(m);
      else if (/hair/i.test(n))                                                          cats.hair.push(m);
      else if (/FaceHead|Face(?!lash)|Cheek|Forehead|face(?!lash)/i.test(n))           cats.skin.push(m);
      else if (/body(?!ttom)|Skin(?!ny)/i.test(n) && !/hair|eye/i.test(n))            cats.body.push(m);
      else if (/tops?|shirt|jacket|blouse|coat|Wear|Clothes/i.test(n))                 cats.tops.push(m);
      else if (/bottoms?|pant|skirt|trouser/i.test(n))                                 cats.bottoms.push(m);
      else if (/shoes?|boot|sock|stocking/i.test(n))                                   cats.shoes.push(m);
      else                                                                               cats.other.push(m);
    });
  });
  return cats;
}

// ── VRM morph target categorizer ─────────────────────────
function categorizeVRMMorphs() {
  const cats = { face:[], eyes:[], brows:[], nose:[], mouth:[], body:[], other:[] };
  if (!currentRoot) return cats;
  const morphMap = {};
  currentRoot.traverse(obj => {
    if (!obj.isMesh || !obj.morphTargetDictionary) return;
    Object.entries(obj.morphTargetDictionary).forEach(([name, idx]) => {
      if (!morphMap[name]) morphMap[name] = [];
      morphMap[name].push({ mesh: obj, idx });
    });
  });
  for (const [name, targets] of Object.entries(morphMap)) {
    const entry = { name, targets };
    if      (/eye|pupil|iris|eyelid/i.test(name) && !/brow|lash/i.test(name)) cats.eyes.push(entry);
    else if (/brow|eyebrow|eyelash|lash/i.test(name))                          cats.brows.push(entry);
    else if (/nos(?:e|al)/i.test(name))                                        cats.nose.push(entry);
    else if (/mouth|lip|mth|jaw(?!bone)/i.test(name))                         cats.mouth.push(entry);
    else if (/face|cheek|chin|ear|temple|forehead|head/i.test(name) && !/eye|nose|mouth/i.test(name)) cats.face.push(entry);
    else if (/body|bust|breast|waist|hip|arm|leg|torso|shoulder/i.test(name)) cats.body.push(entry);
    else                                                                        cats.other.push(entry);
  }
  return cats;
}

// ── Format morph name for display ────────────────────────
function formatMorphName(name) {
  return name
    .replace(/^FCL_|^Fcl_/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

// ── Material color helpers (sRGB-aware) ──────────────────
function matColorHex(mat) {
  if (!mat?.color) return '#ffffff';
  try { return '#' + mat.color.getHexString(THREE.SRGBColorSpace); }
  catch { return '#' + mat.color.getHexString(); }
}

function setMatColor(mat, hexFromPicker) {
  if (!mat?.color) return;
  try { mat.color.setStyle(hexFromPicker, THREE.SRGBColorSpace); }
  catch { mat.color.set(hexFromPicker); }
}

// MToon Color オブジェクト（shadeColorFactor 等）用ヘルパー
function isMToon(mat) {
  return !!(mat?.isMToonMaterial || mat?.uniforms?.shadeColorFactor);
}
function colorObjHex(c) {
  if (!c) return '#000000';
  // MToonMaterial uses plain arrays [r,g,b,a] for color factors
  if (Array.isArray(c)) {
    const r = Math.round((c[0] || 0) * 255).toString(16).padStart(2,'0');
    const g = Math.round((c[1] || 0) * 255).toString(16).padStart(2,'0');
    const b = Math.round((c[2] || 0) * 255).toString(16).padStart(2,'0');
    return '#' + r + g + b;
  }
  try { return '#' + c.getHexString(THREE.SRGBColorSpace); }
  catch { return '#' + c.getHexString(); }
}
function setColorObj(c, hex) {
  if (!c) return;
  if (Array.isArray(c)) {
    const col = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
    c[0] = col.r; c[1] = col.g; c[2] = col.b;
    return;
  }
  try { c.setStyle(hex, THREE.SRGBColorSpace); }
  catch { c.set(hex); }
}

// MToon フルパラメーターセクションをまとめて body に追加
function _appendMToonParams(mat, body, { shade=true, rim=false, shading=true, outline=true } = {}) {
  if (!mat) return;

  // カラーセクション
  const colorSec = makeSection('カラー');
  let colorAdded = 0;
  if (mat.color) {
    const orig = matColorHex(mat);
    colorSec.appendChild(makeColorRow('ベースカラー', mat.name, orig,
      v => setMatColor(mat, v), () => setMatColor(mat, orig)));
    colorAdded++;
  }
  if (shade && isMToon(mat) && mat.shadeColorFactor) {
    const orig = colorObjHex(mat.shadeColorFactor);
    colorSec.appendChild(makeColorRow('影色', mat.name + '_shade', orig,
      v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
    colorAdded++;
  }
  if (rim && isMToon(mat) && mat.parametricRimColorFactor) {
    const orig = colorObjHex(mat.parametricRimColorFactor);
    colorSec.appendChild(makeColorRow('リムカラー', mat.name + '_rim', orig,
      v => setColorObj(mat.parametricRimColorFactor, v), () => setColorObj(mat.parametricRimColorFactor, orig)));
    colorAdded++;
  }
  if (colorAdded > 0) body.appendChild(colorSec);

  // シェーディングセクション
  if (shading && isMToon(mat)) {
    const shadSec = makeSection('シェーディング');
    let shadAdded = 0;
    if (mat.shadingToonyFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の硬さ', 0, 1, mat.shadingToonyFactor, 0.01,
        v => { mat.shadingToonyFactor = v; }));
      shadAdded++;
    }
    if (mat.shadingShiftFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の範囲', -1, 1, mat.shadingShiftFactor, 0.01,
        v => { mat.shadingShiftFactor = v; }));
      shadAdded++;
    }
    if (shadAdded > 0) body.appendChild(shadSec);
  }

  // アウトラインセクション
  if (outline && isMToon(mat)) {
    const outSec = makeSection('アウトライン');
    let outAdded = 0;
    if (mat.outlineWidthFactor !== undefined) {
      outSec.appendChild(makeSlider('太さ', 0, 0.05, mat.outlineWidthFactor, 0.001,
        v => { mat.outlineWidthFactor = v; }));
      outAdded++;
    }
    if (mat.outlineColorFactor) {
      const orig = colorObjHex(mat.outlineColorFactor);
      outSec.appendChild(makeColorRow('色', mat.name + '_outline', orig,
        v => setColorObj(mat.outlineColorFactor, v), () => setColorObj(mat.outlineColorFactor, orig)));
      outAdded++;
    }
    if (outAdded > 0) body.appendChild(outSec);
  }
}

// ── Category state ────────────────────────────────────────
let _currentCat  = 'face';
let _currentItem = null;

const FACE_ITEMS = [
  { id:'outline', label:'顔の輪郭', icon:'○',  desc:'輪郭・フェイスライン' },
  { id:'eyes',    label:'目',       icon:'◎',  desc:'目の形・サイズ' },
  { id:'brows',   label:'眉毛',     icon:'—',  desc:'眉の形・色' },
  { id:'lash',    label:'まつ毛',   icon:'∿',  desc:'まつ毛の色・アウトライン' },
  { id:'nose',    label:'鼻',       icon:'△',  desc:'鼻の形・高さ' },
  { id:'mouth',   label:'口',       icon:'∪',  desc:'口・唇の形' },
  { id:'skin',    label:'肌色',     icon:'●',  desc:'肌・顔の色調' },
  { id:'makeup',  label:'メイク',   icon:'♥',  desc:'アイシャドウ・チーク・リップ' },
  { id:'lookat',  label:'視線',     icon:'◎',  desc:'目の追従・視線設定' },
];

const BODY_ITEMS = [
  { id:'proportion', label:'プロポーション', icon:'↕', desc:'身長・体型' },
  { id:'shape',      label:'ボディシェイプ', icon:'⬡', desc:'体型モーフ' },
  { id:'skin',       label:'肌色',           icon:'●', desc:'肌マテリアル' },
  { id:'nail',       label:'ネイル',         icon:'♦', desc:'爪の色・マテリアル' },
  { id:'render',     label:'レンダリング',   icon:'☀', desc:'光・明るさ' },
];

const OUTFIT_ITEMS = [
  { id:'tops',    label:'トップス',  icon:'▣', desc:'シャツ・ジャケット' },
  { id:'bottoms', label:'ボトムス',  icon:'▤', desc:'パンツ・スカート' },
  { id:'shoes',   label:'靴・靴下',  icon:'▬', desc:'靴・ソックス' },
  { id:'other',   label:'その他',    icon:'◈', desc:'アクセサリー等' },
];

function _getItemsBody()  { return document.getElementById('items-panel-body'); }
function _getParamsBody() { return document.getElementById('params-panel-body'); }
function _setItemsTitle(t)  { const el = document.getElementById('items-panel-title'); if (el) el.textContent = t; }
function _setParamsTitle(t) { const el = document.getElementById('params-panel-title'); if (el) el.textContent = t; }

function _clearParams(msg) {
  const b = _getParamsBody(); if (!b) return;
  b.innerHTML = msg ? `<p class="no-data">${msg}</p>` : '';
  _setParamsTitle('パラメーター');
}

function buildAllPanels() {
  _buildItemsPanel();
}

function _buildItemsPanel() {
  const body = _getItemsBody(); if (!body) return;
  body.innerHTML = '';
  switch (_currentCat) {
    case 'face':   _buildFaceItems(body);   break;
    case 'hair':   _buildHairItems(body);   break;
    case 'body':   _buildBodyItems(body);   break;
    case 'outfit': _buildOutfitItems(body); break;
    case 'expr':    _buildExprItems(body);    break;
    case 'pose':    _buildPoseItems(body);    break;
    case 'anim':    _buildAnimItems(body);    break;
    case 'scene':   _buildSceneItems(body);   break;
    case 'physics': _buildPhysicsItems(body); break;
  }
}

// ── Item card grid helper ─────────────────────────────────
function _makeItemGrid(items, body, onSelect) {
  const grid = document.createElement('div');
  grid.className = 'items-grid';
  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'item-card' + (_currentItem === item.id ? ' selected' : '');
    card.innerHTML = `<span class="item-card-icon">${item.icon}</span><span class="item-card-label">${item.label}</span><span class="item-card-desc">${item.desc}</span>`;
    card.addEventListener('click', () => {
      _currentItem = item.id;
      grid.querySelectorAll('.item-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      _setParamsTitle(item.label);
      onSelect(item);
    });
    grid.appendChild(card);
  });
  body.appendChild(grid);
  // auto-select
  const autoId = items.find(i => i.id === _currentItem) ? _currentItem : items[0]?.id;
  if (autoId) {
    const idx = items.findIndex(i => i.id === autoId);
    const card = grid.children[idx];
    if (card) {
      _currentItem = autoId;
      card.classList.add('selected');
      _setParamsTitle(items[idx].label);
      onSelect(items[idx]);
    }
  }
}

// ── FACE items + params ───────────────────────────────────
function _buildFaceItems(body) {
  if (!currentRoot) { body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>'; return; }
  _makeItemGrid(FACE_ITEMS, body, item => _buildFaceParams(item.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// EYE COLOR PRESETS (100 colors, 10 categories)
// ─────────────────────────────────────────────────────────────────────────────
const EYE_COLOR_PRESETS = [
  // ダークブラウン系
  { label:'漆黒の瞳',       color:'#0a0806', shade:'#060402', cat:'ダークブラウン' },
  { label:'黒茶',           color:'#1a0f08', shade:'#0d0804', cat:'ダークブラウン' },
  { label:'ダークチョコ',   color:'#241008', shade:'#150a04', cat:'ダークブラウン' },
  { label:'エスプレッソ',   color:'#2a1505', shade:'#180d02', cat:'ダークブラウン' },
  { label:'ダークブラウン', color:'#3d1f08', shade:'#201004', cat:'ダークブラウン' },
  { label:'コーヒー',       color:'#3a1a08', shade:'#1e0d04', cat:'ダークブラウン' },
  { label:'マホガニー',     color:'#5a1e10', shade:'#2e0f08', cat:'ダークブラウン' },
  { label:'ウォールナット', color:'#4a2010', shade:'#251008', cat:'ダークブラウン' },
  { label:'チョコ',         color:'#4d2010', shade:'#280d08', cat:'ダークブラウン' },
  { label:'セピア',         color:'#4a2c10', shade:'#251408', cat:'ダークブラウン' },
  // ブラウン系
  { label:'ブラウン',         color:'#6a3518', shade:'#3a1a0a', cat:'ブラウン' },
  { label:'ミルクチョコ',     color:'#7a4020', shade:'#402010', cat:'ブラウン' },
  { label:'カフェオレ',       color:'#8a5028', shade:'#502818', cat:'ブラウン' },
  { label:'ライトブラウン',   color:'#9a6030', shade:'#602818', cat:'ブラウン' },
  { label:'タン',             color:'#a87040', shade:'#684020', cat:'ブラウン' },
  { label:'ヘーゼル',         color:'#8a6030', shade:'#503018', cat:'ブラウン' },
  { label:'ウォームブラウン', color:'#7a4828', shade:'#402418', cat:'ブラウン' },
  { label:'チェスナット',     color:'#6a2818', shade:'#381408', cat:'ブラウン' },
  { label:'コパー',           color:'#a05030', shade:'#682818', cat:'ブラウン' },
  { label:'ハニー',           color:'#c07828', shade:'#804018', cat:'ブラウン' },
  // アンバー・ゴールド系
  { label:'アンバー',         color:'#c88020', shade:'#885018', cat:'アンバー・ゴールド' },
  { label:'ゴールデン',       color:'#d09820', shade:'#906018', cat:'アンバー・ゴールド' },
  { label:'ハニーゴールド',   color:'#d4a828', shade:'#946818', cat:'アンバー・ゴールド' },
  { label:'トパーズ',         color:'#d8a030', shade:'#986018', cat:'アンバー・ゴールド' },
  { label:'サンフラワー',     color:'#e0c020', shade:'#a08010', cat:'アンバー・ゴールド' },
  { label:'ライトアンバー',   color:'#d8b858', shade:'#987828', cat:'アンバー・ゴールド' },
  { label:'ゴールド',         color:'#d4af37', shade:'#9a7810', cat:'アンバー・ゴールド' },
  { label:'カーキ',           color:'#a09020', shade:'#706010', cat:'アンバー・ゴールド' },
  { label:'オークル',         color:'#b88840', shade:'#786020', cat:'アンバー・ゴールド' },
  { label:'ジャスパー',       color:'#b86830', shade:'#783818', cat:'アンバー・ゴールド' },
  // ブルー系
  { label:'ネイビー',           color:'#102050', shade:'#080f28', cat:'ブルー' },
  { label:'ミッドナイトブルー', color:'#101840', shade:'#080d20', cat:'ブルー' },
  { label:'ロイヤルブルー',     color:'#1a4090', shade:'#0c2050', cat:'ブルー' },
  { label:'コバルト',           color:'#1858c8', shade:'#0c2878', cat:'ブルー' },
  { label:'セルリアン',         color:'#2878c8', shade:'#104880', cat:'ブルー' },
  { label:'デルフト',           color:'#3060a0', shade:'#183060', cat:'ブルー' },
  { label:'スカイブルー',       color:'#4090d0', shade:'#205880', cat:'ブルー' },
  { label:'コーンフラワー',     color:'#6090c8', shade:'#305888', cat:'ブルー' },
  { label:'ライトブルー',       color:'#60a0d0', shade:'#305878', cat:'ブルー' },
  { label:'アイスブルー',       color:'#90c0e0', shade:'#507090', cat:'ブルー' },
  { label:'ペールブルー',       color:'#a0c8e8', shade:'#6088a0', cat:'ブルー' },
  { label:'ペリウィンクル',     color:'#8090c8', shade:'#405080', cat:'ブルー' },
  // グリーン系
  { label:'フォレスト',       color:'#1a5020', shade:'#0c2810', cat:'グリーン' },
  { label:'エメラルド',       color:'#1a7040', shade:'#0a3820', cat:'グリーン' },
  { label:'ハンター',         color:'#2a5028', shade:'#142814', cat:'グリーン' },
  { label:'ジェード',         color:'#388060', shade:'#184030', cat:'グリーン' },
  { label:'オリーブ',         color:'#687820', shade:'#384010', cat:'グリーン' },
  { label:'ミント',           color:'#50b880', shade:'#286840', cat:'グリーン' },
  { label:'ティール',         color:'#208080', shade:'#0a5050', cat:'グリーン' },
  { label:'ターコイズ',       color:'#20a8a0', shade:'#0a6060', cat:'グリーン' },
  { label:'セージ',           color:'#709870', shade:'#405040', cat:'グリーン' },
  { label:'アップルグリーン', color:'#78c040', shade:'#487820', cat:'グリーン' },
  // グレー系
  { label:'ダークグレー',   color:'#282830', shade:'#101018', cat:'グレー' },
  { label:'チャコール',     color:'#303040', shade:'#181828', cat:'グレー' },
  { label:'スレート',       color:'#506070', shade:'#283040', cat:'グレー' },
  { label:'スチール',       color:'#607080', shade:'#384050', cat:'グレー' },
  { label:'アッシュ',       color:'#808090', shade:'#505060', cat:'グレー' },
  { label:'シルバーグレー', color:'#9898a8', shade:'#686878', cat:'グレー' },
  { label:'ライトグレー',   color:'#b8b8c8', shade:'#888898', cat:'グレー' },
  { label:'シルバー',       color:'#c8c8d8', shade:'#909098', cat:'グレー' },
  // パープル系
  { label:'ダークバイオレット', color:'#3a1050', shade:'#1e0828', cat:'パープル' },
  { label:'パープル',           color:'#6030a0', shade:'#301858', cat:'パープル' },
  { label:'バイオレット',       color:'#7040b0', shade:'#382060', cat:'パープル' },
  { label:'アメジスト',         color:'#7850b8', shade:'#402870', cat:'パープル' },
  { label:'ラベンダー',         color:'#a080c8', shade:'#604880', cat:'パープル' },
  { label:'リラック',           color:'#b898d8', shade:'#706098', cat:'パープル' },
  { label:'プラム',             color:'#6a2068', shade:'#381038', cat:'パープル' },
  { label:'オーキッド',         color:'#a050a8', shade:'#602060', cat:'パープル' },
  // レッド・ピンク系
  { label:'ブラッドレッド', color:'#8a0c0c', shade:'#480606', cat:'レッド・ピンク' },
  { label:'ルビー',         color:'#9b0028', shade:'#500014', cat:'レッド・ピンク' },
  { label:'スカーレット',   color:'#c01818', shade:'#700808', cat:'レッド・ピンク' },
  { label:'クリムゾン',     color:'#a80028', shade:'#580010', cat:'レッド・ピンク' },
  { label:'ローズ',         color:'#c02858', shade:'#700a28', cat:'レッド・ピンク' },
  { label:'ホットピンク',   color:'#d04888', shade:'#882048', cat:'レッド・ピンク' },
  { label:'マゼンタ',       color:'#b02088', shade:'#601048', cat:'レッド・ピンク' },
  { label:'ピンク',         color:'#d878a0', shade:'#904060', cat:'レッド・ピンク' },
  // アニメ系 (ビビッド)
  { label:'エレクトリックブルー', color:'#1060f8', shade:'#0838b0', cat:'アニメ' },
  { label:'ネオンパープル',       color:'#a020e0', shade:'#5808a0', cat:'アニメ' },
  { label:'ネオングリーン',       color:'#20e050', shade:'#10a030', cat:'アニメ' },
  { label:'ホットマゼンタ',       color:'#f020a8', shade:'#a00870', cat:'アニメ' },
  { label:'アクアマリン',         color:'#20d0c0', shade:'#108080', cat:'アニメ' },
  { label:'ゴールドイエロー',     color:'#f0c800', shade:'#a08000', cat:'アニメ' },
  { label:'フレームオレンジ',     color:'#f06020', shade:'#b03810', cat:'アニメ' },
  { label:'ビビッドシアン',       color:'#00d8f0', shade:'#008898', cat:'アニメ' },
  { label:'ネオンピンク',         color:'#f050c0', shade:'#a02880', cat:'アニメ' },
  { label:'ビビッドバイオレット', color:'#8800ff', shade:'#4400a0', cat:'アニメ' },
  { label:'エメラルドグリーン',   color:'#00c868', shade:'#008040', cat:'アニメ' },
  { label:'サンセットオレンジ',   color:'#e85020', shade:'#a02e0a', cat:'アニメ' },
  // ファンタジー系
  { label:'銀狼の瞳',   color:'#c0c8d8', shade:'#7880a0', cat:'ファンタジー' },
  { label:'黄金の瞳',   color:'#e8c030', shade:'#b07800', cat:'ファンタジー' },
  { label:'深淵',       color:'#08080f', shade:'#040408', cat:'ファンタジー' },
  { label:'妖精の瞳',   color:'#50f8a0', shade:'#20b060', cat:'ファンタジー' },
  { label:'炎の瞳',     color:'#f83000', shade:'#b01000', cat:'ファンタジー' },
  { label:'氷の瞳',     color:'#a0e8f8', shade:'#60a0b8', cat:'ファンタジー' },
  { label:'雷の瞳',     color:'#f8f040', shade:'#c0a800', cat:'ファンタジー' },
  { label:'月光の瞳',   color:'#d0d8f8', shade:'#8090c0', cat:'ファンタジー' },
  { label:'宵闇の瞳',   color:'#200830', shade:'#100418', cat:'ファンタジー' },
  { label:'血瞳',       color:'#cc0808', shade:'#800000', cat:'ファンタジー' },
];

// ─────────────────────────────────────────────────────────────────────────────
// EYE SHAPE PRESETS (100 presets, morph-name pattern matching)
// Keys in `morphs` are matched case-insensitively (exact first, then substring).
// ─────────────────────────────────────────────────────────────────────────────
const EYE_SHAPE_PRESETS = [
  // ── ナチュラル系 (15) ──────────────────────────────────────────────────────
  { label:'ナチュラル',   cat:'ナチュラル', morphs:{ natural:1, eye_natural:1, 'fcl_eye_natural':1 } },
  { label:'ソフト',       cat:'ナチュラル', morphs:{ soft:0.8, gentle:0.8, eye_soft:0.8 } },
  { label:'スタンダード', cat:'ナチュラル', morphs:{ standard:1, default:1, eye_default:1, normal:1 } },
  { label:'ベーシック',   cat:'ナチュラル', morphs:{ basic:1, plain:1 } },
  { label:'リアル',       cat:'ナチュラル', morphs:{ real:1, realistic:1, eye_real:1 } },
  { label:'マイルド',     cat:'ナチュラル', morphs:{ mild:0.7, soft:0.5, eye_mild:0.7 } },
  { label:'フレッシュ',   cat:'ナチュラル', morphs:{ fresh:0.8, eye_fresh:0.8, young:0.5 } },
  { label:'ピュア',       cat:'ナチュラル', morphs:{ pure:1, eye_pure:1, innocent:0.8 } },
  { label:'スウィート',   cat:'ナチュラル', morphs:{ sweet:0.8, eye_sweet:0.8 } },
  { label:'フェミニン',   cat:'ナチュラル', morphs:{ feminine:1, eye_feminine:1, girl:0.6 } },
  { label:'ライト',       cat:'ナチュラル', morphs:{ light:0.7, eye_light:0.7, open:0.4 } },
  { label:'ノーマル丸め', cat:'ナチュラル', morphs:{ round:0.4, eye_round:0.4, 'eye_circle':0.4 } },
  { label:'穏やか',       cat:'ナチュラル', morphs:{ calm:0.8, relax:0.5, relaxed:0.5, eye_calm:0.8 } },
  { label:'優しい',       cat:'ナチュラル', morphs:{ kind:0.8, gentle:0.7, warm:0.6, eye_kind:0.8 } },
  { label:'オーソドックス', cat:'ナチュラル', morphs:{ orthodox:1, classic:1, eye_classic:1 } },
  // ── タレ目系 (15) ─────────────────────────────────────────────────────────
  { label:'タレ目',         cat:'タレ目', morphs:{ tareme:1, tare:1, eye_tare:1, droop:1, 'eye_down':0.4 } },
  { label:'ソフトタレ目',   cat:'タレ目', morphs:{ tareme:0.6, tare:0.6, soft_tare:0.6, 'eye_down':0.2 } },
  { label:'タレ目大',       cat:'タレ目', morphs:{ tareme:1, tare:1, 'eye_tare_l':1, big_tare:1 } },
  { label:'ハーフタレ目',   cat:'タレ目', morphs:{ tareme:0.5, tare:0.5, half_tare:0.5 } },
  { label:'たれ垂れ',       cat:'タレ目', morphs:{ tareme:0.8, tare:0.8, 'sag':0.5 } },
  { label:'ぱっちりタレ',   cat:'タレ目', morphs:{ tareme:0.7, wide:0.4, big:0.3, pachiri_tare:0.7 } },
  { label:'眠たげタレ',     cat:'タレ目', morphs:{ tareme:0.8, sleepy:0.4, drowsy:0.4, 'eye_down':0.3 } },
  { label:'猫タレ目',       cat:'タレ目', morphs:{ tareme:0.9, cat_tare:0.9, neko_tare:0.9 } },
  { label:'たれ目ウィンク', cat:'タレ目', morphs:{ tareme:1, wink:0.3, tare_wink:1 } },
  { label:'ピュアタレ目',   cat:'タレ目', morphs:{ tareme:1, pure:0.4, innocent:0.3 } },
  { label:'デカタレ目',     cat:'タレ目', morphs:{ tareme:1, big:0.5, large:0.5, 'eye_big':0.4 } },
  { label:'ロリタレ目',     cat:'タレ目', morphs:{ tareme:1, loli:1, child:0.5, childlike:0.5 } },
  { label:'泣きタレ目',     cat:'タレ目', morphs:{ tareme:0.9, sad:0.4, sorrow:0.4, cry:0.3 } },
  { label:'アニメタレ目',   cat:'タレ目', morphs:{ tareme:1, anime:0.5, anime_tare:1 } },
  { label:'オーバータレ目', cat:'タレ目', morphs:{ tareme:1, over_tare:1, extreme_tare:1, droop:0.8 } },
  // ── ツリ目系 (15) ─────────────────────────────────────────────────────────
  { label:'ツリ目',         cat:'ツリ目', morphs:{ tsurime:1, tsuri:1, eye_tsuri:1, 'eye_up':0.4, sharp:0.5 } },
  { label:'ソフトツリ目',   cat:'ツリ目', morphs:{ tsurime:0.6, tsuri:0.6, soft_tsuri:0.6 } },
  { label:'ツリ目大',       cat:'ツリ目', morphs:{ tsurime:1, tsuri:1, big_tsuri:1 } },
  { label:'クールツリ目',   cat:'ツリ目', morphs:{ tsurime:0.8, cool:0.5, cold:0.4 } },
  { label:'カッコイイ目',   cat:'ツリ目', morphs:{ tsurime:0.7, cool:0.6, kakkoii:0.7 } },
  { label:'猫ツリ目',       cat:'ツリ目', morphs:{ tsurime:0.9, cat:0.7, neko:0.7 } },
  { label:'キツ目',         cat:'ツリ目', morphs:{ tsurime:1, strict:0.6, stern:0.5, sharp:0.7 } },
  { label:'細ツリ目',       cat:'ツリ目', morphs:{ tsurime:0.8, narrow:0.5, thin:0.4 } },
  { label:'気強ツリ目',     cat:'ツリ目', morphs:{ tsurime:1, strong:0.5, angry:0.3, fierce:0.5 } },
  { label:'ワイルドツリ目', cat:'ツリ目', morphs:{ tsurime:1, wild:0.6, fierce:0.5 } },
  { label:'鋭い目',         cat:'ツリ目', morphs:{ tsurime:1, sharp:0.8, keen:0.6, eye_sharp:1 } },
  { label:'ボーイッシュ',   cat:'ツリ目', morphs:{ tsurime:0.7, boyish:0.7, boy:0.5 } },
  { label:'ヤンデレ目',     cat:'ツリ目', morphs:{ tsurime:0.8, yandere:0.8, obsessed:0.5 } },
  { label:'チャラ目',       cat:'ツリ目', morphs:{ tsurime:0.6, playful:0.4, chara:0.6 } },
  { label:'オーバーツリ目', cat:'ツリ目', morphs:{ tsurime:1, extreme_tsuri:1, over_tsuri:1 } },
  // ── 大きめ系 (10) ─────────────────────────────────────────────────────────
  { label:'ぱっちり大きい', cat:'大きめ', morphs:{ big:1, large:1, 'eye_big':1, wide:0.6, pachiri:1 } },
  { label:'ビッグアイ',     cat:'大きめ', morphs:{ big:1, 'eye_big':1, 'eye_large':1, 'big_eye':1 } },
  { label:'丸大目',         cat:'大きめ', morphs:{ big:0.8, round:0.8, round_big:0.8 } },
  { label:'超ぱっちり',     cat:'大きめ', morphs:{ big:1, pachiri:1, super_big:1, huge:0.8 } },
  { label:'デカ目',         cat:'大きめ', morphs:{ big:1, large:1, deka:1, huge:0.7 } },
  { label:'お目々',         cat:'大きめ', morphs:{ big:0.9, cute:0.5, chibi:0.4, omeme:0.9 } },
  { label:'ワイドアイ',     cat:'大きめ', morphs:{ wide:1, big:0.6, wide_eye:1, 'eye_wide':1 } },
  { label:'タヌキ目',       cat:'大きめ', morphs:{ big:0.9, round:0.9, tanuki:0.9, raccoon:0.6 } },
  { label:'サブカル目',     cat:'大きめ', morphs:{ big:0.8, anime:0.6, subculture:0.8 } },
  { label:'まんまる',       cat:'大きめ', morphs:{ round:1, big:0.7, circle:0.8, manmaru:1 } },
  // ── 細め・眠そう系 (10) ───────────────────────────────────────────────────
  { label:'眠そう',         cat:'細め・眠そう', morphs:{ sleepy:1, drowsy:1, tired:0.7, 'eye_sleepy':1, blink:0.4 } },
  { label:'半眼',           cat:'細め・眠そう', morphs:{ half:0.5, half_close:0.5, blink:0.5, sleepy:0.5 } },
  { label:'細目',           cat:'細め・眠そう', morphs:{ narrow:1, thin:0.8, 'eye_narrow':1, slit:0.6 } },
  { label:'とろ目',         cat:'細め・眠そう', morphs:{ drowsy:0.9, lazy:0.6, toro:0.9, relaxed:0.5 } },
  { label:'気だるい目',     cat:'細め・眠そう', morphs:{ tired:0.8, lazy:0.7, languid:0.8 } },
  { label:'ダルそう',       cat:'細め・眠そう', morphs:{ tired:1, bored:0.7, sleepy:0.5, dull:0.7 } },
  { label:'眠り目',         cat:'細め・眠そう', morphs:{ sleep:0.6, blink:0.5, sleeping:0.6 } },
  { label:'細りたれ目',     cat:'細め・眠そう', morphs:{ narrow:0.6, tareme:0.6, thin_tare:0.6 } },
  { label:'ぼんやり',       cat:'細め・眠そう', morphs:{ blank:0.5, dreamy:0.5, vague:0.5, drowsy:0.4 } },
  { label:'うとうと',       cat:'細め・眠そう', morphs:{ sleepy:0.8, blink:0.6, drowsy:0.6, doze:0.8 } },
  // ── 感情・表情系 (10) ─────────────────────────────────────────────────────
  { label:'にこにこ',       cat:'感情・表情', morphs:{ happy:0.7, smile:0.6, joy:0.6, niko:0.7 } },
  { label:'怒り目',         cat:'感情・表情', morphs:{ angry:0.8, anger:0.8, mad:0.7, fierce:0.5 } },
  { label:'驚き目',         cat:'感情・表情', morphs:{ surprised:1, wide:0.7, shock:0.8, surprise:1 } },
  { label:'悲しい目',       cat:'感情・表情', morphs:{ sad:0.8, sorrow:0.8, cry:0.5, grief:0.6 } },
  { label:'泣き目',         cat:'感情・表情', morphs:{ cry:0.8, tear:0.5, sad:0.6, weep:0.7 } },
  { label:'恥ずかし目',     cat:'感情・表情', morphs:{ shy:0.8, embarrassed:0.8, blush:0.4 } },
  { label:'嬉しい目',       cat:'感情・表情', morphs:{ happy:1, joy:0.9, glad:0.8, delight:0.7 } },
  { label:'不満目',         cat:'感情・表情', morphs:{ dissatisfied:0.8, pout:0.6, sulk:0.7, displeased:0.8 } },
  { label:'ふにゃ目',       cat:'感情・表情', morphs:{ funya:0.9, relax:0.6, droopy:0.5 } },
  { label:'キリッ',         cat:'感情・表情', morphs:{ serious:0.9, focused:0.8, kiri:0.9, determined:0.7 } },
  // ── キャラクター系 (15) ───────────────────────────────────────────────────
  { label:'ロリータ',         cat:'キャラクター', morphs:{ loli:1, lolita:1, child:0.6, big:0.5, round:0.5 } },
  { label:'ギャル',           cat:'キャラクター', morphs:{ gyaru:1, gal:1, flashy:0.6, big:0.4 } },
  { label:'クーデレ',         cat:'キャラクター', morphs:{ cool:0.9, cold:0.8, kuudere:0.9, expressionless:0.5 } },
  { label:'ヤンデレ',         cat:'キャラクター', morphs:{ yandere:1, obsessed:0.7, insane:0.4, mad:0.3 } },
  { label:'ツンデレ',         cat:'キャラクター', morphs:{ tsundere:1, tsun:0.8, sharp:0.4, tareme:0.3 } },
  { label:'天然',             cat:'キャラクター', morphs:{ natural:0.6, airhead:0.7, dreamy:0.5, open:0.3 } },
  { label:'悪役目',           cat:'キャラクター', morphs:{ villain:0.9, evil:0.8, sly:0.6, narrow:0.4 } },
  { label:'勇者目',           cat:'キャラクター', morphs:{ hero:0.9, brave:0.8, strong:0.5, wide:0.3 } },
  { label:'魔女目',           cat:'キャラクター', morphs:{ witch:0.9, magic:0.6, narrow:0.5, sly:0.5 } },
  { label:'戦士目',           cat:'キャラクター', morphs:{ warrior:0.9, battle:0.7, fierce:0.6 } },
  { label:'お嬢様目',         cat:'キャラクター', morphs:{ elegant:0.9, noble:0.8, lady:0.8, grace:0.6 } },
  { label:'ニート目',         cat:'キャラクター', morphs:{ tired:0.7, sleepy:0.5, lazy:0.8, indoors:0.5 } },
  { label:'吸血鬼目',         cat:'キャラクター', morphs:{ vampire:1, elegant:0.5, sharp:0.4 } },
  { label:'サイボーグ目',     cat:'キャラクター', morphs:{ cyborg:1, mechanical:0.7, robotic:0.6, cold:0.4 } },
  { label:'神様目',           cat:'キャラクター', morphs:{ divine:1, god:0.9, holy:0.7, wide:0.4 } },
  // ── ファンタジー系 (10) ───────────────────────────────────────────────────
  { label:'竜眼',         cat:'ファンタジー', morphs:{ dragon:1, beast:0.7, narrow:0.5, slit:0.7 } },
  { label:'猫目',         cat:'ファンタジー', morphs:{ cat:1, neko:1, slit:0.8, catlike:1 } },
  { label:'狐目',         cat:'ファンタジー', morphs:{ fox:1, kitsune:1, narrow:0.4, 'eye_up':0.3 } },
  { label:'虚ろな目',     cat:'ファンタジー', morphs:{ hollow:1, empty:0.9, void:0.8, blank:0.7 } },
  { label:'神秘の目',     cat:'ファンタジー', morphs:{ mystic:1, mysterious:0.8, magic:0.5 } },
  { label:'異形の目',     cat:'ファンタジー', morphs:{ alien:0.9, inhuman:0.9, monster:0.6 } },
  { label:'宝石眼',       cat:'ファンタジー', morphs:{ gem:1, jewel:1, crystal:0.7, sparkling:0.5 } },
  { label:'星眼',         cat:'ファンタジー', morphs:{ star:1, sparkle:0.9, shine:0.7, starburst:1 } },
  { label:'月眼',         cat:'ファンタジー', morphs:{ moon:1, lunar:0.8, crescent:0.6 } },
  { label:'闇眼',         cat:'ファンタジー', morphs:{ dark:1, shadow:0.9, darkness:0.8, abyss:0.7 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Eye helpers
// ─────────────────────────────────────────────────────────────────────────────
function _applyEyeColorPreset(p, eyeMats) {
  eyeMats.forEach(m => {
    if (m.color) setMatColor(m, p.color);
    if (p.shade && isMToon(m) && m.shadeColorFactor) setColorObj(m.shadeColorFactor, p.shade);
  });
  setStatus('瞳色: ' + p.label);
  setTimeout(() => setStatus(''), 1500);
}

function _applyEyeShapePreset(preset, allEyeMorphs) {
  // reset all eye morphs to 0
  allEyeMorphs.forEach(({ targets }) => {
    targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = 0; });
  });
  const byName = {};
  allEyeMorphs.forEach(e => { byName[e.name.toLowerCase()] = e; });
  let applied = 0;
  Object.entries(preset.morphs).forEach(([pattern, value]) => {
    const pat = pattern.toLowerCase();
    if (byName[pat]) {
      byName[pat].targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = value; });
      applied++;
    } else {
      for (const [nm, entry] of Object.entries(byName)) {
        if (nm.includes(pat) || pat.includes(nm)) {
          entry.targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = value; });
          applied++;
          break;
        }
      }
    }
  });
  const msg = applied > 0 ? `目の形: ${preset.label} (${applied}モーフ適用)` : `${preset.label}: 対応モーフなし`;
  setStatus(msg);
  setTimeout(() => setStatus(''), 2000);
  return applied;
}

function _buildEyeColorPalette(body, eyeMats) {
  const sec = makeSection('カラープリセット');
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:4px 8px 2px;display:flex;gap:4px;align-items:center;';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '瞳色検索…';
  searchInput.className = 'morph-search';
  searchInput.style.flex = '1';
  const randBtn = document.createElement('button');
  randBtn.textContent = '🎲';
  randBtn.title = 'ランダム';
  randBtn.style.cssText = 'padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:10px;cursor:pointer;flex-shrink:0;';
  randBtn.addEventListener('click', () => {
    _applyEyeColorPreset(EYE_COLOR_PRESETS[Math.floor(Math.random() * EYE_COLOR_PRESETS.length)], eyeMats);
  });
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(randBtn);
  sec.appendChild(searchWrap);
  const cats = [...new Set(EYE_COLOR_PRESETS.map(p => p.cat))];
  const catDivs = {};
  cats.forEach(cat => {
    const catWrap = document.createElement('div');
    const catLabel = document.createElement('div');
    catLabel.style.cssText = 'font-size:8px;color:var(--text3);padding:5px 8px 2px;letter-spacing:0.5px;font-weight:800;text-transform:uppercase;';
    catLabel.textContent = cat;
    catWrap.appendChild(catLabel);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;padding:2px 8px 6px;';
    catWrap.appendChild(grid);
    catDivs[cat] = { wrap: catWrap, grid };
    sec.appendChild(catWrap);
  });
  EYE_COLOR_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.title = p.label;
    btn.dataset.label = p.label;
    btn.style.cssText = `width:18px;height:18px;border-radius:50%;background:${p.color};border:1px solid rgba(255,255,255,0.22);cursor:pointer;flex-shrink:0;transition:transform 0.1s,box-shadow 0.1s;`;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.35)'; btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.55)'; btn.style.zIndex = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; btn.style.boxShadow = ''; btn.style.zIndex = ''; });
    btn.addEventListener('click', () => _applyEyeColorPreset(p, eyeMats));
    catDivs[p.cat].grid.appendChild(btn);
  });
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    cats.forEach(cat => {
      const { wrap, grid } = catDivs[cat];
      let visible = 0;
      grid.querySelectorAll('button').forEach(b => {
        const match = !q || b.dataset.label.toLowerCase().includes(q);
        b.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      wrap.style.display = visible === 0 ? 'none' : '';
    });
  });
  body.appendChild(sec);
}

function _buildEyeShapePresetsUI(body, eyeMorphs) {
  const sec = makeSection('目の形プリセット');
  if (eyeMorphs.length === 0) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:9px;color:var(--text3);padding:6px 10px 4px;line-height:1.5;';
    note.textContent = 'このモデルに目のモーフがありません。プリセットは適用されますが効果が出ない場合があります。';
    sec.appendChild(note);
  }
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:4px 8px 2px;display:flex;gap:4px;align-items:center;';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '目の形検索…';
  searchInput.className = 'morph-search';
  searchInput.style.flex = '1';
  const randBtn = document.createElement('button');
  randBtn.textContent = '🎲';
  randBtn.title = 'ランダム';
  randBtn.style.cssText = 'padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:10px;cursor:pointer;flex-shrink:0;';
  randBtn.addEventListener('click', () => {
    const p = EYE_SHAPE_PRESETS[Math.floor(Math.random() * EYE_SHAPE_PRESETS.length)];
    _applyEyeShapePreset(p, eyeMorphs);
    updateShapeButtons(p);
  });
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(randBtn);
  sec.appendChild(searchWrap);
  const cats = [...new Set(EYE_SHAPE_PRESETS.map(p => p.cat))];
  const catDivs = {};
  let allBtns = [];
  let selectedPreset = null;
  function updateShapeButtons(sel) {
    selectedPreset = sel;
    allBtns.forEach(({ btn, preset }) => {
      btn.style.outline = preset === sel ? '2px solid var(--accent)' : '';
      btn.style.outlineOffset = preset === sel ? '1px' : '';
    });
  }
  cats.forEach(cat => {
    const catWrap = document.createElement('div');
    const catLabel = document.createElement('div');
    catLabel.style.cssText = 'font-size:8px;color:var(--text3);padding:5px 8px 2px;letter-spacing:0.5px;font-weight:800;text-transform:uppercase;';
    catLabel.textContent = cat;
    catWrap.appendChild(catLabel);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:2px 8px 6px;';
    catWrap.appendChild(grid);
    catDivs[cat] = { wrap: catWrap, grid };
    sec.appendChild(catWrap);
  });
  EYE_SHAPE_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.dataset.label = p.label;
    btn.title = Object.keys(p.morphs).join(', ');
    btn.style.cssText = 'padding:2px 5px;font-size:9px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background 0.1s,color 0.1s;';
    btn.addEventListener('mouseenter', () => { if (selectedPreset !== p) { btn.style.background = 'var(--hover)'; btn.style.color = 'var(--text)'; } });
    btn.addEventListener('mouseleave', () => { if (selectedPreset !== p) { btn.style.background = 'var(--panel2)'; btn.style.color = 'var(--text2)'; } });
    btn.addEventListener('click', () => {
      _applyEyeShapePreset(p, eyeMorphs);
      updateShapeButtons(p);
    });
    catDivs[p.cat].grid.appendChild(btn);
    allBtns.push({ btn, preset: p });
  });
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    cats.forEach(cat => {
      const { wrap, grid } = catDivs[cat];
      let visible = 0;
      grid.querySelectorAll('button').forEach(b => {
        const match = !q || b.dataset.label.toLowerCase().includes(q);
        b.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      wrap.style.display = visible === 0 ? 'none' : '';
    });
  });
  body.appendChild(sec);
}

function _buildEyeParams(body) {
  const morphs = categorizeVRMMorphs();
  const mats   = categorizeVRMMaterials();
  const eyeMorphs = morphs.eyes;
  const eyeMats   = mats.eyes;
  if (eyeMorphs.length === 0 && eyeMats.length === 0) {
    body.innerHTML = `<p class="no-data">パラメーターがありません<br><span style="font-size:10px;opacity:.6">このモデルは対応データを持っていません</span></p>`;
    return;
  }
  // 1. Shape presets
  _buildEyeShapePresetsUI(body, eyeMorphs);
  // 2. Morph sliders
  if (eyeMorphs.length > 0) {
    const sec = makeSection('シェイプ（個別）');
    if (eyeMorphs.length > 12) {
      const searchRow = document.createElement('div');
      searchRow.style.cssText = 'padding:5px 10px;border-bottom:1px solid var(--border);';
      const searchInp = document.createElement('input');
      searchInp.type = 'text'; searchInp.placeholder = '検索...';
      searchInp.style.cssText = 'width:100%;padding:4px 8px;background:var(--panel2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-size:10px;outline:none;';
      let rows2 = [];
      searchInp.addEventListener('input', () => {
        const q = searchInp.value.toLowerCase();
        rows2.forEach(({ row, name, jaName }) => {
          row.style.display = !q || name.toLowerCase().includes(q) || jaName.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      searchRow.appendChild(searchInp);
      sec.appendChild(searchRow);
      eyeMorphs.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        const jaName = formatMorphName(name);
        const row = makeSlider(jaName, 0, 1, cur, 0.01, v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; }));
        sec.appendChild(row);
        rows2.push({ row, name, jaName });
      });
    } else {
      eyeMorphs.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        sec.appendChild(makeSlider(formatMorphName(name), 0, 1, cur, 0.01,
          v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })));
      });
    }
    body.appendChild(sec);
  }
  // 3. Color palette
  if (eyeMats.length > 0) {
    _buildEyeColorPalette(body, eyeMats);
    // Fine color pickers
    const colorSec = makeSection('カラー（詳細）');
    let added = 0;
    eyeMats.forEach(mat => {
      if (!mat?.color) return;
      const orig = matColorHex(mat);
      colorSec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name, orig,
        v => setMatColor(mat, v), () => setMatColor(mat, orig)));
      added++;
    });
    if (added > 0) body.appendChild(colorSec);
    // Shade color
    const shadeMats = eyeMats.filter(m => isMToon(m) && m.shadeColorFactor);
    if (shadeMats.length > 0) {
      const shadeSec = makeSection('影色');
      shadeMats.forEach(mat => {
        const orig = colorObjHex(mat.shadeColorFactor);
        shadeSec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name + '_shade', orig,
          v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
      });
      body.appendChild(shadeSec);
    }
    // Shading
    const firstMToon = eyeMats.find(isMToon);
    if (firstMToon && firstMToon.shadingToonyFactor !== undefined) {
      const shadingSec = makeSection('シェーディング');
      shadingSec.appendChild(makeSlider('影の硬さ', 0, 1, firstMToon.shadingToonyFactor, 0.01,
        v => eyeMats.filter(isMToon).forEach(m => { if (m.shadingToonyFactor !== undefined) m.shadingToonyFactor = v; })));
      if (firstMToon.shadingShiftFactor !== undefined) {
        shadingSec.appendChild(makeSlider('影の範囲', -1, 1, firstMToon.shadingShiftFactor, 0.01,
          v => eyeMats.filter(isMToon).forEach(m => { if (m.shadingShiftFactor !== undefined) m.shadingShiftFactor = v; })));
      }
      body.appendChild(shadingSec);
    }
  }
}

function _buildFaceParams(itemId) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  if (itemId === 'makeup') { _buildMakeupParams(body); return; }
  if (itemId === 'lookat') { _buildLookAtParams(body); return; }
  if (itemId === 'lash') { _buildLashParams(body); return; }
  if (itemId === 'eyes') { _buildEyeParams(body); return; }
  const morphs = categorizeVRMMorphs();
  const mats   = categorizeVRMMaterials();
  const dataMap = {
    outline: { morphs: morphs.face,  mats: mats.skin },
    eyes:    { morphs: morphs.eyes,  mats: mats.eyes },
    brows:   { morphs: morphs.brows, mats: mats.brows },
    nose:    { morphs: morphs.nose,  mats: [] },
    mouth:   { morphs: morphs.mouth, mats: [] },
    skin:    { morphs: [],           mats: [...mats.skin, ...mats.body] },
  };
  const data = dataMap[itemId] || { morphs: [], mats: [] };
  if (data.morphs.length === 0 && data.mats.length === 0) {
    body.innerHTML = `<p class="no-data">パラメーターがありません<br><span style="font-size:10px;opacity:.6">このモデルは対応データを持っていません</span></p>`;
    return;
  }
  if (data.morphs.length > 0) {
    const sec = makeSection('シェイプ');
    const allMorphsForSearch = data.morphs;

    // 検索ボックス（15個超の場合）
    if (allMorphsForSearch.length > 15) {
      const searchRow = document.createElement('div');
      searchRow.style.cssText = 'padding:5px 10px;border-bottom:1px solid var(--border);';
      const searchInp = document.createElement('input');
      searchInp.type = 'text'; searchInp.placeholder = '検索...';
      searchInp.style.cssText = 'width:100%;padding:4px 8px;background:var(--panel2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-size:10px;outline:none;';
      let searchRows = [];
      searchInp.addEventListener('input', () => {
        const q = searchInp.value.toLowerCase();
        searchRows.forEach(({ row, name, jaName }) => {
          row.style.display = !q || name.toLowerCase().includes(q) || jaName.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      searchRow.appendChild(searchInp);
      sec.appendChild(searchRow);

      allMorphsForSearch.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        const jaName = formatMorphName(name);
        const row = makeSlider(jaName, 0, 1, cur, 0.01,
          v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })
        );
        sec.appendChild(row);
        searchRows.push({ row, name, jaName });
      });
    } else {
      allMorphsForSearch.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        sec.appendChild(makeSlider(formatMorphName(name), 0, 1, cur, 0.01,
          v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })
        ));
      });
    }
    body.appendChild(sec);
  }
  if (data.mats.length > 0) {
    // ベースカラー
    const colorSec = makeSection('カラー');
    let colorAdded = 0;
    data.mats.forEach(mat => {
      if (!mat?.color) return;
      const orig = matColorHex(mat);
      colorSec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name, orig,
        v => setMatColor(mat, v), () => setMatColor(mat, orig)));
      colorAdded++;
    });
    if (colorAdded > 0) body.appendChild(colorSec);

    // 影色（MToon）
    const shadeMats = data.mats.filter(m => isMToon(m) && m.shadeColorFactor);
    if (shadeMats.length > 0) {
      const shadeSec = makeSection('影色');
      shadeMats.forEach(mat => {
        const orig = colorObjHex(mat.shadeColorFactor);
        shadeSec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name + '_shade', orig,
          v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
      });
      body.appendChild(shadeSec);
    }

    // シェーディング（最初のMToonマテリアルから）
    const firstMToon = data.mats.find(isMToon);
    if (firstMToon && firstMToon.shadingToonyFactor !== undefined) {
      const shadingSec = makeSection('シェーディング');
      shadingSec.appendChild(makeSlider('影の硬さ', 0, 1, firstMToon.shadingToonyFactor, 0.01,
        v => data.mats.filter(isMToon).forEach(m => { if (m.shadingToonyFactor !== undefined) m.shadingToonyFactor = v; })));
      if (firstMToon.shadingShiftFactor !== undefined) {
        shadingSec.appendChild(makeSlider('影の範囲', -1, 1, firstMToon.shadingShiftFactor, 0.01,
          v => data.mats.filter(isMToon).forEach(m => { if (m.shadingShiftFactor !== undefined) m.shadingShiftFactor = v; })));
      }
      body.appendChild(shadingSec);
    }
  }
}

// ── HAIR items + params ───────────────────────────────────
function _buildHairItems(body) {
  if (!currentRoot) { body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>'; return; }

  // 髪型プリセットグリッド（常に表示）
  _buildHairPresetGrid(body);

  const mats = categorizeVRMMaterials();
  const hairMats = mats.hair;
  const browMats = mats.brows;

  if (hairMats.length === 0 && browMats.length === 0) {
    // presets still shown above; just add note
    const note = document.createElement('div');
    note.style.cssText = 'padding:8px 13px;font-size:10px;color:var(--text3);border-top:1px solid var(--border);margin-top:4px;';
    note.textContent = '読込モデルに髪マテリアルが見つかりません';
    body.appendChild(note);
    return;
  }

  const matSepHdr = document.createElement('div');
  matSepHdr.style.cssText = 'font-size:9px;font-weight:800;color:var(--text2);letter-spacing:.7px;text-transform:uppercase;padding:10px 13px 4px;border-top:1px solid var(--border);margin-top:4px;';
  matSepHdr.textContent = '髪色・マテリアル';
  body.appendChild(matSepHdr);

  // "一括変更" row at top
  if (hairMats.length > 0) {
    const unif = document.createElement('div');
    unif.className = 'hair-swatch-row' + (_currentItem === '__all' ? ' selected' : '');
    const swatchAll = document.createElement('div');
    swatchAll.className = 'hair-swatch';
    swatchAll.style.background = matColorHex(hairMats[0]);
    unif.appendChild(swatchAll);
    const lbl = document.createElement('span');
    lbl.className = 'hair-swatch-label';
    lbl.textContent = '全髪色（一括変更）';
    unif.appendChild(lbl);
    unif.addEventListener('click', () => {
      _currentItem = '__all';
      body.querySelectorAll('.hair-swatch-row').forEach(r => r.classList.remove('selected'));
      unif.classList.add('selected');
      _setParamsTitle('全髪色（一括変更）');
      _buildHairAllParams(hairMats);
    });
    body.appendChild(unif);

    // Individual hair materials
    hairMats.forEach((mat, i) => {
      const row = document.createElement('div');
      const rid = 'hair_' + i;
      row.className = 'hair-swatch-row' + (_currentItem === rid ? ' selected' : '');
      const sw = document.createElement('div');
      sw.className = 'hair-swatch';
      sw.style.background = matColorHex(mat);
      row.appendChild(sw);
      const ml = document.createElement('span');
      ml.className = 'hair-swatch-label';
      ml.textContent = matJaName(mat.name) || mat.name || '髪 ' + (i+1);
      row.appendChild(ml);
      row.addEventListener('click', () => {
        _currentItem = rid;
        body.querySelectorAll('.hair-swatch-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(ml.textContent);
        _buildHairSingleParams(mat, body, sw);
      });
      body.appendChild(row);
    });
  }

  // Brows/lashes section
  if (browMats.length > 0) {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-size:9px;font-weight:800;color:var(--text2);letter-spacing:.7px;text-transform:uppercase;padding:8px 13px 4px;';
    hdr.textContent = '眉毛・まつ毛';
    body.appendChild(hdr);
    browMats.forEach((mat, i) => {
      const row = document.createElement('div');
      const rid = 'brow_' + i;
      row.className = 'hair-swatch-row' + (_currentItem === rid ? ' selected' : '');
      const sw = document.createElement('div');
      sw.className = 'hair-swatch';
      sw.style.background = matColorHex(mat);
      row.appendChild(sw);
      const ml = document.createElement('span');
      ml.className = 'hair-swatch-label';
      ml.textContent = matJaName(mat.name) || mat.name;
      row.appendChild(ml);
      row.addEventListener('click', () => {
        _currentItem = rid;
        body.querySelectorAll('.hair-swatch-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(ml.textContent);
        _buildHairSingleParams(mat, body, sw);
      });
      body.appendChild(row);
    });
  }

  // Restore previous selection or auto-select first
  {
    const allRows = [...body.querySelectorAll('.hair-swatch-row')];
    const hairIds = [];
    if (hairMats.length > 0) {
      hairIds.push('__all');
      hairMats.forEach((_, i) => hairIds.push('hair_' + i));
    }
    browMats.forEach((_, i) => hairIds.push('brow_' + i));
    const matchIdx = hairIds.indexOf(_currentItem);
    const targetRow = matchIdx >= 0 ? allRows[matchIdx] : allRows[0];
    targetRow?.click();
  }
}

const HAIR_PRESETS = [
  // ナチュラル系
  { label:'漆黒',           color:'#080a08', shade:'#050605', cat:'ナチュラル' },
  { label:'黒髪',           color:'#1a1007', shade:'#100805', cat:'ナチュラル' },
  { label:'ソフトブラック',  color:'#1e1a1a', shade:'#121010', cat:'ナチュラル' },
  { label:'黒茶',           color:'#2d1f0e', shade:'#1a1208', cat:'ナチュラル' },
  { label:'ダークブラウン',  color:'#3d2010', shade:'#251308', cat:'ナチュラル' },
  { label:'チョコブラウン',  color:'#4a2512', shade:'#2d160a', cat:'ナチュラル' },
  { label:'ミルクチョコ',    color:'#5c3317', shade:'#3a200e', cat:'ナチュラル' },
  { label:'カフェオレ',      color:'#7a4d28', shade:'#4d3018', cat:'ナチュラル' },
  { label:'ライトブラウン',  color:'#9b6040', shade:'#6b4028', cat:'ナチュラル' },
  { label:'キャラメル',      color:'#c87a38', shade:'#885020', cat:'ナチュラル' },
  { label:'ハニーブラウン',  color:'#c88838', shade:'#886018', cat:'ナチュラル' },
  { label:'マホガニー',      color:'#6a2818', shade:'#401808', cat:'ナチュラル' },
  // アッシュ系
  { label:'アッシュブラック', color:'#282830', shade:'#181820', cat:'アッシュ' },
  { label:'ダークアッシュ',   color:'#3a3a48', shade:'#222230', cat:'アッシュ' },
  { label:'アッシュグレー',   color:'#787888', shade:'#505060', cat:'アッシュ' },
  { label:'ライトアッシュ',   color:'#9898a8', shade:'#686878', cat:'アッシュ' },
  { label:'シルバーアッシュ', color:'#b8b8c8', shade:'#888898', cat:'アッシュ' },
  { label:'ブルーアッシュ',   color:'#4a5878', shade:'#2a3850', cat:'アッシュ' },
  { label:'グリーンアッシュ', color:'#4a5a50', shade:'#2a3a30', cat:'アッシュ' },
  { label:'パープルアッシュ', color:'#58486a', shade:'#382840', cat:'アッシュ' },
  { label:'ピンクアッシュ',   color:'#784060', shade:'#503040', cat:'アッシュ' },
  { label:'ベージュアッシュ', color:'#8a7870', shade:'#5a5048', cat:'アッシュ' },
  // ブロンド系
  { label:'ゴールドブロンド',     color:'#d4a830', shade:'#9a7018', cat:'ブロンド' },
  { label:'プラチナブロンド',     color:'#e8dca8', shade:'#c0b878', cat:'ブロンド' },
  { label:'アイスブロンド',       color:'#e8e4d0', shade:'#c0bcb0', cat:'ブロンド' },
  { label:'ストロベリーブロンド', color:'#d49068', shade:'#9a5830', cat:'ブロンド' },
  { label:'ダーティブロンド',     color:'#c09858', shade:'#887038', cat:'ブロンド' },
  { label:'ライトゴールド',       color:'#e0c850', shade:'#b09020', cat:'ブロンド' },
  { label:'ロゼゴールド',         color:'#d89080', shade:'#a06050', cat:'ブロンド' },
  { label:'シャンパン',           color:'#e8d8a8', shade:'#c0b080', cat:'ブロンド' },
  { label:'ビーチブロンド',       color:'#d8b860', shade:'#a08030', cat:'ブロンド' },
  { label:'バニラ',               color:'#f0e8c0', shade:'#c8c090', cat:'ブロンド' },
  // ピンク・赤系
  { label:'ホットピンク',   color:'#d84f8a', shade:'#902060', cat:'ピンク・赤' },
  { label:'ベビーピンク',   color:'#f090b8', shade:'#c05888', cat:'ピンク・赤' },
  { label:'ローズピンク',   color:'#d06080', shade:'#903050', cat:'ピンク・赤' },
  { label:'ダスティピンク', color:'#c08898', shade:'#886070', cat:'ピンク・赤' },
  { label:'サクラ',         color:'#e8a8b8', shade:'#c07090', cat:'ピンク・赤' },
  { label:'フラミンゴ',     color:'#f07888', shade:'#c03058', cat:'ピンク・赤' },
  { label:'マゼンタ',       color:'#c02880', shade:'#80105a', cat:'ピンク・赤' },
  { label:'ルビーレッド',   color:'#9b0000', shade:'#600000', cat:'ピンク・赤' },
  { label:'スカーレット',   color:'#cc1818', shade:'#880808', cat:'ピンク・赤' },
  { label:'ローズレッド',   color:'#c01838', shade:'#800018', cat:'ピンク・赤' },
  // パープル系
  { label:'パープル',               color:'#7030a0', shade:'#401060', cat:'パープル' },
  { label:'ダークパープル',         color:'#4a0870', shade:'#280440', cat:'パープル' },
  { label:'ミスティックバイオレット', color:'#6040a8', shade:'#382070', cat:'パープル' },
  { label:'ラベンダー',             color:'#a880d8', shade:'#706098', cat:'パープル' },
  { label:'リラック',               color:'#c0a0e0', shade:'#8070b0', cat:'パープル' },
  { label:'オーキッド',             color:'#8850b0', shade:'#582880', cat:'パープル' },
  { label:'プラム',                 color:'#602060', shade:'#380838', cat:'パープル' },
  { label:'ナイトパープル',         color:'#280840', shade:'#180428', cat:'パープル' },
  // ブルー系
  { label:'インディゴ',     color:'#2830a0', shade:'#101870', cat:'ブルー' },
  { label:'ロイヤルブルー', color:'#1a3a8b', shade:'#0a1a5b', cat:'ブルー' },
  { label:'コバルト',       color:'#2050c0', shade:'#083090', cat:'ブルー' },
  { label:'スカイブルー',   color:'#4090d8', shade:'#2060a8', cat:'ブルー' },
  { label:'アイスブルー',   color:'#90c0e0', shade:'#5890b8', cat:'ブルー' },
  { label:'ネイビー',       color:'#102050', shade:'#081030', cat:'ブルー' },
  { label:'ミッドナイト',   color:'#080818', shade:'#040408', cat:'ブルー' },
  { label:'デニムブルー',   color:'#3a5888', shade:'#203058', cat:'ブルー' },
  { label:'セルリアン',     color:'#2878c8', shade:'#104898', cat:'ブルー' },
  { label:'ペリウィンクル', color:'#8090c8', shade:'#506098', cat:'ブルー' },
  // グリーン系
  { label:'エメラルド',     color:'#1a7060', shade:'#0a4038', cat:'グリーン' },
  { label:'フォレスト',     color:'#2e5a1c', shade:'#183a0c', cat:'グリーン' },
  { label:'ミントグリーン', color:'#5ac8a0', shade:'#309870', cat:'グリーン' },
  { label:'ティール',       color:'#207890', shade:'#0a5060', cat:'グリーン' },
  { label:'ターコイズ',     color:'#20a8a0', shade:'#087070', cat:'グリーン' },
  { label:'オリーブ',       color:'#6b7a2a', shade:'#404a10', cat:'グリーン' },
  { label:'ジェードグリーン', color:'#388060', shade:'#185040', cat:'グリーン' },
  { label:'マラカイト',     color:'#0a8040', shade:'#085028', cat:'グリーン' },
  { label:'セージグリーン', color:'#789870', shade:'#486040', cat:'グリーン' },
  { label:'モスグリーン',   color:'#506030', shade:'#303810', cat:'グリーン' },
  // ネオン系
  { label:'ネオンピンク',    color:'#f020a8', shade:'#a00870', cat:'ネオン' },
  { label:'ネオンパープル',  color:'#a020e0', shade:'#6008a0', cat:'ネオン' },
  { label:'ネオンブルー',    color:'#1060f8', shade:'#0838c0', cat:'ネオン' },
  { label:'ネオングリーン',  color:'#20e828', shade:'#10a018', cat:'ネオン' },
  { label:'ネオンイエロー',  color:'#e8e020', shade:'#a8a010', cat:'ネオン' },
  { label:'ネオンオレンジ',  color:'#f86020', shade:'#c03808', cat:'ネオン' },
  { label:'エレクトリック',  color:'#2080ff', shade:'#0850d0', cat:'ネオン' },
  { label:'サイバーレッド',  color:'#f82020', shade:'#c00808', cat:'ネオン' },
  { label:'アシッドグリーン', color:'#80f020', shade:'#50b010', cat:'ネオン' },
  { label:'ウルトラマリン',  color:'#1840d8', shade:'#0828a0', cat:'ネオン' },
  // メタリック系
  { label:'シルバー',         color:'#c8c8d8', shade:'#909098', cat:'メタリック' },
  { label:'プラチナ',         color:'#d8d8e8', shade:'#a8a8b8', cat:'メタリック' },
  { label:'ゴールド',         color:'#d4af37', shade:'#9a7a10', cat:'メタリック' },
  { label:'ブロンズ',         color:'#a06030', shade:'#684010', cat:'メタリック' },
  { label:'コッパー',         color:'#b05030', shade:'#783020', cat:'メタリック' },
  { label:'ローズゴールド',   color:'#c87868', shade:'#905040', cat:'メタリック' },
  { label:'スターダスト',     color:'#c0b8d8', shade:'#8880a8', cat:'メタリック' },
  { label:'ムーンライト',     color:'#d0d8e8', shade:'#a0a8b8', cat:'メタリック' },
  { label:'アンティークゴールド', color:'#b89040', shade:'#806018', cat:'メタリック' },
  { label:'クロームシルバー', color:'#e0e0e8', shade:'#b0b0c0', cat:'メタリック' },
  // 和風・アニメ系
  { label:'白銀',   color:'#d8dce8', shade:'#a0a4b0', cat:'和風・アニメ' },
  { label:'桜色',   color:'#f4b0c8', shade:'#d07898', cat:'和風・アニメ' },
  { label:'紅',     color:'#a00828', shade:'#680318', cat:'和風・アニメ' },
  { label:'紺碧',   color:'#1a3868', shade:'#0a2040', cat:'和風・アニメ' },
  { label:'菫色',   color:'#6848a0', shade:'#402870', cat:'和風・アニメ' },
  { label:'翠色',   color:'#3a9068', shade:'#1a5838', cat:'和風・アニメ' },
  { label:'金色',   color:'#d4b020', shade:'#9a7808', cat:'和風・アニメ' },
  { label:'藤色',   color:'#9878c8', shade:'#685898', cat:'和風・アニメ' },
  { label:'夕焼け', color:'#d06030', shade:'#a03810', cat:'和風・アニメ' },
  { label:'宵闇',   color:'#1a1030', shade:'#0a0820', cat:'和風・アニメ' },
];

function _applyHairPreset(p, hairMats, singleMat, swatch) {
  const mats = singleMat ? [singleMat] : hairMats;
  mats.forEach(m => {
    if (m.color) setMatColor(m, p.color);
    if (p.shade && isMToon(m) && m.shadeColorFactor) setColorObj(m.shadeColorFactor, p.shade);
  });
  if (swatch) swatch.style.background = p.color;
  const ib = _getItemsBody();
  if (ib) ib.querySelectorAll('.hair-swatch-row .hair-swatch').forEach(sw => { sw.style.background = p.color; });
  setStatus('髪色: ' + p.label); setTimeout(() => setStatus(''), 1500);
}

function _buildHairPresetSection(hairMats, singleMat, swatch, onApply) {
  const sec = makeSection('カラープリセット');

  // 検索
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:4px 8px 2px;display:flex;gap:4px;align-items:center;';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'カラー検索…';
  searchInput.className = 'morph-search';
  searchInput.style.flex = '1';
  // ランダムボタン
  const randBtn = document.createElement('button');
  randBtn.textContent = '🎲';
  randBtn.title = 'ランダム';
  randBtn.style.cssText = 'padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:10px;cursor:pointer;flex-shrink:0;';
  randBtn.addEventListener('click', () => {
    const p = HAIR_PRESETS[Math.floor(Math.random() * HAIR_PRESETS.length)];
    _applyHairPreset(p, hairMats, singleMat, swatch);
    if (onApply) onApply();
  });
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(randBtn);
  sec.appendChild(searchWrap);

  // カテゴリ別グリッド
  const cats = [...new Set(HAIR_PRESETS.map(p => p.cat))];
  const catDivs = {};
  cats.forEach(cat => {
    const catWrap = document.createElement('div');
    const catLabel = document.createElement('div');
    catLabel.style.cssText = 'font-size:8px;color:var(--text3);padding:5px 8px 2px;letter-spacing:0.5px;font-weight:800;text-transform:uppercase;';
    catLabel.textContent = cat;
    catWrap.appendChild(catLabel);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;padding:2px 8px 6px;';
    catWrap.appendChild(grid);
    catDivs[cat] = { wrap: catWrap, grid };
    sec.appendChild(catWrap);
  });

  HAIR_PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.title = p.label;
    btn.dataset.label = p.label;
    btn.style.cssText = `width:18px;height:18px;border-radius:2px;background:${p.color};border:1px solid rgba(255,255,255,0.18);cursor:pointer;flex-shrink:0;transition:transform 0.1s,box-shadow 0.1s;`;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.3)'; btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)'; btn.style.zIndex = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; btn.style.boxShadow = ''; btn.style.zIndex = ''; });
    btn.addEventListener('click', () => {
      _applyHairPreset(p, hairMats, singleMat, swatch);
      if (onApply) onApply();
    });
    catDivs[p.cat].grid.appendChild(btn);
  });

  // 検索フィルター
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    cats.forEach(cat => {
      const { wrap, grid } = catDivs[cat];
      let visible = 0;
      grid.querySelectorAll('button').forEach(btn => {
        const match = !q || btn.dataset.label.toLowerCase().includes(q);
        btn.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      wrap.style.display = visible === 0 ? 'none' : '';
    });
  });

  return sec;
}

function _buildHairAllParams(hairMats) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  if (hairMats.length === 0) return;

  body.appendChild(_buildHairPresetSection(hairMats, null, null, () => { body.innerHTML = ''; _buildHairAllParams(hairMats); }));

  // ベースカラー一括
  const colorSec = makeSection('カラー（全体）');
  const initHex = matColorHex(hairMats[0]);
  colorSec.appendChild(makeColorRow('ベースカラー', 'hair-unified', initHex,
    v => hairMats.forEach(m => { if (m.color) setMatColor(m, v); }),
    () => hairMats.forEach(m => { if (m.color) setMatColor(m, initHex); })
  ));
  // 影色一括
  const shadeMats = hairMats.filter(m => isMToon(m) && m.shadeColorFactor);
  if (shadeMats.length > 0) {
    const initShade = colorObjHex(shadeMats[0].shadeColorFactor);
    colorSec.appendChild(makeColorRow('影色', 'hair-shade-unified', initShade,
      v => shadeMats.forEach(m => setColorObj(m.shadeColorFactor, v)),
      () => shadeMats.forEach(m => setColorObj(m.shadeColorFactor, initShade))
    ));
  }
  // リムカラー一括
  const rimMats = hairMats.filter(m => isMToon(m) && m.parametricRimColorFactor);
  if (rimMats.length > 0) {
    const initRim = colorObjHex(rimMats[0].parametricRimColorFactor);
    colorSec.appendChild(makeColorRow('リムカラー', 'hair-rim-unified', initRim,
      v => rimMats.forEach(m => setColorObj(m.parametricRimColorFactor, v)),
      () => rimMats.forEach(m => setColorObj(m.parametricRimColorFactor, initRim))
    ));
  }
  body.appendChild(colorSec);

  // シェーディング一括（最初のMToonから初期値取得）
  const firstMToon = hairMats.find(isMToon);
  if (firstMToon) {
    const shadSec = makeSection('シェーディング');
    let shadAdded = 0;
    if (firstMToon.shadingToonyFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の硬さ', 0, 1, firstMToon.shadingToonyFactor, 0.01,
        v => hairMats.filter(isMToon).forEach(m => { m.shadingToonyFactor = v; })));
      shadAdded++;
    }
    if (firstMToon.shadingShiftFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の範囲', -1, 1, firstMToon.shadingShiftFactor, 0.01,
        v => hairMats.filter(isMToon).forEach(m => { m.shadingShiftFactor = v; })));
      shadAdded++;
    }
    if (shadAdded > 0) body.appendChild(shadSec);

    // アウトライン一括
    if (firstMToon.outlineWidthFactor !== undefined || firstMToon.outlineColorFactor) {
      const outSec = makeSection('アウトライン');
      let outAdded = 0;
      if (firstMToon.outlineWidthFactor !== undefined) {
        outSec.appendChild(makeSlider('太さ', 0, 0.05, firstMToon.outlineWidthFactor, 0.001,
          v => hairMats.filter(isMToon).forEach(m => { if (m.outlineWidthFactor !== undefined) m.outlineWidthFactor = v; })));
        outAdded++;
      }
      if (firstMToon.outlineColorFactor) {
        const initOut = colorObjHex(firstMToon.outlineColorFactor);
        outSec.appendChild(makeColorRow('色', 'hair-outline-unified', initOut,
          v => hairMats.filter(isMToon).forEach(m => { if (m.outlineColorFactor) setColorObj(m.outlineColorFactor, v); }),
          () => hairMats.filter(isMToon).forEach(m => { if (m.outlineColorFactor) setColorObj(m.outlineColorFactor, initOut); })
        ));
        outAdded++;
      }
      if (outAdded > 0) body.appendChild(outSec);
    }
  }
}

function _buildHairSingleParams(mat, itemBody, swatch) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  if (!mat.color && !isMToon(mat)) { body.innerHTML = '<p class="no-data">カラーデータがありません</p>'; return; }

  body.appendChild(_buildHairPresetSection(null, mat, swatch, () => { body.innerHTML = ''; _buildHairSingleParams(mat, itemBody, swatch); }));

  // カラー
  const colorSec = makeSection('カラー');
  const origHex = matColorHex(mat);
  colorSec.appendChild(makeColorRow('ベースカラー', mat.name, origHex,
    v => { setMatColor(mat, v); if (swatch) swatch.style.background = v; },
    () => { setMatColor(mat, origHex); if (swatch) swatch.style.background = origHex; }
  ));
  if (isMToon(mat) && mat.shadeColorFactor) {
    const orig = colorObjHex(mat.shadeColorFactor);
    colorSec.appendChild(makeColorRow('影色', mat.name + '_shade', orig,
      v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
  }
  if (isMToon(mat) && mat.parametricRimColorFactor) {
    const orig = colorObjHex(mat.parametricRimColorFactor);
    colorSec.appendChild(makeColorRow('リムカラー', mat.name + '_rim', orig,
      v => setColorObj(mat.parametricRimColorFactor, v), () => setColorObj(mat.parametricRimColorFactor, orig)));
  }
  body.appendChild(colorSec);

  // 透明度（opacity）
  if (mat.opacity !== undefined) {
    const opSec = makeSection('透明度');
    opSec.appendChild(makeSlider('不透明度', 0, 1, mat.opacity, 0.01, v => { mat.opacity = v; mat.transparent = v < 1; }));
    body.appendChild(opSec);
  }

  // シェーディング
  if (isMToon(mat)) {
    const shadSec = makeSection('シェーディング');
    let shadAdded = 0;
    if (mat.shadingToonyFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の硬さ', 0, 1, mat.shadingToonyFactor, 0.01,
        v => { mat.shadingToonyFactor = v; }));
      shadAdded++;
    }
    if (mat.shadingShiftFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の範囲', -1, 1, mat.shadingShiftFactor, 0.01,
        v => { mat.shadingShiftFactor = v; }));
      shadAdded++;
    }
    if (mat.rimLightingMixFactor !== undefined) {
      shadSec.appendChild(makeSlider('リム強度', 0, 1, mat.rimLightingMixFactor, 0.01,
        v => { mat.rimLightingMixFactor = v; }));
      shadAdded++;
    }
    // 艶プリセット（shadingToonyFactor を使用）
    if (mat.shadingToonyFactor !== undefined) {
      const shinePresetRow = document.createElement('div');
      shinePresetRow.style.cssText = 'display:flex;gap:4px;padding:3px 10px 5px;';
      [{ label:'マット', v:0.9 },{ label:'通常', v:0.6 },{ label:'艶あり', v:0.2 }].forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.label;
        btn.style.cssText = 'flex:1;padding:3px 0;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
        btn.addEventListener('click', () => { mat.shadingToonyFactor = p.v; body.innerHTML = ''; _buildHairSingleParams(mat, itemBody, swatch); });
        shinePresetRow.appendChild(btn);
      });
      shadSec.appendChild(shinePresetRow);
      shadAdded++;
    }
    if (shadAdded > 0) body.appendChild(shadSec);

    // アウトライン
    if (mat.outlineWidthFactor !== undefined || mat.outlineColorFactor) {
      const outSec = makeSection('アウトライン');
      let outAdded = 0;
      if (mat.outlineWidthFactor !== undefined) {
        outSec.appendChild(makeSlider('太さ', 0, 0.05, mat.outlineWidthFactor, 0.001,
          v => { mat.outlineWidthFactor = v; }));
        outAdded++;
      }
      if (mat.outlineColorFactor) {
        const orig = colorObjHex(mat.outlineColorFactor);
        outSec.appendChild(makeColorRow('色', mat.name + '_out', orig,
          v => setColorObj(mat.outlineColorFactor, v), () => setColorObj(mat.outlineColorFactor, orig)));
        outAdded++;
      }
      if (outAdded > 0) body.appendChild(outSec);
    }
  }
}

// ── BODY items + params ───────────────────────────────────
function _buildBodyItems(body) {
  if (!currentRoot) { body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>'; return; }
  _makeItemGrid(BODY_ITEMS, body, item => _buildBodyParams(item.id));
}

function _buildBodyParams(itemId) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';

  if (itemId === 'proportion') {
    if (!currentRoot.userData._baseScale) {
      const box = new THREE.Box3().setFromObject(currentRoot);
      const sz  = box.getSize(new THREE.Vector3());
      currentRoot.userData._baseScale = Math.max(sz.x, sz.y, sz.z) * currentRoot.scale.x;
    }
    const bs = () => currentRoot.userData._baseScale || 2.0;
    const norm = (v, b) => Math.round((v / (2 / b)) * 100) / 100;
    const b0 = bs();
    const rs = {
      x: norm(currentRoot.scale.x, b0),
      y: norm(currentRoot.scale.y, b0),
      z: norm(currentRoot.scale.z, b0),
    };
    // Store originals once on first open
    if (!currentRoot.userData._origScale) {
      currentRoot.userData._origScale = { x: rs.x, y: rs.y, z: rs.z };
    }
    const apply = () => {
      if (!currentRoot) return;
      const b = bs();
      currentRoot.scale.set((2/b)*rs.x, (2/b)*rs.y, (2/b)*rs.z);
    };
    const sec = makeSection('プロポーション');
    sec.appendChild(makeSlider('身長',   0.5, 2.0, rs.y, 0.01, v => { rs.y = v; apply(); }));
    sec.appendChild(makeSlider('横幅',   0.5, 2.0, rs.x, 0.01, v => { rs.x = v; apply(); }));
    sec.appendChild(makeSlider('奥行き', 0.5, 2.0, rs.z, 0.01, v => { rs.z = v; apply(); }));
    // リセットボタン
    const propResetBtn = document.createElement('button');
    propResetBtn.textContent = 'リセット (元の値)';
    propResetBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:3px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    propResetBtn.addEventListener('click', () => {
      const orig = currentRoot.userData._origScale || { x: 1, y: 1, z: 1 };
      rs.x = orig.x; rs.y = orig.y; rs.z = orig.z; apply();
      const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildBodyParams('proportion'); }
    });
    sec.appendChild(propResetBtn);
    body.appendChild(sec);
  }

  else if (itemId === 'shape') {
    const morphs = categorizeVRMMorphs();
    const bodyMorphs = [...morphs.body, ...morphs.other].filter(e =>
      !/^(blink|happy|angry|sad|surprised|relaxed|neutral|aa|ih|ou|ee|oh|lookUp|lookDown|lookLeft|lookRight)/i.test(e.name)
    );
    if (bodyMorphs.length === 0) {
      body.innerHTML = '<p class="no-data">ボディモーフがありません</p>'; return;
    }
    const sec = makeSection('ボディシェイプ');
    if (bodyMorphs.length > 15) {
      const searchRow = document.createElement('div');
      searchRow.style.cssText = 'padding:5px 10px;border-bottom:1px solid var(--border);';
      const searchInp = document.createElement('input');
      searchInp.type = 'text'; searchInp.placeholder = '検索...';
      searchInp.style.cssText = 'width:100%;padding:4px 8px;background:var(--panel2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-size:10px;outline:none;';
      let searchRows = [];
      searchInp.addEventListener('input', () => {
        const q = searchInp.value.toLowerCase();
        searchRows.forEach(({ row, name, jaName }) => {
          row.style.display = !q || name.toLowerCase().includes(q) || jaName.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      searchRow.appendChild(searchInp);
      sec.appendChild(searchRow);
      bodyMorphs.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        const jaName = formatMorphName(name);
        const row = makeSlider(jaName, 0, 1, cur, 0.01,
          v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })
        );
        sec.appendChild(row);
        searchRows.push({ row, name, jaName });
      });
    } else {
      bodyMorphs.forEach(({ name, targets }) => {
        const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
        sec.appendChild(makeSlider(formatMorphName(name), 0, 1, cur, 0.01,
          v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })
        ));
      });
    }
    body.appendChild(sec);
  }

  else if (itemId === 'skin') {
    const mats = categorizeVRMMaterials();
    const skinMats = [...mats.skin, ...mats.body];
    if (skinMats.length === 0) { body.innerHTML = '<p class="no-data">肌マテリアルがありません</p>'; return; }
    // ベースカラー
    const sec = makeSection('肌色');
    skinMats.forEach(mat => {
      if (!mat?.color) return;
      const orig = matColorHex(mat);
      sec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name, orig,
        v => setMatColor(mat, v), () => setMatColor(mat, orig)));
    });
    body.appendChild(sec);
    // 影色（MToon）
    const shadeMats = skinMats.filter(m => isMToon(m) && m.shadeColorFactor);
    if (shadeMats.length > 0) {
      const shadeSec = makeSection('影色');
      shadeMats.forEach(mat => {
        const orig = colorObjHex(mat.shadeColorFactor);
        shadeSec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name+'_shade', orig,
          v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
      });
      body.appendChild(shadeSec);
    }
    // シェーディング
    const firstMToon = skinMats.find(isMToon);
    if (firstMToon?.shadingToonyFactor !== undefined) {
      const shadSec = makeSection('シェーディング');
      shadSec.appendChild(makeSlider('影の硬さ', 0, 1, firstMToon.shadingToonyFactor, 0.01,
        v => skinMats.filter(isMToon).forEach(m => { m.shadingToonyFactor = v; })));
      if (firstMToon.shadingShiftFactor !== undefined) {
        shadSec.appendChild(makeSlider('影の範囲', -1, 1, firstMToon.shadingShiftFactor, 0.01,
          v => skinMats.filter(isMToon).forEach(m => { m.shadingShiftFactor = v; })));
      }
      body.appendChild(shadSec);
    }

    // All materials
    const allSec = makeSection('全マテリアル');
    const seen = new Set();
    let anyAdded = false;
    currentRoot.traverse(obj => {
      if (!obj.isMesh) return;
      [].concat(obj.material || []).forEach(m => {
        if (!m || seen.has(m.uuid) || !m.color) return;
        seen.add(m.uuid);
        const origHex = matColorHex(m);
        const jaLabel = matJaName(m.name) || m.name || '不明';
        allSec.appendChild(makeColorRow(jaLabel, m.name, origHex,
          v => setMatColor(m, v),
          () => setMatColor(m, origHex)
        ));
        anyAdded = true;
      });
    });
    if (anyAdded) body.appendChild(allSec);
  }

  else if (itemId === 'nail') {
    const mats = categorizeVRMMaterials();
    // Find nail materials - check all categories for nail pattern
    const allMats = [...mats.skin, ...mats.body, ...mats.other, ...mats.shoes, ...mats.tops, ...mats.bottoms];
    const seen = new Set();
    const nailMats = allMats.filter(m => {
      if (!m || seen.has(m.uuid)) return false;
      seen.add(m.uuid);
      return /nail/i.test(m.name || '');
    });
    if (nailMats.length === 0) {
      body.innerHTML = '<p class="no-data">爪マテリアルが見つかりません</p>';
      return;
    }
    const sec = makeSection('爪カラー');
    nailMats.forEach(mat => {
      const baseHex = matColorHex(mat);
      sec.appendChild(makeColorRow(matJaName(mat.name) || mat.name, mat.name, baseHex,
        hex => setMatColor(mat, hex),
        () => setMatColor(mat, baseHex)
      ));
      if (isMToon(mat) && mat.shadeColorFactor) {
        const shadeHex = colorObjHex(mat.shadeColorFactor);
        sec.appendChild(makeColorRow('影色', mat.name + '_nail_shade', shadeHex,
          hex => setColorObj(mat.shadeColorFactor, hex),
          () => setColorObj(mat.shadeColorFactor, shadeHex)
        ));
      }
      if (isMToon(mat) && mat.outlineWidthFactor !== undefined) {
        sec.appendChild(makeSlider('アウトライン', 0, 0.05, mat.outlineWidthFactor, 0.001,
          v => { mat.outlineWidthFactor = v; }));
      }
    });
    // Quick color presets for nails
    const presetSec = makeSection('ネイルカラープリセット');
    const nailColors = ['#ff9999','#ff6699','#cc3366','#ffffff','#ffddcc','#cc99ff','#99ccff','#222222','#ff0000','#ff6600'];
    const presetRow = document.createElement('div');
    presetRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:4px 10px;';
    nailColors.forEach(hex => {
      const sw = document.createElement('button');
      sw.style.cssText = `width:20px;height:20px;background:${hex};border:1px solid #555;border-radius:3px;cursor:pointer;padding:0;`;
      sw.title = hex;
      sw.addEventListener('click', () => {
        nailMats.forEach(mat => setMatColor(mat, hex));
        sec.querySelectorAll('input[type="color"]').forEach(p => { p.value = hex; });
      });
      presetRow.appendChild(sw);
    });
    presetSec.appendChild(presetRow);
    body.appendChild(sec);
    body.appendChild(presetSec);
  }

  else if (itemId === 'render') {
    // カメラプリセット
    const camSec = makeSection('カメラ');
    const camBtnRow = document.createElement('div');
    camBtnRow.style.cssText = 'display:flex;gap:4px;padding:6px 10px;flex-wrap:wrap;';
    const camPresets = [
      { label:'顔',   pos:[0,1.42,0.45], target:[0,1.38,0] },
      { label:'全身', pos:[0,0.9,2.6],   target:[0,0.9,0]  },
      { label:'横',   pos:[1.8,1.0,0],   target:[0,1.0,0]  },
      { label:'後',   pos:[0,1.0,-2.6],  target:[0,1.0,0]  },
      { label:'上',   pos:[0,3.5,0.1],   target:[0,0.8,0]  },
    ];
    camPresets.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = p.label;
      btn.style.cssText = 'flex:1;min-width:36px;padding:4px 2px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:all 0.1s;';
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--panel3)'; btn.style.color = 'var(--text)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--panel2)'; btn.style.color = 'var(--text2)'; });
      btn.addEventListener('click', () => {
        camera.position.set(...p.pos); orbitCtrl.target.set(...p.target); orbitCtrl.update();
      });
      camBtnRow.appendChild(btn);
    });
    camSec.appendChild(camBtnRow);

    // 自動回転チェック
    const arRow = document.createElement('div');
    arRow.className = 'ctrl-row';
    const arLbl = document.createElement('span'); arLbl.className = 'ctrl-label'; arLbl.textContent = '自動回転';
    const arChk = document.createElement('input'); arChk.type = 'checkbox'; arChk.checked = _autoRotate;
    arChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
    arChk.addEventListener('change', () => { _autoRotate = arChk.checked; });
    arRow.appendChild(arLbl); arRow.appendChild(arChk);
    camSec.appendChild(arRow);

    // 回転速度スライダー
    camSec.appendChild(makeSlider('回転速度', 0.05, 2.0, _autoRotateSpeed, 0.05, v => { _autoRotateSpeed = v; }));

    // FOV スライダー
    camSec.appendChild(makeSlider('視野角(FOV)', 15, 90, camera.fov, 1, v => { camera.fov = v; camera.updateProjectionMatrix(); }));
    // Near clipping (for close-up renders)
    camSec.appendChild(makeSlider('最近クリップ', 0.001, 0.5, camera.near, 0.001, v => { camera.near = v; camera.updateProjectionMatrix(); }));

    // ズームフィット
    const fitBtn = document.createElement('button');
    fitBtn.textContent = 'ズームフィット';
    fitBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:all 0.1s;';
    fitBtn.addEventListener('click', () => {
      if (!currentRoot) return;
      const box = new THREE.Box3().setFromObject(currentRoot);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      orbitCtrl.target.copy(center);
      camera.position.copy(center).addScaledVector(new THREE.Vector3(0, 0.2, 1).normalize(), size * 1.5);
      orbitCtrl.update();
    });
    camSec.appendChild(fitBtn);

    body.appendChild(camSec);

    // ライティング
    const sec = makeSection('ライティング');
    sec.appendChild(makeSlider('明るさ', 0.5, 3.0, renderer.toneMappingExposure, 0.05, v => { renderer.toneMappingExposure = v; }));
    sec.appendChild(makeSlider('太陽光', 0.0, 6.0, sun.intensity, 0.1, v => { sun.intensity = v; }));
    const hemi = scene.children.find(c => c.isHemisphereLight);
    if (hemi) sec.appendChild(makeSlider('環境光', 0.0, 4.0, hemi.intensity, 0.1, v => { hemi.intensity = v; }));
    sec.appendChild(makeSlider('補助光', 0.0, 3.0, fill.intensity, 0.1, v => { fill.intensity = v; }));

    // 3点照明ボタン
    const threePointBtn = document.createElement('button');
    threePointBtn.textContent = '3点照明プリセット';
    threePointBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:all 0.1s;';
    threePointBtn.addEventListener('click', () => {
      sun.intensity = 3.0;
      fill.intensity = 1.2;
      if (hemi) hemi.intensity = 0.6;
      renderer.toneMappingExposure = 1.0;
      body.innerHTML = ''; _buildBodyParams('render');
    });
    sec.appendChild(threePointBtn);

    // トーンマッピング選択
    const tmLbl = document.createElement('div');
    tmLbl.style.cssText = 'padding:4px 10px 2px;font-size:10px;color:var(--text2);';
    tmLbl.textContent = 'トーンマッピング';
    sec.appendChild(tmLbl);
    const tmSelect = document.createElement('select');
    tmSelect.style.cssText = 'margin:2px 10px 6px;width:calc(100% - 20px);background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:10px;padding:3px 4px;';
    const tmOptions = [
      { label:'ACESフィルミック', value: THREE.ACESFilmicToneMapping },
      { label:'リニア', value: THREE.LinearToneMapping },
      { label:'ラインハルト', value: THREE.ReinhardToneMapping },
      { label:'シネオン', value: THREE.CineonToneMapping },
    ];
    tmOptions.forEach(opt => {
      const option = document.createElement('option');
      option.textContent = opt.label;
      option.value = opt.value;
      option.selected = renderer.toneMapping === opt.value;
      tmSelect.appendChild(option);
    });
    tmSelect.addEventListener('change', () => { renderer.toneMapping = parseInt(tmSelect.value); });
    sec.appendChild(tmSelect);

    body.appendChild(sec);

    // 背景・シーン
    const bgSec = makeSection('背景・シーン');
    // 背景色
    const bgColorHex = scene.background instanceof THREE.Color
      ? '#' + scene.background.getHexString(THREE.SRGBColorSpace)
      : '#0d1117';
    bgSec.appendChild(makeColorRow('背景色', 'bg-color', bgColorHex,
      v => { scene.background = new THREE.Color().setStyle(v, THREE.SRGBColorSpace); if (scene.fog?.color) scene.fog.color.setStyle(v, THREE.SRGBColorSpace); },
      () => { scene.background = new THREE.Color(0x0d1117); if (scene.fog?.color) scene.fog.color.setHex(0x0d1117); }
    ));
    // 背景プリセット
    const bgPresets = [
      { label:'暗', color: 0x0d1117 },
      { label:'明', color: 0xf0f0f0 },
      { label:'青', color: 0x1a2a4a },
      { label:'紫', color: 0x2a1a2a },
      { label:'緑', color: 0x0a1a0a },
    ];
    const bgPresetRow = document.createElement('div');
    bgPresetRow.style.cssText = 'display:flex;gap:4px;padding:4px 10px 6px;flex-wrap:wrap;';
    bgPresets.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = p.label;
      btn.style.cssText = 'flex:1;min-width:28px;padding:3px 2px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
      btn.addEventListener('click', () => {
        scene.background = new THREE.Color(p.color);
        if (scene.fog?.color) scene.fog.color.copy(new THREE.Color(p.color));
        body.innerHTML = ''; _buildBodyParams('render');
      });
      bgPresetRow.appendChild(btn);
    });
    bgSec.appendChild(bgPresetRow);

    // 霧の濃さ
    if (scene.fog) bgSec.appendChild(makeSlider('霧の濃さ', 0, 0.2, scene.fog.density || 0.06, 0.005, v => { scene.fog.density = v; }));

    body.appendChild(bgSec);

    // シーン設定
    const sceneSec = makeSection('シーン設定');
    const wfRow = document.createElement('div');
    wfRow.className = 'ctrl-row';
    const wfLbl = document.createElement('span'); wfLbl.className = 'ctrl-label'; wfLbl.textContent = 'ワイヤフレーム';
    const wfChk = document.createElement('input'); wfChk.type = 'checkbox'; wfChk.checked = _wireframeMode;
    wfChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
    wfChk.addEventListener('change', () => {
      _wireframeMode = wfChk.checked;
      sceneObjects.forEach(o => o.root.traverse(obj => {
        [].concat(obj.material || []).forEach(m => { if (m && m.wireframe !== undefined) m.wireframe = _wireframeMode; });
      }));
    });
    wfRow.appendChild(wfLbl); wfRow.appendChild(wfChk);
    sceneSec.appendChild(wfRow);

    const gridRow = document.createElement('div');
    gridRow.className = 'ctrl-row';
    const gridLbl = document.createElement('span'); gridLbl.className = 'ctrl-label'; gridLbl.textContent = 'グリッド表示';
    const gridChk = document.createElement('input'); gridChk.type = 'checkbox'; gridChk.checked = _gridHelper.visible;
    gridChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
    gridChk.addEventListener('change', () => { _gridHelper.visible = gridChk.checked; });
    gridRow.appendChild(gridLbl); gridRow.appendChild(gridChk);
    sceneSec.appendChild(gridRow);

    const shadowRow = document.createElement('div');
    shadowRow.className = 'ctrl-row';
    const shadowLbl = document.createElement('span'); shadowLbl.className = 'ctrl-label'; shadowLbl.textContent = '影を表示';
    const shadowChk = document.createElement('input'); shadowChk.type = 'checkbox'; shadowChk.checked = renderer.shadowMap.enabled;
    shadowChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
    shadowChk.addEventListener('change', () => {
      renderer.shadowMap.enabled = shadowChk.checked;
      // Force shadow map update on next frame
      if (sun?.shadow?.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    });
    shadowRow.appendChild(shadowLbl); shadowRow.appendChild(shadowChk);
    sceneSec.appendChild(shadowRow);

    // 床の表示
    const floorRow = document.createElement('div');
    floorRow.className = 'ctrl-row';
    const floorLbl = document.createElement('span'); floorLbl.className = 'ctrl-label'; floorLbl.textContent = '床を表示';
    const floorChk = document.createElement('input'); floorChk.type = 'checkbox'; floorChk.checked = floor.visible;
    floorChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
    floorChk.addEventListener('change', () => { floor.visible = floorChk.checked; });
    floorRow.appendChild(floorLbl); floorRow.appendChild(floorChk);
    sceneSec.appendChild(floorRow);

    // 床の色
    const floorColorOrig = '#' + floor.material.color.getHexString(THREE.SRGBColorSpace);
    sceneSec.appendChild(makeColorRow('床の色', 'floor-color', floorColorOrig,
      v => floor.material.color.setStyle(v, THREE.SRGBColorSpace),
      () => floor.material.color.setStyle(floorColorOrig, THREE.SRGBColorSpace)
    ));

    // 全オブジェクト表示/非表示
    const showHideRow = document.createElement('div');
    showHideRow.style.cssText = 'display:flex;gap:4px;padding:4px 10px;';
    ['全表示','全非表示'].forEach((lbl, i) => {
      const btn = document.createElement('button');
      btn.textContent = lbl;
      btn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
      btn.addEventListener('click', () => {
      sceneObjects.forEach(o => { o.root.visible = i === 0; });
      const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildSceneItems(b); }
    });
      showHideRow.appendChild(btn);
    });
    sceneSec.appendChild(showHideRow);

    // モデルをセンタリング
    const centerBtn = document.createElement('button');
    centerBtn.textContent = 'モデルをセンター';
    centerBtn.style.cssText = 'margin:2px 10px 6px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    centerBtn.addEventListener('click', () => {
      if (!currentRoot) return;
      const box = new THREE.Box3().setFromObject(currentRoot);
      const center = box.getCenter(new THREE.Vector3());
      currentRoot.position.x -= center.x;
      currentRoot.position.z -= center.z;
    });
    sceneSec.appendChild(centerBtn);

    body.appendChild(sceneSec);

    // 環境マップ
    const envSec = makeSection('環境マップ');
    const envPresets = [
      { label: 'なし', value: 'none' },
      { label: 'スタジオ', value: 'studio' },
      { label: '夕焼け', value: 'sunset' },
      { label: '森', value: 'forest' },
      { label: '都市', value: 'city' },
    ];
    const envRow = document.createElement('div');
    envRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:6px 10px;';
    envPresets.forEach(preset => {
      const btn = document.createElement('button');
      btn.textContent = preset.label;
      const isActive = _currentEnvPreset === preset.value;
      btn.style.cssText = `flex:1;min-width:36px;padding:4px 2px;border-radius:3px;border:1px solid var(--border);background:${isActive ? 'var(--accent-dim)' : 'var(--panel2)'};color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;`;
      btn.addEventListener('click', () => {
        applyEnvPreset(preset.value);
        envRow.querySelectorAll('button').forEach(b => b.style.background = 'var(--panel2)');
        btn.style.background = 'var(--accent-dim)';
      });
      envRow.appendChild(btn);
    });
    envSec.appendChild(envRow);
    body.appendChild(envSec);
  }
}

// ── OUTFIT items + params ─────────────────────────────────
// ── サンプル衣装カタログ ────────────────────────────────────
const SAMPLE_CLOTHES = [
  // トップス
  { name: 'Tシャツ（白）',           cat: 'トップス',     color: '#f5f5f5', shape: 'top'       },
  { name: 'Tシャツ（黒）',           cat: 'トップス',     color: '#1a1a1a', shape: 'top'       },
  { name: 'Tシャツ（赤）',           cat: 'トップス',     color: '#e53935', shape: 'top'       },
  { name: 'Tシャツ（青）',           cat: 'トップス',     color: '#1e88e5', shape: 'top'       },
  { name: 'Tシャツ（緑）',           cat: 'トップス',     color: '#43a047', shape: 'top'       },
  { name: 'Tシャツ（黄）',           cat: 'トップス',     color: '#fdd835', shape: 'top'       },
  { name: 'Tシャツ（紫）',           cat: 'トップス',     color: '#8e24aa', shape: 'top'       },
  { name: 'Tシャツ（オレンジ）',     cat: 'トップス',     color: '#fb8c00', shape: 'top'       },
  { name: 'ストライプシャツ',         cat: 'トップス',     color: '#3d6fcb', shape: 'top'       },
  { name: 'タンクトップ（白）',       cat: 'トップス',     color: '#fafafa', shape: 'tank'      },
  { name: 'タンクトップ（黒）',       cat: 'トップス',     color: '#1a1a1a', shape: 'tank'      },
  { name: 'タンクトップ（赤）',       cat: 'トップス',     color: '#e53935', shape: 'tank'      },
  { name: 'クロップトップ（白）',     cat: 'トップス',     color: '#f5f5f5', shape: 'crop'      },
  { name: 'クロップトップ（黒）',     cat: 'トップス',     color: '#111111', shape: 'crop'      },
  { name: 'クロップトップ（ピンク）', cat: 'トップス',     color: '#f48fb1', shape: 'crop'      },
  { name: 'パーカー（グレー）',       cat: 'トップス',     color: '#808080', shape: 'top_long'  },
  { name: 'パーカー（黒）',           cat: 'トップス',     color: '#1a1a1a', shape: 'top_long'  },
  { name: 'スウェット（グレー）',     cat: 'トップス',     color: '#9e9e9e', shape: 'top_long'  },
  { name: 'スウェット（ネイビー）',   cat: 'トップス',     color: '#1a237e', shape: 'top_long'  },
  { name: 'ニット（ベージュ）',       cat: 'トップス',     color: '#c8a87a', shape: 'top_long'  },
  { name: 'ニット（白）',             cat: 'トップス',     color: '#f0f0f0', shape: 'top_long'  },
  { name: 'タートルネック（黒）',     cat: 'トップス',     color: '#0d0d0d', shape: 'top_long'  },
  { name: 'タートルネック（白）',     cat: 'トップス',     color: '#f5f5f5', shape: 'top_long'  },
  { name: 'ブラウス（ホワイト）',     cat: 'トップス',     color: '#fafafa', shape: 'top'       },
  { name: 'ブラウス（ベージュ）',     cat: 'トップス',     color: '#d7c4a3', shape: 'top'       },
  { name: 'ワイシャツ（白）',         cat: 'トップス',     color: '#f8f8f8', shape: 'top'       },
  { name: 'ポロシャツ（紺）',         cat: 'トップス',     color: '#1a237e', shape: 'top'       },
  // ボトムス
  { name: 'ジーンズ（ブルー）',       cat: 'ボトムス',     color: '#3355aa', shape: 'pants'     },
  { name: 'ジーンズ（黒）',           cat: 'ボトムス',     color: '#1a1a1a', shape: 'pants'     },
  { name: 'ジーンズ（グレー）',       cat: 'ボトムス',     color: '#5a5a5a', shape: 'pants'     },
  { name: 'スラックス（黒）',         cat: 'ボトムス',     color: '#0d0d0d', shape: 'pants'     },
  { name: 'スラックス（グレー）',     cat: 'ボトムス',     color: '#5a5a5a', shape: 'pants'     },
  { name: 'カーゴパンツ（カーキ）',   cat: 'ボトムス',     color: '#78866b', shape: 'pants'     },
  { name: 'ワイドパンツ（ベージュ）', cat: 'ボトムス',     color: '#d2b48c', shape: 'pants'     },
  { name: 'ショートパンツ（デニム）', cat: 'ボトムス',     color: '#5566bb', shape: 'shorts'    },
  { name: 'ショートパンツ（黒）',     cat: 'ボトムス',     color: '#1a1a1a', shape: 'shorts'    },
  { name: 'ショートパンツ（白）',     cat: 'ボトムス',     color: '#f0f0f0', shape: 'shorts'    },
  { name: 'ショートパンツ（カーキ）', cat: 'ボトムス',     color: '#78866b', shape: 'shorts'    },
  { name: 'ミニスカート（白）',       cat: 'ボトムス',     color: '#f0f0f0', shape: 'skirt_mini'},
  { name: 'ミニスカート（黒）',       cat: 'ボトムス',     color: '#111111', shape: 'skirt_mini'},
  { name: 'プリーツスカート（黒）',   cat: 'ボトムス',     color: '#1c1c1c', shape: 'skirt'     },
  { name: 'プリーツスカート（白）',   cat: 'ボトムス',     color: '#f0f0f0', shape: 'skirt'     },
  { name: 'プリーツスカート（紺）',   cat: 'ボトムス',     color: '#1a237e', shape: 'skirt'     },
  { name: 'フレアスカート（ピンク）', cat: 'ボトムス',     color: '#f48fb1', shape: 'skirt'     },
  { name: 'フレアスカート（青）',     cat: 'ボトムス',     color: '#42a5f5', shape: 'skirt'     },
  { name: 'マキシスカート（白）',     cat: 'ボトムス',     color: '#f8f8f8', shape: 'skirt_long'},
  { name: 'マキシスカート（黒）',     cat: 'ボトムス',     color: '#111111', shape: 'skirt_long'},
  { name: 'マキシスカート（ベージュ）', cat: 'ボトムス',   color: '#d2b48c', shape: 'skirt_long'},
  // ワンピース
  { name: 'ワンピース（白）',         cat: 'ワンピース',   color: '#f8f8f8', shape: 'dress'     },
  { name: 'ワンピース（黒）',         cat: 'ワンピース',   color: '#111111', shape: 'dress'     },
  { name: 'ワンピース（赤）',         cat: 'ワンピース',   color: '#e53935', shape: 'dress'     },
  { name: 'ワンピース（ネイビー）',   cat: 'ワンピース',   color: '#1a237e', shape: 'dress'     },
  { name: 'ワンピース（ピンク）',     cat: 'ワンピース',   color: '#f48fb1', shape: 'dress'     },
  { name: 'フローラルドレス',         cat: 'ワンピース',   color: '#e91e8c', shape: 'dress'     },
  { name: 'サマードレス（水色）',     cat: 'ワンピース',   color: '#80deea', shape: 'dress'     },
  { name: 'ロングドレス（紫）',       cat: 'ワンピース',   color: '#7e57c2', shape: 'dress_long'},
  { name: 'ロングドレス（赤）',       cat: 'ワンピース',   color: '#c62828', shape: 'dress_long'},
  { name: 'ロングドレス（黒）',       cat: 'ワンピース',   color: '#0d0d0d', shape: 'dress_long'},
  { name: 'ロングドレス（白）',       cat: 'ワンピース',   color: '#f8f8f8', shape: 'dress_long'},
  { name: 'ウェディングドレス',       cat: 'ワンピース',   color: '#fffafa', shape: 'dress_long'},
  // アウター
  { name: 'コート（ベージュ）',       cat: 'アウター',     color: '#c8a870', shape: 'coat'      },
  { name: 'コート（黒）',             cat: 'アウター',     color: '#0d0d0d', shape: 'coat'      },
  { name: 'コート（グレー）',         cat: 'アウター',     color: '#757575', shape: 'coat'      },
  { name: 'トレンチコート（ベージュ）', cat: 'アウター',   color: '#c19a6b', shape: 'coat'      },
  { name: 'ダウンジャケット（白）',   cat: 'アウター',     color: '#eeeeee', shape: 'coat'      },
  { name: 'ダウンジャケット（黒）',   cat: 'アウター',     color: '#111111', shape: 'coat'      },
  { name: 'ブレザー（黒）',           cat: 'アウター',     color: '#0d0d0d', shape: 'coat'      },
  { name: 'ジャケット（白）',         cat: 'アウター',     color: '#f0f0f0', shape: 'coat'      },
  { name: 'ジャケット（ネイビー）',   cat: 'アウター',     color: '#1a237e', shape: 'coat'      },
  { name: 'デニムジャケット（ブルー）', cat: 'アウター',   color: '#4a6fa5', shape: 'coat'      },
  { name: 'レザージャケット（黒）',   cat: 'アウター',     color: '#1a0a00', shape: 'coat'      },
  { name: 'カーディガン（ベージュ）', cat: 'アウター',     color: '#c8a87a', shape: 'top_long'  },
  { name: 'カーディガン（グレー）',   cat: 'アウター',     color: '#808080', shape: 'top_long'  },
  { name: 'ベスト（黒）',             cat: 'アウター',     color: '#111111', shape: 'vest'      },
  { name: 'ベスト（グレー）',         cat: 'アウター',     color: '#616161', shape: 'vest'      },
  { name: 'ケープ（黒）',             cat: 'アウター',     color: '#0d0d0d', shape: 'cape'      },
  { name: 'ケープ（ベージュ）',       cat: 'アウター',     color: '#c8a870', shape: 'cape'      },
  // 靴
  { name: 'スニーカー（白）',         cat: '靴',           color: '#f0f0f0', shape: 'shoes'     },
  { name: 'スニーカー（黒）',         cat: '靴',           color: '#111111', shape: 'shoes'     },
  { name: 'スニーカー（赤）',         cat: '靴',           color: '#e53935', shape: 'shoes'     },
  { name: 'スニーカー（ネイビー）',   cat: '靴',           color: '#1a237e', shape: 'shoes'     },
  { name: 'ヒール（黒）',             cat: '靴',           color: '#111111', shape: 'heels'     },
  { name: 'ヒール（赤）',             cat: '靴',           color: '#c62828', shape: 'heels'     },
  { name: 'ヒール（ベージュ）',       cat: '靴',           color: '#d2b48c', shape: 'heels'     },
  { name: 'ヒール（白）',             cat: '靴',           color: '#f5f5f5', shape: 'heels'     },
  { name: 'ブーツ（ブラウン）',       cat: '靴',           color: '#5d3a1a', shape: 'boots'     },
  { name: 'ブーツ（黒）',             cat: '靴',           color: '#111111', shape: 'boots'     },
  { name: 'ブーツ（白）',             cat: '靴',           color: '#f0f0f0', shape: 'boots'     },
  { name: 'ロングブーツ（黒）',       cat: '靴',           color: '#0d0d0d', shape: 'boots_long'},
  { name: 'ロングブーツ（茶）',       cat: '靴',           color: '#5d3a1a', shape: 'boots_long'},
  { name: 'サンダル（ベージュ）',     cat: '靴',           color: '#d2b48c', shape: 'sandals'   },
  { name: 'サンダル（黒）',           cat: '靴',           color: '#111111', shape: 'sandals'   },
  { name: 'パンプス（黒）',           cat: '靴',           color: '#111111', shape: 'heels'     },
  { name: 'ローファー（ブラウン）',   cat: '靴',           color: '#6d4c41', shape: 'shoes'     },
  // ソックス・レッグウェア
  { name: 'ソックス（白）',           cat: 'ソックス',     color: '#f5f5f5', shape: 'socks'     },
  { name: 'ソックス（黒）',           cat: 'ソックス',     color: '#111111', shape: 'socks'     },
  { name: 'ソックス（グレー）',       cat: 'ソックス',     color: '#9e9e9e', shape: 'socks'     },
  { name: 'ニーハイソックス（白）',   cat: 'ソックス',     color: '#f0f0f0', shape: 'socks_knee'},
  { name: 'ニーハイソックス（黒）',   cat: 'ソックス',     color: '#111111', shape: 'socks_knee'},
  { name: 'ニーハイソックス（紺）',   cat: 'ソックス',     color: '#1a237e', shape: 'socks_knee'},
  { name: 'タイツ（黒）',             cat: 'ソックス',     color: '#0d0d0d', shape: 'tights'    },
  { name: 'タイツ（ネイビー）',       cat: 'ソックス',     color: '#1a237e', shape: 'tights'    },
  // アクセサリー
  { name: 'リボン（赤）',             cat: 'アクセサリー', color: '#e53935', shape: 'ribbon'    },
  { name: 'リボン（黒）',             cat: 'アクセサリー', color: '#111111', shape: 'ribbon'    },
  { name: 'リボン（ピンク）',         cat: 'アクセサリー', color: '#f48fb1', shape: 'ribbon'    },
  { name: 'リボン（紺）',             cat: 'アクセサリー', color: '#1a237e', shape: 'ribbon'    },
  { name: 'マフラー（ホワイト）',     cat: 'アクセサリー', color: '#f5f5f5', shape: 'scarf'     },
  { name: 'マフラー（グレー）',       cat: 'アクセサリー', color: '#9e9e9e', shape: 'scarf'     },
  { name: 'マフラー（赤）',           cat: 'アクセサリー', color: '#e53935', shape: 'scarf'     },
  { name: 'マフラー（ネイビー）',     cat: 'アクセサリー', color: '#1a237e', shape: 'scarf'     },
  { name: 'ベルト（黒）',             cat: 'アクセサリー', color: '#0a0a0a', shape: 'belt'      },
  { name: 'ベルト（茶）',             cat: 'アクセサリー', color: '#5d3a1a', shape: 'belt'      },
  { name: 'ベルト（白）',             cat: 'アクセサリー', color: '#f0f0f0', shape: 'belt'      },
  { name: 'グローブ（黒）',           cat: 'アクセサリー', color: '#111111', shape: 'gloves'    },
  { name: 'グローブ（白）',           cat: 'アクセサリー', color: '#f5f5f5', shape: 'gloves'    },
  { name: 'グローブ（ブラウン）',     cat: 'アクセサリー', color: '#5d3a1a', shape: 'gloves'    },
  { name: 'ハット（黒）',             cat: 'アクセサリー', color: '#111111', shape: 'hat'       },
  { name: 'ハット（白）',             cat: 'アクセサリー', color: '#f5f5f5', shape: 'hat'       },
  { name: 'ハット（ベージュ）',       cat: 'アクセサリー', color: '#d2b48c', shape: 'hat'       },
  { name: 'ネクタイ（赤）',           cat: 'アクセサリー', color: '#c62828', shape: 'tie'       },
  { name: 'ネクタイ（紺）',           cat: 'アクセサリー', color: '#1a237e', shape: 'tie'       },
  { name: 'ネクタイ（黒）',           cat: 'アクセサリー', color: '#111111', shape: 'tie'       },
  { name: 'メガネ（黒）',             cat: 'アクセサリー', color: '#111111', shape: 'glasses'   },
  { name: 'メガネ（ゴールド）',       cat: 'アクセサリー', color: '#c8a000', shape: 'glasses'   },
  { name: 'サングラス（黒）',         cat: 'アクセサリー', color: '#0a0a0a', shape: 'glasses'   },
];

function createClothingMesh(item) {
  const col = new THREE.Color(item.color);
  const mk = (geo, y, name, c) => {
    const m = new THREE.MeshStandardMaterial({ color: c ?? col.clone(), roughness: 0.65, metalness: 0.04 });
    m.name = name + '_mat';
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name;
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const group = new THREE.Group();
  group.name = item.name;

  switch (item.shape) {
    case 'top': {
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.12, 0.38, 16), 1.05, item.name));
      const sg = new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8);
      const sl = mk(sg, 1.2, item.name + '_sleeveL');
      sl.rotation.z = Math.PI / 2.4; sl.position.x = -0.20;
      const sr = mk(sg.clone(), 1.2, item.name + '_sleeveR');
      sr.rotation.z = -Math.PI / 2.4; sr.position.x = 0.20;
      group.add(sl, sr);
      break;
    }
    case 'tank': {
      group.add(mk(new THREE.CylinderGeometry(0.125, 0.115, 0.36, 16), 1.05, item.name));
      break;
    }
    case 'top_long': {
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.125, 0.5, 16), 0.97, item.name));
      const sg = new THREE.CylinderGeometry(0.04, 0.038, 0.38, 8);
      const sl = mk(sg, 1.15, item.name + '_sleeveL');
      sl.rotation.z = Math.PI / 2.3; sl.position.x = -0.22;
      const sr = mk(sg.clone(), 1.15, item.name + '_sleeveR');
      sr.rotation.z = -Math.PI / 2.3; sr.position.x = 0.22;
      group.add(sl, sr);
      break;
    }
    case 'coat': {
      group.add(mk(new THREE.CylinderGeometry(0.14, 0.135, 0.72, 16), 0.88, item.name));
      const sg = new THREE.CylinderGeometry(0.043, 0.04, 0.52, 8);
      const sl = mk(sg, 1.1, item.name + '_sleeveL');
      sl.rotation.z = Math.PI / 2.3; sl.position.x = -0.23;
      const sr = mk(sg.clone(), 1.1, item.name + '_sleeveR');
      sr.rotation.z = -Math.PI / 2.3; sr.position.x = 0.23;
      group.add(sl, sr);
      break;
    }
    case 'pants': {
      const lg = new THREE.CylinderGeometry(0.075, 0.065, 0.72, 12);
      const ll = mk(lg, 0.41, item.name + '_L');  ll.position.x = -0.075;
      const rl = mk(lg.clone(), 0.41, item.name + '_R'); rl.position.x = 0.075;
      group.add(ll, rl);
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.13, 0.1, 16), 0.82, item.name + '_waist'));
      break;
    }
    case 'shorts': {
      const sg = new THREE.CylinderGeometry(0.077, 0.072, 0.24, 12);
      const ll = mk(sg, 0.665, item.name + '_L'); ll.position.x = -0.075;
      const rl = mk(sg.clone(), 0.665, item.name + '_R'); rl.position.x = 0.075;
      group.add(ll, rl);
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16), 0.81, item.name + '_waist'));
      break;
    }
    case 'skirt': {
      group.add(mk(new THREE.CylinderGeometry(0.15, 0.26, 0.42, 18, 1, true), 0.65, item.name));
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 16), 0.88, item.name + '_waist'));
      break;
    }
    case 'skirt_mini': {
      group.add(mk(new THREE.CylinderGeometry(0.14, 0.21, 0.22, 18, 1, true), 0.76, item.name));
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 16), 0.88, item.name + '_waist'));
      break;
    }
    case 'dress': {
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.12, 0.34, 16), 1.06, item.name + '_top'));
      group.add(mk(new THREE.CylinderGeometry(0.15, 0.28, 0.52, 18, 1, true), 0.61, item.name + '_skirt'));
      break;
    }
    case 'dress_long': {
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.12, 0.34, 16), 1.06, item.name + '_top'));
      group.add(mk(new THREE.CylinderGeometry(0.145, 0.22, 0.9, 18, 1, true), 0.32, item.name + '_skirt'));
      break;
    }
    case 'shoes': {
      const sg = new THREE.BoxGeometry(0.1, 0.05, 0.2);
      const ls = mk(sg, 0.025, item.name + '_L'); ls.position.x = -0.075; ls.position.z = 0.02;
      const rs = mk(sg.clone(), 0.025, item.name + '_R'); rs.position.x = 0.075; rs.position.z = 0.02;
      group.add(ls, rs);
      break;
    }
    case 'heels': {
      const sg = new THREE.BoxGeometry(0.09, 0.03, 0.18);
      const hg = new THREE.CylinderGeometry(0.015, 0.012, 0.09, 6);
      const ls = mk(sg, 0.015, item.name + '_L'); ls.position.x = -0.075; ls.position.z = 0.01;
      const lh = mk(hg, 0.045, item.name + '_heelL'); lh.position.x = -0.075; lh.position.z = -0.07;
      const rs = mk(sg.clone(), 0.015, item.name + '_R'); rs.position.x = 0.075; rs.position.z = 0.01;
      const rh = mk(hg.clone(), 0.045, item.name + '_heelR'); rh.position.x = 0.075; rh.position.z = -0.07;
      group.add(ls, lh, rs, rh);
      break;
    }
    case 'boots': {
      const bg = new THREE.CylinderGeometry(0.055, 0.05, 0.32, 10);
      const lb = mk(bg, 0.16, item.name + '_L'); lb.position.x = -0.075;
      const rb = mk(bg.clone(), 0.16, item.name + '_R'); rb.position.x = 0.075;
      group.add(lb, rb);
      break;
    }
    case 'ribbon': {
      const rg = new THREE.TorusGeometry(0.04, 0.012, 6, 20);
      const r = mk(rg, 1.42, item.name); r.position.z = 0.13;
      group.add(r);
      break;
    }
    case 'scarf': {
      const sg = new THREE.TorusGeometry(0.09, 0.026, 6, 20);
      const s = mk(sg, 1.28, item.name);
      group.add(s);
      break;
    }
    case 'belt': {
      const bg = new THREE.TorusGeometry(0.135, 0.013, 6, 32);
      const b = mk(bg, 0.83, item.name); b.rotation.x = Math.PI / 2;
      group.add(b);
      break;
    }
    case 'crop': {
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.12, 0.2, 16), 1.13, item.name));
      const sg = new THREE.CylinderGeometry(0.038, 0.036, 0.1, 8);
      const sl = mk(sg, 1.2, item.name + '_sleeveL');
      sl.rotation.z = Math.PI / 2.4; sl.position.x = -0.18;
      const sr = mk(sg.clone(), 1.2, item.name + '_sleeveR');
      sr.rotation.z = -Math.PI / 2.4; sr.position.x = 0.18;
      group.add(sl, sr);
      break;
    }
    case 'vest': {
      group.add(mk(new THREE.CylinderGeometry(0.132, 0.128, 0.46, 16), 0.98, item.name));
      break;
    }
    case 'cape': {
      group.add(mk(new THREE.CylinderGeometry(0.28, 0.34, 0.6, 16, 1, true), 0.9, item.name));
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 16), 1.22, item.name + '_shoulder'));
      break;
    }
    case 'skirt_long': {
      group.add(mk(new THREE.CylinderGeometry(0.14, 0.2, 0.75, 18, 1, true), 0.47, item.name));
      group.add(mk(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 16), 0.88, item.name + '_waist'));
      break;
    }
    case 'boots_long': {
      const bg = new THREE.CylinderGeometry(0.055, 0.048, 0.56, 10);
      const lb = mk(bg, 0.28, item.name + '_L'); lb.position.x = -0.075;
      const rb = mk(bg.clone(), 0.28, item.name + '_R'); rb.position.x = 0.075;
      group.add(lb, rb);
      break;
    }
    case 'sandals': {
      const sg = new THREE.BoxGeometry(0.1, 0.025, 0.19);
      const ls = mk(sg, 0.012, item.name + '_L'); ls.position.x = -0.075; ls.position.z = 0.01;
      const rs = mk(sg.clone(), 0.012, item.name + '_R'); rs.position.x = 0.075; rs.position.z = 0.01;
      const sg2 = new THREE.BoxGeometry(0.1, 0.01, 0.02);
      const lt = mk(sg2, 0.04, item.name + '_strapL'); lt.position.x = -0.075; lt.position.z = 0.04;
      const rt = mk(sg2.clone(), 0.04, item.name + '_strapR'); rt.position.x = 0.075; rt.position.z = 0.04;
      group.add(ls, rs, lt, rt);
      break;
    }
    case 'socks': {
      const sg = new THREE.CylinderGeometry(0.053, 0.05, 0.14, 10);
      const ll = mk(sg, 0.07, item.name + '_L'); ll.position.x = -0.075;
      const rl = mk(sg.clone(), 0.07, item.name + '_R'); rl.position.x = 0.075;
      group.add(ll, rl);
      break;
    }
    case 'socks_knee': {
      const sg = new THREE.CylinderGeometry(0.054, 0.05, 0.42, 10);
      const ll = mk(sg, 0.21, item.name + '_L'); ll.position.x = -0.075;
      const rl = mk(sg.clone(), 0.21, item.name + '_R'); rl.position.x = 0.075;
      group.add(ll, rl);
      break;
    }
    case 'tights': {
      const lg = new THREE.CylinderGeometry(0.052, 0.046, 0.82, 10);
      const ll = mk(lg, 0.41, item.name + '_L'); ll.position.x = -0.068;
      const rl = mk(lg.clone(), 0.41, item.name + '_R'); rl.position.x = 0.068;
      group.add(ll, rl);
      const waist = mk(new THREE.CylinderGeometry(0.13, 0.128, 0.08, 16), 0.86, item.name + '_waist');
      group.add(waist);
      break;
    }
    case 'gloves': {
      const sg = new THREE.CylinderGeometry(0.035, 0.03, 0.15, 8);
      const lg = mk(sg, 0.85, item.name + '_L'); lg.position.x = -0.22;
      const rg = mk(sg.clone(), 0.85, item.name + '_R'); rg.position.x = 0.22;
      group.add(lg, rg);
      break;
    }
    case 'hat': {
      const brim = new THREE.CylinderGeometry(0.16, 0.17, 0.03, 20);
      const top = new THREE.CylinderGeometry(0.1, 0.1, 0.18, 16);
      group.add(mk(brim, 1.56, item.name + '_brim'));
      group.add(mk(top, 1.65, item.name + '_top'));
      break;
    }
    case 'tie': {
      const tg = new THREE.BoxGeometry(0.03, 0.28, 0.012);
      const t = mk(tg, 1.1, item.name); t.position.z = 0.14;
      group.add(t);
      break;
    }
    case 'glasses': {
      const lg = new THREE.TorusGeometry(0.028, 0.006, 6, 16);
      const lf = mk(lg, 1.6, item.name + '_L'); lf.position.x = -0.035;
      const rf = mk(lg.clone(), 1.6, item.name + '_R'); rf.position.x = 0.035;
      const bridge = mk(new THREE.BoxGeometry(0.01, 0.005, 0.005), 1.6, item.name + '_bridge');
      group.add(lf, rf, bridge);
      break;
    }
    default: {
      group.add(mk(new THREE.CylinderGeometry(0.13, 0.12, 0.3, 16), 1.0, item.name));
    }
  }
  return group;
}

function _isBodyMaterial(name) {
  const n = name || '';
  return (
    /eyebrow|eyelash|brow(?!n)|EyelashAndBrows/i.test(n) ||
    /eyeiris|iris|pupil|eyewhite|sclera|EyeHighlight|Eye(?!lash|brow)/i.test(n) ||
    /hair/i.test(n) ||
    /FaceHead|Face(?!lash)|Cheek|Forehead|face(?!lash)/i.test(n) ||
    (/body(?!ttom)|Skin(?!ny)/i.test(n) && !/hair|eye/i.test(n))
  );
}

function _buildOutfitItems(body) {
  if (sceneObjects.length === 0) {
    body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>';
    return;
  }

  _setItemsTitle('衣装パーツ');

  // 「衣装を追加」+ 「全削除」ボタン行
  const addRow = document.createElement('div');
  addRow.style.cssText = 'padding:8px 10px 6px;border-bottom:1px solid var(--border);display:flex;gap:6px;';
  const addBtn = document.createElement('button');
  addBtn.textContent = '＋ 衣装を追加';
  addBtn.style.cssText = 'flex:1;padding:6px 0;background:var(--panel3,#2a2a3e);border:1px dashed var(--border2,rgba(255,255,255,0.1));border-radius:var(--r,4px);color:var(--accent,#e0529c);font-size:10px;font-weight:700;cursor:pointer;transition:background 0.12s;';
  addBtn.addEventListener('mouseenter', () => { addBtn.style.background = 'var(--accent-dim,rgba(224,82,156,0.14))'; });
  addBtn.addEventListener('mouseleave', () => { addBtn.style.background = 'var(--panel3,#2a2a3e)'; });
  addBtn.addEventListener('click', () => pickFile('.vrm,.glb,.gltf', (f) => addClothingToScene(URL.createObjectURL(f), f.name)));

  const removeAllBtn = document.createElement('button');
  removeAllBtn.textContent = '全削除';
  removeAllBtn.style.cssText = 'padding:6px 10px;background:var(--panel3,#2a2a3e);border:1px solid var(--border);border-radius:var(--r,4px);color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:background 0.12s;';
  removeAllBtn.addEventListener('click', () => {
    const clothingIds = sceneObjects.filter(o => o.isClothing).map(o => o.id);
    clothingIds.forEach(id => removeObject(id));
    const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildOutfitItems(b); }
  });

  addRow.appendChild(addBtn); addRow.appendChild(removeAllBtn);
  body.appendChild(addRow);

  // 装着中の衣装オブジェクト一覧（削除ボタン付き）
  const clothingObjs = sceneObjects.filter(o => o.isClothing);
  if (clothingObjs.length > 0) {
    const wornSec = document.createElement('div');
    wornSec.style.cssText = 'border-bottom:1px solid var(--border);';
    const wornHdr = document.createElement('div');
    wornHdr.style.cssText = 'font-size:9px;font-weight:800;color:var(--text3);letter-spacing:0.5px;text-transform:uppercase;padding:5px 12px 3px;';
    wornHdr.textContent = '装着中の衣装';
    wornSec.appendChild(wornHdr);
    clothingObjs.forEach(obj => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px;';
      const nameLbl = document.createElement('span');
      nameLbl.style.cssText = 'flex:1;font-size:10px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      nameLbl.textContent = obj.name;
      const visBtn = document.createElement('button');
      visBtn.textContent = obj.root.visible ? '表' : '非';
      visBtn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:3px;font-size:9px;font-weight:700;padding:1px 5px;cursor:pointer;color:var(--text2);flex-shrink:0;';
      visBtn.addEventListener('click', () => { obj.root.visible = !obj.root.visible; visBtn.textContent = obj.root.visible ? '表' : '非'; });
      const delBtn = document.createElement('button');
      delBtn.textContent = '削除';
      delBtn.style.cssText = 'background:none;border:1px solid rgba(248,113,113,0.3);border-radius:3px;font-size:9px;font-weight:700;padding:1px 5px;cursor:pointer;color:#f87171;flex-shrink:0;';
      delBtn.addEventListener('click', () => { removeObject(obj.id); const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildOutfitItems(b); } });
      row.appendChild(nameLbl); row.appendChild(visBtn); row.appendChild(delBtn);
      wornSec.appendChild(row);
    });
    body.appendChild(wornSec);
  }

  // サンプル衣装グリッド
  const sampleSec = document.createElement('div');
  sampleSec.style.cssText = 'border-bottom:1px solid var(--border);';
  const sampleHdr = document.createElement('div');
  sampleHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px 4px;cursor:pointer;user-select:none;';
  const sampleTitle = document.createElement('span');
  sampleTitle.style.cssText = 'font-size:9px;font-weight:800;color:var(--text3);letter-spacing:0.5px;text-transform:uppercase;';
  sampleTitle.textContent = 'サンプル衣装';
  const sampleToggle = document.createElement('span');
  sampleToggle.style.cssText = 'font-size:9px;color:var(--text3);';
  sampleToggle.textContent = '▼';
  sampleHdr.appendChild(sampleTitle);
  sampleHdr.appendChild(sampleToggle);

  // 衣装検索
  const outfitSearchRow = document.createElement('div');
  outfitSearchRow.style.cssText = 'padding:4px 8px;';
  const outfitSearchInp = document.createElement('input');
  outfitSearchInp.type = 'text';
  outfitSearchInp.placeholder = '衣装を検索...';
  outfitSearchInp.style.cssText = 'width:100%;padding:3px 7px;background:var(--panel2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-size:10px;outline:none;';
  outfitSearchRow.appendChild(outfitSearchInp);

  const sampleGrid = document.createElement('div');
  sampleGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:4px 8px 8px;';

  // カテゴリ別グループ
  const catOrder = ['トップス','ボトムス','ワンピース','アウター','靴','ソックス','アクセサリー'];

  // カテゴリタブ
  const catTabsRow = document.createElement('div');
  catTabsRow.style.cssText = 'display:flex;gap:2px;padding:3px 8px;overflow-x:auto;flex-wrap:nowrap;';
  let activeCatFilter = '全て';
  const catTabBtns = [];
  ['全て', ...catOrder].forEach(cat => {
    const tab = document.createElement('button');
    tab.textContent = cat;
    tab.style.cssText = `padding:2px 6px;border-radius:3px;border:1px solid var(--border);background:${cat === '全て' ? 'var(--accent-dim)' : 'var(--panel2)'};color:${cat === '全て' ? 'var(--accent)' : 'var(--text2)'};font-size:8px;font-weight:700;cursor:pointer;white-space:nowrap;`;
    tab.addEventListener('click', () => {
      activeCatFilter = cat;
      catTabBtns.forEach(b => { b.style.background = 'var(--panel2)'; b.style.color = 'var(--text2)'; });
      tab.style.background = 'var(--accent-dim)'; tab.style.color = 'var(--accent)';
      filterOutfitGrid();
    });
    catTabsRow.appendChild(tab);
    catTabBtns.push(tab);
  });

  const allCatLabels = [];
  const allBtns = [];

  catOrder.forEach(cat => {
    const items = SAMPLE_CLOTHES.filter(c => c.cat === cat);
    if (!items.length) return;
    const catLabel = document.createElement('div');
    catLabel.style.cssText = 'grid-column:1/-1;font-size:8px;font-weight:800;color:var(--text3);letter-spacing:0.5px;text-transform:uppercase;padding:5px 2px 2px;';
    catLabel.textContent = cat;
    catLabel.dataset.cat = cat;
    sampleGrid.appendChild(catLabel);
    allCatLabels.push(catLabel);
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 7px;background:var(--panel,#242434);border:1px solid var(--border);border-radius:var(--r,4px);cursor:pointer;transition:all 0.1s;text-align:left;width:100%;';
      btn.dataset.name = item.name;
      btn.dataset.cat = cat;
      const sw = document.createElement('div');
      sw.style.cssText = `width:12px;height:12px;border-radius:2px;flex-shrink:0;background:${item.color};border:1px solid rgba(255,255,255,0.15);`;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:10px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;';
      lbl.textContent = item.name;
      btn.appendChild(sw);
      btn.appendChild(lbl);
      btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--panel3,#2a2a3e)'; btn.style.borderColor = 'var(--border2)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--panel,#242434)'; btn.style.borderColor = 'var(--border)'; });
      btn.addEventListener('click', () => {
        if (sceneObjects.length === 0) return;
        const group = createClothingMesh(item);
        scene.add(group);
        const id = Math.random().toString(36).slice(2);
        sceneObjects.push({ id, name: item.name, root: group, vrm: null, mixer: null, clips: [], currentAction: null, isClothing: true });
        setStatus(item.name + ' を追加'); setTimeout(() => setStatus(''), 2000);
        const b = _getItemsBody();
        if (b) { b.innerHTML = ''; _buildOutfitItems(b); }
      });
      sampleGrid.appendChild(btn);
      allBtns.push(btn);
    });
  });

  function filterOutfitGrid() {
    const q = outfitSearchInp.value.toLowerCase();
    let visibleCats = new Set();
    allBtns.forEach(btn => {
      const nameMatch = !q || btn.dataset.name.toLowerCase().includes(q);
      const catMatch = activeCatFilter === '全て' || btn.dataset.cat === activeCatFilter;
      const show = nameMatch && catMatch;
      btn.style.display = show ? '' : 'none';
      if (show) visibleCats.add(btn.dataset.cat);
    });
    allCatLabels.forEach(lbl => {
      lbl.style.display = visibleCats.has(lbl.dataset.cat) ? '' : 'none';
    });
  }
  outfitSearchInp.addEventListener('input', filterOutfitGrid);

  let sampleOpen = true;
  sampleHdr.addEventListener('click', () => {
    sampleOpen = !sampleOpen;
    sampleGrid.style.display = sampleOpen ? 'grid' : 'none';
    sampleToggle.textContent = sampleOpen ? '▼' : '▶';
  });
  sampleSec.appendChild(sampleHdr);
  sampleSec.appendChild(outfitSearchRow);
  sampleSec.appendChild(catTabsRow);
  sampleSec.appendChild(sampleGrid);
  body.appendChild(sampleSec);

  // 全シーンオブジェクトから衣装マテリアルを収集
  const outfitMats = [];
  const seen = new Set();
  sceneObjects.forEach(sceneObj => {
    const isClothing = !!sceneObj.isClothing;
    sceneObj.root.traverse(obj => {
      if (!obj.isMesh) return;
      [].concat(obj.material || []).forEach(m => {
        if (!m || seen.has(m.uuid)) return;
        // ベースアバターは肉体・肌・髪・目を除外。衣装オブジェクトは全て表示
        if (!isClothing && _isBodyMaterial(m.name)) return;
        seen.add(m.uuid);
        outfitMats.push({ mat: m, mesh: obj, sourceName: sceneObj.name });
      });
    });
  });

  if (outfitMats.length === 0) {
    _clearParams('サンプルから衣装を選択してください');
    return;
  }

  // 全表示/全非表示トグル
  const visToggleRow = document.createElement('div');
  visToggleRow.style.cssText = 'padding:4px 10px;border-bottom:1px solid var(--border);display:flex;gap:4px;';
  ['全表示', '全非表示'].forEach((lbl, i) => {
    const btn = document.createElement('button');
    btn.textContent = lbl;
    btn.style.cssText = 'flex:1;padding:3px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;transition:background 0.1s;';
    btn.addEventListener('click', () => {
      // Toggle mesh-level visibility
      outfitMats.forEach(({ mesh }) => { mesh.visible = i === 0; });
      const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildOutfitItems(b); }
    });
    visToggleRow.appendChild(btn);
  });
  body.appendChild(visToggleRow);

  const list = document.createElement('div');
  list.className = 'item-list';

  // 複数ソースがある場合はソースラベルを表示
  const sources = [...new Set(outfitMats.map(o => o.sourceName))];
  const multiSource = sources.length > 1;
  let lastSource = null;

  outfitMats.forEach(({ mat, mesh, sourceName }, i) => {
    if (multiSource && sourceName !== lastSource) {
      lastSource = sourceName;
      const sep = document.createElement('div');
      sep.style.cssText = 'padding:5px 12px 3px;font-size:9px;font-weight:800;color:var(--text3,#686884);letter-spacing:0.5px;text-transform:uppercase;border-top:1px solid var(--border);';
      sep.textContent = sourceName;
      list.appendChild(sep);
    }

    const rid = 'outfit_' + i;
    const row = document.createElement('div');
    row.className = 'item-list-row' + (_currentItem === rid ? ' selected' : '');

    const swatch = document.createElement('div');
    swatch.style.cssText = `width:16px;height:16px;border-radius:3px;flex-shrink:0;border:1px solid rgba(255,255,255,0.15);background:${matColorHex(mat)};`;

    // 表示切替（テキスト）
    const visBtn = document.createElement('button');
    visBtn.textContent = mesh.visible ? '表' : '非';
    visBtn.title = '表示切替';
    visBtn.style.cssText = `background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:9px;font-weight:700;padding:1px 4px;flex-shrink:0;color:${mesh.visible ? 'var(--text2)' : 'var(--text3)'};`;
    visBtn.addEventListener('click', e => {
      e.stopPropagation();
      mesh.visible = !mesh.visible;
      visBtn.textContent = mesh.visible ? '表' : '非';
      visBtn.style.color = mesh.visible ? 'var(--text2)' : 'var(--text3)';
    });

    const lbl = document.createElement('span');
    lbl.className = 'item-list-label';
    lbl.style.flex = '1';
    lbl.textContent = matJaName(mat.name) || mat.name || ('パーツ ' + (i+1));

    row.appendChild(swatch);
    row.appendChild(lbl);
    row.appendChild(visBtn);

    row.addEventListener('click', () => {
      _currentItem = rid;
      list.querySelectorAll('.item-list-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      _setParamsTitle(lbl.textContent);
      _buildOutfitParams(mat, mesh, swatch);
    });
    list.appendChild(row);

    if (_currentItem === rid || (!_currentItem && i === 0)) {
      setTimeout(() => row.click(), 0);
    }
  });

  body.appendChild(list);
}

async function addClothingToScene(url, name) {
  setStatus('衣装を読み込み中...');
  try {
    const gltf = await loader.loadAsync(url);
    let root;
    let vrm = null;
    if (gltf.userData.vrm) {
      vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      root = vrm.scene;
    } else {
      root = gltf.scene;
    }
    scene.add(root);
    const clips = gltf.animations || [];
    const objMixer = clips.length > 0 ? new THREE.AnimationMixer(root) : null;
    const id = Math.random().toString(36).slice(2);
    sceneObjects.push({ id, name: name || '衣装', root, vrm, mixer: objMixer, clips, currentAction: null, isClothing: true });
    setStatus('衣装を追加しました: ' + name);
    setTimeout(() => setStatus(''), 3000);
    // 衣装タブを更新
    if (document.querySelector('.cat-tab.active')?.dataset.cat === 'outfit') {
      const b = _getItemsBody();
      if (b) { b.innerHTML = ''; _buildOutfitItems(b); }
    }
  } catch (e) {
    setStatus('エラー: ' + e.message, true);
    console.error('[addClothingToScene]', e);
  }
}

function _buildOutfitParams(mat, mesh, swatch) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  if (!mat) return;

  // スケール（衣装オブジェクトの場合）
  const clothingObj = sceneObjects.find(o => {
    if (!o.isClothing) return false;
    let found = false;
    o.root.traverse(c => { if (c === mesh || [].concat(c.material || []).includes(mat)) found = true; });
    return found;
  });
  if (clothingObj) {
    const scaleSec = makeSection('スケール');
    const curScale = clothingObj.root.scale.x;
    scaleSec.appendChild(makeSlider('スケール', 0.5, 2.0, curScale, 0.01, v => { clothingObj.root.scale.setScalar(v); }));
    body.appendChild(scaleSec);
  }

  // 表示切替
  const visSec = makeSection('表示');
  const visRow = document.createElement('div');
  visRow.className = 'ctrl-row';
  const visLbl = document.createElement('span');
  visLbl.className = 'ctrl-label';
  visLbl.textContent = 'メッシュ表示';
  const visChk = document.createElement('input');
  visChk.type = 'checkbox';
  visChk.checked = mesh?.visible !== false;
  visChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent,#e0529c);';
  visChk.addEventListener('change', () => {
    if (mesh) {
      mesh.visible = visChk.checked;
      if (swatch) swatch.style.opacity = visChk.checked ? '1' : '0.3';
      // Sync visibility button in items list
      const ib = _getItemsBody();
      if (ib) {
        ib.querySelectorAll('.item-list-row button').forEach(btn => {
          if (btn.title === '表示切替') btn.textContent = mesh.visible ? '表' : '非';
        });
      }
    }
  });
  visRow.appendChild(visLbl);
  visRow.appendChild(visChk);
  visSec.appendChild(visRow);
  body.appendChild(visSec);

  // カラー
  const colorSec = makeSection('カラー');
  let colorAdded = 0;
  if (mat.color) {
    const orig = matColorHex(mat);
    colorSec.appendChild(makeColorRow('ベースカラー', mat.name, orig,
      v => { setMatColor(mat, v); if (swatch) swatch.style.background = v; },
      () => { setMatColor(mat, orig); if (swatch) swatch.style.background = orig; }
    ));
    colorAdded++;
  }
  if (isMToon(mat) && mat.shadeColorFactor) {
    const orig = colorObjHex(mat.shadeColorFactor);
    colorSec.appendChild(makeColorRow('影色', mat.name + '_shade', orig,
      v => setColorObj(mat.shadeColorFactor, v), () => setColorObj(mat.shadeColorFactor, orig)));
    colorAdded++;
  }
  if (isMToon(mat) && mat.parametricRimColorFactor) {
    const orig = colorObjHex(mat.parametricRimColorFactor);
    colorSec.appendChild(makeColorRow('リムカラー', mat.name + '_rim', orig,
      v => setColorObj(mat.parametricRimColorFactor, v), () => setColorObj(mat.parametricRimColorFactor, orig)));
    colorAdded++;
  }
  if (colorAdded > 0) {
    body.appendChild(colorSec);
    // 全衣装に色コピーボタン
    if (mat.color) {
      const copyColorBtn = document.createElement('button');
      copyColorBtn.textContent = '全衣装に色をコピー';
      copyColorBtn.style.cssText = 'margin:0 10px 6px;width:calc(100% - 20px);padding:4px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;cursor:pointer;';
      copyColorBtn.addEventListener('click', () => {
        const hex = matColorHex(mat);
        sceneObjects.filter(o => o.isClothing).forEach(o => {
          o.root.traverse(obj => {
            [].concat(obj.material || []).forEach(m => { if (m?.color) setMatColor(m, hex); });
          });
        });
        setStatus('全衣装に色をコピーしました'); setTimeout(() => setStatus(''), 2000);
      });
      body.appendChild(copyColorBtn);
    }
  }

  // シェーディング
  if (isMToon(mat)) {
    const shadSec = makeSection('シェーディング');
    let shadAdded = 0;
    if (mat.shadingToonyFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の硬さ', 0, 1, mat.shadingToonyFactor, 0.01,
        v => { mat.shadingToonyFactor = v; }));
      shadAdded++;
    }
    if (mat.shadingShiftFactor !== undefined) {
      shadSec.appendChild(makeSlider('影の範囲', -1, 1, mat.shadingShiftFactor, 0.01,
        v => { mat.shadingShiftFactor = v; }));
      shadAdded++;
    }
    if (shadAdded > 0) body.appendChild(shadSec);

    // アウトライン
    if (mat.outlineWidthFactor !== undefined || mat.outlineColorFactor) {
      const outSec = makeSection('アウトライン');
      let outAdded = 0;
      if (mat.outlineWidthFactor !== undefined) {
        outSec.appendChild(makeSlider('太さ', 0, 0.05, mat.outlineWidthFactor, 0.001,
          v => { mat.outlineWidthFactor = v; }));
        outAdded++;
      }
      if (mat.outlineColorFactor) {
        const orig = colorObjHex(mat.outlineColorFactor);
        outSec.appendChild(makeColorRow('色', mat.name + '_out', orig,
          v => setColorObj(mat.outlineColorFactor, v), () => setColorObj(mat.outlineColorFactor, orig)));
        outAdded++;
      }
      if (outAdded > 0) body.appendChild(outSec);
    }
  } else {
    // 非MToon（MeshStandardMaterial等）の物性スライダー
    const pbr = makeSection('マテリアル物性');
    let pbrAdded = 0;
    if (mat.roughness !== undefined) {
      pbr.appendChild(makeSlider('粗さ', 0, 1, mat.roughness, 0.01, v => { mat.roughness = v; }));
      pbrAdded++;
    }
    if (mat.metalness !== undefined) {
      pbr.appendChild(makeSlider('金属感', 0, 1, mat.metalness, 0.01, v => { mat.metalness = v; }));
      pbrAdded++;
    }
    if (mat.opacity !== undefined) {
      if (mat.opacity < 1) mat.transparent = true;
      pbr.appendChild(makeSlider('透明度', 0, 1, mat.opacity, 0.01, v => {
        mat.opacity = v; mat.transparent = v < 1;
      }));
      pbrAdded++;
    }
    if (pbrAdded > 0) body.appendChild(pbr);
  }
}

// ── EXPR items + params ───────────────────────────────────
function _buildExprItems(body) {
  if (!currentVrm?.expressionManager && !currentRoot) {
    body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>';
    _clearParams('');
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  if (currentVrm?.expressionManager) {
    const map = currentVrm.expressionManager.expressionMap || {};
    const EXPR_LABELS = {
      happy:'笑顔', angry:'怒り', sad:'悲しみ', surprised:'驚き', relaxed:'穏やか',
      blink:'まばたき', blinkLeft:'左まばたき', blinkRight:'右まばたき',
      aa:'あ', ih:'い', ou:'う', ee:'え', oh:'お',
      lookUp:'視線 上', lookDown:'視線 下', lookLeft:'視線 左', lookRight:'視線 右',
    };
    const EXPR_GROUPS = {
      '感情': ['happy','angry','sad','surprised','relaxed'],
      '口形': ['aa','ih','ou','ee','oh'],
      'まばたき': ['blink','blinkLeft','blinkRight'],
      '視線': ['lookUp','lookDown','lookLeft','lookRight'],
    };
    const order = Object.keys(EXPR_LABELS);
    const allMapNames = Object.keys(map);
    if (allMapNames.length === 0) { body.innerHTML = '<p class="no-data">表情データなし</p>'; return; }

    // 全リセットボタン
    const resetAllBtn = document.createElement('button');
    resetAllBtn.textContent = '全表情リセット';
    resetAllBtn.style.cssText = 'margin:8px 10px 4px;width:calc(100% - 20px);padding:5px 0;background:var(--panel3,#2a2a3e);border:1px solid var(--border2);border-radius:var(--r,4px);color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:background 0.1s;';
    resetAllBtn.addEventListener('mouseenter', () => { resetAllBtn.style.background = 'var(--hover2)'; });
    resetAllBtn.addEventListener('mouseleave', () => { resetAllBtn.style.background = 'var(--panel3,#2a2a3e)'; });
    resetAllBtn.addEventListener('click', () => {
      if (!currentVrm?.expressionManager) return;
      allMapNames.forEach(n => currentVrm.expressionManager.setValue(n, 0));
      const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; }
      // Rebuild items list to clear mini value bars
      const ib = _getItemsBody(); if (ib) { ib.innerHTML = ''; _buildExprItems(ib); }
      setStatus('全表情リセット'); setTimeout(() => setStatus(''), 1500);
    });
    body.appendChild(resetAllBtn);

    // 自動まばたきトグル
    const blinkRow = document.createElement('div');
    blinkRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 10px 5px;';
    const blinkLbl = document.createElement('span');
    blinkLbl.style.cssText = 'font-size:10px;color:var(--text2);flex:1;';
    blinkLbl.textContent = '自動まばたき';
    const blinkChk = document.createElement('input');
    blinkChk.type = 'checkbox'; blinkChk.checked = _autoBlink;
    blinkChk.style.cssText = 'width:14px;height:14px;accent-color:var(--accent);cursor:pointer;';
    blinkChk.addEventListener('change', () => { _autoBlink = blinkChk.checked; });
    blinkRow.appendChild(blinkLbl); blinkRow.appendChild(blinkChk);
    body.appendChild(blinkRow);

    // ランダム表情ボタン
    const randExprBtn = document.createElement('button');
    randExprBtn.textContent = 'ランダム表情';
    randExprBtn.style.cssText = 'margin:0 10px 6px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    randExprBtn.addEventListener('click', () => {
      if (!currentVrm?.expressionManager) return;
      allMapNames.forEach(n => currentVrm.expressionManager.setValue(n, 0));
      const pick = allMapNames[Math.floor(Math.random() * allMapNames.length)];
      if (pick) currentVrm.expressionManager.setValue(pick, 0.5 + Math.random() * 0.5);
      setStatus('ランダム表情'); setTimeout(() => setStatus(''), 1200);
    });
    body.appendChild(randExprBtn);

    // カテゴリ別グループ表示
    const usedNames = new Set();
    const addExprRow = (name) => {
      const row = document.createElement('div');
      row.className = 'item-list-row' + (_currentItem === name ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'item-list-icon'; icon.textContent = '◆';
      const lbl = document.createElement('span');
      lbl.className = 'item-list-label'; lbl.textContent = EXPR_LABELS[name] || name;
      // mini value bar
      const curVal = currentVrm.expressionManager.getValue(name) || 0;
      row.appendChild(icon); row.appendChild(lbl);
      if (curVal > 0) {
        const miniBar = document.createElement('div');
        miniBar.style.cssText = `width:${Math.round(curVal*28)}px;height:3px;background:var(--accent);border-radius:2px;flex-shrink:0;margin-left:auto;`;
        miniBar.title = Math.round(curVal * 100) + '%';
        row.appendChild(miniBar);
      }
      row.addEventListener('click', () => {
        _currentItem = name;
        list.querySelectorAll('.item-list-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(EXPR_LABELS[name] || name);
        _buildExprParams(name);
      });
      list.appendChild(row);
      usedNames.add(name);
    };
    Object.entries(EXPR_GROUPS).forEach(([groupLabel, groupNames]) => {
      const available = groupNames.filter(n => map[n]);
      if (!available.length) return;
      const grpHdr = document.createElement('div');
      grpHdr.style.cssText = 'font-size:8px;font-weight:800;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;padding:5px 12px 2px;border-top:1px solid var(--border);';
      grpHdr.textContent = groupLabel;
      list.appendChild(grpHdr);
      available.forEach(addExprRow);
    });
    // uncategorized
    const uncatNames = allMapNames.filter(n => !usedNames.has(n));
    if (uncatNames.length) {
      const grpHdr = document.createElement('div');
      grpHdr.style.cssText = 'font-size:8px;font-weight:800;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;padding:5px 12px 2px;border-top:1px solid var(--border);';
      grpHdr.textContent = 'その他';
      list.appendChild(grpHdr);
      uncatNames.forEach(addExprRow);
    }
  } else if (currentRoot) {
    const morphMap = {};
    currentRoot.traverse(obj => {
      if (!obj.isMesh || !obj.morphTargetDictionary) return;
      Object.entries(obj.morphTargetDictionary).forEach(([n, idx]) => {
        if (!morphMap[n]) morphMap[n] = [];
        morphMap[n].push({ mesh: obj, idx });
      });
    });
    Object.keys(morphMap).sort().forEach(name => {
      const row = document.createElement('div');
      row.className = 'item-list-row' + (_currentItem === name ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'item-list-icon'; icon.textContent = '◆';
      const lbl = document.createElement('span');
      lbl.className = 'item-list-label'; lbl.textContent = name;
      row.appendChild(icon); row.appendChild(lbl);
      row.addEventListener('click', () => {
        _currentItem = name;
        list.querySelectorAll('.item-list-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(name);
        _buildMorphTargetParams(morphMap[name], name);
      });
      list.appendChild(row);
    });
  }

  body.appendChild(list);
  _clearParams('表情を選択してください');
  // Restore selected expression or pick first
  {
    const allExprRows = [...list.querySelectorAll('.item-list-row')];
    const prevSelected = allExprRows.find(r => r.classList.contains('selected'));
    (prevSelected || allExprRows[0])?.click();
  }
  // カスタム表情セクション
  _buildCustomExprSection(body);
}

function _buildExprParams(name) {
  const body = _getParamsBody(); if (!body || !currentVrm?.expressionManager) return;
  body.innerHTML = '';
  const sec = makeSection('表情強度');
  const cur = currentVrm.expressionManager.getValue(name) || 0;
  sec.appendChild(makeSlider('強度', 0, 1, cur, 0.01, v => currentVrm.expressionManager.setValue(name, v)));
  body.appendChild(sec);

  // プリセットボタン
  const presetsRow = document.createElement('div');
  presetsRow.style.cssText = 'display:flex;gap:4px;padding:6px 10px;flex-wrap:wrap;';
  [{label:'0%',v:0},{label:'25%',v:0.25},{label:'50%',v:0.5},{label:'75%',v:0.75},{label:'100%',v:1}].forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.style.cssText = 'flex:1;padding:3px 2px;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
    btn.addEventListener('click', () => {
      currentVrm.expressionManager.setValue(name, p.v);
      body.innerHTML = ''; _buildExprParams(name);
    });
    presetsRow.appendChild(btn);
  });
  body.appendChild(presetsRow);

  // リセットボタン
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'この表情をリセット';
  resetBtn.style.cssText = 'margin:0 10px 8px;width:calc(100% - 20px);padding:4px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    if (!currentVrm?.expressionManager) return;
    currentVrm.expressionManager.setValue(name, 0);
    body.innerHTML = ''; _buildExprParams(name);
    // Update minibar in items list
    const ib = _getItemsBody();
    if (ib) { const saved = _currentItem; ib.innerHTML = ''; _buildExprItems(ib); _currentItem = saved; }
  });
  body.appendChild(resetBtn);
}

function _buildMorphTargetParams(targets, name) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  const sec = makeSection('モーフ強度');
  const cur = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] || 0;
  sec.appendChild(makeSlider('強度', 0, 1, cur, 0.01,
    v => targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; })
  ));
  body.appendChild(sec);
}

// ── POSE items + params ───────────────────────────────────
const VRM_BONE_GROUPS = [
  { id:'head',  label:'頭・首', icon:'◉', bones:[
    { name:VRMHumanBoneName.Head,  label:'頭 上下', axis:'x', min:-0.8, max:0.8 },
    { name:VRMHumanBoneName.Head,  label:'頭 左右', axis:'y', min:-0.8, max:0.8 },
    { name:VRMHumanBoneName.Head,  label:'頭 傾き', axis:'z', min:-0.4, max:0.4, negate:true },
    { name:VRMHumanBoneName.Neck,  label:'首 上下', axis:'x', min:-0.4, max:0.4 },
    { name:VRMHumanBoneName.Neck,  label:'首 左右', axis:'y', min:-0.4, max:0.4 },
  ]},
  { id:'torso', label:'胴体', icon:'▮', bones:[
    { name:VRMHumanBoneName.Chest, label:'胸 前後',   axis:'x', min:-0.3, max:0.3 },
    { name:VRMHumanBoneName.Chest, label:'胸 ひねり', axis:'y', min:-0.5, max:0.5 },
    { name:VRMHumanBoneName.Spine, label:'腰 前後',   axis:'x', min:-0.4, max:0.4 },
    { name:VRMHumanBoneName.Hips,  label:'腰 ひねり', axis:'y', min:-0.5, max:0.5 },
  ]},
  { id:'larm', label:'左腕', icon:'←', bones:[
    { name:VRMHumanBoneName.LeftUpperArm, label:'上腕 前後', axis:'z', min:-1.5, max:0.3 },
    { name:VRMHumanBoneName.LeftUpperArm, label:'上腕 開閉', axis:'x', min:-0.5, max:1.2 },
    { name:VRMHumanBoneName.LeftLowerArm, label:'前腕 曲げ', axis:'z', min:-2.0, max:0 },
    { name:VRMHumanBoneName.LeftHand,     label:'手首 曲げ', axis:'x', min:-0.5, max:0.5 },
  ]},
  { id:'rarm', label:'右腕', icon:'→', bones:[
    { name:VRMHumanBoneName.RightUpperArm, label:'上腕 前後', axis:'z', min:-0.3, max:1.5 },
    { name:VRMHumanBoneName.RightUpperArm, label:'上腕 開閉', axis:'x', min:-0.5, max:1.2 },
    { name:VRMHumanBoneName.RightLowerArm, label:'前腕 曲げ', axis:'z', min:0, max:2.0 },
    { name:VRMHumanBoneName.RightHand,     label:'手首 曲げ', axis:'x', min:-0.5, max:0.5 },
  ]},
  { id:'lleg', label:'左脚', icon:'↙', bones:[
    { name:VRMHumanBoneName.LeftUpperLeg, label:'太もも 前後', axis:'x', min:-1.5, max:0.5 },
    { name:VRMHumanBoneName.LeftUpperLeg, label:'太もも 開閉', axis:'z', min:-0.5, max:0.8 },
    { name:VRMHumanBoneName.LeftLowerLeg, label:'ひざ 曲げ',   axis:'x', min:-2.0, max:0 },
    { name:VRMHumanBoneName.LeftFoot,     label:'足首',         axis:'x', min:-0.5, max:0.5 },
  ]},
  { id:'rleg', label:'右脚', icon:'↘', bones:[
    { name:VRMHumanBoneName.RightUpperLeg, label:'太もも 前後', axis:'x', min:-1.5, max:0.5 },
    { name:VRMHumanBoneName.RightUpperLeg, label:'太もも 開閉', axis:'z', min:-0.8, max:0.5 },
    { name:VRMHumanBoneName.RightLowerLeg, label:'ひざ 曲げ',   axis:'x', min:-2.0, max:0 },
    { name:VRMHumanBoneName.RightFoot,     label:'足首',         axis:'x', min:-0.5, max:0.5 },
  ]},
];

const GLB_BONE_PATTERNS = [
  /head/i,/neck/i,/spine/i,/chest/i,/hip/i,/pelvis/i,
  /upper.*arm/i,/forearm/i,/lower.*arm/i,/hand/i,
  /upper.*leg/i,/thigh/i,/lower.*leg/i,/calf/i,/foot/i,/shoulder/i,
  /thumb/i,/index/i,/middle/i,/ring/i,/little|pinky/i,
];

function _buildPoseItems(body) {
  if (!currentVrm?.humanoid && !currentRoot) {
    body.innerHTML = '<p class="no-data">モデルを読み込んでください</p>';
    _clearParams('');
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  if (currentVrm?.humanoid) {
    // 全ポーズリセットボタン
    const resetAllBtn = document.createElement('button');
    resetAllBtn.textContent = '全ポーズリセット';
    resetAllBtn.style.cssText = 'margin:8px 10px 4px;width:calc(100% - 20px);padding:5px 0;background:var(--panel3,#2a2a3e);border:1px solid var(--border2);border-radius:var(--r,4px);color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;transition:background 0.1s;';
    resetAllBtn.addEventListener('mouseenter', () => { resetAllBtn.style.background = 'var(--hover2)'; });
    resetAllBtn.addEventListener('mouseleave', () => { resetAllBtn.style.background = 'var(--panel3,#2a2a3e)'; });
    resetAllBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      VRM_BONE_GROUPS.forEach(g => g.bones.forEach(def => {
        const node = currentVrm.humanoid.getRawBoneNode(def.name);
        if (node) node.rotation.set(0, 0, 0);
      }));
      const pb = _getParamsBody();
      if (pb && _currentItem) {
        const grp = VRM_BONE_GROUPS.find(g => g.id === _currentItem);
        if (grp) { pb.innerHTML = ''; _buildVRMPoseParams(grp); }
      }
      setStatus('ポーズリセット'); setTimeout(() => setStatus(''), 1500);
    });
    body.appendChild(resetAllBtn);

    // T-ポーズ / A-ポーズ ボタン行
    const posePresetRow = document.createElement('div');
    posePresetRow.style.cssText = 'display:flex;gap:4px;padding:2px 10px 4px;';
    const tposeBtn = document.createElement('button');
    tposeBtn.textContent = 'T-ポーズ';
    tposeBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    tposeBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      const resetBones = [VRMHumanBoneName.Head, VRMHumanBoneName.Neck, VRMHumanBoneName.Chest, VRMHumanBoneName.Spine, VRMHumanBoneName.Hips,
        VRMHumanBoneName.LeftLowerArm, VRMHumanBoneName.RightLowerArm, VRMHumanBoneName.LeftHand, VRMHumanBoneName.RightHand,
        VRMHumanBoneName.LeftUpperLeg, VRMHumanBoneName.RightUpperLeg, VRMHumanBoneName.LeftLowerLeg, VRMHumanBoneName.RightLowerLeg,
        VRMHumanBoneName.LeftFoot, VRMHumanBoneName.RightFoot];
      resetBones.forEach(n => { const node = currentVrm.humanoid.getRawBoneNode(n); if (node) node.rotation.set(0,0,0); });
      const rua = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.RightUpperArm);
      const lua = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.LeftUpperArm);
      if (rua) rua.rotation.set(0, 0, Math.PI/2);
      if (lua) lua.rotation.set(0, 0, -Math.PI/2);
      if (_currentItem) { const g = VRM_BONE_GROUPS.find(g => g.id === _currentItem); if (g) { const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildVRMPoseParams(g); } } }
      setStatus('T-ポーズ適用'); setTimeout(() => setStatus(''), 1500);
    });
    const aposeBtn = document.createElement('button');
    aposeBtn.textContent = 'A-ポーズ';
    aposeBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    aposeBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      VRM_BONE_GROUPS.forEach(g => g.bones.forEach(def => {
        const node = currentVrm.humanoid.getRawBoneNode(def.name);
        if (node) node.rotation.set(0,0,0);
      }));
      const rua = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.RightUpperArm);
      const lua = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.LeftUpperArm);
      if (rua) rua.rotation.z = Math.PI/4;
      if (lua) lua.rotation.z = -Math.PI/4;
      if (_currentItem) { const g = VRM_BONE_GROUPS.find(g => g.id === _currentItem); if (g) { const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildVRMPoseParams(g); } } }
      setStatus('A-ポーズ適用'); setTimeout(() => setStatus(''), 1500);
    });
    posePresetRow.appendChild(tposeBtn); posePresetRow.appendChild(aposeBtn);
    body.appendChild(posePresetRow);

    // 左右反転・ランダム行
    const poseRow2 = document.createElement('div');
    poseRow2.style.cssText = 'display:flex;gap:4px;padding:0 10px 4px;';
    const mirrorBtn = document.createElement('button');
    mirrorBtn.textContent = '左右反転';
    mirrorBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    mirrorBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      const mirrorPairs = [
        [VRMHumanBoneName.LeftUpperArm, VRMHumanBoneName.RightUpperArm],
        [VRMHumanBoneName.LeftLowerArm, VRMHumanBoneName.RightLowerArm],
        [VRMHumanBoneName.LeftHand, VRMHumanBoneName.RightHand],
        [VRMHumanBoneName.LeftUpperLeg, VRMHumanBoneName.RightUpperLeg],
        [VRMHumanBoneName.LeftLowerLeg, VRMHumanBoneName.RightLowerLeg],
        [VRMHumanBoneName.LeftFoot, VRMHumanBoneName.RightFoot],
      ];
      mirrorPairs.forEach(([L, R]) => {
        const lNode = currentVrm.humanoid.getRawBoneNode(L);
        const rNode = currentVrm.humanoid.getRawBoneNode(R);
        if (!lNode || !rNode) return;
        const lx = lNode.rotation.x, ly = lNode.rotation.y, lz = lNode.rotation.z;
        const rx = rNode.rotation.x, ry = rNode.rotation.y, rz = rNode.rotation.z;
        lNode.rotation.set(rx, -ry, -rz);
        rNode.rotation.set(lx, -ly, -lz);
      });
      setStatus('左右反転完了'); setTimeout(() => setStatus(''), 1500);
    });
    const randBtn = document.createElement('button');
    randBtn.textContent = 'ランダム';
    randBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    randBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      VRM_BONE_GROUPS.forEach(g => g.bones.forEach(def => {
        const node = currentVrm.humanoid.getRawBoneNode(def.name);
        if (!node) return;
        const range = (def.max - def.min) * 0.3;
        const mid = (def.max + def.min) / 2;
        node.rotation[def.axis] = mid + (Math.random() - 0.5) * range;
      }));
      if (_currentItem) { const g = VRM_BONE_GROUPS.find(g => g.id === _currentItem); if (g) { const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildVRMPoseParams(g); } } }
      setStatus('ランダムポーズ'); setTimeout(() => setStatus(''), 1500);
    });
    poseRow2.appendChild(mirrorBtn); poseRow2.appendChild(randBtn);
    body.appendChild(poseRow2);

    // ポーズ保存・読込行
    const poseRow3 = document.createElement('div');
    poseRow3.style.cssText = 'display:flex;gap:4px;padding:0 10px 6px;';
    const savePoseBtn = document.createElement('button');
    savePoseBtn.textContent = 'ポーズ保存';
    savePoseBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    savePoseBtn.addEventListener('click', () => {
      if (!currentVrm?.humanoid) return;
      const poseData = {};
      VRM_BONE_GROUPS.forEach(g => g.bones.forEach(def => {
        const node = currentVrm.humanoid.getRawBoneNode(def.name);
        if (node) poseData[def.name] = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z };
      }));
      const blob = new Blob([JSON.stringify(poseData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'pose.json'; a.click();
      URL.revokeObjectURL(a.href);
      setStatus('ポーズ保存完了'); setTimeout(() => setStatus(''), 2000);
    });
    const loadPoseBtn = document.createElement('button');
    loadPoseBtn.textContent = 'ポーズ読込';
    loadPoseBtn.style.cssText = 'flex:1;padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
    loadPoseBtn.addEventListener('click', () => {
      pickFile('.json', f => {
        const reader = new FileReader();
        reader.onload = e2 => {
          try {
            const data = JSON.parse(e2.target.result);
            Object.entries(data).forEach(([boneName, rot]) => {
              const node = currentVrm?.humanoid?.getRawBoneNode(boneName);
              if (node) node.rotation.set(rot.x, rot.y, rot.z, node.rotation.order);
            });
            if (_currentItem) { const g = VRM_BONE_GROUPS.find(g => g.id === _currentItem); if (g) { const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildVRMPoseParams(g); } } }
            setStatus('ポーズ読み込み完了'); setTimeout(() => setStatus(''), 2000);
          } catch { setStatus('ポーズファイルエラー', true); }
        };
        reader.readAsText(f);
      });
    });
    poseRow3.appendChild(savePoseBtn); poseRow3.appendChild(loadPoseBtn);
    body.appendChild(poseRow3);

    VRM_BONE_GROUPS.forEach(group => {
      const row = document.createElement('div');
      row.className = 'item-list-row' + (_currentItem === group.id ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'item-list-icon'; icon.textContent = group.icon;
      const lbl = document.createElement('span');
      lbl.className = 'item-list-label'; lbl.textContent = group.label;
      row.appendChild(icon); row.appendChild(lbl);
      row.addEventListener('click', () => {
        _currentItem = group.id;
        list.querySelectorAll('.item-list-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(group.label);
        _buildVRMPoseParams(group);
      });
      list.appendChild(row);
    });
  } else {
    let bones = [];
    currentRoot.traverse(obj => {
      if ((obj.isBone || obj.type === 'Bone') && GLB_BONE_PATTERNS.some(re => re.test(obj.name)))
        bones.push(obj);
    });
    if (!bones.length) currentRoot.traverse(obj => { if (obj.isBone) bones.push(obj); });
    const seen = new Set();
    bones = bones.filter(b => { if (seen.has(b.uuid)) return false; seen.add(b.uuid); return true; }).slice(0, 40);
    bones.forEach((bone, i) => {
      const jaName = boneJaName(bone.name);
      const boneId = 'bone_' + i;
      const row = document.createElement('div');
      row.className = 'item-list-row' + (_currentItem === boneId ? ' selected' : '');
      const icon = document.createElement('span');
      icon.className = 'item-list-icon'; icon.textContent = '◆';
      const lbl = document.createElement('span');
      lbl.className = 'item-list-label'; lbl.textContent = jaName;
      row.appendChild(icon); row.appendChild(lbl);
      row.addEventListener('click', () => {
        _currentItem = boneId;
        list.querySelectorAll('.item-list-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        _setParamsTitle(jaName);
        _buildGLBBoneParams(bone);
      });
      list.appendChild(row);
    });
  }

  body.appendChild(list);
  _clearParams('ポーズ部位を選択してください');
  {
    const allPoseRows = [...list.querySelectorAll('.item-list-row')];
    const prevSelected = allPoseRows.find(r => r.classList.contains('selected'));
    (prevSelected || allPoseRows[0])?.click();
  }
}

function _buildVRMPoseParams(group) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  const vrm = currentVrm; // capture at build time to avoid stale closure
  if (!vrm?.humanoid) return;
  const sec = makeSection(group.label + ' 回転');
  // per-group reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'このグループをリセット';
  resetBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:3px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    group.bones.forEach(def => {
      const node = vrm.humanoid.getRawBoneNode(def.name);
      if (node) node.rotation.set(0, 0, 0);
    });
    body.innerHTML = ''; _buildVRMPoseParams(group);
  });
  sec.appendChild(resetBtn);
  group.bones.forEach(def => {
    const node = vrm.humanoid.getRawBoneNode(def.name);
    if (!node) return;
    const cur = def.negate ? -node.rotation[def.axis] : node.rotation[def.axis];
    sec.appendChild(makeSlider(def.label, def.min, def.max, cur, 0.01, v => {
      node.rotation[def.axis] = def.negate ? -v : v;
    }));
  });
  body.appendChild(sec);
}

function _buildGLBBoneParams(bone) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  const boneLabelJa = boneJaName(bone.name) || bone.name;
  const sec = makeSection(boneLabelJa + ' 回転 (rad)');
  const resetBoneBtn = document.createElement('button');
  resetBoneBtn.textContent = 'リセット';
  resetBoneBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:3px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;cursor:pointer;';
  resetBoneBtn.addEventListener('click', () => { bone.rotation.set(0, 0, 0); _buildGLBBoneParams(bone); });
  sec.appendChild(resetBoneBtn);
  ['x','y','z'].forEach(axis => {
    sec.appendChild(makeSlider(`回転 ${axis.toUpperCase()}`, -Math.PI, Math.PI, bone.rotation[axis], 0.01, v => { bone.rotation[axis] = v; }));
  });
  body.appendChild(sec);
}

// ── ANIM items + params ───────────────────────────────────
function _buildAnimItems(body) {
  if (animClips.length === 0) {
    body.innerHTML = '<p class="no-data">アニメーションデータなし</p>';
    _clearParams('');
    return;
  }

  // Playback controls in items panel
  const ctrlDiv = document.createElement('div');
  ctrlDiv.className = 'anim-controls';
  const btnPlay  = document.createElement('button');
  const btnPause = document.createElement('button');
  const btnStop  = document.createElement('button');
  btnPlay.className = btnPause.className = btnStop.className = 'anim-ctrl-btn';
  btnPlay.textContent = '▶ 再生';
  btnPause.textContent = '⏸ 停止';
  btnStop.textContent = '⏹ リセット';

  const itemEls = [];
  btnPlay.addEventListener('click', () => {
    if (currentAction) { currentAction.paused = false; currentAction.play(); btnPlay.classList.add('playing'); }
    else if (animClips.length > 0) { _selectAnimation(0, itemEls, btnPlay); }
  });
  btnPause.addEventListener('click', () => {
    if (currentAction) {
      currentAction.paused = !currentAction.paused;
      btnPause.textContent = currentAction.paused ? '▶ 再開' : '⏸ 停止';
    }
  });
  btnStop.addEventListener('click', () => {
    if (currentAction) { currentAction.stop(); currentAction = null; }
    const selObj = getSelectedObj();
    if (selObj) selObj.currentAction = null;
    btnPlay.classList.remove('playing');
    itemEls.forEach(el => el.classList.remove('active'));
  });
  // Sync button states to currentAction
  if (currentAction && currentAction.isRunning() && !currentAction.paused) {
    btnPlay.classList.add('playing');
  }
  if (currentAction?.paused) {
    btnPause.textContent = '▶ 再開';
  }
  ctrlDiv.appendChild(btnPlay); ctrlDiv.appendChild(btnPause); ctrlDiv.appendChild(btnStop);
  body.appendChild(ctrlDiv);

  const lbl = document.createElement('div');
  lbl.className = 'section-label';
  lbl.textContent = `クリップ (${animClips.length}件)`;
  body.appendChild(lbl);

  animClips.forEach((clip, i) => {
    const item = document.createElement('div');
    item.className = 'anim-item';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'anim-name';
    nameSpan.textContent = clip.name || 'アニメーション ' + (i+1);
    const durSpan = document.createElement('span');
    durSpan.className = 'anim-dur';
    const durSec = clip.duration;
    durSpan.textContent = durSec >= 60
      ? Math.floor(durSec / 60) + ':' + String(Math.floor(durSec % 60)).padStart(2, '0')
      : durSec.toFixed(2) + 's';
    item.appendChild(nameSpan);
    item.appendChild(durSpan);
    item.addEventListener('click', () => {
      _selectAnimation(i, itemEls, btnPlay);
      itemEls.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      btnPlay.classList.add('playing');
      _currentItem = 'clip_' + i;
      _setParamsTitle(clip.name || 'アニメーション');
      _buildAnimParams(i);
    });
    itemEls.push(item);
    body.appendChild(item);
  });

  // Restore active clip state
  const prevClipIdx = _currentItem?.startsWith('clip_')
    ? parseInt(_currentItem.replace('clip_', ''), 10) : 0;
  const safeIdx = (prevClipIdx >= 0 && prevClipIdx < animClips.length) ? prevClipIdx : 0;
  _buildAnimParams(safeIdx);
  itemEls[safeIdx]?.classList.add('active');
  _currentItem = 'clip_' + safeIdx;
}

function _buildAnimParams(clipIdx) {
  const body = _getParamsBody(); if (!body) return;
  body.innerHTML = '';
  const sec = makeSection('再生設定');
  sec.appendChild(makeSlider('再生速度', 0.1, 3.0, animSpeedFactor, 0.05, v => {
    animSpeedFactor = v;
    if (currentAction) currentAction.timeScale = v;
  }));

  // 速度プリセットボタン
  const spdPresetRow = document.createElement('div');
  spdPresetRow.style.cssText = 'display:flex;gap:3px;padding:3px 10px 5px;';
  [0.25, 0.5, 1.0, 2.0].forEach(spd => {
    const btn = document.createElement('button');
    btn.textContent = spd + 'x';
    btn.style.cssText = 'flex:1;padding:3px 0;border-radius:3px;border:1px solid var(--border);background:' + (Math.abs(animSpeedFactor - spd) < 0.001 ? 'var(--accent-dim)' : 'var(--panel2)') + ';color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
    btn.addEventListener('click', () => {
      animSpeedFactor = spd;
      if (currentAction) currentAction.timeScale = spd;
      body.innerHTML = ''; _buildAnimParams(clipIdx);
    });
    spdPresetRow.appendChild(btn);
  });
  sec.appendChild(spdPresetRow);

  // ループ切替
  const loopRow = document.createElement('div');
  loopRow.className = 'ctrl-row';
  const loopLbl = document.createElement('span');
  loopLbl.className = 'ctrl-label'; loopLbl.textContent = 'ループ再生';
  const loopChk = document.createElement('input');
  loopChk.type = 'checkbox';
  loopChk.checked = currentAction ? (currentAction.loop !== THREE.LoopOnce) : true;
  loopChk.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:var(--accent);';
  loopChk.addEventListener('change', () => {
    if (currentAction) {
      currentAction.loop = loopChk.checked ? THREE.LoopRepeat : THREE.LoopOnce;
      currentAction.clampWhenFinished = !loopChk.checked;
    }
  });
  loopRow.appendChild(loopLbl); loopRow.appendChild(loopChk);
  sec.appendChild(loopRow);

  body.appendChild(sec);

  // タイムライン（再生位置スクラブ）
  if (currentAction && mixer && animClips[clipIdx]) {
    const dur = animClips[clipIdx].duration || 1;
    const timeSec = makeSection('タイムライン');
    const timeSliderRow = makeSlider('再生位置', 0, dur, currentAction?.time ?? 0, 0.01, v => {
      if (currentAction) { currentAction.time = v; currentAction.paused = true; mixer.update(0); }
    });
    timeSec.appendChild(timeSliderRow);
    // フレームステップボタン
    const frameRow = document.createElement('div');
    frameRow.style.cssText = 'display:flex;gap:4px;padding:3px 10px 5px;';
    const frameStep = 1/30;
    const prevFrameBtn = document.createElement('button');
    prevFrameBtn.textContent = '◀ 前フレ';
    prevFrameBtn.style.cssText = 'flex:1;padding:3px 0;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
    prevFrameBtn.addEventListener('click', () => {
      if (currentAction) { currentAction.paused = true; currentAction.time = Math.max(0, currentAction.time - frameStep); mixer.update(0); body.innerHTML = ''; _buildAnimParams(clipIdx); }
    });
    const nextFrameBtn = document.createElement('button');
    nextFrameBtn.textContent = '次フレ ▶';
    nextFrameBtn.style.cssText = 'flex:1;padding:3px 0;border-radius:3px;border:1px solid var(--border);background:var(--panel2);color:var(--text2);font-size:9px;font-weight:700;cursor:pointer;';
    nextFrameBtn.addEventListener('click', () => {
      if (currentAction) { currentAction.paused = true; currentAction.time = Math.min(currentAction.getClip().duration, currentAction.time + frameStep); mixer.update(0); body.innerHTML = ''; _buildAnimParams(clipIdx); }
    });
    frameRow.appendChild(prevFrameBtn); frameRow.appendChild(nextFrameBtn);
    timeSec.appendChild(frameRow);
    body.appendChild(timeSec);
  }

  if (animClips[clipIdx]) {
    const infoSec = makeSection('クリップ情報');
    const clip = animClips[clipIdx];
    let fps = '不明';
    if (clip.tracks.length > 0) {
      const t = clip.tracks[0];
      if (t.times && t.times.length > 1 && t.times[0] < t.times[1]) {
        fps = '~' + Math.round(1 / (t.times[1] - t.times[0]));
      } else {
        fps = '~30';
      }
    }
    const infoRow = document.createElement('div');
    infoRow.style.cssText = 'padding:6px 13px;font-size:10px;color:var(--text2);line-height:1.7;white-space:pre-line;';
    const boneTrackCount = clip.tracks.filter(t => /quaternion|position|scale/i.test(t.name)).length;
    const morphTrackCount = clip.tracks.length - boneTrackCount;
    infoRow.textContent = [
      `名前: ${clip.name || '(unnamed)'}`,
      `長さ: ${clip.duration.toFixed(3)}s`,
      `FPS: ${fps}`,
      `ボーントラック: ${boneTrackCount} / モーフ: ${morphTrackCount}`,
    ].join('\n');
    infoSec.appendChild(infoRow);
    body.appendChild(infoSec);
  }
}

function _selectAnimation(index, itemEls, btnPlay) {
  if (!mixer || !animClips[index]) return;
  if (currentAction) currentAction.fadeOut(0.3);
  currentAction = mixer.clipAction(animClips[index]);
  currentAction.timeScale = animSpeedFactor;
  currentAction.reset().fadeIn(0.3).play();
  const obj = getSelectedObj();
  if (obj) obj.currentAction = currentAction;
}

// ── SCENE items + params ──────────────────────────────────
function _buildSceneItems(body) {
  // Add primitive section
  const addHdr = document.createElement('div');
  addHdr.className = 'scene-section-title';
  addHdr.style.borderBottom = '1px solid var(--border)';
  addHdr.textContent = 'プリミティブ追加';
  body.appendChild(addHdr);
  const addGrid = document.createElement('div');
  addGrid.className = 'scene-add-grid';
  [['box','□ Box'],['sphere','○ Sphere'],['cylinder','⌀ Cyl'],['capsule','⬮ Cap'],['plane','▬ Plane'],['torus','⊙ Torus']].forEach(([t, lbl]) => {
    const b = document.createElement('button');
    b.className = 'scene-add-btn'; b.textContent = lbl;
    b.addEventListener('click', () => { addPrimitive(t); });
    addGrid.appendChild(b);
  });
  body.appendChild(addGrid);

  const objHdr = document.createElement('div');
  objHdr.className = 'scene-section-title';
  objHdr.style.cssText = 'border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-top:4px;display:flex;justify-content:space-between;align-items:center;';
  const objHdrText = document.createElement('span');
  objHdrText.textContent = 'オブジェクト';
  const objCount = document.createElement('span');
  objCount.style.cssText = 'font-size:9px;color:var(--accent);font-weight:700;';
  objCount.textContent = sceneObjects.length + '件';
  objHdr.appendChild(objHdrText);
  objHdr.appendChild(objCount);
  body.appendChild(objHdr);

  if (sceneObjects.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-data'; msg.textContent = 'オブジェクトがありません';
    body.appendChild(msg);
    _clearParams('オブジェクトを追加してください');
    return;
  }

  sceneObjects.forEach(obj => {
    const item = document.createElement('div');
    item.className = 'scene-item' + (obj.id === selectedId ? ' selected' : '');
    const iconEl = document.createElement('span');
    iconEl.className = 'scene-item-icon';
    iconEl.textContent = obj.vrm ? 'V' : obj.isClothing ? 'C' : 'G';
    iconEl.title = obj.vrm ? 'VRM' : obj.isClothing ? '衣装' : 'GLB';
    const nameEl = document.createElement('span');
    nameEl.className = 'scene-item-name'; nameEl.textContent = obj.name;
    const visBtn = document.createElement('button');
    visBtn.className = 'scene-item-remove';
    visBtn.textContent = obj.root.visible ? '👁' : '─';
    visBtn.title = '表示切替';
    visBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text2);font-size:10px;padding:0 3px;';
    visBtn.addEventListener('click', e => {
      e.stopPropagation();
      obj.root.visible = !obj.root.visible;
      visBtn.textContent = obj.root.visible ? '👁' : '─';
    });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'scene-item-remove'; removeBtn.textContent = '✕'; removeBtn.title = '削除';
    item.appendChild(iconEl); item.appendChild(nameEl); item.appendChild(visBtn); item.appendChild(removeBtn);
    item.addEventListener('click', e => {
      if (e.target === removeBtn || e.target === visBtn) return;
      selectObject(obj.id);
    });
    removeBtn.addEventListener('click', e => { e.stopPropagation(); removeObject(obj.id); });
    body.appendChild(item);
  });

  if (selectedId) {
    _buildSceneParams();
  } else {
    _clearParams('オブジェクトを選択してください');
  }
}

function _buildSceneParams() {
  const body = _getParamsBody(); if (!body || !currentRoot) return;
  body.innerHTML = '';
  _setParamsTitle('トランスフォーム');

  // モデル情報
  const infoSec = makeSection('モデル情報');
  let triCount = 0, matCount = 0;
  const seenMats = new Set();
  currentRoot.traverse(obj => {
    if (!obj.isMesh) return;
    if (obj.geometry) triCount += (obj.geometry.index ? obj.geometry.index.count / 3 : (obj.geometry.attributes.position?.count || 0) / 3);
    [].concat(obj.material || []).forEach(m => { if (m && !seenMats.has(m.uuid)) { seenMats.add(m.uuid); matCount++; } });
  });
  // bone count
  let boneCount = 0;
  currentRoot.traverse(o => { if (o.isBone || o.type === 'Bone') boneCount++; });
  // morph count
  const morphSet = new Set();
  currentRoot.traverse(o => {
    if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach(k => morphSet.add(k));
  });
  // model height
  let heightStr = '';
  if (currentRoot) {
    let heightM = 0;
    if (currentVrm?.humanoid) {
      const headNode = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.Head);
      const feetNode = currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.LeftFoot)
                    || currentVrm.humanoid.getRawBoneNode(VRMHumanBoneName.RightFoot);
      if (headNode) {
        const hp = new THREE.Vector3(); headNode.getWorldPosition(hp);
        const fp = feetNode ? (() => { const v = new THREE.Vector3(); feetNode.getWorldPosition(v); return v; })() : new THREE.Vector3(0, 0, 0);
        heightM = hp.y - fp.y + 0.12; // approx head top
      }
    }
    if (!heightM) {
      const box2 = new THREE.Box3().setFromObject(currentRoot);
      heightM = box2.getSize(new THREE.Vector3()).y;
    }
    heightStr = `身長: 約${Math.round(heightM * 100)}cm`;
  }
  const infoEl = document.createElement('div');
  infoEl.style.cssText = 'padding:6px 13px;font-size:10px;color:var(--text2);line-height:1.8;white-space:pre-line;';
  let infoText = `三角形: ${Math.round(triCount).toLocaleString()}\nマテリアル: ${matCount}`;
  if (boneCount > 0) infoText += `\nボーン: ${boneCount}`;
  if (morphSet.size > 0) infoText += `\nモーフ: ${morphSet.size}`;
  if (heightStr) infoText += `\n${heightStr}`;
  infoEl.textContent = infoText;
  infoSec.appendChild(infoEl);

  body.appendChild(infoSec);

  // VRM メタデータ（編集可能）
  const obj = getSelectedObj();
  if (obj?.vrm?.meta) {
    const meta = obj.vrm.meta;
    const metaSec = makeSection('モデル情報編集');

    const makeEditRow = (labelText, getValue, setValue) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:3px 10px;';
      const lbl = document.createElement('label');
      lbl.textContent = labelText;
      lbl.style.cssText = 'font-size:10px;color:var(--text2);display:block;margin-bottom:2px;';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = getValue();
      inp.style.cssText = 'width:100%;box-sizing:border-box;background:#1a1a2e;color:#e0e0ff;border:1px solid #444;padding:3px 6px;border-radius:3px;font-size:11px;';
      inp.addEventListener('change', () => setValue(inp.value));
      inp.addEventListener('blur', () => setValue(inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); } });
      row.appendChild(lbl);
      row.appendChild(inp);
      return row;
    };

    metaSec.appendChild(makeEditRow('モデル名',
      () => meta.name || meta.title || '',
      v => {
        if (meta.name !== undefined) meta.name = v;
        if (meta.title !== undefined) meta.title = v;
        const el = document.getElementById('model-name'); if (el) el.textContent = v;
        // Also update sceneObjects entry name + refresh items list
        const selObj = getSelectedObj();
        if (selObj) selObj.name = v;
        const ib = _getItemsBody(); if (ib) { ib.innerHTML = ''; _buildSceneItems(ib); }
      }
    ));
    metaSec.appendChild(makeEditRow('作者',
      () => meta.authors?.[0] || meta.author || '',
      v => { if (Array.isArray(meta.authors)) meta.authors[0] = v; else if (meta.author !== undefined) meta.author = v; }
    ));
    metaSec.appendChild(makeEditRow('ライセンス',
      () => meta.licenseUrl || meta.licenseName || '',
      v => { if (meta.licenseUrl !== undefined) meta.licenseUrl = v; if (meta.licenseName !== undefined) meta.licenseName = v; }
    ));
    body.appendChild(metaSec);
  }

  // Thumbnail section
  if (obj?.vrm) {
    const thumbSec = makeSection('サムネイル');

    // Preview current thumbnail if exists
    const meta = obj.vrm.meta;
    if (meta?.thumbnailImage) {
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;max-height:120px;object-fit:contain;border:1px solid #444;border-radius:3px;margin:4px 0;';
      // thumbnailImage is a Texture or HTMLImageElement
      if (meta.thumbnailImage instanceof HTMLImageElement) {
        img.src = meta.thumbnailImage.src;
      } else if (meta.thumbnailImage?.image instanceof HTMLImageElement) {
        img.src = meta.thumbnailImage.image.src;
      }
      if (img.src) thumbSec.appendChild(img);
    }

    // Capture button
    const captureBtn = document.createElement('button');
    captureBtn.textContent = '現在の画面をサムネイルに設定';
    captureBtn.className = 'param-btn';
    captureBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:5px 0;font-size:10px;font-weight:700;cursor:pointer;background:var(--accent);color:#fff;border:none;border-radius:3px;';
    captureBtn.addEventListener('click', () => {
      const TW = 256, TH = 256;
      const srcW = renderer.domElement.width, srcH = renderer.domElement.height;

      // Render to a full-size RT, then read pixels (works without preserveDrawingBuffer)
      const rt = new THREE.WebGLRenderTarget(srcW, srcH, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      });
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(srcW * srcH * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, srcW, srcH, pixels);
      renderer.setRenderTarget(null);
      rt.dispose();

      // Y-flip
      const flipped = new Uint8Array(srcW * srcH * 4);
      for (let y = 0; y < srcH; y++) {
        const srcRow = (srcH - 1 - y) * srcW * 4;
        flipped.set(pixels.subarray(srcRow, srcRow + srcW * 4), y * srcW * 4);
      }

      // Draw full size → crop center square → resize to 256
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = srcW; fullCanvas.height = srcH;
      fullCanvas.getContext('2d').putImageData(new ImageData(flipped, srcW, srcH), 0, 0);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = TW; thumbCanvas.height = TH;
      const size = Math.min(srcW, srcH);
      const sx = (srcW - size) / 2, sy = (srcH - size) / 2;
      thumbCanvas.getContext('2d').drawImage(fullCanvas, sx, sy, size, size, 0, 0, TW, TH);

      const dataURL = thumbCanvas.toDataURL('image/png');

      // Set as VRM thumbnail texture
      const imgEl = new Image();
      imgEl.onload = () => {
        if (obj.vrm.meta) {
          const tex = new THREE.Texture(imgEl);
          tex.needsUpdate = true;
          obj.vrm.meta.thumbnailImage = tex;
        }
        setStatus('サムネイルを設定しました'); setTimeout(() => setStatus(''), 2000);
        const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildSceneParams(); }
      };
      imgEl.src = dataURL;

      // Download
      const a = document.createElement('a');
      a.href = dataURL; a.download = 'thumbnail.png'; a.click();
    });
    thumbSec.appendChild(captureBtn);

    // Clear thumbnail button
    const clearThumbBtn = document.createElement('button');
    clearThumbBtn.textContent = 'サムネイルをクリア';
    clearThumbBtn.className = 'param-btn';
    clearThumbBtn.style.cssText = 'margin:2px 10px;width:calc(100% - 20px);padding:3px 0;font-size:10px;cursor:pointer;';
    clearThumbBtn.addEventListener('click', () => {
      if (obj.vrm.meta) obj.vrm.meta.thumbnailImage = null;
      setStatus('サムネイルをクリアしました'); setTimeout(() => setStatus(''), 2000);
      const pb = _getParamsBody(); if (pb) { pb.innerHTML = ''; _buildSceneParams(); }
    });
    thumbSec.appendChild(clearThumbBtn);

    body.appendChild(thumbSec);
  }

  const makeVecRow = (label, prop, step) => {
    const row = document.createElement('div');
    row.className = 'tf-row';
    const lbl = document.createElement('span');
    lbl.className = 'tf-label'; lbl.textContent = label;
    row.appendChild(lbl);
    ['x','y','z'].forEach(axis => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'tf-input';
      inp.step = step; inp.dataset.prop = `${prop}.${axis}`;
      inp.value = parseFloat(currentRoot[prop][axis].toFixed(4));
      inp.addEventListener('input', () => {
        if (currentRoot) currentRoot[prop][axis] = parseFloat(inp.value) || 0;
      });
      row.appendChild(inp);
    });
    return row;
  };

  const sec = document.createElement('div');
  sec.className = 'scene-tf-section';
  sec.appendChild(makeVecRow('位置', 'position', 0.001));
  const posResetBtn = document.createElement('button');
  posResetBtn.textContent = '位置リセット (0,0,0)';
  posResetBtn.style.cssText = 'margin:2px 0 4px;width:100%;padding:2px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:9px;cursor:pointer;';
  posResetBtn.addEventListener('click', () => {
    if (currentRoot) { currentRoot.position.set(0, 0, 0); _buildSceneParams(); }
  });
  sec.appendChild(posResetBtn);
  sec.appendChild(makeVecRow('回転 (rad)', 'rotation', 0.01));
  const rotResetBtn = document.createElement('button');
  rotResetBtn.textContent = '回転リセット (0,0,0)';
  rotResetBtn.style.cssText = 'margin:2px 0 4px;width:100%;padding:2px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:9px;cursor:pointer;';
  rotResetBtn.addEventListener('click', () => {
    if (currentRoot) { currentRoot.rotation.set(0, 0, 0); _buildSceneParams(); }
  });
  sec.appendChild(rotResetBtn);
  sec.appendChild(makeVecRow('スケール', 'scale', 0.01));
  body.appendChild(sec);
}

// Maps common material name patterns to Japanese labels
function matJaName(name) {
  if (!name) return name;
  const n = name.toLowerCase();
  const map = [
    [/skin|body|bod|flesh|肌/i,       '肌'],
    [/face|顔/i,                       '顔'],
    [/hair|髪/i,                       '髪'],
    [/eye.*white|eyewhite|sclerae/i,   '白目'],
    [/eye.*iris|iris|pupil/i,          '瞳'],
    [/eye.*highlight|highlight/i,      '目ハイライト'],
    [/eye.*lash|lash/i,                'まつ毛'],
    [/eyebrow|brow/i,                  '眉'],
    [/lip|mouth/i,                     '口'],
    [/tooth|teeth/i,                   '歯'],
    [/tongue/i,                        '舌'],
    [/cloth|wear|shirt|dress|top/i,    '服'],
    [/pant|bottom|skirt/i,             'ズボン'],
    [/shoe|boot|foot/i,                '靴'],
    [/sock|stocking/i,                 '靴下'],
    [/inner|under/i,                   '下着'],
    [/nail/i,                          '爪'],
  ];
  for (const [re, ja] of map) if (re.test(name)) return ja;
  return name;
}

function buildCustomizePanel() {
  const panel = document.getElementById('custom-list');
  panel.innerHTML = '';
  if (!currentRoot) { panel.innerHTML = '<p class="no-data">モデルを読み込んでください</p>'; return; }

  // ── body proportions ──
  const shapeSection = makeSection('体型');
  const rootScale = { x: 1, y: 1, z: 1 };

  const applyScale = () => {
    if (!currentRoot) return;
    currentRoot.scale.set(
      (2.0 / getBaseScale()) * rootScale.x,
      (2.0 / getBaseScale()) * rootScale.y,
      (2.0 / getBaseScale()) * rootScale.z
    );
  };

  // store base scale from auto-fit (cached as userData)
  if (!currentRoot.userData._baseScale) {
    const box = new THREE.Box3().setFromObject(currentRoot);
    const size = box.getSize(new THREE.Vector3());
    currentRoot.userData._baseScale = Math.max(size.x, size.y, size.z) * currentRoot.scale.x;
  }
  function getBaseScale() {
    return currentRoot.userData._baseScale || 2.0;
  }

  const b0c = getBaseScale();
  const normC = (v, b) => Math.round((v / (2 / b)) * 100) / 100;
  rootScale.x = normC(currentRoot.scale.x, b0c);
  rootScale.y = normC(currentRoot.scale.y, b0c);
  rootScale.z = normC(currentRoot.scale.z, b0c);
  shapeSection.appendChild(makeSlider('身長 (Y)', 0.5, 2.0, rootScale.y, 0.01, v => { rootScale.y = v; applyScale(); }));
  shapeSection.appendChild(makeSlider('横幅 (X)', 0.5, 2.0, rootScale.x, 0.01, v => { rootScale.x = v; applyScale(); }));
  shapeSection.appendChild(makeSlider('奥行き (Z)', 0.5, 2.0, rootScale.z, 0.01, v => { rootScale.z = v; applyScale(); }));
  panel.appendChild(shapeSection);

  // ── material colors ──
  const materials = [];
  const seen = new Set();
  currentRoot.traverse(obj => {
    if (!obj.isMesh) return;
    [].concat(obj.material || []).forEach(m => {
      if (!m || seen.has(m.uuid)) return;
      seen.add(m.uuid);
      materials.push(m);
    });
  });

  if (materials.length > 0) {
    const colorSection = makeSection('マテリアルカラー');
    let colorAdded = 0;
    materials.forEach(mat => {
      if (!mat.color) return;
      const jaName = matJaName(mat.name) || mat.name;
      const origColor = matColorHex(mat);
      colorSection.appendChild(makeColorRow(jaName, mat.name, origColor, hex => {
        setMatColor(mat, hex);
      }, () => {
        setMatColor(mat, origColor);
      }));
      colorAdded++;
    });
    if (colorAdded > 0) panel.appendChild(colorSection);

    // ── material properties ──
    const propSection = makeSection('マテリアル設定');
    let propAdded = 0;
    materials.forEach(mat => {
      const jaName = matJaName(mat.name) || mat.name;
      if (mat.roughness !== undefined) {
        propSection.appendChild(makeSlider(`${jaName} 粗さ`, 0, 1, mat.roughness, 0.01, v => { mat.roughness = v; }));
        propAdded++;
      }
      if (mat.metalness !== undefined) {
        propSection.appendChild(makeSlider(`${jaName} 金属感`, 0, 1, mat.metalness, 0.01, v => { mat.metalness = v; }));
        propAdded++;
      }
    });
    if (propAdded > 0) panel.appendChild(propSection);
  }

  // ── morph target shapes (body shape keys) ──
  const morphMap = {};
  currentRoot.traverse(obj => {
    if (!obj.isMesh || !obj.morphTargetDictionary) return;
    Object.entries(obj.morphTargetDictionary).forEach(([name, idx]) => {
      if (!morphMap[name]) morphMap[name] = [];
      morphMap[name].push({ mesh: obj, idx });
    });
  });
  const _VRM_EXPR_RE = /^(fcl_|Fcl_|blink|happy|angry|sad|surprised|relaxed|neutral|aa|ih|ou|ee|oh|lookUp|lookDown|lookLeft|lookRight)/i;
  const morphKeys = Object.keys(morphMap).filter(k =>
    /body|shape|proportion|bust|waist|hip|slim|fat|muscle|tall|short|chest|breast/i.test(k)
    || !_VRM_EXPR_RE.test(k)
  );
  if (morphKeys.length > 0) {
    const morphSection = makeSection('ボディシェイプ');
    const morphResetAllBtn = document.createElement('button');
    morphResetAllBtn.textContent = '全シェイプリセット';
    morphResetAllBtn.style.cssText = 'margin:4px 10px 2px;width:calc(100% - 20px);padding:3px 0;background:none;border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;cursor:pointer;';
    morphResetAllBtn.addEventListener('click', () => {
      morphKeys.forEach(name => {
        morphMap[name].forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = 0; });
      });
      buildCustomizePanel();
    });
    morphSection.appendChild(morphResetAllBtn);
    morphKeys.sort().forEach(name => {
      const targets = morphMap[name];
      const curVal = targets[0]?.mesh.morphTargetInfluences[targets[0].idx] ?? 0;
      morphSection.appendChild(makeSlider(formatMorphName(name), 0, 1, curVal, 0.01, v => {
        targets.forEach(({ mesh, idx }) => { mesh.morphTargetInfluences[idx] = v; });
      }));
    });
    panel.appendChild(morphSection);
  }

  // ── render tone ──
  const toneSection = makeSection('レンダリング');
  toneSection.appendChild(makeSlider('明るさ', 0.5, 3.0, renderer.toneMappingExposure, 0.05, v => { renderer.toneMappingExposure = v; }));
  toneSection.appendChild(makeSlider('太陽光', 0.0, 6.0, sun.intensity, 0.1, v => { sun.intensity = v; }));
  const hemiForCust = scene.children.find(c => c.isHemisphereLight);
  if (hemiForCust) {
    toneSection.appendChild(makeSlider('環境光', 0.0, 4.0, hemiForCust.intensity, 0.1, v => { hemiForCust.intensity = v; }));
  }
  panel.appendChild(toneSection);
}

// ── Feature 1: スプリングボーン物理設定 ─────────────────────
function _buildPhysicsItems(body) {
  const obj = getSelectedObj();
  if (!obj?.vrm?.springBoneManager) {
    body.innerHTML = '<p class="no-data">VRMモデルを選択してください（スプリングボーン）</p>';
    return;
  }
  const sbm = obj.vrm.springBoneManager;
  const joints = [...(sbm.joints || [])];
  if (joints.length === 0) {
    body.innerHTML = '<p class="no-data">スプリングボーンがありません</p>';
    return;
  }

  // Store originals once per VRM load
  joints.forEach(j => {
    if (j.settings._origStiffness === undefined) j.settings._origStiffness = j.settings.stiffness ?? 1.0;
    if (j.settings._origDrag === undefined) j.settings._origDrag = j.settings.dragForce ?? 0.4;
    if (j.settings._origGravity === undefined) j.settings._origGravity = j.settings.gravityPower ?? 0;
    if (j.settings._origHitRadius === undefined) j.settings._origHitRadius = j.settings.hitRadius ?? 0.02;
  });

  // Global controls section
  const globalSec = makeSection('全体設定');
  const first = joints[0];

  globalSec.appendChild(makeSlider('硬さ (Stiffness)', 0, 4, first.settings.stiffness ?? 1.0, 0.01,
    v => joints.forEach(j => { j.settings.stiffness = v; })));
  globalSec.appendChild(makeSlider('重力 (Gravity)', 0, 2, first.settings.gravityPower ?? 0, 0.01,
    v => joints.forEach(j => { j.settings.gravityPower = v; })));
  globalSec.appendChild(makeSlider('抵抗 (Drag)', 0, 1, first.settings.dragForce ?? 0.4, 0.01,
    v => joints.forEach(j => { j.settings.dragForce = v; })));
  globalSec.appendChild(makeSlider('当たり判定半径', 0, 0.1, first.settings.hitRadius ?? 0.02, 0.001,
    v => joints.forEach(j => { j.settings.hitRadius = v; })));

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '元の値に戻す';
  resetBtn.className = 'param-btn';
  resetBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    joints.forEach(j => {
      j.settings.stiffness = j.settings._origStiffness ?? 1.0;
      j.settings.gravityPower = j.settings._origGravity ?? 0;
      j.settings.dragForce = j.settings._origDrag ?? 0.4;
      j.settings.hitRadius = j.settings._origHitRadius ?? 0.02;
    });
    const resetColliders = [...(sbm.colliders || [])];
    resetColliders.forEach(c => {
      if (c.shape?._origRadius !== undefined) { c.shape.radius = c.shape._origRadius; }
    });
    body.innerHTML = ''; _buildPhysicsItems(body);
  });
  globalSec.appendChild(resetBtn);
  body.appendChild(globalSec);

  // Individual joint groups - group by bone name prefix
  const groups = {};
  joints.forEach(j => {
    const boneName = j.bone?.name || 'Unknown';
    const grp = boneName.replace(/[_\d]+$/, '') || boneName;
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(j);
  });

  const grpNames = Object.keys(groups).slice(0, 10);
  if (grpNames.length > 1) {
    const grpSec = makeSection(`ボーングループ (${Object.keys(groups).length}グループ)`);
    grpNames.forEach(grpName => {
      const grpJoints = groups[grpName];
      const row = document.createElement('div');
      row.style.cssText = 'margin:6px 10px 2px;font-size:10px;color:var(--text);font-weight:700;border-top:1px solid var(--border);padding-top:4px;';
      row.textContent = `${grpName} (${grpJoints.length}本)`;
      grpSec.appendChild(row);
      grpSec.appendChild(makeSlider('硬さ', 0, 4, grpJoints[0].settings.stiffness ?? 1.0, 0.01,
        v => grpJoints.forEach(j => { j.settings.stiffness = v; })));
      grpSec.appendChild(makeSlider('抵抗', 0, 1, grpJoints[0].settings.dragForce ?? 0.4, 0.01,
        v => grpJoints.forEach(j => { j.settings.dragForce = v; })));
    });
    body.appendChild(grpSec);
  }

  // Collider section
  const colliders = [...(sbm.colliders || [])];
  if (colliders.length > 0) {
    const colliderSec = makeSection(`コライダー (${colliders.length}個)`);

    // Store original radii BEFORE building sliders
    colliders.forEach(c => {
      if (c.shape?.radius !== undefined && c.shape._origRadius === undefined) {
        c.shape._origRadius = c.shape.radius;
      }
    });

    // Global radius multiplier
    let _colliderMult = 1.0;
    colliderSec.appendChild(makeSlider('全体サイズ倍率', 0.1, 3.0, 1.0, 0.01, v => {
      _colliderMult = v;
      colliders.forEach(c => {
        if (c.shape?.radius !== undefined && c.shape._origRadius !== undefined) {
          c.shape.radius = c.shape._origRadius * v;
        }
      });
    }));

    // Show first 8 colliders individually
    colliders.slice(0, 8).forEach((c, i) => {
      const boneName = c.name || `collider_${i}`;
      const isCapsule = c.shape?.tail !== undefined;
      const shapeLabel = isCapsule ? 'カプセル' : '球';
      const cRow = document.createElement('div');
      cRow.style.cssText = 'padding:2px 10px;font-size:10px;color:#aaa;display:flex;align-items:center;gap:4px;';
      cRow.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${boneName} [${shapeLabel}]</span>`;
      colliderSec.appendChild(cRow);
      if (c.shape?.radius !== undefined) {
        colliderSec.appendChild(makeSlider('半径', 0, 0.2, c.shape.radius, 0.001,
          v => { c.shape.radius = v; c.shape._origRadius = v; }));
      }
    });

    body.appendChild(colliderSec);
  }

  // Node Constraints section
  if (obj.vrm.nodeConstraintManager) {
    const ncm = obj.vrm.nodeConstraintManager;
    const constraints = [...(ncm.constraints || [])];
    if (constraints.length > 0) {
      const constraintSec = makeSection(`ノードコンストレイント (${constraints.length}個)`);
      constraints.slice(0, 10).forEach(constraint => {
        const destName = constraint.destination?.name || 'unknown';
        const srcName = constraint.source?.name || '?';
        const label = `${destName} ← ${srcName}`;
        const cur = constraint.weight ?? 1.0;
        constraintSec.appendChild(makeSlider(label.length > 24 ? label.slice(0, 24) + '…' : label,
          0, 1, cur, 0.01, v => { constraint.weight = v; }));
      });
      body.appendChild(constraintSec);
    }
  }
}

// ── まつ毛設定 ─────────────────────────────────────────────────
function _buildLashParams(body) {
  const obj = getSelectedObj();
  if (!obj?.vrm && !currentRoot) { body.innerHTML = '<p class="no-data">モデルを選択してください</p>'; return; }
  const mats = categorizeVRMMaterials();
  // Eyelash materials are in brows category - filter by eyelash pattern
  const lashMats = mats.brows.filter(m => /eyelash|lash/i.test(m.name || ''));
  // Also check other categories
  const allMats = [...mats.eyes, ...mats.other];
  allMats.forEach(m => { if (/eyelash|lash/i.test(m.name || '') && !lashMats.includes(m)) lashMats.push(m); });

  if (lashMats.length === 0) {
    // Fall back to showing all brows/lash materials
    mats.brows.forEach(m => { if (!lashMats.includes(m)) lashMats.push(m); });
  }

  if (lashMats.length === 0) {
    body.innerHTML = '<p class="no-data">まつ毛マテリアルが見つかりません</p>';
    return;
  }

  const colorSec = makeSection('まつ毛カラー');
  lashMats.forEach(mat => {
    const baseHex = matColorHex(mat);
    const lashLabel = matJaName(mat.name) || mat.name;
    colorSec.appendChild(makeColorRow(lashLabel, mat.name, baseHex,
      hex => setMatColor(mat, hex),
      () => setMatColor(mat, baseHex)
    ));
    if (isMToon(mat) && mat.shadeColorFactor) {
      const shadeHex = colorObjHex(mat.shadeColorFactor);
      colorSec.appendChild(makeColorRow('影色', mat.name + '_lash_shade', shadeHex,
        hex => setColorObj(mat.shadeColorFactor, hex),
        () => setColorObj(mat.shadeColorFactor, shadeHex)
      ));
    }
  });
  body.appendChild(colorSec);

  const outSec = makeSection('アウトライン');
  let outAdded = 0;
  lashMats.filter(isMToon).forEach(mat => {
    if (mat.outlineWidthFactor !== undefined) {
      outSec.appendChild(makeSlider('太さ', 0, 0.05, mat.outlineWidthFactor, 0.001,
        v => { mat.outlineWidthFactor = v; }));
      outAdded++;
    }
    if (mat.outlineColorFactor) {
      const outHex = colorObjHex(mat.outlineColorFactor);
      outSec.appendChild(makeColorRow('色', mat.name + '_lash_out', outHex,
        hex => setColorObj(mat.outlineColorFactor, hex),
        () => setColorObj(mat.outlineColorFactor, outHex)
      ));
      outAdded++;
    }
  });
  if (outAdded > 0) body.appendChild(outSec);

  // Quick presets
  const presetSec = makeSection('カラープリセット');
  const lashColors = [['黒','#111111'],['茶','#3d2010'],['灰','#555555'],['白','#eeeeee'],['青','#102040']];
  const pr = document.createElement('div');
  pr.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;padding:4px 10px;';
  lashColors.forEach(([label, hex]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'param-btn';
    btn.style.cssText = `background:${hex};color:${hex === '#eeeeee' ? '#333' : '#eee'};font-size:10px;padding:2px 6px;border:1px solid #555;border-radius:3px;cursor:pointer;`;
    btn.addEventListener('click', () => {
      lashMats.forEach(m => setMatColor(m, hex));
      // Update color pickers
      colorSec.querySelectorAll('input[type="color"]').forEach(p => { p.value = hex; });
    });
    pr.appendChild(btn);
  });
  presetSec.appendChild(pr);
  body.appendChild(presetSec);

  // Morphs for eyelashes (if any)
  const morphs = categorizeVRMMorphs();
  const lashMorphs = morphs.brows.filter(e => /lash/i.test(e.name));
  if (lashMorphs.length > 0) {
    const morphSec = makeSection('まつ毛モーフ');
    lashMorphs.forEach(entry => {
      const cur = entry.targets[0]?.mesh?.morphTargetInfluences?.[entry.targets[0].idx] ?? 0;
      morphSec.appendChild(makeSlider(formatMorphName(entry.name), 0, 1, cur, 0.01,
        v => entry.targets.forEach(t => { t.mesh.morphTargetInfluences[t.idx] = v; })
      ));
    });
    body.appendChild(morphSec);
  }
}

// ── Feature 2: LookAt視線設定 ────────────────────────────────
function _buildLookAtParams(body) {
  const obj = getSelectedObj();
  if (!obj?.vrm?.lookAt) {
    body.innerHTML = '<p class="no-data">VRMモデルを選択してください</p>';
    return;
  }
  const lookAt = obj.vrm.lookAt;

  const sec = makeSection('視線追従');

  let _lookAtEnabled = !!(lookAt.target);
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'param-btn';
  toggleBtn.textContent = _lookAtEnabled ? '視線追従: ON (カメラ)' : '視線追従: OFF';
  toggleBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:4px 0;border:1px solid var(--border);border-radius:3px;font-size:10px;font-weight:700;cursor:pointer;background:' + (_lookAtEnabled ? '#2a5' : '#333') + ';color:#fff;';
  toggleBtn.addEventListener('click', () => {
    _lookAtEnabled = !_lookAtEnabled;
    if (_lookAtEnabled) {
      if (!window._lookAtTarget) {
        window._lookAtTarget = new THREE.Object3D();
        scene.add(window._lookAtTarget);
      }
      lookAt.target = window._lookAtTarget;
      toggleBtn.textContent = '視線追従: ON (カメラ)';
      toggleBtn.style.background = '#2a5';
    } else {
      lookAt.target = null;
      toggleBtn.textContent = '視線追従: OFF';
      toggleBtn.style.background = '#333';
    }
  });
  sec.appendChild(toggleBtn);

  if (!lookAt.offsetFromHeadBone) lookAt.offsetFromHeadBone = new THREE.Vector3();
  const off = lookAt.offsetFromHeadBone;
  sec.appendChild(makeSlider('オフセットX', -0.1, 0.1, off.x, 0.001, v => { lookAt.offsetFromHeadBone.x = v; }));
  sec.appendChild(makeSlider('オフセットY', -0.1, 0.1, off.y, 0.001, v => { lookAt.offsetFromHeadBone.y = v; }));
  sec.appendChild(makeSlider('オフセットZ', -0.1, 0.1, off.z, 0.001, v => { lookAt.offsetFromHeadBone.z = v; }));
  body.appendChild(sec);

  if (lookAt.applier) {
    const manSec = makeSection('手動視線');
    const noteEl = document.createElement('div');
    noteEl.style.cssText = 'padding:2px 10px 4px;font-size:9px;color:var(--text2);opacity:0.7;';
    noteEl.textContent = '※カメラ追従OFFのときのみ有効';
    manSec.appendChild(noteEl);
    manSec.appendChild(makeSlider('水平（Yaw）', -90, 90, lookAt.yaw ?? 0, 0.5, v => {
      try { lookAt.yaw = v; } catch(e) {}
    }));
    manSec.appendChild(makeSlider('垂直（Pitch）', -90, 90, lookAt.pitch ?? 0, 0.5, v => {
      try { lookAt.pitch = v; } catch(e) {}
    }));
    body.appendChild(manSec);
  }
}

// ── Feature 3: メイク設定 ─────────────────────────────────────
function _buildMakeupParams(body) {
  const obj = getSelectedObj();
  if (!obj?.vrm) {
    body.innerHTML = '<p class="no-data">VRMモデルを選択してください</p>';
    return;
  }
  const mats = categorizeVRMMaterials();

  const eyeMats = mats.eyes || [];
  const skinMats = mats.skin || [];
  let anySectionAdded = false;

  if (eyeMats.length > 0) {
    const eyeSec = makeSection('アイシャドウ');
    let eyeAdded = 0;
    eyeMats.slice(0, 3).forEach(mat => {
      if (!mat) return;
      const matLabel = matJaName(mat.name) || mat.name || '目';
      if (isMToon(mat)) {
        if (mat.shadeColorFactor) {
          const orig = colorObjHex(mat.shadeColorFactor);
          eyeSec.appendChild(makeColorRow(matLabel + ' 影色', mat.name + '_makeup_shade', orig,
            hex => setColorObj(mat.shadeColorFactor, hex),
            () => setColorObj(mat.shadeColorFactor, orig)
          ));
          eyeAdded++;
        }
        if (mat.shadingShiftFactor !== undefined) {
          eyeSec.appendChild(makeSlider(matLabel + ' 影強さ', -1, 1, mat.shadingShiftFactor, 0.01,
            v => { mat.shadingShiftFactor = v; }));
          eyeAdded++;
        }
      }
    });
    if (eyeAdded > 0) { body.appendChild(eyeSec); anySectionAdded = true; }
  }

  if (skinMats.length > 0) {
    const cheekSec = makeSection('チーク');
    let cheekAdded = 0;
    skinMats.filter(isMToon).slice(0, 2).forEach(mat => {
      if (mat.parametricRimColorFactor) {
        const rimHex = colorObjHex(mat.parametricRimColorFactor);
        cheekSec.appendChild(makeColorRow('チーク色', mat.name + '_cheek', rimHex,
          hex => setColorObj(mat.parametricRimColorFactor, hex),
          () => setColorObj(mat.parametricRimColorFactor, rimHex)
        ));
        cheekAdded++;
      }
      if (mat.parametricRimLiftFactor !== undefined) {
        cheekSec.appendChild(makeSlider('チーク強度', 0, 2, mat.parametricRimLiftFactor, 0.01,
          v => { mat.parametricRimLiftFactor = v; }));
        cheekAdded++;
      }
    });
    if (cheekAdded > 0) { body.appendChild(cheekSec); anySectionAdded = true; }

    const lipMats = skinMats.filter(m => m?.color);
    if (lipMats.length > 0) {
    const lipSec = makeSection('リップ');
    lipMats.slice(0, 2).forEach(mat => {
      const baseHex = matColorHex(mat);
      lipSec.appendChild(makeColorRow('リップ色', mat.name + '_lip', baseHex,
        hex => setMatColor(mat, hex),
        () => setMatColor(mat, baseHex)
      ));
    });
    body.appendChild(lipSec);
    anySectionAdded = true;
    } // if (lipMats.length > 0)
  } // if (skinMats.length > 0)

  if (!anySectionAdded) {
    body.innerHTML = '<p class="no-data">メイク用マテリアルが見つかりません</p>';
  }
}

// ── Feature 5: カスタム表情保存・適用 ────────────────────────
function _buildCustomExprSection(body) {
  const customSec = makeSection('カスタム表情');

  const saveRow = document.createElement('div');
  saveRow.style.cssText = 'display:flex;gap:4px;padding:4px 10px 6px;';
  const nameIn = document.createElement('input');
  nameIn.type = 'text';
  nameIn.placeholder = '表情名を入力...';
  nameIn.style.cssText = 'flex:1;background:#1a1a2e;color:#e0e0ff;border:1px solid #444;padding:3px 6px;border-radius:3px;font-size:11px;';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '保存';
  saveBtn.style.cssText = 'padding:3px 8px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
  saveBtn.addEventListener('click', () => {
    const name = nameIn.value.trim();
    if (!name) return;
    const obj = getSelectedObj();
    if (!obj?.vrm) return;
    const em = obj.vrm.expressionManager;
    const snapshot = {};
    if (em) {
      const exprNames = Object.keys(em.expressionMap || {});
      exprNames.forEach(n => { snapshot[n] = em.getValue(n) ?? 0; });
    }
    obj.root.traverse(child => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        const meshKey = child.name || child.uuid;
        snapshot['__morphs__' + meshKey] = {};
        Object.entries(child.morphTargetDictionary).forEach(([k, i]) => {
          snapshot['__morphs__' + meshKey][k] = child.morphTargetInfluences[i] || 0;
        });
      }
    });
    if (!window._customExpressions) window._customExpressions = {};
    window._customExpressions[name] = snapshot;
    nameIn.value = '';
    setStatus(`表情「${name}」を保存しました`); setTimeout(() => setStatus(''), 2000);
    const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildExprItems(b); }
  });
  saveRow.appendChild(nameIn);
  saveRow.appendChild(saveBtn);
  customSec.appendChild(saveRow);

  if (window._customExpressions) {
    Object.entries(window._customExpressions).forEach(([name, snapshot]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 10px;';

      const applyBtn = document.createElement('button');
      applyBtn.textContent = name;
      applyBtn.style.cssText = 'flex:1;text-align:left;font-size:11px;padding:3px 6px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      applyBtn.addEventListener('click', () => {
        const obj = getSelectedObj();
        if (!obj?.vrm) return;
        const em = obj.vrm.expressionManager;
        if (em) {
          Object.entries(snapshot).forEach(([k, v]) => {
            if (!k.startsWith('__morphs__')) {
              try { em.setValue(k, v); } catch(e) {}
            }
          });
        }
        obj.root.traverse(child => {
          if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
            const meshKey = '__morphs__' + (child.name || child.uuid);
            if (snapshot[meshKey]) {
              Object.entries(snapshot[meshKey]).forEach(([k, v]) => {
                const i = child.morphTargetDictionary[k];
                if (i !== undefined) child.morphTargetInfluences[i] = v;
              });
            }
          }
        });
        setStatus(`表情「${name}」を適用しました`); setTimeout(() => setStatus(''), 2000);
      });

      const exportBtn = document.createElement('button');
      exportBtn.textContent = '↓';
      exportBtn.title = 'JSONで保存';
      exportBtn.style.cssText = 'padding:2px 6px;font-size:10px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;';
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ name, snapshot }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `expression_${name}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.style.cssText = 'padding:2px 6px;font-size:10px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;';
      delBtn.addEventListener('click', () => {
        delete window._customExpressions[name];
        const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildExprItems(b); }
      });

      row.appendChild(applyBtn);
      row.appendChild(exportBtn);
      row.appendChild(delBtn);
      customSec.appendChild(row);
    });
  }

  const importBtn = document.createElement('button');
  importBtn.textContent = '表情をJSONから読込';
  importBtn.style.cssText = 'margin:4px 10px;width:calc(100% - 20px);padding:4px 0;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);font-size:10px;font-weight:700;cursor:pointer;';
  importBtn.addEventListener('click', () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = '.json';
    fi.addEventListener('change', () => {
      const f = fi.files?.[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!window._customExpressions) window._customExpressions = {};
          window._customExpressions[data.name] = data.snapshot;
          const b = _getItemsBody(); if (b) { b.innerHTML = ''; _buildExprItems(b); }
          setStatus(`表情「${data.name}」をインポートしました`); setTimeout(() => setStatus(''), 2000);
        } catch(err) { setStatus('JSONの読込に失敗しました', true); }
      };
      reader.readAsText(f);
    });
    fi.click();
  });
  customSec.appendChild(importBtn);

  body.appendChild(customSec);
}

// ── Feature 6: 環境マップ (HDRI Preset) ──────────────────────
let _currentEnvPreset = 'none';
function applyEnvPreset(preset) {
  _currentEnvPreset = preset;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  if (preset === 'none') {
    scene.environment = null;
    pmrem.dispose();
    return;
  }

  const colors = {
    studio: [0xffffff, 0x888888],
    sunset:  [0xff6633, 0x334466],
    forest:  [0x44aa44, 0x223322],
    city:    [0x8899bb, 0x223344],
  };
  const [top, bot] = colors[preset] || [0xffffff, 0x444444];

  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(1, 32, 16);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      botColor: { value: new THREE.Color(bot) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() { vWorldPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 botColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(botColor, topColor, h), 1.0);
      }
    `,
  });
  const envMesh = new THREE.Mesh(envGeo, envMat);
  envScene.add(envMesh);

  const envRT = pmrem.fromScene(envScene);
  const prevEnv = scene.environment;
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;
  pmrem.dispose();
  envMat.dispose(); envGeo.dispose();
  if (prevEnv && prevEnv !== scene.environment) prevEnv.dispose();
}

function makeSection(title) {
  const sec = document.createElement('div');
  sec.className = 'custom-section';
  const hdr = document.createElement('div');
  hdr.className = 'custom-section-title';
  hdr.textContent = title;
  sec.appendChild(hdr);
  return sec;
}

function makeColorRow(label, matName, defaultHex, onChange, onReset) {
  // Sanitize hex — color inputs require valid 6-digit hex
  if (!defaultHex || !/^#[0-9a-fA-F]{6}$/.test(defaultHex)) defaultHex = '#808080';
  const row = document.createElement('div');
  row.className = 'color-row';
  const lbl = document.createElement('span');
  lbl.className = 'color-label';
  lbl.textContent = label !== matName ? label : matName;
  if (matName && label !== matName) {
    lbl.title = matName;
  }
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = defaultHex;
  picker.addEventListener('input', () => onChange(picker.value));
  const resetBtn = document.createElement('button');
  resetBtn.className = 'color-reset';
  resetBtn.textContent = '↺';
  resetBtn.title = 'リセット';
  resetBtn.addEventListener('click', () => {
    picker.value = defaultHex;
    onReset();
  });
  row.appendChild(lbl);
  row.appendChild(picker);
  row.appendChild(resetBtn);
  return row;
}

// ── legacy stubs (replaced by new panel system) ───────────
function buildExpressionPanel() { /* replaced by _buildExprItems */ }
function buildPosePanel()       { /* replaced by _buildPoseItems  */ }
function buildAnimationPanel()  { /* replaced by _buildAnimItems  */ }

// ── slider helper ─────────────────────────────────────────
function makeSlider(label, min, max, value, step, onChange) {
  const safeVal = (isNaN(value) || value === undefined || value === null)
    ? min : Math.max(min, Math.min(max, value));
  value = safeVal;
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;
  const sl = document.createElement('input');
  sl.type = 'range';
  sl.min = min; sl.max = max; sl.step = step; sl.value = value;
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
  const val = document.createElement('span');
  val.className = 'ctrl-val';
  val.textContent = Number(value).toFixed(decimals);
  const initVal = value;
  val.title = `ダブルクリックでリセット (${Number(initVal).toFixed(decimals)})`;
  val.style.cursor = 'pointer';
  let rafId = null;
  sl.addEventListener('input', () => {
    const v = parseFloat(sl.value);
    val.textContent = v.toFixed(decimals);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => { onChange(v); rafId = null; });
  });
  val.addEventListener('dblclick', () => {
    sl.value = initVal;
    const v = parseFloat(initVal);
    val.textContent = v.toFixed(decimals);
    onChange(v);
  });
  row.appendChild(lbl); row.appendChild(sl); row.appendChild(val);
  return row;
}

function buildScenePanel() { /* replaced by _buildSceneItems */ }

// ── render loop ───────────────────────────────────────────
const clock = new THREE.Clock();
let _fps = 0, _fpsFrames = 0, _fpsTimer = 0;
(function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (_autoRotate && currentRoot) {
    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), _autoRotateSpeed * dt);
    camera.lookAt(orbitCtrl.target);
  }
  orbitCtrl.update();
  // Update lookAt target to camera position (Feature 2)
  if (window._lookAtTarget) {
    window._lookAtTarget.position.copy(camera.position);
  }
  sceneObjects.forEach(o => { o.mixer?.update(dt); o.vrm?.update(dt); });
  renderer.render(scene, camera);
  _fpsFrames++;
  _fpsTimer += dt;
  if (_fpsTimer >= 1) {
    _fps = _fpsFrames;
    _fpsFrames = 0; _fpsTimer = 0;
    const fpsEl = document.getElementById('status-fps');
    if (fpsEl) fpsEl.textContent = _fps + ' fps';
  }
  // auto-blink
  if (_autoBlink && currentVrm?.expressionManager) {
    _autoBlinkTimer += dt;
    if (_autoBlinkTimer > 3.5 + Math.random() * 1.5) {
      _autoBlinkTimer = 0;
      currentVrm.expressionManager.setValue('blink', 1);
      setTimeout(() => { if (currentVrm?.expressionManager) currentVrm.expressionManager.setValue('blink', 0); }, 150);
    }
  }
  // animation time display
  const timeEl = document.getElementById('status-anim');
  if (timeEl && currentAction && !currentAction.paused) {
    timeEl.textContent = currentAction.time.toFixed(2) + 's';
  } else if (timeEl && (!currentAction || currentAction.paused)) {
    timeEl.textContent = '';
  }
})();

// ── buttons ───────────────────────────────────────────────
// open file → add to scene
document.getElementById('btn-open').addEventListener('click', () => {
  pickFile('.vrm,.glb,.gltf', f => {
    const url = URL.createObjectURL(f);
    addToScene(url, f.name).then(obj => { if (obj) saveRecentProject(f.name, url); });
  });
});

// preset buttons → replace main model
document.getElementById('btn-sample').addEventListener('click', async () => {
  try {
    const res = await fetch('/sample.vrm');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await loadMainModel(URL.createObjectURL(await res.blob()), 'AliciaSolid.vrm');
  } catch (e) { setStatus('エラー: ' + e.message, true); }
});

document.getElementById('btn-base').addEventListener('click', () => {
  document.getElementById('model-name').textContent = '';
  clearAllObjects();
  const root = createBaseMannequin();
  scene.add(root);
  const id = Math.random().toString(36).slice(2);
  sceneObjects.push({ id, name: '素体', root, vrm: null, mixer: null, clips: [], currentAction: null });
  selectObject(id);
  document.getElementById('model-name').textContent = '素体';
  document.getElementById('empty-hint').style.display = 'none';
  requestAnimationFrame(() => {
    orbitCtrl.target.set(0, 1.0, 0);
    camera.position.set(0, 1.3, 3.2);
    orbitCtrl.update();
  });
  setStatus('素体を生成しました'); setTimeout(() => setStatus(''), 2000);
});

document.getElementById('btn-luna').addEventListener('click', async () => {
  try {
    const res = await fetch('/luna_mizuki.glb');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await loadMainModel(URL.createObjectURL(await res.blob()), 'Luna Mizuki (GLB)');
  } catch (e) { setStatus('エラー: ' + e.message, true); }
});

// add asset button → add without clearing
document.getElementById('btn-add')?.addEventListener('click', () => {
  pickFile('.vrm,.glb,.gltf', f => {
    const url = URL.createObjectURL(f);
    addToScene(url, f.name).then(obj => { if (obj) saveRecentProject(f.name, url); });
  });
});

// ── drag & drop → add to scene ────────────────────────────
vpEl.addEventListener('dragover', e => { e.preventDefault(); vpEl.classList.add('drag-over'); });
vpEl.addEventListener('dragleave', () => vpEl.classList.remove('drag-over'));
vpEl.addEventListener('drop', e => {
  e.preventDefault();
  vpEl.classList.remove('drag-over');
  const f = e.dataTransfer?.files?.[0];
  if (f) {
    const url = URL.createObjectURL(f);
    addToScene(url, f.name).then(obj => { if (obj) saveRecentProject(f.name, url); });
  }
});

// ── duplicate object ──────────────────────────────────────
function duplicateSelectedObject() {
  const obj = getSelectedObj();
  if (!obj || obj.vrm) { setStatus('VRMモデルは複製できません', true); return; }
  const newRoot = obj.root.clone();
  const dupBox = new THREE.Box3().setFromObject(obj.root);
  newRoot.position.x += (dupBox.getSize(new THREE.Vector3()).x || 0.5) + 0.1;
  scene.add(newRoot);
  const id = Math.random().toString(36).slice(2);
  sceneObjects.push({ id, name: obj.name + ' copy', root: newRoot, vrm: null, mixer: null, clips: [], currentAction: null, isClothing: obj.isClothing });
  selectObject(id);
  setStatus('複製しました'); setTimeout(() => setStatus(''), 2000);
}

// ── screenshot ────────────────────────────────────────────
function takeScreenshot() {
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  const rt = new THREE.WebGLRenderTarget(W, H, {
    format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
  });
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, pixels);
  renderer.setRenderTarget(null);
  rt.dispose();

  // WebGL framebuffer is Y-flipped
  const flipped = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const srcRow = (H - 1 - y) * W * 4;
    flipped.set(pixels.subarray(srcRow, srcRow + W * 4), y * W * 4);
  }
  const c2d = document.createElement('canvas');
  c2d.width = W; c2d.height = H;
  c2d.getContext('2d').putImageData(new ImageData(flipped, W, H), 0, 0);

  const a = document.createElement('a');
  a.href = c2d.toDataURL('image/png');
  a.download = (document.getElementById('model-name')?.textContent || 'screenshot').replace(/\s+/g, '_') + '.png';
  a.click();
  setStatus('スクリーンショット保存'); setTimeout(() => setStatus(''), 2000);
}

document.getElementById('btn-screenshot')?.addEventListener('click', takeScreenshot);

// ── keyboard shortcuts ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (currentAction) {
      currentAction.paused = !currentAction.paused;
      setStatus(currentAction.paused ? '一時停止' : '再生中'); setTimeout(() => setStatus(''), 1200);
    }
  } else if (e.code === 'KeyF') {
    focusFace();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
    if (currentVrm?.humanoid) {
      VRM_BONE_GROUPS.forEach(g => g.bones.forEach(def => {
        const node = currentVrm.humanoid.getRawBoneNode(def.name);
        if (node) node.rotation.set(0, 0, 0);
      }));
      setStatus('ポーズリセット'); setTimeout(() => setStatus(''), 1200);
    }
  } else if (e.code === 'KeyG') {
    _gridHelper.visible = !_gridHelper.visible;
  } else if (e.code === 'Delete' || (e.code === 'Backspace' && e.metaKey)) {
    if (selectedId) removeObject(selectedId);
  } else if (e.code === 'Escape') {
    camera.position.set(0, 1.3, 3.2);
    orbitCtrl.target.set(0, 1.0, 0);
    orbitCtrl.update();
  } else if (e.code === 'Digit1') {
    camera.position.set(0,1.42,0.45); orbitCtrl.target.set(0,1.38,0); orbitCtrl.update();
  } else if (e.code === 'Digit2') {
    camera.position.set(0,0.9,2.6); orbitCtrl.target.set(0,0.9,0); orbitCtrl.update();
  } else if (e.code === 'Digit3') {
    camera.position.set(1.8,1.0,0); orbitCtrl.target.set(0,1.0,0); orbitCtrl.update();
  } else if (e.code === 'Digit4') {
    camera.position.set(0,1.0,-2.6); orbitCtrl.target.set(0,1.0,0); orbitCtrl.update();
  } else if (e.code === 'Digit5') {
    camera.position.set(0,3.5,0.1); orbitCtrl.target.set(0,0.8,0); orbitCtrl.update();
  } else if (e.code === 'KeyH') {
    const obj = getSelectedObj(); if (obj) { obj.root.visible = !obj.root.visible; _buildItemsPanel(); }
  } else if (e.code === 'Tab') {
    e.preventDefault();
    if (sceneObjects.length > 0) {
      const idx = sceneObjects.findIndex(o => o.id === selectedId);
      const next = sceneObjects[(idx + 1) % sceneObjects.length];
      if (next) selectObject(next.id);
    }
  } else if (e.code === 'KeyD' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    duplicateSelectedObject();
  } else if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById('btn-export')?.click();
  } else if (e.code === 'KeyP' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    takeScreenshot();
  }
});

// ── tabs ──────────────────────────────────────────────────
// ── Category tab bar ──────────────────────────────────────
const CAT_TITLES = {
  face:'フェイスセット', hair:'髪型', body:'ボディ', outfit:'衣装',
  expr:'表情プリセット', pose:'ポーズ制御', anim:'アニメーション', scene:'シーン',
  physics:'スプリングボーン物理',
};

document.querySelectorAll('.cat-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const cat = btn.dataset.cat;
    _currentCat  = cat;
    _currentItem = null;
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.toggle('active', b === btn));
    _setItemsTitle(CAT_TITLES[cat] || cat);
    _clearParams('左のリストから項目を選択してください');
    _buildItemsPanel();
  });
});

// ── VRM / GLB エクスポート ────────────────────────────────
document.getElementById('btn-export').addEventListener('click', () => {
  if (!currentRoot) { setStatus('エクスポートするモデルがありません', true); return; }
  setStatus('エクスポート中...');
  const exporter = new GLTFExporter();
  const opts = { binary: true, animations: getSelectedObj()?.clips || [] };
  exporter.parse(
    currentRoot,
    result => {
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const rawName = document.getElementById('model-name').textContent || 'avatar';
      const name = rawName.replace(/\s+/g, '_').replace(/[^\w\-぀-ヿ㐀-䶿一-鿿]/g, '') || 'avatar';
      const ext = getSelectedObj()?.vrm ? '.vrm' : '.glb';
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: name + ext,
      });
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('エクスポート完了 → ' + name + ext);
      setTimeout(() => setStatus(''), 4000);
    },
    err => setStatus('エクスポートエラー: ' + (err?.message || err), true),
    opts
  );
});


// ══════════════════════════════════════════════════════════════════════
//  髪型プリセット定義（30スタイル × 11 VRM ファイル）
// ══════════════════════════════════════════════════════════════════════
const _HAIR_PRESET_SVG = {
  vshort: `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="29" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 13 27 13 27 22V17C27 9 9 9 9 17Z" fill="currentColor"/><rect x="9" y="17" width="18" height="5" rx="2" fill="currentColor" opacity=".6"/></svg>`,
  short:  `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="29" rx="9" ry="11" fill="#b8926a"/><path d="M9 23C9 13 27 13 27 23V17C27 9 9 9 9 17Z" fill="currentColor"/></svg>`,
  asym:   `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="29" rx="9" ry="11" fill="#b8926a"/><path d="M9 23C9 13 27 13 27 23V17C27 9 9 9 9 17Z" fill="currentColor"/><path d="M9 23 L9 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  bob:    `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="27" rx="9" ry="11" fill="#b8926a"/><path d="M9 23C9 13 27 13 27 23V17C27 9 9 9 9 17Z" fill="currentColor"/><path d="M9 23 L9 35 Q9 37 11 37 L25 37 Q27 37 27 35 L27 23" fill="currentColor" opacity=".85"/></svg>`,
  medium: `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="27" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 13 27 13 27 22V17C27 9 9 9 9 17Z" fill="currentColor"/><path d="M9 24 Q8 32 10 37" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M27 24 Q28 32 26 37" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  layered:`<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="27" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 13 27 13 27 22V17C27 9 9 9 9 17Z" fill="currentColor"/><path d="M9 26 Q8 33 9 38" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M27 26 Q28 33 27 38" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M10 30 Q9 34 11 37" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity=".6"/></svg>`,
  long:   `<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M9 23 Q7 37 9 46" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M27 23 Q29 37 27 46" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/></svg>`,
  wavy:   `<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M9 23 Q6 30 9 34 Q6 38 9 42 Q7 45 9 47" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M27 23 Q30 30 27 34 Q30 38 27 42 Q29 45 27 47" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`,
  gothic: `<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M9 23 Q6 35 8 47" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M27 23 Q30 35 28 47" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`,
  ponytail:`<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><circle cx="27" cy="18" r="2.5" fill="currentColor"/><path d="M27 21 Q31 30 27 43" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  twintail:`<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><circle cx="9" cy="20" r="2" fill="currentColor"/><path d="M9 22 Q5 32 7 43" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="27" cy="20" r="2" fill="currentColor"/><path d="M27 22 Q31 32 29 43" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"/></svg>`,
  halfup: `<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M9 24 Q7 36 8 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M27 24 Q29 36 28 44" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M14 16 Q18 13 22 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="12" r="2.5" fill="currentColor"/></svg>`,
  bun:    `<svg viewBox="0 0 36 44" fill="none"><ellipse cx="18" cy="28" rx="9" ry="11" fill="#b8926a"/><path d="M9 23C9 12 27 12 27 23V17C27 8 9 8 9 17Z" fill="currentColor"/><ellipse cx="18" cy="9" rx="5" ry="4.5" fill="currentColor"/></svg>`,
  braid:  `<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M12 25 Q10 31 12 37 Q10 43 12 47" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M24 25 Q26 31 24 37 Q26 43 24 47" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M12 31 L24 31" stroke="currentColor" stroke-width="1.2" opacity=".5"/><path d="M12 42 L24 42" stroke="currentColor" stroke-width="1.2" opacity=".5"/></svg>`,
  feminine:`<svg viewBox="0 0 36 48" fill="none"><ellipse cx="18" cy="25" rx="9" ry="11" fill="#b8926a"/><path d="M9 22C9 11 27 11 27 22V16C27 7 9 7 9 16Z" fill="currentColor"/><path d="M8 24 Q6 36 8 46" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M28 24 Q30 36 28 46" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/></svg>`,
};

const HAIR_STYLE_PRESETS = [
  // ── ショート ──
  { id:'h_s01', cat:'ショート', name:'ベリーショート',   icon:'vshort',   vrm:'/assets/vrm/hair/AvatarSample_A.vrm' },
  { id:'h_s02', cat:'ショート', name:'ショートボブ',     icon:'bob',      vrm:'/assets/vrm/hair/AvatarSample_A.vrm' },
  { id:'h_s03', cat:'ショート', name:'ウルフカット',     icon:'layered',  vrm:'/assets/vrm/hair/Vita.vrm' },
  { id:'h_s04', cat:'ショート', name:'ショートレイヤー', icon:'short',    vrm:'/assets/vrm/hair/Sendagaya_Shibu.vrm' },
  { id:'h_s05', cat:'ショート', name:'アシメショート',   icon:'asym',     vrm:'/assets/vrm/hair/AvatarSample_A.vrm' },
  { id:'h_s06', cat:'ショート', name:'ピクシーカット',   icon:'vshort',   vrm:'/assets/vrm/hair/Vivi.vrm' },
  // ── ミディアム ──
  { id:'h_m01', cat:'ミディアム', name:'ミディアムボブ',     icon:'bob',      vrm:'/assets/vrm/hair/AvatarSample_B.vrm' },
  { id:'h_m02', cat:'ミディアム', name:'ナチュラルウェーブ', icon:'wavy',     vrm:'/assets/vrm/hair/AvatarSample_B.vrm' },
  { id:'h_m03', cat:'ミディアム', name:'ストレートミディ',   icon:'medium',   vrm:'/assets/vrm/hair/HairSample_Female.vrm' },
  { id:'h_m04', cat:'ミディアム', name:'レイヤードミディ',   icon:'layered',  vrm:'/assets/vrm/hair/Sakurada_Fumiriya.vrm' },
  { id:'h_m05', cat:'ミディアム', name:'フェミニンミディ',   icon:'feminine', vrm:'/assets/vrm/hair/Sendagaya_Shino.vrm' },
  { id:'h_m06', cat:'ミディアム', name:'ゆるふわミディ',     icon:'medium',   vrm:'/assets/vrm/hair/AvatarSample_B.vrm' },
  // ── ロング ──
  { id:'h_l01', cat:'ロング', name:'ストレートロング', icon:'long',     vrm:'/assets/vrm/hair/AvatarSample_C.vrm' },
  { id:'h_l02', cat:'ロング', name:'ウェーブロング',   icon:'wavy',     vrm:'/assets/vrm/hair/AvatarSample_C.vrm' },
  { id:'h_l03', cat:'ロング', name:'フェミニンロング', icon:'feminine', vrm:'/assets/vrm/hair/Victoria_Rubin.vrm' },
  { id:'h_l04', cat:'ロング', name:'ゴシックロング',   icon:'gothic',   vrm:'/assets/vrm/hair/Darkness_Shibu.vrm' },
  { id:'h_l05', cat:'ロング', name:'レイヤードロング', icon:'layered',  vrm:'/assets/vrm/hair/AvatarSample_C.vrm' },
  { id:'h_l06', cat:'ロング', name:'ナチュラルロング', icon:'long',     vrm:'/assets/vrm/hair/HairSample_Female.vrm' },
  // ── アップスタイル ──
  { id:'h_u01', cat:'アップスタイル', name:'ポニーテール', icon:'ponytail', vrm:'/assets/vrm/hair/Sendagaya_Shino.vrm' },
  { id:'h_u02', cat:'アップスタイル', name:'ツインテール', icon:'twintail', vrm:'/assets/vrm/hair/Vivi.vrm' },
  { id:'h_u03', cat:'アップスタイル', name:'ハーフアップ', icon:'halfup',   vrm:'/assets/vrm/hair/Sendagaya_Shibu.vrm' },
  { id:'h_u04', cat:'アップスタイル', name:'お団子ヘア',   icon:'bun',      vrm:'/assets/vrm/hair/Vita.vrm' },
  { id:'h_u05', cat:'アップスタイル', name:'サイドアップ', icon:'layered',  vrm:'/assets/vrm/hair/Sakurada_Fumiriya.vrm' },
  { id:'h_u06', cat:'アップスタイル', name:'三つ編み',     icon:'braid',    vrm:'/assets/vrm/hair/Victoria_Rubin.vrm' },
  // ── 個性派 ──
  { id:'h_p01', cat:'個性派', name:'ツーブロック',   icon:'asym',     vrm:'/assets/vrm/hair/AvatarSample_A.vrm' },
  { id:'h_p02', cat:'個性派', name:'マッシュルーム', icon:'bob',      vrm:'/assets/vrm/hair/Vivi.vrm' },
  { id:'h_p03', cat:'個性派', name:'ドレッドロング', icon:'gothic',   vrm:'/assets/vrm/hair/Darkness_Shibu.vrm' },
  { id:'h_p04', cat:'個性派', name:'サイドブレイド', icon:'braid',    vrm:'/assets/vrm/hair/AvatarSample_B.vrm' },
  { id:'h_p05', cat:'個性派', name:'ダークウェーブ', icon:'wavy',     vrm:'/assets/vrm/hair/Darkness_Shibu.vrm' },
  { id:'h_p06', cat:'個性派', name:'ロマンティック', icon:'feminine', vrm:'/assets/vrm/hair/Victoria_Rubin.vrm' },
];

// ── Hair part state ───────────────────────────────────────
let _selHairId = null;

// 現在の髪パーツを currentRoot から削除して dispose する
function removeCurrentHairParts() {
  if (!currentRoot) return;
  const parts = currentRoot.userData._hairParts;
  if (!parts || parts.length === 0) return;
  parts.forEach(hairRoot => {
    currentRoot.remove(hairRoot);
    const hairVrm = hairRoot.userData._hairVrm;
    if (hairVrm) {
      VRMUtils.deepDispose(hairVrm.scene);
    } else {
      hairRoot.traverse(obj => {
        obj.geometry?.dispose();
        [].concat(obj.material || []).forEach(m => m?.dispose?.());
      });
    }
  });
  currentRoot.userData._hairParts = [];
}

// 髪型 VRM を読み込んで髪メッシュだけを visible にした root を返す
async function loadHairPart(url) {
  const gltf = await loader.loadAsync(url);
  let root;
  // VRM参照を保存して後で deepDispose できるようにする
  // rotateVRM0 は呼ばない — currentRoot の子として追加するため親の回転を継承する
  const hairVrm = gltf.userData.vrm || null;
  if (hairVrm) {
    root = hairVrm.scene;
  } else {
    root = gltf.scene;
  }

  // 髪メッシュだけ visible、それ以外は hide
  let hasHair = false;
  root.traverse(obj => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    const nm = (obj.name || '').toLowerCase();
    const matHair = [].concat(obj.material || []).some(m => /hair/i.test(m?.name || ''));
    const isHair = nm.includes('hair') || matHair;
    obj.visible = isHair;
    if (isHair) hasHair = true;
  });

  if (!hasHair) {
    // hair 識別不可の場合はモデル全体を髪パーツとして使う
    root.traverse(obj => {
      if (obj.isMesh || obj.isSkinnedMesh) obj.visible = true;
    });
  }

  // currentRoot の子として正しく重なるようローカル変換をリセット
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);

  // VRM参照を保存（removeCurrentHairParts で deepDispose するため）
  root.userData._hairVrm = hairVrm;

  return root;
}

// 髪パーツを currentRoot に追加（頭ボーンが取れる場合も root レベルで attach）
// SkinnedMesh は元骨格に依存するため root 添付が最も安全
function attachHairToHead(hairRoot) {
  if (!currentRoot) return;
  currentRoot.add(hairRoot);
}

// 髪型差し替えエントリポイント
async function replaceHairPart(url, name) {
  if (!currentRoot) {
    setStatus('先にベースモデルを読み込んでください', true);
    return;
  }
  setStatus('髪型を読み込み中...');
  try {
    removeCurrentHairParts();
    const hairRoot = await loadHairPart(url);
    if (!hairRoot) {
      setStatus('髪型の読み込みに失敗しました', true);
      return;
    }
    attachHairToHead(hairRoot);
    if (!currentRoot.userData._hairParts) currentRoot.userData._hairParts = [];
    currentRoot.userData._hairParts.push(hairRoot);
    setStatus('髪型を変更しました: ' + (name || 'Hair'));
    setTimeout(() => setStatus(''), 1500);
    buildAllPanels();
  } catch(e) {
    console.error('[replaceHairPart]', e);
    setStatus('髪型変更エラー: ' + (e?.message || e), true);
  }
}

function _buildHairPresetGrid(body) {
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-size:9px;font-weight:800;color:var(--text2);letter-spacing:.7px;text-transform:uppercase;padding:8px 13px 4px;display:flex;align-items:center;gap:8px;';
  hdr.innerHTML = '<span>髪型プリセット</span>';
  if (_selHairId) {
    const clr = document.createElement('button');
    clr.textContent = '× 外す';
    clr.style.cssText = 'font-size:9px;padding:1px 6px;background:var(--panel2);border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;margin-left:auto;';
    clr.addEventListener('click', () => { removeCurrentHairParts(); _selHairId = null; _buildItemsPanel(); });
    hdr.appendChild(clr);
  }
  body.appendChild(hdr);

  const cats = [...new Set(HAIR_STYLE_PRESETS.map(p => p.cat))];
  cats.forEach(cat => {
    const catHdr = document.createElement('div');
    catHdr.style.cssText = 'font-size:9px;color:var(--text3);padding:4px 13px 2px;font-weight:700;';
    catHdr.textContent = cat;
    body.appendChild(catHdr);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:0 8px 6px;';
    HAIR_STYLE_PRESETS.filter(p => p.cat === cat).forEach(preset => {
      const card = document.createElement('div');
      const isActive = _selHairId === preset.id;
      card.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px;border-radius:6px;cursor:pointer;border:1.5px solid ${isActive ? 'var(--accent)' : 'transparent'};background:${isActive ? 'var(--accent-dim,rgba(224,82,156,0.12))' : 'var(--panel2)'};transition:border-color .15s;`;
      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = `width:40px;height:48px;color:${isActive ? 'var(--accent)' : 'var(--text)'};display:flex;align-items:center;justify-content:center;`;
      iconWrap.innerHTML = _HAIR_PRESET_SVG[preset.icon] || _HAIR_PRESET_SVG.short;
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:9px;text-align:center;color:var(--text2);line-height:1.2;word-break:break-all;';
      lbl.textContent = preset.name;
      card.appendChild(iconWrap);
      card.appendChild(lbl);
      card.addEventListener('click', () => {
        if (_selHairId === preset.id) { removeCurrentHairParts(); _selHairId = null; _buildItemsPanel(); }
        else { _selHairId = preset.id; replaceHairPart(preset.vrm, preset.name); }
      });
      card.addEventListener('mouseenter', () => { if (_selHairId !== preset.id) card.style.borderColor = 'var(--border2)'; });
      card.addEventListener('mouseleave', () => { if (_selHairId !== preset.id) card.style.borderColor = 'transparent'; });
      grid.appendChild(card);
    });
    body.appendChild(grid);
  });

  // 3Dペイント button
  const paintHdr = document.createElement('div');
  paintHdr.style.cssText = 'font-size:9px;font-weight:800;color:var(--text2);letter-spacing:.7px;text-transform:uppercase;padding:10px 13px 4px;border-top:1px solid var(--border);margin-top:4px;';
  paintHdr.textContent = '3D ペイント';
  body.appendChild(paintHdr);
  const paintBtn = document.createElement('button');
  paintBtn.id = 'hair-paint3d-btn';
  paintBtn.textContent = _paint3dActive ? '✕ ペイント終了' : '🎨 3Dペイントモード';
  paintBtn.style.cssText = 'width:calc(100% - 16px);margin:0 8px 6px;padding:7px;background:' + (_paint3dActive ? '#5a1a3a' : 'var(--panel3)') + ';border:1px solid ' + (_paint3dActive ? 'var(--accent)' : 'var(--border2)') + ';border-radius:6px;color:var(--text);font-size:11px;cursor:pointer;font-weight:600;';
  paintBtn.addEventListener('click', () => {
    if (_paint3dActive) _exitPaint3d(); else _enterPaint3d();
  });
  body.appendChild(paintBtn);
}

// ── 3D Paint ─────────────────────────────────────────────────────────
let _paint3dActive   = false;
let _paint3dColor    = '#ff2244';
let _paint3dSize     = 20;
let _paint3dOpacity  = 0.85;
let _paint3dEraser   = false;
let _paint3dPainting = false;
const _paint3dTexMap = new Map(); // material.uuid → { canvas, ctx, tex }
const _paint3dRaycaster = new THREE.Raycaster();
const _paint3dUndoStack  = [];

function _enterPaint3d() {
  if (!currentRoot) { setStatus('モデルを読み込んでください', true); return; }
  _paint3dActive = true;
  _paint3dTexMap.clear();
  _paint3dUndoStack.length = 0;
  _buildPaint3dOverlay();
  canvas.style.cursor = 'crosshair';
  orbitCtrl.enabled = false;
  canvas.addEventListener('pointerdown', _paint3dOnDown);
  canvas.addEventListener('pointermove', _paint3dOnMove);
  canvas.addEventListener('pointerup',   _paint3dOnUp);
  _buildItemsPanel();
  setStatus('🎨 3Dペイントモード — クリック・ドラッグで塗る');
}

function _exitPaint3d() {
  _paint3dActive = false;
  canvas.style.cursor = '';
  orbitCtrl.enabled = true;
  canvas.removeEventListener('pointerdown', _paint3dOnDown);
  canvas.removeEventListener('pointermove', _paint3dOnMove);
  canvas.removeEventListener('pointerup',   _paint3dOnUp);
  const overlay = document.getElementById('paint3d-overlay');
  if (overlay) overlay.remove();
  _buildItemsPanel();
  setStatus('');
}

function _buildPaint3dOverlay() {
  let ov = document.getElementById('paint3d-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'paint3d-overlay';
    ov.style.cssText = 'position:absolute;top:8px;right:8px;z-index:200;background:rgba(15,15,20,.9);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:150px;pointer-events:all;font-size:11px;color:#e8e8ed;';
    document.getElementById('viewport').appendChild(ov);
  }
  ov.innerHTML = '';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:12px;color:#fff;text-align:center;';
  title.textContent = '🎨 3Dペイント';
  ov.appendChild(title);

  // Color + swatches
  const colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const colorPick = document.createElement('input');
  colorPick.type = 'color'; colorPick.value = _paint3dColor;
  colorPick.style.cssText = 'width:32px;height:28px;border:none;background:none;cursor:pointer;border-radius:4px;';
  colorPick.addEventListener('input', e => { _paint3dColor = e.target.value; _paint3dEraser = false; eraserBtn.style.opacity = '1'; });
  colorRow.appendChild(colorPick);
  const swatches = ['#ff2244','#ff8800','#ffd700','#44cc44','#4488ff','#cc44ff','#ffffff','#111111','#ff88cc','#00ddff','#c8a030','#8b4513'];
  const swGrid = document.createElement('div');
  swGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:2px;flex:1;';
  swatches.forEach(c => {
    const sw = document.createElement('div');
    sw.style.cssText = `width:18px;height:18px;border-radius:3px;background:${c};cursor:pointer;border:1px solid rgba(255,255,255,.15);`;
    sw.addEventListener('click', () => { _paint3dColor = c; colorPick.value = c; _paint3dEraser = false; eraserBtn.style.opacity = '1'; });
    swGrid.appendChild(sw);
  });
  colorRow.appendChild(swGrid);
  ov.appendChild(colorRow);

  // Brush / Eraser
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:4px;';
  const brushBtn = document.createElement('button');
  brushBtn.textContent = 'ブラシ';
  brushBtn.style.cssText = 'flex:1;padding:4px;background:#4488ff;border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;';
  brushBtn.addEventListener('click', () => { _paint3dEraser = false; eraserBtn.style.opacity = '1'; brushBtn.style.background = '#4488ff'; });
  const eraserBtn = document.createElement('button');
  eraserBtn.textContent = '消しゴム';
  eraserBtn.style.cssText = 'flex:1;padding:4px;background:var(--panel3,#3a3a3c);border:1px solid var(--border);border-radius:4px;color:#e8e8ed;font-size:10px;cursor:pointer;';
  eraserBtn.addEventListener('click', () => { _paint3dEraser = true; eraserBtn.style.opacity = '.5'; brushBtn.style.background = 'var(--panel3,#3a3a3c)'; });
  modeRow.appendChild(brushBtn); modeRow.appendChild(eraserBtn);
  ov.appendChild(modeRow);

  // Size slider
  const szRow = document.createElement('div');
  szRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;';
  szRow.innerHTML = '<span style="min-width:34px">ブラシ</span>';
  const szSl = document.createElement('input');
  szSl.type = 'range'; szSl.min = 3; szSl.max = 80; szSl.value = _paint3dSize;
  szSl.style.cssText = 'flex:1;';
  const szVal = document.createElement('span');
  szVal.style.cssText = 'min-width:24px;text-align:right;color:#aaa;';
  szVal.textContent = _paint3dSize + 'px';
  szSl.addEventListener('input', () => { _paint3dSize = +szSl.value; szVal.textContent = _paint3dSize + 'px'; });
  szRow.appendChild(szSl); szRow.appendChild(szVal);
  ov.appendChild(szRow);

  // Opacity slider
  const opRow = document.createElement('div');
  opRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;';
  opRow.innerHTML = '<span style="min-width:34px">不透明</span>';
  const opSl = document.createElement('input');
  opSl.type = 'range'; opSl.min = 5; opSl.max = 100; opSl.value = Math.round(_paint3dOpacity * 100);
  opSl.style.cssText = 'flex:1;';
  const opVal = document.createElement('span');
  opVal.style.cssText = 'min-width:24px;text-align:right;color:#aaa;';
  opVal.textContent = Math.round(_paint3dOpacity * 100) + '%';
  opSl.addEventListener('input', () => { _paint3dOpacity = +opSl.value / 100; opVal.textContent = opSl.value + '%'; });
  opRow.appendChild(opSl); opRow.appendChild(opVal);
  ov.appendChild(opRow);

  // Undo + Clear
  const actRow = document.createElement('div');
  actRow.style.cssText = 'display:flex;gap:4px;';
  const undoBtn = document.createElement('button');
  undoBtn.textContent = '↩ 戻す';
  undoBtn.style.cssText = 'flex:1;padding:4px;background:var(--panel3,#3a3a3c);border:1px solid var(--border);border-radius:4px;color:#e8e8ed;font-size:10px;cursor:pointer;';
  undoBtn.addEventListener('click', _paint3dUndo);
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'クリア';
  clearBtn.style.cssText = 'flex:1;padding:4px;background:var(--panel3,#3a3a3c);border:1px solid var(--border);border-radius:4px;color:#e8e8ed;font-size:10px;cursor:pointer;';
  clearBtn.addEventListener('click', _paint3dClearAll);
  actRow.appendChild(undoBtn); actRow.appendChild(clearBtn);
  ov.appendChild(actRow);

  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕ 終了';
  exitBtn.style.cssText = 'width:100%;padding:6px;background:#5a1a3a;border:1px solid var(--accent);border-radius:4px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;';
  exitBtn.addEventListener('click', _exitPaint3d);
  ov.appendChild(exitBtn);
}

function _paint3dGetOrCreateTex(mat) {
  if (_paint3dTexMap.has(mat.uuid)) return _paint3dTexMap.get(mat.uuid);
  const TEX_W = 1024, TEX_H = 1024;
  const cv = document.createElement('canvas');
  cv.width = TEX_W; cv.height = TEX_H;
  const ctx = cv.getContext('2d');
  // copy existing map if available
  const existingMap = mat.map || mat.uniforms?.map?.value;
  if (existingMap?.image) {
    try { ctx.drawImage(existingMap.image, 0, 0, TEX_W, TEX_H); } catch(e) {}
  } else {
    // read current material color
    const col = mat.color || mat.uniforms?.litFactor?.value;
    if (col) {
      ctx.fillStyle = '#' + col.getHexString();
      ctx.fillRect(0, 0, TEX_W, TEX_H);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (mat.uniforms?.map) mat.uniforms.map.value = tex;
  else mat.map = tex;
  mat.needsUpdate = true;
  const entry = { canvas: cv, ctx, tex };
  _paint3dTexMap.set(mat.uuid, entry);
  return entry;
}

function _paint3dDraw(uv) {
  if (!currentRoot) return;
  // save undo snapshot
  const snapshots = [];
  currentRoot.traverse(obj => {
    if (!obj.isMesh) return;
    [].concat(obj.material || []).forEach(mat => {
      const entry = _paint3dTexMap.get(mat.uuid);
      if (entry) snapshots.push({ uuid: mat.uuid, data: entry.ctx.getImageData(0, 0, entry.canvas.width, entry.canvas.height) });
    });
  });
  if (snapshots.length) _paint3dUndoStack.push(snapshots);
  if (_paint3dUndoStack.length > 30) _paint3dUndoStack.shift();

  // find intersected mesh and paint
  _paint3dRaycaster.setFromCamera(uv, camera);
  const meshes = [];
  currentRoot.traverse(o => { if (o.isMesh) meshes.push(o); });
  const hits = _paint3dRaycaster.intersectObjects(meshes, false);
  if (!hits.length || !hits[0].uv) return;

  const hit = hits[0];
  const mat = [].concat(hit.object.material || [])[0];
  if (!mat) return;
  const entry = _paint3dGetOrCreateTex(mat);
  const { canvas: cv, ctx, tex } = entry;
  const px = hit.uv.x * cv.width;
  const py = (1 - hit.uv.y) * cv.height;
  ctx.save();
  if (_paint3dEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = _paint3dOpacity;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = _paint3dOpacity;
    ctx.fillStyle = _paint3dColor;
  }
  ctx.beginPath();
  ctx.arc(px, py, _paint3dSize * (cv.width / 512), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  tex.needsUpdate = true;
}

function _paint3dGetNDC(e) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function _paint3dOnDown(e) { if (!_paint3dActive) return; _paint3dPainting = true; _paint3dDraw(_paint3dGetNDC(e)); }
function _paint3dOnMove(e) { if (!_paint3dActive || !_paint3dPainting) return; _paint3dDraw(_paint3dGetNDC(e)); }
function _paint3dOnUp()    { _paint3dPainting = false; }

function _paint3dUndo() {
  const snaps = _paint3dUndoStack.pop();
  if (!snaps) return;
  snaps.forEach(({ uuid, data }) => {
    const entry = _paint3dTexMap.get(uuid);
    if (entry) { entry.ctx.putImageData(data, 0, 0); entry.tex.needsUpdate = true; }
  });
}

function _paint3dClearAll() {
  _paint3dTexMap.forEach(({ ctx, canvas: cv, tex }) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    tex.needsUpdate = true;
  });
  _paint3dUndoStack.length = 0;
}
