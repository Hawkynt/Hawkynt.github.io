;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.sceneKit || (NS.sceneKit = {});
  const { VIEW_W, VIEW_H, STRIP_W, CAM_REF, WORLD_COUNT, TWO_PI, makeCanvas, mulberry, rgba, mix, linear, radial, glow, grain, stars, BUILDERS, cropStrip, BAND_H, band } = Kit;

  /*
   * Scenery: the skies (painted at 960 x 540, drawn covering the visible rect), the per-world
   * scene cache and its per-frame drawing, and the public SZ.PlatformerScene API.
   */

  const SKY_W = 960, SKY_H = 540;

  function paintSky(world, rand) {
    /* painted in 960 x 540 units onto a full 1280 x 720 canvas, so the usual
       16:9 window blits it one to one */
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c.getContext('2d');
    g.scale(VIEW_W / SKY_W, VIEW_H / SKY_H);
    const W = SKY_W, H = SKY_H;
    if (world === 0) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#2d6cc9'], [0.38, '#5f9fe6'], [0.66, '#a9d2f2'], [0.85, '#f6e7c4'], [1, '#ffd9a0']]);
      g.fillRect(0, 0, W, H);
      /* the sun, with a broad warm bloom */
      g.fillStyle = radial(g, 720, 120, 0, 420, [[0, 'rgba(255,248,220,0.85)'], [0.12, 'rgba(255,236,170,0.45)'], [0.4, 'rgba(255,220,150,0.12)'], [1, 'rgba(255,220,150,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = radial(g, 720, 120, 0, 40, [[0, '#ffffff'], [0.6, '#fff6d0'], [1, 'rgba(255,240,190,0)']]);
      g.beginPath(); g.arc(720, 120, 40, 0, TWO_PI); g.fill();
      /* wispy high cirrus */
      for (let i = 0; i < 14; ++i) {
        const y = 40 + rand() * 180, x = rand() * W, w = 120 + rand() * 260;
        g.fillStyle = 'rgba(255,255,255,' + (0.06 + rand() * 0.1).toFixed(3) + ')';
        g.beginPath(); g.ellipse(x, y, w, 4 + rand() * 6, -0.05, 0, TWO_PI); g.fill();
      }
    } else if (world === 1) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#04060e'], [0.4, '#0a1626'], [0.75, '#123048'], [1, '#0c2234']]);
      g.fillRect(0, 0, W, H);
      /* far luminous chambers deep in the rock */
      const spots = [[200, 300, '#3a8ad8'], [520, 260, '#7a5ad8'], [800, 330, '#2ac0c8'], [640, 420, '#4a7ae8']];
      for (const s of spots) {
        g.fillStyle = radial(g, s[0], s[1], 0, 260, [[0, rgba(s[2], 0.35)], [0.5, rgba(s[2], 0.1)], [1, rgba(s[2], 0)]]);
        g.fillRect(0, 0, W, H);
      }
      stars(g, W, H, rand, 160, '#9ad8ff');
    } else if (world === 2) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#070d26'], [0.35, '#1b2a62'], [0.62, '#4a4f92'], [0.82, '#c88aa8'], [1, '#ffc6a8']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.7, rand, 420, '#e8f0ff');
      /* a pale moon */
      g.fillStyle = radial(g, 230, 110, 0, 160, [[0, 'rgba(220,235,255,0.5)'], [0.3, 'rgba(200,220,255,0.12)'], [1, 'rgba(200,220,255,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#eef4ff';
      g.beginPath(); g.arc(230, 110, 26, 0, TWO_PI); g.fill();
      g.fillStyle = 'rgba(160,180,220,0.35)';
      g.beginPath(); g.arc(222, 104, 6, 0, TWO_PI); g.fill();
      g.beginPath(); g.arc(238, 118, 4, 0, TWO_PI); g.fill();
      g.beginPath(); g.arc(240, 100, 3, 0, TWO_PI); g.fill();
    } else if (world === 3) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#0e0406'], [0.35, '#2e0c0c'], [0.65, '#6a1c10'], [0.88, '#c8461a'], [1, '#ff8a30']]);
      g.fillRect(0, 0, W, H);
      /* ash clouds lit from below */
      for (let i = 0; i < 26; ++i) {
        const x = rand() * W, y = 60 + rand() * 260, r = 60 + rand() * 120;
        const lit = y / H;
        g.fillStyle = radial(g, x, y, 0, r, [[0, rgba(mix('#2a0e0e', '#c8501e', lit), 0.45)], [1, rgba('#2a0e0e', 0)]]);
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.fillStyle = radial(g, 480, 560, 0, 520, [[0, 'rgba(255,170,60,0.55)'], [0.4, 'rgba(255,110,40,0.2)'], [1, 'rgba(255,90,30,0)']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.4, rand, 60, '#ffb070');
    } else {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#1c1448'], [0.3, '#4a3a98'], [0.58, '#a07ad0'], [0.8, '#f4b8b0'], [1, '#ffe2a8']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.45, rand, 180, '#fff0ff');
      /* a low golden sun */
      g.fillStyle = radial(g, 300, 400, 0, 480, [[0, 'rgba(255,240,190,0.8)'], [0.15, 'rgba(255,214,150,0.4)'], [0.5, 'rgba(255,180,160,0.1)'], [1, 'rgba(255,180,160,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = radial(g, 300, 400, 0, 48, [[0, '#ffffff'], [0.7, '#fff0c0'], [1, 'rgba(255,230,170,0)']]);
      g.beginPath(); g.arc(300, 400, 48, 0, TWO_PI); g.fill();
      /* god rays fanning out of the sun */
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; ++i) {
        const a = -Math.PI * 0.95 + i * 0.12 + rand() * 0.06;
        g.fillStyle = 'rgba(255,230,180,0.05)';
        g.beginPath();
        g.moveTo(300, 400);
        g.lineTo(300 + Math.cos(a - 0.03) * 900, 400 + Math.sin(a - 0.03) * 900);
        g.lineTo(300 + Math.cos(a + 0.03) * 900, 400 + Math.sin(a + 0.03) * 900);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    grain(g, W, H, rand, 2, 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0.03)');
    return c;
  }

  const cache = {};

  function create(world) {
    world = Math.max(0, Math.min(WORLD_COUNT - 1, world | 0));
    if (cache[world])
      return cache[world];
    const rand = mulberry(0x51ed + world * 7919);
    const sky = paintSky(world, rand);
    const def = BUILDERS[world](rand);
    const layers = def.layers.map(l => ({
      img: l.s.c, w: STRIP_W, h: l.s.c.height, y: l.y, f: l.f, vx: l.vx || 0, vy: l.vy || 0,
      fill: l.fill || null, fillTop: l.fillTop || null, alpha: l.alpha === undefined ? 1 : l.alpha,
      shimmer: !!l.shimmer, rain: !!l.rain, bob: l.bob || 0, add: !!l.add
    }));
    for (const L of layers)
      cropStrip(L);
    const glows = def.glows.map(gl => Object.assign({ img: glow(gl.color, gl.r) }, gl));
    const fr = def.front;
    const front = {
      top: fr.top ? band(fr.top, fr.topA, true) : null,
      bottom: fr.bottom ? band(fr.bottom, fr.bottomA, false) : null
    };

    /* device-pixel snapping: whole-pixel blits at scale 1 skip resampling */
    let ta = 1, te = 0, td = 1, tf = 0;
    function readTransform(ctx) {
      const m = ctx.getTransform ? ctx.getTransform() : null;
      ta = m && m.a ? m.a : 1; te = m ? m.e : 0; td = m && m.d ? m.d : 1; tf = m ? m.f : 0;
    }
    function snapX(x) { return (Math.round(x * ta + te) - te) / ta; }
    function snapY(y) { return (Math.round(y * td + tf) - tf) / td; }

    function drawSky(ctx, v) {
      const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
      const s = Math.max(1, vw / VIEW_W, vh / VIEW_H);
      const w = VIEW_W * s, h = VIEW_H * s;
      /* centred on the view, but never leaving a gap at an edge */
      let x = Math.min(v.x0, Math.max(v.x1 - w, VIEW_W / 2 - w / 2));
      let y = Math.min(v.y0, Math.max(v.y1 - h, VIEW_H / 2 - h / 2));
      x = snapX(x);
      y = snapY(y);
      ctx.drawImage(sky, x, y, s === 1 ? VIEW_W : w + 1, s === 1 ? VIEW_H : h + 1);
    }

    function drawLayer(ctx, L, v, camX, camY, t) {
      const W = L.w;
      let off = (camX * L.f + t * L.vx) % W;
      if (off < 0) off += W;
      let y = L.y - (camY - CAM_REF) * L.f * 0.5;
      if (L.bob)
        y += Math.sin(t * 0.6) * L.bob;
      const prevAlpha = ctx.globalAlpha;
      let a = L.alpha;
      if (L.shimmer)
        a *= 0.75 + 0.25 * Math.sin(t * 0.8);
      ctx.globalAlpha = prevAlpha * a;
      const prevOp = ctx.globalCompositeOperation;
      if (L.add)
        ctx.globalCompositeOperation = 'lighter';
      if (L.rain) {
        /* a falling sheet: tiles vertically as well */
        let oy = (t * L.vy) % L.h;
        for (let yy = v.y0 - L.h + ((oy - v.y0) % L.h + L.h) % L.h; yy < v.y1; yy += L.h)
          for (let x = v.x0 - ((v.x0 + off) % W + W) % W; x < v.x1; x += W)
            ctx.drawImage(L.img, snapX(x), snapY(yy), W, L.h);
        ctx.globalAlpha = prevAlpha;
        return;
      }
      y = snapY(y);
      for (let x = v.x0 - ((v.x0 + off) % W + W) % W; x < v.x1; x += W)
        ctx.drawImage(L.img, snapX(x), y, W, L.h);
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevOp;
      if (L.fill && y + L.h < v.y1) {
        ctx.fillStyle = L.fill;
        ctx.fillRect(v.x0, y + L.h - 1, v.x1 - v.x0, v.y1 - (y + L.h) + 1);
      }
      if (L.fillTop && y > v.y0) {
        ctx.fillStyle = L.fillTop;
        ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, y - v.y0 + 1);
      }
    }

    function drawGlows(ctx, v, camX, camY, t) {
      const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < glows.length; ++i) {
        const gl = glows[i];
        let x, y;
        if (gl.fixed) {
          x = gl.x * VIEW_W;
          y = gl.y * VIEW_H;
        } else if (gl.strip) {
          const W = STRIP_W;
          let base = gl.x * W - ((camX * gl.f) % W);
          base = v.x0 + (((base - v.x0) % W) + W) % W;
          x = base;
          y = gl.sy - (camY - CAM_REF) * gl.f * 0.5;
        } else {
          const W = VIEW_W * 1.5;
          x = v.x0 + ((((gl.x * W - camX * gl.f) - v.x0) % W) + W) % W;
          y = gl.y * VIEW_H;
        }
        const k = 1 - gl.pulse + gl.pulse * Math.sin(t * (gl.speed || 1) + i * 1.7);
        ctx.globalAlpha = prevA * k * 0.8;
        ctx.drawImage(gl.img, snapX(x - gl.img.width / 2), snapY(y - gl.img.height / 2), gl.img.width, gl.img.height);
      }
      ctx.globalCompositeOperation = prevOp;
      ctx.globalAlpha = prevA;
    }

    function drawBack(ctx, v, camX, camY, t) {
      camX = camX || 0;
      camY = camY === undefined ? CAM_REF : camY;
      t = t || 0;
      readTransform(ctx);
      drawSky(ctx, v);
      const firstStrip = world === 1 ? 0 : 1;
      for (let i = 0; i < layers.length; ++i) {
        if (i === firstStrip)
          drawGlows(ctx, v, camX, camY, t);
        drawLayer(ctx, layers[i], v, camX, camY, t);
      }
    }

    function drawFront(ctx, v, camX, camY, t) {
      void camX; void camY; void t;
      readTransform(ctx);
      const w = v.x1 - v.x0;
      const bw = w <= VIEW_W + 0.5 ? VIEW_W : w;
      const bx = snapX(w <= VIEW_W + 0.5 ? v.x0 + (w - VIEW_W) / 2 : v.x0);
      if (front.top)
        ctx.drawImage(front.top, bx, snapY(v.y0), bw, BAND_H);
      if (front.bottom)
        ctx.drawImage(front.bottom, bx, snapY(v.y1 - BAND_H), bw, BAND_H);
    }

    function drawMenu(ctx, v, t) {
      drawBack(ctx, v, t * 40, CAM_REF + Math.sin(t * 0.2) * 20, t);
    }

    const scene = Object.freeze({ world: world, palette: Object.freeze(def.palette), drawBack: drawBack, drawFront: drawFront, drawMenu: drawMenu });
    cache[world] = scene;
    return scene;
  }

  SZ.PlatformerScene = Object.freeze({ WORLD_COUNT, STRIP_W, create });
})();
