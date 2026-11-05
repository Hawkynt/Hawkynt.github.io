/* Scenery behind the arena and the menus, painted once per scene at 1600 x 900 so it bleeds
   into the letterbox bars at any aspect ratio: Meadow hills, Frost caverns with aurora, the
   Foundry skyline over lava, the Neon city with its sun, the Shadow Keep under the moon, plus
   Fuse Village and the lab for cinematics. Live touches (sun pulse, lava glow, flicker) and the
   seasonal tint and ambient particles are layered on top each frame. Owns the current scene. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;
  const { WORLDS } = NS.story;
  const K = NS.artKit;
  const R = NS.rng;
  const BW = 1600, BH = 900, OX = -160, OY = -90;
  const TAU = Math.PI * 2;

  let current = 'village';
  let ambientT = 0;

  function setWorld(w) {
    current = WORLDS[w] ? WORLDS[w].id : 'meadow';
  }

  function setScene(name) {
    current = name;
  }

  function sky(x, top, bottom) {
    const g = x.createLinearGradient(0, 0, 0, BH);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fillRect(0, 0, BW, BH);
  }

  function hills(x, y, amp, color, seed, step) {
    const rng = R.makeRng(seed);
    x.fillStyle = color;
    x.beginPath(); x.moveTo(0, BH);
    let yy = y;
    for (let px = 0; px <= BW + step; px += step) {
      yy = y + Math.sin(px * 0.004 + seed) * amp + (rng() - 0.5) * amp * 0.4;
      x.lineTo(px, yy);
    }
    x.lineTo(BW, BH); x.closePath(); x.fill();
  }

  function stars(x, n, seed, h) {
    const rng = R.makeRng(seed);
    for (let i = 0; i < n; ++i) {
      x.fillStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.7) + ')';
      const s = rng() < 0.1 ? 2.5 : 1.4;
      x.fillRect(rng() * BW, rng() * h, s, s);
    }
  }

  function tree(x, tx, ty, s, leaf) {
    x.fillStyle = '#6a4a2a'; x.fillRect(tx - 5 * s, ty - 30 * s, 10 * s, 32 * s);
    K.ball(x, tx, ty - 46 * s, 30 * s, leaf);
    K.ball(x, tx - 20 * s, ty - 34 * s, 20 * s, K.shade(leaf, -0.1));
    K.ball(x, tx + 22 * s, ty - 36 * s, 22 * s, K.shade(leaf, 0.08));
  }

  function house(x, hx, hy, w, h, wall, roof, lit) {
    x.fillStyle = wall; x.fillRect(hx, hy - h, w, h);
    x.fillStyle = roof; x.beginPath(); x.moveTo(hx - 10, hy - h); x.lineTo(hx + w / 2, hy - h - w * 0.5); x.lineTo(hx + w + 10, hy - h); x.fill();
    x.fillStyle = lit; x.fillRect(hx + w * 0.2, hy - h * 0.7, w * 0.22, h * 0.25); x.fillRect(hx + w * 0.58, hy - h * 0.7, w * 0.22, h * 0.25);
    x.fillStyle = '#3a2a1a'; x.fillRect(hx + w * 0.4, hy - h * 0.4, w * 0.2, h * 0.4);
  }

  const PAINT = {
    meadow(x) {
      sky(x, '#5ab8f0', '#c9f0ff');
      K.circle(x, 1340, 150, 70, 'rgba(255,250,200,0.9)');
      for (let i = 0; i < 7; ++i) {
        const cx = 120 + i * 240, cy = 120 + (i % 3) * 50;
        for (let k = 0; k < 4; ++k) K.circle(x, cx + k * 34, cy + (k % 2) * -14, 30 + (k % 2) * 8, 'rgba(255,255,255,0.85)');
      }
      hills(x, 560, 50, '#8fd46a', 3, 40);
      hills(x, 660, 40, '#6cbf4a', 7, 30);
      for (let i = 0; i < 14; ++i) tree(x, 40 + i * 120 + (i % 2) * 40, 700 + (i % 3) * 30, 1 + (i % 3) * 0.2, i % 2 ? '#3f9a2e' : '#4fb03a');
      hills(x, 790, 20, '#3f8f2e', 11, 20);
      K.speckle(x, 5, 0, 790, BW, 110, 220, '#ffe066', 3);
      K.speckle(x, 6, 0, 790, BW, 110, 160, '#ffffff', 3);
    },
    frost(x) {
      sky(x, '#0a1a30', '#2a5a86');
      for (let i = 0; i < 3; ++i) {
        const g = x.createLinearGradient(0, 120 + i * 40, 0, 260 + i * 40);
        g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.5, 'rgba(120,255,200,' + (0.18 - i * 0.04) + ')'); g.addColorStop(1, 'rgba(120,180,255,0)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(0, 160 + i * 40);
        for (let px = 0; px <= BW; px += 50) x.lineTo(px, 160 + i * 40 + Math.sin(px * 0.006 + i) * 60);
        x.lineTo(BW, 320 + i * 40); x.lineTo(0, 320 + i * 40); x.fill();
      }
      stars(x, 120, 9, 400);
      for (let i = 0; i < 16; ++i) {
        const cx = i * 110 + 20, h = 120 + (i * 37) % 160;
        x.fillStyle = i % 2 ? 'rgba(160,220,255,0.55)' : 'rgba(120,180,230,0.5)';
        x.beginPath(); x.moveTo(cx - 40, BH - 140); x.lineTo(cx, BH - 140 - h); x.lineTo(cx + 40, BH - 140); x.fill();
      }
      x.fillStyle = '#1a3050';
      for (let i = 0; i < 40; ++i) { const cx = i * 42; x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx + 20, 40 + (i * 53) % 90); x.lineTo(cx + 40, 0); x.fill(); }
      hills(x, 780, 30, '#e6f4ff', 13, 30);
      hills(x, 840, 16, '#ffffff', 17, 24);
    },
    foundry(x) {
      sky(x, '#12060a', '#5a1a0e');
      for (let i = 0; i < 10; ++i) {
        const bx = i * 170 - 20, bh = 220 + (i * 71) % 180;
        x.fillStyle = '#1e1214'; x.fillRect(bx, BH - 120 - bh, 140, bh + 120);
        x.fillRect(bx + 20, BH - 120 - bh - 90, 26, 90); x.fillRect(bx + 90, BH - 120 - bh - 60, 20, 60);
        x.fillStyle = 'rgba(255,140,40,0.55)';
        for (let w = 0; w < 6; ++w) if ((i + w) % 3) x.fillRect(bx + 14 + (w % 3) * 40, BH - 100 - bh + 30 + Math.floor(w / 3) * 50, 18, 12);
      }
      for (let i = 0; i < 8; ++i) K.circle(x, 100 + i * 200, 160 + (i % 3) * 40, 60 + (i % 2) * 20, 'rgba(70,40,40,0.35)');
      const lava = x.createLinearGradient(0, BH - 110, 0, BH);
      lava.addColorStop(0, '#ff9a2a'); lava.addColorStop(0.4, '#ff4a0a'); lava.addColorStop(1, '#7a1a00');
      x.fillStyle = lava; x.fillRect(0, BH - 110, BW, 110);
      K.speckle(x, 21, 0, BH - 110, BW, 110, 160, 'rgba(255,230,120,0.6)', 4);
    },
    neon(x) {
      sky(x, '#06061a', '#3a0e5a');
      stars(x, 90, 4, 300);
      const sun = x.createLinearGradient(0, 160, 0, 480);
      sun.addColorStop(0, '#ffe066'); sun.addColorStop(1, '#ff3ab0');
      x.fillStyle = sun; x.beginPath(); x.arc(800, 470, 220, Math.PI, 0); x.fill();
      x.fillStyle = '#20093a';
      for (let i = 0; i < 7; ++i) x.fillRect(560, 300 + i * 26, 480, 4 + i * 2);
      for (let i = 0; i < 22; ++i) {
        const bx = i * 75, bh = 120 + (i * 97) % 230;
        x.fillStyle = '#100828'; x.fillRect(bx, 470 - bh, 66, bh);
        for (let w = 0; w < 10; ++w) {
          x.fillStyle = (i + w) % 4 ? 'rgba(126,249,255,0.55)' : 'rgba(255,79,216,0.6)';
          x.fillRect(bx + 8 + (w % 3) * 18, 470 - bh + 14 + Math.floor(w / 3) * 26, 10, 8);
        }
      }
      x.fillStyle = '#0a0418'; x.fillRect(0, 470, BW, BH - 470);
      x.strokeStyle = 'rgba(255,79,216,0.55)'; x.lineWidth = 2;
      for (let i = -20; i <= 20; ++i) { x.beginPath(); x.moveTo(800 + i * 30, 470); x.lineTo(800 + i * 160, BH); x.stroke(); }
      for (let k = 0; k < 9; ++k) { const y = 470 + Math.pow(k / 8, 2) * (BH - 470); x.beginPath(); x.moveTo(0, y); x.lineTo(BW, y); x.stroke(); }
    },
    keep(x) {
      sky(x, '#06040e', '#2a1838');
      stars(x, 200, 12, 600);
      K.circle(x, 1250, 170, 90, '#f4ecd8');
      K.circle(x, 1220, 150, 18, 'rgba(200,190,170,0.6)'); K.circle(x, 1280, 200, 12, 'rgba(200,190,170,0.5)');
      x.fillStyle = '#120a1c';
      for (let i = 0; i < 9; ++i) {
        const tx = 40 + i * 190, th = 260 + (i * 61) % 200;
        x.fillRect(tx, BH - th, 90, th);
        for (let m = 0; m < 4; ++m) x.fillRect(tx - 6 + m * 26, BH - th - 16, 16, 16);
        x.beginPath(); x.moveTo(tx - 10, BH - th - 16); x.lineTo(tx + 45, BH - th - 120); x.lineTo(tx + 100, BH - th - 16); x.fill();
        x.fillStyle = 'rgba(255,200,90,0.6)'; x.fillRect(tx + 36, BH - th + 50, 16, 26); x.fillStyle = '#120a1c';
      }
      x.fillStyle = '#1a1028'; x.fillRect(0, BH - 90, BW, 90);
      x.fillStyle = '#0a0612';
      for (let i = 0; i < 6; ++i) {
        const bx = 200 + i * 230, by = 260 + (i % 3) * 60;
        x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx - 14, by - 12, bx - 26, by - 2); x.quadraticCurveTo(bx - 12, by - 2, bx, by + 6);
        x.quadraticCurveTo(bx + 12, by - 2, bx + 26, by - 2); x.quadraticCurveTo(bx + 14, by - 12, bx, by); x.fill();
      }
    },
    village(x) {
      sky(x, '#0e1030', '#4a2a5a');
      stars(x, 160, 2, 500);
      for (let i = 0; i < 6; ++i) {
        const fx = 200 + i * 240, fy = 140 + (i % 3) * 60;
        const col = ['#ffd84a', '#ff5da0', '#4fd0ff', '#7cf08a', '#ff8a3c', '#c58bff'][i];
        for (let k = 0; k < 14; ++k) {
          const a = k / 14 * TAU;
          x.strokeStyle = K.rgba(col, 0.7); x.lineWidth = 3;
          x.beginPath(); x.moveTo(fx + Math.cos(a) * 12, fy + Math.sin(a) * 12); x.lineTo(fx + Math.cos(a) * 48, fy + Math.sin(a) * 48); x.stroke();
        }
      }
      hills(x, 640, 30, '#2a1a3a', 5, 40);
      for (let i = 0; i < 9; ++i) house(x, 30 + i * 180, 760 + (i % 2) * 10, 120, 110 + (i % 3) * 20, ['#c89a6a', '#d8b080', '#b08060'][i % 3], ['#8a2a2a', '#3a5a8a', '#5a3a2a'][i % 3], '#ffd27a');
      x.strokeStyle = '#2a1a1a'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, 560); x.quadraticCurveTo(400, 640, 800, 560); x.quadraticCurveTo(1200, 640, 1600, 560); x.stroke();
      for (let i = 0; i < 24; ++i) {
        const t = i / 24, lx = t * BW;
        const ly = 560 + Math.sin(t * TAU * 2) * -40 + 40 * Math.abs(Math.sin(t * Math.PI * 2));
        K.circle(x, lx, ly + 6, 7, ['#ff5d5d', '#ffd84a', '#4fd0ff', '#7cf08a'][i % 4]);
      }
      x.fillStyle = '#3a2a2a'; x.fillRect(0, 800, BW, 100);
      x.fillStyle = '#4a3a3a'; for (let i = 0; i < 40; ++i) x.fillRect(i * 42 + (i % 2) * 20, 810 + (i % 3) * 22, 34, 12);
    },
    lab(x) {
      sky(x, '#3a2a24', '#1a1210');
      x.fillStyle = '#4a3428'; for (let i = 0; i < 16; ++i) x.fillRect(i * 100, 0, 92, 680);
      x.fillStyle = '#2a4a6a'; x.fillRect(620, 120, 360, 240);
      stars(x, 30, 3, 0);
      x.fillStyle = '#0e1030'; x.fillRect(630, 130, 340, 220);
      x.strokeStyle = '#6a4a3a'; x.lineWidth = 10; x.strokeRect(620, 120, 360, 240); x.beginPath(); x.moveTo(800, 120); x.lineTo(800, 360); x.stroke();
      for (let s = 0; s < 3; ++s) {
        x.fillStyle = '#6a4a3a'; x.fillRect(80, 180 + s * 130, 380, 14); x.fillRect(1140, 180 + s * 130, 380, 14);
        for (let b = 0; b < 6; ++b) {
          K.ball(x, 120 + b * 60, 160 + s * 130, 18, b % 2 ? '#2a2d3a' : '#b0201a');
          K.ball(x, 1180 + b * 60, 160 + s * 130, 16, ['#4fd0ff', '#7cf08a', '#ffd84a'][b % 3]);
        }
      }
      x.fillStyle = '#5a5a66'; x.fillRect(560, 480, 480, 220);
      for (let i = 0; i < 8; ++i) K.circle(x, 600 + i * 56, 530, 12, ['#ff5d5d', '#7cf08a', '#ffd84a', '#4fd0ff'][i % 4]);
      x.fillStyle = '#2a2a30'; x.fillRect(600, 580, 400, 80);
      x.fillStyle = '#7cf08a'; for (let i = 0; i < 40; ++i) x.fillRect(610 + i * 10, 620 - Math.abs(Math.sin(i * 0.7)) * 30, 6, 4);
      x.fillStyle = '#2a1e18'; x.fillRect(0, 700, BW, 200);
    }
  };

  function scene(name) {
    return K.sprite('scene:' + name, BW, BH, (x) => (PAINT[name] || PAINT.meadow)(x));
  }

  /* Draws the current scene so it covers the whole visible plane, then the live touches */
  function draw(name, dim) {
    const ctx = NS.view.ctx;
    const v = NS.view.visible();
    const id = name || current;
    const s = scene(id);
    const k = Math.max(v.w / BW, v.h / BH, 1);
    const w = BW * k, h = BH * k;
    ctx.drawImage(s, 640 - w / 2, 360 - h / 2, w, h);
    const t = G.time;
    ctx.globalCompositeOperation = 'lighter';
    if (id === 'meadow') { ctx.globalAlpha = 0.25 + Math.sin(t) * 0.08; K.blit(ctx, K.glow('#fff4b0'), 640 + (1340 - 800) * k, 360 + (150 - 450) * k, 4 * k); }
    else if (id === 'foundry') { ctx.globalAlpha = 0.25 + Math.sin(t * 2.1) * 0.12; ctx.drawImage(K.glow('#ff6a1a'), v.x0 - 100, v.y1 - 200, v.w + 200, 400); }
    else if (id === 'neon') { ctx.globalAlpha = 0.18 + Math.sin(t * 7) * 0.05 + (Math.sin(t * 23) > 0.95 ? 0.15 : 0); K.blit(ctx, K.glow('#ff3ab0'), 640, 360 + 20 * k, 7 * k); }
    else if (id === 'keep') { ctx.globalAlpha = 0.3; K.blit(ctx, K.glow('#f4ecd8'), 640 + (1250 - 800) * k, 360 + (170 - 450) * k, 3.2 * k); }
    else if (id === 'frost') { ctx.globalAlpha = 0.12 + Math.sin(t * 0.7) * 0.06; ctx.drawImage(K.glow('#78ffc8'), v.x0, v.y0 - 100, v.w, 500); }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (G.season && G.season.def) {
      ctx.fillStyle = G.season.def.tint;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
    if (dim) {
      ctx.fillStyle = 'rgba(8,4,12,' + dim + ')';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
  }

  /* Seasonal ambient particles across the view (snow, petals, motes, leaves, confetti) */
  function seasonTick(dt) {
    if (!G.season) return;
    ambientT -= dt;
    if (ambientT > 0) return;
    ambientT = G.season.id === 'summer' ? 0.25 : 0.12;
    NS.fx.ambient(G.season.def.particle, NS.view.visible());
    if (current === 'foundry' && Math.random() < 0.5) NS.fx.ambient('embers', NS.view.visible());
    if ((current === 'keep' || current === 'neon') && Math.random() < 0.3) NS.fx.ambient('dust', NS.view.visible());
  }

  function warm(i) {
    const names = ['village', 'meadow', 'frost', 'foundry', 'neon', 'keep', 'lab'];
    if (i < names.length) scene(names[i]);
    return i < names.length;
  }

  Object.assign(NS.backdrop, {
    BW, BH, OX, OY, setWorld, setScene, scene, draw, seasonTick, warm, getCurrent: () => current
  });
})();
