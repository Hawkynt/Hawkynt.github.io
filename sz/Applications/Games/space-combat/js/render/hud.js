/* The arcade HUD: the two side panels framing the play field (ship status, hull and shield,
   special and dash gauges, secondary ammo, power-up timers, focus; score, combo, grazes,
   scrap, objective and progress, convoy or station health, mutator, controls), and on the
   field itself the boss health bar, threat markers for ships about to enter, banners, damage
   vignette, warp tint, flash and the pointer marker. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU, COMBO_WINDOW, OVERCHARGE_TIME, MAGNET_TIME, PF_X, PF_W, PF_H } = NS.constants;
  const { SECTORS, MISSION_TYPES } = NS.campaign;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const FX1 = PF_X + PF_W;

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

  /* ── the frame: panels either side of the field, dark bands above and below it ── */
  function drawFrame() {
    const v = visible();
    const accent = SECTORS[G.sector] ? SECTORS[G.sector].theme.accent : UI.accent;
    const lg = ctx.createLinearGradient(PF_X - 280, 0, PF_X, 0);
    lg.addColorStop(0, 'rgba(3,6,16,0.9)');
    lg.addColorStop(1, 'rgba(6,10,24,0.8)');
    ctx.fillStyle = lg;
    ctx.fillRect(v.x0, v.y0, PF_X - v.x0, v.h);
    const rg = ctx.createLinearGradient(FX1, 0, FX1 + 280, 0);
    rg.addColorStop(0, 'rgba(6,10,24,0.8)');
    rg.addColorStop(1, 'rgba(3,6,16,0.9)');
    ctx.fillStyle = rg;
    ctx.fillRect(FX1, v.y0, v.x1 - FX1, v.h);
    ctx.fillStyle = 'rgba(3,6,16,0.6)';
    if (v.y0 < 0) ctx.fillRect(PF_X, v.y0, PF_W, -v.y0);
    if (v.y1 > PF_H) ctx.fillRect(PF_X, PF_H, PF_W, v.y1 - PF_H);
    /* glowing rails along the field edges */
    for (let s = 0; s < 2; ++s) {
      const x = s ? FX1 : PF_X;
      ctx.fillStyle = K.rgba(accent, 0.12);
      ctx.fillRect(x - 4, 0, 8, PF_H);
      ctx.fillStyle = K.rgba(accent, 0.65);
      ctx.fillRect(x - 1, 0, 2, PF_H);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; ++i) ctx.fillRect(x - 3, 40 + i * 128, 6, 2);
    }
  }

  /* ── left panel: the ship ── */
  function drawShip(p) {
    const x = PF_X - 258, w = 238;
    let y = 18;
    kit.panel(x, y, w, 200, { accent: p.colors.glow, alpha: 0.95, radius: 8 });
    K.blitRot(ctx, NS.shipArt.shipSprite(p.ship.id, p.skinKey, p.colors, 0), x + 30, y + 30, -Math.PI / 2, 0.8);
    kit.text(p.ship.name.toUpperCase(), x + 58, y + 24, 15, '#ffffff', { weight: 'bold' });
    kit.fitText(p.primary.name, x + 58, y + 42, w - 70, 12, { color: UI.textDim });
    const low = p.hull < p.maxHull * 0.3;
    kit.text('HULL', x + 14, y + 72, 11, UI.textDim, { weight: 'bold' });
    kit.text(Math.ceil(p.hull) + '', x + w - 14, y + 72, 12, UI.text, { align: 'right' });
    kit.bar(x + 14, y + 80, w - 28, 12, p.hull / p.maxHull, low && Math.floor(G.time * 4) % 2 ? '#ffffff' : UI.hull, { cells: 10 });
    kit.text('SHIELD', x + 14, y + 110, 11, UI.textDim, { weight: 'bold' });
    kit.text(Math.ceil(p.shield) + '', x + w - 14, y + 110, 12, UI.text, { align: 'right' });
    kit.bar(x + 14, y + 118, w - 28, 12, p.shield / p.maxShield, UI.shield, { cells: 10 });
    kit.text(p.secondary.name.toUpperCase(), x + 14, y + 152, 11, UI.textDim, { weight: 'bold' });
    kit.text('X', x + w - 14, y + 152, 11, UI.textMute, { align: 'right', weight: 'bold' });
    const pips = Math.min(p.maxAmmo, 16);
    const pw = Math.min(12, (w - 28) / Math.max(1, pips));
    for (let i = 0; i < pips; ++i) {
      const filled = i < Math.round(p.ammo / Math.max(1, p.maxAmmo) * pips);
      ctx.fillStyle = filled ? UI.warn : 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 14 + i * pw, y + 162, pw - 3, 14);
    }
    if (p.ammo <= 0) kit.text('EMPTY', x + w / 2, y + 190, 11, UI.bad, { align: 'center', weight: 'bold' });

    /* special and dash gauges */
    y = 232;
    kit.panel(x, y, w, 112, { accent: UI.accent, alpha: 0.95, radius: 8, brackets: false });
    const ab = p.ship.ability;
    const abCd = ab.cd * G.stats.abilityCd;
    ringGauge(x + 60, y + 44, 26, 1 - p.abilityCd / abCd, p.colors.glow, 'E', p.abilityCd <= 0);
    kit.fitText(ab.name, x + 60, y + 90, 110, 12, { align: 'center', color: p.abilityCd <= 0 ? '#ffffff' : UI.textDim });
    ringGauge(x + w - 60, y + 44, 22, 1 - p.dashCd / G.stats.dashCd, '#5cff9a', 'C', p.dashCd <= 0);
    kit.text('Dash', x + w - 60, y + 90, 12, p.dashCd <= 0 ? '#ffffff' : UI.textDim, { align: 'center' });

    /* timed effects and focus */
    y = 360;
    const timers = [];
    if (p.focus) timers.push(['FOCUS', 1, '#ffffff']);
    if (p.overcharge > 0) timers.push(['Overcharge', p.overcharge / (OVERCHARGE_TIME + G.stats.overTime), '#ff5cf0']);
    if (p.magnet > 0) timers.push(['Magnet', p.magnet / MAGNET_TIME, '#ffd25a']);
    if (p.overdrive > 0) timers.push([ab.name, p.overdrive / ab.time, p.colors.glow]);
    if (p.aegis > 0) timers.push([ab.name, p.aegis / ab.time, '#ffd27a']);
    if (G.warp > 0) timers.push(['Time Warp', G.warp / ab.time, '#8affe0']);
    if (p.inNebula) timers.push(['In nebula', 1, '#d0a0ff']);
    for (let i = 0; i < timers.length; ++i) {
      const ty = y + i * 26;
      kit.text(timers[i][0], x + 6, ty + 4, 13, timers[i][2], { weight: 'bold' });
      kit.bar(x + 110, ty - 2, w - 116, 8, timers[i][1], timers[i][2]);
    }

    /* controls reminder */
    const keys = G.input.touch ? [] : [['Z / Space', 'Fire'], ['X', 'Secondary'], ['C', 'Dash'], ['Shift', 'Focus'], ['E', 'Special'], ['Esc', 'Pause']];
    for (let i = 0; i < keys.length; ++i) {
      const ky = PF_H - 20 - (keys.length - 1 - i) * 19;
      kit.text(keys[i][0], x + 6, ky, 12, UI.textMute, { weight: 'bold' });
      kit.text(keys[i][1], x + 92, ky, 12, UI.textMute);
    }
  }

  /* ── right panel: score and mission ── */
  function drawScore() {
    const x = FX1 + 20, w = 238;
    kit.text('SCORE', x + 4, 30, 12, UI.textDim, { weight: 'bold' });
    kit.text(String(G.score), x + w - 4, 62, 34, '#ffffff', { align: 'right', weight: 'bold' });
    if (G.multiplier > 1) {
      const pulse = 1 + Math.max(0, G.comboT - COMBO_WINDOW + 0.3) * 1.5;
      ctx.save();
      ctx.translate(x + w - 4, 98);
      ctx.scale(pulse, pulse);
      kit.text('x' + G.multiplier, 0, 0, 26, '#ff9ab8', { align: 'right', weight: 'bold' });
      ctx.restore();
      kit.text(G.combo + ' chain', x + 4, 98, 13, UI.textDim);
      kit.bar(x + 4, 114, w - 8, 5, G.comboT / COMBO_WINDOW, '#ff9ab8');
    }
    kit.text('Graze ' + G.grazes, x + 4, 142, 13, UI.textDim);
    kit.credits(G.runScrap, x + w - 4, 142, 15, 'right');
  }

  function drawObjective() {
    const st = G.stage;
    if (!st) return;
    const x = FX1 + 20, w = 238;
    let y = 170;
    const sec = SECTORS[st.sector];
    const a = G.allies[0];
    kit.panel(x, y, w, a && st.mutator ? 186 : 150, { accent: sec.theme.accent, alpha: 0.95, radius: 8 });
    kit.fitText(st.name.toUpperCase(), x + 14, y + 22, w - 28, 15, { weight: 'bold', color: '#ffffff' });
    kit.fitText(sec.name + '  -  ' + MISSION_TYPES[st.type].name, x + 14, y + 42, w - 28, 12, { color: sec.theme.accent });
    kit.fitText(NS.missions.progressText(), x + 14, y + 72, w - 28, 15, { weight: 'bold', color: UI.gold });
    const rt = st.rt;
    let frac = -1;
    if (st.type === 'survive' || st.type === 'defend') frac = 1 - rt.timeLeft / st.time;
    else if (st.type === 'escort' && G.allies[0]) frac = G.allies[0].progress;
    else if (st.type === 'collect') frac = rt.coresGot / Math.max(1, rt.cores);
    else if (st.type === 'destroy') frac = (rt.outposts - rt.outpostsLeft) / Math.max(1, rt.outposts);
    if (frac >= 0) kit.bar(x + 14, y + 84, w - 28, 8, frac, UI.gold);
    if (a) {
      kit.text(a.type === 'station' ? 'STATION' : 'FREIGHTER', x + 14, y + 116, 11, UI.good, { weight: 'bold' });
      kit.bar(x + 14, y + 124, w - 28, 10, a.hp / a.maxHp, a.hurtT > 0 && Math.floor(G.time * 8) % 2 ? '#ffffff' : UI.good);
    } else if (st.mutator) {
      kit.text(NS.waves.MUTATORS[st.mutator].name, x + 14, y + 116, 13, UI.gold, { weight: 'bold' });
      kit.fitText(NS.waves.MUTATORS[st.mutator].desc, x + 14, y + 134, w - 28, 11, { color: UI.textDim });
    }
    if (G.run && G.run.stages && G.run.stages.length > 1)
      kit.text('Stage ' + (G.run.idx + 1) + ' / ' + G.run.stages.length, x + w - 14, y + 22, 12, UI.textDim, { align: 'right' });
    if (a && st.mutator) kit.text(NS.waves.MUTATORS[st.mutator].name, x + 14, y + 168, 13, UI.gold, { weight: 'bold' });
  }

  /* the boss bar across the top of the field */
  function drawBossBar() {
    const b = G.boss;
    if (!b || !b.alive || b.dying) return;
    const cx = PF_X + PF_W / 2, y = 22;
    const w = PF_W - 80;
    const k = b.introT > 0 ? 1 - b.introT / 2.6 : 1;
    const bg = ctx.createLinearGradient(0, 0, 0, y + 38);
    bg.addColorStop(0, 'rgba(0,0,0,0.55)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(PF_X, 0, PF_W, y + 38);
    kit.text(b.def.name.toUpperCase(), cx - w / 2, y - 6, 13, '#ff8a8a', { weight: 'bold' });
    kit.text('PHASE ' + (b.phase + 1), cx + w / 2, y - 6, 12, UI.textDim, { align: 'right', weight: 'bold' });
    kit.bar(cx - w / 2, y, w, 12, b.hp / b.maxHp * k, b.vulnerable ? '#ff5c6c' : '#7a8ab0');
    const ph = b.def.phases;
    for (let i = 1; i < ph.length; ++i) {
      const px = cx - w / 2 + w * ph[i].at;
      ctx.fillStyle = b.phase >= i ? 'rgba(255,255,255,0.3)' : '#ffffff';
      ctx.fillRect(px - 1, y - 3, 2, 18);
    }
    let hint = '', col = UI.textDim;
    if (!b.vulnerable) { hint = 'SHIELDED - destroy the ' + (b.def.shieldBy === 'shard' ? 'shards' : 'emitters'); col = '#8ad8ff'; }
    else if (b.def.weak === 'mouth') { hint = b.mouth > 0.5 ? 'MOUTH OPEN - STRIKE NOW' : 'Wait for the mouth to open'; col = b.mouth > 0.5 ? UI.gold : UI.textDim; }
    else if (b.def.weak === 'rear') hint = 'Armoured head - hit it as it turns away';
    if (hint) kit.text(hint, cx, y + 26, 12, col, { align: 'center', weight: 'bold' });
  }

  /* chevrons on the field edge where ships are about to enter */
  function drawThreats() {
    const t = G.time;
    const blink = 0.55 + Math.sin(t * 10) * 0.35;
    ctx.globalAlpha = blink;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.cloak < 0.3) continue;
      let x, y, a;
      if (e.y < -e.r * 0.3 && e.x > 0 && e.x < PF_W) { x = e.x; y = 10; a = Math.PI / 2; }
      else if (e.x < -e.r * 0.3 && e.y > 0 && e.y < PF_H) { x = 10; y = e.y; a = 0; }
      else if (e.x > PF_W + e.r * 0.3 && e.y > 0 && e.y < PF_H) { x = PF_W - 10; y = e.y; a = Math.PI; }
      else continue;
      const s = e.r > 35 ? 11 : 7;
      ctx.fillStyle = e.objective ? UI.gold : '#ff5c6c';
      ctx.save();
      ctx.translate(PF_X + x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.6, s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBanner() {
    const b = G.banner;
    if (!b) return;
    const t = b.t, life = b.life;
    const kin = Math.min(1, t * 4), kout = Math.min(1, (life - t) * 3);
    const a = Math.min(kin, kout);
    const cx = PF_X + PF_W / 2, cy = PF_H * 0.36;
    ctx.globalAlpha = a;
    const grd = ctx.createLinearGradient(PF_X, 0, FX1, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(PF_X, cy - 44, PF_W, b.sub ? 92 : 70);
    ctx.fillStyle = b.color;
    ctx.fillRect(cx - 280 * kin, cy - 44, 560 * kin, 2);
    ctx.save();
    ctx.translate(cx, cy - 6);
    const s = 1 + (1 - kin) * 0.4;
    ctx.scale(s, s);
    ctx.font = kit.font(38, 'bold');
    const tw = ctx.measureText(b.title).width;
    const fit = Math.min(1, (PF_W - 40) / Math.max(1, tw));
    ctx.scale(fit, fit);
    kit.text(b.title, 0, 0, 38, '#ffffff', { align: 'center', weight: 'bold' });
    ctx.restore();
    if (b.sub) kit.fitText(b.sub, cx, cy + 32, PF_W - 60, 16, { align: 'center', weight: 'bold', color: b.color });
    ctx.globalAlpha = 1;
  }

  /* where the ship is heading while it follows the mouse */
  function drawPointer(p) {
    const inp = G.input;
    if (inp.touch || inp.steer !== 'mouse') return;
    const x = inp.mouseX, y = inp.mouseY;
    ctx.strokeStyle = K.rgba(p.colors.glow, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
    ctx.stroke();
  }

  function draw() {
    const p = G.player;
    /* tints over the field first */
    if (G.warp > 0) {
      ctx.globalAlpha = Math.min(1, G.warp) * 0.55;
      ctx.drawImage(vignette('#30ffd0').canvas, PF_X, 0, PF_W, PF_H);
    }
    const lowHull = p && p.alive && p.hull < p.maxHull * 0.3 ? 0.25 + Math.sin(G.time * 6) * 0.12 : 0;
    const vig = Math.max(G.vignette, lowHull);
    if (vig > 0) {
      ctx.globalAlpha = Math.min(1, vig);
      ctx.drawImage(vignette('#ff1a1a').canvas, PF_X, 0, PF_W, PF_H);
    }
    ctx.globalAlpha = 1;
    if (!p) return;
    drawThreats();
    drawShip(p);
    drawScore();
    drawObjective();
    drawBossBar();
    drawBanner();
    if (p.alive) drawPointer(p);
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
    draw, drawFrame, drawFlash, drawToast, vignette
  });
})();
