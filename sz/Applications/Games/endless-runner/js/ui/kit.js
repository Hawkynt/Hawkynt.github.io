/* The UI drawing kit in plane coordinates: fonts, fitted and wrapped text, bevelled glass
   panels with corner brackets and glow faked with wide strokes, segmented bars, stars, locks,
   the UI icons (trophy, gift, heart, check, coin, gem, lock, bolt...), the coin and gem
   counters and the cached game logo. Panels and bar sheens are painted once and reused, so a
   frame only blits them. Draws only; owns the panel cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
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

  function roundRect(x, y, w, h, r, g) {
    g = g || ctx;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function paintPanel(g, x, y, w, h, opts) {
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    if (opts.glow) {
      g.strokeStyle = K.rgba(accent, 0.18);
      g.lineWidth = 10;
      roundRect(x - 2, y - 2, w + 4, h + 4, r + 2, g);
      g.stroke();
    }
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, opts.top || UI.panelTop);
    gr.addColorStop(1, opts.bottom || UI.panelBottom);
    g.fillStyle = gr;
    roundRect(x, y, w, h, r, g);
    g.fill();
    /* inner sheen across the top */
    const sh = g.createLinearGradient(x, y, x, y + Math.min(40, h * 0.4));
    sh.addColorStop(0, 'rgba(255,255,255,0.07)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    roundRect(x + 1, y + 1, w - 2, Math.min(40, h * 0.4), r, g);
    g.fill();
    g.strokeStyle = K.rgba(accent, opts.glow ? 0.95 : 0.45);
    g.lineWidth = opts.glow ? 2 : 1.2;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r, g);
    g.stroke();
    if (opts.brackets !== false) {
      const L = Math.min(18, w / 5, h / 3);
      g.strokeStyle = K.rgba(accent, opts.glow ? 1 : 0.8);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(x + 2, y + L); g.lineTo(x + 2, y + 2); g.lineTo(x + L, y + 2);
      g.moveTo(x + w - L, y + 2); g.lineTo(x + w - 2, y + 2); g.lineTo(x + w - 2, y + L);
      g.moveTo(x + 2, y + h - L); g.lineTo(x + 2, y + h - 2); g.lineTo(x + L, y + h - 2);
      g.moveTo(x + w - L, y + h - 2); g.lineTo(x + w - 2, y + h - 2); g.lineTo(x + w - 2, y + h - L);
      g.stroke();
    }
  }

  /* panels are painted once per size and look and then only blitted (at most PANELS kept) */
  const PANELS = 160, PAD = 8;
  const panels = new Map();

  /* A bevelled glass panel; opts: accent, glow, radius, top, bottom, alpha, brackets */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const pw = Math.round(w), ph = Math.round(h);
    const key = pw + 'x' + ph + ':' + (opts.radius !== undefined ? opts.radius : 10) + ':' + (opts.accent || '') + ':' + (opts.glow ? 1 : 0) +
      ':' + (opts.top || '') + ':' + (opts.bottom || '') + ':' + (opts.brackets === false ? 0 : 1);
    let s = panels.get(key);
    if (s) { panels.delete(key); panels.set(key, s); }
    else {
      const c = K.makeCanvas((pw + PAD * 2) * K.SCALE, (ph + PAD * 2) * K.SCALE);
      const g = c.getContext('2d');
      g.scale(K.SCALE, K.SCALE);
      paintPanel(g, PAD, PAD, pw, ph, opts);
      s = { canvas: c, w: pw + PAD * 2, h: ph + PAD * 2 };
      panels.set(key, s);
      if (panels.size > PANELS) panels.delete(panels.keys().next().value);
    }
    const a = ctx.globalAlpha;
    if (opts.alpha !== undefined) ctx.globalAlpha = a * opts.alpha;
    ctx.drawImage(s.canvas, x - PAD, y - PAD, s.w * w / pw, s.h * h / ph);
    ctx.globalAlpha = a;
  }

  /* the vertical sheen of a bar, made once per height and colour */
  const barGrads = {};
  function barGrad(h, color) {
    const key = h + color;
    let gr = barGrads[key];
    if (!gr) {
      gr = barGrads[key] = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, K.shade(color, 0.45));
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, K.shade(color, -0.4));
    }
    return gr;
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
      ctx.fillStyle = barGrad(h, color);
      ctx.translate(x, y);
      ctx.fillRect(0, 0, w * f, h);
      ctx.translate(-x, -y);
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

  /* UI glyphs in a 40 x 40 box, cached per colour */
  function glyph(kind, color) {
    return K.sprite('glyph:' + kind + ':' + color, 40, 40, (g) => {
      g.translate(20, 20);
      g.fillStyle = color; g.strokeStyle = color;
      g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 3.5;
      switch (kind) {
        case 'trophy':
          g.beginPath(); g.moveTo(-10, -13); g.lineTo(10, -13); g.lineTo(8, 0); g.quadraticCurveTo(0, 8, -8, 0); g.closePath(); g.fill();
          g.beginPath(); g.arc(-11, -7, 5, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(11, -7, 5, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
          g.fillRect(-2, 4, 4, 7); g.fillRect(-8, 11, 16, 4);
          break;
        case 'gift':
          g.fillRect(-12, -4, 24, 16); g.fillRect(-14, -9, 28, 6);
          g.fillStyle = '#141224'; g.fillRect(-2, -9, 4, 21);
          g.beginPath(); g.ellipse(-5, -13, 5, 3, 0.4, 0, Math.PI * 2); g.ellipse(5, -13, 5, 3, -0.4, 0, Math.PI * 2); g.stroke();
          break;
        case 'heart':
          g.beginPath(); g.moveTo(0, 13); g.bezierCurveTo(-18, 0, -10, -16, 0, -6); g.bezierCurveTo(10, -16, 18, 0, 0, 13); g.fill();
          break;
        case 'check':
          g.lineWidth = 5; g.beginPath(); g.moveTo(-11, 1); g.lineTo(-3, 9); g.lineTo(12, -9); g.stroke();
          break;
        case 'star':
          g.beginPath();
          for (let i = 0; i < 10; ++i) { const r = i % 2 ? 6 : 14, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          g.closePath(); g.fill();
          break;
        case 'up':
          g.beginPath(); g.moveTo(0, -14); g.lineTo(12, 2); g.lineTo(4, 2); g.lineTo(4, 13); g.lineTo(-4, 13); g.lineTo(-4, 2); g.lineTo(-12, 2); g.closePath(); g.fill();
          break;
        case 'bolt':
          g.beginPath(); g.moveTo(4, -15); g.lineTo(-9, 2); g.lineTo(0, 2); g.lineTo(-4, 15); g.lineTo(9, -3); g.lineTo(0, -3); g.closePath(); g.fill();
          break;
        case 'wing':
          g.beginPath(); g.moveTo(-12, 10); g.quadraticCurveTo(-10, -14, 14, -12); g.quadraticCurveTo(6, -6, 10, -2); g.quadraticCurveTo(2, 0, 6, 4); g.quadraticCurveTo(-2, 6, -12, 10); g.fill();
          break;
        case 'rocket':
          g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(9, -6, 6, 8); g.lineTo(-6, 8); g.quadraticCurveTo(-9, -6, 0, -15); g.fill();
          g.fillRect(-10, 4, 5, 8); g.fillRect(5, 4, 5, 8);
          g.fillStyle = '#ffb03a'; g.beginPath(); g.moveTo(-4, 9); g.lineTo(0, 16); g.lineTo(4, 9); g.fill();
          break;
        case 'coin':
          g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#141224'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 1);
          break;
        case 'map':
          g.beginPath(); g.moveTo(-13, -10); g.lineTo(-4, -13); g.lineTo(4, -10); g.lineTo(13, -13); g.lineTo(13, 10); g.lineTo(4, 13); g.lineTo(-4, 10); g.lineTo(-13, 13); g.closePath(); g.stroke();
          g.beginPath(); g.moveTo(-4, -13); g.lineTo(-4, 10); g.moveTo(4, -10); g.lineTo(4, 13); g.stroke();
          break;
        case 'run':
          g.beginPath(); g.arc(4, -11, 4, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(2, -5); g.lineTo(-3, 4); g.lineTo(4, 8); g.lineTo(2, 15); g.moveTo(-3, 4); g.lineTo(-11, 10); g.moveTo(1, -3); g.lineTo(10, 1); g.moveTo(1, -3); g.lineTo(-8, -4); g.stroke();
          break;
        case 'leaf':
          g.beginPath(); g.ellipse(0, 0, 13, 7, -0.7, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#141224'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, 9); g.lineTo(9, -9); g.stroke();
          break;
        case 'calendar':
          g.strokeRect(-12, -9, 24, 21); g.fillRect(-12, -9, 24, 6); g.fillRect(-7, -14, 3, 6); g.fillRect(4, -14, 3, 6);
          g.fillRect(-7, 2, 4, 4); g.fillRect(0, 2, 4, 4);
          break;
        case 'skull':
          g.beginPath(); g.arc(0, -3, 11, 0, Math.PI * 2); g.fill(); g.fillRect(-6, 4, 12, 9);
          g.fillStyle = '#141224'; g.beginPath(); g.arc(-4, -3, 3, 0, Math.PI * 2); g.arc(4, -3, 3, 0, Math.PI * 2); g.fill();
          break;
        case 'shirt':
          g.beginPath(); g.moveTo(-6, -12); g.lineTo(-14, -6); g.lineTo(-10, 0); g.lineTo(-8, -2); g.lineTo(-8, 13); g.lineTo(8, 13); g.lineTo(8, -2); g.lineTo(10, 0); g.lineTo(14, -6); g.lineTo(6, -12); g.quadraticCurveTo(0, -6, -6, -12); g.fill();
          break;
        case 'book':
          g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(-7, -13, -14, -11); g.lineTo(-14, 11); g.quadraticCurveTo(-7, 9, 0, 13); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(7, -13, 14, -11); g.lineTo(14, 11); g.quadraticCurveTo(7, 9, 0, 13); g.closePath(); g.fill();
          g.strokeStyle = '#141224'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(0, 13); g.stroke();
          break;
        case 'back':
          g.beginPath(); g.moveTo(-13, 0); g.lineTo(-1, -11); g.lineTo(-1, -4); g.lineTo(12, -4); g.lineTo(12, 4); g.lineTo(-1, 4); g.lineTo(-1, 11); g.closePath(); g.fill();
          break;
        case 'help':
          g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1);
          break;
        case 'pause':
          g.fillRect(-9, -11, 6, 22); g.fillRect(3, -11, 6, 22);
          break;
        case 'play':
          g.beginPath(); g.moveTo(-8, -12); g.lineTo(12, 0); g.lineTo(-8, 12); g.closePath(); g.fill();
          break;
        case 'gem':
          g.beginPath(); g.moveTo(0, 13); g.lineTo(-12, 0); g.lineTo(-6, -10); g.lineTo(6, -10); g.lineTo(12, 0); g.closePath(); g.fill();
          break;
        default:
          g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
      }
    });
  }

  function icon(kind, x, y, size, color) {
    K.blit(ctx, glyph(kind, color || UI.text), x, y, size / 40);
  }

  /* a currency amount with its glyph: kind 'coins' | 'gems' */
  function amount(kind, n, x, y, px, align) {
    ctx.font = font(px, 'bold');
    const str = String(n);
    const w = ctx.measureText(str).width + px * 1.4;
    const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    const spr = kind === 'gems' ? NS.propArt.gem() : NS.propArt.coin();
    K.blit(ctx, spr, x0 + px * 0.5, y, px / 26);
    text(str, x0 + px * 1.25, y, px, kind === 'gems' ? '#ff8ad5' : UI.gold, { weight: 'bold' });
    return w;
  }

  /* The game logo: a speed-streaked two-line title, painted once */
  function logo() {
    return K.sprite('logo', 760, 230, (g, w, h) => {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      const lines = [['ENDLESS', 64, h * 0.27], ['RUNNER', 118, h * 0.66]];
      for (let i = 0; i < lines.length; ++i) {
        const L = lines[i];
        g.font = 'italic 900 ' + L[1] + 'px ' + NS.constants.TITLE_FONT;
        g.strokeStyle = '#120a2a';
        g.lineWidth = L[1] * 0.2;
        g.strokeText(L[0], w / 2, L[2]);
        g.strokeStyle = i ? '#ffd24a' : '#5ee0ff';
        g.lineWidth = L[1] * 0.06;
        g.strokeText(L[0], w / 2, L[2]);
        const gr = g.createLinearGradient(0, L[2] - L[1] / 2, 0, L[2] + L[1] / 2);
        if (i) { gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.45, '#ffb03a'); gr.addColorStop(0.55, '#ff6a2a'); gr.addColorStop(1, '#c0281a'); }
        else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#8ae0ff'); }
        g.fillStyle = gr;
        g.fillText(L[0], w / 2, L[2]);
      }
      /* speed streaks */
      g.globalCompositeOperation = 'destination-over';
      for (let i = 0; i < 9; ++i) {
        const y = h * 0.42 + i * 12, len = 120 + (i * 53) % 160;
        g.fillStyle = i % 2 ? 'rgba(255,176,58,0.55)' : 'rgba(94,224,255,0.45)';
        g.fillRect(20 + (i * 37) % 60, y, len, 4);
      }
      g.globalCompositeOperation = 'source-over';
    });
  }

  Object.assign(NS.kit, {
    font, text, fitText, wrap, roundRect, panel, bar, star, starPath, lock, glyph, icon, amount, logo
  });
})();
