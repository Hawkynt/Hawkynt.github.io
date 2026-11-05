/* The UI drawing kit in plane coordinates: fonts, shadowed, fitted and wrapped text, carved
   stone-and-brass panels, buttons that register hit areas (clicked by pointer, chosen by
   keyboard cursor), progress bars, stars, gold and gem counters, and the cached title logo.
   Draws only; the hit areas live in G.hitAreas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const { ctx } = NS.view;
  const UI = C.UI;

  function font(px, weight) {
    return (weight || 'normal') + ' ' + Math.round(px) + 'px ' + C.FONT;
  }

  function text(str, x, y, px, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(str, x + 1.5, y + 2);
    }
    ctx.fillStyle = color || UI.text;
    ctx.fillText(str, x, y);
  }

  function fitText(str, x, y, maxW, px, opts) {
    opts = opts || {};
    let size = px;
    ctx.font = font(size, opts.weight);
    while (size > 9 && ctx.measureText(str).width > maxW) {
      size -= 1;
      ctx.font = font(size, opts.weight);
    }
    text(str, x, y, size, opts.color, opts);
    return size;
  }

  /* word-wrapped paragraph; returns the height used */
  function wrap(str, x, y, maxW, px, lineH, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    const words = String(str).split(' ');
    let line = '', yy = y, lines = 0;
    const limit = opts.chars === undefined ? Infinity : opts.chars;
    let used = 0;
    for (let i = 0; i < words.length && used < limit; ++i) {
      let word = words[i];
      if (used + word.length > limit) word = word.slice(0, Math.max(0, limit - used));
      used += word.length + 1;
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
        line = word;
        yy += lineH;
        ++lines;
      } else line = test;
    }
    if (line) {
      text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
      ++lines;
    }
    return lines * lineH;
  }

  /* a carved panel: dark stone fill, brass rim, rivets; opts: accent, alpha, radius, glow */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 14;
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
    if (opts.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= 0.5;
      ctx.drawImage(K.glow(accent), x - 30, y - 30, w + 60, h + 60);
      ctx.globalAlpha /= 0.5;
      ctx.globalCompositeOperation = 'source-over';
    }
    const gr = ctx.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, opts.top || UI.panelTop);
    gr.addColorStop(1, opts.bottom || UI.panelBottom);
    ctx.fillStyle = gr;
    K.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    const sh = ctx.createLinearGradient(x, y, x, y + Math.min(36, h * 0.4));
    sh.addColorStop(0, 'rgba(255,240,210,0.09)');
    sh.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sh;
    K.roundRect(ctx, x + 2, y + 2, w - 4, Math.min(36, h * 0.4), r - 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    K.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.strokeStyle = K.rgba(accent, opts.glow ? 0.95 : 0.55);
    ctx.lineWidth = opts.glow ? 2.2 : 1.4;
    K.roundRect(ctx, x + 2.5, y + 2.5, w - 5, h - 5, r - 2);
    ctx.stroke();
    if (opts.rivets !== false && w > 60 && h > 40) {
      for (const [px, py] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) {
        K.orb(ctx, px, py, 2.6, '#b08a50', '#ffe0a0', '#5a4020');
      }
    }
    ctx.restore();
  }

  function hover(x, y, w, h) {
    const p = G.input.pointer;
    return !G.input.touch && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  /* registers a hit area and draws the button; returns true when it is highlighted */
  function button(label, x, y, w, h, action, opts) {
    opts = opts || {};
    const idx = G.hitAreas.length;
    G.hitAreas.push({ x, y, w, h, action, disabled: !!opts.disabled, nav: opts.nav !== false });
    const hot = !opts.disabled && (hover(x, y, w, h) || (opts.nav !== false && G.menuCursor === idx && !G.input.touch && G.input.lastInput === 1));
    const accent = opts.accent || UI.accent;
    panel(x, y, w, h, {
      accent, glow: hot || opts.selected, radius: opts.radius || 10, rivets: false,
      top: hot ? K.rgba(K.darken(accent, 0.45), 0.96) : opts.top, bottom: hot ? K.rgba(K.darken(accent, 0.7), 0.98) : opts.bottom,
      alpha: opts.disabled ? 0.5 : 1
    });
    if (opts.icon) ctx.drawImage(opts.icon, x + 10, y + h / 2 - 14, 28, 28);
    const tx = opts.align === 'left' ? x + (opts.icon ? 46 : 16) : x + w / 2;
    fitText(label, tx, y + h / 2 + (opts.sub ? -8 : 0), w - (opts.icon ? 56 : 24), opts.size || 20,
      { align: opts.align || 'center', weight: 'bold', color: opts.disabled ? UI.faint : (hot ? '#ffffff' : (opts.color || UI.text)) });
    if (opts.sub) fitText(opts.sub, tx, y + h / 2 + 12, w - (opts.icon ? 56 : 24), 13, { align: opts.align || 'center', color: UI.dim });
    return hot;
  }

  function bar(x, y, w, h, t, color, back) {
    ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
    K.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const fw = Math.max(0, Math.min(1, t)) * w;
    if (fw > 1) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, K.lighten(color, 0.35)); g.addColorStop(1, color);
      ctx.fillStyle = g;
      K.roundRect(ctx, x, y, Math.max(h, fw), h, h / 2);
      ctx.fill();
    }
  }

  function starIcon(x, y, r, on) {
    K.star(ctx, x, y, r, r * 0.45, 5);
    ctx.fillStyle = on ? '#ffd54a' : 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = on ? '#fff3b0' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function coin(x, y, r) {
    K.orb(ctx, x, y, r, '#ffc93a', '#fff3b0', '#a0700a');
    ctx.strokeStyle = '#a0700a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, C.TAU);
    ctx.stroke();
  }

  function goldLabel(x, y, amount, px, align) {
    ctx.font = font(px || 18, 'bold');
    const s = String(amount);
    const w = ctx.measureText(s).width;
    const r = (px || 18) * 0.45;
    const sx = align === 'right' ? x - w - r * 2 - 6 : align === 'center' ? x - (w + r * 2 + 6) / 2 : x;
    coin(sx + r, y, r);
    text(s, sx + r * 2 + 6, y, px || 18, UI.gold, { weight: 'bold' });
  }

  let logo = null;
  /* "BOULDER DASH" carved in stone, with gems in the O's, painted once */
  function drawLogo(cx, cy, scale) {
    if (!logo) {
      const w = 760, h = 190;
      logo = K.canvas(w, h);
      const x = logo.getContext('2d');
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      const draw = (str, y, px) => {
        x.font = '900 ' + px + 'px ' + C.FONT;
        x.lineJoin = 'round';
        x.lineWidth = 14;
        x.strokeStyle = '#1a0f08';
        x.strokeText(str, w / 2, y + 6);
        x.lineWidth = 8;
        x.strokeStyle = '#4a2e18';
        x.strokeText(str, w / 2, y);
        const g = x.createLinearGradient(0, y - px / 2, 0, y + px / 2);
        g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#ffb347'); g.addColorStop(0.55, '#d9771f'); g.addColorStop(1, '#7a3a10');
        x.fillStyle = g;
        x.fillText(str, w / 2, y);
        x.lineWidth = 1.5;
        x.strokeStyle = 'rgba(255,255,255,0.5)';
        x.strokeText(str, w / 2, y - 1);
      };
      draw('BOULDER', 62, 92);
      draw('DASH', 148, 78);
      const tiles = NS.tileArt.tiles('amber', '');
      x.drawImage(tiles.gem[2], 140, 118, 52, 52);
      x.drawImage(tiles.gem[5], 568, 118, 52, 52);
      x.drawImage(tiles.boulder[1], 196, 126, 40, 40);
      x.drawImage(tiles.boulder[2], 524, 126, 40, 40);
    }
    const s = scale || 1;
    ctx.drawImage(logo, cx - logo.width * s / 2, cy - logo.height * s / 2, logo.width * s, logo.height * s);
  }

  Object.assign(NS.kit, { font, text, fitText, wrap, panel, button, bar, starIcon, coin, goldLabel, drawLogo, hover });
})();
