/* Cinematic scenes: the Seed Tree (lit seed by seed, grey when robbed, blooming at the end), the
   theft by the Hollow Eclipse, Sola waking with Mossback and Pip, the journey and arrival in each
   world, guardian reveals with a slow push-in and a name card, guardians freed with their seed
   rising home, and the credits; all under cinematic bars with a dialogue box, speaker portrait
   and typewriter text. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { TAU, UI } = NS.constants;
  const { CAST } = NS.story;
  const { BOSSES, WORLDS } = NS.worlds;
  const K = NS.artKit;
  const kit = NS.kit;
  const SA = NS.snakeArt;
  const CA = NS.creatureArt;
  const { ctx, visible } = NS.view;

  const PX = new Float32Array(64), PY = new Float32Array(64);
  const SEEDS = [[-120, -150], [-60, -205], [10, -225], [80, -200], [130, -140]];

  function tree() {
    return K.sprite('seedtree', 520, 560, (g, w, h) => {
      const cx = w / 2;
      g.fillStyle = '#4a2e18';
      g.beginPath();
      g.moveTo(cx - 40, h); g.quadraticCurveTo(cx - 20, h - 160, cx - 30, h - 260);
      g.lineTo(cx + 30, h - 260); g.quadraticCurveTo(cx + 22, h - 160, cx + 46, h);
      g.closePath(); g.fill();
      g.strokeStyle = '#4a2e18'; g.lineCap = 'round';
      const br = [[-1, 140, 16], [1, 150, 14], [-0.4, 120, 12], [0.5, 110, 11]];
      for (let k = 0; k < br.length; ++k) {
        g.lineWidth = br[k][2];
        g.beginPath(); g.moveTo(cx, h - 250); g.quadraticCurveTo(cx + br[k][0] * 60, h - 320, cx + br[k][0] * br[k][1], h - 380); g.stroke();
      }
      const r = NS.rng.makeRng(42);
      for (let k = 0; k < 46; ++k) {
        const a = r() * TAU, d = r() * 170;
        const x = cx + Math.cos(a) * d * 1.25, y = h - 390 + Math.sin(a) * d * 0.7, rr = 40 + r() * 30;
        const gr = g.createRadialGradient(x - 10, y - 10, 4, x, y, rr);
        gr.addColorStop(0, '#9ae07a'); gr.addColorStop(0.7, '#3d8a32'); gr.addColorStop(1, 'rgba(40,100,40,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      }
    });
  }

  const TS = 0.82;

  function drawTree(x, y, lit, grey, t, bloom) {
    const tr = tree();
    K.blit(ctx, tr, x, y - tr.hh * TS + 30, TS);
    if (grey) {
      const v = visible();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'rgba(128,128,128,0.9)';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let k = 0; k < 5; ++k) {
      const sx = x + SEEDS[k][0] * TS, sy = y - 105 + SEEDS[k][1] * TS;
      if (k < lit) {
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#fff27a'), sx, sy, 1.6 + Math.sin(t * 3 + k) * 0.2, 0.9);
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, NS.itemArt.fruit('shard'), sx, sy, 1.1);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (bloom) {
      const r = NS.rng.makeRng(9);
      for (let k = 0; k < 60; ++k) {
        const a = r() * TAU, d = r() * 200;
        ctx.fillStyle = ['#ffb0d0', '#ffffff', '#ffe07a'][k % 3];
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d * 1.2 * TS, y - 215 + Math.sin(a) * d * 0.65 * TS, 5 + Math.sin(t * 2 + k) * 1.5, 0, TAU); ctx.fill();
      }
    }
  }

  function skyFill(top, bot) {
    const v = visible();
    const gr = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bot);
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function ground(col) {
    const v = visible();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(v.x0, v.y1);
    for (let x = v.x0; x <= v.x1 + 20; x += 20) ctx.lineTo(x, 480 + Math.sin(x * 0.01) * 14);
    ctx.lineTo(v.x1, v.y1);
    ctx.closePath();
    ctx.fill();
  }

  /* Sola: a snake along a wave, head toward +x */
  function sola(x, y, t, scale, len) {
    const n = len || 14;
    for (let k = 0; k < n; ++k) {
      PX[k] = x - k * 30 * scale;
      PY[k] = y + Math.sin(t * 4 - k * 0.6) * 14 * scale;
    }
    const ang = Math.atan2(PY[0] - PY[1], PX[0] - PX[1]);
    SA.drawChain(ctx, PX, PY, n, SA.skinOf(G.save.equip.skin), { angle: ang, scale: scale * 1.6, hat: G.save.equip.hat, blink: (t % 3) < 0.12 });
  }

  function tortoise(x, y, s) {
    const sp = K.sprite('tortoise', 200, 140, (g) => {
      g.fillStyle = '#8a9a5a';
      g.beginPath(); g.ellipse(160, 90, 30, 22, 0, 0, TAU); g.fill();
      g.fillStyle = '#6a7a4a';
      for (let k = 0; k < 4; ++k) { g.beginPath(); g.ellipse(50 + k * 34, 118, 14, 12, 0, 0, TAU); g.fill(); }
      const gr = g.createRadialGradient(80, 50, 10, 95, 75, 80);
      gr.addColorStop(0, '#a8c070'); gr.addColorStop(0.7, '#5a7a3a'); gr.addColorStop(1, '#3a4a20');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(95, 80, 78, 52, 0, Math.PI, 0); g.lineTo(173, 92); g.lineTo(17, 92); g.closePath(); g.fill();
      g.strokeStyle = '#3a4a20'; g.lineWidth = 3;
      for (let k = 0; k < 4; ++k) { g.beginPath(); g.arc(50 + k * 30, 70, 16, 0, TAU); g.stroke(); }
      g.fillStyle = '#7ec060';
      for (let k = 0; k < 6; ++k) { g.beginPath(); g.arc(60 + k * 14, 32 + (k % 2) * 6, 8, 0, TAU); g.fill(); }
      CA.eye(g, 170, 82, 6, '#3a2a10');
      g.strokeStyle = '#4a5a2a'; g.lineWidth = 2;
      g.beginPath(); g.arc(178, 98, 8, 0.2, 1.4); g.stroke();
      g.fillStyle = '#e0e0d0';
      g.beginPath(); g.moveTo(182, 104); g.quadraticCurveTo(196, 130, 178, 136); g.quadraticCurveTo(186, 118, 176, 106); g.fill();
    });
    K.blit(ctx, sp, x, y, s);
  }

  function pip(x, y, t, s) {
    ctx.globalCompositeOperation = 'lighter';
    K.blitAlpha(ctx, K.glow('#ffe07a'), x, y, 1.2 * s + Math.sin(t * 9) * 0.15, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    const sp = K.sprite('pip', 40, 40, (g) => {
      g.fillStyle = 'rgba(220,240,255,0.7)';
      g.beginPath(); g.ellipse(13, 12, 9, 5, -0.6, 0, TAU); g.ellipse(27, 12, 9, 5, 0.6, 0, TAU); g.fill();
      g.fillStyle = '#3a2a1a'; g.beginPath(); g.ellipse(20, 20, 8, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffe07a'; g.beginPath(); g.ellipse(20, 29, 7, 6, 0, 0, TAU); g.fill();
      CA.eye(g, 17, 18, 2.6); CA.eye(g, 24, 18, 2.6);
    });
    K.blit(ctx, sp, x, y + Math.sin(t * 6) * 4, s);
  }

  function portrait(id, x, y, r, t) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const gr = ctx.createRadialGradient(x, y - r * 0.4, 4, x, y, r);
    gr.addColorStop(0, K.shade(CAST[id].color, 0.3));
    gr.addColorStop(1, K.shade(CAST[id].color, -0.6));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (id === 'sola') K.blitRot(ctx, SA.head(SA.skinOf(G.save.equip.skin), (t % 3) < 0.12), x - 6, y + 4, 0, 2.2);
    else if (id === 'moss') tortoise(x - 50, y + 10, 0.9);
    else if (id === 'pip') pip(x, y, t, 1.5);
    else if (BOSSES[id]) K.blit(ctx, CA.boss(id, Math.floor(t * 3) % 2), x, y + 6, r * 2 / CA.BS * 1.3);
    ctx.restore();
    ctx.strokeStyle = CAST[id].color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }

  function scene(sh, t) {
    const v = visible();
    switch (sh.scene) {
      case 'tree': {
        const lit = sh.lit || 0;
        if (sh.grey) skyFill('#1a1a24', '#3a3a44');
        else if (lit >= 5) skyFill('#2a3a7a', '#f0c080');
        else skyFill('#0a1430', '#2a4a5a');
        ground(sh.grey ? '#2a2a30' : '#2d5a22');
        drawTree(640, 490, lit, sh.grey, t, false);
        break;
      }
      case 'theft': {
        skyFill('#05030a', '#1a0a2a');
        ground('#100a14');
        drawTree(400, 490, Math.max(0, 5 - Math.floor(t * 1.6)), true, t, false);
        const ex = 860 + Math.sin(t) * 20, ey = 230;
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#c08cff'), ex, ey, 7, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, CA.boss('eclipse', Math.floor(t * 3) % 2), ex, ey, 3.2);
        for (let k = 0; k < 5; ++k) {
          const p = Math.min(1, Math.max(0, t * 0.5 - k * 0.15));
          const sx = 400 + SEEDS[k][0] * TS, sy = 385 + SEEDS[k][1] * TS;
          if (p <= 0 || p >= 1) continue;
          K.blit(ctx, NS.itemArt.fruit('shard'), sx + (ex - sx) * p, sy + (ey - sy) * p - Math.sin(p * Math.PI) * 80, 1.2 * (1 - p * 0.6));
        }
        break;
      }
      case 'wake':
      case 'journey':
      case 'world': {
        const th = sh.world !== undefined ? WORLDS[sh.world].theme : 0;
        NS.backdrop.draw(th, 0);
        if (sh.scene === 'wake') {
          tortoise(880, 400, 1.6);
          sola(520, 440, t, 1, 10);
          pip(700 + Math.sin(t * 1.3) * 60, 260 + Math.cos(t * 1.7) * 30, t, 1.6);
        } else if (sh.scene === 'journey') {
          sola(((t * 140) % (v.w + 600)) + v.x0 - 200, 450, t, 0.9, 16);
          pip(((t * 140) % (v.w + 600)) + v.x0 - 120, 380, t, 1.2);
        } else {
          sola(380 + Math.min(1, t * 0.4) * 140, 440, t, 0.8, 10);
          pip(560, 360, t, 1.1);
          const a = Math.min(1, t * 1.5);
          ctx.globalAlpha = a;
          kit.text(WORLDS[sh.world].name.toUpperCase(), 640, 150 + (1 - a) * 20, 54, '#ffffff', { align: 'center', weight: 'bold' });
          kit.text(WORLDS[sh.world].tagline, 640, 200, 18, UI.textDim, { align: 'center' });
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'boss': {
        const def = BOSSES[sh.boss];
        NS.backdrop.draw(WORLDS[def.world].theme, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
        const z = 2.6 + Math.min(1, t * 0.3) * 0.6;
        const sh2 = t < 0.6 ? (Math.random() - 0.5) * 10 : 0;
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(def.accent), 640, 360, 6, 0.4);
        ctx.globalCompositeOperation = 'source-over';
        if (sh.boss === 'wyrm') {
          for (let k = 0; k < 14; ++k) { PX[k] = 820 - k * 46; PY[k] = 380 + Math.sin(t * 3 - k * 0.5) * 40; }
          SA.drawChain(ctx, PX, PY, 14, CA.WYRM_SKIN, { angle: Math.atan2(PY[0] - PY[1], PX[0] - PX[1]), scale: 2.4, hat: 'horns' });
        } else K.blit(ctx, CA.boss(sh.boss, Math.floor(t * 3) % 2), 640 + sh2, 340, z);
        const a = Math.min(1, Math.max(0, t - 0.4) * 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = K.rgba(def.accent, 0.85);
        ctx.fillRect(v.x0, 120, v.w, 4);
        kit.text(def.name.toUpperCase(), 640 - (1 - a) * 80, 80, 40, '#ffffff', { align: 'center', weight: 'bold' });
        kit.text(def.title, 640, 112, 16, def.accent, { align: 'center' });
        ctx.globalAlpha = 1;
        break;
      }
      case 'freed': {
        const def = BOSSES[sh.boss];
        NS.backdrop.draw(WORLDS[def.world].theme, 0);
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#fff6c0'), 760, 330, 7, 0.35);
        ctx.globalCompositeOperation = 'source-over';
        if (sh.boss === 'wyrm') {
          for (let k = 0; k < 10; ++k) { PX[k] = 860 - k * 40; PY[k] = 380 + Math.sin(t * 2 - k * 0.5) * 16; }
          SA.drawChain(ctx, PX, PY, 10, CA.WYRM_SKIN, { angle: Math.PI * 0.05, scale: 2 });
        } else K.blit(ctx, CA.boss(sh.boss, Math.floor(t * 2) % 2), 800, 360, 2.2);
        sola(420, 450, t, 0.9, 10);
        const sy = 300 - Math.min(1, t * 0.35) * 220;
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#fff27a'), 640, sy, 2.2, 0.9);
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, NS.itemArt.fruit('shard'), 640, sy, 1.6);
        break;
      }
      case 'bloom': {
        skyFill('#5a8ad8', '#ffd8a0');
        ground('#3f8a30');
        drawTree(640, 490, 5, false, t, true);
        sola(360, 470, t, 0.8, 12);
        tortoise(960, 450, 1.1);
        for (let k = 0; k < 3; ++k) {
          const ft = (t * 0.7 + k * 0.33) % 1;
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(['#ff5a8a', '#6fd3ff', '#ffd23a'][k]), 300 + k * 340, 160 + k * 30, ft * 3, 1 - ft);
          ctx.globalCompositeOperation = 'source-over';
        }
        break;
      }
      case 'credits': {
        skyFill('#05070f', '#1a1030');
        for (let k = 0; k < 80; ++k) { ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(t + k))) + ')'; ctx.fillRect((k * 173) % 1280, (k * 97) % 520, 2, 2); }
        K.blit(ctx, kit.logo(), 640, 250, 0.9);
        break;
      }
    }
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const sh = c.shots[c.i];
    const t = c.t;
    scene(sh, t);
    const v = visible();
    /* cinematic bars */
    ctx.fillStyle = '#000000';
    ctx.fillRect(v.x0, v.y0, v.w, 46 - v.y0);
    ctx.fillRect(v.x0, 674, v.w, v.y1 - 674);
    /* fade between shots */
    if (t < 0.35) {
      ctx.globalAlpha = 1 - t / 0.35;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.globalAlpha = 1;
    }
    /* dialogue */
    const bx = 150, by = 520, bw = 980, bh = 136;
    kit.panel(bx, by, bw, bh, { accent: sh.speaker ? CAST[sh.speaker].color : UI.gold, glow: true, alpha: 0.96 });
    let tx = bx + 28;
    if (sh.speaker) {
      portrait(sh.speaker, bx + 76, by + bh / 2, 52, t);
      tx = bx + 150;
      kit.text(CAST[sh.speaker].name, tx, by + 26, 19, CAST[sh.speaker].color, { weight: 'bold' });
    }
    const shown = sh.text.slice(0, Math.floor(c.typed));
    kit.wrap(shown, tx, by + (sh.speaker ? 46 : 30), bx + bw - tx - 30, sh.speaker ? 19 : 21, 27, '#ffffff', { weight: sh.speaker ? 'normal' : 'bold' });
    if (c.typed >= sh.text.length && Math.floor(G.time * 2) % 2 === 0) kit.icon('play', bx + bw - 24, by + bh - 22, 16, UI.gold);
    kit.text((c.i + 1) + ' / ' + c.shots.length + '   any key: continue   Esc: skip', 640, 697, 13, 'rgba(255,255,255,0.55)', { align: 'center' });
  }

  Object.assign(NS.cineRender, {
    draw, drawTree, sola, tortoise, pip, portrait
  });
})();
