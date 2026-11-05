/* The desktop window's status bar (gems, stage, lives, state) refreshed a few times a second,
   and the High Scores dialog listing every mode's table with a reset. Touches only the DOM
   outside the canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;

  const el = id => document.getElementById(id);
  const last = {};
  let t = 0;

  function set(id, text) {
    if (last[id] === text) return;
    last[id] = text;
    const e = el(id);
    if (e) e.textContent = text;
  }

  const STATE = { title: 'Title', map: 'World Map', cine: 'Cinematic', playing: 'Playing', paused: 'Paused', results: 'Results', tree: 'Tech Tree', wardrobe: 'Wardrobe', goals: 'Goals', stats: 'Statistics', help: 'How to Play' };

  function update() {
    const run = G.run;
    set('statusScore', 'Gems: ' + Math.floor(G.save.gems));
    if (run && run.level && !run.over) {
      set('statusLevel', run.level.name + '  -  ' + run.score + ' pts');
      set('statusLives', run.mode === 'zen' ? 'Zen' : 'Lives: ' + Math.max(0, run.lives));
    } else {
      set('statusLevel', 'Stars: ' + G.save.stats.stars + ' / 105');
      set('statusLives', G.season ? G.season.def.name : '');
    }
    set('statusState', STATE[G.screen] || G.screen);
  }

  function tick(dt) {
    t += dt;
    if (t < 0.25) return;
    t = 0;
    update();
  }

  async function showHighScores() {
    const tbody = el('highScoresBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const modes = [['arcade', 'Arcade'], ['daily', 'Daily'], ['rush', 'Boss Rush'], ['zen', 'Zen']];
    for (const [id, name] of modes) {
      const list = G.save.scores[id];
      for (let i = 0; i < Math.min(5, list.length); ++i) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + list[i].score + '</td><td>' + list[i].stage + '</td><td>' + name + '</td>';
        tbody.appendChild(tr);
      }
    }
    if (!tbody.children || !tbody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4">No scores yet - play Arcade!</td>';
      tbody.appendChild(tr);
    }
    const result = await SZ.Dialog.show('highScoresBackdrop');
    if (result === 'reset') {
      for (const [id] of modes) G.save.scores[id] = [];
      NS.save.writeSave();
    }
  }

  Object.assign(NS.statusBar, {
    update, tick, showHighScores
  });
})();
