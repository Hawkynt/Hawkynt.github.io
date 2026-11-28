/* Profile rules as pure functions over a profile: its fresh shape and the migration of the old game's
   high scores, the tech tree, the engine options a song gets (tree, performer perk, boosters,
   mutators), XP, levels with a reward each and Fame, story stars and unlocking, Free Play bests and
   song mastery, owned songs, boosters, cosmetics and the daily offers, Record Crates with their
   rarity odds, duplicate refunds and pity, daily quests, the weekly challenge, the play streak and
   the welcome-back gift, festival tokens and their track, completion, achievements and payouts. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const M = NS.metaData;
  const W = NS.worldData;
  const SE = NS.seasons;
  const SD = NS.songData;
  const { makeRng, hashString, dayGap } = NS.rng;

  function newProfile() {
    return {
      v: 1, discs: 0, crystals: 0, xp: 0, level: 1, fame: 0, tree: {}, stars: {}, remix: {}, best: {}, achievements: {},
      owned: { songs: {}, cos: {} }, boosters: { net: 1, warm: 1 }, equip: { performer: 'lyra', note: 'orb', highway: 'neon', effect: 'spark' },
      crates: { owned: 0, pity: 0, opened: 0 },
      stats: { hits: 0, perfects: 0, misses: 0, bestCombo: 0, fullCombos: 0, sRanks: 0, sPlus: 0, songs: 0, cleared: 0, fails: 0, stages: 0, bosses: 0,
        expertClears: 0, marathonBest: 0, dailies: 0, zenSeconds: 0, rushWins: 0, surges: 0, hushDodged: 0, holds: 0, pickups: 0, phrases: 0,
        crates: 0, legendaries: 0, quests: 0, festivalDone: 0, playSeconds: 0, score: 0, calibrated: 0, nightSongs: 0, comebacks: 0, weeklies: 0, tours: 0 },
      scores: { marathon: [], daily: {}, weekly: {}, rush: [], legacy: [] },
      quests: null, weekly: null, streak: { last: '', count: 0, best: 0 }, lastDay: '',
      festival: { event: '', tokens: 0, claimed: 0 },
      seen: { intro: false, worlds: {}, bosses: {}, finale: false, help: false },
      settings: { speed: 5, offset: 0, relaxed: false, diff: 'normal', practice: 1, effects: 'high' },
      migrated: false,
    };
  }

  /* the old game's high-score list ([{ song, score, grade }]) -> kept as legacy records; -> entries */
  function migrateLegacy(profile, raw) {
    let list = null;
    try { list = JSON.parse(raw); } catch (_) { list = null; }
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const e of list) {
      if (!e || typeof e.score !== 'number' || !e.song) continue;
      profile.scores.legacy.push({ song: String(e.song).slice(0, 40), score: Math.max(0, Math.floor(e.score)), grade: String(e.grade || '').slice(0, 2) });
      ++n;
    }
    profile.scores.legacy.sort((a, b) => b.score - a.score);
    profile.scores.legacy.length = Math.min(profile.scores.legacy.length, 20);
    if (n) { profile.discs += 100 + n * 25; profile.migrated = true; }
    return n;
  }

  /* ---- tech tree and perks ---- */
  const nodeLevel = (p, id) => p.tree[id] || 0;

  function perkOf(p) {
    const pf = M.PERFORMERS.find(x => x.id === p.equip.performer) || M.PERFORMERS[0];
    return pf.perk || {};
  }

  function stat(p, name) {
    let v = 0;
    for (const n of M.TREE) if (n.stat === name && p.tree[n.id]) v += p.tree[n.id] * n.per;
    return v + (perkOf(p)[name] || 0);
  }

  function discount(p) {
    return Math.max(0.5, 1 - stat(p, 'discount'));
  }

  function nodeState(p, id) {
    const n = M.TREE_BY_ID[id];
    const lvl = nodeLevel(p, id);
    if (lvl >= n.costs.length) return 'maxed';
    for (const r of n.req) if (nodeLevel(p, r[0]) < r[1]) return 'locked';
    return p.discs >= n.costs[lvl] ? 'available' : 'expensive';
  }

  function buyNode(p, id) {
    if (nodeState(p, id) !== 'available') return false;
    const n = M.TREE_BY_ID[id];
    p.discs -= n.costs[nodeLevel(p, id)];
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
    const L = Math.max(1, lvl);
    return n.desc.replace('{p}', Math.round(n.per * L * 100) + '%').replace('{v}', Math.round(n.per * L * 100) / 100).replace('{ms}', Math.round(n.per * L * 1000));
  }

  /* engine options for a song: tree + perk, boosters ([ids]) and mutators ([ids]) */
  function engineOpts(p, boosters, mutators, extra) {
    boosters = boosters || [];
    mutators = mutators || [];
    const has = id => boosters.indexOf(id) >= 0;
    const mut = id => mutators.indexOf(id) >= 0;
    const o = {
      winBonus: 1 + stat(p, 'win'), focus: stat(p, 'focus') + (has('focus') ? 0.01 : 0),
      drain: Math.max(0.4, 1 - stat(p, 'drain')) * (mut('fragile') ? 2 : 1), regen: 1 + stat(p, 'regen'),
      grooveStart: Math.min(0.9, 0.5 + stat(p, 'grooveStart')), scoreGain: gain(p, 'scoreGain'),
      surgeFill: 1 + stat(p, 'surgeFill'), surgeBeats: 8 + stat(p, 'surgeBeats'), surgePower: 2 + stat(p, 'surgePower'),
      net: has('net') ? 3 : 0, rescue: has('wind') || stat(p, 'rescue') > 0, noSurge: mut('nosurge'),
      shieldStart: stat(p, 'shieldStart'), surgeStart: stat(p, 'surgeStart'), magnetLen: 8 + stat(p, 'magnetLen'), warm: has('warm'),
      noFail: !!p.settings.relaxed,
    };
    return Object.assign(o, extra || {});
  }

  /* ---- XP, levels and Fame ---- */
  function xpFor(level) {
    return Math.round(150 * Math.pow(level, 1.4));
  }

  function levelReward(level) {
    return { discs: 100 + level * 20, crystals: level % 3 === 0 ? 10 : 0, crate: level % 5 === 0 ? 1 : 0 };
  }

  /* -> the rewards of the levels gained */
  function addXp(p, amount) {
    p.xp += Math.max(0, Math.round(amount));
    const got = [];
    while (p.xp >= xpFor(p.level)) {
      p.xp -= xpFor(p.level);
      ++p.level;
      const r = levelReward(p.level);
      p.discs += r.discs;
      p.crystals += r.crystals;
      p.crates.owned += r.crate;
      got.push(Object.assign({ level: p.level }, r));
    }
    return got;
  }

  const FAME_LEVEL = 30, FAME_MAX = 10;
  function canTour(p) {
    return p.level >= FAME_LEVEL && p.fame < FAME_MAX;
  }

  function tour(p) {
    if (!canTour(p)) return false;
    ++p.fame;
    ++p.stats.tours;
    p.level = 1;
    p.xp = 0;
    p.crystals += 50;
    return true;
  }

  function fameMult(p) {
    return 1 + p.fame * 0.1 * (1 + stat(p, 'fameGain'));
  }

  function gain(p, name) {
    return 1 + stat(p, name) + stat(p, 'allGain');
  }

  /* ---- story ---- */
  function starsOf(p, id, remix) {
    const s = (remix ? p.remix : p.stars)[id];
    return s ? (s[0] ? 1 : 0) + (s[1] ? 1 : 0) + (s[2] ? 1 : 0) : 0;
  }

  function starsTotal(p, remix) {
    let n = 0;
    const src = remix ? p.remix : p.stars;
    for (const id in src) n += starsOf(p, id, remix);
    return n;
  }

  function cleared(p, id) {
    return !!(p.stars[id] && p.stars[id][0]);
  }

  function stageOpen(p, index) {
    return index === 0 || cleared(p, W.STAGES[index - 1].id);
  }

  function bossesBeaten(p) {
    let n = 0;
    for (const w of W.WORLDS) if (cleared(p, w.id + '-6')) ++n;
    return n;
  }

  /* -> { first, newStars, crystals } */
  function recordStage(p, id, got, remix) {
    const src = remix ? p.remix : p.stars;
    const prev = src[id] || [false, false, false];
    const now = [prev[0] || got[0], prev[1] || got[1], prev[2] || got[2]];
    let added = 0;
    for (let i = 0; i < 3; ++i) if (now[i] && !prev[i]) ++added;
    const first = !prev[0] && now[0];
    src[id] = now;
    let crystals = added * 3;
    if (added && now[0] && now[1] && now[2]) crystals += Math.round(stat(p, 'crystalBonus'));
    p.crystals += crystals;
    return { first: first, newStars: added, crystals: crystals };
  }

  /* ---- bests and mastery ---- */
  const GRADES = ['F', 'D', 'C', 'B', 'A', 'S', 'S+'];
  const gradeRank = g => GRADES.indexOf(g);

  /* res { score, grade, acc, fc } -> { newBest, prev } */
  function recordBest(p, key, res) {
    const prev = p.best[key] || null;
    const b = prev ? Object.assign({}, prev) : { score: 0, grade: 'F', acc: 0, fc: false, plays: 0 };
    b.plays = (b.plays || 0) + 1;
    const newBest = res.score > b.score;
    if (newBest) b.score = res.score;
    if (gradeRank(res.grade) > gradeRank(b.grade)) b.grade = res.grade;
    b.acc = Math.max(b.acc, res.acc);
    b.fc = b.fc || !!res.fc;
    p.best[key] = b;
    return { newBest: newBest && res.score > 0, prev: prev };
  }

  /* -1 (none) .. 4 (Diamond) from a song's four difficulties */
  function masteryOf(p, songId) {
    const g = d => { const b = p.best[songId + ':' + d]; return b ? gradeRank(b.grade) : -1; };
    let m = -1;
    if (['easy', 'normal', 'hard', 'expert'].some(d => g(d) >= 1)) m = 0;
    if (Math.max(g('normal'), g('hard'), g('expert')) >= 4) m = 1;
    if (Math.max(g('hard'), g('expert')) >= 4) m = 2;
    if (g('expert') >= 1) m = Math.max(m, 3);
    if (g('expert') >= 5) m = 4;
    return m;
  }

  /* ---- songs ---- */
  /* every song Free Play offers, with whether it is owned and why not */
  function library(p, date) {
    const out = [];
    for (const st of W.STAGES) {
      const s = SD.stageSong(st.world, st.stage);
      out.push({ song: s, id: s.id, name: st.name, group: W.WORLDS[st.world].name, owned: cleared(p, st.id), need: 'Clear it in the story', stage: st });
    }
    for (const s of SD.SHOP) out.push({ song: s, id: s.id, name: s.name, group: 'Record Shop', owned: !!p.owned.songs[s.id], price: Math.round(s.price * discount(p)) });
    const se = SE.seasonFor(date);
    const fs = SD.FESTIVAL[se.id];
    out.push({ song: fs, id: fs.id, name: fs.name, group: se.name, owned: true, festival: true });
    for (const k in SD.FESTIVAL) if (k !== se.id && p.owned.songs[SD.FESTIVAL[k].id]) out.push({ song: SD.FESTIVAL[k], id: SD.FESTIVAL[k].id, name: SD.FESTIVAL[k].name, group: 'Festival Archive', owned: true });
    return out;
  }

  function buySong(p, song) {
    const price = Math.round(song.price * discount(p));
    if (p.owned.songs[song.id] || p.discs < price) return false;
    p.discs -= price;
    p.owned.songs[song.id] = true;
    return true;
  }

  /* ---- boosters ---- */
  function slots(p) {
    return 1 + Math.round(stat(p, 'slots'));
  }

  function buyBooster(p, id, n) {
    const b = M.BOOSTER_BY_ID[id];
    n = n || 1;
    const price = Math.round(b.price * n * discount(p));
    if (p.discs < price) return false;
    p.discs -= price;
    p.boosters[id] = (p.boosters[id] || 0) + n;
    return true;
  }

  /* takes the chosen boosters out of the bag; -> the ones actually used */
  function useBoosters(p, list) {
    const used = [];
    for (const id of list.slice(0, slots(p))) if ((p.boosters[id] || 0) > 0) { --p.boosters[id]; used.push(id); }
    return used;
  }

  /* ---- cosmetics ---- */
  function completion(p) {
    const items = M.NOTES.concat(M.HIGHWAYS, M.EFFECTS, M.PERFORMERS).filter(i => i.unlock.k !== 'festival' && i.unlock.k !== 'complete');
    const own = items.filter(i => isUnlocked(p, i, true)).length;
    const ach = M.ACHIEVEMENTS.filter(a => !a.hidden);
    const achN = ach.filter(a => p.achievements[a.id]).length;
    const shop = SD.SHOP.filter(s => p.owned.songs[s.id]).length;
    const parts = [starsTotal(p) / 90, bossesBeaten(p) / 5, treeLevels(p) / treeMax(), own / items.length, achN / ach.length, shop / SD.SHOP.length];
    return parts.reduce((a, b) => a + b, 0) / parts.length;
  }

  function isUnlocked(p, item, noComplete) {
    const u = item.unlock;
    if (u.k === 'default') return true;
    if (p.owned.cos[item.id]) return true;
    if (u.k === 'stars') return starsTotal(p) >= u.n;
    if (u.k === 'level') return p.level >= u.n || p.fame > 0;
    if (u.k === 'ach') return countAchievements(p) >= u.n;
    if (u.k === 'fame') return p.fame >= u.n;
    if (u.k === 'complete') return !noComplete && completion(p) >= 0.999;
    return false;
  }

  function unlockText(item) {
    const u = item.unlock;
    if (u.k === 'crystals') return u.n + ' crystals';
    if (u.k === 'stars') return u.n + ' stars';
    if (u.k === 'level') return 'Player level ' + u.n;
    if (u.k === 'ach') return u.n + ' achievements';
    if (u.k === 'fame') return u.n + ' Fame star' + (u.n > 1 ? 's' : '');
    if (u.k === 'festival') return SE.SEASONS[u.id].name + ' reward';
    if (u.k === 'crate') return 'Record Crates';
    if (u.k === 'complete') return '100% completion';
    return '';
  }

  const OFFER_PRICE = { common: 40, rare: 90, epic: 160, legendary: 320 };
  function priceOf(item) {
    return item.unlock.k === 'crystals' ? item.unlock.n : OFFER_PRICE[item.rarity];
  }

  function buyCosmetic(p, item, price) {
    if (isUnlocked(p, item)) return false;
    const cost = price != null ? price : item.unlock.k === 'crystals' ? item.unlock.n : null;
    if (cost == null || p.crystals < cost) return false;
    p.crystals -= cost;
    p.owned.cos[item.id] = true;
    return true;
  }

  function slotOf(item) {
    for (const k in M.SLOTS) if (M.SLOTS[k].indexOf(item) >= 0) return k;
    return null;
  }

  function equip(p, slot, id) {
    const item = M.SLOTS[slot].find(x => x.id === id);
    if (!item || !isUnlocked(p, item)) return false;
    p.equip[slot] = id;
    return true;
  }

  function cosmeticsOwned(p) {
    let n = 0;
    for (const k in M.SLOTS) for (const i of M.SLOTS[k]) if (isUnlocked(p, i)) ++n;
    return n;
  }

  /* today's three offers: items not owned that a crystal price or a crate would give, 30% off */
  function dailyOffers(p, day) {
    const r = makeRng(hashString('offers-' + day));
    const pool = [];
    for (const k in M.SLOTS) for (const i of M.SLOTS[k]) if ((i.unlock.k === 'crystals' || i.unlock.k === 'crate') && !isUnlocked(p, i)) pool.push(i);
    const out = [];
    while (out.length < 3 && pool.length) {
      const item = pool.splice(r.int(pool.length), 1)[0];
      out.push({ item: item, slot: slotOf(item), price: Math.round(priceOf(item) * 0.7 * discount(p)), was: priceOf(item) });
    }
    return out;
  }

  /* ---- crates ---- */
  function buyCrate(p, currency) {
    if (currency === 'crystals') {
      if (p.crystals < M.CRATE.crystals) return false;
      p.crystals -= M.CRATE.crystals;
    } else {
      const price = Math.round(M.CRATE.discs * discount(p));
      if (p.discs < price) return false;
      p.discs -= price;
    }
    ++p.crates.owned;
    return true;
  }

  function crateItems() {
    const out = [];
    for (const k in M.SLOTS) for (const i of M.SLOTS[k]) if (i.unlock.k === 'crate' || i.unlock.k === 'crystals') out.push({ slot: k, item: i });
    return out;
  }

  /* opens one crate -> the three rolls; seed makes it reproducible */
  function openCrate(p, seed) {
    if (p.crates.owned <= 0) return null;
    --p.crates.owned;
    ++p.crates.opened;
    ++p.stats.crates;
    const r = makeRng(seed >>> 0 || hashString('crate-' + p.crates.opened));
    const pool = crateItems();
    const pityAt = M.CRATE.pity - Math.round(stat(p, 'crateLuck'));
    const rolls = [];
    let gotEpic = false;
    for (let k = 0; k < M.CRATE.items; ++k) {
      let rarity;
      const x = r.next() * 100;
      rarity = x < 1 ? 'legendary' : x < 8 ? 'epic' : x < 30 ? 'rare' : 'common';
      if (k === M.CRATE.items - 1 && !gotEpic && p.crates.pity + 1 >= pityAt) rarity = r.next() < 0.12 ? 'legendary' : 'epic';
      if (rarity === 'epic' || rarity === 'legendary') gotEpic = true;
      const ofRarity = pool.filter(e => e.item.rarity === rarity);
      if (rarity === 'common' && r.next() < 0.6) {
        if (r.next() < 0.5) {
          const b = M.BOOSTERS[r.int(M.BOOSTERS.length)];
          p.boosters[b.id] = (p.boosters[b.id] || 0) + 2;
          rolls.push({ type: 'booster', id: b.id, n: 2, rarity: 'common' });
        } else {
          const n = 150 + r.int(6) * 50;
          p.discs += n;
          rolls.push({ type: 'discs', n: n, rarity: 'common' });
        }
        continue;
      }
      const pick = ofRarity.length ? ofRarity[r.int(ofRarity.length)] : pool[r.int(pool.length)];
      const dup = isUnlocked(p, pick.item);
      const refund = dup ? M.RARITY[pick.item.rarity].refund : 0;
      if (dup) p.discs += refund;
      else p.owned.cos[pick.item.id] = true;
      if (pick.item.rarity === 'legendary') ++p.stats.legendaries;
      rolls.push({ type: 'cosmetic', slot: pick.slot, item: pick.item, rarity: pick.item.rarity, dup: dup, refund: refund });
    }
    p.crates.pity = gotEpic ? 0 : p.crates.pity + 1;
    return rolls;
  }

  /* ---- quests, weekly, streak, welcome back ---- */
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
    const t = M.QUESTS.find(x => x.id === q.id) || M.WEEKLY.find(x => x.id === q.id);
    return t.text.replace('{n}', q.n.toLocaleString ? q.n.toLocaleString('en-US') : q.n);
  }

  function rollWeekly(week) {
    const r = makeRng(hashString('weekly-' + week));
    const w = M.WEEKLY[r.int(M.WEEKLY.length)];
    return { week: week, id: w.id, n: w.n, reward: w.reward, progress: 0, done: false };
  }

  /* -> completed quests (with their reward paid) */
  function questProgress(p, kind, amount) {
    const done = [];
    const d = p.quests;
    if (d) {
      for (const q of d.list) {
        if (q.done || q.id !== kind) continue;
        const tpl = M.QUESTS.find(x => x.id === q.id);
        q.progress = tpl.max ? Math.max(q.progress, amount) : q.progress + amount;
        if (q.progress >= q.n) {
          q.done = true;
          const r = Math.round(q.reward * (1 + stat(p, 'questGain')));
          p.discs += r;
          ++p.stats.quests;
          done.push({ quest: q, reward: r });
        }
      }
      if (!d.bonus && d.list.every(q => q.done)) {
        d.bonus = true;
        p.crystals += 15;
        done.push({ bonus: true, reward: 15 });
      }
    }
    const w = p.weekly;
    if (w && !w.done && w.id === kind) {
      w.progress += amount;
      if (w.progress >= w.n) {
        w.done = true;
        p.crystals += w.reward.crystals;
        p.crates.owned += w.reward.crate;
        ++p.stats.weeklies;
        done.push({ weekly: w });
      }
    }
    return done;
  }

  function touchStreak(p, day) {
    const s = p.streak;
    if (s.last === day) return false;
    s.count = s.last && dayGap(s.last, day) === 1 ? s.count + 1 : 1;
    s.best = Math.max(s.best, s.count);
    s.last = day;
    return true;
  }

  function streakGift(count) {
    return { discs: 60 + Math.min(count, 30) * 20, crystals: count % 3 === 0 ? 5 + Math.min(count, 30) : 0, crate: count % 7 === 0 ? 1 : 0 };
  }

  /* away for three days or more: a gift growing with the days (capped at two weeks) */
  function welcomeBack(p, day) {
    const last = p.lastDay;
    p.lastDay = day;
    if (!last) return null;
    const gap = dayGap(last, day);
    if (gap < 3) return null;
    const d = Math.min(gap, 14);
    const gift = { days: gap, discs: d * 80, crystals: d * 3, crate: gap >= 7 ? 1 : 0 };
    p.discs += gift.discs;
    p.crystals += gift.crystals;
    p.crates.owned += gift.crate;
    return gift;
  }

  /* ---- festival ---- -> tiers claimed */
  function addTokens(p, n, date) {
    const ev = SE.eventId(date);
    const se = SE.seasonFor(date);
    if (p.festival.event !== ev) p.festival = { event: ev, tokens: 0, claimed: 0 };
    p.festival.tokens += Math.round(n * gain(p, 'tokenGain'));
    const got = [];
    while (p.festival.claimed < SE.TIERS.length && p.festival.tokens >= SE.TIERS[p.festival.claimed].n) {
      const t = SE.TIERS[p.festival.claimed];
      if (t.kind === 'discs') p.discs += t.amount;
      else if (t.kind === 'crystals') p.crystals += t.amount;
      else if (t.kind === 'crate') p.crates.owned += t.amount;
      else p.owned.cos[se[t.kind]] = true;
      got.push(t);
      ++p.festival.claimed;
      if (p.festival.claimed === SE.TIERS.length) { ++p.stats.festivalDone; p.owned.songs[SD.FESTIVAL[se.id].id] = true; }
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
    let diamonds = 0;
    const songs = {};
    for (const k in p.best) songs[k.split(':')[0]] = true;
    for (const id in songs) if (masteryOf(p, id) >= 4) ++diamonds;
    return Object.assign({}, p.stats, { stars: starsTotal(p), remixStars: starsTotal(p, true), bosses: bossesBeaten(p), treeLevels: treeLevels(p), treeMax: treeMax(),
      streak: p.streak.best, level: p.level, fame: p.fame, diamonds: diamonds, shopSongs: SD.SHOP.filter(s => p.owned.songs[s.id]).length, cosmetics: cosmeticsOwned(p) });
  }

  /* -> newly earned achievements (each pays 15 crystals) */
  function checkAchievements(p) {
    const s = snapshot(p);
    const got = [];
    for (const a of M.ACHIEVEMENTS)
      if (!p.achievements[a.id] && a.test(s)) {
        p.achievements[a.id] = true;
        p.crystals += 15;
        got.push(a);
      }
    return got;
  }

  function addScore(list, entry, key, keep) {
    list.push(entry);
    list.sort((a, b) => b[key] - a[key]);
    list.length = Math.min(list.length, keep || 10);
    return list.indexOf(entry);
  }

  /* discs, XP and tokens a finished song pays: res { mode, score, acc, hits, cleared, stars, mutDiscs, double, speed } */
  function payout(p, res) {
    let base = 15 + Math.floor(res.hits / 6) + Math.floor(res.score / 4000) + (res.cleared ? 40 : 0) + (res.stars || 0) * 20 + Math.round(Math.max(0, res.acc - 0.7) * 150);
    if (res.mode === 'zen') base *= 0.6;
    if (res.speed && res.speed < 1 && !stat(p, 'practicePay')) base *= res.speed * 0.8;
    const discs = Math.round(base * gain(p, 'discGain') * fameMult(p) * (res.mutDiscs || 1) * (res.double ? 2 : 1));
    const xp = Math.round((25 + res.hits / 4 + (res.cleared ? 60 : 0)) * gain(p, 'xpGain') * fameMult(p));
    const tokens = 4 + Math.floor(res.hits / 60) + (res.cleared ? 4 : 0);
    return { discs: discs, xp: xp, tokens: tokens };
  }

  Object.assign(NS.progress, {
    newProfile, migrateLegacy, nodeLevel, perkOf, stat, discount, nodeState, buyNode, treeLevels, treeMax, nodeText, engineOpts,
    xpFor, levelReward, addXp, FAME_LEVEL, FAME_MAX, canTour, tour, fameMult, gain,
    starsOf, starsTotal, cleared, stageOpen, bossesBeaten, recordStage, GRADES, gradeRank, recordBest, masteryOf,
    library, buySong, slots, buyBooster, useBoosters, completion, isUnlocked, unlockText, priceOf, buyCosmetic, slotOf, equip, cosmeticsOwned,
    dailyOffers, buyCrate, crateItems, openCrate, rollQuests, questText, rollWeekly, questProgress, touchStreak, streakGift, welcomeBack,
    addTokens, countAchievements, snapshot, checkAchievements, addScore, payout,
  });
})();
