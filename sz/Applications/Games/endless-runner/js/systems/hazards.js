/* Obstacles during a run: smashing one (dash, giant, shield, shockwave, guardian) with debris in
   the world's colours, score and combo; near misses - an obstacle that slid past within a
   hair's breadth - with their bonus, combo, text and a flick of slow motion; and the whoosh of
   saws, drones and rocks springing into motion as the runner closes in. Owns nothing; marks live
   on the obstacles. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const PH = NS.physics;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { WORLDS } = NS.worlds;

  const PB = {};
  const HB = {};

  function colorsFor(run, h) {
    const w = WORLDS[run.world];
    if (h.kind === 'proj') return [w.accent, '#ffffff'];
    return [w.ground[2], w.ground[1], w.deco, w.near];
  }

  function smash(run, h, how) {
    if (h.dead) return;
    h.dead = 1;
    const box = PH.hazardBox(Object.assign({}, h, { dead: 0 }), run.p.x, 0, HB);
    const cx = box ? (box.x0 + box.x1) / 2 : h.x, cy = box ? (box.y0 + box.y1) / 2 : C.GROUND_Y - 30;
    fx.debris(cx, cy, colorsFor(run, h), how === 'quake' ? 6 : 12, how === 'giant' ? 760 : 560);
    fx.burst(cx, cy, 10, '#ffffff', 300, 0.35, 18);
    fx.ring(cx, cy, 10, 90, 0.3, '#ffffff', 5);
    if (run.demo) return;
    NS.run.addScore(run, C.SMASH_SCORE, cx, cy - 30, how === 'quake' ? null : '#ffd24a');
    NS.run.bumpCombo(run, 3);
    ++run.smashes;
    NS.progress.count('smashes', 1);
    if (how !== 'quake') {
      sfx('smallExplode', { pitch: 1.1 + Math.random() * 0.3 });
      fx.shake(how === 'giant' ? 9 : 5);
      fx.hitstop(0.035);
    }
  }

  /* near misses and motion cues for the obstacles around the runner */
  function update(run) {
    const p = run.p;
    if (run.demo || p.fly) return;
    PH.playerBox(p, PB);
    const hz = run.course.hz;
    for (let i = PH.lowerBound(hz, p.x - 600); i < hz.length && hz[i].x < p.x + 900; ++i) {
      const h = hz[i];
      if (h.dead || h.nmDone) continue;
      /* moving obstacles announce themselves once */
      if (!h.cue && (h.kind === 'saw' || h.kind === 'drone' || h.kind === 'rock' || h.kind === 'roller') && h.x - p.x < 760) {
        h.cue = 1;
        sfx(h.kind === 'rock' ? 'drop' : h.kind === 'saw' ? 'zap' : 'whoosh', { volume: 0.35, pitch: h.kind === 'drone' ? 1.5 : 1 });
      }
      const b = PH.hazardBox(h, p.x, 0, HB);
      if (!b) continue;
      if (b.x1 < PB.x0) {
        h.nmDone = 1;
        if (h.nm !== undefined && h.nm < C.NEAR_GAP && p.invT <= 0 && !run.mods.ghost) nearMiss(run, h);
        continue;
      }
      if (b.x0 > PB.x1) continue;
      const gap = b.y1 <= PB.y0 ? PB.y0 - b.y1 : b.y0 >= PB.y1 ? b.y0 - PB.y1 : 0;
      if (h.nm === undefined || gap < h.nm) h.nm = gap;
    }
  }

  function nearMiss(run, h) {
    const p = run.p;
    ++run.nears;
    run.nearChain = run.t - (run.lastNear || -9) < 1.6 ? (run.nearChain || 0) + 1 : 1;
    run.lastNear = run.t;
    NS.progress.count('nears', 1);
    NS.run.addScore(run, Math.round(C.NEAR_SCORE * G.stats.nearMul), p.x, p.y - 110, null);
    NS.run.bumpCombo(run, 5);
    fx.text(p.x + 10, p.y - 140, run.nearChain > 1 ? 'CLOSE x' + run.nearChain : 'CLOSE!', '#5ee0ff', 26, 0.9);
    fx.spray(p.x - 10, p.y - 36, Math.PI, 1.2, 8, ['#5ee0ff', '#ffffff'], 380, 0.4, 10, fx.STREAK);
    sfx('whoosh', { pitch: 1.6, volume: 0.5 });
    G.slowmo = Math.max(G.slowmo, 0.12);
  }

  Object.assign(NS.hazards, {
    smash, update, colorsFor
  });
})();
