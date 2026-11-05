/* How to Play in five illustrated pages: controls for keyboard, mouse and touch; the rock types;
   raiders and titans; the power-ups; modes and progression (stardust, tech tree, seasons, quests,
   streaks, autosave). Paged with the arrows or the buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ROCK_TYPES } = NS.rockData;
  const { ENEMIES, BOSSES, BOSS_ORDER } = NS.enemyData;
  const { POWERUPS, POWER_ORDER } = NS.powerData;
  const { MODES } = NS.campaign;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const PAGES = ['Controls', 'Rocks', 'Raiders and Titans', 'Power-ups', 'Modes and Progress'];

  function row(y, keys, what) {
    kit.text(keys, 120, y, 16, UI.gold, { weight: 'bold' });
    kit.text(what, 420, y, 15, UI.text);
  }

  function controls() {
    const r = [
      ['A / D  or  Left / Right', 'Rotate the ship'], ['W  or  Up', 'Thrust'], ['S  or  Down', 'Brake (stronger with Inertial Dampers)'],
      ['Space  or  hold', 'Fire'], ['Shift  or  X', 'Hyperspace jump (cooldown)'], ['E  or  Q', 'Overdrive blast when the gauge is full'],
      ['Esc  or  P', 'Pause - tech tree, hangar and goals are one click away'], ['F2', 'Back to the title (your run is kept)'],
      ['Mouse', 'Point to aim, left button fires, right button thrusts'],
      ['Touch', 'Left stick steers and thrusts, guns fire on their own; HYPER and OVER buttons on the right'],
    ];
    for (let i = 0; i < r.length; ++i) row(170 + i * 42, r[i][0], r[i][1]);
    kit.text('The field wraps: fly off one edge and you come back on the other - so do the rocks.', 640, 610, 14, UI.textDim, { align: 'center' });
  }

  function rocks() {
    const ids = ['normal', 'iron', 'crystal', 'explosive', 'ice', 'lava', 'electric', 'void', 'gold'];
    for (let i = 0; i < ids.length; ++i) {
      const T = ROCK_TYPES[ids[i]];
      const x = 90 + (i % 3) * 380, y = 180 + Math.floor(i / 3) * 140;
      K.blitRot(ctx, NS.rockArt.rock(ids[i], 2, i % 6), x + 30, y + 30, G.time * 0.4 + i, 1.1);
      kit.text(T.name, x + 80, y + 10, 18, '#ffffff', { weight: 'bold' });
      kit.text(T.hp + (T.hp === 1 ? ' hit' : ' hits') + '  -  x' + T.score + ' points', x + 80, y + 32, 12, UI.textDim);
      kit.wrap(T.desc, x + 80, y + 46, 270, 13, 17, UI.text);
    }
    const sd = G.cal.seasonDef;
    kit.text('This season: ' + ROCK_TYPES[sd.token].name + ' rocks drop ' + sd.tokenName.toLowerCase() + ' for the event track.', 640, 620, 14, sd.accent, { align: 'center' });
  }

  function raiders() {
    const ids = Object.keys(ENEMIES);
    for (let i = 0; i < ids.length; ++i) {
      const E = ENEMIES[ids[i]];
      const x = 80 + (i % 4) * 290, y = 170 + Math.floor(i / 4) * 110;
      K.blitRot(ctx, NS.enemyArt.enemySprite(ids[i]), x + 26, y + 24, ids[i] === 'saucer' || ids[i] === 'sniper' ? 0 : -Math.PI / 2, 1);
      kit.text(E.name, x + 60, y + 8, 16, E.col, { weight: 'bold' });
      kit.wrap(E.desc, x + 60, y + 22, 210, 12, 16, UI.text);
    }
    for (let i = 0; i < BOSS_ORDER.length; ++i) {
      const id = BOSS_ORDER[i], B = BOSSES[id];
      const x = 90 + i * 230, y = 470;
      K.blit(ctx, NS.enemyArt.boss(id), x + 60, y + 50, 70 / (B.r * 1.6));
      kit.fitText(B.name, x + 60, y + 112, 210, 15, { align: 'center', weight: 'bold', color: B.pal[3] });
      kit.fitText(B.title, x + 60, y + 132, 210, 11, { align: 'center', color: UI.textDim });
    }
  }

  function powers() {
    for (let i = 0; i < POWER_ORDER.length; ++i) {
      const k = POWER_ORDER[i], D = POWERUPS[k];
      const x = 80 + (i % 3) * 380, y = 170 + Math.floor(i / 3) * 96;
      K.blit(ctx, NS.propArt.capsule(k), x + 22, y + 20, 1.2);
      kit.text(D.name + (D.dur ? '  -  ' + D.dur + ' s' : ''), x + 56, y + 8, 16, D.col, { weight: 'bold' });
      kit.wrap(D.desc, x + 56, y + 22, 290, 12, 16, UI.text);
    }
  }

  function modes() {
    const ids = Object.keys(MODES);
    for (let i = 0; i < ids.length; ++i) {
      const M = MODES[ids[i]];
      NS.propArt.icon(ctx, M.icon, 110, 180 + i * 48, 26, M.col);
      kit.text(M.name, 140, 172 + i * 48, 17, '#ffffff', { weight: 'bold' });
      kit.text(M.desc, 140, 192 + i * 48, 13, UI.textDim);
    }
    const lines = [
      'Stardust drops from everything you break, in every mode. It is banked the moment you touch it.',
      'Spend it in the Tech Tree (29 upgrades in five branches) and on skins, trails and shot colours in the Hangar.',
      'Combos multiply your score up to x8; every kill also charges Overdrive.',
      'Each day brings three quests and a seeded Daily challenge; playing on consecutive days builds a streak bonus.',
      'Seasons and festivals follow your calendar: seasonal rocks, decor and an event track with exclusive rewards.',
      'Everything is saved in this browser: your run autosaves, and Continue on the title picks up exactly where you left.',
    ];
    for (let i = 0; i < lines.length; ++i) kit.wrap(lines[i], 640, 172 + i * 70, 560, 14, 20, UI.text);
  }

  function draw() {
    const p = G.ui.helpPage;
    kit.text('HOW TO PLAY', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.text((p + 1) + ' / ' + PAGES.length + '  -  ' + PAGES[p], 60, 76, 15, UI.accent, { weight: 'bold' });
    switch (p) {
      case 0: controls(); break;
      case 1: rocks(); break;
      case 2: raiders(); break;
      case 3: powers(); break;
      case 4: modes(); break;
    }
    W.button('back', G.returns.help === 'paused' ? 'Back to pause' : 'Back', 60, 650, 220, 46, { action: () => scr.back('help'), icon: 'back' });
    W.button('prev', 'Previous', 860, 650, 170, 46, { action: () => turn(-1), disabled: p === 0 });
    W.button('next', 'Next', 1040, 650, 170, 46, { action: () => turn(1), disabled: p === PAGES.length - 1, accent: UI.gold });
  }

  function turn(d) {
    G.ui.helpPage = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
  }

  Object.assign(NS.help, {
    draw, turn, PAGES
  });
})();
