/* The title screen over the demo runner: the logo with a speed shimmer, the mode buttons
   (Continue when a run is saved, Story, Arcade, the weekly Featured run, Zen, the Daily Run and
   Boss Rush once two guardians are free), the side buttons (tech tree, collection, journal,
   help), the profile strip (level and XP, coins, gems, streak) and the festival and daily-quest
   cards. Draws and registers hit areas; owns nothing. */
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
  const { TIERS } = NS.seasons;
  const { QUEST_BY_ID } = NS.goals;
  const { ctx } = NS.view;

  function rushOpen() {
    return Object.keys(G.save.bosses).length >= 2;
  }

  function modeButtons(x, y) {
    const saved = NS.save.peekRun();
    const list = [];
    if (saved) list.push(['continue', 'Continue', (NS.hud.MODE_NAMES[saved.mode] || '') + ' - ' + saved.m + ' m', 'play', () => scr.continueRun(), UI.good]);
    list.push(['story', 'Story', 'Five worlds, five guardians', 'map', () => scr.open('map', 'title'), UI.gold]);
    list.push(['arcade', 'Arcade', 'Endless - best ' + (G.save.stats.arcadeBest || 0) + ' m', 'run', () => scr.startMode('arcade'), UI.accent]);
    list.push(['weekly', 'Featured: ' + (G.weekly ? G.weekly.name : ''), G.weekly ? G.weekly.desc : '', 'star', () => scr.startMode('weekly'), UI.warn]);
    list.push(['zen', 'Zen', 'No crashes, just flow', 'leaf', () => scr.startMode('zen'), UI.good]);
    list.push(['daily', 'Daily Run', G.save.daily.key === G.daily.key ? 'Today\'s best ' + G.save.daily.best : 'A new course today', 'calendar', () => scr.startMode('daily'), UI.hot]);
    const rush = rushOpen();
    list.push(['rush', 'Boss Rush', rush ? 'All five guardians back to back' : 'Free two guardians to unlock', 'skull', () => scr.startMode('rush'), UI.violet, !rush]);
    const h = list.length > 6 ? 50 : 56, gap = 8;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      W.button(b[0], b[1], x, y + i * (h + gap), 330, h, { action: b[4], sub: b[2], icon: b[3], accent: b[5], disabled: b[6], px: 20 });
    }
  }

  function sideButtons(x, y) {
    const items = [['tree', 'Tech Tree', 'bolt', () => scr.open('tree', 'title')], ['wardrobe', 'Collection', 'shirt', () => scr.open('wardrobe', 'title')],
      ['journal', 'Journal', 'book', () => scr.open('journal', 'title')], ['help', 'How to Play', 'help', () => scr.open('help', 'title')]];
    for (let i = 0; i < items.length; ++i)
      W.button(items[i][0], items[i][1], x, y + i * 54, 210, 46, { action: items[i][3], icon: items[i][2], px: 17 });
  }

  function profile(x, y, w) {
    const s = G.save;
    kit.panel(x, y, w, 64, { radius: 12, brackets: false, alpha: 0.9 });
    kit.text('Level ' + s.level, x + 18, y + 22, 20, UI.violet, { weight: 'bold' });
    kit.bar(x + 18, y + 40, 150, 8, s.xp / rules.xpNeeded(s.level), UI.violet);
    kit.amount('coins', s.coins, x + 196, y + 32, 22);
    kit.amount('gems', s.gems, x + 330, y + 32, 22);
    kit.icon('heart', x + w - 104, y + 32, 22, '#ff9ac0');
    kit.text(s.streak.count + ' day streak', x + w - 88, y + 32, 15, '#ff9ac0', { weight: 'bold' });
  }

  function festival(x, y, w) {
    const sea = G.season;
    if (!sea) return;
    const s = G.save.season;
    kit.panel(x, y, w, 96, { radius: 12, accent: sea.color, alpha: 0.9 });
    K.blit(ctx, NS.propArt.token(sea.token), x + 30, y + 30, 1);
    kit.text(sea.name, x + 56, y + 22, 20, sea.color, { weight: 'bold' });
    kit.fitText(sea.blurb + '  ' + NS.seasons.daysLeft() + ' days left', x + 56, y + 44, w - 72, 13, { color: UI.textDim });
    const max = TIERS[TIERS.length - 1].n;
    kit.bar(x + 18, y + 66, w - 36, 10, s.tokens / max, sea.color);
    for (let i = 0; i < TIERS.length; ++i) {
      const tx = x + 18 + (w - 36) * TIERS[i].n / max;
      kit.icon(s.tokens >= TIERS[i].n ? 'check' : 'gift', tx, y + 84, 14, s.tokens >= TIERS[i].n ? UI.good : UI.textDim);
    }
  }

  function quests(x, y, w) {
    const qs = G.save.day.quests || [];
    kit.panel(x, y, w, 30 + qs.length * 28, { radius: 12, alpha: 0.9, brackets: false });
    kit.text('Today\'s quests', x + 16, y + 16, 15, UI.accent, { weight: 'bold' });
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i], def = QUEST_BY_ID[q.id];
      const pr = rules.questProgress(G.save, q);
      const yy = y + 42 + i * 28;
      kit.icon(q.claimed ? 'check' : 'star', x + 22, yy, 16, q.claimed ? UI.good : UI.gold);
      kit.fitText(def.text(q.n), x + 38, yy, w - 120, 14, { color: q.claimed ? UI.textMute : UI.text });
      kit.text(pr + '/' + q.n, x + w - 16, yy, 13, UI.textDim, { align: 'right' });
    }
  }

  function draw() {
    const v = NS.view.visible();
    const t = G.time;
    /* soft darkening on the menu side */
    const gr = ctx.createLinearGradient(v.x0, 0, v.x0 + 520, 0);
    gr.addColorStop(0, 'rgba(8,6,20,0.72)');
    gr.addColorStop(1, 'rgba(8,6,20,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, 520, v.h);
    const logo = kit.logo();
    const k = 0.62 + Math.sin(t * 1.5) * 0.008;
    ctx.drawImage(logo.canvas, 40, 10, logo.w * k, logo.h * k);
    kit.text('a »SynthelicZ« game', 40 + logo.w * k * 0.62, 10 + logo.h * k - 2, 16, '#e8ecff', { align: 'center', weight: 'bold' });
    modeButtons(46, 168);
    sideButtons(v.x1 - 236, 168);
    profile(v.x1 - 520, v.y0 + 16, 494);
    festival(v.x1 - 520, Math.max(v.y1 - 124, 596) - 10, 270);
    quests(v.x1 - 236, Math.max(v.y1 - 124, 596) - 28, 210);
  }

  Object.assign(NS.title, {
    draw, rushOpen
  });
})();
