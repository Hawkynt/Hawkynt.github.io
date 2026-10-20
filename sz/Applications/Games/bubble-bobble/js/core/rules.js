/* The pure collision rules: the axis-aligned bounding-box test and the one-way
   platform landing that uses the previous-frame bottom position. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const S = NS.state;

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function landOnPlatform(entity, dt) {
    entity.grounded = false;
    for (const p of S.platforms) {
      const prevBottom = entity.y + entity.h - entity.vy * dt;
      if (entity.vy >= 0 &&
          entity.x + entity.w > p.x && entity.x < p.x + p.w &&
          prevBottom <= p.y && entity.y + entity.h >= p.y) {
        entity.y = p.y - entity.h;
        entity.vy = 0;
        entity.grounded = true;
        entity.isJumping = false;
        return true;
      }
    }
    return false;
  }

  Object.assign(NS.rules, { aabb, landOnPlatform });
})();
