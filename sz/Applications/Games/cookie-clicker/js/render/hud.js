/* The bakery screen's heads-up layer: the big treat with idle bob, breathing, hover and click
   squash, candle flames and starlight twinkles, the planet's moons; the smooth cookie counter
   and rate; the currency and era strip (recipe notes, sugar crystals with the Ascend chip,
   streak, season tokens, era progress, or the Bake-Off clock); the combo meter; active buffs
   on the counter; golden treats in every seasonal shape and the Cookie Storm drops. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { LAYOUT, UI, TAU } = NS.constants;
  const K = NS.artKit;
  const TA = NS.treatArt;
  const E = NS.economy;
  const kit = NS.kit;
  const fmt = NS.format;
  const W = NS.widgets;
  const { STAGES } = NS.treatData;
  const { ctx } = NS.view;

  /* opts: stage, skin, mask, x, y, scale, alpha, white, noHover */
  function drawTreat(opts) {
    opts = opts || {};
    const run = G.active();
    const stage = opts.stage != null ? opts.stage : run.stage;
    const skin = opts.skin || G.profile.skin;
    const mask = opts.mask != null ? opts.mask : (G.st ? G.st.decoMask : 0);
    const x = opts.x != null ? opts.x : LAYOUT.treatX, y = opts.y != null ? opts.y : LAYOUT.treatY;
    const t = G.time;
    const img = TA.sprite(stage, skin, mask);
    const hover = !opts.noHover && G.input.moved > 0 && Math.hypot(G.input.mx - x, G.input.my - y) < LAYOUT.treatR;
    const sq = G.treatSquash;
    const breathe = (1 + Math.sin(t * 2) * 0.012) * (hover ? 1.035 : 1) * (opts.scale || 1);
    const sx = breathe * (1 - sq * 0.018), sy = breathe * (1 + sq * 0.022);
    const bob = Math.sin(t * 1.6) * 4;
    const rot = stage <= 2 ? Math.sin(t * 0.5) * 0.05 : Math.sin(t * 0.8) * 0.012;
    ctx.save();
    ctx.translate(x, y + bob);
    if (stage === 7) moons(t, false);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(img, -TA.OX, -TA.OY);
    if (opts.white) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = opts.white;
      ctx.drawImage(img, -TA.OX, -TA.OY);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    if (mask & 8) flames(stage, t);
    if (mask & 32) twinkle(stage, t);
    ctx.restore();
    if (stage === 7) {
      ctx.save();
      ctx.translate(x, y + bob);
      moons(t, true);
      ctx.restore();
    }
    return hover;
  }

  function flames(stage, t) {
    const pts = TA.flames(stage);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length; ++i) {
      const f = 1 + Math.sin(t * 17 + i * 2) * 0.12 + Math.sin(t * 29 + i) * 0.06;
      ctx.globalAlpha = 0.55;
      K.blit(ctx, K.glow('#ffb45a'), pts[i][0], pts[i][1], 0.38 * f);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd25a';
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1] - 11 * f);
      ctx.quadraticCurveTo(pts[i][0] + 5, pts[i][1], pts[i][0], pts[i][1] + 5);
      ctx.quadraticCurveTo(pts[i][0] - 5, pts[i][1], pts[i][0], pts[i][1] - 11 * f);
      ctx.fill();
      K.circle(ctx, pts[i][0], pts[i][1] + 1, 2.2, '#ffffff');
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function twinkle(stage, t) {
    const pts = TA.twinkles(stage);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < pts.length; ++i) {
      const s = Math.max(0, Math.sin(t * 2.4 + i * 1.9)) * 7;
      if (s < 0.5) continue;
      K.star(ctx, pts[i][0], pts[i][1], s, 0.22, 4);
      ctx.fill();
    }
  }

  /* the planet's live sky: two moons and a delivery shuttle in orbit, twinkling city lights */
  function moons(t, front) {
    const a = t * 0.9;
    if ((Math.sin(a) > 0) === front) {
      const x = Math.cos(a) * 172, y = Math.sin(a) * 52 - 10 - Math.cos(a) * 30;
      const dx = -Math.sin(a) * 172, dy = Math.cos(a) * 52 + Math.sin(a) * 30;
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      K.blit(ctx, K.glow('#ffb45a'), -10, 0, 0.18);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f4f0ff';
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -4); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5ab4';
      ctx.fillRect(-7, -5, 3, 10);
      ctx.restore();
    }
    if (front) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; ++i) {
        const s = Math.sin(t * 1.7 + i * 2.3);
        if (s < 0.4) continue;
        const b = 0.2 + i * 0.25;
        ctx.globalAlpha = (s - 0.4) * 1.4;
        K.blit(ctx, K.glow('#ffd27a'), Math.cos(b) * (70 + i * 7), Math.sin(b) * (70 + i * 7), 0.12);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < 2; ++i) {
      const a = t * (0.5 + i * 0.3) + i * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = Math.cos(a) * (160 + i * 30), y = Math.sin(a) * 30 - 40 + i * 60;
      K.circle(ctx, x, y, 11 - i * 3, i ? '#ff9ac8' : '#e8e0d0');
      K.circle(ctx, x - 3, y - 3, 3, 'rgba(255,255,255,0.6)');
    }
  }

  /* ---- top strip ---- */
  function drawCounter() {
    const run = G.active();
    const L = LAYOUT;
    const shown = G.ui.displayCookies;
    const big = shown >= 1e6 ? fmt.long(shown) : fmt.group(shown);
    const pulse = G.ui.pulse;
    kit.fitText(big, L.treatX, 34, 420, 40 + pulse * 6, { align: 'center', weight: 'bold', color: '#ffe6b0', shadow: 'rgba(60,20,0,0.9)' });
    const cps = G.st ? NS.production.cpsOf(run, G.st) : 0;
    const boosted = E.buffMult(run, 'prod') > 1;
    kit.text((run.stage >= 3 ? 'treats' : 'cookies') + '  -  ' + fmt.rate(cps) + ' per second', L.treatX, 68, 16, boosted ? '#ffb45a' : UI.textDim, { align: 'center', weight: boosted ? 'bold' : 'normal', shadow: true });
  }

  function chip(id, x, y, w, iconName, color, label, action, glow) {
    const hot = action ? W.area(id, x, y, w, 30, action) : false;
    kit.panel(x, y, w, 30, { radius: 15, accent: color, glow: hot || glow, alpha: 0.95 });
    kit.icon(iconName, x + 17, y + 15, 18, color);
    kit.fitText(label, x + 32, y + 16, w - 40, 14, { weight: 'bold', color: hot ? '#ffffff' : UI.text });
  }

  function drawStrip() {
    const p = G.profile;
    const x0 = 470;
    if (G.bake) return drawBakeStrip();
    chip('chip-notes', x0, 12, 104, 'note', UI.notes, fmt.short(p.notes), () => NS.screens.openTree('game', 0));
    const pend = NS.prestige.pending();
    if (pend >= 1)
      chip('chip-ascend', x0 + 110, 12, 128, 'crystal', UI.crystal, 'Ascend +' + fmt.short(pend), () => NS.screens.openAscend('game'), Math.sin(G.time * 4) > 0);
    else chip('chip-crystals', x0 + 110, 12, 128, 'crystal', UI.crystal, fmt.short(p.crystals) + ' crystals', () => NS.screens.openTree('game', 1));
    const streak = p.streak.last === G.today ? p.streak.count : 0;
    chip('chip-streak', x0 + 244, 12, 92, 'calendar', UI.good, 'Day ' + Math.max(1, streak), () => NS.screens.openJournal('game', 1));
    chip('chip-season', x0 + 342, 12, 98, 'leaf', '#ff9ac8', fmt.short(p.season.tokens[G.season] || 0), () => NS.screens.openJournal('game', 2));
    /* era bar */
    const run = G.run;
    const s = run.stage;
    const next = STAGES[s + 1];
    const label = 'ERA ' + NS.cinematics.ROMAN[s] + '  ' + STAGES[s].era;
    kit.text(label, x0 + 2, 56, 13, UI.gold, { weight: 'bold', shadow: true });
    if (next) {
      const prev = STAGES[s].need;
      const f = (Math.log10(Math.max(1, run.baked)) - Math.log10(Math.max(1, prev))) / (Math.log10(next.need) - Math.log10(Math.max(1, prev)));
      kit.bar(x0, 66, 440, 10, f, s >= 5 ? '#b48aff' : '#ffb45a');
      kit.text('next: ' + next.name + ' at ' + fmt.short(next.need) + ' baked', x0 + 438, 56, 12, UI.textDim, { align: 'right' });
    } else {
      kit.bar(x0, 66, 440, 10, 1, '#8ad0ff');
      kit.text('the final era', x0 + 438, 56, 12, UI.textDim, { align: 'right' });
    }
  }

  function drawBakeStrip() {
    const b = G.bake;
    const x0 = 470;
    const t = b.timeLeft;
    const urgent = t < 20;
    kit.panel(x0, 10, 440, 70, { accent: urgent ? UI.bad : UI.gold, glow: urgent && Math.sin(G.time * 8) > 0 });
    kit.text(b.mode === 'daily' ? 'DAILY BAKE-OFF' : 'BAKE-OFF', x0 + 16, 28, 14, UI.gold, { weight: 'bold' });
    kit.text(b.mods ? b.mods.name + ': ' + b.mods.desc : 'Bake as much as you can!', x0 + 16, 50, 12, UI.textDim);
    const best = G.profile.stats.bakeBest;
    kit.text('best ' + fmt.short(best), x0 + 16, 68, 12, UI.textMute);
    kit.text(fmt.clock(t), x0 + 424, 44, 40 * (urgent ? 1 + Math.max(0, Math.sin(G.time * 8)) * 0.06 : 1), urgent ? UI.bad : '#ffffff', { align: 'right', weight: 'bold', shadow: true });
  }

  /* ---- combo and buffs ---- */
  function drawCombo() {
    const run = G.active();
    const st = G.st;
    if (!st || run.combo < 2) return;
    const L = LAYOUT;
    const f = NS.clicking.comboFill(run, st);
    const y = L.treatY + 168, w = 240;
    const a = Math.min(1, run.combo / 4);
    ctx.globalAlpha = a;
    const col = f >= 1 ? '#ff5ab4' : K.mix('#ffd25a', '#ff7a3a', f);
    kit.bar(L.treatX - w / 2, y, w, 14, f, col);
    kit.text('COMBO x' + Math.floor(run.combo), L.treatX - w / 2, y - 12, 16 + Math.min(8, run.combo / 15), col, { weight: 'bold', shadow: true });
    kit.text('clicks x' + E.comboMult(run, st).toFixed(2), L.treatX + w / 2, y - 12, 13, UI.textDim, { align: 'right' });
    ctx.globalAlpha = 1;
  }

  function drawBuffs() {
    const run = G.active();
    let x = 16;
    const y = 674;
    for (let i = 0; i < run.buffs.length && i < 4; ++i) {
      const b = run.buffs[i];
      const w = 214;
      kit.panel(x, y, w, 36, { radius: 10, accent: b.color, glow: b.t < 3 && Math.sin(G.time * 10) > 0 });
      kit.icon(b.kind === 'click' ? 'hand' : 'bolt', x + 20, y + 18, 20, b.color);
      kit.fitText(b.name + '  x' + (b.mult >= 10 ? Math.round(b.mult) : b.mult.toFixed(1)), x + 36, y + 13, w - 80, 13, { weight: 'bold', color: '#ffffff' });
      kit.text(Math.ceil(b.t) + 's', x + w - 10, y + 13, 13, b.color, { align: 'right', weight: 'bold' });
      kit.bar(x + 36, y + 25, w - 48, 5, b.t / b.dur, b.color);
      x += w + 8;
      if (x > 430) { x = 16; }
    }
  }

  /* ---- golden treats ---- */
  function goldenSprite(kind) {
    return K.sprite('golden:' + kind, 84, 84, (g) => {
      g.translate(42, 42);
      const gr = g.createRadialGradient(0, 0, 10, 0, 0, 42);
      gr.addColorStop(0, 'rgba(255,230,140,0.55)');
      gr.addColorStop(1, 'rgba(255,230,140,0)');
      g.fillStyle = gr;
      g.fillRect(-42, -42, 84, 84);
      const gold = g.createRadialGradient(-8, -10, 2, 0, 0, 28);
      gold.addColorStop(0, '#fffbe0');
      gold.addColorStop(0.5, '#ffd25a');
      gold.addColorStop(1, '#b8801a');
      g.fillStyle = gold;
      g.strokeStyle = '#8a5a10';
      g.lineWidth = 2;
      if (kind === 'golden') {
        K.circle(g, 0, 0, 26);
        g.fill();
        g.stroke();
        for (let i = 0; i < 5; ++i) K.circle(g, Math.cos(i * 1.3) * 13, Math.sin(i * 1.3) * 13, 3.5, 'rgba(150,90,10,0.6)');
      } else if (kind === 'snowflake') {
        g.lineWidth = 6;
        g.strokeStyle = gold;
        for (let i = 0; i < 6; ++i) {
          const a = i / 6 * TAU;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
          g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
          g.lineTo(Math.cos(a + 0.5) * 22, Math.sin(a + 0.5) * 22);
          g.stroke();
        }
      } else if (kind === 'egg') {
        K.ellipse(g, 0, 2, 21, 27);
        g.fill();
        g.stroke();
        g.strokeStyle = '#ff5ab4';
        g.lineWidth = 4;
        g.beginPath();
        for (let x = -20; x <= 20; x += 6) g.lineTo(x, 2 + (x / 6 % 2 ? -4 : 4));
        g.stroke();
      } else if (kind === 'sun') {
        for (let i = 0; i < 10; ++i) {
          const a = i / 10 * TAU;
          g.beginPath();
          g.moveTo(Math.cos(a - 0.15) * 18, Math.sin(a - 0.15) * 18);
          g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
          g.lineTo(Math.cos(a + 0.15) * 18, Math.sin(a + 0.15) * 18);
          g.fill();
        }
        K.circle(g, 0, 0, 19);
        g.fill();
      } else if (kind === 'leaf') {
        g.beginPath();
        g.moveTo(-26, 20);
        g.quadraticCurveTo(-26, -24, 26, -24);
        g.quadraticCurveTo(26, 20, -26, 20);
        g.fill();
        g.stroke();
      } else if (kind === 'pumpkin') {
        for (let i = -1; i <= 1; ++i) K.ellipse(g, i * 10, 4, 14, 20, i ? '#f08a2a' : '#ffb04a');
        g.fillStyle = '#4a6a2a';
        g.fillRect(-3, -22, 6, 9);
        g.fillStyle = '#fff4b0';
        g.fillRect(-10, -2, 6, 6);
        g.fillRect(4, -2, 6, 6);
      } else {
        g.fillRect(-22, -14, 44, 36);
        g.strokeRect(-22, -14, 44, 36);
        g.fillStyle = '#e83a5a';
        g.fillRect(-4, -14, 8, 36);
        g.fillRect(-24, -20, 48, 10);
        K.circle(g, -7, -22, 7, '#e83a5a');
        K.circle(g, 7, -22, 7, '#e83a5a');
      }
      K.circle(g, -8, -10, 4, 'rgba(255,255,255,0.7)');
    });
  }

  function dropSprite() {
    return K.sprite('stormdrop', 44, 44, (g) => {
      g.translate(22, 22);
      const gr = g.createRadialGradient(-5, -6, 2, 0, 0, 18);
      gr.addColorStop(0, '#f0c890');
      gr.addColorStop(1, '#a0622c');
      K.circle(g, 0, 0, 17, gr);
      for (let i = 0; i < 4; ++i) K.circle(g, Math.cos(i * 1.6) * 8, Math.sin(i * 1.6) * 8, 2.6, '#4a2a14');
    });
  }

  function drawGoldens() {
    for (let i = 0; i < G.goldens.length; ++i) {
      const g = G.goldens[i];
      const left = g.life - g.age;
      if (left < 2.5 && Math.sin(G.time * 18) > 0.3) continue;
      const appear = Math.min(1, g.age * 3);
      const s = appear * (1 + Math.sin(G.time * 4 + g.phase) * 0.07);
      const y = g.y + Math.sin(G.time * 1.7 + g.phase) * 8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow('#ffd25a'), g.x, y, 1.3 * s);
      ctx.restore();
      ctx.save();
      ctx.translate(g.x, y);
      ctx.rotate(Math.sin(G.time * 1.2 + g.phase) * 0.25);
      ctx.scale(s, s);
      ctx.drawImage(goldenSprite(g.carrier), -42, -42);
      ctx.restore();
    }
    if (G.storm) {
      const img = dropSprite();
      const D = NS.golden.DROPS;
      for (let k = 0; k < D.length; ++k) {
        const d = D[k];
        if (!d.on) continue;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.drawImage(img, -22, -22);
        ctx.restore();
      }
    }
  }

  Object.assign(NS.hud, { drawTreat, drawCounter, drawStrip, drawCombo, drawBuffs, goldenSprite, dropSprite, drawGoldens, chip });
})();
