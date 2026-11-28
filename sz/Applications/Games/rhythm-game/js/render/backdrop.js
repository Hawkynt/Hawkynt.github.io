/* The districts behind everything, in parallax layers painted once into sprites: a sky with its glow,
   stars and moon; a far skyline; a near skyline whose lit windows breathe with the beat; each
   district's own life (the Docks' swinging cranes over black water, the Gardens' glass domes and
   fireflies, the Foundry's stacks, furnaces and embers, the Club's light shafts, kelp and bubbles,
   the Spire's tower above drifting clouds); during a song a crowd bobbing on the beat and spotlights
   that sweep harder in Surge; the festival's decor and tint; and the vignette, red when the groove runs
   low. Every frame only blits and draws a handful of lines. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TAU } = NS.constants;
  const K = NS.artKit;
  const { makeRng } = NS.rng;
  const { WORLDS } = NS.worldData;
  const { ctx } = NS.view;

  function sky(w) {
    const W = WORLDS[w];
    return K.sprite('sky:' + w, VIEW_W, VIEW_H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, VIEW_H);
      gr.addColorStop(0, W.sky[0]);
      gr.addColorStop(0.55, W.sky[1]);
      gr.addColorStop(1, K.mix(W.sky[1], W.sky[2], 0.45));
      g.fillStyle = gr;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      const r = makeRng(17 + w * 31);
      if (w !== 3) for (let i = 0; i < 160; ++i) {
        const s = r.next() * 1.6 + 0.4;
        g.globalAlpha = 0.25 + r.next() * 0.6;
        g.fillStyle = r.next() < 0.2 ? W.glow : '#ffffff';
        g.fillRect(r.next() * VIEW_W, r.next() * VIEW_H * 0.6, s, s);
      }
      g.globalAlpha = 1;
      /* horizon glow */
      const hz = g.createRadialGradient(VIEW_W / 2, VIEW_H * 0.72, 10, VIEW_W / 2, VIEW_H * 0.72, VIEW_W * 0.7);
      hz.addColorStop(0, K.rgba(W.sky[2], 0.55));
      hz.addColorStop(1, K.rgba(W.sky[2], 0));
      g.fillStyle = hz;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      /* moon, sun or the light from above */
      if (w === 0 || w === 4) {
        const mx = w === 0 ? 1010 : 300, my = w === 0 ? 120 : 110, mr = w === 0 ? 46 : 36;
        const mg = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3);
        mg.addColorStop(0, K.rgba(W.glow, 0.3)); mg.addColorStop(1, K.rgba(W.glow, 0));
        g.fillStyle = mg; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
        K.circle(g, mx, my, mr, w === 0 ? '#ffe8f0' : '#fff8d0');
        K.circle(g, mx - mr * 0.3, my - mr * 0.2, mr * 0.25, 'rgba(0,0,0,0.06)');
      }
      if (w === 2) {
        g.globalAlpha = 0.5;
        for (let i = 0; i < 4; ++i) { K.ellipse(g, 200 + i * 300, 160 + (i % 2) * 40, 260, 40, 'rgba(60,20,10,0.5)'); }
        g.globalAlpha = 1;
      }
    });
  }

  /* a skyline silhouette and its windows, as two sprites */
  function skyline(w, layer) {
    const key = 'city:' + w + ':' + layer;
    const make = (windows) => K.sprite(key + (windows ? ':win' : ''), VIEW_W, 360, (g) => {
      const W = WORLDS[w];
      const r = makeRng(101 + w * 7 + layer * 13);
      const base = layer ? K.shade(W.sky[0], -0.35) : K.mix(W.sky[0], W.sky[1], 0.5);
      let x = -20;
      while (x < VIEW_W + 20) {
        const bw = (layer ? 50 : 34) + r.next() * (layer ? 90 : 60);
        const bh = (layer ? 90 : 120) + r.next() * (layer ? 170 : 200) * (w === 4 ? 0.5 : 1);
        const top = 360 - bh;
        if (!windows) {
          g.fillStyle = base;
          if (w === 1 && r.next() < 0.5) { g.beginPath(); g.ellipse(x + bw / 2, 360, bw / 2, bh * 0.8, 0, Math.PI, 0); g.fill(); g.strokeStyle = K.rgba(W.color, 0.35); g.lineWidth = 1.5; g.stroke(); }
          else {
            g.fillRect(x, top, bw, bh);
            if (w === 2 && r.next() < 0.4) g.fillRect(x + bw * 0.3, top - 70, bw * 0.22, 70);
            if (r.next() < 0.35) { g.fillRect(x + bw / 2 - 1, top - 26, 2, 26); K.circle(g, x + bw / 2, top - 27, 2, W.color); }
          }
        } else if (!(w === 1 && false)) {
          const cols = Math.floor(bw / 12), rows = Math.floor(bh / 16);
          for (let cx = 0; cx < cols; ++cx) for (let ry = 1; ry < rows; ++ry) {
            if (r.next() < 0.55) continue;
            g.fillStyle = r.next() < 0.2 ? W.glow : r.next() < 0.5 ? W.color : '#ffe8b0';
            g.globalAlpha = 0.35 + r.next() * 0.55;
            g.fillRect(x + 4 + cx * 12, top + ry * 16, 5, 7);
          }
          g.globalAlpha = 1;
          if (r.next() < 0.3) { g.fillStyle = W.color; g.fillRect(x + 6, top + 10, bw - 12, 4); }
        }
        x += bw + (layer ? 6 : 2) + r.next() * 10;
      }
    });
    return { body: make(false), lit: make(true) };
  }

  function crowd() {
    return K.sprite('crowd', VIEW_W, 120, (g) => {
      const r = makeRng(77);
      g.fillStyle = '#05030c';
      for (let x = -10; x < VIEW_W + 20; x += 22 + r.next() * 10) {
        const h = 60 + r.next() * 30;
        K.ellipse(g, x, 120 - h + 12, 11, 13, '#05030c');
        g.fillRect(x - 16, 120 - h + 22, 32, h);
        if (r.next() < 0.3) { g.save(); g.translate(x + 12, 120 - h + 30); g.rotate(-0.4 - r.next() * 0.5); g.fillRect(-3, -40, 7, 42); g.restore(); }
        if (r.next() < 0.12) { g.fillStyle = '#e8f0ff'; g.fillRect(x + 14, 120 - h - 6, 4, 6); g.fillStyle = '#05030c'; }
      }
    });
  }

  function vignette(red) {
    return K.sprite('vig:' + (red ? 1 : 0), 640, 360, (g) => {
      const gr = g.createRadialGradient(320, 180, 120, 320, 180, 380);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, red ? 'rgba(160,0,30,0.75)' : 'rgba(0,0,8,0.6)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 640, 360);
    });
  }

  function cover(img, y0, h) {
    const v = NS.view.visible();
    ctx.drawImage(img, v.x0, y0 == null ? v.y0 : y0, v.w, h == null ? v.h : h);
  }

  /* opts: play (a song runs: crowd and lights), beat (0..1 phase), surge */
  function draw(w, opts) {
    opts = opts || {};
    w = Math.max(0, Math.min(4, w | 0));
    const W = WORLDS[w];
    const t = G.time;
    const pulse = G.pulse || 0;
    cover(sky(w));
    const v = NS.view.visible();
    /* the district's own life behind the city */
    if (w === 4) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath(); ctx.moveTo(610, 520); ctx.lineTo(626, 120); ctx.lineTo(654, 120); ctx.lineTo(670, 520); ctx.closePath(); ctx.fill();
      ctx.fillStyle = W.color;
      ctx.beginPath(); ctx.moveTo(612, 120); ctx.lineTo(620, 92); ctx.lineTo(632, 108); ctx.lineTo(640, 80); ctx.lineTo(648, 108); ctx.lineTo(660, 92); ctx.lineTo(668, 120); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + pulse * 0.4;
      K.blit(ctx, K.glow(W.color), 640, 100, 1.6);
      ctx.restore();
    }
    const far = skyline(w, 0), near = skyline(w, 1);
    const drift = (t * 6) % VIEW_W;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(far.body, -drift, 250);
    ctx.drawImage(far.body, VIEW_W - drift, 250);
    ctx.globalAlpha = 1;
    ctx.drawImage(near.body, v.x0, 330, v.w, 360);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + pulse * 0.55;
    ctx.drawImage(near.lit, v.x0, 330, v.w, 360);
    ctx.restore();
    life(w, t, pulse);
    if (opts.play) {
      lights(W, t, opts.surge, pulse);
      const bob = Math.abs(Math.sin((opts.beat || 0) * Math.PI)) * (opts.surge ? 10 : 5);
      const img = crowd();
      ctx.drawImage(img, v.x0, VIEW_H - 92 - bob, v.w, 120);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(img, v.x0 - 30, VIEW_H - 70 - bob * 0.6, v.w + 60, 120);
      ctx.globalAlpha = 1;
    }
    if (G.season) {
      ctx.fillStyle = G.season.tint;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
  }

  function life(w, t, pulse) {
    const W = WORLDS[w];
    ctx.save();
    if (w === 0) {
      /* water and two cranes swinging slowly */
      const gr = K.sprite('water0', 64, 120, (g) => { const q = g.createLinearGradient(0, 0, 0, 120); q.addColorStop(0, 'rgba(10,0,30,0.4)'); q.addColorStop(1, 'rgba(0,0,10,0.95)'); g.fillStyle = q; g.fillRect(0, 0, 64, 120); });
      cover(gr, 600, 140);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; ++i) {
        ctx.globalAlpha = 0.18 + 0.1 * Math.sin(t * 2 + i);
        ctx.fillStyle = i % 2 ? W.color : W.glow;
        ctx.fillRect(100 + i * 130 + Math.sin(t + i) * 10, 620 + (i % 3) * 18, 60, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      for (const [x, sc] of [[150, 1], [1130, 0.85]]) {
        ctx.strokeStyle = '#140a24';
        ctx.lineWidth = 6 * sc;
        ctx.beginPath(); ctx.moveTo(x, 600); ctx.lineTo(x, 300 * sc + 120); ctx.stroke();
        ctx.save();
        ctx.translate(x, 300 * sc + 120);
        ctx.rotate(Math.sin(t * 0.3 + x) * 0.25);
        ctx.lineWidth = 5 * sc;
        ctx.beginPath(); ctx.moveTo(-60 * sc, 0); ctx.lineTo(180 * sc, 0); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(150 * sc, 0); ctx.lineTo(150 * sc, 90 * sc); ctx.stroke();
        K.circle(ctx, 180 * sc, 0, 3, W.color);
        ctx.restore();
      }
    } else if (w === 1) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; ++i) {
        const x = (i * 97 + Math.sin(t * 0.5 + i) * 40) % VIEW_W, y = 420 + Math.sin(t * 0.8 + i * 2) * 60 + (i % 4) * 30;
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i);
        K.blit(ctx, K.glow(i % 2 ? W.color : W.glow), x, y, 0.12);
      }
    } else if (w === 2) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; ++i) {
        ctx.globalAlpha = 0.25 + pulse * 0.35;
        K.blit(ctx, K.glow(W.color), 180 + i * 300, 640, 1.4);
      }
      for (let i = 0; i < 12; ++i) {
        const k = (t * 0.25 + i / 12) % 1;
        ctx.globalAlpha = 1 - k;
        K.blit(ctx, K.glow('#ffb03a'), 200 + (i * 173) % 900 + Math.sin(t + i) * 20, 640 - k * 500, 0.06);
      }
    } else if (w === 3) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; ++i) {
        ctx.globalAlpha = 0.08 + 0.05 * Math.sin(t * 0.7 + i);
        ctx.fillStyle = W.glow;
        const x = 120 + i * 260 + Math.sin(t * 0.3 + i) * 40;
        ctx.beginPath(); ctx.moveTo(x - 30, -10); ctx.lineTo(x + 30, -10); ctx.lineTo(x + 140, 720); ctx.lineTo(x - 20, 720); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 16; ++i) {
        const k = (t * 0.12 + i / 16) % 1;
        ctx.globalAlpha = 0.5 * (1 - k);
        K.blit(ctx, K.glow('#bff4ff'), (i * 211) % VIEW_W + Math.sin(t * 2 + i) * 8, 720 - k * 720, 0.05 + (i % 3) * 0.02);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#04261e';
      ctx.lineWidth = 7;
      for (let i = 0; i < 8; ++i) {
        const x = 60 + i * 170;
        ctx.beginPath(); ctx.moveTo(x, 720);
        ctx.quadraticCurveTo(x + Math.sin(t + i) * 40, 600, x + Math.sin(t * 0.8 + i) * 60, 500 - (i % 3) * 30);
        ctx.stroke();
      }
    } else if (w === 4) {
      for (let i = 0; i < 6; ++i) {
        const x = ((i * 260 - t * (10 + i * 3)) % (VIEW_W + 400) + VIEW_W + 400) % (VIEW_W + 400) - 200;
        ctx.globalAlpha = 0.35;
        K.ellipse(ctx, x, 560 + (i % 3) * 40, 200, 30, '#c8b8ff');
        ctx.globalAlpha = 0.5;
        K.ellipse(ctx, x + 60, 600 + (i % 2) * 30, 160, 24, '#ffffff');
      }
    }
    ctx.restore();
  }

  function lights(W, t, surge, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = surge ? 4 : 2;
    for (let i = 0; i < n; ++i) {
      const left = i % 2 === 0;
      const ang = Math.sin(t * (surge ? 1.6 : 0.6) + i * 1.7) * 0.5 + (left ? 0.35 : -0.35);
      const ox = left ? 60 : VIEW_W - 60;
      ctx.globalAlpha = (surge ? 0.16 : 0.08) + pulse * 0.08;
      ctx.fillStyle = i < 2 ? W.glow : W.color;
      ctx.beginPath();
      ctx.moveTo(ox, -20);
      ctx.lineTo(ox + Math.sin(ang) * 900 - 70, Math.cos(ang) * 900);
      ctx.lineTo(ox + Math.sin(ang) * 900 + 70, Math.cos(ang) * 900);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* festival decor drifting over every screen */
  let decorT = 0;
  function update(dt) {
    const se = G.season;
    if (!se) return;
    decorT += dt;
    const every = se.decor === 'bats' ? 0.6 : se.decor === 'confetti' ? 0.18 : 0.12;
    while (decorT > every) {
      decorT -= every;
      const v = NS.view.visible();
      const x = v.x0 + Math.random() * v.w;
      switch (se.decor) {
        case 'snow': NS.fx.spawn(x, v.y0 - 8, (Math.random() - 0.5) * 20, 30 + Math.random() * 30, 9, 4 + Math.random() * 3, '#ffffff', 'snow', 4); break;
        case 'petals': NS.fx.spawn(x, v.y0 - 8, 20 + Math.random() * 20, 30 + Math.random() * 20, 9, 5, Math.random() < 0.5 ? '#ffb0d0' : '#ffd0e8', 'petal', 6); break;
        case 'motes': NS.fx.spawn(x, v.y1 + 4, (Math.random() - 0.5) * 10, -20 - Math.random() * 20, 8, 3, '#ffe07a', 'ember', -2); break;
        case 'leaves': NS.fx.spawn(x, v.y0 - 8, 15 + Math.random() * 25, 30 + Math.random() * 25, 9, 6, Math.random() < 0.5 ? '#e0902a' : '#c0502a', 'leaf', 6); break;
        case 'bats': NS.fx.spawn(v.x0 - 10, 60 + Math.random() * 260, 70 + Math.random() * 60, (Math.random() - 0.5) * 20, 14, 7, '#1a0a2a', 'bat', 0); break;
        case 'confetti': NS.fx.spawn(x, v.y0 - 8, (Math.random() - 0.5) * 40, 40 + Math.random() * 40, 8, 5, ['#ffd23a', '#ff7ad8', '#5af0ff', '#ffffff'][Math.floor(Math.random() * 4)], 'confetti', 20); break;
      }
    }
  }

  function drawVignette(danger) {
    const v = NS.view.visible();
    ctx.drawImage(vignette(false), v.x0, v.y0, v.w, v.h);
    if (danger > 0) {
      ctx.globalAlpha = Math.min(1, danger) * (0.7 + 0.3 * Math.sin(G.time * 8));
      ctx.drawImage(vignette(true), v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.backdrop, { sky, skyline, crowd, draw, update, drawVignette });
})();
