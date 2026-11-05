/* Enemies: spawning, tile-to-tile movement and the AI kinds - wandering, turning toward the
   player, hopping, path-finding hunters, brick-passing wisps, three-hit brutes, bomb-dropping
   imps, splitting blobs and line-of-sight chargers - with danger avoidance around fuses about
   to blow, Time Freeze, and taking damage, dying, scoring and dropping loot.
   Mutates G.run.enemies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS, DIRS } = C;
  const { ENEMY_BY_ID } = NS.content;
  const A = NS.arena;
  const fx = NS.fx;

  const N = COLS * ROWS;
  const danger = new Uint8Array(N);
  const seen = new Int16Array(N);
  const queue = new Int16Array(N);
  const REVERSE = [1, 0, 3, 2];

  function spawn(type, c, r, opts) {
    const def = ENEMY_BY_ID[type] || ENEMY_BY_ID.puff;
    const run = G.run;
    const e = {
      id: run.nextId++, type: def.id, x: c, y: r, tx: c, ty: r, dir: Math.floor(NS.run.rand() * 4),
      hp: def.hp * (opts && opts.hpMul ? opts.hpMul : 1), inv: 0, t: 0, spawnT: opts && opts.instant ? 0 : 0.7,
      ghost: def.ai === 'ghost', charging: false, bombT: 3 + NS.run.rand() * 3, squash: 1, flash: 0, idleT: 0, harmless: run.mode === 'zen'
    };
    run.enemies.push(e);
    return e;
  }

  function speedOf(e) {
    const def = ENEMY_BY_ID[e.type];
    let s = def.speed;
    if (def.ai === 'tank') s *= 1 + (def.hp - e.hp) * 0.35;
    if (e.charging) s *= 2.6;
    if (G.run.mods.indexOf('speedy') >= 0) s *= 1.3;
    if (G.run.mode === 'zen') s *= 0.6;
    if (G.run.mode === 'arcade') s *= 1 + Math.min(0.35, (G.run.stage - 1) * 0.02);
    return s;
  }

  /* Cells inside the reach of bombs about to blow (smart enemies avoid them) */
  function buildDanger() {
    danger.fill(0);
    const bs = G.run.bombs;
    for (let k = 0; k < bs.length; ++k) {
      const b = bs[k];
      if (b.fly || (b.t > 1.3 && !b.remote)) continue;
      const cells = NS.levelgen.blastCells(G.run.level.grid, b.i, b.range);
      for (let j = 0; j < cells.length; ++j) danger[cells[j]] = 1;
    }
  }

  function options(e, careful) {
    const c = Math.round(e.x), r = Math.round(e.y);
    const out = [];
    for (let d = 0; d < 4; ++d) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (!A.enemyCan(nc, nr, e)) continue;
      if (careful && danger[A.idx(nc, nr)] && !danger[A.idx(c, r)]) continue;
      out.push(d);
    }
    return out;
  }

  /* First step of the shortest path to the player (breadth-first, ghost-aware) */
  function pathStep(e) {
    const p = G.run.player;
    const start = A.idx(Math.round(e.x), Math.round(e.y));
    const goal = A.idx(Math.round(p.x), Math.round(p.y));
    seen.fill(-1);
    let head = 0, tail = 0;
    queue[tail++] = start;
    seen[start] = 4;
    while (head < tail) {
      const i = queue[head++];
      if (i === goal) break;
      const c = i % COLS, r = (i / COLS) | 0;
      for (let d = 0; d < 4; ++d) {
        const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
        const j = A.idx(nc, nr);
        if (j < 0 || j >= N || seen[j] >= 0) continue;
        if (j !== goal && !A.enemyCan(nc, nr, e)) continue;
        if (danger[j]) continue;
        seen[j] = i === start ? d : seen[i];
        queue[tail++] = j;
      }
    }
    return seen[goal] >= 0 && seen[goal] < 4 ? seen[goal] : -1;
  }

  function lineOfSight(e) {
    const p = G.run.player;
    if (p.dead) return -1;
    const c = Math.round(e.x), r = Math.round(e.y);
    const pc = Math.round(p.x), pr = Math.round(p.y);
    if (c !== pc && r !== pr) return -1;
    if (Math.abs(c - pc) + Math.abs(r - pr) > 8) return -1;
    const d = c === pc ? (pr > r ? 0 : 1) : (pc > c ? 3 : 2);
    let x = c, y = r;
    while (x !== pc || y !== pr) {
      x += DIRS[d][0]; y += DIRS[d][1];
      if (x === pc && y === pr) break;
      if (!A.enemyCan(x, y, e)) return -1;
    }
    return d;
  }

  function decide(e) {
    const def = ENEMY_BY_ID[e.type];
    const rand = NS.run.rand;
    /* hunters, wisps and imps see fuses about to blow - most of the time */
    const careful = (def.ai === 'hunt' || def.ai === 'ghost' || def.ai === 'imp') && rand() < 0.6;
    let opts = options(e, careful);
    if (!opts.length) opts = options(e, false);
    if (!opts.length) return -1;
    const p = G.run.player;
    const c = Math.round(e.x), r = Math.round(e.y);
    const towards = d => {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      return Math.abs(nc - p.x) + Math.abs(nr - p.y);
    };
    const keep = opts.indexOf(e.dir) >= 0;
    const noReverse = opts.filter(d => d !== REVERSE[e.dir]);
    switch (def.ai) {
      case 'hunt': {
        if (!p.dead) {
          const d = pathStep(e);
          if (d >= 0 && opts.indexOf(d) >= 0) return d;
        }
        break;
      }
      case 'smart':
      case 'ghost': {
        const near = !p.dead && Math.abs(c - p.x) + Math.abs(r - p.y) < (def.ai === 'ghost' ? 12 : 7);
        if (near && rand() < 0.7) return opts.slice().sort((a, b) => towards(a) - towards(b))[0];
        break;
      }
      case 'charge': {
        const d = lineOfSight(e);
        if (d >= 0 && opts.indexOf(d) >= 0) {
          if (!e.charging) { e.charging = true; e.squash = 0.6; fx.sfx('whoosh', { pitch: 0.6, volume: 0.4 }); }
          return d;
        }
        e.charging = false;
        break;
      }
      case 'hop':
        return (noReverse.length ? noReverse : opts)[Math.floor(rand() * (noReverse.length ? noReverse.length : opts.length))];
    }
    if (keep && !(noReverse.length > 1 && rand() < 0.22)) return e.dir;
    const pool = noReverse.length ? noReverse : opts;
    return pool[Math.floor(rand() * pool.length)];
  }

  function update(dt) {
    const run = G.run;
    const frozen = run.freezeT > 0;
    if (frozen) run.freezeT -= dt;
    buildDanger();
    const es = run.enemies;
    for (let k = es.length - 1; k >= 0; --k) {
      const e = es[k];
      e.t += dt;
      e.squash += (1 - e.squash) * Math.min(1, dt * 8);
      if (e.inv > 0) e.inv -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      if (frozen) continue;
      const def = ENEMY_BY_ID[e.type];
      if (def.ai === 'imp') imp(e, dt);
      const dx = e.tx - e.x, dy = e.ty - e.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      const step = speedOf(e) * dt;
      if (dist <= step) {
        e.x = e.tx; e.y = e.ty;
        if (e.idleT > 0) { e.idleT -= dt; continue; }
        const d = decide(e);
        if (d < 0) { e.idleT = 0.25; e.charging = false; continue; }
        if (e.charging && d !== e.dir) e.charging = false;
        e.dir = d;
        e.tx = Math.round(e.x) + DIRS[d][0];
        e.ty = Math.round(e.y) + DIRS[d][1];
      } else {
        /* the target cell may have become blocked by a bomb or a fresh brick: turn back */
        if (!A.enemyCan(e.tx, e.ty, e, false) && (Math.abs(dx) + Math.abs(dy)) > 0.5) {
          e.tx = Math.round(e.x - Math.sign(dx) * 0.49);
          e.ty = Math.round(e.y - Math.sign(dy) * 0.49);
          e.dir = REVERSE[e.dir];
          e.charging = false;
          continue;
        }
        e.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
        e.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
      }
    }
  }

  function imp(e, dt) {
    e.bombT -= dt;
    if (e.bombT > 0) return;
    const c = Math.round(e.x), r = Math.round(e.y);
    if (Math.abs(e.x - c) > 0.1 || Math.abs(e.y - r) > 0.1) return;
    const p = G.run.player;
    if (Math.abs(c - Math.round(p.x)) + Math.abs(r - Math.round(p.y)) < 2) return;
    if (NS.bombs.placeEnemy(c, r, 2, 2.4)) {
      e.bombT = 5 + NS.run.rand() * 4;
      e.squash = 0.5;
      A.rebuild();
      buildDanger();
    }
  }

  /* Fire (or a boss slam) hit e; group is the blast group for chain scoring */
  function damage(e, group, byPlayer) {
    if (e.inv > 0 || e.spawnT > 0) return false;
    --e.hp;
    e.flash = 0.25;
    e.squash = 0.5;
    if (e.hp > 0) {
      e.inv = 0.7;
      fx.burst(fx.px(e.x), fx.py(e.y), 10, '#ffffff', 180, 0.4, 1, true);
      fx.sfx('hit', { pitch: 0.8 });
      fx.hitstop(0.03);
      return false;
    }
    kill(e, group, byPlayer);
    return true;
  }

  function kill(e, group, byPlayer) {
    const run = G.run;
    const def = ENEMY_BY_ID[e.type];
    const k = run.enemies.indexOf(e);
    if (k < 0) return;
    run.enemies.splice(k, 1);
    const x = e.x, y = e.y;
    fx.burst(fx.px(x), fx.py(y), 22, def.color, 260, 0.6, 6, true);
    fx.burst(fx.px(x), fx.py(y), 10, '#ffffff', 140, 0.4, 0, true);
    fx.ring(fx.px(x), fx.py(y), 6, 44, 0.3, def.color, 4);
    fx.hitstop(0.045);
    fx.sfx('blip', { pitch: 0.6 + Math.random() * 0.3 });
    if (def.ai === 'split') {
      for (let s = 0; s < 2; ++s) {
        const b = spawn('blobling', Math.round(x), Math.round(y), { instant: true });
        b.spawnT = 0.35;
        b.dir = s ? 2 : 3;
      }
    }
    if (!byPlayer && run.mode !== 'zen') return;
    ++run.kills;
    NS.tracker.stat('kills', 1);
    let chainKills = 1;
    const grp = group ? run.groups.find(g => g.id === group) : null;
    if (grp) chainKills = ++grp.kills;
    run.combo += 1;
    run.comboT = G.perks.combo;
    const mult = NS.rules.comboMultiplier(run.combo);
    if (mult > run.bestMult) run.bestMult = mult;
    NS.tracker.best('bestCombo', mult);
    NS.tracker.best('bestChain', chainKills);
    NS.tracker.best('bestChainToday', chainKills);
    const pts = def.points * chainKills;
    NS.run.addScore(pts, x, y, true);
    if (chainKills >= 2) {
      fx.banner(chainKills + 'x CHAIN!', '+' + pts * mult, '#ffd84a', 1.1);
      fx.sfx('levelup', { pitch: 0.8 + chainKills * 0.1, volume: 0.5 });
    }
    const p = run.player;
    if (G.perks.mega) p.mega = Math.min(C.SUPER_COST, p.mega + 22 * G.perks.megaRate);
    if (p.curse) {
      p.curse = '';
      p.curseT = 0;
      NS.tracker.stat('cursePass', 1);
      fx.text(p.x, p.y, 'Curse lifted!', '#ffffff', 16);
    }
    NS.items.enemyDrop(e);
  }

  Object.assign(NS.enemies, {
    spawn, speedOf, update, damage, kill, buildDanger, pathStep, danger
  });
})();
