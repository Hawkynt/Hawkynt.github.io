/* The in-cave HUD: the carved top band (gem quota with progress, cave clock, score with the
   combo multiplier and its fuse, lives, dynamite, hard hats, run gold), active power-ups with
   draining rings, the boss health bar, the centre banner, the exit pointer from the Scout perk,
   the minimap, plus the toast and the screen curtain shared by every screen. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const I = NS.items;
  const kit = NS.kit;
  const CA = NS.creatureArt;
  const { ctx, visible } = NS.view;
  const UI = C.UI;
  const T = C.TILE;

  let mini = null, miniX = null;

  function caveTitle(run) {
    const p = run.params;
    if (run.mode === 'story') return NS.story.CHAPTERS[run.ch].levels[run.lv];
    if (run.mode === 'daily') return 'Daily: ' + run.mod.name;
    if (run.mode === 'zen') return 'Zen - cave ' + run.n;
    if (run.mode === 'time') return 'Time Attack - cave ' + run.n;
    return 'Arcade - cave ' + run.n + (p.kind === 'boss' ? ' (boss)' : p.kind === 'bonus' ? ' (bonus)' : '');
  }

  function band(v) {
    const y = v.y0, h = C.HUD_H;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(30,20,14,0.97)'); g.addColorStop(1, 'rgba(14,10,8,0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, y, v.w, h);
    ctx.fillStyle = '#b08a50';
    ctx.fillRect(v.x0, y + h - 3, v.w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(v.x0, y + h - 1, v.w, 3);
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    const cv = run.cave;
    const v = visible();
    band(v);
    const y = v.y0 + C.HUD_H / 2 - 2;
    const L = Math.max(v.x0, 0) + 18;
    const tiles = NS.tileArt.tiles(NS.world.themeOf(run), G.season ? G.season.id : '');
    /* gems */
    ctx.drawImage(tiles.gem[Math.floor(G.time * 8) & 7], L, y - 20, 40, 40);
    const need = cv.required;
    const got = Math.min(cv.gems, need);
    const done = cv.exitOpen;
    kit.text(need ? got + ' / ' + need : String(cv.gems), L + 46, y - 6, 24, done ? UI.good : '#bff8ff', { weight: 'bold' });
    kit.bar(L + 46, y + 12, 120, 7, need ? got / need : 1, done ? '#7dff8a' : '#38e6ff');
    /* cave name */
    kit.fitText(caveTitle(run), L + 190, y - 8, 230, 15, { color: UI.dim });
    const modeDef = NS.meta.MODES[run.mode];
    kit.text(modeDef.name.toUpperCase(), L + 190, y + 12, 12, modeDef.color, { weight: 'bold' });
    /* clock */
    const cx = (v.x0 + v.x1) / 2;
    if (run.mode !== 'zen' && run.timeLeft > 0 || run.mode === 'time') {
      const low = run.timeLeft < 15;
      const pulse = low ? 1 + Math.max(0, Math.sin(G.time * 10)) * 0.12 : 1;
      kit.text(String(Math.ceil(run.timeLeft)), cx - 170, y, 28 * pulse, low ? UI.bad : UI.text, { align: 'center', weight: 'bold' });
      kit.text('TIME', cx - 170, y + 22, 10, UI.faint, { align: 'center' });
    } else kit.text('∞', cx - 170, y, 28, '#8ff5dc', { align: 'center', weight: 'bold' });
    /* score and combo */
    kit.text(String(run.score), cx, y - 4, 30, UI.gold, { align: 'center', weight: 'bold' });
    if (run.mult > 1) {
      const t = Math.max(0, run.comboT / (C.COMBO_WINDOW + (G.perks.comboWindow || 0)));
      kit.panel(cx + 70, y - 18, 58, 30, { accent: '#ff9a3c', glow: true, radius: 8, rivets: false });
      kit.text('x' + run.mult, cx + 99, y - 3, 20, '#ffd54a', { align: 'center', weight: 'bold' });
      kit.bar(cx + 74, y + 15, 50, 4, t, '#ff9a3c');
    }
    kit.text('SCORE', cx, y + 21, 10, UI.faint, { align: 'center' });
    /* right cluster */
    let R = v.x1 - 18;
    kit.goldLabel(R, y, run.gold, 18, 'right');
    R -= 110;
    const p = cv.player;
    ctx.drawImage(CA.icon('bomb'), R - 30, y - 15, 30, 30);
    kit.text('x' + p.bombs, R + 2, y, 18, p.bombs ? UI.text : UI.faint, { weight: 'bold' });
    R -= 76;
    ctx.drawImage(CA.icon('shield'), R - 30, y - 15, 30, 30);
    kit.text('x' + p.shield, R + 2, y, 18, p.shield ? UI.gold : UI.faint, { weight: 'bold' });
    R -= 70;
    if (run.mode === 'arcade' || run.mode === 'daily' || run.mode === 'time') {
      const head = NS.spriteArt.miner(G.save.skin).right.front;
      const n = Math.min(run.lives, 5);
      for (let k = 0; k < n; ++k) ctx.drawImage(head, R - 30 - k * 24, y - 26, 40, 40);
      if (run.lives > 5) kit.text('+' + (run.lives - 5), R - 150, y, 14, UI.text);
    }
    drawPowerups(cv, v);
    if (cv.boss && !cv.bossDefeated) drawBossBar(cv, v);
    drawBanner(run, v);
    drawExitPointer(cv, v);
    drawMinimap(cv, v);
  }

  function drawPowerups(cv, v) {
    const p = cv.player;
    let x = v.x0 + 20;
    const y = v.y0 + C.HUD_H + 30;
    for (let k = 0; k < I.TIMED.length; ++k) {
      const key = I.TIMED[k];
      const t = p.pow[key];
      if (!(t > 0)) continue;
      const def = I.POWERUPS.find((d) => d && d.key === key);
      ctx.fillStyle = 'rgba(10,8,6,0.7)';
      ctx.beginPath(); ctx.arc(x + 18, y, 20, 0, C.TAU); ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + 18, y, 19, -Math.PI / 2, -Math.PI / 2 + C.TAU * Math.min(1, t / def.dur)); ctx.stroke();
      if (t > 2 || Math.floor(G.time * 6) % 2) ctx.drawImage(CA.icon(key), x + 4, y - 14, 28, 28);
      x += 46;
    }
  }

  function drawBossBar(cv, v) {
    const b = cv.boss, def = I.BOSSES[b.kind];
    const w = Math.min(520, v.w - 80), x = (v.x0 + v.x1) / 2 - w / 2, y = v.y0 + C.HUD_H + 12;
    kit.panel(x - 10, y - 6, w + 20, 40, { accent: def.color, radius: 10, rivets: false });
    kit.text(def.name + ' - ' + def.title, x + w / 2, y + 6, 14, def.color, { align: 'center', weight: 'bold' });
    for (let k = 0; k < b.max; ++k) {
      const sw = (w - (b.max - 1) * 6) / b.max;
      kit.bar(x + k * (sw + 6), y + 18, sw, 9, k < b.hp ? 1 : 0, def.color);
    }
  }

  function drawBanner(run, v) {
    let text = '', sub = '', a = 0;
    const cx = (v.x0 + v.x1) / 2, cy = v.y0 + v.h * 0.36;
    if (run.state === 'intro') {
      a = Math.min(1, run.stateT * 4) * Math.min(1, (1.6 - run.stateT) * 3 + 0.4);
      text = caveTitle(run);
      const cv = run.cave;
      sub = cv.boss ? 'Defeat ' + I.BOSSES[cv.boss.kind].name + ' - drop boulders or dynamite on it!' : 'Collect ' + cv.required + ' gems, then find the exit';
      if (run.banner && run.bannerT > 0) sub = run.banner;
    } else if (run.state === 'won') {
      a = 1;
      text = run.params.kind === 'boss' ? 'Boss defeated!' : 'Cave clear!';
      sub = run.tally > 0 ? 'Time bonus +' + Math.round(run.tally * C.TIME_BONUS) : '';
    } else if (run.state === 'dying') {
      a = Math.min(1, run.stateT * 2);
      text = run.mode === 'arcade' || run.mode === 'daily' ? (run.lives > 1 ? 'Ouch! ' + (run.lives - 1) + ' lives left' : 'Last life lost...') : 'Try again!';
    } else if (run.bannerT > 0) {
      a = Math.min(1, run.bannerT * 2);
      text = run.banner;
    }
    if (a <= 0.01 || !text) return;
    ctx.globalAlpha = a;
    ctx.font = kit.font(40, 'bold');
    const w = Math.max(ctx.measureText(text).width, sub ? 360 : 0) + 80;
    kit.panel(cx - w / 2, cy - 40, w, sub ? 96 : 70, { accent: UI.accent, glow: true });
    kit.text(text, cx, cy - 6, 38, '#fff3c0', { align: 'center', weight: 'bold' });
    if (sub) kit.fitText(sub, cx, cy + 34, w - 40, 17, { align: 'center', color: UI.dim });
    ctx.globalAlpha = 1;
  }

  function drawExitPointer(cv, v) {
    if (!cv.exitOpen || !G.perks.scout) return;
    const cam = NS.world.camera();
    const f = NS.world.frameRect(true);
    const ex = f.x0 - cam.x + cv.exitC * T + T / 2, ey = f.y0 - cam.y + cv.exitR * T + T / 2;
    if (ex > f.x0 && ex < f.x0 + f.w && ey > f.y0 && ey < f.y0 + f.h) return;
    const cx = f.x0 + f.w / 2, cy = f.y0 + f.h / 2;
    const a = Math.atan2(ey - cy, ex - cx);
    const r = Math.min(f.w, f.h) / 2 - 40;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.globalAlpha = 0.7 + Math.sin(G.time * 6) * 0.3;
    ctx.fillStyle = '#ffd54a';
    K.poly(ctx, [18, 0, -10, -12, -4, 0, -10, 12]);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* 3 px per cell, refreshed four times a second */
  function drawMinimap(cv, v) {
    const S = 3;
    const w = cv.w * S, h = cv.h * S;
    if (!mini || mini.width !== w || mini.height !== h) { mini = K.canvas(w, h); miniX = mini.getContext('2d'); mini.t = -1; }
    if (G.time - mini.t > 0.25) {
      mini.t = G.time;
      const x = miniX;
      x.fillStyle = 'rgba(20,14,10,0.9)';
      x.fillRect(0, 0, w, h);
      const sense = G.perks.gemSense || cv.player.pow.lantern > 0;
      for (let r = 0; r < cv.h; ++r)
        for (let c = 0; c < cv.w; ++c) {
          const t = cv.cells[r * cv.w + c];
          let col = null;
          if (t === C.EMPTY) col = '#3a2c22';
          else if (t === C.STEEL) col = '#6a6a72';
          else if (t === C.BOULDER) col = '#8a8078';
          else if ((t === C.GEM || t === C.BIGGEM) && sense) col = '#38e6ff';
          else if (t === C.LAVA) col = '#ff6a1a';
          else if (C.CREATURE[t] || t === C.BOSS) col = '#ff5d5d';
          else if (t === C.EXIT && cv.exitOpen) col = '#ffd54a';
          if (col) { x.fillStyle = col; x.fillRect(c * S, r * S, S, S); }
        }
      x.fillStyle = '#ffffff';
      x.fillRect(cv.player.c * S - 1, cv.player.r * S - 1, S + 2, S + 2);
    }
    /* on touch screens the buttons own the bottom corners */
    const px = G.input.touch ? v.x1 - w - 110 : v.x1 - w - 16, py = G.input.touch ? v.y0 + C.HUD_H + 16 : v.y1 - h - 16;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(px - 4, py - 4, w + 8, h + 8);
    ctx.drawImage(mini, px, py);
    ctx.strokeStyle = '#b08a50';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 4, py - 4, w + 8, h + 8);
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    if (G.toast.t <= 0) return;
    const v = visible();
    const a = Math.min(1, G.toast.t * 2, (3.2 - G.toast.t) * 5);
    ctx.globalAlpha = a;
    ctx.font = kit.font(18, 'bold');
    const w = ctx.measureText(G.toast.text).width + 50;
    const x = (v.x0 + v.x1) / 2 - w / 2, y = v.y1 - 86;
    kit.panel(x, y, w, 44, { accent: G.toast.color, glow: true, radius: 12, rivets: false });
    kit.text(G.toast.text, x + w / 2, y + 22, 18, G.toast.color, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  function drawCurtain() {
    if (G.fade <= 0) return;
    const v = visible();
    ctx.globalAlpha = Math.min(1, G.fade);
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.hud, { draw, drawToast, drawCurtain, caveTitle });
})();
