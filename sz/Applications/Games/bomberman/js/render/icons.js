/* Vector icons for power-ups, perks, menus and collectibles, drawn into a cached sprite per
   name, colour and size, so the HUD, tree, wardrobe and menus blit instead of re-tracing paths.
   Draws only; the cache lives in the art kit. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  /* Paths in a 100 x 100 box centred on (50, 50) */
  const PAINT = {
    bomb(x, c) {
      K.ball(x, 46, 56, 30, '#2a2d3a');
      x.fillStyle = c; x.fillRect(58, 18, 14, 14);
      x.strokeStyle = '#c89a5a'; x.lineWidth = 6; x.beginPath(); x.moveTo(66, 22); x.quadraticCurveTo(76, 6, 86, 12); x.stroke();
      K.circle(x, 86, 12, 8, '#ffd23a'); K.circle(x, 86, 12, 4, '#ffffff');
    },
    fire(x, c) {
      flameShape(x, 50, 92, 36, 80, c);
      flameShape(x, 50, 90, 20, 50, '#ffe066');
    },
    speed(x, c) {
      x.fillStyle = c;
      K.roundRect(x, 22, 30, 52, 34, 10); x.fill();
      x.fillRect(22, 56, 64, 12);
      K.circle(x, 34, 80, 9, '#333'); K.circle(x, 70, 80, 9, '#333');
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(4, 40); x.lineTo(16, 40); x.moveTo(0, 54); x.lineTo(14, 54); x.stroke();
    },
    kick(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(30, 14); x.lineTo(54, 14); x.lineTo(54, 56); x.lineTo(86, 64); x.quadraticCurveTo(92, 82, 76, 84); x.lineTo(30, 84); x.closePath(); x.fill();
      x.fillStyle = K.shade(c, -0.35); x.fillRect(30, 76, 52, 8);
    },
    glove(x, c) {
      x.fillStyle = c;
      K.roundRect(x, 24, 34, 50, 46, 16); x.fill();
      for (let i = 0; i < 4; ++i) { K.roundRect(x, 26 + i * 12, 14 + (i === 0 || i === 3 ? 8 : 0), 10, 30, 5); x.fill(); }
      K.roundRect(x, 64, 44, 26, 12, 6); x.fill();
      x.fillStyle = '#fff'; x.fillRect(24, 74, 50, 8);
    },
    remote(x, c) {
      x.fillStyle = '#3a3e50'; K.roundRect(x, 30, 26, 40, 64, 8); x.fill();
      K.circle(x, 50, 48, 12, c);
      x.strokeStyle = c; x.lineWidth = 5;
      x.beginPath(); x.arc(50, 18, 10, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
      x.beginPath(); x.arc(50, 18, 20, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
    },
    pierce(x, c) {
      K.ball(x, 40, 56, 26, '#2a2d3a');
      x.strokeStyle = c; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.moveTo(8, 56); x.lineTo(88, 56); x.stroke();
      x.fillStyle = c; x.beginPath(); x.moveTo(96, 56); x.lineTo(78, 42); x.lineTo(78, 70); x.fill();
    },
    shield(x, c) {
      const g = x.createRadialGradient(40, 36, 4, 50, 50, 44);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, K.rgba(c, 0.5)); g.addColorStop(1, K.rgba(c, 0.9));
      x.fillStyle = g; x.beginPath(); x.arc(50, 50, 40, 0, TAU); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(50, 50, 40, 0, TAU); x.stroke();
    },
    wallpass(x, c) {
      x.fillStyle = '#b06a3a'; x.fillRect(14, 30, 72, 50);
      x.strokeStyle = '#6a3a1a'; x.lineWidth = 3;
      for (let r = 0; r < 3; ++r) { x.beginPath(); x.moveTo(14, 30 + r * 17); x.lineTo(86, 30 + r * 17); x.stroke(); }
      x.fillStyle = K.rgba(c, 0.85); x.beginPath(); x.arc(50, 44, 22, Math.PI, 0); x.lineTo(72, 86); x.lineTo(28, 86); x.fill();
      K.circle(x, 42, 44, 4, '#222'); K.circle(x, 58, 44, 4, '#222');
    },
    bombpass(x, c) {
      K.ball(x, 50, 64, 22, '#2a2d3a');
      x.strokeStyle = c; x.lineWidth = 8; x.lineCap = 'round';
      x.beginPath(); x.moveTo(14, 60); x.quadraticCurveTo(50, -6, 86, 60); x.stroke();
      x.fillStyle = c; x.beginPath(); x.moveTo(94, 64); x.lineTo(74, 56); x.lineTo(88, 44); x.fill();
    },
    maxfire(x, c) {
      flameShape(x, 40, 92, 30, 76, c);
      flameShape(x, 40, 90, 16, 46, '#ffe066');
      x.fillStyle = '#fff'; x.fillRect(66, 22, 26, 8); x.fillRect(75, 13, 8, 26);
    },
    freeze(x, c) { snowflake(x, c); },
    snowflake(x, c) { snowflake(x, c); },
    magnet(x, c) {
      x.strokeStyle = '#e03a3a'; x.lineWidth = 18;
      x.beginPath(); x.arc(50, 44, 26, Math.PI, 0); x.stroke();
      x.beginPath(); x.moveTo(24, 44); x.lineTo(24, 70); x.moveTo(76, 44); x.lineTo(76, 70); x.stroke();
      x.fillStyle = '#e8e8f0'; x.fillRect(15, 64, 18, 16); x.fillRect(67, 64, 18, 16);
      x.fillStyle = c; x.fillRect(42, 84, 6, 6); x.fillRect(56, 88, 5, 5);
    },
    heart(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(50, 86);
      x.bezierCurveTo(10, 60, 8, 30, 28, 22); x.bezierCurveTo(40, 17, 48, 26, 50, 32);
      x.bezierCurveTo(52, 26, 60, 17, 72, 22); x.bezierCurveTo(92, 30, 90, 60, 50, 86); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.ellipse(32, 36, 7, 10, -0.6, 0, TAU); x.fill();
    },
    skull(x, c) {
      K.circle(x, 50, 44, 32, c);
      x.fillStyle = c; K.roundRect(x, 32, 58, 36, 28, 6); x.fill();
      K.circle(x, 38, 44, 9, '#1a1a24'); K.circle(x, 62, 44, 9, '#1a1a24');
      x.fillStyle = '#1a1a24'; x.beginPath(); x.moveTo(50, 54); x.lineTo(45, 64); x.lineTo(55, 64); x.fill();
      x.fillRect(40, 74, 4, 10); x.fillRect(48, 74, 4, 10); x.fillRect(56, 74, 4, 10);
    },
    gem(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(26, 36); x.lineTo(40, 18); x.lineTo(60, 18); x.lineTo(74, 36); x.lineTo(50, 86); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.moveTo(26, 36); x.lineTo(40, 18); x.lineTo(50, 36); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.moveTo(74, 36); x.lineTo(50, 86); x.lineTo(56, 36); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(26, 36); x.lineTo(74, 36); x.stroke();
    },
    star(x, c) {
      x.fillStyle = c; x.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42;
        x.lineTo(50 + Math.cos(a) * r, 52 + Math.sin(a) * r);
      }
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 3; x.stroke();
    },
    clock(x, c) {
      K.circle(x, 50, 52, 38, c); K.circle(x, 50, 52, 30, '#fff8e8');
      x.strokeStyle = '#2a2a30'; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(50, 52); x.lineTo(50, 30); x.moveTo(50, 52); x.lineTo(66, 60); x.stroke();
      x.fillStyle = c; x.fillRect(42, 6, 16, 8);
    },
    fuse(x, c) {
      x.strokeStyle = '#c89a5a'; x.lineWidth = 8; x.lineCap = 'round';
      x.beginPath(); x.moveTo(16, 84); x.bezierCurveTo(30, 40, 60, 80, 70, 30); x.stroke();
      K.circle(x, 72, 24, 14, c); K.circle(x, 72, 24, 6, '#fff');
    },
    chain(x, c) {
      x.strokeStyle = c; x.lineWidth = 9;
      x.beginPath(); x.ellipse(34, 50, 22, 14, -0.6, 0, TAU); x.stroke();
      x.beginPath(); x.ellipse(66, 50, 22, 14, -0.6, 0, TAU); x.stroke();
    },
    super(x, c) {
      K.ball(x, 50, 56, 34, '#3a1a1a');
      x.fillStyle = c;
      x.beginPath();
      for (let i = 0; i < 10; ++i) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 20; x.lineTo(50 + Math.cos(a) * r, 56 + Math.sin(a) * r); }
      x.closePath(); x.fill();
      K.circle(x, 80, 16, 9, '#ffd23a');
    },
    dash(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(52, 10); x.lineTo(24, 56); x.lineTo(46, 56); x.lineTo(36, 92); x.lineTo(78, 40); x.lineTo(54, 40); x.lineTo(70, 10); x.closePath(); x.fill();
    },
    phoenix(x, c) {
      flameShape(x, 50, 90, 22, 56, c);
      x.fillStyle = c;
      x.beginPath(); x.moveTo(50, 50); x.quadraticCurveTo(14, 30, 4, 46); x.quadraticCurveTo(24, 46, 50, 62); x.fill();
      x.beginPath(); x.moveTo(50, 50); x.quadraticCurveTo(86, 30, 96, 46); x.quadraticCurveTo(76, 46, 50, 62); x.fill();
      K.circle(x, 50, 36, 9, '#ffe066');
    },
    clover(x, c) {
      for (let i = 0; i < 4; ++i) { const a = i * Math.PI / 2 + Math.PI / 4; K.circle(x, 50 + Math.cos(a) * 18, 44 + Math.sin(a) * 18, 16, c); }
      x.strokeStyle = K.shade(c, -0.3); x.lineWidth = 6; x.beginPath(); x.moveTo(50, 50); x.quadraticCurveTo(54, 76, 66, 90); x.stroke();
    },
    radar(x, c) {
      x.strokeStyle = c; x.lineWidth = 5;
      for (let r = 14; r <= 42; r += 14) { x.beginPath(); x.arc(50, 50, r, 0, TAU); x.stroke(); }
      x.fillStyle = K.rgba(c, 0.5); x.beginPath(); x.moveTo(50, 50); x.arc(50, 50, 42, -1.2, -0.3); x.fill();
      K.circle(x, 66, 38, 6, '#fff');
    },
    trophy(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(24, 14); x.lineTo(76, 14); x.lineTo(70, 50); x.quadraticCurveTo(50, 66, 30, 50); x.closePath(); x.fill();
      x.fillRect(44, 58, 12, 18); x.fillRect(30, 76, 40, 12);
      x.strokeStyle = c; x.lineWidth = 6; x.beginPath(); x.arc(22, 30, 12, 1.2, 4.8); x.stroke(); x.beginPath(); x.arc(78, 30, 12, -1.6, 1.9); x.stroke();
    },
    gift(x, c) {
      x.fillStyle = c; x.fillRect(16, 40, 68, 48);
      x.fillStyle = K.shade(c, 0.2); x.fillRect(12, 30, 76, 14);
      x.fillStyle = '#ffd84a'; x.fillRect(44, 30, 12, 58);
      x.beginPath(); x.ellipse(38, 24, 12, 8, -0.4, 0, TAU); x.ellipse(62, 24, 12, 8, 0.4, 0, TAU); x.fill();
    },
    egg(x, c) {
      x.fillStyle = c; x.beginPath(); x.ellipse(50, 54, 30, 38, 0, 0, TAU); x.fill();
      x.strokeStyle = '#7ad8ff'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(22, 46); x.lineTo(34, 38); x.lineTo(46, 46); x.lineTo(58, 38); x.lineTo(70, 46); x.lineTo(80, 40); x.stroke();
      x.strokeStyle = '#ffd84a'; x.beginPath(); x.moveTo(22, 66); x.lineTo(78, 66); x.stroke();
    },
    shell(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(50, 88); x.lineTo(12, 40); x.quadraticCurveTo(50, -4, 88, 40); x.closePath(); x.fill();
      x.strokeStyle = K.shade(c, -0.3); x.lineWidth = 4;
      for (let i = -2; i <= 2; ++i) { x.beginPath(); x.moveTo(50, 86); x.lineTo(50 + i * 17, 26 + Math.abs(i) * 6); x.stroke(); }
    },
    pumpkin(x, c) {
      x.fillStyle = K.shade(c, -0.15); x.beginPath(); x.ellipse(32, 58, 22, 28, 0, 0, TAU); x.ellipse(68, 58, 22, 28, 0, 0, TAU); x.fill();
      x.fillStyle = c; x.beginPath(); x.ellipse(50, 58, 24, 30, 0, 0, TAU); x.fill();
      x.fillStyle = '#4a8a2a'; x.fillRect(46, 20, 8, 14);
      x.fillStyle = '#3a1a00'; x.beginPath(); x.moveTo(36, 50); x.lineTo(44, 50); x.lineTo(40, 42); x.fill();
      x.beginPath(); x.moveTo(56, 50); x.lineTo(64, 50); x.lineTo(60, 42); x.fill();
      x.beginPath(); x.moveTo(34, 64); x.lineTo(66, 64); x.lineTo(58, 74); x.lineTo(42, 74); x.fill();
    },
    lock(x, c) {
      x.strokeStyle = c; x.lineWidth = 9; x.beginPath(); x.arc(50, 40, 18, Math.PI, 0); x.stroke();
      x.fillStyle = c; K.roundRect(x, 24, 40, 52, 44, 8); x.fill();
      K.circle(x, 50, 58, 6, '#1a1a24'); x.fillStyle = '#1a1a24'; x.fillRect(47, 60, 6, 12);
    },
    map(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(10, 24); x.lineTo(36, 14); x.lineTo(64, 26); x.lineTo(90, 16); x.lineTo(90, 78); x.lineTo(64, 88); x.lineTo(36, 76); x.lineTo(10, 86); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 3; x.beginPath(); x.moveTo(36, 14); x.lineTo(36, 76); x.moveTo(64, 26); x.lineTo(64, 88); x.stroke();
      x.strokeStyle = '#e03a3a'; x.lineWidth = 4; x.setLineDash([6, 5]); x.beginPath(); x.moveTo(20, 70); x.quadraticCurveTo(50, 30, 78, 40); x.stroke(); x.setLineDash([]);
    },
    tree(x, c) {
      x.strokeStyle = c; x.lineWidth = 6;
      x.beginPath(); x.moveTo(50, 22); x.lineTo(24, 74); x.moveTo(50, 22); x.lineTo(76, 74); x.moveTo(50, 22); x.lineTo(50, 74); x.stroke();
      K.circle(x, 50, 22, 12, c); K.circle(x, 24, 76, 10, c); K.circle(x, 50, 76, 10, c); K.circle(x, 76, 76, 10, c);
    },
    shirt(x, c) {
      x.fillStyle = c;
      x.beginPath(); x.moveTo(34, 14); x.lineTo(10, 30); x.lineTo(20, 48); x.lineTo(30, 42); x.lineTo(30, 88); x.lineTo(70, 88); x.lineTo(70, 42); x.lineTo(80, 48); x.lineTo(90, 30); x.lineTo(66, 14); x.quadraticCurveTo(50, 30, 34, 14); x.fill();
    },
    stats(x, c) {
      x.fillStyle = c; x.fillRect(16, 56, 16, 30); x.fillRect(42, 32, 16, 54); x.fillRect(68, 16, 16, 70);
    },
    help(x, c) {
      K.circle(x, 50, 50, 40, c);
      x.fillStyle = '#1a1020'; x.font = 'bold 56px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 50, 54);
    },
    play(x, c) {
      x.fillStyle = c; x.beginPath(); x.moveTo(30, 16); x.lineTo(84, 50); x.lineTo(30, 84); x.closePath(); x.fill();
    },
    zen(x, c) {
      x.fillStyle = c;
      for (let i = -2; i <= 2; ++i) { x.save(); x.translate(50, 74); x.rotate(i * 0.5); x.beginPath(); x.ellipse(0, -28, 11, 28, 0, 0, TAU); x.fill(); x.restore(); }
      x.fillStyle = K.shade(c, -0.3); x.fillRect(20, 76, 60, 6);
    },
    daily(x, c) {
      x.fillStyle = '#fff8e8'; K.roundRect(x, 14, 20, 72, 68, 8); x.fill();
      x.fillStyle = c; K.roundRect(x, 14, 20, 72, 22, 8); x.fill();
      x.fillStyle = '#333'; x.fillRect(28, 12, 6, 16); x.fillRect(66, 12, 6, 16);
      x.fillStyle = c; for (let i = 0; i < 6; ++i) x.fillRect(22 + (i % 3) * 20, 50 + Math.floor(i / 3) * 18, 14, 12);
    },
    rush(x, c) {
      PAINT.skull(x, c);
      x.fillStyle = '#ffd84a'; x.beginPath(); x.moveTo(20, 18); x.lineTo(30, 2); x.lineTo(40, 14); x.lineTo(50, 0); x.lineTo(60, 14); x.lineTo(70, 2); x.lineTo(80, 18); x.closePath(); x.fill();
    },
    arcade(x, c) {
      x.fillStyle = '#3a3e50'; K.roundRect(x, 14, 58, 72, 28, 10); x.fill();
      x.fillStyle = '#c8c8d0'; x.fillRect(46, 30, 8, 32);
      K.circle(x, 50, 26, 14, c); K.circle(x, 74, 66, 6, '#ffd84a'); K.circle(x, 28, 66, 6, '#4fd0ff');
    },
    back(x, c) {
      x.fillStyle = c; x.beginPath(); x.moveTo(14, 50); x.lineTo(50, 16); x.lineTo(50, 36); x.lineTo(86, 36); x.lineTo(86, 64); x.lineTo(50, 64); x.lineTo(50, 84); x.closePath(); x.fill();
    },
    pause(x, c) {
      x.fillStyle = c; x.fillRect(26, 18, 16, 64); x.fillRect(58, 18, 16, 64);
    },
    exit(x, c) {
      x.fillStyle = c; K.roundRect(x, 24, 12, 52, 78, 26); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(40, 34); x.lineTo(64, 52); x.lineTo(40, 70); x.fill();
    },
    continue(x, c) {
      PAINT.play(x, c);
      x.fillStyle = c; x.fillRect(12, 16, 10, 68);
    }
  };

  function flameShape(x, cx, by, w, h, color) {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, by - h);
    x.bezierCurveTo(cx + w * 0.4, by - h * 0.6, cx + w, by - h * 0.4, cx + w * 0.8, by - h * 0.18);
    x.bezierCurveTo(cx + w * 0.6, by, cx - w * 0.6, by, cx - w * 0.8, by - h * 0.18);
    x.bezierCurveTo(cx - w, by - h * 0.45, cx - w * 0.2, by - h * 0.55, cx, by - h);
    x.fill();
  }

  function snowflake(x, c) {
    x.strokeStyle = c; x.lineWidth = 7; x.lineCap = 'round';
    for (let i = 0; i < 6; ++i) {
      const a = i * Math.PI / 3;
      const ex = 50 + Math.cos(a) * 40, ey = 50 + Math.sin(a) * 40;
      x.beginPath(); x.moveTo(50, 50); x.lineTo(ex, ey); x.stroke();
      const mx = 50 + Math.cos(a) * 24, my = 50 + Math.sin(a) * 24;
      x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + Math.cos(a + 0.8) * 12, my + Math.sin(a + 0.8) * 12);
      x.moveTo(mx, my); x.lineTo(mx + Math.cos(a - 0.8) * 12, my + Math.sin(a - 0.8) * 12); x.stroke();
    }
  }

  function get(name, color, size) {
    const s = Math.max(8, Math.round(size));
    return K.sprite('icon:' + name + ':' + color + ':' + s, s, s, (x) => {
      x.scale(s / 100, s / 100);
      (PAINT[name] || PAINT.star)(x, color);
    });
  }

  function draw(ctx, name, x, y, size, color) {
    const s = get(name, color, size * 1.5);
    ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  }

  Object.assign(NS.icons, {
    PAINT, get, draw, flameShape
  });
})();
