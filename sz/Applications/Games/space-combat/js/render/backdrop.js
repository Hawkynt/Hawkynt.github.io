/* Draws the current sector's layered backdrop every frame from cached art: the nebula plane,
   far bodies (sun, planet, moon, distant black hole) and three tiling star layers, each with its
   own parallax, covering the whole visible plane at any aspect; plus world-space dust that
   streaks with speed. Owns the current sector theme. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.constants;
  const { SECTORS } = NS.campaign;
  const K = NS.artKit;
  const B = NS.backdropArt;
  const P = NS.propArt;
  const { ctx, visible } = NS.view;

  let sector = 0;
  let theme = SECTORS[0].theme;

  function setSector(i) {
    sector = Math.max(0, Math.min(SECTORS.length - 1, i));
    theme = SECTORS[sector].theme;
  }

  function current() {
    return sector;
  }

  /* camX/camY: the camera in world units; the world centre maps to no parallax shift */
  /* dim: darken the scenery so the battle reads on top (in flight) */
  function draw(camX, camY, dim) {
    const v = visible();
    const wx = camX - G.world.w / 2, wy = camY - G.world.h / 2;
    /* nebula: covers the visible plane plus room for its slow drift */
    const neb = B.nebulaLayer(sector, theme);
    const mx = 160, my = 100;
    const scale = Math.max((v.w + mx * 2) / neb.w, (v.h + my * 2) / neb.h);
    const nw = neb.w * scale, nh = neb.h * scale;
    const px = Math.max(-mx, Math.min(mx, -wx * 0.04)), py = Math.max(-my, Math.min(my, -wy * 0.04));
    ctx.drawImage(neb.canvas, (v.x0 + v.x1) / 2 - nw / 2 + px, (v.y0 + v.y1) / 2 - nh / 2 + py, nw, nh);
    if (dim) {
      ctx.fillStyle = 'rgba(0,0,8,' + dim + ')';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }

    /* far bodies, anchored to the 1280 x 720 plane with a little parallax */
    const fx = -wx * 0.07, fy = -wy * 0.07;
    if (theme.sun) {
      const s = B.sun(theme.sun);
      K.blit(ctx, s, theme.sun.x * VIEW_W + fx * 0.5, theme.sun.y * VIEW_H + fy * 0.5, 2);
    }
    /* the distant singularity; hidden while a real one sits in the sector, so there is never a twin */
    if (theme.hole && !(dim && G.holes.length)) {
      const h = P.blackHole(theme.hole.r / 3);
      ctx.globalAlpha = 0.75;
      K.blit(ctx, h, theme.hole.x * VIEW_W + fx * 0.6, theme.hole.y * VIEW_H + fy * 0.6, 0.7);
      ctx.globalAlpha = 1;
    }
    if (theme.planet) {
      const pl = B.planet(SECTORS[sector].id, theme.planet);
      K.blit(ctx, pl, theme.planet.x * VIEW_W + fx, theme.planet.y * VIEW_H + fy, 2);
    }
    if (theme.moon) {
      const m = B.moon(SECTORS[sector].id, theme.moon);
      K.blit(ctx, m, theme.moon.x * VIEW_W + fx * 1.4, theme.moon.y * VIEW_H + fy * 1.4, 1);
    }

    /* star layers tile across everything visible */
    const f = [0.14, 0.3, 0.55];
    for (let l = 0; l < 3; ++l) {
      const t = B.starTile(l, theme.star, theme.accent);
      const T = t.w;
      const ox = ((-camX * f[l]) % T + T) % T, oy = ((-camY * f[l]) % T + T) % T;
      const x0 = Math.floor((v.x0 - ox) / T) * T + ox, y0 = Math.floor((v.y0 - oy) / T) * T + oy;
      for (let y = y0; y < v.y1; y += T)
        for (let x = x0; x < v.x1; x += T)
          ctx.drawImage(t.canvas, x, y, T, T);
    }
  }

  /* Dust motes in world space: they stream past and stretch with the ship's speed */
  function drawDust(camX, camY, vx, vy) {
    const v = visible();
    const cell = 260;
    const x0 = camX - VIEW_W / 2 + v.x0, y0 = camY - VIEW_H / 2 + v.y0;
    const c0 = Math.floor(x0 / cell), r0 = Math.floor(y0 / cell);
    const c1 = Math.floor((x0 + v.w) / cell), r1 = Math.floor((y0 + v.h) / cell);
    const sx = -vx * 0.02, sy = -vy * 0.02;
    ctx.strokeStyle = K.rgba(theme.dust, 0.2);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        let h = (c * 73856093) ^ (r * 19349663);
        for (let k = 0; k < 1; ++k) {
          h = (h * 1103515245 + 12345) & 0x7fffffff;
          const dx = (h % 1000) / 1000 * cell;
          h = (h * 1103515245 + 12345) & 0x7fffffff;
          const dy = (h % 1000) / 1000 * cell;
          const x = c * cell + dx - camX + VIEW_W / 2, y = r * cell + dy - camY + VIEW_H / 2;
          ctx.moveTo(x, y);
          ctx.lineTo(x + sx + 0.8, y + sy + 0.8);
        }
      }
    ctx.stroke();
  }

  Object.assign(NS.backdrop, {
    setSector, current, draw, drawDust
  });
})();
