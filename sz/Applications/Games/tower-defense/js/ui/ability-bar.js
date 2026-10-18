/* ui/ability-bar.js -- airstrike planes, aiming overlays and the ability buttons.
   Reads: constants, env, pixelArt, artKit, layout, text, widgets, abilities, hud, mapOverlays and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_PLAYING, STATE_PAUSED, TWO_PI, WORLD_W, WORLD_H, hexToRgba, shade } = NS.constants;
  const { ctx } = NS.env;
  const { pixelArt, drawIcon } = NS.pixelArt;
  const { RAMPS, px, poly, drawShadow, blitArt } = NS.artKit;
  const { view } = NS.layout;
  const { fitText } = NS.text;
  const { UI, roundRectPath, drawMeter, drawKeycap, pointer, addRegion, pressAmount } = NS.widgets;
  const { ABILITIES, abilityCd, abilityUnlocked, abilityCooldown, strikeDamage, freezeTime, rushTime,
      useAbility } = NS.abilities;

  /* ── Drawing ── */
  let planeArt = null;
  function drawStrikes() {
    if (!planeArt)
      planeArt = pixelArt(30, 22, (g) => {
        const m = RAMPS.metal;
        px(g, 2, 9, 26, 5, m[3]); px(g, 2, 9, 26, 1, m[5]);
        poly(g, [26, 9, 30, 11, 26, 14], m[2]);
        poly(g, [10, 9, 16, 0, 20, 0, 18, 9], m[4]);
        poly(g, [10, 14, 16, 22, 20, 22, 18, 14], m[2]);
        poly(g, [0, 8, 5, 4, 7, 4, 5, 9], m[3]);
        px(g, 22, 10, 3, 2, '#7ad8ff');
        px(g, 12, 11, 2, 1, '#c8303a');
      });
    for (const s of G.strikes) {
      const k = s.t / 1.2;
      if (k > 1.2) continue;
      const x = -60 + (WORLD_W + 120) * k, y = s.y - 40;
      drawShadow(x, s.y + 6, 24, 7, 0.45);
      blitArt(planeArt, x, y + 22, false, 1, 1.4);
    }
    // Aiming reticle
    if (G.abilityAim === 'strike') {
      const c = cursorWorld();
      if (c) {
        const pulse = 0.5 + 0.5 * Math.sin(G.animTime * 8);
        ctx.strokeStyle = `rgba(255,120,60,${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; ++i) {
          ctx.beginPath();
          ctx.arc(c.x + i * CELL * 1.3, c.y, CELL * 1.4, 0, TWO_PI);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,90,40,0.12)';
        ctx.fillRect(c.x - CELL * 2.7, c.y - CELL * 1.4, CELL * 5.4, CELL * 2.8);
        NS.mapOverlays.drawBrackets(c.x - CELL / 2, c.y - CELL / 2, CELL, '#ff8a3a', 2 + pulse * 2);
      }
    }
  }

  function cursorWorld() {
    if (NS.hud.kbCursor.active)
      return { x: NS.hud.kbCursor.col * CELL + CELL / 2, y: NS.hud.kbCursor.row * CELL + CELL / 2 };
    if (!pointer.inside || pointer.wx < 0 || pointer.wy < 0 || pointer.wx >= WORLD_W || pointer.wy >= WORLD_H) return null;
    return { x: pointer.wx, y: pointer.wy };
  }

  function drawAbilityOverlays() {
    if (G.freezeFlash > 0) {
      ctx.fillStyle = `rgba(220,245,255,${G.freezeFlash * 0.45})`;
      ctx.fillRect(-20, -20, G.UW + 40, G.UH + 40);
      G.freezeFlash = Math.max(0, G.freezeFlash - G.frameDt * 2.5);
    }
    if (G.rushTimer > 0 && (G.state === STATE_PLAYING || G.state === STATE_PAUSED)) {
      const a = 0.25 + 0.15 * Math.sin(G.animTime * 6);
      ctx.strokeStyle = `rgba(255,215,90,${a})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(view.x / G.uiS + 3, view.y / G.uiS + 3, WORLD_W * view.s / G.uiS - 6, WORLD_H * view.s / G.uiS - 6);
    }
  }

  // Three round buttons at the right end of the build bar
  function abilityBarWidth() {
    return ABILITIES.length * 62 + 6;
  }

  function drawAbilityButtons(x, y, h) {
    ABILITIES.forEach((a, i) => {
      const bx = x + i * 62, w = 56;
      const id = 'ability-' + a.id;
      const unlocked = abilityUnlocked(a);
      const cd = abilityCd[a.id], total = abilityCooldown(a);
      const ready = unlocked && cd <= 0;
      const active = G.abilityAim === a.id || (a.id === 'rush' && G.rushTimer > 0);
      const hover = G.hoverId === id;
      const press = pressAmount(id);
      ctx.save();
      roundRectPath(bx, y + press * 2, w, h, 10);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, ready ? shade(a.color, hover ? -0.35 : -0.5) : 'rgba(30,34,50,0.95)');
      g.addColorStop(1, ready ? shade(a.color, -0.78) : 'rgba(12,14,24,0.95)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.strokeStyle = active ? '#ffffff' : ready ? a.color : 'rgba(150,170,210,0.25)';
      ctx.stroke();
      if (ready) {
        roundRectPath(bx - 2, y - 2 + press * 2, w + 4, h + 4, 12);
        ctx.strokeStyle = hexToRgba(a.color, 0.25 + 0.2 * Math.sin(G.animTime * 4 + i));
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const cx = bx + w / 2, cy = y + h / 2 - 6 + press * 2;
      drawIcon(unlocked ? a.icon : 'lock', cx, cy, unlocked ? 26 : 20, unlocked ? (ready ? 1 : 0.45) : 0.6);
      if (unlocked && cd > 0) {
        // Cooldown sweep
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 17, -Math.PI / 2, -Math.PI / 2 + TWO_PI * (cd / total));
        ctx.closePath();
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        fitText(String(Math.ceil(cd)), cx, cy, 30, 13, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.8)' });
      }
      if (a.id === 'rush' && G.rushTimer > 0)
        drawMeter(bx + 6, y + h - 22, w - 12, 5, G.rushTimer / rushTime(), UI.gold);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(a.name, cx, y + h - 9 + press * 2, w - 6, 9, { weight: 'bold', color: unlocked ? UI.text : UI.textMute, minPx: 7 });
      drawKeycap(a.key, bx + 3, y + 3, 9);
      ctx.restore();
      addRegion({ id, x: bx, y, w, h, anchorTip: true, sound: false,
        onClick: () => useAbility(a.id),
        tip: () => abilityTooltip(a) });
    });
  }

  function abilityTooltip(a) {
    const lines = [a.name, a.desc];
    if (!abilityUnlocked(a)) {
      lines.push('✘ Locked: unlock it in Research (Abilities)');
      return lines;
    }
    if (a.id === 'strike') lines.push(`[[sword]] ${Math.round(strikeDamage())} damage per bomb, three bombs`);
    if (a.id === 'freeze') lines.push(`[[clock]] ${freezeTime()} seconds`);
    if (a.id === 'rush') lines.push(`[[clock]] ${rushTime()} seconds of double gold`);
    lines.push(`• Cooldown ${Math.round(abilityCooldown(a))} s · key ${a.key}`);
    if (G.state !== STATE_PLAYING) lines.push('⚠ Usable while a wave is running');
    else if (abilityCd[a.id] > 0) lines.push(`⚠ Ready in ${Math.ceil(abilityCd[a.id])} s`);
    else lines.push('✔ Ready');
    return lines;
  }

  NS.abilityBar = { drawStrikes, drawAbilityOverlays, abilityBarWidth, drawAbilityButtons };

})();
