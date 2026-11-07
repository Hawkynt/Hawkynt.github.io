/* The heads-up display of a run, pinned to the visible edges at any window shape: score,
   distance and the combo multiplier with its draining bar; coins, gems, Spark Shards, festival
   tokens and spare revives; the stage progress bar with the ghost's position, a guardian's
   health or the chaser's distance; active power-ups with draining rings and the dash charge;
   mode and mutator badges; the ready count, the revive offer and the stage-clear banner; the
   cast's line that announces a turn (typed out in the cinematics' style, timed by distance so
   a restored run shows it exactly as before) and the one-time hint for the first climb. Also
   the screen flash and toasts drawn over every screen. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { UI, TAU, PX_PER_M } = C;
  const kit = NS.kit;
  const K = NS.artKit;
  const PA = NS.propArt;
  const PW = NS.powers;
  const W = NS.widgets;
  const rules = NS.rules;
  const { POWER_BY_ID } = NS.items;
  const { ctx } = NS.view;
  const OR = NS.orient;
  const { CAST } = NS.story;

  const MODE_NAMES = { story: 'Story', arcade: 'Arcade', weekly: 'Featured', zen: 'Zen', daily: 'Daily Run', rush: 'Boss Rush' };

  function scoreBox(run, v) {
    const x = v.x0 + 16, y = v.y0 + 14;
    kit.panel(x, y, 270, 92, { radius: 12, brackets: false, alpha: 0.85 });
    kit.text(String(Math.floor(run.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), x + 16, y + 28, 30, '#ffffff', { weight: 'bold' });
    kit.text(rules.metres(run.p.x, run.x0) + ' m', x + 16, y + 62, 20, UI.accent, { weight: 'bold' });
    const mul = NS.run.mult(run);
    const tier = rules.comboTier(run.combo, G.stats.comboCap);
    const col = tier ? '#ff6ad5' : UI.textDim;
    kit.text('x' + (Math.round(mul * 10) / 10), x + 254, y + 28, tier ? 28 : 22, col, { weight: 'bold', align: 'right' });
    if (run.combo > 0) {
      kit.text(run.combo + ' combo', x + 254, y + 58, 14, col, { align: 'right' });
      kit.bar(x + 150, y + 74, 104, 6, run.comboT / G.stats.comboWindow, '#ff6ad5');
    }
  }

  function wallet(run, v) {
    const x1 = v.x1 - 16, y = v.y0 + 14;
    kit.panel(x1 - 220, y, 220, run.mode === 'story' || run.tokens ? 92 : 60, { radius: 12, brackets: false, alpha: 0.85 });
    kit.amount('coins', run.coins, x1 - 204, y + 30, 22, 'left');
    kit.amount('gems', run.gems, x1 - 90, y + 30, 22, 'left');
    let yy = y + 66;
    if (run.mode === 'story' && !run.bs) {
      for (let i = 0; i < 3; ++i) {
        ctx.globalAlpha = run.shardMask & (1 << i) ? 1 : 0.25;
        K.blit(ctx, PA.shard(), x1 - 196 + i * 30, yy, 0.55);
      }
      ctx.globalAlpha = 1;
    }
    if (run.tokens && G.season) {
      K.blit(ctx, PA.token(G.season.token), x1 - 90, yy, 0.7);
      kit.text('x' + run.tokens, x1 - 72, yy, 16, G.season.color, { weight: 'bold' });
    }
    for (let i = 0; i < Math.min(5, run.revives); ++i) K.blit(ctx, PA.icon('revive'), x1 - 22 - i * 22, yy, 0.5);
  }

  /* progress along a stage, a boss's health, or how close the chaser is */
  function topBar(run, v) {
    const cx = (v.x0 + v.x1) / 2, y = v.y0 + 22;
    const bs = run.bs;
    if (bs && bs.phase !== 'gone') {
      const name = NS.worlds.BOSS_NAMES[bs.id];
      kit.text(name, cx, y, 18, '#ffffff', { weight: 'bold', align: 'center' });
      if (bs.chase) {
        const f = Math.max(0, Math.min(1, bs.lead / 900));
        kit.bar(cx - 200, y + 16, 400, 12, f, f < 0.25 ? UI.bad : f < 0.5 ? UI.warn : UI.good);
        kit.text(bs.lead < 220 ? 'IT\'S RIGHT BEHIND YOU!' : 'Lead', cx, y + 42, 13, bs.lead < 220 ? UI.bad : UI.textDim, { align: 'center', weight: 'bold' });
        const prog = Math.max(0, Math.min(1, (run.p.x - bs.startX) / (bs.endX - bs.startX)));
        kit.bar(cx - 200, y + 54, 400, 4, prog, '#ffffff');
      } else {
        kit.bar(cx - 200, y + 16, 400, 14, bs.hp / bs.maxHp, NS.bosses.DEF[bs.id].color, { cells: bs.maxHp });
        if (bs.id === 'king' && bs.hp <= bs.maxHp / 2) {
          const f = Math.max(0, Math.min(1, bs.wallLead / 900));
          kit.bar(cx - 120, y + 38, 240, 6, f, f < 0.3 ? UI.bad : UI.violet);
        }
      }
      return;
    }
    const c = run.course;
    if (c.endX) {
      const f = Math.max(0, Math.min(1, (run.p.x - run.x0) / (c.endX - run.x0)));
      kit.bar(cx - 220, y, 440, 10, f, UI.accent);
      const gp = NS.run.ghostAt(run);
      if (gp) {
        const gf = Math.max(0, Math.min(1, (gp.x - run.x0) / (c.endX - run.x0)));
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(cx - 220 + 440 * gf - 2, y - 4, 4, 18);
      }
      kit.icon('star', cx + 236, y + 5, 18, UI.gold);
      kit.text(MODE_NAMES[run.mode] + (run.stageId ? ' - ' + NS.worlds.stageById(run.stageId).name : ''), cx, y + 28, 16, '#ffffff', { align: 'center', weight: 'bold' });
    } else {
      kit.text(MODE_NAMES[run.mode] || '', cx, y, 16, UI.textDim, { align: 'center', weight: 'bold' });
      if (run.mut.ids.length) kit.text(run.mut.ids.map(id => NS.seasons.MUTATOR_BY_ID[id].name).join(' + '), cx, y + 20, 13, UI.warn, { align: 'center' });
    }
  }

  function powers(run, v) {
    const list = PW.active(run);
    let x = v.x0 + 40;
    const y = v.y1 - 44;
    for (let i = 0; i < list.length; ++i) {
      const id = list[i];
      const def = POWER_BY_ID[id];
      const max = G.stats.dur[id] || def.dur;
      const f = Math.max(0, Math.min(1, run.pw[id] / max));
      ctx.fillStyle = 'rgba(10,8,26,0.7)';
      ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, 23, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
      if (f < 0.25 && Math.floor(G.time * 8) % 2) ctx.globalAlpha = 0.4;
      K.blit(ctx, PA.icon(id), x, y, 0.8);
      ctx.globalAlpha = 1;
      x += 62;
    }
    /* dash charge */
    const p = run.p;
    const cd = Math.max(0, p.dashCd) / (G.stats.dashCd || 1.6);
    const dx = v.x1 - 48, dy = v.y1 - 48;
    ctx.fillStyle = 'rgba(10,8,26,0.6)';
    ctx.beginPath(); ctx.arc(dx, dy, 24, 0, TAU); ctx.fill();
    ctx.strokeStyle = cd > 0 ? UI.textMute : UI.accent;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(dx, dy, 21, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cd)); ctx.stroke();
    kit.text('DASH', dx, dy + 1, 11, cd > 0 ? UI.textMute : '#ffffff', { align: 'center', weight: 'bold' });
  }

  function phaseOverlay(run, v) {
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    if (run.phase === 'ready' && !run.demo) {
      const k = 1 + (run.phaseT % 0.5) * 0.4;
      kit.text(run.phaseT > 0.5 ? 'READY' : 'GO!', cx, cy - 80, 64 * k, run.phaseT > 0.5 ? '#ffffff' : UI.gold, { weight: 'bold', align: 'center' });
      if (run.t < 0.1 && run.mode === 'story' && run.stageId) kit.text(NS.worlds.stageById(run.stageId).name, cx, cy - 20, 24, UI.textDim, { align: 'center' });
    } else if (run.phase === 'revive') {
      kit.panel(cx - 220, cy - 110, 440, 200, { radius: 16, glow: true, accent: '#ff8a2a' });
      K.blit(ctx, PA.icon('revive'), cx, cy - 66, 1.4);
      kit.text('Use a Phoenix Feather?', cx, cy - 22, 24, '#ffffff', { weight: 'bold', align: 'center' });
      kit.text(run.revives + ' left - ' + Math.ceil(run.phaseT) + 's', cx, cy + 6, 16, UI.textDim, { align: 'center' });
      W.button('revive', 'Revive', cx - 200, cy + 30, 190, 46, { action: () => NS.player.revive(run), accent: '#ff8a2a' });
      W.button('giveup', 'Give up', cx + 10, cy + 30, 190, 46, { action: () => NS.run.over(run) });
    } else if (run.phase === 'done') {
      const label = run.bs ? 'GUARDIAN DEFEATED!' : run.mode === 'rush' ? 'GAUNTLET CLEARED!' : 'STAGE CLEAR!';
      kit.text(label, cx, cy - 90, 54 + Math.sin(G.time * 6) * 3, UI.gold, { weight: 'bold', align: 'center' });
    } else if (run.phase === 'dying' && run.why === 'caught') {
      kit.text('CAUGHT!', cx, cy - 90, 54, UI.bad, { weight: 'bold', align: 'center' });
    }
  }

  /* the line of the turn being approached or taken: [entry, seconds shown, seconds left] */
  const SAY = [null, 0, 0];
  function sayAt(run) {
    const ds = run.course.dirs;
    const p = run.p;
    const v = NS.course.speedAt(run.course.cfg, p.x);
    const i = OR.indexAt(ds, p.x);
    SAY[0] = null;
    for (let j = i + 1; j >= i; --j) {
      const e = ds[j];
      if (!e || !e.text) continue;
      const a = e.x - v * 1.6, b = e.x + e.len + v * 1.4;
      if (p.x < a || p.x > b) continue;
      SAY[0] = e; SAY[1] = (p.x - a) / v; SAY[2] = (b - p.x) / v;
      break;
    }
    return SAY;
  }

  function portrait(who, x, y) {
    ctx.fillStyle = 'rgba(10,8,26,0.9)';
    ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = (CAST[who] || CAST.narrator).color;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (who === 'pip') { K.blit(ctx, NS.cineRender.pip(), x, y + 2, 0.62); return; }
    if (NS.bosses.DEF[who]) { const s = NS.bossArt.sprite(who, 0); K.blit(ctx, s, x, y, Math.min(54 / s.w, 54 / s.h)); return; }
    const eq = G.save.equip;
    const spr = NS.runnerArt.frame(eq.char, eq.outfit, 'idle', 0);
    const RA = NS.runnerArt;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 27, 0, TAU); ctx.clip();
    ctx.drawImage(spr.canvas, x - RA.OX * 0.9, y + 52 - RA.OY * 0.9, RA.W * 0.9, RA.H * 0.9);
    ctx.restore();
  }

  function caption(run, v) {
    const s = sayAt(run);
    const e = s[0];
    if (!e) return;
    const who = CAST[e.who] || CAST.narrator;
    const a = Math.max(0, Math.min(1, s[1] * 5, s[2] * 3));
    /* a drop keeps the runner near the top: its lines go to the bottom */
    const prev = run.course.dirs[run.course.dirs.indexOf(e) - 1];
    const low = e.dir === 'down' || (prev && prev.dir === 'down');
    const w = Math.min(760, v.w - 40), x = (v.x0 + v.x1) / 2 - w / 2, y = low ? v.y1 - 186 + (1 - a) * 20 : v.y0 + 98 + (1 - a) * -20;
    ctx.globalAlpha = a;
    kit.panel(x, y, w, 76, { radius: 14, accent: who.color, alpha: 0.94 });
    portrait(e.who, x + 44, y + 38);
    kit.text(who.name, x + 88, y + 18, 16, who.color, { weight: 'bold' });
    kit.fitText(e.text.slice(0, Math.floor(s[1] * 48)), x + 88, y + 48, w - 108, 18, { color: '#ffffff' });
    ctx.globalAlpha = 1;
  }

  /* the first climb or drop: arrows follow the screen */
  function hint(run, v) {
    if (!(run.hintT > 0)) return;
    const o = G.cam.o;
    if (!o) return;
    const f = OR.vectors(o.q, o.mi, {});
    const g = OR.arrowGlyph;
    const touch = G.input.touch;
    const line = (touch ? 'Swipe ' : 'Arrows follow the screen: ') + g(f.ux, f.uy) + ' jump   ' + g(-f.ux, -f.uy) + ' slide   ' + g(f.fx, f.fy) + ' dash';
    const sub = touch ? 'A tap still jumps.' : 'Space, S and Shift work as always.';
    const a = Math.min(1, run.hintT * 2, (6 - run.hintT) * 4);
    const down = o.q * o.mi > 0 && o.vert > 0.5;
    const w = Math.min(640, v.w - 40), x = (v.x0 + v.x1) / 2 - w / 2, y = down ? v.y1 - 280 : v.y0 + 186;
    ctx.globalAlpha = a;
    kit.panel(x, y, w, 70, { radius: 12, accent: UI.gold, glow: true, brackets: false });
    kit.text(line, x + w / 2, y + 24, 20, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(sub, x + w / 2, y + 50, 14, UI.textDim, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function draw() {
    const run = G.run;
    if (!run || run.demo) return;
    const v = NS.view.visible();
    scoreBox(run, v);
    wallet(run, v);
    topBar(run, v);
    powers(run, v);
    if (run.phase === 'play' || run.phase === 'ready') caption(run, v);
    hint(run, v);
    phaseOverlay(run, v);
  }

  function drawFlash() {
    if (G.flash.a <= 0) return;
    const v = NS.view.visible();
    ctx.globalAlpha = Math.min(1, G.flash.a);
    ctx.fillStyle = G.flash.color;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    const q = G.toasts;
    if (!q.length) return;
    const v = NS.view.visible();
    const t = q[0];
    const k = t.t < 0.25 ? t.t / 0.25 : t.t > 3 ? Math.max(0, (3.4 - t.t) / 0.4) : 1;
    const w = Math.min(640, v.w - 40), x = (v.x0 + v.x1) / 2 - w / 2, y = v.y1 - 90 + (1 - k) * 60;
    ctx.globalAlpha = k;
    kit.panel(x, y, w, 52, { radius: 12, accent: t.color, glow: true, brackets: false });
    kit.icon(t.icon, x + 30, y + 26, 26, t.color);
    kit.fitText(t.text, x + 56, y + 27, w - 76, 18, { color: '#ffffff', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, {
    MODE_NAMES, draw, sayAt, drawFlash, drawToasts
  });
})();
