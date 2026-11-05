/* The end of a run: the outcome headline, stars popping in one by one for story levels, the score
   counting up with a high-score badge, the run's numbers, the scales earned, and the way on -
   next level, retry, the map or title, and the tech tree. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { WORLDS, LEVELS_PER_WORLD } = NS.worlds;
  const { MODES } = NS.items;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const fx = NS.fx;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  let lastStar = -1;

  function headline(r) {
    if (r.mode === 'story') return r.cleared ? (r.boss ? 'GUARDIAN FREED!' : 'LEVEL CLEAR!') : r.outcome === 'quit' ? 'RUN ENDED' : 'OUT OF LIVES';
    if (r.mode === 'rush') return r.cleared ? 'RUSH CLEARED!' : 'RUSH OVER';
    if (r.mode === 'zen') return 'WELL RESTED';
    if (r.outcome === 'time') return 'TIME!';
    return r.outcome === 'quit' ? 'RUN ENDED' : 'GAME OVER';
  }

  function next() {
    const r = G.ui.results;
    let w = r.w, l = r.l + 1;
    if (l >= LEVELS_PER_WORLD) { w += 1; l = 0; }
    if (w >= WORLDS.length) { scr.setScreen('map'); return; }
    G.ui.mapWorld = w;
    G.ui.mapSel = l;
    NS.run.storyEntry(w, l);
  }

  function retry() {
    const r = G.ui.results;
    switch (r.mode) {
      case 'story': NS.run.storyEntry(r.w, r.l); break;
      case 'arcade': NS.run.startArcade(); break;
      case 'zen': NS.run.startZen(); break;
      case 'time': NS.run.startTime(); break;
      case 'daily': NS.run.startDaily(); break;
      case 'rush': NS.run.startRush(); break;
    }
  }

  function draw() {
    const r = G.ui.results;
    if (!r) return;
    const v = NS.view.visible();
    const t = G.screenT;
    ctx.fillStyle = 'rgba(2,8,4,0.72)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const good = r.cleared || r.mode === 'zen' || r.high;
    const pop = NS.rng.easeOutBack(Math.min(1, t * 2.5));
    NS.hud.bigText(headline(r), 64, good ? UI.gold : '#ffffff', pop, 120);
    const x = 340, y = 150, w = 600, h = 470;
    kit.panel(x, y + 30, w, h - 30, { accent: good ? UI.gold : UI.accent, glow: good, alpha: Math.min(1, t * 3) });
    const name = r.mode === 'story' ? WORLDS[r.w].name + '  ' + (r.w + 1) + '-' + (r.l + 1) + '  ' + WORLDS[r.w].levels[r.l].name : MODES[r.mode].name;
    kit.fitText(name, 640, y + 60, w - 60, 17, { color: UI.textDim, align: 'center' });
    let yy = y + 104;
    if (r.stars) {
      for (let s = 0; s < 3; ++s) {
        const st = 0.5 + s * 0.35;
        const k = Math.min(1, Math.max(0, (t - st) * 4));
        if (k > 0 && lastStar < s && r.stars[s]) {
          lastStar = s;
          fx.burst(560 + s * 80, yy, 24, ['#ffd25a', '#ffffff'], 260, 0.6, 8, fx.STAR);
          sfx('coin', { pitch: 1 + s * 0.2 });
        }
        ctx.save();
        ctx.translate(560 + s * 80, yy);
        const sc = r.stars[s] ? NS.rng.easeOutBack(k) : 1;
        ctx.scale(sc, sc);
        kit.star(0, 0, 30, r.stars[s] && k > 0);
        ctx.restore();
      }
      const lab = ['Cleared', 'Eggs ' + (r.eggs || 0) + '/' + (r.eggTotal || 3), r.deaths ? r.deaths + ' crash' + (r.deaths > 1 ? 'es' : '') : 'No crash'];
      for (let s = 0; s < 3; ++s) kit.text(lab[s], 560 + s * 80, yy + 44, 12, r.stars[s] ? UI.gold : UI.textMute, { align: 'center' });
      if (r.newStars) kit.text('+' + r.newStars + ' new', 800, yy, 15, UI.good, { weight: 'bold' });
      yy += 86;
    }
    const shown = Math.floor(r.score * Math.min(1, t / 1.2));
    kit.text(String(shown), 640, yy, 46, '#ffffff', { align: 'center', weight: 'bold' });
    if (r.high && t > 1.2) kit.text('NEW HIGH SCORE!', 640, yy + 36, 18, UI.gold, { align: 'center', weight: 'bold' });
    if (r.mode === 'daily' && r.prevBest !== undefined) kit.text(r.score > r.prevBest ? 'New best today!' : 'Today\'s best: ' + r.prevBest, 640, yy + 36, 15, UI.textDim, { align: 'center' });
    yy += 64;
    const rows = [['Longest', r.length], ['Best combo', r.combo], ['Critters', r.kills], ['Tokens', r.tokens]];
    if (r.stage) rows.push(['Stage', r.stage]);
    for (let k = 0; k < rows.length; ++k) {
      const cx = 640 + (k - (rows.length - 1) / 2) * 110;
      kit.text(String(rows[k][1]), cx, yy, 22, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(rows[k][0], cx, yy + 22, 12, UI.textDim, { align: 'center' });
    }
    yy += 58;
    const sc = Math.floor(r.scales * Math.min(1, Math.max(0, t - 0.8) / 0.8));
    kit.credits('+' + sc + ' scales', 640, yy, 22, 'center');
    const by = y + h - 70;
    const buttons = [];
    if (r.mode === 'story' && r.cleared && !(r.w === WORLDS.length - 1 && r.l === LEVELS_PER_WORLD - 1)) buttons.push(['next', 'Next Level', next, UI.good]);
    buttons.push(['retry', r.mode === 'story' ? 'Replay' : 'Again', retry, UI.accent]);
    buttons.push([r.mode === 'story' ? 'map' : 'title', r.mode === 'story' ? 'World Map' : 'Title', () => scr.setScreen(r.mode === 'story' ? 'map' : 'title'), UI.accent]);
    buttons.push(['tree', 'Tech Tree', () => scr.open('tree', 'results'), UI.gold]);
    const bw = (w - 40 - (buttons.length - 1) * 10) / buttons.length;
    for (let k = 0; k < buttons.length; ++k)
      W.button(buttons[k][0], buttons[k][1], x + 20 + k * (bw + 10), by, bw, 50, { px: 17, accent: buttons[k][3], action: buttons[k][2] });
    NS.fxRender.draw(1);
  }

  function reset() {
    lastStar = -1;
  }

  Object.assign(NS.results, {
    draw, next, retry, reset
  });
})();
