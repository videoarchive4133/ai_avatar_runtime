// ═══════════════════════════════════════════════════════════════
//  VersionMigrationManager
//  - v0 (バージョン未設定) / v1〜v5 のキャラクターデータを移行
//  - シーンデータ / ポーズデータ / 表情データ / プリセットデータ 対応
//  - 診断レポートを生成して UI に渡す
// ═══════════════════════════════════════════════════════════════

export const CURRENT_VERSION = 5;

// ─── デフォルト値定義 ────────────────────────────────────────

const DEFAULTS = {
  body: {},
  hair: { style: null, color: '#2a1a0a' },
  clothes: {},
  hairAcc: null,
  hairShine: { preset: 'normal', roughness: 0.7, metalness: 0.0, envMapIntensity: 0.3 },
  face: {
    eye:       {},
    eyebrow:   {},
    nose:      {},
    mouth:     {},
    faceShape: {},
    ear:       {},
  },
  expression: null,
  pose:       null,
  motion:     null,
  cameraLight: null,
  scene:      null,
  presets:    null,
};

// ─── VersionMigrationManager ─────────────────────────────────

export class VersionMigrationManager {
  constructor() {
    this.logs = [];
  }

  // ── バージョン検出 ─────────────────────────────────────────

  detectVersion(data) {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.version === 'number') return data.version;
    if (typeof data.version === 'string') {
      const n = parseInt(data.version, 10);
      return isNaN(n) ? null : n;
    }
    // バージョン未設定の場合、キーから推定
    return this._estimateVersion(data);
  }

  _estimateVersion(data) {
    if (data.expression != null || data.pose != null || data.motion != null ||
        data.cameraLight != null || data.scene != null || data.presets != null) return 5;
    if (data.face && typeof data.face === 'object' &&
        (data.face.eye != null || data.face.eyebrow != null)) return 4;
    if (data.eye != null && !data.face) return 3;
    if (data.hairAcc != null || data.hairShine != null) return 2;
    if (data.body != null || data.hair != null || data.clothes != null) return 1;
    // ポーズJSONの可能性
    if (data.pose && typeof data.pose === 'object') return 'pose';
    // 表情JSONの可能性
    if (data.name != null && data.snapshot != null) return 'expression';
    // 生ポーズデータ（ボーン名 → { x, y, z }）
    const keys = Object.keys(data);
    if (keys.length > 0 && keys.every(k => {
      const v = data[k];
      return v && typeof v === 'object' && ('x' in v || 'y' in v || 'z' in v);
    })) return 'raw_pose';
    return 0;
  }

  // ── データ種別検出 ─────────────────────────────────────────

  detectType(data) {
    if (!data || typeof data !== 'object') return 'unknown';

    // 明示されたtypeフィールド
    if (data.type) return data.type;

    // ネストされたscene presetっぽいもの
    if (data.model != null && data.camera != null && data.stage != null) return 'scene_preset';
    if (data.scene != null && (data.body != null || data.face != null)) return 'charamake';
    if (data.pose != null && typeof data.pose === 'object' && !data.body) return 'pose';
    if (data.name != null && data.snapshot != null) return 'expression';
    if (data.body != null || data.hair != null || data.clothes != null || data.face != null) return 'charamake';

    // 生ポーズデータ
    const keys = Object.keys(data);
    if (keys.length > 0 && keys.every(k => {
      const v = data[k];
      return v && typeof v === 'object' && ('x' in v || 'y' in v || 'z' in v);
    })) return 'raw_pose';

    if (data.userPresets != null || data.favoriteOverrides != null) return 'preset_store';
    return 'unknown';
  }

  // ── マイグレーション本体 ───────────────────────────────────

  migrate(data) {
    this.logs = [];
    if (!data || typeof data !== 'object') {
      this._log('error', 'データがnullまたはオブジェクトではありません');
      return null;
    }

    const type = this.detectType(data);
    let ver = this.detectVersion(data);
    this._log('info', `データ種別: ${type}`);
    this._log('info', `バージョン検出: ${ver}`);

    // ポーズ/表情/シーン系は別処理
    if (type === 'raw_pose') return this._migrateRawPose(data);
    if (type === 'pose')     return this._migratePoseWrapped(data);
    if (type === 'expression') return this._migrateExpression(data);
    if (type === 'scene_preset') return this._migrateScenePreset(data);
    if (type === 'preset_store') return data; // プリセットストアはそのまま

    // charamake データのマイグレーション
    let d = JSON.parse(JSON.stringify(data));

    if (typeof ver !== 'number' || isNaN(ver)) ver = 0;
    const originalVersion = ver;

    if (ver < 1) { d = this.migrateV0ToV1(d); ver = 1; }
    if (ver < 2) { d = this.migrateV1ToV2(d); ver = 2; }
    if (ver < 3) { d = this.migrateV2ToV3(d); ver = 3; }
    if (ver < 4) { d = this.migrateV3ToV4(d); ver = 4; }
    if (ver < 5) { d = this.migrateV4ToV5(d); ver = 5; }

    d.version = CURRENT_VERSION;
    if (originalVersion !== CURRENT_VERSION) {
      d.migratedFrom = originalVersion;
      d.migratedAt = new Date().toISOString();
    }

    this._log('success', `migration complete: v${originalVersion} → v${CURRENT_VERSION}`);
    return d;
  }

  migrateV0ToV1(d) {
    this._log('info', 'v0→v1: body / hair / clothes の基本構造を補完');
    if (!d.body) d.body = {};
    if (!d.hair) d.hair = {};
    if (!d.clothes) d.clothes = {};
    d.version = 1;
    return d;
  }

  migrateV1ToV2(d) {
    this._log('info', 'v1→v2: hairAcc / hairShine を追加');
    if (d.hairAcc === undefined) {
      d.hairAcc = null;
      this._log('fill', 'missing hairAcc をデフォルト補完 (null)');
    }
    if (d.hairShine === undefined) {
      d.hairShine = { ...DEFAULTS.hairShine };
      this._log('fill', 'missing hairShine をデフォルト補完');
    }
    d.version = 2;
    return d;
  }

  migrateV2ToV3(d) {
    this._log('info', 'v2→v3: eye データ確認');
    // v3では eye が直接ルートにある可能性がある
    // そのまま通す（v4で face.eye に移動する）
    d.version = 3;
    return d;
  }

  migrateV3ToV4(d) {
    this._log('info', 'v3→v4: face 構造化 { eye, eyebrow, nose, mouth, faceShape, ear }');
    if (!d.face || typeof d.face !== 'object') {
      d.face = JSON.parse(JSON.stringify(DEFAULTS.face));
      this._log('fill', 'missing face をデフォルト補完');
    } else {
      const f = d.face;
      if (!f.eye)       { f.eye = {};       this._log('fill', 'missing face.eye をデフォルト補完'); }
      if (!f.eyebrow)   { f.eyebrow = {};   this._log('fill', 'missing face.eyebrow をデフォルト補完'); }
      if (!f.nose)      { f.nose = {};      this._log('fill', 'missing face.nose をデフォルト補完'); }
      if (!f.mouth)     { f.mouth = {};     this._log('fill', 'missing face.mouth をデフォルト補完'); }
      if (!f.faceShape) { f.faceShape = {}; this._log('fill', 'missing face.faceShape をデフォルト補完'); }
      if (!f.ear)       { f.ear = {};       this._log('fill', 'missing face.ear をデフォルト補完'); }
    }
    // ルート直下の eye があれば face.eye に移動
    if (d.eye && typeof d.eye === 'object') {
      this._log('info', 'face.eye へ変換 (旧ルートレベル eye を移行)');
      Object.assign(d.face.eye, d.eye);
      delete d.eye;
    }
    d.version = 4;
    return d;
  }

  migrateV4ToV5(d) {
    this._log('info', 'v4→v5: expression / pose / motion / cameraLight / scene / presets を追加');
    if (d.expression === undefined) {
      d.expression = null;
      this._log('fill', 'missing expression をデフォルト補完 (null)');
    }
    if (d.pose === undefined) {
      d.pose = null;
      this._log('fill', 'missing pose をデフォルト補完 (null)');
    }
    if (d.motion === undefined) {
      d.motion = null;
      this._log('fill', 'missing motion をデフォルト補完 (null)');
    }
    if (d.cameraLight === undefined) {
      d.cameraLight = null;
      this._log('fill', 'missing cameraLight をデフォルト補完 (null)');
    }
    if (d.scene === undefined) {
      d.scene = null;
      this._log('fill', 'missing scene をデフォルト補完 (null)');
    }
    if (d.presets === undefined) {
      d.presets = null;
      this._log('fill', 'missing presets をデフォルト補完 (null)');
    }
    d.version = 5;
    return d;
  }

  // ── ポーズ/表情 系 ─────────────────────────────────────────

  _migrateRawPose(data) {
    this._log('info', '生ポーズデータ検出（バージョンなし）');
    return {
      version: CURRENT_VERSION,
      type: 'pose',
      migratedFrom: 'raw_pose',
      migratedAt: new Date().toISOString(),
      pose: data,
    };
  }

  _migratePoseWrapped(data) {
    this._log('info', 'ポーズJSONを v5 フォーマットへ変換');
    const d = JSON.parse(JSON.stringify(data));
    d.version = CURRENT_VERSION;
    if (d.type === undefined) d.type = 'pose';
    if (!d.migratedAt) d.migratedAt = new Date().toISOString();
    this._log('success', 'migration complete');
    return d;
  }

  _migrateExpression(data) {
    this._log('info', '表情JSONを v5 フォーマットへ変換');
    const d = JSON.parse(JSON.stringify(data));
    d.version = CURRENT_VERSION;
    if (d.type === undefined) d.type = 'expression';
    if (!d.migratedAt) d.migratedAt = new Date().toISOString();
    this._log('success', 'migration complete');
    return d;
  }

  _migrateScenePreset(data) {
    this._log('info', 'シーンプリセットデータ検出');
    const d = JSON.parse(JSON.stringify(data));
    const v = d.version ?? 0;
    // v1 → v2
    if (v < 2) {
      this._log('info', 'scene preset v1→v2: story / extraCharacters / character / items を補完');
      if (!d.story)           { d.story = { mode: false, clips: [], currentIdx: 0 }; this._log('fill', 'missing story をデフォルト補完'); }
      if (!d.extraCharacters) { d.extraCharacters = []; this._log('fill', 'missing extraCharacters をデフォルト補完'); }
      if (!d.character)       { d.character = { activeCharacterId: null, activeCostumeId: null }; this._log('fill', 'missing character をデフォルト補完'); }
      if (!d.items)           { d.items = []; this._log('fill', 'missing items をデフォルト補完'); }
      if (!d.stageModel)      { d.stageModel = { activeId: null }; this._log('fill', 'missing stageModel をデフォルト補完'); }
      if (!d.cameraKeyframes) { d.cameraKeyframes = []; this._log('fill', 'missing cameraKeyframes をデフォルト補完'); }
    }
    d.version = 2;
    d.migratedFrom = v;
    d.migratedAt = new Date().toISOString();
    this._log('success', 'scene preset migration complete');
    return d;
  }

  // ── バリデーション ─────────────────────────────────────────

  validate(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
      errors.push('データがオブジェクトではありません');
      return { valid: false, errors, warnings };
    }

    const type = this.detectType(data);

    // バージョンチェック
    const ver = data.version;
    if (ver == null) {
      warnings.push('version フィールドがありません');
    } else if (typeof ver !== 'number') {
      warnings.push(`version が数値ではありません: ${JSON.stringify(ver)}`);
    } else if (ver < 0 || ver > 100) {
      errors.push(`version の値が異常です: ${ver}`);
    }

    if (type === 'charamake') {
      // body の型チェック
      if (data.body != null && typeof data.body !== 'object') {
        errors.push('body が object ではありません');
      }
      // face の型チェック
      if (data.face != null && typeof data.face !== 'object') {
        errors.push('face が object ではありません');
      }
      // 数値範囲チェック（body スライダー）
      if (data.body && typeof data.body === 'object') {
        for (const [k, v] of Object.entries(data.body)) {
          if (typeof v === 'number' && (v < -10 || v > 10)) {
            warnings.push(`body.${k} の値が範囲外の可能性があります: ${v}`);
          }
        }
      }
      // 壊れたプリセット
      if (data.presets != null) {
        if (!Array.isArray(data.presets) && typeof data.presets !== 'object') {
          errors.push('presets の型が不正です');
        }
      }
    }

    if (type === 'raw_pose') {
      const keys = Object.keys(data);
      const invalidKeys = keys.filter(k => {
        const v = data[k];
        return !v || typeof v !== 'object' ||
          (typeof v.x !== 'number' && typeof v.y !== 'number' && typeof v.z !== 'number');
      });
      if (invalidKeys.length > 0) {
        warnings.push(`ポーズデータに不正なボーン値が含まれます: ${invalidKeys.slice(0, 3).join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ── デフォルト補完 ─────────────────────────────────────────

  fillDefaults(data) {
    if (!data || typeof data !== 'object') return { ...DEFAULTS, version: CURRENT_VERSION };
    const d = JSON.parse(JSON.stringify(data));
    for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
      if (d[key] === undefined) {
        d[key] = JSON.parse(JSON.stringify(defaultVal));
        this._log('fill', `missing ${key} をデフォルト補完`);
      }
    }
    return d;
  }

  // ── メインエントリー: 診断付きインポート ───────────────────

  importWithDiagnostics(rawData) {
    this.logs = [];
    const report = {
      success: false,
      originalVersion: null,
      migratedVersion: null,
      type: 'unknown',
      missing: [],
      filled: [],
      warnings: [],
      errors: [],
      logs: [],
      data: null,
    };

    if (!rawData || typeof rawData !== 'object') {
      report.errors.push('データがオブジェクトではありません');
      report.logs = [...this.logs];
      return report;
    }

    report.originalVersion = this.detectVersion(rawData);
    report.type = this.detectType(rawData);

    // バリデーション (移行前)
    const preVal = this.validate(rawData);
    report.warnings.push(...preVal.warnings);
    if (!preVal.valid) {
      report.errors.push(...preVal.errors);
    }

    // 不足項目チェック
    for (const key of Object.keys(DEFAULTS)) {
      if (rawData[key] === undefined) report.missing.push(key);
    }

    // 致命的エラーがあれば中止
    if (report.errors.length > 0 && report.warnings.length === 0) {
      report.logs = [...this.logs];
      return report;
    }

    // マイグレーション実行
    try {
      const migrated = this.migrate(rawData);
      if (!migrated) {
        report.errors.push('マイグレーションに失敗しました');
        report.logs = [...this.logs];
        return report;
      }

      // 補完された項目を記録
      for (const key of report.missing) {
        if (migrated[key] !== undefined) report.filled.push(key);
      }

      // 移行後バリデーション
      const postVal = this.validate(migrated);
      if (!postVal.valid) {
        report.errors.push(...postVal.errors.map(e => `[移行後] ${e}`));
      }
      report.warnings.push(...postVal.warnings.map(w => `[移行後] ${w}`));

      report.migratedVersion = migrated.version ?? CURRENT_VERSION;
      report.data = migrated;
      report.success = report.errors.length === 0;
    } catch (e) {
      report.errors.push(`マイグレーション例外: ${e.message}`);
    }

    // Fill warnings from logs
    this.logs.filter(l => l.level === 'warn').forEach(l => {
      if (!report.warnings.includes(l.msg)) report.warnings.push(l.msg);
    });

    report.logs = [...this.logs];
    return report;
  }

  // ── 内部ログ ──────────────────────────────────────────────

  _log(level, msg) {
    this.logs.push({ level, msg, ts: Date.now() });
    if (typeof console !== 'undefined') {
      const prefix = '[VersionMigration]';
      if (level === 'error') console.error(prefix, msg);
      else if (level === 'warn') console.warn(prefix, msg);
      else console.log(prefix, msg);
    }
  }
}

// ─── シングルトン ─────────────────────────────────────────────
export const migrationManager = new VersionMigrationManager();
