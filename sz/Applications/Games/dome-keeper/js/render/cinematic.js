;(function() {
  'use strict';

  // Drawing the landing and relocation sequence, the relocate button and its confirmation box.
  // Owns: NS.cinematicArt
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, rules, relocation, biomes, surfaceArt,
  //   domeArt, gadgetArt
  // Reads state of: gameState, relocation, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI } = NS.constants;
  const { makeRng, hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { SPRITE_OUTLINE, drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawChip, drawButton, drawHeadline, drawScrim } = NS.panels;
  const { DOME_X, DOME_Y } = NS.rules;
  const { RELOCATE_KEEP, THREAT_PER_SITE, relocateBlocker, relocateButtonRect, confirmButtons, cinematicStep } = NS.relocation;

  // Dome pose for the current cinematic step: lift (px above the ground), unpack (0..1), legs (0..1), thrust (0..1)
  function cinematicRig() {
    const c = G.cinematic;
    const [name, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    const ease = (x) => x * x * (3 - 2 * x);
    switch (name) {
      case 'pack': return { lift: 0, unpack: 1 - ease(Math.min(1, k * 1.25)), legs: k > 0.55 ? ease((k - 0.55) / 0.45) : 0, thrust: k > 0.8 ? (k - 0.8) * 2 : 0 };
      case 'liftoff': return { lift: Math.pow(k, 2.2) * (DOME_Y + 220), unpack: 0, legs: 1 - ease(Math.min(1, k * 3)), thrust: 0.6 + k * 0.4 };
      case 'descent': return { lift: Math.pow(1 - k, 2) * (DOME_Y + 220), unpack: 0, legs: k > 0.55 ? ease((k - 0.55) / 0.45) : 0, thrust: 0.35 + (1 - k) * 0.5 + (k > 0.75 ? 0.4 : 0) };
      case 'touchdown': return { lift: 0, unpack: 0, legs: 1, thrust: Math.max(0, 0.5 - k), squash: Math.sin(k * Math.PI) * 0.06 };
      case 'unpack': return { lift: 0, unpack: ease(k), legs: 1 - ease(Math.min(1, k * 2.5)) * 0.85, thrust: 0 };
      default: return { lift: 0, unpack: 1, legs: 0, thrust: 0 };
    }
  }

  function drawThrusters(rig) {
    if (rig.thrust <= 0.01) return;
    const y = DOME_Y + 14 - rig.lift;
    for (const ox of [-72, 0, 72]) {
      const x = DOME_X + ox;
      const len = (34 + rig.thrust * 70) * (0.85 + Math.random() * 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, `rgba(255,255,230,${0.95 * rig.thrust})`);
      g.addColorStop(0.3, `rgba(255,190,80,${0.8 * rig.thrust})`);
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 11, y);
      ctx.quadraticCurveTo(x - 6, y + len * 0.6, x, y + len);
      ctx.quadraticCurveTo(x + 6, y + len * 0.6, x + 11, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawGlow('#ffa040', x, y + 12, 34 + rig.thrust * 30, 0.7 * rig.thrust);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.fillRect(x - 13, y - 2, 26, 9);
      ctx.fillStyle = '#5a6a88';
      ctx.fillRect(x - 11, y - 1, 22, 6);
    }
    if (rig.lift < 160 && Math.random() < 0.6)
      particles.trail(DOME_X + (Math.random() - 0.5) * 200, DOME_Y + 10, { vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 1.5, color: '#8a7a6a', life: 0.8, size: 3 + Math.random() * 3, gravity: -0.01 });
  }

  // Planet map shown during the flight between sites
  function drawFlightMap(k) {
    const c = G.cinematic;
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#04060e');
    g.addColorStop(1, '#0a1022');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const rng = makeRng((c.oldSite ? c.oldSite.seed : 1) ^ G.site.seed);
    for (let i = 0; i < 160; ++i) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rng() * 0.5})`;
      ctx.fillRect(rng() * CANVAS_W, rng() * CANVAS_H * 0.5, 1.5, 1.5);
    }
    // The planet's curve with patches of land in biome colours
    const cx = CANVAS_W / 2, cy = CANVAS_H + 900, R = 1400;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    const pg = ctx.createRadialGradient(cx, cy - R * 0.6, R * 0.2, cx, cy, R);
    pg.addColorStop(0, '#2a3a5a');
    pg.addColorStop(1, '#141c30');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.clip();
    for (let i = 0; i < 70; ++i) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 1.1, d = R - 40 - rng() * 520;
      const b = NS.biomes.BIOMES[NS.biomes.BIOME_KEYS[Math.floor(rng() * NS.biomes.BIOME_KEYS.length)]];
      ctx.fillStyle = hexToRgba(b.ground.day[1], 0.16 + rng() * 0.12);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 24 + rng() * 50, 10 + rng() * 22, rng() * 0.6 - 0.3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,180,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    drawGlow('#5aa8ff', cx, cy - R, 600, 0.12);

    // Route from the old site to the new one
    const p0 = { x: 280, y: 700 }, p1 = { x: CANVAS_W - 280, y: 690 };
    const ctrl = { x: CANVAS_W / 2, y: 280 };
    const at = (t) => ({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p1.y });
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -G.animTime * 40;
    ctx.strokeStyle = 'rgba(255,224,128,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(ctrl.x, ctrl.y, p1.x, p1.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const sites = [[p0, c.oldSite || G.site, false], [p1, G.site, true]];
    for (const [p, s, isNew] of sites) {
      const b = NS.biomes.BIOMES[s.biome];
      drawGlow(b.ground.day[0], p.x, p.y, 50, 0.6);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = isNew ? '#ffe080' : '#8a9ab8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, TWO_PI);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(`Site ${s.index + 1}`, p.x, p.y + 38, 260, 22, { weight: 'bold', color: isNew ? UI.gold : UI.textDim });
      fitText(b.name, p.x, p.y + 64, 260, 18, { color: isNew ? UI.text : UI.textMute });
    }
    const t = k * k * (3 - 2 * k);
    const pos = at(t), ahead = at(Math.min(1, t + 0.02));
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(Math.atan2(ahead.y - pos.y, ahead.x - pos.x) * 0.3);
    drawGlow('#ffa040', -20, 10, 40, 0.7);
    drawSprite('flight', 0, 0, 56);
    ctx.restore();
    if (Math.random() < 0.6)
      particles.trail(pos.x - 14, pos.y + 16, { vx: -1.5, vy: 0.5, color: '#ffb060', life: 0.5, size: 2.5 });
    drawHeadline('Relocating', CANVAS_W / 2, 150, 800, 56, '#ffe080', '#e0a020');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`Upgrades, drones and ${Math.round(RELOCATE_KEEP * 100)}% of the resources are on board  ·  threat +${THREAT_PER_SITE} at the new site`, CANVAS_W / 2, 214, 1100, 20, { color: UI.textDim });
  }

  function drawCinematic() {
    const c = G.cinematic;
    const name = cinematicStep();
    const [, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    if (name === 'flight') {
      drawFlightMap(k);
    } else {
      // Pack up and lift off at the old site, descend and unpack at the new one
      const useOld = (name === 'pack' || name === 'liftoff') && c.oldSite;
      const saved = G.site;
      if (useOld) G.site = c.oldSite;
      NS.surfaceArt.drawSky();
      NS.surfaceArt.drawGroundLayer();
      const rig = cinematicRig();
      drawThrusters(rig);
      NS.domeArt.drawDome(rig);
      G.site = saved;
    }
    // Letterbox bars and caption
    const bar = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, bar);
    ctx.fillRect(0, CANVAS_H - bar, CANVAS_W, bar);
    const captions = {
      pack: 'Packing up the dome...', liftoff: 'Lift off!', flight: '',
      descent: `Approaching ${NS.biomes.currentBiome().name}`, touchdown: 'Touchdown', unpack: 'Unpacking the dome...'
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (captions[name])
      fitText(captions[name], CANVAS_W / 2, bar / 2 + 2, 900, 26, { weight: 'bold', color: '#ffe8b0' });
    NS.gadgetArt.drawKeyHints([{ key: 'Click', label: 'Skip' }, { key: 'Space', label: 'Skip' }, { key: 'Esc', label: 'Skip' }], CANVAS_W / 2, CANVAS_H - bar / 2, 500);
  }

  // Relocate button under the clock panel (surface)
  function drawRelocateButton() {
    if (!G.relocationCore.found) return;
    const b = relocateButtonRect();
    const why = relocateBlocker();
    const hover = G.relocateHover === 'button';
    ctx.save();
    roundRectPath(b.x, b.y, b.w, b.h, 12);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (why) {
      g.addColorStop(0, 'rgba(40,44,60,0.92)');
      g.addColorStop(1, 'rgba(24,26,36,0.92)');
    } else {
      g.addColorStop(0, hover ? '#3a9ae8' : '#2a7ad0');
      g.addColorStop(1, hover ? '#1a5aa8' : '#16468a');
    }
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = why ? 'rgba(120,130,160,0.5)' : (hover ? '#cfe8ff' : `rgba(150,210,255,${0.6 + Math.sin(G.animTime * 4) * 0.3})`);
    ctx.stroke();
    drawSprite('flight', b.x + 30, b.y + b.h / 2, 36, why ? 0.5 : 1);
    const kw = drawChip('L', b.x + b.w - 10, b.y + 15, 24, { align: 'right', px: 13, bg: 'rgba(0,0,0,0.4)', border: 'rgba(255,255,255,0.25)', color: UI.text });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Relocate', b.x + 56, b.y + 19, b.w - 70 - kw, 21, { weight: 'bold', color: why ? UI.textMute : '#ffffff' });
    fitText(why || 'Fly the dome to a new site', b.x + 56, b.y + 40, b.w - 66, 14, { color: why ? '#e0a080' : '#cfe4ff' });
    ctx.restore();
  }

  function drawRelocateConfirm() {
    drawScrim(0.62);
    const pw = 700, ph = 420, px = CANVAS_W / 2 - pw / 2, py = CANVAS_H / 2 - ph / 2 - 20;
    drawPanel(px, py, pw, ph, { accent: '#5ab8ff', radius: 16, title: 'Relocate the dome?', titlePx: 28, headerH: 64, titleRight: `Site ${G.site.index + 1} → ${G.site.index + 2}` });
    drawSprite('flight', px + 70, py + 150, 80);
    const rows = [
      ['check', 'Keep every upgrade, drone and gadget'],
      ['bag', `Keep ${Math.round(RELOCATE_KEEP * 100)}% of every resource`],
      ['pickaxe', 'A fresh mine in a new biome - with a new Relocation Core'],
      ['swords', `The monsters there are tougher: threat +${THREAT_PER_SITE}`]
    ];
    rows.forEach(([icon, text], i) => {
      const y = py + 100 + i * 44;
      drawSprite(icon, px + 150, y, 24);
      drawTextBlock(text, px + 172, y - 18, pw - 172 - 30, 36, 19, { valign: 'middle', color: UI.text, minPx: 13 });
    });
    for (const b of confirmButtons())
      drawButton(b, b.id === 'yes', G.relocateHover === b.id);
    NS.gadgetArt.drawKeyHints([{ key: 'Enter', label: 'Lift off' }, { key: 'Esc', label: 'Stay' }], CANVAS_W / 2, py + ph - 26, pw - 80);
  }

  NS.cinematicArt = { drawCinematic, drawRelocateButton, drawRelocateConfirm };
})();
