/* The Sugar Garden: a plot that opens with the Cupcake era (or after an ascension) and grows
   from 3 x 3 to 6 x 6 plots as seeds are discovered. Plants grow one tick per real minute, also
   while the page is closed (up to a day), give their bonus while mature, wither when old and
   pay out when harvested ripe - and a ripe harvest of a new kind teaches its seed. Every tick,
   an empty plot next to two mature parents may sprout their mutation; weeds creep into empty
   plots now and then. The garden lives in the profile and survives ascension. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const D = NS.gardenData;
  const { BY_ID, SOIL_BY_ID, PLANTS, MUTATIONS } = D;
  const fmt = NS.format;
  const { sfx } = NS.audio;

  function garden() {
    return G.profile.garden;
  }

  function knownCount(g) {
    g = g || garden();
    let n = 0;
    for (const k in g.known) if (g.known[k] && BY_ID[k]) ++n;
    return n;
  }

  /* side length of the usable plot: 3, then +1 for every four seeds known, up to 6 */
  function size(g) {
    return Math.min(6, 3 + Math.floor(knownCount(g) / 4));
  }

  function unlocked() {
    const p = G.profile;
    return p.stageMax >= D.UNLOCK_STAGE || p.ascensions > 0;
  }

  function soil(g) {
    return SOIL_BY_ID[(g || garden()).soil] || SOIL_BY_ID.dirt;
  }

  function inside(g, i) {
    const n = size(g);
    return i % 6 < n && Math.floor(i / 6) < n;
  }

  function isMature(plot) {
    return !!plot && plot.age >= BY_ID[plot.p].grow;
  }

  /* summed bonus of every mature plant, scaled by the soil */
  function effects(profile) {
    const g = (profile || G.profile).garden;
    const out = { prod: 0, click: 0, goldenFreq: 0, goldenDur: 0, comboCap: 0 };
    if (!g) return out;
    const k = soil(g).effect;
    for (let i = 0; i < 36; ++i) {
      const pl = g.plots[i];
      if (!pl || !BY_ID[pl.p] || !inside(g, i) || !isMature(pl)) continue;
      const e = BY_ID[pl.p].effect;
      out[e.k] += e.v * (e.v > 0 ? k : 1);
    }
    out.comboCap = Math.round(out.comboCap);
    return out;
  }

  function plantCost(id) {
    const cps = G.stMain ? G.stMain.cps : 0;
    const pl = BY_ID[id];
    return Math.max(pl.cost * 50, Math.ceil(cps * 60 * pl.cost));
  }

  function plant(i) {
    const g = garden();
    const id = g.seed;
    if (!unlocked() || !inside(g, i) || g.plots[i] || !g.known[id] || !BY_ID[id] || BY_ID[id].weed) return false;
    const cost = plantCost(id);
    if (G.run.cookies < cost) {
      sfx('error', { volume: 0.4 });
      return false;
    }
    G.run.cookies -= cost;
    g.plots[i] = { p: id, age: 0 };
    ++g.planted;
    sfx('drop', { pitch: 1.3, volume: 0.6 });
    return true;
  }

  /* -> { kind: 'harvest' | 'uproot', plant, learned, reward } or null */
  function harvest(i, force) {
    const g = garden();
    const pl = g.plots[i];
    if (!pl) return null;
    const def = BY_ID[pl.p];
    const ripe = isMature(pl);
    if (!ripe && !force) return null;
    g.plots[i] = null;
    NS.production.invalidate();
    if (!ripe) {
      sfx('thud', { volume: 0.5 });
      return { kind: 'uproot', plant: def };
    }
    ++g.harvested;
    const learned = !g.known[def.id] && !def.weed;
    if (!def.weed) g.known[def.id] = true;
    if (def.weed) g.known.crumbweed = true;
    const h = def.harvest, reward = [];
    if (h.cps) {
      const gain = Math.max(def.cost * 25, (G.stMain ? G.stMain.cps : 0) * 60 * h.cps);
      NS.production.earn(G.run, gain);
      reward.push('+' + fmt.short(gain) + ' treats');
    }
    if (h.notes) {
      G.profile.notes += h.notes;
      G.profile.notesEarned += h.notes;
      reward.push('+' + h.notes + ' recipe note' + (h.notes > 1 ? 's' : ''));
    }
    if (h.crystals) {
      G.profile.crystals += h.crystals;
      g.crystals += h.crystals;
      reward.push('+' + h.crystals + ' sugar crystal');
      NS.production.invalidate();
    }
    if (h.golden && !G.bake) {
      const O = NS.eventData.OUTCOMES;
      const o = O[Math.random() < 0.6 ? 0 : 1];
      NS.golden.apply(G.run, o, 640, 360);
      reward.push(o.name);
    }
    sfx(learned ? 'win' : 'coin', { volume: learned ? 0.7 : 0.6 });
    if (learned && SZ.GameMusic) SZ.GameMusic.stinger(def.rarity === 'legendary' ? 'rare' : 'unlock');
    return { kind: 'harvest', plant: def, learned: learned, reward: reward };
  }

  function harvestAll() {
    const g = garden();
    const out = [];
    for (let i = 0; i < 36; ++i)
      if (inside(g, i) && isMature(g.plots[i])) out.push(harvest(i));
    return out;
  }

  function neighbours(g, i) {
    const n = size(g), x = i % 6, y = Math.floor(i / 6);
    const out = [];
    for (let dy = -1; dy <= 1; ++dy)
      for (let dx = -1; dx <= 1; ++dx) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        out.push(ny * 6 + nx);
      }
    return out;
  }

  /* one garden tick; rnd: () => [0,1). Returns the events (sprouts, withered) */
  function tick(rnd) {
    rnd = rnd || Math.random;
    const g = garden();
    const s = soil(g);
    const events = [];
    const n = size(g);
    for (let i = 0; i < 36; ++i) {
      const pl = g.plots[i];
      if (!pl) continue;
      if (!BY_ID[pl.p] || !inside(g, i)) {
        if (!BY_ID[pl.p]) g.plots[i] = null;
        continue;
      }
      const def = BY_ID[pl.p];
      const was = isMature(pl);
      pl.age += s.grow;
      if (pl.age >= def.grow + def.life) {
        g.plots[i] = null;
        events.push({ kind: 'wither', i: i, plant: def });
      } else if (!was && isMature(pl)) events.push({ kind: 'ripe', i: i, plant: def });
    }
    for (let i = 0; i < 36; ++i) {
      if (g.plots[i] || i % 6 >= n || Math.floor(i / 6) >= n) continue;
      const count = {};
      const nb = neighbours(g, i);
      for (let k = 0; k < nb.length; ++k) {
        const pl = g.plots[nb[k]];
        if (pl && isMature(pl) && !pl.fresh) count[pl.p] = (count[pl.p] || 0) + 1;
      }
      let child = null;
      for (let m = 0; m < MUTATIONS.length && !child; ++m) {
        const mu = MUTATIONS[m];
        const [a, b] = mu.parents;
        const ok = a === b ? (count[a] || 0) >= 2 : count[a] && count[b];
        if (ok && rnd() < mu.chance * s.mutate) child = mu.child;
      }
      if (!child && rnd() < D.WEED_CHANCE) child = 'crumbweed';
      if (child) {
        g.plots[i] = { p: child, age: 0, fresh: true };
        if (child !== 'crumbweed') ++g.mutations;
        const first = !g.sprouted[child];
        g.sprouted[child] = true;
        events.push({ kind: 'sprout', i: i, plant: BY_ID[child], first: first, known: !!g.known[child] });
      }
    }
    for (let i = 0; i < 36; ++i) if (g.plots[i]) delete g.plots[i].fresh;
    return events;
  }

  /* run the ticks since the last visit (once a second, and at boot for the time away) */
  function update(now, rnd) {
    if (!unlocked()) return [];
    const g = garden();
    now = now || Date.now();
    if (!g.lastTick || g.lastTick > now) g.lastTick = now;
    let n = Math.floor((now - g.lastTick) / D.TICK_MS);
    if (n <= 0) return [];
    if (n > D.MAX_CATCHUP) {
      n = D.MAX_CATCHUP;
      g.lastTick = now;
    } else g.lastTick += n * D.TICK_MS;
    const events = [];
    for (let k = 0; k < n; ++k) {
      const ev = tick(rnd);
      for (let e = 0; e < ev.length; ++e) events.push(ev[e]);
    }
    NS.production.invalidate();
    report(events, n);
    return events;
  }

  function report(events, ticks) {
    if (!NS.screens.toast) return;
    let ripe = 0;
    for (let i = 0; i < events.length; ++i) {
      const e = events[i];
      if (e.kind === 'sprout' && e.plant.id !== 'crumbweed')
        NS.screens.toast(e.known ? 'A ' + e.plant.name + ' sprouted in the garden' : 'Something new sprouted in the garden!', NS.gardenData.RARITY[e.plant.rarity], 'leaf');
      else if (e.kind === 'ripe') ++ripe;
    }
    if (ripe && ticks > 3) NS.screens.toast(ripe + ' plant' + (ripe > 1 ? 's' : '') + ' ripened while you were away', '#7be08a', 'leaf');
    if (G.screen === 'garden') NS.gardenUi.onEvents(events);
  }

  /* when a plant ripens / withers, in minutes (garden ticks) from now */
  function eta(plot) {
    const def = BY_ID[plot.p];
    const sp = soil().grow;
    return { ripe: Math.max(0, Math.ceil((def.grow - plot.age) / sp)), wither: Math.max(0, Math.ceil((def.grow + def.life - plot.age) / sp)) };
  }

  function setSoil(id) {
    if (!SOIL_BY_ID[id]) return;
    garden().soil = id;
    NS.production.invalidate();
    sfx('select', { volume: 0.5 });
  }

  function selectSeed(id) {
    const g = garden();
    if (!g.known[id] || BY_ID[id].weed) return;
    g.seed = id;
    sfx('click', { volume: 0.5 });
  }

  /* which parents a plant comes from, for the seed log once the child is known or sprouted */
  function recipeOf(id) {
    return MUTATIONS.find(m => m.child === id) || null;
  }

  Object.assign(NS.garden, { knownCount, size, unlocked, soil, inside, isMature, effects, plantCost, plant, harvest, harvestAll,
    neighbours, tick, update, eta, setSoil, selectSeed, recipeOf, PLANTS });
})();
