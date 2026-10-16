;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * People art for the Cooking Game overhaul. Six customer types (kid, business,
   * tourist, critic, vip, regular) and the chef are cute chibi characters — big
   * heads, small bodies, expressive eyes — assembled procedurally from a look
   * (skin, hair, hair style, shirt, accessory, shape). Every (look, pose, frame)
   * is painted ONCE into a cached canvas at 2x resolution, with soft shading,
   * steam and hearts baked into the frames. The draw functions only blit —
   * no blur filters, no gradients per frame.
   */

  const TWO_PI = Math.PI * 2;
  const SCALE = 2;
  const OUTLINE = '#3a2418';

  /* Characters live in a 72 x 110 design box, feet/seat at y = 0, head upward. */
  const BODY_W = 72, BODY_H = 110, PAD = 10;
  const SPR_W = (BODY_W + 2 * PAD) * SCALE;   // 184
  const SPR_H = (BODY_H + 2 * PAD) * SCALE;   // 260

  /* ── palettes kept from the original controller ── */

  const SKIN_TONES = ['#fde0c8', '#f5c5a3', '#d4a574', '#c68642', '#8d5524', '#5c3310'];
  const HAIR_COLORS = ['#2c1b0e', '#5a3214', '#8b4513', '#d4a017', '#c0392b', '#e67e22', '#7f8c8d', '#f5e6ca'];
  const SHIRT_COLORS = ['#4a7fb5', '#b54a6d', '#4ab58a', '#b5964a', '#7b4ab5', '#b5554a', '#4ab5b5', '#8a8a8a'];
  const BRIGHT_SHIRTS = ['#ff6b6b', '#ffd23f', '#4ac8ff', '#6bd24a', '#ff9a3f', '#ff6bd2'];
  const SUIT_COLORS = ['#2f3a4a', '#3a2f28', '#26323a', '#463a2c'];
  const JACKET_COLORS = ['#6a2f8a', '#1f2f5a', '#7a1f3f', '#2c2c34'];
  const HAIR_STYLES = ['spiky', 'round', 'flat', 'parted', 'slick', 'pigtails'];
  const TYPES = ['kid', 'business', 'tourist', 'critic', 'vip', 'regular'];
  const SHAPES = ['slim', 'round', 'tall'];
  const MOODS = ['happy', 'ok', 'impatient', 'angry', 'love'];

  /* ── colour helpers ── */

  function hexToRgb(hex) {
    let h = String(hex === undefined || hex === null ? '' : hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const n = parseInt(h, 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function channel(v) {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length < 2 ? '0' + s : s;
  }

  /* f in [-1, 1]: negative darkens toward black, positive lightens toward white */
  function shade(hex, f) {
    const c = hexToRgb(hex);
    const target = f < 0 ? 0 : 255;
    const k = Math.min(1, Math.abs(f));
    return '#' + channel(c.r + (target - c.r) * k) + channel(c.g + (target - c.g) * k) + channel(c.b + (target - c.b) * k);
  }

  /* mix two hex colours, f = 0 keeps the first, f = 1 the second */
  function blend(hexA, hexB, f) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return '#' + channel(a.r + (b.r - a.r) * f) + channel(a.g + (b.g - a.g) * f) + channel(a.b + (b.b - a.b) * f);
  }

  /* ── shared painting helpers ── */

  function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  function dot(ctx, x, y, r, fill, stroke, lw) {
    ell(ctx, x, y, r, r, fill, stroke, lw);
  }

  function line(ctx, x0, y0, x1, y1, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  function heart(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.35, x - r * 0.5, y - r * 1.25, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.5, y - r * 1.25, x + r * 1.3, y - r * 0.35, x, y + r * 0.9);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /* Soft baked drop shadow under the feet or the seat. */
  function groundShadow(ctx, y, rx) {
    const g = ctx.createRadialGradient(0, y, rx * 0.2, 0, y, rx);
    g.addColorStop(0, 'rgba(42,22,12,0.30)');
    g.addColorStop(1, 'rgba(42,22,12,0)');
    ctx.fillStyle = g;
    ell(ctx, 0, y, rx, rx * 0.28);
  }

  /* ── look generation ── */

  function pick(arr, rng) {
    return arr[(rng() * arr.length) | 0];
  }

  function randomLook(rng, typeId) {
    const r = typeof rng === 'function' ? rng : Math.random;
    let type = pick(TYPES, r);
    if (typeof typeId === 'number' && typeId >= 1 && typeId <= TYPES.length) type = TYPES[typeId - 1];
    else if (typeof typeId === 'string' && TYPES.indexOf(typeId) >= 0) type = typeId;
    const skin = pick(SKIN_TONES, r);
    const hair = pick(HAIR_COLORS, r);
    const shape = pick(SHAPES, r);
    let hairStyle, shirt, accessory;
    switch (type) {
      case 'kid':
        hairStyle = pick(['cap', 'pigtails'], r);
        shirt = pick(BRIGHT_SHIRTS, r);
        accessory = 'none';
        break;
      case 'business':
        hairStyle = 'slick';
        shirt = pick(SUIT_COLORS, r);
        accessory = 'briefcase';
        break;
      case 'tourist':
        hairStyle = 'sunhat';
        shirt = pick(SHIRT_COLORS, r);
        accessory = 'camera';
        break;
      case 'critic':
        hairStyle = 'beret';
        shirt = pick(SHIRT_COLORS, r);
        accessory = 'notebook';
        break;
      case 'vip':
        hairStyle = 'slick';
        shirt = pick(JACKET_COLORS, r);
        accessory = 'shades';
        break;
      default:
        hairStyle = pick(HAIR_STYLES, r);
        shirt = pick(SHIRT_COLORS, r);
        accessory = pick(['none', 'none', 'glasses'], r);
    }
    return { type, skin, hair, hairStyle, shirt, accessory, shape };
  }

  /* ── body proportions per shape ── */

  function dims(shape) {
    if (shape === 'round') return { hw: 17, legH: 11, headR: 23 };
    if (shape === 'tall') return { hw: 13, legH: 21, headR: 23 };
    return { hw: 14.5, legH: 15, headR: 23 };
  }

  /* ── head, hair, face ── */

  function paintHeadBase(ctx, x, y, r, skin) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r * 1.15);
    g.addColorStop(0, shade(skin, 0.22));
    g.addColorStop(1, shade(skin, -0.12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    dot(ctx, x - r, y + r * 0.15, r * 0.16, skin, OUTLINE, 1.5);
    dot(ctx, x + r, y + r * 0.15, r * 0.16, skin, OUTLINE, 1.5);
  }

  function paintHair(ctx, look, x, y, r) {
    const hair = look.hair;
    const dark = shade(hair, -0.35);
    switch (look.hairStyle) {
      case 'spiky':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.25, r * 0.92, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.75, y - r * 0.75);
        ctx.lineTo(x - r * 0.45, y - r * 0.35);
        ctx.lineTo(x - r * 0.15, y - r * 1.15);
        ctx.lineTo(x + 0.15 * r, y - r * 0.3);
        ctx.lineTo(x + r * 0.4, y - r * 1.05);
        ctx.lineTo(x + r * 0.65, y - r * 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      case 'round':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.1, r * 1.08, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        gloss(ctx, x - r * 0.45, y - r * 0.85, r * 0.3, r * 0.12, 0.25);
        break;
      case 'flat':
        ctx.fillStyle = hair;
        rrect(ctx, x - r * 0.95, y - r * 1.05, r * 1.9, r * 0.5, 3, hair, null);
        ctx.beginPath();
        ctx.arc(x, y - r * 0.35, r * 0.95, Math.PI, Math.PI * 2);
        ctx.fill();
        break;
      case 'parted':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x - r * 0.12, y - r * 0.25, r * 0.98, Math.PI * 0.9, Math.PI * 1.72);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + r * 0.18, y - r * 0.25, r * 0.98, Math.PI * 1.28, Math.PI * 2.1);
        ctx.fill();
        break;
      case 'slick':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.18, r * 0.98, Math.PI * 0.92, Math.PI * 2.08);
        ctx.fill();
        gloss(ctx, x - r * 0.4, y - r * 0.8, r * 0.34, r * 0.1, 0.3);
        gloss(ctx, x + r * 0.15, y - r * 0.85, r * 0.22, r * 0.08, 0.22);
        break;
      case 'pigtails':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r * 0.95, Math.PI, Math.PI * 2);
        ctx.fill();
        dot(ctx, x - r * 1.05, y + r * 0.1, r * 0.34, hair, OUTLINE, 2);
        dot(ctx, x + r * 1.05, y + r * 0.1, r * 0.34, hair, OUTLINE, 2);
        dot(ctx, x - r * 0.85, y - r * 0.15, r * 0.12, '#e04a3f', null);
        dot(ctx, x + r * 0.85, y - r * 0.15, r * 0.12, '#e04a3f', null);
        break;
      case 'cap':
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r * 0.95, Math.PI, Math.PI * 2);
        ctx.fill();
        rrect(ctx, x - r * 0.2, y - r * 0.35, r * 1.25, r * 0.22, 4, '#d94f3d', OUTLINE, 2);
        dot(ctx, x, y - r * 1.05, r * 0.12, '#d94f3d', null);
        break;
      case 'beret':
        ctx.fillStyle = '#7a3a5a';
        ell(ctx, x + r * 0.08, y - r * 0.72, r * 1.02, r * 0.5, '#7a3a5a', OUTLINE, 2);
        dot(ctx, x + r * 0.08, y - r * 1.18, r * 0.12, '#5a2a44', null);
        break;
      case 'sunhat':
        ell(ctx, x, y - r * 0.55, r * 1.45, r * 0.34, '#e8c86a', OUTLINE, 2);
        ctx.fillStyle = '#e8c86a';
        ctx.beginPath();
        ctx.arc(x, y - r * 0.62, r * 0.85, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.62, r * 0.85, Math.PI, Math.PI * 2);
        ctx.stroke();
        line(ctx, x - r * 0.8, y - r * 0.62, x + r * 0.8, y - r * 0.62, '#c0392b', 3);
        break;
    }
    if (look.hairStyle !== 'cap' && look.hairStyle !== 'sunhat' && look.hairStyle !== 'beret')
      line(ctx, x - r * 0.55, y - r * 0.62, x - r * 0.2, y - r * 0.72, dark, 1.5);
  }

  function gloss(ctx, x, y, rx, ry, alpha) {
    ell(ctx, x, y, rx, ry, 'rgba(255,255,255,' + alpha + ')');
  }

  function paintEyePair(ctx, x, y, r, mood) {
    const ex = r * 0.42;
    if (mood === 'love') {
      heart(ctx, x - ex, y, r * 0.26, '#e0455a');
      heart(ctx, x + ex, y, r * 0.26, '#e0455a');
      return;
    }
    if (mood === 'joy') {
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x - ex, y + r * 0.12, r * 0.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + ex, y + r * 0.12, r * 0.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      return;
    }
    if (mood === 'angry') {
      dot(ctx, x - ex, y, r * 0.17, '#fff', OUTLINE, 1.5);
      dot(ctx, x + ex, y, r * 0.17, '#fff', OUTLINE, 1.5);
      dot(ctx, x - ex, y + r * 0.05, r * 0.08, '#3a2a22', null);
      dot(ctx, x + ex, y + r * 0.05, r * 0.08, '#3a2a22', null);
      line(ctx, x - ex - r * 0.22, y - r * 0.34, x - ex + r * 0.16, y - r * 0.2, '#7a2020', 2.5);
      line(ctx, x + ex + r * 0.22, y - r * 0.34, x + ex - r * 0.16, y - r * 0.2, '#7a2020', 2.5);
      return;
    }
    if (mood === 'flat') {
      dot(ctx, x - ex, y, r * 0.13, '#3a2a22', null);
      dot(ctx, x + ex, y, r * 0.13, '#3a2a22', null);
      return;
    }
    dot(ctx, x - ex, y, r * 0.19, '#3a2a22', null);
    dot(ctx, x + ex, y, r * 0.19, '#3a2a22', null);
    dot(ctx, x - ex - r * 0.06, y - r * 0.07, r * 0.07, '#fff', null);
    dot(ctx, x + ex - r * 0.06, y - r * 0.07, r * 0.07, '#fff', null);
  }

  function paintMouth(ctx, x, y, r, mood, skin) {
    if (mood === 'angry') {
      ctx.strokeStyle = '#8a2020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.28, r * 0.26, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      return;
    }
    if (mood === 'big') {
      ctx.fillStyle = '#6a2420';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.05, r * 0.3, Math.PI * 0.05, Math.PI * 0.95);
      ctx.closePath();
      ctx.fill();
      ell(ctx, x, y + r * 0.16, r * 0.14, r * 0.08, '#e87a7a');
      return;
    }
    if (mood === 'open') {
      dot(ctx, x, y + r * 0.05, r * 0.16, '#6a2420', null);
      return;
    }
    if (mood === 'joy') {
      ctx.strokeStyle = shade(skin, -0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.1, r * 0.26, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      return;
    }
    line(ctx, x - r * 0.12, y, x + r * 0.12, y, shade(skin, -0.55), 1.5);
  }

  function blush(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,120,120,0.3)';
    ell(ctx, x - r * 0.62, y + r * 0.18, r * 0.18, r * 0.11);
    ell(ctx, x + r * 0.62, y + r * 0.18, r * 0.18, r * 0.11);
  }

  function paintGlasses(ctx, look, x, y, r) {
    if (look.accessory === 'shades') {
      rrect(ctx, x - r * 0.68, y - r * 0.16, r * 0.52, r * 0.34, 4, '#22222a', OUTLINE, 1.5);
      rrect(ctx, x + r * 0.16, y - r * 0.16, r * 0.52, r * 0.34, 4, '#22222a', OUTLINE, 1.5);
      line(ctx, x - r * 0.16, y - r * 0.04, x + r * 0.16, y - r * 0.04, '#22222a', 2);
      gloss(ctx, x - r * 0.45, y - r * 0.06, r * 0.12, r * 0.06, 0.35);
      return;
    }
    if (look.accessory === 'glasses' || look.type === 'critic') {
      ctx.strokeStyle = '#4a3a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x - r * 0.42, y, r * 0.26, 0, TWO_PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + r * 0.42, y, r * 0.26, 0, TWO_PI);
      ctx.stroke();
      line(ctx, x - r * 0.16, y, x + r * 0.16, y, '#4a3a2a', 1.5);
    }
  }

  /* Full head: base, hair, face, eyewear. mood drives eyes/mouth. */
  function paintHead(ctx, look, x, y, r, mood) {
    const skin = mood === 'angry' ? blend(look.skin, '#d04030', 0.5) : look.skin;
    paintHeadBase(ctx, x, y, r, skin);
    paintHair(ctx, look, x, y, r);
    paintEyePair(ctx, x, y - r * 0.08, r, mood === 'open' ? 'joy' : mood === 'big' ? 'love' : mood);
    if (mood === 'big' || mood === 'joy') blush(ctx, x, y, r);
    paintMouth(ctx, x, y + r * 0.42, r, mood, skin);
    paintGlasses(ctx, look, x, y - r * 0.08, r);
  }

  /* ── torso, limbs, outfit ── */

  function paintTorso(ctx, look, hw, yTop, yBot) {
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, shade(look.shirt, 0.28));
    g.addColorStop(1, shade(look.shirt, -0.22));
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hw, yTop + 3);
    ctx.quadraticCurveTo(-hw - 2.5, (yTop + yBot) / 2, -hw + 1, yBot);
    ctx.lineTo(hw - 1, yBot);
    ctx.quadraticCurveTo(hw + 2.5, (yTop + yBot) / 2, hw, yTop + 3);
    ctx.quadraticCurveTo(0, yTop - 3, -hw, yTop + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function paintOutfit(ctx, look, hw, yTop, yBot) {
    const mid = (yTop + yBot) / 2;
    if (look.type === 'business') {
      line(ctx, -hw * 0.55, yTop + 2, -1, yBot - 6, shade(look.shirt, -0.35), 2);
      line(ctx, hw * 0.55, yTop + 2, 1, yBot - 6, shade(look.shirt, -0.35), 2);
      ctx.fillStyle = '#b53a3a';
      ctx.beginPath();
      ctx.moveTo(0, yTop + 3);
      ctx.lineTo(3, mid);
      ctx.lineTo(0, yBot - 5);
      ctx.lineTo(-3, mid);
      ctx.closePath();
      ctx.fill();
      dot(ctx, 0, yTop + 3, 2, '#8a2a2a', null);
    } else if (look.type === 'vip') {
      line(ctx, -hw * 0.6, yTop + 2, -2, yBot - 4, shade(look.shirt, 0.35), 2);
      line(ctx, hw * 0.6, yTop + 2, 2, yBot - 4, shade(look.shirt, 0.35), 2);
      ctx.strokeStyle = '#e8c040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, yTop + 2, hw * 0.5, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      dot(ctx, 0, yTop + 2 + hw * 0.5, 2.2, '#ffd23f', '#a8801f', 1);
    } else if (look.type === 'tourist') {
      for (let i = 0; i < 3; ++i) {
        const fx = -hw * 0.5 + i * hw * 0.5;
        const fy = mid + (i % 2 ? -5 : 4);
        for (let p = 0; p < 4; ++p) {
          const a = p * TWO_PI / 4 + 0.4;
          dot(ctx, fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 1.5, 'rgba(255,255,255,0.75)');
        }
        dot(ctx, fx, fy, 1.3, '#ffd23f', null);
      }
    } else if (look.type === 'kid') {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      for (let p = 0; p < 10; ++p) {
        const rr = p % 2 ? 2.4 : 5.5;
        const a = -Math.PI / 2 + p * Math.PI / 5;
        const px = Math.cos(a) * rr, py = mid + Math.sin(a) * rr;
        if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintArm(ctx, x0, y0, x1, y1, look) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = shade(look.shirt, -0.1);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    dot(ctx, x1, y1, 3.4, look.skin, OUTLINE, 1.5);
  }

  function paintLeg(ctx, hipX, yHip, footX, look) {
    const lift = 3 * Math.max(0, 1 - Math.abs(footX) / 12);
    const footY = -lift;
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(hipX, yHip); ctx.lineTo(footX, footY - 3); ctx.stroke();
    ctx.strokeStyle = shade(look.shirt, -0.45);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(hipX, yHip); ctx.lineTo(footX, footY - 3); ctx.stroke();
    ell(ctx, footX + 2, footY - 1.5, 5, 2.6, '#2a2018', OUTLINE, 1.5);
  }

  /* ── carried accessories ── */

  function paintBriefcase(ctx, x, y) {
    rrect(ctx, x - 5, y, 10, 8, 1.5, '#8a5a2c', OUTLINE, 1.5);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  function paintCamera(ctx, look, hw, yTop) {
    line(ctx, -hw * 0.5, yTop + 2, 0, yTop + 12, '#4a3a2a', 1.5);
    line(ctx, hw * 0.5, yTop + 2, 0, yTop + 12, '#4a3a2a', 1.5);
    rrect(ctx, -5, yTop + 11, 10, 7, 1.5, '#3a4a5a', OUTLINE, 1.5);
    dot(ctx, 0, yTop + 14.5, 2.4, '#9ac0e0', OUTLINE, 1);
  }

  function paintNotebook(ctx, x, y) {
    rrect(ctx, x - 5, y - 6, 10, 12, 1, '#e8e0d0', OUTLINE, 1.5);
    line(ctx, x - 5, y - 6, x - 5, y + 6, '#b53a3a', 2.5);
    line(ctx, x - 2.5, y - 2.5, x + 3, y - 2.5, '#9a9a8a', 1);
    line(ctx, x - 2.5, y, x + 3, y, '#9a9a8a', 1);
    line(ctx, x - 2.5, y + 2.5, x + 1.5, y + 2.5, '#9a9a8a', 1);
  }

  function paintSteam(ctx, x, y) {
    for (let i = 0; i < 3; ++i) {
      const sx = x + (i - 1) * 7;
      const sy = y - i * 4;
      dot(ctx, sx, sy, 3.2 - i * 0.5, 'rgba(255,255,255,0.55)');
      dot(ctx, sx + 2, sy - 5, 2.2 - i * 0.4, 'rgba(255,255,255,0.4)');
    }
  }

  /* ── customer poses ── */

  function paintWalk(ctx, look, frame) {
    const d = dims(look.shape);
    const swing = [10, 3, -10, -3][frame];
    const yHip = -d.legH;
    const yTop = yHip - 28;
    const headY = yTop - d.headR + 6;
    groundShadow(ctx, -1, 20);
    paintArm(ctx, -2, yTop + 7, -swing * 0.8, yHip - 10, look);
    paintLeg(ctx, -3, yHip, -swing, look);
    paintTorso(ctx, look, d.hw * 0.85, yTop, yHip);
    paintOutfit(ctx, look, d.hw * 0.85, yTop, yHip);
    if (look.accessory === 'briefcase') paintBriefcase(ctx, -swing - 4, yHip - 12);
    if (look.accessory === 'camera') paintCamera(ctx, look, d.hw * 0.85, yTop);
    paintHead(ctx, look, 2, headY, d.headR, 'calm');
    paintLeg(ctx, 3, yHip, swing, look);
    paintArm(ctx, 2, yTop + 7, swing * 0.8, yHip - 10, look);
  }

  function paintSitBase(ctx, look, breathe) {
    const d = dims(look.shape);
    const hw = d.hw + (breathe ? 1 : 0);
    const ySeat = -4;
    const yTop = -36 - (breathe ? 1.5 : 0);
    const headY = yTop - d.headR + 6;
    groundShadow(ctx, 0, 22);
    paintTorso(ctx, look, hw, yTop, ySeat);
    paintOutfit(ctx, look, hw, yTop, ySeat);
    return { d, hw, ySeat, yTop, headY };
  }

  function paintSit(ctx, look, frame) {
    const b = paintSitBase(ctx, look, frame === 1);
    paintArm(ctx, -b.hw, b.yTop + 8, -b.hw - 3, b.ySeat - 6, look);
    paintArm(ctx, b.hw, b.yTop + 8, b.hw + 3, b.ySeat - 6, look);
    if (look.accessory === 'briefcase') paintBriefcase(ctx, b.hw + 12, b.ySeat - 8);
    if (look.accessory === 'camera') paintCamera(ctx, look, b.hw, b.yTop);
    if (look.accessory === 'notebook') paintNotebook(ctx, -b.hw - 8, b.ySeat - 10);
    paintHead(ctx, look, 0, b.headY, b.d.headR, 'calm');
  }

  function paintEat(ctx, look, frame) {
    const b = paintSitBase(ctx, look, false);
    const mouthX = 0, mouthY = b.headY + b.d.headR * 0.42;
    paintArm(ctx, -b.hw, b.yTop + 8, -b.hw - 3, b.ySeat - 6, look);
    paintHead(ctx, look, 0, b.headY, b.d.headR, frame === 1 ? 'open' : 'joy');
    const hx = frame === 1 ? 9 : 13, hy = frame === 1 ? mouthY + 4 : mouthY + 16;
    paintArm(ctx, b.hw, b.yTop + 8, hx, hy, look);
    line(ctx, hx - 1, hy - 2, hx - 6, hy - 10, '#b8b8c0', 2);
    for (let i = 0; i < 3; ++i)
      line(ctx, hx - 6 - i * 1.6, hy - 10, hx - 7 - i * 1.6, hy - 14, '#b8b8c0', 1.2);
    if (look.accessory === 'notebook') paintNotebook(ctx, -b.hw - 8, b.ySeat - 10);
  }

  function paintHappy(ctx, look) {
    const b = paintSitBase(ctx, look, false);
    paintArm(ctx, -b.hw, b.yTop + 6, -b.hw - 8, b.yTop - 6, look);
    paintArm(ctx, b.hw, b.yTop + 6, b.hw + 8, b.yTop - 6, look);
    paintHead(ctx, look, 0, b.headY, b.d.headR, 'big');
    heart(ctx, -b.d.headR - 4, b.headY - b.d.headR, 4, '#e0455a');
    heart(ctx, b.d.headR + 2, b.headY - b.d.headR - 6, 3, '#e87a9a');
  }

  function paintAngry(ctx, look) {
    const b = paintSitBase(ctx, look, false);
    paintArm(ctx, -b.hw, b.yTop + 8, -b.hw - 5, b.ySeat - 8, look);
    paintArm(ctx, b.hw, b.yTop + 8, b.hw + 5, b.ySeat - 8, look);
    paintHead(ctx, look, 0, b.headY, b.d.headR, 'angry');
    paintSteam(ctx, -b.d.headR + 2, b.headY - b.d.headR - 4);
    paintSteam(ctx, b.d.headR - 2, b.headY - b.d.headR - 4);
  }

  function paintCustomer(ctx, look, pose, frame) {
    if (look.type === 'kid') ctx.scale(0.82, 0.82);
    switch (pose) {
      case 'walk': paintWalk(ctx, look, frame); break;
      case 'eat': paintEat(ctx, look, frame); break;
      case 'happy': paintHappy(ctx, look); break;
      case 'angry': paintAngry(ctx, look); break;
      default: paintSit(ctx, look, frame);
    }
  }

  /* ── customer sprite cache: paint once, blit forever ── */

  const spriteCache = {};

  function lookKey(look) {
    return [look.type, look.skin, look.hair, look.hairStyle, look.shirt, look.accessory, look.shape].join('|');
  }

  function getSprite(look, pose, frame) {
    const key = lookKey(look) + ':' + pose + ':' + frame;
    const hit = spriteCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = SPR_W;
    canvas.height = SPR_H;
    const ctx = canvas.getContext('2d');
    ctx.translate(SPR_W / 2, SPR_H - PAD * SCALE);
    ctx.scale(SCALE, SCALE);
    paintCustomer(ctx, look, pose, frame);
    spriteCache[key] = canvas;
    return canvas;
  }

  const POSE_FPS = { walk: [8, 4], sit: [1.5, 2], eat: [4, 2], happy: [1, 1], angry: [1, 1] };

  function frameOf(t, fps, n) {
    if (n <= 1) return 0;
    const f = Math.floor((t || 0) * fps) % n;
    return f < 0 ? f + n : f;
  }

  function blit(ctx, img, cx, baseY) {
    ctx.drawImage(img, cx - (BODY_W + 2 * PAD) / 2, baseY - (BODY_H + PAD), BODY_W + 2 * PAD, BODY_H + 2 * PAD);
  }

  /* drawCustomer blits the cached frame centred on cx with feet/seat at baseY. */
  function drawCustomer(ctx, look, cx, baseY, pose, t, facing = 1) {
    const spec = POSE_FPS[pose] || POSE_FPS.sit;
    const img = getSprite(look, pose, frameOf(t, spec[0], spec[1]));
    ctx.save();
    if (pose === 'walk' && facing < 0) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }
    blit(ctx, img, cx, baseY);
    ctx.restore();
  }

  /* ── the chef ── */

  const CHEF_SKIN = '#f5c5a3';
  const CHEF_HAIR = '#5a3214';
  const CHEF_JACKET = '#f4f0e8';

  function paintChefHead(ctx, x, y, r, mood, hatBounce) {
    paintHeadBase(ctx, x, y, r, CHEF_SKIN);
    ctx.fillStyle = CHEF_HAIR;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.9, Math.PI, Math.PI * 2);
    ctx.fill();
    /* tall toque */
    const hy = y - r * 0.95 - hatBounce;
    rrect(ctx, x - r * 0.8, hy - 4, r * 1.6, 8, 3, '#ffffff', OUTLINE, 2);
    ell(ctx, x - r * 0.5, hy - 12, r * 0.55, r * 0.5, '#ffffff', OUTLINE, 2);
    ell(ctx, x + r * 0.5, hy - 12, r * 0.55, r * 0.5, '#ffffff', OUTLINE, 2);
    ell(ctx, x, hy - 16, r * 0.62, r * 0.55, '#ffffff', OUTLINE, 2);
    gloss(ctx, x - r * 0.3, hy - 14, r * 0.25, r * 0.12, 0.4);
    /* moustache */
    ctx.strokeStyle = CHEF_HAIR;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y + r * 0.28, r * 0.24, Math.PI * 1.1, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.22, y + r * 0.28, r * 0.24, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
    paintEyePair(ctx, x, y - r * 0.08, r, mood);
    paintMouth(ctx, x, y + r * 0.52, r, mood === 'joy' ? 'big' : mood === 'angry' ? 'angry' : 'joy', CHEF_SKIN);
    blush(ctx, x, y, r);
  }

  function paintChefBody(ctx, hw, yTop, yBot) {
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, shade(CHEF_JACKET, 0.3));
    g.addColorStop(1, shade(CHEF_JACKET, -0.18));
    ctx.fillStyle = g;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-hw, yTop + 3);
    ctx.quadraticCurveTo(-hw - 2.5, (yTop + yBot) / 2, -hw + 1, yBot);
    ctx.lineTo(hw - 1, yBot);
    ctx.quadraticCurveTo(hw + 2.5, (yTop + yBot) / 2, hw, yTop + 3);
    ctx.quadraticCurveTo(0, yTop - 3, -hw, yTop + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    /* apron */
    ctx.fillStyle = '#dcd2bc';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.6, yTop + 6);
    ctx.lineTo(hw * 0.6, yTop + 6);
    ctx.lineTo(hw * 0.75, yBot);
    ctx.lineTo(-hw * 0.75, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* jacket buttons */
    dot(ctx, -hw * 0.3, yTop + 10, 1.4, '#8a8a7a', null);
    dot(ctx, -hw * 0.3, yTop + 18, 1.4, '#8a8a7a', null);
  }

  function paintChefArm(ctx, x0, y0, x1, y1) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = CHEF_JACKET;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    dot(ctx, x1, y1, 3.4, CHEF_SKIN, OUTLINE, 1.5);
  }

  function paintChefLegs(ctx, yHip) {
    paintLeg(ctx, -5, yHip, -5, { shirt: '#3a4a5a' });
    paintLeg(ctx, 5, yHip, 5, { shirt: '#3a4a5a' });
  }

  function paintChefIdle(ctx, frame) {
    const hw = 16, yHip = -16, yTop = -46 - (frame === 1 ? 1.5 : 0), yBot = yHip;
    const headY = yTop - 23 + 6;
    groundShadow(ctx, -1, 22);
    paintChefLegs(ctx, yHip);
    paintChefBody(ctx, hw, yTop, yBot);
    paintChefArm(ctx, -hw, yTop + 8, -hw - 4, yBot - 8);
    paintChefArm(ctx, hw, yTop + 8, hw + 4, yBot - 8);
    paintChefHead(ctx, 0, headY, 23, 'joy', 0);
  }

  function paintChefChop(ctx, frame) {
    const hw = 16, yHip = -16, yTop = -46, yBot = yHip;
    const headY = yTop - 23 + 6;
    groundShadow(ctx, -1, 22);
    paintChefLegs(ctx, yHip);
    paintChefBody(ctx, hw, yTop, yBot);
    /* board and food at counter height */
    rrect(ctx, 4, -30, 22, 4, 1.5, '#c8a878', OUTLINE, 1.5);
    ell(ctx, 14, -33, 5, 3, '#7ab54a', OUTLINE, 1.5);
    paintChefArm(ctx, -hw, yTop + 8, 6, -32);
    /* knife hand: frames 0/1 up, 2/3 down */
    const up = frame < 2;
    const kx = 16, ky = up ? -64 : -38;
    paintChefArm(ctx, hw, yTop + 8, kx, ky);
    ctx.save();
    ctx.translate(kx, ky);
    rrect(ctx, -2, -2, 4, 7, 1, '#6a4a2a', OUTLINE, 1);
    rrect(ctx, -1.5, -14, 3, 12, 1, '#c8ccd4', OUTLINE, 1);
    ctx.restore();
    if (!up) line(ctx, kx - 8, ky - 8, kx - 8, ky - 2, 'rgba(120,120,120,0.5)', 1.5);
    paintChefHead(ctx, 0, headY, 23, 'flat', 0);
  }

  function paintChefFlip(ctx, frame) {
    const hw = 16, yHip = -16, yTop = -46, yBot = yHip;
    const headY = yTop - 23 + 6;
    groundShadow(ctx, -1, 22);
    paintChefLegs(ctx, yHip);
    paintChefBody(ctx, hw, yTop, yBot);
    paintChefArm(ctx, -hw, yTop + 8, -hw - 4, yBot - 8);
    /* pan arm swings up across the frames */
    const lift = [0, 6, 12, 8][frame];
    const px = hw + 14, py = -26 - lift;
    paintChefArm(ctx, hw, yTop + 8, px - 8, py + 2);
    ell(ctx, px, py, 11, 3.5, '#4a4a52', OUTLINE, 2);
    line(ctx, px - 11, py, px - 16, py + 2, '#6a4a2a', 3);
    if (frame < 2) ell(ctx, px, py - 3, 4, 2.5, '#e8a04a', OUTLINE, 1.5);
    else {
      ell(ctx, px - 2, py - 14 - (frame - 2) * 6, 4, 2.5, '#e8a04a', OUTLINE, 1.5);
      line(ctx, px - 8, py - 6, px - 4, py - 12, 'rgba(150,150,150,0.5)', 1.5);
    }
    paintChefHead(ctx, 0, headY, 23, 'flat', 0);
  }

  function paintChefCheer(ctx, frame) {
    const hw = 16, yHip = -16, yTop = -46, yBot = yHip;
    const headY = yTop - 23 + 6 - (frame === 1 ? 2 : 0);
    groundShadow(ctx, -1, 22);
    paintChefLegs(ctx, yHip);
    paintChefBody(ctx, hw, yTop, yBot);
    const wave = frame === 1 ? 4 : 0;
    paintChefArm(ctx, -hw, yTop + 6, -hw - 10, yTop - 10 - wave);
    paintChefArm(ctx, hw, yTop + 6, hw + 10, yTop - 10 + wave);
    paintChefHead(ctx, 0, headY, 23, 'joy', frame === 1 ? 2 : 0);
    gloss(ctx, -hw - 14, yTop - 16, 2, 2, 0.6);
    gloss(ctx, hw + 14, yTop - 16, 2, 2, 0.6);
  }

  const CHEF_PAINTERS = {
    idle: paintChefIdle, chop: paintChefChop, flip: paintChefFlip, cheer: paintChefCheer
  };
  const CHEF_FPS = { idle: [2, 2], chop: [8, 4], flip: [6, 4], cheer: [3, 2] };

  const chefCache = {};

  function getChefSprite(pose, frame) {
    const key = pose + ':' + frame;
    const hit = chefCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = SPR_W;
    canvas.height = SPR_H;
    const ctx = canvas.getContext('2d');
    ctx.translate(SPR_W / 2, SPR_H - PAD * SCALE);
    ctx.scale(SCALE, SCALE);
    (CHEF_PAINTERS[pose] || paintChefIdle)(ctx, frame);
    chefCache[key] = canvas;
    return canvas;
  }

  /* drawChef blits the cached frame centred on cx with the feet at baseY. */
  function drawChef(ctx, cx, baseY, pose, t) {
    const spec = CHEF_FPS[pose] || CHEF_FPS.idle;
    const img = getChefSprite(CHEF_PAINTERS[pose] ? pose : 'idle', frameOf(t, spec[0], spec[1]));
    blit(ctx, img, cx, baseY);
  }

  /* ── mood faces in a speech bubble ── */

  const MOOD_W = 44, MOOD_H = 40;

  function paintMoodFace(ctx, mood) {
    const cx = MOOD_W / 2, cy = MOOD_H / 2 - 2, r = 12;
    const face = mood === 'angry' ? '#e06050' : mood === 'love' ? '#f8b8c0' : '#ffd98a';
    dot(ctx, cx, cy, r, face, OUTLINE, 2);
    if (mood === 'love') {
      heart(ctx, cx - 4.5, cy - 2, 3.4, '#c03050');
      heart(ctx, cx + 4.5, cy - 2, 3.4, '#c03050');
      ctx.strokeStyle = '#a04050';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 4.5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (mood === 'angry') {
      dot(ctx, cx - 4.5, cy - 1.5, 1.8, '#fff', null);
      dot(ctx, cx + 4.5, cy - 1.5, 1.8, '#fff', null);
      dot(ctx, cx - 4.5, cy - 1, 0.9, '#3a2a22', null);
      dot(ctx, cx + 4.5, cy - 1, 0.9, '#3a2a22', null);
      line(ctx, cx - 7, cy - 5.5, cx - 2.5, cy - 4, '#7a2020', 2);
      line(ctx, cx + 7, cy - 5.5, cx + 2.5, cy - 4, '#7a2020', 2);
      ctx.strokeStyle = '#7a2020';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 7, 4, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      line(ctx, cx + r + 1, cy - 6, cx + r + 4, cy - 10, 'rgba(255,255,255,0.7)', 2);
      line(ctx, cx + r + 3, cy - 2, cx + r + 6, cy - 5, 'rgba(255,255,255,0.7)', 2);
    } else if (mood === 'impatient') {
      dot(ctx, cx - 4.5, cy - 1.5, 1.6, '#3a2a22', null);
      dot(ctx, cx + 4.5, cy - 1.5, 1.6, '#3a2a22', null);
      line(ctx, cx - 6.5, cy - 4, cx - 2.5, cy - 4, shade(face, -0.4), 1.5);
      line(ctx, cx + 2.5, cy - 4, cx + 6.5, cy - 4, shade(face, -0.4), 1.5);
      line(ctx, cx - 3.5, cy + 4.5, cx + 3.5, cy + 4.5, '#a06040', 1.5);
      ctx.fillStyle = '#6ab0e0';
      ctx.beginPath();
      ctx.moveTo(cx + r - 2, cy - r + 2);
      ctx.quadraticCurveTo(cx + r + 3, cy - r + 6, cx + r - 1, cy - r + 8);
      ctx.quadraticCurveTo(cx + r - 5, cy - r + 6, cx + r - 2, cy - r + 2);
      ctx.fill();
    } else if (mood === 'ok') {
      dot(ctx, cx - 4.5, cy - 1.5, 1.7, '#3a2a22', null);
      dot(ctx, cx + 4.5, cy - 1.5, 1.7, '#3a2a22', null);
      line(ctx, cx - 3.5, cy + 4.5, cx + 3.5, cy + 4.5, '#a06040', 1.5);
    } else {
      dot(ctx, cx - 4.5, cy - 1.5, 1.8, '#3a2a22', null);
      dot(ctx, cx + 4.5, cy - 1.5, 1.8, '#3a2a22', null);
      ctx.strokeStyle = '#a06040';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 4.5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      blush(ctx, cx, cy, r);
    }
  }

  const moodCache = {};

  function getMoodSprite(mood) {
    const hit = moodCache[mood];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = MOOD_W * SCALE;
    canvas.height = MOOD_H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    rrect(ctx, 1, 1, MOOD_W - 2, MOOD_H - 9, 8, '#ffffff', OUTLINE, 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(MOOD_W / 2 - 5, MOOD_H - 9);
    ctx.lineTo(MOOD_W / 2 - 2, MOOD_H - 1);
    ctx.lineTo(MOOD_W / 2 + 5, MOOD_H - 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MOOD_W / 2 - 5, MOOD_H - 9);
    ctx.lineTo(MOOD_W / 2 - 2, MOOD_H - 1);
    ctx.lineTo(MOOD_W / 2 + 5, MOOD_H - 9);
    ctx.stroke();
    paintMoodFace(ctx, mood);
    moodCache[mood] = canvas;
    return canvas;
  }

  /* drawMood blits the cached bubble+face centred on (cx, cy). */
  function drawMood(ctx, cx, cy, mood, size = 28) {
    const m = MOODS.indexOf(mood) >= 0 ? mood : 'ok';
    const img = getMoodSprite(m);
    const w = size, h = size * MOOD_H / MOOD_W;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  SZ.PeopleArt = Object.freeze({
    randomLook, drawCustomer, drawChef, drawMood
  });
})();
