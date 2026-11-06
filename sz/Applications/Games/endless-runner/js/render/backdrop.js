/* The sky behind a world, filling the whole canvas at any window shape: the world's gradient,
   sun or moon with its glow, stars and twinkles at night, the aurora of Frostpeak and the
   Rift's tear, three parallax strips scrolling at their own depth (vertically too when the
   camera looks up), a solid fill under the nearest strip, and in front of everything the
   world's weather, the festival's decor and tint, and a soft vignette. Crossfades between two
   worlds when Arcade moves on. Per frame it only blits cached strips. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, GROUND_Y, TAU } = NS.constants;
  const { WORLDS } = NS.worlds;
  const K = NS.artKit;
  const BA = NS.backdropArt;
  const { ctx } = NS.view;

  const LAYERS = [
    { name: 'far', px: 0.06, py: 0.15, bottom: 520 },
    { name: 'mid', px: 0.22, py: 0.3, bottom: 572 },
    { name: 'near', px: 0.5, py: 0.55, bottom: 612 },
  ];
  const skyGrad = {};

  function skyFill(w) {
    if (skyGrad[w]) return skyGrad[w];
    const W = WORLDS[w];
    const gr = ctx.createLinearGradient(0, -80, 0, 560);
    gr.addColorStop(0, W.sky[0]);
    gr.addColorStop(0.55, W.sky[1]);
    gr.addColorStop(1, W.sky[2]);
    skyGrad[w] = gr;
    return gr;
  }

  function tile(spr, off, y, v) {
    const tw = spr.w;
    let x = v.x0 - (((off + v.x0) % tw) + tw) % tw;
    for (; x < v.x1; x += tw) ctx.drawImage(spr.canvas, Math.floor(x), Math.floor(y), tw + 1, spr.h);
  }

  /* one world's sky and scenery; cam: {x, y, zoom} */
  function world(w, cam, alpha) {
    const v = NS.view.visible();
    const W = WORLDS[w];
    const t = G.time;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = skyFill(w);
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const lift = -cam.y * cam.zoom;
    if (W.night) {
      const st = BA.stars(w);
      ctx.globalAlpha = alpha * 0.9;
      tile(st, cam.x * 0.01, -40 + lift * 0.05, v);
      if (v.y0 < -40) tile(st, cam.x * 0.01 + 300, -440 + lift * 0.05, v);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; ++i) {
        const a = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) + i * 2);
        K.blitAlpha(ctx, K.glow('#ffffff'), ((i * 173 + 40) % 1240) + v.x0 * 0, 30 + (i * 67) % 260 + lift * 0.05, 0.3, a * alpha);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    /* sun or moon */
    const sx = W.sunX * VIEW_W - cam.x * 0.004 % 40, sy = W.sunY * VIEW_H + lift * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    K.blitAlpha(ctx, K.glow(W.sun), sx, sy, 7, 0.55 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = W.sun;
    ctx.beginPath(); ctx.arc(sx, sy, W.night ? 34 : 44, 0, TAU); ctx.fill();
    if (W.night) {
      ctx.fillStyle = K.rgba(W.sky[1], 0.55);
      ctx.beginPath(); ctx.arc(sx + 14, sy - 8, 30, 0, TAU); ctx.fill();
    }
    if (w === 2 || w === 4) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(t * 0.5));
      tile(BA.aurora(w), cam.x * 0.03 + t * 12, 10 + lift * 0.08, v);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
    }
    for (let i = 0; i < LAYERS.length; ++i) {
      const L = LAYERS[i];
      const spr = BA.layer(L.name, w);
      const y = L.bottom - spr.h + lift * L.py;
      tile(spr, cam.x * cam.zoom * L.px, y, v);
      if (i === LAYERS.length - 1 && y + spr.h < v.y1) {
        ctx.fillStyle = W.near;
        ctx.fillRect(v.x0, y + spr.h - 1, v.w, v.y1 - y - spr.h + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw(run, cam) {
    if (run && run.worldFade > 0 && run.worldFrom !== run.world) {
      world(run.worldFrom, cam, 1);
      world(run.world, cam, 1 - run.worldFade);
    } else world(run ? run.world : 0, cam, 1);
  }

  /* ── in front: weather, festival decor, tint, vignette ── */
  function weather(w, cam) {
    const v = NS.view.visible();
    const t = G.time;
    const kind = WORLDS[w].weather;
    const span = v.w + 80;
    const n = kind === 'rain' ? 70 : kind === 'pollen' || kind === 'void' ? 20 : 46;
    for (let i = 0; i < n; ++i) {
      const seed = i * 97.31;
      if (kind === 'snow') {
        const x = v.x0 + ((seed * 13 - cam.x * 0.6 - t * 30 + Math.sin(t + i) * 30) % span + span) % span - 40;
        const y = v.y0 + ((seed * 7 + t * (50 + (i % 5) * 14)) % (v.h + 40)) - 20;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + (i % 3) * 0.15) + ')';
        ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
      } else if (kind === 'rain') {
        const x = v.x0 + ((seed * 11 - cam.x * 0.9 - t * 260) % span + span) % span - 40;
        const y = v.y0 + ((seed * 5 + t * 900) % (v.h + 60)) - 30;
        ctx.strokeStyle = 'rgba(160,200,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 22); ctx.stroke();
      } else if (kind === 'sand') {
        const x = v.x0 + ((seed * 17 - cam.x * 0.8 - t * 420) % span + span) % span - 40;
        const y = v.y0 + (seed * 3.7 % v.h);
        ctx.fillStyle = 'rgba(255,220,170,0.35)';
        ctx.fillRect(x, y, 26 + (i % 4) * 8, 2);
      } else {
        const x = v.x0 + ((seed * 13 - cam.x * 0.5 + Math.sin(t * 0.7 + i) * 40) % span + span) % span - 40;
        const y = v.y0 + (((seed * 5 - t * (kind === 'void' ? 40 : 14)) % v.h) + v.h) % v.h;
        const col = kind === 'void' ? '#c08cff' : '#fff2a0';
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(col), x, y, 0.12 + (i % 3) * 0.05, 0.35 + 0.35 * Math.sin(t * 2 + i));
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function decor(cam) {
    const sea = G.season;
    if (!sea) return;
    const v = NS.view.visible();
    const t = G.time;
    const span = v.w + 80;
    const kinds = { snow: 'snow', petals: 'petal', motes: 'glow', leaves: 'leaf', bats: 'bat', confetti: 'square' };
    const shape = kinds[sea.decor];
    const cols = [sea.color, sea.accent, '#ffffff'];
    for (let i = 0; i < 22; ++i) {
      const seed = i * 131.7;
      const x = v.x0 + ((seed * 9 - cam.x * 0.7 - t * 40 + Math.sin(t * 0.8 + i) * 50) % span + span) % span - 40;
      const fall = sea.decor === 'bats' ? -1 : 1;
      const y = v.y0 + (((seed * 3 + fall * t * (40 + (i % 4) * 12)) % (v.h + 40)) + v.h + 40) % (v.h + 40) - 20;
      const s = 10 + (i % 3) * 4;
      if (shape === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(cols[i % 3]), x, y, 0.3, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      const spr = NS.propArt.shape(NS.fx.SHAPES[shape], cols[i % 3]);
      const a = t * (1 + (i % 3)) + i;
      ctx.globalAlpha = 0.75;
      ctx.translate(x, y);
      ctx.rotate(sea.decor === 'bats' ? Math.sin(a) * 0.3 : a);
      ctx.drawImage(spr.canvas, -s / 2, -s / 2, s, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      NS.view.begin();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = sea.tint;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function vignette() {
    const v = NS.view.visible();
    const spr = K.sprite('vignette', 128, 72, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,10,0.42)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    ctx.drawImage(spr.canvas, v.x0, v.y0, v.w, v.h);
  }

  Object.assign(NS.backdrop, {
    LAYERS, draw, world, weather, decor, vignette
  });
})();
