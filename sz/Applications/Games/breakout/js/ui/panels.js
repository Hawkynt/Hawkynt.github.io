/* The menu panels: the tech tree (five branches of nodes with links, levels and costs, buying
   with shards and a burst), the collection (paddles, balls and trails with live previews; equip
   or buy with gems), the journal (achievements, quests and
   streak, the festival track, statistics, high scores), the results of a game (stars, records,
   shards, XP, quests, festival tokens, achievements; again, next stage, map or title), the pause
   menu with settings, and How to Play. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const M = NS.metaData;
  const { UI, TAU } = C;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  function backButton(label) {
    W.button('back', label || 'Back', 40, 656, 220, 46, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function header(title, sub) {
    kit.text(title, 40, 44, 34, '#ffffff', { weight: 'bold', shadow: true });
    if (sub) kit.text(sub, 40, 78, 14, UI.textDim);
    kit.chip('shard', G.profile.shards.toLocaleString('en-US'), 980, 26, UI.shard, 130);
    kit.chip('gem', G.profile.gems, 1120, 26, UI.gem, 120);
  }

  /* ---- tech tree ---- */
  function nodePos(n) {
    const bi = M.BRANCHES.findIndex(b => b.id === n.branch);
    return { x: 40 + bi * 244 + 20 + n.x * 104, y: 150 + n.y * 118 };
  }

  function drawTree() {
    const p = G.profile;
    header('TECH TREE', 'Shards from every game buy permanent upgrades - ' + P.treeLevels(p) + ' / ' + P.treeMax() + ' levels');
    for (let b = 0; b < M.BRANCHES.length; ++b) {
      const br = M.BRANCHES[b];
      kit.text(br.name.toUpperCase(), 40 + b * 244 + 20, 118, 15, br.color, { weight: 'bold' });
    }
    ctx.lineWidth = 3;
    for (const n of M.TREE) for (const r of n.req) {
      const a = nodePos(M.TREE_BY_ID[r[0]]), c = nodePos(n);
      ctx.strokeStyle = P.nodeLevel(p, r[0]) >= r[1] ? K.rgba(M.BRANCHES.find(b => b.id === n.branch).color, 0.8) : 'rgba(120,130,160,0.3)';
      ctx.beginPath();
      ctx.moveTo(a.x + 46, a.y + 80);
      ctx.bezierCurveTo(a.x + 46, a.y + 100, c.x + 46, c.y - 20, c.x + 46, c.y);
      ctx.stroke();
    }
    let sel = M.TREE_BY_ID[G.ui.treeSel] || M.TREE[0];
    for (const n of M.TREE) {
      const pos = nodePos(n);
      const state = P.nodeState(p, n.id);
      const lvl = P.nodeLevel(p, n.id);
      const br = M.BRANCHES.find(b => b.id === n.branch);
      const hot = W.area('node-' + n.id, pos.x, pos.y, 92, 80, () => {
        G.ui.treeSel = n.id;
        if (P.buyNode(p, n.id)) {
          sfx('powerup');
          NS.fx.burst(pos.x + 46, pos.y + 40, 30, [br.color, '#ffffff'], 'star', 260, 200, 5);
          NS.fx.ring(pos.x + 46, pos.y + 40, 10, 90, 0.6, br.color, 4);
          NS.save.saveProfile(p);
          NS.progress.checkAchievements(p).forEach(a => NS.screens.toast('Achievement: ' + a.name, UI.gold, 'trophy'));
        } else if (state !== 'maxed') sfx('error', { volume: 0.4 });
      });
      if (hot) sel = n;
      const glow = state === 'available';
      kit.panel(pos.x, pos.y, 92, 80, { radius: 14, accent: state === 'maxed' ? UI.gold : state === 'locked' ? '#3a4460' : br.color, glow: glow || hot,
        alpha: state === 'locked' ? 0.55 : 1, top: G.ui.treeSel === n.id ? 'rgba(60,80,130,0.97)' : undefined });
      kit.fitText(n.name, pos.x + 46, pos.y + 22, 84, 12, { align: 'center', weight: 'bold', color: '#ffffff' });
      for (let k = 0; k < n.costs.length; ++k) K.circle(ctx, pos.x + 46 + (k - (n.costs.length - 1) / 2) * 13, pos.y + 44, 4.5, k < lvl ? br.color : 'rgba(255,255,255,0.15)');
      kit.text(state === 'maxed' ? 'MAX' : n.costs[lvl].toLocaleString('en-US'), pos.x + 46, pos.y + 64, 12, state === 'available' ? UI.good : state === 'maxed' ? UI.gold : UI.textMute, { align: 'center', weight: 'bold' });
      if (state === 'locked') kit.lock(pos.x + 80, pos.y + 12, 12);
    }
    const lvl = P.nodeLevel(p, sel.id);
    kit.panel(300, 640, 940, 66, { accent: M.BRANCHES.find(b => b.id === sel.branch).color });
    kit.text(sel.name + '  (' + lvl + ' / ' + sel.costs.length + ')', 320, 660, 17, '#ffffff', { weight: 'bold' });
    kit.fitText(P.nodeText(sel, Math.max(1, lvl)) + (sel.req.length ? '  -  needs ' + sel.req.map(r => M.TREE_BY_ID[r[0]].name).join(', ') : ''), 320, 686, 900, 13, { color: UI.textDim });
    backButton();
  }

  /* ---- collection ---- */
  const WTABS = ['Paddles', 'Balls', 'Trails'];

  function drawWardrobe() {
    const p = G.profile;
    header('COLLECTION', 'Equip what you own; buy with gems or earn with stars, levels, achievements and festivals');
    for (let i = 0; i < WTABS.length; ++i)
      W.button('wt' + i, WTABS[i], 40 + i * 200, 96, 190, 38, { selected: G.ui.wardTab === i, px: 15, action: () => { G.ui.wardTab = i; } });
    const list = [M.PADDLES, M.BALLS, M.TRAILS][G.ui.wardTab];
    const key = ['paddle', 'ball', 'trail'][G.ui.wardTab];
    for (let i = 0; i < list.length; ++i) {
      const it = list[i];
      const x = 40 + (i % 6) * 200, y = 150 + Math.floor(i / 6) * 166;
      const own = P.isUnlocked(p, it);
      const eq = p.cosmetics[key] === it.id;
      const buyable = !own && it.unlock.k === 'gems';
      const hot = W.area('item' + i, x, y, 190, 156, () => {
        if (own) { p.cosmetics[key] = it.id; sfx('select'); NS.save.saveProfile(p); if (key === 'trail') preview(x + 95, y + 60, it); }
        else if (buyable && P.buyCosmetic(p, it)) { p.cosmetics[key] = it.id; sfx('win'); NS.fx.burst(x + 95, y + 60, 40, [UI.gem, '#ffffff'], 'star', 300, 200, 5); NS.save.saveProfile(p); }
        else sfx('error', { volume: 0.4 });
      });
      kit.panel(x, y, 190, 156, { accent: eq ? UI.gold : own ? UI.accent : '#3a4460', glow: eq || hot, alpha: own || buyable ? 1 : 0.7 });
      ctx.save();
      if (!own) ctx.globalAlpha = 0.45;
      if (key === 'paddle') {
        ctx.drawImage(NS.sprites.paddleBody(it), x + 41, y + 56, 108, C.PADDLE_H);
        const cap = NS.sprites.paddleCap(it);
        ctx.drawImage(cap, x + 30, y + 52);
        ctx.drawImage(cap, x + 140, y + 52);
      } else if (key === 'ball') {
        const img = NS.sprites.ball(it, 18);
        ctx.drawImage(img, x + 95 - img.width / 2, y + 62 - img.height / 2);
      } else {
        const sp = NS.fxRender.partSprite(NS.fx.KINDS[it.kind === 'rainbow' ? 'spark' : it.kind], it.color);
        for (let k = 0; k < 6; ++k) ctx.drawImage(sp, x + 30 + k * 22, y + 50 + Math.sin(G.time * 3 + k) * 10, 22, 22);
      }
      ctx.restore();
      kit.fitText(it.name, x + 95, y + 122, 176, 15, { align: 'center', weight: 'bold', color: '#ffffff' });
      kit.fitText(eq ? 'equipped' : own ? 'click to equip' : P.unlockText(it), x + 95, y + 142, 176, 12, { align: 'center', color: eq ? UI.gold : own ? UI.textDim : buyable ? UI.gem : UI.textMute });
      if (!own && !buyable) kit.lock(x + 170, y + 18, 14);
    }
    backButton();
  }

  function preview(x, y, it) {
    NS.fx.burst(x, y, 30, [it.color, '#ffffff'], it.kind === 'rainbow' ? 'spark' : it.kind, 260, 300, 6);
  }

  /* ---- journal ---- */
  const JTABS = ['Achievements', 'Quests', 'Festival', 'Statistics', 'High Scores'];

  function drawJournal() {
    const p = G.profile;
    header('JOURNAL', P.countAchievements(p) + ' / ' + M.ACHIEVEMENTS.length + ' achievements - each pays 10 gems');
    for (let i = 0; i < JTABS.length; ++i)
      W.button('jt' + i, JTABS[i], 40 + i * 200, 96, 190, 38, { selected: G.ui.journalTab === i, px: 15, action: () => { G.ui.journalTab = i; } });
    [achievements, questsTab, festivalTab, statsTab, scoresTab][G.ui.journalTab](p);
    backButton();
  }

  function achievements(p) {
    let hover = null;
    for (let i = 0; i < M.ACHIEVEMENTS.length; ++i) {
      const a = M.ACHIEVEMENTS[i];
      const x = 40 + (i % 14) * 86, y = 150 + Math.floor(i / 14) * 82;
      const got = !!p.achievements[a.id];
      const hot = W.area('ach' + i, x, y, 80, 74, null, { nonav: true });
      kit.panel(x, y, 80, 74, { radius: 10, accent: got ? UI.gold : '#3a4460', glow: hot, alpha: got ? 1 : 0.55 });
      kit.icon(a.icon, x + 40, y + 37, 30, got ? UI.gold : '#6a7290');
      if (hot) hover = a;
    }
    if (hover) {
      kit.panel(300, 600, 940, 44, { accent: UI.gold });
      kit.text(hover.name + '  -  ' + hover.desc + (p.achievements[hover.id] ? '  (unlocked)' : ''), 320, 622, 15, '#ffffff', { weight: 'bold' });
    }
  }

  function questsTab(p) {
    const d = p.quests;
    kit.text('Three new quests every day. Finish all three for 10 gems.', 40, 168, 15, UI.textDim);
    if (d) d.list.forEach((q, i) => {
      const y = 190 + i * 84;
      kit.panel(40, y, 600, 72, { accent: q.done ? UI.good : UI.accent });
      kit.icon(q.done ? 'star' : 'scroll', 74, y + 36, 26, q.done ? UI.good : UI.shard);
      kit.text(P.questText(q), 104, y + 24, 17, '#ffffff', { weight: 'bold' });
      kit.bar(104, y + 44, 400, 12, q.progress / q.n, q.done ? UI.good : UI.shard);
      kit.text('+' + q.reward + ' shards', 620, y + 24, 13, UI.shard, { align: 'right', weight: 'bold' });
    });
    const s = p.streak;
    kit.panel(680, 190, 560, 156, { accent: UI.good });
    kit.icon('calendar', 720, 240, 36, UI.good);
    kit.text((s.last === G.today ? s.count : 0) + ' day streak', 760, 232, 26, '#ffffff', { weight: 'bold' });
    kit.text('Best streak: ' + s.best + ' days', 760, 266, 15, UI.textDim);
    kit.wrap('Play on consecutive days for a growing daily gift of shards, and gems every seventh day.', 700, 300, 520, 14, UI.textDim);
  }

  function festivalTab(p) {
    const se = G.season;
    const ev = NS.seasons.eventId(new Date());
    const f = p.festival.event === ev ? p.festival : { tokens: 0, claimed: 0 };
    kit.text(se.name + '  -  ' + se.blurb, 40, 172, 22, se.color, { weight: 'bold' });
    kit.text('Every brick you break in any mode collects ' + se.token + ' (gold targets, crystals and guardians count extra). ' + NS.seasons.daysLeft(new Date()) + ' days left.', 40, 204, 14, UI.textDim);
    const T = NS.seasons.TIERS;
    for (let i = 0; i < T.length; ++i) {
      const x = 40 + i * 240, y = 240;
      const got = f.claimed > i;
      kit.panel(x, y, 224, 180, { accent: got ? UI.gold : se.color, glow: got });
      kit.text('TIER ' + (i + 1), x + 112, y + 24, 14, UI.textDim, { align: 'center', weight: 'bold' });
      const t = T[i];
      const label = t.kind === 'shards' ? t.amount + ' shards' : t.kind === 'gems' ? t.amount + ' gems' : t.kind === 'paddle' ? M.PADDLES.find(s => s.id === se.paddle).name + ' paddle' : M.TRAILS.find(s => s.id === se.trail).name + ' trail';
      kit.icon(t.kind === 'shards' ? 'shard' : t.kind === 'gems' ? 'gem' : t.kind === 'paddle' ? 'wide' : 'sparkle', x + 112, y + 80, 40, got ? UI.gold : se.color);
      kit.fitText(label, x + 112, y + 124, 200, 15, { align: 'center', weight: 'bold', color: '#ffffff' });
      kit.text(got ? 'claimed' : t.n + ' ' + se.token, x + 112, y + 152, 13, got ? UI.gold : UI.textDim, { align: 'center' });
    }
    kit.bar(40, 446, 1184, 14, f.tokens / T[T.length - 1].n, se.color);
    kit.text(f.tokens + ' ' + se.token, 40, 478, 15, '#ffffff', { weight: 'bold' });
  }

  function statsTab(p) {
    const s = p.stats;
    const rows = [['Games played', s.games], ['Bricks broken', s.bricks], ['Best combo', s.best], ['Power-ups caught', s.powers], ['Bombs set off', s.bombs], ['Gold targets', s.gold],
      ['Crystals', s.crystals], ['Laser shots', s.lasers], ['Balls lost', s.lost], ['Most balls at once', s.maxBalls], ['Stages finished', s.stages], ['Flawless stages', s.flawless],
      ['Guardians beaten', P.bossesBeaten(p)], ['Stars', P.starsTotal(p) + ' / 90'], ['Best Arcade wall', s.arcadeBest], ['Boss Rush wins', s.rushWins],
      ['Daily Challenges', s.dailies], ['Minutes in Zen', Math.floor(s.zenSeconds / 60)], ['Total score', s.score.toLocaleString('en-US')], ['Time played', Math.floor(s.playSeconds / 3600) + 'h ' + Math.floor(s.playSeconds / 60) % 60 + 'm']];
    for (let i = 0; i < rows.length; ++i) {
      const x = 40 + (i % 2) * 600, y = 170 + Math.floor(i / 2) * 44;
      kit.panel(x, y, 584, 38, { radius: 10 });
      kit.text(rows[i][0], x + 18, y + 19, 15, UI.textDim);
      kit.text(String(rows[i][1]), x + 566, y + 19, 16, '#ffffff', { align: 'right', weight: 'bold' });
    }
  }

  function scoresTab(p) {
    const tables = [['Arcade', p.scores.arcade, e => e.score.toLocaleString('en-US') + '  (wall ' + e.wall + ')'], ['Blitz', p.scores.blitz, e => e.score.toLocaleString('en-US')]];
    for (let t = 0; t < tables.length; ++t) {
      const x = 40 + t * 420, y = 160;
      kit.panel(x, y, 400, 470, { accent: UI.accent });
      kit.text(tables[t][0].toUpperCase(), x + 200, y + 24, 16, UI.gold, { align: 'center', weight: 'bold' });
      const list = tables[t][1];
      if (!list.length) kit.text('no entries yet', x + 200, y + 70, 13, UI.textMute, { align: 'center' });
      for (let i = 0; i < Math.min(10, list.length); ++i) {
        kit.text((i + 1) + '.', x + 18, y + 64 + i * 40, 14, UI.textDim);
        kit.fitText(tables[t][2](list[i]), x + 44, y + 64 + i * 40, 330, 14, { color: '#ffffff', weight: 'bold' });
        kit.text(list[i].day || '', x + 44, y + 82 + i * 40, 10, UI.textMute);
      }
    }
    const d = p.scores.daily[G.today];
    kit.text('Daily Challenge today: ' + (d ? d.toLocaleString('en-US') : 'not played yet'), 40, 648 - 6, 14, UI.textDim);
  }

  /* ---- results ---- */
  function drawResults() {
    const r = G.result;
    if (!r) return;
    const run = G.run;
    const p = G.profile;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,16,0.72)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const story = r.mode === 'story';
    const st = r.stage ? NS.worldData.BY_ID[r.stage] : null;
    const title = r.won ? (story ? 'STAGE CLEAR!' : r.mode === 'rush' ? 'GAUNTLET WON!' : r.reason === 'time' ? 'TIME!' : 'WELL PLAYED')
      : r.reason === 'quit' ? 'GAME ENDED' : r.reason === 'time' ? 'OUT OF TIME' : 'OUT OF BALLS';
    kit.text(title, 640, 82, 54, r.won ? UI.gold : '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.8)' });
    kit.text(st ? st.name : M.MODE_BY_ID[r.mode].name, 640, 128, 20, UI.textDim, { align: 'center' });
    if (story) {
      for (let k = 0; k < 3; ++k) {
        const pop = Math.min(1, Math.max(0, (G.time - (G.resultT || 0)) * 2 - k * 0.6));
        ctx.save();
        ctx.translate(560 + k * 80, 186);
        ctx.scale(0.4 + pop * 0.6, 0.4 + pop * 0.6);
        kit.icon('star', 0, 0, 60, r.stars[k] ? UI.gold : 'rgba(120,130,160,0.5)');
        ctx.restore();
      }
    }
    const big = r.score.toLocaleString('en-US');
    kit.text(big, 640, story ? 262 : 210, 48, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    if (r.best) kit.text('NEW PERSONAL BEST!', 640, story ? 304 : 254, 22, UI.good, { align: 'center', weight: 'bold' });
    else if (r.rank >= 0) kit.text('Rank #' + (r.rank + 1) + ' in your top ten', 640, story ? 304 : 254, 18, UI.textDim, { align: 'center' });
    const s = r.stats;
    const facts = [['Bricks', r.bricks], ['Best combo', s.best], r.mateHits != null ? ['Partner saves', r.mateHits] : ['Power-ups', s.caught], ['Balls lost', s.lost], [r.mode === 'story' ? 'Bombs' : 'Wall', r.mode === 'story' ? s.bombs : r.wall], ['Time', NS.hud.clock(r.time)]];
    for (let i = 0; i < facts.length; ++i) {
      const x = 260 + i * 152;
      kit.text(String(facts[i][1]), x, 350, 22, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(facts[i][0], x, 376, 12, UI.textDim, { align: 'center' });
    }
    const gains = [['shard', '+' + r.shards + ' shards', UI.shard], ['xp', '+' + r.xp + ' XP' + (r.levels ? '  -  LEVEL UP! ' + p.level : ''), UI.xp]];
    if (r.gems) gains.push(['gem', '+' + r.gems + ' gems', UI.gem]);
    if (r.tokens) gains.push(['gift', '+' + r.tokens + ' ' + G.season.token, G.season.color]);
    gains.forEach((gn, i) => {
      kit.panel(340, 404 + i * 40, 600, 34, { radius: 17, accent: gn[2] });
      kit.icon(gn[0], 362, 421 + i * 40, 18, gn[2]);
      kit.text(gn[1], 384, 422 + i * 40, 15, '#ffffff', { weight: 'bold' });
    });
    let y = 410 + gains.length * 40;
    const notes = [];
    r.quests.forEach(q => notes.push(q.bonus ? 'All daily quests done! +10 gems' : 'Quest done: ' + P.questText(q.quest) + ' (+' + q.reward + ')'));
    r.festival.forEach(t => notes.push('Festival reward: ' + (t.kind === 'shards' ? t.amount + ' shards' : t.kind === 'gems' ? t.amount + ' gems' : 'a new ' + t.kind)));
    r.achievements.forEach(a => notes.push('Achievement: ' + a.name + ' (+10 gems)'));
    for (let i = 0; i < Math.min(3, notes.length); ++i) kit.fitText(notes[i], 640, y + 10 + i * 22, 900, 14, { align: 'center', color: UI.gold, weight: 'bold' });
    const bx = 260;
    const next = story && r.won ? nextStage(r.stage) : null;
    W.button('r-again', story ? 'Retry' : 'Play again', bx, 640, 240, 52, { icon: 'play', action: () => NS.play.start(r.mode, { stage: r.stage }) });
    if (next) W.button('r-next', 'Next stage', bx + 260, 640, 240, 52, { icon: 'flag', accent: UI.gold, action: () => NS.play.start('story', { stage: next }) });
    else W.button('r-tree', 'Tech Tree', bx + 260, 640, 240, 52, { icon: 'tree', accent: UI.shard, action: () => NS.screens.open('tree', 'results') });
    W.button('r-map', story ? 'Map' : 'Modes', bx + 520, 640, 240, 52, { icon: story ? 'map' : 'flag', action: () => { G.run = null; NS.screens.setScreen(story ? 'map' : 'modes', 'title'); } });
  }

  function nextStage(id) {
    const i = NS.worldData.STAGES.findIndex(s => s.id === id);
    const n = NS.worldData.STAGES[i + 1];
    if (!n) return null;
    if (n.index === 0) G.ui.world = n.world;
    return n.id;
  }

  /* ---- pause ---- */
  function drawPause() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,16,0.75)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('PAUSED', 640, 92, 48, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    const run = G.run;
    if (run) kit.text(run.stage ? NS.worldData.BY_ID[run.stage].name : M.MODE_BY_ID[run.mode].name, 640, 132, 17, UI.textDim, { align: 'center' });
    const x = 440, w = 400;
    let y = 160;
    const b = (id, label, opts) => { W.button(id, label, x, y, w, 50, opts); y += 58; };
    b('p-resume', 'Resume', { icon: 'play', accent: UI.good, action: () => NS.screens.resume() });
    b('p-tree', 'Tech Tree', { icon: 'tree', accent: UI.shard, sub: G.profile.shards.toLocaleString('en-US') + ' shards - upgrades apply next game', action: () => NS.screens.open('tree', 'paused') });
    b('p-help', 'How to Play', { icon: 'help', action: () => NS.screens.open('help', 'paused') });
    b('p-end', run && run.mode === 'zen' ? 'Finish Zen' : 'End game', { icon: 'flag', accent: UI.bad, action: () => {
      if (run && run.mode === 'zen') NS.play.quit();
      else NS.screens.confirm('End this game?', 'Your progress in this game ends here (rewards for what you did are still paid).', () => NS.play.quit());
    } });
    b('p-title', 'Title (game is saved)', { icon: 'back', action: () => { NS.save.saveRun(G.run); NS.screens.setScreen('title'); } });
    const s = G.profile.settings;
    const M2 = SZ.GameMusic;
    W.button('s-mouse', 'Mouse: ' + (s.mouse !== false ? 'on' : 'off'), x, y + 10, 128, 38, { px: 13, action: () => { s.mouse = s.mouse === false; } });
    W.button('s-sens', 'Speed x' + (s.sensitivity || 1).toFixed(1), x + 136, y + 10, 128, 38, { px: 13, action: () => { s.sensitivity = (s.sensitivity || 1) >= 1.6 ? 1 : Math.round(((s.sensitivity || 1) + 0.2) * 10) / 10; } });
    W.button('s-music', 'Music: ' + (M2 && M2.enabled ? 'on' : 'off'), x + 272, y + 10, 128, 38, { px: 13, action: () => { if (M2) M2.toggle(); } });
  }

  /* ---- help ---- */
  const HELP = [
    ['Paddle and ball', 'Move the paddle with the mouse, a finger, Left/Right or A/D. Click, tap or Space launches the ball. Where the ball lands on the paddle sets its angle.'],
    ['Bricks', 'Colour bricks break in one hit, steel in two, titan in three (even fire bounces off). Glass lets the ball through, walls never break, regrowing bricks come back.'],
    ['Bombs and treasure', 'Bombs blow up their neighbours - chain them. Gold targets are the goal of gold stages. Crystals always drop a power-up.'],
    ['Power-ups', 'Catch falling capsules: Wide, Multi, Slow, Fire, Laser (Space or click to fire), Barrier, Extra Life and more from the tech tree. Grey ones are bad - dodge them.'],
    ['Combos', 'Break bricks without touching the paddle to build a combo: every brick in a chain scores more.'],
    ['Guardians', 'Each fortress ends with a guardian behind an orbiting shield. Hit its body to hurt it and dodge its shots - they stun or shrink your paddle.'],
    ['Team play', 'Duo puts Bolt on the top edge, Arena adds Captain Orla and Bolt-2 on the sides. Open edges glow red: a ball past a partner is lost.'],
    ['Grow stronger', 'Stages give up to three stars. Every game pays shards for the tech tree and XP; quests and festivals add more each day.'],
  ];


  function drawHelp() {
    kit.text('HOW TO PLAY', 640, 50, 38, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    for (let i = 0; i < HELP.length; ++i) {
      const x = 60 + (i % 2) * 590, y = 92 + Math.floor(i / 2) * 134;
      kit.panel(x, y, 570, 122, { accent: UI.accent });
      kit.text(HELP[i][0], x + 20, y + 26, 19, UI.gold, { weight: 'bold' });
      kit.wrap(HELP[i][1], x + 20, y + 58, 530, 15, '#ffffff');
    }
    kit.text('Esc/P pause  -  Space launch and fire  -  touch: drag to steer, tap to launch', 640, 636, 14, UI.textDim, { align: 'center' });
    backButton();
  }

  Object.assign(NS.tree, { draw: drawTree, nodePos });
  Object.assign(NS.wardrobe, { draw: drawWardrobe });
  Object.assign(NS.journal, { draw: drawJournal });
  Object.assign(NS.results, { draw: drawResults, nextStage });
  Object.assign(NS.pause, { draw: drawPause });
  Object.assign(NS.help, { draw: drawHelp, HELP });
})();
