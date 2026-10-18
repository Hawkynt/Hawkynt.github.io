/* Help screen: four pages (controls, power-ups, enemies, progress) and their paging. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { ALIEN_H, UFO_H, BOSS_SPRITE_W, BOSS_SPRITE_H } = NS.constants;
  const { POWERUPS } = NS.data;
  const { playSfx } = NS.audio;
  const { ctx, fillVisible, ui } = NS.view;
  const { drawButton } = NS.widgets;
  const { setScreen } = NS.screens;

  const HELP_PAGES = ['Controls', 'Power-ups', 'Enemies', 'Progress'];

  const POWERUP_HELP = {
    tripleShot: 'Three bullets in a fan',
    rapidFire: 'Shoot much faster',
    shield: 'Blocks the next hit',
    laser: 'Piercing shots',
    slowMo: 'Slows the enemy down',
    extraLife: '+1 life',
    bomb: 'Wipes the whole screen',
    drone: 'A helper ship fights with you',
  };

  const ENEMY_HELP = [
    { species: 1, text: 'Squid · 30 points' },
    { species: 2, text: 'Crab · 20 points' },
    { species: 3, text: 'Octopus · 10 points' },
    { species: 4, text: 'Diver · 50 points, swoops at you' },
    { species: 5, text: 'Warden · 40 points, shielded' },
    { species: 6, text: 'Armored · 60 points, takes 2 hits' },
  ];

  function drawHelp() {
    ctx.fillStyle = 'rgba(3,4,10,0.6)';
    fillVisible();

    const pw = 900, ph = 520, px = 190, py = 100;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[G.helpPage], accent: ui.UI.accent, titlePx: 20 });

    const t = G.gameTime / 1000;
    if (G.helpPage === 0) {
      const lines = [
        ['Move', '← / → or A / D or mouse'],
        ['Fire', 'Space or click'],
        ['Special', 'E or Shift or right click'],
        ['Dash', 'double-tap ← / → (Armory upgrade)'],
        ['Pause', 'P or Esc'],
      ];
      for (let i = 0; i < lines.length; ++i) {
        const y = py + 90 + i * 56;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(21, 'bold');
        ctx.fillText(lines[i][0], px + 50, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(19);
        ctx.fillText(lines[i][1], px + 240, y);
      }
    } else if (G.helpPage === 1) {
      for (let i = 0; i < POWERUPS.length; ++i) {
        const p = POWERUPS[i];
        const y = py + 78 + i * 48;
        SZ.InvaderArt.drawCapsule(ctx, p.id, px + 66, y, t);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = p.color;
        ctx.font = ui.uiFont(19, 'bold');
        ctx.fillText(p.name, px + 110, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(17);
        ctx.fillText(POWERUP_HELP[p.id] || '', px + 320, y);
      }
    } else if (G.helpPage === 2) {
      for (let i = 0; i < ENEMY_HELP.length; ++i) {
        const e = ENEMY_HELP[i];
        const y = py + 74 + i * 48;
        SZ.InvaderArt.drawAlien(ctx, e.species, px + 50, y - ALIEN_H / 2, Math.floor(G.gameTime / 480) % 2, false);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(19);
        ctx.fillText(e.text, px + 110, y);
      }
      SZ.InvaderArt.drawUfo(ctx, px + 40, py + 366 - UFO_H / 2, t);
      ctx.fillStyle = ui.UI.text;
      ctx.font = ui.uiFont(19);
      ctx.fillText('UFO · bonus points, always drops a power-up', px + 110, py + 366);
      ctx.save();
      ctx.translate(px + 76, py + 420);
      ctx.scale(0.45, 0.45);
      SZ.InvaderArt.drawBoss(ctx, 0, -BOSS_SPRITE_W / 2, -BOSS_SPRITE_H / 2, false, false);
      ctx.restore();
      ctx.fillText('Bosses · heavy firepower, watch for phase two', px + 110, py + 420);
    } else {
      const lines = [
        'Campaign: 30 stages in six sectors, up to 90 stars.',
        'Stars unlock the next stages and sectors.',
        'Credits: every run pays credits, spend them in the Hangar and Armory.',
        'Hangar: five ships, each with its own special ability.',
        'Armory: 16 permanent upgrades across five branches.',
        'Modes: Classic, Survival, Boss Rush, Daily and Campaign.',
      ];
      for (let i = 0; i < lines.length; ++i) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = i % 2 === 0 ? ui.UI.text : ui.UI.textDim;
        ctx.font = ui.uiFont(19);
        ctx.fillText(lines[i], px + 50, py + 90 + i * 52);
      }
    }

    for (let i = 0; i < HELP_PAGES.length; ++i) {
      ctx.beginPath();
      ctx.arc(640 + (i - 1.5) * 22, py + ph - 34, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === G.helpPage ? ui.UI.gold : 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
    drawButton('help-prev', '←', px + 24, py + ph - 56, 80, 40, {
      px: 18, disabled: G.helpPage === 0,
      action: () => { G.helpPage = Math.max(0, G.helpPage - 1); },
    });
    drawButton('help-next', '→', px + pw - 104, py + ph - 56, 80, 40, {
      px: 18, disabled: G.helpPage === HELP_PAGES.length - 1,
      action: () => { G.helpPage = Math.min(HELP_PAGES.length - 1, G.helpPage + 1); },
    });

    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Close' },
    ], 640, py + ph + 34, 900, 1);
  }

  /* Help pages */
  function onHelpKey(e) {
    e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyH') {
      setScreen(G.helpFrom);
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      G.helpPage = Math.max(0, G.helpPage - 1);
      playSfx('click', { volume: 0.4 });
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      G.helpPage = Math.min(HELP_PAGES.length - 1, G.helpPage + 1);
      playSfx('click', { volume: 0.4 });
    }
  }

  Object.assign(NS.help, {
    drawHelp, onHelpKey
  });
})();
