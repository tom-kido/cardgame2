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
