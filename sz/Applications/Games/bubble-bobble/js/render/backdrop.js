/* The world behind the room, per kingdom: a sky, a far layer and a near layer painted once
   into cached sprites (glowing neon hedges and lantern towers under a pink moon; ice spires and
   frozen crystals; brass gears, pipes and steam; a deep reef with light shafts, coral and kelp;
   a dark machine against a fading nebula) that drift slowly, ambient
   particles (fireflies, snow glints, sparks, bubbles, dust), the festival's decor and tint on
   top, and a vignette that reddens on the last life. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const K = NS.artKit;
  const { VIEW_W, VIEW_H, TAU } = NS.constants;
  const { WORLDS } = NS.worldData;
  const { ctx } = NS.view;

  const motes = [];
  for (let i = 0; i < 60; ++i) motes.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: Math.random(), p: Math.random() * TAU });
  const decor = [];
  for (let i = 0; i < 46; ++i) decor.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.5 + Math.random(), p: Math.random() * TAU, r: Math.random() * TAU });

  function sky(w) {
    const W = WORLDS[w];
    return K.sprite('sky:' + w, 8, VIEW_H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H);
      gr.addColorStop(0, W.sky[0]);
      gr.addColorStop(1, W.sky[1]);
      g.fillStyle = gr;
      g.fillRect(0, 0, 8, VIEW_H);
    });
  }

  function far(w) {
    const W = WORLDS[w];
    return K.sprite('far:' + w, VIEW_W, VIEW_H, (g) => {
      const r = NS.rng.makeRng(101 + w);
      if (W.style === 'garden') {
        K.circle(g, 1060, 130, 56, 'rgba(255,220,240,0.9)');
        for (let k = 0; k < 3; ++k) K.circle(g, 1060, 130, 86 + k * 40, 'rgba(255,170,220,' + (0.1 - k * 0.03) + ')');
        hills(g, 520, '#3a1a5a', r, 50);
        for (let i = 0; i < 7; ++i) tower(g, 60 + i * 190 + r.range(-30, 30), 540 - r.range(40, 180), r.range(40, 70), '#2a1040', r);
        for (let i = 0; i < 30; ++i) K.circle(g, r.range(0, VIEW_W), r.range(420, 680), r.range(14, 40), K.rgba(['#5ae07a', '#ff7ad8', '#5ad0ff'][i % 3], 0.35));
        hills(g, 620, '#1a0a2a', r, 30);
      } else if (W.style === 'ice') {
        for (let i = 0; i < 26; ++i) {
          const x = r.range(0, VIEW_W), h = r.range(60, 220);
          g.fillStyle = 'rgba(200,235,255,0.35)'; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x, h * 0.6); g.lineTo(x + 20, 0); g.closePath(); g.fill();
        }
        for (let i = 0; i < 6; ++i) { const x = 80 + i * 220, h = r.range(220, 420); g.fillStyle = 'rgba(160,210,255,0.45)'; g.beginPath(); g.moveTo(x - 40, VIEW_H); g.lineTo(x, VIEW_H - h); g.lineTo(x + 40, VIEW_H); g.closePath(); g.fill(); }
        for (let i = 0; i < 9; ++i) crystals(g, r.range(0, VIEW_W), VIEW_H - r.range(30, 120), r, ['#e0f8ff', '#9ae8ff', '#c8d8ff'][i % 3]);
        g.fillStyle = '#d8eeff'; g.fillRect(0, VIEW_H - 40, VIEW_W, 40);
      } else if (W.style === 'reef') {
        for (let i = 0; i < 8; ++i) {
          const gr = g.createLinearGradient(0, 0, 0, VIEW_H);
          gr.addColorStop(0, 'rgba(200,255,255,0.12)'); gr.addColorStop(1, 'rgba(200,255,255,0)');
          g.fillStyle = gr; const x = 80 + i * 160 + r.range(-40, 40);
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 60, 0); g.lineTo(x + 160, VIEW_H); g.lineTo(x + 40, VIEW_H); g.closePath(); g.fill();
        }
        for (let i = 0; i < 14; ++i) { const x = r.range(0, VIEW_W), y = VIEW_H - r.range(20, 120); for (let k = 0; k < 5; ++k) K.circle(g, x + r.range(-30, 30), y - k * 18, r.range(10, 22), K.rgba(['#ff7a9a', '#ffb05a', '#c07aff', '#5ae0c0'][i % 4], 0.55)); }
        for (let i = 0; i < 4; ++i) column(g, 80 + i * 330, 340 + r.range(-40, 60), '#0e3a4a', r);
        g.fillStyle = '#0a2a36'; g.fillRect(0, VIEW_H - 40, VIEW_W, 40);
      } else if (W.style === 'gears') {
        const gr = g.createLinearGradient(0, VIEW_H - 220, 0, VIEW_H);
        gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, 'rgba(255,120,30,0.55)');
        g.fillStyle = gr; g.fillRect(0, VIEW_H - 220, VIEW_W, 220);
        for (let i = 0; i < 9; ++i) gear(g, r.range(0, VIEW_W), r.range(60, VIEW_H - 60), r.range(50, 130), r.range(0, 1), K.rgba('#5a3a1a', 0.9));
        g.strokeStyle = '#6a4a22'; g.lineWidth = 14;
        for (let i = 0; i < 4; ++i) { g.beginPath(); g.moveTo(-20, 140 + i * 150); g.lineTo(VIEW_W + 20, 140 + i * 150); g.stroke(); }
        g.fillStyle = '#3a2410'; g.fillRect(0, VIEW_H - 36, VIEW_W, 36);
      } else {
        for (let i = 0; i < 220; ++i) K.circle(g, r.range(0, VIEW_W), r.range(0, VIEW_H * 0.85), r.range(0.3, 1.6), 'rgba(255,255,255,' + r.range(0.3, 1) + ')');
        for (let k = 0; k < 4; ++k) {
          const gr = g.createRadialGradient(300 + k * 250, 200 + (k % 2) * 120, 10, 300 + k * 250, 200 + (k % 2) * 120, 260);
          gr.addColorStop(0, ['rgba(160,90,255,0.22)', 'rgba(255,120,200,0.16)', 'rgba(90,160,255,0.18)', 'rgba(255,220,140,0.12)'][k]);
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
        }
        g.fillStyle = '#100828';
        g.fillRect(1010, 160, 200, VIEW_H);
        gear(g, 1110, 200, 90, 0.3, '#1a1040');
        K.circle(g, 1110, 200, 30, 'rgba(255,232,160,0.5)');
        for (let y = 300; y < VIEW_H; y += 50) { g.fillStyle = 'rgba(192,138,255,0.5)'; g.fillRect(1030, y, 160, 6); }
        hills(g, 640, '#0e0820', r, 30);
      }
    });
  }

  function hills(g, y, color, r, amp) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 40) g.lineTo(x, y - Math.sin(x * 0.006 + r.range(0, 0.3)) * amp - r.range(0, 12));
    g.lineTo(VIEW_W, VIEW_H);
    g.closePath();
    g.fill();
  }

  function tower(g, x, top, w, color, r) {
    g.fillStyle = color;
    g.fillRect(x, top, w, VIEW_H - top);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = top + 20; y < VIEW_H; y += 26) g.fillRect(x + 6, y, w - 12, 10);
    g.fillStyle = color;
    for (let k = 0; k < 3; ++k) g.fillRect(x + k * w / 3, top - r.range(4, 22), w / 3 - 4, 22);
    g.fillStyle = 'rgba(90,160,70,0.6)';
    for (let k = 0; k < 6; ++k) K.circle(g, x + r.range(0, w), top + r.range(0, 160), r.range(4, 10), 'rgba(90,160,70,0.55)');
  }

  function gear(g, x, y, rad, rot, color) {
    g.fillStyle = color;
    g.beginPath();
    for (let k = 0; k < 24; ++k) {
      const a = rot + k / 24 * TAU, rr = k % 2 ? rad : rad * 0.82;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    K.circle(g, x, y, rad * 0.3, '#000');
    g.globalCompositeOperation = 'source-over';
  }

  function crystals(g, x, y, r, color) {
    for (let k = 0; k < 5; ++k) {
      const h = r.range(40, 120), a = r.range(-0.5, 0.5), w = r.range(10, 22);
      g.save();
      g.translate(x + k * 14 - 28, y);
      g.rotate(a);
      const gr = g.createLinearGradient(0, -h, 0, 0);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, color); gr.addColorStop(1, K.rgba(color, 0.2));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h * 0.8); g.lineTo(0, -h); g.lineTo(w / 2, -h * 0.8); g.lineTo(w / 2, 0); g.closePath(); g.fill();
      g.restore();
    }
    const gl = g.createRadialGradient(x, y - 40, 4, x, y - 40, 120);
    gl.addColorStop(0, K.rgba(color, 0.25)); gl.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = gl; g.fillRect(x - 120, y - 160, 240, 240);
  }

  function column(g, x, top, color, r) {
    g.fillStyle = color;
    g.fillRect(x, top, 60, VIEW_H - top);
    g.fillRect(x - 10, top - 16, 80, 16);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let k = 0; k < 4; ++k) g.fillRect(x + 8 + k * 13, top, 4, VIEW_H - top);
    g.strokeStyle = '#2a8a5a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x + 10, VIEW_H);
    for (let y = VIEW_H; y > top + r.range(40, 200); y -= 20) g.lineTo(x + 10 + Math.sin(y * 0.05) * 10, y);
    g.stroke();
  }

  /* the drifting near layer, one sprite per world, scrolled horizontally */
  function near(w) {
    const W = WORLDS[w];
    return K.sprite('near:' + w, VIEW_W, 220, (g) => {
      const r = NS.rng.makeRng(707 + w);
      if (W.style === 'garden') for (let i = 0; i < 18; ++i) K.circle(g, i * 76 + r.range(0, 30), 160 + r.range(0, 50), r.range(30, 60), K.rgba(i % 2 ? '#2a0a3a' : '#3a1050', 0.9));
      else if (W.style === 'ice') for (let i = 0; i < 6; ++i) crystals(g, i * 230 + r.range(0, 60), 220, r, '#e0f8ff');
      else if (W.style === 'reef') for (let i = 0; i < 24; ++i) { g.strokeStyle = 'rgba(40,140,90,0.7)'; g.lineWidth = 6; g.beginPath(); g.moveTo(i * 55, 220); for (let y = 220; y > r.range(40, 140); y -= 15) g.lineTo(i * 55 + Math.sin(y * 0.08 + i) * 10, y); g.stroke(); }
      else if (W.style === 'gears') for (let i = 0; i < 8; ++i) gear(g, i * 170 + r.range(0, 40), 200, r.range(50, 80), r.range(0, 1), '#2a1808');
      else for (let i = 0; i < 14; ++i) { g.fillStyle = 'rgba(30,18,70,0.9)'; g.fillRect(i * 95, 220 - r.range(30, 120), 50, 220); }
    });
  }

  function vignette() {
    return K.sprite('vignette', 320, 180, (g) => {
      const gr = g.createRadialGradient(160, 90, 50, 160, 90, 200);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 320, 180);
    });
  }

  function update(dt) {
    for (let i = 0; i < motes.length; ++i) {
      const m = motes[i];
      m.p += dt;
      m.y -= (8 + m.s * 18) * dt;
      if (m.y < -10) { m.y = VIEW_H + 10; m.x = Math.random() * VIEW_W; }
    }
    const se = G.season;
    for (let i = 0; i < decor.length; ++i) {
      const d = decor[i];
      d.p += dt;
      d.r += dt * (i % 2 ? 1 : -1);
      if (se && se.decor === 'motes') d.y -= 12 * d.s * dt;
      else if (se && se.decor === 'bats') { d.x += 40 * d.s * dt; d.y += Math.sin(d.p * 3) * 20 * dt; }
      else d.y += (30 + 30 * d.s) * dt;
      d.x += Math.sin(d.p + i) * 14 * dt;
      if (d.y > VIEW_H + 20) { d.y = -20; d.x = Math.random() * VIEW_W; }
      if (d.y < -20) d.y = VIEW_H + 20;
      if (d.x > VIEW_W + 20) d.x = -20;
    }
  }

  function moteColor(w) {
    return ['rgba(180,255,200,', 'rgba(230,248,255,', 'rgba(255,200,120,', 'rgba(200,255,255,', 'rgba(220,190,255,'][w];
  }

  function draw(w) {
    const v = NS.view.visible();
    ctx.drawImage(sky(w), v.x0, v.y0, v.w, v.h);
    ctx.drawImage(far(w), 0, 0);
    const nearImg = near(w);
    const off = (G.time * 8) % VIEW_W;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(nearImg, -off, VIEW_H - 220);
    ctx.drawImage(nearImg, VIEW_W - off, VIEW_H - 220);
    ctx.globalAlpha = 1;
    const col = moteColor(w);
    for (let i = 0; i < motes.length; ++i) {
      const m = motes[i];
      ctx.fillStyle = col + (0.25 + 0.35 * Math.abs(Math.sin(m.p))) + ')';
      const r = WORLDS[w].style === 'reef' ? 2 + m.s * 3 : 1 + m.s * 2;
      if (WORLDS[w].style === 'reef') { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, TAU); ctx.stroke(); }
      else ctx.fillRect(m.x, m.y, r, r);
    }
    drawDecor();
  }

  function drawDecor() {
    const se = G.season;
    if (!se) return;
    const v = NS.view.visible();
    ctx.fillStyle = se.tint;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    for (let i = 0; i < decor.length; ++i) {
      const d = decor[i];
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.r);
      ctx.globalAlpha = 0.75;
      switch (se.decor) {
        case 'snow': ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 2 + d.s * 2, 0, TAU); ctx.fill(); break;
        case 'petals': ctx.fillStyle = '#ffc0dc'; ctx.beginPath(); ctx.ellipse(0, 0, 6 * d.s, 3 * d.s, 0, 0, TAU); ctx.fill(); break;
        case 'leaves': ctx.fillStyle = i % 2 ? '#e0902a' : '#c0502a'; ctx.beginPath(); ctx.ellipse(0, 0, 7 * d.s, 3.5 * d.s, 0, 0, TAU); ctx.fill(); break;
        case 'bats': ctx.fillStyle = '#2a103a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -6, -12, -2); ctx.quadraticCurveTo(-6, 0, 0, 4); ctx.quadraticCurveTo(6, 0, 12, -2); ctx.quadraticCurveTo(6, -6, 0, 0); ctx.fill(); break;
        case 'confetti': ctx.fillStyle = ['#ffd23a', '#ff5a8a', '#7affea', '#a08aff'][i % 4]; ctx.fillRect(-4, -2.5, 8, 5); break;
        default: ctx.fillStyle = '#fff4b0'; ctx.beginPath(); ctx.arc(0, 0, 1.5 + d.s, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette(danger) {
    const v = NS.view.visible();
    ctx.drawImage(vignette(), v.x0, v.y0, v.w, v.h);
    if (danger > 0) {
      ctx.globalAlpha = danger * (0.5 + 0.5 * Math.sin(G.time * 8));
      ctx.fillStyle = 'rgba(255,30,30,0.18)';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.backdrop, { sky, far, near, update, draw, drawDecor, drawVignette });
})();
