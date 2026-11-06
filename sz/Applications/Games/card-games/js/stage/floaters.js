/* Floating texts the variants raise (same add/update/draw/clear interface as the
   shared FloatingText): small ones pop and rise, big ones (size >= 22) become a
   banner with a glow plate and a sparkle burst. Honours opts.size and opts.font. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;

  function sizeOf(opts) {
    if (opts.size) return opts.size;
    const m = /(\d+)px/.exec(opts.font || '');
    return m ? +m[1] : 15;
  }

  class Floaters {
    constructor() {
      this.items = [];
    }

    add(x, y, text, opts) {
      opts = opts || {};
      const size = sizeOf(opts);
      const big = size >= 22;
      if (this.items.length > 40) this.items.shift();
      const it = {
        x, y, text: String(text), color: opts.color || '#fff', size,
        big, t: 0, dur: big ? 2.0 : 1.3, vy: opts.vy != null ? opts.vy * 60 : (big ? -10 : -46)
      };
      this.items.push(it);
      if (big && NS.fx) {
        NS.fx.burst(x, y, { count: 18, speed: 180, color: it.color, gravity: 60, life: 0.8, size: 2.4 });
        NS.fx.ring(x, y, it.color, 70);
      }
    }

    update() {
      const dt = 1 / 60;
      for (let i = this.items.length - 1; i >= 0; --i) {
        const it = this.items[i];
        it.t += dt;
        it.y += it.vy * dt;
        if (it.t >= it.dur) this.items.splice(i, 1);
      }
    }

    clear() {
      this.items.length = 0;
    }

    draw(cx) {
      for (const it of this.items) {
        const p = it.t / it.dur;
        const inP = Math.min(1, it.t / 0.18);
        const pop = 1 + 0.35 * Math.sin(inP * Math.PI) * (1 - inP * 0.4);
        const alpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        cx.save();
        cx.globalAlpha = Math.max(0, alpha);
        cx.translate(Math.max(40, Math.min(K.CANVAS_W - 40, it.x)), it.y);
        cx.scale(pop * Math.min(1, inP * 1.5 + 0.3), pop * Math.min(1, inP * 1.5 + 0.3));
        const size = Math.max(11, it.size);
        cx.font = 'bold ' + size + 'px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
        cx.textAlign = 'center';
        cx.textBaseline = 'middle';
        if (it.big) {
          const w = cx.measureText(it.text).width + size * 1.6;
          const g = cx.createLinearGradient(-w / 2, 0, w / 2, 0);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.2, 'rgba(0,0,0,0.62)');
          g.addColorStop(0.8, 'rgba(0,0,0,0.62)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = g;
          cx.fillRect(-w / 2, -size * 0.85, w, size * 1.7);
          cx.fillStyle = it.color;
          cx.globalAlpha *= 0.8;
          cx.fillRect(-w * 0.32, -size * 0.85, w * 0.64, 1.5);
          cx.fillRect(-w * 0.32, size * 0.85 - 1.5, w * 0.64, 1.5);
          cx.globalAlpha /= 0.8;
        }
        cx.lineJoin = 'round';
        cx.lineWidth = Math.max(3, size * 0.18);
        cx.strokeStyle = 'rgba(0,0,0,0.85)';
        cx.strokeText(it.text, 0, 0);
        cx.fillStyle = it.color;
        cx.fillText(it.text, 0, 0);
        cx.restore();
      }
    }
  }

  NS.Floaters = Floaters;
})();
