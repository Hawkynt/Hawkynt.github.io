/* The player's snake: placing it at the start, the turn queue (no reversing, no turning while
   sliding on ice), the step clock (Dash, Ice and Quicksand change it), one grid step at a time
   through wrap edges and portals, what the head runs into - fruit, power-ups, the exit gate,
   crates it can smash while shining, critters, rivals and guardians - and what happens on a
   crash: Scale Armor saves it, Zen cuts the tail instead, otherwise it bursts apart. Owns
   run.snake and the previous body used for smooth drawing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const C = NS.constants;
  const { T, ENEMIES } = NS.items;
  const L = NS.levels;
  const B = NS.board;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function create(start, len) {
    const body = [];
    const back = (start.dir + 2) % 4;
    let c = start.i;
    for (let k = 0; k < len; ++k) {
      body.push(c);
      const n = L.step(G.run.level, c, back);
      if (n >= 0 && !L.isSolid(G.run.level.tiles[n])) c = n;
    }
    return { body: body, dir: start.dir, queue: [], grow: 0, acc: 0, alive: true, iframes: 0, deadT: 0, gulp: [], blink: 0 };
  }

  function reset(start, len) {
    G.run.snake = create(start, len || C.START_LEN);
    G.prevBody = G.run.snake.body.slice();
    B.rebuildOcc();
  }

  function queueDir(d) {
    const s = G.run && G.run.snake;
    if (!s || !s.alive) return;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d === last || d === (last + 2) % 4) return;
    if (s.queue.length < C.INPUT_QUEUE) s.queue.push(d);
  }

  function interval() {
    const run = G.run;
    let iv = run.speed;
    if (run.act.dash > 0) iv *= 0.68;
    if (NS.food.hasMut('fast')) iv *= 0.8;
    if (run.level.tiles[run.snake.body[0]] === T.SAND) iv *= 1.7;
    return iv;
  }

  function update(dt) {
    const run = G.run;
    const s = run.snake;
    if (!s.alive) {
      s.deadT -= dt;
      if (s.deadT <= 0) NS.run.afterDeath();
      return;
    }
    if (s.iframes > 0) s.iframes = Math.max(0, s.iframes - dt);
    for (let k = s.gulp.length - 1; k >= 0; --k) {
      s.gulp[k] += dt * 16;
      if (s.gulp[k] > s.body.length) s.gulp.splice(k, 1);
    }
    /* a strike landing on the head */
    if (s.iframes <= 0 && B.deadlyAt(s.body[0])) hurt('hazard');
    if (!s.alive) return;
    s.acc += dt;
    let guard = 0;
    while (s.alive && s.acc >= interval() && guard++ < 4) {
      s.acc -= interval();
      if (run.auto) NS.autopilot.steer();
      stepOnce();
    }
  }

  /* the fraction of the way to the next step, for drawing */
  function progress() {
    const s = G.run.snake;
    return s.alive ? Math.min(1, s.acc / interval()) : 1;
  }

  function stepOnce() {
    const run = G.run;
    const s = run.snake;
    const lv = run.level;
    const head = s.body[0];
    const onIce = lv.tiles[head] === T.ICE;
    while (s.queue.length && !onIce) {
      const d = s.queue.shift();
      if (d !== (s.dir + 2) % 4 && d !== s.dir) { s.dir = d; break; }
    }
    if (onIce) s.queue.length = 0;
    let target = L.step(lv, head, s.dir);
    if (target < 0) { blocked('wall'); return; }
    let ch = lv.tiles[target];
    if (L.isSolid(ch)) {
      if ((ch === T.CRATE || ch === T.ROCK) && run.act.radiant > 0) {
        NS.combat.smash(target);
      } else { blocked('wall'); return; }
    }
    if (L.isPortal(ch)) {
      const a = L.arrive(lv, target);
      if (a !== target) {
        fx.ring(fx.cx(target), fx.cy(target), 4, 40, 0.35, '#c08cff', 4);
        fx.ring(fx.cx(a), fx.cy(a), 40, 4, 0.35, '#c08cff', 4);
        sfx('zap', { pitch: 1.5, volume: 0.5 });
        target = a;
        ch = lv.tiles[target];
      }
    }
    const ghost = run.act.ghost > 0, radiant = run.act.radiant > 0, safe = s.iframes > 0;
    const o = B.occ.type[target];
    if (o === B.BODY) {
      const k = B.occ.ref[target];
      const isTail = k === s.body.length - 1 && s.grow === 0;
      if (!isTail && !ghost && !safe) {
        if (run.mode === 'zen') zenCut(k);
        else { blocked('self'); return; }
      }
    } else if (o === B.CRITTER || o === B.RIVAL) {
      const e = run.enemies[B.occ.ref[target]];
      if (e && e.alive) {
        if (ENEMIES[e.type].edible || radiant) NS.combat.killEnemy(e, 'ram');
        else if (!ghost && !safe) { blocked(o === B.RIVAL ? 'rival' : 'critter'); return; }
      }
    } else if (o === B.BOSS) {
      if (radiant) {
        if (!NS.bosses.hit(1, target)) { bounce(); return; }
        B.rebuildOcc();
        if (B.occ.type[target] === B.BOSS) { bounce(); return; }
      } else if (safe) { bounce(); return; } else { blocked('guardian'); return; }
    }
    if (B.deadlyAt(target) && !safe) { blocked('hazard'); return; }
    G.prevBody = s.body.slice();
    s.body.unshift(target);
    if (s.grow > 0) --s.grow; else s.body.pop();
    B.rebuildOcc();
    emitTrail();
    const f = B.foodIndex(target);
    if (f >= 0) NS.food.eat(f);
    if (run.power && run.power.i === target) NS.powerups.collect();
    NS.food.magnetStep();
    if (run.gate === target) NS.run.levelComplete();
    if (s.body.length > run.maxLength) {
      run.maxLength = s.body.length;
      NS.progress.best('bestLength', run.maxLength);
    }
  }

  /* Zen: biting your own body sheds everything behind the bite as petals */
  function zenCut(k) {
    const s = G.run.snake;
    const lost = s.body.splice(k);
    for (let j = 0; j < lost.length; ++j)
      fx.burst(fx.cx(lost[j]), fx.cy(lost[j]), 3, ['#ffb0d0', '#ffffff', '#c8f08a'], 90, 0.9, 7, fx.PETAL, -20);
    NS.food.addScore(lost.length * 3, fx.cx(s.body[0]), fx.cy(s.body[0]) - 20);
    sfx('whoosh', { volume: 0.5, pitch: 1.3 });
    B.rebuildOcc();
  }

  /* turn toward any open neighbour without moving this step */
  function bounce() {
    const run = G.run;
    const s = run.snake;
    const lv = run.level;
    const opts = [];
    for (let d = 0; d < 4; ++d) {
      if (d === (s.dir + 2) % 4) continue;
      const n = L.step(lv, s.body[0], d);
      if (n < 0 || L.isSolid(lv.tiles[n])) continue;
      const o = B.occ.type[n];
      if (o !== B.EMPTY && !(o === B.BODY && B.occ.ref[n] === s.body.length - 1)) continue;
      opts.push(d);
    }
    s.queue.length = 0;
    if (opts.length) s.dir = opts[Math.floor(G.rng() * opts.length)];
    G.prevBody = s.body.slice();
  }

  function blocked(reason) {
    const run = G.run;
    const s = run.snake;
    if (run.mode === 'zen' || run.immortal) { bounce(); return; }
    if (s.iframes > 0 && reason === 'wall') { bounce(); return; }
    if (run.shield > 0) {
      run.shield -= 1;
      s.iframes = 1.0;
      const h = s.body[0];
      fx.ring(fx.cx(h), fx.cy(h), 10, 70, 0.4, '#5a8aff', 6);
      fx.burst(fx.cx(h), fx.cy(h), 18, ['#5a8aff', '#ffffff', '#a8c8ff'], 260, 0.5, 7, fx.SQUARE);
      fx.text(fx.cx(h), fx.cy(h) - 30, 'Armor!', '#a8c8ff', 18);
      fx.shake(6);
      sfx('bounce');
      bounce();
      return;
    }
    die(reason);
  }

  /* something hit the head from outside (a critter stepping in, a strike, a guardian) */
  function hurt(reason) {
    const run = G.run;
    const s = run.snake;
    if (!s.alive || s.iframes > 0 || run.mode === 'zen' || run.immortal) return;
    if (run.shield > 0) {
      run.shield -= 1;
      s.iframes = 1.2;
      const h = s.body[0];
      fx.ring(fx.cx(h), fx.cy(h), 10, 70, 0.4, '#5a8aff', 6);
      fx.text(fx.cx(h), fx.cy(h) - 30, 'Armor!', '#a8c8ff', 18);
      sfx('bounce');
      return;
    }
    die(reason);
  }

  function critterHit(e) {
    const run = G.run;
    if (run.act.radiant > 0) { NS.combat.killEnemy(e, 'ram'); return; }
    if (run.act.ghost > 0) return;
    hurt('critter');
  }

  function die(reason) {
    const run = G.run;
    const s = run.snake;
    s.alive = false;
    s.deadT = C.DEATH_TIME;
    s.deathT = 0;
    s.reason = reason;
    run.deaths += 1;
    run.combo = 0;
    NS.progress.add('deaths', 1);
    const h = s.body[0];
    const skin = NS.cosmetics.find('skin', G.save.equip.skin);
    const cols = [skin.a, skin.b, skin.c, '#ffffff'];
    fx.burst(fx.cx(h), fx.cy(h), 40, ['#ffffff', '#ff6a5a', '#ffd25a'], 380, 0.8, 11);
    fx.ring(fx.cx(h), fx.cy(h), 8, 120, 0.6, '#ff6a5a', 8);
    for (let k = 1; k < s.body.length; ++k)
      fx.burst(fx.cx(s.body[k]), fx.cy(s.body[k]), 3, cols, 140 + k * 3, 0.9, 7, fx.SQUARE, 300);
    fx.shake(14);
    fx.flash('#ff5a4a', 0.45);
    fx.hitstop(0.12);
    fx.slowmo(0.5);
    sfx('hurt');
    sfx('explode', { volume: 0.7 });
  }

  /* the cosmetic trail drifts off the second segment */
  function emitTrail() {
    const tr = NS.cosmetics.find('trail', G.save.equip.trail);
    if (tr.kind === 'none' || G.run.snake.body.length < 2) return;
    const c = G.run.snake.body[1];
    const x = fx.cx(c) + (fx.P.n % 7 - 3) * 2, y = fx.cy(c);
    const R = NS.rng.fx;
    const kinds = { sparkle: fx.STAR, leaf: fx.LEAF, ember: fx.GLOW, bubble: fx.BUBBLE, heart: fx.HEART, star: fx.STAR,
      neon: fx.GLOW, snow: fx.SNOW, petal: fx.PETAL, bat: fx.BAT, confetti: fx.SQUARE };
    const k = kinds[tr.kind];
    const col = tr.kind === 'confetti' ? ['#ffd23a', '#ff5a8a', '#6fd3ff', '#7ee07a'][Math.floor(R() * 4)] : tr.color;
    const up = tr.kind === 'ember' || tr.kind === 'bubble' ? -40 : tr.kind === 'snow' || tr.kind === 'leaf' || tr.kind === 'petal' ? 20 : 0;
    fx.spawn(k, x, y, (R() - 0.5) * 30, up + (R() - 0.5) * 20, 0.9 + R() * 0.5, tr.kind === 'neon' ? 9 : 6 + R() * 3, col, 0, 0);
  }

  Object.assign(NS.snake, {
    create, reset, queueDir, interval, update, progress, stepOnce, bounce, blocked, hurt, critterHit, die
  });
})();
