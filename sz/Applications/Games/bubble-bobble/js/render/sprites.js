/* Painted, cached sprites: Fizz the newt in her collection colour (standing, two walk frames,
   jumping, blowing) facing either way, every enemy kind in calm, angry and frozen variants,
   bubbles (empty, elemental with their sign, and trapping a curled-up enemy), eight fruits,
   the candies, the room's platform tiles per kingdom, enemy and guardian shots, the shade. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const K = NS.artKit;
  const C = NS.constants;
  const { TAU, TILE, ENEMIES, POWER_BY_ID } = C;

  /* the newt: 40 x 40, feet at the bottom centre */
  function newt(def, pose, face) {
    return K.sprite('newt:' + def.id + ':' + pose + ':' + face, 40, 40, (g) => {
      if (face < 0) { g.translate(40, 0); g.scale(-1, 1); }
      const c = def.color, d = K.shade(def.color, -0.3), a = def.accent;
      const bob = pose === 'walk1' ? -1 : pose === 'walk2' ? 1 : 0;
      /* tail */
      g.fillStyle = d;
      g.beginPath(); g.moveTo(10, 30); g.quadraticCurveTo(0, 28, 2, 20); g.quadraticCurveTo(6, 26, 12, 26); g.closePath(); g.fill();
      /* feet */
      g.fillStyle = d;
      g.fillRect(12 + bob * 2, 34, 6, 6);
      g.fillRect(22 - bob * 2, 34, 6, 6);
      /* body */
      K.ellipse(g, 20, 26, 11, 10, c);
      K.ellipse(g, 21, 29, 7, 6, K.shade(c, 0.35));
      /* head */
      K.circle(g, 24, 14 + (pose === 'jump' ? -1 : 0), 11, c);
      /* frills */
      g.fillStyle = a;
      for (let k = 0; k < 3; ++k) { g.beginPath(); g.ellipse(14, 8 + k * 5, 5, 2, -0.5 + k * 0.3, 0, TAU); g.fill(); }
      /* eye and mouth */
      K.circle(g, 28, 12, 4, '#ffffff');
      K.circle(g, 29, 12, 2.2, '#1a1a2a');
      K.circle(g, 29.6, 11.2, 0.8, '#ffffff');
      if (pose === 'blow') { K.circle(g, 35, 17, 3.2, K.shade(c, -0.4)); K.circle(g, 35, 17, 1.6, '#ffc0d0'); }
      else { g.strokeStyle = K.shade(c, -0.5); g.lineWidth = 1.5; g.beginPath(); g.arc(30, 17, 3, 0.2, Math.PI - 0.6); g.stroke(); }
      K.circle(g, 26, 18, 2, 'rgba(255,120,150,0.5)');
    });
  }

  /* enemies: 32 x 32, feet at the bottom centre; state: 0 calm, 1 angry, 2 frozen */
  function enemy(type, face, state, frame) {
    return K.sprite('enemy:' + type + ':' + face + ':' + state + ':' + frame, 32, 32, (g) => {
      if (face < 0) { g.translate(32, 0); g.scale(-1, 1); }
      const d = ENEMIES[type];
      const c = state === 2 ? '#bfe8ff' : state === 1 ? '#ff4a4a' : d.color;
      const dk = K.shade(c, -0.35);
      const f = frame ? 1 : 0;
      switch (type) {
        case 'flyer':
          g.fillStyle = K.shade(c, 0.3);
          g.beginPath(); g.ellipse(8, 10 - f * 3, 8, 4, -0.5, 0, TAU); g.ellipse(24, 10 - f * 3, 8, 4, 0.5, 0, TAU); g.fill();
          K.circle(g, 16, 16, 10, c);
          break;
        case 'ghost':
          g.globalAlpha = 0.85;
          g.fillStyle = c;
          g.beginPath(); g.arc(16, 14, 11, Math.PI, 0); g.lineTo(27, 30); for (let k = 0; k < 4; ++k) g.lineTo(27 - (k + 0.5) * 5.5, 30 - ((k + f) % 2) * 4); g.lineTo(5, 30); g.closePath(); g.fill();
          g.globalAlpha = 1;
          break;
        case 'brute':
          K.roundRect(g, 3, 6, 26, 26, 6); g.fillStyle = c; g.fill();
          g.fillStyle = dk; g.fillRect(3, 24, 26, 8);
          g.fillStyle = '#e0e8f0'; g.beginPath(); g.moveTo(6, 8); g.lineTo(9, 1); g.lineTo(12, 8); g.moveTo(20, 8); g.lineTo(23, 1); g.lineTo(26, 8); g.fill();
          break;
        case 'hopper':
          K.ellipse(g, 16, 22 - f * 2, 12, 10, c);
          g.fillStyle = dk; g.fillRect(6, 28, 8, 4); g.fillRect(18, 28, 8, 4);
          break;
        case 'shooter':
          K.circle(g, 16, 20, 11, c);
          g.fillStyle = dk; g.fillRect(22, 18, 9, 5);
          g.fillStyle = '#8a7a5a'; K.circle(g, 16, 8, 6, '#8a7a5a');
          break;
        case 'charger':
          g.fillStyle = c; g.beginPath(); g.moveTo(2, 30); g.lineTo(10, 8); g.lineTo(28, 14); g.lineTo(30, 30); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(26, 12); g.lineTo(32, 6); g.lineTo(29, 15); g.fill();
          break;
        default:
          K.circle(g, 16, 18, 12, c);
          g.fillStyle = dk; g.fillRect(8 + f * 2, 28, 6, 4); g.fillRect(18 - f * 2, 28, 6, 4);
      }
      K.circle(g, 20, 14, 4.5, '#ffffff');
      K.circle(g, 21.5, 14, 2.2, state === 1 ? '#ffe04a' : '#1a1a2a');
      g.strokeStyle = '#1a1a2a'; g.lineWidth = 2;
      g.beginPath();
      if (state === 1) { g.moveTo(15, 8); g.lineTo(24, 11); } else { g.moveTo(16, 9); g.lineTo(24, 9); }
      g.stroke();
      if (state === 2) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.strokeRect(2, 2, 28, 28); }
    });
  }

  function bubble(def, r, elem) {
    const s = Math.ceil(r * 2 + 6);
    return K.sprite('bub:' + def.id + ':' + r + ':' + (elem || ''), s, s, (g) => {
      const c = s / 2;
      const col = elem === 'water' ? '#5ad0ff' : elem === 'bolt' ? '#ffe04a' : elem === 'fire' ? '#ff7a2a' : elem === 'star' ? '#ff9ad8' : def.color;
      const gr = g.createRadialGradient(c - r * 0.3, c - r * 0.3, 1, c, c, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.75, K.rgba(col, 0.25)); gr.addColorStop(1, K.rgba(col, 0.75));
      g.fillStyle = gr;
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
      g.strokeStyle = K.rgba(def.core || '#ffffff', 0.85); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.ellipse(c - r * 0.4, c - r * 0.45, r * 0.28, r * 0.16, -0.6, 0, TAU); g.fill();
      if (elem) {
        g.save();
        g.translate(c, c);
        g.scale(r / 18, r / 18);
        NS.kit.paintIcon(g, elem === 'water' ? 'drop' : elem === 'bolt' ? 'bolt' : elem === 'fire' ? 'fire' : 'star', col);
        g.restore();
      }
    });
  }

  const FRUITS = ['#ff4a4a', '#ffd23a', '#7be08a', '#ff9a3a', '#c08aff', '#ff7ad8', '#5ad0ff', '#ffe8a0'];
  function fruit(i) {
    return K.sprite('fruit:' + i, 24, 24, (g) => {
      const c = FRUITS[i % FRUITS.length];
      if (i % 4 === 1) { g.fillStyle = c; g.beginPath(); g.moveTo(4, 8); g.quadraticCurveTo(12, 26, 22, 6); g.quadraticCurveTo(12, 16, 4, 8); g.fill(); }
      else if (i % 4 === 2) { for (let k = 0; k < 6; ++k) K.circle(g, 8 + (k % 3) * 4, 10 + Math.floor(k / 3) * 5 + (k % 2), 3.4, c); }
      else if (i % 4 === 3) { g.fillStyle = c; K.star(g, 12, 13, 10, 0.45, 5); g.fill(); }
      else { K.circle(g, 12, 14, 8, c); K.circle(g, 9, 11, 2.5, 'rgba(255,255,255,0.6)'); }
      g.fillStyle = '#3a8a3a'; g.beginPath(); g.ellipse(14, 4, 4, 2, -0.5, 0, TAU); g.fill();
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(12, 6); g.lineTo(12, 2); g.stroke();
    });
  }

  function candy(id) {
    const p = POWER_BY_ID[id];
    return K.sprite('candy:' + id, 30, 26, (g) => {
      g.fillStyle = K.shade(p.color, -0.2);
      g.beginPath(); g.moveTo(1, 6); g.lineTo(8, 13); g.lineTo(1, 20); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(29, 6); g.lineTo(22, 13); g.lineTo(29, 20); g.closePath(); g.fill();
      const gr = g.createRadialGradient(13, 10, 1, 15, 13, 9);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, p.color); gr.addColorStop(1, K.shade(p.color, -0.3));
      g.fillStyle = gr; g.beginPath(); g.arc(15, 13, 9, 0, TAU); g.fill();
      g.save(); g.translate(15, 13); g.scale(0.45, 0.45); NS.kit.paintIcon(g, p.icon, '#ffffff'); g.restore();
    });
  }

  function tile(w, edgeL, edgeR) {
    const W = NS.worldData.WORLDS[w];
    return K.sprite('tile:' + w + ':' + (edgeL ? 1 : 0) + (edgeR ? 1 : 0), TILE, TILE, (g) => {
      const c = W.tile;
      const gr = g.createLinearGradient(0, 0, 0, TILE);
      gr.addColorStop(0, K.shade(c, 0.35)); gr.addColorStop(0.3, c); gr.addColorStop(1, K.shade(c, -0.45));
      g.fillStyle = gr;
      K.roundRect(g, edgeL ? 1 : 0, 1, TILE - (edgeL ? 1 : 0) - (edgeR ? 1 : 0), TILE - 2, edgeL || edgeR ? 5 : 0);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(edgeL ? 3 : 0, 2, TILE - (edgeL ? 3 : 0) - (edgeR ? 3 : 0), 3);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0; k < 3; ++k) K.circle(g, 6 + k * 8, 14 + (k % 2) * 6, 2, 'rgba(0,0,0,0.15)');
    });
  }

  function shot(boss) {
    return K.sprite('shot:' + (boss ? 1 : 0), 20, 20, (g) => {
      const col = boss ? '#ff6a3a' : '#c0a060';
      const gr = g.createRadialGradient(10, 10, 1, 10, 10, 9);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, col); gr.addColorStop(1, K.rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 20, 20);
    });
  }

  function shade() {
    return K.sprite('shade', 48, 48, (g) => {
      const gr = g.createRadialGradient(24, 24, 2, 24, 24, 23);
      gr.addColorStop(0, 'rgba(40,10,40,0.95)'); gr.addColorStop(0.7, 'rgba(90,20,80,0.6)'); gr.addColorStop(1, 'rgba(90,20,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
      K.circle(g, 18, 20, 3.5, '#ff4a4a'); K.circle(g, 30, 20, 3.5, '#ff4a4a');
    });
  }

  Object.assign(NS.sprites, { newt, enemy, bubble, fruit, candy, tile, shot, shade, FRUITS });
})();
