;(function() {
  'use strict';

  /* Spider: card move, flip and deal animations and the win celebration. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const { CE, CARD_W, CARD_H, TABLEAU_COUNT, tableauPos, foundationPos } = V;

  /* ================================================================
   *  CARD FLIP ANIMATION
   * ================================================================ */

  function startDealCardAnim(card, fromX, fromY, toX, toY, delay) {
    S.dealAnimCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now() + delay,
      duration: 300
    });
    if (!S.winAnimRunning && S.dealAnimCards.length === 1 && S.flippingCards.length === 0)
      requestAnimationFrame(tickFlipAnimations);
  }

  function startFlipAnim(card, x, y) {
    S.flippingCards.push({
      card, x, y,
      startTime: performance.now(),
      duration: 200
    });
    if (!S.winAnimRunning && S.flippingCards.length === 1 && S.dealAnimCards.length === 0)
      requestAnimationFrame(tickFlipAnimations);
  }

  function tickFlipAnimations() {
    if (S.flippingCards.length === 0 && S.dealAnimCards.length === 0)
      return;
    const now = performance.now();
    const cx = S._ctx;
    V.drawScene(cx);

    for (let i = S.dealAnimCards.length - 1; i >= 0; --i) {
      const d = S.dealAnimCards[i];
      if (now < d.startTime) {
        CE.drawCardBack(cx, d.fromX, d.fromY);
        continue;
      }
      const elapsed = now - d.startTime;
      const t = Math.min(elapsed / d.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = d.fromX + (d.toX - d.fromX) * e;
      const y = d.fromY + (d.toY - d.fromY) * e;

      let scaleX;
      if (t < 0.4)
        scaleX = 1;
      else if (t < 0.6)
        scaleX = 1 - (t - 0.4) / 0.2;
      else
        scaleX = (t - 0.6) / 0.4;

      cx.save();
      cx.translate(x + CARD_W / 2, y);
      cx.scale(Math.max(scaleX, 0.01), 1);
      if (t < 0.5)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, d.card);
      cx.restore();

      if (t >= 1)
        S.dealAnimCards.splice(i, 1);
    }

    for (let i = S.flippingCards.length - 1; i >= 0; --i) {
      const f = S.flippingCards[i];
      const elapsed = now - f.startTime;
      const t = Math.min(elapsed / f.duration, 1);
      let scaleX;
      if (t < 0.5)
        scaleX = 1 - t * 2;
      else
        scaleX = (t - 0.5) * 2;
      cx.save();
      cx.translate(f.x + CARD_W / 2, f.y);
      cx.scale(scaleX, 1);
      if (t < 0.5)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, f.card);
      cx.restore();
      if (t >= 1)
        S.flippingCards.splice(i, 1);
    }

    if (S.flippingCards.length > 0 || S.dealAnimCards.length > 0)
      requestAnimationFrame(tickFlipAnimations);
  }

  /* ================================================================
   *  COMPLETION ANIMATION
   * ================================================================ */

  function startCompletionAnim(cards, startPositions, targetX, targetY, onDone) {
    S.completionAnim = {
      cards,
      startPositions,
      targetX,
      targetY,
      progress: 0,
      onDone
    };
    animateCompletion();
  }

  function animateCompletion() {
    if (!S.completionAnim)
      return;

    S.completionAnim.progress += 0.05;
    if (S.completionAnim.progress >= 1) {
      stopCompletionAnim();
      return;
    }

    const cx = S._ctx;
    V.drawScene(cx);

    const t = S.completionAnim.progress;
    const ease = t * t * (3 - 2 * t);
    for (let i = 0; i < S.completionAnim.cards.length; ++i) {
      const sp = S.completionAnim.startPositions[i];
      const x = sp.x + (S.completionAnim.targetX - sp.x) * ease;
      const y = sp.y + (S.completionAnim.targetY - sp.y) * ease;
      CE.drawCardFace(cx, x, y, S.completionAnim.cards[i]);
    }

    requestAnimationFrame(animateCompletion);
  }

  function stopCompletionAnim() {
    if (S.completionAnim) {
      const cb = S.completionAnim.onDone;
      S.completionAnim = null;
      if (cb)
        cb();
    }
  }

  function startWinAnimation() {
    S.winAnimCards = [];
    S.particles = [];
    S.winAnimRunning = true;
    S.lastFireworkTime = 0;

    const allCards = [];
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      for (const card of S.tableau[col]) {
        card.faceUp = true;
        allCards.push({ card, startX: tp.x, startY: tp.y });
      }
    }
    for (let i = 0; i < S.completedSuits; ++i) {
      const fp = foundationPos(i);
      for (const rank of CE.RANKS) {
        const card = CE.makeCard('spades', rank);
        card.faceUp = true;
        allCards.push({ card, startX: fp.x, startY: fp.y });
      }
    }

    let launchIndex = 0;
    S.winLaunchInterval = setInterval(() => {
      if (launchIndex >= allCards.length || !S.winAnimRunning) {
        clearInterval(S.winLaunchInterval);
        S.winLaunchInterval = null;
        return;
      }
      const c = allCards[launchIndex];
      S.winAnimCards.push({
        card: c.card,
        x: c.startX,
        y: c.startY,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 6 + 2),
        gravity: 0.2,
        bounces: 0,
        angle: 0,
        angularVelocity: (Math.random() - 0.5) * 0.08,
        trail: []
      });
      ++launchIndex;
    }, 40);

    const animate = (timestamp) => {
      if (!S.winAnimRunning)
        return;

      const cx = S._ctx;
      cx.fillStyle = CE.GREEN;
      cx.fillRect(0, 0, S.canvasW, S.canvasH);

      if (timestamp - S.lastFireworkTime > 500) {
        CE.spawnFirework(S.particles, Math.random() * S.canvasW, Math.random() * S.canvasH * 0.6);
        S.lastFireworkTime = timestamp;
      }

      let anyAlive = false;

      for (const ac of S.winAnimCards) {
        ac.vy += ac.gravity;
        ac.x += ac.vx;
        ac.y += ac.vy;
        ac.angle += ac.angularVelocity;

        if (ac.y + CARD_H > S.canvasH) {
          ac.y = S.canvasH - CARD_H;
          ac.vy = -ac.vy * 0.7;
          ++ac.bounces;
        }

        if (ac.x + CARD_W < -50 || ac.x > S.canvasW + 50 || ac.bounces > 8)
          continue;

        anyAlive = true;

        ac.trail.push({ x: ac.x, y: ac.y, alpha: 0.4 });
        if (ac.trail.length > 6)
          ac.trail.shift();
        for (const t of ac.trail) {
          cx.save();
          cx.globalAlpha = t.alpha;
          cx.translate(t.x + CARD_W / 2, t.y + CARD_H / 2);
          cx.rotate(ac.angle);
          CE.drawCardFace(cx, -CARD_W / 2, -CARD_H / 2, ac.card);
          cx.restore();
          t.alpha *= 0.6;
        }

        cx.save();
        cx.translate(ac.x + CARD_W / 2, ac.y + CARD_H / 2);
        cx.rotate(ac.angle);
        CE.drawCardFace(cx, -CARD_W / 2, -CARD_H / 2, ac.card);
        cx.restore();
      }

      CE.updateAndDrawParticles(cx, S.particles);

      // Draw status overlay during win
      V.drawStatusBar(cx);

      if (anyAlive || S.particles.length > 0)
        S.winAnimId = requestAnimationFrame(animate);
      else
        S.winAnimRunning = false;
    };

    S.winAnimId = requestAnimationFrame(animate);
  }

  function stopWinAnimation() {
    S.winAnimRunning = false;
    if (S.winAnimId) {
      cancelAnimationFrame(S.winAnimId);
      S.winAnimId = null;
    }
    if (S.winLaunchInterval) {
      clearInterval(S.winLaunchInterval);
      S.winLaunchInterval = null;
    }
    S.winAnimCards = [];
    S.particles = [];
    S.flippingCards = [];
    S.dealAnimCards = [];
  }

  Object.assign(V, {
    startDealCardAnim, startFlipAnim, startCompletionAnim, stopCompletionAnim, startWinAnimation,
    stopWinAnimation
  });

})();
