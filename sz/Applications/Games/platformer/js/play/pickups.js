/*
 * Pickups: coins (popping, magnet), gems, power-up items, checkpoints, the goal trigger and the
 * Time Trial ghost recording.
 * Writes G.run.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, STEP, STAR_TIME, GEM_COLORS, WORLDS } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Prog = SZ.PlatformerProgress;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Session = NS.module('session');
  const Finish = NS.module('finish');
  const { sfx } = NS.module('sound');
  const fxWorld = G.fxWorld;
  const shake = G.shake;
  const hitStop = G.hitStop;
  const flash = G.flash;
  const texts = G.texts;

  function updateItems() {
    const r = G.run, p = r.player;
    const px = p.x + p.w / 2, py = p.y + p.h / 2;
    const magnet = G.stats.magnet * TS;
    for (const c of r.coins) {
      if (c.taken)
        continue;
      c.t += STEP;
      if (c.pop > 0) {
        /* popped from a block or a foe: arc up, then fly into the hero */
        c.vy += 1500 * STEP;
        c.x += c.vx * STEP;
        c.y += c.vy * STEP;
        c.pop -= STEP;
        if (c.pop <= 0)
          c.pull = true;
        continue;
      }
      const dx = px - c.x, dy = py - c.y;
      const d2 = dx * dx + dy * dy;
      if (!c.pull && magnet > 0 && d2 < magnet * magnet)
        c.pull = true;
      if (c.pull) {
        const d = Math.max(1, Math.sqrt(d2));
        const sp = 260 + c.t * 400;
        c.x += dx / d * Math.min(d, sp * STEP);
        c.y += dy / d * Math.min(d, sp * STEP);
      }
      if (d2 < 30 * 30)
        takeCoin(c);
    }
    for (const g of r.gems) {
      if (g.taken)
        continue;
      const dx = px - g.x, dy = py - g.y;
      if (dx * dx + dy * dy < 34 * 34)
        takeGem(g);
    }
    for (const it of r.items) {
      if (it.taken)
        continue;
      Ent.updateBlockItem(it, STEP);
      if (Ent.itemTouches(it, p))
        takeItem(it);
    }
    for (const cp of r.checkpoints) {
      if (cp.on)
        continue;
      if (Math.abs(px - cp.x) < 30 && p.y + p.h > cp.y - 110 && p.y < cp.y)
        touchCheckpoint(cp);
    }
    if ((!r.boss || r.bossDone) && Math.abs(px - r.goal.x) < 34 && p.y + p.h > r.goal.y - 130 && p.y < r.goal.y)
      Finish.reachGoal();
  }

  function takeCoin(c) {
    const r = G.run;
    c.taken = true;
    r.coinsRun += G.stats.coinMul;
    Fx.coin(fxWorld, c.x, c.y);
    sfx('coin', { volume: 0.5, pitch: 1 + (r.coinsRun % 5) * 0.03 });
  }

  function takeGem(g) {
    const r = G.run;
    g.taken = true;
    r.gemsRun[g.i] = true;
    if (r.mode === 'endless')
      r.gemBank++;
    Fx.gem(fxWorld, g.x, g.y, GEM_COLORS[g.i]);
    hitStop.hit(0.06);
    shake.add(0.15);
    flash.fire(GEM_COLORS[g.i], 0.15, 3);
    sfx('levelup', { pitch: 1.2 });
    const n = r.gemsRun.filter(Boolean).length;
    Session.showToast((g.old ? 'Gem found again' : 'Hidden gem found!') + '  ' + n + ' / 3', GEM_COLORS[g.i]);
  }

  function takeItem(it) {
    const r = G.run, p = r.player;
    it.taken = true;
    Fx.gem(fxWorld, it.x, it.y, it.kind === 'fire' ? '#ff8a3a' : it.kind === 'star' ? '#ffe14a' : '#ff6a86');
    sfx('powerup');
    if (it.kind === 'fire') {
      r.fire = true;
      Session.showToast('Fireballs! Press C or F', '#ff8a3a');
    } else if (it.kind === 'star') {
      r.star = STAR_TIME;
      Session.showToast('Invincible!', '#ffe14a');
    } else {
      r.hearts = Math.min(r.maxHearts, r.hearts + 1);
      Session.showToast('+1 heart', '#ff6a86');
    }
    texts.add(p.x + p.w / 2, p.y - 10, it.kind === 'heart' ? '+1' : it.kind.toUpperCase(), { color: '#ffffff', size: 18 });
  }

  function touchCheckpoint(cp) {
    const r = G.run, p = r.player;
    for (const o of r.checkpoints)
      if (o.x < cp.x)
        o.on = true;
    cp.on = true;
    cp.t = 0;
    r.respawn = { x: cp.x - p.w / 2, y: cp.y - p.h };
    r.safe = { x: r.respawn.x, y: r.respawn.y };
    Fx.checkpoint(fxWorld, cp.x, cp.y - 70, WORLDS[r.world].color);
    sfx('powerup', { pitch: 1.2 });
    if (G.stats.mender && r.hearts < r.maxHearts) {
      r.hearts = r.maxHearts;
      Session.showToast('Checkpoint - hearts restored', '#ff6a86');
    } else {
      Session.showToast('Checkpoint', WORLDS[r.world].color);
    }
    if (G.stats.shield)
      r.shield = true;
  }

  /* ── ghosts ── */

  function recordGhost() {
    const r = G.run;
    if (r.mode !== 'adventure' && r.mode !== 'trial')
      return;
    r.ghostT += STEP;
    if (r.ghostT >= 1 / Prog.GHOST_HZ - 1e-9) {
      r.ghostT -= 1 / Prog.GHOST_HZ;
      const p = r.player;
      if (r.ghostRec.length < 20 * 60 * 6)
        r.ghostRec.push({ x: p.x + p.w / 2, y: p.y + p.h, pose: Ph.poseOf(p), facing: p.facing });
    }
  }

  Object.assign(NS.module('pickups'), {
    updateItems,
    recordGhost
  });
})();
