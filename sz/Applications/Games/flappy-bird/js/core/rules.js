;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Pure game rules and tunables derived from the upgrades, the bird and the run:
     gravity, radii, coin value, combo multiplier, medals. Reads G (run, power, bird), never writes. */

  const { GRAVITY, BIRD_RADIUS, MEDAL_TIERS } = NS.C;
  const G = NS.state;
  const Prog = NS.progress;

  function getMedal(s) {
    for (const tier of MEDAL_TIERS)
      if (s >= tier.min)
        return tier;
    return null;
  }

  function maxHearts() {
    return 1 + Prog.treeLevel('a_heart') + (Prog.currentBird() === 'snowy' ? 1 : 0);
  }

  function runSpeed() {
    return G.mode === 'adventure'
      ? SZ.FlappyCourse.STAGES[G.stageIndex].speed
      : SZ.FlappyCourse.endlessParams(G.score).speed;
  }

  function powerDuration(kind) {
    return ({ magnet: 8, slow: 5, ghost: 4, double: 10, tiny: 8 }[kind] || 0) * (1 + 0.2 * Prog.treeLevel('p_long'));
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
    return 1 + 0.1 * Prog.treeLevel('m_value') + (Prog.currentBird() === 'pip' ? 0.15 : 0);
  }

  /* Holding the flap while falling sinks the bird slower (Glide upgrade) */
  function glideActive() {
    return Prog.treeLevel('w_glide') > 0 && G.flapHeld && G.bird.vy > 0;
  }

  function gravityNow() {
    return GRAVITY * (1 - 0.04 * Prog.treeLevel('w_light')) * (Prog.currentBird() === 'ruby' ? 0.94 : 1) * (glideActive() ? 0.65 : 1);
  }

  function comboMult() {
    return G.combo >= 20 ? 4 : G.combo >= 10 ? 3 : G.combo >= 5 ? 2 : 1;
  }

  function coinValue() {
    return coinBonus() * (G.power.double > 0 ? 2 : 1) * comboMult();
  }

  function birdRadius() {
    return G.power.tiny > 0 ? BIRD_RADIUS * 0.65 : BIRD_RADIUS;
  }

  /* Circle (cx, cy, r) against axis-aligned rect (x, y, w, h) */
  function circleRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  Object.assign(NS.rules, {
    getMedal, maxHearts, runSpeed, powerDuration, magnetRadius, perfectBand, coinBonus, glideActive,
    gravityNow, comboMult, coinValue, birdRadius, circleRect
  });
})();
