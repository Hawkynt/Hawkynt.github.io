/* Scenery behind the board for each theme, painted once and scaled to cover the whole canvas so it
   bleeds into the letterbox at any window shape: meadow hills and trees, desert dunes and
   pyramids, a frozen lake under an aurora, a volcanic cavern, a neon skyline under the eclipse,
   the pocket LCD and the light-cycle grid. Per frame only drifting clouds, twinkles and glows are
   added, plus the festival's falling decor (snow, petals, leaves, bats, confetti, sun motes) and
   its colour wash. Owns the decor flake pool. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TAU } = NS.constants;
  const { THEMES } = NS.worlds;
  const K = NS.artKit;
  const IA = NS.itemArt;
  const { ctx, visible } = NS.view;

  const W = VIEW_W, H = VIEW_H;

  function hills(g, y, amp, freq, phase, col) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, y - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.35);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }

  function sky(g, top, bot) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bot);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  /* scenes are painted at plane resolution (not the sprite cache's double size) to keep memory low */
  const scenes = {};

  function scene(th) {
    if (scenes[th]) return scenes[th];
    const cv = K.makeCanvas(W, H);
    scenes[th] = { canvas: cv, w: W, h: H };
    paintScene(cv.getContext('2d'), th);
    return scenes[th];
  }

  function paintScene(g, th) {
    {
      const t = THEMES[th];
      const r = NS.rng.makeRng(th * 991 + 7);
      sky(g, t.skyTop, t.skyBot);
      switch (t.deco) {
        case 'flowers': {
          const sg = g.createRadialGradient(1050, 120, 10, 1050, 120, 160);
          sg.addColorStop(0, 'rgba(255,255,220,1)'); sg.addColorStop(0.25, 'rgba(255,240,170,0.8)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
          g.fillStyle = sg; g.fillRect(850, 0, 400, 320);
          hills(g, 430, 40, 0.004, 1, '#8ccf7a');
          hills(g, 500, 34, 0.006, 3, '#5fae4a');
          for (let k = 0; k < 9; ++k) {
            const x = r() * W, y = 470 + r() * 40;
            g.fillStyle = '#4a3a20'; g.fillRect(x - 3, y - 20, 6, 24);
            g.fillStyle = k % 2 ? '#3d8a32' : '#4f9a3a';
            g.beginPath(); g.arc(x, y - 30, 22, 0, TAU); g.arc(x - 14, y - 20, 15, 0, TAU); g.arc(x + 14, y - 20, 15, 0, TAU); g.fill();
          }
          hills(g, 600, 24, 0.008, 5, '#3f8a30');
          break;
        }
        case 'dunes': {
          const sg = g.createRadialGradient(640, 300, 20, 640, 300, 260);
          sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.2, 'rgba(255,220,140,0.9)'); sg.addColorStop(1, 'rgba(255,190,100,0)');
          g.fillStyle = sg; g.fillRect(300, 0, 680, 600);
          g.fillStyle = '#c08a4a';
          K.poly(g, [[150, 470], [270, 330], [390, 470]]); g.fill();
          K.poly(g, [[930, 470], [1010, 380], [1090, 470]]); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.12)';
          K.poly(g, [[270, 330], [390, 470], [300, 470]]); g.fill();
          hills(g, 480, 30, 0.003, 2, '#e8b870');
          hills(g, 560, 26, 0.005, 4, '#d8a058');
          hills(g, 640, 18, 0.007, 1, '#c89048');
          break;
        }
        case 'ice': {
          for (let k = 0; k < 120; ++k) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')'; g.fillRect(r() * W, r() * 360, 1.5, 1.5); }
          for (let b = 0; b < 3; ++b) {
            const ag = g.createLinearGradient(0, 80 + b * 40, 0, 260 + b * 40);
            ag.addColorStop(0, 'rgba(120,255,200,0)'); ag.addColorStop(0.5, b % 2 ? 'rgba(140,120,255,0.25)' : 'rgba(120,255,200,0.3)'); ag.addColorStop(1, 'rgba(120,255,200,0)');
            g.fillStyle = ag;
            g.beginPath(); g.moveTo(0, 120 + b * 40);
            for (let x = 0; x <= W; x += 20) g.lineTo(x, 120 + b * 40 + Math.sin(x * 0.006 + b) * 50);
            g.lineTo(W, 300 + b * 40); g.lineTo(0, 300 + b * 40); g.closePath(); g.fill();
          }
          g.fillStyle = '#5a7aa8';
          K.poly(g, [[0, 470], [140, 300], [260, 420], [420, 260], [600, 440], [760, 320], [920, 450], [1100, 280], [1280, 430], [1280, 520], [0, 520]]); g.fill();
          g.fillStyle = '#e8f6ff';
          K.poly(g, [[140, 300], [175, 345], [120, 330]]); g.fill();
          K.poly(g, [[420, 260], [470, 320], [390, 300]]); g.fill();
          K.poly(g, [[1100, 280], [1150, 340], [1070, 320]]); g.fill();
          const lg = g.createLinearGradient(0, 500, 0, H);
          lg.addColorStop(0, '#9cc4e8'); lg.addColorStop(1, '#4a7ab0');
          g.fillStyle = lg; g.fillRect(0, 500, W, H - 500);
          break;
        }
        case 'lava': {
          g.fillStyle = '#2a0a06';
          K.poly(g, [[300, 520], [560, 210], [720, 210], [980, 520]]); g.fill();
          const vg = g.createRadialGradient(640, 210, 5, 640, 210, 120);
          vg.addColorStop(0, 'rgba(255,200,80,0.9)'); vg.addColorStop(1, 'rgba(255,80,20,0)');
          g.fillStyle = vg; g.fillRect(500, 90, 280, 240);
          g.strokeStyle = '#ff7a2a'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(620, 215); g.quadraticCurveTo(600, 330, 520, 470); g.moveTo(660, 215); g.quadraticCurveTo(700, 360, 780, 480); g.stroke();
          g.fillStyle = '#140404';
          for (let k = 0; k < 16; ++k) { const x = k * 85 + r() * 30, l = 40 + r() * 90; K.poly(g, [[x, 0], [x + 30, 0], [x + 15, l]]); g.fill(); }
          hills(g, 600, 30, 0.006, 2, '#1a0806');
          break;
        }
        case 'neon':
        case 'tron': {
          for (let k = 0; k < 90; ++k) { g.fillStyle = 'rgba(255,255,255,' + r() * 0.8 + ')'; g.fillRect(r() * W, r() * 380, 1.4, 1.4); }
          if (t.deco === 'neon') {
            const eg = g.createRadialGradient(640, 200, 60, 640, 200, 160);
            eg.addColorStop(0, '#000000'); eg.addColorStop(0.62, '#000000'); eg.addColorStop(0.7, 'rgba(220,180,255,0.9)'); eg.addColorStop(1, 'rgba(192,140,255,0)');
            g.fillStyle = eg; g.fillRect(440, 0, 400, 400);
            for (let k = 0; k < 26; ++k) {
              const bw = 30 + r() * 40, bh = 60 + r() * 160, x = k * 50 - 10;
              g.fillStyle = '#0a0620'; g.fillRect(x, 470 - bh, bw, bh);
              g.fillStyle = r() < 0.5 ? 'rgba(192,140,255,0.6)' : 'rgba(111,211,255,0.5)';
              for (let wy = 470 - bh + 8; wy < 460; wy += 12) if (r() < 0.4) g.fillRect(x + 5 + r() * (bw - 12), wy, 4, 3);
            }
          }
          const acc = t.accent;
          g.strokeStyle = K.rgba(acc, 0.35);
          g.lineWidth = 1.2;
          for (let k = 0; k < 12; ++k) { const y = 470 + Math.pow(k / 11, 2) * 260; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
          for (let k = -16; k <= 16; ++k) { g.beginPath(); g.moveTo(640 + k * 20, 470); g.lineTo(640 + k * 140, H); g.stroke(); }
          break;
        }
        case 'lcd': {
          g.fillStyle = '#8bac0f'; g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(15,56,15,0.08)';
          for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
          break;
        }
      }
    }
  }

  /* ── festival decor flakes ── */
  const FLAKES = 46;
  const flakes = [];
  for (let k = 0; k < FLAKES; ++k) flakes.push({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8, p: Math.random() * TAU });

  const DECOR = {
    snow: { kind: 6, cols: ['#ffffff', '#e0f0ff'], vy: 40, vx: 10 },
    petals: { kind: 3, cols: ['#ffb0d0', '#ffd0e4', '#ffffff'], vy: 34, vx: 24 },
    leaves: { kind: 2, cols: ['#e0782a', '#c84a1a', '#ffb03a', '#a0582a'], vy: 38, vx: 18 },
    bats: { kind: 8, cols: ['#2a1a3a', '#4a2a6a'], vy: -12, vx: 50 },
    confetti: { kind: 7, cols: ['#ffd23a', '#ff5a8a', '#6fd3ff', '#7ee07a'], vy: 46, vx: 8 },
    motes: { kind: 0, cols: ['#fff2b0', '#ffe07a'], vy: -10, vx: 12 },
  };

  function drawDecor(dt, v, alpha) {
    const season = G.season;
    if (!season) return;
    const d = DECOR[season.decor];
    ctx.globalAlpha = alpha;
    for (let k = 0; k < flakes.length; ++k) {
      const f = flakes[k];
      f.p += dt * 1.5;
      f.y += d.vy * f.s * dt;
      f.x += (d.vx * f.s + Math.sin(f.p) * 20) * dt;
      if (f.y > v.y1 + 20) f.y = v.y0 - 20;
      if (f.y < v.y0 - 20) f.y = v.y1 + 20;
      if (f.x > v.x1 + 20) f.x = v.x0 - 20;
      if (f.x < v.x0 - 20) f.x = v.x1 + 20;
      const col = d.cols[k % d.cols.length];
      if (d.kind === 0) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow(col), f.x, f.y, 0.18 * f.s);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const spr = IA.shape(d.kind, col);
        const flap = d.kind === 8 ? 0.6 + Math.abs(Math.sin(f.p * 4)) * 0.6 : 1;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(d.kind === 8 ? 0 : f.p * 0.7);
        ctx.scale(f.s * 1.1, f.s * 1.1 * flap);
        ctx.drawImage(spr.canvas, -8, -8, 16, 16);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* cover the visible plane with the scene for theme th */
  function draw(th, dt) {
    const v = visible();
    const s = scene(th);
    const k = Math.max(v.w / W, v.h / H);
    const w = W * k, h = H * k;
    ctx.drawImage(s.canvas, (v.x0 + v.x1) / 2 - w / 2, (v.y0 + v.y1) / 2 - h / 2, w, h);
    const t = THEMES[th];
    const time = G.time;
    if (t.deco === 'flowers') {
      ctx.globalAlpha = 0.85;
      for (let c = 0; c < 4; ++c) {
        const x = ((time * (8 + c * 3) + c * 380) % (v.w + 400)) + v.x0 - 200, y = 60 + c * 50;
        cloud(x, y, 0.8 + c * 0.15);
      }
      ctx.globalAlpha = 1;
    } else if (t.deco === 'lava' || t.deco === 'neon') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + Math.sin(time * 1.3) * 0.12;
      K.blit(ctx, K.glow(t.deco === 'lava' ? '#ff6a2a' : '#c08cff'), 640, t.deco === 'lava' ? 210 : 200, 6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (G.season && t.deco !== 'lcd') {
      ctx.fillStyle = G.season.tint;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
    drawDecor(dt || 0, v, t.deco === 'lcd' ? 0 : 0.85);
  }

  function cloud(x, y, s) {
    const c = K.sprite('cloud', 160, 70, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(50, 42, 24, 0, TAU); g.arc(80, 30, 30, 0, TAU); g.arc(112, 42, 22, 0, TAU); g.arc(80, 48, 22, 0, TAU); g.fill();
    });
    K.blit(ctx, c, x, y, s);
  }

  Object.assign(NS.backdrop, {
    scene, draw, drawDecor
  });
})();
