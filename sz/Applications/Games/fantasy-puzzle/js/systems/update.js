/* One simulation step of a running level: advances every system in a fixed order and ages the
   short-lived effects. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { REALM_BANNER_TIME } = NS.consts;
  const { updateWalk, updateMotes, updateHeroLife, updateHoverInvalid, updateBoardFx } = NS.world;
  const { updatePendingCast, updateProjectiles, updateRings, updateTileFx, updateSlide } = NS.casting;
  const { updateWin } = NS.win;

  function updateGame(dt) {
    G.time += dt;
    G.hero.t += dt;
    updateWalk(dt);
    updatePendingCast(dt);
    updateProjectiles(dt);
    updateWin(dt);
    updateTileFx(dt);
    updateSlide(dt);
    updateRings(dt);
    updateMotes(dt);
    updateHeroLife(dt);
    updateHoverInvalid(dt);
    updateBoardFx(dt);
    if (G.realmBanner) {
      G.realmBanner.t += dt;
      if (G.realmBanner.t >= REALM_BANNER_TIME)
        G.realmBanner = null;
    }
    for (const s of G.spells)
      s.t += dt;
    G.spells = G.spells.filter(function(s) { return s.t < s.dur; });
    if (G.tileShake) {
      G.tileShake.t += dt;
      if (G.tileShake.t >= 0.3)
        G.tileShake = null;
    }
    if (G.hintFx) {
      G.hintFx.t -= dt;
      if (G.hintFx.t <= 0)
        G.hintFx = null;
    }
    if (G.hintBanner.t > 0)
      G.hintBanner.t = Math.max(0, G.hintBanner.t - dt);
  }

  NS.update = { updateGame };
})();
