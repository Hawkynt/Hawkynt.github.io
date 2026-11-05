/* Character art, painted once into cached sprites: Pac-Man in every skin (shaded body, eye and
   accessory, seven mouth openings, facing right), the death spin drawn live, ghost bodies per
   colour and kind (Gobbler jaws, Dasher fins, Phantom wisps) with two skirt frames, eyes for
   each direction, frightened and flashing bodies, ice and stun overlays, and the five bosses
   with their scared and hit-flash variants. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const K = NS.artKit;
  const { SKIN_BY_ID } = NS.cosmetics;
  const { BOSSES } = NS.worlds;
  const TAU = Math.PI * 2;

  const PAC = 48, PR = 17;
  const MOUTHS = 7;

  /* ── Pac-Man ── */
  function mouthAngle(i) {
    return (i / (MOUTHS - 1)) * 0.36 * Math.PI;
  }

  function pacBody(g, cx, cy, r, a, skin) {
    g.beginPath();
    g.moveTo(cx - r * 0.18, cy);
    g.arc(cx, cy, r, a, TAU - a);
    g.closePath();
    if (skin.acc === 'pixel') {
      g.save();
      g.clip();
      g.fillStyle = skin.body;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.fillStyle = skin.deep;
      for (let y = -r; y < r; y += 4)
        for (let x = -r; x < r; x += 4)
          if ((x * x + y * y > (r - 4) * (r - 4)) || ((x + y) / 4) % 3 === 0) g.fillRect(cx + x, cy + y, 4, 4);
      g.restore();
      return;
    }
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.05);
    gr.addColorStop(0, K.shade(skin.body, 0.45));
    gr.addColorStop(0.55, skin.body);
    gr.addColorStop(1, skin.deep);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = K.rgba(K.shade(skin.deep, -0.5), 0.8);
    g.lineWidth = 1.2;
    g.stroke();
  }

  function accessory(g, cx, cy, r, a, skin) {
    switch (skin.acc) {
      case 'bow':
        g.fillStyle = '#ff2a5a';
        g.beginPath(); g.ellipse(cx - 4, cy - r + 1, 6, 4, -0.5, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(cx + 6, cy - r - 1, 6, 4, 0.5, 0, TAU); g.fill();
        g.fillStyle = '#ffd0e0';
        g.beginPath(); g.arc(cx + 1, cy - r, 2.4, 0, TAU); g.fill();
        break;
      case 'leaf':
        g.strokeStyle = '#3a8a2a'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx - 2, cy - r + 2); g.quadraticCurveTo(cx, cy - r - 8, cx + 6, cy - r - 9); g.stroke();
        g.fillStyle = '#5ad84a';
        g.beginPath(); g.ellipse(cx + 8, cy - r - 8, 6, 3, -0.4, 0, TAU); g.fill();
        break;
      case 'chips':
        g.fillStyle = '#5a3018';
        for (let i = 0; i < 6; ++i) { const t = i * 1.7 + 0.6; g.beginPath(); g.arc(cx - 4 + Math.cos(t) * r * 0.55, cy + Math.sin(t) * r * 0.55, 1.8, 0, TAU); g.fill(); }
        break;
      case 'antenna':
        g.strokeStyle = '#8a9ab8'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - 2, cy - r + 1); g.lineTo(cx - 4, cy - r - 8); g.stroke();
        g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(cx - 4, cy - r - 9, 2.6, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(60,70,90,0.6)'; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, r * 0.62, -2.6, -1.4); g.stroke();
        break;
      case 'band':
        g.save();
        g.beginPath(); g.arc(cx, cy, r + 0.5, a, TAU - a); g.lineTo(cx, cy); g.closePath(); g.clip();
        g.fillStyle = '#e8203a';
        g.fillRect(cx - r - 2, cy - r * 0.55, r * 2 + 4, 5);
        g.restore();
        g.fillStyle = '#e8203a';
        g.beginPath(); g.moveTo(cx - r + 1, cy - r * 0.5); g.lineTo(cx - r - 8, cy - r * 0.8); g.lineTo(cx - r - 6, cy - r * 0.3); g.closePath(); g.fill();
        break;
      case 'stars':
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 9; ++i) { const t = i * 2.3; g.globalAlpha = 0.5 + (i % 3) * 0.2; g.fillRect(cx - 6 + Math.cos(t) * r * 0.6, cy + Math.sin(t * 1.3) * r * 0.6, 1.6, 1.6); }
        g.globalAlpha = 1;
        break;
      case 'shine':
        g.fillStyle = '#ffffff';
        K.starPath(g, cx - r * 0.4, cy - r * 0.45, 4, 0.3, 4); g.fill();
        K.starPath(g, cx + r * 0.1, cy + r * 0.45, 2.6, 0.3, 4); g.fill();
        break;
      case 'crown':
        g.fillStyle = '#ffd23a';
        g.strokeStyle = '#a06a00'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - 9, cy - r + 3); g.lineTo(cx - 10, cy - r - 8); g.lineTo(cx - 5, cy - r - 3); g.lineTo(cx, cy - r - 10);
        g.lineTo(cx + 5, cy - r - 3); g.lineTo(cx + 10, cy - r - 8); g.lineTo(cx + 9, cy - r + 3); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#ff3a6a'; g.beginPath(); g.arc(cx, cy - r - 2, 1.8, 0, TAU); g.fill();
        break;
      case 'stem':
        g.strokeStyle = K.rgba('#6a2a00', 0.5); g.lineWidth = 1.4;
        for (let k = -1; k <= 1; ++k) { g.beginPath(); g.ellipse(cx + k * 6, cy, 3 + Math.abs(k) * 4, r * 0.95, 0, -2.2, -0.9); g.stroke(); }
        g.fillStyle = '#3a7a1a'; g.fillRect(cx - 2, cy - r - 6, 4, 8);
        break;
      case 'scarf':
        g.fillStyle = '#e8203a';
        g.fillRect(cx - r * 0.9, cy + r * 0.45, r * 1.2, 5);
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 4; ++i) g.fillRect(cx - r * 0.8 + i * 6, cy + r * 0.45, 2, 5);
        g.fillStyle = '#e8203a'; g.fillRect(cx - r * 0.7, cy + r * 0.45, 5, 11);
        g.fillStyle = '#1a2a4a'; g.beginPath(); g.ellipse(cx - 1, cy - r + 1, r * 0.75, 5, 0, Math.PI, TAU); g.fill();
        break;
      case 'santa':
        g.fillStyle = '#e8203a';
        g.beginPath(); g.moveTo(cx - 12, cy - r + 4); g.quadraticCurveTo(cx - 2, cy - r - 16, cx + 14, cy - r - 6); g.lineTo(cx + 10, cy - r + 4); g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(cx - 13, cy - r + 2, 24, 4);
        g.beginPath(); g.arc(cx + 15, cy - r - 6, 3.4, 0, TAU); g.fill();
        break;
      case 'ears':
        for (let k = 0; k < 2; ++k) {
          const ex = cx - 7 + k * 9;
          g.fillStyle = skin.body;
          g.beginPath(); g.ellipse(ex, cy - r - 7, 3.6, 10, (k - 0.5) * 0.4, 0, TAU); g.fill();
          g.fillStyle = '#ff9ac8';
          g.beginPath(); g.ellipse(ex, cy - r - 6, 1.8, 7, (k - 0.5) * 0.4, 0, TAU); g.fill();
        }
        break;
      case 'shades':
        g.fillStyle = '#101018';
        g.beginPath(); g.ellipse(cx + 1, cy - r * 0.42, 6, 4, 0, 0, TAU); g.fill();
        g.fillRect(cx - 9, cy - r * 0.5, 10, 2);
        g.fillStyle = 'rgba(120,200,255,0.6)'; g.fillRect(cx - 2, cy - r * 0.55, 3, 1.4);
        return true;
      case 'cap':
        g.fillStyle = '#6a3a14';
        g.beginPath(); g.ellipse(cx - 1, cy - r + 3, r * 0.85, 7, 0, Math.PI, TAU); g.fill();
        g.strokeStyle = '#3a1a04'; g.lineWidth = 1;
        for (let i = -3; i <= 3; ++i) { g.beginPath(); g.moveTo(cx + i * 4 - 2, cy - r + 3); g.lineTo(cx + i * 4 + 1, cy - r - 3); g.stroke(); }
        g.fillStyle = '#4a2a0a'; g.fillRect(cx - 1, cy - r - 8, 2.4, 5);
        break;
    }
    return false;
  }

  function pac(skinId, mouth) {
    const skin = SKIN_BY_ID[skinId] || SKIN_BY_ID.classic;
    const i = Math.max(0, Math.min(MOUTHS - 1, mouth));
    return K.sprite('pac:' + skin.id + ':' + i, PAC, PAC, (g) => {
      const cx = PAC / 2, cy = PAC / 2 + 2, a = mouthAngle(i);
      pacBody(g, cx, cy, PR, a, skin);
      const hidesEye = accessory(g, cx, cy, PR, a, skin);
      if (!hidesEye) {
        g.fillStyle = '#1a1020';
        g.beginPath(); g.ellipse(cx + 2, cy - PR * 0.5, 2.2, 2.8, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(cx + 2.6, cy - PR * 0.58, 0.9, 0, TAU); g.fill();
      }
    });
  }

  /* mouth frame index from a phase that runs while moving */
  function mouthIndex(phase) {
    const t = (phase % 2 + 2) % 2;
    const k = t < 1 ? t : 2 - t;
    return Math.round(k * (MOUTHS - 1));
  }

  /* the death: the mouth opens all the way around, then a pop */
  function drawDeath(ctx, x, y, t, skinId, scale) {
    const skin = SKIN_BY_ID[skinId] || SKIN_BY_ID.classic;
    const k = Math.min(1, t / 1.3);
    if (k >= 1) return;
    const a = 0.2 + k * Math.PI * 0.98;
    const r = PR * 0.68 * (scale || 1) * (1 - k * 0.15);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a, TAU - a);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ── ghosts ── */
  const GS = 40;

  function ghostPath(g, cx, top, w, h, frame, wisp) {
    const x0 = cx - w / 2, x1 = cx + w / 2, bot = top + h;
    g.beginPath();
    g.moveTo(x0, bot - 4);
    g.lineTo(x0, top + w / 2);
    g.arc(cx, top + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x1, bot - 4);
    if (wisp) {
      g.quadraticCurveTo(x1 - 2, bot + 6, cx + 4 + frame * 3, bot + 10);
      g.quadraticCurveTo(cx, bot, x0 + 2, bot + 2 - frame * 3);
      g.closePath();
      return;
    }
    const n = 4, step = w / n;
    for (let i = 0; i < n; ++i) {
      const xa = x1 - i * step, xm = xa - step / 2, xb = xa - step;
      const dip = (i + frame) % 2 === 0 ? 5 : 2;
      g.quadraticCurveTo(xa - step * 0.1, bot + 3, xm, bot - dip + 3);
      g.quadraticCurveTo(xb + step * 0.1, bot + 3, xb, bot - 2);
    }
    g.closePath();
  }

  function ghost(color, kind, frame) {
    return K.sprite('ghost:' + color + ':' + kind + ':' + frame, GS, GS + 6, (g) => {
      const cx = GS / 2, top = 6, w = 30, h = 30;
      const wisp = kind === 'phantom';
      if (kind === 'dasher') {
        g.fillStyle = K.shade(color, -0.3);
        g.beginPath(); g.moveTo(cx - 8, top + 5); g.lineTo(cx - 13, top - 4); g.lineTo(cx - 3, top + 2); g.fill();
        g.beginPath(); g.moveTo(cx + 8, top + 5); g.lineTo(cx + 13, top - 4); g.lineTo(cx + 3, top + 2); g.fill();
      }
      ghostPath(g, cx, top, w, h, frame, wisp);
      const gr = g.createLinearGradient(0, top, 0, top + h);
      gr.addColorStop(0, K.shade(color, 0.35));
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, K.shade(color, -0.35));
      g.fillStyle = gr;
      if (wisp) g.globalAlpha = 0.82;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = K.rgba(K.shade(color, -0.6), 0.85);
      g.lineWidth = 1.3;
      g.stroke();
      /* dome sheen */
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath(); g.ellipse(cx - 6, top + 7, 6, 3.4, -0.5, 0, TAU); g.fill();
      if (kind === 'gobbler') {
        g.fillStyle = '#2a0a10';
        g.beginPath(); g.ellipse(cx, top + 22, 9, 4.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffffff';
        for (let i = -3; i <= 3; ++i) { g.beginPath(); g.moveTo(cx + i * 2.6 - 1.2, top + 18.5); g.lineTo(cx + i * 2.6, top + 21.5); g.lineTo(cx + i * 2.6 + 1.2, top + 18.5); g.fill(); }
      }
      if (kind === 'dasher') {
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
        for (let i = 0; i < 3; ++i) { g.beginPath(); g.moveTo(cx - 13, top + 14 + i * 4); g.lineTo(cx - 7, top + 14 + i * 4); g.stroke(); }
      }
    });
  }

  function eyes(dir) {
    return K.sprite('eyes:' + dir, GS, GS + 6, (g) => {
      const cx = GS / 2, cy = 6 + 13;
      const dx = [-1, 0, 1, 0][dir] || 0, dy = [0, -1, 0, 1][dir] || 0;
      for (let k = -1; k <= 1; k += 2) {
        const ex = cx + k * 6 + dx * 1.5, ey = cy + dy * 1.5;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(ex, ey, 4.6, 5.6, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a3aff';
        g.beginPath(); g.arc(ex + dx * 2.2, ey + dy * 2.6, 2.6, 0, TAU); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(ex + dx * 2.2 - 0.8, ey + dy * 2.6 - 0.9, 0.8, 0, TAU); g.fill();
      }
    });
  }

  function scared(frame, white) {
    return K.sprite('scared:' + frame + ':' + (white ? 1 : 0), GS, GS + 6, (g) => {
      const cx = GS / 2, top = 6, w = 30, h = 30;
      const body = white ? '#f4f4ff' : '#2a3aff';
      ghostPath(g, cx, top, w, h, frame, false);
      const gr = g.createLinearGradient(0, top, 0, top + h);
      gr.addColorStop(0, K.shade(body, 0.3));
      gr.addColorStop(1, K.shade(body, -0.3));
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = white ? '#9a9ac8' : '#0a1060';
      g.lineWidth = 1.2;
      g.stroke();
      const face = white ? '#ff3a3a' : '#ffd8b0';
      g.fillStyle = face;
      g.fillRect(cx - 7, top + 11, 4, 4);
      g.fillRect(cx + 3, top + 11, 4, 4);
      g.strokeStyle = face;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i <= 6; ++i) g.lineTo(cx - 9 + i * 3, top + 21 + (i % 2 ? -2 : 1));
      g.stroke();
    });
  }

  function ice() {
    return K.sprite('icecube', GS, GS + 6, (g) => {
      g.fillStyle = 'rgba(170,235,255,0.42)';
      K.roundRect(g, 3, 4, GS - 6, GS - 2, 6);
      g.fill();
      g.strokeStyle = 'rgba(230,250,255,0.9)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.moveTo(9, 10); g.lineTo(15, 8); g.moveTo(8, 15); g.lineTo(10, 12); g.stroke();
    });
  }

  /* ── bosses ── */
  const BS = 120;

  function boss(id, mode) {
    return K.sprite('boss:' + id + ':' + mode, BS, BS, (g) => {
      const d = BOSSES[id];
      const color = mode === 'scared' ? '#2a3aff' : mode === 'flash' ? '#ffffff' : d.color;
      const cx = BS / 2, top = 18, w = 84, h = 86;
      /* back details */
      if (id === 'banshee' && mode !== 'flash') {
        g.fillStyle = K.rgba(K.shade(color, -0.2), 0.6);
        for (let i = 0; i < 6; ++i) {
          g.beginPath();
          g.moveTo(cx - 30 + i * 12, top + 20);
          g.quadraticCurveTo(cx - 44 + i * 16, top + 70, cx - 50 + i * 20, top + 98);
          g.lineTo(cx - 40 + i * 16, top + 60);
          g.closePath();
          g.fill();
        }
      }
      if (id === 'king' && mode !== 'flash') {
        g.fillStyle = '#5a0a3a';
        g.beginPath(); g.moveTo(cx - 46, top + 30); g.lineTo(cx - 54, top + 98); g.lineTo(cx + 54, top + 98); g.lineTo(cx + 46, top + 30); g.closePath(); g.fill();
        g.strokeStyle = '#ffd23a'; g.lineWidth = 2; g.stroke();
      }
      g.save();
      g.translate(cx, top);
      g.scale(w / 30, h / 30);
      g.translate(-cx, -top);
      ghostPath(g, cx, top, 30, 30, 0, false);
      g.restore();
      const gr = g.createLinearGradient(0, top, 0, top + h);
      gr.addColorStop(0, K.shade(color, 0.35));
      gr.addColorStop(0.55, color);
      gr.addColorStop(1, K.shade(color, -0.45));
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = K.rgba(K.shade(color, -0.7), 0.9);
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(cx - 18, top + 18, 16, 8, -0.5, 0, TAU); g.fill();
      if (mode === 'flash') return;
      /* face */
      const angry = mode !== 'scared';
      for (let k = -1; k <= 1; k += 2) {
        const ex = cx + k * 17, ey = top + 38;
        g.fillStyle = angry ? '#ffffff' : '#ffd8b0';
        g.beginPath(); g.ellipse(ex, ey, 11, angry ? 9 : 5, 0, 0, TAU); g.fill();
        if (angry) {
          g.fillStyle = id === 'frostmaw' ? '#00a0ff' : '#e8002a';
          g.beginPath(); g.arc(ex - k * 2, ey + 2, 5, 0, TAU); g.fill();
          g.strokeStyle = '#1a0010'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(ex - k * 12, ey - 14); g.lineTo(ex + k * 6, ey - 7); g.stroke();
        }
      }
      if (angry) {
        g.fillStyle = '#1a0010';
        g.beginPath(); g.ellipse(cx, top + 62, id === 'frostmaw' ? 26 : 20, id === 'frostmaw' ? 13 : 8, 0, 0, Math.PI); g.fill();
        g.fillStyle = id === 'frostmaw' ? '#c8f8ff' : '#ffffff';
        const n = id === 'frostmaw' ? 7 : 5;
        for (let i = 0; i < n; ++i) {
          const tx = cx - (n - 1) * 3.6 + i * 7.2;
          g.beginPath(); g.moveTo(tx - 3, top + 62); g.lineTo(tx, top + 62 + (id === 'frostmaw' ? 11 : 6)); g.lineTo(tx + 3, top + 62); g.fill();
        }
      } else {
        g.strokeStyle = '#ffd8b0'; g.lineWidth = 3;
        g.beginPath();
        for (let i = 0; i <= 8; ++i) g.lineTo(cx - 24 + i * 6, top + 62 + (i % 2 ? -4 : 2));
        g.stroke();
      }
      /* crowns and trims */
      if (d.crown) {
        g.fillStyle = '#ffd23a';
        g.strokeStyle = '#8a5a00'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cx - 26, top + 6); g.lineTo(cx - 30, top - 16); g.lineTo(cx - 14, top - 4); g.lineTo(cx, top - 22);
        g.lineTo(cx + 14, top - 4); g.lineTo(cx + 30, top - 16); g.lineTo(cx + 26, top + 6); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = id === 'king' ? '#b98cff' : '#ff3a8a';
        g.beginPath(); g.arc(cx, top - 6, 4, 0, TAU); g.fill();
      }
      if (id === 'colossus') {
        g.fillStyle = '#ffd23a';
        for (let i = 0; i < 5; ++i) { const a = -Math.PI * (0.15 + i * 0.175); g.beginPath(); g.moveTo(cx + Math.cos(a) * 40, top + 42 + Math.sin(a) * 40); g.lineTo(cx + Math.cos(a) * 56, top + 42 + Math.sin(a) * 56); g.lineTo(cx + Math.cos(a + 0.1) * 40, top + 42 + Math.sin(a + 0.1) * 40); g.fill(); }
      }
      if (id === 'gumdrop') {
        const cols = ['#ff3a6a', '#3ad8ff', '#ffd23a', '#7aff5a'];
        for (let i = 0; i < 9; ++i) { g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(cx - 32 + i * 8, top + 76 + (i % 2) * 4, 3, 0, TAU); g.fill(); }
      }
      if (id === 'frostmaw') {
        g.fillStyle = 'rgba(220,250,255,0.9)';
        for (let i = 0; i < 6; ++i) { g.beginPath(); g.moveTo(cx - 36 + i * 14, top + 4 + Math.abs(i - 2.5) * 5); g.lineTo(cx - 30 + i * 14, top - 12 + Math.abs(i - 2.5) * 6); g.lineTo(cx - 25 + i * 14, top + 6 + Math.abs(i - 2.5) * 5); g.fill(); }
      }
    });
  }

  Object.assign(NS.actorArt, {
    pac, mouthIndex, drawDeath, ghost, eyes, scared, ice, boss, PAC, GS, BS, PR
  });
})();
