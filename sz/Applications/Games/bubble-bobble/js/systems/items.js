/* The dropped fruit items: they fall under gravity, land on platforms and despawn
   after ten seconds. Collection is handled by the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;

  function updateItems(dt) {
    for (let i = S.items.length - 1; i >= 0; --i) {
      const item = S.items[i];
      item.vy += C.GRAVITY * dt;
      item.y += item.vy * dt;
      item.age += dt;

      // Land on platforms
      for (const p of S.platforms) {
        if (item.vy >= 0 &&
            item.x + item.w > p.x && item.x < p.x + p.w &&
            item.y + item.h >= p.y && item.y + item.h - item.vy * dt <= p.y) {
          item.y = p.y - item.h;
          item.vy = 0;
        }
      }

      // Despawn after 10s
      if (item.age > 10) S.items.splice(i, 1);
    }
  }

  Object.assign(NS.items, { updateItems });
})();
