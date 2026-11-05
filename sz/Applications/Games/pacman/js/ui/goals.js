/* The goals screen: today's three quests with progress, rewards and the time until new ones, the
   daily streak with its week of flames; all achievements as trophy cards; and the records page
   with lifetime statistics and the high-score table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ACHIEVEMENTS, STATS, STREAK_BASE, STREAK_STEP, STREAK_CAP } = NS.goals;
  const { MODES } = NS.items;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const R = NS.rules;
  const { ctx } = NS.view;

  const TABS = [{ id: 'quests', name: 'Quests', icon: 'flag' }, { id: 'trophies', name: 'Achievements', icon: 'trophy' }, { id: 'records', name: 'Records', icon: 'star' }];

  function quests() {
    const p = G.profile;
    for (let i = 0; i < p.quests.list.length; ++i) {
      const q = p.quests.list[i];
      const x = 40, y = 160 + i * 112, w = 760, h = 100;
      kit.panel(x, y, w, h, { accent: q.done ? UI.good : UI.accent2, glow: q.done });
      kit.icon(q.done ? 'check' : 'flag', x + 46, y + 50, 36, q.done ? UI.good : UI.accent2);
      kit.text(R.questText(q), x + 92, y + 34, 22, '#ffffff', { weight: 'bold' });
      const prog = R.questProgress(p, q);
      kit.bar(x + 92, y + 58, w - 290, 12, prog, q.done ? UI.good : UI.accent2);
      kit.text(Math.floor(prog * 100) + '%', x + w - 186, y + 64, 14, UI.textDim);
      kit.shards(R.questReward(q), x + w - 20, y + 50, 22, 'right');
    }
    const now = G.date;
    const left = 24 - now.getHours() - (now.getMinutes() > 0 ? 1 : 0);
    kit.text('New quests every day - next set in about ' + Math.max(1, left) + ' h', 40, 512, 14, UI.textDim);
    /* streak */
    const x = 830, y = 160, w = 410, h = 324;
    kit.panel(x, y, w, h, { accent: '#ff9a2a' });
    kit.text('DAILY STREAK', x + 22, y + 28, 13, UI.textMute, { weight: 'bold' });
    kit.text(p.streak.count + (p.streak.count === 1 ? ' day' : ' days'), x + 22, y + 66, 36, '#ff9a2a', { weight: 'bold' });
    kit.text('Longest: ' + (p.stats.bestStreak || 0), x + w - 22, y + 66, 14, UI.textDim, { align: 'right' });
    for (let d = 0; d < STREAK_CAP; ++d) {
      const on = d < Math.min(p.streak.count, STREAK_CAP);
      const cx = x + 40 + d * 55, cy = y + 140;
      kit.icon('flame', cx, cy, 34, on ? '#ff9a2a' : '#3a3a50');
      kit.text('+' + (STREAK_BASE + STREAK_STEP * d), cx, cy + 32, 12, on ? UI.shard : UI.textMute, { align: 'center', weight: 'bold' });
    }
    kit.wrap('Play on consecutive days for a bigger shard bonus with your first run each day. Miss a day and the flame starts over.', x + 22, y + 210, w - 44, 14, 20, UI.textDim);
  }

  function trophies() {
    const p = G.profile;
    const cols = 4, cw = 293, ch = 62;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      const x = 40 + (i % cols) * (cw + 9), y = 150 + Math.floor(i / cols) * (ch + 6);
      const got = !!p.achievements[a.id];
      kit.panel(x, y, cw, ch, { accent: got ? UI.gold : '#3a3a5a', radius: 10, alpha: got ? 1 : 0.8 });
      kit.icon('trophy', x + 28, y + ch / 2, 28, got ? UI.gold : '#3a3a5a');
      kit.fitText(a.name, x + 52, y + 20, cw - 120, 15, { weight: 'bold', color: got ? '#ffffff' : UI.textDim });
      kit.fitText(a.desc, x + 52, y + 42, cw - 64, 12, { color: got ? UI.text : UI.textMute });
      kit.text('+' + a.reward, x + cw - 12, y + 20, 12, got ? UI.good : UI.shard, { align: 'right', weight: 'bold' });
      if (a.stat && !got) {
        const v = p.stats[a.stat] || 0;
        kit.bar(x + 52, y + ch - 8, cw - 64, 3, v / a.n, UI.accent2);
      }
    }
    kit.text(Object.keys(p.achievements).length + ' / ' + ACHIEVEMENTS.length + ' unlocked', 1240, 106, 14, UI.textDim, { align: 'right' });
  }

  function records() {
    const p = G.profile;
    const x = 40, y = 150, w = 560;
    kit.panel(x, y, w, 490, { accent: UI.accent2 });
    kit.text('LIFETIME', x + 22, y + 24, 13, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < STATS.length; ++i) {
      const s = STATS[i];
      const v = p.stats[s.id] || 0;
      const col = i % 2, row = Math.floor(i / 2);
      const sx = x + 22 + col * 270, sy = y + 56 + row * 46;
      kit.text(s.name, sx, sy, 12, UI.textDim);
      kit.text(s.time ? kit.time(v) : (s.prefix || '') + kit.group(s.prefix ? Math.max(1, v) : v), sx, sy + 18, 18, '#ffffff', { weight: 'bold' });
    }
    const hx = 630, hw = 610;
    kit.panel(hx, y, hw, 490, { accent: UI.accent });
    kit.text('HIGH SCORES', hx + 22, y + 24, 13, UI.textMute, { weight: 'bold' });
    const hs = p.highScores;
    if (!hs.length) kit.text('No scores yet - play Arcade, Daily or Boss Rush', hx + 22, y + 70, 15, UI.textDim);
    for (let i = 0; i < hs.length; ++i) {
      const e = hs[i];
      const ey = y + 62 + i * 36;
      const m = MODES.find(q => q.id === e.mode);
      kit.text(String(i + 1), hx + 36, ey, 18, i < 3 ? UI.gold : UI.textDim, { align: 'center', weight: 'bold' });
      kit.text(kit.group(e.score), hx + 200, ey, 20, '#ffffff', { align: 'right', weight: 'bold' });
      kit.chip(m ? m.name : 'Classic', hx + 220, ey, m ? m.color : '#9aa6cc', 12);
      kit.fitText(e.detail, hx + 340, ey, hw - 360, 13, { color: UI.textDim });
    }
    const bests = ['arcade', 'zen', 'daily', 'bossrush'];
    for (let i = 0; i < bests.length; ++i)
      kit.text(MODES.find(q => q.id === bests[i]).name + ' best: ' + kit.group(p.best[bests[i]] || 0), hx + 22 + (i % 2) * 290, y + 450 + Math.floor(i / 2) * 22, 13, UI.textDim);
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,2,14,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('GOALS', 40, 44, 32, '#ffffff', { weight: 'bold' });
    kit.shards(G.profile.shards, 1240, 46, 26, 'right');
    W.tabs(TABS, G.ui.goalsTab, 40, 84, 640, 44, (id) => { G.ui.goalsTab = id; });
    switch (G.ui.goalsTab) {
      case 'trophies': trophies(); break;
      case 'records': records(); break;
      default: quests();
    }
    W.button('back', 'Back', 40, 654, 240, 46, { icon: 'back', action: () => scr.back('goalsReturn') });
  }

  Object.assign(NS.goalsScreen, {
    draw
  });
})();
