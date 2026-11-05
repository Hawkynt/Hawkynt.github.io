/* Goals: three tabs - today's quests with claim buttons, the weekly featured challenge and the
   play streak; the achievement wall with progress bars; and the seasonal event track with its
   five reward tiers (gems, a bomb skin, a trail, a skin, a big gem prize) to claim. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { ACHIEVEMENTS, EVENT_TIERS } = NS.meta;
  const K = NS.artKit;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  const TABS = [['quests', 'Quests', 'daily'], ['ach', 'Achievements', 'trophy'], ['event', 'Event', 'gift']];

  function paid(gems, what) {
    if (!gems) { NS.fx.sfx('error'); return; }
    NS.fx.sfx('coin');
    NS.fx.sfx('levelup', { pitch: 1.3, volume: 0.5 });
    NS.fx.confetti(640, 400, 40);
    NS.screens.toast(what + '  +' + gems + ' gems', UI.gold, 'gem');
    NS.save.writeSave();
  }

  function draw() {
    const save = G.save;
    kit.dim(G.back.goals === 'paused' ? 0.84 : 0.45);
    kit.text('GOALS', 60, 44, 32, '#ffffff', { weight: 'bold', stroke: 6 });
    kit.text('Daily quests, a weekly challenge, achievements and the seasonal event', 60, 78, 14, UI.textDim);
    kit.gems(save.gems, 1220, 46, 26, 'right');
    for (let i = 0; i < TABS.length; ++i) {
      const tb = TABS[i];
      kit.button('tab' + tb[0], tb[1], 380 + i * 180, 92, 170, 40, { icon: tb[2], px: 15, accent: G.ui.goalsTab === tb[0] ? UI.gold : '#9a8aa0', action: () => { G.ui.goalsTab = tb[0]; } });
      if (G.ui.goalsTab === tb[0]) kit.bar(400 + i * 180, 136, 130, 5, 1, UI.gold);
    }
    if (G.ui.goalsTab === 'ach') achievements(save);
    else if (G.ui.goalsTab === 'event') event(save);
    else quests(save);
    kit.button('back', G.back.goals === 'paused' ? 'Resume' : 'Back', 50, 656, 220, 46, { icon: 'back', accent: '#9a8aa0', action: () => G.back.goals === 'paused' ? scr.setScreen('playing') : scr.back('goals') });
  }

  function quests(save) {
    kit.panel(80, 150, 700, 300, { accent: '#7cf08a' });
    kit.text("TODAY'S QUESTS", 104, 176, 17, '#7cf08a', { weight: 'bold' });
    kit.text('new quests every day at midnight', 760, 176, 12, UI.textDim, { align: 'right' });
    const list = save.quests.list;
    for (let i = 0; i < list.length; ++i) {
      const q = list[i];
      const y = 220 + i * 74;
      const prog = rules.questProgress(save, q);
      kit.text(q.text, 104, y, 18, q.claimed ? UI.textMute : '#ffffff', { weight: 'bold' });
      kit.bar(104, y + 18, 440, 12, prog / q.goal, q.claimed ? '#5a6a5a' : prog >= q.goal ? UI.gold : '#7cf08a');
      kit.text(prog + ' / ' + q.goal, 556, y + 24, 12, UI.textDim);
      if (q.claimed) kit.text('Claimed', 700, y + 10, 14, UI.good, { align: 'center', weight: 'bold' });
      else kit.button('q' + i, '+' + q.gems, 630, y - 10, 136, 42, { icon: 'gem', px: 16, accent: UI.gold, disabled: prog < q.goal, action: () => paid(rules.claimQuest(save, i), 'Quest done') });
    }
    const wk = G.weekly;
    kit.panel(80, 466, 700, 168, { accent: '#c58bff' });
    kit.text('WEEKLY FEATURED CHALLENGE', 104, 492, 17, '#c58bff', { weight: 'bold' });
    const wp = rules.weeklyProgress(save, wk);
    kit.text(wk.text, 104, 530, 18, '#ffffff', { weight: 'bold' });
    kit.bar(104, 550, 440, 12, wp / wk.goal, save.weekly.claimed ? '#5a6a5a' : '#c58bff');
    kit.text(wp + ' / ' + wk.goal, 556, 556, 12, UI.textDim);
    if (save.weekly.claimed) kit.text('Claimed', 700, 540, 14, UI.good, { align: 'center', weight: 'bold' });
    else kit.button('wk', '+' + wk.gems, 630, 520, 136, 42, { icon: 'gem', px: 16, accent: UI.gold, disabled: wp < wk.goal, action: () => paid(rules.claimWeekly(save, wk), 'Weekly challenge') });
    kit.text('A new featured challenge every Monday', 104, 600, 12, UI.textMute);
    /* streak */
    kit.panel(810, 150, 400, 484, { accent: '#ff8a3c' });
    kit.text('PLAY STREAK', 1010, 180, 17, '#ff8a3c', { align: 'center', weight: 'bold' });
    const n = save.streak.count;
    const pulse = 1 + Math.sin(G.time * 4) * 0.05;
    kit.icon('fire', 1010, 270, 110 * pulse, n > 1 ? '#ff8a3c' : '#6a5a5a');
    kit.text(String(n), 1010, 290, 44, '#ffffff', { align: 'center', weight: 'bold', stroke: 6 });
    kit.text(n === 1 ? 'day' : 'days in a row', 1010, 350, 16, UI.text, { align: 'center' });
    kit.text('Best: ' + save.stats.streakBest, 1010, 376, 13, UI.textDim, { align: 'center' });
    for (let d = 0; d < 7; ++d) {
      const on = d < Math.min(7, n);
      ctx.fillStyle = on ? '#ff8a3c' : 'rgba(255,255,255,0.12)';
      K.roundRect(ctx, 852 + d * 46, 410, 38, 38, 8); ctx.fill();
      kit.text(String(d + 1), 871 + d * 46, 430, 14, on ? '#1b1020' : UI.textMute, { align: 'center', weight: 'bold', shadow: false });
    }
    kit.wrap('Play on consecutive days for a daily bonus of 10 gems per streak day (up to 100), paid when you start the game.', 838, 476, 344, 13, 19, UI.textDim);
  }

  function achievements(save) {
    const cols = 4, w = 280, h = 64;
    let done = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) if (save.ach[ACHIEVEMENTS[i].id]) ++done;
    kit.text(done + ' / ' + ACHIEVEMENTS.length + ' earned', 1220, 112, 14, UI.gold, { align: 'right', weight: 'bold' });
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      const x = 60 + (i % cols) * (w + 12), y = 146 + Math.floor(i / cols) * (h + 8);
      const got = !!save.ach[a.id];
      kit.panel(x, y, w, h, { accent: got ? UI.gold : '#5a4a5a', radius: 10, dim: !got });
      kit.icon('trophy', x + 28, y + h / 2, 30, got ? UI.gold : '#5a5060');
      kit.fitText(a.name, x + 52, y + 18, w - 120, 14, { weight: 'bold', color: got ? '#ffffff' : UI.textDim });
      kit.fitText(a.desc, x + 52, y + 36, w - 64, 11, { color: UI.textMute });
      const v = Math.min(a.goal, save.stats[a.stat] || 0);
      if (!got) kit.bar(x + 52, y + 50, w - 120, 5, v / a.goal, '#ffb347');
      kit.gems(a.gems, x + w - 10, y + 18, 12, 'right');
    }
  }

  function event(save) {
    const se = G.season;
    kit.panel(80, 146, 1120, 486, { accent: se.def.color, glow: true });
    kit.icon(se.def.tokenIcon, 140, 200, 64, se.def.color);
    kit.text(se.def.name.toUpperCase(), 190, 186, 28, se.def.color, { weight: 'bold', stroke: 5 });
    kit.text(se.daysLeft + ' days left - collect ' + se.def.token.toLowerCase() + ' in any mode', 190, 218, 15, UI.text);
    kit.text(save.event.tokens + ' collected', 1170, 192, 22, '#ffffff', { align: 'right', weight: 'bold' });
    const max = EVENT_TIERS[EVENT_TIERS.length - 1].need;
    kit.bar(120, 268, 1040, 18, save.event.tokens / max, se.def.color);
    for (let i = 0; i < EVENT_TIERS.length; ++i) {
      const tier = EVENT_TIERS[i];
      const prize = rules.tierPrize(se.id, i);
      const x = 120 + i * 214, y = 310, w = 190, h = 290;
      const got = save.event.claimed.indexOf(i) >= 0;
      const ready = save.event.tokens >= tier.need && !got;
      kit.panel(x, y, w, h, { accent: got ? UI.good : ready ? UI.gold : '#6a5a6a', glow: ready, radius: 14 });
      kit.text(tier.need + ' ' + se.def.token.toLowerCase(), x + w / 2, y + 26, 14, ready ? UI.gold : UI.textDim, { align: 'center', weight: 'bold' });
      const px = x + w / 2, py = y + 120;
      if (prize.kind === 'gems') { kit.icon('gem', px, py - 10, 64, '#4ff0ff'); kit.text('+' + prize.gems, px, py + 44, 22, '#bff8ff', { align: 'center', weight: 'bold' }); }
      else if (prize.kind === 'skin') { const s = NS.actorArt.bomber(prize.item.id, 0, Math.floor(G.time * 5) % 4); ctx.drawImage(s, px - 40, py - 70, 80, 95); }
      else if (prize.kind === 'bomb') { const s = NS.itemArt.bomb(prize.item.id, false); ctx.drawImage(s, px - 40, py - 50, 80, 86); }
      else { kit.icon('star', px, py - 10, 56, prize.item.color); }
      if (prize.item) kit.fitText(prize.item.name, px, y + 196, w - 20, 15, { align: 'center', weight: 'bold', color: '#ffffff' });
      kit.text(prize.kind === 'gems' ? 'gem prize' : prize.kind, px, y + 216, 11, UI.textMute, { align: 'center' });
      if (got) kit.text('CLAIMED', px, y + h - 34, 16, UI.good, { align: 'center', weight: 'bold' });
      else kit.button('tier' + i, ready ? 'Claim!' : 'Locked', x + 20, y + h - 58, w - 40, 42, { px: 16, accent: UI.gold, disabled: !ready, action: () => claim(save, i) });
    }
  }

  function claim(save, i) {
    const prize = rules.claimTier(save, G.season.id, i);
    if (!prize) { NS.fx.sfx('error'); return; }
    NS.fx.confetti(640, 420, 60);
    NS.fx.sfx('win');
    NS.screens.toast(prize.kind === 'gems' ? 'Event reward  +' + prize.gems + ' gems' : 'Event reward: ' + prize.item.name, G.season.def.color, 'gift');
    NS.save.writeSave();
  }

  Object.assign(NS.goals, {
    draw, claim
  });
})();
