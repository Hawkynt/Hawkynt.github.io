/* One rendered frame: backdrop, then a menu screen or world, HUD and overlays, flash and fade. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { isMenuState } = NS.data;
  const { ctx, beginViewFrame } = NS.view;
  const { drawBackdrop } = NS.backdrop;
  const { shake } = NS.fx;
  const { drawWorld } = NS.world;
  const { drawScreenFlash, drawFade, drawOverlays } = NS.overlays;
  const { drawHud } = NS.hud;
  const { drawTitleScreen } = NS.title;
  const { drawCampaignMap } = NS.campaignMap;
  const { drawHangar } = NS.hangar;
  const { drawArmory } = NS.armory;
  const { drawHelp } = NS.help;

  function draw() {
    G.hitAreas.length = 0;

    beginViewFrame();

    ctx.save();

    drawBackdrop();

    shake.apply(ctx);

    // Menu screens replace the whole battlefield
    if (isMenuState(G.gameState)) {
      if (G.gameState === 'title')
        drawTitleScreen();
      else if (G.gameState === 'campaignMap')
        drawCampaignMap();
      else if (G.gameState === 'hangar')
        drawHangar();
      else if (G.gameState === 'armory')
        drawArmory();
      else
        drawHelp();
      shake.restore(ctx);
      ctx.restore();
      drawScreenFlash();
      drawFade();
      return;
    }

    drawWorld();

    shake.restore(ctx);
    ctx.restore();

    // HUD (logical coordinates, above the shaken world)
    if (!isMenuState(G.gameState))
      drawHud();

    drawOverlays();

    drawScreenFlash();

    drawFade();
  }

  Object.assign(NS.frame, {
    draw
  });
})();
