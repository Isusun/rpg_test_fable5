// ============================================================
// エンジン中核: PIXI初期化 / 入力 / ステートマシン / セーブ / パーティ計算
// ============================================================
'use strict';

const VIEW_W = 480, VIEW_H = 320;
const SAVE_KEY = 'seitou_save_v1';
const SETTINGS_KEY = 'seitou_settings_v1';
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 乱数ユーティリティ ----------
const rnd = (n) => Math.floor(Math.random() * n);
const rndf = () => Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickWeighted = (list) => {
  const total = list.reduce((s, o) => s + o.w, 0);
  let r = rndf() * total;
  for (const o of list) { r -= o.w; if (r <= 0) return o; }
  return list[list.length - 1];
};

// ---------- 入力 ----------
const Input = (() => {
  const held = { up: false, down: false, left: false, right: false, a: false, b: false };
  let listeners = [];
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', Enter: 'a', Space: 'a',
    KeyX: 'b', Escape: 'b', Backspace: 'b',
  };
  function press(btn) {
    AudioSys.unlock();
    for (const fn of listeners) fn(btn);
  }
  window.addEventListener('keydown', (e) => {
    const btn = KEYMAP[e.code];
    if (!btn) return;
    e.preventDefault();
    if (!held[btn]) { held[btn] = true; press(btn); }
  });
  window.addEventListener('keyup', (e) => {
    const btn = KEYMAP[e.code];
    if (btn) held[btn] = false;
  });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

  // タッチボタン
  function bindTouch(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => { e.preventDefault(); if (!held[btn]) { held[btn] = true; press(btn); } };
    const up = (e) => { e.preventDefault(); held[btn] = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }
  function initTouch() {
    bindTouch('t-up', 'up'); bindTouch('t-down', 'down');
    bindTouch('t-left', 'left'); bindTouch('t-right', 'right');
    bindTouch('t-a', 'a'); bindTouch('t-b', 'b');
    const m = document.getElementById('t-menu');
    if (m) m.addEventListener('pointerdown', (e) => { e.preventDefault(); press('menu'); });
  }
  function on(fn) { listeners.push(fn); }
  function clearListeners() { listeners = []; }
  return { held, on, clearListeners, initTouch, press };
})();

// ---------- 設定 ----------
const Settings = (() => {
  let s = { bgm: false, sfx: false, volume: 0.7, touch: null }; // touch:null=自動判定
  function load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') s = { ...s, ...p };
      }
    } catch (e) { /* 壊れていてもデフォルトで続行 */ }
    apply();
  }
  function save() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 保存不可でも続行 */ }
  }
  function apply() {
    AudioSys.setSettings({ bgm: s.bgm, sfx: s.sfx, volume: s.volume });
    const touchEl = document.getElementById('touch');
    const wantTouch = s.touch === null ? window.matchMedia('(pointer: coarse)').matches : s.touch;
    touchEl.classList.toggle('hidden', !wantTouch);
  }
  function set(k, v) { s[k] = v; apply(); save(); }
  function get() { return { ...s }; }
  return { load, set, get };
})();

// ---------- パーティメンバー ----------
function makeMember(id, level = 1) {
  const c = CHARACTERS[id];
  const m = {
    id, level,
    exp: EXP_TABLE[level] || 0,
    equips: { ...c.initEquip },
    status: {},        // { poison: true } フィールドにも持ち越す
    perm: { atk: 0 },  // ちからのたね等
    hp: 0, mp: 0,
  };
  m.hp = maxHp(m); m.mp = maxMp(m);
  return m;
}
function growthStat(m, key) {
  const [base, per] = CHARACTERS[m.id].growth[key];
  return Math.floor(base + per * (m.level - 1));
}
function equipBonus(m, key) {
  let v = 0;
  for (const slot of ['weapon', 'armor', 'acc']) {
    const eid = m.equips[slot];
    if (eid && EQUIPS[eid]) v += EQUIPS[eid][key] || 0;
  }
  return v;
}
function maxHp(m) { return growthStat(m, 'hp'); }
function maxMp(m) { return growthStat(m, 'mp'); }
function statOf(m, key) {
  return Math.max(0, growthStat(m, key) + equipBonus(m, key) + (m.perm[key] || 0));
}
function memberName(m) { return CHARACTERS[m.id].name; }
function memberSkills(m) {
  const byLv = CHARACTERS[m.id].skillsByLevel;
  return Object.keys(byLv).filter(lv => m.level >= +lv).map(lv => byLv[lv]);
}
function isImmune(m, status) {
  for (const slot of ['weapon', 'armor', 'acc']) {
    const eid = m.equips[slot];
    if (eid && EQUIPS[eid] && (EQUIPS[eid].immune || []).includes(status)) return true;
  }
  return false;
}
// 経験値加算 → [{name, newLevel, learned:[skillName]}]
function gainExp(m, amount) {
  const before = m.level;
  m.exp += amount;
  const after = Math.min(MAX_LV, levelForExp(m.exp));
  if (after <= before) return null;
  const learned = [];
  const byLv = CHARACTERS[m.id].skillsByLevel;
  for (let L = before + 1; L <= after; L++) {
    if (byLv[L]) learned.push(SKILLS[byLv[L]].name);
  }
  const hpGain = (() => { const old = maxHp(m); m.level = after; return maxHp(m) - old; })();
  m.hp = clamp(m.hp + hpGain, 1, maxHp(m));
  m.mp = clamp(m.mp + 2, 0, maxMp(m));
  return { name: memberName(m), newLevel: after, learned };
}

// ---------- ゲーム状態 ----------
let G = null;

function newGameState() {
  return {
    party: [makeMember('alen', 1)],
    gold: 60,
    inv: { herb: 3 },
    flags: {},
    map: 'village', x: 9, y: 14, dir: 'down',
    lastTown: { map: 'village', x: 9, y: 14 },
    steps: 0, encGrace: 8,
    playSeconds: 0,
    hasItem(id) { return (this.inv[id] || 0) > 0; },
  };
}
function attachHelpers(g) {
  g.hasItem = function (id) { return (this.inv[id] || 0) > 0; };
  return g;
}
function addItem(id, n = 1) {
  G.inv[id] = (G.inv[id] || 0) + n;
  if (G.inv[id] > 99) G.inv[id] = 99;
}
function removeItem(id, n = 1) {
  if (!G.inv[id]) return;
  G.inv[id] -= n;
  if (G.inv[id] <= 0) delete G.inv[id];
}
function itemName(id) { return ITEMS[id] ? ITEMS[id].name : (EQUIPS[id] ? EQUIPS[id].name : '？？？'); }

// ---------- セーブ／ロード ----------
const SaveSys = {
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  },
  save() {
    try {
      const data = {
        v: 1,
        party: G.party, gold: G.gold, inv: G.inv, flags: G.flags,
        map: G.map, x: G.x, y: G.y, dir: G.dir,
        lastTown: G.lastTown, playSeconds: Math.floor(G.playSeconds),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      // 妥当性チェック（壊れたセーブからの安全な復帰）
      if (!d || d.v !== 1 || !Array.isArray(d.party) || d.party.length === 0) return null;
      if (!MAPS[d.map]) return null;
      for (const m of d.party) {
        if (!CHARACTERS[m.id] || typeof m.level !== 'number') return null;
        m.level = clamp(Math.floor(m.level), 1, MAX_LV);
        m.exp = Math.max(0, +m.exp || 0);
        m.status = m.status && typeof m.status === 'object' ? m.status : {};
        m.perm = m.perm && typeof m.perm === 'object' ? m.perm : { atk: 0 };
        m.equips = m.equips && typeof m.equips === 'object' ? m.equips : { ...CHARACTERS[m.id].initEquip };
        m.hp = clamp(Math.floor(+m.hp || 1), 0, maxHp(m));
        m.mp = clamp(Math.floor(+m.mp || 0), 0, maxMp(m));
        if (m.hp <= 0) m.hp = 1;
      }
      const g = newGameState();
      g.party = d.party;
      g.gold = Math.max(0, Math.floor(+d.gold || 0));
      g.inv = (d.inv && typeof d.inv === 'object') ? d.inv : {};
      g.flags = (d.flags && typeof d.flags === 'object') ? d.flags : {};
      g.map = d.map;
      g.x = clamp(Math.floor(+d.x || 0), 0, 200);
      g.y = clamp(Math.floor(+d.y || 0), 0, 200);
      g.dir = ['up', 'down', 'left', 'right'].includes(d.dir) ? d.dir : 'down';
      g.lastTown = (d.lastTown && MAPS[d.lastTown.map]) ? d.lastTown : { map: 'village', x: 9, y: 14 };
      g.playSeconds = Math.max(0, +d.playSeconds || 0);
      return attachHelpers(g);
    } catch (e) { return null; }
  },
};

// ---------- ステートマシン ----------
const Game = (() => {
  const states = {};
  let current = null;
  let currentName = '';
  function register(name, state) { states[name] = state; }
  async function setState(name, arg) {
    if (current && current.exit) current.exit();
    currentName = name;
    current = states[name];
    if (current.enter) await current.enter(arg);
  }
  function update(dt) {
    if (G) G.playSeconds += dt;
    if (current && current.update) current.update(dt);
  }
  function onButton(btn) {
    if (current && current.onButton) current.onButton(btn);
  }
  return { register, setState, update, onButton, get name() { return currentName; } };
})();
Input.on((btn) => Game.onButton(btn));

// ---------- 画面フェード ----------
const Fx = {
  fadeEl: null,
  init() { this.fadeEl = document.getElementById('fade'); },
  fadeOut() {
    return new Promise((res) => {
      this.fadeEl.style.opacity = '1';
      setTimeout(res, REDUCED_MOTION ? 40 : 380);
    });
  },
  fadeIn() {
    return new Promise((res) => {
      this.fadeEl.style.opacity = '0';
      setTimeout(res, REDUCED_MOTION ? 40 : 380);
    });
  },
  flash(color = '#fff') {
    if (REDUCED_MOTION) return;
    this.fadeEl.style.transition = 'none';
    this.fadeEl.style.background = color;
    this.fadeEl.style.opacity = '0.55';
    setTimeout(() => {
      this.fadeEl.style.transition = '';
      this.fadeEl.style.opacity = '0';
      setTimeout(() => { this.fadeEl.style.background = '#000'; }, 400);
    }, 70);
  },
  shake(container) {
    if (REDUCED_MOTION || !container) return;
    let t = 0;
    const iv = setInterval(() => {
      t++;
      container.x = (t % 2 ? 3 : -3);
      if (t > 5) { clearInterval(iv); container.x = 0; }
    }, 35);
  },
  // ダメージ数字ポップ（DOM側 / 画面座標%指定）
  popup(xPct, yPct, text, cls = '') {
    const root = document.getElementById('dmgroot');
    const el = document.createElement('div');
    el.className = 'dmgnum ' + cls;
    el.textContent = text;
    el.style.left = xPct + '%';
    el.style.top = yPct + '%';
    el.style.transform = 'translateX(-50%)';
    root.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },
};

// ---------- PIXIアプリ ----------
let app = null;
const Layers = { field: null, battle: null };

async function initPixi() {
  app = new PIXI.Application();
  await app.init({
    width: VIEW_W, height: VIEW_H,
    background: '#05060f',
    antialias: false,
    roundPixels: true,
  });
  document.getElementById('pixi-holder').appendChild(app.canvas);
  app.canvas.style.position = 'absolute';
  app.canvas.style.inset = '0';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.imageRendering = 'pixelated';
  Layers.field = new PIXI.Container();
  Layers.battle = new PIXI.Container();
  Layers.battle.visible = false;
  app.stage.addChild(Layers.field, Layers.battle);
  app.ticker.add((t) => Game.update(t.deltaMS / 1000));
}

// UIスケール調整
function fitStage() {
  const stage = document.getElementById('stage');
  const w = stage.clientWidth;
  stage.style.setProperty('--s', (w / 480).toFixed(4));
}
window.addEventListener('resize', fitStage);
