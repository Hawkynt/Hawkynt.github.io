;(function() {
  'use strict';

  // Drawing bombs, blasts, the throw preview and the bomb bar.
  // Owns: NS.bombArt and these state fields:
  //   G.bombBarHover
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, hudFading, rules, bombs, craftDialog
  // Reads state of: gameState, bombs

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, VIEW_UNDERGROUND, STATE_PLAYING, TILE_SIZE } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText } = NS.textLayout;
  const { UI, roundRectPath, drawPanel } = NS.panels;
  const { beginHudPanel, endHudPanel } = NS.hudFading;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { BOMB_TIERS, bombCount, bombCapacity, bombRadius, bombThrowRange, cycleBomb, readyBombTier,
    noBombsHint, placeBomb, throwTarget, remoteDetonate } = NS.bombs;

  /* ======================================================================
     DRAWING -- BOMBS
     ====================================================================== */

  // Bombs lying in the mine (or still flying there) with their burning fuses
  function drawPlacedBombs() {
    const ox = Math.round(G.cameraX), oy = Math.round(G.cameraY);
    for (const b of G.placedBombs) {
      const T = BOMB_TIERS[b.tier];
      const size = 26 + b.tier * 3;
      let x = b.c * TILE_SIZE + TILE_SIZE / 2 - ox;
      let y = b.r * TILE_SIZE + TILE_SIZE / 2 - oy + (b.sticky ? 0 : TILE_SIZE / 2 - size * 0.45);
      let spin = 0;
      if (b.fly) {
        const k = b.fly.t;
        x = b.fly.x - ox + (x - (b.fly.x - ox)) * k;
        y = b.fly.y - oy + (y - (b.fly.y - oy)) * k - Math.sin(k * Math.PI) * 34;
        spin = k * TWO_PI * 1.5;
      }
      if (x < -60 || x > CANVAS_W + 60 || y < -60 || y > CANVAS_H + 60) continue;
      if (!b.fly) {
        const k = Math.max(0, b.fuse / b.maxFuse);
        const blink = Math.sin(G.animTime * (8 + (1 - k) * 34)) > 0;
        drawGlow(blink ? '#ff4030' : T.color, x, y, 34 + b.tier * 8, blink ? 0.75 : 0.45);
        // Fuse ring empties as the bomb counts down
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.72, 0, TWO_PI);
        ctx.stroke();
        ctx.strokeStyle = k < 0.35 ? '#ff5040' : '#ffd060';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.72, -Math.PI / 2, -Math.PI / 2 + TWO_PI * k);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      drawSprite(T.icon, 0, 0, size);
      ctx.restore();
      if (!b.fly) {
        if (Math.random() < 0.5)
          particles.trail(x + size * 0.25, y - size * 0.45, { vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), color: Math.random() < 0.5 ? '#ffe080' : '#ff7030', life: 0.25, size: 1.5, gravity: 0.03 });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(String(Math.max(1, Math.ceil(b.fuse))), x, y - size * 0.72 - 14, 40, 20, { weight: 'bold', color: b.fuse < 1 ? '#ff7060' : '#fff0c0', outline: 'rgba(0,0,0,0.85)' });
      }
    }
  }

  // Bombs arcing from the turret to the battlefield
  function drawSurfaceBombs() {
    for (const s of G.surfaceBombs) {
      const k = s.t;
      const x = s.x0 + (s.tx - s.x0) * k;
      const y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * (90 + Math.abs(s.tx - s.x0) * 0.25);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * TWO_PI * 2);
      drawSprite(BOMB_TIERS[s.tier].icon, 0, 0, 28 + s.tier * 3);
      ctx.restore();
      if (Math.random() < 0.6)
        particles.trail(x, y, { vx: (Math.random() - 0.5), vy: -0.5, color: '#ffb060', life: 0.3, size: 2 });
      // Where it will land
      ctx.strokeStyle = `rgba(255,140,80,${0.35 + Math.sin(G.animTime * 12) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.tx, Math.min(DOME_Y + 4, s.ty + 8), 26, 8, 0, 0, TWO_PI);
      ctx.stroke();
    }
  }

  // Fireballs, shock rings and smoke of explosions (in the mine or on the surface)
  function drawBlasts(under) {
    for (const b of G.blasts) {
      if (b.under !== under) continue;
      const x = under ? b.x - G.cameraX : b.x, y = under ? b.y - G.cameraY : b.y;
      if (x < -b.R * 2 || x > CANVAS_W + b.R * 2 || y < -b.R * 2 || y > CANVAS_H + b.R * 2) continue;
      const k = b.t / b.life;
      const ease = 1 - Math.pow(1 - k, 3);
      const color = BOMB_TIERS[b.tier] ? BOMB_TIERS[b.tier].color : '#ffb040';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Fireball
      const fr = b.R * (0.35 + ease * 0.75);
      const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
      g.addColorStop(0, `rgba(255,250,220,${0.95 * (1 - k)})`);
      g.addColorStop(0.35, hexToRgba(color, 0.85 * (1 - k)));
      g.addColorStop(0.75, `rgba(200,70,20,${0.4 * (1 - k)})`);
      g.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, fr, 0, TWO_PI);
      ctx.fill();
      // Shock ring
      ctx.strokeStyle = b.tier === 4 ? `rgba(200,150,255,${0.8 * (1 - k)})` : `rgba(255,230,180,${0.75 * (1 - k)})`;
      ctx.lineWidth = Math.max(1, 9 * (1 - k));
      ctx.beginPath();
      ctx.arc(x, y, b.R * (0.25 + ease), 0, TWO_PI);
      ctx.stroke();
      // Void bombs pull light inwards before they burst
      if (b.tier === 4) {
        ctx.strokeStyle = `rgba(150,90,255,${0.7 * (1 - k)})`;
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; ++i) {
          ctx.beginPath();
          ctx.arc(x, y, b.R * (1.2 - ease) * (0.5 + i * 0.25), 0, TWO_PI);
          ctx.stroke();
        }
      }
      ctx.restore();
      // Smoke left behind
      if (k > 0.3) {
        ctx.fillStyle = `rgba(40,34,30,${0.35 * (1 - k)})`;
        for (let i = 0; i < 6; ++i) {
          const a = i * 1.05 + b.x * 0.01;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * b.R * 0.45 * ease, y + Math.sin(a) * b.R * 0.35 * ease - k * 20, b.R * 0.22 * (0.6 + ease * 0.5), 0, TWO_PI);
          ctx.fill();
        }
      }
      // White flash of the first instant
      if (k < 0.18) {
        ctx.fillStyle = `rgba(255,255,240,${0.6 * (1 - k / 0.18)})`;
        ctx.beginPath();
        ctx.arc(x, y, b.R * 0.5, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  // Aim preview while throw mode is armed
  function drawThrowPreview() {
    if (!G.bombThrowMode || G.mouseAimX < 0) return;
    const tier = readyBombTier();
    if (tier < 0) return;
    if (G.currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((G.mouseAimX + G.cameraX) / TILE_SIZE);
      const row = Math.floor((G.mouseAimY + G.cameraY) / TILE_SIZE);
      const t = throwTarget(col, row);
      const px = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, py = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,190,110,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, (bombThrowRange() + 0.5) * TILE_SIZE, 0, TWO_PI);
      ctx.stroke();
      const tx = col * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = row * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      ctx.strokeStyle = t.ok ? 'rgba(140,255,160,0.85)' : 'rgba(255,110,100,0.85)';
      ctx.lineDashOffset = -G.animTime * 30;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo((px + tx) / 2, Math.min(py, ty) - 40, tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      roundRectPath(col * TILE_SIZE + 3 - G.cameraX, row * TILE_SIZE + 3 - G.cameraY, TILE_SIZE - 6, TILE_SIZE - 6, 6);
      ctx.stroke();
      if (t.ok) {
        // Blast radius around the target
        ctx.strokeStyle = 'rgba(255,170,90,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, (bombRadius(tier) + 0.4) * TILE_SIZE, 0, TWO_PI);
        ctx.stroke();
        drawSprite(BOMB_TIERS[tier].icon, tx, ty, 26, 0.7);
      }
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(t.ok ? 'Click to throw' : t.why, tx, ty - TILE_SIZE, 260, 16, { weight: 'bold', color: t.ok ? '#c8ffd0' : '#ffb0a8', outline: 'rgba(0,0,0,0.85)' });
    } else {
      const tx = G.mouseAimX, ty = Math.min(DOME_Y - 8, G.mouseAimY);
      const R = 70 + 26 * bombRadius(tier);
      ctx.save();
      ctx.strokeStyle = `rgba(255,150,80,${0.55 + Math.sin(G.animTime * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -G.animTime * 30;
      ctx.beginPath();
      ctx.arc(tx, ty, R, 0, TWO_PI);
      ctx.stroke();
      const x0 = DOME_X + Math.cos(G.turretAngle) * (DOME_RADIUS + 30), y0 = DOME_Y + Math.sin(G.turretAngle) * (DOME_RADIUS + 30);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + tx) / 2, Math.min(y0, ty) - 90 - Math.abs(tx - x0) * 0.25, tx, ty);
      ctx.stroke();
      ctx.restore();
      drawSprite(BOMB_TIERS[tier].icon, tx, ty, 26, 0.75);
    }
  }

  // Bomb stock (bottom right): one slot per size, craft button and actions
  function bombBarLayout() {
    const w = 336, h = 128, x = CANVAS_W - 16 - w, y = CANVAS_H - 50 - h;
    const slots = BOMB_TIERS.map((T, i) => ({ x: x + 12 + i * 63, y: y + 40, w: 58, h: 50, tier: i }));
    const bw = Math.floor((w - 24 - 12) / 3);
    const under = G.currentView === VIEW_UNDERGROUND;
    const buttons = [
      { id: 'drop', label: 'Drop', key: 'B', x: x + 12, y: y + 98, w: bw, h: 24, enabled: under },
      { id: 'throw', label: 'Throw', key: under ? 'T' : 'T/B', x: x + 18 + bw, y: y + 98, w: bw, h: 24, enabled: true },
      G.unlockedTools.remoteDetonator && G.placedBombs.some(b => !b.fly)
        ? { id: 'detonate', label: 'Detonate', key: 'X', x: x + 24 + bw * 2, y: y + 98, w: bw, h: 24, enabled: true }
        : { id: 'next', label: 'Next', key: 'Q', x: x + 24 + bw * 2, y: y + 98, w: bw, h: 24, enabled: true }
    ];
    return { x, y, w, h, slots, buttons, craft: { x: x + w - 12 - 104, y: y + 9, w: 104, h: 24 } };
  }

  function inRect(mx, my, r) {
    return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
  }

  function hitBombBar(mx, my) {
    if (G.state !== STATE_PLAYING) return null;
    const L = bombBarLayout();
    if (!inRect(mx, my, L)) return null;
    if (inRect(mx, my, L.craft)) return { kind: 'craft' };
    for (const s of L.slots)
      if (inRect(mx, my, s)) return { kind: 'slot', tier: s.tier };
    for (const b of L.buttons)
      if (inRect(mx, my, b)) return { kind: b.id, enabled: b.enabled };
    return { kind: 'panel' };
  }

  function useBombBar(hit) {
    if (hit.kind === 'craft') NS.craftDialog.openCraftDialog();
    else if (hit.kind === 'slot') {
      G.bombSel = hit.tier;
      SZ.GameAudio.play('blip', { pitch: 1 + hit.tier * 0.1, volume: 0.6 });
    } else if (hit.kind === 'drop' && hit.enabled) placeBomb();
    else if (hit.kind === 'throw') {
      if (readyBombTier() < 0) return noBombsHint();
      G.bombThrowMode = !G.bombThrowMode;
      SZ.GameAudio.play('select', { pitch: G.bombThrowMode ? 1.2 : 0.8 });
    } else if (hit.kind === 'next') cycleBomb(1);
    else if (hit.kind === 'detonate') remoteDetonate();
  }

  // Small framed button used by the bomb bar and the workshop
  function drawSmallButton(b, label, enabled, hover, color, px) {
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, Math.min(9, b.h / 2));
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (enabled) {
      g.addColorStop(0, hexToRgba(color, hover ? 0.42 : 0.26));
      g.addColorStop(1, hexToRgba(color, hover ? 0.24 : 0.1));
    } else {
      g.addColorStop(0, 'rgba(40,44,60,0.7)');
      g.addColorStop(1, 'rgba(24,26,36,0.7)');
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hover && enabled ? 2 : 1;
    ctx.strokeStyle = enabled ? hexToRgba(color, hover ? 1 : 0.7) : 'rgba(120,130,160,0.35)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 12, px || 15, { weight: 'bold', color: enabled ? '#ffffff' : UI.textMute });
    ctx.restore();
  }

  G.bombBarHover = null;

  function drawBombBar() {
    const L = bombBarLayout();
    beginHudPanel('bombs', L.x, L.y, L.w, L.h);
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#ff9a40', shadow: 10 });
    drawSprite('bomb', L.x + 24, L.y + 21, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const tw = fitText('Bombs', L.x + 42, L.y + 22, 80, 18, { weight: 'bold', color: UI.text });
    const full = bombCount() >= bombCapacity();
    fitText(`${bombCount()} / ${bombCapacity()}`, L.x + 50 + tw, L.y + 22, L.craft.x - L.x - 58 - tw, 15, { weight: 'bold', color: full ? UI.warn : UI.textDim });
    const hk = G.bombBarHover && G.bombBarHover.kind;
    drawSmallButton(L.craft, 'Craft  [C]', true, hk === 'craft', '#ff9a40', 14);
    for (const s of L.slots) {
      const n = G.bombInv[s.tier];
      const sel = G.bombSel === s.tier;
      const hover = hk === 'slot' && G.bombBarHover.tier === s.tier;
      roundRectPath(s.x, s.y, s.w, s.h, 8);
      ctx.fillStyle = sel ? 'rgba(255,190,90,0.2)' : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)');
      ctx.fill();
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeStyle = sel ? UI.gold : 'rgba(255,255,255,0.12)';
      ctx.stroke();
      if (sel && G.bombThrowMode) {
        ctx.save();
        ctx.shadowColor = '#ff9a40';
        ctx.shadowBlur = 10 + Math.sin(G.animTime * 8) * 5;
        ctx.stroke();
        ctx.restore();
      }
      drawSprite(BOMB_TIERS[s.tier].icon, s.x + s.w / 2, s.y + 21, 30, n > 0 ? 1 : 0.3);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      fitText(String(n), s.x + s.w - 6, s.y + s.h - 9, s.w - 10, 14, { weight: 'bold', color: n > 0 ? '#ffffff' : UI.textMute, outline: 'rgba(0,0,0,0.8)' });
    }
    for (const b of L.buttons) {
      const active = b.id === 'throw' && G.bombThrowMode;
      drawSmallButton(b, `${active ? 'Aiming…' : b.label}  [${b.key}]`, b.enabled, hk === b.id || active, b.id === 'throw' || b.id === 'detonate' ? '#ff7a50' : '#8aa8d8', 13);
    }
    endHudPanel();
  }

  NS.bombArt = { drawPlacedBombs, drawSurfaceBombs, drawBlasts, drawThrowPreview, inRect, hitBombBar,
    useBombBar, drawSmallButton, drawBombBar };
})();
