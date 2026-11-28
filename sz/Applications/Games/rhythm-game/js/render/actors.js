/* The people on stage, drawn from shapes with a neon rim light: the six performers (Lyra at her
   decks, Juno at the drums, Kip with a keytar, Sable with a cello, Bolt the robot at the mic, Nova with
   a guitar) beside the highway, bobbing on the beat, leaning into hits, slumping on a miss and cheering
   on a clear; the five bosses on the other side (Gristle's speaker chest thumping, Vesper's glass
   wings, Anvil-9's furnace and hammer, Madame Undertow's swaying tentacle hair, the faceless Hush with
   its baton), glowing when they strike, red when they rage, fading when they find the beat; and the
   cast's portraits for the cinematics, painted once. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const M = NS.metaData;
  const { TAU } = C;
  const { ctx } = NS.view;

  /* pose: bob (0..1 beat), lean (-1..1), cheer (0..1), slump (0..1) */
  function performer(g, id, x, y, sc, pose) {
    const pf = M.PERFORMERS.find(p => p.id === id) || M.PERFORMERS[0];
    const [main, acc, dark] = pf.colors;
    pose = pose || {};
    const bob = Math.sin((pose.bob || 0) * TAU) * 4;
    const cheer = pose.cheer || 0, slump = pose.slump || 0, lean = pose.lean || 0;
    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    /* floor glow */
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; K.blit(g, K.glow(acc), 0, 0, 1.4); g.restore();
    K.ellipse(g, 0, 2, 60, 10, 'rgba(0,0,0,0.5)');
    g.translate(0, -Math.abs(bob) - slump * -8);
    g.rotate(lean * 0.08 - slump * 0.05);
    const robot = id === 'bolt';
    /* legs */
    g.fillStyle = K.shade(dark, 0.1);
    g.fillRect(-18, -70, 14, 70);
    g.fillRect(4, -70, 14, 70);
    g.fillStyle = '#0a0812';
    g.fillRect(-22, -6, 20, 8); g.fillRect(2, -6, 20, 8);
    /* torso */
    g.fillStyle = main;
    K.roundRect(g, -28, -150, 56, 86, 14); g.fill();
    g.fillStyle = K.shade(main, -0.3);
    g.fillRect(-28, -100, 56, 8);
    g.fillStyle = acc;
    g.fillRect(-4, -146, 8, 50);
    /* arms */
    const armUp = cheer > 0 ? -2.4 * cheer : -0.4 + Math.sin((pose.bob || 0) * TAU) * 0.25;
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 28, -140);
      g.rotate(side * (cheer > 0 ? armUp : 0.25) + (side > 0 && !cheer ? armUp : 0));
      g.fillStyle = robot ? '#8a94a8' : main;
      g.fillRect(-7, 0, 14, 58);
      g.fillStyle = robot ? '#c0c8d8' : pf.colors[0] === '#c0c8d8' ? '#c0c8d8' : '#c8865a';
      K.circle(g, 0, 62, 8, robot ? '#c0c8d8' : '#d89a6a');
      g.restore();
    }
    /* head */
    g.translate(0, -166 + slump * 6);
    if (robot) {
      g.fillStyle = '#b8c0d0'; K.roundRect(g, -22, -24, 44, 42, 10); g.fill();
      g.fillStyle = '#1a1a2a'; g.fillRect(-16, -12, 32, 12);
      g.fillStyle = acc; g.fillRect(-14, -9, 28 * (0.5 + 0.5 * Math.abs(Math.sin(G.time * 3))), 6);
      g.fillStyle = '#8a94a8'; g.fillRect(-2, -34, 4, 10); K.circle(g, 0, -36, 4, acc);
    } else {
      K.circle(g, 0, 0, 20, '#d89a6a');
      g.fillStyle = dark;
      g.beginPath(); g.arc(0, -4, 22, Math.PI, 0); g.fill();
      if (id === 'nova') { g.beginPath(); g.moveTo(-22, -4); g.quadraticCurveTo(-30, 30, -14, 36); g.lineTo(-16, 0); g.fill(); g.beginPath(); g.moveTo(22, -4); g.quadraticCurveTo(30, 30, 14, 36); g.lineTo(16, 0); g.fill(); }
      if (id === 'kip') { g.fillStyle = acc; g.beginPath(); g.moveTo(-20, -14); g.lineTo(0, -30); g.lineTo(20, -14); g.closePath(); g.fill(); }
      g.fillStyle = '#1a0a1a'; g.fillRect(-9, 0, 4, 4); g.fillRect(5, 0, 4, 4);
      if (cheer > 0.3) { g.fillStyle = '#5a1a1a'; g.beginPath(); g.arc(0, 10, 6, 0, Math.PI); g.fill(); }
      else { g.fillStyle = '#7a3a3a'; g.fillRect(-4, 11, 8, 2); }
      if (id === 'lyra' || id === 'juno') { g.strokeStyle = acc; g.lineWidth = 4; g.beginPath(); g.arc(0, -2, 24, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = acc; K.roundRect(g, -27, -6, 8, 16, 3); g.fill(); K.roundRect(g, 19, -6, 8, 16, 3); g.fill(); }
      if (id === 'sable') { g.fillStyle = '#e0e0ff'; g.fillRect(-12, -2, 9, 4); g.fillRect(3, -2, 9, 4); }
    }
    g.restore();
    /* props in front */
    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    prop(g, pf.prop, acc, pose);
    g.restore();
  }

  function prop(g, kind, acc, pose) {
    const pulse = G.pulse || 0;
    switch (kind) {
      case 'decks': {
        g.fillStyle = '#16121e'; K.roundRect(g, -78, -78, 156, 34, 6); g.fill();
        g.fillStyle = '#26202e'; g.fillRect(-82, -50, 164, 50);
        for (const s of [-1, 1]) {
          K.ellipse(g, s * 42, -62, 26, 8, '#0a0a10');
          g.save(); g.translate(s * 42, -62); g.scale(1, 0.3); g.rotate(G.time * 4 * s); g.fillStyle = acc; g.fillRect(-2, -20, 4, 20); g.restore();
        }
        g.fillStyle = K.rgba(acc, 0.4 + pulse * 0.6); g.fillRect(-14, -70, 28, 6);
        g.fillStyle = acc; g.fillRect(-82, -50, 164, 3);
        break;
      }
      case 'drums': {
        K.ellipse(g, -46, -40, 30, 9, '#c0c8d8'); g.fillStyle = '#b03a2a'; g.fillRect(-76, -40, 60, 30); K.ellipse(g, -46, -10, 30, 9, '#8a2a1a');
        K.ellipse(g, 50, -96, 26, 5, '#ffd25a');
        g.fillStyle = '#7a7a8a'; g.fillRect(48, -96, 4, 96);
        g.strokeStyle = '#e8d0a0'; g.lineWidth = 4;
        const k = Math.sin((pose.bob || 0) * TAU * 2) * 0.5;
        g.beginPath(); g.moveTo(-20, -120); g.lineTo(-46 + k * 8, -44); g.stroke();
        break;
      }
      case 'keytar': {
        g.save(); g.translate(0, -110); g.rotate(-0.35);
        g.fillStyle = acc; K.roundRect(g, -50, -12, 100, 24, 8); g.fill();
        g.fillStyle = '#ffffff'; for (let i = 0; i < 9; ++i) g.fillRect(-38 + i * 8, -6, 6, 12);
        g.fillStyle = '#1a1a1a'; for (let i = 0; i < 8; ++i) if (i % 7 !== 2) g.fillRect(-34 + i * 8, -6, 3, 7);
        g.restore();
        break;
      }
      case 'cello': {
        g.save(); g.translate(42, -70); g.rotate(0.1);
        g.fillStyle = '#7a3a1a'; K.ellipse(g, 0, 18, 26, 34, '#7a3a1a'); K.ellipse(g, 0, -24, 20, 24, '#8a4a2a');
        g.fillStyle = '#1a0a0a'; g.fillRect(-3, -90, 6, 70);
        g.strokeStyle = '#e8d8b0'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-40, -10 + Math.sin(G.time * 6) * 6); g.lineTo(40, 10 + Math.sin(G.time * 6) * 6); g.stroke();
        g.restore();
        break;
      }
      case 'mic': {
        g.fillStyle = '#5a5a6a'; g.fillRect(-46, -150, 4, 150); g.fillRect(-62, -2, 36, 4);
        K.circle(g, -44, -152, 8, '#2a2a3a'); K.circle(g, -44, -152, 5, acc);
        break;
      }
      case 'guitar': {
        g.save(); g.translate(10, -96); g.rotate(-0.55);
        K.ellipse(g, -26, 0, 28, 22, acc); K.circle(g, -26, 0, 8, '#1a1030');
        g.fillStyle = '#3a2a1a'; g.fillRect(-4, -4, 74, 8);
        g.fillStyle = acc; g.fillRect(66, -7, 16, 14);
        g.restore();
        break;
      }
    }
  }

  /* bosses: state { rage, attack, down (0..1), hp (0..1) } */
  function boss(g, i, x, y, sc, state) {
    state = state || {};
    const B = NS.worldData.BOSSES[i];
    const t = G.time, pulse = G.pulse || 0;
    const down = state.down || 0;
    g.save();
    g.translate(x, y);
    g.scale(sc * (1 - down * 0.2), sc * (1 - down * 0.2));
    g.globalAlpha *= 1 - down * 0.6;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= (state.attack ? 0.75 : 0.35) + pulse * 0.2;
    K.blit(g, K.glow(state.rage ? '#ff2a3a' : B.color), 0, -120, 2.6);
    g.restore();
    K.ellipse(g, 0, 2, 80, 12, 'rgba(0,0,0,0.5)');
    const hover = Math.sin(t * 2) * 6;
    switch (i) {
      case 0: { /* Gristle: a slab of a man with a speaker for a chest */
        g.fillStyle = '#2a0a1a'; g.fillRect(-46, -90, 36, 90); g.fillRect(10, -90, 36, 90);
        g.fillStyle = '#4a0a2a'; K.roundRect(g, -80, -230, 160, 150, 30); g.fill();
        const thump = 1 + pulse * 0.15;
        K.circle(g, 0, -150, 48, '#14040c'); K.circle(g, 0, -150, 40 * thump, '#3a1a2a'); K.circle(g, 0, -150, 16 * thump, B.color);
        g.strokeStyle = '#ffd25a'; g.lineWidth = 5; g.beginPath(); g.arc(0, -210, 52, 0.3, Math.PI - 0.3); g.stroke();
        for (const s of [-1, 1]) { g.fillStyle = '#4a0a2a'; g.save(); g.translate(s * 86, -210); g.rotate(s * (0.3 + (state.attack ? Math.sin(t * 12) * 0.4 : 0))); g.fillRect(-16, 0, 32, 90); K.circle(g, 0, 96, 18, '#8a5a6a'); g.restore(); }
        K.circle(g, 0, -262, 30, '#8a5a6a');
        g.fillStyle = '#0a0a0a'; g.fillRect(-26, -272, 52, 12);
        g.fillStyle = B.color; g.fillRect(-26, -272, 52, 3);
        g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(-24, -284); g.lineTo(-18, -304); g.lineTo(-6, -290); g.lineTo(0, -308); g.lineTo(6, -290); g.lineTo(18, -304); g.lineTo(24, -284); g.closePath(); g.fill();
        break;
      }
      case 1: { /* Vesper: glass and light */
        g.translate(0, hover - 20);
        for (const s of [-1, 1]) {
          g.save(); g.scale(s, 1); g.rotate(Math.sin(t * 1.5) * 0.08);
          g.globalAlpha *= 0.55;
          g.fillStyle = K.rgba(B.color, 0.5);
          g.beginPath(); g.moveTo(10, -200); g.lineTo(150, -300); g.lineTo(120, -180); g.lineTo(170, -140); g.lineTo(30, -130); g.closePath(); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.stroke();
          g.restore();
        }
        const gr = g.createLinearGradient(0, -260, 0, 0);
        gr.addColorStop(0, 'rgba(200,250,255,0.95)'); gr.addColorStop(1, 'rgba(60,200,200,0.35)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-20, -200); g.quadraticCurveTo(-60, -40, -70, 0); g.lineTo(70, 0); g.quadraticCurveTo(60, -40, 20, -200); g.closePath(); g.fill();
        K.circle(g, 0, -224, 26, 'rgba(220,250,255,0.95)');
        g.fillStyle = K.rgba(B.color, 0.8);
        g.beginPath(); g.moveTo(-26, -230); g.quadraticCurveTo(-60 + Math.sin(t * 2) * 10, -150, -40, -90); g.lineTo(-20, -210); g.closePath(); g.fill();
        g.fillStyle = '#1a4a5a'; g.fillRect(-12, -228, 7, 3); g.fillRect(5, -228, 7, 3);
        break;
      }
      case 2: { /* Anvil-9 */
        g.fillStyle = '#3a2a1a'; g.fillRect(-50, -80, 30, 80); g.fillRect(20, -80, 30, 80);
        g.fillStyle = '#5a3a1a'; K.roundRect(g, -84, -250, 168, 175, 12); g.fill();
        g.fillStyle = '#2a1a0a'; g.fillRect(-60, -210, 120, 90);
        const heat = 0.6 + pulse * 0.4 + (state.rage ? 0.3 : 0);
        g.fillStyle = K.mix('#ff5a1a', '#ffd25a', heat * 0.5); g.globalAlpha *= heat; g.fillRect(-52, -200, 104, 70); g.globalAlpha /= heat;
        for (let k = 0; k < 5; ++k) { g.fillStyle = '#2a1a0a'; g.fillRect(-52 + k * 26, -200, 4, 70); }
        g.fillStyle = '#6a4a2a'; g.fillRect(-40, -296, 80, 48);
        g.fillStyle = '#0a0a0a'; g.fillRect(-32, -282, 64, 14);
        g.fillStyle = B.color; g.fillRect(-30 + ((t * 40) % 50), -280, 12, 10);
        g.save(); g.translate(96, -230); g.rotate(state.attack ? -1.6 + Math.sin(t * 6) * 0.6 : -0.2 + Math.sin(t) * 0.1);
        g.fillStyle = '#5a3a1a'; g.fillRect(-12, 0, 24, 110); g.fillStyle = '#8a8a9a'; g.fillRect(-40, 100, 80, 46);
        g.restore();
        g.fillStyle = '#5a3a1a'; g.save(); g.translate(-96, -230); g.rotate(0.3); g.fillRect(-12, 0, 24, 100); g.restore();
        break;
      }
      case 3: { /* Madame Undertow */
        g.translate(0, hover);
        g.fillStyle = '#06204a';
        g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(-40, -60, -36, -170); g.lineTo(36, -170); g.quadraticCurveTo(40, -60, 90, 0); g.closePath(); g.fill();
        g.strokeStyle = '#5affea'; g.lineWidth = 2; g.stroke();
        K.circle(g, 0, -206, 30, '#5a8ab0');
        g.strokeStyle = '#0a2a5a'; g.lineWidth = 10; g.lineCap = 'round';
        for (let k = 0; k < 7; ++k) {
          const a = -2.6 + k * 0.36;
          g.beginPath(); g.moveTo(Math.cos(a) * 24, -206 + Math.sin(a) * 24);
          g.quadraticCurveTo(Math.cos(a) * 70 + Math.sin(t * 2 + k) * 20, -206 + Math.sin(a) * 50, Math.cos(a) * 90 + Math.sin(t * 1.5 + k) * 30, -150 + k * 12);
          g.stroke();
        }
        g.fillStyle = '#e0f8ff'; for (let k = 0; k < 7; ++k) K.circle(g, -24 + k * 8, -168 + Math.abs(k - 3) * 2, 3.5, '#e0f8ff');
        g.fillStyle = '#5affea'; g.fillRect(-14, -212, 8, 4); g.fillRect(6, -212, 8, 4);
        break;
      }
      case 4: { /* The Hush */
        g.translate(0, hover - 10);
        g.fillStyle = '#0e0e1a';
        g.beginPath(); g.moveTo(-30, -260); g.quadraticCurveTo(-110, -60, -100, 0); g.lineTo(100, 0); g.quadraticCurveTo(110, -60, 30, -260); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(224,224,255,0.5)'; g.lineWidth = 2; g.stroke();
        for (let k = 0; k < 4; ++k) { g.globalAlpha *= 0.4; K.ellipse(g, -80 + k * 50 + Math.sin(t + k) * 10, -10 - k * 6, 30, 8, '#c8c8ff'); g.globalAlpha /= 0.4; }
        K.ellipse(g, 0, -282, 26, 32, '#f0f0ff');
        g.fillStyle = '#0e0e1a'; K.ellipse(g, -10, -288, 5, 8, '#0e0e1a'); K.ellipse(g, 10, -288, 5, 8, '#0e0e1a');
        g.save(); g.translate(60, -190); g.rotate(-0.8 + Math.sin(t * 3) * (state.attack ? 0.8 : 0.25));
        g.fillStyle = '#0e0e1a'; g.fillRect(-8, 0, 16, 70);
        g.fillStyle = '#ffffff'; g.fillRect(-2, 60, 4, 70);
        g.restore();
        break;
      }
    }
    g.restore();
  }

  /* a cast member's portrait (180 px), painted once */
  function portrait(key) {
    return K.sprite('portrait:' + key, 180, 180, (g) => {
      const c = NS.storyData.CAST[key];
      const gr = g.createRadialGradient(90, 80, 10, 90, 90, 100);
      gr.addColorStop(0, K.rgba(c.accent, 0.55)); gr.addColorStop(1, 'rgba(10,4,20,0.95)');
      g.fillStyle = gr; K.roundRect(g, 4, 4, 172, 172, 22); g.fill();
      g.lineWidth = 3; g.strokeStyle = c.accent; g.stroke();
      g.save();
      K.roundRect(g, 4, 4, 172, 172, 22); g.clip();
      if (c.boss != null) boss(g, c.boss, 90, 260 + (c.boss === 4 ? 130 : c.boss === 0 ? 120 : 110), 0.62, {});
      else if (key === 'metro') {
        g.translate(90, 96);
        K.ellipse(g, 0, 0, 52, 30, '#3a4a6a'); K.ellipse(g, 0, -6, 46, 22, '#5a6a8a');
        K.circle(g, 0, -4, 18, '#0a0a1a'); K.circle(g, 0, -4, 10, c.accent); K.circle(g, -4, -8, 3, '#ffffff');
        g.strokeStyle = '#b8c8e0'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -30); g.lineTo(18, -60); g.stroke(); K.circle(g, 18, -62, 5, '#ff5a5a');
        for (const s of [-1, 1]) { g.fillStyle = '#8a9ab8'; g.fillRect(s * 52 - 14, -12, 28, 6); }
      } else {
        g.translate(90, 104);
        K.ellipse(g, 0, 70, 70, 40, c.coat);
        g.fillStyle = K.shade(c.skin, -0.15); g.fillRect(-12, 20, 24, 24);
        K.circle(g, 0, 0, 34, c.skin);
        g.fillStyle = c.hair;
        g.beginPath(); g.arc(0, -6, 37, Math.PI, 0); g.fill();
        if (key === 'reverb') { g.fillRect(-37, -6, 12, 40); g.fillRect(25, -6, 12, 40); g.fillStyle = '#1a1a1a'; K.roundRect(g, -26, -8, 22, 12, 4); g.fill(); K.roundRect(g, 4, -8, 22, 12, 4); g.fill(); g.fillRect(-4, -4, 8, 3); }
        else { g.fillStyle = '#1a0a1a'; g.fillRect(-15, 0, 6, 6); g.fillRect(9, 0, 6, 6); }
        g.fillStyle = '#7a3a3a'; g.fillRect(-7, 18, 14, 3);
        if (key === 'lyra') { g.strokeStyle = c.accent; g.lineWidth = 6; g.beginPath(); g.arc(0, -4, 40, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillStyle = c.accent; K.roundRect(g, -46, -10, 13, 26, 5); g.fill(); K.roundRect(g, 33, -10, 13, 26, 5); g.fill(); }
      }
      g.restore();
    });
  }

  function drawPerformer(x, y, sc, pose) {
    performer(ctx, G.profile.equip.performer, x, y, sc, pose);
  }

  function drawBoss(i, x, y, sc, state) {
    boss(ctx, i, x, y, sc, state);
  }

  Object.assign(NS.actors, { performer, boss, portrait, drawPerformer, drawBoss });
})();
