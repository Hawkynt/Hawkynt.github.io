/* Bootstrap: the requestAnimationFrame game loop (production ticks, counter
   smoothing, cookie spring, glow/confetti/ripple timers, achievement and auto-save
   sweeps, crumb drift, then the full redraw) and start-up — mute button, canvas,
   saved game, derived values and the first frame. Loaded last. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, CANVAS_H, MAX_DT, AUTO_SAVE_INTERVAL, COOKIE_CX, COOKIE_CY } = NS.constants;
  const ctx = NS.dom.ctx;
  const particles = NS.dom.particles;
  const floatingText = NS.dom.floatingText;
  function tickConfetti(dt) {
    if (S.confettiTimer <= 0)
      return;
    S.confettiTimer -= dt;
  }
  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    if (!S.lastTimestamp)
      S.lastTimestamp = timestamp;
    const rawDt = (timestamp - S.lastTimestamp) / 1000;
    const dt = Math.min(rawDt, MAX_DT);
    S.lastTimestamp = timestamp;

    // Auto-generation
    if (S.cps > 0) {
      const earned = S.cps * dt;
      S.cookies += earned;
      S.cookiesBaked += earned;
      S.cookiesBakedAllTime += earned;
    }

    // Smooth counter animation
    S.displayCookies += (S.cookies - S.displayCookies) * Math.min(1, dt * 10);

    // Cookie squish spring
    S.cookieScaleV += (1 - S.cookieScale) * 20 * dt;
    S.cookieScaleV *= 0.85;
    S.cookieScale += S.cookieScaleV * dt * 60;

    // Purchase glow fade
    if (S.purchaseGlowTimer > 0)
      S.purchaseGlowTimer -= dt;

    // Confetti
    tickConfetti(dt);

    // Achievement check (every second)
    S.achievementCheckTimer += dt;
    if (S.achievementCheckTimer >= 1) {
      S.achievementCheckTimer = 0;
      NS.achievements.checkAchievements();
      NS.achievements.checkMilestones();
    }

    // Auto-save
    S.autoSaveTimer += dt;
    if (S.autoSaveTimer >= AUTO_SAVE_INTERVAL / 1000) {
      S.autoSaveTimer = 0;
      NS.saveload.saveGame();
    }

    // Update background crumb particles
    for (const crumb of S.bgCrumbs) {
      crumb.y += crumb.speed * dt;
      if (crumb.y > CANVAS_H + 5) {
        crumb.y = -5;
        crumb.x = COOKIE_CX + (Math.random() - 0.5) * 250;
      }
    }

    // Update click ripple
    if (S.clickRipple) {
      S.clickRipple.radius += 150 * dt;
      S.clickRipple.alpha -= 1.4 * dt;
      if (S.clickRipple.alpha <= 0)
        S.clickRipple = null;
    }

    // Update effects
    particles.update(dt);
    floatingText.update(dt);

    // Update tooltip from current mouse position
    NS.tooltips.updateTooltipFromMouse(S.mouseX, S.mouseY);

    // ── Draw ──
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bakery warm glow
    ctx.save();
    const glowGrad = ctx.createRadialGradient(COOKIE_CX, COOKIE_CY, 20, COOKIE_CX, COOKIE_CY, 220);
    glowGrad.addColorStop(0, 'rgba(255,180,60,0.12)');
    glowGrad.addColorStop(0.5, 'rgba(200,140,40,0.06)');
    glowGrad.addColorStop(1, 'rgba(200,140,40,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // Background crumb particles
    ctx.save();
    for (const crumb of S.bgCrumbs) {
      ctx.beginPath();
      ctx.arc(crumb.x, crumb.y, crumb.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,120,60,' + crumb.alpha + ')';
      ctx.fill();
    }
    ctx.restore();

    NS.draw.drawStats();
    NS.draw.drawCookie();

    // Click ripple ring
    if (S.clickRipple) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(S.clickRipple.x, S.clickRipple.y, S.clickRipple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,0,' + S.clickRipple.alpha + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    NS.draw.drawBuildingsPanel();
    NS.draw.drawUpgradesPanel();

    // Render effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    // Tooltip on top of everything
    NS.draw.drawTooltip();

    NS.status.updateStatus();

    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  Object.assign(NS.app, { tickConfetti, gameLoop });

  /* ── Init ── */
  {
    const muteBtn = SZ.GameAudio.attachMuteButton(document.querySelector('.status-bar'));
    muteBtn.style.position = 'static';
    muteBtn.style.margin = '0 0 0 auto';
    muteBtn.style.width = muteBtn.style.height = '18px';
    muteBtn.style.font = '11px/16px sans-serif';
  }
  NS.dom.setupCanvas();
  NS.saveload.loadGame();
  NS.economy.recalcCPS();
  NS.economy.recalcClickValue();
  NS.status.updateStatus();
  S.animFrameId = requestAnimationFrame(gameLoop);
})();
