// ============================================================
// UI: メッセージ / 選択肢 / メニュー / 店 / 戦闘コマンド（DOMベース）
// キーボード・タッチの両対応。コンポーネントスタックで入力をルーティング。
// ============================================================
'use strict';

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const stack = []; // {handleButton(btn):bool}

  function handleButton(btn) {
    if (!stack.length) return false;
    return stack[stack.length - 1].handleButton(btn) !== false;
  }
  const isOpen = () => stack.length > 0;

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  // ---------- メッセージウィンドウ ----------
  function say(text, name) {
    return new Promise((resolve) => {
      const win = $('msgwin'), txt = $('msgtext'), next = $('msgnext');
      show(win); hide(next);
      const full = (name ? `${name}\n` : '') + text;
      let pos = 0, typing = true, timer = null;
      txt.innerHTML = '';

      function render() {
        const sub = full.slice(0, pos);
        if (name) {
          const lines = sub.split('\n');
          txt.innerHTML = `<span id="msgname-inline" style="color:var(--accent);font-weight:bold">${lines[0]}</span>\n` +
            lines.slice(1).join('\n');
        } else txt.textContent = sub;
      }
      function finishTyping() {
        typing = false; pos = full.length;
        if (timer) { clearInterval(timer); timer = null; }
        render(); show(next);
      }
      if (REDUCED_MOTION) { finishTyping(); }
      else {
        timer = setInterval(() => {
          pos += 2;
          if (pos >= full.length) finishTyping();
          else render();
        }, 18);
      }
      const comp = {
        handleButton(btn) {
          if (btn !== 'a' && btn !== 'b') return true;
          if (typing) { AudioSys.sfx('cursor'); finishTyping(); return true; }
          AudioSys.sfx('confirm');
          stack.pop();
          hide(win);
          win.onclick = null;
          resolve();
          return true;
        },
      };
      win.onclick = () => comp.handleButton('a');
      stack.push(comp);
    });
  }

  // ---------- 選択肢 ----------
  function choose(labels) {
    return new Promise((resolve) => {
      const win = $('choicewin'), list = $('choicelist');
      show(win);
      list.innerHTML = '';
      let idx = 0;
      const lis = labels.map((lb, i) => {
        const li = document.createElement('li');
        li.textContent = lb;
        li.setAttribute('role', 'menuitem');
        li.onclick = () => { idx = i; confirm(); };
        list.appendChild(li);
        return li;
      });
      function renderSel() { lis.forEach((li, i) => li.classList.toggle('sel', i === idx)); }
      renderSel();
      function confirm() {
        AudioSys.sfx('confirm');
        stack.pop(); hide(win);
        resolve(idx);
      }
      stack.push({
        handleButton(btn) {
          if (btn === 'up') { idx = (idx + labels.length - 1) % labels.length; AudioSys.sfx('cursor'); renderSel(); }
          else if (btn === 'down') { idx = (idx + 1) % labels.length; AudioSys.sfx('cursor'); renderSel(); }
          else if (btn === 'a') confirm();
          return true;
        },
      });
    });
  }

  // ---------- 汎用リストメニュー ----------
  // items: [{label, rval, disabled, help}] / opts: {cancelable, onMove, onLR, startIdx}
  function pick(winEl, listEl, items, opts = {}) {
    return new Promise((resolve) => {
      show(winEl);
      listEl.innerHTML = '';
      let idx = opts.startIdx || 0;
      const lis = items.map((it, i) => {
        const li = document.createElement('li');
        li.innerHTML = `${escapeHtml(it.label)}${it.rval !== undefined ? `<span class="rval">${escapeHtml(String(it.rval))}</span>` : ''}`;
        li.setAttribute('role', 'menuitem');
        if (it.disabled) li.setAttribute('aria-disabled', 'true');
        li.onclick = () => { idx = i; move(0); confirm(); };
        listEl.appendChild(li);
        return li;
      });
      function renderSel() {
        lis.forEach((li, i) => li.classList.toggle('sel', i === idx));
        if (lis[idx]) lis[idx].scrollIntoView({ block: 'nearest' });
        if (opts.onMove) opts.onMove(idx);
      }
      function move(d) {
        if (!items.length) return;
        idx = (idx + d + items.length) % items.length;
        if (d !== 0) AudioSys.sfx('cursor');
        renderSel();
      }
      function close(result) {
        stack.pop(); hide(winEl);
        resolve(result);
      }
      function confirm() {
        if (!items.length) return;
        if (items[idx].disabled) { AudioSys.sfx('cancel'); return; }
        AudioSys.sfx('confirm');
        close(idx);
      }
      renderSel();
      stack.push({
        handleButton(btn) {
          if (btn === 'up') move(-1);
          else if (btn === 'down') move(1);
          else if (btn === 'left' && opts.onLR) opts.onLR(idx, -1);
          else if (btn === 'right' && opts.onLR) opts.onLR(idx, 1);
          else if (btn === 'a') confirm();
          else if ((btn === 'b' || btn === 'menu') && opts.cancelable !== false) { AudioSys.sfx('cancel'); close(-1); }
          return true;
        },
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- 補助ウィンドウ ----------
  function setHelp(text) {
    const el = $('helpwin');
    if (!text) { hide(el); return; }
    el.textContent = text;
    show(el);
  }
  function showGold() { const el = $('goldwin'); el.textContent = T.gold(G.gold); show(el); }
  function hideGold() { hide($('goldwin')); }

  function statusTags(m, bs) {
    let html = '';
    if (m.status.poison) html += `<span class="stag poison">${T.statusNames.poison}</span>`;
    if (m.status.sleep) html += `<span class="stag sleep">${T.statusNames.sleep}</span>`;
    if (bs) {
      const b = bs.get(m);
      if (b && b.buffs.atkup) html += `<span class="stag atkup">${T.statusNames.atkup}</span>`;
      if (b && b.buffs.defup) html += `<span class="stag defup">${T.statusNames.defup}</span>`;
    }
    return html;
  }

  // パーティ簡易表示（メニュー左下）
  function renderPartyWin() {
    const el = $('partywin');
    el.innerHTML = G.party.map((m) => {
      const hpc = m.hp <= 0 ? 'var(--danger)' : (m.hp < maxHp(m) * 0.3 ? 'var(--hp-low)' : 'var(--txt)');
      return `<div class="prow"><span>${memberName(m)} <small>Lv${m.level}</small> ${statusTags(m)}</span>
        <span style="color:${hpc}">HP ${m.hp}/${maxHp(m)}　MP ${m.mp}/${maxMp(m)}</span></div>`;
    }).join('');
    show(el);
  }

  // パーティから1人選ぶ
  async function pickParty(items = null) {
    const el = $('partywin');
    show(el);
    const list = items || G.party.map((m) => ({
      label: `${memberName(m)} Lv${m.level}`,
      rval: `HP ${m.hp}/${maxHp(m)} MP ${m.mp}/${maxMp(m)}`,
    }));
    // partywin を一時リストに
    el.innerHTML = '<ul class="menu" id="partypicklist"></ul>';
    const r = await pick(el, $('partypicklist'), list, { cancelable: true });
    return r;
  }

  // ---------- メインメニュー ----------
  let menuBusy = false;
  async function openMenu() {
    if (menuBusy || isOpen()) return;
    menuBusy = true;
    AudioSys.sfx('confirm');
    try {
      let startIdx = 0;
      while (true) {
        showGold(); renderPartyWin(); setHelp(T.helpMenu);
        const items = [
          { label: T.menuItem }, { label: T.menuSkill }, { label: T.menuEquip },
          { label: T.menuStatus }, { label: T.menuFormation, disabled: G.party.length < 2 },
          { label: T.menuQuest }, { label: T.menuSave }, { label: T.menuSettings },
          { label: T.menuClose },
        ];
        const r = await pick($('mainmenu'), $('mainmenulist'), items, { cancelable: true, startIdx });
        if (r === -1 || r === 8) break;
        startIdx = r;
        if (r === 0) await menuItems();
        else if (r === 1) await menuSkills();
        else if (r === 2) await menuEquip();
        else if (r === 3) await menuStatus();
        else if (r === 4) await menuFormation();
        else if (r === 5) await menuQuest();
        else if (r === 6) await menuSave();
        else if (r === 7) await menuSettings();
      }
    } finally {
      hideGold(); hide($('partywin')); hide($('subwin')); setHelp(T.helpField);
      menuBusy = false;
    }
  }

  function subList() {
    const el = $('subwin');
    el.innerHTML = '<ul class="menu" id="sublist"></ul>';
    show(el);
    return [el, $('sublist')];
  }

  // --- どうぐ ---
  async function menuItems() {
    while (true) {
      const ids = Object.keys(G.inv);
      const [el, list] = subList();
      if (!ids.length) {
        el.innerHTML = `<div style="font-size:1.4em">${T.itemEmpty}</div>`;
        await say(T.itemEmpty);
        hide(el);
        return;
      }
      const items = ids.map((id) => {
        const def = ITEMS[id] || EQUIPS[id];
        const isEquip = !!EQUIPS[id];
        return {
          label: `${def.name} ×${G.inv[id]}`,
          rval: isEquip ? '装備品' : (def.type === 'key' ? '大事なもの' : ''),
          help: def.desc || (isEquip ? '「そうび」メニューで装備できます' : ''),
          id,
        };
      });
      const r = await pick(el, list, items, {
        cancelable: true,
        onMove: (i) => setHelp(items[i].help || T.helpMenu),
      });
      hide(el);
      if (r === -1) return;
      const id = items[r].id;
      const def = ITEMS[id];
      if (!def || def.type === 'key' || EQUIPS[id]) { await say(items[r].help || T.itemCantUseHere); continue; }
      if (!def.field) { await say(T.itemCantUseHere); continue; }
      if (def.warpTown) {
        removeItem(id);
        await Field.fieldWarpTown();
        return;
      }
      // 対象選択
      const ti = await pickParty();
      renderPartyWin();
      if (ti === -1) continue;
      const m = G.party[ti];
      const msgs = applyItemField(m, id);
      for (const msg of msgs) await say(msg);
      renderPartyWin(); showGold();
    }
  }

  function applyItemField(m, id) {
    const def = ITEMS[id];
    const msgs = [];
    let used = false;
    if (def.heal) {
      const amount = Math.min(def.heal, maxHp(m) - m.hp);
      if (amount > 0 || def.heal >= 999) {
        m.hp = clamp(m.hp + def.heal, 0, maxHp(m));
        msgs.push(T.healMsg(memberName(m), Math.max(amount, 0)));
        used = true;
      }
    }
    if (def.mpheal) {
      const amount = Math.min(def.mpheal, maxMp(m) - m.mp);
      if (amount > 0) {
        m.mp = clamp(m.mp + def.mpheal, 0, maxMp(m));
        msgs.push(T.mpHealMsg(memberName(m), amount));
        used = true;
      }
    }
    if (def.cures) {
      for (const c of def.cures) {
        if (m.status[c]) { delete m.status[c]; msgs.push(T.poisonCured(memberName(m))); used = true; }
      }
    }
    if (def.permanent) {
      m.perm[def.permanent] = (m.perm[def.permanent] || 0) + def.amount;
      msgs.push(`${memberName(m)} の${T.stAtk}が ${def.amount} 上がった！`);
      used = true;
    }
    if (used) { AudioSys.sfx('heal'); removeItem(id); }
    else msgs.push(T.itemNoEffect);
    return msgs;
  }

  // --- スキル（フィールド） ---
  async function menuSkills() {
    while (true) {
      const wi = await pickParty();
      renderPartyWin();
      if (wi === -1) return;
      const m = G.party[wi];
      const skills = memberSkills(m);
      if (!skills.length) { await say(T.skillNoSkills); continue; }
      while (true) {
        const [el, list] = subList();
        const items = skills.map(sid => {
          const sk = SKILLS[sid];
          return { label: sk.name, rval: `MP${sk.mp}`, help: sk.desc, sid,
                   disabled: !sk.field || m.mp < sk.mp };
        });
        const r = await pick(el, list, items, {
          cancelable: true,
          onMove: (i) => {
            const sk = SKILLS[items[i].sid];
            setHelp(sk.desc + (sk.field ? '' : '（戦闘中のみ）'));
          },
        });
        hide(el);
        if (r === -1) break;
        const sk = SKILLS[items[r].sid];
        const ti = await pickParty();
        renderPartyWin();
        if (ti === -1) continue;
        const t = G.party[ti];
        if (m.mp < sk.mp) { await say(T.skillNoMp); continue; }
        m.mp -= sk.mp;
        AudioSys.sfx('heal');
        const amount = Math.round(sk.pow + statOf(m, 'mag') * 0.8);
        const healed = Math.min(amount, maxHp(t) - t.hp);
        t.hp = clamp(t.hp + amount, 0, maxHp(t));
        const msgs = [T.healMsg(memberName(t), Math.max(healed, 0))];
        if (sk.cures) for (const c of sk.cures) {
          if (t.status[c]) { delete t.status[c]; msgs.push(T.poisonCured(memberName(t))); }
        }
        renderPartyWin();
        for (const msg of msgs) await say(msg);
      }
    }
  }

  // --- そうび ---
  async function menuEquip() {
    while (true) {
      const wi = await pickParty();
      renderPartyWin();
      if (wi === -1) return;
      const m = G.party[wi];
      while (true) {
        const [el, list] = subList();
        const slots = ['weapon', 'armor', 'acc'];
        const slotNames = { weapon: T.equipSlotWeapon, armor: T.equipSlotArmor, acc: T.equipSlotAcc };
        const slotItems = slots.map(s => ({
          label: slotNames[s],
          rval: m.equips[s] ? EQUIPS[m.equips[s]].name : T.equipNone,
        }));
        const si = await pick(el, list, slotItems, { cancelable: true });
        hide(el);
        if (si === -1) break;
        const slot = slots[si];
        // 候補リスト
        const candidates = Object.keys(G.inv).filter(id =>
          EQUIPS[id] && EQUIPS[id].slot === slot);
        const [el2, list2] = subList();
        const items = [];
        if (m.equips[slot]) items.push({ label: T.equipRemove, id: null });
        for (const id of candidates) {
          const e = EQUIPS[id];
          items.push({
            label: `${e.name} ×${G.inv[id]}`,
            id,
            disabled: !e.who.includes(m.id),
          });
        }
        if (!items.length) {
          hide(el2);
          await say('付け替えられる装備を持っていません。お店で買えます。');
          continue;
        }
        const r = await pick(el2, list2, items, {
          cancelable: true,
          onMove: (i) => equipDiffHelp(m, slot, items[i].id),
        });
        hide(el2);
        if (r === -1) continue;
        const chosen = items[r];
        if (chosen.id && !EQUIPS[chosen.id].who.includes(m.id)) {
          await say(T.cannotEquip(memberName(m)));
          continue;
        }
        // 付け替え
        const old = m.equips[slot];
        if (old) addItem(old);
        if (chosen.id) {
          removeItem(chosen.id);
          m.equips[slot] = chosen.id;
          AudioSys.sfx('confirm');
          await say(T.equipped(memberName(m), EQUIPS[chosen.id].name));
        } else {
          m.equips[slot] = null;
          await say(T.removed(memberName(m), EQUIPS[old].name));
        }
        // HP/MPが新しい最大値を超えないよう調整
        m.hp = clamp(m.hp, 0, maxHp(m));
        m.mp = clamp(m.mp, 0, maxMp(m));
        renderPartyWin();
      }
    }
  }

  function equipDiffHelp(m, slot, newId) {
    const before = {};
    for (const k of ['atk', 'def', 'spd', 'mag']) before[k] = statOf(m, k);
    const saved = m.equips[slot];
    m.equips[slot] = newId;
    const parts = [];
    for (const k of ['atk', 'def', 'spd', 'mag']) {
      const d = statOf(m, k) - before[k];
      if (d !== 0) parts.push(`${{ atk: T.stAtk, def: T.stDef, spd: T.stSpd, mag: T.stMag }[k]} ${d > 0 ? '+' : ''}${d}`);
    }
    m.equips[slot] = saved;
    const e = newId ? EQUIPS[newId] : null;
    setHelp((e && !e.who.includes(m.id)) ? T.cannotEquip(memberName(m)) : (parts.length ? parts.join('　') : '能力変化なし'));
  }

  // --- つよさ ---
  async function menuStatus() {
    while (true) {
      const wi = await pickParty();
      renderPartyWin();
      if (wi === -1) return;
      const m = G.party[wi];
      const el = $('subwin');
      const nextExp = m.level >= MAX_LV ? '—' : (EXP_TABLE[m.level + 1] - m.exp);
      const eq = (s) => m.equips[s] ? EQUIPS[m.equips[s]].name : T.equipNone;
      const sk = memberSkills(m).map(sid => SKILLS[sid].name).join('、') || 'なし';
      el.innerHTML = `<div style="font-size:1.4em">
        <b style="color:var(--accent)">${memberName(m)}</b>　${T.stLv} ${m.level}
        <table class="stats">
        <tr><td>${T.stHP}</td><td>${m.hp} / ${maxHp(m)}</td></tr>
        <tr><td>${T.stMP}</td><td>${m.mp} / ${maxMp(m)}</td></tr>
        <tr><td>${T.stAtk}</td><td>${statOf(m, 'atk')}</td></tr>
        <tr><td>${T.stDef}</td><td>${statOf(m, 'def')}</td></tr>
        <tr><td>${T.stSpd}</td><td>${statOf(m, 'spd')}</td></tr>
        <tr><td>${T.stMag}</td><td>${statOf(m, 'mag')}</td></tr>
        <tr><td>${T.stExp}</td><td>${m.exp}</td></tr>
        <tr><td>${T.stNext}</td><td>${nextExp}</td></tr>
        <tr><td>${T.stWeapon}</td><td>${eq('weapon')}</td></tr>
        <tr><td>${T.stArmor}</td><td>${eq('armor')}</td></tr>
        <tr><td>${T.stAcc}</td><td>${eq('acc')}</td></tr>
        </table>
        <div style="margin-top:0.4em;color:var(--txt-dim)">スキル: ${sk}</div>
      </div>`;
      show(el);
      // 閉じるのを待つ
      await new Promise((res) => {
        stack.push({
          handleButton(btn) {
            if (btn === 'a' || btn === 'b') { AudioSys.sfx('cancel'); stack.pop(); res(); }
            return true;
          },
        });
      });
      hide(el);
    }
  }

  // --- ならびかえ ---
  async function menuFormation() {
    setHelp(T.formationHint);
    const a = await pickParty();
    if (a === -1) return;
    const b = await pickParty();
    if (b === -1) return;
    if (a !== b) {
      [G.party[a], G.party[b]] = [G.party[b], G.party[a]];
      AudioSys.sfx('confirm');
      renderPartyWin();
      await say(T.formationDone);
    }
  }

  // --- クエスト ---
  async function menuQuest() {
    const el = $('subwin');
    const logs = questLog(G);
    el.innerHTML = `<div style="font-size:1.4em;line-height:1.9">` + (logs.length
      ? logs.map(q => `<div><span style="color:var(--accent)">${q.kind === 'main' ? T.questMain : T.questSide}</span> ${q.text}</div>`).join('')
      : T.questNone) + `</div>`;
    show(el);
    await new Promise((res) => {
      stack.push({
        handleButton(btn) {
          if (btn === 'a' || btn === 'b') { AudioSys.sfx('cancel'); stack.pop(); res(); }
          return true;
        },
      });
    });
    hide(el);
  }

  // --- セーブ ---
  async function menuSave() {
    if (SaveSys.hasSave()) {
      await say(T.confirmOverwrite);
      const r = await choose([T.yes, T.no]);
      if (r !== 0) return;
    }
    if (SaveSys.save()) {
      AudioSys.sfx('save');
      await say(T.saveDone);
    } else {
      await say(T.saveFailed);
    }
  }

  // --- 設定 ---
  async function menuSettings() {
    let idx = 0;
    while (true) {
      const s = Settings.get();
      const touchLabel = s.touch === null ? '自動' : (s.touch ? T.on : T.off);
      const [el, list] = subList();
      const items = [
        { label: T.bgmLabel, rval: s.bgm ? T.on : T.off },
        { label: T.sfxLabel, rval: s.sfx ? T.on : T.off },
        { label: T.volLabel, rval: `◀ ${Math.round(s.volume * 100)}% ▶` },
        { label: T.touchLabel, rval: touchLabel },
        { label: T.menuClose },
      ];
      setHelp(T.settingsHint);
      const r = await pick(el, list, items, {
        cancelable: true, startIdx: idx,
        onLR: (i, d) => {
          if (i === 2) {
            Settings.set('volume', clamp(Math.round((Settings.get().volume + d * 0.1) * 10) / 10, 0, 1));
            AudioSys.sfx('cursor');
            const li = $('sublist').children[2];
            if (li) li.querySelector('.rval').textContent = `◀ ${Math.round(Settings.get().volume * 100)}% ▶`;
          }
        },
      });
      hide(el);
      if (r === -1 || r === 4) return;
      idx = r;
      if (r === 0) Settings.set('bgm', !s.bgm);
      else if (r === 1) Settings.set('sfx', !s.sfx);
      else if (r === 2) Settings.set('volume', s.volume >= 1 ? 0.1 : Math.round((s.volume + 0.1) * 10) / 10);
      else if (r === 3) Settings.set('touch', s.touch === null ? true : (s.touch ? false : null));
    }
  }

  // ---------- 店 ----------
  async function shop(shopId) {
    const def = SHOPS[shopId];
    showGold();
    try {
      while (true) {
        await sayNoWait(T.shopWhatBuy);
        const mode = await choose([T.shopBuy, T.shopSell, T.shopLeave]);
        if (mode === 2) break;
        if (mode === 0) await shopBuy(def);
        else await shopSell();
      }
    } finally {
      hideMsg();
      hideGold(); hide($('shopwin')); hide($('shopinfo')); setHelp('');
    }
  }

  // メッセージを出したまま次へ進む（店の常時表示用）
  function sayNoWait(text) {
    const win = $('msgwin'), txt = $('msgtext');
    show(win); hide($('msgnext'));
    txt.textContent = text;
  }
  function hideMsg() { hide($('msgwin')); }

  async function shopBuy(def) {
    while (true) {
      showGold();
      const el = $('shopwin');
      el.innerHTML = '<ul class="menu" id="shoplist"></ul>';
      const items = def.items.map(id => {
        const d = ITEMS[id] || EQUIPS[id];
        return {
          label: d.name, rval: T.priceTag(d.price), id,
          disabled: d.price > G.gold,
        };
      });
      const info = $('shopinfo');
      show(info);
      const r = await pick(el, $('shoplist'), items, {
        cancelable: true,
        onMove: (i) => {
          const id = items[i].id;
          const d = ITEMS[id] || EQUIPS[id];
          let txt = `<div style="font-size:0.95em">${T.ownedTag(G.inv[id] || 0)}</div>`;
          if (EQUIPS[id]) {
            const e = EQUIPS[id];
            const st = ['atk', 'def', 'spd', 'mag'].filter(k => e[k]).map(k =>
              `${{ atk: T.stAtk, def: T.stDef, spd: T.stSpd, mag: T.stMag }[k]}+${e[k]}`).join(' ');
            const who = e.who.map(w => CHARACTERS[w].name).join('・');
            txt += `<div style="font-size:0.95em">${st}</div><div style="font-size:0.85em;color:var(--txt-dim)">装備可: ${who}</div>`;
          } else {
            txt += `<div style="font-size:0.9em">${d.desc || ''}</div>`;
          }
          info.innerHTML = txt;
        },
      });
      hide(el); hide(info);
      if (r === -1) return;
      const id = items[r].id;
      const d = ITEMS[id] || EQUIPS[id];
      if (G.gold < d.price) { await say(T.shopNoMoney); continue; }
      if ((G.inv[id] || 0) >= 99) { await say(T.shopBagFull); continue; }
      G.gold -= d.price;
      addItem(id);
      AudioSys.sfx('confirm');
      await say(T.shopGotIt(d.name));
    }
  }

  async function shopSell() {
    while (true) {
      showGold();
      const ids = Object.keys(G.inv).filter(id => {
        const d = ITEMS[id] || EQUIPS[id];
        return d && d.type !== 'key';
      });
      if (!ids.length) { await say(T.shopNoItems); return; }
      const el = $('shopwin');
      el.innerHTML = '<ul class="menu" id="shoplist"></ul>';
      const items = ids.map(id => {
        const d = ITEMS[id] || EQUIPS[id];
        const sellPrice = Math.floor((d.price || 0) / 2);
        return { label: `${d.name} ×${G.inv[id]}`, rval: T.priceTag(sellPrice), id, price: sellPrice };
      });
      const r = await pick(el, $('shoplist'), items, { cancelable: true });
      hide(el);
      if (r === -1) return;
      const it = items[r];
      const d = ITEMS[it.id] || EQUIPS[it.id];
      removeItem(it.id);
      G.gold += it.price;
      AudioSys.sfx('confirm');
      showGold();
      await say(T.shopSold(d.name, it.price));
    }
  }

  // ---------- 戦闘UI ----------
  function showBattleUI(on) {
    const ids = ['bhud', 'blog'];
    for (const id of ids) (on ? show : hide)($(id));
    if (!on) { hide($('bcmd')); hide($('bsub')); $('blog').innerHTML = ''; }
  }

  function updateBattleHud(activeIdx, bstate) {
    const hud = $('bhud');
    hud.innerHTML = G.party.map((m, i) => {
      const hpR = clamp(m.hp / maxHp(m), 0, 1);
      const mpR = maxMp(m) ? clamp(m.mp / maxMp(m), 0, 1) : 0;
      return `<div class="pstat ${i === activeIdx ? 'turn' : ''} ${m.hp <= 0 ? 'dead' : ''}">
        <span class="nm">${memberName(m)}</span> <small>Lv${m.level}</small>
        <div class="bar"><i class="${hpR < 0.3 ? 'low' : ''}" style="width:${hpR * 100}%"></i></div>
        <div style="font-size:0.85em">HP ${m.hp}/${maxHp(m)}</div>
        <div class="bar mp"><i style="width:${mpR * 100}%"></i></div>
        <div style="font-size:0.85em">MP ${m.mp}/${maxMp(m)}</div>
        <div class="stags">${statusTags(m, bstate)}</div>
      </div>`;
    }).join('');
  }

  const blogLines = [];
  function blog(text) {
    blogLines.push(text);
    while (blogLines.length > 3) blogLines.shift();
    $('blog').innerHTML = blogLines.map((l, i) =>
      `<div style="opacity:${i === blogLines.length - 1 ? 1 : 0.55}">${escapeHtml(l)}</div>`).join('');
  }

  // 待機（Aボタンでスキップ可能）
  function bwait(ms) {
    return new Promise((res) => {
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        const i = stack.indexOf(comp);
        if (i >= 0) stack.splice(i, 1);
        res();
      };
      const comp = { handleButton(btn) { if (btn === 'a') finish(); return true; } };
      stack.push(comp);
      setTimeout(finish, REDUCED_MOTION ? Math.min(ms, 350) : ms);
    });
  }

  // 戦闘コマンド選択 → {type, target?, skill?, item?} / 'redo'
  async function battleCommand(m, idx, ctx) {
    updateBattleHud(idx, ctx.bstate);
    while (true) {
      const cmds = [
        { label: T.cmdAttack }, { label: T.cmdSkill, disabled: !memberSkills(m).length },
        { label: T.cmdItem, disabled: !battleItems().length }, { label: T.cmdGuard },
        { label: T.cmdRun, disabled: !ctx.canRun },
      ];
      blogReplaceHint(`${memberName(m)} のコマンド`);
      const c = await pick($('bcmd'), $('bcmdlist'), cmds, { cancelable: true });
      if (c === -1) return 'redo';
      if (c === 0) { // たたかう
        const t = await pickEnemyTarget(ctx);
        if (t === null) continue;
        return { type: 'attack', target: t };
      }
      if (c === 1) { // スキル
        const skills = memberSkills(m);
        const items = skills.map(sid => {
          const sk = SKILLS[sid];
          return { label: sk.name, rval: `MP${sk.mp}`, sid, disabled: m.mp < sk.mp };
        });
        const r = await pick($('bsub'), $('bsublist'), items, {
          cancelable: true,
          onMove: (i) => blogReplaceHint(SKILLS[items[i].sid].desc || ''),
        });
        hide($('bsub'));
        if (r === -1) continue;
        const sk = SKILLS[items[r].sid];
        let target = null;
        if (sk.target === 'enemy') {
          target = await pickEnemyTarget(ctx);
          if (target === null) continue;
        } else if (sk.target === 'ally') {
          const ti = await pickAllyTarget(ctx);
          if (ti === null) continue;
          target = { isParty: true, m: G.party[ti] };
        }
        return { type: 'skill', skill: items[r].sid, target };
      }
      if (c === 2) { // どうぐ
        const usable = battleItems();
        const items = usable.map(id => ({ label: `${ITEMS[id].name} ×${G.inv[id]}`, id }));
        const r = await pick($('bsub'), $('bsublist'), items, {
          cancelable: true,
          onMove: (i) => blogReplaceHint(ITEMS[items[i].id].desc || ''),
        });
        hide($('bsub'));
        if (r === -1) continue;
        const ti = await pickAllyTarget(ctx);
        if (ti === null) continue;
        return { type: 'item', item: items[r].id, target: { isParty: true, m: G.party[ti] } };
      }
      if (c === 3) return { type: 'guard' };
      if (c === 4) return { type: 'run' };
    }
  }
  function battleCommandHide() { hide($('bcmd')); hide($('bsub')); }

  function battleItems() {
    return Object.keys(G.inv).filter(id => ITEMS[id] && ITEMS[id].type === 'use' && !ITEMS[id].warpTown && !ITEMS[id].permanent);
  }

  function blogReplaceHint(text) {
    blog(text);
    blogLines.pop(); // ヒントはログ履歴に残さない
    $('blog').innerHTML = [...blogLines, text].map((l, i, a) =>
      `<div style="opacity:${i === a.length - 1 ? 1 : 0.55}">${escapeHtml(l)}</div>`).join('');
  }

  async function pickEnemyTarget(ctx) {
    const alive = ctx.enemies.filter(e => e.alive);
    if (alive.length === 1) return { isParty: false, e: alive[0] };
    const items = alive.map(e => ({ label: e.name, rval: `HP${Math.ceil(e.hp / e.maxHp * 100)}%` }));
    const r = await pick($('bsub'), $('bsublist'), items, {
      cancelable: true,
      onMove: (i) => {
        alive.forEach((e, j) => { e.spr.tint = j === i ? 0xffe080 : 0xffffff; });
      },
    });
    alive.forEach(e => { e.spr.tint = 0xffffff; });
    hide($('bsub'));
    if (r === -1) return null;
    return { isParty: false, e: alive[r] };
  }

  async function pickAllyTarget(ctx) {
    const items = G.party.map(m => ({
      label: `${memberName(m)}${m.hp <= 0 ? '（戦闘不能）' : ''}`,
      rval: `HP ${m.hp}/${maxHp(m)}`,
    }));
    const r = await pick($('bsub'), $('bsublist'), items, { cancelable: true });
    hide($('bsub'));
    return r === -1 ? null : r;
  }

  return {
    handleButton, isOpen, say, choose, pick, setHelp, openMenu, shop,
    showBattleUI, updateBattleHud, blog, bwait, battleCommand, battleCommandHide,
    menuSettings, showGold,
  };
})();
