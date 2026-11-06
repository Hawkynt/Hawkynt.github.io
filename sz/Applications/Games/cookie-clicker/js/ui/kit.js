/* UI drawing kit: text (with fitting and shadowed headline variants), framed bakery panels,
   progress bars, a lock badge and a library of small vector icons (cached per name, colour and
   size) for buttons, the tech tree, achievements and the store. Producer icons use the
   producer art, decorations a mini treat swatch. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const { ctx } = NS.view;

  function font(px, weight) {
    return (weight || 'normal') + ' ' + Math.round(px) + 'px ' + UI.font;
  }

  /* opts: align, weight, base, shadow, alpha */
  function text(str, x, y, px, color, opts) {
    opts = opts || {};
    ctx.font = font(px, opts.weight);
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
    ctx.strokeStyle = opts.accent ? K.rgba(opts.accent, opts.glow ? 0.95 : 0.55) : 'rgba(255,220,170,0.25)';
    ctx.stroke();
    K.roundRect(ctx, x + 3, y + 3, w - 6, Math.min(18, h / 3), Math.max(2, r - 3));
    ctx.fillStyle = 'rgba(255,240,220,0.06)';
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
    ctx.fillStyle = '#3a2a20';
    K.roundRect(ctx, x - s / 2, y - s * 0.1, s, s * 0.7, 2);
    ctx.fill();
    ctx.strokeStyle = '#c8a070';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.1, s * 0.3, Math.PI, 0);
    ctx.stroke();
  }

  /* ---- icons ---- */
  function paintIcon(g, name, c) {
    const s = 1;
    g.fillStyle = c;
    g.strokeStyle = c;
    g.lineWidth = 2.4 * s;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    switch (name) {
      case 'cookie': K.circle(g, 0, 0, 10, c); for (let i = 0; i < 4; ++i) K.circle(g, Math.cos(i * 1.7) * 5, Math.sin(i * 1.7) * 5, 1.8, 'rgba(0,0,0,0.45)'); break;
      case 'hand': case 'mouse':
        if (name === 'mouse') { K.roundRect(g, -6, -10, 12, 20, 6); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -3); g.stroke(); break; }
        g.beginPath(); g.moveTo(-4, 10); g.lineTo(-7, -2); g.lineTo(-3, -1); g.lineTo(-3, -11); g.lineTo(1, -11); g.lineTo(1, -3); g.lineTo(7, -2); g.lineTo(6, 10); g.closePath(); g.fill(); break;
      case 'bolt': g.beginPath(); g.moveTo(2, -11); g.lineTo(-6, 2); g.lineTo(0, 2); g.lineTo(-2, 11); g.lineTo(6, -2); g.lineTo(0, -2); g.closePath(); g.fill(); break;
      case 'wing': g.beginPath(); g.moveTo(-10, 6); g.quadraticCurveTo(-8, -10, 10, -10); g.quadraticCurveTo(4, -4, 8, -2); g.quadraticCurveTo(0, 0, 4, 4); g.quadraticCurveTo(-4, 4, -10, 6); g.fill(); break;
      case 'crate': g.strokeRect(-9, -9, 18, 18); g.beginPath(); g.moveTo(-9, -9); g.lineTo(9, 9); g.moveTo(9, -9); g.lineTo(-9, 9); g.stroke(); break;
      case 'flavour': K.circle(g, 0, 0, 9, c); K.circle(g, 0, 0, 5, 'rgba(255,255,255,0.45)'); break;
      case 'recipe': case 'scroll': case 'note':
        g.fillRect(-8, -10, 16, 20); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.6;
        for (let i = 0; i < 3; ++i) { g.beginPath(); g.moveTo(-5, -5 + i * 5); g.lineTo(5, -5 + i * 5); g.stroke(); } break;
      case 'golden': K.circle(g, 0, 0, 10, '#ffd25a'); K.circle(g, -3, -3, 3, 'rgba(255,255,255,0.7)'); K.circle(g, 3, 3, 2, 'rgba(160,100,0,0.6)'); break;
      case 'combo': for (let i = 0; i < 3; ++i) { g.beginPath(); g.moveTo(-9 + i * 6, 8); g.lineTo(-5 + i * 6, 0); g.lineTo(-9 + i * 6, -8); g.stroke(); } break;
      case 'clock': K.circle(g, 0, 0, 10); g.stroke(); g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 0); g.lineTo(5, 3); g.stroke(); break;
      case 'trophy': g.beginPath(); g.moveTo(-8, -10); g.lineTo(8, -10); g.quadraticCurveTo(8, 4, 0, 4); g.quadraticCurveTo(-8, 4, -8, -10); g.fill(); g.fillRect(-2, 4, 4, 4); g.fillRect(-6, 8, 12, 3); break;
      case 'calendar': g.strokeRect(-9, -7, 18, 17); g.fillRect(-9, -7, 18, 5); g.fillRect(-5, -11, 2, 5); g.fillRect(3, -11, 2, 5); break;
      case 'leaf': g.beginPath(); g.moveTo(-9, 9); g.quadraticCurveTo(-10, -10, 10, -10); g.quadraticCurveTo(10, 10, -9, 9); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.moveTo(-9, 9); g.lineTo(6, -6); g.stroke(); break;
      case 'moon': K.circle(g, 0, 0, 10, c); g.globalCompositeOperation = 'destination-out'; K.circle(g, 5, -4, 8, '#000'); g.globalCompositeOperation = 'source-over'; break;
      case 'flask': g.beginPath(); g.moveTo(-3, -10); g.lineTo(-3, -3); g.lineTo(-9, 9); g.lineTo(9, 9); g.lineTo(3, -3); g.lineTo(3, -10); g.closePath(); g.fill(); break;
      case 'crystal': g.beginPath(); g.moveTo(0, -11); g.lineTo(8, -2); g.lineTo(0, 11); g.lineTo(-8, -2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(0, -11); g.lineTo(-8, -2); g.lineTo(0, -2); g.closePath(); g.fill(); break;
      case 'deco': case 'palette': K.circle(g, 0, 0, 10, c); for (let i = 0; i < 5; ++i) K.circle(g, Math.cos(i * 1.25) * 5.5, Math.sin(i * 1.25) * 5.5, 2, ['#ff4a7a', '#4ab4ff', '#ffd23a', '#6ae07a', '#ffffff'][i]); break;
      case 'oven': g.strokeRect(-9, -9, 18, 18); g.fillRect(-6, -2, 12, 8); K.circle(g, -5, -6, 1.5, c); K.circle(g, 0, -6, 1.5, c); break;
      case 'sack': g.beginPath(); g.moveTo(-4, -10); g.lineTo(4, -10); g.lineTo(2, -6); g.quadraticCurveTo(11, 0, 8, 10); g.lineTo(-8, 10); g.quadraticCurveTo(-11, 0, -2, -6); g.closePath(); g.fill(); break;
      case 'tray': g.fillRect(-11, 4, 22, 3); for (let i = 0; i < 3; ++i) K.circle(g, -7 + i * 7, 0, 3, c); break;
      case 'cake': g.fillRect(-9, -2, 18, 11); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-9, -2, 18, 3); g.fillStyle = c; g.fillRect(-1, -9, 2, 6); break;
      case 'hat': g.fillRect(-8, 2, 16, 6); K.circle(g, -5, -3, 5, c); K.circle(g, 5, -3, 5, c); K.circle(g, 0, -6, 6, c); break;
      case 'ghost': g.beginPath(); g.arc(0, -2, 8, Math.PI, 0); g.lineTo(8, 10); g.lineTo(4, 7); g.lineTo(0, 10); g.lineTo(-4, 7); g.lineTo(-8, 10); g.closePath(); g.fill(); break;
      case 'sparkle': case 'star': K.star(g, 0, 0, 11, name === 'star' ? 0.45 : 0.3, name === 'star' ? 5 : 4); g.fill(); break;
      case 'radar': K.circle(g, 0, 0, 10); g.stroke(); K.circle(g, 0, 0, 5); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(7, -7); g.stroke(); break;
      case 'zzz': g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -6); g.lineTo(-2, -6); g.lineTo(-8, 0); g.lineTo(-2, 0); g.moveTo(1, 2); g.lineTo(8, 2); g.lineTo(1, 9); g.lineTo(8, 9); g.stroke(); break;
      case 'coin': K.circle(g, 0, 0, 10, c); g.strokeStyle = 'rgba(0,0,0,0.4)'; K.circle(g, 0, 0, 6.5); g.stroke(); break;
      case 'milk': g.beginPath(); g.moveTo(-6, -10); g.lineTo(6, -10); g.lineTo(8, 10); g.lineTo(-8, 10); g.closePath(); g.stroke(); g.fillRect(-7, 0, 14, 10); break;
      case 'gear': for (let i = 0; i < 8; ++i) { const a = i / 8 * TAU; g.fillRect(Math.cos(a) * 9 - 2, Math.sin(a) * 9 - 2, 4, 4); } K.circle(g, 0, 0, 7.5, c); g.globalCompositeOperation = 'destination-out'; K.circle(g, 0, 0, 3, '#000'); g.globalCompositeOperation = 'source-over'; break;
      case 'play': g.beginPath(); g.moveTo(-6, -9); g.lineTo(9, 0); g.lineTo(-6, 9); g.closePath(); g.fill(); break;
      case 'back': g.beginPath(); g.moveTo(8, -8); g.lineTo(-4, 0); g.lineTo(8, 8); g.stroke(); break;
      case 'tree': g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -4); g.moveTo(0, 2); g.lineTo(-7, -5); g.moveTo(0, 0); g.lineTo(7, -7); g.stroke(); K.circle(g, -7, -6, 3, c); K.circle(g, 7, -8, 3, c); K.circle(g, 0, -6, 3, c); break;
      default: K.circle(g, 0, 0, 9, c);
    }
  }

  function iconSprite(name, size, color) {
    if (name.indexOf('b:') === 0) return NS.buildingArt.icon(name.slice(2));
    const key = 'icon:' + name + ':' + color + ':' + size;
    return K.sprite(key, size + 4, size + 4, (g) => {
      g.translate((size + 4) / 2, (size + 4) / 2);
      g.scale(size / 24, size / 24);
      if (name.indexOf('deco:') === 0) {
        K.circle(g, 0, 0, 11, '#f0d0a8');
        paintIcon(g, 'deco', color);
        return;
      }
      g.save();
      g.translate(1, 1.5);
      paintIcon(g, name, 'rgba(0,0,0,0.45)');
      g.restore();
      paintIcon(g, name, color);
    });
  }

  function icon(name, x, y, size, color) {
    const img = iconSprite(name, size, color || UI.text);
    if (name.indexOf('b:') === 0) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    else ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
  }

  Object.assign(NS.kit, { font, text, width, fitText, wrap, panel, bar, lock, paintIcon, iconSprite, icon });
})();
