/* Attack waves on the outpost while you are in its belt: the wave timer, the next wave
   composed ahead of time (the Sensor Array shows it early, everyone sees it in the last 25
   seconds), the siren and banner, invaders arriving in clusters from one bearing, the boss
   mothership with its cinematic, clearing a wave (reward, counters, the first-wave
   cinematic), Siege victory after the last wave, and the mothership's fall. Reads and writes
   the wave fields of G.base. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ENEMY_BY_ID } = NS.fleetData;
  const { MODES } = NS.goals;
  const C = NS.colony;
  const rules = NS.rules;
  const R = NS.rng.fx;

  const WARN = 25;

  function compose() {
    const b = G.base;
    const no = b.data.wave + 1;
    const m = b.mods || NS.calendar.NEUTRAL;
    b.next = C.composeWave(no, b.zone, b.value, G.run.seed, { mode: b.mode, bossDone: b.data.bossDone, mul: m.waves, nano: m.nano });
    b.warned = false;
  }

  /* timer state after arrival or founding */
  function arm(first) {
    const b = G.base;
    if (!b) return;
    const iv = C.waveInterval(b.zone, b.mode);
    b.waveT = b.mode === 'siege' ? (first ? 50 : iv) : first ? iv * 0.85 : iv;
    b.active = false;
    b.spawnQ = [];
    compose();
  }

  function update(dt) {
    const b = G.base;
    if (!b || !NS.base.claimed() || b.data.abandoned) return;
    if (!b.next) compose();
    if (b.active) {
      flush(dt);
      b.activeT += dt;
      /* stragglers of a long wave break off: it counts as repelled */
      if (b.activeT > 150 && !b.spawnQ.length && NS.enemies.retreat(b.waveNo, b.entryX, b.entryY)) {
        NS.trip.banner('THE RAIDERS BREAK OFF', 'What is left of wave ' + b.waveNo + ' retreats', '#ffd25a');
      }
      if (!b.spawnQ.length && NS.enemies.count(e => e.wave === b.waveNo) === 0) cleared();
      return;
    }
    b.waveT -= dt;
    if (b.waveT <= WARN && !b.warned) {
      b.warned = true;
      NS.trip.banner('WAVE ' + b.next.wave + ' INBOUND', describe(b.next), b.next.faction === 'lattice' ? '#3affd0' : b.next.faction === 'alien' ? '#d080ff' : '#ff5c6c');
      NS.audio.sfx('zap', { volume: 0.7, pitch: 0.35 });
      NS.audio.sfx('blip', { volume: 0.5, pitch: 0.5 });
    }
    if (b.waveT <= 0) launch();
  }

  function describe(w) {
    const parts = [];
    for (let i = 0; i < w.groups.length; ++i) parts.push(w.groups[i].n + ' ' + ENEMY_BY_ID[w.groups[i].type].name + (w.groups[i].n > 1 ? 's' : ''));
    return parts.join(', ');
  }

  /* where a wave comes from: a point on its bearing well outside the outpost */
  function entry(angle) {
    const h = NS.base.hub();
    const W = G.world.w, H = G.world.h;
    let x = h.x + Math.cos(angle) * 1500, y = h.y + Math.sin(angle) * 1500;
    x = Math.max(80, Math.min(W - 80, x));
    y = Math.max(80, Math.min(H - 80, y));
    return { x: x, y: y };
  }

  function launch() {
    const b = G.base;
    const w = b.next;
    b.active = true;
    b.activeT = 0;
    b.waveNo = w.wave;
    b.spawnQ = [];
    const at = entry(w.angle);
    b.entryX = at.x;
    b.entryY = at.y;
    let t = 0;
    for (let i = 0; i < w.groups.length; ++i) {
      const g = w.groups[i];
      if (g.type === 'mothership') continue;
      for (let k = 0; k < g.n; ++k) {
        b.spawnQ.push({ type: g.type, t: t, x: at.x + (R() - 0.5) * 260, y: at.y + (R() - 0.5) * 260 });
        t += g.type === 'swarmer' ? 0.08 : 0.35;
      }
    }
    if (w.boss) {
      const p = entry(w.angle + 0.5);
      const e = NS.enemies.spawn('mothership', p.x, p.y, { wave: w.wave, hpMul: 1 + b.zone.index * 0.35 + (b.mode === 'siege' && w.wave > 10 ? 0.6 : 0) });
      e.angle = Math.atan2(NS.base.hub().y - p.y, NS.base.hub().x - p.x);
      NS.cinematics.play('bossArrival', { x: p.x, y: p.y, zone: b.zone });
    }
    NS.audio.sfx('explode', { volume: 0.4, pitch: 0.4 });
    b.next = null;
  }

  function flush(dt) {
    const b = G.base;
    for (let i = 0; i < b.spawnQ.length; ++i) b.spawnQ[i].t -= dt;
    while (b.spawnQ.length && b.spawnQ[0].t <= 0) {
      const q = b.spawnQ.shift();
      const e = NS.enemies.spawn(q.type, q.x, q.y, { wave: b.waveNo });
      const h = NS.base.hub();
      if (h) {
        e.angle = Math.atan2(h.y - q.y, h.x - q.x);
        e.vx = Math.cos(e.angle) * e.speed * 0.6;
        e.vy = Math.sin(e.angle) * e.speed * 0.6;
      }
      NS.fx.ring(q.x, q.y, 6, 40, 0.3, ENEMY_BY_ID[q.type].color, 2);
    }
  }

  function cleared() {
    const b = G.base;
    const run = G.run;
    b.active = false;
    b.data.wave = b.waveNo;
    const reward = Math.round(70 * b.waveNo * (0.6 + b.zone.danger * 0.4) * (b.mods ? b.mods.reward : 1) / 10) * 10;
    NS.base.wallet().credits += reward;
    if (run.mode === 'career') {
      rules.bump(G.save, 'earned', reward);
      rules.bump(G.save, 'waves', 1);
    }
    ++run.waves;
    run.rd += 1;
    NS.trip.banner('WAVE ' + b.waveNo + ' REPELLED', '+' + NS.kit.group(reward) + ' credits', '#5cff9a');
    NS.audio.sfx('win', { volume: 0.6 });
    const h = NS.base.hub();
    if (run.mode === 'career' && !G.save.cine.waveClear && h) {
      G.save.cine.waveClear = true;
      NS.cinematics.play('waveClear', { x: h.x, y: h.y, wave: b.waveNo });
    }
    if (b.mode === 'siege' && b.waveNo >= MODES.siege.waves) {
      run.siegeWon = true;
      NS.trip.banner('THE OUTPOST HOLDS', 'All ' + MODES.siege.waves + ' waves repelled', '#ffd25a');
      NS.trip.finish('victory', 3);
      return;
    }
    b.waveT = C.waveInterval(b.zone, b.mode);
    compose();
  }

  function bossDown(e) {
    const b = G.base;
    const run = G.run;
    if (b) b.data.bossDone = true;
    run.bosses = (run.bosses || 0) + 1;
    const reward = 2500 * (1 + (b ? b.zone.index : 0));
    if (run.mode !== 'rush' && run.mode !== 'daily') NS.base.wallet().credits += reward;
    if (run.mode === 'career') {
      rules.bump(G.save, 'bosses', 1);
      rules.bump(G.save, 'earned', reward);
    }
    run.rd += 6;
    for (let i = 0; i < 24; ++i) NS.mining.spawnNugget(e.x, e.y, i % 3 ? 'hiveJelly' : 'exotic', 1, null, 380);
    NS.fx.slowMo(2, 0.25);
    NS.fx.flash('#f0c8ff', 0.8);
    NS.fx.shake(1);
    NS.cinematics.play('bossDown', { x: e.x, y: e.y, reward: reward });
    NS.events.log('hive');
  }

  /* what the HUD shows of the next wave: null when it is still hidden */
  function preview() {
    const b = G.base;
    if (!b || !b.next || b.active) return null;
    const radar = b.data.buildings.some(o => o.type === 'radar' && o.prog >= 1 && !o.rogue && (o._eff || 0) > 0);
    return radar || b.waveT <= WARN ? b.next : { wave: b.next.wave, hidden: true, boss: b.next.boss, count: b.next.count };
  }

  Object.assign(NS.waves, {
    WARN, compose, arm, update, describe, launch, cleared, bossDown, preview, TAU
  });
})();
