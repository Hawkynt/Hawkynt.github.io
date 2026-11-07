/* The economy as pure functions over a profile (permanent progress) and a run (one bakery
   from start to ascension, or one Bake-Off): fresh profiles and runs, tech tree levels and
   stats, upgrade aggregates, the production and click formulas, bulk building costs, what the
   cookies can afford, buffs, eras, recipe notes from baking, sugar crystals and offline gains. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const C = NS.constants;
  const { BUILDINGS, BY_ID: B_BY_ID } = NS.buildingData;
  const { UPGRADES, BY_ID: U_BY_ID } = NS.upgradeData;
  const { STAGES, SEASON_IDS } = NS.treatData;
  const { TREE, TREE_BY_ID, BRANCH_BY_ID, PAGES } = NS.treeData;

  function newProfile() {
    const tokens = {};
    for (let i = 0; i < SEASON_IDS.length; ++i) tokens[SEASON_IDS[i]] = 0;
    return {
      allTime: 0, ascensions: 0, crystals: 0, crystalsSpent: 0, notes: 0, notesEarned: 0, noteFrac: 0,
      tree: {}, achievements: {}, stageMax: 0, stagesSeen: {}, goalsDone: 0,
      skin: 'classic', particle: 'crumbs', theme: 'bakery', unlocked: {},
      stats: { clicks: 0, golden: 0, bestCombo: 0, maxCps: 0, playSeconds: 0, built: 0, upgrades: 0, quests: 0,
        bakeoffs: 0, dailies: 0, bakeBest: 0, zenSeconds: 0, offlineReturns: 0, stormBest: 0, buffsAtOnce: 0, handmade: 0 },
      bakeScores: [], dailyBest: {}, daily: null, streak: { last: '', count: 0, best: 0 },
      season: { tokens: tokens, claimed: {} },
      seenIntro: false, seenHelp: false,
      garden: newGarden(), trials: {}, trialBest: {},
    };
  }

  /* the Sugar Garden lives in the profile: it survives ascension */
  function newGarden() {
    const plots = [];
    for (let i = 0; i < 36; ++i) plots.push(null);
    return { plots: plots, known: { butterwheat: true }, seed: 'butterwheat', soil: 'dirt', lastTick: 0,
      harvested: 0, mutations: 0, planted: 0, sprouted: {}, crystals: 0 };
  }

  function trialsDone(profile) {
    let n = 0;
    for (const k in profile.trials) if (profile.trials[k]) ++n;
    return n;
  }

  function newRun(mode, profile, mods) {
    const buildings = {};
    for (let i = 0; i < BUILDINGS.length; ++i) buildings[BUILDINGS[i].id] = 0;
    const start = mode === 'classic' && profile ? startCookies(profile) : 0;
    return {
      mode: mode || 'classic', cookies: start, baked: 0, clicks: 0, buildings: buildings, upgrades: {},
      buffs: [], combo: 0, comboTimer: 0, bestCombo: 0, stage: 0, noteMark: 0, time: 0,
      timeLeft: mode === 'classic' ? 0 : C.BAKEOFF_SECONDS, golden: 0, goals: {}, mods: mods || null,
      goldenTimer: 25, built: 0, upgradesBought: 0, trial: null,
    };
  }

  /* ---- tech tree ---- */
  function nodeLevel(profile, id) {
    return profile.tree[id] || 0;
  }

  function treeStat(profile, stat) {
    let v = 0;
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      if (n.stat === stat && profile.tree[n.id]) v += profile.tree[n.id] * n.per;
    }
    return v;
  }

  function nodeCurrency(id) {
    return PAGES[BRANCH_BY_ID[TREE_BY_ID[id].branch].page].currency;
  }

  function wallet(profile, currency) {
    return currency === 'crystals' ? profile.crystals - profile.crystalsSpent : profile.notes;
  }

  function nodeCost(profile, id) {
    const n = TREE_BY_ID[id];
    const lvl = nodeLevel(profile, id);
    return lvl < n.costs.length ? n.costs[lvl] : 0;
  }

  /* maxed, locked, expensive or available */
  function nodeState(profile, id) {
    const n = TREE_BY_ID[id];
    const lvl = nodeLevel(profile, id);
    if (lvl >= n.costs.length) return 'maxed';
    for (let i = 0; i < n.req.length; ++i)
      if (nodeLevel(profile, n.req[i][0]) < n.req[i][1]) return 'locked';
    return wallet(profile, nodeCurrency(id)) >= n.costs[lvl] ? 'available' : 'expensive';
  }

  function buyNode(profile, id) {
    if (nodeState(profile, id) !== 'available') return false;
    const cost = nodeCost(profile, id);
    if (nodeCurrency(id) === 'crystals') profile.crystalsSpent += cost;
    else profile.notes -= cost;
    profile.tree[id] = nodeLevel(profile, id) + 1;
    return true;
  }

  function treeLevels(profile) {
    let n = 0;
    for (const k in profile.tree) n += profile.tree[k];
    return n;
  }

  function nodeText(n, lvl) {
    const v = Math.round(n.per * lvl * 100) / 100;
    return n.fmt.replace('{p}', Math.round(n.per * lvl * 100) + '%').replace('{v}', v);
  }

  function startCookies(profile) {
    const lvl = treeStat(profile, 'startCookies');
    return lvl ? Math.pow(10, lvl * 3) : 0;
  }

  /* ---- upgrades ---- */
  function aggregate(run) {
    const a = { bmul: {}, click: 1, global: 1, cpsShare: 0, goldenFreq: 0, goldenDur: 0, luckyMul: 1, milk: 0,
      comboCap: 0, comboWindow: 0, comboPower: 0, decoMask: 0, count: 0 };
    for (let i = 0; i < BUILDINGS.length; ++i) a.bmul[BUILDINGS[i].id] = 1;
    for (const id in run.upgrades) {
      const u = U_BY_ID[id];
      if (!u || !run.upgrades[id]) continue;
      ++a.count;
      if (u.kind === 'tier') a.bmul[u.target] *= u.mult;
      else if (u.kind === 'click') { a.click *= u.mult; a.cpsShare += u.cpsShare; }
      else if (u.kind === 'global') a.global *= u.mult;
      else if (u.kind === 'deco') { a.global *= u.mult; a.click *= u.clickMult; a.decoMask |= 1 << u.deco; }
      else if (u.kind === 'golden') { a.goldenFreq += u.goldenFreq || 0; a.goldenDur += u.goldenDur || 0; a.luckyMul += u.luckyMul || 0; }
      else if (u.kind === 'milk') a.milk += u.milk;
      else if (u.kind === 'combo') { a.comboCap += u.comboCap || 0; a.comboWindow += u.comboWindow || 0; a.comboPower += u.comboPower || 0; }
    }
    return a;
  }

  function achievementCount(profile) {
    let n = 0;
    for (const k in profile.achievements) if (profile.achievements[k]) ++n;
    return n;
  }

  /* everything derived from a run and the profile; env: { streak, garden: { prod, click, goldenFreq,
     goldenDur, comboCap } } */
  function compute(run, profile, env) {
    const a = aggregate(run);
    const mods = run.mods || {};
    const T = k => treeStat(profile, k);
    let types = 0;
    for (let i = 0; i < BUILDINGS.length; ++i) if (run.buildings[BUILDINGS[i].id] > 0) ++types;
    const crystalF = 1 + profile.crystals * 0.01 * (1 + T('crystalPower'));
    const achF = 1 + achievementCount(profile) * 0.01 * (1 + a.milk + T('milk'));
    const eraF = 1 + STAGES[run.stage].bonus * (1 + T('eraGain'));
    const treeF = 1 + T('prod') + T('variety') * types;
    const streakF = 1 + NS.calendar.streakBonus(env && env.streak ? env.streak : 0);
    const gd = (env && env.garden) || {};
    const gardenF = Math.max(0.1, 1 + (gd.prod || 0));
    const trialF = 1 + trialsDone(profile) * NS.trialData.BONUS;
    const speed = run.mode === 'classic' ? 1 : C.BAKEOFF_SPEED;
    const global = a.global * crystalF * achF * eraF * treeF * streakF * gardenF * trialF * speed * (mods.prod != null ? mods.prod : 1);
    const per = {};
    let base = 0;
    for (let i = 0; i < BUILDINGS.length; ++i) {
      const d = BUILDINGS[i];
      const m = mods.building && mods.building[d.id] != null ? mods.building[d.id] : 1;
      per[d.id] = d.cps * a.bmul[d.id] * m * global;
      base += per[d.id] * run.buildings[d.id];
    }
    const share = mods.noShare ? 0 : a.cpsShare + T('cpsShare');
    const click = (a.click * (1 + T('click') + (gd.click || 0)) * (mods.click != null ? mods.click : 1) * crystalF * speed + base * share)
      * (mods.click === 0 ? 0 : 1);
    return {
      per: per, cps: base, click: click, global: global, share: share, agg: a,
      crystalF: crystalF, achF: achF, eraF: eraF, treeF: treeF, streakF: streakF, gardenF: gardenF, trialF: trialF,
      comboCap: Math.round((C.COMBO_BASE_CAP + a.comboCap + T('comboCap') + (gd.comboCap || 0)) * (mods.comboCap || 1)),
      comboWindow: C.COMBO_WINDOW + a.comboWindow + T('comboWindow') + (mods.comboWindow || 0),
      comboPower: 0.02 * (1 + a.comboPower),
      goldenFreq: (1 + a.goldenFreq + T('goldenFreq') + (gd.goldenFreq || 0)) * (1 + (mods.goldenFreq || 0)),
      goldenDur: (1 + a.goldenDur + T('goldenDur') + (gd.goldenDur || 0)) * (1 + (mods.goldenDur || 0)),
      noGolden: !!mods.noGolden, maxEach: mods.maxEach || 0,
      goldenLife: C.GOLDEN_LIFE + T('goldenLife'),
      luckyMul: a.luckyMul,
      autoClick: T('autoClick'),
      discount: Math.min(0.6, T('discount')),
      upgDiscount: Math.min(0.5, T('upgDiscount')),
      costMul: mods.cost || 1,
      decoMask: a.decoMask,
    };
  }

  /* ---- buffs ---- */
  function buffMult(run, kind) {
    let m = 1;
    for (let i = 0; i < run.buffs.length; ++i) if (run.buffs[i].kind === kind) m *= run.buffs[i].mult;
    return m;
  }

  function comboMult(run, st) {
    return 1 + run.combo * st.comboPower;
  }

  /* ---- costs ---- */
  function bulkCost(base, owned, n) {
    const r = C.COST_SCALE;
    return base * Math.pow(r, owned) * (Math.pow(r, n) - 1) / (r - 1);
  }

  function buildingCost(run, st, id, n) {
    const d = B_BY_ID[id];
    return Math.ceil(bulkCost(d.cost, run.buildings[id], n || 1) * (1 - st.discount) * st.costMul);
  }

  function maxAffordable(run, st, id) {
    const d = B_BY_ID[id];
    const r = C.COST_SCALE;
    const first = d.cost * Math.pow(r, run.buildings[id]) * (1 - st.discount) * st.costMul;
    if (run.cookies < first) return 0;
    let n = Math.floor(Math.log(run.cookies * (r - 1) / first + 1) / Math.log(r));
    while (n > 0 && buildingCost(run, st, id, n) > run.cookies) --n;
    return n;
  }

  function sellValue(run, st, id) {
    if (!run.buildings[id]) return 0;
    const d = B_BY_ID[id];
    return Math.floor(d.cost * Math.pow(C.COST_SCALE, run.buildings[id] - 1) * C.SELL_BACK * (1 - st.discount));
  }

  function upgradeCost(st, id) {
    return Math.ceil(U_BY_ID[id].cost * (1 - st.upgDiscount));
  }

  /* ---- eras, notes, crystals ---- */
  function stageFor(baked) {
    let s = 0;
    for (let i = 1; i < STAGES.length; ++i) if (baked >= STAGES[i].need) s = i;
    return s;
  }

  /* one mark per half order of magnitude baked in the run, from 100 on */
  function noteMark(baked) {
    return baked >= 100 ? Math.floor(2 * Math.log10(baked)) - 3 : 0;
  }

  function crystalsFor(allTime) {
    return Math.floor(Math.cbrt(Math.max(0, allTime) / 1e12));
  }

  function offlineGain(cps, seconds, profile) {
    const cap = (C.OFFLINE_BASE_HOURS + treeStat(profile, 'offlineHours')) * 3600;
    const eff = Math.min(1, C.OFFLINE_BASE_EFFICIENCY + treeStat(profile, 'offlineEff'));
    const secs = Math.max(0, Math.min(seconds, cap));
    return { seconds: secs, capped: seconds > cap, cap: cap, efficiency: eff, cookies: cps * secs * eff };
  }

  function upgradeRevealed(run, profile, u) {
    const r = u.req;
    if (r.own) return run.buildings[r.own] >= r.n;
    if (r.clicks) return run.clicks >= r.clicks || profile.stats.clicks >= r.clicks * 5;
    if (r.baked) return run.baked >= r.baked;
    if (r.stage) return run.stage >= r.stage;
    if (r.golden) return profile.stats.golden >= r.golden;
    if (r.ach) return achievementCount(profile) >= r.ach;
    if (r.combo) return run.bestCombo >= r.combo || profile.stats.bestCombo >= r.combo * 2;
    return true;
  }

  Object.assign(NS.economy, {
    newProfile, newGarden, trialsDone, newRun, nodeLevel, treeStat, nodeCurrency, wallet, nodeCost, nodeState, buyNode, treeLevels, nodeText,
    startCookies, aggregate, achievementCount, compute, buffMult, comboMult, bulkCost, buildingCost, maxAffordable,
    sellValue, upgradeCost, stageFor, noteMark, crystalsFor, offlineGain, upgradeRevealed,
  });
})();
