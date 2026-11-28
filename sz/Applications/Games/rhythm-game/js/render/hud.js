/* The play HUD around the highway: the song's title and district, a progress bar with the sections,
   the score rolling up, the multiplier, the personal-best bar (ahead or behind), accuracy, the combo
   floating over the highway, the groove meter (red and shaking when low) and the Surge meter (ready:
   pulsing, press Space), the active shields, Safety Net, Magnet and multiplier, the count-in before
   the first bar, a duel's health bar and its attack banner with the time to the strike, the
   call-out bubble beside the performer, and the touch buttons (Surge, pause). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const E = NS.engine;
  const { UI, HW_X, HIT_Y } = C;
  const { ctx } = NS.view;

  let shown = 0;

  function meter(x, y0, y1, f, color, label, glow) {
    const h = y1 - y0;
    K.roundRect(ctx, x - 9, y0, 18, h, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = K.rgba(color, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const fh = Math.max(0, Math.min(1, f)) * (h - 6);
    if (fh > 1) {
      const gr = ctx.createLinearGradient(0, y1, 0, y0);
      gr.addColorStop(0, K.shade(color, -0.3));
      gr.addColorStop(1, color);
      K.roundRect(ctx, x - 6, y1 - 3 - fh, 12, fh, 6);
      ctx.fillStyle = gr;
      ctx.fill();
    }
    if (glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(G.time * 8);
      K.blit(ctx, K.glow(color), x, y1 - fh / 2, 0.8);
      ctx.restore();
    }
    kit.text(label, x, y1 + 16, 11, UI.textDim, { align: 'center', weight: 'bold' });
  }

  function draw() {
    const r = G.run;
    if (!r) return;
    const s = r.eng, chart = r.chart;
    const t = Math.max(s.t, r.cond.t);
    const demo = r.mode === 'demo';
    /* the performer and the boss */
    const beat = NS.conductor.beatOf(r.cond, t);
    const pose = { bob: beat.f, lean: G.input.laneFlash.indexOf(1) >= 0 ? 0.6 : 0, cheer: s.surgeOn > t ? 0.6 : 0, slump: s.groove < 0.2 ? 1 : 0 };
    NS.actors.drawPerformer(185, 660, 1.05, pose);
    if (r.stage && r.stage.boss && s.boss) {
      NS.actors.drawBoss(r.stage.world, 1095, 690, 1, { rage: s.boss.rage, attack: !!s.attack || (G.ui.banner && G.ui.banner.t < 2), down: s.boss.down ? Math.min(1, (G.time - (r.downT || (r.downT = G.time))) / 1.5) : 0 });
    }
    if (demo) return;
    /* top: title, progress */
    const prog = Math.max(0, Math.min(1, t / chart.length));
    kit.panel(330, 10, 620, 44, { radius: 14, accent: NS.worldData.WORLDS[r.world].color });
    kit.fitText(r.title, 350, 26, 330, 18, { weight: 'bold', color: '#ffffff' });
    const sub = r.stage ? NS.worldData.WORLDS[r.stage.world].name + (r.stage.boss ? ' - Duel' : ' - Stage ' + (r.stage.stage + 1)) : NS.metaData.MODE_BY_ID[r.mode] ? NS.metaData.MODE_BY_ID[r.mode].name + (r.mode === 'free' ? ' - ' + NS.metaData.DIFF_BY_ID[r.recipe.diff].name : '') : '';
    kit.fitText(sub, 350, 43, 330, 11, { color: UI.textDim });
    const bx = 690, bw = 240;
    kit.bar(bx, 22, bw, 10, prog, NS.worldData.WORLDS[r.world].color);
    for (let b = 1; b < chart.bars; ++b) if (chart.sections[b] !== chart.sections[b - 1]) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(bx + b / chart.bars * bw, 20, 1.5, 14); }
    const left = Math.max(0, chart.length - t);
    kit.text(Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), bx + bw, 44, 11, UI.textDim, { align: 'right' });
    /* score and multiplier */
    shown += (s.score - shown) * 0.25;
    if (Math.abs(s.score - shown) < 1) shown = s.score;
    kit.text(Math.round(shown).toLocaleString('en-US'), 30, 40, 34, '#ffffff', { weight: 'bold', shadow: 'rgba(0,0,0,0.6)' });
    const m = E.mult(s) * (s.surgeOn > t ? s.surgePower : 1);
    kit.panel(30, 64, 70, 30, { radius: 15, accent: m > 1 ? UI.gold : UI.accent, glow: m >= 4 });
    kit.text('x' + (Math.round(m * 100) / 100), 65, 80, 18, m > 1 ? UI.gold : '#ffffff', { align: 'center', weight: 'bold' });
    kit.text((Math.round(E.accuracy(s) * 1000) / 10).toFixed(1) + '%', 110, 80, 18, UI.textDim, { weight: 'bold' });
    if (r.best > 0 && !s.boss) {
      const pace = r.best * prog;
      const diff = Math.round(s.score - pace);
      kit.text('PB ' + (diff >= 0 ? '+' : '') + diff.toLocaleString('en-US'), 30, 112, 13, diff >= 0 ? UI.good : UI.bad, { weight: 'bold' });
      kit.bar(30, 124, 150, 6, Math.min(1, s.score / r.best), diff >= 0 ? UI.good : '#8a6aaa');
    }
    if (r.totals) kit.text((r.mode === 'marathon' ? 'Song ' : 'Duel ') + (r.totals.songs + 1) + (r.mode === 'bossrush' ? ' / 5' : ''), 30, 146, 14, UI.gold, { weight: 'bold' });
    /* combo over the highway */
    if (s.combo >= 4) {
      const pop = Math.min(1, G.pulse * 1.5);
      ctx.save();
      ctx.globalAlpha = 0.75;
      kit.text(String(s.combo), HW_X, 250, 56 + pop * 8, s.combo >= 50 ? UI.gold : '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.5)' });
      kit.text('COMBO', HW_X, 290, 14, UI.textDim, { align: 'center', weight: 'bold' });
      ctx.restore();
    }
    /* meters beside the highway */
    const shakeX = s.groove < 0.25 ? Math.sin(G.time * 40) * 2 : 0;
    meter(345 + shakeX, 300, 590, s.groove, s.groove < 0.25 ? UI.bad : s.groove < 0.5 ? UI.gold : UI.good, 'GROOVE', s.groove < 0.25);
    const ready = s.surge >= 0.5 && !(s.surgeOn > t);
    meter(935, 300, 590, s.surgeOn > t ? (s.surgeOn - t) / (s.surgeLen || 1) : s.surge, '#ff7ad8', 'SURGE', ready);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(926, 300 + (590 - 300) / 2, 18, 1.5);
    if (ready) kit.text('SPACE', 935, 286, 12, '#ff7ad8', { align: 'center', weight: 'bold' });
    /* active helpers */
    let cy = 300;
    const chip = (icon, label, color) => { kit.icon(icon, 312, cy, 18, color); kit.text(label, 296, cy, 12, color, { align: 'right', weight: 'bold' }); cy += 26; };
    if (s.shield) chip('shield', 'x' + s.shield, '#5af0ff');
    if (s.net) chip('shield', 'NET ' + s.net, UI.good);
    if (s.magnetT > 0) chip('magnet', Math.ceil(s.magnetT) + 's', '#5af0ff');
    if (s.multT > 0) chip('star', Math.ceil(s.multT) + 's', UI.gold);
    if (s.rescue) chip('heart', 'ENCORE', '#ff5a7a');
    /* duel health */
    if (s.boss) {
      const b = r.stage.boss;
      kit.panel(970, 64, 290, 52, { radius: 12, accent: s.boss.rage ? '#ff3a4a' : b.color, glow: s.boss.rage });
      kit.fitText(b.name, 986, 82, 200, 15, { weight: 'bold', color: s.boss.rage ? '#ff8a8a' : '#ffffff' });
      kit.bar(986, 96, 258, 10, s.boss.hp / s.boss.max, s.boss.rage ? '#ff3a4a' : b.color);
      if (s.boss.down) kit.text('THE BEAT IS BACK', 1244, 82, 12, UI.good, { align: 'right', weight: 'bold' });
    }
    /* count-in */
    const first = r.cond.bar * chart.barLen;
    if (r.cond.t < first && r.cond.t > first - 4 * chart.beat) {
      const n = Math.ceil((first - r.cond.t) / chart.beat);
      const f = 1 - ((first - r.cond.t) / chart.beat - (n - 1));
      kit.text(n > 0 ? String(n) : 'GO', HW_X, 420, 90 * (1.25 - f * 0.25), n === 1 ? UI.gold : '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.7)' });
    } else if (r.cond.t < first) kit.text(r.cond.bar > 0 ? 'Rejoining at bar ' + (r.cond.bar + 1) : 'Get ready', HW_X, 420, 30, '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.7)' });
    /* attack banner */
    const bn = G.ui.banner;
    if (bn && s.boss && !s.boss.down) {
      const A = NS.worldData.ATTACKS[bn.kind];
      const left2 = bn.at - t;
      const a = Math.min(1, bn.t * 4) * (left2 < -1 ? Math.max(0, 1 + (left2 + 1)) : 1);
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        const flash = left2 > 0 && Math.sin(G.time * 16) > 0;
        kit.panel(HW_X - 200, 96, 400, 56, { radius: 14, accent: r.stage.boss.color, glow: flash });
        kit.icon(A.icon, HW_X - 172, 124, 26, r.stage.boss.color);
        kit.text(A.name.toUpperCase(), HW_X - 146, 114, 20, '#ffffff', { weight: 'bold' });
        kit.fitText(left2 > 0 ? A.text + '  ' + left2.toFixed(1) + 's' : A.text, HW_X - 146, 136, 330, 12, { color: UI.textDim });
        ctx.restore();
      }
    }
    /* call-out bubble */
    const co = G.ui.callout;
    if (co) {
      const a = Math.min(1, co.t * 5, (2 - co.t) * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      const w = Math.min(260, kit.width(co.text, 15, 'bold') + 30);
      kit.panel(70, 330, w, 34, { radius: 17, accent: co.color, glow: true });
      kit.text(co.text, 70 + w / 2, 347, 15, '#ffffff', { align: 'center', weight: 'bold' });
      ctx.restore();
    }
    /* touch buttons */
    if (G.input.touch) {
      W.button('surge', 'SURGE', 1110, 590, 150, 70, { action: () => NS.play.surge(), accent: '#ff7ad8', disabled: !ready, nonav: true });
      W.button('pause-btn', 'II', 1200, 140, 60, 50, { action: () => NS.screens.pause(), nonav: true });
    }
    void HIT_Y;
  }

  Object.assign(NS.hud, { draw, meter });
})();
