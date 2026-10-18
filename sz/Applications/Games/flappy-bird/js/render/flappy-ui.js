;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Shared drawing kit for Flappy Bird: one panel style, text that always
   * fits its box, chips, keycaps, meters and headlines.
   * Usage: const ui = SZ.FlappyUI.create(ctx); ui.drawPanel(x, y, w, h, { title: 'Garage' });
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
       UI PANELS -- one frame style for every box on screen
       ══════════════════════════════════════════════════════════════════ */

    const UI = {
      panelTop: 'rgba(24,32,56,0.95)',
      panelBottom: 'rgba(10,13,26,0.95)',
      edge: '#05070e',
      rim: 'rgba(150,180,255,0.16)',
      accent: '#5ab8ff',
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

    // Framed panel: offset shadow, vertical gradient, dark edge, light rim,
    // gold corner studs, accent strip and an optional title header
    function drawPanel(x, y, w, h, opts) {
      opts = opts || {};
      const r = opts.radius !== undefined ? opts.radius : 9;
      const accent = opts.accent || UI.gold;
      ctx.save();
      if (opts.alpha !== undefined)
        ctx.globalAlpha *= opts.alpha;
      if (!opts.flat) {
        roundRectPath(x + 2, y + 4, w, h, r);
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fill();
      }
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, opts.top || UI.panelTop);
      g.addColorStop(1, opts.bottom || UI.panelBottom);
      roundRectPath(x, y, w, h, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = UI.edge;
      ctx.stroke();
      roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
      ctx.lineWidth = 1;
      ctx.strokeStyle = opts.glow ? hexToRgba(accent, 0.8) : UI.rim;
      ctx.stroke();
      // Accent strip along the top edge
      const sg = ctx.createLinearGradient(x, 0, x + w, 0);
      sg.addColorStop(0, hexToRgba(accent, 0));
      sg.addColorStop(0.5, hexToRgba(accent, 0.9));
      sg.addColorStop(1, hexToRgba(accent, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(x + r, y + 1, w - r * 2, 2);
      // Gold corner studs
      if (!opts.noStuds && w > 40 && h > 30) {
        ctx.fillStyle = hexToRgba(accent, 0.75);
        const s = 3;
        ctx.fillRect(x + 4, y + h - 4 - s, s, s);
        ctx.fillRect(x + w - 4 - s, y + h - 4 - s, s, s);
      }
      let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
      if (opts.title) {
        const hh = opts.headerH || 30;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x + 2, y + 3, w - 4, hh - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 8, y + hh, w - 16, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 8, y + hh + 1, w - 16, 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const rpad = opts.titleRightPad || 0;
        const rightW = opts.titleRight ? Math.min(w * 0.45, 170) : 0;
        fitText(opts.title, x + 12, y + hh / 2 + 1, w - 24 - rightW - rpad, opts.titlePx || 16, { weight: 'bold', color: accent });
        if (opts.titleRight) {
          ctx.textAlign = 'right';
          fitText(opts.titleRight, x + w - 12 - rpad, y + hh / 2 + 1, rightW - 6, 12, { color: opts.titleRightColor || UI.textDim, weight: 'bold' });
        }
        contentY = y + hh + 6;
      }
      ctx.restore();
      return contentY;
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
      ctx.fillStyle = opts.bg || 'rgba(255,255,255,0.08)';
      ctx.fill();
      if (opts.border) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = opts.border;
        ctx.stroke();
      }
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

    function drawHeadline(text, x, y, maxW, px, color, glow) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const l = layoutLine(text, maxW, px, Math.round(px * 0.4), 'bold');
      ctx.font = uiFont(l.size, 'bold');
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, l.size / 7);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(l.text, x, y + 3);
      ctx.strokeStyle = shade(glow || color, -0.55);
      ctx.lineWidth = Math.max(2, l.size / 10);
      ctx.strokeText(l.text, x, y);
      const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, color);
      g.addColorStop(1, glow || color);
      ctx.fillStyle = g;
      ctx.fillText(l.text, x, y);
      ctx.restore();
    }

    return Object.freeze({
      UI, clamp, parseHex, hexToRgba, shade, uiFont, ellipsize, layoutLine, fitText,
      wrapText, layoutBlock, drawTextBlock, roundRectPath, drawPanel, drawMeter,
      drawChip, drawKeyHints, drawKeycap, drawHeadline
    });
  }

  SZ.FlappyUI = Object.freeze({ create });
})();
