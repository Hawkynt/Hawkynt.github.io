/* The mission runtime: starting runs in all four modes, setting up a stage (sector size, layout,
   hazards, player, allies, outposts, cores, boss), the wave spawner, objectives and their
   progress text, the convoy and the station, win and loss, multi-stage runs (daily, boss rush,
   endless) and the payout into the save with stars, bests and high scores.
   Owns G.run, G.stage, G.allies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { makeRng, dayKey, clamp } = NS.rng;
  const R = NS.rng.fx;
  const W = NS.waves;
  const { MISSION_TYPES, SECTORS } = NS.campaign;
  const rules = NS.rules;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  /* ── runs ── */
  function startRun(mode, opts) {
    G.mode = mode;
    NS.save.refreshStats();
    NS.combat.resetScore();
    G.player = null;
    let first;
    if (mode === 'campaign') {
      first = W.campaignStage(opts.sector, opts.index);
      G.run = { mode: mode, sector: opts.sector, index: opts.index, stages: [first], idx: 0 };
    } else if (mode === 'endless') {
      first = W.endlessStage(1);
      G.run = { mode: mode, wave: 1, stages: null, idx: 0 };
    } else if (mode === 'daily') {
      const plan = W.dailyPlan(dayKey());
      G.run = { mode: mode, plan: plan, stages: plan.stages, idx: 0, day: plan.day };
      first = plan.stages[0];
    } else {
      const plan = W.bossRushPlan();
      G.run = { mode: mode, stages: plan.stages, idx: 0 };
      first = plan.stages[0];
    }
    G.run.time = 0;
    G.run.cleared = 0;
    ++G.save.stats.runs;
    startStage(first);
    NS.screens.setScreen('playing');
  }

  function clearWorld() {
    NS.enemies.clear();
    NS.projectiles.clearAll();
    NS.fx.clear();
    G.pickups.length = 0;
    G.allies.length = 0;
    G.zones.length = 0;
    G.beams.length = 0;
    G.rails.length = 0;
    G.arcs.length = 0;
    G.boss = null;
    G.warp = 0;
    G.slowMo = 0;
    G.hitStop = 0;
  }

  function startStage(st) {
    const carry = G.player && G.player.alive && G.run && G.run.idx > 0 ? G.player : null;
    G.stage = st;
    G.sector = st.sector;
    G.world.w = st.size;
    G.world.h = st.size;
    clearWorld();
    if (!carry) G.drones.length = 0;
    NS.combat.resetGrid(st.size, st.size);
    NS.backdrop.setSector(st.sector);
    const L = W.layoutStage(st);
    NS.hazards.setup(L, st);

    if (carry) {
      /* the next stage of a run: keep the ship, mend half of the damage, refill */
      carry.x = L.start.x;
      carry.y = L.start.y;
      carry.vx = carry.vy = 0;
      carry.hull = Math.min(carry.maxHull, carry.hull + (carry.maxHull - carry.hull) * 0.5);
      carry.shield = carry.maxShield;
      carry.ammo = carry.maxAmmo;
      carry.iframes = 1.5;
    } else {
      NS.player.create(L.start.x, L.start.y);
      for (let i = 0; i < G.stats.escortDrones; ++i) NS.weapons.spawnDrone(G.player, Infinity, true);
    }

    const rt = st.rt = {
      t: 0, wave: 0, nextWave: 2.5, done: false, failed: false, endT: 0, rng: makeRng(st.seed ^ 0x51ed1),
      timeLeft: st.time, coresGot: 0, cores: 0, outposts: 0, outpostsLeft: 0, bossDelay: 1.6, bossSpawned: false,
      waveEnemies: 0, breakT: 0, reason: '',
    };
    G.allies.length = 0;
    if (st.type === 'defend') {
      G.allies.push({
        alive: true, kind: 'ally', type: 'station', x: L.station.x, y: L.station.y, vx: 0, vy: 0, r: 64,
        hp: 1000 * (1 + st.sector * 0.4), maxHp: 1000 * (1 + st.sector * 0.4), flash: 0, angle: 0, hurtT: 0,
      });
    } else if (st.type === 'escort') {
      const r0 = L.route[0];
      G.allies.push({
        alive: true, kind: 'ally', type: 'freighter', x: r0.x, y: r0.y, vx: 0, vy: 0, r: 46,
        hp: 650 * (1 + st.sector * 0.25), maxHp: 650 * (1 + st.sector * 0.25), flash: 0, angle: 0, hurtT: 0,
        route: L.route, leg: 1, speed: Math.max(58, st.len / 44), progress: 0,
      });
      rt.gate = L.route[L.route.length - 1];
    } else if (st.type === 'destroy') {
      for (let i = 0; i < L.outposts.length; ++i) {
        const o = L.outposts[i];
        const e = NS.enemies.spawn('station', o.x, o.y, { objective: true, instant: true });
        if (e) ++rt.outposts;
        const guards = 1 + Math.floor(st.sector / 2);
        for (let k = 0; k < guards; ++k)
          NS.enemies.spawn(st.roster[k % 2], o.x + (R() - 0.5) * 300, o.y + (R() - 0.5) * 300, {});
      }
      rt.outpostsLeft = rt.outposts;
    } else if (st.type === 'collect') {
      for (let i = 0; i < L.cores.length; ++i) NS.pickups.add('core', L.cores[i].x, L.cores[i].y, 1);
      rt.cores = L.cores.length;
    }
    if (st.type === 'boss') rt.nextWave = 14;

    NS.camera.snap();
    const tname = MISSION_TYPES[st.type].name;
    G.banner = {
      title: st.name.toUpperCase(),
      sub: st.type === 'endless' ? SECTORS[st.sector].name : tname + ' - ' + objectiveGoal(st),
      t: 0, life: 3, color: SECTORS[st.sector].theme.accent,
    };
    sfx('whoosh', { pitch: 0.6 });
  }

  function objectiveGoal(st) {
    switch (st.type) {
      case 'survive': return 'survive ' + st.time + ' s';
      case 'defend': return 'hold for ' + st.time + ' s';
      case 'destroy': return 'destroy ' + st.n + ' outposts';
      case 'collect': return 'recover ' + st.n + ' data cores';
      case 'escort': return 'escort the freighter';
      case 'boss': return 'destroy the boss';
    }
    return '';
  }

  /* ── per step ── */
  function update(dt) {
    const st = G.stage;
    if (!st) return;
    const rt = st.rt;
    rt.t += dt;
    G.run.time += dt;
    if (G.warp > 0) G.warp -= dt;
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t > G.banner.life) G.banner = null;
    }
    updateAllies(dt);

    if (rt.done || rt.failed) {
      rt.endT += dt;
      if (rt.done && rt.endT > 0.3 && rt.endT < 2) mopUp();
      if (rt.endT > (rt.failed ? 2.4 : 2.6)) finishStage(rt.done);
      return;
    }

    spawnWaves(dt, st, rt);
    checkObjective(dt, st, rt);
    const p = G.player;
    if (p && !p.alive && !rt.failed) fail('Ship destroyed');
  }

  function hostileCount() {
    let n = 0;
    for (let i = 0; i < G.enemies.length; ++i)
      if (G.enemies[i].alive && !G.enemies[i].objective && G.enemies[i].type !== 'turret') ++n;
    return n;
  }

  function spawnWaves(dt, st, rt) {
    if (st.type === 'endless') {
      if (rt.breakT > 0) {
        rt.breakT -= dt;
        if (rt.breakT <= 0) rt.nextWave = rt.t;
        return;
      }
      if (rt.wave === 0 && rt.t >= rt.nextWave) {
        spawnWave(st, rt, 0);
        if (st.boss) {
          const p = G.player;
          NS.bosses.spawn(st.boss, clamp(p.x, 500, st.size - 500), clamp(p.y - 620, 400, st.size - 400));
        } else
          spawnWave(st, rt, 1);
        rt.wave = 1;
        rt.waveEnd = rt.t + 25;
      }
      return;
    }
    if (st.type === 'boss' && !rt.bossSpawned) {
      rt.bossDelay -= dt;
      if (rt.bossDelay <= 0) {
        rt.bossSpawned = true;
        const p = G.player;
        NS.bosses.spawn(st.boss, clamp(p.x, 500, st.size - 500), clamp(p.y - 620, 400, st.size - 400));
      }
    }
    if (rt.t < rt.nextWave) return;
    rt.nextWave = rt.t + st.period;
    if (hostileCount() >= st.maxAlive) return;
    spawnWave(st, rt, rt.wave);
    ++rt.wave;
  }

  function spawnWave(st, rt, idx) {
    const budget = Math.round(st.budget + st.growth * idx);
    const groups = W.composeWave(rt.rng, st.roster, budget, idx + (st.type === 'endless' ? st.index : 0));
    const p = G.player;
    const ally = G.allies[0];
    for (let g = 0; g < groups.length; ++g) {
      const anchor = ally && ally.alive && rt.rng() < 0.5 ? ally : p;
      if (!anchor) continue;
      const sp = W.spawnPoint(rt.rng, st.size, anchor.x, anchor.y, 820, 1100);
      for (let k = 0; k < groups[g].count; ++k)
        NS.enemies.spawn(groups[g].type, sp.x + (rt.rng() - 0.5) * 160, sp.y + (rt.rng() - 0.5) * 160, {});
    }
  }

  function checkObjective(dt, st, rt) {
    switch (st.type) {
      case 'survive':
      case 'defend':
        rt.timeLeft -= dt;
        if (rt.timeLeft <= 0) { rt.timeLeft = 0; win(); }
        break;
      case 'destroy':
        if (rt.outpostsLeft <= 0) win();
        break;
      case 'collect':
        if (rt.coresGot >= rt.cores) win();
        break;
      case 'escort': {
        const a = G.allies[0];
        if (a && a.alive && a.leg >= a.route.length) win();
        break;
      }
      case 'boss':
        if (rt.bossSpawned && G.boss && !G.boss.alive) win();
        break;
      case 'endless': {
        const b = G.boss;
        const bossDone = !st.boss || (b && !b.alive);
        const left = hostileCount();
        if (rt.wave > 0 && bossDone && (left === 0 || (!st.boss && rt.t > rt.waveEnd && left < 6)))
          endlessNext(st, rt);
        break;
      }
    }
  }

  /* Endless: the next wave arrives after a short breather (bosses on the fifth) */
  function endlessNext(st, rt) {
    const n = G.run.wave + 1;
    G.run.wave = n;
    G.run.cleared = n - 1;
    NS.combat.addScore(400 * (n - 1), G.player.x, G.player.y);
    const next = W.endlessStage(n);
    if (next.sector !== st.sector) {
      /* a new sector: carry the ship over to fresh scenery */
      G.run.idx = 1;
      startStage(next);
      next.rt.nextWave = 2.5;
      return;
    }
    G.stage = Object.assign(next, { rt: rt, size: st.size });
    if (G.boss && !G.boss.alive) G.boss = null;
    rt.wave = 0;
    rt.breakT = 2.5;
    G.banner = { title: 'WAVE ' + n, sub: 'Incoming', t: 0, life: 2, color: '#5cff9a' };
    sfx('levelup', { volume: 0.6 });
  }

  function updateAllies(dt) {
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      if (a.flash > 0) a.flash -= dt;
      if (a.hurtT > 0) a.hurtT -= dt;
      if (!a.alive) continue;
      if (a.type === 'station') {
        a.angle += dt * 0.2;
        /* point defence: the station's own guns pick off what comes close */
        a.cd = (a.cd || 0) - dt;
        if (a.cd <= 0) {
          a.cd = 0.4;
          const t = NS.weapons.nearestTarget(a.x, a.y, 520, 0, 0);
          if (t && t.kind !== 'boss' && t.kind !== 'part') {
            const ang = Math.atan2(t.y - a.y, t.x - a.x);
            NS.projectiles.player('bolt', a.x + Math.cos(ang) * 60, a.y + Math.sin(ang) * 60, Math.cos(ang) * 820, Math.sin(ang) * 820, 0.75, 9 * (1 + G.stage.sector * 0.15), 4, 'green');
          }
        }
        continue;
      }
      /* the freighter follows its route; it slows down while under fire */
      if (a.leg >= a.route.length) continue;
      const tgt = a.route[a.leg];
      const dx = tgt.x - a.x, dy = tgt.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const speed = a.speed * (a.hurtT > 0 ? 0.7 : 1);
      if (d < 20) {
        ++a.leg;
        continue;
      }
      a.angle = NS.rng.turnToward(a.angle, Math.atan2(dy, dx), dt * 1.2);
      a.vx = Math.cos(a.angle) * speed;
      a.vy = Math.sin(a.angle) * speed;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.progress = Math.min(1, (a.leg - 1 + (1 - d / Math.max(1, legLength(a)))) / (a.route.length - 1));
      if (R() < 0.6)
        fx.exhaust(a.x - Math.cos(a.angle) * 50, a.y - Math.sin(a.angle) * 50, -a.vx, -a.vy, 10, '#8ad8ff', null);
    }
  }

  function legLength(a) {
    const p = a.route[a.leg - 1], q = a.route[a.leg];
    return Math.sqrt((q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y));
  }

  /* After a win, stragglers blow up in a satisfying chain */
  function mopUp() {
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive && R() < 0.06) NS.combat.kill(e, null);
    }
  }

  function win() {
    const rt = G.stage.rt;
    if (rt.done || rt.failed) return;
    rt.done = true;
    rt.endT = 0;
    rt.endAt = rt.t;
    NS.projectiles.clearEnemyBullets(G.cam.x, G.cam.y, 5000);
    /* the tractor sweeps up the loot for the trip home */
    if (G.player && G.player.alive) G.player.magnet = Math.max(G.player.magnet, 6);
    G.banner = { title: 'MISSION COMPLETE', sub: '', t: 0, life: 2.6, color: '#5cff9a' };
    sfx('win');
  }

  function fail(reason) {
    const rt = G.stage.rt;
    if (rt.done || rt.failed) return;
    rt.failed = true;
    rt.reason = reason;
    rt.endT = 0;
    rt.endAt = rt.t;
    G.banner = { title: G.mode === 'endless' ? 'GAME OVER' : 'MISSION FAILED', sub: reason, t: 0, life: 2.6, color: '#ff5c6c' };
  }

  /* ── events from other systems ── */
  function outpostDestroyed() {
    const rt = G.stage.rt;
    --rt.outpostsLeft;
    G.banner = { title: 'OUTPOST DESTROYED', sub: rt.outpostsLeft > 0 ? rt.outpostsLeft + ' remaining' : '', t: 0, life: 1.8, color: '#ffd25a' };
    fx.shake(0.6);
  }

  /* every recovered core trips an alarm: a small ambush jumps in around the pilot */
  function coreCollected() {
    const st = G.stage, rt = st.rt;
    ++rt.coresGot;
    NS.combat.addScore(300, G.player.x, G.player.y);
    if (rt.coresGot >= rt.cores) return;
    const n = 2 + Math.floor(st.sector / 2) + (rt.coresGot % 2);
    const sp = W.spawnPoint(rt.rng, st.size, G.player.x, G.player.y, 650, 800);
    for (let i = 0; i < n; ++i)
      NS.enemies.spawn(st.roster[(rt.coresGot + i) % Math.min(3, st.roster.length)], sp.x + (rt.rng() - 0.5) * 140, sp.y + (rt.rng() - 0.5) * 140, {});
    G.banner = { title: 'AMBUSH', sub: rt.coresGot + ' / ' + rt.cores + ' cores recovered', t: 0, life: 1.6, color: '#ff8a5c' };
  }

  function allyDestroyed(a) {
    fail(a.type === 'freighter' ? 'The freighter was destroyed' : 'The station was destroyed');
  }

  /* Abandon from the pause menu: keep the scrap you collected, nothing else */
  function abandon() {
    if (!G.stage) return;
    G.stage.rt.failed = true;
    G.stage.rt.reason = 'Abandoned';
    finishStage(false, true);
  }

  /* ── end of stage ── */
  function finishStage(won, abandoned) {
    const st = G.stage;
    const run = G.run;
    const p = G.player;
    const save = G.save;
    if (won) ++run.cleared;
    /* multi-stage runs continue */
    if (won && run.stages && run.idx < run.stages.length - 1) {
      ++run.idx;
      NS.combat.addScore(1500 * run.idx, p.x, p.y, true);
      startStage(run.stages[run.idx]);
      return;
    }
    const flown = st.rt.endAt !== undefined ? st.rt.endAt : st.rt.t;
    const res = {
      won: won, mode: run.mode, stage: st, title: '', stars: 0, prevStars: 0, time: Math.round(run.mode === 'campaign' ? flown : run.time),
      kills: G.kills, bestCombo: G.bestCombo, score: G.score, collected: G.runScrap, reward: 0, total: 0,
      newBest: false, hullFrac: p ? p.hull / p.maxHull : 0, reason: st.rt.reason, waves: 0, abandoned: !!abandoned,
      t: 0,
    };
    if (run.mode === 'campaign') {
      const id = st.id;
      res.prevStars = save.stars[id] || 0;
      res.stars = rules.missionStars(won, res.hullFrac, flown, st.par);
      res.reward = abandoned ? 0 : rules.missionReward(st.sector, st.index, res.stars, res.prevStars);
      if (res.stars > res.prevStars) save.stars[id] = res.stars;
      if (won && (!save.times[id] || flown < save.times[id])) save.times[id] = Math.round(flown);
      if (won) ++save.stats.missions;
      res.title = won ? 'Mission Complete' : 'Mission Failed';
    } else {
      res.reward = abandoned ? 0 : rules.scoreScrap(G.score, G.stats);
      if (run.mode === 'endless') {
        res.waves = run.cleared;
        res.title = 'Wave ' + run.wave + ' reached';
        if (G.score > save.best.endless.score) { save.best.endless.score = G.score; res.newBest = true; }
        save.best.endless.wave = Math.max(save.best.endless.wave, run.cleared);
      } else if (run.mode === 'daily') {
        res.title = won ? 'Gauntlet Cleared' : 'Gauntlet Over';
        res.waves = run.cleared;
        if (save.best.daily.date !== run.day || G.score > save.best.daily.score) {
          res.newBest = save.best.daily.date !== run.day || G.score > save.best.daily.score;
          save.best.daily = { date: run.day, score: Math.max(G.score, save.best.daily.date === run.day ? save.best.daily.score : 0) };
        }
      } else {
        res.title = won ? 'All Bosses Destroyed' : 'Boss Rush Over';
        res.waves = run.cleared;
        if (G.score > save.best.bossRush.score) { save.best.bossRush.score = G.score; res.newBest = true; }
        save.best.bossRush.cleared = Math.max(save.best.bossRush.cleared, run.cleared);
      }
      if (G.score > 0 && !abandoned)
        rules.addHighScore(save, { score: G.score, wave: run.mode === 'endless' ? run.wave : run.cleared, mode: run.mode, date: dayKey() });
    }
    res.total = res.collected + res.reward;
    save.credits += res.total;
    save.stats.scrap += res.total;
    NS.save.writeSave();
    G.ui.results = res;
    NS.screens.setScreen('results');
  }

  function downloading() {
    for (let i = 0; i < G.pickups.length; ++i)
      if (G.pickups[i].type === 'core' && G.pickups[i].linked) return true;
    return false;
  }

  function progressText() {
    const st = G.stage;
    if (!st) return '';
    const rt = st.rt;
    switch (st.type) {
      case 'survive': return 'Survive  ' + Math.ceil(rt.timeLeft) + ' s';
      case 'defend': return 'Hold the station  ' + Math.ceil(rt.timeLeft) + ' s';
      case 'destroy': return 'Outposts  ' + (rt.outposts - rt.outpostsLeft) + ' / ' + rt.outposts;
      case 'collect': return 'Data cores  ' + rt.coresGot + ' / ' + rt.cores + (downloading() ? '  -  downloading' : '');
      case 'escort': {
        const a = G.allies[0];
        return 'Convoy  ' + Math.round((a ? a.progress : 0) * 100) + '%';
      }
      case 'boss': return G.boss ? G.boss.def.name : 'Boss approaching';
      case 'endless': return 'Wave ' + G.run.wave + '  -  ' + hostileCount() + ' hostiles';
    }
    return '';
  }

  Object.assign(NS.missions, {
    startRun, startStage, update, outpostDestroyed, coreCollected, allyDestroyed, abandon, progressText,
    objectiveGoal, hostileCount, win, fail
  });
})();
