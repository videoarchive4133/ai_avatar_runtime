// ── Love System ─────────────────────────────────────────────────────────────
// こいカツ風の恋愛シミュレーションシステム
// affection (好感度 0-100) と excitement (ドキドキ 0-100) を管理する

const LS_KEY = 'koi_love_data';

/** 関係性ステージ */
const STAGES = [
  { id: 'stranger',     label: '初対面',  minAffection: 0   },
  { id: 'acquaintance', label: '知り合い', minAffection: 20  },
  { id: 'friend',       label: '友達',    minAffection: 40  },
  { id: 'close',        label: '仲良し',  minAffection: 60  },
  { id: 'crush',        label: '好き♡',   minAffection: 80  },
  { id: 'lover',        label: '恋人♡♡', minAffection: 100 },
];

/** デフォルト状態 */
function defaultState() {
  return { affection: 0, excitement: 0, totalTalks: 0, unlockedTopics: ['weather', 'hobby'] };
}

let _state = null;

function _load() {
  if (_state) return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    _state = raw ? JSON.parse(raw) : defaultState();
  } catch {
    _state = defaultState();
  }
}

function _save() {
  localStorage.setItem(LS_KEY, JSON.stringify(_state));
}

export function getRelationship() {
  _load();
  return { ..._state };
}

export function getStage() {
  _load();
  const aff = _state.affection;
  let stage = STAGES[0];
  for (const s of STAGES) {
    if (aff >= s.minAffection) stage = s;
  }
  return stage;
}

// 性格ボーナスを外部からセットする（main.js の lovePickChoice 時に呼び出す）
let _personalityMul = { affMul: 1.0, excMul: 1.0 };
export function setPersonalityMultiplier(affMul, excMul) {
  _personalityMul = { affMul: affMul ?? 1.0, excMul: excMul ?? 1.0 };
}

export function addAffection(delta) {
  _load();
  const applied = Math.round(delta * _personalityMul.affMul);
  _state.affection = Math.max(0, Math.min(100, _state.affection + applied));
  _save();
  return { value: _state.affection, applied };
}

export function addExcitement(delta) {
  _load();
  const applied = Math.round(delta * _personalityMul.excMul);
  _state.excitement = Math.max(0, Math.min(100, _state.excitement + applied));
  _save();
  return { value: _state.excitement, applied };
}

export function recordTalk() {
  _load();
  _state.totalTalks++;
  // トーク数に応じてトピック解放
  if (_state.totalTalks >= 3 && !_state.unlockedTopics.includes('food')) {
    _state.unlockedTopics.push('food');
  }
  if (_state.totalTalks >= 6 && !_state.unlockedTopics.includes('future')) {
    _state.unlockedTopics.push('future');
  }
  if (_state.totalTalks >= 10 && !_state.unlockedTopics.includes('love')) {
    _state.unlockedTopics.push('love');
  }
  _save();
}

export function resetRelationship() {
  _state = defaultState();
  _save();
}

// ── ダイアログトピック ────────────────────────────────────────────────────────

const TOPICS = {
  weather: {
    label: '☁ 天気の話',
    unlockAt: 0,
    opener: ['今日いい天気ですね♪', '最近雨が多いですね…', '今日は暖かくて気持ちいいですね！'],
    choices: [
      { text: 'そうだね、散歩日和だね', affection: +5, excitement: +3, reaction: 'happy',
        reply: 'ふふっ、一緒に散歩行く？' },
      { text: 'でも私は曇りのほうが好きかも', affection: +3, excitement: +1, reaction: 'thinking',
        reply: 'そうなんだ…私はお日様が好きかな' },
      { text: '（無言で頷く）', affection: +1, excitement: -1, reaction: 'neutral',
        reply: '……あ、そっか（ちょっとさみしい）' },
    ],
  },
  hobby: {
    label: '🎵 趣味の話',
    unlockAt: 0,
    opener: ['最近ハマってることある？', '趣味って何かある？', 'なにかスポーツとかやってる？'],
    choices: [
      { text: '音楽が好きだよ！', affection: +6, excitement: +5, reaction: 'happy',
        reply: 'えっ、私も！一緒にカラオケ行こうよ！' },
      { text: '本をよく読む', affection: +5, excitement: +2, reaction: 'smile',
        reply: '知的だね♪ おすすめ教えて！' },
      { text: '特にないな', affection: +1, excitement: 0, reaction: 'thinking',
        reply: 'そっか…これから一緒に見つけよう？' },
    ],
  },
  food: {
    label: '🍜 好きな食べ物',
    unlockAt: 3,
    opener: ['お昼ご飯、何食べた？', '甘いもの好き？', 'ラーメンとうどん、どっちが好き？'],
    choices: [
      { text: 'ラーメン！', affection: +5, excitement: +4, reaction: 'happy',
        reply: 'じゃあ今度一緒に食べに行こう！♡' },
      { text: 'うどんかな', affection: +4, excitement: +2, reaction: 'smile',
        reply: 'うどん好きな人、なんか落ち着くんだよね' },
      { text: '甘いものが一番！', affection: +6, excitement: +6, reaction: 'happy',
        reply: 'やった！じゃあケーキ屋さん行こうよ！' },
    ],
  },
  future: {
    label: '✨ 将来の夢',
    unlockAt: 6,
    opener: ['将来の夢って何かある？', '5年後、何してると思う？', 'やってみたいことって何かある？'],
    choices: [
      { text: '旅行したいな', affection: +7, excitement: +5, reaction: 'happy',
        reply: 'いつか一緒に海外行ってみたい！！' },
      { text: 'まだわからない', affection: +3, excitement: +1, reaction: 'thinking',
        reply: 'これから一緒に考えよう？' },
      { text: '有名になりたい', affection: +5, excitement: +8, reaction: 'surprised',
        reply: 'すごい！応援するね！絶対なれるよ！' },
    ],
  },
  love: {
    label: '💕 恋愛の話',
    unlockAt: 10,
    opener: ['好きな人いる？', '理想の人ってどんな人？', 'デートするならどこ行く？'],
    choices: [
      { text: 'え…ここにいるよ', affection: +15, excitement: +20, reaction: 'surprised',
        reply: 'えっ…！わ、私のこと……！？（顔真っ赤）' },
      { text: '海でデートがいいな', affection: +8, excitement: +10, reaction: 'happy',
        reply: 'うみ！！絶対楽しいね！水着どれにしよう…♡' },
      { text: 'まだ秘密', affection: +5, excitement: +7, reaction: 'thinking',
        reply: 'むー、気になる…！早く教えてほしいな' },
    ],
  },
};

export function getAvailableTopics(unlockedTopics) {
  return Object.entries(TOPICS)
    .filter(([key]) => unlockedTopics.includes(key))
    .map(([key, t]) => ({ key, label: t.label }));
}

export function getTopic(key) {
  return TOPICS[key] ?? null;
}

export function getRandomOpener(topicKey) {
  const topic = TOPICS[topicKey];
  if (!topic) return '';
  const arr = topic.opener;
  return arr[Math.floor(Math.random() * arr.length)];
}

export { STAGES };
