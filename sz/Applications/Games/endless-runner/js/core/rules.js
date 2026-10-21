/* The geometry and tier rules: lane centers, the player's interpolated x, its jump-curve
   y and crouched height, and the current speed tier. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Lane Helpers ── */
  function laneX(lane) {
    const roadLeft = (C.CANVAS_W - C.NUM_LANES * C.LANE_WIDTH) / 2;
    return roadLeft + lane * C.LANE_WIDTH + C.LANE_WIDTH / 2;
  }

  function getPlayerX() {
    if (S.laneTransitionTimer > 0) {
      const t = 1 - S.laneTransitionTimer / C.LANE_SWITCH_DURATION;
      return S.transitionStartX + (laneX(S.targetLane) - S.transitionStartX) * t;
    }
    return laneX(S.targetLane);
  }

  function getPlayerY() {
    if (S.isJumping) {
      const halfDur = C.JUMP_DURATION / 2;
      const t = S.jumpTimer < halfDur ? S.jumpTimer / halfDur : 1 - (S.jumpTimer - halfDur) / halfDur;
      return C.LANE_Y_BOTTOM - C.JUMP_HEIGHT * Math.sin(t * Math.PI / 2);
    }
    return C.LANE_Y_BOTTOM;
  }

  function getPlayerHeight() {
    return S.isSliding ? C.PLAYER_H * 0.4 : C.PLAYER_H;
  }

  /* ── Speed Tier ── */
  function getCurrentTier() {
    let tier = C.SPEED_TIERS[0];
    for (const t of C.SPEED_TIERS)
      if (S.currentSpeed >= t.minSpeed)
        tier = t;
    return tier;
  }

  NS.rules.laneX = laneX;
  NS.rules.getPlayerX = getPlayerX;
  NS.rules.getPlayerY = getPlayerY;
  NS.rules.getPlayerHeight = getPlayerHeight;
  NS.rules.getCurrentTier = getCurrentTier;
})();
