/* app/loop.js -- the requestAnimationFrame loop.
   Owns state: G.lastTimestamp
   Reads: constants, env, widgets, effects, simulation, cinematics, frame, input and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { MAX_DT } = NS.constants;
  const { ctx } = NS.env;
  const { updateTooltip } = NS.widgets;
  const { updateEffects, updateShake } = NS.effects;
  const { updateGame } = NS.simulation;
  const { updateCine } = NS.cinematics;
  const { drawFrame, updateStatusBar } = NS.frame;

  // An error in one frame must never stop the game: report it once and keep running
  let frameErrorLogged = false;
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    try {
      runFrame(timestamp);
    } catch (err) {
      if (!frameErrorLogged) {
        frameErrorLogged = true;
        console.error('Tower Defense frame error:', err);
      }
      try {
        ctx.restore();
      } catch (_) {}
    }
  }

  function runFrame(timestamp) {
    const rawDt = G.lastTimestamp ? (timestamp - G.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    G.lastTimestamp = timestamp;
    G.frameDt = dt || 0.016;
    ++G.frameNo;

    if (!G.overlay && !G.cine)
      updateGame(dt);
    else
      G.animTime += dt;
    updateCine(dt);

    updateEffects(dt);
    updateShake(dt);
    G.shownGold += (G.gold - G.shownGold) * (1 - Math.exp(-dt * 10));
    if (Math.abs(G.gold - G.shownGold) < 0.5)
      G.shownGold = G.gold;
    G.goldPulse = Math.max(0, G.goldPulse - dt * 3);
    G.livesPulse = Math.max(0, G.livesPulse - dt * 2.5);
    updateTooltip(dt);
    NS.input.updateHover();

    drawFrame();
    updateStatusBar();
  }

  NS.loop = { gameLoop };

})();
