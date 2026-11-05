;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* In-run overlays: score or arcade points with the multiplier, combo, fever meter, coins,
     hearts and tokens, timer, power-up chips, the boss health bar and entrance card, the
     pause button, the biome banner, the READY panel with its flap preview, and the toast
     pop-ups. Reads G, writes nothing. */

  const { CANVAS_W, CANVAS_H, FLAP_IMPULSE, BIRD_X, POWER_TIMED, FEVER_TIME } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Shapes = NS.shapes;
  const View = NS.view;

  const PAUSE_BTN = { x: CANVAS_W - 64, y: 14, w: 48, h: 48 };

  function drawPauseButton() {
    const b = PAUSE_BTN;
    const hot = G.mouseX >= b.x && G.mouseX <= b.x + b.w && G.mouseY >= b.y && G.mouseY <= b.y + b.h;
    ui.roundRectPath(b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = hot ? 'rgba(30,40,70,0.85)' : 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x + 16, b.y + 13, 6, 22);
    ctx.fillRect(b.x + 27, b.y + 13, 6, 22);
  }

  function drawScore() {
    ctx.save();
    const popScale = G.scorePopTimer > 0 ? 1 + 0.2 * (G.scorePopTimer / 0.2) : 1;
    const arcade = G.mode === 'arcade';
    const text = arcade ? G.points.toLocaleString('en-US') : String(G.score);
    const px = Math.round((arcade ? 52 : 64) * popScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.35;
    ui.fitText(text, CANVAS_W / 2 + 3, 82, 500, px, { weight: 'bold', color: '#000' });
    ctx.globalAlpha = 1;
    ui.fitText(text, CANVAS_W / 2, 78, 500, px, { weight: 'bold', color: '#fff', outline: '#000' });
    ctx.restore();
    let y = 128;
    if (arcade) {
      ui.drawChip('x' + G.mult + (G.feverT > 0 ? '  x2 FEVER' : ''), CANVAS_W / 2, y, 30, {
        align: 'center', color: G.feverT > 0 ? '#ff8af0' : '#ffd84a', bg: 'rgba(0,0,0,0.45)'
      });
      y += 38;
    }
    if (G.mode === 'zen') {
      ui.drawChip('FLOW ' + G.flow, CANVAS_W / 2, y, 30, { align: 'center', color: '#bff4ff', bg: 'rgba(0,0,0,0.35)' });
      y += 38;
    }
    if (G.combo >= 2)
      ui.drawChip('COMBO ' + G.combo + '  x' + Rules.comboMult(), CANVAS_W / 2, y, 30, { align: 'center', color: '#7affd8', bg: 'rgba(0,0,0,0.45)' });
  }

  /* the fever meter under the coin panel: fills with PERFECT passes, drains while active */
  function drawFever() {
    if (G.mode === 'zen')
      return;
    const x = 20, y = 116, w = 210, h = 14;
    const active = G.feverT > 0;
    const ratio = active ? G.feverT / FEVER_TIME : G.fever;
    ui.roundRectPath(x, y, w, h, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    if (ratio > 0) {
      ui.roundRectPath(x + 2, y + 2, Math.max(6, (w - 4) * ratio), h - 4, 5);
      const hue = active ? Math.floor(G.globalTime * 300) % 360 : 315;
      ctx.fillStyle = 'hsl(' + hue + ',95%,62%)';
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(active ? 'FEVER!' : 'FEVER', x + w / 2, y + h / 2 + 1, w - 10, 11, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.6)' });
  }

  function drawHud() {
    // Story / Boss Rush progress — the bar sits at the very top, a flag marks its end
    if ((G.mode === 'adventure' || G.mode === 'bossrush') && !G.boss) {
      ui.drawMeter(440, 14, 400, 10, Math.min(1, (G.dist + BIRD_X) / G.course.finishX), '#ffd23f');
      ctx.strokeStyle = '#e8eefc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(848, 10);
      ctx.lineTo(848, 28);
      ctx.stroke();
      ctx.fillStyle = NS.bossfight.arenaKind() ? '#ff4a4a' : '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(848, 10);
      ctx.lineTo(864, 15);
      ctx.lineTo(848, 20);
      ctx.closePath();
      ctx.fill();
    }
    if (G.boss)
      drawBossBar();
    else
      drawScore();

    // Coins, hearts and tokens panel — the counter bumps whenever coins come in
    ui.drawPanel(20, 16, 210, 92);
    G.scene.drawCoin(ctx, 50, 44, G.globalTime);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (G.coinBump > 0) {
      const bs = 1 + 0.25 * (G.coinBump / 0.2);
      ctx.translate(76, 44);
      ctx.scale(bs, bs);
      ctx.translate(-76, -44);
    }
    ui.fitText(String(G.coinsRun), 76, 44, 70, 30, { weight: 'bold', color: ui.UI.gold });
    ctx.restore();
    if (G.season && G.mode !== 'time' && G.mode !== 'bossrush') {
      ctx.save();
      ctx.translate(166, 44);
      ctx.scale(0.62, 0.62);
      SZ.FlappySeasonArt.drawToken(ctx, G.season.event.id, 0, 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(String(G.tokensRun), 184, 44, 40, 20, { weight: 'bold', color: G.season.event.tokenColor });
    }
    if (G.mode !== 'zen') {
      const maxH = Math.max(Rules.maxHearts(), G.hearts);
      for (let i = 0; i < maxH; ++i) {
        if (G.hearts === 1 && maxH > 1 && i === 0) {
          const hs = 1 + 0.12 * Math.sin(G.globalTime * 8);
          ctx.save();
          ctx.translate(40, 84);
          ctx.scale(hs, hs);
          ctx.translate(-40, -84);
          Shapes.drawHeart(40, 84, 22, true);
          ctx.restore();
        } else {
          Shapes.drawHeart(40 + i * 28, 84, 22, i < G.hearts);
        }
      }
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText('Zen - nothing can hurt you', 34, 84, 186, 15, { color: '#bff4ff' });
    }
    drawFever();

    // Time attack clock
    let chipY = 90;
    if (G.mode === 'time') {
      const t = Math.max(0, G.timeLeft);
      ui.drawChip(t.toFixed(1) + ' s', CANVAS_W - 80, 20, 36, { align: 'right', color: t < 10 ? ui.UI.bad : ui.UI.text, bg: 'rgba(0,0,0,0.45)' });
    }

    // Active power-ups, right side under the pause button
    const chips = [];
    if (G.power.shield)
      chips.push({ kind: 'shield', frac: 1 });
    for (const kind of POWER_TIMED)
      if (G.power[kind] > 0)
        chips.push({ kind: kind, frac: G.power[kind] / Rules.powerDuration(kind) });
    let chipX = CANVAS_W - 40;
    for (const chip of chips) {
      ctx.save();
      ctx.translate(chipX, chipY);
      ctx.scale(0.6, 0.6);
      G.scene.drawBubble(ctx, chip.kind, 0, 0, G.globalTime);
      ctx.restore();
      if (chip.kind !== 'shield') {
        ctx.strokeStyle = chip.frac < 0.25 && Math.floor(G.globalTime * 8) % 2 ? '#ff6a6a' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(chipX, chipY, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chip.frac);
        ctx.stroke();
      }
      chipX -= 56;
    }
    drawPauseButton();
  }

  function drawBossBar() {
    const b = G.boss;
    const def = SZ.FlappyBoss.KINDS[b.kind];
    const x = 400, y = 18, w = 480, h = 22;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(def.name + (b.phase2 ? '  -  ENRAGED' : ''), CANVAS_W / 2, y + 2, w, 18, { weight: 'bold', color: b.phase2 ? '#ff8a8a' : '#ffffff', outline: 'rgba(0,0,0,0.7)' });
    ui.drawMeter(x, y + 16, w, h, b.hp / b.maxHp, b.phase2 ? '#ff4a4a' : NS.bossfight.BOSS_COLORS[b.kind]);
    if (G.mode === 'bossrush' && G.bossRush)
      ui.drawChip('Round ' + (G.bossRush.index + 1) + ' / ' + G.bossRush.list.length, CANVAS_W / 2, y + 46, 26, { align: 'center', color: '#ffd84a', bg: 'rgba(0,0,0,0.45)' });
    // the hint for the first fight
    if (b.state === 'fight' && b.t < 9 && G.save.stats.bossNoHit + Object.keys(G.save.bosses).reduce((a, k) => a + G.save.bosses[k], 0) === 0) {
      const a = Math.min(1, (9 - b.t) / 1.5);
      ctx.save();
      ctx.globalAlpha = a;
      ui.drawChip('Grab the sun orbs to strike back!', CANVAS_W / 2, 640, 34, { align: 'center', color: '#fff3a0', bg: 'rgba(0,0,0,0.55)' });
      ctx.restore();
    }
  }

  /* the boss entrance: letterbox bars, its name card and its taunt */
  function drawBossIntro() {
    const b = G.boss;
    const t = 3 - G.bossIntro;
    const inU = Math.min(1, t / 0.4), outU = Math.min(1, G.bossIntro / 0.4);
    const k = Math.min(inU, outU);
    const v = View.visibleRect();
    ctx.fillStyle = '#000000';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, (0 - v.y0) + 70 * k);
    ctx.fillRect(v.x0, CANVAS_H - 70 * k, v.x1 - v.x0, v.y1 - CANVAS_H + 70 * k);
    const def = SZ.FlappyBoss.KINDS[b.kind];
    const slide = (1 - (1 - Math.pow(1 - inU, 3))) * 500;
    ctx.save();
    ctx.globalAlpha = outU;
    ui.drawPanel(160 - slide, 470, 600, 120, { accent: NS.bossfight.BOSS_COLORS[b.kind], glow: true });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(def.name.toUpperCase(), 190 - slide, 512, 540, 40, { weight: 'bold', color: NS.bossfight.BOSS_COLORS[b.kind], outline: 'rgba(0,0,0,0.6)' });
    ui.fitText(def.title, 192 - slide, 552, 540, 20, { color: ui.UI.text });
    ctx.restore();
    if (t > 0.8) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - 0.8) / 0.3) * outU;
      const text = NS.bossfight.taunt();
      ctx.font = 'bold 22px ' + "'Segoe UI', Arial, sans-serif";
      const tw = Math.min(520, ctx.measureText(text).width + 40);
      const bx = Math.min(CANVAS_W - tw - 20, b.x - tw / 2), by = b.y - 150;
      ui.roundRectPath(bx, by, tw, 48, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1a1a2a';
      ctx.stroke();
      ctx.textAlign = 'center';
      ui.fitText(text, bx + tw / 2, by + 25, tw - 24, 20, { weight: 'bold', color: '#1a1a2a' });
      ctx.restore();
    }
  }

  // Biome banner — slides in from the top, stays, then fades out
  function drawBiomeBanner() {
    const age = 2.5 - G.biomeBanner;
    const inU = Math.min(1, age / 0.35);
    const inEase = 1 - Math.pow(1 - inU, 3);
    const bannerY = -60 + inEase * 260;
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.biomeBanner);
    ui.drawPanel(CANVAS_W / 2 - 240, bannerY, 480, 84);
    ctx.fillStyle = G.scene.theme.sun.glow;
    ctx.globalAlpha = Math.min(1, G.biomeBanner) * 0.8;
    ctx.fillRect(CANVAS_W / 2 - 200, bannerY + 66, 400, 3);
    ctx.globalAlpha = Math.min(1, G.biomeBanner);
    ui.drawHeadline(G.biomeBannerText, CANVAS_W / 2, bannerY + 42, 440, 40, ui.UI.gold);
    ctx.restore();
  }

  // Ready screen overlay — a compact panel beside the bird, never over it
  function drawReadyOverlay() {
    const pw = 480, ph = 170, px = 690, py = 240, cx = px + pw / 2;
    let title = Prog.modeName();
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      title = 'Story ' + st.id + '  ' + st.name;
    }
    ui.drawPanel(px, py, pw, ph, { title: title, titlePx: 20 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let line;
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const n = G.save.stars[st.id] || 0;
      line = (st.boss ? 'Boss stage!  ' : '') + 'Stars: ' + '★'.repeat(n) + '☆'.repeat(3 - n);
      ui.fitText(line, cx, py + 60, pw - 40, 22, { color: ui.UI.gold });
    } else if (G.mode === 'daily' && G.twist) {
      ui.fitText('Twist: ' + G.twist.name + ' - ' + G.twist.desc, cx, py + 60, pw - 40, 18, { color: '#ff9a3a' });
    } else if (G.mode === 'zen') {
      ui.fitText('Breathe. Nothing can hurt you here.', cx, py + 60, pw - 40, 20, { color: '#bff4ff' });
    } else {
      ui.fitText('Best: ' + Prog.modeBest().toLocaleString('en-US'), cx, py + 60, pw - 40, 22, { color: ui.UI.textDim });
    }
    ui.fitText(G.touchUsed ? 'Tap to flap and start' : 'Tap, click or Space to start', cx, py + 98, pw - 40, 26, { weight: 'bold', color: ui.UI.text });
    ctx.restore();
    ui.drawKeyHints([{ key: 'Space', label: 'Start' }, { key: 'Esc', label: 'Menu' }], cx, py + ph - 26, pw - 40, 1);

    // Dotted preview of where the first flap would carry the bird
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    let tvy = FLAP_IMPULSE, ty = G.bird.y;
    for (let f = 1; f <= 30; ++f) {
      tvy += Rules.gravityNow();
      ty += tvy;
      if (f % 4 === 0 || f === 30) {
        ctx.beginPath();
        ctx.arc(BIRD_X + f * 3, ty, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Bouncing chevron pair and a pulsing TAP! under the bird
    ctx.save();
    const tapBounce = Math.sin(G.globalTime * 4) * 4;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.globalTime * 4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let c = 0; c < 2; ++c) {
      const cy = G.bird.y + 42 + c * 13 + tapBounce;
      ctx.beginPath();
      ctx.moveTo(BIRD_X - 10, cy);
      ctx.lineTo(BIRD_X, cy + 8);
      ctx.lineTo(BIRD_X + 10, cy);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('TAP!', BIRD_X + 52, G.bird.y + 55 + tapBounce, 100, 22, { weight: 'bold', color: '#ffffff' });
    ctx.restore();
  }

  /* achievement / quest / reward pop-ups slide down from the top, one at a time */
  function drawToasts() {
    if (!G.toasts.length)
      return;
    const t = G.toasts[0];
    const inU = Math.min(1, t.t / 0.3), outU = Math.min(1, (2.8 - t.t) / 0.3);
    const k = Math.max(0, Math.min(inU, outU));
    const e = 1 - Math.pow(1 - k, 3);
    const w = 520, h = 66, x = CANVAS_W / 2 - w / 2, y = -80 + e * 160;
    ctx.save();
    ctx.globalAlpha = k;
    ui.drawPanel(x, y, w, h, { accent: t.color, glow: true, noStuds: true });
    Shapes.drawStarShape(x + 34, y + h / 2, 16, true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(t.title, x + 62, y + 22, w - 80, 20, { weight: 'bold', color: t.color });
    ui.fitText(t.text, x + 62, y + 46, w - 80, 15, { color: ui.UI.text });
    ctx.restore();
  }

  Object.assign(NS.hud, { PAUSE_BTN, drawHud, drawBossBar, drawBossIntro, drawBiomeBanner, drawReadyOverlay, drawToasts, drawPauseButton });
})();
