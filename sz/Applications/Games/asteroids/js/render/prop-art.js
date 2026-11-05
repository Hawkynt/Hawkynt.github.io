/* Procedural props and icons, each painted once and blitted: the icon set used across HUD and
   menus, power-up capsules, star shards, seasonal tokens, mines, enemy shot looks, orbit blades,
   black holes, frost and fire patches, rock chips and the seasonal decor shapes (snowflake,
   petal, leaf, star). Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const { TAU } = NS.constants;
  const { POWERUPS } = NS.powerData;
  const K = NS.artKit;

  /* ── icons: drawn in a 32 x 32 box around (16, 16) ── */
  function star5(g, cx, cy, r, inner) {
    g.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rr = i % 2 === 0 ? r : r * (inner || 0.45);
      const a = -Math.PI / 2 + i * Math.PI / 5;
      if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }

  function snowflake(g, cx, cy, r) {
    g.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      g.moveTo(cx, cy);
      g.lineTo(x, y);
      const bx = cx + Math.cos(a) * r * 0.55, by = cy + Math.sin(a) * r * 0.55;
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3);
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3);
    }
    g.stroke();
  }

  const ICONS = {
    gun: (g) => { g.fillRect(6, 13, 18, 6); g.fillRect(20, 10, 6, 12); g.fillRect(8, 19, 5, 7); },
    shield: (g) => { g.beginPath(); g.moveTo(16, 4); g.lineTo(27, 8); g.quadraticCurveTo(26, 22, 16, 28); g.quadraticCurveTo(6, 22, 5, 8); g.closePath(); g.fill(); },
    engine: (g) => { g.beginPath(); g.moveTo(6, 10); g.lineTo(18, 10); g.lineTo(26, 16); g.lineTo(18, 22); g.lineTo(6, 22); g.closePath(); g.fill(); g.globalAlpha = 0.6; g.fillRect(2, 13, 4, 6); },
    dust: (g) => { star5(g, 16, 16, 12, 0.35); g.fill(); g.globalAlpha = 0.6; star5(g, 26, 7, 4, 0.4); g.fill(); },
    nova: (g) => { star5(g, 16, 16, 13, 0.3); g.fill(); g.beginPath(); g.arc(16, 16, 5, 0, TAU); g.globalAlpha = 0.5; g.fill(); },
    rapid: (g) => { for (let i = 0; i < 3; ++i) g.fillRect(5 + i * 8, 10 + (i % 2) * 6, 6, 6); },
    triple: (g) => { g.lineWidth = 3; g.beginPath(); g.moveTo(6, 26); g.lineTo(10, 6); g.moveTo(16, 26); g.lineTo(16, 5); g.moveTo(26, 26); g.lineTo(22, 6); g.stroke(); },
    pierce: (g) => { g.beginPath(); g.moveTo(3, 16); g.lineTo(26, 16); g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(29, 16); g.lineTo(21, 10); g.lineTo(21, 22); g.fill(); g.globalAlpha = 0.5; g.beginPath(); g.arc(14, 16, 6, 0, TAU); g.lineWidth = 2; g.stroke(); },
    crosshair: (g) => { g.lineWidth = 2.5; g.beginPath(); g.arc(16, 16, 9, 0, TAU); g.moveTo(16, 2); g.lineTo(16, 10); g.moveTo(16, 22); g.lineTo(16, 30); g.moveTo(2, 16); g.lineTo(10, 16); g.moveTo(22, 16); g.lineTo(30, 16); g.stroke(); },
    twin: (g) => { g.fillRect(6, 8, 20, 5); g.fillRect(6, 19, 20, 5); },
    homing: (g) => { g.lineWidth = 3; g.beginPath(); g.moveTo(4, 26); g.quadraticCurveTo(6, 6, 24, 8); g.stroke(); g.beginPath(); g.moveTo(28, 8); g.lineTo(20, 3); g.lineTo(21, 13); g.fill(); },
    life: (g) => { g.beginPath(); g.moveTo(27, 16); g.lineTo(7, 6); g.lineTo(11, 16); g.lineTo(7, 26); g.closePath(); g.fill(); },
    hyper: (g) => { g.lineWidth = 2.5; for (let i = 0; i < 3; ++i) { g.beginPath(); g.arc(16, 16, 4 + i * 4.5, i, i + 4.2); g.stroke(); } },
    heart: (g) => { g.beginPath(); g.moveTo(16, 27); g.bezierCurveTo(2, 18, 4, 4, 16, 11); g.bezierCurveTo(28, 4, 30, 18, 16, 27); g.fill(); },
    turn: (g) => { g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 10, 0.3, 5.2); g.stroke(); g.beginPath(); g.moveTo(26, 4); g.lineTo(26, 13); g.lineTo(18, 10); g.fill(); },
    brake: (g) => { g.fillRect(6, 6, 6, 20); g.fillRect(20, 6, 6, 20); },
    ram: (g) => { g.beginPath(); g.moveTo(28, 16); g.lineTo(12, 5); g.lineTo(12, 27); g.closePath(); g.fill(); g.fillRect(3, 12, 9, 8); },
    magnet: (g) => { g.lineWidth = 5; g.beginPath(); g.arc(16, 14, 8, Math.PI, 0); g.moveTo(8, 14); g.lineTo(8, 26); g.moveTo(24, 14); g.lineTo(24, 26); g.stroke(); },
    clover: (g) => { for (let i = 0; i < 4; ++i) { const a = i * TAU / 4 + 0.78; g.beginPath(); g.arc(16 + Math.cos(a) * 6, 14 + Math.sin(a) * 6, 6, 0, TAU); g.fill(); } g.fillRect(15, 18, 2, 11); },
    chrono: (g) => { g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 11, 0, TAU); g.moveTo(16, 16); g.lineTo(16, 8); g.moveTo(16, 16); g.lineTo(22, 19); g.stroke(); },
    double: (g) => { g.font = 'bold 17px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 16, 17); },
    gift: (g) => { g.fillRect(6, 13, 20, 14); g.fillRect(4, 9, 24, 5); g.globalAlpha = 0.5; g.fillRect(14, 9, 4, 18); },
    ring: (g) => { g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 11, 0, TAU); g.stroke(); g.beginPath(); g.arc(16, 16, 4, 0, TAU); g.fill(); },
    blast: (g) => { star5(g, 16, 16, 13, 0.55); g.fill(); },
    drone: (g) => { g.beginPath(); g.moveTo(26, 16); g.lineTo(8, 8); g.lineTo(12, 16); g.lineTo(8, 24); g.closePath(); g.fill(); g.globalAlpha = 0.5; g.beginPath(); g.arc(6, 6, 3, 0, TAU); g.arc(6, 26, 3, 0, TAU); g.fill(); },
    laser: (g) => { g.fillRect(2, 13, 28, 6); g.globalAlpha = 0.5; g.fillRect(2, 10, 28, 12); },
    orbit: (g) => { g.lineWidth = 2; g.beginPath(); g.arc(16, 16, 10, 0, TAU); g.stroke(); for (let i = 0; i < 3; ++i) { const a = i * TAU / 3; g.beginPath(); g.arc(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 4, 0, TAU); g.fill(); } },
    gravity: (g) => { g.lineWidth = 2.5; g.beginPath(); for (let t = 0; t < 30; ++t) { const a = t * 0.4, d = 1 + t * 0.45; const x = 16 + Math.cos(a) * d, y = 16 + Math.sin(a) * d; if (t) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); },
    rock: (g) => { K.poly(g, [[16, 3], [26, 8], [29, 18], [22, 28], [10, 28], [3, 19], [6, 8]]); g.fill(); },
    saucer: (g) => { g.beginPath(); g.ellipse(16, 18, 13, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(16, 15, 6, Math.PI, 0); g.fill(); },
    skull: (g) => { g.beginPath(); g.arc(16, 13, 10, 0, TAU); g.fill(); g.fillRect(10, 18, 12, 8); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(12, 13, 3, 0, TAU); g.arc(20, 13, 3, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; },
    book: (g) => { g.fillRect(5, 6, 10, 21); g.fillRect(17, 6, 10, 21); g.globalAlpha = 0.5; g.fillRect(15, 6, 2, 21); },
    star: (g) => { star5(g, 16, 16, 13); g.fill(); },
    wave: (g) => { g.lineWidth = 3; g.beginPath(); for (let x = 2; x <= 30; ++x) { const y = 16 + Math.sin(x * 0.45) * 7; if (x === 2) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); },
    lotus: (g) => { for (let i = -2; i <= 2; ++i) { g.beginPath(); g.ellipse(16 + i * 5, 18 - (2 - Math.abs(i)) * 2, 3.5, 9, i * 0.35, 0, TAU); g.fill(); } },
    calendar: (g) => { g.fillRect(5, 8, 22, 19); g.globalCompositeOperation = 'destination-out'; g.fillRect(8, 14, 16, 10); g.globalCompositeOperation = 'source-over'; g.fillRect(9, 4, 3, 6); g.fillRect(20, 4, 3, 6); g.fillRect(10, 16, 4, 3); },
    flame: (g) => { g.beginPath(); g.moveTo(16, 3); g.bezierCurveTo(26, 14, 26, 28, 16, 29); g.bezierCurveTo(6, 28, 6, 16, 12, 10); g.quadraticCurveTo(13, 17, 16, 18); g.quadraticCurveTo(13, 10, 16, 3); g.fill(); },
    brush: (g) => { g.fillRect(14, 3, 4, 16); g.beginPath(); g.moveTo(10, 19); g.lineTo(22, 19); g.lineTo(20, 29); g.lineTo(12, 29); g.fill(); },
    pod: (g) => { g.beginPath(); g.ellipse(16, 16, 12, 8, 0, 0, TAU); g.fill(); },
    trophy: (g) => { g.fillRect(10, 5, 12, 11); g.beginPath(); g.arc(16, 15, 6, 0, Math.PI); g.fill(); g.fillRect(14, 19, 4, 5); g.fillRect(9, 24, 14, 4); },
    play: (g) => { g.beginPath(); g.moveTo(9, 5); g.lineTo(27, 16); g.lineTo(9, 27); g.closePath(); g.fill(); },
    trail: (g) => { for (let i = 0; i < 4; ++i) { g.globalAlpha = 1 - i * 0.22; g.beginPath(); g.arc(24 - i * 6, 16, 5 - i, 0, TAU); g.fill(); } },
    shot: (g) => { g.beginPath(); g.ellipse(16, 16, 12, 4, 0, 0, TAU); g.fill(); },
    skin: (g) => { g.beginPath(); g.moveTo(28, 16); g.lineTo(6, 5); g.lineTo(11, 16); g.lineTo(6, 27); g.closePath(); g.fill(); },
    snow: (g) => { g.lineWidth = 2.4; snowflake(g, 16, 16, 12); },
    map: (g) => { g.beginPath(); g.moveTo(3, 7); g.lineTo(11, 4); g.lineTo(21, 8); g.lineTo(29, 5); g.lineTo(29, 25); g.lineTo(21, 28); g.lineTo(11, 24); g.lineTo(3, 27); g.closePath(); g.fill(); },
    gear: (g) => { star5(g, 16, 16, 13, 0.75); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(16, 16, 4, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; },
    back: (g) => { g.beginPath(); g.moveTo(4, 16); g.lineTo(16, 5); g.lineTo(16, 12); g.lineTo(28, 12); g.lineTo(28, 20); g.lineTo(16, 20); g.lineTo(16, 27); g.closePath(); g.fill(); },
  };

  function iconSprite(kind, color) {
    return K.sprite('icon:' + kind + ':' + color, 32, 32, (g) => {
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineCap = 'round';
      (ICONS[kind] || ICONS.star)(g);
    });
  }

  function icon(ctx, kind, x, y, size, color) {
    K.blit(ctx, iconSprite(kind, color || '#ffffff'), x, y, size / 32);
  }

  /* ── pickups ── */
  function capsule(kind) {
    const D = POWERUPS[kind];
    return K.sprite('capsule:' + kind, 40, 40, (g) => {
      const gr = g.createRadialGradient(15, 14, 1, 20, 20, 15);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, K.shade(D.col, 0.25));
      gr.addColorStop(1, K.shade(D.col, -0.55));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(20, 20, 14, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.stroke();
      g.save();
      g.translate(20 - 9, 20 - 9);
      g.scale(18 / 32, 18 / 32);
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#ffffff';
      g.lineCap = 'round';
      ICONS[D.icon](g);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.ellipse(15, 11, 6, 3, -0.5, 0, TAU);
      g.fill();
    });
  }

  function shard() {
    return K.sprite('shard', 28, 28, (g) => {
      K.poly(g, [[14, 2], [21, 14], [14, 26], [7, 14]]);
      const gr = g.createLinearGradient(7, 2, 21, 26);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, '#ffd25a');
      gr.addColorStop(1, '#a06a10');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = '#fff4c0';
      g.lineWidth = 1;
      g.stroke();
    });
  }

  /* the seasonal token: snowflake, blossom, sunstone, leaf, gourd or gift */
  function token(season) {
    const sd = NS.seasons.SEASONS[season];
    return K.sprite('token:' + season, 30, 30, (g) => {
      const gr = g.createRadialGradient(15, 15, 0, 15, 15, 15);
      gr.addColorStop(0, K.rgba(sd.tokenCol, 0.5));
      gr.addColorStop(1, K.rgba(sd.tokenCol, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 30, 30);
      g.fillStyle = sd.tokenCol;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      switch (season) {
        case 'winter': snowflake(g, 15, 15, 10); break;
        case 'spring': NS.rockArt.flower(g, 15, 15, 9, sd.tokenCol); break;
        case 'summer': star5(g, 15, 15, 11, 0.55); g.fill(); g.stroke(); break;
        case 'autumn': NS.rockArt.leaf(g, 15, 15, 11, -0.6, sd.tokenCol); break;
        case 'halloween':
          g.beginPath(); g.ellipse(15, 16, 10, 8, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffe060'; g.fillRect(10, 13, 3, 3); g.fillRect(17, 13, 3, 3); g.fillRect(11, 18, 8, 2);
          g.fillStyle = '#4a8a20'; g.fillRect(14, 5, 2, 5);
          break;
        case 'yearend':
          g.fillRect(7, 11, 16, 13); g.fillStyle = '#ffd040'; g.fillRect(13, 11, 4, 13); g.fillRect(7, 15, 16, 3);
          break;
      }
    });
  }

  function mine(lit) {
    return K.sprite('mine:' + (lit ? 1 : 0), 28, 28, (g) => {
      g.fillStyle = '#3a3e48';
      for (let i = 0; i < 8; ++i) {
        const a = i * TAU / 8;
        g.fillRect(14 + Math.cos(a) * 9 - 1.5, 14 + Math.sin(a) * 9 - 1.5, 3, 3);
      }
      const gr = g.createRadialGradient(12, 12, 1, 14, 14, 8);
      gr.addColorStop(0, '#9aa0b0');
      gr.addColorStop(1, '#1a1c22');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(14, 14, 8, 0, TAU);
      g.fill();
      g.fillStyle = lit ? '#ff4a3a' : '#5a1a14';
      g.beginPath();
      g.arc(14, 14, 3, 0, TAU);
      g.fill();
    });
  }

  /* enemy shots: bolt (red), shard (ice), fire, orb (violet) */
  const SHOT_RAMPS = {
    bolt: ['#ffffff', '#ffb0a0', '#ff3a3a'],
    shard: ['#ffffff', '#d8f8ff', '#60c8ff'],
    fire: ['#ffffff', '#ffd060', '#ff5010'],
    orb: ['#ffffff', '#f0c0ff', '#a040ff'],
  };

  function enemyShot(kind) {
    return K.orb('e:' + kind, SHOT_RAMPS[kind] || SHOT_RAMPS.bolt, 6);
  }

  function blade() {
    return K.sprite('blade', 30, 30, (g) => {
      K.poly(g, [[15, 1], [19, 11], [29, 15], [19, 19], [15, 29], [11, 19], [1, 15], [11, 11]]);
      const gr = g.createRadialGradient(15, 15, 1, 15, 15, 14);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, '#c0ff80');
      gr.addColorStop(1, '#3a8a10');
      g.fillStyle = gr;
      g.fill();
    });
  }

  function hole() {
    return K.sprite('hole', 160, 160, (g) => {
      const c = 80;
      const gr = g.createRadialGradient(c, c, 10, c, c, 80);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.22, 'rgba(0,0,0,1)');
      gr.addColorStop(0.27, 'rgba(255,200,230,0.95)');
      gr.addColorStop(0.36, 'rgba(255,74,160,0.6)');
      gr.addColorStop(0.6, 'rgba(120,20,90,0.22)');
      gr.addColorStop(1, 'rgba(60,0,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 160, 160);
      g.strokeStyle = 'rgba(255,170,220,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.ellipse(c, c, 30 + i * 12, 10 + i * 4, 0.4, 0, TAU);
        g.stroke();
      }
      g.fillStyle = '#000000';
      g.beginPath();
      g.arc(c, c, 17, 0, TAU);
      g.fill();
    });
  }

  function patch(kind) {
    return K.sprite('patch:' + kind, 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      if (kind === 'ice') {
        gr.addColorStop(0, 'rgba(220,245,255,0.22)');
        gr.addColorStop(0.75, 'rgba(140,210,255,0.14)');
        gr.addColorStop(0.93, 'rgba(230,250,255,0.32)');
        gr.addColorStop(1, 'rgba(140,210,255,0)');
      } else {
        gr.addColorStop(0, 'rgba(255,240,160,0.75)');
        gr.addColorStop(0.35, 'rgba(255,140,40,0.55)');
        gr.addColorStop(0.8, 'rgba(200,40,10,0.25)');
        gr.addColorStop(1, 'rgba(120,20,0,0)');
      }
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      if (kind === 'ice') {
        g.strokeStyle = 'rgba(255,255,255,0.4)';
        g.lineWidth = 1.5;
        for (let i = 0; i < 5; ++i) snowflake(g, 30 + (i * 37) % 70, 30 + (i * 53) % 70, 7);
      }
    });
  }

  /* rock chips: four small polygon shapes per colour */
  function chip(shape, color) {
    return K.sprite('chip:' + shape + ':' + color, 12, 12, (g) => {
      const pts = [
        [[6, 1], [11, 5], [8, 11], [2, 9], [1, 4]],
        [[2, 2], [10, 3], [9, 9], [3, 10]],
        [[6, 1], [11, 9], [1, 10]],
        [[3, 1], [9, 2], [11, 7], [6, 11], [1, 7]],
      ][shape];
      K.poly(g, pts);
      g.fillStyle = color;
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(2, 2, 4, 2);
    });
  }

  /* drifting decor: 0 snowflake, 1 petal, 2 leaf, 3 star */
  function decor(shape, color) {
    return K.sprite('decor:' + shape + ':' + color, 20, 20, (g) => {
      g.fillStyle = color;
      g.strokeStyle = color;
      switch (shape) {
        case 0: g.lineWidth = 1.6; g.lineCap = 'round'; snowflake(g, 10, 10, 8); break;
        case 1: g.beginPath(); g.ellipse(10, 10, 4, 8, 0.4, 0, TAU); g.fill(); break;
        case 2: NS.rockArt.leaf(g, 10, 10, 8, 0.5, color); break;
        default: star5(g, 10, 10, 8, 0.4); g.fill(); break;
      }
    });
  }

  Object.assign(NS.propArt, {
    ICONS, iconSprite, icon, capsule, shard, token, mine, enemyShot, SHOT_RAMPS, blade, hole, patch, chip, decor, star5, snowflake
  });
})();
