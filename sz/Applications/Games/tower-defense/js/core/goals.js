/* core/goals.js -- the keep-coming-back layer, pure rules over G.meta: lifetime statistics,
   achievements that pay research, three daily quests and the day streak, the six real-date
   festivals with a six-tier token track (research and a festival tower skin), tower skins
   unlocked by deeds and equipped, and the Daily Siege (one map and one twist per day for
   everyone, the best wave of the day kept).
   Owns state: G.meta.stats, ach, quests, streak, festival, skins, daily
   Reads: nothing (pure). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  /* ── statistics ── */
  const STATS = ['kills', 'bosses', 'waves', 'maps', 'perfect', 'towers', 'upgrades', 'specials', 'gold', 'leaks',
    'dailies', 'quests', 'festivals', 'bestWave', 'bestStreak', 'stars'];

  /* ── achievements: a statistic reaching a threshold ── */
  const A = (id, name, stat, n, rp, desc) => ({ id, name, stat, n, rp, desc });
  const ACHIEVEMENTS = [
    A('kill1', 'First Blood', 'kills', 1, 1, 'Defeat a monster'),
    A('kill500', 'Wall of Arrows', 'kills', 500, 2, 'Defeat 500 monsters'),
    A('kill2500', 'Grim Harvest', 'kills', 2500, 3, 'Defeat 2,500 monsters'),
    A('kill10k', 'Legion Breaker', 'kills', 10000, 5, 'Defeat 10,000 monsters'),
    A('kill50k', 'The Unbreached', 'kills', 50000, 8, 'Defeat 50,000 monsters'),
    A('boss1', 'Giant Slayer', 'bosses', 1, 2, 'Defeat a boss'),
    A('boss10', 'Warlord\'s Bane', 'bosses', 10, 4, 'Defeat 10 bosses'),
    A('boss50', 'Dragon Hunter', 'bosses', 50, 8, 'Defeat 50 bosses'),
    A('wave25', 'Holding the Line', 'waves', 25, 1, 'Hold 25 waves'),
    A('wave100', 'Siege Veteran', 'waves', 100, 3, 'Hold 100 waves'),
    A('wave500', 'Iron Garrison', 'waves', 500, 5, 'Hold 500 waves'),
    A('wave2000', 'Eternal Watch', 'waves', 2000, 8, 'Hold 2,000 waves'),
    A('map1', 'Greenvale Saved', 'maps', 1, 1, 'Clear a map'),
    A('map5', 'Realm Warden', 'maps', 5, 3, 'Clear maps 5 times'),
    A('map12', 'Campaigner', 'maps', 12, 4, 'Clear maps 12 times'),
    A('map24', 'Defender of All', 'maps', 24, 6, 'Clear maps 24 times'),
    A('perfect1', 'Not a Scratch', 'perfect', 1, 2, 'Clear a map with three stars'),
    A('perfect10', 'Flawless Keep', 'perfect', 10, 4, 'Clear maps with three stars 10 times'),
    A('perfect24', 'Untouchable', 'perfect', 24, 8, 'Clear maps with three stars 24 times'),
    A('star30', 'Starlit', 'stars', 30, 3, 'Hold 30 campaign stars'),
    A('star60', 'Constellation', 'stars', 60, 6, 'Hold 60 campaign stars'),
    A('tower50', 'Architect', 'towers', 50, 1, 'Build 50 towers'),
    A('tower500', 'Master Builder', 'towers', 500, 4, 'Build 500 towers'),
    A('up25', 'Tinkerer', 'upgrades', 25, 1, 'Upgrade towers 25 times'),
    A('up250', 'Grand Engineer', 'upgrades', 250, 4, 'Upgrade towers 250 times'),
    A('spec10', 'Specialist', 'specials', 10, 2, 'Choose 10 tower specializations'),
    A('gold10k', 'Treasury', 'gold', 10000, 2, 'Earn 10,000 gold in battle'),
    A('gold100k', 'Dragon\'s Hoard', 'gold', 100000, 5, 'Earn 100,000 gold in battle'),
    A('best30', 'Long Night', 'bestWave', 30, 2, 'Reach wave 30 on any map'),
    A('best50', 'Endless Vigil', 'bestWave', 50, 4, 'Reach wave 50 on any map'),
    A('best100', 'Beyond the Horizon', 'bestWave', 100, 8, 'Reach wave 100 on any map'),
    A('daily1', 'Daily Siege', 'dailies', 1, 1, 'Play a Daily Siege'),
    A('daily10', 'Regular Defender', 'dailies', 10, 3, 'Play 10 Daily Sieges'),
    A('streak7', 'Seven Dawns', 'bestStreak', 7, 4, 'Play seven days in a row'),
    A('quest10', 'Errand Knight', 'quests', 10, 3, 'Complete 10 daily quests'),
    A('fest1', 'Festive Walls', 'festivals', 1, 3, 'Finish a festival track'),
  ];
  const ACH_BY_ID = {};
  for (const a of ACHIEVEMENTS) ACH_BY_ID[a.id] = a;

  /* ── daily quests: a statistic grown by an amount during the day ── */
  const QUEST_POOL = [
    { id: 'q-kills', kind: 'kills', n: 300, rp: 2, text: 'Defeat 300 monsters' },
    { id: 'q-kills2', kind: 'kills', n: 800, rp: 3, text: 'Defeat 800 monsters' },
    { id: 'q-waves', kind: 'waves', n: 15, rp: 2, text: 'Hold 15 waves' },
    { id: 'q-waves2', kind: 'waves', n: 40, rp: 3, text: 'Hold 40 waves' },
    { id: 'q-map', kind: 'maps', n: 1, rp: 3, text: 'Clear a map' },
    { id: 'q-perfect', kind: 'perfect', n: 1, rp: 4, text: 'Clear a map with three stars' },
    { id: 'q-towers', kind: 'towers', n: 20, rp: 2, text: 'Build 20 towers' },
    { id: 'q-upgrades', kind: 'upgrades', n: 10, rp: 2, text: 'Upgrade towers 10 times' },
    { id: 'q-boss', kind: 'bosses', n: 1, rp: 3, text: 'Defeat a boss' },
    { id: 'q-gold', kind: 'gold', n: 3000, rp: 2, text: 'Earn 3,000 gold in battle' },
    { id: 'q-daily', kind: 'dailies', n: 1, rp: 2, text: 'Play the Daily Siege' },
  ];

  /* ── festivals (by the local date) and their tracks ── */
  const FESTIVALS = {
    frost: { id: 'frost', name: 'Frostfall', token: 'snowflakes', color: '#bff4ff', skin: 'frostglass' },
    bloom: { id: 'bloom', name: 'Bloom Festival', token: 'blossoms', color: '#ffb0d0', skin: 'bloom' },
    sunfest: { id: 'sunfest', name: 'Sunfest', token: 'sun drops', color: '#ffe07a', skin: 'sunfire' },
    harvest: { id: 'harvest', name: 'Harvest Moon', token: 'acorns', color: '#e0902a', skin: 'harvest' },
    hollow: { id: 'hollow', name: 'Hollow Night', token: 'candies', color: '#ff8a1a', skin: 'pumpkin' },
    starfall: { id: 'starfall', name: 'Starfall Eve', token: 'sparklers', color: '#ffd23a', skin: 'starlight' },
  };
  const FESTIVAL_ORDER = ['frost', 'bloom', 'sunfest', 'harvest', 'hollow', 'starfall'];
  const TIERS = [
    { n: 40, kind: 'rp', amount: 2 },
    { n: 120, kind: 'rp', amount: 3 },
    { n: 250, kind: 'rp', amount: 4 },
    { n: 450, kind: 'skin' },
    { n: 700, kind: 'rp', amount: 6 },
    { n: 1000, kind: 'rp', amount: 10 },
  ];

  /* ── tower skins: a tint for the stone and a colour for the trim ── */
  const S = (id, name, mat, t, trim, unlock) => ({ id, name, mat, t, trim, unlock });
  const SKINS = [
    S('classic', 'Classic Stone', null, 0, null, { kind: 'free' }),
    S('moss', 'Mossgrown', '#5a9a4a', 0.45, '#c8e070', { kind: 'stat', stat: 'maps', n: 5, text: 'Clear maps 5 times' }),
    S('sandstone', 'Sandstone', '#e0b878', 0.5, '#ffe6a0', { kind: 'stat', stat: 'waves', n: 100, text: 'Hold 100 waves' }),
    S('ember', 'Emberforged', '#c0482a', 0.5, '#ffb04a', { kind: 'stat', stat: 'bosses', n: 10, text: 'Defeat 10 bosses' }),
    S('marble', 'White Marble', '#f2f2fa', 0.55, '#ffd75a', { kind: 'stat', stat: 'kills', n: 10000, text: 'Defeat 10,000 monsters' }),
    S('obsidian', 'Obsidian', '#2e2440', 0.6, '#c04cff', { kind: 'stat', stat: 'stars', n: 30, text: 'Hold 30 campaign stars' }),
    S('gilded', 'Gilded', '#ffd75a', 0.5, '#fff2b0', { kind: 'stat', stat: 'perfect', n: 10, text: 'Clear maps with three stars 10 times' }),
    S('azure', 'Azure Keep', '#3a7ad8', 0.5, '#bfe8ff', { kind: 'stat', stat: 'dailies', n: 7, text: 'Play 7 Daily Sieges' }),
    S('frostglass', 'Frostglass', '#9ae4ff', 0.5, '#ffffff', { kind: 'festival', id: 'frost', text: 'Frostfall festival track' }),
    S('bloom', 'Bloomstone', '#ff9ad0', 0.45, '#7ae08a', { kind: 'festival', id: 'bloom', text: 'Bloom Festival track' }),
    S('sunfire', 'Sunfire', '#ff9a3a', 0.5, '#ffe07a', { kind: 'festival', id: 'sunfest', text: 'Sunfest track' }),
    S('harvest', 'Harvest Oak', '#b0703a', 0.5, '#e0b040', { kind: 'festival', id: 'harvest', text: 'Harvest Moon track' }),
    S('pumpkin', 'Pumpkin Watch', '#ff7a1a', 0.55, '#5a2a8a', { kind: 'festival', id: 'hollow', text: 'Hollow Night track' }),
    S('starlight', 'Starlight', '#34407a', 0.55, '#ffe680', { kind: 'festival', id: 'starfall', text: 'Starfall Eve track' }),
  ];
  const SKIN_BY_ID = {};
  for (const s of SKINS) SKIN_BY_ID[s.id] = s;

  /* ── Daily Siege twists ── */
  const T = (id, name, text, o) => Object.assign({ id, name, text, speed: 1, hp: 1, gold: 1, lives: 0, startGold: 1 }, o);
  const TWISTS = [
    T('swift', 'Swift Horde', 'Monsters move 25% faster', { speed: 1.25 }),
    T('iron', 'Iron Tide', 'Monsters have 30% more health', { hp: 1.3 }),
    T('rich', 'Gold Rush', 'Kills pay 50% more gold, monsters have 20% more health', { gold: 1.5, hp: 1.2 }),
    T('thin', 'Thin Walls', 'Ten fewer lives', { lives: -10 }),
    T('poor', 'Empty Coffers', 'Half the starting gold, kills pay 20% more', { startGold: 0.5, gold: 1.2 }),
    T('storm', 'Storm March', 'Monsters are 15% faster and 15% tougher', { speed: 1.15, hp: 1.15 }),
  ];

  /* ── helpers ── */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; ++i) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const int = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayIndex(key) {
    const p = String(key).split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }

  /* ── save repair ── */
  function repair(meta) {
    const m = meta && typeof meta === 'object' ? meta : {};
    const st = m.stats && typeof m.stats === 'object' ? m.stats : {};
    m.stats = {};
    for (const k of STATS) m.stats[k] = int(st[k]);
    const ach = m.ach && typeof m.ach === 'object' ? m.ach : {};
    m.ach = {};
    for (const id in ach) if (ACH_BY_ID[id] && ach[id]) m.ach[id] = 1;
    const q = m.quests && typeof m.quests === 'object' ? m.quests : {};
    m.quests = { day: typeof q.day === 'string' ? q.day : '', list: [] };
    if (Array.isArray(q.list))
      for (const x of q.list) {
        const def = x && QUEST_POOL.find(p => p.id === x.id);
        if (def) m.quests.list.push({ id: def.id, kind: def.kind, n: def.n, rp: def.rp, text: def.text, have: Math.min(def.n, int(x.have)), done: !!x.done });
      }
    const sk = m.streak && typeof m.streak === 'object' ? m.streak : {};
    m.streak = { last: typeof sk.last === 'string' ? sk.last : '', count: int(sk.count) };
    const f = m.festival && typeof m.festival === 'object' ? m.festival : {};
    m.festival = { event: typeof f.event === 'string' ? f.event : '', tokens: int(f.tokens), claimed: Math.min(TIERS.length, int(f.claimed)) };
    const s = m.skins && typeof m.skins === 'object' ? m.skins : {};
    m.skins = { owned: { classic: true }, equipped: 'classic' };
    if (s.owned && typeof s.owned === 'object') for (const id in s.owned) if (SKIN_BY_ID[id] && s.owned[id]) m.skins.owned[id] = true;
    if (SKIN_BY_ID[s.equipped] && m.skins.owned[s.equipped]) m.skins.equipped = s.equipped;
    const d = m.daily && typeof m.daily === 'object' ? m.daily : {};
    m.daily = { day: typeof d.day === 'string' ? d.day : '', best: int(d.best) };
    m.rp = int(m.rp);
    m.rpEarned = Math.max(m.rp, int(m.rpEarned));
    return m;
  }

  function pay(m, rp) {
    m.rp += rp;
    m.rpEarned += rp;
  }

  function bump(m, stat, n) {
    m.stats[stat] = (m.stats[stat] || 0) + Math.max(0, n || 0);
  }

  function record(m, stat, v) {
    m.stats[stat] = Math.max(m.stats[stat] || 0, Math.floor(v || 0));
  }

  function checkAchievements(m) {
    const got = [];
    for (const a of ACHIEVEMENTS)
      if (!m.ach[a.id] && (m.stats[a.stat] || 0) >= a.n) {
        m.ach[a.id] = 1;
        pay(m, a.rp);
        got.push(a);
      }
    return got;
  }

  /* ── quests and streak ── */
  function rollQuests(m, key) {
    if (m.quests.day === key && m.quests.list.length) return m;
    const r = rng(hash('td-quests:' + key));
    const pool = QUEST_POOL.slice();
    const list = [];
    const kinds = {};
    while (list.length < 3 && pool.length) {
      const def = pool.splice(Math.floor(r() * pool.length), 1)[0];
      if (kinds[def.kind]) continue;
      kinds[def.kind] = 1;
      list.push({ id: def.id, kind: def.kind, n: def.n, rp: def.rp, text: def.text, have: 0, done: false });
    }
    m.quests = { day: key, list: list };
    return m;
  }

  function progress(m, kind, n) {
    const got = [];
    for (const q of m.quests.list) {
      if (q.done || q.kind !== kind) continue;
      q.have = Math.min(q.n, q.have + Math.max(0, n || 0));
      if (q.have >= q.n) {
        q.done = true;
        pay(m, q.rp);
        bump(m, 'quests', 1);
        got.push(q);
      }
    }
    return got;
  }

  function touchStreak(m, key) {
    if (m.streak.last === key) return m.streak.count;
    const gap = m.streak.last ? dayIndex(key) - dayIndex(m.streak.last) : 0;
    m.streak.count = gap === 1 ? m.streak.count + 1 : 1;
    m.streak.last = key;
    record(m, 'bestStreak', m.streak.count);
    return m.streak.count;
  }

  /* ── festivals ── */
  function festivalIdFor(date) {
    const mo = date.getMonth() + 1, d = date.getDate();
    if ((mo === 12 && d >= 24) || (mo === 1 && d <= 6)) return 'starfall';
    if (mo === 12 || mo === 1 || mo === 2) return 'frost';
    if (mo >= 3 && mo <= 5) return 'bloom';
    if (mo >= 6 && mo <= 8) return 'sunfest';
    if ((mo === 10 && d >= 20) || (mo === 11 && d <= 2)) return 'hollow';
    return 'harvest';
  }

  function festivalFor(date) {
    return FESTIVALS[festivalIdFor(date || new Date())];
  }

  function eventId(date) {
    const d = date || new Date();
    const id = festivalIdFor(d);
    return id + '-' + (d.getFullYear() - ((id === 'starfall' || id === 'frost') && d.getMonth() < 2 ? 1 : 0));
  }

  function addTokens(m, n, date) {
    const ev = eventId(date);
    const fe = festivalFor(date);
    if (m.festival.event !== ev) m.festival = { event: ev, tokens: 0, claimed: 0 };
    m.festival.tokens += Math.max(0, Math.floor(n || 0));
    const got = [];
    while (m.festival.claimed < TIERS.length && m.festival.tokens >= TIERS[m.festival.claimed].n) {
      const t = TIERS[m.festival.claimed];
      if (t.kind === 'rp') pay(m, t.amount);
      else m.skins.owned[fe.skin] = true;
      got.push(Object.assign({ festival: fe.id, skin: t.kind === 'skin' ? fe.skin : '' }, t));
      ++m.festival.claimed;
      if (m.festival.claimed === TIERS.length) bump(m, 'festivals', 1);
    }
    return got;
  }

  /* ── skins ── */
  function ownsSkin(m, id) {
    return !!m.skins.owned[id];
  }

  function skinUnlockText(id) {
    const s = SKIN_BY_ID[id];
    return !s ? '' : s.unlock.kind === 'free' ? 'Always yours' : s.unlock.text;
  }

  function unlockSkins(m) {
    const got = [];
    for (const s of SKINS)
      if (!m.skins.owned[s.id] && s.unlock.kind === 'stat' && (m.stats[s.unlock.stat] || 0) >= s.unlock.n) {
        m.skins.owned[s.id] = true;
        got.push(s);
      }
    return got;
  }

  function equipSkin(m, id) {
    if (!SKIN_BY_ID[id] || !m.skins.owned[id]) return false;
    m.skins.equipped = id;
    return true;
  }

  /* ── Daily Siege ── */
  function dailyRecipe(key, mapCount) {
    const r = rng(hash('td-daily:' + key));
    return { day: key, map: Math.floor(r() * mapCount), twist: TWISTS[Math.floor(r() * TWISTS.length)] };
  }

  function dailyResult(m, key, wave) {
    bump(m, 'dailies', 1);
    if (m.daily.day !== key) m.daily = { day: key, best: 0 };
    const newBest = wave > m.daily.best;
    if (newBest) m.daily.best = wave;
    return { best: m.daily.best, newBest: newBest };
  }

  NS.goals = {
    STATS, ACHIEVEMENTS, ACH_BY_ID, QUEST_POOL, FESTIVALS, FESTIVAL_ORDER, TIERS, SKINS, SKIN_BY_ID, TWISTS,
    dayKey, repair, bump, record, checkAchievements, rollQuests, progress, touchStreak,
    festivalIdFor, festivalFor, eventId, addTokens, ownsSkin, skinUnlockText, unlockSkins, equipSkin,
    dailyRecipe, dailyResult
  };
})();
