/* The flight HUD in view-plane coordinates, pinned to the visible edges at any aspect: hull,
   shield and fuel gauges, the segmented ore hold with its value, the belt name and mode clock,
   the scanner radar (rocks by ore, pirates, hazards, wrecks, the dock), the off-screen dock
   arrow, ability slots, hazard warnings, banners, the tow countdown, first-trip hints, the
   aim reticle, plus the screen flash, toasts and achievement pop-ups shared by every screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU, RADAR_R, VIEW_W, VIEW_H } = NS.constants;
  const { ORES, ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;
  const tmp = { x: 0, y: 0 };

  function draw() {
    const run = G.run, s = G.ship;
    if (!run || !s) return;
    const v = visible();
    if (G.cine) {
      drawLetterbox(v);
      return;
    }
    gauges(v, s);
    hold(v, run);
    header(v, run);
    radar(v, run, s);
    if (!NS.touch.active()) abilities(v, run);
    warnings(v, run, s);
    dockArrow(v, s);
    hints(v, run);
    drawBanner(v);
    if (NS.touch.active()) NS.touch.draw();
    else reticle();
  }

  function gauge(x, y, w, label, val, max, color, iconKind, blink) {
    kit.icon(iconKind, x + 10, y + 7, 16, color);
    const low = blink && val / max < 0.25 && Math.sin(G.time * 10) > 0;
    kit.bar(x + 24, y + 1, w, 12, val / max, low ? '#ffffff' : color, { cells: 10 });
    kit.text(label + ' ' + Math.ceil(val), x + 30 + w, y + 7, 12, UI.textDim);
  }

  function gauges(v, s) {
    const x = v.x0 + 18, y = v.y0 + 16;
    kit.panel(x - 6, y - 8, 290, s.maxShield > 0 ? 82 : 62, { alpha: 0.82, radius: 8, brackets: false });
    gauge(x, y, 190, 'HULL', s.hull, s.maxHull, UI.hull, 'hull', true);
    let yy = y + 20;
    if (s.maxShield > 0) {
      gauge(x, yy, 190, 'SHLD', s.shield, s.maxShield, UI.shield, 'shield', false);
      yy += 20;
    }
    gauge(x, yy, 190, 'FUEL', s.fuel, s.maxFuel, UI.fuel, 'fuel', true);
  }

  /* the hold: one segment per ore, in value order, with the hold's worth */
  function hold(v, run) {
    const w = 420, h = 20, x = (v.x0 + v.x1) / 2 - w / 2, y = v.y1 - 46;
    kit.panel(x - 12, y - 26, w + 24, 60, { alpha: 0.85, radius: 9, brackets: false });
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    let off = 0;
    let value = 0;
    const career = run.mode === 'career';
    for (let i = 0; i < ORES.length; ++i) {
      const id = ORES[i].id;
      const n = run.cargo[id];
      if (!n) continue;
      const seg = NS.rules.oreSpace(G.stats, id) * n / run.cargoMax * w;
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, ORES[i].glow);
      gr.addColorStop(0.5, ORES[i].color);
      gr.addColorStop(1, ORES[i].dark);
      ctx.fillStyle = gr;
      ctx.fillRect(x + off, y, Math.max(1, seg), h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + off + seg - 1, y, 1, h);
      off += seg;
      value += n * (career ? NS.economy.price(G.save, G.stats, id) : ORES[i].value);
    }
    if (run.pickT > 0 && run.lastOre) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = run.pickT * 3;
      K.blit(ctx, K.glow(ORE_BY_ID[run.lastOre].color), x + off, y + h / 2, 0.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = run.cargoUsed >= run.cargoMax - 0.5 ? UI.bad : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    kit.icon('cargo', x + 2, y - 13, 15, UI.accent);
    kit.text('HOLD  ' + Math.floor(run.cargoUsed) + ' / ' + run.cargoMax, x + 16, y - 13, 13, run.cargoUsed >= run.cargoMax - 0.5 ? UI.bad : UI.text, { weight: 'bold' });
    kit.credits(Math.round(value), x + w, y - 13, 13, 'right');
    if (run.rd > 0) kit.amount(run.rd, x + w / 2 + 30, y - 13, 13, 'center', 'rd');
  }

  function header(v, run) {
    const cx = (v.x0 + v.x1) / 2;
    const z = run.zone;
    kit.text(z.name.toUpperCase(), cx, v.y0 + 20, 15, z.theme.accent, { align: 'center', weight: 'bold' });
    if (run.mode !== 'career') {
      const t = Math.max(0, run.timeLeft);
      const m = Math.floor(t / 60), sec = Math.floor(t % 60);
      const low = t < 30;
      kit.text(m + ':' + (sec < 10 ? '0' : '') + sec, cx, v.y0 + 50, 30, low && Math.sin(G.time * 8) > 0 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
      kit.credits(run.sold + run.salvage, cx, v.y0 + 80, 16, 'center');
    } else if (run.salvage > 0) kit.credits(run.salvage, cx, v.y0 + 42, 14, 'center');
  }

  function radar(v, run, s) {
    const R = RADAR_R;
    const cx = v.x1 - R - 20, cy = v.y0 + R + 20;
    const range = 1500;
    const k = R / range;
    ctx.fillStyle = 'rgba(4,10,20,0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = K.rgba(UI.cyan, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = K.rgba(UI.cyan, 0.15);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.5, 0, TAU);
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    /* sweep */
    const sw = G.time * 1.8;
    ctx.fillStyle = K.rgba(UI.cyan, 0.08);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, sw - 0.6, sw);
    ctx.closePath();
    ctx.fill();
    const storm = G.storm && G.storm.phase === 'active';
    const showOre = G.stats.scanner >= 1;
    const now = G.time;
    for (let i = 0; i < G.radZones.length; ++i) blip(cx, cy, k, s, G.radZones[i].x, G.radZones[i].y, 0, 'rgba(124,255,74,0.25)', G.radZones[i].r * k);
    for (let i = 0; i < G.wells.length; ++i) blip(cx, cy, k, s, G.wells[i].x, G.wells[i].y, 0, 'rgba(255,120,80,0.3)', G.wells[i].r * k * 0.5);
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      const dx = (o.x - s.x) * k, dy = (o.y - s.y) * k;
      if (dx * dx + dy * dy > R * R || (storm && Math.random() < 0.5)) continue;
      let col = 'rgba(160,170,190,0.55)';
      if (o.volatile) col = '#ff6a3a';
      else if (o.ore && (showOre || now - o.scanT < 8)) col = ORE_BY_ID[o.ore].color;
      ctx.fillStyle = col;
      const sz = o.kind !== 'rock' ? 4 : o.tier >= 3 ? 2.2 : 1.4;
      ctx.fillRect(cx + dx - sz / 2, cy + dy - sz / 2, sz, sz);
    }
    for (let i = 0; i < G.specials.length; ++i) {
      const o = G.specials[i];
      if (o.alive && o.known) blip(cx, cy, k, s, o.x, o.y, 3.5, '#ffd25a', 0, true);
    }
    for (let i = 0; i < G.rocks.length; ++i)
      if (G.rocks[i].kind !== 'rock' && G.rocks[i].known) blip(cx, cy, k, s, G.rocks[i].x, G.rocks[i].y, 4, '#e8c8ff', 0, true);
    for (let i = 0; i < G.pirates.length; ++i) blip(cx, cy, k, s, G.pirates[i].x, G.pirates[i].y, 2.6, '#ff4a4a', 0);
    for (let i = 0; i < G.drones.length; ++i) if (G.drones[i].alive) blip(cx, cy, k, s, G.drones[i].x, G.drones[i].y, 1.8, '#5cff9a', 0);
    blip(cx, cy, k, s, G.dock.x, G.dock.y, 4, UI.gold, 0, true, true);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (run.pulse) {
      ctx.strokeStyle = K.rgba(UI.cyan, 1 - run.pulse.t / 1.2);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(R, run.pulse.r * k * run.pulse.t / 1.2 * 1.6), 0, TAU);
      ctx.stroke();
    }
    if (storm) kit.text('STATIC', cx, cy + R + 14, 11, UI.warn, { align: 'center', weight: 'bold' });
  }

  /* a radar mark; clamp keeps important marks on the rim when out of range */
  function blip(cx, cy, k, s, x, y, size, color, ring, clampToEdge, square) {
    let dx = (x - s.x) * k, dy = (y - s.y) * k;
    const d = Math.sqrt(dx * dx + dy * dy);
    const R = RADAR_R;
    if (d > R) {
      if (!clampToEdge) return;
      dx *= (R - 3) / d;
      dy *= (R - 3) / d;
    }
    if (ring) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, Math.min(ring, R), 0, TAU);
      ctx.fill();
      return;
    }
    ctx.fillStyle = color;
    if (square) ctx.fillRect(cx + dx - size, cy + dy - size, size * 2, size * 2);
    else {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, size, 0, TAU);
      ctx.fill();
    }
  }

  function slot(x, y, iconKind, key, ready, frac, label, color) {
    kit.panel(x, y, 54, 54, { alpha: 0.85, radius: 8, brackets: false, accent: ready ? color : UI.textMute });
    kit.icon(iconKind, x + 27, y + 24, 24, ready ? color : UI.textMute);
    if (frac > 0 && frac < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.moveTo(x + 27, y + 24);
      ctx.arc(x + 27, y + 24, 20, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      ctx.closePath();
      ctx.fill();
    }
    kit.text(key, x + 5, y + 9, 10, UI.textDim, { weight: 'bold' });
    if (label) kit.text(label, x + 49, y + 46, 11, '#ffffff', { align: 'right', weight: 'bold' });
  }

  function abilities(v, run) {
    const st = G.stats;
    const items = [];
    if (st.boost) items.push(['flame', 'SHIFT', G.ship.fuel > 0, 0, '', UI.shield]);
    if (st.scan) items.push(['scan', 'Q', run.pulseCd <= 0, run.pulseCd > 0 ? run.pulseCd / (9 - st.scan) : 0, '', UI.cyan]);
    if (st.seismic) items.push(['blast', 'C', run.charges > 0, 0, String(run.charges), UI.warn]);
    if (G.drones.length) {
      let alive = 0;
      for (let i = 0; i < G.drones.length; ++i) if (G.drones[i].alive) ++alive;
      items.push(['drone', 'F', run.dronesOut, 0, alive + '/' + G.drones.length, UI.good]);
    }
    let y = v.y0 + RADAR_R * 2 + 44;
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      slot(v.x1 - 74, y, it[0], it[1], it[2], it[3], it[4], it[5]);
      y += 62;
    }
  }

  function warnings(v, run, s) {
    const cx = (v.x0 + v.x1) / 2;
    let y = v.y0 + (run.mode === 'career' ? 96 : 120);
    const blink = Math.sin(G.time * 9) > -0.2;
    const warn = (txt, col) => {
      if (blink) kit.text(txt, cx, y, 17, col, { align: 'center', weight: 'bold' });
      y += 24;
    };
    if (run.inRad > 0) warn('RADIATION  -  hull burning', '#9aff6a');
    if (run.inWell > 0.35) warn('GRAVITY WELL  -  burn away', '#ff9a6a');
    if (G.storm && G.storm.phase === 'warn') warn('SOLAR STORM IN ' + Math.ceil(G.storm.t), UI.warn);
    if (G.storm && G.storm.phase === 'active') warn('SOLAR STORM', '#ffd08a');
    if (s.fuel > 0 && s.fuel / s.maxFuel < 0.2) warn('FUEL LOW  -  head for the dock', UI.fuel);
    if (run.towT > 0) warn((G.stats.jump ? 'JUMPING HOME IN ' : 'TOW ARRIVES IN ') + Math.ceil(run.towT), UI.bad);
  }

  /* an arrow on the screen edge toward the dock when it is out of sight */
  function dockArrow(v, s) {
    NS.camera.toView(G.dock.x, G.dock.y, tmp);
    const m = 40;
    if (tmp.x > v.x0 + m && tmp.x < v.x1 - m && tmp.y > v.y0 + m && tmp.y < v.y1 - m) return;
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const a = Math.atan2(tmp.y - cy, tmp.x - cx);
    const hw = (v.w / 2) - 56, hh = (v.h / 2) - 70;
    const t = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
    const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
    const pulse = G.run.cargoUsed >= G.run.cargoMax - 0.5 ? 1 + Math.sin(G.time * 8) * 0.2 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = UI.gold;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const d = Math.sqrt((G.dock.x - s.x) * (G.dock.x - s.x) + (G.dock.y - s.y) * (G.dock.y - s.y));
    kit.text('DOCK ' + Math.round(d / 10) * 10 + 'm', x - Math.cos(a) * 30, y - Math.sin(a) * 26, 11, UI.gold, { align: 'center', weight: 'bold' });
  }

  function hints(v, run) {
    if (run.mode !== 'career' || G.save.stats.trips > 1 || run.t > 40) return;
    const lines = ['WASD / arrows fly  -  Mouse aims, hold left button to drill',
      'Break rocks, the tractor beam pulls the ore in',
      'Fly back into the DOCK ring to sell at the station'];
    const i = Math.min(2, Math.floor(run.t / 13));
    ctx.globalAlpha = Math.min(1, (run.t % 13) * 2, (13 - run.t % 13));
    kit.text(lines[i], (v.x0 + v.x1) / 2, v.y1 - 96, 15, '#ffffff', { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function reticle() {
    if (G.input.aimMode !== 'mouse') return;
    const x = G.input.mouseX, y = G.input.mouseY;
    ctx.strokeStyle = G.input.firing ? '#ffb070' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    for (let i = 0; i < 4; ++i) {
      const a = i * Math.PI / 2 + G.time * (G.input.firing ? 3 : 0.5);
      ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17);
    }
    ctx.stroke();
  }

  function drawBanner(v) {
    const b = G.banner;
    if (!b) return;
    const t = b.t;
    const a = Math.min(1, t * 4, (3.4 - t) * 2);
    const slide = (1 - Math.min(1, t * 3)) * 40;
    const cx = (v.x0 + v.x1) / 2, y = v.y0 + 170 - slide;
    ctx.globalAlpha = Math.max(0, a);
    const g = ctx.createLinearGradient(cx - 360, 0, cx + 360, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 360, y - 30, 720, b.sub ? 74 : 54);
    ctx.fillStyle = b.color;
    ctx.fillRect(cx - 220 * Math.min(1, t * 2), y - 30, 440 * Math.min(1, t * 2), 2);
    kit.text(b.title, cx, y, 28, b.color, { align: 'center', weight: 'bold' });
    if (b.sub) kit.text(b.sub, cx, y + 30, 14, UI.text, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  /* cinematic bars over the flight view */
  function drawLetterbox(v) {
    const c = G.cine;
    const k = Math.min(1, c.t * 3, (c.dur - c.t) * 3);
    const h = 64 * Math.max(0, k);
    ctx.fillStyle = '#000';
    ctx.fillRect(v.x0, v.y0, v.w, h);
    ctx.fillRect(v.x0, v.y1 - h, v.w, h);
    NS.cineRender.drawInWorld(v, c);
    if (c.t > 0.35) kit.text('any key to skip', v.x1 - 20, v.y1 - h / 2, 11, 'rgba(255,255,255,0.4)', { align: 'right' });
  }

  /* ── shared by every screen ── */
  function drawFlash() {
    if (G.flash <= 0) return;
    const v = visible();
    ctx.globalAlpha = Math.min(1, G.flash);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    const v = visible();
    const t = G.ui.toast;
    if (t) {
      const a = Math.min(1, t.t * 5, (2.6 - t.t) * 3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = kit.font(15, 'bold');
      const w = ctx.measureText(t.text).width + 40;
      kit.panel((v.x0 + v.x1) / 2 - w / 2, v.y1 - 120, w, 38, { accent: t.color, radius: 8, brackets: false });
      kit.text(t.text, (v.x0 + v.x1) / 2, v.y1 - 101, 15, t.color, { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
    const pops = G.ui.popups;
    for (let i = 0; i < pops.length; ++i) {
      const p = pops[i];
      const a = Math.min(1, p.t * 4, (4 - p.t) * 2);
      const slide = (1 - Math.min(1, p.t * 4)) * 60;
      const x = v.x1 - 330 + slide, y = v.y1 - 90 - i * 70 - (G.screen === 'playing' ? 0 : 0);
      ctx.globalAlpha = Math.max(0, a);
      kit.panel(x, y, 310, 60, { accent: UI.gold, glow: true, radius: 8 });
      kit.icon('trophy', x + 30, y + 30, 28, UI.gold);
      kit.text('ACHIEVEMENT  -  ' + p.name, x + 54, y + 20, 14, UI.gold, { weight: 'bold' });
      kit.text(p.desc + '   +' + p.rd + ' data', x + 54, y + 42, 12, UI.textDim);
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.hud, {
    draw, drawFlash, drawToast, VIEW_W, VIEW_H
  });
})();
