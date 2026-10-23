;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION B: TABLE THEMES
   * ================================================================ */

  CT.TABLE_THEMES = {
    green: {
      name: 'Classic Green',
      preview: '#1a4a1a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#1a4a1a');
        grad.addColorStop(0.85, '#0e350e');
        grad.addColorStop(1, '#0a2a0a');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    blue: {
      name: 'Midnight Blue',
      preview: '#0d1b3e',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#1a2d5a');
        grad.addColorStop(0.85, '#0d1b3e');
        grad.addColorStop(1, '#081228');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    red: {
      name: 'Casino Red',
      preview: '#5a1a1a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#5a1a1a');
        grad.addColorStop(0.85, '#3e0d0d');
        grad.addColorStop(1, '#280808');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    wood: {
      name: 'Oak Table',
      preview: '#6b4226',
      draw(cx, w, h) {
        cx.fillStyle = '#6b4226';
        cx.fillRect(0, 0, w, h);
        cx.strokeStyle = 'rgba(90, 55, 20, 0.3)';
        cx.lineWidth = 1;
        for (let y = 0; y < h; y += 3) {
          cx.beginPath();
          cx.moveTo(0, y);
          for (let x = 0; x < w; x += 10)
            cx.lineTo(x, y + Math.sin(x * 0.02 + y * 0.1) * 2);
          cx.stroke();
        }
        const vig = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.35)');
        cx.fillStyle = vig;
        cx.fillRect(0, 0, w, h);
      }
    },
    marble: {
      name: 'White Marble',
      preview: '#e8e4df',
      draw(cx, w, h) {
        cx.fillStyle = '#e8e4df';
        cx.fillRect(0, 0, w, h);
        cx.strokeStyle = 'rgba(180, 170, 155, 0.15)';
        cx.lineWidth = 2;
        for (let i = 0; i < 12; ++i) {
          cx.beginPath();
          const startY = Math.random() * h;
          cx.moveTo(0, startY);
          for (let x = 0; x < w; x += 8)
            cx.lineTo(x, startY + Math.sin(x * 0.01 + i * 2) * 30 + Math.sin(x * 0.03 + i) * 15);
          cx.stroke();
        }
        const shade = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.12)');
        cx.fillStyle = shade;
        cx.fillRect(0, 0, w, h);
      }
    },
    purple: {
      name: 'Royal Purple',
      preview: '#2d1a4a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#3d2a5a');
        grad.addColorStop(0.85, '#2d1a4a');
        grad.addColorStop(1, '#1a0d30');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    }
  };

})();
