/* Lifetime bookkeeping for the long game: stat counters and records, seasonal tokens (also the
   event track), play time, and the achievement/unlock check that pays rewards and raises
   toasts. Writes the save in the background now and then. Mutates G.save.stats. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;
  const rules = NS.rules;

  let checkT = 0;
  let writeT = 0;

  function stat(key, n) {
    const s = G.save.stats;
    s[key] = (s[key] || 0) + n;
  }

  function best(key, v) {
    const s = G.save.stats;
    if (v > (s[key] || 0)) s[key] = v;
  }

  function token(n) {
    stat('tokens', n);
    G.save.event.tokens += n;
  }

  /* Pays any new achievements and unlocks, announcing each */
  function check() {
    const got = rules.checkAchievements(G.save);
    for (let i = 0; i < got.length; ++i) {
      NS.screens.toast('Achievement: ' + got[i].name + '  +' + got[i].gems + ' gems', '#ffd84a', 'trophy');
      NS.fx.sfx('levelup', { pitch: 1.4, volume: 0.6 });
    }
    const unl = rules.unlockEarned(G.save);
    for (let i = 0; i < unl.length; ++i) NS.screens.toast('Unlocked: ' + unl[i].item.name, '#7cf08a', 'gift');
    if (got.length || unl.length) NS.save.writeSave();
    return got.length + unl.length;
  }

  /* Called every step: play time, a periodic achievement check and a background save */
  function tick(dt) {
    if (!G.save) return;
    if (G.screen === 'playing') stat('playTime', dt);
    checkT += dt;
    if (checkT > 1.5) {
      checkT = 0;
      check();
    }
    writeT += dt;
    if (writeT > 20) {
      writeT = 0;
      NS.save.writeSave();
    }
  }

  Object.assign(NS.tracker, {
    stat, best, token, check, tick
  });
})();
