/* Profile rules as pure functions over a profile: its fresh shape and migration of the old high
   scores, the tech tree (levels, stats, states, buying), XP and player levels, stars, story
   unlocking, cosmetics (unlock tests, buying with gems), daily quests and the play streak,
   festival tokens and their reward track, the achievement snapshot and sweep, high-score
   tables, and what a finished game pays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const M = NS.metaData;
  const W = NS.worldData;
  const SE = NS.seasons;
  const { makeRng, hashString, dayGap } = NS.rng;

  function newProfile() {
    return {
      v: 1, shards: 0, gems: 0, xp: 0, level: 1, tree: {}, stars: {}, best: {}, achievements: {},
      cosmetics: { skin: 'gloss', frame: 'steel', effect: 'sparks', owned: {} },
      stats: { lines: 0, quads: 0, tspins: 0, tst: 0, perfects: 0, maxCombo: 0, bestB2B: 0, pieces: 0, games: 0, powers: 0, zenSeconds: 0,
        dailies: 0, rushWins: 0, masterBest: 0, marathonLines: 0, sprintBest: 0, ultraBest: 0, noHoldLines: 0, playSeconds: 0, bosses: 0, stages: 0,
        quests: 0, festivalDone: 0, score: 0 },
      scores: { marathon: [], sprint: [], ultra: [], master: [], zen: [], daily: {} },
      quests: null, streak: { last: '', count: 0, best: 0 },
      festival: { event: '', tokens: 0, claimed: 0 },
      seen: { intro: false, worlds: {}, bosses: {}, finale: false, help: false },
      settings: { das: 0.15, arr: 0.033, ghost: true },
      migrated: false,
    };
  }

  /* the old game's top five ({ score, lines, level }) become Marathon scores */
  function migrateLegacy(profile, raw) {
    let list = null;
    try { list = JSON.parse(raw); } catch (_) { list = null; }
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const e of list)
      if (e && typeof e.score === 'number') {
        profile.scores.marathon.push({ score: e.score, lines: e.lines || 0, level: e.level || 1, day: 'classic' });
        ++n;
      }
    profile.scores.marathon.sort((a, b) => b.score - a.score);
    profile.scores.marathon.length = Math.min(profile.scores.marathon.length, 10);
    profile.shards += n * 50;
    profile.migrated = true;
    return n;
  }

  /* ---- tech tree ---- */
  function nodeLevel(p, id) {
    return p.tree[id] || 0;
  }

  function stat(p, name) {
    let v = 0;
    for (const n of M.TREE) if (n.stat === name && p.tree[n.id]) v += p.tree[n.id] * n.per;
    return v;
  }

  function nodeState(p, id) {
    const n = M.TREE_BY_ID[id];
    const lvl = nodeLevel(p, id);
    if (lvl >= n.costs.length) return 'maxed';
    for (const r of n.req) if (nodeLevel(p, r[0]) < r[1]) return 'locked';
    return p.shards >= n.costs[lvl] ? 'available' : 'expensive';
  }

  function buyNode(p, id) {
    if (nodeState(p, id) !== 'available') return false;
    const n = M.TREE_BY_ID[id];
    p.shards -= n.costs[nodeLevel(p, id)];
    p.tree[id] = nodeLevel(p, id) + 1;
    return true;
  }

  function treeLevels(p) {
    let n = 0;
    for (const k in p.tree) n += p.tree[k];
    return n;
  }

  function treeMax() {
    let n = 0;
    for (const t of M.TREE) n += t.costs.length;
    return n;
  }

  function nodeText(n, lvl) {
    const v = Math.round(n.per * Math.max(1, lvl) * 100) / 100;
    return n.desc.replace('{p}', Math.round(n.per * Math.max(1, lvl) * 100) + '%').replace('{v}', v);
  }

  function powerUnlocked(p, id) {
    return M.POWER_BY_ID[id].start || stat(p, 'unlock:' + id) > 0;
  }

  /* ---- XP and levels ---- */
  function xpFor(level) {
    return Math.round(120 * Math.pow(level, 1.45));
  }

  /* -> levels gained */
  function addXp(p, amount) {
    p.xp += Math.max(0, Math.round(amount));
    let up = 0;
    while (p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      ++p.level;
      ++up;
      p.gems += 5;
    }
    return up;
  }

  function gain(p, name) {
    return 1 + stat(p, name) + stat(p, 'allGain');
  }

  /* ---- story ---- */
  function starsOf(p, id) {
    const s = p.stars[id];
    return s ? (s[0] ? 1 : 0) + (s[1] ? 1 : 0) + (s[2] ? 1 : 0) : 0;
  }

  function starsTotal(p) {
    let n = 0;
    for (const id in p.stars) n += starsOf(p, id);
    return n;
  }

  function cleared(p, id) {
    return !!(p.stars[id] && p.stars[id][0]);
  }

  /* a stage opens when the one before it is cleared */
  function stageOpen(p, index) {
    return index === 0 || cleared(p, W.STAGES[index - 1].id);
  }

  function bossesBeaten(p) {
    let n = 0;
    for (const w of W.WORLDS) if (cleared(p, w.id + '-6')) ++n;
    return n;
  }

  /* -> { first, newStars, gems } */
  function recordStage(p, id, got, time) {
    const prev = p.stars[id] || [false, false, false];
    const now = [prev[0] || got[0], prev[1] || got[1], prev[2] || got[2]];
    let added = 0;
    for (let i = 0; i < 3; ++i) if (now[i] && !prev[i]) ++added;
    const first = !prev[0] && now[0];
    p.stars[id] = now;
    if (now[0] && (!p.best[id] || time < p.best[id])) p.best[id] = time;
    let gems = added * 3;
    if (added && now[0] && now[1] && now[2] && !(prev[0] && prev[1] && prev[2])) gems += Math.round(stat(p, 'starGems'));
    p.gems += gems;
    return { first: first, newStars: added, gems: gems };
  }

  /* ---- cosmetics ---- */
  function isUnlocked(p, item) {
    const u = item.unlock;
    if (u.k === 'default') return true;
    if (p.cosmetics.owned[item.id]) return true;
    if (u.k === 'stars') return starsTotal(p) >= u.n;
    if (u.k === 'level') return p.level >= u.n;
    if (u.k === 'ach') return countAchievements(p) >= u.n;
    if (u.k === 'master') return p.stats.masterBest >= u.n;
    if (u.k === 'festival') return !!p.cosmetics.owned['festival-' + u.id + '-' + item.id];
    return false;
  }

  function unlockText(item) {
    const u = item.unlock;
    if (u.k === 'gems') return u.n + ' gems';
    if (u.k === 'stars') return u.n + ' stars';
    if (u.k === 'level') return 'Player level ' + u.n;
    if (u.k === 'ach') return u.n + ' achievements';
    if (u.k === 'master') return 'Master level ' + u.n;
    if (u.k === 'festival') return SE.SEASONS[u.id].name + ' reward';
    return '';
  }

  function buyCosmetic(p, item) {
    if (isUnlocked(p, item) || item.unlock.k !== 'gems' || p.gems < item.unlock.n) return false;
    p.gems -= item.unlock.n;
    p.cosmetics.owned[item.id] = true;
    return true;
  }

  /* ---- quests and streak ---- */
  function rollQuests(day) {
    const r = makeRng(hashString('quests-' + day));
    const pool = M.QUESTS.slice();
    const out = [];
    for (let i = 0; i < 3; ++i) {
      const q = pool.splice(r.int(pool.length), 1)[0];
      const k = r.int(q.n.length);
      out.push({ id: q.id, n: q.n[k], reward: Math.round(q.reward * (1 + k * 0.5)), progress: 0, done: false });
    }
    return { day: day, list: out, bonus: false };
  }

  function questText(q) {
    const t = M.QUESTS.find(x => x.id === q.id);
    return t.text.replace('{n}', q.n.toLocaleString ? q.n.toLocaleString('en-US') : q.n);
  }

  /* -> completed quests (with their reward paid) */
  function questProgress(p, kind, amount) {
    const d = p.quests;
    if (!d) return [];
    const done = [];
    for (const q of d.list) {
      if (q.done || q.id !== kind) continue;
      const tpl = M.QUESTS.find(x => x.id === q.id);
      q.progress = tpl.max ? Math.max(q.progress, amount) : q.progress + amount;
      if (q.progress >= q.n) {
        q.done = true;
        const r = Math.round(q.reward * (1 + stat(p, 'questGain')));
        p.shards += r;
        ++p.stats.quests;
        done.push({ quest: q, reward: r });
      }
    }
    if (!d.bonus && d.list.every(q => q.done)) {
      d.bonus = true;
      p.gems += 10;
      done.push({ bonus: true, reward: 10 });
    }
    return done;
  }

  /* -> true when the streak grew today */
  function touchStreak(p, day) {
    const s = p.streak;
    if (s.last === day) return false;
    s.count = s.last && dayGap(s.last, day) === 1 ? s.count + 1 : 1;
    s.best = Math.max(s.best, s.count);
    s.last = day;
    return true;
  }

  function streakGift(count) {
    return { shards: 40 + Math.min(count, 30) * 15, gems: count % 7 === 0 ? 15 : 0 };
  }

  /* ---- festival ---- -> rewards claimed */
  function addTokens(p, n, date) {
    const ev = SE.eventId(date);
    const se = SE.seasonFor(date);
    if (p.festival.event !== ev) p.festival = { event: ev, tokens: 0, claimed: 0 };
    p.festival.tokens += Math.round(n * gain(p, 'tokenGain'));
    const got = [];
    while (p.festival.claimed < SE.TIERS.length && p.festival.tokens >= SE.TIERS[p.festival.claimed].n) {
      const t = SE.TIERS[p.festival.claimed];
      if (t.kind === 'shards') p.shards += t.amount;
      else if (t.kind === 'gems') p.gems += t.amount;
      else if (t.kind === 'skin') p.cosmetics.owned['festival-' + se.id + '-' + se.skin] = true;
      else if (t.kind === 'effect') p.cosmetics.owned['festival-' + se.id + '-' + se.effect] = true;
      got.push(t);
      ++p.festival.claimed;
      if (p.festival.claimed === SE.TIERS.length) ++p.stats.festivalDone;
    }
    return got;
  }

  /* ---- achievements ---- */
  function countAchievements(p) {
    let n = 0;
    for (const k in p.achievements) if (p.achievements[k]) ++n;
    return n;
  }

  function snapshot(p) {
    let skins = 0;
    for (const s of M.SKINS) if (isUnlocked(p, s)) ++skins;
    return Object.assign({}, p.stats, { stars: starsTotal(p), bosses: bossesBeaten(p), treeLevels: treeLevels(p), treeMax: treeMax(),
      skins: skins, streak: p.streak.best, level: p.level });
  }

  /* -> newly earned achievements (each pays 10 gems) */
  function checkAchievements(p) {
    const s = snapshot(p);
    const got = [];
    for (const a of M.ACHIEVEMENTS)
      if (!p.achievements[a.id] && a.test(s)) {
        p.achievements[a.id] = true;
        p.gems += 10;
        got.push(a);
      }
    return got;
  }

  /* ---- scores ---- */
  function addScore(list, entry, key, asc, keep) {
    list.push(entry);
    list.sort((a, b) => (asc ? a[key] - b[key] : b[key] - a[key]));
    list.length = Math.min(list.length, keep || 10);
    return list.indexOf(entry);
  }

  /* shards and XP a finished game pays: res { mode, score, lines, time, won, stars, mutatorShards } */
  function payout(p, res) {
    const base = 10 + res.lines * 2 + Math.floor(res.score / 2000) + (res.won ? 40 : 0) + (res.stars || 0) * 15;
    const shards = Math.round(base * gain(p, 'shardGain') * (res.mutatorShards || 1) * (res.mode === 'zen' ? 0.5 : 1));
    const xp = Math.round((20 + res.lines * 4 + res.score / 1500 + (res.won ? 60 : 0)) * gain(p, 'xpGain'));
    return { shards: shards, xp: xp };
  }

  Object.assign(NS.progress, {
    newProfile, migrateLegacy, nodeLevel, stat, nodeState, buyNode, treeLevels, treeMax, nodeText, powerUnlocked, xpFor, addXp, gain,
    starsOf, starsTotal, cleared, stageOpen, bossesBeaten, recordStage, isUnlocked, unlockText, buyCosmetic, rollQuests, questText,
    questProgress, touchStreak, streakGift, addTokens, countAchievements, snapshot, checkAchievements, addScore, payout,
  });
})();
