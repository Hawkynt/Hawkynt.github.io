/* The story map: the five districts as tabs over their backdrop, the six stages of the chosen district
   as stops on a glowing track (cleared, open, locked, the duel at the end), and the chosen stage's
   card - song, tempo, difficulty, the note kind it teaches, its three stars with the bonus goal,
   the best score - with the booster picker and Play. In the Remix Tour the same map plays the Remix
   charts with their mutators and remix stars. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const WD = NS.worldData;
  const SE = NS.seasons;
  const { UI } = C;
  const { ctx } = NS.view;

  const TEACH = { tap: 'Taps', hold: 'Holds: keep the key down to the tail', chord: 'Chords: two lanes at once', hush: 'Hush notes: do not press the dark ones', drift: 'Drift notes: they slide over before the line' };

  function worldOpen(w) {
    return w === 0 || P.cleared(G.profile, WD.WORLDS[w - 1].id + '-6');
  }

  function stagePos(s) {
    return { x: 120 + s * 150, y: 380 + Math.sin(s * 1.3) * 70 };
  }

  function draw() {
    const p = G.profile;
    const remix = !!G.ui.remix;
    const w = G.ui.world;
    kit.text(remix ? 'REMIX TOUR' : 'HUSH CITY', 40, 40, 30, '#ffffff', { weight: 'bold', shadow: true });
    kit.text(remix ? P.starsTotal(p, true) + ' / 90 remix stars' : P.starsTotal(p) + ' / 90 stars', 40, 72, 15, UI.gold, { weight: 'bold' });
    for (let i = 0; i < 5; ++i) {
      const open = worldOpen(i);
      W.button('w-' + i, WD.WORLDS[i].name, 300 + i * 192, 18, 184, 46, { px: 14, accent: WD.WORLDS[i].color, selected: i === w, disabled: !open, sub: open ? WD.WORLDS[i].teach === 'tap' ? 'taps' : WD.WORLDS[i].teach + 's' : 'locked',
        action: () => { G.ui.world = i; G.ui.stage = firstOpen(i); } });
    }
    /* the track */
    const W0 = WD.WORLDS[w];
    ctx.save();
    ctx.strokeStyle = K.rgba(W0.color, 0.5);
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let s = 0; s < 6; ++s) { const q = stagePos(s); ctx[s ? 'lineTo' : 'moveTo'](q.x, q.y); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(W0.glow, 0.5 + 0.3 * Math.sin(G.time * 3));
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    for (let s = 0; s < 6; ++s) {
      const st = WD.STAGES[w * 6 + s];
      const q = stagePos(s);
      const open = worldOpen(w) && P.stageOpen(p, st.index) && (!remix || P.cleared(p, st.id));
      const sel = G.ui.stage === s;
      const r = st.boss ? 44 : 34;
      const hot = W.area('st-' + s, q.x - r, q.y - r, r * 2, r * 2, open ? () => { G.ui.stage = s; } : null, { disabled: !open });
      if (sel || hot) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; K.blit(ctx, K.glow(W0.color), q.x, q.y, 1.2); ctx.restore(); }
      K.circle(ctx, q.x, q.y, r, open ? (sel ? W0.color : '#1a1030') : '#100a18');
      ctx.lineWidth = 3;
      ctx.strokeStyle = open ? W0.color : '#3a3050';
      ctx.stroke();
      if (st.boss) kit.icon('skull', q.x, q.y - 4, 30, open ? '#ffffff' : '#5a5070');
      else kit.text(String(s + 1), q.x, q.y - 2, 24, open ? '#ffffff' : '#5a5070', { align: 'center', weight: 'bold' });
      if (!open) kit.lock(q.x + r - 6, q.y - r + 8, 16);
      kit.stars(P.starsOf(p, st.id, remix), q.x, q.y + r + 16, 13);
      kit.fitText(st.name, q.x, q.y - r - 14, 150, 13, { align: 'center', color: open ? '#ffffff' : UI.textMute, weight: 'bold' });
    }
    card(WD.STAGES[w * 6 + G.ui.stage], remix);
    W.button('back', 'Back', 40, 650, 200, 48, { icon: 'back', accent: UI.good, action: () => { G.ui.remix = false; NS.screens.back(); } });
  }

  function firstOpen(w) {
    let last = 0;
    for (let s = 0; s < 6; ++s) if (P.stageOpen(G.profile, w * 6 + s)) last = s;
    return last;
  }

  const charts = {};
  function card(st, remix) {
    const p = G.profile;
    const x = 960, y = 90, w = 300, h = 600;
    const W0 = WD.WORLDS[st.world];
    kit.panel(x, y, w, h, { accent: W0.color });
    kit.fitText(st.name, x + 20, y + 30, w - 40, 24, { weight: 'bold', color: '#ffffff' });
    const chart = charts[st.id] || (charts[st.id] = WD.stageChart(st));
    kit.text(W0.name + ' - ' + (st.boss ? 'Duel' : 'Stage ' + (st.stage + 1)) + ' - ' + Math.round(chart.bpm) + ' bpm', x + 20, y + 56, 12, UI.textDim);
    kit.text('Difficulty', x + 20, y + 84, 12, UI.textDim, { weight: 'bold' });
    const lvl = Math.max(1, Math.round(WD.stageLevel(st) * 10 + (remix ? 1.4 : 0)));
    for (let i = 0; i < 10; ++i) { ctx.fillStyle = i < lvl ? (i < 4 ? UI.good : i < 7 ? UI.gold : UI.bad) : 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 100 + i * 17, y + 77, 13, 14); }
    kit.text(chart.count + ' notes - ' + Math.round(chart.length) + ' s', x + 20, y + 108, 12, UI.textDim);
    kit.wrap(TEACH[W0.teach] + (st.boss ? ' - ' + st.boss.name + ': ' + st.boss.attacks.map(a => WD.ATTACKS[a].name).join(', ') : ''), x + 20, y + 132, w - 40, 13, '#ffffff');
    const got = (remix ? p.remix : p.stars)[st.id] || [false, false, false];
    const goals = ['Clear the song', 'Grade A or better', st.goalText];
    for (let i = 0; i < 3; ++i) {
      kit.icon('star', x + 30, y + 214 + i * 26, 16, got[i] ? UI.gold : 'rgba(120,130,160,0.5)');
      kit.fitText(goals[i], x + 48, y + 215 + i * 26, w - 70, 13, { color: got[i] ? UI.gold : '#ffffff' });
    }
    const best = p.best[(remix ? 'remix:' : 'story:') + st.id];
    kit.text(best ? 'Best ' + best.score.toLocaleString('en-US') + '  ' + best.grade + (best.fc ? '  FC' : '') : 'Not played yet', x + 20, y + 304, 14, best ? '#ffffff' : UI.textDim, { weight: 'bold' });
    if (remix) {
      const muts = SE.pickTwo(NS.rng.makeRng(NS.rng.hashString('remix-' + st.id)));
      kit.fitText('Remix: ' + muts.map(id => SE.MUT_BY_ID[id].name).join(' + '), x + 20, y + 328, w - 40, 13, { color: '#ff7ad8', weight: 'bold' });
    }
    NS.library.boosterRow(x + 16, y + 350, w - 32);
    W.button('play', remix ? 'Play Remix' : 'Play', x + 20, y + h - 70, w - 40, 54, { icon: 'play', accent: UI.gold, px: 22,
      action: () => NS.play.start(remix ? 'remix' : 'story', { stage: st.id, boosters: G.ui.boosters }) });
  }

  Object.assign(NS.map, { worldOpen, stagePos, draw, card, firstOpen });
})();
