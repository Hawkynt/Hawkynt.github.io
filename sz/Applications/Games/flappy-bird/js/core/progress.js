;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Progress queries and purchases on the save: tech-tree levels, Aviary birds,
     stage unlocks, stars and the per-mode best. Reads and writes G.save, reads G.mode. */

  const { TREE, BIRD_DEFS } = NS.C;
  const { sfx } = NS.services;
  const G = NS.state;
  const Save = NS.save;

  function treeLevel(id) {
    return G.save.tree[id] || 0;
  }

  function nodeMax(node) {
    return node.costs.length;
  }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= nodeMax(node))
      return 'maxed';
    for (const req of node.req)
      if (treeLevel(req[0]) < req[1])
        return 'locked';
    return G.save.coins >= node.costs[level] ? 'available' : 'expensive';
  }

  function buyNode(node) {
    if (nodeState(node) !== 'available') {
      sfx('error');
      return false;
    }
    const level = treeLevel(node.id);
    G.save.coins -= node.costs[level];
    G.save.tree[node.id] = level + 1;
    Save.writeSave();
    sfx('powerup');
    sfx('coin');
    return true;
  }

  function birdDef(id) {
    return BIRD_DEFS.find(d => d.id === id) || null;
  }

  function birdName(id) {
    const art = SZ.FlappyBirdArt.BIRDS.find(b => b.id === id);
    return art ? art.name : id;
  }

  function birdOwned(id) {
    return G.save.birds.indexOf(id) >= 0;
  }

  function birdAvailable(def) {
    return def.unlock ? (G.save.stars[def.unlock] || 0) >= 1 : true;
  }

  function buyBird(id) {
    const def = birdDef(id);
    if (!def)
      return false;
    if (birdOwned(id)) {
      G.save.bird = id;
      Save.writeSave();
      sfx('select');
      return true;
    }
    // Stage-star unlocks come free once the stage is cleared, otherwise the bird is bought
    const free = def.unlock && birdAvailable(def);
    if (free || G.save.coins >= def.price) {
      if (!free)
        G.save.coins -= def.price;
      G.save.birds.push(id);
      G.save.bird = id;
      Save.writeSave();
      sfx('powerup');
      sfx('coin');
      return true;
    }
    sfx('error');
    return false;
  }

  function currentBird() {
    return birdOwned(G.save.bird) ? G.save.bird : 'sunny';
  }

  function birdArt() {
    return SZ.FlappyBirdArt.BIRDS.find(b => b.id === currentBird()) || SZ.FlappyBirdArt.BIRDS[0];
  }

  function stageUnlocked(i) {
    if (i === 0)
      return true;
    const prev = SZ.FlappyCourse.STAGES[i - 1];
    return (G.save.stars[prev.id] || 0) >= 1;
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function modeName() {
    if (G.mode === 'adventure')
      return 'Adventure';
    if (G.mode === 'time')
      return 'Time Attack';
    if (G.mode === 'daily')
      return 'Daily';
    return 'Classic';
  }

  function modeBest() {
    if (G.mode === 'classic')
      return G.save.best.classic;
    if (G.mode === 'time')
      return G.save.best.time;
    if (G.mode === 'daily')
      return G.save.best.daily.date === todayKey() ? G.save.best.daily.score : 0;
    return 0;
  }

  function totalStars() {
    let n = 0;
    for (const id in G.save.stars)
      n += G.save.stars[id];
    return n;
  }

  function worldStars(w) {
    let n = 0;
    for (const st of SZ.FlappyCourse.STAGES)
      if (st.world === w)
        n += G.save.stars[st.id] || 0;
    return n;
  }

  function treeComplete() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= nodeMax(node))
        ++n;
    return n;
  }

  Object.assign(NS.progress, {
    treeLevel, nodeMax, nodeState, buyNode, birdDef, birdName, birdOwned, birdAvailable, buyBird, currentBird,
    birdArt, stageUnlocked, todayKey, modeName, modeBest, totalStars, worldStars, treeComplete
  });
})();
