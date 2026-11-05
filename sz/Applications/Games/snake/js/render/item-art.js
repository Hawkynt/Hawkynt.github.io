/* Item art, painted once: every fruit, scale gems, the six festival tokens, golden eggs, Sun
   Shards, power-up orbs, the exit gate, the flat icon set shared by the HUD and every menu, and
   the particle shapes (leaf, petal, star, heart, snowflake, confetti, bat, bubble). Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { TAU, CELL } = NS.constants;
  const K = NS.artKit;
  const { FRUITS } = NS.items;

  function star(g, cx, cy, r, inner, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; ++i) {
      const rr = i % 2 ? r * inner : r;
      const a = -Math.PI / 2 + i * Math.PI / n;
      if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }

  function heartPath(g, cx, cy, s) {
    g.beginPath();
    g.moveTo(cx, cy + s * 0.9);
    g.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
    g.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
    g.closePath();
  }

  function leafPath(g, cx, cy, l, w, a) {
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * l, cy - Math.sin(a) * l);
    g.quadraticCurveTo(cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
    g.quadraticCurveTo(cx - Math.cos(a + Math.PI / 2) * w, cy - Math.sin(a + Math.PI / 2) * w, cx - Math.cos(a) * l, cy - Math.sin(a) * l);
    g.closePath();
  }

  function shine(g, x, y, r) {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.ellipse(x, y, r * 0.5, r * 0.28, -0.6, 0, TAU); g.fill();
  }

  function ball(g, x, y, r, col) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, K.shade(col, 0.4));
    gr.addColorStop(0.6, col);
    gr.addColorStop(1, K.shade(col, -0.45));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  /* fruit and collectibles, centred in a CELL square */
  function fruit(kind, season) {
    return K.sprite('fruit:' + kind + ':' + (season || ''), CELL, CELL, (g, w) => {
      const c = w / 2;
      switch (kind) {
        case 'apple':
        case 'golden': {
          const col = kind === 'golden' ? '#ffcc1a' : '#e8302a';
          ball(g, c, c + 2, 12, col);
          g.fillStyle = K.shade(col, -0.35);
          g.beginPath(); g.arc(c, c - 9, 3, 0, TAU); g.fill();
          g.strokeStyle = '#5a3a1a'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(c, c - 9); g.lineTo(c + 2, c - 15); g.stroke();
          g.fillStyle = '#5ac040'; leafPath(g, c + 6, c - 13, 5, 3, -0.5); g.fill();
          shine(g, c - 5, c - 3, 7);
          break;
        }
        case 'cherry':
          g.strokeStyle = '#4a7a2a'; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(c - 6, c + 3); g.quadraticCurveTo(c - 2, c - 10, c + 3, c - 14); g.moveTo(c + 6, c + 5); g.quadraticCurveTo(c + 4, c - 6, c + 3, c - 14); g.stroke();
          ball(g, c - 6, c + 6, 7.5, '#d0103a'); ball(g, c + 6, c + 8, 7.5, '#d0103a');
          shine(g, c - 8, c + 3, 4); shine(g, c + 4, c + 5, 4);
          g.fillStyle = '#5ac040'; leafPath(g, c + 8, c - 13, 5, 2.6, 0.3); g.fill();
          break;
        case 'pear': {
          const gr = g.createRadialGradient(c - 4, c, 2, c, c + 3, 14);
          gr.addColorStop(0, '#f0ff9a'); gr.addColorStop(0.6, '#b8e04a'); gr.addColorStop(1, '#6a8a1a');
          g.fillStyle = gr;
          g.beginPath(); g.arc(c, c + 6, 10, 0, TAU); g.arc(c, c - 4, 6.5, 0, TAU); g.fill();
          g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(c, c - 10); g.lineTo(c + 1, c - 15); g.stroke();
          shine(g, c - 4, c + 2, 6);
          break;
        }
        case 'plum':
          ball(g, c, c + 2, 11.5, '#7a2ac0');
          g.strokeStyle = 'rgba(40,10,70,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.arc(c + 3, c + 2, 9, -1.8, 1.2); g.stroke();
          g.fillStyle = '#5ac040'; leafPath(g, c + 4, c - 11, 5, 2.6, -0.3); g.fill();
          shine(g, c - 4, c - 3, 6);
          break;
        case 'gem': {
          const gr = g.createLinearGradient(c - 10, c - 12, c + 10, c + 12);
          gr.addColorStop(0, '#d0fff8'); gr.addColorStop(0.5, '#2ad0c0'); gr.addColorStop(1, '#0a6a7a');
          g.fillStyle = gr;
          K.poly(g, [[c, c - 13], [c + 11, c - 3], [c, c + 13], [c - 11, c - 3]]); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(c - 11, c - 3); g.lineTo(c + 11, c - 3); g.moveTo(c - 5, c - 3); g.lineTo(c, c + 13); g.lineTo(c + 5, c - 3); g.stroke();
          break;
        }
        case 'egg': {
          const gr = g.createRadialGradient(c - 4, c - 5, 2, c, c + 1, 14);
          gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.5, '#ffd23a'); gr.addColorStop(1, '#c08a0a');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c, c + 1, 10, 13, 0, 0, TAU); g.fill();
          g.strokeStyle = '#a06a00'; g.lineWidth = 1.2; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(c - 9, c + 2); g.lineTo(c - 4, c - 2); g.lineTo(c, c + 2); g.lineTo(c + 4, c - 2); g.lineTo(c + 9, c + 2); g.stroke();
          shine(g, c - 4, c - 6, 6);
          break;
        }
        case 'shard': {
          const gr = g.createRadialGradient(c, c, 1, c, c, 15);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, '#fff27a'); gr.addColorStop(1, '#ff9a1a');
          g.fillStyle = gr;
          star(g, c, c, 15, 0.42, 6); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.stroke();
          break;
        }
        case 'petal':
          g.fillStyle = '#ffb0d0'; leafPath(g, c, c, 9, 5, 0.6); g.fill();
          break;
        case 'token':
          token(g, c, season || 'harvest');
          break;
      }
    });
  }

  function token(g, c, season) {
    switch (season) {
      case 'frost':
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.lineCap = 'round';
        for (let k = 0; k < 6; ++k) {
          const a = k * Math.PI / 3;
          g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 13, c + Math.sin(a) * 13);
          g.moveTo(c + Math.cos(a) * 8, c + Math.sin(a) * 8); g.lineTo(c + Math.cos(a + 0.5) * 11, c + Math.sin(a + 0.5) * 11);
          g.moveTo(c + Math.cos(a) * 8, c + Math.sin(a) * 8); g.lineTo(c + Math.cos(a - 0.5) * 11, c + Math.sin(a - 0.5) * 11);
          g.stroke();
        }
        g.strokeStyle = '#6fb8ff'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, 3, 0, TAU); g.stroke();
        break;
      case 'bloom':
        for (let p = 0; p < 5; ++p) {
          const a = p * TAU / 5 - Math.PI / 2;
          g.fillStyle = '#ffb0d0';
          g.beginPath(); g.ellipse(c + Math.cos(a) * 7, c + Math.sin(a) * 7, 7, 4.5, a, 0, TAU); g.fill();
        }
        g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(c, c, 4.5, 0, TAU); g.fill();
        break;
      case 'sunfest': {
        const gr = g.createLinearGradient(c, c - 12, c, c + 12);
        gr.addColorStop(0, '#fff0d0'); gr.addColorStop(1, '#ff9a6a');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(c, c + 12); g.arc(c, c + 12, 15, -Math.PI * 0.82, -Math.PI * 0.18); g.closePath(); g.fill();
        g.strokeStyle = '#c0603a'; g.lineWidth = 1.2;
        for (let k = -2; k <= 2; ++k) { g.beginPath(); g.moveTo(c, c + 12); g.lineTo(c + k * 5, c - 1); g.stroke(); }
        break;
      }
      case 'harvest':
        ball(g, c, c + 4, 9, '#a0602a');
        g.fillStyle = '#5a3a1a'; g.beginPath(); g.ellipse(c, c - 3, 11, 6, 0, Math.PI, 0); g.fill(); g.fillRect(c - 11, c - 4, 22, 3);
        g.fillStyle = '#3a2a1a'; g.fillRect(c - 1, c - 13, 2.5, 6);
        break;
      case 'hollow':
        g.fillStyle = '#ff8a1a';
        g.beginPath(); g.ellipse(c, c + 2, 13, 10, 0, 0, TAU); g.fill();
        g.strokeStyle = '#c05a0a'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(c, c + 2, 5, 10, 0, 0, TAU); g.stroke();
        g.fillStyle = '#2a1a0a';
        K.poly(g, [[c - 7, c - 2], [c - 3, c - 2], [c - 5, c - 6]]); g.fill();
        K.poly(g, [[c + 3, c - 2], [c + 7, c - 2], [c + 5, c - 6]]); g.fill();
        g.fillRect(c - 6, c + 4, 12, 3);
        g.fillStyle = '#4a7a2a'; g.fillRect(c - 1, c - 11, 3, 4);
        break;
      default:
        g.fillStyle = '#ffd23a';
        star(g, c, c, 14, 0.45, 5); g.fill();
        g.fillStyle = '#ff5a8a'; g.beginPath(); g.arc(c, c, 4, 0, TAU); g.fill();
    }
  }

  /* power-up orb: a glassy bubble in the power's colour with its icon */
  function orb(def) {
    return K.sprite('orb:' + def.id, CELL * 1.2, CELL * 1.2, (g, w) => {
      const c = w / 2, r = w * 0.4;
      const gr = g.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r);
      gr.addColorStop(0, K.shade(def.color, 0.6));
      gr.addColorStop(0.6, K.shade(def.color, -0.15));
      gr.addColorStop(1, K.shade(def.color, -0.55));
      g.fillStyle = gr;
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.6; g.stroke();
      drawIcon(g, def.icon, c, c, r * 1.15, '#ffffff');
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.ellipse(c - r * 0.35, c - r * 0.5, r * 0.4, r * 0.18, -0.5, 0, TAU); g.fill();
    });
  }

  /* the flat icon set: drawn centred at (x, y) within size s */
  function drawIcon(g, kind, x, y, s, col) {
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = Math.max(1.5, s * 0.11);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const h = s / 2;
    switch (kind) {
      case 'bolt': K.poly(g, [[x + h * 0.15, y - h], [x - h * 0.55, y + h * 0.1], [x - h * 0.02, y + h * 0.1], [x - h * 0.2, y + h], [x + h * 0.55, y - h * 0.15], [x + h * 0.02, y - h * 0.15]]); g.fill(); break;
      case 'clock': g.beginPath(); g.arc(x, y, h * 0.85, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, y - h * 0.55); g.lineTo(x, y); g.lineTo(x + h * 0.4, y + h * 0.2); g.stroke(); break;
      case 'shield': g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.8, y - h * 0.6); g.quadraticCurveTo(x + h * 0.7, y + h * 0.6, x, y + h); g.quadraticCurveTo(x - h * 0.7, y + h * 0.6, x - h * 0.8, y - h * 0.6); g.closePath(); g.fill(); break;
      case 'magnet': g.lineWidth = s * 0.2; g.beginPath(); g.arc(x, y - h * 0.05, h * 0.55, Math.PI, 0, true); g.moveTo(x - h * 0.55, y - h * 0.05); g.lineTo(x - h * 0.55, y - h * 0.7); g.moveTo(x + h * 0.55, y - h * 0.05); g.lineTo(x + h * 0.55, y - h * 0.7); g.stroke(); break;
      case 'ghost': g.beginPath(); g.arc(x, y - h * 0.15, h * 0.65, Math.PI, 0); g.lineTo(x + h * 0.65, y + h * 0.8); g.lineTo(x + h * 0.32, y + h * 0.55); g.lineTo(x, y + h * 0.8); g.lineTo(x - h * 0.32, y + h * 0.55); g.lineTo(x - h * 0.65, y + h * 0.8); g.closePath(); g.globalAlpha *= 0.85; g.fill(); g.globalAlpha /= 0.85; break;
      case 'molt': g.beginPath(); g.arc(x - h * 0.3, y, h * 0.35, 0, TAU); g.fill(); g.globalAlpha *= 0.6; g.beginPath(); g.arc(x + h * 0.25, y, h * 0.28, 0, TAU); g.fill(); g.globalAlpha *= 0.6; g.beginPath(); g.arc(x + h * 0.7, y, h * 0.2, 0, TAU); g.fill(); g.globalAlpha /= 0.36; break;
      case 'fang': K.poly(g, [[x - h * 0.7, y - h * 0.6], [x - h * 0.15, y - h * 0.6], [x - h * 0.42, y + h * 0.8]]); g.fill(); K.poly(g, [[x + h * 0.15, y - h * 0.6], [x + h * 0.7, y - h * 0.6], [x + h * 0.42, y + h * 0.8]]); g.fill(); break;
      case 'rain': for (let k = -1; k <= 1; ++k) { g.beginPath(); g.arc(x + k * h * 0.55, y + (k === 0 ? -h * 0.3 : h * 0.25), h * 0.3, 0, TAU); g.fill(); } break;
      case 'quake': g.beginPath(); g.moveTo(x - h, y); g.lineTo(x - h * 0.5, y - h * 0.6); g.lineTo(x, y + h * 0.5); g.lineTo(x + h * 0.4, y - h * 0.8); g.lineTo(x + h, y); g.stroke(); break;
      case 'snow': for (let k = 0; k < 3; ++k) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * h * 0.85, y - Math.sin(a) * h * 0.85); g.lineTo(x + Math.cos(a) * h * 0.85, y + Math.sin(a) * h * 0.85); g.stroke(); } break;
      case 'sun': g.beginPath(); g.arc(x, y, h * 0.42, 0, TAU); g.fill(); for (let k = 0; k < 8; ++k) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * h * 0.6, y + Math.sin(a) * h * 0.6); g.lineTo(x + Math.cos(a) * h * 0.92, y + Math.sin(a) * h * 0.92); g.stroke(); } break;
      case 'drop': g.beginPath(); g.moveTo(x, y - h * 0.9); g.quadraticCurveTo(x + h * 0.75, y + h * 0.1, x, y + h * 0.85); g.quadraticCurveTo(x - h * 0.75, y + h * 0.1, x, y - h * 0.9); g.fill(); break;
      case 'heart': heartPath(g, x, y, h * 0.75); g.fill(); break;
      case 'eye': g.beginPath(); g.moveTo(x - h * 0.9, y); g.quadraticCurveTo(x, y - h * 0.9, x + h * 0.9, y); g.quadraticCurveTo(x, y + h * 0.9, x - h * 0.9, y); g.stroke(); g.beginPath(); g.arc(x, y, h * 0.3, 0, TAU); g.fill(); break;
      case 'star': star(g, x, y, h * 0.95, 0.45, 5); g.fill(); break;
      case 'coin': g.beginPath(); g.arc(x, y, h * 0.85, 0, TAU); g.fill(); g.globalCompositeOperation = 'destination-out'; star(g, x, y, h * 0.45, 0.45, 5); g.fill(); g.globalCompositeOperation = 'source-over'; break;
      case 'gem': K.poly(g, [[x, y - h * 0.9], [x + h * 0.75, y - h * 0.2], [x, y + h * 0.9], [x - h * 0.75, y - h * 0.2]]); g.fill(); break;
      case 'gift': g.fillRect(x - h * 0.75, y - h * 0.2, h * 1.5, h * 1.05); g.fillRect(x - h * 0.85, y - h * 0.5, h * 1.7, h * 0.35); g.beginPath(); g.arc(x - h * 0.25, y - h * 0.65, h * 0.25, 0, TAU); g.arc(x + h * 0.25, y - h * 0.65, h * 0.25, 0, TAU); g.stroke(); break;
      case 'leaf': leafPath(g, x, y, h * 0.9, h * 0.55, -0.7); g.fill(); break;
      case 'book': g.fillRect(x - h * 0.8, y - h * 0.65, h * 0.72, h * 1.3); g.fillRect(x + h * 0.08, y - h * 0.65, h * 0.72, h * 1.3); break;
      case 'crown': K.poly(g, [[x - h * 0.85, y + h * 0.6], [x - h * 0.85, y - h * 0.5], [x - h * 0.4, y], [x, y - h * 0.8], [x + h * 0.4, y], [x + h * 0.85, y - h * 0.5], [x + h * 0.85, y + h * 0.6]]); g.fill(); break;
      case 'apple': g.beginPath(); g.arc(x, y + h * 0.1, h * 0.7, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x, y - h * 0.5); g.lineTo(x + h * 0.2, y - h * 0.9); g.stroke(); break;
      case 'egg': g.beginPath(); g.ellipse(x, y + h * 0.05, h * 0.6, h * 0.8, 0, 0, TAU); g.fill(); break;
      case 'check': g.lineWidth = s * 0.16; g.beginPath(); g.moveTo(x - h * 0.7, y); g.lineTo(x - h * 0.15, y + h * 0.55); g.lineTo(x + h * 0.75, y - h * 0.6); g.stroke(); break;
      case 'play': K.poly(g, [[x - h * 0.5, y - h * 0.75], [x + h * 0.75, y], [x - h * 0.5, y + h * 0.75]]); g.fill(); break;
      case 'map': K.poly(g, [[x - h * 0.85, y - h * 0.6], [x - h * 0.28, y - h * 0.85], [x + h * 0.28, y - h * 0.6], [x + h * 0.85, y - h * 0.85], [x + h * 0.85, y + h * 0.6], [x + h * 0.28, y + h * 0.85], [x - h * 0.28, y + h * 0.6], [x - h * 0.85, y + h * 0.85]]); g.fill(); break;
      case 'gear': g.beginPath(); g.arc(x, y, h * 0.55, 0, TAU); g.stroke(); for (let k = 0; k < 8; ++k) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * h * 0.55, y + Math.sin(a) * h * 0.55); g.lineTo(x + Math.cos(a) * h * 0.9, y + Math.sin(a) * h * 0.9); g.stroke(); } break;
      case 'lock': g.beginPath(); g.arc(x, y - h * 0.2, h * 0.38, Math.PI, 0); g.stroke(); g.fillRect(x - h * 0.6, y - h * 0.2, h * 1.2, h * 0.95); break;
      default: g.beginPath(); g.arc(x, y, h * 0.6, 0, TAU); g.fill();
    }
  }

  function icon(kind, color) {
    return K.sprite('icon:' + kind + ':' + color, 48, 48, (g) => drawIcon(g, kind, 24, 24, 40, color));
  }

  /* the exit gate: an arch of light (drawn with a pulse on top by the world) */
  function gate() {
    return K.sprite('gate', CELL * 1.6, CELL * 1.6, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c, c, 2, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,230,1)');
      gr.addColorStop(0.35, 'rgba(255,224,122,0.85)');
      gr.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
      g.strokeStyle = '#fff6c0';
      g.lineWidth = 3;
      g.beginPath(); g.arc(c, c, w * 0.26, 0, TAU); g.stroke();
      star(g, c, c, w * 0.14, 0.45, 4);
      g.fillStyle = '#ffffff';
      g.fill();
    });
  }

  /* particle shapes in white, tinted by drawing over them is too slow, so each colour caches */
  function shape(kind, color) {
    return K.sprite('shape:' + kind + ':' + color, 16, 16, (g) => {
      g.fillStyle = color;
      g.strokeStyle = color;
      switch (kind) {
        case 2: leafPath(g, 8, 8, 7, 3.5, 0.4); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(2, 5); g.lineTo(14, 11); g.stroke(); break;
        case 3: g.beginPath(); g.ellipse(8, 8, 6.5, 3.6, 0.5, 0, TAU); g.fill(); break;
        case 4: star(g, 8, 8, 7.5, 0.42, 5); g.fill(); break;
        case 5: heartPath(g, 8, 8.5, 6); g.fill(); break;
        case 6: g.lineWidth = 1.4; g.lineCap = 'round'; for (let k = 0; k < 3; ++k) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(8 - Math.cos(a) * 6.5, 8 - Math.sin(a) * 6.5); g.lineTo(8 + Math.cos(a) * 6.5, 8 + Math.sin(a) * 6.5); g.stroke(); } break;
        case 7: g.fillRect(3, 5, 10, 6); break;
        case 8: g.beginPath(); g.moveTo(8, 9); g.quadraticCurveTo(4, 3, 0, 6); g.quadraticCurveTo(3, 8, 2, 11); g.quadraticCurveTo(5, 9, 8, 12); g.quadraticCurveTo(11, 9, 14, 11); g.quadraticCurveTo(13, 8, 16, 6); g.quadraticCurveTo(12, 3, 8, 9); g.fill(); break;
        case 9: g.lineWidth = 1.2; g.globalAlpha = 0.9; g.beginPath(); g.arc(8, 8, 6, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(6, 6, 1.6, 0, TAU); g.fill(); break;
        default: g.beginPath(); g.arc(8, 8, 6, 0, TAU); g.fill();
      }
    });
  }

  Object.assign(NS.itemArt, {
    fruit, orb, icon, drawIcon, gate, shape, star, heartPath, leafPath, FRUITS
  });
})();
