/* Lifetime progress fed by play: statistics and the daily quests they advance, achievements and
   the cosmetics they unlock, festival tokens and the reward tiers of the running festival, the
   daily streak gift, scale income, and the toast queue that announces all of it. Owns
   G.ui.toasts; writes into G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const rules = NS.rules;
  const { ACHIEVEMENTS, QUEST_BONUS } = NS.goals;
  const { sfx } = NS.audio;

  let checkT = 0;

  function toast(text, color, icon) {
    const q = G.ui.toasts;
    if (q.length > 6) q.shift();
    q.push({ text: text, color: color || '#ffd25a', icon: icon || 'star', t: 0 });
  }

  function addScales(n) {
    if (!n) return;
    G.save.scales += n;
    G.save.stats.scalesEarned += n;
  }

  function questsDone(done) {
    for (let k = 0; k < done.length; ++k) {
      addScales(done[k].reward);
      toast('Quest done: ' + rules.questText(done[k].q) + '  +' + done[k].reward, '#7cff9a', 'check');
      sfx('levelup', { volume: 0.7 });
    }
    const q = G.save.quests;
    if (done.length && !q.bonus && q.list.every(x => x.done)) {
      q.bonus = true;
      addScales(QUEST_BONUS);
      toast('All daily quests done!  +' + QUEST_BONUS, '#ffd25a', 'gift');
    }
  }

  function isLive() {
    return G.run && G.run.mode !== 'demo';
  }

  function add(stat, n) {
    if (!isLive()) return;
    G.save.stats[stat] = (G.save.stats[stat] || 0) + n;
    questsDone(rules.questFeed(G.save, stat, n, false));
  }

  function best(stat, v) {
    if (!isLive()) return;
    if (v > (G.save.stats[stat] || 0)) G.save.stats[stat] = v;
    questsDone(rules.questFeed(G.save, stat, v, true));
  }

  function token(n) {
    if (!isLive() || !G.season) return;
    G.save.stats.tokens += n;
    questsDone(rules.questFeed(G.save, 'tokens', n, false));
    const ev = rules.eventRecord(G.save, G.eventId);
    ev.tokens += n;
    claimTiers();
  }

  function claimTiers() {
    if (!G.season) return;
    const due = rules.eventTiersDue(G.save, G.eventId);
    const ev = rules.eventRecord(G.save, G.eventId);
    for (let k = 0; k < due.length; ++k) {
      const t = due[k];
      ev.claimed.push(t);
      const rw = rules.eventReward(G.season.id, t);
      if (rw.kind === 'scales') {
        addScales(rw.amount);
        toast(G.season.name + ' reward: +' + rw.amount + ' scales', G.season.color, 'gift');
      } else {
        G.save.owned[rw.kind][rw.item.id] = 1;
        toast(G.season.name + ' reward: ' + rw.item.name + ' (' + rw.kind + ')', G.season.color, 'gift');
      }
      sfx('win', { volume: 0.7 });
    }
  }

  function checkAchievements() {
    const save = G.save;
    let any = false;
    for (let k = 0; k < ACHIEVEMENTS.length; ++k) {
      const a = ACHIEVEMENTS[k];
      if (save.achievements[a.id]) continue;
      if (rules.statValue(save, a.stat) < a.n) continue;
      save.achievements[a.id] = Date.now();
      addScales(a.reward);
      toast('Achievement: ' + a.name + '  +' + a.reward, '#ffd25a', a.icon);
      any = true;
    }
    const fresh = rules.refreshUnlocks(save);
    for (let k = 0; k < fresh.length; ++k) toast('Unlocked ' + fresh[k].kind + ': ' + fresh[k].item.name, '#6fd3ff', 'gift');
    if (any) sfx('win', { volume: 0.6 });
    return any;
  }

  /* every frame: achievements are checked twice a second, toasts age */
  function tick(dt) {
    checkT -= dt;
    if (checkT <= 0) {
      checkT = 0.5;
      checkAchievements();
    }
    const q = G.ui.toasts;
    if (q.length) {
      q[0].t += dt;
      if (q[0].t > 3.2) q.shift();
    }
  }

  /* the day's bookkeeping: streak gift and fresh quests (also when the date rolls over) */
  function dayStart() {
    const save = G.save;
    const gift = rules.touchStreak(save, G.today, G.stats);
    rules.ensureQuests(save, G.today);
    if (gift) {
      addScales(gift);
      toast('Day ' + save.streak.count + ' streak gift: +' + gift + ' scales', '#ff9ac0', 'heart');
    }
    claimTiers();
    checkAchievements();
    NS.save.writeSave();
  }

  Object.assign(NS.progress, {
    toast, addScales, add, best, token, claimTiers, checkAchievements, tick, dayStart
  });
})();
