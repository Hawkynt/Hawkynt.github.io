/* One frame of the canvas, in load order: sky, wells, asteroids, goal, trail,
   ship, aim, the effect libraries, then the HUD on top of the shake transform. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const D = NS.dom;

  function draw() {
    D.canvas.width = C.CANVAS_W;
    D.canvas.height = C.CANVAS_H;

    D.ctx.save();
    D.screenShake.apply(D.ctx);

    NS.sky.drawBackground();
    NS.scene.drawWells();
    NS.scene.drawAsteroids();
    NS.scene.drawGoal();
    NS.scene.drawTrail();
    NS.scene.drawShip();
    NS.scene.drawAim();

    // Effects
    D.particles.draw(D.ctx);
    D.floatingText.draw(D.ctx);

    D.screenShake.restore(D.ctx);
    D.ctx.restore(); // end shake

    NS.hud.drawHud();
  }

  Object.assign(NS.board, { draw });
})();
