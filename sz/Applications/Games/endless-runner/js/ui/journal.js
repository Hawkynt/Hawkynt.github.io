/* The journal: Goals (today's quests with progress, the play streak and the running festival's
   reward track), Achievements (every one with its reward, earned or not), Statistics (lifetime
   numbers) and the high-score table. Draws and registers hit areas; owns the tab choice. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const K = NS.artKit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ACHIEVEMENTS, QUEST_BY_ID, starCount } = NS.goals;
  const { TIERS } = NS.seasons;
  const { ctx } = NS.view;

  const TABS = [['goals', 'Goals'], ['achievements', 'Achievements'], ['stats', 'Statistics'], ['scores', 'High Scores']];

  function goals() {
    const s = G.save;
    kit.panel(60, 140, 560, 250, { radius: 12 });
    kit.text('Today\'s quests', 80, 166, 20, UI.accent, { weight: 'bold' });
    const qs = s.day.quests || [];
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i], def = QUEST_BY_ID[q.id];
      const pr = rules.questProgress(s, q);
      const y = 210 + i * 58;
      kit.icon(q.claimed ? 'check' : 'star', 92, y, 24, q.claimed ? UI.good : UI.gold);
      kit.text(def.text(q.n), 116, y - 10, 17, q.claimed ? UI.textMute : '#ffffff', { weight: 'bold' });
      kit.bar(116, y + 10, 330, 8, pr / q.n, q.claimed ? UI.good : UI.accent);
      kit.text(pr + ' / ' + q.n, 460, y + 14, 13, UI.textDim);
      kit.amount('coins', def.reward, 520, y, 16);
    }
    kit.panel(60, 404, 560, 110, { radius: 12, accent: '#ff9ac0' });
    kit.icon('heart', 92, 440, 28, '#ff9ac0');
    kit.text(s.streak.count + ' day streak', 120, 436, 22, '#ff9ac0', { weight: 'bold' });
    kit.text('Best ' + s.streak.best + ' days. Every day in a row pays more coins (up to day 7).', 120, 466, 14, UI.textDim);
    kit.text('Come back tomorrow for three new quests and a new Daily Run.', 120, 490, 14, UI.textDim);
    const sea = G.season;
    if (!sea) return;
    kit.panel(640, 140, 580, 374, { radius: 12, accent: sea.color });
    K.blit(ctx, NS.propArt.token(sea.token), 676, 176, 1.2);
    kit.text(sea.name, 706, 168, 24, sea.color, { weight: 'bold' });
    kit.text(sea.blurb + ' ' + NS.seasons.daysLeft() + ' days left.', 706, 194, 14, UI.textDim);
    kit.text(s.season.tokens + ' ' + sea.token + (s.season.tokens === 1 ? '' : 's') + ' collected - they turn up in every mode.', 670, 232, 15, '#ffffff');
    for (let i = 0; i < TIERS.length; ++i) {
      const t = TIERS[i], y = 268 + i * 46, got = s.season.tokens >= t.n;
      kit.icon(got ? 'check' : 'gift', 686, y + 4, 24, got ? UI.good : sea.color);
      const what = t.kind === 'coins' ? t.amount + ' coins' : t.kind === 'gems' ? t.amount + ' gems' :
        t.kind === 'trail' ? NS.cosmetics.TRAIL_BY_ID[sea.trail].name + ' trail' : NS.cosmetics.OUTFIT_BY_ID[sea.outfit].name + ' outfit';
      kit.text(t.n + ' tokens: ' + what, 712, y, 16, got ? UI.textMute : '#ffffff', { weight: 'bold' });
      kit.bar(712, y + 16, 460, 5, s.season.tokens / t.n, sea.color);
    }
  }

  function achievements() {
    const s = G.save;
    let got = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) if (s.ach[ACHIEVEMENTS[i].id]) ++got;
    kit.text(got + ' / ' + ACHIEVEMENTS.length + ' earned', 1220, 110, 16, UI.gold, { align: 'right', weight: 'bold' });
    const per = 24, page = Math.min(G.ui.scroll, Math.ceil(ACHIEVEMENTS.length / per) - 1);
    for (let k = 0; k < per; ++k) {
      const i = page * per + k;
      if (i >= ACHIEVEMENTS.length) break;
      const a = ACHIEVEMENTS[i], on = !!s.ach[a.id];
      const x = 60 + (k % 3) * 390, y = 140 + Math.floor(k / 3) * 62;
      kit.panel(x, y, 376, 54, { radius: 10, accent: on ? UI.gold : UI.textMute, alpha: on ? 0.95 : 0.6, brackets: false });
      kit.icon('trophy', x + 28, y + 27, 26, on ? UI.gold : UI.textMute);
      kit.fitText(a.name, x + 52, y + 18, 230, 16, { weight: 'bold', color: on ? '#ffffff' : UI.textDim });
      kit.fitText(a.desc, x + 52, y + 38, 250, 12, { color: UI.textDim });
      kit.amount('gems', a.gems, x + 362, y + 27, 15, 'right');
    }
    const pages = Math.ceil(ACHIEVEMENTS.length / per);
    if (pages > 1) {
      W.button('prev', 'Prev', 60, 646, 110, 40, { action: () => { G.ui.scroll = Math.max(0, page - 1); }, disabled: page === 0, px: 15 });
      W.button('next', 'Next', 180, 646, 110, 40, { action: () => { G.ui.scroll = Math.min(pages - 1, page + 1); }, disabled: page >= pages - 1, px: 15 });
    }
  }

  function stats() {
    const s = G.save, st = s.stats;
    const n = k => (st[k] || 0).toLocaleString ? Math.floor(st[k] || 0).toLocaleString('en-US') : String(st[k] || 0);
    const rows = [
      ['Runs', n('runs')], ['Distance run', n('dist') + ' m'], ['Best single run', n('bestRun') + ' m'], ['Arcade best', n('arcadeBest') + ' m'],
      ['Featured best', n('weeklyBest') + ' m'], ['Best score', n('scoreBest')], ['Coins collected', n('coins')], ['Gems found', n('gemsRun')],
      ['Jumps', n('jumps')], ['Slides', n('slides')], ['Dashes', n('dashes')], ['Near misses', n('nears')],
      ['Obstacles smashed', n('smashes')], ['Power-ups', n('powers')], ['Best combo', n('comboBest')], ['Crashes', n('deaths')],
      ['Revives', n('revives')], ['Guardians beaten', n('bosses')], ['Stars', String(starCount(s))], ['Spark Shards', n('shards')],
      ['Daily Runs', n('dailyRuns')], ['Zen distance', n('zenDist') + ' m'], ['Play time', Math.floor((st.time || 0) / 60) + ' min'], ['Runner level', String(s.level)],
    ];
    for (let i = 0; i < rows.length; ++i) {
      const x = 60 + (i % 3) * 390, y = 150 + Math.floor(i / 3) * 56;
      kit.panel(x, y, 376, 46, { radius: 8, brackets: false, alpha: 0.85 });
      kit.text(rows[i][0], x + 16, y + 23, 15, UI.textDim);
      kit.text(rows[i][1], x + 360, y + 23, 18, '#ffffff', { align: 'right', weight: 'bold' });
    }
  }

  function scores() {
    const list = G.save.scores;
    kit.panel(240, 140, 800, 470, { radius: 12 });
    const head = ['#', 'Score', 'Distance', 'Coins', 'Mode', 'Date'];
    const xs = [270, 340, 520, 660, 760, 880];
    for (let i = 0; i < head.length; ++i) kit.text(head[i], xs[i], 170, 15, UI.accent, { weight: 'bold' });
    if (!list.length) kit.text('No runs yet - Arcade and Featured runs land here.', 640, 360, 18, UI.textDim, { align: 'center' });
    for (let i = 0; i < list.length; ++i) {
      const e = list[i], y = 210 + i * 38;
      const col = i === 0 ? UI.gold : '#ffffff';
      kit.text(String(i + 1), xs[0], y, 17, col, { weight: 'bold' });
      kit.text(String(e.score), xs[1], y, 17, col, { weight: 'bold' });
      kit.text(e.dist + ' m', xs[2], y, 16, UI.text);
      kit.text(String(e.coins), xs[3], y, 16, UI.text);
      kit.text(e.mode === 'classic' ? 'Classic' : NS.hud.MODE_NAMES[e.mode] || e.mode, xs[4], y, 16, UI.textDim);
      kit.text(e.date || '-', xs[5], y, 14, UI.textMute);
    }
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(8,6,22,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Journal', 60, 44, 32, '#ffffff', { weight: 'bold' });
    const tab = G.ui.journalTab;
    for (let i = 0; i < TABS.length; ++i) {
      const t = TABS[i];
      W.button('tab:' + t[0], t[1], 60 + i * 190, 80, 180, 40, { action: () => { G.ui.journalTab = t[0]; G.ui.scroll = 0; }, accent: tab === t[0] ? UI.gold : UI.accent, px: 16 });
    }
    if (tab === 'goals') goals();
    else if (tab === 'achievements') achievements();
    else if (tab === 'stats') stats();
    else scores();
    W.button('back', 'Back', v.x1 - 190, 22, 160, 46, { action: () => scr.back('journal'), icon: 'back' });
  }

  Object.assign(NS.journal, {
    draw
  });
})();
