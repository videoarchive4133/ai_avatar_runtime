// ── characterManager.js ─────────────────────────────────────────────────────
// キャラクター & 衣装の管理。
// - メタデータ (名前・衣装リスト) は localStorage に保存
// - VRM バイナリは IndexedDB に保存 (costumeId をキーとする)

// ── IndexedDB ────────────────────────────────────────────────────────────────

const IDB_NAME = 'ai_avatar_vrmdb';
const IDB_VERSION = 1;
const STORE_VRM = 'vrm_files';

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_VRM)) {
        db.createObjectStore(STORE_VRM);
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => console.warn('[IDB] blocked, another tab may have the DB open');
  });
}

export async function storeVrmFile(costumeId, arrayBuffer) {
  if (!costumeId || !arrayBuffer) throw new Error('costumeIdとarrayBufferが必要です');
  if (arrayBuffer.byteLength > 200 * 1024 * 1024) throw new Error('VRMファイルが大きすぎます (上限200MB)');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VRM, 'readwrite');
    tx.objectStore(STORE_VRM).put(arrayBuffer, costumeId);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function loadVrmArrayBuffer(costumeId) {
  if (!costumeId || typeof costumeId !== 'string') return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VRM, 'readonly');
    const req = tx.objectStore(STORE_VRM).get(costumeId);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteVrmFile(costumeId) {
  if (!costumeId || typeof costumeId !== 'string') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VRM, 'readwrite');
    tx.objectStore(STORE_VRM).delete(costumeId);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function hasVrmFile(costumeId) {
  const buf = await loadVrmArrayBuffer(costumeId);
  return buf != null;
}

export async function createVrmBlobUrl(costumeId) {
  if (!costumeId || typeof costumeId !== 'string') return null;
  const buf = await loadVrmArrayBuffer(costumeId);
  if (!buf) return null;
  try { return URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); }
  catch (e) { console.warn('[char] createVrmBlobUrl failed:', e); return null; }
}

// ── キャラクターリスト (localStorage) ────────────────────────────────────────

const LS_CHARS = 'avatar.characterList';
const LS_ACTIVE = 'avatar.activeCharacterId';

function uid() {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function loadCharacterList() {
  try {
    const raw = localStorage.getItem(LS_CHARS);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

export function saveCharacterList(list) {
  if (!Array.isArray(list)) return;
  try { localStorage.setItem(LS_CHARS, JSON.stringify(list)); }
  catch (e) { console.warn('[char] saveCharacterList quota:', e?.name); }
}

export function countCharacters() { return loadCharacterList().length; }
export function countCostumes(charId) { const ch = getCharacter(charId); return ch?.costumes?.length ?? 0; }
export function hasCharacter(charId) { return Boolean(getCharacter(charId)); }
export function hasCostume(charId, costumeId) { const ch = getCharacter(charId); return Boolean(ch?.costumes?.some((c) => c.id === costumeId)); }

export function getActiveCharacterId() {
  try {
    const id = localStorage.getItem(LS_ACTIVE);
    return id && typeof id === 'string' ? id : null;
  } catch { return null; }
}

export function setActiveCharacterId(id) {
  try {
    if (id == null) localStorage.removeItem(LS_ACTIVE);
    else localStorage.setItem(LS_ACTIVE, String(id));
  } catch { /* ignore */ }
}

// ── 性格タイプ ────────────────────────────────────────────────────────────────

export const PERSONALITY_TYPES = [
  { id: 'cheerful',  label: '天真爛漫', icon: '🌟', desc: '明るく元気！いつでも全力で話しかけてくれる',  affMul: 1.2, excMul: 1.0 },
  { id: 'cool',      label: 'クール',   icon: '❄️', desc: '物静かで落ち着いた性格。でも心の中は熱い',     affMul: 0.9, excMul: 1.3 },
  { id: 'tsundere',  label: 'ツンデレ', icon: '💢', desc: '最初はそっけないが、段々とデレてくる',         affMul: 1.0, excMul: 1.5 },
  { id: 'innocent',  label: '純真',     icon: '🌸', desc: 'ピュアで素直。すぐに顔が赤くなる',            affMul: 1.1, excMul: 1.4 },
  { id: 'spoiled',   label: '甘えん坊', icon: '🐱', desc: 'かまってほしがり。ずっと側にいたい',          affMul: 1.3, excMul: 0.8 },
  { id: 'yandere',   label: 'ヤンデレ', icon: '🔪', desc: '激しく愛情を注いでくる。独占欲強め',          affMul: 0.8, excMul: 2.0 },
];

export function getPersonalityById(id) {
  return PERSONALITY_TYPES.find((p) => p.id === id) ?? PERSONALITY_TYPES[0];
}

export function getCharacter(charId) {
  if (!charId || typeof charId !== 'string') return null;
  return loadCharacterList().find((c) => c.id === charId) ?? null;
}

export function getActiveCostume(charId) {
  const ch = getCharacter(charId);
  if (!ch || !Array.isArray(ch.costumes)) return null;
  return ch.costumes.find((c) => c.id === ch.activeCostumeId) ?? ch.costumes[0] ?? null;
}

export function setCharacterPersonality(charId, personalityId) {
  if (!charId || !personalityId) return;
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (ch) { ch.personality = personalityId; saveCharacterList(list); }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function createCharacter(name, { sourceFile = '', kkCardThumb = null } = {}) {
  const costumeId = 'cs_' + uid();
  const safeName = String(name ?? '').trim().slice(0, 40) || '新規キャラクター';
  const char = {
    id: 'ch_' + uid(),
    name: safeName,
    personality: 'cheerful',
    sourceFile: sourceFile || '',
    activeCostumeId: costumeId,
    costumes: [{ id: costumeId, name: 'デフォルト衣装', createdAt: Date.now() }],
    ...(kkCardThumb ? { kkCardThumb } : {}),
  };
  const list = loadCharacterList();
  list.push(char);
  saveCharacterList(list);
  return char;
}

export function setCharacterKKThumb(charId, thumbDataUrl) {
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (ch) { ch.kkCardThumb = thumbDataUrl; saveCharacterList(list); }
}

export function renameCharacter(charId, newName) {
  if (!charId || !newName) return;
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (ch) {
    const trimmed = String(newName).trim().slice(0, 40);
    ch.name = trimmed || ch.name;
    saveCharacterList(list);
  }
}

/** キャラクターを削除。削除された衣装IDのリストを返す (IDB削除はcallerが行う) */
export function deleteCharacter(charId) {
  if (!charId || typeof charId !== 'string') return [];
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  const costumeIds = (ch?.costumes ?? []).map((cs) => cs.id).filter(Boolean);
  saveCharacterList(list.filter((c) => c.id !== charId));
  return costumeIds;
}

export function addCostume(charId, costumeName) {
  if (!charId) throw new Error('charIdが必要です');
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (!ch) throw new Error('キャラクターが見つかりません');
  const safeName = String(costumeName ?? '').trim().slice(0, 60) || '新しい衣装';
  const cs = { id: 'cs_' + uid(), name: safeName, createdAt: Date.now() };
  ch.costumes.push(cs);
  saveCharacterList(list);
  return cs;
}

export function renameCostume(charId, costumeId, newName) {
  if (!charId || !costumeId || !newName) return;
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  const cs = ch?.costumes.find((c) => c.id === costumeId);
  if (cs) {
    const trimmed = String(newName).trim().slice(0, 60);
    cs.name = trimmed || cs.name;
    saveCharacterList(list);
  }
}

/** 衣装を削除。1着しかなければ削除不可。削除した衣装IDを返す (null = 失敗) */
export function deleteCostume(charId, costumeId) {
  if (!charId || !costumeId) return null;
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (!ch || !ch.costumes || ch.costumes.length <= 1) return null;
  ch.costumes = ch.costumes.filter((c) => c.id !== costumeId);
  if (ch.activeCostumeId === costumeId) {
    ch.activeCostumeId = ch.costumes[0].id;
  }
  saveCharacterList(list);
  return costumeId;
}

export function setActiveCostume(charId, costumeId) {
  if (!charId || !costumeId || typeof charId !== 'string') return;
  const list = loadCharacterList();
  const ch = list.find((c) => c.id === charId);
  if (!ch) { console.warn('[char] setActiveCostume: char not found', charId); return; }
  if (ch.costumes?.some((c) => c.id === costumeId)) {
    ch.activeCostumeId = costumeId;
    saveCharacterList(list);
  } else {
    console.warn('[char] setActiveCostume: costume not found', costumeId);
  }
}

export function getCostume(charId, costumeId) {
  return getCharacter(charId)?.costumes.find((c) => c.id === costumeId) ?? null;
}

// ── アイテム一覧 ──────────────────────────────────────────────────────────────

const LS_ITEMS = 'avatar.itemList';

export function loadItemList() {
  try { const raw = localStorage.getItem(LS_ITEMS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}

export function saveItemList(list) {
  localStorage.setItem(LS_ITEMS, JSON.stringify(list));
}

export const PART_CATEGORIES = ['髪形', '衣装', 'アクセサリー', '体', 'その他'];

export function createItem(name, { category = '', sourceModel = '' } = {}) {
  const item = {
    id: 'item_' + uid(),
    name: name.trim() || '新しいアイテム',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
    category: category || '',
    sourceModel: sourceModel || '',
    createdAt: Date.now(),
  };
  const list = loadItemList();
  list.push(item);
  saveItemList(list);
  return item;
}

export function updateItemTransform(itemId, patch) {
  const list = loadItemList();
  const item = list.find((i) => i.id === itemId);
  if (!item) return;
  if (patch.position !== undefined) item.position = patch.position;
  if (patch.rotation !== undefined) item.rotation = patch.rotation;
  if (patch.scale !== undefined) item.scale = patch.scale;
  if (patch.visible !== undefined) item.visible = patch.visible;
  if (patch.name !== undefined) item.name = patch.name.trim() || item.name;
  if (patch.category !== undefined) item.category = patch.category;
  saveItemList(list);
}

export function deleteItem(itemId) {
  saveItemList(loadItemList().filter((i) => i.id !== itemId));
  return itemId;
}

export async function storeItemFile(itemId, arrayBuffer) {
  return storeVrmFile(itemId, arrayBuffer);
}

export async function createItemBlobUrl(itemId) {
  const buf = await loadVrmArrayBuffer(itemId);
  if (!buf) return null;
  return URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
}

export async function deleteItemFile(itemId) {
  return deleteVrmFile(itemId);
}

// ── ステージモデル ────────────────────────────────────────────────────────────

const LS_STAGE_MODELS = 'avatar.stageModelList';
const LS_ACTIVE_STAGE_MODEL = 'avatar.activeStageModelId';

export function loadStageModelList() {
  try { const raw = localStorage.getItem(LS_STAGE_MODELS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}

export function saveStageModelList(list) {
  localStorage.setItem(LS_STAGE_MODELS, JSON.stringify(list));
}

export function getActiveStageModelId() {
  return localStorage.getItem(LS_ACTIVE_STAGE_MODEL) ?? null;
}

export function setActiveStageModelId(id) {
  if (id == null) localStorage.removeItem(LS_ACTIVE_STAGE_MODEL);
  else localStorage.setItem(LS_ACTIVE_STAGE_MODEL, id);
}

export function createStageModel(name) {
  const model = {
    id: 'stagemdl_' + uid(),
    name: name.trim() || '新しいステージ',
    createdAt: Date.now(),
  };
  const list = loadStageModelList();
  list.push(model);
  saveStageModelList(list);
  return model;
}

export function renameStageModel(id, newName) {
  const list = loadStageModelList();
  const m = list.find((s) => s.id === id);
  if (m) { m.name = newName.trim() || m.name; saveStageModelList(list); }
}

export function deleteStageModel(id) {
  saveStageModelList(loadStageModelList().filter((s) => s.id !== id));
  return id;
}

export async function storeStageModelFile(id, arrayBuffer) {
  return storeVrmFile(id, arrayBuffer);
}

export async function createStageModelBlobUrl(id) {
  const buf = await loadVrmArrayBuffer(id);
  if (!buf) return null;
  return URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
}

export async function deleteStageModelFile(id) {
  return deleteVrmFile(id);
}

// ── BGM管理 ───────────────────────────────────────────────────────────────────

const LS_BGM_LIST = 'avatar.bgmList';

export function loadBgmList() {
  try { const raw = localStorage.getItem(LS_BGM_LIST); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}
export function saveBgmList(list) { localStorage.setItem(LS_BGM_LIST, JSON.stringify(list)); }

export function createBgm(name, mimeType = 'audio/mpeg') {
  const bgm = {
    id: 'bgm_' + uid(),
    name: name.trim() || '新しいBGM',
    mimeType,
    volume: 0.8,
    loop: true,
    createdAt: Date.now(),
  };
  const list = loadBgmList();
  list.push(bgm);
  saveBgmList(list);
  return bgm;
}

export function updateBgm(id, patch) {
  const list = loadBgmList();
  const b = list.find((b) => b.id === id);
  if (!b) return;
  if (patch.name !== undefined) b.name = patch.name.trim() || b.name;
  if (patch.volume !== undefined) b.volume = Number(patch.volume);
  if (patch.loop !== undefined) b.loop = Boolean(patch.loop);
  saveBgmList(list);
}

export function deleteBgm(id) { saveBgmList(loadBgmList().filter((b) => b.id !== id)); return id; }
export async function storeBgmFile(id, arrayBuffer) { return storeVrmFile(id, arrayBuffer); }
export async function createBgmBlobUrl(id, mimeType = 'audio/mpeg') {
  const buf = await loadVrmArrayBuffer(id);
  if (!buf) return null;
  return URL.createObjectURL(new Blob([buf], { type: mimeType }));
}
export async function deleteBgmFile(id) { return deleteVrmFile(id); }

// ── SE（効果音）管理 ──────────────────────────────────────────────────────────

const LS_SE_LIST = 'avatar.seList';

export function loadSeList() {
  try { const raw = localStorage.getItem(LS_SE_LIST); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}
export function saveSeList(list) { localStorage.setItem(LS_SE_LIST, JSON.stringify(list)); }

export function createSe(name, mimeType = 'audio/mpeg') {
  const se = {
    id: 'se_' + uid(),
    name: name.trim() || '新しいSE',
    mimeType,
    volume: 1.0,
    createdAt: Date.now(),
  };
  const list = loadSeList();
  list.push(se);
  saveSeList(list);
  return se;
}

export function updateSe(id, patch) {
  const list = loadSeList();
  const s = list.find((s) => s.id === id);
  if (!s) return;
  if (patch.name !== undefined) s.name = patch.name.trim() || s.name;
  if (patch.volume !== undefined) s.volume = Number(patch.volume);
  saveSeList(list);
}

export function deleteSe(id) { saveSeList(loadSeList().filter((s) => s.id !== id)); return id; }
export async function storeSeFile(id, arrayBuffer) { return storeVrmFile(id, arrayBuffer); }
export async function createSeBlobUrl(id, mimeType = 'audio/mpeg') {
  const buf = await loadVrmArrayBuffer(id);
  if (!buf) return null;
  return URL.createObjectURL(new Blob([buf], { type: mimeType }));
}
export async function deleteSeFile(id) { return deleteVrmFile(id); }

// ── キャラメイク: 体型・カラーパラメータ ──────────────────────────────────────

const LS_CM_BODY_PREFIX  = 'avatar.charaMake.body.';
const LS_CM_COLOR_PREFIX = 'avatar.charaMake.color.';
const LS_CM_VOICE_PREFIX = 'avatar.charaMake.voice.';

export const DEFAULT_BODY_PARAMS = {
  heightScale: 1.0, headScale: 1.0, chestWidth: 1.0,
  hipWidth: 1.0, upperBodyScale: 1.0, legLength: 1.0, armLength: 1.0,
  // 顔スカルプ
  faceWidth: 1.0, jawScale: 1.0,
};

export const BODY_PRESETS = {
  standard: { heightScale: 1.0,  headScale: 1.0,  chestWidth: 1.0,  hipWidth: 1.0,  upperBodyScale: 1.0,  legLength: 1.0,  armLength: 1.0,  faceWidth: 1.0,  jawScale: 1.0 },
  slim:     { heightScale: 1.0,  headScale: 0.93, chestWidth: 0.82, hipWidth: 0.82, upperBodyScale: 0.97, legLength: 1.03, armLength: 0.97, faceWidth: 0.93, jawScale: 0.92 },
  athletic: { heightScale: 1.04, headScale: 0.9,  chestWidth: 1.22, hipWidth: 1.05, upperBodyScale: 1.03, legLength: 1.05, armLength: 1.04, faceWidth: 1.02, jawScale: 1.0 },
  chubby:   { heightScale: 0.96, headScale: 1.02, chestWidth: 1.28, hipWidth: 1.24, upperBodyScale: 1.0,  legLength: 0.96, armLength: 1.08, faceWidth: 1.08, jawScale: 1.05 },
  chibi:    { heightScale: 0.68, headScale: 1.38, chestWidth: 0.88, hipWidth: 0.88, upperBodyScale: 0.82, legLength: 0.72, armLength: 0.82, faceWidth: 1.1,  jawScale: 0.85 },
  tall:     { heightScale: 1.22, headScale: 0.88, chestWidth: 0.92, hipWidth: 0.9,  upperBodyScale: 1.06, legLength: 1.22, armLength: 1.12, faceWidth: 0.9,  jawScale: 1.05 },
  petite:   { heightScale: 0.88, headScale: 1.06, chestWidth: 0.88, hipWidth: 0.90, upperBodyScale: 0.94, legLength: 0.88, armLength: 0.90, faceWidth: 0.96, jawScale: 0.88 },
  curvy:    { heightScale: 0.97, headScale: 0.97, chestWidth: 1.18, hipWidth: 1.32, upperBodyScale: 0.98, legLength: 0.98, armLength: 1.0,  faceWidth: 1.02, jawScale: 0.95 },
  muscular: { heightScale: 1.06, headScale: 0.92, chestWidth: 1.40, hipWidth: 1.12, upperBodyScale: 1.05, legLength: 1.06, armLength: 1.10, faceWidth: 1.05, jawScale: 1.08 },
  elfin:    { heightScale: 1.08, headScale: 0.86, chestWidth: 0.78, hipWidth: 0.78, upperBodyScale: 1.0,  legLength: 1.14, armLength: 1.08, faceWidth: 0.84, jawScale: 0.80 },
};

export const DEFAULT_VOICE_PARAMS = {
  engine: 'browser',
  vvSpeakerId: 1,
  sbModel: 0, sbSpeaker: 0,
  browserPitch: 1.0,
  speed: 1.0,
  speakerName: '',
};

export function loadVoiceParams(costumeId) {
  if (!costumeId) return { ...DEFAULT_VOICE_PARAMS };
  try {
    const raw = localStorage.getItem(LS_CM_VOICE_PREFIX + costumeId);
    if (raw) return { ...DEFAULT_VOICE_PARAMS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VOICE_PARAMS };
}

export function saveVoiceParams(costumeId, params) {
  if (!costumeId) return;
  localStorage.setItem(LS_CM_VOICE_PREFIX + costumeId, JSON.stringify(params));
}

export function loadBodyParams(costumeId) {
  if (!costumeId) return { ...DEFAULT_BODY_PARAMS };
  try {
    const raw = localStorage.getItem(LS_CM_BODY_PREFIX + costumeId);
    if (raw) return { ...DEFAULT_BODY_PARAMS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_BODY_PARAMS };
}

export function saveBodyParams(costumeId, params) {
  if (!costumeId) return;
  localStorage.setItem(LS_CM_BODY_PREFIX + costumeId, JSON.stringify(params));
}

export function loadColorOverrides(costumeId) {
  if (!costumeId) return {};
  try {
    const raw = localStorage.getItem(LS_CM_COLOR_PREFIX + costumeId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

export function saveColorOverrides(costumeId, overrides) {
  if (!costumeId) return;
  localStorage.setItem(LS_CM_COLOR_PREFIX + costumeId, JSON.stringify(overrides));
}

// ── 着せ替えスロット ──────────────────────────────────────────────────────────
// equippedParts: { [category: string]: itemId | null }

const LS_EQUIPPED = 'avatar.equippedParts';

export function loadEquippedParts() {
  try { const raw = localStorage.getItem(LS_EQUIPPED); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return {};
}

export function saveEquippedParts(map) {
  localStorage.setItem(LS_EQUIPPED, JSON.stringify(map));
}

export function equipPart(category, itemId) {
  if (!category) return;
  const map = loadEquippedParts();
  map[category] = itemId;
  saveEquippedParts(map);
}

export function unequipPart(category) {
  const map = loadEquippedParts();
  delete map[category];
  saveEquippedParts(map);
}

// ── コーデセット ──────────────────────────────────────────────────────────────

const LS_OUTFIT_SETS = 'avatar.outfitSets';

export function loadOutfitSets() {
  try { const raw = localStorage.getItem(LS_OUTFIT_SETS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return [];
}

export function saveOutfitSets(list) {
  localStorage.setItem(LS_OUTFIT_SETS, JSON.stringify(list));
}

export function createOutfitSet(name, parts) {
  const set = { id: 'outfit_' + uid(), name: name.trim() || 'コーデ', parts: { ...parts }, createdAt: Date.now() };
  const list = loadOutfitSets();
  list.unshift(set);
  saveOutfitSets(list);
  return set;
}

export function deleteOutfitSet(id) {
  saveOutfitSets(loadOutfitSets().filter((s) => s.id !== id));
}
