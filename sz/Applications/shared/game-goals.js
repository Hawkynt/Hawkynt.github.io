;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // The keep-coming-back layer for the games, configured per game and saved
  // under the game's own key (sz-goals-<id>), so no game's save format changes:
  // lifetime statistics grown by deeds, achievements that pay the game's own
  // currency, three daily quests and a day streak, the six real-date festivals
  // with a six-tier token track (currency and a festival cosmetic), cosmetics
  // unlocked by deeds and equipped (the game hears it and paints them), a Daily
  // recipe (seed and twist from the date) with the best result kept, small
  // unlock toasts and a Goals panel - plain DOM over the game's canvas.
  //
  //   const goals = SZ.GameGoals.create({
  //     id, title, accent, currency, pay(n),            reward currency
  //     achievements: [{ id, name, stat, n, reward, desc }],
  //     quests: [{ id, kind, n, reward, text }],        three a day, distinct kinds
  //     tokens: { deedKind: tokensPerUnit },            festival tokens from deeds
  //     cosmetics: [{ id, name, colors, unlock }],      unlock: free | stat | festival
  //     cosmeticLabel, onEquip(id),
  //     twists: [{ id, name, text }], daily: { describe(recipe), start(recipe) },
  //     story,                                          a SZ.GameStory instance
  //     pause(), resume() })
  //   goals.deed(kind, n)  goals.record(stat, value)  goals.equipped()  goals.open(tab)
  //   goals.dailyRecipe()  goals.dailyResult(score)   goals.isOpen()

  const FESTIVALS = {
    frost: { id: 'frost', name: 'Frostfall', token: 'snowflakes', color: '#bff4ff' },
    bloom: { id: 'bloom', name: 'Bloom Festival', token: 'blossoms', color: '#ffb0d0' },
    sunfest: { id: 'sunfest', name: 'Sunfest', token: 'sun drops', color: '#ffe07a' },
    harvest: { id: 'harvest', name: 'Harvest Moon', token: 'acorns', color: '#e0902a' },
    hollow: { id: 'hollow', name: 'Hollow Night', token: 'candies', color: '#ff8a1a' },
    starfall: { id: 'starfall', name: 'Starfall Eve', token: 'sparklers', color: '#ffd23a' },
  };
  const TIERS = [{ n: 40, k: 1 }, { n: 120, k: 1.5 }, { n: 250, k: 2 }, { n: 450, cosmetic: true }, { n: 700, k: 3 }, { n: 1000, k: 5 }];

  function festivalIdFor(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    if ((m === 12 && day >= 24) || (m === 1 && day <= 6)) return 'starfall';
    if (m === 12 || m === 1 || m === 2) return 'frost';
    if (m >= 3 && m <= 5) return 'bloom';
    if (m >= 6 && m <= 8) return 'sunfest';
    if ((m === 10 && day >= 20) || (m === 11 && day <= 2)) return 'hollow';
    return 'harvest';
  }
  function eventId(d) {
    const id = festivalIdFor(d);
    return id + '-' + (d.getFullYear() - ((id === 'starfall' || id === 'frost') && d.getMonth() < 2 ? 1 : 0));
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayIndex(key) {
    const p = String(key).split('-').map(Number);
    return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
  }
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
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; ++i) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const int = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

  function create(cfg) {
    const now = cfg.now || (() => new Date());
    const KEY = 'sz-goals-' + cfg.id;
    const ACH = cfg.achievements || [], QUESTS = cfg.quests || [], COS = cfg.cosmetics || [];
    const ACH_BY = {}, COS_BY = {};
    for (const a of ACH) ACH_BY[a.id] = a;
    for (const c of COS) COS_BY[c.id] = c;
    const free = (COS.find(c => c.unlock && c.unlock.kind === 'free') || COS[0] || { id: '' }).id;
    const toasts = [];
    let s = load();

    function load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { d = null; }
      d = d && typeof d === 'object' ? d : {};
      const st = { stats: {}, ach: {}, quests: { day: '', list: [] }, streak: { last: '', count: 0 }, festival: { event: '', tokens: 0, claimed: 0 }, owned: {}, equipped: free, daily: { day: '', best: 0 } };
      if (d.stats && typeof d.stats === 'object') for (const k in d.stats) if (/^[a-zA-Z0-9_]{1,24}$/.test(k)) st.stats[k] = int(d.stats[k]);
      if (d.ach && typeof d.ach === 'object') for (const k in d.ach) if (ACH_BY[k] && d.ach[k]) st.ach[k] = 1;
      if (d.quests && Array.isArray(d.quests.list)) {
        st.quests.day = String(d.quests.day || '');
        for (const q of d.quests.list) {
          const def = q && QUESTS.find(x => x.id === q.id);
          if (def) st.quests.list.push(Object.assign({}, def, { have: Math.min(def.n, int(q.have)), done: !!q.done }));
        }
      }
      if (d.streak) st.streak = { last: String(d.streak.last || ''), count: int(d.streak.count) };
      if (d.festival) st.festival = { event: String(d.festival.event || ''), tokens: int(d.festival.tokens), claimed: Math.min(TIERS.length, int(d.festival.claimed)) };
      if (free) st.owned[free] = true;
      if (d.owned && typeof d.owned === 'object') for (const k in d.owned) if (COS_BY[k] && d.owned[k]) st.owned[k] = true;
      if (COS_BY[d.equipped] && st.owned[d.equipped]) st.equipped = d.equipped;
      if (d.daily) st.daily = { day: String(d.daily.day || ''), best: int(d.daily.best) };
      return st;
    }

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
    }

    function pay(n) {
      if (n > 0 && cfg.pay) cfg.pay(n);
    }

    function toast(title, sub, color) {
      toasts.push({ title, sub: sub || '', color: color || cfg.accent || '#ffd75a', at: Date.now() });
      if (toasts.length > 6) toasts.shift();
      showToast(toasts[toasts.length - 1]);
    }

    function rollQuests() {
      const key = dayKey(now());
      if (s.quests.day === key && s.quests.list.length) return;
      const r = rng(hash(cfg.id + ':quests:' + key));
      const pool = QUESTS.slice(), list = [], kinds = {};
      while (list.length < 3 && pool.length) {
        const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
        if (kinds[q.kind]) continue;
        kinds[q.kind] = 1;
        list.push(Object.assign({}, q, { have: 0, done: false }));
      }
      s.quests = { day: key, list };
    }

    function touch() {
      const key = dayKey(now());
      rollQuests();
      if (s.streak.last !== key) {
        const gap = s.streak.last ? dayIndex(key) - dayIndex(s.streak.last) : 0;
        s.streak.count = gap === 1 ? s.streak.count + 1 : 1;
        s.streak.last = key;
        s.stats.bestStreak = Math.max(s.stats.bestStreak || 0, s.streak.count);
        if (s.streak.count > 1) toast('Day streak ' + s.streak.count, 'Welcome back!', '#ffab40');
        settle();
        save();
      }
    }

    function settle() {
      for (const a of ACH)
        if (!s.ach[a.id] && (s.stats[a.stat] || 0) >= a.n) {
          s.ach[a.id] = 1;
          pay(a.reward);
          toast('Achievement: ' + a.name, a.desc + (a.reward ? '  ·  +' + a.reward + ' ' + (cfg.currency || '') : ''), '#ffd54f');
        }
      for (const c of COS)
        if (!s.owned[c.id] && c.unlock && c.unlock.kind === 'stat' && (s.stats[c.unlock.stat] || 0) >= c.unlock.n) {
          s.owned[c.id] = true;
          toast((cfg.cosmeticLabel || 'Cosmetic') + ': ' + c.name, 'Equip it under Goals', '#9be7ff');
        }
    }

    function addTokens(n) {
      if (!(n > 0)) return;
      const d = now(), ev = eventId(d), fe = FESTIVALS[festivalIdFor(d)];
      if (s.festival.event !== ev) s.festival = { event: ev, tokens: 0, claimed: 0, acc: 0 };
      s.festival.acc = (s.festival.acc || 0) + n;
      const whole = Math.floor(s.festival.acc);
      s.festival.acc -= whole;
      s.festival.tokens += whole;
      const unit = cfg.tierReward || 2;
      while (s.festival.claimed < TIERS.length && s.festival.tokens >= TIERS[s.festival.claimed].n) {
        const t = TIERS[s.festival.claimed++];
        if (t.cosmetic) {
          const c = COS.find(x => x.unlock && x.unlock.kind === 'festival' && x.unlock.id === fe.id);
          if (c) s.owned[c.id] = true;
          toast(fe.name + ' reward', c ? (cfg.cosmeticLabel || 'Cosmetic') + ': ' + c.name : 'Festival badge', fe.color);
        } else {
          pay(Math.round(unit * t.k));
          toast(fe.name + ' reward', '+' + Math.round(unit * t.k) + ' ' + (cfg.currency || ''), fe.color);
        }
        if (s.festival.claimed === TIERS.length) s.stats.festivals = (s.stats.festivals || 0) + 1;
      }
    }

    function deed(kind, n) {
      n = n == null ? 1 : n;
      touch();
      s.stats[kind] = (s.stats[kind] || 0) + Math.max(0, n);
      for (const q of s.quests.list) {
        if (q.done || q.kind !== kind) continue;
        q.have = Math.min(q.n, q.have + Math.max(0, n));
        if (q.have >= q.n) {
          q.done = true;
          s.stats.quests = (s.stats.quests || 0) + 1;
          pay(q.reward);
          toast('Quest done: ' + q.text, '+' + q.reward + ' ' + (cfg.currency || ''), '#7ae08a');
        }
      }
      if (cfg.tokens && cfg.tokens[kind]) addTokens(cfg.tokens[kind] * n);
      settle();
      dirty();
    }

    function record(stat, v) {
      touch();
      if ((v || 0) > (s.stats[stat] || 0)) {
        s.stats[stat] = Math.floor(v);
        settle();
        dirty();
      }
    }

    let saveTimer = null;
    function dirty() {
      if (typeof setTimeout !== 'function' || cfg.now) { save(); return; }
      if (saveTimer) return;
      saveTimer = setTimeout(() => { saveTimer = null; save(); }, 1500);
    }

    function equip(id) {
      if (!COS_BY[id] || !s.owned[id]) return false;
      s.equipped = id;
      save();
      if (cfg.onEquip) cfg.onEquip(id);
      return true;
    }

    function unlockText(id) {
      const c = COS_BY[id];
      if (!c || !c.unlock) return '';
      if (c.unlock.kind === 'free') return 'Always yours';
      if (c.unlock.kind === 'festival') return FESTIVALS[c.unlock.id].name + ' festival track';
      return c.unlock.text || '';
    }

    function dailyRecipe() {
      const key = dayKey(now());
      const r = rng(hash(cfg.id + ':daily:' + key));
      const tw = cfg.twists || [];
      return { day: key, seed: Math.floor(r() * 4294967295) >>> 0, twist: tw.length ? tw[Math.floor(r() * tw.length)] : null, pick: r };
    }

    function dailyResult(score) {
      const key = dayKey(now());
      if (s.daily.day !== key) s.daily = { day: key, best: 0 };
      const newBest = score > s.daily.best;
      if (newBest) s.daily.best = Math.floor(score);
      deed('dailies', 1);
      return { best: s.daily.best, newBest };
    }

    /* ── the panel ── */
    let panel = null, tab = 'today', keyHook = null;

    function open(t) {
      if (typeof document === 'undefined' || !document.body) return;
      if (t) tab = t;
      touch();
      if (!panel) {
        injectStyle();
        panel = document.createElement('div');
        panel.className = 'szg-overlay';
        panel.addEventListener('pointerdown', e => { if (e.target === panel) close(); e.stopPropagation(); });
        document.body.appendChild(panel);
        if (cfg.pause) cfg.pause();
        keyHook = (e) => {
          if (e.key === 'Escape') close();
          e.stopImmediatePropagation();
        };
        window.addEventListener('keydown', keyHook, true);
      }
      render();
    }

    function close() {
      if (!panel) return;
      panel.remove();
      panel = null;
      window.removeEventListener('keydown', keyHook, true);
      if (cfg.resume) cfg.resume();
    }

    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function render() {
      const plural = cfg.cosmeticPlural || (cfg.cosmeticLabel ? cfg.cosmeticLabel.replace(/([^aeiou])y$/, '$1ie') + 's' : 'Cosmetics');
      const tabs = [['today', 'Today'], ['ach', 'Achievements'], ['cos', plural]];
      if (cfg.daily) tabs.push(['daily', cfg.daily.label || 'Daily']);
      if (cfg.story) tabs.push(['story', 'Story']);
      const n = Object.keys(s.ach).length;
      let h = '<div class="szg-box" style="--acc:' + (cfg.accent || '#ffd75a') + '"><div class="szg-head"><b>' + esc(cfg.title || 'Goals') + '  ·  Goals</b><span>' + n + ' / ' + ACH.length + ' achievements</span><button data-a="close">×</button></div><div class="szg-tabs">';
      for (const [id, label] of tabs) h += '<button data-tab="' + id + '" class="' + (tab === id ? 'on' : '') + '">' + esc(label) + '</button>';
      h += '</div><div class="szg-body">' + body() + '</div></div>';
      panel.innerHTML = h;
      panel.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
      panel.querySelectorAll('[data-a]').forEach(b => b.onclick = () => action(b.dataset.a, b.dataset.v));
    }

    function action(a, v) {
      if (a === 'close') close();
      else if (a === 'equip') { equip(v); render(); }
      else if (a === 'daily') { close(); cfg.daily.start(dailyRecipe()); }
      else if (a === 'story') { close(); cfg.story.replay(v); }
    }

    function bar(k, color) {
      return '<div class="szg-bar"><i style="width:' + Math.round(Math.min(1, k) * 100) + '%;background:' + color + '"></i></div>';
    }

    function body() {
      if (tab === 'ach')
        return '<div class="szg-grid">' + ACH.map(a => {
          const on = s.ach[a.id], have = Math.min(a.n, s.stats[a.stat] || 0);
          return '<div class="szg-card' + (on ? ' on' : '') + '"><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + (on ? '' : ' (' + have + ' / ' + a.n + ')') + '</small>' + (a.reward ? '<em>+' + a.reward + '</em>' : '') + '</div>';
        }).join('') + '</div>';
      if (tab === 'cos')
        return '<div class="szg-grid szg-cos">' + COS.map(c => {
          const own = s.owned[c.id], on = s.equipped === c.id;
          const sw = (c.colors || []).map(x => '<i style="background:' + (own ? x : '#3a4256') + '"></i>').join('');
          return '<div class="szg-card' + (own ? ' on' : '') + '"><div class="szg-sw">' + sw + '</div><b>' + esc(c.name) + '</b>' +
            (own ? '<button data-a="equip" data-v="' + c.id + '" class="' + (on ? 'gold' : '') + '">' + (on ? 'Equipped' : 'Equip') + '</button>' : '<small>' + esc(unlockText(c.id)) + '</small>') + '</div>';
        }).join('') + '</div>';
      if (tab === 'daily') {
        const r = dailyRecipe(), d = cfg.daily.describe(r);
        const best = s.daily.day === r.day ? s.daily.best : 0;
        return '<div class="szg-daily"><h3>' + esc(d.title) + '</h3>' + (d.lines || []).map(l => '<p>' + esc(l) + '</p>').join('') +
          (r.twist ? '<p class="tw">Twist: ' + esc(r.twist.name) + ' - ' + esc(r.twist.text) + '</p>' : '') +
          '<p class="dim">' + (best ? 'Your best today: ' + best : 'Not played today yet') + '</p><button data-a="daily" class="gold big">Start</button></div>';
      }
      if (tab === 'story')
        return '<div class="szg-grid">' + cfg.story.list().map(x => '<div class="szg-card' + (x.seen ? ' on' : '') + '"><b>' + (x.seen ? esc(x.title) : '???') + '</b>' +
          (x.seen ? '<button data-a="story" data-v="' + x.key + '">Watch</button>' : '<small>Not seen yet</small>') + '</div>').join('') + '</div>';
      const d = now(), fe = FESTIVALS[festivalIdFor(d)];
      const f = s.festival.event === eventId(d) ? s.festival : { tokens: 0, claimed: 0 };
      let h = '<h4>Daily quests  ·  day streak ' + s.streak.count + '</h4>';
      for (const q of s.quests.list)
        h += '<div class="szg-row' + (q.done ? ' on' : '') + '"><span>' + (q.done ? '✓ ' : '') + esc(q.text) + '<small>' + q.have + ' / ' + q.n + '</small></span>' + bar(q.have / q.n, q.done ? '#7ae08a' : '#5aa0ff') + '<em>+' + q.reward + ' ' + esc(cfg.currency || '') + '</em></div>';
      const fc = COS.find(x => x.unlock && x.unlock.kind === 'festival' && x.unlock.id === fe.id);
      h += '<h4 style="color:' + fe.color + '">' + fe.name + '  ·  ' + f.tokens + ' ' + fe.token + '</h4><div class="szg-tiers">';
      TIERS.forEach((t, i) => {
        const got = i < f.claimed;
        h += '<div class="szg-card' + (got ? ' on' : '') + '"><b>' + (t.cosmetic ? esc(fc ? fc.name : 'Badge') : '+' + Math.round((cfg.tierReward || 2) * t.k) + ' ' + esc(cfg.currency || '')) + '</b><small>' + (got ? 'claimed' : t.n + ' ' + fe.token) + '</small></div>';
      });
      return h + '</div>';
    }

    let toastBox = null;
    function showToast(t) {
      if (typeof document === 'undefined' || !document.body) return;
      injectStyle();
      if (!toastBox || !toastBox.isConnected) {
        toastBox = document.createElement('div');
        toastBox.className = 'szg-toasts';
        document.body.appendChild(toastBox);
      }
      const el = document.createElement('div');
      el.className = 'szg-toast';
      el.style.borderColor = t.color;
      el.innerHTML = '<b style="color:' + t.color + '">' + esc(t.title) + '</b><small>' + esc(t.sub) + '</small>';
      toastBox.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
    }

    touch();
    if (cfg.onEquip && s.equipped) cfg.onEquip(s.equipped);

    return {
      get state() { return s; }, toasts, deed, record, touch, equip, equipped: () => s.equipped, owns: id => !!s.owned[id],
      cosmetic: () => COS_BY[s.equipped] || null, unlockText, dailyRecipe, dailyResult, open, close, isOpen: () => !!panel, save,
    };
  }

  let styled = false;
  function injectStyle() {
    if (styled || typeof document === 'undefined') return;
    styled = true;
    const st = document.createElement('style');
    st.textContent = `
.szg-overlay{position:fixed;inset:0;z-index:9000;background:rgba(4,6,14,.72);display:flex;align-items:center;justify-content:center;font:13px/1.35 system-ui,'Segoe UI',sans-serif;color:#e4eaf6}
.szg-box{width:min(760px,calc(100% - 24px));max-height:calc(100% - 24px);display:flex;flex-direction:column;background:linear-gradient(#1a2034,#10141f);border:1px solid var(--acc);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.szg-head{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
.szg-head b{color:var(--acc);font-size:15px}.szg-head span{margin-left:auto;color:#9aa6c0;font-size:12px}
.szg-overlay button{font:inherit;color:#e4eaf6;background:#2e3852;border:1px solid #46526e;border-radius:6px;padding:4px 10px;cursor:pointer}
.szg-overlay button:hover{background:#3a4666}.szg-overlay button.gold,.szg-tabs button.on{background:linear-gradient(#ffd75a,#c9952a);color:#3a2606;border-color:#ffe9a0;font-weight:bold}
.szg-overlay button.big{padding:8px 28px;font-size:15px}
.szg-tabs{display:flex;gap:6px;padding:8px 12px}.szg-tabs button{flex:1}
.szg-body{overflow:auto;padding:4px 12px 12px}
.szg-body h4{margin:10px 0 6px;color:var(--acc)}.szg-body h3{margin:6px 0;font-size:20px}
.szg-row{display:grid;grid-template-columns:1fr 30% auto;gap:10px;align-items:center;padding:8px 10px;margin-bottom:6px;border:1px solid rgba(150,170,210,.15);border-radius:7px;background:rgba(255,255,255,.03)}
.szg-row small{display:block;color:#8a96b0}.szg-row em,.szg-card em{color:#b48aff;font-style:normal}
.szg-row.on{border-color:#7ae08a88;background:rgba(122,224,138,.08)}
.szg-bar{height:10px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden}.szg-bar i{display:block;height:100%}
.szg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}.szg-cos{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.szg-tiers{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.szg-card{position:relative;padding:8px 10px;border:1px solid rgba(150,170,210,.15);border-radius:7px;background:rgba(255,255,255,.03);display:flex;flex-direction:column;gap:3px}
.szg-card.on{border-color:color-mix(in srgb,var(--acc) 60%,transparent);background:rgba(255,215,90,.06)}
.szg-card small{color:#8a96b0}.szg-card em{position:absolute;right:8px;top:8px}
.szg-sw{display:flex;height:34px;border-radius:5px;overflow:hidden;margin-bottom:4px}.szg-sw i{flex:1}
.szg-daily{text-align:center;padding:10px}.szg-daily .tw{color:#ff7ad8;font-weight:bold}.szg-daily .dim{color:#8a96b0}
.szg-toasts{position:fixed;top:56px;right:10px;z-index:8999;display:flex;flex-direction:column;gap:6px;pointer-events:none;font:12px/1.3 system-ui,'Segoe UI',sans-serif}
.szg-toast{min-width:220px;max-width:320px;padding:7px 10px;background:rgba(8,10,20,.92);color:#d8e0f0;border:1.5px solid;border-radius:8px;animation:szgIn .25s ease-out;transition:opacity .4s}
.szg-toast b,.szg-toast small{display:block}.szg-toast.out{opacity:0}
@keyframes szgIn{from{transform:translateX(30px);opacity:0}}
@media (max-width:560px){.szg-tiers{grid-template-columns:repeat(3,1fr)}.szg-row{grid-template-columns:1fr auto}.szg-row .szg-bar{display:none}}
.szs-overlay{position:fixed;inset:0;z-index:9001;pointer-events:auto;font:15px/1.4 system-ui,'Segoe UI',sans-serif;color:#eef2fa}
.szs-bar{position:absolute;left:0;right:0;height:10%;background:#000}.szs-bar.t{top:0}.szs-bar.b{bottom:0}
.szs-dim{position:absolute;inset:0;background:rgba(4,6,14,.5)}
.szs-box{position:absolute;left:20px;right:20px;bottom:calc(10% + 14px);display:flex;gap:12px;align-items:flex-end}
.szs-box.foe{flex-direction:row-reverse}
.szs-face{flex:0 0 auto;width:min(150px,24vw);aspect-ratio:1;background:linear-gradient(#1a2034,#10141f);border:1px solid var(--c);border-radius:10px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
.szs-face canvas{width:88%;image-rendering:pixelated}
.szs-text{flex:1;min-height:min(130px,26vh);background:linear-gradient(#1a2034,#10141f);border:1px solid var(--c);border-radius:10px;padding:12px 16px;position:relative}
.szs-text b{display:block;color:var(--c);font-size:16px;margin-bottom:6px}.szs-text i{position:absolute;right:14px;bottom:10px;color:var(--c);font-style:normal}
.szs-hint{position:absolute;right:14px;top:calc(10% + 6px);font-size:12px;color:#9aa6c0}
`;
    document.head.appendChild(st);
  }

  SZ.GameGoals = { create, dayKey, festivalIdFor, eventId, FESTIVALS, TIERS, injectStyle };
})();
