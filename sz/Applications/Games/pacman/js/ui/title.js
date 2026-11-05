/* The title screen over the attract-mode demo: the bouncing logo, Continue (the autosaved run)
   and the modes (Story, Arcade, Zen, Daily Maze, Boss Rush), shortcuts to the tech tree,
   wardrobe, goals, the season event and help; the player card (shards, streak, quests) and the
   season, daily and weekly features; a confirm box before a new run replaces a saved one. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { MODES, MODIFIER_BY_ID } = NS.items;
  const { WORLDS } = NS.worlds;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const R = NS.rules;
  const { ctx } = NS.view;

  function startMode(id) {
    const go = () => (id === 'story' ? scr.story() : scr.launch(id));
    if (G.savedRun && id !== 'story') {
      G.ui.confirm = { text: 'Start a new ' + MODES.find(m => m.id === id).name + ' run? Your saved run will be replaced.', yes: go };
      return;
    }
    go();
  }

  function savedLine(s) {
    const mode = MODES.find(m => m.id === s.mode);
    const where = s.mode === 'story' ? WORLDS[s.world].short + ' ' + (s.world + 1) + '-' + (s.stage + 1) : 'Maze ' + (s.n + 1);
    return (mode ? mode.name : s.mode) + ' - ' + where + ' - ' + kit.group(s.score) + ' pts';
  }

  function menu() {
    const x = 40, w = 300;
    let y = 196;
    const p = G.profile;
    kit.panel(x - 14, y - 22, w + 28, 506, { accent: UI.accent2, alpha: 0.9 });
    if (G.savedRun) {
      W.button('continue', 'Continue', x, y, w, 58, { icon: 'play', accent: UI.good, sub: savedLine(G.savedRun), action: () => scr.continueRun() });
      y += 68;
    }
    for (let i = 0; i < MODES.length; ++i) {
      const m = MODES[i];
      const locked = m.unlock && p.story.reached < m.unlock;
      W.button('mode:' + m.id, m.name, x, y, w, G.savedRun ? 50 : 56, {
        icon: m.icon, accent: m.color, sub: locked ? 'Clear world ' + m.unlock + ' of the story' : m.sub, disabled: locked,
        action: () => startMode(m.id),
      });
      y += G.savedRun ? 58 : 64;
    }
    y += 6;
    const small = [
      { id: 'tree', label: 'Tech Tree', icon: 'tree', act: () => scr.openTree('title') },
      { id: 'wardrobe', label: 'Wardrobe', icon: 'shirt', act: () => scr.openWardrobe('title') },
      { id: 'goals', label: 'Goals', icon: 'trophy', act: () => scr.openGoals('title') },
      { id: 'season', label: 'Event', icon: 'gift', act: () => scr.openSeason('title') },
    ];
    for (let i = 0; i < small.length; ++i) {
      const s = small[i];
      W.button(s.id, s.label, x + (i % 2) * (w / 2 + 3), y + Math.floor(i / 2) * 46, w / 2 - 3, 40, { icon: s.icon, px: 15, action: s.act });
    }
    W.button('help', 'How to Play', x, y + 92, w, 34, { px: 14, action: () => scr.openHelp('title') });
  }

  function card() {
    const p = G.profile;
    const x = 940, w = 300;
    let y = 174;
    kit.panel(x, y, w, 250, { accent: UI.accent, alpha: 0.92 });
    kit.text('PLAYER', x + 18, y + 22, 12, UI.textMute, { weight: 'bold' });
    kit.shards(p.shards, x + 18, y + 50, 24);
    kit.text('Day streak: ' + p.streak.count + (p.streak.count >= 2 ? '  (+' + (NS.goals.STREAK_BASE + NS.goals.STREAK_STEP * (Math.min(p.streak.count, NS.goals.STREAK_CAP) - 1)) + '/day)' : ''), x + 18, y + 82, 14, UI.accent2);
    const tp = R.treeProgress(p);
    kit.text('Tech ' + tp.have + '/' + tp.all + '   Trophies ' + Object.keys(p.achievements).length + '/' + NS.goals.ACHIEVEMENTS.length, x + 18, y + 106, 13, UI.textDim);
    kit.text("TODAY'S QUESTS", x + 18, y + 136, 12, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < p.quests.list.length; ++i) {
      const q = p.quests.list[i];
      kit.fitText((q.done ? '✓ ' : '') + R.questText(q), x + 18, y + 160 + i * 28, w - 90, 13, { color: q.done ? UI.good : UI.text });
      kit.text('+' + R.questReward(q), x + w - 18, y + 160 + i * 28, 12, UI.shard, { align: 'right', weight: 'bold' });
      kit.bar(x + 18, y + 170 + i * 28, w - 36, 3, R.questProgress(p, q), q.done ? UI.good : UI.accent2);
    }
    /* season and daily */
    y += 262;
    const s = G.season;
    const hot = W.area('seasoncard', x, y, w, 96, () => scr.openSeason('title'));
    kit.panel(x, y, w, 96, { accent: s.color, glow: hot, alpha: 0.92 });
    K.blit(ctx, NS.itemArt.token(s.token), x + 40, y + 48, 1.3 + Math.sin(G.time * 3) * 0.05);
    kit.text('SEASONAL EVENT', x + 76, y + 20, 11, UI.textMute, { weight: 'bold' });
    kit.fitText(s.name, x + 76, y + 42, w - 94, 20, { weight: 'bold', color: s.color });
    kit.text(NS.seasons.daysLeft(G.date) + ' days left - ' + p.season.tokens + ' ' + s.tokenPlural, x + 76, y + 66, 12, UI.textDim);
    y += 108;
    const d = NS.seasons.daily(G.date);
    kit.panel(x, y, w, 76, { accent: UI.accent2, alpha: 0.92 });
    kit.text('DAILY MAZE  ' + d.key, x + 18, y + 20, 11, UI.textMute, { weight: 'bold' });
    kit.fitText(d.mods.map(m => MODIFIER_BY_ID[m].name).join(' + '), x + 18, y + 42, w - 36, 16, { weight: 'bold', color: UI.accent2 });
    const best = p.daily.key === d.key ? p.daily.best : 0;
    kit.text(best ? 'Your best today: ' + kit.group(best) : 'Not played yet today', x + 18, y + 62, 12, UI.textDim);
  }

  function confirmBox() {
    const c = G.ui.confirm;
    if (!c) return false;
    const r = NS.view.visible();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(r.x0, r.y0, r.w, r.h);
    G.hitAreas.length = 0;
    kit.panel(340, 250, 600, 200, { accent: UI.accent, glow: true });
    kit.wrap(c.text, 640, 290, 540, 20, 28, '#ffffff', { align: 'center', weight: 'bold' });
    W.button('yes', 'Start new run', 380, 380, 250, 48, { accent: UI.bad, action: () => { G.ui.confirm = null; c.yes(); } });
    W.button('no', 'Keep my run', 650, 380, 250, 48, { accent: UI.good, action: () => { G.ui.confirm = null; } });
    return true;
  }

  function draw() {
    const r = NS.view.visible();
    const grad = ctx.createLinearGradient(r.x0, 0, r.x1, 0);
    grad.addColorStop(0, 'rgba(0,0,10,0.72)');
    grad.addColorStop(0.32, 'rgba(0,0,10,0.25)');
    grad.addColorStop(0.68, 'rgba(0,0,10,0.25)');
    grad.addColorStop(1, 'rgba(0,0,10,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(r.x0, r.y0, r.w, r.h);
    const k = NS.rng.easeBack(Math.min(1, G.screenT * 1.5));
    const bob = Math.sin(G.time * 2) * 4;
    ctx.save();
    ctx.translate(640, 84 + bob);
    ctx.scale(k * 0.8, k * 0.8);
    K.blit(ctx, kit.logo(), 0, 0, 1);
    ctx.restore();
    kit.text('Relight the five Lumens of Pac-Land', 640, 148, 16, UI.text, { align: 'center', weight: 'bold' });
    menu();
    card();
    confirmBox();
  }

  Object.assign(NS.title, {
    draw, startMode
  });
})();
