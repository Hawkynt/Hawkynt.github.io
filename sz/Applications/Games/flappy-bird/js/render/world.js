;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The running world: scenery with its seasonal dressing, gust streaks, gates, hazards and
     crows, coins, bubbles, tokens, the boss arena, afterimages, the Wingmate, the bird with
     its hat, squash and stretch, its shield and fever aura, and the screen tints (slow-mo,
     Frost Time, Night Flight). Reads G, writes nothing. */

  const { CANVAS_W, BIRD_X, GROUND_Y, GATE_W, STATE_DYING, STATE_READY } = NS.C;
  const { ctx, particles, screenShake, floatingText } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const View = NS.view;
  const FxDraw = NS.fxDraw;
  const H = SZ.FlappyHazards;
  const BossArt = SZ.FlappyBossArt;
  const SeasonArt = SZ.FlappySeasonArt;

  let nightMask = null;

  /* a dark sheet with a soft hole around the bird, built once */
  function getNightMask() {
    if (nightMask)
      return nightMask;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(512, 512, 70, 512, 512, 512);
    g.addColorStop(0, 'rgba(4,6,20,0)');
    g.addColorStop(0.35, 'rgba(4,6,20,0.5)');
    g.addColorStop(0.7, 'rgba(4,6,20,0.86)');
    g.addColorStop(1, 'rgba(4,6,20,0.92)');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 1024);
    nightMask = c;
    return c;
  }

  function seasonId() {
    const ev = Prog.visualEvent();
    return ev ? ev.id : '';
  }

  /* bird scale with squash and stretch: a flap stretches it tall, then it settles */
  function birdShape() {
    const base = G.power.tiny > 0 ? 1.05 * 0.65 : 1.05;
    const k = G.squash > 0 ? G.squash / 0.18 : 0;
    const fall = G.state !== STATE_READY ? Math.max(0, Math.min(1, G.bird.vy / 14)) * 0.08 : 0;
    return { scale: base, sx: 1 - 0.14 * k + fall, sy: 1 + 0.22 * k - fall };
  }

  function drawPlayerBird(x, y, angle, alpha) {
    const sh = birdShape();
    const opts = { x: x, y: y, angle: angle, birdId: Prog.currentBird(), frame: G.wingFrame, scale: sh.scale, sx: sh.sx, sy: sh.sy, alpha: alpha };
    SZ.FlappyBirdArt.drawBird(ctx, opts);
    const hat = Prog.currentHat();
    if (hat !== 'none')
      SZ.FlappyCosmeticArt.drawHat(ctx, { x: x, y: y, angle: angle, hatId: hat, scale: sh.scale, sx: sh.sx, sy: sh.sy, alpha: alpha });
  }

  function drawScenery(view) {
    G.scene.drawSky(ctx, view);
    const sid = seasonId();
    if (sid)
      SeasonArt.drawSkyExtra(ctx, sid, view, G.globalTime);
    G.scene.drawBackdrop(ctx, G.dist, G.globalTime, view);
    if (sid) {
      ctx.fillStyle = Prog.visualEvent().tint;
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      SeasonArt.drawDecor(ctx, sid, G.dist * 0.6, view, GROUND_Y);
    }
    // Zen: a soft pastel wash that breathes slowly
    if (G.mode === 'zen') {
      ctx.fillStyle = 'rgba(190,225,255,' + (0.14 + 0.05 * Math.sin(G.globalTime * 0.5)).toFixed(3) + ')';
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    }
  }

  function drawGates() {
    const sid = seasonId();
    const soft = G.mode === 'zen';
    if (soft)
      ctx.globalAlpha = 0.72;
    for (const gate of G.course.gates) {
      const sx = gate.x - G.dist;
      if (sx <= -100 || sx >= CANVAS_W + 100 || gate.smashed)
        continue;
      const shape = SZ.FlappyCourse.gateShape(gate, G.worldT);
      G.scene.drawGate(ctx, sx, shape.y - shape.gap / 2, shape.y + shape.gap / 2);
      if (sid)
        SeasonArt.drawTopper(ctx, sid, sx, shape.y + shape.gap / 2);
      if (G.feverT > 0) {
        ctx.fillStyle = 'rgba(255,74,216,' + (0.18 + 0.1 * Math.sin(G.globalTime * 10)).toFixed(3) + ')';
        ctx.fillRect(sx - 8, shape.y - shape.gap / 2 - 4, GATE_W + 16, 4);
        ctx.fillRect(sx - 8, shape.y + shape.gap / 2, GATE_W + 16, 4);
      }
    }
    if (soft)
      ctx.globalAlpha = 1;
  }

  function drawHazards() {
    for (const hz of G.course.hazards) {
      if (hz.type === 'gust')
        continue;
      const sx = hz.x - G.dist;
      if (sx < -300 || sx > CANVAS_W + 300)
        continue;
      if (hz.type === 'icicle') {
        if (hz.smashed)
          continue;
        const shake = hz.warn > 0 && hz.warnStarted && !hz.falling ? Math.random() * 4 - 2 : 0;
        G.scene.drawHazard(ctx, { type: 'icicle', sx: sx + shake, sy: hz.sy ?? hz.len, len: hz.len }, G.globalTime);
      } else if (hz.type === 'bat') {
        G.scene.drawHazard(ctx, { type: 'bat', sx: sx, sy: H.batY(hz, G.worldT), frame: Math.floor(G.globalTime * 8) % 2 }, G.globalTime);
      } else if (hz.type === 'laser') {
        G.scene.drawHazard(ctx, { type: 'laser', sx: sx, y: H.laserY(hz, G.worldT), frozen: G.power.freeze > 0 }, G.globalTime);
      } else if (hz.type === 'fireball') {
        const u = ((G.worldT + hz.phase) % hz.period) / hz.period;
        const fy = H.fireballY(hz, G.worldT);
        if (fy >= GROUND_Y + 10)
          continue;
        G.scene.drawHazard(ctx, { type: 'fireball', sx: sx, sy: fy, vy: -Math.cos(Math.PI * u) }, G.globalTime);
      } else if (hz.type === 'crow') {
        if (hz.beaten && hz.x - G.dist < BIRD_X - 200)
          continue;
        SZ.FlappyBirdArt.drawBird(ctx, {
          x: sx, y: hz.y, birdId: 'corvus', frame: G.globalTime * (hz.mode === 'dive' ? 16 : 8), scale: 1, flip: true,
          angle: hz.mode === 'dive' ? Math.max(-0.5, Math.min(0.5, (hz.target - hz.y) * 0.01)) : 0, alpha: hz.beaten ? 0.4 : 1
        });
        if (hz.mode === 'warn')
          drawWarning(sx - 10, hz.y - 40);
      }
    }
  }

  function drawWarning(x, y) {
    const p = 0.6 + 0.4 * Math.sin(G.globalTime * 30);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.fillStyle = '#ff3a4a';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + 1);
    ctx.restore();
  }

  function drawPickups() {
    for (const coin of G.course.coins) {
      if (coin.taken)
        continue;
      const cx = coin.x - G.dist;
      if (cx < -40)
        continue;
      if (cx > CANVAS_W + 40)
        break;
      G.scene.drawCoin(ctx, cx, coin.y, G.globalTime);
    }
    for (const bubble of G.course.bubbles) {
      if (bubble.taken)
        continue;
      const bx = bubble.x - G.dist;
      if (bx < -60 || bx > CANVAS_W + 60)
        continue;
      G.scene.drawBubble(ctx, bubble.kind, bx, bubble.y, G.globalTime);
    }
    const tid = G.season ? G.season.event.id : '';
    if (tid) {
      for (const tk of G.course.tokens) {
        if (tk.taken)
          continue;
        const tx = tk.x - G.dist;
        if (tx < -40 || tx > CANVAS_W + 40)
          continue;
        SeasonArt.drawToken(ctx, tid, tx, tk.y, G.globalTime);
      }
    }
  }

  function drawBossArena() {
    const b = G.boss;
    if (!b)
      return;
    for (const z of b.zones)
      BossArt.drawZone(ctx, z, G.globalTime, GROUND_Y, b.x);
    for (const o of b.orbs)
      BossArt.drawOrb(ctx, o, G.globalTime);
    BossArt.drawBoss(ctx, { kind: b.kind, x: b.x, y: b.y, t: b.t, flash: b.flash, rot: b.state === 'dying' ? b.stateT * 0.6 : Math.sin(b.t * 2) * 0.05 });
    for (const s of b.shots)
      BossArt.drawShot(ctx, s, G.globalTime);
    const bolt = BossArt.getShot('bolt');
    for (const bt of b.bolts)
      ctx.drawImage(bolt, bt.x - 30, bt.y - 30, 60, 60);
  }

  function drawBirdAndFriends() {
    // Afterimage trail, faintest first
    const sh = birdShape();
    for (let k = 0; k < G.afterimages.length; ++k) {
      const a = G.afterimages[k];
      SZ.FlappyBirdArt.drawBird(ctx, { x: a.x, y: a.y, angle: a.angle, birdId: Prog.currentBird(), frame: a.frame, scale: sh.scale, alpha: 0.08 * (k + 1) });
    }

    // the Wingmate trails behind
    if (G.power.buddy > 0) {
      SZ.FlappyBirdArt.drawBird(ctx, { x: G.buddy.x, y: G.buddy.y, birdId: 'pip', frame: G.globalTime * 14, scale: 0.8, angle: 0.1 * Math.sin(G.globalTime * 3), alpha: G.power.buddy < 1.5 && Math.floor(G.globalTime * 10) % 2 ? 0.4 : 1 });
      if (G.buddy.shield) {
        ctx.strokeStyle = 'rgba(122,216,90,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(G.buddy.x, G.buddy.y, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // FEVER aura
    if (G.feverT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.globalTime * 12);
      ctx.drawImage(SZ.FlappyParticles.sprite('glow', '#ff4ad8'), BIRD_X - 46, G.bird.y - 46, 92, 92);
      ctx.restore();
    }
    if (G.power.rush > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(SZ.FlappyParticles.sprite('glow', '#ff8af0'), BIRD_X - 50, G.bird.y - 40, 100, 80);
      ctx.restore();
    }

    // Bird — ghosted it turns translucent, tiny it shrinks with its hitbox
    let birdAlpha = G.invuln > 0 && Math.floor(G.globalTime * 16) % 2 === 0 ? 0.35 : 1;
    if (G.power.ghost > 0)
      birdAlpha = G.power.ghost < 1 && Math.floor(G.globalTime * 10) % 2 === 0 ? 0.25 : 0.55;
    drawPlayerBird(BIRD_X, G.bird.y, G.bird.angle, birdAlpha);

    // Rocket Beak: a flame cone at the beak, one pip per charge left
    if (G.power.blast > 0) {
      const a = G.bird.angle;
      const bx = BIRD_X + Math.cos(a) * 26, by = G.bird.y + Math.sin(a) * 26;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.drawImage(SZ.FlappyParticles.sprite('glow', '#ff9a3a'), bx - 18, by - 18, 36, 36);
      ctx.restore();
      ctx.fillStyle = '#ff7a2a';
      for (let i = 0; i < G.blastCharges; ++i) {
        ctx.beginPath();
        ctx.arc(BIRD_X - 12 + i * 10, G.bird.y - 34, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
      ctx.arc(BIRD_X, G.bird.y, 33 + Math.sin(G.globalTime * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* The running world: scenery, gates, hazards, pickups, the bird and its effects */
  function drawRunScene() {
    screenShake.apply(ctx);

    // A slight camera push-in during the death tumble (the HUD stays put)
    if (G.state === STATE_DYING) {
      const z = 1 + 0.08 * Math.min(1, G.dyingTimer / 0.5);
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
    drawScenery(view);

    // Gust streaks go behind the gates so the columns cover them
    for (const hz of G.course.hazards) {
      if (hz.type !== 'gust')
        continue;
      const sx = hz.x - G.dist;
      if (sx + hz.w < -40 || sx > CANVAS_W + 40)
        continue;
      G.scene.drawHazard(ctx, { type: 'gust', sx: sx, w: hz.w, dir: hz.dir, strength: hz.strength * Rules.windScale() }, G.globalTime);
    }

    FxDraw.drawWeather('back');
    drawGates();
    drawHazards();
    drawPickups();
    G.scene.drawGround(ctx, G.dist, view);
    FxDraw.drawDebris();
    drawBossArena();
    FxDraw.drawWeather('front');
    drawBirdAndFriends();
    FxDraw.drawFeathers();
    FxDraw.drawRings();
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);

    const v = View.visibleRect();
    // Night Flight (daily twist): only a pool of light around the bird
    const tw = Rules.twistActive();
    if (tw && tw.night) {
      const img = getNightMask();
      const R = 760, cx = BIRD_X + 80;
      ctx.drawImage(img, cx - R, G.bird.y - R, R * 2, R * 2);
      ctx.fillStyle = 'rgba(4,6,20,0.92)';
      if (cx - R > v.x0)
        ctx.fillRect(v.x0, v.y0, cx - R - v.x0, v.y1 - v.y0);
      if (cx + R < v.x1)
        ctx.fillRect(cx + R, v.y0, v.x1 - cx - R, v.y1 - v.y0);
      if (G.bird.y - R > v.y0)
        ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, G.bird.y - R - v.y0);
      if (G.bird.y + R < v.y1)
        ctx.fillRect(v.x0, G.bird.y + R, v.x1 - v.x0, v.y1 - G.bird.y - R);
    }

    // Slow-motion and Frost Time vignettes
    if (G.power.slow > 0 || G.power.freeze > 0) {
      ctx.fillStyle = G.power.freeze > 0 ? 'rgba(140,220,255,0.22)' : 'rgba(120,60,200,0.18)';
      ctx.fillRect(v.x0, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x1 - 40, v.y0, 40, v.y1 - v.y0);
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 40);
      ctx.fillRect(v.x0, v.y1 - 40, v.x1 - v.x0, 40);
    }
  }

  Object.assign(NS.world, { birdShape, drawPlayerBird, drawRunScene });
})();
