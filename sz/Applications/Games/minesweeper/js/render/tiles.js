/* Cell art painted once per tile set and size into cached sprites: closed cells in seven styles
   (classic raised bevel, grass with tufts, faceted crystal, rough stone, riveted metal, wooden
   planks, glowing neon), open cells, the numbers in their classic colours (brighter on dark sets),
   flags in seven shapes, the question mark, the mine (and the one that went off), a wrong flag, a
   defused mine in its shield ring, a reburied mound and the drifting smoke. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const K = NS.artKit;
  const C = NS.constants;
  const { TAU, NUMBERS } = C;

  const BRIGHT = ['', '#5a8aff', '#5ae05a', '#ff5a5a', '#9a7aff', '#ff8a5a', '#5ae0e0', '#e0e0e0', '#a0a0b0'];

  function dark(def) {
    const h = K.hex(def.open);
    return 0.3 * h[0] + 0.59 * h[1] + 0.11 * h[2] < 110;
  }

  function closed(def, s) {
    return K.sprite('cell:' + def.id + ':' + s, s, s, (g) => {
      const c = def.color, a = def.accent;
      const b = Math.max(2, Math.round(s * 0.12));
      if (def.style === 'classic') {
        g.fillStyle = c; g.fillRect(0, 0, s, s);
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, b); g.fillRect(0, 0, b, s);
        g.fillStyle = '#7b7b7b'; g.fillRect(0, s - b, s, b); g.fillRect(s - b, 0, b, s);
        return;
      }
      if (def.style === 'neon') {
        g.fillStyle = c; g.fillRect(0, 0, s, s);
        g.strokeStyle = K.rgba(a, 0.9); g.lineWidth = Math.max(1.5, s * 0.06); K.roundRect(g, 2, 2, s - 4, s - 4, s * 0.18); g.stroke();
        g.strokeStyle = K.rgba(a, 0.25); g.lineWidth = Math.max(3, s * 0.16); K.roundRect(g, 3, 3, s - 6, s - 6, s * 0.18); g.stroke();
        return;
      }
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, K.shade(c, 0.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, K.shade(c, -0.35));
      K.roundRect(g, 1, 1, s - 2, s - 2, s * (def.style === 'gem' ? 0.22 : 0.14)); g.fillStyle = gr; g.fill();
      if (def.style === 'grass') {
        g.strokeStyle = K.rgba(a, 0.9); g.lineWidth = Math.max(1, s * 0.05);
        for (let k = 0; k < 4; ++k) { const x = s * (0.2 + k * 0.2), y = s * (0.75 - (k % 2) * 0.35); g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 0.05, y - s * 0.12); g.moveTo(x, y); g.lineTo(x + s * 0.05, y - s * 0.12); g.stroke(); }
      } else if (def.style === 'gem') {
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(s * 0.18, s * 0.18); g.lineTo(s * 0.82, s * 0.18); g.lineTo(s * 0.5, s * 0.5); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(s * 0.18, s * 0.82); g.lineTo(s * 0.82, s * 0.82); g.lineTo(s * 0.5, s * 0.5); g.closePath(); g.fill();
      } else if (def.style === 'stone') {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        for (let k = 0; k < 5; ++k) K.circle(g, s * ((k * 37) % 80 + 10) / 100, s * ((k * 53) % 80 + 10) / 100, s * 0.06);
      } else if (def.style === 'metal') {
        for (const [x, y] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) K.circle(g, s * x, s * y, Math.max(1, s * 0.05), K.rgba(a, 0.8));
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(s * 0.12, s * 0.12, s * 0.76, s * 0.08);
      } else if (def.style === 'wood') {
        g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = Math.max(1, s * 0.04);
        for (let k = 1; k < 3; ++k) { g.beginPath(); g.moveTo(2, s * k / 3); g.lineTo(s - 2, s * k / 3); g.stroke(); }
      }
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = Math.max(1, s * 0.05);
      K.roundRect(g, 1.5, 1.5, s - 3, s - 3, s * 0.14); g.stroke();
    });
  }

  function open(def, s) {
    return K.sprite('open:' + def.id + ':' + s, s, s, (g) => {
      if (def.style === 'classic') {
        g.fillStyle = def.open; g.fillRect(0, 0, s, s);
        g.fillStyle = '#7b7b7b'; g.fillRect(0, 0, s, 1); g.fillRect(0, 0, 1, s);
        return;
      }
      g.fillStyle = def.open; g.fillRect(0, 0, s, s);
      g.fillStyle = dark(def) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      g.fillRect(0, 0, s, Math.max(1, s * 0.06)); g.fillRect(0, 0, Math.max(1, s * 0.06), s);
      g.strokeStyle = dark(def) ? K.rgba(def.accent, 0.15) : 'rgba(0,0,0,0.08)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, s - 1, s - 1);
    });
  }

  function number(n, s, def) {
    const bright = dark(def);
    return K.sprite('num:' + n + ':' + s + ':' + (bright ? 1 : 0), s, s, (g) => {
      g.font = 'bold ' + Math.round(s * 0.66) + 'px ' + C.UI.font;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (bright) { g.fillStyle = K.rgba(BRIGHT[n], 0.35); g.fillText(String(n), s / 2 + 1, s / 2 + 2); }
      g.fillStyle = bright ? BRIGHT[n] : NUMBERS[n];
      g.fillText(String(n), s / 2, s / 2 + 1);
    });
  }

  function flag(def, s) {
    return K.sprite('flag:' + def.id + ':' + s, s, s, (g) => {
      const c = def.color;
      g.fillStyle = def.pole;
      g.fillRect(s * 0.47, s * 0.18, Math.max(1.5, s * 0.07), s * 0.6);
      g.fillRect(s * 0.28, s * 0.76, s * 0.44, Math.max(1.5, s * 0.08));
      g.fillStyle = c;
      const x = s * 0.5, y = s * 0.2;
      switch (def.shape) {
        case 'banner': g.fillRect(x - s * 0.3, y, s * 0.3, s * 0.32); g.fillStyle = K.shade(c, 0.4); g.fillRect(x - s * 0.3, y + s * 0.12, s * 0.3, s * 0.06); break;
        case 'sprout': g.beginPath(); g.ellipse(x - s * 0.14, y + s * 0.14, s * 0.16, s * 0.08, -0.6, 0, TAU); g.ellipse(x + s * 0.12, y + s * 0.06, s * 0.14, s * 0.07, 0.6, 0, TAU); g.fill(); break;
        case 'star': K.star(g, x, y + s * 0.12, s * 0.2, 0.45, 5); g.fill(); break;
        case 'heart': g.beginPath(); g.moveTo(x, y + s * 0.3); g.bezierCurveTo(x - s * 0.34, y + s * 0.06, x - s * 0.12, y - s * 0.12, x, y + s * 0.06); g.bezierCurveTo(x + s * 0.12, y - s * 0.12, x + s * 0.34, y + s * 0.06, x, y + s * 0.3); g.fill(); break;
        case 'crown': g.beginPath(); g.moveTo(x - s * 0.24, y + s * 0.3); g.lineTo(x - s * 0.24, y); g.lineTo(x - s * 0.1, y + s * 0.14); g.lineTo(x, y - s * 0.04); g.lineTo(x + s * 0.1, y + s * 0.14); g.lineTo(x + s * 0.24, y); g.lineTo(x + s * 0.24, y + s * 0.3); g.closePath(); g.fill(); break;
        case 'gear': K.circle(g, x, y + s * 0.12, s * 0.16, c); for (let k = 0; k < 6; ++k) { const a = k / 6 * TAU; g.fillRect(x + Math.cos(a) * s * 0.18 - s * 0.04, y + s * 0.12 + Math.sin(a) * s * 0.18 - s * 0.04, s * 0.08, s * 0.08); } K.circle(g, x, y + s * 0.12, s * 0.06, def.pole); break;
        default: g.beginPath(); g.moveTo(x + s * 0.04, y); g.lineTo(x - s * 0.3, y + s * 0.16); g.lineTo(x + s * 0.04, y + s * 0.32); g.closePath(); g.fill();
      }
    });
  }

  function question(s, def) {
    return K.sprite('q:' + s + ':' + (dark(def) ? 1 : 0), s, s, (g) => {
      g.font = 'bold ' + Math.round(s * 0.62) + 'px ' + C.UI.font;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = dark(def) ? '#e0e0ff' : '#1a1a3a';
      g.fillText('?', s / 2, s / 2 + 1);
    });
  }

  function mine(s, exploded) {
    return K.sprite('mine:' + s + ':' + (exploded ? 1 : 0), s, s, (g) => {
      if (exploded) { g.fillStyle = '#ff2a2a'; g.fillRect(0, 0, s, s); }
      const c = s / 2, r = s * 0.24;
      g.strokeStyle = '#141418'; g.lineWidth = Math.max(1.5, s * 0.07);
      for (let k = 0; k < 4; ++k) { const a = k / 4 * Math.PI; g.beginPath(); g.moveTo(c - Math.cos(a) * r * 1.6, c - Math.sin(a) * r * 1.6); g.lineTo(c + Math.cos(a) * r * 1.6, c + Math.sin(a) * r * 1.6); g.stroke(); }
      const gr = g.createRadialGradient(c - r * 0.4, c - r * 0.4, 1, c, c, r);
      gr.addColorStop(0, '#9a9aa8'); gr.addColorStop(0.35, '#2a2a32'); gr.addColorStop(1, '#0a0a10');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
      K.circle(g, c - r * 0.35, c - r * 0.35, Math.max(1, r * 0.22), '#ffffff');
    });
  }

  function wrongFlag(def, s) {
    return K.sprite('wrong:' + def.id + ':' + s, s, s, (g) => {
      g.drawImage(mine(s, false), 0, 0);
      g.strokeStyle = '#ff2a2a'; g.lineWidth = Math.max(2, s * 0.09);
      g.beginPath(); g.moveTo(s * 0.18, s * 0.18); g.lineTo(s * 0.82, s * 0.82); g.moveTo(s * 0.82, s * 0.18); g.lineTo(s * 0.18, s * 0.82); g.stroke();
    });
  }

  function defused(s) {
    return K.sprite('defused:' + s, s, s, (g) => {
      g.drawImage(mine(s, false), 0, 0);
      g.strokeStyle = '#c8a0ff'; g.lineWidth = Math.max(1.5, s * 0.07);
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(200,160,255,0.35)'; g.lineWidth = Math.max(3, s * 0.15);
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.42, 0, TAU); g.stroke();
    });
  }

  function mound(s) {
    return K.sprite('mound:' + s, s, s, (g) => {
      g.fillStyle = 'rgba(90,58,26,0.85)';
      g.beginPath(); g.ellipse(s / 2, s * 0.7, s * 0.4, s * 0.24, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(140,96,50,0.9)'; K.circle(g, s * 0.36, s * 0.56, s * 0.06); K.circle(g, s * 0.6, s * 0.5, s * 0.05);
    });
  }

  function smoke(s) {
    return K.sprite('smoke:' + s, s * 2, s * 2, (g) => {
      const gr = g.createRadialGradient(s, s, s * 0.2, s, s, s);
      gr.addColorStop(0, 'rgba(90,90,100,0.85)'); gr.addColorStop(1, 'rgba(90,90,100,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s * 2, s * 2);
    });
  }

  /* the classic item hints shown only after opening: a gem and a chest that pop out */
  function gem(s) {
    return K.sprite('gem:' + s, s, s, (g) => {
      g.fillStyle = '#ff7ad8';
      g.beginPath(); g.moveTo(s * 0.2, s * 0.42); g.lineTo(s * 0.34, s * 0.22); g.lineTo(s * 0.66, s * 0.22); g.lineTo(s * 0.8, s * 0.42); g.lineTo(s * 0.5, s * 0.84); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.moveTo(s * 0.2, s * 0.42); g.lineTo(s * 0.8, s * 0.42); g.lineTo(s * 0.66, s * 0.22); g.lineTo(s * 0.34, s * 0.22); g.closePath(); g.fill();
    });
  }

  function chest(s) {
    return K.sprite('chest:' + s, s, s, (g) => {
      K.roundRect(g, s * 0.16, s * 0.36, s * 0.68, s * 0.44, s * 0.08); g.fillStyle = '#a0602a'; g.fill();
      g.fillStyle = '#c07a3a'; g.beginPath(); g.ellipse(s * 0.5, s * 0.38, s * 0.34, s * 0.16, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#ffd25a'; g.fillRect(s * 0.16, s * 0.48, s * 0.68, s * 0.06); g.fillRect(s * 0.45, s * 0.44, s * 0.1, s * 0.16);
    });
  }

  Object.assign(NS.tiles, { dark, closed, open, number, flag, question, mine, wrongFlag, defused, mound, smoke, gem, chest });
})();
