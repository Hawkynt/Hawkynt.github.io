/* The operation tracker in flight, under the radar: the operation's name and mood, each
   objective with its progress, the clock of a timed one and, once decided, the outcome. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, RADAR_R } = NS.constants;
  const { MOODS } = NS.opsData;
  const kit = NS.kit;

  const W = 260;

  function clock(t) {
    const s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function draw(v) {
    const o = G.run && G.run.op;
    const op = NS.operation.def();
    if (!o || !op) return;
    const prog = NS.operation.progress();
    const x = v.x1 - W - 14, y = v.y0 + RADAR_R * 2 + 36;
    const h = 40 + prog.length * 30 + (o.status !== 'active' ? 22 : 0);
    const mood = MOODS[op.mood];
    kit.panel(x, y, W, h, { alpha: 0.82, radius: 8, brackets: false, accent: mood.color });
    kit.fitText(op.name.toUpperCase(), x + 12, y + 14, W - 90, 13, { weight: 'bold', color: '#ffffff' });
    if (op.time && o.status === 'active') {
      const left = op.time - o.t;
      const warn = left < 30 && Math.sin(G.time * 8) > 0;
      kit.text(clock(left), x + W - 12, y + 14, 14, warn ? UI.bad : UI.gold, { align: 'right', weight: 'bold' });
    } else kit.text(mood.name, x + W - 12, y + 14, 11, mood.color, { align: 'right' });
    let yy = y + 36;
    for (let i = 0; i < prog.length; ++i) {
      const p = prog[i];
      const col = p.done ? UI.good : UI.text;
      kit.fitText((p.done ? '✓ ' : '') + p.goal.text, x + 12, yy, W - 90, 12, { color: col });
      kit.text(p.have + ' / ' + p.n, x + W - 12, yy, 12, col, { align: 'right' });
      kit.bar(x + 12, yy + 9, W - 24, 5, p.have / p.n, p.done ? UI.good : mood.color);
      yy += 30;
    }
    if (o.status === 'won') kit.text('COMPLETE' + (o.first ? ' - reward paid' : ''), x + 12, yy, 12, UI.good, { weight: 'bold' });
    else if (o.status === 'failed') kit.text('FAILED', x + 12, yy, 12, UI.bad, { weight: 'bold' });
  }

  Object.assign(NS.opHud, {
    draw
  });
})();
