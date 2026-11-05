/* Cinematics and dialogue: plays the scripted shots (village at night, the quake, the Hollow
   King waking, Pip and the lamp radio, the lift down, chapter vistas, the walk in, boss
   entrances, the Heartstone, dawn over Emberfall, credits) with letterbox bars, camera drift,
   shake and typed captions, skippable by any key, click or tap; and the comic-style dialogue
   panels with portraits between chapters. Owns G.cine and G.dialogue. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const ST = NS.story;
  const kit = NS.kit;
  const CA = NS.creatureArt;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  let returnScreen = 'title';

  function play(id, opts, onDone) {
    const shots = ST.CINEMATICS[id];
    if (!shots) { if (onDone) onDone(); return; }
    G.cine = { id, shots, i: 0, t: 0, ch: (opts && opts.ch) || 0, onDone, total: 0 };
    G.dialogue = null;
    if (G.screen !== 'cinema') returnScreen = G.screen;
    NS.screens.setScreen('cinema');
    shotSound();
  }

  function dialogue(lines, onDone) {
    G.dialogue = { lines, i: 0, chars: 0, onDone };
    G.cine = null;
    NS.screens.setScreen('cinema');
  }

  function shotSound() {
    const c = G.cine;
    if (!c || !SZ.GameAudio) return;
    const s = c.shots[c.i].scene;
    const map = { quake: 'explode', king: 'whoosh', bossRise: 'thud', heart: 'powerup', dawn: 'win', lift: 'whoosh', vista: 'select', credits: 'levelup' };
    if (map[s]) SZ.GameAudio.play(map[s], { volume: 0.35 });
  }

  function finish() {
    const done = G.cine ? G.cine.onDone : G.dialogue ? G.dialogue.onDone : null;
    G.cine = null;
    G.dialogue = null;
    if (done) done();
    else NS.screens.setScreen(returnScreen);
  }

  /* any key, click or tap */
  function skip(all) {
    if (G.dialogue) {
      const d = G.dialogue;
      const line = d.lines[d.i];
      if (!all && d.chars < line.text.length) { d.chars = line.text.length; return; }
      if (!all && d.i < d.lines.length - 1) { ++d.i; d.chars = 0; SZ.GameAudio && SZ.GameAudio.play('blip', { volume: 0.2 }); return; }
      finish();
      return;
    }
    if (G.cine) finish();
  }

  function update(dt) {
    if (G.dialogue) {
      G.dialogue.chars += dt * 48;
      return;
    }
    const c = G.cine;
    if (!c) return;
    c.t += dt;
    c.total += dt;
    if (c.t >= c.shots[c.i].dur) {
      c.t = 0;
      ++c.i;
      if (c.i >= c.shots.length) { finish(); return; }
      shotSound();
    }
  }

  /* ── Scene painters (plane coordinates, full visible rect) ── */
  function sky(v, top, bottom) {
    const g = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function stars(v, n, seed) {
    const r = K.rand(seed);
    for (let k = 0; k < n; ++k) {
      const x = v.x0 + r() * v.w, y = v.y0 + r() * v.h * 0.6;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(G.time * (0.5 + r()) + k));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function mountain(v, col, lift) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(v.x0, v.y1);
    ctx.lineTo(v.x0, 520 - lift);
    ctx.lineTo(260, 420 - lift); ctx.lineTo(470, 230 - lift); ctx.lineTo(560, 300 - lift); ctx.lineTo(640, 150 - lift);
    ctx.lineTo(760, 290 - lift); ctx.lineTo(900, 260 - lift); ctx.lineTo(1100, 430 - lift); ctx.lineTo(v.x1, 470 - lift);
    ctx.lineTo(v.x1, v.y1);
    ctx.closePath();
    ctx.fill();
  }

  function village(v, lit, dawn) {
    const r = K.rand(42);
    for (let k = 0; k < 14; ++k) {
      const x = 120 + k * 78 + r() * 20, h = 50 + r() * 40, w = 50 + r() * 20, y = 600 - h;
      ctx.fillStyle = dawn ? '#5a3a2a' : '#1a1210';
      ctx.fillRect(x, y, w, h + 140);
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + w / 2, y - 30); ctx.lineTo(x + w + 8, y); ctx.fill();
      const on = typeof lit === 'number' ? (k / 14 < lit) : lit;
      for (let wdw = 0; wdw < 2; ++wdw) {
        const wx = x + 10 + wdw * (w - 30), wy = y + 18;
        ctx.fillStyle = on ? '#ffd27a' : '#2a2420';
        ctx.fillRect(wx, wy, 12, 14);
        if (on) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5;
          ctx.drawImage(K.glow('#ffb347'), wx - 24, wy - 24, 60, 60);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    ctx.fillStyle = dawn ? '#3a2a1a' : '#0e0a08';
    ctx.fillRect(v.x0, 640, v.w, v.y1 - 640);
  }

  function scene(c, v) {
    const shot = c.shots[c.i];
    const t = c.t, k = t / shot.dur;
    const ch = c.ch;
    const theme = ST.CHAPTERS[ch] ? ST.CHAPTERS[ch].theme : 'amber';
    switch (shot.scene) {
      case 'village':
        sky(v, '#0a0f2a', '#2a1a3a');
        stars(v, 120, 5);
        mountain(v, '#141020', -k * 20);
        village(v, true, false);
        break;
      case 'quake': {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 14 * (1 - k * 0.5), (Math.random() - 0.5) * 10);
        sky(v, '#05060f', '#140c18');
        stars(v, 60, 5);
        mountain(v, '#100c18', 0);
        village(v, 1 - k * 1.3, false);
        ctx.restore();
        if (Math.random() < 0.5) NS.fx.burst(v.x0 + Math.random() * v.w - 0, v.y0 + 40, 2, { color: ['#5a4a3a', '#3a2e24'], speed: 40, life: 1.2, size: 6, kind: 1, gravity: 500 });
        NS.fxRender.drawWorld(0, 0);
        break;
      }
      case 'king': {
        NS.backdrop.drawVista('crystal', 0, -k * 60);
        const s = 3 + k * 0.6;
        const img = CA.boss('king', Math.floor(G.time * 2) & 1, false);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(K.glow('#c58bff'), 640 - 260, 380 - 260 - k * 60, 520, 520);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 640 - 40 * s, 600 - 80 * s - k * 40 + 100 * (1 - Math.min(1, k * 2)), 80 * s, 80 * s);
        const tiles = NS.tileArt.tiles('crystal', '');
        for (let q = 0; q < 10; ++q) {
          const a = q / 10 * C.TAU + G.time * 0.8, rad = 420 * (1 - ((t * 0.4 + q / 10) % 1));
          ctx.drawImage(tiles.gem[q & 7], 640 + Math.cos(a) * rad - 20, 380 + Math.sin(a) * rad * 0.5 - 20);
        }
        break;
      }
      case 'pip': {
        NS.backdrop.drawVista('amber', -k * 80, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow('#ffd27a'), 640 - 300, 420 - 300, 600, 600);
        ctx.globalCompositeOperation = 'source-over';
        const img = NS.spriteArt.miner(G.save.skin).right[Math.floor(t * 2) % 2 ? 'front' : 'blink'];
        const s = 5.2;
        ctx.drawImage(img, 640 - 24 * s, 600 - 46 * s, 48 * s, 48 * s);
        const port = NS.spriteArt.portrait('marla');
        ctx.drawImage(port, v.x1 - 220, v.y0 + 110, 140, 140);
        ctx.strokeStyle = K.rgba('#9fe3a1', 0.6 * (1 - (t * 1.5) % 1));
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(v.x1 - 150, v.y0 + 180, 90 + ((t * 1.5) % 1) * 50, 0, C.TAU); ctx.stroke();
        break;
      }
      case 'lift': {
        const scroll = t * 320;
        const themes = ['amber', 'frost', 'grotto', 'magma', 'crystal'];
        for (let b = 0; b < 8; ++b) {
          const y = v.y0 + ((b * 260 - scroll) % (260 * 8) + 260 * 8) % (260 * 8) - 260;
          const p = ST.THEMES[themes[b % 5]];
          ctx.fillStyle = p.rock;
          ctx.fillRect(v.x0, y, v.w, 262);
          ctx.fillStyle = K.rgba(p.vein, 0.4);
          for (let q = 0; q < 12; ++q) ctx.fillRect(v.x0 + ((q * 137 + b * 51) % Math.max(1, v.w)), y + (q * 53) % 240, 6, 6);
        }
        ctx.fillStyle = '#100a06';
        ctx.fillRect(560, v.y0, 160, v.h);
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(600, v.y0); ctx.lineTo(600, 300); ctx.moveTo(680, v.y0); ctx.lineTo(680, 300); ctx.stroke();
        kit.panel(570, 300, 140, 170, { accent: '#ffb347', radius: 6 });
        const img = NS.spriteArt.miner(G.save.skin).right.front;
        ctx.drawImage(img, 640 - 48, 340, 96, 96);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow('#ffd27a'), 640 - 120, 380 - 120, 240, 240);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'vista': {
        NS.backdrop.drawVista(theme, -k * 200, 0);
        NS.backdrop.drawAmbient(theme, 1 / 60, 60);
        const chd = ST.CHAPTERS[ch];
        const a = Math.min(1, t * 1.5);
        ctx.globalAlpha = a;
        kit.text(chd.title, 640, 300, 46, ST.THEMES[theme].accent, { align: 'center', weight: 'bold' });
        kit.wrap(chd.blurb, 640, 350, 760, 20, 28, UI.text, { align: 'center' });
        ctx.globalAlpha = 1;
        break;
      }
      case 'descend': {
        NS.backdrop.drawVista(theme, -t * 120, 0);
        const tiles = NS.tileArt.tiles(theme, G.season ? G.season.id : '');
        const T = C.TILE;
        for (let x = v.x0 - ((t * 60) % T) - T; x < v.x1 + T; x += T) { ctx.drawImage(tiles.dirt[0][1], x, 520); ctx.drawImage(tiles.dirt[0][0], x, 560); ctx.drawImage(tiles.dirt[1][0], x, 600); }
        const img = NS.spriteArt.miner(G.save.skin).right['walk' + (Math.floor(t * 10) & 3)];
        ctx.drawImage(img, 200 + t * 260 - 48, 520 - 92, 96, 96);
        break;
      }
      case 'bossRise': {
        const kind = ST.CHAPTERS[ch].boss;
        const def = NS.items.BOSSES[kind];
        NS.backdrop.drawVista(theme, 0, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
        const rise = Math.min(1, t / 1.6);
        const sh = rise < 1 ? (Math.random() - 0.5) * 12 : 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow(def.color), 640 - 240, 360 - 240, 480, 480);
        ctx.globalCompositeOperation = 'source-over';
        const s = 3.4;
        ctx.save();
        ctx.beginPath(); ctx.rect(v.x0, v.y0, v.w, 560 - v.y0); ctx.clip();
        ctx.drawImage(CA.boss(kind, Math.floor(G.time * 3) & 1, false), 640 - 40 * s + sh, 560 - 80 * s * rise, 80 * s, 80 * s);
        ctx.restore();
        ctx.fillStyle = '#100a06';
        ctx.fillRect(v.x0, 556, v.w, v.y1 - 556);
        if (rise >= 1) {
          kit.text(def.name, 640, 596, 44, def.color, { align: 'center', weight: 'bold' });
          kit.text(def.title, 640, 632, 19, UI.dim, { align: 'center' });
        }
        break;
      }
      case 'heart': {
        sky(v, '#1a0c33', '#05020b');
        const glowR = 200 + k * 260;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow('#ffe9a0'), 640 - glowR, 360 - glowR, glowR * 2, glowR * 2);
        ctx.drawImage(K.glow('#e3b6ff'), 640 - 200, 360 - 200, 400, 400);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = K.mix('#5a3a9a', '#fff3c0', k);
        K.poly(ctx, [640, 210, 740, 330, 640, 510, 540, 330]);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        K.poly(ctx, [640, 210, 740, 330, 640, 330]);
        ctx.fill();
        const tiles = NS.tileArt.tiles('crystal', '');
        for (let q = 0; q < 14; ++q) {
          const a = q / 14 * C.TAU, rad = 460 * (1 - ((t * 0.5 + q / 14) % 1));
          ctx.drawImage(tiles.gem[q & 7], 640 + Math.cos(a) * rad - 20, 360 + Math.sin(a) * rad * 0.6 - 20);
        }
        break;
      }
      case 'dawn':
        sky(v, '#ffb88a', '#ffe9c0');
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow('#fff3c0'), 640 - 300, 420 - 300 - k * 80, 600, 600);
        ctx.globalCompositeOperation = 'source-over';
        mountain(v, '#7a4a5a', 0);
        village(v, true, true);
        if (Math.random() < 0.1) NS.fx.burst(200 + Math.random() * 880, 120 + Math.random() * 120, 30, { color: ['#ff4fa0', '#ffd54a', '#5fd6ff', '#7dff8a'], speed: 160, life: 1.2, size: 3, gravity: 60 });
        NS.fxRender.drawWorld(0, 0);
        break;
      case 'credits': {
        NS.backdrop.drawVista('crystal', 0, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
        const lines = ['BOULDER DASH', '', 'A SynthelicZ desktop game', '', 'Pip Ferrow - the miner', 'Granny Marla - on the radio', 'Bolt - lantern sprite', 'The Hollow King - warm at last', '', 'Thank you for playing!'];
        for (let q = 0; q < lines.length; ++q)
          kit.text(lines[q], 640, 700 - t * 90 + q * 46, q === 0 ? 44 : 22, q === 0 ? UI.accent : UI.text, { align: 'center', weight: q === 0 ? 'bold' : 'normal' });
        break;
      }
    }
  }

  function bars(v, a) {
    const h = 64 * a;
    ctx.fillStyle = '#000';
    ctx.fillRect(v.x0, v.y0, v.w, h);
    ctx.fillRect(v.x0, v.y1 - h, v.w, h);
  }

  function drawCine(dt) {
    const c = G.cine;
    const v = visible();
    scene(c, v);
    const shot = c.shots[c.i];
    const fadeIn = Math.min(1, c.t * 3), fadeOut = Math.min(1, (shot.dur - c.t) * 3);
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1 - Math.min(fadeIn, fadeOut);
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
    bars(v, 1);
    if (shot.title || shot.text) {
      const chars = Math.floor(c.t * 40);
      if (shot.title) kit.text(shot.title, 640, v.y1 - 110, 30, UI.accent, { align: 'center', weight: 'bold' });
      kit.wrap(shot.text, 640, v.y1 - 86, 900, 19, 24, UI.text, { align: 'center', chars });
    }
    kit.text('any key to skip', v.x1 - 20, v.y1 - 30, 13, UI.faint, { align: 'right' });
    for (let q = 0; q < c.shots.length; ++q) {
      ctx.fillStyle = q === c.i ? UI.accent : 'rgba(255,255,255,0.25)';
      ctx.fillRect(v.x0 + 20 + q * 22, v.y1 - 34, 16, 4);
    }
  }

  function drawDialogue() {
    const d = G.dialogue;
    const v = visible();
    const theme = G.run ? NS.world.themeOf(G.run) : 'amber';
    NS.backdrop.drawVista(theme, Math.sin(G.time * 0.2) * 100, 0);
    NS.backdrop.drawAmbient(theme, 1 / 60, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    /* earlier lines stay as smaller comic panels above */
    for (let q = 0; q < d.i; ++q) {
      const ln = d.lines[q];
      const y = 120 + q * 96;
      kit.panel(220, y, 840, 84, { accent: ST.CAST[ln.who].color, alpha: 0.75 });
      ctx.drawImage(NS.spriteArt.portrait(ln.who), 232, y + 10, 64, 64);
      kit.text(ST.CAST[ln.who].name, 310, y + 24, 15, ST.CAST[ln.who].color, { weight: 'bold' });
      kit.wrap(ln.text, 310, y + 40, 730, 16, 20, UI.dim);
    }
    const ln = d.lines[d.i];
    const cast = ST.CAST[ln.who];
    const y = v.y1 - 230;
    kit.panel(140, y, 1000, 190, { accent: cast.color, glow: true });
    const bob = Math.sin(G.time * 4) * 3;
    ctx.drawImage(NS.spriteArt.portrait(ln.who), 164, y + 30 + bob, 130, 130);
    kit.text(cast.name, 320, y + 40, 24, cast.color, { weight: 'bold' });
    kit.text(cast.role, 320, y + 66, 14, UI.faint);
    kit.wrap(ln.text, 320, y + 90, 780, 22, 30, UI.text, { chars: Math.floor(d.chars) });
    if (d.chars >= ln.text.length && Math.floor(G.time * 2) % 2) kit.text('>', 1104, y + 160, 22, cast.color, { weight: 'bold' });
    kit.text((d.i + 1) + ' / ' + d.lines.length + '   click or press a key   Esc skips', v.x1 - 20, v.y1 - 18, 13, UI.faint, { align: 'right' });
  }

  function draw(dt) {
    if (G.dialogue) drawDialogue();
    else if (G.cine) drawCine(dt);
  }

  Object.assign(NS.cinema, { play, dialogue, skip, update, draw });
})();
