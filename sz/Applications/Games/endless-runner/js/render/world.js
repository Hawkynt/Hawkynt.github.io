/* The course of a run in world space, behind the actors: the camera transform (lead, zoom,
   look-up and shake), ground spans tiled from the world's ground sprite with cliff rims and the
   water, lava, chasm or void below each pit, ledges (cracked ones crumble), spring and boost
   pads, every obstacle in its world's look with the warning cues of the moving ones (saw rails,
   drone alerts, falling-rock shadows), coins, gems, shards, tokens, power orbs, spark orbs, the
   finish gate and Arcade's best-distance flag. Only what is on screen is drawn. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { GROUND_Y, TAU, PX_PER_M } = C;
  const { WORLDS } = NS.worlds;
  const { BAR_DECK } = NS.items;
  const K = NS.artKit;
  const PA = NS.propArt;
  const PH = NS.physics;
  const { ctx } = NS.view;

  const VR = { x0: 0, x1: 0, y0: 0, y1: 0 };

  /* plane -> world transform for the current camera; returns the visible world rect */
  function enter(cam) {
    const v = NS.view.visible();
    const z = cam.zoom;
    ctx.translate(G.shakeX || 0, G.shakeY || 0);
    ctx.translate(0, GROUND_Y);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -GROUND_Y - cam.y);
    VR.x0 = cam.x + v.x0 / z;
    VR.x1 = cam.x + v.x1 / z;
    VR.y0 = GROUND_Y + cam.y + (v.y0 - GROUND_Y) / z;
    VR.y1 = GROUND_Y + cam.y + (v.y1 - GROUND_Y) / z;
    return VR;
  }

  function wOf(run) {
    return run.world;
  }

  /* ── ground and pits ── */
  function ground(run) {
    const w = wOf(run);
    const W = WORLDS[w];
    const tile = PA.groundTile(w);
    const src = tile.canvas;
    const sc = src.width / tile.w;
    const g = run.course.ground;
    const top = GROUND_Y - 10;
    const deep = top + tile.h;
    for (let i = 0; i < g.length; ++i) {
      const s = g[i];
      const a = Math.max(s.x, VR.x0 - 2), b = Math.min(s.x + s.w, VR.x1 + 2);
      if (b <= a) continue;
      let x = Math.floor(a / tile.w) * tile.w;
      for (; x < b; x += tile.w) {
        const x0 = Math.max(x, a), x1 = Math.min(x + tile.w, b);
        if (x1 - x0 < 0.5) continue;
        ctx.drawImage(src, (x0 - x) * sc, 0, (x1 - x0) * sc, src.height, x0, top, x1 - x0 + 0.6, tile.h);
      }
      if (deep < VR.y1) {
        ctx.fillStyle = W.ground[3];
        ctx.fillRect(a, deep - 1, b - a, VR.y1 - deep + 2);
      }
    }
    /* pits between spans, then the rims */
    const pit = PA.pitFill(w);
    const t = G.time;
    for (let i = 0; i + 1 < g.length; ++i) {
      const x0 = g[i].x + g[i].w, x1 = g[i + 1].x;
      if (x1 < VR.x0 || x0 > VR.x1 || x1 - x0 < 1) continue;
      const py = GROUND_Y + 40;
      ctx.drawImage(pit.canvas, x0, py, x1 - x0, pit.h);
      if (py + pit.h < VR.y1) {
        ctx.fillStyle = K.shade(W.ground[3], -0.5);
        ctx.fillRect(x0, py + pit.h - 1, x1 - x0, VR.y1 - py - pit.h + 2);
      }
      if (W.pit === 'water' || W.pit === 'lava') {
        ctx.fillStyle = W.pit === 'water' ? 'rgba(200,240,255,0.7)' : '#ffe07a';
        for (let x = x0; x < x1; x += 16) ctx.fillRect(x, py - 2 + Math.sin(t * 3 + x * 0.05) * 3, 10, 3);
        if (W.pit === 'lava') {
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow('#ff6a1a'), (x0 + x1) / 2, py, Math.min(6, (x1 - x0) / 50), 0.5 + 0.2 * Math.sin(t * 4));
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (W.pit === 'neon' || W.pit === 'void') {
        ctx.strokeStyle = K.rgba(W.accent, 0.5);
        ctx.lineWidth = 2;
        for (let y = py + 30; y < py + 200; y += 34) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      }
      const eL = PA.groundEdge(w, 1), eR = PA.groundEdge(w, -1);
      ctx.drawImage(eL.canvas, x0 - 2, top, eL.w, eL.h);
      ctx.drawImage(eR.canvas, x1 - eR.w + 2, top, eR.w, eR.h);
    }
  }

  function plats(run) {
    const w = wOf(run);
    const tile = PA.platTile(w);
    const pl = run.course.plats;
    const px = run.p.x;
    for (let i = 0; i < pl.length; ++i) {
      const q = pl[i];
      if (q.bar || q.x > VR.x1 || q.x + q.w < VR.x0) continue;
      for (let x = q.x; x < q.x + q.w; x += tile.w) {
        const ww = Math.min(tile.w, q.x + q.w - x);
        let dy = 0;
        if (q.cr && px > x + ww + 120) dy = (px - x - ww - 120) * 0.6;
        if (dy > 600) continue;
        ctx.drawImage(tile.canvas, 0, 0, ww * tile.canvas.width / tile.w, tile.canvas.height, x, q.y - 6 + dy, ww + 0.5, tile.h);
        if (q.cr) {
          ctx.strokeStyle = 'rgba(20,18,36,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + ww * 0.3, q.y + dy); ctx.lineTo(x + ww * 0.45, q.y + 12 + dy); ctx.lineTo(x + ww * 0.35, q.y + 22 + dy); ctx.stroke();
        }
      }
    }
    const pads = run.course.pads;
    for (let i = 0; i < pads.length; ++i) {
      const d = pads[i];
      if (d.x > VR.x1 || d.x + d.w < VR.x0) continue;
      const s = PA.pad(d.kind, w);
      ctx.drawImage(s.canvas, d.x, GROUND_Y - s.h + 4, s.w, s.h);
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(d.kind === 'spring' ? '#7cff9a' : '#ffd24a'), d.x + d.w / 2, GROUND_Y - 8, 1.6, 0.4 + 0.3 * Math.sin(G.time * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ── obstacles ── */
  function hazards(run) {
    const w = wOf(run);
    const hz = run.course.hz;
    const px = run.p.x;
    const t = G.time;
    for (let i = PH.lowerBound(hz, VR.x0 - 700); i < hz.length && hz[i].x < VR.x1 + 500; ++i) {
      const h = hz[i];
      if (h.dead) continue;
      switch (h.kind) {
        case 'hurdle': { const s = PA.hurdle(w); ctx.drawImage(s.canvas, h.x + h.w / 2 - s.w / 2, h.base - s.h + 2, s.w, s.h); break; }
        case 'block': {
          const s = PA.block(w);
          for (let k = 0; k < Math.round(h.h / 56); ++k) ctx.drawImage(s.canvas, h.x - 4, h.base - 62 - k * 56, s.w, s.h);
          break;
        }
        case 'bar': {
          const s = PA.barTile(w);
          const sc = s.canvas.width / s.w;
          const top = h.base - BAR_DECK - 8;
          /* hangers up into the sky, then the beam */
          ctx.fillStyle = 'rgba(20,18,36,0.75)';
          if (!h.seg) ctx.fillRect(h.x + 10, VR.y0, 4, top - VR.y0 + 4);
          ctx.fillRect(h.x + h.w - 14, VR.y0, 4, top - VR.y0 + 4);
          for (let x = h.x; x < h.x + h.w; x += s.w) {
            const ww = Math.min(s.w, h.x + h.w - x);
            ctx.drawImage(s.canvas, 0, 0, ww * sc, s.canvas.height, x, top, ww + 0.5, s.h);
          }
          break;
        }
        case 'wall': { const s = PA.wall(w); ctx.drawImage(s.canvas, h.x - 4, h.base - 204, s.w, s.h); break; }
        case 'spikes': {
          const s = PA.spikeTile(w);
          for (let x = h.x; x < h.x + h.w - 4; x += 38) ctx.drawImage(s.canvas, x, h.base - 28, 40, 30);
          break;
        }
        case 'saw': {
          const m = PH.motion(h, px);
          ctx.strokeStyle = 'rgba(20,18,36,0.6)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(m.cx, Math.min(h.cyStart, h.cyEnd) - 40); ctx.lineTo(m.cx, Math.max(h.cyStart, h.cyEnd) + 20); ctx.stroke();
          ctx.strokeStyle = h.low ? 'rgba(255,90,106,0.8)' : 'rgba(94,224,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(m.cx, h.cyEnd, 30, 0, TAU); ctx.stroke();
          K.blitRot(ctx, PA.saw(w), m.cx, m.cy, t * 14, 1);
          break;
        }
        case 'drone': {
          const m = PH.motion(h, px);
          K.blit(ctx, PA.drone(w, ((t * 12) | 0) % 2), m.cx, m.cy + Math.sin(t * 6 + h.id) * 3 * m.f);
          if (m.f > 0.02 && h.x - px < 1100) alert(m.cx, m.cy - 46, h.low ? '#ff5a6a' : '#5ee0ff');
          break;
        }
        case 'rock': {
          const m = PH.motion(h, px);
          const fall = 1 - m.f;
          ctx.fillStyle = 'rgba(20,18,36,' + (0.15 + fall * 0.35).toFixed(3) + ')';
          ctx.beginPath(); ctx.ellipse(m.cx, h.base - 2, 18 + fall * 14, 5, 0, 0, TAU); ctx.fill();
          if (m.cy > VR.y0 - 40) K.blitRot(ctx, PA.rock(w), m.cx, m.cy, fall * 0.6, 1);
          if (m.f > 0.98 && h.x - px < 1000) alert(m.cx, Math.max(VR.y0 + 40, h.base - 220), '#ffb347');
          break;
        }
        case 'roller': {
          const m = PH.motion(h, px);
          K.blitRot(ctx, PA.roller(w), m.cx, m.cy, -m.cx / 28, 1);
          break;
        }
      }
    }
  }

  function alert(x, y, color) {
    const a = 0.6 + 0.4 * Math.sin(G.time * 16);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    K.poly(ctx, [[x, y - 14], [x + 13, y + 9], [x - 13, y + 9]]);
    ctx.fill();
    ctx.fillStyle = '#141224';
    ctx.fillRect(x - 1.5, y - 5, 3, 8);
    ctx.fillRect(x - 1.5, y + 4, 3, 3);
    ctx.globalAlpha = 1;
  }

  /* ── pickups ── */
  function items(run) {
    const list = run.course.items;
    const t = G.time;
    const coin = PA.coin();
    for (let i = PH.lowerBound(list, VR.x0 - 60); i < list.length && list[i].x < VR.x1 + 60; ++i) {
      const it = list[i];
      if (it.got) continue;
      switch (it.k) {
        case 'coin': {
          const sx = Math.abs(Math.cos(t * 4 + it.x * 0.013));
          ctx.drawImage(coin.canvas, it.x - 13 * Math.max(0.15, sx), it.y - 13, 26 * Math.max(0.15, sx), 26);
          break;
        }
        case 'gem': K.blit(ctx, PA.gem(), it.x, it.y + Math.sin(t * 3 + it.x) * 3, 0.9); break;
        case 'shard':
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow('#5ee0ff'), it.x, it.y, 2.2, 0.6 + 0.3 * Math.sin(t * 5));
          ctx.globalCompositeOperation = 'source-over';
          K.blitRot(ctx, PA.shard(), it.x, it.y + Math.sin(t * 3) * 5, Math.sin(t * 2) * 0.2, 1);
          break;
        case 'token':
          K.blit(ctx, PA.token(G.season ? G.season.token : 'firework'), it.x, it.y + Math.sin(t * 3 + it.x) * 4, 1);
          break;
        case 'power':
        case 'orb': {
          const id = it.k === 'orb' ? 'spark' : it.p;
          const y = it.y + Math.sin(t * 3 + it.x) * 6;
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(it.k === 'orb' ? '#5ee0ff' : NS.items.POWER_BY_ID[it.p].color), it.x, y, 2.4, 0.55);
          ctx.globalCompositeOperation = 'source-over';
          K.blit(ctx, PA.orb(id), it.x, y, 1 + Math.sin(t * 6) * 0.04);
          break;
        }
        case 'finish': {
          const s = PA.gate();
          ctx.drawImage(s.canvas, it.x - s.w / 2, GROUND_Y - s.h + 4, s.w, s.h);
          break;
        }
      }
    }
    /* rain and sky trail */
    const gemS = PA.gem();
    for (let pass = 0; pass < 2; ++pass) {
      const l = pass ? run.sky : run.rain;
      for (let i = 0; i < l.length; ++i) {
        const c = l[i];
        if (c.x < VR.x0 - 30 || c.x > VR.x1 + 30) continue;
        if (c.gem) K.blit(ctx, gemS, c.x, c.y, 0.8);
        else ctx.drawImage(coin.canvas, c.x - 13, c.y - 13, 26, 26);
      }
    }
    /* Arcade: the best distance so far */
    if (run.bestX && run.bestX > VR.x0 - 40 && run.bestX < VR.x1 + 40) flag(run.bestX, 'BEST ' + Math.round(run.bestX / PX_PER_M) + ' m', '#ffd24a');
  }

  function flag(x, label, color) {
    ctx.fillStyle = '#141224';
    ctx.fillRect(x - 3, GROUND_Y - 170, 6, 170);
    ctx.fillStyle = color;
    K.poly(ctx, [[x + 3, GROUND_Y - 170], [x + 70, GROUND_Y - 152], [x + 3, GROUND_Y - 134]]);
    ctx.fill();
    ctx.font = 'bold 16px ' + C.FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 8, GROUND_Y - 186);
  }

  Object.assign(NS.world, {
    VR, enter, ground, plats, hazards, items, alert, flag
  });
})();
