;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Drawing kit for the Physics Puzzle: one panel style (smoked blueprint
   * glass in a brass frame with screw-head rivets), text that always fits its
   * box, chips, keycaps, meters and glossy headlines. Panels and headlines
   * are cached per size and style.
   * Usage: const ui = SZ.PhysicsPuzzleUI.create(ctx); ui.drawPanel(x, y, w, h, { title: 'Launcher' });
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
    function layoutLine(text, maxW, px, minPx, weight, family) {
      text = String(text);
      const fontOf = family ? function(sz, wt) { return (wt ? wt + ' ' : '') + sz + 'px ' + family; } : uiFont;
      return cachedLayout('L' + text + '|' + Math.round(maxW) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + (family || ''), () => {
        let size = px;
        ctx.font = fontOf(size, weight);
        let w = ctx.measureText(text).width;
        if (w > maxW && size > minPx) {
          size = Math.max(minPx, Math.floor(px * maxW / w));
          ctx.font = fontOf(size, weight);
          w = ctx.measureText(text).width;
          while (w > maxW && size > minPx) {
            size -= 0.5;
            ctx.font = fontOf(size, weight);
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
      const l = layoutLine(text, Math.max(1, maxW), px, opts.minPx || Math.max(7, Math.round(px * 0.6)), opts.weight, opts.font);
      ctx.font = opts.font ? (opts.weight ? opts.weight + ' ' : '') + l.size + 'px ' + opts.font : uiFont(l.size, opts.weight);
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
       UI PANELS -- one frame style for every box on screen
       ══════════════════════════════════════════════════════════════════ */

    const UI = {
      panelTop: 'rgba(22,46,62,0.94)',
      panelBottom: 'rgba(7,16,26,0.96)',
      edge: '#05070e',
      rim: 'rgba(232,196,106,0.3)',
      accent: '#4ad0e0',
      gold: '#ffd75a',
      goldDeep: '#c9952a',
      text: '#e4eaf6',
      textDim: '#93a0bb',
      textMute: '#5d6884',
      good: '#6fe08a',
      bad: '#ff6a6a',
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

    /* Panels are painted once into an offscreen canvas per size and style and
       blitted afterwards; without a DOM (tests) they paint straight into ctx. */
    const canCache = typeof document !== 'undefined' && !!document.createElement;
    const panelCache = new Map();
    const TITLE_FONT = "'Segoe UI Black', 'Arial Black', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

    function titleFont(px, weight) {
      return (weight ? weight + ' ' : '') + px + 'px ' + TITLE_FONT;
    }

    function goldStroke(g, y0, y1) {
      const gg = g.createLinearGradient(0, y0, 0, y1);
      gg.addColorStop(0, '#fff3c4');
      gg.addColorStop(0.25, '#e8c46a');
      gg.addColorStop(0.6, '#b8862e');
      gg.addColorStop(1, '#6a4612');
      return gg;
    }

    /* a brass screw head with a coloured jewel slot */
    function cornerGem(g, x, y, s, color) {
      const rg = g.createRadialGradient(x - s * 0.3, y - s * 0.3, 0, x, y, s);
      rg.addColorStop(0, '#fff3c4');
      rg.addColorStop(0.5, '#c8963a');
      rg.addColorStop(1, '#5a3a10');
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = '#1a1206';
      g.stroke();
      g.beginPath();
      g.arc(x, y, s * 0.45, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(x - s * 0.25, y - s * 0.3, s * 0.2, s * 0.2);
    }

    // The panel body: soft drop shadow, smoked glass with a sheen, a brass
    // double border, corner brackets and a screw head on top
    function paintPanel(g, x, y, w, h, r, opts, accent) {
      const glass = !opts.flat;
      if (glass) {
        for (let k = 0; k < 5; ++k) {
          roundRectPathOn(g, x - k + 2, y - k + 6, w + 2 * k, h + 2 * k, r + k);
          g.fillStyle = 'rgba(0,0,0,0.09)';
          g.fill();
        }
      }
      const bg = g.createLinearGradient(0, y, 0, y + h);
      bg.addColorStop(0, opts.top || UI.panelTop);
      bg.addColorStop(1, opts.bottom || UI.panelBottom);
      roundRectPathOn(g, x, y, w, h, r);
      g.fillStyle = bg;
      g.fill();
      if (glass) {
        g.save();
        roundRectPathOn(g, x, y, w, h, r);
        g.clip();
        const sh = g.createRadialGradient(x + w * 0.5, y - h * 0.2, 4, x + w * 0.5, y, Math.max(w, h) * 0.75);
        sh.addColorStop(0, hexToRgba(accent, 0.2));
        sh.addColorStop(1, hexToRgba(accent, 0));
        g.fillStyle = sh;
        g.fillRect(x, y, w, h);
        const gl = g.createLinearGradient(0, y, 0, y + Math.min(h, 40));
        gl.addColorStop(0, 'rgba(255,255,255,0.09)');
        gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl;
        g.fillRect(x, y, w, Math.min(h, 40));
        g.restore();
      }
      roundRectPathOn(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
      g.lineWidth = 2;
      g.strokeStyle = '#05040a';
      g.stroke();
      roundRectPathOn(g, x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
      g.lineWidth = opts.glow ? 2 : 1.5;
      g.strokeStyle = opts.glow ? hexToRgba(accent, 0.95) : goldStroke(g, y, y + h);
      g.stroke();
      if (w > 60 && h > 36) {
        roundRectPathOn(g, x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4));
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(232,196,106,0.18)';
        g.stroke();
      }
      if (!opts.noStuds && w > 80 && h > 50) {
        const b = Math.min(18, w / 6, h / 4);
        g.strokeStyle = 'rgba(232,196,106,0.7)';
        g.lineWidth = 1.2;
        const corners = [[x + 7, y + 7, 1, 1], [x + w - 7, y + 7, -1, 1], [x + 7, y + h - 7, 1, -1], [x + w - 7, y + h - 7, -1, -1]];
        for (const c of corners) {
          g.beginPath();
          g.moveTo(c[0], c[1] + c[3] * b);
          g.lineTo(c[0], c[1]);
          g.lineTo(c[0] + c[2] * b, c[1]);
          g.stroke();
          g.beginPath();
          g.arc(c[0] + c[2] * 4, c[1] + c[3] * 4, 2.2, 0, Math.PI * 2);
          g.stroke();
        }
        cornerGem(g, x + w / 2, y + 1.5, 5, accent);
      }
      if (opts.title) {
        const hh = opts.headerH || 30;
        const hg = g.createLinearGradient(x, 0, x + w, 0);
        hg.addColorStop(0, 'rgba(232,196,106,0)');
        hg.addColorStop(0.5, 'rgba(232,196,106,0.55)');
        hg.addColorStop(1, 'rgba(232,196,106,0)');
        g.fillStyle = 'rgba(255,255,255,0.035)';
        g.fillRect(x + 3, y + 3, w - 6, hh - 3);
        g.fillStyle = hg;
        g.fillRect(x + 10, y + hh, w - 20, 1);
      }
    }

    function roundRectPathOn(g, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
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

    function panelImage(w, h, r, opts, accent) {
      const key = Math.round(w) + 'x' + Math.round(h) + 'r' + r + accent + (opts.flat ? 'f' : '') + (opts.glow ? 'g' : '') + (opts.noStuds ? 'n' : '')
        + (opts.title ? 't' + (opts.headerH || 30) : '') + (opts.top || '') + (opts.bottom || '');
      let c = panelCache.get(key);
      if (!c) {
        if (panelCache.size > 200)
          panelCache.clear();
        c = document.createElement('canvas');
        const pad = 12;
        c.width = Math.ceil(w + pad * 2) * 2;
        c.height = Math.ceil(h + pad * 2) * 2;
        const g = c.getContext('2d');
        g.scale(2, 2);
        g.translate(pad, pad);
        paintPanel(g, 0, 0, w, h, r, opts, accent);
        c.pad = pad;
        panelCache.set(key, c);
      }
      return c;
    }

    function drawPanel(x, y, w, h, opts) {
      opts = opts || {};
      const r = opts.radius !== undefined ? opts.radius : 9;
      const accent = opts.accent || UI.gold;
      ctx.save();
      if (opts.alpha !== undefined)
        ctx.globalAlpha *= opts.alpha;
      if (canCache && w > 0 && h > 0) {
        const img = panelImage(w, h, r, opts, accent);
        ctx.drawImage(img, x - img.pad, y - img.pad, img.width / 2, img.height / 2);
      } else {
        paintPanel(ctx, x, y, w, h, r, opts, accent);
      }
      let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
      if (opts.title) {
        const hh = opts.headerH || 30;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const rpad = opts.titleRightPad || 0;
        const rightW = opts.titleRight ? Math.min(w * 0.45, 170) : 0;
        fitText(opts.title, x + 14, y + hh / 2 + 2, w - 28 - rightW - rpad, opts.titlePx || 16, { weight: 'bold', color: accent, font: TITLE_FONT });
        if (opts.titleRight) {
          ctx.textAlign = 'right';
          fitText(opts.titleRight, x + w - 14 - rpad, y + hh / 2 + 2, rightW - 6, 12, { color: opts.titleRightColor || UI.textDim, weight: 'bold' });
        }
        contentY = y + hh + 6;
      }
      ctx.restore();
      return contentY;
    }

    /* a menu button: glass with a gilded rim; hot buttons light up and a sheen sweeps across */
    function drawButtonFrame(x, y, w, h, hot, accent, t) {
      const a = accent || UI.accent;
      drawPanel(x, y, w, h, {
        radius: Math.min(12, h / 3), noStuds: true, accent: hot ? UI.gold : a, glow: hot,
        top: hot ? 'rgba(40,104,124,0.97)' : 'rgba(26,62,80,0.95)', bottom: hot ? 'rgba(12,40,52,0.97)' : 'rgba(8,22,32,0.95)'
      });
      if (!hot)
        return;
      ctx.save();
      roundRectPath(x + 2, y + 2, w - 4, h - 4, Math.min(10, h / 3));
      ctx.clip();
      const p = ((t || 0) * 0.6) % 1.6 - 0.3;
      const sx = x + p * w;
      const sg = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
      sg.addColorStop(0, 'rgba(255,240,200,0)');
      sg.addColorStop(0.5, 'rgba(255,240,200,0.16)');
      sg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    function drawMeter(x, y, w, h, ratio, color, opts) {
      opts = opts || {};
      ratio = clamp(ratio, 0, 1);
      ctx.save();
      roundRectPath(x, y, w, h, h / 2);
      ctx.fillStyle = opts.track || 'rgba(0,0,0,0.55)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();
      if (ratio > 0) {
        ctx.save();
        roundRectPath(x, y, w, h, h / 2);
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * ratio, h);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x, y, w * ratio, h * 0.42);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, y + h * 0.75, w * ratio, h * 0.25);
        ctx.restore();
      }
      if (opts.label) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.75), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
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
      ctx.fillStyle = opts.bg || 'rgba(12,10,24,0.78)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = opts.border || 'rgba(232,196,106,0.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x0 + h / 2, y + 2, w - h, h * 0.3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(text, x0 + w / 2, y + h / 2 + 1, w - h * 0.5, px, { weight: opts.weight || 'bold', color: opts.color || UI.text });
      return w;
    }

    // Keycap hints ("[S] Sell") centred on cx and scaled to stay within maxW
    function drawKeyHints(hints, cx, cy, maxW, scale) {
      const k = scale || 1;
      const keyPx = 10 * k, labelPx = 11 * k, keyH = 16 * k, gap = 12 * k;
      const parts = hints.map(h => {
        ctx.font = uiFont(keyPx, 'bold');
        const kw = Math.max(keyH, ctx.measureText(h.key).width + 8 * k);
        ctx.font = uiFont(labelPx);
        return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
      });
      let total = -gap;
      for (const p of parts)
        total += p.kw + 4 * k + p.lw + gap;
      const s = Math.min(1, maxW / Math.max(1, total));
      ctx.save();
      ctx.translate(cx - total * s / 2, cy);
      ctx.scale(s, s);
      let x = 0;
      for (const p of parts) {
        roundRectPath(x, -keyH / 2, p.kw, keyH, 3 * k);
        ctx.fillStyle = 'rgba(20,26,42,0.92)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,215,90,0.45)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 3, keyH / 2 - 3, p.kw - 6, 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = uiFont(keyPx, 'bold');
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(p.key, x + p.kw / 2, 1);
        ctx.textAlign = 'left';
        ctx.font = uiFont(labelPx);
        ctx.fillStyle = 'rgba(200,210,230,0.8)';
        ctx.fillText(p.label, x + p.kw + 4 * k, 1);
        x += p.kw + 4 * k + p.lw + gap;
      }
      ctx.restore();
    }

    // Small keycap in a corner (build cards, buttons)
    function drawKeycap(key, x, y, px) {
      ctx.font = uiFont(px, 'bold');
      const w = Math.max(px + 4, ctx.measureText(key).width + 6);
      const h = px + 5;
      roundRectPath(x, y, w, h, 3);
      ctx.fillStyle = 'rgba(8,10,20,0.85)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,215,90,0.4)';
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, x + w / 2, y + h / 2 + 0.5);
      return w;
    }

    function paintHeadline(g, text, x, y, size, color, glow) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = titleFont(size, 'bold');
      g.lineJoin = 'round';
      /* a soft halo of the glow colour, built from wide translucent strokes */
      for (let k = 4; k >= 1; --k) {
        g.lineWidth = size * 0.1 * k;
        g.strokeStyle = hexToRgba(glow || color, 0.07);
        g.strokeText(text, x, y);
      }
      g.lineWidth = Math.max(3, size / 7);
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.strokeText(text, x, y + size * 0.05);
      g.strokeStyle = shade(glow || color, -0.6);
      g.lineWidth = Math.max(2, size / 9);
      g.strokeText(text, x, y);
      const gr = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.42, color);
      gr.addColorStop(0.58, shade(color, -0.12));
      gr.addColorStop(1, glow || color);
      g.fillStyle = gr;
      g.fillText(text, x, y);
      /* a thin bright edge along the top of the letters */
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x - 4000, y - size * 0.55, 8000, size * 0.12);
      g.restore();
    }

    const headlineCache = new Map();

    function drawHeadline(text, x, y, maxW, px, color, glow) {
      ctx.save();
      ctx.font = titleFont(px, 'bold');
      let size = px;
      let w = ctx.measureText(text).width;
      if (w > maxW) {
        size = Math.max(Math.round(px * 0.4), Math.floor(px * maxW / w));
        ctx.font = titleFont(size, 'bold');
        w = ctx.measureText(text).width;
      }
      if (!canCache) {
        paintHeadline(ctx, text, x, y, size, color, glow);
        ctx.restore();
        return;
      }
      const key = text + '|' + size + '|' + color + '|' + glow;
      let c = headlineCache.get(key);
      if (!c) {
        if (headlineCache.size > 60)
          headlineCache.clear();
        c = document.createElement('canvas');
        const pad = Math.ceil(size * 0.5);
        c.width = Math.ceil(w + pad * 2) * 2;
        c.height = Math.ceil(size * 1.4 + pad * 2) * 2;
        const g = c.getContext('2d');
        g.scale(2, 2);
        paintHeadline(g, text, c.width / 4, c.height / 4, size, color, glow);
        headlineCache.set(key, c);
      }
      ctx.drawImage(c, x - c.width / 4, y - c.height / 4, c.width / 2, c.height / 2);
      ctx.restore();
    }

    return Object.freeze({
      UI, clamp, parseHex, hexToRgba, shade, uiFont, titleFont, ellipsize, layoutLine, fitText,
      wrapText, layoutBlock, drawTextBlock, roundRectPath, drawPanel, drawMeter,
      drawChip, drawKeyHints, drawKeycap, drawHeadline, drawButtonFrame, TITLE_FONT
    });
  }

  SZ.PhysicsPuzzleUI = Object.freeze({ create });
})();
