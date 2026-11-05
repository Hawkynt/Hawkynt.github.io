/* Draws a cinematic shot as a comic panel: the scene backdrop, a stage floor, the actors at
   cinema scale with their animation (walk in, idle breath, jump, scared shake, talk, cast glow,
   rise from the ground, radio call-in bubble), letterbox bars, the speech box with portrait,
   speaker tag and typed text, the continue hint and a Skip button. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { CAST, CINEMATICS } = NS.story;
  const K = NS.artKit;
  const kit = NS.kit;
  const R = NS.rng;
  const { ctx } = NS.view;

  const GROUND = 470;
  const BOSS_IDS = { baron: 1, mole: 1, yeti: 1, crab: 1, mecha: 1 };

  function actorSprite(id, dir, f) {
    if (BOSS_IDS[id]) return NS.bossArt.sprite(id, f % 2);
    const skin = id === 'pip' ? G.save.equip.skin : id === 'nova' ? 'nova' : 'fuse';
    return NS.actorArt.bomber(skin, dir, f);
  }

  function drawActor(a, t) {
    const boss = !!BOSS_IDS[a.id];
    const scale = (a.s || 1) * (boss ? 1.75 : 2.5);
    let x = a.x;
    if (a.to !== undefined) x = R.lerp(a.x, a.to, R.ease(t / 1.6));
    let y = GROUND;
    let f = 0, sx = 1, sy = 1, rot = 0;
    const walking = a.to !== undefined && t < 1.6;
    const dir = a.face === -1 ? 2 : 3;
    switch (a.anim) {
      case 'walk': f = walking ? Math.floor(t * 7) % 4 : 0; break;
      case 'jump': y -= Math.abs(Math.sin(t * 5)) * 40; sy = 1 + Math.sin(t * 10) * 0.04; break;
      case 'scared': x += Math.sin(t * 40) * 3; sy = 0.96; break;
      case 'talk': sy = 1 + Math.sin(t * 9) * 0.03; break;
      case 'cast': rot = Math.sin(t * 2) * 0.04; break;
      case 'rise': y += Math.max(0, 1 - t / 0.8) * 200; break;
      default: sy = 1 + Math.sin(t * 2.5) * 0.02;
    }
    if (a.anim === 'radio') {
      const bx = x, by = 150;
      kit.panel(bx - 72, by - 72, 144, 144, { radius: 72, accent: '#7cf08a' });
      ctx.save();
      ctx.beginPath(); ctx.arc(bx, by, 64, 0, Math.PI * 2); ctx.clip();
      const s = actorSprite(a.id, 0, Math.floor(t * 6) % 2);
      ctx.drawImage(s, bx - 80, by - 60, 160, 190);
      ctx.restore();
      ctx.strokeStyle = 'rgba(124,240,138,0.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; ++i) { ctx.beginPath(); ctx.arc(bx + 70, by - 70, 10 + i * 10 + (t * 30) % 10, -1.2, 0.2); ctx.stroke(); }
      return;
    }
    if (a.anim === 'cast') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + Math.sin(t * 5) * 0.15;
      K.blit(ctx, K.glow('#a050ff'), x, y - 120, 3.2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const s = actorSprite(a.id, a.face === -1 && !boss ? 2 : boss ? 0 : (walking ? dir : 0), boss ? Math.floor(t * 3) : f);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (boss && a.face !== -1) ctx.scale(-1, 1);
    ctx.drawImage(NS.itemArt.shadow(80), -s.width * scale * 0.3, -10, s.width * scale * 0.6, 26);
    const w = s.width * scale * sx, h = s.height * scale * sy;
    ctx.drawImage(s, -w / 2, boss ? -h * 0.95 : -h * 0.92, w, h);
    ctx.restore();
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const shots = CINEMATICS[c.id];
    const s = shots[c.shot];
    if (!s) return;
    const v = NS.view.visible();
    NS.backdrop.draw(s.scene, s.fx === 'dark' ? 0.45 : 0.1);
    /* stage floor */
    const fg = ctx.createLinearGradient(0, GROUND - 10, 0, GROUND + 80);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = fg; ctx.fillRect(v.x0, GROUND - 10, v.w, 90);
    for (let i = 0; i < s.actors.length; ++i) drawActor(s.actors[i], c.t);
    NS.fxRender.draw();
    /* letterbox */
    ctx.fillStyle = '#05030a';
    ctx.fillRect(v.x0, v.y0, v.w, 52 - v.y0);
    ctx.fillRect(v.x0, 676, v.w, v.y1 - 676);
    /* speech box */
    const speaker = CAST[s.speaker] || CAST.narrator;
    const bx = 150, by = 498, bw = 980, bh = 162;
    const slide = R.easeOutBack(Math.min(1, c.t * 3));
    ctx.save();
    ctx.translate(0, (1 - slide) * 60);
    ctx.globalAlpha = Math.min(1, c.t * 4);
    kit.panel(bx, by, bw, bh, { accent: speaker.color, radius: 16, top: 'rgba(30,18,30,0.94)', bottom: 'rgba(14,8,16,0.96)' });
    let tx = bx + 28;
    if (s.speaker !== 'narrator') {
      ctx.save();
      ctx.beginPath(); ctx.arc(bx + 76, by + 80, 54, 0, Math.PI * 2);
      ctx.fillStyle = K.rgba(speaker.color, 0.22); ctx.fill();
      ctx.clip();
      const ps = actorSprite(s.speaker, 0, 0);
      if (BOSS_IDS[s.speaker]) ctx.drawImage(ps, bx + 76 - 80, by + 40 - 30, 160, 160);
      else ctx.drawImage(ps, bx + 76 - 64, by + 80 - 50, 128, 152);
      ctx.restore();
      ctx.strokeStyle = speaker.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx + 76, by + 80, 54, 0, Math.PI * 2); ctx.stroke();
      tx = bx + 150;
      kit.panel(tx - 6, by - 18, kit.measure(speaker.name, 18, 'bold') + 30, 34, { accent: speaker.color, radius: 10, top: K.rgba(K.shade(speaker.color, -0.5), 0.95), bottom: K.rgba(K.shade(speaker.color, -0.7), 0.95) });
      kit.text(speaker.name, tx + 9, by - 1, 18, '#ffffff', { weight: 'bold' });
    }
    kit.wrap(s.text, tx, by + 30, bx + bw - tx - 30, s.speaker === 'narrator' ? 23 : 22, 32, '#fff6e8', { chars: Math.floor(c.chars), weight: s.speaker === 'narrator' ? 'italic' : 'normal' });
    if (c.chars >= s.text.length && Math.sin(G.time * 5) > -0.3) kit.text('click / any key  >', bx + bw - 24, by + bh - 20, 13, UI.textDim, { align: 'right' });
    ctx.restore();
    /* progress pips and skip */
    for (let i = 0; i < shots.length; ++i) {
      ctx.fillStyle = i === c.shot ? UI.gold : i < c.shot ? 'rgba(255,216,74,0.45)' : 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(640 - (shots.length - 1) * 9 + i * 18, 26, 5, 0, Math.PI * 2); ctx.fill();
    }
    kit.button('skip', 'Skip  >>', 1110, 8, 150, 36, { action: () => NS.cine.skip(), px: 15, accent: '#9a8aa0' });
  }

  Object.assign(NS.cineRender, {
    draw, GROUND
  });
})();
