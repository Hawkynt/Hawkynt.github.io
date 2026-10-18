;(function() {
  'use strict';

  // Drawing monsters, their shots, shields, HP bars and the dome weapon projectiles.
  // Owns: NS.enemyArt
  // Reads: constants, util, dom, sprites, fxArt, panels, rules, waves, artifacts
  // Reads state of: dom, gameState, waves

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { TWO_PI, VIEW_SURFACE } = NS.constants;
  const { makeCanvas, hexToRgba } = NS.util;
  const { ctx, particles, enemyHitFlash } = NS.dom;
  const { SPRITE_OUTLINE, drawSprite } = NS.sprites;
  const { buildFxArt, drawGlow } = NS.fxArt;
  const { roundRectPath, drawMeter } = NS.panels;
  const { DOME_X, DOME_Y } = NS.rules;
  const { ELITE_AURAS, enemyType } = NS.waves;
  const { hasArtifact } = NS.artifacts;

  // Pre-rendered enemy body (outline, shading, rim light) per variant
  function getEnemyBody(kind) {
    const art = buildFxArt();
    const key = 'body:' + kind;
    if (art.tinted[key]) return art.tinted[key];
    const S = 96, c = makeCanvas(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const r = 36;
    const pal = {
      walker: ['#ff9a8a', '#e0403a', '#8a1420', '#3a0610'],
      armored: ['#e8d8a8', '#a08a5a', '#5a4828', '#241a0c'],
      boss: ['#ff7aa0', '#b81848', '#5a0420', '#20020a'],
      flyer: ['#f0a8ff', '#a050c8', '#4a1868', '#1a0628'],
      swarmer: ['#f4ffb0', '#c8d040', '#6a7a10', '#283008'],
      diver: ['#b8f4ff', '#3ab0c8', '#145a70', '#06242e'],
      burrower: ['#ffc0e0', '#d0609a', '#7a2050', '#300a20'],
      spitter: ['#dcffb8', '#60b040', '#2a6a18', '#0e300a'],
      splitter: ['#ffe0b0', '#ff9030', '#a04a10', '#401a04'],
      mender: ['#c8fff0', '#40c890', '#127a54', '#063020'],
      queen: ['#ffc0f0', '#e040c0', '#7a1468', '#30062a']
    }[kind];
    const drop = kind === 'flyer' || kind === 'diver';
    g.fillStyle = SPRITE_OUTLINE;
    g.beginPath();
    if (drop) {
      g.moveTo(0, -r - 4);
      g.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.7 + 4, r * 0.6 + 4);
      g.quadraticCurveTo(0, r * 0.35 + 4, -r * 0.7 - 4, r * 0.6 + 4);
      g.quadraticCurveTo(-r * 0.9, -r * 0.1, 0, -r - 4);
    } else
      g.arc(0, 0, r + 3, 0, TWO_PI);
    g.fill();
    const bodyPath = () => {
      g.beginPath();
      if (drop) {
        g.moveTo(0, -r);
        g.quadraticCurveTo(r * 0.85, -r * 0.1, r * 0.7, r * 0.6);
        g.quadraticCurveTo(0, r * 0.35, -r * 0.7, r * 0.6);
        g.quadraticCurveTo(-r * 0.85, -r * 0.1, 0, -r);
      } else
        g.arc(0, 0, r, 0, TWO_PI);
    };
    const bgd = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    bgd.addColorStop(0, pal[0]);
    bgd.addColorStop(0.45, pal[1]);
    bgd.addColorStop(0.85, pal[2]);
    bgd.addColorStop(1, pal[3]);
    bodyPath();
    g.fillStyle = bgd;
    g.fill();
    g.save();
    bodyPath();
    g.clip();
    // Spots / plates
    if (kind === 'splitter' || kind === 'spitter') {
      // Translucent membrane
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath();
      g.arc(0, 0, r * 0.8, 0, TWO_PI);
      g.fill();
    } else if (kind === 'armored') {
      g.strokeStyle = 'rgba(30,20,8,0.7)';
      g.lineWidth = 3;
      for (const y of [-12, 6, 22]) {
        g.beginPath();
        g.arc(0, y - 30, 40, 0.25 * Math.PI, 0.75 * Math.PI);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,240,200,0.6)';
      for (const [x, y] of [[-20, -4], [20, -4], [-12, 14], [12, 14]]) {
        g.beginPath();
        g.arc(x, y, 2.5, 0, TWO_PI);
        g.fill();
      }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (const [x, y, s] of [[-18, 14, 7], [16, 18, 5], [22, -6, 4], [-6, 24, 4]]) {
        g.beginPath();
        g.arc(x, y, s, 0, TWO_PI);
        g.fill();
      }
    }
    // Rim light from below (ground bounce) and top specular
    g.strokeStyle = 'rgba(255,200,180,0.35)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 4, r - 2, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath();
    g.ellipse(-r * 0.32, -r * 0.48, r * 0.26, r * 0.13, -0.5, 0, TWO_PI);
    g.fill();
    g.restore();
    art.tinted[key] = c;
    return c;
  }

  function drawEnemyEyes(sz, blinking, color, pupil) {
    const eyeH = blinking ? 1 : sz * 0.2;
    for (const sx of [-1, 1]) {
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.3, -sz * 0.12, sz * 0.2 + 2, eyeH + 2, 0, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.3, -sz * 0.12, sz * 0.2, eyeH, 0, 0, TWO_PI);
      ctx.fill();
      if (!blinking) {
        ctx.fillStyle = pupil;
        ctx.beginPath();
        ctx.arc(sx * sz * 0.27, -sz * 0.08, sz * 0.08, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(sx * sz * 0.3 - sz * 0.08, -sz * 0.2, 2, 2);
      }
    }
  }

  // How each ground creature is put together (body palette, legs, face and extras)
  const CREATURE_LOOK = {
    walker:   { body: 'walker', legs: 2, legCol: '#8a2028', eyes: '#fff27a', mouth: 'fangs' },
    swarmer:  { body: 'swarmer', legs: 3, legCol: '#5a6a10', eyes: '#ff5040', mouth: 'mandibles', sx: 1.3, sy: 0.8, antennae: true, legSpeed: 2.2 },
    crawler:  { body: 'armored', legs: 4, legCol: '#5a4a2a', eyes: '#ffb030', mouth: 'mandibles', sx: 1.35, sy: 0.85, plates: true, legSpeed: 0.6 },
    splitter: { body: 'splitter', legs: 2, legCol: '#a04a10', eyes: '#ffffff', mouth: 'fangs', cores: true },
    mender:   { body: 'mender', legs: 0, eyes: '#e0fff0', mouth: 'none', sx: 1.35, sy: 0.72, crystals: true },
    spitter:  { body: 'spitter', legs: 2, legCol: '#2a6a18', eyes: '#ffff80', mouth: 'tube', sac: true },
    burrower: { body: 'burrower', legs: 0, eyes: '#ffe0f0', mouth: 'drill', worm: true },
    behemoth: { body: 'boss', legs: 3, legCol: '#6a1028', eyes: '#ff4040', mouth: 'fangs', crown: true, horns: true, legSpeed: 0.5 }
  };

  function drawEnemy(e) {
    // Owl Sight: monsters glow at night, burrowers show under the ground
    if (hasArtifact('owlSight') && G.daylight < 0.6) {
      const sz = e.size || 16;
      drawGlow('#80ffb0', e.x, e.hidden ? DOME_Y + 6 : e.y, sz * 2.4, 0.4 + Math.sin(G.animTime * 4 + e.x * 0.02) * 0.1);
      if (e.hidden) {
        ctx.save();
        ctx.strokeStyle = 'rgba(128,255,176,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.ellipse(e.x, DOME_Y + 18, sz * 0.9, sz * 0.4, 0, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    if (e.hidden)
      return drawBurrowMound(e);
    const sz = e.size || 16;
    if (e.enraged)
      drawGlow('#ff3a20', e.x, e.y, sz * 2.2, 0.45 + Math.sin(G.animTime * 10 + e.x) * 0.15);
    if (e.elite) {
      const A = ELITE_AURAS[e.elite];
      const ground = enemyType(e).move !== 'air' && enemyType(e).move !== 'dive' && enemyType(e).move !== 'queen';
      ctx.save();
      ctx.strokeStyle = hexToRgba(A.color, 0.7);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -G.animTime * 30;
      ctx.beginPath();
      if (ground)
        ctx.ellipse(e.x, e.y + sz * 0.72, sz * 1.5, sz * 0.4, 0, 0, TWO_PI);
      else
        ctx.arc(e.x, e.y, sz * 1.6, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawGlow(A.color, e.x, e.y, sz * 2.6, 0.22);
    } else if (e.aura) {
      drawGlow(ELITE_AURAS[e.aura].color, e.x, e.y, sz * 1.6, 0.18);
    }
    if (e.enraged && Math.random() < 0.25 && G.currentView === VIEW_SURFACE)
      particles.trail(e.x + (Math.random() - 0.5) * sz, e.y - sz * 0.6, { vx: (Math.random() - 0.5) * 0.8, vy: -1.2, color: '#ff6a40', life: 0.35, size: 2, gravity: -0.02 });
    if (e.type === 'flyer')
      return drawFlyer(e);
    if (e.type === 'diver')
      return drawDiver(e);
    if (e.type === 'queen')
      return drawQueen(e);
    return drawCreature(e, CREATURE_LOOK[e.type] || CREATURE_LOOK.walker);
  }

  function drawCreature(e, look) {
    const sz = e.size || 10;
    const legSpeed = look.legSpeed || 1;
    const wobble = Math.sin(e.wobblePhase * legSpeed) * (look.worm ? 1 : 3);
    const legOffset = Math.sin(e.legPhase * legSpeed) * 6 * Math.min(1, sz / 20);
    const flash = enemyHitFlash.get(e) || 0;
    const face = e.x > DOME_X ? -1 : 1;
    const lunge = (e.lunge || 0) * 8 * face;
    const pop = e.pop !== undefined ? Math.min(1, e.pop) : 1;

    ctx.save();
    ctx.translate(e.x + lunge, e.y + wobble + (1 - pop) * sz * 1.4);
    if (look.worm && pop < 1) {
      ctx.beginPath();
      ctx.rect(-sz * 3, -sz * 4, sz * 6, DOME_Y - e.y + sz * 4 - wobble - (1 - pop) * sz * 1.4);
      ctx.clip();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75 + 4 - wobble, sz * 0.95 * (look.sx || 1), 6, 0, 0, TWO_PI);
    ctx.fill();

    // Behemoth stomp: the front feet rise and slam
    const stomp = e.stompAnim > 0 ? Math.sin((1 - e.stompAnim / 0.5) * Math.PI) * sz * 0.35 : 0;

    // Legs with outlines and feet
    if (look.legs) {
      const legs = [];
      for (let k = 0; k < look.legs; ++k) {
        const t = look.legs === 1 ? 0.5 : k / (look.legs - 1);
        const ox = (0.2 + t * 0.25) * (look.sx || 1), spread = (0.7 + t * 0.2) * (look.sx || 1);
        const o = (k % 2 ? -1 : 1) * legOffset;
        legs.push([-ox, 0.25, -spread, 0.6 + t * 0.15, o - (k === 0 ? stomp : 0)], [ox, 0.25, spread, 0.6 + t * 0.15, -o - (k === 0 ? stomp : 0)]);
      }
      const lw = Math.max(2.5, sz * 0.2);
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? look.legCol : SPRITE_OUTLINE;
        ctx.lineWidth = lw + (pass ? 0 : 3);
        ctx.lineCap = 'round';
        for (const [x0, y0, x1, y1, o] of legs) {
          ctx.beginPath();
          ctx.moveTo(sz * x0, sz * y0);
          ctx.quadraticCurveTo(sz * x1, sz * (y0 - 0.15), sz * x1, sz * y1 + o);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    }

    // Worm segments trailing into the ground
    if (look.worm) {
      const body = getEnemyBody(look.body);
      for (let k = 3; k >= 1; --k) {
        const s = sz * (1 - k * 0.12) * 2 * (96 / 72);
        ctx.drawImage(body, -face * k * sz * 0.45 - s / 2, k * sz * 0.38 - s / 2 + Math.sin(e.t * 6 + k) * 2, s, s);
      }
    }

    // Body with squash and stretch
    const squash = 1 + Math.sin(e.wobblePhase * 2 * legSpeed) * 0.05;
    const body = getEnemyBody(look.body);
    const bw = sz * 2 * (96 / 72) * (look.sx || 1) / squash, bh = sz * 2 * (96 / 72) * (look.sy || 1) * squash;
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Spitter's acid sac swells before each shot
    if (look.sac) {
      const swell = 1 + (e.charge || 0) * 0.35 + Math.sin(G.animTime * 5) * 0.04;
      const sr = sz * 0.5 * swell;
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(-face * sz * 0.3, -sz * 0.78, sr + 2.5, 0, TWO_PI);
      ctx.fill();
      const sg = ctx.createRadialGradient(-face * sz * 0.4, -sz * 0.95, 2, -face * sz * 0.3, -sz * 0.78, sr);
      sg.addColorStop(0, '#f0ffc0');
      sg.addColorStop(0.5, '#9aff50');
      sg.addColorStop(1, '#3a8a18');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(-face * sz * 0.3, -sz * 0.78, sr, 0, TWO_PI);
      ctx.fill();
      drawGlow('#8aff50', -face * sz * 0.3, -sz * 0.78, sr * 1.8, 0.25 + (e.charge || 0) * 0.5);
    }

    // Armour plates
    if (look.plates) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * (look.sx || 1), sz * (look.sy || 1), 0, 0, TWO_PI);
      ctx.clip();
      // Overlapping shell segments from head to tail
      const W = sz * (look.sx || 1);
      for (let k = -1; k <= 2; ++k) {
        const x = k * W * 0.42 - W * 0.2;
        ctx.strokeStyle = SPRITE_OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - sz * 0.12, -sz);
        ctx.quadraticCurveTo(x + sz * 0.22, 0, x - sz * 0.12, sz);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - sz * 0.05, -sz * 0.8);
        ctx.quadraticCurveTo(x + sz * 0.28, 0, x - sz * 0.05, sz * 0.4);
        ctx.stroke();
      }
      for (const [rx, ry] of [[-0.55, -0.35], [0.1, -0.5], [0.6, -0.3]]) {
        ctx.fillStyle = 'rgba(255,240,210,0.55)';
        ctx.beginPath();
        ctx.arc(rx * W, ry * sz, sz * 0.07, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    // Splitter cores swirling inside the membrane
    if (look.cores) {
      for (let k = 0; k < 3; ++k) {
        const a = G.animTime * 2.4 + k * TWO_PI / 3;
        const cx = Math.cos(a) * sz * 0.5, cy = Math.sin(a) * sz * 0.14 + sz * 0.5;
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.2 + 1.5, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#fff0a0';
        ctx.beginPath();
        ctx.arc(cx, cy, sz * 0.2, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Mender: glowing crystals and a healing pulse
    if (look.crystals) {
      const pulse = (G.animTime * 0.8 + e.wobblePhase) % 1;
      ctx.strokeStyle = `rgba(90,255,170,${0.5 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, sz * 0.4, sz * (1 + pulse * 3), sz * (0.4 + pulse * 1.2), 0, 0, TWO_PI);
      ctx.stroke();
      for (let k = -1; k <= 1; ++k) {
        const h = sz * (0.7 + (k === 0 ? 0.35 : 0));
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.moveTo(k * sz * 0.45 - 5, -sz * 0.45);
        ctx.lineTo(k * sz * 0.45, -sz * 0.45 - h - 2);
        ctx.lineTo(k * sz * 0.45 + 5, -sz * 0.45);
        ctx.fill();
        ctx.fillStyle = '#7affc8';
        ctx.beginPath();
        ctx.moveTo(k * sz * 0.45 - 3.5, -sz * 0.45);
        ctx.lineTo(k * sz * 0.45, -sz * 0.45 - h);
        ctx.lineTo(k * sz * 0.45 + 3.5, -sz * 0.45);
        ctx.fill();
        drawGlow('#5affb0', k * sz * 0.45, -sz * 0.45 - h * 0.5, sz * 0.5, 0.5);
      }
    }

    // Boss horns and crown
    if (look.horns) {
      for (const side of [-1, 1]) {
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.55, -sz * 0.55);
        ctx.quadraticCurveTo(side * sz * 1.25, -sz * 0.9, side * sz * 1.05, -sz * 1.45);
        ctx.quadraticCurveTo(side * sz * 0.95, -sz * 0.95, side * sz * 0.35, -sz * 0.75);
        ctx.fill();
        ctx.fillStyle = '#e8dcc0';
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.55, -sz * 0.6);
        ctx.quadraticCurveTo(side * sz * 1.15, -sz * 0.92, side * sz * 1.02, -sz * 1.35);
        ctx.quadraticCurveTo(side * sz * 0.92, -sz * 0.95, side * sz * 0.4, -sz * 0.75);
        ctx.fill();
      }
    }
    if (look.crown) {
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.6, -sz * 0.8);
      ctx.lineTo(-sz * 0.45, -sz * 1.42);
      ctx.lineTo(-sz * 0.2, -sz * 1.05);
      ctx.lineTo(0, -sz * 1.6);
      ctx.lineTo(sz * 0.2, -sz * 1.05);
      ctx.lineTo(sz * 0.45, -sz * 1.42);
      ctx.lineTo(sz * 0.6, -sz * 0.8);
      ctx.closePath();
      ctx.fill();
      const cg = ctx.createLinearGradient(0, -sz * 1.5, 0, -sz * 0.8);
      cg.addColorStop(0, '#fff6b0');
      cg.addColorStop(1, '#d08a10');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.52, -sz * 0.84);
      ctx.lineTo(-sz * 0.43, -sz * 1.3);
      ctx.lineTo(-sz * 0.2, -sz * 0.98);
      ctx.lineTo(0, -sz * 1.48);
      ctx.lineTo(sz * 0.2, -sz * 0.98);
      ctx.lineTo(sz * 0.43, -sz * 1.3);
      ctx.lineTo(sz * 0.52, -sz * 0.84);
      ctx.closePath();
      ctx.fill();
    }
    if (look.antennae) {
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.lineWidth = 1.5;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * sz * 0.3, -sz * 0.55);
        ctx.quadraticCurveTo(side * sz * 0.5 + face * sz * 0.4, -sz * 1.3, side * sz * 0.2 + face * sz * 0.9, -sz * 1.1 + Math.sin(G.animTime * 9 + side) * 2);
        ctx.stroke();
      }
    }

    // Face: eyes looking toward the dome and a mouth
    ctx.save();
    ctx.translate(face * sz * 0.12 * (look.sx || 1), 0);
    drawEnemyEyes(sz * (look.sy || 1), e.eyeBlinking, look.eyes, '#200');
    const ms = sz * (look.sy || 1);
    if (look.mouth === 'fangs') {
      ctx.fillStyle = '#2a0008';
      ctx.beginPath();
      ctx.moveTo(-ms * 0.28, ms * 0.22);
      ctx.quadraticCurveTo(0, ms * 0.5, ms * 0.28, ms * 0.22);
      ctx.quadraticCurveTo(0, ms * 0.32, -ms * 0.28, ms * 0.22);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-ms * 0.14, ms * 0.27);
      ctx.lineTo(-ms * 0.09, ms * 0.38);
      ctx.lineTo(-ms * 0.04, ms * 0.29);
      ctx.moveTo(ms * 0.04, ms * 0.29);
      ctx.lineTo(ms * 0.09, ms * 0.38);
      ctx.lineTo(ms * 0.14, ms * 0.27);
      ctx.fill();
    } else if (look.mouth === 'mandibles') {
      const open = 0.25 + Math.abs(Math.sin(G.animTime * 6 + e.wobblePhase)) * 0.25;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.lineWidth = Math.max(2, ms * 0.14);
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * ms * 0.2, ms * 0.3);
        ctx.quadraticCurveTo(side * ms * (0.35 + open), ms * 0.6, side * ms * 0.05, ms * 0.72);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (look.mouth === 'tube') {
      ctx.fillStyle = SPRITE_OUTLINE;
      roundRectPath(face > 0 ? ms * 0.1 : -ms * 0.75, ms * 0.12, ms * 0.65, ms * 0.32, ms * 0.12);
      ctx.fill();
      ctx.fillStyle = '#4a9a28';
      roundRectPath(face > 0 ? ms * 0.14 : -ms * 0.71, ms * 0.16, ms * 0.57, ms * 0.22, ms * 0.1);
      ctx.fill();
      ctx.fillStyle = '#c8ff80';
      ctx.beginPath();
      ctx.arc(face * ms * 0.72, ms * 0.27, ms * 0.07, 0, TWO_PI);
      ctx.fill();
    } else if (look.mouth === 'drill') {
      // Ring of teeth turning like a drill
      ctx.fillStyle = '#3a0820';
      ctx.beginPath();
      ctx.arc(0, ms * 0.3, ms * 0.3, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffe8f0';
      for (let k = 0; k < 6; ++k) {
        const a = k * TWO_PI / 6 + G.animTime * 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * ms * 0.3, ms * 0.3 + Math.sin(a) * ms * 0.3);
        ctx.lineTo(Math.cos(a + 0.25) * ms * 0.12, ms * 0.3 + Math.sin(a + 0.25) * ms * 0.12);
        ctx.lineTo(Math.cos(a + 0.5) * ms * 0.3, ms * 0.3 + Math.sin(a + 0.5) * ms * 0.3);
        ctx.fill();
      }
    }
    ctx.restore();

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(G.animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 4 + i * TWO_PI / 3;
        drawSprite('snowflake', Math.cos(a) * sz * 0.9, -sz * 1.1 + Math.sin(a) * 4, 14);
      }
    }
    ctx.restore();

    if (e.shield > 0)
      drawEnemyShield(e, wobble);
    drawEnemyHPBar(e, sz, wobble);
  }

  // A burrower travelling under the surface: a moving hump of dirt
  function drawBurrowMound(e) {
    const x = e.x, y = DOME_Y + 2;
    const w = e.size * 1.1, h = 8 + Math.sin(e.t * 9) * 2;
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.ellipse(x, y, w + 2, h + 2, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6a5038';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8a6c4c';
    for (let k = -2; k <= 2; ++k) {
      ctx.fillRect(x + k * w * 0.35 - 2, y - h * (0.5 + 0.3 * Math.sin(e.t * 7 + k)), 4, 3);
    }
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - h * 0.4);
    ctx.lineTo(x - w * 0.1, y - h * 0.8);
    ctx.lineTo(x + w * 0.3, y - h * 0.5);
    ctx.stroke();
  }

  function drawDiver(e) {
    const sz = e.size || 16;
    const flash = enemyHitFlash.get(e) || 0;
    const diving = e.phase === 'dive';
    const flap = diving ? 0.2 : Math.sin(e.wingPhase || 0);
    const ang = diving ? e.angle + Math.PI / 2 : Math.sin(e.t * 2.2) * 0.25;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 0.7, 3.5, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y);
    ctx.rotate(ang);
    if (diving)
      for (let k = 1; k <= 4; ++k) {
        ctx.fillStyle = `rgba(160,230,255,${0.18 - k * 0.035})`;
        ctx.beginPath();
        ctx.ellipse(0, -k * sz * 0.55, sz * 0.4, sz * 0.7, 0, 0, TWO_PI);
        ctx.fill();
      }
    // Swept wings
    for (const side of [-1, 1]) {
      const span = diving ? 0.8 : 1.9;
      const tipY = -sz * 0.2 + flap * sz * 0.7;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.25, -sz * 0.25);
      ctx.lineTo(side * sz * span, tipY - sz * 0.35);
      ctx.lineTo(side * sz * span * 0.7, tipY + sz * 0.15);
      ctx.lineTo(side * sz * 0.3, sz * 0.35);
      ctx.closePath();
      ctx.fillStyle = '#1e7890';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,240,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * span * 0.85, tipY - sz * 0.25);
      ctx.stroke();
    }
    const body = getEnemyBody('diver');
    const bs = sz * 2 * (96 / 72);
    ctx.save();
    ctx.scale(0.8, 1.15);
    ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    }
    ctx.restore();
    // Beak and eyes
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.22, sz * 0.55);
    ctx.lineTo(0, sz * 1.15);
    ctx.lineTo(sz * 0.22, sz * 0.55);
    ctx.fill();
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.15, sz * 0.58);
    ctx.lineTo(0, sz * 1.02);
    ctx.lineTo(sz * 0.15, sz * 0.58);
    ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#ffee60';
      ctx.beginPath();
      ctx.arc(sx * sz * 0.24, sz * 0.2, sz * 0.13, 0, TWO_PI);
      ctx.fill();
      drawGlow('#ffe040', sx * sz * 0.24, sz * 0.2, sz * 0.4, 0.5);
    }
    ctx.restore();
    if (e.shield > 0)
      drawEnemyShield(e, 0);
    drawEnemyHPBar(e, sz, 0);
  }

  function drawQueen(e) {
    const sz = e.size || 40;
    const flash = enemyHitFlash.get(e) || 0;
    const bob = Math.sin(e.wobblePhase) * 6;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 1.2, 7, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y + bob);
    // Two pairs of shimmering wings
    for (const [side, k] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      const flap = Math.sin((e.wingPhase || 0) * 1.4 + k * 0.6);
      ctx.save();
      ctx.rotate(side * (0.45 + k * 0.5 + flap * 0.25));
      ctx.fillStyle = `rgba(255,180,240,${0.35 - k * 0.08})`;
      ctx.strokeStyle = 'rgba(255,220,250,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(side * sz * 0.2, -sz * (1.05 - k * 0.15), sz * 0.35, sz * (1.05 - k * 0.25), 0, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Striped abdomen
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75, sz * 0.55, sz * 0.8, 0, 0, TWO_PI);
    ctx.fill();
    const ag = ctx.createLinearGradient(-sz * 0.5, 0, sz * 0.5, 0);
    ag.addColorStop(0, '#7a1468');
    ag.addColorStop(0.5, '#ff70d8');
    ag.addColorStop(1, '#7a1468');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.75, sz * 0.5, sz * 0.75, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,0,30,0.55)';
    for (let k = 0; k < 4; ++k)
      ctx.fillRect(-sz * 0.48, sz * (0.35 + k * 0.28), sz * 0.96, sz * 0.09);
    // Thorax / head
    const body = getEnemyBody('queen');
    const bs = sz * 2 * (96 / 72) * 0.8;
    ctx.drawImage(body, -bs / 2, -bs / 2 - sz * 0.1, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2 - sz * 0.1, bs, bs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    drawEnemyEyes(sz * 0.8, e.eyeBlinking, '#ff60e0', '#300');
    // Crown
    ctx.fillStyle = SPRITE_OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.45, -sz * 0.55);
    ctx.lineTo(-sz * 0.35, -sz * 1.0);
    ctx.lineTo(-sz * 0.12, -sz * 0.75);
    ctx.lineTo(0, -sz * 1.15);
    ctx.lineTo(sz * 0.12, -sz * 0.75);
    ctx.lineTo(sz * 0.35, -sz * 1.0);
    ctx.lineTo(sz * 0.45, -sz * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd860';
    ctx.beginPath();
    ctx.moveTo(-sz * 0.39, -sz * 0.6);
    ctx.lineTo(-sz * 0.32, -sz * 0.9);
    ctx.lineTo(-sz * 0.12, -sz * 0.7);
    ctx.lineTo(0, -sz * 1.04);
    ctx.lineTo(sz * 0.12, -sz * 0.7);
    ctx.lineTo(sz * 0.32, -sz * 0.9);
    ctx.lineTo(sz * 0.39, -sz * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (e.shield > 0)
      drawEnemyShield(e, bob);
    drawEnemyHPBar(e, sz, bob - sz * 0.2);
  }

  // Acid globs in flight and behemoth shockwaves
  function drawEnemyShots() {
    for (const s of G.enemyShots) {
      if (s.kind === 'lance') {
        const x = s.x0 + (s.tx - s.x0) * s.t, y = s.y0 + (s.ty - s.y0) * s.t;
        const bx = s.x0 + (s.tx - s.x0) * Math.max(0, s.t - 0.25), by = s.y0 + (s.ty - s.y0) * Math.max(0, s.t - 0.25);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,90,220,0.5)';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.strokeStyle = '#ffd8f8';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
        drawGlow('#ff70e0', x, y, 30, 0.9);
        continue;
      }
      const x = s.x0 + (s.tx - s.x0) * s.t;
      const y = s.y0 + (s.ty - s.y0) * s.t - Math.sin(s.t * Math.PI) * 150;
      drawGlow('#8aff50', x, y, 22, 0.6);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#b8ff70';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#f0ffd0';
      ctx.fillRect(x - 3, y - 3, 2, 2);
      if (Math.random() < 0.4)
        particles.trail(x, y, { vx: (Math.random() - 0.5), vy: 0.5, color: '#8aff50', life: 0.3, size: 1.5, gravity: 0.05 });
    }
    for (const w of G.shockwaves) {
      const a = Math.max(0, 1 - w.r / 700);
      ctx.strokeStyle = `rgba(255,170,120,${0.7 * a})`;
      ctx.lineWidth = 5 * a + 1;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(w.from + dir * w.r * 0.0, DOME_Y + 4, w.r, 12 + w.r * 0.02, 0, dir > 0 ? -0.6 : Math.PI - 0.6, dir > 0 ? 0.6 : Math.PI + 0.6);
        ctx.stroke();
      }
    }
  }

  function drawFlyer(e) {
    const sz = e.size || 7;
    const bob = Math.sin(e.wobblePhase) * 8;
    const flap = Math.sin(e.wingPhase || 0);
    const flash = enemyHitFlash.get(e) || 0;

    ctx.save();
    // Shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(e.x, DOME_Y + 6, sz * 0.8, 4, 0, 0, TWO_PI);
    ctx.fill();
    ctx.translate(e.x, e.y + bob);

    // Membrane wings
    for (const side of [-1, 1]) {
      const tipY = -sz * 0.6 + flap * sz * 0.8;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.quadraticCurveTo(side * sz * 1.2, tipY - sz * 0.5, side * sz * 1.9, tipY);
      ctx.quadraticCurveTo(side * sz * 1.5, tipY + sz * 0.4, side * sz * 1.3, tipY + sz * 0.7);
      ctx.quadraticCurveTo(side * sz * 1.0, tipY + sz * 0.5, side * sz * 0.85, tipY + sz * 0.95);
      ctx.quadraticCurveTo(side * sz * 0.6, sz * 0.2, side * sz * 0.3, sz * 0.3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(110,40,150,0.9)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = SPRITE_OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,170,255,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * 1.3, tipY + sz * 0.7);
      ctx.moveTo(side * sz * 0.3, -sz * 0.2);
      ctx.lineTo(side * sz * 0.85, tipY + sz * 0.95);
      ctx.stroke();
    }

    const body = getEnemyBody('flyer');
    const bs = sz * 2 * (96 / 72);
    ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = flash;
      ctx.drawImage(body, -bs / 2, -bs / 2, bs, bs);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Glowing eyes
    ctx.fillStyle = '#ff4cf0';
    const eyeH = e.eyeBlinking ? 0.8 : sz * 0.16;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * sz * 0.2, -sz * 0.2, sz * 0.13, eyeH, sx * 0.3, 0, TWO_PI);
      ctx.fill();
      drawGlow('#ff40f0', sx * sz * 0.2, -sz * 0.2, sz * 0.5, 0.6);
    }

    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(G.animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();

    if (e.shield > 0)
      drawEnemyShield(e, bob);
    drawEnemyHPBar(e, sz, bob);
  }

  function drawEnemyShield(e, vertOffset) {
    const sz = e.size || 10;
    const shieldR = e.shield / (e.maxShield || 1);
    ctx.save();
    ctx.translate(e.x, e.y + vertOffset);
    const r = sz + 12;
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    g.addColorStop(0, 'rgba(80,170,255,0)');
    g.addColorStop(1, `rgba(120,200,255,${0.15 + shieldR * 0.2})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = `rgba(140,210,255,${0.45 + shieldR * 0.45})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = -G.animTime * 20;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEnemyHPBar(e, sz, vertOffset) {
    const hpR = Math.max(0, e.hp / e.maxHP);
    const barW = Math.max(36, sz * 2 + 8);
    const barX = e.x - barW / 2;
    const barY = e.y - sz * (e.boss ? 1.75 : 1.2) - 16 + vertOffset;
    drawMeter(barX, barY, barW, 7, hpR, hpR > 0.5 ? '#ff6a5a' : '#ff3a3a', { track: 'rgba(20,0,0,0.75)' });
    // Elite crest beside the bar
    if (e.elite) {
      const A = ELITE_AURAS[e.elite];
      const cx = barX - 12, cy = barY + 3;
      drawGlow(A.color, cx, cy, 16, 0.7);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      for (let k = 0; k < 10; ++k) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4.5 : 10;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = A.color;
      ctx.beginPath();
      for (let k = 0; k < 10; ++k) {
        const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 3 : 7.5;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    if (e.shield > 0 && e.maxShield > 0)
      drawMeter(barX, barY - 8, barW, 5, e.shield / e.maxShield, '#5ab8ff', { track: 'rgba(0,10,30,0.75)' });
  }

  function drawProjectiles() {
    const prevOp = ctx.globalCompositeOperation;
    for (const p of G.projectiles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.charged) {
        // Charged beam: a wide golden core under the red laser
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = p.perfect ? `rgba(255,230,120,${alpha * 0.55})` : `rgba(255,170,80,${alpha * 0.4})`;
        ctx.lineWidth = (p.perfect ? 30 : 20) * alpha + 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
        ctx.globalCompositeOperation = prevOp;
      }

      // Beam: wide soft glow, colored body, white-hot core
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,70,50,${alpha * 0.25})`;
      ctx.lineWidth = 16 * alpha + 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      SZ.GameEffects.drawElectricArc(ctx, p.x, p.y, p.tx, p.ty, {
        segments: 8,
        jitter: 10 * alpha,
        color: `rgba(255,150,120,${alpha})`,
        glowColor: `rgba(255,60,40,${alpha * 0.6})`,
        width: 3 * alpha + 0.5,
        glowWidth: 8 * alpha
      });
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,255,240,${alpha * 0.9})`;
      ctx.lineWidth = 1.5 * alpha + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Muzzle and impact flares with spark rays
      drawGlow('#ff7040', p.x, p.y, 22 * alpha + 6, alpha);
      drawGlow('#ffb070', p.tx, p.ty, 40 * alpha + 8, alpha);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,170,${alpha})`;
      ctx.lineWidth = 2;
      const rays = 6;
      for (let i = 0; i < rays; ++i) {
        const a = i * TWO_PI / rays + p.tx * 0.1;
        const r0 = 6, r1 = 6 + 22 * (1 - alpha) + 8;
        ctx.beginPath();
        ctx.moveTo(p.tx + Math.cos(a) * r0, p.ty + Math.sin(a) * r0);
        ctx.lineTo(p.tx + Math.cos(a) * r1, p.ty + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = prevOp;

      // Emit trail particles along beam
      if (Math.random() < 0.3) {
        const t = Math.random();
        const px = p.x + (p.tx - p.x) * t;
        const py = p.y + (p.ty - p.y) * t;
        particles.trail(px, py, { color: '#f88', life: 0.15, size: 1 });
      }
    }
    ctx.globalCompositeOperation = prevOp;
  }

  NS.enemyArt = { drawEnemy, drawEnemyShots, drawProjectiles };
})();
