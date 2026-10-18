;(function() {
  'use strict';

  // Artifacts: unique finds from secret chests, kept for the whole run, and their effects.
  // Owns: NS.artifacts and these state fields:
  //   G.artifacts, G.artifactState, G.stormArcs
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, rules, animation, time, bombs, cargo,
  //   chests, upgradeTree, hud
  // Reads state of: gameState, bombs, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND } = NS.constants;
  const { makeRng, hexToRgba } = NS.util;
  const { ctx, particles, floatingText } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath } = NS.panels;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { applyDamageToEnemy } = NS.animation;
  const { announce } = NS.time;
  const { bombCount, bombCapacity } = NS.bombs;
  const { attractPiles } = NS.cargo;
  const { chestSeed, revealChestsNear, grantChestTreasure } = NS.chests;

  /* ======================================================================
     ARTIFACTS -- unique finds from secret chests, kept for the whole run
     ====================================================================== */

  const ARTIFACTS = [
    { id: 'twinDrill', name: 'Twin Drill', icon: 'artTwinDrill', color: '#ffb040', desc: 'Every dig also breaks the block beside it: tunnels come out two blocks wide' },
    { id: 'quakeHammer', name: 'Quake Hammer', icon: 'artQuake', color: '#e0a070', desc: 'Every dig cracks the eight blocks around it, so the next digs go much faster' },
    { id: 'midasLens', name: 'Midas Lens', icon: 'artMidas', color: '#ffd700', desc: 'One in four ores you dig comes out doubled' },
    { id: 'lodestone', name: 'Lodestone', icon: 'artLodestone', color: '#ff7a7a', desc: 'Loose ore within 4 tiles flies to the keeper' },
    { id: 'sunLamp', name: 'Sunstone Lamp', icon: 'artSunLamp', color: '#fff0a0', desc: 'The lamp shines 60% further and ore within 5 tiles glows through the rock' },
    { id: 'stormCoil', name: 'Storm Coil', icon: 'artStormCoil', color: '#7ad8ff', desc: 'A lightning coil on the dome zaps a monster every 1.5 s and arcs on to 3 more' },
    { id: 'aegisHeart', name: 'Aegis Heart', icon: 'artAegis', color: '#6cc8ff', desc: 'A regenerating shield over the dome soaks up hits: 40 plus a tenth of the dome' },
    { id: 'chronoGlass', name: 'Chronoglass', icon: 'artChrono', color: '#a0c0ff', desc: 'A heavy hit on the dome slows the monsters to a crawl for 4 s (every 20 s)' },
    { id: 'bombCharm', name: 'Bombsmith Charm', icon: 'artBombCharm', color: '#ff9a40', desc: 'Every dawn brings a free Bomb, every third dawn a Big Bomb as well' },
    { id: 'hiveLink', name: 'Hive Link', icon: 'artHive', color: '#d8b8ff', desc: 'Drones carry twice as much and fly 25% faster' },
    { id: 'warpAnchor', name: 'Warp Anchor', icon: 'artWarp', color: '#c890ff', desc: 'Teleport home with 5 at any time, without cooldown' },
    { id: 'hunterEye', name: "Hunter's Eye", icon: 'artEye', color: '#ff6a5a', desc: '+20% chance for every turret shot to be a critical hit' },
    { id: 'owlSight', name: 'Owl Sight', icon: 'artOwl', color: '#80ffb0', desc: 'Monsters glow in the dark, burrowers show under ground and blizzards hide nothing' },
    { id: 'alchemist', name: "Alchemist's Stone", icon: 'artAlchemist', color: '#60e0a0', desc: 'Ore brought home also scores: 2 points per unit' },
    { id: 'dowsingRod', name: 'Dowsing Rod', icon: 'artDowsing', color: '#e0a0ff', desc: 'Arrows point to every hidden chest; chests within 8 tiles reveal themselves' },
    { id: 'phoenixFeather', name: 'Phoenix Feather', icon: 'artPhoenix', color: '#ff8a40', desc: 'Once per site the dome rises from destruction with half its HP' }
  ];
  const ARTIFACT_BY_ID = {};
  for (const a of ARTIFACTS)
    ARTIFACT_BY_ID[a.id] = a;

  G.artifacts = [];                // ids found this run, in order
  let artifactSet = new Set();       // the same ids for quick lookups
  let artifactSetSrc = null, artifactSetLen = -1;
  G.artifactState = newArtifactState();
  G.stormArcs = [];                // Storm Coil lightning: { pts, life }

  function newArtifactState() {
    return { aegis: 0, aegisDelay: 0, chronoCd: 0, timeSlow: 0, charmDawns: 0, phoenixUsed: false, stormT: 1 };
  }

  function hasArtifact(id) {
    // Rebuilt whenever the list is replaced or grows
    if (artifactSetSrc !== G.artifacts || artifactSetLen !== G.artifacts.length) {
      artifactSet = new Set(G.artifacts);
      artifactSetSrc = G.artifacts;
      artifactSetLen = G.artifacts.length;
    }
    return artifactSet.has(id);
  }

  function aegisMax() {
    return Math.round(40 + 0.1 * G.maxDomeHP);
  }

  // A chest holds an artifact not found yet (seeded per site and chest); once all are found, treasure
  function grantChestReward(ch) {
    const left = ARTIFACTS.filter(a => !hasArtifact(a.id));
    if (!left.length)
      return grantChestTreasure(ch);
    const rng = makeRng(chestSeed() ^ ((ch.band + 1) * 40503) ^ (G.artifacts.length * 7919));
    const a = left[Math.floor(rng() * left.length)];
    G.artifacts.push(a.id);
    if (a.id === 'aegisHeart')
      G.artifactState.aegis = aegisMax();
    const pts = 200 * (ch.band + 1) * (G.site.index + 1);
    G.score += pts;
    return { artifact: a.id, icon: a.icon, title: a.name, text: a.desc, color: a.color };
  }

  // Artifact icon with a pulsing halo and turning light rays
  function drawArtifactIcon(id, x, y, size, alpha) {
    const a = ARTIFACT_BY_ID[id];
    if (!a) return;
    const k = alpha === undefined ? 1 : alpha;
    const pulse = 0.75 + Math.sin(G.animTime * 3 + x * 0.05) * 0.25;
    drawGlow(a.color, x, y, size * 0.95, 0.65 * pulse * k);
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba(a.color, 0.45 * pulse);
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; ++i) {
      const ang = G.animTime * 0.8 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * size * 0.35, y + Math.sin(ang) * size * 0.35);
      ctx.lineTo(x + Math.cos(ang) * size * 0.72, y + Math.sin(ang) * size * 0.72);
      ctx.stroke();
    }
    ctx.restore();
    drawSprite(a.icon, x, y, size * 0.78, k);
  }

  // Ongoing artifact effects (mine magnet, dowsing, storm coil, aegis, chronoglass)
  function updateArtifacts(dt) {
    const st = G.artifactState;
    if (st.chronoCd > 0) st.chronoCd = Math.max(0, st.chronoCd - dt);
    if (st.timeSlow > 0) st.timeSlow = Math.max(0, st.timeSlow - dt);
    // Aegis Heart recharges a while after the last hit
    if (hasArtifact('aegisHeart')) {
      if (st.aegisDelay > 0) st.aegisDelay -= dt;
      else st.aegis = Math.min(aegisMax(), st.aegis + 6 * dt);
    }
    // Lodestone pulls loose ore to the keeper
    if (hasArtifact('lodestone') && G.currentView === VIEW_UNDERGROUND)
      attractPiles(4);
    // Dowsing Rod: chests close by give themselves away
    if (hasArtifact('dowsingRod') && G.currentView === VIEW_UNDERGROUND)
      revealChestsNear(G.drillY, G.drillX, 8, true);
    // Storm Coil: lightning from the dome
    for (let i = G.stormArcs.length - 1; i >= 0; --i) {
      G.stormArcs[i].life -= dt;
      if (G.stormArcs[i].life <= 0) G.stormArcs.splice(i, 1);
    }
    if (hasArtifact('stormCoil') && G.enemies.length) {
      st.stormT -= dt;
      if (st.stormT <= 0) {
        const cx = STORM_COIL.x, cy = STORM_COIL.y - 20;
        let target = null, best = 700 * 700;
        for (const e of G.enemies) {
          if (e.hidden) continue;
          const d = (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy);
          if (d < best) {
            best = d;
            target = e;
          }
        }
        if (target) {
          st.stormT = 1.5;
          const dmg = Math.max(8, G.weaponDamage * 0.8);
          applyDamageToEnemy(target, Math.ceil(dmg));
          target.stunTimer = Math.max(target.stunTimer || 0, 0.25);
          G.stormArcs.push({ x0: cx, y0: cy, x1: target.x, y1: target.y, life: 0.3 });
          let from = target;
          const hit = [target];
          for (let n = 0; n < 3; ++n) {
            let next = null, nd = 220 * 220;
            for (const e of G.enemies) {
              if (e.hidden || hit.includes(e)) continue;
              const d = (e.x - from.x) * (e.x - from.x) + (e.y - from.y) * (e.y - from.y);
              if (d < nd) {
                nd = d;
                next = e;
              }
            }
            if (!next) break;
            applyDamageToEnemy(next, Math.ceil(dmg * 0.6));
            G.stormArcs.push({ x0: from.x, y0: from.y, x1: next.x, y1: next.y, life: 0.25 });
            hit.push(next);
            from = next;
          }
          if (G.currentView === VIEW_SURFACE) {
            SZ.GameAudio.play('zap', { pitch: 0.8 + Math.random() * 0.3, volume: 0.6 });
            particles.burst(target.x, target.y, 8, { color: '#bff0ff', speed: 2.5, life: 0.3 });
          }
        } else
          st.stormT = 0.3;
      }
    }
  }

  // Score for ore brought home (Alchemist's Stone)
  function depositScore(amount, x, y) {
    if (!hasArtifact('alchemist') || amount <= 0) return;
    const pts = amount * 2;
    G.score += pts;
    floatingText.add(x, y, `Alchemy +${pts} points`, { color: '#60e0a0', font: 'bold 22px sans-serif' });
  }

  // Dawn gifts of the Bombsmith Charm
  function artifactDawn() {
    if (!hasArtifact('bombCharm')) return;
    ++G.artifactState.charmDawns;
    const gifts = [1];
    if (G.artifactState.charmDawns % 3 === 0) gifts.push(2);
    let given = 0;
    for (const t of gifts)
      if (bombCount() < bombCapacity()) {
        ++G.bombInv[t];
        ++given;
      }
    if (given)
      announce('Bombsmith Charm', gifts.length > 1 ? 'A Bomb and a Big Bomb appeared in the workshop' : 'A Bomb appeared in the workshop', '#ff9a40', 'artBombCharm');
  }

  const STORM_COIL = { x: DOME_X - 52, y: DOME_Y - 84 };

  // Artifact visuals on the surface: storm coil and its arcs, aegis bubble, time slow
  function drawSurfaceArtifacts() {
    if (hasArtifact('stormCoil')) {
      const { x, y } = STORM_COIL;
      drawGlow('#7ad8ff', x, y - 16, 26, 0.5 + Math.sin(G.animTime * 6) * 0.2);
      drawSprite('artStormCoil', x, y - 10, 30);
      if (Math.random() < 0.08)
        SZ.GameEffects.drawElectricArc(ctx, x, y - 26, x + (Math.random() - 0.5) * 30, y - 40 - Math.random() * 14, { segments: 4, jitter: 6, color: 'rgba(220,250,255,0.9)', glowColor: 'rgba(120,210,255,0.6)', width: 1.5, glowWidth: 5 });
    }
    for (const a of G.stormArcs) {
      const k = Math.min(1, a.life * 4);
      SZ.GameEffects.drawElectricArc(ctx, a.x0, a.y0, a.x1, a.y1, { segments: 9, jitter: 16, color: `rgba(230,250,255,${k})`, glowColor: `rgba(110,200,255,${k * 0.8})`, width: 2.5, glowWidth: 10 });
      drawGlow('#bff0ff', a.x1, a.y1, 30, k);
    }
    if (hasArtifact('aegisHeart') && G.artifactState.aegis > 0) {
      const r = G.artifactState.aegis / aegisMax();
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 28, Math.PI, 0);
      ctx.strokeStyle = `rgba(120,210,255,${0.25 + 0.45 * r})`;
      ctx.lineWidth = 3 + 4 * r;
      ctx.shadowColor = '#6cc8ff';
      ctx.shadowBlur = 14;
      ctx.setLineDash([16, 8]);
      ctx.lineDashOffset = -G.animTime * 18;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTimeSlowTint() {
    const t = G.artifactState.timeSlow;
    if (t <= 0) return;
    const a = Math.min(1, t) * 0.18;
    ctx.fillStyle = `rgba(110,150,255,${a})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.strokeStyle = `rgba(190,210,255,${a * 2})`;
    ctx.lineWidth = 3;
    const r = ((G.animTime * 260) % 900);
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, r, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Row of found artifact icons; returns the drawn width
  function drawArtifactStrip(x, y, maxW, size) {
    const step = size + 6;
    const fit = Math.max(1, Math.floor((maxW + 6) / step));
    const shown = G.artifacts.length > fit ? G.artifacts.slice(0, fit - 1) : G.artifacts;
    shown.forEach((id, i) => drawArtifactIcon(id, x + size / 2 + i * step, y, size));
    if (shown.length < G.artifacts.length) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(`+${G.artifacts.length - shown.length}`, x + size / 2 + shown.length * step, y + 1, size + 4, 14, { weight: 'bold', color: UI.text });
    }
  }

  /* -- Artifact gallery (a tab of the upgrade tree) -- */
  function artifactCards() {
    const cols = 4, gap = 18, top = NS.upgradeTree.TREE_VIEW.y + 54;
    const w = Math.floor((CANVAS_W - 64 - gap * (cols - 1)) / cols);
    const h = Math.floor((NS.upgradeTree.TREE_VIEW.y + NS.upgradeTree.TREE_VIEW.h - 14 - top - gap * 3) / 4);
    return ARTIFACTS.map((a, i) => ({ a, x: 32 + (i % cols) * (w + gap), y: top + Math.floor(i / cols) * (h + gap), w, h }));
  }

  function drawArtifactGallery() {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(`Artifacts found: ${G.artifacts.length} / ${ARTIFACTS.length}`, 34, NS.upgradeTree.TREE_VIEW.y + 24, 420, 22, { weight: 'bold', color: '#e0b0ff' });
    ctx.textAlign = 'right';
    fitText('Each mine hides three secret chests. Beat their lock to claim an artifact - they stay with you on every site.', CANVAS_W - 34, NS.upgradeTree.TREE_VIEW.y + 24, CANVAS_W - 500, 15, { color: UI.textDim });
    for (const card of artifactCards()) {
      const found = hasArtifact(card.a.id);
      ctx.save();
      NS.hud.drawNodeFrame(card.x, card.y, card.w, card.h, card.a.color, found ? 'owned' : 'locked', false);
      const ix = card.x + 14, iy = card.y + card.h / 2;
      roundRectPath(ix, iy - 36, 72, 72, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      if (found)
        drawArtifactIcon(card.a.id, ix + 36, iy, 64);
      else {
        drawSprite('chest', ix + 36, iy, 40, 0.3);
        ctx.textAlign = 'center';
        fitText('?', ix + 36, iy + 2, 40, 30, { weight: 'bold', color: 'rgba(220,200,255,0.6)' });
      }
      const tx = ix + 86, tw = card.x + card.w - 12 - tx;
      ctx.textAlign = 'left';
      fitText(found ? card.a.name : 'Undiscovered', tx, card.y + 26, tw, 19, { weight: 'bold', color: found ? '#ffffff' : '#7a8298' });
      drawTextBlock(found ? card.a.desc : 'Hidden in a secret chest somewhere in the mines', tx, card.y + 42, tw, card.h - 52, 15, { color: found ? '#c8d2e6' : UI.textMute, minPx: 11, lineGap: 1.25 });
      ctx.restore();
    }
  }

  NS.artifacts = { ARTIFACTS, ARTIFACT_BY_ID, newArtifactState, hasArtifact, aegisMax, grantChestReward,
    drawArtifactIcon, updateArtifacts, depositScore, artifactDawn, drawSurfaceArtifacts, drawTimeSlowTint,
    drawArtifactStrip, drawArtifactGallery };
})();
