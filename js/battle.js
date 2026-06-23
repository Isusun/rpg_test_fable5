// ============================================================
// ターン制バトル: 速度順行動 / 状態異常 / 会心 / 属性 / バリアギミック
// ============================================================
'use strict';

const BattleSys = (() => {
  let enemies = [];      // {def, name, hp, maxHp, status:{}, buffs:{}, spr, hpBar, label, alive, barrier...}
  let bstate = null;     // Map(member -> {guard, buffs:{atkup:n,defup:n}, sleepTurns})
  let resolveBattle = null;
  let bgSpr = null;
  let arrow = null;
  let battleC = null;
  let canRun = true;
  let isBossBattle = false;

  const aliveParty = () => G.party.filter(m => m.hp > 0);
  const aliveEnemies = () => enemies.filter(e => e.alive);

  // ---------- セットアップ ----------
  function layoutEnemies() {
    const n = enemies.length;
    enemies.forEach((e, i) => {
      const x = VIEW_W / 2 + (i - (n - 1) / 2) * Math.min(110, 300 / Math.max(1, n - 1) + 60);
      const baseY = 178;
      e.spr.anchor.set(0.5, 1);
      e.spr.x = x; e.spr.y = baseY;
      e.homeX = x; e.homeY = baseY;
      e.label.x = x; e.label.y = baseY + 6;
      e.hpBarBg.x = x - 24; e.hpBarBg.y = baseY + 20;
      e.hpBar.x = x - 24; e.hpBar.y = baseY + 20;
      e.stTxt.x = x; e.stTxt.y = baseY + 24;
    });
  }

  function makeEnemy(id, idx) {
    const def = ENEMIES[id];
    const e = {
      id, def, name: def.name, idx,
      hp: def.hp, maxHp: def.hp,
      status: {}, buffs: {}, sleepTurns: 0,
      alive: true,
      barrierList: def.barrier || null,
      barrierIdx: 0, barrier: def.barrier ? def.barrier[0] : null, brokenTurns: 0,
      enraged: false,
    };
    e.spr = new PIXI.Sprite(GFX.enemyTexture(def.art, def.size));
    e.label = new PIXI.Text({ text: def.name, style: { fill: '#fff', fontSize: 10, fontFamily: 'sans-serif', stroke: { color: '#000', width: 3 } } });
    e.label.anchor.set(0.5, 0);
    e.hpBarBg = new PIXI.Graphics().rect(0, 0, 48, 4).fill(0x333a55);
    e.hpBar = new PIXI.Graphics().rect(0, 0, 48, 4).fill(0x6fdc6f);
    e.stTxt = new PIXI.Text({ text: '', style: { fill: '#e8a0ff', fontSize: 9, fontFamily: 'sans-serif', stroke: { color: '#000', width: 3 } } });
    e.stTxt.anchor.set(0.5, 0);
    battleC.addChild(e.spr, e.label, e.hpBarBg, e.hpBar, e.stTxt);
    return e;
  }

  function refreshEnemyUI() {
    for (const e of enemies) {
      const ratio = clamp(e.hp / e.maxHp, 0, 1);
      e.hpBar.clear().rect(0, 0, 48 * ratio, 4).fill(ratio > 0.3 ? 0x6fdc6f : 0xff9d4d);
      const tags = [];
      if (e.status.poison) tags.push(T.statusNames.poison);
      if (e.status.sleep) tags.push(T.statusNames.sleep);
      if (e.barrier) tags.push(`晶壁:${T.elemNames[e.barrier]}`);
      if (e.enraged) tags.push('怒');
      e.stTxt.text = tags.join(' ');
    }
  }

  function enemyScreenPos(e) { // DOMポップアップ用（%座標）
    return { x: (e.spr.x / VIEW_W) * 100, y: ((e.spr.y - e.spr.height / 2) / VIEW_H) * 100 };
  }
  function partyScreenPos(m) {
    const i = G.party.indexOf(m);
    const el = document.querySelectorAll('#bhud .pstat')[i];
    if (!el) return { x: 50, y: 20 };
    const stage = document.getElementById('stage').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: ((r.left + r.width / 2 - stage.left) / stage.width) * 100, y: ((r.top + r.height / 2 - stage.top) / stage.height) * 100 };
  }

  // ---------- メッセージ ----------
  async function log(text, ms = 700) {
    UI.blog(text);
    await UI.bwait(ms);
  }

  // ---------- ダメージ計算 ----------
  const variance = () => 0.88 + rndf() * 0.24;

  function actorStat(a, key) {
    if (a.isParty) {
      let v = statOf(a.m, key);
      const bs = bstate.get(a.m);
      if (key === 'atk' && bs.buffs.atkup) v = Math.floor(v * 1.35);
      if (key === 'def' && bs.buffs.defup) v = Math.floor(v * 1.4);
      return v;
    }
    let v = a.e.def[key] || 0;
    if (key === 'atk' && a.e.enraged) v = Math.floor(v * 1.3);
    return v;
  }
  function targetDef(t) {
    if (t.isParty) {
      let v = statOf(t.m, 'def');
      const bs = bstate.get(t.m);
      if (bs.buffs.defup) v = Math.floor(v * 1.4);
      return v;
    }
    return t.e.def.def;
  }
  function elemMult(t, element) {
    if (!element || element === 'none' || !t) return 1;
    if (t.isParty) return 1;
    const d = t.e.def;
    if (d.weak && d.weak[element]) return d.weak[element];
    if (d.resist && d.resist[element]) return d.resist[element];
    return 1;
  }

  // バリア判定 → {mult, broke, guarded}
  function barrierCheck(t, element) {
    if (t.isParty || !t.e.barrier) return { mult: 1, broke: false, guarded: false };
    if (element === t.e.barrier) {
      t.e.barrier = null;
      t.e.brokenTurns = 2;
      return { mult: 1.5, broke: true, guarded: false };
    }
    return { mult: 0.3, broke: false, guarded: true };
  }

  async function dealDamage(t, rawDmg, { element = 'none', crit = false } = {}) {
    const bar = barrierCheck(t, element);
    if (bar.guarded) { AudioSys.sfx('barrier'); await log(T.barrierGuard, 500); }
    if (bar.broke) { AudioSys.sfx('crit'); await log(T.barrierBreak, 800); refreshEnemyUI(); }
    const em = elemMult(t, element);
    let dmg = Math.max(1, Math.round(rawDmg * em * bar.mult * (crit ? 1.8 : 1)));
    if (t.isParty) {
      const bs = bstate.get(t.m);
      if (bs.guard) dmg = Math.ceil(dmg / 2);
      t.m.hp = clamp(t.m.hp - dmg, 0, maxHp(t.m));
      const p = partyScreenPos(t.m);
      Fx.popup(p.x, p.y, dmg, crit ? 'crit' : '');
      AudioSys.sfx(crit ? 'crit' : 'hit');
      if (!REDUCED_MOTION) Fx.shake(battleC);
      // 睡眠中に攻撃されたら起きることがある
      if (bs.sleepTurns > 0 && rndf() < 0.5) {
        bs.sleepTurns = 0; delete t.m.status.sleep;
        await log(T.wokeUp(memberName(t.m)), 450);
      }
      UI.updateBattleHud(-1, bstate);
      if (crit) await log(T.critical, 500);
      await log(T.damageTo(memberName(t.m), dmg), 600);
      if (t.m.hp <= 0) {
        bs.guard = false; bs.buffs = {};
        await log(T.allyDown(memberName(t.m)), 700);
        UI.updateBattleHud(-1, bstate);
      }
    } else {
      t.e.hp = clamp(t.e.hp - dmg, 0, t.e.maxHp);
      const p = enemyScreenPos(t.e);
      Fx.popup(p.x, p.y, dmg, crit ? 'crit' : '');
      AudioSys.sfx(crit ? 'crit' : 'attack');
      flashEnemy(t.e);
      if (t.e.status.sleep && rndf() < 0.5) {
        delete t.e.status.sleep; t.e.sleepTurns = 0;
        await log(T.wokeUp(t.e.name), 450);
      }
      refreshEnemyUI();
      if (crit) await log(T.critical, 500);
      const msg = em > 1 ? T.damageToWeak : (em < 1 || bar.guarded ? T.damageToResist : T.damageTo);
      await log(msg(t.e.name, dmg), 600);
      // 怒りモード
      if (t.e.def.boss && !t.e.enraged && t.e.hp > 0 && t.e.hp < t.e.maxHp * 0.35) {
        t.e.enraged = true;
        refreshEnemyUI();
        await log(T.bossEnrage(t.e.name), 700);
      }
      if (t.e.hp <= 0) {
        t.e.alive = false;
        await deathAnim(t.e);
        await log(T.enemyDown(t.e.name), 650);
      }
    }
  }

  function flashEnemy(e) {
    if (REDUCED_MOTION) return;
    e.spr.tint = 0xff8080;
    setTimeout(() => { e.spr.tint = 0xffffff; }, 130);
  }
  function deathAnim(e) {
    return new Promise((res) => {
      if (REDUCED_MOTION) {
        e.spr.visible = e.label.visible = e.hpBar.visible = e.hpBarBg.visible = e.stTxt.visible = false;
        return res();
      }
      const iv = setInterval(() => {
        e.spr.alpha -= 0.12;
        if (e.spr.alpha <= 0) {
          clearInterval(iv);
          e.spr.visible = e.label.visible = e.hpBar.visible = e.hpBarBg.visible = e.stTxt.visible = false;
          res();
        }
      }, 35);
    });
  }

  // ---------- 状態異常付与 ----------
  async function applyStatus(t, status, chance) {
    if (rndf() > chance) { await log(T.alreadyStatus, 500); return; }
    if (t.isParty) {
      if (isImmune(t.m, status)) { await log(T.alreadyStatus, 500); return; }
      if (t.m.status[status]) { await log(T.alreadyStatus, 500); return; }
      t.m.status[status] = true;
      if (status === 'sleep') bstate.get(t.m).sleepTurns = 1 + rnd(2);
      AudioSys.sfx(status === 'poison' ? 'poison' : 'sleep');
      await log(status === 'poison' ? T.poisoned(memberName(t.m)) : T.sleeping(memberName(t.m)), 650);
      UI.updateBattleHud(-1, bstate);
    } else {
      if (t.e.def.boss && status === 'sleep') { await log(T.alreadyStatus, 500); return; }
      if (t.e.id === 'zarva') { await log(T.alreadyStatus, 500); return; }
      if (t.e.status[status]) { await log(T.alreadyStatus, 500); return; }
      t.e.status[status] = true;
      if (status === 'sleep') t.e.sleepTurns = 1 + rnd(2);
      AudioSys.sfx(status === 'poison' ? 'poison' : 'sleep');
      await log(status === 'poison' ? T.poisoned(t.e.name) : T.sleeping(t.e.name), 650);
      refreshEnemyUI();
    }
  }

  // ---------- 行動実行 ----------
  function pickPartyTarget() {
    const alive = aliveParty();
    const weights = alive.map((m) => ({ m, w: 3 - clamp(G.party.indexOf(m), 0, 2) * 0.9 }));
    return { isParty: true, m: pickWeighted(weights).m };
  }
  function retargetEnemy(t) {
    if (t && !t.isParty && t.e.alive) return t;
    const alive = aliveEnemies();
    if (!alive.length) return null;
    return { isParty: false, e: alive[rnd(alive.length)] };
  }

  async function execAttack(actor, target) {
    const name = actor.isParty ? memberName(actor.m) : actor.e.name;
    await log(T.attackMsg(name), 450);
    if (rndf() < 0.05) { AudioSys.sfx('miss'); await log(T.missMsg, 550); return; }
    const t = actor.isParty ? retargetEnemy(target) : pickPartyTarget();
    if (!t) return;
    const atk = actorStat(actor, 'atk');
    const dmg = Math.max(1, (atk - targetDef(t) / 2)) * variance();
    const crit = rndf() < 0.08;
    await dealDamage(t, dmg, { crit });
  }

  async function execSkill(actor, skillId, target) {
    const sk = SKILLS[skillId];
    const name = actor.isParty ? memberName(actor.m) : actor.e.name;
    if (actor.isParty) {
      if (actor.m.mp < sk.mp) { await log(T.skillNoMp, 500); return; }
      actor.m.mp -= sk.mp;
      UI.updateBattleHud(-1, bstate);
    }
    await log(`${name} の ${sk.name}！`, 550);

    // 対象決定（target指定は常に「行動者から見た」敵味方）
    const opposing = () => actor.isParty ? aliveEnemies().map(e => ({ isParty: false, e })) : aliveParty().map(m => ({ isParty: true, m }));
    const ownSide = () => actor.isParty ? aliveParty().map(m => ({ isParty: true, m })) : aliveEnemies().map(e => ({ isParty: false, e }));

    let targets = [];
    if (sk.target === 'enemy') {
      const t = actor.isParty ? retargetEnemy(target) : pickPartyTarget();
      if (t) targets = [t];
    } else if (sk.target === 'allEnemies') {
      targets = opposing();
    } else if (sk.target === 'ally') {
      targets = target ? [target] : [ownSide()[0]];
    } else if (sk.target === 'allAllies') {
      targets = ownSide();
    } else if (sk.target === 'self') {
      targets = [actor];
    }

    for (const t of targets) {
      if (sk.kind === 'phys') {
        if (rndf() < 0.05) { AudioSys.sfx('miss'); await log(T.missMsg, 550); continue; }
        const atk = actorStat(actor, 'atk');
        const dmg = Math.max(1, (atk - targetDef(t) / 2)) * sk.mult * variance();
        const crit = rndf() < 0.08;
        await dealDamage(t, dmg, { element: sk.element, crit });
        if (sk.status && (t.isParty ? t.m.hp > 0 : t.e.alive)) await applyStatus(t, sk.status, sk.chance);
      } else if (sk.kind === 'magic') {
        AudioSys.sfx('magic');
        const mag = actorStat(actor, 'mag');
        const dmg = Math.max(1, sk.pow + mag * 1.2 - targetDef(t) * 0.35) * variance();
        await dealDamage(t, dmg, { element: sk.element });
      } else if (sk.kind === 'heal') {
        AudioSys.sfx('heal');
        const mag = actorStat(actor, 'mag');
        const amount = Math.round((sk.pow + mag * 0.8) * variance());
        if (t.isParty) {
          t.m.hp = clamp(t.m.hp + amount, 0, maxHp(t.m));
          const p = partyScreenPos(t.m);
          Fx.popup(p.x, p.y, amount, 'heal');
          if (sk.cures) for (const c of sk.cures) {
            if (t.m.status[c]) { delete t.m.status[c]; await log(T.poisonCured(memberName(t.m)), 450); }
          }
          UI.updateBattleHud(-1, bstate);
          await log(T.healMsg(memberName(t.m), amount), 600);
        }
      } else if (sk.kind === 'buff') {
        AudioSys.sfx('heal');
        if (t.isParty) {
          bstate.get(t.m).buffs[sk.buff] = 4;
          UI.updateBattleHud(-1, bstate);
          await log(sk.buff === 'atkup' ? T.atkUpMsg(memberName(t.m)) : T.defUpMsg(memberName(t.m)), 550);
        }
      } else if (sk.kind === 'status') {
        AudioSys.sfx('magic');
        await applyStatus(t, sk.status, sk.chance);
      }
    }
  }

  async function execItem(actor, itemId, target) {
    const it = ITEMS[itemId];
    await log(`${memberName(actor.m)} は ${it.name} を使った！`, 550);
    removeItem(itemId);
    const m = target.m;
    let did = false;
    if (it.heal) {
      const amount = Math.min(it.heal, maxHp(m) - m.hp) || 0;
      m.hp = clamp(m.hp + it.heal, 0, maxHp(m));
      const p = partyScreenPos(m);
      Fx.popup(p.x, p.y, Math.max(amount, 1), 'heal');
      AudioSys.sfx('heal');
      await log(T.healMsg(memberName(m), Math.max(amount, 0)), 550);
      did = true;
    }
    if (it.mpheal) {
      m.mp = clamp(m.mp + it.mpheal, 0, maxMp(m));
      AudioSys.sfx('heal');
      await log(T.mpHealMsg(memberName(m), it.mpheal), 550);
      did = true;
    }
    if (it.cures) {
      for (const c of it.cures) {
        if (m.status[c]) {
          delete m.status[c];
          if (c === 'sleep') bstate.get(m).sleepTurns = 0;
          await log(c === 'poison' ? T.poisonCured(memberName(m)) : T.wokeUp(memberName(m)), 550);
          did = true;
        }
      }
    }
    if (!did) await log(T.itemNoEffect, 550);
    UI.updateBattleHud(-1, bstate);
  }

  // ---------- ラウンド処理 ----------
  async function endOfRound() {
    // 毒ダメージ
    for (const m of aliveParty()) {
      if (m.status.poison && m.hp > 0) {
        const dmg = Math.max(1, Math.floor(maxHp(m) * 0.08));
        m.hp = clamp(m.hp - dmg, 0, maxHp(m));
        const p = partyScreenPos(m);
        Fx.popup(p.x, p.y, dmg, '');
        AudioSys.sfx('poison');
        UI.updateBattleHud(-1, bstate);
        await log(T.poisonDmg(memberName(m), dmg), 550);
        if (m.hp <= 0) await log(T.allyDown(memberName(m)), 650);
      }
    }
    for (const e of aliveEnemies()) {
      if (e.status.poison) {
        const dmg = Math.max(1, Math.floor(e.maxHp * 0.08));
        e.hp = clamp(e.hp - dmg, 0, e.maxHp);
        const p = enemyScreenPos(e);
        Fx.popup(p.x, p.y, dmg, '');
        refreshEnemyUI();
        await log(T.poisonDmg(e.name, dmg), 550);
        if (e.hp <= 0) {
          e.alive = false;
          await deathAnim(e);
          await log(T.enemyDown(e.name), 600);
        }
      }
    }
    // バフ経過
    for (const m of G.party) {
      const bs = bstate.get(m);
      for (const b of Object.keys(bs.buffs)) {
        if (--bs.buffs[b] <= 0) {
          delete bs.buffs[b];
          await log(T.statusFade(memberName(m), T.statusNames[b]), 450);
        }
      }
      bs.guard = false;
    }
    UI.updateBattleHud(-1, bstate);
  }

  async function enemyTurnStartHooks(e) {
    // ザルヴァ: バリア再生成
    if (e.barrierList && !e.barrier) {
      if (--e.brokenTurns <= 0) {
        e.barrierIdx = (e.barrierIdx + 1) % e.barrierList.length;
        e.barrier = e.barrierList[e.barrierIdx];
        AudioSys.sfx('barrier');
        refreshEnemyUI();
        await log(T.barrierShift(T.elemNames[e.barrier]), 800);
      }
    }
  }

  async function processSleep(actor) {
    if (actor.isParty) {
      const bs = bstate.get(actor.m);
      if (!actor.m.status.sleep) return false;
      bs.sleepTurns++;
      if (bs.sleepTurns > 3 || rndf() < 0.45) {
        delete actor.m.status.sleep; bs.sleepTurns = 0;
        await log(T.wokeUp(memberName(actor.m)), 550);
        UI.updateBattleHud(-1, bstate);
        return false;
      }
      await log(T.sleepSkip(memberName(actor.m)), 600);
      return true;
    }
    if (!actor.e.status.sleep) return false;
    actor.e.sleepTurns++;
    if (actor.e.sleepTurns > 3 || rndf() < 0.45) {
      delete actor.e.status.sleep; actor.e.sleepTurns = 0;
      await log(T.wokeUp(actor.e.name), 550);
      refreshEnemyUI();
      return false;
    }
    await log(T.sleepSkip(actor.e.name), 600);
    return true;
  }

  // ---------- バトル本体 ----------
  async function start({ enemies: enemyIds, bg, canRun: cr, bossBgm = false }) {
    return new Promise(async (resolve) => {
      resolveBattle = resolve;
      canRun = cr;
      isBossBattle = bossBgm;
      bstate = new Map();
      for (const m of G.party) bstate.set(m, { guard: false, buffs: {}, sleepTurns: 0 });

      // 表示構築
      Layers.battle.removeChildren();
      battleC = new PIXI.Container();
      bgSpr = new PIXI.Sprite(GFX.battleBg(bg || 'field', VIEW_W, VIEW_H));
      battleC.addChild(bgSpr);
      enemies = enemyIds.map((id, i) => makeEnemy(id, i));
      layoutEnemies();
      refreshEnemyUI();
      arrow = new PIXI.Graphics().moveTo(0, 0).lineTo(10, 0).lineTo(5, 8).fill(0xffd966);
      arrow.visible = false;
      battleC.addChild(arrow);
      Layers.battle.addChild(battleC);

      AudioSys.sfx('encounter');
      await Fx.fadeOut();
      Layers.field.visible = false;
      Layers.battle.visible = true;
      UI.showBattleUI(true);
      UI.updateBattleHud(-1, bstate);
      AudioSys.playBgm(bossBgm ? 'boss' : 'battle');
      await Fx.fadeIn();

      if (enemies.length === 1) await log(T.battleStart(enemies[0].name), 800);
      else await log(T.battleStartMulti, 800);
      if (enemies[0].barrier) await log(T.barrierShift(T.elemNames[enemies[0].barrier]), 800);

      battleLoop();
    });
  }

  async function battleLoop() {
    while (true) {
      // --- コマンド入力 ---
      const commands = [];
      let fled = false;
      for (let i = 0; i < G.party.length; i++) {
        const m = G.party[i];
        if (m.hp <= 0 || m.status.sleep) continue;
        const cmd = await UI.battleCommand(m, i, {
          enemies: aliveEnemies(), canRun, bstate,
          // 戻る: 前のキャラのコマンドをやり直す
        });
        if (cmd === 'redo' && commands.length > 0) {
          const prev = commands.pop();
          i = G.party.indexOf(prev.m) - 1;
          continue;
        }
        if (cmd === 'redo') { i--; continue; }
        cmd.m = m;
        commands.push(cmd);
      }
      UI.battleCommandHide();

      // --- 行動順を決定 ---
      const actors = [];
      for (const c of commands) {
        actors.push({ isParty: true, m: c.m, cmd: c, spd: statOf(c.m, 'spd') * (0.85 + rndf() * 0.3) });
      }
      for (const m of G.party) { // 眠っている味方もターンは消費（起きる判定のため）
        if (m.hp > 0 && m.status.sleep) actors.push({ isParty: true, m, cmd: { type: 'sleep' }, spd: statOf(m, 'spd') * (0.85 + rndf() * 0.3) });
      }
      for (const e of aliveEnemies()) {
        actors.push({ isParty: false, e, spd: e.def.spd * (0.85 + rndf() * 0.3) });
      }
      actors.sort((a, b) => b.spd - a.spd);

      // --- 実行 ---
      for (const actor of actors) {
        if (actor.isParty && actor.m.hp <= 0) continue;
        if (!actor.isParty && !actor.e.alive) continue;
        if (!aliveEnemies().length || !aliveParty().length) break;

        UI.updateBattleHud(actor.isParty ? G.party.indexOf(actor.m) : -1, bstate);

        if (await processSleep(actor)) continue;

        if (actor.isParty) {
          const c = actor.cmd;
          if (c.type === 'attack') await execAttack(actor, c.target);
          else if (c.type === 'skill') await execSkill(actor, c.skill, c.target);
          else if (c.type === 'item') await execItem(actor, c.item, c.target);
          else if (c.type === 'guard') {
            bstate.get(actor.m).guard = true;
            await log(T.guardMsg(memberName(actor.m)), 500);
          } else if (c.type === 'run') {
            const ps = aliveParty().reduce((s, m) => s + statOf(m, 'spd'), 0) / aliveParty().length;
            const es = Math.max(...aliveEnemies().map(e => e.def.spd));
            const chance = clamp(0.55 + (ps - es) * 0.03, 0.3, 0.95);
            AudioSys.sfx('run');
            if (rndf() < chance) {
              await log(T.runTry, 700);
              fled = true;
              break;
            }
            await log(T.runTry + '\n' + T.runFail, 800);
          }
        } else {
          await enemyTurnStartHooks(actor.e);
          if (!actor.e.alive) continue;
          const move = pickWeighted(actor.e.def.ai);
          if (move.attack) await execAttack(actor, null);
          else await execSkill(actor, move.skill, null);
        }

        if (!aliveParty().length) break;
      }

      if (fled) return endBattle('run');
      if (!aliveParty().length) return endBattle('lose');
      if (!aliveEnemies().length) return endBattle('win');

      await endOfRound();
      if (!aliveParty().length) return endBattle('lose');
      if (!aliveEnemies().length) return endBattle('win');
    }
  }

  async function endBattle(result) {
    if (result === 'win') {
      AudioSys.stopBgm();
      AudioSys.sfx('victory');
      await log(T.victory, 800);
      let exp = 0, gold = 0;
      const drops = [];
      for (const e of enemies) {
        exp += e.def.exp; gold += e.def.gold;
        if (e.def.drop && rndf() < e.def.drop.rate) drops.push(e.def.drop.id);
      }
      if (exp || gold) {
        G.gold += gold;
        await log(T.gotExpGold(exp, gold), 850);
        for (const m of aliveParty()) {
          const up = gainExp(m, exp);
          if (up) {
            AudioSys.sfx('levelup');
            Fx.flash('#ffd966');
            UI.updateBattleHud(-1, bstate);
            await log(T.levelUp(up.name, up.newLevel), 850);
            for (const sname of up.learned) await log(T.learnedSkill(up.name, sname), 850);
          }
        }
      }
      for (const d of drops) {
        addItem(d);
        await log(T.gotDrop(itemName(d)), 750);
      }
    } else if (result === 'lose') {
      AudioSys.stopBgm();
      AudioSys.sfx('gameover');
      await log(T.defeat, 1600);
    }

    // 戦闘専用状態のクリーンアップ（毒はフィールドに持ち越し）
    for (const m of G.party) {
      delete m.status.sleep;
      if (m.hp <= 0 && result !== 'lose') m.hp = 0; // 戦闘不能は宿/全滅処理で回復
    }
    // 全滅時は afterBattle 側で蘇生処理
    UI.showBattleUI(false);
    await Fx.fadeOut();
    Layers.battle.visible = false;
    Layers.field.visible = true;
    Layers.battle.removeChildren();
    await Fx.fadeIn();
    const r = resolveBattle; resolveBattle = null;
    r(result);
  }

  return { start };
})();
