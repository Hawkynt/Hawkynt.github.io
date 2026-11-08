/* The page around the canvas: the window menu bar (title, pause, tech tree, wardrobe, journal,
   high scores, exit, help, controls, about), the status bar sections and the high score dialog
   with its reset. Owns no game state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const G = NS.state;
  const P = NS.progression;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  const el = (id) => document.getElementById(id);
  const last = {};

  function set(id, text) {
    if (last[id] === text) return;
    last[id] = text;
    const e = el(id);
    if (e) e.textContent = text;
  }

  const SCREEN_NAMES = { title: 'Title', map: 'World map', playing: 'Digging', paused: 'Paused', tree: 'Tech tree', wardrobe: 'Wardrobe',
    journal: 'Journal', help: 'How to play', results: 'Results', cinema: 'Cinematic' };

  function update() {
    set('statusGold', 'Gold: ' + G.save.gold);
    set('statusStars', 'Stars: ' + P.starsTotal(G.save) + ' / 120');
    set('statusSeason', G.season ? G.season.name + ': ' + G.save.season.tokens : 'No event');
    set('statusStreak', 'Streak: ' + G.save.streak.count + 'd');
    let state = SCREEN_NAMES[G.screen] || '';
    if (G.run && (G.screen === 'playing' || G.screen === 'paused')) state += ' - ' + NS.hud.caveTitle(G.run);
    set('statusState', state);
    const title = G.run && G.screen === 'playing' ? 'Boulder Dash - ' + NS.hud.caveTitle(G.run) + ' - ' + G.run.score : 'Boulder Dash';
    if (last.title !== title && User32 && User32.SetWindowText) { last.title = title; User32.SetWindowText(title); }
  }

  function renderHighScores() {
    const body = el('highScoresBody');
    if (!body) return;
    const list = G.save.high.arcade;
    let html = '';
    for (let i = 0; i < 10; ++i) {
      const hs = list[i];
      html += '<tr><td>' + (i + 1) + '</td><td>' + (hs ? hs.score : '---') + '</td><td>' + (hs ? hs.level : '-') + '</td></tr>';
    }
    body.innerHTML = html;
  }

  const hsDialog = el('highScoresBackdrop');
  if (hsDialog && hsDialog.addEventListener)
    hsDialog.addEventListener('dialog:result', (e) => {
      if (e.detail === 'reset') {
        G.save.high.arcade = [];
        G.save.high.time = [];
        NS.save.writeSave();
        renderHighScores();
      }
    });

  const actions = {
    'new': () => scr.quitToTitle(),
    'pause': () => { if (G.screen === 'playing') scr.pause(); else if (G.screen === 'paused') scr.resume(); },
    'tree': () => scr.openOverlay('tree'),
    'wardrobe': () => scr.openOverlay('wardrobe'),
    'journal': () => scr.openOverlay('journal'),
    'high-scores': () => { if (G.screen === 'playing') scr.pause(); renderHighScores(); SZ.Dialog.show('highScoresBackdrop'); },
    'exit': () => { NS.run.autosave(); if (User32 && User32.DestroyWindow) User32.DestroyWindow(); },
    'tutorial': () => scr.openOverlay('help'),
    'controls': () => { if (G.screen === 'playing') scr.pause(); SZ.Dialog.show('controlsBackdrop'); },
    'music': () => { if (SZ.GameMusic) SZ.GameMusic.toggle(); },
    'about': () => { if (G.screen === 'playing') scr.pause(); SZ.Dialog.show('dlg-about'); }
  };

  if (SZ.MenuBar) new SZ.MenuBar({ onAction: (a) => { if (actions[a]) actions[a](); } });
  if (SZ.Dialog && SZ.Dialog.wireAll) SZ.Dialog.wireAll();

  Object.assign(NS.dom, { update, renderHighScores, actions });
})();
