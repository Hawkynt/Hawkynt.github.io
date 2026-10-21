/* Enemy spawn selection: the level-gated candidate pool and the drone packs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;

  function spawnEnemy() {
    const lvl = NS.rules.getEffectiveLevel();
    const candidates = [];

    candidates.push('ufo');
    candidates.push(Math.random() < 0.5 ? 'ufo' : 'ufoSmall');

    if (lvl >= 5) candidates.push('drone', 'drone');
    if (lvl >= 8) candidates.push('gunship');
    if (lvl >= 11) candidates.push('minelayer');
    if (lvl >= 14) candidates.push('stealth');

    const type = candidates[Math.floor(Math.random() * candidates.length)];

    if (type === 'drone') {
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; ++i) {
        const d = NS.entities.createEnemy('drone');
        d.y = Math.random() * S.H;
        S.enemies.push(d);
      }
    } else
      S.enemies.push(NS.entities.createEnemy(type));
  }

  Object.assign(NS.spawn, { spawnEnemy });
})();
