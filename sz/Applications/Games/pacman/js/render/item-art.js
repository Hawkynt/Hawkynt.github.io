/* Item and icon art, cached: one vector glyph set (power-ups, tech nodes, modes and menus)
   painted per colour into sprites, glossy power-up capsules, the eight bonus fruits, the six
   seasonal tokens and the small drifting shapes used by trails and seasonal weather. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  /* glyphs in a 48 x 48 box centred on (0, 0), filled or stroked in one colour */
  function glyph(g, kind, c) {
    g.fillStyle = c;
    g.strokeStyle = c;
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const P = (pts) => { g.beginPath(); for (let i = 0; i < pts.length; ++i) (i ? g.lineTo : g.moveTo).call(g, pts[i][0], pts[i][1]); };
    switch (kind) {
      case 'speed': case 'bolt':
        P([[4, -20], [-10, 2], [0, 2], [-4, 20], [12, -4], [2, -4]]); g.closePath(); g.fill(); break;
      case 'freeze': case 'flake':
        for (let i = 0; i < 6; ++i) {
          const a = i * Math.PI / 3;
          P([[0, 0], [Math.cos(a) * 18, Math.sin(a) * 18]]); g.stroke();
          P([[Math.cos(a) * 11 + Math.cos(a + 0.9) * 6, Math.sin(a) * 11 + Math.sin(a + 0.9) * 6], [Math.cos(a) * 11, Math.sin(a) * 11], [Math.cos(a) * 11 + Math.cos(a - 0.9) * 6, Math.sin(a) * 11 + Math.sin(a - 0.9) * 6]]); g.stroke();
        }
        break;
      case 'double':
        g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, 2); break;
      case 'magnet':
        g.lineWidth = 8; g.lineCap = 'butt';
        g.beginPath(); g.arc(0, -2, 12, Math.PI, 0); g.stroke();
        P([[-12, -2], [-12, 14]]); g.stroke(); P([[12, -2], [12, 14]]); g.stroke();
        g.fillStyle = '#ffffff'; g.fillRect(-16, 10, 8, 6); g.fillRect(8, 10, 8, 6); break;
      case 'shield':
        P([[0, -20], [16, -12], [14, 6], [0, 20], [-14, 6], [-16, -12]]); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; P([[0, -14], [10, -9], [0, 12]]); g.closePath(); g.fill(); break;
      case 'phase':
        g.globalAlpha = 0.5; g.beginPath(); g.arc(-5, 0, 13, 0, TAU); g.fill();
        g.globalAlpha = 1; g.lineWidth = 3; g.beginPath(); g.arc(5, 0, 13, 0, TAU); g.stroke(); break;
      case 'blaster':
        g.beginPath(); g.arc(-8, 0, 10, 0.5, TAU - 0.5); g.lineTo(-8, 0); g.closePath(); g.fill();
        for (let i = 0; i < 3; ++i) { g.beginPath(); g.arc(6 + i * 7, 0, 3, 0, TAU); g.fill(); } break;
      case 'bomb':
        g.beginPath(); g.arc(-2, 4, 14, 0, TAU); g.fill();
        g.lineWidth = 3; P([[6, -8], [12, -16], [16, -14]]); g.stroke();
        g.fillStyle = '#ffd23a'; K.starPath(g, 17, -16, 6, 0.4, 5); g.fill(); break;
      case 'mega':
        g.beginPath(); g.arc(0, 0, 18, 0.55, TAU - 0.55); g.lineTo(0, 0); g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; P([[-4, -18], [0, -26], [4, -18]]); g.fill(); break;
      case 'decoy':
        g.globalAlpha = 0.45; g.beginPath(); g.arc(-6, 0, 13, 0.6, TAU - 0.6); g.lineTo(-6, 0); g.closePath(); g.fill();
        g.globalAlpha = 1; g.beginPath(); g.arc(6, 0, 13, 0.6, TAU - 0.6); g.lineTo(6, 0); g.closePath(); g.fill(); break;
      case 'slowmo': case 'hourglass': case 'clock':
        if (kind === 'clock') { g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.stroke(); P([[0, -10], [0, 0], [8, 5]]); g.stroke(); break; }
        P([[-12, -18], [12, -18], [2, 0], [12, 18], [-12, 18], [-2, 0]]); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; P([[-6, 14], [6, 14], [0, 6]]); g.closePath(); g.fill(); break;
      case 'life': case 'heart':
        g.beginPath(); g.moveTo(0, 18); g.bezierCurveTo(-26, 0, -14, -22, 0, -8); g.bezierCurveTo(14, -22, 26, 0, 0, 18); g.fill(); break;
      case 'pellet':
        g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-5, -5, 4, 0, TAU); g.fill(); break;
      case 'ghost':
        g.beginPath(); g.moveTo(-15, 18); g.lineTo(-15, -2); g.arc(0, -2, 15, Math.PI, 0); g.lineTo(15, 18);
        for (let i = 0; i < 3; ++i) g.lineTo(15 - i * 10 - 5, 12), g.lineTo(15 - i * 10 - 10, 18);
        g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-6, -3, 4, 0, TAU); g.arc(6, -3, 4, 0, TAU); g.fill(); break;
      case 'turn':
        g.lineWidth = 5; P([[-12, 16], [-12, -4], [6, -4]]); g.stroke(); P([[0, -12], [10, -4], [0, 4]]); g.stroke(); break;
      case 'tunnel':
        g.lineWidth = 4; g.beginPath(); g.arc(0, 4, 15, Math.PI, 0); g.stroke(); P([[-15, 4], [-15, 18]]); g.stroke(); P([[15, 4], [15, 18]]); g.stroke();
        P([[-6, 10], [6, 10]]); g.stroke(); break;
      case 'boot':
        P([[-8, -18], [4, -18], [4, 4], [16, 8], [16, 16], [-8, 16]]); g.closePath(); g.fill(); break;
      case 'flame':
        g.beginPath(); g.moveTo(0, -20); g.bezierCurveTo(14, -4, 16, 8, 0, 18); g.bezierCurveTo(-16, 8, -10, -6, 0, -20); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(6, 6, 6, 12, 0, 16); g.bezierCurveTo(-6, 12, -6, 6, 0, -2); g.fill(); break;
      case 'snail':
        g.lineWidth = 4; g.beginPath(); g.arc(2, -2, 12, 0, TAU); g.stroke(); g.beginPath(); g.arc(2, -2, 5, 0, TAU); g.stroke();
        P([[-18, 12], [16, 12]]); g.stroke(); P([[-14, 12], [-18, -2]]); g.stroke(); break;
      case 'ring':
        g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.stroke(); g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke(); g.globalAlpha = 1; break;
      case 'fang':
        P([[-16, -12], [16, -12], [8, -12], [4, 16], [0, -12], [-4, 16], [-8, -12]]); g.closePath(); g.fill(); break;
      case 'shard':
        P([[0, -20], [12, -4], [0, 20], [-12, -4]]); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)'; P([[0, -20], [4, -4], [0, 20], [-12, -4]]); g.closePath(); g.fill(); break;
      case 'cherry':
        g.beginPath(); g.arc(-8, 8, 8, 0, TAU); g.arc(8, 10, 8, 0, TAU); g.fill();
        g.lineWidth = 3; P([[-8, 2], [4, -18], [8, 4]]); g.stroke(); break;
      case 'chain':
        g.lineWidth = 4; g.beginPath(); g.ellipse(-7, -4, 9, 6, 0.7, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(7, 4, 9, 6, 0.7, 0, TAU); g.stroke(); break;
      case 'gift':
        g.fillRect(-15, -6, 30, 22); g.fillRect(-17, -12, 34, 7);
        g.fillStyle = '#ffffff'; g.fillRect(-3, -12, 6, 28);
        g.beginPath(); g.ellipse(-6, -15, 6, 4, 0.5, 0, TAU); g.ellipse(6, -15, 6, 4, -0.5, 0, TAU); g.fill(); break;
      case 'crown':
        P([[-18, 12], [-18, -10], [-8, 0], [0, -16], [8, 0], [18, -10], [18, 12]]); g.closePath(); g.fill(); break;
      case 'clover':
        for (let i = 0; i < 4; ++i) { const a = i * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(Math.cos(a) * 8, Math.sin(a) * 8, 8, 0, TAU); g.fill(); }
        g.lineWidth = 3; P([[0, 0], [6, 18]]); g.stroke(); break;
      case 'star':
        K.starPath(g, 0, 2, 19, 0.45, 5); g.fill(); break;
      case 'box':
        g.fillRect(-16, -10, 32, 26); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-16, -10, 32, 7);
        g.fillStyle = c; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText('?', 0, 6); break;
      case 'twin':
        g.beginPath(); g.arc(-7, 0, 10, 0, TAU); g.fill(); g.globalAlpha = 0.6; g.beginPath(); g.arc(8, 0, 10, 0, TAU); g.fill(); g.globalAlpha = 1; break;
      case 'wing':
        g.beginPath(); g.moveTo(-16, 12); g.quadraticCurveTo(-14, -16, 16, -16); g.quadraticCurveTo(8, -6, 12, -4); g.quadraticCurveTo(2, 2, 6, 4); g.quadraticCurveTo(-4, 10, -16, 12); g.fill(); break;
      case 'plus':
        g.lineWidth = 7; P([[0, -15], [0, 15]]); g.stroke(); P([[-15, 0], [15, 0]]); g.stroke(); break;
      case 'book':
        P([[-18, -14], [-2, -10], [-2, 16], [-18, 12]]); g.closePath(); g.fill(); P([[18, -14], [2, -10], [2, 16], [18, 12]]); g.closePath(); g.fill(); break;
      case 'joystick':
        g.fillRect(-16, 8, 32, 10); g.lineWidth = 5; P([[0, 8], [4, -10]]); g.stroke(); g.beginPath(); g.arc(5, -12, 7, 0, TAU); g.fill(); break;
      case 'lotus':
        for (let i = -2; i <= 2; ++i) { g.save(); g.rotate(i * 0.42); g.beginPath(); g.ellipse(0, -6, 5, 13, 0, 0, TAU); g.fill(); g.restore(); }
        g.fillRect(-16, 10, 32, 4); break;
      case 'calendar':
        g.lineWidth = 4; K.roundRect(g, -16, -14, 32, 30, 4); g.stroke(); g.fillRect(-16, -14, 32, 9);
        g.fillRect(-8, 0, 6, 6); g.fillRect(2, 0, 6, 6); break;
      case 'skull':
        g.beginPath(); g.arc(0, -4, 15, 0, TAU); g.fill(); g.fillRect(-9, 6, 18, 12);
        g.fillStyle = '#101018'; g.beginPath(); g.arc(-6, -4, 4.5, 0, TAU); g.arc(6, -4, 4.5, 0, TAU); g.fill(); break;
      case 'tree':
        g.beginPath(); g.arc(0, -12, 6, 0, TAU); g.arc(-12, 8, 6, 0, TAU); g.arc(12, 8, 6, 0, TAU); g.fill();
        g.lineWidth = 3; P([[0, -12], [-12, 8]]); g.stroke(); P([[0, -12], [12, 8]]); g.stroke(); break;
      case 'shirt':
        P([[-8, -16], [-18, -8], [-13, 0], [-10, -3], [-10, 16], [10, 16], [10, -3], [13, 0], [18, -8], [8, -16], [0, -10]]); g.closePath(); g.fill(); break;
      case 'trophy':
        g.beginPath(); g.moveTo(-12, -16); g.lineTo(12, -16); g.lineTo(10, 0); g.quadraticCurveTo(0, 8, -10, 0); g.closePath(); g.fill();
        g.fillRect(-3, 4, 6, 8); g.fillRect(-10, 12, 20, 5);
        g.lineWidth = 3; g.beginPath(); g.arc(-13, -8, 5, Math.PI / 2, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(13, -8, 5, -Math.PI / 2, Math.PI / 2); g.stroke(); break;
      case 'map':
        P([[-18, -12], [-6, -16], [6, -12], [18, -16], [18, 14], [6, 18], [-6, 14], [-18, 18]]); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; P([[-6, -16], [-6, 14]]); g.stroke(); P([[6, -12], [6, 18]]); g.stroke(); break;
      case 'play':
        P([[-10, -16], [16, 0], [-10, 16]]); g.closePath(); g.fill(); break;
      case 'back':
        g.lineWidth = 5; P([[8, -14], [-8, 0], [8, 14]]); g.stroke(); break;
      case 'check':
        g.lineWidth = 6; P([[-14, 0], [-4, 10], [14, -10]]); g.stroke(); break;
      case 'flag':
        g.fillRect(-12, -18, 4, 36); P([[-8, -18], [16, -10], [-8, -2]]); g.closePath(); g.fill(); break;
      case 'sun':
        g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
        g.lineWidth = 3; for (let i = 0; i < 8; ++i) { const a = i * Math.PI / 4; P([[Math.cos(a) * 13, Math.sin(a) * 13], [Math.cos(a) * 18, Math.sin(a) * 18]]); g.stroke(); } break;
      default:
        g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    }
  }

  function icon(kind, color) {
    return K.sprite('icon:' + kind + ':' + color, 48, 48, (g) => {
      g.translate(24, 24);
      glyph(g, kind, color);
    });
  }

  /* draw a glyph of a given pixel size centred on (x, y) */
  function drawIcon(ctx, kind, x, y, size, color) {
    K.blit(ctx, icon(kind, color), x, y, size / 40);
  }

  /* a glossy capsule with the power-up's glyph */
  function capsule(id, color) {
    return K.sprite('cap:' + id, 40, 40, (g) => {
      const gr = g.createRadialGradient(15, 13, 2, 20, 20, 18);
      gr.addColorStop(0, K.shade(color, 0.6));
      gr.addColorStop(0.6, color);
      gr.addColorStop(1, K.shade(color, -0.55));
      g.fillStyle = gr;
      g.beginPath(); g.arc(20, 20, 17, 0, TAU); g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
      g.save();
      g.translate(20, 21);
      g.scale(0.5, 0.5);
      glyph(g, id, '#1a1030');
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(14, 11, 7, 3.5, -0.6, 0, TAU); g.fill();
    });
  }

  function fruit(id) {
    return K.sprite('fruit:' + id, 36, 36, (g) => {
      const ball = (x, y, r, c) => {
        const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
        gr.addColorStop(0, K.shade(c, 0.5));
        gr.addColorStop(0.6, c);
        gr.addColorStop(1, K.shade(c, -0.45));
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      };
      g.lineCap = 'round';
      switch (id) {
        case 'cherry':
          g.strokeStyle = '#6a3a14'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(11, 22); g.quadraticCurveTo(16, 8, 26, 5); g.moveTo(24, 24); g.quadraticCurveTo(24, 12, 26, 5); g.stroke();
          ball(11, 24, 7, '#ff1a2a'); ball(24, 26, 7, '#ff1a2a'); break;
        case 'strawberry':
          g.fillStyle = '#ff2a4a';
          g.beginPath(); g.moveTo(18, 32); g.bezierCurveTo(4, 22, 6, 8, 18, 9); g.bezierCurveTo(30, 8, 32, 22, 18, 32); g.fill();
          g.fillStyle = '#ffe8a0'; for (let i = 0; i < 9; ++i) g.fillRect(11 + (i % 3) * 6, 14 + Math.floor(i / 3) * 5, 1.6, 2);
          g.fillStyle = '#3aa82a'; K.starPath(g, 18, 9, 7, 0.4, 5); g.fill(); break;
        case 'orange':
          ball(18, 20, 12, '#ff9a1a'); g.fillStyle = '#3aa82a'; g.beginPath(); g.ellipse(22, 8, 5, 2.4, -0.5, 0, TAU); g.fill(); break;
        case 'apple':
          ball(18, 21, 12, '#ff2a2a'); g.strokeStyle = '#6a3a14'; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 10); g.lineTo(19, 4); g.stroke();
          g.fillStyle = '#5ad84a'; g.beginPath(); g.ellipse(23, 7, 5, 2.4, -0.4, 0, TAU); g.fill(); break;
        case 'melon':
          ball(18, 19, 13, '#5ad84a'); g.strokeStyle = 'rgba(20,90,20,0.7)'; g.lineWidth = 1.5;
          for (let k = -2; k <= 2; ++k) { g.beginPath(); g.ellipse(18, 19, Math.abs(k) * 4 + 1, 13, 0, 0, TAU); g.stroke(); } break;
        case 'galaxian':
          g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(18, 4); g.lineTo(24, 20); g.lineTo(18, 16); g.lineTo(12, 20); g.closePath(); g.fill();
          g.fillStyle = '#2a6aff'; g.beginPath(); g.moveTo(4, 14); g.lineTo(18, 30); g.lineTo(32, 14); g.lineTo(24, 22); g.lineTo(18, 18); g.lineTo(12, 22); g.closePath(); g.fill();
          g.fillStyle = '#ff2a2a'; g.fillRect(16, 18, 4, 10); break;
        case 'bell':
          g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(6, 26); g.quadraticCurveTo(8, 6, 18, 6); g.quadraticCurveTo(28, 6, 30, 26); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(6, 25, 24, 3); g.fillStyle = '#3ad8ff'; g.beginPath(); g.arc(18, 30, 3, 0, TAU); g.fill(); break;
        default:
          g.fillStyle = '#8ae0ff'; g.beginPath(); g.arc(18, 10, 7, 0, TAU); g.fill(); g.fillStyle = '#1a1030'; g.beginPath(); g.arc(18, 10, 3, 0, TAU); g.fill();
          g.fillStyle = '#8ae0ff'; g.fillRect(16, 15, 4, 17); g.fillRect(20, 24, 6, 3); g.fillRect(20, 29, 5, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(13, 15, 3, 1.6, -0.6, 0, TAU); g.fill();
    });
  }

  function token(id) {
    return K.sprite('token:' + id, 36, 36, (g) => {
      const cx = 18, cy = 18;
      switch (id) {
        case 'gift':
          g.fillStyle = '#e8203a'; g.fillRect(7, 13, 22, 18);
          g.fillStyle = '#ffd23a'; g.fillRect(16, 13, 4, 18); g.fillRect(5, 10, 26, 5);
          g.beginPath(); g.ellipse(13, 8, 5, 3.4, 0.5, 0, TAU); g.ellipse(23, 8, 5, 3.4, -0.5, 0, TAU); g.fill(); break;
        case 'pumpkin': {
          const gr = g.createRadialGradient(14, 15, 2, cx, 20, 14);
          gr.addColorStop(0, '#ffc060'); gr.addColorStop(1, '#c84a00');
          g.fillStyle = gr; g.beginPath(); g.ellipse(cx, 21, 14, 11, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(120,40,0,0.6)'; g.lineWidth = 1.4;
          for (let k = -1; k <= 1; ++k) { g.beginPath(); g.ellipse(cx + k * 5, 21, 4, 11, 0, 0, TAU); g.stroke(); }
          g.fillStyle = '#ffe040';
          g.beginPath(); g.moveTo(11, 18); g.lineTo(14, 14); g.lineTo(16, 18); g.fill(); g.beginPath(); g.moveTo(20, 18); g.lineTo(23, 14); g.lineTo(25, 18); g.fill();
          g.beginPath(); g.moveTo(11, 24); g.lineTo(25, 24); g.lineTo(18, 28); g.fill();
          g.fillStyle = '#3a7a1a'; g.fillRect(16, 6, 4, 6); break;
        }
        case 'flake':
          g.translate(cx, cy); g.scale(0.75, 0.75); glyph(g, 'flake', '#e8faff'); break;
        case 'egg': {
          const gr = g.createLinearGradient(0, 4, 0, 32);
          gr.addColorStop(0, '#ffb0d8'); gr.addColorStop(0.5, '#b0f0ff'); gr.addColorStop(1, '#fff0a0');
          g.fillStyle = gr; g.beginPath(); g.ellipse(cx, 19, 11, 14, 0, 0, TAU); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath();
          for (let i = 0; i <= 6; ++i) g.lineTo(8 + i * 3.4, 18 + (i % 2 ? -3 : 3)); g.stroke(); break;
        }
        case 'shell':
          g.fillStyle = '#ffd0b0'; g.beginPath(); g.moveTo(cx, 30); g.lineTo(4, 14); g.quadraticCurveTo(cx, -2, 32, 14); g.closePath(); g.fill();
          g.strokeStyle = '#d88a6a'; g.lineWidth = 1.4; for (let k = -2; k <= 2; ++k) { g.beginPath(); g.moveTo(cx, 30); g.lineTo(cx + k * 6.5, 7 + Math.abs(k) * 2); g.stroke(); } break;
        default:
          g.fillStyle = '#ff7a2a'; g.beginPath();
          for (let i = 0; i < 10; ++i) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 15; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
          g.closePath(); g.fill(); g.strokeStyle = '#a03a0a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, 33); g.stroke();
      }
    });
  }

  /* small drifting shapes for trails and weather */
  function shape(id) {
    return K.sprite('shape:' + id, 20, 20, (g) => {
      g.translate(10, 10);
      switch (id) {
        case 'flake': g.scale(0.4, 0.4); glyph(g, 'flake', '#ffffff'); break;
        case 'petal': g.fillStyle = '#ffb0d8'; g.beginPath(); g.ellipse(0, 0, 7, 3.6, 0.6, 0, TAU); g.fill(); g.fillStyle = '#ffe0f0'; g.beginPath(); g.ellipse(-2, -1, 3, 1.4, 0.6, 0, TAU); g.fill(); break;
        case 'leaf': g.fillStyle = '#ff8a2a'; g.beginPath(); g.ellipse(0, 0, 8, 4, 0.8, 0, TAU); g.fill(); g.strokeStyle = '#a03a0a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -5); g.lineTo(6, 5); g.stroke(); break;
        case 'heart': g.scale(0.4, 0.4); glyph(g, 'heart', '#ff5a8a'); break;
        case 'bat':
          g.fillStyle = '#2a1040'; g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-5, -7, -9, -3); g.quadraticCurveTo(-6, -2, -5, 2); g.quadraticCurveTo(-2, 0, 0, 3);
          g.quadraticCurveTo(2, 0, 5, 2); g.quadraticCurveTo(6, -2, 9, -3); g.quadraticCurveTo(5, -7, 0, -2); g.fill();
          g.fillStyle = '#ff6a3a'; g.fillRect(-2, -2, 1.4, 1.4); g.fillRect(0.8, -2, 1.4, 1.4); break;
        case 'confetti': g.fillStyle = '#ffd23a'; g.fillRect(-5, -2, 10, 4); break;
        case 'bubble': g.strokeStyle = 'rgba(180,240,255,0.9)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-2, -2, 1.6, 0, TAU); g.fill(); break;
        case 'sun': g.fillStyle = '#ffe86a'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,232,106,0.4)'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); break;
        case 'drop': g.fillStyle = 'rgba(150,200,255,0.8)'; g.fillRect(-0.6, -6, 1.2, 12); break;
        case 'sprinkle': g.fillStyle = '#ffffff'; g.fillRect(-4, -1.2, 8, 2.4); break;
        default: g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
      }
    });
  }

  Object.assign(NS.itemArt, {
    glyph, icon, drawIcon, capsule, fruit, token, shape
  });
})();
