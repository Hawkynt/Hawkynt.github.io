/* The remaining screens: the pause menu (resume, tech tree, collection, journal, ascend,
   give up a Bake-Off, title, full reset behind a confirmation), the ascension screen with what
   is kept and gained, the Bake-Off results, the how-to-play page and the Zen Kitchen's quiet
   controls. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI, VIEW_W, VIEW_H } = NS.constants;
  const E = NS.economy;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const { STAGES, SKINS } = NS.treatData;
  const { ctx } = NS.view;

  function shade(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(16,8,4,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function drawPause() {
    shade(0.72);
    const x = 440, w = 400;
    kit.text('PAUSED', 640, 92, 44, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    kit.text(G.bake ? 'The Bake-Off clock is stopped' : 'Your ovens keep baking while you are here', 640, 128, 15, UI.textDim, { align: 'center' });
    let y = 156;
    const b = (id, label, opts) => {
      W.button(id, label, x, y, w, 48, opts);
      y += 56;
    };
    b('p-resume', 'Resume', { icon: 'play', accent: UI.good, action: () => NS.screens.resume() });
    b('p-tree', 'Tech Tree', { icon: 'tree', accent: UI.notes, sub: G.profile.notes + ' notes - ' + (G.profile.crystals - G.profile.crystalsSpent) + ' crystals', action: () => NS.screens.openTree('paused') });
    b('p-coll', 'Collection', { icon: 'palette', action: () => NS.screens.openCollection('paused') });
    b('p-journal', 'Journal', { icon: 'trophy', action: () => NS.screens.openJournal('paused') });
    if (NS.garden.unlocked()) b('p-garden', 'Sugar Garden', { icon: 'leaf', accent: UI.good, action: () => NS.gardenUi.open('paused') });
    if (G.bake) b('p-giveup', 'Give up the Bake-Off', { icon: 'back', accent: UI.bad, action: () => NS.modes.quitBake() });
    else if (NS.trials.current()) {
      const t = NS.trials.current();
      b('p-abandon', 'Abandon trial: ' + t.name, { icon: 'back', accent: UI.bad, sub: NS.trials.goalText(t), action: () => NS.screens.confirm('Abandon the trial?',
        'The rule is lifted and your bakery carries on as it is. The trial stays open for another try after an ascension.', () => { NS.trials.abandon(); NS.screens.resume(); }) });
    } else {
      const pend = NS.prestige.pending();
      b('p-ascend', pend >= 1 ? 'Ascend  (+' + fmt.short(pend) + ' crystals)' : 'Ascend', { icon: 'crystal', accent: UI.crystal,
        sub: pend >= 1 ? undefined : 'next crystal at ' + fmt.short(NS.prestige.nextCrystalAt()) + ' baked in total', action: () => NS.screens.openAscend('paused') });
    }
    b('p-title', 'Title Screen', { icon: 'back', action: () => { NS.save.write(G); NS.screens.setScreen('title'); } });
    const M = SZ.GameMusic;
    if (M) W.button('p-music', M.enabled ? 'Music: on' : 'Music: off', x, y + 6, 90, 34, { px: 13, action: () => M.toggle() });
    W.button('p-reset', 'Erase all progress', x + 100, y + 6, 200, 34, { px: 13, accent: UI.bad, action: () => NS.screens.confirm('Erase everything?',
      'This deletes your bakery, crystals, tech tree, achievements and collection for good. There is no undo.', () => NS.app.hardReset()) });
  }

  function drawAscend() {
    shade(0.8);
    const p = G.profile;
    const pend = NS.prestige.pending();
    kit.text('ASCENSION', 640, 92, 46, UI.crystal, { align: 'center', weight: 'bold', shadow: 'rgba(60,0,90,0.9)' });
    kit.text('Leave this bakery behind and begin again from one plain cookie - stronger every time.', 640, 132, 16, UI.textDim, { align: 'center' });
    kit.panel(150, 166, 470, 300, { accent: UI.good });
    kit.text('YOU KEEP', 176, 196, 18, UI.good, { weight: 'bold' });
    const keep = ['Sugar crystals: +1% production each, forever', 'The whole tech tree (Kitchen and Sanctum)', 'Achievements, collection, seasons and stats',
      'Recipe notes and your Bake-Off records', E.treeStat(p, 'keepDecor') ? 'Treat decorations (Family Decor)' : 'Your highest era stays unlocked in the gallery'];
    for (let i = 0; i < keep.length; ++i) kit.fitText('+  ' + keep[i], 176, 232 + i * 32, 430, 15, { color: '#ffffff' });
    kit.panel(660, 166, 470, 300, { accent: UI.bad });
    kit.text('YOU LOSE', 686, 196, 18, UI.bad, { weight: 'bold' });
    const lose = ['All treats in the bakery (' + fmt.short(G.run.cookies) + ')', 'All producers and upgrades', 'The treat returns to a Plain Cookie', 'Era milestones of this run'];
    for (let i = 0; i < lose.length; ++i) kit.fitText('-  ' + lose[i], 686, 232 + i * 32, 430, 15, { color: '#ffffff' });
    if (pend >= 1) {
      kit.text('+' + fmt.short(pend) + ' sugar crystals', 640, 510, 36, UI.crystal, { align: 'center', weight: 'bold', shadow: true });
      kit.text('production bonus ' + fmt.short(p.crystals) + '% -> ' + fmt.short(p.crystals + pend) + '%  (more with Crystal Resonance)', 640, 548, 15, UI.textDim, { align: 'center' });
    } else {
      kit.text('No crystals yet', 640, 510, 30, UI.textMute, { align: 'center', weight: 'bold' });
      kit.text('The first crystal needs 1 trillion baked in total; the next at ' + fmt.short(NS.prestige.nextCrystalAt()), 640, 548, 15, UI.textDim, { align: 'center' });
    }
    W.button('a-no', 'Not yet', 240, 600, 240, 52, { icon: 'back', action: () => NS.screens.back() });
    W.button('a-trials', 'Sanctum Trials', 520, 600, 240, 52, { icon: 'star', accent: UI.gold, disabled: !NS.trials.available(),
      sub: NS.trials.available() ? E.trialsDone(p) + ' / ' + NS.trials.TRIALS.length + ' completed' : 'open after the first ascension', action: () => NS.screens.setScreen('trials') });
    W.button('a-yes', 'Ascend', 800, 600, 240, 52, { icon: 'crystal', accent: UI.crystal, disabled: !NS.prestige.canAscend(), action: () => {
      NS.screens.setScreen('game');
      NS.prestige.ascend();
    } });
  }

  function drawTrials() {
    shade(0.82);
    const p = G.profile;
    kit.text('SANCTUM TRIALS', 640, 64, 42, UI.crystal, { align: 'center', weight: 'bold', shadow: 'rgba(60,0,90,0.9)' });
    kit.text('Begin again under a rule. Reach its era to complete the trial: +' + Math.round(NS.trialData.BONUS * 100) + '% production forever for each one, and rare cosmetics at 3 and 6.',
      640, 100, 15, UI.textDim, { align: 'center' });
    const pend = NS.prestige.pending();
    kit.text(pend >= 1 ? 'Beginning a trial ascends: +' + fmt.short(pend) + ' sugar crystals come with you' : 'Beginning a trial resets the bakery (the tree, garden, crystals and collection stay)', 640, 124, 13, pend >= 1 ? UI.crystal : UI.textMute, { align: 'center' });
    const T = NS.trials.TRIALS;
    for (let i = 0; i < T.length; ++i) {
      const t = T[i];
      const x = 70 + (i % 3) * 386, y = 150 + Math.floor(i / 3) * 236;
      const done = !!p.trials[t.id];
      const cur = G.run && G.run.trial === t.id;
      kit.panel(x, y, 366, 222, { accent: done ? UI.good : cur ? UI.gold : UI.crystal, glow: cur });
      kit.icon(t.icon, x + 34, y + 36, 30, done ? UI.good : UI.crystal);
      kit.text(t.name, x + 64, y + 30, 21, '#ffffff', { weight: 'bold' });
      kit.text(done ? 'COMPLETED' : cur ? 'IN PROGRESS' : 'OPEN', x + 64, y + 52, 12, done ? UI.good : cur ? UI.gold : UI.textMute, { weight: 'bold' });
      kit.wrap(t.desc, x + 20, y + 84, 326, 14, UI.text);
      kit.text('Goal: ' + NS.trials.goalText(t), x + 20, y + 140, 13, UI.gold, { weight: 'bold' });
      if (p.trialBest[t.id]) kit.text('Best time: ' + fmt.duration(p.trialBest[t.id]), x + 20, y + 160, 12, UI.textDim);
      W.button('tr-' + t.id, cur ? 'Running' : done ? 'Play again' : 'Begin', x + 20, y + 170, 326, 40, { px: 15, disabled: cur || !NS.trials.available(), accent: UI.crystal,
        action: () => NS.screens.confirm('Begin ' + t.name + '?', 'Your bakery starts over from one plain cookie under this rule. The tech tree, garden, crystals, achievements and collection stay.',
          () => NS.trials.begin(t.id)) });
    }
    W.button('back', 'Back', 520, 652, 240, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.setScreen('ascend') });
  }

  function drawBakeResult() {
    shade(0.78);
    const r = G.ui.bakeResult;
    if (!r) return;
    kit.text('TIME\'S UP!', 640, 100, 52, UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(80,30,0,0.9)' });
    kit.text(r.daily ? 'Daily Bake-Off' + (r.mod ? ' - ' + r.mod.name : '') : 'Bake-Off', 640, 146, 18, UI.textDim, { align: 'center' });
    kit.text(fmt.long(r.score), 640, 222, 58, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    kit.text('baked in three minutes', 640, 270, 16, UI.textDim, { align: 'center' });
    if (r.best) kit.text('NEW PERSONAL BEST!', 640, 310, 26, UI.good, { align: 'center', weight: 'bold' });
    else kit.text('Rank #' + (r.rank || '-') + ' in your top ten', 640, 310, 20, UI.text, { align: 'center' });
    const facts = ['Reached: ' + STAGES[r.stage].name, 'Golden treats: ' + r.golden, 'Best combo: ' + r.combo, 'Clicks: ' + fmt.group(r.clicks)];
    for (let i = 0; i < facts.length; ++i) kit.text(facts[i], 340 + i * 200, 370, 15, UI.textDim, { align: 'center' });
    kit.text('+' + r.notes + ' recipe notes', 640, 426, 26, UI.notes, { align: 'center', weight: 'bold' });
    W.button('r-again', 'Bake again', 300, 500, 220, 52, { icon: 'clock', action: () => NS.modes.startBake(r.daily) });
    W.button('r-bakery', 'My bakery', 530, 500, 220, 52, { icon: 'play', accent: UI.good, action: () => NS.screens.setScreen('game') });
    W.button('r-title', 'Title', 760, 500, 220, 52, { icon: 'back', action: () => NS.screens.setScreen('title') });
  }

  const HELP = [
    ['Click the treat', 'Every click bakes. Click quickly to build a combo - each step makes clicks stronger until the combo cap.'],
    ['Buy producers', 'Cursors, grandmas, farms and fifteen more bake on their own. Each one costs 15% more than the last.'],
    ['Upgrades', 'Upgrades multiply producers, clicks and everything else. Decorations even change how the treat looks.'],
    ['Eras', 'Bake enough in one run and the treat evolves: cookie, cupcake, cakes and beyond. Every era adds a production bonus and milestones.'],
    ['Golden treats', 'Click them before they fade: Lucky piles, Frenzy, Click Frenzy, Building Rush, Cookie Storms and more. In season they drop tokens.'],
    ['Tech tree', 'Recipe notes from baking, milestones, quests and achievements buy permanent research. Open it with T or the note chip.'],
    ['Ascension', 'After a trillion baked in total, ascend for sugar crystals: +1% production each and the Sugar Sanctum tree.'],
    ['Come back', 'The bakery saves itself and bakes while you are away (capped). Daily quests, streaks and seasons reward regular visits.'],
  ];

  function drawHelp() {
    shade(0.85);
    kit.text('HOW TO PLAY', 640, 64, 40, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    for (let i = 0; i < HELP.length; ++i) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 70 + col * 580, y = 104 + row * 128;
      kit.panel(x, y, 560, 116, { accent: UI.gold });
      kit.text(HELP[i][0], x + 20, y + 26, 19, UI.gold, { weight: 'bold' });
      kit.wrap(HELP[i][1], x + 20, y + 56, 520, 15, '#ffffff');
    }
    kit.text('Keys: Space clicks the treat - T tech tree - C collection - J journal - Tab store tab - B buy amount - Esc pause', 640, 630, 14, UI.textDim, { align: 'center' });
    W.button('back', 'Back', 520, 652, 240, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function drawZen() {
    const u = G.ui;
    const stage = u.zenStage;
    NS.hud.drawTreat({ stage: stage, skin: u.zenSkin, x: VIEW_W / 2, y: VIEW_H / 2 + 20, scale: 1.25, mask: 63 & ((1 << Math.min(6, stage + 1)) - 1), noHover: true });
    const a = Math.max(0, 1 - Math.max(0, u.zenT - 5) / 3);
    const near = G.input.my > VIEW_H - 120 || G.input.my < 90;
    ctx.globalAlpha = Math.max(a, near ? 0.9 : 0.12);
    kit.text('Zen Kitchen', VIEW_W / 2, 50, 30, '#fff4dc', { align: 'center', weight: 'bold', shadow: true });
    kit.text('Click anywhere for sprinkles and chimes. Nothing to count, nothing to lose.', VIEW_W / 2, 84, 15, UI.textDim, { align: 'center' });
    const max = G.profile.stageMax;
    W.button('z-prev', 'Earlier era', 330, 640, 180, 44, { icon: 'back', disabled: stage <= 0, action: () => { u.zenStage = Math.max(0, stage - 1); } });
    W.button('z-skin', 'Next skin', 550, 640, 180, 44, { icon: 'palette', action: () => cycleSkin() });
    W.button('z-next', 'Later era', 770, 640, 180, 44, { icon: 'play', disabled: stage >= max, action: () => { u.zenStage = Math.min(max, stage + 1); } });
    W.button('z-leave', 'Leave', 30, 30, 120, 40, { icon: 'back', action: () => NS.modes.leaveZen() });
    ctx.globalAlpha = 1;
  }

  function cycleSkin() {
    const u = G.ui;
    let i = SKINS.findIndex(s => s.id === u.zenSkin);
    for (let k = 0; k < SKINS.length; ++k) {
      i = (i + 1) % SKINS.length;
      if (NS.progression.isUnlocked(SKINS[i], 'skin')) break;
    }
    u.zenSkin = SKINS[i].id;
  }

  Object.assign(NS.pause, { drawPause, drawAscend, drawTrials, drawBakeResult, drawHelp, drawZen, cycleSkin, HELP });
})();
