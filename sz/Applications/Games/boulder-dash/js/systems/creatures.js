/* Creature behaviour, one move per cave tick: fireflies keep a wall on their left, butterflies
   on their right, ice bats fly straight and turn right at walls, moles dig toward the miner at
   half pace. Any creature touching the miner (or spore moss, for fireflies and butterflies)
   explodes. The frost charm freezes them all and makes them harmless. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;

  function moveTo(cv, i, j, t, d) {
    cv.cells[j] = t;
    cv.dir[j] = d;
    cv.aux[j] = cv.aux[i];
    cv.cells[i] = C.EMPTY;
    cv.dir[i] = 0;
    cv.aux[i] = 0;
    cv.mvx[j] = j % cv.w - i % cv.w;
    cv.mvy[j] = ((j / cv.w) | 0) - ((i / cv.w) | 0);
    cv.stamp[j] = cv.tick;
  }

  function nextCell(cv, i, d) {
    return i + C.DX[d] + C.DY[d] * cv.w;
  }

  /* wall followers: prefer = 3 turns left first (firefly), 1 turns right first (butterfly) */
  function follow(cv, i, t, prefer) {
    const d = cv.dir[i];
    const turn = (d + prefer) % 4;
    const ti = nextCell(cv, i, turn);
    if (cv.cells[ti] === C.EMPTY) { moveTo(cv, i, ti, t, turn); return; }
    const fi = nextCell(cv, i, d);
    if (cv.cells[fi] === C.EMPTY) { moveTo(cv, i, fi, t, d); return; }
    cv.dir[i] = (d + 4 - prefer) % 4;
  }

  function bat(cv, i, t) {
    const d = cv.dir[i];
    const fi = nextCell(cv, i, d);
    if (cv.cells[fi] === C.EMPTY) moveTo(cv, i, fi, t, d);
    else cv.dir[i] = (d + 1) % 4;
  }

  /* moles doze until the miner comes within WAKE cells, then dig after them at half pace */
  const WAKE = 6;
  function mole(cv, i, t) {
    const p = cv.player;
    if (!p || !p.alive) return;
    const r = (i / cv.w) | 0, c = i % cv.w;
    const dy = p.r - r, dx = p.c - c;
    if (!cv.dir[i]) {
      if (Math.abs(dx) + Math.abs(dy) > WAKE) return;
      cv.dir[i] = 1;
      NS.physics.ev(cv, 'wake', i);
    }
    cv.aux[i] = (cv.aux[i] + 1) & 255;
    if (cv.aux[i] & 1) return;
    const order = [];
    const hx = dx > 0 ? 1 : 3, vy = dy > 0 ? 2 : 0;
    if (Math.abs(dx) >= Math.abs(dy)) { if (dx) order.push(hx); if (dy) order.push(vy); }
    else { if (dy) order.push(vy); if (dx) order.push(hx); }
    for (let k = 0; k < order.length; ++k) {
      const j = nextCell(cv, i, order[k]);
      const tt = cv.cells[j];
      if (tt === C.EMPTY || tt === C.DIRT) {
        /* never burrow under something loose */
        if (C.FALLS[cv.cells[j - cv.w]] && tt === C.DIRT) continue;
        moveTo(cv, i, j, t, 1);
        return;
      }
    }
  }

  function step(cv, i, t) {
    if (cv.frozen) return;
    switch (t) {
      case C.FIREFLY: follow(cv, i, t, 3); break;
      case C.BUTTERFLY: follow(cv, i, t, 1); break;
      case C.BAT: bat(cv, i, t); break;
      case C.MOLE: mole(cv, i, t); break;
    }
  }

  /* creatures next to the miner (or moss) blow up */
  function contact(cv) {
    if (cv.frozen) return;
    const { w, cells } = cv;
    const p = cv.player;
    const check = [];
    if (p && p.alive) {
      const pi = p.r * w + p.c;
      for (let d = 0; d < 4; ++d) {
        const j = pi + C.DX[d] + C.DY[d] * w;
        if (C.CREATURE[cells[j]]) check.push(j);
      }
    }
    if (cv.amoeba.count) {
      for (let i = 0; i < cells.length; ++i) {
        const t = cells[i];
        if (t !== C.FIREFLY && t !== C.BUTTERFLY) continue;
        for (let d = 0; d < 4; ++d)
          if (cells[i + C.DX[d] + C.DY[d] * w] === C.AMOEBA) { check.push(i); break; }
      }
    }
    for (let k = 0; k < check.length; ++k) {
      const j = check[k];
      const t = cells[j];
      if (!C.CREATURE[t]) continue;
      NS.physics.ev(cv, 'touch', j, { k: t });
      NS.physics.explodeAt(cv, j, NS.physics.creatureLeaves(t), 1, 'touch');
    }
  }

  Object.assign(NS.creatures, { step, contact, moveTo, WAKE });
})();
