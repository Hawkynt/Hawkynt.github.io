/* The chase camera: follows the player with look-ahead toward the aim and the velocity, leans
   toward a nearby boss, eases with a critically damped lerp and samples the shake offset from
   trauma. Owns G.cam; reads the player, input and boss. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, LOOK_AHEAD, LOOK_VEL, CAM_LERP, MAX_SHAKE } = NS.constants;
  const { clamp } = NS.rng;

  let shakeT = 0;

  function snap() {
    const p = G.player;
    if (!p) return;
    G.cam.x = G.cam.tx = p.x;
    G.cam.y = G.cam.ty = p.y;
    G.cam.trauma = 0;
  }

  function update(dt) {
    const p = G.player;
    const cam = G.cam;
    if (p && p.alive) {
      const ax = clamp((p.aimX - p.x) * LOOK_AHEAD, -200, 200);
      const ay = clamp((p.aimY - p.y) * LOOK_AHEAD, -130, 130);
      let tx = p.x + ax + clamp(p.vx * LOOK_VEL, -160, 160);
      let ty = p.y + ay + clamp(p.vy * LOOK_VEL, -100, 100);
      const b = G.boss;
      if (b && b.alive && b.dying) {
        /* the death throes play out on screen */
        tx = b.x;
        ty = b.y;
      } else if (b && b.alive) {
        const dx = b.x - p.x, dy = b.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1000) {
          const k = 0.22 * (1 - d / 1000);
          tx += dx * k;
          ty += dy * k;
        }
      }
      /* keep a little of the sector edge on screen, never the void beyond it */
      const mx = VIEW_W * 0.5 - 140, my = VIEW_H * 0.5 - 100;
      cam.tx = clamp(tx, mx, G.world.w - mx);
      cam.ty = clamp(ty, my, G.world.h - my);
    }
    const k = 1 - Math.exp(-CAM_LERP * dt);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;

    shakeT += dt;
    const s = cam.trauma * cam.trauma * MAX_SHAKE;
    cam.ox = s * (Math.sin(shakeT * 47.3) * 0.6 + Math.sin(shakeT * 91.7 + 1.3) * 0.4);
    cam.oy = s * (Math.sin(shakeT * 53.1 + 2.1) * 0.6 + Math.sin(shakeT * 83.9 + 0.4) * 0.4);
  }

  /* World point to view-plane point (view centre = camera) */
  function toView(x, y, out) {
    out.x = x - G.cam.x + VIEW_W / 2 + G.cam.ox;
    out.y = y - G.cam.y + VIEW_H / 2 + G.cam.oy;
    return out;
  }

  function toWorld(vx, vy, out) {
    out.x = vx + G.cam.x - VIEW_W / 2;
    out.y = vy + G.cam.y - VIEW_H / 2;
    return out;
  }

  Object.assign(NS.camera, {
    snap, update, toView, toWorld
  });
})();
