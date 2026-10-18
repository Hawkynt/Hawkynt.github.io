/* The in-flight HUD, anchored to the visible plane's corners: hull, shield and heat bars,
   special and dodge cooldown rings, secondary ammo, power-up timers, objective and progress,
   score, combo and scrap, the boss health bar with phases, the radar with its sweep, off-screen
   indicators, banners, damage vignette, warp tint, flare warning, flash and the aim reticle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU, RADAR_R, COMBO_WINDOW, OVERCHARGE_TIME, MAGNET_TIME } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const tmp = { x: 0, y: 0 };

  function vignette(color) {
    return K.sprite('vig:' + color, 320, 180, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.62);
      gr.addColorStop(0, K.rgba(color, 0));
      gr.addColorStop(1, K.rgba(color, 0.85));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }

  function ringGauge(x, y, r, frac, color, label, ready) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = ready ? color : K.rgba(color, 0.6);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, Math.min(1, frac)));
    ctx.stroke();
    if (ready) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 5) * 0.15;
      K.blit(ctx, K.glow(color), x, y, r / 20);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    kit.text(label, x, y + 1, r * 0.75, ready ? '#ffffff' : UI.textDim, { align: 'center', weight: 'bold' });
  }

  function drawStatus(v, p) {
    const x = v.x0 + 18, y = v.y0 + 16;
    kit.panel(x, y, 300, 112, { accent: UI.accent, alpha: 0.9, brackets: false, radius: 8 });
    kit.text(p.ship.name.toUpperCase(), x + 14, y + 16, 12, UI.accent, { weight: 'bold' });
    kit.text('HULL', x + 14, y + 38, 11, UI.textDim, { weight: 'bold' });
    const low = p.hull < p.maxHull * 0.3;
    kit.bar(x + 60, y + 32, 180, 12, p.hull / p.maxHull, low && Math.floor(G.time * 4) % 2 ? '#ffffff' : UI.hull, { cells: 10 });
    kit.text(Math.ceil(p.hull) + '', x + 286, y + 38, 12, UI.text, { align: 'right' });
    kit.text('SHIELD', x + 14, y + 58, 11, UI.textDim, { weight: 'bold' });
    kit.bar(x + 60, y + 52, 180, 12, p.shield / p.maxShield, UI.shield, { cells: 10 });
    kit.text(Math.ceil(p.shield) + '', x + 286, y + 58, 12, UI.text, { align: 'right' });
    kit.text('HEAT', x + 14, y + 78, 11, p.overheated ? UI.bad : UI.textDim, { weight: 'bold' });
    kit.bar(x + 60, y + 73, 180, 9, p.heat, p.overheated ? UI.bad : UI.heat);
    if (p.overheated) kit.text('OVERHEAT', x + 150, y + 78, 10, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(p.secondary.name, x + 14, y + 98, 12, UI.text);
    const pips = Math.min(p.maxAmmo, 16);
    for (let i = 0; i < pips; ++i) {
      const filled = i < Math.round(p.ammo / p.maxAmmo * pips);
      ctx.fillStyle = filled ? UI.warn : 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 150 + i * 9, y + 92, 6, 12);
    }

    /* special and roll gauges */
    const ab = p.ship.ability;
    const abCd = ab.cd * G.stats.abilityCd;
    ringGauge(x + 340, y + 34, 20, 1 - p.abilityCd / abCd, p.colors.glow, 'E', p.abilityCd <= 0);
    kit.text(ab.name, x + 340, y + 66, 11, UI.textDim, { align: 'center' });
    ringGauge(x + 396, y + 34, 15, 1 - p.rollCd / G.stats.rollCd, '#5cff9a', '', p.rollCd <= 0);
    kit.icon('roll', x + 396, y + 34, 16, p.rollCd <= 0 ? '#ffffff' : UI.textDim);
    kit.text('Roll', x + 396, y + 66, 11, UI.textDim, { align: 'center' });

    /* timed effects */
    const timers = [];
    if (p.overcharge > 0) timers.push(['Overcharge', p.overcharge / (OVERCHARGE_TIME + G.stats.overTime), '#ff5cf0']);
    if (p.magnet > 0) timers.push(['Magnet', p.magnet / MAGNET_TIME, '#ffd25a']);
    if (p.overdrive > 0) timers.push([ab.name, p.overdrive / ab.time, p.colors.glow]);
    if (p.aegis > 0) timers.push([ab.name, p.aegis / ab.time, '#ffd27a']);
    if (G.warp > 0) timers.push(['Time Warp', G.warp / ab.time, '#8affe0']);
    for (let i = 0; i < timers.length; ++i) {
      const ty = y + 126 + i * 22;
      kit.text(timers[i][0], x + 6, ty, 12, timers[i][2], { weight: 'bold' });
      kit.bar(x + 96, ty - 4, 110, 7, timers[i][1], timers[i][2]);
    }
  }

  function drawObjective(v) {
    const st = G.stage;
    if (!st) return;
    const cx = (v.x0 + v.x1) / 2;
    const txt = NS.missions.progressText();
    kit.text(txt, cx, v.y0 + 28, 20, '#ffffff', { align: 'center', weight: 'bold' });
    const rt = st.rt;
    let frac = -1;
    if (st.type === 'survive' || st.type === 'defend') frac = 1 - rt.timeLeft / st.time;
    else if (st.type === 'escort' && G.allies[0]) frac = G.allies[0].progress;
    else if (st.type === 'collect') frac = rt.coresGot / Math.max(1, rt.cores);
    else if (st.type === 'destroy') frac = (rt.outposts - rt.outpostsLeft) / Math.max(1, rt.outposts);
    if (frac >= 0) kit.bar(cx - 140, v.y0 + 44, 280, 6, frac, UI.gold);
    if (st.type === 'defend' || st.type === 'escort') {
      const a = G.allies[0];
      if (a) {
        kit.text(a.type === 'station' ? 'STATION' : 'FREIGHTER', cx - 140, v.y0 + 64, 11, UI.good, { weight: 'bold' });
        kit.bar(cx - 60, v.y0 + 59, 200, 8, a.hp / a.maxHp, a.hurtT > 0 && Math.floor(G.time * 8) % 2 ? '#ffffff' : UI.good);
      }
    }
    if (st.mutator) kit.text(NS.waves.MUTATORS[st.mutator].name, cx, v.y0 + 84, 12, UI.gold, { align: 'center' });
  }

  function drawScore(v) {
    const x = v.x1 - 20, y = v.y0 + 30;
    kit.text(String(G.score), x, y, 30, '#ffffff', { align: 'right', weight: 'bold' });
    if (G.multiplier > 1) {
      const pulse = 1 + Math.max(0, G.comboT - COMBO_WINDOW + 0.3) * 1.5;
      ctx.save();
      ctx.translate(x - 4, y + 32);
      ctx.scale(pulse, pulse);
      kit.text('x' + G.multiplier, 0, 0, 24, '#ff9ab8', { align: 'right', weight: 'bold' });
      ctx.restore();
      kit.bar(x - 160, y + 52, 160, 5, G.comboT / COMBO_WINDOW, '#ff9ab8');
      kit.text(G.combo + ' chain', x - 70, y + 32, 13, UI.textDim, { align: 'right' });
    }
    kit.credits(G.runScrap, x, y + 76, 15, 'right');
  }

  function drawBossBar(v) {
    const b = G.boss;
    if (!b || !b.alive || b.dying) return;
    const cx = (v.x0 + v.x1) / 2, y = v.y0 + 100;
    const w = Math.min(560, v.w - 640);
    const k = b.introT > 0 ? 1 - b.introT / 2.6 : 1;
    kit.text(b.def.name.toUpperCase() + '  -  ' + b.def.title, cx, y - 12, 14, '#ff8a8a', { align: 'center', weight: 'bold' });
    kit.bar(cx - w / 2, y, w, 14, b.hp / b.maxHp * k, b.vulnerable ? '#ff5c6c' : '#7a8ab0');
    const ph = b.def.phases;
    for (let i = 1; i < ph.length; ++i) {
      const px = cx - w / 2 + w * ph[i].at;
      ctx.fillStyle = b.phase >= i ? 'rgba(255,255,255,0.3)' : '#ffffff';
      ctx.fillRect(px - 1, y - 3, 2, 20);
    }
    if (!b.vulnerable) kit.text('SHIELDED - destroy the ' + (b.def.shieldBy === 'shard' ? 'shards' : 'emitters'), cx, y + 28, 12, '#8ad8ff', { align: 'center', weight: 'bold' });
    else if (b.def.weak === 'mouth') kit.text(b.mouth > 0.5 ? 'MOUTH OPEN - STRIKE NOW' : 'Wait for the mouth to open', cx, y + 28, 12, b.mouth > 0.5 ? UI.gold : UI.textDim, { align: 'center', weight: 'bold' });
    else if (b.def.weak === 'rear') kit.text('Armoured head - hit it from the side or behind', cx, y + 28, 12, UI.textDim, { align: 'center' });
  }

  /* ── radar ── */
  function drawRadar(v, p) {
    const R = RADAR_R;
    /* on touch screens the sticks own the bottom corners: the radar moves under the score */
    const cx = v.x1 - R - 22, cy = G.input.touch ? v.y0 + R + 150 : v.y1 - R - 22;
    const range = 1500 * G.stats.radar;
    const k = R / range;
    ctx.fillStyle = 'rgba(4,10,22,0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = K.rgba(UI.accent, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = K.rgba(UI.accent, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.5, 0, TAU);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    /* the sweep */
    const sa = G.time * 2.2;
    ctx.fillStyle = K.rgba(UI.accent, 0.12);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, sa - 0.6, sa);
    ctx.closePath();
    ctx.fill();
    /* sector edge as a clipped rectangle */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,92,108,0.4)';
    ctx.strokeRect(cx - p.x * k, cy - p.y * k, G.world.w * k, G.world.h * k);
    for (let i = 0; i < G.nebulae.length; ++i) {
      const n = G.nebulae[i];
      ctx.fillStyle = 'rgba(176,74,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx + (n.x - p.x) * k, cy + (n.y - p.y) * k, n.r * k, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      ctx.strokeStyle = '#6ad0ff';
      ctx.beginPath();
      ctx.arc(cx + (h.x - p.x) * k, cy + (h.y - p.y) * k, 4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    const dot = (x, y, r, color) => {
      let dx = (x - p.x) * k, dy = (y - p.y) * k;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R - 2) { dx *= (R - 2) / d; dy *= (R - 2) / d; }
      ctx.fillStyle = color;
      ctx.fillRect(cx + dx - r, cy + dy - r, r * 2, r * 2);
    };
    for (let i = 0; i < G.pickups.length; ++i) {
      const q = G.pickups[i];
      if (q.type === 'core') dot(q.x, q.y, 3, '#7affd0');
      else if (q.type !== 'scrap') dot(q.x, q.y, 1.5, '#ffffff');
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.cloak < 0.3 || (e.inNebula && !p.inNebula)) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (!e.objective && dx * dx + dy * dy > range * range) continue;
      dot(e.x, e.y, e.objective ? 4 : e.r > 35 ? 3 : 1.8, e.objective ? UI.gold : '#ff5c6c');
    }
    for (let i = 0; i < G.allies.length; ++i)
      if (G.allies[i].alive) dot(G.allies[i].x, G.allies[i].y, 4, UI.good);
    if (G.boss && G.boss.alive) dot(G.boss.x, G.boss.y, 5, '#ff3a3a');
    /* the player arrow */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (p.inNebula) kit.text('NEBULA - radar blind', cx, cy - R - 16, 11, '#d0a0ff', { align: 'center', weight: 'bold' });
  }

  /* arrows at the screen edge toward important things outside the view */
  function drawIndicators(v, p) {
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const items = [];
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.cloak < 0.3 || e.spawnT > 0 || (e.inNebula && !p.inNebula)) continue;
      items.push([e.x, e.y, e.objective ? UI.gold : '#ff5c6c', e.objective ? 9 : 6, e.objective]);
    }
    for (let i = 0; i < G.pickups.length; ++i)
      if (G.pickups[i].type === 'core') items.push([G.pickups[i].x, G.pickups[i].y, '#7affd0', 9, true]);
    for (let i = 0; i < G.allies.length; ++i)
      if (G.allies[i].alive) items.push([G.allies[i].x, G.allies[i].y, UI.good, 10, true]);
    if (G.boss && G.boss.alive) items.push([G.boss.x, G.boss.y, '#ff3a3a', 12, true]);
    if (G.stage && G.stage.rt.gate) items.push([G.stage.rt.gate.x, G.stage.rt.gate.y, '#9ad8ff', 8, true]);
    const m = 34;
    let drawn = 0;
    for (let i = 0; i < items.length && drawn < 40; ++i) {
      const it = items[i];
      NS.camera.toView(it[0], it[1], tmp);
      if (tmp.x > v.x0 && tmp.x < v.x1 && tmp.y > v.y0 && tmp.y < v.y1) continue;
      const dx = tmp.x - cx, dy = tmp.y - cy;
      const dist = Math.sqrt((it[0] - p.x) * (it[0] - p.x) + (it[1] - p.y) * (it[1] - p.y));
      if (!it[4] && dist > 1500) continue;
      const sx = (v.w / 2 - m) / Math.abs(dx || 1e-6), sy = (v.h / 2 - m) / Math.abs(dy || 1e-6);
      const s = Math.min(sx, sy);
      const x = cx + dx * s, y = cy + dy * s;
      const a = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.globalAlpha = it[4] ? 0.95 : Math.max(0.3, 1 - dist / 1500);
      ctx.fillStyle = it[2];
      const r = it[3];
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.75); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.7, r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (it[4]) kit.text(Math.round(dist / 10) * 10 + '', x - Math.cos(a) * 22, y - Math.sin(a) * 22, 11, it[2], { align: 'center' });
      ++drawn;
    }
    ctx.globalAlpha = 1;
  }

  function drawBanner(v) {
    const b = G.banner;
    if (!b) return;
    const t = b.t, life = b.life;
    const kin = Math.min(1, t * 4), kout = Math.min(1, (life - t) * 3);
    const a = Math.min(kin, kout);
    const cx = (v.x0 + v.x1) / 2, cy = v.y0 + v.h * 0.3;
    ctx.globalAlpha = a;
    const grd = ctx.createLinearGradient(cx - 420, 0, cx + 420, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(cx - 420, cy - 44, 840, b.sub ? 92 : 70);
    ctx.fillStyle = b.color;
    ctx.fillRect(cx - 300 * kin, cy - 44, 600 * kin, 2);
    ctx.save();
    ctx.translate(cx, cy - 6);
    const s = 1 + (1 - kin) * 0.4;
    ctx.scale(s, s);
    kit.text(b.title, 0, 0, 40, '#ffffff', { align: 'center', weight: 'bold' });
    ctx.restore();
    if (b.sub) kit.text(b.sub, cx, cy + 32, 17, b.color, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  function drawReticle(p) {
    const inp = G.input;
    if (inp.touch || inp.aimMode !== 'mouse') return;
    const x = inp.mouseX, y = inp.mouseY;
    const s = 12 + (inp.firing ? Math.sin(G.time * 40) * 1.5 : 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; ++i) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      ctx.moveTo(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55);
      ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    }
    ctx.stroke();
    ctx.strokeStyle = K.rgba(p.colors.glow, 0.8);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, TAU);
    ctx.stroke();
  }

  function draw() {
    const v = visible();
    const p = G.player;
    /* full-screen tints first */
    if (G.warp > 0) {
      ctx.globalAlpha = Math.min(1, G.warp) * 0.55;
      ctx.drawImage(vignette('#30ffd0').canvas, v.x0, v.y0, v.w, v.h);
    }
    const f = G.flare;
    if (f && f.state === 'warn') {
      ctx.globalAlpha = 0.25 + Math.sin(G.time * 12) * 0.2;
      ctx.drawImage(vignette('#ffa030').canvas, v.x0, v.y0, v.w, v.h);
    }
    const lowHull = p && p.alive && p.hull < p.maxHull * 0.3 ? 0.25 + Math.sin(G.time * 6) * 0.12 : 0;
    const vig = Math.max(G.vignette, lowHull);
    if (vig > 0) {
      ctx.globalAlpha = Math.min(1, vig);
      ctx.drawImage(vignette('#ff1a1a').canvas, v.x0, v.y0, v.w, v.h);
    }
    ctx.globalAlpha = 1;
    if (!p) return;
    if (p.alive) {
      drawIndicators(v, p);
      drawStatus(v, p);
      drawRadar(v, p);
      drawReticle(p);
    }
    drawObjective(v);
    drawScore(v);
    drawBossBar(v);
    drawBanner(v);
    if (p.outside && p.alive) kit.text('RETURN TO THE SECTOR', (v.x0 + v.x1) / 2, v.y1 - 60, 20, UI.bad, { align: 'center', weight: 'bold' });
    if (NS.touch.active()) NS.touch.draw();
  }

  /* The flash and fade on top of everything, every screen */
  function drawFlash() {
    if (G.flash <= 0) return;
    const v = visible();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, G.flash);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawToast() {
    const t = G.ui.toast;
    if (!t) return;
    const v = visible();
    const a = Math.min(1, t.t * 4, (2.4 - t.t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    const cx = (v.x0 + v.x1) / 2;
    ctx.font = kit.font(16, 'bold');
    const w = ctx.measureText(t.text).width + 40;
    kit.panel(cx - w / 2, v.y1 - 110, w, 40, { accent: t.color, brackets: false, radius: 20 });
    kit.text(t.text, cx, v.y1 - 90, 16, t.color, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, {
    draw, drawFlash, drawToast, vignette
  });
})();
