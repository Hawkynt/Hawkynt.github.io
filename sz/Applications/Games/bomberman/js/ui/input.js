/* Keyboard, mouse and touch: held keys and the pointer in G.input; in play the move, bomb,
   detonate, Mega Bomb and dash intents plus click-to-walk paths; in cinematics advance and
   skip; in menus spatial cursor moves, Enter, Escape (back per screen) and clicks through the
   registered hit areas; auto-pause when the tab is hidden. Owns G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS, TILE, ARENA_X, ARENA_Y, DIRS } = C;
  const { canvas, toPlane } = NS.view;
  const kit = NS.kit;
  const scr = NS.screens;
  const inp = G.input;

  if (SZ.GameAutoPause) SZ.GameAutoPause.attach({ isRunning: () => G.screen === 'playing', pause: () => scr.pause() });

  const GAME_KEYS = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Tab: 1, ShiftLeft: 1, ShiftRight: 1 };
  const MOVE_KEYS = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };

  document.addEventListener('keydown', (e) => {
    inp.keys[e.code] = true;
    if (e.key === 'F2') {
      e.preventDefault();
      if (G.screen === 'playing' || G.screen === 'paused') NS.run.suspend();
      G.cine = null;
      scr.setScreen('title');
      return;
    }
    if (G.screen === 'cine') {
      if (GAME_KEYS[e.code]) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') NS.cine.skip();
      else NS.cine.advance();
      return;
    }
    if (G.ui.modal) { onMenuKey(e); return; }
    if (G.screen === 'playing') { onPlayKey(e); return; }
    onMenuKey(e);
  });

  document.addEventListener('keyup', (e) => {
    inp.keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    inp.keys = {};
  });

  function onPlayKey(e) {
    if (GAME_KEYS[e.code]) e.preventDefault();
    if (MOVE_KEYS[e.code]) inp.path = null;
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': case 'KeyZ': inp.bombQ = true; break;
      case 'KeyX': case 'KeyE': inp.detonateQ = true; break;
      case 'KeyC': inp.megaQ = true; break;
      case 'ShiftLeft': case 'ShiftRight': inp.dashQ = true; break;
      case 'Escape': case 'KeyP': scr.pause(); break;
      case 'KeyH': scr.pause(); scr.open('help', 'paused'); break;
    }
  }

  function onMenuKey(e) {
    if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) return;
    if (!G.ui.modal) {
      if (G.screen === 'tree' && NS.tree.onKey(e)) { e.preventDefault(); return; }
      if (G.screen === 'help' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); NS.help.onKey(e); return; }
      if (e.code === 'Tab' && (G.screen === 'wardrobe' || G.screen === 'goals')) {
        e.preventDefault();
        if (G.screen === 'wardrobe') { const t = ['skin', 'bomb', 'trail']; G.ui.wardTab = t[(t.indexOf(G.ui.wardTab) + 1) % 3]; G.ui.wardSel = 0; }
        else { const t = ['quests', 'ach', 'event']; G.ui.goalsTab = t[(t.indexOf(G.ui.goalsTab) + 1) % 3]; }
        return;
      }
    }
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': e.preventDefault(); kit.moveCursorDir(0, -1); break;
      case 'ArrowDown': case 'KeyS': e.preventDefault(); kit.moveCursorDir(0, 1); break;
      case 'ArrowLeft': case 'KeyA': e.preventDefault(); kit.moveCursorDir(-1, 0); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); kit.moveCursorDir(1, 0); break;
      case 'Enter': case 'NumpadEnter': case 'Space':
        e.preventDefault();
        kit.activate(G.hitAreas[G.menuCursor]);
        break;
      case 'KeyH':
        if (G.screen === 'title' || G.screen === 'map') scr.open('help', G.screen);
        else if (G.screen === 'paused') scr.open('help', 'paused');
        break;
      case 'Escape': case 'KeyP':
        e.preventDefault();
        escape();
        break;
    }
  }

  function escape() {
    if (G.ui.modal) { G.ui.modal = null; return; }
    switch (G.screen) {
      case 'paused': scr.resume(); break;
      case 'tree': case 'wardrobe': case 'goals': case 'stats': case 'help':
        scr.back(G.screen);
        break;
      case 'map': scr.setScreen('title'); break;
      case 'results':
        if (G.run && !G.run.over && G.ui.results && G.ui.results.cleared) NS.results.next();
        else scr.setScreen(G.ui.results && G.ui.results.mode === 'story' ? 'map' : 'title');
        break;
    }
  }

  /* ── pointer ── */
  function arenaCell(px, py) {
    const c = Math.floor((px - ARENA_X) / TILE), r = Math.floor((py - ARENA_Y) / TILE);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS ? { c: c, r: r } : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (window.focus) window.focus();
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    inp.touch = e.pointerType === 'touch';
    if (G.screen === 'cine') {
      const i = kit.hitAt(p.x, p.y);
      if (i >= 0) kit.activate(G.hitAreas[i]);
      else NS.cine.advance();
      return;
    }
    if (G.screen === 'playing' && !G.ui.modal) {
      e.preventDefault();
      if (inp.touch && NS.touch.down(e.pointerId, p.x, p.y)) return;
      playClick(p.x, p.y, e.button === 2);
      return;
    }
    const i = kit.hitAt(p.x, p.y);
    if (i >= 0) {
      G.menuCursor = i;
      kit.activate(G.hitAreas[i]);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toPlane(e.clientX, e.clientY);
    inp.mouseX = p.x;
    inp.mouseY = p.y;
    if (e.pointerType === 'touch') { NS.touch.move(e.pointerId, p.x, p.y); return; }
    ++inp.mouseMoved;
  });

  function release(e) {
    if (e.pointerType === 'touch') NS.touch.up(e.pointerId);
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* Click on the arena: on Pip (or right button) drops a bomb, elsewhere walks there */
  function playClick(px, py, right) {
    const run = G.run;
    if (!run || run.player.dead) return;
    const cell = arenaCell(px, py);
    if (!cell) return;
    const p = run.player;
    if (right || (cell.c === Math.round(p.x) && cell.r === Math.round(p.y))) {
      inp.bombQ = true;
      inp.path = null;
      return;
    }
    inp.path = findPath(Math.round(p.x), Math.round(p.y), cell.c, cell.r);
    inp.pathT = 0;
  }

  function findPath(c0, r0, c1, r1) {
    const p = G.run.player;
    const N = COLS * ROWS;
    const prev = new Int16Array(N).fill(-1);
    const start = r0 * COLS + c0, goal = r1 * COLS + c1;
    const q = [start];
    prev[start] = start;
    let best = start, bestD = Math.abs(c1 - c0) + Math.abs(r1 - r0);
    for (let h = 0; h < q.length; ++h) {
      const i = q[h];
      if (i === goal) { best = i; break; }
      const c = i % COLS, r = (i / COLS) | 0;
      const d = Math.abs(c1 - c) + Math.abs(r1 - r);
      if (d < bestD) { bestD = d; best = i; }
      for (let k = 0; k < 4; ++k) {
        const nc = c + DIRS[k][0], nr = r + DIRS[k][1];
        const j = nr * COLS + nc;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || prev[j] >= 0) continue;
        if (!NS.arena.playerCan(nc, nr, p)) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    const path = [];
    for (let i = best; i !== start; i = prev[i]) path.unshift(i);
    return path.length ? path : null;
  }

  /* ── per-step intent ── */
  function k(code) {
    return !!inp.keys[code];
  }

  function sample() {
    inp.moveX = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    inp.moveY = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0);
    if (inp.moveX || inp.moveY) inp.path = null;
    if (NS.touch.sample(inp)) inp.path = null;
    if (inp.path && G.run) followPath();
  }

  function followPath() {
    const p = G.run.player;
    inp.pathT += C.STEP;
    while (inp.path.length) {
      const i = inp.path[0];
      const tc = i % COLS, tr = (i / COLS) | 0;
      if (Math.abs(p.x - tc) < 0.08 && Math.abs(p.y - tr) < 0.08) { inp.path.shift(); inp.pathT = 0; continue; }
      const dx = tc - p.x, dy = tr - p.y;
      if (Math.abs(dx) > Math.abs(dy)) inp.moveX = Math.sign(dx);
      else inp.moveY = Math.sign(dy);
      break;
    }
    if (!inp.path.length || inp.pathT > 1.2) inp.path = null;
  }

  Object.assign(NS.input, {
    sample, findPath, arenaCell, escape
  });
})();
