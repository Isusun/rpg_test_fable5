// ============================================================
// フィールド: マップ描画 / 移動 / NPC / オブジェクト / イベント実行
// ============================================================
'use strict';

const Field = (() => {
  const MOVE_SPEED = 84; // px/s

  let mapId = null;
  let map = null;
  let tileC = null, entC = null;          // タイル層 / エンティティ層
  let playerSpr = null;
  let npcSprs = [];                       // {npc, spr, hx, hy, t}
  let objSprs = {};                       // id -> sprite
  let moving = null;                      // {fx,fy,tx,ty,prog}
  let walkAnim = 0;
  let busy = false;                       // スクリプト実行中
  let stepsSincePoison = 0;

  // ---------- フラグキー ----------
  const chestKey = (id) => `chest_${mapId}_${id}`;
  const rockKey = (id) => `rockpos_${mapId}_${id}`;

  function tileAt(x, y) {
    if (!map || y < 0 || y >= map.rows.length || x < 0 || x >= map.rows[y].length) return null;
    return TILE_DEF[map.rows[y][x]] || null;
  }
  function rockAt(x, y) {
    for (const o of map.objects || []) {
      if (o.type !== 'rock') continue;
      const p = G.flags[rockKey(o.id)] || { x: o.x, y: o.y };
      if (p.x === x && p.y === y) return o;
    }
    return null;
  }
  function objAt(x, y, type) {
    for (const o of map.objects || []) {
      if (type && o.type !== type) continue;
      if (o.type === 'rock') continue;
      if (o.x === x && o.y === y) return o;
    }
    return null;
  }
  function npcAt(x, y) {
    for (const n of npcSprs) {
      if (n.npc.hideFlag && G.flags[n.npc.hideFlag]) continue;
      if (n.tx === x && n.ty === y) return n;
    }
    return null;
  }
  function isBlocked(x, y, forNpc = false) {
    const t = tileAt(x, y);
    if (!t || !t.walk) return true;
    const chest = objAt(x, y, 'chest');
    if (chest) return true;
    const door = objAt(x, y, 'lockdoor');
    if (door && !G.flags[door.flag]) return true;
    const gate = objAt(x, y, 'gate');
    if (gate && !G.flags[gate.flag]) return true;
    const barrier = objAt(x, y, 'barrier');
    if (barrier && !G.flags[barrier.flag]) return true;
    if (rockAt(x, y)) return true;
    if (npcAt(x, y)) return true;
    if (forNpc && G.x === x && G.y === y) return true;
    if (forNpc && objAt(x, y, 'event')) return true;
    return false;
  }

  // ---------- マップ構築 ----------
  function build() {
    Layers.field.removeChildren();
    tileC = new PIXI.Container();
    entC = new PIXI.Container();
    Layers.field.addChild(tileC, entC);
    npcSprs = []; objSprs = {};

    for (let y = 0; y < map.rows.length; y++) {
      for (let x = 0; x < map.rows[y].length; x++) {
        const t = TILE_DEF[map.rows[y][x]];
        if (!t) continue;
        const s = new PIXI.Sprite(GFX.tileTex[t.tex]);
        s.x = x * TILE; s.y = y * TILE;
        tileC.addChild(s);
      }
    }
    // オブジェクト
    for (const o of map.objects || []) {
      let texName = null;
      if (o.type === 'chest') texName = G.flags[chestKey(o.id)] ? 'chestOpen' : 'chest';
      else if (o.type === 'lockdoor') texName = G.flags[o.flag] ? null : 'lockdoor';
      else if (o.type === 'gate') texName = G.flags[o.flag] ? null : 'gate';
      else if (o.type === 'barrier') texName = G.flags[o.flag] ? null : 'crystal';
      else if (o.type === 'rock') texName = 'rock';
      else if (o.type === 'switch') texName = 'switchOff';
      if (!texName) continue;
      const s = new PIXI.Sprite(GFX.tileTex[texName]);
      if (o.type === 'rock') {
        const p = G.flags[rockKey(o.id)] || { x: o.x, y: o.y };
        s.x = p.x * TILE; s.y = p.y * TILE;
        entC.addChild(s);
      } else {
        s.x = o.x * TILE; s.y = o.y * TILE;
        (o.type === 'switch' ? tileC : entC).addChild(s);
      }
      objSprs[o.id] = s;
    }
    // ボスのフィールド上の姿
    for (const o of map.objects || []) {
      if (o.type !== 'event' || !o.bossArt) continue;
      if (o.flagNot && G.flags[o.flagNot]) continue;
      const def = ENEMIES[o.bossArt];
      const s = new PIXI.Sprite(GFX.enemyTexture(def.art, 32));
      const w = o.w || 1;
      s.anchor.set(0.5, 1);
      s.x = (o.x + w / 2) * TILE;
      s.y = o.y * TILE; // イベント帯の1タイル上に立たせる
      entC.addChild(s);
      objSprs['boss_' + o.id] = s;
    }
    updateSwitchVisuals();
    // NPC
    for (const npc of map.npcs || []) {
      if (npc.sign) { // 立て札はタイルで表現済み（マップ上にSが無ければスプライト追加）
        npcSprs.push({ npc, spr: null, tx: npc.x, ty: npc.y });
        continue;
      }
      const spr = new PIXI.Sprite(GFX.charFrame(npc.pal, npc.dir || 'down', 0));
      spr.x = npc.x * TILE; spr.y = npc.y * TILE - 2;
      spr.visible = !(npc.hideFlag && G.flags[npc.hideFlag]);
      entC.addChild(spr);
      npcSprs.push({ npc, spr, tx: npc.x, ty: npc.y, hx: npc.x, hy: npc.y, t: 1 + rndf() * 2, dir: npc.dir || 'down' });
    }
    // プレイヤー
    playerSpr = new PIXI.Sprite(GFX.charFrame('hero', G.dir, 0));
    entC.addChild(playerSpr);
    setPlayerPixel(G.x * TILE, G.y * TILE);
    camera();
  }

  function updateSwitchVisuals() {
    for (const o of map.objects || []) {
      if (o.type !== 'switch') continue;
      const on = !!rockAt(o.x, o.y);
      if (objSprs[o.id]) objSprs[o.id].texture = GFX.tileTex[on ? 'switchOn' : 'switchOff'];
    }
  }

  function setPlayerPixel(px, py) {
    playerSpr.x = px; playerSpr.y = py - 2;
  }
  function camera() {
    const mw = map.rows[0].length * TILE, mh = map.rows.length * TILE;
    let cx = playerSpr.x + 8 - VIEW_W / 2;
    let cy = playerSpr.y + 8 - VIEW_H / 2;
    cx = clamp(cx, 0, Math.max(0, mw - VIEW_W));
    cy = clamp(cy, 0, Math.max(0, mh - VIEW_H));
    if (mw < VIEW_W) cx = (mw - VIEW_W) / 2;
    if (mh < VIEW_H) cy = (mh - VIEW_H) / 2;
    Layers.field.x = -Math.round(cx);
    Layers.field.y = -Math.round(cy);
  }

  // ---------- 移動 ----------
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tryMove(dir) {
    G.dir = dir;
    playerSpr.texture = GFX.charFrame('hero', dir, Math.floor(walkAnim));
    const [dx, dy] = DIRS[dir];
    const nx = G.x + dx, ny = G.y + dy;
    // 結界に触れる
    const bar = objAt(nx, ny, 'barrier');
    if (bar && !G.flags[bar.flag]) {
      runScript(EVENTS.world_barrier(G));
      return;
    }
    // 岩を押す
    const rock = rockAt(nx, ny);
    if (rock) {
      const bx = nx + dx, by = ny + dy;
      if (!isBlocked(bx, by) && !objAt(bx, by, 'event') && !isExit(bx, by)) {
        G.flags[rockKey(rock.id)] = { x: bx, y: by };
        objSprs[rock.id].x = bx * TILE; objSprs[rock.id].y = by * TILE;
        AudioSys.sfx('push');
        checkSwitches();
      }
      return;
    }
    if (isBlocked(nx, ny)) return;
    moving = { fx: G.x, fy: G.y, tx: nx, ty: ny, prog: 0 };
  }

  function isExit(x, y) {
    return (map.exits || []).find(e => e.x === x && e.y === y) || null;
  }

  function checkSwitches() {
    updateSwitchVisuals();
    const switches = (map.objects || []).filter(o => o.type === 'switch');
    if (!switches.length) return;
    const allOn = switches.every(o => rockAt(o.x, o.y));
    if (allOn && !G.flags.castle_gate_open) {
      G.flags.castle_gate_open = true;
      AudioSys.sfx('door');
      for (const o of map.objects) {
        if (o.type === 'gate' && objSprs[o.id]) objSprs[o.id].visible = false;
      }
      runScript([{ say: T.switchOn }]);
    }
  }

  async function onStepComplete() {
    G.x = moving.tx; G.y = moving.ty;
    moving = null;
    // 出口
    const exit = isExit(G.x, G.y);
    if (exit) { await gotoMap(exit.to, exit.tx, exit.ty, exit.dir); return; }
    // イベントタイル（ボス等）
    for (const o of map.objects || []) {
      if (o.type !== 'event') continue;
      if (o.flagNot && G.flags[o.flagNot]) continue;
      const w = o.w || 1, h = o.h || 1;
      if (G.x >= o.x && G.x < o.x + w && G.y >= o.y && G.y < o.y + h) {
        runScript(EVENTS[o.id](G));
        return;
      }
    }
    // 毒の歩行ダメージ
    G.steps++;
    if (++stepsSincePoison >= 4) {
      stepsSincePoison = 0;
      for (const m of G.party) {
        if (m.status.poison && m.hp > 1) {
          m.hp = Math.max(1, m.hp - Math.max(1, Math.floor(maxHp(m) * 0.04)));
          Fx.flash('#7a3fa0');
        }
      }
    }
    // エンカウント
    const zone = encounterZone();
    if (zone) {
      if (G.encGrace > 0) G.encGrace--;
      else if (rndf() < 1 / zone.rate) {
        G.encGrace = 3;
        const grp = pickWeighted(ENCOUNTERS[zone.enc].groups);
        busy = true;
        const result = await BattleSys.start({ enemies: grp.e, bg: ENCOUNTERS[zone.enc].bg, canRun: true });
        busy = false;
        await afterBattle(result);
      }
    }
  }

  function encounterZone() {
    if (!map.zones) return null;
    for (const z of map.zones) {
      const [x0, y0, x1, y1] = z.rect;
      if (G.x >= x0 && G.x <= x1 && G.y >= y0 && G.y <= y1) {
        if (z.cond && !z.cond(G.x, G.y)) continue;
        return { ...ENCOUNTERS[z.enc], enc: z.enc };
      }
    }
    return null;
  }

  async function afterBattle(result) {
    if (result === 'lose') {
      await Fx.fadeOut();
      G.gold = Math.floor(G.gold / 2);
      for (const m of G.party) { m.hp = maxHp(m); m.mp = maxMp(m); m.status = {}; }
      const t = G.lastTown;
      await gotoMap(t.map, t.x, t.y, 'down', true);
      await runScriptAsync([{ say: T.defeatRevive }]);
      return 'lose';
    }
    AudioSys.playBgm(map.bgm);
    return result;
  }

  // ---------- マップ遷移 ----------
  async function gotoMap(id, x, y, dir, skipFadeIn = false) {
    busy = true;
    await Fx.fadeOut();
    mapId = id; map = MAPS[id];
    G.map = id; G.x = x; G.y = y; G.dir = dir || 'down';
    if (map.town) G.lastTown = { map: id, x, y };
    moving = null;
    build();
    AudioSys.playBgm(map.bgm);
    UI.setHelp(T.helpField);
    await Fx.fadeIn();
    busy = false;
  }

  // ---------- 調べる／話す ----------
  function interact() {
    const [dx, dy] = DIRS[G.dir];
    const fx = G.x + dx, fy = G.y + dy;
    // NPC
    const n = npcAt(fx, fy);
    if (n) {
      if (n.spr) { // 向き合う
        const face = { up: 'down', down: 'up', left: 'right', right: 'left' }[G.dir];
        n.dir = face;
        n.spr.texture = GFX.charFrame(n.npc.pal, face, 0);
      }
      const ev = EVENTS[n.npc.id];
      if (ev) runScript(typeof ev === 'function' ? ev(G) : ev);
      return;
    }
    // チェスト
    const chest = objAt(fx, fy, 'chest');
    if (chest && !G.flags[chestKey(chest.id)]) {
      if (chest.needFlag && !G.flags[chest.needFlag]) return;
      G.flags[chestKey(chest.id)] = true;
      objSprs[chest.id].texture = GFX.tileTex.chestOpen;
      AudioSys.sfx('chest');
      if (chest.gold) {
        G.gold += chest.gold;
        runScript([{ say: T.chestGet(`${chest.gold}G`) }]);
      } else {
        addItem(chest.item);
        runScript([{ say: T.chestGet(itemName(chest.item)) }]);
      }
      return;
    }
    // 鍵扉
    const door = objAt(fx, fy, 'lockdoor');
    if (door && !G.flags[door.flag]) {
      if (G.hasItem('cavekey')) {
        G.flags[door.flag] = true;
        objSprs[door.id].visible = false;
        AudioSys.sfx('door');
        runScript([{ say: T.doorUnlock }]);
      } else {
        runScript([{ say: T.doorLocked }]);
      }
      return;
    }
    // 結界
    const bar = objAt(fx, fy, 'barrier');
    if (bar && !G.flags[bar.flag]) { runScript(EVENTS.world_barrier(G)); return; }
  }

  // ---------- イベントスクリプト実行 ----------
  function runScript(ops) { runScriptAsync(ops); }

  async function runScriptAsync(ops) {
    if (!ops || !ops.length) return;
    busy = true;
    try {
      await execOps(ops);
    } finally {
      busy = false;
      UI.setHelp(T.helpField);
    }
  }

  async function execOps(ops) {
    for (const op of ops) {
      if (op.say !== undefined) {
        await UI.say(op.say, op.name);
      } else if (op.choice) {
        const idx = await UI.choose(op.choice.map(c => c.label));
        await execOps(op.choice[idx].then || []);
      } else if (op.iff) {
        await execOps(op.iff(G) ? (op.then || []) : (op.else || []));
      } else if (op.set) {
        G.flags[op.set[0]] = op.set[1];
      } else if (op.give) {
        addItem(op.give, op.n || 1);
        AudioSys.sfx('chest');
        await UI.say(T.obtained(itemName(op.give)));
      } else if (op.takeItem) {
        removeItem(op.takeItem, op.n || 1);
      } else if (op.gold) {
        G.gold = Math.max(0, G.gold + op.gold);
        await UI.say(T.obtainedGold(op.gold));
      } else if (op.join) {
        const lead = G.party[0];
        const lv = op.join === 'gald' ? Math.max(7, lead.level) : Math.max(2, lead.level - 1);
        if (!G.party.find(m => m.id === op.join) && G.party.length < 3) {
          G.party.push(makeMember(op.join, lv));
          AudioSys.sfx('levelup');
          await UI.say(T.partyJoin(CHARACTERS[op.join].name));
        }
      } else if (op.healAll) {
        for (const m of G.party) { m.hp = maxHp(m); m.mp = maxMp(m); m.status = {}; }
      } else if (op.inn !== undefined) {
        await doInn(op.inn);
      } else if (op.shop) {
        await UI.shop(op.shop);
      } else if (op.battle) {
        const b = op.battle;
        const result = await BattleSys.start({
          enemies: [b.boss], bg: b.bg, canRun: false, bossBgm: true,
        });
        const r = await afterBattle(result);
        if (r === 'win' && b.onWin) await execOps(b.onWin);
        if (r === 'lose') return; // 全滅したらスクリプト中断
      } else if (op.warp) {
        await gotoMap(op.warp.map, op.warp.x, op.warp.y, op.warp.dir || 'down');
      } else if (op.sfx) {
        AudioSys.sfx(op.sfx);
      } else if (op.ending) {
        await Game.setState('ending');
        return;
      }
    }
  }

  async function doInn(cost) {
    const innName = '宿屋';
    await UI.say(T.innAsk(cost), innName);
    const idx = await UI.choose([T.yes, T.no]);
    if (idx !== 0) return;
    if (G.gold < cost) { await UI.say(T.innNoMoney, innName); return; }
    G.gold -= cost;
    await Fx.fadeOut();
    for (const m of G.party) { m.hp = maxHp(m); m.mp = maxMp(m); m.status = {}; }
    AudioSys.sfx('heal');
    await Fx.fadeIn();
    await UI.say(T.innDone, innName);
  }

  // ---------- フィールド使用アイテム／スキル ----------
  async function fieldWarpTown() {
    const t = G.lastTown;
    await gotoMap(t.map, t.x, t.y, 'down');
  }

  // ---------- ステート ----------
  const state = {
    async enter(arg) {
      Layers.field.visible = true;
      Layers.battle.visible = false;
      if (!mapId || mapId !== G.map || (arg && arg.rebuild)) {
        mapId = G.map; map = MAPS[mapId];
        build();
        AudioSys.playBgm(map.bgm);
      }
      UI.setHelp(T.helpField);
      if (arg && arg.fadeIn) await Fx.fadeIn();
    },
    exit() {
      UI.setHelp('');
    },
    update(dt) {
      if (!map) return;
      // NPC徘徊
      for (const n of npcSprs) {
        if (!n.spr || !n.npc.wander) continue;
        if (n.npc.hideFlag && G.flags[n.npc.hideFlag]) { n.spr.visible = false; continue; }
        n.t -= dt;
        if (n.moving) {
          n.prog += dt * 48;
          const p = Math.min(1, n.prog / TILE);
          n.spr.x = (n.fx + (n.tx - n.fx) * p) * TILE;
          n.spr.y = (n.fy + (n.ty - n.fy) * p) * TILE - 2;
          n.spr.texture = GFX.charFrame(n.npc.pal, n.dir, Math.floor(n.prog / 8) % 2);
          if (p >= 1) n.moving = false;
        } else if (n.t <= 0) {
          n.t = 1.2 + rndf() * 2.2;
          const dirs = ['up', 'down', 'left', 'right'];
          const d = dirs[rnd(4)];
          const [dx, dy] = DIRS[d];
          const nx = n.tx + dx, ny = n.ty + dy;
          n.dir = d;
          n.spr.texture = GFX.charFrame(n.npc.pal, d, 0);
          if (Math.abs(nx - n.hx) <= 2 && Math.abs(ny - n.hy) <= 2 && !isBlocked(nx, ny, true)) {
            n.fx = n.tx; n.fy = n.ty; n.tx = nx; n.ty = ny;
            n.prog = 0; n.moving = true;
          }
        }
      }
      if (busy || UI.isOpen()) return;
      // プレイヤー移動
      if (moving) {
        moving.prog += dt * MOVE_SPEED;
        walkAnim += dt * 8;
        const p = Math.min(1, moving.prog / TILE);
        setPlayerPixel(
          (moving.fx + (moving.tx - moving.fx) * p) * TILE,
          (moving.fy + (moving.ty - moving.fy) * p) * TILE
        );
        playerSpr.texture = GFX.charFrame('hero', G.dir, Math.floor(walkAnim) % 2);
        camera();
        if (p >= 1) onStepComplete();
      } else {
        for (const d of ['up', 'down', 'left', 'right']) {
          if (Input.held[d]) { tryMove(d); break; }
        }
      }
    },
    onButton(btn) {
      if (UI.handleButton(btn)) return;
      if (busy || moving) return;
      if (btn === 'a') interact();
      else if (btn === 'b' || btn === 'menu') UI.openMenu();
    },
  };

  return { state, gotoMap, fieldWarpTown, runScriptAsync, afterBattle, get busy() { return busy; } };
})();

Game.register('field', Field.state);
