/* The journal: today's quests with the daily streak and the running festival's full reward
   track; every achievement with its progress and reward; lifetime statistics and the high-score
   table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ACHIEVEMENTS, STAT_ROWS, STREAK_GIFTS } = NS.goals;
  const { TIERS } = NS.seasons;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const TABS = [['goals', 'Goals'], ['achievements', 'Achievements'], ['stats', 'Statistics']];

  function fmt(v, kind) {
    if (kind === 'time') {
      const m = Math.floor(v / 60);
      return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm ' + Math.floor(v % 60) + 's';
    }
    return String(Math.round(v));
  }

  function goals() {
    const save = G.save;
    kit.panel(60, 90, 560, 300, { accent: UI.gold });
    kit.text('TODAY\'S QUESTS', 84, 116, 16, UI.gold, { weight: 'bold' });
    kit.text(G.today, 596, 116, 13, UI.textDim, { align: 'right' });
    const q = save.quests.list;
    for (let k = 0; k < q.length; ++k) {
      const y = 160 + k * 66;
      const d = rules.questDef(q[k].id);
      kit.icon(q[k].done ? 'check' : 'star', 96, y, 24, q[k].done ? UI.good : UI.gold);
      kit.text(rules.questText(q[k]), 120, y - 10, 17, q[k].done ? UI.good : '#ffffff', { weight: 'bold' });
      kit.bar(120, y + 10, 360, 10, q[k].progress / q[k].n, q[k].done ? UI.good : UI.gold);
      kit.text(Math.floor(q[k].progress) + ' / ' + q[k].n, 490, y + 15, 13, UI.textDim);
      kit.credits(d ? d.reward : 0, 596, y, 16, 'right');
    }
    kit.text(save.quests.bonus ? 'Bonus collected - see you tomorrow' : 'All three: +' + NS.goals.QUEST_BONUS + ' bonus scales', 84, 366, 13, save.quests.bonus ? UI.good : UI.textDim);

    kit.panel(60, 410, 560, 220, { accent: '#ff9ac0' });
    kit.text('DAILY STREAK', 84, 436, 16, '#ff9ac0', { weight: 'bold' });
    kit.text(save.streak.count + (save.streak.count === 1 ? ' day' : ' days in a row') + '  -  best ' + save.stats.bestStreak, 596, 436, 14, '#ffffff', { align: 'right' });
    for (let k = 0; k < STREAK_GIFTS.length; ++k) {
      const x = 96 + k * 72, y = 500;
      const reached = save.streak.count > k;
      kit.panel(x - 28, y - 32, 60, 76, { accent: reached ? '#ff9ac0' : 'rgba(150,150,150,0.4)', glow: save.streak.count === k + 1, brackets: false, radius: 8 });
      kit.text('Day ' + (k + 1) + (k === STREAK_GIFTS.length - 1 ? '+' : ''), x + 2, y - 16, 11, UI.textDim, { align: 'center' });
      kit.icon('heart', x + 2, y + 6, 22, reached ? '#ff6a9a' : UI.textMute);
      kit.text(String(Math.round(STREAK_GIFTS[k] * (1 + G.stats.streakBonus))), x + 2, y + 32, 13, reached ? UI.gold : UI.textMute, { align: 'center', weight: 'bold' });
    }
    kit.text('Play every day: each day in a row brings a bigger gift', 84, 600, 13, UI.textDim);

    const s = G.season;
    const ev = rules.eventRecord(save, G.eventId);
    kit.panel(650, 90, 570, 540, { accent: s.color, glow: true });
    kit.text(s.name.toUpperCase() + ' FESTIVAL', 674, 118, 18, s.color, { weight: 'bold' });
    kit.text(NS.seasons.daysLeft(new Date()) + ' days left', 1196, 118, 13, UI.textDim, { align: 'right' });
    kit.wrap(s.blurb + ' Festival tokens drift onto the board in every mode. Each tier pays out once per festival; the festival comes back every year.', 674, 140, 520, 14, 20, UI.text);
    kit.text(ev.tokens + ' tokens collected', 674, 216, 17, '#ffffff', { weight: 'bold' });
    for (let k = 0; k < TIERS.length; ++k) {
      const y = 256 + k * 72;
      const got = ev.claimed.indexOf(k) >= 0;
      const rw = rules.eventReward(s.id, k);
      kit.panel(674, y, 522, 62, { accent: got ? s.color : 'rgba(150,150,150,0.4)', glow: got, brackets: false, radius: 8 });
      kit.text(String(TIERS[k].n), 708, y + 31, 22, got ? s.color : UI.textMute, { align: 'center', weight: 'bold' });
      kit.text(rw.kind === 'scales' ? rw.amount + ' scales' : rw.item.name, 744, y + 22, 17, got ? '#ffffff' : UI.text, { weight: 'bold' });
      kit.text(rw.kind === 'scales' ? 'currency' : rw.kind + ' - only from this festival', 744, y + 44, 12, UI.textDim);
      const prev = k ? TIERS[k - 1].n : 0;
      if (!got) kit.bar(1010, y + 28, 150, 8, (ev.tokens - prev) / (TIERS[k].n - prev), s.color);
      else kit.icon('check', 1170, y + 31, 22, UI.good);
    }
  }

  function achievements() {
    const save = G.save;
    const cols = 3, cw = 380, ch = 54;
    for (let k = 0; k < ACHIEVEMENTS.length; ++k) {
      const a = ACHIEVEMENTS[k];
      const x = 60 + (k % cols) * (cw + 10), y = 88 + Math.floor(k / cols) * (ch + 2);
      const done = !!save.achievements[a.id];
      const v = Math.min(a.n, rules.statValue(save, a.stat));
      ctx.fillStyle = done ? 'rgba(255,210,90,0.14)' : 'rgba(255,255,255,0.05)';
      kit.roundRect(x, y, cw, ch - 4, 8);
      ctx.fill();
      kit.icon(a.icon, x + 24, y + 24, 22, done ? UI.gold : UI.textMute);
      kit.fitText(a.name, x + 46, y + 15, 210, 14, { color: done ? UI.gold : '#ffffff', weight: 'bold' });
      kit.fitText(a.desc, x + 46, y + 34, 230, 11, { color: UI.textDim });
      if (done) kit.icon('check', x + cw - 22, y + 24, 20, UI.good);
      else {
        kit.bar(x + 284, y + 16, 80, 6, v / a.n, UI.gold);
        kit.text(fmt(v) + '/' + a.n, x + 324, y + 34, 10, UI.textMute, { align: 'center' });
      }
    }
    let n = 0;
    for (const id in save.achievements) if (save.achievements[id]) ++n;
    kit.text(n + ' / ' + ACHIEVEMENTS.length + ' unlocked', 1220, 44, 16, UI.gold, { align: 'right', weight: 'bold' });
  }

  function stats() {
    const save = G.save;
    kit.panel(60, 90, 640, 540, { accent: UI.accent });
    for (let k = 0; k < STAT_ROWS.length; ++k) {
      const r = STAT_ROWS[k];
      const y = 120 + k * 25;
      kit.text(r[1], 88, y, 14, UI.textDim);
      kit.text(fmt(rules.statValue(save, r[0]), r[2]), 670, y, 14, '#ffffff', { align: 'right', weight: 'bold' });
    }
    kit.panel(730, 90, 490, 540, { accent: UI.gold });
    kit.text('HIGH SCORES', 754, 118, 16, UI.gold, { weight: 'bold' });
    const hs = save.highScores;
    if (!hs.length) kit.text('No runs yet - try Arcade or Time Attack.', 754, 160, 14, UI.textDim);
    for (let k = 0; k < hs.length; ++k) {
      const y = 160 + k * 40;
      kit.text((k + 1) + '.', 766, y, 16, UI.textDim, { align: 'right' });
      kit.text(String(hs[k].score), 860, y, 18, k === 0 ? UI.gold : '#ffffff', { align: 'right', weight: 'bold' });
      kit.fitText(hs[k].mode + (hs[k].detail ? ' - ' + hs[k].detail : ''), 880, y, 320, 14, { color: UI.text });
    }
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = G.back.journal === 'paused' ? 'rgba(2,8,4,0.86)' : 'rgba(2,8,4,0.74)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('JOURNAL', 60, 44, 30, '#ffffff', { weight: 'bold' });
    const tab = G.ui.journalTab;
    for (let k = 0; k < TABS.length; ++k) {
      const id = TABS[k][0];
      W.button('tab-' + id, TABS[k][1], 260 + k * 180, 22, 170, 42, { px: 15, accent: tab === id ? UI.gold : UI.accent, action: () => { G.ui.journalTab = id; } });
      if (tab === id) { ctx.fillStyle = UI.gold; ctx.fillRect(270 + k * 180, 68, 150, 3); }
    }
    if (tab === 'goals') goals();
    else if (tab === 'achievements') achievements();
    else stats();
    W.button('back', G.back.journal === 'paused' ? 'Back to Pause' : 'Back', 60, 650, 240, 46, { action: () => scr.back('journal') });
  }

  Object.assign(NS.journal, {
    draw
  });
})();
