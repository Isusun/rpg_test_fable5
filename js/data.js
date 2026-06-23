// ============================================================
// ゲームデータ定義（純データ。PIXI/DOM非依存 — Nodeでも検証可能）
// ============================================================
'use strict';

// ---------- 経験値テーブル ----------
const MAX_LV = 20;
const EXP_TABLE = (() => {
  const cum = [0, 0]; // cum[L] = LvLに必要な累計経験値
  let total = 0;
  for (let L = 2; L <= MAX_LV; L++) {
    total += Math.round(9 * Math.pow(L - 1, 1.9));
    cum[L] = total;
  }
  return cum;
})();
function levelForExp(exp) {
  let lv = 1;
  while (lv < MAX_LV && exp >= EXP_TABLE[lv + 1]) lv++;
  return lv;
}

// ---------- キャラクター ----------
const CHARACTERS = {
  alen: {
    name: 'アレン', pal: 'hero',
    growth: { hp: [26, 7], mp: [6, 2], atk: [8, 2.4], def: [6, 2.0], spd: [6, 1.6], mag: [3, 1.2] },
    skillsByLevel: { 3: 'swallow', 6: 'fireslash', 9: 'brave', 13: 'starblade' },
    initEquip: { weapon: 'w_stick', armor: 'a_cloth', acc: null },
  },
  rina: {
    name: 'リナ', pal: 'rina',
    growth: { hp: [19, 5], mp: [14, 4], atk: [5, 1.4], def: [4, 1.5], spd: [7, 1.9], mag: [9, 2.8] },
    skillsByLevel: { 1: 'fire', 4: 'heal', 6: 'ice', 8: 'sleepmist', 10: 'thunder', 12: 'highheal', 14: 'blizzard' },
    initEquip: { weapon: 'w_staff0', armor: 'a_cloth', acc: null },
  },
  gald: {
    name: 'ガルド', pal: 'gald',
    growth: { hp: [32, 8], mp: [8, 2.2], atk: [9, 2.6], def: [9, 2.4], spd: [5, 1.2], mag: [4, 1.6] },
    skillsByLevel: { 1: 'smash', 7: 'guardall', 11: 'cure', 13: 'voltbreak' },
    initEquip: { weapon: 'w_sword', armor: 'a_bronze', acc: null },
  },
};

// ---------- スキル ----------
// kind: phys(物理倍率) / magic(固定威力+賢さ) / heal / buff / status
// target: enemy / allEnemies / ally / allAllies / self
const SKILLS = {
  swallow:   { name: 'つばめ斬り', mp: 2, kind: 'phys', mult: 1.6, element: 'none', target: 'enemy', desc: '鋭い二連撃。威力1.6倍' },
  fireslash: { name: 'ファイアスラッシュ', mp: 3, kind: 'phys', mult: 1.8, element: 'fire', target: 'enemy', desc: '炎をまとう斬撃' },
  brave:     { name: 'ブレイブ', mp: 3, kind: 'buff', buff: 'atkup', target: 'self', desc: '自分の攻撃力を上げる' },
  starblade: { name: '星光斬', mp: 6, kind: 'phys', mult: 2.4, element: 'none', target: 'enemy', desc: '星の力を宿す必殺剣' },
  fire:      { name: 'ファイア', mp: 2, kind: 'magic', pow: 16, element: 'fire', target: 'enemy', desc: '炎の魔法' },
  ice:       { name: 'アイス', mp: 3, kind: 'magic', pow: 26, element: 'ice', target: 'enemy', desc: '氷の魔法' },
  thunder:   { name: 'サンダー', mp: 5, kind: 'magic', pow: 38, element: 'thunder', target: 'enemy', desc: '雷の魔法' },
  blizzard:  { name: 'ブリザード', mp: 8, kind: 'magic', pow: 30, element: 'ice', target: 'allEnemies', desc: '氷嵐で敵全体を攻撃' },
  heal:      { name: 'ヒール', mp: 3, kind: 'heal', pow: 32, target: 'ally', field: true, desc: '味方1人のHPを回復' },
  highheal:  { name: 'ハイヒール', mp: 6, kind: 'heal', pow: 85, target: 'ally', field: true, desc: '味方1人のHPを大回復' },
  sleepmist: { name: 'スリープミスト', mp: 4, kind: 'status', status: 'sleep', chance: 0.65, target: 'allEnemies', desc: '敵全体を眠らせる霧' },
  smash:     { name: 'パワースマッシュ', mp: 2, kind: 'phys', mult: 1.7, element: 'none', target: 'enemy', desc: '渾身の一撃' },
  guardall:  { name: 'まもりの構え', mp: 3, kind: 'buff', buff: 'defup', target: 'allAllies', desc: '味方全員の守備力を上げる' },
  cure:      { name: 'キュア', mp: 4, kind: 'heal', pow: 50, cures: ['poison'], target: 'ally', field: true, desc: 'HP回復と毒の治療' },
  voltbreak: { name: '雷鳴撃', mp: 5, kind: 'phys', mult: 1.9, element: 'thunder', target: 'enemy', desc: '雷をまとう斧撃' },
  // --- 敵専用 ---
  e_poisonbite: { name: 'どくの牙', mp: 0, kind: 'phys', mult: 0.9, element: 'none', target: 'enemy', status: 'poison', chance: 0.4 },
  e_sleeppollen:{ name: 'ねむり花粉', mp: 0, kind: 'status', status: 'sleep', chance: 0.6, target: 'enemy' },
  e_bite:       { name: 'かみつき', mp: 0, kind: 'phys', mult: 1.3, element: 'none', target: 'enemy' },
  e_firebreath: { name: '火炎の息', mp: 0, kind: 'magic', pow: 13, element: 'fire', target: 'allEnemies' },
  e_icebolt:    { name: '氷の矢', mp: 0, kind: 'magic', pow: 20, element: 'ice', target: 'enemy' },
  e_firebolt:   { name: '炎の弾', mp: 0, kind: 'magic', pow: 18, element: 'fire', target: 'enemy' },
  e_darkwave:   { name: '闇の波動', mp: 0, kind: 'magic', pow: 24, element: 'none', target: 'allEnemies' },
  e_crysstrike: { name: '晶撃', mp: 0, kind: 'phys', mult: 1.6, element: 'none', target: 'enemy' },
  e_poisonmist: { name: '毒の霧', mp: 0, kind: 'status', status: 'poison', chance: 0.45, target: 'allEnemies' },
  e_sleepbreath:{ name: '眠りの吐息', mp: 0, kind: 'status', status: 'sleep', chance: 0.6, target: 'enemy' },
};

// ---------- アイテム ----------
const ITEMS = {
  herb:     { name: 'やくそう', type: 'use', price: 8, heal: 35, target: 'ally', field: true, desc: 'HPを35回復する薬草' },
  herb2:    { name: 'いやしの実', type: 'use', price: 60, heal: 90, target: 'ally', field: true, desc: 'HPを90回復する果実' },
  mpwater:  { name: 'まほうの水', type: 'use', price: 40, mpheal: 25, target: 'ally', field: true, desc: 'MPを25回復する霊水' },
  antidote: { name: 'どくけし草', type: 'use', price: 10, cures: ['poison'], target: 'ally', field: true, desc: '毒を治す薬草' },
  bell:     { name: 'めざましベル', type: 'use', price: 12, cures: ['sleep'], target: 'ally', field: false, desc: '眠りを覚ます鈴（戦闘中用）' },
  elixir:   { name: '星のしずく', type: 'use', price: 500, heal: 999, mpheal: 999, target: 'ally', field: true, noshop: true, desc: 'HPとMPを全回復する秘薬' },
  seed:     { name: 'ちからのたね', type: 'use', price: 300, permanent: 'atk', amount: 2, target: 'ally', field: true, noshop: true, desc: 'ちからが永続+2' },
  wing:     { name: '帰還の翼', type: 'use', price: 25, warpTown: true, target: 'none', field: true, desc: '最後に訪れた町へ戻る' },
  // 大事なもの
  cavekey:  { name: '洞窟のカギ', type: 'key', desc: '古の洞窟の扉を開く錆びた鍵' },
  crest:    { name: '蒼の紋章', type: 'key', desc: '冥晶城の結界を破る古の紋章' },
  medicine: { name: '特効薬', type: 'key', desc: 'ミナ特製の薬。ミラルの病気の子へ' },
};

// ---------- 装備 ----------
const EQUIPS = {
  w_stick:   { name: 'ひのきの棒', slot: 'weapon', atk: 2, price: 30, who: ['alen', 'rina', 'gald'] },
  w_dagger:  { name: '銅のナイフ', slot: 'weapon', atk: 5, price: 90, who: ['alen', 'rina'] },
  w_staff0:  { name: '木の杖', slot: 'weapon', atk: 2, mag: 2, price: 40, who: ['rina'] },
  w_staff:   { name: '樫の杖', slot: 'weapon', atk: 3, mag: 5, price: 150, who: ['rina'] },
  w_sword:   { name: 'ブロンズソード', slot: 'weapon', atk: 9, price: 260, who: ['alen', 'gald'] },
  w_knight:  { name: '騎士の剣', slot: 'weapon', atk: 14, price: 720, who: ['alen', 'gald'] },
  w_wand:    { name: '賢者の杖', slot: 'weapon', atk: 6, mag: 10, price: 680, who: ['rina'] },
  w_axe:     { name: '大戦斧', slot: 'weapon', atk: 17, price: 980, who: ['gald'] },
  w_star:    { name: '星灯の剣', slot: 'weapon', atk: 22, mag: 5, price: 2000, noshop: true, who: ['alen'] },
  a_cloth:   { name: '布の服', slot: 'armor', def: 2, price: 25, who: ['alen', 'rina', 'gald'] },
  a_leather: { name: '旅人の服', slot: 'armor', def: 5, price: 110, who: ['alen', 'rina', 'gald'] },
  a_bronze:  { name: '青銅の鎧', slot: 'armor', def: 9, price: 380, who: ['alen', 'gald'] },
  a_robe:    { name: '魔織のローブ', slot: 'armor', def: 7, mag: 3, price: 330, who: ['rina'] },
  a_knight:  { name: '騎士の鎧', slot: 'armor', def: 14, price: 860, who: ['alen', 'gald'] },
  a_silk:    { name: '星紡ぎのローブ', slot: 'armor', def: 11, mag: 6, price: 820, who: ['rina'] },
  a_star:    { name: '星灯の鎧', slot: 'armor', def: 19, price: 2200, noshop: true, who: ['alen', 'gald'] },
  acc_charm: { name: '銀の守り', slot: 'acc', def: 2, immune: ['poison'], price: 600, noshop: true, who: ['alen', 'rina', 'gald'] },
  acc_boots: { name: '疾風のブーツ', slot: 'acc', spd: 6, price: 420, who: ['alen', 'rina', 'gald'] },
  acc_ring:  { name: '力の指輪', slot: 'acc', atk: 4, price: 520, who: ['alen', 'rina', 'gald'] },
  acc_amulet:{ name: '月のお守り', slot: 'acc', def: 3, mag: 3, price: 360, who: ['alen', 'rina', 'gald'] },
};

// ---------- 敵 ----------
// weak/resist: 属性倍率 1.5 / 0.5
const ENEMIES = {
  slime:    { name: 'あおぷる', art: 'slime', size: 44, hp: 15, atk: 9, def: 3, spd: 4, mag: 2, exp: 4, gold: 5,
              ai: [{ w: 10, attack: true }] },
  bat:      { name: 'どくばね', art: 'bat', size: 44, hp: 13, atk: 10, def: 2, spd: 9, mag: 2, exp: 5, gold: 6,
              ai: [{ w: 6, attack: true }, { w: 4, skill: 'e_poisonbite' }] },
  flower:   { name: 'ねむりばな', art: 'flower', size: 46, hp: 19, atk: 9, def: 4, spd: 3, mag: 4, exp: 7, gold: 9, weak: { fire: 1.5 },
              ai: [{ w: 6, attack: true }, { w: 4, skill: 'e_sleeppollen' }] },
  goblin:   { name: 'ゴブリン', art: 'goblin', size: 48, hp: 26, atk: 13, def: 5, spd: 6, mag: 2, exp: 11, gold: 15,
              ai: [{ w: 8, attack: true }, { w: 2, skill: 'e_bite' }], drop: { id: 'herb', rate: 0.15 } },
  lizard:   { name: 'いわトカゲ', art: 'lizard', size: 50, hp: 36, atk: 16, def: 9, spd: 5, mag: 3, exp: 17, gold: 19, weak: { ice: 1.5 }, resist: { fire: 0.5 },
              ai: [{ w: 7, attack: true }, { w: 3, skill: 'e_bite' }] },
  ghost:    { name: 'さまよう霊', art: 'ghost', size: 46, hp: 28, atk: 14, def: 6, spd: 8, mag: 8, exp: 16, gold: 17, weak: { fire: 1.5 },
              ai: [{ w: 6, attack: true }, { w: 4, skill: 'e_sleepbreath' }] },
  crab:     { name: 'ヨロイガニ', art: 'crab', size: 48, hp: 42, atk: 18, def: 13, spd: 5, mag: 3, exp: 22, gold: 26, weak: { thunder: 1.5 },
              ai: [{ w: 10, attack: true }], drop: { id: 'herb2', rate: 0.1 } },
  soldier:  { name: '冥晶兵', art: 'soldier', size: 52, hp: 64, atk: 25, def: 15, spd: 9, mag: 5, exp: 48, gold: 52, weak: { thunder: 1.5 },
              ai: [{ w: 7, attack: true }, { w: 3, skill: 'e_crysstrike' }] },
  darkmage: { name: '闇の魔導士', art: 'darkmage', size: 50, hp: 50, atk: 15, def: 10, spd: 11, mag: 22, exp: 52, gold: 64,
              ai: [{ w: 4, attack: true }, { w: 3, skill: 'e_firebolt' }, { w: 3, skill: 'e_icebolt' }], drop: { id: 'mpwater', rate: 0.2 } },
  icewisp:  { name: '氷晶の精', art: 'icewisp', size: 46, hp: 46, atk: 20, def: 11, spd: 14, mag: 16, exp: 42, gold: 44, weak: { fire: 1.5 }, resist: { ice: 0.5 },
              ai: [{ w: 5, attack: true }, { w: 5, skill: 'e_icebolt' }] },
  gargoyle: { name: 'ガーゴイル', art: 'gargoyle', size: 54, hp: 76, atk: 28, def: 17, spd: 12, mag: 6, exp: 64, gold: 58,
              ai: [{ w: 8, attack: true }, { w: 2, skill: 'e_crysstrike' }] },
  rockdragon: { name: '岩牙竜', art: 'rockdragon', size: 96, hp: 300, atk: 23, def: 14, spd: 7, mag: 10, exp: 130, gold: 160,
              boss: true, weak: { ice: 1.75 }, resist: { fire: 0.5 },
              ai: [{ w: 5, attack: true }, { w: 3, skill: 'e_bite' }, { w: 3, skill: 'e_firebreath' }] },
  zarva:    { name: '冥晶王ザルヴァ', art: 'zarva', size: 112, hp: 1050, atk: 35, def: 21, spd: 13, mag: 26, exp: 0, gold: 0,
              boss: true, barrier: ['fire', 'ice', 'thunder'],
              ai: [{ w: 4, attack: true }, { w: 3, skill: 'e_crysstrike' }, { w: 3, skill: 'e_darkwave' },
                   { w: 2, skill: 'e_poisonmist' }, { w: 2, skill: 'e_sleepbreath' }] },
};

// ---------- エンカウントグループ ----------
const ENCOUNTERS = {
  west:  { rate: 13, bg: 'field', groups: [
    { w: 5, e: ['slime'] }, { w: 4, e: ['slime', 'slime'] }, { w: 4, e: ['bat'] },
    { w: 3, e: ['slime', 'bat'] }, { w: 3, e: ['flower'] }, { w: 2, e: ['goblin'] },
    { w: 1, e: ['slime', 'slime', 'slime'] },
  ]},
  east:  { rate: 13, bg: 'coast', groups: [
    { w: 4, e: ['crab'] }, { w: 3, e: ['lizard', 'flower'] }, { w: 3, e: ['goblin', 'goblin'] },
    { w: 3, e: ['crab', 'bat'] }, { w: 2, e: ['crab', 'crab'] }, { w: 2, e: ['flower', 'flower', 'bat'] },
  ]},
  north: { rate: 12, bg: 'field', groups: [
    { w: 4, e: ['gargoyle'] }, { w: 3, e: ['soldier'] }, { w: 3, e: ['icewisp', 'icewisp'] },
    { w: 3, e: ['soldier', 'darkmage'] },
  ]},
  cave:  { rate: 10, bg: 'cave', groups: [
    { w: 4, e: ['bat', 'bat'] }, { w: 4, e: ['lizard'] }, { w: 4, e: ['ghost'] },
    { w: 3, e: ['lizard', 'bat'] }, { w: 2, e: ['goblin', 'goblin'] }, { w: 2, e: ['ghost', 'ghost'] },
  ]},
  castle:{ rate: 10, bg: 'castle', groups: [
    { w: 4, e: ['soldier'] }, { w: 3, e: ['darkmage'] }, { w: 3, e: ['soldier', 'soldier'] },
    { w: 3, e: ['icewisp', 'darkmage'] }, { w: 3, e: ['gargoyle'] }, { w: 1, e: ['soldier', 'darkmage', 'icewisp'] },
  ]},
};

// ---------- 店 ----------
const SHOPS = {
  village_shop: { items: ['herb', 'antidote', 'mpwater', 'wing', 'w_stick', 'w_dagger', 'w_staff0', 'a_cloth', 'a_leather'] },
  port_item:    { items: ['herb', 'herb2', 'mpwater', 'antidote', 'bell', 'wing'] },
  port_weapon:  { items: ['w_sword', 'w_staff', 'w_knight', 'w_wand', 'w_axe', 'a_bronze', 'a_robe', 'a_knight', 'a_silk', 'acc_boots', 'acc_ring', 'acc_amulet'] },
};

// ============================================================
// マップ
// 凡例: .草 :草2 ,道 f花 s砂 ~水 -深水 T木 M山 #壁 %闇壁 _床 d闇床
//       w木床 =橋 R屋根 h家壁 D扉(装飾) F柵 c台 *晶 +絨毯 W井戸 V虚
//       < 入口/洞窟口(歩行可) > 下り階段 ^ 上り階段
// 動的: チェスト/鍵扉/岩/スイッチ/門 は objects で定義
// ============================================================
const TILE_DEF = {
  '.': { tex: 'grass', walk: true }, ':': { tex: 'grass2', walk: true },
  ',': { tex: 'path', walk: true }, 'f': { tex: 'flowers', walk: true },
  's': { tex: 'sand', walk: true }, '~': { tex: 'water', walk: false },
  '-': { tex: 'deepwater', walk: false }, 'T': { tex: 'tree', walk: false },
  'M': { tex: 'mountain', walk: false }, '#': { tex: 'wall', walk: false },
  '%': { tex: 'darkwall', walk: false }, '_': { tex: 'floor', walk: true },
  'd': { tex: 'darkfloor', walk: true }, 'w': { tex: 'wood', walk: true },
  '=': { tex: 'bridge', walk: true }, 'R': { tex: 'roof', walk: false },
  'B': { tex: 'roofblue', walk: false },
  'h': { tex: 'housewall', walk: false }, 'D': { tex: 'door', walk: false },
  'F': { tex: 'fence', walk: false }, 'c': { tex: 'counter', walk: false },
  '*': { tex: 'crystal', walk: false }, '+': { tex: 'carpet', walk: true },
  'W': { tex: 'well', walk: false }, 'V': { tex: 'void', walk: false },
  'S': { tex: 'sign', walk: false },
  '<': { tex: 'caveIn', walk: true }, '>': { tex: 'stairsDown', walk: true },
  '^': { tex: 'stairsUp', walk: true },
};

const MAPS = {
  // ======== ワールドマップ ========
  world: {
    name: 'エルディア大陸', pad: 'M', bgm: 'field',
    zones: [
      { rect: [0, 9, 35, 27], enc: 'west',  cond: (x, y) => x < 18 },
      { rect: [0, 9, 35, 27], enc: 'east',  cond: (x, y) => x >= 18 },
      { rect: [0, 0, 35, 8],  enc: 'north' },
    ],
    rows: [
      'MMMMMMMMMMMMMMMMMMMMMMMMM~~~~~~~~~~~',
      'MMMMMMMMMMMMMM%%%%%%%MMMM~~~~~~~~~~~',
      'MMMMMMMMMMMMMM%%%<%%%MMMM~~~~~~~~~~~',
      'MMTTTTTTMMMMMM%%%,%%%MMMM~~~~~~~~~~~',
      'MT......TMMMM...,,...MMMM~~~~~~~~~~~',
      'MT..TT....MM....,....MM.MM~~~~~~~~~~',
      'MT..TT..........,.........~~~~~~~~~~',
      'MT......TT......,......T...~~~~~~~~~',
      'MT....T.TT......,......TT...~~~~~~~~',
      'M.T......MMM....,...MMM......~~~~~~~',
      'M........MMMM...,..MMMMM....s~~~~~~~',
      'M..TT...MMMMM...,..MMMMMM...ss~~~~~~',
      'M..TT..MMMM.....,...MMMMM....s~~~~~~',
      'M.....MMMM....,,,....MMMM....ss~~~~~',
      'M....MMMM..,,,.M<M....MMM.....s~~~~~',
      'M....MMM..,....MMMM....MM.....ss~~~~',
      'M..,,,,,,,,.....MM.............s~~~~',
      'M..,......T.....M......,,,,,...ss~~~',
      'M..,..TT..TT..........,,...,,...s~~~',
      'M..,..TT...T.....T...,,.....,,..s~~~',
      'M..,..............,,,........,,s~~~~',
      'M..,,..T....T....,,.....T......,s~~~',
      'M...,,...T.....,,,....TT.......,s~~~',
      'M....,,,,,,,,,,,..............,,s~~~',
      'MT.......TT...........TT....,,..s~~~',
      'MTT....T.....T....T.........,...s~~~',
      'MMTT......TT.....TT....TT..,....s~~~',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM~~',
    ],
    exits: [
      { x: 3, y: 16, to: 'village', tx: 9, ty: 15, dir: 'up' },     // 村へ
      { x: 16, y: 14, to: 'cave', tx: 11, ty: 19, dir: 'up' },      // 洞窟へ
      { x: 31, y: 20, to: 'port', tx: 1, ty: 8, dir: 'right' },     // 港町へ
      { x: 17, y: 2, to: 'castle', tx: 14, ty: 21, dir: 'up' },     // 冥晶城へ
    ],
    objects: [
      // 城門の結界（蒼の紋章で解除）
      { type: 'barrier', x: 16, y: 4, flag: 'barrier_down' },
      { type: 'barrier', x: 17, y: 4, flag: 'barrier_down' },
      { type: 'barrier', x: 18, y: 4, flag: 'barrier_down' },
    ],
    npcs: [],
  },

  // ======== リーフの村 ========
  village: {
    name: 'リーフの村', pad: 'T', bgm: 'town', town: true,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T......RRRR....BBBB....T',
      'T..f...RRRR....BBBB..f.T',
      'T......hDhh....hhDh....T',
      'T..,,,,,,,,,,,,,,,,,...T',
      'T..,....f......f...,...T',
      'T..,...RRRRR.......,...T',
      'T..,...RRRRR..W....,...T',
      'T..,...hhDhh.......,...T',
      'T..,,,,,,,,,,,,,,,,,...T',
      'T..,....c......F...,...T',
      'T..,....,......F...,..fT',
      'T..f....,..S...........T',
      'T...,,,,,,,,,,,,,,,....T',
      'TT.......,.........f...T',
      'TTT......,..........TTTT',
      'TTTT.....,.........TTTTT',
      'TTTTTTTTT,TTTTTTTTTTTTTT',
    ],
    exits: [
      { x: 9, y: 17, to: 'world', tx: 3, ty: 17, dir: 'down' },
    ],
    objects: [
      { type: 'chest', id: 'vc1', x: 21, y: 5, gold: 30 },
    ],
    npcs: [
      { id: 'elder', x: 8, y: 4, pal: 'elder', dir: 'down', name: '村長オルバ' },
      { id: 'mina', x: 5, y: 6, pal: 'woman', dir: 'down', name: '薬師ミナ' },
      { id: 'rina_npc', x: 10, y: 13, pal: 'rina', dir: 'down', name: 'リナ', hideFlag: 'rina_joined' },
      { id: 'v_shop', x: 8, y: 11, pal: 'merchant', dir: 'down', name: '道具屋' },
      { id: 'v_inn', x: 17, y: 4, pal: 'villager', dir: 'down', name: '宿屋の主人' },
      { id: 'v_kid', x: 15, y: 7, pal: 'kid', dir: 'left', name: '少年ピノ', wander: true },
      { id: 'v_man', x: 12, y: 5, pal: 'villager', dir: 'down', name: '村人', wander: true },
      { id: 'v_sign', x: 11, y: 12, sign: true, name: '立て札' },
    ],
  },

  // ======== 港町ミラル ========
  port: {
    name: '港町ミラル', pad: 'T', bgm: 'town', town: true,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T....RRRR...RRRR...BBBB..T',
      'T.f..RRRR...RRRR...BBBB..T',
      'T....hDhh...hhDh...hhDh..T',
      'T....,,,,,,,,,,,,,,,,,...T',
      'T....,..c......c....,....T',
      'T....,..,......,....,..f.T',
      'T....,,,,,,,,,,,,,,,,....T',
      ',,,,,,...f........,......T',
      'T....,............,...S..T',
      'T....,,,,,,,,,,,,,,,,,...T',
      'Tssssssssssssssssssss,sssT',
      'Tsssssssssssssssssssss,ssT',
      'Tsswwwwwwwwwwwwwwwsssss,sT',
      'T~~wwwwwwwwwwwwwww~~~~~~~T',
      'T~~~~~~~~~~~~~~~~~~~~~~~~T',
      'T~~~~~~~~~~~~~~~~~~~~~~~~T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    exits: [
      { x: 0, y: 8, to: 'world', tx: 30, ty: 20, dir: 'left' },
    ],
    objects: [
      { type: 'chest', id: 'pc1', x: 23, y: 12, item: 'herb2' },
    ],
    npcs: [
      { id: 'gald_npc', x: 8, y: 13, pal: 'gald', dir: 'down', name: 'ガルド', hideFlag: 'gald_joined' },
      { id: 'p_mother', x: 20, y: 4, pal: 'woman', dir: 'right', name: 'マーサ' },
      { id: 'p_girl', x: 22, y: 4, pal: 'kid', dir: 'left', name: '少女エマ' },
      { id: 'p_itemshop', x: 8, y: 6, pal: 'merchant', dir: 'down', name: '道具屋' },
      { id: 'p_weaponshop', x: 15, y: 6, pal: 'merchant', dir: 'down', name: '武具屋' },
      { id: 'p_inn', x: 6, y: 4, pal: 'villager', dir: 'down', name: '宿屋の女将' },
      { id: 'p_captain', x: 14, y: 13, pal: 'pirate', dir: 'down', name: '船長バルク', wander: true },
      { id: 'p_man', x: 12, y: 8, pal: 'villager', dir: 'down', name: '町人', wander: true },
      { id: 'p_sign', x: 22, y: 9, sign: true, name: '立て札' },
    ],
  },

  // ======== 古の洞窟 ========
  cave: {
    name: '古の洞窟', pad: '%', bgm: 'dungeon',
    zones: [{ rect: [0, 0, 25, 21], enc: 'cave' }],
    rows: [
      '%%%%%%%%%%%%%%%%%%%%%%%%%%',
      '%%%%%%%%%dddddd%%%%%%%%%%%',
      '%%%%%%%%ddddddddd%%%%%%%%%',
      '%%%%%%%ddd*dd*ddd%%%%%%%%%',
      '%%%%%%%ddddddddd%%%%%%%%%%',
      '%%%%%%%%dddddddd%%%%%%%%%%',
      '%%%%%%%%%%ddd%%%%%%%%%%%%%',
      '%%%%%%%%%%ddd%%%%%%%%%%%%%',
      '%%%%%%%%%%%d%%%%%%%%%%%%%%',
      '%%ddddd%%%%d%%%%%ddddd%%%%',
      '%%ddddd%%%dd%%%%%ddddd%%%%',
      '%%ddddddddddd%%%%ddddd%%%%',
      '%%ddddd%%%%dd%%%%%%dd%%%%%',
      '%%ddddd%%%%%d%%%%%%dd%%%%%',
      '%%%%%dd%%%%%dddddddddd%%%%',
      '%%%%%%dd%%%%d%%%%%%%%%%%%%',
      '%%%%%%%dddddd%%%%%%%%%%%%%',
      '%%%%%%%%%%%d%%%%%%%%%%%%%%',
      '%%%%%%%%%%ddd%%%%%%%%%%%%%',
      '%%%%%%%%%%d<d%%%%%%%%%%%%%',
      '%%%%%%%%%%ddd%%%%%%%%%%%%%',
      '%%%%%%%%%%%%%%%%%%%%%%%%%%',
    ],
    exits: [
      { x: 11, y: 19, to: 'world', tx: 16, ty: 13, dir: 'down' },
    ],
    objects: [
      { type: 'chest', id: 'cc_key', x: 3, y: 10, item: 'cavekey' },   // 西の部屋: カギ
      { type: 'chest', id: 'cc_g', x: 4, y: 12, gold: 120 },
      { type: 'chest', id: 'cc_seed', x: 20, y: 10, item: 'seed' },    // 東の部屋
      { type: 'chest', id: 'cc_herb', x: 18, y: 11, item: 'herb2' },
      { type: 'lockdoor', id: 'cd1', x: 11, y: 8, flag: 'cave_door_open' }, // 北へ続く扉
      { type: 'chest', id: 'cc_crest', x: 12, y: 3, item: 'crest', needFlag: 'cave_boss_down' }, // 紋章
      { type: 'event', id: 'cave_boss', x: 10, y: 5, w: 3, h: 1, flagNot: 'cave_boss_down', bossArt: 'rockdragon' }, // 中ボス
    ],
    npcs: [],
  },

  // ======== 冥晶城 ========
  castle: {
    name: '冥晶城', pad: '%', bgm: 'dungeon',
    zones: [{ rect: [0, 0, 27, 23], enc: 'castle' }],
    rows: [
      '%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
      '%%%%%%%%%dddddddddd%%%%%%%%%',
      '%%%%%%%%%d*dddddd*d%%%%%%%%%',
      '%%%%%%%%%dddddddddd%%%%%%%%%',
      '%%%%%%%%%ddd++++ddd%%%%%%%%%',
      '%%%%%%%%%ddd++++ddd%%%%%%%%%',
      '%%%%%%%%%d*dddddd*d%%%%%%%%%',
      '%%%%%%%%%%%%dddd%%%%%%%%%%%%',
      '%%%%%%%%%%%%dddd%%%%%%%%%%%%',
      '%%ddddddd%%%dddd%%%ddddddd%%',
      '%%ddddddd%%%dddd%%%ddddddd%%',
      '%%ddddddddddddddddddddddd%%%',
      '%%ddddddd%%%dddd%%%ddddddd%%',
      '%%ddddddd%%%dddd%%%ddddddd%%',
      '%%ddddddd%%%dddd%%%ddddddd%%',
      '%%%%%%%%%%%%dddd%%%%%%%%%%%%',
      '%%%%%%%%%%%%dddd%%%%%%%%%%%%',
      '%%%%%%%%%%%ddddddd%%%%%%%%%%',
      '%%%%%%%%%%%ddddddd%%%%%%%%%%',
      '%%%%%%%%%%%dd*d*dd%%%%%%%%%%',
      '%%%%%%%%%%%ddddddd%%%%%%%%%%',
      '%%%%%%%%%%%%%dd%%%%%%%%%%%%%',
      '%%%%%%%%%%%%%dd%%%%%%%%%%%%%',
      '%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    ],
    exits: [
      { x: 13, y: 22, to: 'world', tx: 17, ty: 5, dir: 'down' },
      { x: 14, y: 22, to: 'world', tx: 17, ty: 5, dir: 'down' },
    ],
    objects: [
      // 押し岩パズル: 左右の部屋のスイッチに岩を載せると中央の門が開く
      { type: 'rock', id: 'rock_l', x: 5, y: 11 },
      { type: 'rock', id: 'rock_r', x: 22, y: 11 },
      { type: 'switch', id: 'sw_l', x: 4, y: 13 },
      { type: 'switch', id: 'sw_r', x: 23, y: 13 },
      { type: 'gate', id: 'castle_gate', x: 12, y: 8, flag: 'castle_gate_open' },
      { type: 'gate', id: 'castle_gate2', x: 13, y: 8, flag: 'castle_gate_open' },
      { type: 'gate', id: 'castle_gate3', x: 14, y: 8, flag: 'castle_gate_open' },
      { type: 'gate', id: 'castle_gate4', x: 15, y: 8, flag: 'castle_gate_open' },
      { type: 'chest', id: 'kc_sword', x: 3, y: 9, item: 'w_star' },
      { type: 'chest', id: 'kc_armor', x: 24, y: 9, item: 'a_star' },
      { type: 'chest', id: 'kc_elixir', x: 12, y: 19, item: 'elixir' },
      { type: 'chest', id: 'kc_elixir2', x: 16, y: 19, item: 'elixir' },
      { type: 'event', id: 'zarva_boss', x: 12, y: 4, w: 4, h: 1, flagNot: 'zarva_defeated', bossArt: 'zarva' }, // 玉座
    ],
    npcs: [],
  },
};

// ---------- イベントスクリプト（NPC会話・イベント） ----------
// field.js の runScript が解釈する。op一覧:
// say/choice/iff/set/give/takeItem/gold/join/healAll/inn/shop/battle/warp/sfx/ending
const EVENTS = {
  // ===== リーフの村 =====
  elder(G) {
    if (G.flags.zarva_defeated) return [
      { say: '光が大陸に戻った……。アレン、リナ、ガルド。\n君たちはこの村の、いや大陸の誇りじゃ。', name: '村長オルバ' },
    ];
    if (!G.flags.met_elder) return [
      { say: 'おお、アレン。よく来てくれた。\n近ごろ魔物が増えたのは知っておるな。', name: '村長オルバ' },
      { say: '大陸を照らす「星核」が砕かれ、北の冥晶城に\n「冥晶王ザルヴァ」が現れたのじゃ。', name: '村長オルバ' },
      { say: 'ザルヴァを討ち、星核の欠片「蒼の紋章」を\n取り戻せるのは星灯の血を継ぐお前だけじゃ。', name: '村長オルバ' },
      { say: 'まずは東の「古の洞窟」へ向かいなさい。\n紋章は洞窟の主が守っておるはず。', name: '村長オルバ' },
      { say: '村の入口でリナが待っておる。\n一緒に連れて行くがよい。', name: '村長オルバ' },
      { set: ['met_elder', true] },
    ];
    if (!G.flags.rina_joined) return [
      { say: 'リナが村の南で待っておるぞ。\n声をかけてやりなさい。', name: '村長オルバ' },
    ];
    if (!G.flags.cave_boss_down) return [
      { say: '東の洞窟の奥に「蒼の紋章」があるはずじゃ。\n扉の鍵は洞窟のどこかに……気をつけてな。', name: '村長オルバ' },
    ];
    return [
      { say: '紋章を手に入れたか！ ならば北の冥晶城へ。\n城門の結界は紋章が破ってくれるはずじゃ。', name: '村長オルバ' },
      { say: '東の港町ミラルに、わしの旧友の騎士ガルドが\nおる。力を貸してくれるじゃろう。', name: '村長オルバ' },
    ];
  },
  mina(G) {
    if (G.flags.sq_accepted && !G.flags.sq_medicine) return [
      { say: 'ミラルのエマちゃんが病気ですって？\nそれは「銀星熱」ね。すぐ特効薬を作るわ。', name: '薬師ミナ' },
      { say: '……できた！ さあ、これをエマちゃんに\n届けてあげて。急いでね。', name: '薬師ミナ' },
      { give: 'medicine' },
      { set: ['sq_medicine', true] },
    ];
    if (G.flags.sq_medicine && !G.flags.sq_done) return [
      { say: '特効薬は渡したわね。\n早くミラルのエマちゃんへ届けてあげて。', name: '薬師ミナ' },
    ];
    if (G.flags.sq_done) return [
      { say: 'エマちゃん、元気になったのね。\n薬師としてこんなに嬉しいことはないわ。', name: '薬師ミナ' },
    ];
    return [
      { say: '私は薬師のミナ。怪我をしたら「やくそう」、\n毒には「どくけし草」よ。道具屋で買えるわ。', name: '薬師ミナ' },
    ];
  },
  rina_npc(G) {
    if (!G.flags.met_elder) return [
      { say: 'アレン、村長さんが呼んでたよ。\n広場の北の家にいるから行ってあげて。', name: 'リナ' },
    ];
    return [
      { say: '村長さんから聞いたわ。洞窟に行くんでしょ？\n私の魔法、きっと役に立つから！', name: 'リナ' },
      { choice: [
        { label: '一緒に行こう', then: [
          { join: 'rina' },
          { set: ['rina_joined', true] },
          { say: 'ふふ、まかせて！\n炎の魔法なら任せてよね。', name: 'リナ' },
        ]},
        { label: 'まだ準備がある', then: [
          { say: 'わかった。準備ができたら声をかけてね。', name: 'リナ' },
        ]},
      ]},
    ];
  },
  v_shop: [{ shop: 'village_shop' }],
  v_inn(G) { return [{ inn: 10 }]; },
  v_kid(G) {
    if (G.flags.zarva_defeated) return [{ say: 'おにいちゃんたち、ゆうしゃさまなんだろ!?\nぼくも大きくなったら冒険するんだ！', name: '少年ピノ' }];
    return [{ say: '夜になると北の空がむらさき色に光るんだ。\nこわいから早く何とかしてよね！', name: '少年ピノ' }];
  },
  v_man(G) {
    if (!G.flags.cave_boss_down) return [{ say: '東の洞窟には昔の宝が眠ってるらしい。\nでも奥の扉は鍵がないと開かないって話だ。', name: '村人' }];
    return [{ say: '港町ミラルはここから東へ。橋を渡って\n海沿いを行けば着くよ。', name: '村人' }];
  },
  v_sign: [{ say: '【リーフの村】\n北:村長の家　西:薬師の家　南:大陸へ' }],

  // ===== 港町ミラル =====
  gald_npc(G) {
    if (!G.flags.cave_boss_down) return [
      { say: '俺はガルド。元エルディア騎士団の騎士だ。\n……星核が砕けて以来、酒が不味くてかなわん。', name: 'ガルド' },
      { say: '冥晶城へ行く気か？ 結界を破る「蒼の紋章」も\n持たずに行っても、犬死にするだけだぞ。', name: 'ガルド' },
    ];
    return [
      { say: 'その紋章……まさか洞窟の主を倒したのか。\nオルバ殿の言っていた星灯の子とはお前か！', name: 'ガルド' },
      { say: '冥晶城へ行くのだろう。この大戦斧と俺の盾、\n連れて行け。騎士の意地を見せる時だ。', name: 'ガルド' },
      { join: 'gald' },
      { set: ['gald_joined', true] },
      { say: 'よろしく頼む。メニューの「ならびかえ」で\n隊列も決めてくれ。先頭は狙われやすいぞ。', name: 'ガルド' },
    ];
  },
  p_mother(G) {
    if (G.flags.sq_done) return [
      { say: 'エマはすっかり元気になりました。\n本当に、本当にありがとうございます！', name: 'マーサ' },
    ];
    if (G.flags.sq_medicine) return [
      { say: 'それは……特効薬！？\nどうかエマに飲ませてやってください！', name: 'マーサ' },
      { takeItem: 'medicine' },
      { say: '……ああ、顔色が戻っていく……！\nありがとうございます。これはお礼です。', name: 'マーサ' },
      { gold: 800 },
      { give: 'acc_charm' },
      { set: ['sq_done', true] },
      { sfx: 'levelup' },
    ];
    if (G.flags.sq_accepted) return [
      { say: 'リーフの村の薬師ミナさんなら、銀星熱の\n特効薬を作れるはずです……お願いします。', name: 'マーサ' },
    ];
    return [
      { say: '娘のエマが「銀星熱」で寝込んでいるんです。\nリーフの村の薬師様なら薬を作れるはずですが、\n私は店を空けられなくて……', name: 'マーサ' },
      { choice: [
        { label: '薬を届けよう', then: [
          { set: ['sq_accepted', true] },
          { say: '本当ですか！ リーフの村の薬師ミナさんに\n「銀星熱の特効薬」とお伝えください！', name: 'マーサ' },
        ]},
        { label: '今は急いでいる', then: [
          { say: 'そう……ですよね。\n旅のお方に頼むことではありませんでした……', name: 'マーサ' },
        ]},
      ]},
    ];
  },
  p_girl(G) {
    if (G.flags.sq_done) return [{ say: 'おねえちゃんたちがくれた薬、にがかった！\nでももう元気だよ。ありがとう！', name: '少女エマ' }];
    return [{ say: 'けほ、けほ……からだが熱いの……', name: '少女エマ' }];
  },
  p_itemshop: [{ shop: 'port_item' }],
  p_weaponshop: [{ shop: 'port_weapon' }],
  p_inn(G) { return [{ inn: 25 }]; },
  p_captain(G) {
    if (G.flags.zarva_defeated) return [{ say: '北の空の紫の渦が消えた！\nお前さんたちの仕業か。大したもんだ！', name: '船長バルク' }];
    return [
      { say: '北の冥晶城か……。城門は紫の結界で\n覆われちまって、誰も近づけねえ。', name: '船長バルク' },
      { say: '古の紋章なら結界を破れるって話だがな。\n氷晶の精には炎、冥晶兵には雷がよく効くぜ。', name: '船長バルク' },
    ];
  },
  p_man: [{ say: '武具屋の騎士の剣は値が張るが物がいい。\n冥晶城に行くなら装備は整えておけよ。', name: '町人' }],
  p_sign: [{ say: '【港町ミラル】\n西:エルディア街道　南:港' }],

  // ===== 洞窟・城のイベント =====
  cave_boss(G) {
    return [
      { say: 'グルルル……ッ！\n岩陰から巨大な竜が現れた！' },
      { battle: { boss: 'rockdragon', bg: 'cave', onWin: [
        { say: '岩牙竜を倒した！\n奥の祭壇に何かが輝いている……' },
        { set: ['cave_boss_down', true] },
      ]}},
    ];
  },
  zarva_boss(G) {
    return [
      { say: 'よくぞここまで来た、星灯の末裔よ。\n余は冥晶王ザルヴァ。星核を砕きし者。', name: '冥晶王ザルヴァ' },
      { say: '星の灯は消えた。この大陸は永遠の\n薄明の中で、余と共に眠るのだ。', name: '冥晶王ザルヴァ' },
      { say: '余のバリアは晶色に応じて姿を変える。\n見抜けるか……その目で！', name: '冥晶王ザルヴァ' },
      { battle: { boss: 'zarva', bg: 'castle', onWin: [
        { say: 'バカな……余の冥晶が、砕けるなど……', name: '冥晶王ザルヴァ' },
        { say: 'ザルヴァの体から黒い霧が抜け、あとには\n大きな「冥晶核」が残された。' },
        { say: '冥晶核は禍々しく、しかし悲しげに明滅して\nいる。……どうする？' },
        { choice: [
          { label: '浄化する', then: [
            { set: ['ending_purify', true] },
            { say: '蒼の紋章をかざすと、冥晶核は静かに光を\n取り戻し、無数の星屑となって空へ昇った。' },
          ]},
          { label: '砕く', then: [
            { set: ['ending_purify', false] },
            { say: '剣を振り下ろすと冥晶核は砕け散り、\n破片は風に溶けるように消えていった。' },
          ]},
        ]},
        { set: ['zarva_defeated', true] },
        { ending: true },
      ]}},
    ];
  },

  // 城門の結界に触れたとき
  world_barrier(G) {
    if (G.flags.cave_boss_down && G.hasItem('crest')) return [
      { say: '蒼の紋章が強く輝き出した！' },
      { sfx: 'barrier' },
      { say: '結界は音もなく砕け、城への道が開かれた。' },
      { set: ['barrier_down', true] },
    ];
    return [
      { say: '紫の結界が行く手を阻んでいる。\nこれを破るには「蒼の紋章」が必要なようだ。' },
    ];
  },
};

// ---------- クエストログ（フラグから生成） ----------
function questLog(G) {
  const list = [];
  const f = G.flags;
  // メイン
  let main;
  if (f.zarva_defeated) main = '冥晶王を討伐した。大陸に光が戻った！';
  else if (f.barrier_down) main = '冥晶城の最深部で冥晶王ザルヴァを討て。';
  else if (f.cave_boss_down) main = '蒼の紋章を手に北の冥晶城へ。港町ミラルの騎士ガルドを訪ねよう。';
  else if (f.rina_joined) main = '東の「古の洞窟」で蒼の紋章を探せ。奥の扉には鍵がいるらしい。';
  else if (f.met_elder) main = '村の南で待つリナに声をかけ、仲間にしよう。';
  else main = 'リーフの村の村長オルバに話を聞こう。';
  list.push({ kind: 'main', text: main });
  // サイド
  if (f.sq_accepted && !f.sq_done) {
    list.push({ kind: 'side', text: f.sq_medicine
      ? '特効薬を港町ミラルのマーサに届けよう。'
      : 'リーフの村の薬師ミナに「銀星熱の特効薬」を頼もう。' });
  } else if (f.sq_done) {
    list.push({ kind: 'side', text: 'エマを銀星熱から救った。（達成）' });
  }
  return list;
}

// Node検証用エクスポート（ブラウザでは無視される）
if (typeof module !== 'undefined') {
  module.exports = { MAPS, TILE_DEF, ENEMIES, ENCOUNTERS, ITEMS, EQUIPS, SKILLS, CHARACTERS, EVENTS, EXP_TABLE, SHOPS };
}
