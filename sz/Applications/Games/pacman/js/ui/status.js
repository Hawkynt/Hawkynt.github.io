;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  NS.status.updateStatus = function updateStatus() {
    statusScore.textContent = 'Score: ' + S.score;
    statusLives.textContent = 'Lives: ' + S.lives;
    statusLevel.textContent = 'Level: ' + S.level;
  }

  NS.status.updateEffectDisplay = function updateEffectDisplay(timestamp) {
    const el = document.getElementById('statusEffects');
    if (!el)
      return;

    if (!S.activePowerups || S.activePowerups.length === 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    const ts = timestamp || performance.now();
    const parts = S.activePowerups.map(ap => {
      const remaining = Math.max(0, Math.ceil((ap.expireTime - ts) / 1000));
      return ap.type.name + ' ' + remaining + 's';
    });
    el.textContent = parts.join(' | ');
  }

})();
