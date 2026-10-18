/* ui/widgets.js -- panels, meters, chips, key hints, buttons, hit regions, tooltips and the HUD fade.
   Owns state: G.regions, G.prevRegions, G.hoverId, G.frameDt, G.frameNo
   Reads: constants, env, pixelArt, layout, text, savegame, mapOverlays and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_PLAYING, STATE_BUILD, clamp, hexToRgba, shade } = NS.constants;
  const { ctx } = NS.env;
  const { makeCanvas, drawIcon } = NS.pixelArt;
  const { view, worldToUi } = NS.layout;
  const { uiFont, measureIconText, fillIconText, layoutLine, fitText, wrapText } = NS.text;

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

  let vignetteCanvas = null;
  function drawScrim(alpha) {
    ctx.fillStyle = `rgba(3,5,12,${alpha})`;
    ctx.fillRect(-20, -20, G.UW + 40, G.UH + 40);
    if (!vignetteCanvas) {
      vignetteCanvas = makeCanvas(160, 120);
      const v = vignetteCanvas.getContext('2d');
      const g = v.createRadialGradient(80, 60, 20, 80, 60, 100);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.75)');
      v.fillStyle = g;
      v.fillRect(0, 0, 160, 120);
    }
    ctx.drawImage(vignetteCanvas, -20, -20, G.UW + 40, G.UH + 40);
  }
  const pointer = { px: -1, py: -1, ux: -1, uy: -1, wx: -1, wy: -1, inside: false, type: 'mouse' };
  const pressFx = {};        // id -> time of the last press (button feedback)

  function addRegion(r) {
    G.regions.push(r);
    return r;
  }

  function regionAt(ux, uy) {
    for (let i = G.prevRegions.length - 1; i >= 0; --i) {
      const r = G.prevRegions[i];
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return r;
    }
    return null;
  }

  function pressAmount(id) {
    const t = pressFx[id];
    if (t === undefined) return 0;
    const k = (performance.now() - t) / 160;
    if (k >= 1) {
      delete pressFx[id];
      return 0;
    }
    return 1 - k;
  }

  const BUTTON_STYLES = {
    gold: ['#ffd75a', '#c9952a', '#3a2606', '#fff1b8'],
    blue: ['#4aa0ff', '#1f4c98', '#ffffff', '#bfe0ff'],
    green: ['#5ccf74', '#21783a', '#ffffff', '#c8ffd2'],
    red: ['#ff6a6a', '#9a2a2a', '#ffffff', '#ffd0d0'],
    dark: ['#2e3852', '#171c2c', '#d0d8ea', '#8a9ac0']
  };

  // Gradient button; registers a click region. opts: style, icon, px, disabled, key, onClick, tip, sub
  function uiButton(id, x, y, w, h, label, opts) {
    opts = opts || {};
    const st = BUTTON_STYLES[opts.style || 'dark'];
    const disabled = !!opts.disabled;
    const hover = G.hoverId === id;
    const press = pressAmount(id);
    ctx.save();
    if (disabled)
      ctx.globalAlpha *= 0.45;
    const dy = press * 2;
    roundRectPath(x + 1, y + 3, w, h, Math.min(8, h / 3));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + h);
    g.addColorStop(0, hover && !disabled ? shade(st[0], 0.18) : st[0]);
    g.addColorStop(1, hover && !disabled ? shade(st[1], 0.12) : st[1]);
    roundRectPath(x, y + dy, w, h, Math.min(8, h / 3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = opts.active ? 2 : 1.5;
    ctx.strokeStyle = opts.active ? UI.gold : (hover && !disabled ? st[3] : UI.edge);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRectPath(x + 2, y + dy + 2, w - 4, h * 0.42, Math.min(6, h / 4));
    ctx.fill();
    if (press > 0) {
      roundRectPath(x - press * 4, y + dy - press * 4, w + press * 8, h + press * 8, 10);
      ctx.strokeStyle = `rgba(255,240,180,${press * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const px = opts.px || Math.min(15, Math.round(h * 0.42));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let keyW = 0;
    if (opts.key && w > 70) {
      const kpx = Math.max(8, px - 3);
      ctx.font = uiFont(kpx, 'bold');
      const kw = Math.max(kpx + 4, ctx.measureText(opts.key).width + 6);
      drawKeycap(opts.key, x + w - 6 - kw, y + dy + (h - kpx - 5) / 2, kpx);
      keyW = kw + 6;
    }
    const iconW = opts.icon ? px * 1.3 : 0;
    const avail = w - 12 - keyW - iconW;
    const cy = y + dy + (opts.sub ? h * 0.38 : h / 2) + 1;
    const lw = label ? layoutLine(label, avail, px, Math.max(7, px * 0.6), 'bold').width : 0;
    const startX = x + 6 + (avail + iconW - (lw + iconW)) / 2;
    if (opts.icon)
      drawIcon(opts.icon, startX + iconW / 2 - 1, cy - 0.5, px * 1.15);
    if (label) {
      ctx.textAlign = 'left';
      fitText(label, startX + iconW, cy, avail, px, { weight: 'bold', color: st[2] });
    }
    if (opts.sub) {
      ctx.textAlign = 'center';
      fitText(opts.sub, x + (w - keyW) / 2, y + dy + h * 0.74, w - 12 - keyW, Math.round(px * 0.72), { color: hexToRgba(st[2] === '#ffffff' ? '#ffffff' : st[2], 0.75) });
    }
    ctx.restore();
    addRegion({ id, x, y, w, h, disabled, onClick: opts.onClick, onDisabled: opts.onDisabled, tip: opts.tip, sound: opts.sound });
  }

  /* ── Tooltip ── */
  const tooltip = { id: null, t: 0, lines: null, anchor: null };
  const TOOLTIP_DELAY = 0.25;

  // lines: [title, ...] strings; a leading '✔' / '✘' / '⚠' / '•' colours the line;
  // '--- Header ---' draws a divider
  function drawTooltip() {
    if (!tooltip.lines || tooltip.t < TOOLTIP_DELAY || !pointer.inside) return;
    const lines = tooltip.lines;
    const pad = 10;
    const maxTextW = Math.min(300, G.UW * 0.42);
    let fontSize = 12.5;
    let rows, boxW, boxH;
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 6 });
          continue;
        }
        ctx.font = uiFont(i === 0 ? fontSize + 2 : fontSize, i === 0 ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: i === 0 ? 'title' : 'text', text: w, h: (i === 0 ? fontSize + 2 : fontSize) * 1.38, src: line });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + pad * 2;
      boxH = pad * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= G.UH - 16 || fontSize <= 9)
        break;
      fontSize -= 0.5;
    }
    boxW = Math.max(boxW, 140);
    let bx, by;
    const a = tooltip.anchor;
    if (a) {
      bx = a.x + a.w / 2 - boxW / 2;
      by = a.y - boxH - 8;
      if (by < 8) by = a.y + a.h + 8;
    } else {
      bx = pointer.ux + 18;
      by = pointer.uy + 18;
      if (bx + boxW > G.UW - 8) bx = pointer.ux - boxW - 12;
      if (by + boxH > G.UH - 8) by = pointer.uy - boxH - 12;
    }
    bx = clamp(bx, 8, G.UW - 8 - boxW);
    by = clamp(by, 8, G.UH - 8 - boxH);
    ctx.save();
    drawPanel(bx, by, boxW, boxH, { radius: 8 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + pad;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(8, fontSize - 3), 'bold');
        ctx.fillStyle = UI.gold;
        ctx.globalAlpha = 0.8;
        ctx.fillText(r.text, bx + pad, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,215,90,0.25)';
        ctx.fillRect(bx + pad + tw + 6, cy, boxW - pad * 2 - tw - 6, 1);
        ctx.globalAlpha = 1;
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = '#c4cde0';
        if (title) color = '#ffffff';
        else if (r.src.startsWith('✔')) color = UI.good;
        else if (r.src.startsWith('✘')) color = UI.bad;
        else if (r.src.startsWith('⚠')) color = UI.warn;
        else if (r.src.startsWith('★')) color = UI.gold;
        ctx.fillStyle = color;
        fillIconText(r.text, bx + pad, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  function updateTooltip(dt) {
    let id = null, lines = null, anchor = null;
    if (pointer.inside && !G.overlay) {
      const r = regionAt(pointer.ux, pointer.uy);
      if (r && r.tip) {
        id = r.id;
        try {
          lines = r.tip();
        } catch (_) {
          lines = null;
        }
        anchor = r.anchorTip ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
      } else if (!r && NS.savegame.isInGameState()) {
        const e = NS.mapOverlays.enemyAtPointer();
        if (e) {
          id = 'enemy';
          lines = NS.mapOverlays.enemyTooltip(e);
        }
      }
    }
    if (id !== tooltip.id) {
      tooltip.id = id;
      tooltip.t = 0;
    }
    tooltip.t += dt;
    tooltip.lines = lines;
    tooltip.anchor = anchor;
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD FADE -- panels with an enemy or tower behind them turn see-through
     ══════════════════════════════════════════════════════════════════ */

  const hudFade = {};
  let hudActorCache = null, hudActorFrame = -1;

  function hudActors() {
    if (hudActorFrame === G.frameNo && hudActorCache) return hudActorCache;
    const out = [];
    const k = view.s / G.uiS;
    for (const e of G.enemies) {
      const p = worldToUi(e.x, e.y);
      const r = (e.radius + 6) * k;
      out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
    }
    for (const t of G.towers) {
      const p = worldToUi(t.x, t.y);
      const r = CELL * 0.5 * k;
      out.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, tower: t });
    }
    hudActorCache = out;
    hudActorFrame = G.frameNo;
    return out;
  }

  function overlapsActor(x, y, w, h, skipTower) {
    for (const a of hudActors())
      if (a.tower !== skipTower && a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y)
        return true;
    return false;
  }

  function hudAlpha(id, x, y, w, h, skipTower) {
    const f = hudFade[id] || (hudFade[id] = { a: 1 });
    const mouseInside = pointer.inside && pointer.ux >= x && pointer.ux <= x + w && pointer.uy >= y && pointer.uy <= y + h;
    const live = (G.state === STATE_PLAYING || G.state === STATE_BUILD) && !G.overlay;
    const target = live && !mouseInside && overlapsActor(x, y, w, h, skipTower) ? 0.28 : 1;
    f.a += (target - f.a) * (1 - Math.exp(-G.frameDt * 10));
    f.rect = { x, y, w, h };
    f.frame = G.frameNo;
    return f.a;
  }

  function beginHudPanel(id, x, y, w, h, skipTower) {
    ctx.save();
    ctx.globalAlpha *= hudAlpha(id, x, y, w, h, skipTower);
  }

  function endHudPanel() {
    ctx.restore();
  }

  // A click on a faded panel with a tower behind it goes to the map
  function hudPassThrough(ux, uy) {
    for (const id in hudFade) {
      const f = hudFade[id];
      if (f.frame < G.frameNo - 2 || f.a > 0.6 || !f.rect) continue;
      const r = f.rect;
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return true;
    }
    return false;
  }

  NS.widgets = { UI, roundRectPath, drawPanel, drawMeter, drawChip, drawKeyHints, drawKeycap, drawHeadline,
      drawScrim, pointer, pressFx, addRegion, regionAt, pressAmount, uiButton, drawTooltip, updateTooltip,
      beginHudPanel, endHudPanel, hudPassThrough };

})();
