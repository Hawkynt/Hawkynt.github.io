;(function() {
  'use strict';

  // One frame style for every box on screen: panels, meters, chips, buttons, headlines, scrim.
  // Owns: NS.panels
  // Reads: constants, util, dom, sprites, textLayout

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const { CANVAS_W, CANVAS_H } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx } = NS.dom;
  const { measureIconText } = NS.sprites;
  const { uiFont, layoutLine, fitText } = NS.textLayout;

  /* ======================================================================
     UI PANELS -- one frame style for every box on screen
     ====================================================================== */

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

  // Framed panel: drop shadow, vertical gradient, dark edge, light inner rim,
  // accent strip and an optional title header. Returns the content top y.
  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius !== undefined ? opts.radius : 10;
    const accent = opts.accent || UI.accent;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    if (!opts.flat) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = opts.shadow !== undefined ? opts.shadow : 18;
      ctx.shadowOffsetY = 4;
    }
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opts.top || UI.panelTop);
    g.addColorStop(1, opts.bottom || UI.panelBottom);
    roundRectPath(x, y, w, h, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = UI.edge;
    ctx.stroke();
    roundRectPath(x + 1.5, y + 1.5, w - 3, h - 3, r - 1.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.glow ? hexToRgba(accent, 0.75) : UI.rim;
    ctx.stroke();
    if (opts.glow) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      roundRectPath(x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(accent, 0.6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // Accent strip along the top edge
    const sg = ctx.createLinearGradient(x, 0, x + w, 0);
    sg.addColorStop(0, hexToRgba(accent, 0));
    sg.addColorStop(0.5, hexToRgba(accent, 0.9));
    sg.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(x + r, y + 1, w - r * 2, 2);
    let contentY = y + (opts.pad !== undefined ? opts.pad : 10);
    if (opts.title) {
      const hh = opts.headerH || 40;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x + 2, y + 3, w - 4, hh - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 10, y + hh, w - 20, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 10, y + hh + 1, w - 20, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleX = x + 14;
      const rightW = opts.titleRight ? Math.min(w * 0.45, 180) : 0;
      fitText(opts.title, titleX, y + hh / 2 + 1, w - 28 - rightW, opts.titlePx || 20, { weight: 'bold', color: accent });
      if (opts.titleRight) {
        ctx.textAlign = 'right';
        fitText(opts.titleRight, x + w - 14, y + hh / 2 + 1, rightW - 8, 15, { color: opts.titleRightColor || UI.textDim });
      }
      contentY = y + hh + 8;
    }
    ctx.restore();
    return contentY;
  }

  // Horizontal meter with a rounded track and a glossy fill
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
      ctx.restore();
    }
    if (opts.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, x + w / 2, y + h / 2 + 1, w - 8, opts.labelPx || Math.round(h * 0.72), { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.75)' });
    }
    ctx.restore();
  }

  // Rounded pill / chip with centred text; returns its width
  function drawChip(text, x, y, h, opts) {
    opts = opts || {};
    const px = opts.px || Math.round(h * 0.62);
    ctx.font = uiFont(px, opts.weight || 'bold');
    const w = Math.min(opts.maxW || 1e9, Math.ceil(measureIconText(text)) + h * 0.8);
    const x0 = opts.align === 'right' ? x - w : x;
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

  // Button with gradient face, used by the title and dialogs
  function drawButton(b, primary, hover) {
    ctx.save();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (primary) {
      g.addColorStop(0, hover ? '#4aa0ff' : '#3a86e0');
      g.addColorStop(1, hover ? '#2a64c0' : '#1f4c98');
    } else {
      g.addColorStop(0, hover ? '#3a4560' : '#2a3248');
      g.addColorStop(1, hover ? '#232a3e' : '#181d2c');
    }
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    roundRectPath(b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = primary ? (hover ? '#bfe0ff' : '#7ab8ff') : (hover ? '#8a9ac0' : '#4a5676');
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRectPath(b.x + 3, b.y + 3, b.w - 6, b.h * 0.42, 9);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 24, 26, { weight: 'bold', color: primary ? '#fff' : '#d0d8ea' });
    ctx.restore();
  }

  // Large glowing headline (title screens and overlays)
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
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, y - l.size / 2, 0, y + l.size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, glow || color);
    ctx.fillStyle = g;
    ctx.fillText(l.text, x, y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Dim the whole screen and darken the corners
  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!vignetteCanvas) {
      vignetteCanvas = document.createElement('canvas');
      vignetteCanvas.width = CANVAS_W / 4;
      vignetteCanvas.height = CANVAS_H / 4;
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(CANVAS_W / 8, CANVAS_H / 8, CANVAS_H / 16, CANVAS_W / 8, CANVAS_H / 8, CANVAS_W / 6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.7)');
      v.fillStyle = g;
      v.fillRect(0, 0, CANVAS_W / 4, CANVAS_H / 4);
    }
    ctx.drawImage(vignetteCanvas, 0, 0, CANVAS_W, CANVAS_H);
  }

  NS.panels = { UI, roundRectPath, drawPanel, drawMeter, drawChip, drawButton, drawHeadline, drawScrim };
})();
