;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});
  const { TAU, OUT, HERO_FRAMES, make, shade, rgba, vgrad, ellipse, circle, rr, fillOut, limb, sparkle, eye } = Kit;

  /*
   * Sprites: the hero in nine animated poses for every skin.
   */

  function heroPose(pose, f) {
    const P = {
      bob: 0, sx: 1, sy: 1, lean: 0, legF: 0.08, legB: -0.08, kneeF: 0, kneeB: 0,
      armF: 0.25, armB: -0.25, scarf: -0.35, wave: 0, eyes: 'normal', mouth: 'smile', look: 0.35, lines: 0, sparkle: 0
    };
    switch (pose) {
      case 'idle': {
        const b = [0, -0.6, -1.1, -0.6][f];
        P.bob = b;
        P.sy = 1 - b * 0.012;
        P.armF = 0.2 - b * 0.06;
        P.armB = -0.2 + b * 0.06;
        P.scarf = -0.55 + Math.sin(f * 1.6) * 0.08;
        P.wave = f * 1.6;
        if (f === 3)
          P.eyes = 'blink';
        break;
      }
      case 'run': {
        const ph = f / 8 * TAU;
        P.legF = Math.sin(ph) * 0.95;
        P.legB = -P.legF;
        P.kneeF = Math.max(0, -Math.sin(ph)) * 0.6;
        P.kneeB = Math.max(0, Math.sin(ph)) * 0.6;
        P.armF = -Math.sin(ph) * 1.05;
        P.armB = Math.sin(ph) * 1.05;
        P.bob = -Math.abs(Math.cos(ph)) * 2.4;
        P.lean = 0.16;
        P.sy = 1 + Math.abs(Math.cos(ph)) * 0.03;
        P.scarf = 0.12 + Math.sin(ph * 2) * 0.14;
        P.wave = ph * 2;
        P.mouth = 'open';
        break;
      }
      case 'jump':
        P.legF = 0.85; P.kneeF = 0.7; P.legB = -0.35; P.kneeB = 0.2;
        P.armF = 2.7 - f * 0.2; P.armB = -0.9;
        P.sy = 1.07; P.sx = 0.94;
        P.scarf = -0.85 + f * 0.1; P.wave = 1 + f;
        P.mouth = 'open'; P.look = 0.5;
        break;
      case 'fall':
        P.legF = 0.35; P.legB = -0.3; P.kneeB = 0.2;
        P.armF = 2.5 + f * 0.15; P.armB = -2.4 - f * 0.15;
        P.scarf = 1.05 + f * 0.12; P.wave = 2 + f * 1.3;
        P.eyes = 'wide'; P.mouth = 'o'; P.look = 0.3;
        break;
      case 'wall':
        P.lean = -0.08;
        P.armF = 2.2; P.armB = 0.9;
        P.legF = 0.75; P.kneeF = 0.6; P.legB = -0.1;
        P.scarf = -1.25; P.wave = 0.6;
        P.look = -0.45; P.mouth = 'flat';
        break;
      case 'dash':
        P.lean = 0.55; P.sx = 1.08; P.sy = 0.94;
        P.legF = -0.6; P.legB = -1.35; P.kneeF = 0.3;
        P.armF = -1.3; P.armB = -1.7;
        P.scarf = 0.02 + f * 0.05; P.wave = f * 2;
        P.lines = 1; P.mouth = 'grit'; P.look = 0.55;
        break;
      case 'hurt':
        P.lean = -0.35;
        P.armF = 2.1; P.armB = -2.5;
        P.legF = 0.55; P.legB = -0.45; P.kneeF = 0.3;
        P.eyes = 'hurt'; P.mouth = 'o'; P.scarf = 0.7; P.wave = 1;
        break;
      case 'land':
        P.sy = 0.8; P.sx = 1.16;
        P.legF = 0.55; P.legB = -0.55; P.kneeF = 0.5; P.kneeB = 0.5;
        P.armF = 0.95; P.armB = -0.95;
        P.scarf = -0.95; P.wave = 0.4;
        break;
      case 'win': {
        const b = [0, -4, -6, -3][f];
        P.bob = b;
        P.armF = 2.9 + Math.sin(f * 1.6) * 0.2;
        P.armB = -2.75 - Math.cos(f * 1.6) * 0.2;
        P.legF = f === 1 || f === 2 ? 0.6 : 0.1;
        P.kneeF = f === 1 || f === 2 ? 0.7 : 0;
        P.legB = -0.15;
        P.eyes = 'happy'; P.mouth = 'grin';
        P.scarf = 0.3 + f * 0.2; P.wave = f * 1.8;
        P.sparkle = 1;
        break;
      }
      default:
        break;
    }
    return P;
  }

  function heroLeg(g, k, hipX, hipY, a, knee, front) {
    const len = 11 * (1 - 0.28 * knee);
    const fx = hipX + Math.sin(a) * len, fy = hipY + Math.cos(a) * len;
    const pants = front ? shade(k.tunic, -0.35) : shade(k.tunic, -0.5);
    limb(g, hipX, hipY, fx, fy, 5.2, pants);
    /* the boot: a rounded toe pointing forward */
    g.save();
    g.translate(fx, fy);
    g.rotate(a * 0.35);
    ellipse(g, 1.6, 0.6, 4.6, 3.2);
    const boot = front ? k.boots : shade(k.boots, -0.25);
    fillOut(g, vgrad(g, -3, 4, shade(boot, 0.3), shade(boot, -0.35)), 1.4);
    g.fillStyle = rgba('#ffffff', 0.3);
    g.fillRect(-0.5, -2.2, 3.5, 1);
    g.restore();
  }

  function heroArm(g, k, sx, sy, a, front) {
    const hx = sx + Math.sin(a) * 9, hy = sy + Math.cos(a) * 9;
    limb(g, sx, sy, hx, hy, 4.4, front ? k.tunic : shade(k.tunic, -0.3));
    circle(g, hx, hy, 2.7);
    fillOut(g, front ? k.skin : shade(k.skin, -0.15), 1.2);
  }

  /* the scarf tail: a tapered ribbon that ripples along its length */
  function heroScarfTail(g, k, P) {
    const ax = -5, ay = -28.5;
    const len = 19;
    const dx = -Math.cos(P.scarf), dy = -Math.sin(P.scarf);
    const nx = -dy, ny = dx;
    const left = [], right = [], mid = [];
    const N = 9;
    for (let i = 0; i <= N; ++i) {
      const t = i / N;
      const off = Math.sin(P.wave + t * 4.2) * 3.4 * t;
      const cx = ax + dx * len * t + nx * off, cy = ay + dy * len * t + ny * off;
      const half = 2.6 + 1.6 * t;
      left.push([cx + nx * half, cy + ny * half]);
      right.push([cx - nx * half, cy - ny * half]);
      mid.push([cx, cy]);
    }
    g.beginPath();
    g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= N; ++i)
      g.lineTo(left[i][0], left[i][1]);
    /* a forked, fringed tip */
    const tip = mid[N];
    g.lineTo(tip[0] + dx * 3 + nx * 2.5, tip[1] + dy * 3 + ny * 2.5);
    g.lineTo(tip[0] + dx * 0.5, tip[1] + dy * 0.5);
    g.lineTo(tip[0] + dx * 3 - nx * 2.5, tip[1] + dy * 3 - ny * 2.5);
    for (let i = N; i >= 0; --i)
      g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    const gr = g.createLinearGradient(ax, ay, ax + dx * len, ay + dy * len);
    gr.addColorStop(0, shade(k.scarf, 0.15));
    gr.addColorStop(1, shade(k.scarf, -0.3));
    fillOut(g, gr, 1.5);
    /* a highlight along one edge and a darker fold line */
    g.beginPath();
    for (let i = 1; i < N; ++i) {
      const p = left[i], q = mid[i];
      const x = (p[0] * 2 + q[0]) / 3, y = (p[1] * 2 + q[1]) / 3;
      if (i === 1) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 1.1;
    g.strokeStyle = rgba(shade(k.scarf, 0.55), 0.8);
    g.stroke();
    g.beginPath();
    for (let i = 2; i < N; ++i) {
      const p = right[i], q = mid[i];
      const x = (p[0] + q[0] * 2) / 3, y = (p[1] + q[1] * 2) / 3;
      if (i === 2) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 0.9;
    g.strokeStyle = rgba(shade(k.scarf, -0.6), 0.5);
    g.stroke();
  }

  function heroFace(g, k, P) {
    /* face opening inside the hood */
    ellipse(g, 4.2, -37, 8.4, 8.2);
    const fg = g.createRadialGradient(6, -40, 1, 4, -37, 9);
    fg.addColorStop(0, shade(k.skin, 0.25));
    fg.addColorStop(0.7, k.skin);
    fg.addColorStop(1, shade(k.skin, -0.25));
    g.fillStyle = fg;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = shade(k.hood, -0.55);
    g.stroke();
    /* blush */
    ellipse(g, 0.5, -33.8, 1.8, 1.1);
    g.fillStyle = 'rgba(255,110,120,0.45)';
    g.fill();
    ellipse(g, 10.2, -33.8, 1.6, 1.0);
    g.fill();
    eye(g, 2.4, -38.2, 2.6, P.eyes, P.look);
    eye(g, 8.2, -38.2, 2.5, P.eyes, P.look);
    g.beginPath();
    g.lineWidth = 1.1;
    g.strokeStyle = OUT;
    g.fillStyle = '#8a2a3a';
    if (P.mouth === 'open' || P.mouth === 'grin') {
      g.moveTo(3.4, -33.6);
      g.quadraticCurveTo(5.6, -30.2 - (P.mouth === 'grin' ? 0.8 : 0), 7.8, -33.6);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (P.mouth === 'o') {
      ellipse(g, 5.6, -32.8, 1.3, 1.6);
      g.fill();
      g.stroke();
    } else if (P.mouth === 'grit') {
      g.moveTo(3.6, -33);
      g.lineTo(7.8, -33.4);
      g.stroke();
    } else if (P.mouth === 'flat') {
      g.moveTo(4, -33);
      g.lineTo(7, -33);
      g.stroke();
    } else {
      g.moveTo(3.8, -33.8);
      g.quadraticCurveTo(5.6, -32, 7.4, -33.8);
      g.stroke();
    }
  }

  function heroHood(g, k, P) {
    /* the two hood points, bending back with the motion */
    const back = Math.max(-0.4, Math.min(0.6, P.scarf * 0.25 + P.lean * 0.6));
    g.beginPath();
    g.moveTo(-5, -47);
    g.quadraticCurveTo(-9 - back * 5, -54, -12 - back * 8, -53 + back * 3);
    g.quadraticCurveTo(-11, -48, -10.5, -43);
    g.closePath();
    fillOut(g, shade(k.hood, -0.2), 1.4);
    g.beginPath();
    g.moveTo(3, -49.5);
    g.quadraticCurveTo(1 - back * 4, -57, -2.5 - back * 8, -57.5 + back * 3);
    g.quadraticCurveTo(-3, -53, -5, -49);
    g.closePath();
    fillOut(g, k.hood, 1.4);
    /* the hood dome */
    circle(g, 1, -38.5, 13);
    const hg = g.createRadialGradient(-3, -45, 2, 1, -38, 14);
    hg.addColorStop(0, shade(k.hood, 0.35));
    hg.addColorStop(0.6, k.hood);
    hg.addColorStop(1, shade(k.hood, -0.45));
    fillOut(g, hg, 1.7);
    /* trim seam and a soft rim light on the lit side */
    ellipse(g, 4.2, -37, 9.6, 9.4);
    g.lineWidth = 1.5;
    g.strokeStyle = shade(k.trim, -0.15);
    g.stroke();
    ellipse(g, 4.2, -37, 9.6, 9.4);
    g.lineWidth = 0.6;
    g.strokeStyle = rgba(shade(k.trim, 0.6), 0.9);
    g.stroke();
    g.beginPath();
    g.arc(1, -38.5, 11.6, -2.6, -1.6);
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.stroke();
  }

  function heroTorso(g, k) {
    g.beginPath();
    g.moveTo(-8, -28);
    g.quadraticCurveTo(0, -30.5, 8, -28);
    g.lineTo(10.5, -13);
    g.quadraticCurveTo(0, -10.5, -10.5, -13);
    g.closePath();
    const tg = g.createLinearGradient(-10, -28, 10, -12);
    tg.addColorStop(0, shade(k.tunic, 0.25));
    tg.addColorStop(0.6, k.tunic);
    tg.addColorStop(1, shade(k.tunic, -0.35));
    fillOut(g, tg, 1.6);
    /* hem trim */
    g.beginPath();
    g.moveTo(-10.2, -14.2);
    g.quadraticCurveTo(0, -11.8, 10.2, -14.2);
    g.lineWidth = 1.6;
    g.strokeStyle = k.trim;
    g.stroke();
    /* belt and buckle */
    rr(g, -9.4, -20, 18.8, 3.4, 1.2);
    fillOut(g, shade(k.boots, -0.1), 1);
    rr(g, 1.8, -20.6, 4.4, 4.6, 1);
    fillOut(g, k.trim, 1);
    g.fillStyle = shade(k.trim, -0.5);
    g.fillRect(3.2, -19.2, 1.6, 1.8);
    /* a stitched tunic seam */
    g.beginPath();
    g.moveTo(-1, -27);
    g.lineTo(-1.5, -21);
    g.lineWidth = 0.8;
    g.strokeStyle = rgba(shade(k.tunic, -0.6), 0.6);
    g.stroke();
  }

  function heroScarfWrap(g, k) {
    rr(g, -8.5, -30.6, 17, 5.4, 2.6);
    fillOut(g, vgrad(g, -30.6, -25.2, shade(k.scarf, 0.3), shade(k.scarf, -0.3)), 1.4);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(-6, -29.8, 11, 1);
  }

  function paintHero(g, k, pose, f) {
    const P = heroPose(pose, f);
    if (P.lines) {
      /* speed streaks trailing the dash */
      for (let i = 0; i < 4; ++i) {
        const y = -36 + i * 8 + (f ? 2 : 0);
        g.beginPath();
        g.moveTo(-28 + i * 2, y);
        g.lineTo(-14 - (i % 2) * 4, y);
        g.lineWidth = 1.6;
        g.strokeStyle = rgba(k.trim, 0.55 - i * 0.08);
        g.stroke();
      }
    }
    /* a soft contact shadow */
    ellipse(g, 0, 0.5, 10 * P.sx, 2.2);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fill();
    g.save();
    g.translate(0, P.bob);
    g.scale(P.sx, P.sy);
    g.translate(0, -13);
    g.rotate(P.lean);
    g.translate(0, 13);
    heroScarfTail(g, k, P);
    heroArm(g, k, -4.5, -25.5, P.armB, false);
    heroLeg(g, k, -3.4, -13.4, P.legB, P.kneeB, false);
    heroTorso(g, k);
    heroLeg(g, k, 3.4, -13.4, P.legF, P.kneeF, true);
    heroScarfWrap(g, k);
    /* a raised front arm passes behind the big head instead of over the face */
    const raised = P.armF > 1.9;
    if (raised)
      heroArm(g, k, 4.6, -25.5, P.armF, true);
    heroHood(g, k, P);
    heroFace(g, k, P);
    if (!raised)
      heroArm(g, k, 4.6, -25.5, P.armF, true);
    g.restore();
    if (P.sparkle) {
      sparkle(g, -16, -52 + (f % 2) * 4, 3.6, 0.9);
      sparkle(g, 17, -44 - (f % 2) * 4, 2.8, 0.8);
    }
  }

  function skinKey(k) {
    return k.id || [k.tunic, k.trim, k.scarf, k.hood, k.skin, k.boots].join('');
  }

  function hero(skin, pose, frame) {
    const n = HERO_FRAMES[pose] ? pose : 'idle';
    const f = ((frame | 0) % HERO_FRAMES[n] + HERO_FRAMES[n]) % HERO_FRAMES[n];
    return make('hero|' + skinKey(skin) + '|' + n + '|' + f, 72, 74, 36, 70, (g) => paintHero(g, skin, n, f));
  }

  Object.assign(Kit, { hero });
})();
