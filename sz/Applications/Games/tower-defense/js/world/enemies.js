/* world/enemies.js -- enemy movement, abilities, deaths, leaks and sweeping the dead.
   Reads: constants, maps, env, widgets, effects, research, bossRewards, progress, paths, towers, waves,
      combat, savegame, battlefield and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_PLAYING, STATE_GAME_OVER } = NS.constants;
  const { MAPS } = NS.maps;
  const { screenShake, audio, playThrottled, updateWindowTitle } = NS.env;
  const { UI } = NS.widgets;
  const { fxRandom, particles, floatingText, deathFx, coinFly, showBanner, addShake } = NS.effects;
  const { techLevel, awardResearch } = NS.research;
  const { hasRelic, rollBossReward } = NS.bossRewards;
  const { addHighScore, recordResult } = NS.progress;
  const { enemyPath, pathPos } = NS.paths;
  const { towerStats, towerAt, destroyTower } = NS.towers;
  const { mapBountyMul, spawnEnemy, enemyFlags } = NS.waves;
  const { hurt, applySlow, gridMoved, enemiesNear } = NS.combat;

  /* ══════════════════════════════════════════════════════════════════
     ENEMIES
     ══════════════════════════════════════════════════════════════════ */

  function enemySpeed(e) {
    if (e.freezeTimer > 0 || e.stunTimer > 0) return 0;
    return e.speed * e.haste * (e.enraged ? 1.4 : 1) * (e.slowTimer > 0 ? e.slowMul : 1) * (e.chargeT > 0 ? 3 : 1) * (e.burrowT > 0 ? 1.5 : 1);
  }

  // Special abilities of the newer monsters and bosses
  function updateEnemyAbilities(e, f, dt) {
    if (f.burrows) {
      e.burrowCd = (e.burrowCd === undefined ? 3 + Math.random() * 2 : e.burrowCd) - dt;
      if (e.burrowT > 0) {
        e.burrowT -= dt;
        if (G.fxBudget > 0 && fxRandom() < dt * 12) particles.debris(e.x, e.y + 4, 1, ['#8a6a40', '#6a5030'], 0.5);
        if (e.burrowT <= 0) {
          particles.debris(e.x, e.y, 8, ['#8a6a40', '#6a5030', '#a8885a'], 1);
          playThrottled('unburrow', 'drop', { pitch: 0.5, volume: 0.4 }, 200);
        }
      } else if (e.burrowCd <= 0) {
        e.burrowCd = f.boss ? 6 : 4.5;
        e.burrowT = f.boss ? 2.5 : 1.8;
        particles.debris(e.x, e.y, 8, ['#8a6a40', '#6a5030', '#a8885a'], 1);
        playThrottled('burrow', 'thud', { pitch: 0.8, volume: 0.4 }, 200);
      }
    }
    if (f.charges) {
      e.chargeCd = (e.chargeCd === undefined ? 2 + Math.random() * 2 : e.chargeCd) - dt;
      if (e.chargeT > 0) e.chargeT -= dt;
      else if (e.chargeCd <= 0 && e.freezeTimer <= 0 && e.stunTimer <= 0) {
        e.chargeCd = 4;
        e.chargeT = 1;
        playThrottled('charge', 'whoosh', { pitch: 0.7, volume: 0.35 }, 250);
      }
      if (e.chargeT > 0 && G.fxBudget > 0 && fxRandom() < dt * 25) particles.smoke(e.x, e.y + 4, 1, '#b8a890', 4);
    }
    if (f.regen && e.burnTimer <= 0 && e.poisonTimer <= 0 && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * f.regen * dt);
      if (G.fxBudget > 0 && fxRandom() < dt * 3) particles.sparkle(e.x, e.y - 8, 1, { color: '#8aff8a', speed: 1 });
    }
    if (f.sabotage) {
      e.abilityTimer -= dt;
      if (e.abilityTimer <= 0) {
        for (const t of G.towers) {
          if (towerStats(t).trap || Math.hypot(t.x - e.x, t.y - e.y) > CELL * 1.3) continue;
          jamTower(t, 3);
          e.abilityTimer = 6;
          G.fxLines.push({ kind: 'zap', pts: [{ x: e.x, y: e.y - 6 }, { x: t.x, y: t.y - 10 }], color: '#7affc8', t: 0, life: 0.3, seed: fxRandom() * 100 });
          playThrottled('jam', 'zap', { pitch: 0.5, volume: 0.45 }, 200);
          break;
        }
      }
    }
    if (f.warcry) {
      e.cryCd = (e.cryCd === undefined ? 5 : e.cryCd) - dt;
      if (e.cryCd <= 0) {
        e.cryCd = 8;
        let n = 0;
        for (const t of G.towers)
          if (!towerStats(t).trap && Math.hypot(t.x - e.x, t.y - e.y) <= CELL * 2.5) { jamTower(t, 2); ++n; }
        G.fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 2.5, color: '#ff4ad8', t: 0, life: 0.6 });
        if (n) floatingText.add(e.x, e.y - 34, 'WAR CRY!', { color: '#ff7ae0', font: 'bold 13px sans-serif' });
        audio.play('hurt', { pitch: 0.35, volume: 0.7 });
        addShake(3, 200);
      }
    }
    if (f.cleanses) {
      e.abilityTimer -= dt;
      if (e.abilityTimer <= 0) {
        e.abilityTimer = 3;
        let any = false;
        for (const o of enemiesNear(e.x, e.y, CELL * 2)) {
          if (o.slowTimer > 0 || o.freezeTimer > 0 || o.stunTimer > 0) any = true;
          o.slowTimer = o.freezeTimer = o.stunTimer = 0;
          o.slowMul = 1;
        }
        if (any) {
          G.fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 2, color: '#c86aff', t: 0, life: 0.5 });
          playThrottled('hex', 'blip', { pitch: 0.55, volume: 0.3 }, 300);
        }
      }
    }
    if (f.phases) {
      const ph = e.hp < e.maxHp / 3 ? 2 : e.hp < e.maxHp * 2 / 3 ? 1 : 0;
      if (ph > (e.phase || 0)) {
        e.phase = ph;
        e.shieldMax = e.shieldHp = Math.floor(e.maxHp * 0.3);
        showBanner('AEGIS RAISED', 'Break the shield: Tesla, Venom, Arcane', '#7ab8ff', 1.8);
        particles.glow(e.x, e.y - 10, 60, '#7ab8ff', 0.5);
        audio.play('powerup', { pitch: 0.6 });
      }
    }
  }

  function jamTower(t, time) {
    if ((t.jamT || 0) <= 0) particles.sparks(t.x, t.y - 12, 6, '#7affc8', 120);
    t.jamT = Math.max(t.jamT || 0, time);
  }

  function killEnemy(e) {
    const f = enemyFlags(e);
    NS.battlefield.addCorpse(e);
    deathFx(e);
    let bounty = Math.round(e.bounty * mapBountyMul(G.currentMap) * (1 + techLevel('bounty') * 0.1 + (hasRelic('seal') ? 0.15 : 0)) * (G.rushTimer > 0 ? 2 : 1));
    for (const t of G.towers) {
      const s = towerStats(t);
      if (s.bounty && Math.hypot(t.x - e.x, t.y - e.y) <= s.rangePx)
        bounty += s.bounty;
    }
    G.gold += bounty;
    G.goldPulse = Math.max(G.goldPulse, 0.5);
    ++G.runStats.kills;
    G.runStats.gold += bounty;
    if (e.lastHitBy)
      ++e.lastHitBy.kills;
    floatingText.add(e.x, e.y - 18, `+${bounty}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    coinFly(e.x, e.y, f.boss ? 10 : bounty >= 15 ? 2 : 1);
    // Slimes burst into slimelets
    if (f.split) {
      for (let i = 0; i < f.splitCount; ++i) {
        const c = spawnEnemy(f.split + (f.boss ? '!' : ''), e.pi, Math.max(0, e.dist - 6 + i * 6));
        c.maxHp = c.hp = Math.max(4, Math.floor(e.maxHp * (f.boss ? 0.18 : 0.28)));
        c.spawnT = 0;
      }

    }
    if (e.plague)
      G.clouds.push({ x: e.x, y: e.y, r: CELL * 0.8, t: 0, life: 2.2, dps: towerStats(e.plague).cloudDps * 0.6, acid: false, plague: true, tower: e.plague, seed: fxRandom() * 100 });
    if (f.boss) {
      particles.confetti(e.x, e.y, 30, {});
      showBanner(`${f.name.toUpperCase()} DEFEATED`, `+${bounty} gold`, UI.gold, 2.4);
      rollBossReward(e);
      if (techLevel('medic') && G.lives < G.runStartLives) {
        G.lives = Math.min(G.runStartLives, G.lives + 2);
        G.livesPulse = 1;
        floatingText.add(e.x, e.y - 40, '+2 lives', { color: '#6fe08a', font: 'bold 13px sans-serif' });
      }
      audio.play('explode');
    } else {
      screenShake.trigger(1.5, 60);
      audio.play('smallExplode', { pitch: (f.flying ? 1.3 : e.radius > 8 ? 0.7 : 1) + fxRandom() * 0.2, volume: 0.5 });
    }
  }

  function enemyReachedGoal(e) {
    const f = enemyFlags(e);
    const cost = f.lives || 1;
    G.lives = Math.max(0, G.lives - cost);
    G.runStats.leaked += cost;
    screenShake.trigger(4, 150);
    floatingText.add(e.x, e.y - 18, `-${cost} ${cost > 1 ? 'lives' : 'life'}`, { color: '#ff5a5a', font: 'bold 13px sans-serif' });
    particles.glow(e.x, e.y, 40, '#ff3a3a', 0.4);
    particles.burst(e.x, e.y, 10, { color: '#ff6a6a', speed: 2.5, life: 0.5 });
    G.livesPulse = 1;
    audio.play('hurt');
    if (G.lives <= 0 && G.state === STATE_PLAYING) {
      audio.play('lose');
      G.state = STATE_GAME_OVER;
      NS.savegame.clearSavedGame();
      addHighScore(MAPS[G.currentMap].name, Math.max(0, G.currentWave - 1));
      recordResult(false, Math.max(0, G.currentWave - 1));
      if (!G.cleared) awardResearch(false, 0);
      else G.lastRp = G.runStats.rp || 0;
      screenShake.trigger(8, 500);
      updateWindowTitle();
    }
  }

  function updateEnemies(dt) {
    // Elites hurry the enemies around them along
    for (const e of G.enemies)
      e.haste = 1;
    for (const e of G.enemies) {
      if (!e.elite || e.hp <= 0) continue;
      for (const o of enemiesNear(e.x, e.y, CELL * 1.6))
        if (o !== e) o.haste = 1.2;
    }
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const f = enemyFlags(e);
      e.spawnT += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        hurt(e, e.burnDps * dt, e.burnSrc, 'fire', { dot: true });
      }
      if (e.poisonTimer > 0) e.poisonTimer -= dt;
      if (e.acidTimer > 0) e.acidTimer -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.freezeTimer > 0) e.freezeTimer -= dt;
      if (e.stunTimer > 0) e.stunTimer -= dt;
      if (e.hp <= 0) continue;

      if (f.heals) {
        e.healCooldown -= dt;
        if (e.healCooldown <= 0) {
          e.healCooldown = 2.5;
          let any = false;
          for (const o of enemiesNear(e.x, e.y, CELL * 2)) {
            if (o === e || o.hp >= o.maxHp || enemyFlags(o).boss) continue;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
            particles.sparkle(o.x, o.y, 3, { color: '#6aff8a', speed: 1 });
            any = true;
          }
          if (any) {
            G.fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 2, color: '#6aff8a', t: 0, life: 0.5 });
            playThrottled('heal', 'pickup', { pitch: 0.6, volume: 0.2 }, 400);
          }
        }
      }
      if (f.shielder) {
        e.abilityTimer -= dt;
        if (e.abilityTimer <= 0) {
          e.abilityTimer = 4;
          for (const o of enemiesNear(e.x, e.y, CELL * 1.8)) {
            if (o === e || enemyFlags(o).boss) continue;
            const cap = Math.floor(o.maxHp * 0.25);
            if (o.shieldHp < cap) {
              o.shieldHp = cap;
              o.shieldMax = Math.max(o.shieldMax, cap);
            }
          }
          G.fxLines.push({ kind: 'ring', x: e.x, y: e.y, r: CELL * 1.8, color: '#5ad8ff', t: 0, life: 0.5 });
          playThrottled('ward', 'blip', { pitch: 0.7, volume: 0.2 }, 400);
        }
      }
      updateEnemyAbilities(e, f, dt);
      if (f.summons) {
        e.abilityTimer -= dt;
        if (e.abilityTimer <= 0) {
          e.abilityTimer = e.enraged ? 4 : 6;
          for (let i = 0; i < 3; ++i) {
            const sk = spawnEnemy('skeleton', e.pi, Math.max(0, e.dist - 10 - i * 12));
            sk.spawnT = 0;
            particles.burst(sk.x, sk.y, 6, { color: '#8affd8', speed: 2, life: 0.4 });
          }
          audio.play('whoosh', { pitch: 0.6, volume: 0.5 });
        }
        if (!e.enraged && e.hp < e.maxHp * 0.5) {
          e.enraged = true;
          floatingText.add(e.x, e.y - 30, 'ENRAGED!', { color: '#ff5a5a', font: 'bold 14px sans-serif' });
          audio.play('hurt', { pitch: 0.45, volume: 0.8 });
          screenShake.trigger(4, 300);
        }
      }

      // Traps and burning ground
      const col = Math.floor(e.x / CELL), row = Math.floor(e.y / CELL);
      if (!f.flying) {
        const trap = towerAt(col, row);
        if (trap) {
          const s = towerStats(trap);
          if (s.trap) {
            hurt(e, s.damage * dt, trap, 'phys', { pierce: s.pierce || 0, dot: !s.pierce, area: true });
            playThrottled('trap', 'click', { pitch: 0.6 + fxRandom() * 0.3, volume: 0.25 }, 260);
            if (s.slow) applySlow(e, 1 - s.slow, s.slowTime);
          }
        }
        for (const fe of G.floorEffects) {
          if (fe.col !== col || fe.row !== row) continue;
          if (fe.type === 'lava') {
            hurt(e, fe.damage * dt, null, 'fire', { dot: true, area: true });
            if (e.burnTimer <= 0) { e.burnDps = fe.damage * 0.5; e.burnTimer = 1; }
          } else if (fe.type === 'ice')
            applySlow(e, 0.6, 0.4);
        }
      }

      // The Frost Heart chills everything close to the gatehouse
      if (hasRelic('frostheart') && enemyPath(e).total - e.dist < CELL * 3)
        applySlow(e, 0.6, 0.3);
      const sp = enemySpeed(e);
      e.walk += sp * dt * 0.25;
      e.dist += sp * dt;
      const path = enemyPath(e);
      pathPos(path, e.dist, e);
      gridMoved(e);
      if (e.dist >= path.total) {
        e.hp = 0;
        e.leaked = true;
        enemyReachedGoal(e);
        continue;
      }

      // Heavy enemies batter the towers they pass
      if (f.batters && !f.flying) {
        const reach = e.radius + CELL * 0.7;
        for (const t of G.towers) {
          if (towerStats(t).trap) continue;
          const dx = t.x - e.x, dy = t.y - e.y;
          if (dx * dx + dy * dy < reach * reach) {
            t.hp -= f.batters * dt;
            t.hurtFlash = 0.15;
            if (t.hp <= 0) destroyTower(t);
          }
        }
      }
    }
  }
  // Remove dead enemies, paying out for the ones killed
  function sweepEnemies() {
    let w = 0;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.hp > 0) {
        G.enemies[w++] = e;
        continue;
      }
      if (!e.leaked)
        killEnemy(e);
    }
    G.enemies.length = w;
    if (G.selectedTower && G.towers.indexOf(G.selectedTower) < 0)
      G.selectedTower = null;
  }

  NS.enemies = { enemySpeed, updateEnemies, sweepEnemies };

})();
