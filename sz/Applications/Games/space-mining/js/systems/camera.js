/* The chase camera: follows the ship with look-ahead along its velocity and toward the laser
   aim, eases with a damped lerp, zooms out a little at speed and in for cinematic close-ups
   (cam.focus overrides the target), and samples the shake offset from trauma.
   Owns G.cam; reads the ship and input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, LOOK_VEL, LOOK_AIM, CAM_LERP, MAX_SHAKE } = NS.constants;
  const { clamp } = NS.rng;

  let shakeT = 0;

  function snap(x, y) {
    const cam = G.cam;
    cam.x = cam.tx = x;
    cam.y = cam.ty = y;
    cam.trauma = 0;
    cam.zoom = cam.tzoom = 1;
    cam.focus = null;
  }

  function update(dt) {
    const s = G.ship;
    const cam = G.cam;
    if (cam.focus) {
      cam.tx = cam.focus.x;
      cam.ty = cam.focus.y;
      cam.tzoom = cam.focus.zoom || 1.4;
    } else if (G.cmd.on) {
      cam.tx = G.cmd.x;
      cam.ty = G.cmd.y;
      cam.tzoom = G.cmd.zoom;
    } else if (s) {
      const inp = G.input;
      const ax = clamp((inp.aimWX - s.x) * LOOK_AIM, -150, 150);
      const ay = clamp((inp.aimWY - s.y) * LOOK_AIM, -100, 100);
      cam.tx = s.x + clamp(s.vx * LOOK_VEL, -190, 190) + (inp.firing ? ax : 0);
      cam.ty = s.y + clamp(s.vy * LOOK_VEL, -120, 120) + (inp.firing ? ay : 0);
      const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      cam.tzoom = 1 - Math.min(0.12, sp / 5000);
    }
    const k = 1 - Math.exp(-(G.cmd.on && !cam.focus ? 14 : CAM_LERP) * dt);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    cam.zoom += (cam.tzoom - cam.zoom) * (1 - Math.exp(-(G.cmd.on ? 8 : 3) * dt));

    shakeT += dt;
    const sh = cam.trauma * cam.trauma * MAX_SHAKE;
    cam.ox = sh * (Math.sin(shakeT * 47.3) * 0.6 + Math.sin(shakeT * 91.7 + 1.3) * 0.4);
    cam.oy = sh * (Math.sin(shakeT * 53.1 + 2.1) * 0.6 + Math.sin(shakeT * 83.9 + 0.4) * 0.4);
  }

  /* World point to view-plane point (view centre = camera, scaled by zoom) */
  function toView(x, y, out) {
    const z = G.cam.zoom;
    out.x = (x - G.cam.x) * z + VIEW_W / 2 + G.cam.ox;
    out.y = (y - G.cam.y) * z + VIEW_H / 2 + G.cam.oy;
    return out;
  }

  function toWorld(vx, vy, out) {
    const z = G.cam.zoom;
    out.x = (vx - VIEW_W / 2) / z + G.cam.x;
    out.y = (vy - VIEW_H / 2) / z + G.cam.y;
    return out;
  }

  /* The world rectangle the canvas shows (for culling), padded by m */
  function worldRect(out, m) {
    const v = NS.view.visible();
    const z = G.cam.zoom;
    out.x0 = (v.x0 - VIEW_W / 2) / z + G.cam.x - (m || 0);
    out.y0 = (v.y0 - VIEW_H / 2) / z + G.cam.y - (m || 0);
    out.x1 = (v.x1 - VIEW_W / 2) / z + G.cam.x + (m || 0);
    out.y1 = (v.y1 - VIEW_H / 2) / z + G.cam.y + (m || 0);
    return out;
  }

  Object.assign(NS.camera, {
    snap, update, toView, toWorld, worldRect
  });
})();
