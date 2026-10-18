/* ui/inspector.js -- stats, targeting, upgrade paths and selling of the selected tower.
   Reads: constants, towerTypes, env, pixelArt, layout, text, widgets, research, towerArt, towers and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, MAX_TIER, BRANCH_TIER, STATE_PLAYING, STATE_BUILD, TOP_H, BOT_H, hexToRgba } = NS.constants;
  const { TOWER_TYPES, TARGET_MODES, TARGET_LABELS, TARGET_DESC } = NS.towerTypes;
  const { ctx, audio } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { worldToUi } = NS.layout;
  const { uiFont, fitText, drawTextBlock, toRoman } = NS.text;
  const { UI, roundRectPath, drawPanel, drawMeter, drawChip, drawKeycap, addRegion, pressAmount, uiButton,
      beginHudPanel, endHudPanel } = NS.widgets;
  const { masteryUnlocked } = NS.research;
  const { drawTowerIcon } = NS.towerArt;
  const { computeStats, towerStats, towerName, getUpgradeCost, upgradeTower, getSellValue, sellTower,
      repairCost, repairTower } = NS.towers;

  /* ══════════════════════════════════════════════════════════════════
     INSPECTOR -- stats and actions of the selected tower
     ══════════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════════
     INSPECTOR -- stats, targeting, upgrade paths and sell of the
     selected tower
     ══════════════════════════════════════════════════════════════════ */

  const INSPECT_W = 252;

  function fmt(v) {
    return v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  }

  // Damage per second against a single unarmored target (rough guide)
  function towerDps(s) {
    switch (s.kind) {
      case 'beam': return s.damage * (s.ramp + 1) / 2;
      case 'trap': return s.damage;
      case 'mine': return 0;
      case 'support': return 0;
      case 'gust': return s.damage / s.reload;
      case 'skybolt': return s.damage * (s.bolts || 1) / s.reload;
      case 'orb': return (s.damage + s.maxHpDmg * 400) / s.reload;
      case 'glob': return s.damage / s.reload + s.cloudDps;
      case 'flame': return s.damage / s.reload + s.burn;
      default: return s.damage * (s.crit ? 1 + s.crit * (s.critMul - 1) : 1) / Math.max(0.05, s.reload);
    }
  }

  // Short feature list of a stat block
  function towerSpecials(s) {
    const out = [];
    if (s.kind === 'mine') {
      out.push(`+${s.income} gold per wave`);
      if (s.interest) out.push(`${Math.round(s.interest * 100)}% interest (max ${s.interestCap})`);
      if (s.bounty) out.push(`+${s.bounty} gold per kill nearby`);
      return out;
    }
    if (s.kind === 'support') {
      out.push(`+${Math.round(s.buffDmg * 100)}% damage nearby`);
      out.push(`+${Math.round(s.buffRate * 100)}% fire rate nearby`);
      if (s.reveal) out.push('Spots stealth nearby');
      return out;
    }
    if (s.salvo) out.push(`${s.salvo} shells`);
    if (s.minRange) out.push(`Blind within ${fmt(s.minRange)} tiles`);
    if (s.bolts) out.push(`${s.bolts} bolts`);
    if (s.push) out.push(`Pushes back ${fmt(s.push / CELL)} tiles`);
    if (s.airBonus) out.push(`×${fmt(s.airBonus)} vs flyers`);
    if (s.maxHpDmg) out.push(`${fmt(s.maxHpDmg * 100)}% max health`);
    if (s.bounces) out.push(`Bounces ×${s.bounces}`);
    if (s.kind === 'orb') out.push('Ignores armor & shields');
    if (s.splash) out.push(`Splash ${fmt(s.splash)} tiles`);
    if (s.bomblets) out.push(`${s.bomblets} bomblets`);
    if (s.shred) out.push(`Shreds ${s.shred} armor`);
    if (s.multishot) out.push(`${s.multishot} targets`);
    if (s.slow) out.push(`Slows ${Math.round(s.slow * 100)}%`);
    if (s.freeze) out.push(`${Math.round(s.freeze * 100)}% freeze`);
    if (s.aura) out.push('Hits all in range');
    if (s.chains) out.push(`Chains ×${s.chains}`);
    if (s.stun) out.push(`Stuns ${fmt(s.stun)}s`);
    if (s.burn) out.push(`Burns ${fmt(s.burn)}/s`);
    if (s.melt) out.push(`Melts ${s.melt} armor`);
    if (s.lava) out.push('Burning ground');
    if (s.cloudDps) out.push(`Cloud ${fmt(s.cloudDps)}/s`);
    if (s.acid) out.push('Acid: +25% damage taken');
    if (s.plague) out.push('Spreads on death');
    if (s.beams) out.push(`${s.beams} beams`);
    if (s.ramp && s.kind === 'beam') out.push(`Heats up to ×${fmt(s.ramp)}`);
    if (s.crit) out.push(`${Math.round(s.crit * 100)}% crit ×${fmt(s.critMul)}`);
    if (s.execute) out.push(`Executes below ${Math.round(s.execute * 100)}%`);
    if (s.rail) out.push('Pierces the line');
    if (s.pierce && !s.rail) out.push(`Ignores ${Math.round(s.pierce * 100)}% armor`);
    if (s.trueSight) out.push('Spots stealth');
    if (s.hits === 'ground') out.push('Ground only');
    return out;
  }

  function hitsLabel(s) {
    return s.hits === 'both' ? 'Ground & air' : s.hits === 'ground' ? 'Ground only' : s.hits === 'air' ? 'Air only' : '—';
  }

  function buildTooltip(i) {
    const def = TOWER_TYPES[i];
    const s = computeStats(def, 1, -1);
    const lines = [def.name, def.desc];
    lines.push('--- Stats ---');
    if (s.kind === 'mine')
      lines.push(`[[coin]] +${s.income} gold after every wave`);
    else if (s.kind === 'support')
      lines.push(`[[up]] +${Math.round(s.buffDmg * 100)}% damage, +${Math.round(s.buffRate * 100)}% fire rate within ${fmt(s.range)} tiles`);
    else if (s.kind === 'trap')
      lines.push(`[[sword]] ${fmt(s.damage)} damage per second on its tile`);
    else
      lines.push(`[[sword]] ${fmt(towerDps(s))} dps   [[range]] ${fmt(s.range)} tiles   ${hitsLabel(s)}`);
    const sp = towerSpecials(s).filter(x => x !== 'Ground only');
    if (sp.length) lines.push('• ' + sp.join(' · '));
    lines.push(`✔ Strong vs: ${def.strong}`);
    lines.push(`⚠ Weak vs: ${def.weak}`);
    lines.push('--- Specializations at tier IV ---');
    lines.push(`• ${def.branches[0].name} / ${def.branches[1].name}`);
    lines.push(G.gold >= def.cost ? `★ ${def.cost} gold` : `✘ ${def.cost} gold (need ${def.cost - G.gold} more)`);
    return lines;
  }

  function inspectorLayout(t) {
    const s = towerStats(t);
    const attacks = s.kind !== 'mine' && s.kind !== 'trap' && s.kind !== 'support';
    let h = 34 + 76 + 30;                         // header, portrait/stats, specials
    if (attacks) h += 30;                         // targeting
    h += t.tier === 3 ? 122 : 44;                 // upgrade area
    if (t.hp < t.maxHp) h += 22;
    h += 38;                                      // sell / repair
    return { attacks, h };
  }

  function inspectorRect() {
    const t = G.selectedTower;
    const L = inspectorLayout(t);
    // Use the side of the screen away from the tower
    const p = worldToUi(t.x, t.y);
    const left = p.x > G.UW * 0.55;
    return { x: left ? 8 : G.UW - 8 - INSPECT_W, y: TOP_H + 4, w: INSPECT_W, h: Math.min(L.h, G.UH - TOP_H - BOT_H - 8), L };
  }

  function drawInspector() {
    const t = G.selectedTower;
    if (!t || (G.state !== STATE_BUILD && G.state !== STATE_PLAYING)) return;
    const def = TOWER_TYPES[t.type];
    const s = towerStats(t);
    const r = inspectorRect();
    addRegion({ id: 'inspector-bg', x: r.x, y: r.y, w: r.w, h: r.h });
    beginHudPanel('inspector', r.x, r.y, r.w, r.h);
    let y = drawPanel(r.x, r.y, r.w, r.h, { title: towerName(t), titleRight: 'Tier ' + toRoman(t.tier), titleRightPad: 24, accent: t.branch >= 0 ? def.color : UI.gold });
    uiButton('insp-close', r.x + r.w - 26, r.y + 6, 20, 18, '×', { px: 13, onClick: () => { G.selectedTower = null; }, tip: () => ['Close', 'Esc'] });

    // Portrait with tier pips
    const px = r.x + 10, pw = 64;
    roundRectPath(px, y, pw, pw, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(def.color, 0.45);
    ctx.stroke();
    drawTowerIcon(t.type, t.tier, px + pw / 2, y + pw / 2, pw - 8, t.branch);
    const pipW = (pw - 8) / MAX_TIER;
    for (let i = 0; i < MAX_TIER; ++i) {
      ctx.fillStyle = i < t.tier ? (i >= 3 ? def.color : UI.gold) : 'rgba(255,255,255,0.15)';
      ctx.fillRect(px + 4 + i * pipW, y + pw + 4, pipW - 2, 4);
    }

    // Stat rows
    const sx = px + pw + 10, sw = r.x + r.w - 10 - sx;
    const rows = towerStatRows(t, s);
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 7 + i * 16;
      ctx.textAlign = 'left';
      drawIcon(rows[i][0], sx + 6, ry, 12);
      fitText(rows[i][1], sx + 16, ry + 1, sw * 0.5 - 16, 11, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(rows[i][2], sx + sw, ry + 1, sw * 0.5, 12, { weight: 'bold', color: rows[i][3] || '#ffffff' });
    }
    y += pw + 12;

    // Specials as chips
    const sp = towerSpecials(s);
    ctx.save();
    roundRectPath(r.x + 8, y - 2, r.w - 16, 26, 6);
    ctx.clip();
    let cx = r.x + 10;
    for (const text of sp) {
      ctx.font = uiFont(10, 'bold');
      const w = Math.min(r.w - 20, ctx.measureText(text).width + 14);
      if (cx + w > r.x + r.w - 10) break;
      drawChip(text, cx, y + 2, 18, { px: 10, bg: hexToRgba(def.color, 0.16), border: hexToRgba(def.color, 0.4), color: '#e8eef8', maxW: r.w - 20 });
      cx += w + 4;
    }
    ctx.restore();
    y += 30;

    // Targeting
    if (r.L.attacks) {
      const n = TARGET_MODES.length;
      const bw = (r.w - 20 - (n - 1) * 4) / n;
      for (let i = 0; i < n; ++i) {
        const m = TARGET_MODES[i];
        uiButton('insp-target-' + m, r.x + 10 + i * (bw + 4), y, bw, 24, TARGET_LABELS[m], {
          style: t.target === m ? 'blue' : 'dark', px: 11,
          onClick: () => { t.target = m; },
          tip: () => [`Target: ${TARGET_LABELS[m]}`, TARGET_DESC[m], '• T cycles the targeting']
        });
      }
      y += 30;
    }

    // Upgrade paths
    const bw = r.w - 20;
    const uc = getUpgradeCost(t);
    if (t.tier === 4 && !masteryUnlocked(t.type)) {
      uiButton('insp-up', r.x + 10, y, bw, 38, 'Mastery needs research', { style: 'dark', icon: 'lock', sub: `${TOWER_TYPES[t.type].name} Mastery`, disabled: true,
        onDisabled: () => audio.play('error'),
        tip: () => ['Tier V is locked', `Research "${TOWER_TYPES[t.type].name} Mastery" to let this tower reach its final form.`] });
      y += 44;
    } else if (t.tier < 3 || t.tier === 4) {
      const label = t.tier === 4 ? `Master ${towerName(t)}` : `Upgrade to Tier ${toRoman(t.tier + 1)}`;
      uiButton('insp-up', r.x + 10, y, bw, 38, label, {
        style: 'gold', icon: 'up', key: 'U', sub: `${uc} gold`, disabled: G.gold < uc,
        onClick: () => upgradeTower(t), onDisabled: () => audio.play('error'),
        tip: () => upgradeTooltip(t, t.branch)
      });
      y += 44;
    } else if (t.tier === 3) {
      ctx.textAlign = 'left';
      fitText('Choose a specialization', r.x + 12, y + 7, bw, 11, { weight: 'bold', color: UI.gold });
      const cw = (bw - 6) / 2;
      for (let b = 0; b < 2; ++b)
        drawBranchCard(t, b, r.x + 10 + b * (cw + 6), y + 16, cw, 100, uc);
      y += 122;
    } else {
      uiButton('insp-up', r.x + 10, y, bw, 38, 'Fully mastered', { style: 'dark', icon: 'crown', disabled: true });
      y += 44;
    }

    if (t.hp < t.maxHp) {
      const ratio = t.hp / t.maxHp;
      drawMeter(r.x + 12, y + 2, r.w - 24, 12, ratio, ratio > 0.5 ? UI.good : ratio > 0.25 ? UI.warn : UI.bad, { label: `Structure ${Math.ceil(ratio * 100)}%`, labelPx: 9 });
      y += 22;
    }

    const half = (bw - 6) / 2;
    const sv = getSellValue(t);
    uiButton('insp-sell', r.x + 10, y, half, 30, `Sell +${sv}`, { style: 'red', key: 'S', px: 12, onClick: () => sellTower(t),
      tip: () => ['Sell tower', sv === t.spent ? `Full refund of ${sv} gold: it was built during this break.` : `Refunds ${sv} gold (60% of the ${t.spent} spent).`] });
    const rc = repairCost(t);
    uiButton('insp-repair', r.x + 16 + half, y, half, 30, rc > 0 ? `Repair ${rc}` : 'Intact', { style: 'green', key: 'R', px: 12, disabled: rc <= 0 || G.gold < rc,
      onClick: () => repairTower(t), onDisabled: () => rc > 0 && audio.play('error'),
      tip: () => ['Repair', rc > 0 ? `Restores the structure for ${rc} gold.` : 'The tower is undamaged.'] });
    endHudPanel();
  }

  function drawBranchCard(t, b, x, y, w, h, cost) {
    const def = TOWER_TYPES[t.type];
    const br = def.branches[b];
    const id = 'insp-branch' + b;
    const hover = G.hoverId === id;
    const afford = G.gold >= cost;
    const press = pressAmount(id);
    ctx.save();
    roundRectPath(x, y + press * 2, w, h, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hover ? 'rgba(70,60,30,0.95)' : 'rgba(40,46,70,0.95)');
    g.addColorStop(1, 'rgba(14,16,30,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hover ? 2 : 1;
    ctx.strokeStyle = hover ? UI.gold : hexToRgba(def.color, 0.5);
    ctx.stroke();
    if (!afford) ctx.globalAlpha *= 0.6;
    drawTowerIcon(t.type, BRANCH_TIER, x + 20, y + 21 + press * 2, 30, b);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawTextBlock(br.name, x + 38, y + 5 + press * 2, w - 42, 32, 12, { weight: 'bold', color: '#ffffff', valign: 'middle', lineGap: 1.1 });
    drawTextBlock(br.desc, x + 6, y + 40 + press * 2, w - 12, h - 62, 10, { color: '#c4cde0', lineGap: 1.2 });
    ctx.textAlign = 'left';
    fitText(`[[coin]]${cost}`, x + 6, y + h - 11 + press * 2, w - 32, 11, { weight: 'bold', color: afford ? UI.gold : UI.bad });
    drawKeycap(b === 0 ? 'U' : 'I', x + w - 20, y + h - 19 + press * 2, 9);
    ctx.restore();
    addRegion({ id, x, y, w, h, disabled: !afford, onDisabled: () => audio.play('error'),
      onClick: () => upgradeTower(t, b), tip: () => upgradeTooltip(t, b) });
  }

  function towerStatRows(t, s) {
    const rows = [];
    if (s.kind === 'mine') {
      rows.push(['coin', 'Income', `+${s.income}`, UI.gold]);
      if (s.interest) rows.push(['coin', 'Interest', `${Math.round(s.interest * 100)}%`]);
      if (s.bounty) rows.push(['skull', 'Kill bonus', `+${s.bounty}`]);
      return rows;
    }
    if (s.kind === 'support') {
      rows.push(['range', 'Range', fmt(s.range)]);
      rows.push(['sword', 'Damage', `+${Math.round(s.buffDmg * 100)}%`, UI.good]);
      rows.push(['clock', 'Fire rate', `+${Math.round(s.buffRate * 100)}%`, UI.good]);
      rows.push(['up', 'Inspiring', String(G.towers.filter(o => o !== t && towerStats(o).kind !== 'support' && Math.hypot(o.x - t.x, o.y - t.y) <= s.rangePx + 2).length)]);
      return rows;
    }
    rows.push(['sword', s.kind === 'trap' || s.kind === 'beam' ? 'Dmg/sec' : 'Damage', fmt(s.damage) + (s.multishot ? ` ×${s.multishot}` : '')]);
    if (s.kind !== 'trap') {
      rows.push(['range', 'Range', fmt(s.range)]);
      rows.push(['clock', 'Rate', s.kind === 'beam' ? 'beam' : `${fmt(1 / s.reload)}/s`]);
    }
    rows.push(['bolt', 'DPS', fmt(towerDps(s)), UI.warn]);
    rows.push(['skull', 'Kills', String(t.kills || 0)]);
    return rows;
  }

  function upgradeTooltip(t, branch) {
    const def = TOWER_TYPES[t.type];
    const next = t.tier + 1;
    // A hover left over from before the tower reached tier III has no branch yet
    if (t.tier >= MAX_TIER || (next === BRANCH_TIER && branch !== 0 && branch !== 1) || (next > BRANCH_TIER && !def.branches[t.branch]))
      return [towerName(t), next === BRANCH_TIER ? 'Choose one of the two specializations below.' : 'Fully upgraded.'];
    const nb = next >= BRANCH_TIER ? branch : -1;
    const cur = towerStats(t);
    const nxt = computeStats(def, next, nb);
    const uc = getUpgradeCost(t);
    const title = next === BRANCH_TIER ? `Specialize: ${def.branches[branch].name}` : next === 5 ? `Master ${def.branches[t.branch].name}` : `Upgrade to Tier ${toRoman(next)}`;
    const lines = [title];
    if (next === BRANCH_TIER) lines.push(def.branches[branch].desc);
    lines.push('--- Changes ---');
    const cmp = (label, a, b, unit) => {
      if (Math.abs(a - b) > 1e-6)
        lines.push(`${b > a ? '✔' : '•'} ${label} ${fmt(a)}${unit || ''} → ${fmt(b)}${unit || ''}`);
    };
    if (cur.kind === 'support') {
      cmp('Range', cur.range, nxt.range, ' tiles');
      cmp('Damage bonus %', cur.buffDmg * 100, nxt.buffDmg * 100);
      cmp('Rate bonus %', cur.buffRate * 100, nxt.buffRate * 100);
    } else if (cur.kind === 'mine') {
      cmp('Income', cur.income, nxt.income);
    } else {
      cmp('Damage', cur.damage, nxt.damage);
      cmp('Range', cur.range, nxt.range, ' tiles');
      if (cur.kind !== 'beam' && cur.kind !== 'trap') cmp('Shots/sec', 1 / cur.reload, 1 / nxt.reload);
      cmp('DPS', towerDps(cur), towerDps(nxt));
    }
    const before = towerSpecials(cur);
    for (const sp of towerSpecials(nxt))
      if (before.indexOf(sp) < 0)
        lines.push(`★ ${sp}`);
    lines.push(G.gold >= uc ? `✔ ${uc} gold` : `✘ ${uc} gold (need ${uc - G.gold} more)`);
    return lines;
  }

  NS.inspector = { buildTooltip, drawInspector };

})();
