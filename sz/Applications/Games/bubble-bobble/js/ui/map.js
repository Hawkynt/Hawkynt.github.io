/* The story map: the five realms as tabs over their own backdrop (locked until the guardian
   before is beaten), six stage stones along a winding path with their stars, the guardian's
   stone crowned, and the chosen stage's card - objective, gravity level, par time, the bonus goal,
   best time and Play. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const { UI, TAU } = C;
  const { WORLDS, STAGES } = NS.worldData;
  const { ctx } = NS.view;

  const PATH = [[150, 560], [330, 470], [250, 330], [470, 270], [640, 380], [760, 200]];

  function worldOpen(w) {
    return P.stageOpen(G.profile, w * 6);
  }

  function draw() {
    const p = G.profile;
    const w = G.ui.world;
    const world = WORLDS[w];
    kit.text('STORY', 50, 44, 34, '#ffffff', { weight: 'bold', shadow: true });
    for (let i = 0; i < WORLDS.length; ++i) {
      const open = worldOpen(i);
      W.button('w' + i, open ? WORLDS[i].name : '???', 230 + i * 205, 22, 196, 44, { selected: i === w, disabled: !open, px: 14,
        action: () => { G.ui.world = i; G.ui.stage = firstOpen(i); } });
    }
    /* path */
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 8;
    ctx.setLineDash([2, 16]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < PATH.length; ++i) (i ? ctx.lineTo : ctx.moveTo).call(ctx, PATH[i][0], PATH[i][1]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 6; ++i) {
      const st = STAGES[w * 6 + i];
      const open = P.stageOpen(p, w * 6 + i);
      const [x, y] = PATH[i];
      const sel = G.ui.stage === i;
      const boss = st.kind === 'boss';
      const r = boss ? 52 : 40;
      const hot = W.area('st' + i, x - r, y - r, r * 2, r * 2, open ? () => { G.ui.stage = i; } : null, { disabled: !open });
      if (sel || hot) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        K.blit(ctx, K.glow(world.glow), x, y, boss ? 1.6 : 1.2);
        ctx.restore();
      }
      const gr = ctx.createLinearGradient(x, y - r, x, y + r);
      gr.addColorStop(0, open ? K.shade(world.accent, 0.2) : '#4a5068');
      gr.addColorStop(1, open ? K.shade(world.accent, -0.4) : '#1a2030');
      ctx.fillStyle = gr;
      ctx.beginPath();
      if (boss) for (let k = 0; k < 8; ++k) { const a = k / 8 * TAU + Math.PI / 8; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      else ctx.arc(x, y, r, 0, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = sel ? UI.gold : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = sel ? 4 : 2;
      ctx.stroke();
      if (!open) kit.lock(x, y, 22);
      else if (boss) kit.icon('skull', x, y - 4, 40, '#ffffff');
      else kit.text(String(i + 1), x, y - 2, 30, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
      if (open) kit.stars(P.starsOf(p, st.id), x, y + r + 14, 16);
    }
    card(w, G.ui.stage);
    W.button('back', 'Back', 50, 650, 200, 46, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
    NS.title.coopToggle(262, 650, 280, 46);
    kit.text(P.starsTotal(p) + ' / 90 stars', 560, 673, 16, UI.gold, { weight: 'bold' });
  }

  function firstOpen(w) {
    for (let i = 5; i >= 0; --i) if (P.stageOpen(G.profile, w * 6 + i)) return i;
    return 0;
  }

  function kindText(st) {
    return { clear: 'Trap them all', timed: 'Against the clock', boss: 'Guardian fight' }[st.kind];
  }

  function card(w, i) {
    const p = G.profile;
    const st = STAGES[w * 6 + i];
    const open = P.stageOpen(p, w * 6 + i);
    const x = 880, y = 96, wd = 360, h = 520;
    kit.panel(x, y, wd, h, { accent: WORLDS[w].accent });
    kit.text(WORLDS[w].name.toUpperCase() + '  ' + (i + 1) + '/6', x + 20, y + 26, 13, UI.textDim, { weight: 'bold' });
    kit.fitText(st.name, x + 20, y + 62, wd - 40, 30, { weight: 'bold', color: '#ffffff' });
    kit.text(kindText(st), x + 20, y + 96, 15, WORLDS[w].accent, { weight: 'bold' });
    let goal = { clear: 'Trap every enemy in a bubble and pop them all', timed: 'Clear the room before ' + NS.hud.clock(st.time || 0) }[st.kind] || '';
    if (st.kind === 'boss') goal = 'Defeat ' + WORLDS[w].boss.name + ', ' + WORLDS[w].boss.title;
    kit.wrap(goal, x + 20, y + 130, wd - 40, 17, '#ffffff');
    const facts = ['Enemy speed ' + Math.round(st.speed * 100) + '%'];
    if (st.count) facts.push(st.count + ' enemies: ' + st.kinds.map(k => NS.constants.ENEMIES[k].name).join(', '));

    if (st.kind === 'boss') facts.push(WORLDS[w].boss.hp + ' hit points - bubbles hurt, lightning hurts more');
    for (let k = 0; k < facts.length; ++k) kit.text('-  ' + facts[k], x + 20, y + 186 + k * 24, 14, UI.textDim);
    const got = p.stars[st.id] || [false, false, false];
    const lines = ['Finish the stage', 'Finish within ' + NS.hud.clock(st.par), NS.run.bonusText(st.bonus)];
    for (let k = 0; k < 3; ++k) {
      kit.icon('star', x + 30, y + 312 + k * 32, 20, got[k] ? UI.gold : 'rgba(140,150,180,0.6)');
      kit.fitText(lines[k], x + 50, y + 313 + k * 32, wd - 70, 15, { color: got[k] ? UI.gold : '#ffffff' });
    }
    if (p.best[st.id]) kit.text('Best time ' + NS.hud.clock(p.best[st.id]), x + 20, y + 420, 14, UI.good);
    W.button('play', open ? (p.stars[st.id] ? 'Play again' : 'Play') : 'Locked', x + 20, y + h - 72, wd - 40, 54, { icon: 'play', px: 22, accent: UI.gold, disabled: !open,
      action: () => NS.play.start('story', { stage: st.id }) });
  }

  Object.assign(NS.map, { draw, worldOpen, firstOpen, PATH });
})();
