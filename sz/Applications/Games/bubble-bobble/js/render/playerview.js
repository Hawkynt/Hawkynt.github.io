/* The player sprite: a breathing, facing-aware little dinosaur drawn from tail, body,
   belly, back plates, head, snout, eyes, stubby arms and animated legs with toe claws. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const S = NS.state;
  const V = NS.view;

  function drawPlayer() {
    const px = S.player.x;
    const py = S.player.y;
    const cx = px + 12;
    const cy = py + 12;
    const dir = S.player.facingRight ? 1 : -1;

    V.ctx.save();

    // Breathing animation — subtle scale pulse
    const breathScale = Math.sin(Date.now() / 500) * 0.03 + 1;
    V.ctx.translate(cx, cy);
    V.ctx.scale(breathScale, breathScale);
    V.ctx.translate(-cx, -cy);

    // ── Tail ── stubby pointed tail behind body
    V.ctx.fillStyle = '#44bb55';
    V.ctx.beginPath();
    V.ctx.moveTo(cx - dir * 10, cy + 4);
    V.ctx.lineTo(cx - dir * 19, cy - 1);
    V.ctx.lineTo(cx - dir * 17, cy + 4);
    V.ctx.lineTo(cx - dir * 20, cy + 8);
    V.ctx.lineTo(cx - dir * 12, cy + 7);
    V.ctx.closePath();
    V.ctx.fill();

    // ── Body ── oval dinosaur body (wider than tall)
    V.ctx.fillStyle = '#55dd77';
    V.ctx.beginPath();
    V.ctx.ellipse(cx, cy + 1, 11, 10, 0, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Belly ── lighter oval on front
    V.ctx.fillStyle = '#aaffbb';
    V.ctx.beginPath();
    V.ctx.ellipse(cx + dir * 2, cy + 3, 6, 7, 0, 0, Math.PI * 2);
    V.ctx.globalAlpha = 0.6;
    V.ctx.fill();
    V.ctx.globalAlpha = 1;

    // ── Back plates ── 3 small rounded bumps along the top-back
    V.ctx.fillStyle = '#33aa55';
    for (let i = 0; i < 3; ++i) {
      const bumpAngle = Math.PI * 0.9 + (dir > 0 ? 1 : -1) * (i * 0.35 + 0.15);
      const bx = cx + Math.cos(bumpAngle) * 10;
      const by = cy + Math.sin(bumpAngle) * 9;
      V.ctx.beginPath();
      V.ctx.arc(bx, by, 3 - i * 0.5, 0, Math.PI * 2);
      V.ctx.fill();
    }

    // ── Head ── larger round head on the facing side, slightly above body
    const headX = cx + dir * 8;
    const headY = cy - 6;
    const headR = 8;
    V.ctx.fillStyle = '#55dd77';
    V.ctx.beginPath();
    V.ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Snout ── small rounded muzzle protruding forward
    const snoutX = headX + dir * 7;
    const snoutY = headY + 2;
    V.ctx.fillStyle = '#55dd77';
    V.ctx.beginPath();
    V.ctx.ellipse(snoutX, snoutY, 5, 4, 0, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Nostril ── small dot on snout
    V.ctx.fillStyle = '#228844';
    V.ctx.beginPath();
    V.ctx.arc(snoutX + dir * 3, snoutY - 1, 1, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Mouth ── gentle smile line
    V.ctx.strokeStyle = '#228844';
    V.ctx.lineWidth = 1.5;
    V.ctx.beginPath();
    if (S.player.facingRight)
      V.ctx.arc(snoutX, snoutY + 1, 3.5, 0.2, Math.PI - 0.2);
    else
      V.ctx.arc(snoutX, snoutY + 1, 3.5, 0.2 + Math.PI, Math.PI * 2 - 0.2);
    V.ctx.stroke();

    // ── Eyes ── big round cute eyes
    V.ctx.fillStyle = '#fff';
    V.ctx.beginPath();
    V.ctx.arc(headX + dir * 2, headY - 2, 4, 0, Math.PI * 2);
    V.ctx.fill();
    // Pupil — large and round
    V.ctx.fillStyle = '#111';
    V.ctx.beginPath();
    V.ctx.arc(headX + dir * 3, headY - 2, 2.5, 0, Math.PI * 2);
    V.ctx.fill();
    // Eye highlight — small white dot for life
    V.ctx.fillStyle = '#fff';
    V.ctx.beginPath();
    V.ctx.arc(headX + dir * 2, headY - 3.5, 1, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Tiny arms ── stubby T-rex arms
    V.ctx.strokeStyle = '#44bb55';
    V.ctx.lineWidth = 2.5;
    V.ctx.lineCap = 'round';
    const armBaseX = cx + dir * 6;
    const armBaseY = cy - 1;
    const armWave = S.player.vx !== 0 ? Math.sin(S.player.animFrame * Math.PI / 2) * 3 : 0;
    V.ctx.beginPath();
    V.ctx.moveTo(armBaseX, armBaseY);
    V.ctx.lineTo(armBaseX + dir * 5, armBaseY + 3 + armWave);
    V.ctx.stroke();
    V.ctx.beginPath();
    V.ctx.moveTo(armBaseX, armBaseY + 4);
    V.ctx.lineTo(armBaseX + dir * 5, armBaseY + 7 - armWave);
    V.ctx.stroke();
    // Tiny claw dots at arm tips
    V.ctx.fillStyle = '#fff';
    V.ctx.beginPath();
    V.ctx.arc(armBaseX + dir * 5, armBaseY + 3 + armWave, 1, 0, Math.PI * 2);
    V.ctx.arc(armBaseX + dir * 5, armBaseY + 7 - armWave, 1, 0, Math.PI * 2);
    V.ctx.fill();

    // ── Legs ── sturdy rounded feet
    V.ctx.fillStyle = '#44bb55';
    if (S.player.vx !== 0 && S.player.grounded) {
      const legOff = Math.sin(S.player.animFrame * Math.PI / 2) * 4;
      // Left leg
      V.ctx.fillRect(cx - 6, cy + 7, 5, 6 + legOff);
      V.ctx.beginPath();
      V.ctx.ellipse(cx - 4, cy + 13 + legOff, 4, 2.5, 0, 0, Math.PI * 2);
      V.ctx.fill();
      // Right leg
      V.ctx.fillRect(cx + 1, cy + 7, 5, 6 - legOff);
      V.ctx.beginPath();
      V.ctx.ellipse(cx + 3, cy + 13 - legOff, 4, 2.5, 0, 0, Math.PI * 2);
      V.ctx.fill();
    } else {
      // Standing
      V.ctx.fillRect(cx - 6, cy + 7, 5, 6);
      V.ctx.beginPath();
      V.ctx.ellipse(cx - 4, cy + 13, 4, 2.5, 0, 0, Math.PI * 2);
      V.ctx.fill();
      V.ctx.fillRect(cx + 1, cy + 7, 5, 6);
      V.ctx.beginPath();
      V.ctx.ellipse(cx + 3, cy + 13, 4, 2.5, 0, 0, Math.PI * 2);
      V.ctx.fill();
    }
    // Toe claws
    V.ctx.fillStyle = '#fff';
    for (const footX of [cx - 4, cx + 3]) {
      for (let t = -1; t <= 1; ++t) {
        V.ctx.beginPath();
        V.ctx.arc(footX + t * 2, cy + 15 + (S.player.vx !== 0 && S.player.grounded ? (footX < cx ? Math.sin(S.player.animFrame * Math.PI / 2) * 4 : -Math.sin(S.player.animFrame * Math.PI / 2) * 4) : 0), 0.8, 0, Math.PI * 2);
        V.ctx.fill();
      }
    }

    V.ctx.restore();
  }

  Object.assign(NS.playerview, { drawPlayer });
})();
