/* The title screen, the modes screen and the Classic screen. Title: the bot sweeping a demo field
   behind the logo, Continue (a saved game), Story, Classic, Modes, Tech Tree, Collection, Journal
   and How to Play, the profile chip (level, XP, shards, gems), the festival banner with its days
   left and today's quests. Modes: Classic, the Daily Field with today's twists, Zen, Rush, the
   Gauntlet and Versus with its four rivals, each with its best result and what opens it. Classic:
   Beginner, Intermediate and Expert with best times, wins and streaks, a custom size with
   steppers, question marks and proven fields as switches, and the best-times table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
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
      logoFill.addColorStop(0.5, '#b8f0a0');
      logoFill.addColorStop(1, '#3aa04a');
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(G.time * 1.5) * 0.015);
    ctx.font = kit.font(60, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a2410';
    ctx.lineWidth = 12;
    ctx.strokeText('MINESWEEPER', 0, 4);
    kit.text('MINESWEEPER', 0, 0, 60, logoFill, { align: 'center', weight: 'bold' });
    ctx.restore();
    kit.text('The Bloomfield Expedition', x, y + 50, 22, '#ffe8a0', { align: 'center', weight: 'bold', shadow: true });
  }

  function demo() {
    if (!G.demo) return;
    ctx.globalAlpha = 0.55;
    NS.boardRender.draw(G.demo.game, { area: { x0: 60, y0: 120, x1: 730, y1: 640, max: 34 }, demo: true, small: true });
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
    if (saved) b('t-cont', 'Continue', NS.metaData.MODE_BY_ID[saved.mode].name + (saved.stage ? ' - ' + NS.worldData.BY_ID[saved.stage].name : '') + ' - ' + saved.game.opened + ' cells open', 'play', UI.gold, () => NS.play.resume(), 56);
    b('t-story', 'Story', NS.progress.bossesBeaten(G.profile) + ' / 5 lands blooming', 'book', UI.accent, () => {
      if (!G.profile.seen.intro) {
        G.profile.seen.intro = true;
        NS.cine.play(NS.storyData.SHOTS.intro, 'intro', () => NS.screens.setScreen('map', 'title'));
      } else NS.screens.setScreen('map', 'title');
    }, saved ? 50 : 56);
    const half0 = (w - 8) / 2;
    W.button('t-classic', 'Classic', x, y, half0, 50, { icon: 'mine', sub: 'the original sizes', accent: '#c0c0c0', action: () => NS.screens.setScreen('classic', 'title') });
    W.button('t-modes', 'Modes', x + half0 + 8, y, half0, 50, { icon: 'flag', sub: 'Daily, Zen, Rush, Versus...', accent: UI.good, action: () => NS.screens.setScreen('modes', 'title') });
    y += 58;
    const half = (w - 8) / 2;
    W.button('t-tree', 'Tech Tree', x, y, half, 50, { icon: 'tree', sub: G.profile.shards.toLocaleString('en-US') + ' shards', accent: UI.shard, action: () => NS.screens.open('tree', 'title') });
    W.button('t-ward', 'Collection', x + half + 8, y, half, 50, { icon: 'palette', sub: 'tiles, flags, effects', accent: UI.gem, action: () => NS.screens.open('wardrobe', 'title') });
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
    if (m.id === 'gauntlet') return P.bossesBeaten(p) >= 2;
    return true;
  }

  function modeBest(m) {
    const p = G.profile, s = p.stats;
    switch (m.id) {
      case 'story': return P.starsTotal(p) + ' / 90 stars';
      case 'classic': return s.bestTimes.expert ? 'Expert best ' + s.bestTimes.expert + ' s' : s.bestTimes.beginner ? 'Beginner best ' + s.bestTimes.beginner + ' s' : 'no best time yet';
      case 'daily': { const b = p.scores.daily[G.today]; return b ? 'today ' + b.toLocaleString('en-US') : G.daily.mutators.map(id => NS.seasons.MUT_BY_ID[id].name).join(' + '); }
      case 'zen': return s.zenFields + ' fields of calm';
      case 'rush': return s.rushBest ? 'best ' + s.rushBest + ' fields' : 'no run yet';
      case 'gauntlet': return s.gauntletWins ? s.gauntletWins + ' wins' : 'opens with 2 guardians beaten';
      case 'versus': return s.vsWins ? s.vsWins + ' wins' + (s.vsBest ? ', beat ' + NS.versus.CPUS[s.vsBest - 1].name : '') : 'pick your rival';
    }
    return '';
  }

  function drawModes() {
    kit.text('MODES', 60, 56, 40, '#ffffff', { weight: 'bold', shadow: true });
    const list = MODES.filter(m => m.id !== 'story');
    for (let i = 0; i < list.length; ++i) {
      const m = list[i];
      const x = 90 + (i % 3) * 380, y = 100 + Math.floor(i / 3) * 256;
      const open = modeOpen(m);
      const vs = m.id === 'versus';
      const go = m.id === 'classic' ? () => NS.screens.setScreen('classic', 'modes') : () => NS.play.start(m.id);
      const hot = W.area('mode-' + m.id, x, y, 280, 240, open && !vs ? go : null, { disabled: !open, nonav: vs });
      kit.panel(x, y, 280, 240, { accent: open ? UI.accent : '#3a4460', glow: hot && open, alpha: open ? 1 : 0.6 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = hot ? 0.4 : 0.2;
      K.blit(ctx, K.glow(open ? UI.accent : '#556'), x + 140, y + 62, 1.4);
      ctx.restore();
      kit.icon(m.icon, x + 140, y + 62, 48, open ? '#ffffff' : '#8890a8');
      kit.text(m.name, x + 140, y + 120, 22, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      if (vs) {
        kit.fitText(modeBest(m), x + 140, y + 146, 250, 13, { align: 'center', color: UI.gold, weight: 'bold' });
        NS.versus.CPUS.forEach((c, k) => {
          W.button('vs-' + c.id, c.name, x + 12 + (k % 2) * 132, y + 162 + Math.floor(k / 2) * 36, 124, 30, { px: 13, accent: c.color, action: () => { G.profile.settings.vsCpu = c.id; NS.play.start('versus', { cpu: c.id }); } });
          if (G.profile.stats.vsBest > k) kit.icon('star', x + 128 + (k % 2) * 132, y + 168 + Math.floor(k / 2) * 36, 11, UI.gold);
        });
        continue;
      }
      kit.wrap(m.desc, x + 20, y + 148, 240, 13, UI.textDim);
      kit.fitText(modeBest(m), x + 140, y + 220, 250, 13, { align: 'center', color: open ? UI.gold : UI.textMute, weight: 'bold' });
      if (!open) kit.lock(x + 250, y + 30, 22);
    }
    W.button('back', 'Back', 60, 640, 220, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  /* ---- Classic ---- */
  function stepper(id, label, value, x, y, onChange) {
    kit.text(label, x, y + 16, 13, UI.textDim, { weight: 'bold' });
    W.button(id + '-', '-', x + 110, y, 40, 32, { px: 18, action: () => onChange(-1) });
    kit.text(String(value), x + 185, y + 17, 18, '#ffffff', { align: 'center', weight: 'bold' });
    W.button(id + '+', '+', x + 220, y, 40, 32, { px: 18, action: () => onChange(1) });
  }

  function drawClassic() {
    const p = G.profile, s = p.stats, set = p.settings, D = C.DIFFS, CU = C.CUSTOM;
    kit.text('CLASSIC', 60, 56, 40, '#ffffff', { weight: 'bold', shadow: true });
    kit.text('The original rules and sizes - first click always safe', 60, 92, 15, UI.textDim);
    ['beginner', 'intermediate', 'expert'].forEach((d, i) => {
      const x = 60 + i * 300, y = 120;
      const hot = W.area('cl-' + d, x, y, 284, 190, () => { set.classicDiff = d; NS.play.start('classic', { diff: d }); });
      kit.panel(x, y, 284, 190, { accent: ['#7be08a', '#ffd25a', '#ff6a6a'][i], glow: hot });
      kit.text(D[d].name, x + 142, y + 30, 22, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(D[d].w + ' x ' + D[d].h + '  -  ' + D[d].mines + ' mines', x + 142, y + 58, 14, UI.textDim, { align: 'center' });
      kit.text(s.bestTimes[d] ? 'Best ' + s.bestTimes[d] + ' s' : 'No best time yet', x + 142, y + 96, 18, s.bestTimes[d] ? UI.gold : UI.textMute, { align: 'center', weight: 'bold' });
      const played = s.classicPlayed[d], won = s.classicWins[d];
      kit.text(won + ' won of ' + played + (played ? '  (' + Math.round(won / played * 100) + '%)' : ''), x + 142, y + 128, 13, UI.textDim, { align: 'center' });
      kit.text('Streak ' + s.classicStreak[d] + '  -  best ' + s.classicStreakBestBy[d], x + 142, y + 152, 13, UI.textDim, { align: 'center' });
    });
    const cx = 60, cy = 330;
    kit.panel(cx, cy, 584, 250, { accent: '#c0c0c0' });
    kit.text('CUSTOM', cx + 20, cy + 22, 14, UI.textDim, { weight: 'bold' });
    const cu = set.custom;
    const clampMines = () => { cu.mines = Math.max(CU.minMines, Math.min(Math.floor(cu.w * cu.h * CU.maxDensity), cu.mines)); };
    stepper('cu-w', 'Width', cu.w, cx + 20, cy + 44, d => { cu.w = Math.max(CU.wMin, Math.min(CU.wMax, cu.w + d)); clampMines(); });
    stepper('cu-h', 'Height', cu.h, cx + 20, cy + 86, d => { cu.h = Math.max(CU.hMin, Math.min(CU.hMax, cu.h + d)); clampMines(); });
    stepper('cu-m', 'Mines', cu.mines, cx + 20, cy + 128, d => { cu.mines += d * (cu.w * cu.h > 300 ? 5 : 1); clampMines(); });
    W.button('cl-custom', 'Play custom', cx + 20, cy + 180, 260, 50, { icon: 'play', accent: UI.gold, action: () => { set.classicDiff = 'custom'; NS.play.start('classic', { diff: 'custom' }); } });
    W.button('cl-marks', set.marks !== false ? 'Question marks: on' : 'Question marks: off', cx + 300, cy + 44, 264, 44, { px: 14, selected: set.marks !== false, action: () => { set.marks = set.marks === false; NS.save.saveProfile(p); } });
    W.button('cl-proven', set.proven ? 'Proven fields: on' : 'Proven fields: off', cx + 300, cy + 98, 264, 44, { px: 14, selected: !!set.proven,
      sub: set.proven ? 'never a guess needed' : 'classic random fields', action: () => { set.proven = !set.proven; NS.save.saveProfile(p); } });
    kit.wrap('Proven fields are checked by a solver: every one can be cleared by logic alone. Best times count either way.', cx + 300, cy + 168, 264, 12, UI.textDim);
    const tx = 664, ty = 330;
    kit.panel(tx, ty, 556, 250, { accent: UI.gold });
    kit.text('BEST TIMES', tx + 20, ty + 22, 14, UI.textDim, { weight: 'bold' });
    ['beginner', 'intermediate', 'expert'].forEach((d, i) => {
      const x = tx + 20 + i * 180;
      kit.text(D[d].name, x, ty + 52, 14, '#ffffff', { weight: 'bold' });
      const list = p.scores.classic[d];
      for (let k = 0; k < 5; ++k) {
        const e = list[k];
        kit.fitText(e ? (k + 1) + '.  ' + e.time + ' s  ' + e.name : (k + 1) + '.  -', x, ty + 82 + k * 30, 165, 13, { color: e ? (k ? UI.textDim : UI.gold) : UI.textMute });
      }
    });
    W.button('back', 'Back', 60, 640, 220, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function update(dt) {
    NS.demo.update(dt);
  }

  Object.assign(NS.title, { draw, drawModes, drawClassic, update, modeOpen, modeBest, logo });
})();
