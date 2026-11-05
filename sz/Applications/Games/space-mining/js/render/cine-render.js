/* Cinematic drawing: the full-screen sequences (intro launch from Kessler Station, the per-trip
   undock and jump, a new belt charted, the Crown ending with fireworks and a stats roll) and
   the overlays of the in-world ones (warp arrival tunnel and title card, docking clamps,
   discovery light rays and caption). Timed captions, fades and letterbox. Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU, FONT } = NS.constants;
  const { ZONES, ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const R = NS.rng.fx;
  const { ctx, visible } = NS.view;

  const ease = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  let emitT = 0;

  function caption(text, t, t0, t1, y, px, color) {
    if (t < t0 || t > t1) return;
    const a = Math.min(1, (t - t0) * 2.5, (t1 - t) * 2.5);
    ctx.globalAlpha = a;
    kit.text(text, 640, y || 600, px || 22, color || '#ffffff', { align: 'center', weight: px > 26 ? 'bold' : 'normal' });
    ctx.globalAlpha = 1;
  }

  function fade(a, v) {
    if (a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#000';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function bars(v, k) {
    const h = 70 * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(v.x0, v.y0, v.w, h);
    ctx.fillRect(v.x0, v.y1 - h, v.w, h);
  }

  function ship(x, y, a, scale, thrust, colors, id) {
    if (thrust > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, thrust);
      K.blit(ctx, K.glow(colors.glow), x - Math.cos(a) * 30 * scale, y - Math.sin(a) * 30 * scale, (0.7 + thrust) * scale);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      emitT -= 1 / 60;
      if (emitT <= 0) {
        emitT = 1 / 50;
        NS.fx.exhaust(x - Math.cos(a) * 28 * scale, y - Math.sin(a) * 28 * scale, -Math.cos(a) * 300, -Math.sin(a) * 300, 10 * scale * thrust, colors.glow, null);
      }
    }
    K.blitRot(ctx, NS.shipArt.shipSprite(id, colors, 0), x, y, a, scale);
  }

  function warpStreaks(v, k, cx, cy, color) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(color, 0.5 * k);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 70; ++i) {
      const a = i * 2.399;
      const ph = (G.time * 1.8 + i * 0.137) % 1;
      const d0 = 40 + ph * 700, d1 = d0 + 40 + ph * 260 * k;
      ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
      ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── full screen ── */
  function drawFull() {
    const c = G.cine;
    if (!c) return;
    const v = visible();
    switch (c.kind) {
      case 'intro': intro(c, v); break;
      case 'launch': launch(c, v); break;
      case 'milestone': milestone(c, v); break;
      case 'ending': ending(c, v); break;
    }
    if (c.t > 0.35) kit.text('any key to skip', v.x1 - 20, v.y1 - 18, 11, 'rgba(255,255,255,0.45)', { align: 'right' });
  }

  function stars(v) {
    NS.backdrop.draw(G.world.w / 2 + G.time * 20, G.world.h / 2, 0, false);
  }

  function intro(c, v) {
    const t = c.t;
    NS.backdrop.setZone(0);
    stars(v);
    const zoom = 0.62 + t * 0.012;
    const sx = 520 - t * 6, sy = 380;
    NS.stationArt.draw(ctx, sx, sy, zoom, G.save.modules, G.time);
    const colors = G.stats.colors, id = G.stats.hullId;
    let x = sx, y = sy, th = 0, a = 0, sc = 0.9;
    if (t > 5.4) {
      const k = clamp01((t - 5.4) / 3.2);
      x = sx + ease(k) * 260;
      y = sy + Math.sin(k * 2) * -20;
      th = 0.3;
    }
    if (t > 8.6) {
      const k = (t - 8.6);
      x = sx + 260 + k * k * 160;
      y = sy - 20 - k * 30;
      a = -0.12;
      th = 1.3;
      sc = 0.9 + k * 0.08;
    }
    if (t > 5.2) ship(x, y, a, sc, th, colors, id);
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });
    bars(v, clamp01(t * 2) * (t < 10 ? 1 : clamp01(12 - t)));
    caption('2291. The inner colonies are starving for metal.', t, 0.6, 4.4, 640, 22);
    caption('Kessler Station sits on the richest belts in the system.', t, 4.6, 8.4, 640, 22);
    caption('You have a rig, a licence, and a hold to fill.', t, 8.6, 11, 640, 22);
    if (t > 10.2) {
      const k = clamp01((t - 10.2) * 1.2);
      ctx.globalAlpha = k * clamp01(14 - t);
      K.blit(ctx, kit.logo(), 640, 300 - (1 - k) * 20, 0.9);
      kit.text('A mining career begins', 640, 372, 18, UI.textDim, { align: 'center' });
      ctx.globalAlpha = 1;
    }
    fade(1 - t * 1.5, v);
    fade((t - 13.2) * 1.25, v);
  }

  function launch(c, v) {
    const t = c.t;
    const z = c.data.zone || ZONES[0];
    NS.backdrop.setZone(0);
    stars(v);
    const k = clamp01(t / 2.4);
    NS.stationArt.draw(ctx, 300 - k * 260, 380, 0.5 - k * 0.15, G.save.modules, G.time);
    const x = 420 + ease(k) * 700, y = 380 - k * 40;
    ship(x, y, -0.05, 1, 0.6 + k, G.stats.colors, G.stats.hullId);
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });
    if (t > 1.6) warpStreaks(v, clamp01((t - 1.6) * 1.2), 1040, 340, z.theme.accent);
    bars(v, 1);
    caption('Jumping to ' + z.name, t, 0.3, 3.2, 640, 24, z.theme.accent);
    if (t > 2.6) {
      ctx.globalAlpha = clamp01((t - 2.6) * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
  }

  function milestone(c, v) {
    const t = c.t;
    const z = c.data.zone;
    NS.backdrop.setZone(z.index);
    stars(v);
    const k = clamp01((t - 0.6) / 1.2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * (0.6 + Math.sin(t * 3) * 0.1);
    K.blit(ctx, K.glow(z.theme.accent), 640, 330, 9 * ease(k));
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; ++i) {
      const rk = clamp01((t - 1 - i * 0.35) / 1.4);
      if (rk <= 0 || rk >= 1) continue;
      ctx.globalAlpha = 1 - rk;
      ctx.drawImage(K.ringSprite(z.theme.accent).canvas, 640 - rk * 520, 330 - rk * 520, rk * 1040, rk * 1040);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    bars(v, 1);
    caption('NEW BELT CHARTED', t, 0.8, 4.4, 250, 20, UI.gold);
    caption(z.name.toUpperCase(), t, 1.1, 4.4, 330, 54, '#ffffff');
    caption(z.blurb, t, 1.6, 4.4, 410, 17, UI.textDim);
    fade(1 - t * 3, v);
  }

  function ending(c, v) {
    const t = c.t;
    NS.backdrop.setZone(4);
    stars(v);
    if (t < 6) {
      /* the shattered heart burning in the dark */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 + Math.sin(t * 4) * 0.2;
      K.blit(ctx, K.glow('#c88aff'), 640, 360, 12 + t);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, NS.rockArt.crown(), 640, 360, t * 0.1, 1 + t * 0.06);
      if (R() < 0.4) NS.fx.sparks(640, 360, R() * TAU, 0.6, 3, '#e8c8ff', 500, 0.8);
      caption('The Crown Heart, shattered and hauled home.', t, 0.8, 5.6, 620, 24);
    } else {
      NS.stationArt.draw(ctx, 640, 400, 0.72, G.save.modules, G.time);
      if (t < 13 && R() < 0.1) firework(200 + R() * 880, 110 + R() * 230);
      caption('Its light reaches every colony from here to Sol.', t, 6.4, 11, 600, 24);
    }
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });
    bars(v, 1);
    if (t > 11) {
      const k = clamp01((t - 11) * 1.5);
      ctx.globalAlpha = k * 0.75;
      ctx.fillStyle = '#000';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = k;
      const st = G.save.stats;
      kit.text('CAREER COMPLETE', 640, 170, 46, UI.gold, { align: 'center', weight: 'bold' });
      const lines = [
        ['Credits earned', kit.group(st.earned)], ['Asteroids fractured', kit.group(st.fractures)], ['Trips flown', kit.group(st.trips)],
        ['Pirates destroyed', kit.group(st.pirates)], ['Bars refined', kit.group(st.bars)], ['Achievements', NS.rules.achievementCount(G.save) + ' / ' + NS.goals.ACHIEVEMENTS.length],
      ];
      for (let i = 0; i < lines.length; ++i) {
        const y = 250 + i * 40 - Math.max(0, t - 15) * 6;
        kit.text(lines[i][0], 620, y, 20, UI.textDim, { align: 'right' });
        kit.text(lines[i][1], 660, y, 20, '#ffffff', { weight: 'bold' });
      }
      kit.text('The belts are yours. Keep mining.', 640, 530, 18, UI.accent, { align: 'center' });
      ctx.globalAlpha = 1;
    }
    fade(1 - t * 2, v);
    fade((t - 17.2) * 1.25, v);
  }

  /* a firework burst: a flash, a ring of sparks and slow embers, no smoke */
  function firework(x, y) {
    const cols = ['#ffd25a', '#4fd8ff', '#ff6a8a', '#7cff9a', '#c88aff'];
    const col = cols[Math.floor(R() * cols.length)];
    NS.fx.glow(x, y, 60, '#ffffff', 0.15);
    NS.fx.sparks(x, y, 0, TAU, 40, col, 340, 0.9);
    NS.fx.embers(x, y, 14, 120, ['#ffffff', col, col, K.shade(col, -0.5)]);
    NS.fx.ring(x, y, 6, 90, 0.5, col, 3);
  }

  /* ── in-world overlays ── */
  function drawInWorld(v, c) {
    const t = c.t;
    if (c.kind === 'arrival') {
      if (t < 0.9) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - t) + ')';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
        warpStreaks(v, 1 - t, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, '#ffffff');
      }
      const z = c.data.zone;
      if (z && t > 0.9) {
        const a = Math.min(1, (t - 0.9) * 3, (c.dur - t) * 3);
        ctx.globalAlpha = a;
        kit.text(z.name.toUpperCase(), 640, 300, 50, '#ffffff', { align: 'center', weight: 'bold' });
        ctx.fillStyle = z.theme.accent;
        ctx.fillRect(640 - 200 * a, 336, 400 * a, 2);
        kit.text(z.sub + '  -  danger ' + '*****'.slice(0, z.danger), 640, 360, 17, z.theme.accent, { align: 'center' });
        ctx.globalAlpha = 1;
      }
    } else if (c.kind === 'docking') {
      const k = clamp01(t / (c.dur * 0.62));
      kit.text(k < 1 ? 'DOCKING  -  autopilot engaged' : 'CLAMPS LOCKED', 640, 140, 22, UI.gold, { align: 'center', weight: 'bold' });
      kit.bar(540, 162, 200, 6, k, UI.gold);
      fade((t - c.dur + 0.8) * 1.25, v);
    } else if (c.kind === 'discovery') {
      const d = c.data;
      const k = Math.min(1, t * 2, (c.dur - t) * 2);
      const pt = NS.camera.toView(d.x, d.y, { x: 0, y: 0 });
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 * k;
      ctx.fillStyle = d.kind === 'derelict' ? '#ffd8a0' : '#e8c8ff';
      for (let i = 0; i < 9; ++i) {
        const a = i * TAU / 9 + G.time * 0.15;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.arc(pt.x, pt.y, 900, a, a + 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const title = d.kind === 'derelict' ? 'DERELICT FREIGHTER' : d.kind === 'crown' ? 'THE CROWN HEART' : 'CRYSTAL GEODE';
      const sub = d.kind === 'derelict' ? 'Cut it open with the laser for salvage and data'
        : d.kind === 'crown' ? 'A heart of void crystal the size of a station. Break it.'
          : 'A hollow rock lined with ' + ORE_BY_ID[d.ore].name.toLowerCase() + ' - crack it open';
      ctx.globalAlpha = Math.max(0, k);
      kit.text('DISCOVERY', 640, 120, 16, UI.gold, { align: 'center', weight: 'bold' });
      kit.text(title, 640, 158, 38, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(sub, 640, 600, 17, UI.text, { align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.cineRender, {
    drawFull, drawInWorld, FONT
  });
})();
