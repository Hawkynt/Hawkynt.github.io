/* Clickable menu widgets: hit areas registered while drawing (so clicks always match what is on
   screen at any window size), the keyboard cursor with hover selection, buttons, tabs, cursor
   movement by direction and activation sounds. Owns G.hitAreas and G.menuCursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const K = NS.artKit;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  let lastHot = -1;

  function register(id, x, y, w, h, action, disabled) {
    const index = G.hitAreas.length;
    G.hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const inp = G.input;
    const hovered = !inp.touch && inp.mouseMoved > 0 && inp.mouseX >= x && inp.mouseX <= x + w && inp.mouseY >= y && inp.mouseY <= y + h;
    if (hovered && G.menuCursor !== index) {
      G.menuCursor = index;
      if (lastHot !== index) sfx('click', { volume: 0.2 });
    }
    const hot = hovered || G.menuCursor === index;
    if (hot) lastHot = index;
    return hot;
  }

  /* opts: action, disabled, accent, sub, px, icon, selected */
  function button(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = register(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled) ctx.globalAlpha *= 0.5;
    if (hot) {
      const k = 1.035 + Math.sin(G.time * 6) * 0.008;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(k, k);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    const accent = opts.accent || UI.accent2;
    const sel = !!opts.selected;
    kit.panel(x, y, w, h, {
      radius: Math.min(14, h / 2), accent: hot ? UI.accent : sel ? UI.accent2 : accent, glow: hot || sel,
      top: hot ? K.rgba(K.shade(accent, -0.55), 0.97) : sel ? 'rgba(14,70,96,0.97)' : undefined,
      bottom: hot ? 'rgba(10,8,30,0.97)' : sel ? 'rgba(6,24,40,0.97)' : undefined,
    });
    let tx = x + w / 2;
    if (opts.icon) {
      kit.icon(opts.icon, x + 30, y + h / 2, Math.min(26, h * 0.52), hot ? UI.accent : accent);
      tx = x + 30 + (w - 30) / 2;
    }
    kit.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? 70 : 24), opts.px || 19,
      { weight: 'bold', color: hot ? '#ffffff' : UI.text, align: 'center' });
    if (opts.sub)
      kit.fitText(opts.sub, tx, y + h / 2 + 12, w - (opts.icon ? 70 : 24), 12, { color: hot ? UI.text : UI.textDim, align: 'center' });
    ctx.restore();
    return hot;
  }

  function area(id, x, y, w, h, action, disabled) {
    const index = register(id, x, y, w, h, action, disabled);
    return isHot(index, x, y, w, h);
  }

  /* a row of tabs; returns the chosen id */
  function tabs(list, current, x, y, w, h, onPick) {
    const tw = w / list.length;
    for (let i = 0; i < list.length; ++i) {
      const t = list[i];
      button('tab:' + t.id, t.name, x + i * tw + 3, y, tw - 6, h, { selected: t.id === current, px: 16, icon: t.icon, action: () => onPick(t.id) });
    }
  }

  function moveCursor(d) {
    const n = G.hitAreas.length;
    if (!n) return;
    G.menuCursor = (G.menuCursor + d + n) % n;
    sfx('click', { volume: 0.3 });
  }

  function moveCursorDir(dx, dy) {
    const list = G.hitAreas;
    const cur = list[G.menuCursor];
    if (!cur) { moveCursor(1); return; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < list.length; ++i) {
      if (i === G.menuCursor) continue;
      const a = list[i];
      const ox = a.x + a.w / 2 - cx, oy = a.y + a.h / 2 - cy;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const across = Math.abs(ox * dy - oy * dx);
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) {
      G.menuCursor = best;
      sfx('click', { volume: 0.3 });
    }
  }

  function activate(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error');
      return;
    }
    sfx('select');
    item.action();
  }

  function hitAt(x, y) {
    for (let i = G.hitAreas.length - 1; i >= 0; --i) {
      const a = G.hitAreas[i];
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return i;
    }
    return -1;
  }

  Object.assign(NS.widgets, {
    register, isHot, button, area, tabs, moveCursor, moveCursorDir, activate, hitAt
  });
})();
