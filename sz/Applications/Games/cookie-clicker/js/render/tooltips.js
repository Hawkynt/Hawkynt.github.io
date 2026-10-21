/* Tooltip content and hover hit-testing: what a building or upgrade would change
   if bought, and which row, slot or cookie the mouse is over. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { BLDG_PANEL_X, BLDG_PANEL_W, BLDG_HEADER_H, BLDG_VISIBLE_H, BLDG_ROW_TOTAL, BLDG_ROW_H, COOKIE_CX, COOKIE_CY, COOKIE_R, CANVAS_H } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  /* ── Build tooltip for a hovered building ── */
  function buildBuildingTooltip(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    const cost = NS.economy.buildingCost(def);
    const unitCPS = NS.economy.getBuildingCPSPerUnit(def);
    const newCPS = NS.economy.getCPSAfterBuyingBuilding(defIndex);
    const cpsDelta = newCPS - S.cps;
    const efficiency = cpsDelta > 0 ? cost / cpsDelta : Infinity;

    const lines = [
      { text: def.emoji + ' ' + def.name, color: '#ffd700', bold: true },
      { text: def.desc, color: '#bbb' },
      { text: '' },
      { text: 'Owned: ' + S.buildings[def.id], color: '#7ec8e3' },
      { text: 'Each produces: ' + NS.format.formatCPS(unitCPS) + ' CPS', color: '#8f8' },
      { text: 'Cost: ' + NS.format.formatNumber(cost) + ' cookies', color: S.cookies >= cost ? '#6f6' : '#f66' },
      { text: '' },
      { text: '--- If you buy one ---', color: '#aaa' },
      { text: 'CPS: ' + NS.format.formatCPS(S.cps) + ' -> ' + NS.format.formatCPS(newCPS), color: '#8ff' },
      { text: 'CPS increase: +' + NS.format.formatCPS(cpsDelta), color: '#5f5' }
    ];

    if (efficiency !== Infinity && cpsDelta > 0)
      lines.push({ text: 'Cost per CPS: ' + NS.format.formatNumber(efficiency), color: '#fc8' });

    return lines;
  }
  /* ── Build tooltip for a hovered upgrade ── */
  function buildUpgradeTooltip(defIndex) {
    const def = UPGRADE_DEFS[defIndex];
    const newCPS = NS.economy.getCPSAfterBuyingUpgrade(def);
    const cpsDelta = newCPS - S.cps;

    const lines = [
      { text: def.name, color: '#c8a0ff', bold: true },
      { text: def.desc, color: '#bbb' },
      { text: '' },
      { text: 'Cost: ' + NS.format.formatNumber(def.cost) + ' cookies', color: S.cookies >= def.cost ? '#6f6' : '#f66' },
      { text: 'Affects: ' + def.target, color: '#aaa' },
      { text: 'Multiplier: x' + def.multiplier, color: '#fc8' }
    ];

    if (def.target === 'click') {
      const newClick = NS.economy.getClickValueAfterUpgrade(def);
      lines.push({ text: '' });
      lines.push({ text: '--- If you buy this ---', color: '#aaa' });
      lines.push({ text: 'Click: ' + NS.format.formatCPS(S.clickValue) + ' -> ' + NS.format.formatCPS(newClick), color: '#8ff' });
    } else {
      lines.push({ text: '' });
      lines.push({ text: '--- If you buy this ---', color: '#aaa' });
      lines.push({ text: 'CPS: ' + NS.format.formatCPS(S.cps) + ' -> ' + NS.format.formatCPS(newCPS), color: '#8ff' });
      if (cpsDelta > 0)
        lines.push({ text: 'CPS increase: +' + NS.format.formatCPS(cpsDelta), color: '#5f5' });
    }

    if (def.target !== 'click' && def.target !== 'global' && cpsDelta > 0) {
      const efficiency = def.cost / cpsDelta;
      lines.push({ text: 'Cost per CPS: ' + NS.format.formatNumber(efficiency), color: '#fc8' });
    }

    return lines;
  }
  /* ── Hover detection ── */
  function updateTooltipFromMouse(mx, my) {
    S.tooltip = null;

    // Check buildings panel hover
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (mx >= panelX && mx <= panelX + panelW && my >= contentTop && my <= contentTop + BLDG_VISIBLE_H) {
      for (let i = 0; i < BUILDING_DEFS.length; ++i) {
        const y = contentTop + i * BLDG_ROW_TOTAL - S.buildingScrollOffset;
        if (y + BLDG_ROW_H < contentTop || y > contentTop + BLDG_VISIBLE_H)
          continue;
        if (my >= y && my <= y + BLDG_ROW_H) {
          S.tooltip = { lines: buildBuildingTooltip(i), x: mx, y: my };
          return;
        }
      }
    }

    // Check upgrades panel hover
    if (mx >= 10 && mx <= 410 && my >= 420) {
      const ownedCounts = NS.economy.getOwnedCounts();
      let drawn = 0;
      for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
        const def = UPGRADE_DEFS[i];
        if (S.upgradePurchased[def.id])
          continue;
        if (!def.condition(ownedCounts))
          continue;
        const ux = 10 + 10 + (drawn % 3) * 130;
        const uy = 420 + 30 + Math.floor(drawn / 3) * 55;
        if (mx >= ux && mx <= ux + 120 && my >= uy && my <= uy + 48) {
          S.tooltip = { lines: buildUpgradeTooltip(i), x: mx, y: my };
          return;
        }
        ++drawn;
      }
    }

    // Check cookie hover
    const cdx = mx - COOKIE_CX;
    const cdy = my - COOKIE_CY;
    if (cdx * cdx + cdy * cdy <= COOKIE_R * COOKIE_R) {
      S.tooltip = {
        lines: [
          { text: 'Big Cookie', color: '#ffd700', bold: true },
          { text: 'Click to earn cookies!', color: '#bbb' },
          { text: '' },
          { text: 'Per click: ' + NS.format.formatCPS(S.clickValue) + ' cookies', color: '#8f8' },
          { text: 'Total clicks: ' + NS.format.formatNumber(S.totalClicks), color: '#aaa' }
        ],
        x: mx, y: my
      };
    }
  }

  Object.assign(NS.tooltips, { buildBuildingTooltip, buildUpgradeTooltip, updateTooltipFromMouse });
})();
