/* Draws the current belt's layered backdrop every frame from cached art: the nebula plane, far
   bodies (sun, planet, moon, black hole) with gentle parallax, three tiling star layers and the
   far belt of rubble, covering the whole visible plane at any aspect; plus world-space dust
   motes that streak with the ship's speed. Owns the current belt theme. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.constants;
  const { ZONES } = NS.ores;
  const K = NS.artKit;
  const B = NS.backdropArt;
  const { ctx, visible } = NS.view;

  let zone = 0;
  let theme = ZONES[0].theme;

  function setZone(i) {
    zone = Math.max(0, Math.min(ZONES.length - 1, i));
    theme = ZONES[zone].theme;
  }

  function current() {
    return zone;
  }

  /* camX/camY: the camera in world units; dim darkens the scenery under the play field;
     belt: draw the far rubble layer (in flight) */
  function draw(camX, camY, dim, belt) {
    const v = visible();
    const wx = camX - G.world.w / 2, wy = camY - G.world.h / 2;
    const neb = B.nebulaLayer(zone, theme);
    const mx = 160, my = 100;
    const scale = Math.max((v.w + mx * 2) / neb.w, (v.h + my * 2) / neb.h);
    const nw = neb.w * scale, nh = neb.h * scale;
    const px = Math.max(-mx, Math.min(mx, -wx * 0.03)), py = Math.max(-my, Math.min(my, -wy * 0.03));
    ctx.drawImage(neb.canvas, (v.x0 + v.x1) / 2 - nw / 2 + px, (v.y0 + v.y1) / 2 - nh / 2 + py, nw, nh);

    const fx = -wx * 0.05, fy = -wy * 0.05;
    if (theme.sun) K.blit(ctx, B.sun(theme.sun), theme.sun.x * VIEW_W + fx * 0.5, theme.sun.y * VIEW_H + fy * 0.5, 2);
    if (theme.hole) {
      ctx.globalAlpha = 0.85;
      K.blitRot(ctx, B.blackHole(Math.round(theme.hole.r / 4)), theme.hole.x * VIEW_W + fx * 0.6, theme.hole.y * VIEW_H + fy * 0.6, 0, 0.9);
      ctx.globalAlpha = 1;
    }
    if (theme.planet) K.blit(ctx, B.planet(ZONES[zone].id, theme.planet), theme.planet.x * VIEW_W + fx, theme.planet.y * VIEW_H + fy, 2);
    if (theme.moon) K.blit(ctx, B.moon(ZONES[zone].id, theme.moon), theme.moon.x * VIEW_W + fx * 1.4, theme.moon.y * VIEW_H + fy * 1.4, 1);

    const f = [0.1, 0.22, 0.4];
    for (let l = 0; l < 3; ++l) tile(B.starTile(l, theme.star, theme.accent), camX * f[l], camY * f[l], v);
    if (belt) {
      ctx.globalAlpha = 0.45;
      tile(B.farBelt(zone, theme.rock), camX * 0.55, camY * 0.55, v);
      ctx.globalAlpha = 1;
    }
    if (dim) {
      ctx.fillStyle = 'rgba(0,0,6,' + dim + ')';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
  }

  function tile(t, sx, sy, v) {
    const T = t.w;
    const ox = ((-sx) % T + T) % T, oy = ((-sy) % T + T) % T;
    const x0 = Math.floor((v.x0 - ox) / T) * T + ox, y0 = Math.floor((v.y0 - oy) / T) * T + oy;
    for (let y = y0; y < v.y1; y += T)
      for (let x = x0; x < v.x1; x += T)
        ctx.drawImage(t.canvas, x, y, T, T);
  }

  /* Dust motes in world space (call inside the world transform): they streak with speed */
  function drawDust(r, vx, vy) {
    const cell = 220;
    const c0 = Math.floor(r.x0 / cell), r0 = Math.floor(r.y0 / cell);
    const c1 = Math.floor(r.x1 / cell), r1 = Math.floor(r.y1 / cell);
    const sx = -vx * 0.03, sy = -vy * 0.03;
    ctx.strokeStyle = K.rgba(theme.dust, 0.28);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let rr = r0; rr <= r1; ++rr)
      for (let c = c0; c <= c1; ++c) {
        let h = (c * 73856093) ^ (rr * 19349663);
        for (let k = 0; k < 2; ++k) {
          h = (h * 1103515245 + 12345) & 0x7fffffff;
          const dx = (h % 1000) / 1000 * cell;
          h = (h * 1103515245 + 12345) & 0x7fffffff;
          const dy = (h % 1000) / 1000 * cell;
          const x = c * cell + dx, y = rr * cell + dy;
          ctx.moveTo(x, y);
          ctx.lineTo(x + sx + 0.6, y + sy + 0.6);
        }
      }
    ctx.stroke();
  }

  function themeOf() {
    return theme;
  }

  Object.assign(NS.backdrop, {
    setZone, current, draw, drawDust, themeOf
  });
})();
