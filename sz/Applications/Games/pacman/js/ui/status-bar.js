/* The window's status bar (score or shards, lives, where you are, the season) refreshed a few
   times a second, and the High Scores dialog with its reset. Owns the status bar text. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { WORLDS } = NS.worlds;
  const { MODES } = NS.items;

  const cells = {};
  let acc = 0;

  function cell(id) {
    if (!(id in cells)) cells[id] = document.getElementById(id);
    return cells[id];
  }

  function set(id, text) {
    const el = cell(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function group(n) {
    return NS.kit.group ? NS.kit.group(n) : String(n);
  }

  function update() {
    if (!G.profile) return;
    const run = G.run && !G.run.demo ? G.run : null;
    if (run) {
      set('statusScore', 'Score: ' + group(run.score) + '  x' + (run.mult || 1));
      set('statusLives', run.mode === 'zen' ? 'Zen' : 'Lives: ' + run.lives);
      const m = MODES.find(q => q.id === run.mode);
      set('statusLevel', run.mode === 'story' ? WORLDS[run.world].short + ' ' + (run.world + 1) + '-' + (run.stage + 1) : (m ? m.name : '') + ' ' + (run.n + 1));
    } else {
      set('statusScore', 'Shards: ' + group(G.profile.shards));
      set('statusLives', 'Streak: ' + G.profile.streak.count);
      set('statusLevel', G.screen === 'title' ? 'Title' : G.screen.charAt(0).toUpperCase() + G.screen.slice(1));
    }
    set('statusEffects', G.season ? G.season.name : '');
  }

  function tick(dt) {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    update();
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = '';
    const list = G.profile.highScores;
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    }
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      const tr = document.createElement('tr');
      const m = MODES.find(q => q.id === e.mode);
      const vals = [String(i + 1), group(e.score), m ? m.name : 'Classic', e.detail];
      for (let k = 0; k < vals.length; ++k) {
        const td = document.createElement('td');
        td.textContent = vals[k];
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    SZ.Dialog.show('highScoresBackdrop').then((r) => {
      if (r === 'reset') {
        G.profile.highScores = [];
        NS.save.writeProfile();
      }
    });
  }

  Object.assign(NS.statusBar, {
    update, tick, showHighScores
  });
})();
