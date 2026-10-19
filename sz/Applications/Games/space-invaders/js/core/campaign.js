;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * The campaign as pure data and pure functions: six sectors of five stages
   * each, per-stage difficulty, star rules, credit rewards and seeded random
   * helpers. No DOM, no canvas - safe to require from node for testing.
   */

  const SECTORS = Object.freeze([
    Object.freeze({ id: 1, name: 'Lunar Orbit', theme: 'moon', boss: Object.freeze({ name: 'Crater Warden', color: '#c8d0e0' }) }),
    Object.freeze({ id: 2, name: 'Mars Front', theme: 'mars', boss: Object.freeze({ name: 'Rust Colossus', color: '#ff6a3a' }) }),
    Object.freeze({ id: 3, name: 'Asteroid Belt', theme: 'asteroids', boss: Object.freeze({ name: 'Rock Hive', color: '#c9a36a' }) }),
    Object.freeze({ id: 4, name: 'Jupiter Storm', theme: 'jupiter', boss: Object.freeze({ name: 'Storm Leviathan', color: '#ffb36a' }) }),
    Object.freeze({ id: 5, name: 'Saturn Rings', theme: 'saturn', boss: Object.freeze({ name: 'Ring Sentinel', color: '#e8d48a' }) }),
    Object.freeze({ id: 6, name: 'Mothership', theme: 'mothership', boss: Object.freeze({ name: 'The Overmind', color: '#c04cff' }) })
  ]);

  /* Which of the twelve wave formations each non-boss stage marches in. */
  const FORMATION_PLAN = Object.freeze([
    Object.freeze([0, 1, 2, 3]),
    Object.freeze([4, 5, 0, 6]),
    Object.freeze([7, 8, 10, 3]),
    Object.freeze([9, 11, 5, 2]),
    Object.freeze([6, 10, 7, 11]),
    Object.freeze([8, 9, 11, 4])
  ]);

  const STAGES = [];
  for (let s = 0; s < SECTORS.length; ++s) {
    for (let k = 0; k < 5; ++k) {
      const d = s * 5 + k;
      STAGES.push(Object.freeze({
        id: `${s + 1}-${k + 1}`,
        sector: s,
        stage: k,
        name: k === 4 ? SECTORS[s].boss.name : `${SECTORS[s].name} ${k + 1}`,
        theme: SECTORS[s].theme,
        formation: k === 4 ? null : FORMATION_PLAN[s][k],
        speed: +(1 + 0.06 * d).toFixed(2),          // alien march speed factor
        fire: +(1 + 0.05 * d).toFixed(2),           // alien fire-rate factor
        armored: s < 2 ? 0 : Math.min(0.5, 0.12 * (s - 1) + 0.03 * k),   // share of bottom-row aliens upgraded to armored (2 HP)
        boss: k === 4 ? Object.freeze({ design: s, hp: 30 + 22 * s, name: SECTORS[s].boss.name, color: SECTORS[s].boss.color }) : null,
        escorts: k === 4 ? Math.min(3, s) : 0
      }));
    }
  }

  function stageIndexById(id) {
    for (let i = 0; i < STAGES.length; ++i)
      if (STAGES[i].id === id)
        return i;
    return -1;
  }

  function nextStage(id) {
    const i = stageIndexById(id);
    return i < 0 || i + 1 >= STAGES.length ? null : STAGES[i + 1];
  }

  function starsFor(stage, result) {
    if (!result.cleared)
      return 0;
    let stars = 1;
    if (result.livesLost === 0)
      ++stars;
    if (stage.boss ? result.bossSeconds <= 90 : result.maxMultiplier >= 3)
      ++stars;
    return stars;
  }

  function STAR_TEXT(stage) {
    return ['Clear the stage', 'Lose no life', stage.boss ? 'Defeat the boss within 90 s' : 'Reach a x3 combo'];
  }

  function creditsFor(score, stage, stars) {
    return Math.floor(score / 10) + (stage ? 50 + 25 * stage.sector + 20 * stars : 0);
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; ++i) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dailySeed(date) {
    const d = date || new Date();
    const p = n => String(n).padStart(2, '0');
    return hashSeed('invaders-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()));
  }

  function sectorUnlocked(stars, s) {
    return s === 0 || (stars[`${s}-5`] || 0) >= 1;
  }

  function stageUnlocked(stars, index) {
    return index === 0 || (stars[STAGES[index - 1].id] || 0) >= 1;
  }

  SZ.InvaderCampaign = Object.freeze({
    SECTORS: Object.freeze(SECTORS),
    STAGES: Object.freeze(STAGES),
    FORMATION_PLAN: Object.freeze(FORMATION_PLAN),
    stageIndexById,
    nextStage,
    starsFor,
    STAR_TEXT,
    creditsFor,
    rng,
    hashSeed,
    dailySeed,
    sectorUnlocked,
    stageUnlocked
  });
})();
