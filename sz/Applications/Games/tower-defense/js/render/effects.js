/* render/effects.js -- pooled particles, floating text, decals, flying coins, banners, the boss card, transitions and screen shake.
   Owns state: G.hitstop, G.fxBudget, G.banner
   Reads: constants, enemyTypes, env, pixelArt, artKit, layout, text, widgets, enemyArt and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_READY, STATE_PLAYING, STATE_BUILD, STATE_MAP_SELECT, STATE_RESEARCH, TWO_PI, WORLD_H,
      TOP_H, hexToRgba, shade } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx, audio } = NS.env;
  const { makeCanvas, drawIcon } = NS.pixelArt;
  const { rampOf, drawGlow } = NS.artKit;
  const { view, worldToUi } = NS.layout;
  const { uiFont, fitText } = NS.text;
  const { UI, drawPanel, drawHeadline } = NS.widgets;

  const goldHudPos = { x: 0, y: 0 };      // where gold counts up (UI units)

  /* ══════════════════════════════════════════════════════════════════
     EFFECTS -- pooled particles (no per-particle gradients), floating
     text, ground decals, coins flying to the gold counter, banners,
     the boss intro card, hitstop and screen transitions
     ══════════════════════════════════════════════════════════════════ */

  // Effects draw from their own random stream so the battle itself plays out
  // the same whatever the effects do
  let fxSeed = (Date.now() ^ 0x5bd1e995) >>> 0;
  function fxRandom() {
    fxSeed ^= fxSeed << 13; fxSeed >>>= 0;
    fxSeed ^= fxSeed >>> 17;
    fxSeed ^= fxSeed << 5; fxSeed >>>= 0;
    return fxSeed / 4294967296;
  }

  const MAX_PARTICLES = 1400;
  const PK_PIXEL = 0, PK_GLOW = 1, PK_SMOKE = 2, PK_DEBRIS = 3, PK_SPARK = 4, PK_FLAKE = 5;

  const P = {
    n: 0,
    x: new Float32Array(MAX_PARTICLES), y: new Float32Array(MAX_PARTICLES),
    vx: new Float32Array(MAX_PARTICLES), vy: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES), max: new Float32Array(MAX_PARTICLES),
    size: new Float32Array(MAX_PARTICLES), grav: new Float32Array(MAX_PARTICLES),
    drag: new Float32Array(MAX_PARTICLES), z: new Float32Array(MAX_PARTICLES),
    vz: new Float32Array(MAX_PARTICLES), kind: new Uint8Array(MAX_PARTICLES),
    col: new Array(MAX_PARTICLES)
  };

  function emit(x, y, vx, vy, life, size, color, kind, grav, drag, vz) {
    let i = P.n;
    if (i >= MAX_PARTICLES) {
      // Pool full: recycle a random old particle rather than dropping the new one
      i = Math.floor(fxRandom() * MAX_PARTICLES);
    } else
      ++P.n;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
    P.life[i] = life; P.max[i] = life; P.size[i] = size;
    P.col[i] = color; P.kind[i] = kind; P.grav[i] = grav || 0; P.drag[i] = drag || 0;
    P.z[i] = 0; P.vz[i] = vz || 0;
  }

  function updateParticles(dt) {
    let i = 0;
    while (i < P.n) {
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        const j = --P.n;
        P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j];
        P.life[i] = P.life[j]; P.max[i] = P.max[j]; P.size[i] = P.size[j]; P.col[i] = P.col[j];
        P.kind[i] = P.kind[j]; P.grav[i] = P.grav[j]; P.drag[i] = P.drag[j]; P.z[i] = P.z[j]; P.vz[i] = P.vz[j];
        continue;
      }
      const d = P.drag[i] ? Math.exp(-P.drag[i] * dt) : 1;
      P.vx[i] *= d; P.vy[i] *= d;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      if (P.kind[i] === PK_DEBRIS) {
        // Height above the ground with a bounce
        P.vz[i] -= 420 * dt;
        P.z[i] += P.vz[i] * dt;
        if (P.z[i] < 0) {
          P.z[i] = 0;
          P.vz[i] = -P.vz[i] * 0.35;
          P.vx[i] *= 0.6; P.vy[i] *= 0.6;
        }
      } else
        P.vy[i] += P.grav[i] * dt;
      ++i;
    }
  }

  let smokePuff = null;
  function drawParticles() {
    if (!smokePuff) {
      smokePuff = makeCanvas(16, 16);
      const g = smokePuff.getContext('2d');
      const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 16);
    }
    // Smoke first (under everything else), then solid bits, then additive glows
    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < P.n; ++i) {
      if (P.kind[i] !== PK_SMOKE) continue;
      const k = P.life[i] / P.max[i];
      const s = P.size[i] * (1.6 - k * 0.6);
      ctx.globalAlpha = k * 0.5;
      ctx.drawImage(tintedPuff(P.col[i]), P.x[i] - s, P.y[i] - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < P.n; ++i) {
      const kind = P.kind[i];
      if (kind === PK_SMOKE || kind === PK_GLOW) continue;
      const k = P.life[i] / P.max[i];
      ctx.fillStyle = P.col[i];
      if (kind === PK_SPARK) {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeStyle = P.col[i];
        ctx.lineWidth = P.size[i];
        ctx.beginPath();
        ctx.moveTo(P.x[i], P.y[i]);
        ctx.lineTo(P.x[i] - P.vx[i] * 0.035, P.y[i] - P.vy[i] * 0.035);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = kind === PK_DEBRIS ? Math.min(1, k * 3) : Math.min(1, k * 1.6);
      const s = P.size[i];
      if (kind === PK_DEBRIS) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i]), s, 1);
        ctx.fillStyle = P.col[i];
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i] - P.z[i] - s), s, s);
      } else
        ctx.fillRect(Math.round(P.x[i] - s / 2), Math.round(P.y[i] - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < P.n; ++i) {
      if (P.kind[i] !== PK_GLOW) continue;
      const k = P.life[i] / P.max[i];
      drawGlow(P.col[i], P.x[i], P.y[i], P.size[i] * (0.6 + 0.4 * k), k);
    }
  }

  const puffCache = {};
  function tintedPuff(color) {
    let c = puffCache[color];
    if (!c) {
      c = puffCache[color] = makeCanvas(16, 16);
      const g = c.getContext('2d');
      g.drawImage(smokePuff, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, 16, 16);
    }
    return c;
  }

  function rnd(a, b) {
    return a + fxRandom() * (b - a);
  }

  // Compatible helpers used all over the simulation
  const particles = {
    burst(x, y, n, o) {
      o = o || {};
      const sp = (o.speed || 3) * 30;
      for (let i = 0; i < n; ++i) {
        const a = fxRandom() * TWO_PI, v = sp * rnd(0.4, 1.1);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, (o.life || 0.5) * rnd(0.6, 1.2), rnd(1.5, 3), o.color || '#ffffff', PK_PIXEL, 0, 4);
      }
    },
    sparkle(x, y, n, o) {
      o = o || {};
      const sp = (o.speed || 2) * 14;
      for (let i = 0; i < n; ++i) {
        const a = fxRandom() * TWO_PI, v = sp * rnd(0.3, 1);
        emit(x + rnd(-4, 4), y + rnd(-4, 4), Math.cos(a) * v, Math.sin(a) * v - 18, rnd(0.4, 0.8), rnd(1.5, 2.5), o.color || '#ffffff', PK_PIXEL, -10, 2);
      }
    },
    confetti(x, y, n, o) {
      const cols = ['#ffd75a', '#ff6a6a', '#6fe08a', '#5ab8ff', '#c890ff', '#ffffff'];
      for (let i = 0; i < n; ++i) {
        const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(90, 240);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(1, 1.8), rnd(2, 4), cols[i % cols.length], PK_PIXEL, 260, 1.2);
      }
    },
    glow(x, y, r, color, life) {
      emit(x, y, 0, 0, life || 0.25, r, color, PK_GLOW);
    },
    smoke(x, y, n, color, size) {
      for (let i = 0; i < n; ++i)
        emit(x + rnd(-5, 5), y + rnd(-5, 5), rnd(-12, 12), rnd(-26, -8), rnd(0.6, 1.2), (size || 7) * rnd(0.7, 1.2), color || '#5a5050', PK_SMOKE, 0, 1.5);
    },
    debris(x, y, n, colors, power) {
      for (let i = 0; i < n; ++i) {
        const a = fxRandom() * TWO_PI, v = rnd(30, 90) * (power || 1);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v * 0.6, rnd(0.6, 1.2), rnd(2, 4), colors[i % colors.length], PK_DEBRIS, 0, 1.5, rnd(80, 190) * (power || 1));
      }
    },
    sparks(x, y, n, color, speed) {
      for (let i = 0; i < n; ++i) {
        const a = fxRandom() * TWO_PI, v = (speed || 160) * rnd(0.5, 1.2);
        emit(x, y, Math.cos(a) * v, Math.sin(a) * v, rnd(0.12, 0.3), 1, color || '#ffe8a0', PK_SPARK, 120, 3);
      }
    },
    flakes(x, y, n, color) {
      for (let i = 0; i < n; ++i)
        emit(x + rnd(-8, 8), y + rnd(-8, 8), rnd(-20, 20), rnd(-30, 5), rnd(0.4, 0.9), 2, color || '#e6f8ff', PK_PIXEL, 40, 2);
    },
    count() { return P.n; },
    clear() { P.n = 0; }
  };

  /* ── Floating text ── */
  const texts = [];
  const floatingText = {
    add(x, y, text, o) {
      o = o || {};
      if (G.fxBudget < 0 && !o.big && !(o.life > 1.2)) return;
      const m = /(\d+)px/.exec(o.font || '');
      if (texts.length > 48) texts.shift();
      texts.push({ x, y, text: String(text), color: o.color || '#ffffff', px: m ? +m[1] : 11, t: 0, life: o.life || 1.1, big: !!o.big });
    },
    clear() { texts.length = 0; }
  };

  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; --i) {
      const t = texts[i];
      t.t += dt;
      if (t.t >= t.life) texts.splice(i, 1);
    }
  }

  function drawTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of texts) {
      const k = t.t / t.life;
      const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.55 : k < 0.22 ? 1.15 - (k - 0.12) * 1.5 : 1;
      const y = t.y - (t.big ? 8 : 22) * Math.min(1, k * 1.6);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = uiFont(Math.round(t.px * pop), 'bold');
      ctx.strokeStyle = 'rgba(10,6,14,0.85)';
      ctx.lineWidth = Math.max(2.5, t.px / 4);
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Ground decals: scorch marks, splats, frost rings ── */
  const decals = [];
  function addDecal(x, y, r, kind) {
    if (decals.length > 40) decals.shift();
    decals.push({ x, y, r, kind, t: 0, life: kind === 'scorch' ? 9 : 6, rot: fxRandom() * TWO_PI });
  }

  function updateDecals(dt) {
    for (let i = decals.length - 1; i >= 0; --i) {
      decals[i].t += dt;
      if (decals[i].t >= decals[i].life) decals.splice(i, 1);
    }
  }

  function drawDecals() {
    for (const d of decals) {
      const a = Math.min(1, (d.life - d.t) / 2) * 0.55;
      ctx.globalAlpha = a;
      if (d.kind === 'scorch') {
        ctx.fillStyle = '#140c08';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.62, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#2a1a10';
        for (let i = 0; i < 6; ++i) {
          const ang = d.rot + i * 1.05;
          ctx.fillRect(Math.round(d.x + Math.cos(ang) * d.r * 0.9), Math.round(d.y + Math.sin(ang) * d.r * 0.55), 3, 2);
        }
      } else {
        ctx.fillStyle = d.kind === 'slime' ? '#3ab898' : d.kind === 'blood' ? '#6a1a1a' : '#bfeaff';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TWO_PI); ctx.fill();
        for (let i = 0; i < 4; ++i) {
          const ang = d.rot + i * 1.6;
          ctx.fillRect(Math.round(d.x + Math.cos(ang) * d.r * 1.3), Math.round(d.y + Math.sin(ang) * d.r * 0.7), 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Effects spawned per battle step are capped so a mass of deaths stays cheap
  const FX_BUDGET = 1e9;
  G.fxBudget = FX_BUDGET;

  function explosionFx(x, y, radius, color) {
    if (--G.fxBudget < 0) return;
    const big = radius > CELL * 1.4;
    particles.glow(x, y, radius * 1.8, '#fff2c0', 0.14);
    // Fireball: hot blobs drifting outwards and shrinking
    const fire = ['#fff2b0', '#ffd28a', color || '#ff8a3a', '#ff5a1a'];
    const nf = big ? 9 : 5;
    for (let i = 0; i < nf; ++i) {
      const a = fxRandom() * TWO_PI, v = rnd(20, 70) * (big ? 1.4 : 1);
      emit(x + Math.cos(a) * 4, y + Math.sin(a) * 3, Math.cos(a) * v, Math.sin(a) * v * 0.7 - 20, rnd(0.28, 0.5), radius * rnd(0.45, 0.75), fire[i % fire.length], PK_GLOW, -30, 3);
    }
    G.fxLines.push({ kind: 'ring', x, y, r: radius * 1.2, color: '#ffe2a0', t: 0, life: 0.32 });
    particles.debris(x, y, big ? 14 : 8, ['#3a2a20', '#5a4030', '#ffb36a', '#2a2020'], big ? 1.4 : 1.1);
    particles.sparks(x, y, big ? 14 : 8, '#ffd28a', 220);
    particles.smoke(x, y - 4, big ? 7 : 4, '#3a3434', big ? 11 : 8);
    addDecal(x, y + 3, radius * 0.55, 'scorch');
    if (big) addShake(3, 120);
  }

  // Enemy death: pixel chunks in the enemy's colours, a puff and a splat
  function deathFx(e) {
    if (--G.fxBudget < 0 && !ENEMY_TYPES[e.type].boss) return;
    const def = ENEMY_TYPES[e.type];
    const ramp = rampOf(def.color);
    const y = e.y - (def.flying ? 12 : 4);
    particles.debris(e.x, y, def.boss ? 28 : Math.round(6 + e.radius * 0.6), [ramp[2], ramp[3], ramp[4], ramp[1]], def.boss ? 1.6 : 1);
    particles.glow(e.x, y, e.radius * 2.2, def.color, 0.25);
    particles.smoke(e.x, y, def.boss ? 8 : 2, '#6a6060', 6);
    if (def.boss) {
      for (let i = 0; i < 6; ++i)
        explosionFx(e.x + rnd(-26, 26), e.y + rnd(-18, 18), CELL * rnd(0.8, 1.6), i % 2 ? '#ff5a3a' : '#ffd28a');
      G.hitstop = 0.5;
      addShake(10, 700);
    } else if (!def.flying)
      addDecal(e.x, e.y + e.radius * 0.6, e.radius * 0.7, e.type === 'splitter' || e.type === 'slimelet' ? 'slime' : 'blood');
  }

  /* ── Coins flying to the gold counter (UI space) ── */
  const uiCoins = [];
  function coinFly(wx, wy, n) {
    if (G.fxBudget < 0) return;
    const p = worldToUi(wx, wy);
    for (let i = 0; i < n && uiCoins.length < 40; ++i)
      uiCoins.push({ x: p.x, y: p.y, sx: p.x + rnd(-18, 18), sy: p.y - rnd(10, 34), t: -i * 0.06, dur: rnd(0.55, 0.75) });
  }

  let coinTick = 0;
  function updateDrawCoins() {
    for (let i = uiCoins.length - 1; i >= 0; --i) {
      const c = uiCoins[i];
      c.t += G.frameDt;
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / c.dur);
      // Quadratic curve: pop up, then swoop to the counter
      const e = k * k * (3 - 2 * k);
      const mx = (c.x + goldHudPos.x) / 2 + (c.sx - c.x) * 2, my = Math.min(c.sy, goldHudPos.y) - 30;
      const x = (1 - e) * (1 - e) * c.x + 2 * (1 - e) * e * mx + e * e * goldHudPos.x;
      const y = (1 - e) * (1 - e) * c.y + 2 * (1 - e) * e * my + e * e * goldHudPos.y;
      drawIcon('coin', x, y, 12 + Math.sin(k * Math.PI) * 4);
      if (k >= 1) {
        uiCoins.splice(i, 1);
        G.goldPulse = 1;
        if (performance.now() - coinTick > 70) {
          coinTick = performance.now();
          audio.play('coin', { pitch: 1.4 + fxRandom() * 0.3, volume: 0.25 });
        }
      }
    }
  }
  function showBanner(title, sub, color, dur) {
    G.banner = { title, sub, color: color || UI.gold, t: 0, dur: dur || 2.2 };
  }

  function drawBanner() {
    if (!G.banner) return;
    G.banner.t += G.frameDt;
    const b = G.banner;
    if (b.t >= b.dur) {
      G.banner = null;
      return;
    }
    const inT = Math.min(1, b.t / 0.3), outT = Math.max(0, (b.t - b.dur + 0.35) / 0.35);
    const ease = (v) => 1 - Math.pow(1 - v, 3);
    const w = Math.min(520, G.UW - 40), h = b.sub ? 64 : 48;
    const x = G.UW / 2 - w / 2 + (1 - ease(inT)) * -G.UW * 0.6 + ease(outT) * G.UW * 0.6;
    const y = TOP_H + 46;
    ctx.save();
    ctx.globalAlpha = 1 - outT;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(8,10,20,0)');
    g.addColorStop(0.15, 'rgba(8,10,20,0.88)');
    g.addColorStop(0.85, 'rgba(8,10,20,0.88)');
    g.addColorStop(1, 'rgba(8,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const lg = ctx.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, hexToRgba(b.color, 0));
    lg.addColorStop(0.5, hexToRgba(b.color, 1));
    lg.addColorStop(1, hexToRgba(b.color, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + h - 2, w, 2);
    drawHeadline(b.title, x + w / 2, y + (b.sub ? 24 : h / 2), w - 60, 30, b.color, shade(b.color, -0.3));
    if (b.sub) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(b.sub, x + w / 2, y + 50, w - 80, 13, { color: '#e4eaf6', weight: 'bold' });
    }
    ctx.restore();
  }

  /* ── Boss intro: letterbox bars and a name card ── */
  function drawBossIntro() {
    if (!G.bossIntro) return;
    G.bossIntro.t += G.frameDt;
    const t = G.bossIntro.t, dur = 2.6;
    if (t >= dur) {
      G.bossIntro = null;
      return;
    }
    const e = G.bossIntro.e;
    const def = ENEMY_TYPES[e.type];
    const k = Math.min(1, t / 0.3) * Math.min(1, (dur - t) / 0.4);
    const top = (view.y) / G.uiS, bottom = (view.y + WORLD_H * view.s) / G.uiS;
    const barH = 34 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, top, G.UW, barH);
    ctx.fillRect(0, bottom - barH, G.UW, barH);
    ctx.save();
    ctx.globalAlpha = k;
    const cy = bottom - 34 - 30;
    const cw = Math.min(460, G.UW - 40);
    const cx = G.UW / 2 - cw / 2;
    drawPanel(cx, cy, cw, 58, { accent: '#ff5a5a', radius: 10 });
    // Portrait
    const img = NS.enemyArt.enemyFrames(e.type)[Math.floor(G.animTime * 6) % 4];
    const s = Math.min(48 / img.height, 70 / img.width);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx + 12, cy + 29 - img.height * s / 2, img.width * s, img.height * s);
    ctx.imageSmoothingEnabled = true;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('BOSS', cx + 92, cy + 16, 80, 10, { weight: 'bold', color: '#ff8a8a' });
    fitText(def.name, cx + 92, cy + 34, cw - 104, 22, { weight: 'bold', color: '#ffffff' });
    ctx.textAlign = 'right';
    fitText(`[[heart]] ${Math.ceil(e.maxHp)}`, cx + cw - 14, cy + 16, 140, 11, { weight: 'bold', color: UI.textDim });
    ctx.restore();
  }

  /* ── Screen transitions ── */
  let fadeT = 0, lastScreen = null;
  function screenGroup() {
    return G.state === STATE_READY ? 'title' : G.state === STATE_MAP_SELECT ? 'maps' : G.state === STATE_RESEARCH ? 'research' : 'game';
  }

  function drawTransition() {
    const g = screenGroup();
    if (g !== lastScreen) {
      if (lastScreen !== null) fadeT = 1;
      lastScreen = g;
    }
    if (fadeT > 0) {
      ctx.fillStyle = `rgba(4,6,12,${fadeT})`;
      ctx.fillRect(-20, -20, G.UW + 40, G.UH + 40);
      fadeT = Math.max(0, fadeT - G.frameDt * 3.2);
    }
  }

  /* ── Low lives: the screen edges pulse red ── */
  let dangerCanvas = null;
  function drawDanger() {
    if (G.state !== STATE_PLAYING && G.state !== STATE_BUILD) return;
    const ratio = G.lives / G.runStartLives;
    const hurt = G.livesPulse;
    if (ratio > 0.3 && hurt <= 0.01) return;
    if (!dangerCanvas) {
      dangerCanvas = makeCanvas(160, 110);
      const g = dangerCanvas.getContext('2d');
      const grad = g.createRadialGradient(80, 55, 40, 80, 55, 100);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, 'rgba(220,20,20,0.7)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 160, 110);
    }
    const a = Math.max(hurt * 0.7, ratio <= 0.3 ? 0.18 + 0.14 * Math.sin(G.animTime * 5) : 0);
    ctx.globalAlpha = a;
    ctx.drawImage(dangerCanvas, -20, -20, G.UW + 40, G.UH + 40);
    ctx.globalAlpha = 1;
  }

  function updateEffects(dt) {
    const k = G.state === STATE_PLAYING ? G.gameSpeed * (G.hitstop > 0 ? 0.25 : 1) : 1;
    updateParticles(dt * k);
    updateTexts(dt * Math.min(k, 2));
    updateDecals(dt * k);
  }

  let shakeMag = 0, shakeTime = 0, shakeDur = 1;

  function addShake(intensity, ms) {
    if (intensity >= shakeMag * (shakeTime / shakeDur)) {
      shakeMag = intensity;
      shakeDur = shakeTime = Math.max(0.05, ms / 1000);
    }
  }

  function updateShake(dt) {
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt);
      const k = shakeMag * (shakeTime / shakeDur) * view.s * 0.8;
      G.shakeX = (fxRandom() * 2 - 1) * k;
      G.shakeY = (fxRandom() * 2 - 1) * k;
    } else
      G.shakeX = G.shakeY = 0;
  }

  NS.effects = { goldHudPos, fxRandom, PK_PIXEL, PK_SMOKE, emit, drawParticles, rnd, particles, floatingText,
      drawTexts, decals, addDecal, drawDecals, FX_BUDGET, explosionFx, deathFx, uiCoins, coinFly,
      updateDrawCoins, showBanner, drawBanner, drawBossIntro, drawTransition, drawDanger, updateEffects,
      addShake, updateShake };

})();
