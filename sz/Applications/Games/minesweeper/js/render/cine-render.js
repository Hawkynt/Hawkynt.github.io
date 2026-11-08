/* Cinematics on screen: letterbox bars, the realm behind every shot, title cards that slide and
   glow in, dialogue with a portrait and a typed line, a guardian rising on light rays with its
   name, a star returning on a burst of rays, scrolling credits and the 3-2-1-GO count. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { VIEW_W, VIEW_H, TAU, UI } = C;
  const { CAST } = NS.storyData;
  const { WORLDS, BOSSES } = NS.worldData;
  const { ctx } = NS.view;

  function bars(k) {
    const v = NS.view.visible();
    const h = 70 * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(v.x0, v.y0, v.w, h + (0 - v.y0));
    ctx.fillRect(v.x0, VIEW_H - h, v.w, v.y1 - VIEW_H + h);
  }

  function rays(cx, cy, r, color, t, a) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.3);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (let i = 0; i < 14; ++i) {
      ctx.rotate(TAU / 14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, -r * 0.09);
      ctx.lineTo(r, r * 0.09);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function dim(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,14,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function hint() {
    kit.text('click: next  -  Esc: skip', VIEW_W - 24, VIEW_H - 30, 12, 'rgba(220,230,255,0.55)', { align: 'right' });
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const s = c.shots[c.i];
    const t = c.t;
    const appear = Math.min(1, t * 2.5);
    if (s.kind === 'count') {
      dim(0.35);
      const n = 3 - Math.floor(t / 0.5);
      const f = (t % 0.5) / 0.5;
      const label = n > 0 ? String(n) : 'GO!';
      kit.text(label, VIEW_W / 2, VIEW_H / 2, 120 * (1.3 - f * 0.3), n > 0 ? '#ffffff' : UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.7)' });
      return;
    }
    const w = s.world != null ? s.world : (G.run ? G.run.world : 0);
    if (s.kind !== 'talk') NS.backdrop.draw(w);
    dim(s.kind === 'talk' ? 0.45 : 0.25);
    if (s.kind === 'card') {
      const k = NS.rng.ease.back(Math.min(1, t * 1.6));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 * appear;
      K.blit(ctx, K.glow(WORLDS[w].glow), VIEW_W / 2, VIEW_H / 2 - 20, 6);
      ctx.restore();
      kit.text(s.title.toUpperCase(), VIEW_W / 2 + (1 - k) * 200, VIEW_H / 2 - 20, 56, '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(0,0,30,0.8)' });
      ctx.globalAlpha = appear;
      kit.fitText(s.sub, VIEW_W / 2, VIEW_H / 2 + 34, 1000, 20, { align: 'center', color: WORLDS[w].glow, shadow: true });
      ctx.globalAlpha = 1;
    } else if (s.kind === 'boss') {
      const b = BOSSES[s.boss];
      rays(VIEW_W / 2, 420, 700, K.rgba(b.accent, 0.5), t, 0.5 * appear);
      const rise = NS.rng.ease.out(Math.min(1, t / 1.4));
      NS.bossArt.drawBoss(s.boss, VIEW_W / 2, 640 + (1 - rise) * 320, null, 1.3);
      kit.text(b.name.toUpperCase(), VIEW_W / 2, 120, 58 * (0.8 + 0.2 * appear), b.accent, { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.85)' });
      ctx.globalAlpha = appear;
      kit.text(b.title, VIEW_W / 2, 168, 22, '#ffffff', { align: 'center', shadow: true });
      ctx.globalAlpha = 1;
      if (t < 1.4) G.shake = Math.max(G.shake, 4);
    } else if (s.kind === 'victory') {
      rays(VIEW_W / 2, VIEW_H / 2, 800, 'rgba(255,240,180,0.5)', t, 0.6 * appear);
      const k = NS.rng.ease.back(Math.min(1, t * 1.4));
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2 + 30);
      ctx.scale(k * 1.4, k * 1.4);
      ctx.rotate(t * 0.6);
      ctx.fillStyle = '#ffe8a0';
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(34, 0); ctx.lineTo(0, 44); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(-34, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      kit.text(s.title.toUpperCase(), VIEW_W / 2, 150, 52, UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(60,30,0,0.9)' });
      ctx.globalAlpha = appear;
      kit.text(s.sub, VIEW_W / 2, 200, 20, '#ffffff', { align: 'center', shadow: true });
      ctx.globalAlpha = 1;
      if (Math.random() < 0.5) NS.fx.spawn(Math.random() * VIEW_W, -10, (Math.random() - 0.5) * 60, 80 + Math.random() * 120, 3, 6,
        ['#ffd25a', '#ff7ad8', '#7affea', '#ffffff'][Math.floor(Math.random() * 4)], 'confetti', 40);
    } else if (s.kind === 'credits') {
      const lines = ['THE BLOOMFIELD EXPEDITION', '', 'Wren  -  the surveyor', 'Tock  -  who hears the mines tick', 'Elder Maple  -  keeper of the seeds', 'The Rustmonger  -  who only wanted visitors',
        '', 'The Burrowbeast, Rimewing, the Cinder Golem, the Archivist and the Engine', '', 'A »SynthelicZ« desktop game', '', s.title, s.sub];
      const y0 = VIEW_H - t * 70;
      for (let i = 0; i < lines.length; ++i)
        kit.fitText(lines[i], VIEW_W / 2, y0 + i * 40, 1100, i === 0 ? 34 : 20, { align: 'center', weight: i === 0 ? 'bold' : 'normal', color: i === 0 ? UI.gold : '#ffffff' });
    } else if (s.kind === 'talk') {
      const who = s.who === 'boss' ? null : CAST[s.who];
      const name = who ? who.name : BOSSES[s.boss].name;
      const color = who ? who.accent : BOSSES[s.boss].accent;
      const x = 160, y = VIEW_H - 230, wdt = VIEW_W - 320;
      if (who) ctx.drawImage(NS.bossArt.portrait(s.who), x - 10, y - 150, 180, 180);
      else NS.bossArt.drawBoss(s.boss, x + 80, y + 30, null, 0.6);
      kit.panel(x + 160, y - 10, wdt - 160, 150, { accent: color, glow: true });
      kit.text(name, x + 184, y + 20, 20, color, { weight: 'bold' });
      kit.wrap(s.text.slice(0, Math.floor(c.typed)), x + 184, y + 58, wdt - 210, 19, '#ffffff');
    }
    bars(Math.min(1, t * 3));
    hint();
  }

  Object.assign(NS.cineRender, { draw, bars, rays });
})();
