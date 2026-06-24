// ── kkCardParser.js ──────────────────────────────────────────────────────────
// コイカツ/コイカツサンシャインのキャラクターカードPNGを解析する。
// カードPNGはIENDチャンク以降にBinaryReaderフォーマット + MessagePackでデータを持つ。
import { decode } from '@msgpack/msgpack';

const KK_PRODUCT_IDS = new Set([100, 101]); // 100=Koikatsu, 101=KKS

function readInt32LE(u8, off) {
  return (u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0;
}

// PNG IENDチャンクのCRCで終端を探す
function findPNGEnd(u8) {
  for (let i = u8.length - 4; i >= 8; i--) {
    if (u8[i] === 0xAE && u8[i + 1] === 0x42 && u8[i + 2] === 0x60 && u8[i + 3] === 0x82) {
      return i + 4;
    }
  }
  return -1;
}

// C# BinaryReader.ReadString() 形式: 7-bit エンコードされた長さプレフィックス
function readString7bit(u8, off) {
  let len = 0, shift = 0;
  while (off < u8.length) {
    const b = u8[off++];
    len |= (b & 0x7F) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  if (len < 0 || off + len > u8.length) return null;
  return { value: new TextDecoder().decode(u8.subarray(off, off + len)), next: off + len };
}

// KK 性格 ID → アプリ性格 ID マッピング
export const KK_PERSONALITY_MAP = {
  0:  'cheerful',  // 天真爛漫
  1:  'cool',      // クール
  2:  'innocent',  // 内気
  3:  'tsundere',  // ツンデレ
  4:  'spoiled',   // 甘えん坊
  5:  'cheerful',  // 素直
  6:  'cheerful',  // 元気
  7:  'cheerful',  // ワイルド
  8:  'innocent',  // 妹
  9:  'innocent',  // 幼い
  10: 'cool',      // 知的
  11: 'cool',      // 先輩
  12: 'cool',      // 大人びた
  13: 'yandere',   // 腹黒
  14: 'cheerful',  // 情熱的
  15: 'tsundere',  // セクシー
  16: 'innocent',  // おどおど
  17: 'cool',      // 勤勉
  18: 'yandere',   // ヤンデレ
  19: 'cheerful',  // 幼なじみ
  20: 'tsundere',  // 女王様
  21: 'innocent',  // おっとり
  22: 'cheerful',  // ロックな奴
  23: 'cool',      // 無口
  24: 'innocent',  // マイペース
  25: 'cool',      // 落ち着いた
  26: 'cheerful',  // 昭和ギャル
  27: 'cool',      // 天才
  28: 'innocent',  // エルフ
  29: 'yandere',   // 吸血鬼
  30: 'cheerful',  // 明るい
};

export const KK_PERSONALITY_LABELS = [
  '天真爛漫', 'クール', '内気', 'ツンデレ', '甘えん坊',
  '素直', '元気', 'ワイルド', '妹', '幼い',
  '知的', '先輩', '大人びた', '腹黒', '情熱的',
  'セクシー', 'おどおど', '勤勉', 'ヤンデレ', '幼なじみ',
  '女王様', 'おっとり', 'ロックな奴', '無口', 'マイペース',
  '落ち着いた', '昭和ギャル', '天才', 'エルフ', '吸血鬼',
  '明るい',
];

/**
 * KKカードか判定する (高速チェック)
 * @param {ArrayBuffer} buf
 * @returns {boolean}
 */
export function isKKCard(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x89 || u8[1] !== 0x50) return false; // not PNG
  const end = findPNGEnd(u8);
  if (end < 0 || end + 4 > u8.length) return false;
  const pid = readInt32LE(u8, end);
  return KK_PRODUCT_IDS.has(pid);
}

/**
 * KKカードを解析してキャラクター情報を返す
 * @param {ArrayBuffer} buf
 * @returns {Promise<{productName:string, firstName:string, lastName:string, fullName:string,
 *   kkPersonality:number|null, appPersonality:string|null}|null>}
 */
export async function parseKKCard(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x89 || u8[1] !== 0x50) return null;

  const pngEnd = findPNGEnd(u8);
  if (pngEnd < 0) return null;

  let off = pngEnd;

  // Product ID (int32 LE): 100=KK, 101=KKS
  if (off + 4 > u8.length) return null;
  const productId = readInt32LE(u8, off); off += 4;
  if (!KK_PRODUCT_IDS.has(productId)) return null;
  const productName = productId === 101 ? 'Koikatsu Sunshine' : 'Koikatsu';

  // ゲーム識別子文字列 "【KoiKatuChara】" (7-bit encoded)
  const identR = readString7bit(u8, off);
  if (!identR) return { productName };
  off = identR.next;

  // バージョン文字列 "0.0.0" (7-bit encoded)
  const versionR = readString7bit(u8, off);
  if (!versionR) return { productName };
  off = versionR.next;

  // サムネイル PNG (int32 LE サイズ + バイト列)
  if (off + 4 > u8.length) return { productName };
  const thumbSize = readInt32LE(u8, off); off += 4;
  off += thumbSize;

  // lstInfo msgpack (int32 LE サイズ + msgpack バイト列)
  if (off + 4 > u8.length) return { productName };
  const lstSize = readInt32LE(u8, off); off += 4;
  if (off + lstSize > u8.length) return { productName };

  let lstEntries;
  try {
    const raw = decode(u8.subarray(off, off + lstSize));
    // raw は {lstInfo:[...]} または直接 [...] の場合がある
    lstEntries = Array.isArray(raw) ? raw
      : Array.isArray(raw?.lstInfo) ? raw.lstInfo
      : null;
  } catch { return { productName }; }
  if (!lstEntries) return { productName };

  const dataStart = off + lstSize;

  // 各ブロックを解析: KKブロックは先頭8バイトがバイナリヘッダー
  const blocks = {};
  for (const info of lstEntries) {
    const name  = info?.name  ?? info?.Name;
    const pos   = typeof info?.pos  === 'number' ? info.pos  : null;
    const size  = typeof info?.size === 'number' ? info.size : null;
    if (!name || pos === null || size === null || size < 8) continue;
    const bStart = dataStart + pos;
    if (bStart + size > u8.length) continue;
    // Parameter / Status ブロック: 8バイトプレフィックスをスキップしてmsgpakをデコード
    if (name === 'Parameter' || name === 'Status') {
      try {
        blocks[name] = decode(u8.subarray(bStart + 8, bStart + size));
      } catch { /* skip */ }
    }
  }

  // Parameter ブロックからキャラ情報を取得
  let firstName = '', lastName = '', kkPersonality = null;
  const param = blocks['Parameter'];
  if (param && typeof param === 'object' && !Array.isArray(param)) {
    firstName = String(param.firstName  ?? param.FirstName  ?? '');
    lastName  = String(param.familyName ?? param.lastName   ?? param.FamilyName ?? '');
    const pv  = param.personality ?? param.Personality;
    if (typeof pv === 'number') kkPersonality = pv;
  }

  const appPersonality = kkPersonality !== null
    ? (KK_PERSONALITY_MAP[kkPersonality] ?? 'cheerful')
    : null;

  const fullName = [lastName, firstName].filter(Boolean).join(' ').trim() || null;
  return { productName, firstName, lastName, fullName, kkPersonality, appPersonality };
}

/**
 * KKカードPNGをサムネイル dataURL に変換 (160×200)
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function kkCardToThumbDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = 160, H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      // アスペクト比を維持してセンタークロップ
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

// ── SillyTavern / TavernAI キャラクターカード ────────────────────────────────
// PNG tEXtチャンク "chara" にbase64エンコードされたJSONが埋め込まれている。

const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/**
 * PNG の全 tEXt チャンクを {keyword: string, text: string}[] として返す
 */
function parsePNGTextChunks(u8) {
  for (let i = 0; i < 8; i++) {
    if (u8[i] !== PNG_SIG[i]) return [];
  }
  const dec = new TextDecoder('latin1');
  const chunks = [];
  let off = 8;
  while (off + 12 <= u8.length) {
    const len  = (u8[off] << 24 | u8[off+1] << 16 | u8[off+2] << 8 | u8[off+3]) >>> 0;
    const type = dec.decode(u8.subarray(off+4, off+8));
    if (type === 'tEXt' && off + 12 + len <= u8.length) {
      const data = u8.subarray(off+8, off+8+len);
      const nul  = data.indexOf(0);
      if (nul >= 0) {
        const keyword = dec.decode(data.subarray(0, nul));
        const text    = dec.decode(data.subarray(nul+1));
        chunks.push({ keyword, text });
      }
    }
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

/**
 * SillyTavernカードか判定
 * @param {ArrayBuffer} buf
 * @returns {boolean}
 */
export function isSillyTavernCard(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x89 || u8[1] !== 0x50) return false;
  return parsePNGTextChunks(u8).some(c => c.keyword === 'chara');
}

/**
 * SillyTavernカードを解析
 * @param {ArrayBuffer} buf
 * @returns {{name:string, description:string, personality:string, scenario:string,
 *   firstMes:string, mesExample:string, systemPrompt:string,
 *   creatorNotes:string, tags:string[], creator:string,
 *   cardType:'st_v1'|'st_v2'} | null}
 */
export function parseSillyTavernCard(buf) {
  const u8 = new Uint8Array(buf);
  const chunk = parsePNGTextChunks(u8).find(c => c.keyword === 'chara');
  if (!chunk) return null;
  let json;
  try {
    json = JSON.parse(atob(chunk.text));
  } catch {
    return null;
  }
  // V2 (chara_card_v2) か V1 か判定
  const isV2 = json?.spec === 'chara_card_v2';
  const d = isV2 ? (json.data ?? {}) : json;
  return {
    cardType:     isV2 ? 'st_v2' : 'st_v1',
    name:         String(d.name         ?? ''),
    description:  String(d.description  ?? ''),
    personality:  String(d.personality  ?? ''),
    scenario:     String(d.scenario     ?? ''),
    firstMes:     String(d.first_mes    ?? ''),
    mesExample:   String(d.mes_example  ?? ''),
    systemPrompt: String(d.system_prompt ?? isV2 ? (d.system_prompt ?? '') : ''),
    creatorNotes: String(d.creator_notes ?? d.creatorcomment ?? ''),
    tags:         Array.isArray(d.tags) ? d.tags.map(String) : [],
    creator:      String(d.creator ?? ''),
  };
}

/**
 * PNGをサムネイルDataURLに変換（SillyTavern用、PNG自体がアートワーク）
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function pngToThumbDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = 160, H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}
