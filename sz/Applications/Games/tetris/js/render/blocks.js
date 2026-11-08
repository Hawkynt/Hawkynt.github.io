/* Block art: every block skin painted once per piece type and size into a cached sprite -
   gloss, pixel, glass, neon, candy, ruin stone, gemcut, hologram, royal gold, voidglass and the
   six festival skins - plus garbage, crystal, the power-orb and gem overlays, and the ghost.
   Frames only blit these. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const K = NS.artKit;
  const { COLORS, TYPES, TAU } = NS.constants;

  function base(t) {
    return COLORS[t] || COLORS.garbage;
  }

  function paint(g, style, t, s) {
    const c = base(t);
    const hi = K.shade(c, 0.35), lo = K.shade(c, -0.35);
    const r = NS.rng.makeRng(NS.rng.hashString(style + t));
    switch (style) {
      case 'pixel': {
        const p = Math.max(2, Math.round(s / 10));
        g.fillStyle = c; g.fillRect(0, 0, s, s);
        g.fillStyle = hi; g.fillRect(0, 0, s, p); g.fillRect(0, 0, p, s);
        g.fillStyle = lo; g.fillRect(0, s - p, s, p); g.fillRect(s - p, 0, p, s);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(p, p, p, p);
        break;
      }
      case 'glass': {
        g.fillStyle = K.rgba(c, 0.45); g.fillRect(1, 1, s - 2, s - 2);
        g.strokeStyle = K.rgba(hi, 0.95); g.lineWidth = 2; g.strokeRect(2, 2, s - 4, s - 4);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.moveTo(3, 3); g.lineTo(s * 0.6, 3); g.lineTo(3, s * 0.6); g.closePath(); g.fill();
        break;
      }
      case 'neon': {
        g.fillStyle = 'rgba(6,8,20,0.92)'; g.fillRect(0, 0, s, s);
        for (let k = 3; k >= 1; --k) { g.strokeStyle = K.rgba(c, 0.25 * (4 - k)); g.lineWidth = k * 2; g.strokeRect(k + 1, k + 1, s - 2 * k - 2, s - 2 * k - 2); }
        g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, s - 7, s - 7);
        break;
      }
      case 'candy': {
        K.roundRect(g, 1, 1, s - 2, s - 2, s * 0.28); g.fillStyle = c; g.fill();
        g.save(); g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = s * 0.14;
        for (let k = -2; k < 4; ++k) { g.beginPath(); g.moveTo(k * s * 0.4, s); g.lineTo(k * s * 0.4 + s, 0); g.stroke(); }
        g.restore();
        K.circle(g, s * 0.3, s * 0.28, s * 0.12, 'rgba(255,255,255,0.8)');
        break;
      }
      case 'stone': {
        g.fillStyle = K.mix(c, '#8a8070', 0.55); g.fillRect(0, 0, s, s);
        for (let i = 0; i < 14; ++i) K.circle(g, r.range(2, s - 2), r.range(2, s - 2), r.range(0.6, 2), 'rgba(' + (r.next() < 0.5 ? '255,255,255,' : '0,0,0,') + r.range(0.08, 0.2) + ')');
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(r.range(3, s - 3), 2); g.lineTo(r.range(s * 0.3, s * 0.7), s * 0.5); g.lineTo(r.range(3, s - 3), s - 2); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, s, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, s - 2, s, 2);
        g.fillStyle = K.rgba(c, 0.6); g.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
        break;
      }
      case 'gem': {
        const m = s / 2;
        const tri = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.closePath(); g.fill(); };
        tri([0, 0, s, 0, m, m], hi); tri([s, 0, s, s, m, m], c); tri([s, s, 0, s, m, m], lo); tri([0, s, 0, 0, m, m], K.shade(c, 0.12));
        g.fillStyle = K.shade(c, 0.5); g.fillRect(m - s * 0.15, m - s * 0.15, s * 0.3, s * 0.3);
        break;
      }
      case 'holo': {
        const gr = g.createLinearGradient(0, 0, s, s);
        const h0 = TYPES.indexOf(t) * 50;
        gr.addColorStop(0, 'hsl(' + h0 + ',90%,70%)'); gr.addColorStop(0.5, 'hsl(' + (h0 + 60) + ',90%,65%)'); gr.addColorStop(1, 'hsl(' + (h0 + 140) + ',90%,60%)');
        g.fillStyle = gr; g.fillRect(1, 1, s - 2, s - 2);
        g.fillStyle = 'rgba(255,255,255,0.25)'; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.strokeRect(1.5, 1.5, s - 3, s - 3);
        break;
      }
      case 'royal': {
        g.fillStyle = '#c09030'; g.fillRect(0, 0, s, s);
        g.fillStyle = '#fff0b0'; g.fillRect(1, 1, s - 2, 2); g.fillRect(1, 1, 2, s - 2);
        const gr = g.createRadialGradient(s * 0.4, s * 0.4, 1, s / 2, s / 2, s * 0.5);
        gr.addColorStop(0, hi); gr.addColorStop(1, lo);
        g.fillStyle = gr; g.fillRect(4, 4, s - 8, s - 8);
        K.circle(g, s / 2, s / 2, s * 0.1, '#fff0b0');
        break;
      }
      case 'void': case 'starfall': {
        g.fillStyle = style === 'void' ? '#0a0618' : '#141040'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 6; ++i) K.circle(g, r.range(2, s - 2), r.range(2, s - 2), r.range(0.4, 1.2), 'rgba(255,255,255,' + r.range(0.4, 1) + ')');
        g.strokeStyle = style === 'void' ? c : '#ffd23a'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
        if (style === 'starfall') { g.fillStyle = c; K.star(g, s / 2, s / 2, s * 0.22, 0.45, 5); g.fill(); }
        break;
      }
      case 'frost': {
        g.fillStyle = K.mix(c, '#e8f8ff', 0.55); g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.2;
        for (let k = 0; k < 3; ++k) { const a = k / 3 * Math.PI; g.beginPath(); g.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3); g.lineTo(s / 2 - Math.cos(a) * s * 0.3, s / 2 - Math.sin(a) * s * 0.3); g.stroke(); }
        g.strokeStyle = K.rgba(c, 0.9); g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
        break;
      }
      case 'bloom': {
        g.fillStyle = K.mix(c, '#ffe0f0', 0.4); g.fillRect(0, 0, s, s);
        for (let i = 0; i < 5; ++i) { const a = i / 5 * TAU; K.circle(g, s / 2 + Math.cos(a) * s * 0.18, s / 2 + Math.sin(a) * s * 0.18, s * 0.13, '#ffffff'); }
        K.circle(g, s / 2, s / 2, s * 0.1, '#ffd25a');
        g.strokeStyle = lo; g.lineWidth = 1.5; g.strokeRect(1, 1, s - 2, s - 2);
        break;
      }
      case 'sun': {
        const gr = g.createLinearGradient(0, 0, 0, s);
        gr.addColorStop(0, '#fff0a0'); gr.addColorStop(1, K.mix(c, '#ff9a3a', 0.4));
        g.fillStyle = gr; g.fillRect(0, 0, s, s);
        K.circle(g, s * 0.5, s * 0.5, s * 0.2, 'rgba(255,255,255,0.7)');
        g.strokeStyle = K.rgba(lo, 0.8); g.lineWidth = 1.5; g.strokeRect(1, 1, s - 2, s - 2);
        break;
      }
      case 'harvest': {
        g.fillStyle = K.mix(c, '#a0602a', 0.55); g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 1;
        for (let y = 3; y < s; y += 5) { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(s / 2, y + r.range(-2, 2), s, y); g.stroke(); }
        g.fillStyle = 'rgba(255,230,180,0.25)'; g.fillRect(0, 0, s, 2);
        break;
      }
      case 'hollow': {
        g.fillStyle = K.mix(c, '#ff8a1a', 0.5); K.roundRect(g, 1, 1, s - 2, s - 2, s * 0.25); g.fill();
        g.fillStyle = '#2a1030';
        g.beginPath(); g.moveTo(s * 0.25, s * 0.42); g.lineTo(s * 0.38, s * 0.3); g.lineTo(s * 0.45, s * 0.45); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(s * 0.75, s * 0.42); g.lineTo(s * 0.62, s * 0.3); g.lineTo(s * 0.55, s * 0.45); g.closePath(); g.fill();
        g.fillRect(s * 0.3, s * 0.62, s * 0.4, s * 0.1);
        break;
      }
      default: {
        /* gloss */
        const gr = g.createLinearGradient(0, 0, s, s);
        gr.addColorStop(0, hi); gr.addColorStop(0.5, c); gr.addColorStop(1, lo);
        K.roundRect(g, 1, 1, s - 2, s - 2, s * 0.16); g.fillStyle = gr; g.fill();
        g.strokeStyle = K.rgba(lo, 0.9); g.lineWidth = 1.5; g.stroke();
        K.roundRect(g, 3, 3, s - 6, s * 0.36, s * 0.12); g.fillStyle = 'rgba(255,255,255,0.32)'; g.fill();
      }
    }
  }

  function block(style, t, s) {
    return K.sprite('blk:' + style + ':' + t + ':' + s, s, s, (g) => paint(g, style, t, s));
  }

  function garbage(s) {
    return K.sprite('blk:garbage:' + s, s, s, (g) => {
      g.fillStyle = '#5a5e68'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#7a7e88'; g.fillRect(1, 1, s - 2, s * 0.25);
      g.fillStyle = '#3a3e48'; g.fillRect(1, s * 0.75, s - 2, s * 0.25 - 1);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * 0.3, s * 0.3); g.lineTo(s * 0.7, s * 0.7); g.moveTo(s * 0.7, s * 0.3); g.lineTo(s * 0.3, s * 0.7); g.stroke();
    });
  }

  function crystal(s) {
    return K.sprite('blk:crystal:' + s, s, s, (g) => {
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9ad8ff'); gr.addColorStop(1, '#4a7ad0');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(s / 2, 1); g.lineTo(s - 1, s / 2); g.lineTo(s / 2, s - 1); g.lineTo(1, s / 2); g.closePath(); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke();
    });
  }

  function orb(s) {
    return K.sprite('blk:orb:' + s, s, s, (g) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s * 0.42);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#ffe07a'); gr.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      K.circle(g, s / 2, s / 2, s * 0.16, '#fff8d0');
    });
  }

  function gemMark(s) {
    return K.sprite('blk:gem:' + s, s, s, (g) => {
      g.translate(s / 2, s / 2);
      g.fillStyle = '#ff7ad8';
      g.beginPath(); g.moveTo(-s * 0.3, -s * 0.08); g.lineTo(-s * 0.16, -s * 0.28); g.lineTo(s * 0.16, -s * 0.28); g.lineTo(s * 0.3, -s * 0.08); g.lineTo(0, s * 0.32); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.moveTo(-s * 0.3, -s * 0.08); g.lineTo(s * 0.3, -s * 0.08); g.lineTo(s * 0.16, -s * 0.28); g.lineTo(-s * 0.16, -s * 0.28); g.closePath(); g.fill();
    });
  }

  /* the bomb a Blast piece carries: a dark ball with a lit fuse */
  function bombMark(s) {
    return K.sprite('blk:bomb:' + s, s, s, (g) => {
      const r = s * 0.27;
      const gr = g.createRadialGradient(s * 0.42, s * 0.5, 1, s / 2, s * 0.56, r);
      gr.addColorStop(0, '#6a6a7a'); gr.addColorStop(1, '#0a0a12');
      g.fillStyle = gr; g.beginPath(); g.arc(s / 2, s * 0.56, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d0b070'; g.lineWidth = Math.max(1.5, s * 0.06);
      g.beginPath(); g.moveTo(s * 0.6, s * 0.34); g.quadraticCurveTo(s * 0.7, s * 0.14, s * 0.8, s * 0.2); g.stroke();
      K.circle(g, s * 0.8, s * 0.2, s * 0.08, '#ffd25a');
      K.circle(g, s * 0.8, s * 0.2, s * 0.04, '#ffffff');
    });
  }

  function ghost(t, s, bright) {
    return K.sprite('blk:ghost:' + t + ':' + s + ':' + (bright ? 1 : 0), s, s, (g) => {
      const c = base(t);
      g.fillStyle = K.rgba(c, bright ? 0.22 : 0.12); g.fillRect(1, 1, s - 2, s - 2);
      g.strokeStyle = K.rgba(c, bright ? 0.95 : 0.6); g.lineWidth = 2; g.strokeRect(2, 2, s - 4, s - 4);
    });
  }

  /* the sprite for a board cell code */
  function forCode(style, code, s) {
    if (code >= 1 && code <= 7) return block(style, TYPES[code - 1], s);
    if (code === 9) return crystal(s);
    return garbage(s);
  }

  Object.assign(NS.blocks, { bombMark, block, garbage, crystal, orb, gemMark, ghost, forCode });
})();
