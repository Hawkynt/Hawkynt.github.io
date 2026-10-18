/* The sector map: five sector cards with painted thumbnails and star counts, the chosen sector's
   six missions on a route (type icon, stars, locks, the boss at the end), the sector's hazards
   and enemy roster, and buttons to the hangar and tech tree. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { SECTORS, MISSIONS, MISSION_TYPES, missionId } = NS.campaign;
  const { ENEMIES } = NS.enemyData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  /* mission node positions inside the route panel */
  const NODES = [[150, 300], [300, 430], [460, 330], [620, 460], [780, 340], [960, 420]];

  function sectorStars(save, s) {
    let n = 0;
    for (let i = 0; i < 6; ++i) n += save.stars[missionId(s, i)] || 0;
    return n;
  }

  function openBriefing(s, i) {
    G.ui.briefing = { sector: s, index: i };
    scr.setScreen('briefing');
  }

  function draw() {
    const save = G.save;
    const sel = G.ui.mapSector;
    NS.backdrop.setSector(sel);
    kit.text('SECTOR MAP', 60, 46, 30, '#ffffff', { weight: 'bold' });
    kit.text('Choose a mission. Clear the boss to open the next sector.', 60, 76, 14, UI.textDim);
    kit.credits(save.credits, 1220, 46, 22, 'right');
    kit.text(rules.totalStars(save) + ' / 90 stars', 1220, 76, 14, UI.gold, { align: 'right' });

    /* sector cards */
    for (let s = 0; s < SECTORS.length; ++s) {
      const x = 60 + s * 236, y = 100, w = 220, h = 92;
      const open = rules.sectorUnlocked(save, s);
      const hot = W.area('sector' + s, x, y, w, h, () => { if (open) G.ui.mapSector = s; }, !open);
      const active = s === sel;
      ctx.save();
      kit.roundRect(x, y, w, h, 10);
      ctx.clip();
      const neb = NS.backdropArt.nebulaLayer(s, SECTORS[s].theme);
      ctx.drawImage(neb.canvas, x - 20, y - 40, w + 40, (w + 40) * neb.h / neb.w);
      ctx.fillStyle = open ? (active ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)') : 'rgba(0,0,0,0.72)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      kit.panel(x, y, w, h, { accent: active ? UI.gold : hot ? '#ffffff' : SECTORS[s].theme.accent, glow: active, top: 'rgba(0,0,0,0)', bottom: 'rgba(0,0,0,0.25)', brackets: true });
      kit.text('SECTOR ' + (s + 1), x + 14, y + 22, 12, SECTORS[s].theme.accent, { weight: 'bold' });
      kit.fitText(SECTORS[s].name, x + 14, y + 46, w - 28, 19, { weight: 'bold', color: open ? '#ffffff' : UI.textMute });
      if (open) {
        kit.star(x + 22, y + 72, 8, true);
        kit.text(sectorStars(save, s) + ' / 18', x + 36, y + 72, 14, UI.gold, { weight: 'bold' });
      } else
        kit.lock(x + w - 30, y + 66, 22);
    }

    /* route panel */
    const px = 60, py = 214, pw = 1160, ph = 400;
    kit.panel(px, py, pw, ph, { accent: SECTORS[sel].theme.accent });
    kit.wrap(SECTORS[sel].blurb, px + 24, py + 18, 520, 15, 20, UI.text);
    drawHazards(px + 24, py + 56, SECTORS[sel].hazards);
    drawRoster(px + pw - 24, py + 30, SECTORS[sel].roster);

    /* the route line */
    ctx.strokeStyle = K.rgba(SECTORS[sel].theme.accent, 0.35);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -G.time * 20;
    ctx.beginPath();
    for (let i = 0; i < NODES.length; ++i) {
      const n = NODES[i];
      if (i === 0) ctx.moveTo(px + n[0], py + n[1] - 120);
      else ctx.lineTo(px + n[0], py + n[1] - 120);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    for (let i = 0; i < 6; ++i) {
      const m = MISSIONS[sel][i];
      const id = missionId(sel, i);
      const cx = px + NODES[i][0], cy = py + NODES[i][1] - 120;
      const open = rules.missionUnlocked(save, sel, i);
      const stars = save.stars[id] || 0;
      const r = i === 5 ? 44 : 34;
      const hot = W.area(id, cx - 70, cy - r - 6, 140, r * 2 + 56, () => openBriefing(sel, i), !open);
      const boss = m.type === 'boss';
      const col = !open ? UI.textMute : boss ? '#ff5c6c' : stars ? UI.gold : SECTORS[sel].theme.accent;
      if (open && !stars) {
        const pulse = (G.time % 1.4) / 1.4;
        ctx.strokeStyle = K.rgba(col, 0.6 * (1 - pulse));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6 + pulse * 18, 0, TAU);
        ctx.stroke();
      }
      const gr = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r);
      gr.addColorStop(0, hot ? '#3a4a78' : '#26324e');
      gr.addColorStop(1, '#0a0e1a');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (hot ? 1.08 : 1), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hot ? '#ffffff' : col;
      ctx.lineWidth = hot ? 3 : 2;
      ctx.stroke();
      if (open) kit.icon(MISSION_TYPES[m.type].icon, cx, cy, r * 0.9, col);
      else kit.lock(cx, cy + 2, r * 0.9);
      kit.text((i + 1) + '. ' + m.name, cx, cy + r + 16, 14, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      kit.text(MISSION_TYPES[m.type].name, cx, cy + r + 33, 12, open ? UI.textDim : UI.textMute, { align: 'center' });
      for (let k = 0; k < 3; ++k) kit.star(cx - 18 + k * 18, cy - r - 2, 7, k < stars);
    }

    W.button('back', 'Back', 60, 640, 180, 46, { action: () => scr.setScreen('title'), icon: 'rate' });
    W.button('hangar', 'Hangar', 820, 640, 190, 46, { action: () => scr.openHangar('map'), icon: 'engine' });
    W.button('tree', 'Tech Tree', 1030, 640, 190, 46, { action: () => scr.openTree('map'), icon: 'radar' });
  }

  function drawHazards(x, y, hz) {
    const list = [];
    if (hz.rocks) list.push(['Asteroids', '#c8a070']);
    if (hz.mines) list.push(['Minefields', '#ff5c6c']);
    if (hz.nebulae) list.push(['Nebulae', '#b07aff']);
    if (hz.hole) list.push(['Black hole', '#6ad0ff']);
    if (hz.flares) list.push(['Solar flares', '#ffb347']);
    kit.text('HAZARDS', x, y + 6, 11, UI.textMute, { weight: 'bold' });
    let xx = x + 70;
    for (let i = 0; i < list.length; ++i) {
      ctx.font = kit.font(13, 'bold');
      const w = ctx.measureText(list[i][0]).width + 20;
      ctx.fillStyle = K.rgba(list[i][1], 0.18);
      kit.roundRect(xx, y - 5, w, 22, 11);
      ctx.fill();
      kit.text(list[i][0], xx + 10, y + 6, 13, list[i][1], { weight: 'bold' });
      xx += w + 8;
    }
  }

  function drawRoster(xr, y, roster) {
    kit.text('ENEMIES', xr, y, 11, UI.textMute, { align: 'right', weight: 'bold' });
    for (let i = 0; i < roster.length; ++i) {
      const x = xr - 24 - i * 52;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x, y + 34, 22, 0, TAU);
      ctx.fill();
      const spr = NS.enemyArt.enemySprite(roster[i] === 'turret' ? 'turret' : roster[i]);
      K.blitRot(ctx, spr, x, y + 34, -Math.PI / 2, 36 / Math.max(spr.w, 36) * (ENEMIES[roster[i]].r > 30 ? 1.2 : 1));
    }
  }

  Object.assign(NS.map, {
    draw, openBriefing
  });
})();
