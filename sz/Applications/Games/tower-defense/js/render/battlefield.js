/* render/battlefield.js -- drawing the map: terrain, depth-sorted towers and enemies, corpses, shots and beams.
   Reads: constants, towerTypes, enemyTypes, env, pixelArt, artKit, layout, effects, terrain, towerArt,
      enemyArt, paths, towers, savegame, weather, abilityBar, mapOverlays and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_READY, STATE_PLAYING, STATE_BUILD, STATE_MAP_SELECT, STATE_RESEARCH, TWO_PI, WORLD_W,
      WORLD_H, clamp, hexToRgba } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx } = NS.env;
  const { makeCanvas } = NS.pixelArt;
  const { AP, drawGlow, drawShadow, blitArt, flashOf } = NS.artKit;
  const { view, setWorldTransform } = NS.layout;
  const { drawParticles, drawTexts, drawDecals } = NS.effects;
  const { drawTerrain, drawGates } = NS.terrain;
  const { drawTowerSprite, muzzleOf } = NS.towerArt;
  const { enemyScale, enemyFrame } = NS.enemyArt;
  const { pathPos } = NS.paths;
  const { towerStats } = NS.towers;
  const { runIsOpen } = NS.savegame;

  /* ══════════════════════════════════════════════════════════════════
     BATTLEFIELD RENDERING -- terrain, actors sorted by depth, shots,
     effects and the ambient weather of each biome
     ══════════════════════════════════════════════════════════════════ */

  let corpses = [];             // dying enemies fading out

  function drawWorld() {
    setWorldTransform();
    // Frame around the battlefield
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-6, -4, WORLD_W + 12, WORLD_H + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    drawTerrain();
    const live = G.state !== STATE_READY && G.state !== STATE_MAP_SELECT && (G.state !== STATE_RESEARCH || runIsOpen());
    if (live) {
      drawRoadHints();
      drawDecals();
      drawFloorEffects();
      drawTraps();
      drawClouds();
    }
    drawGates(false);
    if (live) {
      NS.mapOverlays.drawMapOverlays();
      drawActors();
      drawCorpses();
      drawProjectiles();
      drawFxLines();
      NS.abilityBar.drawStrikes();
    }
    drawGates(true);
    NS.weather.drawAmbient();
    if (live) {
      drawParticles();
      drawTexts();
      drawPreWaveWarning();
    }
    drawWorldVignette();
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = 'rgba(255,215,90,0.4)';
    ctx.lineWidth = 2 / view.s;
    ctx.strokeRect(-1, -1, WORLD_W + 2, WORLD_H + 2);
  }

  let worldVignette = null;
  function drawWorldVignette() {
    if (!worldVignette) {
      worldVignette = makeCanvas(200, 136);
      const g = worldVignette.getContext('2d');
      const grad = g.createRadialGradient(100, 68, 50, 100, 68, 130);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 200, 136);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(worldVignette, 0, 0, WORLD_W, WORLD_H);
    ctx.imageSmoothingEnabled = false;
  }

  /* ── Subtle marching chevrons along the roads while building ── */
  function drawRoadHints() {
    const a = G.state === STATE_BUILD ? 0.28 : 0.1;
    const tmp = { x: 0, y: 0, angle: 0 };
    const shift = (G.animTime * 24) % (CELL * 2);
    ctx.fillStyle = `rgba(255,236,170,${a})`;
    for (const p of G.paths) {
      for (let d = CELL + shift; d < p.total - CELL * 0.8; d += CELL * 2) {
        pathPos(p, d, tmp);
        const ca = Math.cos(tmp.angle), sa = Math.sin(tmp.angle);
        ctx.beginPath();
        ctx.moveTo(tmp.x + ca * 4, tmp.y + sa * 4);
        ctx.lineTo(tmp.x - ca * 3 - sa * 4, tmp.y - sa * 3 + ca * 4);
        ctx.lineTo(tmp.x - ca * 1, tmp.y - sa * 1);
        ctx.lineTo(tmp.x - ca * 3 + sa * 4, tmp.y - sa * 3 - ca * 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawPreWaveWarning() {
    if (!G.warningActive) return;
    const pulse = Math.abs(Math.sin(G.warningPulse));
    for (const p of G.paths) {
      const s = p.pts[0], n = p.pts[1];
      const ang = Math.atan2(n.y - s.y, n.x - s.x);
      const x = clamp(s.x + Math.cos(ang) * 40, 14, WORLD_W - 14), y = clamp(s.y + Math.sin(ang) * 40, 14, WORLD_H - 14);
      drawGlow('#ff3a3a', x, y, 22 + pulse * 8, 0.35 * pulse);
      ctx.fillStyle = `rgba(255,80,60,${0.5 + pulse * 0.5})`;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y);
    }
  }

  /* ── Floor effects: burning ground and ice patches ── */
  function drawFloorEffects() {
    for (const fe of G.floorEffects) {
      const fade = Math.min(1, fe.timer / 1.2);
      if (fe.type === 'lava') {
        drawGlow('#ff6a1a', fe.x, fe.y, CELL * 0.75, 0.5 * fade * (0.8 + 0.2 * Math.sin(G.animTime * 6 + fe.col)));
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = '#3a0e06';
        ctx.beginPath(); ctx.ellipse(fe.x, fe.y + 2, 12, 8, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#ff6a14';
        for (let i = 0; i < 4; ++i) {
          const a = i * 1.7 + fe.col;
          ctx.fillRect(Math.round(fe.x + Math.cos(a) * 6 - 2), Math.round(fe.y + Math.sin(a) * 4), 4, 2);
        }
        ctx.globalAlpha = 1;
      } else if (fe.type === 'ice') {
        ctx.globalAlpha = fade * 0.75;
        ctx.fillStyle = '#bfeaff';
        ctx.beginPath(); ctx.ellipse(fe.x, fe.y + 2, 13, 8, 0, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(fe.x - 6), Math.round(fe.y - 1), 6, 2);
        ctx.fillRect(Math.round(fe.x + 2), Math.round(fe.y + 4), 4, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawTraps() {
    for (const t of G.towers)
      if (TOWER_TYPES[t.type].trap)
        drawTowerSprite(t, t.x, t.y);
  }

  /* ── Towers and enemies, painted back to front ── */
  const actorList = [];
  function drawActors() {
    actorList.length = 0;
    for (const t of G.towers)
      if (!TOWER_TYPES[t.type].trap)
        actorList.push(t);
    for (const e of G.enemies)
      if (e.hp > 0)
        actorList.push(e);
    actorList.sort((a, b) => depthOf(a) - depthOf(b));
    // Flyers last: they pass over everything
    for (const a of actorList)
      if (typeof a.type === 'number') drawTower(a);
      else if (!ENEMY_TYPES[a.type].flying) drawEnemy(a);
    for (const a of actorList)
      if (typeof a.type !== 'number' && ENEMY_TYPES[a.type].flying) drawEnemy(a);
  }

  function depthOf(a) {
    return typeof a.type === 'number' ? a.y + 6 : a.y + a.radius * 0.5;
  }

  function drawTower(t) {
    // Build pop: grows in with a little overshoot; upgrades flash gold
    const age = t.bornAt !== undefined ? G.animTime - t.bornAt : 9;
    if (age < 0.4) {
      const k = age / 0.4;
      const s = 0.5 + 0.5 * (1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
      ctx.save();
      ctx.translate(t.x, t.y + CELL / 2);
      ctx.scale(s, s);
      ctx.translate(-t.x, -t.y - CELL / 2);
      drawTowerSprite(t, t.x, t.y);
      ctx.restore();
    } else
      drawTowerSprite(t, t.x, t.y);
    const up = t.upAt !== undefined ? G.animTime - t.upAt : 9;
    if (up < 0.6) {
      const k = 1 - up / 0.6;
      drawGlow('#ffd75a', t.x, t.y - 6, 26 + (1 - k) * 14, k * 0.8);
      ctx.fillStyle = `rgba(255,236,160,${k * 0.5})`;
      ctx.fillRect(t.x - 6 * k, t.y - 60, 12 * k, 64);
    }
    const s = towerStats(t);
    // Idle life
    if (s.kind === 'chain') {
      const m = muzzleOf(t);
      drawGlow('#7ae8ff', m.x, m.y, 10 + t.tier * 2, 0.35 + 0.15 * Math.sin(G.animTime * 7 + t.col));
      if ((Math.floor(G.animTime * 9 + t.col * 3) % 7) === 0) {
        ctx.strokeStyle = 'rgba(200,248,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        const a = (G.animTime * 13 + t.row) % TWO_PI;
        ctx.lineTo(m.x + Math.cos(a) * 5, m.y + Math.sin(a) * 5 - 2);
        ctx.lineTo(m.x + Math.cos(a + 0.6) * 9, m.y + Math.sin(a + 0.6) * 9);
        ctx.stroke();
      }
    } else if (s.kind === 'glob') {
      const m = muzzleOf(t);
      for (let i = 0; i < 2; ++i) {
        const ph = (G.animTime * 0.9 + i * 0.5 + t.col * 0.13) % 1;
        ctx.fillStyle = `rgba(150,255,110,${0.8 * (1 - ph)})`;
        ctx.fillRect(Math.round(m.x - 4 + i * 6), Math.round(m.y - 2 - ph * 10), 2, 2);
      }
    } else if (s.kind === 'flame' && !t.flameT) {
      const m = muzzleOf(t);
      drawGlow('#ff8a2a', m.x, m.y, 4 + Math.sin(G.animTime * 20 + t.col) * 1.5, 0.6);
    } else if (s.kind === 'beam') {
      const m = muzzleOf(t);
      drawGlow(TOWER_TYPES[t.type].color, m.x, m.y, 6 + (t.beamTargets.length ? 6 : 0), 0.5);
    } else if (s.kind === 'support') {
      const m = muzzleOf(t);
      const fl = Math.sin(G.animTime * 9 + t.col) * 1.5;
      drawGlow(t.branch === 1 && t.tier >= 4 ? '#7ab8ff' : '#ffc84a', m.x, m.y - 2, 9 + fl, 0.75);
      ctx.fillStyle = '#fff2b0';
      ctx.fillRect(Math.round(m.x - 1), Math.round(m.y - 4 + fl * 0.5), 2, 3);
      // Gentle ring showing the inspired area
      const r = s.rangePx * (0.92 + 0.08 * Math.sin(G.animTime * 2));
      ctx.strokeStyle = 'rgba(255,224,138,0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(t.x, t.y + 4, r, r * 0.75, 0, 0, TWO_PI); ctx.stroke();
    } else if (s.kind === 'gust') {
      // Turning windmill blades
      const m = muzzleOf(t);
      ctx.strokeStyle = t.tier >= 3 ? '#ffe08a' : '#e8e2d4';
      ctx.lineWidth = 2;
      const spin = G.animTime * (t.flash > 0 ? 18 : 5) + t.col;
      for (let i = 0; i < 4; ++i) {
        const a = spin + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + Math.cos(a) * (8 + t.tier), m.y + Math.sin(a) * (8 + t.tier) * 0.8);
        ctx.stroke();
      }
    } else if (s.kind === 'orb') {
      const m = muzzleOf(t);
      drawGlow('#e070ff', m.x, m.y + 4, 10 + t.tier * 1.5, 0.35 + 0.15 * Math.sin(G.animTime * 3 + t.col));
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 2 + i * 2.1;
        ctx.fillStyle = '#f0b8ff';
        ctx.fillRect(Math.round(m.x + Math.cos(a) * 9), Math.round(m.y + 4 + Math.sin(a) * 3), 2, 2);
      }
    } else if (s.kind === 'skybolt') {
      const m = muzzleOf(t);
      drawGlow('#b8a0ff', m.x, m.y, 7 + t.tier, 0.4 + 0.2 * Math.sin(G.animTime * 6 + t.row));
    } else if (s.kind === 'bolt' && s.aura) {
      const m = muzzleOf(t);
      ctx.strokeStyle = 'rgba(220,245,255,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 2 + i * 2.1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(m.x + Math.cos(a) * 12), Math.round(m.y + Math.sin(a) * 5 - 2), 2, 2);
      }
    }
    // Jammed by a saboteur or a war cry: crackling static
    if (t.jamT > 0) {
      ctx.strokeStyle = `rgba(122,255,200,${0.5 + 0.4 * Math.sin(G.animTime * 40)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 17 + i * 2.1;
        ctx.moveTo(t.x + Math.cos(a) * 6, t.y - 14 + Math.sin(a) * 4);
        ctx.lineTo(t.x + Math.cos(a + 1) * 11, t.y - 18 + Math.sin(a * 1.3) * 6);
      }
      ctx.stroke();
    }
    // Muzzle flash
    if (t.flash > 0) {
      const m = muzzleOf(t);
      const col = s.kind === 'bolt' ? '#bfeaff' : s.kind === 'snipe' ? '#ffffff' : s.kind === 'chain' ? '#bff4ff' : '#ffd28a';
      drawGlow(col, m.x, m.y, 10 + t.flash * 60, Math.min(1, t.flash * 9));
    }
    // Structure bar when damaged
    if (t.hp < t.maxHp) {
      const w = 22, x = t.x - w / 2, y = t.y + CELL / 2 - 2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      const r = t.hp / t.maxHp;
      ctx.fillStyle = r > 0.5 ? '#6fe08a' : r > 0.25 ? '#ffb648' : '#ff5a5a';
      ctx.fillRect(x, y, w * r, 2);
    }
  }

  function drawEnemy(e) {
    const def = ENEMY_TYPES[e.type];
    if (e.burrowT > 0) {
      // Only a travelling mound of earth shows where it digs
      const r = e.radius * 1.1;
      ctx.fillStyle = '#4a3418';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, r, r * 0.45, 0, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#8a6a40';
      for (let i = 0; i < 4; ++i) {
        const a = G.animTime * 9 + i * 1.6 + e.walk;
        ctx.fillRect(Math.round(e.x + Math.cos(a) * r * 0.6 - 1.5), Math.round(e.y + 1 + Math.sin(a) * 2), 3, 3);
      }
      return;
    }
    const img = enemyFrame(e);
    const sc = enemyScale(e) * (def.boss ? 1 : 1);
    if (Math.abs(Math.cos(e.angle)) > 0.2) e.face = Math.cos(e.angle) < 0 ? -1 : 1;
    const flip = e.face === -1;
    const lift = def.flying ? 12 + Math.sin(G.animTime * 3 + e.walk) * 2 : 0;
    const spawnA = Math.min(1, e.spawnT * 3);
    let alpha = spawnA;
    if (def.stealth && !e.revealed) alpha *= 0.28 + 0.1 * Math.sin(G.animTime * 5 + e.walk);
    const bottom = e.y + e.radius * 0.7 - lift;
    drawShadow(e.x, e.y + e.radius * 0.6, e.radius * 1.1, e.radius * 0.45, def.flying ? 0.45 : 0.8);
    if (e.elite) drawGlow('#ffd75a', e.x, bottom - img.height * AP * sc * 0.45, e.radius * 2.2, 0.28 + 0.1 * Math.sin(G.animTime * 4));
    if (def.boss) drawGlow(def.color, e.x, bottom - img.height * AP * sc * 0.45, e.radius * 2.6, 0.22);
    // Frozen enemies stop moving and turn icy
    blitArt(img, e.x, bottom, flip, alpha, sc);
    if (e.hitFlash > 0)
      blitArt(flashOf(img), e.x, bottom, flip, alpha * Math.min(1, e.hitFlash * 12), sc);
    const topY = bottom - img.height * AP * sc;
    if (e.freezeTimer > 0) {
      ctx.globalAlpha = 0.55 * alpha;
      ctx.fillStyle = '#bfeaff';
      ctx.fillRect(Math.round(e.x - e.radius - 2), Math.round(topY + 2), Math.round(e.radius * 2 + 4), Math.round(bottom - topY - 2));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(e.x - e.radius), Math.round(topY + 4), 3, Math.round((bottom - topY) * 0.6));
      ctx.globalAlpha = 1;
    } else if (e.slowTimer > 0 && e.slowMul < 1) {
      ctx.globalAlpha = 0.25 * alpha;
      blitArt(img, e.x, bottom, flip, 1, sc);
      ctx.globalAlpha = alpha;
      if (Math.floor(G.animTime * 8 + e.walk) % 3 === 0) {
        ctx.fillStyle = '#e6f8ff';
        ctx.fillRect(Math.round(e.x + Math.sin(e.walk * 3) * e.radius), Math.round(topY + (G.animTime * 20 + e.walk * 7) % (bottom - topY)), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (e.burnTimer > 0) {
      for (let i = 0; i < 2; ++i) {
        const ph = (G.animTime * 3 + i * 0.5 + e.walk) % 1;
        ctx.fillStyle = ph < 0.5 ? '#ffe48a' : '#ff6a14';
        ctx.fillRect(Math.round(e.x - 4 + i * 6 + Math.sin(ph * 6) * 2), Math.round(bottom - (bottom - topY) * (0.3 + ph * 0.8)), 2, 3);
      }
    }
    if (e.poisonTimer > 0 || e.acidTimer > 0) {
      const ph = (G.animTime * 1.5 + e.walk) % 1;
      ctx.fillStyle = e.acidTimer > 0 ? 'rgba(220,255,80,0.9)' : 'rgba(120,255,90,0.9)';
      ctx.fillRect(Math.round(e.x + 3), Math.round(topY + 2 - ph * 6), 2, 2);
    }
    if (e.stunTimer > 0) {
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 8 + i * 2.1;
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(Math.round(e.x + Math.cos(a) * 7 - 1), Math.round(topY - 2 + Math.sin(a) * 2), 2, 2);
      }
    }
    if (e.shieldHp > 0) {
      const r = e.radius + 5;
      ctx.strokeStyle = `rgba(110,220,255,${0.35 + 0.4 * (e.shieldHp / Math.max(1, e.shieldMax))})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(e.x, bottom - (bottom - topY) / 2, r, (bottom - topY) / 2 + 3, 0, 0, TWO_PI);
      ctx.stroke();
      drawGlow('#5ad8ff', e.x, bottom - (bottom - topY) / 2, r * 1.3, 0.12);
    }
    if (e.elite)
      drawCrown(e.x, topY - 3);
    // Health bar
    if (e.hp < e.maxHp || e.shieldHp > 0 || def.boss || e.elite) {
      const w = Math.max(16, e.radius * 2.4), x = Math.round(e.x - w / 2), y = Math.round(topY - (e.elite ? 10 : 5));
      ctx.fillStyle = 'rgba(10,6,12,0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      const r = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = r > 0.5 ? '#6fe08a' : r > 0.25 ? '#ffb648' : '#ff4a4a';
      ctx.fillRect(x, y, w * r, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y, w * r, 1);
      if (e.shieldHp > 0) {
        ctx.fillStyle = '#7ad8ff';
        ctx.fillRect(x, y + 3, w * clamp(e.shieldHp / Math.max(1, e.shieldMax), 0, 1), 1);
      }
      if (e.armor > e.shred) {
        ctx.fillStyle = '#c4ccdc';
        ctx.fillRect(x - 4, y - 1, 3, 4);
        ctx.fillStyle = '#5a6478';
        ctx.fillRect(x - 3, y + 2, 1, 1);
      }
    }
  }

  function drawCrown(x, y) {
    ctx.fillStyle = '#ffd75a';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x - 2, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y); ctx.lineTo(x + 5, y - 3); ctx.lineTo(x + 5, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8303a';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
  }

  /* ── Dying enemies: flash, squash and fade ── */
  function addCorpse(e) {
    const def = ENEMY_TYPES[e.type];
    corpses.push({ img: null, type: e.type, walk: e.walk, x: e.x, y: e.y + e.radius * 0.7 - (def.flying ? 12 : 0), flip: e.face === -1, sc: enemyScale(e), t: 0, life: def.boss ? 1.2 : 0.45, flying: !!def.flying });
    if (corpses.length > 60) corpses.shift();
  }

  function drawCorpses() {
    for (let i = corpses.length - 1; i >= 0; --i) {
      const c = corpses[i];
      c.t += G.frameDt * (G.state === STATE_PLAYING ? G.gameSpeed : 1);
      const k = c.t / c.life;
      if (k >= 1) {
        corpses.splice(i, 1);
        continue;
      }
      if (!c.img) c.img = enemyFrame(c);
      ctx.save();
      ctx.translate(c.x, c.y + (c.flying ? k * 12 : 0));
      ctx.scale(1 + k * 0.3, 1 - k * 0.8);
      blitArt(k < 0.25 ? flashOf(c.img) : c.img, 0, 0, c.flip, 1 - k, c.sc);
      ctx.restore();
    }
  }

  /* ── Shots ── */
  function drawProjectiles() {
    ctx.lineCap = 'round';
    for (const p of G.projectiles) {
      if (p.trail && p.trail.length > 3) {
        ctx.strokeStyle = p.kind === 'bolt' ? 'rgba(190,240,255,0.45)' : 'rgba(255,240,200,0.35)';
        ctx.lineWidth = p.kind === 'bolt' ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(p.trail[0], p.trail[1]);
        for (let i = 2; i < p.trail.length; i += 2)
          ctx.lineTo(p.trail[i], p.trail[i + 1]);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const z = p.z || 0;
      if (p.kind === 'shell' || p.kind === 'glob' || p.kind === 'bomblet' || p.kind === 'airbomb') {
        if (p.t < 0) continue;
        drawShadow(p.x, p.y + 2, 4, 2, 0.6);
        if (p.kind === 'glob') {
          drawGlow('#7ce35a', p.x, p.y - z, 9, 0.5);
          ctx.fillStyle = '#7ce35a';
          ctx.beginPath(); ctx.arc(p.x, p.y - z, 3.5, 0, TWO_PI); ctx.fill();
          ctx.fillStyle = '#d4ffb0';
          ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - z - 2), 2, 2);
        } else {
          const r = p.kind === 'bomblet' ? 2.2 : p.kind === 'airbomb' ? 5 : 4;
          ctx.fillStyle = '#1a1a20';
          ctx.beginPath(); ctx.arc(p.x, p.y - z, r, 0, TWO_PI); ctx.fill();
          ctx.fillStyle = '#6a6a78';
          ctx.fillRect(Math.round(p.x - r * 0.6), Math.round(p.y - z - r * 0.6), 2, 2);
          if (p.kind === 'shell') drawGlow('#ffb36a', p.x, p.y - z, 5, 0.4);
        }
        continue;
      }
      if (p.kind === 'arrow') {
        const t = p.target;
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        ctx.strokeStyle = '#d8b07a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = '#e8eef8';
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2);
        continue;
      }
      if (p.kind === 'bolt') {
        drawGlow('#9ae4ff', p.x, p.y, 8, 0.7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x - 1.5), Math.round(p.y - 1.5), 3, 3);
      } else if (p.kind === 'missile') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillStyle = '#d8d8e0';
        ctx.fillRect(-4, -1.5, 7, 3);
        ctx.fillStyle = '#ff4a3a';
        ctx.fillRect(3, -1.5, 2, 3);
        ctx.restore();
        drawGlow('#ffb050', p.x - Math.cos(a) * 5, p.y - Math.sin(a) * 5, 6, 0.8);
      } else if (p.kind === 'orb') {
        drawGlow('#e070ff', p.x, p.y, 10, 0.8);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TWO_PI); ctx.fill();
        const ph = G.animTime * 10;
        ctx.fillStyle = '#f0b8ff';
        ctx.fillRect(Math.round(p.x + Math.cos(ph) * 5), Math.round(p.y + Math.sin(ph) * 5), 2, 2);
      }
    }
    ctx.lineCap = 'butt';
  }

  function drawClouds() {
    for (const c of G.clouds) {
      const a = Math.min(1, c.t * 4, (c.life - c.t) * 2);
      const col = c.acid ? '#c8ff4a' : '#7ce35a';
      drawGlow(col, c.x, c.y, c.r * 1.25, 0.32 * a);
      for (let i = 0; i < 5; ++i) {
        const ang = c.seed + i * 1.26 + G.animTime * 0.6;
        const rr = c.r * (0.35 + 0.3 * ((i * 37) % 10) / 10);
        const bx = c.x + Math.cos(ang) * rr, by = c.y + Math.sin(ang) * rr * 0.6;
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = i % 2 ? col : (c.acid ? '#eaff9a' : '#b4ff8a');
        ctx.beginPath(); ctx.arc(bx, by, c.r * 0.28, 0, TWO_PI); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFxLines() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of G.fxLines) {
      const k = 1 - f.t / f.life;
      if (f.kind === 'ring') {
        ctx.strokeStyle = hexToRgba(f.color, k * 0.7);
        ctx.lineWidth = 2 + k * 2;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (1 - k * 0.6), f.r * (1 - k * 0.6) * 0.75, 0, 0, TWO_PI);
        ctx.stroke();
        continue;
      }
      const pts = f.pts;
      if (f.kind === 'gust') {
        // Curved wind streaks sweeping out of the tower
        ctx.strokeStyle = `rgba(232,255,248,${k * 0.7})`;
        ctx.lineWidth = 1.5;
        const reach = f.r * (1.15 - k * 0.6);
        for (let i = -2; i <= 2; ++i) {
          const a = f.a + i * f.cone * 0.4;
          ctx.beginPath();
          ctx.arc(f.x, f.y, reach * (0.55 + Math.abs(i) * 0.1), a - 0.25, a + 0.25);
          ctx.stroke();
        }
        continue;
      }
      if (f.kind === 'zap' || f.kind === 'sky') {
        // Jagged bolt: wide translucent glow pass, then a bright core
        const jag = [];
        for (let i = 1; i < pts.length; ++i) {
          const a = pts[i - 1], b = pts[i];
          const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 16));
          for (let s = 0; s <= n; ++s) {
            const tt = s / n;
            const off = s === 0 || s === n ? 0 : Math.sin(f.seed + i * 13.7 + s * 5.3 + f.t * 90) * (f.kind === 'sky' ? 9 : 6);
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            jag.push(a.x + dx * tt - dy / L * off, a.y + dy * tt + dx / L * off);
          }
        }
        for (let pass = 0; pass < 2; ++pass) {
          ctx.strokeStyle = pass ? `rgba(255,255,255,${k})` : `rgba(120,220,255,${k * 0.45})`;
          ctx.lineWidth = pass ? 1.4 : 5;
          ctx.beginPath();
          ctx.moveTo(jag[0], jag[1]);
          for (let i = 2; i < jag.length; i += 2) ctx.lineTo(jag[i], jag[i + 1]);
          ctx.stroke();
        }
        for (let i = 1; i < pts.length; ++i) drawGlow('#7ae8ff', pts[i].x, pts[i].y, 10, k * 0.6);
        continue;
      }
      // Tracers
      for (let pass = 0; pass < 2; ++pass) {
        ctx.strokeStyle = pass ? `rgba(255,255,255,${k})` : hexToRgba(f.color, k * 0.5);
        ctx.lineWidth = pass ? 1 : (f.w || 2) * 2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      }
    }
    // Beams and flames come straight from the towers
    for (const t of G.towers) {
      const s = towerStats(t);
      if (s.kind === 'beam' && t.beamTargets.length && G.state === STATE_PLAYING) {
        const heat = Math.min(1, t.beamTime / s.rampTime);
        const m = muzzleOf(t);
        const col = t.branch === 1 && t.tier >= 4 ? '#ffc84a' : TOWER_TYPES[t.type].color;
        for (const e of t.beamTargets) {
          if (e.hp <= 0) continue;
          const wob = Math.sin(G.animTime * 40) * 0.6;
          ctx.strokeStyle = hexToRgba(col, 0.3 + heat * 0.25);
          ctx.lineWidth = 4 + heat * 4 + wob;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(e.x, e.y - e.radius * 0.6); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 + heat * 1.5;
          ctx.stroke();
          drawGlow(col, e.x, e.y - e.radius * 0.6, 8 + heat * 8, 0.8);
        }
      }
      if (s.kind === 'flame' && t.flameT > 0) {
        const m = muzzleOf(t);
        const k = t.flameT / 0.25;
        for (let i = 0; i < 7; ++i) {
          const d = (i / 6) * s.rangePx * (0.9 + 0.1 * Math.sin(G.animTime * 30 + i));
          const spread = Math.sin(s.cone) * d * 0.8;
          const off = Math.sin(G.animTime * 37 + i * 2.3) * spread * 0.6;
          const x = m.x + Math.cos(t.angle) * d - Math.sin(t.angle) * off;
          const y = m.y + Math.sin(t.angle) * d + Math.cos(t.angle) * off;
          const col = i < 2 ? '#fff2a8' : i < 4 ? '#ffa63a' : '#ff5a14';
          drawGlow(col, x, y, 6 + i * 2.2, 0.55 * k);
        }
      }
    }
    ctx.lineCap = 'butt';
  }

  NS.battlefield = { corpses, drawWorld, addCorpse };

})();
