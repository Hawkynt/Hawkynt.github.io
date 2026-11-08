/* Collection rules as pure functions over a save: whether an item is owned (from the start,
   bought, earned with achievements, belt licences or the Crown, or claimed on a festival track),
   what unlocks it, buying with credits or research, equipping, the ship colours a livery lays
   over a hull, the equipped beam and plume, and the festival track - tokens from trips while a
   season runs, paying credits, research and that season's livery, beam and plume. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const D = NS.cosmeticData;

  const KEY = { livery: 'livery', beam: 'beam', plume: 'plume' };

  function blank() {
    return { livery: 'factory', beam: 'standard', plume: 'standard', owned: {} };
  }

  function list(kind) {
    return D.BY_KIND[kind];
  }

  function item(kind, id) {
    return list(kind).find(x => x.id === id) || list(kind)[0];
  }

  function achCount(save) {
    let n = 0;
    for (const k in save.achievements) if (save.achievements[k]) ++n;
    return n;
  }

  function owned(save, kind, it) {
    const u = it.unlock;
    if (u.k === 'default') return true;
    const c = save.cosmetics || blank();
    if (c.owned[kind + ':' + it.id]) return true;
    if (u.k === 'ach') return achCount(save) >= u.n;
    if (u.k === 'licenses') return (save.licenses || []).length >= u.n;
    if (u.k === 'crown') return !!save.crownDone;
    return false;
  }

  function unlockText(it) {
    const u = it.unlock;
    if (u.k === 'credits') return u.n.toLocaleString('en-US') + ' credits';
    if (u.k === 'rd') return u.n + ' research';
    if (u.k === 'ach') return u.n + ' achievements';
    if (u.k === 'licenses') return u.n + ' belt licences';
    if (u.k === 'crown') return 'Break the Crown';
    if (u.k === 'festival') { const s = NS.eventData.SEASONS.find(x => x.id === u.id); return (s ? s.name : 'Festival') + ' reward'; }
    return '';
  }

  /* -> true when bought (credits or research) */
  function buy(save, kind, it) {
    if (owned(save, kind, it)) return false;
    const u = it.unlock;
    if (u.k === 'credits' && save.credits >= u.n) save.credits -= u.n;
    else if (u.k === 'rd' && save.rd >= u.n) save.rd -= u.n;
    else return false;
    save.cosmetics.owned[kind + ':' + it.id] = true;
    return true;
  }

  function equip(save, kind, id) {
    const it = list(kind).find(x => x.id === id);
    if (!it || !owned(save, kind, it)) return false;
    save.cosmetics[KEY[kind]] = id;
    return true;
  }

  function equipped(save, kind) {
    const c = save.cosmetics || blank();
    const it = item(kind, c[KEY[kind]]);
    return owned(save, kind, it) ? it : list(kind)[0];
  }

  /* a hull's colours with the equipped livery laid over them */
  function colorsFor(save, hullColors) {
    const lv = equipped(save, 'livery');
    const plume = equipped(save, 'plume');
    const out = Object.assign({}, hullColors, lv.colors || {});
    if (plume.color) out.glow = plume.color;
    return out;
  }

  /* the season's own item of a kind */
  function festivalItem(seasonId, kind) {
    return list(kind).find(x => x.unlock.k === 'festival' && x.unlock.id === seasonId) || null;
  }

  function eventId(season, date) {
    const d = date || new Date();
    const y = d.getFullYear() - (season.m0 > season.m1 && d.getMonth() + 1 <= season.m1 ? 1 : 0);
    return season.id + '-' + y;
  }

  /* tokens a finished trip earns: one per 400 credits of value, at least one for any haul */
  function tokensFor(value) {
    return value > 0 ? Math.max(1, Math.floor(value / 400)) : 0;
  }

  /* -> rewards claimed; nothing when no season runs */
  function addTokens(save, n, date) {
    const se = NS.calendar.season(date);
    if (!se || n <= 0) return [];
    const ev = eventId(se, date);
    if (!save.festival || save.festival.event !== ev) save.festival = { event: ev, tokens: 0, claimed: 0 };
    save.festival.tokens += n;
    const got = [];
    while (save.festival.claimed < D.TIERS.length && save.festival.tokens >= D.TIERS[save.festival.claimed].n) {
      const t = D.TIERS[save.festival.claimed];
      if (t.kind === 'credits') save.credits += t.amount;
      else if (t.kind === 'rd') save.rd += t.amount;
      else {
        const it = festivalItem(se.id, t.kind);
        if (it) save.cosmetics.owned[t.kind + ':' + it.id] = true;
      }
      got.push(Object.assign({ season: se.id }, t));
      ++save.festival.claimed;
    }
    return got;
  }

  /* a stored cosmetics block made safe */
  function repair(src) {
    const c = blank();
    if (src && typeof src === 'object') {
      for (const k of ['livery', 'beam', 'plume'])
        if (typeof src[k] === 'string' && list(k).some(x => x.id === src[k])) c[k] = src[k];
      if (src.owned && typeof src.owned === 'object')
        for (const k in src.owned) if (src.owned[k] === true && /^(livery|beam|plume):[a-z]{1,20}$/.test(k)) c.owned[k] = true;
    }
    return c;
  }

  function repairFestival(src) {
    if (!src || typeof src !== 'object' || typeof src.event !== 'string') return { event: '', tokens: 0, claimed: 0 };
    return { event: src.event.slice(0, 30), tokens: Math.max(0, Math.floor(+src.tokens || 0)), claimed: Math.max(0, Math.min(D.TIERS.length, Math.floor(+src.claimed || 0))) };
  }

  Object.assign(NS.cosmetics, { blank, list, item, achCount, owned, unlockText, buy, equip, equipped, colorsFor, festivalItem, eventId, tokensFor, addTokens, repair, repairFestival });
})();
