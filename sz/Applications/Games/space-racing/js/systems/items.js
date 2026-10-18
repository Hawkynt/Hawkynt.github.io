/*
 * Item boxes and combat: rolls, AI item use, missiles, mines, EMP shockwaves,
 * shields, turbo and hits. Owns G.projectiles / G.mines / G.shockwaves and the held items.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { TWO_PI, STATE_PLAYING, ITEM_BOX_RADIUS, ITEM_BOX_RESPAWN, ITEM_NAMES, ITEM_LABELS,
    ITEM_WEIGHTS, MISSILE_HIT, MISSILE_LIFE, MISSILE_SPEED, MISSILE_TURN, MINE_ARM_TIME, MINE_LIFE,
    MINE_RADIUS, EMP_RADIUS, SHIELD_TIME } = NS.constants;
  const { particles, screenShake, floatingText } = NS.runtime;
  const { treeLevel } = NS.progress;

  /* Boxes, items and their effects only live while a race is under way */
  function racingActive() {
    return G.state === STATE_PLAYING && !G.raceFinished;
  }

  /* Place of any racer: 1 plus the number of racers further along the track */
  function racerPlace(racer) {
    let place = 1;
    for (let i = 0; i < G.opponents.length; ++i) {
      const other = G.opponents[i];
      if (other !== racer && other.ts.dist > racer.ts.dist)
        ++place;
    }
    if (racer !== G.ship && G.ship.ts.dist > racer.ts.dist)
      ++place;
    return place;
  }

  /* The further back a racer sits, the more the roll favors weapons */
  function rollItem(place) {
    let total = 0;
    for (let i = 0; i < ITEM_NAMES.length; ++i) {
      const w = ITEM_WEIGHTS[ITEM_NAMES[i]];
      total += w[Math.min(w.length - 1, Math.max(0, place - 1))];
    }
    let roll = Math.random() * total;
    for (let i = 0; i < ITEM_NAMES.length; ++i) {
      const w = ITEM_WEIGHTS[ITEM_NAMES[i]];
      roll -= w[Math.min(w.length - 1, Math.max(0, place - 1))];
      if (roll < 0)
        return ITEM_NAMES[i];
    }
    return ITEM_NAMES[ITEM_NAMES.length - 1];
  }

  /* True if some other racer sits between gapFrom and gapTo track units away */
  function racerInGap(racer, gapFrom, gapTo) {
    for (let i = 0; i < G.opponents.length; ++i) {
      const other = G.opponents[i];
      if (other === racer) continue;
      const gap = other.ts.dist - racer.ts.dist;
      if (gap >= gapFrom && gap <= gapTo)
        return true;
    }
    if (racer === G.ship) return false;
    const gap = G.ship.ts.dist - racer.ts.dist;
    return gap >= gapFrom && gap <= gapTo;
  }

  /* Closest racer ahead along the track -- what a homing missile chases */
  function nearestAhead(racer) {
    let best = null, bestGap = Infinity;
    for (let i = 0; i < G.opponents.length; ++i) {
      const other = G.opponents[i];
      if (other === racer || other.finished) continue;
      const gap = other.ts.dist - racer.ts.dist;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
    if (racer !== G.ship) {
      const gap = G.ship.ts.dist - racer.ts.dist;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = G.ship;
      }
    }
    return best;
  }

  /* Grab: the player first, then the AI, one box per frame */
  function updateItemBoxes(dt) {
    const reachSq = ITEM_BOX_RADIUS * ITEM_BOX_RADIUS;
    for (let i = 0; i < G.raceItemBoxes.length; ++i) {
      const box = G.raceItemBoxes[i];
      if (box.respawn > 0) {
        box.respawn -= dt;
        continue;
      }
      const freeSlot = !G.playerItem || (treeLevel('a_rack') > 0 && !G.playerItem2);
      if (freeSlot && (box.x - G.ship.x) * (box.x - G.ship.x) + (box.y - G.ship.y) * (box.y - G.ship.y) < reachSq) {
        const item = rollItem(Math.min(4, G.playerPlace + treeLevel('a_luck')));
        if (!G.playerItem)
          G.playerItem = item;
        else
          G.playerItem2 = item;
        box.respawn = ITEM_BOX_RESPAWN;
        SZ.GameAudio.play('pickup');
        floatingText.add(G.ship.x, G.ship.y - 34, ITEM_LABELS[item], { color: '#ffd75a', font: 'bold 16px sans-serif' });
        continue;
      }
      for (let k = 0; k < G.opponents.length; ++k) {
        const ai = G.opponents[k];
        if (ai.finished || ai.item) continue;
        if ((box.x - ai.x) * (box.x - ai.x) + (box.y - ai.y) * (box.y - ai.y) >= reachSq) continue;
        ai.item = rollItem(racerPlace(ai));
        box.respawn = ITEM_BOX_RESPAWN;
        break;
      }
    }
  }

  /* AI drivers sit on a cooldown and then use what they carry when it pays off */
  function updateAIItems(dt) {
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      if (ai.finished) continue;
      ai.itemCooldown -= dt;
      if (ai.itemCooldown > 0 || !ai.item) continue;
      if (!aiWantsToUse(ai)) continue;
      useItem(ai, false);
      ai.item = null;
      ai.itemCooldown = 3 + Math.random() * 3;
    }
  }

  function aiWantsToUse(ai) {
    if (ai.item === 'shield')
      return true;
    if (ai.item === 'turbo') {
      // only spend the boost where the road runs straight
      let bend = G.geo.sampleAt(ai.ts.s + 400).angle - G.geo.sampleAt(ai.ts.s).angle;
      while (bend > Math.PI) bend -= TWO_PI;
      while (bend < -Math.PI) bend += TWO_PI;
      return Math.abs(bend) < 0.3;
    }
    if (ai.item === 'missile')
      return racerInGap(ai, 1, 700);
    if (ai.item === 'mine')
      return racerInGap(ai, -300, -1);
    if (ai.item === 'emp') {
      const r2 = EMP_RADIUS * EMP_RADIUS;
      if (ai !== G.ship && (G.ship.x - ai.x) * (G.ship.x - ai.x) + (G.ship.y - ai.y) * (G.ship.y - ai.y) < r2)
        return true;
      for (let k = 0; k < G.opponents.length; ++k) {
        const other = G.opponents[k];
        if (other === ai) continue;
        if ((other.x - ai.x) * (other.x - ai.x) + (other.y - ai.y) * (other.y - ai.y) < r2)
          return true;
      }
    }
    return false;
  }

  function usePlayerItem() {
    if (!racingActive()) return;
    if (!G.playerItem && G.playerItem2) {
      G.playerItem = G.playerItem2;
      G.playerItem2 = null;
    }
    if (!G.playerItem) return;
    useItem(G.ship, true);
    G.playerItem = G.playerItem2;   // the second slot shifts up into the first
    G.playerItem2 = null;
  }

  function useItem(racer, isPlayer) {
    const item = isPlayer ? G.playerItem : racer.item;
    if (!item) return;

    if (item === 'turbo') {
      if (isPlayer) {
        G.boostActive = true;
        G.boostTimer = 1.2;
        SZ.GameAudio.play('powerup');
      } else {
        racer.turbo = 1.2;
      }
      return;
    }

    if (item === 'shield') {
      racer.shieldTime = SHIELD_TIME + (isPlayer ? 3 * treeLevel('u_shield') : 0);
      SZ.GameAudio.play('zap');
      return;
    }

    if (item === 'mine') {
      const mx = racer.x - Math.cos(racer.angle) * 40;
      const my = racer.y - Math.sin(racer.angle) * 40;
      G.mines.push({ x: mx, y: my, owner: racer, armed: MINE_ARM_TIME, life: MINE_LIFE });
      if (isPlayer && treeLevel('a_twin') > 0) {
        const perp = racer.angle + Math.PI / 2;
        G.mines.push({
          x: mx + Math.cos(perp) * 40,
          y: my + Math.sin(perp) * 40,
          owner: racer,
          armed: MINE_ARM_TIME,
          life: MINE_LIFE
        });
      }
      SZ.GameAudio.play('drop');
      return;
    }

    if (item === 'missile') {
      G.projectiles.push({
        x: racer.x + Math.cos(racer.angle) * 40,
        y: racer.y + Math.sin(racer.angle) * 40,
        angle: racer.angle,
        speed: MISSILE_SPEED,
        turn: MISSILE_TURN * (isPlayer ? 1 + 0.4 * treeLevel('a_homing') : 1),
        target: nearestAhead(racer),
        owner: racer,
        life: MISSILE_LIFE
      });
      SZ.GameAudio.play('shoot');
      return;
    }

    if (item === 'emp') {
      const radius = isPlayer ? EMP_RADIUS + 100 * treeLevel('a_emp') : EMP_RADIUS;
      const r2 = radius * radius;
      if (racer !== G.ship && (G.ship.x - racer.x) * (G.ship.x - racer.x) + (G.ship.y - racer.y) * (G.ship.y - racer.y) < r2)
        hit(G.ship, 'emp', racer);
      for (let i = 0; i < G.opponents.length; ++i) {
        const other = G.opponents[i];
        if (other === racer || other.finished) continue;
        if ((other.x - racer.x) * (other.x - racer.x) + (other.y - racer.y) * (other.y - racer.y) < r2)
          hit(other, 'emp', racer);
      }
      G.shockwaves.push({ x: racer.x, y: racer.y, r: 0, life: 0.5, radius: radius });
      SZ.GameAudio.play('zap', { pitch: 0.6 });
    }
  }

  /* A hit spins the ship out -- unless the shield eats it first */
  function hit(racer, kind, attacker) {
    if (racer.shieldTime > 0) {
      racer.shieldTime = 0;
      particles.burst(racer.x, racer.y, 14, { color: '#8ad8ff', speed: 3, life: 0.4 });
      if (racer === G.ship)
        SZ.GameAudio.play('bounce');
      return;
    }

    racer.spin = (kind === 'emp' ? 1.2 : 1.0) * (racer === G.ship ? 1 - 0.15 * treeLevel('u_armor') : 1);
    racer.vx *= 0.35;
    racer.vy *= 0.35;
    if (kind === 'emp') {
      particles.burst(racer.x, racer.y, 18, { color: '#8ad8ff', speed: 4, life: 0.5 });
    } else {
      particles.burst(racer.x, racer.y, 16, { color: '#ff8a3a', speed: 4.5, life: 0.6 });
      particles.burst(racer.x, racer.y, 8, { color: '#ffd75a', speed: 3, life: 0.45 });
    }

    if (racer === G.ship) {
      screenShake.trigger(10, 350);
      SZ.GameAudio.play('explode');
      floatingText.add(G.ship.x, G.ship.y - 34, 'HIT!', { color: '#ff4a4a', font: 'bold 20px sans-serif' });
    } else if (attacker === G.ship) {
      ++G.bonusHitsLanded;
      floatingText.add(G.ship.x, G.ship.y - 34, 'GOT ONE!', { color: '#ffd75a', font: 'bold 18px sans-serif' });
    }
  }

  /* Missiles home in on their quarry with a fixed turn rate */
  function updateProjectiles(dt) {
    for (let i = G.projectiles.length - 1; i >= 0; --i) {
      const p = G.projectiles[i];
      p.life -= dt;
      if (p.target) {
        let want = Math.atan2(p.target.y - p.y, p.target.x - p.x) - p.angle;
        while (want > Math.PI) want -= TWO_PI;
        while (want < -Math.PI) want += TWO_PI;
        const turn = p.turn || MISSILE_TURN;
        p.angle += Math.max(-turn * dt, Math.min(turn * dt, want));
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      particles.trail(p.x, p.y, { color: '#ff8a3a', life: 0.25, size: 2, decay: 0.05 });

      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        if (dx * dx + dy * dy < MISSILE_HIT * MISSILE_HIT) {
          hit(p.target, 'missile', p.owner);
          G.projectiles.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0) {
        particles.burst(p.x, p.y, 10, { color: '#ff8a3a', speed: 3, life: 0.4 });
        SZ.GameAudio.play('smallExplode', { volume: 0.5 });
        G.projectiles.splice(i, 1);
      }
    }
  }

  /* Mines arm themselves, then take out whoever runs into them */
  function updateMines(dt) {
    const reachSq = MINE_RADIUS * MINE_RADIUS;
    for (let i = G.mines.length - 1; i >= 0; --i) {
      const m = G.mines[i];
      m.life -= dt;
      if (m.armed > 0) {
        m.armed -= dt;
        continue;
      }
      let gone = false;
      if ((m.x - G.ship.x) * (m.x - G.ship.x) + (m.y - G.ship.y) * (m.y - G.ship.y) < reachSq) {
        hit(G.ship, 'mine', m.owner);
        gone = true;
      }
      if (!gone) {
        for (let k = 0; k < G.opponents.length; ++k) {
          const ai = G.opponents[k];
          if (ai.finished) continue;
          if ((m.x - ai.x) * (m.x - ai.x) + (m.y - ai.y) * (m.y - ai.y) >= reachSq) continue;
          hit(ai, 'mine', m.owner);
          gone = true;
          break;
        }
      }
      if (gone || m.life <= 0)
        G.mines.splice(i, 1);
    }
  }

  function updateShockwaves(dt) {
    for (let i = G.shockwaves.length - 1; i >= 0; --i) {
      const w = G.shockwaves[i];
      w.life -= dt;
      w.r = (w.radius || EMP_RADIUS) * (1 - Math.max(0, w.life) / 0.5);
      if (w.life <= 0)
        G.shockwaves.splice(i, 1);
    }
  }

  function updateItems(dt) {
    if (!racingActive()) return;
    if (G.ship.shieldTime > 0)
      G.ship.shieldTime -= dt;
    for (let i = 0; i < G.opponents.length; ++i) {
      if (G.opponents[i].shieldTime > 0)
        G.opponents[i].shieldTime -= dt;
    }
    updateItemBoxes(dt);
    updateAIItems(dt);
    updateProjectiles(dt);
    updateMines(dt);
    updateShockwaves(dt);
  }

  Object.assign(NS.module('items'), {
    usePlayerItem, updateItems
  });
})();
