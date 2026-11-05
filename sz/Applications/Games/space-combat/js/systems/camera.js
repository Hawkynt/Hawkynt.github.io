/* The arcade camera: the 720 x 720 play field is fixed and centred in the view plane, so the
   camera only advances the forward scroll (the backdrop and everything riding on it move down)
   and samples the shake offset from trauma. World-to-view mapping and back.
   Owns G.cam and G.scroll. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, PF_W, PF_H, MAX_SHAKE, SCROLL_SPEED } = NS.constants;

  let shakeT = 0;

  function snap() {
    G.cam.x = G.cam.tx = PF_W / 2;
    G.cam.y = G.cam.ty = PF_H / 2;
    G.cam.trauma = 0;
    G.cam.ox = G.cam.oy = 0;
    G.scroll.y = 0;
    G.scroll.speed = SCROLL_SPEED;
  }

  /* `dt` is real time: shake keeps moving through hit-stop; `sim` is the scaled sim step */
  function update(dt, sim) {
    const cam = G.cam;
    cam.x = cam.tx = PF_W / 2;
    cam.y = cam.ty = PF_H / 2;
    G.scroll.y += G.scroll.speed * (sim === undefined ? dt : sim);
    shakeT += dt;
    const s = cam.trauma * cam.trauma * MAX_SHAKE;
    cam.ox = s * (Math.sin(shakeT * 47.3) * 0.6 + Math.sin(shakeT * 91.7 + 1.3) * 0.4);
    cam.oy = s * (Math.sin(shakeT * 53.1 + 2.1) * 0.6 + Math.sin(shakeT * 83.9 + 0.4) * 0.4);
  }

  /* World point to view-plane point (the field centre sits at the plane centre) */
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

  /* Whether a world point lies inside the play field, with an optional margin */
  function inField(x, y, m) {
    m = m || 0;
    return x > -m && x < PF_W + m && y > -m && y < PF_H + m;
  }

  Object.assign(NS.camera, {
    snap, update, toView, toWorld, inField
  });
})();
