/* The title screen and the modes screen. Title: the bot playing a demo song on a highway behind the
   neon logo, Continue (a song in progress), Story, Free Play, Modes, Shop, Tech Tree, Collection,
   Journal, Settings and How to Play, the profile chip (level and Fame, discs, crystals, crates, stars,
   streak), the festival banner with its days left, today's quests and the next unlock within reach.
   Modes: the eight modes with their best results and what opens them, the Daily Mix's and the Weekly
   Remix's mutators. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const M = NS.metaData;
  const SE = NS.seasons;
  const { UI } = C;
  const { ctx } = NS.view;

  let saved = null, savedT = -1;
  function savedRun() {
    if (savedT < 0 || G.time - savedT > 0.5) { saved = NS.save.loadRun(); savedT = G.time; }
    return saved;
  }

  let logoFill = null;
  function logo(x, y) {
    const beat = (G.time * 104 / 60) % 1;
    const k = 1 + Math.pow(1 - beat, 4) * 0.035;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + (1 - beat) * 0.25;
    K.blit(ctx, K.glow('#ff4a9a'), -80, 0, 2.6);
    K.blit(ctx, K.glow('#5af0ff'), 90, 0, 2.6);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (!logoFill) {
      logoFill = ctx.createLinearGradient(0, -40, 0, 40);
      logoFill.addColorStop(0, '#ffffff');
      logoFill.addColorStop(0.5, '#ffb0e0');
      logoFill.addColorStop(1, '#ff4a9a');
    }
    ctx.font = kit.font(84, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a0420';
    ctx.lineWidth = 14;
    ctx.strokeText('THE HUSH', 0, 4);
    ctx.strokeStyle = '#5af0ff';
    ctx.lineWidth = 3;
    ctx.strokeText('THE HUSH', 0, 0);
    ctx.fillStyle = logoFill;
    ctx.fillText('THE HUSH', 0, 0);
    ctx.restore();
    kit.text('»SZ«  RHYTHM GAME', x, y - 64, 18, UI.gold, { align: 'center', weight: 'bold', shadow: true });
    kit.text('play Hush City back to life', x, y + 58, 17, '#d8d0ff', { align: 'center', shadow: true });
  }

  function demo() {
    const r = G.run;
    if (!r || r.mode !== 'demo') return;
    ctx.save();
    ctx.translate(-250, 60);
    ctx.globalAlpha = 0.8;
    NS.highway.draw(r);
    ctx.restore();
  }

  function profileChip(x, y) {
    const p = G.profile;
    kit.panel(x, y, 440, 64, { accent: UI.xp });
    kit.icon(p.fame ? 'crown' : 'xp', x + 26, y + 32, 24, p.fame ? UI.gold : UI.xp);
    kit.text('Level ' + p.level + (p.fame ? '  ' + '★'.repeat(Math.min(5, p.fame)) + (p.fame > 5 ? '+' : '') : ''), x + 48, y + 20, 16, '#ffffff', { weight: 'bold' });
    kit.bar(x + 48, y + 38, 130, 10, p.xp / P.xpFor(p.level), UI.xp);
    const cell = (icon, txt, color, cx, cy) => { kit.icon(icon, cx, cy, 15, color); kit.text(txt, cx + 13, cy + 1, 13, '#ffffff', { weight: 'bold' }); };
    cell('disc', p.discs.toLocaleString('en-US'), UI.disc, x + 200, y + 20);
    cell('crystal', String(p.crystals), UI.crystal, x + 200, y + 44);
    cell('star', P.starsTotal(p) + '/90', UI.gold, x + 300, y + 20);
    cell('gift', p.crates.owned + ' crates', '#ff7ad8', x + 300, y + 44);
    cell('calendar', (p.streak.last === G.today ? p.streak.count : 0) + 'd', UI.good, x + 392, y + 20);
  }

  function festival(x, y) {
    const se = G.season;
    if (!se) return;
    const p = G.profile;
    const f = p.festival.event === SE.eventId(new Date()) ? p.festival : { tokens: 0, claimed: 0 };
    kit.panel(x, y, 440, 64, { accent: se.color });
    kit.icon('gift', x + 24, y + 22, 20, se.color);
    kit.text(se.name, x + 44, y + 20, 15, '#ffffff', { weight: 'bold' });
    kit.text(SE.daysLeft(new Date()) + ' days left', x + 426, y + 20, 12, UI.textDim, { align: 'right' });
    const next = SE.TIERS[Math.min(f.claimed, SE.TIERS.length - 1)];
    kit.bar(x + 44, y + 36, 300, 9, f.claimed >= SE.TIERS.length ? 1 : f.tokens / next.n, se.color);
    kit.fitText(f.tokens + ' ' + se.token + ' - reward ' + Math.min(f.claimed + 1, SE.TIERS.length) + ' of ' + SE.TIERS.length + ' - festival song: ' + NS.songData.FESTIVAL[se.id].name, x + 44, y + 54, 380, 11, { color: UI.textDim });
  }

  function quests(x, y) {
    const d = G.profile.quests;
    if (!d) return;
    const wk = G.profile.weekly;
    const rows = d.list.length + (wk ? 1 : 0);
    kit.panel(x, y, 440, 30 + rows * 24, { accent: UI.good });
    kit.text('TODAY\'S QUESTS', x + 16, y + 15, 12, UI.textDim, { weight: 'bold' });
    const row = (q, i, weekly) => {
      kit.icon(q.done ? 'star' : weekly ? 'calendar' : 'scroll', x + 22, y + 38 + i * 24, 14, q.done ? UI.good : weekly ? UI.crystal : UI.textDim);
      kit.fitText((weekly ? 'Weekly: ' : '') + P.questText(q), x + 38, y + 39 + i * 24, 290, 13, { color: q.done ? UI.good : '#ffffff' });
      kit.text(q.done ? 'done' : Math.min(q.progress, q.n).toLocaleString('en-US') + ' / ' + q.n.toLocaleString('en-US'), x + 426, y + 39 + i * 24, 12, UI.textDim, { align: 'right' });
    };
    d.list.forEach((q, i) => row(q, i, false));
    if (wk) row(wk, d.list.length, true);
  }

  /* the nearest unlock by stars or level */
  function nextUnlock() {
    const p = G.profile;
    let best = null;
    for (const k in M.SLOTS) for (const i of M.SLOTS[k]) {
      if (P.isUnlocked(p, i)) continue;
      const u = i.unlock;
      let gap = null, what = null;
      if (u.k === 'stars') { gap = u.n - P.starsTotal(p); what = gap + ' more star' + (gap > 1 ? 's' : ''); }
      else if (u.k === 'level') { gap = (u.n - p.level) * 3; what = 'level ' + u.n; }
      else if (u.k === 'crystals' && p.crystals < u.n) { gap = (u.n - p.crystals) / 4; what = (u.n - p.crystals) + ' more crystals'; }
      if (gap != null && gap > 0 && (!best || gap < best.gap)) best = { gap: gap, text: 'Next: ' + i.name + ' - ' + what };
    }
    if (P.canTour(p)) return 'You can go on Tour for a Fame star - see the Journal';
    return best ? best.text : '';
  }

  function draw() {
    demo();
    logo(400, 130);
    const x = 790, w = 450;
    let y = 22;
    const s = savedRun();
    const b = (id, label, sub, icon, accent, fn, h) => { W.button(id, label, x, y, w, h || 46, { icon: icon, sub: sub, accent: accent, action: fn }); y += (h || 46) + 7; };
    if (s) b('t-cont', 'Continue', (s.title || 'Song') + ' - ' + s.eng.score.toLocaleString('en-US') + ' points, combo ' + s.eng.combo, 'play', UI.gold, () => NS.play.resumeSaved(), 52);
    b('t-story', 'Story', P.bossesBeaten(G.profile) + ' / 5 districts back on the air', 'book', UI.accent, () => {
      if (!G.profile.seen.intro) {
        G.profile.seen.intro = true;
        NS.cine.play(NS.storyData.SHOTS.intro, 'intro', () => NS.screens.setScreen('map', 'title'));
      } else NS.screens.setScreen('map', 'title');
    }, s ? 46 : 52);
    const half = (w - 8) / 2;
    const pair = (a, c) => { W.button(a[0], a[1], x, y, half, 46, { icon: a[3], sub: a[2], accent: a[4], action: a[5] }); W.button(c[0], c[1], x + half + 8, y, half, 46, { icon: c[3], sub: c[2], accent: c[4], action: c[5] }); y += 53; };
    pair(['t-free', 'Free Play', 'any song, 4 difficulties', 'music', '#5af0ff', () => NS.screens.setScreen('library', 'title')],
      ['t-modes', 'Modes', 'Daily, Marathon, Zen...', 'spin', UI.good, () => NS.screens.setScreen('modes', 'title')]);
    const offers = P.dailyOffers(G.profile, G.today).length;
    pair(['t-shop', 'Shop', G.profile.crates.owned ? G.profile.crates.owned + ' crates to open!' : offers + ' offers today', 'shop', UI.disc, () => NS.screens.open('shop', 'title')],
      ['t-tree', 'Tech Tree', G.profile.discs.toLocaleString('en-US') + ' discs', 'tree', UI.disc, () => NS.screens.open('tree', 'title')]);
    pair(['t-ward', 'Collection', 'performers, notes, highways', 'palette', UI.crystal, () => NS.screens.open('wardrobe', 'title')],
      ['t-journal', 'Journal', P.countAchievements(G.profile) + ' achievements', 'trophy', UI.gold, () => NS.screens.open('journal', 'title')]);
    pair(['t-settings', 'Settings', 'speed, offset, calibrate', 'gear', UI.textDim, () => NS.screens.open('settings', 'title')],
      ['t-help', 'How to Play', 'notes, Surge, bosses', 'help', UI.textDim, () => NS.screens.open('help', 'title')]);
    y += 4;
    profileChip(x - 0, y);
    festival(x, y + 70);
    quests(x, y + 140);
    const nu = nextUnlock();
    if (nu) kit.fitText(nu, 400, 228, 600, 14, { align: 'center', color: UI.gold, weight: 'bold', shadow: true });
    kit.text('a »SynthelicZ« desktop game', 400, 704, 12, 'rgba(220,230,255,0.45)', { align: 'center' });
    if (G.menuCursor < 0) G.menuCursor = 0;
  }

  function update() {
    if (!G.run || (G.run.mode === 'demo' && G.run.done)) NS.demo.reset();
  }

  /* ---- modes ---- */
  function modeOpen(m) {
    const p = G.profile;
    if (m.id === 'bossrush') return P.bossesBeaten(p) >= 2;
    if (m.id === 'remix') return P.bossesBeaten(p) >= 5;
    return true;
  }

  function modeBest(m) {
    const p = G.profile, s = p.stats;
    switch (m.id) {
      case 'story': return P.starsTotal(p) + ' / 90 stars';
      case 'free': return s.expertClears + ' Expert clears';
      case 'marathon': return s.marathonBest ? 'best ' + s.marathonBest + ' songs' : 'no run yet';
      case 'daily': { const b = p.scores.daily[G.today]; return b ? 'today ' + b.toLocaleString('en-US') : G.daily.mutators.map(id => SE.MUT_BY_ID[id].name).join(' + '); }
      case 'zen': return Math.round(s.zenSeconds / 60) + ' minutes of calm';
      case 'bossrush': return s.rushWins ? s.rushWins + ' wins' : 'opens with 2 bosses beaten';
      case 'weekly': { const r = G.weekly; const b = p.scores.weekly[r.key]; return (b ? 'best ' + b.toLocaleString('en-US') + ' - ' : '') + SE.MUT_BY_ID[r.mutator].name; }
      case 'remix': return P.bossesBeaten(p) >= 5 ? P.starsTotal(p, true) + ' / 90 remix stars' : 'opens after the finale';
    }
    return '';
  }

  function drawModes() {
    kit.text('MODES', 60, 56, 40, '#ffffff', { weight: 'bold', shadow: true });
    const list = M.MODES;
    for (let i = 0; i < list.length; ++i) {
      const m = list[i];
      const x = 60 + (i % 4) * 296, y = 96 + Math.floor(i / 4) * 262;
      const open = modeOpen(m);
      const go = m.id === 'story' ? () => NS.screens.setScreen('map', 'modes') : m.id === 'free' ? () => NS.screens.setScreen('library', 'modes')
        : m.id === 'remix' ? () => { G.ui.remix = true; NS.screens.setScreen('map', 'modes'); } : () => NS.play.start(m.id);
      const hot = W.area('mode-' + m.id, x, y, 276, 246, open ? go : null, { disabled: !open });
      kit.panel(x, y, 276, 246, { accent: open ? UI.accent : '#3a3460', glow: hot && open, alpha: open ? 1 : 0.6 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = hot ? 0.45 : 0.2;
      K.blit(ctx, K.glow(open ? '#ff4a9a' : '#556'), x + 138, y + 64, 1.4);
      ctx.restore();
      kit.icon(m.icon, x + 138, y + 64, 48, open ? '#ffffff' : '#8890a8');
      kit.text(m.name, x + 138, y + 122, 22, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      kit.wrap(m.desc, x + 20, y + 150, 236, 13, UI.textDim);
      kit.fitText(modeBest(m), x + 138, y + 224, 250, 13, { align: 'center', color: open ? UI.gold : UI.textMute, weight: 'bold' });
      if (!open) kit.lock(x + 246, y + 30, 22);
    }
    W.button('back', 'Back', 60, 640, 220, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  Object.assign(NS.title, { savedRun, logo, profileChip, festival, quests, nextUnlock, draw, update, modeOpen, modeBest, drawModes });
})();
