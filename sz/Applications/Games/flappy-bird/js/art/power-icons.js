;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const PARTS = SZ.FlappySceneParts || (SZ.FlappySceneParts = {});

  /* Icons for the six newer power-up bubbles (Rocket Beak, Sky Rush, Extra Heart, Frost
     Time, Gold Rush, Wingmate). scene-sprites.js paints the bubble sphere and calls draw()
     for these kinds; the result is cached with the other bubbles. */

  const TWO_PI = Math.PI * 2;

  function draw(c, kind, tint, cx, cy) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (kind === 'blast') {
      // a rocket with a flame
      c.save();
      c.translate(cx, cy);
      c.rotate(-0.6);
      c.beginPath();
      c.moveTo(-4, 8);
      c.lineTo(0, 18);
      c.lineTo(4, 8);
      c.closePath();
      c.fillStyle = '#ffd84a';
      c.fill();
      c.beginPath();
      c.moveTo(-6, 8);
      c.lineTo(-6, -6);
      c.quadraticCurveTo(0, -18, 6, -6);
      c.lineTo(6, 8);
      c.closePath();
      c.fillStyle = '#f4f6fa';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#5a2a0a';
      c.stroke();
      c.beginPath();
      c.arc(0, -3, 2.6, 0, TWO_PI);
      c.fillStyle = tint;
      c.fill();
      c.fillStyle = tint;
      c.fillRect(-10, 2, 4, 7);
      c.fillRect(6, 2, 4, 7);
      c.restore();
    } else if (kind === 'rush') {
      // a lightning chevron with speed lines
      c.beginPath();
      c.moveTo(cx + 3, cy - 15);
      c.lineTo(cx - 8, cy + 2);
      c.lineTo(cx, cy + 2);
      c.lineTo(cx - 4, cy + 15);
      c.lineTo(cx + 9, cy - 3);
      c.lineTo(cx + 1, cy - 3);
      c.closePath();
      c.fillStyle = '#fff3a0';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = tint;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        c.beginPath();
        c.moveTo(cx - 18, cy - 6 + i * 6);
        c.lineTo(cx - 11, cy - 6 + i * 6);
        c.stroke();
      }
    } else if (kind === 'heart') {
      c.beginPath();
      c.moveTo(cx, cy + 13);
      c.bezierCurveTo(cx - 17, cy + 1, cx - 13, cy - 13, cx, cy - 6);
      c.bezierCurveTo(cx + 13, cy - 13, cx + 17, cy + 1, cx, cy + 13);
      c.fillStyle = tint;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#8c1220';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      c.ellipse(cx - 6, cy - 4, 3, 2, -0.5, 0, TWO_PI);
      c.fill();
      c.font = 'bold 12px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.fillText('+', cx + 1, cy + 2);
    } else if (kind === 'freeze') {
      // an hourglass in an ice crystal
      c.strokeStyle = tint;
      c.lineWidth = 3;
      for (let i = 0; i < 3; ++i) {
        const a = i * Math.PI / 3;
        c.beginPath();
        c.moveTo(cx - Math.cos(a) * 16, cy - Math.sin(a) * 16);
        c.lineTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(cx - 7, cy - 9);
      c.lineTo(cx + 7, cy - 9);
      c.lineTo(cx - 7, cy + 9);
      c.lineTo(cx + 7, cy + 9);
      c.closePath();
      c.fillStyle = '#ffffff';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#2a6a9a';
      c.stroke();
    } else if (kind === 'gold') {
      // a stack of coins with a sparkle
      for (let i = 0; i < 3; ++i) {
        c.beginPath();
        c.ellipse(cx - 2, cy + 9 - i * 6, 10, 4, 0, 0, TWO_PI);
        c.fillStyle = i === 2 ? '#fff3a0' : tint;
        c.fill();
        c.lineWidth = 1.6;
        c.strokeStyle = '#a86800';
        c.stroke();
      }
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(cx + 11, cy - 15);
      c.lineTo(cx + 13, cy - 9);
      c.lineTo(cx + 19, cy - 7);
      c.lineTo(cx + 13, cy - 5);
      c.lineTo(cx + 11, cy + 1);
      c.lineTo(cx + 9, cy - 5);
      c.lineTo(cx + 3, cy - 7);
      c.lineTo(cx + 9, cy - 9);
      c.closePath();
      c.fill();
    } else if (kind === 'buddy') {
      // two small birds side by side
      for (let i = 0; i < 2; ++i) {
        const x = cx - 7 + i * 13, y = cy + (i ? -4 : 4);
        c.beginPath();
        c.ellipse(x, y, 8, 6.5, 0, 0, TWO_PI);
        c.fillStyle = i ? '#ffd23f' : tint;
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = '#1e3a1a';
        c.stroke();
        c.beginPath();
        c.moveTo(x + 7, y - 1);
        c.lineTo(x + 12, y + 1);
        c.lineTo(x + 7, y + 2);
        c.closePath();
        c.fillStyle = '#ff8a1e';
        c.fill();
        c.beginPath();
        c.arc(x + 3, y - 2, 1.6, 0, TWO_PI);
        c.fillStyle = '#111111';
        c.fill();
      }
    }
  }

  PARTS.powerIcons = { draw: draw };
})();
