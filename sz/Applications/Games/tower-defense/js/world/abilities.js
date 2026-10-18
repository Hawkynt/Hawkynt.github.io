/* world/abilities.js -- airstrike, deep freeze and gold rush: research nodes, cooldowns and effects.
   Owns state: G.rushTimer, G.abilityAim, G.strikes, G.freezeFlash
   Reads: constants, enemyTypes, env, widgets, effects, research, bossRewards, waves, combat and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_PLAYING, WORLD_W, WORLD_H, clamp } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { audio } = NS.env;
  const { UI, pressFx } = NS.widgets;
  const { fxRandom, particles, floatingText, explosionFx, showBanner, addShake } = NS.effects;
  const { TREE, TREE_BY_ID, techLevel } = NS.research;
  const { hasRelic } = NS.bossRewards;

  /* ══════════════════════════════════════════════════════════════════
     ABILITIES -- airstrike, deep freeze and gold rush, with cooldowns;
     unlocked and improved in the Abilities branch of the research
     ══════════════════════════════════════════════════════════════════ */

  TREE.push(
    { id: 'ab_strike', branch: 'abilities', col: 0, row: 1, max: 1, cost: [3], req: [], icon: 'bomb',
      name: 'Airstrike', desc: 'Call bombers onto a spot of your choice (Q).', effect: () => 'Airstrike unlocked' },
    { id: 'ab_strike2', branch: 'abilities', col: 1, row: 0, max: 2, cost: [5, 8], req: ['ab_strike'], icon: 'bomb',
      name: 'Heavy Payload', desc: 'Bigger bombs for the airstrike.', effect: (l) => `+${l * 35}% airstrike damage` },
    { id: 'ab_freeze', branch: 'abilities', col: 1, row: 1, max: 1, cost: [6], req: ['ab_strike'], icon: 'snow',
      name: 'Deep Freeze', desc: 'Freeze every enemy on the field solid (W).', effect: () => 'Deep Freeze unlocked' },
    { id: 'ab_freeze2', branch: 'abilities', col: 2, row: 1, max: 2, cost: [5, 8], req: ['ab_freeze'], icon: 'snow',
      name: 'Permafrost', desc: 'The freeze lasts longer.', effect: (l) => `+${l} s freeze` },
    { id: 'ab_rush', branch: 'abilities', col: 1, row: 2, max: 1, cost: [6], req: ['ab_strike'], icon: 'rush',
      name: 'Gold Rush', desc: 'For a while every kill pays double (E).', effect: () => 'Gold Rush unlocked' },
    { id: 'ab_rush2', branch: 'abilities', col: 2, row: 2, max: 2, cost: [5, 8], req: ['ab_rush'], icon: 'rush',
      name: 'Long Rush', desc: 'The gold rush lasts longer.', effect: (l) => `+${l * 4} s gold rush` },
    { id: 'ab_cool', branch: 'abilities', col: 2, row: 0, max: 2, cost: [6, 10], req: ['ab_strike2'], icon: 'clock',
      name: 'Quick Command', desc: 'All abilities recharge faster.', effect: (l) => `-${l * 15}% cooldowns` }
  );
  for (const n of TREE) TREE_BY_ID[n.id] = n;

  const ABILITIES = [
    { id: 'strike', key: 'Q', node: 'ab_strike', name: 'Airstrike', icon: 'bomb', color: '#ff8a3a', cooldown: 40, aim: true,
      desc: 'Bombers carpet a line through the chosen spot.' },
    { id: 'freeze', key: 'W', node: 'ab_freeze', name: 'Deep Freeze', icon: 'snow', color: '#9ae4ff', cooldown: 60,
      desc: 'Every enemy on the field freezes solid; bosses are slowed.' },
    { id: 'rush', key: 'E', node: 'ab_rush', name: 'Gold Rush', icon: 'rush', color: '#ffd75a', cooldown: 75,
      desc: 'Every kill pays double gold for a while.' }
  ];

  const abilityCd = { strike: 0, freeze: 0, rush: 0 };

  function abilityUnlocked(a) {
    return techLevel(a.node) > 0;
  }

  function abilityCooldown(a) {
    return a.cooldown * (1 - techLevel('ab_cool') * 0.15) * (hasRelic('hourglass') ? 0.75 : 1);
  }

  function strikeDamage() {
    return 70 * NS.waves.waveHpScale(Math.max(1, G.currentWave)) * 0.55 * (1 + techLevel('ab_strike2') * 0.35);
  }

  function freezeTime() {
    return 3 + techLevel('ab_freeze2');
  }

  function rushTime() {
    return 12 + techLevel('ab_rush2') * 4;
  }

  function abilityReady(a) {
    return abilityUnlocked(a) && abilityCd[a.id] <= 0 && G.state === STATE_PLAYING;
  }

  function useAbility(id, wx, wy) {
    const a = ABILITIES.find(q => q.id === id);
    if (!a) return false;
    if (!abilityUnlocked(a) || G.state !== STATE_PLAYING || abilityCd[id] > 0) {
      audio.play('error');
      if (!abilityUnlocked(a))
        floatingText.add(WORLD_W / 2, WORLD_H - 30, `${a.name} is locked: unlock it in Research`, { color: '#c890ff', font: 'bold 12px sans-serif', life: 1.8 });
      return false;
    }
    if (a.aim && wx === undefined) {
      G.abilityAim = G.abilityAim === id ? null : id;
      G.selectedTowerType = -1;
      audio.play('select', { pitch: 1.2 });
      return true;
    }
    G.abilityAim = null;
    abilityCd[id] = abilityCooldown(a);
    pressFx['ability-' + id] = performance.now();
    if (id === 'strike') {
      G.strikes.push({ x: clamp(wx, 0, WORLD_W), y: clamp(wy, 0, WORLD_H), t: 0, dropped: 0 });
      audio.play('whoosh', { pitch: 0.6, volume: 0.8 });
    } else if (id === 'freeze') {
      for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        if (ENEMY_TYPES[e.type].boss) NS.combat.applySlow(e, 0.5, freezeTime());
        else e.freezeTimer = Math.max(e.freezeTimer, freezeTime());
        particles.flakes(e.x, e.y - 6, 6);
      }
      G.fxLines.push({ kind: 'ring', x: WORLD_W / 2, y: WORLD_H / 2, r: WORLD_W * 0.7, color: '#e6f8ff', t: 0, life: 0.7 });
      particles.glow(WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.5, '#bfeaff', 0.4);
      G.freezeFlash = 1;
      audio.play('zap', { pitch: 0.5 });
      audio.play('lineClear', { pitch: 1.4, volume: 0.6 });
      showBanner('DEEP FREEZE', `${freezeTime()} seconds`, '#9ae4ff', 1.6);
    } else if (id === 'rush') {
      G.rushTimer = rushTime();
      audio.play('powerup', { pitch: 1.3 });
      showBanner('GOLD RUSH', `Double gold for ${rushTime()} seconds`, UI.gold, 1.6);
    }
    return true;
  }

  function updateAbilities(dt) {
    for (const a of ABILITIES)
      if (abilityCd[a.id] > 0) abilityCd[a.id] = Math.max(0, abilityCd[a.id] - dt);
    if (G.rushTimer > 0) G.rushTimer = Math.max(0, G.rushTimer - dt);
    for (let i = G.strikes.length - 1; i >= 0; --i) {
      const s = G.strikes[i];
      s.t += dt;
      // Three bombs fall along the flight line, then explode where they land
      const drops = [0.42, 0.52, 0.62];
      while (s.dropped < 3 && s.t >= drops[s.dropped]) {
        const off = (s.dropped - 1) * CELL * 1.3;
        G.projectiles.push({ kind: 'airbomb', x: s.x + off, y: s.y, sx: s.x + off, sy: s.y, tx: s.x + off, ty: s.y, t: 0, dur: 0.35, damage: strikeDamage(), tower: null, s: { pierce: 0.5, splash: 1.4 }, color: '#2a2a30' });
        ++s.dropped;
      }
      if (s.t > 1.6) G.strikes.splice(i, 1);
    }
  }

  // Bombs of the airstrike land here (called from the projectile update)
  function airbombHit(p) {
    const r = CELL * 1.4;
    for (const e of NS.combat.enemiesNear(p.tx, p.ty, r))
      NS.combat.hurt(e, p.damage, null, 'phys', { pierce: 0.5, area: true });
    explosionFx(p.tx, p.ty, r, '#ff7a2a');
    addShake(5, 220);
    audio.play('explode', { pitch: 0.9 + fxRandom() * 0.2, volume: 0.7 });
  }

  NS.abilities = { ABILITIES, abilityCd, abilityUnlocked, abilityCooldown, strikeDamage, freezeTime,
      rushTime, useAbility, updateAbilities, airbombHit };

})();
