// ============================================================
// プロシージャル・グラフィック（タイル / キャラ / 敵 / 背景）
// すべてCanvas2Dで生成し PIXI.Texture 化する。外部アセット不使用。
// ============================================================
'use strict';

const TILE = 16;

const GFX = (() => {
  // 決定的な疑似乱数（テクスチャを毎回同じ見た目に）
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    return [c, g];
  }

  function tex(canvas) {
    const t = PIXI.Texture.from(canvas);
    t.source.scaleMode = 'nearest';
    return t;
  }

  // ---------- タイル ----------
  function speckle(g, r, base, dots, n, size = 1) {
    g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < n; i++) {
      g.fillStyle = dots[Math.floor(r() * dots.length)];
      g.fillRect(Math.floor(r() * TILE), Math.floor(r() * TILE), size, size);
    }
  }

  const tileMakers = {
    grass(g, r) { speckle(g, r, '#3e8b41', ['#357a38', '#4a9c4d', '#2f6e32', '#56a85a'], 26); },
    grass2(g, r) { speckle(g, r, '#37803a', ['#2f6e32', '#418f44', '#56a85a'], 22); },
    path(g, r) { speckle(g, r, '#b59a6a', ['#a78c5e', '#c2a877', '#9d8456'], 20); },
    sand(g, r) { speckle(g, r, '#d9c389', ['#cdb77d', '#e3cf97', '#c2ac72'], 18); },
    water(g, r) {
      speckle(g, r, '#2b62b8', ['#2557a6', '#356fc7', '#1f4c94'], 14);
      g.strokeStyle = '#5a92d9'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const y = 3 + i * 5;
        g.beginPath(); g.moveTo(1 + r() * 3, y); g.lineTo(6 + r() * 3, y); g.stroke();
      }
    },
    deepwater(g, r) { speckle(g, r, '#1e4685', ['#193b73', '#244f94'], 12); },
    tree(g, r) {
      tileMakers.grass(g, r);
      g.fillStyle = '#5d4023'; g.fillRect(6, 11, 4, 4);
      g.fillStyle = '#1f5c24'; g.beginPath(); g.arc(8, 7, 6.5, 0, 7); g.fill();
      g.fillStyle = '#2e7a33'; g.beginPath(); g.arc(6.5, 5.5, 4.5, 0, 7); g.fill();
      g.fillStyle = '#3f9445'; g.beginPath(); g.arc(6, 5, 2.4, 0, 7); g.fill();
    },
    mountain(g, r) {
      tileMakers.grass(g, r);
      g.fillStyle = '#7d7466';
      g.beginPath(); g.moveTo(0, 15); g.lineTo(8, 1); g.lineTo(16, 15); g.closePath(); g.fill();
      g.fillStyle = '#968c7c';
      g.beginPath(); g.moveTo(3, 15); g.lineTo(8, 4); g.lineTo(11, 11); g.closePath(); g.fill();
      g.fillStyle = '#e8e6e0';
      g.beginPath(); g.moveTo(6, 4.5); g.lineTo(8, 1); g.lineTo(10, 4.5); g.closePath(); g.fill();
    },
    wall(g, r) {
      speckle(g, r, '#6b6b7a', ['#5f5f6e', '#777787'], 8);
      g.strokeStyle = '#4a4a58'; g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, 15, 7); g.strokeRect(0.5, 8.5, 7, 7); g.strokeRect(8.5, 8.5, 7, 7);
      g.fillStyle = '#82829299';
      g.fillRect(1, 1, 14, 2); g.fillRect(1, 9, 6, 2); g.fillRect(9, 9, 6, 2);
    },
    darkwall(g, r) {
      speckle(g, r, '#3d3a52', ['#34314a', '#46425e'], 8);
      g.strokeStyle = '#262338'; g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, 15, 7); g.strokeRect(0.5, 8.5, 7, 7); g.strokeRect(8.5, 8.5, 7, 7);
      g.fillStyle = '#55517099'; g.fillRect(1, 1, 14, 2);
    },
    floor(g, r) {
      speckle(g, r, '#8e8aa0', ['#827e94', '#9a96ac'], 10);
      g.strokeStyle = '#76728820'; g.strokeRect(0.5, 0.5, 15, 15);
    },
    darkfloor(g, r) {
      speckle(g, r, '#4c4862', ['#444058', '#54506c'], 10);
      g.strokeStyle = '#3a364e'; g.strokeRect(0.5, 0.5, 15, 15);
    },
    wood(g, r) {
      g.fillStyle = '#9c7748'; g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#83613a'; g.lineWidth = 1;
      for (let y = 3.5; y < 16; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y); g.stroke(); }
      g.fillStyle = '#8a6a40';
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 2, 1);
    },
    bridge(g, r) {
      tileMakers.water(g, r);
      g.fillStyle = '#9c7748'; g.fillRect(0, 2, 16, 12);
      g.strokeStyle = '#7a5a33';
      for (let x = 2.5; x < 16; x += 4) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x, 14); g.stroke(); }
      g.fillStyle = '#6b4e2c'; g.fillRect(0, 1, 16, 2); g.fillRect(0, 13, 16, 2);
    },
    roof(g, r) {
      g.fillStyle = '#b04a3c'; g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#8e3a30'; g.lineWidth = 1;
      for (let y = 2.5; y < 16; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y); g.stroke(); }
      g.fillStyle = '#c75a4a'; g.fillRect(0, 0, 16, 2);
    },
    roofblue(g, r) {
      g.fillStyle = '#3c5ab0'; g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#30488e'; g.lineWidth = 1;
      for (let y = 2.5; y < 16; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y); g.stroke(); }
      g.fillStyle = '#4a6ac7'; g.fillRect(0, 0, 16, 2);
    },
    housewall(g, r) {
      g.fillStyle = '#d9cdb0'; g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#b8ab8c'; g.strokeRect(0.5, 0.5, 15, 15);
      g.fillStyle = '#8a6a40'; g.fillRect(2, 2, 12, 2);
    },
    door(g, r) {
      tileMakers.housewall(g, r);
      g.fillStyle = '#6b4e2c'; g.fillRect(3, 3, 10, 13);
      g.fillStyle = '#83613a'; g.fillRect(4, 4, 8, 12);
      g.fillStyle = '#ffd966'; g.fillRect(10, 9, 2, 2);
    },
    fence(g, r) {
      tileMakers.grass(g, r);
      g.fillStyle = '#8a6a40'; g.fillRect(0, 6, 16, 3);
      g.fillRect(2, 4, 3, 10); g.fillRect(11, 4, 3, 10);
      g.fillStyle = '#a07c4c'; g.fillRect(2, 4, 3, 2); g.fillRect(11, 4, 3, 2);
    },
    counter(g, r) {
      g.fillStyle = '#9c7748'; g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = '#b58a55'; g.fillRect(0, 0, 16, 5);
      g.strokeStyle = '#7a5a33'; g.strokeRect(0.5, 0.5, 15, 15);
    },
    crystal(g, r) {
      tileMakers.darkfloor(g, r);
      const gr = g.createLinearGradient(4, 2, 12, 14);
      gr.addColorStop(0, '#c9b8ff'); gr.addColorStop(1, '#7a5ad9');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(8, 1); g.lineTo(13, 8); g.lineTo(8, 15); g.lineTo(3, 8); g.closePath(); g.fill();
      g.fillStyle = '#ffffffaa'; g.beginPath(); g.moveTo(8, 2); g.lineTo(10, 6); g.lineTo(7, 7); g.closePath(); g.fill();
    },
    chest(g, r) {
      g.fillStyle = '#6b4e2c'; g.fillRect(2, 4, 12, 10);
      g.fillStyle = '#8a6a40'; g.fillRect(3, 5, 10, 4);
      g.fillStyle = '#5a4226'; g.fillRect(2, 9, 12, 1);
      g.fillStyle = '#ffd966'; g.fillRect(7, 8, 2, 3);
      g.strokeStyle = '#3d2d1a'; g.strokeRect(2.5, 4.5, 11, 9);
    },
    chestOpen(g, r) {
      g.fillStyle = '#5a4226'; g.fillRect(2, 3, 12, 3);
      g.fillStyle = '#6b4e2c'; g.fillRect(2, 7, 12, 7);
      g.fillStyle = '#2d2114'; g.fillRect(3, 8, 10, 5);
      g.strokeStyle = '#3d2d1a'; g.strokeRect(2.5, 7.5, 11, 6);
    },
    lockdoor(g, r) {
      tileMakers.darkwall(g, r);
      g.fillStyle = '#5a4226'; g.fillRect(2, 2, 12, 14);
      g.fillStyle = '#6b4e2c'; g.fillRect(3, 3, 10, 13);
      g.fillStyle = '#c9b84a'; g.beginPath(); g.arc(8, 8, 2.5, 0, 7); g.fill();
      g.fillStyle = '#5a4226'; g.fillRect(7, 8, 2, 4);
    },
    gate(g, r) {
      tileMakers.darkfloor(g, r);
      g.fillStyle = '#8a8a9a';
      for (let x = 2; x < 16; x += 4) g.fillRect(x, 0, 2, 16);
      g.fillStyle = '#6b6b7a'; g.fillRect(0, 2, 16, 2); g.fillRect(0, 11, 16, 2);
    },
    rock(g, r) {
      g.fillStyle = '#7d7466';
      g.beginPath(); g.arc(8, 9, 6.5, 0, 7); g.fill();
      g.fillStyle = '#968c7c'; g.beginPath(); g.arc(6.5, 7, 4, 0, 7); g.fill();
      g.fillStyle = '#aaa093'; g.beginPath(); g.arc(6, 6.5, 2, 0, 7); g.fill();
      g.strokeStyle = '#5d5648'; g.beginPath(); g.arc(8, 9, 6.5, 0, 7); g.stroke();
    },
    switchOff(g, r) {
      tileMakers.darkfloor(g, r);
      g.fillStyle = '#33304a'; g.fillRect(3, 3, 10, 10);
      g.fillStyle = '#8a4a4a'; g.beginPath(); g.arc(8, 8, 3, 0, 7); g.fill();
      g.strokeStyle = '#262338'; g.strokeRect(3.5, 3.5, 9, 9);
    },
    switchOn(g, r) {
      tileMakers.darkfloor(g, r);
      g.fillStyle = '#33304a'; g.fillRect(3, 3, 10, 10);
      g.fillStyle = '#6fdc6f'; g.beginPath(); g.arc(8, 8, 3, 0, 7); g.fill();
      g.strokeStyle = '#262338'; g.strokeRect(3.5, 3.5, 9, 9);
    },
    caveIn(g, r) {
      tileMakers.mountain(g, r);
      g.fillStyle = '#1a1626'; g.beginPath(); g.arc(8, 13, 5, Math.PI, 0); g.fill(); g.fillRect(3, 13, 10, 3);
    },
    stairsDown(g, r) {
      tileMakers.darkfloor(g, r);
      g.fillStyle = '#1a1626';
      g.fillRect(3, 3, 10, 10);
      g.fillStyle = '#3a364e'; g.fillRect(3, 3, 10, 3); g.fillStyle = '#2a2740'; g.fillRect(3, 6, 10, 3);
    },
    stairsUp(g, r) {
      tileMakers.floor(g, r);
      g.fillStyle = '#c8c4d8'; g.fillRect(3, 10, 10, 3);
      g.fillStyle = '#aaa6bc'; g.fillRect(3, 7, 10, 3);
      g.fillStyle = '#8e8aa0'; g.fillRect(3, 4, 10, 3);
      g.strokeStyle = '#5a5670'; g.strokeRect(3.5, 3.5, 9, 9);
    },
    carpet(g, r) {
      g.fillStyle = '#8e3a4a'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#a84a5a'; g.fillRect(2, 2, 12, 12);
      g.fillStyle = '#c9b84a'; g.fillRect(7, 7, 2, 2);
    },
    sign(g, r) {
      tileMakers.grass(g, r);
      g.fillStyle = '#6b4e2c'; g.fillRect(7, 8, 2, 7);
      g.fillStyle = '#9c7748'; g.fillRect(2, 3, 12, 6);
      g.strokeStyle = '#5a4226'; g.strokeRect(2.5, 3.5, 11, 5);
      g.fillStyle = '#5a4226'; g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1);
    },
    well(g, r) {
      tileMakers.grass(g, r);
      g.fillStyle = '#6b6b7a'; g.beginPath(); g.arc(8, 9, 6, 0, 7); g.fill();
      g.fillStyle = '#1a2238'; g.beginPath(); g.arc(8, 9, 3.5, 0, 7); g.fill();
      g.strokeStyle = '#4a4a58'; g.beginPath(); g.arc(8, 9, 6, 0, 7); g.stroke();
    },
    flowers(g, r) {
      tileMakers.grass(g, r);
      const cols = ['#ffd966', '#ff8a9a', '#ffffff'];
      for (let i = 0; i < 4; i++) {
        g.fillStyle = cols[Math.floor(r() * 3)];
        const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12);
        g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      }
    },
    lava(g, r) {
      speckle(g, r, '#c74a1e', ['#e8682a', '#a83a16', '#ffae42'], 18);
    },
    void(g, r) { g.fillStyle = '#0a0a14'; g.fillRect(0, 0, 16, 16); },
  };

  const tileTex = {};
  function buildTiles() {
    let seed = 1234;
    for (const k of Object.keys(tileMakers)) {
      const [c, g] = cv(TILE, TILE);
      tileMakers[k](g, rng(seed += 999));
      tileTex[k] = tex(c);
    }
  }

  // ---------- キャラクター（16x16ピクセル、パレットスワップ） ----------
  // . 透明 / 1 輪郭 / 2 肌 / 3 髪 / 4 服主 / 5 服副 / 6 アクセント
  const CHAR_FRAMES = {
    down0: [
      '................',
      '.....111111.....',
      '....13333331....',
      '...1333333331...',
      '...1332332331...',
      '...1322222231...',
      '...1321221231...',
      '...1322222231...',
      '....12222221....',
      '....14444441....',
      '...1444554441...',
      '...1244555421...',
      '...1144444411...',
      '....144..441....',
      '....111..111....',
      '................',
    ],
    down1: [
      '................',
      '.....111111.....',
      '....13333331....',
      '...1333333331...',
      '...1332332331...',
      '...1322222231...',
      '...1321221231...',
      '...1322222231...',
      '....12222221....',
      '....14444441....',
      '...1444554441...',
      '...1244555421...',
      '...1144444411...',
      '...144....441...',
      '...111....111...',
      '................',
    ],
    up0: [
      '................',
      '.....111111.....',
      '....13333331....',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '....13333331....',
      '....14444441....',
      '...1444664441...',
      '...1244666421...',
      '...1144444411...',
      '....144..441....',
      '....111..111....',
      '................',
    ],
    up1: [
      '................',
      '.....111111.....',
      '....13333331....',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '...1333333331...',
      '....13333331....',
      '....14444441....',
      '...1444664441...',
      '...1244666421...',
      '...1144444411...',
      '...144....441...',
      '...111....111...',
      '................',
    ],
    side0: [
      '................',
      '.....111111.....',
      '....13333331....',
      '....13333331....',
      '....13323321....',
      '....13222221....',
      '....13212211....',
      '....13222221....',
      '.....122221.....',
      '.....1444441....',
      '....144455441...',
      '....124455421...',
      '.....1444441....',
      '.....144441.....',
      '.....11111......',
      '................',
    ],
    side1: [
      '................',
      '.....111111.....',
      '....13333331....',
      '....13333331....',
      '....13323321....',
      '....13222221....',
      '....13212211....',
      '....13222221....',
      '.....122221.....',
      '.....1444441....',
      '....144455441...',
      '....124455421...',
      '.....1444441....',
      '....14.4441.....',
      '....11.1111.....',
      '................',
    ],
  };

  // パレット: [輪郭, 肌, 髪, 服主, 服副, アクセント]
  const PALETTES = {
    hero:   ['#1a1426', '#f0c8a0', '#7a4a2a', '#2e7a4a', '#1f5c38', '#ffd966'],
    rina:   ['#1a1426', '#f5d2ae', '#c75a3c', '#8e3a6a', '#6b2a50', '#ffd966'],
    gald:   ['#1a1426', '#dcb088', '#8a8a96', '#3c5ab0', '#2c4488', '#c8c8d8'],
    villager: ['#1a1426', '#f0c8a0', '#5a4226', '#8a7a4c', '#6b5e3a', '#d8c8a0'],
    woman:  ['#1a1426', '#f5d2ae', '#3d2d1a', '#b04a5a', '#8e3a48', '#f0e0c0'],
    elder:  ['#1a1426', '#e8c0a0', '#d8d8d8', '#6b5e8a', '#544a70', '#ffd966'],
    merchant: ['#1a1426', '#e8b890', '#3d2d1a', '#b08a3c', '#8e6e30', '#ffd966'],
    guard:  ['#1a1426', '#e0b890', '#4a3a20', '#7a7a88', '#5e5e6c', '#c84a3a'],
    kid:    ['#1a1426', '#f5d2ae', '#c7943c', '#4a8ab0', '#38688a', '#ffffff'],
    priest: ['#1a1426', '#ecc4a4', '#e8e0d0', '#e8e8f0', '#c8c8d8', '#ffd966'],
    pirate: ['#1a1426', '#d8a878', '#2a2a3a', '#5a3a8e', '#44306b', '#c9b84a'],
    cat:    ['#1a1426', '#e8e8e8', '#c78a3c', '#c78a3c', '#a8732f', '#ffffff'],
  };

  const charTex = {}; // charTex[palette][frameKey]
  function buildChars() {
    for (const [pname, pal] of Object.entries(PALETTES)) {
      charTex[pname] = {};
      for (const [fname, rows] of Object.entries(CHAR_FRAMES)) {
        const [c, g] = cv(16, 16);
        for (let y = 0; y < 16; y++) {
          const row = rows[y];
          for (let x = 0; x < 16; x++) {
            const ch = row[x];
            if (ch === '.' || ch === undefined) continue;
            g.fillStyle = pal[parseInt(ch, 10) - 1];
            g.fillRect(x, y, 1, 1);
          }
        }
        charTex[pname][fname] = tex(c);
        // 左向きフレーム（反転）
        if (fname.startsWith('side')) {
          const [c2, g2] = cv(16, 16);
          g2.translate(16, 0); g2.scale(-1, 1); g2.drawImage(c, 0, 0);
          charTex[pname][fname.replace('side', 'sideL')] = tex(c2);
        }
      }
    }
  }

  function charFrame(pal, dir, step) {
    const f = step % 2;
    const map = { down: 'down', up: 'up', right: 'side', left: 'sideL' };
    return charTex[pal][map[dir] + f];
  }

  // ---------- 敵グラフィック ----------
  function shade(g, x, y, rx, ry, color) {
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
  }

  const enemyArt = {
    slime(g, s) { // s = サイズ基準 48
      const grd = g.createRadialGradient(s * 0.4, s * 0.35, s * 0.05, s * 0.5, s * 0.55, s * 0.5);
      grd.addColorStop(0, '#9adcff'); grd.addColorStop(0.5, '#3c8ad9'); grd.addColorStop(1, '#1f4c94');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(s * 0.1, s * 0.85);
      g.bezierCurveTo(s * 0.05, s * 0.35, s * 0.35, s * 0.12, s * 0.5, s * 0.12);
      g.bezierCurveTo(s * 0.65, s * 0.12, s * 0.95, s * 0.35, s * 0.9, s * 0.85);
      g.closePath(); g.fill();
      g.fillStyle = '#0e2a52';
      shade(g, s * 0.38, s * 0.55, s * 0.05, s * 0.08, '#0e2a52');
      shade(g, s * 0.62, s * 0.55, s * 0.05, s * 0.08, '#0e2a52');
      g.strokeStyle = '#0e2a52'; g.lineWidth = s * 0.03;
      g.beginPath(); g.arc(s * 0.5, s * 0.68, s * 0.1, 0.2, Math.PI - 0.2); g.stroke();
      shade(g, s * 0.36, s * 0.3, s * 0.08, s * 0.05, '#ffffff88');
    },
    bat(g, s) {
      g.fillStyle = '#6a3a9a';
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.45);
      g.quadraticCurveTo(s * 0.15, s * 0.1, s * 0.05, s * 0.45);
      g.quadraticCurveTo(s * 0.2, s * 0.4, s * 0.25, s * 0.55);
      g.quadraticCurveTo(s * 0.35, s * 0.45, s * 0.5, s * 0.6); g.fill();
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.45);
      g.quadraticCurveTo(s * 0.85, s * 0.1, s * 0.95, s * 0.45);
      g.quadraticCurveTo(s * 0.8, s * 0.4, s * 0.75, s * 0.55);
      g.quadraticCurveTo(s * 0.65, s * 0.45, s * 0.5, s * 0.6); g.fill();
      shade(g, s * 0.5, s * 0.5, s * 0.16, s * 0.18, '#8a4ac0');
      shade(g, s * 0.44, s * 0.46, s * 0.035, s * 0.05, '#ffd0d0');
      shade(g, s * 0.56, s * 0.46, s * 0.035, s * 0.05, '#ffd0d0');
      g.fillStyle = '#3d2058';
      g.beginPath(); g.moveTo(s * 0.42, s * 0.36); g.lineTo(s * 0.46, s * 0.28); g.lineTo(s * 0.49, s * 0.37); g.fill();
      g.beginPath(); g.moveTo(s * 0.58, s * 0.36); g.lineTo(s * 0.54, s * 0.28); g.lineTo(s * 0.51, s * 0.37); g.fill();
    },
    goblin(g, s) {
      shade(g, s * 0.5, s * 0.65, s * 0.24, s * 0.26, '#5a7a3a'); // 体
      shade(g, s * 0.5, s * 0.34, s * 0.2, s * 0.18, '#6e9448'); // 頭
      g.fillStyle = '#6e9448'; // 耳
      g.beginPath(); g.moveTo(s * 0.3, s * 0.3); g.lineTo(s * 0.14, s * 0.22); g.lineTo(s * 0.32, s * 0.4); g.fill();
      g.beginPath(); g.moveTo(s * 0.7, s * 0.3); g.lineTo(s * 0.86, s * 0.22); g.lineTo(s * 0.68, s * 0.4); g.fill();
      shade(g, s * 0.42, s * 0.33, s * 0.04, s * 0.05, '#d8e840');
      shade(g, s * 0.58, s * 0.33, s * 0.04, s * 0.05, '#d8e840');
      g.fillStyle = '#3d5226'; g.fillRect(s * 0.42, s * 0.42, s * 0.16, s * 0.03);
      g.fillStyle = '#8a6a40'; g.fillRect(s * 0.72, s * 0.4, s * 0.07, s * 0.42); // 棍棒
      shade(g, s * 0.755, s * 0.38, s * 0.09, s * 0.1, '#a07c4c');
      g.fillStyle = '#3a4a2a'; g.fillRect(s * 0.34, s * 0.56, s * 0.32, s * 0.2); // 腰巻
    },
    flower(g, s) {
      g.strokeStyle = '#3e8b41'; g.lineWidth = s * 0.05;
      g.beginPath(); g.moveTo(s * 0.5, s * 0.9); g.quadraticCurveTo(s * 0.45, s * 0.7, s * 0.5, s * 0.55); g.stroke();
      g.fillStyle = '#3e8b41';
      shade(g, s * 0.35, s * 0.8, s * 0.14, s * 0.06, '#3e8b41');
      shade(g, s * 0.65, s * 0.8, s * 0.14, s * 0.06, '#3e8b41');
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        shade(g, s * 0.5 + Math.cos(a) * s * 0.18, s * 0.4 + Math.sin(a) * s * 0.18, s * 0.1, s * 0.07, '#e88ab8');
      }
      shade(g, s * 0.5, s * 0.4, s * 0.13, s * 0.13, '#ffd966');
      shade(g, s * 0.46, s * 0.38, s * 0.025, s * 0.04, '#7a4a2a');
      shade(g, s * 0.54, s * 0.38, s * 0.025, s * 0.04, '#7a4a2a');
      g.strokeStyle = '#7a4a2a'; g.lineWidth = s * 0.02;
      g.beginPath(); g.arc(s * 0.5, s * 0.44, s * 0.05, 0.3, Math.PI - 0.3); g.stroke();
    },
    lizard(g, s) {
      shade(g, s * 0.45, s * 0.62, s * 0.3, s * 0.2, '#a8743c'); // 体
      g.strokeStyle = '#a8743c'; g.lineWidth = s * 0.08; // 尻尾
      g.beginPath(); g.moveTo(s * 0.7, s * 0.65); g.quadraticCurveTo(s * 0.95, s * 0.6, s * 0.9, s * 0.35); g.stroke();
      shade(g, s * 0.3, s * 0.4, s * 0.16, s * 0.13, '#c2854a'); // 頭
      shade(g, s * 0.24, s * 0.37, s * 0.035, s * 0.045, '#ffe680');
      g.fillStyle = '#8a5e30';
      for (let i = 0; i < 4; i++) { // 背びれ
        const x = s * (0.36 + i * 0.1);
        g.beginPath(); g.moveTo(x, s * 0.46); g.lineTo(x + s * 0.04, s * 0.34); g.lineTo(x + s * 0.09, s * 0.46); g.fill();
      }
      g.fillStyle = '#7a5028';
      g.fillRect(s * 0.3, s * 0.78, s * 0.08, s * 0.1); g.fillRect(s * 0.52, s * 0.78, s * 0.08, s * 0.1);
    },
    crab(g, s) {
      shade(g, s * 0.5, s * 0.58, s * 0.26, s * 0.2, '#d05a3c');
      shade(g, s * 0.5, s * 0.52, s * 0.18, s * 0.12, '#e8744e');
      shade(g, s * 0.42, s * 0.5, s * 0.04, s * 0.05, '#2a1a14');
      shade(g, s * 0.58, s * 0.5, s * 0.04, s * 0.05, '#2a1a14');
      g.strokeStyle = '#d05a3c'; g.lineWidth = s * 0.05;
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(s * (0.5 + sx * 0.22), s * 0.66);
        g.lineTo(s * (0.5 + sx * 0.36), s * 0.8); g.stroke();
        g.beginPath(); g.moveTo(s * (0.5 + sx * 0.24), s * 0.5);
        g.quadraticCurveTo(s * (0.5 + sx * 0.42), s * 0.36, s * (0.5 + sx * 0.38), s * 0.26); g.stroke();
        shade(g, s * (0.5 + sx * 0.38), s * 0.24, s * 0.09, s * 0.07, '#e8744e');
      }
    },
    ghost(g, s) {
      const grd = g.createLinearGradient(0, s * 0.1, 0, s * 0.9);
      grd.addColorStop(0, '#d8e8f0e8'); grd.addColorStop(1, '#8aa8c040');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(s * 0.5, s * 0.4, s * 0.26, Math.PI, 0);
      g.lineTo(s * 0.76, s * 0.75);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(s * (0.69 - i * 0.13), s * (0.85 - (i % 2) * 0.1), s * (0.63 - i * 0.13), s * 0.78);
      g.closePath(); g.fill();
      shade(g, s * 0.42, s * 0.4, s * 0.045, s * 0.07, '#2a3a58');
      shade(g, s * 0.58, s * 0.4, s * 0.045, s * 0.07, '#2a3a58');
      shade(g, s * 0.5, s * 0.55, s * 0.05, s * 0.07, '#2a3a58');
    },
    soldier(g, s) { // 冥晶兵
      shade(g, s * 0.5, s * 0.62, s * 0.2, s * 0.26, '#4c4862');
      shade(g, s * 0.5, s * 0.3, s * 0.15, s * 0.16, '#5e5a78');
      g.fillStyle = '#8a7ad9'; g.fillRect(s * 0.4, s * 0.27, s * 0.2, s * 0.06); // 目スリット
      g.fillStyle = '#7a6ac9';
      g.beginPath(); g.moveTo(s * 0.5, s * 0.06); g.lineTo(s * 0.56, s * 0.18); g.lineTo(s * 0.44, s * 0.18); g.fill(); // 角晶
      g.fillStyle = '#8a8a9a'; g.fillRect(s * 0.74, s * 0.3, s * 0.05, s * 0.5); // 槍
      g.beginPath(); g.moveTo(s * 0.765, s * 0.14); g.lineTo(s * 0.83, s * 0.3); g.lineTo(s * 0.7, s * 0.3); g.fill();
      g.fillStyle = '#38344a';
      g.fillRect(s * 0.38, s * 0.84, s * 0.09, s * 0.1); g.fillRect(s * 0.53, s * 0.84, s * 0.09, s * 0.1);
      shade(g, s * 0.5, s * 0.55, s * 0.07, s * 0.09, '#a89aff'); // 胸の晶核
    },
    darkmage(g, s) {
      g.fillStyle = '#3a2a5a';
      g.beginPath(); g.moveTo(s * 0.5, s * 0.05); g.lineTo(s * 0.72, s * 0.4); g.lineTo(s * 0.28, s * 0.4); g.fill(); // 帽子
      shade(g, s * 0.5, s * 0.45, s * 0.16, s * 0.13, '#1a1228'); // 顔の闇
      shade(g, s * 0.44, s * 0.44, s * 0.03, s * 0.04, '#ff5a8a');
      shade(g, s * 0.56, s * 0.44, s * 0.03, s * 0.04, '#ff5a8a');
      g.fillStyle = '#4a3a72'; // ローブ
      g.beginPath(); g.moveTo(s * 0.36, s * 0.5); g.lineTo(s * 0.64, s * 0.5);
      g.lineTo(s * 0.78, s * 0.92); g.lineTo(s * 0.22, s * 0.92); g.fill();
      g.fillStyle = '#8a6a40'; g.fillRect(s * 0.76, s * 0.3, s * 0.04, s * 0.55); // 杖
      shade(g, s * 0.78, s * 0.26, s * 0.07, s * 0.07, '#ff5a8a');
    },
    gargoyle(g, s) {
      g.fillStyle = '#6b6b7a'; // 翼
      g.beginPath(); g.moveTo(s * 0.4, s * 0.45); g.quadraticCurveTo(s * 0.05, s * 0.15, s * 0.1, s * 0.55); g.quadraticCurveTo(s * 0.25, s * 0.5, s * 0.38, s * 0.6); g.fill();
      g.beginPath(); g.moveTo(s * 0.6, s * 0.45); g.quadraticCurveTo(s * 0.95, s * 0.15, s * 0.9, s * 0.55); g.quadraticCurveTo(s * 0.75, s * 0.5, s * 0.62, s * 0.6); g.fill();
      shade(g, s * 0.5, s * 0.6, s * 0.18, s * 0.24, '#7d7488');
      shade(g, s * 0.5, s * 0.34, s * 0.14, s * 0.13, '#8e8598');
      g.fillStyle = '#968c9c';
      g.beginPath(); g.moveTo(s * 0.38, s * 0.26); g.lineTo(s * 0.32, s * 0.12); g.lineTo(s * 0.44, s * 0.22); g.fill();
      g.beginPath(); g.moveTo(s * 0.62, s * 0.26); g.lineTo(s * 0.68, s * 0.12); g.lineTo(s * 0.56, s * 0.22); g.fill();
      shade(g, s * 0.44, s * 0.33, s * 0.035, s * 0.04, '#ffae42');
      shade(g, s * 0.56, s * 0.33, s * 0.035, s * 0.04, '#ffae42');
    },
    icewisp(g, s) {
      const grd = g.createRadialGradient(s * 0.5, s * 0.5, s * 0.05, s * 0.5, s * 0.5, s * 0.4);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, '#9ad8ff'); grd.addColorStop(1, '#3c8ad920');
      g.fillStyle = grd;
      g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.38, 0, 7); g.fill();
      g.fillStyle = '#c8ecff';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        g.save(); g.translate(s * 0.5 + Math.cos(a) * s * 0.26, s * 0.5 + Math.sin(a) * s * 0.26);
        g.rotate(a);
        g.fillRect(-s * 0.015, -s * 0.09, s * 0.03, s * 0.18); g.restore();
      }
      shade(g, s * 0.44, s * 0.46, s * 0.035, s * 0.05, '#2a5a8a');
      shade(g, s * 0.56, s * 0.46, s * 0.035, s * 0.05, '#2a5a8a');
    },
    rockdragon(g, s) { // 中ボス（96px基準）
      g.strokeStyle = '#8a6a4a'; g.lineWidth = s * 0.09; // 尾
      g.beginPath(); g.moveTo(s * 0.72, s * 0.7); g.quadraticCurveTo(s * 0.98, s * 0.65, s * 0.92, s * 0.34); g.stroke();
      g.fillStyle = '#8a6a4a';
      g.beginPath(); g.moveTo(s * 0.92, s * 0.36); g.lineTo(s * 0.99, s * 0.22); g.lineTo(s * 0.85, s * 0.28); g.fill();
      shade(g, s * 0.5, s * 0.62, s * 0.32, s * 0.26, '#9a784f'); // 胴
      g.fillStyle = '#7a5c3a';
      for (let i = 0; i < 5; i++) { // 背中の岩棘
        const x = s * (0.3 + i * 0.11);
        g.beginPath(); g.moveTo(x, s * 0.44); g.lineTo(x + s * 0.05, s * 0.26); g.lineTo(x + s * 0.11, s * 0.44); g.fill();
      }
      shade(g, s * 0.27, s * 0.4, s * 0.18, s * 0.15, '#ad8a5e'); // 頭
      g.fillStyle = '#7a5c3a'; // 顎
      g.beginPath(); g.moveTo(s * 0.1, s * 0.44); g.lineTo(s * 0.3, s * 0.4); g.lineTo(s * 0.3, s * 0.5); g.fill();
      shade(g, s * 0.24, s * 0.35, s * 0.04, s * 0.05, '#ffae42');
      g.fillStyle = '#e8e6e0'; // 牙
      g.beginPath(); g.moveTo(s * 0.13, s * 0.44); g.lineTo(s * 0.15, s * 0.5); g.lineTo(s * 0.18, s * 0.44); g.fill();
      g.fillStyle = '#7a5c3a';
      g.fillRect(s * 0.3, s * 0.82, s * 0.12, s * 0.12); g.fillRect(s * 0.55, s * 0.82, s * 0.12, s * 0.12);
      shade(g, s * 0.42, s * 0.56, s * 0.1, s * 0.07, '#c2a877'); // ハイライト
    },
    zarva(g, s) { // ラスボス（112px基準）
      // オーラ
      const aur = g.createRadialGradient(s * 0.5, s * 0.45, s * 0.1, s * 0.5, s * 0.5, s * 0.52);
      aur.addColorStop(0, '#6a3a9a55'); aur.addColorStop(1, '#6a3a9a00');
      g.fillStyle = aur; g.fillRect(0, 0, s, s);
      // マント
      g.fillStyle = '#2a1a44';
      g.beginPath(); g.moveTo(s * 0.5, s * 0.18);
      g.quadraticCurveTo(s * 0.12, s * 0.4, s * 0.18, s * 0.95);
      g.lineTo(s * 0.82, s * 0.95);
      g.quadraticCurveTo(s * 0.88, s * 0.4, s * 0.5, s * 0.18); g.fill();
      // 体
      shade(g, s * 0.5, s * 0.58, s * 0.2, s * 0.3, '#3d2a5e');
      // 胸の冥晶
      const cry = g.createLinearGradient(s * 0.42, s * 0.45, s * 0.58, s * 0.65);
      cry.addColorStop(0, '#d9b8ff'); cry.addColorStop(1, '#7a3ad9');
      g.fillStyle = cry;
      g.beginPath(); g.moveTo(s * 0.5, s * 0.42); g.lineTo(s * 0.58, s * 0.55); g.lineTo(s * 0.5, s * 0.68); g.lineTo(s * 0.42, s * 0.55); g.fill();
      // 頭
      shade(g, s * 0.5, s * 0.26, s * 0.13, s * 0.14, '#4c3a72');
      // 王冠状の晶角
      g.fillStyle = '#9a7ad9';
      for (const [dx, h] of [[-0.1, 0.12], [0, 0.18], [0.1, 0.12]]) {
        g.beginPath();
        g.moveTo(s * (0.5 + dx - 0.03), s * 0.16);
        g.lineTo(s * (0.5 + dx), s * (0.16 - h));
        g.lineTo(s * (0.5 + dx + 0.03), s * 0.16); g.fill();
      }
      shade(g, s * 0.44, s * 0.25, s * 0.035, s * 0.05, '#ff5a8a');
      shade(g, s * 0.56, s * 0.25, s * 0.035, s * 0.05, '#ff5a8a');
      // 浮遊する晶片
      g.fillStyle = '#b89aff';
      for (const [x, y, r] of [[0.16, 0.3, 0.05], [0.84, 0.3, 0.05], [0.1, 0.6, 0.04], [0.9, 0.6, 0.04]]) {
        g.beginPath(); g.moveTo(s * x, s * (y - r * 1.6)); g.lineTo(s * (x + r), s * y);
        g.lineTo(s * x, s * (y + r * 1.6)); g.lineTo(s * (x - r), s * y); g.fill();
      }
    },
  };

  const enemyTexCache = {};
  function enemyTexture(key, size) {
    const ck = key + '_' + size;
    if (!enemyTexCache[ck]) {
      const [c, g] = cv(size, size);
      enemyArt[key](g, size);
      enemyTexCache[ck] = tex(c);
    }
    return enemyTexCache[ck];
  }

  // ---------- 戦闘背景 ----------
  function battleBg(zone, w, h) {
    const [c, g] = cv(w, h);
    const themes = {
      field: ['#7ec8e8', '#bfe3f2', '#4a9c4d', '#3e8b41'],
      cave: ['#241f38', '#3a3252', '#4c4862', '#3d3a52'],
      castle: ['#1a1230', '#2e2050', '#3d2a5e', '#2a1a44'],
      coast: ['#6ab8e0', '#aadcf0', '#d9c389', '#cdb77d'],
    };
    const [skyA, skyB, gndA, gndB] = themes[zone] || themes.field;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, skyA); sky.addColorStop(1, skyB);
    g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.62);
    const gnd = g.createLinearGradient(0, h * 0.55, 0, h);
    gnd.addColorStop(0, gndA); gnd.addColorStop(1, gndB);
    g.fillStyle = gnd; g.fillRect(0, h * 0.55, w, h * 0.45);
    g.fillStyle = skyB + ''; // 地平の柔らかさ
    g.globalAlpha = 0.3; g.fillRect(0, h * 0.55, w, h * 0.04); g.globalAlpha = 1;
    const r = rng(zone.length * 7777 + 13);
    if (zone === 'cave' || zone === 'castle') {
      // 鍾乳石/柱
      g.fillStyle = '#00000040';
      for (let i = 0; i < 7; i++) {
        const x = r() * w;
        g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x, 30 + r() * 50); g.lineTo(x + 10, 0); g.fill();
      }
      if (zone === 'castle') {
        g.fillStyle = '#9a7ad930';
        for (let i = 0; i < 10; i++) {
          const x = r() * w, y = r() * h * 0.5, rr = 3 + r() * 6;
          g.beginPath(); g.moveTo(x, y - rr * 1.6); g.lineTo(x + rr, y); g.lineTo(x, y + rr * 1.6); g.lineTo(x - rr, y); g.fill();
        }
      }
    } else {
      // 雲と遠景
      g.fillStyle = '#ffffffaa';
      for (let i = 0; i < 5; i++) {
        const x = r() * w, y = 10 + r() * h * 0.25, rw = 25 + r() * 35;
        g.beginPath(); g.ellipse(x, y, rw, rw * 0.32, 0, 0, 7); g.fill();
      }
      g.fillStyle = zone === 'coast' ? '#2b62b8' : '#2f6e3266';
      g.beginPath(); g.moveTo(0, h * 0.55);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.55 - (zone === 'coast' ? 4 : r() * 16));
      g.lineTo(w, h * 0.62); g.lineTo(0, h * 0.62); g.fill();
    }
    return tex(c);
  }

  function init() {
    buildTiles();
    buildChars();
  }

  return { init, tileTex, charFrame, enemyTexture, battleBg, PALETTES };
})();
