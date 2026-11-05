/* The title screen over the attract scene: the logo with the season's subtitle, Continue for the
   autosaved run, the five modes (Boss Rush opens after the first titan), the Today card (season
   event track, daily quests, streak, this week's featured chapter, today's daily best) and the
   way to the tech tree, hangar, goals and help. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, VIEW_W } = NS.constants;
  const { MODES, CHAPTERS } = NS.campaign;
  const { QUESTS } = NS.goalData;
  const S = NS.seasons;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;

  let cont = null;
  let contAt = -99;

  /* the autosaved run, re-read when the screen opens and every two seconds */
  function continueInfo() {
    if (G.screenT < contAt || G.screenT - contAt > 2) {
      cont = NS.snapshot.describe();
      contAt = G.screenT;
    }
    return cont;
  }

  function startMode(id) {
    switch (id) {
      case 'story':
        G.ui.mapChapter = Math.min(CHAPTERS.length - 1, NS.rules.chaptersDone(G.save));
        scr.setScreen('map');
        break;
      case 'arcade':
      case 'zen':
      case 'daily':
      case 'rush':
        NS.snapshot.clear();
        NS.waves.startRun(id);
        scr.setScreen('playing');
        break;
    }
  }

  function draw() {
    const v = visible();
    const t = G.screenT;
    /* soft vignette so the menu reads over the attract scene */
    const gr = ctx.createLinearGradient(v.x0, 0, v.x0 + 520, 0);
    gr.addColorStop(0, 'rgba(2,4,14,0.85)');
    gr.addColorStop(1, 'rgba(2,4,14,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, 520 + (0 - v.x0), v.h);
    const gr2 = ctx.createLinearGradient(v.x1 - 520, 0, v.x1, 0);
    gr2.addColorStop(0, 'rgba(2,4,14,0)');
    gr2.addColorStop(1, 'rgba(2,4,14,0.8)');
    ctx.fillStyle = gr2;
    ctx.fillRect(v.x1 - 520, v.y0, 520, v.h);

    const drop = Math.max(0, 1 - t * 2.5);
    const logo = kit.logo();
    K.blit(ctx, logo, VIEW_W / 2, 84 - drop * 60, 0.82 + Math.sin(G.time * 1.3) * 0.01);
    const sd = G.cal.seasonDef;
    kit.text('S T A R F A L L', VIEW_W / 2, 140, 17, UI.gold, { align: 'center', weight: 'bold' });
    kit.text(sd.name + (sd.festival ? ' festival' : ' season') + ' is live', VIEW_W / 2, 164, 13, sd.accent, { align: 'center' });

    /* modes */
    let y = 206;
    const x = 60, w = 330;
    const ci = continueInfo();
    if (ci) {
      W.button('continue', 'Continue', x, y, w, 58, { action: () => scr.continueRun(), accent: UI.good, sub: ci.where + '  -  ' + NS.hud.fmt(ci.score) + ' pts', icon: 'play', px: 22 });
      y += 70;
    }
    const order = ['story', 'arcade', 'zen', 'daily', 'rush'];
    for (let i = 0; i < order.length; ++i) {
      const id = order[i];
      const M = MODES[id];
      let sub = M.desc;
      let disabled = false;
      if (id === 'rush' && !Object.keys(G.save.bossKinds).length) { disabled = true; sub = 'Defeat your first titan to unlock'; }
      if (id === 'daily') sub = G.cal.daily.mods.map(m => NS.powerData.MODIFIERS[m].name).join(' + ') + (G.save.best.daily.key === G.cal.day ? '  -  best ' + NS.hud.fmt(G.save.best.daily.score) : '');
      if (id === 'arcade' && G.save.best.arcade) sub = 'Best ' + NS.hud.fmt(G.save.best.arcade) + '  -  ' + M.desc;
      W.button('mode-' + id, M.name, x, y, w, 50, { action: () => startMode(id), accent: M.col, sub: sub, icon: M.icon, disabled: disabled });
      y += 58;
    }
    const by = Math.max(y + 8, 600);
    const small = [['tree', 'Tech Tree', 'gun'], ['wardrobe', 'Hangar', 'skin'], ['goals', 'Goals', 'trophy'], ['help', 'How to Play', 'book']];
    for (let i = 0; i < small.length; ++i) {
      const s = small[i];
      W.button('m-' + s[0], s[1], x + (i % 2) * 168, by + Math.floor(i / 2) * 50, 162, 42, { action: () => scr.open(s[0], 'title'), icon: s[2], px: 16 });
    }
    today(v);
  }

  /* the right-hand card: season track, quests, streak, featured */
  function today(v) {
    const x = Math.min(v.x1, 1290) - 400, y = 206, w = 370;
    const sd = G.cal.seasonDef;
    const se = NS.save.seasonEntry();
    kit.panel(x, y, w, 460, { accent: sd.accent });
    kit.text('TODAY', x + 20, y + 24, 15, UI.textDim, { weight: 'bold' });
    kit.credits(G.save.dust, x + w - 18, y + 24, 17, 'right');
    /* season track */
    K.blit(ctx, NS.propArt.token(G.cal.season), x + 34, y + 70, 1.2);
    kit.text(sd.name, x + 60, y + 60, 18, '#ffffff', { weight: 'bold' });
    const tier = S.tierFor(se.tokens);
    const next = S.TRACK[Math.min(tier, S.TRACK.length - 1)];
    const prev = tier ? S.TRACK[tier - 1] : 0;
    kit.text(tier >= S.TRACK.length ? 'Track complete!' : 'Tier ' + tier + ' / ' + S.TRACK.length + '  -  ' + se.tokens + ' / ' + next + ' ' + sd.tokenName.toLowerCase(), x + 60, y + 82, 12, UI.textDim);
    kit.bar(x + 20, y + 102, w - 40, 7, tier >= S.TRACK.length ? 1 : (se.tokens - prev) / (next - prev), sd.tokenCol, { cells: 8 });
    if (tier < S.TRACK.length) {
      const rw = S.trackReward(G.cal.season, tier + 1);
      kit.fitText('Next reward: ' + NS.progress.rewardText(rw), x + 20, y + 124, w - 40, 12, { color: sd.accent });
    }
    /* quests */
    kit.text('Daily quests', x + 20, y + 156, 15, '#ffffff', { weight: 'bold' });
    const qs = G.save.daily.quests;
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i];
      const def = QUESTS.find(d => d.id === q.id);
      if (!def) continue;
      const qy = y + 184 + i * 44;
      kit.fitText(def.text.replace('{n}', NS.hud.fmt(q.goal)), x + 20, qy, w - 120, 13, { color: q.done ? UI.good : UI.text });
      kit.text(q.done ? 'DONE' : '+' + q.dust, x + w - 20, qy, 12, q.done ? UI.good : '#bfe8ff', { align: 'right', weight: 'bold' });
      kit.bar(x + 20, qy + 13, w - 40, 4, q.p / q.goal, q.done ? UI.good : UI.accent);
    }
    /* streak and featured */
    const st = G.save.streak;
    const sy = y + 326;
    NS.propArt.icon(ctx, 'flame', x + 30, sy, 22, st.last === G.cal.day ? '#ffb04a' : UI.textMute);
    kit.text(st.count ? 'Day ' + st.count + ' streak' : 'Start a streak today', x + 50, sy - 7, 14, '#ffffff', { weight: 'bold' });
    kit.text(st.last === G.cal.day ? 'Bonus collected - come back tomorrow' : 'Fly today for +' + 40 * Math.min(7, (st.count || 0) + 1) + ' stardust', x + 50, sy + 11, 12, UI.textDim);
    const f = G.cal.featured;
    const ch = CHAPTERS[f.chapter];
    NS.propArt.icon(ctx, 'star', x + 30, sy + 52, 22, UI.gold);
    kit.text('Featured this week: ' + ch.name, x + 50, sy + 45, 14, '#ffffff', { weight: 'bold' });
    kit.fitText('+50% stardust there  -  ' + NS.rockData.ROCK_TYPES[f.rock].name + ' rocks pay double', x + 50, sy + 63, w - 70, 12, { color: UI.textDim });
    const ach = Object.keys(G.save.ach).length;
    kit.text('Achievements ' + ach + ' / ' + NS.goalData.ACHIEVEMENTS.length + '   -   Stars ' + NS.rules.totalStars(G.save) + ' / 90', x + 20, y + 440, 12, UI.textDim);
  }

  Object.assign(NS.title, {
    draw, startMode
  });
})();
