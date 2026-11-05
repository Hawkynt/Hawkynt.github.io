/* The five guardians, each a small state machine on the board: Grubbin burrows and throws dirt
   that hardens into rock, Sekhet stalks and stings whole rows and columns, Hoarfrost circles out
   of reach and perches between ice-gust dives, Cindrax is a snake of fire that sets the floor
   erupting, and the Hollow Eclipse teleports, fires lasers and summons help. Every attack is
   telegraphed by warning marks first. A shining snake ramming a guardian hurts it; touching one
   otherwise crashes. Owns run.boss. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { COLS, ROWS } = NS.constants;
  const { BOSSES } = NS.worlds;
  const L = NS.levels;
  const B = NS.board;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function create(id) {
    const def = BOSSES[id];
    const b = { id: id, size: def.size, hp: def.hp, max: def.hp, i: 0, pi: 0, lt: 1, t: 0, state: 'intro', stT: 1.2,
      inv: 0, hidden: false, atkT: 2, phase: 1, flash: 0, shadow: -1, dir: 3, acc: 0, body: null, prev: null, summonT: 6, dead: 0 };
    if (id === 'wyrm') {
      const s = 8 * COLS + 17;
      b.body = [];
      for (let k = 0; k < 9; ++k) b.body.push(s + k);
      b.prev = b.body.slice();
      b.i = s;
      b.state = 'hunt';
    } else
      b.i = spot(b, 6) || (6 * COLS + 21);
    b.pi = b.i;
    if (id === 'owl') { b.state = 'fly'; b.hidden = true; b.stT = 2; }
    return b;
  }

  function cells(b) {
    if (b.hidden || b.hp <= 0) return [];
    if (b.body) return b.body;
    if (b.size === 1) return [b.i];
    return [b.i, b.i + 1, b.i + COLS, b.i + COLS + 1];
  }

  function footprint(i, size) {
    return size === 1 ? [i] : [i, i + 1, i + COLS, i + COLS + 1];
  }

  /* a top-left cell whose whole footprint is open floor, at least minDist from the head */
  function spot(b, minDist) {
    const run = G.run;
    const head = run.snake.body[0];
    for (let tries = 0; tries < 80; ++tries) {
      const x = 1 + Math.floor(G.rng() * (COLS - 3)), y = 1 + Math.floor(G.rng() * (ROWS - 3));
      const i = y * COLS + x;
      const fp = footprint(i, b.size);
      let ok = B.dist(i, head) >= minDist;
      for (let k = 0; k < fp.length && ok; ++k) {
        const ch = run.level.tiles[fp[k]];
        if (L.isSolid(ch) || L.isPortal(ch)) ok = false;
        const o = B.occ.type[fp[k]];
        if (o === B.BODY || o === B.HEAD || o === B.RIVAL || o === B.CRITTER) ok = false;
      }
      if (ok) return i;
    }
    return 0;
  }

  function line(isRow, n, style, warn, life) {
    for (let k = 0; k < (isRow ? COLS : ROWS); ++k) {
      const i = isRow ? n * COLS + k : k * COLS + n;
      B.addMark(i, 'warn', warn, 'sting', life);
      const m = G.run.marks[G.run.marks.length - 1];
      if (m && m.i === i) m.style = style;
    }
    sfx('blip', { pitch: 0.6, volume: 0.6 });
  }

  /* a strike along the line the head travels on (so turning off it always escapes), and in
     phase two a second one two lines over */
  function strike(style, warn, life, twin) {
    const h = headXY();
    const row = G.run.snake.dir === 1 || G.run.snake.dir === 3;
    const n = row ? h.y : h.x, max = row ? ROWS - 2 : COLS - 2;
    line(row, n, style, warn, life);
    if (twin) {
      const o = n + (G.rng() < 0.5 ? -3 : 3);
      line(row, o < 1 ? n + 3 : o > max ? n - 3 : o, style, warn + 0.2, life);
    }
  }

  function headXY() {
    const h = G.run.snake.body[0];
    return { x: h % COLS, y: (h / COLS) | 0, i: h };
  }

  function update(dt) {
    const b = G.run.boss;
    if (!b) return;
    b.t += dt;
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3);
    if (b.inv > 0) b.inv = Math.max(0, b.inv - dt);
    if (b.lt < 1) b.lt = Math.min(1, b.lt + dt * 6);
    if (b.hp <= 0) {
      b.dead += dt;
      if (b.dead < 1.6 && Math.floor(b.dead * 10) !== Math.floor((b.dead - dt) * 10)) {
        const c = center(b);
        fx.burst(c.x + (G.rng() - 0.5) * 60, c.y + (G.rng() - 0.5) * 60, 14, ['#ffffff', BOSSES[b.id].accent, BOSSES[b.id].color], 260, 0.7, 10);
        fx.shake(4);
        sfx('smallExplode');
      }
      return;
    }
    if (B.frozen()) return;
    const rate = (G.run.act.warp || 0) > 0 ? 0.5 : 1;
    const step = dt * rate;
    b.stT -= step;
    b.atkT -= step;
    if (b.hp <= Math.ceil(b.max / 2)) b.phase = 2;
    switch (b.id) {
      case 'mole': mole(b, step); break;
      case 'scorpion': scorpion(b, step); break;
      case 'owl': owl(b, step); break;
      case 'wyrm': wyrm(b, step); break;
      case 'eclipse': eclipse(b, step); break;
    }
  }

  function moveTo(b, i) {
    b.pi = b.i;
    b.i = i;
    b.lt = 0;
    B.rebuildOcc();
  }

  function mole(b) {
    if (b.state === 'intro' && b.stT <= 0) { b.state = 'up'; b.stT = 3.6; b.atkT = 0.8; }
    if (b.state === 'up') {
      if (b.atkT <= 0) {
        b.atkT = b.phase === 2 ? 0.9 : 1.3;
        const h = headXY();
        for (let k = 0; k < (b.phase === 2 ? 4 : 3); ++k) {
          const x = Math.max(1, Math.min(COLS - 2, h.x + Math.round((G.rng() - 0.5) * 8)));
          const y = Math.max(1, Math.min(ROWS - 2, h.y + Math.round((G.rng() - 0.5) * 6)));
          const i = y * COLS + x;
          if (B.dist(i, h.i) < 2) continue;
          B.addMark(i, 'warn', 1.1, 'rock', 7);
        }
        sfx('thud', { pitch: 1.4, volume: 0.6 });
      }
      if (b.stT <= 0) {
        b.state = 'dig';
        b.hidden = true;
        b.stT = 1.6;
        b.shadow = spot(b, 4) || b.i;
        fx.burst(center(b).x, center(b).y, 20, ['#8a5a3a', '#5a3a1a', '#c8a070'], 200, 0.7, 8, fx.SQUARE, 400);
        sfx('drop', { pitch: 0.6 });
        B.rebuildOcc();
      }
    } else if (b.state === 'dig') {
      if (b.stT <= 0.9 && !b.warned) {
        b.warned = true;
        const fp = footprint(b.shadow, 2);
        for (let k = 0; k < fp.length; ++k) B.addMark(fp[k], 'warn', 0.9);
      }
      if (b.stT <= 0) {
        b.warned = false;
        b.hidden = false;
        b.state = 'up';
        b.stT = 3.6;
        b.atkT = 0.8;
        b.pi = b.shadow;
        b.i = b.shadow;
        b.lt = 1;
        B.rebuildOcc();
        emergeCrush(b);
        fx.shake(8);
        fx.burst(center(b).x, center(b).y, 26, ['#8a5a3a', '#c8a070', '#5a3a1a'], 300, 0.8, 9, fx.SQUARE, 500);
        sfx('thud');
      }
    }
  }

  /* surfacing onto the snake's head hurts it (the warning marks gave it time to leave) */
  function emergeCrush(b) {
    const fp = cells(b);
    const head = G.run.snake.body[0];
    if (fp.indexOf(head) >= 0) NS.snake.hurt('guardian');
  }

  function scorpion(b) {
    if (b.state === 'intro') { if (b.stT <= 0) { b.state = 'stalk'; b.stT = 0.5; b.atkT = 2.2; } return; }
    if (b.stT <= 0) {
      b.stT = b.phase === 2 ? 0.38 : 0.5;
      const h = headXY();
      const bx = b.i % COLS, by = (b.i / COLS) | 0;
      const dirs = [];
      if (h.x > bx + 1) dirs.push(1); else if (h.x < bx) dirs.push(3);
      if (h.y > by + 1) dirs.push(2); else if (h.y < by) dirs.push(0);
      if (!dirs.length || G.rng() < 0.25) dirs.push(Math.floor(G.rng() * 4));
      const d = dirs[Math.floor(G.rng() * dirs.length)];
      const n = L.step(G.run.level, b.i, d);
      if (n >= 0 && canStand(b, n)) moveTo(b, n);
    }
    if (b.atkT <= 0) {
      b.atkT = b.phase === 2 ? 2.2 : 3;
      strike('sand', 1.0, 0.55, b.phase === 2);
    }
  }

  function canStand(b, i) {
    const x = i % COLS, y = (i / COLS) | 0;
    if (x < 1 || y < 1 || x > COLS - 1 - b.size || y > ROWS - 1 - b.size) return false;
    const fp = footprint(i, b.size);
    for (let k = 0; k < fp.length; ++k) {
      const ch = G.run.level.tiles[fp[k]];
      if (L.isSolid(ch) || L.isPortal(ch)) return false;
      const o = B.occ.type[fp[k]];
      if (o === B.RIVAL || o === B.CRITTER) return false;
    }
    return true;
  }

  function owl(b) {
    if (b.state === 'fly') {
      if (b.atkT <= 0) {
        b.atkT = b.phase === 2 ? 1.8 : 2.4;
        strike('ice', 1.0, 0.5, false);
        for (let k = 0; k < 2; ++k) {
          const i = B.freeCell(4);
          if (i >= 0) B.addMark(i, 'warn', 1.2, 'ice');
        }
      }
      if (b.stT <= 0) {
        b.state = 'land';
        b.stT = 1;
        b.shadow = spot(b, 5) || b.i;
        const fp = footprint(b.shadow, 2);
        for (let k = 0; k < fp.length; ++k) B.addMark(fp[k], 'warn', 1);
      }
    } else if (b.state === 'land' && b.stT <= 0) {
      b.state = 'perch';
      b.hidden = false;
      b.stT = b.phase === 2 ? 2.8 : 3.6;
      b.i = b.pi = b.shadow;
      b.lt = 1;
      B.rebuildOcc();
      emergeCrush(b);
      fx.burst(center(b).x, center(b).y, 18, ['#ffffff', '#bff4ff'], 220, 0.6, 7, fx.SNOW);
      sfx('whoosh');
    } else if (b.state === 'perch' && b.stT <= 0) {
      takeOff(b);
    } else if (b.state === 'intro' && b.stT <= 0) {
      b.state = 'fly';
      b.stT = 2.5;
    }
  }

  function takeOff(b) {
    b.state = 'fly';
    b.hidden = true;
    b.stT = b.phase === 2 ? 3.2 : 4.2;
    b.atkT = 1.2;
    B.rebuildOcc();
    fx.burst(center(b).x, center(b).y, 16, ['#ffffff', '#bff4ff'], 260, 0.6, 7, fx.SNOW);
    sfx('whoosh', { pitch: 0.8 });
  }

  function wyrm(b, step) {
    b.acc += step;
    const every = b.phase === 2 ? 0.26 : 0.32;
    if (b.acc >= every) {
      b.acc -= every;
      b.prev = b.body.slice();
      const head = b.body[0];
      const h = headXY();
      const lv = G.run.level;
      let best = -1, bestD = 1e9;
      for (let d = 0; d < 4; ++d) {
        if (d === (b.dir + 2) % 4) continue;
        const s = L.step(lv, head, d);
        if (s < 0 || L.isSolid(lv.tiles[s]) || L.isPortal(lv.tiles[s])) continue;
        const o = B.occ.type[s];
        if (o === B.BOSS || o === B.CRITTER || o === B.RIVAL || o === B.BODY) continue;
        const dd = B.dist(s, h.i) + G.rng() * 3;
        if (dd < bestD) { bestD = dd; best = d; }
      }
      if (best < 0) {
        b.body.reverse();
        b.dir = (b.dir + 2) % 4;
        for (let d = 0; d < 4; ++d) if (L.step(lv, b.body[1], d) === b.body[0]) b.dir = d;
      } else {
        const s = L.step(lv, head, best);
        b.dir = best;
        const o = B.occ.type[s];
        b.body.unshift(s);
        if (b.grow > 0) --b.grow; else b.body.pop();
        b.i = b.body[0];
        B.rebuildOcc();
        if (o === B.HEAD) NS.snake.hurt('guardian');
      }
      b.i = b.body[0];
    }
    if (b.atkT <= 0) {
      b.atkT = b.phase === 2 ? 2.6 : 3.4;
      for (let k = 0; k < (b.phase === 2 ? 3 : 2); ++k) {
        const c = B.freeCell(3);
        if (c < 0) continue;
        for (let d = -1; d < 4; ++d) {
          const s = d < 0 ? c : L.step(G.run.level, c, d);
          if (s >= 0) { B.addMark(s, 'warn', 1.1, 'fire', 0.9); const m = G.run.marks[G.run.marks.length - 1]; if (m) m.style = 'lava'; }
        }
      }
      sfx('thud', { pitch: 0.7, volume: 0.6 });
    }
  }

  function eclipse(b) {
    if (b.state === 'intro') { if (b.stT <= 0) { b.state = 'float'; b.stT = 3.5; b.atkT = 1.6; } return; }
    if (b.state === 'float' && b.stT <= 0) {
      b.state = 'blink';
      b.stT = 0.8;
      b.shadow = spot(b, 6) || b.i;
      const fp = footprint(b.shadow, 2);
      for (let k = 0; k < fp.length; ++k) B.addMark(fp[k], 'warn', 0.8);
    } else if (b.state === 'blink' && b.stT <= 0) {
      fx.burst(center(b).x, center(b).y, 20, ['#c08cff', '#2a1a4a', '#ffffff'], 260, 0.5, 8);
      b.pi = b.i = b.shadow;
      b.lt = 1;
      b.state = 'float';
      b.stT = b.phase === 2 ? 2.8 : 3.8;
      B.rebuildOcc();
      emergeCrush(b);
      fx.burst(center(b).x, center(b).y, 20, ['#c08cff', '#ffffff'], 260, 0.5, 8);
      sfx('zap');
    }
    if (b.atkT <= 0 && b.state === 'float') {
      b.atkT = b.phase === 2 ? 2 : 2.8;
      strike('laser', 0.95, 0.5, b.phase === 2);
    }
    b.summonT -= 1 / 60;
    if (b.summonT <= 0) {
      b.summonT = b.phase === 2 ? 7 : 10;
      let wisps = 0;
      for (let k = 0; k < G.run.enemies.length; ++k) if (G.run.enemies[k].alive && G.run.enemies[k].type === 'wisp') ++wisps;
      if (wisps < 2) NS.enemies.spawnOne('wisp');
      if (b.phase === 2 && !b.shadowSnake) {
        b.shadowSnake = true;
        const e = NS.enemies.spawnOne('rival');
        if (e) e.color = '#4a2a8a';
      }
    }
  }

  function center(b) {
    if (b.body) return { x: fx.cx(b.body[0]), y: fx.cy(b.body[0]) };
    const i = b.hidden && b.shadow >= 0 ? b.shadow : b.i;
    const off = b.size === 2 ? 19 : 0;
    return { x: fx.cx(i) + off, y: fx.cy(i) + off };
  }

  /* a shining snake rammed the guardian at cell c (soft: a venom chip that does not knock it
     away); returns true if it took damage */
  function hit(dmg, c, soft) {
    const b = G.run.boss;
    if (!b || b.hp <= 0 || b.inv > 0) return false;
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp < 0.01) b.hp = 0;
    b.flash = 1;
    const p = center(b);
    if (soft && b.hp > 0) {
      b.inv = 0.35;
      fx.burst(p.x, p.y, 12, ['#9aff4a', '#ffffff'], 220, 0.5, 7);
      fx.text(p.x, p.y - 40, '-' + dmg, '#9aff4a', 18);
      sfx('hit', { pitch: 1.4, volume: 0.6 });
      return true;
    }
    b.inv = 1.1;
    fx.burst(p.x, p.y, 30, ['#ffffff', BOSSES[b.id].accent, '#fff27a'], 360, 0.7, 10);
    fx.ring(p.x, p.y, 10, 110, 0.5, '#ffffff', 8);
    fx.shake(10);
    fx.hitstop(0.09);
    fx.flash('#ffffff', 0.3);
    fx.text(p.x, p.y - 50, b.hp > 0 ? 'HIT!' : 'DEFEATED!', '#fff27a', 30, 1.3);
    sfx(b.hp > 0 ? 'hit' : 'explode');
    if (b.hp <= 0) {
      fx.slowmo(1.4);
      G.run.marks.length = 0;
      for (let k = 0; k < G.run.enemies.length; ++k) if (G.run.enemies[k].alive) NS.combat.killEnemy(G.run.enemies[k], 'boss');
      G.run.respawnCritters = false;
      NS.run.bossDefeated();
      B.rebuildOcc();
      return true;
    }
    /* the guardian recoils out of the way */
    if (b.body) {
      /* rammed body: the tail from there breaks off; rammed head: it flees across the board */
      const k = c !== undefined ? b.body.indexOf(c) : -1;
      const lost = b.body.splice(k >= 1 ? k : 1);
      for (let j = 0; j < lost.length; ++j) fx.burst(fx.cx(lost[j]), fx.cy(lost[j]), 6, ['#ff6a2a', '#ffe07a'], 160, 0.5, 6);
      if (k <= 0) {
        fx.burst(fx.cx(b.body[0]), fx.cy(b.body[0]), 12, ['#ff6a2a', '#ffe07a'], 200, 0.5, 7);
        b.body = [spot({ size: 1 }, 8) || b.body[0]];
      }
      b.grow = 8 - b.body.length;
      b.prev = b.body.slice();
      b.i = b.body[0];
    } else if (b.id === 'mole') {
      b.state = 'up';
      b.stT = 0;
    } else if (b.id === 'owl') {
      takeOff(b);
    } else {
      b.pi = b.i;
      b.i = spot(b, 7) || b.i;
      b.lt = 1;
    }
    B.rebuildOcc();
    return true;
  }

  Object.assign(NS.bosses, {
    create, cells, footprint, update, hit, center
  });
})();
