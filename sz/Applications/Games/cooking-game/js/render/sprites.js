;(function() {
  'use strict';

  /* Small sprites painted once into 2x canvases (bubble, check, shadow,
     bin, lock, ribbon) and a few shared drawing helpers. Owns the cache. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { ctx, ui } = NS.view;
  const { fx } = NS.juice;

  function drawLock(cx, cy, size) {
    const s = Math.round(size);
    const img = cachedSprite('lock|' + s, s, s * 1.1, (c) => {
      c.strokeStyle = '#4a3010';
      c.lineWidth = s * 0.2;
      c.beginPath();
      c.arc(s / 2, s * 0.42, s * 0.28, Math.PI, 0);
      c.stroke();
      c.strokeStyle = '#d8dce4';
      c.lineWidth = s * 0.12;
      c.stroke();
      const g = c.createLinearGradient(0, s * 0.4, 0, s);
      g.addColorStop(0, '#fff0b0');
      g.addColorStop(0.5, '#e0b048');
      g.addColorStop(1, '#8a5a14');
      c.fillStyle = g;
      rrPath(c, s * 0.12, s * 0.42, s * 0.76, s * 0.58, s * 0.1);
      c.fill();
      c.strokeStyle = '#4a3010';
      c.lineWidth = Math.max(1, s * 0.04);
      c.stroke();
      c.fillStyle = '#3a2008';
      c.beginPath();
      c.arc(s / 2, s * 0.66, s * 0.08, 0, Math.PI * 2);
      c.fill();
      c.fillRect(s / 2 - s * 0.03, s * 0.66, s * 0.06, s * 0.16);
    });
    ctx.drawImage(img, cx - s / 2, cy - s * 0.6, s, s * 1.1);
  }

  /* ── small cached sprites for the play screen (painted once at 2x) ── */
  const spriteCache = {};

  function cachedSprite(key, w, h, paint) {
    let s = spriteCache[key];
    if (s) return s;
    s = document.createElement('canvas');
    s.width = Math.ceil(w * 2);
    s.height = Math.ceil(h * 2);
    const c = s.getContext('2d');
    c.scale(2, 2);
    paint(c, w, h);
    spriteCache[key] = s;
    return s;
  }

  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* the white speech bubble over a seated guest: 96 x 100, tail at the bottom */
  function bubbleSprite() {
    return cachedSprite('bubble', 96, 104, (c) => {
      c.fillStyle = 'rgba(40,20,0,0.28)';
      c.beginPath();
      c.arc(49, 52, 40, 0, Math.PI * 2);
      c.fill();
      const g = c.createLinearGradient(0, 8, 0, 92);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#f2e8d4');
      c.beginPath();
      c.arc(48, 48, 40, 1.84, 1.23 + Math.PI * 2);
      c.lineTo(49, 102);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#5a3a1e';
      c.lineWidth = 2.5;
      c.lineJoin = 'round';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.ellipse(32, 22, 12, 6, -0.6, 0, Math.PI * 2);
      c.fill();
    });
  }

  function checkSprite() {
    return cachedSprite('check', 26, 26, (c) => {
      const g = c.createLinearGradient(0, 2, 0, 24);
      g.addColorStop(0, '#9af07a');
      g.addColorStop(1, '#2e9a2a');
      c.fillStyle = 'rgba(0,40,0,0.35)';
      c.beginPath();
      c.arc(13.5, 14.5, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = g;
      c.beginPath();
      c.arc(13, 13, 11, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#1a5a14';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(8, 13.5);
      c.lineTo(12, 17.5);
      c.lineTo(18.5, 9);
      c.stroke();
    });
  }

  function shadowSprite() {
    return cachedSprite('shadow', 64, 20, (c) => {
      c.save();
      c.translate(32, 10);
      c.scale(1, 0.3);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(20,8,0,0.55)');
      g.addColorStop(1, 'rgba(20,8,0,0)');
      c.fillStyle = g;
      c.fillRect(-32, -32, 64, 64);
      c.restore();
    });
  }

  function trashSprite() {
    return cachedSprite('trash', 64, 72, (c) => {
      const body = c.createLinearGradient(12, 0, 52, 0);
      body.addColorStop(0, '#5a626a');
      body.addColorStop(0.3, '#d8dee4');
      body.addColorStop(0.6, '#9aa2aa');
      body.addColorStop(1, '#4a525a');
      c.fillStyle = 'rgba(20,8,0,0.35)';
      c.beginPath();
      c.ellipse(32, 66, 26, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(13, 24);
      c.lineTo(51, 24);
      c.lineTo(47, 66);
      c.lineTo(17, 66);
      c.closePath();
      c.fill();
      c.strokeStyle = '#2a3036';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 4; ++i) {
        c.beginPath();
        c.moveTo(21 + i * 7.5, 30);
        c.lineTo(22 + i * 6.8, 60);
        c.stroke();
      }
      const lid = c.createLinearGradient(0, 14, 0, 26);
      lid.addColorStop(0, '#f2f4f6');
      lid.addColorStop(1, '#6a727a');
      c.fillStyle = lid;
      c.beginPath();
      c.ellipse(32, 22, 22, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#3a4046';
      rrPath(c, 26, 11, 12, 6, 3);
      c.fill();
      c.fillStyle = '#e8463a';
      c.beginPath();
      c.arc(32, 46, 7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(28.5, 42.5);
      c.lineTo(35.5, 49.5);
      c.moveTo(35.5, 42.5);
      c.lineTo(28.5, 49.5);
      c.stroke();
    });
  }

  function patienceColor(f) {
    return f > 0.5 ? '#5ad04a' : f > 0.25 ? '#f2b822' : '#ff4a3a';
  }

  /* a flickering flame sprite for combo chips and banners */
  function drawFlame(x, y, s) {
    const img = fx.sprite('flame', '#ff7a1a');
    if (!img) return;
    const k = 1 + 0.18 * Math.sin(G.animT * 14 + x) + 0.08 * Math.sin(G.animT * 31 + x * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, x - s * 1.4 * k / 2, y - s * 2.2 * k + s * 0.6, s * 1.4 * k, s * 2.2 * k);
    ctx.restore();
  }

  /* a red ribbon banner with folded ends, text in the middle */
  function drawRibbon(cx, cy, w, h, text, color) {
    const col = color || '#c8302a';
    const key = 'ribbon|' + Math.round(w) + 'x' + Math.round(h) + '|' + col;
    const img = cachedSprite(key, w + 60, h + 16, (c) => {
      const x0 = 30, y0 = 6;
      c.fillStyle = ui.shade(col, -0.45);
      for (let s = 0; s < 2; ++s) {
        const ex = s === 0 ? 2 : w + 34;
        c.beginPath();
        c.moveTo(ex, y0 + 10);
        c.lineTo(ex + 26, y0 + 10);
        c.lineTo(ex + 26, y0 + h + 8);
        c.lineTo(ex, y0 + h + 8);
        c.lineTo(ex + (s === 0 ? 10 : 16), y0 + h / 2 + 9);
        c.closePath();
        c.fill();
      }
      c.fillStyle = ui.shade(col, -0.6);
      c.beginPath();
      c.moveTo(x0, y0 + h);
      c.lineTo(x0 + 6, y0 + h + 8);
      c.lineTo(x0 + 6, y0 + h);
      c.moveTo(x0 + w, y0 + h);
      c.lineTo(x0 + w - 6, y0 + h + 8);
      c.lineTo(x0 + w - 6, y0 + h);
      c.fill();
      const g = c.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, ui.shade(col, 0.3));
      g.addColorStop(0.5, col);
      g.addColorStop(1, ui.shade(col, -0.3));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(x0 + w / 2, y0 - 6, x0 + w, y0);
      c.lineTo(x0 + w, y0 + h);
      c.quadraticCurveTo(x0 + w / 2, y0 + h - 6, x0, y0 + h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.setLineDash([4, 3]);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0 + 4, y0 + 4);
      c.quadraticCurveTo(x0 + w / 2, y0 - 2, x0 + w - 4, y0 + 4);
      c.moveTo(x0 + 4, y0 + h - 4);
      c.quadraticCurveTo(x0 + w / 2, y0 + h - 10, x0 + w - 4, y0 + h - 4);
      c.stroke();
      c.setLineDash([]);
    });
    ctx.drawImage(img, cx - (w + 60) / 2, cy - h / 2 - 6, w + 60, h + 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(text, cx, cy - 2, w - 30, Math.round(h * 0.5), { weight: 'bold', color: '#fff6e0', outline: ui.shade(col, -0.6) });
  }

  NS.sprites = { drawLock, cachedSprite, bubbleSprite, checkSprite, shadowSprite, trashSprite,
    patienceColor, drawFlame, drawRibbon };

})();
