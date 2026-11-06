/* Notices how a round ended without the variants having to say so: from the
   host's round-over callback, from big win/lose banners, and from result texts
   a variant paints. Records the result once per round and starts the scene. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const S = NS.state;
  const P = NS.profile;
  const O = NS.outcomes = NS.outcomes || {};

  const WIN_RE = /\b(you win|you won|you are the winner|you're the winner|congratulations|victory|you are president|you're president|player wins)\b/i;
  const LOSE_RE = /\b(you lose|you lost|ai wins|dealer wins|computer wins|you are the old maid|you're the old maid|you are scum|banker wins|game over)\b/i;

  let lock = null;      /* null | { level: 'round' | 'full', reward, at } */
  let pending = null;   /* scene waiting for a short delay so the table can celebrate first */
  let time = 0;
  const textCache = new Map();

  O.reset = function() {
    lock = null;
    pending = null;
  };

  O.update = function(dt) {
    time += dt;
    if (pending && time >= pending.at) {
      const p = pending;
      pending = null;
      if (NS.scenes) NS.scenes.result(S.currentVariant, p.reward, p.full);
    }
  };

  O.busy = () => !!pending;

  /* outcome: 'win' | 'loss' | 'draw'; full: the whole game ended */
  O.report = function(outcome, full, delay) {
    const v = S.currentVariant;
    if (!v || S.state === 'MENU') return;
    if (lock && (lock.level === 'full' || !full)) return;
    let reward;
    if (lock && lock.level === 'round' && time - lock.at < 6)
      reward = lock.reward;
    else
      reward = P.recordResult(v.id, outcome);
    if (lock && lock.level === 'round' && reward.outcome !== outcome && full) reward.outcome = outcome;
    lock = { level: full ? 'full' : 'round', reward, at: time };
    pending = { at: time + (delay == null ? (full ? 1.1 : 0.2) : delay), reward, full };
  };

  /* a click on a finished table lets the next deal count again */
  O.onPlayerAction = function() {
    if (lock && !pending && time - lock.at > 2.5 && (!NS.scenes || !NS.scenes.active())) lock = null;
  };

  /* texts a variant paints on the table (cached per string) */
  O.scanText = function(text) {
    if (lock && lock.level === 'full') return;
    let r = textCache.get(text);
    if (r === undefined) {
      const t = String(text);
      r = t.length > 60 ? 0 : WIN_RE.test(t) ? 1 : LOSE_RE.test(t) ? -1 : 0;
      if (textCache.size > 2000) textCache.clear();
      textCache.set(text, r);
    }
    if (r === 1) O.report('win', true);
    else if (r === -1) O.report('loss', true);
  };

  /* big floating banners: only explicit win / lose wording counts */
  O.scanBanner = function(text) {
    const t = String(text);
    if (WIN_RE.test(t)) O.report('win', /game|match/i.test(t));
    else if (LOSE_RE.test(t)) O.report('loss', /game over|match/i.test(t));
  };
})();
