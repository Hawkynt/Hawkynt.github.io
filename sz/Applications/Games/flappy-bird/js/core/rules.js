;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Pure game rules and tunables derived from the upgrades, the bird, the mode and the
     daily twist: gravity, radii, coin value, combo and arcade multipliers, power-up times,
     medals. Reads G (run, power, bird), never writes. */

  const { GRAVITY, BIRD_RADIUS, MEDAL_TIERS, POWER_BY_ID, MODES } = NS.C;
  const G = NS.state;
  const Prog = NS.progress;

  function getMedal(s) {
    for (const tier of MEDAL_TIERS)
      if (s >= tier.min)
        return tier;
    return null;
  }

  function twistActive() {
    return G.mode === 'daily' && G.twist ? G.twist : null;
  }

  function maxHearts() {
    // boss arenas lend two extra hearts: the Sky Tree's blessing
    const boss = G.mode === 'bossrush' || (G.mode === 'adventure' && SZ.FlappyCourse.STAGES[G.stageIndex].boss);
    return 1 + Prog.treeLevel('a_heart') + (Prog.currentBird() === 'snowy' ? 1 : 0) + (boss ? 2 : 0);
  }

  function runSpeed() {
    let s;
    if (G.mode === 'adventure')
      s = SZ.FlappyCourse.STAGES[G.stageIndex].speed;
    else if (G.mode === 'bossrush')
      s = 3;
    else
      s = SZ.FlappyCourse.endlessParams(G.score, G.mode === 'zen' ? 'zen' : G.mode === 'arcade' ? 'arcade' : 'endless').speed;
    const tw = twistActive();
    if (tw && tw.mods && tw.mods.speedScale)
      s *= tw.mods.speedScale;
    if (G.power.rush > 0)
      s *= 1.8;
    return s;
  }

  function powerDuration(kind) {
    const def = POWER_BY_ID[kind];
    let t = (def && def.time) || 0;
    if (kind === 'rush')
      t += Prog.treeLevel('w_rush');
    if (kind === 'freeze')
      t += 1.5 * Prog.treeLevel('p_freeze');
    return t * (1 + 0.2 * Prog.treeLevel('p_long'));
  }

  function blastCharges() {
    return 3 + Prog.treeLevel('p_blast');
  }

  function magnetRadius() {
    return Math.max(
      60 * Prog.treeLevel('m_magnet') + (Prog.currentBird() === 'jay' ? 50 : 0),
      G.power.magnet > 0 ? 190 * (1 + 0.5 * Prog.treeLevel('m_super')) : 0
    );
  }

  function perfectBand() {
    return 0.22 * (1 + 0.15 * Prog.treeLevel('s_eye'));
  }

  function coinBonus() {
    const bird = Prog.currentBird();
    const tw = twistActive();
    return (1 + 0.1 * Prog.treeLevel('m_value') + (bird === 'pip' ? 0.15 : 0) + (bird === 'goldie' ? 0.2 : 0) +
      (tw && tw.coinBonus ? tw.coinBonus : 0)) * (MODES[G.mode] ? MODES[G.mode].coinRate : 1);
  }

  /* Holding the flap while falling sinks the bird slower (Glide upgrade) */
  function glideActive() {
    return Prog.treeLevel('w_glide') > 0 && G.flapHeld && G.bird.vy > 0;
  }

  function gravityNow() {
    const tw = twistActive();
    return GRAVITY * (1 - 0.04 * Prog.treeLevel('w_light')) * (Prog.currentBird() === 'ruby' ? 0.94 : 1) *
      (glideActive() ? 0.65 : 1) * (tw && tw.gravity ? tw.gravity : 1);
  }

  function comboMult() {
    return G.combo >= 20 ? 4 : G.combo >= 10 ? 3 : G.combo >= 5 ? 2 : 1;
  }

  function coinValue() {
    return coinBonus() * (G.power.double > 0 ? 2 : 1) * (G.feverT > 0 ? 2 : 1) * comboMult();
  }

  function birdRadius() {
    return G.power.tiny > 0 ? BIRD_RADIUS * 0.65 : BIRD_RADIUS;
  }

  /* how much one PERFECT pass fills the fever meter */
  function feverGain() {
    return 0.2 * (1 + 0.25 * Prog.treeLevel('s_fever'));
  }

  function windScale() {
    if (Prog.currentBird() === 'corvus')
      return 0;
    return 1 - 0.4 * Prog.treeLevel('w_wind');
  }

  function crowScale() {
    return 1 - 0.2 * Prog.treeLevel('a_crow');
  }

  function crowsHarmless() {
    return Prog.currentBird() === 'corvus';
  }

  function tokenValue() {
    const festive = ['frosty', 'nova', 'blossom', 'surf', 'maple', 'jack'].indexOf(Prog.currentBird()) >= 0;
    return Math.round((1 + (festive ? 1 : 0)) * (1 + 0.5 * Prog.treeLevel('f_season')));
  }

  function orbRate() {
    return 1 + 0.15 * Prog.treeLevel('f_boss');
  }

  /* pipes are soft in Zen, and rushing birds pass through everything */
  function untouchable() {
    return G.power.rush > 0 || G.mode === 'zen';
  }

  /* Circle (cx, cy, r) against axis-aligned rect (x, y, w, h) */
  const circleRect = SZ.FlappyHazards.circleRect;

  Object.assign(NS.rules, {
    getMedal, twistActive, maxHearts, runSpeed, powerDuration, blastCharges, magnetRadius, perfectBand, coinBonus,
    glideActive, gravityNow, comboMult, coinValue, birdRadius, feverGain, windScale, crowScale, crowsHarmless,
    tokenValue, orbRate, untouchable, circleRect
  });
})();
