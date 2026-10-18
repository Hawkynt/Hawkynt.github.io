;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});
  const { TAU, OUT, ENEMY_FRAMES, make, shade, rgba, vgrad, ballGrad, ellipse, circle, rr, fillOut, body, gloss, limb, glow, sparkle, eye, dizzy } = Kit;

  /*
   * Sprites: the seven foe types, reskinned for each of the five worlds.
   */

  function legSet(g, xs, y, len, f, color, w) {
    for (let i = 0; i < xs.length; ++i) {
      const sw = Math.sin(f * Math.PI / 2 + i * 1.7) * 2.2;
      limb(g, xs[i], y, xs[i] + sw, y + len, w || 2.4, color);
    }
  }

  /* ── walker ── */
  function paintWalker(g, w, f, st) {
    const bob = [0, -1, 0, 1][f];
    if (w === 0) {
      /* slime: a wobbling jelly drop with a leaf on top */
      const sq = [1, 0.94, 1, 1.06][f];
      g.save();
      g.scale(1 / sq, sq);
      g.beginPath();
      g.moveTo(-19, 0);
      g.bezierCurveTo(-21, -18, -10, -30, 2, -30);
      g.bezierCurveTo(14, -30, 21, -16, 19, 0);
      g.closePath();
      const gr = g.createRadialGradient(-5, -22, 2, 0, -12, 24);
      gr.addColorStop(0, '#d8ff9a');
      gr.addColorStop(0.5, '#5ad04a');
      gr.addColorStop(1, '#2a7a2a');
      fillOut(g, gr, 1.8);
      gloss(g, -8, -22, 5, 3, 0.6);
      ellipse(g, 9, -6, 6, 3, 0);
      g.fillStyle = 'rgba(20,80,20,0.35)';
      g.fill();
      g.beginPath();
      g.moveTo(2, -29);
      g.quadraticCurveTo(8, -38, 14, -34);
      g.quadraticCurveTo(8, -30, 2, -29);
      fillOut(g, '#3a9a2a', 1.2);
      g.restore();
      eye(g, 3, -16, 4.2, st, 0.4);
      eye(g, 12, -16, 3.8, st, 0.4);
      g.beginPath();
      g.arc(8, -9, 3, 0.2, Math.PI - 0.2);
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    if (w === 1) {
      /* cave beetle: glossy shell with glowing spots */
      legSet(g, [-12, -4, 4, 12], -6 + bob, 6, f, '#1a1830', 2.4);
      ellipse(g, -2, -14 + bob, 18, 13);
      const gr = g.createRadialGradient(-8, -22 + bob, 2, -2, -14 + bob, 20);
      gr.addColorStop(0, '#8ab0ff');
      gr.addColorStop(0.5, '#3a4ab0');
      gr.addColorStop(1, '#1a1a50');
      fillOut(g, gr, 1.8);
      g.beginPath();
      g.moveTo(-2, -27 + bob);
      g.lineTo(-2, -2 + bob);
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      for (const s of [[-9, -17], [-6, -9], [4, -18], [7, -10]]) {
        glow(g, s[0], s[1] + bob, 5, '#7ae8ff', 0.7);
        circle(g, s[0], s[1] + bob, 1.6);
        g.fillStyle = '#c8faff';
        g.fill();
      }
      gloss(g, -9, -22 + bob, 6, 2.5, 0.5);
      body(g, 15, -10 + bob, 7, 6, '#2a2a5a', { noGloss: true });
      g.beginPath();
      g.moveTo(20, -8 + bob);
      g.quadraticCurveTo(26, -6 + bob, 24, -1 + bob);
      g.lineWidth = 1.6;
      g.strokeStyle = OUT;
      g.stroke();
      eye(g, 16.5, -12 + bob, 2.4, st, 0.5);
      return;
    }
    if (w === 2) {
      /* penguin: waddling, scarf of frost */
      const tilt = [-0.08, 0, 0.08, 0][f];
      g.save();
      g.rotate(tilt);
      ellipse(g, -6, -2, 5, 2.4);
      fillOut(g, '#ff9a2a', 1.2);
      ellipse(g, 6, -2, 5, 2.4);
      fillOut(g, '#ff9a2a', 1.2);
      ellipse(g, 0, -16, 14, 16);
      fillOut(g, vgrad(g, -32, 0, '#3a4a6a', '#141a2a'), 1.8);
      ellipse(g, 3, -13, 9, 11.5);
      g.fillStyle = vgrad(g, -25, -2, '#ffffff', '#c8d8f0');
      g.fill();
      ellipse(g, -12, -15, 4, 9, 0.3);
      fillOut(g, '#1e2638', 1.4);
      gloss(g, -5, -27, 4, 2, 0.4);
      g.beginPath();
      g.moveTo(9, -21);
      g.lineTo(17, -19);
      g.lineTo(9, -16.5);
      g.closePath();
      fillOut(g, '#ffa02a', 1.2);
      g.restore();
      eye(g, 3, -23, 2.6, st, 0.5);
      eye(g, 9, -23, 2.4, st, 0.5);
      return;
    }
    if (w === 3) {
      /* magma crab: cracked shell glowing from within, claws raised */
      legSet(g, [-12, -6, 6, 12], -7 + bob, 7, f, '#3a1a10', 2.4);
      const clawY = -18 + bob - (f % 2) * 2;
      limb(g, -12, -12 + bob, -20, clawY, 3, '#b8381a');
      limb(g, 12, -12 + bob, 21, clawY, 3, '#b8381a');
      body(g, -21, clawY - 3, 5, 4.5, '#d84a1a', { noGloss: true });
      body(g, 22, clawY - 3, 5.5, 5, '#d84a1a', { noGloss: true });
      ellipse(g, 0, -13 + bob, 17, 10);
      fillOut(g, ballGrad(g, 0, -13 + bob, 17, '#c03a18'), 1.8);
      g.beginPath();
      g.moveTo(-10, -14 + bob); g.lineTo(-4, -18 + bob); g.lineTo(2, -12 + bob); g.lineTo(8, -17 + bob);
      g.lineWidth = 1.8;
      g.strokeStyle = '#ffd040';
      g.stroke();
      glow(g, 0, -15 + bob, 10, '#ffa020', 0.35);
      limb(g, -4, -21 + bob, -6, -26 + bob, 1.4, '#3a1a10');
      limb(g, 4, -21 + bob, 6, -26 + bob, 1.4, '#3a1a10');
      eye(g, -6, -27 + bob, 2.6, st, 0.3);
      eye(g, 6, -27 + bob, 2.6, st, 0.3);
      return;
    }
    /* clockwork knight: round armour, glowing visor, wind-up key */
    legSet(g, [-6, 6], -8 + bob, 8, f, '#4a4a6a', 4);
    ellipse(g, -6, -1, 4.5, 2.4);
    fillOut(g, '#5a5a7a', 1.2);
    ellipse(g, 6, -1, 4.5, 2.4);
    fillOut(g, '#5a5a7a', 1.2);
    const kr = (f * Math.PI / 2);
    g.save();
    g.translate(-16, -18 + bob);
    g.rotate(kr);
    limb(g, -5, 0, 5, 0, 2.6, '#ffe08a');
    circle(g, -5, 0, 2.6); fillOut(g, '#ffe08a', 1);
    circle(g, 5, 0, 2.6); fillOut(g, '#ffe08a', 1);
    g.restore();
    body(g, 0, -18 + bob, 15, 14, '#b8c0d8');
    rr(g, -2, -24 + bob, 16, 6, 3);
    fillOut(g, '#1a1a2a', 1.2);
    glow(g, 7, -21 + bob, 9, st === 'windup' ? '#ff4a4a' : '#5ad1ff', 0.8);
    rr(g, 0, -22.5 + bob, 12, 3, 1.5);
    g.fillStyle = st === 'windup' ? '#ff8a8a' : '#c8f4ff';
    g.fill();
    g.beginPath();
    g.moveTo(-1, -32 + bob);
    g.quadraticCurveTo(-4, -40 + bob, 3, -40 + bob);
    g.lineWidth = 3;
    g.strokeStyle = '#d04a8a';
    g.stroke();
    circle(g, 4, -8 + bob, 1.5); g.fillStyle = '#7a7a9a'; g.fill();
    circle(g, -4, -8 + bob, 1.5); g.fill();
  }

  /* ── charger ── */
  function paintCharger(g, w, f, st) {
    const bob = [0, -1.5, 0, -1][f];
    const furs = ['#8a5a32', '#7a7a88', '#f0ece4', '#3a2420', '#5a3aa8'];
    const fur = furs[w];
    const legC = shade(fur, -0.45);
    const step = (i) => Math.sin(f * Math.PI / 2 + i * Math.PI) * 3;
    for (let i = 0; i < 4; ++i)
      limb(g, -14 + i * 9, -10 + bob, -14 + i * 9 + step(i), -1, 4, i % 2 ? legC : shade(legC, -0.2));
    for (let i = 0; i < 4; ++i) {
      ellipse(g, -14 + i * 9 + step(i) + 1, -1.2, 3, 1.8);
      fillOut(g, '#2a1a14', 1);
    }
    /* body */
    ellipse(g, -2, -18 + bob, 21, 13);
    fillOut(g, ballGrad(g, -2, -18 + bob, 21, fur), 1.8);
    if (w === 2) {
      /* ram wool puffs */
      for (let i = 0; i < 7; ++i) {
        circle(g, -18 + i * 5.5, -28 + bob + (i % 2) * 2, 4.5);
        fillOut(g, ballGrad(g, -18 + i * 5.5, -28 + bob, 4.5, '#ffffff'), 1.1);
      }
    } else if (w === 3) {
      g.beginPath();
      g.moveTo(-16, -20 + bob); g.lineTo(-8, -24 + bob); g.lineTo(-2, -17 + bob); g.lineTo(6, -23 + bob); g.lineTo(12, -18 + bob);
      g.lineWidth = 2;
      g.strokeStyle = '#ff9a2a';
      g.stroke();
      glow(g, -2, -20 + bob, 12, '#ff6a1a', 0.3);
    } else if (w === 1) {
      for (const p of [[-12, -26], [-4, -29], [5, -27]]) {
        g.beginPath();
        g.moveTo(p[0] - 3, p[1] + 3 + bob); g.lineTo(p[0], p[1] - 4 + bob); g.lineTo(p[0] + 3, p[1] + 3 + bob);
        g.closePath();
        fillOut(g, '#7ae8ff', 1);
      }
    } else if (w === 4) {
      rr(g, -18, -26 + bob, 30, 8, 3);
      fillOut(g, vgrad(g, -26, -18, '#ffe08a', '#b88a2a'), 1.2);
    } else {
      g.beginPath();
      for (let i = 0; i < 6; ++i) {
        g.moveTo(-16 + i * 4, -28 + bob);
        g.lineTo(-14 + i * 4, -33 + bob);
      }
      g.lineWidth = 1.6;
      g.strokeStyle = OUT;
      g.stroke();
    }
    gloss(g, -10, -25 + bob, 6, 2.5, 0.3);
    /* head */
    const hx = 19, hy = -16 + bob + (st === 'windup' ? 3 : 0);
    ellipse(g, hx, hy, 11, 9.5);
    fillOut(g, ballGrad(g, hx, hy, 11, shade(fur, w === 2 ? -0.1 : 0.05)), 1.8);
    ellipse(g, hx + 9, hy + 3, 4.5, 4);
    fillOut(g, w === 2 ? '#e8c0b0' : shade(fur, 0.25), 1.2);
    circle(g, hx + 10.5, hy + 2.5, 0.9); g.fillStyle = OUT; g.fill();
    if (w === 0 || w === 3) {
      /* tusks / bull horns */
      g.beginPath();
      g.moveTo(hx + 7, hy + 5); g.quadraticCurveTo(hx + 13, hy + 2, hx + 12, hy - 4);
      g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = '#fff4dc'; g.stroke();
      if (w === 3) {
        g.beginPath();
        g.moveTo(hx - 3, hy - 8); g.quadraticCurveTo(hx + 4, hy - 18, hx + 10, hy - 15);
        g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
        g.lineWidth = 2.4; g.strokeStyle = '#e8dcc0'; g.stroke();
      }
    } else if (w === 1) {
      g.beginPath();
      g.moveTo(hx + 6, hy - 4); g.lineTo(hx + 14, hy - 14); g.lineTo(hx + 10, hy - 2);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      glow(g, hx + 11, hy - 9, 7, '#7ae8ff', 0.6);
    } else if (w === 2) {
      g.beginPath();
      g.arc(hx - 2, hy - 2, 7, -2.6, 1.2);
      g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 3.4; g.strokeStyle = '#c8a878'; g.stroke();
    } else {
      g.beginPath();
      g.moveTo(hx + 8, hy - 2); g.lineTo(hx + 22, hy - 4); g.lineTo(hx + 8, hy + 2);
      g.closePath();
      fillOut(g, '#ffe08a', 1.2);
    }
    eye(g, hx + 2, hy - 3, 2.8, st, 0.5);
    if (st === 'windup') {
      /* dust kicked by a pawing hoof */
      for (let i = 0; i < 3; ++i) {
        circle(g, -24 - i * 5, -3 - i * 2, 3 - i * 0.6);
        g.fillStyle = 'rgba(200,180,150,0.6)';
        g.fill();
      }
    }
  }

  /* ── hopper ── */
  function paintHopper(g, w, f, st) {
    /* 0 crouch, 1 push, 2 air, 3 land */
    const crouch = [1, 0.3, 0, 0.6][f];
    const lift = [0, -2, -5, -1][f];
    const cols = ['#5ac84a', '#c8a060', '#ffffff', '#a82a1a', '#c0c8e0'];
    const base = cols[w];
    g.save();
    g.translate(0, lift);
    if (w === 4) {
      /* spring automaton: a coil under a brass dome */
      for (let i = 0; i < 4; ++i) {
        ellipse(g, 0, -2 - i * (3 - crouch * 1.4), 8, 2.4);
        g.lineWidth = 3;
        g.strokeStyle = OUT;
        g.stroke();
        g.lineWidth = 1.8;
        g.strokeStyle = '#d8dce8';
        g.stroke();
      }
      const top = -14 + crouch * 5;
      body(g, 0, top - 8, 13, 10, '#c89a3a');
      rr(g, -9, top - 10, 18, 5, 2.5);
      fillOut(g, '#2a2440', 1);
      eye(g, -3, top - 7.5, 2, st, 0.4);
      eye(g, 4, top - 7.5, 2, st, 0.4);
      circle(g, 0, top - 19, 2.4); fillOut(g, '#ff5a5a', 1);
      g.restore();
      return;
    }
    const by = -12 + crouch * 3;
    /* back legs folding */
    const kneeX = -12 - crouch * 3, kneeY = by + 2 - (1 - crouch) * 4;
    limb(g, -8, by, kneeX, kneeY, 5, shade(base, -0.2));
    limb(g, kneeX, kneeY, -4 + (1 - crouch) * -8, -1 + (f === 2 ? -2 : 0), 3.4, shade(base, -0.3));
    ellipse(g, -2 + (1 - crouch) * -8, -1, 5, 2); fillOut(g, shade(base, -0.3), 1);
    ellipse(g, 0, by, 15, 10 - crouch * 1.5);
    fillOut(g, ballGrad(g, 0, by, 15, base), 1.8);
    ellipse(g, 4, by + 4, 9, 4);
    g.fillStyle = w === 0 ? '#e8f8a0' : w === 3 ? '#ffb040' : 'rgba(255,255,255,0.55)';
    g.fill();
    limb(g, 9, by + 4, 11, -1, 2.6, shade(base, -0.25));
    if (w === 0 || w === 3) {
      body(g, 3, by - 10, 4.5, 4.5, base, { noGloss: true });
      body(g, 11, by - 9, 4.5, 4.5, base, { noGloss: true });
      eye(g, 3, by - 10.5, 3, st, 0.5);
      eye(g, 11, by - 9.5, 3, st, 0.5);
      g.beginPath();
      g.moveTo(5, by - 2);
      g.quadraticCurveTo(10, by + 1, 15, by - 3);
      g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
      if (w === 3)
        for (const s of [[-6, -16], [-1, -19], [-9, -11]]) {
          glow(g, s[0], s[1] + crouch * 3, 4, '#ffa020', 0.8);
        }
    } else if (w === 1) {
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.arc(-8 + i * 5, by, 9, -1.2, -0.3);
        g.lineWidth = 1.2;
        g.strokeStyle = 'rgba(70,40,10,0.55)';
        g.stroke();
      }
      ellipse(g, -2, by - 6, 11, 4, -0.15);
      fillOut(g, 'rgba(240,220,170,0.75)', 1.1);
      g.beginPath();
      g.moveTo(10, by - 6); g.quadraticCurveTo(22, by - 26, 30, by - 18);
      g.moveTo(8, by - 7); g.quadraticCurveTo(14, by - 30, 24, by - 28);
      g.lineWidth = 1.2; g.strokeStyle = '#5a4020'; g.stroke();
      glow(g, 10, by - 4, 6, '#7ae8ff', 0.4);
      eye(g, 9, by - 4, 3, st, 0.5);
    } else {
      /* snow hare ears */
      for (const ex of [2, 8]) {
        ellipse(g, ex - 3, by - 16, 3, 9, -0.4 - crouch * 0.4);
        fillOut(g, '#ffffff', 1.4);
        ellipse(g, ex - 3, by - 16, 1.4, 6, -0.4 - crouch * 0.4);
        g.fillStyle = '#ffb8c8';
        g.fill();
      }
      eye(g, 9, by - 3, 2.8, st, 0.5);
      circle(g, 15, by, 1.4); g.fillStyle = '#ff8aa8'; g.fill();
    }
    g.restore();
  }

  /* ── spiky ── */
  function paintSpiky(g, w, f, st) {
    const spikeC = ['#6a4a2a', '#7ae8ff', '#dff4ff', '#2a2028', '#ffe08a'][w];
    const bodyC = ['#c89060', '#3a4a8a', '#7ab0d8', '#5a2a2a', '#7a4aa8'][w];
    const bob = [0, -1, 0, -1][f];
    legSet(g, [-7, 7], -5, 5, f, shade(bodyC, -0.4), 3.4);
    /* spikes along the back */
    for (let i = 0; i < 7; ++i) {
      const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6;
      const bx = Math.cos(a) * 14, byy = -12 + bob + Math.sin(a) * 12;
      const tx = Math.cos(a) * 24, ty = -12 + bob + Math.sin(a) * 22;
      g.beginPath();
      g.moveTo(bx + Math.sin(a) * 4, byy - Math.cos(a) * 4);
      g.lineTo(tx, ty);
      g.lineTo(bx - Math.sin(a) * 4, byy + Math.cos(a) * 4);
      g.closePath();
      fillOut(g, vgrad(g, ty, byy, shade(spikeC, 0.5), shade(spikeC, -0.3)), 1.3);
    }
    if (w === 3)
      glow(g, 0, -20 + bob, 16, '#ff3a1a', 0.35);
    if (w === 1)
      glow(g, 0, -20 + bob, 16, '#7ae8ff', 0.3);
    ellipse(g, 0, -11 + bob, 15, 11);
    fillOut(g, ballGrad(g, 0, -11 + bob, 15, bodyC), 1.8);
    ellipse(g, 8, -8 + bob, 7, 6);
    g.fillStyle = rgba(shade(bodyC, 0.5), 0.8);
    g.fill();
    eye(g, 6, -12 + bob, 2.8, st, 0.5);
    eye(g, 12, -12 + bob, 2.5, st, 0.5);
    circle(g, 15, -7 + bob, 1.6); g.fillStyle = OUT; g.fill();
  }

  /* ── flyer (centre anchor) ── */
  function paintFlyer(g, w, f, st) {
    const flap = [-1, -0.2, 0.7, -0.2][f];
    const bob = [0, -1.5, 0, 1.5][f];
    const wingC = ['rgba(220,240,255,0.75)', '#3a2a4a', '#f0f0f8', 'rgba(255,170,60,0.7)', 'rgba(255,255,255,0.85)'][w];
    function wing(side) {
      g.save();
      g.translate(-2, -6 + bob);
      g.rotate(-side * (0.3 + flap * 0.6));
      if (w === 1) {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-side * 10, -14, -side * 20, -6);
        g.quadraticCurveTo(-side * 16, -2, -side * 15, 2);
        g.quadraticCurveTo(-side * 10, -2, -side * 8, 3);
        g.closePath();
      } else {
        ellipse(g, -side * 10, -6, 11, 6, side * 0.4);
      }
      fillOut(g, wingC, 1.3);
      g.restore();
    }
    if (w === 4) {
      /* cloud sprite: fluffy puffs with a cheeky face */
      for (const p of [[-10, 2, 7], [10, 2, 7], [0, -4, 10], [-6, -8, 6], [7, -9, 6]]) {
        circle(g, p[0], p[1] + bob, p[2]);
        fillOut(g, ballGrad(g, p[0], p[1] + bob, p[2], '#f4f6ff'), 1.4);
      }
      eye(g, -2, -3 + bob, 2.6, st, 0.4);
      eye(g, 6, -3 + bob, 2.6, st, 0.4);
      circle(g, -6, 2 + bob, 2); g.fillStyle = 'rgba(255,140,180,0.5)'; g.fill();
      sparkle(g, 14, -12 + bob, 3, 0.6 + 0.4 * (f % 2));
      return;
    }
    wing(1);
    if (w === 3)
      glow(g, 0, bob, 20, '#ff8a20', 0.45);
    const bodyC = ['#ffc83a', '#5a3a6a', '#f4f4fa', '#ff6a1a'][w];
    ellipse(g, 0, bob, 13, 11);
    fillOut(g, ballGrad(g, 0, bob, 13, bodyC), 1.8);
    if (w === 0) {
      for (const sx of [-6, 0]) {
        g.beginPath();
        g.ellipse(sx, bob, 2, 10.5, 0, 0, TAU);
        g.fillStyle = '#2a1a10';
        g.fill();
      }
      g.beginPath();
      g.moveTo(-13, bob); g.lineTo(-19, bob + 2); g.lineTo(-12, bob + 4);
      fillOut(g, '#2a1a10', 1);
    } else if (w === 1) {
      g.beginPath();
      g.moveTo(2, -8 + bob); g.lineTo(5, -16 + bob); g.lineTo(8, -8 + bob);
      g.moveTo(-4, -9 + bob); g.lineTo(-2, -16 + bob); g.lineTo(1, -9 + bob);
      fillOut(g, '#5a3a6a', 1.2);
      g.beginPath();
      g.moveTo(4, 5 + bob); g.lineTo(5, 9 + bob); g.lineTo(7, 5 + bob);
      g.fillStyle = '#ffffff';
      g.fill();
    } else if (w === 2) {
      ellipse(g, 3, 2 + bob, 7, 6);
      g.fillStyle = '#dde6f0';
      g.fill();
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.arc(-2 + i * 4, 3 + bob, 2, 0, Math.PI);
        g.lineWidth = 0.8;
        g.strokeStyle = '#9aa8c0';
        g.stroke();
      }
      g.beginPath();
      g.moveTo(6, -1 + bob); g.lineTo(9, 2 + bob); g.lineTo(5, 2 + bob);
      fillOut(g, '#ffb03a', 1);
    } else {
      g.beginPath();
      g.moveTo(-12, bob); g.quadraticCurveTo(-20, bob - 10, -16, bob - 18); g.quadraticCurveTo(-12, bob - 8, -6, bob - 9);
      fillOut(g, '#ffd040', 1.2);
    }
    gloss(g, -4, -5 + bob, 4, 2, 0.5);
    eye(g, 3, -3 + bob, w === 2 ? 3.6 : 2.8, st, 0.5);
    eye(g, 9, -3 + bob, w === 2 ? 3.4 : 2.6, st, 0.5);
    wing(-1);
  }

  /* ── diver (centre anchor) ── */
  function paintDiver(g, w, f, st) {
    const dive = st === 'windup';
    const flap = dive ? 0.9 : [-1, -0.3, 0.7, -0.3][f];
    const bodyC = ['#b07a3a', '#4a2a4a', '#d8e8f8', '#ff6a1a', '#2a2a40'][w];
    const wingC = ['#8a5a2a', '#3a1a3a', '#a8c8e8', '#ffb03a', '#3a3a58'][w];
    const bellyC = ['#f4e4c8', '#8a5a7a', '#ffffff', '#ffe08a', '#5a5a80'][w];
    g.save();
    if (dive)
      g.rotate(0.5);
    /* tail feathers */
    g.beginPath();
    g.moveTo(-12, 0); g.lineTo(-24, -4); g.lineTo(-22, 2); g.lineTo(-25, 6); g.lineTo(-12, 4);
    g.closePath();
    fillOut(g, shade(wingC, -0.15), 1.3);
    function wing(side, front) {
      g.save();
      g.translate(-2, -4);
      g.rotate(side * 0.1 - flap * 0.7 * side);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-8, -18 * side, -22, -14 * side);
      g.lineTo(-17, -10 * side);
      g.lineTo(-20, -6 * side);
      g.lineTo(-13, -4 * side);
      g.quadraticCurveTo(-8, 2, 0, 3);
      g.closePath();
      fillOut(g, front ? wingC : shade(wingC, -0.3), 1.4);
      g.restore();
    }
    wing(1, false);
    if (w === 3)
      glow(g, 0, 0, 22, '#ff7a1a', 0.45);
    if (w === 4)
      glow(g, 0, 0, 20, '#5ad1ff', 0.25);
    ellipse(g, 0, 0, 14, 9);
    fillOut(g, ballGrad(g, 0, 0, 14, bodyC), 1.8);
    ellipse(g, 2, 3, 8, 4.5);
    g.fillStyle = bellyC;
    g.fill();
    body(g, 13, -4, 7, 6.5, bodyC, { noGloss: true });
    g.beginPath();
    g.moveTo(18, -6); g.quadraticCurveTo(26, -4, 23, 1); g.lineTo(18, -1);
    g.closePath();
    fillOut(g, w === 1 ? '#e8e0f0' : '#ffc03a', 1.2);
    eye(g, 14.5, -6, 2.6, st, 0.6);
    if (w === 4) {
      g.beginPath();
      g.moveTo(-4, -8); g.lineTo(0, -14); g.lineTo(1, -9); g.lineTo(5, -15);
      g.lineWidth = 1.4; g.strokeStyle = '#7ae8ff'; g.stroke();
    }
    wing(-1, true);
    g.restore();
  }

  /* ── turret (bottom anchor) ── */
  function paintTurret(g, w, f, st) {
    const open = f === 1;
    const charge = st === 'windup';
    if (w === 0) {
      /* cannon-flower in a terracotta pot */
      g.beginPath();
      g.moveTo(-13, -16); g.lineTo(13, -16); g.lineTo(10, 0); g.lineTo(-10, 0);
      g.closePath();
      fillOut(g, vgrad(g, -16, 0, '#e8865a', '#9a4a2a'), 1.6);
      rr(g, -15, -19, 30, 5, 2);
      fillOut(g, '#d8764a', 1.4);
      limb(g, 0, -19, 2, -30, 3.6, '#3a9a2a');
      ellipse(g, -7, -24, 6, 2.6, -0.5); fillOut(g, '#4ab83a', 1.1);
      const hy = -38;
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6 + 0.3;
        ellipse(g, 2 + Math.cos(a) * 10, hy + Math.sin(a) * 10, 6, 4, a);
        fillOut(g, charge ? '#ff6a5a' : '#ff8ab8', 1.2);
      }
      circle(g, 2, hy, 9);
      fillOut(g, ballGrad(g, 2, hy, 9, '#ffd040'), 1.6);
      circle(g, 6, hy, open ? 5 : 3.4);
      g.fillStyle = '#3a1a10';
      g.fill();
      if (charge)
        glow(g, 6, hy, 9, '#ff4a2a', 0.8);
      eye(g, -2, hy - 3, 2, st === 'stunned' ? 'stunned' : 'normal', 0.3);
      return;
    }
    const bases = ['', '#3a4a8a', '#d8e4f0', '#3a2a24', '#5a4a8a'];
    const bc = bases[w];
    /* a sturdy pedestal */
    g.beginPath();
    g.moveTo(-16, 0); g.lineTo(-12, -16); g.lineTo(12, -16); g.lineTo(16, 0);
    g.closePath();
    fillOut(g, vgrad(g, -16, 0, shade(bc, 0.25), shade(bc, -0.4)), 1.6);
    rr(g, -14, -20, 28, 5, 2);
    fillOut(g, shade(bc, 0.1), 1.3);
    if (w === 4) {
      /* arcane orb floating over the pedestal */
      const y = -34 + (open ? -2 : 0);
      glow(g, 0, y, 18, charge ? '#ff5aa8' : '#c88aff', 0.7);
      circle(g, 0, y, 10);
      fillOut(g, ballGrad(g, 0, y, 10, charge ? '#ff7ac8' : '#a87aff'), 1.6);
      ellipse(g, 0, y, 14, 4, 0.3);
      g.lineWidth = 1.4;
      g.strokeStyle = '#ffe08a';
      g.stroke();
      eye(g, 2, y, 3, st, 0.4);
      return;
    }
    /* a barrel facing right with a muzzle glow */
    const by = -30;
    rr(g, -2, by - 6, 22, 12, 4);
    const barrelC = w === 1 ? '#5a6ab8' : w === 2 ? '#8aa0c0' : '#4a3028';
    fillOut(g, vgrad(g, by - 6, by + 6, shade(barrelC, 0.35), shade(barrelC, -0.4)), 1.5);
    rr(g, 17, by - 7.5, 6, 15, 2);
    fillOut(g, shade(barrelC, -0.2), 1.3);
    if (charge || open)
      glow(g, 23, by, 10, w === 3 ? '#ff7a1a' : w === 2 ? '#bff0ff' : '#7ae8ff', charge ? 0.95 : 0.5);
    circle(g, -2, by, 11);
    fillOut(g, ballGrad(g, -2, by, 11, w === 1 ? '#5a7ae0' : w === 2 ? '#f0f6ff' : '#6a4a3a'), 1.7);
    if (w === 1) {
      g.beginPath();
      g.moveTo(-6, by - 9); g.lineTo(-2, by - 20); g.lineTo(2, by - 9);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      glow(g, -2, by - 14, 8, '#7ae8ff', 0.5);
    } else if (w === 2) {
      rr(g, -12, by - 13, 20, 4, 2);
      fillOut(g, '#ffffff', 1);
    } else {
      g.beginPath();
      g.moveTo(-8, by - 4); g.lineTo(-3, by + 2); g.lineTo(2, by - 5);
      g.lineWidth = 1.6; g.strokeStyle = '#ffa020'; g.stroke();
    }
    eye(g, -1, by - 1, 3, st, 0.5);
  }

  const ENEMY_BOX = {
    walker: [64, 52, 32, 46], charger: [80, 52, 36, 46], hopper: [56, 56, 28, 50], spiky: [64, 50, 32, 44],
    flyer: [60, 50, 30, 25], diver: [64, 50, 30, 25], turret: [60, 64, 28, 58]
  };
  const PAINT = { walker: paintWalker, charger: paintCharger, hopper: paintHopper, spiky: paintSpiky, flyer: paintFlyer, diver: paintDiver, turret: paintTurret };
  const STATES = { normal: 1, windup: 1, stunned: 1, squash: 1 };

  function enemy(type, world, frame, state) {
    const t = PAINT[type] ? type : 'walker';
    const w = ((world | 0) % 5 + 5) % 5;
    const n = ENEMY_FRAMES[t];
    const f = ((frame | 0) % n + n) % n;
    const st = STATES[state] ? state : 'normal';
    const box = ENEMY_BOX[t];
    return make('enemy|' + t + '|' + w + '|' + f + '|' + st, box[0], box[1], box[2], box[3], (g) => {
      const air = t === 'flyer' || t === 'diver';
      if (!air) {
        ellipse(g, 0, 0.5, box[0] * 0.3, 2.2);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fill();
      }
      g.save();
      if (st === 'squash') {
        if (air)
          g.scale(1.15, 0.6);
        else
          g.scale(1.3, 0.42);
      }
      PAINT[t](g, w, f, st);
      g.restore();
      if (st === 'stunned')
        dizzy(g, 0, air ? -18 : -box[3] + 8, 22);
    });
  }

  Object.assign(Kit, { enemy });
})();
