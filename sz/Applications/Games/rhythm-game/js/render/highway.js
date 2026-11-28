/* The highway in perspective: lanes narrow toward the horizon (a one-point projection, so a note at
   depth d sits at y(d) and grows as it falls), the surface painted once per highway skin, beat and bar
   lines rolling toward the hit line, lane columns lighting up under a press, the receptors with their
   keys, the hit line pulsing on the beat and glowing in Surge. Notes come in the equipped skin: taps,
   gold-rimmed star notes, hold bodies and tails, dark Hush notes, drift notes sliding over with an
   arrow, pickup badges; misses fall on dimmed. Duel attacks bend it: Bass Drop shortens the look
   ahead, Glass Fog clouds the far half, Riptide sways the whole highway; Hidden, Sudden and Sight Line
   fade or mask the notes. laneX and laneAt map lanes to the screen and back for juice and touch. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const NA = NS.notesArt;
  const M = NS.metaData;
  const { HW_X, HIT_Y, TOP_Y, HW_BOTTOM, TAU } = C;
  const { ctx } = NS.view;

  const A = 2.2;
  const VY = (TOP_Y * (1 + A) - HIT_Y) / A;
  const proj = d => 1 / (1 + A * Math.max(-0.2, d));
  const yAt = d => VY + (HIT_Y - VY) * proj(d);
  const widthAt = d => HW_BOTTOM * proj(d);
  let shear = 0;

  function pOfY(y) {
    return (y - VY) / (HIT_Y - VY);
  }

  function laneX(lane, y) {
    const p = pOfY(y == null ? HIT_Y : y);
    return HW_X + (lane - 1.5) * HW_BOTTOM * p / 4 + shear * ((y == null ? HIT_Y : y) - HIT_Y);
  }

  /* the lane under a screen point on the lower highway, or -1 */
  function laneAt(x, y) {
    const yy = Math.max(TOP_Y + 120, Math.min(HIT_Y + 90, y));
    const p = pOfY(yy);
    const l = Math.floor((x - HW_X - shear * (yy - HIT_Y)) / (HW_BOTTOM * p / 4) + 2);
    return l >= 0 && l < 4 && y > TOP_Y + 60 ? l : -1;
  }

  function skin() {
    return M.HIGHWAYS.find(h => h.id === G.profile.equip.highway) || M.HIGHWAYS[0];
  }

  function surface(sk) {
    const h = HIT_Y - TOP_Y + 90;
    return K.sprite('hw:' + sk.id, 1280, h, (g) => {
      const y0 = TOP_Y, yh = yAt(-0.2);
      const pt = (d, side) => [HW_X + side * widthAt(d) / 2, yAt(d) - y0];
      const quad = (d0, d1, s0, s1) => { g.beginPath(); const a = pt(d0, s0), b = pt(d0, s1), c = pt(d1, s1), e = pt(d1, s0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(e[0], e[1]); g.closePath(); };
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, K.rgba(sk.base, 0));
      gr.addColorStop(0.18, K.rgba(sk.base, 0.75));
      gr.addColorStop(1, K.rgba(K.shade(sk.base, 0.08), 0.95));
      quad(-0.2, 1, -1, 1);
      g.fillStyle = gr;
      g.fill();
      /* lanes slightly alternating */
      for (let l = 0; l < 4; ++l) {
        if (l % 2) continue;
        quad(-0.2, 1, (l / 2 - 1), (l / 2 - 1) + 0.5);
        g.fillStyle = 'rgba(255,255,255,0.025)';
        g.fill();
      }
      const fade = g.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, K.rgba(sk.line, 0));
      fade.addColorStop(0.3, K.rgba(sk.line, 0.35));
      fade.addColorStop(1, K.rgba(sk.line, 0.5));
      g.strokeStyle = fade;
      g.lineWidth = 1.5;
      for (let l = 1; l < 4; ++l) { const s = l / 2 - 1; const a = pt(-0.2, s), b = pt(1, s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      const edge = g.createLinearGradient(0, 0, 0, h);
      edge.addColorStop(0, K.rgba(sk.edge, 0));
      edge.addColorStop(0.3, K.rgba(sk.edge, 0.8));
      edge.addColorStop(1, K.rgba(sk.edge, 1));
      g.strokeStyle = edge;
      for (const [s, w] of [[-1, 6], [1, 6]]) {
        const a = pt(-0.2, s), b = pt(1, s);
        g.lineWidth = w; g.globalAlpha = 0.25; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.lineWidth = 2; g.globalAlpha = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      void yh;
    });
  }

  function lookOf(run) {
    const p = G.profile;
    let look = run.chart.params.look * 5 / Math.max(1, p.settings.speed || 5) + NS.progress.stat(p, 'look') * run.chart.beat;
    if (run.eng.attack && run.eng.attack.kind === 'rush') look *= 0.62;
    return look;
  }

  function laneQuad(l, d0, d1) {
    const x0a = laneX(l - 0.5, yAt(d0)), x0b = laneX(l + 0.5, yAt(d0)), x1b = laneX(l + 0.5, yAt(d1)), x1a = laneX(l - 0.5, yAt(d1));
    ctx.beginPath(); ctx.moveTo(x0a, yAt(d0)); ctx.lineTo(x0b, yAt(d0)); ctx.lineTo(x1b, yAt(d1)); ctx.lineTo(x1a, yAt(d1)); ctx.closePath();
  }

  function draw(run) {
    const eng = run.eng, chart = run.chart;
    const t = run.mode === 'demo' ? run.cond.t : Math.max(eng.t, run.cond.t);
    const sk = skin();
    const mut = run.recipe.mutators || [];
    const att = eng.attack ? eng.attack.kind : null;
    shear = att === 'sway' ? Math.sin(G.time * 2.2) * 0.28 : 0;
    const look = lookOf(run);
    ctx.save();
    if (shear) ctx.transform(1, 0, shear, 1, -shear * HIT_Y, 0);
    ctx.drawImage(surface(sk), 0, TOP_Y);
    ctx.restore();
    /* beat and bar lines */
    ctx.save();
    ctx.lineWidth = 2;
    const b0 = Math.ceil(t / chart.beat);
    for (let k = b0; k * chart.beat - t < look; ++k) {
      const d = (k * chart.beat - t) / look;
      const y = yAt(d), w = widthAt(d);
      ctx.globalAlpha = (k % 4 === 0 ? 0.45 : 0.15) * Math.min(1, (1 - d) * 3);
      ctx.strokeStyle = sk.line;
      ctx.beginPath(); ctx.moveTo(HW_X - w / 2 + shear * (y - HIT_Y), y); ctx.lineTo(HW_X + w / 2 + shear * (y - HIT_Y), y); ctx.stroke();
    }
    ctx.restore();
    /* lane columns under presses, Surge glow */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let l = 0; l < 4; ++l) {
      const f = Math.max(G.input.laneFlash[l] * 0.7, G.input.lanes[l] ? 0.45 : 0);
      if (f <= 0.01) continue;
      const gr = ctx.createLinearGradient(0, HIT_Y, 0, yAt(0.6));
      gr.addColorStop(0, K.rgba(C.LANE_COLORS[l], 0.45 * f));
      gr.addColorStop(1, K.rgba(C.LANE_COLORS[l], 0));
      ctx.fillStyle = gr;
      laneQuad(l, 0, 0.6);
      ctx.fill();
    }
    if (eng.surgeOn > t) {
      ctx.globalAlpha = 0.18 + 0.1 * Math.sin(G.time * 10);
      ctx.fillStyle = '#ff4ad8';
      ctx.beginPath();
      ctx.moveTo(laneX(-0.5, yAt(0)), yAt(0)); ctx.lineTo(laneX(3.5, yAt(0)), yAt(0));
      ctx.lineTo(laneX(3.5, yAt(1)), yAt(1)); ctx.lineTo(laneX(-0.5, yAt(1)), yAt(1));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    /* hit line and receptors */
    const pulse = G.pulse || 0;
    const wl = widthAt(0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = eng.surgeOn > t ? '#ff7ad8' : sk.edge;
    ctx.globalAlpha = 0.35 + pulse * 0.5;
    ctx.fillRect(HW_X - wl / 2 - 10, HIT_Y - 2 - pulse * 3, wl + 20, 4 + pulse * 6);
    ctx.restore();
    for (let l = 0; l < 4; ++l) {
      const pressed = G.input.lanes[l] || G.input.laneFlash[l] > 0.5;
      const img = NA.receptor(l, pressed);
      const s = 0.95 + (pressed ? 0.08 : 0) + pulse * 0.05;
      K.blit(ctx, img, laneX(l, HIT_Y), HIT_Y, s);
    }
    drawNotes(run, t, look, mut);
    /* masks: Glass Fog, Sight Line */
    const mask = (dFrom, alpha) => {
      const y = yAt(dFrom);
      const gr = ctx.createLinearGradient(0, y + 40, 0, y - 20);
      gr.addColorStop(0, 'rgba(200,240,255,0)');
      gr.addColorStop(1, att === 'fog' ? 'rgba(170,230,230,' + alpha + ')' : 'rgba(6,2,14,' + alpha + ')');
      ctx.fillStyle = gr;
      const v = NS.view.visible();
      ctx.fillRect(HW_X - HW_BOTTOM / 2 - 40, v.y0, HW_BOTTOM + 80, y + 40 - v.y0);
    };
    if (att === 'fog') mask(0.42, 0.97);
    else if (mut.indexOf('sight') >= 0) mask(0.5, 0.96);
  }

  function noteAlpha(d, mut) {
    let a = 1;
    if (mut.indexOf('hidden') >= 0 && d < 0.42) a = Math.max(0, Math.min(1, (d - 0.14) / 0.24));
    if (mut.indexOf('sudden') >= 0) a = Math.min(a, Math.max(0, Math.min(1, (0.58 - d) / 0.12)));
    return a * Math.min(1, (1.02 - d) * 6);
  }

  const warmed = {};
  function drawNotes(run, t, look, mut) {
    const eng = run.eng, chart = run.chart, notes = chart.notes;
    const shape = (M.NOTES.find(n => n.id === G.profile.equip.note) || M.NOTES[0]).shape;
    /* a skin's notes are painted together, every lane and kind */
    if (!warmed[shape] && (warmed[shape] = true)) for (let l = 0; l < 4; ++l) { NA.note(shape, l, 'tap'); NA.note(shape, l, 'star'); NA.note('orb', l, 'hush'); NA.holdBody(l, false); }
    if (!run.drawFrom) run.drawFrom = 0;
    while (run.drawFrom < notes.length && (notes[run.drawFrom].end || notes[run.drawFrom].t) < t - 0.5) ++run.drawFrom;
    /* back to front: far notes first */
    let last = run.drawFrom || 0;
    while (last < notes.length && notes[last].t - t < look * 1.02) ++last;
    for (let i = last - 1; i >= (run.drawFrom || 0); --i) {
      const n = notes[i];
      const res = eng.res[i];
      if (n.attack >= 0 && eng.fired[n.attack] !== 1) continue;
      const held = n.end && eng.held[n.lane] === i;
      if (res >= 1 && res <= 3 && !held) continue;
      if (res === 6) continue;
      const d = (n.t - t) / look;
      if (d < -0.18 && !n.end) continue;
      const dim = res === 4 || res === 5 ? 0.35 : 1;
      if (n.end) {
        const dt = Math.min(1.02, (n.end - t) / look);
        const dh = held ? 0 : Math.max(-0.18, d);
        if (dt > dh && eng.hold[i] !== 2) {
          const x0 = laneX(n.lane, yAt(dh)), x1 = laneX(n.lane, yAt(dt));
          const w0 = widthAt(dh) / 4 * 0.42, w1 = widthAt(dt) / 4 * 0.42;
          ctx.save();
          ctx.globalAlpha = (held ? 1 : 0.8) * dim * noteAlpha(Math.max(0, dh), mut);
          ctx.fillStyle = K.rgba(n.star ? '#ffd25a' : C.LANE_COLORS[n.lane], held ? 0.85 : 0.6);
          ctx.beginPath(); ctx.moveTo(x0 - w0, yAt(dh)); ctx.lineTo(x0 + w0, yAt(dh)); ctx.lineTo(x1 + w1, yAt(dt)); ctx.lineTo(x1 - w1, yAt(dt)); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = held ? '#ffffff' : 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 3 * proj(dh);
          ctx.beginPath(); ctx.moveTo(x0, yAt(dh)); ctx.lineTo(x1, yAt(dt)); ctx.stroke();
          K.circle(ctx, x1, yAt(dt), w1 * 0.9, K.rgba(C.LANE_COLORS[n.lane], 0.9));
          ctx.restore();
          if (held) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(G.time * 20); K.blit(ctx, K.glow(C.LANE_COLORS[n.lane]), laneX(n.lane, HIT_Y), HIT_Y, 0.7); ctx.restore(); }
        }
        if (held) continue;
      }
      if (d > 1.02) continue;
      const y = yAt(d);
      let lane = n.lane;
      if (n.kind === 'drift' && n.from != null) {
        const f = Math.max(0, Math.min(1, (0.55 - d) / 0.4));
        lane = n.from + (n.lane - n.from) * (f * f * (3 - 2 * f));
      }
      const x = laneX(lane, y);
      const s = proj(d) * 1.3;
      const a = noteAlpha(d, mut) * dim;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const kind = n.kind === 'hush' ? 'hush' : n.star ? 'star' : 'tap';
      K.blit(ctx, NA.note(n.kind === 'hush' ? 'orb' : shape, n.lane, kind), x, y, s);
      if (n.kind === 'drift' && d > 0.15) {
        const dir = Math.sign(n.lane - n.from);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + dir * 30 * s, y);
        ctx.lineTo(x + dir * 18 * s, y - 9 * s);
        ctx.lineTo(x + dir * 18 * s, y + 9 * s);
        ctx.closePath();
        ctx.fill();
      }
      if (n.pickup) K.blit(ctx, NA.pickup(n.pickup), x, y - 30 * s, s);
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.highway, { A, VY, proj, yAt, widthAt, laneX, laneAt, lookOf, draw, skin, surface });
  void TAU;
})();
