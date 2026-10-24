/* Boots Tactical Realms in a deterministic sandbox, drives a scripted session
   (title, party select, overworld walk, dungeon backtrack, an ambush combat
   round with attacks and a spell, victory, camp, menus, save) and replays the
   saved game in a second instance (load). The digest of every observable
   effect is compared against the recorded baseline; a refactor must
   reproduce it. */
'use strict';

const fs = require('fs');
const path = require('path');
const { createGame } = require('./harness.js');

const BASELINE = path.join(__dirname, 'baseline.json');
let failures = 0;
process.on('unhandledRejection', (e) => { ++failures; console.log('FAIL unhandled rejection: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); });

function check(name, ok, details) {
  if (ok) console.log('PASS ' + name);
  else { ++failures; console.log('FAIL ' + name + (details ? ': ' + details : '')); }
}

/* canvas-space click mapped through the fake 100x40 canvas rect */
function click(game, cx, cy) {
  const x = cx * 100 / 1280, y = cy * 40 / 720;
  game.pointer('pointerdown', x, y);
  game.frames(1);
  game.pointer('pointerup', x, y);
}

function rightClick(game, cx, cy) {
  const x = cx * 100 / 1280, y = cy * 40 / 720;
  game.dispatch('contextmenu', { type: 'contextmenu', clientX: x, clientY: y, button: 2, preventDefault() {}, stopPropagation() {}, target: game.document.body });
}

function stateOf(game) {
  for (let i = game.log.length - 1; i >= 0; --i) {
    const m = /^text statusState State: (.*)$/.exec(game.log[i]);
    if (m) return m[1];
  }
  return '';
}

function posOf(game) {
  for (let i = game.log.length - 1; i >= 0; --i) {
    const m = /^text statusPos Pos: \((-?\d+), (-?\d+)\)$/.exec(game.log[i]);
    if (m) return { col: +m[1], row: +m[2] };
  }
  return null;
}

/* first BFS step from start toward any of the target cells over open ground */
function bfsKey(isOpen, start, targets) {
  const key = (q, r) => q + ',' + r;
  const goal = new Set(targets.map(([q, r]) => key(q, r)));
  if (!goal.size) return null;
  const prev = new Map([[key(start.col, start.row), null]]);
  const q = [[start.col, start.row]];
  while (q.length) {
    const [cc, cr] = q.shift();
    if (goal.has(key(cc, cr)) && !(cc === start.col && cr === start.row)) {
      let cur = key(cc, cr);
      while (prev.get(cur) && !(prev.get(cur)[0] === start.col && prev.get(cur)[1] === start.row))
        cur = key(prev.get(cur)[0], prev.get(cur)[1]);
      if (!prev.get(cur)) return null;
      const [nc, nr] = cur.split(',').map(Number);
      if (nc === start.col && nr === start.row) return null;
      return nc > start.col ? 'ArrowRight' : nc < start.col ? 'ArrowLeft' : nr > start.row ? 'ArrowDown' : 'ArrowUp';
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cc + dc, nr = cr + dr;
      if (Math.abs(nc) > 96 || Math.abs(nr) > 96) continue;
      if (isOpen(nc, nr) && !prev.has(key(nc, nr))) { prev.set(key(nc, nr), [cc, cr]); q.push([nc, nr]); }
    }
  }
  return null;
}

/* key toward the nearest stairs_up cell of the current crawl floor */
function stepTowardExit(c) {
  const L = c.level;
  const ups = [];
  for (let r = 0; r < L.h; ++r)
    for (let q = 0; q < L.w; ++q)
      if (L.get(q, r) === 2) ups.push([q, r]);
  return bfsKey((q, r) => c.isOpen(q, r), c.position, ups);
}

/* key toward a cell adjacent to the nearest living monster group */
function stepTowardGroup(c) {
  const targets = [];
  for (const g of c.groups)
    for (const m of c.aliveMembers(g))
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (c.isOpen(m.col + dc, m.row + dr)) targets.push([m.col + dc, m.row + dr]);
  return bfsKey((q, r) => c.isOpen(q, r), c.position, targets);
}

/* is a canvas prompt naming needle drawn in the most recent frame batch? */
function promptUp(game, needle) {
  const t = game.text;
  const from = Math.max(0, t.length - 80);
  for (let i = from; i < t.length; ++i)
    if (t[i].includes(needle)) return true;
  return false;
}

/* combat board geometry as the controller computes it, from public engine
   state only: grid size, tile size and the board offset */
function combatGeom(eng, isCrawl) {
  const cols = eng.grid.cols, rows = eng.grid.rows;
  const availW = 1280 - 8, availH = 720 - 72;
  let ts, ox, oy;
  if (isCrawl) {
    ts = Math.max(40, Math.min(60, Math.floor(availW / cols), Math.floor(availH / rows)));
    const bw = cols * ts, bh = rows * ts;
    const cur = eng.currentUnit;
    if (bw <= availW) ox = Math.floor((1280 - bw) / 2);
    else ox = 4 - Math.round(Math.max(0, Math.min(bw - availW, cur.position.col * ts + ts / 2 - availW / 2)));
    if (bh <= availH) oy = 36 + Math.floor((availH - bh) / 2);
    else oy = 36 - Math.round(Math.max(0, Math.min(bh - availH, cur.position.row * ts + ts / 2 - availH / 2)));
  } else {
    ts = Math.min(Math.floor(availW / cols), Math.floor(availH / rows));
    ox = Math.floor((1280 - cols * ts) / 2);
    oy = 36 + Math.floor((availH - rows * ts) / 2);
  }
  return { ts, ox, oy };
}

async function main() {
  /* ---- session A: play, fight, win, camp, menus, save ---- */
  const game = createGame(path.join(__dirname, '..'), { seed: 42 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));
  const TR = game.SZ.TacticalRealms;

  /* capture the combat engine and the controller through their public
     prototypes -- test-side instrumentation, the game files stay untouched */
  const CE = TR.CombatEngine;
  for (const m of ['initCombat', 'initCombatAt']) {
    const orig = CE.prototype[m];
    CE.prototype[m] = function (...a) { TR.__eng = this; return orig.apply(this, a); };
  }
  const origSBM = TR.Controller.prototype.setBattleSceneMode;
  TR.Controller.prototype.setBattleSceneMode = function (m) { TR.__ctrl = this; return origSBM.call(this, m); };
  const DC = TR.DungeonCrawl;
  TR.DungeonCrawl = class extends DC { constructor(...a) { super(...a); TR.__crawl = this; } };
  const OMP = TR.OverworldMap.prototype;
  const origGetTile = OMP.getTile;
  OMP.getTile = function (...a) { TR.__map = this; return origGetTile.apply(this, a); };

  await game.settle();
  game.dispatch('DOMContentLoaded', { type: 'DOMContentLoaded' });
  game.frames(3);

  /* menu bar: about dialog and battle-scene mode (also captures the controller) */
  game.SZ.MenuBar.onAction('about');
  game.SZ.MenuBar.onAction('scenes-off');
  game.frames(2);

  /* title -> new game -> character select */
  click(game, 640, 392);
  game.frames(3);

  /* pick the first four unlocked cards, then begin */
  for (const cx of [280, 520, 760, 1000]) {
    click(game, cx, 225);
    game.frames(1);
    click(game, cx, 531);
    game.frames(1);
  }
  click(game, 640, 696);
  await game.settle();
  game.frames(3);
  check('party select reaches OVERWORLD', stateOf(game) === 'OVERWORLD', 'state ' + stateOf(game));

  /* walk southeast until the trail reaches a dungeon */
  for (let i = 0; i < 40 && stateOf(game) !== 'DUNGEON'; ++i) {
    const st = stateOf(game);
    if (st === 'TOWN') { click(game, 1098, 413); game.frames(2); continue; }
    if (st === 'CAMP') { click(game, 1098, 353); game.frames(2); continue; }
    game.key('ArrowRight'); game.frames(18); game.keyUp('ArrowRight');
    game.key('ArrowDown'); game.frames(12); game.keyUp('ArrowDown');
  }
  check('trail reaches a DUNGEON', stateOf(game) === 'DUNGEON', 'state ' + stateOf(game));

  /* inside the dungeon: walk up to the nearest monster band -- the encounter
     is placed by the generator, so combat is certain, not a dice roll */
  for (let i = 0; i < 80 && stateOf(game) === 'DUNGEON'; ++i) {
    if (promptUp(game, 'Leave the dungeon') || promptUp(game, 'Descend') || promptUp(game, 'Climb')) {
      click(game, 730, 392);
      game.frames(2);
      continue;
    }
    const k = stepTowardGroup(TR.__crawl) || stepTowardExit(TR.__crawl) || 'ArrowLeft';
    game.key(k); game.frames(8); game.keyUp(k);
  }
  const crawlCombat = stateOf(game) === 'COMBAT';
  check('reached COMBAT', stateOf(game) === 'COMBAT', 'state ' + stateOf(game));

  /* fight: wait for each party turn, right-click the nearest foe to open the
     context menu, pick attack -- casters take the spell entry instead */
  const Phase = TR.CombatPhase;
  let deployDone = false;
  game.frames(60); /* let the battle camera settle on the first active unit */
  for (let turn = 0; turn < 120 && stateOf(game) === 'COMBAT'; ++turn) {
    const eng = TR.__eng;
    if (!eng) { game.frames(10); continue; }
    if (eng.phase === Phase.VICTORY || eng.phase === Phase.DEFEAT) { click(game, 640, 394); game.frames(10); continue; }
    if (!deployDone && promptUp(game, 'Begin Battle')) { click(game, 640, 114); deployDone = true; game.frames(12); continue; }
    game.frames(20);
    if (stateOf(game) !== 'COMBAT') break;
    const cur = eng.currentUnit;
    if (process.env.TRDBG && turn < 8) console.log('DBG turn=' + turn + ' phase=' + eng.phase + ' cur=' + (cur && cur.faction) + ' move=' + (eng.phase === Phase.AWAITING_MOVE));
    if (!cur || cur.faction !== 'party' || eng.phase !== Phase.AWAITING_MOVE) continue;
    const foes = eng.units.filter((u) => u.faction !== cur.faction && u.isAlive);
    if (!foes.length) continue;
    let best = foes[0], bd = Infinity;
    for (const f of foes) {
      const d = Math.abs(f.position.col - cur.position.col) + Math.abs(f.position.row - cur.position.row);
      if (d < bd) { bd = d; best = f; }
    }
    const g = combatGeom(eng, crawlCombat);
    const ex = g.ox + best.position.col * g.ts + g.ts / 2;
    const ey = g.oy + best.position.row * g.ts + g.ts / 2;
    rightClick(game, ex, ey);
    game.frames(1);
    const mx = Math.min(ex, 1280 - 200 - 4), my = Math.min(ey, 720 - 176 - 4);
    const wantSpell = (cur.spells || []).length > 0 && turn % 2 === 1;
    click(game, mx + 100, my + 4 + (wantSpell ? 1 : 0) * 28 + 14);
    game.frames(1);
  }

  /* leave the battlefield: the phase panel's Continue, then the result screen */
  for (let i = 0; i < 6 && stateOf(game) === 'COMBAT'; ++i) {
    click(game, 640, 394);
    game.frames(30);
  }
  check('combat resolved', stateOf(game) === 'VICTORY' || stateOf(game) === 'DEFEAT', 'state ' + stateOf(game));
  const vbtn = (TR.__ctrl && TR.__ctrl._victoryBtnY) || 370;
  click(game, 640, vbtn + 22);
  game.frames(2);
  if (stateOf(game) === 'DEFEAT') {
    click(game, 520, 382);
    game.frames(2);
  }

  /* out of the dungeon and home to the camp the trail started at */
  for (let i = 0; i < 200 && stateOf(game) === 'DUNGEON'; ++i) {
    if (promptUp(game, 'Leave the dungeon')) { click(game, 550, 392); game.frames(2); continue; }
    if (promptUp(game, 'Descend') || promptUp(game, 'Climb')) { click(game, 730, 392); game.frames(2); continue; }
    const k = stepTowardExit(TR.__crawl) || 'ArrowLeft';
    game.key(k); game.frames(8); game.keyUp(k);
  }
  for (let i = 0; i < 80 && stateOf(game) === 'OVERWORLD'; ++i) {
    const map = TR.__map, pos = posOf(game);
    if (!map || !pos) break;
    const k = bfsKey((q, r) => map.isPassable(q, r), pos, [[0, 0]]) || 'ArrowUp';
    game.key(k); game.frames(9); game.keyUp(k);
  }
  check('reached CAMP', stateOf(game) === 'CAMP', 'state ' + stateOf(game));

  /* camp: rest, then back to the overworld */
  click(game, 1098, 293);
  game.frames(2);
  click(game, 1098, 353);
  game.frames(3);

  /* menus: combat history dialog, scenes back to full, new game, exit */
  game.SZ.MenuBar.onAction('combat-history');
  game.frames(2);
  game.SZ.MenuBar.onAction('scenes-full');
  game.SZ.MenuBar.onAction('new');
  game.frames(2);
  game.SZ.MenuBar.onAction('exit');
  game.frames(2);
  await game.settle();

  const dA = game.digest();

  /* ---- session B: replay the saved game from A's storage ---- */
  const storage = Object.fromEntries(game.storage);
  const gameB = createGame(path.join(__dirname, '..'), { seed: 42, storage });
  const errorsB = gameB.load();
  check('scripts load without errors (B)', errorsB.length === 0, errorsB.join(' | '));
  await gameB.settle();
  gameB.dispatch('DOMContentLoaded', { type: 'DOMContentLoaded' });
  gameB.frames(3);
  click(gameB, 640, 452);
  await gameB.settle();
  gameB.frames(5);
  /* walk a few steps and open a dialog so the replay produces effects too */
  for (let i = 0; i < 6; ++i) {
    gameB.key('ArrowRight'); gameB.frames(14); gameB.keyUp('ArrowRight');
    gameB.key('ArrowDown'); gameB.frames(10); gameB.keyUp('ArrowDown');
  }
  gameB.SZ.MenuBar.onAction('about');
  gameB.frames(2);
  const stB = stateOf(gameB);
  check('loaded save reaches the field', stB === 'OVERWORLD' || stB === 'CAMP', 'state ' + stB);
  const dB = gameB.digest();

  /* ---- markers ---- */
  check('session A produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of ['MenuBar', 'Dialog.show dlg-about', 'Dialog.show dlg-combat-history',
    'store sz-tactical-realms-meta', 'text statusState State: COMBAT',
    'text statusState State: CAMP', 'postMessage {"type":"sz:close"}'])
    check('session covers ' + marker, game.log.some((l) => l.startsWith(marker)), 'no line starts with ' + marker);
  check('session covers melee', game.log.some((l) => l.includes(' attacks ')), 'no attack log line');
  check('session covers spells', game.log.some((l) => l.includes(' casts ')), 'no spell log line');
  check('session B produced effects', gameB.log.length > 100, 'log entries: ' + gameB.log.length);

  if (!fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, JSON.stringify({ digestA: dA, digestB: dB, entriesA: game.log.length, entriesB: gameB.log.length }, null, 2) + '\n');
    console.log('BASELINE RECORDED A=' + dA + ' B=' + dB);
    process.exit(0);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  check('digest A matches baseline', dA === base.digestA, 'got ' + dA + ' want ' + base.digestA);
  check('digest B matches baseline', dB === base.digestB, 'got ' + dB + ' want ' + base.digestB);

  process.exit(failures ? 1 : 0);
}

main();
