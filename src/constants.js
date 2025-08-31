export const CARD_BACK_URL  = 'https://tom-kido.github.io/cardgame/card_back.png';
export const CARD_FRONT_URL = 'https://tom-kido.github.io/cardgame/card_front.png';
// Local assets for type-specific frames (optional, but preferred)
export const ASSET_VERSION = 'v1';
export const ASSETS = {
  BACK:  'assets/back_image.png',
  SHIKI: 'assets/siki_image.png',
  JYUTSU:'assets/jyutu_image.png',
  POWER: 'assets/pow_image.png',
};
export const SNAP_RANGE_DEFAULT = 40;
export const HAND_OVERLAP_P1 = 20;
export const HAND_OVERLAP_P2 = 10;
export const CARD_W = 100;
export const CARD_H = 130;
export const ZONE_STACK_OFFSET_X = 5;
export const ZONE_STACK_OFFSET_Y = 20;

// ==== Card Type System ====
export const CARD_TYPE = {
  SHIKI: 'shikigami',
  JYUTSU: 'jyutsu',
  POWER: 'power',
};

export const DEFAULT_CARD = {
  type: CARD_TYPE.SHIKI,
  name: '',
  power: 500,
};

// Texture keys used in Phaser
export const TEX = {
  BACK: 'card_back',
  SHIKI: 'card_frame_shiki',
  JYUTSU: 'card_frame_jyutsu',
  POWER: 'card_frame_power',
};

export const FONT = {
  NAME:  { fontSize: '16px', fontFamily: 'serif', color: '#111' },
  POWER: { fontSize: '18px', fontFamily: 'serif', color: '#111', align: 'center' },
};

// === Text layout (カード上の文字位置) ===
export const LABEL_Y = {
  NAME_TOP:   (CARD_H * -0.40), // 上帯（基本は非表示）
  VALUE_BOT:  (CARD_H *  0.36), // 下の数値（式神の力量）
  JYUTSU_BOT: (CARD_H *  0.30), // 下の術式種類（結界/祓い/封印/解呪）
};

// ==== Jyutsu (術式) system ====
export const SPELL_KIND = {
  BARRIER: 'barrier',
  PURIFY: 'purify',
  SEAL: 'seal',
  DISPEL: 'dispel',
};

export const SPELL_NAME = {
  [SPELL_KIND.BARRIER]: '結界',
  [SPELL_KIND.PURIFY]:  '祓い',
  [SPELL_KIND.SEAL]:    '封印',
  [SPELL_KIND.DISPEL]:  '解呪',
};

// Weighted random for spell kind (tweak as needed)
export function rollSpellKind() {
  // Example weights: barrier:3, purify:3, seal:2, dispel:2
  const pool = [
    SPELL_KIND.BARRIER, SPELL_KIND.BARRIER, SPELL_KIND.BARRIER,
    SPELL_KIND.PURIFY,  SPELL_KIND.PURIFY,  SPELL_KIND.PURIFY,
    SPELL_KIND.SEAL,    SPELL_KIND.SEAL,
    SPELL_KIND.DISPEL,  SPELL_KIND.DISPEL,
  ];
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
