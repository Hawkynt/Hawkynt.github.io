/* Creature art, painted once per animation frame: the seven critters (ants, beetles, hornets with
   beating wings, hedgehogs, frost wisps, fire imps; rival snakes use the snake art) and the
   guardians - Grubbin with his dirt mound, Sekhet with claws and a curled sting, Hoarfrost with
   spread wings and a flight shadow, the Hollow Eclipse with its corona; Cindrax is a snake of fire.
   Large versions double as cinematic portraits. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { TAU, CELL } = NS.constants;
  const K = NS.artKit;

  function eye(g, x, y, r, iris, pupil) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = iris || '#1a1a1a';
    g.beginPath(); g.arc(x + r * 0.2, y, r * 0.6, 0, TAU); g.fill();
    if (pupil) { g.fillStyle = pupil; g.beginPath(); g.arc(x + r * 0.25, y, r * 0.28, 0, TAU); g.fill(); }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x - r * 0.15, y - r * 0.3, r * 0.22, 0, TAU); g.fill();
  }

  function legs(g, cx, cy, n, span, len, f, col) {
    g.strokeStyle = col;
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    for (let k = 0; k < n; ++k) {
      const x = cx - span / 2 + k * span / (n - 1);
      const sw = (k + f) % 2 ? 3 : -3;
      g.beginPath(); g.moveTo(x, cy); g.lineTo(x + sw, cy - len); g.moveTo(x, cy); g.lineTo(x - sw, cy + len); g.stroke();
    }
  }

  /* critters face +x; f is the animation frame (0 or 1) */
  function critter(type, f) {
    return K.sprite('critter:' + type + ':' + f, CELL, CELL, (g, w) => {
      const c = w / 2;
      switch (type) {
        case 'ant':
          legs(g, c - 2, c, 3, 12, 8, f, '#3a1a10');
          for (let k = 0; k < 3; ++k) {
            const x = c - 9 + k * 8, r = k === 1 ? 4 : 5.5;
            const gr = g.createRadialGradient(x - 1, c - 2, 1, x, c, r);
            gr.addColorStop(0, '#ff7a5a'); gr.addColorStop(1, '#8a1a10');
            g.fillStyle = gr;
            g.beginPath(); g.ellipse(x, c, r, r * 0.85, 0, 0, TAU); g.fill();
          }
          g.strokeStyle = '#3a1a10'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(c + 9, c - 2); g.lineTo(c + 15, c - 8); g.moveTo(c + 9, c + 2); g.lineTo(c + 15, c + 8); g.stroke();
          eye(g, c + 9, c - 2, 1.6);
          break;
        case 'beetle': {
          legs(g, c - 1, c, 3, 14, 10, f, '#0a2a3a');
          const gr = g.createRadialGradient(c - 5, c - 5, 2, c - 1, c, 14);
          gr.addColorStop(0, '#9af0ff'); gr.addColorStop(0.4, '#2a8aaa'); gr.addColorStop(1, '#0a2a4a');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c - 2, c, 12, 10, 0, 0, TAU); g.fill();
          g.strokeStyle = '#06182a'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(c - 14, c); g.lineTo(c + 8, c); g.stroke();
          g.fillStyle = '#0a1a2a';
          g.beginPath(); g.arc(c + 11, c, 5, 0, TAU); g.fill();
          g.strokeStyle = '#0a1a2a'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(c + 14, c - 3); g.lineTo(c + 18, c - 6); g.moveTo(c + 14, c + 3); g.lineTo(c + 18, c + 6); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.beginPath(); g.ellipse(c - 6, c - 5, 4, 2, -0.4, 0, TAU); g.fill();
          break;
        }
        case 'hornet': {
          g.fillStyle = 'rgba(220,240,255,0.65)';
          const wa = f ? 0.5 : 1.1;
          g.beginPath(); g.ellipse(c - 2, c - 7, 9, 4, -wa, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(c - 2, c + 7, 9, 4, wa, 0, TAU); g.fill();
          g.save();
          g.beginPath(); g.ellipse(c - 5, c, 9, 6.5, 0, 0, TAU); g.clip();
          g.fillStyle = '#ffc81a'; g.fillRect(c - 15, c - 8, 20, 16);
          g.fillStyle = '#1a1a1a';
          for (let k = 0; k < 3; ++k) g.fillRect(c - 12 + k * 6, c - 8, 3, 16);
          g.restore();
          g.fillStyle = '#1a1a1a';
          K.poly(g, [[c - 14, c], [c - 19, c - 1.5], [c - 19, c + 1.5]]); g.fill();
          g.fillStyle = '#e0a010';
          g.beginPath(); g.arc(c + 7, c, 5, 0, TAU); g.fill();
          eye(g, c + 9, c - 2, 2, '#c01010');
          break;
        }
        case 'hedgehog': {
          g.fillStyle = '#4a3020';
          for (let k = 0; k < 11; ++k) {
            const a = Math.PI * 0.55 + k * Math.PI * 0.09 + (f ? 0.04 : 0);
            K.poly(g, [[c - 2 + Math.cos(a) * 6, c + Math.sin(a) * 6], [c - 2 + Math.cos(a) * 17, c + Math.sin(a) * 17], [c - 2 + Math.cos(a + 0.18) * 6, c + Math.sin(a + 0.18) * 6]]);
            g.fill();
          }
          const gr = g.createRadialGradient(c - 4, c - 3, 2, c - 2, c, 12);
          gr.addColorStop(0, '#b08a60'); gr.addColorStop(1, '#5a3a20');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c - 2, c, 11, 9.5, 0, 0, TAU); g.fill();
          g.fillStyle = '#e8c8a0';
          g.beginPath(); g.ellipse(c + 8, c + 1, 6.5, 5.5, 0, 0, TAU); g.fill();
          g.fillStyle = '#1a1a1a';
          g.beginPath(); g.arc(c + 14, c + 1, 2, 0, TAU); g.fill();
          eye(g, c + 7, c - 2, 1.8);
          break;
        }
        case 'wisp': {
          const gr = g.createRadialGradient(c, c + 2, 1, c, c, 16);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, 'rgba(190,244,255,0.9)'); gr.addColorStop(1, 'rgba(110,190,255,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(c - 11, c + 4);
          g.quadraticCurveTo(c - 12, c - 13, c, c - 16);
          g.quadraticCurveTo(c + 12, c - 13, c + 11, c + 4);
          g.quadraticCurveTo(c + (f ? 6 : 4), c + 15, c, c + 10);
          g.quadraticCurveTo(c - (f ? 4 : 6), c + 15, c - 11, c + 4);
          g.fill();
          g.fillStyle = '#1a3a6a';
          g.beginPath(); g.ellipse(c - 4, c - 2, 2, 3, 0, 0, TAU); g.ellipse(c + 4, c - 2, 2, 3, 0, 0, TAU); g.fill();
          break;
        }
        case 'imp': {
          g.fillStyle = '#3a0a0a';
          K.poly(g, [[c - 8, c - 6], [c - 12, c - 15], [c - 4, c - 9]]); g.fill();
          K.poly(g, [[c + 8, c - 6], [c + 12, c - 15], [c + 4, c - 9]]); g.fill();
          const gr = g.createRadialGradient(c - 3, c - 3, 2, c, c, 13);
          gr.addColorStop(0, '#ff9a5a'); gr.addColorStop(0.6, '#e03a1a'); gr.addColorStop(1, '#6a0a0a');
          g.fillStyle = gr;
          g.beginPath(); g.arc(c, c, 11, 0, TAU); g.fill();
          g.fillStyle = '#ffe23a';
          K.poly(g, [[c - 7, c - 3], [c - 2, c - 1], [c - 6, c + 1]]); g.fill();
          K.poly(g, [[c + 7, c - 3], [c + 2, c - 1], [c + 6, c + 1]]); g.fill();
          g.strokeStyle = '#3a0a0a'; g.lineWidth = 1.6;
          g.beginPath(); g.arc(c, c + 3, 4.5, 0.3, Math.PI - 0.3); g.stroke();
          g.fillStyle = '#ff8a2a';
          g.beginPath(); g.moveTo(c - 5, c + 11); g.lineTo(c, c + (f ? 18 : 16)); g.lineTo(c + 5, c + 11); g.fill();
          break;
        }
      }
    });
  }

  /* guardian sprites: a 2 x 2 cell footprint painted with some overhang; f = frame */
  const BS = CELL * 2.6;

  function boss(id, f) {
    return K.sprite('boss:' + id + ':' + f, BS, BS, (g, w) => {
      const c = w / 2;
      switch (id) {
        case 'mole': {
          g.fillStyle = '#e8a0a0';
          for (let s = -1; s <= 1; s += 2) {
            g.beginPath(); g.ellipse(c + s * 30, c + 18 + (f ? 2 : 0), 12, 9, s * 0.4, 0, TAU); g.fill();
            g.strokeStyle = '#f4f0e0'; g.lineWidth = 2.4;
            for (let k = -1; k <= 1; ++k) { g.beginPath(); g.moveTo(c + s * 36 + k * 4, c + 24); g.lineTo(c + s * 38 + k * 5, c + 31); g.stroke(); }
          }
          const gr = g.createRadialGradient(c - 10, c - 12, 4, c, c, 38);
          gr.addColorStop(0, '#a87a5a'); gr.addColorStop(0.7, '#6a4a2a'); gr.addColorStop(1, '#3a2410');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c, c + 4, 34, 30, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(40,24,10,0.5)'; g.lineWidth = 1;
          for (let k = 0; k < 14; ++k) { const a = k * 0.45; g.beginPath(); g.moveTo(c + Math.cos(a) * 22, c + 4 + Math.sin(a) * 20); g.lineTo(c + Math.cos(a) * 30, c + 4 + Math.sin(a) * 27); g.stroke(); }
          g.fillStyle = '#ff9ab0';
          g.beginPath(); g.ellipse(c, c + 12, 10, 7, 0, 0, TAU); g.fill();
          g.fillStyle = '#c0607a'; g.beginPath(); g.arc(c - 3, c + 12, 1.8, 0, TAU); g.arc(c + 3, c + 12, 1.8, 0, TAU); g.fill();
          g.fillStyle = '#101010';
          g.beginPath(); g.ellipse(c - 11, c - 2, 3.5, f ? 1 : 3.5, 0, 0, TAU); g.ellipse(c + 11, c - 2, 3.5, f ? 1 : 3.5, 0, 0, TAU); g.fill();
          const cg = g.createLinearGradient(0, c - 40, 0, c - 20);
          cg.addColorStop(0, '#fff2a0'); cg.addColorStop(1, '#c8920a');
          g.fillStyle = cg;
          K.poly(g, [[c - 16, c - 20], [c - 16, c - 34], [c - 8, c - 26], [c, c - 40], [c + 8, c - 26], [c + 16, c - 34], [c + 16, c - 20]]); g.fill();
          g.fillStyle = '#fff27a';
          g.beginPath(); g.arc(c, c - 27, 3.5, 0, TAU); g.fill();
          break;
        }
        case 'scorpion': {
          g.strokeStyle = '#7a2a10'; g.lineWidth = 3; g.lineCap = 'round';
          for (let k = 0; k < 4; ++k) for (let s = -1; s <= 1; s += 2) {
            g.beginPath(); g.moveTo(c - 12 + k * 8, c + s * 10); g.lineTo(c - 16 + k * 8 + (f ? 3 : 0), c + s * 26); g.stroke();
          }
          for (let s = -1; s <= 1; s += 2) {
            g.fillStyle = '#c0502a';
            g.beginPath(); g.ellipse(c + 26, c + s * 22, 10, 7, s * 0.5, 0, TAU); g.fill();
            g.fillStyle = '#e0703a';
            K.poly(g, [[c + 30, c + s * 16], [c + 44, c + s * (f ? 14 : 18)], [c + 34, c + s * 24]]); g.fill();
          }
          const gr = g.createRadialGradient(c - 6, c - 6, 3, c, c, 26);
          gr.addColorStop(0, '#ff9a5a'); gr.addColorStop(0.6, '#c0502a'); gr.addColorStop(1, '#5a1a0a');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c, c, 26, 18, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(60,10,0,0.5)'; g.lineWidth = 1.5;
          for (let k = -2; k <= 2; ++k) { g.beginPath(); g.moveTo(c + k * 8, c - 16); g.lineTo(c + k * 8, c + 16); g.stroke(); }
          /* the tail curls over the back */
          g.strokeStyle = '#a03a1a'; g.lineWidth = 9;
          g.beginPath(); g.moveTo(c - 24, c); g.bezierCurveTo(c - 52, c - 6, c - 40, c - 46, c - 6, c - 40); g.stroke();
          g.fillStyle = '#ffcf6a';
          K.poly(g, [[c - 8, c - 46], [c + 10, c - 36 + (f ? 4 : 0)], [c - 6, c - 32]]); g.fill();
          eye(g, c + 16, c - 5, 3.4, '#1a0a00'); eye(g, c + 16, c + 5, 3.4, '#1a0a00');
          g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(c - 2, c, 4, 0, TAU); g.fill();
          break;
        }
        case 'owl': {
          g.fillStyle = '#b8d0e8';
          const wa = f ? 0.15 : 0;
          for (let s = -1; s <= 1; s += 2) {
            g.beginPath(); g.ellipse(c + s * 30, c + 6, 22, 11, s * (0.5 + wa), 0, TAU); g.fill();
            g.strokeStyle = '#7a98c0'; g.lineWidth = 1.2;
            for (let k = 0; k < 4; ++k) { g.beginPath(); g.moveTo(c + s * 18, c + 2 + k * 3); g.lineTo(c + s * 46, c + 12 + k * 4); g.stroke(); }
          }
          const gr = g.createRadialGradient(c - 6, c - 10, 4, c, c, 32);
          gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#d8ecff'); gr.addColorStop(1, '#8ab0d8');
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(c, c + 4, 24, 30, 0, 0, TAU); g.fill();
          g.fillStyle = '#d8ecff';
          K.poly(g, [[c - 20, c - 18], [c - 16, c - 36], [c - 6, c - 22]]); g.fill();
          K.poly(g, [[c + 20, c - 18], [c + 16, c - 36], [c + 6, c - 22]]); g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(c - 10, c - 8, 10, 0, TAU); g.arc(c + 10, c - 8, 10, 0, TAU); g.fill();
          eye(g, c - 10, c - 8, 7, '#ffb02a', '#101010'); eye(g, c + 10, c - 8, 7, '#ffb02a', '#101010');
          g.fillStyle = '#e0a03a';
          K.poly(g, [[c - 4, c + 2], [c + 4, c + 2], [c, c + 10]]); g.fill();
          g.strokeStyle = '#a8c0dc'; g.lineWidth = 1.4;
          for (let k = 0; k < 3; ++k) { g.beginPath(); g.arc(c, c + 16 + k * 5, 8, 0.4, Math.PI - 0.4); g.stroke(); }
          break;
        }
        case 'wyrm': {
          /* a coiled fire wyrm, used for map stops and portraits */
          for (let k = 22; k >= 0; --k) {
            const a = k * 0.42 + (f ? 0.08 : 0), d = 8 + k * 1.45;
            const x = c + Math.cos(a) * d, y = c + 6 + Math.sin(a) * d * 0.8, r = 12 - k * 0.3;
            const col = k < 8 ? '#ffb03a' : k < 15 ? '#ff6a2a' : '#8a1a0a';
            const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r);
            gr.addColorStop(0, K.shade(col, 0.4)); gr.addColorStop(1, K.shade(col, -0.4));
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
          }
          g.fillStyle = '#e8e0d0';
          K.poly(g, [[c - 12, c - 10], [c - 18, c - 30], [c - 4, c - 14]]); g.fill();
          K.poly(g, [[c + 12, c - 10], [c + 18, c - 30], [c + 4, c - 14]]); g.fill();
          const hg = g.createRadialGradient(c - 5, c - 8, 2, c, c - 2, 18);
          hg.addColorStop(0, '#ffd27a'); hg.addColorStop(0.6, '#ff6a2a'); hg.addColorStop(1, '#8a1a0a');
          g.fillStyle = hg;
          g.beginPath(); g.ellipse(c, c - 2, 18, 15, 0, 0, TAU); g.fill();
          eye(g, c - 7, c - 5, 4.5, '#ffe07a', '#101010'); eye(g, c + 7, c - 5, 4.5, '#ffe07a', '#101010');
          g.fillStyle = '#3a0a04';
          g.beginPath(); g.arc(c - 3, c + 6, 1.5, 0, TAU); g.arc(c + 3, c + 6, 1.5, 0, TAU); g.fill();
          break;
        }
        case 'eclipse': {
          const gr = g.createRadialGradient(c, c, 10, c, c, c);
          gr.addColorStop(0, 'rgba(192,140,255,0)'); gr.addColorStop(0.55, 'rgba(192,140,255,0.55)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(192,140,255,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, w, w);
          const sg = g.createRadialGradient(c - 8, c - 10, 2, c, c, 30);
          sg.addColorStop(0, '#4a2a7a'); sg.addColorStop(0.7, '#1a0a30'); sg.addColorStop(1, '#05020c');
          g.fillStyle = sg;
          g.beginPath(); g.arc(c, c, 30, 0, TAU); g.fill();
          for (let k = 0; k < 6; ++k) {
            const a = k * TAU / 6 + (f ? 0.2 : 0);
            g.fillStyle = '#c08cff';
            g.beginPath(); g.ellipse(c + Math.cos(a) * 18, c + Math.sin(a) * 18, 3.4, 2, a, 0, TAU); g.fill();
          }
          eye(g, c, c, 7, '#c08cff', '#000000');
          break;
        }
      }
    });
  }

  function mound() {
    return K.sprite('mound', CELL * 2, CELL * 2, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c - 6, c - 6, 2, c, c, 30);
      gr.addColorStop(0, '#a8805a'); gr.addColorStop(0.7, '#6a4a2a'); gr.addColorStop(1, 'rgba(60,40,20,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(c, c + 4, 30, 22, 0, 0, TAU); g.fill();
      g.fillStyle = '#4a3018';
      for (let k = 0; k < 7; ++k) { g.beginPath(); g.arc(c - 18 + k * 6, c + 2 + (k % 2) * 6, 2.5, 0, TAU); g.fill(); }
    });
  }

  function flightShadow() {
    return K.sprite('fshadow', CELL * 2.4, CELL * 1.4, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(10,20,40,0.45)'); gr.addColorStop(1, 'rgba(10,20,40,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); g.fill();
    });
  }

  const WYRM_SKIN = { id: 'wyrm', a: '#ff6a2a', b: '#3a0a04', c: '#ffe07a', eye: '#ffffff', pattern: 'ember' };

  Object.assign(NS.creatureArt, {
    critter, boss, mound, flightShadow, eye, BS, WYRM_SKIN
  });
})();
