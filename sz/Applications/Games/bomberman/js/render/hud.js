/* The in-run HUD around the arena: the player card (portrait, lives, bomb/fire/speed levels,
   abilities, timed power-ups, curse, Mega Bomb and dash meters), the score card (score, combo
   multiplier and timer, gems and seasonal tokens, objective, mode details), the top bar with
   stage name, timer or boss health, the READY/GO intro, banners, screen flash and toasts.
   Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI, ARENA_X, ARENA_Y, ARENA_W, ARENA_H } = C;
  const { BOSSES, MODIFIER_BY_ID } = NS.content;
  const { WORLDS } = NS.story;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx } = NS.view;

  const LX = 14, LW = 158, RX = 1108, RW = 158, PY = 84, PH = 624;
  const ABIL = [['kick', '#3aa0ff'], ['glove', '#ff70c0'], ['remote', '#c070ff'], ['pierce', '#4ff0ff'], ['wallpass', '#d8b070'], ['bombpass', '#9aa8ff']];

  function fmtTime(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    leftCard(run);
    rightCard(run);
    topBar(run);
    intro(run);
  }

  function leftCard(run) {
    const p = run.player;
    kit.panel(LX, PY, LW, PH, { accent: '#ffb347' });
    /* portrait */
    const cx = LX + LW / 2;
    const g = ctx.createRadialGradient(cx, PY + 56, 4, cx, PY + 56, 46);
    g.addColorStop(0, 'rgba(255,200,120,0.35)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(LX, PY + 6, LW, 100);
    const s = NS.actorArt.bomber(G.save.equip.skin, 0, Math.floor(G.time * 3) % 4 === 1 ? 1 : 0);
    ctx.drawImage(s, cx - 34, PY + 14, 68, 81);
    const rank = NS.rules.rankOf(G.save.stats.xp);
    kit.text('PIP', cx, PY + 106, 18, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(rank.name, cx, PY + 124, 12, UI.textDim, { align: 'center' });
    /* lives */
    let y = PY + 150;
    if (run.mode === 'zen') kit.text('ZEN  - no harm', cx, y, 14, '#bff4ff', { align: 'center', weight: 'bold' });
    else {
      const n = Math.max(0, run.lives);
      if (n <= 5) for (let i = 0; i < n; ++i) kit.icon('heart', cx - (n - 1) * 13 + i * 26, y, 22, '#ff4f7a');
      else { kit.icon('heart', cx - 18, y, 24, '#ff4f7a'); kit.text('x ' + n, cx + 2, y, 18, '#ffffff', { weight: 'bold' }); }
    }
    /* stats */
    y += 34;
    const rows = [['bomb', p.bombs, '#ff5d5d'], ['fire', p.fire, '#ff9b30'], ['speed', p.speed + 1, '#3ee07a']];
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + i * 34;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; K.roundRect(ctx, LX + 12, ry - 14, LW - 24, 28, 8); ctx.fill();
      kit.icon(rows[i][0], LX + 30, ry, 22, rows[i][2]);
      kit.text(String(rows[i][1]), LX + 52, ry + 1, 18, '#ffffff', { weight: 'bold' });
      for (let k = 0; k < Math.min(8, rows[i][1]); ++k) {
        ctx.fillStyle = rows[i][2];
        ctx.fillRect(LX + 74 + k * 9, ry - 5, 6, 10);
      }
    }
    /* abilities */
    y += 108;
    kit.text('ABILITIES', cx, y, 11, UI.textMute, { align: 'center', weight: 'bold' });
    for (let i = 0; i < ABIL.length; ++i) {
      const ax = LX + 30 + (i % 3) * 49, ay = y + 26 + Math.floor(i / 3) * 42;
      const on = p[ABIL[i][0]];
      ctx.globalAlpha = on ? 1 : 0.22;
      ctx.fillStyle = on ? K.rgba(ABIL[i][1], 0.25) : 'rgba(0,0,0,0.3)';
      K.roundRect(ctx, ax - 18, ay - 18, 36, 36, 8); ctx.fill();
      kit.icon(ABIL[i][0], ax, ay, 26, on ? ABIL[i][1] : '#9a9aa8');
      ctx.globalAlpha = 1;
    }
    /* timed effects */
    y += 120;
    const timed = [];
    if (p.shield) timed.push(['shield', 'Shield', 1, '#8fe8ff']);
    if (run.freezeT > 0) timed.push(['freeze', 'Freeze', run.freezeT / (C.FREEZE_TIME * G.perks.duration), '#a8f0ff']);
    if (p.magnetT > 0) timed.push(['magnet', 'Magnet', p.magnetT / (C.MAGNET_TIME * G.perks.duration), '#ffd84a']);
    if (p.curse) timed.push(['skull', NS.content.CURSES.find(c => c.id === p.curse).name, p.curseT / C.CURSE_TIME, '#b4b4c8']);
    for (let i = 0; i < timed.length; ++i) {
      const ty = y + i * 30;
      kit.icon(timed[i][0], LX + 26, ty, 20, timed[i][3]);
      kit.fitText(timed[i][1], LX + 42, ty - 6, LW - 56, 11, { color: UI.text });
      kit.bar(LX + 42, ty + 4, LW - 58, 6, timed[i][2], timed[i][3]);
    }
    /* meters */
    let my = PY + PH - 22;
    if (G.perks.dash) {
      const r = 1 - Math.max(0, p.dashCd) / G.perks.dashCd;
      kit.text('DASH  [Shift]', LX + 14, my - 12, 11, r >= 1 ? '#bff4ff' : UI.textMute, { weight: 'bold' });
      kit.bar(LX + 14, my - 2, LW - 28, 7, r, '#8fe8ff');
      my -= 34;
    }
    if (G.perks.mega) {
      const f = p.mega / C.SUPER_COST;
      kit.text(f >= 1 ? 'MEGA BOMB READY [C]' : 'MEGA BOMB', LX + 14, my - 12, 11, f >= 1 ? UI.gold : UI.textMute, { weight: 'bold' });
      kit.bar(LX + 14, my - 2, LW - 28, 7, f, f >= 1 ? '#ffd84a' : '#ff8a3c');
    }
  }

  function rightCard(run) {
    kit.panel(RX, PY, RW, PH, { accent: '#6fd3ff' });
    const cx = RX + RW / 2;
    kit.text('SCORE', cx, PY + 22, 12, UI.textMute, { align: 'center', weight: 'bold' });
    kit.fitText(String(run.score), cx, PY + 50, RW - 20, 30, { align: 'center', weight: 'bold', color: '#ffffff' });
    /* combo */
    const mult = NS.rules.comboMultiplier(run.combo);
    const cy = PY + 98;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; K.roundRect(ctx, RX + 12, cy - 22, RW - 24, 56, 10); ctx.fill();
    const pulse = mult > 1 ? 1 + Math.sin(G.time * 10) * 0.04 : 1;
    kit.text('x' + mult, cx, cy, 30 * pulse, mult > 1 ? UI.gold : UI.textMute, { align: 'center', weight: 'bold', stroke: mult > 1 ? 4 : 0 });
    kit.bar(RX + 24, cy + 20, RW - 48, 6, run.comboT / G.perks.combo, mult >= 6 ? '#ff5d5d' : '#ffd84a');
    /* currencies */
    let y = PY + 158;
    kit.gems(run.gemsRun, RX + 18, y, 18);
    y += 30;
    const sd = G.season.def;
    kit.icon(sd.tokenIcon, RX + 28, y, 22, sd.color);
    kit.text(String(run.tokensRun), RX + 46, y, 18, sd.color, { weight: 'bold' });
    kit.text('event ' + G.save.event.tokens, RX + RW - 14, y + 1, 11, UI.textDim, { align: 'right' });
    /* objective */
    y += 36;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; K.roundRect(ctx, RX + 12, y - 4, RW - 24, 74, 10); ctx.fill();
    kit.text('GOAL', cx, y + 8, 11, UI.textMute, { align: 'center', weight: 'bold' });
    if (run.mode === 'zen') {
      kit.text(NS.arena.countBricks() + ' bricks', cx, y + 32, 18, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text('left in the garden', cx, y + 52, 11, UI.textDim, { align: 'center' });
    } else if (run.level.kind === 'boss' && run.boss && run.boss.state !== 'dead') {
      kit.fitText(BOSSES[run.boss.type].name, cx, y + 32, RW - 30, 16, { align: 'center', weight: 'bold', color: '#ff9a7a' });
      kit.text('topple the boss', cx, y + 52, 11, UI.textDim, { align: 'center' });
    } else if (!run.exitOpen) {
      kit.text(run.enemies.filter(e => !e.hurry).length + ' enemies', cx, y + 32, 18, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(run.exitShown ? 'exit found' : 'exit hidden', cx, y + 52, 11, run.exitShown ? '#9af0ff' : UI.textDim, { align: 'center' });
    } else {
      kit.text('EXIT OPEN', cx, y + 32, 18, '#9af0ff', { align: 'center', weight: 'bold' });
      kit.text(run.exitShown ? 'go, go, go!' : 'blast bricks to find it', cx, y + 52, 11, UI.textDim, { align: 'center' });
    }
    /* mode details */
    y += 92;
    if (run.mode === 'story') {
      kit.text('STARS', cx, y, 11, UI.textMute, { align: 'center', weight: 'bold' });
      const noHurt = !run.hurt, fast = run.t <= run.level.par;
      starLine(RX + 18, y + 22, true, 'Clear');
      starLine(RX + 18, y + 44, noHurt, 'No damage');
      starLine(RX + 18, y + 66, fast, 'Under ' + run.level.par + 's');
      const old = G.save.stars[run.world + '-' + run.levelIndex] || 0;
      kit.text('best', RX + 18, y + 92, 11, UI.textDim);
      kit.stars(RX + 64, y + 92, old, 3, 14);
    } else if (run.mode === 'arcade') {
      kit.text('ARENA ' + run.stage, cx, y + 4, 18, '#ffffff', { align: 'center', weight: 'bold' });
      const best = G.save.scores.arcade[0];
      kit.text('best ' + (best ? best.score : 0), cx, y + 28, 12, UI.textDim, { align: 'center' });
    } else if (run.mode === 'daily') {
      kit.text('DAILY ' + run.stage + '/3', cx, y + 4, 16, '#ffffff', { align: 'center', weight: 'bold' });
      for (let i = 0; i < run.mods.length; ++i) kit.fitText(MODIFIER_BY_ID[run.mods[i]].name, cx, y + 28 + i * 18, RW - 24, 12, { align: 'center', color: UI.accent });
    } else if (run.mode === 'rush') {
      kit.text('BOSS ' + run.stage + '/5', cx, y + 4, 16, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(fmtTime(run.rushTime), cx, y + 28, 18, UI.gold, { align: 'center', weight: 'bold' });
    } else {
      kit.text('GARDEN ' + run.stage, cx, y + 4, 16, '#bff4ff', { align: 'center', weight: 'bold' });
      kit.text(Math.floor(run.t / 60) + ' min of calm', cx, y + 28, 12, UI.textDim, { align: 'center' });
    }
    /* key hints */
    const hy = PY + PH - 96;
    const hints = G.input.touch ? [] : [['Space', 'bomb'], ['X', 'detonate'], ['Esc', 'pause']];
    for (let i = 0; i < hints.length; ++i) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; K.roundRect(ctx, RX + 14, hy + i * 26 - 10, 52, 20, 5); ctx.fill();
      kit.text(hints[i][0], RX + 40, hy + i * 26, 11, UI.text, { align: 'center', weight: 'bold' });
      kit.text(hints[i][1], RX + 74, hy + i * 26, 12, UI.textDim);
    }
  }

  function starLine(x, y, ok, label) {
    kit.icon('star', x + 8, y, 16, ok ? UI.gold : 'rgba(255,255,255,0.2)');
    kit.text(label, x + 22, y, 12, ok ? UI.text : UI.textMute);
  }

  function topBar(run) {
    const x = ARENA_X, w = ARENA_W;
    kit.panel(x, 12, w, 56, { accent: K.shade(WORLDS[run.level.world].palette.accent, 0) });
    if (run.boss && run.boss.state !== 'dead') {
      const b = run.boss, def = BOSSES[b.type];
      kit.text(def.name.toUpperCase(), x + 22, 40, 18, '#ffffff', { weight: 'bold' });
      kit.text(def.title, x + 22, 58, 11, UI.textDim);
      const bx = x + 250, bw = w - 400;
      kit.bar(bx, 30, bw, 18, b.hp / b.maxHp, b.phase === 2 ? '#ff4a2a' : '#ff8a3c');
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      for (let i = 1; i < b.maxHp; ++i) { const tx = bx + bw * i / b.maxHp; ctx.beginPath(); ctx.moveTo(tx, 32); ctx.lineTo(tx, 46); ctx.stroke(); }
    } else {
      kit.fitText(run.level.name, x + 22, 40, w * 0.55, 20, { weight: 'bold', color: '#ffffff' });
      const W = WORLDS[run.level.world];
      kit.text(run.mode === 'story' ? W.tagline : run.mode.toUpperCase() + ' MODE', x + 22, 58, 11, UI.textDim);
    }
    if (run.timeLeft > 0 || (run.level.time && run.mode !== 'zen')) {
      const low = run.timeLeft < 30;
      const pulse = low ? 1 + Math.sin(G.time * 8) * 0.06 : 1;
      kit.icon('clock', x + w - 120, 40, 24, low ? UI.bad : UI.accent);
      kit.text(run.timeLeft > 0 ? fmtTime(run.timeLeft) : 'HURRY!', x + w - 100, 41, 24 * pulse, low ? UI.bad : '#ffffff', { weight: 'bold' });
    } else {
      kit.text(fmtTime(run.t), x + w - 24, 41, 20, UI.textDim, { align: 'right', weight: 'bold' });
    }
  }

  function intro(run) {
    if (run.phase !== 'intro' || G.screen !== 'playing') return;
    const u = run.phaseT;
    const word = u < 0.85 ? 'READY' : 'GO!';
    const local = u < 0.85 ? u / 0.85 : (u - 0.85) / 0.45;
    const k = NS.rng.easeOutBack(Math.min(1, local * 2.2));
    kit.text(word, ARENA_X + ARENA_W / 2, ARENA_Y + ARENA_H / 2, 84 * k, word === 'GO!' ? '#7cf08a' : UI.gold, { align: 'center', weight: 'bold', stroke: 10 });
  }

  function drawBanner() {
    const b = G.banner;
    if (!b) return;
    const inT = Math.min(1, b.t / 0.25);
    const outT = Math.max(0, (b.t - b.dur + 0.3) / 0.3);
    const k = NS.rng.easeOutBack(inT) * (1 - outT * 0.3);
    const a = 1 - outT;
    const cx = ARENA_X + ARENA_W / 2, cy = ARENA_Y + 150;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,4,14,0.55)';
    ctx.fillRect(ARENA_X, cy - 46 * k, ARENA_W, (b.sub ? 92 : 70) * k);
    kit.text(b.text, cx, cy - 6, 46 * k, b.color, { align: 'center', weight: 'bold', stroke: 7 });
    if (b.sub) kit.text(b.sub, cx, cy + 30, 17, '#ffffff', { align: 'center', stroke: 4 });
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    if (G.flash <= 0) return;
    const v = NS.view.visible();
    ctx.globalAlpha = Math.min(0.8, G.flash);
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function drawToasts() {
    const list = G.ui.toasts;
    const v = NS.view.visible();
    for (let i = 0; i < list.length; ++i) {
      const t = list[i];
      const slide = Math.min(1, t.t / 0.3) * (t.t > t.dur - 0.4 ? Math.max(0, (t.dur - t.t) / 0.4) : 1);
      const w = Math.min(460, kit.measure(t.text, 15, 'bold') + 70);
      const x = v.x1 - (w + 16) * slide, y = Math.max(v.y0, 0) + 12 + i * 52;
      kit.panel(x, y, w, 42, { accent: t.color, glow: true, radius: 10 });
      kit.icon(t.icon || 'star', x + 24, y + 21, 24, t.color);
      kit.text(t.text, x + 44, y + 22, 15, '#ffffff', { weight: 'bold' });
    }
  }

  Object.assign(NS.hud, {
    draw, drawBanner, drawFlash, drawToasts, fmtTime, LX, LW, RX, RW, PY, PH
  });
})();
