/* The guardians, painted once per animation frame: Thornback the bramble boar in a two-frame
   gallop, Rime's avalanche - a wall of snow with a frost-spirit face, the Dune Wyrm's armoured
   head, Warden Mk-II the hovering security mech, and the Hollow King with crown, cape and
   burning eyes; plus the shadow wall that chases the runner in the final fight. Sprites are
   centred. Paints only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const K = NS.artKit;
  const { TAU } = NS.constants;

  const OUT = '#141224';

  function boar(f) {
    return K.sprite('boss:boar:' + f, 300, 220, (g) => {
      g.translate(150, 120);
      const leg = f ? 1 : -1;
      /* legs */
      for (const [lx, ph] of [[-70, 1], [-40, -1], [50, 1], [80, -1]]) {
        g.save(); g.translate(lx, 40); g.rotate(0.35 * leg * ph);
        g.fillStyle = OUT; K.roundRect(g, -13, -8, 26, 66, 10); g.fill();
        g.fillStyle = '#5a3a2a'; K.roundRect(g, -10, -6, 20, 60, 8); g.fill();
        g.fillStyle = '#2a1a10'; g.fillRect(-10, 46, 20, 10);
        g.restore();
      }
      /* body */
      g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 120, 70, 0, 0, TAU); g.fill();
      g.fillStyle = '#6a4a32'; g.beginPath(); g.ellipse(0, 0, 115, 65, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a6a48'; g.beginPath(); g.ellipse(-10, 20, 90, 36, 0, 0, Math.PI); g.fill();
      /* bramble mane */
      g.fillStyle = '#2f7a46';
      for (let i = 0; i < 9; ++i) { const x = -90 + i * 20; K.poly(g, [[x - 10, -50], [x, -95 - (i % 3) * 12], [x + 12, -50]]); g.fill(); }
      g.fillStyle = '#ff5a6a';
      for (let i = 0; i < 5; ++i) { g.beginPath(); g.arc(-70 + i * 32, -62, 5, 0, TAU); g.fill(); }
      /* head */
      g.fillStyle = OUT; g.beginPath(); g.ellipse(105, 10, 52, 46, -0.2, 0, TAU); g.fill();
      g.fillStyle = '#6a4a32'; g.beginPath(); g.ellipse(105, 10, 48, 42, -0.2, 0, TAU); g.fill();
      g.fillStyle = '#c88a6a'; g.beginPath(); g.ellipse(145, 22, 18, 16, 0, 0, TAU); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.arc(142, 20, 3, 0, TAU); g.arc(152, 22, 3, 0, TAU); g.fill();
      g.fillStyle = '#fff4d8'; K.poly(g, [[128, 34], [150, 8], [140, 38]]); g.fill();
      g.fillStyle = '#ff3a2a'; g.beginPath(); g.arc(112, -8, 7, 0, TAU); g.fill();
      g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(113, -9, 3, 0, TAU); g.fill();
      g.fillStyle = '#4a2a1a'; K.poly(g, [[86, -30], [96, -60], [104, -28]]); g.fill();
    });
  }

  function avalanche(f) {
    return K.sprite('boss:avalanche:' + f, 340, 420, (g) => {
      g.translate(170, 230);
      const r = NS.rng.makeRng(5 + f);
      g.fillStyle = '#d8ecfa';
      g.beginPath(); g.moveTo(-170, 190);
      for (let i = 0; i <= 16; ++i) {
        const y = 190 - i * 26;
        g.lineTo(60 + Math.sin(i * 1.3 + f) * 30 + r() * 20 - (i > 12 ? (i - 12) * 30 : 0), y);
      }
      g.lineTo(-170, -230); g.closePath(); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 14; ++i) { g.beginPath(); g.arc(30 + r() * 50, 170 - i * 28, 22 + r() * 18, 0, TAU); g.fill(); }
      g.fillStyle = '#a8c8e8';
      for (let i = 0; i < 10; ++i) { g.beginPath(); g.arc(-120 + r() * 140, -200 + r() * 380, 14 + r() * 14, 0, TAU); g.fill(); }
      /* Rime's face in the snow */
      g.fillStyle = 'rgba(60,110,200,0.55)';
      g.beginPath(); g.ellipse(-10, -40, 70, 90, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8f8ff';
      K.poly(g, [[-50, -70], [-20, -60], [-46, -50]]); g.fill();
      K.poly(g, [[30, -70], [0, -60], [26, -50]]); g.fill();
      g.fillStyle = '#5ee0ff'; g.beginPath(); g.arc(-34, -60, 6, 0, TAU); g.arc(14, -60, 6, 0, TAU); g.fill();
      g.fillStyle = OUT; K.poly(g, [[-40, 0], [20, 0], [10, 20], [-30, 20]]); g.fill();
    });
  }

  function wyrm(f) {
    return K.sprite('boss:wyrm:' + f, 260, 300, (g) => {
      g.translate(130, 150);
      for (let i = 4; i >= 0; --i) {
        const y = 60 + i * 34, x = Math.sin(i + f) * 10;
        g.fillStyle = OUT; g.beginPath(); g.ellipse(x, y, 56 - i * 2, 30, 0, 0, TAU); g.fill();
        g.fillStyle = i % 2 ? '#c0703a' : '#a85a2a'; g.beginPath(); g.ellipse(x, y, 52 - i * 2, 26, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8a060'; g.fillRect(x - 30, y - 4, 60, 5);
      }
      g.fillStyle = OUT; g.beginPath(); g.ellipse(0, -10, 80, 70, 0, 0, TAU); g.fill();
      g.fillStyle = '#b4643a'; g.beginPath(); g.ellipse(0, -10, 75, 65, 0, 0, TAU); g.fill();
      g.fillStyle = '#e0a060';
      for (let i = 0; i < 5; ++i) { K.poly(g, [[-60 + i * 30, -60], [-48 + i * 30, -96 - (i % 2) * 14], [-36 + i * 30, -60]]); g.fill(); }
      const open = f ? 26 : 14;
      g.fillStyle = OUT; K.poly(g, [[-70, 20], [70, 20], [50, 20 + open + 18], [-50, 20 + open + 18]]); g.fill();
      g.fillStyle = '#ff5a1a'; K.poly(g, [[-60, 24], [60, 24], [44, 22 + open + 10], [-44, 22 + open + 10]]); g.fill();
      g.fillStyle = '#fff4d8';
      for (let i = 0; i < 8; ++i) { K.poly(g, [[-56 + i * 15, 22], [-50 + i * 15, 36], [-44 + i * 15, 22]]); g.fill(); }
      g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(-30, -20, 11, 0, TAU); g.arc(30, -20, 11, 0, TAU); g.fill();
      g.fillStyle = OUT; g.fillRect(-32, -30, 4, 20); g.fillRect(28, -30, 4, 20);
    });
  }

  function warden(f) {
    return K.sprite('boss:warden:' + f, 280, 240, (g) => {
      g.translate(140, 120);
      g.fillStyle = OUT; K.roundRect(g, -90, -60, 180, 110, 26); g.fill();
      g.fillStyle = '#4a5468'; K.roundRect(g, -86, -56, 172, 102, 22); g.fill();
      g.fillStyle = '#6a7690'; K.roundRect(g, -86, -56, 172, 30, 18); g.fill();
      g.fillStyle = OUT; K.roundRect(g, -60, -30, 120, 36, 14); g.fill();
      g.fillStyle = '#ff4ab8'; K.roundRect(g, -56, -26, 112, 28, 12); g.fill();
      g.fillStyle = '#ffffff';
      const ex = f ? -20 : 10;
      g.beginPath(); g.arc(ex, -12, 9, 0, TAU); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.arc(ex + 2, -12, 4, 0, TAU); g.fill();
      for (const sx of [-1, 1]) {
        g.fillStyle = OUT; K.roundRect(g, sx * 96 - 18, -10, 36, 70, 10); g.fill();
        g.fillStyle = '#3a4258'; K.roundRect(g, sx * 96 - 15, -7, 30, 64, 8); g.fill();
        g.fillStyle = '#ffb03a'; g.fillRect(sx * 96 - 8, 50, 16, 8);
      }
      g.fillStyle = '#38e0ff';
      for (let i = 0; i < 6; ++i) g.fillRect(-60 + i * 22, 24, 12, 6);
      g.fillStyle = 'rgba(255,176,58,0.55)';
      K.poly(g, [[-40, 50], [-20, 50], [-30, 100 + f * 14]]); g.fill();
      K.poly(g, [[20, 50], [40, 50], [30, 100 - f * 10]]); g.fill();
    });
  }

  function king(f) {
    return K.sprite('boss:king:' + f, 320, 360, (g) => {
      g.translate(160, 170);
      const gr = g.createLinearGradient(0, -120, 0, 190);
      gr.addColorStop(0, '#3a1a6a'); gr.addColorStop(1, 'rgba(10,4,24,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-60, -60);
      for (let i = 0; i <= 10; ++i) g.lineTo(-150 + i * 30, 180 + Math.sin(i * 1.7 + f) * 14);
      g.lineTo(60, -60); g.closePath(); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.ellipse(0, -40, 66, 80, 0, 0, TAU); g.fill();
      g.fillStyle = '#1c0e34'; g.beginPath(); g.ellipse(0, -40, 62, 76, 0, 0, TAU); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.arc(0, -96, 46, 0, TAU); g.fill();
      g.fillStyle = '#0c061a'; g.beginPath(); g.arc(0, -96, 42, 0, TAU); g.fill();
      g.fillStyle = '#ffd24a';
      K.poly(g, [[-38, -128], [-30, -168], [-14, -140], [0, -176], [14, -140], [30, -168], [38, -128]]); g.fill();
      g.fillStyle = '#ff6ad5'; g.beginPath(); g.arc(0, -150, 6, 0, TAU); g.fill();
      g.fillStyle = '#c08cff';
      g.beginPath(); g.ellipse(-16, -96, 9, 5 + f * 2, 0, 0, TAU); g.ellipse(16, -96, 9, 5 + f * 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(-18, -98, 4, 3); g.fillRect(14, -98, 4, 3);
      for (const sx of [-1, 1]) {
        g.strokeStyle = OUT; g.lineWidth = 16; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx * 50, -60); g.lineTo(sx * 100, -10 + f * 10); g.lineTo(sx * 120, 30); g.stroke();
        g.strokeStyle = '#2a1448'; g.lineWidth = 11; g.stroke();
        g.fillStyle = '#c08cff'; g.beginPath(); g.arc(sx * 122, 34, 9, 0, TAU); g.fill();
      }
    });
  }

  function shadowWall() {
    return K.sprite('boss:wall', 140, 420, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(10,4,24,1)');
      gr.addColorStop(0.7, 'rgba(40,16,80,0.9)');
      gr.addColorStop(1, 'rgba(120,60,200,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0);
      for (let y = 0; y <= h; y += 20) g.lineTo(90 + Math.sin(y * 0.07) * 20 + (y % 40 ? 0 : 16), y);
      g.lineTo(0, h); g.closePath(); g.fill();
      g.fillStyle = '#c08cff';
      for (let i = 0; i < 8; ++i) { g.beginPath(); g.arc(30 + (i % 3) * 18, 30 + i * 50, 4, 0, TAU); g.fill(); }
    });
  }

  const PAINT = { boar, avalanche, wyrm, warden, king };

  function sprite(id, f) {
    return PAINT[id](f ? 1 : 0);
  }

  Object.assign(NS.bossArt, {
    sprite, shadowWall
  });
})();
