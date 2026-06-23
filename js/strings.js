// ============================================================
// UI文言の一元管理（NPC会話・物語テキストは data.js 側に持つ）
// ============================================================
'use strict';

const T = {
  // タイトル
  newGame: 'はじめから',
  continueGame: 'つづきから',
  settings: '設定',
  noSaveData: 'セーブデータがありません。「はじめから」を選んでください。',
  brokenSave: 'セーブデータが壊れていたため、新しい冒険を始めます。',

  // メインメニュー
  menuItem: 'どうぐ',
  menuSkill: 'スキル',
  menuEquip: 'そうび',
  menuStatus: 'つよさ',
  menuFormation: 'ならびかえ',
  menuQuest: 'クエスト',
  menuSave: 'セーブ',
  menuSettings: '設定',
  menuClose: 'とじる',
  gold: (n) => `${n} G`,

  // セーブ／ロード
  saveDone: '冒険の記録をセーブしました。',
  saveFailed: 'セーブに失敗しました。ブラウザの保存領域を確認してください。',
  confirmOverwrite: '冒険の記録を上書きしますか？',
  yes: 'はい',
  no: 'いいえ',

  // 設定
  bgmLabel: 'BGM',
  sfxLabel: '効果音',
  volLabel: '音量',
  touchLabel: 'タッチ操作ボタン',
  on: 'ON',
  off: 'OFF',
  settingsHint: '※ 設定は自動で保存されます',

  // アイテム／装備
  itemEmpty: '持ち物は空です。お店で道具を買えます。',
  itemUseWho: 'だれに使いますか？',
  itemCantUseHere: 'ここでは使えません。',
  itemNoEffect: 'しかし 何も起こらなかった。',
  equipWho: 'だれの装備を変えますか？',
  equipSlotWeapon: 'ぶき',
  equipSlotArmor: 'よろい',
  equipSlotAcc: 'かざり',
  equipNone: '（なし）',
  equipRemove: 'はずす',
  cannotEquip: (n) => `${n} はそれを装備できません。`,
  equipped: (n, i) => `${n} は ${i} を装備した。`,
  removed: (n, i) => `${n} は ${i} をはずした。`,

  // スキル
  skillWho: 'だれのスキル？',
  skillNoSkills: 'まだスキルを覚えていません。',
  skillNoMp: 'MPが足りません。',
  skillCantField: 'そのスキルは戦闘中しか使えません。',

  // ならびかえ
  formationHint: '入れ替える2人を順に選んでください。先頭ほど狙われやすくなります。',
  formationDone: '隊列を入れ替えました。',

  // クエスト
  questMain: '【メイン】',
  questSide: '【サイド】',
  questNone: '受けているクエストはありません。',

  // フィールド
  chestGet: (i) => `たからばこを開けた！\n${i} を手に入れた！`,
  chestEmpty: 'たからばこは空っぽだった。',
  doorLocked: '扉には鍵がかかっている。',
  doorUnlock: '洞窟のカギを使った！\n扉が開いた。',
  rockPushed: 'ゴゴゴ…… 岩が動いた。',
  rockBlocked: '岩はそれ以上動かない。',
  switchOn: 'カチッ……どこかで扉が開く音がした！',
  nothingThere: 'そこには何もない。',
  poisonStep: (n) => `${n} は毒に苦しんでいる……`,

  // 宿屋・店
  innAsk: (cost) => `一晩 ${cost}G ですが、お泊まりになりますか？`,
  innDone: 'おはようございます。皆さんすっかり元気になりましたよ！',
  innNoMoney: 'お金が足りないようですね……またのお越しを。',
  shopBuy: '買う',
  shopSell: '売る',
  shopLeave: 'やめる',
  shopWhatBuy: 'いらっしゃい！ 何を買いますか？',
  shopWhatSell: '何を売ってくれるんだい？',
  shopGotIt: (i) => `${i} を買った！`,
  shopSold: (i, g) => `${i} を ${g}G で売った。`,
  shopNoMoney: 'お金が足りないよ。',
  shopNoItems: '売れる物を持っていないようだね。',
  shopCantSell: 'それは大事な物だから売れないよ。',
  shopBagFull: 'それ以上は持てないよ。',
  priceTag: (n) => `${n}G`,
  ownedTag: (n) => `所持:${n}`,

  // 戦闘
  battleStart: (n) => `${n} が現れた！`,
  battleStartMulti: '魔物の群れが現れた！',
  cmdAttack: 'たたかう',
  cmdSkill: 'スキル',
  cmdItem: 'どうぐ',
  cmdGuard: 'ぼうぎょ',
  cmdRun: 'にげる',
  attackMsg: (n) => `${n} のこうげき！`,
  guardMsg: (n) => `${n} は身を守っている。`,
  runTry: '逃げ出した！',
  runFail: 'しかし回り込まれてしまった！',
  runNoBoss: 'この敵からは逃げられない！',
  critical: '会心の一撃！！',
  missMsg: 'ミス！ 攻撃は当たらなかった。',
  damageTo: (n, d) => `${n} に ${d} のダメージ！`,
  damageToWeak: (n, d) => `弱点を突いた！ ${n} に ${d} のダメージ！`,
  damageToResist: (n, d) => `効きが悪い…… ${n} に ${d} のダメージ。`,
  healMsg: (n, d) => `${n} のHPが ${d} 回復した！`,
  mpHealMsg: (n, d) => `${n} のMPが ${d} 回復した！`,
  enemyDown: (n) => `${n} を倒した！`,
  allyDown: (n) => `${n} は力尽きた……`,
  poisoned: (n) => `${n} は毒におかされた！`,
  poisonDmg: (n, d) => `${n} は毒で ${d} のダメージ！`,
  poisonCured: (n) => `${n} の毒が消えた。`,
  sleeping: (n) => `${n} は眠ってしまった！`,
  sleepSkip: (n) => `${n} はぐっすり眠っている……`,
  wokeUp: (n) => `${n} は目を覚ました！`,
  alreadyStatus: 'しかし 効かなかった！',
  atkUpMsg: (n) => `${n} の攻撃力が上がった！`,
  defUpMsg: (n) => `${n} の守備力が上がった！`,
  statusFade: (n, s) => `${n} の${s}の効果が切れた。`,
  victory: '魔物をやっつけた！',
  gotExpGold: (e, g) => `${e} の経験値と ${g}G を手に入れた！`,
  levelUp: (n, l) => `${n} はレベル ${l} に上がった！`,
  learnedSkill: (n, s) => `${n} は ${s} を覚えた！`,
  gotDrop: (i) => `魔物は ${i} を落としていった！`,
  defeat: '全滅してしまった……',
  defeatRevive: '……気がつくと、見覚えのある宿の天井だった。\n（所持金が半分になった）',
  barrierShift: (e) => `冥晶のバリアが ${e} の色に輝いている……！`,
  barrierBreak: 'バリアが砕け散った！ 今が攻撃のチャンス！',
  barrierGuard: 'バリアが攻撃を弾いた！',
  bossEnrage: (n) => `${n} は怒り狂っている！`,

  // ステータス
  stHP: 'HP', stMP: 'MP',
  stAtk: 'ちから', stDef: 'まもり', stSpd: 'すばやさ', stMag: 'かしこさ',
  stLv: 'Lv', stExp: '経験値', stNext: '次のLvまで',
  stWeapon: 'ぶき', stArmor: 'よろい', stAcc: 'かざり',
  elemNames: { fire: '炎', ice: '氷', thunder: '雷', none: '無' },
  statusNames: { poison: '毒', sleep: '眠り', atkup: '攻+', defup: '守+' },

  // 操作ヘルプ
  helpField: '移動:矢印/WASD　調べる・話す:Z/Enter　メニュー:X/Esc',
  helpMenu: '選択:矢印　決定:Z/Enter　戻る:X/Esc',

  // その他
  obtained: (i) => `${i} を手に入れた！`,
  obtainedGold: (g) => `${g}G を手に入れた！`,
  partyJoin: (n) => `${n} が仲間に加わった！`,
  theEndA: '— 浄化の灯 編・完 —',
  theEndB: '— 断罪の刃 編・完 —',
  pressToTitle: '決定キーでタイトルへ',
};
