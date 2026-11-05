/* Juice: a pooled particle system (glowing motes, debris chunks with gravity, sparks), shock
   rings, floating score text, screen shake, hit-stop, screen flashes and the miner's dig trail,
   plus the table that turns cave events into effects and sounds, and the soft generative
   ambience of Zen mode. Coordinates are cave pixels. Owns NS.fx.state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const I = NS.items;
  const T = C.TILE;

  const MAX = 1400;
  const P = {
    x: new Float32Array(MAX), y: new Float32Array(MAX), vx: new Float32Array(MAX), vy: new Float32Array(MAX),
    life: new Float32Array(MAX), max: new Float32Array(MAX), size: new Float32Array(MAX), grav: new Float32Array(MAX),
    kind: new Uint8Array(MAX), color: new Array(MAX).fill('#fff'), count: 0
  };
  const rings = [];
  const texts = [];
  const state = { shake: 0, shakeT: 0, hitstop: 0, flash: 0, flashColor: '#fff', lastThud: 0, zenT: 0, sfxCount: 0 };

  /* kinds: 0 glow mote, 1 chunk, 2 spark, 3 soft smoke */
  function spawn(x, y, vx, vy, life, size, color, kind, grav) {
    if (P.count >= MAX) return;
    const i = P.count++;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
    P.life[i] = life; P.max[i] = life; P.size[i] = size; P.color[i] = color; P.kind[i] = kind; P.grav[i] = grav || 0;
  }

  function burst(x, y, n, o) {
    o = o || {};
    const sp = o.speed || 80, life = o.life || 0.6, size = o.size || 3;
    for (let k = 0; k < n; ++k) {
      const a = Math.random() * C.TAU, v = sp * (0.3 + Math.random() * 0.7);
      const col = Array.isArray(o.color) ? o.color[k % o.color.length] : (o.color || '#fff');
      spawn(x + (Math.random() - 0.5) * (o.spread || 8), y + (Math.random() - 0.5) * (o.spread || 8),
        Math.cos(a) * v, Math.sin(a) * v - (o.up || 0), life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6),
        col, o.kind || 0, o.gravity);
    }
  }

  function ring(x, y, r, color, life, width) {
    if (rings.length > 40) rings.shift();
    rings.push({ x, y, r, color, life: life || 0.5, max: life || 0.5, w: width || 4 });
  }

  function text(x, y, str, color, size) {
    if (texts.length > 30) texts.shift();
    texts.push({ x, y, str: String(str), color: color || '#fff', size: size || 18, life: 1.1, max: 1.1 });
  }

  function shake(a, t) {
    state.shake = Math.max(state.shake, a);
    state.shakeT = Math.max(state.shakeT, t || 0.25);
  }

  function hitstop(t) {
    state.hitstop = Math.max(state.hitstop, t);
  }

  function flash(color, a) {
    state.flashColor = color;
    state.flash = Math.max(state.flash, a);
  }

  function reset() {
    P.count = 0;
    rings.length = 0;
    texts.length = 0;
    state.shake = state.shakeT = state.hitstop = state.flash = 0;
  }

  function update(dt) {
    for (let i = 0; i < P.count; ++i) {
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        const j = --P.count;
        if (i !== j) {
          P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j]; P.life[i] = P.life[j];
          P.max[i] = P.max[j]; P.size[i] = P.size[j]; P.color[i] = P.color[j]; P.kind[i] = P.kind[j]; P.grav[i] = P.grav[j];
        }
        --i;
        continue;
      }
      P.vy[i] += P.grav[i] * dt;
      const drag = P.kind[i] === 3 ? 0.94 : 0.985;
      P.vx[i] *= drag; P.vy[i] *= drag;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
    }
    for (let k = rings.length - 1; k >= 0; --k) if ((rings[k].life -= dt) <= 0) rings.splice(k, 1);
    for (let k = texts.length - 1; k >= 0; --k) {
      const t = texts[k];
      t.life -= dt;
      t.y -= dt * 38;
      if (t.life <= 0) texts.splice(k, 1);
    }
    if (state.shakeT > 0) { state.shakeT -= dt; if (state.shakeT <= 0) state.shake = 0; }
    if (state.hitstop > 0) state.hitstop -= dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.5);
    if (G.screen === 'playing' && G.run && G.run.mode === 'zen') zenAmbience(dt);
    state.sfxCount = 0;
  }

  /* pentatonic droplets at a whisper */
  const PENTA = [1, 1.125, 1.25, 1.5, 1.667, 2];
  function zenAmbience(dt) {
    state.zenT -= dt;
    if (state.zenT > 0) return;
    state.zenT = 1.4 + Math.random() * 2.2;
    sfx(Math.random() < 0.7 ? 'blip' : 'select', { volume: 0.05, pitch: PENTA[(Math.random() * PENTA.length) | 0] * 0.5 });
  }

  function sfx(name, o) {
    if (state.silent || state.sfxCount > 4 || !SZ.GameAudio) return;
    ++state.sfxCount;
    const zen = G.run && G.run.mode === 'zen';
    if (zen) o = Object.assign({}, o, { volume: ((o && o.volume) || 0.5) * 0.45 });
    SZ.GameAudio.play(name, o);
  }

  function cx(cv, i) { return (i % cv.w) * T + T / 2; }
  function cy(cv, i) { return ((i / cv.w) | 0) * T + T / 2; }

  function theme() {
    return NS.world.palette ? NS.world.palette() : NS.story.THEMES.amber;
  }

  function trail(cv, i) {
    const tr = NS.meta.TRAILS.find((t) => t.id === G.save.trail);
    if (!tr || !tr.colors.length) return;
    const x = cx(cv, i), y = cy(cv, i) + 10;
    const kind = tr.id === 'dust' ? 3 : 0;
    burst(x, y, tr.id === 'dust' ? 3 : 4, { color: tr.colors, speed: 26, life: 0.7, size: tr.id === 'dust' ? 6 : 3, kind, up: 10 });
  }

  function onEvents(cv, ev, run) {
    const pal = theme();
    for (let k = 0; k < ev.length; ++k) {
      const e = ev[k];
      const x = e.i >= 0 ? cx(cv, e.i) : 0, y = e.i >= 0 ? cy(cv, e.i) : 0;
      switch (e.t) {
        case 'dig':
          burst(x - C.DX[e.d] * 10, y - C.DY[e.d] * 10, 7, { color: [pal.dirtHi, pal.dirt, pal.dirtLo], speed: 90, life: 0.45, size: 4, kind: 1, gravity: 420, up: 40 });
          sfx('click', { pitch: 0.32 + Math.random() * 0.08, volume: 0.22 });
          trail(cv, e.i);
          break;
        case 'drill':
          burst(x, y, 12, { color: [pal.brickHi, pal.brick, '#fff'], speed: 140, life: 0.5, size: 4, kind: 1, gravity: 500 });
          sfx('zap', { pitch: 0.6, volume: 0.25 });
          break;
        case 'step': trail(cv, e.i); break;
        case 'gem': {
          const col = e.big ? '#ff7af0' : '#7ff6ff';
          burst(x, y, e.big ? 26 : 12, { color: [col, '#ffffff'], speed: e.big ? 160 : 110, life: 0.6, size: 3 });
          ring(x, y, e.big ? 46 : 26, col, 0.35, 3);
          if (e.pts) text(x, y - 16, '+' + e.pts, run && run.mult > 1 ? '#ffd54a' : '#bff8ff', run && run.mult > 1 ? 20 : 16);
          sfx(e.big ? 'coin' : 'pickup', { pitch: 1 + Math.min(1.2, (run ? run.combo : 0) * 0.04), volume: 0.35 });
          break;
        }
        case 'magnet': {
          const tx = cx(cv, e.to), ty = cy(cv, e.to);
          for (let s = 0; s < 6; ++s) spawn(x, y, (tx - x) * 2.4 + (Math.random() - 0.5) * 40, (ty - y) * 2.4 + (Math.random() - 0.5) * 40, 0.4, 3, '#ff9ad0', 0, 0);
          break;
        }
        case 'item': {
          const def = I.POWERUPS[e.kind];
          burst(x, y, 22, { color: [def.color, '#ffffff'], speed: 150, life: 0.8, size: 3 });
          ring(x, y, 60, def.color, 0.5, 5);
          text(x, y - 20, def.name, def.color, 18);
          flash(def.color, 0.12);
          sfx('powerup', { volume: 0.4 });
          break;
        }
        case 'token': {
          const s = G.season;
          const col = s ? s.color : '#ffd54a';
          burst(x, y, 24, { color: [col, s ? s.color2 : '#fff', '#fff'], speed: 140, life: 0.9, size: 3 });
          ring(x, y, 54, col, 0.6, 4);
          text(x, y - 20, s ? s.token : 'Token', col, 17);
          sfx('coin', { pitch: 1.4, volume: 0.4 });
          break;
        }
        case 'push':
          burst(x - C.DX[e.d] * 18, y + 14, 5, { color: ['#a89a88', '#6f6458'], speed: 50, life: 0.4, size: 5, kind: 3 });
          sfx('thud', { pitch: 1.5, volume: 0.25 });
          break;
        case 'strain': sfx('thud', { pitch: 2.2, volume: 0.08 }); break;
        case 'land': {
          const now = G.time;
          if (e.k === C.GEM || e.k === C.BIGGEM) {
            burst(x, y + 16, 3, { color: '#bff8ff', speed: 40, life: 0.3, size: 2 });
            if (now - state.lastThud > 0.08) { state.lastThud = now; sfx('blip', { pitch: 2.2, volume: 0.12 }); }
          } else {
            burst(x, y + 18, 6, { color: ['#b8a890', '#7a6c5c'], speed: 45, life: 0.5, size: 6, kind: 3 });
            if (onScreen(cv, e.i)) shake(2.2, 0.12);
            if (now - state.lastThud > 0.09) { state.lastThud = now; sfx('thud', { volume: 0.35, pitch: 0.8 + Math.random() * 0.3 }); }
          }
          break;
        }
        case 'explode': {
          const r = e.rad || 1;
          const fire = e.leaves === C.GEM ? ['#7ff6ff', '#ffffff', '#c58bff'] : ['#ffd54a', '#ff7a2f', '#ff3d1a', '#fff2c0'];
          burst(x, y, 26 * r, { color: fire, speed: 170 * r, life: 0.7, size: 5 });
          burst(x, y, 10 * r, { color: ['#3a302a', '#5a4a3e', '#2a2420'], speed: 90 * r, life: 1.1, size: 12, kind: 3, up: 30 });
          burst(x, y, 10 * r, { color: [pal.rockHi, pal.rock], speed: 260, life: 0.7, size: 5, kind: 1, gravity: 600 });
          ring(x, y, 70 * r, '#ffd9a0', 0.4, 6);
          shake(6 + r * 3, 0.32);
          hitstop(0.05);
          flash('#ffcc88', 0.18);
          sfx(r > 1 ? 'explode' : 'smallExplode', { volume: 0.5 });
          break;
        }
        case 'kill':
        case 'crush':
          if (e.pts) text(x, y - 18, '+' + e.pts, '#ff9a6a', 20);
          break;
        case 'shield':
          ring(x, y, 70, '#ffd54a', 0.6, 6);
          burst(x, y, 20, { color: ['#ffd54a', '#ffffff'], speed: 150, life: 0.5 });
          text(x, y - 24, 'Saved!', '#ffd54a', 20);
          shake(5, 0.25);
          sfx('zap', { volume: 0.5 });
          break;
        case 'escape':
          text(x, y - 24, 'Lucky!', '#7dff8a', 20);
          ring(x, y, 60, '#7dff8a', 0.5, 4);
          sfx('jump');
          break;
        case 'bonk':
          text(x, y - 20, 'bonk', '#c9fff4', 16);
          burst(x, y - 12, 10, { color: ['#c9fff4', '#ffffff'], speed: 80, life: 0.5, size: 2 });
          sfx('bounce', { volume: 0.25 });
          break;
        case 'death':
          shake(12, 0.5);
          hitstop(0.18);
          flash('#ff3d1a', 0.35);
          burst(x, y, 40, { color: ['#ffb347', '#ff5d5d', '#ffffff'], speed: 220, life: 1.0, size: 4 });
          sfx('hurt');
          break;
        case 'bombSet': sfx('drop', { volume: 0.4 }); break;
        case 'magic': flash('#c58bff', 0.15); sfx('zap', { pitch: 0.7, volume: 0.4 }); break;
        case 'convert':
          burst(x, y, 10, { color: ['#c58bff', '#ffffff', '#7ff6ff'], speed: 90, life: 0.5, size: 3 });
          sfx('blip', { pitch: 1.8, volume: 0.2 });
          break;
        case 'sizzle':
          burst(x, y - 10, 14, { color: ['#d8d0c8', '#9a9088'], speed: 60, life: 1.0, size: 10, kind: 3, up: 60 });
          burst(x, y, 10, { color: ['#ff7a2f', '#ffd54a'], speed: 120, life: 0.5, size: 3 });
          sfx('whoosh', { pitch: 0.6, volume: 0.4 });
          break;
        case 'amoebaGems':
          flash('#9dff6a', 0.25);
          text(cv.player.c * T, cv.player.r * T - 30, 'The moss crystallised!', '#9dff6a', 20);
          sfx('powerup');
          break;
        case 'amoebaRocks': flash('#888888', 0.25); sfx('thud', { volume: 0.6 }); break;
        case 'exitOpen':
          ring(x, y, 120, '#ffd54a', 0.9, 8);
          burst(x, y, 40, { color: ['#ffd54a', '#ffffff', '#ffb347'], speed: 180, life: 1.2, size: 3 });
          flash('#ffd54a', 0.2);
          sfx('levelup');
          break;
        case 'win':
          burst(x, y, 70, { color: ['#ffd54a', '#7dff8a', '#5fd6ff', '#ff4fa0', '#ffffff'], speed: 260, life: 1.4, size: 4, gravity: 120 });
          ring(x, y, 160, '#ffffff', 0.8, 8);
          flash('#ffffff', 0.35);
          sfx('win');
          break;
        case 'bossHit':
          shake(10, 0.4);
          hitstop(0.12);
          flash('#ffffff', 0.3);
          burst(x + T / 2, y + T / 2, 30, { color: ['#ffffff', '#ffd54a', '#ff7a2f'], speed: 220, life: 0.7, size: 4 });
          if (e.pts) text(x + T / 2, y - 10, '+' + e.pts, '#ffd54a', 24);
          sfx('hit', { volume: 0.7 });
          break;
        case 'bossDie':
          shake(18, 1.0);
          hitstop(0.3);
          flash('#ffffff', 0.6);
          for (let s = 0; s < 4; ++s) ring(x + T / 2, y + T / 2, 90 + s * 50, ['#ffffff', '#ffd54a', '#ff7a2f', '#c58bff'][s], 0.6 + s * 0.2, 7);
          if (e.pts) text(x + T / 2, y - 20, '+' + e.pts, '#ffd54a', 30);
          sfx('explode');
          sfx('win');
          break;
        case 'bossSpecial': sfx('whoosh', { volume: 0.35, pitch: 0.7 }); break;
        case 'summon':
        case 'blink':
          burst(x, y, 20, { color: ['#c58bff', '#ffffff'], speed: 130, life: 0.6, size: 3 });
          ring(x, y, 50, '#c58bff', 0.4, 4);
          if (e.t === 'blink') sfx('laser', { pitch: 0.6, volume: 0.35 });
          break;
        case 'drop': burst(x, y, 6, { color: '#ffffff', speed: 40, life: 0.4, size: 2 }); break;
        case 'shatter':
          burst(x, y + 10, 18, { color: ['#a89a88', '#6f6458', '#ffffff'], speed: 200, life: 0.6, size: 5, kind: 1, gravity: 600 });
          break;
        case 'chain':
          if (e.n > 1 && e.pts) text(cv.player.c * T + T / 2, cv.player.r * T - 30, 'Chain x' + e.n + '  +' + e.pts, '#ff9a3c', 22);
          break;
        case 'wake':
          text(x, y - 22, '!', '#ff9a6a', 26);
          sfx('blip', { pitch: 0.6, volume: 0.3 });
          break;
        case 'powEnd': sfx('blip', { pitch: 0.7, volume: 0.15 }); break;
      }
    }
  }

  function onScreen(cv, i) {
    const p = cv.player;
    const r = (i / cv.w) | 0, c = i % cv.w;
    return Math.abs(r - p.r) < 10 && Math.abs(c - p.c) < 17;
  }

  Object.assign(NS.fx, { P, rings, texts, state, spawn, burst, ring, text, shake, hitstop, flash, reset, update, onEvents, sfx });
})();
