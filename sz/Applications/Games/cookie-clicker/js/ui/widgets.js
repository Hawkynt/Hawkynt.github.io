/* Immediate-mode widgets: hit areas registered while drawing (clicks always match what is on
   screen at any window size), the keyboard cursor with hover selection, buttons, and
   activation with sounds. Owns G.hitAreas and G.menuCursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  let lastHot = -1;

  function register(id, x, y, w, h, action, opts) {
    const index = G.hitAreas.length;
    G.hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!(opts && opts.disabled), alt: opts && opts.alt, nav: !(opts && opts.nonav), scroll: opts && opts.scroll });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const inp = G.input;
    const hovered = !inp.touch && inp.moved > 0 && inp.mx >= x && inp.mx <= x + w && inp.my >= y && inp.my <= y + h;
    if (hovered && G.menuCursor !== index) {
      G.menuCursor = index;
      if (lastHot !== index) sfx('click', { volume: 0.12, gap: 30 });
    }
    const hot = hovered || (G.menuCursor === index && inp.moved <= 0);
    if (hot) lastHot = index;
    return hot;
  }

  /* opts: action, disabled, accent, sub, px, icon, selected, alt */
  function button(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = register(id, x, y, w, h, opts.action, opts);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled) ctx.globalAlpha *= 0.5;
    if (hot && !opts.disabled) {
      const k = 1.03 + Math.sin(G.time * 6) * 0.006;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(k, k);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    const sel = !!opts.selected;
    kit.panel(x, y, w, h, {
      radius: Math.min(12, h / 3), accent: hot || sel ? UI.gold : (opts.accent || UI.accent), glow: hot || sel,
      top: sel ? 'rgba(130,80,30,0.97)' : hot ? 'rgba(96,60,36,0.97)' : undefined,
      bottom: sel ? 'rgba(70,40,14,0.97)' : hot ? 'rgba(48,28,16,0.97)' : undefined,
    });
    let tx = x + w / 2;
    if (opts.icon) {
      kit.icon(opts.icon, x + h / 2 + 4, y + h / 2, Math.min(24, h * 0.55), hot ? UI.gold : (opts.accent || UI.accent));
      tx = x + h + (w - h) / 2;
    }
    kit.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? h + 14 : 20), opts.px || 18,
      { weight: 'bold', color: hot ? '#ffffff' : UI.text, align: 'center' });
    if (opts.sub)
      kit.fitText(opts.sub, tx, y + h / 2 + 12, w - (opts.icon ? h + 14 : 20), 12, { color: UI.textDim, align: 'center' });
    ctx.restore();
    return hot;
  }

  function area(id, x, y, w, h, action, opts) {
    const index = register(id, x, y, w, h, action, opts);
    return isHot(index, x, y, w, h);
  }

  function moveCursorDir(dx, dy) {
    const list = G.hitAreas;
    const cur = list[G.menuCursor];
    G.input.moved = 0;
    if (!cur) {
      for (let i = 0; i < list.length; ++i) if (list[i].nav) { G.menuCursor = i; break; }
      return;
    }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < list.length; ++i) {
      if (i === G.menuCursor || !list[i].nav) continue;
      const a = list[i];
      const ox = a.x + a.w / 2 - cx, oy = a.y + a.h / 2 - cy;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const score = along + Math.abs(ox * dy - oy * dx) * 2.2;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) {
      G.menuCursor = best;
      sfx('click', { volume: 0.25 });
    }
  }

  function activate(item, alt) {
    if (!item) return false;
    const fn = alt ? item.alt : item.action;
    if (item.disabled || !fn) {
      if (!alt) sfx('error', { volume: 0.4 });
      return false;
    }
    if (!alt) sfx('select', { volume: 0.5 });
    fn();
    return true;
  }

  function hitAt(x, y) {
    for (let i = G.hitAreas.length - 1; i >= 0; --i) {
      const a = G.hitAreas[i];
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return i;
    }
    return -1;
  }

  function beginFrame() {
    G.hitAreas.length = 0;
  }

  Object.assign(NS.widgets, { register, isHot, button, area, moveCursorDir, activate, hitAt, beginFrame });
})();
