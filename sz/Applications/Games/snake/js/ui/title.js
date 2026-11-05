/* The title screen over the self-playing demo board: the logo, Continue (when a run is
   autosaved, with where it was left), the six modes, the tech tree, collection, journal and help;
   a profile card with scales, stars, the streak and today's quests; and the festival card with
   its token track, the weekly Arcade mutator and today's Daily Garden best. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { MODES } = NS.items;
  const { WORLDS } = NS.worlds;
  const { TIERS } = NS.seasons;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const { ctx } = NS.view;

  let snapCache = null, snapT = -1;

  /* the autosaved run, re-read at most twice a second */
  function snapshot() {
    if (G.time - snapT > 0.5 || snapT < 0) {
      snapT = G.time;
      snapCache = NS.save.readRun();
    }
    return snapCache;
  }

  function snapLabel(s) {
    const names = { story: 'Story', arcade: 'Arcade', zen: 'Zen', time: 'Time Attack', daily: 'Daily Garden', rush: 'Guardian Rush' };
    let where = '';
    if (s.mode === 'story') where = WORLDS[s.w].name + ' ' + (s.w + 1) + '-' + (s.l + 1);
    else if (s.mode === 'arcade') where = 'stage ' + s.stage;
    else if (s.mode === 'rush') where = 'guardian ' + (s.rushIndex + 1);
    return names[s.mode] + (where ? ' - ' + where : '') + ' - score ' + s.score;
  }

  function continueRun() {
    const s = NS.save.readRun();
    snapT = -1;
    if (s) NS.run.restore(s);
  }

  function startMode(id) {
    snapT = -1;
    switch (id) {
      case 'story': scr.open('map', 'title'); G.ui.mapSel = -1; break;
      case 'arcade': NS.save.clearRun(); NS.run.startArcade(); break;
      case 'zen': NS.save.clearRun(); NS.run.startZen(); break;
      case 'daily': NS.save.clearRun(); NS.run.startDaily(); break;
      case 'time': NS.save.clearRun(); NS.run.startTime(); break;
      case 'rush': NS.save.clearRun(); NS.run.startRush(); break;
    }
  }

  function modeSub(id) {
    const save = G.save;
    switch (id) {
      case 'story': return rules.totalStars(save) + ' / 90 stars - ' + save.story.freed.length + ' / 5 guardians';
      case 'arcade': return 'Best ' + save.stats.arcadeBest + ' - this week: ' + G.weekly.name;
      case 'daily': return save.daily[G.today] ? 'Today\'s best ' + save.daily[G.today] : 'A new garden today';
      case 'time': return 'Best ' + save.stats.timeBest;
      case 'rush': return save.story.freed.length ? save.story.freed.length + ' guardians to face' : 'Free a guardian in Story first';
      default: return MODES[id].desc;
    }
  }

  function draw() {
    const v = NS.view.visible();
    const gr = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    gr.addColorStop(0, 'rgba(4,12,8,0.55)');
    gr.addColorStop(0.5, 'rgba(4,12,8,0.35)');
    gr.addColorStop(1, 'rgba(4,12,8,0.7)');
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const t = G.time;
    const lg = kit.logo();
    const bob = Math.sin(t * 1.6) * 4;
    K.blit(ctx, lg, 640, 78 + bob, 0.78 + Math.sin(t * 2.2) * 0.008);
    const sub = '»SynthelicZ«  Arcade' + (G.season ? '   -   ' + G.season.name + ' festival' : '');
    kit.text(sub, 640, 148, 15, G.season ? G.season.color : UI.textDim, { align: 'center' });

    /* centre column */
    const x = 480, w = 320;
    let y = 172;
    const snap = snapshot();
    if (snap) {
      W.button('continue', 'Continue', x, y, w, 54, { sub: snapLabel(snap), icon: 'play', accent: UI.good, action: continueRun });
      y += 62;
    }
    const ids = ['story', 'arcade', 'zen', 'daily', 'time', 'rush'];
    for (let k = 0; k < ids.length; ++k) {
      const id = ids[k];
      const locked = id === 'rush' && !G.save.story.freed.length;
      W.button('mode-' + id, MODES[id].name, x, y, w, snap ? 46 : 50, {
        sub: modeSub(id), icon: MODES[id].icon, accent: MODES[id].color, disabled: locked, action: () => startMode(id),
      });
      y += snap ? 51 : 56;
    }
    y += 4;
    const bw = (w - 16) / 3;
    W.button('tree', 'Tech Tree', x, y, bw, 40, { px: 15, action: () => scr.open('tree', 'title') });
    W.button('wardrobe', 'Collection', x + bw + 8, y, bw, 40, { px: 15, action: () => scr.open('wardrobe', 'title') });
    W.button('journal', 'Journal', x + (bw + 8) * 2, y, bw, 40, { px: 15, action: () => scr.open('journal', 'title') });

    profile(60, 180);
    festival(910, 180);
    kit.text('Arrows / mouse to choose  -  Enter to start  -  H for How to Play', 640, 700, 12, 'rgba(220,240,220,0.55)', { align: 'center' });
  }

  function profile(x, y) {
    const save = G.save;
    const w = 310, h = 400;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.text('YOUR GARDEN', x + 18, y + 24, 14, UI.accent, { weight: 'bold' });
    kit.credits(save.scales, x + 18, y + 56, 24);
    const rows = [
      ['Story stars', rules.totalStars(save) + ' / 90'],
      ['Guardians freed', save.story.freed.length + ' / 5'],
      ['Daily streak', save.streak.count + (save.streak.count === 1 ? ' day' : ' days')],
      ['Longest snake', String(save.stats.bestLength)],
    ];
    for (let k = 0; k < rows.length; ++k) {
      kit.text(rows[k][0], x + 18, y + 94 + k * 24, 14, UI.textDim);
      kit.text(rows[k][1], x + w - 18, y + 94 + k * 24, 14, UI.text, { align: 'right', weight: 'bold' });
    }
    kit.text('TODAY\'S QUESTS', x + 18, y + 204, 13, UI.gold, { weight: 'bold' });
    const q = save.quests.list;
    for (let k = 0; k < q.length; ++k) {
      const yy = y + 230 + k * 50;
      const done = q[k].done;
      kit.icon(done ? 'check' : 'star', x + 28, yy, 18, done ? UI.good : UI.gold);
      kit.fitText(rules.questText(q[k]), x + 46, yy - 6, w - 70, 13, { color: done ? UI.good : UI.text });
      kit.bar(x + 46, yy + 8, w - 72, 6, q[k].progress / q[k].n, done ? UI.good : UI.gold);
    }
    if (save.quests.bonus) kit.text('All done - come back tomorrow!', x + w / 2, y + h - 18, 12, UI.good, { align: 'center' });
    else kit.text('Finish all three for a bonus', x + w / 2, y + h - 18, 12, UI.textMute, { align: 'center' });
  }

  function festival(x, y) {
    const s = G.season;
    const w = 310, h = 400;
    kit.panel(x, y, w, h, { accent: s.color, glow: true });
    kit.text(s.name.toUpperCase(), x + 18, y + 26, 18, s.color, { weight: 'bold' });
    kit.text(NS.seasons.daysLeft(new Date()) + ' days left', x + w - 18, y + 26, 12, UI.textDim, { align: 'right' });
    kit.wrap(s.blurb + ' Collect festival tokens in every mode.', x + 18, y + 44, w - 36, 13, 18, UI.text);
    K.blit(ctx, NS.itemArt.fruit('token', s.id), x + 34, y + 110, 1);
    const ev = rules.eventRecord(G.save, G.eventId);
    let next = null;
    for (let k = 0; k < TIERS.length; ++k) if (ev.tokens < TIERS[k].n) { next = k; break; }
    kit.text(ev.tokens + ' tokens', x + 60, y + 102, 17, '#ffffff', { weight: 'bold' });
    if (next !== null) {
      const rw = rules.eventReward(s.id, next);
      const prev = next ? TIERS[next - 1].n : 0;
      kit.bar(x + 60, y + 118, w - 80, 8, (ev.tokens - prev) / (TIERS[next].n - prev), s.color, { cells: 5 });
      kit.fitText('Next at ' + TIERS[next].n + ': ' + (rw.kind === 'scales' ? rw.amount + ' scales' : rw.item.name + ' ' + rw.kind), x + 18, y + 146, w - 36, 13, { color: UI.textDim });
    } else kit.text('Festival track complete!', x + 18, y + 146, 13, UI.good);
    for (let k = 0; k < TIERS.length; ++k) {
      const got = ev.claimed.indexOf(k) >= 0;
      const cx = x + 40 + k * 58;
      ctx.fillStyle = got ? K.rgba(s.color, 0.5) : 'rgba(255,255,255,0.06)';
      kit.roundRect(cx - 22, y + 166, 44, 44, 8);
      ctx.fill();
      const rw = rules.eventReward(s.id, k);
      kit.icon(rw.kind === 'scales' ? 'coin' : rw.kind === 'skin' ? 'leaf' : rw.kind === 'hat' ? 'crown' : 'star', cx, y + 188, 22, got ? '#ffffff' : UI.textMute);
      kit.text(String(TIERS[k].n), cx, y + 220, 11, got ? s.color : UI.textMute, { align: 'center' });
    }
    kit.text('THIS WEEK IN ARCADE', x + 18, y + 252, 13, UI.gold, { weight: 'bold' });
    kit.text(G.weekly.name, x + 18, y + 274, 16, '#ffffff', { weight: 'bold' });
    kit.fitText(G.weekly.desc, x + 18, y + 294, w - 36, 13, { color: UI.textDim });
    const rec = NS.seasons.dailyRecipe(new Date());
    kit.text('TODAY\'S DAILY GARDEN', x + 18, y + 326, 13, '#ffb36a', { weight: 'bold' });
    kit.fitText(NS.worlds.THEMES[rec.theme].name + ' - ' + rec.mutators.map(id => NS.seasons.MUTATOR_BY_ID[id].name).join(' + '), x + 18, y + 348, w - 36, 13, { color: UI.text });
    kit.text(G.save.daily[G.today] ? 'Your best today: ' + G.save.daily[G.today] : 'Not played yet - first run pays x1.5', x + 18, y + 370, 12, UI.textDim);
  }

  Object.assign(NS.title, {
    draw, continueRun, startMode, snapshot
  });
})();
