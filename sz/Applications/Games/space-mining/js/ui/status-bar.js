/* The window status bar (credits, research, hold or location, screen) refreshed a few times a
   second, the window title, and the High Scores dialog with reset. Reads G; writes only the
   DOM cells. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { MODES } = NS.goals;

  const cells = {
    credits: document.getElementById('statusCredits'),
    data: document.getElementById('statusData'),
    cargo: document.getElementById('statusCargo'),
    state: document.getElementById('statusState'),
  };
  const last = {};
  let t = 0;

  const NAMES = {
    title: 'Title', station: 'Kessler Station', map: 'Belt Map', tree: 'Tech Tree', help: 'How to Play',
    results: 'Trip Report', paused: 'Paused', playing: 'In flight', cine: 'Cinematic',
  };

  function set(k, v) {
    if (last[k] === v || !cells[k]) return;
    last[k] = v;
    cells[k].textContent = v;
  }

  function update() {
    const run = G.run;
    set('credits', 'Credits: ' + NS.kit.group(G.save.credits));
    set('data', 'Research: ' + G.save.rd);
    if (run) set('cargo', 'Hold: ' + Math.floor(run.cargoUsed) + ' / ' + run.cargoMax + '  -  ' + run.zone.name);
    else set('cargo', 'Belts: ' + G.save.licenses.length + ' / 5');
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
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet - try Gold Rush or the Daily Belt</td>';
      tbody.appendChild(tr);
    }
    for (let i = 0; i < list.length; ++i) {
      const s = list[i];
      const tr = document.createElement('tr');
      const row = [i + 1, s.score, MODES[s.mode] ? MODES[s.mode].name : s.mode === 'classic' ? 'Classic' : s.mode, s.detail || ''];
      for (let k = 0; k < row.length; ++k) {
        const td = document.createElement('td');
        td.textContent = String(row[k]);
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
