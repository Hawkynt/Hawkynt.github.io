/* The UI drawing kit in plane coordinates: fonts, fitted and wrapped text, rounded and bevelled
   sci-fi panels with corner brackets and glow faked with wide strokes, segmented bars, stars,
   locks, icons, and the cached chrome logo. Draws only; owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const { FONT, UI } = NS.constants;
  const K = NS.artKit;
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
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(str, x + 1, y + 1.5);
    }
    ctx.fillStyle = color || UI.text;
    ctx.fillText(str, x, y);
  }

  /* Shrinks the font until the string fits maxW */
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
    for (let i = 0; i < words.length; ++i) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
        line = words[i];
        yy += lineH;
        ++lines;
      } else
        line = test;
    }
    if (line) {
      text(line, x, yy, px, color, { align: opts.align, weight: opts.weight, baseline: 'top' });
      ++lines;
    }
    return lines * lineH;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /* A bevelled glass panel; opts: accent, glow, radius, top, bottom, alpha, brackets */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
    if (opts.glow) {
      ctx.strokeStyle = K.rgba(accent, 0.18);
      ctx.lineWidth = 10;
      roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
      ctx.stroke();
    }
    const gr = ctx.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, opts.top || UI.panelTop);
    gr.addColorStop(1, opts.bottom || UI.panelBottom);
    ctx.fillStyle = gr;
    roundRect(x, y, w, h, r);
    ctx.fill();
    /* inner sheen across the top */
    const sh = ctx.createLinearGradient(x, y, x, y + Math.min(40, h * 0.4));
    sh.addColorStop(0, 'rgba(255,255,255,0.07)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    roundRect(x + 1, y + 1, w - 2, Math.min(40, h * 0.4), r);
    ctx.fill();
    ctx.strokeStyle = K.rgba(accent, opts.glow ? 0.95 : 0.45);
    ctx.lineWidth = opts.glow ? 2 : 1.2;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    if (opts.brackets !== false) {
      const L = Math.min(18, w / 5, h / 3);
      ctx.strokeStyle = K.rgba(accent, opts.glow ? 1 : 0.8);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + L); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + L, y + 2);
      ctx.moveTo(x + w - L, y + 2); ctx.lineTo(x + w - 2, y + 2); ctx.lineTo(x + w - 2, y + L);
      ctx.moveTo(x + 2, y + h - L); ctx.lineTo(x + 2, y + h - 2); ctx.lineTo(x + L, y + h - 2);
      ctx.moveTo(x + w - L, y + h - 2); ctx.lineTo(x + w - 2, y + h - 2); ctx.lineTo(x + w - 2, y + h - L);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* A bar split into cells; frac in [0, 1] */
  function bar(x, y, w, h, frac, color, opts) {
    opts = opts || {};
    const cells = opts.cells || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(x - 1, y - 1, w + 2, h + 2, Math.min(4, h / 2));
    ctx.fill();
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      const gr = ctx.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, K.shade(color, 0.45));
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, K.shade(color, -0.4));
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, w * f, h);
      if (opts.ghost !== undefined && opts.ghost > f) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + w * f, y, w * (Math.min(1, opts.ghost) - f), h);
      }
    }
    if (cells > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 1; i < cells; ++i) ctx.fillRect(x + w * i / cells - 0.5, y, 1, h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }

  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function star(cx, cy, r, earned) {
    starPath(cx, cy, r);
    if (earned) {
      const gr = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
      gr.addColorStop(0, '#fff4b0');
      gr.addColorStop(0.5, UI.gold);
      gr.addColorStop(1, UI.goldDeep);
      ctx.fillStyle = gr;
    } else
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
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
    NS.propArt.icon(ctx, kind, x, y, size, color);
  }

  /* A scrap coin glyph with an amount */
  function credits(n, x, y, px, align) {
    ctx.font = font(px, 'bold');
    const s = String(n);
    const w = ctx.measureText(s).width + px * 1.2;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    K.blitRot(ctx, NS.propArt.scrap(), x0 + px * 0.45, y, 0, px / 14);
    text(s, x0 + px * 1.1, y, px, UI.gold, { weight: 'bold' });
    return w;
  }

  /* The game logo: chrome letters with an accent rim, painted once */
  function logo() {
    return K.sprite('logo', 760, 140, (g, w, h) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'italic 900 92px ' + FONT;
      g.lineJoin = 'round';
      g.strokeStyle = '#0a1a3a';
      g.lineWidth = 14;
      g.strokeText('SPACE COMBAT', w / 2, h / 2);
      g.strokeStyle = '#4fc3ff';
      g.lineWidth = 4;
      g.strokeText('SPACE COMBAT', w / 2, h / 2);
      const gr = g.createLinearGradient(0, h / 2 - 40, 0, h / 2 + 40);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.45, '#bcd8f0');
      gr.addColorStop(0.5, '#5a7a9a');
      gr.addColorStop(0.75, '#d8eaff');
      gr.addColorStop(1, '#7a9ab8');
      g.fillStyle = gr;
      g.fillText('SPACE COMBAT', w / 2, h / 2);
    });
  }

  Object.assign(NS.kit, {
    font, text, fitText, wrap, roundRect, panel, bar, star, starPath, lock, icon, credits, logo
  });
})();
