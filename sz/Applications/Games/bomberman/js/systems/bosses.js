/* Bosses: one big actor per boss arena running its attack cycle (chase, burrow, rocks, summon,
   ring, shards, cross, strafe, columns, rows, bomb rain, laser, dash, teleport) with telegraphed
   danger cells that turn into fire or fresh bricks, an enraged second phase at half health,
   damage from any non-boss fire on its footprint, kicked bombs that blow up on contact, and a
   dying sequence that opens the exit. Mutates G.run.boss and G.run.tele. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS, T_EMPTY, T_HARD, T_SOFT, T_CRATE, T_TELE } = C;
  const { BOSSES } = NS.content;
  const A = NS.arena;
  const fx = NS.fx;

  const DUR = { chase: 3.2, burrow: 2.4, rocks: 1.8, summon: 1.2, ring: 1.6, shards: 1.6, cross: 1.6, strafe: 2.8, columns: 1.8, rows: 1.8, bombrain: 1.6, laser: 1.7, dash: 1.2, teleport: 1.1 };

  function create(type, at, hpMul) {
    const def = BOSSES[type];
    const hp = Math.round(def.hp * (hpMul || 1));
    return {
      type: type, x: at % COLS, y: (at / COLS) | 0, hp: hp, maxHp: hp, state: 'intro', t: 0, cycle: 0, phase: 1,
      inv: 0, flash: 0, tx: at % COLS, ty: (at / COLS) | 0, under: false, alpha: 1, dir: 3, squash: 1, deadT: 0, group: 0, pending: null
    };
  }

  function half(b) {
    return BOSSES[b.type].size / 2;
  }

  function covers(b, c, r) {
    const h = half(b);
    return Math.abs(c - b.x) < h && Math.abs(r - b.y) < h;
  }

  /* Bombs stop against a solid boss (and blow up, see update) */
  function blocksCell(c, r) {
    const b = G.run.boss;
    return !!(b && b.state !== 'dead' && !b.under && b.alpha > 0.5 && covers(b, c, r));
  }

  function rand() {
    return NS.run.rand();
  }

  function freeCells(minDistFromPlayer) {
    const run = G.run, p = run.player, g = run.level.grid;
    const out = [];
    for (let r = 1; r < ROWS - 1; ++r)
      for (let c = 1; c < COLS - 1; ++c) {
        const t = g[A.idx(c, r)];
        if (t !== T_EMPTY && t !== C.T_ICE && !(t >= C.T_BELT_U && t <= C.T_BELT_R)) continue;
        if (Math.abs(c - p.x) + Math.abs(r - p.y) < minDistFromPlayer) continue;
        out.push(A.idx(c, r));
      }
    return out;
  }

  function telegraph(cells, dur, kind) {
    if (!cells.length) return;
    G.run.tele.push({ cells: cells, t: 0, dur: dur, kind: kind || 'fire' });
  }

  /* Cells of a straight line from (c, r) in direction d until a stone wall */
  function line(c, r, d, out) {
    for (let k = 1; k < COLS; ++k) {
      const x = c + C.DIRS[d][0] * k, y = r + C.DIRS[d][1] * k;
      if (!A.inside(x, y) || A.tileAt(x, y) === T_HARD) break;
      out.push(A.idx(x, y));
    }
    return out;
  }

  function lineCells(c, r, dirs) {
    const out = [A.idx(c, r)];
    for (let k = 0; k < dirs.length; ++k) line(c, r, dirs[k], out);
    return out;
  }

  function start(b, state) {
    const def = BOSSES[b.type];
    const p = G.run.player;
    const pc = Math.round(p.x), pr = Math.round(p.y);
    const bc = Math.round(b.x), br = Math.round(b.y);
    const fast = b.phase === 2 ? 0.8 : 1;
    b.state = state;
    b.t = 0;
    b.dur = DUR[state] * fast;
    switch (state) {
      case 'burrow':
        b.under = true;
        fx.burst(fx.px(b.x), fx.py(b.y), 24, '#8a6a4a', 220, 0.7, 2, false, 600);
        fx.sfx('thud', { pitch: 0.6 });
        break;
      case 'rocks': {
        const cells = freeCells(2);
        const n = b.phase === 2 ? 7 : 5;
        const pick = [];
        for (let k = 0; k < n && cells.length; ++k) pick.push(cells.splice(Math.floor(rand() * cells.length), 1)[0]);
        telegraph(pick, 1.1, 'rock');
        b.squash = 0.6;
        break;
      }
      case 'summon': {
        const n = Math.min(b.phase === 2 ? 3 : 2, 7 - G.run.enemies.length);
        const cells = freeCells(5);
        for (let k = 0; k < n && cells.length; ++k) {
          const i = cells.splice(Math.floor(rand() * cells.length), 1)[0];
          NS.enemies.spawn(def.minion, i % COLS, (i / COLS) | 0);
          fx.burst(fx.px(i % COLS), fx.py((i / COLS) | 0), 16, '#c58bff', 160, 0.5, 6, true);
        }
        fx.sfx('zap', { pitch: 0.7 });
        b.squash = 0.6;
        break;
      }
      case 'ring': {
        const cells = [];
        const rad = b.phase === 2 ? 4 : 3;
        for (let r = 1; r < ROWS - 1; ++r)
          for (let c = 1; c < COLS - 1; ++c) {
            const d = Math.abs(c - bc) + Math.abs(r - br);
            if ((d === rad || d === rad - 2) && A.tileAt(c, r) !== T_HARD) cells.push(A.idx(c, r));
          }
        telegraph(cells, 1.1);
        break;
      }
      case 'shards':
        telegraph(lineCells(bc, br, [0, 1, 2, 3]), 1.1);
        if (b.phase === 2) telegraph(lineCells(pc, pr, [0, 1, 2, 3]), 1.4);
        fx.shake(8);
        fx.sfx('thud', { pitch: 0.5 });
        b.squash = 0.5;
        break;
      case 'cross':
        telegraph(lineCells(pc, pr, [0, 1, 2, 3]), 1.2);
        break;
      case 'columns': {
        const cols = [pc];
        while (cols.length < (b.phase === 2 ? 4 : 3)) {
          const c = 1 + Math.floor(rand() * (COLS - 2));
          if (cols.indexOf(c) < 0) cols.push(c);
        }
        for (let k = 0; k < cols.length; ++k) {
          const cells = [];
          for (let r = 1; r < ROWS - 1; ++r) if (A.tileAt(cols[k], r) !== T_HARD) cells.push(A.idx(cols[k], r));
          telegraph(cells, 1.2 + k * 0.15);
        }
        b.squash = 0.6;
        break;
      }
      case 'rows': {
        const rows = [pr, 1 + Math.floor(rand() * (ROWS - 2))];
        for (let k = 0; k < rows.length; ++k) {
          const cells = [];
          for (let c = 1; c < COLS - 1; ++c) if (A.tileAt(c, rows[k]) !== T_HARD) cells.push(A.idx(c, rows[k]));
          telegraph(cells, 1.2 + k * 0.3);
        }
        break;
      }
      case 'laser': {
        const cells = [];
        for (let c = 1; c < COLS - 1; ++c) if (A.tileAt(c, pr) !== T_HARD) cells.push(A.idx(c, pr));
        if (b.phase === 2) for (let r = 1; r < ROWS - 1; ++r) if (A.tileAt(pc, r) !== T_HARD) cells.push(A.idx(pc, r));
        telegraph(cells, 1.0, 'laser');
        fx.sfx('laser', { pitch: 0.6 });
        break;
      }
      case 'bombrain': {
        const cells = freeCells(2);
        const n = b.phase === 2 ? 7 : 5;
        for (let k = 0; k < n && cells.length; ++k) {
          const i = cells.splice(Math.floor(rand() * cells.length), 1)[0];
          NS.bombs.placeEnemy(i % COLS, (i / COLS) | 0, 2, 1.8 + k * 0.12, 'b');
        }
        A.rebuild();
        fx.sfx('drop', { pitch: 0.7 });
        b.squash = 0.6;
        break;
      }
      case 'dash': {
        b.tx = b.x < COLS / 2 ? COLS - 3 : 2;
        b.ty = Math.max(1.5, Math.min(ROWS - 2.5, p.y));
        fx.sfx('whoosh', { pitch: 0.6 });
        break;
      }
      case 'strafe':
        b.ty = rand() < 0.5 ? 2 : ROWS - 3;
        b.tx = p.x;
        break;
      case 'teleport':
        fx.sfx('zap', { pitch: 0.5 });
        break;
    }
  }

  function moveToward(b, tx, ty, speed, dt) {
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01) return true;
    const s = Math.min(d, speed * dt);
    b.x += dx / d * s;
    b.y += dy / d * s;
    if (Math.abs(dx) > 0.2) b.dir = dx > 0 ? 3 : 2;
    const h = half(b);
    b.x = Math.max(0.5 + h, Math.min(COLS - 1.5 - h, b.x));
    b.y = Math.max(0.5 + h, Math.min(ROWS - 1.5 - h, b.y));
    return s >= d;
  }

  /* The boss plows through bricks it walks over */
  function crush(b) {
    if (b.under) return;
    const g = G.run.level.grid;
    for (let r = Math.floor(b.y - 1); r <= Math.ceil(b.y + 1); ++r)
      for (let c = Math.floor(b.x - 1); c <= Math.ceil(b.x + 1); ++c) {
        if (!A.inside(c, r) || !covers(b, c, r)) continue;
        const i = A.idx(c, r);
        if (g[i] === T_SOFT || g[i] === T_CRATE) {
          g[i] = T_EMPTY;
          G.run.levelDirty = true;
          fx.crumble(c, r);
          A.reveal(i);
        }
      }
  }

  function updateTele(dt) {
    const run = G.run;
    for (let k = run.tele.length - 1; k >= 0; --k) {
      const t = run.tele[k];
      t.t += dt;
      if (t.t < t.dur) continue;
      run.tele.splice(k, 1);
      if (!run.boss || run.boss.state === 'dead') continue;
      const grp = run.boss.group || (run.boss.group = run.nextId++);
      for (let j = 0; j < t.cells.length; ++j) {
        const i = t.cells[j];
        const c = i % COLS, r = (i / COLS) | 0;
        if (t.kind === 'rock') {
          const p = run.player;
          if (run.level.grid[i] !== T_EMPTY || A.bombAtCell(c, r) || G.lvl.enemyAt[i] || (Math.round(p.x) === c && Math.round(p.y) === r)) continue;
          run.level.grid[i] = T_SOFT;
          run.levelDirty = true;
          fx.debris(c, r, '#8a6a4a', 5);
          continue;
        }
        const tile = run.level.grid[i];
        if (tile === T_SOFT || tile === T_CRATE) { A.hitBlock(i, false); continue; }
        NS.bombs.setFire(i, 16, grp, 2);
        if ((j & 1) === 0) fx.flame(c, r, 1);
      }
      if (t.kind === 'rock') { fx.shake(6); fx.sfx('thud'); }
      else { fx.shake(t.kind === 'laser' ? 7 : 5); fx.sfx(t.kind === 'laser' ? 'laser' : 'smallExplode', { pitch: 0.8 }); }
    }
  }

  function update(dt) {
    const run = G.run;
    updateTele(dt);
    const b = run.boss;
    if (!b) return;
    const def = BOSSES[b.type];
    b.t += dt;
    b.squash += (1 - b.squash) * Math.min(1, dt * 6);
    if (b.inv > 0) b.inv -= dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.state === 'dead') return;
    if (b.state === 'dying') {
      b.deadT += dt;
      if (Math.random() < 0.3) {
        const ox = (Math.random() - 0.5) * 2, oy = (Math.random() - 0.5) * 2;
        fx.burst(fx.px(b.x + ox), fx.py(b.y + oy), 14, Math.random() < 0.5 ? '#ffd23a' : def.color, 260, 0.6, 1, true);
        fx.sfx('smallExplode', { pitch: 0.6 + Math.random() * 0.6, volume: 0.6 });
        fx.shake(6);
      }
      if (b.deadT > 2.2) {
        b.state = 'dead';
        fx.explosion(Math.round(b.x), Math.round(b.y), 6);
        fx.confetti(fx.px(b.x), fx.py(b.y), 60);
        fx.flash('#ffffff', 0.8);
        fx.shake(20);
        fx.sfx('explode', { pitch: 0.5 });
        fx.sfx('win');
        NS.run.bossDefeated(b);
      }
      return;
    }
    if (b.state === 'intro') {
      b.alpha = Math.min(1, b.t / 1.2);
      if (b.t > 1.6) { b.cycle = 0; nextAttack(b); }
      return;
    }
    if (run.freezeT > 0) { checkHits(b); return; }
    const p = run.player;
    const speed = def.speed * (b.phase === 2 ? 1.35 : 1);
    switch (b.state) {
      case 'idle': break;
      case 'chase':
        moveToward(b, p.x, p.y, speed, dt);
        crush(b);
        break;
      case 'burrow':
        if (b.t < b.dur - 0.9) {
          moveToward(b, p.x, p.y, speed * 2.2, dt);
          if (Math.random() < 0.5) fx.debris(Math.round(b.x), Math.round(b.y), '#8a6a4a', 1);
          b.tx = Math.round(b.x); b.ty = Math.round(b.y);
        } else if (!b.pending) {
          b.pending = 'emerge';
          const cells = [];
          for (let r = b.ty - 1; r <= b.ty + 1; ++r)
            for (let c = b.tx - 1; c <= b.tx + 1; ++c) if (A.inside(c, r) && A.tileAt(c, r) !== T_HARD) cells.push(A.idx(c, r));
          telegraph(cells, 0.8);
        }
        break;
      case 'strafe':
        b.tx = p.x;
        moveToward(b, b.tx, b.ty, speed * 1.6, dt);
        crush(b);
        break;
      case 'dash':
        moveToward(b, b.tx, b.ty, speed * 4.5, dt);
        crush(b);
        if (Math.random() < 0.6) fx.trail(fx.px(b.x), fx.py(b.y), def.color, 0);
        break;
      case 'teleport':
        if (b.t < 0.45) b.alpha = 1 - b.t / 0.45;
        else if (!b.pending) {
          b.pending = 'moved';
          const cells = freeCells(5);
          const i = cells.length ? cells[Math.floor(rand() * cells.length)] : A.idx(9, 5);
          b.x = Math.max(1.5, Math.min(COLS - 2.5, i % COLS));
          b.y = Math.max(1.5, Math.min(ROWS - 2.5, (i / COLS) | 0));
          fx.burst(fx.px(b.x), fx.py(b.y), 30, '#c58bff', 240, 0.6, 6, true);
        } else b.alpha = Math.min(1, (b.t - 0.45) / 0.45);
        break;
    }
    if (b.t >= b.dur) {
      if (b.state === 'burrow') {
        b.under = false;
        b.pending = null;
        b.squash = 0.4;
        fx.burst(fx.px(b.x), fx.py(b.y), 30, '#8a6a4a', 300, 0.8, 2, false, 700);
        fx.shake(10);
        fx.sfx('explode', { pitch: 0.5, volume: 0.6 });
        b.state = 'stunned';
        b.t = 0;
        b.dur = b.phase === 2 ? 1.4 : 2.0;
      } else {
        b.pending = null;
        b.alpha = 1;
        nextAttack(b);
      }
    }
    checkHits(b);
  }

  function nextAttack(b) {
    const def = BOSSES[b.type];
    const list = b.phase === 2 ? def.cycle2 : def.cycle;
    const state = list[b.cycle % list.length];
    ++b.cycle;
    start(b, state);
  }

  function checkHits(b) {
    const run = G.run;
    /* kicked bombs burst against the boss */
    for (let k = 0; k < run.bombs.length; ++k) {
      const bb = run.bombs[k];
      if ((bb.vx || bb.vy) && !b.under && Math.abs(bb.x - b.x) < half(b) + 0.6 && Math.abs(bb.y - b.y) < half(b) + 0.6 && bb.t > 0.05) {
        bb.t = 0.02;
        bb.vx = bb.vy = 0;
      }
    }
    if (b.under || b.alpha < 0.6 || b.state === 'intro') return;
    /* fire not lit by the boss itself hurts it */
    if (b.inv <= 0) {
      const h = half(b);
      for (let r = Math.floor(b.y - h); r <= Math.ceil(b.y + h); ++r)
        for (let c = Math.floor(b.x - h); c <= Math.ceil(b.x + h); ++c) {
          if (!A.inside(c, r) || !covers(b, c, r)) continue;
          const i = A.idx(c, r);
          if (run.fire[i] > 0 && run.fireO[i] !== 2) { hit(b); return; }
        }
    }
    /* touching the boss hurts the player */
    const p = run.player;
    const reach = half(b) + 0.3;
    if (!p.dead && Math.abs(p.x - b.x) < reach && Math.abs(p.y - b.y) < reach) NS.player.hurt('boss');
  }

  function hit(b) {
    const def = BOSSES[b.type];
    --b.hp;
    b.inv = 0.85;
    b.flash = 0.3;
    b.squash = 0.55;
    fx.hitstop(0.08);
    fx.shake(9);
    fx.burst(fx.px(b.x), fx.py(b.y), 26, '#ffffff', 300, 0.5, 1, true);
    fx.sfx('hit', { pitch: 0.6 });
    NS.run.addScore(250, b.x, b.y - 0.8, true);
    if (b.hp <= 0) {
      b.state = 'dying';
      b.deadT = 0;
      G.run.tele.length = 0;
      fx.banner(def.name.toUpperCase() + ' FALLS!', '', '#ffd84a', 2.2);
      fx.hitstop(0.3);
      for (let k = G.run.enemies.length - 1; k >= 0; --k) NS.enemies.kill(G.run.enemies[k], 0, false);
      return;
    }
    if (b.phase === 1 && b.hp <= b.maxHp / 2) {
      b.phase = 2;
      b.cycle = 0;
      fx.banner('ENRAGED!', def.name + ' is furious', '#ff5d3a', 1.6);
      fx.flash('#ff4020', 0.4);
      fx.sfx('levelup', { pitch: 0.5 });
    }
  }

  Object.assign(NS.bosses, {
    create, covers, blocksCell, update, hit, half, DUR
  });
})();
