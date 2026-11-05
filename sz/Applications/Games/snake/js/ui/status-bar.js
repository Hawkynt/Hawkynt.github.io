/* The window status bar (scales, story stars, the festival and what is happening now) and the
   High Scores dialog, which lists every mode's best runs including the ones carried over from
   the old game. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { MODES } = NS.items;
  const { WORLDS } = NS.worlds;

  const el = {};
  for (const id of ['statusScales', 'statusStars', 'statusSeason', 'statusState']) el[id] = document.getElementById(id);
  let last = '';

  function stateText() {
    const run = G.run;
    switch (G.screen) {
      case 'playing':
      case 'paused':
        if (!run || run.mode === 'demo') return 'Title';
        return (G.screen === 'paused' ? 'Paused - ' : '') + (run.mode === 'story' ? WORLDS[run.w].name + ' ' + (run.w + 1) + '-' + (run.l + 1) : MODES[run.mode].name);
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

  function update() {
    if (!G.save) return;
    set('statusScales', 'Scales: ' + G.save.scales);
    set('statusStars', 'Stars: ' + NS.rules.totalStars(G.save) + ' / 90');
    set('statusSeason', G.season ? G.season.name + ' - ' + NS.rules.eventRecord(G.save, G.eventId).tokens + ' tokens' : '');
    set('statusState', stateText());
  }

  /* cheap enough to call every frame: only touches the DOM when something changed */
  function tick() {
    const run = G.run;
    const key = G.screen + '|' + G.save.scales + '|' + (run ? run.mode : '') + '|' + (G.season ? NS.rules.eventRecord(G.save, G.eventId).tokens : '');
    if (key !== last) {
      last = key;
      update();
    }
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body || !SZ.Dialog) return;
    body.innerHTML = '';
    const list = G.save.highScores;
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No scores yet - try Arcade or Time Attack.';
      tr.appendChild(td);
      body.appendChild(tr);
    }
    for (let k = 0; k < list.length; ++k) {
      const tr = document.createElement('tr');
      const cells = [k + 1, list[k].score, list[k].mode + (list[k].detail ? ' - ' + list[k].detail : '')];
      for (let c = 0; c < cells.length; ++c) {
        const td = document.createElement('td');
        td.textContent = String(cells[c]);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    SZ.Dialog.show('highScoresBackdrop').then((r) => {
      if (r === 'reset') {
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
