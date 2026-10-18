;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});
  const { TAU, OUT, make, shade, vgrad, ballGrad, ellipse, circle, rr, fillOut, gloss, limb, glow, star, sparkle, eye } = Kit;

  /*
   * Sprites: pickups, blocks, props, platforms and projectiles.
   */

  function paintCoin(g, f) {
    const sw = Math.max(0.14, Math.abs(Math.cos(f * Math.PI / 8)));
    const r = 13;
    if (sw < 0.95) {
      /* the coin's rim seen edge-on */
      ellipse(g, 1.2 * (1 - sw), 0, r * sw + 2.2, r);
      g.fillStyle = '#9a6a10';
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = OUT;
      g.stroke();
    }
    ellipse(g, 0, 0, r * sw, r);
    const gr = g.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, '#fff6b0');
    gr.addColorStop(0.4, '#ffd23a');
    gr.addColorStop(1, '#c08a10');
    fillOut(g, gr, 1.6);
    ellipse(g, 0, 0, r * sw * 0.68, r * 0.68);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(150,100,10,0.8)';
    g.stroke();
    if (sw > 0.4) {
      g.save();
      g.scale(sw, 1);
      star(g, 0, 0, 6, 0.45);
      g.fillStyle = '#fff2a0';
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(150,100,10,0.7)';
      g.stroke();
      g.restore();
    }
    ellipse(g, -r * sw * 0.35, -r * 0.45, r * sw * 0.25, r * 0.16, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
    if (f === 1 || f === 5)
      sparkle(g, r * 0.5, -r * 0.6, 4.5, 0.95);
  }

  const GEM_COLORS = [['#ff6a8a', '#d8103a', '#600818'], ['#7affa0', '#18b84a', '#085020'], ['#8ad8ff', '#1a6ae0', '#081a60']];

  function paintGem(g, f, v) {
    const c = GEM_COLORS[((v | 0) % 3 + 3) % 3];
    const bob = Math.sin(f * TAU / 6) * 1.5;
    g.translate(0, bob);
    glow(g, 0, 0, 22, c[1], 0.35);
    /* a brilliant cut: crown and pavilion */
    g.beginPath();
    g.moveTo(-14, -5); g.lineTo(-8, -13); g.lineTo(8, -13); g.lineTo(14, -5); g.lineTo(0, 15);
    g.closePath();
    fillOut(g, vgrad(g, -13, 15, c[0], c[2], c[1]), 1.7);
    g.beginPath();
    g.moveTo(-14, -5); g.lineTo(14, -5);
    g.moveTo(-8, -13); g.lineTo(-4, -5); g.lineTo(0, 15);
    g.moveTo(8, -13); g.lineTo(4, -5); g.lineTo(0, 15);
    g.moveTo(-4, -5); g.lineTo(0, -13); g.lineTo(4, -5);
    g.lineWidth = 0.9;
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.stroke();
    g.beginPath();
    g.moveTo(-8, -13); g.lineTo(-4, -5); g.lineTo(-14, -5);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fill();
    g.beginPath();
    g.moveTo(4, -5); g.lineTo(14, -5); g.lineTo(0, 15);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fill();
    /* the shimmer sweeps across the facets */
    const sx = -12 + f * 5;
    sparkle(g, sx, -9 + (f % 2) * 4, 3.5 + (f === 2 ? 2 : 0), 0.9);
  }

  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.85);
    g.bezierCurveTo(x - s * 1.2, y, x - s * 1.0, y - s * 0.9, x - s * 0.5, y - s * 0.9);
    g.bezierCurveTo(x - s * 0.15, y - s * 0.9, x, y - s * 0.6, x, y - s * 0.4);
    g.bezierCurveTo(x, y - s * 0.6, x + s * 0.15, y - s * 0.9, x + s * 0.5, y - s * 0.9);
    g.bezierCurveTo(x + s * 1.0, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.85);
    g.closePath();
  }

  function paintHeart(g, f, empty) {
    const pulse = 1 + [0, 0.06, 0.1, 0.04][f % 4];
    if (!empty)
      glow(g, 0, 0, 20 * pulse, '#ff5a7a', 0.4);
    heartPath(g, 0, 1, 12 * pulse);
    if (empty) {
      fillOut(g, 'rgba(40,20,40,0.6)', 1.8);
      return;
    }
    fillOut(g, vgrad(g, -12, 12, '#ff9ab0', '#c0102e', '#ff3a5a'), 1.8);
    gloss(g, -5, -5, 3.6, 2.4, 0.7);
  }

  function paintFireFlower(g, f) {
    const sway = Math.sin(f * TAU / 4) * 0.12;
    limb(g, 0, 14, 0, 0, 3, '#3a9a2a');
    ellipse(g, -5, 9, 5, 2.2, -0.4); fillOut(g, '#4ab83a', 1);
    ellipse(g, 5, 7, 5, 2.2, 0.4); fillOut(g, '#4ab83a', 1);
    g.save();
    g.rotate(sway);
    glow(g, 0, -4, 20, '#ff7a1a', 0.5);
    for (let i = 0; i < 5; ++i) {
      const a = i * TAU / 5 - Math.PI / 2;
      ellipse(g, Math.cos(a) * 7, -4 + Math.sin(a) * 7, 5.5, 4, a);
      fillOut(g, i % 2 ? '#ff4a1a' : '#ff8a2a', 1.2);
    }
    circle(g, 0, -4, 5);
    fillOut(g, ballGrad(g, 0, -4, 5, '#ffe040'), 1.2);
    eye(g, -1.6, -5, 1.3, 'normal', 0.2);
    eye(g, 1.8, -5, 1.3, 'normal', 0.2);
    g.restore();
  }

  function paintStar(g, f) {
    const s = 1 + [0, 0.05, 0.08, 0.04][f % 4];
    glow(g, 0, 0, 26, '#ffe24a', 0.55);
    g.save();
    g.rotate(f * 0.12);
    star(g, 0, 0, 15 * s, 0.5);
    fillOut(g, vgrad(g, -15, 15, '#fffbd0', '#f0a010', '#ffd83a'), 1.8);
    g.restore();
    eye(g, -3.5, -1, 1.8, 'normal', 0.1);
    eye(g, 3.5, -1, 1.8, 'normal', 0.1);
    g.beginPath();
    g.arc(0, 2.5, 2.4, 0.2, Math.PI - 0.2);
    g.lineWidth = 1;
    g.strokeStyle = OUT;
    g.stroke();
    sparkle(g, 10, -11, 3.4, f % 2 ? 1 : 0.5);
  }

  function paintCheckpoint(g, f, raised) {
    /* stone base, carved pole, banner waving */
    rr(g, -12, -8, 24, 8, 3);
    fillOut(g, vgrad(g, -8, 0, '#a8a0b0', '#5a5468'), 1.6);
    limb(g, 0, -8, 0, -96, 3.4, '#c8a878');
    circle(g, 0, -98, 4.2);
    fillOut(g, raised ? '#ffe24a' : '#9a96a8', 1.4);
    if (raised)
      glow(g, 0, -98, 14, '#ffe24a', 0.8);
    const top = raised ? -94 : -40;
    const color = raised ? '#ff4a5a' : '#7a7488';
    g.beginPath();
    g.moveTo(2, top);
    for (let i = 0; i <= 6; ++i) {
      const x = 2 + i * 6;
      g.lineTo(x, top + Math.sin(f * TAU / 4 + i * 0.9) * 2.2 * (i / 6));
    }
    const endX = 38;
    g.lineTo(endX - 6, top + 13 + Math.sin(f * TAU / 4 + 5) * 2);
    g.lineTo(endX, top + 26 + Math.sin(f * TAU / 4 + 6) * 2.2);
    for (let i = 6; i >= 0; --i)
      g.lineTo(2 + i * 6, top + 26 + Math.sin(f * TAU / 4 + i * 0.9) * 2.2 * (i / 6));
    g.closePath();
    fillOut(g, vgrad(g, top, top + 26, shade(color, 0.3), shade(color, -0.35)), 1.6);
    star(g, 16, top + 13, 6, 0.45);
    g.fillStyle = raised ? '#fff2a0' : 'rgba(255,255,255,0.35)';
    g.fill();
  }

  const GOAL_TONE = [
    { stone: '#c8b898', glow: '#ffe24a', flag: '#e83a3a' },
    { stone: '#6a6a88', glow: '#7ae8ff', flag: '#5a8aff' },
    { stone: '#d8e4f0', glow: '#bff0ff', flag: '#4aa8ff' },
    { stone: '#4a3a34', glow: '#ff9a2a', flag: '#ffcf4a' },
    { stone: '#e8e0f8', glow: '#c88aff', flag: '#ffe08a' }
  ];

  function paintGoal(g, f, v) {
    const T = GOAL_TONE[((v | 0) % 5 + 5) % 5];
    /* an arched gate with a swirling portal and a pennant on top */
    glow(g, 0, -56, 70, T.glow, 0.45);
    g.beginPath();
    g.moveTo(-42, 0); g.lineTo(-42, -70);
    g.arc(0, -70, 42, Math.PI, 0);
    g.lineTo(42, 0); g.lineTo(28, 0); g.lineTo(28, -70);
    g.arc(0, -70, 28, 0, Math.PI, true);
    g.lineTo(-28, 0);
    g.closePath();
    fillOut(g, vgrad(g, -112, 0, shade(T.stone, 0.3), shade(T.stone, -0.4)), 2.4);
    for (let i = 0; i < 5; ++i) {
      g.beginPath();
      g.moveTo(-42, -12 - i * 14); g.lineTo(-28, -12 - i * 14);
      g.moveTo(28, -12 - i * 14); g.lineTo(42, -12 - i * 14);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    /* portal */
    g.save();
    g.beginPath();
    g.moveTo(-28, 0); g.lineTo(-28, -70); g.arc(0, -70, 28, Math.PI, 0); g.lineTo(28, 0);
    g.closePath();
    const pg = g.createRadialGradient(0, -50, 2, 0, -50, 50);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.3, T.glow);
    pg.addColorStop(1, shade(T.glow, -0.6));
    g.fillStyle = pg;
    g.fill();
    g.clip();
    for (let i = 0; i < 4; ++i) {
      g.beginPath();
      g.arc(0, -50, 8 + i * 9, f * 0.5 + i, f * 0.5 + i + 2.2);
      g.lineWidth = 2.6;
      g.strokeStyle = 'rgba(255,255,255,' + (0.5 - i * 0.08) + ')';
      g.stroke();
    }
    g.restore();
    /* keystone gem */
    g.beginPath();
    g.moveTo(0, -122); g.lineTo(8, -112); g.lineTo(0, -102); g.lineTo(-8, -112);
    g.closePath();
    fillOut(g, vgrad(g, -122, -102, '#ffffff', T.glow), 1.6);
    /* pennant */
    limb(g, 0, -122, 0, -140, 2, '#8a6a4a');
    g.beginPath();
    g.moveTo(1, -140);
    g.quadraticCurveTo(10, -138 + Math.sin(f * TAU / 6) * 3, 20, -135);
    g.quadraticCurveTo(10, -132 + Math.sin(f * TAU / 6 + 1) * 3, 1, -130);
    g.closePath();
    fillOut(g, T.flag, 1.2);
    sparkle(g, -18 + (f * 7) % 36, -40 - (f * 11) % 50, 3, 0.9);
  }

  const BLOCK_TONE = [
    { q: '#ffc83a', qd: '#b8780a', wood: '#b8783a', stone: '#8a7a6a' },
    { q: '#7ab0ff', qd: '#2a4ab0', wood: '#6a5a7a', stone: '#4a4a64' },
    { q: '#bff0ff', qd: '#4a8ac0', wood: '#8a7a6a', stone: '#9aaac0' },
    { q: '#ff9a3a', qd: '#a83a10', wood: '#4a3a34', stone: '#4a3430' },
    { q: '#e8c8ff', qd: '#7a4ac8', wood: '#c8c0e0', stone: '#a8a0c8' }
  ];

  function rivets(g, s, color) {
    for (const p of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
      circle(g, p[0], p[1], 2);
      fillOut(g, color, 0.8);
    }
  }

  function paintQBlock(g, f, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 6);
    fillOut(g, vgrad(g, -23, 23, shade(T.q, 0.35), T.qd, T.q), 2);
    rr(g, -19, -19, 38, 38, 4);
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.stroke();
    rivets(g, 16, shade(T.qd, -0.2));
    g.font = 'bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.strokeStyle = shade(T.qd, -0.5);
    g.strokeText('?', 0, 2);
    g.fillStyle = '#fff8e0';
    g.fillText('?', 0, 2);
    /* the shimmer band */
    g.save();
    rr(g, -23, -23, 46, 46, 6);
    g.clip();
    const x = -40 + f * 22;
    g.beginPath();
    g.moveTo(x, -26); g.lineTo(x + 10, -26); g.lineTo(x - 6, 26); g.lineTo(x - 16, 26);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    g.restore();
  }

  function paintUsed(g, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 6);
    fillOut(g, vgrad(g, -23, 23, shade(T.stone, 0.15), shade(T.stone, -0.45)), 2);
    rr(g, -18, -18, 36, 36, 4);
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.stroke();
    rivets(g, 16, shade(T.stone, -0.3));
  }

  function paintCrate(g, v) {
    const T = BLOCK_TONE[v];
    const iron = v === 3 || v === 4;
    const base = T.wood;
    rr(g, -23, -23, 46, 46, 3);
    fillOut(g, vgrad(g, -23, 23, shade(base, 0.25), shade(base, -0.35)), 2);
    for (let i = -1; i <= 1; ++i) {
      g.beginPath();
      g.moveTo(-21, i * 13);
      g.lineTo(21, i * 13);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-18, -18); g.lineTo(18, 18);
    g.moveTo(18, -18); g.lineTo(-18, 18);
    g.lineWidth = 6;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = iron ? '#9aa0b8' : shade(base, 0.15);
    g.stroke();
    rr(g, -23, -23, 46, 46, 3);
    g.lineWidth = 5;
    g.strokeStyle = iron ? '#6a6a80' : shade(base, -0.25);
    g.stroke();
    rivets(g, 19, iron ? '#c8cce0' : '#d8b878');
  }

  function paintCrumble(g, f, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 4);
    fillOut(g, vgrad(g, -23, 23, shade(T.stone, 0.3), shade(T.stone, -0.3)), 2);
    g.beginPath();
    g.moveTo(-23, -4); g.lineTo(23, -2);
    g.moveTo(-6, -23); g.lineTo(-8, -4);
    g.moveTo(8, -2); g.lineTo(10, 23);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.stroke();
    if (f >= 1) {
      g.beginPath();
      g.moveTo(-14, -20); g.lineTo(-4, -8); g.lineTo(-10, 4); g.lineTo(2, 14);
      g.moveTo(12, -18); g.lineTo(4, -6);
      g.lineWidth = 1.8;
      g.strokeStyle = OUT;
      g.stroke();
    }
    if (f >= 2) {
      g.beginPath();
      g.moveTo(-20, 10); g.lineTo(-8, 16); g.lineTo(-2, 22);
      g.moveTo(18, 4); g.lineTo(8, 10); g.lineTo(14, 20);
      g.moveTo(-2, -20); g.lineTo(6, -12); g.lineTo(18, -14);
      g.lineWidth = 2;
      g.strokeStyle = OUT;
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(-4, -8, 8, 6);
    }
    gloss(g, -12, -14, 7, 3, 0.25);
  }

  function paintGate(g, v) {
    const T = BLOCK_TONE[v];
    rr(g, -24, -24, 48, 48, 2);
    g.fillStyle = 'rgba(10,8,20,0.55)';
    g.fill();
    for (let i = 0; i < 4; ++i) {
      const x = -18 + i * 12;
      rr(g, x - 2.5, -24, 5, 46, 2);
      fillOut(g, vgrad(g, -24, 24, '#c8cce0', '#4a4a60'), 1.2);
      g.beginPath();
      g.moveTo(x - 3, 22); g.lineTo(x, 27); g.lineTo(x + 3, 22);
      fillOut(g, '#8a8aa0', 1);
    }
    for (const y of [-14, 8]) {
      rr(g, -24, y - 2.5, 48, 5, 2);
      fillOut(g, vgrad(g, y - 3, y + 3, '#a8acc0', '#3a3a50'), 1.2);
    }
    rivets(g, 18, T.q);
  }

  function paintSpring(g, v) {
    const comp = v === 1;
    const h = comp ? 8 : 20;
    rr(g, -20, 16, 40, 8, 3);
    fillOut(g, vgrad(g, 16, 24, '#8a8aa0', '#3a3a50'), 1.6);
    const n = 4;
    for (let i = 0; i < n; ++i) {
      const y = 16 - (i + 0.5) * h / n;
      ellipse(g, 0, y, 13, comp ? 1.4 : 2.6);
      g.lineWidth = 3.4;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = '#e0e4f0';
      g.stroke();
    }
    const pad = 16 - h - 6;
    rr(g, -22, pad, 44, 8, 4);
    fillOut(g, vgrad(g, pad, pad + 8, '#ff7a7a', '#b81a2a'), 1.6);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(-16, pad + 1.5, 26, 2);
  }

  function paintPlatform(g, v) {
    const T = BLOCK_TONE[v];
    const base = [T.wood, '#5a5a78', '#c8d8e8', '#4a3a34', '#e8e0f8'][v];
    rr(g, 2, 4, 140, 20, 6);
    fillOut(g, vgrad(g, 4, 24, shade(base, 0.25), shade(base, -0.4)), 2);
    rr(g, 2, 4, 140, 6, 3);
    g.fillStyle = v === 0 ? '#6ad04a' : v === 2 ? '#ffffff' : v === 3 ? '#ff8a2a' : v === 4 ? '#ffe08a' : '#7ae8ff';
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = OUT;
    g.stroke();
    for (let i = 1; i < 6; ++i) {
      g.beginPath();
      g.moveTo(2 + i * 23.3, 11);
      g.lineTo(2 + i * 23.3, 22);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    for (const x of [14, 130]) {
      circle(g, x, 16, 3.4);
      fillOut(g, '#d8dce8', 1);
    }
    if (v === 3)
      glow(g, 72, 26, 30, '#ff7a1a', 0.35);
    if (v === 4)
      glow(g, 72, 26, 30, '#c88aff', 0.35);
  }

  function paintFireball(g, f) {
    g.rotate(f * Math.PI / 2);
    glow(g, 0, 0, 15, '#ff9a2a', 0.85);
    circle(g, 0, 0, 8.5);
    const gr = g.createRadialGradient(-2, -2, 0, 0, 0, 8.5);
    gr.addColorStop(0, '#ffffe0');
    gr.addColorStop(0.4, '#ffd040');
    gr.addColorStop(1, '#ff5a1a');
    g.fillStyle = gr;
    g.fill();
    for (let i = 0; i < 3; ++i) {
      const a = i * TAU / 3;
      g.beginPath();
      g.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5);
      g.quadraticCurveTo(Math.cos(a + 0.5) * 14, Math.sin(a + 0.5) * 14, Math.cos(a + 0.9) * 8.5, Math.sin(a + 0.9) * 8.5);
      g.fillStyle = 'rgba(255,140,40,0.85)';
      g.fill();
    }
  }

  const SHOT_TONE = ['#ff5a8a', '#7ae8ff', '#bff0ff', '#ff8a2a', '#c88aff'];

  function paintShot(g, f, v) {
    const c = SHOT_TONE[v];
    glow(g, 0, 0, 10, c, 0.8);
    circle(g, 0, 0, 5 + (f % 2) * 0.6);
    fillOut(g, ballGrad(g, 0, 0, 5, c), 1.3);
    circle(g, -1.5, -1.5, 1.6);
    g.fillStyle = '#ffffff';
    g.fill();
  }

  function paintBossShot(g, f, v) {
    if (v === 0) {
      ellipse(g, 0, 2, 13, 11 - (f % 2) * 2);
      fillOut(g, ballGrad(g, 0, 2, 13, '#6ad84a'), 1.8);
      gloss(g, -4, -3, 4, 2.4, 0.6);
      eye(g, 3, 0, 2.4, 'windup', 0.3);
    } else if (v === 1) {
      g.rotate(f * 0.8);
      glow(g, 0, 0, 16, '#7ae8ff', 0.6);
      g.beginPath();
      g.moveTo(0, -14); g.lineTo(7, 0); g.lineTo(0, 14); g.lineTo(-7, 0);
      g.closePath();
      fillOut(g, vgrad(g, -14, 14, '#ffffff', '#3aa8e0'), 1.6);
    } else if (v === 2) {
      circle(g, 0, 0, 12);
      fillOut(g, ballGrad(g, 0, 0, 12, '#ffffff'), 1.8);
      for (let i = 0; i < 4; ++i) {
        circle(g, Math.cos(i * 1.7 + f) * 6, Math.sin(i * 1.7 + f) * 6, 1.6);
        g.fillStyle = '#c8d8f0';
        g.fill();
      }
    } else if (v === 3) {
      glow(g, 0, 0, 18, '#ff7a1a', 0.85);
      g.beginPath();
      g.moveTo(14, 0);
      g.quadraticCurveTo(0, -10, -16, -4 + (f % 2) * 3);
      g.quadraticCurveTo(-8, 0, -16, 5 - (f % 2) * 3);
      g.quadraticCurveTo(0, 10, 14, 0);
      fillOut(g, vgrad(g, -10, 10, '#ffe080', '#e83a10'), 1.6);
      circle(g, 6, 0, 4); g.fillStyle = '#ffffe8'; g.fill();
    } else {
      glow(g, 0, 0, 18, '#5ad1ff', 0.8);
      circle(g, 0, 0, 9);
      fillOut(g, ballGrad(g, 0, 0, 9, '#a87aff'), 1.6);
      g.beginPath();
      g.moveTo(-6, -8 + f); g.lineTo(-1, -1); g.lineTo(-4, 1); g.lineTo(3, 9 - f);
      g.lineWidth = 1.6;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
  }

  function paintShield(g) {
    circle(g, 0, 0, 33);
    const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 34);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.7, 'rgba(120,220,255,0.12)');
    gr.addColorStop(1, 'rgba(120,220,255,0.5)');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(190,240,255,0.85)';
    g.stroke();
    ellipse(g, -12, -16, 9, 4.5, -0.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fill();
    g.beginPath();
    g.arc(0, 0, 28, 0.4, 1.4);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.stroke();
  }

  function paintArrow(g) {
    glow(g, 0, 0, 16, '#7affc8', 0.5);
    g.beginPath();
    g.moveTo(13, 0); g.lineTo(-3, -10); g.lineTo(-1, -4); g.lineTo(-12, -4);
    g.lineTo(-12, 4); g.lineTo(-1, 4); g.lineTo(-3, 10);
    g.closePath();
    fillOut(g, vgrad(g, -10, 10, '#c8ffe8', '#18b86a'), 1.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(-10, -3, 12, 1.4);
  }

  const ITEM_DEF = {
    coin: [34, 34, 17, 17, 8, 1],
    gem: [48, 48, 24, 24, 6, 3],
    heart: [44, 44, 22, 22, 4, 1],
    fire: [44, 44, 22, 22, 4, 1],
    star: [56, 56, 28, 28, 4, 1],
    checkpoint: [64, 112, 20, 106, 4, 2],
    goal: [150, 160, 75, 154, 6, 5],
    qblock: [52, 52, 26, 26, 4, 5],
    used: [52, 52, 26, 26, 1, 5],
    crate: [52, 52, 26, 26, 1, 5],
    crumble: [52, 52, 26, 26, 3, 5],
    gate: [52, 56, 26, 26, 1, 5],
    spring: [52, 52, 26, 26, 1, 2],
    platform: [146, 30, 0, 4, 1, 5],
    fireball: [32, 32, 16, 16, 4, 1],
    shot: [24, 24, 12, 12, 4, 5],
    bossShot: [40, 40, 20, 20, 4, 5],
    shield: [72, 72, 36, 36, 1, 1],
    arrow: [36, 36, 18, 18, 1, 1]
  };

  function item(kind, frame, variant) {
    const k = ITEM_DEF[kind] ? kind : 'coin';
    const d = ITEM_DEF[k];
    const f = ((frame | 0) % d[4] + d[4]) % d[4];
    const v = ((variant | 0) % d[5] + d[5]) % d[5];
    return make('item|' + k + '|' + f + '|' + v, d[0], d[1], d[2], d[3], (g) => {
      switch (k) {
        case 'coin': paintCoin(g, f); break;
        case 'gem': paintGem(g, f, v); break;
        case 'heart': paintHeart(g, f, false); break;
        case 'fire': paintFireFlower(g, f); break;
        case 'star': paintStar(g, f); break;
        case 'checkpoint': paintCheckpoint(g, f, v === 1); break;
        case 'goal': paintGoal(g, f, v); break;
        case 'qblock': paintQBlock(g, f, v); break;
        case 'used': paintUsed(g, v); break;
        case 'crate': paintCrate(g, v); break;
        case 'crumble': paintCrumble(g, f, v); break;
        case 'gate': paintGate(g, v); break;
        case 'spring': paintSpring(g, v); break;
        case 'platform': paintPlatform(g, v); break;
        case 'fireball': paintFireball(g, f); break;
        case 'shot': paintShot(g, f, v); break;
        case 'bossShot': paintBossShot(g, f, v); break;
        case 'shield': paintShield(g); break;
        case 'arrow': paintArrow(g); break;
        default: break;
      }
    });
  }

  Object.assign(Kit, { paintCoin, paintGem, heartPath, ITEM_DEF, item });
})();
