/* world/waves.js -- wave generation, starting and calling waves, income, the spawner and the build-phase countdown.
   Owns state: G.previewCache, G.bossIntro, G.lastPaidWave
   Reads: constants, enemyTypes, maps, env, widgets, effects, research, progress, paths, towers, combat,
      savegame, cinematics and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_BUILD, WARNING_DURATION, AUTO_WAVE_DELAY, makeRng, WORLD_W, WORLD_H, clamp } = NS.constants;
  const { ENEMY_TYPES, BOSS_ORDER, BOSS_FROM_RANK, ELITE_HP } = NS.enemyTypes;
  const { MAPS, MAP_RANK } = NS.maps;
  const { screenShake, audio, bossHorn, updateWindowTitle } = NS.env;
  const { UI } = NS.widgets;
  const { fxRandom, particles, floatingText, coinFly, showBanner } = NS.effects;
  const { techLevel, awardResearch, awardWaveResearch } = NS.research;
  const { recordResult } = NS.progress;
  const { enemyPath, pathPos } = NS.paths;
  const { towerStats } = NS.towers;

  /* ══════════════════════════════════════════════════════════════════
     WAVES
     ══════════════════════════════════════════════════════════════════ */

  // Queue tokens: an enemy key, optionally followed by '!' for an elite, or '|' for a pause
  function parseToken(tok) {
    if (typeof tok !== 'string' || tok === '|') return null;
    const elite = tok.charAt(tok.length - 1) === '!';
    const type = elite ? tok.slice(0, -1) : tok;
    return ENEMY_TYPES[type] ? { type, elite } : null;
  }

  function isQueueToken(tok) {
    return tok === '|' || !!parseToken(tok);
  }

  function isBossWave(waveNo, waves) {
    return waveNo === waves || waveNo % 5 === 0;
  }

  // waveNo is 1-based. Picks a few enemy groups from the types unlocked so far
  // and fills the wave's budget; every fifth wave and the last one bring a boss.
  function generateWave(waveNo, mapIndex) {
    const mi = mapIndex === undefined ? G.currentMap : mapIndex;
    const mapDef = MAPS[mi];
    const waves = mapDef.waves;
    const rng = makeRng(mi * 7919 + waveNo * 104729 + 17);
    const progress = (waveNo - 1) / Math.max(1, waves - 1);
    // Early maps only show part of the bestiary and the bosses; both open up along the campaign
    const rank = MAP_RANK[mi];
    const reach = waveNo > waves ? 1 : Math.min(1, 0.4 + rank * 0.03);
    const pool = Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].cost > 0 && !ENEMY_TYPES[k].boss && ENEMY_TYPES[k].unlock <= Math.min(1, progress) * reach + 1e-6);
    const bossPool = waveNo > waves ? BOSS_ORDER : BOSS_ORDER.filter((b, k) => BOSS_FROM_RANK[k] <= rank);
    // A boss that is new on this map leads its last wave
    const debut = BOSS_FROM_RANK.indexOf(rank);
    let budget = (7 + waveNo * 3.2 + waveNo * waveNo * 0.12) * (mapDef.budgetMul || 1);
    const queue = [];
    // The newest type gets the spotlight in the wave it first appears
    const fresh = pool.filter(k => ENEMY_TYPES[k].unlock > Math.min(1, (waveNo - 2) / Math.max(1, waves - 1)) * reach);
    const groups = [];
    const nGroups = waveNo <= 2 ? 1 : Math.min(pool.length, 2 + Math.floor(rng() * 2));
    for (let g = 0; g < nGroups; ++g) {
      const k = g === 0 && fresh.length ? fresh[Math.floor(rng() * fresh.length)] : pool[Math.floor(rng() * pool.length)];
      if (groups.indexOf(k) < 0) groups.push(k);
    }
    if (groups.indexOf('normal') < 0 && waveNo <= 4) groups.push('normal');
    // Past the map's required waves elites keep growing more common
    const eliteChance = waveNo > waves ? Math.min(0.4, 0.22 + (waveNo - waves) * 0.01) : clamp((progress - 0.4) * 0.5, 0, 0.22);
    const boss = isBossWave(waveNo, waves);
    if (boss) budget *= 0.6;
    for (let g = 0; g < groups.length; ++g) {
      const def = ENEMY_TYPES[groups[g]];
      const share = budget / (groups.length - g);
      let n = Math.max(1, Math.round(share / def.cost));
      if (def.pack) n = Math.max(def.pack, Math.round(n / def.pack) * def.pack);
      budget -= n * def.cost;
      if (queue.length) queue.push('|');
      for (let i = 0; i < n; ++i)
        queue.push(groups[g] + (rng() < eliteChance && !def.pack ? '!' : ''));
    }
    if (boss) {
      // Long after the required waves several bosses march together
      const count = waveNo > waves ? 1 + Math.floor((waveNo - waves) / 20) : 1;
      for (let b = 0; b < count; ++b) {
        const bossType = waveNo === waves ? (debut >= 0 ? BOSS_ORDER[debut] : bossPool[rank % bossPool.length]) : bossPool[(Math.floor(waveNo / 5) - 1 + b * 3) % bossPool.length];
        queue.push('|');
        queue.push(bossType + (waveNo === waves || waveNo > waves + 10 ? '!' : ''));
      }
    }
    return queue;
  }

  // Count of each enemy kind in a queue, for the preview
  function summarizeWave(queue) {
    const out = [];
    for (const tok of queue) {
      const p = parseToken(tok);
      if (!p) continue;
      let row = out.find(r => r.type === p.type);
      if (!row) out.push(row = { type: p.type, count: 0, elite: 0 });
      ++row.count;
      if (p.elite) ++row.elite;
    }
    return out;
  }
  function nextWavePreview() {
    const key = G.currentMap + ':' + (G.currentWave + 1);
    if (G.previewCache.key !== key)
      G.previewCache = { key, list: summarizeWave(generateWave(G.currentWave + 1)) };
    return G.previewCache.list;
  }
  // The map's required waves are held: stars, research and the next level open up,
  // but the waves keep coming for as long as the player wants to stay
  function mapCleared() {
    G.cleared = true;
    recordResult(true, G.currentWave);
    const newStars = Math.max(0, G.lastResult.stars - G.lastResult.prevStars);
    const rp = awardResearch(true, newStars);
    for (let i = 0; i < 5; ++i)
      particles.confetti(WORLD_W * (0.15 + i * 0.175), WORLD_H * 0.6, 24, {});
    screenShake.trigger(6, 300);
    audio.play('win');
    NS.cinematics.startCine('outro', { rp });
    updateWindowTitle();
  }

  // Further maps pay better: more gold per kill and more research per wave
  function mapBountyMul(mi) {
    return 1 + MAP_RANK[mi] * 0.02;
  }

  function mapResearchMul(mi) {
    return 1 + MAP_RANK[mi] * 0.04;
  }

  function startNextWave() {
    if (G.state !== STATE_BUILD && !canCallEarly()) return;
    const early = G.state === STATE_PLAYING;
    const queue = generateWave(G.currentWave + 1);
    if (early) {
      G.waveEnemies = G.waveEnemies.concat(['|', '|'], queue);
      G.waveSize += queue.filter(t => t !== '|').length;
      const bonus = earlyBonus();
      G.gold += bonus;
      G.runStats.gold += bonus;
      G.goldPulse = 1;
      coinFly(WORLD_W / 2, WORLD_H * 0.3, 5);
    } else {
      G.waveEnemies = queue;
      G.waveSize = queue.filter(t => t !== '|').length;
      G.spawnTimer = 0;
    }
    G.waveComplete = false;
    ++G.currentWave;
    G.state = STATE_PLAYING;
    G.warningActive = false;
    G.warningTimer = 0;
    announceWave();
    audio.play('select', { pitch: 0.75 });
    audio.play('thud', { pitch: 0.6, volume: 0.7 });
    updateWindowTitle();
    NS.savegame.saveGame();
  }

  function earlyBonus() {
    return Math.round((8 + G.currentWave * 2) * (techLevel('early') ? 1.5 : 1));
  }

  // During a wave the next one may be called once the current one is fully on the field
  function canCallEarly() {
    return G.state === STATE_PLAYING && G.waveEnemies.length === 0;
  }

  function announceWave() {
    const boss = isBossWave(G.currentWave, G.totalWaves);
    const list = summarizeWave(generateWave(G.currentWave)).filter(r => !ENEMY_TYPES[r.type].boss);
    const sub = list.slice(0, 3).map(r => `${r.count} ${ENEMY_TYPES[r.type].name}${r.count > 1 && !/s$/.test(ENEMY_TYPES[r.type].name) ? 's' : ''}`).join(' · ');
    showBanner(G.currentWave === G.totalWaves ? 'FINAL WAVE' : `WAVE ${G.currentWave}`, boss ? 'A boss is coming!' : sub, boss ? '#ff6a6a' : UI.gold);
  }
  // Gold paid when a wave is cleared: flat bonus plus mines and banks
  function payWaveIncome(count) {
    let bonus = 0;
    for (let w = G.currentWave - count + 1; w <= G.currentWave; ++w)
      bonus += 10 + w * 2;
    let bankInterest = 0, bankCap = 0;
    for (const t of G.towers) {
      const s = towerStats(t);
      if (s.income) {
        bonus += s.income * count;
        floatingText.add(t.x, t.y - 22, `+${s.income * count}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
        particles.sparkle(t.x, t.y, 6, { color: '#ffd75a', speed: 2 });
        coinFly(t.x, t.y, 3);
      }
      if (s.interest) {
        bankInterest += s.interest;
        bankCap += s.interestCap;
      }
    }
    if (bankInterest > 0)
      bonus += Math.min(bankCap, Math.floor(G.gold * bankInterest));
    const treasury = techLevel('interest');
    if (treasury)
      bonus += Math.min(25 * treasury, Math.floor(G.gold * 0.02 * treasury));
    // Masonry patches the towers up
    const mend = techLevel('masonry') * 0.2;
    if (mend > 0)
      for (const t of G.towers)
        if (t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * mend);
    G.gold += bonus;
    G.runStats.gold += bonus;
    showBanner('WAVE CLEARED', `+${bonus} gold`, UI.good, 2);
    coinFly(WORLD_W / 2, WORLD_H * 0.25, 6);
    G.goldPulse = 1;
  }

  function beginPreWaveWarning() {
    G.warningActive = true;
    audio.play('blip', { pitch: 0.6 });
    G.warningTimer = WARNING_DURATION;
    G.warningPulse = 0;
  }

  // Health multiplier of a wave (1-based) on the current map
  function waveHpScale(waveNo) {
    const w = Math.max(0, waveNo - 1);
    // Beyond the map's required waves health also grows by 7% a wave
    const extra = Math.max(0, waveNo - MAPS[G.currentMap].waves);
    // Richer maps field tougher enemies in step with their higher bounty; the
    // map's toughness phases in over the first half of its waves
    const mapFactor = (MAPS[G.currentMap].hpMul || 1) * Math.pow(mapBountyMul(G.currentMap), 2.5);
    const phase = clamp(waveNo / (MAPS[G.currentMap].waves * 0.6), 0.3, 1);
    return (1 + 0.11 * w + 0.012 * w * w) * (1 + (mapFactor - 1) * phase) * Math.pow(1.07, extra);
  }

  function spawnEnemy(token, pathIndex, atDist) {
    const p = parseToken(token) || { type: 'normal', elite: false };
    const type = p.type;
    const def = ENEMY_TYPES[type];
    const scale = waveHpScale(Math.max(1, G.currentWave));
    const pi = pathIndex === undefined ? (spawnCounter++ % G.paths.length) : pathIndex;
    const hp = Math.floor(def.hp * scale * (p.elite ? ELITE_HP : 1));
    const shield = def.shielded ? Math.floor(hp * def.shielded) : 0;
    const e = {
      type, elite: p.elite,
      hp, maxHp: hp,
      speed: def.speed * (p.elite ? 1.1 : 1),
      bounty: Math.round(def.bounty * (1 + G.currentWave * 0.02) * (p.elite ? 2 : 1)),
      radius: def.radius * (p.elite ? 1.15 : 1),
      armor: (def.armor || 0) + (p.elite && def.armor ? 2 : 0),
      pi, dist: atDist || 0,
      x: 0, y: 0, angle: 0,
      slowMul: 1, slowTimer: 0, freezeTimer: 0, stunTimer: 0,
      burnDps: 0, burnTimer: 0, poisonDps: 0, poisonTimer: 0, acidTimer: 0, shred: 0,
      shieldHp: shield, shieldMax: shield,
      healCooldown: 1.5 + Math.random(), abilityTimer: 3 + Math.random() * 2,
      revealTimer: 0, revealed: false, haste: 1, enraged: false,
      hitFlash: 0, walk: fxRandom() * 10, spawnT: 0,
      lastHitBy: null, plague: false
    };
    pathPos(enemyPath(e), e.dist, e);
    e._seq = ++G.enemySeq;
    G.enemies.push(e);
    NS.combat.gridInsert(e);
    if (def.boss && !atDist)
      onBossSpawn(e);
    return e;
  }
  let spawnCounter = 0;

  function onBossSpawn(e) {
    G.bossIntro = { e, t: 0 };
    screenShake.trigger(5, 500);
    bossHorn();
  }
  function enemyFlags(e) {
    return ENEMY_TYPES[e.type];
  }

  function updateSpawner(dt) {
    if (G.waveEnemies.length > 0) {
      G.spawnTimer -= dt;
      while (G.spawnTimer <= 0 && G.waveEnemies.length > 0) {
        const tok = G.waveEnemies.shift();
        if (tok === '|') {
          G.spawnTimer += 1.4;
          continue;
        }
        spawnEnemy(tok);
        const p = parseToken(tok);
        G.spawnTimer += (p && ENEMY_TYPES[p.type].gap) || 0.65;
      }
    }
    if (G.waveEnemies.length === 0 && G.enemies.length === 0 && !G.waveComplete && G.state === STATE_PLAYING) {
      G.waveComplete = true;
      G.waveCountdown = 3;
      G.state = STATE_BUILD;
      G.warningActive = false;
      G.projectiles = [];
      G.bossIntro = null;
      for (const t of G.towers) {
        t.beamTargets = [];
        t.beamTime = 0;
      }
      if (G.autoWaveMode)
        G.autoWaveTimer = AUTO_WAVE_DELAY;
      payWaveIncome(Math.max(1, G.currentWave - G.lastPaidWave));
      G.lastPaidWave = G.currentWave;
      if (!G.cleared && G.currentWave >= G.totalWaves)
        mapCleared();
      else {
        if (G.cleared) awardWaveResearch();
        audio.play('levelup');
      }
      NS.savegame.saveGame();
    }
  }
  function updateBuildCountdown(dt) {
    if (G.state !== STATE_BUILD) return;
    if (G.waveCountdown > 0)
      G.waveCountdown -= dt;
    if (!G.warningActive && G.waveCountdown <= WARNING_DURATION && G.waveCountdown > 0)
      beginPreWaveWarning();
    if (G.warningActive) {
      G.warningTimer -= dt;
      G.warningPulse += dt * 4;
      if (G.warningTimer <= 0)
        G.warningActive = false;
    }
    if (G.autoWaveMode && G.waveComplete) {
      G.autoWaveTimer -= dt;
      if (G.autoWaveTimer <= 0)
        startNextWave();
    }
  }

  NS.waves = { parseToken, isQueueToken, isBossWave, generateWave, summarizeWave, nextWavePreview,
      mapBountyMul, mapResearchMul, startNextWave, canCallEarly, waveHpScale, spawnEnemy, enemyFlags,
      updateSpawner, updateBuildCountdown };

})();
