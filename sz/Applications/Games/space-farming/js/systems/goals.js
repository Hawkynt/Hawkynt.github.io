/* Space Farming - goals with rewards, statistics and trader orders.
   Owns: G.stats, G.goalIndex, G.orders, G.orderTimer, G.orderSerial
   Reads: G.state, G.credits, G.gameTime, G.dayCount, G.gridRows, G.buildings, G.livestockPens, G.inventory,
     G.gridCols */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, CROPS, LIVESTOCK, SEASON_DURATION, DAY_CYCLE_PERIOD, UI, expandCost, flyCoins,
    celebrate, START_CROPS, TECH, techOwned, techChainCount, isCropUnlocked, itemSprite, goalPanelLayout,
    announce, hudLayout, toast } = NS;

  /* ══════════════════════════════════════════════════════════════════
     GOALS AND ORDERS — milestones with rewards, delivery orders from
     visiting traders, and the market where produce is sold
     ══════════════════════════════════════════════════════════════════ */

  G.stats = newStats();
  let goalCooldown = 0;

  function newStats() {
    return { planted: 0, harvested: 0, earned: 0, orders: 0, built: 0, animals: 0, surveys: 0, hintExpand: 0 };
  }

  function buildingCount() {
    let n = 0;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c)
        if (G.buildings[r]?.[c]) ++n;
    return n;
  }

  function ownedTechCount() {
    let n = 0;
    for (const t of TECH)
      if (!t.repeat && techOwned(t.id)) ++n;
    return n;
  }

  function unlockedCropCount() {
    let n = 0;
    for (let i = 0; i < CROPS.length; ++i)
      if (isCropUnlocked(i)) ++n;
    return n;
  }

  const GOALS = [
    { title: 'Green thumb', desc: 'Plant 5 crops', icon: 'seedbag', need: 5, value: () => G.stats.planted, reward: 25 },
    { title: 'First harvest', desc: 'Harvest 10 crops', icon: 'basket', need: 10, value: () => G.stats.harvested, reward: 40 },
    { title: 'More room', desc: 'Expand the field once', icon: 'map', need: 1, value: () => G.stats.surveys, reward: 40 },
    { title: 'Market day', desc: 'Earn 150 credits from sales', icon: 'coin', need: 150, value: () => G.stats.earned, reward: 50 },
    { title: 'Researcher', desc: 'Buy an upgrade in the tech tree', icon: 'techtree', need: 1, value: () => ownedTechCount(), reward: 60 },
    { title: 'Builder', desc: 'Build any building', icon: 'hammer', need: 1, value: () => Math.max(G.stats.built, buildingCount()), reward: 60 },
    { title: 'Rancher', desc: 'Buy an animal', icon: 'paw', need: 1, value: () => Math.max(G.stats.animals, G.livestockPens.length), reward: 60 },
    { title: 'Trader', desc: 'Deliver an order', icon: 'order', need: 1, value: () => G.stats.orders, reward: 100 },
    { title: 'New species', desc: 'Unlock a new crop', icon: 'starfruit', need: START_CROPS.length + 1, value: () => unlockedCropCount(), reward: 120 },
    { title: 'Sunny days', desc: 'Reach summer', icon: 'sun', need: SEASON_DURATION + 1, value: () => G.dayCount, reward: 120 },
    { title: 'Harvest moon', desc: 'Harvest 100 crops', icon: 'moon', need: 100, value: () => G.stats.harvested, reward: 200 },
    { title: 'Engineer', desc: 'Own 5 buildings', icon: 'turbine', need: 5, value: () => buildingCount(), reward: 200 },
    { title: 'Homesteader', desc: 'Survey new land twice', icon: 'map', need: 2, value: () => G.stats.surveys, reward: 250 },
    { title: 'Merchant', desc: 'Earn 2,000 credits from sales', icon: 'chart', need: 2000, value: () => G.stats.earned, reward: 300 },
    { title: 'Scientist', desc: 'Own 15 tech upgrades', icon: 'flask', need: 15, value: () => ownedTechCount(), reward: 400 },
    { title: 'Trade baron', desc: 'Deliver 5 orders', icon: 'scroll', need: 5, value: () => G.stats.orders, reward: 400 },
    { title: 'One full year', desc: 'Reach day 17', icon: 'winter', need: SEASON_DURATION * 4 + 1, value: () => G.dayCount, reward: 600 },
    { title: 'Tycoon', desc: 'Earn 10,000 credits from sales', icon: 'coin', need: 10000, value: () => G.stats.earned, reward: 1000 },
    { title: 'Master farmer', desc: 'Own 40 tech upgrades', icon: 'star', need: 40, value: () => ownedTechCount(), reward: 1500 },
    { title: 'Galactic farm', desc: 'Own every tech upgrade', icon: 'techtree', need: () => TECH.filter(t => !t.repeat).length, value: () => ownedTechCount(), reward: 5000 }
  ];

  function goalNeed(g) {
    return typeof g.need === 'function' ? g.need() : g.need;
  }

  function updateExpandHint() {
    if (G.stats.hintExpand || G.stats.surveys || G.state !== STATE_PLAYING) return;
    if (G.credits >= expandCost() && G.dayCount >= 1 && G.gameTime > 20) {
      G.stats.hintExpand = 1;
      announce('Need more room?', 'Click the glowing + beside the field (or press E) to add new plots', UI.gold, 'map');
    }
  }

  function updateGoals(dt) {
    updateExpandHint();
    goalCooldown = Math.max(0, goalCooldown - dt);
    if (goalCooldown > 0 || G.goalIndex >= GOALS.length) return;
    const g = GOALS[G.goalIndex];
    if (g.value() >= goalNeed(g)) {
      ++G.goalIndex;
      G.credits += g.reward;
      goalCooldown = 1.8;
      announce('Goal reached: ' + g.title, `${g.desc} · +${g.reward} credits`, UI.good, g.icon);
      SZ.GameAudio.play('win', { volume: 0.8 });
      const L = hudLayout();
      const GP = goalPanelLayout(L);
      celebrate(GP.x + GP.w / 2, GP.y + 30, 34);
      flyCoins(Math.min(10, 3 + Math.round(g.reward / 100)), GP.x + GP.w / 2, GP.y + 40);
    }
  }

  /* ── Orders ── */

  function orderSlots() {
    return 1 + techChainCount('com_orders');
  }

  function orderCandidates() {
    const list = [];
    CROPS.forEach((c, i) => {
      if (isCropUnlocked(i))
        list.push({ item: c.name, value: c.sellPrice, sprite: c.sprite, grow: c.growTime });
    });
    LIVESTOCK.forEach((l, i) => {
      if (G.livestockPens.some(p => p.typeIndex === i))
        list.push({ item: l.produce, value: l.produceValue, sprite: l.produceSprite, grow: l.feedInterval });
    });
    return list;
  }

  function newOrder() {
    const list = orderCandidates().filter(c => !G.orders.some(o => o.item === c.item));
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    // cheap goods come in bigger batches; the trader pays a premium
    const qty = Math.max(3, Math.min(30, Math.round((5 + Math.random() * 6 + G.dayCount * 0.35) * Math.min(2, 18 / pick.value))));
    const reward = Math.round(qty * pick.value * (1.6 + Math.random() * 0.5) / 5) * 5;
    G.orders.push({ id: ++G.orderSerial, item: pick.item, qty, reward, until: G.gameTime + DAY_CYCLE_PERIOD * (2.5 + Math.random()) });
    toast(`New order: ${qty} × ${pick.item}`, '#9df08a', 'order');
    SZ.GameAudio.play('blip', { pitch: 1.2 });
  }

  function updateOrders(dt) {
    if (G.state !== STATE_PLAYING) return;
    for (let i = G.orders.length - 1; i >= 0; --i)
      if (G.gameTime > G.orders[i].until) {
        toast(`Order for ${G.orders[i].item} expired`, UI.warn, 'order');
        G.orders.splice(i, 1);
      }
    if (G.orders.length < orderSlots()) {
      G.orderTimer -= dt;
      if (G.orderTimer <= 0) {
        G.orderTimer = 35 + Math.random() * 35;
        newOrder();
      }
    }
  }

  function orderSprite(o) {
    return itemSprite(o.item);
  }

  function canDeliver(o) {
    return (G.inventory[o.item] || 0) >= o.qty;
  }

  function deliverOrder(o, fromX, fromY) {
    if (G.state !== STATE_PLAYING) return;
    if (!canDeliver(o)) {
      SZ.GameAudio.play('error');
      toast(`Need ${o.qty - (G.inventory[o.item] || 0)} more ${o.item}`, UI.warn, orderSprite(o));
      return;
    }
    G.inventory[o.item] -= o.qty;
    if (G.inventory[o.item] <= 0) delete G.inventory[o.item];
    G.credits += o.reward;
    G.stats.earned += o.reward;
    ++G.stats.orders;
    G.orders.splice(G.orders.indexOf(o), 1);
    if (G.orders.length < orderSlots())
      G.orderTimer = Math.min(G.orderTimer, 20);
    announce('Order delivered!', `${o.qty} × ${o.item} · +${o.reward} credits`, '#9df08a', 'order');
    SZ.GameAudio.play('win', { volume: 0.7 });
    if (fromX !== undefined) {
      flyCoins(Math.min(12, 3 + Math.round(o.reward / 60)), fromX, fromY);
      celebrate(fromX, fromY, 22);
    }
  }

  Object.assign(NS, { newStats, GOALS, goalNeed, updateGoals, orderSlots, updateOrders, orderSprite,
    canDeliver, deliverOrder });

})();
