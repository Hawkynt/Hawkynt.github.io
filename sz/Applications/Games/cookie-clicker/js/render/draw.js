/* The canvas scene: the big cookie with chips and scoring arcs, the scrollable
   buildings panel, the upgrade grid, the stats header and the tooltip box. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, CANVAS_H, BLDG_PANEL_X, BLDG_PANEL_W, BLDG_ROW_H, BLDG_ROW_TOTAL, BLDG_HEADER_H, BLDG_VISIBLE_H, COOKIE_CX, COOKIE_CY, COOKIE_R } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const ctx = NS.dom.ctx;
  function drawCookie() {
    ctx.save();
    ctx.translate(COOKIE_CX, COOKIE_CY);
    ctx.scale(S.cookieScale, S.cookieScale);

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20 + Math.sin(Date.now() / 500) * 5;

    const bodyGrad = ctx.createRadialGradient(-25, -25, COOKIE_R * 0.15, 0, 0, COOKIE_R);
    bodyGrad.addColorStop(0, '#daa520');
    bodyGrad.addColorStop(0.7, '#c68e17');
    bodyGrad.addColorStop(1, '#8b6914');
    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139,105,20,0.3)';
    ctx.lineWidth = 1;
    const scoringRadii = [35, 55, 72, 88];
    for (const sr of scoringRadii) {
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }

    const chipPositions = [
      [-30, -40], [20, -30], [-10, 10], [40, 20], [-40, 30], [15, -60], [-20, 50]
    ];
    for (let i = 0; i < chipPositions.length; ++i) {
      const [cx, cy] = chipPositions[i];

      ctx.save();
      ctx.translate(cx, cy + 1.5);
      ctx.fillStyle = 'rgba(30,15,0,0.35)';
      ctx.beginPath();
      if (i % 2 === 0)
        ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
      else
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#4a2800';
      ctx.beginPath();
      if (i % 2 === 0)
        ctx.ellipse(cx, cy, 10, 7, 0, 0, Math.PI * 2);
      else
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-10, -10, COOKIE_R * 0.7, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,65,10,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R - 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,130,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
  /* ── Scrollable Buildings Panel ── */
  function getMaxBuildingScroll() {
    const contentH = BUILDING_DEFS.length * BLDG_ROW_TOTAL;
    return Math.max(0, contentH - BLDG_VISIBLE_H);
  }

  function drawBuildingsPanel() {
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const panelTop = 10;
    const panelH = CANVAS_H - 20;
    const contentTop = panelTop + BLDG_HEADER_H;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, panelTop, panelW, panelH);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Buildings', panelX + 10, panelTop + 20);

    // Scroll indicators
    const maxScroll = getMaxBuildingScroll();
    if (maxScroll > 0) {
      ctx.fillStyle = '#888';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      if (S.buildingScrollOffset > 0)
        ctx.fillText('\u25B2 scroll up', panelX + panelW - 10, panelTop + 16);
      if (S.buildingScrollOffset < maxScroll)
        ctx.fillText('\u25BC scroll down', panelX + panelW - 10, panelTop + 28);
      ctx.textAlign = 'left';
    }

    // Clip to content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, contentTop, panelW, BLDG_VISIBLE_H);
    ctx.clip();

    for (let i = 0; i < BUILDING_DEFS.length; ++i) {
      const def = BUILDING_DEFS[i];
      const y = contentTop + i * BLDG_ROW_TOTAL - S.buildingScrollOffset;

      if (y + BLDG_ROW_H < contentTop || y > contentTop + BLDG_VISIBLE_H)
        continue;

      const cost = NS.economy.buildingCost(def);
      const canAfford = S.cookies >= cost;

      // Purchase glow
      if (S.purchaseGlowIndex === i && S.purchaseGlowTimer > 0) {
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 30 * S.purchaseGlowTimer;
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(panelX + 5, y, panelW - 10, BLDG_ROW_H);
        ctx.restore();
      }

      // Row background
      const rowGrad = ctx.createLinearGradient(panelX + 5, 0, panelX + panelW - 5, 0);
      if (canAfford) {
        rowGrad.addColorStop(0, 'rgba(80,180,80,0.2)');
        rowGrad.addColorStop(0.5, 'rgba(100,200,100,0.12)');
        rowGrad.addColorStop(1, 'rgba(80,180,80,0.05)');
      } else {
        rowGrad.addColorStop(0, 'rgba(60,60,60,0.35)');
        rowGrad.addColorStop(0.5, 'rgba(50,50,50,0.25)');
        rowGrad.addColorStop(1, 'rgba(40,40,40,0.15)');
      }
      ctx.fillStyle = rowGrad;
      ctx.fillRect(panelX + 5, y, panelW - 10, BLDG_ROW_H);

      // Emoji
      ctx.save();
      if (canAfford) {
        const pulse = 4 + Math.sin(Date.now() / 600) * 3;
        ctx.shadowColor = 'rgba(100,255,100,0.6)';
        ctx.shadowBlur = pulse;
      }
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(def.emoji, panelX + 10, y + 20);
      ctx.restore();

      // Name + cost + per-unit CPS
      ctx.font = '11px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name, panelX + 36, y + 14);

      ctx.fillStyle = canAfford ? '#ccc' : '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('Cost: ' + NS.format.formatNumber(cost), panelX + 36, y + 26);

      // Show each building's CPS contribution
      const unitCPS = NS.economy.getBuildingCPSPerUnit(def);
      ctx.fillStyle = '#7ec8e3';
      ctx.font = '9px sans-serif';
      ctx.fillText('each: ' + NS.format.formatCPS(unitCPS) + ' CPS', panelX + 36, y + 38);

      if (S.buildings[def.id] > 0) {
        const totalBldgCPS = NS.economy.getBuildingTotalCPS(def);
        ctx.fillText('total: ' + NS.format.formatCPS(totalBldgCPS) + ' CPS', panelX + 140, y + 38);
      }

      // Owned count
      ctx.fillStyle = '#7ec8e3';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(S.buildings[def.id].toString(), panelX + panelW - 12, y + 22);
      ctx.textAlign = 'left';
    }

    ctx.restore(); // unclip
  }
  function drawUpgradesPanel() {
    const panelX = 10;
    const panelY = 420;
    const panelW = 400;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, panelY, panelW, CANVAS_H - panelY - 10);

    ctx.fillStyle = '#c8a0ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Upgrades', panelX + 10, panelY + 16);

    const ownedCounts = NS.economy.getOwnedCounts();
    let drawn = 0;
    for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
      const def = UPGRADE_DEFS[i];
      if (S.upgradePurchased[def.id])
        continue;
      if (!def.condition(ownedCounts))
        continue;
      const x = panelX + 10 + (drawn % 3) * 130;
      const y = panelY + 30 + Math.floor(drawn / 3) * 55;
      const canAfford = S.cookies >= def.cost;

      ctx.fillStyle = canAfford ? 'rgba(200,160,255,0.2)' : 'rgba(50,50,50,0.3)';
      ctx.fillRect(x, y, 120, 48);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name.substring(0, 18), x + 4, y + 14);
      ctx.fillText(NS.format.formatNumber(def.cost), x + 4, y + 28);
      ctx.fillStyle = '#aaa';
      ctx.fillText('x' + def.multiplier + ' ' + def.target, x + 4, y + 42);
      ++drawn;
    }
  }
  function drawStats() {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(NS.format.formatNumber(S.displayCookies) + ' cookies', COOKIE_CX, 50);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('per second: ' + NS.format.formatNumber(S.cps), COOKIE_CX, 72);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#8ac';
    ctx.fillText('per click: ' + NS.format.formatNumber(S.clickValue), COOKIE_CX, 88);

    if (S.heavenlyChips > 0) {
      ctx.fillStyle = '#c8a0ff';
      ctx.font = '12px sans-serif';
      ctx.fillText('\u{2728} ' + S.heavenlyChips + ' heavenly chips (+' + S.heavenlyChips + '% CPS)', COOKIE_CX, 104);
    }

    ctx.textAlign = 'left';
  }
  /* ── Tooltip Drawing ── */
  function drawTooltip() {
    if (!S.tooltip || !S.tooltip.lines.length)
      return;

    ctx.save();
    ctx.font = '11px sans-serif';

    const padding = 8;
    const lineH = 15;
    let maxW = 0;
    for (const line of S.tooltip.lines) {
      const t = typeof line === 'object' ? (line.text != null ? String(line.text) : '') : String(line);
      const w = ctx.measureText(t).width;
      if (w > maxW)
        maxW = w;
    }
    const boxW = maxW + padding * 2;
    const boxH = S.tooltip.lines.length * lineH + padding * 2;

    // Position: prefer left of mouse, offset enough to avoid blocking clicks
    let tx = S.tooltip.x - boxW - 20;
    let ty = S.tooltip.y - boxH / 2;
    if (tx < 5)
      tx = S.tooltip.x + 24;
    if (ty < 5)
      ty = 5;
    if (ty + boxH > CANVAS_H - 5)
      ty = CANVAS_H - 5 - boxH;

    // Background
    ctx.fillStyle = 'rgba(15,15,30,0.92)';
    ctx.strokeStyle = 'rgba(200,200,255,0.4)';
    ctx.lineWidth = 1;
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(tx + r, ty);
    ctx.lineTo(tx + boxW - r, ty);
    ctx.arcTo(tx + boxW, ty, tx + boxW, ty + r, r);
    ctx.lineTo(tx + boxW, ty + boxH - r);
    ctx.arcTo(tx + boxW, ty + boxH, tx + boxW - r, ty + boxH, r);
    ctx.lineTo(tx + r, ty + boxH);
    ctx.arcTo(tx, ty + boxH, tx, ty + boxH - r, r);
    ctx.lineTo(tx, ty + r);
    ctx.arcTo(tx, ty, tx + r, ty, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text lines
    for (let i = 0; i < S.tooltip.lines.length; ++i) {
      const line = S.tooltip.lines[i];
      const text = typeof line === 'object' ? (line.text != null ? String(line.text) : '') : String(line);
      const color = (typeof line === 'object' ? line.color : null) || '#ddd';
      ctx.fillStyle = color;
      ctx.font = line.bold ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(text, tx + padding, ty + padding + (i + 1) * lineH - 3);
    }

    ctx.restore();
  }

  Object.assign(NS.draw, { getMaxBuildingScroll, drawCookie, drawBuildingsPanel,
    drawUpgradesPanel, drawStats, drawTooltip });
})();
