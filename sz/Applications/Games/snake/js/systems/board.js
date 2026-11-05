/* The board of the current run: tile reads and writes (bumping the version the cached board
   layer redraws on), the timed hazard clock (slowed by Time Warp, stopped by Frost Nova), marks
   laid by guardians and imps (warnings that turn into fire, spikes, lasers or rocks), the
   occupancy grid of snakes, critters and guardians rebuilt each step, and free-cell picking with
   the run's seeded generator. Owns run.marks and the occupancy arrays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { COLS, ROWS } = NS.constants;
  const { T } = NS.items;
  const L = NS.levels;

  /* occupancy codes */
  const EMPTY = 0, BODY = 1, HEAD = 2, CRITTER = 3, RIVAL = 4, BOSS = 5;
  const occ = { type: new Uint8Array(COLS * ROWS), ref: new Int16Array(COLS * ROWS) };
  const DEADLY_MARKS = { fire: 1, spike: 1, laser: 1, sting: 1 };

  function tile(i) {
    return G.run.level.tiles[i];
  }

  function setTile(i, ch) {
    const lv = G.run.level;
    if (lv.tiles[i] === ch) return;
    lv.tiles[i] = ch;
    lv.ver = (lv.ver || 0) + 1;
  }

  function frozen() {
    return (G.run.act.frost || 0) > 0;
  }

  /* 'off', 'warn' or 'on' for the timed tile at i */
  function timedState(i) {
    const ch = G.run.level.tiles[i];
    if (!L.isTimed(ch) || frozen()) return 'off';
    return L.hazardState(ch, i, G.run.hazT);
  }

  function markAt(i) {
    const m = G.run.marks;
    let best = null;
    for (let k = 0; k < m.length; ++k) {
      if (m[k].i !== i) continue;
      if (DEADLY_MARKS[m[k].kind]) return m[k];
      best = m[k];
    }
    return best;
  }

  function deadlyAt(i) {
    if (timedState(i) === 'on') return true;
    const m = markAt(i);
    return !!(m && DEADLY_MARKS[m.kind]);
  }

  function warnAt(i) {
    if (timedState(i) === 'warn') return true;
    const m = markAt(i);
    return !!(m && m.kind === 'warn');
  }

  /* kind: warn, fire, spike, laser, sting; then: what a warning becomes when it runs out */
  function addMark(i, kind, life, then, thenLife) {
    if (i < 0 || L.isSolid(G.run.level.tiles[i])) return;
    G.run.marks.push({ i: i, kind: kind, t: 0, life: life, then: then || '', thenLife: thenLife || 0 });
  }

  function updateMarks(dt) {
    const m = G.run.marks;
    for (let k = m.length - 1; k >= 0; --k) {
      const mk = m[k];
      mk.t += dt;
      if (mk.t < mk.life) continue;
      m.splice(k, 1);
      if (!mk.then) continue;
      if (mk.then === 'rock') {
        if (tile(mk.i) === T.FLOOR && occ.type[mk.i] === EMPTY && foodIndex(mk.i) < 0) {
          setTile(mk.i, T.ROCK);
          m.push({ i: mk.i, kind: 'rock', t: 0, life: mk.thenLife || 8, then: 'unrock', thenLife: 0 });
        }
      } else if (mk.then === 'unrock') {
        if (tile(mk.i) === T.ROCK) setTile(mk.i, T.FLOOR);
      } else if (mk.then === 'crate') {
        if (tile(mk.i) === T.FLOOR && occ.type[mk.i] === EMPTY && foodIndex(mk.i) < 0) setTile(mk.i, T.CRATE);
      } else if (mk.then === 'ice') {
        if (tile(mk.i) === T.FLOOR) setTile(mk.i, T.ICE);
      } else {
        m.push({ i: mk.i, kind: mk.then, t: 0, life: mk.thenLife || 0.6, then: '', thenLife: 0 });
        NS.combat.onHazardStrike(mk.i, mk.then);
      }
    }
  }

  function rebuildOcc() {
    const run = G.run;
    occ.type.fill(EMPTY);
    const body = run.snake.body;
    for (let k = body.length - 1; k >= 0; --k) {
      occ.type[body[k]] = k === 0 ? HEAD : BODY;
      occ.ref[body[k]] = k;
    }
    const es = run.enemies;
    for (let e = 0; e < es.length; ++e) {
      const en = es[e];
      if (!en.alive) continue;
      if (en.body) for (let k = 0; k < en.body.length; ++k) { occ.type[en.body[k]] = RIVAL; occ.ref[en.body[k]] = e; }
      else { occ.type[en.i] = CRITTER; occ.ref[en.i] = e; }
    }
    if (run.boss && run.boss.hp > 0) {
      const cells = NS.bosses.cells(run.boss);
      for (let k = 0; k < cells.length; ++k) { occ.type[cells[k]] = BOSS; occ.ref[cells[k]] = k; }
    }
  }

  function foodIndex(i) {
    const f = G.run.foods;
    for (let k = 0; k < f.length; ++k) if (f[k].i === i) return k;
    return -1;
  }

  /* a cell nothing is on and nothing threatens */
  function isFree(i) {
    const ch = G.run.level.tiles[i];
    if (ch !== T.FLOOR && ch !== T.SAND && ch !== T.ICE) return false;
    if (occ.type[i] !== EMPTY) return false;
    if (foodIndex(i) >= 0) return false;
    if (G.run.power && G.run.power.i === i) return false;
    if (G.run.gate === i) return false;
    return !markAt(i);
  }

  function dist(a, b) {
    let dx = Math.abs(a % COLS - b % COLS), dy = Math.abs(((a / COLS) | 0) - ((b / COLS) | 0));
    if (G.run && G.run.level.wrap) { dx = Math.min(dx, COLS - dx); dy = Math.min(dy, ROWS - dy); }
    return dx + dy;
  }

  /* a random free cell at least minDist steps from the head (relaxed if the board is full) */
  function freeCell(minDist, filter) {
    const run = G.run;
    const head = run.snake.body[0];
    const n = COLS * ROWS;
    for (let pass = 0; pass < 3; ++pass) {
      const need = pass === 0 ? minDist : pass === 1 ? 2 : 0;
      for (let tries = 0; tries < 60; ++tries) {
        const i = Math.floor(G.rng() * n);
        if (isFree(i) && dist(i, head) >= need && (!filter || filter(i))) return i;
      }
    }
    for (let i = 0; i < n; ++i) if (isFree(i)) return i;
    return -1;
  }

  Object.assign(NS.board, {
    EMPTY, BODY, HEAD, CRITTER, RIVAL, BOSS, occ, tile, setTile, frozen, timedState, markAt, deadlyAt, warnAt,
    addMark, updateMarks, rebuildOcc, foodIndex, isFree, dist, freeCell
  });
})();
