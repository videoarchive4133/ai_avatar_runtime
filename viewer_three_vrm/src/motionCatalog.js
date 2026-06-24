const MOTION_ASSET_BASE = '/assets/motions_vrma';

export const DEFAULT_BODY_MOTION_URL = `${MOTION_ASSET_BASE}/idle/idle.vrma`;

export const MOTION_CATEGORY_LABELS = {
  idle:       '待機',
  walk:       '歩き',
  run:        '走り / ジョグ',
  gesture:    'ジェスチャー',
  talk:       'トーク',
  dance:      'ダンス',
  debug:      'デバッグ',
};

export const MOTION_LIBRARY = [
  // ── idle ────────────────────────────────────────────────
  {
    id: 'idle',
    label: 'idle',
    displayName: '待機（標準）',
    description: '自然な直立待機。女性的な重心移動あり。',
    category: 'idle',
    tags: ['idle', 'calm', 'default'],
    url: `${MOTION_ASSET_BASE}/idle/idle.vrma`,
    favorite: true,
  },
  {
    id: 'thinking',
    label: 'thinking',
    displayName: '考え中',
    description: '顎に手を当てて考えるポーズ。',
    category: 'idle',
    tags: ['idle', 'thinking', 'pose'],
    url: `${MOTION_ASSET_BASE}/idle/thinking.vrma`,
  },
  {
    id: 'idle_casual_f_001',
    label: 'idle_casual_f_001',
    displayName: 'カジュアル待機（女性）',
    description: '少しリラックスした立ち姿。女性向け。',
    category: 'idle',
    tags: ['idle', 'casual', 'feminine'],
    url: `${MOTION_ASSET_BASE}/idle/idle_casual_f_001.vrma`,
  },

  // ── walk ────────────────────────────────────────────────
  {
    id: 'walk',
    label: 'walk',
    displayName: '歩き（標準）',
    description: '標準ウォーク。CMU mocap ベース。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'loop', 'cmu'],
    url: `${MOTION_ASSET_BASE}/walk/walk.vrma`,
    favorite: true,
  },
  {
    id: 'walk_f_001',
    label: 'walk_f_001',
    displayName: '歩き（女性）',
    description: '女性向けウォーク。RPM アニメーションライブラリ。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'feminine'],
    url: `${MOTION_ASSET_BASE}/walk/walk_f_001.vrma`,
  },
  {
    id: 'walk_m_001',
    label: 'walk_m_001',
    displayName: '歩き（男性）001',
    description: '男性向けウォーク その1。RPM アニメーションライブラリ。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'masculine'],
    url: `${MOTION_ASSET_BASE}/walk/walk_m_001.vrma`,
  },
  {
    id: 'walk_m_002',
    label: 'walk_m_002',
    displayName: '歩き（男性）002',
    description: '男性向けウォーク その2。やや力強い歩き。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'masculine'],
    url: `${MOTION_ASSET_BASE}/walk/walk_m_002.vrma`,
  },
  {
    id: 'walk_fem_m_001',
    label: 'walk_fem_m_001',
    displayName: '歩き・女性的（男性ソース）001',
    description: '男性ソースを女性的に調整したウォーク その1。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'feminine', 'male-source'],
    url: `${MOTION_ASSET_BASE}/walk/walk_fem_m_001.vrma`,
  },
  {
    id: 'walk_fem_m_002',
    label: 'walk_fem_m_002',
    displayName: '歩き・女性的（男性ソース）002',
    description: '男性ソースを女性的に調整したウォーク その2。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'feminine', 'male-source'],
    url: `${MOTION_ASSET_BASE}/walk/walk_fem_m_002.vrma`,
  },
  {
    id: 'walk_fem_f_002',
    label: 'walk_fem_f_002',
    displayName: '歩き・女性的（女性ソース）002',
    description: '女性ソース、女性的なウォーク。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'feminine'],
    url: `${MOTION_ASSET_BASE}/walk/walk_fem_f_002.vrma`,
  },
  {
    id: 'walk_cmu_69_01',
    label: 'walk_cmu_69_01',
    displayName: 'CMU 歩き 69-01',
    description: 'CMU mocap Subject 69 ウォーク その1。やや速め。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'cmu'],
    url: `${MOTION_ASSET_BASE}/walk/cmu_walk_69_01.vrma`,
  },
  {
    id: 'walk_cmu_69_02',
    label: 'walk_cmu_69_02',
    displayName: 'CMU 歩き 69-02',
    description: 'CMU mocap Subject 69 ウォーク その2。',
    category: 'walk',
    tags: ['walk', 'locomotion', 'cmu'],
    url: `${MOTION_ASSET_BASE}/walk/cmu_walk_69_02.vrma`,
  },

  // ── run ────────────────────────────────────────────────
  {
    id: 'jog_f_001',
    label: 'jog_f_001',
    displayName: 'ジョグ（女性）',
    description: '軽いジョギング。女性向け。RPM アニメーションライブラリ。',
    category: 'run',
    tags: ['run', 'jog', 'locomotion', 'loop', 'feminine'],
    url: `${MOTION_ASSET_BASE}/run/jog_f_001.vrma`,
    favorite: true,
  },
  {
    id: 'jog_m_001',
    label: 'jog_m_001',
    displayName: 'ジョグ（男性）',
    description: '軽いジョギング。男性向け。RPM アニメーションライブラリ。',
    category: 'run',
    tags: ['run', 'jog', 'locomotion', 'loop', 'masculine'],
    url: `${MOTION_ASSET_BASE}/run/jog_m_001.vrma`,
  },
  {
    id: 'run_f_001',
    label: 'run_f_001',
    displayName: '走り（女性）',
    description: '全力ランニング。女性向け。RPM アニメーションライブラリ。',
    category: 'run',
    tags: ['run', 'locomotion', 'loop', 'feminine'],
    url: `${MOTION_ASSET_BASE}/run/run_f_001.vrma`,
  },

  // ── gesture ─────────────────────────────────────────────
  {
    id: 'wave',
    label: 'wave',
    displayName: '手振り',
    description: '手を振って挨拶するジェスチャー。',
    category: 'gesture',
    tags: ['gesture', 'wave', 'greeting'],
    url: `${MOTION_ASSET_BASE}/gesture/wave.vrma`,
    favorite: true,
  },
  {
    id: 'happy',
    label: 'happy',
    displayName: '喜び',
    description: '嬉しそうに体を動かす喜びの表現。',
    category: 'gesture',
    tags: ['gesture', 'happy', 'emotion', 'greeting'],
    url: `${MOTION_ASSET_BASE}/gesture/happy.vrma`,
    favorite: true,
  },
  {
    id: 'expression_m_001',
    label: 'expression_m_001',
    displayName: '表情豊かな動き（男性）001',
    description: '男性向けスタンディングエクスプレッション。RPM アニメーションライブラリ。',
    category: 'gesture',
    tags: ['gesture', 'expression', 'masculine'],
    url: `${MOTION_ASSET_BASE}/gesture/expression_m_001.vrma`,
  },

  // ── talk ────────────────────────────────────────────────
  {
    id: 'talk',
    label: 'talk',
    displayName: 'トーク（標準）',
    description: '標準トーキングアニメーション。ループ再生用。',
    category: 'talk',
    tags: ['talk', 'speech', 'loop'],
    url: `${MOTION_ASSET_BASE}/talk/talk.vrma`,
    favorite: true,
  },
  {
    id: 'talk_f_001',
    label: 'talk_f_001',
    displayName: 'トーク（女性）',
    description: '女性向けトーク。手振りあり。RPM アニメーションライブラリ。',
    category: 'talk',
    tags: ['talk', 'speech', 'feminine'],
    url: `${MOTION_ASSET_BASE}/talk/talk_f_001.vrma`,
  },
  {
    id: 'talk_m_001',
    label: 'talk_m_001',
    displayName: 'トーク（男性）',
    description: '男性向けトーク。手振りあり。RPM アニメーションライブラリ。',
    category: 'talk',
    tags: ['talk', 'speech', 'masculine'],
    url: `${MOTION_ASSET_BASE}/talk/talk_m_001.vrma`,
  },

  // ── dance ────────────────────────────────────────────────
  {
    id: 'dance_f_004',
    label: 'dance_f_004',
    displayName: 'ダンス 004（女性）',
    description: '女性向けダンス その4。RPM アニメーションライブラリ。',
    category: 'dance',
    tags: ['dance', 'feminine'],
    url: `${MOTION_ASSET_BASE}/dance/dance_f_004.vrma`,
  },
  {
    id: 'dance_m_001',
    label: 'dance_m_001',
    displayName: 'ダンス 001（男性）',
    description: '男性向けダンス その1。RPM アニメーションライブラリ。',
    category: 'dance',
    tags: ['dance', 'masculine'],
    url: `${MOTION_ASSET_BASE}/dance/dance_m_001.vrma`,
    favorite: true,
  },

  // ── sit (椅子座りモーション・プロップ連動サンプル) ────────────────
  // prop フィールドの書き方:
  //   model    : /assets/props/ 以下の GLB ファイル名
  //   position : [x, y, z]  世界座標 (メートル)
  //   rotation : [x, y, z]  オイラー角 (度)
  //   scale    : [x, y, z]  スケール倍率 (省略時 [1,1,1])
  //
  // 例 (GLBを /assets/props/chair_01.glb に置いた場合):
  // {
  //   id: 'sit_chair',
  //   label: 'sit_chair',
  //   displayName: '椅子に座る',
  //   description: '椅子に腰かけるモーション。椅子プロップが自動表示されます。',
  //   category: 'idle',
  //   tags: ['idle', 'sit', 'chair'],
  //   url: `${MOTION_ASSET_BASE}/idle/sit_chair.vrma`,
  //   prop: {
  //     model: 'chair_01.glb',
  //     position: [0, 0, -0.35],
  //     rotation: [0, 180, 0],
  //     scale: [1, 1, 1],
  //   },
  // },

  // ── debug (非表示カテゴリ) ────────────────────────────────
  {
    id: 'walk_bad_foot',
    label: 'walk_bad_foot',
    displayName: '[デバッグ] 歩き・足首バグ',
    description: '足首バグ確認用。足の向きが意図的に壊れている。',
    category: 'debug',
    tags: ['debug'],
    url: `${MOTION_ASSET_BASE}/debug/walk_bad_foot.vrma`,
  },
  {
    id: 'walk_fixed',
    label: 'walk_fixed',
    displayName: '[デバッグ] 歩き・補正済み',
    description: '足首補正テスト用。',
    category: 'debug',
    tags: ['debug'],
    url: `${MOTION_ASSET_BASE}/debug/walk_fixed.vrma`,
  },
  {
    id: 'walk_rpm_legacy',
    label: 'walk_rpm_legacy',
    displayName: '[デバッグ] 歩き・旧RPM',
    description: '旧RPMパイプライン出力。比較用。',
    category: 'debug',
    tags: ['debug'],
    url: `${MOTION_ASSET_BASE}/debug/walk_rpm_legacy.vrma`,
  },
];

export const DEFAULT_MOTION_OPTIONS = MOTION_LIBRARY.map((motion) => ({
  label: motion.label,
  url: motion.url,
}));

export const MOTION_NAME_TO_URL = new Map(MOTION_LIBRARY.map((motion) => [motion.label, motion.url]));
// 大文字小文字非依存のルックアップ用（LLMからの表記ゆれ対応）
export const MOTION_NAME_TO_URL_LC = new Map(MOTION_LIBRARY.map((motion) => [motion.label.toLowerCase(), motion.url]));
export const MOTION_URL_TO_ENTRY = new Map(MOTION_LIBRARY.map((motion) => [motion.url, motion]));
export const MOTION_TAGS = [...new Set(MOTION_LIBRARY.flatMap((motion) => motion.tags ?? []))].sort();
