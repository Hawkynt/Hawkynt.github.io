/* The UI kit in plane coordinates: fonts, fitted and wrapped text, candy-glass panels, bars,
   star rows, gem counters and the cached title logo; plus clickable widgets whose hit areas
   are registered while drawing (so clicks always match what is on screen at any window size),
   the shared keyboard cursor with hover, spatial cursor moves and activation sounds.
   Owns G.hitAreas and G.menuCursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const { FONT, UI } = NS.constants;
  const G = NS.state;
  const K = NS.artKit;
  const I = NS.icons;
  const { ctx } = NS.view;

  let lastHot = -1;

  function sfx(name, opts) {
    if (SZ.GameAudio) SZ.GameAudio.play(name, opts);
  }

  function font(px, weight) {
    return (weight || 'normal') + ' ' + Math.round(px) + 'px ' + FONT;
  }

  function text(str, x, y, px, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.stroke) {
      ctx.lineWidth = opts.stroke;
      ctx.strokeStyle = opts.strokeColor || 'rgba(20,8,16,0.9)';
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    } else if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(str, x + 1, y + 2);
    }
    ctx.fillStyle = color || UI.text;
    ctx.fillText(str, x, y);
  }

  function fitText(str, x, y, maxW, px, opts) {
    opts = opts || {};
    let size = px;
    ctx.font = font(size, opts.weight);
    while (size > 8 && ctx.measureText(str).width > maxW) {
      size -= 1;
      ctx.font = font(size, opts.weight);
    }
    text(str, x, y, size, opts.color, opts);
    return size;
  }

  /* Word-wrapped paragraph; returns the height used */
  function wrap(str, x, y, maxW, px, lineH, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    const words = String(str).split(' ');
    let line = '', yy = y, lines = 0;
    const limit = opts.chars === undefined ? Infinity : opts.chars;
    let used = 0;
    for (let i = 0; i < words.length; ++i) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        out(line);
        line = words[i];
        yy += lineH;
        ++lines;
      } else
        line = test;
    }
    if (line) { out(line); ++lines; }
    return lines * lineH;

    function out(l) {
      if (used >= limit) return;
      const s = used + l.length > limit ? l.slice(0, limit - used) : l;
      used += l.length + 1;
      text(s, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top', shadow: opts.shadow });
    }
  }

  function measure(str, px, weight) {
    ctx.font = font(px, weight);
    return ctx.measureText(str).width;
  }

  /* opts: accent, glow, radius, top, bottom, alpha */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius === undefined ? 12 : opts.radius;
    const accent = opts.accent || UI.accent;
    if (opts.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18;
      ctx.drawImage(K.glow(accent), x - 30, y - 30, w + 60, h + 60);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    K.roundRect(ctx, x + 3, y + 5, w, h, r); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opts.top || UI.panelTop);
    g.addColorStop(1, opts.bottom || UI.panelBottom);
    ctx.fillStyle = g;
    K.roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = K.rgba(accent, opts.dim ? 0.35 : 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + r, y + 3); ctx.lineTo(x + w - r, y + 3); ctx.stroke();
  }

  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.45)';
    K.roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, K.shade(color, 0.3)); g.addColorStop(1, K.shade(color, -0.15));
      ctx.fillStyle = g;
      K.roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill();
    }
  }

  function stars(x, y, n, max, size) {
    for (let i = 0; i < max; ++i) I.draw(ctx, 'star', x + i * size * 1.1, y, size, i < n ? UI.gold : 'rgba(255,255,255,0.18)');
  }

  function gems(n, x, y, px, align) {
    const label = String(Math.floor(n));
    const w = measure(label, px, 'bold') + px * 1.3;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    I.draw(ctx, 'gem', x0 + px * 0.5, y, px * 1.1, '#4ff0ff');
    text(label, x0 + px * 1.25, y, px, '#bff8ff', { weight: 'bold' });
    return w;
  }

  function icon(name, x, y, size, color) {
    I.draw(ctx, name, x, y, size, color);
  }

  function dim(alpha) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(10,4,14,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  /* The title logo, painted once */
  function logo() {
    return K.sprite('logo', 760, 190, (x) => {
      const word = 'BOMBERMAN';
      x.font = 'bold 120px ' + FONT;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      x.lineWidth = 22; x.strokeStyle = '#1b1020'; x.strokeText(word, 380, 92);
      x.lineWidth = 12; x.strokeStyle = '#ffffff'; x.strokeText(word, 380, 92);
      const g = x.createLinearGradient(0, 40, 0, 140);
      g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, '#e8401a');
      x.fillStyle = g; x.fillText(word, 380, 92);
      x.fillStyle = 'rgba(255,255,255,0.4)';
      x.save(); x.beginPath(); x.rect(0, 40, 760, 34); x.clip(); x.fillText(word, 380, 92); x.restore();
      K.ball(x, 700, 40, 26, '#2a2d3a');
      x.strokeStyle = '#c89a5a'; x.lineWidth = 5; x.beginPath(); x.moveTo(712, 18); x.quadraticCurveTo(724, 2, 738, 8); x.stroke();
    });
  }

  /* ── clickable widgets ── */
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

  /* opts: action, disabled, accent, sub, px, icon, badge */
  function button(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = register(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled) ctx.globalAlpha *= 0.5;
    if (hot) {
      const k = 1.04 + Math.sin(G.time * 7) * 0.008;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(k, k);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    const accent = opts.accent || UI.accent;
    panel(x, y, w, h, { radius: Math.min(14, h / 2), accent: hot ? UI.gold : accent, glow: hot, top: hot ? 'rgba(96,52,58,0.97)' : undefined, bottom: hot ? 'rgba(40,20,30,0.97)' : undefined });
    let tx = x + w / 2;
    if (opts.icon) {
      icon(opts.icon, x + h * 0.55, y + h / 2, Math.min(28, h * 0.56), hot ? UI.gold : accent);
      tx = x + h * 0.55 + (w - h * 0.55) / 2;
    }
    const maxW = w - (opts.icon ? h * 1.1 : 24);
    fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, maxW, opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : UI.text, align: 'center' });
    if (opts.sub) fitText(opts.sub, tx, y + h / 2 + 13, maxW, 12, { color: UI.textDim, align: 'center' });
    if (opts.badge) {
      ctx.fillStyle = UI.bad;
      ctx.beginPath(); ctx.arc(x + w - 8, y + 8, 10, 0, Math.PI * 2); ctx.fill();
      text(String(opts.badge), x + w - 8, y + 8, 12, '#ffffff', { align: 'center', weight: 'bold', shadow: false });
    }
    ctx.restore();
    return hot;
  }

  function area(id, x, y, w, h, action, disabled) {
    const index = register(id, x, y, w, h, action, disabled);
    return isHot(index, x, y, w, h);
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

  Object.assign(NS.kit, {
    font, text, fitText, wrap, measure, panel, bar, stars, gems, icon, dim, logo,
    register, isHot, button, area, moveCursor, moveCursorDir, activate, hitAt
  });
})();
