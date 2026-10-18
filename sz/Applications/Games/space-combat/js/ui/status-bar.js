/* The window status bar (score or scrap, stage, hull, screen) refreshed a few times a second,
   and the High Scores dialog with reset. Reads G; writes only the DOM cells. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { MODES } = NS.campaign;

  const cells = {
    score: document.getElementById('statusScore'),
    stage: document.getElementById('statusStage'),
    hull: document.getElementById('statusHull'),
    state: document.getElementById('statusState'),
  };
  const last = {};
  let t = 0;

  const NAMES = {
    title: 'Title', map: 'Sector Map', briefing: 'Briefing', hangar: 'Hangar', tree: 'Tech Tree', help: 'How to Play',
    results: 'Results', paused: 'Paused', playing: 'In flight',
  };

  function set(k, v) {
    if (last[k] === v || !cells[k]) return;
    last[k] = v;
    cells[k].textContent = v;
  }

  function update() {
    const p = G.player;
    const flying = G.screen === 'playing' || G.screen === 'paused';
    if (flying && G.stage) {
      set('score', 'Score: ' + G.score);
      set('stage', G.run && G.run.mode === 'endless' ? 'Wave: ' + G.run.wave : G.stage.name);
      set('hull', p ? 'Hull: ' + Math.max(0, Math.ceil(p.hull)) + ' / ' + p.maxHull : '');
    } else {
      set('score', 'Scrap: ' + G.save.credits);
      set('stage', 'Stars: ' + NS.rules.totalStars(G.save) + ' / 90');
      set('hull', '');
    }
    set('state', NAMES[G.screen] || '');
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
    tbody.innerHTML = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet</td>';
      tbody.appendChild(tr);
    }
    for (let i = 0; i < list.length; ++i) {
      const s = list[i];
      const tr = document.createElement('tr');
      const cellsHtml = [i + 1, s.score, s.wave || 0, MODES[s.mode] ? MODES[s.mode].name : (s.mode || '')];
      for (let k = 0; k < cellsHtml.length; ++k) {
        const td = document.createElement('td');
        td.textContent = String(cellsHtml[k]);
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
