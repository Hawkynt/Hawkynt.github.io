/* Buying and selling: the buy amount (1, 10, and with Bulk Orders 100 or max), producer
   purchases with bulk costs, selling one back for a quarter of its price, the upgrades the
   store reveals (sorted by price) and buying them, with sounds, particles and quest credit. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.economy;
  const { UPGRADES, BY_ID: U_BY_ID } = NS.upgradeData;
  const { BY_ID: B_BY_ID } = NS.buildingData;
  const { sfx } = NS.audio;

  function bulkAllowed() {
    return E.treeStat(G.profile, 'bulk') > 0;
  }

  function buyAmount() {
    const steps = C.BUY_STEPS;
    let i = G.ui.buyIndex;
    if (!bulkAllowed() && i > 1) i = 0;
    return steps[i];
  }

  function cycleAmount() {
    const max = bulkAllowed() ? C.BUY_STEPS.length : 2;
    G.ui.buyIndex = (G.ui.buyIndex + 1) % max;
    sfx('click', { volume: 0.4 });
  }

  /* n to buy and its price for the store row */
  function quote(id) {
    const run = G.active();
    const st = G.st;
    let n = buyAmount();
    if (n < 0) n = Math.max(1, E.maxAffordable(run, st, id));
    /* Lean Kitchen trial: a cap per producer */
    if (st.maxEach) {
      n = Math.min(n, st.maxEach - run.buildings[id]);
      if (n <= 0) return { n: 0, cost: Infinity, capped: true };
    }
    return { n: n, cost: E.buildingCost(run, st, id, n) };
  }

  function buyBuilding(id, x, y) {
    const run = G.active();
    const q = quote(id);
    if (q.capped || run.cookies < q.cost) {
      sfx('error', { volume: 0.5 });
      return false;
    }
    run.cookies -= q.cost;
    run.buildings[id] += q.n;
    run.built += q.n;
    G.profile.stats.built += q.n;
    G.ui.lastBuy = id;
    G.ui.lastBuyT = 1;
    NS.production.invalidate();
    sfx('drop', { pitch: 0.9 + Math.min(0.6, run.buildings[id] * 0.004) });
    if (x != null) NS.fx.burst(x, y, 10, [B_BY_ID[id].main, B_BY_ID[id].accent, '#ffffff'], 'stars', 200, 300, 4);
    NS.progression.quest('buy', q.n);
    const owned = run.buildings[id];
    if (owned === 1 || owned % 50 === 0) {
      const rows = NS.sceneRender.rows();
      const ry = NS.constants.LAYOUT.sceneY + 32 + rows.indexOf(B_BY_ID[id]) * NS.constants.LAYOUT.rowH - G.ui.sceneScroll + 46;
      NS.fx.text(NS.constants.LAYOUT.sceneX + 220, Math.max(140, Math.min(620, ry)), owned === 1 ? 'New: ' + B_BY_ID[id].name + '!' : owned + ' ' + B_BY_ID[id].name, C.UI.gold, 26, 1.6);
      sfx('levelup', { volume: 0.5 });
    }
    return true;
  }

  function sellBuilding(id) {
    const run = G.active();
    const v = E.sellValue(run, G.st, id);
    if (!run.buildings[id]) return false;
    run.buildings[id] -= 1;
    run.cookies += v;
    NS.production.invalidate();
    sfx('coin', { pitch: 0.7, volume: 0.5 });
    NS.screens.toast('Sold a ' + B_BY_ID[id].name + ' for ' + NS.format.short(v), C.UI.textDim);
    return true;
  }

  function visibleUpgrades() {
    const run = G.active();
    const out = [];
    for (let i = 0; i < UPGRADES.length; ++i) {
      const u = UPGRADES[i];
      if (!run.upgrades[u.id] && E.upgradeRevealed(run, G.profile, u)) out.push(u);
    }
    out.sort((a, b) => a.cost - b.cost);
    return out;
  }

  function buyUpgrade(id) {
    const run = G.active();
    const u = U_BY_ID[id];
    const cost = E.upgradeCost(G.st, id);
    if (run.upgrades[id] || run.cookies < cost) {
      sfx('error', { volume: 0.5 });
      return false;
    }
    run.cookies -= cost;
    run.upgrades[id] = true;
    ++run.upgradesBought;
    ++G.profile.stats.upgrades;
    NS.production.invalidate();
    sfx('powerup', { volume: 0.6 });
    NS.progression.quest('upgrades', 1);
    if (u.kind === 'deco') {
      const L = C.LAYOUT;
      NS.fx.ring(L.treatX, L.treatY, L.treatR * 0.6, L.treatR * 1.8, 0.7, C.UI.gold, 6);
      NS.fx.burst(L.treatX, L.treatY - 40, 40, ['#ffffff', '#ffd25a', '#ff9ac0'], 'stars', 360, 300);
      NS.fx.flash(0.35, '#fff4d0');
      NS.fx.shake(6);
      G.treatSquashV -= 12;
      NS.screens.toast('The treat gets ' + u.name + '!', C.UI.gold, 'deco');
    } else NS.screens.toast('Upgrade: ' + u.name + ' - ' + u.desc, C.UI.good);
    return true;
  }

  Object.assign(NS.purchasing, { bulkAllowed, buyAmount, cycleAmount, quote, buyBuilding, sellBuilding, visibleUpgrades, buyUpgrade });
})();
