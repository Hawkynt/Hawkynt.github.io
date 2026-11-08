/* The window status bar: score, balls and wall of the game in play (or the profile's level,
   shards and stars elsewhere) and what is on screen, refreshed a few times a second. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;

  const el = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const NAMES = { title: 'Title', modes: 'Modes', map: 'Story map', game: 'Playing', paused: 'Paused', results: 'Results', tree: 'Tech tree', wardrobe: 'Collection', journal: 'Journal', help: 'How to play' };

  function set(id, text) {
    const e = el(id);
    if (e && e.textContent !== text) e.textContent = text;
  }

  function update() {
    const run = G.run;
    if (run && run.game && (G.screen === 'game' || G.screen === 'paused' || G.screen === 'results')) {
      set('statusScore', 'Score: ' + run.game.score.toLocaleString('en-US'));
      set('statusLevel', 'Balls: ' + (run.game.infinite ? 'unlimited' : run.game.lives + 1));
      set('statusLines', run.mode === 'story' ? 'Bricks: ' + NS.engine.remaining(run.game) : 'Wall: ' + run.wall);
    } else {
      set('statusScore', 'Player level ' + G.profile.level);
      set('statusLevel', 'Shards: ' + G.profile.shards.toLocaleString('en-US'));
      set('statusLines', 'Stars: ' + NS.progress.starsTotal(G.profile) + '/90');
    }
    set('statusState', G.cine ? 'Cinematic' : NAMES[G.screen] || '');
  }

  let acc = 0;
  function tick(dt) {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    update();
  }

  Object.assign(NS.statusBar, { update, tick });
})();
