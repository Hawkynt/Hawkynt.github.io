;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Progress queries and purchases on the save: tech-tree levels, the wardrobe (birds, hats,
     trails), stage unlocks, stars and the per-mode best. Reads and writes G.save. */

  const { TREE, BIRD_DEFS, HATS, TRAILS, THEMES, MODES } = NS.C;
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
    if (NS.goals.check)
      NS.goals.check();
    return true;
  }

  function treeComplete() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= nodeMax(node))
        ++n;
    return n;
  }

  /* ── Wardrobe: one catalogue per tab ── */
  const KINDS = {
    birds: { list: BIRD_DEFS, owned: 'birds', current: 'bird' },
    hats: { list: HATS, owned: 'hats', current: 'hat' },
    trails: { list: TRAILS, owned: 'trails', current: 'trail' },
    themes: { list: THEMES, owned: 'themes', current: 'theme' }
  };

  function itemDef(kind, id) {
    return KINDS[kind].list.find(d => d.id === id) || null;
  }

  function itemName(kind, id) {
    if (kind === 'birds') {
      const art = SZ.FlappyBirdArt.BIRDS.find(b => b.id === id);
      return art ? art.name : id;
    }
    const def = itemDef(kind, id);
    return def ? def.name : id;
  }

  function owns(kind, id) {
    return G.save[KINDS[kind].owned].indexOf(id) >= 0;
  }

  /* 'owned' | 'free' (unlock met, not yet claimed) | 'buy' | 'locked' */
  function itemState(kind, def) {
    if (owns(kind, def.id))
      return 'owned';
    if (def.unlock) {
      const u = def.unlock;
      if (u.stage && (G.save.stars[u.stage] || 0) >= 1)
        return 'free';
      if (u.ach && G.save.achievements[u.ach])
        return 'free';
      return 'locked';
    }
    return 'buy';
  }

  function unlockHint(kind, def) {
    const u = def.unlock;
    if (!u)
      return 'Buy for ' + def.price;
    if (u.stage)
      return 'Clear story stage ' + u.stage;
    if (u.ach) {
      const a = NS.C.ACHIEVEMENTS.find(x => x.id === u.ach);
      return 'Achievement: ' + (a ? a.name : u.ach);
    }
    if (u.season && kind === 'themes')
      return 'Collect 10 tokens in ' + SZ.FlappySeasons.EVENTS[u.season].name;
    if (u.season)
      return 'Event reward: ' + SZ.FlappySeasons.EVENTS[u.season].name;
    return '';
  }

  function grant(kind, id) {
    const list = G.save[KINDS[kind].owned];
    if (list.indexOf(id) >= 0)
      return false;
    list.push(id);
    return true;
  }

  /* select an owned item, claim a free one, or buy one; returns true on success */
  function useItem(kind, id) {
    const def = itemDef(kind, id);
    if (!def)
      return false;
    const state = itemState(kind, def);
    if (state === 'locked' || (state === 'buy' && G.save.coins < def.price)) {
      sfx('error');
      return false;
    }
    if (state === 'buy')
      G.save.coins -= def.price;
    if (state !== 'owned') {
      grant(kind, id);
      sfx('powerup');
      sfx('coin');
    } else {
      sfx('select');
    }
    G.save[KINDS[kind].current] = id;
    Save.writeSave();
    if (NS.goals.check)
      NS.goals.check();
    return true;
  }

  function currentOf(kind) {
    const id = G.save[KINDS[kind].current];
    return owns(kind, id) ? id : KINDS[kind].list[0].id;
  }

  function currentBird() {
    return owns('birds', G.save.bird) ? G.save.bird : 'sunny';
  }

  function currentHat() {
    return owns('hats', G.save.hat) ? G.save.hat : 'none';
  }

  function currentTrail() {
    return owns('trails', G.save.trail) ? G.save.trail : 'none';
  }

  /* the event whose look the scenery wears: the calendar's, or a kept theme */
  function visualEvent() {
    const t = G.save.theme;
    if (t && t !== 'auto' && owns('themes', t))
      return SZ.FlappySeasons.EVENTS[t];
    return G.season ? G.season.event : null;
  }

  function birdArt() {
    return SZ.FlappyBirdArt.BIRDS.find(b => b.id === currentBird()) || SZ.FlappyBirdArt.BIRDS[0];
  }

  function birdName(id) {
    return itemName('birds', id);
  }

  function wardrobeCount() {
    return G.save.birds.length + G.save.hats.length + G.save.trails.length + G.save.themes.length - 4;
  }

  function wardrobeTotal() {
    return BIRD_DEFS.length + HATS.length + TRAILS.length + THEMES.length - 4;
  }

  /* ── Story ── */

  function stageUnlocked(i) {
    if (i === 0)
      return true;
    const prev = SZ.FlappyCourse.STAGES[i - 1];
    return (G.save.stars[prev.id] || 0) >= 1;
  }

  /* the first stage without a star, or the last one */
  function storyNext() {
    const st = SZ.FlappyCourse.STAGES;
    for (let i = 0; i < st.length; ++i)
      if (!(G.save.stars[st[i].id] >= 1))
        return i;
    return st.length - 1;
  }

  function todayKey() {
    return SZ.FlappyCourse.dateKey(new Date());
  }

  function modeName(mode) {
    const m = MODES[mode || G.mode];
    return m ? m.name : 'Classic';
  }

  function modeBest(mode) {
    mode = mode || G.mode;
    if (mode === 'daily')
      return G.save.best.daily.date === todayKey() ? G.save.best.daily.score : 0;
    return G.save.best[mode] || 0;
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

  function bossesBeaten() {
    return SZ.FlappyCourse.BOSS_ORDER.filter(k => G.save.bosses[k] > 0);
  }

  Object.assign(NS.progress, {
    treeLevel, nodeMax, nodeState, buyNode, treeComplete, KINDS, itemDef, itemName, owns, itemState, unlockHint,
    grant, useItem, currentOf, currentBird, currentHat, currentTrail, visualEvent, birdArt, birdName, wardrobeCount, wardrobeTotal,
    stageUnlocked, storyNext, todayKey, modeName, modeBest, totalStars, worldStars, bossesBeaten
  });
})();
