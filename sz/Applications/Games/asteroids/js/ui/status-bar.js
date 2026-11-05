/* The window status bar (score or stardust, ships or stars, level or wave, screen) refreshed a
   few times a second, and the High Scores dialog with reset. Reads G; writes only DOM cells. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { MODES } = NS.campaign;

  const cells = {
    score: document.getElementById('statusScore'),
    lives: document.getElementById('statusLives'),
    level: document.getElementById('statusLevel'),
    mode: document.getElementById('statusMode'),
  };
  const last = {};
  let t = 0;

  const NAMES = {
    title: 'Title', map: 'World Map', story: 'Story', cine: 'Cinematic', tree: 'Tech Tree', wardrobe: 'Hangar', goals: 'Goals',
    help: 'How to Play', results: 'Results', paused: 'Paused', playing: 'In flight',
  };

  function set(k, v) {
    if (last[k] === v || !cells[k]) return;
    last[k] = v;
    cells[k].textContent = v;
  }

  function update() {
    const run = G.run;
    if (run && NS.screens.inRun()) {
      const fmt = NS.hud.fmt || String;
      set('score', 'Score: ' + fmt(G.score));
      set('lives', run.mode === 'zen' ? 'Zen' : 'Ships: ' + run.lives);
      set('level', run.mode === 'story' ? NS.campaign.levelKey(run.chapter, run.level) + ' ' + G.level.name : run.mode === 'rush' ? 'Titan ' + (run.rushIdx + 1) + ' / 5' : run.mode === 'zen' ? 'Drifting' : 'Wave ' + run.wave);
      set('mode', MODES[run.mode].name + ' - ' + (NAMES[G.screen] || ''));
    } else {
      set('score', 'Stardust: ' + G.save.dust);
      set('lives', 'Stars: ' + NS.rules.totalStars(G.save) + ' / 90');
      set('level', G.cal.seasonDef.name);
      set('mode', NAMES[G.screen] || '');
    }
  }

  function tick(dt) {
    t -= dt;
    if (t > 0) return;
    t = 0.25;
    update();
  }

  function showHighScores() {
    const list = G.save.highScores;
    const tbody = document.getElementById('highScoresBody');
    if (!tbody || !SZ.Dialog) return;
    tbody.innerHTML = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet</td>';
      tbody.appendChild(tr);
    }
    for (let i = 0; i < list.length; ++i) {
      const s = list[i];
      const tr = document.createElement('tr');
      const vals = [i + 1, s.score, s.wave || '-', s.legacy ? s.legacy : MODES[s.mode] ? MODES[s.mode].name : s.mode];
      for (let k = 0; k < vals.length; ++k) {
        const td = document.createElement('td');
        td.textContent = String(vals[k]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    SZ.Dialog.show('highScoresBackdrop').then((result) => {
      if (result === 'reset') {
        G.save.highScores = [];
        NS.save.writeSave();
        showHighScores();
      }
    });
  }

  Object.assign(NS.statusBar, {
    update, tick, showHighScores
  });
})();
