/* Character art painted once into cached sprites: the cast's portraits for dialogue (Juno,
   Bolt the drone, Captain Orla, the Gloom) and the five guardians - the Hedge Colossus, the
   Frost Warden as a crystal wyrm, the crowned Gear Tyrant with its hammer, the Abyssal Kraken
   and the Gloom Engine - drawn with a breathing bob, a hurt flash and a rage tremble. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const K = NS.artKit;
  const { TAU } = NS.constants;
  const { CAST } = NS.storyData;
  const { BOSSES } = NS.worldData;
  const { ctx } = NS.view;

  function portrait(who) {
    const c = CAST[who];
    return K.sprite('portrait:' + who, 160, 160, (g) => {
      const bg = g.createRadialGradient(80, 70, 10, 80, 80, 90);
      bg.addColorStop(0, K.rgba(c.accent, 0.5)); bg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bg; g.fillRect(0, 0, 160, 160);
      /* body */
      g.fillStyle = c.coat;
      g.beginPath(); g.moveTo(25, 160); g.quadraticCurveTo(30, 110, 80, 105); g.quadraticCurveTo(130, 110, 135, 160); g.closePath(); g.fill();
      if (who === 'bolt') {
        K.roundRect(g, 38, 28, 84, 84, 18); g.fillStyle = c.skin; g.fill();
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(50, 70, 20, 4); g.fillRect(92, 50, 18, 4);
        for (let i = 0; i < 6; ++i) K.circle(g, 44 + i * 14, 30 + (i % 2) * 6, 9, c.hair);
        K.circle(g, 62, 66, 8, '#9affea'); K.circle(g, 98, 66, 8, '#9affea');
        K.circle(g, 62, 66, 3, '#ffffff'); K.circle(g, 98, 66, 3, '#ffffff');
        g.fillStyle = '#4a5058'; g.fillRect(66, 92, 28, 5);
      } else if (who === 'gloom') {
        g.fillStyle = c.coat;
        g.beginPath(); g.moveTo(80, 10); g.lineTo(130, 70); g.lineTo(120, 120); g.lineTo(40, 120); g.lineTo(30, 70); g.closePath(); g.fill();
        g.fillStyle = '#05020c'; g.beginPath(); g.ellipse(80, 76, 30, 34, 0, 0, TAU); g.fill();
        K.circle(g, 68, 72, 5, c.accent); K.circle(g, 92, 72, 5, c.accent);
        g.strokeStyle = c.hair; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 10); g.lineTo(80, 38); g.stroke();
      } else {
        K.circle(g, 80, 66, 36, c.skin);
        g.fillStyle = c.hair;
        if (who === 'orla') {
          g.beginPath(); g.ellipse(80, 44, 40, 22, 0, Math.PI, 0); g.fill();
          g.beginPath(); g.moveTo(54, 80); g.quadraticCurveTo(80, 140, 106, 80); g.quadraticCurveTo(80, 100, 54, 80); g.fill();
        } else {
          g.beginPath(); g.ellipse(80, 44, 40, 24, 0, Math.PI, 0); g.fill();
          g.beginPath(); g.moveTo(44, 50); g.lineTo(60, 30); g.lineTo(70, 46); g.lineTo(84, 28); g.lineTo(96, 46); g.lineTo(116, 34); g.lineTo(116, 56); g.closePath(); g.fill();
          g.fillStyle = c.accent; g.fillRect(40, 104, 80, 10);
        }
        K.circle(g, 66, 68, 4.5, '#2a1a10'); K.circle(g, 94, 68, 4.5, '#2a1a10');
        K.circle(g, 67.5, 66.5, 1.5, '#ffffff'); K.circle(g, 95.5, 66.5, 1.5, '#ffffff');
        g.strokeStyle = '#8a4a3a'; g.lineWidth = 2.5; g.beginPath(); g.arc(80, 80, 10, 0.2, Math.PI - 0.2); g.stroke();
        K.circle(g, 58, 80, 5, 'rgba(255,120,120,0.35)'); K.circle(g, 102, 80, 5, 'rgba(255,120,120,0.35)');
      }
    });
  }

  /* guardian figures, 260 x 300, anchored bottom centre */
  function boss(w) {
    const b = BOSSES[w];
    const art = [0, 1, 3, 2, 4][w];
    return K.sprite('boss:' + w, 260, 300, (g) => {
      const r = NS.rng.makeRng(900 + w);
      const glow = g.createRadialGradient(130, 160, 20, 130, 160, 150);
      glow.addColorStop(0, K.rgba(b.accent, 0.35)); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.fillRect(0, 0, 260, 300);
      if (art === 0) {
        g.fillStyle = '#5a3a22';
        g.beginPath(); g.moveTo(70, 300); g.lineTo(90, 120); g.lineTo(170, 120); g.lineTo(190, 300); g.closePath(); g.fill();
        for (let i = 0; i < 4; ++i) { g.strokeStyle = '#4a2a18'; g.lineWidth = 12; g.beginPath(); g.moveTo(90 + i * 25, 290); g.quadraticCurveTo(60 + i * 40, 300, 40 + i * 60, 300); g.stroke(); }
        for (let i = 0; i < 14; ++i) K.circle(g, 130 + r.range(-90, 90), 90 + r.range(-60, 40), r.range(26, 44), i % 2 ? b.color : K.shade(b.color, -0.2));
        g.fillStyle = '#1a0e06'; g.beginPath(); g.ellipse(108, 170, 12, 8, 0, 0, TAU); g.ellipse(152, 170, 12, 8, 0, 0, TAU); g.fill();
        K.circle(g, 108, 170, 4, b.accent); K.circle(g, 152, 170, 4, b.accent);
        g.fillStyle = '#1a0e06'; g.fillRect(105, 210, 50, 10);
      } else if (art === 1) {
        g.strokeStyle = b.color; g.lineWidth = 46; g.lineCap = 'round';
        g.beginPath(); g.moveTo(40, 280); g.quadraticCurveTo(220, 260, 170, 170); g.quadraticCurveTo(130, 100, 150, 60); g.stroke();
        for (let i = 0; i < 9; ++i) {
          const t = i / 9, x = 40 + t * 150, y = 270 - t * 200;
          g.fillStyle = '#e8f8ff'; g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 12, y - 52); g.lineTo(x + 24, y - 20); g.closePath(); g.fill();
        }
        K.circle(g, 150, 60, 40, K.shade(b.color, 0.1));
        g.fillStyle = '#e8f8ff'; g.beginPath(); g.moveTo(120, 74); g.lineTo(190, 66); g.lineTo(150, 100); g.closePath(); g.fill();
        K.circle(g, 140, 50, 7, '#ffffff'); K.circle(g, 140, 50, 3, '#2a4ad0');
      } else if (art === 2) {
        g.fillStyle = b.color;
        g.beginPath(); g.moveTo(20, 300); g.quadraticCurveTo(40, 110, 130, 70); g.quadraticCurveTo(220, 110, 240, 300); g.closePath(); g.fill();
        g.fillStyle = K.shade(b.color, 0.25);
        for (let i = 0; i < 6; ++i) { g.beginPath(); g.ellipse(130, 140 + i * 28, 70 - i * 4, 8, 0, 0, Math.PI); g.fill(); }
        for (let i = 0; i < 4; ++i) { g.strokeStyle = K.shade(b.color, -0.2); g.lineWidth = 10; g.beginPath(); g.moveTo(40 + i * 60, 300); g.quadraticCurveTo(20 + i * 70, 220, 50 + i * 55, 190); g.stroke(); }
        K.circle(g, 100, 120, 12, b.accent); K.circle(g, 160, 120, 12, b.accent);
        K.circle(g, 100, 120, 5, '#05303a'); K.circle(g, 160, 120, 5, '#05303a');
      } else if (art === 3) {
        g.fillStyle = '#3a1a10'; g.fillRect(60, 120, 140, 180);
        g.fillStyle = '#5a2a18'; g.fillRect(70, 130, 120, 90);
        K.circle(g, 130, 90, 50, '#4a2216');
        g.fillStyle = b.accent;
        g.beginPath(); g.moveTo(80, 50); g.lineTo(95, 20); g.lineTo(110, 45); g.lineTo(130, 10); g.lineTo(150, 45); g.lineTo(165, 20); g.lineTo(180, 50); g.closePath(); g.fill();
        K.circle(g, 110, 92, 8, b.color); K.circle(g, 150, 92, 8, b.color);
        g.fillStyle = '#ff9a3a'; g.fillRect(105, 118, 50, 8);
        g.fillStyle = '#2a120a'; g.fillRect(200, 120, 18, 150);
        g.fillStyle = '#6a6a72'; g.fillRect(180, 90, 60, 40);
      } else {
        g.fillStyle = '#1a0a2a';
        g.beginPath(); g.moveTo(130, 20); g.lineTo(220, 140); g.lineTo(200, 300); g.lineTo(60, 300); g.lineTo(40, 140); g.closePath(); g.fill();
        g.fillStyle = '#05020c'; g.beginPath(); g.ellipse(130, 130, 46, 54, 0, 0, TAU); g.fill();
        K.circle(g, 112, 126, 8, b.accent); K.circle(g, 148, 126, 8, b.accent);
        for (let i = 0; i < 8; ++i) {
          g.fillStyle = K.rgba(b.color, 0.8);
          const x = 40 + r.range(0, 180), y = 180 + r.range(0, 100);
          g.fillRect(x, y, 16, 16);
        }
        g.strokeStyle = b.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(130, 20); g.lineTo(130, 70); g.stroke();
      }
    });
  }

  /* the guardian beside the board with its state */
  function drawBoss(w, x, y, bs, scale) {
    const img = boss(w);
    const bob = Math.sin(G.time * 1.6) * 6;
    const s = scale || 1;
    if (bs && bs.attackT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = bs.attackT;
      K.blit(ctx, K.glow(BOSSES[w].accent), x, y - 150 * s, 3 * s);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    if (bs && bs.rage) ctx.translate((Math.random() - 0.5) * 3, 0);
    ctx.drawImage(img, -130, -300);
    if (bs && bs.hurtT > 0) {
      ctx.globalAlpha = bs.hurtT * 1.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, -130, -300);
    }
    ctx.restore();
  }

  Object.assign(NS.bossArt, { portrait, boss, drawBoss });
})();
