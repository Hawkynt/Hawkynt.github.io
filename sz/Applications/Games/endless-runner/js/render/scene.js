/* One frame, top to bottom: the save/shake scope, background, entities, effects,
   the HUD and overlays, and the tutorial overlay on top. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const S = NS.state;
  const V = NS.view;
  const ctx = V.ctx;

  /* ── Draw ── */
  function draw() {
    const tier = NS.rules.getCurrentTier();
    ctx.save();

    NS.background.sky(tier);
    NS.background.skyline(tier);
    NS.background.groundRoad(tier);

    NS.entities.reflections();
    NS.entities.obstacles();
    NS.entities.coins();
    NS.entities.powerUps();
    NS.entities.player();
    NS.entities.speedLines();

    // Particles + floating text
    V.particles.draw(ctx);
    V.floatingText.draw(ctx);

    V.screenShake.restore(ctx);

    NS.hud.hud();
    NS.hud.overlays();

    ctx.restore();

    if (S.showTutorial)
      NS.hud.tutorial();
  }

  NS.scene.draw = draw;
})();
