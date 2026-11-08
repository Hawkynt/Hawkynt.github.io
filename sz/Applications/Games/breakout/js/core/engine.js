/* The field engine, pure and deterministic: a game is one plain object (bricks, paddle, balls,
   drops, lasers, stars, timers, score, lives, statistics and the seeded generator state), so it
   saves as JSON and replays the same. Bricks come from a layout of characters (colours, steel,
   titan, glass, walls, bombs, regrowing bricks, gold targets, crystals). Balls move in small
   sub-steps with circle-against-box collisions, bounce off the paddle at an angle set by where
   they land, burn through bricks while on fire and smash harder when mega; bombs chain, regrowing
   bricks return, a ball that has not touched a brick for a while is nudged out of its loop.
   Drops are caught to switch powers on; lasers and falling stars break bricks; a barrier saves a
   ball. Each step leaves events (bounce, hit, break, drop, power, lost, life, cleared, over...)
   for sound and effects. A guardian (systems/boss.js) plugs in through g.boss. Team play: CPU
   partner paddles ("mates") guard the top, left and right edges, which then stop being walls - a
   ball that gets past a mate is lost like one that falls past the paddle; mates bounce balls back
   at an angle set by where they land, and a team field centres its bricks (trimmed to twelve
   columns by the team modes) to leave lanes past them and room behind the mates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const { makeRng } = NS.rng;
  const { BRICKS, POWERS, POWER_BY_ID } = C;

  function rand(g) {
    const r = makeRng(g.rng);
    const v = r.next();
    g.rng = r.s;
    return v;
  }

  /* opts: seed, layout (strings), level (speed step), lives, speedMul, paddleMul, drops (chance
     factor), powers (allowed ids), wideW, durMul, multi, gravity, regrow, sides (mate edges:
     'top', 'left', 'right'), center (bricks centred vertically), cols (brick columns) */
  function create(opts) {
    opts = opts || {};
    const g = {
      seed: opts.seed >>> 0 || 1, rng: opts.seed >>> 0 || 1, w: C.FIELD_W, h: C.FIELD_H,
      bricks: [], balls: [], drops: [], lasers: [], stars: [], events: [],
      paddle: { x: C.FIELD_W / 2, w: C.PADDLE_W * (opts.paddleMul || 1), baseW: C.PADDLE_W * (opts.paddleMul || 1), wideT: 0, shrinkT: 0, laserT: 0, magnetT: 0, stunT: 0, fireCd: 0, vx: 0 },
      level: opts.level || 0, speedMul: opts.speedMul || 1, durMul: opts.durMul || 1, dropMul: opts.drops == null ? 1 : opts.drops,
      powers: opts.powers || POWERS.filter(p => !p.unlock).map(p => p.id), lives: opts.lives == null ? 3 : opts.lives, infinite: !!opts.infinite,
      multi: opts.multi || 1, gravity: opts.gravity || 0, regrow: opts.regrow || 0, regrowT: opts.regrow || 0,
      slowT: 0, fastT: 0, fireT: 0, megaT: 0, barrier: opts.barrier || 0, starT: 0,
      score: 0, combo: 0, comboT: 0, time: 0, noHitT: 0, over: false, cleared: false, scoreMul: opts.scoreMul || 1,
      boss: null, projectiles: [],
      mates: [], open: { top: false, left: false, right: false }, center: !!opts.center, cols: opts.cols || C.COLS,
      stats: { bricks: 0, best: 0, powers: 0, lost: 0, caught: 0, missedDrops: 0, lasers: 0, bombs: 0, gold: 0, crystals: 0, bounces: 0, hitsTaken: 0 },
    };
    for (const side of opts.sides || []) {
      g.open[side] = true;
      g.mates.push({ side: side, pos: side === 'top' ? g.w / 2 : g.h / 2, w: C.MATE_W, hits: 0, tgt: side === 'top' ? g.w / 2 : g.h / 2, reT: 0 });
    }
    if (opts.layout) loadLayout(g, opts.layout);
    resetBalls(g);
    return g;
  }

  function teamPlay(g) {
    return g.mates.length > 0;
  }

  function loadLayout(g, rows) {
    g.bricks.length = 0;
    const cols = g.cols || C.COLS;
    const left = (g.w - cols * C.BRICK_W) / 2;
    const top = g.center ? Math.round(g.h * 0.47 - rows.length * C.BRICK_H / 2) : C.BRICK_TOP;
    for (let y = 0; y < rows.length; ++y) {
      let row = rows[y];
      if (row.length > cols) { const cut = Math.floor((row.length - cols) / 2); row = row.slice(cut, cut + cols); }
      const off = Math.floor((cols - row.length) / 2);
      for (let x = 0; x < row.length; ++x) {
        const def = BRICKS[row[x]];
        if (!def) continue;
        g.bricks.push({ x: left + (off + x) * C.BRICK_W, y: top + y * C.BRICK_H, w: C.BRICK_W, h: C.BRICK_H, ch: row[x], kind: def.kind,
          hp: def.hp, max: def.hp, alive: true, regenT: 0, flash: 0 });
      }
    }
  }

  function speed(g) {
    const base = Math.min(C.BALL_SPEED_MAX, C.BALL_SPEED + g.level * C.BALL_SPEED_STEP) * g.speedMul;
    return base * (g.slowT > 0 ? 0.65 : 1) * (g.fastT > 0 ? 1.3 : 1);
  }

  function ballR(g) {
    return C.BALL_R * (g.megaT > 0 ? 1.9 : 1);
  }

  function resetBalls(g) {
    g.balls.length = 0;
    for (let i = 0; i < g.multi; ++i)
      g.balls.push({ x: g.paddle.x + (i - (g.multi - 1) / 2) * 18, y: C.PADDLE_Y - C.BALL_R - 1, vx: 0, vy: 0, stuck: true, off: (i - (g.multi - 1) / 2) * 18, held: 0 });
  }

  function launch(g) {
    let any = false;
    for (const b of g.balls) {
      if (!b.stuck) continue;
      const s = speed(g);
      const a = Math.max(-0.9, Math.min(0.9, b.off / (g.paddle.w / 2) * 1.0 + (rand(g) - 0.5) * 0.2));
      b.vx = Math.sin(a) * s;
      b.vy = -Math.cos(a) * s;
      b.stuck = false;
      any = true;
    }
    if (any) g.events.push({ type: 'launch' });
    return any;
  }

  function breakable(br) {
    return br.alive && br.kind !== 'wall';
  }

  function remaining(g) {
    let n = 0;
    for (const br of g.bricks) if (br.alive && br.kind !== 'wall' && br.kind !== 'regen' && !br.shield) ++n;
    return n;
  }

  function goldLeft(g) {
    let n = 0;
    for (const br of g.bricks) if (br.alive && br.kind === 'gold') ++n;
    return n;
  }

  /* damage a brick; -> true when it broke */
  function hitBrick(g, br, dmg, src) {
    if (!br.alive || br.kind === 'wall') {
      if (br.alive) { br.flash = 0.15; g.events.push({ type: 'clink', x: br.x + br.w / 2, y: br.y + br.h / 2 }); }
      return false;
    }
    br.hp -= dmg;
    br.flash = 0.15;
    g.noHitT = 0;
    if (br.hp > 0) {
      g.events.push({ type: 'hit', x: br.x + br.w / 2, y: br.y + br.h / 2, kind: br.kind, hp: br.hp });
      return false;
    }
    br.alive = false;
    br.regenT = br.kind === 'regen' ? C.REGEN_TIME : 0;
    ++g.stats.bricks;
    g.comboT = C.COMBO_TIME;
    ++g.combo;
    g.stats.best = Math.max(g.stats.best, g.combo);
    const pts = Math.round(BRICKS[br.ch].points * (1 + Math.min(20, g.combo) * 0.1) * (1 + g.level * 0.05) * g.scoreMul);
    g.score += pts;
    if (br.kind === 'gold') ++g.stats.gold;
    if (br.kind === 'crystal') ++g.stats.crystals;
    g.events.push({ type: 'break', x: br.x + br.w / 2, y: br.y + br.h / 2, kind: br.kind, ch: br.ch, points: pts, combo: g.combo, src: src || 'ball', shield: !!br.shield });
    if (br.kind === 'bomb') explode(g, br);
    if (!br.shield && (br.kind === 'crystal' || rand(g) < C.DROP_CHANCE * g.dropMul)) spawnDrop(g, br.x + br.w / 2, br.y + br.h / 2, br.kind === 'crystal');
    return true;
  }

  function explode(g, br) {
    ++g.stats.bombs;
    g.events.push({ type: 'bomb', x: br.x + br.w / 2, y: br.y + br.h / 2 });
    const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
    for (const o of g.bricks)
      if (o.alive && o !== br && Math.abs(o.x + o.w / 2 - cx) <= C.BRICK_W * 1.1 && Math.abs(o.y + o.h / 2 - cy) <= C.BRICK_H * 1.1) hitBrick(g, o, 9, 'bomb');
  }

  function spawnDrop(g, x, y, good) {
    const list = g.powers.map(id => POWER_BY_ID[id]).filter(p => !good || p.good);
    if (!list.length) return;
    let total = 0;
    for (const p of list) total += p.w;
    let r = rand(g) * total;
    let pick = list[0];
    for (const p of list) { r -= p.w; if (r <= 0) { pick = p; break; } }
    g.drops.push({ x: x, y: y, type: pick.id, t: 0 });
  }

  function addBall(g, from, angle) {
    if (g.balls.length >= C.MAX_BALLS) return;
    const s = speed(g);
    g.balls.push({ x: from.x, y: from.y, vx: Math.sin(angle) * s, vy: -Math.abs(Math.cos(angle)) * s * (from.vy > 0 ? -1 : 1), stuck: false, off: 0, held: 0 });
  }

  function applyPower(g, id) {
    const d = g.durMul;
    const p = g.paddle;
    ++g.stats.powers;
    switch (id) {
      case 'wide': p.wideT = 15 * d; p.shrinkT = 0; break;
      case 'shrink': p.shrinkT = 10; p.wideT = 0; break;
      case 'multi': {
        const list = g.balls.filter(b => !b.stuck);
        if (!list.length) launch(g);
        for (const b of g.balls.slice()) if (!b.stuck) { addBall(g, b, Math.atan2(b.vx, -b.vy) + 0.45); addBall(g, b, Math.atan2(b.vx, -b.vy) - 0.45); }
        break;
      }
      case 'slow': g.slowT = 12 * d; g.fastT = 0; break;
      case 'fast': g.fastT = 10; g.slowT = 0; break;
      case 'fire': g.fireT = 8 * d; break;
      case 'laser': p.laserT = 10 * d; break;
      case 'barrier': g.barrier = Math.min(3, g.barrier + 1); break;
      case 'magnet': p.magnetT = 15 * d; break;
      case 'mega': g.megaT = 10 * d; break;
      case 'life': if (!g.infinite) ++g.lives; break;
      case 'star': g.starT = 4; break;
    }
    rescale(g);
    g.events.push({ type: 'power', id: id });
  }

  /* keep every ball at the current speed after slow/haste change */
  function rescale(g) {
    const s = speed(g);
    for (const b of g.balls) {
      if (b.stuck) continue;
      const v = Math.hypot(b.vx, b.vy) || 1;
      b.vx *= s / v;
      b.vy *= s / v;
    }
  }

  function paddleBounce(g, b) {
    const p = g.paddle;
    let off = (b.x - p.x) / (p.w / 2);
    off = Math.max(-1, Math.min(1, off));
    if (p.magnetT > 0) {
      b.stuck = true;
      b.off = b.x - p.x;
      b.held = 0;
      b.y = C.PADDLE_Y - ballR(g) - 1;
      g.events.push({ type: 'catch', x: b.x });
      return;
    }
    const a = off * 1.05;
    const s = speed(g);
    b.vx = Math.sin(a) * s;
    b.vy = -Math.cos(a) * s;
    b.y = C.PADDLE_Y - ballR(g) - 0.5;
    g.combo = 0;
    ++g.stats.bounces;
    g.events.push({ type: 'paddle', x: b.x, off: off });
  }

  /* where a mate's face is: the line a ball bounces off */
  function mateFace(g, m) {
    return m.side === 'top' ? C.MATE_TOP : m.side === 'left' ? C.MATE_SIDE : g.w - C.MATE_SIDE;
  }

  function mateBounce(g, m, b, px, py, r) {
    const f = mateFace(g, m);
    let off;
    if (m.side === 'top') {
      if (!(b.vy < 0 && py - r >= f - 2 && b.y - r <= f && Math.abs(b.x - m.pos) <= m.w / 2 + r)) return;
      off = (b.x - m.pos) / (m.w / 2);
    } else if (m.side === 'left') {
      if (!(b.vx < 0 && px - r >= f - 2 && b.x - r <= f && Math.abs(b.y - m.pos) <= m.w / 2 + r)) return;
      off = (b.y - m.pos) / (m.w / 2);
    } else {
      if (!(b.vx > 0 && px + r <= f + 2 && b.x + r >= f && Math.abs(b.y - m.pos) <= m.w / 2 + r)) return;
      off = (b.y - m.pos) / (m.w / 2);
    }
    const a = Math.max(-1, Math.min(1, off)) * 1.05;
    const s = speed(g);
    if (m.side === 'top') { b.vx = Math.sin(a) * s; b.vy = Math.cos(a) * s; b.y = f + r + 0.5; }
    else if (m.side === 'left') { b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; b.x = f + r + 0.5; }
    else { b.vx = -Math.cos(a) * s; b.vy = Math.sin(a) * s; b.x = f - r - 0.5; }
    ++m.hits;
    g.combo = 0;
    g.events.push({ type: 'mate', side: m.side, x: b.x, y: b.y });
  }

  /* moves the mates toward their targets (input.mates, one number per mate) at their top speed */
  function moveMates(g, dt, targets) {
    for (let i = 0; i < g.mates.length; ++i) {
      const m = g.mates[i];
      const t = targets && targets[i] != null ? targets[i] : m.pos;
      const k = C.MATE_SPEED * dt;
      m.pos += Math.max(-k, Math.min(k, t - m.pos));
      const span = m.side === 'top' ? g.w : g.h;
      m.pos = Math.max(m.w / 2, Math.min(span - m.w / 2, m.pos));
    }
  }

  function outOfField(g, b, r) {
    return b.y > g.h + r || (g.open.top && b.y < -r) || (g.open.left && b.x < -r) || (g.open.right && b.x > g.w + r);
  }

  /* one ball sub-step against walls, bricks, the guardian and the paddle */
  function moveBall(g, b, dt) {
    const r = ballR(g);
    const px = b.x, py = b.y;
    if (g.gravity) b.vy += g.gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < r && !g.open.left) { b.x = r; b.vx = Math.abs(b.vx); g.events.push({ type: 'wall' }); }
    else if (b.x > g.w - r && !g.open.right) { b.x = g.w - r; b.vx = -Math.abs(b.vx); g.events.push({ type: 'wall' }); }
    if (b.y < r && !g.open.top) { b.y = r; b.vy = Math.abs(b.vy); g.events.push({ type: 'wall' }); }
    for (const m of g.mates) mateBounce(g, m, b, px, py, r);
    const fire = g.fireT > 0, mega = g.megaT > 0;
    let bounced = false;
    for (const br of g.bricks) {
      if (!br.alive) continue;
      const cx = Math.max(br.x, Math.min(b.x, br.x + br.w)), cy = Math.max(br.y, Math.min(b.y, br.y + br.h));
      const dx = b.x - cx, dy = b.y - cy;
      if (dx * dx + dy * dy >= r * r) continue;
      const passes = (fire || br.kind === 'glass') && br.kind !== 'wall' && br.kind !== 'titan' && !br.shield;
      hitBrick(g, br, mega ? 3 : fire ? 2 : 1, 'ball');
      if (passes) continue;
      if (bounced) continue;
      bounced = true;
      const wasOutX = px < br.x || px > br.x + br.w, wasOutY = py < br.y || py > br.y + br.h;
      if (wasOutX && !wasOutY) { b.vx = -b.vx; b.x = px; }
      else if (wasOutY && !wasOutX) { b.vy = -b.vy; b.y = py; }
      else { b.vx = -b.vx; b.vy = -b.vy; b.x = px; b.y = py; }
    }
    if (g.boss && NS.boss.ballHit) NS.boss.ballHit(g, b, px, py, r);
    const p = g.paddle;
    if (b.vy > 0 && py + r <= C.PADDLE_Y + 2 && b.y + r >= C.PADDLE_Y && b.x >= p.x - p.w / 2 - r && b.x <= p.x + p.w / 2 + r) paddleBounce(g, b);
    /* never let a ball fly nearly flat */
    const s = Math.hypot(b.vx, b.vy);
    if (!b.stuck && Math.abs(b.vy) < s * 0.22) {
      b.vy = (b.vy < 0 ? -1 : 1) * s * 0.22;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(0, s * s - b.vy * b.vy));
    }
  }

  /* one fixed step; input: { px (pointer target) | left/right, launch, fire } */
  function step(g, dt, input) {
    if (g.over || g.cleared) return;
    input = input || {};
    g.time += dt;
    const p = g.paddle;
    for (const k of ['wideT', 'shrinkT', 'laserT', 'magnetT', 'stunT', 'fireCd']) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    for (const k of ['slowT', 'fastT', 'fireT', 'megaT']) if (g[k] > 0) { g[k] = Math.max(0, g[k] - dt); if (!g[k] && (k === 'slowT' || k === 'fastT')) rescale(g); }
    const targetW = p.baseW * (p.wideT > 0 ? 1.6 : 1) * (p.shrinkT > 0 ? 0.6 : 1);
    p.w += (targetW - p.w) * Math.min(1, dt * 10);
    const sp = (p.stunT > 0 ? 0.35 : 1);
    const ox = p.x;
    if (input.px != null) {
      const d = input.px - p.x, m = C.PADDLE_FOLLOW * sp * dt;
      p.x += Math.max(-m, Math.min(m, d));
    } else if (input.left || input.right) p.x += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * C.PADDLE_SPEED * sp * dt;
    p.x = Math.max(p.w / 2, Math.min(g.w - p.w / 2, p.x));
    p.vx = (p.x - ox) / dt;
    if (g.mates.length) moveMates(g, dt, input.mates);
    if (input.launch) launch(g);
    if (p.laserT > 0 && input.fire && p.fireCd <= 0) {
      p.fireCd = C.LASER_GAP;
      g.lasers.push({ x: p.x - p.w / 2 + 8, y: C.PADDLE_Y - 4 }, { x: p.x + p.w / 2 - 8, y: C.PADDLE_Y - 4 });
      ++g.stats.lasers;
      g.events.push({ type: 'laser' });
    }
    if (g.comboT > 0 && (g.comboT -= dt) <= 0) g.combo = 0;
    g.noHitT += dt;
    /* balls */
    const r = ballR(g);
    for (let i = g.balls.length - 1; i >= 0; --i) {
      const b = g.balls[i];
      if (b.stuck) {
        b.x = Math.max(r, Math.min(g.w - r, p.x + b.off));
        b.y = C.PADDLE_Y - r - 1;
        b.held += dt;
        if (b.held > 3 && p.magnetT > 0) launch(g);
        continue;
      }
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const n = Math.max(1, Math.ceil(dist / (r * 0.45)));
      for (let k = 0; k < n && !b.stuck; ++k) moveBall(g, b, dt / n);
      if (outOfField(g, b, r)) {
        if (g.barrier > 0 && b.y > g.h) {
          --g.barrier;
          b.y = g.h - r;
          b.vy = -Math.abs(b.vy);
          g.events.push({ type: 'barrier', x: b.x });
        } else {
          g.balls.splice(i, 1);
          g.events.push({ type: 'lost', x: Math.max(0, Math.min(g.w, b.x)), y: Math.max(0, Math.min(g.h, b.y)) });
        }
      }
    }
    if (g.noHitT > C.STUCK_TIME) {
      g.noHitT = 0;
      for (const b of g.balls) if (!b.stuck) { const a = (rand(g) - 0.5) * 0.9; const c = Math.cos(a), s = Math.sin(a); const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx; }
      g.events.push({ type: 'nudge' });
    }
    if (!g.balls.length) loseLife(g);
    /* drops */
    for (let i = g.drops.length - 1; i >= 0; --i) {
      const d = g.drops[i];
      d.y += C.DROP_SPEED * dt;
      d.t += dt;
      if (d.y + C.DROP_H / 2 >= C.PADDLE_Y && d.y - C.DROP_H / 2 <= C.PADDLE_Y + C.PADDLE_H && Math.abs(d.x - p.x) <= p.w / 2 + C.DROP_W / 2) {
        g.drops.splice(i, 1);
        ++g.stats.caught;
        applyPower(g, d.type);
      } else if (d.y > g.h + 20) {
        g.drops.splice(i, 1);
        if (POWER_BY_ID[d.type].good) ++g.stats.missedDrops;
      }
    }
    /* lasers and stars */
    for (let i = g.lasers.length - 1; i >= 0; --i) {
      const l = g.lasers[i];
      l.y -= C.LASER_SPEED * dt;
      let hit = l.y < 0;
      for (const br of g.bricks) if (!hit && br.alive && l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) { hitBrick(g, br, 1, 'laser'); hit = true; }
      if (!hit && g.boss && NS.boss.laserHit) hit = NS.boss.laserHit(g, l);
      if (hit) g.lasers.splice(i, 1);
    }
    if (g.starT > 0) {
      g.starT -= dt;
      if (rand(g) < dt * 14) g.stars.push({ x: rand(g) * g.w, y: -10 });
    }
    for (let i = g.stars.length - 1; i >= 0; --i) {
      const s = g.stars[i];
      s.y += 520 * dt;
      let hit = s.y > g.h;
      for (const br of g.bricks) if (!hit && br.alive && br.kind !== 'wall' && s.x >= br.x && s.x <= br.x + br.w && s.y >= br.y && s.y <= br.y + br.h) { hitBrick(g, br, 1, 'star'); hit = true; }
      if (hit) g.stars.splice(i, 1);
    }
    /* bricks */
    for (const br of g.bricks) {
      if (br.flash > 0) br.flash = Math.max(0, br.flash - dt);
      if (!br.alive && br.regenT > 0) {
        br.regenT -= dt;
        if (br.regenT <= 0 && !g.balls.some(b => b.x > br.x - 10 && b.x < br.x + br.w + 10 && b.y > br.y - 10 && b.y < br.y + br.h + 10)) {
          br.alive = true;
          br.hp = br.max;
          g.events.push({ type: 'regen', x: br.x + br.w / 2, y: br.y + br.h / 2 });
        } else if (br.regenT <= 0) br.regenT = 0.5;
      }
    }
    if (g.regrow) {
      g.regrowT -= dt;
      if (g.regrowT <= 0) {
        g.regrowT = g.regrow;
        const dead = g.bricks.filter(br => !br.alive && br.kind !== 'regen' && !br.shield && br.kind !== 'gold');
        for (let k = 0; k < Math.min(4, dead.length); ++k) {
          const br = dead[Math.floor(rand(g) * dead.length)];
          br.alive = true;
          br.hp = br.max;
        }
        if (dead.length) g.events.push({ type: 'regrow' });
      }
    }
    if (g.boss && NS.boss.step) NS.boss.step(g, dt);
    if (!g.boss && !g.cleared && remaining(g) === 0) {
      g.cleared = true;
      g.events.push({ type: 'cleared' });
    }
  }

  function loseLife(g) {
    ++g.stats.lost;
    g.combo = 0;
    g.drops.length = 0;
    g.lasers.length = 0;
    g.fireT = g.megaT = g.slowT = g.fastT = 0;
    g.paddle.wideT = g.paddle.shrinkT = g.paddle.laserT = g.paddle.magnetT = 0;
    if (!g.infinite) --g.lives;
    if (g.lives < 0) {
      g.lives = 0;
      g.over = true;
      g.events.push({ type: 'over' });
      return;
    }
    g.events.push({ type: 'life', lives: g.lives });
    resetBalls(g);
  }

  function takeEvents(g) {
    const e = g.events;
    g.events = [];
    return e;
  }

  Object.assign(NS.engine, {
    rand, create, teamPlay, mateFace, mateBounce, moveMates, outOfField, loadLayout, speed, ballR, resetBalls, launch, breakable, remaining, goldLeft, hitBrick, spawnDrop, addBall, applyPower,
    rescale, paddleBounce, moveBall, step, loseLife, takeEvents,
  });
})();
