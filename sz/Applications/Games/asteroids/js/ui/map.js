/* The story world map: the five belts as planets along the Kestrel's route from Haven, locked
   ahead of progress, with their stars; the chosen chapter's six mission cards (objective, stars,
   best time, the titan) and replays of its briefings. Picking a mission runs the story flow into
   it. Owns nothing; reads G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { CHAPTERS, levelKey } = NS.campaign;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const OBJ_ICON = { clear: 'rock', survive: 'chrono', collect: 'star', rescue: 'pod', boss: 'skull' };
  const OBJ_TEXT = { clear: 'Clear the field', survive: 'Survive', collect: 'Gather shards', rescue: 'Rescue pods', boss: 'Titan' };

  function chapterOpen(c) {
    return rules.levelOpen(G.save, c, 0);
  }

  function chapterStars(c) {
    let s = 0;
    for (let l = 0; l < CHAPTERS[c].levels.length; ++l) s += G.save.stars[levelKey(c, l)] || 0;
    return s;
  }

  function select(c) {
    G.ui.mapChapter = c;
    NS.backdrop.setChapter(c);
  }

  function draw() {
    const sv = G.save;
    const sel = G.ui.mapChapter;
    kit.text('THE STARFALL CAMPAIGN', 60, 44, 28, '#ffffff', { weight: 'bold' });
    kit.text('Five belts between Haven and the Maw. Each mission has three stars: clear it, lose no ship, beat par.', 60, 74, 14, UI.textDim);
    kit.credits(sv.dust, 1220, 44, 22, 'right');
    kit.text('Stars ' + rules.totalStars(sv) + ' / 90', 1220, 74, 14, UI.gold, { align: 'right' });

    /* route */
    ctx.strokeStyle = 'rgba(160,200,255,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 12]);
    ctx.lineDashOffset = -G.time * 20;
    ctx.beginPath();
    ctx.moveTo(70, 330);
    for (let c = 0; c < CHAPTERS.length; ++c) ctx.lineTo(CHAPTERS[c].map.x, CHAPTERS[c].map.y - 140);
    ctx.stroke();
    ctx.setLineDash([]);
    /* Haven */
    K.blitRot(ctx, NS.cineRender.station(), 70, 330, G.time * 0.1, 0.32);
    kit.text('Haven', 70, 380, 12, UI.textDim, { align: 'center' });

    for (let c = 0; c < CHAPTERS.length; ++c) {
      const ch = CHAPTERS[c];
      const x = ch.map.x, y = ch.map.y - 140;
      const open = chapterOpen(c);
      const hot = W.area('ch' + c, x - 60, y - 60, 120, 130, open ? () => select(c) : null, !open);
      const pl = NS.backdrop.planet(c);
      const s = (c === sel ? 0.62 : 0.5) * (hot ? 1.06 : 1) * 110 / ch.theme.planet.r;
      if (c === sel) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 + 0.15 * Math.sin(G.time * 3);
        K.blit(ctx, K.glow(ch.theme.accent), x, y, 3.2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = open ? 1 : 0.35;
      K.blit(ctx, pl, x, y, s);
      ctx.globalAlpha = 1;
      kit.text(ch.sub.toUpperCase(), x, y + 52, 11, open ? ch.theme.accent : UI.textMute, { align: 'center', weight: 'bold' });
      kit.text(ch.name, x, y + 70, 16, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      if (open) {
        const st = chapterStars(c);
        kit.star(x - 34, y + 92, 7, st > 0);
        kit.text(st + ' / 18', x - 22, y + 92, 12, UI.gold);
        if (c === G.cal.featured.chapter) kit.text('FEATURED +50%', x + 52, y + 92, 10, UI.good, { align: 'center', weight: 'bold' });
      } else kit.lock(x, y, 26);
    }
    levels(sel);
    W.button('back', 'Back', 60, 652, 180, 44, { action: () => scr.setScreen('title'), icon: 'back' });
    if (sv.seen['ch' + sel])
      W.button('brief', 'Replay briefing', 252, 652, 220, 44, { action: () => NS.story.show(CHAPTERS[sel].intro, () => scr.setScreen('map'), CHAPTERS[sel].sub + ' - ' + CHAPTERS[sel].name), icon: 'book', px: 15 });
    if (rules.levelDone(sv, sel, CHAPTERS[sel].levels.length - 1))
      W.button('debrief', 'Replay debriefing', 484, 652, 230, 44, { action: () => NS.story.show(CHAPTERS[sel].outro, () => scr.setScreen('map'), CHAPTERS[sel].sub + ' - debriefing'), icon: 'book', px: 15 });
  }

  function levels(c) {
    const ch = CHAPTERS[c];
    const sv = G.save;
    const y = 470, w = 190, h = 160, gap = 10;
    const x0 = 640 - (ch.levels.length * (w + gap) - gap) / 2;
    for (let l = 0; l < ch.levels.length; ++l) {
      const L = ch.levels[l];
      const x = x0 + l * (w + gap);
      const open = rules.levelOpen(sv, c, l);
      const key = levelKey(c, l);
      const stars = sv.stars[key] || 0;
      const hot = W.area('lv' + l, x, y, w, h, open ? () => NS.cinematics.enterLevel(c, l) : null, !open);
      const boss = !!L.boss;
      kit.panel(x, y, w, h, { accent: hot ? UI.gold : boss ? '#ff5a6a' : ch.theme.accent, glow: hot, alpha: open ? 1 : 0.5 });
      kit.text(key, x + 14, y + 20, 13, UI.textDim, { weight: 'bold' });
      if (!open) {
        kit.lock(x + w / 2, y + 74, 30);
        continue;
      }
      NS.propArt.icon(ctx, OBJ_ICON[L.obj], x + w - 24, y + 22, 22, boss ? '#ff5a6a' : ch.theme.accent);
      kit.fitText(L.name, x + w / 2, y + 54, w - 20, 17, { align: 'center', weight: 'bold', color: '#ffffff' });
      let ob = OBJ_TEXT[L.obj];
      if (L.obj === 'survive') ob += ' ' + L.time + ' s';
      if (L.obj === 'collect') ob += ' x' + L.target;
      if (L.obj === 'rescue') ob += ' x' + L.target;
      if (boss) ob = NS.enemyData.BOSSES[L.boss].name;
      kit.fitText(ob, x + w / 2, y + 78, w - 20, 12, { align: 'center', color: UI.textDim });
      for (let s = 0; s < 3; ++s) kit.star(x + w / 2 - 30 + s * 30, y + 108, 11, s < stars);
      const bt = sv.bestTimes[key];
      kit.text(bt ? 'Best ' + NS.hud.clock(bt) + '  -  par ' + NS.hud.clock(L.par) : 'Par ' + NS.hud.clock(L.par), x + w / 2, y + 138, 11, UI.textMute, { align: 'center' });
    }
  }

  Object.assign(NS.map, {
    draw, select, chapterOpen, chapterStars
  });
})();
