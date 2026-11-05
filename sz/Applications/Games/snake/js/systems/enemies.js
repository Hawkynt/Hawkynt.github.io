/* Critters: spawning away from the head, each on its own step clock (halved by Time Warp,
   stopped by Frost Nova), and their behaviours - wandering ants, marching beetles, hornets flying
   diagonally over walls, hedgehogs that path to fruit and steal it, rival snakes that race for
   fruit and crash, wisps drifting through walls toward the head, imps leaving fire. Contact with
   the player's head goes to snake.hurt. Owns run.enemies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { COLS, ROWS } = NS.constants;
  const { ENEMIES, T } = NS.items;
  const L = NS.levels;
  const B = NS.board;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function make(type, i) {
    const e = { type: type, i: i, pi: i, dir: Math.floor(G.rng() * 4), acc: G.rng() * 0.2, alive: true, respawnT: 0, dx: 1, dy: 1, born: 0.6 };
    if (type === 'hornet') { e.dx = G.rng() < 0.5 ? -1 : 1; e.dy = G.rng() < 0.5 ? -1 : 1; }
    if (type === 'rival') {
      e.body = [i];
      e.prev = [i];
      e.grow = 2;
      e.color = ['#e88a2a', '#b04ad0', '#2ab0c0'][G.run.enemies.length % 3];
    }
    return e;
  }

  function spawnOne(type) {
    const i = B.freeCell(9, (c) => {
      const x = c % COLS, y = (c / COLS) | 0;
      return x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1;
    });
    if (i < 0) return null;
    const e = make(type, i);
    G.run.enemies.push(e);
    B.rebuildOcc();
    fx.burst(fx.cx(i), fx.cy(i), 10, '#ffffff', 120, 0.4, 6, fx.DOT);
    return e;
  }

  function spawnAll(list) {
    for (let k = 0; k < list.length; ++k) spawnOne(list[k]);
  }

  /* can a ground critter step into cell s */
  function open(s) {
    if (s < 0) return false;
    const ch = G.run.level.tiles[s];
    if (L.isSolid(ch) || L.isPortal(ch)) return false;
    if (B.occ.type[s] !== B.EMPTY) return false;
    if (B.timedState(s) === 'on') return false;
    return true;
  }

  function worldRate() {
    return (G.run.act.warp || 0) > 0 ? 0.5 : 1;
  }

  function update(dt) {
    const run = G.run;
    const frozen = B.frozen();
    const rate = worldRate();
    for (let k = 0; k < run.enemies.length; ++k) {
      const e = run.enemies[k];
      if (!e.alive) {
        e.respawnT -= dt;
        if (e.respawnT <= 0 && run.respawnCritters) {
          const i = B.freeCell(9);
          if (i >= 0) {
            const fresh = make(e.type, i);
            fresh.color = e.color || fresh.color;
            run.enemies[k] = fresh;
            B.rebuildOcc();
          }
        }
        continue;
      }
      if (e.born > 0) e.born = Math.max(0, e.born - dt);
      if (frozen) continue;
      const def = ENEMIES[e.type];
      e.acc += dt * rate;
      if (e.acc < def.interval) continue;
      e.acc -= def.interval;
      move(e, k);
    }
  }

  function move(e, idx) {
    const run = G.run;
    const lv = run.level;
    e.pi = e.i;
    let next = -1;
    switch (e.type) {
      case 'ant':
      case 'imp': {
        const opts = [];
        for (let d = 0; d < 4; ++d) if (open(L.step(lv, e.i, d))) opts.push(d);
        if (!opts.length) return;
        if (opts.indexOf(e.dir) < 0 || G.rng() < 0.3) e.dir = opts[Math.floor(G.rng() * opts.length)];
        next = L.step(lv, e.i, e.dir);
        if (e.type === 'imp' && G.rng() < 0.6) B.addMark(e.i, 'fire', 2.6);
        break;
      }
      case 'beetle': {
        let s = L.step(lv, e.i, e.dir);
        if (!open(s)) {
          const turns = G.rng() < 0.5 ? [1, 3, 2] : [3, 1, 2];
          for (let t = 0; t < 3; ++t) {
            const d = (e.dir + turns[t]) % 4;
            s = L.step(lv, e.i, d);
            if (open(s)) { e.dir = d; break; }
          }
        }
        next = open(s) ? s : -1;
        break;
      }
      case 'hornet': {
        let x = e.i % COLS + e.dx, y = ((e.i / COLS) | 0) + e.dy;
        if (x < 1 || x > COLS - 2) { e.dx = -e.dx; x = e.i % COLS + e.dx; }
        if (y < 1 || y > ROWS - 2) { e.dy = -e.dy; y = ((e.i / COLS) | 0) + e.dy; }
        next = y * COLS + x;
        const o = B.occ.type[next];
        if (o === B.CRITTER || o === B.BOSS || o === B.RIVAL) { e.dx = -e.dx; e.dy = -e.dy; next = -1; }
        break;
      }
      case 'wisp': {
        const h = run.snake.body[0];
        const dx = h % COLS - e.i % COLS, dy = ((h / COLS) | 0) - ((e.i / COLS) | 0);
        const horiz = Math.abs(dx) > Math.abs(dy) || (Math.abs(dx) === Math.abs(dy) && G.rng() < 0.5);
        const d = horiz ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        const s = L.step(lv, e.i, d);
        const o = s >= 0 ? B.occ.type[s] : -1;
        if (s >= 0 && (o === B.EMPTY || o === B.HEAD || o === B.BODY)) next = s;
        e.dir = d;
        break;
      }
      case 'hedgehog': {
        const d = bfsDir(e.i, (c) => {
          const f = B.foodIndex(c);
          return f >= 0 && NS.food.MAIN[run.foods[f].kind];
        }, 60);
        if (d >= 0) { e.dir = d; next = L.step(lv, e.i, d); if (!open(next) && B.occ.type[next] !== B.HEAD) next = -1; }
        break;
      }
      case 'rival':
        moveRival(e, idx);
        return;
    }
    if (next < 0) return;
    const o = B.occ.type[next];
    if (o === B.HEAD) {
      if (!ENEMIES[e.type].deadly) return;
      NS.snake.critterHit(e, idx);
      if (!e.alive) return;
    } else if (o === B.BODY && !ENEMIES[e.type].flies) return;
    e.i = next;
    B.rebuildOcc();
    if (e.type === 'hedgehog') {
      const f = B.foodIndex(next);
      if (f >= 0 && NS.food.MAIN[run.foods[f].kind]) {
        run.foods.splice(f, 1);
        fx.text(fx.cx(next), fx.cy(next) - 20, 'stolen!', '#ffb0a0', 15);
        fx.burst(fx.cx(next), fx.cy(next), 8, '#ff8a6a', 100, 0.4, 5, fx.DOT);
        sfx('drop', { pitch: 0.8, volume: 0.6 });
      }
    }
  }

  /* first step of a shortest path from 'from' to a cell passing isTarget, or -1 */
  const bfsPrev = new Int16Array(COLS * ROWS);
  const bfsQ = new Int16Array(COLS * ROWS);
  function bfsDir(from, isTarget, limit, passable) {
    const lv = G.run.level;
    bfsPrev.fill(-1);
    bfsPrev[from] = from;
    let h = 0, t = 0, found = -1;
    bfsQ[t++] = from;
    while (h < t && h < (limit || 999)) {
      const c = bfsQ[h++];
      if (c !== from && isTarget(c)) { found = c; break; }
      for (let d = 0; d < 4; ++d) {
        const s = L.step(lv, c, d);
        if (s < 0 || bfsPrev[s] >= 0) continue;
        if (passable ? !passable(s) : (!open(s) && !isTarget(s))) continue;
        bfsPrev[s] = c;
        bfsQ[t++] = s;
      }
    }
    if (found < 0) return -1;
    let c = found;
    while (bfsPrev[c] !== from) c = bfsPrev[c];
    for (let d = 0; d < 4; ++d) if (L.step(lv, from, d) === c) return d;
    return -1;
  }

  function moveRival(e, idx) {
    const run = G.run;
    const lv = run.level;
    const head = e.body[0];
    e.prev = e.body.slice();
    let d = bfsDir(head, (c) => {
      const f = B.foodIndex(c);
      return f >= 0 && NS.food.MAIN[run.foods[f].kind];
    }, 400);
    if (d < 0 || d === (e.dir + 2) % 4) {
      const opts = [];
      for (let k = 0; k < 4; ++k) if (k !== (e.dir + 2) % 4 && open(L.step(lv, head, k))) opts.push(k);
      d = opts.length ? (opts.indexOf(e.dir) >= 0 && G.rng() < 0.7 ? e.dir : opts[Math.floor(G.rng() * opts.length)]) : e.dir;
    }
    e.dir = d;
    const s = L.step(lv, head, d);
    const o = s >= 0 ? B.occ.type[s] : -1;
    const ch = s >= 0 ? lv.tiles[s] : T.WALL;
    if (o === B.HEAD) {
      NS.snake.critterHit(e, idx);
      if (!e.alive) return;
    }
    if (s < 0 || L.isSolid(ch) || (o !== B.EMPTY && o !== B.HEAD) || B.deadlyAt(s)) {
      const byPlayer = o === B.BODY;
      NS.combat.killEnemy(e, byPlayer ? 'crash' : 'self');
      return;
    }
    e.body.unshift(s);
    e.i = s;
    if (e.grow > 0) --e.grow; else e.body.pop();
    const f = B.foodIndex(s);
    if (f >= 0 && NS.food.MAIN[run.foods[f].kind]) {
      run.foods.splice(f, 1);
      e.grow += 1;
      fx.burst(fx.cx(s), fx.cy(s), 8, e.color, 120, 0.4, 5);
    }
    B.rebuildOcc();
  }

  Object.assign(NS.enemies, {
    make, spawnOne, spawnAll, update, open, bfsDir
  });
})();
