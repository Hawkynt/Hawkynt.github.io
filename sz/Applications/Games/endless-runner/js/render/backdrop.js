/* The sky behind a world, filling the whole canvas at any window shape: the world's gradient,
   sun or moon with its glow, stars and twinkles at night, the aurora of Frostpeak and the
   Rift's tear, three parallax strips scrolling at their own depth (vertically too when the
   camera looks up), a solid fill under the nearest strip, and in front of everything the
   world's weather, the festival's decor and tint, and a soft vignette. Where the run climbs or
   drops, the world's vertical scene takes over (far wall, middle layer and a near column on the
   open side, scrolling up or down the screen) and the two crossfade while the view turns; the
   scenery scrolls by the camera's on-screen travel, so it reverses smoothly in a turnaround.
   Crossfades between two worlds when Arcade moves on. Per frame it only blits cached strips -
   and it composes the whole backdrop with the festival tint and the vignette in an opaque
   offscreen canvas at view-plane resolution (the strips are painted at that resolution anyway),
   so the screen gets one opaque blit instead of half a dozen full-screen translucent layers.
   Owns that offscreen canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, GROUND_Y, TAU } = NS.constants;
  const { WORLDS } = NS.worlds;
  const K = NS.artKit;
  const BA = NS.backdropArt;
  const VA = NS.vertArt;
  const main = NS.view.ctx;
  /* where the scenery is drawn right now: the offscreen backdrop, or the screen for cinematics */
  let ctx = main;
  const BG = { canvas: null, ctx: null, w: 0, h: 0, ox: 0, oy: 0 };
  /* cached full-size layers: a world's sky (gradient, stars, sun or moon), the tint and vignette */
  const skies = [];
  const OVER = { canvas: null, key: '' };

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

  /* a strip repeated across the view, copied pixel for pixel (no scaling, whole pixels) */
  function tile(spr, off, y, v) {
    const tw = spr.w;
    let x = v.x0 - (((off + v.x0) % tw) + tw) % tw;
    for (; x < v.x1; x += tw) ctx.drawImage(spr.canvas, Math.floor(x), Math.floor(y));
  }

  /* the visible rect in whole plane units */
  function rectOf(v, out) {
    out.ox = Math.floor(v.x0); out.oy = Math.floor(v.y0);
    out.w = Math.ceil(v.x1) - out.ox; out.h = Math.ceil(v.y1) - out.oy;
    return out;
  }
  const RC = {};

  /* a world's sky painted once per view size: the gradient, the night's stars and the sun or
     moon with its glow (they sit far enough away not to move) */
  function sky(w, v) {
    const r = rectOf(v, RC);
    const key = w + ':' + r.ox + ',' + r.oy + ',' + r.w + 'x' + r.h;
    for (let i = 0; i < skies.length; ++i) if (skies[i].key === key) return skies[i];
    const s = skies.length < 2 ? { canvas: K.makeCanvas(r.w, r.h), key: '' } : skies.shift();
    skies.push(s);
    s.key = key;
    if (s.canvas.width !== r.w || s.canvas.height !== r.h) { s.canvas.width = r.w; s.canvas.height = r.h; }
    const g = s.canvas.getContext('2d');
    const W = WORLDS[w];
    g.setTransform(1, 0, 0, 1, -r.ox, -r.oy);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = skyFill(w);
    g.fillRect(r.ox, r.oy, r.w, r.h);
    if (W.night) {
      const st = BA.stars(w);
      g.globalAlpha = 0.9;
      for (let y = -40; y > r.oy - st.h; y -= st.h)
        for (let x = r.ox - (r.ox % st.w + st.w) % st.w; x < r.ox + r.w; x += st.w) g.drawImage(st.canvas, x, Math.floor(y));
      g.globalAlpha = 1;
    }
    const sx = W.sunX * VIEW_W, py = W.sunY * VIEW_H;
    g.globalCompositeOperation = 'lighter';
    K.blitAlpha(g, K.glow(W.sun), sx, py, 7, 0.55);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = W.sun;
    g.beginPath(); g.arc(sx, py, W.night ? 34 : 44, 0, TAU); g.fill();
    if (W.night) {
      g.fillStyle = K.rgba(W.sky[1], 0.55);
      g.beginPath(); g.arc(sx + 14, py - 8, 30, 0, TAU); g.fill();
    }
    s.ox = r.ox; s.oy = r.oy; s.w = r.w; s.h = r.h;
    return s;
  }

  /* one world's sky and scenery; cam: {x, y, zoom} */
  function world(w, cam, alpha) {
    const v = NS.view.visible();
    const W = WORLDS[w];
    const t = G.time;
    const lift = -cam.y * cam.zoom;
    const s = sky(w, v);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, s.ox, s.oy, s.w, s.h);
    if (W.night) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; ++i) {
        const a = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) + i * 2);
        K.blitAlpha(ctx, K.glow('#ffffff'), ((i * 173 + 40) % 1240), 30 + (i * 67) % 260 + lift * 0.05, 0.3, a * alpha);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
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
      tile(spr, scrollX(cam) * L.px, y, v);
      if (i === LAYERS.length - 1 && y + spr.h < v.y1) {
        ctx.fillStyle = W.near;
        ctx.fillRect(v.x0, y + spr.h - 1, v.w, v.y1 - y - spr.h + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function scrollX(cam) {
    return cam.sx !== undefined ? cam.sx : cam.x * cam.zoom;
  }

  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /* a tile repeated over the visible rect, both ways, pixel for pixel */
  function tile2(spr, offX, offY, v) {
    const x0 = Math.floor(v.x0 - mod(offX + v.x0, spr.w)), y0 = Math.floor(v.y0 - mod(offY + v.y0, spr.h));
    for (let y = y0; y < v.y1; y += spr.h)
      for (let x = x0; x < v.x1; x += spr.w) ctx.drawImage(spr.canvas, x, y);
  }

  /* one world's vertical scene; the near column frames the side away from the floor */
  function vworld(w, cam, alpha) {
    const v = NS.view.visible();
    const sx = cam.sx || 0, sy = cam.sy || 0;
    const o = cam.o;
    ctx.globalAlpha = alpha;
    tile2(VA.layer('far', w), sx * 0.08, sy * 0.12, v);
    ctx.globalAlpha = alpha * 0.62;
    tile2(VA.layer('mid', w), sx * 0.2 + 120, sy * 0.34, v);
    ctx.globalAlpha = alpha;
    const near = VA.layer('near', w);
    const airLeft = !o || Math.sin(o.a) <= 0;
    const r = rectOf(v, RC);
    const y0 = Math.floor(v.y0 - mod(sy * 0.7 + v.y0, near.h));
    for (let y = y0; y < v.y1; y += near.h) {
      if (airLeft) ctx.drawImage(near.canvas, r.ox, y);
      else {
        ctx.translate(r.ox + r.w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(near.canvas, 0, y);
        ctx.scale(-1, 1);
        ctx.translate(-r.ox - r.w, 0);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* a world's scenery for how vertical the view is right now */
  function scene(w, cam, alpha) {
    const vert = cam.o ? cam.o.vert : 0;
    if (vert < 0.999) world(w, cam, alpha);
    if (vert > 0.001) vworld(w, cam, alpha * vert);
  }

  /* the offscreen backdrop, one canvas pixel per plane unit, over the visible rect */
  function target(v) {
    const r = rectOf(v, RC);
    if (!BG.canvas || BG.w !== r.w || BG.h !== r.h) {
      if (!BG.canvas) {
        BG.canvas = K.makeCanvas(r.w, r.h);
        BG.ctx = BG.canvas.getContext('2d', { alpha: false }) || BG.canvas.getContext('2d');
      }
      BG.canvas.width = r.w;
      BG.canvas.height = r.h;
      BG.w = r.w; BG.h = r.h;
    }
    BG.ox = r.ox; BG.oy = r.oy;
    const g = BG.ctx;
    g.setTransform(1, 0, 0, 1, -r.ox, -r.oy);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return g;
  }

  /* the festival tint and the vignette (and, in a climb or drop, the real light from above or
     below) as one cached full-size layer */
  function overlay(w, vert) {
    const tint = G.season ? G.season.tint : '';
    const light = vert > 0.5 ? w : -1;
    const key = BG.w + 'x' + BG.h + ':' + tint + ':' + light;
    if (OVER.key !== key) {
      if (!OVER.canvas) OVER.canvas = K.makeCanvas(BG.w, BG.h);
      OVER.canvas.width = BG.w;
      OVER.canvas.height = BG.h;
      const g = OVER.canvas.getContext('2d');
      if (light >= 0) g.drawImage(VA.light(w).canvas, 0, 0, BG.w, BG.h);
      if (tint) { g.fillStyle = tint; g.fillRect(0, 0, BG.w, BG.h); }
      g.drawImage(vignetteSprite().canvas, 0, 0, BG.w, BG.h);
      OVER.key = key;
    }
    return OVER.canvas;
  }

  /* a climb or drop coming up: paint its art a piece per frame before the turn starts */
  function warmAhead(run) {
    const ds = run.course.dirs;
    const x = run.p.x;
    for (let i = ds.length - 1; i > 0; --i)
      if (ds[i].x > x && ds[i].x - x < 5000 && NS.orient.VERT[ds[i].dir]) { VA.warm(run.world); return; }
  }

  function draw(run, cam) {
    const v = NS.view.visible();
    if (run && run.course) warmAhead(run);
    ctx = target(v);
    if (run && run.worldFade > 0 && run.worldFrom !== run.world) {
      scene(run.worldFrom, cam, 1);
      scene(run.world, cam, 1 - run.worldFade);
    } else scene(run ? run.world : 0, cam, 1);
    ctx.drawImage(overlay(run ? run.world : 0, cam.o ? cam.o.vert : 0), BG.ox, BG.oy);
    ctx = main;
    main.drawImage(BG.canvas, BG.ox, BG.oy, BG.w, BG.h);
  }

  /* ── in front: weather, festival decor, tint, vignette ── */
  function weather(w, cam) {
    const v = NS.view.visible();
    const t = G.time;
    const kind = WORLDS[w].weather;
    const span = v.w + 80;
    const n = kind === 'rain' ? 70 : kind === 'pollen' || kind === 'void' ? 20 : 46;
    /* drift with the scenery's on-screen travel, sideways or up and down */
    const scx = scrollX(cam), scy = cam.sy || 0;
    const hy = v.h + 40;
    for (let i = 0; i < n; ++i) {
      const seed = i * 97.31;
      if (kind === 'snow') {
        const x = v.x0 + ((seed * 13 - scx * 0.6 - t * 30 + Math.sin(t + i) * 30) % span + span) % span - 40;
        const y = v.y0 + ((seed * 7 - scy * 0.6 + t * (50 + (i % 5) * 14)) % hy + hy) % hy - 20;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + (i % 3) * 0.15) + ')';
        ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
      } else if (kind === 'rain') {
        const x = v.x0 + ((seed * 11 - scx * 0.9 - t * 260) % span + span) % span - 40;
        const y = v.y0 + ((seed * 5 - scy * 0.9 + t * 900) % hy + hy) % hy - 30;
        ctx.strokeStyle = 'rgba(160,200,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 22); ctx.stroke();
      } else if (kind === 'sand') {
        const x = v.x0 + ((seed * 17 - scx * 0.8 - t * 420) % span + span) % span - 40;
        const y = v.y0 + ((seed * 3.7 - scy * 0.8) % v.h + v.h) % v.h;
        ctx.fillStyle = 'rgba(255,220,170,0.35)';
        ctx.fillRect(x, y, 26 + (i % 4) * 8, 2);
      } else {
        const x = v.x0 + ((seed * 13 - scx * 0.5 + Math.sin(t * 0.7 + i) * 40) % span + span) % span - 40;
        const y = v.y0 + (((seed * 5 - scy * 0.5 - t * (kind === 'void' ? 40 : 14)) % v.h) + v.h) % v.h;
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
      const x = v.x0 + ((seed * 9 - scrollX(cam) * 0.7 - t * 40 + Math.sin(t * 0.8 + i) * 50) % span + span) % span - 40;
      const fall = sea.decor === 'bats' ? -1 : 1;
      const y = v.y0 + (((seed * 3 - (cam.sy || 0) * 0.7 + fall * t * (40 + (i % 4) * 12)) % (v.h + 40)) + v.h + 40) % (v.h + 40) - 20;
      const s = 10 + (i % 3) * 4;
      if (shape === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(cols[i % 3]), x, y, 0.3, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      const spr = NS.propArt.shape(NS.fx.SHAPES[shape], cols[i % 3]);
      const a = t * (1 + (i % 3)) + i;
      const rot = sea.decor === 'bats' ? Math.sin(a) * 0.3 : a;
      ctx.globalAlpha = 0.75;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(spr.canvas, -s / 2, -s / 2, s, s);
      ctx.rotate(-rot);
      ctx.translate(-x, -y);
    }
    ctx.globalAlpha = 1;
  }

  function vignetteSprite() {
    return K.sprite('vignette', 128, 72, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,10,0.42)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }

  function vignette() {
    const v = NS.view.visible();
    ctx.drawImage(vignetteSprite().canvas, v.x0, v.y0, v.w, v.h);
  }

  Object.assign(NS.backdrop, {
    LAYERS, draw, world, vworld, weather, decor, vignette
  });
})();
