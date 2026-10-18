;(function() {
  'use strict';

  // Drawing the chest minigames, chests in the mine and the chest pointers.
  // Owns: NS.chestArt
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, rules, chests, artifacts, gadgetArt,
  //   bombArt
  // Reads state of: gameState, chests

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_HIGHLIGHT_COLORS, TILE_ICONS } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { SPRITE_OUTLINE, drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawMeter, drawHeadline, drawScrim } = NS.panels;
  const { RESOURCE_TILES } = NS.rules;
  const { CHEST_RETRY, MINIGAME_NAMES, revealChest, circuitMask, circuitPowered, RUNE_COLORS, minigameLayout,
    runeSpots, circuitGeom } = NS.chests;

  // Rune glyph: a few strokes inside a unit circle
  const RUNE_GLYPHS = [
    [[0, -0.7, 0, 0.7], [0, -0.1, 0.5, -0.6], [0, 0.2, -0.5, -0.3]],
    [[-0.5, -0.6, 0.5, -0.6], [0.5, -0.6, -0.4, 0.7], [-0.3, 0, 0.4, 0]],
    [[-0.55, 0.6, 0, -0.65], [0, -0.65, 0.55, 0.6], [-0.3, 0.1, 0.3, 0.1]],
    [[-0.5, -0.6, -0.5, 0.6], [0.5, -0.6, 0.5, 0.6], [-0.5, -0.6, 0.5, 0.6]],
    [[0, -0.7, 0, 0.7], [-0.55, -0.3, 0.55, -0.3], [-0.55, 0.3, 0.55, 0.3]],
    [[-0.5, -0.5, 0.5, 0.5], [0.5, -0.5, -0.5, 0.5], [0, -0.7, 0, -0.35], [0, 0.35, 0, 0.7]]
  ];

  function drawRune(k, x, y, r, lit, hover) {
    const col = RUNE_COLORS[k];
    ctx.save();
    if (lit) drawGlow(col, x, y, r * 2.2, 0.9);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, lit ? '#ffffff' : hexToRgba(col, hover ? 0.5 : 0.32));
    g.addColorStop(1, lit ? col : 'rgba(20,24,40,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = lit ? 4 : 2.5;
    ctx.strokeStyle = lit ? '#ffffff' : hexToRgba(col, hover ? 1 : 0.7);
    ctx.stroke();
    ctx.strokeStyle = lit ? '#2a1030' : col;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of RUNE_GLYPHS[k]) {
      ctx.moveTo(x + x0 * r * 0.6, y + y0 * r * 0.6);
      ctx.lineTo(x + x1 * r * 0.6, y + y1 * r * 0.6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPipeTile(m, r, c, x, y, cell, powered, hover, focus) {
    ctx.save();
    roundRectPath(x + 3, y + 3, cell - 6, cell - 6, 9);
    ctx.fillStyle = hover ? 'rgba(60,70,100,0.95)' : 'rgba(26,30,48,0.95)';
    ctx.fill();
    ctx.lineWidth = focus ? 3 : 1;
    ctx.strokeStyle = focus ? UI.gold : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    const mask = circuitMask(m, r, c);
    const cx = x + cell / 2, cy = y + cell / 2, L = cell / 2 - 3;
    const segs = [];
    if (mask & 1) segs.push([0, -L]);
    if (mask & 2) segs.push([L, 0]);
    if (mask & 4) segs.push([0, L]);
    if (mask & 8) segs.push([-L, 0]);
    ctx.lineCap = 'round';
    for (const [wdt, col] of powered ? [[cell * 0.26, 'rgba(90,220,255,0.35)'], [cell * 0.13, '#8af0ff']] : [[cell * 0.18, '#0a0c16'], [cell * 0.11, '#5a6688']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      for (const [dx, dy] of segs) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
      }
      ctx.stroke();
    }
    if (powered) {
      // Current flowing along the pipes
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -G.animTime * 40;
      ctx.beginPath();
      for (const [dx, dy] of segs) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + dx, cy + dy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = powered ? '#c8f8ff' : '#3a4460';
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.1, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  function drawMinigame() {
    const m = G.minigame;
    if (!m) return;
    drawScrim(0.7);
    const L = minigameLayout();
    const shake = m.shake > 0 ? Math.sin(G.animTime * 70) * 8 * m.shake : 0;
    ctx.save();
    ctx.translate(shake, 0);
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#c890ff', radius: 16, title: `[[chest]] Secret Chest: ${MINIGAME_NAMES[m.kind]}`, titlePx: 26, headerH: 64, top: 'rgba(28,24,48,0.98)', bottom: 'rgba(12,10,24,0.98)', glow: true });
    if (m.phase === 'play')
      NS.bombArt.drawSmallButton({ x: L.x + L.w - 54, y: L.y + 12, w: 40, h: 40 }, '×', true, false, '#8aa8d8', 22);
    // Difficulty pips and depth
    const pips = 1 + Math.round(m.diff * 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    fitText(`Depth ${m.chest.r} m`, L.x + L.w - 70, L.y + 33, 140, 15, { color: UI.textDim });
    for (let i = 0; i < 5; ++i) {
      ctx.fillStyle = i < pips ? '#e0a0ff' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(L.x + L.w - 300 + i * 18, L.y + 33, 6, 0, TWO_PI);
      ctx.fill();
    }
    // Timer
    const left = Math.max(0, m.limit - m.t);
    drawMeter(L.x + 30, L.y + 80, L.w - 60, 12, left / m.limit, left < 8 ? '#ff6a5a' : '#c890ff', { track: 'rgba(0,0,0,0.6)' });
    ctx.textAlign = 'right';
    fitText(`${Math.ceil(left)} s`, L.x + L.w - 30, L.y + 101, 80, 14, { weight: 'bold', color: left < 8 ? '#ff8a7a' : UI.textDim });
    ctx.textAlign = 'left';
    const hintY = L.y + 101;
    ctx.save();
    if (m.phase !== 'play')
      ctx.globalAlpha *= 0.3;
    if (m.kind === 'lock') drawLockGame(m, L);
    else if (m.kind === 'circuit') drawCircuitGame(m, L);
    else drawRuneGame(m, L);
    ctx.restore();
    if (m.msg && m.phase === 'play') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.msg.t * 3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(m.msg.text, L.cx, L.y + 140 - (1.2 - m.msg.t) * 12, 420, 24, { weight: 'bold', color: m.msg.color, outline: 'rgba(0,0,0,0.8)' });
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const hint = { lock: 'Press when the needle crosses the gold zone', circuit: 'Rotate tiles until power reaches the lock', runes: 'Watch the runes, then repeat them in order' }[m.kind];
    fitText(hint, L.x + 30, hintY, L.w - 160, 15, { color: UI.text });
    // Result
    if (m.phase !== 'play') {
      const k = Math.min(1, m.endT / 0.3);
      ctx.save();
      ctx.globalAlpha = k;
      roundRectPath(L.x + 60, L.y + 190, L.w - 120, 300, 16);
      ctx.fillStyle = 'rgba(8,8,18,0.97)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.phase === 'won' ? UI.gold : '#ff7a6a';
      ctx.stroke();
      if (m.phase === 'won') {
        drawHeadline('UNLOCKED!', L.cx, L.y + 240, L.w - 200, 46, '#ffe080', '#e0a020');
        const r = m.reward;
        if (r.artifact)
          NS.artifacts.drawArtifactIcon(r.artifact, L.cx, L.y + 322, 92);
        else
          drawSprite(r.icon, L.cx, L.y + 325, 72);
        ctx.textAlign = 'center';
        fitText(r.title, L.cx, L.y + 395, L.w - 180, 24, { weight: 'bold', color: r.color });
        drawTextBlock(r.text, L.x + 100, L.y + 412, L.w - 200, 52, 17, { align: 'center', valign: 'middle', color: UI.text, minPx: 12 });
      } else {
        drawHeadline('LOCKED', L.cx, L.y + 250, L.w - 200, 46, '#ff8a7a', '#c01818');
        drawSprite('lock', L.cx, L.y + 330, 64);
        ctx.textAlign = 'center';
        fitText(m.why, L.cx, L.y + 400, L.w - 180, 22, { weight: 'bold', color: UI.text });
        fitText(`Try again in ${CHEST_RETRY} s`, L.cx, L.y + 438, L.w - 180, 17, { color: UI.textDim });
      }
      ctx.restore();
    }
    const keys = m.phase !== 'play' ? [{ key: 'Click', label: 'Continue' }, { key: 'Enter', label: 'Continue' }]
      : m.kind === 'lock' ? [{ key: 'Space', label: 'Set pin' }, { key: 'Click', label: 'Set pin' }, { key: 'Esc', label: 'Give up' }]
      : m.kind === 'circuit' ? [{ key: 'Click', label: 'Rotate' }, { key: 'Right click', label: 'Back' }, { key: '←↑→↓', label: 'Select' }, { key: 'Space', label: 'Rotate' }, { key: 'Esc', label: 'Give up' }]
      : [{ key: '1-6', label: 'Rune' }, { key: 'Click', label: 'Rune' }, { key: 'Esc', label: 'Give up' }];
    NS.gadgetArt.drawKeyHints(keys, L.cx, L.y + L.h - 30, L.w - 80);
    ctx.restore();
  }

  function drawLives(m, L, icon) {
    for (let i = 0; i < 3; ++i)
      drawSprite(icon, L.x + L.w - 50 - i * 34, L.y + 140, 28, i < m.lives ? 1 : 0.2);
  }

  function drawLockGame(m, L) {
    const cx = L.cx, cy = L.bodyY + 230, R = 165;
    drawLives(m, L, 'wrench');
    // Ring track with tick marks
    ctx.save();
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200,170,255,0.25)';
    for (let i = 0; i < 48; ++i) {
      const a = i * TWO_PI / 48, l = i % 4 ? 6 : 12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 13), cy + Math.sin(a) * (R - 13));
      ctx.lineTo(cx + Math.cos(a) * (R - 13 - l), cy + Math.sin(a) * (R - 13 - l));
      ctx.stroke();
    }
    // Gold zone (perfect core is brighter)
    ctx.shadowColor = UI.gold;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 22;
    ctx.strokeStyle = 'rgba(255,200,80,0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, m.target - m.hw, m.target + m.hw);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#fff2b0';
    ctx.beginPath();
    ctx.arc(cx, cy, R, m.target - m.hw * 0.35, m.target + m.hw * 0.35);
    ctx.stroke();
    // Lock body with keyhole
    const flashCol = m.flash > 0 ? (m.flashOk ? `rgba(120,255,150,${m.flash * 0.6})` : `rgba(255,90,80,${m.flash * 0.6})`) : null;
    const g = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110);
    g.addColorStop(0, '#5a4a7a');
    g.addColorStop(1, '#1a1428');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c8a0ff';
    ctx.stroke();
    if (flashCol) {
      ctx.fillStyle = flashCol;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = '#0a0612';
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 18, 0, TWO_PI);
    ctx.fill();
    ctx.fillRect(cx - 8, cy - 8, 16, 40);
    // Needle
    const nx = cx + Math.cos(m.angle) * (R + 6), ny = cy + Math.sin(m.angle) * (R + 6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(m.angle) * 100, cy + Math.sin(m.angle) * 100);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    drawGlow('#ffffff', nx, ny, 22, 0.9);
    ctx.fillStyle = '#ffe8ff';
    ctx.beginPath();
    ctx.arc(nx, ny, 9, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    // Pins
    const pw = 34, gap = 14, total = m.total * pw + (m.total - 1) * gap;
    for (let i = 0; i < m.total; ++i) {
      const px = cx - total / 2 + i * (pw + gap), py = cy + R + 44;
      roundRectPath(px, py, pw, 46, 7);
      ctx.fillStyle = i < m.set ? 'rgba(255,215,90,0.85)' : 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = i < m.set ? '#fff2b0' : 'rgba(200,170,255,0.35)';
      ctx.stroke();
      ctx.fillStyle = i < m.set ? '#5a3a08' : 'rgba(200,170,255,0.4)';
      ctx.fillRect(px + pw / 2 - 3, py + (i < m.set ? 8 : 20), 6, 18);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`Pins ${m.set} / ${m.total}`, cx, cy + R + 108, 300, 18, { weight: 'bold', color: UI.text });
  }

  function drawCircuitGame(m, L) {
    const g = circuitGeom(m);
    const pw = circuitPowered(m);
    for (let r = 0; r < m.n; ++r)
      for (let c = 0; c < m.n; ++c) {
        const hover = m.hover && m.hover.r === r && m.hover.c === c;
        drawPipeTile(m, r, c, g.gx + c * g.cell, g.gy + r * g.cell, g.cell, pw.on.has(r * m.n + c), hover, m.cur.r === r && m.cur.c === c);
      }
    // Battery on the left, lock on the right
    const by = g.gy + m.src * g.cell + g.cell / 2, sy = g.gy + m.snk * g.cell + g.cell / 2;
    ctx.save();
    ctx.strokeStyle = '#8af0ff';
    ctx.lineWidth = g.cell * 0.13;
    ctx.beginPath();
    ctx.moveTo(g.gx - 40, by);
    ctx.lineTo(g.gx + 3, by);
    ctx.stroke();
    ctx.strokeStyle = pw.done ? '#8af0ff' : '#5a6688';
    ctx.beginPath();
    ctx.moveTo(g.gx + g.cell * m.n - 3, sy);
    ctx.lineTo(g.gx + g.cell * m.n + 40, sy);
    ctx.stroke();
    ctx.restore();
    drawGlow('#8af0ff', g.gx - 60, by, 50, 0.6 + Math.sin(G.animTime * 5) * 0.2);
    drawSprite('bolt', g.gx - 62, by, 44);
    drawGlow(pw.done ? '#ffe080' : '#c890ff', g.gx + g.cell * m.n + 64, sy, 50, 0.5);
    drawSprite('chest', g.gx + g.cell * m.n + 64, sy, 48);
    drawSprite('lock', g.gx + g.cell * m.n + 64, sy - 34, 22, pw.done ? 0.3 : 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`${pw.on.size} of ${m.n * m.n} tiles powered`, L.cx, g.gy + g.cell * m.n + 26, 400, 16, { color: UI.textDim });
  }

  function drawRuneGame(m, L) {
    drawLives(m, L, 'heart');
    const cx = L.cx, cy = L.bodyY + L.bodyH / 2 + 6;
    // Centre emblem: round and progress
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
    g.addColorStop(0, m.flash > 0 ? (m.flashOk ? 'rgba(120,255,160,0.6)' : 'rgba(255,90,80,0.6)') : 'rgba(80,60,120,0.6)');
    g.addColorStop(1, 'rgba(20,16,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(m.show ? 'Watch…' : 'Your turn', cx, cy - 22, 150, 22, { weight: 'bold', color: m.show ? '#e0c8ff' : UI.gold });
    fitText(`Round ${m.round - 2} of ${m.len - 2}`, cx, cy + 6, 150, 15, { color: UI.textDim });
    // Dots for the sequence entered so far
    for (let i = 0; i < m.round; ++i) {
      ctx.fillStyle = i < m.input ? UI.gold : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx - (m.round - 1) * 9 + i * 18, cy + 34, 5, 0, TWO_PI);
      ctx.fill();
    }
    for (const sp of runeSpots()) {
      drawRune(sp.i, sp.x, sp.y, sp.r, m.lit === sp.i, m.hover === sp.i && !m.show);
      if (m.phase !== 'play') continue;
      ctx.textAlign = 'center';
      fitText(String(sp.i + 1), sp.x + sp.r * 0.78, sp.y + sp.r * 0.78, 24, 14, { weight: 'bold', color: UI.textDim, outline: 'rgba(0,0,0,0.8)' });
    }
  }

  // Sunstone Lamp ore glow and Dowsing Rod arrows
  function drawUndergroundArtifacts() {
    if (NS.artifacts.hasArtifact('sunLamp')) {
      const R = 5;
      for (let r = Math.max(0, G.drillY - R); r <= Math.min(GRID_ROWS - 1, G.drillY + R); ++r)
        for (let c = Math.max(0, G.drillX - R); c <= Math.min(GRID_COLS - 1, G.drillX + R); ++c) {
          const t = G.undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(t) || Math.abs(r - G.drillY) + Math.abs(c - G.drillX) > R) continue;
          const x = c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, y = r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
          drawGlow(TILE_HIGHLIGHT_COLORS[t] || '#fff', x, y, TILE_SIZE * 0.75, 0.35 + Math.sin(G.animTime * 2 + r + c) * 0.1);
          drawSprite(TILE_ICONS[t], x, y, 24, 0.85);
        }
    }
    if (NS.artifacts.hasArtifact('dowsingRod'))
      for (const ch of G.chests)
        if (!ch.opened && !ch.revealed)
          drawPointer(ch.r, ch.c, 2.2, '#e0a0ff', 'artDowsing');
  }

  // Secret chests in the rock: hidden ones barely glint, found ones glow
  function drawChests() {
    for (const ch of G.chests) {
      if (ch.opened) continue;
      const x = ch.c * TILE_SIZE - G.cameraX, y = ch.r * TILE_SIZE - G.cameraY;
      if (x < -TILE_SIZE || x > CANVAS_W || y < -TILE_SIZE || y > CANVAS_H) continue;
      if (!ch.revealed) {
        if (Math.sin(G.animTime * 0.9 + ch.c) > 0.985)
          particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#f0d8ff', speed: 0.4 });
        continue;
      }
      const pulse = Math.sin(G.animTime * 3 + ch.c) * 0.5 + 0.5;
      const cx = x + TILE_SIZE / 2, cy = y + TILE_SIZE / 2;
      drawGlow(ch.cooldown > 0 ? '#ff7060' : '#d890ff', cx, cy, TILE_SIZE * (1.1 + pulse * 0.3), 0.55);
      drawGlow('#ffe080', cx, cy, TILE_SIZE * 0.7, 0.3 + pulse * 0.2);
      drawSprite('chest', cx, cy + Math.sin(G.animTime * 2 + ch.r) * 1.5, 34);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (ch.cooldown > 0) {
        drawSprite('lock', cx, cy - 30, 18);
        fitText(`${Math.ceil(ch.cooldown)} s`, cx, cy + 28, 60, 14, { weight: 'bold', color: '#ffb0a8', outline: 'rgba(0,0,0,0.85)' });
      } else
        fitText('!', cx, cy - 30 + Math.sin(G.animTime * 5) * 3, 30, 22, { weight: 'bold', color: '#ffe8a0', outline: 'rgba(60,20,80,0.9)' });
      if (Math.random() < 0.04)
        particles.sparkle(x + Math.random() * TILE_SIZE, y + Math.random() * TILE_SIZE, 1, { color: '#ffe0ff', speed: 0.6 });
    }
  }

  // Scanners sense the nearest hidden chest: an arrow points the way
  function drawChestHints(scanRange) {
    if (!scanRange) return;
    let best = null, bestD = Infinity;
    for (const ch of G.chests) {
      if (ch.opened || ch.revealed) continue;
      const d = Math.abs(ch.r - G.drillY) + Math.abs(ch.c - G.drillX);
      if (d <= scanRange) {
        revealChest(ch, true);
        continue;
      }
      if (d < bestD) {
        bestD = d;
        best = ch;
      }
    }
    if (!best || bestD > scanRange * 8) return;
    drawPointer(best.r, best.c, scanRange, '#e0a0ff', 'chest');
  }

  // Arrow at the edge of the scanner ring that points to a tile
  function drawPointer(r, c, scanRange, color, icon) {
    const px = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, py = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
    const a = Math.atan2(r - G.drillY, c - G.drillX);
    const rr = (scanRange + 0.8) * TILE_SIZE;
    const ax = px + Math.cos(a) * rr, ay = py + Math.sin(a) * rr;
    const pulse = 0.5 + Math.sin(G.animTime * 5) * 0.4;
    drawGlow(color, ax, ay, 34, pulse * 0.8);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hexToRgba(color, 0.55 + pulse * 0.45);
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-9, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawSprite(icon, ax - Math.cos(a) * 34, ay - Math.sin(a) * 34, 24, 0.6 + pulse * 0.4);
  }

  NS.chestArt = { drawMinigame, drawUndergroundArtifacts, drawChests, drawChestHints };
})();
