/* Touch play: a tap or a swipe away from the floor jumps, a swipe toward it slides (or
   fast-falls), a swipe along the run dashes and one against it slides - on screen, so swipes
   turn with the view; a pause button sits in the corner; the gesture hints fade in for the
   first seconds of a touch run. Owns the active touches. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const { ctx } = NS.view;

  const SWIPE = 34;
  const VEC = {};
  const touches = {};

  function pauseRect() {
    const v = NS.view.visible();
    return { x: v.x1 - 76, y: v.y0 + 116, w: 60, h: 60 };
  }

  function push(a) {
    G.input.queue.push(a);
  }

  function down(id, x, y) {
    const r = pauseRect();
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      NS.screens.pause();
      return;
    }
    if (G.run && G.run.phase === 'revive') {
      const i = NS.widgets.hitAt(x, y);
      if (i >= 0) NS.widgets.activate(G.hitAreas[i]);
      return;
    }
    touches[id] = { x: x, y: y, t: G.time, done: false };
  }

  function move(id, x, y) {
    const t = touches[id];
    if (!t || t.done) return;
    const dx = x - t.x, dy = y - t.y;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
    t.done = true;
    const o = G.cam.o;
    const m = NS.orient.swipeMove(dx, dy, o ? o.q : 0, o ? o.mi : 1);
    push(m);
    if (m === 'slide') G.input.downHeld = false;
  }

  function up(id) {
    const t = touches[id];
    if (!t) return;
    if (!t.done) push('jump');
    delete touches[id];
  }

  function draw() {
    if (!G.input.touch || G.screen !== 'playing' || !G.run || G.run.demo) return;
    const r = pauseRect();
    ctx.globalAlpha = 0.75;
    kit.panel(r.x, r.y, r.w, r.h, { radius: 30, brackets: false });
    kit.icon('pause', r.x + r.w / 2, r.y + r.h / 2, 26, '#ffffff');
    ctx.globalAlpha = 1;
    if (G.run.t < 4) {
      const v = NS.view.visible();
      const o = G.cam.o;
      const f = NS.orient.vectors(o ? o.q : 0, o ? o.mi : 1, VEC);
      const g = NS.orient.arrowGlyph;
      ctx.globalAlpha = Math.min(1, 4 - G.run.t);
      kit.text('Tap or swipe ' + g(f.ux, f.uy) + ': jump   -   Swipe ' + g(-f.ux, -f.uy) + ': slide   -   Swipe ' + g(f.fx, f.fy) + ': dash', (v.x0 + v.x1) / 2, v.y1 - 120, 18, UI.text, { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
  }

  Object.assign(NS.touch, {
    down, move, up, draw
  });
})();
