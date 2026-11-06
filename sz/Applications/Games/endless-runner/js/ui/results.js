/* The end of a run over the frozen scene: the verdict (stage clear, guardian freed, or what
   the runner crashed into), stars popping in for story stages, the score counting up with a new
   best badge, distance, near misses, smashes, best combo, then the pay-out (coins with the
   stage bonus, gems, XP filling the level bar), and the way on - next stage, retry, the map or
   title, the tech tree. Draws and registers hit areas; owns the count-up clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { sfx } = NS.audio;
  const { ctx } = NS.view;

  const WHY = { hurdle: 'an obstacle', block: 'a block', bar: 'an overhang', wall: 'a wall', spikes: 'spikes', saw: 'a saw',
    drone: 'a flyer', rock: 'a falling rock', roller: 'a roller', proj: 'a guardian\'s shot', fall: 'a pit', caught: 'the chaser', quit: '' };

  let t = 0, starsShown = 0;

  function reset() {
    t = 0;
    starsShown = 0;
  }

  function nextStage(sum) {
    const st = NS.worlds.stageById(sum.stageId);
    if (!st || !sum.finished) return null;
    if (st.s < NS.worlds.STAGES_PER_WORLD - 1) return NS.worlds.stage(st.w, st.s + 1);
    if (st.w < NS.worlds.WORLDS.length - 1) return NS.worlds.stage(st.w + 1, 0);
    return null;
  }

  function draw() {
    const sum = G.lastSum;
    if (!sum) return;
    const v = NS.view.visible();
    t += 1 / 60;
    ctx.fillStyle = 'rgba(8,6,22,0.62)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const cx = 640;
    const story = sum.mode === 'story';
    const st = story ? NS.worlds.stageById(sum.stageId) : null;
    let head = sum.finished ? (st && st.boss ? 'Guardian freed!' : sum.mode === 'rush' ? 'Gauntlet cleared!' : 'Stage clear!') : 'Run over';
    if (!story && sum.mode !== 'rush' && sum.mode !== 'daily') head = 'Run over';
    if (sum.mode === 'daily' && sum.finished) head = 'Daily Run finished!';
    kit.panel(cx - 360, 60, 720, 560, { radius: 18, accent: sum.finished ? UI.gold : UI.accent, glow: true });
    kit.text(head, cx, 104, 40, sum.finished ? UI.gold : '#ffffff', { weight: 'bold', align: 'center' });
    const sub = st ? st.name : NS.hud.MODE_NAMES[sum.mode];
    kit.text(sub + (sum.why && WHY[sum.why] && !sum.finished ? ' - stopped by ' + WHY[sum.why] : ''), cx, 140, 16, UI.textDim, { align: 'center' });
    if (story && sum.finished) {
      for (let i = 0; i < 3; ++i) {
        const at = 0.4 + i * 0.35;
        const on = i < sum.stars && t > at;
        if (on && starsShown <= i) { starsShown = i + 1; sfx('coin', { pitch: 1 + i * 0.2 }); }
        const k = on ? Math.min(1.25, 0.4 + (t - at) * 4) : 1;
        kit.star(cx - 70 + i * 70, 196, 26 * (k > 1.1 ? 2.35 - k : k), on);
      }
    }
    const f = Math.min(1, t / 1.1);
    const score = Math.floor(sum.score * f);
    kit.text(String(score).replace(/\B(?=(\d{3})+(?!\d))/g, ','), cx, story && sum.finished ? 262 : 214, 52, '#ffffff', { weight: 'bold', align: 'center' });
    if (sum.newBest && t > 1.1) kit.text('NEW BEST!', cx + 190, story && sum.finished ? 240 : 192, 20 + Math.sin(G.time * 8) * 2, UI.gold, { weight: 'bold', align: 'center' });
    const rows = [['Distance', sum.dist + ' m'], ['Near misses', sum.nears], ['Smashed', sum.smashes], ['Best combo', sum.comboBest]];
    if (story && !st.boss) rows.push(['Shards', sum.shards + ' / 3']);
    if (sum.tokens) rows.push(['Festival tokens', sum.tokens]);
    const y0 = 300;
    for (let i = 0; i < rows.length; ++i) {
      const x = cx - 300 + (i % 3) * 200, y = y0 + Math.floor(i / 3) * 52;
      kit.text(rows[i][0], x + 90, y, 13, UI.textDim, { align: 'center' });
      kit.text(String(rows[i][1]), x + 90, y + 22, 20, '#ffffff', { align: 'center', weight: 'bold' });
    }
    const y1 = 420;
    kit.amount('coins', '+' + Math.floor((sum.coins + sum.bonus) * Math.min(1, t / 1.4)), cx - 160, y1, 26, 'center');
    if (sum.bonus) kit.text('incl. ' + sum.bonus + ' bonus', cx - 160, y1 + 26, 12, UI.textDim, { align: 'center' });
    kit.amount('gems', '+' + sum.gems, cx + 20, y1, 26, 'center');
    kit.text('+' + sum.xp + ' XP', cx + 190, y1, 22, UI.violet, { weight: 'bold', align: 'center' });
    kit.bar(cx - 200, y1 + 46, 400, 10, G.save.xp / rules.xpNeeded(G.save.level), UI.violet);
    kit.text('Level ' + G.save.level + (sum.levels.length ? '  - level up!' : ''), cx, y1 + 70, 14, sum.levels.length ? UI.gold : UI.textDim, { align: 'center', weight: 'bold' });
    const by = 540;
    const nx = nextStage(sum);
    const btns = [];
    if (nx && NS.map.stageOpen(nx.w, nx.s)) btns.push(['next', 'Next: ' + nx.name, () => scr.startStory(nx.id), UI.gold]);
    btns.push(['retry', 'Run again', () => { if (story) scr.startStory(sum.stageId); else scr.startMode(sum.mode); }, UI.good]);
    btns.push(['back', story ? 'World map' : 'Title', () => scr.setScreen(story ? 'map' : 'title'), UI.accent]);
    btns.push(['tree', 'Tech Tree', () => scr.open('tree', 'results'), UI.violet]);
    const bw = Math.min(200, 680 / btns.length - 10);
    for (let i = 0; i < btns.length; ++i)
      W.button(btns[i][0], btns[i][1], cx - (btns.length * (bw + 10) - 10) / 2 + i * (bw + 10), by, bw, 52, { action: btns[i][2], accent: btns[i][3], px: 17 });
  }

  Object.assign(NS.results, {
    reset, draw, nextStage
  });
})();
