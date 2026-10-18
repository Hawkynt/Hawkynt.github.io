/* Drawing the ships: the player (bank frames, dodge-roll squash, engine flames, shield bubble
   that flares where it is hit, Aegis, hit flash), wingman drones, every enemy type (warp-in,
   cloak shimmer, sentry barrels, frigate shield arcs, lancer warning lines, engine glows), the
   allies, and the bosses with parts, core shields, open jaws and death throes. World units. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const S = NS.shipArt;
  const E = NS.enemyArt;
  const { ctx } = NS.view;

  function lighter() {
    ctx.globalCompositeOperation = 'lighter';
  }

  function normal() {
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── player ── */
  function drawPlayer() {
    const p = G.player;
    if (!p || !p.alive) return;
    const ship = p.ship.id;
    const roll = p.rollT > 0 ? Math.cos(p.rollSpin) : 1;
    const bank = p.rollT > 0 ? Math.sin(p.rollSpin) : p.bank;
    const blink = p.iframes > 0 && p.rollT <= 0 && Math.floor(G.time * 20) % 2 === 0;

    /* engine flames behind the hull */
    lighter();
    const eng = S.enginePoints(ship);
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const power = 0.45 + p.thrusting * 0.55;
    const flick = 0.85 + Math.sin(G.time * 60) * 0.15;
    const glow = K.glow(p.engineColor);
    for (let i = 0; i < eng.length; ++i) {
      const e = eng[i];
      const ey = e[1] * roll;
      const x = p.x + ca * e[0] - sa * ey, y = p.y + sa * e[0] + ca * ey;
      const len = (10 + power * 18 + (p.boosting ? 14 : 0)) * flick;
      ctx.globalAlpha = 0.9;
      K.blitRot(ctx, glow, x - ca * len * 0.35, y - sa * len * 0.35, p.angle, 1, 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.angle);
      ctx.drawImage(glow.canvas, -len, -e[2] * 1.6, len * 1.1, e[2] * 3.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    normal();

    if (!blink) {
      const spr = S.shipSprite(ship, p.skinKey, p.colors, bank);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(1.2, 1.2 * (roll !== 1 ? Math.max(0.15, Math.abs(roll)) : 1));
      ctx.drawImage(spr.canvas, -spr.hw, -spr.hh, spr.w, spr.h);
      if (p.hitFlash > 0) {
        ctx.globalAlpha = Math.min(1, p.hitFlash * 8);
        const fl = S.shipFlash(ship, p.skinKey, p.colors, bank);
        ctx.drawImage(fl.canvas, -fl.hw, -fl.hh, fl.w, fl.h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /* navigation strobes */
    lighter();
    if (Math.floor(G.time * 1.6) % 2 === 0) {
      ctx.globalAlpha = 0.6;
      K.blit(ctx, K.glow('#ff4a4a'), p.x - ca * 14 + sa * 22 * roll, p.y - sa * 14 - ca * 22 * roll, 0.25);
      K.blit(ctx, K.glow('#4aff7a'), p.x - ca * 14 - sa * 22 * roll, p.y - sa * 14 + ca * 22 * roll, 0.25);
    }
    /* shield bubble: faint while charged, bright where a shot lands */
    if (p.shield > 0 || p.shieldFlare > 0) {
      const base = 0.06 + 0.1 * (p.shield / p.maxShield);
      ctx.globalAlpha = Math.min(1, base + Math.max(0, p.shieldFlare) * 0.6);
      K.blit(ctx, K.ringSprite('#58c8ff'), p.x, p.y, 0.5);
      if (p.shieldFlare > 0) {
        ctx.globalAlpha = Math.min(1, p.shieldFlare);
        ctx.strokeStyle = '#bfefff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, p.shieldFlareA - 0.7, p.shieldFlareA + 0.7);
        ctx.stroke();
        K.blit(ctx, K.glow('#8ad8ff'), p.x + Math.cos(p.shieldFlareA) * 30, p.y + Math.sin(p.shieldFlareA) * 30, 0.6);
      }
    }
    if (p.aegis > 0) {
      ctx.globalAlpha = 0.55 + Math.sin(G.time * 18) * 0.2;
      K.blit(ctx, K.ringSprite('#ffd27a'), p.x, p.y, 0.7);
      ctx.globalAlpha = 0.25;
      K.blit(ctx, K.glow('#ffd27a'), p.x, p.y, 1.6);
    }
    if (p.overcharge > 0 || p.overdrive > 0) {
      ctx.globalAlpha = 0.25 + Math.sin(G.time * 12) * 0.1;
      K.blit(ctx, K.glow(p.overdrive > 0 ? p.colors.trim : '#ff5cf0'), p.x, p.y, 1.2);
    }
    ctx.globalAlpha = 1;
    normal();
  }

  function drawDrones() {
    const spr = E.enemySprite('drone');
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      lighter();
      ctx.globalAlpha = 0.6;
      K.blit(ctx, K.glow('#8affe0'), d.x - Math.cos(d.angle) * 8, d.y - Math.sin(d.angle) * 8, 0.35);
      ctx.globalAlpha = 1;
      normal();
      const sp = S.shipSprite('specter', 'drone', { hull: '#9fe6d8', dark: '#1f4c52', trim: '#18e0b0', glow: '#8affe0' }, 0);
      K.blitRot(ctx, sp, d.x, d.y, d.angle, 0.45);
      if (!d.escort && d.life < 3 && Math.floor(G.time * 8) % 2) {
        ctx.globalAlpha = 0.5;
        K.blit(ctx, spr, d.x, d.y, 0.5);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ── enemies ── */
  function inView(x, y, r, v) {
    return x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;
  }

  function drawEnemies(v) {
    /* engine glows first, in one additive pass */
    lighter();
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.def.speed === 0 || e.spawnT > 0 || !inView(e.x, e.y, e.r * 2, v)) continue;
      const a = e.cloak < 1 ? e.cloak : 1;
      ctx.globalAlpha = 0.55 * a;
      const ex = e.x - Math.cos(e.angle) * e.r * 0.9, ey = e.y - Math.sin(e.angle) * e.r * 0.9;
      K.blit(ctx, K.glow(E.PAL[e.type] ? E.PAL[e.type].glow : '#ff8a5a'), ex, ey, e.r / 40);
    }
    ctx.globalAlpha = 1;
    normal();

    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || !inView(e.x, e.y, e.r * 2 + 40, v)) continue;
      if (e.spawnT > 0) {
        /* warp-in: the ship scales up out of a flash */
        const k = 1 - e.spawnT / 0.6;
        ctx.globalAlpha = k;
        K.blitRot(ctx, E.enemySprite(e.type), e.x, e.y, e.angle, 0.3 + k * 0.7);
        ctx.globalAlpha = 1;
        continue;
      }
      if (e.type === 'turret') {
        drawTurret(e.x, e.y, e.parent ? e.parent.angle : 0, e.barrel, e.flash, 1);
        continue;
      }
      const spr = E.enemySprite(e.type);
      ctx.globalAlpha = e.cloak;
      if (e.cloak < 0.3) {
        /* cloaked: only a faint shimmer of the outline */
        ctx.globalAlpha = 0.12 + Math.sin(G.time * 9 + e.id) * 0.06;
      }
      const es = e.r < 45 ? 1.15 : 1;
      K.blitRot(ctx, spr, e.x, e.y, e.angle, es);
      if (e.flash > 0 && e.cloak >= 0.3) {
        ctx.globalAlpha = Math.min(1, e.flash * 14) * 0.85;
        K.blitRot(ctx, E.enemyFlash(e.type), e.x, e.y, e.angle, es);
      }
      ctx.globalAlpha = 1;
      if (e.def.shieldArc) drawShieldArc(e);
      if (e.type === 'lancer' && e.charge > 0) drawTelegraph(e);
      if (e.stun > 0) {
        lighter();
        ctx.globalAlpha = 0.4 + Math.sin(G.time * 30) * 0.2;
        K.blit(ctx, K.ringSprite('#8ad8ff'), e.x, e.y, e.r / 40);
        ctx.globalAlpha = 1;
        normal();
      }
      if ((e.type === 'station' || e.type === 'carrier' || e.type === 'frigate') && e.hp < e.maxHp)
        drawHpBar(e.x, e.y - e.r - 14, e.r * 1.6, e.hp / e.maxHp, e.objective ? '#ffd25a' : '#ff6a5c');
      if (e.objective) drawObjectiveMark(e);
    }
  }

  function drawTurret(x, y, baseA, barrelA, flash, scale) {
    K.blitRot(ctx, E.enemySprite('turret'), x, y, baseA, scale);
    K.blitRot(ctx, E.enemySprite('barrel'), x, y, barrelA, scale * 0.9);
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash * 14) * 0.8;
      K.blitRot(ctx, E.enemyFlash('turret'), x, y, baseA, scale);
      ctx.globalAlpha = 1;
    }
  }

  function drawShieldArc(e) {
    lighter();
    const a = 0.25 + Math.max(0, e.shieldHit) * 0.7;
    ctx.strokeStyle = K.rgba('#8ad8ff', e.stun > 0 ? 0.05 : a);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 12, e.angle - e.def.shieldArc, e.angle + e.def.shieldArc);
    ctx.stroke();
    ctx.strokeStyle = K.rgba('#ffffff', a * 0.6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    normal();
  }

  function drawTelegraph(e) {
    const k = 1 - e.charge / e.def.beam.charge;
    lighter();
    ctx.strokeStyle = K.rgba('#ff3a3a', 0.25 + k * 0.6);
    ctx.lineWidth = 1 + k * 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.beamA) * 1400, e.y + Math.sin(e.beamA) * 1400);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5 + k * 0.5;
    K.blit(ctx, K.glow('#ff5a5a'), e.x + Math.cos(e.beamA) * 28, e.y + Math.sin(e.beamA) * 28, 0.3 + k * 0.6);
    ctx.globalAlpha = 1;
    normal();
  }

  function drawHpBar(x, y, w, frac, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
  }

  function drawObjectiveMark(e) {
    const t = G.time;
    ctx.strokeStyle = K.rgba('#ffd25a', 0.55 + Math.sin(t * 4) * 0.25);
    ctx.lineWidth = 2;
    const r = e.r + 26;
    for (let i = 0; i < 4; ++i) {
      const a = t * 0.6 + i * TAU / 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, a, a + 0.7);
      ctx.stroke();
    }
  }

  /* ── allies ── */
  function drawAllies() {
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      if (!a.alive) continue;
      if (a.type === 'station') {
        K.blitRot(ctx, E.enemySprite('relay'), a.x, a.y, a.angle, 1);
        lighter();
        ctx.globalAlpha = 0.25 + Math.sin(G.time * 2) * 0.1;
        K.blit(ctx, K.glow('#9ad8ff'), a.x, a.y, 2.2);
        ctx.globalAlpha = 1;
        normal();
      } else {
        lighter();
        ctx.globalAlpha = 0.7;
        K.blit(ctx, K.glow('#9ad8ff'), a.x - Math.cos(a.angle) * 62, a.y - Math.sin(a.angle) * 62, 0.8);
        ctx.globalAlpha = 1;
        normal();
        K.blitRot(ctx, E.enemySprite('freighter'), a.x, a.y, a.angle, 1);
      }
      if (a.flash > 0) {
        lighter();
        ctx.globalAlpha = a.flash * 6;
        K.blit(ctx, K.glow('#ff8a6a'), a.x, a.y, a.r / 30);
        ctx.globalAlpha = 1;
        normal();
      }
      drawHpBar(a.x, a.y - a.r - 18, a.r * 1.8, a.hp / a.maxHp, '#5cff9a');
      ctx.strokeStyle = K.rgba('#5cff9a', 0.4);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r + 22, G.time * 0.5, G.time * 0.5 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ── bosses ── */
  function drawBoss() {
    const b = G.boss;
    if (!b || !b.alive) return;
    const fade = b.fadeT > 0 ? 1 - b.fadeT : 1;
    const intro = b.introT > 0 ? Math.max(0.2, 1 - b.introT / 2.6) : 1;
    ctx.globalAlpha = fade * intro;
    /* serpent body from the tail forward */
    for (let i = b.parts.length - 1; i >= 0; --i) {
      const pt = b.parts[i];
      if (!pt.alive && pt.type !== 'segment') continue;
      if (pt.type === 'segment') {
        if (!pt.alive) {
          ctx.globalAlpha = fade * intro * 0.5;
          K.blitRot(ctx, E.enemySprite('segment'), pt.x, pt.y, pt.angle, 0.85);
          ctx.globalAlpha = fade * intro;
          continue;
        }
        K.blitRot(ctx, E.enemySprite('segment'), pt.x, pt.y, pt.angle, pt.r / 28);
      }
    }
    /* core */
    const coreId = E.bossSprite(b);
    const rot = b.def.move.type === 'serpent' || b.def.move.type === 'stalk' || b.id === 'maw' ? b.angle : b.spin;
    if (b.id === 'maw') {
      K.blitRot(ctx, E.enemySprite('maw'), b.x, b.y, rot, 1);
      if (b.mouth > 0) {
        ctx.globalAlpha = fade * intro * b.mouth;
        K.blitRot(ctx, E.enemySprite('mawOpen'), b.x, b.y, rot, 1);
        ctx.globalAlpha = fade * intro;
      }
    } else
      K.blitRot(ctx, E.enemySprite(coreId), b.x, b.y, rot, 1);
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(1, b.flash * 12) * 0.6 * fade;
      K.blitRot(ctx, E.enemyFlash(b.id === 'maw' ? 'maw' : coreId), b.x, b.y, rot, 1);
      ctx.globalAlpha = fade * intro;
    }
    /* other parts */
    for (let i = 0; i < b.parts.length; ++i) {
      const pt = b.parts[i];
      if (!pt.alive || pt.type === 'segment') continue;
      if (pt.type === 'turret') drawTurret(pt.x, pt.y, pt.angle, pt.barrel, pt.flash, 0.9);
      else {
        const id = E.partSprite(pt);
        K.blitRot(ctx, E.enemySprite(id), pt.x, pt.y, pt.type === 'shard' ? pt.angle + G.time : pt.angle, pt.r / 22);
        if (pt.flash > 0) {
          ctx.globalAlpha = Math.min(1, pt.flash * 14) * 0.8;
          K.blitRot(ctx, E.enemyFlash(id), pt.x, pt.y, pt.angle, pt.r / 22);
          ctx.globalAlpha = fade * intro;
        }
      }
      if (pt.hp < pt.maxHp) drawHpBar(pt.x, pt.y - pt.r - 10, pt.r * 1.8, pt.hp / pt.maxHp, '#ffb347');
    }
    ctx.globalAlpha = 1;
    lighter();
    /* core shield bubble while emitters live, with tethers to them */
    if (!b.vulnerable && !b.dying) {
      const a = 0.25 + Math.max(0, b.shieldHit) * 0.5 + Math.sin(G.time * 5) * 0.05;
      ctx.globalAlpha = a * fade;
      K.blit(ctx, K.ringSprite('#58c8ff'), b.x, b.y, (b.r + 26) / 52);
      ctx.strokeStyle = K.rgba('#8ad8ff', 0.35 * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < b.parts.length; ++i) {
        const pt = b.parts[i];
        if (pt.alive && pt.type === b.def.shieldBy) {
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    }
    if (b.id === 'maw' && b.gravity && b.introT <= 0) {
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#3ad0c0';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        const r = ((G.time * 120 + i * 160) % 480) + 120;
        ctx.globalAlpha = 0.18 * (1 - (r - 120) / 480);
        ctx.beginPath();
        ctx.arc(b.x, b.y, 600 - r, 0, TAU);
        ctx.stroke();
      }
    }
    if (b.dying) {
      ctx.globalAlpha = Math.min(1, b.deathT / 2.4) * 0.6;
      K.blit(ctx, K.glow('#ffe0b0'), b.x, b.y, b.r / 14 * (0.5 + b.deathT / 2.4));
    }
    ctx.globalAlpha = 1;
    normal();
  }

  Object.assign(NS.actors, {
    drawPlayer, drawDrones, drawEnemies, drawAllies, drawBoss, drawHpBar, drawTurret
  });
})();
