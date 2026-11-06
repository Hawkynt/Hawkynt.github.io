/* The living things of a run and the whole run scene in order: sky, course, the best-run
   ghost, effects behind, the runner (pose from its state, squash and stretch, the flip of a
   double jump, a scarf that streams behind, shield bubble, jetpack or rocket, giant growth,
   ghostly fading, blinking while untouchable), the guardians (chasers at the runner's heels with
   an off-screen warning, duel bosses ahead with flinch and defeat), projectiles with their
   telegraphs at the screen edge, spark bolts, effects in front, Night Run's darkness and the
   weather. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { GROUND_Y, TAU } = C;
  const K = NS.artKit;
  const RA = NS.runnerArt;
  const BA = NS.bossArt;
  const PA = NS.propArt;
  const PW = NS.powers;
  const WR = NS.world;
  const { ctx } = NS.view;

  function poseOf(run) {
    const p = run.p;
    if (p.dead) return ['hurt', 0];
    if (run.phase === 'ready' && !run.demo) return ['idle', 0];
    if (p.fly) return ['fly', 0];
    if (p.slideT > 0) return ['slide', 0];
    if (p.dashT > 0) return ['dash', 0];
    if (!p.ground) {
      if (run.flip > 0) return ['ball', 0];
      return [p.vy < 0 ? 'jump' : 'fall', 0];
    }
    return ['run', Math.floor(p.x / 26) % RA.RUN_FRAMES];
  }

  function equip(run) {
    const e = G.save.equip;
    return run.demo ? { char: run.demoChar || 'nova', outfit: 'classic' } : e;
  }

  /* the scarf: a ribbon from the neck streaming back, waving with speed */
  function scarf(run, nx, ny, color, k) {
    const t = G.time;
    const p = run.p;
    const len = (p.fly ? 46 : 34) * k;
    ctx.strokeStyle = '#141224';
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; ++pass) {
      ctx.lineWidth = (pass ? 5 : 8) * k;
      ctx.strokeStyle = pass ? color : '#141224';
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(nx - len * 0.5, ny + Math.sin(t * 14) * 6 * k - (p.vy < 0 ? 4 : -2), nx - len, ny + Math.sin(t * 14 + 1.4) * 9 * k + (p.ground ? 4 : -p.vy * 0.012));
      ctx.stroke();
    }
  }

  function runner(run) {
    const p = run.p;
    const eq = equip(run);
    const ps = poseOf(run);
    const spr = RA.frame(eq.char, eq.outfit, ps[0], ps[1]);
    const k = p.scale * 1.12;
    let sx = 1, sy = 1;
    if (run.sq > 0) { sy = 1 + run.sq * 0.5; sx = 1 - run.sq * 0.3; } else if (run.sq < 0) { sy = 1 + run.sq * 0.6; sx = 1 - run.sq * 0.45; }
    let alpha = 1;
    if (PW.on(run, 'ghost')) alpha = 0.45 + 0.1 * Math.sin(G.time * 8);
    if (p.invT > 0 && !p.fly && run.phase === 'play' && p.invT < 50) alpha *= (Math.floor(G.time * 16) % 2) ? 0.35 : 0.9;
    const t = G.time;
    /* gear under the runner */
    if (p.fly === 2) {
      ctx.save();
      ctx.translate(p.x, p.y - 20);
      K.blit(ctx, PA.icon('rocket'), 0, 10, 2.2);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.dead) ctx.rotate(-p.deadSpin);
    else if (ps[0] === 'ball') { ctx.translate(0, -40 * k); ctx.rotate((1 - run.flip) * TAU); ctx.translate(0, 40 * k); }
    ctx.scale(sx * k, sy * k);
    ctx.globalAlpha = alpha;
    if (!p.dead && ps[0] !== 'ball') {
      const n = RA.neckOf(ps[0], ps[1]);
      scarf(run, n.x, n.y, RA.accentOf(eq.char, eq.outfit), 1);
    }
    if (p.fly === 1) {
      ctx.fillStyle = '#5a6478';
      K.roundRect(ctx, -26, -64, 16, 30, 5); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow('#ffb03a'), -18, -28 + Math.sin(t * 40) * 3, 0.9, 0.9);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(spr.canvas, -RA.OX, -RA.OY, RA.W, RA.H);
    ctx.restore();
    ctx.globalAlpha = 1;
    /* shield bubble, magnet hum */
    if (run.shieldHits > 0) {
      const r = 52 * k + Math.sin(t * 6) * 2;
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow('#5ee0ff'), p.x, p.y - 38 * k, r / 24, 0.35);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(160,240,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y - 38 * k, r, 0, TAU); ctx.stroke();
    }
    if (PW.on(run, 'magnet')) {
      const f = (t * 1.6) % 1;
      ctx.strokeStyle = 'rgba(255,90,106,' + (0.5 * (1 - f)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y - 38, 30 + f * 90, 0, TAU); ctx.stroke();
    }
  }

  /* the best run's ghost: a pale silhouette racing alongside */
  function ghost(run) {
    const gp = NS.run.ghostAt(run);
    if (!gp || gp.x < WR.VR.x0 - 60 || gp.x > WR.VR.x1 + 60) return;
    const spr = RA.frame('nova', 'classic', gp.y < GROUND_Y - 2 ? 'jump' : 'run', Math.floor(gp.x / 26) % RA.RUN_FRAMES);
    const sil = K.silhouette('ghost:' + (gp.y < GROUND_Y - 2 ? 'j' : Math.floor(gp.x / 26) % RA.RUN_FRAMES), spr);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(sil.canvas, gp.x - RA.OX, gp.y - RA.OY, RA.W, RA.H);
    ctx.globalAlpha = 1;
  }

  /* ── guardians ── */
  /* how far behind the runner the chaser is drawn: the lead squeezed onto the screen */
  function chaserGap(lead) {
    return 70 + Math.max(0, lead) * 0.5;
  }

  function boss(run) {
    const bs = run.bs;
    if (!bs || bs.phase === 'gone') return;
    const p = run.p;
    const t = G.time;
    const f = Math.floor(t * 8) % 2;
    if (bs.chase) {
      if (bs.phase === 'defeat') return;
      const x = p.x - chaserGap(bs.lead);
      const spr = BA.sprite(bs.id, f);
      if (bs.id === 'boar') K.blit(ctx, spr, x - 60, GROUND_Y - 96 + (f ? -4 : 0), 1);
      else K.blit(ctx, spr, x - 120, GROUND_Y - 200, 1);
      if (Math.random() < 0.5) NS.fx.spawn(NS.fx.DOT, x, GROUND_Y - 6, -200 - Math.random() * 200, -100 - Math.random() * 200, 0.6, 10, bs.id === 'boar' ? '#c8a070' : '#ffffff', 600, 0);
      return;
    }
    const b = NS.bosses.pos(run);
    const spr = BA.sprite(bs.id, f);
    const shakeX = bs.flinch > 0 ? Math.sin(t * 80) * 8 : 0;
    ctx.globalAlpha = bs.phase === 'defeat' ? Math.max(0, 1 - bs.defeatT / 1.6) : 1;
    ctx.globalCompositeOperation = 'lighter';
    K.blitAlpha(ctx, K.glow(NS.bosses.DEF[bs.id].color), b.x, b.y, 6, 0.25);
    ctx.globalCompositeOperation = 'source-over';
    K.blit(ctx, spr, b.x + shakeX, b.y, 1);
    if (bs.id === 'wyrm') {
      ctx.fillStyle = '#c08048';
      ctx.beginPath(); ctx.ellipse(b.x, GROUND_Y + 4, 120, 26, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e0a060';
      ctx.beginPath(); ctx.ellipse(b.x - 10, GROUND_Y + 2, 90, 14, 0, Math.PI, 0); ctx.fill();
      if (Math.random() < 0.4) NS.fx.spawn(NS.fx.DOT, b.x + (Math.random() - 0.5) * 200, GROUND_Y - 6, (Math.random() - 0.5) * 200, -200 - Math.random() * 200, 0.7, 8, '#e0a060', 900, 1);
    }
    if (bs.flinch > 0) {
      ctx.globalAlpha = bs.flinch;
      K.blit(ctx, K.silhouette('boss:' + bs.id + ':' + f, spr), b.x + shakeX, b.y, 1);
    }
    ctx.globalAlpha = 1;
    if (bs.id === 'king' && bs.hp <= bs.maxHp / 2 && bs.phase === 'fight') {
      const wall = BA.shadowWall();
      const x = p.x - bs.wallLead - wall.w + 60;
      ctx.drawImage(wall.canvas, x, WR.VR.y0 - 20, wall.w, WR.VR.y1 - WR.VR.y0 + 40);
    }
  }

  function shots(run) {
    const t = G.time;
    for (let i = 0; i < run.projs.length; ++i) {
      const q = run.projs[i];
      if (q.dead) continue;
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(NS.bosses.DEF[q.look] ? NS.bosses.DEF[q.look].color : '#ffffff'), q.x + 10, q.y, 1.4, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, PA.proj(q.look), q.x, q.y, Math.sin(t * 20 + q.id) * 0.05, 1);
    }
    for (let i = 0; i < run.bolts.length; ++i) {
      const b = run.bolts[i];
      const to = NS.bosses.pos(run);
      const x = b.x0 + (to.x - b.x0) * b.t, y = b.y0 + (to.y - b.y0) * b.t - Math.sin(b.t * Math.PI) * 160;
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow('#5ee0ff'), x, y, 1.8, 1);
      ctx.globalCompositeOperation = 'source-over';
      NS.fx.spawn(NS.fx.GLOW, x, y, 0, 0, 0.3, 18, '#5ee0ff', 0, 1);
    }
  }

  /* volleys about to fire: chevrons at the right edge on their lane */
  function telegraphs(run) {
    const bs = run.bs;
    if (!bs || !bs.queue.length) return;
    const x = WR.VR.x1 - 60 / G.cam.zoom;
    for (let i = 0; i < bs.queue.length; ++i) {
      const q = bs.queue[i];
      if (q.t > 0.9) continue;
      const a = 0.5 + 0.5 * Math.sin(G.time * 20);
      WR.alert(x, q.y, q.y === NS.bosses.LOW ? '#ff5a6a' : '#5ee0ff');
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = q.y === NS.bosses.LOW ? '#ff5a6a' : '#5ee0ff';
      ctx.fillRect(x - 200, q.y - 2, 160, 4);
      ctx.globalAlpha = 1;
    }
  }

  /* Night Run: darkness everywhere but a pool of light around the runner (plane coordinates) */
  function darkness(run) {
    const v = NS.view.visible();
    const cam = G.cam;
    const sx = (run.p.x - cam.x) * cam.zoom, sy = GROUND_Y + (run.p.y - 40 - GROUND_Y - cam.y) * cam.zoom;
    const r = 300;
    const spr = K.sprite('darkhole', 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,8,0)');
      gr.addColorStop(1, 'rgba(0,0,8,0.92)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    ctx.fillStyle = 'rgba(0,0,8,0.92)';
    ctx.fillRect(v.x0, v.y0, v.w, sy - r - v.y0);
    ctx.fillRect(v.x0, sy + r, v.w, v.y1 - sy - r);
    ctx.fillRect(v.x0, sy - r, sx - r - v.x0, 2 * r);
    ctx.fillRect(sx + r, sy - r, v.x1 - sx - r, 2 * r);
    ctx.drawImage(spr.canvas, sx - r, sy - r, 2 * r, 2 * r);
  }

  /* the whole run scene */
  function draw(run) {
    const cam = G.cam;
    NS.backdrop.draw(run, cam);
    ctx.save();
    WR.enter(cam);
    WR.ground(run);
    WR.plats(run);
    WR.hazards(run);
    if (run.bs && run.bs.chase) boss(run);
    ghost(run);
    NS.fxRender.draw(0);
    WR.items(run);
    runner(run);
    if (run.bs && !run.bs.chase) boss(run);
    shots(run);
    telegraphs(run);
    NS.fxRender.draw(1);
    ctx.restore();
    if (run.mut && run.mut.dark && !run.demo) darkness(run);
    NS.backdrop.weather(run.world, cam);
    NS.backdrop.decor(cam);
    NS.backdrop.vignette();
  }

  Object.assign(NS.actors, {
    poseOf, chaserGap, runner, ghost, boss, shots, telegraphs, darkness, draw
  });
})();
