;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Drawing the playing field: the baked layer (backdrop, shadows and every
   * fixture that never moves, plus blast scorches), the live bodies, zones,
   * targets and stars, the selection outline, the launcher with its aim
   * guide, arc and pull band, ball trails, the Blueprint hint, the drag
   * ghost and the field particles; also warms every sprite cache before a
   * level starts. Owns G.layer and G.layerKey; reads G.run, G.stats, G.save,
   * G.time, the pointer and the view transform.
   */

  const G = NS.G;
  const ctx = G.ctx, ui = G.ui, canvas = G.canvas;
  const Art = G.Art, Scene = G.Scene, Fx = G.Fx, Parts = G.Parts, Sim = G.Sim;
  const DEG = NS.C.DEG, FIELD_H = NS.C.FIELD_H, AIM_MAX_DRAG = NS.C.AIM_MAX_DRAG, TARGET_COLOR = NS.C.TARGET_COLOR;

  /* draws everything once off screen so no sprite is painted mid-shot */
  let warmCanvas = null, fxWarmed = false;
  function warmCaches() {
    const run = G.run;
    if (!warmCanvas) {
      warmCanvas = document.createElement('canvas');
      warmCanvas.width = warmCanvas.height = 4;
    }
    const g = warmCanvas.getContext('2d');
    const skin = G.currentSkin();
    for (const b of run.att.world.bodies)
      if (b.alive && !b.sensor)
        Art.drawBody(g, b, run.world, 0, skin);
    for (const z of run.att.world.zones)
      Art.drawZone(g, z, run.world, 0);
    for (const t of Parts.PART_ORDER)
      Art.partIcon(t, run.world);
    Art.drawTarget(g, 0, 0, false, 0, TARGET_COLOR);
    Art.drawTarget(g, 0, 0, true, 0, TARGET_COLOR);
    Art.drawStar(g, 0, 0, 0, 0);
    Art.drawBall(g, 0, 0, 0, skin, Parts.BALL_R, 0);
    Art.drawLauncher(g, 0, 0, 30, 0.5, 0, run.world, 0);
    if (!fxWarmed) {
      fxWarmed = true;
      const sys = Fx.create(400);
      Fx.impact(sys, 0, 0, 0, 1, 'metal', 1);
      Fx.impact(sys, 0, 0, 0, 1, 'wood', 1);
      Fx.shatter(sys, 0, 0, 100, 0);
      Fx.explosion(sys, 0, 0, 170);
      Fx.splash(sys, 0, 0, false);
      Fx.sizzle(sys, 0, 0);
      Fx.targetHit(sys, 0, 0, '#ffb84a');
      Fx.starPickup(sys, 0, 0);
      Fx.confetti(sys, 0, 0, 12);
      Fx.bumperPop(sys, 0, 0, 24, '#ff7ad0');
      Fx.springPop(sys, 0, 0, 0, -1);
      Fx.portal(sys, 0, 0, '#5ac8ff');
      for (const tr of ['spark', 'comet', 'rainbow'])
        for (let k = 0; k < 20; ++k)
          Fx.trail(sys, tr, 0, 0, 900, 0, 0.1, k);
      sys.draw(g);
    }
  }

  /* ── the baked layer ── */

  function bakeLayer() {
    const run = G.run;
    const key = run.level.id + ':' + run.level.targets.join(';') + ':' + canvas.width + 'x' + canvas.height + ':' + G.viewScale.toFixed(4);
    if (G.layer && G.layerKey === key)
      return;
    G.layerKey = key;
    const v = G.visibleRect();
    if (!G.layer)
      G.layer = document.createElement('canvas');
    const layer = G.layer;
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = layer.getContext('2d');
    g.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
    Scene.drawBackdrop(g, run.world, v, G.viewScale);
    /* push the backdrop back a little so the puzzle reads */
    g.fillStyle = ['rgba(10,14,18,0.22)', 'rgba(236,246,236,0.3)', 'rgba(8,20,36,0.25)', 'rgba(10,4,4,0.25)', 'rgba(4,4,16,0.2)'][run.world];
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, Math.min(FIELD_H, v.y1) - v.y0);
    const statics = run.att.world.bodies.filter(b => b.alive && Art.isStaticArt(b));
    /* drop shadows */
    g.save();
    g.globalAlpha = 0.38;
    g.translate(7, 9);
    for (const b of statics)
      if (b.data.kind !== 'ground')
        drawShadowShape(g, b);
    g.restore();
    for (const b of statics)
      Art.drawBody(g, b, run.world, 0);
  }

  /* a blast mark burned into the baked layer for the rest of the try */
  function scorch(x, y, r) {
    if (!G.layer)
      return;
    const g = G.layer.getContext('2d');
    g.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(10,6,4,0.55)');
    rg.addColorStop(0.6, 'rgba(20,10,6,0.25)');
    rg.addColorStop(1, 'rgba(20,10,6,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawShadowShape(g, b) {
    g.fillStyle = '#000000';
    g.beginPath();
    if (b.circle) {
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    } else {
      const v = b.wv;
      g.moveTo(v[0], v[1]);
      for (let i = 1; i < b.poly.count; ++i)
        g.lineTo(v[i * 2], v[i * 2 + 1]);
      g.closePath();
    }
    g.fill();
  }

  /* ── the live field ── */

  function drawField(dt) {
    bakeLayer();
    const run = G.run, time = G.time, viewScale = G.viewScale;
    const v = G.visibleRect();
    const sh = G.shake.update(dt);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(G.layer, Math.round(sh.x * viewScale), Math.round(sh.y * viewScale));
    ctx.setTransform(viewScale, 0, 0, viewScale, G.viewOffX + sh.x * viewScale, G.viewOffY + sh.y * viewScale);
    Scene.drawLights(ctx, run.world, v, time);
    const world = run.att.world;
    const skin = G.currentSkin();
    for (const z of world.zones)
      if (z.kind !== 'portal')
        Art.drawZone(ctx, z, run.world, time);
    /* the last shot's ghost trail */
    if (G.stats.ghostTrail && run.lastPaths.length && run.phase === 'aim')
      drawPath(run.lastPaths[0], 'rgba(255,255,255,0.22)', 2);
    for (const b of world.bodies) {
      if (!b.alive || b.sensor || b.tag === 'ball' || Art.isStaticArt(b))
        continue;
      if (run.drag && run.drag.from >= 0 && b.data && b.data.placedIndex === run.drag.from)
        continue;
      Art.drawBody(ctx, b, run.world, time, skin);
    }
    for (const b of world.bodies)
      if (b.alive && b.tag === 'lava')
        Art.drawBody(ctx, b, run.world, time);
    for (const z of world.zones)
      if (z.kind === 'portal')
        Art.drawZone(ctx, z, run.world, time);
    for (const t of run.att.targets) {
      if (run.mode === 'sandbox' && run.drag && run.drag.target)
        continue;
      Art.drawTarget(ctx, t.x, t.y, t.lit, time, TARGET_COLOR);
    }
    run.att.stars.forEach((s, i) => {
      if (!s.got)
        Art.drawStar(ctx, s.x, s.y, time, i * 1.7);
    });
    /* selection outline */
    if (run.selected >= 0 && NS.build.canEdit()) {
      const p = run.placed[run.selected];
      const P = Parts.PARTS[p.type];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a * DEG);
      ctx.strokeStyle = 'rgba(122,232,255,' + (0.6 + 0.3 * Math.sin(time * 6)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 30;
      ui.roundRectPath(-P.half[0] - 8, -P.half[1] - 8, P.half[0] * 2 + 16, P.half[1] * 2 + 16, 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    /* launcher, aim guide, balls and trails */
    const L = run.level.launcher;
    if (run.phase === 'aim' && !run.drag)
      drawAimGuide();
    Art.drawLauncher(ctx, L[0], L[1], run.aimAngle, run.phase === 'aim' ? run.aimPower : 0, time, run.world, run.recoil);
    if (run.level.aim && run.phase === 'aim')
      drawAimArc(L);
    const shot = run.att.shot;
    if (shot) {
      shot.balls.forEach((b, i) => {
        if (!b.alive)
          return;
        const tr = run.trails[i];
        if (tr && tr.length > 4)
          drawBallTrail(tr);
        if (G.save.trail !== 'none')
          Fx.trail(G.fxWorld, G.save.trail, b.x, b.y, b.vx, b.vy, dt, time);
      });
    }
    for (const b of world.bodies)
      if (b.alive && b.tag === 'ball')
        Art.drawBody(ctx, b, run.world, time, skin);
    if (run.aiming && run.phase === 'aim')
      drawPullBand(run.aiming);
    if (run.blueprint)
      drawBlueprint();
    if (run.drag)
      drawDragGhost();
    G.fxWorld.draw(ctx, v);
    G.texts.draw(ctx);
    ctx.restore();
    ctx.setTransform(viewScale, 0, 0, viewScale, G.viewOffX, G.viewOffY);
  }

  function drawPath(p, color, width) {
    if (!p || p.length < 4)
      return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2)
      ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBallTrail(tr) {
    const n = tr.length / 2;
    const from = Math.max(0, n - 14);
    ctx.lineCap = 'round';
    for (let i = from + 1; i < n; ++i) {
      const k = (i - from) / (n - from);
      ctx.strokeStyle = 'rgba(255,240,210,' + (0.35 * k).toFixed(3) + ')';
      ctx.lineWidth = 2 + 9 * k;
      ctx.beginPath();
      ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]);
      ctx.lineTo(tr[i * 2], tr[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawAimGuide() {
    NS.aim.computeGuide();
    const guide = NS.aim.guide, time = G.time;
    const n = guide.length / 3;
    for (let i = 0; i < n; ++i) {
      const x = guide[i * 3], y = guide[i * 3 + 1], hit = guide[i * 3 + 2];
      const k = 1 - i / Math.max(1, n);
      const pulse = 0.75 + 0.25 * Math.sin(time * 8 - i * 0.6);
      if (hit) {
        Art.drawGlow(ctx, x, y, 34, '#ffe066', 0.9);
        ctx.strokeStyle = 'rgba(255,240,180,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * k * pulse).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 2 + 3.5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* the slingshot band from where the drag began to the finger */
  function drawPullBand(a) {
    const mouseX = G.mouseX, mouseY = G.mouseY;
    const dx = mouseX - a.sx, dy = mouseY - a.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6)
      return;
    const k = Math.min(1, len / AIM_MAX_DRAG);
    const col = k > 0.85 ? '255,122,58' : k > 0.5 ? '255,216,74' : '122,232,255';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(' + col + ',0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = G.time * 40;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(' + col + ',0.95)';
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 7 + 5 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAimArc(L) {
    const lim = G.run.level.aim;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,224,102,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(L[0], L[1], 58, -lim[1] * DEG, -lim[0] * DEG);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.8)';
    ctx.lineWidth = 2;
    for (const a of lim) {
      ctx.beginPath();
      ctx.moveTo(L[0] + Math.cos(a * DEG) * 50, L[1] - Math.sin(a * DEG) * 50);
      ctx.lineTo(L[0] + Math.cos(a * DEG) * 66, L[1] - Math.sin(a * DEG) * 66);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDragGhost() {
    const d = G.run.drag, time = G.time;
    if (d.target) {
      Art.drawTarget(ctx, d.x, d.y, false, time, TARGET_COLOR);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.85;
    Art.drawPart(ctx, { type: d.type, x: d.x, y: d.y, a: d.a }, G.run.world, time);
    ctx.restore();
    const P = Parts.PARTS[d.type];
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.a * DEG);
    ctx.strokeStyle = d.valid ? 'rgba(122,255,170,0.9)' : 'rgba(255,90,90,0.95)';
    ctx.fillStyle = d.valid ? 'rgba(122,255,170,0.12)' : 'rgba(255,60,60,0.18)';
    ctx.lineWidth = 2;
    ui.roundRectPath(-P.half[0] - 4, -P.half[1] - 4, P.half[0] * 2 + 8, P.half[1] * 2 + 8, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    /* snapping grid around the cursor */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let gx = -60; gx <= 60; gx += 20)
      for (let gy = -60; gy <= 60; gy += 20)
        if (gx * gx + gy * gy < 3700)
          ctx.fillRect(d.x + gx - 1, d.y + gy - 1, 2, 2);
  }

  function drawBlueprint() {
    const run = G.run, time = G.time;
    const sol = G.SOLUTIONS[run.level.daily ? run.level.baseId : run.level.id];
    if (!sol)
      return;
    const n = run.blueprint >= 2 ? sol.parts.length : Math.min(1, sol.parts.length);
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.15 * Math.sin(time * 4);
    for (let i = 0; i < n; ++i) {
      const q = sol.parts[i];
      Art.drawPart(ctx, { type: q[0], x: q[1], y: q[2], a: q[3] }, run.world, time);
    }
    ctx.restore();
    if (run.blueprint >= 2 && sol.shots.length) {
      ctx.fillStyle = '#bfeaff';
      ctx.textAlign = 'left';
      ui.fitText('Blueprint shot: ' + sol.shots[0][0] + '° at ' + Math.round((sol.shots[0][1] - Sim.MIN_SPEED) / (Sim.BASE_MAX_SPEED * G.stats.powerMul - Sim.MIN_SPEED) * 100) + '% power',
        run.level.launcher[0] - 40, run.level.launcher[1] - 90, 360, 14, { weight: 'bold', color: '#bfeaff', outline: 'rgba(0,0,0,0.7)' });
    }
  }

  G.drawField = drawField;

  NS.field = { warmCaches: warmCaches, scorch: scorch, drawField: drawField };
})();
