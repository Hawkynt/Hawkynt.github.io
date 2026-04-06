;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { Character } = TR;

  // Global combat tag counter, reset per combat session
  let _nextPartyTag = 1;
  let _nextEnemyTag = 1;

  class CombatUnit {
    #id;
    #character;
    #faction;
    #combatTag;
    #currentHp;
    #currentMp;
    #spells;
    #col;
    #row;
    #hasMoved;
    #hasActed;

    constructor(id, character, faction, col, row) {
      this.#id = id;
      this.#character = character;
      this.#faction = faction;
      // Assign unique combat tag: #NN for party, &NN for enemies
      if (faction === 'party')
        this.#combatTag = '#' + String(_nextPartyTag++).padStart(2, '0');
      else
        this.#combatTag = '&' + String(_nextEnemyTag++).padStart(2, '0');
      this.#currentHp = character.hp;
      this.#currentMp = character.mp || 0;
      this.#spells = character.spells || [];
      this.#col = col;
      this.#row = row;
      this.#hasMoved = false;
      this.#hasActed = false;
    }

    // Reset tag counters at start of each combat
    static resetCombatTags() {
      _nextPartyTag = 1;
      _nextEnemyTag = 1;
    }

    get id() { return this.#id; }
    get character() { return this.#character; }
    get faction() { return this.#faction; }
    get combatTag() { return this.#combatTag; }
    get name() { return this.#character.name; }
    // Log-friendly name with unique combat tag: "Yorik Yarrow (#01)" or "Goblin (&03)"
    get logName() { return `${this.#character.name} (${this.#combatTag})`; }
    get currentHp() { return this.#currentHp; }
    get maxHp() { return this.#character.maxHp; }
    // D&D 3.5e death rules:
    // - Party members (PCs): 0 HP = disabled, -1 to -9 = dying, <= -10 = dead
    // - Enemies (monsters): dead at 0 HP (no negative HP tracking for unnamed creatures)
    get isAlive() {
      if (this.#faction === 'party')
        return this.#currentHp > -10;
      return this.#currentHp > 0;
    }
    get isDead() {
      if (this.#faction === 'party')
        return this.#currentHp <= -10;
      return this.#currentHp <= 0;
    }
    get isDying() { return this.#faction === 'party' && this.#currentHp < 0 && this.#currentHp > -10; }
    get isDisabled() { return this.#faction === 'party' && this.#currentHp === 0; }
    get isConscious() { return this.#currentHp > 0; }
    get ac() { return this.#character.ac; }
    get bab() { return this.#character.bab; }
    get speed() { return this.#character.speed; }
    get speedTiles() { return Math.floor(this.#character.speed / 5); }
    get dexMod() { return Character.abilityMod(this.#character.stats.dex); }
    get strMod() { return Character.abilityMod(this.#character.stats.str); }
    get currentMp() { return this.#currentMp; }
    get maxMp() { return this.#character.maxMp || 0; }
    get spells() { return this.#spells; }
    get intMod() { return Character.abilityMod(this.#character.stats.int); }
    get wisMod() { return Character.abilityMod(this.#character.stats.wis); }
    get chaMod() { return Character.abilityMod(this.#character.stats.cha); }
    get hasMoved() { return this.#hasMoved; }
    get hasActed() { return this.#hasActed; }

    get position() {
      return { col: this.#col, row: this.#row };
    }

    takeDamage(amount) {
      this.#currentHp -= amount;
    }

    heal(amount) {
      this.#currentHp = Math.min(this.#character.maxHp, this.#currentHp + amount);
    }

    spendMp(amount) {
      this.#currentMp = Math.max(0, this.#currentMp - amount);
    }

    restoreMp(amount) {
      this.#currentMp = Math.min(this.maxMp, this.#currentMp + amount);
    }

    canCastSpell(spell) {
      if (!spell)
        return false;
      if (spell.level === 0)
        return this.#spells.includes(spell.id);
      return this.#spells.includes(spell.id) && this.#currentMp >= spell.mpCost;
    }

    setPosition(col, row) {
      this.#col = col;
      this.#row = row;
    }

    beginTurn() {
      this.#hasMoved = false;
      this.#hasActed = false;
    }

    endMove() {
      this.#hasMoved = true;
    }

    endAction() {
      this.#hasActed = true;
    }

    undoMove(prevCol, prevRow) {
      this.#col = prevCol;
      this.#row = prevRow;
      this.#hasMoved = false;
    }

    serialize() {
      return {
        id: this.#id,
        character: Character.serialize(this.#character),
        faction: this.#faction,
        currentHp: this.#currentHp,
        currentMp: this.#currentMp,
        spells: [...this.#spells],
        col: this.#col,
        row: this.#row,
        hasMoved: this.#hasMoved,
        hasActed: this.#hasActed,
      };
    }

    static deserialize(data) {
      const character = Character.deserialize(data.character);
      const unit = new CombatUnit(data.id, character, data.faction, data.col, data.row);
      unit.#currentHp = data.currentHp;
      unit.#currentMp = data.currentMp || 0;
      unit.#spells = data.spells || [];
      unit.#hasMoved = data.hasMoved || false;
      unit.#hasActed = data.hasActed || false;
      return unit;
    }
  }

  TR.CombatUnit = CombatUnit;
})();
