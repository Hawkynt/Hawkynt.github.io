/* Automatic card motion for every variant: a card object that is drawn somewhere
   new glides there instead of jumping, a card that appears where a card back lay
   flips over, fresh cards land with a small slap, and a new deal flies in from
   the deck. Purely visual: variants keep hit-testing their real positions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;

  const M = CE.motion = {
    enabled: true,
    time: 0,
    frame: 0,
    pointerDown: false,
    dealArmed: false,
    dealOrigin: { x: 410, y: -140 },
    onLand: null
  };

  const recs = new WeakMap();
  let backs = [];
  let prevBacks = [];
  let dealIndex = 0;
  let dealFrame = -1;

  M.beginFrame = function(dt) {
    M.time += dt;
    ++M.frame;
    prevBacks = backs;
    backs = [];
    if (M.dealArmed) {
      M.dealArmed = false;
      dealFrame = M.frame;
      dealIndex = 0;
    }
  };

  /* a variant that animates its own deal cancels the fly-in */
  M.epoch = 0;
  M.cancelDeal = function() {
    M.dealArmed = false;
    dealFrame = -1;
    ++M.epoch;
  };

  /* a new table: the next frame's cards fly in from the deck */
  M.armDeal = function() {
    M.dealArmed = true;
  };

  M.noteBack = function(x, y, w, h) {
    if (backs.length < 1600) backs.push(x, y, w, h);
  };

  function backWasAt(x, y, w) {
    for (let i = 0; i < prevBacks.length; i += 4)
      if (Math.abs(prevBacks[i] - x) < 4 && Math.abs(prevBacks[i + 1] - y) < 4 && Math.abs(prevBacks[i + 2] - w) < 6)
        return true;
    return false;
  }

  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeInOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  const OUT = { x: 0, y: 0, scale: 1, tilt: 0, lift: 0, alpha: 1, flipX: 1, showBack: false, flying: false };

  /* returns where and how the card is shown this frame (a shared object) */
  M.place = function(card, x, y, w, h) {
    OUT.x = x; OUT.y = y; OUT.scale = 1; OUT.tilt = 0; OUT.lift = 0; OUT.alpha = 1;
    OUT.flipX = 1; OUT.showBack = false; OUT.flying = false;
    if (!M.enabled || !card || typeof card !== 'object') return OUT;

    let r = recs.get(card);
    const t = M.time;
    if (!r) {
      r = { tx: x, ty: y, dx: x, dy: y, seen: M.frame, anim: null, flipT: -1, popT: -1 };
      recs.set(card, r);
      if (M.frame === dealFrame) {
        const delay = Math.min(dealIndex++ * 0.025, 1.1);
        r.anim = { fx: M.dealOrigin.x, fy: M.dealOrigin.y, t0: t + delay, dur: 0.42, deal: true, epoch: M.epoch };
      } else if (backWasAt(x, y, w))
        r.flipT = t;
      else if (M.frame > 2)
        r.popT = t;
    } else {
      if (r.seen === M.frame) return OUT; /* drawn twice in one frame: no motion for the copy */
      const gap = M.frame - r.seen;
      if (M.frame === dealFrame && !r.anim) {
        const delay = Math.min(dealIndex++ * 0.025, 1.1);
        r.anim = { fx: M.dealOrigin.x, fy: M.dealOrigin.y, t0: t + delay, dur: 0.42, deal: true, epoch: M.epoch };
      } else if (gap > 1 && backWasAt(x, y, w))
        r.flipT = t;
      if (x !== r.tx || y !== r.ty) {
        const dist = Math.hypot(x - r.dx, y - r.dy);
        if (gap <= 30 && dist > 22 && !M.pointerDown) {
          r.anim = { fx: r.dx, fy: r.dy, t0: t, dur: Math.max(0.18, Math.min(0.45, 0.14 + dist / 1900)), deal: false, dist };
        } else if (!r.anim || r.anim.deal === false)
          r.anim = null;
        r.tx = x; r.ty = y;
      }
    }
    r.seen = M.frame;

    if (r.anim && r.anim.deal && r.anim.epoch !== M.epoch) r.anim = null;
    if (r.anim) {
      const a = r.anim;
      let p = (t - a.t0) / a.dur;
      if (p < 0 && a.deal) {
        OUT.alpha = 0;
        OUT.flying = true;
        r.dx = a.fx; r.dy = a.fy;
        return OUT;
      }
      p = Math.max(0, p);
      if (p >= 1) {
        r.anim = null;
        if (M.onLand && (a.deal || a.dist > 90)) M.onLand(x, y, w, h, a.deal);
      } else {
        const e = a.deal ? easeOut(p) : easeInOut(p);
        r.dx = a.fx + (x - a.fx) * e;
        r.dy = a.fy + (y - a.fy) * e;
        OUT.x = r.dx; OUT.y = r.dy;
        const arc = Math.sin(p * Math.PI);
        OUT.lift = arc;
        OUT.scale = 1 + 0.07 * arc;
        OUT.tilt = Math.max(-0.22, Math.min(0.22, (x - a.fx) / 2600)) * arc * (a.deal ? 3 : 1);
        if (a.deal) OUT.tilt += (1 - p) * 0.6;
        OUT.flying = true;
        return OUT;
      }
    }
    r.dx = x; r.dy = y;

    if (r.flipT >= 0) {
      const p = (t - r.flipT) / 0.26;
      if (p >= 1) r.flipT = -1;
      else {
        OUT.flipX = Math.max(0.02, Math.abs(Math.cos(p * Math.PI)));
        OUT.showBack = p < 0.5;
        OUT.scale = 1 + 0.08 * Math.sin(p * Math.PI);
        OUT.lift = 0.5 * Math.sin(p * Math.PI);
      }
    } else if (r.popT >= 0) {
      const p = (t - r.popT) / 0.18;
      if (p >= 1) r.popT = -1;
      else {
        OUT.scale = 1 + 0.12 * (1 - easeOut(p));
        OUT.alpha = Math.min(1, 0.2 + p * 1.6);
        OUT.lift = 1 - p;
      }
    }
    return OUT;
  };
})();
