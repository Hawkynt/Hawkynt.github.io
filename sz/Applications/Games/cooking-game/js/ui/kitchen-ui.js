;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Shared drawing kit for Cooking Game: brass-framed wood panels, paper
   * slips and chalkboards, candy buttons, text that always fits its box,
   * chips, keycaps, meters, stars and extruded headlines.
   * Usage: const ui = SZ.KitchenUI.create(ctx); ui.drawPanel(x, y, w, h, { title: 'Garage' });
   */
  function create(ctx) {
    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }

    function parseHex(hex) {
      if (hex.length === 4)
        return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function hexToRgba(hex, alpha) {
      const [r, g, b] = parseHex(hex);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    function shade(hex, f) {
      if (typeof hex !== 'string' || hex.charAt(0) !== '#')
        return hex;
      const [r, g, b] = parseHex(hex);
      const k = (v) => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
      return '#' + [k(r), k(g), k(b)].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    const UI_FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

    function uiFont(px, weight) {
      return (weight ? weight + ' ' : '') + px + 'px ' + UI_FONT;
    }

    const textFitCache = new Map();
    function cachedLayout(key, build) {
      let v = textFitCache.get(key);
      if (v === undefined) {
        if (textFitCache.size > 3000)
          textFitCache.clear();
        v = build();
        textFitCache.set(key, v);
      }
      return v;
    }

    function ellipsize(text, maxW) {
      text = String(text);
      if (ctx.measureText(text).width <= maxW)
        return text;
      const units = Array.from(text);
      let lo = 0, hi = units.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(units.slice(0, mid).join('').trimEnd() + '…').width <= maxW)
          lo = mid;
        else
          hi = mid - 1;
      }
      return lo > 0 ? units.slice(0, lo).join('').trimEnd() + '…' : '';
    }

    // Largest font size in [minPx, px] that fits; ellipsizes if minPx is still too wide
    function layoutLine(text, maxW, px, minPx, weight) {
      text = String(text);
      return cachedLayout('L' + text + '|' + Math.round(maxW) + '|' + px + '|' + minPx + '|' + (weight || ''), () => {
        let size = px;
        ctx.font = uiFont(size, weight);
        let w = ctx.measureText(text).width;
        if (w > maxW && size > minPx) {
          size = Math.max(minPx, Math.floor(px * maxW / w));
          ctx.font = uiFont(size, weight);
          w = ctx.measureText(text).width;
          while (w > maxW && size > minPx) {
            size -= 0.5;
            ctx.font = uiFont(size, weight);
            w = ctx.measureText(text).width;
          }
        }
        const out = w > maxW ? ellipsize(text, maxW) : text;
        return { size, text: out, width: Math.min(w, maxW) };
      });
    }

    // One line of text that never exceeds maxW; returns the drawn width
    function fitText(text, x, y, maxW, px, opts) {
      opts = opts || {};
      const l = layoutLine(text, Math.max(1, maxW), px, opts.minPx || Math.max(7, Math.round(px * 0.6)), opts.weight);
      ctx.font = uiFont(l.size, opts.weight);
      if (opts.color)
        ctx.fillStyle = opts.color;
      if (opts.outline) {
        ctx.save();
        ctx.strokeStyle = opts.outline;
        ctx.lineWidth = Math.max(2, l.size / 5);
        ctx.lineJoin = 'round';
        ctx.strokeText(l.text, x, y);
        ctx.restore();
      }
      ctx.fillText(l.text, x, y);
      return l.width;
    }

    function wrapText(text, maxW) {
      const lines = [];
      for (const para of String(text).split('\n')) {
        const words = para.split(' ');
        let line = '';
        for (const word of words) {
          const trial = line ? line + ' ' + word : word;
          if (!line || ctx.measureText(trial).width <= maxW)
            line = trial;
          else {
            lines.push(line);
            line = word;
          }
          if (ctx.measureText(line).width > maxW && line === word)
            line = ellipsize(word, maxW);
        }
        lines.push(line);
      }
      return lines;
    }

    function layoutBlock(text, w, h, px, minPx, weight, lineGap) {
      return cachedLayout('B' + text + '|' + Math.round(w) + '|' + Math.round(h) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + lineGap, () => {
        let size = px, lines;
        for (;;) {
          ctx.font = uiFont(size, weight);
          lines = wrapText(text, w);
          if (lines.length * size * lineGap <= h || size <= minPx)
            break;
          size -= 0.5;
        }
        const maxLines = Math.max(1, Math.floor(h / (size * lineGap)));
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          lines[maxLines - 1] = ellipsize(lines[maxLines - 1] + '…', w);
        }
        return { size, lines, lineH: size * lineGap };
      });
    }

    // Wrapped text inside a box. align: 'left' | 'center'; valign: 'top' | 'middle'
    function drawTextBlock(text, x, y, w, h, px, opts) {
      opts = opts || {};
      const b = layoutBlock(text, w, h, px, opts.minPx || Math.max(7, Math.round(px * 0.6)), opts.weight, opts.lineGap || 1.3);
      ctx.font = uiFont(b.size, opts.weight);
      if (opts.color)
        ctx.fillStyle = opts.color;
      const align = opts.align || 'left';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const tx = align === 'center' ? x + w / 2 : x;
      let ty = y + b.lineH / 2;
      if (opts.valign === 'middle')
        ty += (h - b.lines.length * b.lineH) / 2;
      for (const line of b.lines) {
        ctx.fillText(line, tx, ty);
        ty += b.lineH;
      }
      return b.lines.length * b.lineH;
    }

    /* ══════════════════════════════════════════════════════════════════
       UI PANELS -- warm walnut boards in a brass frame, paper slips and
       candy buttons. Every face is painted once into a cached canvas at
       2x and blitted afterwards; only the text is drawn per frame.
       ══════════════════════════════════════════════════════════════════ */

    const UI = {
      panelTop: '#5a3620',
      panelBottom: '#2e190d',
      edge: '#1a0d06',
      rim: 'rgba(255,220,150,0.18)',
      accent: '#ff9a3a',
      gold: '#ffd75a',
      goldDeep: '#c9952a',
      brass: '#e0b048',
      text: '#fff3dc',
      textDim: '#e2c9a0',
      textMute: '#98806a',
      ink: '#3a2410',
      inkDim: '#7a5a38',
      paper: '#fbf3dc',
      good: '#7be08e',
      bad: '#ff6a5a',
      warn: '#ffb648'
    };

    function roundRectPath(x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
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

    function rrOn(c, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r);
      c.arcTo(x, y, x + r, y, r);
      c.closePath();
    }

    function lin(c, x0, y0, x1, y1, stops) {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      for (let i = 0; i < stops.length; ++i) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    }

    /* a tiny seeded rng so a cached face always paints the same grain */
    function seeded(seed) {
      let a = seed >>> 0;
      return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /* ── cached faces: key -> { cv, pad } ── */
    const FACE_SCALE = 2;
    const faceCache = new Map();
    const canCache = typeof document !== 'undefined' && !!document.createElement;

    function cachedFace(key, w, h, pad, paint) {
      if (!canCache) return null;
      let f = faceCache.get(key);
      if (f) return f;
      if (faceCache.size > 260) faceCache.clear();
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil((w + pad * 2) * FACE_SCALE));
      cv.height = Math.max(1, Math.ceil((h + pad * 2) * FACE_SCALE));
      const c = cv.getContext('2d');
      c.scale(FACE_SCALE, FACE_SCALE);
      c.translate(pad, pad);
      paint(c);
      f = { cv: cv, pad: pad };
      faceCache.set(key, f);
      return f;
    }

    function blitFace(f, x, y, w, h) {
      ctx.drawImage(f.cv, x - f.pad, y - f.pad, w + f.pad * 2, h + f.pad * 2);
    }

    /* wood grain streaks inside the current clip */
    function grain(c, x, y, w, h, rnd, dark, light, vertical) {
      const n = Math.max(6, Math.floor((vertical ? w : h) / 5));
      for (let i = 0; i < n; ++i) {
        const p = (vertical ? x : y) + rnd() * (vertical ? w : h);
        c.strokeStyle = rnd() < 0.6 ? dark : light;
        c.lineWidth = 0.6 + rnd() * 1.4;
        /* a gently wandering polyline */
        const amp = 1 + rnd() * 2.5, ph = rnd() * 6, steps = 8;
        c.beginPath();
        for (let s = 0; s <= steps; ++s) {
          const d = Math.sin(s * 0.9 + ph) * amp;
          if (vertical) {
            if (s === 0) c.moveTo(p + d, y);
            else c.lineTo(p + d, y + h * s / steps);
          } else {
            if (s === 0) c.moveTo(x, p + d);
            else c.lineTo(x + w * s / steps, p + d);
          }
        }
        c.stroke();
      }
    }

    function rivet(c, x, y, r) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath();
      c.arc(x + 0.6, y + 0.9, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, '#fff1b8'], [0.5, '#e0b048'], [1, '#8a5a14']]);
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    /* walnut board, brass frame */
    function paintWood(c, w, h, r, o) {
      const top = o.top || UI.panelTop, bot = o.bottom || UI.panelBottom;
      if (!o.flat) {
        rrOn(c, 1, 5, w, h, r);
        c.fillStyle = 'rgba(10,4,0,0.45)';
        c.fill();
        rrOn(c, 0, 3, w, h, r);
        c.fillStyle = 'rgba(10,4,0,0.35)';
        c.fill();
      }
      /* brass frame */
      rrOn(c, 0, 0, w, h, r);
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#fff0b0'], [0.08, '#e9bd56'], [0.5, '#c08a2c'], [0.92, '#8a5a14'], [1, '#5a3a0a']]);
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = UI.edge;
      c.stroke();
      const b = Math.min(5, Math.max(3, Math.min(w, h) * 0.05));
      /* wood inset */
      rrOn(c, b, b, w - b * 2, h - b * 2, Math.max(2, r - b * 0.7));
      c.fillStyle = lin(c, 0, b, 0, h - b, [[0, shade(top, 0.06)], [0.5, top], [1, bot]]);
      c.fill();
      c.save();
      c.clip();
      grain(c, b, b, w - b * 2, h - b * 2, seeded(w * 31 + h * 17), 'rgba(20,8,2,0.22)', 'rgba(255,200,140,0.07)', false);
      /* soft inner shadow under the top rail and a warm glow from below */
      c.fillStyle = lin(c, 0, b, 0, b + 14, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
      c.fillRect(b, b, w, 14);
      c.fillStyle = lin(c, 0, h * 0.55, 0, h, [[0, 'rgba(255,170,90,0)'], [1, 'rgba(255,170,90,0.08)']]);
      c.fillRect(b, h * 0.55, w, h * 0.45);
      c.restore();
      rrOn(c, b, b, w - b * 2, h - b * 2, Math.max(2, r - b * 0.7));
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.stroke();
      rrOn(c, b + 1, b + 1, w - b * 2 - 2, h - b * 2 - 2, Math.max(2, r - b * 0.7 - 1));
      c.strokeStyle = o.glow ? hexToRgba(o.accent || UI.gold, 0.9) : 'rgba(255,215,150,0.12)';
      c.lineWidth = o.glow ? 2 : 1;
      c.stroke();
      /* accent ribbon along the top */
      if (w > 60) {
        c.fillStyle = lin(c, b + r, 0, w - b - r, 0, [[0, hexToRgba(o.accent || UI.gold, 0)], [0.5, hexToRgba(o.accent || UI.gold, 0.85)], [1, hexToRgba(o.accent || UI.gold, 0)]]);
        c.fillRect(b + r, b + 1, w - (b + r) * 2, 2);
      }
      if (!o.noStuds && w > 50 && h > 40) {
        const k = Math.max(2, b * 0.55);
        rivet(c, b + k + 2, b + k + 2, k);
        rivet(c, w - b - k - 2, b + k + 2, k);
        rivet(c, b + k + 2, h - b - k - 2, k);
        rivet(c, w - b - k - 2, h - b - k - 2, k);
      }
      if (o.title) {
        const hh = o.headerH || 30;
        c.save();
        rrOn(c, b, b, w - b * 2, hh - b + 2, Math.max(2, r - b * 0.7));
        c.clip();
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.fillRect(b, b, w, hh);
        c.restore();
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(b + 6, hh + 1, w - b * 2 - 12, 1.5);
        c.fillStyle = 'rgba(255,215,140,0.16)';
        c.fillRect(b + 6, hh + 2.5, w - b * 2 - 12, 1);
      }
    }

    /* cream order slip: torn bottom edge, faint ruled lines */
    function paintPaper(c, w, h, r, o) {
      if (!o.flat) {
        c.fillStyle = 'rgba(20,10,0,0.35)';
        rrOn(c, 2, 4, w, h, r);
        c.fill();
      }
      c.beginPath();
      c.moveTo(r, 0);
      c.lineTo(w - r, 0);
      c.quadraticCurveTo(w, 0, w, r);
      const teeth = Math.max(4, Math.round(w / 9));
      c.lineTo(w, h - 3);
      for (let i = teeth; i >= 0; --i) c.lineTo(i * w / teeth, h - (i % 2 ? 0 : 4));
      c.lineTo(0, r);
      c.quadraticCurveTo(0, 0, r, 0);
      c.closePath();
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#fffaea'], [1, o.bottom || '#efe0bc']]);
      c.fill();
      c.strokeStyle = 'rgba(120,80,30,0.35)';
      c.lineWidth = 1;
      c.stroke();
      c.save();
      c.clip();
      c.strokeStyle = 'rgba(120,150,190,0.16)';
      for (let ly = 22; ly < h - 6; ly += 11) {
        c.beginPath();
        c.moveTo(4, ly);
        c.lineTo(w - 4, ly);
        c.stroke();
      }
      c.fillStyle = hexToRgba(o.accent || '#d8402a', 0.9);
      c.fillRect(0, 0, w, 4);
      c.fillStyle = lin(c, 0, h - 18, 0, h, [[0, 'rgba(160,110,40,0)'], [1, 'rgba(160,110,40,0.12)']]);
      c.fillRect(0, h - 18, w, 18);
      c.restore();
    }

    /* dark slate chalkboard in a wood frame */
    function paintChalk(c, w, h, r, o) {
      if (!o.flat) {
        rrOn(c, 2, 5, w, h, r);
        c.fillStyle = 'rgba(10,4,0,0.45)';
        c.fill();
      }
      rrOn(c, 0, 0, w, h, r);
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#8a5a32'], [1, '#4a2c16']]);
      c.fill();
      c.strokeStyle = UI.edge;
      c.lineWidth = 1.5;
      c.stroke();
      const b = 7;
      rrOn(c, b, b, w - b * 2, h - b * 2, 3);
      c.fillStyle = lin(c, 0, b, 0, h - b, [[0, '#33433c'], [1, '#1e2a25']]);
      c.fill();
      c.save();
      c.clip();
      const rnd = seeded(w * 7 + h);
      for (let i = 0; i < 14; ++i) {
        c.fillStyle = 'rgba(255,255,255,' + (0.015 + rnd() * 0.03) + ')';
        c.beginPath();
        c.ellipse(b + rnd() * w, b + rnd() * h, 20 + rnd() * 60, 6 + rnd() * 14, rnd() * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      rrOn(c, b, b, w - b * 2, h - b * 2, 3);
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 1.5;
      c.stroke();
    }

    function faceKey(kind, w, h, r, o) {
      return kind + '|' + Math.round(w) + 'x' + Math.round(h) + '|' + r + '|' + (o.top || '') + (o.bottom || '') + '|' +
        (o.accent || '') + '|' + (o.glow ? 1 : 0) + (o.flat ? 1 : 0) + (o.noStuds ? 1 : 0) + '|' + (o.title ? 'T' + (o.headerH || 30) : '');
    }

    function paintFace(c, kind, w, h, r, o) {
      if (kind === 'paper') paintPaper(c, w, h, r, o);
      else if (kind === 'chalk') paintChalk(c, w, h, r, o);
      else paintWood(c, w, h, r, o);
    }

    // Framed panel: brass-framed walnut board (style 'wood'), an order slip
    // ('paper') or a chalkboard ('chalk'), with an optional title header.
    // Returns the y where content can start.
    function drawPanel(x, y, w, h, opts) {
      opts = opts || {};
      const r = opts.radius !== undefined ? opts.radius : 10;
      const kind = opts.style || 'wood';
      ctx.save();
      if (opts.alpha !== undefined)
        ctx.globalAlpha *= opts.alpha;
      const f = cachedFace(faceKey(kind, w, h, r, opts), w, h, 8, c => paintFace(c, kind, w, h, r, opts));
      if (f) blitFace(f, x, y, w, h);
      else {
        ctx.save();
        ctx.translate(x, y);
        paintFace(ctx, kind, w, h, r, opts);
        ctx.restore();
      }
      let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
      if (opts.title) {
        const hh = opts.headerH || 30;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const rpad = opts.titleRightPad || 0;
        const rightW = opts.titleRight ? Math.min(w * 0.45, 170) : 0;
        fitText(opts.title, x + 14, y + hh / 2 + 2, w - 28 - rightW - rpad, opts.titlePx || 16,
          { weight: 'bold', color: kind === 'paper' ? UI.ink : (opts.titleColor || UI.gold), outline: kind === 'paper' ? null : 'rgba(30,12,2,0.8)' });
        if (opts.titleRight) {
          ctx.textAlign = 'right';
          fitText(opts.titleRight, x + w - 14 - rpad, y + hh / 2 + 2, rightW - 6, 12, { color: opts.titleRightColor || UI.textDim, weight: 'bold' });
        }
        contentY = y + hh + 6;
      }
      ctx.restore();
      return contentY;
    }

    /* ── candy buttons: glossy face over a darker 3D lip ── */
    const BTN_COLORS = {
      orange: ['#ffb347', '#ff8a1e', '#c4560a'],
      green: ['#8ee86a', '#4cc23a', '#2a7a1c'],
      red: ['#ff8a7a', '#e8463a', '#94201a'],
      blue: ['#7ad0ff', '#2e9ae8', '#1a5a9a'],
      gold: ['#fff09a', '#ffc93a', '#b8820a'],
      wood: ['#a8703e', '#7a4a24', '#3e2210'],
      grey: ['#b8b2a8', '#8a8478', '#4e4a42']
    };

    function paintButton(c, w, h, r, col, hot, pressed) {
      const lip = pressed ? 2 : Math.max(3, Math.round(h * 0.1));
      const ty = pressed ? 2 : 0;
      rrOn(c, 1, 3, w, h, r);
      c.fillStyle = 'rgba(10,4,0,0.4)';
      c.fill();
      rrOn(c, 0, ty, w, h - ty, r);
      c.fillStyle = col[2];
      c.fill();
      rrOn(c, 0, ty, w, h - lip - ty, r);
      c.fillStyle = lin(c, 0, ty, 0, h - lip, [[0, hot ? shade(col[0], 0.2) : col[0]], [0.55, hot ? shade(col[1], 0.12) : col[1]], [1, shade(col[1], -0.1)]]);
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(40,16,0,0.55)';
      rrOn(c, 0, ty, w, h - ty, r);
      c.stroke();
      /* glossy cap */
      c.save();
      rrOn(c, 0, ty, w, h - lip - ty, r);
      c.clip();
      c.fillStyle = lin(c, 0, ty, 0, ty + (h - lip) * 0.5, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.08)']]);
      rrOn(c, 4, ty + 2, w - 8, (h - lip) * 0.46, Math.max(2, r - 3));
      c.fill();
      c.restore();
      rrOn(c, 1.5, ty + 1.5, w - 3, h - lip - ty - 3, Math.max(2, r - 1.5));
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1;
      c.stroke();
      if (hot) {
        rrOn(c, -2, ty - 2, w + 4, h - ty + 4, r + 2);
        c.strokeStyle = 'rgba(255,248,210,0.95)';
        c.lineWidth = 2.5;
        c.stroke();
      }
    }

    // A candy button face with its label. opts: color (key of BTN_COLORS),
    // hot, pressed, disabled, sub, px. Returns nothing; hit testing stays
    // with the caller.
    function drawButtonFace(x, y, w, h, label, opts) {
      opts = opts || {};
      const col = BTN_COLORS[opts.disabled ? 'grey' : (opts.color || 'orange')] || BTN_COLORS.orange;
      const r = opts.radius !== undefined ? opts.radius : Math.min(16, h * 0.32);
      const key = 'btn|' + Math.round(w) + 'x' + Math.round(h) + '|' + r + '|' + col[1] + '|' + (opts.hot ? 1 : 0) + (opts.pressed ? 1 : 0);
      const f = cachedFace(key, w, h, 6, c => paintButton(c, w, h, r, col, opts.hot, opts.pressed));
      ctx.save();
      if (opts.disabled) ctx.globalAlpha *= 0.7;
      if (f) blitFace(f, x, y, w, h);
      else {
        ctx.save();
        ctx.translate(x, y);
        paintButton(ctx, w, h, r, col, opts.hot, opts.pressed);
        ctx.restore();
      }
      const lip = opts.pressed ? 2 : Math.max(3, Math.round(h * 0.1));
      const cy = y + (h - lip) / 2 + (opts.pressed ? 2 : 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const dark = shade(col[2], -0.35);
      fitText(label, x + w / 2, opts.sub ? cy - 7 : cy + 1, w - 20, opts.px || 20, { weight: 'bold', color: '#ffffff', outline: dark });
      if (opts.sub)
        fitText(opts.sub, x + w / 2, cy + 12, w - 20, 11, { weight: 'bold', color: 'rgba(255,255,255,0.92)', outline: dark });
      ctx.restore();
    }

    function drawMeter(x, y, w, h, ratio, color, opts) {
      opts = opts || {};
      ratio = clamp(ratio, 0, 1);
      ctx.save();
      roundRectPath(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
      ctx.fillStyle = opts.frame || '#c08a2c';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(30,12,0,0.8)';
      ctx.stroke();
      roundRectPath(x, y, w, h, h / 2);
      ctx.fillStyle = opts.track || '#1e1008';
      ctx.fill();
      ctx.save();
      roundRectPath(x, y, w, h, h / 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, w, h * 0.35);
      if (ratio > 0) {
        ctx.fillStyle = shade(color, -0.25);
        ctx.fillRect(x, y, w * ratio, h);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * ratio, h * 0.72);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x + 3, y + h * 0.16, Math.max(0, w * ratio - 6), h * 0.2);
        /* moving candy stripes */
        if (opts.stripes !== false) {
          ctx.fillStyle = 'rgba(255,255,255,0.13)';
          const off = ((opts.t || 0) * 30) % (h * 2);
          for (let sx = x - h * 2 + off; sx < x + w * ratio; sx += h * 2) {
            ctx.beginPath();
            ctx.moveTo(sx, y + h);
            ctx.lineTo(sx + h, y);
            ctx.lineTo(sx + h * 1.8, y);
            ctx.lineTo(sx + h * 0.8, y + h);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      ctx.restore();
      if (opts.label) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.75), { weight: 'bold', color: '#fff', outline: 'rgba(40,16,0,0.85)' });
      }
      ctx.restore();
    }

    function drawChip(text, x, y, h, opts) {
      opts = opts || {};
      const px = opts.px || Math.round(h * 0.62);
      ctx.font = uiFont(px, opts.weight || 'bold');
      const w = Math.min(opts.maxW || 1e9, Math.ceil(ctx.measureText(text).width) + h * 0.8);
      const x0 = opts.align === 'right' ? x - w : (opts.align === 'center' ? x - w / 2 : x);
      roundRectPath(x0, y, w, h, h / 2);
      ctx.fillStyle = opts.bg || 'rgba(30,14,4,0.72)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = opts.border || 'rgba(224,176,72,0.55)';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(text, x0 + w / 2, y + h / 2 + 1, w - h * 0.5, px, { weight: opts.weight || 'bold', color: opts.color || UI.text });
      return w;
    }

    function paintKey(c, w, h) {
      rrOn(c, 0, 1.5, w, h, 4);
      c.fillStyle = '#6a5038';
      c.fill();
      rrOn(c, 0, 0, w, h - 1.5, 4);
      c.fillStyle = lin(c, 0, 0, 0, h, [[0, '#fff8e6'], [1, '#e2cfa8']]);
      c.fill();
      c.strokeStyle = 'rgba(60,36,10,0.7)';
      c.lineWidth = 1;
      rrOn(c, 0, 0, w, h, 4);
      c.stroke();
    }

    function keyFace(w, h, x, y) {
      const f = cachedFace('key|' + Math.round(w * 2) + 'x' + Math.round(h * 2), w, h, 2, c => paintKey(c, w, h));
      if (f) blitFace(f, x, y, w, h);
      else {
        ctx.save();
        ctx.translate(x, y);
        paintKey(ctx, w, h);
        ctx.restore();
      }
    }

    // Keycap hints ("[S] Sell") centred on cx and scaled to stay within maxW
    function drawKeyHints(hints, cx, cy, maxW, scale) {
      const k = scale || 1;
      const keyPx = 10 * k, labelPx = 12 * k, keyH = 18 * k, gap = 14 * k;
      const parts = hints.map(h => {
        ctx.font = uiFont(keyPx, 'bold');
        const kw = Math.max(keyH, ctx.measureText(h.key).width + 10 * k);
        ctx.font = uiFont(labelPx, 'bold');
        return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
      });
      let total = -gap;
      for (const p of parts)
        total += p.kw + 5 * k + p.lw + gap;
      const s = Math.min(1, maxW / Math.max(1, total));
      ctx.save();
      ctx.translate(cx - total * s / 2, cy);
      ctx.scale(s, s);
      /* a soft dark band behind the hints keeps them readable on any room */
      roundRectPath(-10, -keyH / 2 - 5, total + 20, keyH + 10, (keyH + 10) / 2);
      ctx.fillStyle = 'rgba(20,8,2,0.55)';
      ctx.fill();
      let x = 0;
      for (const p of parts) {
        keyFace(p.kw, keyH, x, -keyH / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = uiFont(keyPx, 'bold');
        ctx.fillStyle = UI.ink;
        ctx.fillText(p.key, x + p.kw / 2, 0);
        ctx.textAlign = 'left';
        ctx.font = uiFont(labelPx, 'bold');
        ctx.fillStyle = 'rgba(255,240,215,0.88)';
        ctx.fillText(p.label, x + p.kw + 5 * k, 1);
        x += p.kw + 5 * k + p.lw + gap;
      }
      ctx.restore();
    }

    // Small keycap in a corner (build cards, buttons)
    function drawKeycap(key, x, y, px) {
      ctx.font = uiFont(px, 'bold');
      const w = Math.max(px + 5, ctx.measureText(key).width + 8);
      const h = px + 6;
      keyFace(w, h, x, y);
      ctx.font = uiFont(px, 'bold');
      ctx.fillStyle = UI.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, x + w / 2, y + h / 2);
      return w;
    }

    /* headline: chunky extruded game title, painted once per text/size/colour */
    function paintHeadline(c, text, size, color, glow, w, h) {
      c.font = uiFont(size, '900');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      const cx = w / 2, cy = h / 2 - size * 0.06;
      const deep = shade(glow || color, -0.6);
      c.lineWidth = Math.max(4, size / 5);
      c.strokeStyle = 'rgba(20,8,0,0.55)';
      c.strokeText(text, cx, cy + size * 0.14);
      for (let d = Math.max(2, Math.round(size / 14)); d >= 1; --d) {
        c.strokeStyle = deep;
        c.strokeText(text, cx, cy + d);
      }
      c.lineWidth = Math.max(3, size / 7);
      c.strokeStyle = '#3a1a06';
      c.strokeText(text, cx, cy);
      c.fillStyle = lin(c, 0, cy - size / 2, 0, cy + size / 2, [[0, '#ffffff'], [0.18, shade(color, 0.55)], [0.5, color], [1, glow || shade(color, -0.25)]]);
      c.fillText(text, cx, cy);
      c.save();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.fillRect(0, cy - size * 0.5, w, size * 0.32);
      c.restore();
    }

    function drawHeadline(text, x, y, maxW, px, color, glow) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const l = layoutLine(text, maxW, px, Math.round(px * 0.4), '900');
      const size = l.size;
      const w = Math.ceil(l.width + size * 0.8), h = Math.ceil(size * 1.6);
      const f = cachedFace('hl|' + l.text + '|' + size + '|' + color + '|' + (glow || ''), w, h, 4,
        c => paintHeadline(c, l.text, size, color, glow, w, h));
      if (f) blitFace(f, x - w / 2, y - h / 2 + size * 0.06, w, h);
      else {
        ctx.font = uiFont(size, '900');
        ctx.lineWidth = Math.max(3, size / 7);
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(l.text, x, y + 3);
        const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, color);
        g.addColorStop(1, glow || color);
        ctx.fillStyle = g;
        ctx.fillText(l.text, x, y);
      }
      ctx.restore();
    }

    /* a cached vector star (filled or empty socket) */
    function paintStar(c, s, filled) {
      const cx = s / 2, cy = s / 2, R = s * 0.46, r = R * 0.48;
      c.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 ? r : R;
        if (i === 0) c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      c.closePath();
      c.lineJoin = 'round';
      if (filled) {
        c.fillStyle = lin(c, 0, cy - R, 0, cy + R, [[0, '#fff6b0'], [0.45, '#ffd23f'], [1, '#e08a10']]);
        c.fill();
        c.lineWidth = Math.max(1.2, s / 18);
        c.strokeStyle = '#8a4a08';
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.beginPath();
        c.ellipse(cx - R * 0.18, cy - R * 0.3, R * 0.2, R * 0.1, -0.5, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillStyle = 'rgba(20,8,2,0.55)';
        c.fill();
        c.lineWidth = Math.max(1, s / 22);
        c.strokeStyle = 'rgba(255,220,160,0.35)';
        c.stroke();
      }
    }

    function drawStar(cx, cy, size, filled) {
      const s = Math.max(4, Math.round(size));
      const f = cachedFace('star|' + s + '|' + (filled ? 1 : 0), s, s, 1, c => paintStar(c, s, filled));
      if (f) blitFace(f, cx - s / 2, cy - s / 2, s, s);
      else {
        ctx.save();
        ctx.translate(cx - s / 2, cy - s / 2);
        paintStar(ctx, s, filled);
        ctx.restore();
      }
    }

    /* a soft additive glow sprite (sun rays behind stars, lamp halos) */
    function paintGlowSprite(c, s, color, rays) {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, hexToRgba(color, 0.9));
      g.addColorStop(0.3, hexToRgba(color, 0.35));
      g.addColorStop(1, hexToRgba(color, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      if (rays) {
        c.save();
        c.translate(s / 2, s / 2);
        for (let i = 0; i < rays; ++i) {
          c.rotate(Math.PI * 2 / rays);
          const rg = c.createLinearGradient(0, 0, s / 2, 0);
          rg.addColorStop(0, hexToRgba(color, 0.5));
          rg.addColorStop(1, hexToRgba(color, 0));
          c.fillStyle = rg;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(s / 2, -s * 0.05);
          c.lineTo(s / 2, s * 0.05);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
    }

    function drawGlow(cx, cy, size, color, rays) {
      const s = 128;
      const f = cachedFace('glow|' + color + '|' + (rays || 0), s, s, 0, c => paintGlowSprite(c, s, color, rays || 0));
      if (f) ctx.drawImage(f.cv, cx - size / 2, cy - size / 2, size, size);
    }

    return Object.freeze({
      UI, clamp, parseHex, hexToRgba, shade, uiFont, ellipsize, layoutLine, fitText,
      wrapText, layoutBlock, drawTextBlock, roundRectPath, drawPanel, drawMeter,
      drawChip, drawKeyHints, drawKeycap, drawHeadline, drawButtonFace, drawStar, drawGlow
    });
  }

  SZ.KitchenUI = Object.freeze({ create });
})();
