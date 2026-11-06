/* Pooled particle layer for the suite: sparks, glows, confetti, coins, dust
   puffs, card-suit stars and shock rings. Glows come from cached radial sprites,
   so no shadowBlur is used per frame. All in board coordinates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const FX = NS.fx = NS.fx || {};

  const MAX = 900;
  const pool = [];
  const live = [];
  const rings = [];
  const glowCache = new Map();
  let seed = 9001;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const CONFETTI = ['#ffd54f', '#ff6f61', '#4fc3f7', '#81c784', '#ba68c8', '#ffffff', '#ff9800'];

  function glow(color) {
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      if (g) {
        const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.18, color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 32, 32);
      }
      glowCache.set(color, c);
    }
    return c;
  }
  FX.glowSprite = glow;

  function spawn() {
    if (live.length >= MAX) return null;
    const p = pool.pop() || {};
    live.push(p);
    p.vr = 0; p.rot = 0; p.drag = 0.985; p.gravity = 0; p.fade = 1; p.grow = 0; p.suit = null;
    return p;
  }

  FX.burst = function(x, y, o) {
    o = o || {};
    const n = o.count || 16;
    for (let i = 0; i < n; ++i) {
      const p = spawn();
      if (!p) return;
      const a = o.angle != null ? o.angle + (rnd() - 0.5) * (o.spread || 1) : rnd() * Math.PI * 2;
      const sp = (o.speed || 160) * (0.35 + rnd() * 0.75);
      p.kind = o.kind || 'spark';
      p.x = x + (rnd() - 0.5) * (o.jitter || 0);
      p.y = y + (rnd() - 0.5) * (o.jitter || 0);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.gravity = o.gravity != null ? o.gravity : 220;
      p.life = p.max = (o.life || 0.9) * (0.6 + rnd() * 0.6);
      p.size = (o.size || 3) * (0.6 + rnd() * 0.8);
      p.color = o.colors ? o.colors[Math.floor(rnd() * o.colors.length)] : (o.color || '#ffd54f');
      p.rot = rnd() * 6.28;
      p.vr = (rnd() - 0.5) * 14;
      p.drag = o.drag || 0.985;
      p.suit = o.suits ? o.suits[Math.floor(rnd() * o.suits.length)] : null;
    }
  };

  FX.sparkle = function(x, y, color) {
    FX.burst(x, y, { count: 14, color: color || '#ffe082', speed: 120, life: 0.7, gravity: 40, size: 2.4 });
  };

  /* a small felt puff where a card lands */
  FX.dust = function(x, y, w, h) {
    for (let i = 0; i < 6; ++i) {
      const p = spawn();
      if (!p) return;
      const side = i % 2 ? 1 : -1;
      p.kind = 'puff';
      p.x = x + (side > 0 ? w : 0) + (rnd() - 0.5) * 6;
      p.y = y + h * (0.7 + rnd() * 0.3);
      p.vx = side * (30 + rnd() * 40);
      p.vy = -10 - rnd() * 20;
      p.gravity = 0;
      p.drag = 0.9;
      p.life = p.max = 0.35 + rnd() * 0.2;
      p.size = 5 + rnd() * 4;
      p.grow = 18;
      p.color = 'rgba(255,255,255,0.18)';
    }
  };

  FX.confetti = function(x0, w, n) {
    for (let i = 0; i < (n || 120); ++i) {
      const p = spawn();
      if (!p) return;
      p.kind = 'confetti';
      p.x = x0 + rnd() * w;
      p.y = -20 - rnd() * 260;
      p.vx = (rnd() - 0.5) * 80;
      p.vy = 60 + rnd() * 120;
      p.gravity = 30;
      p.drag = 0.995;
      p.life = p.max = 3.2 + rnd() * 1.8;
      p.size = 4 + rnd() * 4;
      p.color = CONFETTI[Math.floor(rnd() * CONFETTI.length)];
      p.rot = rnd() * 6.28;
      p.vr = (rnd() - 0.5) * 10;
    }
  };

  FX.coins = function(x, y, n) {
    FX.burst(x, y, { count: n || 14, kind: 'coin', speed: 260, angle: -Math.PI / 2, spread: 1.6, gravity: 520, life: 1.3, size: 5, colors: ['#ffd54f', '#ffca28', '#ffe082'] });
  };

  FX.suits = function(x, y, n) {
    FX.burst(x, y, { count: n || 10, kind: 'suit', speed: 200, gravity: 120, life: 1.4, size: 9,
      suits: ['spades', 'hearts', 'diamonds', 'clubs'], colors: ['#ffd54f', '#ffffff', '#ff8a80'] });
  };

  FX.ring = function(x, y, color, size) {
    if (rings.length < 40) rings.push({ x, y, t: 0, dur: 0.55, color: color || '#ffd54f', size: size || 90 });
  };

  FX.clear = function() {
    while (live.length) pool.push(live.pop());
    rings.length = 0;
  };

  FX.count = () => live.length;

  FX.update = function(dt) {
    for (let i = live.length - 1; i >= 0; --i) {
      const p = live[i];
      p.life -= dt;
      if (p.life <= 0) {
        live[i] = live[live.length - 1];
        live.pop();
        pool.push(p);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.kind === 'confetti') p.vx += Math.sin(p.life * 3 + p.rot) * 20 * dt;
    }
    for (let i = rings.length - 1; i >= 0; --i) {
      rings[i].t += dt;
      if (rings[i].t >= rings[i].dur) rings.splice(i, 1);
    }
  };

  FX.draw = function(cx) {
    if (!live.length && !rings.length) return;
    cx.save();
    for (const r of rings) {
      const p = r.t / r.dur;
      cx.globalAlpha = (1 - p) * 0.8;
      cx.strokeStyle = r.color;
      cx.lineWidth = 4 * (1 - p) + 0.5;
      cx.beginPath();
      cx.arc(r.x, r.y, r.size * (0.2 + p), 0, Math.PI * 2);
      cx.stroke();
    }
    for (let i = 0; i < live.length; ++i) {
      const p = live[i];
      const a = Math.min(1, p.life / p.max * 1.6);
      cx.globalAlpha = a;
      switch (p.kind) {
        case 'confetti': {
          const sw = Math.abs(Math.cos(p.rot * 1.3));
          cx.fillStyle = p.color;
          cx.save();
          cx.translate(p.x, p.y);
          cx.rotate(p.rot);
          cx.fillRect(-p.size / 2, -p.size * 0.3 * sw, p.size, p.size * 0.6 * sw + 0.5);
          cx.restore();
          break;
        }
        case 'coin': {
          const sw = Math.abs(Math.cos(p.rot));
          cx.fillStyle = '#b8860b';
          cx.beginPath();
          cx.ellipse(p.x, p.y, p.size * sw + 0.6, p.size, 0, 0, Math.PI * 2);
          cx.fill();
          cx.fillStyle = p.color;
          cx.beginPath();
          cx.ellipse(p.x - 0.6, p.y - 0.6, (p.size - 1.2) * sw + 0.3, p.size - 1.2, 0, 0, Math.PI * 2);
          cx.fill();
          break;
        }
        case 'puff':
          cx.fillStyle = p.color;
          cx.beginPath();
          cx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          cx.fill();
          break;
        case 'suit':
          cx.save();
          cx.translate(p.x, p.y);
          cx.rotate(p.rot * 0.3);
          cx.drawImage(glow(p.color), -p.size * 1.6, -p.size * 1.6, p.size * 3.2, p.size * 3.2);
          cx.fillStyle = p.suit === 'hearts' || p.suit === 'diamonds' ? '#e53935' : '#1a1a1a';
          if (CE && CE.drawSuitSymbol) CE.drawSuitSymbol(cx, p.suit, 0, 0, p.size);
          cx.restore();
          break;
        default: {
          const s = p.size * 4;
          cx.drawImage(glow(p.color), p.x - s / 2, p.y - s / 2, s, s);
        }
      }
    }
    cx.restore();
  };
})();
