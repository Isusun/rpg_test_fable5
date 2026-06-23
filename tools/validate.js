// マップ・データ整合性チェック（Node実行用）
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'js', 'data.js'));
const { MAPS, TILE_DEF, ENEMIES, ENCOUNTERS, ITEMS, EQUIPS, SKILLS, CHARACTERS, EVENTS, SHOPS } = D;

let errors = 0, warns = 0;
const err = (m) => { errors++; console.log('ERROR: ' + m); };
const warn = (m) => { warns++; console.log('warn : ' + m); };

// 行をパディング（main.jsと同じ処理）
for (const [id, m] of Object.entries(MAPS)) {
  const w = Math.max(...m.rows.map(r => r.length));
  m.rows = m.rows.map(r => r.padEnd(w, m.pad || 'V'));
}

function tileAt(map, x, y) {
  if (y < 0 || y >= map.rows.length || x < 0 || x >= map.rows[y].length) return null;
  return TILE_DEF[map.rows[y][x]] || null;
}
const walkable = (map, x, y) => { const t = tileAt(map, x, y); return !!(t && t.walk); };

for (const [id, map] of Object.entries(MAPS)) {
  const W = map.rows[0].length, H = map.rows.length;
  console.log(`--- ${id} (${W}x${H}) ---`);
  // 未定義タイル
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!TILE_DEF[map.rows[y][x]]) err(`${id} (${x},${y}) 未定義タイル '${map.rows[y][x]}'`);
  }
  // 出口
  for (const e of map.exits || []) {
    if (!walkable(map, e.x, e.y)) err(`${id} 出口(${e.x},${e.y})が歩行不可タイル '${map.rows[e.y][e.x]}'`);
    const dst = MAPS[e.to];
    if (!dst) { err(`${id} 出口先マップ '${e.to}' が存在しない`); continue; }
    if (!walkable(dst, e.tx, e.ty)) err(`${id}→${e.to} 到着地点(${e.tx},${e.ty})が歩行不可 '${dst.rows[e.ty] ? dst.rows[e.ty][e.tx] : '範囲外'}'`);
  }
  // NPC
  for (const n of map.npcs || []) {
    const ch = map.rows[n.y] ? map.rows[n.y][n.x] : '?';
    if (n.sign) {
      if (ch !== 'S') err(`${id} 立て札NPC ${n.id} (${n.x},${n.y}) がSタイル上にない（'${ch}'）`);
    } else if (!walkable(map, n.x, n.y)) {
      err(`${id} NPC ${n.id} (${n.x},${n.y}) が歩行不可タイル '${ch}'`);
    }
    if (!EVENTS[n.id]) warn(`${id} NPC ${n.id} のイベント未定義`);
  }
  // オブジェクト
  for (const o of map.objects || []) {
    if (!walkable(map, o.x, o.y)) err(`${id} ${o.type} ${o.id || ''} (${o.x},${o.y}) が歩行不可タイル '${map.rows[o.y][o.x]}'`);
    if (o.type === 'chest' && o.item && !ITEMS[o.item] && !EQUIPS[o.item]) err(`${id} chest ${o.id} 不明アイテム ${o.item}`);
    if (o.type === 'event' && !EVENTS[o.id]) err(`${id} event ${o.id} のスクリプト未定義`);
  }
  // BFS到達性（鍵扉・門・結界・岩は開く前提で通過可能と見なす）
  const start = (map.exits && map.exits[0]) ? { x: map.exits[0].x, y: map.exits[0].y } : null;
  if (start) {
    const seen = new Set([start.x + ',' + start.y]);
    const q = [start];
    while (q.length) {
      const { x, y } = q.shift();
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !walkable(map, nx, ny)) continue;
        seen.add(k); q.push({ x: nx, y: ny });
      }
    }
    const reach = (x, y) => seen.has(x + ',' + y);
    const adjacentReach = (x, y) => reach(x, y) || [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach(x + dx, y + dy));
    for (const e of map.exits || []) {
      if (!reach(e.x, e.y)) err(`${id} 出口(${e.x},${e.y})に到達できない`);
    }
    for (const o of map.objects || []) {
      if (o.type === 'chest' && !adjacentReach(o.x, o.y)) err(`${id} chest ${o.id} (${o.x},${o.y}) に隣接到達できない`);
      if (o.type === 'event' && !reach(o.x, o.y)) err(`${id} event ${o.id} (${o.x},${o.y}) に到達できない`);
      if (o.type === 'switch' && !reach(o.x, o.y)) err(`${id} switch ${o.id} に到達できない`);
      if (o.type === 'rock' && !reach(o.x, o.y)) err(`${id} rock ${o.id} に到達できない`);
    }
    for (const n of map.npcs || []) {
      if (!adjacentReach(n.x, n.y)) err(`${id} NPC ${n.id} (${n.x},${n.y}) に隣接到達できない`);
    }
  }
}

// 押し岩パズルの成立性: 岩からスイッチへ直線経路チェック（簡易: 同じ部屋にあるか）
// エンカウント・敵・スキル参照
for (const [id, enc] of Object.entries(ENCOUNTERS)) {
  for (const g of enc.groups) for (const e of g.e) if (!ENEMIES[e]) err(`encounter ${id}: 不明な敵 ${e}`);
}
for (const [id, e] of Object.entries(ENEMIES)) {
  for (const m of e.ai) if (m.skill && !SKILLS[m.skill]) err(`enemy ${id}: 不明スキル ${m.skill}`);
  if (e.drop && !ITEMS[e.drop.id]) err(`enemy ${id}: 不明ドロップ ${e.drop.id}`);
}
for (const [id, c] of Object.entries(CHARACTERS)) {
  for (const [lv, s] of Object.entries(c.skillsByLevel)) if (!SKILLS[s]) err(`char ${id}: 不明スキル ${s}`);
  for (const [slot, eq] of Object.entries(c.initEquip)) if (eq && !EQUIPS[eq]) err(`char ${id}: 不明初期装備 ${eq}`);
}
for (const [id, s] of Object.entries(SHOPS)) {
  for (const it of s.items) if (!ITEMS[it] && !EQUIPS[it]) err(`shop ${id}: 不明商品 ${it}`);
}

console.log(`\n結果: errors=${errors} warns=${warns}`);
process.exit(errors ? 1 : 0);
