// ============================================================
// 起動 / タイトル / エンディング
// ============================================================
'use strict';

// ---------- タイトル ----------
Game.register('title', {
  async enter(arg) {
    Layers.field.visible = false;
    Layers.battle.visible = false;
    const title = document.getElementById('title');
    title.classList.remove('hidden');
    AudioSys.playBgm('town');
    UI.setHelp(T.helpMenu);

    // 星屑
    const stars = document.getElementById('titlestars');
    if (!stars.children.length) {
      for (let i = 0; i < 60; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
        s.style.width = s.style.height = (1 + Math.random() * 2).toFixed(1) + 'px';
        stars.appendChild(s);
      }
    }

    while (true) {
      const hasSave = SaveSys.hasSave();
      const items = [
        { label: T.newGame },
        { label: T.continueGame, disabled: !hasSave },
        { label: T.settings },
      ];
      const r = await UI.pick(document.getElementById('title').querySelector('.win'),
        document.getElementById('titlemenu'), items, { cancelable: false, startIdx: hasSave ? 1 : 0 });
      if (r === 0) {
        G = attachHelpers(newGameState());
        break;
      }
      if (r === 1) {
        const loaded = SaveSys.load();
        if (loaded) { G = loaded; break; }
        // 壊れたセーブ → 新規開始へフォールバック
        await UI.say(T.brokenSave);
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
        G = attachHelpers(newGameState());
        break;
      }
      if (r === 2) {
        await UI.menuSettings();
        document.getElementById('subwin').classList.add('hidden');
      }
    }

    await Fx.fadeOut();
    title.classList.add('hidden');
    await Game.setState('field', { rebuild: true, fadeIn: true });
  },
  exit() { },
  onButton(btn) { UI.handleButton(btn); },
});

// ---------- エンディング ----------
Game.register('ending', {
  async enter() {
    AudioSys.playBgm('ending');
    const el = document.getElementById('ending');
    const inner = el.querySelector('.inner');
    const purify = !!G.flags.ending_purify;
    el.classList.remove('hidden');

    const lines = purify ? [
      '浄化された冥晶核は星々の欠片となり、',
      '砕けた星核はゆっくりと天に還っていった。',
      '',
      '大陸エルディアに、柔らかな星明かりが戻る。',
      'ザルヴァもまた、星核の毒に蝕まれた',
      'ひとりの王であったことを、人々は知らない。',
      '',
      'アレンたちの選んだ「赦し」は、',
      'やがて新しい星の伝説として語り継がれる——',
      '',
      T.theEndA,
    ] : [
      '砕かれた冥晶核の破片は風に散り、',
      '二度と禍を成すことはなかった。',
      '',
      '大陸エルディアに朝が戻る。',
      '人々は英雄たちの「決断」を讃え、',
      '剣の祭りを毎年欠かさず開いたという。',
      '',
      'だが夜空の何処かで、小さな晶のかけらが',
      '今も微かに明滅している——',
      '',
      T.theEndB,
    ];
    inner.innerHTML = '';
    for (let i = 0; i < lines.length; i++) {
      await new Promise(r => setTimeout(r, REDUCED_MOTION ? 60 : 650));
      inner.innerHTML += (i ? '\n' : '') + lines[i];
    }
    inner.innerHTML += `\n\n<span style="color:var(--accent)">${T.pressToTitle}</span>`;
    this._ready = true;
  },
  exit() {
    document.getElementById('ending').classList.add('hidden');
    this._ready = false;
  },
  onButton(btn) {
    if (!this._ready) return;
    if (btn === 'a') {
      // クリア後も続けられるようセーブデータは維持。タイトルへ。
      AudioSys.stopBgm();
      Game.setState('title');
    }
  },
});

// ---------- 起動 ----------
(async function boot() {
  try {
    GFX.init();
    await initPixi();
    Fx.init();
    Settings.load();
    Input.initTouch();
    fitStage();

    // マップデータの簡易整合性チェック（開発時の検出用）
    for (const [id, m] of Object.entries(MAPS)) {
      const w = Math.max(...m.rows.map(r => r.length));
      m.rows = m.rows.map(r => r.padEnd(w, m.pad || 'V'));
    }

    await Game.setState('title');
  } catch (err) {
    console.error(err);
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:#05060f;text-align:center;padding:2em;';
    div.textContent = 'ゲームの起動に失敗しました。ページを再読み込みしてください。';
    document.getElementById('stage').appendChild(div);
  }
})();
