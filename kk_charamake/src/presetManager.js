// ═══════════════════════════════════════════════════════════════
//  キャラクタープリセット管理
//  - ビルトインプリセット (読取専用, builtin:true)
//  - ユーザープリセット   (localStorage 永続化)
//  - ストレージ抽象化: LocalStorageAdapter (将来 FileAdapter に差替可能)
// ═══════════════════════════════════════════════════════════════

// ─── ストレージアダプター ──────────────────────────────────────

class LocalStorageAdapter {
  constructor(key) { this._key = key; }

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  save(data) {
    try { localStorage.setItem(this._key, JSON.stringify(data)); return true; }
    catch (_) { return false; }
  }
}

// 将来の拡張用スタブ（Tauri fs API 等に差替予定）
// export class FileAdapter { ... }

// ─── 組み込みプリセット定義 ───────────────────────────────────

const _NOW = '2026-06-26T00:00:00.000Z';

function _buildPreset(id, name, tags, bodyState, hairColor, cameraPreset, exprPreset, lightPreset) {
  return {
    id,
    name,
    tags,
    favorite: false,
    builtin:  true,
    createdAt: _NOW,
    updatedAt: _NOW,
    thumbnail: null,
    data: {
      name,
      state: bodyState,
      hairAcc: null,
      hairShine: {
        preset: 'normal',
        roughness: 0.70,
        metalness: 0.00,
        envMapIntensity: 0.30,
        ...(hairColor ? { _hairColor: hairColor } : {}),
      },
      face: {},
      expression: exprPreset ? { preset: exprPreset, weights: {} } : null,
      pose: null,
      motion: null,
      cameraLight: cameraPreset ? {
        camera: { position:[0,0.9,2.6], target:[0,0.85,0], fov:35, zoom:1 },
        light:  lightPreset ?? { mainIntensity:1.4, mainAngle:0, subIntensity:0.5, rimIntensity:0.35, ambient:0.7, shadow:true, shadowDark:0.5 },
        background: { color:'#0a0c14', gradient:false, floor:true, grid:false },
      } : null,
      scene: null,
    },
  };
}

export const BUILTIN_PRESETS = [
  _buildPreset(
    'builtin_standard', '標準', ['デフォルト', '標準'],
    {},
    '#5c3010',
    true,
    null,
    null,
  ),
  _buildPreset(
    'builtin_uniform', '制服', ['制服', '学生', '青春'],
    { bust: 0.1, waist: -0.05 },
    '#1a0a00',
    true,
    'smile',
    { mainIntensity:1.6, mainAngle:20, subIntensity:0.6, rimIntensity:0.4, ambient:0.8, shadow:true, shadowDark:0.4 },
  ),
  _buildPreset(
    'builtin_maid', 'メイド', ['メイド', '可愛い', 'クラシック'],
    { bust: 0.2, waist: -0.1, hips: 0.1 },
    '#f5e6c8',
    true,
    'smile',
    { mainIntensity:1.5, mainAngle:15, subIntensity:0.7, rimIntensity:0.5, ambient:0.8, shadow:true, shadowDark:0.3 },
  ),
  _buildPreset(
    'builtin_idol', 'アイドル', ['アイドル', '元気', 'ポップ'],
    { bust: 0.15, waist: -0.1, head_size: 0.1 },
    '#ffd700',
    true,
    'happy',
    { mainIntensity:2.0, mainAngle:30, subIntensity:0.8, rimIntensity:0.6, ambient:1.0, shadow:true, shadowDark:0.2 },
  ),
  _buildPreset(
    'builtin_mahou', '魔法少女', ['魔法少女', 'ファンタジー', '可愛い'],
    { bust: 0.1, waist: -0.15, head_size: 0.15 },
    '#ff1493',
    true,
    'smile',
    { mainIntensity:1.6, mainAngle:-30, subIntensity:0.6, rimIntensity:0.8, ambient:0.9, shadow:false, shadowDark:0.2 },
  ),
  _buildPreset(
    'builtin_gothic', 'ゴシック', ['ゴシック', 'ダーク', 'ロリータ'],
    { bust: 0.1, waist: -0.05 },
    '#000000',
    true,
    'cool',
    { mainIntensity:0.9, mainAngle:160, subIntensity:0.3, rimIntensity:0.6, ambient:0.35, shadow:true, shadowDark:0.8 },
  ),
  _buildPreset(
    'builtin_japanese', '和風', ['和風', '着物', 'きれい'],
    { bust: 0.05, waist: 0.0 },
    '#3d2000',
    true,
    null,
    { mainIntensity:1.3, mainAngle:60, subIntensity:0.4, rimIntensity:0.3, ambient:0.65, shadow:true, shadowDark:0.5 },
  ),
  _buildPreset(
    'builtin_sporty', 'スポーティ', ['スポーツ', '活発', '健康的'],
    { bust: 0.0, waist: -0.2, hips: -0.1, leg_thick: -0.1 },
    '#c4956a',
    true,
    'happy',
    { mainIntensity:1.8, mainAngle:45, subIntensity:0.5, rimIntensity:0.3, ambient:0.9, shadow:true, shadowDark:0.3 },
  ),
  _buildPreset(
    'builtin_casual', 'カジュアル', ['カジュアル', '普段着', 'ナチュラル'],
    { bust: 0.05, waist: -0.05 },
    '#8b5e3c',
    true,
    null,
    { mainIntensity:1.5, mainAngle:20, subIntensity:0.5, rimIntensity:0.3, ambient:0.75, shadow:true, shadowDark:0.4 },
  ),
  _buildPreset(
    'builtin_fantasy', 'ファンタジー', ['ファンタジー', '異世界', '魔法'],
    { bust: 0.1, waist: -0.1, head_size: 0.1 },
    '#4b0082',
    true,
    null,
    { mainIntensity:1.2, mainAngle:-20, subIntensity:0.4, rimIntensity:1.0, ambient:0.5, shadow:true, shadowDark:0.6 },
  ),
];

// ─── PresetManager ────────────────────────────────────────────

let _counter = 0;

export class PresetManager {
  constructor(storageKey = 'kk_charamake_presets') {
    this._adapter      = new LocalStorageAdapter(storageKey);
    this._userPresets  = [];   // ユーザー作成プリセット
    this._loadFromStorage();
  }

  // ── 保存・読込 ──────────────────────────────────────────────

  savePreset(name, snapshot) {
    _counter++;
    const now = new Date().toISOString();
    const preset = {
      id:        `preset_${String(_counter).padStart(3, '0')}_${Date.now()}`,
      name:      name || '無名プリセット',
      tags:      [],
      favorite:  false,
      builtin:   false,
      createdAt: now,
      updatedAt: now,
      thumbnail: null,
      data:      JSON.parse(JSON.stringify(snapshot)),
    };
    this._userPresets.push(preset);
    this._saveToStorage();
    return preset.id;
  }

  loadPreset(id) {
    const preset = this._findAny(id);
    return preset ? JSON.parse(JSON.stringify(preset.data)) : null;
  }

  deletePreset(id) {
    const preset = this._findUser(id);
    if (!preset) return false;  // ビルトインは削除不可
    this._userPresets = this._userPresets.filter(p => p.id !== id);
    this._saveToStorage();
    return true;
  }

  duplicatePreset(id) {
    const src = this._findAny(id);
    if (!src) return null;
    _counter++;
    const now = new Date().toISOString();
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id:        `preset_${String(_counter).padStart(3, '0')}_${Date.now()}`,
      name:      src.name + ' (コピー)',
      builtin:   false,
      createdAt: now,
      updatedAt: now,
    };
    this._userPresets.push(copy);
    this._saveToStorage();
    return copy.id;
  }

  renamePreset(id, name) {
    const preset = this._findUser(id);
    if (!preset) return false;
    preset.name = name;
    preset.updatedAt = new Date().toISOString();
    this._saveToStorage();
    return true;
  }

  toggleFavorite(id) {
    const preset = this._findAny(id);
    if (!preset) return false;
    if (preset.builtin) {
      // ビルトインのお気に入りはユーザープリセットのオーバーライドで管理
      const override = this._findOrCreateOverride(id);
      override.favorite = !override.favorite;
    } else {
      preset.favorite = !preset.favorite;
    }
    this._saveToStorage();
    return true;
  }

  setTags(id, tags) {
    const preset = this._findUser(id);
    if (!preset) return false;
    preset.tags = Array.isArray(tags) ? [...tags] : [];
    preset.updatedAt = new Date().toISOString();
    this._saveToStorage();
    return true;
  }

  listPresets() {
    // ビルトイン + ユーザープリセット を合成・ソート
    const builtins = BUILTIN_PRESETS.map(p => {
      const over = this._favoriteOverrides[p.id];
      return over ? { ...p, favorite: over.favorite } : p;
    });
    const all = [...this._userPresets, ...builtins];
    // お気に入り優先、次に updatedAt 降順
    return all.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  // ── シリアライズ（エクスポート/インポート用） ──────────────

  serialize() {
    return {
      userPresets:      JSON.parse(JSON.stringify(this._userPresets)),
      favoriteOverrides: { ...this._favoriteOverrides },
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.userPresets)) {
      this._userPresets = data.userPresets;
      for (const p of this._userPresets) {
        const num = parseInt((p.id || '').split('_')[1], 10);
        if (!isNaN(num) && num > _counter) _counter = num;
      }
    }
    if (data.favoriteOverrides && typeof data.favoriteOverrides === 'object') {
      this._favoriteOverrides = data.favoriteOverrides;
    }
    this._saveToStorage();
  }

  // ── 内部 ──────────────────────────────────────────────────

  _loadFromStorage() {
    this._favoriteOverrides = {};  // id → { favorite: bool }
    const saved = this._adapter.load();
    if (!saved) return;
    if (Array.isArray(saved.userPresets)) {
      this._userPresets = saved.userPresets;
      for (const p of this._userPresets) {
        const num = parseInt((p.id || '').split('_')[1], 10);
        if (!isNaN(num) && num > _counter) _counter = num;
      }
    }
    if (saved.favoriteOverrides && typeof saved.favoriteOverrides === 'object') {
      this._favoriteOverrides = saved.favoriteOverrides;
    }
  }

  _saveToStorage() {
    this._adapter.save({
      userPresets:      this._userPresets,
      favoriteOverrides: this._favoriteOverrides,
    });
  }

  _findAny(id) {
    return this._userPresets.find(p => p.id === id)
        || BUILTIN_PRESETS.find(p => p.id === id)
        || null;
  }

  _findUser(id) {
    return this._userPresets.find(p => p.id === id) ?? null;
  }

  _findOrCreateOverride(id) {
    if (!this._favoriteOverrides[id]) this._favoriteOverrides[id] = { favorite: false };
    return this._favoriteOverrides[id];
  }
}
