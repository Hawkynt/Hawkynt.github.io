/* Character art painted once into cached sprites: the cast's portraits for dialogue (Wren in her
   surveyor's cap, Tock the clockwork mole with goggles and a wind-up key, Elder Maple with leaves in
   her white hair, the Rustmonger behind his welding goggles) and the five guardians - the
   Burrowbeast as a huge clawed mole on a dirt mound, Rimewing as a frost owl with spread wings, the
   Cinder Golem as a cracked rock giant glowing from inside, the Archivist as a long eel coiled round
   a stack of books, the Rustmonger's Engine as a riveted walker with a smoking chimney - drawn with a
   breathing bob, a glow while winding up, a hurt flash and a rage tremble. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const K = NS.artKit;
  const { TAU } = NS.constants;
  const { CAST } = NS.storyData;
  const { BOSSES } = NS.worldData;
  const { ctx } = NS.view;

  function eyes(g, x1, x2, y, r, col) {
    K.circle(g, x1, y, r, col || '#2a1a10'); K.circle(g, x2, y, r, col || '#2a1a10');
    K.circle(g, x1 + r * 0.35, y - r * 0.35, r * 0.35, '#ffffff'); K.circle(g, x2 + r * 0.35, y - r * 0.35, r * 0.35, '#ffffff');
  }

  function portrait(who) {
    const c = CAST[who];
    return K.sprite('portrait:' + who, 160, 160, (g) => {
      const bg = g.createRadialGradient(80, 70, 10, 80, 80, 90);
      bg.addColorStop(0, K.rgba(c.accent, 0.5)); bg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = bg; g.fillRect(0, 0, 160, 160);
      g.fillStyle = c.coat;
      g.beginPath(); g.moveTo(25, 160); g.quadraticCurveTo(30, 110, 80, 105); g.quadraticCurveTo(130, 110, 135, 160); g.closePath(); g.fill();
      if (who === 'tock') {
        /* round brass mole: body, snout, goggles, key */
        K.circle(g, 80, 80, 44, c.skin);
        g.fillStyle = K.shade(c.skin, -0.25); g.beginPath(); g.ellipse(80, 98, 30, 16, 0, 0, TAU); g.fill();
        K.circle(g, 80, 96, 9, '#ff9aa0');
        g.strokeStyle = c.coat; g.lineWidth = 6; g.beginPath(); g.moveTo(36, 62); g.lineTo(124, 62); g.stroke();
        for (const x of [60, 100]) { K.circle(g, x, 64, 15, '#5a4a3a'); K.circle(g, x, 64, 11, c.accent); K.circle(g, x + 3, 61, 3, '#ffffff'); }
        g.fillStyle = '#d0b060'; g.fillRect(124, 70, 22, 6); K.circle(g, 148, 64, 8, '#d0b060'); K.circle(g, 148, 86, 8, '#d0b060');
        for (let i = 0; i < 3; ++i) { g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(66 - i * 12, 102); g.lineTo(40 - i * 8, 98 + i * 6); g.stroke(); }
      } else if (who === 'rust') {
        K.circle(g, 80, 70, 36, c.skin);
        g.fillStyle = c.coat; g.beginPath(); g.moveTo(80, 18); g.lineTo(126, 70); g.lineTo(118, 112); g.lineTo(42, 112); g.lineTo(34, 70); g.closePath(); g.fill();
        g.fillStyle = c.skin; g.beginPath(); g.ellipse(80, 76, 26, 30, 0, 0, TAU); g.fill();
        g.fillStyle = '#3a3a3a'; g.fillRect(50, 62, 60, 12);
        for (const x of [64, 96]) { K.circle(g, x, 68, 11, '#2a2a2a'); K.circle(g, x, 68, 7, c.accent); }
        g.fillStyle = c.hair; g.beginPath(); g.ellipse(80, 98, 18, 10, 0, 0, Math.PI); g.fill();
      } else {
        K.circle(g, 80, 66, 36, c.skin);
        g.fillStyle = c.hair;
        if (who === 'maple') {
          g.beginPath(); g.ellipse(80, 44, 42, 24, 0, Math.PI, 0); g.fill();
          g.beginPath(); g.ellipse(46, 74, 12, 26, 0, 0, TAU); g.ellipse(114, 74, 12, 26, 0, 0, TAU); g.fill();
          for (const [x, y, col] of [[56, 28, '#e0702a'], [80, 20, '#c04a2a'], [104, 28, '#e0a02a']]) {
            g.fillStyle = col; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.closePath(); g.fill();
          }
        } else {
          /* Wren: auburn bob under a green surveyor's cap */
          g.beginPath(); g.ellipse(80, 50, 42, 26, 0, Math.PI, 0); g.fill();
          g.beginPath(); g.ellipse(48, 70, 10, 22, 0, 0, TAU); g.ellipse(112, 70, 10, 22, 0, 0, TAU); g.fill();
          g.fillStyle = c.coat; g.beginPath(); g.ellipse(80, 34, 40, 16, 0, Math.PI, 0); g.fill();
          g.fillRect(70, 34, 56, 6);
          g.fillStyle = c.accent; g.fillRect(40, 104, 80, 10);
        }
        eyes(g, 66, 94, 68, 4.5);
        g.strokeStyle = '#8a4a3a'; g.lineWidth = 2.5; g.beginPath(); g.arc(80, 80, 10, 0.2, Math.PI - 0.2); g.stroke();
        K.circle(g, 58, 80, 5, 'rgba(255,120,120,0.35)'); K.circle(g, 102, 80, 5, 'rgba(255,120,120,0.35)');
      }
    });
  }

  /* guardian figures, 260 x 300, anchored bottom centre */
  function boss(w) {
    const b = BOSSES[w];
    return K.sprite('boss:' + w, 260, 300, (g) => {
      const r = NS.rng.makeRng(900 + w);
      const glow = g.createRadialGradient(130, 160, 20, 130, 160, 150);
      glow.addColorStop(0, K.rgba(b.accent, 0.35)); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.fillRect(0, 0, 260, 300);
      if (w === 0) {
        /* the Burrowbeast: dirt mound, huge mole with claws */
        g.fillStyle = '#5a3a1a'; g.beginPath(); g.ellipse(130, 290, 125, 40, 0, Math.PI, 0); g.fill();
        g.fillStyle = b.color; g.beginPath(); g.ellipse(130, 190, 90, 100, 0, 0, TAU); g.fill();
        g.fillStyle = K.shade(b.color, 0.25); g.beginPath(); g.ellipse(130, 215, 55, 60, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff9aa0'; g.beginPath(); g.ellipse(130, 140, 22, 16, 0, 0, TAU); g.fill();
        eyes(g, 98, 162, 112, 7, '#1a0e06');
        for (const side of [-1, 1]) for (let k = 0; k < 4; ++k) {
          g.fillStyle = '#f0e8d0'; g.beginPath(); g.moveTo(130 + side * (60 + k * 8), 250); g.lineTo(130 + side * (70 + k * 9), 290); g.lineTo(130 + side * (76 + k * 8), 252); g.closePath(); g.fill();
        }
      } else if (w === 1) {
        /* Rimewing: frost owl */
        for (const side of [-1, 1]) {
          g.fillStyle = K.shade(b.color, -0.15);
          g.beginPath(); g.moveTo(130, 150); g.quadraticCurveTo(130 + side * 140, 120, 130 + side * 120, 260); g.quadraticCurveTo(130 + side * 60, 220, 130, 230); g.closePath(); g.fill();
          for (let k = 0; k < 5; ++k) { g.strokeStyle = '#e8f8ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(130 + side * (30 + k * 18), 170 + k * 10); g.lineTo(130 + side * (40 + k * 18), 230 + k * 6); g.stroke(); }
        }
        g.fillStyle = b.color; g.beginPath(); g.ellipse(130, 180, 60, 90, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8f8ff'; g.beginPath(); g.ellipse(130, 200, 40, 60, 0, 0, TAU); g.fill();
        K.circle(g, 106, 120, 22, '#ffffff'); K.circle(g, 154, 120, 22, '#ffffff');
        K.circle(g, 106, 120, 10, '#2a6ad0'); K.circle(g, 154, 120, 10, '#2a6ad0');
        g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(122, 140); g.lineTo(138, 140); g.lineTo(130, 156); g.closePath(); g.fill();
        g.fillStyle = b.color; g.beginPath(); g.moveTo(90, 100); g.lineTo(96, 70); g.lineTo(110, 96); g.closePath(); g.moveTo(170, 100); g.lineTo(164, 70); g.lineTo(150, 96); g.closePath(); g.fill();
      } else if (w === 2) {
        /* the Cinder Golem: rock blocks with glowing cracks */
        const rock = (x, y, w2, h2) => { K.roundRect(g, x, y, w2, h2, 14); g.fillStyle = '#4a3028'; g.fill(); g.strokeStyle = b.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w2 * 0.3, y + 6); g.lineTo(x + w2 * 0.5, y + h2 * 0.5); g.lineTo(x + w2 * 0.4, y + h2 - 6); g.stroke(); };
        rock(70, 120, 120, 120); rock(20, 130, 50, 110); rock(190, 130, 50, 110); rock(80, 240, 40, 60); rock(140, 240, 40, 60); rock(90, 40, 80, 80);
        K.circle(g, 112, 80, 9, b.accent); K.circle(g, 148, 80, 9, b.accent);
        const core = g.createRadialGradient(130, 180, 4, 130, 180, 40); core.addColorStop(0, '#ffffff'); core.addColorStop(0.4, b.accent); core.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = core; g.beginPath(); g.arc(130, 180, 40, 0, TAU); g.fill();
      } else if (w === 3) {
        /* the Archivist: eel coiled round a stack of books */
        for (let k = 0; k < 6; ++k) { K.roundRect(g, 60 + (k % 2) * 8, 230 - k * 24, 140, 22, 4); g.fillStyle = ['#8a3a2a', '#2a5a8a', '#5a7a2a', '#8a6a2a'][k % 4]; g.fill(); g.fillStyle = '#f0e8d0'; g.fillRect(64 + (k % 2) * 8, 234 - k * 24, 130, 4); }
        g.strokeStyle = b.color; g.lineWidth = 34; g.lineCap = 'round';
        g.beginPath(); g.moveTo(40, 280); g.quadraticCurveTo(230, 260, 200, 180); g.quadraticCurveTo(170, 110, 60, 140); g.quadraticCurveTo(30, 90, 120, 60); g.stroke();
        g.strokeStyle = b.accent; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 280); g.quadraticCurveTo(230, 260, 200, 180); g.stroke();
        K.circle(g, 128, 56, 26, b.color); eyes(g, 120, 140, 50, 6, '#05303a');
        g.fillStyle = '#ffd25a'; g.fillRect(104, 40, 48, 4); K.circle(g, 116, 50, 9, 'rgba(255,255,255,0.25)'); K.circle(g, 142, 50, 9, 'rgba(255,255,255,0.25)');
      } else {
        /* the Rustmonger's Engine: riveted walker with a chimney */
        for (const x of [60, 100, 160, 200]) { g.strokeStyle = '#5a3a2a'; g.lineWidth = 12; g.beginPath(); g.moveTo(x, 200); g.lineTo(x + (x < 130 ? -20 : 20), 250); g.lineTo(x + (x < 130 ? -10 : 10), 300); g.stroke(); }
        K.roundRect(g, 40, 110, 180, 100, 20); g.fillStyle = b.color; g.fill();
        g.fillStyle = K.shade(b.color, -0.3); for (let k = 0; k < 9; ++k) K.circle(g, 56 + k * 19, 122, 4, K.shade(b.color, 0.3));
        g.fillStyle = '#3a2a1a'; g.fillRect(150, 40, 30, 74);
        for (let k = 0; k < 4; ++k) K.circle(g, 165 + r.range(-10, 10), 30 - k * 10, 12 + k * 3, 'rgba(120,110,100,' + (0.6 - k * 0.12) + ')');
        K.circle(g, 100, 160, 22, '#2a1a10'); K.circle(g, 100, 160, 14, b.accent); K.circle(g, 100, 160, 5, '#ff4a2a');
        g.fillStyle = '#2a1a10'; g.fillRect(140, 150, 60, 20);
        for (let k = 0; k < 5; ++k) { g.fillStyle = '#ffd07a'; g.fillRect(146 + k * 11, 154, 6, 12); }
      }
    });
  }

  /* the guardian beside the board with its state */
  function drawBoss(w, x, y, bs, scale) {
    const img = boss(w);
    const bob = Math.sin(G.time * 1.6) * 6;
    const s = scale || 1;
    if (bs && bs.windup > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(G.time * 20);
      K.blit(ctx, K.glow(BOSSES[w].accent), x, y - 150 * s, 3 * s);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);
    if (bs && (bs.rage || bs.windup > 0)) ctx.translate((Math.random() - 0.5) * 3, 0);
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
