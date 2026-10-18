/* The mission briefing: name, sector and mission type, the story, objective, the three star
   goals with the par time, reward, best result, expected hazards and enemies, and the current
   loadout with a turning ship preview; Launch, Loadout and Back. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { SECTORS, MISSIONS, MISSION_TYPES, missionId } = NS.campaign;
  const { SHIPS, PRIMARIES, SECONDARIES, SKINS, byId } = NS.ships;
  const { ENEMIES, BOSSES } = NS.enemyData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  function mmss(s) {
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function draw() {
    const b = G.ui.briefing;
    if (!b) { scr.setScreen('map'); return; }
    const save = G.save;
    const m = MISSIONS[b.sector][b.index];
    const sec = SECTORS[b.sector];
    const id = missionId(b.sector, b.index);
    const stage = NS.waves.campaignStage(b.sector, b.index);
    const stars = save.stars[id] || 0;
    const accent = m.type === 'boss' ? '#ff5c6c' : sec.theme.accent;
    const k = Math.min(1, G.screenT * 3);

    ctx.globalAlpha = k;
    const x = 60, y = 50, w = 740, h = 580;
    kit.panel(x, y, w, h, { accent: accent, glow: true });
    kit.text('SECTOR ' + (b.sector + 1) + '  -  ' + sec.name.toUpperCase() + '  -  MISSION ' + (b.index + 1), x + 28, y + 30, 13, accent, { weight: 'bold' });
    kit.fitText(m.name, x + 28, y + 70, w - 200, 38, { weight: 'bold', color: '#ffffff' });
    kit.icon(MISSION_TYPES[m.type].icon, x + w - 60, y + 62, 40, accent);
    kit.text(MISSION_TYPES[m.type].name.toUpperCase(), x + w - 60, y + 100, 12, accent, { align: 'center', weight: 'bold' });

    let yy = y + 116;
    yy += kit.wrap(m.brief, x + 28, yy, w - 56, 17, 25, UI.text) + 14;
    kit.text('OBJECTIVE', x + 28, yy, 12, UI.textMute, { weight: 'bold' });
    kit.text(MISSION_TYPES[m.type].goal + (m.type === 'boss' ? '  (' + BOSSES[m.boss].name + ', ' + BOSSES[m.boss].title + ')' : ''), x + 130, yy, 15, '#ffffff');
    yy += 24;
    kit.text(objectiveDetail(stage), x + 130, yy, 14, UI.textDim);
    yy += 40;

    /* star goals */
    kit.text('STARS', x + 28, yy, 12, UI.textMute, { weight: 'bold' });
    const goals = ['Complete the mission', 'Finish with at least half your hull', 'Finish within ' + mmss(m.par)];
    for (let i = 0; i < 3; ++i) {
      kit.star(x + 142, yy + i * 28, 10, i < stars);
      kit.text(goals[i], x + 162, yy + i * 28, 15, i < stars ? UI.gold : UI.text);
    }
    yy += 96;
    kit.text('REWARD', x + 28, yy, 12, UI.textMute, { weight: 'bold' });
    kit.credits(rules.missionReward(b.sector, b.index, 3, stars), x + 130, yy, 18);
    kit.text(stars ? '(replay value - best time ' + (save.times[id] ? mmss(save.times[id]) : '-') + ')' : 'plus all scrap you collect', x + 230, yy, 13, UI.textDim);
    yy += 40;

    /* threats */
    kit.text('THREATS', x + 28, yy, 12, UI.textMute, { weight: 'bold' });
    const roster = m.type === 'destroy' ? stage.roster.concat(['station']) : stage.roster;
    for (let i = 0; i < roster.length; ++i) {
      const tx = x + 150 + i * 62;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(tx, yy + 16, 24, 0, Math.PI * 2);
      ctx.fill();
      const spr = NS.enemyArt.enemySprite(roster[i]);
      K.blitRot(ctx, spr, tx, yy + 16, -Math.PI / 2, Math.min(1, 40 / spr.w * (ENEMIES[roster[i]].r > 30 ? 1.3 : 1.6)));
      kit.fitText(ENEMIES[roster[i]].name, tx, yy + 50, 60, 11, { align: 'center', color: UI.textDim });
    }

    drawLoadout(840, 50, 380, 470, save);

    ctx.globalAlpha = 1;
    W.button('launch', 'LAUNCH', 840, 540, 380, 64, { action: () => NS.missions.startRun('campaign', { sector: b.sector, index: b.index }), accent: UI.good, px: 26, sub: 'Enter' });
    W.button('loadout', 'Change Loadout', 840, 616, 185, 44, { action: () => scr.openHangar('briefing') });
    W.button('back', 'Back', 1035, 616, 185, 44, { action: () => scr.setScreen('map') });
  }

  function objectiveDetail(st) {
    switch (st.type) {
      case 'survive': return 'Hold out for ' + st.time + ' seconds against endless raiders.';
      case 'defend': return 'The station has to survive for ' + st.time + ' seconds.';
      case 'destroy': return st.n + ' outposts, each guarded by sentries and launching swarmers.';
      case 'collect': return st.n + ' data cores - stay close while each downloads; every one trips an ambush.';
      case 'escort': return 'The freighter flies its route on its own - keep enemies off it.';
      case 'boss': return 'Destroy the parts to weaken it; watch for phase changes.';
    }
    return '';
  }

  function drawLoadout(x, y, w, h, save) {
    const ship = byId(SHIPS, save.ship) || SHIPS[0];
    const skin = SKINS[save.style.skin];
    const colors = (skin && skin.colors) || ship.colors;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.text('LOADOUT', x + 22, y + 28, 13, UI.accent, { weight: 'bold' });
    const cx = x + w / 2, cy = y + 150;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    K.blit(ctx, K.glow(colors.glow), cx, cy, 3);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite(ship.id, save.style.skin, colors, Math.sin(G.time * 1.4) * 0.9), cx, cy, -Math.PI / 2 + Math.sin(G.time * 0.7) * 0.25, 2.6);
    kit.text(ship.name, cx, y + 260, 24, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(ship.role, cx, y + 286, 13, UI.textDim, { align: 'center' });
    const pri = byId(PRIMARIES, save.loadout.primary), secd = byId(SECONDARIES, save.loadout.secondary);
    const rows = [['Primary', pri.name], ['Secondary', secd.name], ['Special', ship.ability.name]];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 26, y + 330 + i * 34, 14, UI.textDim);
      kit.text(rows[i][1], x + w - 26, y + 330 + i * 34, 15, '#ffffff', { align: 'right', weight: 'bold' });
    }
    kit.wrap(ship.ability.desc, x + 26, y + 428, w - 52, 13, 18, UI.textDim);
  }

  Object.assign(NS.briefing, {
    draw, mmss
  });
})();
