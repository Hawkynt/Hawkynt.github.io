/* The window status bar (score and distance of the open run, the wallet, the festival and what
   is happening now) and the High Scores dialog, which lists Arcade and Featured runs including
   the ones carried over from the old game. Only touches the DOM when something changed. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;

  const el = {};
  for (const id of ['statusRun', 'statusWallet', 'statusSeason', 'statusState']) el[id] = document.getElementById(id);
  let last = '';

  function stateText() {
    const run = G.run;
    switch (G.screen) {
      case 'playing':
      case 'paused':
        if (!run || run.demo) return 'Title';
        return (G.screen === 'paused' ? 'Paused - ' : '') + (run.mode === 'story' ? NS.worlds.stageById(run.stageId).name : NS.hud.MODE_NAMES[run.mode]);
      case 'map': return 'World map';
      case 'tree': return 'Tech tree';
      case 'wardrobe': return 'Collection';
      case 'journal': return 'Journal';
      case 'help': return 'How to play';
      case 'results': return 'Results';
      case 'cine': return 'Story';
      default: return 'Title';
    }
  }

  function set(id, text) {
    if (el[id] && el[id].textContent !== text) el[id].textContent = text;
  }

  function runText() {
    const run = G.run;
    if (!run || run.demo || !NS.screens.inRun()) return 'Level ' + G.save.level;
    return NS.rules.metres(run.p.x, run.x0) + ' m - ' + Math.floor(run.score) + ' pts';
  }

  function update() {
    if (!G.save) return;
    set('statusRun', runText());
    set('statusWallet', 'Coins: ' + G.save.coins + '  Gems: ' + G.save.gems);
    set('statusSeason', G.season ? G.season.name + ' - ' + G.save.season.tokens + ' tokens' : '');
    set('statusState', stateText());
  }

  let acc = 0;
  function tick(dt) {
    acc += dt || 0;
    if (acc < 0.25) return;
    acc = 0;
    const key = G.screen + '|' + runText() + '|' + G.save.coins + '|' + G.save.gems + '|' + G.save.season.tokens;
    if (key !== last) {
      last = key;
      update();
    }
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body || !SZ.Dialog) return;
    body.innerHTML = '';
    const list = G.save.scores;
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No scores yet - try Arcade.';
      tr.appendChild(td);
      body.appendChild(tr);
    }
    for (let k = 0; k < list.length; ++k) {
      const tr = document.createElement('tr');
      const e = list[k];
      const cells = [k + 1, e.score, e.dist + ' m', e.mode === 'classic' ? 'Classic' : NS.hud.MODE_NAMES[e.mode] || e.mode];
      for (let c = 0; c < cells.length; ++c) {
        const td = document.createElement('td');
        td.textContent = String(cells[c]);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    SZ.Dialog.show('highScoresBackdrop').then((r) => {
      if (r === 'reset') {
        G.save.scores = [];
        NS.save.writeSave();
        showHighScores();
      }
    });
  }

  Object.assign(NS.statusBar, {
    update, tick, showHighScores
  });
})();
