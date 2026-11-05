/* The UI drawing kit in plane coordinates: fonts, shadowed, fitted and wrapped text, neon arcade
   panels with a glossy top and glowing border faked with wide strokes, segmented bars, stars,
   locks, icons, shard and token amounts, number grouping and the cached chrome logo. Draws
   only; owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const { FONT, UI, TAU } = NS.constants;
  const K = NS.artKit;
  const IA = NS.itemArt;
  const { ctx } = NS.view;

  function font(px, weight) {
    return (weight || 'normal') + ' ' + Math.round(px) + 'px ' + FONT;
  }

  function text(str, x, y, px, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(str, x + 1, y + 1.5);
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

  /* word-wrapped paragraph; returns the height used */
  function wrap(str, x, y, maxW, px, lineH, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
    const words = String(str).split(' ');
    let line = '', yy = y, lines = 0;
    const max = opts.maxChars !== undefined ? opts.maxChars : Infinity;
    let used = 0;
    for (let i = 0; i < words.length; ++i) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
        line = words[i];
        yy += lineH;
        ++lines;
      } else
        line = test;
      used += words[i].length + 1;
      if (used > max) {
        line = line.slice(0, Math.max(0, line.length - (used - max)));
        break;
      }
    }
    if (line) {
      text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
      ++lines;
    }
    return lines * lineH;
  }

  function roundRect(x, y, w, h, r) {
    K.roundRect(ctx, x, y, w, h, r);
  }

  /* paints a panel at (x, y) on context g */
  function paintPanel(g, x, y, w, h, r, accent, glow, top, bottom) {
    if (glow) {
      g.strokeStyle = K.rgba(accent, 0.16);
      g.lineWidth = 12;
      K.roundRect(g, x - 2, y - 2, w + 4, h + 4, r + 2);
      g.stroke();
    }
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, top || UI.panelTop);
    gr.addColorStop(1, bottom || UI.panelBottom);
    g.fillStyle = gr;
    K.roundRect(g, x, y, w, h, r);
    g.fill();
    const sh = g.createLinearGradient(x, y, x, y + Math.min(36, h * 0.4));
    sh.addColorStop(0, 'rgba(255,255,255,0.09)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    K.roundRect(g, x + 2, y + 2, w - 4, Math.min(36, h * 0.4), Math.max(1, r - 2));
    g.fill();
    g.strokeStyle = K.rgba(accent, glow ? 0.95 : 0.5);
    g.lineWidth = glow ? 2.4 : 1.4;
    K.roundRect(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
    g.stroke();
  }

  /* opts: accent, glow, radius, top, bottom, alpha. Small panels are painted once and blitted. */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 14;
    const accent = opts.accent || UI.accent2;
    const a0 = ctx.globalAlpha;
    if (opts.alpha !== undefined) ctx.globalAlpha = a0 * opts.alpha;
    const rw = Math.round(w), rh = Math.round(h);
    if (rw * rh <= 200000) {
      const key = 'panel:' + rw + 'x' + rh + ':' + r + ':' + accent + ':' + (opts.glow ? 1 : 0) + ':' + (opts.top || '') + ':' + (opts.bottom || '');
      const s = K.sprite(key, rw + 16, rh + 16, (g) => paintPanel(g, 8, 8, rw, rh, r, accent, opts.glow, opts.top, opts.bottom));
      ctx.drawImage(s.canvas, x - 8, y - 8, rw + 16, rh + 16);
    } else
      paintPanel(ctx, x, y, w, h, r, accent, opts.glow, opts.top, opts.bottom);
    ctx.globalAlpha = a0;
  }

  function bar(x, y, w, h, frac, color, opts) {
    opts = opts || {};
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(x - 1, y - 1, w + 2, h + 2, Math.min(5, h / 2 + 1));
    ctx.fill();
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      const gr = ctx.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, K.shade(color, 0.45));
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, K.shade(color, -0.4));
      ctx.fillStyle = gr;
      roundRect(x, y, Math.max(h, w * f), h, Math.min(4, h / 2));
      ctx.fill();
    }
    if (opts.cells > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 1; i < opts.cells; ++i) ctx.fillRect(x + w * i / opts.cells - 0.5, y, 1, h);
    }
  }

  function star(cx, cy, r, earned) {
    K.starPath(ctx, cx, cy, r, 0.45, 5);
    if (earned) {
      const gr = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      gr.addColorStop(0, '#fff4b0');
      gr.addColorStop(0.5, UI.gold);
      gr.addColorStop(1, UI.goldDeep);
      ctx.fillStyle = gr;
    } else
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = earned ? '#7a5a00' : UI.textMute;
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
  }

  function lock(cx, cy, s) {
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = s * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.12, s * 0.28, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    roundRect(cx - s * 0.4, cy - s * 0.12, s * 0.8, s * 0.58, s * 0.1);
    ctx.fill();
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(cx - s * 0.05, cy + s * 0.05, s * 0.1, s * 0.2);
  }

  function icon(kind, x, y, size, color) {
    IA.drawIcon(ctx, kind, x, y, size, color);
  }

  /* 12345 -> "12,345" */
  function group(n) {
    const s = String(Math.floor(Math.abs(n)));
    let out = '';
    for (let i = 0; i < s.length; ++i) {
      if (i && (s.length - i) % 3 === 0) out += ',';
      out += s[i];
    }
    return (n < 0 ? '-' : '') + out;
  }

  /* shards with their crystal glyph; returns the width */
  function shards(n, x, y, px, align) {
    ctx.font = font(px, 'bold');
    const s = group(n);
    const w = ctx.measureText(s).width + px * 1.25;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    icon('shard', x0 + px * 0.45, y, px * 0.95, UI.shard);
    text(s, x0 + px * 1.15, y, px, UI.shard, { weight: 'bold' });
    return w;
  }

  function time(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + s + 's';
  }

  /* The logo: chunky yellow arcade letters with a deep rim, painted once */
  function logo() {
    return K.sprite('logo', 720, 150, (g, w, h) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 104px ' + FONT;
      g.lineJoin = 'round';
      g.strokeStyle = '#1a0a40';
      g.lineWidth = 22;
      g.strokeText('PAC-MAN', w / 2, h / 2 + 6);
      g.strokeStyle = '#3a6bff';
      g.lineWidth = 8;
      g.strokeText('PAC-MAN', w / 2, h / 2 + 4);
      const gr = g.createLinearGradient(0, h / 2 - 44, 0, h / 2 + 44);
      gr.addColorStop(0, '#fff8c0');
      gr.addColorStop(0.45, '#ffd23a');
      gr.addColorStop(0.55, '#ff9a1a');
      gr.addColorStop(1, '#ffcf4a');
      g.fillStyle = gr;
      g.fillText('PAC-MAN', w / 2, h / 2 + 4);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(w / 2 - 300, h / 2 - 30, 600, 3);
    });
  }

  function chip(label, x, y, color, px) {
    const size = px || 12;
    ctx.font = font(size, 'bold');
    const w = ctx.measureText(label).width + size * 1.4;
    ctx.fillStyle = K.rgba(color, 0.2);
    roundRect(x, y - size * 0.8, w, size * 1.6, size * 0.8);
    ctx.fill();
    ctx.strokeStyle = K.rgba(color, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
    text(label, x + w / 2, y, size, color, { align: 'center', weight: 'bold', shadow: false });
    return w;
  }

  Object.assign(NS.kit, {
    font, text, fitText, wrap, roundRect, panel, bar, star, lock, icon, group, shards, time, logo, chip, TAU
  });
})();
