;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The running world: scenery, gust streaks, gates, hazards, coins, bubbles, afterimages,
     the bird, its shield and the slow-motion vignette. Reads G, writes nothing. */

  const { CANVAS_W, BIRD_X, GROUND_Y, STATE_DYING } = NS.C;
  const { ctx, particles, screenShake, floatingText } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const View = NS.view;
  const FxDraw = NS.fxDraw;

  /* The running world: scenery, gates, hazards, pickups, the bird and its effects */
  function drawRunScene() {
    // Apply screen shake
    screenShake.apply(ctx);

    // A slight camera push-in during the death tumble (the HUD stays put)
    if (G.state === STATE_DYING) {
      const z = 1 + 0.06 * Math.min(1, G.dyingTimer / 0.5);
      ctx.translate(BIRD_X, G.bird.y);
      ctx.scale(z, z);
      ctx.translate(-BIRD_X, -G.bird.y);
    }

    // Biome scenery — it covers everything the canvas shows, the shake shift included
    const view = View.visibleRect();
    view.x0 -= 12;
    view.y0 -= 12;
    view.x1 += 12;
    view.y1 += 12;
    G.scene.drawSky(ctx, view);
    G.scene.drawBackdrop(ctx, G.dist, G.globalTime, view);

    // Gust streaks go behind the gates so the columns cover them
    for (const hz of G.course.hazards) {
      if (hz.type !== 'gust')
        continue;
      const sx = hz.x - G.dist;
      if (sx + hz.w < -40 || sx > CANVAS_W + 40)
        continue;
      G.scene.drawHazard(ctx, { type: 'gust', sx: sx, w: hz.w, dir: hz.dir, strength: hz.strength }, G.globalTime);
    }

    // Fireflies glow behind the gates
    FxDraw.drawWeather('back');

    // Gates
    for (const gate of G.course.gates) {
      const sx = gate.x - G.dist;
      if (sx <= -100 || sx >= CANVAS_W + 100)
        continue;
      const shape = SZ.FlappyCourse.gateShape(gate, G.runTime);
      G.scene.drawGate(ctx, sx, shape.y - shape.gap / 2, shape.y + shape.gap / 2);
    }

    // The remaining hazards pass in front of the gates
    for (const hz of G.course.hazards) {
      if (hz.type === 'gust')
        continue;
      const sx = hz.x - G.dist;
      if (sx < -300 || sx > CANVAS_W + 300)
        continue;

      if (hz.type === 'icicle') {
        if (hz.smashed)
          continue;
        const shake = hz.warn > 0 ? Math.random() * 4 - 2 : 0;
        G.scene.drawHazard(ctx, { type: 'icicle', sx: sx + shake, sy: hz.sy ?? hz.len, len: hz.len }, G.globalTime);
      } else if (hz.type === 'bat') {
        const by = hz.y + hz.amp * Math.sin(Math.PI * 2 * G.runTime / hz.period + hz.phase);
        G.scene.drawHazard(ctx, { type: 'bat', sx: sx, sy: by, frame: Math.floor(G.globalTime * 8) % 2 }, G.globalTime);
      } else if (hz.type === 'laser') {
        const gate = G.course.gates.find(g => g.index === hz.gate);
        if (!gate)
          continue;
        const shape = SZ.FlappyCourse.gateShape(gate, G.runTime);
        const cycle = hz.on + hz.off;
        const tt = (G.runTime + hz.phase) % cycle;
        const lit = tt < hz.on;
        G.scene.drawHazard(ctx, {
          type: 'laser',
          sx: gate.x - G.dist,
          y1: shape.y - shape.gap / 2,
          y2: shape.y + shape.gap / 2,
          on: lit,
          warn: !lit && tt > cycle - 0.45
        }, G.globalTime);
      } else if (hz.type === 'fireball') {
        const u = ((G.runTime + hz.phase) % hz.period) / hz.period;
        const fy = GROUND_Y + 20 - hz.height * GROUND_Y * Math.sin(Math.PI * u);
        if (fy >= GROUND_Y + 10)
          continue;
        G.scene.drawHazard(ctx, { type: 'fireball', sx: sx, sy: fy, vy: -Math.cos(Math.PI * u) }, G.globalTime);
      }
    }

    // Coins
    for (const coin of G.course.coins) {
      if (coin.taken)
        continue;
      const cx = coin.x - G.dist;
      if (cx < -40 || cx > CANVAS_W + 40)
        continue;
      G.scene.drawCoin(ctx, cx, coin.y, G.globalTime);
    }

    // Power-up bubbles (drawn only — picked up in a later step)
    for (const bubble of G.course.bubbles) {
      if (bubble.taken)
        continue;
      const bx = bubble.x - G.dist;
      if (bx < -60 || bx > CANVAS_W + 60)
        continue;
      G.scene.drawBubble(ctx, bubble.kind, bx, bubble.y, G.globalTime);
    }

    G.scene.drawGround(ctx, G.dist, view);

    // Leaves, sand, snow, rain and embers drift in front of the ground
    FxDraw.drawWeather('front');

    // Afterimage trail, faintest first
    const birdScale = G.power.tiny > 0 ? 1.05 * 0.65 : 1.05;
    for (let k = 0; k < G.afterimages.length; ++k) {
      const a = G.afterimages[k];
      SZ.FlappyBirdArt.drawBird(ctx, {
        x: a.x,
        y: a.y,
        angle: a.angle,
        birdId: Prog.currentBird(),
        frame: a.frame,
        scale: birdScale,
        alpha: 0.08 * (k + 1)
      });
    }

    // Bird — ghosted it turns translucent, tiny it shrinks with its hitbox
    let birdAlpha = G.invuln > 0 && Math.floor(G.globalTime * 16) % 2 === 0 ? 0.35 : 1;
    if (G.power.ghost > 0)
      birdAlpha = G.power.ghost < 1 && Math.floor(G.globalTime * 10) % 2 === 0 ? 0.25 : 0.55;
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: BIRD_X,
      y: G.bird.y,
      angle: G.bird.angle,
      birdId: Prog.currentBird(),
      frame: G.wingFrame,
      scale: birdScale,
      alpha: birdAlpha
    });

    // Shield ring
    if (G.power.shield) {
      ctx.save();
      ctx.strokeStyle = '#4aa3ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(BIRD_X, G.bird.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(BIRD_X, G.bird.y, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Loose feathers and the rings left by picked-up coins
    FxDraw.drawFeathers();
    FxDraw.drawRings();

    // Particles and floating text
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);

    // Slow-motion vignette
    if (G.power.slow > 0) {
      const v = View.visibleRect();
      ctx.fillStyle = 'rgba(120, 60, 200, 0.18)';
      ctx.fillRect(v.x0, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x1 - 40, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 40);
      ctx.fillRect(v.x0, v.y1 - 40, v.x1 - v.x0, 40);
    }
  }

  Object.assign(NS.world, { drawRunScene });
})();
