/* Cinematics and result screens: the suite intro (riffle shuffle, fan, title),
   the title card when a game starts, the victory / defeat scene with the XP
   tally, level-up medallions and the toast queue. All skippable by click/key. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const PA = NS.paint;
  const FX = NS.fx;
  const SC = NS.scenes = NS.scenes || {};

  const W = K.CANVAS_W, H = K.CANVAS_H;
  const queue = [];
  const toasts = [];
  let cur = null;
  let time = 0;
  let seed = 4242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const sound = (n, o) => { if (SZ.GameAudio) SZ.GameAudio.play(n, o); };

  SC.active = () => cur;
  SC.blocking = () => !!cur && cur.blocking;
  SC.freezesGame = () => !!cur && cur.freeze;

  function start(s) {
    s.t = 0;
    cur = s;
    if (s.onStart) s.onStart();
  }

  SC.push = function(s) {
    if (!cur) start(s);
    else queue.push(s);
  };

  function finish() {
    const done = cur;
    cur = null;
    if (done && done.onEnd) done.onEnd();
    if (queue.length) start(queue.shift());
  }

  SC.skip = function() {
    if (!cur) return false;
    if (cur.minTime && cur.t < cur.minTime) return true;
    if (cur.skipTo && cur.t < cur.skipTo) { cur.t = cur.skipTo; return true; }
    finish();
    return true;
  };

  SC.clear = function() {
    queue.length = 0;
    cur = null;
  };

  SC.toast = function(title, sub, icon, color) {
    toasts.push({ title, sub, icon: icon || '★', color: color || '#ffd54f', t: 0 });
    if (toasts.length > 6) toasts.shift();
  };

  SC.update = function(dt) {
    time += dt;
    if (cur) {
      cur.t += dt;
      if (cur.tick) cur.tick(dt);
      if (cur.dur && cur.t >= cur.dur) finish();
    }
    if (toasts.length) {
      toasts[0].t += dt;
      if (toasts[0].t >= 3.2) toasts.shift();
      else if (toasts[0].t < dt + 0.001) sound('powerup', { volume: 0.45 });
    }
  };

  SC.draw = function(cx, ext) {
    if (cur && cur.draw) cur.draw(cx, ext, cur.t);
    drawToast(cx);
  };

  /* ════════════ toast ════════════ */
  function drawToast(cx) {
    const t = toasts[0];
    if (!t) return;
    const inP = PA.clamp01(t.t / 0.35), outP = PA.clamp01((t.t - 2.8) / 0.4);
    const y = -70 + 114 * PA.ease.back(inP) - 120 * outP;
    const w = 300, x = W - w - 14;
    PA.panel(cx, x, y, w, 58, { radius: 10 });
    cx.save();
    cx.beginPath();
    cx.arc(x + 30, y + 29, 18, 0, Math.PI * 2);
    cx.fillStyle = 'rgba(0,0,0,0.45)';
    cx.fill();
    cx.strokeStyle = t.color;
    cx.lineWidth = 2;
    cx.stroke();
    PA.text(cx, t.icon, x + 30, y + 30, 18, t.color, { serif: true });
    PA.text(cx, t.title, x + 58, y + 21, 14, t.color, { align: 'left' });
    PA.text(cx, t.sub, x + 58, y + 40, 11, '#e8dcc0', { align: 'left', weight: 'normal' });
    cx.restore();
  }

  /* ════════════ intro ════════════ */
  const FAN = ['A', 'K', 'Q', 'J', '10'];
  const FAN_SUITS = ['spades', 'hearts', 'clubs', 'diamonds', 'spades'];

  SC.intro = function(onEnd) {
    const fanCards = FAN.map((r, i) => ({ rank: r, suit: FAN_SUITS[i], faceUp: true }));
    let shuffleSound = 0;
    SC.push({
      type: 'intro', dur: 5.0, freeze: true, blocking: true, skipTo: 0,
      onEnd,
      tick(dt) {
        const t = this.t;
        if (t > 0.5 && t < 1.9) {
          shuffleSound -= dt;
          if (shuffleSound <= 0) { sound('click', { pitch: 1.4 + rnd() * 0.4, volume: 0.35 }); shuffleSound = 0.06; }
        }
        if (t > 2.05 && !this.fanned) { this.fanned = true; sound('whoosh', { volume: 0.6 }); }
        if (t > 2.75 && !this.titled) { this.titled = true; sound('levelup', { volume: 0.5 }); FX.burst(W / 2, H * 0.62, { count: 40, speed: 260, colors: ['#ffe082', '#fff', '#ffca28'], gravity: 60, life: 1.2, size: 2.6 }); }
      },
      draw(cx, ext, t) {
        const fadeOut = PA.clamp01((t - 4.4) / 0.6);
        cx.save();
        cx.globalAlpha = 1 - fadeOut;
        cx.fillStyle = '#05070a';
        cx.fillRect(ext.x, ext.y, ext.w, ext.h);
        /* spotlight */
        const light = PA.clamp01(t / 0.7);
        const g = cx.createRadialGradient(W / 2, H * 0.48, 10, W / 2, H * 0.5, 420);
        g.addColorStop(0, 'rgba(40,110,60,' + (0.95 * light) + ')');
        g.addColorStop(0.6, 'rgba(14,50,24,' + (0.8 * light) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g;
        cx.fillRect(ext.x, ext.y, ext.w, ext.h);

        const cw = 80, ch = 110;
        const cxm = W / 2 - cw / 2, cym = H * 0.42 - ch / 2;
        /* riffle: two halves arc into the middle */
        if (t < 2.1) {
          const p = PA.clamp01((t - 0.45) / 1.4);
          const n = 16;
          for (let i = 0; i < n; ++i) {
            const k = i / n;
            const done = p > k;
            const side = i % 2 ? 1 : -1;
            const lp = done ? PA.clamp01((p - k) * 6) : 0;
            const sx = cxm + side * 120 * (1 - lp);
            const sy = cym - Math.sin(lp * Math.PI) * 40 - (done ? i * 0.6 : (i >> 1) * 0.6);
            cx.save();
            cx.translate(sx + cw / 2, sy + ch / 2);
            cx.rotate(side * 0.25 * (1 - lp));
            CE.paintCardShadow(cx, -cw / 2 + 1, -ch / 2 + 2, cw, ch);
            CE.paintCardBack(cx, -cw / 2, -ch / 2, cw, ch);
            cx.restore();
          }
        } else {
          /* fan the five royal cards out of the deck */
          const p = PA.ease.back(PA.clamp01((t - 2.05) / 0.7));
          CE.paintCardShadow(cx, cxm + 1, cym + 12, cw, ch);
          CE.paintCardBack(cx, cxm, cym + 10, cw, ch);
          for (let i = 0; i < fanCards.length; ++i) {
            const a = (i - 2) * 0.32 * p;
            cx.save();
            cx.translate(W / 2, cym + ch + 60);
            cx.rotate(a);
            const y = -ch - 60 - 18 * p;
            CE.paintCardShadow(cx, -cw / 2 + 2, y + 3, cw, ch);
            CE.paintCardFace(cx, -cw / 2, y, fanCards[i], cw, ch);
            cx.restore();
          }
        }
        /* title */
        if (t > 2.6) {
          const p = PA.clamp01((t - 2.6) / 0.5);
          cx.save();
          cx.globalAlpha *= p;
          const s = 0.85 + 0.15 * PA.ease.back(p);
          cx.translate(W / 2, H * 0.73);
          cx.scale(s, s);
          PA.goldText(cx, 'Card Games Suite', 0, 0, 52, { shine: PA.clamp01((t - 3.0) / 0.9) });
          cx.restore();
          cx.globalAlpha = (1 - fadeOut) * PA.clamp01((t - 3.1) / 0.5);
          PA.text(cx, '72 classic games  ·  one table', W / 2, H * 0.73 + 44, 16, '#e8dcc0', { serif: true, weight: 'italic' });
        }
        cx.restore();
        if (t > 0.4 && t < 4.3) {
          cx.save();
          cx.globalAlpha = 0.5;
          PA.text(cx, 'click to skip', ext.x + ext.w - 60, ext.y + ext.h - 16, 11, '#9a9080', { weight: 'normal' });
          cx.restore();
        }
      }
    });
  };

  /* ════════════ title card when a game starts ════════════ */
  SC.gameTitle = function(variant, category, onEnd) {
    const col = category ? category.color : '#2a6a2a';
    SC.push({
      type: 'title', dur: 1.9, freeze: true, blocking: true,
      onEnd,
      onStart() { sound('whoosh', { volume: 0.55 }); },
      draw(cx, ext, t) {
        const inP = PA.ease.out(PA.clamp01(t / 0.35));
        const outP = PA.ease.inOut(PA.clamp01((t - 1.45) / 0.45));
        cx.save();
        cx.fillStyle = 'rgba(0,0,0,' + (0.55 * (1 - outP)) + ')';
        cx.fillRect(ext.x, ext.y, ext.w, ext.h);
        const bandH = 128;
        const by = H / 2 - bandH / 2;
        const shift = (1 - inP) * -ext.w + outP * ext.w;
        cx.translate(shift, 0);
        const g = cx.createLinearGradient(0, by, 0, by + bandH);
        g.addColorStop(0, 'rgba(0,0,0,0.0)');
        g.addColorStop(0.12, CE.art.shade(col, -0.35));
        g.addColorStop(0.5, CE.art.shade(col, 0.05));
        g.addColorStop(0.88, CE.art.shade(col, -0.35));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g;
        cx.fillRect(ext.x, by, ext.w, bandH);
        cx.strokeStyle = 'rgba(255,215,120,0.75)';
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(ext.x, by + 12); cx.lineTo(ext.x + ext.w, by + 12);
        cx.moveTo(ext.x, by + bandH - 12); cx.lineTo(ext.x + ext.w, by + bandH - 12);
        cx.stroke();
        /* emblem medallion */
        const ex = 190, ey = H / 2;
        cx.beginPath();
        cx.arc(ex, ey, 40, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(0,0,0,0.45)';
        cx.fill();
        cx.strokeStyle = '#ffd54f';
        cx.lineWidth = 2.5;
        cx.stroke();
        PA.emblem(cx, category ? category.name : '', ex, ey, 2.0, '#ffd54f');
        const nameSize = PA.fitText(cx, variant.name, 560, 46, 'bold', true);
        PA.goldText(cx, variant.name, 250, H / 2 - 14, nameSize, { align: 'left', shine: PA.clamp01((t - 0.3) / 0.9) });
        PA.text(cx, variant.desc || '', 252, H / 2 + 28, 15, '#f3e6c8', { align: 'left', weight: 'italic', serif: true });
        PA.text(cx, (category ? category.name.toUpperCase() : ''), 252, H / 2 - 50, 11, '#ffd54f', { align: 'left' });
        cx.restore();
      }
    });
  };

  /* ════════════ victory / defeat ════════════ */
  SC.result = function(variant, reward, full, onEnd) {
    const win = reward.outcome === 'win';
    const draw = reward.outcome === 'draw';
    if (win) {
      FX.confetti(-60, W + 120, full ? 160 : 60);
      sound('win', { volume: 0.8 });
    } else sound(draw ? 'drop' : 'lose', { volume: 0.6 });
    if (!full) {
      SC.push({
        type: 'round', dur: 2.2, freeze: false, blocking: false,
        onEnd,
        draw(cx, ext, t) {
          const p = PA.clamp01(t / 0.3), q = PA.clamp01((t - 1.8) / 0.4);
          const y = 64 - 20 * (1 - PA.ease.back(p)) - 40 * q;
          cx.save();
          cx.globalAlpha = 1 - q;
          const label = win ? 'Round won' : draw ? 'Round drawn' : 'Round lost';
          PA.ribbon(cx, W / 2 - 120, y, 240, 34, win ? '#2e7d32' : draw ? '#455a64' : '#7b1f1f');
          PA.text(cx, label + '   +' + reward.xp + ' XP', W / 2, y + 17, 15, '#fff4d6', { serif: true });
          cx.restore();
        }
      });
      return;
    }
    let lastCount = -1;
    SC.push({
      type: 'result', dur: 0, freeze: true, blocking: true, minTime: 0.6, skipTo: 2.2,
      onEnd,
      tick() {
        if (win && this.t > 0.2 && rnd() < 0.05)
          FX.burst(80 + rnd() * (W - 160), 80 + rnd() * 200, { count: 26, speed: 220, colors: ['#ffd54f', '#ff8a65', '#81d4fa', '#ffffff'], gravity: 90, life: 1.1, size: 2.4 });
        const shown = Math.floor(PA.clamp01((this.t - 0.6) / 1.2) * reward.lines.length);
        if (shown !== lastCount) { lastCount = shown; if (shown > 0) sound('coin', { volume: 0.4, pitch: 1 + shown * 0.08 }); }
      },
      draw(cx, ext, t) {
        const p = PA.ease.out(PA.clamp01(t / 0.45));
        cx.save();
        cx.fillStyle = 'rgba(0,0,0,' + (0.62 * p) + ')';
        cx.fillRect(ext.x, ext.y, ext.w, ext.h);
        if (win) PA.rays(cx, W / 2, 150, 420 * p, t, 'rgba(255,214,110,0.32)', 18);
        const s = 0.6 + 0.4 * PA.ease.back(PA.clamp01(t / 0.5));
        cx.translate(W / 2, 140);
        cx.scale(s, s);
        PA.goldText(cx, win ? 'VICTORY' : draw ? 'DRAW' : 'DEFEAT', 0, 0, 64,
          win ? { shine: PA.clamp01((t - 0.4) / 1) } : { colors: draw ? ['#eceff1', '#b0bec5', '#78909c', '#cfd8dc'] : ['#ffcdd2', '#e57373', '#8e2424', '#ef9a9a'] });
        cx.restore();
        cx.save();
        cx.globalAlpha = p;
        PA.text(cx, variant.name, W / 2, 196, 18, '#f3e6c8', { serif: true, weight: 'italic' });
        if (!win && !draw) PA.text(cx, 'Every hand is a new chance — the cards will turn.', W / 2, 222, 13, '#bfb5a0', { weight: 'normal' });

        /* XP tally */
        const px = W / 2 - 200, py = 250;
        PA.panel(cx, px, py, 400, 60 + reward.lines.length * 24, { radius: 12 });
        const shown = PA.clamp01((t - 0.6) / 1.2) * reward.lines.length;
        for (let i = 0; i < reward.lines.length; ++i) {
          const a = PA.clamp01(shown - i);
          if (a <= 0) break;
          cx.globalAlpha = p * a;
          const ly = py + 24 + i * 24;
          PA.text(cx, reward.lines[i][0], px + 22, ly, 14, '#e8dcc0', { align: 'left', weight: 'normal' });
          PA.text(cx, '+' + reward.lines[i][1] + ' XP', px + 378, ly, 14, '#ffd54f', { align: 'right' });
        }
        cx.globalAlpha = p;
        const by = py + 30 + reward.lines.length * 24;
        const fill = PA.clamp01((t - 1.8) / 0.9);
        const b = reward.before, a = reward.after;
        let frac;
        if (a.level > b.level) frac = fill < 0.5 ? b.xp / b.need + (1 - b.xp / b.need) * fill * 2 : a.xp / a.need * (fill - 0.5) * 2;
        else frac = (b.xp + (a.xp - b.xp) * fill) / a.need;
        PA.text(cx, 'Lv ' + (fill >= 0.5 && a.level > b.level ? a.level : b.level), px + 22, by + 8, 13, '#ffd54f', { align: 'left' });
        PA.bar(cx, px + 70, by, 308, 16, frac);
        if (reward.streak > 1 && win) {
          const fl = 0.8 + 0.2 * Math.sin(t * 9);
          PA.text(cx, '♨ ' + reward.streak + ' win streak', W / 2, py - 14, 15, 'rgb(255,' + Math.round(140 * fl) + ',60)');
        }
        if (t > 2.2) {
          cx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
          PA.text(cx, 'Click to continue', W / 2, H - 46, 14, '#f3e6c8', { weight: 'normal' });
        }
        cx.restore();
      }
    });
  };

  /* ════════════ level up ════════════ */
  SC.levelUp = function(level, unlocks) {
    SC.push({
      type: 'level', dur: 0, freeze: true, blocking: true, minTime: 0.5, skipTo: 1.0,
      onStart() {
        sound('levelup', { volume: 0.8 });
        FX.ring(W / 2, H / 2 - 30, '#ffd54f', 160);
        FX.suits(W / 2, H / 2 - 30, 18);
      },
      draw(cx, ext, t) {
        const p = PA.ease.back(PA.clamp01(t / 0.55));
        cx.save();
        cx.fillStyle = 'rgba(0,0,0,' + (0.6 * PA.clamp01(t / 0.3)) + ')';
        cx.fillRect(ext.x, ext.y, ext.w, ext.h);
        PA.rays(cx, W / 2, H / 2 - 30, 330, t, 'rgba(255,214,110,0.35)', 16);
        cx.translate(W / 2, H / 2 - 30);
        cx.scale(p, p);
        cx.beginPath();
        cx.arc(0, 0, 74, 0, Math.PI * 2);
        const g = cx.createRadialGradient(-20, -24, 6, 0, 0, 74);
        g.addColorStop(0, '#fff3c0');
        g.addColorStop(0.5, '#e0a526');
        g.addColorStop(1, '#7a520c');
        cx.fillStyle = g;
        cx.fill();
        cx.lineWidth = 4;
        cx.strokeStyle = '#fff3c0';
        cx.stroke();
        cx.beginPath();
        cx.arc(0, 0, 60, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(90,60,10,0.6)';
        cx.lineWidth = 2;
        cx.stroke();
        PA.text(cx, 'LEVEL', 0, -24, 15, '#5a3a06', { shadow: false });
        PA.text(cx, String(level), 0, 12, 46, '#4a2e04', { serif: true, shadow: false });
        cx.restore();
        cx.save();
        cx.globalAlpha = PA.clamp01((t - 0.4) / 0.4);
        PA.goldText(cx, 'Level up!', W / 2, H / 2 + 80, 34, { shine: PA.clamp01((t - 0.6) / 0.8) });
        let ly = H / 2 + 116;
        for (const u of unlocks || []) {
          PA.text(cx, 'Unlocked: ' + u, W / 2, ly, 14, '#e8dcc0', { weight: 'normal' });
          ly += 20;
        }
        if (t > 1.0) {
          cx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
          PA.text(cx, 'Click to continue', W / 2, H - 40, 14, '#f3e6c8', { weight: 'normal' });
        }
        cx.restore();
      }
    });
  };
})();
