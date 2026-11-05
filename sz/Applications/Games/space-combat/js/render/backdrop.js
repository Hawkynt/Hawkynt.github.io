/* Draws the current sector's layered backdrop every frame from cached art: the nebula plane,
   far bodies (sun, planet, moon, distant black hole) and three tiling star layers scrolling
   down-screen at their own parallax speeds, covering the whole visible plane at any aspect;
   plus the speed streaks that rush past inside the play field. Owns the current sector theme. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, PF_X, PF_W, PF_H } = NS.constants;
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

  /* camX/camY: the drift of the far layers; scroll: how far the stars have streamed down;
     dim: darken the scenery so the battle reads on top (in flight) */
  function draw(camX, camY, dim, scroll) {
    const v = visible();
    const wx = camX - PF_W / 2, wy = camY - PF_H / 2;
    scroll = scroll || 0;
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

    /* far bodies, anchored to the 1280 x 720 plane with a little parallax; in flight they sit
       behind the play field rather than under the HUD panels */
    const fx = -wx * 0.07, fy = -wy * 0.07;
    const bx = dim ? (k => PF_X + k * PF_W) : (k => k * VIEW_W);
    const bs = dim ? 0.6 : 1;
    if (theme.sun) {
      const s = B.sun(theme.sun);
      K.blit(ctx, s, bx(theme.sun.x) + fx * 0.5, theme.sun.y * VIEW_H + fy * 0.5, 2 * bs);
    }
    /* the distant singularity; hidden while a real one sits in the sector, so there is never a twin */
    if (theme.hole && !(dim && G.holes.length)) {
      const h = P.blackHole(theme.hole.r / 3);
      ctx.globalAlpha = 0.75;
      K.blit(ctx, h, bx(theme.hole.x) + fx * 0.6, theme.hole.y * VIEW_H + fy * 0.6, 0.7 * bs);
      ctx.globalAlpha = 1;
    }
    if (theme.planet) {
      const pl = B.planet(SECTORS[sector].id, theme.planet);
      K.blit(ctx, pl, bx(theme.planet.x) + fx, theme.planet.y * VIEW_H + fy, 2 * bs);
    }
    if (theme.moon) {
      const m = B.moon(SECTORS[sector].id, theme.moon);
      K.blit(ctx, m, bx(theme.moon.x) + fx * 1.4, theme.moon.y * VIEW_H + fy * 1.4, bs);
    }

    /* star layers tile across everything visible and stream down with the forward flight */
    const f = [0.14, 0.3, 0.55];
    const sv = [0.3, 0.7, 1.25];
    for (let l = 0; l < 3; ++l) {
      const t = B.starTile(l, theme.star, theme.accent);
      const T = t.w;
      const ox = ((-camX * f[l]) % T + T) % T, oy = ((-camY * f[l] + scroll * sv[l]) % T + T) % T;
      const x0 = Math.floor((v.x0 - ox) / T) * T + ox, y0 = Math.floor((v.y0 - oy) / T) * T + oy;
      for (let y = y0; y < v.y1; y += T)
        for (let x = x0; x < v.x1; x += T)
          ctx.drawImage(t.canvas, x, y, T, T);
    }
  }

  /* Speed streaks in field units: thin lines rushing down-screen faster than the stars */
  function drawDust(scroll) {
    const cell = 150;
    const off = scroll * 2.4;
    const r0 = Math.floor(-off / cell) - 1, r1 = r0 + Math.ceil(PF_H / cell) + 2;
    ctx.strokeStyle = K.rgba(theme.dust, 0.16);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let r = r0; r <= r1; ++r)
      for (let c = 0; c < PF_W / cell; ++c) {
        let h = (c * 73856093) ^ (r * 19349663);
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        const x = c * cell + (h % 1000) / 1000 * cell;
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        const y = r * cell + (h % 1000) / 1000 * cell + off;
        const len = 10 + (h % 7) * 4;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
      }
    ctx.stroke();
  }

  Object.assign(NS.backdrop, {
    setSector, current, draw, drawDust
  });
})();
