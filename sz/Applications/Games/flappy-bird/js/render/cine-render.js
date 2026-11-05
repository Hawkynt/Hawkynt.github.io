;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Draws the cinematic in G.cine: the backdrop (a biome, the Sky Tree at dawn or in the
     storm), the actors gliding along their paths, the effects (storm rain, light rays,
     sunrise, darkness), the letterbox bars, the caption band or the speech panel with a
     portrait and the typed line, the chapter title card and the skip hint. Reads G. */

  const { CANVAS_W, CANVAS_H, CAST, FEATHERS } = NS.C;
  const { ctx, ui, particles } = NS.services;
  const G = NS.state;
  const View = NS.view;
  const Story = SZ.FlappyStoryArt;

  function ease(u) {
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  function hasFx(shot, name) {
    return !!shot.fx && shot.fx.indexOf(name) >= 0;
  }

  function drawBackdrop(shot, u, v) {
    if (shot.bg === 'skytree' || shot.bg === 'storm') {
      Story.drawSky(ctx, shot.bg === 'storm', v);
      return;
    }
    const sc = View.sceneFor(shot.bg);
    const pan = shot.pan ? lerp(shot.pan[0], shot.pan[1], u) : 0;
    sc.drawSky(ctx, v);
    sc.drawBackdrop(ctx, pan, G.globalTime, v);
    sc.drawGround(ctx, pan, v);
  }

  function drawActor(a, u, t) {
    const e = ease(u);
    const x = lerp(a.x[0], a.x[1], e);
    let y = lerp(a.y[0], a.y[1], e);
    if (a.bob)
      y += Math.sin(t * 3 + a.x[0]) * a.bob;
    const s = Array.isArray(a.s) ? lerp(a.s[0], a.s[1], e) : (a.s || 1);
    const alpha = a.a ? lerp(a.a[0], a.a[1], e) : 1;
    const rot = a.rot ? lerp(a.rot[0], a.rot[1], e) : 0;
    const id = a.id;
    if (id === 'tree') {
      Story.drawTree(ctx, x, y, s, { alpha: alpha, bloom: hasFx(G.cine.shots[G.cine.index], 'bloom') });
    } else if (id === 'feathers') {
      for (let i = 0; i < 6; ++i) {
        let ang = i / 6 * Math.PI * 2 + t * 0.4;
        let r = 210;
        if (a.scatter) {
          r = 210 + e * 900;
          ang += e * 2;
        } else if (a.gather) {
          r = 1100 - e * 890;
        }
        Story.drawFeather(ctx, FEATHERS[i].color, x + Math.cos(ang) * r * 1.4, y + Math.sin(ang) * r * 0.55, s, Math.sin(t * 2 + i) * 0.3);
      }
    } else if (id.indexOf('feather:') === 0) {
      const f = FEATHERS[Number(id.slice(8))];
      if (hasFx(G.cine.shots[G.cine.index], 'rays')) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.6);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = f.color;
        for (let k = 0; k < 10; ++k) {
          ctx.rotate(Math.PI / 5);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(420, -40);
          ctx.lineTo(420, 40);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      Story.drawFeather(ctx, f.color, x, y + Math.sin(t * 2) * 8, s * 1.4, Math.sin(t * 1.5) * 0.2);
    } else if (id.indexOf('boss:') === 0) {
      SZ.FlappyBossArt.drawBoss(ctx, { kind: id.slice(5), x: x, y: y, scale: s, t: t, alpha: alpha, rot: rot });
    } else {
      const flip = a.x[1] < a.x[0] || id === 'corvus' || (id === 'snowy' && a.x[0] > 640);
      SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: y, birdId: id, frame: t * (a.x[0] !== a.x[1] ? 14 : 7), scale: s, angle: rot, alpha: alpha, flip: flip });
      if (id === 'sunny') {
        const hat = NS.progress.currentHat();
        if (hat !== 'none')
          SZ.FlappyCosmeticArt.drawHat(ctx, { x: x, y: y, hatId: hat, scale: s, angle: rot, flip: flip });
      }
    }
  }

  function drawStorm(t, v) {
    ctx.fillStyle = 'rgba(20,10,40,0.35)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.strokeStyle = 'rgba(180,170,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 80; ++i) {
      const x = ((i * 97.3 + t * 900) % (v.x1 - v.x0 + 200)) + v.x0 - 100;
      const y = ((i * 211.7 + t * 1300) % (v.y1 - v.y0 + 100)) + v.y0 - 50;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 22);
    }
    ctx.stroke();
  }

  function drawSpeech(shot) {
    const say = shot.say;
    const who = CAST[say.who] || { name: say.who, color: '#ffffff' };
    const text = say.text.slice(0, G.cine.typed);
    const x = 120, y = CANVAS_H - 196, w = CANVAS_W - 240, h = 136;
    ui.drawPanel(x, y, w, h, { accent: who.color, glow: true });
    // portrait in a ring
    const px = x + 74, py = y + h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(px, py, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = who.color;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 50, 0, Math.PI * 2);
    ctx.clip();
    if (who.boss)
      SZ.FlappyBossArt.drawBoss(ctx, { kind: who.boss, x: px + 10, y: py + 8, scale: 0.42, t: G.globalTime });
    else
      SZ.FlappyBirdArt.drawBird(ctx, { x: px, y: py + 4, birdId: who.bird, frame: 1, scale: 2.1, flip: who.bird === 'corvus' });
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(who.name, x + 146, y + 30, w - 180, 22, { weight: 'bold', color: who.color });
    ui.drawTextBlock(text, x + 146, y + 52, w - 180, 74, 22, { color: ui.UI.text });
    if (G.cine.typed >= say.text.length && Math.floor(G.globalTime * 3) % 2 === 0) {
      ctx.fillStyle = who.color;
      ctx.beginPath();
      ctx.moveTo(x + w - 30, y + h - 26);
      ctx.lineTo(x + w - 18, y + h - 26);
      ctx.lineTo(x + w - 24, y + h - 18);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCaption(shot, u) {
    const a = Math.min(1, u * 5, (1 - u) * 6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    const g = ctx.createLinearGradient(0, CANVAS_H - 200, 0, CANVAS_H - 46);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(-400, CANVAS_H - 200, CANVAS_W + 800, 154);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.drawTextBlock(shot.caption, 180, CANVAS_H - 150, CANVAS_W - 360, 70, 26, { color: '#ffffff', align: 'center', valign: 'middle', weight: 'bold' });
    ctx.restore();
  }

  function drawTitleCard(shot, u) {
    const inU = Math.min(1, u * 4);
    const e = 1 - Math.pow(1 - inU, 3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - u) * 5, e);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(shot.title, CANVAS_W / 2, 210 - (1 - e) * 40, 900, 30, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.7)' });
    ui.drawHeadline(shot.subtitle, CANVAS_W / 2, 270, 1000, 64, '#ffd23f', '#ff8a1e');
    ctx.restore();
  }

  function draw() {
    const c = G.cine;
    if (!c)
      return;
    const shot = c.shots[c.index];
    const u = Math.min(1, c.t / shot.t);
    const t = G.globalTime;
    const v = View.visibleRect();
    NS.services.screenShake.apply(ctx);
    drawBackdrop(shot, u, v);
    if (hasFx(shot, 'sunrise')) {
      ctx.fillStyle = 'rgba(255,190,120,' + (0.25 * (1 - u)).toFixed(3) + ')';
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    for (const a of shot.actors || [])
      drawActor(a, u, t);
    particles.draw(ctx);
    if (hasFx(shot, 'storm'))
      drawStorm(t, v);
    if (hasFx(shot, 'dark')) {
      ctx.fillStyle = 'rgba(16,10,36,0.35)';
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    NS.services.screenShake.restore(ctx);

    // letterbox bars
    ctx.fillStyle = '#000000';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 46 - v.y0);
    ctx.fillRect(v.x0, CANVAS_H - 46, v.x1 - v.x0, v.y1 - CANVAS_H + 46);

    if (shot.title)
      drawTitleCard(shot, u);
    if (shot.say)
      drawSpeech(shot);
    else if (shot.caption)
      drawCaption(shot, u);

    // progress pips and the skip hint
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ui.fitText((G.touchUsed ? 'Tap' : 'Any key') + ' to skip', CANVAS_W - 24, 23, 300, 15, { color: 'rgba(255,255,255,0.65)' });
    for (let i = 0; i < c.shots.length; ++i) {
      ctx.fillStyle = i < c.index ? '#ffd23f' : i === c.index ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(24 + i * 22, 20, 16, 5);
    }
  }

  Object.assign(NS.cineDraw, { draw });
})();
