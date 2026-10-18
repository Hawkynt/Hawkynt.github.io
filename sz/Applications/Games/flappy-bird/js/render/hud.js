;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* In-run overlays: score, combo, coins and hearts, timer, power-up chips, the biome banner
     and the READY panel with its flap preview. Reads G, writes nothing. */

  const { CANVAS_W, FLAP_IMPULSE, BIRD_X, POWER_TIMED } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Shapes = NS.shapes;

  function drawHud() {
    // Adventure progress — the bar sits at the very top, a flag marks its end
    if (G.mode === 'adventure') {
      ui.drawMeter(440, 14, 400, 10, Math.min(1, (G.dist + BIRD_X) / G.course.finishX), '#ffd23f');
      ctx.save();
      ctx.strokeStyle = '#e8eefc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(848, 10);
      ctx.lineTo(848, 28);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(848, 10);
      ctx.lineTo(864, 15);
      ctx.lineTo(848, 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Score display during play — a dark copy sits under the outlined number
    ctx.save();
    const popScale = G.scorePopTimer > 0 ? 1 + 0.2 * (G.scorePopTimer / 0.2) : 1;
    const scorePx = Math.round(64 * popScale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.35;
    ui.fitText(String(G.score), CANVAS_W / 2 + 3, 82, 500, scorePx, { weight: 'bold', color: '#000' });
    ctx.globalAlpha = 1;
    ui.fitText(String(G.score), CANVAS_W / 2, 78, 500, scorePx, {
      weight: 'bold',
      color: '#fff',
      outline: '#000'
    });
    ctx.restore();

    // Combo streak under the score
    if (G.combo >= 2)
      ui.drawChip('COMBO ' + G.combo + '  x' + Rules.comboMult(), CANVAS_W / 2, 148, 30, {
        align: 'center',
        color: '#7affd8',
        bg: 'rgba(0,0,0,0.45)'
      });

    // Coins & hearts panel — the counter bumps whenever coins come in
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
    ui.fitText(String(G.coinsRun), 76, 44, 142, 30, { weight: 'bold', color: ui.UI.gold });
    ctx.restore();
    const maxH = Rules.maxHearts();
    for (let i = 0; i < maxH; ++i) {
      // The last heart left breathes when there were more to lose
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

    // Time attack clock
    if (G.mode === 'time') {
      const t = Math.max(0, G.timeLeft);
      ui.drawChip(t.toFixed(1) + ' s', CANVAS_W - 24, 20, 36, {
        align: 'right',
        color: t < 10 ? ui.UI.bad : ui.UI.text,
        bg: 'rgba(0,0,0,0.45)'
      });
    }

    // Active power-ups, top right below the clock
    const chips = [];
    if (G.power.shield)
      chips.push({ kind: 'shield', frac: 1 });
    for (const kind of POWER_TIMED)
      if (G.power[kind] > 0)
        chips.push({ kind: kind, frac: G.power[kind] / Rules.powerDuration(kind) });
    let chipX = CANVAS_W - 40;
    const chipY = G.mode === 'time' ? 96 : 40;
    for (const chip of chips) {
      ctx.save();
      ctx.translate(chipX, chipY);
      ctx.scale(0.6, 0.6);
      G.scene.drawBubble(ctx, chip.kind, 0, 0, G.globalTime);
      ctx.restore();
      if (chip.kind !== 'shield') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(chipX, chipY, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chip.frac);
        ctx.stroke();
        ctx.restore();
      }
      chipX -= 56;
    }
  }

  // Biome banner — slides in from the top, stays, then fades out; the READY screen
  // keeps it armed so the banner belongs to the run, not to the wait before it
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
    const pw = 460;
    const ph = 150;
    const px = 700;
    const py = 250;
    const cx = px + pw / 2;
    let title;
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      title = 'Adventure ' + st.id + ' ' + st.name;
    } else if (G.mode === 'time')
      title = 'Time Attack';
    else if (G.mode === 'daily')
      title = 'Daily Run';
    else
      title = 'Classic';
    ui.drawPanel(px, py, pw, ph, { title: title, titlePx: 20 });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const n = G.save.stars[st.id] || 0;
      let starsStr = '';
      for (let i = 0; i < 3; ++i)
        starsStr += i < n ? '★' : '☆';
      ui.fitText('Stars: ' + starsStr, cx, py + 62, pw - 40, 22, { color: ui.UI.gold });
    } else {
      ui.fitText('Best: ' + Prog.modeBest(), cx, py + 62, pw - 40, 22, { color: ui.UI.textDim });
    }
    ui.fitText('Tap or Space to start', cx, py + 96, pw - 40, 26, { weight: 'bold', color: ui.UI.text });
    ctx.restore();

    ui.drawKeyHints([
      { key: 'Space', label: 'Start' },
      { key: 'Esc', label: 'Menu' }
    ], cx, py + ph - 24, pw - 40, 1);

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
        ctx.arc(BIRD_X, ty, 2.5, 0, Math.PI * 2);
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

  Object.assign(NS.hud, { drawHud, drawBiomeBanner, drawReadyOverlay });
})();
