;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});
  const { OUT, BOSS_FRAMES, make, vgrad, ballGrad, ellipse, circle, rr, fillOut, gloss, limb, glow, star, eye, tint } = Kit;

  /*
   * Sprites: the five bosses in their idle, attack, hurt and special poses.
   */

  function crown(g, x, y, w, color) {
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x - w / 2, y - w * 0.4);
    g.lineTo(x - w / 4, y - w * 0.18);
    g.lineTo(x, y - w * 0.55);
    g.lineTo(x + w / 4, y - w * 0.18);
    g.lineTo(x + w / 2, y - w * 0.4);
    g.lineTo(x + w / 2, y);
    g.closePath();
    fillOut(g, vgrad(g, y - w * 0.55, y, '#fff2b0', color || '#e8a820'), 1.6);
    for (const gx of [-w / 4, 0, w / 4]) {
      circle(g, x + gx, y - w * 0.08, w * 0.06);
      fillOut(g, '#e83a5a', 0.9);
    }
  }

  function paintSlime(g, pose, f) {
    const jig = [0, 0.04, 0, -0.04][f % 4];
    let sx = 1 + jig, sy = 1 - jig;
    if (pose === 'attack') { sx = f ? 1.25 : 0.82; sy = f ? 0.78 : 1.22; }
    if (pose === 'special') { sx = 1.08; sy = 0.95; }
    if (pose === 'special')
      glow(g, 0, -60, 100, '#a8ff6a', 0.45);
    g.save();
    g.scale(sx, sy);
    g.beginPath();
    g.moveTo(-76, 0);
    g.bezierCurveTo(-82, -70, -40, -112, 0, -112);
    g.bezierCurveTo(40, -112, 82, -70, 76, 0);
    g.quadraticCurveTo(0, 8, -76, 0);
    g.closePath();
    const gr = g.createRadialGradient(-22, -80, 6, 0, -50, 100);
    gr.addColorStop(0, '#e8ffb0');
    gr.addColorStop(0.45, '#6ad84a');
    gr.addColorStop(1, '#1e6a2a');
    fillOut(g, gr, 3);
    /* swallowed treasures floating inside */
    circle(g, -30, -30, 7); g.fillStyle = 'rgba(255,215,90,0.75)'; g.fill();
    circle(g, 34, -22, 5); g.fill();
    ellipse(g, 10, -40, 9, 5, 0.4); g.fillStyle = 'rgba(30,90,40,0.35)'; g.fill();
    gloss(g, -38, -84, 18, 9, 0.55);
    gloss(g, -52, -60, 5, 4, 0.4);
    g.restore();
    crown(g, 0, -108 * sy + 6, 70);
    const st = pose === 'hurt' ? 'hurt' : pose === 'attack' || pose === 'special' ? 'windup' : 'normal';
    eye(g, -18, -62 * sy, 13, st, 0.25);
    eye(g, 22, -62 * sy, 12, st, 0.25);
    g.beginPath();
    if (pose === 'attack' || pose === 'hurt') {
      ellipse(g, 4, -30 * sy, 18, 12);
      fillOut(g, '#3a0a18', 2);
      g.fillStyle = '#ffffff';
      g.fillRect(-8, -40 * sy, 6, 6);
      g.fillRect(10, -40 * sy, 6, 6);
    } else {
      g.arc(4, -40 * sy, 18, 0.25, Math.PI - 0.25);
      g.lineWidth = 3;
      g.strokeStyle = OUT;
      g.stroke();
    }
  }

  function paintGolem(g, pose, f) {
    const bob = [0, -2, 0, 2][f % 4];
    const raise = pose === 'attack' ? (f ? 20 : -16) : pose === 'special' ? -10 : 0;
    const crys = pose === 'special' ? '#ffffff' : '#7ae8ff';
    if (pose === 'special')
      glow(g, 0, -80, 110, '#7ae8ff', 0.5);
    /* legs */
    rr(g, -42, -40, 30, 40, 8);
    fillOut(g, vgrad(g, -40, 0, '#8a8aa0', '#3a3a50'), 2.4);
    rr(g, 12, -40, 30, 40, 8);
    fillOut(g, vgrad(g, -40, 0, '#8a8aa0', '#3a3a50'), 2.4);
    /* torso of stacked boulders */
    g.save();
    g.translate(0, bob);
    ellipse(g, 0, -80, 58, 46);
    fillOut(g, ballGrad(g, 0, -80, 58, '#6a6a88'), 3);
    for (const r of [[-24, -96, 14, 10], [20, -66, 16, 11], [-18, -58, 10, 7], [30, -100, 9, 7]]) {
      ellipse(g, r[0], r[1], r[2], r[3], 0.3);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(20,16,40,0.5)';
      g.stroke();
    }
    /* crystal spikes out of the shoulders */
    for (const c of [[-46, -112, -0.5, 30], [-30, -124, -0.2, 36], [36, -118, 0.35, 32], [52, -104, 0.7, 24]]) {
      g.save();
      g.translate(c[0], c[1] + 18);
      g.rotate(c[2]);
      g.beginPath();
      g.moveTo(-7, 0); g.lineTo(0, -c[3]); g.lineTo(7, 0);
      g.closePath();
      fillOut(g, vgrad(g, -c[3], 0, '#e8ffff', crys === '#ffffff' ? '#bff8ff' : '#3aa8e0'), 1.6);
      g.restore();
      glow(g, c[0], c[1], 20, '#7ae8ff', 0.35);
    }
    /* a crystal heart pulsing in the chest */
    glow(g, 0, -64, 30, '#7ae8ff', pose === 'special' ? 0.9 : 0.55);
    g.beginPath();
    g.moveTo(0, -80); g.lineTo(11, -64); g.lineTo(0, -48); g.lineTo(-11, -64);
    g.closePath();
    fillOut(g, vgrad(g, -80, -48, '#ffffff', '#3ab8f0', '#9af4ff'), 2);
    /* head on the shoulders */
    rr(g, -26, -110, 52, 34, 12);
    fillOut(g, vgrad(g, -110, -76, '#7a7a9a', '#4a4a64'), 2.4);
    const st = pose === 'hurt' ? 'hurt' : 'windup';
    glow(g, -10, -94, 14, pose === 'hurt' ? '#ffffff' : '#7ae8ff', 0.8);
    glow(g, 12, -94, 14, pose === 'hurt' ? '#ffffff' : '#7ae8ff', 0.8);
    if (st === 'hurt') {
      eye(g, -10, -94, 6, 'hurt');
      eye(g, 12, -94, 6, 'hurt');
    } else {
      rr(g, -18, -98, 15, 7, 3); g.fillStyle = '#d8ffff'; g.fill();
      rr(g, 5, -98, 15, 7, 3); g.fill();
    }
    g.restore();
    /* fists */
    for (const side of [-1, 1]) {
      const fx = side * 70, fy = -48 + bob + (side > 0 ? raise * 2.2 : raise * 0.6);
      limb(g, side * 44, -96 + bob, fx, fy, 18, '#5a5a74');
      circle(g, side * 48, -96 + bob, 15);
      fillOut(g, ballGrad(g, side * 48, -96 + bob, 15, '#6a6a88'), 2.2);
      circle(g, fx, fy, 20);
      fillOut(g, ballGrad(g, fx, fy, 20, '#7a7a98'), 2.4);
      g.beginPath();
      g.moveTo(fx - 8, fy - 14); g.lineTo(fx - 3, fy - 24); g.lineTo(fx + 2, fy - 13);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      g.beginPath();
      g.moveTo(fx - 6, fy - 4); g.lineTo(fx + 6, fy - 2);
      g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    }
  }

  function paintYeti(g, pose, f) {
    const bob = [0, -2, 0, -1][f % 4];
    const arm = pose === 'attack' ? (f ? 1.2 : -2.4) : pose === 'special' ? -2.8 : 0.3 + bob * 0.05;
    if (pose === 'special')
      glow(g, 0, -90, 100, '#bff0ff', 0.45);
    /* legs */
    for (const side of [-1, 1]) {
      ellipse(g, side * 26, -16, 20, 20);
      fillOut(g, ballGrad(g, side * 26, -16, 20, '#e8f0fa'), 2.4);
      ellipse(g, side * 26 + 6, -2, 18, 6);
      fillOut(g, '#6a7a9a', 2);
    }
    g.save();
    g.translate(0, bob);
    /* shaggy body: a big ball wreathed with fur tufts */
    ellipse(g, 0, -78, 58, 56);
    fillOut(g, ballGrad(g, 0, -78, 58, '#eef4fc'), 3);
    for (let i = 0; i < 14; ++i) {
      const a = Math.PI * 0.95 + i * Math.PI * 1.1 / 13;
      const x = Math.cos(a) * 56, y = -78 + Math.sin(a) * 54;
      g.beginPath();
      g.moveTo(x - 6, y);
      g.quadraticCurveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + 6, y);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(80,100,140,0.6)';
      g.stroke();
    }
    for (let i = 0; i < 9; ++i) {
      g.beginPath();
      g.arc(-30 + (i % 3) * 30, -60 + Math.floor(i / 3) * 16, 8, 0.3, Math.PI - 0.3);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(120,140,180,0.45)';
      g.stroke();
    }
    /* blue face with horns */
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 26, -118);
      g.quadraticCurveTo(side * 54, -138, side * 44, -158);
      g.quadraticCurveTo(side * 40, -134, side * 16, -126);
      g.closePath();
      fillOut(g, vgrad(g, -158, -118, '#fff4dc', '#b8a070'), 2);
    }
    ellipse(g, 4, -98, 30, 24);
    fillOut(g, ballGrad(g, 4, -98, 30, '#5a8ad8'), 2.4);
    const st = pose === 'hurt' ? 'hurt' : pose === 'attack' || pose === 'special' ? 'windup' : 'normal';
    eye(g, -6, -104, 7, st, 0.3);
    eye(g, 16, -104, 6.5, st, 0.3);
    g.beginPath();
    g.moveTo(-8, -86);
    g.quadraticCurveTo(6, -76 - (pose === 'attack' ? 6 : 0), 20, -86);
    g.closePath();
    fillOut(g, '#2a1430', 1.8);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(-4, -86); g.lineTo(-1, -80); g.lineTo(2, -86); g.fill();
    g.beginPath(); g.moveTo(12, -86); g.lineTo(15, -80); g.lineTo(18, -86); g.fill();
    g.restore();
    /* arms with fists */
    for (const side of [-1, 1]) {
      const a = side > 0 ? arm : -0.25;
      const sx = side * 52, sy = -92 + bob;
      const hx = sx + Math.sin(a) * 44 * side, hy = sy + Math.cos(a) * 44;
      limb(g, sx, sy, hx, hy, 22, '#e8f0fa');
      circle(g, hx, hy, 15);
      fillOut(g, ballGrad(g, hx, hy, 15, '#5a8ad8'), 2.2);
      if (side > 0 && pose === 'attack' && !f) {
        circle(g, hx, hy - 20, 14);
        fillOut(g, ballGrad(g, hx, hy - 20, 14, '#ffffff'), 2);
      }
    }
  }

  function paintDrake(g, pose, f) {
    const flap = pose === 'attack' ? 0.6 : [-1, -0.2, 0.8, -0.2][f % 4];
    const hover = [0, -4, -6, -3][f % 4];
    if (pose === 'special')
      glow(g, 40, -70, 90, '#ff7a1a', 0.55);
    g.save();
    g.translate(0, hover - 10);
    function wing(side) {
      g.save();
      g.translate(-6, -84);
      g.rotate(-flap * 0.6 * side + (side > 0 ? 0 : 0.2));
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-30, -60 * side);
      g.lineTo(-96, -54 * side);
      g.quadraticCurveTo(-80, -30 * side, -84, -14 * side);
      g.quadraticCurveTo(-62, -18 * side, -56, -2 * side);
      g.quadraticCurveTo(-36, -8 * side, -26, 8 * side);
      g.closePath();
      const gr = g.createLinearGradient(0, 0, -90, -50 * side);
      gr.addColorStop(0, side > 0 ? '#ff8a3a' : '#c84a1a');
      gr.addColorStop(1, side > 0 ? '#7a1a0a' : '#4a0a04');
      fillOut(g, gr, 2.4);
      g.beginPath();
      g.moveTo(-30, -60 * side); g.lineTo(-56, -2 * side);
      g.moveTo(-30, -60 * side); g.lineTo(-84, -14 * side);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(40,6,4,0.6)';
      g.stroke();
      g.restore();
    }
    wing(1);
    /* tail */
    g.beginPath();
    g.moveTo(-40, -60);
    g.quadraticCurveTo(-90, -40, -96, -8);
    g.quadraticCurveTo(-84, -30, -36, -44);
    g.closePath();
    fillOut(g, vgrad(g, -60, -8, '#c84a1a', '#6a1a0a'), 2.4);
    g.beginPath();
    g.moveTo(-96, -8); g.lineTo(-108, -2); g.lineTo(-94, 4); g.closePath();
    fillOut(g, '#ffc040', 1.6);
    /* body */
    ellipse(g, 0, -60, 46, 30, -0.15);
    fillOut(g, ballGrad(g, 0, -60, 46, '#d8501a'), 3);
    ellipse(g, 8, -50, 30, 14, -0.15);
    g.fillStyle = vgrad(g, -60, -36, '#ffd070', '#e88a2a');
    g.fill();
    for (let i = 0; i < 4; ++i) {
      g.beginPath();
      g.moveTo(-10 + i * 10, -41 + i * -1);
      g.lineTo(-6 + i * 10, -58);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(120,40,10,0.5)';
      g.stroke();
    }
    /* legs tucked */
    for (const lx of [-18, 16]) {
      limb(g, lx, -40, lx + 4, -18, 10, '#b8401a');
      for (let k = 0; k < 3; ++k)
        limb(g, lx + 4, -18, lx + 2 + k * 4, -10, 2.4, '#fff4dc');
    }
    /* neck and head */
    const hx = 56, hy = -100 + (pose === 'attack' ? 12 : 0);
    limb(g, 26, -72, hx - 10, hy + 8, 18, '#d8501a');
    for (const h of [[-6, -18], [4, -20]]) {
      g.beginPath();
      g.moveTo(hx + h[0] - 4, hy - 8); g.quadraticCurveTo(hx + h[0] - 16, hy + h[1] - 6, hx + h[0] - 22, hy + h[1]);
      g.quadraticCurveTo(hx + h[0] - 10, hy - 12, hx + h[0] + 2, hy - 8);
      fillOut(g, '#fff0c8', 1.6);
    }
    ellipse(g, hx, hy, 22, 16, 0.1);
    fillOut(g, ballGrad(g, hx, hy, 22, '#e8601a'), 2.6);
    ellipse(g, hx + 20, hy + 5, 12, 9, 0.1);
    fillOut(g, ballGrad(g, hx + 20, hy + 5, 12, '#e86a2a'), 2.2);
    circle(g, hx + 28, hy + 1, 1.8); g.fillStyle = OUT; g.fill();
    if (pose === 'attack' || pose === 'special') {
      g.beginPath();
      g.moveTo(hx + 12, hy + 10); g.lineTo(hx + 34, hy + 18); g.lineTo(hx + 12, hy + 16);
      fillOut(g, '#3a0a08', 1.6);
      glow(g, hx + 36, hy + 14, 22, '#ffb040', 0.9);
    }
    const st = pose === 'hurt' ? 'hurt' : 'windup';
    eye(g, hx + 4, hy - 4, 5.5, st, 0.4);
    wing(-1);
    g.restore();
  }

  function paintSorcerer(g, pose, f) {
    const hover = [0, -3, -5, -3][f % 4];
    const staffUp = pose === 'attack' || pose === 'special';
    glow(g, 0, -8, 60, '#c88aff', 0.35);
    g.save();
    g.translate(0, hover - 12);
    /* robe */
    g.beginPath();
    g.moveTo(-14, -112);
    g.quadraticCurveTo(-46, -50, -54, 0);
    g.quadraticCurveTo(-36, -10, -24, 2);
    g.quadraticCurveTo(-10, -8, 0, 4);
    g.quadraticCurveTo(12, -8, 24, 2);
    g.quadraticCurveTo(38, -10, 52, 0);
    g.quadraticCurveTo(42, -50, 14, -112);
    g.closePath();
    const rg = g.createLinearGradient(-50, -110, 50, 0);
    rg.addColorStop(0, '#8a5ad8');
    rg.addColorStop(0.6, '#4a2a98');
    rg.addColorStop(1, '#1e1048');
    fillOut(g, rg, 3);
    /* gold trim and runes */
    g.beginPath();
    g.moveTo(0, -100); g.lineTo(0, 2);
    g.lineWidth = 5;
    g.strokeStyle = '#ffe08a';
    g.stroke();
    for (let i = 0; i < 4; ++i) {
      star(g, -24 + (i % 2) * 48, -70 + i * 14, 4, 0.4, 4);
      g.fillStyle = 'rgba(255,224,138,0.8)';
      g.fill();
    }
    /* sleeves */
    ellipse(g, -30, -78, 12, 20, 0.5);
    fillOut(g, '#5a3aa8', 2);
    /* head: pale face, long beard, crown */
    circle(g, 2, -124, 18);
    fillOut(g, ballGrad(g, 2, -124, 18, '#e8d8f0'), 2.4);
    g.beginPath();
    g.moveTo(-14, -120);
    g.quadraticCurveTo(-8, -76, 6, -70);
    g.quadraticCurveTo(18, -84, 20, -120);
    g.quadraticCurveTo(4, -108, -14, -120);
    g.closePath();
    fillOut(g, vgrad(g, -120, -70, '#ffffff', '#b8c0e0'), 2);
    crown(g, 2, -138, 34, '#d8a020');
    const st = pose === 'hurt' ? 'hurt' : staffUp ? 'windup' : 'normal';
    eye(g, -4, -128, 4, st, 0.4);
    eye(g, 10, -128, 3.8, st, 0.4);
    /* the staff with a storm orb */
    const sx = 38, sTop = staffUp ? -170 : -150;
    limb(g, sx - 6, 0 - 6, sx, sTop + 10, 4, '#7a5a3a');
    ellipse(g, 24, -84 + (staffUp ? -16 : 0), 9, 8);
    fillOut(g, '#e8d8f0', 1.8);
    glow(g, sx, sTop, staffUp ? 40 : 26, '#5ad1ff', 0.8);
    circle(g, sx, sTop, 10);
    fillOut(g, ballGrad(g, sx, sTop, 10, '#7ae8ff'), 2);
    if (staffUp) {
      g.beginPath();
      g.moveTo(sx - 4, sTop - 10); g.lineTo(sx + 6, sTop - 26); g.lineTo(sx + 2, sTop - 18); g.lineTo(sx + 12, sTop - 34);
      g.lineWidth = 2.4;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
    g.restore();
  }

  const BOSS_PAINT = { slime: paintSlime, golem: paintGolem, yeti: paintYeti, drake: paintDrake, sorcerer: paintSorcerer };
  const BOSS_BOX = {
    slime: [200, 180, 100, 166], golem: [230, 220, 115, 206], yeti: [230, 210, 115, 196],
    drake: [250, 240, 125, 226], sorcerer: [170, 230, 85, 216]
  };

  function boss(kind, pose, frame) {
    const k = BOSS_PAINT[kind] ? kind : 'slime';
    const p = BOSS_FRAMES[pose] ? pose : 'idle';
    const n = BOSS_FRAMES[p];
    const f = ((frame | 0) % n + n) % n;
    const box = BOSS_BOX[k];
    return make('boss|' + k + '|' + p + '|' + f, box[0], box[1], box[2], box[3], (g) => {
      ellipse(g, 0, 0, box[0] * 0.34, 6);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fill();
      BOSS_PAINT[k](g, p, p === 'idle' ? f : f);
      if (p === 'hurt')
        tint(g, '#ffffff', 0.35, box[0], box[1]);
    });
  }

  Object.assign(Kit, { boss });
})();
