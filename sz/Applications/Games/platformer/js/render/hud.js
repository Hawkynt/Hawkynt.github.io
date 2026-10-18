/*
 * The play HUD (hearts, coins, gems, timer, powers, boss bar, toasts), the level intro card, the
 * knock-out veil, menu toasts and the screen fade.
 * Reads G.run (its pulses run on the level clock G.run.clock, frozen while paused); ages G.toast and G.fade.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, FADE_RATE, KO_TIME, STAR_TIME, INTRO_TIME, WORLDS } = NS.config;
  const Spr = SZ.PlatformerSprites;
  const { visibleRect } = NS.module('view');
  const { formatTime } = NS.module('util');
  const { drawSprite, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;

  function drawHUD() {
    const r = G.run;
    const v = visibleRect();
    /* anchored to the visible corners, wide or tall windows alike */
    const left = v.x0 + 16, right = v.x1 - 16, top = v.y0 + 12;
    /* hearts */
    const hw = 38 + r.maxHearts * 34;
    ui.drawPanel(left, top, hw + (r.shield ? 34 : 0), 52, { radius: 14, noStuds: true, alpha: 0.92 });
    for (let k = 0; k < r.maxHearts; ++k) {
      const full = k < r.hearts;
      const pulse = full && r.hearts === 1 ? 1 + 0.12 * Math.sin(r.clock * 9) : 1;
      drawIcon(full ? 'heart' : 'heartEmpty', '#ff4a6a', left + 30 + k * 34, top + 26, 30 * pulse);
    }
    if (r.shield)
      drawIcon('shield', '#8ad8ff', left + 30 + r.maxHearts * 34, top + 26, 28);
    /* coins and gems */
    const cx = left;
    const cy = top + 60;
    ui.drawPanel(cx, cy, 150, 40, { radius: 12, noStuds: true, alpha: 0.92 });
    drawIcon('coin', '#ffd75a', cx + 24, cy + 20, 26);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(String(Math.floor(r.coinsRun)), cx + 44, cy + 21, 96, 22, { weight: 'bold', color: '#ffe9a0', outline: 'rgba(0,0,0,0.6)' });
    ui.drawPanel(cx + 158, cy, 122, 40, { radius: 12, noStuds: true, alpha: 0.92 });
    for (let k = 0; k < 3; ++k) {
      const g = r.gems[k];
      const have = r.gemsRun[k];
      ctx.save();
      ctx.globalAlpha = have ? 1 : g && g.old ? 0.45 : 0.22;
      drawSprite(Spr.item('gem', have ? Math.floor(r.clock * 6) % 6 : 0, k), cx + 186 + k * 34, cy + 20, false, 0.75, 0.75);
      ctx.restore();
    }
    /* timer and mode */
    const tw = 210;
    ui.drawPanel(right - tw, top, tw, 52, { radius: 14, noStuds: true, alpha: 0.92 });
    drawIcon('clock', '#bfe8ff', right - tw + 28, top + 26, 26);
    ctx.textAlign = 'left';
    const target = r.level.timeTarget;
    const over = r.mode !== 'endless' && r.t > target;
    ui.fitText(formatTime(r.t), right - tw + 50, top + 27, 100, 24, { weight: 'bold', color: over ? '#ffb0a0' : '#ffffff', outline: 'rgba(0,0,0,0.6)' });
    ctx.textAlign = 'right';
    ui.fitText(r.mode === 'endless' ? 'STAGE ' + (r.stage + 1) : 'par ' + target + 's', right - 14, top + 27, 64, 12, { weight: 'bold', color: over ? ui.UI.bad : ui.UI.textDim });
    /* powers */
    let px = right - tw;
    const py = top + 60;
    if (r.fire) {
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: 0.92 });
      drawSprite(Spr.item('fire', Math.floor(r.clock * 8) % 4), px + 23, py + 20, false, 0.8, 0.8);
      px += 52;
    }
    if (r.star > 0) {
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: 0.92, glow: r.star < 2 && Math.floor(r.clock * 6) % 2 === 0 });
      drawSprite(Spr.item('star', Math.floor(r.clock * 8) % 4), px + 23, py + 18, false, 0.7, 0.7);
      ui.drawMeter(px + 6, py + 32, 34, 5, r.star / STAR_TIME, '#ffe14a');
      px += 52;
    }
    if (G.stats.dash > 0) {
      const ready = r.player.dashReady && r.player.dashCd <= 0;
      ui.drawPanel(px, py, 46, 40, { radius: 12, noStuds: true, alpha: ready ? 0.92 : 0.5 });
      drawIcon('boot', ready ? '#5ad1ff' : '#5a6a80', px + 23, py + 20, 24);
      px += 52;
    }
    if (r.ghost && r.mode === 'trial') {
      const prev = G.save.levels[r.spec.id] && G.save.levels[r.spec.id].bestTime;
      if (prev) {
        ctx.textAlign = 'right';
        ui.fitText('best ' + formatTime(prev), right - 4, py + 54, 200, 13, { weight: 'bold', color: '#bfe8ff', outline: 'rgba(0,0,0,0.6)' });
      }
    }
    /* boss bar */
    const b = r.boss;
    if (b && b.active && b.alive) {
      const bw = 520, bx = VIEW_W / 2 - bw / 2, by = v.y1 - 62;
      ui.drawPanel(bx, by, bw, 46, { radius: 14, accent: '#ff6a6a', noStuds: true, alpha: 0.94 });
      drawIcon('skull', '#ff8a6a', bx + 26, by + 23, 26);
      ctx.textAlign = 'left';
      ui.fitText(b.name, bx + 46, by + 15, 240, 13, { weight: 'bold', color: '#ffd8c8' });
      ui.drawMeter(bx + 46, by + 26, bw - 64, 12, b.hp / b.maxHp, b.phase === 3 ? '#ff4a3a' : b.phase === 2 ? '#ff8a3a' : '#ffc84a');
    }
    /* toast */
    if (G.toast) {
      G.toast.t += G.frameDt;
      const k = G.toast.t;
      if (k > 2.4) {
        G.toast = null;
      } else {
        const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
        const y = 150 - (k < 0.2 ? (1 - k / 0.2) * 20 : 0);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = ui.uiFont(22, 'bold');
        const w = Math.min(640, ctx.measureText(G.toast.text).width + 60);
        ui.drawPanel(VIEW_W / 2 - w / 2, y - 22, w, 44, { radius: 18, noStuds: true, accent: G.toast.color, glow: true });
        ctx.textAlign = 'center';
        ui.fitText(G.toast.text, VIEW_W / 2, y + 1, w - 30, 21, { weight: 'bold', color: G.toast.color, outline: 'rgba(0,0,0,0.6)' });
        ctx.restore();
      }
    }
    if (r.introT > 0)
      drawIntroCard(r);
    if (r.koT > 0)
      drawKnockOut(r);
    if (r.clearT > 0) {
      const k = 1 - r.clearT / 1.3;
      ui.drawHeadline(r.mode === 'endless' ? 'Stage Clear!' : 'Level Clear!', VIEW_W / 2, 300 - (1 - Math.min(1, k * 3)) * 40, 900, 84, '#ffe9a0', '#ff9a2a');
    }
  }

  function drawIntroCard(r) {
    const k = r.introT / INTRO_TIME;
    const appear = Math.min(1, (1 - k) * 5);
    const leave = Math.min(1, r.introT / 0.35);
    const a = Math.min(appear, leave);
    const W = WORLDS[r.world];
    ctx.save();
    ctx.globalAlpha = a;
    const y = 230 + (1 - appear) * 30;
    ui.drawPanel(VIEW_W / 2 - 330, y, 660, 210, { accent: W.color, radius: 18 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let sub;
    if (r.mode === 'endless')
      sub = 'ENDLESS - ' + W.name.toUpperCase();
    else if (r.mode === 'daily')
      sub = 'DAILY RUN - ' + W.name.toUpperCase();
    else
      sub = W.name.toUpperCase() + ' - ' + (r.spec.index + 1) + (r.mode === 'trial' ? ' - TIME TRIAL' : '');
    ui.fitText(sub, VIEW_W / 2, y + 34, 600, 15, { weight: 'bold', color: W.color });
    ui.drawHeadline(r.level.name, VIEW_W / 2, y + 88, 600, 54, '#ffffff', W.accent);
    const gemsHave = r.gems.filter(g => g.old).length;
    const items = [];
    items.push({ icon: 'gem', text: gemsHave + ' / 3 gems', color: '#4aff8a' });
    items.push({ icon: 'clock', text: 'par ' + r.level.timeTarget + 's', color: '#bfe8ff' });
    if (r.boss)
      items.push({ icon: 'skull', text: r.boss.name, color: '#ff8a6a' });
    else if (r.mode === 'endless')
      items.push({ icon: 'heart', text: r.hearts + ' hearts', color: '#ff6a86' });
    else
      items.push({ icon: 'flag', text: r.checkpoints.length + ' checkpoints', color: '#ffe08a' });
    const w = 190;
    items.forEach((it, i) => {
      const x = VIEW_W / 2 + (i - (items.length - 1) / 2) * w;
      drawIcon(it.icon, it.color, x - 60, y + 152, 26);
      ctx.textAlign = 'left';
      ui.fitText(it.text, x - 42, y + 153, 130, 15, { weight: 'bold', color: '#e4eaf6' });
    });
    ctx.restore();
    if (r.introT < 0.55 && r.introT > 0) {
      const g = 1 - r.introT / 0.55;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - g) * 3);
      ui.drawHeadline('GO!', VIEW_W / 2, 340, 400, 90 + g * 60, '#fff2a0', '#ff8a2a');
      ctx.restore();
    }
  }

  function drawKnockOut(r) {
    const k = 1 - r.koT / KO_TIME;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3) * 0.55;
    const v = visibleRect();
    ctx.fillStyle = '#0a0410';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.globalAlpha = Math.min(1, k * 3);
    ui.drawHeadline(r.mode === 'endless' ? 'Run Over' : 'Knocked Out!', VIEW_W / 2, 320, 800, 80, '#ffb0a0', '#c82a3a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(r.mode === 'endless' ? 'Tallying your run...' : 'Back to the last checkpoint', VIEW_W / 2, 390, 600, 18, { color: '#e4eaf6' });
    ctx.restore();
  }

  function drawToastOnly() {
    G.toast.t += G.frameDt;
    if (G.toast.t > 2.4) {
      G.toast = null;
      return;
    }
    const k = G.toast.t;
    const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = ui.uiFont(20, 'bold');
    const w = Math.min(700, ctx.measureText(G.toast.text).width + 60);
    ui.drawPanel(VIEW_W / 2 - w / 2, 640, w, 42, { radius: 18, noStuds: true, accent: G.toast.color, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(G.toast.text, VIEW_W / 2, 662, w - 30, 19, { weight: 'bold', color: G.toast.color });
    ctx.restore();
  }

  function drawFade(dt, v) {
    if (G.fade <= 0)
      return;
    ctx.fillStyle = 'rgba(6,10,24,' + Math.min(1, G.fade).toFixed(3) + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    G.fade = Math.max(0, G.fade - dt * FADE_RATE);
  }

  Object.assign(NS.module('hud'), {
    drawHUD,
    drawToastOnly,
    drawFade
  });
})();
