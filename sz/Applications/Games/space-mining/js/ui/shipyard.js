/* The station's Shipyard and Modules tabs: hull cards (buy once, then fly any you own) with
   their silhouettes and key stats, upgrade cards that level up to 10 with pips, the effect now
   and next and a rising price; the Hardpoints page with the flown hull's hardpoints and the nine
   weapon cards (type, levels, price or unlock, mounting); and the five station module cards
   whose builds appear on the station art at once. Purchases flash, spark and save immediately. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { HULLS, UPGRADES, MODULES } = NS.ships;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const flash = { id: '', t: 0 };

  function celebrate(id, x, y, color) {
    flash.id = id;
    flash.t = G.time;
    NS.fx.sparks(x, y, 0, TAU, 26, color, 320, 0.5);
    NS.fx.ring(x, y, 10, 90, 0.5, color, 5);
    sfx('levelup', { volume: 0.7 });
    NS.save.refreshStats();
    NS.save.writeSave();
    NS.statusBar.update();
  }

  function glowIf(id, x, y, w, h) {
    const k = 1 - (G.time - flash.t) / 0.6;
    if (flash.id !== id || k <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.6;
    ctx.fillStyle = UI.gold;
    kit.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawShipyard(px, py, pw) {
    const save = G.save;
    const hp = G.ui.yardPage === 'hp';
    W.button('yard_hulls', 'Hulls & upgrades', px + pw - 330, py + 8, 160, 28, { px: 12, selected: !hp, action: () => { G.ui.yardPage = 'hulls'; } });
    W.button('yard_hp', 'Hardpoints', px + pw - 164, py + 8, 148, 28, { px: 12, selected: hp, icon: 'turret', action: () => { G.ui.yardPage = 'hp'; } });
    if (hp) { drawHardpoints(px, py, pw); return; }
    kit.text('HULLS', px + 20, py + 22, 13, UI.textMute, { weight: 'bold' });
    const cw = (pw - 50) / 4, ch = 150;
    for (let i = 0; i < HULLS.length; ++i) {
      const h = HULLS[i];
      const x = px + 16 + i * (cw + 6), y = py + 36;
      const owned = save.hulls.indexOf(h.id) >= 0;
      const flying = save.hull === h.id;
      const afford = save.credits >= h.cost;
      const hot = W.area('hull_' + h.id, x, y, cw, ch, () => {
        if (flying) return;
        if (rules.buyHull(save, h.id)) celebrate('hull_' + h.id, x + cw / 2, y + 60, h.colors.trim);
        else sfx('error');
      }, !owned && !afford);
      kit.panel(x, y, cw, ch, { radius: 8, accent: flying ? UI.good : hot ? UI.gold : owned ? UI.accent : UI.textMute, glow: hot || flying, brackets: false });
      glowIf('hull_' + h.id, x, y, cw, ch);
      ctx.globalAlpha = owned || afford ? 1 : 0.55;
      K.blitRot(ctx, NS.shipArt.shipSprite(h.id, h.colors, Math.sin(G.time + i) * 0.3), x + cw / 2, y + 52, -Math.PI / 2, 0.95);
      ctx.globalAlpha = 1;
      kit.text(h.name, x + cw / 2, y + 98, 15, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text('Hold ' + h.cargo + '  Hull ' + h.hull, x + cw / 2, y + 116, 11, UI.textDim, { align: 'center' });
      if (flying) kit.text('FLYING', x + cw / 2, y + 136, 12, UI.good, { align: 'center', weight: 'bold' });
      else if (owned) kit.text('OWNED - select', x + cw / 2, y + 136, 12, UI.accent, { align: 'center', weight: 'bold' });
      else kit.credits(h.cost, x + cw / 2, y + 136, 12, 'center');
    }
    const sel = HULLS.filter(h => h.id === save.hull)[0];
    kit.text(sel.desc, px + 20, py + 202, 12, UI.textDim);

    kit.text('UPGRADES  -  level up to 10, carried over to every hull', px + 20, py + 228, 13, UI.textMute, { weight: 'bold' });
    const uw = (pw - 52) / 3, uh = 112;
    for (let i = 0; i < UPGRADES.length; ++i) {
      const u = UPGRADES[i];
      const x = px + 16 + (i % 3) * (uw + 10), y = py + 244 + Math.floor(i / 3) * (uh + 8);
      upgradeCard(save, u, x, y, uw, uh);
    }
  }

  function upgradeCard(save, u, x, y, w, h) {
    const lvl = save.upgrades[u.id];
    const max = lvl >= u.max;
    const cost = rules.upgradeCost(save, u.id);
    const afford = !max && save.credits >= cost;
    kit.panel(x, y, w, h, { radius: 8, accent: max ? UI.gold : afford ? UI.accent : UI.textMute, brackets: false, alpha: 0.95 });
    glowIf('up_' + u.id, x, y, w, h);
    kit.icon(u.icon, x + 24, y + 24, 26, max ? UI.gold : UI.accent);
    kit.text(u.name, x + 44, y + 18, 14, '#ffffff', { weight: 'bold' });
    kit.text('Lv ' + lvl, x + w - 12, y + 18, 15, max ? UI.gold : UI.text, { align: 'right', weight: 'bold' });
    for (let k = 0; k < u.max; ++k) {
      ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 44 + k * ((w - 60) / u.max), y + 32, (w - 60) / u.max - 2, 5);
    }
    const now = lvl ? u.fmt.replace('{p}', Math.round(u.per * lvl * 100)) : 'Stock';
    kit.fitText(now, x + 14, y + 54, w - 28, 12, { color: UI.textDim });
    if (!max) kit.fitText('Next: ' + u.fmt.replace('{p}', Math.round(u.per * (lvl + 1) * 100)), x + 14, y + 70, w - 28, 12, { color: UI.good });
    W.button('up_' + u.id, max ? 'MAXED' : 'Upgrade  ' + kit.group(cost), x + 10, y + h - 34, w - 20, 28, {
      disabled: !afford, accent: UI.gold, px: 13, action: () => {
        if (rules.buyUpgrade(save, u.id)) celebrate('up_' + u.id, x + w / 2, y + h / 2, UI.gold);
      },
    });
  }

  /* ── hardpoints ── */
  const TYPE_COLOR = { energy: '#7cf0ff', kinetic: '#e0e8ff', explosive: '#ff8a5a', flak: '#ffb44a', emp: '#3affd0', control: '#c88aff', stealth: '#a0b4d0' };

  function unlockText(w) {
    if (w.unlock.id) return 'From the Claim Jumpers operation';
    return 'Licence the ' + NS.ores.ZONE_BY_ID[w.unlock.licence].name;
  }

  function drawHardpoints(px, py, pw) {
    const save = G.save, CB = NS.combat;
    const n = CB.slotCount(save.hull);
    const hull = HULLS.filter(h => h.id === save.hull)[0];
    kit.text('HARDPOINTS  -  the ' + hull.name + ' carries ' + n, px + 20, py + 22, 13, UI.textMute, { weight: 'bold' });
    const sw = (pw - 48) / 3, sh = 44;
    for (let i = 0; i < 3; ++i) {
      const x = px + 16 + i * (sw + 8), y = py + 42;
      const id = i < n ? save.weapons.slots[i] : null, w = id ? NS.weaponData.WEAPON_BY_ID[id] : null;
      const hot = i < n && W.area('hp_slot_' + i, x, y, sw, sh, () => { if (id) { CB.mount(save, i, null); sfx('blip'); NS.save.writeSave(); } });
      kit.panel(x, y, sw, sh, { radius: 8, brackets: false, alpha: i < n ? 0.95 : 0.4, accent: w ? w.color : hot ? UI.gold : UI.textMute });
      kit.text(String(i + 1), x + 16, y + sh / 2, 16, i < n ? UI.gold : UI.textMute, { weight: 'bold' });
      if (i >= n) kit.text('a bigger hull', x + 34, y + sh / 2, 12, UI.textMute);
      else if (w) {
        kit.icon(w.icon, x + 44, y + sh / 2, 18, w.color);
        kit.fitText(w.name, x + 60, y + sh / 2, sw - 80, 13, { color: '#ffffff', weight: 'bold' });
      } else kit.text('empty', x + 34, y + sh / 2, 12, UI.textDim);
    }
    const WS = NS.weaponData.WEAPONS;
    const cw = (pw - 52) / 3, ch = 120;
    for (let k = 0; k < WS.length; ++k) {
      const w = WS[k];
      const x = px + 16 + (k % 3) * (cw + 10), y = py + 98 + Math.floor(k / 3) * (ch + 8);
      weaponCard(save, CB, w, n, x, y, cw, ch);
    }
  }

  function weaponCard(save, CB, w, n, x, y, cw, ch) {
    const lvl = CB.level(save, w.id), open = CB.open(save, w.id), cost = CB.nextCost(save, w.id);
    kit.panel(x, y, cw, ch, { radius: 8, brackets: false, alpha: 0.95, accent: lvl ? w.color : open ? UI.accent : UI.textMute });
    glowIf('wp_' + w.id, x, y, cw, ch);
    ctx.globalAlpha = open || lvl ? 1 : 0.5;
    kit.icon(w.icon, x + 20, y + 20, 22, lvl ? w.color : UI.textDim);
    kit.fitText(w.name, x + 38, y + 16, cw - 90, 14, { color: '#ffffff', weight: 'bold' });
    kit.text(w.type.toUpperCase(), x + 38, y + 32, 10, TYPE_COLOR[w.type] || UI.textDim, { weight: 'bold' });
    for (let k = 0; k < 3; ++k) {
      ctx.fillStyle = k < lvl ? w.color : 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + cw - 50 + k * 14, y + 12, 11, 5);
    }
    kit.wrap(w.desc, x + 12, y + 50, cw - 24, 11, 14, UI.textDim);
    ctx.globalAlpha = 1;
    const by = y + ch - 32;
    if (!open && !lvl) {
      kit.lock(x + 20, by + 14, 12);
      kit.fitText(unlockText(w), x + 36, by + 14, cw - 48, 11, { color: UI.textMute });
      return;
    }
    const label = cost < 0 ? 'MAXED' : cost === 0 ? 'Take it' : (lvl ? 'Lv ' + (lvl + 1) + '  ' : 'Buy  ') + kit.group(cost);
    const bw = lvl ? cw - 24 - n * 30 : cw - 24;
    W.button('wp_buy_' + w.id, label, x + 10, by, bw, 26, { px: 12, accent: UI.gold, disabled: cost < 0 || save.credits < cost, action: () => {
      if (CB.buy(save, w.id)) celebrate('wp_' + w.id, x + cw / 2, y + ch / 2, w.color);
      else sfx('error');
    } });
    if (lvl) for (let i = 0; i < n; ++i)
      W.button('wp_m' + i + '_' + w.id, String(i + 1), x + cw - 12 - (n - i) * 30, by, 26, 26, { px: 12, selected: save.weapons.slots[i] === w.id, action: () => {
        CB.mount(save, i, w.id);
        sfx('blip');
        NS.save.writeSave();
      } });
  }

  function drawModules(px, py, pw) {
    const save = G.save;
    kit.text('Modules apply as soon as you buy them', px + 20, py + 22, 13, UI.textMute, { weight: 'bold' });
    const cw = pw - 32, ch = 64;
    for (let i = 0; i < MODULES.length; ++i) {
      const m = MODULES[i];
      const x = px + 16, y = py + 40 + i * (ch + 8);
      const lvl = save.modules[m.id];
      const max = lvl >= m.costs.length;
      const cost = rules.moduleCost(save, m.id);
      const unlocked = rules.moduleUnlocked(save, m);
      const afford = unlocked && !max && save.credits >= cost;
      kit.panel(x, y, cw, ch, { radius: 8, accent: max ? UI.gold : lvl ? UI.accent : UI.textMute, brackets: false, alpha: 0.95 });
      glowIf('mod_' + m.id, x, y, cw, ch);
      kit.icon(m.icon, x + 34, y + ch / 2, 34, lvl ? UI.accent : UI.textMute);
      kit.text(m.name, x + 66, y + 22, 17, '#ffffff', { weight: 'bold' });
      for (let k = 0; k < m.costs.length; ++k) {
        ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.arc(x + 200 + k * 16, y + 22, 5, 0, TAU);
        ctx.fill();
      }
      kit.fitText(lvl ? 'Now: ' + m.levels[lvl - 1] : 'Not built', x + 66, y + 40, cw - 330, 12, { color: lvl ? UI.text : UI.textMute });
      if (!max) kit.fitText(unlocked ? 'Next: ' + m.levels[lvl] : 'Requires Block Press research', x + 66, y + 54, cw - 330, 12, { color: UI.good });
      W.button('mod_' + m.id, max ? 'COMPLETE' : !unlocked ? 'LOCKED' : (lvl ? 'Expand  ' : 'Build  ') + kit.group(cost), x + cw - 220, y + ch / 2 - 18, 204, 36, {
        disabled: !afford, accent: UI.gold, px: 14, action: () => {
          if (rules.buildModule(save, m.id)) {
            celebrate('mod_' + m.id, x + cw - 118, y + ch / 2, UI.gold);
            NS.fx.shake(0.2);
            sfx('thud', { volume: 0.6 });
            if (m.id === 'tradeHub') NS.economy.refillContracts(save, G.stats, NS.rng.fx);
          }
        },
      });
    }
  }

  Object.assign(NS.shipyard, {
    drawShipyard, drawModules
  });
})();
