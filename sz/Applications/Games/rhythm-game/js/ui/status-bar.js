/* The window's status bar: score, combo and accuracy during a song, otherwise level, discs and
   stars; and the screen or song name. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const el = id => document.getElementById(id);
  const NAMES = { title: 'Title', modes: 'Modes', map: 'Story Map', library: 'Free Play', game: 'Playing', paused: 'Paused', results: 'Results', tree: 'Tech Tree',
    shop: 'Shop', wardrobe: 'Collection', journal: 'Journal', settings: 'Settings', help: 'How to Play' };

  let acc = 0;
  function update() {
    const r = G.run, p = G.profile;
    const set = (id, t) => { const e = el(id); if (e && e.textContent !== t) e.textContent = t; };
    if (r && r.mode !== 'demo' && (G.screen === 'game' || G.screen === 'paused')) {
      set('statusScore', 'Score: ' + r.eng.score.toLocaleString('en-US'));
      set('statusLevel', 'Combo: ' + r.eng.combo);
      set('statusLines', 'Accuracy: ' + (Math.round(NS.engine.accuracy(r.eng) * 1000) / 10).toFixed(1) + '%');
      set('statusState', (G.screen === 'paused' ? 'Paused - ' : '') + r.title);
    } else {
      set('statusScore', 'Level ' + p.level + (p.fame ? ' (Fame ' + p.fame + ')' : ''));
      set('statusLevel', 'Discs: ' + p.discs.toLocaleString('en-US'));
      set('statusLines', 'Stars: ' + NS.progress.starsTotal(p) + ' / 90');
      set('statusState', NAMES[G.screen] || G.screen);
    }
  }

  function tick(dt) {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    update();
  }

  Object.assign(NS.statusBar, { update, tick });
})();
