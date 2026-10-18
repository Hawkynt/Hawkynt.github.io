/* Title screen: headline, marching species, mode buttons, the flown ship. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { ALIEN_W, THEME_ORDER } = NS.constants;
  const { SHIP_ORDER } = NS.data;
  const { todayKey } = NS.save;
  const { shipOwned, currentShipId, countStars, countTreeMaxed } = NS.progress;
  const { ctx, fillVisible, ui } = NS.view;
  const { setBackdrop } = NS.backdrop;
  const { newGame } = NS.waves;
  const { drawButton } = NS.widgets;
  const { setScreen, openHelp } = NS.screens;

  function drawTitleScreen() {
    setBackdrop(THEME_ORDER[Math.floor(G.gameTime / 9000) % THEME_ORDER.length]);
    ctx.fillStyle = 'rgba(3,4,10,0.5)';
    fillVisible();

    ui.drawHeadline('SPACE INVADERS', 640, 120, 1100, 92, '#5af2ff', '#c04cff');
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Defend Earth. Upgrade your fleet.', 640, 180);

    /* one row with each species, marching slowly left and right and bobbing up and down */
    const frame = Math.floor(G.gameTime / 480) % 2;
    const drift = Math.sin(G.gameTime * 0.0006) * 90;
    const bob = Math.sin(G.gameTime * 0.0012) * 10;
    const alienScale = 1.6;
    for (let s = 1; s <= 6; ++s)
      SZ.InvaderArt.drawAlien(ctx, s, 640 + (s - 3.5) * 90 + drift - alienScale * ALIEN_W / 2, 224 + bob, frame, false, alienScale);

    ui.drawChip(G.save.credits + ' CR', 1256, 20, 30, { align: 'right', color: ui.UI.gold });

    const ownedShips = SHIP_ORDER.filter(id => shipOwned(id)).length;
    const daily = G.save.best.daily;
    const items = [
      { id: 't-campaign', label: 'Campaign', sub: countStars() + ' / 90 stars', action: () => setScreen('campaignMap') },
      { id: 't-classic', label: 'Classic', sub: 'Best: ' + G.save.best.classic, action: () => newGame('classic') },
      { id: 't-survival', label: 'Survival', sub: 'Best: ' + G.save.best.survival, action: () => newGame('survival') },
      { id: 't-bossRush', label: 'Boss Rush', sub: 'Best: ' + G.save.best.bossRush, action: () => newGame('bossRush') },
      { id: 't-daily', label: 'Daily', sub: daily.date === todayKey() ? 'Today: ' + daily.score : 'New seed today', action: () => newGame('daily') },
      { id: 't-hangar', label: 'Hangar', sub: ownedShips + '/5 ships', action: () => { G.prevScreen = 'title'; setScreen('hangar'); } },
      { id: 't-armory', label: 'Armory', sub: countTreeMaxed() + '/16 upgrades', action: () => { G.prevScreen = 'title'; setScreen('armory'); } },
      { id: 't-help', label: 'Help', action: openHelp },
    ];

    for (let i = 0; i < items.length; ++i) {
      const x = 640 - 308 + (i % 2) * 316;
      const y = 300 + Math.floor(i / 2) * 58;
      drawButton(items[i].id, items[i].label, x, y, 300, 50, { sub: items[i].sub, action: items[i].action });
    }

    /* the ship you fly, below the buttons, burning at full thrust */
    ctx.save();
    ctx.translate(640, 592);
    ctx.scale(2, 2);
    SZ.InvaderArt.drawShip(ctx, currentShipId(), 0, 0, 3, 0, 1);
    ctx.restore();

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' },
    ], 640, 694, 900, 1);
  }

  Object.assign(NS.title, {
    drawTitleScreen
  });
})();
