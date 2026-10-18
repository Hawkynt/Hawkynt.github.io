/* Rules on the save: owned and available ships, buying ships and armory levels, the flown ship,
   star and upgrade counts, upgrade-derived values. Writes G.save; reads data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { SHIP_DEFS, TREE } = NS.data;
  const { writeSave } = NS.save;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;

  function shipOwned(id) {
    return G.save.ships.indexOf(id) >= 0;
  }

  function shipAvailable(id) {
    const def = SHIP_DEFS[id];
    if (!def) return false;
    if (def.unlock)
      return (G.save.stars[def.unlock] || 0) >= 1;
    return true;
  }

  function buyShip(id) {
    const def = SHIP_DEFS[id];
    if (!def || !shipAvailable(id)) {
      playSfx('error');
      return false;
    }
    if (!shipOwned(id)) {
      if (def.price > 0) {
        if (G.save.credits < def.price) {
          playSfx('error');
          return false;
        }
        G.save.credits -= def.price;
      }
      G.save.ships.push(id);
    }
    G.save.ship = id;
    writeSave();
    updateStatusBar();
    playSfx('powerup');
    playSfx('coin');
    return true;
  }

  function treeLevel(id) {
    return G.save.tree[id] || 0;
  }

  function nodeState(node) {
    const lvl = treeLevel(node.id);
    if (lvl >= node.costs.length)
      return 'maxed';
    for (const r of node.req)
      if (treeLevel(r[0]) < r[1])
        return 'locked';
    if (G.save.credits < node.costs[lvl])
      return 'expensive';
    return 'available';
  }

  function buyNode(node) {
    if (nodeState(node) !== 'available') {
      playSfx('error');
      return false;
    }
    G.save.credits -= node.costs[treeLevel(node.id)];
    G.save.tree[node.id] = treeLevel(node.id) + 1;
    writeSave();
    updateStatusBar();
    playSfx('powerup');
    playSfx('coin');
    return true;
  }

  function powerupDuration(def) {
    return def.duration * (1 + 0.2 * treeLevel('p_dur'));
  }

  function bulletDamage() {
    return SHIP_DEFS[currentShipId()].damage * (1 + 0.4 * treeLevel('w_dmg'));
  }

  function maxSpecialCharges() {
    return treeLevel('s_double') > 0 ? 2 : 1;
  }

  function countStars() {
    let n = 0;
    for (const id of Object.keys(G.save.stars))
      n += G.save.stars[id] || 0;
    return n;
  }

  function countTreeMaxed() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  function currentShipId() {
    return SHIP_DEFS[G.save.ship] && shipOwned(G.save.ship) ? G.save.ship : 'interceptor';
  }

  Object.assign(NS.progress, {
    shipOwned, shipAvailable, buyShip, treeLevel, nodeState, buyNode, currentShipId, powerupDuration,
    maxSpecialCharges, bulletDamage, countStars, countTreeMaxed
  });
})();
