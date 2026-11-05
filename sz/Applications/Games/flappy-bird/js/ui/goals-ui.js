;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Goals & Stats: four tabs - Quests (the daily three, the weekly challenge, the streak),
     Achievements (paged grid), Stats (lifetime numbers, bests and the Arcade top 10) and
     Season (the event's reward track). Owns G.goalsTab and G.goalsPage. */

  const { CANVAS_W, ACHIEVEMENTS, STATS } = NS.C;
  const { ctx, ui, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Menu = NS.menu;
  const Shapes = NS.shapes;
  const Goals = NS.goals;
  const S = SZ.FlappySeasons;

  const TABS = ['Quests', 'Achievements', 'Stats', 'Season'];
  const PER_PAGE = 18;

  function setTab(i) {
    G.goalsTab = (i + TABS.length) % TABS.length;
    G.goalsPage = 0;
    G.menuCursor = 0;
    sfx('click', { volume: 0.4 });
  }

  function pageCount() {
    return Math.ceil(ACHIEVEMENTS.length / PER_PAGE);
  }

  function drawQuest(x, y, w, text, prog, need, reward, done) {
    ui.drawPanel(x, y, w, 70, { radius: 8, noStuds: true, accent: done ? ui.UI.good : ui.UI.accent });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(text, x + 20, y + 24, w - 180, 18, { weight: 'bold', color: done ? ui.UI.textDim : ui.UI.text });
    ui.drawMeter(x + 20, y + 46, w - 180, 10, prog / need, done ? ui.UI.good : ui.UI.accent);
    ctx.textAlign = 'right';
    ui.fitText(done ? 'Done!' : Math.floor(prog) + ' / ' + need, x + w - 20, y + 24, 140, 16, { weight: 'bold', color: done ? ui.UI.good : ui.UI.textDim });
    ui.fitText('+' + reward + ' coins', x + w - 20, y + 48, 140, 14, { color: ui.UI.gold });
  }

  function drawQuests() {
    const quests = Goals.questList();
    const x = 140, w = 1000;
    let y = 160;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('Daily quests - new ones every day', x, y, w, 20, { weight: 'bold', color: ui.UI.gold, outline: 'rgba(0,0,0,0.5)' });
    y += 22;
    for (let i = 0; i < quests.length; ++i) {
      const q = quests[i];
      const pay = Math.round(q.reward * (1 + 0.25 * Prog.treeLevel('f_quest')));
      drawQuest(x, y, w, q.text, Goals.questProgress(q), q.need, pay, G.save.daily.claimed[i]);
      y += 80;
    }
    ui.drawPanel(x, y + 6, w, 30, { radius: 8, noStuds: true, flat: true });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(G.save.daily.bonus ? 'All three done - bonus paid!' : 'Finish all three for a bonus of 200 coins.', x + 20, y + 22, w - 40, 15, { color: G.save.daily.bonus ? ui.UI.good : ui.UI.textDim });
    y += 48;
    const wk = Goals.weekly();
    ui.fitText('Featured this week', x, y, w, 20, { weight: 'bold', color: '#5ab8ff', outline: 'rgba(0,0,0,0.5)' });
    y += 22;
    drawQuest(x, y, w, wk.text, Math.min(wk.need, G.save.weekly.progress), wk.need, wk.reward, G.save.weekly.claimed);
    y += 82;
    const sk = G.save.streak;
    const next = Math.round(Math.min(7, sk.count + 1) * 40 * (1 + 0.5 * Prog.treeLevel('f_streak')));
    ui.drawPanel(x, y, w, 70, { radius: 8, noStuds: true, accent: '#ff9a3a' });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(sk.count ? 'Day streak: ' + sk.count + '  (best ' + sk.best + ')  -  come back tomorrow for +' + next + ' coins' : 'Fly today to start a day streak - every day in a row pays more.', x + 20, y + 24, w - 40, 17, { weight: 'bold', color: '#ff9a3a' });
    ui.fitText('Today\'s Daily Challenge twist: ' + G.twist.name + ' - ' + G.twist.desc, x + 20, y + 50, w - 40, 15, { color: ui.UI.textDim });
  }

  function drawAchievements() {
    const page = Math.min(G.goalsPage, pageCount() - 1);
    const start = page * PER_PAGE;
    const cw = 400, ch = 68;
    for (let i = start; i < Math.min(ACHIEVEMENTS.length, start + PER_PAGE); ++i) {
      const a = ACHIEVEMENTS[i];
      const k = i - start;
      const x = 34 + (k % 3) * (cw + 8), y = 156 + Math.floor(k / 3) * (ch + 8);
      const done = !!G.save.achievements[a.id];
      ctx.save();
      if (!done)
        ctx.globalAlpha *= 0.7;
      ui.drawPanel(x, y, cw, ch, { radius: 8, noStuds: true, accent: done ? ui.UI.gold : '#3a4058' });
      Shapes.drawStarShape(x + 34, y + ch / 2, 20, done);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(a.name, x + 64, y + 20, cw - 150, 16, { weight: 'bold', color: done ? ui.UI.gold : ui.UI.text });
      ui.fitText(a.desc, x + 64, y + 42, cw - 80, 13, { color: ui.UI.textDim });
      const v = Math.min(a.n, a.v(G.save));
      if (!done && a.n > 1)
        ui.drawMeter(x + 64, y + 56, cw - 150, 6, v / a.n, ui.UI.accent);
      ctx.textAlign = 'right';
      ui.fitText('+' + a.coins, x + cw - 14, y + 20, 80, 14, { weight: 'bold', color: ui.UI.gold });
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ui.fitText(Goals.achievementCount() + ' / ' + ACHIEVEMENTS.length + ' earned  -  page ' + (page + 1) + ' / ' + pageCount(), 640, 656, 600, 15, { color: ui.UI.textDim });
    Menu.drawButton('g-prev', '<', 440, 636, 60, 40, { action: () => { G.goalsPage = (page + pageCount() - 1) % pageCount(); } });
    Menu.drawButton('g-next', '>', 780, 636, 60, 40, { action: () => { G.goalsPage = (page + 1) % pageCount(); } });
  }

  function drawStats() {
    ui.drawPanel(40, 156, 560, 500, { title: 'Lifetime', titlePx: 18 });
    for (let i = 0; i < STATS.length; ++i) {
      const y = 206 + i * 28;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(STATS[i].label, 64, y, 320, 16, { color: ui.UI.textDim });
      ctx.textAlign = 'right';
      const v = STATS[i].v(G.save);
      ui.fitText(typeof v === 'number' ? Math.floor(v).toLocaleString('en-US') : String(v), 576, y, 200, 16, { weight: 'bold', color: ui.UI.text });
    }
    ui.drawPanel(620, 156, 620, 200, { title: 'Bests', titlePx: 18 });
    const b = G.save.best;
    const rows = [['Classic', b.classic + ' pipes'], ['Arcade', b.arcade.toLocaleString('en-US') + ' pts'], ['Time Attack', b.time + ' pipes'],
      ['Zen', b.zen + ' pipes'], ['Daily (today)', String(Prog.modeBest('daily'))], ['Boss Rush', b.bossrush ? b.bossrush.toFixed(1) + ' s' : '-']];
    for (let i = 0; i < rows.length; ++i) {
      const x = 644 + (i % 2) * 300, y = 206 + Math.floor(i / 2) * 44;
      ctx.textAlign = 'left';
      ui.fitText(rows[i][0], x, y, 140, 15, { color: ui.UI.textDim });
      ui.fitText(rows[i][1], x + 140, y, 140, 17, { weight: 'bold', color: ui.UI.gold });
    }
    ui.drawPanel(620, 370, 620, 286, { title: 'Arcade top 10', titlePx: 18 });
    const list = G.save.arcadeScores;
    if (!list.length) {
      ctx.textAlign = 'center';
      ui.fitText('No Arcade runs yet.', 930, 500, 500, 16, { color: ui.UI.textDim });
    }
    for (let i = 0; i < list.length; ++i) {
      const x = 644 + (i >= 5 ? 300 : 0), y = 418 + (i % 5) * 46;
      ctx.textAlign = 'left';
      ui.fitText((i + 1) + '.', x, y, 30, 16, { weight: 'bold', color: i === 0 ? ui.UI.gold : ui.UI.textDim });
      ui.fitText(list[i].score.toLocaleString('en-US'), x + 34, y - 7, 140, 17, { weight: 'bold', color: ui.UI.text });
      ui.fitText(Prog.birdName(list[i].bird) + '  ' + list[i].date, x + 34, y + 12, 240, 12, { color: ui.UI.textMute });
    }
  }

  function drawSeason() {
    const ev = G.season.event;
    const s = G.save.season;
    ui.drawPanel(80, 156, 1120, 150, { title: ev.name + '  -  ' + G.season.daysLeft + ' days left', titlePx: 20, accent: ev.accent });
    ctx.save();
    ctx.translate(140, 240);
    ctx.scale(1.6, 1.6);
    SZ.FlappySeasonArt.drawToken(ctx, ev.id, 0, 0, G.globalTime);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(s.tokens + ' ' + ev.token + 's collected', 200, 220, 600, 24, { weight: 'bold', color: ev.tokenColor });
    ui.drawTextBlock(ev.blurb + ' Tokens float between the pipes in every mode except Time Attack and Boss Rush.', 200, 240, 960, 50, 16, { color: ui.UI.textDim });

    // the track: evenly spaced tiers, the bar fills between them
    ui.drawPanel(80, 318, 1120, 330, { radius: 10 });
    const x0 = 170, x1 = 1110, ty = 450;
    const n = S.TRACK.length;
    const tierX = (i) => x0 + (x1 - x0) * i / (n - 1);
    const tierNow = S.trackTier(s.tokens);
    let fill = tierNow >= n ? 1 : 0;
    if (tierNow < n) {
      const prev = tierNow > 0 ? S.TRACK[tierNow - 1].need : 0;
      fill = (Math.max(0, tierNow - 1) + (tierNow === 0 ? s.tokens / S.TRACK[0].need : (s.tokens - prev) / (S.TRACK[tierNow].need - prev))) / (n - 1);
    }
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(x0, ty);
    ctx.lineTo(x1, ty);
    ctx.stroke();
    ctx.strokeStyle = ev.accent;
    ctx.beginPath();
    ctx.moveTo(x0, ty);
    ctx.lineTo(x0 + (x1 - x0) * Math.max(0, Math.min(1, fill)), ty);
    ctx.stroke();
    for (let i = 0; i < S.TRACK.length; ++i) {
      const tr = S.TRACK[i];
      const x = tierX(i);
      const got = s.tokens >= tr.need;
      ctx.beginPath();
      ctx.arc(x, ty, 22, 0, Math.PI * 2);
      ctx.fillStyle = got ? ev.accent : '#1a2238';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.textAlign = 'center';
      ui.fitText(String(tr.need), x, ty, 40, 14, { weight: 'bold', color: got ? '#1a1a2a' : '#ffffff' });
      const label = tr.reward ? Prog.itemName(tr.reward === 'bird' ? 'birds' : tr.reward + 's', ev.rewards[tr.reward]) : '+' + tr.coins;
      const kind = tr.reward ? (tr.reward === 'bird' ? 'Bird' : tr.reward === 'hat' ? 'Hat' : 'Trail') : 'Coins';
      const ly = ty + 58;
      ui.fitText(kind, x, ly - 10, 150, 12, { color: ui.UI.textDim });
      ui.fitText(label + (tr.badge ? ' + badge' : ''), x, ly + 8, 150, 15, { weight: 'bold', color: tr.reward ? ev.accent : ui.UI.gold });
      if (tr.reward === 'bird')
        SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: ty - 70, birdId: ev.rewards.bird, frame: G.globalTime * 8, scale: 1.4, alpha: got ? 1 : 0.7 });
      else if (tr.reward === 'hat') {
        SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: ty - 66, birdId: Prog.currentBird(), frame: 1, scale: 1.2, alpha: got ? 1 : 0.7 });
        SZ.FlappyCosmeticArt.drawHat(ctx, { x: x, y: ty - 66, hatId: ev.rewards.hat, scale: 1.2, alpha: got ? 1 : 0.7 });
      } else if (tr.reward === 'trail') {
        const img = SZ.FlappyParticles.sprite('leaf', ev.accent);
        for (let k = 0; k < 3; ++k)
          ctx.drawImage(img, x - 30 + k * 18, ty - 80 + Math.sin(G.globalTime * 3 + k) * 4, 20, 20);
      } else {
        NS.view.sceneFor('meadow').drawCoin(ctx, x, ty - 64, G.globalTime);
      }
    }
    ctx.textAlign = 'center';
    ui.fitText('Every event has its own track. Rewards stay yours forever; the track starts fresh next season.', 640, 566, 1060, 15, { color: ui.UI.textDim });
    if (G.save.badges.length)
      ui.fitText('Season Champion badges: ' + G.save.badges.join(', '), 640, 594, 1060, 15, { weight: 'bold', color: ui.UI.gold });
    const others = S.EVENT_ORDER.filter(id => id !== ev.id).map(id => S.EVENTS[id].name);
    ui.fitText('Coming up through the year: ' + others.join(' - '), 640, 622, 1060, 14, { color: ui.UI.textDim });
  }

  function drawGoalsScreen() {
    ui.drawHeadline('Goals & Stats', 640, 52, 600, 44, ui.UI.gold);
    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);
    for (let i = 0; i < TABS.length; ++i) {
      const x = 190 + i * 230, y = 96, w = 218, h = 40;
      const active = i === G.goalsTab;
      const idx = Menu.registerHit('gt' + i, x, y, w, h, () => setTab(i), false);
      const hot = Menu.isHot(idx, x, y, w, h);
      ui.roundRectPath(x, y, w, h, 8);
      ctx.fillStyle = active ? 'rgba(255,215,90,0.35)' : hot ? 'rgba(255,255,255,0.14)' : 'rgba(10,14,30,0.7)';
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = ui.UI.gold;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(TABS[i], x + w / 2, y + h / 2 + 1, w - 16, 18, { weight: 'bold', color: active ? '#ffffff' : ui.UI.text });
    }
    if (G.goalsTab === 0)
      drawQuests();
    else if (G.goalsTab === 1)
      drawAchievements();
    else if (G.goalsTab === 2)
      drawStats();
    else
      drawSeason();
    Menu.drawBackButton();
    ui.drawKeyHints([{ key: 'Tab', label: 'Tab' }, { key: '←→', label: 'Page' }, { key: 'Esc', label: 'Back' }], 640, 700, 600, 1);
  }

  Object.assign(NS.goalsUi, { TABS, setTab, pageCount, drawGoalsScreen });
})();
