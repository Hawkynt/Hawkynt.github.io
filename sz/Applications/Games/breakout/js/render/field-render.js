/* The field: a dark glass arena in a glowing frame, the bricks (flashing when hit, cracked when
   damaged, sliding in when a wall is built, hidden away from the balls under Blackout and the
   Kraken's ink), the guardian with its shield ring and shots, falling power-up capsules, laser
   bolts and stars, the barrier line, the balls (on fire, mega or in the chosen skin), the paddle
   in the chosen style with cannons, magnet glow and stun flicker, and the aim line for a held
   ball; in the team modes the CPU partners' paddles on their edges with a name tag, and a glowing
   danger strip along every open edge. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const S = NS.sprites;
  const E = NS.engine;
  const M = NS.metaData;
  const { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, PADDLE_Y, PADDLE_H, TAU } = C;
  const { ctx } = NS.view;

  function paddleDef() {
    return M.PADDLES.find(x => x.id === G.profile.cosmetics.paddle) || M.PADDLES[0];
  }

  function ballDef() {
    return M.BALLS.find(x => x.id === G.profile.cosmetics.ball) || M.BALLS[0];
  }

  function frame(world) {
    const W = NS.worldData.WORLDS[world || 0];
    return K.sprite('fieldframe:' + (world || 0), FIELD_W + 24, FIELD_H + 24, (g) => {
      K.roundRect(g, 0, 0, FIELD_W + 24, FIELD_H + 24, 16);
      const gr = g.createLinearGradient(0, 0, 0, FIELD_H + 24);
      gr.addColorStop(0, K.shade(W.accent, -0.2)); gr.addColorStop(1, K.shade(W.accent, -0.65));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = K.rgba(W.glow, 0.9); g.lineWidth = 2; K.roundRect(g, 3, 3, FIELD_W + 18, FIELD_H + 18, 14); g.stroke();
      g.fillStyle = 'rgba(4,2,12,0.82)'; g.fillRect(12, 12, FIELD_W, FIELD_H);
      g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
      for (let x = 12; x < FIELD_W + 12; x += 50) { g.beginPath(); g.moveTo(x + 0.5, 12); g.lineTo(x + 0.5, FIELD_H + 12); g.stroke(); }
    });
  }

  function drawPaddle(g, ox, oy) {
    const p = g.paddle;
    const def = paddleDef();
    const x0 = ox + p.x - p.w / 2, y = oy + PADDLE_Y;
    if (p.stunT > 0 && Math.floor(G.time * 20) % 2) ctx.globalAlpha = 0.5;
    if (p.magnetT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.time * 8);
      K.blit(ctx, K.glow('#c8a0ff'), ox + p.x, y + 6, p.w / 90);
      ctx.restore();
    }
    ctx.drawImage(S.paddleBody(def), x0 + 6, y, Math.max(1, p.w - 12), PADDLE_H);
    const cap = S.paddleCap(def);
    ctx.drawImage(cap, x0 - 6, y - 4);
    ctx.drawImage(cap, x0 + p.w - 14, y - 4);
    if (p.laserT > 0) {
      ctx.fillStyle = '#ff4a5a';
      ctx.fillRect(x0 + 4, y - 10, 6, 10);
      ctx.fillRect(x0 + p.w - 10, y - 10, 6, 10);
    }
    ctx.globalAlpha = 1;
  }

  /* a CPU partner's paddle, turned to lie along its edge */
  function drawMate(g, m, ox, oy) {
    const mate = M.MATES[m.side];
    const def = M.PADDLES.find(x => x.id === mate.paddle) || M.PADDLES[0];
    const H = C.MATE_H;
    ctx.save();
    if (m.side === 'top') ctx.translate(ox + m.pos, oy + C.MATE_TOP - H / 2);
    else if (m.side === 'left') { ctx.translate(ox + C.MATE_SIDE - H / 2, oy + m.pos); ctx.rotate(Math.PI / 2); }
    else { ctx.translate(ox + g.w - C.MATE_SIDE + H / 2, oy + m.pos); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(S.paddleBody(def), -m.w / 2 + 6, -H / 2, Math.max(1, m.w - 12), H);
    const cap = S.paddleCap(def);
    ctx.drawImage(cap, -m.w / 2 - 6, -H / 2 - 4);
    ctx.drawImage(cap, m.w / 2 - 14, -H / 2 - 4);
    ctx.restore();
  }

  function drawEdges(g, ox, oy) {
    const a = 0.25 + 0.12 * Math.sin(G.time * 3);
    ctx.fillStyle = 'rgba(255,90,110,' + a + ')';
    if (g.open.top) ctx.fillRect(ox, oy, g.w, 3);
    if (g.open.left) ctx.fillRect(ox, oy, 3, g.h);
    if (g.open.right) ctx.fillRect(ox + g.w - 3, oy, 3, g.h);
  }

  function visibleNear(g, br) {
    for (const b of g.balls) {
      const dx = b.x - (br.x + br.w / 2), dy = b.y - (br.y + br.h / 2);
      if (dx * dx + dy * dy < 150 * 150) return true;
    }
    return false;
  }

  function draw(g, opts) {
    opts = opts || {};
    const run = G.run;
    const ox = FIELD_X, oy = FIELD_Y;
    ctx.drawImage(frame(run ? run.world : 0), ox - 12, oy - 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, FIELD_W, FIELD_H);
    ctx.clip();
    const dark = !opts.demo && run && (run.dark || (g.boss && g.boss.inkT > 0));
    const entry = run && run.wallT != null ? run.wallT : 1;
    for (const br of g.bricks) {
      if (!br.alive) continue;
      if (dark && !visibleNear(g, br)) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(ox + br.x + 2, oy + br.y + 2, br.w - 4, br.h - 4);
        continue;
      }
      const dy = entry < 1 ? -(1 - Math.min(1, entry * 2 - br.y / 600)) * 300 : 0;
      ctx.drawImage(S.brick(br.ch, br.w, br.h), ox + br.x, oy + br.y + Math.min(0, dy));
      if (br.hp < br.max && br.kind !== 'wall') ctx.drawImage(S.crack(br.max - br.hp, br.w, br.h), ox + br.x, oy + br.y);
      if (br.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + br.flash * 4 + ')';
        ctx.fillRect(ox + br.x + 1, oy + br.y + 1, br.w - 2, br.h - 2);
      }
    }
    if (g.boss && g.boss.hp > 0) NS.bossArt.drawBoss(g.boss.w, ox + g.boss.x, oy + g.boss.y + 70, g.boss, 0.55);
    for (const s of g.projectiles) ctx.drawImage(S.shot(s.kind), ox + s.x - 10, oy + s.y - 10);
    for (const d of g.drops) {
      const img = S.capsule(d.type);
      const bob = Math.sin(d.t * 6) * 2;
      ctx.drawImage(img, ox + d.x - img.width / 2, oy + d.y - img.height / 2 + bob);
    }
    ctx.fillStyle = '#ff6a7a';
    for (const l of g.lasers) ctx.fillRect(ox + l.x - 1.5, oy + l.y - 10, 3, 14);
    for (const s of g.stars) { ctx.fillStyle = '#fff4a0'; K.star(ctx, ox + s.x, oy + s.y, 7, 0.45, 5); ctx.fill(); }
    if (g.barrier > 0) {
      const a = 0.5 + 0.3 * Math.sin(G.time * 6);
      ctx.fillStyle = 'rgba(138,138,255,' + a + ')';
      ctx.fillRect(ox, oy + FIELD_H - 5, FIELD_W, 3 + g.barrier * 2);
    }
    const r = E.ballR(g);
    const bdef = ballDef();
    for (const b of g.balls) {
      const img = g.fireT > 0 ? S.fireBall(Math.round(r)) : S.ball(bdef, Math.round(r));
      ctx.drawImage(img, ox + b.x - img.width / 2, oy + b.y - img.height / 2);
      if (b.stuck && !opts.demo && NS.progress.stat(G.profile, 'aim') > 0) {
        const a = Math.max(-0.9, Math.min(0.9, b.off / (g.paddle.w / 2)));
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(ox + b.x, oy + b.y);
        ctx.lineTo(ox + b.x + Math.sin(a) * 260, oy + b.y - Math.cos(a) * 260);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    drawPaddle(g, ox, oy);
    if (g.mates.length) {
      drawEdges(g, ox, oy);
      for (const m of g.mates) drawMate(g, m, ox, oy);
    }
    ctx.restore();
  }

  Object.assign(NS.fieldRender, { paddleDef, ballDef, frame, drawPaddle, drawMate, drawEdges, draw });
})();
