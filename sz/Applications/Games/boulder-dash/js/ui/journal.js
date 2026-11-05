/* The miner's journal: today's quests with their rewards and the play streak, every
   achievement with progress, the seasonal event track with its tiers and the calendar of
   seasons, lifetime statistics, and the Arcade, Time Attack and Daily records. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const M = NS.meta;
  const P = NS.progression;
  const kit = NS.kit;
  const scr = NS.screens;
  const CA = NS.creatureArt;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  const TABS = ['Quests', 'Achievements', 'Season', 'Statistics', 'Records'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function quests(x, y) {
    const s = G.save;
    kit.panel(x, y, 700, 300, { accent: '#5fd6ff' });
    kit.text('Today\'s quests', x + 24, y + 30, 22, '#5fd6ff', { weight: 'bold' });
    kit.text('New quests every day at midnight.', x + 24, y + 56, 13, UI.dim);
    const list = s.quests.list;
    for (let k = 0; k < list.length; ++k) {
      const q = list[k], yy = y + 100 + k * 64;
      kit.text(P.questText(q), x + 24, yy, 18, q.done ? UI.good : UI.text, { weight: 'bold' });
      kit.bar(x + 24, yy + 18, 380, 10, q.progress / q.target, q.done ? '#7dff8a' : '#5fd6ff');
      kit.text(Math.floor(q.progress) + ' / ' + q.target, x + 420, yy + 23, 13, UI.dim);
      if (q.claimed) kit.text('Claimed', x + 600, yy + 8, 16, UI.good, { align: 'center', weight: 'bold' });
      else kit.button('Claim ' + q.gold, x + 520, yy - 14, 160, 44, () => {
        const g = P.claimQuest(s, k, G.perks);
        if (g) { scr.toast('+' + g + ' gold', '#ffd54a'); SZ.GameAudio && SZ.GameAudio.play('coin'); NS.save.writeSave(); }
      }, { disabled: !q.done, accent: '#ffd54a', size: 16 });
    }
    kit.panel(x + 720, y, 400, 300, { accent: UI.gold });
    kit.text('Play streak', x + 744, y + 30, 22, UI.gold, { weight: 'bold' });
    kit.text(String(s.streak.count), x + 920, y + 120, 84, '#fff3c0', { align: 'center', weight: 'bold' });
    kit.text(s.streak.count === 1 ? 'day' : 'days in a row', x + 920, y + 176, 18, UI.dim, { align: 'center' });
    kit.wrap('Come back tomorrow: every day in a row adds to the daily bonus (up to a week), and a new Daily Cave and three new quests are waiting.', x + 744, y + 206, 352, 14, 19, UI.dim);
    kit.text('Best streak: ' + (s.stats.bestStreak | 0), x + 744, y + 276, 14, UI.text);
  }

  function achievements(x, y) {
    const s = G.save;
    const cols = 3, w = 370, h = 44;
    let got = 0;
    for (let k = 0; k < M.ACHIEVEMENTS.length; ++k) {
      const a = M.ACHIEVEMENTS[k];
      const done = !!s.ach[a.id];
      if (done) ++got;
      const px = x + (k % cols) * (w + 10), py = y + Math.floor(k / cols) * (h + 6);
      kit.panel(px, py, w, h, { accent: done ? '#ffd54a' : '#5a4a3a', radius: 8, rivets: false, alpha: done ? 1 : 0.8 });
      kit.starIcon(px + 22, py + h / 2, 10, done);
      kit.fitText(a.name, px + 40, py + 14, 160, 15, { weight: 'bold', color: done ? '#fff3c0' : UI.text });
      kit.fitText(a.desc, px + 40, py + 31, 210, 12, { color: UI.dim });
      const val = Math.min(a.target, P.statValue(s, a.stat));
      if (!done) kit.bar(px + 262, py + 18, 96, 8, val / a.target, '#ffb347');
      else kit.goldLabel(px + w - 14, py + h / 2, a.gold, 14, 'right');
    }
    kit.text(got + ' / ' + M.ACHIEVEMENTS.length + ' unlocked', x, y - 16, 15, UI.gold, { weight: 'bold' });
  }

  function season(x, y) {
    const s = G.season;
    if (!s) { kit.text('No event right now.', x, y + 20, 20, UI.dim); return; }
    kit.panel(x, y, 1120, 240, { accent: s.color, glow: true });
    ctx.drawImage(CA.icon(s.id), x + 24, y + 22, 56, 56);
    kit.text(s.name, x + 96, y + 40, 28, s.color, { weight: 'bold' });
    kit.text('Find ' + s.token + 's hidden in every cave of every mode. ' + G.save.season.tokens + ' found so far.', x + 96, y + 70, 15, UI.text);
    const tiers = M.TRACK;
    const maxNeed = tiers[tiers.length - 1].need;
    const bx = x + 40, bw = 1040, by = y + 140;
    kit.bar(bx, by, bw, 14, G.save.season.tokens / maxNeed, s.color);
    for (let k = 0; k < tiers.length; ++k) {
      const t = tiers[k];
      const px = bx + bw * t.need / maxNeed;
      const got = G.save.season.claimed.indexOf(k) >= 0;
      kit.starIcon(px, by + 7, 14, got);
      const rw = t.reward;
      const label = rw.type === 'gold' ? rw.value + ' gold' : rw.type === 'skin' ? 'Skin: ' + (M.SKINS.find((q) => q.id === s.skin) || {}).name : 'Trail: ' + (M.TRAILS.find((q) => q.id === s.trail) || {}).name;
      kit.fitText(label, px, by + 40, 150, 13, { align: 'center', color: got ? UI.good : UI.text });
      kit.text(t.need + '', px, by - 22, 13, UI.dim, { align: 'center' });
    }
    kit.text('The calendar', x, y + 290, 20, UI.accent, { weight: 'bold' });
    for (let k = 0; k < M.SEASONS.length; ++k) {
      const q = M.SEASONS[k];
      const px = x + (k % 3) * 380, py = y + 320 + Math.floor(k / 3) * 70;
      kit.panel(px, py, 360, 60, { accent: q.color, radius: 8, rivets: false, glow: q === s });
      ctx.drawImage(CA.icon(q.id), px + 12, py + 14, 32, 32);
      kit.text(q.name, px + 56, py + 20, 16, q.color, { weight: 'bold' });
      kit.text(MONTHS[q.from[0] - 1] + ' ' + q.from[1] + ' - ' + MONTHS[q.to[0] - 1] + ' ' + q.to[1] + '  -  ' + q.token + 's', px + 56, py + 42, 12, UI.dim);
    }
  }

  function stats(x, y) {
    const s = G.save.stats;
    const rows = [
      ['Gems collected', s.gems], ['Crystals collected', s.bigGems], ['Caves cleared', s.caves], ['Chapters finished', s.chapters],
      ['Story stars', P.starsTotal(G.save) + ' / 120'], ['Bosses defeated', s.bosses], ['Creatures crushed', s.crushes],
      ['Butterflies turned to gems', s.butterflies], ['Dirt dug', s.dug], ['Boulders pushed', s.pushes], ['Dynamite set off', s.bombs],
      ['Brick walls blasted', s.bricks], ['Power-ups picked up', s.powerups], ['Seasonal tokens', s.tokens], ['Deaths', s.deaths],
      ['Runs started', s.runs], ['Best combo', 'x' + (s.bestCombo | 0)], ['Best chain', s.bestChain | 0], ['Best Arcade score', s.bestArcade | 0],
      ['Daily caves played', s.dailies], ['Time in Zen', Math.floor((s.zenTime | 0) / 60) + ' min'], ['Time played', Math.floor((s.playTime | 0) / 60) + ' min'],
      ['Gold in purse', G.save.gold], ['Upgrades owned', Object.keys(G.save.tree).length]
    ];
    for (let k = 0; k < rows.length; ++k) {
      const px = x + (k % 2) * 570, py = y + Math.floor(k / 2) * 38;
      ctx.fillStyle = k % 4 < 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(px, py, 550, 34);
      kit.text(rows[k][0], px + 14, py + 17, 16, UI.dim);
      kit.text(String(rows[k][1] || 0), px + 536, py + 17, 17, UI.text, { align: 'right', weight: 'bold' });
    }
  }

  function table(x, y, title, list, col) {
    kit.panel(x, y, 360, 440, { accent: col });
    kit.text(title, x + 20, y + 28, 20, col, { weight: 'bold' });
    for (let k = 0; k < 10; ++k) {
      const e = list[k];
      const py = y + 66 + k * 36;
      kit.text((k + 1) + '.', x + 24, py, 15, UI.dim);
      kit.text(e ? String(e.score) : '---', x + 200, py, 17, e ? UI.text : UI.faint, { align: 'right', weight: 'bold' });
      if (e) kit.text('cave ' + e.level, x + 330, py, 13, UI.dim, { align: 'right' });
    }
  }

  function records(x, y) {
    const s = G.save;
    table(x, y, 'Arcade', s.high.arcade, '#ff5d5d');
    table(x + 380, y, 'Time Attack', s.high.time, '#d58bff');
    const days = Object.keys(s.high.daily).sort().reverse().slice(0, 10).map((d) => ({ score: s.high.daily[d], level: d.slice(5) }));
    kit.panel(x + 760, y, 360, 440, { accent: '#5fd6ff' });
    kit.text('Daily caves', x + 780, y + 28, 20, '#5fd6ff', { weight: 'bold' });
    for (let k = 0; k < 10; ++k) {
      const e = days[k];
      const py = y + 66 + k * 36;
      kit.text(e ? e.level : '--', x + 784, py, 15, UI.dim);
      kit.text(e ? String(e.score) : '---', x + 1090, py, 17, e ? UI.text : UI.faint, { align: 'right', weight: 'bold' });
    }
  }

  function draw() {
    const v = visible();
    ctx.fillStyle = 'rgba(8,5,3,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Journal', 70, 50, 34, UI.accent, { weight: 'bold' });
    kit.goldLabel(v.x1 - 190, 50, G.save.gold, 24, 'right');
    kit.button('Back', v.x1 - 160, 26, 130, 46, () => scr.back(), { size: 18 });
    for (let k = 0; k < TABS.length; ++k)
      kit.button(TABS[k], 70 + k * 168, 90, 158, 44, () => { G.ui.journalTab = k; }, { selected: G.ui.journalTab === k, size: 16 });
    const x = 80, y = 170;
    switch (G.ui.journalTab) {
      case 0: quests(x, y); break;
      case 1: achievements(x, y + 10); break;
      case 2: season(x, y); break;
      case 3: stats(x, y); break;
      case 4: records(x, y); break;
    }
  }

  Object.assign(NS.journal, { draw, TABS });
})();
