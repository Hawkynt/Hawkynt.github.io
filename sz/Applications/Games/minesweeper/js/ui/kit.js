/* UI drawing kit: text (with fitting and wrapping), framed glass panels, progress bars, star
   rows, a lock badge, currency chips and a library of small vector icons (cached per name,
   colour and size) for buttons, the tech tree, achievements, powers and modes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const { ctx } = NS.view;

  function font(px, weight) {
    return (weight || 'normal') + ' ' + Math.round(px) + 'px ' + UI.font;
  }

  /* opts: align, weight, base, shadow, alpha */
  function text(str, x, y, px, color, opts) {
    opts = opts || {};
    ctx.font = opts.font ? (opts.weight || 'normal') + ' ' + px + 'px ' + opts.font : font(px, opts.weight);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.base || 'middle';
    if (opts.shadow) {
      ctx.fillStyle = typeof opts.shadow === 'string' ? opts.shadow : 'rgba(0,0,0,0.55)';
      ctx.fillText(str, x + 2, y + 2);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function width(str, px, weight) {
    ctx.font = font(px, weight);
    return ctx.measureText(str).width;
  }

  /* shrinks px until the text fits maxW */
  function fitText(str, x, y, maxW, px, opts) {
    let p = px;
    while (p > 9 && width(str, p, opts && opts.weight) > maxW) p -= 1;
    text(str, x, y, p, (opts && opts.color) || UI.text, opts);
    return p;
  }

  /* word-wrapped text; returns the height used */
  function wrap(str, x, y, maxW, px, color, opts) {
    const words = String(str).split(' ');
    let line = '', yy = y;
    const lh = px * 1.3;
    for (let i = 0; i < words.length; ++i) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (line && width(test, px, opts && opts.weight) > maxW) {
        text(line, x, yy, px, color, opts);
        line = words[i];
        yy += lh;
      } else line = test;
    }
    if (line) text(line, x, yy, px, color, opts);
    return yy - y + lh;
  }

  /* opts: radius, accent, glow, top, bottom, alpha */
  function panel(x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius == null ? 12 : opts.radius;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    K.roundRect(ctx, x, y + 4, w, h, r);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    const gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, opts.top || UI.panelTop);
    gr.addColorStop(1, opts.bottom || UI.panelBottom);
    K.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = opts.glow ? 2.5 : 1.5;
    ctx.strokeStyle = opts.accent ? K.rgba(opts.accent, opts.glow ? 0.95 : 0.55) : 'rgba(170,200,255,0.25)';
    ctx.stroke();
    K.roundRect(ctx, x + 3, y + 3, w - 6, Math.min(18, h / 3), Math.max(2, r - 3));
    ctx.fillStyle = 'rgba(220,235,255,0.06)';
    ctx.fill();
    ctx.restore();
  }

  function bar(x, y, w, h, f, color, back) {
    K.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = back || 'rgba(0,0,0,0.45)';
    ctx.fill();
    const fw = Math.max(0, Math.min(1, f)) * w;
    if (fw > 1) {
      K.roundRect(ctx, x, y, Math.max(h, fw), h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
      K.roundRect(ctx, x + 2, y + 1, Math.max(h, fw) - 4, h * 0.35, h / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  }

  function lock(x, y, s) {
    ctx.fillStyle = '#1a2440';
    K.roundRect(ctx, x - s / 2, y - s * 0.1, s, s * 0.7, 2);
    ctx.fill();
    ctx.strokeStyle = '#8aa0d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.1, s * 0.3, Math.PI, 0);
    ctx.stroke();
  }

  /* ---- icons ---- */
  function paintIcon(g, name, c) {
    g.fillStyle = c;
    g.strokeStyle = c;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    switch (name) {
      case 'play': g.beginPath(); g.moveTo(-6, -9); g.lineTo(9, 0); g.lineTo(-6, 9); g.closePath(); g.fill(); break;
      case 'back': g.beginPath(); g.moveTo(8, -8); g.lineTo(-4, 0); g.lineTo(8, 8); g.stroke(); break;
      case 'pause': g.fillRect(-7, -9, 5, 18); g.fillRect(2, -9, 5, 18); break;
      case 'tree': g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -4); g.moveTo(0, 2); g.lineTo(-7, -5); g.moveTo(0, 0); g.lineTo(7, -7); g.stroke(); K.circle(g, -7, -6, 3, c); K.circle(g, 7, -8, 3, c); K.circle(g, 0, -6, 3, c); break;
      case 'palette': K.circle(g, 0, 0, 10, c); for (let i = 0; i < 5; ++i) K.circle(g, Math.cos(i * 1.25) * 5.5, Math.sin(i * 1.25) * 5.5, 2, ['#ff4a7a', '#4ab4ff', '#ffd23a', '#6ae07a', '#ffffff'][i]); break;
      case 'trophy': g.beginPath(); g.moveTo(-8, -10); g.lineTo(8, -10); g.quadraticCurveTo(8, 4, 0, 4); g.quadraticCurveTo(-8, 4, -8, -10); g.fill(); g.fillRect(-2, 4, 4, 4); g.fillRect(-6, 8, 12, 3); break;
      case 'gear': for (let i = 0; i < 8; ++i) { const a = i / 8 * TAU; g.fillRect(Math.cos(a) * 9 - 2, Math.sin(a) * 9 - 2, 4, 4); } K.circle(g, 0, 0, 7.5, c); g.globalCompositeOperation = 'destination-out'; K.circle(g, 0, 0, 3, '#000'); g.globalCompositeOperation = 'source-over'; break;
      case 'star': K.star(g, 0, 0, 11, 0.45, 5); g.fill(); break;
      case 'sparkle': K.star(g, 0, 0, 11, 0.3, 4); g.fill(); break;
      case 'bolt': g.beginPath(); g.moveTo(2, -11); g.lineTo(-6, 2); g.lineTo(0, 2); g.lineTo(-2, 11); g.lineTo(6, -2); g.lineTo(0, -2); g.closePath(); g.fill(); break;
      case 'clock': K.circle(g, 0, 0, 10); g.stroke(); g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 0); g.lineTo(5, 3); g.stroke(); break;
      case 'leaf': g.beginPath(); g.moveTo(-9, 9); g.quadraticCurveTo(-10, -10, 10, -10); g.quadraticCurveTo(10, 10, -9, 9); g.fill(); break;
      case 'calendar': g.strokeRect(-9, -7, 18, 17); g.fillRect(-9, -7, 18, 5); g.fillRect(-5, -11, 2, 5); g.fillRect(3, -11, 2, 5); break;
      case 'skull': K.circle(g, 0, -2, 9, c); g.fillRect(-5, 4, 10, 6); g.globalCompositeOperation = 'destination-out'; K.circle(g, -3.5, -2, 2.6, '#000'); K.circle(g, 3.5, -2, 2.6, '#000'); g.fillRect(-1, 5, 2, 5); g.globalCompositeOperation = 'source-over'; break;
      case 'crown': g.beginPath(); g.moveTo(-10, 7); g.lineTo(-10, -6); g.lineTo(-5, 0); g.lineTo(0, -9); g.lineTo(5, 0); g.lineTo(10, -6); g.lineTo(10, 7); g.closePath(); g.fill(); break;
      case 'book': g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(-5, -10, -10, -8); g.lineTo(-10, 8); g.quadraticCurveTo(-5, 6, 0, 9); g.quadraticCurveTo(5, 6, 10, 8); g.lineTo(10, -8); g.quadraticCurveTo(5, -10, 0, -7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 9); g.stroke(); break;
      case 'flag': g.fillRect(-8, -10, 2.5, 21); g.beginPath(); g.moveTo(-6, -10); g.lineTo(9, -6); g.lineTo(-6, -1); g.closePath(); g.fill(); break;
      case 'bar': for (let i = 0; i < 4; ++i) g.fillRect(-11 + i * 5.6, -3, 5, 6); break;
      case 'spin': g.beginPath(); g.arc(0, 0, 8, 0.4, TAU - 0.4); g.stroke(); g.beginPath(); g.moveTo(8, -6); g.lineTo(9, 1); g.lineTo(3, -2); g.closePath(); g.fill(); break;
      case 'chain': g.lineWidth = 2.5; g.beginPath(); g.ellipse(-4, 0, 6, 4, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(4, 0, 6, 4, 0, 0, TAU); g.stroke(); break;
      case 'scroll': g.fillRect(-7, -9, 14, 18); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 3; ++i) g.fillRect(-4, -5 + i * 5, 8, 1.6); break;
      case 'xp': g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('XP', 0, 1); break;
      case 'gift': g.fillRect(-9, -3, 18, 12); g.fillRect(-10, -7, 20, 5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-1.5, -7, 3, 16); break;
      case 'shield': g.beginPath(); g.moveTo(0, -10); g.lineTo(9, -6); g.quadraticCurveTo(9, 6, 0, 11); g.quadraticCurveTo(-9, 6, -9, -6); g.closePath(); g.fill(); break;
      case 'bomb': K.circle(g, -1, 2, 8, c); g.beginPath(); g.moveTo(4, -4); g.quadraticCurveTo(8, -10, 10, -7); g.stroke(); K.circle(g, 10, -8, 2, '#ffd25a'); break;
      case 'laser': g.fillRect(-2, -11, 4, 22); g.globalAlpha *= 0.4; g.fillRect(-5, -11, 10, 22); break;
      case 'quake': g.beginPath(); g.moveTo(-11, 2); g.lineTo(-6, -4); g.lineTo(-2, 4); g.lineTo(2, -6); g.lineTo(6, 4); g.lineTo(11, -2); g.stroke(); g.fillRect(-11, 7, 22, 3); break;
      case 'sweep': g.fillRect(-10, 2, 20, 4); g.fillRect(-10, 7, 20, 4); g.beginPath(); g.moveTo(-6, -2); g.lineTo(0, -9); g.lineTo(6, -2); g.stroke(); break;
      case 'shard': g.beginPath(); g.moveTo(0, -11); g.lineTo(7, -1); g.lineTo(0, 11); g.lineTo(-7, -1); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(0, -11); g.lineTo(-7, -1); g.lineTo(0, -1); g.closePath(); g.fill(); break;
      case 'gem': g.beginPath(); g.moveTo(-9, -3); g.lineTo(-5, -9); g.lineTo(5, -9); g.lineTo(9, -3); g.lineTo(0, 10); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-9, -3); g.lineTo(9, -3); g.lineTo(5, -9); g.lineTo(-5, -9); g.closePath(); g.fill(); break;
      case 'music': g.fillRect(2, -10, 2.2, 15); K.circle(g, -1, 6, 4, c); g.beginPath(); g.moveTo(4, -10); g.quadraticCurveTo(10, -7, 8, -2); g.stroke(); break;
      case 'map': g.beginPath(); g.moveTo(-10, -7); g.lineTo(-4, -9); g.lineTo(4, -6); g.lineTo(10, -8); g.lineTo(10, 8); g.lineTo(4, 10); g.lineTo(-4, 7); g.lineTo(-10, 9); g.closePath(); g.stroke(); break;
      case 'help': g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1); break;
      case 'piece': g.fillRect(-9, -2, 6, 6); g.fillRect(-3, -2, 6, 6); g.fillRect(3, -2, 6, 6); g.fillRect(-3, -8, 6, 6); break;
      case 'wide': g.fillRect(-11, -2, 22, 5); g.beginPath(); g.moveTo(-11, -6); g.lineTo(-7, -9); g.lineTo(-7, -3); g.closePath(); g.moveTo(11, -6); g.lineTo(7, -9); g.lineTo(7, -3); g.closePath(); g.fill(); break;
      case 'shrink': g.fillRect(-5, -2, 10, 5); g.beginPath(); g.moveTo(-11, -9); g.lineTo(-7, -6); g.lineTo(-11, -3); g.closePath(); g.moveTo(11, -9); g.lineTo(7, -6); g.lineTo(11, -3); g.closePath(); g.fill(); break;
      case 'multi': K.circle(g, 0, -5, 4.5, c); K.circle(g, -6, 5, 4.5, c); K.circle(g, 6, 5, 4.5, c); break;
      case 'fire': g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(9, -2, 6, 6); g.quadraticCurveTo(0, 12, -6, 6); g.quadraticCurveTo(-9, -2, 0, -11); g.fill(); break;
      case 'magnet': g.lineWidth = 5; g.beginPath(); g.arc(0, -1, 7, Math.PI, 0); g.stroke(); g.fillRect(-9.5, -1, 5, 9); g.fillRect(4.5, -1, 5, 9); break;
      case 'mega': K.circle(g, 0, 0, 10, c); K.circle(g, -3, -3, 3, 'rgba(255,255,255,0.7)'); break;
      case 'heart': g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-13, 0, -7, -11, 0, -4); g.bezierCurveTo(7, -11, 13, 0, 0, 9); g.fill(); break;
      case 'brick': g.fillRect(-11, -6, 10, 5); g.fillRect(1, -6, 10, 5); g.fillRect(-5, 1, 10, 5); break;
      case 'drop': g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(9, 2, 6, 6); g.arc(0, 4, 7, 0.4, Math.PI - 0.4); g.quadraticCurveTo(-9, 2, 0, -11); g.fill(); break;
      case 'eye': g.beginPath(); g.ellipse(0, 0, 11, 7, 0, 0, TAU); g.stroke(); K.circle(g, 0, 0, 4, c); break;
      case 'ping': K.circle(g, 0, 0, 3, c); g.beginPath(); g.arc(0, 0, 7, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(0, 0, 11, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(0, 0, 7, Math.PI - 0.8, Math.PI + 0.8); g.stroke(); break;
      case 'lamp': g.fillRect(-5, 6, 10, 4); g.beginPath(); g.moveTo(-7, 6); g.quadraticCurveTo(-9, -8, 0, -10); g.quadraticCurveTo(9, -8, 7, 6); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; K.circle(g, -2, -3, 2.5); break;
      case 'mine': K.circle(g, 0, 0, 7, c); g.lineWidth = 2.4; for (let k = 0; k < 4; ++k) { const a = k / 4 * Math.PI; g.beginPath(); g.moveTo(-Math.cos(a) * 11, -Math.sin(a) * 11); g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); g.stroke(); } K.circle(g, -2.5, -2.5, 2, '#ffffff'); break;
      case 'swords': g.lineWidth = 2.6; g.beginPath(); g.moveTo(-9, -9); g.lineTo(8, 8); g.moveTo(9, -9); g.lineTo(-8, 8); g.stroke(); g.beginPath(); g.moveTo(-9, 3); g.lineTo(-3, 9); g.moveTo(9, 3); g.lineTo(3, 9); g.stroke(); break;
      case 'duo': K.circle(g, -5, -4, 4.5, c); K.circle(g, 5, -4, 4.5, c); g.beginPath(); g.arc(-5, 10, 7, Math.PI, 0); g.fill(); g.beginPath(); g.arc(5, 10, 7, Math.PI, 0); g.fill(); break;
      default: K.circle(g, 0, 0, 9, c);
    }
  }

  function iconSprite(name, size, color) {
    return K.sprite('icon:' + name + ':' + color + ':' + size, size + 4, size + 4, (g) => {
      g.translate((size + 4) / 2, (size + 4) / 2);
      g.scale(size / 24, size / 24);
      g.save();
      g.translate(1, 1.5);
      paintIcon(g, name, 'rgba(0,0,0,0.45)');
      g.restore();
      paintIcon(g, name, color);
    });
  }

  function icon(name, x, y, size, color) {
    const img = iconSprite(name, size, color || UI.text);
    ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
  }

  /* n of 3 stars */
  function stars(n, x, y, size) {
    for (let i = 0; i < 3; ++i) icon('star', x + (i - 1) * size * 1.1, y, size, i < n ? UI.gold : 'rgba(120,130,160,0.5)');
  }

  /* a currency chip: icon and amount */
  function chip(iconName, amount, x, y, color, w) {
    w = w || 120;
    panel(x, y, w, 30, { radius: 15, accent: color });
    icon(iconName, x + 16, y + 15, 16, color);
    fitText(String(amount), x + 30, y + 16, w - 38, 15, { weight: 'bold', color: '#ffffff' });
  }

  Object.assign(NS.kit, { font, text, width, fitText, wrap, panel, bar, lock, paintIcon, iconSprite, icon, stars, chip });
})();
