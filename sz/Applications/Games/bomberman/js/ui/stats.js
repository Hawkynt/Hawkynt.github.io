/* Lifetime statistics and records: a grid of totals (enemies, bricks, bombs, power-ups, gems,
   bosses, stages, time played and more), mode records, and the high-score table of each mode
   with a mode switcher. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;

  let mode = 'arcade';

  const ROWS = [
    ['Enemies defeated', 'kills', 'skull'], ['Bricks destroyed', 'blocks', 'bomb'], ['Bombs dropped', 'bombs', 'bomb'],
    ['Power-ups collected', 'powerups', 'star'], ['Gems earned', 'gems', 'gem'], ['Bosses toppled', 'bosses', 'rush'],
    ['Stages cleared', 'levels', 'map'], ['Stars earned', 'stars', 'star'], ['Bombs kicked', 'kicks', 'kick'],
    ['Bombs thrown', 'throws', 'glove'], ['Best chain', 'bestChain', 'chain'], ['Best combo', 'bestCombo', 'fire'],
    ['Seasonal tokens', 'tokens', 'gift'], ['Curses lifted', 'cursePass', 'skull'], ['Runs started', 'runs', 'play'],
    ['Lives lost', 'deaths', 'heart'], ['Daily clears', 'dailyClears', 'daily'], ['Best streak', 'streakBest', 'fire']
  ];

  function fmt(key, v) {
    if (key === 'bestCombo') return 'x' + v;
    return String(Math.floor(v));
  }

  function draw() {
    const save = G.save, s = save.stats;
    kit.dim(G.back.stats === 'paused' ? 0.84 : 0.45);
    kit.text('STATISTICS', 60, 44, 32, '#ffffff', { weight: 'bold', stroke: 6 });
    const pt = Math.floor(s.playTime / 60);
    kit.text('Time played: ' + Math.floor(pt / 60) + 'h ' + (pt % 60) + 'm   -   Rank ' + rules.rankOf(s.xp).name + ' (' + Math.floor(s.xp) + ' xp)', 60, 78, 14, UI.textDim);
    kit.panel(50, 100, 700, 540, { accent: '#6fd3ff' });
    for (let i = 0; i < ROWS.length; ++i) {
      const r = ROWS[i];
      const x = 74 + (i % 2) * 340, y = 132 + Math.floor(i / 2) * 55;
      kit.icon(r[2], x + 14, y, 24, '#6fd3ff');
      kit.text(r[0], x + 36, y - 8, 12, UI.textDim);
      kit.text(fmt(r[1], s[r[1]] || 0), x + 36, y + 11, 20, '#ffffff', { weight: 'bold' });
    }
    /* records */
    kit.panel(770, 100, 460, 540, { accent: UI.gold });
    const modes = [['arcade', 'Arcade'], ['daily', 'Daily'], ['zen', 'Zen'], ['rush', 'Rush']];
    for (let i = 0; i < modes.length; ++i)
      kit.button('m' + modes[i][0], modes[i][1], 790 + i * 108, 116, 100, 36, { px: 14, accent: mode === modes[i][0] ? UI.gold : '#9a8aa0', action: () => { mode = modes[i][0]; } });
    const list = save.scores[mode];
    kit.text('#', 800, 176, 12, UI.textMute, { weight: 'bold' });
    kit.text('SCORE', 840, 176, 12, UI.textMute, { weight: 'bold' });
    kit.text(mode === 'rush' ? 'BOSSES' : 'STAGE', 1000, 176, 12, UI.textMute, { weight: 'bold' });
    kit.text('DATE', 1090, 176, 12, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < C.MAX_SCORES; ++i) {
      const e = list[i];
      const y = 204 + i * 36;
      kit.text(String(i + 1), 800, y, 15, i === 0 ? UI.gold : UI.text, { weight: 'bold' });
      kit.text(e ? String(e.score) : '-', 840, y, 17, e ? '#ffffff' : UI.textMute, { weight: 'bold' });
      kit.text(e ? String(e.stage) : '', 1000, y, 15, UI.textDim);
      kit.text(e ? e.date : '', 1090, y, 13, UI.textDim);
    }
    if (mode === 'rush' && s.rushBest) kit.text('Fastest clear: ' + NS.hud.fmtTime(s.rushBest), 800, 580, 15, UI.gold, { weight: 'bold' });
    if (mode === 'arcade') kit.text('Furthest arena: ' + s.arcadeStage, 800, 580, 15, UI.gold, { weight: 'bold' });
    kit.button('back', G.back.stats === 'paused' ? 'Resume' : 'Back', 50, 656, 220, 46, { icon: 'back', accent: '#9a8aa0', action: () => G.back.stats === 'paused' ? scr.setScreen('playing') : scr.back('stats') });
  }

  Object.assign(NS.stats, {
    draw, setMode: (m) => { mode = m; }
  });
})();
