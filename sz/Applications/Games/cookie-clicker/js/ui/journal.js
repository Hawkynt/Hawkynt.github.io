/* The journal: achievements as a hoverable grid, today's quests with the streak and the
   current era's milestones, the season event with its token track, lifetime statistics and the
   Bake-Off score table with today's Daily modifier. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const K = NS.artKit;
  const E = NS.economy;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const { ACHIEVEMENTS } = NS.achievementData;
  const { STAGES } = NS.treatData;
  const { TRACK, CARRIERS } = NS.eventData;
  const { ctx } = NS.view;

  const TABS = ['Achievements', 'Quests & Eras', 'Season', 'Statistics', 'Bake-Off'];

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(16,8,4,0.93)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('JOURNAL', 40, 40, 34, '#ffffff', { weight: 'bold', shadow: true });
    const tab = G.ui.journalTab;
    for (let i = 0; i < TABS.length; ++i)
      W.button('jtab' + i, TABS[i], 40 + i * 214, 86, 204, 34, { selected: tab === i, px: 15, action: () => { G.ui.journalTab = i; } });
    [achievements, quests, season, stats, bakeoff][tab]();
    W.button('back', G.ui.panelReturn === 'title' ? 'Back to the title' : G.ui.panelReturn === 'paused' ? 'Back to the pause menu' : 'Back to the bakery',
      40, 650, 280, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function achievements() {
    const p = G.profile;
    const n = E.achievementCount(p);
    kit.text(n + ' / ' + ACHIEVEMENTS.length + ' achievements  -  each one gives +' + Math.round((G.stMain ? (G.stMain.achF - 1) / Math.max(1, n) : 0.01) * 100 * 10) / 10 + '% production and a recipe note',
      40, 72, 14, UI.textDim);
    const cols = 16, tw = 72, th = 58;
    let hover = null;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      const x = 40 + (i % cols) * (tw + 4), y = 134 + Math.floor(i / cols) * (th + 4);
      const got = !!p.achievements[a.id];
      const hot = W.area('ach' + i, x, y, tw, th, null, { nonav: true });
      kit.panel(x, y, tw, th, { radius: 8, accent: got ? UI.gold : '#4a3a30', glow: hot, alpha: got ? 1 : 0.55 });
      ctx.globalAlpha = got ? 1 : 0.3;
      kit.icon(a.icon, x + tw / 2, y + th / 2, 28, got ? UI.gold : '#8a7a70');
      ctx.globalAlpha = 1;
      if (hot) hover = a;
    }
    const a = hover;
    if (a) {
      kit.panel(340, 650, 900, 48, { accent: UI.gold });
      kit.text(a.name, 360, 667, 16, p.achievements[a.id] ? UI.gold : '#ffffff', { weight: 'bold' });
      kit.text(a.desc + (p.achievements[a.id] ? '  -  unlocked' : '  -  locked'), 360, 687, 13, UI.textDim);
    }
  }

  function quests() {
    const p = G.profile;
    const d = p.daily;
    kit.text('TODAY\'S QUESTS', 40, 150, 18, UI.gold, { weight: 'bold' });
    kit.text('New quests every day at midnight. Finish all three for 3 bonus notes.', 40, 174, 13, UI.textDim);
    if (d)
      for (let i = 0; i < d.quests.length; ++i) {
        const q = d.quests[i];
        const y = 196 + i * 78;
        kit.panel(40, y, 580, 68, { accent: q.done ? UI.good : UI.accent });
        kit.icon(q.done ? 'trophy' : 'scroll', 72, y + 34, 26, q.done ? UI.good : UI.notes);
        kit.text(NS.progression.questText(q), 100, y + 22, 16, '#ffffff', { weight: 'bold' });
        kit.bar(100, y + 40, 400, 12, q.progress / q.target, q.done ? UI.good : UI.notes);
        kit.text(q.done ? 'done' : fmt.short(Math.min(q.progress, q.target)) + ' / ' + fmt.short(q.target), 600, y + 46, 13, UI.textDim, { align: 'right' });
        kit.text('+' + q.reward + ' notes', 600, y + 22, 13, UI.notes, { align: 'right', weight: 'bold' });
      }
    const s = p.streak;
    kit.panel(40, 440, 580, 120, { accent: UI.good });
    kit.icon('calendar', 76, 480, 32, UI.good);
    kit.text('Day ' + Math.max(1, s.last === G.today ? s.count : 0) + ' in a row', 110, 476, 22, '#ffffff', { weight: 'bold' });
    kit.text('Bake on consecutive days: +2% production per day, up to +20%', 110, 504, 13, UI.textDim);
    kit.text('Today: +' + Math.round(NS.calendar.streakBonus(s.last === G.today ? s.count : 0) * 100) + '%   -   best streak: ' + (s.best || 0) + ((s.best || 0) === 1 ? ' day' : ' days'), 110, 528, 14, UI.good);
    /* era milestones */
    const run = G.run;
    kit.text('ERA ' + NS.cinematics.ROMAN[run.stage] + ' MILESTONES - ' + STAGES[run.stage].era, 660, 150, 18, UI.gold, { weight: 'bold' });
    kit.text('Each one gives 2 recipe notes. New milestones arrive with every era.', 660, 174, 13, UI.textDim);
    const goals = STAGES[run.stage].goals;
    for (let i = 0; i < goals.length; ++i) {
      const g = NS.progression.goalProgress(run, goals[i]);
      const y = 196 + i * 78;
      kit.panel(660, y, 580, 68, { accent: g.done ? UI.good : UI.accent });
      kit.icon(g.done ? 'trophy' : 'recipe', 692, y + 34, 26, g.done ? UI.good : UI.gold);
      kit.text(NS.progression.goalText(goals[i]), 720, y + 22, 16, '#ffffff', { weight: 'bold' });
      kit.bar(720, y + 40, 400, 12, g.have / g.need, g.done ? UI.good : UI.gold);
      kit.text(g.done ? 'done' : fmt.short(g.have) + ' / ' + fmt.short(g.need), 1220, y + 46, 13, UI.textDim, { align: 'right' });
    }
    kit.text(p.goalsDone + ' milestones completed in total', 660, 450, 14, UI.textDim);
  }

  function season() {
    const p = G.profile;
    const se = G.season;
    const car = CARRIERS[se];
    const have = p.season.tokens[se] || 0;
    kit.text(NS.calendar.SEASON_NAMES[se].toUpperCase(), 640, 168, 34, '#ff9ac8', { align: 'center', weight: 'bold', shadow: true });
    kit.text('During this season, ' + car.names + ' join the golden treats. Each one you catch drops ' + car.token + '.', 640, 204, 15, UI.textDim, { align: 'center' });
    K.blit(ctx, NS.hud.goldenSprite(car.id), 640, 270, 1.2);
    kit.text(fmt.short(have) + ' ' + car.token, 640, 334, 24, '#ffffff', { align: 'center', weight: 'bold' });
    const x0 = 140, w = 1000;
    const last = TRACK[TRACK.length - 1].need;
    kit.bar(x0, 400, w, 16, have / last, '#ff9ac8');
    for (let i = 0; i < TRACK.length; ++i) {
      const st = TRACK[i];
      const x = x0 + st.need / last * w;
      const got = have >= st.need;
      K.circle(ctx, x, 408, 16, got ? '#ff9ac8' : '#3a2a30');
      kit.text(String(st.need), x, 408, 12, got ? '#2a0a1a' : '#ffffff', { align: 'center', weight: 'bold' });
      const label = st.notes ? '+' + st.notes + ' notes' : st.skin ? 'treat skin' : 'click style';
      kit.text(label, x, 444, 13, got ? '#ff9ac8' : UI.textDim, { align: 'center', weight: 'bold' });
    }
    kit.text('Seasons follow your local date: winter, spring, summer, autumn, Halloween week and the year-end countdown.', 640, 510, 14, UI.textMute, { align: 'center' });
    kit.text('Season Blessing in the Sugar Sanctum doubles every token.', 640, 532, 14, UI.textMute, { align: 'center' });
  }

  function stats() {
    const p = G.profile, s = p.stats;
    const rows = [
      ['Baked in total', fmt.long(p.allTime)], ['Baked this run', fmt.long(G.run.baked)], ['Treat clicks', fmt.group(s.clicks)],
      ['Baked by hand', fmt.long(s.handmade)], ['Best per second', fmt.short(s.maxCps)], ['Best combo', fmt.group(s.bestCombo)],
      ['Golden treats caught', fmt.group(s.golden)], ['Best Cookie Storm', fmt.group(s.stormBest)], ['Producers bought', fmt.group(s.built)],
      ['Upgrades bought', fmt.group(s.upgrades)], ['Ascensions', fmt.group(p.ascensions)], ['Sugar crystals', fmt.group(p.crystals) + ' (' + fmt.group(p.crystals - p.crystalsSpent) + ' unspent)'],
      ['Recipe notes earned', fmt.group(p.notesEarned)], ['Tech levels', fmt.group(E.treeLevels(p))], ['Highest era', STAGES[p.stageMax].name],
      ['Quests done', fmt.group(s.quests)], ['Bake-Offs', fmt.group(s.bakeoffs) + ' (' + fmt.group(s.dailies) + ' daily)'], ['Zen Kitchen', fmt.duration(s.zenSeconds)],
      ['Time played', fmt.duration(s.playSeconds)], ['Offline returns', fmt.group(s.offlineReturns)],
    ];
    for (let i = 0; i < rows.length; ++i) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 60 + col * 600, y = 150 + r * 46;
      kit.panel(x, y, 560, 38, { radius: 10, alpha: 0.85 });
      kit.text(rows[i][0], x + 16, y + 19, 15, UI.textDim);
      kit.fitText(rows[i][1], x + 544, y + 19, 300, 16, { align: 'right', weight: 'bold', color: '#ffffff' });
    }
  }

  function bakeoff() {
    const p = G.profile;
    const mod = G.modifier;
    kit.panel(40, 136, 560, 120, { accent: UI.good });
    kit.icon('calendar', 76, 176, 30, UI.good);
    kit.text('Today\'s Daily Bake-Off: ' + mod.name, 110, 172, 18, '#ffffff', { weight: 'bold' });
    kit.text(mod.desc, 110, 198, 14, UI.textDim);
    kit.text('Today\'s best: ' + fmt.short(p.dailyBest[G.today] || 0), 110, 226, 14, UI.good);
    W.button('j-daily', 'Play the Daily', 400, 196, 180, 44, { icon: 'play', accent: UI.good, action: () => NS.modes.startBake(true) });
    kit.text('Bake-Offs give 1 recipe note per digit of the score, +3 for a new best.', 40, 288, 14, UI.textMute);
    W.button('j-bake', 'Start a Bake-Off', 40, 310, 260, 48, { icon: 'clock', action: () => NS.modes.startBake(false) });
    kit.text('HIGH SCORES', 660, 150, 18, UI.gold, { weight: 'bold' });
    const list = p.bakeScores;
    if (!list.length) kit.text('No Bake-Offs yet - three minutes, an empty kitchen, go!', 660, 186, 14, UI.textDim);
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      const y = 172 + i * 44;
      kit.panel(660, y, 580, 38, { radius: 10, accent: i === 0 ? UI.gold : undefined, alpha: 0.9 });
      kit.text('#' + (i + 1), 680, y + 19, 16, i === 0 ? UI.gold : UI.textDim, { weight: 'bold' });
      kit.text(fmt.short(e.score), 740, y + 19, 17, '#ffffff', { weight: 'bold' });
      kit.text((e.mode === 'daily' ? 'Daily - ' + e.mod : 'Bake-Off') + '  -  ' + e.day, 1224, y + 19, 13, UI.textDim, { align: 'right' });
    }
  }

  Object.assign(NS.journal, { TABS, draw });
})();
