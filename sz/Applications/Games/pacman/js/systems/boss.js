/* Boss fights: a giant ghost that floats through the arena walls, entering from above, hunting
   Pac-Man and cycling its attacks (telegraphed charges, ice shard rings, sticky puddles,
   minion ghosts, blinking away). It is only vulnerable while Pac-Man is powered up: each bite
   costs it hit points (Boss Bite can double them) and the next bite needs a fresh pellet.
   Enrages at half health; dies in a slow-motion blast that clears the stage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, ROWS, TAU } = C;
  const { BOSSES } = NS.worlds;
  const grid = NS.grid;
  const FX = NS.fx;
  const R = NS.rules;
  const { sfx } = NS.audio;
  const rnd = NS.rng.fx;

  const MINION_KINDS = ['blinky', 'pinky', 'inky', 'clyde'];

  function create(id, run) {
    const d = BOSSES[id];
    const hp = Math.round(d.hp * (run.mode === 'bossrush' ? 1 + run.n * 0.08 : 1));
    return {
      id: id, x: 14, y: -3, hp: hp, maxHp: hp, state: 'enter', t: 0, atkT: 3.5, atkIdx: 0, vx: 0, vy: 0,
      vuln: false, flash: 0, size: d.size, enraged: false, tx: 0, ty: 0, alpha: 1, squash: 0, bob: 0, face: 1, shots: 0,
    };
  }

  function reset(b) {
    b.x = 14;
    b.y = 5.5;
    b.state = 'roam';
    b.t = 0;
    b.atkT = 3;
    b.alpha = 1;
  }

  function radius(b) {
    return b.size * 0.42;
  }

  function idle(lvl, dt) {
    const b = lvl.boss;
    b.bob += dt;
    if (b.state === 'enter') {
      b.t += dt;
      b.y = -3 + Math.min(1, b.t / 1.5) * 8.5;
    }
  }

  function setState(b, s) {
    b.state = s;
    b.t = 0;
  }

  function moveToward(b, tx, ty, sp) {
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = Math.min(sp, d);
    b.x += dx / d * k;
    b.y += dy / d * k;
    if (Math.abs(dx) > 0.2) b.face = dx < 0 ? -1 : 1;
    b.x = Math.max(1.5, Math.min(COLS - 1.5, b.x));
    b.y = Math.max(1.5, Math.min(ROWS - 1.5, b.y));
  }

  function update(run, dt) {
    const lvl = run.lvl;
    const b = lvl.boss;
    const pac = lvl.pac;
    const def = BOSSES[b.id];
    b.t += dt;
    b.bob += dt;
    if (b.flash > 0) b.flash -= dt;
    if (b.squash > 0) b.squash = Math.max(0, b.squash - dt * 3);
    const scared = b.vuln && (lvl.frightT > 0 || lvl.effects.mega > 0);
    const sp = def.speed * (b.enraged ? 1.25 : 1) * (lvl.effects.slowmo > 0 ? 0.5 : 1) * dt;
    const frozen = lvl.effects.freeze > 0;
    switch (b.state) {
      case 'enter':
        b.y = -3 + Math.min(1, b.t / 1.5) * 8.5;
        if (b.t > 1.5) setState(b, 'roam');
        return;
      case 'dying':
        if (rnd() < 0.5) {
          const a = rnd() * TAU, r = rnd() * radius(b);
          FX.burst(grid.px(b.x + Math.cos(a) * r), grid.py(b.y + Math.sin(a) * r), 8, rnd() < 0.5 ? def.color : '#ffffff', 220, 0.5, 6, 0);
        }
        if (b.t > 2.6) {
          FX.ring(grid.px(b.x), grid.py(b.y), 20, 400, 0.9, '#ffffff', 12);
          FX.confetti(grid.px(b.x), grid.py(b.y), 90, 6);
          FX.flash('#ffffff', 0.8);
          FX.addShake(16);
          sfx('explode');
          sfx('win');
          if (!run.demo) {
            ++run.tally.bosses;
            R.bump(G.profile, 'bosses', 1);
            G.profile.seen['boss:' + b.id] = true;
          }
          NS.level.clear(run);
        }
        return;
      case 'hurt':
        moveToward(b, b.tx, b.ty, sp * 2.5);
        if (b.t > 1.2) setState(b, 'roam');
        return;
      case 'blinkOut':
        b.alpha = Math.max(0, 1 - b.t / 0.5);
        if (b.t > 0.5) {
          const pos = NS.pickups.freeTile(lvl, 6) || { x: 14, y: 6 };
          b.x = pos.x;
          b.y = pos.y;
          FX.ring(grid.px(b.x), grid.py(b.y), 60, 6, 0.5, def.color, 5);
          setState(b, 'blinkIn');
        }
        return;
      case 'blinkIn':
        b.alpha = Math.min(1, b.t / 0.5);
        if (b.t > 0.5) { b.alpha = 1; setState(b, 'roam'); }
        return;
      case 'tele':
        b.x += (rnd() - 0.5) * 0.08;
        if (b.t > 0.8) {
          setState(b, 'charge');
          sfx('whoosh', { pitch: 0.6 });
        }
        return;
      case 'charge':
        if (!frozen) moveToward(b, b.tx, b.ty, sp * 3.2);
        if (b.t > 1.1 || (Math.abs(b.x - b.tx) < 0.2 && Math.abs(b.y - b.ty) < 0.2)) {
          setState(b, 'roam');
          FX.addShake(5);
          FX.ring(grid.px(b.x), grid.py(b.y), 10, 70, 0.4, def.color, 4);
        }
        touch(run, b);
        return;
      case 'shards':
        if (b.t > 0.3 && b.shots === 0) { volley(run, b, 0); b.shots = 1; }
        if (b.t > 0.75 && b.shots === 1) { volley(run, b, Math.PI / 10); b.shots = 2; }
        if (b.t > 1) setState(b, 'roam');
        touch(run, b);
        return;
    }
    /* roam: hunt, or flee while Pac-Man is powered */
    if (!frozen) {
      if (scared) moveToward(b, b.x + (b.x - pac.x) * 2, b.y + (b.y - pac.y) * 2, sp * 0.55);
      else moveToward(b, pac.x, pac.y, sp);
    }
    b.atkT -= dt;
    if (b.atkT <= 0 && !scared && !frozen) attack(run, b, def);
    touch(run, b);
  }

  function attack(run, b, def) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    const kind = def.attacks[b.atkIdx % def.attacks.length];
    ++b.atkIdx;
    b.atkT = (b.enraged ? 3.2 : 4.6) * (run.mode === 'bossrush' ? 0.85 : 1);
    b.squash = 1;
    switch (kind) {
      case 'charge':
        b.tx = pac.x;
        b.ty = pac.y;
        setState(b, 'tele');
        sfx('hurt', { pitch: 0.5, volume: 0.5 });
        break;
      case 'shards':
        b.shots = 0;
        setState(b, 'shards');
        break;
      case 'puddles':
        for (let i = 0; i < 3; ++i) {
          const x = Math.max(1, Math.min(COLS - 2, Math.floor(pac.x + (rnd() - 0.5) * 8))) + 0.5;
          const y = Math.max(1, Math.min(ROWS - 2, Math.floor(pac.y + (rnd() - 0.5) * 8))) + 0.5;
          NS.hazards.puddle(run, x, y);
          FX.burst(grid.px(x), grid.py(y), 10, def.color, 160, 0.5, 6, 0);
        }
        sfx('drop', { pitch: 0.6 });
        break;
      case 'minions': {
        let n = 0;
        for (let i = 0; i < lvl.ghosts.length; ++i) if (lvl.ghosts[i].minion && lvl.ghosts[i].mode !== 'eyes') ++n;
        for (let k = 0; k < 2 && n < 4; ++k, ++n) {
          const pos = nearestOpen(lvl.maze, b.x, b.y);
          const g = NS.level.makeGhost(MINION_KINDS[(b.atkIdx + k) % 4], 0, 0);
          g.x = pos.x;
          g.y = pos.y;
          g.mode = 'out';
          g.minion = true;
          g.squash = 1;
          g.dir = k === 0 ? 0 : 2;
          lvl.ghosts.push(g);
          FX.ring(grid.px(g.x), grid.py(g.y), 4, 40, 0.4, g.color, 4);
        }
        sfx('jump', { pitch: 0.6 });
        break;
      }
      case 'blink':
        setState(b, 'blinkOut');
        sfx('zap', { pitch: 0.4 });
        break;
    }
  }

  function volley(run, b, off) {
    const n = b.enraged ? 12 : 9;
    for (let i = 0; i < n; ++i) NS.hazards.shard(run, b.x, b.y, off + i * TAU / n, 4.6);
    sfx('laser', { pitch: 0.7, volume: 0.5 });
    FX.ring(grid.px(b.x), grid.py(b.y), 10, 60, 0.3, '#8af0ff', 4);
  }

  function nearestOpen(m, x, y) {
    let best = { x: 13.5, y: 11.5 }, bd = Infinity;
    for (let ty = 1; ty < ROWS - 1; ++ty)
      for (let tx = 1; tx < COLS - 1; ++tx) {
        if (m.walls[ty * COLS + tx] !== C.W_OPEN) continue;
        const d = (tx + 0.5 - x) * (tx + 0.5 - x) + (ty + 0.5 - y) * (ty + 0.5 - y);
        if (d < bd) { bd = d; best = { x: tx + 0.5, y: ty + 0.5 }; }
      }
    return best;
  }

  function touch(run, b) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    if (b.alpha < 0.6 || lvl.phase !== 'play') return;
    const r = radius(b) + 0.35;
    if (grid.dist2(pac.x, pac.y, b.x, b.y) > r * r) return;
    const powered = b.vuln && (lvl.frightT > 0 || lvl.effects.mega > 0);
    if (powered && b.state !== 'hurt') hit(run, b);
    else if (!powered && b.state !== 'hurt' && lvl.effects.freeze <= 0) NS.level.caught(run, null);
  }

  function hit(run, b) {
    const lvl = run.lvl;
    const def = BOSSES[b.id];
    const crit = rnd() < G.stats.bossCrit;
    const dmg = crit ? 2 : 1;
    b.hp = Math.max(0, b.hp - dmg);
    b.vuln = false;
    b.flash = 0.5;
    b.squash = 1;
    const x = grid.px(b.x), y = grid.py(b.y);
    NS.level.addScore(run, 1000 * dmg, x, y - 40, crit ? '#ffd23a' : '#ffffff', crit ? 30 : 24);
    if (crit) FX.floater(x, y - 70, 'CRITICAL BITE!', '#ffd23a', 22, 1.3);
    FX.burst(x, y, 40, def.color, 380, 0.7, 8, 0);
    FX.chunks(x, y, 14, '#ffffff', 300);
    FX.ring(x, y, 20, 160, 0.5, '#ffffff', 8);
    FX.addShake(12);
    FX.hitStop(0.16);
    FX.flash(def.color, 0.3);
    sfx('explode', { pitch: 1.4, volume: 0.6 });
    sfx('hurt', { pitch: 0.6 });
    /* knocked away from Pac-Man */
    const pac = lvl.pac;
    const dx = b.x - pac.x, dy = b.y - pac.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    b.tx = Math.max(2, Math.min(COLS - 2, b.x + dx / d * 7));
    b.ty = Math.max(2, Math.min(ROWS - 2, b.y + dy / d * 7));
    if (b.hp <= 0) {
      setState(b, 'dying');
      FX.slowMo(2.6, 0.35);
      lvl.shots.length = 0;
      for (let i = lvl.ghosts.length - 1; i >= 0; --i) if (lvl.ghosts[i].minion) NS.ghosts.sendHome(lvl.ghosts[i]);
      return;
    }
    setState(b, 'hurt');
    if (!b.enraged && b.hp <= b.maxHp / 2) {
      b.enraged = true;
      FX.floater(x, y - 90, 'ENRAGED!', '#ff3b3b', 26, 1.6);
      sfx('lose', { pitch: 1.6, volume: 0.4 });
    }
  }

  /* chip damage from blaster shots and bombs (cannot finish a boss off) */
  function chip(run, amount) {
    const b = run.lvl.boss;
    if (!b || b.state === 'dying' || b.state === 'enter') return;
    b.hp = Math.max(0.5, b.hp - amount);
    b.flash = 0.15;
    FX.sparks(grid.px(b.x), grid.py(b.y), 6, '#ffffff', 200);
    sfx('hit', { pitch: 0.8, volume: 0.4 });
  }

  function blast(run, x, y) {
    const b = run.lvl.boss;
    if (b && grid.dist2(x, y, b.x, b.y) < 64) chip(run, 1);
  }

  function frighten(b) {
    if (b.state !== 'dying') b.vuln = true;
  }

  function hitTest(b, x, y) {
    const r = radius(b);
    return b.alpha > 0.5 && b.state !== 'dying' && (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < r * r;
  }

  Object.assign(NS.boss, {
    create, reset, idle, update, chip, blast, frighten, hitTest, radius
  });
})();
