// ── MOD Manager ─────────────────────────────────────────────────────────────
// MODファイルの管理（IndexedDB + localStorage）
// MODタイプ: hair / costume / accessory / stage / general

const IDB_NAME    = 'ai_avatar_moddb';
const IDB_VERSION = 1;
const STORE_MODS  = 'mod_files';

let _db = null;

function _openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_MODS)) {
        db.createObjectStore(STORE_MODS);
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── MODタイプ定義 ─────────────────────────────────────────────────────────────

export const MOD_TYPES = {
  hair:      { label: '髪型',        icon: '✂',  accept: '.vrm,.glb' },
  costume:   { label: '衣装',        icon: '👗', accept: '.vrm,.glb' },
  accessory: { label: 'アクセサリー', icon: '💍', accept: '.vrm,.glb' },
  stage:     { label: 'ステージ',    icon: '🏛', accept: '.glb,.gltf' },
  general:   { label: '汎用',        icon: '📦', accept: '.vrm,.glb,.gltf' },
};

// ── localStorage (メタデータ) ─────────────────────────────────────────────────

const LS_MODS = 'avatar.modList';

function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadModList() {
  try {
    const raw = localStorage.getItem(LS_MODS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function _saveModList(list) {
  localStorage.setItem(LS_MODS, JSON.stringify(list));
}

export function getModsByType(type) {
  return loadModList().filter((m) => m.type === type);
}

export function getEnabledModsByType(type) {
  return loadModList().filter((m) => m.type === type && m.enabled !== false);
}

// ── IndexedDB (バイナリ) ──────────────────────────────────────────────────────

export async function installMod(name, type, arrayBuffer, { sourceFile = '', description = '' } = {}) {
  const db  = await _openDb();
  const id  = 'mod_' + _uid();
  const mod = {
    id,
    name:        name || '新規MOD',
    type:        type || 'general',
    sourceFile,
    description,
    enabled:     true,
    installedAt: Date.now(),
    fileSize:    arrayBuffer.byteLength,
  };

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODS, 'readwrite');
    tx.objectStore(STORE_MODS).put(arrayBuffer, id);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });

  const list = loadModList();
  list.push(mod);
  _saveModList(list);
  return mod;
}

export async function uninstallMod(modId) {
  const db = await _openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODS, 'readwrite');
    tx.objectStore(STORE_MODS).delete(modId);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
  _saveModList(loadModList().filter((m) => m.id !== modId));
}

export function toggleMod(modId, forcedState) {
  const list = loadModList();
  const mod  = list.find((m) => m.id === modId);
  if (!mod) return false;
  mod.enabled = forcedState ?? !mod.enabled;
  _saveModList(list);
  return mod.enabled;
}

export async function loadModArrayBuffer(modId) {
  const db = await _openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_MODS, 'readonly');
    const req = tx.objectStore(STORE_MODS).get(modId);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function createModBlobUrl(modId) {
  const buf = await loadModArrayBuffer(modId);
  if (!buf) return null;
  return URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
}

export function getModMeta(modId) {
  return loadModList().find((m) => m.id === modId) ?? null;
}

export function renameModMeta(modId, newName) {
  const list = loadModList();
  const mod  = list.find((m) => m.id === modId);
  if (mod) { mod.name = newName; _saveModList(list); }
}
