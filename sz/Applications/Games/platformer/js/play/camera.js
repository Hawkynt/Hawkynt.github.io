/*
 * The play camera: look-ahead, vertical follow, arena lock and the boss/tall-window zoom.
 * Writes G.run.cam and G.run.zoom.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, VIEW_W, VIEW_H, ZOOM } = NS.config;
  const { visibleRect, zoomRect, zoomNow } = NS.module('view');

  function cameraBounds(vv) {
    const v = zoomRect(vv);
    const r = G.run, level = r.level;
    let minX = 0, maxX = level.cols * TS;
    if (r.boss && r.gateClosed && !r.bossDone) {
      minX = r.level.arena.gate * TS;
      maxX = (r.level.arena.c1 + 1) * TS;
    }
    const w = v.x1 - v.x0, h = v.y1 - v.y0;
    const levelH = level.rows * TS;
    const out = {};
    if (maxX - minX <= w) {
      out.x0 = out.x1 = (minX + maxX) / 2 - (v.x0 + v.x1) / 2;
    } else {
      out.x0 = minX - v.x0;
      out.x1 = maxX - v.x1;
    }
    if (levelH <= h) {
      out.y0 = out.y1 = levelH - v.y1;
    } else {
      out.y0 = -v.y0;
      out.y1 = levelH - v.y1;
    }
    return out;
  }

  function cameraTarget(v) {
    const r = G.run, p = r.player;
    const z = zoomNow();
    const tx = p.x + p.w / 2 + r.cam.look - VIEW_W / z / 2;
    let ty = p.y + p.h / 2 - VIEW_H / z * 0.56;
    if (r.boss && r.gateClosed && !r.bossDone)
      ty = 1e9;
    const b = cameraBounds(v);
    return { x: Math.max(b.x0, Math.min(b.x1, tx)), y: Math.max(b.y0, Math.min(b.y1, ty)) };
  }

  function snapCamera() {
    const v = visibleRect();
    G.run.cam.look = 0;
    const t = cameraTarget(v);
    G.run.cam.x = t.x;
    G.run.cam.y = t.y;
  }

  function updateCamera(dt) {
    const r = G.run, p = r.player;
    const v = visibleRect();
    /* look ahead in the running direction, eased */
    const want = Math.abs(p.vx) > 60 ? Math.sign(p.vx) * 120 : r.cam.look * 0.98;
    r.cam.look += (want - r.cam.look) * Math.min(1, dt * 2.2);
    const t = cameraTarget(v);
    r.cam.x += (t.x - r.cam.x) * Math.min(1, dt * 7);
    /* the camera eases out a little for boss fights so the whole arena shows */
    /* tall windows zoom in so the level still fills the height */
    const fill = (v.y1 - v.y0) / (r.level.rows * TS - 96);
    const zt = Math.max(r.boss && r.gateClosed && !r.bossDone ? 1 : ZOOM, fill);
    r.zoom += (zt - r.zoom) * Math.min(1, dt * 2.5);
    const z = r.zoom;
    const vy = p.onGround || p.y + p.h > r.cam.y + VIEW_H / z * 0.8 || p.y < r.cam.y + VIEW_H / z * 0.2 ? 5 : 1.6;
    r.cam.y += (t.y - r.cam.y) * Math.min(1, dt * vy);
    const b = cameraBounds(v);
    r.cam.x = Math.max(b.x0, Math.min(b.x1, r.cam.x));
    r.cam.y = Math.max(b.y0, Math.min(b.y1, r.cam.y));
  }

  Object.assign(NS.module('camera'), {
    snapCamera,
    updateCamera
  });
})();
