/* The title screen and the modes screen. Title: the bot's demo game turning behind the logo,
   Continue (a saved game), Story, Modes, Tech Tree, Collection, Journal and How to Play, the
   profile chip (level, XP, shards, gems), the festival banner with its days left and today's
   quests. Modes: Marathon, Sprint, Ultra, Zen, the Daily Challenge with today's mutators, Boss
   Rush and Master, each with its best result and what opens it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const { UI, VIEW_W } = C;
  const { MODES } = NS.metaData;
  const { ctx } = NS.view;

  let logoFill = null;
  let saved = null, savedT = -1;

  /* the saved game for Continue, read at most twice a second */
  function savedRun() {
    if (savedT < 0 || G.time - savedT > 0.5) {
      saved = NS.save.loadRun();
      savedT = G.time;
    }
    return saved;
  }

  function logo(x, y) {
    kit.text('»SZ«', x, y - 52, 20, UI.gold, { align: 'center', weight: 'bold', shadow: true });
    if (!logoFill) {
      logoFill = ctx.createLinearGradient(0, y - 34, 0, y + 34);
      logoFill.addColorStop(0, '#ffffff');
      logoFill.addColorStop(0.5, '#9ae8ff');
      logoFill.addColorStop(1, '#4a7af0');
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(G.time * 1.5) * 0.015);
    ctx.font = kit.font(72, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a1440';
    ctx.lineWidth = 12;
    ctx.strokeText('TETRIS', 0, 4);
    kit.text('TETRIS', 0, 0, 72, logoFill, { align: 'center', weight: 'bold' });
    ctx.restore();
    kit.text('The Spire of Lumen', x, y + 50, 22, '#ffe8a0', { align: 'center', weight: 'bold', shadow: true });
  }

  function demo() {
    if (!G.demo) return;
    ctx.save();
    ctx.translate(70, 110);
    ctx.scale(0.82, 0.82);
    ctx.translate(-C.BOARD_X, -C.BOARD_Y);
    ctx.globalAlpha = 0.92;
    NS.boardRender.drawBoard(G.demo.game, { demo: true });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function profileChip(x, y) {
    const p = G.profile;
    kit.panel(x, y, 400, 64, { accent: UI.xp });
    kit.icon('xp', x + 28, y + 32, 26, UI.xp);
    kit.text('Level ' + p.level, x + 52, y + 22, 17, '#ffffff', { weight: 'bold' });
    kit.bar(x + 52, y + 40, 150, 10, p.xp / P.xpFor(p.level), UI.xp);
    kit.icon('shard', x + 230, y + 22, 16, UI.shard);
    kit.text(p.shards.toLocaleString('en-US'), x + 244, y + 23, 14, '#ffffff', { weight: 'bold' });
    kit.icon('gem', x + 230, y + 44, 16, UI.gem);
    kit.text(String(p.gems), x + 244, y + 45, 14, '#ffffff', { weight: 'bold' });
    kit.icon('star', x + 330, y + 22, 16, UI.gold);
    kit.text(P.starsTotal(p) + '/90', x + 344, y + 23, 14, '#ffffff', { weight: 'bold' });
    kit.icon('calendar', x + 330, y + 44, 16, UI.good);
    kit.text((p.streak.last === G.today ? p.streak.count : 0) + ' days', x + 344, y + 45, 13, '#ffffff', { weight: 'bold' });
  }

  function festival(x, y) {
    const se = G.season;
    if (!se) return;
    const p = G.profile;
    const f = p.festival.event === NS.seasons.eventId(new Date()) ? p.festival : { tokens: 0, claimed: 0 };
    kit.panel(x, y, 400, 70, { accent: se.color });
    kit.icon('gift', x + 26, y + 24, 22, se.color);
    kit.text(se.name, x + 48, y + 22, 16, '#ffffff', { weight: 'bold' });
    kit.text(NS.seasons.daysLeft(new Date()) + ' days left', x + 386, y + 22, 12, UI.textDim, { align: 'right' });
    const next = NS.seasons.TIERS[Math.min(f.claimed, NS.seasons.TIERS.length - 1)];
    kit.bar(x + 48, y + 40, 260, 10, f.claimed >= NS.seasons.TIERS.length ? 1 : f.tokens / next.n, se.color);
    kit.text(f.tokens + ' ' + se.token + '  -  reward ' + Math.min(f.claimed + 1, 5) + ' / 5', x + 48, y + 60, 11, UI.textDim);
  }

  function quests(x, y) {
    const d = G.profile.quests;
    if (!d) return;
    kit.panel(x, y, 400, 30 + d.list.length * 26, { accent: UI.good });
    kit.text('TODAY\'S QUESTS', x + 16, y + 16, 12, UI.textDim, { weight: 'bold' });
    d.list.forEach((q, i) => {
      kit.icon(q.done ? 'star' : 'scroll', x + 24, y + 40 + i * 26, 14, q.done ? UI.good : UI.textDim);
      kit.fitText(P.questText(q), x + 40, y + 41 + i * 26, 250, 13, { color: q.done ? UI.good : '#ffffff' });
      kit.text(q.done ? 'done' : Math.min(q.progress, q.n).toLocaleString('en-US') + ' / ' + q.n.toLocaleString('en-US'), x + 386, y + 41 + i * 26, 12, UI.textDim, { align: 'right' });
    });
  }

  function draw() {
    demo();
    logo(545, 250);
    const x = 790, w = 440;
    let y = 40;
    const saved = savedRun();
    const b = (id, label, sub, icon, accent, fn, h) => {
      W.button(id, label, x, y, w, h || 50, { icon: icon, sub: sub, accent: accent, action: fn });
      y += (h || 50) + 8;
    };
    if (saved) b('t-cont', 'Continue', NS.metaData.MODE_BY_ID[saved.mode].name + (saved.stage ? ' - ' + NS.worldData.BY_ID[saved.stage].name : '') + ' - ' + saved.game.score.toLocaleString('en-US') + ' points', 'play', UI.gold, () => NS.play.resume(), 56);
    b('t-story', 'Story', NS.progress.bossesBeaten(G.profile) + ' / 5 keystones home', 'book', UI.accent, () => {
      if (!G.profile.seen.intro) {
        G.profile.seen.intro = true;
        NS.cine.play(NS.storyData.SHOTS.intro, 'intro', () => NS.screens.setScreen('map', 'title'));
      } else NS.screens.setScreen('map', 'title');
    }, saved ? 50 : 56);
    b('t-modes', 'Modes', 'Marathon, Sprint, Ultra, Zen, Daily, Boss Rush, Master', 'flag', UI.good, () => NS.screens.setScreen('modes', 'title'));
    const half = (w - 8) / 2;
    W.button('t-tree', 'Tech Tree', x, y, half, 50, { icon: 'tree', sub: G.profile.shards.toLocaleString('en-US') + ' shards', accent: UI.shard, action: () => NS.screens.open('tree', 'title') });
    W.button('t-ward', 'Collection', x + half + 8, y, half, 50, { icon: 'palette', sub: 'skins, frames, effects', accent: UI.gem, action: () => NS.screens.open('wardrobe', 'title') });
    y += 58;
    W.button('t-journal', 'Journal', x, y, half, 50, { icon: 'trophy', sub: P.countAchievements(G.profile) + ' achievements', accent: UI.gold, action: () => NS.screens.open('journal', 'title') });
    W.button('t-help', 'How to Play', x + half + 8, y, half, 50, { icon: 'help', sub: 'controls and rules', action: () => NS.screens.open('help', 'title') });
    y += 66;
    profileChip(x + 20, y);
    festival(x + 20, y + 74);
    quests(x + 20, y + 154);
    kit.text('a »SynthelicZ« desktop game', 545, 690, 12, 'rgba(220,230,255,0.45)', { align: 'center' });
    if (G.menuCursor < 0) G.menuCursor = 0;
  }

  /* ---- modes ---- */
  function modeOpen(m) {
    const p = G.profile;
    if (m.id === 'rush') return P.bossesBeaten(p) >= 2;
    if (m.id === 'master') return P.bossesBeaten(p) >= 3 || p.stats.marathonLines >= 150;
    return true;
  }

  function modeBest(m) {
    const p = G.profile, s = p.stats;
    switch (m.id) {
      case 'story': return P.starsTotal(p) + ' / 90 stars';
      case 'marathon': return p.scores.marathon[0] ? 'best ' + p.scores.marathon[0].score.toLocaleString('en-US') : 'no score yet';
      case 'sprint': return s.sprintBest ? 'best ' + NS.hud.clock(s.sprintBest) : 'no time yet';
      case 'ultra': return s.ultraBest ? 'best ' + s.ultraBest.toLocaleString('en-US') : 'no score yet';
      case 'zen': return Math.floor(s.zenSeconds / 60) + ' minutes of calm';
      case 'daily': { const b = p.scores.daily[G.today]; return b ? 'today ' + b.toLocaleString('en-US') : G.daily.mutators.map(id => NS.seasons.MUT_BY_ID[id].name).join(' + '); }
      case 'rush': return s.rushWins ? s.rushWins + ' wins' : 'opens with 2 guardians beaten';
      case 'master': return s.masterBest ? 'best level ' + s.masterBest : 'opens with 3 guardians or 150 Marathon lines';
    }
    return '';
  }

  function drawModes() {
    kit.text('MODES', 60, 56, 40, '#ffffff', { weight: 'bold', shadow: true });
    const list = MODES.filter(m => m.id !== 'story');
    for (let i = 0; i < list.length; ++i) {
      const m = list[i];
      const x = 60 + (i % 4) * 296, y = 110 + Math.floor(i / 4) * 250;
      const open = modeOpen(m);
      const hot = W.area('mode-' + m.id, x, y, 280, 234, open ? () => NS.play.start(m.id) : null, { disabled: !open });
      kit.panel(x, y, 280, 234, { accent: open ? UI.accent : '#3a4460', glow: hot && open, alpha: open ? 1 : 0.6 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = hot ? 0.4 : 0.2;
      K.blit(ctx, K.glow(open ? UI.accent : '#556'), x + 140, y + 70, 1.6);
      ctx.restore();
      kit.icon(m.icon, x + 140, y + 70, 54, open ? '#ffffff' : '#8890a8');
      kit.text(m.name, x + 140, y + 134, 22, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      kit.wrap(m.desc, x + 20, y + 162, 240, 13, UI.textDim);
      kit.fitText(modeBest(m), x + 140, y + 214, 250, 13, { align: 'center', color: open ? UI.gold : UI.textMute, weight: 'bold' });
      if (!open) kit.lock(x + 250, y + 30, 22);
    }
    W.button('back', 'Back', 60, 640, 220, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function update(dt) {
    NS.demo.update(dt);
  }

  Object.assign(NS.title, { draw, drawModes, update, modeOpen, modeBest, logo });
})();
