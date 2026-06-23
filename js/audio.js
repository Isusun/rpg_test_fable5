// ============================================================
// オーディオ（WebAudioで全生成。外部音源なし）
// BGM: 場面別ループ曲 / SFX: 短い効果音
// デフォルトはOFF。設定はlocalStorageに永続化（engine.js側）。
// ============================================================
'use strict';

const AudioSys = (() => {
  let ctx = null;
  let master, bgmGain, sfxGain;
  let settings = { bgm: false, sfx: false, volume: 0.7 };
  let currentTrack = null;
  let schedTimer = null;
  let nextNoteTime = 0;
  let seqPos = 0;

  function ensureCtx() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      // ソフトリミッターで音割れ防止
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 8; comp.knee.value = 10;
      master.connect(comp); comp.connect(ctx.destination);
      bgmGain = ctx.createGain(); bgmGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.connect(master);
      applyVolumes();
      return true;
    } catch (e) { return false; }
  }

  function applyVolumes() {
    if (!ctx) return;
    master.gain.value = settings.volume * 0.8;
    bgmGain.gain.value = settings.bgm ? 0.5 : 0;
    sfxGain.gain.value = settings.sfx ? 0.8 : 0;
  }

  function setSettings(s) {
    settings = { ...settings, ...s };
    if (settings.bgm || settings.sfx) ensureCtx();
    applyVolumes();
    if (!settings.bgm) stopSequencer();
    else if (currentTrack) startSequencer();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function getSettings() { return { ...settings }; }

  // 音名 → 周波数（midi番号）
  const f = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- BGMトラック定義 ----------
  // lead/bass: [midi, 拍長] 配列。midi=0 は休符。
  const N = (s) => { // 'C4'等を midi に
    if (s === '-') return 0;
    const names = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let i = 0, n = names[s[i++]];
    if (s[i] === '#') { n++; i++; } if (s[i] === 'b') { n--; i++; }
    return n + 12 * (parseInt(s[i], 10) + 1);
  };
  // 文字列 'C4:1 E4:0.5 ...' をパース
  const seq = (str) => str.trim().split(/\s+/).map(t => {
    const [note, d] = t.split(':');
    return [N(note), parseFloat(d || '1')];
  });

  const TRACKS = {
    town: {
      bpm: 96, leadType: 'square', bassType: 'triangle',
      lead: seq(`G4:1 A4:1 B4:1 D5:1 B4:1 A4:1 G4:2
                 E4:1 G4:1 A4:1 B4:1 A4:2 G4:2
                 G4:1 A4:1 B4:1 D5:1 E5:1 D5:1 B4:2
                 A4:1 B4:1 A4:1 G4:1 E4:2 G4:2`),
      bass: seq(`G2:2 D3:2 G2:2 D3:2 C3:2 G2:2 D3:2 G2:2
                 G2:2 D3:2 E3:2 B2:2 C3:2 D3:2 G2:4`),
    },
    field: {
      bpm: 112, leadType: 'square', bassType: 'triangle',
      lead: seq(`E4:1 G4:1 A4:1 B4:1.5 A4:0.5 G4:1 E4:1
                 D4:1 E4:1 G4:1 A4:2 G4:1 E4:1
                 E4:1 G4:1 A4:1 B4:1 D5:1.5 B4:0.5 A4:1 G4:1
                 A4:1 G4:1 E4:1 D4:1 E4:4`),
      bass: seq(`E2:2 B2:2 E2:2 B2:2 D2:2 A2:2 D2:2 A2:2
                 E2:2 B2:2 G2:2 D3:2 A2:2 B2:2 E2:4`),
    },
    dungeon: {
      bpm: 84, leadType: 'square', bassType: 'triangle',
      lead: seq(`A3:2 C4:1 B3:1 A3:2 E4:2
                 F4:1.5 E4:0.5 D4:1 C4:1 B3:4
                 A3:2 C4:1 D4:1 E4:2 G4:2
                 F4:1 E4:1 D4:1 B3:1 A3:4`),
      bass: seq(`A1:4 A1:4 F2:4 E2:4 A1:4 C2:4 D2:4 E2:4`),
    },
    battle: {
      bpm: 150, leadType: 'square', bassType: 'sawtooth',
      lead: seq(`A4:0.5 A4:0.5 C5:0.5 A4:0.5 E5:1 D5:0.5 C5:0.5
                 B4:0.5 B4:0.5 D5:0.5 B4:0.5 F5:1 E5:0.5 D5:0.5
                 C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 D5:1
                 C5:0.5 B4:0.5 C5:0.5 D5:0.5 B4:1 E4:1`),
      bass: seq(`A2:0.5 A2:0.5 A2:0.5 A2:0.5 A2:0.5 A2:0.5 G2:0.5 G2:0.5
                 G2:0.5 G2:0.5 G2:0.5 G2:0.5 F2:0.5 F2:0.5 E2:0.5 E2:0.5
                 F2:0.5 F2:0.5 F2:0.5 F2:0.5 G2:0.5 G2:0.5 G2:0.5 G2:0.5
                 A2:0.5 A2:0.5 E2:0.5 E2:0.5 A2:1 E2:1`),
    },
    boss: {
      bpm: 160, leadType: 'sawtooth', bassType: 'sawtooth',
      lead: seq(`D5:0.5 D5:0.5 D5:0.5 C5:0.5 D5:1 A4:1
                 Bb4:0.5 Bb4:0.5 Bb4:0.5 A4:0.5 Bb4:1 F4:1
                 G4:0.5 A4:0.5 Bb4:0.5 C5:0.5 D5:1 F5:1
                 E5:0.5 D5:0.5 C#5:0.5 D5:0.5 A4:2`),
      bass: seq(`D2:0.5 D2:0.5 D3:0.5 D2:0.5 D2:0.5 D3:0.5 D2:0.5 D2:0.5
                 Bb1:0.5 Bb1:0.5 Bb2:0.5 Bb1:0.5 Bb1:0.5 Bb2:0.5 Bb1:0.5 Bb1:0.5
                 G1:0.5 G1:0.5 G2:0.5 G1:0.5 D2:0.5 D2:0.5 D3:0.5 D2:0.5
                 A1:0.5 A1:0.5 A2:0.5 A1:0.5 A1:1 A2:1`),
    },
    ending: {
      bpm: 80, leadType: 'triangle', bassType: 'triangle',
      lead: seq(`C5:2 B4:1 A4:1 G4:2 E4:2
                 F4:1 G4:1 A4:2 G4:4
                 C5:2 B4:1 A4:1 G4:1 E4:1 G4:2
                 A4:1 G4:1 E4:1 D4:1 C4:4`),
      bass: seq(`C3:4 G2:4 F2:4 G2:4 C3:4 E2:4 F2:2 G2:2 C3:4`),
    },
  };

  function buildEvents(track) {
    const spb = 60 / track.bpm;
    const ev = [];
    let dur = { lead: 0, bass: 0 };
    for (const ch of ['lead', 'bass']) {
      let t = 0;
      for (const [m, d] of track[ch]) {
        if (m > 0) ev.push({ t: t * spb, midi: m, d: d * spb, ch });
        t += d;
      }
      dur[ch] = t * spb;
    }
    return { ev: ev.sort((a, b) => a.t - b.t), len: Math.max(dur.lead, dur.bass) };
  }

  function playNote(midi, when, dur, type, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = f(midi);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.012);
    g.gain.setValueAtTime(vol, when + Math.max(0.012, dur * 0.6));
    g.gain.linearRampToValueAtTime(0.0001, when + dur * 0.95);
    o.connect(g); g.connect(bgmGain);
    o.start(when); o.stop(when + dur);
  }

  function stopSequencer() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  function startSequencer() {
    stopSequencer();
    if (!ctx || !settings.bgm || !currentTrack) return;
    const track = TRACKS[currentTrack];
    if (!track) return;
    const { ev, len } = buildEvents(track);
    nextNoteTime = ctx.currentTime + 0.08;
    seqPos = 0;
    const tick = () => {
      if (!settings.bgm) { stopSequencer(); return; }
      while (nextNoteTime < ctx.currentTime + 0.3) {
        for (const e of ev) {
          const when = nextNoteTime + e.t;
          if (when >= ctx.currentTime - 0.01) {
            const vol = e.ch === 'lead' ? 0.055 : 0.07;
            playNote(e.midi, when, e.d, e.ch === 'lead' ? track.leadType : track.bassType, vol);
          }
        }
        nextNoteTime += len;
        seqPos++;
      }
    };
    tick();
    schedTimer = setInterval(tick, 120);
  }

  function playBgm(name) {
    if (currentTrack === name) return;
    currentTrack = name;
    if (!settings.bgm) return;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    startSequencer();
  }
  function stopBgm() { currentTrack = null; stopSequencer(); }

  // ---------- SFX ----------
  function blip(freq0, freq1, dur, type, vol, delay = 0) {
    if (!settings.sfx || !ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseHit(dur, vol, delay = 0) {
    if (!settings.sfx || !ensureCtx()) return;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1800;
    src.connect(flt); flt.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  const SFX = {
    cursor: () => blip(880, 1100, 0.06, 'square', 0.15),
    confirm: () => { blip(660, 990, 0.09, 'square', 0.18); },
    cancel: () => blip(440, 220, 0.1, 'square', 0.15),
    attack: () => { noiseHit(0.12, 0.35); blip(300, 80, 0.12, 'sawtooth', 0.2); },
    hit: () => { noiseHit(0.16, 0.4); blip(180, 60, 0.16, 'square', 0.22); },
    crit: () => { noiseHit(0.22, 0.5); blip(500, 60, 0.2, 'sawtooth', 0.3); blip(800, 100, 0.18, 'square', 0.2, 0.04); },
    magic: () => { blip(400, 1600, 0.25, 'sine', 0.22); blip(600, 2000, 0.22, 'triangle', 0.15, 0.05); },
    heal: () => { blip(523, 784, 0.12, 'sine', 0.2); blip(659, 1046, 0.14, 'sine', 0.18, 0.1); },
    miss: () => blip(500, 300, 0.1, 'sine', 0.12),
    run: () => { blip(600, 300, 0.08, 'square', 0.12); blip(500, 250, 0.08, 'square', 0.12, 0.08); blip(400, 200, 0.08, 'square', 0.12, 0.16); },
    levelup: () => { [523, 659, 784, 1046].forEach((fr, i) => blip(fr, fr, 0.14, 'square', 0.16, i * 0.1)); },
    victory: () => { [659, 659, 659, 880].forEach((fr, i) => blip(fr, fr, i === 3 ? 0.3 : 0.1, 'square', 0.16, i * 0.12)); },
    chest: () => { blip(660, 880, 0.1, 'square', 0.16); blip(880, 1320, 0.16, 'square', 0.16, 0.1); },
    door: () => { blip(150, 90, 0.2, 'square', 0.18); noiseHit(0.15, 0.18, 0.02); },
    save: () => { blip(784, 784, 0.1, 'sine', 0.16); blip(1046, 1046, 0.18, 'sine', 0.16, 0.1); },
    poison: () => blip(300, 150, 0.25, 'triangle', 0.18),
    sleep: () => { blip(700, 500, 0.2, 'sine', 0.12); blip(600, 400, 0.2, 'sine', 0.1, 0.18); },
    stairs: () => { blip(400, 200, 0.12, 'triangle', 0.14); blip(300, 150, 0.12, 'triangle', 0.12, 0.1); },
    gameover: () => { [392, 370, 349, 330].forEach((fr, i) => blip(fr, fr * 0.97, 0.3, 'triangle', 0.16, i * 0.25)); },
    barrier: () => { blip(1200, 400, 0.3, 'sawtooth', 0.15); },
    push: () => { noiseHit(0.25, 0.25); blip(120, 60, 0.25, 'triangle', 0.2); },
    encounter: () => { blip(200, 800, 0.18, 'sawtooth', 0.16); blip(800, 200, 0.18, 'sawtooth', 0.16, 0.14); },
  };

  function sfx(name) { if (SFX[name]) SFX[name](); }

  // ユーザー操作でAudioContext解禁
  function unlock() {
    if (settings.bgm || settings.sfx) {
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (settings.bgm && currentTrack && !schedTimer) startSequencer();
    }
  }

  return { playBgm, stopBgm, sfx, setSettings, getSettings, unlock };
})();
