;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { CombatGrid, CombatUnit, Pathfinding, D20, EnemyAI, Character, Terrain, Spells, CLASSES, CombatPhase } = TR;
  const { ENEMY_TEMPLATES, CREATURE_TYPES, BOSS_TEMPLATES, templateToCharacter, getBossPhase } = TR.CombatTemplates;

  class CombatEngine {
    _prng;
    _grid;
    _units;
    _turnOrder;
    _turnIndex;
    _round;
    _phase;
    _moveRange;
    _pendingMove;
    _prevPosition;
    _combatLog;
    _listeners;
    _selectedSpell;
    _aiTier;
    _coordinatedPlan;
    _plannedRound = 0;
    _conditions = null;
    _cooldowns = new Map();
    _auraDone = new Set();
    _skipGuard = 0;
    _planeTraits = [];

    constructor(prng) {
      this._prng = prng;
      this._grid = null;
      this._units = [];
      this._turnOrder = [];
      this._turnIndex = 0;
      this._round = 1;
      this._phase = CombatPhase.INIT;
      this._moveRange = null;
      this._pendingMove = null;
      this._prevPosition = null;
      this._combatLog = [];
      this._listeners = new Map();
      this._selectedSpell = null;
      this._aiTier = 0;
      this._coordinatedPlan = null;
    }

    get grid() { return this._grid; }
    get planeTraits() { return this._planeTraits; }

    // The traits of the plane the fight happens on (TR.PlaneWorlds.traits):
    // call after the units are placed.
    setPlaneTraits(traits) {
      this._planeTraits = (traits || []).slice();
      for (const t of this._planeTraits)
        if (t.passMode)
          for (const u of this._units)
            u.grantPassMode(t.passMode);
      if (this._planeTraits.length)
        this._combatLog.push(`The plane: ${this._planeTraits.map(t => t.name).join(', ')}`);
    }

    _planeTrait(key) {
      return this._planeTraits.find(t => t[key] != null) || null;
    }

    // natives of an aligned plane hit a little more often, visitors of a
    // despairing one a little less
    _planeAttackBonus(unit) {
      let bonus = 0;
      const home = this._planeTrait('natives');
      const subs = unit.character.subtypes || [];
      const native = !!home && home.natives.every(s => subs.includes(s));
      if (native)
        bonus += 1;
      const visitors = this._planeTrait('visitorAttack');
      if (visitors && !native && unit.faction === 'party')
        bonus += visitors.visitorAttack;
      return bonus;
    }

    // energy of the plane burning, freezing or draining at a turn's start
    _planeTurnEffects(unit) {
      const hz = this._planeTrait('hazard');
      if (hz && unit.isAlive) {
        const { energy, dice } = hz.hazard;
        const ch = unit.character;
        const undead = ch.creatureType === 'undead';
        const kin = (ch.subtypes || []).includes(energy);
        if (!(energy === 'negative' && (undead || ch.creatureType === 'construct')) && !kin) {
          let dmg = 0;
          for (let i = 0; i < dice[0]; ++i)
            dmg += 1 + Math.floor(this._prng.next() * dice[1]);
          const adj = TR.MonsterAbilities && energy !== 'negative' ? TR.MonsterAbilities.adjustDamage(unit, dmg, energy) : { amount: dmg, note: null };
          if (adj.amount > 0) {
            unit.takeDamage(adj.amount);
            this._combatLog.push(`${unit.logName} suffers ${adj.amount} ${energy} damage (${hz.name})${unit.isAlive ? '' : ' - SLAIN!'}`);
            this._emit('planeEffect', { unit, amount: adj.amount, kind: energy, trait: hz.id });
          } else if (adj.note)
            this._combatLog.push(`${unit.logName}: ${adj.note}`);
        }
      }
      const vital = this._planeTrait('heal');
      if (vital && unit.isAlive && unit.currentHp < unit.maxHp) {
        const before = unit.currentHp;
        unit.heal(vital.heal);
        if (unit.currentHp > before)
          this._emit('planeEffect', { unit, amount: -(unit.currentHp - before), kind: 'positive', trait: vital.id });
      }
    }

    // spell damage after the plane's magic: elements, potency, wild surges
    _planeSpellDamage(spell, raw) {
      if (!this._planeTraits.length || raw <= 0)
        return raw;
      let mult = 1;
      const el = TR.MonsterAbilities ? TR.MonsterAbilities.spellElement(spell) : null;
      const elem = this._planeTrait('energy');
      if (elem && el === elem.energy)
        mult *= 1.5;
      else if (elem && el === elem.opposed)
        mult *= 0.5;
      const potent = this._planeTrait('spellMult');
      if (potent)
        mult *= potent.spellMult;
      if (this._planeTrait('wild'))
        mult *= 0.5 + this._prng.next();
      return Math.max(1, Math.round(raw * mult));
    }
    get aiTier() { return this._aiTier; }
    setAiTier(tier) { this._aiTier = Math.min(4, Math.max(0, tier || 0)); }
    get units() { return this._units; }
    get turnOrder() { return this._turnOrder; }
    get turnIndex() { return this._turnIndex; }
    get round() { return this._round; }
    get phase() { return this._phase; }
    get moveRange() { return this._moveRange; }
    get combatLog() { return this._combatLog; }
    get selectedSpell() { return this._selectedSpell; }

    get currentUnit() {
      if (this._turnOrder.length === 0)
        return null;
      return this.unitById(this._turnOrder[this._turnIndex].id);
    }

    static get ENEMY_TEMPLATES() { return ENEMY_TEMPLATES; }
    static get BOSS_TEMPLATES() { return BOSS_TEMPLATES; }
    static get CREATURE_TYPES() { return CREATURE_TYPES; }

    initCombat(party, enemies, gridCols, gridRows, biome) {
      this._resetEffects();
      CombatUnit.resetCombatTags();
      this._grid = CombatGrid.generate(gridCols, gridRows, this._prng.fork('grid'), biome);
      this._units = [];
      this._combatLog = [];
      this._round = 1;
      this._turnIndex = 0;

      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const row = Math.floor(gridRows / 2) - Math.floor(party.length / 2) + i;
        const col = 1;
        const r = Math.max(0, Math.min(gridRows - 1, row));
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this._prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', col, r);
        this._units.push(unit);
        this._grid.placeUnit(id, col, r);
      }

      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this._prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const row = Math.floor(gridRows / 2) - Math.floor(enemies.length / 2) + i;
        const col = gridCols - 2;
        const r = Math.max(0, Math.min(gridRows - 1, row));
        const unit = new CombatUnit(id, char, 'enemy', col, r);
        this._units.push(unit);
        this._grid.placeUnit(id, col, r);
      }

      const initEntries = [];
      for (const u of this._units) {
        const roll = D20.rollInitiative(this._prng, u.dexMod, 0);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this._turnOrder = D20.sortInitiative(initEntries, this._prng);

      this._combatLog.push(`Combat begins! Round ${this._round}`);
      for (const e of this._turnOrder)
        this._combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this._phase = CombatPhase.TURN_START;
    }

    // Battle on a prepared board with everyone already placed (dungeon
    // encounters). `ambush` gives the side that noticed the other first a
    // head start on initiative: 'party', 'enemy' or null.
    initCombatAt(party, enemies, grid, partyPositions, enemyPositions, { ambush = null } = {}) {
      this._resetEffects();
      CombatUnit.resetCombatTags();
      this._grid = grid;
      this._units = [];
      this._combatLog = [];
      this._round = 1;
      this._turnIndex = 0;

      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const slot = partyPositions[i] || partyPositions[partyPositions.length - 1];
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this._prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', slot.col, slot.row);
        this._units.push(unit);
        this._grid.placeUnit(id, slot.col, slot.row);
      }

      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this._prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const slot = enemyPositions[i];
        const unit = new CombatUnit(id, char, 'enemy', slot.col, slot.row);
        this._units.push(unit);
        this._grid.placeUnit(id, slot.col, slot.row);
      }

      const initEntries = [];
      for (const u of this._units) {
        const head = ambush && ambush === u.faction ? 10 : 0;
        const roll = D20.rollInitiative(this._prng, u.dexMod, head);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this._turnOrder = D20.sortInitiative(initEntries, this._prng);

      this._combatLog.push(ambush === 'party' ? 'You catch them unawares!' : ambush === 'enemy' ? 'They were waiting for you!' : `Combat begins! Round ${this._round}`);
      for (const e of this._turnOrder)
        this._combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this._phase = CombatPhase.TURN_START;
    }

    initCombatWithGrid(party, enemies, grid, biome, partyCenter) {
      this._resetEffects();
      CombatUnit.resetCombatTags();
      this._grid = grid;
      this._units = [];
      this._combatLog = [];
      this._round = 1;
      this._turnIndex = 0;

      const isPassable = (c, r) => {
        if (!grid.inBounds(c, r))
          return false;
        const t = grid.terrainAt(c, r);
        if (!t)
          return false;
        const id = t.id;
        return id !== 'water' && id !== 'mountain';
      };

      const findPassableNear = (centerCol, centerRow, minDist, maxDist) => {
        const candidates = [];
        for (let r = centerRow - maxDist; r <= centerRow + maxDist; ++r)
          for (let c = centerCol - maxDist; c <= centerCol + maxDist; ++c) {
            const dist = Math.abs(c - centerCol) + Math.abs(r - centerRow);
            if (dist < minDist || dist > maxDist)
              continue;
            if (isPassable(c, r) && !grid.isOccupied(c, r))
              candidates.push({ col: c, row: r, dist });
          }
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates;
      };

      const pc = partyCenter || { col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) };

      const partySlots = findPassableNear(pc.col, pc.row, 0, 3);
      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const slot = partySlots[i] || partySlots[partySlots.length - 1] || pc;
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this._prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', slot.col, slot.row);
        this._units.push(unit);
        this._grid.placeUnit(id, slot.col, slot.row);
      }

      const enemySlots = findPassableNear(pc.col, pc.row, 4, 6);
      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this._prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const slot = enemySlots[i] || enemySlots[enemySlots.length - 1] || { col: pc.col + 4, row: pc.row };
        const unit = new CombatUnit(id, char, 'enemy', slot.col, slot.row);
        this._units.push(unit);
        this._grid.placeUnit(id, slot.col, slot.row);
      }

      const initEntries = [];
      for (const u of this._units) {
        const roll = D20.rollInitiative(this._prng, u.dexMod, 0);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this._turnOrder = D20.sortInitiative(initEntries, this._prng);

      this._combatLog.push(`Combat begins! Round ${this._round}`);
      for (const e of this._turnOrder)
        this._combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this._phase = CombatPhase.TURN_START;
    }

    startTurn() {
      const unit = this.currentUnit;
      if (!unit)
        return;
      // a side can fall outside an attack (traps, effects, a fled foe)
      if (this.checkVictory()) {
        this._phase = CombatPhase.VICTORY;
        return;
      }
      if (this.checkDefeat()) {
        this._phase = CombatPhase.DEFEAT;
        return;
      }

      while (!unit.isAlive) {
        this.nextTurn();
        return this.startTurn();
      }

      // conditions run out, wounds knit; the helpless lose their turn
      if (!this._beginTurnEffects(unit) && this._skipGuard < 200) {
        ++this._skipGuard;
        this.nextTurn();
        return this.startTurn();
      }
      this._skipGuard = 0;

      unit.beginTurn();
      this._emit('turnStart', { unit });

      if (unit.faction === 'party') {
        const fx = this._effects(unit);
        this._moveRange = Pathfinding.movementRange(this._grid, unit.position, fx && !fx.canMove ? 0 : unit.speedTiles, unit.faction, unit.passMode);
        this._phase = CombatPhase.AWAITING_MOVE;
      } else {
        this._phase = CombatPhase.ENEMY_TURN;
      }
    }

    selectMoveTile(col, row) {
      if (this._phase !== CombatPhase.AWAITING_MOVE)
        return false;
      const key = `${col},${row}`;
      if (!this._moveRange || !this._moveRange.has(key))
        return false;
      if (this._grid.isOccupied(col, row) && this._grid.unitAt(col, row) !== this.currentUnit.id)
        return false;
      this._pendingMove = { col, row };
      return true;
    }

    confirmMove() {
      if (!this._pendingMove)
        return;
      const unit = this.currentUnit;
      const prev = unit.position;
      this._prevPosition = { col: prev.col, row: prev.row };

      this._grid.moveUnit(unit.id, this._pendingMove.col, this._pendingMove.row);
      unit.setPosition(this._pendingMove.col, this._pendingMove.row);
      unit.endMove();
      this._pendingMove = null;
      this._phase = CombatPhase.AWAITING_ACTION;
    }

    undoMove() {
      if (this._phase !== CombatPhase.AWAITING_ACTION || !this._prevPosition)
        return;
      const unit = this.currentUnit;
      this._grid.moveUnit(unit.id, this._prevPosition.col, this._prevPosition.row);
      unit.undoMove(this._prevPosition.col, this._prevPosition.row);
      this._prevPosition = null;
      this._moveRange = Pathfinding.movementRange(this._grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
      this._phase = CombatPhase.AWAITING_MOVE;
    }

    selectAttack() {
      if (this._phase !== CombatPhase.AWAITING_ACTION && this._phase !== CombatPhase.AWAITING_MOVE)
        return;
      this._phase = CombatPhase.AWAITING_TARGET;
    }

    cancelTarget() {
      if (this._phase !== CombatPhase.AWAITING_TARGET && this._phase !== CombatPhase.AWAITING_SPELL_TARGET)
        return;
      this._selectedSpell = null;
      const unit = this.currentUnit;
      if (unit && unit.hasMoved)
        this._phase = CombatPhase.AWAITING_ACTION;
      else
        this._phase = CombatPhase.AWAITING_MOVE;
    }

    selectSpell(spellId) {
      if (this._phase !== CombatPhase.AWAITING_ACTION && this._phase !== CombatPhase.AWAITING_MOVE)
        return false;
      const unit = this.currentUnit;
      if (!unit)
        return false;
      const spell = Spells ? Spells.byId(spellId) : null;
      if (!spell || !unit.canCastSpell(spell))
        return false;
      this._selectedSpell = spell;
      this._phase = CombatPhase.AWAITING_SPELL_TARGET;
      return true;
    }

    getSpellTargets(unitId, spellId) {
      const unit = this.unitById(unitId);
      if (!unit || !Spells)
        return [];
      const spell = Spells.byId(spellId);
      if (!spell)
        return [];
      return Spells.getSpellTargetsInRange(this._grid, unit.position, spell, unit.faction, this._units);
    }

    selectSpellTarget(col, row) {
      if (this._phase !== CombatPhase.AWAITING_SPELL_TARGET || !this._selectedSpell)
        return null;
      const spell = this._selectedSpell;

      if (spell.aoe && spell.aoe > 0)
        return this.selectAoeSpellTarget(col, row);

      const targetId = this._grid.unitAt(col, row);
      if (!targetId)
        return null;
      const targets = this.getSpellTargets(this.currentUnit.id, spell.id);
      if (!targets.includes(targetId))
        return null;
      const result = this.resolveSpell(this.currentUnit.id, targetId, spell.id);
      this.currentUnit.endAction();
      this._selectedSpell = null;
      if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
        this._phase = CombatPhase.TURN_END;
      return result;
    }

    selectAoeSpellTarget(col, row) {
      if (this._phase !== CombatPhase.AWAITING_SPELL_TARGET || !this._selectedSpell)
        return null;
      const spell = this._selectedSpell;
      const caster = this.currentUnit;
      if (!caster)
        return null;

      const dist = Math.abs(caster.position.col - col) + Math.abs(caster.position.row - row);
      if (dist > spell.range)
        return null;

      const result = this.resolveAoeSpell(caster.id, spell.id, col, row);
      if (!result)
        return null;
      caster.endAction();
      this._selectedSpell = null;
      if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
        this._phase = CombatPhase.TURN_END;
      return result;
    }

  }

  CombatEngine.templateToCharacter = TR.CombatTemplates.templateToCharacter;
  CombatEngine.scaleCreature = TR.CombatTemplates.scaleCreature;
  CombatEngine.levelUpTemplate = TR.CombatTemplates.levelUpTemplate;
  CombatEngine.createBossCharacter = TR.CombatTemplates.createBossCharacter;
  CombatEngine.getBossPhase = TR.CombatTemplates.getBossPhase;

  TR.CombatEngine = CombatEngine;
})();
