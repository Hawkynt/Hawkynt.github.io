/* The goals screen in five tabs: today's quests with the play streak and the daily challenge;
   the season's event track with its eight reward tiers and the season calendar; achievements;
   lifetime records; and the high-score table with personal bests. Reads G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ACHIEVEMENTS, QUESTS, STAT_LINES } = NS.goalData;
  const { MODES } = NS.campaign;
  const S = NS.seasons;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const hud = NS.hud;
  const { ctx } = NS.view;

  const TABS = [['quests', 'Daily', 'calendar'], ['season', 'Season', 'snow'], ['ach', 'Achievements', 'trophy'], ['stats', 'Records', 'book'], ['scores', 'High Scores', 'star']];

  function draw() {
    kit.text('GOALS', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.credits(G.save.dust, 1220, 44, 24, 'right');
    for (let i = 0; i < TABS.length; ++i) {
      const tb = TABS[i];
      const on = G.ui.goalsTab === tb[0];
      W.button('tab' + i, tb[1], 60 + i * 200, 86, 190, 40, { action: () => { G.ui.goalsTab = tb[0]; }, icon: tb[2], accent: on ? UI.gold : UI.accent, px: 15 });
      if (on) {
        ctx.fillStyle = UI.gold;
        ctx.fillRect(70 + i * 200, 128, 170, 3);
      }
    }
    switch (G.ui.goalsTab) {
      case 'quests': quests(); break;
      case 'season': season(); break;
      case 'ach': achievements(); break;
      case 'stats': stats(); break;
      case 'scores': scores(); break;
    }
    W.button('back', G.returns.goals === 'paused' ? 'Back to pause' : 'Back', 60, 650, 240, 46, { action: () => scr.back('goals'), icon: 'back' });
  }

  function quests() {
    const sv = G.save;
    kit.text('Three new quests every day at local midnight. Rewards are paid the moment a quest is done.', 60, 160, 14, UI.textDim);
    const qs = sv.daily.quests;
    for (let i = 0; i < qs.length; ++i) {
      const q = qs[i];
      const def = QUESTS.find(d => d.id === q.id);
      if (!def) continue;
      const x = 60 + i * 390, y = 186;
      kit.panel(x, y, 370, 150, { accent: q.done ? UI.good : UI.accent, glow: q.done });
      kit.text('QUEST ' + (i + 1), x + 20, y + 24, 12, UI.textDim, { weight: 'bold' });
      kit.wrap(def.text.replace('{n}', hud.fmt(q.goal)), x + 20, y + 44, 330, 20, 26, '#ffffff', { weight: 'bold' });
      kit.bar(x + 20, y + 100, 330, 10, q.p / q.goal, q.done ? UI.good : UI.accent, { cells: 10 });
      kit.text(hud.fmt(q.p) + ' / ' + hud.fmt(q.goal), x + 20, y + 126, 13, UI.textDim);
      kit.text(q.done ? 'Complete' : '+' + q.dust + ' stardust', x + 350, y + 126, 13, q.done ? UI.good : '#bfe8ff', { align: 'right', weight: 'bold' });
    }
    /* streak */
    const st = sv.streak;
    kit.panel(60, 356, 560, 270, { accent: '#ffb04a' });
    kit.text('PLAY STREAK', 80, 384, 14, '#ffb04a', { weight: 'bold' });
    kit.text(st.count ? st.count + (st.count === 1 ? ' day' : ' days') : 'No streak yet', 80, 420, 34, '#ffffff', { weight: 'bold' });
    kit.text('Best ' + st.best + ' days  -  the first run each day pays 40 stardust per streak day (up to 7)', 80, 452, 12, UI.textDim);
    for (let d = 0; d < 7; ++d) {
      const x = 110 + d * 70, y = 520;
      const lit = d < Math.min(7, st.count);
      ctx.fillStyle = lit ? '#ffb04a' : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, TAU);
      ctx.fill();
      NS.propArt.icon(ctx, 'flame', x, y, 24, lit ? '#ffffff' : UI.textMute);
      kit.text('+' + 40 * (d + 1), x, y + 40, 12, lit ? '#ffb04a' : UI.textMute, { align: 'center' });
    }
    /* daily challenge */
    const ds = G.cal.daily;
    kit.panel(640, 356, 580, 270, { accent: '#ff9a3a' });
    kit.text('DAILY CHALLENGE  -  ' + ds.key, 660, 384, 14, '#ff9a3a', { weight: 'bold' });
    for (let i = 0; i < ds.mods.length; ++i) {
      const m = NS.powerData.MODIFIERS[ds.mods[i]];
      kit.text(m.name, 660, 424 + i * 52, 20, '#ffffff', { weight: 'bold' });
      kit.text(m.desc, 660, 446 + i * 52, 13, UI.textDim);
    }
    const best = sv.best.daily.key === ds.key ? sv.best.daily.score : 0;
    kit.text('One ship. Same field for everyone today.  Your best today: ' + hud.fmt(best), 660, 540, 13, UI.text);
    W.button('daily', 'Fly the Daily', 660, 562, 240, 46, { action: () => { scr.setScreen('title'); NS.title.startMode('daily'); }, accent: '#ff9a3a', icon: 'play' });
  }

  function season() {
    const sd = G.cal.seasonDef;
    const se = NS.save.seasonEntry();
    const tier = S.tierFor(se.tokens);
    K.blit(ctx, NS.propArt.token(G.cal.season), 100, 190, 2);
    kit.text(sd.name.toUpperCase(), 150, 178, 30, '#ffffff', { weight: 'bold' });
    kit.text(sd.blurb, 150, 208, 14, UI.textDim);
    kit.text(se.tokens + ' ' + sd.tokenName.toLowerCase() + ' collected', 1220, 178, 18, sd.tokenCol, { align: 'right', weight: 'bold' });
    /* the track */
    const x0 = 100, x1 = 1180, y = 330;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const prev = tier ? S.TRACK[tier - 1] : 0;
    const next = S.TRACK[Math.min(tier, S.TRACK.length - 1)];
    const frac = tier >= S.TRACK.length ? 1 : (tier + (se.tokens - prev) / (next - prev)) / S.TRACK.length;
    ctx.strokeStyle = sd.tokenCol;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (x1 - x0) * frac, y);
    ctx.stroke();
    for (let t = 1; t <= S.TRACK.length; ++t) {
      const x = x0 + (x1 - x0) * t / S.TRACK.length;
      const got = tier >= t;
      const rw = S.trackReward(G.cal.season, t);
      ctx.fillStyle = got ? sd.tokenCol : '#1a2030';
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = got ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const ic = rw.kind === 'skin' ? 'skin' : rw.kind === 'trail' ? 'trail' : rw.kind === 'shot' ? 'shot' : rw.kind === 'badge' ? 'trophy' : 'dust';
      NS.propArt.icon(ctx, ic, x, y, 22, got ? '#ffffff' : UI.textDim);
      kit.text(String(S.TRACK[t - 1]), x, y - 38, 13, got ? sd.tokenCol : UI.textDim, { align: 'center', weight: 'bold' });
      kit.fitText(NS.progress.rewardText(rw), x, y + 42, 128, 11, { align: 'center', color: got ? '#ffffff' : UI.textDim });
    }
    kit.text('Seasonal rocks appear in every mode while the season lasts. Each season keeps its own track every year.', 640, 420, 14, UI.text, { align: 'center' });
    /* the calendar */
    const cal = [['winter', 'Dec - Feb'], ['yearend', 'Dec 20 - Jan 6'], ['spring', 'Mar - May'], ['summer', 'Jun - Aug'], ['autumn', 'Sep - Nov'], ['halloween', 'Oct 20 - Nov 2']];
    for (let i = 0; i < cal.length; ++i) {
      const s = S.SEASONS[cal[i][0]];
      const x = 80 + i * 190, yy = 470;
      const now = G.cal.season === cal[i][0];
      kit.panel(x, yy, 180, 120, { accent: now ? s.accent : '#4a5470', glow: now });
      K.blit(ctx, NS.propArt.token(cal[i][0]), x + 90, yy + 34, 1.1);
      kit.fitText(s.name, x + 90, yy + 70, 164, 14, { align: 'center', weight: 'bold', color: now ? '#ffffff' : UI.textDim });
      kit.text(cal[i][1], x + 90, yy + 92, 12, UI.textMute, { align: 'center' });
      if (now) kit.text('NOW', x + 90, yy + 110, 11, s.accent, { align: 'center', weight: 'bold' });
    }
  }

  function achievements() {
    const sv = G.save;
    const n = Object.keys(sv.ach).length;
    kit.text(n + ' of ' + ACHIEVEMENTS.length + ' earned', 60, 160, 14, UI.textDim);
    const cols = 5, cw = 226, ch = 62;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      const x = 60 + (i % cols) * (cw + 6), y = 176 + Math.floor(i / cols) * (ch + 5);
      const got = !!sv.ach[a.id];
      const hot = W.area('a' + i, x, y, cw, ch, null);
      kit.panel(x, y, cw, ch, { accent: got ? UI.gold : '#3a4460', radius: 6, brackets: false, glow: hot });
      NS.propArt.icon(ctx, a.icon, x + 24, y + ch / 2, 24, got ? UI.gold : UI.textMute);
      kit.fitText(a.name, x + 44, y + 18, cw - 54, 13, { weight: 'bold', color: got ? '#ffffff' : UI.textDim });
      if (hot || !got) {
        const v = Math.min(a.goal, rules.statValue(sv, a.stat));
        kit.fitText(hot ? a.desc : hud.fmt(v) + ' / ' + hud.fmt(a.goal), x + 44, y + 38, cw - 54, 11, { color: UI.textDim });
        if (!got) kit.bar(x + 44, y + 50, cw - 58, 3, v / a.goal, UI.accent);
      } else kit.fitText('+' + a.dust + ' stardust', x + 44, y + 40, cw - 54, 11, { color: UI.gold });
    }
  }

  function stats() {
    const st = G.save.stats;
    for (let i = 0; i < STAT_LINES.length; ++i) {
      const l = STAT_LINES[i];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 80 + col * 580, y = 172 + row * 40;
      let v = st[l[0]] || 0;
      if (l[0] === 'bestStreak') v = G.save.streak.best;
      const txt = l[2] === 'time' ? Math.floor(v / 3600) + 'h ' + Math.floor(v / 60) % 60 + 'm' : l[2] === 'km' ? hud.fmt(v) : hud.fmt(v);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x - 12, y - 16, 540, 32);
      kit.text(l[1], x, y, 15, UI.textDim);
      kit.text(txt, x + 520, y, 16, '#ffffff', { align: 'right', weight: 'bold' });
    }
  }

  function scores() {
    const sv = G.save;
    kit.panel(60, 150, 700, 480, { accent: UI.gold });
    kit.text('#', 90, 180, 13, UI.textDim, { weight: 'bold' });
    kit.text('Score', 300, 180, 13, UI.textDim, { weight: 'bold', align: 'right' });
    kit.text('Wave', 380, 180, 13, UI.textDim, { weight: 'bold', align: 'right' });
    kit.text('Mode', 420, 180, 13, UI.textDim, { weight: 'bold' });
    kit.text('Date', 600, 180, 13, UI.textDim, { weight: 'bold' });
    for (let i = 0; i < 10; ++i) {
      const e = sv.highScores[i];
      const y = 216 + i * 40;
      kit.text(String(i + 1), 90, y, 16, i < 3 ? UI.gold : UI.textDim, { weight: 'bold' });
      if (!e) { kit.text('-', 300, y, 15, UI.textMute, { align: 'right' }); continue; }
      kit.text(hud.fmt(e.score), 300, y, 17, '#ffffff', { align: 'right', weight: 'bold' });
      kit.text(String(e.wave || '-'), 380, y, 15, UI.text, { align: 'right' });
      kit.text(e.legacy ? e.legacy + ' (classic)' : MODES[e.mode] ? MODES[e.mode].name : e.mode, 420, y, 15, UI.text);
      kit.text(e.date || '', 600, y, 13, UI.textDim);
    }
    const bx = 790;
    kit.panel(bx, 150, 430, 480, { accent: UI.accent });
    kit.text('PERSONAL BESTS', bx + 20, 180, 14, UI.accent, { weight: 'bold' });
    const rows = [['Arcade', sv.best.arcade], ['Daily (today)', sv.best.daily.key === G.cal.day ? sv.best.daily.score : 0], ['Boss Rush', sv.best.rush], ['Zen', sv.best.zen],
      ['Best combo', sv.stats.bestCombo], ['Best Arcade wave', sv.stats.arcadeWave], ['Story stars', rules.totalStars(sv) + ' / 90']];
    for (let i = 0; i < rows.length; ++i) {
      const y = 220 + i * 46;
      kit.text(rows[i][0], bx + 20, y, 15, UI.textDim);
      kit.text(typeof rows[i][1] === 'number' ? hud.fmt(rows[i][1]) : rows[i][1], bx + 410, y, 18, '#ffffff', { align: 'right', weight: 'bold' });
    }
  }

  Object.assign(NS.goals, {
    draw, TABS
  });
})();
