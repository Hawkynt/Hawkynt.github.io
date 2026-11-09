/* ui/goals-panel.js -- the Goals overlay with four tabs (Today: quests, streak and the festival
   track; Achievements; Tower skins with previews to equip; Daily Siege with today's map, twist and
   best wave) and the small unlock toasts in the top-right corner.
   Reads: constants, towerTypes, maps, env, text, widgets, towerArt, goals, deeds, actions and the
   shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING, hexToRgba } = NS.constants;
  const { MAPS, BIOMES } = NS.maps;
  const { ctx, audio } = NS.env;
  const { fitText } = NS.text;
  const { UI, roundRectPath, drawPanel, drawScrim, uiButton } = NS.widgets;
  const Q = NS.goals;

  const TABS = [['today', 'Today'], ['ach', 'Achievements'], ['skins', 'Tower skins'], ['daily', 'Daily Siege']];
  G.goalsTab = 'today';

  function openGoals(tab) {
    if (G.state === STATE_PLAYING) NS.actions.togglePause();
    G.overlay = 'goals';
    if (tab) G.goalsTab = tab;
    audio.play('select');
  }

  function close() {
    G.overlay = null;
    audio.play('click', { pitch: 0.8 });
  }

  function card(x, y, w, h, on, color) {
    roundRectPath(x, y, w, h, 7);
    ctx.fillStyle = on ? hexToRgba(color, 0.14) : 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = on ? hexToRgba(color, 0.6) : 'rgba(150,170,210,0.15)';
    ctx.stroke();
  }

  function bar(x, y, w, h, k, color) {
    roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    if (k > 0) {
      roundRectPath(x, y, Math.max(h, w * Math.min(1, k)), h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawGoals() {
    drawScrim(0.72);
    const m = G.meta;
    const pw = Math.min(760, G.UW - 32), ph = Math.min(520, G.UH - 32);
    const px = G.UW / 2 - pw / 2, py = G.UH / 2 - ph / 2;
    const nAch = Object.keys(m.ach).length;
    drawPanel(px, py, pw, ph, { title: 'Goals', titleRight: `${nAch} / ${Q.ACHIEVEMENTS.length} achievements  ·  research ${m.rp}`, titleRightPad: 28, accent: UI.gold, radius: 12, headerH: 34 });
    uiButton('goals-close', px + pw - 30, py + 7, 22, 20, '×', { px: 14, onClick: close, tip: () => ['Close', 'Esc'] });
    const tw = (pw - 28 - 3 * 6) / 4;
    TABS.forEach(([id, label], i) => {
      uiButton('goals-tab-' + id, px + 14 + i * (tw + 6), py + 42, tw, 26, label, { px: 12, style: G.goalsTab === id ? 'gold' : 'dark',
        onClick: () => { G.goalsTab = id; audio.play('click'); } });
    });
    const area = { x: px + 14, y: py + 78, w: pw - 28, h: ph - 92 };
    ctx.textBaseline = 'middle';
    if (G.goalsTab === 'today') drawToday(area, m);
    else if (G.goalsTab === 'ach') drawAchievements(area, m);
    else if (G.goalsTab === 'skins') drawSkins(area, m);
    else drawDaily(area, m);
  }

  function drawToday(a, m) {
    let y = a.y;
    ctx.textAlign = 'left';
    fitText(`Daily quests  ·  day streak ${m.streak.count}  ·  new quests every day`, a.x, y + 8, a.w, 13, { weight: 'bold', color: UI.gold });
    y += 22;
    for (const q of m.quests.list) {
      card(a.x, y, a.w, 40, q.done, '#7ae08a');
      ctx.textAlign = 'left';
      fitText((q.done ? '✓ ' : '') + q.text, a.x + 12, y + 14, a.w * 0.6, 13, { weight: 'bold', color: q.done ? '#7ae08a' : '#e4eaf6' });
      fitText(`${q.have} / ${q.n}`, a.x + 12, y + 30, 120, 11, { color: UI.textDim });
      bar(a.x + a.w * 0.62, y + 15, a.w * 0.26, 10, q.have / q.n, q.done ? '#7ae08a' : '#5aa0ff');
      ctx.textAlign = 'right';
      fitText(`+${q.rp} research`, a.x + a.w - 10, y + 20, 90, 12, { color: '#b48aff' });
      y += 46;
    }
    y += 10;
    const fe = Q.festivalFor(new Date());
    const f = m.festival.event === Q.eventId(new Date()) ? m.festival : { tokens: 0, claimed: 0 };
    ctx.textAlign = 'left';
    fitText(`${fe.name}  ·  ${f.tokens} ${fe.token}  ·  earned from waves, maps, bosses and the Daily Siege`, a.x, y + 8, a.w, 13, { weight: 'bold', color: fe.color });
    y += 24;
    const cw = (a.w - 5 * 6) / 6;
    Q.TIERS.forEach((t, i) => {
      const x = a.x + i * (cw + 6), got = i < f.claimed;
      card(x, y, cw, 62, got, fe.color);
      ctx.textAlign = 'center';
      fitText(t.kind === 'skin' ? Q.SKIN_BY_ID[fe.skin].name : '+' + t.amount + ' research', x + cw / 2, y + 22, cw - 10, 12, { weight: 'bold', color: got ? fe.color : '#e4eaf6' });
      fitText(got ? 'claimed' : t.n + ' ' + fe.token, x + cw / 2, y + 44, cw - 10, 11, { color: UI.textDim });
    });
  }

  function drawAchievements(a, m) {
    const cols = a.w > 600 ? 3 : 2, gap = 6;
    const rows = Math.ceil(Q.ACHIEVEMENTS.length / cols);
    const cw = (a.w - (cols - 1) * gap) / cols, ch = Math.min(40, (a.h - (rows - 1) * 4) / rows);
    Q.ACHIEVEMENTS.forEach((ac, i) => {
      const x = a.x + (i % cols) * (cw + gap), y = a.y + Math.floor(i / cols) * (ch + 4);
      const own = !!m.ach[ac.id];
      card(x, y, cw, ch, own, '#ffd54f');
      ctx.textAlign = 'left';
      fitText(ac.name, x + 8, y + ch * 0.32, cw - 60, 12, { weight: 'bold', color: own ? '#ffd54f' : '#c8d0e0' });
      const have = Math.min(ac.n, m.stats[ac.stat] || 0);
      fitText(own ? ac.desc : `${ac.desc} (${have} / ${ac.n})`, x + 8, y + ch * 0.72, cw - 16, 10, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText('+' + ac.rp, x + cw - 8, y + ch * 0.32, 40, 11, { color: '#b48aff' });
    });
  }

  function drawSkins(a, m) {
    const cols = a.w > 600 ? 5 : 4, gap = 6;
    const rows = Math.ceil(Q.SKINS.length / cols);
    const cw = (a.w - (cols - 1) * gap) / cols, ch = Math.min(118, (a.h - (rows - 1) * gap) / rows);
    Q.SKINS.forEach((s, i) => {
      const x = a.x + (i % cols) * (cw + gap), y = a.y + Math.floor(i / cols) * (ch + gap);
      const own = Q.ownsSkin(m, s.id), on = m.skins.equipped === s.id;
      card(x, y, cw, ch, own, on ? '#ffd75a' : (s.mat || '#a0a8b8'));
      // a stone swatch with its trim
      const sw = Math.min(cw - 20, ch - 46);
      roundRectPath(x + cw / 2 - sw / 2, y + 8, sw, sw * 0.55, 5);
      ctx.fillStyle = own ? (s.mat || '#8a8f9c') : 'rgba(120,130,150,0.25)';
      ctx.fill();
      ctx.fillStyle = own ? (s.trim || '#e0b030') : 'rgba(200,200,220,0.2)';
      ctx.fillRect(x + cw / 2 - sw / 2 + 4, y + 8 + sw * 0.18, sw - 8, 3);
      ctx.textAlign = 'center';
      fitText(s.name, x + cw / 2, y + ch - 32, cw - 8, 12, { weight: 'bold', color: own ? '#e4eaf6' : '#8a93a8' });
      if (own) uiButton('goals-skin-' + s.id, x + 8, y + ch - 22, cw - 16, 18, on ? 'Equipped' : 'Equip', { px: 11, style: on ? 'gold' : 'dark',
        onClick: () => { if (NS.deeds.equip(s.id)) audio.play('select'); } });
      else fitText(Q.skinUnlockText(s.id), x + cw / 2, y + ch - 13, cw - 8, 10, { color: UI.textDim });
    });
  }

  function drawDaily(a, m) {
    const r = NS.deeds.todaysSiege();
    const map = MAPS[r.map], biome = BIOMES[map.biome];
    let y = a.y + 10;
    ctx.textAlign = 'left';
    fitText('Today\'s Daily Siege  ·  the same map and twist for everyone, all day', a.x, y, a.w, 13, { weight: 'bold', color: UI.gold });
    y += 30;
    card(a.x, y, a.w, 120, true, biome.color);
    fitText(map.name, a.x + 16, y + 24, a.w - 32, 22, { weight: 'bold', color: '#ffffff' });
    fitText(biome.name, a.x + 16, y + 50, a.w - 32, 13, { color: biome.color });
    fitText('Twist: ' + r.twist.name + '  -  ' + r.twist.text, a.x + 16, y + 76, a.w - 32, 13, { weight: 'bold', color: '#ff7ad8' });
    const best = m.daily.day === r.day ? m.daily.best : 0;
    fitText(best ? 'Your best today: wave ' + best : 'Not played today yet', a.x + 16, y + 100, a.w - 32, 12, { color: UI.textDim });
    y += 136;
    uiButton('goals-daily-play', a.x + a.w / 2 - 110, y, 220, 40, 'Start the Daily Siege', { px: 14, style: 'gold', onClick: () => { G.overlay = null; NS.deeds.startDaily(); } });
    y += 56;
    ctx.textAlign = 'center';
    fitText('Holding a wave counts it as played; the furthest wave of the day is kept. Stars and research work as on any map.', a.x + a.w / 2, y, a.w - 20, 11, { color: UI.textDim });
  }

  /* unlock toasts: a short stack in the top-right corner */
  function drawGoalToasts() {
    if (!G.goalToasts || !G.goalToasts.length) return;
    const w = Math.min(320, G.UW - 24);
    let y = 64;
    for (const t of G.goalToasts) {
      const a = Math.min(1, t.t * 4, (4.5 - t.t) * 2);
      if (a <= 0) continue;
      const x = G.UW - w - 12 + (1 - Math.min(1, t.t * 4)) * 40;
      ctx.save();
      ctx.globalAlpha = a;
      roundRectPath(x, y, w, 42, 8);
      ctx.fillStyle = 'rgba(8,10,20,0.9)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = t.color;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(t.title, x + 10, y + 14, w - 20, 12, { weight: 'bold', color: t.color });
      fitText(t.sub, x + 10, y + 30, w - 20, 11, { color: '#d8e0f0' });
      ctx.restore();
      y += 48;
    }
  }

  NS.goalsPanel = { openGoals, drawGoals, drawGoalToasts, close };
})();
