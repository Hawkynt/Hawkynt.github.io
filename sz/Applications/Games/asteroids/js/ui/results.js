/* The results screen after a story mission or a run: stars popping in one by one, score with a
   new-best flash and table rank, stardust earned, achievements unlocked, and the way on - next
   mission (through the chapter debriefing and finale when a titan fell for the first time),
   retry, the map, play again, the tech tree or the title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { CHAPTERS, MODES, levelKey } = NS.campaign;
  const { ACHIEVEMENTS } = NS.goalData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const hud = NS.hud;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  let lastStars = 0;

  function nextLevel(r) {
    const ch = CHAPTERS[r.chapter];
    if (r.level + 1 < ch.levels.length) return { c: r.chapter, l: r.level + 1 };
    if (r.chapter + 1 < CHAPTERS.length) return { c: r.chapter + 1, l: 0 };
    return null;
  }

  function goNext(r) {
    const n = nextLevel(r);
    const after = () => {
      if (n) {
        G.ui.mapChapter = n.c;
        NS.cinematics.enterLevel(n.c, n.l);
      } else scr.setScreen('map');
    };
    if (r.chapterEnd) NS.cinematics.leaveChapter(r.chapter, after);
    else after();
  }

  function toMap(r) {
    G.ui.mapChapter = Math.min(CHAPTERS.length - 1, r.chapter + (r.chapterEnd && r.chapter < CHAPTERS.length - 1 ? 1 : 0));
    if (r.chapterEnd) NS.cinematics.leaveChapter(r.chapter, () => scr.setScreen('map'));
    else scr.setScreen('map');
  }

  function draw() {
    const r = G.ui.results;
    if (!r) return;
    if (r.t === 0) {
      lastStars = 0;
      NS.fx.clear();
    }
    r.t += 1 / 60;
    const t = r.t;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.62)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const w = 720, x = 640 - w / 2, y = 110;
    const accent = r.win ? UI.good : UI.bad;
    kit.panel(x, y, w, 470, { accent: accent, glow: true });
    if (r.mode === 'story') story(r, x, y, w, t);
    else run(r, x, y, w, t);
    /* achievements earned on this run */
    if (r.ach.length) {
      kit.text('NEW ACHIEVEMENTS', 640, y + 380, 12, UI.gold, { align: 'center', weight: 'bold' });
      const shown = r.ach.slice(0, 4);
      for (let i = 0; i < shown.length; ++i) {
        const a = ACHIEVEMENTS.find(z => z.id === shown[i]);
        const ax = 640 - (shown.length * 170) / 2 + i * 170 + 85;
        NS.propArt.icon(ctx, a.icon, ax - 60, y + 410, 20, UI.gold);
        kit.fitText(a.name, ax + 8, y + 410, 130, 13, { align: 'center', weight: 'bold', color: '#ffffff' });
      }
    }
    buttons(r, y + 490);
  }

  function story(r, x, y, w, t) {
    const ch = CHAPTERS[r.chapter];
    const L = ch.levels[r.level];
    kit.text(ch.sub + '  -  ' + levelKey(r.chapter, r.level), 640, y + 34, 14, ch.theme.accent, { align: 'center', weight: 'bold' });
    kit.text(r.win ? 'MISSION COMPLETE' : 'MISSION FAILED', 640, y + 74, 40, r.win ? '#ffffff' : UI.bad, { align: 'center', weight: 'bold' });
    kit.text(L.name, 640, y + 108, 18, UI.textDim, { align: 'center' });
    if (r.win) {
      const conds = ['Mission cleared', 'No ship lost', 'Under par (' + hud.clock(L.par) + ')'];
      const earned = [true, r.lost === 0, r.time <= L.par];
      for (let s = 0; s < 3; ++s) {
        const at = 0.4 + s * 0.45;
        const k = Math.max(0, Math.min(1, (t - at) * 4));
        const sx = 640 - 110 + s * 110, sy = y + 175;
        if (earned[s] && k > 0 && lastStars <= s && t >= at) {
          lastStars = s + 1;
          sfx('coin', { pitch: 1 + s * 0.25 });
          NS.fx.sparks(sx, sy, 0, TAU, 16, UI.gold, 260, 0.4);
          NS.fx.ring(sx, sy, 10, 60, 0.4, UI.gold, 4);
        }
        const pop = earned[s] ? (k < 1 ? 0.6 + k * 0.6 : 1 + Math.max(0, 0.15 - (t - at - 0.25)) ) : 1;
        kit.star(sx, sy, 34 * (earned[s] ? Math.min(1.2, pop) : 1), earned[s] && k > 0);
        kit.text(conds[s], sx, y + 226, 12, earned[s] ? UI.text : UI.textMute, { align: 'center' });
      }
      kit.text('Time ' + hud.clock(r.time) + '   -   Score ' + hud.fmt(r.score) + '   -   Best combo ' + r.bestCombo, 640, y + 272, 15, UI.text, { align: 'center' });
      kit.credits(r.reward + r.dust, 640, y + 312, 24, 'center');
      kit.text((r.first ? 'First clear bonus included  -  ' : '') + 'stardust earned', 640, y + 340, 12, UI.textDim, { align: 'center' });
    } else {
      kit.text('All ships lost. The rocks keep falling - try again, or upgrade the Kestrel first.', 640, y + 170, 15, UI.text, { align: 'center' });
      kit.text('Score ' + hud.fmt(r.score) + '   -   Time ' + hud.clock(r.time), 640, y + 210, 15, UI.textDim, { align: 'center' });
      kit.credits(r.dust, 640, y + 260, 24, 'center');
      kit.text('stardust kept', 640, y + 288, 12, UI.textDim, { align: 'center' });
    }
    NS.fxRender.draw({ x0: -400, y0: -300, x1: 1700, y1: 1000 });
  }

  function run(r, x, y, w, t) {
    const M = MODES[r.mode];
    kit.text(M.name.toUpperCase(), 640, y + 34, 14, M.col, { align: 'center', weight: 'bold' });
    const title = r.mode === 'rush' ? (r.win ? 'PANTHEON CLEARED' : 'RUSH OVER') : r.mode === 'zen' ? 'SESSION COMPLETE' : 'GAME OVER';
    kit.text(title, 640, y + 74, 40, '#ffffff', { align: 'center', weight: 'bold' });
    const shown = Math.min(r.score, Math.floor(r.score * Math.min(1, t / 1.2)));
    kit.text(hud.fmt(shown), 640, y + 140, 54, UI.gold, { align: 'center', weight: 'bold' });
    if (r.newBest && t > 1.2) {
      const k = 1 + Math.max(0, 0.3 - (t - 1.2));
      kit.text('NEW BEST!', 640, y + 186, 22 * k, '#ff6ad0', { align: 'center', weight: 'bold' });
    } else kit.text('Best ' + hud.fmt(r.best || 0), 640, y + 186, 15, UI.textDim, { align: 'center' });
    const line = [];
    if (r.mode === 'arcade' || r.mode === 'daily') line.push('Wave ' + r.wave);
    if (r.rank >= 0) line.push('#' + (r.rank + 1) + ' in the table');
    line.push('Best combo ' + r.bestCombo);
    line.push(hud.clock(r.time));
    kit.text(line.join('   -   '), 640, y + 226, 15, UI.text, { align: 'center' });
    kit.credits(r.dust, 640, y + 280, 24, 'center');
    kit.text('stardust earned - spend it in the tech tree', 640, y + 308, 12, UI.textDim, { align: 'center' });
  }

  function buttons(r, y) {
    const bs = [];
    if (r.mode === 'story') {
      if (r.win) {
        const n = nextLevel(r);
        bs.push([r.chapterEnd ? 'Continue' : n ? 'Next mission' : 'Finish', () => goNext(r), UI.good, 'play']);
      }
      bs.push(['Retry', () => NS.cinematics.enterLevel(r.chapter, r.level), UI.accent, 'turn']);
      bs.push(['Map', () => toMap(r), UI.accent, 'map']);
    } else {
      bs.push(['Play again', () => { scr.setScreen('title'); NS.title.startMode(r.mode); }, UI.good, 'play']);
      bs.push(['Title', () => scr.setScreen('title'), UI.accent, 'back']);
    }
    bs.push(['Tech Tree', () => scr.open('tree', 'results'), '#d08aff', 'gun']);
    const bw = 200, gap = 14;
    const x0 = 640 - (bs.length * (bw + gap) - gap) / 2;
    for (let i = 0; i < bs.length; ++i)
      W.button('r' + i, bs[i][0], x0 + i * (bw + gap), y, bw, 48, { action: bs[i][1], accent: bs[i][2], icon: bs[i][3] });
  }

  Object.assign(NS.results, {
    draw, nextLevel
  });
})();
