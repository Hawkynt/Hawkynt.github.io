/* Cinematic scenes, drawn live from cached art: Pac-Land under its five Lumens, the Hollow King's
   theft, talking heads with typed dialogue, chapter title cards over each world, a boss rising
   with its name card, a Lumen relighting in rays of light, the title sting, the credits roll and
   the arcade chase intermission; with letterbox bars, fades and the skip hint. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { WORLDS, BOSSES, CAST } = NS.worlds;
  const K = NS.artKit;
  const AA = NS.actorArt;
  const kit = NS.kit;
  const E = NS.rng;
  const { ctx } = NS.view;

  const LUMEN_COLS = ['#4a8cff', '#ff7ad0', '#9aeaff', '#a07aff', '#ffa040'];

  function pip(x, y, s, t) {
    ctx.globalCompositeOperation = 'lighter';
    K.blit(ctx, K.glow('#9af4ff'), x, y, s * (1.6 + Math.sin(t * 6) * 0.15));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e8fcff';
    ctx.beginPath(); ctx.arc(x, y, 12 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a3040';
    ctx.beginPath(); ctx.arc(x - 4 * s, y - 2 * s, 2 * s, 0, TAU); ctx.arc(x + 4 * s, y - 2 * s, 2 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a3040'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(x, y + 2 * s, 4 * s, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  function lumens(t, lit, cx, cy, spread) {
    for (let i = 0; i < 5; ++i) {
      const x = cx + (i - 2) * spread, y = cy + Math.sin(t * 1.5 + i) * 8 - Math.abs(i - 2) * -14;
      const on = lit > i;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = on ? 1 : 0.15;
      K.blit(ctx, K.glow(LUMEN_COLS[i]), x, y, 1.8 + Math.sin(t * 3 + i) * 0.15);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blit(ctx, NS.mazeArt.pellet(on ? LUMEN_COLS[i] : '#404050'), x, y, 1.4);
    }
  }

  /* a little parade along the ground */
  function parade(t, y, dir, ghostsChase, speed) {
    const span = 1700, v = speed || 160;
    const x = dir > 0 ? -200 + ((t * v) % span) : 1480 - ((t * v) % span);
    const fr = AA.mouthIndex(t * 8);
    K.blitEx(ctx, AA.pac('classic', fr), x, y, 0, 1.6 * dir, 1.6);
    const kinds = [['#ff3b3b', 'blinky'], ['#ffa6e8', 'pinky'], ['#3ae8ff', 'inky'], ['#ffab3a', 'clyde']];
    for (let i = 0; i < 4; ++i) {
      const gx = x - dir * (90 + i * 64);
      const f = Math.floor(t * 7 + i) % 2;
      if (ghostsChase === 'scared') K.blit(ctx, AA.scared(f, false), gx, y - 4, 1.5);
      else {
        K.blit(ctx, AA.ghost(kinds[i][0], kinds[i][1], f), gx, y - 4, 1.5);
        K.blit(ctx, AA.eyes(dir > 0 ? 2 : 0), gx, y - 4, 1.5);
      }
    }
  }

  function bars(c) {
    const r = NS.view.visible();
    const k = Math.min(1, c.t * 3);
    const h = 64 * k;
    ctx.fillStyle = '#000000';
    ctx.fillRect(r.x0, r.y0, r.w, h - r.y0);
    ctx.fillRect(r.x0, 720 - h, r.w, r.y1 - 720 + h);
  }

  function caption(text, t) {
    if (!text) return;
    const a = Math.min(1, t * 2);
    ctx.globalAlpha = a;
    kit.panel(240, 560, 800, 80, { accent: UI.accent, alpha: 0.9 });
    kit.wrap(text, 640, 580, 760, 20, 26, '#ffffff', { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  function portrait(who, x, y, t) {
    const bob = Math.sin(t * 3) * 6;
    switch (who) {
      case 'pac': K.blitEx(ctx, AA.pac(G.profile.skin, AA.mouthIndex(t * 6)), x, y + bob, 0, 4.4, 4.4); break;
      case 'pip': pip(x, y + bob, 4, t); break;
      case 'king': K.blitEx(ctx, AA.boss('king', 'normal'), x, y + bob, 0, 2.6, 2.6); break;
      default: {
        const col = CAST[who] ? CAST[who].color : '#ffffff';
        K.blitEx(ctx, AA.ghost(col, who, Math.floor(t * 4) % 2), x, y + bob, 0, 5, 5);
        K.blitEx(ctx, AA.eyes(3), x, y + bob, 0, 5, 5);
      }
    }
  }

  function talk(c, shot) {
    const t = c.shotT;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-400, -200, 2100, 1200);
    const leftSide = shot.who === 'pac' || shot.who === 'pip';
    const px = leftSide ? 250 : 1030;
    const k = E.easeOut(Math.min(1, t * 3));
    ctx.save();
    ctx.translate(px + (leftSide ? -200 : 200) * (1 - k), 330);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    K.blit(ctx, K.glow((CAST[shot.who] || CAST.pac).color), 0, 0, 5);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    portrait(shot.who, 0, 0, t);
    ctx.restore();
    const bx = leftSide ? 430 : 120, by = 470, bw = 730, bh = 150;
    kit.panel(bx, by, bw, bh, { accent: (CAST[shot.who] || CAST.pac).color, glow: true });
    kit.text((CAST[shot.who] || CAST.pac).name.toUpperCase(), bx + 26, by + 28, 18, (CAST[shot.who] || CAST.pac).color, { weight: 'bold' });
    const n = Math.floor(t * 38);
    kit.wrap(shot.line.slice(0, n), bx + 26, by + 50, bw - 52, 22, 30, '#ffffff');
    if (n >= shot.line.length && Math.floor(G.time * 2) % 2 === 0) kit.text('▼', bx + bw - 30, by + bh - 22, 14, UI.textDim);
  }

  function card(c) {
    const t = c.shotT;
    const wi = c.data.world || 0;
    const w = WORLDS[wi];
    const k = E.easeBack(Math.min(1, t * 1.6));
    ctx.save();
    ctx.translate(640, 330);
    ctx.scale(k, k);
    kit.text('CHAPTER ' + (wi + 1), 0, -70, 26, w.theme.accent, { align: 'center', weight: 'bold' });
    ctx.font = kit.font(76, '900');
    ctx.textAlign = 'center';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(w.name, 0, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(w.name, 0, 10);
    ctx.restore();
    ctx.globalAlpha = Math.min(1, Math.max(0, t - 0.6) * 2);
    kit.text('Win back ' + w.lumen, 640, 420, 22, w.theme.rim, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  function bossrise(c) {
    const t = c.shotT;
    const id = c.data.boss || 'colossus';
    const d = BOSSES[id];
    const rise = E.easeOut(Math.min(1, t / 1.6));
    const shake = t < 1.6 ? (Math.random() - 0.5) * 8 : 0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6;
    K.blit(ctx, K.glow(d.color), 640, 340, 9);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    K.blitEx(ctx, AA.boss(id, 'normal'), 640 + shake, 820 - rise * 520, Math.sin(t * 2) * 0.05, 3.4, 3.4);
    if (t > 1.4) {
      const k = E.easeBack(Math.min(1, (t - 1.4) * 3));
      ctx.save();
      ctx.translate(640, 590);
      ctx.scale(k, k);
      kit.panel(-300, -46, 600, 92, { accent: d.color, glow: true });
      kit.text(d.name.toUpperCase(), 0, -12, 34, d.color, { align: 'center', weight: 'bold' });
      kit.text(d.title, 0, 24, 16, UI.text, { align: 'center' });
      ctx.restore();
    }
  }

  function relight(c, shot) {
    const t = c.shotT;
    const wi = c.data.world || 0;
    const col = LUMEN_COLS[wi % 5];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; ++i) {
      const a = i * TAU / 16 + t * 0.4;
      ctx.globalAlpha = 0.12 * Math.min(1, t);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(640, 300);
      ctx.lineTo(640 + Math.cos(a) * 1400, 300 + Math.sin(a) * 1400);
      ctx.lineTo(640 + Math.cos(a + 0.12) * 1400, 300 + Math.sin(a + 0.12) * 1400);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    K.blit(ctx, K.glow(col), 640, 300, 4 + Math.sin(t * 4) * 0.4 + Math.min(1, t) * 2);
    ctx.restore();
    K.blit(ctx, NS.mazeArt.pellet(col), 640, 300, 3.5 * E.easeBack(Math.min(1, t * 1.5)));
    K.blitEx(ctx, AA.pac(G.profile.skin, AA.mouthIndex(t * 5)), 470, 470, 0, 2.4, 2.4);
    pip(800, 440 + Math.sin(t * 4) * 10, 1.6, t);
    if (!shot.cap) kit.text(WORLDS[wi].lumen.replace(/^the /, 'The ') + ' shines again!', 640, 560, 28, '#ffffff', { align: 'center', weight: 'bold' });
  }

  function credits(c) {
    const t = c.shotT;
    const lines = ['PAC-MAN', '', 'Pac-Land is bright again', '', 'Starring', 'Pac-Man', 'Pip, the last spark', 'Blinky - Pinky - Inky - Clyde',
      'The Gumdrop Queen - Frostmaw - The Banshee', 'and the Hollow King', '', 'Thank you for playing', '', 'Arcade, Zen and the Daily Maze await'];
    for (let i = 0; i < lines.length; ++i) {
      const y = 720 - t * 70 + i * 44;
      if (y < 40 || y > 700) continue;
      kit.text(lines[i], 640, y, i === 0 ? 40 : 22, i === 0 ? UI.accent : '#ffffff', { align: 'center', weight: i === 0 ? 'bold' : 'normal' });
    }
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const shot = NS.cinematics.current();
    const t = c.shotT;
    const scene = shot.scene;
    const wi = scene === 'land' || scene === 'theft' || scene === 'title' || scene === 'credits' ? 0 : c.data.world || 0;
    const th = scene === 'theft' ? WORLDS[3].theme : scene === 'bossrise' && c.data.boss === 'king' ? WORLDS[4].theme : WORLDS[Math.min(wi, WORLDS.length - 1)].theme;
    NS.backdrop.draw(ctx, th, { pan: Math.sin(c.t * 0.2) * 30 });
    switch (scene) {
      case 'land':
        lumens(t, c.kind === 'ending' ? 5 : 5, 640, 180, 150);
        parade(t, 560, 1, 'normal');
        break;
      case 'theft': {
        const k = Math.min(1, t / 3);
        lumens(t, Math.max(0, 5 - Math.floor(k * 6)), 640, 180, 150 * (1 - k * 0.8));
        const by = 300 + Math.sin(t * 2) * 20;
        K.blitEx(ctx, AA.boss('king', 'normal'), 640 + Math.sin(t) * 60, by + 220 * (1 - Math.min(1, t)), 0, 2.4, 2.4);
        if (t > 1 && Math.random() < 0.3) NS.fx.burst(640 + (Math.random() - 0.5) * 300, 180, 3, LUMEN_COLS[Math.floor(Math.random() * 5)], 120, 0.6, 6, 0);
        break;
      }
      case 'talk': talk(c, shot); break;
      case 'card': card(c); break;
      case 'bossrise': bossrise(c); break;
      case 'relight': relight(c, shot); break;
      case 'credits': credits(c); break;
      case 'chase': {
        /* the classic gag: chased across, then back again as a giant with the ghosts fleeing */
        const half = t < 2.5;
        if (half) parade(t, 430, 1, 'normal', 620);
        else {
          const x = 1480 + 300 - (t - 2.5) * 620;
          for (let i = 0; i < 4; ++i) K.blit(ctx, AA.scared(Math.floor(t * 7 + i) % 2, false), x - 300 - i * 64, 426, 1.5);
          K.blitEx(ctx, AA.pac(G.profile.skin, AA.mouthIndex(t * 8)), x, 400, 0, -4, 4);
        }
        kit.text('INTERMISSION', 640, 160, 30, UI.accent, { align: 'center', weight: 'bold' });
        break;
      }
      case 'title': {
        const k = E.easeBack(Math.min(1, t * 1.4));
        ctx.save(); ctx.translate(640, 280); ctx.scale(k, k);
        K.blit(ctx, kit.logo(), 0, 0, 1.1);
        ctx.restore();
        parade(t * 1.4, 500, 1, 'normal');
        break;
      }
    }
    NS.fxRender.draw();
    bars(c);
    caption(shot.cap, t);
    kit.text('Any key, click or tap to skip', NS.view.visible().x1 - 24, 700, 12, 'rgba(255,255,255,0.55)', { align: 'right' });
  }

  Object.assign(NS.cineRender, {
    draw, pip, lumens, parade
  });
})();
