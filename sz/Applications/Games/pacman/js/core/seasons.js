/* Calendar logic from the local date: which seasonal event runs (year-end and Halloween win over
   the plain seasons), its key for the per-event track, the reward track tiers and claiming them,
   the daily maze seed and modifiers, and the featured modifier of the week. Pure; the date is
   always passed in or read from the clock once. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const { SEASONS, SEASON_TRACK, SEASON_BY_ID } = NS.cosmetics;
  const { MODIFIERS } = NS.items;
  const RNG = NS.rng;

  /* month*100 + day, so ranges compare as numbers; ranges may wrap over new year */
  function md(d) {
    return (d.getMonth() + 1) * 100 + d.getDate();
  }

  function inRange(v, from, to) {
    const a = from[0] * 100 + from[1], b = to[0] * 100 + to[1];
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  }

  /* The running event for a date; SEASONS is ordered by priority */
  function seasonFor(date) {
    const d = date || new Date();
    const v = md(d);
    for (let i = 0; i < SEASONS.length; ++i)
      if (inRange(v, SEASONS[i].from, SEASONS[i].to)) return SEASONS[i];
    return SEASONS[SEASONS.length - 1];
  }

  /* One track per event and year; an event spanning new year keeps the year it started in */
  function seasonKey(date) {
    const d = date || new Date();
    const s = seasonFor(d);
    let y = d.getFullYear();
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
    if (a > b && md(d) <= b) --y;
    return s.id + '-' + y;
  }

  /* Days left in the running event */
  function daysLeft(date) {
    const d = date || new Date();
    const s = seasonFor(d);
    let y = d.getFullYear();
    const b = s.to[0] * 100 + s.to[1];
    if (md(d) > b) ++y;
    const end = new Date(y, s.to[0] - 1, s.to[1]);
    if (end.getMonth() !== s.to[0] - 1) end.setDate(0);
    return Math.max(0, Math.round((end - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)) + 1;
  }

  function tierOf(tokens) {
    let t = 0;
    while (t < SEASON_TRACK.length && tokens >= SEASON_TRACK[t]) ++t;
    return t;
  }

  /* Starts a fresh track when the event changed */
  function syncSeason(p, date) {
    const key = seasonKey(date);
    if (p.season.key !== key) {
      p.season = { key: key, tokens: 0, claimed: [] };
      return true;
    }
    return false;
  }

  /* Applies every reached, unclaimed tier; returns [{ tier, reward, label }] */
  function claimTiers(p, date) {
    const s = seasonFor(date);
    const out = [];
    const reached = tierOf(p.season.tokens);
    for (let t = 0; t < reached; ++t) {
      if (p.season.claimed.indexOf(t) >= 0) continue;
      p.season.claimed.push(t);
      const r = s.rewards[t].split(':');
      let label = '';
      if (r[0] === 'shards') {
        NS.rules.addShards(p, +r[1]);
        label = r[1] + ' shards';
      } else {
        const kind = r[0];
        NS.rules.grant(p, kind, r[1]);
        const item = NS.rules.listFor(kind).find(c => c.id === r[1]);
        label = (kind === 'skin' ? 'Skin: ' : 'Trail: ') + (item ? item.name : r[1]);
      }
      p.stats.seasonTiers = (p.stats.seasonTiers || 0) + 1;
      out.push({ tier: t, reward: s.rewards[t], label: label });
    }
    return out;
  }

  function rewardLabel(s, t) {
    const r = s.rewards[t].split(':');
    if (r[0] === 'shards') return r[1] + ' shards';
    const item = NS.rules.listFor(r[0]).find(c => c.id === r[1]);
    return (r[0] === 'skin' ? 'Skin ' : 'Trail ') + (item ? item.name : r[1]);
  }

  /* The daily maze: a seed and two modifiers from the date */
  function daily(date) {
    const key = RNG.dayKey(date);
    const rng = RNG.makeRng(RNG.hashString('daily:' + key));
    const pool = MODIFIERS.slice();
    const mods = [];
    for (let i = 0; i < 2; ++i) {
      const k = Math.floor(rng() * pool.length);
      mods.push(pool[k].id);
      pool.splice(k, 1);
    }
    return { key: key, seed: RNG.hashString('maze:' + key), mods: mods, world: Math.floor(rng() * 5) };
  }

  /* The modifier of the week, used by Arcade as an optional twist */
  function weekly(date) {
    const key = RNG.weekKey(date);
    return MODIFIERS[RNG.hashString('week:' + key) % MODIFIERS.length];
  }

  Object.assign(NS.seasons, {
    seasonFor, seasonKey, daysLeft, tierOf, syncSeason, claimTiers, rewardLabel, daily, weekly, SEASON_BY_ID
  });
})();
