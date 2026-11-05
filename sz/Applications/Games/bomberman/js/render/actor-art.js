/* Character art, painted once per pose and cached: the bomber in every skin (four facings, four
   walk frames, thirteen hats and visors), Professor Fuse for the cinematics, and the ten enemy
   kinds with their own idle/walk animation frames. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const { SKINS } = NS.meta;
  const { ENEMY_BY_ID } = NS.content;
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  const W = 64, H = 76;
  const FUSE = { id: 'fuse', suit: '#f2f2f2', trim: '#8a8a9a', head: '#ffe0c4', face: '#ffe0c4', accent: '#7a5a3a', hat: 'goggles', beard: true };

  function skinDef(id) {
    if (id === 'fuse') return FUSE;
    for (let i = 0; i < SKINS.length; ++i) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  /* The bomber facing dir (0 down, 1 up, 2 left, 3 right) on walk frame f */
  function bomber(skinId, dir, f) {
    return K.sprite('bomber:' + skinId + ':' + dir + ':' + f, W, H, (x) => {
      if (dir === 2) { x.translate(W, 0); x.scale(-1, 1); dir = 3; }
      paintBomber(x, skinDef(skinId), dir, f);
    });
  }

  function paintBomber(x, s, dir, f) {
    const step = f === 1 ? 1 : f === 3 ? -1 : 0;
    const bob = step ? -1.5 : 0;
    const side = dir === 3;
    const boot = K.shade(s.accent, -0.1);
    /* feet */
    if (side) {
      K.ellipse(x, 30 + step * 5, 68, 8, 5, boot);
      K.ellipse(x, 34 - step * 5, 69, 8, 5, K.shade(boot, -0.2));
    } else {
      K.ellipse(x, 24, 68 - (step > 0 ? 3 : 0), 7.5, 5, boot);
      K.ellipse(x, 40, 68 - (step < 0 ? 3 : 0), 7.5, 5, boot);
    }
    /* body */
    const by = 52 + bob;
    const bg = x.createRadialGradient(28, by - 6, 2, 32, by, 16);
    bg.addColorStop(0, K.shade(s.suit, 0.3)); bg.addColorStop(1, K.shade(s.suit, -0.25));
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(32, by, 13, 11.5, 0, 0, TAU); x.fill();
    x.fillStyle = s.trim; x.fillRect(19.5, by + 1, 25, 4);
    if (!side && dir === 0) K.circle(x, 32, by + 3, 3, '#ffd84a');
    if (s.beard && dir !== 1) {
      x.fillStyle = '#ffffff';
      x.beginPath(); x.moveTo(side ? 30 : 22, by - 12); x.quadraticCurveTo(side ? 40 : 32, by + 12, side ? 46 : 42, by - 12); x.fill();
    }
    /* hands */
    const swing = step * 3;
    if (side) K.ball(x, 32 + swing * 1.4, by + 2, 5.5, s.accent);
    else {
      K.ball(x, 17, by + swing, 5.5, s.accent);
      K.ball(x, 47, by - swing, 5.5, s.accent);
    }
    /* head */
    const hy = 29 + bob;
    const hg = x.createRadialGradient(26, hy - 8, 3, 32, hy, 19);
    hg.addColorStop(0, K.shade(s.head, 0.4)); hg.addColorStop(0.7, s.head); hg.addColorStop(1, K.shade(s.head, -0.25));
    x.fillStyle = hg;
    x.beginPath(); x.arc(32, hy, 18, 0, TAU); x.fill();
    /* face visor */
    if (dir !== 1) {
      const fx = side ? 38 : 32, fw = side ? 17 : 24;
      x.fillStyle = s.face;
      K.roundRect(x, fx - fw / 2, hy - 6, fw, 15, 7); x.fill();
      x.strokeStyle = K.shade(s.face, -0.3); x.lineWidth = 1; x.stroke();
      const eyeC = s.hat === 'antenna' ? '#4ff0ff' : s.hat === 'stem' ? '#ffcc33' : '#1a1020';
      const ex = side ? [37, 43] : [27, 37];
      for (let i = 0; i < 2; ++i) {
        if (s.hat === 'stem') { x.fillStyle = eyeC; x.beginPath(); x.moveTo(ex[i] - 3, hy + 3); x.lineTo(ex[i] + 3, hy + 3); x.lineTo(ex[i], hy - 3); x.fill(); continue; }
        K.ellipse(x, ex[i], hy + 1.5, 2.2, 4, eyeC);
        K.circle(x, ex[i] + 0.8, hy - 0.5, 1, '#ffffff');
      }
      if (s.hat !== 'antenna' && s.hat !== 'stem' && !s.beard) {
        K.circle(x, ex[0] - 3, hy + 7, 2, 'rgba(255,110,140,0.45)');
        K.circle(x, ex[1] + 3, hy + 7, 2, 'rgba(255,110,140,0.45)');
      }
      if (s.hat === 'shades') {
        x.fillStyle = '#1a1a24';
        K.roundRect(x, fx - fw / 2, hy - 3, fw, 7, 3); x.fill();
        x.fillStyle = 'rgba(120,220,255,0.6)'; x.fillRect(fx - fw / 2 + 2, hy - 2, 4, 2);
      }
      if (s.hat === 'goggles') {
        x.strokeStyle = '#7a5a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(14, hy - 9); x.lineTo(50, hy - 9); x.stroke();
        K.circle(x, side ? 40 : 26, hy - 10, 5, '#c89a3a'); K.circle(x, side ? 40 : 26, hy - 10, 3, '#9af0ff');
        if (!side) { K.circle(x, 38, hy - 10, 5, '#c89a3a'); K.circle(x, 38, hy - 10, 3, '#9af0ff'); }
      }
    } else if (s.hat === 'band' || s.hat === 'goggles') {
      x.strokeStyle = s.hat === 'band' ? s.trim : '#7a5a3a'; x.lineWidth = 4; x.beginPath(); x.moveTo(14, hy - 3); x.lineTo(50, hy - 3); x.stroke();
    }
    hat(x, s, dir, hy, side);
  }

  function hat(x, s, dir, hy, side) {
    const top = hy - 18;
    const antenna = () => {
      x.strokeStyle = K.shade(s.head, -0.3); x.lineWidth = 2;
      x.beginPath(); x.moveTo(32, top + 1); x.lineTo(32, top - 6); x.stroke();
      K.ball(x, 32, top - 8, 4.5, s.accent);
    };
    switch (s.hat) {
      case '': antenna(); break;
      case 'bow':
        antenna();
        x.fillStyle = s.accent;
        x.beginPath(); x.moveTo(42, top + 4); x.lineTo(52, top - 2); x.lineTo(52, top + 10); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(42, top + 4); x.lineTo(34, top - 2); x.lineTo(36, top + 10); x.closePath(); x.fill();
        K.circle(x, 42, top + 4, 3, K.shade(s.accent, -0.2));
        break;
      case 'band':
        x.fillStyle = s.trim; x.fillRect(14, hy - 9, 36, 6);
        if (dir !== 0) { x.beginPath(); x.moveTo(side ? 16 : 30, hy - 7); x.lineTo(side ? 4 : 26, hy + 6); x.lineTo(side ? 10 : 34, hy + 6); x.fill(); }
        break;
      case 'antenna':
        x.strokeStyle = '#4a5560'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(24, top + 3); x.lineTo(20, top - 7); x.moveTo(40, top + 3); x.lineTo(44, top - 7); x.stroke();
        K.circle(x, 20, top - 8, 3, s.accent); K.circle(x, 44, top - 8, 3, s.accent);
        x.fillStyle = '#4a5560'; x.fillRect(12, hy - 2, 4, 8); x.fillRect(48, hy - 2, 4, 8);
        break;
      case 'helm':
        x.fillStyle = '#9aa4b4';
        x.beginPath(); x.arc(32, hy - 2, 19, Math.PI, 0); x.fill();
        x.fillStyle = s.accent;
        x.beginPath(); x.moveTo(30, top - 2); x.quadraticCurveTo(44, top - 16, 50, top - 2); x.quadraticCurveTo(42, top - 6, 34, top + 2); x.fill();
        x.fillStyle = s.trim; x.fillRect(13, hy - 3, 38, 3);
        break;
      case 'eyes':
        K.ball(x, 22, top + 2, 6, s.head); K.ball(x, 42, top + 2, 6, s.head);
        if (dir !== 1) { K.circle(x, 22, top + 2, 3, '#1a1020'); K.circle(x, 42, top + 2, 3, '#1a1020'); }
        break;
      case 'crown':
        x.fillStyle = '#ffd84a';
        x.beginPath(); x.moveTo(20, top + 6); x.lineTo(20, top - 6); x.lineTo(26, top); x.lineTo(32, top - 9); x.lineTo(38, top); x.lineTo(44, top - 6); x.lineTo(44, top + 6); x.closePath(); x.fill();
        K.circle(x, 32, top + 1, 2.5, '#ff4f7a');
        break;
      case 'tophat':
        x.fillStyle = '#1a1020'; x.fillRect(16, top + 3, 32, 4); x.fillRect(21, top - 14, 22, 18);
        x.fillStyle = s.trim; x.fillRect(21, top - 1, 22, 4);
        break;
      case 'beanie':
        x.fillStyle = s.trim; x.beginPath(); x.arc(32, hy - 4, 18.5, Math.PI, 0); x.fill();
        x.fillStyle = '#ffffff'; x.fillRect(13, hy - 6, 38, 5);
        K.circle(x, 32, top - 3, 5, '#ffffff');
        break;
      case 'ears':
        for (const ex of [24, 40]) {
          x.fillStyle = s.head; x.beginPath(); x.ellipse(ex, top - 8, 5, 13, ex < 32 ? -0.2 : 0.2, 0, TAU); x.fill();
          x.fillStyle = '#ffb0d0'; x.beginPath(); x.ellipse(ex, top - 7, 2.5, 9, ex < 32 ? -0.2 : 0.2, 0, TAU); x.fill();
        }
        break;
      case 'shades': antenna(); break;
      case 'stem':
        x.fillStyle = '#4a8a2a'; x.fillRect(29, top - 6, 6, 9);
        x.fillStyle = '#6fd040'; x.beginPath(); x.ellipse(39, top - 3, 6, 3, 0.4, 0, TAU); x.fill();
        x.strokeStyle = K.rgba('#c05a0a', 0.6); x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(24, top + 2); x.quadraticCurveTo(20, hy, 24, hy + 16); x.moveTo(40, top + 2); x.quadraticCurveTo(44, hy, 40, hy + 16); x.stroke();
        break;
      case 'cone':
        x.fillStyle = s.trim; x.beginPath(); x.moveTo(22, top + 5); x.lineTo(32, top - 18); x.lineTo(42, top + 5); x.closePath(); x.fill();
        x.strokeStyle = s.accent; x.lineWidth = 3; x.beginPath(); x.moveTo(26, top - 3); x.lineTo(38, top - 1); x.moveTo(29, top - 10); x.lineTo(35, top - 9); x.stroke();
        K.circle(x, 32, top - 19, 3.5, s.accent);
        break;
      case 'goggles':
        x.fillStyle = '#f4f4f4';
        for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(32 + sx * 17, hy + 2, 6, 9, sx * 0.3, 0, TAU); x.fill(); }
        break;
    }
  }

  /* ── enemies: 56 x 56, feet near y 52; frame 0..3 ── */
  const EW = 56, EH = 56;

  function enemy(type, f, flip) {
    return K.sprite('enemy:' + type + ':' + f + ':' + (flip ? 1 : 0), EW, EH, (x) => {
      if (flip) { x.translate(EW, 0); x.scale(-1, 1); }
      const def = ENEMY_BY_ID[type] || ENEMY_BY_ID.puff;
      (PAINT[type] || PAINT.puff)(x, def.color, f);
    });
  }

  function eyes(x, cx, cy, gap, r, look, angry) {
    for (const s of [-1, 1]) {
      K.ellipse(x, cx + s * gap, cy, r, r * 1.25, '#ffffff');
      K.circle(x, cx + s * gap + look, cy + 1, r * 0.55, '#1a1020');
      if (angry) {
        x.strokeStyle = '#1a1020'; x.lineWidth = 2.5;
        x.beginPath(); x.moveTo(cx + s * gap - r, cy - r * 1.6 + (s > 0 ? 0 : 3)); x.lineTo(cx + s * gap + r, cy - r * 1.6 + (s > 0 ? 3 : 0)); x.stroke();
      }
    }
  }

  const PAINT = {
    puff(x, c, f) {
      const b = Math.sin(f * Math.PI / 2) * 2;
      x.strokeStyle = '#ffffff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(28, 40 + b); x.quadraticCurveTo(24 + f, 48, 28, 54); x.stroke();
      K.ball(x, 28, 24 + b, 17, c);
      x.fillStyle = K.shade(c, -0.2); x.beginPath(); x.moveTo(24, 40 + b); x.lineTo(32, 40 + b); x.lineTo(28, 44 + b); x.fill();
      eyes(x, 28, 22 + b, 6, 4, 1.5, false);
      x.strokeStyle = '#1a1020'; x.lineWidth = 2; x.beginPath(); x.arc(28, 28 + b, 4, 0.2, Math.PI - 0.2); x.stroke();
    },
    zapper(x, c, f) {
      x.strokeStyle = '#e8fbff'; x.lineWidth = 2.5;
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6 + f * 0.26;
        x.beginPath(); x.moveTo(28 + Math.cos(a) * 14, 30 + Math.sin(a) * 14);
        x.lineTo(28 + Math.cos(a + 0.2) * 20, 30 + Math.sin(a + 0.2) * 20); x.lineTo(28 + Math.cos(a - 0.1) * 25, 30 + Math.sin(a - 0.1) * 25); x.stroke();
      }
      K.ball(x, 28, 30, 15, c);
      K.circle(x, 28, 30, 8, K.shade(c, 0.5));
      eyes(x, 28, 29, 5, 3.5, 1, true);
    },
    hopper(x, c, f) {
      const sq = [1, 0.85, 1.12, 0.9][f];
      x.save(); x.translate(28, 52); x.scale(1 / sq, sq);
      K.ball(x, 0, -16, 17, c);
      K.ellipse(x, 0, -9, 12, 6, K.shade(c, 0.45));
      x.restore();
      const top = 52 - 30 * sq;
      K.ball(x, 19, top + 2, 6, c); K.ball(x, 37, top + 2, 6, c);
      K.circle(x, 20, top + 2, 3, '#1a1020'); K.circle(x, 38, top + 2, 3, '#1a1020');
      x.strokeStyle = '#1a1020'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 52 - 14 * sq); x.quadraticCurveTo(28, 52 - 10 * sq, 36, 52 - 14 * sq); x.stroke();
    },
    hunter(x, c, f) {
      K.ellipse(x, 28, 50, 12, 4, 'rgba(0,0,0,0.25)');
      x.fillStyle = K.shade(c, -0.4);
      x.beginPath(); x.moveTo(14, 18); x.lineTo(8, 4 + f); x.lineTo(20, 12); x.fill();
      x.beginPath(); x.moveTo(42, 18); x.lineTo(48, 4 + f); x.lineTo(36, 12); x.fill();
      x.fillStyle = c; K.roundRect(x, 10, 12, 36, 38, 14); x.fill();
      x.fillStyle = K.shade(c, -0.35); K.roundRect(x, 14, 20, 28, 12, 6); x.fill();
      K.ellipse(x, 21, 26, 4, 3, '#ffe066'); K.ellipse(x, 35, 26, 4, 3, '#ffe066');
      x.fillStyle = '#1a1020'; x.fillRect(20, 38, 16, 3);
      x.fillStyle = '#ffffff'; x.fillRect(22, 38, 3, 3); x.fillRect(31, 38, 3, 3);
      K.ellipse(x, 18, 50 - (f % 2) * 2, 6, 3, K.shade(c, -0.4)); K.ellipse(x, 38, 50 - ((f + 1) % 2) * 2, 6, 3, K.shade(c, -0.4));
    },
    wisp(x, c, f) {
      x.globalAlpha = 0.85;
      const g = x.createLinearGradient(0, 8, 0, 52);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, K.rgba(c, 0.2));
      x.fillStyle = g;
      x.beginPath(); x.arc(28, 22, 16, Math.PI, 0);
      for (let i = 0; i <= 4; ++i) x.lineTo(44 - i * 8, 46 + Math.sin(f * 1.5 + i) * 4 + (i % 2) * 4);
      x.closePath(); x.fill();
      x.globalAlpha = 1;
      K.ellipse(x, 22, 22, 3.5, 5, '#3a2a5a'); K.ellipse(x, 34, 22, 3.5, 5, '#3a2a5a');
      K.ellipse(x, 28, 32, 3, 4, '#3a2a5a');
    },
    brute(x, c, f) {
      K.ellipse(x, 28, 51, 18, 4, 'rgba(0,0,0,0.3)');
      x.fillStyle = K.shade(c, -0.3); K.roundRect(x, 4, 24 + (f % 2), 10, 20, 4); x.fill(); K.roundRect(x, 42, 24 + ((f + 1) % 2), 10, 20, 4); x.fill();
      const g = x.createLinearGradient(0, 8, 0, 50);
      g.addColorStop(0, K.shade(c, 0.25)); g.addColorStop(1, K.shade(c, -0.3));
      x.fillStyle = g; K.roundRect(x, 10, 8, 36, 42, 8); x.fill();
      x.strokeStyle = K.shade(c, -0.45); x.lineWidth = 2;
      x.beginPath(); x.moveTo(14, 30); x.lineTo(42, 30); x.moveTo(20, 8); x.lineTo(22, 30); x.moveTo(36, 30); x.lineTo(34, 50); x.stroke();
      K.ellipse(x, 21, 20, 4, 2.5, '#ff6a3a'); K.ellipse(x, 35, 20, 4, 2.5, '#ff6a3a');
      x.fillStyle = '#3a3030'; x.fillRect(20, 38, 16, 4);
    },
    imp(x, c, f) {
      x.strokeStyle = K.shade(c, -0.3); x.lineWidth = 3;
      x.beginPath(); x.moveTo(40, 40); x.quadraticCurveTo(52, 36 + f * 2, 48, 26); x.stroke();
      x.fillStyle = K.shade(c, -0.3); x.beginPath(); x.moveTo(48, 22); x.lineTo(52, 28); x.lineTo(45, 28); x.fill();
      K.ball(x, 28, 34, 14, c);
      x.fillStyle = '#ffd0a0';
      x.beginPath(); x.moveTo(16, 22); x.lineTo(12, 10); x.lineTo(22, 18); x.fill();
      x.beginPath(); x.moveTo(40, 22); x.lineTo(44, 10); x.lineTo(34, 18); x.fill();
      eyes(x, 28, 31, 5, 3.5, 1, true);
      x.strokeStyle = '#1a1020'; x.lineWidth = 2; x.beginPath(); x.moveTo(22, 40); x.lineTo(25, 42); x.lineTo(28, 40); x.lineTo(31, 42); x.lineTo(34, 40); x.stroke();
      K.ball(x, 12, 44 - (f % 2) * 2, 6, '#2a2d3a'); K.circle(x, 14, 37 - (f % 2) * 2, 2, '#ffd23a');
    },
    blob(x, c, f) {
      const w = [1, 1.06, 1, 0.94][f];
      x.save(); x.translate(28, 52); x.scale(w, 2 - w);
      x.fillStyle = c;
      x.beginPath(); x.moveTo(-18, 0); x.quadraticCurveTo(-20, -30, 0, -34); x.quadraticCurveTo(20, -30, 18, 0); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(-7, -24, 4, 7, -0.4, 0, TAU); x.fill();
      x.restore();
      eyes(x, 28, 34, 6, 3.5, 1, false);
    },
    blobling(x, c, f) {
      x.save(); x.translate(28, 52); x.scale(0.62, 0.62); x.translate(-28, -52);
      PAINT.blob(x, c, f);
      x.restore();
    },
    charger(x, c, f) {
      K.ellipse(x, 28, 51, 18, 4, 'rgba(0,0,0,0.25)');
      for (let i = 0; i < 3; ++i) { x.fillStyle = '#4a3a10'; x.fillRect(14 + i * 11, 42 + ((f + i) % 2) * 3, 4, 8); }
      K.ball(x, 26, 32, 16, c);
      x.fillStyle = K.shade(c, -0.35); x.beginPath(); x.arc(26, 32, 16, Math.PI * 1.1, Math.PI * 1.9); x.lineTo(26, 32); x.fill();
      x.fillStyle = '#fff8e0'; x.beginPath(); x.moveTo(40, 30); x.lineTo(54, 22); x.lineTo(42, 38); x.fill();
      K.circle(x, 36, 30, 3.5, '#ffffff'); K.circle(x, 37, 30, 2, '#1a1020');
    }
  };

  Object.assign(NS.actorArt, {
    W, H, EW, EH, skinDef, bomber, enemy, PAINT, FUSE
  });
})();
