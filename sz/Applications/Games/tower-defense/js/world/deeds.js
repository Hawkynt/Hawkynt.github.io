/* world/deeds.js -- what the battlefield does to the keep-coming-back layer: kills, bosses, waves
   held, towers built and upgraded, maps cleared and Daily Sieges become statistics, quest progress,
   festival tokens, achievements and skin unlocks (all rules in core/goals.js); new unlocks queue
   small toasts; the meta save is written a few seconds after a change. Also starts the Daily
   Siege and applies its twist.
   Owns state: G.goalToasts, G.daily
   Reads: goals, maps, progress, towerArt and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const Q = NS.goals;

  G.goalToasts = [];
  G.daily = null;          // { day, map, twist } while a Daily Siege runs
  let dirty = false, saveT = 0, killTokens = 0;

  function toast(title, sub, color) {
    G.goalToasts.push({ title: title, sub: sub || '', color: color || '#ffd75a', t: 0 });
    if (G.goalToasts.length > 4) G.goalToasts.shift();
  }

  function applySkin() {
    if (NS.towerArt && NS.towerArt.setSkin) NS.towerArt.setSkin(Q.SKIN_BY_ID[G.meta.skins.equipped]);
  }

  /* after the meta save loads: defaults, today's quests, the streak, skins earned meanwhile */
  function init() {
    Q.repair(G.meta);
    const today = Q.dayKey();
    Q.rollQuests(G.meta, today);
    const before = G.meta.streak.count;
    Q.touchStreak(G.meta, today);
    if (G.meta.streak.count > 1 && G.meta.streak.count !== before) toast('Day streak ' + G.meta.streak.count, 'Welcome back, warden', '#ffab40');
    Q.record(G.meta, 'stars', NS.progress.totalStars());
    settle();
    applySkin();
    dirty = true;
  }

  function settle() {
    for (const a of Q.checkAchievements(G.meta)) toast('Achievement: ' + a.name, a.desc + '  ·  +' + a.rp + ' research', '#ffd54f');
    for (const s of Q.unlockSkins(G.meta)) toast('Tower skin: ' + s.name, 'Equip it under Goals', '#9be7ff');
  }

  /* one kind of deed: the statistic, today's quests, festival tokens, then unlocks */
  function deed(kind, n, tokens) {
    if (!G.meta || !G.meta.stats) return;
    Q.bump(G.meta, kind, n);
    for (const q of Q.progress(G.meta, kind, n)) toast('Quest done: ' + q.text, '+' + q.rp + ' research', '#7ae08a');
    if (tokens) {
      const fe = Q.festivalFor(new Date());
      for (const t of Q.addTokens(G.meta, tokens, new Date()))
        toast(fe.name + ' reward', t.kind === 'skin' ? 'Tower skin: ' + Q.SKIN_BY_ID[t.skin].name : '+' + t.amount + ' research', fe.color);
    }
    settle();
    dirty = true;
  }

  function onKill(bounty) {
    killTokens += 0.1;
    const tk = Math.floor(killTokens);
    killTokens -= tk;
    deed('kills', 1, tk);
    if (bounty > 0) deed('gold', bounty, 0);
  }

  function onBoss() { deed('bosses', 1, 15); }
  function onBuild() { deed('towers', 1, 0); }
  function onUpgrade(special) {
    deed('upgrades', 1, 0);
    if (special) deed('specials', 1, 0);
  }
  function onWaveHeld() {
    Q.record(G.meta, 'bestWave', G.currentWave);
    deed('waves', 1, 3);
    if (G.daily && G.daily.map === G.currentMap) {
      if (!G.daily.counted) {
        /* the first wave held counts the Daily Siege as played */
        G.daily.counted = true;
        Q.dailyResult(G.meta, G.daily.day, G.currentWave);
        deed('dailies', 0, 20);
        for (const q of Q.progress(G.meta, 'dailies', 1)) toast('Quest done: ' + q.text, '+' + q.rp + ' research', '#7ae08a');
      } else if (G.meta.daily.day === G.daily.day && G.currentWave > G.meta.daily.best) {
        G.meta.daily.best = G.currentWave;
        dirty = true;
      }
    }
  }
  function onMapCleared(stars) {
    Q.record(G.meta, 'stars', NS.progress.totalStars());
    deed('maps', 1, 25);
    if (stars >= 3) deed('perfect', 1, 15);
  }

  /* the end of a run: the Daily Siege announces the best wave of the day */
  function onRunEnd(reached) {
    Q.record(G.meta, 'bestWave', reached);
    if (G.daily && G.daily.counted && G.meta.daily.day === G.daily.day && reached >= G.meta.daily.best)
      toast('Daily Siege: wave ' + reached, 'Best today  ·  ' + G.daily.twist.name, '#ff7ad8');
    G.daily = null;
    settle();
    flush();
  }

  /* ── Daily Siege ── */
  function todaysSiege() {
    return Q.dailyRecipe(Q.dayKey(), NS.maps.MAPS.length);
  }

  function startDaily() {
    const r = todaysSiege();
    G.daily = { day: r.day, map: r.map, twist: r.twist };
    G.currentMap = r.map;
    G.mapSelectIndex = r.map;
    G.introNext = true;
    NS.savegame.requestNewGame();
  }

  const NONE = { speed: 1, hp: 1, gold: 1, lives: 0, startGold: 1 };
  function twist() {
    return G.daily && G.daily.map === G.currentMap ? G.daily.twist : NONE;
  }

  function equip(id) {
    if (!Q.equipSkin(G.meta, id)) return false;
    applySkin();
    dirty = true;
    return true;
  }

  function flush() {
    if (!dirty) return;
    dirty = false;
    saveT = 0;
    NS.progress.saveMeta();
  }

  function update(dt) {
    for (const t of G.goalToasts) t.t += dt;
    while (G.goalToasts.length && G.goalToasts[0].t > 4.5) G.goalToasts.shift();
    if (dirty && (saveT += dt) > 4) flush();
  }

  NS.deeds = { init, deed, onKill, onBoss, onBuild, onUpgrade, onWaveHeld, onMapCleared, onRunEnd, todaysSiege, startDaily, twist, equip, flush, update, toast };
})();
