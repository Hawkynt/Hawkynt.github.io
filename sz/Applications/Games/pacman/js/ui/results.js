/* The end of a run: victory or game over, the score counting up with a new-record or table-rank
   badge, the run's tallies appearing one by one, the shards it paid, and where to go next
   (again, the story map or retry the stage, the tech tree, the title). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { MODES } = NS.items;
  const { WORLDS } = NS.worlds;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  let ticks = 0;

  function again(r) {
    if (r.mode === 'story') scr.launchStory(r.world, Math.min(r.stage, 4));
    else scr.launch(r.mode);
  }

  function draw() {
    const r = G.ui.results;
    if (!r) { scr.setScreen('title'); return; }
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,2,14,0.78)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const mode = MODES.find(m => m.id === r.mode);
    const x = 300, y = 60, w = 680, h = 580;
    kit.panel(x, y, w, h, { accent: r.won ? UI.gold : mode.color, glow: true });
    const k = NS.rng.easeBack(Math.min(1, r.t * 2));
    ctx.save();
    ctx.translate(640, y + 54);
    ctx.scale(k, k);
    kit.text(r.won ? (r.mode === 'story' ? 'PAC-LAND RESTORED!' : 'VICTORY!') : r.mode === 'story' ? 'CAUGHT!' : 'GAME OVER', 0, 0, 40, r.won ? UI.gold : '#ffffff', { align: 'center', weight: 'bold' });
    ctx.restore();
    const where = r.mode === 'story' ? WORLDS[Math.min(r.world, 4)].name + ' ' + (r.world + 1) + '-' + (Math.min(r.stage, 4) + 1) : 'Maze ' + (r.n + 1);
    kit.text(mode.name + '  -  ' + where, 640, y + 96, 16, UI.textDim, { align: 'center' });
    const shown = Math.floor(r.score * Math.min(1, r.t / 1.2));
    if (r.t < 1.2 && Math.floor(r.t * 30) !== ticks) { ticks = Math.floor(r.t * 30); if (ticks % 2 === 0) sfx('click', { pitch: 1.5, volume: 0.25 }); }
    kit.text(kit.group(shown), 640, y + 150, 56, UI.accent, { align: 'center', weight: 'bold' });
    if (r.t > 1.3 && (r.record || r.rank >= 0)) {
      const label = r.record ? 'NEW BEST!' : 'High score #' + (r.rank + 1);
      const s = 1 + Math.sin(G.time * 6) * 0.05;
      ctx.save(); ctx.translate(640, y + 196); ctx.scale(s, s);
      ctx.font = kit.font(16, 'bold');
      kit.chip(label, -(ctx.measureText(label).width + 22.4) / 2, 0, UI.good, 16);
      ctx.restore();
    }
    const T = r.tally;
    const rows = [['Mazes cleared', T.mazes], ['Dots eaten', T.dots], ['Ghosts eaten', T.ghosts], ['Power-ups', T.powerups],
      ['Fruit', T.fruits], ['Bosses', T.bosses], ['Seasonal tokens', T.tokens], ['Longest chain', r.bestChain], ['Time', kit.time(r.time)]];
    for (let i = 0; i < rows.length; ++i) {
      const a = Math.min(1, Math.max(0, (r.t - 0.8 - i * 0.08) * 4));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      const col = i % 2, row = Math.floor(i / 2);
      const rx = x + 60 + col * 300, ry = y + 236 + row * 40;
      kit.text(rows[i][0], rx, ry, 15, UI.textDim);
      kit.text(typeof rows[i][1] === 'number' ? kit.group(rows[i][1]) : rows[i][1], rx + 250, ry, 17, '#ffffff', { align: 'right', weight: 'bold' });
    }
    ctx.globalAlpha = Math.min(1, Math.max(0, (r.t - 1.6) * 3));
    kit.text('SHARDS EARNED', 640, y + 448, 13, UI.textMute, { align: 'center', weight: 'bold' });
    kit.shards(r.shards, 640, y + 478, 30, 'center');
    ctx.globalAlpha = 1;
    const by = y + h - 70;
    if (r.mode === 'story' && !r.won) {
      W.button('retry', 'Retry stage', x + 30, by, 200, 48, { icon: 'play', accent: UI.good, action: () => again(r) });
      W.button('map', 'World map', x + 240, by, 200, 48, { icon: 'map', action: () => scr.setScreen('map') });
    } else if (r.mode === 'story') {
      W.button('map', 'World map', x + 30, by, 200, 48, { icon: 'map', accent: UI.good, action: () => scr.setScreen('map') });
      W.button('again', 'Arcade', x + 240, by, 200, 48, { icon: 'joystick', action: () => scr.launch('arcade') });
    } else {
      W.button('again', 'Play again', x + 30, by, 200, 48, { icon: 'play', accent: UI.good, action: () => again(r) });
      W.button('tree', 'Tech Tree', x + 240, by, 200, 48, { icon: 'tree', action: () => scr.openTree('results') });
    }
    W.button('title', 'Title', x + 450, by, 200, 48, { icon: 'back', action: () => leave() });
    K.blit(ctx, NS.actorArt.pac(G.profile.skin, NS.actorArt.mouthIndex(G.time * (r.won ? 8 : 2))), x + 70, y + 58, 1.3);
  }

  function leave() {
    G.ui.results = null;
    scr.setScreen('title');
  }

  Object.assign(NS.results, {
    draw, leave
  });
})();
