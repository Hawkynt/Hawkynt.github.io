/* Painted, cached sprites: every brick kind (glossy colour bricks, riveted steel, heavy titan,
   glass with a glare, walls, bombs with a fuse, regrowing vines, gold targets, crystals) with
   crack overlays for damage, paddles per collection style (energy field, metal, gem, prism,
   pixel) built from a stretchable body and two emitter caps, balls per skin with a glow, the
   power-up capsules with their icons, guardian shots and laser bolts. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const K = NS.artKit;
  const C = NS.constants;
  const { BRICK_W, BRICK_H, TAU, BRICKS } = C;

  function brick(ch, w, h) {
    w = w || BRICK_W;
    h = h || BRICK_H;
    return K.sprite('brick:' + ch + ':' + w + ':' + h, w, h, (g) => {
      const d = BRICKS[ch];
      const c = d.color;
      const hi = K.shade(c, 0.35), lo = K.shade(c, -0.4);
      const k = d.kind;
      if (k === 'wall') {
        g.fillStyle = '#241a36'; g.fillRect(1, 1, w - 2, h - 2);
        g.strokeStyle = '#7a5aa8'; g.lineWidth = 1.5; g.strokeRect(2, 2, w - 4, h - 4);
        g.strokeStyle = 'rgba(160,120,220,0.35)'; g.beginPath(); g.moveTo(4, 4); g.lineTo(w - 4, h - 4); g.moveTo(w - 4, 4); g.lineTo(4, h - 4); g.stroke();
        return;
      }
      if (k === 'glass') {
        g.fillStyle = 'rgba(200,244,255,0.28)'; g.fillRect(1, 1, w - 2, h - 2);
        g.strokeStyle = 'rgba(230,252,255,0.9)'; g.lineWidth = 1.5; g.strokeRect(1.5, 1.5, w - 3, h - 3);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(6, 2); g.lineTo(16, 2); g.lineTo(8, h - 2); g.lineTo(2, h - 2); g.closePath(); g.fill();
        return;
      }
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, hi); gr.addColorStop(0.5, c); gr.addColorStop(1, lo);
      K.roundRect(g, 1, 1, w - 2, h - 2, 4); g.fillStyle = gr; g.fill();
      g.strokeStyle = K.rgba(lo, 0.9); g.lineWidth = 1; g.stroke();
      K.roundRect(g, 3, 2, w - 6, h * 0.35, 3); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill();
      if (k === 'steel' || k === 'titan') {
        for (const x of [5, w - 5]) for (const y of [5, h - 5]) K.circle(g, x, y, 1.6, 'rgba(255,255,255,0.7)');
        if (k === 'titan') { g.strokeStyle = 'rgba(20,30,50,0.6)'; g.lineWidth = 2; g.strokeRect(6, 5, w - 12, h - 10); }
      } else if (k === 'bomb') {
        K.circle(g, w / 2, h / 2 + 1, h * 0.3, '#2a1010');
        g.strokeStyle = '#ffd25a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2 + 3, h / 2 - 4); g.quadraticCurveTo(w / 2 + 8, 2, w / 2 + 11, 4); g.stroke();
        K.circle(g, w / 2 + 11, 4, 2, '#fff4a0');
      } else if (k === 'regen') {
        g.strokeStyle = 'rgba(20,90,50,0.7)'; g.lineWidth = 1.5;
        g.beginPath(); for (let x = 2; x < w; x += 4) g.lineTo(x, h / 2 + Math.sin(x * 0.5) * 4); g.stroke();
        for (let x = 8; x < w; x += 12) K.circle(g, x, h / 2 + Math.sin(x * 0.5) * 4, 2.4, '#c8ffd8');
      } else if (k === 'gold') {
        g.fillStyle = '#fff8d0'; K.star(g, w / 2, h / 2, h * 0.36, 0.45, 5); g.fill();
      } else if (k === 'crystal') {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.beginPath(); g.moveTo(w / 2, 3); g.lineTo(w / 2 + 6, h / 2); g.lineTo(w / 2, h - 3); g.lineTo(w / 2 - 6, h / 2); g.closePath(); g.fill();
      }
    });
  }

  function crack(n, w, h) {
    return K.sprite('crack:' + n + ':' + w + ':' + h, w, h, (g) => {
      g.strokeStyle = 'rgba(10,10,20,0.75)';
      g.lineWidth = 1.4;
      const r = NS.rng.makeRng(31 + n);
      for (let k = 0; k < n; ++k) {
        let x = r.range(8, w - 8), y = 2;
        g.beginPath(); g.moveTo(x, y);
        while (y < h - 2) { x += r.range(-6, 6); y += r.range(3, 7); g.lineTo(x, y); }
        g.stroke();
      }
    });
  }

  /* paddle parts: a 64 px body to stretch and a cap */
  function paddleBody(def) {
    return K.sprite('pbody:' + def.id, 64, C.PADDLE_H, (g) => {
      const h = C.PADDLE_H;
      if (def.style === 'field') {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, K.rgba(def.accent, 0.95)); gr.addColorStop(0.5, K.rgba(def.color, 0.85)); gr.addColorStop(1, K.rgba(def.color, 0.3));
        g.fillStyle = gr; g.fillRect(0, 3, 64, h - 6);
        g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h / 2); for (let x = 0; x <= 64; x += 4) g.lineTo(x, h / 2 + ((x / 4) % 2 ? -2 : 2)); g.stroke();
      } else if (def.style === 'metal') {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, def.color); gr.addColorStop(1, K.shade(def.color, -0.5));
        g.fillStyle = gr; g.fillRect(0, 1, 64, h - 2);
        g.fillStyle = K.rgba(def.accent, 0.5); g.fillRect(0, h / 2 - 1, 64, 2);
      } else if (def.style === 'gem') {
        g.fillStyle = K.shade(def.color, 0.2); g.fillRect(0, 1, 64, h / 2);
        g.fillStyle = K.shade(def.color, -0.3); g.fillRect(0, h / 2, 64, h / 2 - 1);
        g.fillStyle = 'rgba(255,255,255,0.4)'; for (let x = 0; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x + 8, h / 2); g.lineTo(x + 16, 1); g.closePath(); g.fill(); }
      } else if (def.style === 'prism') {
        const gr = g.createLinearGradient(0, 0, 64, 0);
        ['#ff6a8a', '#ffd25a', '#7be08a', '#5ad0ff', '#c08aff'].forEach((c, i) => gr.addColorStop(i / 4, c));
        g.fillStyle = gr; g.fillRect(0, 2, 64, h - 4);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 2, 64, 4);
      } else {
        g.fillStyle = def.color; g.fillRect(0, 2, 64, h - 4);
        g.fillStyle = def.accent; g.fillRect(0, 2, 64, 3);
        g.fillStyle = K.shade(def.color, -0.4); g.fillRect(0, h - 5, 64, 3);
      }
    });
  }

  function paddleCap(def) {
    return K.sprite('pcap:' + def.id, 20, 24, (g) => {
      const gr = g.createRadialGradient(9, 10, 1, 10, 12, 11);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, def.accent); gr.addColorStop(1, K.shade(def.color, -0.4));
      g.fillStyle = gr;
      g.beginPath(); g.arc(10, 12, 9, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.stroke();
    });
  }

  function ball(def, r) {
    const s = Math.ceil(r * 4);
    return K.sprite('ball:' + def.id + ':' + r, s, s, (g) => {
      const c = s / 2;
      const glow = g.createRadialGradient(c, c, r * 0.6, c, c, r * 2);
      glow.addColorStop(0, K.rgba(def.color, 0.5)); glow.addColorStop(1, K.rgba(def.color, 0));
      g.fillStyle = glow; g.fillRect(0, 0, s, s);
      const gr = g.createRadialGradient(c - r * 0.35, c - r * 0.35, 1, c, c, r);
      gr.addColorStop(0, def.core); gr.addColorStop(0.6, def.color); gr.addColorStop(1, K.shade(def.color, -0.4));
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
      if (def.id === 'eye') { K.circle(g, c, c, r * 0.4, '#ffe0a0'); K.circle(g, c, c, r * 0.2, '#1a0a0a'); }
      if (def.id === 'void') { g.strokeStyle = '#c08aff'; g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, r * 0.8, 0, TAU); g.stroke(); }
      K.circle(g, c - r * 0.35, c - r * 0.35, r * 0.25, 'rgba(255,255,255,0.85)');
    });
  }

  function fireBall(r) {
    const s = Math.ceil(r * 4);
    return K.sprite('fireball:' + r, s, s, (g) => {
      const c = s / 2;
      const gr = g.createRadialGradient(c, c, 1, c, c, r * 1.8);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#ffd25a'); gr.addColorStop(0.6, '#ff6a1a'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
  }

  function capsule(id) {
    const p = C.POWER_BY_ID[id];
    return K.sprite('cap:' + id, C.DROP_W + 8, C.DROP_H + 8, (g) => {
      const w = C.DROP_W, h = C.DROP_H;
      g.translate(4, 4);
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, K.shade(p.color, 0.4)); gr.addColorStop(0.5, p.color); gr.addColorStop(1, K.shade(p.color, -0.4));
      K.roundRect(g, 0, 0, w, h, h / 2); g.fillStyle = gr; g.fill();
      g.strokeStyle = p.good ? '#ffffff' : '#2a1a1a'; g.lineWidth = 1.5; g.stroke();
      K.roundRect(g, 4, 2, w - 8, h * 0.35, h * 0.2); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fill();
      g.save();
      g.translate(w / 2, h / 2);
      g.scale(0.6, 0.6);
      NS.kit.paintIcon(g, p.icon, p.good ? '#ffffff' : '#2a1a1a');
      g.restore();
    });
  }

  function shot(kind) {
    return K.sprite('shot:' + kind, 20, 20, (g) => {
      const col = { seed: '#7be08a', ice: '#bfe8ff', bolt: '#ffd25a', ink: '#6a3ac0', void: '#c08aff' }[kind] || '#ff5a5a';
      const gr = g.createRadialGradient(10, 10, 1, 10, 10, 9);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, col); gr.addColorStop(1, K.rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 20, 20);
    });
  }

  Object.assign(NS.sprites, { brick, crack, paddleBody, paddleCap, ball, fireBall, capsule, shot });
})();
