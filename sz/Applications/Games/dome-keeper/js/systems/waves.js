;(function() {
  'use strict';

  // Enemy types, elites, spawning nightly waves, enemy behaviour and damage to the dome.
  // Owns: NS.waves and these state fields:
  //   G.enemyShots, G.shockwaves, G.lastNightElites, G.domeInvulnerable, G.emergencyCooldown,
  //   G.lastStandUsed, G.keeperIdle, G.dashCooldown
  // Reads: constants, dom, rules, upgrades, persistence, animation, time, weather, relocation, weapon,
  //   artifacts, app
  // Reads state of: gameState, time, weather, artifacts, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, TWO_PI, VIEW_SURFACE, STATE_PLAYING, STATE_GAME_OVER } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { addHighScore, saveRun, clearSave } = NS.persistence;
  const { spawnShieldImpact, applyDamageToEnemy } = NS.animation;
  const { moonStrength, isNight, announce } = NS.time;
  const { currentSeason, weatherSlow } = NS.weather;
  const { THREAT_PER_SITE } = NS.relocation;

  /* ======================================================================
     ENEMY WAVES
     ====================================================================== */

  /* -- Monster roster -- */
  // hp / speed / damage scale the night's base stats, cost is the share of the
  // night's budget, level the threat level the type first appears at
  const ENEMY_TYPES = {
    walker:   { name: 'Walker', move: 'ground', hp: 1, speed: 1, damage: 1, size: [20, 28], cost: 1, level: 0, weight: 10, score: 1, attack: 1, color: '#e0403a',
      desc: 'Plods to the dome and bites it' },
    swarmer:  { name: 'Swarmer', move: 'ground', hp: 0.3, speed: 1.9, damage: 0.4, size: [9, 12], cost: 0.6, level: 3, weight: 5, score: 0.5, attack: 0.9, group: [2, 5], color: '#c8d040',
      desc: 'Tiny and fast, always in packs' },
    flyer:    { name: 'Flyer', move: 'air', hp: 0.6, speed: 1.3, damage: 0.8, size: [14, 20], cost: 0.9, level: 3, weight: 6, score: 1, attack: 1, color: '#a050c8',
      desc: 'Flies straight at the dome' },
    crawler:  { name: 'Armored Crawler', move: 'ground', hp: 2.4, speed: 0.55, damage: 1.6, size: [26, 32], cost: 2.2, level: 4, weight: 5, score: 2.5, attack: 1.4, armor: 3, color: '#a08a5a',
      desc: 'Armor plates shrug off part of every hit' },
    diver:    { name: 'Diver', move: 'dive', hp: 0.7, speed: 1.2, damage: 2.2, size: [16, 20], cost: 1.4, level: 5, weight: 5, score: 1.5, attack: 1, color: '#3ab0c8',
      desc: 'Circles high, then dives at the dome' },
    burrower: { name: 'Burrower', move: 'burrow', hp: 1.3, speed: 1.15, damage: 1.3, size: [20, 24], cost: 1.4, level: 6, weight: 4, score: 1.5, attack: 1, color: '#d0609a',
      desc: 'Tunnels unseen and pops up beside the dome' },
    spitter:  { name: 'Spitter', move: 'ranged', hp: 0.9, speed: 0.8, damage: 1.2, size: [20, 24], cost: 1.5, level: 7, weight: 4, score: 1.6, attack: 2.6, color: '#60d040',
      desc: 'Keeps its distance and spits acid' },
    splitter: { name: 'Splitter', move: 'ground', hp: 1.5, speed: 0.8, damage: 1.1, size: [24, 28], cost: 1.8, level: 8, weight: 3, score: 1.8, attack: 1, color: '#ff9030',
      desc: 'Bursts into swarmers when killed' },
    mender:   { name: 'Mender', move: 'ground', hp: 1.4, speed: 0.75, damage: 0.9, size: [22, 26], cost: 1.8, level: 9, weight: 3, score: 2, attack: 1.2, color: '#40e0a0',
      desc: 'Regenerates and heals the monsters around it' },
    behemoth: { name: 'Behemoth', move: 'ground', hp: 9, speed: 0.45, damage: 3, size: [46, 54], cost: 0, level: 10, weight: 0, score: 8, attack: 1.6, armor: 2, boss: true, color: '#b81848',
      desc: 'Boss: stomps shockwaves into the dome' },
    queen:    { name: 'Hive Queen', move: 'queen', hp: 7, speed: 0.5, damage: 2.5, size: [36, 42], cost: 0, level: 15, weight: 0, score: 9, attack: 1.2, boss: true, color: '#e040c0',
      desc: 'Boss: hovers over the field dropping swarmers' }
  };
  // Seasons shift the mix
  const SEASON_ENEMY_BIAS = {
    spring: { swarmer: 2.5, splitter: 1.5, crawler: 0.5 },
    summer: { flyer: 1.6, diver: 1.6, spitter: 1.4 },
    autumn: { burrower: 1.8, mender: 1.3, walker: 1.2 },
    winter: { crawler: 2.2, mender: 1.5, swarmer: 0.3, flyer: 0.6 }
  };
  // Elite auras strengthen the monsters around an elite
  const ELITE_AURAS = {
    haste: { name: 'Haste aura', color: '#5ae0ff', desc: 'Monsters nearby move 30% faster' },
    ward: { name: 'Ward aura', color: '#ffd75a', desc: 'Monsters nearby take 25% less damage' },
    fury: { name: 'Fury aura', color: '#ff5a5a', desc: 'Monsters nearby hit 30% harder' }
  };
  const ELITE_FROM = 7;              // threat at which elites appear
  const ENRAGE_FROM = 5;             // threat at which wounded monsters enrage
  const ELITE_RANGED_FROM = 12;      // threat at which elites also spit acid
  G.enemyShots = [];               // acid globs: { x0, y0, tx, ty, t, dur, dmg }
  G.shockwaves = [];               // behemoth stomps: { x, r, hit }

  // Threat climbs with every night at a site; every site starts higher than the last
  // Body centre of a ground monster standing on the ground line (its shadow sits at y + 0.75 size)
  function groundY(size) {
    return DOME_Y - size * 0.7;
  }

  function threatLevel() {
    return G.siteNights + G.site.index * THREAT_PER_SITE;
  }

  G.lastNightElites = 0;           // elites in tonight's main attack (for the night banner)

  // Colour of the threat chip: calm green to deadly violet
  function threatColor(t) {
    return t < 5 ? '#7ae07a' : (t < 10 ? '#ffc048' : (t < 16 ? '#ff6a5a' : '#d070ff'));
  }

  function enemyType(e) {
    return ENEMY_TYPES[e.type] || ENEMY_TYPES.walker;
  }

  function spawnEnemy(key, base, at) {
    const T = ENEMY_TYPES[key];
    const season = currentSeason();
    const size = (T.size[0] + Math.random() * (T.size[1] - T.size[0])) * (T.boss ? 1 : season.size);
    const hp = base.hp * T.hp * (0.88 + Math.random() * 0.24);
    // Plates grow thicker with the threat; later every bigger monster carries some
    const armorBonus = base.threat >= 9 && key !== 'swarmer' ? Math.floor((base.threat - 5) / 4) : 0;
    const e = {
      type: key, x: 0, y: 0, hp, maxHP: hp,
      speed: base.speed * T.speed * (0.9 + Math.random() * 0.2),
      damage: Math.max(1, Math.round(base.damage * T.damage)),
      attackTimer: 0.4 + Math.random() * 0.5, stunTimer: 0, size,
      armor: (T.armor ? Math.round(T.armor * (1 + base.threat * 0.06)) : 0) + armorBonus,
      shield: 0, maxShield: 0, boss: !!T.boss, phase: 'approach', t: 0,
      wobblePhase: Math.random() * TWO_PI, legPhase: Math.random() * TWO_PI, wingPhase: Math.random() * TWO_PI,
      eyeBlinkTimer: 2 + Math.random() * 3, eyeBlinking: false
    };
    if (at) {
      e.x = at.x;
      e.y = at.y;
    } else if (T.move === 'air' || T.move === 'dive' || T.move === 'queen') {
      const angle = Math.PI + 0.15 + Math.random() * (Math.PI - 0.3);
      const dist = 640 + Math.random() * 200;
      e.x = DOME_X + Math.cos(angle) * dist;
      e.y = Math.max(-80, DOME_Y + Math.sin(angle) * dist * 0.75);
      e.hoverX = DOME_X + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200);
      e.hoverY = 230 + Math.random() * 160;
    } else {
      const fromLeft = Math.random() < 0.5;
      e.x = fromLeft ? -60 - Math.random() * 180 : CANVAS_W + 60 + Math.random() * 180;
      e.y = groundY(size) + Math.random() * 10;
      if (T.move === 'burrow') {
        e.hidden = true;
        e.y = DOME_Y + 14;
      }
    }
    // Shields show up as the threat grows
    if (base.threat >= 11 && !T.boss && Math.random() < Math.min(0.3, (base.threat - 10) * 0.05)) {
      e.shield = e.maxShield = Math.floor(hp * 0.5 + base.threat);
    } else if (T.boss) {
      e.shield = e.maxShield = Math.floor(hp * 0.35);
    }
    G.enemies.push(e);
    return e;
  }

  // Turn a monster into an elite: tougher, bigger, with an aura for its pack
  function makeElite(e, threat) {
    const auras = Object.keys(ELITE_AURAS);
    e.elite = auras[Math.floor(Math.random() * auras.length)];
    e.hp = e.maxHP = e.maxHP * 2.2;
    e.size *= 1.25;
    e.damage = Math.ceil(e.damage * 1.35);
    e.speed *= 1.08;
    if (e.y < DOME_Y && enemyType(e).move === 'ground')
      e.y = groundY(e.size);
    if (threat >= ELITE_RANGED_FROM && (enemyType(e).move === 'ground' || enemyType(e).move === 'air'))
      e.spit = 2 + Math.random() * 2;
  }

  // The main attack comes at nightfall; reinforcements (smaller, no boss) later in the night
  function spawnWave(reinforcement) {
    if (!reinforcement) {
      ++G.waveNumber;
      ++G.siteNights;
    }
    G.waveActive = true;

    // Recharge shield gadget at wave start
    if (!reinforcement && G.primaryGadget === 'shield') {
      G.primaryGadgetState.active = true;
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
    }

    const threat = Math.max(1, threatLevel());
    const season = currentSeason();
    // Monsters grow faster than linearly with the threat, and every site adds a further edge
    const tk = threat - 1;
    const base = {
      threat,
      hp: (8 + tk * 3.3 + 0.07 * tk * tk) * season.hp * (1 + 0.38 * G.site.index),
      damage: (2 + tk * 0.8) * season.damage * (1 + 0.22 * G.site.index),
      speed: (15 + Math.min(34, threat * 2.1)) * season.speed
    };
    // The night's budget: grows with the threat, the moon and the season
    let budget = Math.min(40, 2 + threat * 0.85 + 0.012 * threat * threat) * moonStrength(G.world.day) * season.count * (reinforcement ? 0.5 : 1);
    const firstNew = G.enemies.length;
    const bias = SEASON_ENEMY_BIAS[season.key] || {};
    const wb = { blizzard: { burrower: 1.6, flyer: 0.5, diver: 0.5 }, storm: { flyer: 0.6, diver: 0.6 } }[G.weather.kind] || {};
    const pool = Object.keys(ENEMY_TYPES).filter(k => !ENEMY_TYPES[k].boss && ENEMY_TYPES[k].level <= threat);
    const weightOf = (k) => ENEMY_TYPES[k].weight * (bias[k] || 1) * (wb[k] || 1);
    let total = 0;
    for (const k of pool) total += weightOf(k);
    for (let guard = 0; budget > 0.25 && guard < 60; ++guard) {
      let r = Math.random() * total, key = pool[0];
      for (const k of pool) {
        r -= weightOf(k);
        if (r <= 0) {
          key = k;
          break;
        }
      }
      if (ENEMY_TYPES[key].cost > budget + 0.4)
        key = budget >= 1 || !pool.includes('swarmer') ? 'walker' : 'swarmer';
      const T = ENEMY_TYPES[key];
      if (T.group) {
        // Packs grow with the threat and never overspend the budget
        const n = Math.max(1, Math.min(T.group[0] + Math.floor(Math.random() * (T.group[1] - T.group[0] + 1)), 2 + Math.floor(threat / 3), Math.ceil(budget / T.cost)));
        const lead = spawnEnemy(key, base);
        for (let i = 1; i < n; ++i)
          spawnEnemy(key, base, { x: lead.x + (lead.x < DOME_X ? -1 : 1) * i * 22, y: lead.y + (Math.random() - 0.5) * 16 });
        budget -= T.cost * n;
      } else {
        spawnEnemy(key, base);
        budget -= T.cost;
      }
    }

    // Elites lead the pack once the threat is high enough
    if (threat >= ELITE_FROM) {
      const chance = Math.min(0.32, 0.05 + (threat - ELITE_FROM) * 0.02);
      let left = 1 + Math.floor((threat - ELITE_FROM) / 4) - (reinforcement ? 1 : 0);
      const fresh = G.enemies.slice(firstNew).filter(e => !e.boss && e.type !== 'swarmer');
      // At least one elite on the main attack
      if (!reinforcement && fresh.length && left > 0) {
        makeElite(fresh.splice(Math.floor(Math.random() * fresh.length), 1)[0], threat);
        --left;
      }
      for (const e of fresh)
        if (left > 0 && Math.random() < chance) {
          makeElite(e, threat);
          --left;
        }
    }
    const elites = G.enemies.slice(firstNew).filter(e => e.elite).length;
    if (!reinforcement)
      G.lastNightElites = elites;

    // A boss every fifth night once the threat is high enough
    if (!reinforcement && G.siteNights % 5 === 0 && threat >= 10) {
      const bossKey = threat >= 15 && Math.floor(G.waveNumber / 5) % 2 === 0 ? 'queen' : 'behemoth';
      spawnEnemy(bossKey, base);
      const T = ENEMY_TYPES[bossKey];
      announce(`${T.name} approaches!`, T.desc, '#ff5a5a', 'swords');
      SZ.GameAudio.play('hurt', { pitch: 0.5 });
      if (bossKey === 'queen')
        SZ.GameAudio.sweep(300, 1400, 0.7, 'sawtooth', 0.06, 0.2);
    }
    if (reinforcement) {
      announce('More monsters!', elites ? `A second swarm crawls out of the dark, led by ${elites} elite${elites > 1 ? 's' : ''}` : 'A second swarm crawls out of the dark', '#ff8a6a', 'swords');
      SZ.GameAudio.play('hurt', { pitch: 0.6, volume: 0.6 });
    }
    NS.app.updateWindowTitle();
  }

  // Kill effects, score and special deaths (splitters burst into swarmers)
  function killEnemy(e, i) {
    const T = enemyType(e);
    const pts = Math.round((10 + G.waveNumber * 5) * T.score * (e.elite ? 3 : 1));
    G.score += pts;
    G.enemies.splice(i, 1);
    const pitch = { swarmer: 1.6, flyer: 1.2, diver: 1.3, crawler: 0.7, burrower: 0.8, spitter: 1, splitter: 0.9, mender: 1.1, behemoth: 0.5, queen: 0.6 }[e.type] || 1;
    SZ.GameAudio.play(e.boss || e.type === 'crawler' ? 'explode' : 'smallExplode', { pitch: pitch * (0.9 + Math.random() * 0.2), volume: e.type === 'swarmer' ? 0.5 : 1 });
    if (e.type === 'mender')
      SZ.GameAudio.play('zap', { pitch: 0.6, volume: 0.5 });
    const n = e.boss ? 3 : 1;
    particles.burst(e.x, e.y, 20 * n, { color: T.color, speed: 3.5 * Math.sqrt(n), life: 0.6, gravity: 0.05 });
    particles.burst(e.x, e.y, 10 * n, { color: '#ffa040', speed: 2, life: 0.4 });
    particles.sparkle(e.x, e.y, 6, { color: '#ff0', speed: 1.5 });
    for (let g = 0; g < 5 * n; ++g)
      particles.trail(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, {
        vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1, color: T.color,
        life: 0.5 + Math.random() * 0.3, size: 3 + Math.random() * 3, gravity: 0.12, shape: 'square'
      });
    if (e.boss || e.elite)
      screenShake.trigger(e.boss ? 12 : 7, e.boss ? 400 : 250);
    if (e.elite)
      particles.sparkle(e.x, e.y, 16, { color: ELITE_AURAS[e.elite].color, speed: 3 });
    floatingText.add(e.x, e.y - 30, e.elite ? `Elite +${pts}` : `+${pts}`, { color: e.elite ? ELITE_AURAS[e.elite].color : '#ff0', font: 'bold 24px sans-serif' });
    if (e.type === 'splitter') {
      const base = { threat: threatLevel(), hp: e.maxHP / ENEMY_TYPES.splitter.hp * 0.9, damage: e.damage / ENEMY_TYPES.splitter.damage, speed: e.speed / ENEMY_TYPES.splitter.speed };
      for (let k = 0; k < 3; ++k) {
        const s = spawnEnemy('swarmer', base, { x: e.x + (k - 1) * 18, y: e.y + (Math.random() - 0.5) * 10 });
        s.attackTimer = 0.8;
      }
      SZ.GameAudio.play('bounce', { pitch: 0.6 });
      G.waveActive = true;
    }
  }

  function enemyMelee(e, T, dt) {
    e.attackTimer -= dt;
    if (e.attackTimer > 0) return false;
    e.attackTimer = T.attack;
    const lunge = Math.atan2(e.y - DOME_Y, e.x - DOME_X);
    e.lunge = 1;
    if (damageDome(e.aura === 'fury' ? Math.ceil(e.damage * 1.3) : e.damage, DOME_X + Math.cos(lunge) * DOME_RADIUS, DOME_Y + Math.sin(lunge) * DOME_RADIUS, '', e))
      return true;
    particles.burst(e.x, e.y, 8, { color: T.color, speed: 2.5, life: 0.4 });
    if (e.type === 'crawler' || e.boss)
      SZ.GameAudio.play('thud', { pitch: 0.6, volume: 0.7 });
    else if (e.type === 'swarmer')
      SZ.GameAudio.play('click', { pitch: 0.7, volume: 0.6 });
    return false;
  }

  // Elite auras reach the monsters around each elite (refreshed every frame)
  function applyEliteAuras() {
    for (const e of G.enemies)
      e.aura = null;
    for (const el of G.enemies) {
      if (!el.elite || el.hidden) continue;
      for (const o of G.enemies)
        if (!o.hidden && !o.aura && Math.abs(o.x - el.x) < 160 && Math.abs(o.y - el.y) < 160)
          o.aura = el.elite;
    }
    // An elite always carries its own aura
    for (const e of G.enemies)
      if (e.elite)
        e.aura = e.elite;
  }

  function updateEnemies(dt) {
    const repel = (G.primaryGadget === 'repellent' && G.primaryGadgetState.active) ? 0.4 : 1.0;
    const slowGround = weatherSlow();
    const slowAir = G.weather.kind === 'blizzard' ? 1 - 0.3 * G.weather.intensity : 1;
    const threat = threatLevel();
    applyEliteAuras();
    for (let i = G.enemies.length - 1; i >= 0; --i) {
      const e = G.enemies[i];
      const T = enemyType(e);
      e.t += dt;
      // Wounded monsters fly into a rage once the threat is high enough
      if (!e.enraged && !e.boss && threat >= ENRAGE_FROM && e.hp > 0 && e.hp < e.maxHP * 0.35 && !e.hidden) {
        e.enraged = true;
        e.speed *= 1.45;
        e.damage = Math.ceil(e.damage * 1.2);
        if (G.currentView === VIEW_SURFACE) {
          floatingText.add(e.x, e.y - (e.size || 20) - 34, 'ENRAGED', { color: '#ff5a3a', font: 'bold 18px sans-serif' });
          particles.burst(e.x, e.y, 10, { color: '#ff5a3a', speed: 2.5, life: 0.4 });
        }
      }
      // Elites of high threats spit acid on the way in
      if (e.spit !== undefined && !e.hidden && e.stunTimer <= 0) {
        e.spit -= dt;
        const far = Math.hypot(DOME_X - e.x, DOME_Y - e.y);
        if (e.spit <= 0 && far < 620 && far > DOME_RADIUS + 60) {
          e.spit = 4.5;
          const tx = DOME_X + (Math.random() - 0.5) * 90;
          G.enemyShots.push({ x0: e.x, y0: e.y - e.size * 0.5, tx, ty: DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (tx - DOME_X) * (tx - DOME_X))), t: 0, dur: 1.2, dmg: Math.ceil(e.damage * 0.7), src: e });
          if (G.currentView === VIEW_SURFACE)
            SZ.GameAudio.play('drop', { pitch: 0.6, volume: 0.5 });
        }
      }
      e.lunge = Math.max(0, (e.lunge || 0) - dt * 4);
      if (e.pop !== undefined && e.pop < 1)
        e.pop = Math.min(1, e.pop + dt * 2.4);
      const isStunned = e.stunTimer > 0;
      if (isStunned)
        e.stunTimer = Math.max(0, e.stunTimer - dt);
      const air = T.move === 'air' || T.move === 'dive' || T.move === 'queen';
      const spd = e.speed * repel * (air ? slowAir : slowGround) * (e.aura === 'haste' ? 1.3 : 1);
      const dx = DOME_X - e.x, dy = DOME_Y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = DOME_RADIUS + (air ? 10 : e.size * 0.45);

      // Menders regenerate and patch up the monsters near them
      if (e.type === 'mender') {
        e.hp = Math.min(e.maxHP, e.hp + e.maxHP * 0.05 * dt);
        for (const o of G.enemies)
          if (o !== e && !o.hidden && Math.abs(o.x - e.x) < 130 && Math.abs(o.y - e.y) < 130)
            o.hp = Math.min(o.maxHP, o.hp + o.maxHP * 0.03 * dt);
      }
      // Monsters dropped by the queen fall to the ground first
      if (e.fall !== undefined) {
        e.fall = Math.min(1, e.fall + dt * 1.8);
        e.y = e.fallFrom + (groundY(e.size) - e.fallFrom) * e.fall * e.fall;
        if (e.fall >= 1) {
          delete e.fall;
          particles.burst(e.x, e.y + e.size * 0.4, 5, { color: '#8a7a6a', speed: 1.5, life: 0.3 });
        }
      } else if (!isStunned) {
        switch (T.move) {
          case 'burrow':
            if (e.hidden) {
              e.x += Math.sign(dx) * spd * 1.15 * dt;
              if (G.currentView === VIEW_SURFACE && Math.random() < dt * 14)
                particles.trail(e.x + (Math.random() - 0.5) * 20, DOME_Y + 6, { vx: (Math.random() - 0.5) * 2, vy: -1.5 - Math.random() * 1.5, color: '#7a6248', life: 0.4, size: 2.5, gravity: 0.12, shape: 'square' });
              if (Math.abs(dx) < DOME_RADIUS + 70) {
                e.hidden = false;
                e.pop = 0;
                e.y = groundY(e.size);
                if (G.currentView === VIEW_SURFACE) {
                  particles.burst(e.x, DOME_Y, 22, { color: '#8a6a48', speed: 4, life: 0.6, gravity: 0.15 });
                  screenShake.trigger(4, 150);
                }
                SZ.GameAudio.play('thud', { pitch: 0.5 });
                SZ.GameAudio.noise(0.3, 0.12, 'lowpass', 600, 120);
              }
              break;
            }
            // surfaced: fall through to ground behaviour
          case 'ground':
            if (dist > reach)
              e.x += Math.sign(dx) * spd * dt;
            else if (enemyMelee(e, T, dt))
              return;
            break;
          case 'ranged': {
            if (Math.abs(dx) > 330) {
              e.x += Math.sign(dx) * spd * dt;
            } else {
              e.attackTimer -= dt;
              e.charge = Math.max(0, 1 - e.attackTimer / 0.8);
              if (e.attackTimer <= 0) {
                e.attackTimer = T.attack;
                const tx = DOME_X + (Math.random() - 0.5) * 90;
                G.enemyShots.push({ x0: e.x + Math.sign(dx) * e.size * 0.5, y0: e.y - e.size * 0.5, tx, ty: DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (tx - DOME_X) * (tx - DOME_X))), t: 0, dur: 1.1, dmg: e.damage, src: e });
                if (G.currentView === VIEW_SURFACE)
                  SZ.GameAudio.play('drop', { pitch: 0.7, volume: 0.6 });
              }
            }
            break;
          }
          case 'air':
            if (dist > reach) {
              e.x += dx / dist * spd * dt;
              e.y += dy / dist * spd * dt;
            } else if (enemyMelee(e, T, dt))
              return;
            break;
          case 'dive': {
            if (e.phase === 'approach' || e.phase === 'climb') {
              const hx = e.hoverX - e.x, hy = e.hoverY - e.y, hd = Math.hypot(hx, hy) || 1;
              e.x += hx / hd * spd * (e.phase === 'climb' ? 1.6 : 1) * dt;
              e.y += hy / hd * spd * (e.phase === 'climb' ? 1.6 : 1) * dt;
              if (hd < 12) {
                e.phase = 'circle';
                e.t = 0;
                e.circleFor = 1.6 + Math.random() * 2;
              }
            } else if (e.phase === 'circle') {
              e.x = e.hoverX + Math.sin(e.t * 2.2) * 70;
              e.y = e.hoverY + Math.sin(e.t * 4.4) * 18;
              if (e.t > e.circleFor) {
                e.phase = 'dive';
                const tx = DOME_X + (Math.random() - 0.5) * 70;
                e.diveX = tx;
                e.diveY = DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (tx - DOME_X) * (tx - DOME_X)));
                if (G.currentView === VIEW_SURFACE)
                  SZ.GameAudio.sweep(1900, 500, 0.55, 'sawtooth', 0.04);
              }
            } else if (e.phase === 'dive') {
              const vx = e.diveX - e.x, vy = e.diveY - e.y, vd = Math.hypot(vx, vy) || 1;
              const step = spd * 5.2 * dt;
              e.angle = Math.atan2(vy, vx);
              if (vd <= step + 6) {
                e.x = e.diveX;
                e.y = e.diveY;
                const pc = NS.weapon.parryCheck();
                if (pc) {
                  // Parried: the diver bounces off stunned and hurt
                  NS.weapon.parryFeedback(e.x, e.y, pc === 2);
                  applyDamageToEnemy(e, Math.round(G.weaponDamage * (pc === 2 ? 4 : 3)));
                  e.stunTimer = 2;
                  e.y -= 30;
                } else if (damageDome(e.damage, e.x, e.y, '', e))
                  return;
                SZ.GameAudio.play('hit', { pitch: 1.2 });
                particles.burst(e.x, e.y, 12, { color: T.color, speed: 3, life: 0.4 });
                e.phase = 'climb';
                e.hoverX = DOME_X + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 200);
                e.hoverY = 230 + Math.random() * 160;
              } else {
                e.x += vx / vd * step;
                e.y += vy / vd * step;
              }
            }
            break;
          }
          case 'queen': {
            // Hovers above the field, drops swarmers; comes down to fight when wounded
            const angry = e.hp < e.maxHP * 0.5;
            const tx = angry ? DOME_X : DOME_X + Math.sin(e.t * 0.35) * 380;
            const ty = angry ? DOME_Y - DOME_RADIUS - 30 : 250 + Math.sin(e.t * 0.9) * 40;
            const qx = tx - e.x, qy = ty - e.y, qd = Math.hypot(qx, qy) || 1;
            const qstep = Math.min(qd, spd * 1.6 * dt);
            e.x += qx / qd * qstep;
            e.y += qy / qd * qstep;
            if (angry && dist <= reach + 30 && enemyMelee(e, T, dt))
              return;
            // Venom lance: aims for a second (the tell), then strikes - parry it back
            e.lance = (e.lance === undefined ? 4 : e.lance) - dt;
            if (e.lance <= 1.1 && !e.lanceAim) {
              const ax = DOME_X + (Math.random() - 0.5) * 120;
              e.lanceAim = { tx: ax, ty: DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (ax - DOME_X) * (ax - DOME_X))) };
              if (G.currentView === VIEW_SURFACE)
                SZ.GameAudio.sweep(400, 1600, 1.0, 'sine', 0.05);
            }
            if (e.lance <= 0 && e.lanceAim) {
              e.lance = 6.5;
              G.enemyShots.push({ kind: 'lance', x0: e.x, y0: e.y + e.size * 0.3, tx: e.lanceAim.tx, ty: e.lanceAim.ty, t: 0, dur: 0.35, dmg: Math.ceil(e.damage * 1.6), src: e });
              e.lanceAim = null;
              if (G.currentView === VIEW_SURFACE)
                SZ.GameAudio.play('zap', { pitch: 0.5 });
            }
            e.spawnTimer = (e.spawnTimer === undefined ? 3 : e.spawnTimer) - dt;
            if (e.spawnTimer <= 0 && G.enemies.length < 60) {
              e.spawnTimer = 5.5;
              const base = { threat: threatLevel(), hp: e.maxHP / T.hp * 0.8, damage: e.damage / T.damage, speed: e.speed / T.speed };
              for (let k = 0; k < 3; ++k) {
                const s = spawnEnemy('swarmer', base, { x: e.x + (k - 1) * 26, y: e.y + 20 });
                s.fall = 0;
                s.fallFrom = e.y + 20;
              }
              if (G.currentView === VIEW_SURFACE)
                SZ.GameAudio.sweep(500, 1100, 0.25, 'square', 0.04);
            }
            break;
          }
        }
        // Behemoth stomp: a shockwave that rolls into the dome
        if (e.type === 'behemoth' && dist < 360) {
          e.stomp = (e.stomp === undefined ? 2 : e.stomp) - dt;
          if (e.stomp <= 0) {
            e.stomp = 5.5;
            e.stompAnim = 0.5;
            G.shockwaves.push({ x: e.x, r: 10, from: e.x, hit: false, dmg: Math.ceil(e.damage * 0.6) });
            if (G.currentView === VIEW_SURFACE) {
              screenShake.trigger(7, 260);
              SZ.GameAudio.play('explode', { pitch: 0.55, volume: 0.6 });
            }
          }
        }
      }
      if (e.stompAnim > 0)
        e.stompAnim = Math.max(0, e.stompAnim - dt);

      if (e.hp <= 0)
        killEnemy(e, i);
    }

    // Acid globs arc through the air
    for (let i = G.enemyShots.length - 1; i >= 0; --i) {
      const s = G.enemyShots[i];
      s.t += dt / s.dur;
      if (s.t >= 1) {
        G.enemyShots.splice(i, 1);
        const pc = NS.weapon.parryCheck();
        if (pc) {
          NS.weapon.parryFeedback(s.tx, s.ty, pc === 2);
          NS.weapon.reflectShot(s.tx, s.ty, s.src, Math.round((s.dmg * 3 + G.weaponDamage) * (pc === 2 ? 1.5 : 1)), s.kind || 'acid');
          continue;
        }
        if (G.currentView === VIEW_SURFACE) {
          particles.burst(s.tx, s.ty, 14, { color: s.kind === 'lance' ? '#ff80e0' : '#8aff50', speed: 2.5, life: 0.5, gravity: 0.1 });
          SZ.GameAudio.play('bounce', { pitch: 0.5, volume: 0.6 });
        }
        if (damageDome(s.dmg, s.tx, s.ty, s.kind === 'lance' ? 'Venom lance' : 'Acid'))
          return;
      }
    }
    // Stomp shockwaves
    for (let i = G.shockwaves.length - 1; i >= 0; --i) {
      const w = G.shockwaves[i];
      w.r += 420 * dt;
      if (!w.hit && w.r >= Math.abs(w.from - DOME_X) - DOME_RADIUS) {
        w.hit = true;
        const pc = NS.weapon.parryCheck();
        if (pc)
          NS.weapon.parryFeedback(DOME_X + Math.sign(w.from - DOME_X) * DOME_RADIUS, DOME_Y - 10, pc === 2);
        else if (damageDome(w.dmg, DOME_X + Math.sign(w.from - DOME_X) * DOME_RADIUS, DOME_Y - 10, 'Shockwave'))
          return;
      }
      if (w.r > 700)
        G.shockwaves.splice(i, 1);
    }

    if (G.waveActive && G.enemies.length === 0) {
      G.waveActive = false;
      SZ.GameAudio.play('levelup');
      announce('Swarm beaten!', isNight() && G.world.bursts < 3 ? 'More may come before dawn' : 'The dome holds', '#6fe08a', 'shield');
      saveRun();
    }
  }

  let domeDamageShown = { t: 0, amount: 0, label: '' }; // hits within a moment are shown as one number
  G.domeInvulnerable = 0;    // Emergency Shield time left
  G.emergencyCooldown = 0;
  G.lastStandUsed = false;   // Last Stand saves the dome once per night
  G.keeperIdle = 0;          // seconds without keeper action (Auto-Mine)
  G.dashCooldown = 0;

  // Any hit on the dome: shield gadget, armour, effects and game over. Returns true when the dome is lost.
  function damageDome(amount, ex, ey, label, attacker) {
    if (G.state !== STATE_PLAYING) return false;
    if (G.domeInvulnerable > 0) {
      spawnShieldImpact(ex, ey);
      return false;
    }
    // Shield gadget absorbs the first hit of each night
    if (G.primaryGadget === 'shield' && G.primaryGadgetState.active) {
      G.primaryGadgetState.active = false;
      SZ.GameAudio.play('zap', { pitch: 0.7 });
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Absorbed!', { color: '#4af', font: 'bold 28px sans-serif' });
      particles.burst(ex, ey, 15, { color: '#4af', speed: 3, life: 0.5 });
      spawnShieldImpact(ex, ey);
      return false;
    }
    let effectiveDmg = amount;
    if (G.unlockedTools.reinforcedDome) effectiveDmg = Math.ceil(effectiveDmg * 0.75);
    if (G.unlockedTools.energyShield) effectiveDmg = Math.ceil(effectiveDmg * 0.85);
    if (G.unlockedTools.fortifiedBase) effectiveDmg = Math.ceil(effectiveDmg * 0.9);
    // Chronoglass: a heavy hit slows the monsters down
    if (NS.artifacts.hasArtifact('chronoGlass') && effectiveDmg >= 5 && G.artifactState.chronoCd <= 0) {
      G.artifactState.timeSlow = 4;
      G.artifactState.chronoCd = 20;
      announce('Chronoglass', 'Time slows to a crawl for the monsters', '#a0c0ff', 'artChrono');
      SZ.GameAudio.sweep(900, 200, 0.8, 'triangle', 0.08);
    }
    // Aegis Heart soaks up the hit first
    if (NS.artifacts.hasArtifact('aegisHeart')) {
      G.artifactState.aegisDelay = 4;
      const soak = Math.min(G.artifactState.aegis, effectiveDmg);
      if (soak > 0) {
        G.artifactState.aegis -= soak;
        effectiveDmg -= soak;
        spawnShieldImpact(ex, ey);
        particles.burst(ex, ey, 8, { color: '#9ae0ff', speed: 2.5, life: 0.35 });
        if (effectiveDmg <= 0) {
          SZ.GameAudio.play('hit', { pitch: 1.6, volume: 0.5 });
          return false;
        }
      }
    }
    // Damage Reflect sends part of a melee hit back
    if (attacker && G.unlockedTools.damageReflect && G.enemies.includes(attacker))
      applyDamageToEnemy(attacker, Math.ceil(effectiveDmg * 0.15 * getEffectiveLevel('damageReflect')));
    G.domeHP -= effectiveDmg;
    if (G.domeHP <= 0 && G.unlockedTools.lastStand && !G.lastStandUsed) {
      G.domeHP = 1;
      G.lastStandUsed = true;
      announce('Last Stand!', 'The dome refuses to break - once per night', '#ff6a6a', 'heart');
    }
    // Phoenix Feather: rise again once per site
    if (G.domeHP <= 0 && NS.artifacts.hasArtifact('phoenixFeather') && !G.artifactState.phoenixUsed) {
      G.artifactState.phoenixUsed = true;
      G.domeHP = Math.ceil(G.maxDomeHP * 0.5);
      announce('Phoenix Feather!', 'The dome rises from the flames - once per site', '#ff8a40', 'artPhoenix');
      SZ.GameAudio.play('powerup', { pitch: 0.6 });
      particles.burst(DOME_X, DOME_Y - 40, 60, { color: '#ff9a40', speed: 5, life: 0.9 });
      particles.burst(DOME_X, DOME_Y - 40, 30, { color: '#ffe080', speed: 3, life: 0.7 });
      screenShake.trigger(12, 400);
    }
    if (G.unlockedTools.emergencyShield && G.domeHP > 0 && G.domeHP < G.maxDomeHP * 0.15 && G.emergencyCooldown <= 0) {
      G.domeInvulnerable = 3;
      G.emergencyCooldown = 60;
      announce('Emergency Shield!', 'The dome is invulnerable for 3 seconds', '#6cc8ff', 'shield');
      SZ.GameAudio.play('powerup', { pitch: 0.8 });
    }
    G.domeHitFlash = 1.0;
    screenShake.trigger(8, 250);
    // several attackers hit at once: one groan per moment, not a chorus
    const hurtNow = performance.now();
    if (hurtNow - G.lastDomeHurtSound > 400) {
      G.lastDomeHurtSound = hurtNow;
      SZ.GameAudio.play('hurt', { volume: 0.7 });
    }
    domeDamageShown.amount += effectiveDmg;
    if (label) domeDamageShown.label = label;
    const nowMs = performance.now();
    if (nowMs - domeDamageShown.t > 450) {
      floatingText.add(DOME_X + (Math.random() - 0.5) * 80, DOME_Y - 60, domeDamageShown.label ? `${domeDamageShown.label} -${domeDamageShown.amount}` : `-${domeDamageShown.amount} HP`, { color: '#f44', font: 'bold 28px sans-serif' });
      domeDamageShown = { t: nowMs, amount: 0, label: '' };
    }
    spawnShieldImpact(ex, ey);
    // Sparks along the shield surface
    const impactAngle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    for (let s = 0; s < 12; ++s) {
      const sa = impactAngle + (Math.random() - 0.5) * 0.6;
      particles.trail(DOME_X + Math.cos(sa) * DOME_RADIUS, DOME_Y + Math.sin(sa) * DOME_RADIUS, {
        vx: Math.cos(sa) * (1 + Math.random() * 2),
        vy: Math.sin(sa) * (1 + Math.random() * 2) - 1,
        color: Math.random() > 0.5 ? '#4af' : '#8cf',
        life: 0.3 + Math.random() * 0.3,
        size: 1 + Math.random() * 2
      });
    }
    if (G.domeHP <= 0) {
      G.domeHP = 0;
      G.state = STATE_GAME_OVER;
      particles.burst(DOME_X, DOME_Y, 40, { color: '#4af', speed: 5, life: 0.8 });
      particles.burst(DOME_X, DOME_Y, 25, { color: '#f80', speed: 4, life: 0.6 });
      screenShake.trigger(15, 500);
      SZ.GameAudio.play('explode');
      SZ.GameAudio.play('lose');
      addHighScore(G.waveNumber, G.score);
      clearSave();
      NS.app.updateWindowTitle();
      return true;
    }
    return false;
  }

  NS.waves = { ENEMY_TYPES, ELITE_AURAS, threatLevel, threatColor, enemyType, spawnWave, updateEnemies,
    damageDome };
})();
