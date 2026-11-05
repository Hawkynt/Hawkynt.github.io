/* The autopilot that plays the title-screen demo and proves levels completable in the tests:
   a breadth-first search through wrap edges and portals to the gate, a Sun Shard, a shining
   ram at the guardian or the nearest fruit, avoiding walls, bodies, critters, hazards and every
   telegraphed strike; each chosen step must leave room for the whole body, otherwise it takes the
   move with the most open space. Reads the run; writes only the snake's turn queue. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { COLS, ROWS } = NS.constants;
  const { T, ENEMIES } = NS.items;
  const L = NS.levels;
  const B = NS.board;

  const N = COLS * ROWS;
  const blockedMap = new Uint8Array(N);
  const prev = new Int16Array(N);
  const firstDir = new Int8Array(N);
  const q = new Int16Array(N * 2);
  const seen = new Uint8Array(N);

  function buildBlocked(cautious, desperate) {
    const run = G.run;
    const s = run.snake;
    const lv = run.level;
    const radiant = run.act.radiant > 0;
    blockedMap.fill(0);
    for (let i = 0; i < N; ++i) {
      const ch = lv.tiles[i];
      if (L.isSolid(ch) && !(radiant && (ch === T.CRATE || ch === T.ROCK))) blockedMap[i] = 1;
      else if (L.isTimed(ch) && B.timedState(i) !== 'off') blockedMap[i] = 1;
      else if (L.isTimed(ch) && cautious && L.hazardState(ch, i, run.hazT + 0.5) !== 'off') blockedMap[i] = 1;
    }
    const m = run.marks;
    for (let k = 0; k < m.length; ++k) if (m[k].kind !== 'rock' && !(desperate && m[k].kind === 'warn')) blockedMap[m[k].i] = 1;
    const body = s.body;
    for (let k = 0; k < body.length - (s.grow > 0 ? 0 : 1); ++k) blockedMap[body[k]] = 1;
    for (let e = 0; e < run.enemies.length; ++e) {
      const en = run.enemies[e];
      if (!en.alive) continue;
      const def = ENEMIES[en.type];
      if (en.body) for (let k = 0; k < en.body.length; ++k) blockedMap[en.body[k]] = 1;
      else if (!def.edible && !radiant) blockedMap[en.i] = 1;
      if (cautious && def.deadly && !radiant) {
        const c = en.body ? en.body[0] : en.i;
        for (let d = 0; d < 4; ++d) { const n = L.step(lv, c, d); if (n >= 0) blockedMap[n] = 1; }
        if (def.flies) for (let d = 0; d < 4; ++d) {
          const n = L.step(lv, c, d);
          if (n >= 0) for (let d2 = 0; d2 < 4; ++d2) { const n2 = L.step(lv, n, d2); if (n2 >= 0) blockedMap[n2] = 1; }
        }
      }
    }
    if (run.boss && run.boss.hp > 0) {
      const cells = NS.bosses.cells(run.boss);
      if (!radiant) for (let k = 0; k < cells.length; ++k) {
        blockedMap[cells[k]] = 1;
        if (cautious) for (let d = 0; d < 4; ++d) { const n = L.step(lv, cells[k], d); if (n >= 0) blockedMap[n] = 1; }
      }
    }
    blockedMap[body[0]] = 0;
  }

  /* neighbours of c through portals: calls fn(cell, dirFromC) */
  function eachNext(lv, c, fn) {
    for (let d = 0; d < 4; ++d) {
      const s = L.step(lv, c, d);
      if (s < 0) continue;
      fn(L.arrive(lv, s), d, s);
    }
  }

  /* in a guardian fight the snake stays short: it only wants Sun Shards, power-ups and, while
     shining, the guardian; other fights and levels go for fruit too */
  let fruitToo = true;

  function isTarget(i) {
    const run = G.run;
    if (run.gate >= 0) return i === run.gate;
    const fight = run.boss && run.boss.hp > 0;
    if (fight && run.act.radiant > 0) {
      const cells = NS.bosses.cells(run.boss);
      if (cells.indexOf(i) >= 0) return true;
    }
    if (run.power && run.power.i === i) return true;
    const f = B.foodIndex(i);
    if (f < 0) return false;
    if (!fight || fruitToo) return true;
    const k = run.foods[f].kind;
    return k === 'shard' || k === 'egg' || k === 'gem' || k === 'token';
  }

  function search() {
    const run = G.run;
    const lv = run.level;
    const head = run.snake.body[0];
    prev.fill(-1);
    let h = 0, t = 0;
    prev[head] = head;
    q[t++] = head;
    firstDir[head] = -1;
    while (h < t) {
      const c = q[h++];
      if (c !== head && isTarget(c)) return firstDir[c];
      if (c !== head && lv.tiles[c] === T.ICE && prev[c] >= 0 && h > 1) {
        /* mid-slide cells are passed through, never turned on */
      }
      eachNext(lv, c, (n, d, raw) => {
        if (prev[n] >= 0) return;
        const radiantTarget = isTarget(n) && run.boss && run.act.radiant > 0;
        if (blockedMap[n] && !radiantTarget) return;
        if (raw !== n && blockedMap[raw]) return;
        /* ice: the snake slides straight on until it leaves the ice */
        let e = n;
        while (lv.tiles[e] === T.ICE && !isTarget(e)) {
          const s2 = L.step(lv, e, d);
          if (s2 < 0) return;
          const a2 = L.arrive(lv, s2);
          if (blockedMap[a2] && !(isTarget(a2) && run.act.radiant > 0)) return;
          e = a2;
          if (e === head) return;
        }
        if (prev[e] >= 0 && e !== n) return;
        prev[n] = c;
        firstDir[n] = c === head ? d : firstDir[c];
        if (e !== n) {
          prev[e] = n;
          firstDir[e] = firstDir[n];
          q[t++] = e;
        } else q[t++] = n;
      });
    }
    return -1;
  }

  /* open cells reachable from 'from' (the body already treated as walls) */
  function room(from, limit) {
    const lv = G.run.level;
    seen.fill(0);
    let h = 0, t = 0, n = 0;
    seen[from] = 1;
    q[t++] = from;
    while (h < t && n < limit) {
      const c = q[h++];
      ++n;
      eachNext(lv, c, (s) => {
        if (seen[s] || blockedMap[s]) return;
        seen[s] = 1;
        q[t++] = s;
      });
    }
    return n;
  }

  /* where a move ends up after any ice slide; -1 if it runs into something */
  function moveTarget(d) {
    const lv = G.run.level;
    const s = L.step(lv, G.run.snake.body[0], d);
    if (s < 0) return -1;
    let e = L.arrive(lv, s);
    let guard = 0;
    while (lv.tiles[e] === T.ICE && guard++ < 40) {
      if (blockedMap[e]) return -1;
      const s2 = L.step(lv, e, d);
      if (s2 < 0) return -1;
      e = L.arrive(lv, s2);
    }
    return e;
  }

  function choose() {
    const run = G.run;
    const s = run.snake;
    if (run.level.tiles[s.body[0]] === T.ICE) return s.dir;
    const need = s.body.length + 2;
    for (let pass = 0; pass < 3; ++pass) {
      fruitToo = pass === 2;
      buildBlocked(pass === 0);
      const d = search();
      if (d >= 0 && d !== (s.dir + 2) % 4) {
        const n = moveTarget(d);
        if (n >= 0 && room(n, need) >= need) return d;
      }
    }
    /* no safe path: the move with the most room, and if every move is threatened, the one into
       a mere warning rather than a wall */
    for (let pass = 0; pass < 2; ++pass) {
      buildBlocked(false, pass === 1);
      let best = -1, bestRoom = -1;
      for (let d = 0; d < 4; ++d) {
        if (d === (s.dir + 2) % 4) continue;
        const n = moveTarget(d);
        if (n < 0 || blockedMap[n]) continue;
        const r = room(n, 400) + (d === s.dir ? 0.5 : 0);
        if (r > bestRoom) { bestRoom = r; best = d; }
      }
      if (best >= 0) return best;
    }
    return s.dir;
  }

  function steer() {
    const d = choose();
    G.run.snake.queue.length = 0;
    if (d !== G.run.snake.dir) G.run.snake.queue.push(d);
  }

  Object.assign(NS.autopilot, {
    choose, steer
  });
})();
