// KoiKatsu アイテムリスト (抽出済みデータ)
// thumbABから実際のサムネイルファイル名を使用

export const CATEGORIES = {
  body: {
    label: '体型',
    subs: [
      { key: 'body_shape', label: '体型', type: 'slider' },
      { key: 'height', label: '身長', type: 'slider' },
      { key: 'breast', label: '胸', type: 'slider' },
    ]
  },
  face: {
    label: '顔',
    subs: [
      { key: 'head', label: '輪郭', type: 'thumb', thumbPrefix: 'bo_head_' },
      { key: 'eyebrow', label: '眉', type: 'thumb', thumbPrefix: 'cf_eyebrow_' },
      { key: 'eye', label: '目', type: 'thumb', thumbPrefix: 'cf_eye_' },
      { key: 'eyeline', label: 'アイライン', type: 'thumb', thumbPrefix: 'cf_eyeline_' },
      { key: 'noseline', label: '鼻', type: 'thumb', thumbPrefix: 'cf_nose_' },
      { key: 'mole', label: 'ほくろ', type: 'thumb', thumbPrefix: 'mole_' },
      { key: 'makeup', label: 'メイク', type: 'thumb', thumbPrefix: 'mt_face_paint_' },
    ]
  },
  hair: {
    label: '髪型',
    subs: [
      { key: 'hair_front', label: '前髪', type: 'thumb', thumbPrefix: 'p_cf_hair_f_' },
      { key: 'hair_back', label: '後ろ髪', type: 'thumb', thumbPrefix: 'p_cf_hair_b_' },
      { key: 'hair_side', label: '横髪', type: 'thumb', thumbPrefix: 'p_cf_hair_s_' },
      { key: 'hair_other', label: 'エクステ', type: 'thumb', thumbPrefix: 'p_cf_hair_o_' },
    ]
  },
  clothes: {
    label: '服装',
    subs: [
      { key: 'clothes_top', label: 'トップス', type: 'thumb', thumbPrefix: 'p_cf_top_' },
      { key: 'clothes_bot', label: 'ボトムス', type: 'thumb', thumbPrefix: 'p_cf_bot_' },
      { key: 'bra', label: 'ブラ', type: 'thumb', thumbPrefix: 'p_cf_bra_' },
      { key: 'panties', label: 'パンツ', type: 'thumb', thumbPrefix: 'p_cf_shorts_' },
      { key: 'gloves', label: '手袋', type: 'thumb', thumbPrefix: 'p_cf_gloves_' },
      { key: 'pantyhose', label: 'パンスト', type: 'thumb', thumbPrefix: 'p_o_panst_' },
      { key: 'socks', label: '靴下', type: 'thumb', thumbPrefix: 'p_cf_socks_' },
      { key: 'shoes', label: '靴', type: 'thumb', thumbPrefix: 'p_cf_shoes_' },
    ]
  },
  accessory: {
    label: 'アクセ',
    subs: [
      { key: 'acc_head', label: '頭', type: 'thumb', thumbPrefix: 'p_acs_' },
      { key: 'acc_face', label: '顔', type: 'thumb', thumbPrefix: 'p_acs_face_' },
      { key: 'acc_body', label: '体', type: 'thumb', thumbPrefix: 'p_acs_body_' },
    ]
  },
  param: {
    label: '設定',
    subs: [
      { key: 'personality', label: '性格', type: 'slider' },
      { key: 'voice', label: '声', type: 'slider' },
    ]
  },
};

// 体型スライダー定義
export const BODY_SLIDERS = [
  { group: '上半身', items: [
    { key: 'height', label: '身長', min: -1, max: 1, def: 0 },
    { key: 'headSize', label: '頭の大きさ', min: -1, max: 1, def: 0 },
    { key: 'neckThick', label: '首の太さ', min: -1, max: 1, def: 0 },
    { key: 'neckLen', label: '首の長さ', min: -1, max: 1, def: 0 },
    { key: 'shoulderWidth', label: '肩幅', min: -1, max: 1, def: 0 },
    { key: 'bust', label: '胸の大きさ', min: -1, max: 1, def: 0 },
    { key: 'bustSoftness', label: '柔らかさ', min: 0, max: 1, def: 0.5 },
    { key: 'waist', label: 'ウエスト', min: -1, max: 1, def: 0 },
  ]},
  { group: '下半身', items: [
    { key: 'hips', label: 'ヒップ', min: -1, max: 1, def: 0 },
    { key: 'legLen', label: '脚の長さ', min: -1, max: 1, def: 0 },
    { key: 'legThick', label: '脚の太さ', min: -1, max: 1, def: 0 },
    { key: 'calfThick', label: 'ふくらはぎ', min: -1, max: 1, def: 0 },
    { key: 'footSize', label: '足の大きさ', min: -1, max: 1, def: 0 },
  ]},
  { group: '腕', items: [
    { key: 'armLen', label: '腕の長さ', min: -1, max: 1, def: 0 },
    { key: 'armThick', label: '腕の太さ', min: -1, max: 1, def: 0 },
    { key: 'handSize', label: '手の大きさ', min: -1, max: 1, def: 0 },
  ]},
];

export const FACE_SLIDERS = [
  { group: '輪郭', items: [
    { key: 'faceWidth', label: '横幅', min: -1, max: 1, def: 0 },
    { key: 'faceLen', label: '縦長さ', min: -1, max: 1, def: 0 },
    { key: 'chinWidth', label: 'あごの横幅', min: -1, max: 1, def: 0 },
    { key: 'chinLen', label: 'あごの長さ', min: -1, max: 1, def: 0 },
    { key: 'cheekSize', label: '頬の大きさ', min: -1, max: 1, def: 0 },
  ]},
  { group: '目', items: [
    { key: 'eyeAngle', label: '目の角度', min: -1, max: 1, def: 0 },
    { key: 'eyeSize', label: '目の大きさ', min: -1, max: 1, def: 0 },
    { key: 'eyeWidth', label: '目の横幅', min: -1, max: 1, def: 0 },
    { key: 'eyeHeight', label: '目の高さ', min: -1, max: 1, def: 0 },
  ]},
  { group: '鼻・口', items: [
    { key: 'noseSize', label: '鼻の大きさ', min: -1, max: 1, def: 0 },
    { key: 'noseHeight', label: '鼻の高さ', min: -1, max: 1, def: 0 },
    { key: 'mouthWidth', label: '口の横幅', min: -1, max: 1, def: 0 },
    { key: 'mouthHeight', label: '口の高さ', min: -1, max: 1, def: 0 },
    { key: 'lipThick', label: '唇の厚さ', min: -1, max: 1, def: 0 },
  ]},
];

// ヘアカラープリセット
export const HAIR_COLORS = [
  '#1a0a00', '#2d1500', '#3d2000', '#5c3010',
  '#8b5e3c', '#c4956a', '#f0c9a0', '#ffddb0',
  '#f5e6c8', '#ffffff', '#ffff00', '#ffd700',
  '#ff8c00', '#ff4500', '#dc143c', '#ff1493',
  '#c71585', '#8b008b', '#4b0082', '#0000cd',
  '#1e90ff', '#00bfff', '#00ced1', '#00ff7f',
  '#3d3d3d', '#696969', '#a9a9a9', '#d3d3d3',
];

export const SKIN_COLORS = [
  '#ffe0c0', '#ffd0b0', '#ffc0a0', '#ffb090',
  '#f0a080', '#d88060', '#c07050', '#a06040',
  '#804830', '#603820', '#fff0e0', '#ffe8d0',
];
