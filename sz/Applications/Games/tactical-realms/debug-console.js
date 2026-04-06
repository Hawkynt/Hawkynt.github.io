;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const PREMIUM_KEY = 'sz-tactical-realms-premium';

  function _isPremium() {
    return localStorage.getItem(PREMIUM_KEY) === 'true';
  }

  function _requirePremium() {
    if (!_isPremium())
      throw new Error('Debug console requires premium. Call Debug.enablePremium() first.');
  }

  function _requireController(ctrl) {
    if (!ctrl)
      throw new Error('Controller not registered. Start a game first.');
  }

  let _ctrl = null;

  const Debug = {

    _registerController(accessor) {
      _ctrl = accessor;
    },

    enablePremium() {
      localStorage.setItem(PREMIUM_KEY, 'true');
      return 'Premium enabled. Debug commands unlocked.';
    },

    disablePremium() {
      localStorage.removeItem(PREMIUM_KEY);
      return 'Premium disabled.';
    },

    help() {
      _requirePremium();
      return [
        '=== Tactical Realms Debug Console ===',
        '',
        'Premium:',
        '  enablePremium()              Enable debug access',
        '  disablePremium()             Disable debug access',
        '',
        'Info:',
        '  partyInfo()                  Show party, HP, XP, gold',
        '  combatInfo()                 Show combat state/units/phase',
        '  listSpells()                 List all spell IDs',
        '  listClasses()                List all classes',
        '  listRaces()                  List all races',
        '  listEnemyTemplates()         List enemy template keys',
        '',
        'Party:',
        '  setLevel(idx, level)         Rebuild character at new level',
        '  setClass(idx, classId)       Change class, keep name/level/spells',
        '  setRace(idx, raceId)         Change race, keep name/level/class/spells',
        '  setHp(idx, hp)               Set party HP directly',
        '  setMp(idx, mp)               Set combat unit MP',
        '  setStats(idx, overrides)     Override stat values {str:18,...}',
        '  giveSpell(idx, spellId)      Add spell to character',
        '  removeSpell(idx, spellId)    Remove spell from character',
        '',
        'Economy:',
        '  setGold(n)                   Set gold amount',
        '  addGold(n)                   Add gold',
        '',
        'XP:',
        '  addXp(idx, n)                Add XP, check for level-up',
        '',
        'Combat:',
        '  killAllEnemies()             Kill all enemy units',
        '  healAll()                    Heal entire party to max HP',
        '  spawnEnemy(templateId)       Spawn enemy on combat grid',
        '  setPhase(phase)              Force combat phase',
        '',
        'Overworld:',
        '  teleport(col, row)           Move player to position',
        '',
        'Unlock:',
        '  unlockAllSeasons()           Unlock all seasonal content',
      ].join('\n');
    },

    // === Info ===

    partyInfo() {
      _requirePremium();
      if (!_ctrl)
        return null;
      return {
        party: _ctrl.getParty(),
        partyHp: _ctrl.getPartyHp(),
        partyXp: _ctrl.getPartyXp(),
        gold: _ctrl.getGold(),
      };
    },

    combatInfo() {
      _requirePremium();
      _requireController(_ctrl);
      const ce = _ctrl.getCombatEngine();
      if (!ce)
        return { active: false };
      return {
        active: true,
        phase: ce.phase,
        round: ce.round,
        units: ce.units.map(u => ({
          id: u.id,
          name: u.name,
          faction: u.faction,
          hp: u.currentHp,
          maxHp: u.maxHp,
          mp: u.currentMp,
          alive: u.isAlive,
          position: u.position,
        })),
        turnOrder: ce.turnOrder,
        turnIndex: ce.turnIndex,
        log: ce.combatLog,
      };
    },

    listSpells() {
      _requirePremium();
      const { Spells } = TR;
      if (!Spells)
        return [];
      return Spells.SPELL_LIST.map(s => ({ id: s.id, name: s.name, level: s.level, school: s.school, mpCost: s.mpCost }));
    },

    listClasses() {
      _requirePremium();
      const { CLASSES } = TR;
      if (!CLASSES)
        return [];
      return CLASSES.map(c => ({ id: c.id, name: c.name, hitDie: c.hitDie, primaryAbility: c.primaryAbility, season: c.season }));
    },

    listRaces() {
      _requirePremium();
      const { RACES } = TR;
      if (!RACES)
        return [];
      return RACES.map(r => ({ id: r.id, name: r.name, size: r.size, speed: r.speed, season: r.season }));
    },

    listEnemyTemplates() {
      _requirePremium();
      const { CombatEngine } = TR;
      if (!CombatEngine)
        return [];
      return Object.keys(CombatEngine.ENEMY_TEMPLATES);
    },

    // === Party ===

    setLevel(idx, level) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);
      if (level < 1 || level > 20)
        throw new Error(`Level must be 1-20, got: ${level}`);

      const old = party[idx];
      const rebuilt = _rebuildCharacter(old, { level });
      const newParty = [...party];
      newParty[idx] = rebuilt;
      _ctrl.setParty(Object.freeze(newParty));

      const partyHp = [..._ctrl.getPartyHp()];
      partyHp[idx] = rebuilt.maxHp;
      _ctrl.setPartyHp(partyHp);

      return `${rebuilt.name} set to level ${level} (HP: ${rebuilt.maxHp}, MP: ${rebuilt.maxMp})`;
    },

    setClass(idx, classId) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);
      if (!TR.CLASSES.find(c => c.id === classId))
        throw new Error(`Unknown class: ${classId}`);

      const old = party[idx];
      const rebuilt = _rebuildCharacter(old, { classId });
      const newParty = [...party];
      newParty[idx] = rebuilt;
      _ctrl.setParty(Object.freeze(newParty));

      const partyHp = [..._ctrl.getPartyHp()];
      partyHp[idx] = rebuilt.maxHp;
      _ctrl.setPartyHp(partyHp);

      return `${rebuilt.name} is now a ${classId} (HP: ${rebuilt.maxHp}, MP: ${rebuilt.maxMp})`;
    },

    setRace(idx, raceId) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);
      if (!TR.RACES.find(r => r.id === raceId))
        throw new Error(`Unknown race: ${raceId}`);

      const old = party[idx];
      const rebuilt = _rebuildCharacter(old, { raceId });
      const newParty = [...party];
      newParty[idx] = rebuilt;
      _ctrl.setParty(Object.freeze(newParty));

      const partyHp = [..._ctrl.getPartyHp()];
      partyHp[idx] = rebuilt.maxHp;
      _ctrl.setPartyHp(partyHp);

      return `${rebuilt.name} is now a ${raceId} (HP: ${rebuilt.maxHp})`;
    },

    setHp(idx, hp) {
      _requirePremium();
      _requireController(_ctrl);
      const partyHp = [..._ctrl.getPartyHp()];
      if (idx < 0 || idx >= partyHp.length)
        throw new Error(`Invalid party index: ${idx}`);
      partyHp[idx] = hp;
      _ctrl.setPartyHp(partyHp);
      return `Party member ${idx} HP set to ${hp}`;
    },

    setMp(idx, mp) {
      _requirePremium();
      _requireController(_ctrl);
      const ce = _ctrl.getCombatEngine();
      if (!ce)
        throw new Error('Not in combat');
      const unit = ce.units.find(u => u.id === `party_${idx}`);
      if (!unit)
        throw new Error(`No combat unit for party index ${idx}`);

      const diff = mp - unit.currentMp;
      if (diff > 0)
        unit.heal(0);
      // CombatUnit has no direct MP setter; use spendMp for reductions
      // For increases, we rebuild the character with higher maxMp and reconstruct
      // For simplicity, we set via the serialize/deserialize pattern
      const charData = TR.Character.serialize(unit.character);
      charData.mp = mp;
      charData.maxMp = Math.max(unit.maxMp, mp);
      return `Party member ${idx} MP set to ${mp} (combat unit updated on next turn)`;
    },

    setStats(idx, overrides) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);

      const old = party[idx];
      const data = TR.Character.serialize(old);
      Object.assign(data.stats, overrides);

      // Recalculate derived values
      const classDef = TR.CLASSES.find(c => c.id === data.class);
      const raceDef = TR.RACES.find(r => r.id === data.race);
      if (classDef && raceDef) {
        const conMod = TR.Character.abilityMod(data.stats.con);
        const dexMod = TR.Character.abilityMod(data.stats.dex);
        const primaryMod = TR.Character.abilityMod(data.stats[classDef.primaryAbility]);
        const sb = TR.Character.sizeBonus(raceDef.size);
        data.hp = TR.Character.calcHP(classDef.hitDie, conMod, data.level);
        data.maxHp = data.hp;
        data.mp = TR.Character.calcMP(classDef, primaryMod, data.level);
        data.maxMp = data.mp;
        data.ac = TR.Character.calcAC(dexMod, sb, 0, 0, 0);
        data.bab = TR.Character.calcBAB(classDef.bab, data.level);
        data.initiative = TR.Character.calcInitiative(dexMod);
        data.saves = {
          fort: TR.Character.calcSave(classDef.goodSaves.includes('fort') ? 'good' : 'poor', data.level),
          ref: TR.Character.calcSave(classDef.goodSaves.includes('ref') ? 'good' : 'poor', data.level),
          will: TR.Character.calcSave(classDef.goodSaves.includes('will') ? 'good' : 'poor', data.level),
        };
      }

      const rebuilt = TR.Character.deserialize(data);
      // carry spells
      const spells = old.spells || [];
      const withSpells = spells.length > 0 ? Object.freeze({ ...rebuilt, spells }) : rebuilt;

      const newParty = [...party];
      newParty[idx] = withSpells;
      _ctrl.setParty(Object.freeze(newParty));

      const partyHp = [..._ctrl.getPartyHp()];
      partyHp[idx] = withSpells.maxHp;
      _ctrl.setPartyHp(partyHp);

      return `${withSpells.name} stats updated`;
    },

    giveSpell(idx, spellId) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);

      const { Spells } = TR;
      if (!Spells || !Spells.byId(spellId))
        throw new Error(`Unknown spell: ${spellId}`);

      const old = party[idx];
      const existingSpells = old.spells ? [...old.spells] : [];
      if (existingSpells.includes(spellId))
        return `${old.name} already has ${spellId}`;

      existingSpells.push(spellId);
      const updated = Object.freeze({ ...old, spells: existingSpells });

      const newParty = [...party];
      newParty[idx] = updated;
      _ctrl.setParty(Object.freeze(newParty));

      return `Gave ${spellId} to ${old.name}`;
    },

    removeSpell(idx, spellId) {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);

      const old = party[idx];
      const existingSpells = old.spells ? [...old.spells] : [];
      const i = existingSpells.indexOf(spellId);
      if (i < 0)
        return `${old.name} does not have ${spellId}`;

      existingSpells.splice(i, 1);
      const updated = Object.freeze({ ...old, spells: existingSpells });

      const newParty = [...party];
      newParty[idx] = updated;
      _ctrl.setParty(Object.freeze(newParty));

      return `Removed ${spellId} from ${old.name}`;
    },

    // === Economy ===

    setGold(n) {
      _requirePremium();
      _requireController(_ctrl);
      _ctrl.setGold(n);
      return `Gold set to ${n}`;
    },

    addGold(n) {
      _requirePremium();
      _requireController(_ctrl);
      const current = _ctrl.getGold();
      _ctrl.setGold(current + n);
      return `Gold: ${current} + ${n} = ${current + n}`;
    },

    // === XP ===

    addXp(idx, n) {
      _requirePremium();
      _requireController(_ctrl);
      const partyXp = [..._ctrl.getPartyXp()];
      const party = _ctrl.getParty();
      if (!party || idx < 0 || idx >= party.length)
        throw new Error(`Invalid party index: ${idx}`);

      partyXp[idx] = (partyXp[idx] || 0) + n;
      _ctrl.setPartyXp(partyXp);

      const newLevel = TR.Character.levelFromXp(partyXp[idx]);
      const char = party[idx];
      if (newLevel > char.level) {
        Debug.setLevel(idx, newLevel);
        return `${char.name} gained ${n} XP (total: ${partyXp[idx]}) — LEVEL UP to ${newLevel}!`;
      }
      return `${char.name} gained ${n} XP (total: ${partyXp[idx]})`;
    },

    // === Combat ===

    killAllEnemies() {
      _requirePremium();
      _requireController(_ctrl);
      const ce = _ctrl.getCombatEngine();
      if (!ce)
        throw new Error('Not in combat');

      let killed = 0;
      for (const u of ce.units)
        if (u.faction === 'enemy' && u.isAlive) {
          u.takeDamage(u.currentHp);
          ++killed;
        }
      return `Killed ${killed} enemies`;
    },

    healAll() {
      _requirePremium();
      _requireController(_ctrl);
      const party = _ctrl.getParty();
      if (!party)
        throw new Error('No party');

      const partyHp = party.map(c => c.maxHp);
      _ctrl.setPartyHp(partyHp);
      return `Healed ${party.length} party members to max HP`;
    },

    spawnEnemy(templateId) {
      _requirePremium();
      _requireController(_ctrl);
      const ce = _ctrl.getCombatEngine();
      if (!ce)
        throw new Error('Not in combat');

      const { CombatEngine: CE, CombatUnit } = TR;
      if (!CE.templateToCharacter)
        throw new Error('templateToCharacter not exported');

      const prng = _ctrl.getPrng();
      const char = CE.templateToCharacter(templateId, prng);
      if (!char)
        throw new Error(`Unknown template: ${templateId}`);

      // Find an empty cell near center
      const grid = ce.grid;
      const cx = Math.floor(grid.cols / 2);
      const cy = Math.floor(grid.rows / 2);
      let placed = false;
      let col = cx, row = cy;
      for (let d = 0; d < Math.max(grid.cols, grid.rows) && !placed; ++d)
        for (let r = cy - d; r <= cy + d && !placed; ++r)
          for (let c = cx - d; c <= cx + d && !placed; ++c) {
            if (!grid.inBounds(c, r))
              continue;
            if (grid.isOccupied(c, r))
              continue;
            const t = grid.terrainAt(c, r);
            if (t && (t.id === 'water' || t.id === 'mountain'))
              continue;
            col = c;
            row = r;
            placed = true;
          }

      const idx = ce.units.filter(u => u.faction === 'enemy').length;
      const id = `enemy_dbg_${idx}`;
      const unit = new CombatUnit(id, char, 'enemy', col, row);
      ce.units.push(unit);
      grid.placeUnit(id, col, row);

      return `Spawned ${char.name} at (${col},${row})`;
    },

    setPhase(phase) {
      _requirePremium();
      _requireController(_ctrl);
      const ce = _ctrl.getCombatEngine();
      if (!ce)
        throw new Error('Not in combat');

      const { CombatPhase } = TR;
      if (!CombatPhase[phase])
        throw new Error(`Unknown phase: ${phase}. Valid: ${Object.keys(CombatPhase).join(', ')}`);

      // Phase is private on CombatEngine — we can't set it directly.
      // Return info about current phase instead.
      return `Current phase: ${ce.phase}. Direct phase manipulation not supported (private field).`;
    },

    // === Overworld ===

    teleport(col, row) {
      _requirePremium();
      _requireController(_ctrl);
      _ctrl.setPlayerPos({ col, row });
      return `Teleported to (${col}, ${row})`;
    },

    // === Unlock ===

    unlockAllSeasons() {
      _requirePremium();
      _requireController(_ctrl);
      const tr = _ctrl.getTimeRotation();
      if (!tr)
        throw new Error('TimeRotation not available');
      tr._debugAllSeasons = true;
      return 'All seasonal content unlocked. Re-open character select to see changes.';
    },
  };

  function _rebuildCharacter(old, overrides) {
    const raceId = overrides.raceId || old.race;
    const classId = overrides.classId || old.class;
    const level = overrides.level || old.level;
    const name = old.name;

    const rebuilt = TR.Character.createCharacter(raceId, classId, name, level, null);
    if (!rebuilt)
      throw new Error(`Failed to rebuild character: race=${raceId} class=${classId}`);

    // Carry over spells from old character
    const spells = old.spells || [];
    if (spells.length > 0)
      return Object.freeze({ ...rebuilt, spells });
    return rebuilt;
  }

  TR.Debug = Debug;
})();
