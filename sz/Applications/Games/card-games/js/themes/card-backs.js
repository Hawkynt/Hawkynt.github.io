;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION C: CARD BACK DESIGNS
   * ================================================================ */

  function _drawBackBase(cx, x, y, w, h, fillColor) {
    const cr = CE.CARD_RADIUS * Math.min(w / CE.CARD_W, h / CE.CARD_H);
    CE.drawRoundedRect(cx, x, y, w, h, cr);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const m = 3;
    CE.drawRoundedRect(cx, x + m, y + m, w - m * 2, h - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = fillColor;
    cx.fill();
    return { m, cr };
  }

  CT.CARD_BACK_DESIGNS = {
    navy_diamonds: {
      name: 'Navy Diamonds',
      preview: '#1a237e',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
        CE.drawRoundedRect(cx, x, y, cw, ch, cr);
        cx.fillStyle = '#fff';
        cx.fill();
        cx.strokeStyle = '#333';
        cx.lineWidth = 1;
        cx.stroke();

        const m = 3;
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.fillStyle = '#1a237e';
        cx.fill();

        cx.strokeStyle = '#3949ab';
        cx.lineWidth = 0.5;
        const step = 8;
        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();
        for (let dy = y + m; dy < y + ch - m; dy += step) {
          for (let dx = x + m; dx < x + cw - m; dx += step) {
            const cx2 = dx + step / 2;
            const cy2 = dy + step / 2;
            cx.beginPath();
            cx.moveTo(cx2, cy2 - step / 2 + 1);
            cx.lineTo(cx2 + step / 2 - 1, cy2);
            cx.lineTo(cx2, cy2 + step / 2 - 1);
            cx.lineTo(cx2 - step / 2 + 1, cy2);
            cx.closePath();
            cx.stroke();
          }
        }
        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#c5cae9';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    red_tartan: {
      name: 'Red Tartan',
      preview: '#8b1a1a',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#8b1a1a');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(200, 50, 50, 0.4)';
        cx.lineWidth = 2;
        const step = 10;
        for (let dy = y + m; dy < y + ch; dy += step) {
          cx.beginPath();
          cx.moveTo(x + m, dy);
          cx.lineTo(x + cw - m, dy);
          cx.stroke();
        }
        for (let dx = x + m; dx < x + cw; dx += step) {
          cx.beginPath();
          cx.moveTo(dx, y + m);
          cx.lineTo(dx, y + ch - m);
          cx.stroke();
        }
        cx.strokeStyle = 'rgba(255, 200, 100, 0.2)';
        cx.lineWidth = 1;
        for (let dy = y + m + 5; dy < y + ch; dy += step) {
          cx.beginPath();
          cx.moveTo(x + m, dy);
          cx.lineTo(x + cw - m, dy);
          cx.stroke();
        }
        for (let dx = x + m + 5; dx < x + cw; dx += step) {
          cx.beginPath();
          cx.moveTo(dx, y + m);
          cx.lineTo(dx, y + ch - m);
          cx.stroke();
        }
        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#e57373';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    green_classic: {
      name: 'Green Classic',
      preview: '#1b5e20',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#1b5e20');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        cx.lineWidth = 1.5;
        const inset = 8;
        CE.drawRoundedRect(cx, x + m + inset, y + m + inset, cw - m * 2 - inset * 2, ch - m * 2 - inset * 2, 3);
        cx.stroke();
        CE.drawRoundedRect(cx, x + m + inset + 3, y + m + inset + 3, cw - m * 2 - inset * 2 - 6, ch - m * 2 - inset * 2 - 6, 2);
        cx.stroke();

        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#81c784';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    royal_gold: {
      name: 'Royal Gold',
      preview: '#b8860b',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#b8860b');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255, 223, 100, 0.35)';
        cx.lineWidth = 0.5;
        const step = 12;
        for (let dy = y + m; dy < y + ch; dy += step) {
          for (let dx = x + m; dx < x + cw; dx += step) {
            const mx = dx + step / 2;
            const my = dy + step / 2;
            cx.beginPath();
            cx.moveTo(mx, my - step / 2 + 1);
            cx.lineTo(mx + step / 2 - 1, my);
            cx.lineTo(mx, my + step / 2 - 1);
            cx.lineTo(mx - step / 2 + 1, my);
            cx.closePath();
            cx.stroke();
          }
        }

        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#ffd54f';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    custom: {
      name: 'Custom Color',
      preview: '#1a237e',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const color = CT.activeTheme.customBackColor;
        const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
        CE.drawRoundedRect(cx, x, y, cw, ch, cr);
        cx.fillStyle = '#fff';
        cx.fill();
        cx.strokeStyle = '#333';
        cx.lineWidth = 1;
        cx.stroke();

        const m = 3;
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.fillStyle = color;
        cx.fill();

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255,255,255,0.18)';
        cx.lineWidth = 0.5;
        const step = 8;
        for (let dy = y + m; dy < y + ch - m; dy += step) {
          for (let dx = x + m; dx < x + cw - m; dx += step) {
            const cx2 = dx + step / 2;
            const cy2 = dy + step / 2;
            cx.beginPath();
            cx.moveTo(cx2, cy2 - step / 2 + 1);
            cx.lineTo(cx2 + step / 2 - 1, cy2);
            cx.lineTo(cx2, cy2 + step / 2 - 1);
            cx.lineTo(cx2 - step / 2 + 1, cy2);
            cx.closePath();
            cx.stroke();
          }
        }
        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = 'rgba(255,255,255,0.4)';
        cx.lineWidth = 1;
        cx.stroke();
      }
    }
  };

})();
