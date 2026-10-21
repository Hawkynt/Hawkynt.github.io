/* Collision and pickup: obstacle hits with their jump/slide/shield rules, coin
   collection with the magnet range and streak pitch, and power-up pickup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const sfx = V.sfx;

  /* ── Collision Detection ── */
  function checkCollisions() {
    const px = NS.rules.getPlayerX();
    const py = NS.rules.getPlayerY();
    const ph = NS.rules.getPlayerHeight();

    for (const obs of S.obstacles) {
      const obsH = obs.type === 'barrier-low' ? 25 : obs.type === 'barrier-high' ? 40 : 50;

      // Skip far obstacles
      if (obs.y + obsH < py - ph - 20 || obs.y > py + 20)
        continue;

      const ox = NS.rules.laneX(obs.lane);
      const laneOverlap = Math.abs(px - ox) < C.LANE_WIDTH * 0.4;
      if (!laneOverlap)
        continue;

      if ((obs.type === 'barrier-low' || obs.type === 'barrier-high') && S.isJumping)
        continue;
      if (obs.type === 'barrier-high' && S.isSliding)
        continue;

      // Vertical overlap
      if (obs.y < py && obs.y + obsH > py - ph) {
        if (S.shieldTimer > 0) {
          S.shieldTimer = 0;
          sfx.play('bounce');
          sfx.play('smallExplode', { volume: 0.6 });
          V.particles.burst(px, py, 12, { color: '#00bfff', speed: 4, life: 0.6, size: 3, decay: 0.02 });
          V.screenShake.trigger(3, 150);
          obs.y = C.CANVAS_H + 200;
          continue;
        }
        return true;
      }
    }
    return false;
  }

  function checkCoinCollect() {
    const px = NS.rules.getPlayerX();
    const py = NS.rules.getPlayerY();

    for (const coin of S.coins) {
      if (coin.collected || coin.y < py - C.PLAYER_H - 30 || coin.y > py + 30)
        continue;

      const cx = NS.rules.laneX(coin.lane);
      let effectiveRange = C.LANE_WIDTH * 0.5;

      if (S.magnetTimer > 0)
        effectiveRange = C.MAGNET_RANGE;

      if (Math.abs(px - cx) < effectiveRange && coin.y > py - C.PLAYER_H - 10 && coin.y < py + 10) {
        coin.collected = true;
        ++S.coinCount;
        ++S.totalCoins;
        const mult = S.multiplierTimer > 0 ? 2 : 1;
        const points = C.COIN_VALUE * mult;
        S.score += points;
        const now = performance.now();
        S.coinStreak = now - S.lastCoinTime < 1000 ? S.coinStreak + 1 : 0;
        S.lastCoinTime = now;
        sfx.play('coin', { pitch: 1 + Math.min(S.coinStreak, 8) * 0.06, volume: 0.7 });
        V.particles.sparkle(cx, coin.y, 8, { color: '#ffd700' });
        V.floatingText.add(cx, coin.y - 10, '+' + points, { color: '#ffd700', decay: 0.03 });
      }
    }
  }

  function checkPowerUpCollect() {
    const px = NS.rules.getPlayerX();
    const py = NS.rules.getPlayerY();

    for (const pu of S.powerUps) {
      if (pu.collected || pu.y < py - C.PLAYER_H - 30 || pu.y > py + 30)
        continue;

      const pux = NS.rules.laneX(pu.lane);
      if (Math.abs(px - pux) < C.LANE_WIDTH * 0.5 && pu.y > py - C.PLAYER_H - 10 && pu.y < py + 10) {
        pu.collected = true;
        if (pu.type === 'magnet') {
          S.magnetTimer = C.MAGNET_DURATION;
          V.floatingText.add(pux, pu.y - 10, 'MAGNET', { color: '#ff00ff', decay: 0.02 });
        } else if (pu.type === 'shield') {
          S.shieldTimer = C.SHIELD_DURATION;
          V.floatingText.add(pux, pu.y - 10, 'SHIELD', { color: '#00bfff', decay: 0.02 });
        } else if (pu.type === 'multiplier') {
          S.multiplierTimer = C.MULTIPLIER_DURATION;
          V.floatingText.add(pux, pu.y - 10, '2x SCORE', { color: '#ff4500', decay: 0.02 });
        }
        V.particles.burst(pux, pu.y, 10, { color: '#fff', speed: 3, life: 0.5, size: 3, decay: 0.02 });
        sfx.play('powerup');
      }
    }
  }

  NS.collision.checkCollisions = checkCollisions;
  NS.collision.checkCoinCollect = checkCoinCollect;
  NS.collision.checkPowerUpCollect = checkPowerUpCollect;
})();
