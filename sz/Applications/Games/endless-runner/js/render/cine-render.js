/* Cinematic shots: each is a slowly panning scene over a world's scenery - the Beacon on its
   hill, the Beacon shattering into five cores, the Hollow King, close-ups of Nova and of Pip her
   lantern drone, Nova running, the map of the five lands, a guardian's reveal, a recovered Spark
   Core and the Beacon relit with fireworks - framed by letterbox bars, with the speaker's name,
   the line typing itself out and a skip hint. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { UI, TAU, GROUND_Y } = C;
  const K = NS.artKit;
  const kit = NS.kit;
  const RA = NS.runnerArt;
  const BA = NS.bossArt;
  const PA = NS.propArt;
  const { CAST } = NS.story;
  const { WORLDS } = NS.worlds;
  const { ctx } = NS.view;

  const CORE_COLS = ['#7cff9a', '#ffb04a', '#bff4ff', '#ff4ab8', '#c08cff'];

  function pip() {
    return K.sprite('pip', 90, 90, (g) => {
      g.translate(45, 48);
      g.fillStyle = '#141224'; g.fillRect(-26, -34, 52, 5); g.fillRect(-2, -34, 4, 12);
      g.fillStyle = '#d0d4dc'; g.fillRect(-24, -33, 48, 3);
      g.fillStyle = '#141224'; g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
      g.fillStyle = '#f0c040'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
      g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(0, 2, 15, 0, TAU); g.fill();
      g.fillStyle = '#141224'; g.beginPath(); g.ellipse(4, 0, 5, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(5, -4, 2, 3);
      g.fillStyle = '#5ee0ff'; g.fillRect(-22, 14, 44, 5);
    });
  }

  function beacon(x, y, lit, cracked) {
    const t = G.time;
    if (lit) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; ++i) {
        const a = -Math.PI / 2 + Math.sin(t * 0.4 + i) * 0.9;
        ctx.fillStyle = 'rgba(255,230,140,0.08)';
        ctx.beginPath(); ctx.moveTo(x, y - 230); ctx.lineTo(x + Math.cos(a - 0.08) * 900, y - 230 + Math.sin(a - 0.08) * 900); ctx.lineTo(x + Math.cos(a + 0.08) * 900, y - 230 + Math.sin(a + 0.08) * 900); ctx.fill();
      }
      K.blitAlpha(ctx, K.glow('#ffd24a'), x, y - 230, 7, 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = '#141224';
    K.poly(ctx, [[x - 50, y], [x - 26, y - 200], [x + 26, y - 200], [x + 50, y]]); ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    K.poly(ctx, [[x - 44, y], [x - 22, y - 196], [x + 22, y - 196], [x + 44, y]]); ctx.fill();
    ctx.fillStyle = '#c04a3a';
    for (let i = 0; i < 3; ++i) ctx.fillRect(x - 40 + i * 6, y - 40 - i * 60, 80 - i * 12, 18);
    ctx.fillStyle = '#141224'; ctx.fillRect(x - 34, y - 250, 68, 52);
    ctx.fillStyle = lit ? '#fff2a0' : '#3a2a5a'; ctx.fillRect(x - 28, y - 244, 56, 40);
    if (cracked) {
      ctx.strokeStyle = '#141224'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - 10, y - 250); ctx.lineTo(x + 6, y - 200); ctx.lineTo(x - 8, y - 140); ctx.lineTo(x + 10, y - 80); ctx.stroke();
    }
  }

  function hill(x, y, w, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y + 120, w, 160, 0, Math.PI, 0); ctx.fill();
  }

  function scene(shot, t) {
    const v = NS.view.visible();
    const w = shot.w || 0;
    const W = WORLDS[w];
    NS.backdrop.world(w, { x: t * 50 + w * 900, y: shot.art === 'relit' || shot.art === 'beacon' ? -60 : 0, zoom: 1 }, 1);
    const cx = 640, gy = GROUND_Y + 10;
    ctx.fillStyle = W.ground[1];
    ctx.fillRect(v.x0, gy, v.w, v.y1 - gy);
    ctx.fillStyle = W.ground[0];
    ctx.fillRect(v.x0, gy, v.w, 10);
    const bob = Math.sin(G.time * 2) * 6;
    switch (shot.art) {
      case 'beacon':
      case 'relit':
        hill(cx + 120, gy, 360, K.shade(W.near, -0.1));
        beacon(cx + 120, gy - 120, true, false);
        if (shot.art === 'relit') fireworks(t);
        break;
      case 'shatter': {
        hill(cx, gy, 380, '#1c0e34');
        beacon(cx, gy - 120, false, true);
        for (let i = 0; i < 5; ++i) {
          const a = -Math.PI / 2 + (i - 2) * 0.55, d = 120 + t * 160;
          const x = cx + Math.cos(a) * d, y = gy - 360 + Math.sin(a) * d * 0.6 + t * t * 20;
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(CORE_COLS[i]), x, y, 2.6, 1);
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'king':
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#8a4aff'), cx, gy - 260, 9, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, BA.sprite('king', Math.floor(G.time * 3) % 2), cx, gy - 230 + bob, 1.5);
        break;
      case 'nova': {
        const spr = RA.frame(G.save.equip.char, G.save.equip.outfit, 'idle', 0);
        ctx.drawImage(spr.canvas, cx - 360 - RA.OX * 3.2, gy - RA.OY * 3.2, RA.W * 3.2, RA.H * 3.2);
        K.blit(ctx, pip(), cx - 160, gy - 300 + bob, 1.2);
        break;
      }
      case 'pip':
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#ffd24a'), cx, gy - 260 + bob, 4, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, pip(), cx, gy - 260 + bob, 2.6);
        break;
      case 'run': {
        const f = Math.floor(G.time * 14) % RA.RUN_FRAMES;
        const spr = RA.frame(G.save.equip.char, G.save.equip.outfit, 'run', f);
        const x = cx - 200 + Math.sin(t * 0.5) * 30;
        ctx.drawImage(spr.canvas, x - RA.OX * 1.6, gy - RA.OY * 1.6, RA.W * 1.6, RA.H * 1.6);
        K.blit(ctx, pip(), x + 90, gy - 210 + bob, 0.8);
        for (let i = 0; i < 6; ++i) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(x - 160 - ((G.time * 600 + i * 90) % 500), gy - 40 - i * 22, 80, 3);
        }
        break;
      }
      case 'map':
        NS.map.drawMapArt(w, v);
        break;
      case 'boss': {
        ctx.fillStyle = 'rgba(120,0,30,0.18)';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
        const id = shot.boss;
        const spr = BA.sprite(id, Math.floor(G.time * 4) % 2);
        const k = id === 'avalanche' || id === 'king' ? 1.3 : 1.6;
        const chase = id === 'avalanche' || id === 'boar';
        const bx = chase ? v.x0 + spr.w * k * 0.45 + Math.sin(t) * 10 : cx + 220 + Math.sin(t) * 10;
        K.blit(ctx, spr, bx, gy - spr.h * k / 2 + 20, k);
        if (chase) {
          const rf = RA.frame(G.save.equip.char, G.save.equip.outfit, 'run', Math.floor(G.time * 14) % RA.RUN_FRAMES);
          ctx.drawImage(rf.canvas, cx + 300 - RA.OX * 1.5, gy - RA.OY * 1.5, RA.W * 1.5, RA.H * 1.5);
          break;
        }
        const nf = RA.frame(G.save.equip.char, G.save.equip.outfit, 'idle', 0);
        ctx.drawImage(nf.canvas, cx - 380 - RA.OX * 1.5, gy - RA.OY * 1.5, RA.W * 1.5, RA.H * 1.5);
        break;
      }
      case 'core': {
        const col = CORE_COLS[w];
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; ++i) {
          const a = i / 12 * TAU + G.time * 0.3;
          ctx.fillStyle = K.rgba(col, 0.08);
          ctx.beginPath(); ctx.moveTo(cx, gy - 240); ctx.lineTo(cx + Math.cos(a) * 700, gy - 240 + Math.sin(a) * 700); ctx.lineTo(cx + Math.cos(a + 0.12) * 700, gy - 240 + Math.sin(a + 0.12) * 700); ctx.fill();
        }
        K.blitAlpha(ctx, K.glow(col), cx, gy - 240 + bob, 5, 1);
        K.blitAlpha(ctx, K.glow('#ffffff'), cx, gy - 240 + bob, 2, 1);
        ctx.globalCompositeOperation = 'source-over';
        K.blitRot(ctx, PA.shard(), cx, gy - 240 + bob, G.time, 2.2);
        break;
      }
    }
  }

  function fireworks(t) {
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 4; ++b) {
      const ph = (t * 0.6 + b * 0.27) % 1;
      const x = 300 + b * 230, y = 140 + (b % 2) * 70;
      const col = CORE_COLS[b % 5];
      for (let i = 0; i < 14; ++i) {
        const a = i / 14 * TAU;
        K.blitAlpha(ctx, K.glow(col), x + Math.cos(a) * ph * 130, y + Math.sin(a) * ph * 130 + ph * ph * 40, 0.4, 1 - ph);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const v = NS.view.visible();
    const shot = c.shots[c.i];
    scene(shot, c.t);
    /* letterbox and a fade between shots */
    const bar = Math.max(46, v.h * 0.09);
    ctx.fillStyle = '#05040c';
    ctx.fillRect(v.x0, v.y0, v.w, bar);
    ctx.fillRect(v.x0, v.y1 - bar, v.w, bar);
    if (c.t < 0.35) {
      ctx.globalAlpha = 1 - c.t / 0.35;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
    /* the line */
    const who = CAST[shot.who] || CAST.narrator;
    const bw = Math.min(980, v.w - 60), bx = 640 - bw / 2, by = v.y0 + bar + 14;
    kit.panel(bx, by, bw, 128, { radius: 14, accent: who.color, alpha: 0.94 });
    if (who.name) kit.text(who.name, bx + 24, by + 24, 20, who.color, { weight: 'bold' });
    kit.wrap(shot.text.slice(0, Math.floor(c.typed)), bx + 24, by + (who.name ? 44 : 30), bw - 48, 21, 28, '#ffffff');
    const done = c.typed >= shot.text.length;
    if (done && Math.floor(G.time * 2) % 2) kit.icon('play', bx + bw - 26, by + 106, 18, who.color);
    kit.text('Any key or click: continue   Esc: skip', v.x1 - 20, v.y1 - bar / 2, 13, UI.textMute, { align: 'right' });
    kit.text((c.i + 1) + ' / ' + c.shots.length, v.x0 + 20, v.y1 - bar / 2, 13, UI.textMute);
  }

  Object.assign(NS.cineRender, {
    draw, pip, beacon
  });
})();
