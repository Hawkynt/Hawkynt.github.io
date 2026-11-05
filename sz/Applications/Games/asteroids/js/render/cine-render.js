/* Draws the cinematics on the cine screen with letterbox bars and timed captions: the opening
   (Haven Station, the first rocks falling, the Kestrel's launch, the title), a chapter arrival
   through a warp tunnel to its title card, a titan's reveal under warning stripes, the finale
   (the Maw crumbling, the belt going quiet, the flight home, fireworks and thanks) and a season's
   opening. Owns only the cached station art. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, VIEW_W, VIEW_H, UI } = NS.constants;
  const { CHAPTERS } = NS.campaign;
  const { BOSSES } = NS.enemyData;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

  function ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function fadeIn(t, a, b) {
    return ease((t - a) / (b - a));
  }

  function station() {
    return K.sprite('station', 240, 240, (g, w) => {
      const c = w / 2;
      g.strokeStyle = '#8a9ab8';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(c, c, 90, 0, TAU);
      g.stroke();
      g.strokeStyle = '#d8e0f0';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c, c, 93, 0, TAU);
      g.stroke();
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6;
        g.strokeStyle = '#6a7a98';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * 20, c + Math.sin(a) * 20);
        g.lineTo(c + Math.cos(a) * 86, c + Math.sin(a) * 86);
        g.stroke();
        g.fillStyle = '#ffd890';
        for (let k = 0; k < 4; ++k) g.fillRect(c + Math.cos(a + 0.2 + k * 0.1) * 90 - 1.5, c + Math.sin(a + 0.2 + k * 0.1) * 90 - 1.5, 3, 3);
      }
      const gr = g.createRadialGradient(c - 6, c - 6, 2, c, c, 26);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, '#a0b0d0');
      gr.addColorStop(1, '#2a3450');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, 24, 0, TAU);
      g.fill();
      g.fillStyle = '#5ad8ff';
      g.beginPath();
      g.arc(c, c, 6, 0, TAU);
      g.fill();
    });
  }

  function bars(t, dur) {
    const v = visible();
    const k = Math.min(fadeIn(t, 0, 0.6), 1 - fadeIn(t, dur - 0.5, dur));
    const h = 70 * k;
    ctx.fillStyle = '#000000';
    ctx.fillRect(v.x0, v.y0, v.w, (0 - v.y0) + h);
    ctx.fillRect(v.x0, VIEW_H - h, v.w, v.y1 - (VIEW_H - h));
  }

  function caption(t, a, b, str, color) {
    if (t < a || t > b) return;
    const k = Math.min(fadeIn(t, a, a + 0.4), 1 - fadeIn(t, b - 0.4, b));
    ctx.globalAlpha = k;
    kit.text(str, VIEW_W / 2, VIEW_H - 40, 20, color || '#ffffff', { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function skipHint(c) {
    if (c.t < 0.6) return;
    ctx.globalAlpha = 0.5;
    kit.text('Any key, click or tap to skip', VIEW_W - 24, 30, 12, UI.textDim, { align: 'right' });
    ctx.globalAlpha = 1;
  }

  function rockFall(t, n, seed, speed, toX, toY) {
    for (let i = 0; i < n; ++i) {
      const s = (i * 0.618 + seed) % 1, s2 = (i * 0.754 + seed) % 1;
      const p = ((t * speed + s) % 1);
      const x = -200 + s2 * 900 + p * (toX + 200 - s2 * 400);
      const y = -100 + s * 200 + p * (toY + 100);
      const types = ['normal', 'iron', 'ice', 'lava', 'crystal'];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      for (let k = 1; k < 5; ++k) K.blit(ctx, K.glow('#ffa040'), x - k * 14, y - k * 7, 0.5 - k * 0.08);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, NS.rockArt.rock(types[i % types.length], 2 + (i % 2), i % 6), x, y, t * 2 + i, 0.6 + (i % 3) * 0.2);
    }
  }

  function intro(c) {
    const t = c.t;
    NS.backdrop.setChapter(-1);
    NS.backdrop.draw(0);
    const st = station();
    const sx = 760, sy = 360;
    K.blitRot(ctx, st, sx, sy, t * 0.08, 1 + t * 0.01);
    if (t > 2.5 && t < 9) rockFall(t - 2.5, 6, 0.1, 0.22, sx, sy);
    if (t > 5.8 && t < 6.6) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - (t - 5.8) / 0.8;
      K.blit(ctx, K.glow('#ffd080'), sx + 80, sy - 40, 6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (t > 8.5) {
      /* the Kestrel launches toward the viewer */
      const k = ease((t - 8.5) / 4);
      const x = sx + (380 - sx) * k, y = sy + (420 - sy) * k;
      const s = 0.4 + k * 3.2;
      ctx.globalCompositeOperation = 'lighter';
      K.blitRot(ctx, K.bolt('flame:ion', ['#ffffff', '#9ae8ff', '#3a8aff'], 20, 6), x + 20 * s, y - 2 * s, -0.2, s);
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), x, y, Math.PI + 0.2, s);
    }
    if (t > 11.5) {
      const k = fadeIn(t, 11.5, 12.5);
      ctx.globalAlpha = k;
      const logo = kit.logo();
      K.blit(ctx, logo, VIEW_W / 2, 250, 0.9 + (1 - k) * 0.3);
      kit.text('S T A R F A L L', VIEW_W / 2, 330, 22, UI.gold, { align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
    bars(t, c.dur);
    caption(t, 0.5, 3.4, 'Haven Station. Year 212 of the colony.');
    caption(t, 3.6, 7.4, 'For a billion years the belt drifted in silence.');
    caption(t, 7.6, 11, 'Then the rocks began to fall.', '#ffb04a');
    skipHint(c);
  }

  function warpTunnel(t, k, col) {
    const v = visible();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let i = 0; i < 120; ++i) {
      const a = (i * 2.399) % TAU;
      const p = ((t * (0.8 + (i % 7) * 0.12)) + i * 0.137) % 1;
      const d0 = 40 + p * p * 900, d1 = d0 + 20 + p * 160 * k;
      ctx.globalAlpha = p * 0.8;
      ctx.lineWidth = 1 + p * 3;
      ctx.beginPath();
      ctx.moveTo(VIEW_W / 2 + Math.cos(a) * d0, VIEW_H / 2 + Math.sin(a) * d0);
      ctx.lineTo(VIEW_W / 2 + Math.cos(a) * d1, VIEW_H / 2 + Math.sin(a) * d1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return v;
  }

  function chapter(c) {
    const t = c.t;
    const ch = CHAPTERS[c.data.chapter];
    const th = ch.theme;
    const v = visible();
    if (t < 2.6) {
      ctx.fillStyle = '#000006';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      warpTunnel(t, Math.min(1, t), th.accent);
      K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), VIEW_W / 2, VIEW_H / 2 + Math.sin(t * 9) * 2, -Math.PI / 2, 2);
    } else {
      NS.backdrop.setChapter(c.data.chapter);
      NS.backdrop.draw(0.1);
      const k = ease((t - 2.6) / 2);
      K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), VIEW_W / 2 - 300 + k * 200, VIEW_H / 2 + 120 - k * 60, -0.4, 1.6);
      if (t < 3) {
        ctx.fillStyle = 'rgba(255,255,255,' + (1 - (t - 2.6) / 0.4) + ')';
        ctx.fillRect(v.x0, v.y0, v.w, v.h);
      }
      const a = fadeIn(t, 2.9, 3.6);
      ctx.globalAlpha = a;
      kit.text('CHAPTER ' + ROMAN[c.data.chapter], VIEW_W / 2, 270, 22, th.accent, { align: 'center', weight: 'bold' });
      const name = ch.name.toUpperCase();
      const n = Math.min(name.length, Math.floor((t - 3) * 18));
      kit.text(name.slice(0, Math.max(0, n)), VIEW_W / 2, 320, 56, '#ffffff', { align: 'center', weight: 'bold' });
      ctx.fillStyle = th.accent;
      const lw = 360 * ease((t - 3.4) / 0.8);
      ctx.fillRect(VIEW_W / 2 - lw / 2, 358, lw, 3);
      ctx.globalAlpha = 1;
    }
    bars(t, c.dur);
    skipHint(c);
  }

  function boss(c) {
    const t = c.t;
    const D = BOSSES[c.data.boss];
    const v = visible();
    NS.backdrop.setChapter(c.data.chapter);
    NS.backdrop.draw(0.55);
    ctx.fillStyle = 'rgba(80,0,10,' + (0.2 + 0.1 * Math.sin(t * 8)) + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    /* warning stripes */
    for (const y of [120, VIEW_H - 120]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x0, y - 18, v.w, 36);
      ctx.clip();
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(v.x0, y - 18, v.w, 36);
      ctx.fillStyle = '#1a1000';
      const off = (t * 120) % 60;
      for (let x = v.x0 - 60 + off; x < v.x1 + 60; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, y + 18); ctx.lineTo(x + 30, y + 18); ctx.lineTo(x + 60, y - 18); ctx.lineTo(x + 30, y - 18);
        ctx.fill();
      }
      ctx.restore();
      kit.text('WARNING', VIEW_W / 2 + (y < 300 ? -1 : 1) * ((t * 200) % 400 - 200), y, 26, '#ff2a2a', { align: 'center', weight: 'bold', shadow: false });
    }
    const k = ease(t / 2.2);
    const shake = t > 1.6 && t < 2.6 ? (Math.random() - 0.5) * 14 : 0;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6 * k;
    K.blit(ctx, K.glow(D.pal[3]), VIEW_W / 2, VIEW_H / 2, 8 * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const spr = NS.enemyArt.boss(c.data.boss);
    ctx.globalAlpha = k;
    K.blitRot(ctx, spr, VIEW_W / 2 + shake, VIEW_H / 2 - 10 + shake, t * 0.2, 0.4 + k * 1.1);
    ctx.globalAlpha = 1;
    if (t > 2.2) {
      const s = 1 + Math.max(0, 0.4 - (t - 2.2)) * 2;
      ctx.globalAlpha = fadeIn(t, 2.2, 2.4);
      kit.text(D.name.toUpperCase(), VIEW_W / 2, VIEW_H / 2 + 160, 52 * s, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(D.title, VIEW_W / 2, VIEW_H / 2 + 205, 18, D.pal[3], { align: 'center' });
      ctx.globalAlpha = 1;
    }
    bars(t, c.dur);
    skipHint(c);
  }

  function ending(c) {
    const t = c.t;
    const v = visible();
    if (t < 9) {
      NS.backdrop.setChapter(4);
      NS.backdrop.draw(0.2);
      if (t < 5) {
        const sh = (Math.random() - 0.5) * 12 * (1 - t / 5);
        ctx.globalAlpha = 1 - ease((t - 3) / 2);
        K.blitRot(ctx, NS.enemyArt.boss('maw'), VIEW_W / 2 + sh, VIEW_H / 2 + sh, 0, 1.6 - t * 0.05);
        ctx.globalAlpha = 1;
        if (Math.random() < 0.3) NS.fx.explode(VIEW_W / 2 + (Math.random() - 0.5) * 300, VIEW_H / 2 + (Math.random() - 0.5) * 240, 30 + Math.random() * 40, NS.fx.FIRE);
      } else {
        for (let i = 0; i < 9; ++i) {
          const x = (i * 157 + t * 6 * (1 + i % 3)) % VIEW_W, y = 120 + (i * 97) % 480;
          K.blitRot(ctx, NS.rockArt.rock(['normal', 'iron', 'crystal'][i % 3], 3 - (i % 2), i % 6), x, y, t * 0.1 + i, 1);
        }
      }
      NS.fxRender.draw(v);
    } else {
      NS.backdrop.setChapter(-1);
      NS.backdrop.draw(0);
      const k = ease((t - 9) / 5);
      K.blitRot(ctx, station(), 930, 500, t * 0.08, 1.1);
      K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), 200 + k * 680, 600 - k * 90, -0.3, 1.6 - k * 0.9);
      if (t > 12) {
        ctx.globalCompositeOperation = 'lighter';
        const cols = ['#ff5ad0', '#ffd25a', '#5ad8ff', '#6dff9a'];
        for (let f = 0; f < 4; ++f) {
          const p = ((t - 12) * 0.5 + f * 0.27) % 1;
          const cx = 200 + f * 260, cy = 160 + (f % 2) * 60;
          ctx.globalAlpha = 1 - p;
          for (let i = 0; i < 16; ++i) K.blit(ctx, K.glow(cols[f]), cx + Math.cos(i * TAU / 16) * p * 120, cy + Math.sin(i * TAU / 16) * p * 120 + p * p * 40, 0.2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (t > 13.5) {
        ctx.globalAlpha = fadeIn(t, 13.5, 14.5);
        kit.text('THE BELT IS QUIET', VIEW_W / 2, 250, 54, '#ffffff', { align: 'center', weight: 'bold' });
        kit.text('Thank you for flying, pilot. The seasons keep turning out here - come back soon.', VIEW_W / 2, 305, 18, UI.textDim, { align: 'center' });
        ctx.globalAlpha = 1;
      }
    }
    bars(t, c.dur);
    caption(t, 0.5, 4.5, 'The Shardmind unravels.', '#ff8aa0');
    caption(t, 5, 8.8, 'Rock by rock, the belt forgets its hunger.');
    caption(t, 9.2, 13, 'Haven Station. Home.', '#5ad8ff');
    skipHint(c);
  }

  function season(c) {
    const t = c.t;
    const sd = NS.seasons.SEASONS[c.data.season];
    NS.backdrop.setChapter(-1);
    NS.backdrop.draw(0.25);
    const k = ease(t / 0.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * k;
    K.blit(ctx, K.glow(sd.accent), VIEW_W / 2, 300, 10);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.propArt.token(c.data.season), VIEW_W / 2, 230, Math.sin(t * 2) * 0.2, 3 * k);
    ctx.globalAlpha = fadeIn(t, 0.6, 1.2);
    kit.text(sd.festival ? 'FESTIVAL EVENT' : 'NEW SEASON', VIEW_W / 2, 330, 18, sd.accent, { align: 'center', weight: 'bold' });
    kit.text(sd.name.toUpperCase(), VIEW_W / 2, 380, 58, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(sd.blurb, VIEW_W / 2, 430, 18, UI.textDim, { align: 'center' });
    kit.text('Collect ' + sd.tokenName.toLowerCase() + ' to climb the event track: stardust, a trail, a ship skin and more.', VIEW_W / 2, 462, 15, UI.text, { align: 'center' });
    ctx.globalAlpha = 1;
    bars(t, c.dur);
    skipHint(c);
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    switch (c.kind) {
      case 'intro': intro(c); break;
      case 'chapter': chapter(c); break;
      case 'boss': boss(c); break;
      case 'ending': ending(c); break;
      case 'season': season(c); break;
    }
  }

  Object.assign(NS.cineRender, {
    draw, station
  });
})();
