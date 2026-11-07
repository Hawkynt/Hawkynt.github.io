/* Drawing cinematics over the living bakery: widescreen bars, title cards, comic dialogue
   panels with typed text and procedural portraits of the cast (Grandma Rosa, Pip, Baron
   Crumbleton, the Sugar Oracle), the treat transformation (the old treat trembles in light,
   bursts, the new one pops in on rotating rays), the ascension into the Sugar Sanctum and the
   Bake-Off countdown. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, UI, TAU, LAYOUT } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { CAST, STAGES } = NS.treatData;
  const { ctx } = NS.view;

  function portrait(id) {
    const c = CAST[id];
    return K.sprite('portrait:' + id, 132, 132, (g) => {
      g.translate(66, 66);
      const bg = g.createRadialGradient(0, -10, 10, 0, 0, 66);
      bg.addColorStop(0, K.shade(c.coat, 0.5));
      bg.addColorStop(1, K.shade(c.coat, -0.5));
      K.circle(g, 0, 0, 64, bg);
      g.save();
      K.circle(g, 0, 0, 62);
      g.clip();
      /* body */
      g.beginPath();
      g.moveTo(-50, 70); g.quadraticCurveTo(-46, 20, 0, 18); g.quadraticCurveTo(46, 20, 50, 70); g.closePath();
      g.fillStyle = c.coat;
      g.fill();
      g.fillStyle = c.accent;
      g.fillRect(-6, 22, 12, 48);
      /* head */
      if (id === 'oracle') {
        g.beginPath();
        g.moveTo(-40, 30); g.quadraticCurveTo(-40, -50, 0, -52); g.quadraticCurveTo(40, -50, 40, 30); g.closePath();
        g.fillStyle = K.shade(c.coat, -0.2);
        g.fill();
        K.ellipse(g, 0, -6, 24, 28, '#1a0a2a');
        K.star(g, -9, -8, 6, 0.4, 4); g.fillStyle = c.accent; g.fill();
        K.star(g, 9, -8, 6, 0.4, 4); g.fill();
        g.restore();
        return;
      }
      K.circle(g, 0, -8, 28, c.skin);
      K.circle(g, -10, -10, 3.2, '#2a1a1a');
      K.circle(g, 10, -10, 3.2, '#2a1a1a');
      K.circle(g, -9, -11, 1, '#ffffff');
      K.circle(g, 11, -11, 1, '#ffffff');
      K.circle(g, -16, 0, 5, 'rgba(255,120,130,0.4)');
      K.circle(g, 16, 0, 5, 'rgba(255,120,130,0.4)');
      g.strokeStyle = '#6a2a2a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(0, 2, 8, 0.2, Math.PI - 0.2);
      g.stroke();
      if (id === 'rosa') {
        K.circle(g, 0, -40, 16, c.hair);
        K.circle(g, -24, -24, 10, c.hair);
        K.circle(g, 24, -24, 10, c.hair);
        g.beginPath(); g.arc(0, -16, 28, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 9; g.strokeStyle = c.hair; g.stroke();
        g.strokeStyle = '#8a6a5a';
        g.lineWidth = 2;
        K.circle(g, -10, -10, 7); g.stroke();
        K.circle(g, 10, -10, 7); g.stroke();
      } else if (id === 'pip') {
        g.fillStyle = c.hair;
        for (let i = 0; i < 6; ++i) { g.beginPath(); g.arc(-20 + i * 8, -30, 8, Math.PI, 0); g.fill(); }
        K.ellipse(g, 0, -50, 26, 14, '#ffffff');
        g.fillStyle = '#ffffff';
        g.fillRect(-18, -46, 36, 12);
        K.circle(g, 0, -8, 1.5, '#c8885a');
      } else if (id === 'baron') {
        g.fillStyle = '#1a1a1a';
        g.fillRect(-22, -70, 44, 36);
        g.fillRect(-32, -38, 64, 6);
        g.fillStyle = c.accent;
        g.fillRect(-22, -44, 44, 5);
        g.fillStyle = c.hair;
        g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-18, -6, -24, 4); g.quadraticCurveTo(-12, 0, 0, 2); g.quadraticCurveTo(12, 0, 24, 4); g.quadraticCurveTo(18, -6, 0, -2); g.fill();
        g.strokeStyle = c.accent;
        g.lineWidth = 2;
        K.circle(g, 10, -10, 7); g.stroke();
      }
      g.restore();
      g.lineWidth = 4;
      g.strokeStyle = c.accent;
      K.circle(g, 0, 0, 63);
      g.stroke();
    });
  }

  function bars(f) {
    const v = NS.view.visible();
    const h = 70 * f;
    ctx.fillStyle = '#000000';
    ctx.fillRect(v.x0, v.y0, v.w, (0 - v.y0) + h);
    ctx.fillRect(v.x0, VIEW_H - h, v.w, v.y1 - VIEW_H + h);
  }

  function dim(a) {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(10,4,2,' + a + ')';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  /* soft god-rays: painted once per colour with a radial falloff, then only rotated */
  function raySprite(color) {
    return K.sprite('rays:' + color, 512, 512, (g) => {
      g.translate(256, 256);
      for (let i = 0; i < 16; ++i) {
        g.rotate(TAU / 16);
        const w = i % 2 ? 0.07 : 0.12;
        const gr = g.createLinearGradient(0, 0, 256, 0);
        gr.addColorStop(0, K.rgba(color, 0.9));
        gr.addColorStop(0.5, K.rgba(color, 0.35));
        gr.addColorStop(1, K.rgba(color, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(256, -256 * w);
        g.lineTo(256, 256 * w);
        g.closePath();
        g.fill();
      }
      const core = g.createRadialGradient(0, 0, 0, 0, 0, 120);
      core.addColorStop(0, K.rgba(color, 0.6));
      core.addColorStop(1, K.rgba(color, 0));
      g.fillStyle = core;
      g.fillRect(-120, -120, 240, 240);
    });
  }

  function rays(x, y, r, color, t, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(t * 0.35);
    const s = r / 256;
    ctx.drawImage(raySprite(color), -256 * s, -256 * s, 512 * s, 512 * s);
    ctx.restore();
  }

  function talk(s, t) {
    const c = CAST[s.who];
    const x = 150, y = VIEW_H - 230, w = VIEW_W - 300, h = 150;
    const slide = Math.min(1, t * 4);
    ctx.save();
    ctx.translate(0, (1 - slide) * 60);
    ctx.globalAlpha = slide;
    kit.panel(x, y, w, h, { radius: 18, accent: c.accent === '#ffffff' ? UI.gold : c.accent, glow: true, top: 'rgba(48,28,18,0.97)', bottom: 'rgba(24,12,8,0.98)' });
    ctx.drawImage(portrait(s.who), x + 12, y + 9);
    kit.text(c.name, x + 160, y + 30, 20, UI.gold, { weight: 'bold' });
    const n = Math.min(s.text.length, Math.floor(t * 55));
    kit.wrap(s.text.slice(0, n), x + 160, y + 64, w - 190, 20, '#ffffff');
    ctx.restore();
  }

  function hint() {
    kit.text('click to continue  -  Esc to skip', VIEW_W - 24, VIEW_H - 30, 13, 'rgba(255,255,255,0.55)', { align: 'right' });
  }

  function draw() {
    const c = G.cine;
    if (!c) return;
    const s = c.shots[c.i];
    const t = c.t;
    if (s.kind === 'card') {
      dim(0.55);
      bars(1);
      const k = Math.min(1, t * 3);
      kit.text(s.title, VIEW_W / 2, VIEW_H / 2 - 20, 64 * (0.8 + 0.2 * k), UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(80,30,0,0.9)' });
      ctx.globalAlpha = Math.min(1, Math.max(0, t * 2 - 0.4));
      kit.text(s.sub, VIEW_W / 2, VIEW_H / 2 + 36, 24, '#ffffff', { align: 'center', shadow: true });
      ctx.globalAlpha = 1;
    } else if (s.kind === 'talk') {
      dim(0.35);
      bars(1);
      talk(s, t);
    } else if (s.kind === 'transform') {
      dim(0.78);
      const L = LAYOUT;
      const cx = VIEW_W / 2, cy = VIEW_H / 2 + 10;
      if (t < 1.5) {
        rays(cx, cy, 420, '#fff0c0', t, t / 1.5 * 0.35);
        const shake = t * 4;
        NS.hud.drawTreat({ stage: s.from, x: cx + (Math.random() - 0.5) * shake, y: cy + (Math.random() - 0.5) * shake, scale: 1.1 + t * 0.15, white: t / 1.5, noHover: true });
        bars(1);
        kit.text('Something is happening to the ' + STAGES[s.from].name.toLowerCase() + '...', cx, 110, 22, '#ffffff', { align: 'center', shadow: true });
      } else {
        const k = Math.min(1, (t - 1.5) * 2.5);
        const pop = k < 1 ? 0.3 + k * 1.1 : 1.4 - Math.min(0.2, (t - 1.9) * 0.6);
        rays(cx, cy, 460, NS.treatArt.glowColor(s.to), t, 0.45);
        NS.hud.drawTreat({ stage: s.to, x: cx, y: cy, scale: pop * 0.9, white: Math.max(0, 1 - (t - 1.5) * 1.5), noHover: true });
        bars(1);
        kit.text(STAGES[s.to].name.toUpperCase(), cx, 110, 46 * (0.8 + 0.2 * k), UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(80,30,0,0.9)' });
        kit.text('+' + Math.round(STAGES[s.to].bonus * 100) + '% production in this era', cx, 150, 18, '#ffffff', { align: 'center', shadow: true });
      }
      if (L) hint();
    } else if (s.kind === 'ascend') {
      const v = NS.view.visible();
      const gr = ctx.createLinearGradient(0, v.y0, 0, v.y1);
      gr.addColorStop(0, 'rgba(24,6,48,' + Math.min(0.96, t * 1.5) + ')');
      gr.addColorStop(1, 'rgba(120,60,170,' + Math.min(0.9, t) + ')');
      ctx.fillStyle = gr;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      rays(VIEW_W / 2, VIEW_H / 2 + 40, 640, '#e8b8ff', t, 0.55);
      bars(Math.min(1, t * 2));
      for (let i = 0; i < 26; ++i) {
        const x = (i * 97 + 40) % VIEW_W, y = ((t * (120 + i * 7) + i * 53) % (VIEW_H + 60)) - 30;
        K.blit(ctx, crystal(), x, y, 0.6 + (i % 3) * 0.2);
      }
      const st = s.label ? G.run.stage : 0;
      NS.hud.drawTreat({ stage: st, mask: s.label && G.stMain ? G.stMain.decoMask : 0, x: VIEW_W / 2, y: VIEW_H / 2 + 60 - t * 12, scale: 0.8, white: Math.max(0, 0.8 - t * 0.4), noHover: true });
      kit.text(s.label || 'ASCENSION', VIEW_W / 2, 140, 60, '#ffffff', { align: 'center', weight: 'bold', shadow: 'rgba(80,0,120,0.9)' });
      if (s.label) kit.text(NS.trials.TRIALS.filter(x => G.profile.trials[x.id]).length + ' of ' + NS.trials.TRIALS.length + ' Sanctum Trials completed  -  +' + Math.round((G.stMain ? G.stMain.trialF - 1 : 0) * 100) + '% production', VIEW_W / 2, 200, 22, '#ffe8ff', { align: 'center', shadow: true });
      else kit.text('+' + s.gained + ' sugar crystal' + (s.gained > 1 ? 's' : '') + '  -  ' + G.profile.crystals + ' in total (+' + G.profile.crystals + '% production)', VIEW_W / 2, 200, 22, '#ffe8ff', { align: 'center', shadow: true });
      hint();
    } else if (s.kind === 'countdown') {
      dim(0.5);
      const n = 3 - Math.floor(t);
      const f = t % 1;
      kit.text(s.title.toUpperCase(), VIEW_W / 2, 170, 40, UI.gold, { align: 'center', weight: 'bold', shadow: true });
      kit.text(s.sub, VIEW_W / 2, 214, 20, '#ffffff', { align: 'center', shadow: true });
      kit.text(n > 0 ? String(n) : 'BAKE!', VIEW_W / 2, VIEW_H / 2 + 40, 150 * (1.3 - f * 0.3), n > 0 ? '#ffffff' : UI.gold, { align: 'center', weight: 'bold', shadow: 'rgba(80,30,0,0.9)' });
    }
    if (s.kind === 'card' || s.kind === 'talk') hint();
  }

  function crystal() {
    return K.sprite('cine-crystal', 40, 40, (g) => {
      g.translate(20, 20);
      g.beginPath(); g.moveTo(0, -16); g.lineTo(11, -3); g.lineTo(0, 16); g.lineTo(-11, -3); g.closePath();
      g.fillStyle = '#e59cff';
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.moveTo(0, -16); g.lineTo(-11, -3); g.lineTo(0, -3); g.closePath(); g.fill();
    });
  }

  Object.assign(NS.cineRender, { portrait, bars, dim, rays, draw, crystal });
})();
