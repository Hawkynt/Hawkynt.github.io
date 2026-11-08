/* The stage engine, pure and deterministic: a stage is one plain object (map, player, bubbles,
   enemies, items, enemy shots, floods, bolts and flames, timers, score, lives, stars and the
   seeded generator state), so it saves as JSON and replays the same. Platforms are one-way from
   below; the floor gap wraps to the top. The player runs, jumps and blows bubbles that fly out,
   then float up to gather where the wind blows; a flying bubble traps an enemy (a brute takes
   two), a touched bubble pops - and every bubble touching it pops too, each trapped enemy in the
   chain worth double the last. Popped enemies tumble out as fruit. Standing on a bubble with
   jump held bounces you up. Trapped enemies break out angry after a while; after 40 s everyone
   is angry, after 55 s an unbeatable shade hunts the player. Water, lightning, fire and star
   bubbles drift in: water floods down the platforms, lightning shoots a bolt, fire burns a
   platform, five stars give a life. Candy power-ups drop from chains. Each step leaves events
   for sound and effects. A guardian (systems/boss.js) plugs in through g.boss. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const { makeRng } = NS.rng;
  const { TILE, COLS, ROWS, FIELD_W, FIELD_H, PW, PH, ENEMIES, POWER_BY_ID } = C;
  const L = NS.levels;

  function rand(g) {
    const r = makeRng(g.rng);
    const v = r.next();
    g.rng = r.s;
    return v;
  }

  /* opts: seed, level ({ map, spawn, enemies, wind }), lives, speed (enemy factor), powers,
     elements (seconds between elemental bubbles), range, rateMul, runMul, infinite */
  function create(opts) {
    opts = opts || {};
    const g = {
      seed: opts.seed >>> 0 || 1, rng: opts.seed >>> 0 || 1, map: null, wind: 'center',
      player: null, bubbles: [], enemies: [], items: [], shots: [], floods: [], bolts: [], flames: [], events: [],
      lives: opts.lives == null ? 3 : opts.lives, infinite: !!opts.infinite, score: 0, stars: 0, time: 0, clearT: 0,
      speed: opts.speed || 1, powers: opts.powers || ['shoes', 'rapid', 'range', 'shield'], elementEvery: opts.elements || 11, elementT: 6,
      rangeMul: opts.range || 1, rateMul: opts.rateMul || 1, runMul: opts.runMul || 1, trapMul: opts.trapMul || 1, scoreMul: opts.scoreMul || 1,
      dropMul: opts.drops == null ? 1 : opts.drops, noHurry: !!opts.noHurry, invMul: opts.invMul || 1, patience: opts.patience || 0, startShield: !!opts.startShield,
      angry: false, shade: null, freezeT: 0, cleared: false, over: false, boss: null,
      stats: { trapped: 0, popped: 0, bestChain: 0, fruit: 0, powers: 0, deaths: 0, bounces: 0, elements: 0, stars: 0, hitsTaken: 0 },
    };
    if (opts.level) loadLevel(g, opts.level);
    return g;
  }

  function loadLevel(g, lv) {
    g.map = lv.map.slice();
    g.wind = lv.wind || 'center';
    g.spawn = { x: (lv.spawn.x + 0.5) * TILE, y: (lv.spawn.y + 1) * TILE };
    g.bubbles.length = 0;
    g.items.length = 0;
    g.shots.length = 0;
    g.floods.length = 0;
    g.bolts.length = 0;
    g.flames.length = 0;
    g.enemies = lv.enemies.map(e => newEnemy(g, e.type, (e.x + 0.5) * TILE, (e.y + 1) * TILE));
    g.time = 0;
    g.clearT = 0;
    g.angry = false;
    g.shade = null;
    g.cleared = false;
    const keep = g.player;
    g.player = { x: g.spawn.x, y: g.spawn.y, vx: 0, vy: 0, face: 1, ground: true, inv: 1.5, shield: keep ? keep.shield : false, shotT: 0,
      dead: 0, shoes: false, rapid: false, range: false, big: false, magnet: false, jumpHeld: false, walk: 0 };
    if (g.startShield) g.player.shield = true;
  }

  function newEnemy(g, type, x, y) {
    const d = ENEMIES[type];
    return { type: type, x: x, y: y, vx: 0, vy: 0, dir: rand(g) < 0.5 ? -1 : 1, ground: false, angry: false, hp: d.hp, stun: 0,
      jumpT: 1 + rand(g) * 2, shootT: 2 + rand(g) * 2, t: 0 };
  }

  function solidTile(g, tx, ty) {
    if (tx < 0 || tx >= COLS) return true;
    if (ty < 0 || ty >= ROWS) return false;
    return g.map[ty][tx] === '#';
  }

  function isWallCol(tx) {
    return tx <= 0 || tx >= COLS - 1;
  }

  /* moves a body (x centre, y feet, w, h) with gravity and one-way platforms; -> landed */
  function body(g, b, w, h, dt, gravity) {
    if (gravity !== false) b.vy = Math.min(C.FALL_MAX, b.vy + C.GRAVITY * dt);
    b.x += b.vx * dt;
    const minX = TILE + w / 2, maxX = FIELD_W - TILE - w / 2;
    if (b.x < minX) { b.x = minX; b.hitWall = -1; } else if (b.x > maxX) { b.x = maxX; b.hitWall = 1; } else b.hitWall = 0;
    const oy = b.y;
    let ny = b.y + b.vy * dt;
    let landed = false;
    if (b.vy >= 0) {
      const t0 = Math.floor(oy / TILE), t1 = Math.floor(ny / TILE);
      for (let ty = t0; ty <= t1 && !landed; ++ty) {
        if (ty < 0 || ty >= ROWS) continue;
        const top = ty * TILE;
        if (oy > top + 0.01 && ty !== t0) continue;
        if (oy > top + 0.01) continue;
        for (const xx of [b.x - w / 2 + 2, b.x + w / 2 - 2]) {
          const tx = Math.floor(xx / TILE);
          if (!isWallCol(tx) && solidTile(g, tx, ty)) { ny = top; b.vy = 0; landed = true; break; }
        }
      }
    } else {
      /* the ceiling stops jumps except under its gap */
      const headTy = Math.floor((ny - h) / TILE);
      if (headTy <= 0) {
        const tx = Math.floor(b.x / TILE);
        if (solidTile(g, tx, 0) && ny - h < TILE) { ny = TILE + h; b.vy = 0; }
      }
    }
    b.y = ny;
    if (b.y - h > FIELD_H) b.y = -2;
    if (b.y < -h - 4) b.y = FIELD_H + h;
    b.ground = landed;
    return landed;
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) * 2 < aw + bw && Math.abs((ay - ah / 2) - (by - bh / 2)) * 2 < ah + bh;
  }

  /* ---- player ---- */
  function shoot(g) {
    const p = g.player;
    if (p.dead || p.shotT > 0) return false;
    p.shotT = C.SHOT_GAP / (p.rapid ? 2 : 1) / g.rateMul;
    const r = C.BUBBLE_R * (p.big ? 1.5 : 1);
    g.bubbles.push({ x: p.x + p.face * 12, y: p.y - PH / 2, vx: p.face * C.BUBBLE_SPEED, vy: 0, r: r, phase: 'shot', dist: 0,
      range: C.BUBBLE_RANGE * (p.range ? 2 : 1) * g.rangeMul, life: C.BUBBLE_LIFE, trap: null, elem: null, t: 0, wob: rand(g) * 6 });
    g.events.push({ type: 'blow', x: p.x, y: p.y });
    return true;
  }

  function hurt(g, why) {
    const p = g.player;
    if (p.dead || p.inv > 0) return;
    if (p.shield) {
      p.shield = false;
      p.inv = 1.2;
      g.events.push({ type: 'shieldpop', x: p.x, y: p.y });
      return;
    }
    p.dead = 1.4;
    ++g.stats.deaths;
    ++g.stats.hitsTaken;
    g.events.push({ type: 'die', x: p.x, y: p.y, why: why });
  }

  function respawn(g) {
    const p = g.player;
    if (!g.infinite) --g.lives;
    if (g.lives < 0) {
      g.lives = 0;
      g.over = true;
      g.events.push({ type: 'over' });
      return;
    }
    p.x = g.spawn.x;
    p.y = g.spawn.y;
    p.vx = p.vy = 0;
    p.dead = 0;
    p.inv = C.INVULN * g.invMul;
    p.rapid = p.range = p.big = p.shoes = p.magnet = false;
    g.events.push({ type: 'respawn', lives: g.lives });
  }

  function updatePlayer(g, dt, input) {
    const p = g.player;
    if (p.dead) {
      p.dead -= dt;
      p.vy = Math.min(C.FALL_MAX, p.vy + C.GRAVITY * dt * 0.3);
      if (p.dead <= 0) respawn(g);
      return;
    }
    if (p.inv > 0) p.inv -= dt;
    if (p.shotT > 0) p.shotT -= dt;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = dir * C.RUN * (p.shoes ? 1.45 : 1) * g.runMul;
    if (dir) { p.face = dir; p.walk += dt; }
    p.jumpHeld = !!input.jump;
    if (input.jump && p.ground) {
      p.vy = -C.JUMP;
      p.ground = false;
      g.events.push({ type: 'jump' });
    }
    body(g, p, PW, PH, dt);
    if (input.shoot) shoot(g);
  }

  /* ---- bubbles ---- */
  function windX(g) {
    return g.wind === 'left' ? TILE * 4 : g.wind === 'right' ? FIELD_W - TILE * 4 : FIELD_W / 2;
  }

  function updateBubbles(g, dt) {
    const p = g.player;
    for (let i = g.bubbles.length - 1; i >= 0; --i) {
      const b = g.bubbles[i];
      b.t += dt;
      if (b.phase === 'shot') {
        const step = b.vx * dt;
        b.x += step;
        b.dist += Math.abs(step);
        if (b.x < TILE + b.r || b.x > FIELD_W - TILE - b.r || b.dist >= b.range) {
          b.x = Math.max(TILE + b.r, Math.min(FIELD_W - TILE - b.r, b.x));
          b.phase = 'float';
        }
        if (!b.trap && !b.elem) for (const e of g.enemies) {
          if (e.dead || e.trapped) continue;
          if (overlap(b.x, b.y + b.r, b.r * 2 * (b.r > C.BUBBLE_R ? 1.2 : 1), b.r * 2, e.x, e.y, 24, 24)) { trapEnemy(g, b, e); break; }
        }
        if (g.boss && NS.boss.bubbleHit && NS.boss.bubbleHit(g, b)) { g.bubbles.splice(i, 1); continue; }
      } else {
        const tx = windX(g);
        const ceil = TILE + b.r + 2;
        b.vy = b.y > ceil ? -C.BUBBLE_RISE : 0;
        b.y = Math.max(ceil, b.y + b.vy * dt);
        const dx = tx - b.x;
        b.x += Math.max(-40, Math.min(40, dx)) * dt * (b.y <= ceil + 1 ? 1 : 0.35) + Math.sin(b.t * 2 + b.wob) * 8 * dt;
        b.x = Math.max(TILE + b.r, Math.min(FIELD_W - TILE - b.r, b.x));
      }
      b.life -= dt;
      if (b.trap) {
        b.trap.t -= dt;
        if (b.trap.t <= 0) { release(g, b); g.bubbles.splice(i, 1); continue; }
      } else if (b.life <= 0) {
        g.events.push({ type: 'fizz', x: b.x, y: b.y });
        g.bubbles.splice(i, 1);
        continue;
      }
    }
    /* bubbles push apart */
    for (let i = 0; i < g.bubbles.length; ++i)
      for (let j = i + 1; j < g.bubbles.length; ++j) {
        const a = g.bubbles[i], b = g.bubbles[j];
        if (a.phase !== 'float' || b.phase !== 'float') continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r - 2;
        if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
      }
    /* the player and the bubbles */
    if (!p.dead) {
      for (let i = g.bubbles.length - 1; i >= 0; --i) {
        const b = g.bubbles[i];
        if (b.phase === 'shot' && b.t < 0.18) continue;
        const dx = p.x - b.x, dy = (p.y - PH / 2) - b.y;
        if (dx * dx + dy * dy > (b.r + 13) * (b.r + 13)) continue;
        if (p.vy > 0 && p.y < b.y && p.jumpHeld) {
          p.vy = -C.JUMP * 0.92;
          ++g.stats.bounces;
          g.events.push({ type: 'bounce', x: b.x, y: b.y });
          continue;
        }
        popChain(g, b);
        break;
      }
    }
  }

  function trapEnemy(g, b, e) {
    if (e.hp > 1 && b.r <= C.BUBBLE_R) {
      --e.hp;
      e.stun = 1;
      g.bubbles.splice(g.bubbles.indexOf(b), 1);
      g.events.push({ type: 'dent', x: e.x, y: e.y });
      return;
    }
    e.trapped = true;
    b.trap = { type: e.type, angry: e.angry, t: C.TRAP_TIME * g.trapMul };
    b.phase = 'float';
    b.life = 99;
    b.x = e.x;
    b.y = e.y - 12;
    g.enemies.splice(g.enemies.indexOf(e), 1);
    ++g.stats.trapped;
    g.events.push({ type: 'trap', x: b.x, y: b.y, kind: e.type });
  }

  function release(g, b) {
    const e = newEnemy(g, b.trap.type, b.x, b.y + 12);
    e.angry = true;
    g.enemies.push(e);
    g.events.push({ type: 'escape', x: b.x, y: b.y });
  }

  /* pops a bubble and every bubble touching it, recursively; -> enemies freed */
  function popChain(g, start) {
    const list = [start];
    const done = new Set([start]);
    for (let k = 0; k < list.length; ++k) {
      const a = list[k];
      for (const b of g.bubbles) if (!done.has(b) && Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + 8) { done.add(b); list.push(b); }
    }
    let n = 0;
    for (const b of list) {
      g.bubbles.splice(g.bubbles.indexOf(b), 1);
      if (b.trap) {
        ++n;
        const pts = Math.min(64000, 1000 * Math.pow(2, n - 1)) * g.scoreMul;
        g.score += pts;
        ++g.stats.popped;
        g.events.push({ type: 'pop', x: b.x, y: b.y, n: n, points: pts, kind: b.trap.type });
        g.items.push({ x: b.x, y: b.y, vx: (rand(g) - 0.5) * 220, vy: -320, kind: 'fruit', fruit: Math.min(7, n - 1 + Math.floor(rand(g) * 2)), value: 500 * n, t: 0, ground: false });
      } else if (b.elem) element(g, b);
      else g.events.push({ type: 'popempty', x: b.x, y: b.y });
    }
    if (n) {
      g.stats.bestChain = Math.max(g.stats.bestChain, n);
      if (n >= 2) g.events.push({ type: 'chain', n: n, x: start.x, y: start.y });
      if (rand(g) < (0.12 + n * 0.08) * g.dropMul) {
        const list2 = g.powers.map(id => POWER_BY_ID[id]);
        let total = 0;
        for (const pw of list2) total += pw.w;
        let r = rand(g) * total, pick = list2[0];
        for (const pw of list2) { r -= pw.w; if (r <= 0) { pick = pw; break; } }
        g.items.push({ x: start.x, y: start.y, vx: 0, vy: -200, kind: pick.id, value: 0, t: 0, ground: false });
      }
    }
    return n;
  }

  /* ---- elemental bubbles ---- */
  function spawnElement(g) {
    const r = rand(g);
    const elem = g.boss ? 'bolt' : r < 0.3 ? 'water' : r < 0.6 ? 'bolt' : r < 0.82 ? 'fire' : 'star';
    const x = (L.GAP[0] + 2) * TILE;
    g.bubbles.push({ x: x, y: FIELD_H - TILE, vx: 0, vy: 0, r: C.BUBBLE_R, phase: 'float', dist: 0, range: 0, life: 14, trap: null, elem: elem, t: 1, wob: rand(g) * 6 });
    g.events.push({ type: 'element', elem: elem });
  }

  function element(g, b) {
    ++g.stats.elements;
    const p = g.player;
    if (b.elem === 'water') g.floods.push({ x: b.x, y: b.y, vx: (p.face || 1) * 220, vy: 0, t: 0 });
    else if (b.elem === 'bolt') g.bolts.push({ x: b.x, y: b.y, vx: (p.face || 1) * 520, t: 0 });
    else if (b.elem === 'fire') g.flames.push({ x: b.x, y: b.y, vy: 0, t: 3.5, ground: false });
    else if (b.elem === 'star') {
      ++g.stars;
      ++g.stats.stars;
      if (g.stars >= C.STAR_GOAL) {
        g.stars = 0;
        if (!g.infinite) ++g.lives;
        g.events.push({ type: 'extralife' });
      }
    }
    g.events.push({ type: 'popelem', elem: b.elem, x: b.x, y: b.y });
  }

  function killEnemy(g, e, why) {
    g.enemies.splice(g.enemies.indexOf(e), 1);
    const pts = ENEMIES[e.type].points * g.scoreMul;
    g.score += pts;
    ++g.stats.popped;
    g.items.push({ x: e.x, y: e.y - 12, vx: (rand(g) - 0.5) * 200, vy: -300, kind: 'fruit', fruit: 2 + Math.floor(rand(g) * 4), value: 800, t: 0, ground: false });
    g.events.push({ type: 'zap', x: e.x, y: e.y, why: why, points: pts });
  }

  function updateElements(g, dt) {
    g.elementT -= dt;
    if (g.elementT <= 0) { g.elementT = g.elementEvery; spawnElement(g); }
    for (let i = g.floods.length - 1; i >= 0; --i) {
      const f = g.floods[i];
      f.t += dt;
      body(g, f, 20, 16, dt);
      if (f.hitWall) f.vx = -f.vx;
      for (let k = g.enemies.length - 1; k >= 0; --k) if (overlap(f.x, f.y, 40, 30, g.enemies[k].x, g.enemies[k].y, 24, 24)) killEnemy(g, g.enemies[k], 'water');
      if (f.t > 5) g.floods.splice(i, 1);
    }
    for (let i = g.bolts.length - 1; i >= 0; --i) {
      const b = g.bolts[i];
      b.x += b.vx * dt;
      b.t += dt;
      for (let k = g.enemies.length - 1; k >= 0; --k) if (Math.abs(g.enemies[k].x - b.x) < 18 && Math.abs(g.enemies[k].y - 12 - b.y) < 22) killEnemy(g, g.enemies[k], 'bolt');
      if (g.boss && NS.boss.boltHit && NS.boss.boltHit(g, b)) { g.bolts.splice(i, 1); continue; }
      if (b.x < 0 || b.x > FIELD_W) g.bolts.splice(i, 1);
    }
    for (let i = g.flames.length - 1; i >= 0; --i) {
      const f = g.flames[i];
      f.vx = 0;
      body(g, f, 24, 10, dt);
      if (f.ground) f.t -= dt;
      for (let k = g.enemies.length - 1; k >= 0; --k) if (overlap(f.x, f.y, 70, 24, g.enemies[k].x, g.enemies[k].y, 24, 24)) killEnemy(g, g.enemies[k], 'fire');
      if (f.t <= 0) g.flames.splice(i, 1);
    }
  }

  /* ---- enemies ---- */
  function updateEnemies(g, dt) {
    const p = g.player;
    const frozen = g.freezeT > 0;
    for (const e of g.enemies) {
      const d = ENEMIES[e.type];
      e.t += dt;
      if (frozen) continue;
      if (e.stun > 0) { e.stun -= dt; e.vx = 0; body(g, e, 24, 24, dt); continue; }
      const sp = d.speed * g.speed * (e.angry || g.angry ? 1.6 : 1);
      if (d.kind === 'fly') {
        if (!e.vx) { e.vx = sp * e.dir; e.vy = sp * 0.7; }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < TILE + 12 || e.x > FIELD_W - TILE - 12) { e.vx = -e.vx; e.x = Math.max(TILE + 12, Math.min(FIELD_W - TILE - 12, e.x)); }
        if (e.y < TILE + 24 || e.y > FIELD_H - TILE) { e.vy = -e.vy; e.y = Math.max(TILE + 24, Math.min(FIELD_H - TILE, e.y)); }
      } else if (d.kind === 'ghost') {
        const dx = p.x - e.x, dy = (p.y - 12) - (e.y - 12), dd = Math.hypot(dx, dy) || 1;
        e.x += dx / dd * sp * dt;
        e.y += dy / dd * sp * dt;
        e.dir = dx < 0 ? -1 : 1;
      } else {
        e.vx = e.dir * sp;
        if (d.kind === 'hop') {
          e.jumpT -= dt;
          if (e.ground && e.jumpT <= 0) { e.vy = -C.JUMP * 0.85; e.jumpT = 1.2 + rand(g); e.dir = p.x < e.x ? -1 : 1; }
        } else if (d.jumps && e.ground) {
          e.jumpT -= dt;
          if (e.jumpT <= 0 && p.y < e.y - TILE && Math.abs(p.x - e.x) < TILE * 5) { e.vy = -C.JUMP; e.jumpT = 1.5 + rand(g) * 2; }
          else if (e.jumpT <= 0) e.jumpT = 0.5;
        }
        body(g, e, 24, 24, dt);
        if (e.hitWall) e.dir = -e.hitWall;
        if (d.shoots && e.ground) {
          e.shootT -= dt;
          if (e.shootT <= 0 && Math.abs(p.y - e.y) < 20 && Math.sign(p.x - e.x) === e.dir) {
            e.shootT = 2.6;
            g.shots.push({ x: e.x + e.dir * 12, y: e.y - 12, vx: e.dir * 230, t: 0 });
            g.events.push({ type: 'enemyshot' });
          } else if (e.shootT <= 0) e.shootT = 0.4;
        }
      }
      if (!p.dead && overlap(p.x, p.y, PW - 6, PH - 4, e.x, e.y, 22, 22)) hurt(g, 'enemy');
    }
    for (let i = g.shots.length - 1; i >= 0; --i) {
      const s = g.shots[i];
      s.x += s.vx * dt;
      s.t += dt;
      if (!p.dead && Math.abs(s.x - p.x) < 12 && Math.abs(s.y - (p.y - PH / 2)) < 14) { hurt(g, 'shot'); g.shots.splice(i, 1); continue; }
      if (s.x < TILE || s.x > FIELD_W - TILE || s.t > 4) g.shots.splice(i, 1);
    }
  }

  /* ---- items ---- */
  function updateItems(g, dt) {
    const p = g.player;
    for (let i = g.items.length - 1; i >= 0; --i) {
      const it = g.items[i];
      it.t += dt;
      if (p.magnet && it.kind === 'fruit' && !p.dead) {
        it.x += (p.x - it.x) * Math.min(1, dt * 4);
        it.y += (p.y - 10 - it.y) * Math.min(1, dt * 4);
      } else {
        it.vx *= 1 - dt * 1.5;
        body(g, it, 20, 20, dt);
      }
      if (!p.dead && it.t > 0.3 && overlap(p.x, p.y, PW + 6, PH + 6, it.x, it.y, 20, 20)) {
        g.items.splice(i, 1);
        if (it.kind === 'fruit') {
          g.score += it.value * g.scoreMul;
          ++g.stats.fruit;
          g.events.push({ type: 'fruit', x: it.x, y: it.y, value: it.value * g.scoreMul, fruit: it.fruit });
        } else applyPower(g, it.kind);
        continue;
      }
      if (it.t > 9) g.items.splice(i, 1);
    }
  }

  function applyPower(g, id) {
    const p = g.player;
    ++g.stats.powers;
    switch (id) {
      case 'shoes': p.shoes = true; break;
      case 'rapid': p.rapid = true; break;
      case 'range': p.range = true; break;
      case 'big': p.big = true; break;
      case 'shield': p.shield = true; break;
      case 'freeze': g.freezeT = 6; break;
      case 'magnet': p.magnet = true; break;
      case 'bomb': for (const b of g.bubbles.slice()) if (b.trap && g.bubbles.indexOf(b) >= 0) popChain(g, b); break;
    }
    g.events.push({ type: 'power', id: id });
  }

  /* one fixed step; input: { left, right, jump, shoot } */
  function step(g, dt, input) {
    if (g.over || g.cleared) return;
    input = input || {};
    g.time += dt;
    if (g.freezeT > 0) g.freezeT = Math.max(0, g.freezeT - dt);
    updatePlayer(g, dt, input);
    updateBubbles(g, dt);
    updateEnemies(g, dt);
    updateElements(g, dt);
    updateItems(g, dt);
    if (g.boss && NS.boss.step) NS.boss.step(g, dt);
    if (!g.boss && !g.noHurry) {
      if (!g.angry && g.time > C.ANGRY_AT + g.patience && g.enemies.length) { g.angry = true; g.events.push({ type: 'hurry' }); }
      if (!g.shade && g.time > C.SHADE_AT + g.patience && g.enemies.length) { g.shade = { x: FIELD_W / 2, y: TILE * 2 }; g.events.push({ type: 'shade' }); }
    }
    if (g.shade) {
      const p = g.player;
      const dx = p.x - g.shade.x, dy = (p.y - 12) - g.shade.y, d = Math.hypot(dx, dy) || 1;
      const sp = 55 + (g.time - C.SHADE_AT - g.patience) * 2;
      g.shade.x += dx / d * sp * dt;
      g.shade.y += dy / d * sp * dt;
      if (!p.dead && d < 22) hurt(g, 'shade');
    }
    const trapped = g.bubbles.some(b => b.trap);
    if (!g.boss && !g.enemies.length && !trapped) {
      if (g.shade) g.shade = null;
      g.clearT += dt;
      if (g.clearT >= 2.2) {
        g.cleared = true;
        g.events.push({ type: 'cleared' });
      }
    }
  }

  function takeEvents(g) {
    const e = g.events;
    g.events = [];
    return e;
  }

  Object.assign(NS.engine, { rand, create, loadLevel, newEnemy, solidTile, body, overlap, shoot, hurt, respawn, windX, trapEnemy, release, popChain,
    spawnElement, element, killEnemy, applyPower, step, takeEvents });
})();
