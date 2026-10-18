/* Space Farming - UI drawing primitives: colours, framed panels (bitmap cached), meters, chips,
   key hints, headlines and the screen scrim.
   Reads: G.UW, G.UH, G.uiTime */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { ctx, drawSprite, uiFont, measureIconText, layoutLine, fitText } = NS;

  /* ══════════════════════════════════════════════════════════════════
     UI PANELS — one frame style for every box on screen
     ══════════════════════════════════════════════════════════════════ */

  const UI = {
    panelTop: 'rgba(22,30,52,0.94)',
    panelBottom: 'rgba(9,12,24,0.94)',
    edge: '#05070e',
    rim: 'rgba(150,180,255,0.16)',
    accent: '#5ab8ff',
    gold: '#ffd75a',
    text: '#e4eaf6',
    textDim: '#93a0bb',
    textMute: '#5d6884',
    good: '#6fe08a',
    bad: '#ff6a6a',
    warn: '#ffb648',
    energy: '#4fd8ff',
    leaf: '#7ee06a'
  };

  function parseHex(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

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

  /* Framed panel: shadow, gradient, dark edge, light rim, accent strip and an
     optional title header. Returns the y where the content starts. */
  /* Frame (shadow, gradient, edges, accent strip, header band) of a panel,
     baked into a bitmap per size and style: blurred shadows are costly to
     draw every frame */
  const panelCache = new Map();

  function paintPanelFrame(g, x, y, w, h, opts) {
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    const path = (px, py, pw, ph, pr) => {
      pr = Math.max(0, Math.min(pr, pw / 2, ph / 2));
      g.beginPath();
      g.moveTo(px + pr, py);
      g.arcTo(px + pw, py, px + pw, py + ph, pr);
      g.arcTo(px + pw, py + ph, px, py + ph, pr);
      g.arcTo(px, py + ph, px, py, pr);
      g.arcTo(px, py, px + pw, py, pr);
      g.closePath();
    };
    if (!opts.flat) {
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = opts.shadow !== undefined ? opts.shadow : 16;
      g.shadowOffsetY = 3;
    }
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, opts.top || UI.panelTop);
    grad.addColorStop(1, opts.bottom || UI.panelBottom);
    path(x, y, w, h, r);
    g.fillStyle = grad;
    g.fill();
    g.shadowColor = 'transparent';
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.lineWidth = 2;
    g.strokeStyle = UI.edge;
    g.stroke();
    path(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    g.lineWidth = 1;
    g.strokeStyle = opts.glow ? hexToRgba(accent, 0.75) : UI.rim;
    g.stroke();
    const sg = g.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, hexToRgba(accent, 0));
    sg.addColorStop(0.5, hexToRgba(accent, 0.9));
    sg.addColorStop(1, hexToRgba(accent, 0));
    g.fillStyle = sg;
    g.fillRect(x + r, y + 1, w - r * 2, 2);
    if (opts.title) {
      const hh = opts.headerH || 34;
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x + 2, y + 3, w - 4, hh - 3);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + 8, y + hh, w - 16, 1);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x + 8, y + hh + 1, w - 16, 1);
    }
  }

  /* Draws a w x h shape (plus pad around it) from a bitmap cache; paint(g, x, y)
     fills it on first use at the current scale */
  function drawBaked(key, x, y, w, h, pad, paint) {
    const m = ctx.getTransform();
    const s = Math.max(0.25, Math.round(Math.hypot(m.a, m.b) * 8) / 8);
    const W = Math.round(w), H = Math.round(h);
    const full = key + '|' + W + '|' + H + '|' + s;
    let cv = panelCache.get(full);
    if (!cv) {
      if (panelCache.size > 400)
        panelCache.clear();
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil((W + pad * 2) * s));
      cv.height = Math.max(1, Math.ceil((H + pad * 2) * s));
      const g = cv.getContext('2d');
      g.scale(s, s);
      paint(g, pad, pad, W, H);
      panelCache.set(full, cv);
    }
    ctx.drawImage(cv, x - pad, y - pad, W + pad * 2, H + pad * 2);
  }

  function rrPath(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawPanelFrame(x, y, w, h, opts) {
    const pad = opts.flat ? 3 : Math.ceil((opts.shadow !== undefined ? opts.shadow : 16) + 6);
    const key = ['panel', opts.radius, opts.accent, opts.glow ? 1 : 0, opts.flat ? 1 : 0, opts.shadow, opts.top, opts.bottom, opts.title ? (opts.headerH || 34) : 0].join('|');
    drawBaked(key, x, y, w, h, pad, (g, px, py, W, H) => paintPanelFrame(g, px, py, W, H, opts));
  }

  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    drawPanelFrame(x, y, w, h, opts);
    let contentY = y + (opts.pad !== undefined ? opts.pad : 8);
    if (opts.title) {
      const hh = opts.headerH || 34;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let titleX = x + 12;
      if (opts.icon) {
        drawSprite(opts.icon, titleX + 10, y + hh / 2 + 1, 20);
        titleX += 26;
      }
      const rightW = opts.titleRight ? Math.min(w * 0.42, 170) : 0;
      const closeW = opts.closeId ? 30 : 0;
      fitText(opts.title, titleX, y + hh / 2 + 1, x + w - 12 - rightW - closeW - titleX, opts.titlePx || 17, { weight: 'bold', color: accent });
      if (opts.titleRight) {
        ctx.textAlign = 'right';
        fitText(opts.titleRight, x + w - 12 - closeW, y + hh / 2 + 1, rightW - 8, 13, { weight: 'bold', color: opts.titleRightColor || UI.textDim });
      }
      contentY = y + hh + 8;
    }
    ctx.restore();
    if (opts.closeId)
      NS.drawCloseButton(opts.closeId, x + w - 32, y + 6, 24, opts.onClose);
    return contentY;
  }

  /* Rounded meter with a glossy fill and an optional centred label */
  function drawMeter(x, y, w, h, ratio, color, opts) {
    opts = opts || {};
    ratio = Math.max(0, Math.min(1, ratio));
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
      if (opts.shine) {
        const sx = x + ((G.uiTime * 90) % (w + 60)) - 30;
        const sg = ctx.createLinearGradient(sx - 20, 0, sx + 20, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x, y, w * ratio, h);
      }
      ctx.restore();
    }
    if (opts.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.78), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
    }
    ctx.restore();
  }

  /* Rounded pill with centred text; returns its width */
  function drawChip(text, x, y, h, opts) {
    opts = opts || {};
    const px = opts.px || Math.round(h * 0.62);
    ctx.font = uiFont(px, opts.weight || 'bold');
    const w = Math.min(opts.maxW || 1e9, Math.ceil(measureIconText(text)) + h * 0.8);
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

  /* Keycap hints ("[S] Sell") centred on cx and scaled to stay within maxW */
  function drawKeyHints(hints, cx, cy, maxW, scale) {
    const k = scale || 1;
    const keyPx = 11 * k, labelPx = 12 * k, keyH = 18 * k, gap = 14 * k;
    const parts = hints.map(h => {
      ctx.font = uiFont(keyPx, 'bold');
      const kw = Math.max(keyH, ctx.measureText(h.key).width + 10 * k);
      ctx.font = uiFont(labelPx);
      return { key: h.key, label: h.label, kw, lw: ctx.measureText(h.label).width };
    });
    let total = -gap;
    for (const p of parts)
      total += p.kw + 5 * k + p.lw + gap;
    const s = Math.min(1, maxW / Math.max(1, total));
    ctx.save();
    ctx.translate(cx - total * s / 2, cy);
    ctx.scale(s, s);
    let x = 0;
    for (const p of parts) {
      roundRectPath(x, -keyH / 2, p.kw, keyH, 4 * k);
      ctx.fillStyle = 'rgba(20,26,42,0.9)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(170,190,230,0.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 3, keyH / 2 - 3, p.kw - 6, 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = uiFont(keyPx, 'bold');
      ctx.fillStyle = '#dfe6f5';
      ctx.fillText(p.key, x + p.kw / 2, 1);
      ctx.textAlign = 'left';
      ctx.font = uiFont(labelPx);
      ctx.fillStyle = 'rgba(200,210,230,0.78)';
      ctx.fillText(p.label, x + p.kw + 5 * k, 1);
      x += p.kw + 5 * k + p.lw + gap;
    }
    ctx.restore();
  }

  /* Large glowing headline (title, pause and celebration banners) */
  function drawHeadline(text, x, y, maxW, px, color, glow) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const l = layoutLine(text, maxW, px, Math.round(px * 0.5), 'bold');
    ctx.font = uiFont(l.size, 'bold');
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, l.size / 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(l.text, x, y + 3);
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 20;
    const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, glow || color);
    ctx.fillStyle = g;
    ctx.fillText(l.text, x, y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /* Dims the whole screen and darkens the corners */
  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(0, 0, G.UW, G.UH);
    if (!vignetteCanvas) {
      vignetteCanvas = document.createElement('canvas');
      vignetteCanvas.width = 160;
      vignetteCanvas.height = 100;
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(80, 50, 20, 80, 50, 95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      v.fillStyle = g;
      v.fillRect(0, 0, 160, 100);
    }
    ctx.drawImage(vignetteCanvas, 0, 0, G.UW, G.UH);
  }

  Object.assign(NS, { UI, parseHex, hexToRgba, roundRectPath, drawBaked, rrPath, drawPanel, drawMeter,
    drawChip, drawKeyHints, drawHeadline, drawScrim });

})();
