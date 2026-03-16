# Tactical Realms

A tactical RPG / dungeon-crawler for the SZ Desktop, inspired by **Shining Force** (Sega Genesis) combat and the **D&D Forgotten Realms** setting. Roguelike progression, procedurally generated overworlds and dungeons, paper-doll sprites, time-gated content rotation, and mouse-only play.

---

## 1. Product Overview

| Attribute | Value |
|-----------|-------|
| **Platform** | SZ Desktop (browser-based OS) |
| **Rendering** | HTML5 Canvas, 940x660 internal resolution |
| **Input** | Mouse-only (tablet-compatible, no keyboard required) |
| **Save** | localStorage (auto-save on every state transition, versioned format with migration) |
| **Session length** | 15-45 minutes per dungeon run |
| **Hosting mode** | `iframe` (standalone HTML page inside SZ window) |
| **Dependencies** | None -- vanilla JS, IIFE pattern, no build tools |

---

## Implementation Status

### Phase 1: Core Engine -- DONE

All core engine modules implemented with 162 passing browser-based tests.

| Module | File | Status | Tests |
|--------|------|--------|-------|
| Test Runner | `tests/runner.js`, `tests/runner.html` | Done | Framework |
| PRNG | `prng.js` | Done | 20 tests |
| Time Rotation | `time-rotation.js` | Done | 26 tests |
| State Machine | `state-machine.js` | Done | 38 tests |
| Save Crypto | `save-crypto.js` | Done | 10 tests |
| Save Manager | `save-manager.js` | Done | 12 tests |
| Input Handler | `input-handler.js` | Done | 12 tests |
| Renderer | `renderer.js` | Done | 21 tests |
| Controller | `controller.js` | Done | -- |
| Integration | `tests/test-integration.js` | Done | 8 tests |
| Entry Point | `index.html`, `styles.css` | Done | -- |
| Manifest | `Applications/manifest.js` | Done | -- |
| Icon | `icon.svg` | Done | -- |

### Planned Phases

- **Phase 2**: Character system (races, classes, stats, d20 mechanics)
- **Phase 3**: Combat engine (grid-based tactical battles, turn order, terrain)
- **Phase 4**: Dungeon generation (procedural floors, encounters, loot)
- **Phase 5**: Overworld generation (procedural map, towns, zone types)
- **Phase 6**: Content systems (equipment, spells, monsters, NPCs)
- **Phase 7**: Paper-doll sprites (layered canvas rendering)
- **Phase 8**: UI polish (menus, tooltips, animations, sound)

---

## 2. Goals

### Product Goals

- Deliver a deep tactical RPG experience playable entirely in the browser
- Provide daily replay value through time-gated content rotation
- Demonstrate the SZ Desktop's capability for complex game hosting
- Architect for future monetization without compromising free-tier gameplay

### Player Experience Goals

- **Strategic depth**: Every combat encounter requires positioning, terrain awareness, and party composition decisions
- **Discovery**: Daily roster rotation and monthly dungeon regeneration keep the game fresh
- **Collection**: Build a roster of characters, companions, and equipment across sessions
- **Accessibility**: Mouse-only input ensures anyone can play without learning keybinds

---

## 3. Core Pillars

1. **Shining Force combat** -- Grid-based tactical battles with attack cut-in animations, terrain bonuses, flanking, and turn order by speed
2. **D&D Forgotten Realms world** -- Races, classes, spells, monsters, and equipment drawn from the Forgotten Realms setting
3. **Roguelike progression** -- Procedurally generated dungeons with permadeath risk, persistent roster/inventory between runs
4. **Paper-doll sprites** -- Layered canvas rendering: base body + clothing + equipment visually reflected on characters
5. **Time-gated content rotation** -- Daily character rosters, weekly bosses, monthly dungeon layouts, seasonal exclusives

---

## 4. Game Flow

```
 [Title Screen]
       |
 [Character Select] <-- daily roster rotation
       |
   [Overworld] <-- procedurally generated (seeded by month)
      / \
  [Dungeon]  [Town] <-- promotion hall, better shops, inn, full trainers
      |          |
   [Combat]   [Camp] <-- party management, shop, inventory
     / \         |
[Victory] [Defeat]
     \   /
   [Camp] <-- auto-save on entry, rest, manage
      |
  [Overworld] (next dungeon or town)
```

### State Machine

| State | Description | Transitions To | Auto-Save |
|-------|-------------|----------------|-----------|
| `TITLE` | Title screen with logo and daily info | `CHARACTER_SELECT`, `LOAD_GAME` | -- |
| `LOAD_GAME` | Load from localStorage, validate, migrate | `OVERWORLD`, `CAMP`, `TITLE` (corrupt) | -- |
| `CHARACTER_SELECT` | Pick party from daily roster (up to 4) | `OVERWORLD` | On party confirm |
| `OVERWORLD` | Navigate procedural overworld map | `DUNGEON`, `TOWN`, `CAMP` | On zone entry |
| `TOWN` | Visit town facilities (shop, inn, promotion hall, trainer) | `OVERWORLD`, `CAMP` | On town entry |
| `DUNGEON` | Explore dungeon floors, encounter enemies | `COMBAT`, `OVERWORLD` | On floor entry |
| `COMBAT` | Tactical grid battle | `VICTORY`, `DEFEAT` | -- (no mid-combat save) |
| `VICTORY` | XP/loot rewards | `DUNGEON`, `CAMP` | On rewards collected |
| `DEFEAT` | Game over or retreat option | `CAMP`, `TITLE` | On retreat (not on game-over) |
| `CAMP` | Party management, shop, inventory, save | `OVERWORLD` | On entry, on rest, on equip change |

#### State Machine Invariants

- Every state must have at least one valid outgoing transition
- `COMBAT` is never entered without at least 1 living party member and 1 enemy
- `DEFEAT` is only reachable from `COMBAT` (never from `DUNGEON` or `OVERWORLD` directly)
- `CAMP` always triggers an auto-save on entry
- `TOWN` always triggers an auto-save on entry
- State transitions are atomic -- no intermediate "half-transitioned" states
- Every auto-save-triggering transition writes to localStorage before the new state renders
- `LOAD_GAME` validates save integrity before restoring state; corrupted saves fall back to `TITLE`
- `TOWN` is only reachable from `OVERWORLD` (player must be at a town tile)
- No save occurs during `COMBAT` -- save state reflects the last pre-combat state

---

## 5. Content Systems

### 5.1 Character System

#### Races (8) — D&D 3e Ability Modifiers

Ability scores start at a base of 10 for all stats. Racial modifiers adjust these at character creation. All other stats (HP, AC, saves, BAB) are derived per d20 rules.

| Race | STR | DEX | CON | INT | WIS | CHA | Size | Base Speed (tiles) | Availability |
|------|-----|-----|-----|-----|-----|-----|------|--------------------|-------------|
| Human | +0 | +0 | +0 | +0 | +0 | +0 | M | 6 | Free, year-round |
| Elf | +0 | +2 | −2 | +0 | +0 | +0 | M | 6 | Free, year-round |
| Dwarf | +0 | +0 | +2 | +0 | +0 | −2 | M | 4 | Free, year-round |
| Halfling | −2 | +2 | +0 | +0 | +0 | +0 | S | 4 | Free, year-round |
| Half-Orc | +2 | +0 | +0 | −2 | +0 | −2 | M | 6 | Free, year-round |
| Gnome | −2 | +0 | +2 | +0 | +0 | +0 | S | 4 | Free, year-round |
| Tiefling | +0 | +2 | +0 | +2 | +0 | −2 | M | 6 | Premium / Autumn+Winter |
| Dragonborn | +2 | +0 | +0 | +0 | +0 | +2 | M | 6 | Premium / Summer |

##### Racial Traits (d20)

| Race | Vision | Racial Traits |
|------|--------|---------------|
| Human | Normal | Bonus feat at level 1, +1 skill point per level, favored class: any |
| Elf | Low-light | Immune to sleep effects, +2 saves vs enchantment, proficient with longsword/bow |
| Dwarf | Darkvision 60ft | Stonecunning (+2 Search near stone), +2 saves vs poison and spells, +4 dodge vs giants |
| Halfling | Normal | +1 size bonus to AC and attack, +4 Hide, +2 saves vs fear, +1 all saves |
| Half-Orc | Darkvision 60ft | Orc blood (counts as orc for effects), +2 Intimidate |
| Gnome | Low-light | +1 size bonus to AC and attack, +4 Hide, +2 saves vs illusions, +1 DC to illusion spells cast |
| Tiefling | Darkvision 60ft | Resistance 5 to fire/cold/electricity, +2 Bluff, +2 Hide, darkness 1/day |
| Dragonborn | Normal | Breath weapon (1d6/level, 1/encounter, Reflex save DC 10 + ½ level + CON mod), +2 Intimidate |

##### Derived Stats at Level 1

```
HP = classHitDie + CON_mod                          // e.g., Fighter d10 + CON mod
AC = 10 + armorBonus + shieldBonus + DEX_mod + sizeBonus + naturalArmor
MP = classBaseMP + (casterAbilityMod × level)       // non-casters: 0
Initiative = DEX_mod + misc
Fort save = classBaseFort + CON_mod
Ref save  = classBaseRef  + DEX_mod
Will save = classBaseWill + WIS_mod
BAB = per class (see progression tables)
```

#### Multiclassing Stance

**Multiclassing is NOT supported.** Each character has exactly one base class for their entire career. This is a deliberate design decision:
- Simplifies balance (no broken class dips like Fighter 1 / Wizard 19)
- Prestige classes serve as the "advanced progression" path (functionally replaces multiclassing)
- Each character has a clear identity and role in the party
- Reduces combinatorial explosion for testing and balance

Players who want hybrid roles should pick a class that blends them (Paladin = Fighter + Cleric, Ranger = Fighter + Druid-lite, Bard = Rogue + Caster) or use equipment/spells to cover gaps.

#### Classes (10) — D&D 3e Base Classes

| Class | Role | Hit Die | BAB | Good Saves | Primary Ability | Availability |
|-------|------|---------|-----|------------|-----------------|-------------|
| Fighter | Melee DPS / Tank | d10 | Full (+1/level) | Fort | STR | Free |
| Wizard | Ranged Magic DPS | d4 | Poor (+1/2 levels) | Will | INT | Free |
| Cleric | Healer / Support | d8 | Medium (+3/4 levels) | Fort, Will | WIS | Free |
| Rogue | Melee DPS / Utility | d6 | Medium (+3/4 levels) | Ref | DEX | Free |
| Ranger | Ranged Physical DPS | d8 | Full (+1/level) | Fort, Ref | DEX | Free |
| Paladin | Tank / Healer | d10 | Full (+1/level) | Fort | STR, CHA | Free |
| Barbarian | Melee DPS | d12 | Full (+1/level) | Fort | STR | Free |
| Bard | Support / Utility | d6 | Medium (+3/4 levels) | Ref, Will | CHA | Premium |
| Warlock | Ranged Magic DPS | d6 | Medium (+3/4 levels) | Will | CHA | Premium |
| Sorcerer | AoE Magic DPS | d4 | Poor (+1/2 levels) | Will | CHA | Premium |

##### BAB Progression Types (D&D 3e)

| Type | Formula | Level 1 | Level 5 | Level 10 | Level 20 |
|------|---------|---------|---------|----------|----------|
| **Full** | +1 per level | +1 | +5 | +10 | +20 |
| **Medium (¾)** | +3/4 per level (round down) | +0 | +3 | +7 | +15 |
| **Poor (½)** | +1/2 per level (round down) | +0 | +2 | +5 | +10 |

##### Save Progression Types (D&D 3e)

| Type | Formula | Level 1 | Level 5 | Level 10 | Level 20 |
|------|---------|---------|---------|----------|----------|
| **Good save** | +2 + floor(level/2) | +2 | +4 | +7 | +12 |
| **Poor save** | +floor(level/3) | +0 | +1 | +3 | +6 |

Classes use Good saves for saves listed in the "Good Saves" column above; all other saves use Poor progression.

#### Weapon Proficiency

Characters gain proficiency with weapon types through repeated use. Proficiency improves accuracy, damage, and unlocks special weapon techniques.

##### Proficiency Ranks

| Rank | Uses Required | Attack Bonus | Damage Bonus | Threat Range Expand | Unlock |
|------|--------------|-------------|-------------|--------------------|---------|
| **Untrained** | 0 | −4 to attack | +0 | -- | Basic attacks only, provokes AoO |
| **Novice** | 10 | +0 | +0 | -- | No penalty, no AoO provocation |
| **Trained** | 30 | +1 | +0 | -- | Weapon technique #1 |
| **Skilled** | 60 | +1 | +1 | -- | Weapon technique #2 |
| **Expert** | 100 | +2 | +1 | +1 (e.g., 20→19-20) | Weapon technique #3 |
| **Master** | 150 | +2 | +2 | +1 (stacks) | Weapon mastery passive |

A "use" counts each time the character makes an attack roll with that weapon type in combat (hits and misses both count). Proficiency is tracked per character per weapon category (10 categories). Proficiency bonuses are **competence bonuses** (do not stack with other competence bonuses).

##### Starting Proficiency by Class

Each class begins at Novice with their primary weapons and Untrained with the rest:

| Class | Novice (starting) | Cannot Use |
|-------|-------------------|------------|
| Fighter | Sword, Axe, Spear, Warhammer, Flail | -- |
| Wizard | Staff | -- (penalty on martial weapons) |
| Cleric | Mace, Flail | -- |
| Rogue | Dagger, Crossbow | Warhammer |
| Ranger | Bow, Sword, Dagger | Warhammer, Flail |
| Paladin | Sword, Mace, Warhammer | -- |
| Barbarian | Axe, Warhammer, Spear | -- |
| Bard | Dagger, Crossbow, Sword | Warhammer |
| Warlock | Staff, Dagger | Axe, Warhammer, Flail |
| Sorcerer | Staff, Dagger | Axe, Warhammer, Flail, Spear |

"Cannot Use" weapons can still be equipped but deal half damage (round down) and cannot gain proficiency. All characters can eventually learn any weapon they are not barred from.

##### Weapon Techniques (unlocked by proficiency)

| Weapon | Technique #1 (Trained) | Technique #2 (Skilled) | Technique #3 (Expert) | Mastery (Master) |
|--------|----------------------|----------------------|---------------------|-----------------|
| Sword | Riposte (free AoO at +2 to hit) | Cleave (hit 2 adjacent) | Disarm (remove weapon 1 turn, opposed attack roll) | +1 attack range |
| Axe | Rend (1d4 bleed/round for 3 rounds) | Whirlwind (hit all adjacent) | Sunder Armor (−4 AC for 2 rounds) | Ignore 5 points of target AC |
| Mace | Stun (Fort DC 10 + BAB, skip 1 turn) | Holy Strike (+2d6 damage vs undead) | Shatter Shield (−5 AC for 2 rounds) | +1 damage die step (e.g., d8→d10) |
| Staff | Arcane Strike (+INT mod to damage) | Spell Surge (+1 spell range) | Staff Block (+3 AC vs melee) | Refund 1 spell slot on natural 20 |
| Bow | Quick Shot (two attacks at −2 each) | Pin Down (target speed halved 2 rounds) | Called Shot (threat range 18-20) | +2 attack range |
| Crossbow | Piercing Bolt (ignore target armor bonus) | Explosive Bolt (3-tile AoE, Ref DC 15 half) | Snipe (×2 damage if unmoved this round) | No range minimum |
| Dagger | Backstab (×2 damage from flanking) | Poison Coat (1d4 CON damage/round, 3 rounds, Fort DC 14 negates) | Throat Slash (silence 2 rounds, Fort DC 14) | Extra attack on kill |
| Spear | Brace (×2 damage vs charging foes) | Sweep (knock back 1 tile, Ref DC 12) | Impale (pin 1 round, opposed STR check) | Attacks at 1 and 2 range |
| Warhammer | Concuss (Fort DC 12 or stunned 1 round) | Earthshaker (AoE stun adjacent, Fort DC 14) | Armor Crush (target AC halved for 3 rounds) | +1d6 bonus damage |
| Flail | Chain Trip (prone 1 round, opposed STR/DEX) | Wild Swing (random extra hit at −4) | Shield Bypass (ignore shield AC bonus) | Immune to Attacks of Opportunity |

#### Spell Progression by Class

Spell-casting classes learn new spells as they level up. Non-caster classes do not learn spells but can use spell scrolls.

##### Spells Known per Level

| Level | Cantrips | Level 1 | Level 2 | Level 3 | Level 4 |
|-------|----------|---------|---------|---------|---------|
| 1 | 2 | 1 | -- | -- | -- |
| 2 | 2 | 2 | -- | -- | -- |
| 3 | 3 | 2 | -- | -- | -- |
| 5 | 3 | 3 | 1 | -- | -- |
| 7 | 3 | 3 | 2 | -- | -- |
| 10 | 4 | 3 | 3 | 1 | -- |
| 13 | 4 | 3 | 3 | 2 | -- |
| 16 | 4 | 3 | 3 | 3 | 1 |
| 19 | 4 | 3 | 3 | 3 | 2 |
| 20 | 5 | 3 | 3 | 3 | 3 |

##### Spell Learning Methods

1. **Level-up**: Casters automatically learn 1 new spell from their class schools at each odd level (1, 3, 5, 7, ...)
2. **Spell Scrolls**: Any class can cast a spell scroll once (consumed on use). Casters can instead study a scroll to permanently learn the spell (must be from their school, costs gold + downtime at camp).
3. **Trainers**: NPC trainers in towns teach specific spells for gold. Only available spells from the character's class schools. Stock rotates monthly.
4. **Tomes**: Rare loot items that teach a spell permanently to whoever reads them (casters only, class-restricted).

##### Caster Class Spell Access

| Class | Schools | Cantrips | Notes |
|-------|---------|----------|-------|
| Wizard | Evocation, Necromancy, Conjuration, Illusion, Transmutation | Arcane Bolt, Light | Broadest spell access, learns from scrolls for free |
| Cleric | Abjuration, Divination, Restoration | Sacred Flame, Mending | Best healing, undead turning |
| Paladin | Abjuration, Restoration | -- | Half-caster: half the spells known, learns at half rate |
| Ranger | Restoration, Divination | -- | Half-caster: nature-themed spells only |
| Bard | Enchantment, Illusion, Divination | Vicious Mockery, Minor Illusion | Unique buff/debuff spells |
| Warlock | Necromancy, Conjuration, Enchantment | Eldritch Blast, Chill Touch | Fewer spell slots, powerful cantrips |
| Sorcerer | Evocation, Enchantment, Transmutation | Fire Bolt, Shocking Grasp | Metamagic: can modify spells (extend range, widen AoE) |

Non-casters (Fighter, Rogue, Barbarian) can use spell scrolls as items but never learn spells permanently.

##### Prestige Class Spell Access (Spell Levels 5-6)

Prestige classes unlock spell levels 5 and 6, which are unavailable to base classes. Access depends on the prestige path and its parent class:

| Prestige Path | Parent Class | Spell Level 5 Access | Spell Level 6 Access | Schools Added |
|---------------|-------------|---------------------|---------------------|---------------|
| **Archmage** | Wizard | Level 16 | Level 19 | All arcane schools (master-level) |
| **Hierophant** | Cleric | Level 16 | Level 19 | All divine schools + Necromancy (holy) |
| **Mystic Theurge** | Wizard/Cleric | Level 17 | Level 20 | Combines arcane + divine (one spell from each per level) |
| **Arcane Trickster** | Rogue | Level 18 | -- | Illusion, Enchantment only |
| **Eldritch Knight** | Fighter | Level 18 | -- | Evocation, Abjuration only |
| **Shadow Dancer** | Rogue | Level 17 | Level 20 | Illusion, Necromancy (shadow) |
| **Divine Champion** | Paladin | Level 17 | Level 20 | Abjuration, Restoration, Evocation (holy fire) |
| **Nature's Warden** | Ranger | Level 17 | Level 20 | Restoration, Conjuration (beast/plant) |
| **War Chanter** | Bard | Level 16 | Level 19 | Enchantment, Evocation (sonic) |
| **Fiend Pact** | Warlock | Level 16 | Level 19 | Necromancy, Conjuration (fiend) |
| **Storm Lord** | Sorcerer | Level 16 | Level 19 | Evocation, Transmutation (elemental) |
| **Champion** | Fighter | -- | -- | No spellcasting (pure martial) |
| **Weapon Master** | Fighter | -- | -- | No spellcasting (pure martial) |
| **Assassin** | Rogue | -- | -- | No spellcasting (pure martial) |
| **Berserker** | Barbarian | -- | -- | No spellcasting (pure martial) |

- Prestige spell access requires both the prestige level AND a minimum INT/WIS/CHA of 16 (depending on the casting stat)
- Spell level 5 and 6 spells have longer cast times (2-action cast for level 5, full-round for level 6)
- Each level-up after unlocking a new spell level grants 1 spell known from the accessible schools
- Level 6 spells have a 1/day limit per spell (no re-casting the same level 6 spell until long rest)

#### Stat Block Generation

Base stats are determined by race + class combination. On top of the base:

- **Seeded random variance**: Each day produces a deterministic seed (`YYYY-MM-DD`). Every character in the daily roster gets +/-1 random variance on each stat, seeded per character+day.
- **Daily bonus stat**: One random attribute (STR/DEX/CON/INT/WIS/CHA) receives an additional +2 bonus, rotated daily.
- Stats: **HP**, **MP**, **STR**, **DEX**, **CON**, **INT**, **WIS**, **CHA**, **AC**, **Initiative**

#### Sprites (per character)

- Front-facing idle + walk (4 frames)
- Back-facing idle + walk (4 frames)
- Side-facing idle + walk (4 frames) — left/right mirrored via `ctx.scale(-1, 1)` canvas flip
- Portrait (for menus, combat cut-in)

Only **3 directional sprite sheets** are authored; the 4th direction is a horizontal mirror at render time. This halves directional art requirements.

#### Class Ability Trees (Levels 1-20)

Each class gains abilities at milestone levels. Abilities are **Active** (cost an action in combat, may have cooldowns) or **Passive** (always-on bonuses). All DCs use: `DC = 10 + ½ class level + primary ability mod`.

##### Fighter (Primary: STR)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Power Attack | Active | Trade up to −5 attack for +5 damage on melee. No cooldown |
| 3 | Cleave | Active | On kill, free melee attack on adjacent enemy. No cooldown |
| 5 | Combat Expertise | Active | Trade up to −5 attack for +5 AC until next turn. No cooldown |
| 7 | Weapon Specialization | Passive | +2 damage with equipped weapon type |
| 10 | Improved Critical | Passive | Threat range for all weapons expanded by +1 |
| 13 | Greater Weapon Focus | Passive | +2 attack bonus with equipped weapon type (stacks with proficiency) |
| 16 | Whirlwind Attack | Active | Attack every adjacent enemy once. 3-round cooldown |
| 19 | Supreme Cleave | Passive | Cleave chains indefinitely (no limit on free attacks after kills) |

##### Wizard (Primary: INT)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Arcane Recovery | Active | Recover spell level × 2 MP. 1/rest |
| 3 | Scribe Scroll | Passive | Can create spell scrolls at camp (costs gold + MP) |
| 5 | Spell Penetration | Passive | +2 to caster level checks to overcome Spell Resistance |
| 7 | Empower Spell | Active | Next spell deals +50% damage. Costs +50% MP |
| 10 | Greater Spell Penetration | Passive | Total +4 to SR checks (stacks with Spell Penetration) |
| 13 | Quicken Spell | Active | Cast a spell as a free action (1/combat). Costs +100% MP |
| 16 | Spell Mastery | Passive | 3 chosen spells cost 50% MP |
| 19 | Arcane Supremacy | Passive | +2 to all spell DCs |

##### Cleric (Primary: WIS)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Turn Undead | Active | Undead within 3 tiles flee (Will DC or destroyed if CR ≤ ½ cleric level). 2/rest |
| 3 | Shield of Faith | Active | Grant +2 AC to target ally for 3 rounds. 3-round cooldown |
| 5 | Spiritual Weapon | Active | Summon floating weapon (1d8 + WIS mod) for 3 rounds. 5-round cooldown |
| 7 | Channel Energy | Active | Heal all allies within 2 tiles for 1d6/2 cleric levels. 3/rest |
| 10 | Aura of Protection | Passive | Allies within 2 tiles get +1 to all saves |
| 13 | Flame Strike | Active | 2-tile radius AoE: 1d6/level (half fire, half divine). 5-round cooldown |
| 16 | Greater Turning | Passive | Turn Undead destroys undead up to cleric level (not ½) |
| 19 | Miracle | Active | Duplicate any spell level ≤ 7. 1/rest |

##### Rogue (Primary: DEX)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Sneak Attack +1d6 | Passive | +1d6 damage vs flanked or flat-footed targets |
| 3 | Evasion | Passive | Reflex saves for half damage become no damage on success |
| 5 | Uncanny Dodge | Passive | Cannot be caught flat-footed; retain DEX to AC |
| 7 | Sneak Attack +3d6 | Passive | Sneak attack increases to +3d6 |
| 10 | Improved Evasion | Passive | Even on failed Reflex saves, take only half damage |
| 13 | Sneak Attack +5d6 | Passive | Sneak attack increases to +5d6 |
| 16 | Crippling Strike | Passive | Sneak attack deals 2 STR damage in addition to HP damage |
| 19 | Opportunist | Passive | Free AoO against any enemy struck by an ally this round |

##### Ranger (Primary: DEX)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Favored Enemy | Passive | Choose 1 enemy type: +2 attack and damage vs that type |
| 3 | Track | Passive | Reveal enemy positions in fog of war within 5 tiles |
| 5 | Rapid Shot | Active | Make 2 ranged attacks at −2 each. No cooldown |
| 7 | Favored Enemy II | Passive | Choose a 2nd enemy type for +2 attack/damage |
| 10 | Camouflage | Active | Become invisible until you attack or take damage. 5-round cooldown |
| 13 | Volley | Active | Ranged attack against all enemies in a 2-tile radius. 4-round cooldown |
| 16 | Favored Enemy III | Passive | Choose a 3rd enemy type; existing bonuses increase to +4 |
| 19 | Deadly Aim | Passive | +4 damage on ranged attacks when stationary (did not move this turn) |

##### Paladin (Primary: STR, Secondary: CHA)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Smite Evil | Active | +CHA to attack, +level to damage vs evil creatures. 2/rest |
| 3 | Divine Grace | Passive | Add CHA modifier to all saving throws |
| 5 | Lay on Hands | Active | Heal CHA mod × paladin level HP total per rest (split among touches) |
| 7 | Aura of Courage | Passive | Allies within 2 tiles are immune to fear |
| 10 | Remove Disease | Active | Cure disease/poison on touched ally. 1/rest per 3 paladin levels |
| 13 | Greater Smite | Passive | Smite Evil becomes 3/rest, adds +CHA to damage as well |
| 16 | Holy Avenger | Active | Weapon becomes +5 for 3 rounds, grants SR 15 to allies within 1 tile. 1/rest |
| 19 | Aura of Resolve | Passive | Allies within 3 tiles get +4 to saves vs compulsion and charm |

##### Barbarian (Primary: STR)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Rage | Active | +4 STR, +4 CON, +2 Will saves, −2 AC for 3 + CON mod rounds. 1/rest |
| 3 | Fast Movement | Passive | +2 base speed (tiles) when not wearing heavy armor |
| 5 | Improved Rage | Passive | Rage becomes 2/rest |
| 7 | Damage Reduction 1/- | Passive | Reduce all physical damage taken by 1 |
| 10 | Greater Rage | Passive | Rage bonuses become +6 STR, +6 CON, +3 Will |
| 13 | Indomitable Will | Passive | +4 to Will saves against enchantment (stacks with Rage) |
| 16 | Damage Reduction 3/- | Passive | Reduce all physical damage taken by 3 |
| 19 | Mighty Rage | Passive | Rage bonuses become +8 STR, +8 CON, +4 Will; rage is 3/rest |

##### Bard (Primary: CHA)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Inspire Courage | Active | Allies within 3 tiles get +1 attack/damage for 5 rounds. 2/rest |
| 3 | Fascinate | Active | Target enemy is dazed 1 round (Will DC). 3-round cooldown |
| 5 | Inspire Competence | Active | 1 ally gets +2 to all skill checks for 5 rounds. No cooldown |
| 7 | Countersong | Active | Allies within 3 tiles get +4 to saves vs sonic/language spells for 3 rounds. 5-round cooldown |
| 10 | Inspire Greatness | Passive | Inspire Courage bonuses increase to +2 attack/damage, +2d10 temp HP |
| 13 | Song of Freedom | Active | Remove one enchantment/charm/compulsion from ally. 1/rest |
| 16 | Inspire Heroics | Passive | Inspire Courage also grants +4 AC to affected allies |
| 19 | Mass Suggestion | Active | All enemies in 3 tiles make Will DC or are confused for 3 rounds. 1/rest |

##### Warlock (Primary: CHA)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Eldritch Blast | Active | Ranged touch attack, 1d6 + CHA mod force damage. No cooldown, scales +1d6/5 levels |
| 3 | Dark One's Blessing | Passive | On killing a creature, gain CHA mod temp HP |
| 5 | Eldritch Invocation: Agonizing Blast | Passive | Add CHA mod to Eldritch Blast damage (again) |
| 7 | Hellish Rebuke | Active | When hit, reaction: 2d10 fire to attacker (Ref DC half). 3-round cooldown |
| 10 | Pact Boon | Passive | Choose: Pact of Blade (+2 melee), Chain (improved familiar), Tome (+2 cantrips) |
| 13 | Eldritch Invocation: Repelling Blast | Passive | Eldritch Blast pushes target 2 tiles |
| 16 | Dark Pact | Active | Sacrifice 25% current HP to recover 50% max MP. No cooldown |
| 19 | Eldritch Master | Active | Recover all MP. 1/rest |

##### Sorcerer (Primary: CHA)

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 1 | Sorcerous Origin | Passive | Choose bloodline: Draconic (+1 HP/level), Wild (+1 spell DC), Storm (+2 lightning/thunder dmg) |
| 3 | Metamagic: Twinned | Active | Target 2 creatures with a single-target spell. Costs +50% MP |
| 5 | Font of Magic | Active | Convert MP to additional spell uses (5 MP = 1 bonus spell cast). 3/rest |
| 7 | Metamagic: Subtle | Passive | Spells cannot be counterspelled (no verbal/somatic components) |
| 10 | Metamagic: Empowered | Active | Reroll up to CHA mod damage dice, keep higher. Costs +25% MP |
| 13 | Bloodline Surge | Passive | Origin bonus doubles (Draconic: +2 HP/level, Wild: +2 DC, Storm: +4 dmg) |
| 16 | Metamagic: Heightened | Active | Target has −4 to save vs this spell. Costs +75% MP |
| 19 | Arcane Apotheosis | Passive | All spells cost 25% less MP. Metamagic costs halved |

##### Veteran Path (Non-Prestige, Levels 21-100)

Characters who do not promote at level 20 continue on the Veteran path. They gain generic combat abilities at the same milestone levels as prestige characters, but with lower power:

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Veteran's Grit | Passive | +2 to all saving throws |
| 25 | Battle Hardened | Passive | +1 AC, +1 attack bonus |
| 30 | Seasoned Fighter | Passive | +5 max HP, +5 max MP |
| 40 | Endurance | Passive | Reduce all damage taken by 2 (flat DR) |
| 50 | Veteran's Fortitude | Passive | +4 to Fort saves, immune to fatigue |
| 60 | Combat Reflexes | Passive | +2 AoO per round |
| 70 | Stalwart | Passive | +2 to all saves (stacks with Veteran's Grit, total +4) |
| 80 | Tireless | Passive | Immune to exhaustion, +10 max HP |
| 90 | Unbreakable | Passive | DR increases to 4 (stacks with Endurance) |
| 100 | **Veteran's Resolve** | Passive | +4 to all stats, +2 AC. Capstone for non-prestige characters |

#### User Stories & Acceptance Criteria -- Character System

**US-CHAR-01**: As a player, I can see today's available character roster on the character select screen.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The roster contains between 6 and 8 characters (inclusive) |
| AC2 | Each character shows name, race, class, and portrait |
| AC3 | The roster is identical for all players on the same calendar day |
| AC4 | The roster changes when the real-world date changes |

```gherkin
Scenario: Daily roster is generated deterministically
  Given the current date is "2026-06-15"
  When the character select screen loads
  Then exactly 6 to 8 characters are displayed
  And the roster matches any other session opened on "2026-06-15"

Scenario: Roster changes on new day
  Given the roster was loaded on "2026-06-15"
  When the date changes to "2026-06-16"
  And the character select screen reloads
  Then the roster is different from the previous day
```

**US-CHAR-02**: As a player, I can view each character's randomized stat block before selecting.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking/hovering a character shows all 10 stats (HP, MP, STR, DEX, CON, INT, WIS, CHA, AC, Initiative) |
| AC2 | Stats reflect race base + class base + daily seeded variance (+/-1) |
| AC3 | No stat can be below 1 after modifiers |
| AC4 | Same character on same day always shows identical stats |

```gherkin
Scenario: Stat block includes daily variance
  Given the date is "2026-06-15"
  And the roster includes an Elf Wizard
  When I view the Elf Wizard's stat block
  Then each stat equals (race_base + class_base + variance) where variance is in [-1, +1]
  And the same Elf Wizard shows identical stats on reload

Scenario: Stats have a floor of 1
  Given a race/class combo where base STR is 2 and daily variance is -1
  When the daily bonus stat is not STR
  Then displayed STR is 1 (not 0 or negative)
```

**US-CHAR-03**: As a player, I can see which stat has the daily bonus (+2) highlighted.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Exactly one of the 6 core stats (STR/DEX/CON/INT/WIS/CHA) has the daily bonus |
| AC2 | The bonus stat is visually highlighted (different color or icon) |
| AC3 | The +2 bonus is applied to every character in the roster |
| AC4 | The bonus stat rotates -- not the same stat two consecutive days |

```gherkin
Scenario: Daily bonus stat is highlighted
  Given the daily bonus stat for "2026-06-15" is WIS
  When I view any character's stat block
  Then the WIS stat is visually highlighted
  And WIS is 2 higher than it would be without the bonus
```

**US-CHAR-04**: As a player, I can select up to 4 characters for my party.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking a character toggles their selection state |
| AC2 | At most 4 characters can be selected simultaneously |
| AC3 | Attempting to select a 5th character shows a "party full" indicator |
| AC4 | A "Begin" button is enabled only when 1-4 characters are selected |
| AC5 | Selected characters are visually distinguished (border, glow, checkmark) |

```gherkin
Scenario: Select a full party
  Given I am on the character select screen
  When I click 4 different characters
  Then all 4 show a selected indicator
  And the "Begin" button is enabled

Scenario: Cannot exceed party limit
  Given I have 4 characters selected
  When I click a 5th unselected character
  Then the 5th character is not added
  And a "Party Full" indicator appears

Scenario: Deselect a character
  Given I have 3 characters selected
  When I click one of the selected characters
  Then that character is deselected
  And 2 characters remain selected
```

**US-CHAR-05**: As a player, I can see which races/classes are seasonal exclusives and when they are available.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Seasonal races/classes show their availability window (e.g., "Available: Jun-Aug") |
| AC2 | When out of season and not entitled, the character slot shows a lock icon |
| AC3 | When in season, seasonal characters appear in the roster pool like any other |
| AC4 | Tooltip explains the seasonal window and premium unlock option |

```gherkin
Scenario: Seasonal race shown as locked outside season
  Given the current date is in March (Spring)
  And the player does not own the Dragonborn entitlement
  When a Dragonborn appears in the roster pool
  Then it displays with a lock icon and "Available: Jun-Aug" label
  And it cannot be selected

Scenario: Seasonal race playable during its season
  Given the current date is in July (Summer)
  When a Dragonborn appears in the roster pool
  Then it is selectable regardless of entitlement status
```

**US-CHAR-06**: As a player, I return tomorrow to find a different roster with different stat rolls.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The PRNG seed changes when the calendar date changes |
| AC2 | At least 2 characters in the new roster differ from yesterday |
| AC3 | Stat variance values are re-rolled for all characters |
| AC4 | The daily bonus stat changes |

**US-CHAR-07**: As a player, I can identify premium content that requires entitlement.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Premium races and classes have a distinguishing badge or border |
| AC2 | Hovering a premium character shows entitlement status |
| AC3 | `EntitlementService.isEntitled()` is called once per premium character, not per frame |
| AC4 | Stub service returns true for all content (development mode) |

**US-CHAR-08**: As a player, I can see a character's class abilities before selecting them.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each class shows a summary of 2-3 key abilities |
| AC2 | Abilities include level requirement and brief description |
| AC3 | Spell-casting classes show their available magic schools |

**US-CHAR-09**: As a player, I can see the companion creature associated with each character's class.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The character info panel shows the companion name and portrait |
| AC2 | Companion's special ability is described in a tooltip |

**US-CHAR-10**: As a player, my characters gain weapon proficiency through combat use.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each attack with a weapon type increments that weapon's use counter |
| AC2 | Reaching a use threshold promotes the character to the next proficiency rank |
| AC3 | A "Proficiency Up!" notification appears when a rank is gained |
| AC4 | Proficiency bonuses (attack, threat range) apply immediately |
| AC5 | Weapon techniques are added to the action menu when unlocked |
| AC6 | Untrained weapons show a −4 attack penalty in the stat panel |

```gherkin
Scenario: Gain proficiency through use
  Given a Fighter at Novice rank with Sword (0/30 uses toward Trained)
  When the Fighter attacks 30 times with a Sword across multiple combats
  Then the proficiency rank changes to Trained
  And attack bonus changes from +0 to +1
  And "Riposte" technique is added to the Sword action menu

Scenario: Untrained weapon penalty
  Given a Wizard equips a Sword (Untrained, not in starting proficiency)
  When the Wizard attacks with the Sword
  Then the attack has −4 attack penalty applied
  And the stat panel shows "Untrained (−4)" next to the weapon

Scenario: Cannot-use weapon severe penalty
  Given a Sorcerer equips an Axe (Cannot Use category)
  When the Sorcerer attacks with the Axe
  Then damage is halved (round down)
  And no proficiency XP is gained
```

**US-CHAR-11**: As a player, my spell casters learn new spells as they level up.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | At each odd level (1, 3, 5, 7, ...), the caster learns 1 spell from their class schools |
| AC2 | A spell selection screen appears during level-up showing available options |
| AC3 | The player chooses which spell to learn (not automatic) |
| AC4 | Non-caster classes skip spell selection entirely |
| AC5 | Half-casters (Paladin, Ranger) learn spells at half rate (every other odd level) |

```gherkin
Scenario: Wizard learns spell on level up
  Given a Wizard reaches level 3
  When the level-up screen appears
  Then a "Learn Spell" panel shows 3-4 Level 1 spell options from Wizard schools
  When I select "Magic Missile"
  Then Magic Missile is added to the Wizard's spell list
  And the spell count increases

Scenario: Fighter does not learn spells
  Given a Fighter reaches level 3
  When the level-up screen appears
  Then no spell selection panel is shown
  And stat allocation proceeds normally
```

**US-CHAR-12**: As a player, my casters can learn spells from scrolls at camp.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A caster at camp can study a spell scroll from their class school |
| AC2 | Studying a scroll costs gold (50 * spell tier) and consumes the scroll |
| AC3 | The spell is permanently added to the caster's spell list |
| AC4 | Scrolls from non-class schools cannot be studied (only used as consumable) |
| AC5 | The Wizard class can study scrolls for free (no gold cost) |

```gherkin
Scenario: Cleric studies a Restoration scroll
  Given a Cleric has a "Scroll of Greater Heal" (Level 2 Restoration) in inventory
  And the player has 100+ gold
  When the Cleric selects "Study Scroll" at camp
  Then 100 gold is deducted (50 * 2)
  And the scroll is consumed
  And Greater Heal is permanently added to the Cleric's spell list

Scenario: Wizard studies scrolls for free
  Given a Wizard has a "Scroll of Fireball" (Level 2 Evocation)
  When the Wizard selects "Study Scroll" at camp
  Then 0 gold is deducted
  And the scroll is consumed
  And Fireball is permanently added to the Wizard's spell list

Scenario: Non-class scroll cannot be studied
  Given a Cleric has a "Scroll of Fireball" (Evocation, not a Cleric school)
  When the Cleric tries to study the scroll
  Then the option is grayed out with "Not in class schools"
  And the scroll can still be used once in combat as a consumable
```

**US-CHAR-13**: As a player, I can visit NPC trainers to learn specific spells for gold.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Trainers in towns show available spells from the visiting character's class schools |
| AC2 | Trainer spell stock rotates monthly (seeded by `YYYY-MM` + town ID) |
| AC3 | Learning a spell costs gold scaling by tier (100 / 250 / 500 / 1000) |
| AC4 | Already-known spells are shown as "Learned" and cannot be purchased again |
| AC5 | Trainers also sell weapon proficiency lessons (+10 uses toward any weapon) for gold |

**US-CHAR-14**: As a player, I can see my character's proficiency ranks and spell list in the character sheet.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Character sheet shows all 10 weapon categories with current proficiency rank and use count |
| AC2 | Known spells are listed grouped by school and tier |
| AC3 | Unlocked weapon techniques are listed next to each proficient weapon |
| AC4 | Progress toward next proficiency rank is shown as a bar |

---

### 5.2 Paper-Doll Sprite System

Characters are rendered as layered canvas composites:

```
Layer order (bottom to top):
  1. Base body (determined by race)
  2. Clothing (determined by class)
  3. Armor slot
  4. Boots slot
  5. Helmet slot
  6. Weapon slot (right hand)
  7. Shield slot (left hand)
  8. Accessory slot (visual overlay)
```

- Every race/class combination can equip any item
- Walking animation: 3 authored directions (front, back, side), 4th mirrored at render time, 4 frames each
- Equipment changes reflected immediately on sprite
- Combat cut-in uses larger portrait + weapon/shield overlays

##### Prestige Class Visual Effects

Prestige characters display a subtle glow overlay on their sprite to indicate their advanced status:

| Prestige Path Type | Glow Color | Effect |
|-------------------|-----------|--------|
| Martial (Champion, Weapon Master, Assassin, Berserker) | Gold | Faint gold shimmer on weapon hand |
| Arcane (Archmage, Arcane Trickster, Eldritch Knight, Storm Lord) | Blue | Arcane runes orbit the character (1-2 glowing dots) |
| Divine (Hierophant, Divine Champion) | White/Silver | Halo-like glow above head |
| Shadow (Shadow Dancer, Fiend Pact) | Purple/Dark | Shadow wisps trail the character |
| Nature (Nature's Warden) | Green | Leaf particles float around character |
| Music (War Chanter) | Orange/Amber | Musical note particles on idle |
| Hybrid (Mystic Theurge) | Blue + White split | Half-arcane, half-divine glow |

- Glow is rendered as an additional sprite layer (layer 9) above all equipment
- Glow uses additive blending for a luminous effect
- Glow is subtle (20% opacity) to avoid obscuring equipment visuals
- Glow can be disabled in settings (cosmetic preference)

#### User Stories & Acceptance Criteria -- Paper-Doll Sprites

**US-SPRITE-01**: As a player, I can see my character's appearance change when I equip different items.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Equipping a weapon replaces the weapon layer within the same frame |
| AC2 | Unequipping an item removes only that layer, others remain |
| AC3 | The composite is re-rendered in correct z-order after any change |
| AC4 | Performance: composite rebuild completes in < 5ms |

```gherkin
Scenario: Equip a sword
  Given a Human Fighter with no weapon equipped
  When I equip a Sword to the weapon slot
  Then the weapon layer shows the Sword sprite
  And all other layers remain unchanged

Scenario: Swap weapon
  Given a Human Fighter with a Sword equipped
  When I equip an Axe to the weapon slot
  Then the weapon layer changes from Sword to Axe immediately
  And the Sword returns to inventory
```

**US-SPRITE-02**: As a player, I can see race-specific body types.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each of the 8 races has a distinct base body sprite |
| AC2 | Dwarf sprite is visibly shorter than Human |
| AC3 | Half-Orc sprite is visibly bulkier than Elf |
| AC4 | Equipment layers align correctly on every race body |

**US-SPRITE-03**: As a player, I can see class-specific default clothing.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each of the 10 classes has a unique clothing layer |
| AC2 | Equipping armor replaces the clothing layer with armor graphics |
| AC3 | Unequipping armor restores the class default clothing |

**US-SPRITE-04**: As a player, I can see walking animations in all 4 directions on the overworld and in dungeons.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Front, back, and side directions each have 4 animation frames |
| AC2 | Left-facing movement mirrors the side sprite via `ctx.scale(-1, 1)` — no separate left sheet exists |
| AC3 | Animation cycles at a consistent rate (150-200ms per frame) |
| AC4 | Standing still shows the idle frame for the last-moved direction |
| AC5 | All equipped layers animate in sync with the body |
| AC6 | Mirrored sprites also mirror equipment layers (weapon in correct hand) |

```gherkin
Scenario: Walk north on overworld
  Given a character is standing on the overworld facing south
  When I click a tile to the north
  Then the character sprite switches to back-facing frames
  And walks with 4-frame animation toward the destination
  And all equipment layers animate in sync

Scenario: Walk left uses mirrored side sprite
  Given a character is standing on the overworld facing right
  When I click a tile to the left
  Then the renderer draws the side-facing sprite with ctx.scale(-1, 1)
  And weapon and shield layers are also mirrored
```

**US-SPRITE-05**: As a player, I can see my full paper-doll character in the combat cut-in screen.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Cut-in displays a larger (2x-4x) version of the composite sprite |
| AC2 | Weapon and shield are visible and correctly positioned |
| AC3 | Attacker is shown on a raised platform, defender on their terrain |
| AC4 | Cut-in renders within 16ms (single frame budget) |

**US-SPRITE-06**: As a player, I can see both my party and companion sprites on screen simultaneously.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Companion sprites use the same layering system (body + optional minor item) |
| AC2 | Companions are visually smaller than player characters (0.75x scale) |
| AC3 | Up to 8 sprites render simultaneously without frame drops (4 party + 4 companions) |

---

### 5.3 Overworld Generation

The Material Plane overworld is **infinite and procedurally generated** using chunk-based lazy loading. The world is seeded once per save (genesis seed) — the same coordinates always produce the same terrain. The player can walk in any direction forever; new chunks generate on demand as the viewport approaches unexplored regions.

#### Chunk-Based Lazy Generation

| Property | Value |
|----------|-------|
| **Chunk size** | 16×16 tiles (32×32 px each = 512×512 px per chunk) |
| **View distance** | 3×3 chunks centered on the player (48×48 visible tiles) |
| **Generation radius** | 5×5 chunks (pre-generate 1-chunk border beyond view) |
| **Budget per frame** | ≤ 4ms for chunk generation (fits within 16.67ms frame budget) |
| **Cache size** | LRU cache of 64 chunks in memory; evict furthest-from-player first |
| **Persistence** | Generated chunks are deterministic from `hash(genesisSeed, chunkX, chunkY)` — no need to store terrain; regenerate on revisit |

**Generation pipeline per chunk:**

1. **Multi-frequency biome noise** — 3 octaves of simplex noise seeded by `hash(genesisSeed, 'biome')`:
   - Low frequency (scale 256): continent-level biome zones (forest band, desert band, tundra band)
   - Medium frequency (scale 64): regional terrain variation (clearings in forests, oases in deserts)
   - High frequency (scale 16): tile-level detail (individual trees, rocks, puddles)
2. **Wave Function Collapse (WFC)** — Tile adjacency constraints enforce natural transitions (forest→plains→desert, not forest→lava). Each biome defines legal neighbor tiles and connection rules. WFC runs per-chunk with boundary constraints inherited from already-generated adjacent chunks.
3. **Structure placement** — Poisson disc sampling places towns, dungeon entrances, POIs, and roads. Road network connects towns via A* on the noise-weighted cost map. Structures are seeded per-chunk so they regenerate identically.
4. **Difficulty gradient** — Distance from world origin (0,0) determines difficulty zone. Difficulty increases radially but with biome modulation (volcanic is always high-danger regardless of distance).

#### Biomes & Overworld Difficulty Zones

The overworld is organized into **concentric difficulty zones** radiating outward from the starting town at world origin. Inner zones have easier dungeons; outer zones are deadly but rewarding. The player chooses their path and risk level.

| Biome | Terrain | Enemy Tier | Difficulty Zone | Recommended Level | Noise Threshold | Description |
|-------|---------|-----------|-----------------|-------------------|-----------------|-------------|
| Meadow | Grass, flowers | 1 | Inner (safe) | 1-5 | 0.0-0.15 | Starting area, gentle terrain |
| Forest | Trees, clearings | 1-2 | Inner (safe) | 1-10 | 0.15-0.30 | Dense woodland with hidden paths |
| Hills | Rolling terrain, boulders | 2 | Inner-middle | 5-15 | 0.20-0.35 | Elevated terrain with caves |
| Mountain | Rocky terrain, cliffs | 2-3 | Middle | 8-20 | 0.30-0.50 | High elevation with narrow passes |
| Desert | Sand dunes, oases | 2-3 | Middle | 10-25 | 0.35-0.55 | Hot wasteland with mirages |
| Swamp | Marshland, fog | 2-4 | Middle-outer | 15-35 | 0.40-0.60 | Treacherous wetland with toxic pools |
| Tundra | Snow, ice | 3-4 | Outer | 25-50 | 0.55-0.75 | Frozen expanse with blizzards |
| Jungle | Dense canopy, vines | 3-4 | Outer | 25-50 | 0.50-0.70 | Overgrown ruins, poisonous flora |
| Badlands | Cracked earth, canyons | 4-5 | Edge | 40-70 | 0.65-0.80 | Scarred wasteland, elemental rifts |
| Volcanic | Lava, obsidian | 4-5 | Edge (deadly) | 40-100 | 0.75-1.00 | Hellish terrain near planar portals |
| Corrupted | Warped terrain, void tears | 5 | Edge (deadly) | 60-100 | 0.85-1.00 | Reality breaks down near Far Realm rifts |

#### Difficulty Gradient Formula

```
chunkDistance = sqrt(chunkX² + chunkY²)
baseDifficulty = floor(chunkDistance / 8)   // increases every ~8 chunks from origin
biomeMod = biome.dangerOffset               // volcanic +2, meadow -1, etc.
effectiveDifficulty = clamp(baseDifficulty + biomeMod, 0, 10)
```

Dungeon entrances within a chunk have their tier determined by `effectiveDifficulty` mapped to dungeon tiers I-VI.

#### Overworld Risk-Reward Design

The player has **full agency** over engagement risk. Permadeath means choosing the wrong path can end a run. Key design principles:

- **Multiple paths**: From any town, at least 2 different routes lead to different dungeons of varying difficulty
- **Visual difficulty cues**: Biome color intensity, particle effects (smoke, snow, heat shimmer), and hostile wildlife sprites communicate danger before committing
- **Dungeon level labels**: Each dungeon entrance shows a **recommended level range** and **danger rating** (skull icons: 1-5 skulls)
- **Scouting**: Hovering over a dungeon entrance reveals: enemy tier range, floor count, boss (if any), and estimated loot quality
- **Safe retreat**: The player can always turn back from the overworld; random encounters on the overworld are avoidable via roads (road tiles have 0% encounter rate, off-road has 5-15% per step based on biome)
- **Risk = reward**: Higher-difficulty dungeons drop better loot, more XP, and rarer equipment tiers
- **Progressive access**: Outer biomes are physically reachable from the start, but the journey through hostile biomes without appropriate level is extremely dangerous (overworld encounters scale with biome tier)

#### WFC Tile Adjacency Rules

Each tile type defines which tiles can appear on its N/S/E/W edges. WFC propagates these constraints across the chunk during generation.

| Tile | Can Border | Cannot Border |
|------|-----------|---------------|
| Deep Water | Shallow Water | Lava, Sand, Mountain |
| Shallow Water | Deep Water, Beach, Grass | Lava, Snow |
| Beach | Shallow Water, Grass, Sand | Mountain, Snow, Lava |
| Grass | Forest, Road, Beach, Hills, Sand | Lava, Deep Water |
| Forest | Grass, Hills, Swamp, Dense Forest | Lava, Desert, Deep Water |
| Dense Forest | Forest, Swamp | Road, Desert, Lava |
| Sand | Grass, Desert, Beach, Road | Snow, Swamp, Deep Water |
| Desert | Sand, Badlands, Road | Snow, Forest, Water |
| Hills | Grass, Mountain, Forest | Deep Water, Lava |
| Mountain | Hills, Snow, Volcanic, Cliff | Grass, Sand, Water |
| Snow | Mountain, Tundra, Ice | Sand, Desert, Lava |
| Tundra | Snow, Grass | Lava, Desert |
| Swamp | Forest, Jungle, Shallow Water | Desert, Snow, Mountain |
| Jungle | Swamp, Forest, Ruins | Snow, Desert |
| Volcanic | Lava, Mountain, Badlands | Snow, Water, Grass |
| Lava | Volcanic, Obsidian | Water, Snow, Grass, Forest |
| Badlands | Desert, Volcanic, Corrupted | Water, Forest |
| Corrupted | Badlands, Void, any (low probability) | -- (can appear anywhere at edges of reality) |
| Road | any land tile | Deep Water, Lava |

**Chunk boundary stitching**: When generating chunk (x, y), the WFC solver reads the border tiles of already-generated adjacent chunks as fixed constraints. If no neighbor exists yet, the edge is unconstrained.

#### Asynchronous Chunk Pre-Generation

Chunk generation does not need to happen entirely within a single frame. Multiple strategies extend the available time budget:

| Strategy | Trigger | Budget | Description |
|----------|---------|--------|-------------|
| **Between-moves generation** | After player commits a move, before animation completes | ~200-500ms (move animation duration) | Generate 1-3 chunks in the direction of movement while the walk animation plays |
| **Idle-time generation** | No player input for 500ms+ | `requestIdleCallback` deadline (~2-50ms chunks) | Speculatively pre-generate chunks in all 4 cardinal directions during idle |
| **Background generation** | Page visible but no interaction | Up to 8ms per rAF frame (half budget) | Low-priority generation of chunks in a spiral pattern outward from player |
| **Move prediction** | Player hovers over a tile | Immediate, 1 chunk | Pre-generate the chunk the player is likely to click next |

```
// Generation priority queue (highest priority first):
1. Chunks in viewport that are missing (CRITICAL — block rendering until done)
2. Chunks adjacent to viewport (HIGH — generate during move animation)
3. Chunks in player's movement direction (MEDIUM — speculative, during idle)
4. Chunks in spiral around player (LOW — background fill)

// Between-moves example:
onPlayerMoveStart(fromTile, toTile) {
  movementVector = normalize(toTile - fromTile)
  predictedChunks = getChunksInDirection(toTile, movementVector, depth=3)
  for (chunk of predictedChunks)
    if (!chunkCache.has(chunk))
      generationQueue.enqueue(chunk, PRIORITY_HIGH)
  startMoveAnimation()  // 200-500ms — generation runs during animation
}

onIdle(deadline) {   // requestIdleCallback
  while (deadline.timeRemaining() > 2 && generationQueue.length > 0) {
    chunk = generationQueue.dequeue()
    generateChunk(chunk)
  }
}
```

**Invariants**:
- Viewport chunks MUST be ready before rendering (block if necessary; fallback to noise-only if WFC exceeds 4ms)
- Pre-generated chunks are stored in the same LRU cache — they are indistinguishable from on-demand chunks
- Maximum generation queue depth: 24 chunks (beyond this, discard lowest-priority entries)
- Generation is fully deterministic regardless of generation order — speculative generation produces identical results to on-demand generation

#### Overworld Encounter Spawning & Despawning

Enemies on the overworld exist only within the party's **perception radius** — the area they can see based on their vision type and light conditions. Mobs spawn at the edge of perception and are silently removed when they leave it. This creates the **illusion of a living, populated world** without needing to simulate hundreds of off-screen entities.

##### Perception-Based Spawn System

```
perceptionRadius = max(
  bestPartyVision,           // darkvision 120ft → 24 tiles, normal + torch → 8 tiles
  lightSourceRadius,
  minimumPerceptionRadius    // always at least 6 tiles (hearing, smell, etc.)
)

spawnRing = perceptionRadius + 2 tiles   // spawn just outside perception so mobs "walk in"
despawnRadius = perceptionRadius + 4 tiles // despawn silently 4 tiles beyond perception
```

| Event | Trigger | Action |
|-------|---------|--------|
| **Spawn** | Every 3-5 player steps (biome encounter rate) | Roll encounter check; if success, place mob group at random point on spawn ring |
| **Wander** | Each player step | Active mobs within perception move 1 tile toward their patrol target (seeded path) |
| **Despawn** | Mob leaves despawn radius | Silently remove from world; free memory. Mob pool recycles the slot. |
| **Engage** | Party enters mob's aggro range (2-3 tiles) | Screen flash → 500ms dissolve transition → combat grid loads with encounter party |
| **Avoid** | Party moves away, mob reaches despawn radius | Mob disappears. Player feels like they "snuck past" |

##### Mob Pooling

Instead of creating/destroying mob entities, reuse a fixed pool:

```
MOB_POOL_SIZE = 1024            // max active mobs in the world at once (supports large map views)
activeMobs = []                  // current on-screen/near-screen mobs
mobPool = preallocate(1024)     // reusable mob objects

spawn(mobType, position) {
  mob = mobPool.acquire()       // get a recycled mob from pool
  mob.init(mobType, position)   // reinitialize with new type/position
  activeMobs.push(mob)
}

despawn(mob) {
  activeMobs.remove(mob)
  mobPool.release(mob)          // return to pool for reuse
}
```

**Performance guarantees**:
- Never more than 1024 active mob entities in memory
- Spawn/despawn is O(1) via pool — no garbage collection pressure
- Mob AI only runs for mobs within the current viewport (no off-screen AI simulation)
- Mobs beyond viewport but within perception radius stay in pool (position tracked, no AI tick)
- At zoomed-out map views, mobs render as icons rather than full sprites (LOD rendering)
- From the player's perspective, the world feels populated in every direction — mobs appear naturally at the edge of sight

##### Encounter Rate by Biome

| Biome | Encounter Check Rate | Chance per Check | Mob Types |
|-------|---------------------|-----------------|-----------|
| Road | Never | 0% | -- (safe) |
| Meadow | Every 6 steps | 5% | CR ¼–½ wildlife |
| Forest | Every 4 steps | 10% | CR ¼–2 beasts, goblins |
| Hills | Every 4 steps | 12% | CR 1–3 bandits, beasts |
| Mountain | Every 3 steps | 15% | CR 2–4 giants, drakes |
| Desert | Every 4 steps | 10% | CR 2–3 elementals, scorpions |
| Swamp | Every 3 steps | 15% | CR 2–4 undead, lizardfolk |
| Tundra | Every 4 steps | 12% | CR 3–5 frost creatures |
| Jungle | Every 3 steps | 18% | CR 3–5 beasts, plants |
| Badlands | Every 2 steps | 20% | CR 4–7 demons, elementals |
| Volcanic | Every 2 steps | 25% | CR 5–8 fire elementals, dragons |
| Corrupted | Every 2 steps | 30% | CR 6–10 aberrations |

Encounters scale with `effectiveDifficulty` and party level per the CR encounter tables.

#### Map Features

- Road/path networks connecting towns and dungeons (roads are safe -- 0% encounter rate)
- Multiple branching paths from each hub town to dungeons of different difficulties
- Towns and villages (shop, rest, quest givers, promotion halls)
- Dungeon entrances with visible difficulty indicators (skull rating, recommended level, loot preview)
- Points of interest (shrines, ruins, treasure caches -- risk varies by biome)
- Pokemon-style screen transition into underground dungeon levels

#### Generation Algorithm (per chunk)

1. Derive chunk seed: `chunkSeed = hash(genesisSeed, chunkX, chunkY)`
2. Sample 3-octave simplex noise at each tile position to determine biome
3. Run WFC tile solver with biome constraints + neighbor chunk border constraints
4. Place structures via Poisson disc sampling seeded by `chunkSeed`:
   - Towns: 1 per ~4 chunks (distance-based probability, guaranteed at origin)
   - Dungeon entrances: 1-3 per chunk, tier based on difficulty gradient
   - POIs: shrines, ruins, camps, merchant caravans
   - Planar portals: rare (1 per ~16 chunks in outer zones), lead to other dimensions (see 5.3b)
5. Connect structures with roads via A* on terrain cost map
6. Cache generated chunk in LRU; evict when beyond generation radius

#### Generation Invariants

- Origin chunk (0,0) always contains the starting town, a Tier I dungeon entrance, and a road
- Every town within a chunk is connected to at least one road that reaches a chunk edge
- At least 1 dungeon entrance exists per 2 chunks (density guarantee)
- Dungeon tier within a chunk never exceeds `effectiveDifficulty + 1` (no Tier V in inner zone)
- At least 1 town exists within 2 chunks of every dungeon entrance
- WFC tile placement never produces isolated 1-tile water or 1-tile lava (minimum 2×2 cluster)
- Chunk generation is deterministic: same seed + same coordinates = identical output
- No chunk takes longer than 4ms to generate (WFC iteration capped; fallback to noise-only if exceeded)
- Road tiles always form connected paths within and across chunk boundaries
- Planar portals only appear in chunks where `effectiveDifficulty >= 4`

#### User Stories & Acceptance Criteria -- Overworld

**US-OW-01**: As a player, I can navigate an overworld map by clicking on adjacent tiles or paths.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking a walkable adjacent tile moves the party there |
| AC2 | Clicking a non-adjacent tile does nothing (no teleporting) |
| AC3 | Impassable tiles (deep water, cliff faces) reject clicks |
| AC4 | Movement animates the party token between tiles |
| AC5 | A path preview highlights when hovering a reachable tile |

```gherkin
Scenario: Move to adjacent tile
  Given the party is on tile (5, 5) on the overworld
  And tile (5, 6) is a walkable Forest tile
  When I click tile (5, 6)
  Then the party moves to (5, 6) with a walking animation
  And the camera follows the party

Scenario: Cannot move to impassable tile
  Given the party is on tile (5, 5)
  And tile (5, 6) is a deep water tile
  When I click tile (5, 6)
  Then the party does not move
  And a "blocked" visual indicator appears on the tile

Scenario: Cannot move to non-adjacent tile
  Given the party is on tile (5, 5)
  When I click tile (5, 8) which is 3 tiles away
  Then the party does not move
```

**US-OW-02**: As a player, I can see distinct biomes with different visual styles.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each of the 6 biomes has a unique tile palette (at least 3 tile variants) |
| AC2 | Biome boundaries have a transition tile row for smooth blending |
| AC3 | The biome type is shown in a HUD label when the party enters it |

**US-OW-03**: As a player, I can visit towns to buy/sell equipment and rest.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Entering a town tile opens the town interface (shop, inn, quest board) |
| AC2 | The shop inventory is seeded by date + town location |
| AC3 | Resting at the inn fully restores party HP/MP |
| AC4 | Exiting the town returns to the overworld at the same tile |

```gherkin
Scenario: Enter a town
  Given the party is adjacent to a town tile
  When I click the town tile
  Then the screen transitions to the town interface
  And I see buttons for Shop, Inn, and Quest Board

Scenario: Rest at the inn
  Given a party member has 15/30 HP and 5/20 MP
  When I click "Rest" at the inn
  Then all party members are restored to full HP and MP
```

**US-OW-04**: As a player, I can see dungeon difficulty before entering and make an informed risk-reward decision.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each dungeon entrance displays a skull rating (1-5+), recommended level range, and loot quality |
| AC2 | Hovering over the entrance shows: floor count, enemy tier range, boss name (if weekly boss), and XP multiplier |
| AC3 | Dungeons significantly above the party's level show a red "DANGER" warning |
| AC4 | At least 2 dungeons of different difficulty tiers are reachable from each town |
| AC5 | The player can always choose to walk away and pick a different dungeon |

```gherkin
Scenario: Scout dungeon difficulty
  Given the party (average level 8) is on a dungeon entrance tile
  And the dungeon is Tier III (recommended 10-20, 3 skulls)
  When I hover over the entrance
  Then a tooltip shows: "Dark Cavern | ☠☠☠ | Level 10-20 | Floors: 4 | Loot: Rare-Epic | XP: 2.0x"
  And a yellow warning says "Challenging: enemies may be above your level"

Scenario: Dangerous dungeon warning
  Given the party (average level 5) is on a Tier IV dungeon entrance (recommended 18-35)
  When I hover over the entrance
  Then a red warning says "DANGER: Enemies here will likely kill your party"
  And the skull icons pulse red

Scenario: Enter dungeon from overworld
  Given the party is on a dungeon entrance tile
  When I click the entrance and confirm
  Then a Pokemon-style transition animation plays
  And the view changes to dungeon floor 1
  And the party is placed at the entrance room
```

**US-OW-05**: As a player, I can choose different overworld paths of varying risk to reach dungeons.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Roads between towns have 0% random encounter rate (safe travel) |
| AC2 | Off-road travel through biomes has 5-15% encounter rate per step (scaled by biome difficulty) |
| AC3 | The player can see the biome difficulty zone before entering it |
| AC4 | Shorter off-road paths through dangerous biomes trade safety for speed |
| AC5 | Random overworld encounters match the biome's enemy tier |

```gherkin
Scenario: Safe road travel
  Given the party is walking along a road between two Forest towns
  When I move 20 steps along the road
  Then no random encounters occur (0% rate on roads)

Scenario: Dangerous off-road shortcut
  Given the party (level 5) walks through a Swamp biome (tier 2-4, 12% encounter rate)
  When I take 10 off-road steps
  Then approximately 1-2 random encounters trigger
  And enemies are tier 2-4 Swamp creatures (Ghouls, Gnolls)
  And the party may be outmatched

Scenario: Multiple routes to a dungeon
  Given the party is in the starting town
  Then there is a safe road leading to a Tier I dungeon (2 skulls)
  And an off-road path through Mountains leading to a Tier III dungeon (3 skulls)
  And the player chooses which path to take
```

**US-OW-06**: As a player, I can retreat from a dungeon at any staircase to preserve my party.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Staircases going up offer a "Retreat" option |
| AC2 | Retreating returns the party to the overworld at the dungeon entrance |
| AC3 | XP earned on cleared floors is kept |
| AC4 | Items looted on the current (unfinished) floor are lost |
| AC5 | Retreat is NOT available during boss encounters |

```gherkin
Scenario: Retreat to preserve party
  Given the party has cleared floors 1-2 of a Tier III dungeon
  And the party is low on HP/MP on floor 3
  When I reach the staircase on floor 3 and choose "Retreat"
  Then the party returns to the overworld with XP from floors 1-2
  And items from floor 3 are lost
  And the dungeon resets (next entry starts at floor 1 with new layout)

Scenario: Cannot retreat from boss
  Given the party enters the boss room on the final floor
  Then the "Retreat" option is disabled
  And a tooltip says "Cannot retreat from boss encounters"
```

**US-OW-05**: As a player, I discover the overworld changes each month with new layouts and dungeon placements.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The overworld seed changes on the 1st of each month |
| AC2 | Biome placement, town positions, and dungeon entrances differ month to month |
| AC3 | Two different months never produce identical maps (seed collision probability < 1/2^32) |
| AC4 | Within the same month, the map is always identical |

**US-OW-06**: As a player, I can see points of interest on the map and explore them for rewards.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | POIs are indicated by a distinct icon on the overworld |
| AC2 | Entering a POI triggers a short event (treasure, encounter, shrine) |
| AC3 | Each POI can only be visited once per run |
| AC4 | At least 5 POIs exist per generated map |

**US-OW-07**: As a player, I can see a random encounter trigger while traveling between locations.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each step on non-road tiles has a % chance to trigger combat |
| AC2 | Road tiles have 0% random encounter chance |
| AC3 | Encounter enemy tier matches the biome's enemy tier range |
| AC4 | An encounter chance indicator is visible in the HUD |

```gherkin
Scenario: Random encounter on forest tile
  Given the party moves to a Forest tile (not a road)
  And the encounter chance for Forest is 15%
  When the PRNG roll is below 0.15
  Then a combat encounter triggers with CR ¼–4 enemies (scaled to party level)

Scenario: No encounters on roads
  Given the party moves along a Road tile
  Then no random encounter check occurs
```

---

### 5.3b Planar Dimensions

The Material Plane is the starting overworld, but **planar portals** scattered across the outer reaches of the world lead to other dimensions. Each dimension is itself an infinite overworld with its own biomes, terrain rules, native monsters, exclusive loot, and dungeon themes. This is the primary source of "endless variety" — the player can explore dozens of distinct worlds, each procedurally generated with unique visual identity.

#### Portal Discovery

- Portals appear on the Material Plane overworld in chunks where `effectiveDifficulty >= 4`
- Each portal is keyed to a specific dimension (visible on hover: name, danger level, icon)
- Entering a portal transitions to a new infinite overworld seeded by `hash(genesisSeed, dimensionId)`
- A return portal always exists at the entry point in the target dimension (see Return Portal Mechanics below)
- Additional portals within a dimension may lead to deeper sub-dimensions (e.g., Nine Hells → specific layer)

##### Return Portal Mechanics

Return portals are **bidirectional and permanent**:

| Property | Rule |
|----------|------|
| **Placement** | A return portal spawns on the exact entry tile in the target dimension |
| **Bidirectionality** | The return portal takes the party back to the source portal on the Material Plane (or parent dimension). Returning does NOT consume the portal — it remains usable. |
| **Persistence** | Return portals persist for the entire monthly seed. They disappear when the overworld regenerates (1st of each month). The player must re-discover portals after monthly reset. |
| **Cooldown** | No cooldown. Players can freely travel back and forth. |
| **Combat restriction** | Cannot use a return portal while in combat or while enemies are within 5 tiles (portal is "contested") |
| **Party position** | On return, the party appears on the source portal tile in the parent dimension. Position in the visited dimension is saved. Re-entering the same portal resumes from the saved position. |
| **Nested dimensions** | Sub-dimensional portals (e.g., Nine Hells layer portals) work identically. A chain of portals is maintained: Material → Nine Hells → Cania. Using the Cania return portal goes to Nine Hells entry, not directly to Material Plane. |
| **Dungeon portals** | Portals inside dungeons are one-way INTO the dungeon (no return portal inside). Complete or retreat from the dungeon normally. |

#### Dimension Registry

Each dimension is a self-contained infinite world with unique generation rules.

| Dimension | Biomes | Terrain Palette | Native Enemy Tiers | Min Party Level | Dungeon Themes | Exclusive Loot |
|-----------|--------|----------------|-------------------|-----------------|----------------|----------------|
| **Material Plane** | Meadow, Forest, Mountain, Desert, Swamp, Tundra, etc. | Earth tones (greens, browns) | 1-5 | 1 | Crypts, Caves, Fortresses, Ruins | Standard equipment |
| **Feywild** | Enchanted Forest, Crystal Glades, Mushroom Groves, Twilight Meadows | Saturated greens, purples, golds | 2-4 | 10 | Fairy Courts, Treant Hollows, Pixie Warrens | Fey-touched weapons (+charm), Glamour armor (illusion bonus) |
| **Shadowfell** | Dead Forest, Ash Plains, Shadow Marsh, Bone Fields | Desaturated grays, muted blues | 3-5 | 20 | Shadow Tombs, Necropolis, Dread Keeps | Shadow weapons (+necrotic), Soulbound armor (resist drain) |
| **Nine Hells** | Iron Wastes, Fire Plains, Brimstone Crags, Frozen Hells (Cania) | Reds, oranges, charcoal blacks | 4-5 | 35 | Infernal Fortresses, Devil's Courts, Torture Pits | Infernal weapons (+fire), Hellforged plate (fire resist) |
| **The Abyss** | Chaos Wastes, Demon Pits, Flesh Gardens, Screaming Canyons | Shifting colors, sickly greens, blood reds | 4-5 | 35 | Demon Lairs, Chaos Temples, Fleshwarren | Abyssal weapons (+chaos DMG), Demonskin armor (random resist) |
| **Elemental Plane of Fire** | Magma Seas, Cinder Islands, Smoke Stacks, Ember Fields | Intense oranges, yellows, whites | 3-5 | 25 | Fire Giant Forges, Efreeti Palaces, Magma Tubes | Flamebrand weapons, Salamander Scale armor |
| **Elemental Plane of Water** | Coral Reefs, Abyssal Trenches, Kelp Forests, Whirlpools | Deep blues, teals, bioluminescent | 3-5 | 25 | Sahuagin Temples, Kraken Dens, Sunken Ships | Tidal weapons (+water), Merfolk armor (swim speed) |
| **Elemental Plane of Earth** | Crystal Caverns, Gemstone Fields, Petrified Forests, Dust Storms | Browns, ambers, crystal whites | 3-5 | 25 | Dao Vaults, Xorn Tunnels, Gem Mines | Earthshaker weapons (+stun), Geode armor (AC bonus) |
| **Elemental Plane of Air** | Cloud Islands, Storm Fronts, Floating Ruins, Void Gaps | Light blues, whites, silver | 3-5 | 25 | Djinni Towers, Storm Giant Keeps, Lightning Spires | Stormcaller weapons (+lightning), Zephyr armor (+Initiative) |
| **Astral Plane** | Silver Void, Thought Reefs, Dead God Husks, Color Pools | Silver, iridescent, void black | 4-5 | 40 | Githyanki Fortresses, Mind Flayer Cities, Astral Dreadnoughts | Psychic weapons (+INT scaling), Astral armor (plane shift) |
| **Far Realm** | Alien Geometry, Tentacle Fields, Non-Euclidean Halls, Eye Clusters | Eldritch purples, impossible colors | 5 | 60 | Aboleth Temples, Elder Brain Hives, Void Maws | Eldritch weapons (+madness), Aberrant armor (tentacle parry) |
| **Underdark** | Fungal Forests, Lava Rivers, Crystal Caverns, Spider Webs | Deep purples, bioluminescent greens | 3-5 | 20 | Drow Cities, Mind Flayer Colonies, Beholder Lairs | Drow weapons (+poison), Adamantine armor |

#### Dimension-Specific Generation Rules

Each dimension modifies the base WFC + simplex noise pipeline:

- **Feywild**: Brighter, more saturated noise; trees are crystalline; roads are flower paths; WFC allows more unusual adjacencies (mushroom next to crystal)
- **Shadowfell**: Noise values inverted (dark variants of Material Plane biomes); fewer structures; undead roam overworld
- **Nine Hells**: 9 sub-layers each with distinct terrain (Avernus = fire wastes, Cania = frozen, Nessus = volcanic); layer portals connect them
- **The Abyss**: WFC constraints relaxed — chaos means impossible adjacencies ARE allowed (lava next to ice); terrain shifts randomly even after generation (corruption spreads)
- **Elemental Planes**: Single dominant element; 80% of tiles are that element's terrain with 20% variation
- **Astral Plane**: No ground; floating islands connected by silver bridges; chunks are sparse (30% void, 70% content)
- **Far Realm**: WFC rules intentionally broken; alien geometry; tiles may not obey normal adjacency (unsettling visual effect)
- **Underdark**: Ceiling overhead (no sky); chunks are cave systems; narrow corridors between large caverns; no roads, only tunnels

#### Dimension Terrain Tilesets

Each dimension requires its own tileset. Tilesets share the 32×32 grid but use dimension-specific palettes and art:

| Dimension | Tileset Count | Key Tiles |
|-----------|--------------|-----------|
| Material Plane | 20 tiles | Grass, Forest, Mountain, Sand, Water, Snow, Road, Bridge, Lava, Ruins, etc. |
| Feywild | 15 tiles | Crystal Grass, Mushroom, Twilight Tree, Fairy Ring, Moonbridge, Starpool |
| Shadowfell | 15 tiles | Dead Grass, Bone Tree, Ash, Shadow Pool, Dread Bridge, Mist |
| Nine Hells | 12 tiles per layer | Iron Ground, Brimstone, Hellfire, Frozen Stone (Cania), Chain Bridge |
| The Abyss | 14 tiles | Chaos Stone, Flesh Ground, Demon Gate, Acid Pool, Screaming Wall |
| Elemental (each) | 10 tiles | Element-specific: Magma/Ember, Coral/Deep, Crystal/Dust, Cloud/Storm |
| Astral | 8 tiles | Silver Void, Thought Island, Color Pool, God Husk, Gith Platform |
| Far Realm | 12 tiles | Eye Floor, Tentacle Wall, Non-Euclidean Path, Void Tear, Membrane |
| Underdark | 14 tiles | Cave Floor, Stalagmite, Fungus, Web, Lava River, Crystal Vein, Tunnel |

#### User Stories & Acceptance Criteria -- Planar Dimensions

**US-PLANE-01**: As a player, I can discover and enter planar portals on the overworld.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Portals appear as glowing icons on the overworld in high-difficulty chunks |
| AC2 | Hovering a portal shows the dimension name, danger level, and a brief description |
| AC3 | Clicking a portal plays a swirl animation (500ms vortex effect centered on portal tile) → 1s fade-to-black → load target dimension → 1s fade-from-black with target dimension's color palette |
| AC4 | A return portal exists at the entry point in the target dimension |

```gherkin
Scenario: Enter the Feywild
  Given a party at level 15 on the Material Plane overworld
  And a Feywild portal is visible on an adjacent tile
  When I click the portal
  Then the screen transitions to the Feywild overworld
  And the terrain uses the Feywild tileset and palette
  And a return portal to the Material Plane exists on the current tile

Scenario: Portal not visible at low difficulty
  Given a party exploring the inner zone (effectiveDifficulty < 4)
  Then no planar portals are present in any visible chunk
```

**US-PLANE-02**: As a player, I can see visually distinct terrain for each dimension.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each dimension uses its own tileset (not recolored Material Plane tiles) |
| AC2 | The sky/background color changes per dimension |
| AC3 | Ambient particles differ (fireflies in Feywild, ash in Shadowfell, embers in Hells) |

**US-PLANE-03**: As a player, I encounter dimension-native monsters that don't appear elsewhere.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | At least 60% of encounters in a dimension use dimension-native monsters |
| AC2 | Material Plane monsters may appear as "displaced" variants (max 40% of encounters) |
| AC3 | Dimension-exclusive loot only drops from dimension-native monsters |

**US-PLANE-04**: As a player, I can find dimension-exclusive equipment.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each dimension has at least 1 unique weapon type and 1 unique armor type |
| AC2 | Dimension-exclusive items have visual effects matching the dimension's palette |
| AC3 | Exclusive items can be brought back to other dimensions and used normally |

---

### 5.4 Dungeon Generation

Multi-floor dungeons generated using Binary Space Partitioning (BSP). Each dungeon has a **difficulty tier** that determines enemy composition, floor count, loot quality, and XP rewards. The player sees the difficulty before entering and chooses their risk. Dungeon **themes** vary by dimension and biome — no two dungeons look or play the same.

#### Dungeon Difficulty Tiers

| Tier | Name | Skulls | Rec. Level | Floors | Enemy Tiers | Loot Quality | XP Multiplier | Boss |
|------|------|--------|-----------|--------|-------------|-------------|----------------|------|
| I | Shallow Crypt | 1 | 1-5 | 2-3 | 1 | Common-Uncommon | 1.0x | Mini-boss (no phases) |
| II | Forgotten Tomb | 2 | 5-12 | 3-4 | 1-2 | Uncommon-Rare | 1.5x | Standard boss (2 phases) |
| III | Dark Cavern | 3 | 10-20 | 4-5 | 2-3 | Rare-Epic | 2.0x | Standard boss (3 phases) |
| IV | Cursed Fortress | 4 | 18-35 | 5-6 | 3-4 | Epic | 3.0x | Elite boss (3 phases + minions) |
| V | Abyssal Depths | 5 | 30-60 | 6-7 | 4-5 | Epic-Legendary | 5.0x | Legendary boss (4 phases) |
| VI | Mythic Lair | 5+ (red) | 50-100 | 7+ | 5 (+ prestige) | Legendary + Mythic | 8.0x | Mythic boss (prestige-only) |

#### Dungeon Themes by Dimension

Each dimension generates distinct dungeon types. The dungeon theme determines room visuals, ambient hazards, trap types, and decorative objects — not just a reskin but mechanically different.

| Dimension | Dungeon Themes | Ambient Hazards | Key Mechanics |
|-----------|---------------|-----------------|---------------|
| **Material Plane** | Crypt, Cave, Fortress, Sewer, Mine, Tower, Temple | Pit traps, poison darts, cave-ins | Standard BSP generation |
| **Feywild** | Fairy Court, Treant Hollow, Mushroom Maze, Crystal Cavern | Charm spores, illusion walls, time loops | Rooms shift between visits (randomized on re-entry) |
| **Shadowfell** | Shadow Tomb, Necropolis, Dread Keep, Bone Labyrinth | Life drain aura (-1 HP/turn in darkness), fear zones | Fog of war never fully clears (shadows creep back) |
| **Nine Hells** | Infernal Fortress, Torture Pit, Iron Prison, Frozen Vault | Fire floor tiles, chain traps, contract temptations | Tiered sub-layers; deeper = harder; devil bargains offered |
| **The Abyss** | Demon Lair, Chaos Temple, Flesh Warren, Screaming Pit | Random tile mutations, madness aura (confusion chance) | Room layout changes each floor (chaos generation) |
| **Elemental Fire** | Fire Giant Forge, Efreeti Palace, Magma Tube | Lava everywhere (75% lava tiles), heat exhaustion | Party takes passive fire DMG unless fire-resistant |
| **Elemental Water** | Sahuagin Temple, Kraken Den, Sunken Ship | Drowning timer (limited air), currents push units | Water movement costs doubled; swimming check per turn |
| **Elemental Earth** | Dao Vault, Xorn Tunnel, Gem Mine | Cave-ins (random tile collapse), tremors | Narrow corridors; no rooms > 6×6; claustrophobic |
| **Elemental Air** | Djinni Tower, Storm Keep, Lightning Spire | Wind gusts (push units), lightning strikes (random AoE) | Gaps between platforms; fall damage; no solid ground guaranteed |
| **Astral Plane** | Githyanki Fortress, Mind Flayer City, Dead God Interior | Psychic static (INT save or daze), gravity shifts | No walls — open space with floating platforms |
| **Far Realm** | Aboleth Temple, Elder Brain Hive, Void Maw | Madness buildup (cumulative debuff), reality tears (teleport traps) | Non-Euclidean: doors may loop, rooms connect illogically |
| **Underdark** | Drow City, Beholder Lair, Fungal Grotto, Spider Nest | Darkness (reduced vision), web traps (slow), spore clouds | Vertical levels (pits, ledges, stalactites); 3D-feeling layout |

#### Risk-Reward Design

- **Player chooses**: The overworld shows dungeon entrances with clear skull ratings and recommended levels; the player decides which to attempt
- **Under-leveled is lethal**: Entering a dungeon 10+ levels above the party means enemies will one-shot most characters. Permadeath makes this a fatal mistake
- **Over-leveled is safe but slow**: A level 30 party can farm Tier I dungeons safely but earns minimal XP (diminishing returns when 10+ levels above dungeon tier)
- **Sweet spot**: Dungeons at or slightly above party level provide the best XP/risk ratio
- **Retreat option**: The party can retreat from a dungeon at any staircase (losing the current floor's loot but keeping XP). Retreat is NOT available during boss fights
- **No grinding required**: The game provides enough Tier-appropriate dungeons that the player never needs to repeat a difficulty tier. However, players who enjoy safe farming can do so
- **Death consequences**: If the entire party wipes, the run ends. The player returns to the title screen with a reduced save (gold halved, items from current dungeon lost, characters retain levels/XP)

#### XP Diminishing Returns

To prevent grinding trivial dungeons, XP is reduced when the party is significantly above the dungeon's level range:

```
partyLevel = average level of party members
dungeonMaxLevel = dungeon tier's recommended max level
levelDelta = max(0, partyLevel - dungeonMaxLevel)

xpMultiplier = max(0.1, 1.0 - levelDelta * 0.1)
```

| Level Delta | XP Received |
|-------------|-------------|
| 0 (at-level) | 100% |
| 5 levels over | 50% |
| 10 levels over | 10% (minimum) |

##### Under-Leveled XP Bonus

Conversely, parties tackling dungeons above their level earn bonus XP as a risk reward:

```
dungeonMinLevel = dungeon tier's recommended min level
levelDeficit = max(0, dungeonMinLevel - partyLevel)

xpBonus = min(2.0, 1.0 + levelDeficit * 0.15)
```

| Level Deficit | XP Received |
|---------------|-------------|
| 0 (at-level) | 100% |
| 2 levels under | 130% |
| 5 levels under | 175% |
| 7+ levels under | 200% (cap) |

The bonus caps at 2× to prevent degenerate strategies. The lethality of under-leveled content is itself the balancing factor — the XP bonus is a reward for skill, not an incentive.

#### Generation Algorithm

1. Start with rectangular area
2. Recursively split into sub-rooms (BSP tree)
3. Connect rooms with corridors (L-shaped or straight)
4. Place room features based on room type
5. Add stairs down to next floor
6. Final floor contains boss room

#### Room Types

| Type | Description | Contents |
|------|-------------|----------|
| Empty | Standard room | Random encounters |
| Treasure | Loot room | Chests, trapped containers |
| Trap | Hazard room | Floor traps, wall darts, pit falls |
| Puzzle | Interactive room | Levers, pressure plates, riddles |
| Shrine | Blessing room | Heal party, buff altar, save point |
| Boss | Final room | Boss encounter + reward chest |
| Lair | Monster den | Guaranteed rare+ encounter, egg sacs/nests, environmental storytelling |
| Library | Knowledge room | Spell scrolls, lore books, trainable cantrips |
| Forge | Crafting room | Upgrade 1 equipment piece (dimension-specific material) |
| Portal | Dimensional rift | Links to a different dungeon theme mid-run (changes tileset + enemies) |

#### Dungeon Features

- Fog of war (tiles revealed as party explores)
- Destructible objects (barrels, crates, pots)
- Loot containers (chests, sarcophagi, hidden caches)
- Multiple floors per dungeon (3-7 depending on difficulty)
- Secret rooms (hidden walls, illusory floors)
- Environmental hazards (lava tiles, poison gas, collapsing floors)

#### Generation Invariants

- Every room is reachable from the entrance via corridors
- Exactly 1 staircase down per floor (except the last)
- Exactly 1 boss room on the final floor
- At least 1 shrine room per dungeon (any floor)
- No room smaller than 4x4 tiles
- No corridor longer than 15 tiles without a room
- Room type distribution: >= 50% Empty, <= 1 Boss, >= 1 Shrine, rest distributed
- Floor count determined by dungeon difficulty tier (Tier I: 2-3, Tier VI: 7+)
- Enemy CR on each floor matches the dungeon's CR range (with +1 CR per 2 floors deeper)
- Loot quality scales with both dungeon tier and floor depth
- Retreat staircase is always in the first room of each floor

#### User Stories & Acceptance Criteria -- Dungeons

**US-DUN-01**: As a player, I can explore dungeon rooms revealed through fog of war.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Unexplored tiles are hidden (rendered as black or shadow) |
| AC2 | Moving into a tile reveals it and its immediate neighbors (radius 2) |
| AC3 | Revealed tiles remain visible for the rest of the floor |
| AC4 | Fog of war resets on each new floor |

```gherkin
Scenario: Reveal tiles by exploring
  Given the party is on tile (3, 3) in a dungeon
  And tiles at (5, 3) and beyond are hidden by fog of war
  When the party moves to tile (4, 3)
  Then tiles within radius 2 of (4, 3) are revealed
  And previously revealed tiles remain visible

Scenario: Fog resets on new floor
  Given the party has explored 60% of floor 1
  When the party descends stairs to floor 2
  Then all floor 2 tiles are hidden except the staircase room
```

**US-DUN-02**: As a player, I can interact with objects in rooms (open chests, break barrels, pull levers).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Interactive objects are visually distinct from decoration |
| AC2 | Clicking an object in an adjacent tile triggers its interaction |
| AC3 | Chests yield 1-3 items determined by floor depth and PRNG |
| AC4 | Barrels have a 30% chance to drop a consumable |
| AC5 | Levers toggle a dungeon state (open/close a door or disable a trap) |
| AC6 | Each object can only be interacted with once |

```gherkin
Scenario: Open a chest
  Given the party is adjacent to a closed treasure chest
  When I click the chest
  Then the chest opens with an animation
  And 1-3 items are added to inventory
  And the chest cannot be opened again

Scenario: Break a barrel
  Given the party is adjacent to a barrel
  When I click the barrel
  Then the barrel breaks with a particle effect
  And there is a 30% chance a consumable drops
```

**US-DUN-03**: As a player, I can descend stairs to deeper dungeon floors with harder enemies.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Stairs are indicated by a distinct tile graphic |
| AC2 | Clicking stairs when adjacent triggers floor transition |
| AC3 | Auto-save triggers before descending |
| AC4 | Enemy stats on the new floor are 10% higher per floor (base stats determined by dungeon tier) |
| AC5 | The final floor staircase leads to the boss room instead |

**US-DUN-04**: As a player, I can find treasure rooms with valuable loot.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Treasure rooms have a distinct floor/wall visual theme |
| AC2 | Treasure rooms contain 2-4 loot containers |
| AC3 | Loot quality scales with dungeon depth |
| AC4 | Some containers may be trapped (DEX check to disarm) |

**US-DUN-05**: As a player, I can encounter trap rooms and use DEX/INT to avoid or disarm them.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Traps are not visible until the party enters the room or a Rogue detects them |
| AC2 | Stepping on a trap deals damage based on trap type and floor depth |
| AC3 | A character with DEX >= threshold can attempt disarm (success = DEX vs trap DC) |
| AC4 | Rogues get +5 to disarm checks |
| AC5 | Disarmed traps grant XP |

```gherkin
Scenario: Step on undetected floor trap
  Given the party enters a trap room with a hidden spike trap at (7, 4)
  And no party member has detected the trap
  When a character steps on (7, 4)
  Then the trap activates dealing damage proportional to floor depth
  And a trap animation plays

Scenario: Rogue detects and disarms trap
  Given a Rogue with DEX 16 is in the party
  And a trap has DC 14
  When the party enters the trap room
  Then the Rogue detects the trap (highlighted on the tile)
  When I click the trap to disarm
  Then the disarm succeeds (16 + 5 Rogue bonus > 14)
  And the party gains XP for disarming
```

**US-DUN-06**: As a player, I can discover shrine rooms that heal my party and offer a save point.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Shrine rooms have a visually distinct altar at their center |
| AC2 | Clicking the altar heals all party members to full HP and MP |
| AC3 | Each shrine can only be used once per dungeon run |
| AC4 | Using a shrine triggers an auto-save |

**US-DUN-07**: As a player, I can find secret rooms with rare loot.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Secret rooms are not shown on the map until discovered |
| AC2 | A secret entrance is revealed by clicking a suspicious wall tile (INT check) |
| AC3 | Secret rooms contain items of Rare or higher rarity |
| AC4 | At most 1 secret room per floor, 0-2 per dungeon |

**US-DUN-08**: As a player, I can see the dungeon layout change monthly when maps regenerate.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The BSP seed includes `YYYY-MM` |
| AC2 | Different months produce different room placements, corridor layouts, and room types |
| AC3 | Same month always produces identical dungeon structure |

**US-DUN-09**: As a player, I face permanent consequences for party wipe (permadeath risk-reward).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | If all party members die in combat, the run ends immediately |
| AC2 | Gold is halved as a death penalty |
| AC3 | Items looted in the current dungeon run are lost |
| AC4 | Characters retain their levels, XP, and pre-dungeon equipment |
| AC5 | The defeat state is auto-saved -- no reloading to pre-combat |
| AC6 | The player returns to camp with reduced resources |

```gherkin
Scenario: Party wipe in dungeon
  Given the party entered a Tier III dungeon with 2000 gold
  And looted a Rare sword on floor 2
  When the entire party dies on floor 3
  Then the game saves the defeat state
  And the player returns to camp with 1000 gold (halved)
  And the Rare sword from floor 2 is lost
  But all characters keep their levels and pre-dungeon equipment
  And the Tier III dungeon entrance resets on the overworld

Scenario: Strategic retreat vs. death
  Given the party is on floor 4 with low HP and no potions
  And a staircase is reachable
  When I choose "Retreat" at the staircase
  Then the party escapes with all XP earned
  And floor 4 loot is lost, but floors 1-3 loot is kept
  And the party returns to the overworld alive
```

**US-DUN-10**: As a player, I can gauge whether a dungeon floor is too dangerous and decide to retreat.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Enemy level range for the current floor is shown in the dungeon HUD |
| AC2 | The first room of each floor has a brief "floor summary" (enemy count, traps detected) |
| AC3 | The staircase back up is always in the first room (retreat available immediately) |
| AC4 | Enemies on the current floor are visible in scouted rooms before engaging |

---

### 5.5 Combat System (Shining Force Style)

Turn-based tactical combat on a grid map. Inspired by Shining Force's presentation and mechanics.

#### Combat Flow

1. Encounter triggered (overworld random, dungeon room, boss)
2. Party and enemies placed on tactical grid
3. Roll initiative: d20 + DEX modifier per unit (ties broken by DEX score, then random)
4. Each unit's turn: **Move** (A* pathfinding within base speed in tiles) → **Action** (Attack / Spell / Item / Wait / 5-ft step)
5. **Attack cut-in**: Camera zooms to show defender's tile background, defender sprite, attacker platform, attacker sprite with weapon/shield
6. Damage calculated, effects applied
7. Repeat until one side eliminated or retreats
8. Victory: XP + loot distribution

#### Tactical Grid

- Grid size varies by encounter (8x8 to 16x12)
- Each tile has a terrain type affecting combat (see 5.8)
- Movement range shown as highlighted tiles
- Attack range shown as red-highlighted tiles

#### d20 Core Mechanic

All combat resolution uses the **D&D 3rd Edition d20 SRD** directly. Every attack, spell save, and skill check follows:

**d20 + modifiers ≥ target number → success**

##### Ability Modifier

```
abilityMod = floor((abilityScore - 10) / 2)
```

##### Attack Roll

```
// Melee
attackRoll = d20 + BAB + STR_mod + weaponEnhancement + sizeMod + misc
hit = (attackRoll >= target.AC) || (d20_natural == 20)
miss = (d20_natural == 1) regardless of total

// Ranged
attackRoll = d20 + BAB + DEX_mod + weaponEnhancement + sizeMod - rangePenalty + misc
rangePenalty = -2 per range increment beyond the first
```

##### Armor Class (AC)

```
AC = 10 + armorBonus + shieldBonus + DEX_mod + naturalArmor + sizeBonus + deflection + misc
Touch AC = 10 + DEX_mod + sizeBonus + deflection         // ignores armor/shield/natural
Flat-footed AC = AC - DEX_mod                              // when surprised or unaware
```

##### Damage Roll

```
damage = weaponDamageDie + STR_mod (melee) + weaponEnhancement + misc
// Two-handed melee: +1.5× STR_mod
// Off-hand: +0.5× STR_mod
// Ranged: no STR_mod (except composite bows add STR_mod up to bow rating)
finalDamage = max(1, damage - target.DR)
```

##### Critical Hit

```
if (d20_natural >= weapon.threatRange)      // e.g., 20 for most, 19-20 for longsword, 18-20 for rapier
  confirmRoll = d20 + BAB + ability_mod + misc
  if (confirmRoll >= target.AC)
    damage *= weapon.critMultiplier          // x2, x3, or x4 depending on weapon
```

##### Saving Throw

```
saveRoll = d20 + baseSave + abilityMod + misc
Fortitude = d20 + baseFort + CON_mod         // vs poison, disease, death effects
Reflex    = d20 + baseRef  + DEX_mod         // vs AoE, traps, breath weapons
Will      = d20 + baseWill + WIS_mod         // vs mind control, fear, illusions
success = (saveRoll >= DC)
```

##### Spell Save DC

```
spellDC = 10 + spellLevel + casterAbilityMod
```

##### Initiative

```
initiative = d20 + DEX_mod + misc
```

#### Combat Mechanics

| Mechanic | d20 Rule | Description |
|----------|----------|-------------|
| **Attack roll** | d20 + BAB + ability mod ≥ AC | Natural 20 always hits, natural 1 always misses |
| **Critical hit** | Threat on weapon crit range → confirm d20 + BAB ≥ AC | Confirmed crit multiplies all damage dice (×2/×3/×4) |
| **Flanking** | +2 attack bonus | Ally directly opposite the target across the grid |
| **Elevation** | +1 attack (higher), −1 attack (lower) | Height advantage on tactical grid tiles |
| **Cover** | +4 AC (cover), +2 AC (soft cover) | Terrain, obstacles, or allies between attacker and target |
| **Terrain** | Per-terrain modifiers (see 5.8) | Movement cost, cover, concealment, magic modifiers |
| **Attack of Opportunity** | d20 + BAB + STR mod ≥ AC | Triggered when enemy moves out of a threatened tile |
| **Retreat** | Party leader action | Ends combat; keep XP, forfeit loot. Unavailable in boss fights |
| **Damage Reduction (DR)** | Subtract DR from each damage roll | Some creatures/armor reduce incoming physical damage |
| **Spell Resistance (SR)** | Caster rolls d20 + caster level ≥ SR | Some creatures resist spells; caster must overcome SR first |

#### Weapon Damage Dice (d20)

| Weapon Category | Damage Die | Crit Range | Crit Mult | Damage Type | Reach | Range (thrown/ranged) |
|----------------|-----------|------------|-----------|-------------|-------|----------------------|
| Sword (longsword) | 1d8 | 19-20 | ×2 | Slashing | 1 | -- |
| Axe (battleaxe) | 1d8 | 20 | ×3 | Slashing | 1 | -- |
| Mace (heavy mace) | 1d8 | 20 | ×2 | Bludgeoning | 1 | -- |
| Staff (quarterstaff) | 1d6/1d6 | 20 | ×2 | Bludgeoning | 1 | -- |
| Bow (longbow) | 1d8 | 20 | ×3 | Piercing | -- | 5 tiles |
| Crossbow (heavy) | 1d10 | 19-20 | ×2 | Piercing | -- | 6 tiles |
| Dagger | 1d4 | 19-20 | ×2 | Piercing | 1 | 3 tiles (thrown) |
| Spear (longspear) | 1d8 | 20 | ×3 | Piercing | 2 | -- |
| Warhammer | 1d8 | 20 | ×3 | Bludgeoning | 1 | -- |
| Flail (heavy flail) | 1d10 | 19-20 | ×2 | Bludgeoning | 1 | -- |

#### Attack Resolution (d20)

Full attack sequence for melee:

```
1. Attacker declares target
2. Check range (must be within weapon reach in tiles)
3. Roll d20
   + BAB
   + STR_mod (melee) or DEX_mod (ranged)
   + weapon enhancement bonus
   + flanking bonus (+2 if ally opposite target)
   + elevation bonus (+1 higher, -1 lower)
   + size modifier (+1 Small, -1 Large, etc.)
   - cover penalty (target behind cover: -4 or -2)
4. Compare total to target AC
   - Natural 20: always hits (check for crit)
   - Natural 1: always misses
5. If hit: roll weapon damage die + STR_mod + enhancement + misc
6. If natural d20 >= weapon threat range:
   - Confirm crit: roll d20 + BAB + mods >= target AC
   - If confirmed: multiply damage by crit multiplier
7. Subtract target's Damage Reduction (if any)
8. Apply final damage (minimum 1 on a confirmed hit)
```

#### Attack Cut-In Screen

The signature Shining Force visual moment:

```
+-------------------------------------------+
|  [Defender's terrain tile as background]   |
|                                            |
|   [Defender sprite]     [Attacker sprite]  |
|   (on ground)          (on raised platform)|
|                                            |
|   [Damage numbers / spell effects]         |
+-------------------------------------------+
```

- Defender shown on their terrain tile
- Attacker shown on a raised stone platform
- Weapon and shield visible on sprites (paper-doll)
- Spell effects overlay the scene
- Damage numbers float up with color coding (white=physical, blue=magic, green=heal, red=critical)

#### User Stories & Acceptance Criteria -- Combat

**US-COMBAT-01**: As a player, I can see all units on a tactical grid with clear terrain markings.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | All party members and enemies are visible on the grid |
| AC2 | Each unit shows an HP bar above their sprite |
| AC3 | The active unit has a pulsing highlight |
| AC4 | Terrain types are visually distinct per tile |

**US-COMBAT-02**: As a player, I can click a unit to see its movement range highlighted.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking a friendly unit highlights all reachable tiles in blue |
| AC2 | Movement range is calculated using A* pathfinding with terrain costs |
| AC3 | Range = base speed in tiles (each terrain tile costs its movement cost from the table) |
| AC4 | Tiles occupied by other units are not highlighted |
| AC5 | Clicking elsewhere or pressing the unit again clears the highlight |

```gherkin
Scenario: Display movement range
  Given it is the Fighter's turn with base speed 6 tiles
  And the Fighter is on a Plains tile (cost 1)
  And there is a Forest tile 3 tiles away (cost 2 per tile)
  When I click the Fighter
  Then blue tiles show all positions reachable within 6 movement points
  And the Forest tile 3 away is NOT highlighted (cost = 3 × 2 = 6, exactly at limit)

Scenario: Roads allow extended movement
  Given a Human unit with base speed 6 on a Road tile
  When movement range is calculated along Road tiles (cost 0.5)
  Then the unit can reach tiles 12 road-tiles away (6 / 0.5 = 12)
```

**US-COMBAT-03**: As a player, I can move my unit by clicking a highlighted tile.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking a blue-highlighted tile moves the unit along the A* shortest path |
| AC2 | The unit animates along the path (not teleporting) |
| AC3 | After moving, the action menu appears (Attack / Spell / Item / Wait) |
| AC4 | Moving to the current tile (staying) is valid and costs 0 movement |
| AC5 | Movement is undoable until an action is taken |

```gherkin
Scenario: Move and attack
  Given it is the Fighter's turn
  And the Fighter is at (2, 3) with base speed 6
  When I click the highlighted tile (4, 3)
  Then the Fighter walks to (4, 3) along the path
  And the action menu appears
  When I click "Attack"
  Then enemies within attack range are highlighted in red

Scenario: Undo movement before acting
  Given the Fighter moved from (2, 3) to (4, 3)
  And the action menu is showing
  When I right-click or click "Undo"
  Then the Fighter returns to (2, 3)
  And the movement range highlights again
```

**US-COMBAT-04**: As a player, I can attack an enemy in range and see the Shining Force-style cut-in animation.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking an enemy in attack range triggers the cut-in |
| AC2 | Cut-in shows attacker on platform, defender on terrain, for 1-2 seconds |
| AC3 | Damage numbers float up: white (physical), red (critical), blue (magic) |
| AC4 | After the cut-in, the grid updates with the defender's new HP |
| AC5 | If the defender's HP reaches 0, a death animation plays and the unit is removed |

```gherkin
Scenario: Melee attack with cut-in (d20)
  Given the Fighter (BAB +5, STR mod +3, longsword 1d8) is adjacent to a Goblin (AC 15, HP 12)
  And terrain modifiers are neutral (Plains, no cover)
  When I select Attack and click the Goblin
  Then the game rolls d20 + 5 + 3 = d20 + 8 vs AC 15
  And the cut-in screen shows Fighter on platform and Goblin on Plains
  And if the roll is ≥ 15 (hit), damage = 1d8 + 3 is shown floating up in white
  And the Goblin's HP is reduced by the damage rolled

Scenario: Critical hit (d20)
  Given the Rogue (BAB +3, DEX mod +4, dagger 1d4, crit 19-20/×2) attacks a Skeleton (AC 13)
  And the d20 roll is a natural 19 (within threat range 19-20)
  When the attack executes
  Then a confirmation roll is made: d20 + 3 + 4 = d20 + 7 vs AC 13
  And if confirmed, damage = (1d4 + 4) × 2 is shown in red
  And if not confirmed, normal damage = 1d4 + 4 is shown in white
```

**US-COMBAT-05**: As a player, I can cast spells with AoE patterns shown on the grid.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Selecting "Spell" opens a spell list filtered by the unit's class |
| AC2 | Selecting a spell shows the AoE pattern as a colored overlay on the grid |
| AC3 | The pattern can be positioned by hovering (center on cursor tile) |
| AC4 | Clicking confirms the cast, deducting MP and applying effects |
| AC5 | Insufficient MP grays out the spell in the list |

```gherkin
Scenario: Cast Fireball (diamond AoE)
  Given the Wizard has 20 MP and Fireball costs 15 MP (diamond 9-tile pattern)
  When I select Spell > Fireball
  Then a 9-tile diamond pattern follows the cursor on the grid
  When I click to target the center on an enemy cluster
  Then 15 MP is deducted
  And all units in the 9-tile area take fire damage
  And a fire spell effect animates in the cut-in

Scenario: Insufficient MP
  Given the Wizard has 10 MP and Fireball costs 15 MP
  When I open the spell list
  Then Fireball is grayed out and unclickable
```

**US-COMBAT-06**: As a player, I can use items from my inventory during combat.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Selecting "Item" shows consumable items (potions, scrolls) |
| AC2 | Using a health potion restores HP to the target ally |
| AC3 | Using an item consumes the unit's action for the turn |
| AC4 | Items with a target show a targeting overlay (ally selection) |

**US-COMBAT-07**: As a player, I can see turn order displayed and plan accordingly.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A turn order bar shows portraits of all units sorted by initiative roll (d20 + DEX mod) |
| AC2 | The current unit's portrait is highlighted |
| AC3 | The next 5-8 turns are visible |
| AC4 | Initiative is rolled once at combat start; delays/readied actions can change position |
| AC5 | Dead units are removed from the turn order immediately |

**US-COMBAT-08**: As a player, I benefit from flanking bonuses when positioning allies strategically.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Flanking occurs when an ally is on the opposite side of the defender (N/S or E/W axis) |
| AC2 | Flanking grants +2 to attack roll (d20 flanking bonus) |
| AC3 | A "Flanking!" indicator appears during the attack |
| AC4 | Both the flanking ally and the attacker receive the +2 bonus against the flanked target |

```gherkin
Scenario: Flanking bonus applied (d20)
  Given the Fighter (BAB +5, STR +3) is at (5, 3) and the Rogue is at (5, 5)
  And a Goblin (AC 15) is at (5, 4) (between them on the same column)
  When the Fighter attacks the Goblin
  Then flanking is detected (Rogue on opposite side)
  And attack roll = d20 + 5 + 3 + 2 (flanking) = d20 + 10 vs AC 15
  And a "Flanking!" indicator appears

Scenario: No flanking without opposite ally
  Given the Fighter is at (5, 3) and the Rogue is at (6, 4)
  And a Goblin (AC 15) is at (5, 4)
  When the Fighter attacks the Goblin
  Then no flanking bonus is applied (Rogue is diagonal, not directly opposite)
  And attack roll = d20 + 5 + 3 = d20 + 8 vs AC 15
```

**US-COMBAT-09**: As a player, I can retreat from combat if the battle is unwinnable.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The party leader's action menu includes "Retreat" |
| AC2 | Retreat ends combat immediately |
| AC3 | The party keeps earned XP but forfeits loot drops |
| AC4 | The party returns to the tile where the encounter started |
| AC5 | Retreat is not available during boss encounters |

**US-COMBAT-10**: As a player, I can see terrain effects on the grid (forest gives cover bonus, etc.).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Hovering any grid tile shows a tooltip with terrain name, cover bonus, and special effects |
| AC2 | Units standing on terrain with cover show a small shield icon |
| AC3 | Lava tiles deal 2d6 fire damage per turn to any unit standing on them |

**US-COMBAT-11**: As a player, I benefit from Attacks of Opportunity when enemies move carelessly.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | When an enemy moves out of a threatened tile without using a 5-ft step, the party member gets an AoO |
| AC2 | AoO uses a full attack roll: d20 + BAB + STR mod vs target AC |
| AC3 | A successful AoO triggers a mini cut-in showing the defender striking |
| AC4 | Each unit gets 1 AoO per round (more with Combat Reflexes feat: 1 + DEX mod) |
| AC5 | AoO damage uses normal weapon damage (d20 damage roll) |

**US-COMBAT-12**: As a player, I see a victory screen after defeating all enemies.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Victory triggers when all enemies have 0 HP |
| AC2 | XP earned is displayed per party member |
| AC3 | Loot drops are displayed with rarity colors |
| AC4 | A "Continue" button returns to the dungeon or overworld |

```gherkin
Scenario: Victory and XP distribution
  Given the party defeats 3 Goblins worth 30 XP each
  And 3 party members survived (1 was KO'd)
  When the victory screen appears
  Then total XP = 90
  And each surviving member receives 30 XP (90 / 3)
  And the KO'd member receives 0 XP
```

---

### 5.5b Status Effects & Conditions (D&D 3.5e)

All conditions follow D&D 3.5e rules. Conditions are tracked per-unit with duration counters. Unless stated otherwise, saving throws to resist conditions use the attacker's DC.

#### Condition Reference Table

| Condition | Effect | Duration | Save to End | Stacking |
|-----------|--------|----------|-------------|----------|
| **Blinded** | −2 AC, lose DEX bonus to AC, −4 on STR/DEX checks, 50% miss chance on attacks, movement at half speed | Source-dependent | Varies | No (reapply resets duration) |
| **Charmed** | Cannot attack the charmer, +4 on charmer's CHA-based checks vs target | Source-dependent | Will (each round) | No |
| **Confused** | Each round: 10% act normally, 10% do nothing, 20% flee, 30% attack nearest creature, 30% attack self | 1d4+1 rounds | Will (initial only) | No |
| **Dazed** | Can take no actions (not even move). Not helpless. | 1 round | None | No |
| **Deafened** | −4 Initiative, 20% arcane spell failure (verbal), cannot hear-based Perception checks | Source-dependent | Fort | No |
| **Exhausted** | −6 STR, −6 DEX, movement at half speed. Cannot run or charge | Until long rest | None (rest only) | See Fatigued→Exhausted |
| **Fatigued** | −2 STR, −2 DEX, cannot run or charge. Additional fatigue = Exhausted | Until short rest | None (rest only) | Escalates to Exhausted |
| **Frightened** | −2 attack, saves, checks. Must flee from source by safest route | Source-dependent | Will (each round) | Escalates to Panicked |
| **Grappled** | Cannot move, −4 DEX, cannot cast spells with somatic components, −2 attack | Until escape (opposed check) | STR or DEX check | No |
| **Nauseated** | Can only take a single move action per turn (no attacks, no spells) | Source-dependent | Fort (each round) | No |
| **Panicked** | As Frightened + drop held items, 50% chance to drop equipped weapon | Source-dependent | Will (each round) | No |
| **Paralyzed** | Cannot move, act, or speak. Helpless (auto-crit by melee attacks, coup de grace possible). DEX = 0 | Source-dependent | Fort/Will (each round) | No |
| **Petrified** | Turned to stone. Unconscious, cannot take any actions. Immune to further damage but breakable | Until cured | None (cure only) | No |
| **Poisoned** | Take ability damage (varies by poison) each round. Specific to poison type | Varies | Fort (each round, 2 saves to cure) | Different poisons stack |
| **Prone** | −4 melee attack, +4 AC vs ranged, −4 AC vs melee. Stand up costs a move action and provokes AoO | Until stand up | None (move action) | No |
| **Shaken** | −2 attack rolls, saves, and skill checks. Lesser form of Frightened | Source-dependent | Will | Escalates to Frightened |
| **Sickened** | −2 attack, damage, saves, and checks | Source-dependent | Fort (each round) | No |
| **Stunned** | Cannot act, drops anything held, −2 AC, loses DEX bonus to AC | 1-2 rounds (source) | Fort | No |
| **Unconscious** | Helpless. Cannot take any actions. Auto-crit by melee. Coup de grace possible | Until healed to 1+ HP or stabilized | None | No |

#### Condition Escalation

Some conditions escalate when reapplied:
- Shaken → Frightened → Panicked
- Fatigued → Exhausted
- Sickened → Nauseated

Applying a lower condition to a creature already suffering a higher one has no effect.

#### Condition Immunity by Type

| Creature Type | Immune To |
|---------------|-----------|
| Undead | Exhaustion, Poisoned, Paralyzed (from non-magical), Stunned, Charmed, Frightened |
| Constructs | All mind-affecting (Charmed, Confused, Frightened), Poisoned, Exhaustion |
| Oozes | Prone, Grappled, Stunned, Paralyzed, Blinded, Deafened |
| Incorporeal | Grappled, Prone, Petrified |

#### Condition Removal

| Method | Conditions Removed |
|--------|--------------------|
| Lesser Restoration (spell) | Blinded, Deafened, Poisoned, Sickened, one ability damage type |
| Remove Paralysis (spell) | Paralyzed, Stunned, Hold effects |
| Remove Fear (spell) | Shaken, Frightened, Panicked |
| Break Enchantment (spell) | Charmed, Confused, Cursed, Petrified |
| Heal (spell) | All conditions except death and level drain |
| Antidote (consumable) | Poisoned, Sickened |
| Camp Rest | Fatigued, Exhausted (to Fatigued), Sickened |
| Shrine | All conditions except Petrified and death |

#### Poison Types (D&D 3.5e)

| Poison | Type | Fort DC | Initial Damage | Secondary Damage | Source |
|--------|------|---------|----------------|------------------|--------|
| Small Centipede | Injury | 11 | 1d2 DEX | 1d2 DEX | Giant Rat, Monstrous Spider |
| Medium Spider Venom | Injury | 14 | 1d4 STR | 1d4 STR | Phase Spider, Drider |
| Wyvern Poison | Injury | 17 | 2d6 CON | 2d6 CON | Wyvern |
| Purple Worm Poison | Injury | 24 | 1d6 STR | 2d6 STR | Purple Worm |
| Carrion Crawler Mucus | Contact | 13 | Paralysis | None | Carrion Crawler |
| Drow Sleep Poison | Injury | 13 | Unconscious 1min | Unconscious 2d4 hours | Drow Elite |
| Burnt Othur Fumes | Inhaled | 18 | 1 CON drain | 3d6 CON | Trap (alchemical) |
| Assassin's Blood | Ingested | 15 | 1d6 CON | 1d6 CON | Player-crafted (Rogue/Assassin) |

#### User Stories — Status Effects

**US-COND-01**: As a player, I can see all active conditions on my party members and enemies.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Active conditions appear as icons below the unit's HP bar |
| AC2 | Hovering an icon shows condition name, effect summary, and remaining duration |
| AC3 | Beneficial conditions use green/blue icons; harmful conditions use red/orange icons |
| AC4 | When a condition is applied, a floating text label appears briefly ("Poisoned!", "Stunned!") |
| AC5 | Condition removal shows a "Cured!" label in green |

```gherkin
Scenario: Poison applied and tracked
  Given a Rogue attacks a Fighter with a poisoned dagger (Fort DC 14)
  And the Fighter fails the Fort save with a roll of 11
  Then a "Poisoned" icon appears under the Fighter's HP bar
  And the tooltip shows "Poisoned: 1d4 STR damage/round, Fort DC 14 to end (2 saves)"
  And at the start of the Fighter's next turn, STR damage is applied
```

---

### 5.5c Death & Resurrection (D&D 3.5e)

#### Hit Points and Dying

| HP Threshold | State | Rules |
|--------------|-------|-------|
| 1+ HP | **Alive** | Fully functional |
| 0 HP | **Disabled** | Can take only a single move or standard action. Taking a standard action deals 1 HP damage to self |
| −1 to −(CON score − 1) HP | **Dying** | Unconscious and helpless. Lose 1 HP per round. Each round: 10% chance to stabilize naturally |
| −(CON score) HP or lower | **Dead** | Cannot act. Requires Raise Dead or Resurrection to return |

#### Stabilization

- **Natural stabilization**: 10% chance per round while dying
- **Ally Heal check**: DC 15 Wisdom check as a standard action (stabilizes but does not restore HP)
- **Any healing**: Restores consciousness if brought to 1+ HP
- **Stabilized but unconscious**: Remains at current negative HP, no longer losing HP. Wakes naturally after 1d4 hours (or instantly with any healing)

#### Death and Resurrection

| Method | Spell Level | HP Restored | Conditions | Time Window |
|--------|-------------|-------------|------------|-------------|
| **Revivify** | 3 | 1 HP | Dead for ≤ 3 rounds, costs 300 gp diamond | Combat only |
| **Raise Dead** | 5 | 50% max HP | Dead for ≤ 1 day per caster level, costs 5000 gp diamond | Camp/Town |
| **Resurrection** | 7 | Full HP | Dead for ≤ 10 years per caster level, costs 10000 gp diamond | Town only (Promotion Hall) |
| **Revive Tonic** (item) | -- | 25% max HP | Dying or dead ≤ 3 rounds | Combat |
| **Phoenix Down** (item) | -- | Full HP | Dying or dead ≤ 5 rounds | Combat |

#### Resurrection Penalties

Per D&D 3.5e, returning from the dead imposes:
- **−1 level** (lose 1 HD worth of HP, BAB, saves, etc.) — minimum level 1
- **−2 to all ability scores** for 24 hours (game time, approximately 3-5 dungeon floors)
- **Cannot be resurrected** if soul is unwilling (not applicable to player characters)

#### Party Wipe (Total Party Kill)

If all party members are Dead or Dying with no conscious allies:

1. Combat ends immediately
2. Transition to `DEFEAT` state
3. Player offered two options:
   - **Retreat** (if available): Party returns to last camp with all members at 1 HP, lose 50% of gold earned this run, lose all unequipped loot from current dungeon. Progress saved.
   - **Game Over**: Return to Title Screen. Save file preserved at last auto-save point (pre-dungeon entry). Current dungeon progress lost.

#### Companion Death

- Companions follow the same dying rules as characters
- Companions cannot be resurrected mid-dungeon; they return at the next camp visit with 1 HP
- Permanent companion death is not possible (they always regenerate at camp)

#### User Stories — Death/Resurrection

**US-DEATH-01**: As a player, I can see when my characters are dying and attempt to stabilize them.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A dying character's portrait is grayed out with a red "Dying" label |
| AC2 | A visible timer shows rounds until death (CON score countdown) |
| AC3 | Adjacent allies have a "Stabilize" action (DC 15 WIS check) |
| AC4 | Any healing spell or potion automatically stabilizes and restores HP |

```gherkin
Scenario: Character stabilized by ally
  Given a Wizard at −3 HP (CON 12, dies at −12)
  And a Cleric is adjacent
  When the Cleric uses the "Stabilize" action
  And rolls a WIS check of 15+
  Then the Wizard is stabilized at −3 HP
  And the "Dying" label changes to "Unconscious (Stable)"
  And the Wizard no longer loses HP per round

Scenario: Party wipe triggers defeat
  Given all 4 party members are Dead
  And no conscious companions remain
  Then combat ends immediately
  And the DEFEAT screen appears with "Retreat" and "Game Over" options
```

---

### 5.6 Magic & Spells

Spell system uses **exact D&D 3rd Edition SRD spell levels 0-9**. This 1:1 mapping means every D&D spell, CR calculation, and encounter balance formula can be applied directly — no translation layer needed. Eight arcane schools, spell levels 0 (cantrips) through 9 (wish/miracle), unlocking progressively as the character levels up.

#### Spell Schools (D&D 3e)

| School | Theme | Primary Classes | Secondary Classes |
|--------|-------|-----------------|-------------------|
| Evocation | Damage: fire, lightning, force, cold, radiant | Wizard, Sorcerer | Cleric (light domain spells) |
| Necromancy | Death, undead, life drain, animate dead | Wizard, Warlock | Cleric (death domain spells) |
| Abjuration | Shields, wards, dispels, protection, banishment | Wizard, Cleric | Paladin, Ranger |
| Conjuration | Summons, teleport, create matter, healing | Wizard, Warlock | Cleric, Ranger |
| Divination | Reveal, foresight, true seeing, detection | Wizard, Cleric | Bard, Ranger |
| Enchantment | Charm, buff, debuff, compulsion, hold | Bard, Sorcerer | Wizard, Warlock |
| Illusion | Decoy, invisibility, confusion, phantasm | Bard, Wizard | Sorcerer |
| Transmutation | Polymorph, enhance, alter, haste, slow | Wizard, Sorcerer | Cleric, Ranger |

#### Class Spell Access

Uses D&D 3e progression directly. Max spell level determines the highest spell a class can ever cast.

| Class | Schools Available | Max Spell Level | MP Pool | Caster Type |
|-------|-----------------|----------------|---------|-------------|
| **Wizard** | All 8 (generalist) | 9 | High (base 30 + 5×INT mod) | Full caster (prepared) |
| **Sorcerer** | Evocation, Enchantment, Transmutation + metamagic | 9 | High (base 30 + 5×CHA mod) | Full caster (spontaneous) |
| **Cleric** | Abjuration, Conjuration, Divination, Necromancy (heal only) | 9 | Medium (base 25 + 5×WIS mod) | Full caster (prepared) |
| **Bard** | Enchantment, Illusion, Divination, Transmutation | 6 | Medium (base 20 + 4×CHA mod) | 2/3 caster (spontaneous) |
| **Warlock** | Necromancy, Conjuration, Enchantment | 5 (pact slots) | Low (base 15 + 3×CHA mod), shrine-recharge | Short-rest caster |
| **Paladin** | Abjuration, Conjuration (heal), Evocation (smite) | 4 | Low (base 10 + 3×CHA mod) | 1/2 caster |
| **Ranger** | Conjuration (nature), Divination, Transmutation | 4 | Low (base 10 + 3×WIS mod) | 1/2 caster |
| Fighter | -- | -- | -- | Non-caster |
| Barbarian | -- | -- | -- | Non-caster |
| Rogue | -- | -- | -- | Non-caster |

#### Spell Level Unlock Table (D&D 3e — Direct Mapping)

| Spell Level | Character Level to Unlock | MP Cost | Typical Effect Power | D&D Equivalent |
|------------|--------------------------|---------|---------------------|----------------|
| **0 (Cantrip)** | 1 | 0 (free, unlimited) | 3-8 DMG, minor utility | Cantrips / Orisons |
| **1** | 1 | 2-4 | 8-14 DMG, single target, minor buffs | Magic Missile, Cure Wounds, Shield |
| **2** | 3 | 5-8 | 14-22 DMG, small AoE, moderate buffs | Scorching Ray, Web, Hold Person |
| **3** | 5 | 10-15 | 25-40 DMG, medium AoE, control | Fireball, Lightning Bolt, Haste |
| **4** | 7 | 16-22 | 35-55 DMG, strong AoE, major buffs | Ice Storm, Banishment, Polymorph |
| **5** | 9 | 24-30 | 50-70 DMG, large AoE, powerful control | Cone of Cold, Hold Monster, Raise Dead |
| **6** | 11 | 32-40 | 60-90 DMG, devastating AoE, mass effects | Chain Lightning, Disintegrate, Heal |
| **7** | 13 | 42-50 | 80-120 DMG, battlefield control | Prismatic Spray, Finger of Death |
| **8** | 15 | 52-60 | 100-150 DMG, near-encounter-ending | Sunburst, Power Word Stun, Earthquake |
| **9** | 17 | 65-80 | 120-200 DMG, encounter-ending, game-changers | Wish, Meteor Swarm, Power Word Kill |

Half-casters (Paladin, Ranger) unlock spell levels at **double** the character level: they get level 1 spells at character level 2, level 2 at 6, level 3 at 10, level 4 at 14.

2/3 casters (Bard) unlock one level behind: level 1 at 1, level 2 at 4, level 3 at 7, level 4 at 10, level 5 at 13, level 6 at 16.

#### Spell Compendium

Spells sourced from D&D 3e SRD with tactical RPG adaptations. Each spell has: name, school, tier, MP cost, range, AoE pattern, damage/effect, and class availability.

**AoE Pattern Key**: `1` = single target, `L3`/`L6` = line N tiles, `+5` = cross 5 tiles, `◇9` = diamond 9 tiles, `○13` = circle 13 tiles, `C3`/`C5` = cone N tiles wide

**Level 0 — Cantrips (0 MP, unlimited use)**

| Spell | School | AoE | Range | Base DMG/Effect | Classes |
|-------|--------|-----|-------|----------------|---------|
| Fire Bolt | Evocation | 1 | 5 | 5 fire DMG | Wizard, Sorcerer |
| Ray of Frost | Evocation | 1 | 5 | 4 cold DMG + slow 1 turn | Wizard, Sorcerer |
| Shocking Grasp | Evocation | 1 | 1 | 6 lightning DMG, advantage vs metal armor | Wizard, Sorcerer |
| Eldritch Blast | Evocation | 1 | 6 | 5 force DMG + push 1 tile | Warlock |
| Sacred Flame | Evocation | 1 | 5 | 4 radiant DMG (Ref save, ignores cover) | Cleric |
| Chill Touch | Necromancy | 1 | 5 | 4 necrotic DMG, prevents healing 1 turn | Wizard, Warlock |
| Vicious Mockery | Enchantment | 1 | 5 | 3 psychic DMG + −2 attack rolls 1 turn | Bard |
| Minor Illusion | Illusion | 1 | 4 | Creates decoy (enemies waste 1 action) | Bard, Wizard |
| Mending | Transmutation | 1 | 1 | Repair 1 equipment durability | Wizard, Cleric |
| Guidance | Divination | 1 | 1 | +2 to target's next check/save | Cleric |
| Prestidigitation | Transmutation | 1 | 1 | Utility (light, clean, minor effect) | Wizard, Sorcerer, Bard |
| Thaumaturgy | Transmutation | 1 | 1 | Intimidate enemies (−1 attack rolls, 2 turns) | Cleric |

Cantrip damage scales: `base * (1 + floor(level / 5) * 0.5)`

**Level 1 Spells (unlock: character level 1 — 2-4 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Magic Missile | Evocation | 2 | 1×3 | 5 | 3×4 force DMG (auto-hit, split targets) | Wizard, Sorcerer |
| Burning Hands | Evocation | 3 | C3 | 1 | 12 fire DMG | Wizard, Sorcerer |
| Thunderwave | Evocation | 3 | +5 | 1 | 10 thunder DMG + push 2 tiles | Wizard, Sorcerer, Bard |
| Cure Wounds | Conjuration | 2 | 1 | 1 | Heal 12+WIS mod | Cleric, Paladin, Ranger, Bard |
| Shield of Faith | Abjuration | 2 | 1 | 3 | +3 AC for 5 turns | Cleric, Paladin |
| Bless | Enchantment | 3 | ◇9 | 3 | +2 attack rolls/saves to allies in area, 5 turns | Cleric, Paladin |
| Hex | Necromancy | 2 | 1 | 5 | +3 DMG per hit on hexed target, 5 turns | Warlock |
| Sleep | Enchantment | 3 | ◇9 | 5 | Puts lowest-HP enemies to sleep (total HP pool = 20) | Wizard, Sorcerer, Bard |
| Mage Armor | Abjuration | 2 | 1 | 1 | +4 AC for entire dungeon floor (no armor slot needed) | Wizard, Sorcerer |
| Entangle | Conjuration | 4 | ◇9 | 5 | Immobilizes enemies in area, 2 turns | Ranger |
| Faerie Fire | Divination | 3 | ◇9 | 5 | Outlines enemies (removes invisibility, +2 attack rolls vs them), 3 turns | Bard, Ranger |
| Healing Word | Conjuration | 2 | 1 | 5 | Heal 8+WIS mod (bonus action — allows attack same turn) | Cleric, Bard |
| Guiding Bolt | Evocation | 3 | 1 | 5 | 14 radiant DMG + next attack on target has advantage | Cleric |
| Inflict Wounds | Necromancy | 2 | 1 | 1 | 18 necrotic DMG (melee touch) | Cleric |
| Charm Person | Enchantment | 2 | 1 | 3 | Enemy skips 1 turn (save negates) | Bard, Sorcerer, Wizard |
| Detect Magic | Divination | 2 | ○13 | self | Reveals hidden objects, traps, magic items on grid | Wizard, Cleric, Bard |

**Level 2 Spells (unlock: character level 3 — 5-8 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Scorching Ray | Evocation | 6 | 1×3 | 5 | 3 rays × 8 fire DMG (can split targets) | Wizard, Sorcerer |
| Acid Arrow | Conjuration | 5 | 1 | 5 | 10 acid DMG + 5 acid DoT for 2 turns | Wizard |
| Web | Conjuration | 6 | ◇9 | 5 | Immobilize + difficult terrain, 3 turns (burn with fire) | Wizard |
| Spiritual Weapon | Evocation | 5 | 1 | 5 | Summon floating weapon (8 DMG/turn, 5 turns, bonus action) | Cleric |
| Hold Person | Enchantment | 6 | 1 | 5 | Paralyze humanoid 2 turns (save each turn) | Cleric, Bard, Wizard, Warlock |
| Mirror Image | Illusion | 5 | 1 | self | 3 duplicate images; each absorbs one attack | Wizard, Sorcerer |
| Misty Step | Conjuration | 5 | 1 | self | Teleport up to 5 tiles (bonus action) | Wizard, Sorcerer, Warlock |
| Lesser Restoration | Abjuration | 5 | 1 | 1 | Cure one debuff (poison, blind, paralysis) | Cleric, Paladin, Ranger, Bard |
| Shatter | Evocation | 6 | ◇9 | 5 | 18 thunder DMG + destroys fragile objects | Wizard, Sorcerer, Bard |

**Level 3 Spells (unlock: character level 5 — 10-15 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Fireball | Evocation | 12 | ◇9 | 6 | 35 fire DMG | Wizard, Sorcerer |
| Lightning Bolt | Evocation | 12 | L6 | 6 | 35 lightning DMG (line hits all in path) | Wizard, Sorcerer |
| Counterspell | Abjuration | 10 | 1 | 5 | Negate one enemy spell (reaction) | Wizard, Sorcerer, Warlock |
| Dispel Magic | Abjuration | 10 | 1 | 5 | Remove all buffs/debuffs from target | Wizard, Cleric, Bard |
| Haste | Transmutation | 12 | 1 | 3 | Double movement speed + extra action, +2 AC, 5 turns | Wizard, Sorcerer |
| Slow | Transmutation | 12 | ◇9 | 5 | Halve movement speed + lose action, −2 AC, 3 turns (Will save) | Wizard, Sorcerer |
| Spirit Guardians | Conjuration | 12 | ○13 | self | 15 radiant DMG/turn within 2 tiles, 5 turns | Cleric |
| Revivify | Conjuration | 14 | 1 | 1 | Revive KO'd ally with 1 HP (3-turn window) | Cleric, Paladin |
| Fear | Illusion | 10 | C3 | self | Enemies in cone flee 2 turns (save negates) | Bard, Wizard, Warlock |
| Animate Dead | Necromancy | 12 | 1 | 1 | Raise 1 skeleton/zombie ally from corpse (5 turns) | Wizard, Warlock |
| Hunger of Hadar | Conjuration | 14 | ○13 | 5 | Void zone: blind + 10 cold DMG/turn, 3 turns | Warlock |
| Hypnotic Pattern | Illusion | 12 | ◇9 | 5 | Charm all enemies 2 turns (save ends; damage breaks) | Bard, Wizard, Sorcerer |

**Level 4 Spells (unlock: character level 7 — 16-22 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Ice Storm | Evocation | 16 | ◇9 | 6 | 25 cold + 10 bludgeon DMG, difficult terrain 2 turns | Wizard, Sorcerer |
| Banishment | Abjuration | 18 | 1 | 5 | Remove target 3 turns (save). Permanent vs extraplanar. | Cleric, Wizard, Paladin |
| Greater Invisibility | Illusion | 16 | 1 | 1 | Invisible 5 turns (NOT broken by attack) | Bard, Wizard |
| Polymorph | Transmutation | 18 | 1 | 5 | Transform target into beast (lose abilities, gain beast HP) | Wizard, Sorcerer, Bard |
| Mass Healing Word | Conjuration | 16 | ◇9 | 5 | Heal 15 HP to all allies in area (bonus action) | Cleric, Bard |
| Fly | Transmutation | 16 | 1 | 1 | Flight (ignore terrain, +2 AC vs melee), 5 turns | Wizard, Sorcerer |
| Dimension Door | Conjuration | 16 | 1 | self | Teleport up to 10 tiles, bring 1 ally | Wizard, Sorcerer, Warlock, Bard |

**Level 5 Spells (unlock: character level 9 — 24-30 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Cone of Cold | Evocation | 25 | C5 | self | 65 cold DMG | Wizard, Sorcerer |
| Wall of Fire | Evocation | 25 | L6 | 5 | 30 fire DMG/pass, persists 5 turns | Wizard, Sorcerer |
| Cloudkill | Conjuration | 28 | ○13 | 5 | 25 poison DMG/turn, drifts 1 tile/turn, 5 turns | Wizard, Sorcerer |
| Hold Monster | Enchantment | 25 | 1 | 5 | Paralyze any creature 3 turns (save each turn) | Wizard, Sorcerer, Bard, Warlock |
| Mass Cure Wounds | Conjuration | 28 | ◇9 | 5 | Heal 30+WIS mod to all allies in area | Cleric, Bard |
| Flame Strike | Evocation | 25 | ◇9 | 8 | 30 fire + 30 radiant DMG | Cleric |
| Raise Dead | Necromancy | 30 | 1 | 1 | Revive KO'd ally at 50% HP, once per combat | Cleric |
| Telekinesis | Transmutation | 24 | 1 | 5 | Move enemy/object 4 tiles, 10 force DMG on impact | Wizard, Sorcerer |

**Level 6 Spells (unlock: character level 11 — 32-40 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Chain Lightning | Evocation | 35 | 1→chain | 6 | 45 lightning DMG, chains to 3 within 3 tiles | Wizard, Sorcerer |
| Disintegrate | Transmutation | 38 | 1 | 5 | 75 force DMG; 0 HP = destroyed (no revive) | Wizard, Sorcerer |
| Circle of Death | Necromancy | 35 | ○13 | 6 | 50 necrotic DMG to all in area | Wizard, Warlock |
| Globe of Invulnerability | Abjuration | 35 | ○13 | self | Immune to L1-L3 spells inside globe, 5 turns | Wizard |
| Blade Barrier | Evocation | 34 | L6 | 5 | Wall of blades: 40 slashing DMG/pass, 5 turns | Cleric |
| Heal | Conjuration | 36 | 1 | 5 | Heal 70 HP + cure all debuffs | Cleric |
| Sunbeam | Evocation | 36 | L6 | self | 50 radiant DMG + blind 2 turns, reusable/turn for 5 turns | Cleric |
| Mass Suggestion | Enchantment | 32 | ◇9 | 5 | Charm up to 6 enemies 3 turns (save negates) | Bard, Wizard, Sorcerer, Warlock |

**Level 7 Spells (unlock: character level 13 — 42-50 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Finger of Death | Necromancy | 45 | 1 | 5 | 85 necrotic DMG; killed target rises as zombie ally | Wizard, Warlock |
| Prismatic Spray | Evocation | 48 | C5 | self | 7 random rays (fire/acid/lightning/poison/cold/petrify/banish) | Wizard, Sorcerer |
| Reverse Gravity | Transmutation | 42 | ◇9 | 6 | Enemies fall upward, 25 fall DMG, can't move 3 turns | Wizard, Sorcerer |
| Regenerate | Transmutation | 42 | 1 | 1 | Target heals 5 HP/turn for 10 turns | Cleric |
| Forcecage | Evocation | 48 | ◇9 | 5 | Imprison targets (no escape, no attacks in/out), 5 turns | Wizard |

**Level 8 Spells (unlock: character level 15 — 52-60 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Sunburst | Evocation | 55 | ○13 | 6 | 80 radiant DMG + blind 3 turns + destroys undead below 50 HP | Cleric, Wizard, Sorcerer |
| Power Word Stun | Enchantment | 52 | 1 | 5 | Stun 5 turns if target HP < 150 (no save) | Wizard, Sorcerer |
| Earthquake | Evocation | 55 | ○13 | 8 | 40 bludgeon DMG + difficult terrain + structure collapse | Cleric, Wizard, Sorcerer |
| Dominate Monster | Enchantment | 55 | 1 | 5 | Control any enemy 5 turns (save when damaged) | Wizard, Sorcerer, Warlock |
| Holy Aura | Abjuration | 55 | ○13 | self | +5 AC, advantage on saves, fiends/undead take 20 radiant on attack, 5 turns | Cleric |
| Antimagic Field | Abjuration | 58 | ○13 | self | Suppress all magic in area (both sides), 5 turns | Wizard, Cleric |

**Level 9 Spells (unlock: character level 17 — 65-80 MP)**

| Spell | School | MP | AoE | Range | DMG/Effect | Classes |
|-------|--------|-----|-----|-------|-----------|---------|
| Meteor Swarm | Evocation | 75 | ○13×4 | 8 | 4 impacts × 40 fire DMG each (separate or overlapping) | Wizard, Sorcerer |
| Power Word Kill | Enchantment | 70 | 1 | 5 | Instant kill if target HP < 100 (no save) | Wizard, Sorcerer |
| Time Stop | Transmutation | 75 | self | self | Take 3 consecutive turns (enemies frozen, can't target directly) | Wizard, Sorcerer |
| Mass Heal | Conjuration | 70 | all allies | 5 | Heal 100 HP to every ally + cure all debuffs | Cleric |
| True Resurrection | Necromancy | 80 | 1 | 1 | Revive any KO'd ally at full HP, once per dungeon | Cleric |
| Gate | Conjuration | 75 | 1 | 3 | Summon CR 15+ outsider ally for 5 turns | Wizard, Cleric |
| Wish | Transmutation | 80 | varies | varies | Copy any L1-L7 spell at no MP, OR full party heal, OR auto-win vs non-boss | Wizard, Sorcerer |
| Foresight | Divination | 65 | 1 | 1 | Advantage on all rolls, can't be surprised, +5 AC, 10 turns | Wizard |
| Prismatic Wall | Abjuration | 70 | L8 | 5 | 7-layered wall: each layer = different damage + debuff. Blocks all movement | Wizard |
| Storm of Vengeance | Conjuration | 75 | ○13 | 8 | Multi-turn storm: escalating acid→lightning→hail→wind→cold each turn | Cleric |

#### Spell Properties

- **MP cost**: Scales with D&D spell level 0-9 as shown in compendium tables above
- **AoE patterns**: Single target (1), Line (L3/L6), Cross (+5), Diamond (◇9), Circle (○13), Cone (C3/C5)
- **AoE geometry**: Diamond = center + 4 cardinal + 4 diagonal first ring (9 tiles). Circle = diamond + 4 cardinal second ring (13 tiles). Cone = 60° arc from caster direction.
- **Range**: Measured in tiles from caster. Self = 0. Melee = 1.
- **Damage types**: Fire, Cold, Lightning, Acid, Poison, Necrotic, Radiant, Force, Psychic, Thunder, Slashing, Bludgeoning
- **Saves**: Some spells allow a save (WIS/DEX/CON check). Save DC = 8 + caster level/2 + primary stat modifier
- **Class spell lists**: Each class accesses spells from their allowed schools up to their max spell level cap (see Class Spell Access table)
- **Damage formula stacking**: `(baseDamage + casterStatMod) * terrainMagicMod * proficiencyBonus` — applied multiplicatively

#### Spell Scrolls

Scrolls are single-use consumable items that cast a spell without requiring the user to know the spell or spend MP. Scrolls contain a specific named spell (e.g., "Scroll of Fireball", not a generic tier scroll).

| Scroll Tier | Contains | Gold Value | Drop Rate | Cast Requirement |
|-------------|----------|-----------|-----------|-----------------|
| Minor | L1-L2 spell | 50 | Common (10%) | None -- any class can use |
| Lesser | L3-L4 spell | 200 | Uncommon (5%) | INT or WIS >= 10 |
| Greater | L5-L6 spell | 500 | Rare (2%) | INT or WIS >= 14 |
| Supreme | L7-L9 spell | 1500 | Epic (0.5%) | INT or WIS >= 18 |

- **Any class** can use scrolls as a combat action (replaces Attack)
- Scroll is consumed after use -- removed from inventory
- Casters can study scrolls at camp to learn them permanently (see US-CHAR-12)
- Scrolls found as loot are from a random school and tier based on dungeon depth
- Shops stock 1-3 scrolls, rotating daily

#### Cantrips

Cantrips are free spells (0 MP cost) that casters can use unlimited times per combat. They are weaker than Level 1 spells but provide a baseline magical attack.

- Cantrips are learned automatically at level 1 (2 cantrips per caster)
- Cantrip damage scales with caster level: `base * (1 + floor(level / 5) * 0.5)`
- New cantrips can be learned from trainers or tomes (not scrolls)

#### Metamagic (Sorcerer Only)

Sorcerers can modify spells using metamagic, spending extra MP for enhanced effects:

| Metamagic | Extra MP Cost | Effect |
|-----------|-------------|--------|
| **Extend** | +50% base MP | Double spell range |
| **Widen** | +100% base MP | Upgrade AoE one step (single→line, line→cross, cross→diamond, diamond→circle) |
| **Empower** | +75% base MP | Maximize one damage die (always rolls max value) |
| **Quicken** | +100% base MP | Cast as a bonus action (allows move + spell + attack in one turn) |

#### Spell Invariants

- A unit can only cast spells from schools their class allows (see Class Spell Access table)
- Casting always consumes MP (even if the spell misses or is resisted)
- AoE spells affect all units in the area (including allies -- friendly fire)
- Healing spells cannot exceed the target's max HP
- Revive spells can only target KO'd allies, not dead enemies
- Scrolls bypass class restrictions but not stat requirements
- Cantrips can always be cast (0 MP cost), even when MP is 0
- **Metamagic stacking**: A Sorcerer may apply at most **1 metamagic** per spell cast. No stacking Widen + Empower on the same Fireball.
- Metamagic can only be applied by Sorcerers; other classes ignore it
- Metamagic cannot be applied to cantrips or scrolls

##### Metamagic Balance (Damage-per-MP Analysis)

| Metamagic | Extra Cost | Effective DPM Change | When Optimal |
|-----------|-----------|---------------------|-------------|
| **Extend** | +50% MP | No direct DPM change (utility) | Buff spells with short duration; doubles efficiency of buffs |
| **Widen** | +100% MP | +50-200% total damage IF 2+ targets in new AoE | 3+ clustered enemies; wastes MP on solo targets |
| **Empower** | +75% MP | +15-40% DPM (one die maximized) | High base damage spells (Fireball: avg 21→25 = +19% for +75% cost) |
| **Quicken** | +100% MP | +100% action economy (extra action) | Always strong for alpha strikes; best when ending a fight 1 turn earlier |

Balance assessment: **Quicken is the strongest metamagic by a large margin** (effectively doubles damage output for one turn). This is intentional — Quicken is gated behind the highest MP cost (+100%) and Sorcerers have the smallest HP pool. Burning MP on Quicken leaves fewer resources for later. Empower has the worst cost-to-benefit ratio and is best reserved for finishing blows where maximizing a die matters.
- **Warlock MP recharge**: Warlock MP refills at every shrine room (unlike other classes who only recharge at shrines for full MP). This models the D&D short-rest pact magic mechanic.
- Attacks of Opportunity (AoO) cannot trigger further AoOs (no infinite chain). An AoO is a single retaliatory strike when a foe leaves a threatened square without using the Withdraw action.
- Save DC formula: `8 + floor(casterLevel / 2) + primaryStatModifier` where primaryStatModifier = `floor((stat - 10) / 2)`
- AoE spells that extend beyond the grid edge simply clip; no wrapping
- Spells cast through walls are blocked unless the spell description says "ignores cover"

#### Concentration (D&D 3.5e)

Some spells require **concentration** to maintain. A caster can concentrate on at most 1 spell at a time.

- **Concentration check**: When taking damage while concentrating, the caster must succeed on a Concentration check: `d20 + caster level + CON mod ≥ 10 + damage taken`. Failure ends the spell.
- **Casting defensively**: To cast without provoking an AoO, make a Concentration check: `d20 + caster level + CON mod ≥ 15 + spell level`. Failure wastes the action and MP but no AoO.
- **Spells requiring concentration**: Spirit Guardians, Entangle, Web, Hunger of Hadar, Cloudkill, Wall of Fire, Faerie Fire. These are marked with `(C)` in the spell tables.
- **Ending concentration**: Free action on your turn, or automatic on: failing a check, casting another concentration spell, being incapacitated, or being killed.

#### AoE Overlap Rules

- A creature in the area of multiple AoE effects from **different spells** takes damage from each separately
- A creature cannot take damage from the **same spell** more than once per round, even if overlapping AoE instances occur (e.g., two Fireballs from two different casters both hit — target takes damage from each)
- DoT AoE zones (Cloudkill, Spirit Guardians, Wall of Fire) deal damage once per round at the start of the affected creature's turn
- If a creature is in two DoT zones, it takes damage from both
- **Stacking buffs**: Bonuses of the same type (morale, sacred, insight, etc.) do not stack; only the highest applies. Bonuses of different types always stack.

#### Damage Resistance (DR) & Energy Resistance Reference

##### Damage Resistance (DR)

DR X/type means the creature reduces all physical damage by X unless the weapon is of the specified type.

| DR Type | Bypass Material | Common Creatures |
|---------|----------------|------------------|
| DR/magic | Any magic weapon (+1 or higher) | Gargoyle, Basilisk, Grick |
| DR/silver | Silver weapon (or silver-coated: 50 gp at blacksmith) | Lycanthropes (Werewolf), Bearded Devil |
| DR/cold iron | Cold iron weapon (purchasable at T3+ shops) | Fey creatures (Dryad), Demons |
| DR/good | Weapon with "holy" enchantment or Paladin's Smite | Demons, Devils |
| DR/evil | Weapon with "unholy" enchantment | Celestials (Planetar, Deva) |
| DR/bludgeoning | Bludgeoning weapon (mace, warhammer, staff) | Skeletons, Lich |
| DR/adamantine | Adamantine weapon (T5+ only) | Iron Golem, high-tier constructs |
| DR/epic | +6 or higher weapon (only from prestige loot) | Tarrasque, Mythic bosses |

- Multiple DR types are joined with "and" or "or": DR 15/cold iron **and** good means the weapon must be BOTH cold iron AND holy
- DR does not reduce energy damage (fire, cold, acid, etc.)
- DR stacks with AC (DR applies to damage that gets through AC)

##### Energy Resistance

Energy resistance X means the creature reduces damage of that energy type by X per hit.

| Energy Type | Resist 5 | Resist 10 | Resist 20 | Immunity |
|-------------|----------|-----------|-----------|----------|
| **Fire** | Tiefling racial, Ring of Minor Fire Resist | Red Dragonhide armor, Salamander Scale | Efreeti | Fire Elemental, Red Dragon |
| **Cold** | Ring of Minor Cold Resist | White Dragonhide armor | Frost Giant | Cold Elemental, White Dragon |
| **Acid** | -- | Black Dragonhide armor, Crawler Carapace | Aboleth | Black Dragon, Oozes |
| **Lightning** | -- | Blue Dragonhide armor, Stormcaller weapon | Behir | Blue Dragon, Air Elemental |
| **Sonic** | -- | Earplugs (accessory) | -- | -- |
| **Necrotic** | -- | Soulbound armor | Lich, Wraith | -- |
| **Radiant** | -- | -- | -- | Celestials |
| **Poison** | Antidote (cures, not resist) | Periapt of Proof against Poison | -- | Undead, Constructs, Elementals |

- Energy resistance reduces damage AFTER the attack hits (unlike DR which reduces physical)
- Energy immunity means 0 damage from that type
- Vulnerability means 150% damage from that type (1.5× multiplier)

#### Spell Critical Hits

- Spells that require an **attack roll** (ranged touch, melee touch) can score critical hits: threat range 20, ×2 multiplier
- Spells that require a **saving throw** cannot crit (Fireball, Lightning Bolt, etc.)
- On a spell critical hit, all variable numeric effects are doubled (damage dice, healing, etc.)
- Metamagic Empower does not affect critical hit damage (Empower applies before the crit multiplier)

#### Counterspelling (D&D 3.5e)

- A caster can ready an action to counterspell
- When an enemy casts a spell, the readied caster identifies it (Spellcraft check DC 15 + spell level)
- To counterspell: cast the same spell, or cast Dispel Magic (works against any spell, check `d20 + caster level ≥ 11 + enemy caster level`)
- Counterspelling uses your readied action and the MP for the countering spell
- Both spells are negated (the enemy's spell fails, your counter is consumed)

#### Spell Resistance (D&D 3.5e)

Some creatures have **Spell Resistance (SR)** — a numeric value that spells must overcome to affect them.

- To overcome SR: `d20 + caster level ≥ target's SR`
- SR check is made per spell (before saving throw)
- If the check fails, the spell has no effect (MP is still consumed)
- SR does not apply to beneficial spells (healing, buffs) unless the creature chooses
- SR is listed in monster stat blocks (e.g., "SR 25" for Mind Flayer)

##### Overcoming Spell Resistance

| Method | Bonus | Source |
|--------|-------|--------|
| **Spell Penetration** feat/ability | +2 caster level for SR checks | Wizard level 5 ability |
| **Greater Spell Penetration** | +4 caster level for SR checks | Archmage prestige ability |
| **Assay Spell Resistance** (L4) | Auto-overcome SR for 1 spell | Divination school spell |
| **Spells that ignore SR** | Some spells bypass SR entirely | Marked "SR: No" in spell description |
| **Touch spells** | No SR bypass, but touching requires adjacency | Melee touch range |
| **High caster level** | Each caster level = +1 to the SR check | Natural progression |

SR check formula: `d20 + caster level + SR bonuses ≥ target SR`. Example: A level 15 Wizard with Spell Penetration (+2) rolls d20+17 vs Mind Flayer SR 25 → needs an 8+ to overcome.

#### User Stories & Acceptance Criteria -- Magic

**US-MAGIC-01**: As a player, I can view my character's available spells and their MP costs.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The spell list shows only spells from the character's class-allowed schools |
| AC2 | Each spell shows: name, MP cost, range, AoE pattern, brief description |
| AC3 | Spells the character has not yet unlocked (by level) are shown but grayed out |
| AC4 | Current MP is displayed at the top of the spell list |

**US-MAGIC-02**: As a player, I can target spells with different AoE patterns shown on the grid.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Single-target spells highlight one tile under cursor |
| AC2 | Line spells highlight 3 tiles in a straight line from caster |
| AC3 | Cross spells highlight 5 tiles (center + 4 cardinal) |
| AC4 | Diamond spells highlight 9 tiles |
| AC5 | Circle spells highlight 13 tiles |
| AC6 | Invalid target positions (out of range) show no highlight |

```gherkin
Scenario: Line AoE targets 3 tiles
  Given the Wizard selects Lightning Bolt (line 3, range 5)
  When I hover over a tile within range
  Then 3 tiles in a line from the Wizard toward the cursor are highlighted
  And all units on those tiles are affected when cast
```

**US-MAGIC-03**: As a player, I can see spell effects during the combat cut-in.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each spell school has a unique visual effect (fire = flames, ice = crystals, etc.) |
| AC2 | Healing spells show green particles on the target |
| AC3 | Damage spells show element-colored numbers floating up |
| AC4 | Spell effects last 0.5-1.5 seconds before returning to the grid |

**US-MAGIC-04**: As a player, I can manage MP across encounters (MP restored at shrines and camp).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | MP does not regenerate between regular combat encounters |
| AC2 | Shrines restore MP to full |
| AC3 | Camp rest restores MP to full |
| AC4 | MP potions restore a fixed amount (scaling by potion tier) |

**US-MAGIC-05**: As a player, I unlock new spell tiers as my character levels up.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Spell level 1 unlocks at character level 1 |
| AC2 | Spell level 2 unlocks at character level 3 |
| AC3 | Spell level 3 unlocks at character level 5 |
| AC4 | Spell level 4 unlocks at character level 7 |
| AC5 | Spell level 5 unlocks at character level 9 |
| AC6 | Spell levels 6-9 unlock at character levels 11, 13, 15, 17 |
| AC7 | Half-casters (Paladin, Ranger) unlock at double the character level |
| AC8 | A notification appears when a new spell level is unlocked |

**US-MAGIC-06**: As a player, I can use spell scrolls as a combat consumable with any class.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Scrolls appear in the "Item" action menu during combat |
| AC2 | Using a scroll casts the spell without MP cost |
| AC3 | The scroll is consumed after use |
| AC4 | Stat requirements (INT/WIS) are enforced -- failing shows "Cannot use: requires INT 14" |
| AC5 | Non-casters can use scrolls (Fighter casting Fireball from a scroll) |

```gherkin
Scenario: Fighter uses a spell scroll in combat
  Given a Fighter with INT 8 has a "Minor Scroll of Cure Wounds" (Level 1, no requirement)
  When the Fighter selects Item > Scroll of Cure Wounds
  Then the spell is cast on the selected ally
  And the scroll is removed from inventory
  And no MP is deducted (Fighter has no MP pool)

Scenario: Scroll stat requirement not met
  Given a Barbarian with INT 9 has a "Greater Scroll of Fireball" (Level 3, INT >= 14)
  When the Barbarian tries to use the scroll
  Then the scroll is grayed out with "Requires INT 14"
```

**US-MAGIC-07**: As a player, my cantrips scale with level and cost no MP.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Cantrips appear in the spell list with "0 MP" cost |
| AC2 | Cantrip damage scales: base * (1 + floor(level / 5) * 0.5) |
| AC3 | Cantrips can be cast even when MP is 0 |
| AC4 | At level 10, cantrip damage is 2x the base (1 + 1.0) |

**US-MAGIC-08**: As a Sorcerer, I can apply metamagic to modify my spells.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The spell cast menu shows a "Metamagic" toggle for Sorcerers |
| AC2 | Selecting a metamagic option shows the adjusted MP cost |
| AC3 | Widened AoE upgrades the pattern visually on the grid |
| AC4 | Quickened spells allow an additional action in the same turn |
| AC5 | Metamagic is not available for non-Sorcerer classes |

```gherkin
Scenario: Sorcerer widens Fireball
  Given a Sorcerer selects Fireball (15 MP, diamond 9-tile)
  When the Sorcerer enables "Widen" metamagic (+100% = 30 MP total)
  Then the AoE pattern upgrades from diamond (9-tile) to circle (13-tile)
  And 30 MP is deducted on cast
```

**US-MAGIC-09**: As a player, I understand that AoE spells can hit my own allies (friendly fire).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | When an AoE spell pattern overlaps an ally, that ally is highlighted in yellow (warning) |
| AC2 | Confirming the cast applies damage/effects to all units in the area |
| AC3 | Healing AoE spells heal enemies in the area too (if applicable) |

---

### 5.7 Equipment & Loot

#### Weapon Categories (10)

| Weapon | Range (tiles) | Damage Die | Threat Range | Crit Mult | Primary Users |
|--------|---------------|-----------|-------------|-----------|--------------|
| Sword | 1 | 1d8 | 19-20 | ×2 | Fighter, Paladin |
| Axe | 1 | 1d12 | 20 | ×3 | Barbarian, Fighter |
| Mace | 1 | 1d8 | 20 | ×2 | Cleric, Paladin |
| Staff | 1-2 | 1d6 | 20 | ×2 | Wizard, Sorcerer |
| Bow | 3-5 | 1d8 | 20 | ×3 | Ranger |
| Crossbow | 3-6 | 1d10 | 19-20 | ×2 | Rogue, Ranger |
| Dagger | 1 | 1d4 | 19-20 | ×2 | Rogue, Bard |
| Spear | 1-2 | 1d8 | 20 | ×3 | Fighter, Barbarian |
| Warhammer | 1 | 1d10 | 20 | ×3 | Paladin, Fighter |
| Flail | 1 | 1d8 | 20 | ×2 | Cleric, Fighter |

#### Equipment Slots

- Weapon (right hand)
- Shield (left hand) -- incompatible with two-handed weapons
- Helmet
- Armor (body)
- Boots
- Accessory (ring, amulet, cloak)

#### Rarity Tiers

| Tier | Color | Affix Count | Drop Rate |
|------|-------|-------------|-----------|
| Common | White | 0 | 60% |
| Uncommon | Green | 1 | 25% |
| Rare | Blue | 2 | 10% |
| Epic | Purple | 3 | 4% |
| Legendary | Orange | 4 + set bonus | 1% |

#### Procedural Affixes

Prefix and suffix system for uncommon+ items:

- **Prefixes**: Flaming (+1d6 fire), Frozen (+1d6 cold), Vampiric (+life steal), Swift (+2 Initiative), Blessed (+healing), Brutal (+1 threat range), Arcane (+1 spell DC), Fortified (+1 AC)
- **Suffixes**: of the Bear (+2 STR), of the Fox (+2 DEX), of the Ox (+2 CON), of the Owl (+2 INT), of the Sage (+2 WIS), of Charisma (+2 CHA), of Haste (+2 Initiative), of Protection (+1 AC)

#### Set Bonuses

Legendary items can belong to named sets. Equipping multiple pieces grants stacking bonuses:

- 2-piece: Minor stat bonus
- 3-piece: Ability bonus (e.g., +1 attack range)
- 4-piece: Unique proc effect (e.g., "10% chance to cast Fireball on hit")

#### Weapon & Armor Tiers

Equipment comes in tier levels that determine base stats. Higher-tier equipment requires minimum character level and/or stats to equip.

##### Weapon Tiers

| Tier | Level Req | STR/DEX Req | Enhancement Bonus | Example Name Prefix | Shop Price (gp) |
|------|-----------|------------|-------------------|--------------------|-----------------|
| T1 (Crude) | 1 | -- | +0 (mundane) | Rusty, Worn, Crude | 20-50 |
| T2 (Standard) | 3 | 8 | +0 (masterwork: +1 attack only) | Iron, Standard, Plain | 80-150 |
| T3 (Fine) | 6 | 11 | +1 (magic) | Steel, Fine, Polished | 200-400 |
| T4 (Superior) | 10 | 14 | +2 (magic) | Mithril, Superior, Keen | 500-900 |
| T5 (Masterwork) | 15 | 17 | +3 (magic) | Adamantine, Masterwork | 1200-2000 |
| T6 (Legendary) | 18 | 20 | +5 (magic) | (Named unique weapons) | Not sold |

Final weapon attack bonus = BAB + ability mod + enhancement bonus + affix bonuses.
Final weapon damage = weapon damage die + ability mod + enhancement bonus + affix bonuses.

##### Armor Tiers

| Tier | Level Req | CON Req | Armor Bonus (AC) | Max DEX Bonus | Arcane Spell Failure | Check Penalty | Example |
|------|-----------|---------|------------------|---------------|---------------------|---------------|---------|
| T1 (Cloth) | 1 | -- | +0 | -- | 0% | 0 | Robes, Tunic |
| T2 (Leather) | 3 | 8 | +2 | +6 | 10% | 0 | Leather Armor, Studded Leather |
| T3 (Chain) | 6 | 11 | +5 | +2 | 30% | −5 | Chain Mail, Scale Mail |
| T4 (Plate) | 10 | 14 | +7 | +1 | 35% | −6 | Half Plate, Splint Mail |
| T5 (Full Plate) | 15 | 17 | +8 | +1 | 40% | −7 | Full Plate, Enchanted Plate |
| T6 (Legendary) | 18 | 20 | +10 | +2 | 25% | −4 | (Named unique armors, enchanted) |

Casters (Wizard, Sorcerer, Warlock, Bard) can equip any armor but suffer the arcane spell failure chance listed above. Spell failure is checked per arcane spell cast and wastes the MP on failure. Divine casters (Cleric, Paladin, Ranger) are not subject to arcane spell failure.

##### Shield Tiers

| Tier | Level Req | STR Req | AC Bonus | Block Chance | Example |
|------|-----------|---------|----------|-------------|---------|
| T1 (Buckler) | 1 | -- | +1 | 5% | Wooden Buckler |
| T2 (Round) | 4 | 10 | +2 | 10% | Iron Round Shield |
| T3 (Kite) | 8 | 13 | +3 | 15% | Steel Kite Shield |
| T4 (Tower) | 12 | 16 | +5 | 25% | Tower Shield (−2 attack rolls, grants cover) |

Block chance: on incoming melee attack, % chance to negate all damage. Tower shields impose −2 on attack rolls and grant cover (+4 AC vs ranged) on one side.

##### Helmet, Boots, Accessory Tiers

Helmets, boots, and accessories follow 4 tiers (T1-T4) with no stat requirements beyond level:

| Slot | T1 (Lv1) | T2 (Lv5) | T3 (Lv10) | T4 (Lv16) |
|------|-----------|-----------|-----------|-----------|
| Helmet | +1 AC | +1 AC, +1 WIS | +2 AC, +2 WIS | +3 AC, +3 WIS |
| Boots | +1 movement speed | +1 AC, +1 movement speed | +1 AC, +2 movement speed | +2 AC, +2 movement speed |
| Accessory | +1 to one stat | +2 to one stat | +3 to one stat, +1 secondary | +4 to one stat, +2 secondary |

#### Consumable Items

Consumable items are single-use and destroyed after use. They can be used in combat (as an action) or at camp.

##### Potions

| Potion | Effect | Tier | Gold Value | Use Context |
|--------|--------|------|-----------|-------------|
| Health Potion (Minor) | Restore 15 HP | T1 | 25 | Combat / Camp |
| Health Potion (Standard) | Restore 35 HP | T2 | 60 | Combat / Camp |
| Health Potion (Greater) | Restore 60 HP | T3 | 120 | Combat / Camp |
| Health Potion (Supreme) | Restore full HP | T4 | 300 | Combat / Camp |
| Mana Potion (Minor) | Restore 10 MP | T1 | 30 | Combat / Camp |
| Mana Potion (Standard) | Restore 25 MP | T2 | 70 | Combat / Camp |
| Mana Potion (Greater) | Restore 50 MP | T3 | 140 | Combat / Camp |
| Mana Potion (Supreme) | Restore full MP | T4 | 350 | Combat / Camp |
| Elixir of Strength | +3 STR for 5 turns | T2 | 80 | Combat only |
| Elixir of Speed | +3 Initiative and +2 movement speed for 5 turns | T2 | 80 | Combat only |
| Elixir of Warding | +5 AC for 5 turns | T2 | 80 | Combat only |
| Antidote | Cure poison/disease | T1 | 20 | Combat / Camp |
| Revive Tonic | Revive KO'd ally with 25% HP | T3 | 200 | Combat only |
| Phoenix Down | Revive KO'd ally with full HP | T4 | 500 | Combat only |

##### Scrolls (see also 5.6 Spell Scrolls)

Scrolls cast a specific spell. See section 5.6 for scroll tier details.

##### Other Consumables

| Item | Effect | Gold Value | Notes |
|------|--------|-----------|-------|
| Throwing Knife | Deal 8 DMG at range 3, single use | 10 | Physical damage, no class restriction |
| Bomb | Deal 15 DMG in 5-tile cross AoE, single use | 40 | Fire damage, friendly fire possible |
| Smoke Bomb | Flee from non-boss combat (100% success) | 30 | Cannot be used in boss encounters |
| Torch | Extend fog-of-war reveal radius to 3 for 20 steps | 15 | Dungeon use only |
| Lockpick | Open locked chests without DEX check (consumed) | 20 | One per chest |
| Trap Kit | Place a floor trap dealing 20 DMG to first enemy that steps on it | 50 | Rogue can craft these at camp |
| Camp Rations | Restore 50% HP/MP to party at camp (does not require inn) | 40 | Consumed on use, allows camp-heal without town |
| Proficiency Manual | Grant +20 uses toward a specific weapon proficiency | 150 | Rare loot / trainer purchase |
| Spell Tome | Teach one specific spell permanently (caster only) | 300-1000 | Rare/Epic dungeon loot |

#### Affix-to-Item-Type Mapping

Not all affixes can appear on all item types. The following table defines which affix categories are valid for each equipment slot:

| Affix Category | Weapons | Armor | Shields | Helmets | Boots | Accessories |
|----------------|---------|-------|---------|---------|-------|-------------|
| **Damage bonus** (+1d4 fire, +1d6 cold, etc.) | Yes | -- | -- | -- | -- | -- |
| **Attack bonus** (+1/+2 to hit) | Yes | -- | -- | -- | -- | Yes (rare) |
| **AC bonus** (+1/+2 AC) | -- | Yes | Yes | Yes | Yes | -- |
| **Stat bonus** (+1/+2 STR, DEX, etc.) | -- | Yes | -- | Yes | -- | Yes |
| **Resistance** (fire/cold/acid/etc. resist 5/10) | -- | Yes | Yes | -- | -- | Yes |
| **Save bonus** (+1/+2 to Fort/Ref/Will) | -- | -- | Yes | Yes | -- | Yes |
| **Speed bonus** (+1/+2 movement) | -- | -- | -- | -- | Yes | -- |
| **On-hit effect** (poison, stun, slow) | Yes | -- | -- | -- | -- | -- |
| **On-hit-received effect** (thorns, reflect) | -- | Yes | Yes | -- | -- | -- |
| **Skill bonus** (+2/+4 to Spot, Search, etc.) | -- | -- | -- | Yes | Yes | Yes |
| **HP/MP bonus** (+10/+20 max HP or MP) | -- | Yes | -- | -- | -- | Yes |
| **Regeneration** (1 HP/round, 1 MP/round) | -- | Yes | -- | -- | -- | Yes |

Affix selection during loot generation:
1. Determine item slot and rarity (which sets the affix count: Uncommon=1, Rare=2, Epic=3, Legendary=4)
2. Build the pool of valid affix categories for this slot from the table above
3. Roll one prefix and (if affix count allows) one suffix from the valid pool
4. No duplicate affixes on the same item
5. Affix tier scales with dungeon tier (T1 dungeon = weak affixes, T5 dungeon = strong affixes)
6. Legendary items always have at least one unique named affix that cannot appear on non-legendary items

##### Affix Interaction Rules

When affixes interact with enemy resistances or other game systems:

| Scenario | Resolution |
|----------|-----------|
| **+fire damage weapon vs fire-immune enemy** | Fire portion of damage deals 0; base physical damage still applies normally |
| **+fire damage weapon vs fire-resistant enemy** | Fire resistance reduces the fire bonus damage (e.g., +1d6 fire − resist 5 = max(0, roll−5) fire) |
| **Two affixes of same type on different items** | Bonuses of the same TYPE stack additively (e.g., +1d4 fire from weapon + fire resist 5 from armor are independent). Enhancement bonuses to the SAME stat do NOT stack (take highest). |
| **On-hit effect vs immune target** | Effect does not trigger (e.g., poison on-hit vs undead = no poison applied) |
| **Affix + metamagic** | Weapon affixes are NOT affected by metamagic (metamagic applies to spells only) |
| **Set bonus + affix** | Set bonuses and regular affixes stack (set bonuses are typed as "set" bonus, which is unique) |
| **Cursed affix** | Legendary items may have a negative affix (e.g., −2 CHA, vulnerability to cold). Cannot be removed. Trade-off for powerful positive affixes. |

#### Loot Generation Invariants

- Drop rate percentages always sum to 100%
- An item always has exactly its rarity's affix count (no more, no less)
- Prefixes and suffixes are never duplicated on the same item
- A Legendary item belongs to exactly one set (or none)
- Items cannot have negative final stats after affix application
- Two-handed weapons prevent equipping a shield (slot conflict)
- Affixes respect the slot-validity table above; an invalid combination is never generated

#### Item Durability

Equipment has a durability value that decreases with use. When durability reaches 0, the item is "broken" and provides no bonuses until repaired.

| Rarity | Max Durability | Repair Cost (% of item value) |
|--------|---------------|-------------------------------|
| Common | 20 | 10% |
| Uncommon | 30 | 10% |
| Rare | 50 | 15% |
| Epic | 80 | 20% |
| Legendary | 100 | 25% |

Durability loss triggers:
- **Weapons**: Lose 1 durability per combat encounter (not per swing)
- **Armor/Shield**: Lose 1 durability per combat where the wearer takes damage
- **Helmets/Boots/Accessories**: Lose 1 durability per 3 combats (more durable)

Repair options:
- **Blacksmith NPC** in town: Pay gold to fully repair (cost = % of item value per table above)
- **Mending cantrip**: Restores 1 durability per cast (free, but slow)
- **Repair Kit** consumable: Restores 10 durability (costs 50 gp, found in shops)
- **Camp rest**: Does NOT auto-repair equipment (must use a repair method)

Broken item behavior:
- A broken weapon deals 50% damage and has −4 to attack rolls
- Broken armor provides 0 AC bonus
- Broken accessories provide no stat bonuses
- Broken items are shown with a red "cracked" overlay in the inventory
- Items cannot be destroyed by durability loss — they can always be repaired

#### User Stories & Acceptance Criteria -- Equipment

**US-EQUIP-01**: As a player, I can equip items to my characters and see stats change.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Equipping a weapon updates attack bonus, damage dice, and range in the stat panel |
| AC2 | Equipping armor updates AC |
| AC3 | Stat changes are shown as green (+) or red (-) deltas |
| AC4 | The stat panel updates in real-time as I drag items |

```gherkin
Scenario: Equip a sword
  Given a Fighter with BAB +5 and no weapon
  When I equip a +2 Longsword (1d8 damage, +2 enhancement)
  Then the stat panel shows attack bonus: +7 (green +2) and damage: 1d8+2

Scenario: Two-handed weapon prevents shield
  Given a Fighter has a Shield equipped
  When I equip a Warhammer (two-handed)
  Then the Shield is unequipped and returned to inventory
  And a notification says "Shield removed: two-handed weapon equipped"
```

**US-EQUIP-02**: As a player, I can see item rarity color-coded in my inventory.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Item name text color matches rarity (White/Green/Blue/Purple/Orange) |
| AC2 | Item border or background also reflects rarity |
| AC3 | Rarity name is shown in the tooltip |

**US-EQUIP-03**: As a player, I can read affix descriptions to understand item bonuses.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Hovering an item shows a tooltip with base stats and all affixes |
| AC2 | Each affix line shows the stat bonus and a short description |
| AC3 | Set membership is shown at the bottom of the tooltip |

**US-EQUIP-04**: As a player, I can compare equipped vs new items side-by-side.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Hovering an unequipped item shows a comparison panel next to the equipped item |
| AC2 | Stat differences are shown as green (better) or red (worse) deltas |
| AC3 | The comparison considers all affixes and set bonuses |

**US-EQUIP-05**: As a player, I can collect set pieces and see set bonus progress.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Set items show "Set: [name] (X/Y)" in the tooltip |
| AC2 | Active set bonuses are listed in green, inactive in gray |
| AC3 | Equipping the Nth piece of a set immediately applies the N-piece bonus |
| AC4 | Unequipping a set piece immediately removes bonuses above the new count |

```gherkin
Scenario: Activate 2-piece set bonus
  Given a Fighter has 1 piece of the "Dragon Slayer" set equipped
  When I equip the 2nd piece
  Then the set tooltip changes from "(1/4)" to "(2/4)"
  And the 2-piece bonus (+5 STR) is applied to the character's stats

Scenario: Lose set bonus by unequipping
  Given a Fighter has 2 pieces of "Dragon Slayer" equipped (2-piece bonus active)
  When I unequip one piece
  Then the 2-piece bonus is removed
  And the set tooltip changes from "(2/4)" to "(1/4)"
```

**US-EQUIP-06**: As a player, I can buy/sell equipment at town shops.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Shop stock is determined by date seed + town location |
| AC2 | Shop shows item stats and price |
| AC3 | Buying deducts gold and adds item to inventory |
| AC4 | Selling adds 50% of item value to gold |
| AC5 | The shop cannot sell items the player cannot afford |

**US-EQUIP-07**: As a player, I can see equipped items reflected on my character's paper-doll sprite.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each equipment slot maps to a sprite layer |
| AC2 | Equipping an item immediately updates the sprite composite |
| AC3 | The same composite is used on the overworld, dungeon, and combat grid |

**US-EQUIP-08**: As a player, I can sort and filter my inventory.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Sort options: by rarity, by type, by name, by value |
| AC2 | Filter options: weapon, armor, accessory, consumable, all |
| AC3 | Active filter/sort persists until changed |

**US-EQUIP-09**: As a player, I cannot equip items that exceed my level or stat requirements.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Hovering an item with unmet requirements highlights the failed requirement in red |
| AC2 | Attempting to equip shows "Requires Level X" or "Requires STR X" |
| AC3 | The item stays in inventory but cannot be equipped |
| AC4 | Level and stat requirements are shown in the item tooltip |

```gherkin
Scenario: Cannot equip high-tier weapon
  Given a Level 4 Fighter (STR 12)
  And a T4 Superior Steel Sword (Level Req 10, STR Req 14)
  When I try to equip the sword
  Then equipping fails with "Requires Level 10, Requires STR 14"
  And the failed requirements are highlighted in red

Scenario: Meet requirements and equip
  Given a Level 10 Fighter (STR 15)
  And a T4 Superior Steel Sword (Level Req 10, STR Req 14)
  When I equip the sword
  Then it equips successfully
  And attack bonus updates to reflect T4 enhancement (+2)
```

**US-EQUIP-10**: As a player, I can use potions in combat to heal or buff my characters.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Potions appear in the "Item" action menu during combat |
| AC2 | Using a potion consumes the unit's action for the turn |
| AC3 | Health potions restore the listed HP amount (capped at max HP) |
| AC4 | Buff potions (Elixir of Strength, etc.) apply a timed effect shown as an icon |
| AC5 | The potion is removed from inventory after use |

```gherkin
Scenario: Use health potion in combat
  Given a Fighter has 10/40 HP and a Standard Health Potion (+35 HP)
  When the Fighter uses the potion
  Then HP becomes 40 (10 + 35 = 45, capped at max 40)
  And the potion is consumed
  And the Fighter's turn ends

Scenario: Buff potion duration
  Given a Ranger uses an Elixir of Speed (+3 Initiative, +2 movement speed for 5 turns)
  Then a speed buff icon appears on the Ranger
  And Initiative increases by 3 and movement speed by 2 for 5 combat turns
  After 5 turns, the buff expires and stats return to normal
```

**US-EQUIP-11**: As a player, I can use consumable items in dungeons (torches, lockpicks, bombs).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Torches extend fog-of-war reveal radius from 2 to 3 tiles for 20 steps |
| AC2 | Lockpicks auto-succeed on locked chests (consumed on use) |
| AC3 | Bombs can be thrown at objects to destroy them (barrels, weak walls) |
| AC4 | Trap Kits place a visible-to-player trap on a dungeon tile |
| AC5 | Each consumable is consumed on use |

**US-EQUIP-12**: As a player, I can use a Revive Tonic or Phoenix Down to revive a KO'd party member in combat.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Revive items can only target KO'd allies |
| AC2 | Revive Tonic restores 25% max HP; Phoenix Down restores full HP |
| AC3 | The revived ally is placed back on their last tile (if unoccupied) or nearest free tile |
| AC4 | The revived ally acts on their next turn in the turn order |

**US-EQUIP-13**: As a player, casters wearing heavy armor risk spell failure.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Spell failure chance per armor tier: Cloth 0%, Leather 10%, Chain 30%, Plate 35%, Full Plate 40%, Legendary 25% (matches Armor Tiers table in 5.7) |
| AC2 | Spell failure check: roll d100; if result ≤ armor's failure %, spell fails |
| AC3 | Shield spell failure stacks additively with armor (Buckler +5%, Heavy +15%) |
| AC4 | On failure, MP is spent but the spell has no effect |
| AC5 | A "Spell Failed!" indicator appears and the turn is consumed |
| AC6 | Non-casters are not affected by spell failure (they have no spells) |

```gherkin
Scenario: Wizard in chain mail fails spell
  Given a Wizard wearing Chain Mail (15% failure)
  When the Wizard casts Fireball
  And the PRNG roll is below 0.15
  Then 15 MP is deducted
  And "Spell Failed!" appears
  And no damage is dealt
  And the Wizard's turn ends
```

---

### 5.8 Terrain System

Each tile on the combat grid has a terrain type that provides d20-compatible modifiers.

| Terrain | Cover (AC bonus) | Attack Mod | Heal Mod | Spell DC Mod | Movement Cost | Special |
|---------|-----------------|------------|----------|-------------|--------------|---------|
| Plains | +0 | +0 | +0 | +0 | 1 | No modifiers |
| Forest | +4 (cover) | −1 | +0 | +0 | 2 | Concealment (20% miss chance for ranged) |
| Mountain | +2 (partial cover) | +1 (high ground) | +0 | −1 | 3 | Elevation counts as higher ground |
| Swamp | +0 | −2 | −2 | +1 (necromancy) | 2 | Difficult terrain, 5ft-step impossible |
| Desert | +0 | +0 | −2 | +0 | 1 | Fatiguing: CON save DC 12/hour or −2 to all rolls |
| Snow | +0 | −1 | +0 | +1 (cold spells) | 2 | Balance check DC 10 to charge/run |
| Lava | +0 | +0 | −4 | +2 (fire spells) | 3 | 2d6 fire damage/turn to standing units |
| Water (shallow) | +0 | −2 | +1 | +1 (water spells) | 3 | −2 to melee attack and damage |
| Ruins | +4 (cover) | +0 | +0 | +0 | 1 | Provides cover without movement penalty |
| Road | +0 | +0 | +0 | +0 | 0.5 | No cover; double movement when moving along roads |
| Bridge | +0 | +0 | +0 | +0 | 1 | Narrow: no flanking possible, max 1 unit wide |
| Dungeon Floor | +0 | +0 | +0 | +0 | 1 | Standard underground tile |
| Magical | +0 | +0 | +2 (all healing) | +2 (all spells) | 1 | Enchanted ground boosts all magic effects |

#### Cover System (Half / Three-Quarter / Full)

Cover provides AC bonuses and Reflex save bonuses against attacks. Cover type is determined by terrain and positioning:

| Cover Type | AC Bonus | Reflex Save Bonus | How Obtained |
|------------|----------|-------------------|-------------|
| **No Cover** | +0 | +0 | Standing in open terrain (Plains, Road, Desert, Dungeon Floor) |
| **Half Cover** | +2 AC | +1 Reflex | Behind low wall, tree trunk, rubble pile, another creature |
| **Three-Quarter Cover** | +4 AC | +2 Reflex | Behind arrow slit, heavy pillar, dense forest, Ruins terrain |
| **Full Cover** | Cannot be targeted | Cannot be targeted | Behind solid wall, closed door, massive boulder |

Cover rules:
- Cover is directional: a unit has cover relative to the attacker's position only
- Line of sight is drawn from attacker's tile center to defender's tile center; intervening walls/obstacles determine cover level
- Forest terrain grants three-quarter cover vs ranged attacks (half cover vs melee)
- Ruins terrain grants three-quarter cover (all directions)
- Mountain terrain grants half cover + high ground (+1 attack bonus)
- A creature standing behind another creature of equal or larger size has half cover
- AoE spells that do not require line of sight ignore cover for the Reflex save
- Tower shields grant half cover (+4 AC) against attacks from one direction (chosen at start of turn)

#### Terrain Invariants

- Every terrain type has exactly 6 properties (cover, attack mod, heal mod, spell DC mod, movement cost, special)
- Movement cost is always > 0 (minimum 0.5 for roads)
- Bridge tiles disable flanking checks for units standing on them
- Lava damage (2d6 fire/turn) is applied at the start of the unit's turn, before movement
- Cover bonuses to AC apply against ranged attacks and spell attacks; melee attackers adjacent to the target ignore cover unless the attacker is adjacent
- Concealment provides a flat miss chance applied after a successful attack roll
- Half cover and three-quarter cover stack with terrain cover bonuses (take the higher value, not additive)

#### User Stories & Acceptance Criteria -- Terrain

**US-TERRAIN-01**: As a player, I can see terrain type indicated visually on the combat grid.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each terrain type has a unique tile graphic |
| AC2 | Terrain is visible even with a unit standing on it |
| AC3 | Lava tiles have a subtle animation (glow pulse) |

**US-TERRAIN-02**: As a player, I can hover over a tile to see its combat modifiers.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Tooltip shows terrain name, cover bonus, movement cost, and special effects |
| AC2 | Bonuses are green, penalties are red |
| AC3 | Tooltip appears within 200ms of hovering |
| AC4 | Tooltip disappears when cursor leaves the tile |

**US-TERRAIN-03**: As a player, I can plan movement considering terrain cost.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Movement range display accounts for terrain costs |
| AC2 | A unit with base speed 6 can reach 6 Plains tiles but only 2 Mountain tiles |
| AC3 | Mixed-terrain paths correctly sum costs along the route |

```gherkin
Scenario: Terrain cost affects movement range
  Given a Human unit with base speed 6 on Plains
  And the path north is: Plains (1) → Forest (2) → Mountain (3)
  When movement range is calculated
  Then the Plains tile at distance 1 is reachable (cost 1)
  And the Forest tile at distance 2 is reachable (cost 1+2=3)
  And the Mountain tile at distance 3 is reachable (cost 1+2+3=6, exactly at limit)
```

**US-TERRAIN-04**: As a player, I can position units on favorable terrain for defensive bonuses.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A unit on Forest terrain receives +4 cover bonus to AC vs ranged attacks |
| AC2 | A unit on Mountain terrain receives +2 cover bonus to AC and +1 attack bonus (high ground) |
| AC3 | Cover and terrain modifiers are applied to the d20 attack roll and AC calculation |

**US-TERRAIN-05**: As a player, I take damage from lava tiles each turn.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A unit standing on lava at the start of their turn takes 2d6 fire damage |
| AC2 | Damage is applied before the unit can move |
| AC3 | If the damage kills the unit, their turn is skipped |
| AC4 | A floating fire damage number appears in orange |
| AC5 | Fire resistance/immunity reduces or negates lava damage (per d20 energy resistance rules) |

---

### 5.8b Vision & Light System (D&D 3e)

Light and darkness are mechanically significant in dungeons and caves. Characters without appropriate vision types face severe penalties in low-light conditions — the Underdark is pitch black by default.

#### Light Levels

| Light Level | Description | Effect on Normal Vision | Concealment |
|-------------|-------------|------------------------|-------------|
| **Bright Light** | Daylight, *light* spell, large fire | Full visibility, no penalties | None |
| **Normal Light** | Torches, lanterns, campfires (20ft radius) | Full visibility within radius | None |
| **Dim Light** | Edge of torchlight, moonlight, glowing fungi | −2 to Spot/Search, opponents have concealment | 20% miss chance |
| **Darkness** | Unlit dungeon rooms, overcast night, deep caves | Effectively blind (see Blinded) | 50% miss chance |
| **Magical Darkness** | *Darkness* spell, deeper darkness, shadow magic | Blocks normal vision AND low-light vision; darkvision works normally | 50% miss chance (even with darkvision if *deeper darkness*) |

#### Vision Types (D&D 3e)

| Vision Type | Races / Creatures | Effect |
|-------------|-------------------|--------|
| **Normal Vision** | Human, Dragonborn | Sees normally in bright/normal light. Penalties in dim light. Blind in darkness. |
| **Low-Light Vision** | Elf, Gnome | Sees twice as far in dim light as normal vision. Treats dim light as normal light. Still blind in full darkness. |
| **Darkvision 60ft** | Dwarf, Half-Orc, Tiefling | Sees in total darkness out to 60ft as if dim light (grayscale). No color. Not affected by *darkness* spells. |
| **Darkvision 120ft** | Deep- dimensional variants, Drow | As darkvision but extends to 120ft. Sees further in Underdark caves. |
| **Blindsight** | Some monsters (Hook Horror, Bat, Purple Worm) | Perceives surroundings without sight (echolocation, tremorsense). Immune to darkness/blindness penalties. |
| **Blindsense** | Some monsters | Detects presence of creatures within range but cannot see them precisely. No miss chance negation. |
| **Tremorsense** | Purple Worm, Xorn, Umber Hulk | Detects creatures touching the ground within range. Works in total darkness. |

##### Fog of War vs Vision Type Interaction

Dungeon fog of war and the vision/light system are two separate layers that combine:

| Layer | Purpose | Scope |
|-------|---------|-------|
| **Fog of War** | Exploration memory — tiles never visited are black, previously visited tiles are dimmed/grayscale | Overworld + dungeon map |
| **Vision/Light** | Combat and perception — determines what creatures can see and target in real-time | Active perception radius |

Interaction rules:
1. **Fog of war reveals tiles permanently** — once a tile is seen, it enters the "explored" state (dimmed but visible terrain). Creatures and items on explored-but-not-visible tiles are NOT shown (only terrain/walls).
2. **Vision type determines the live perception radius** — within the perception radius, all creatures, items, and terrain features are visible at full brightness. This radius depends on vision type + ambient light level.
3. **In bright/normal light**: All vision types see the same perception radius (typically 8 tiles). Fog of war is the only limiter.
4. **In dim light**: Normal vision perception radius halved (4 tiles). Low-light vision sees full radius (8 tiles). Darkvision sees full radius (grayscale beyond light sources).
5. **In darkness**: Normal vision perception radius = 0 (blind, only fog of war memory). Low-light vision = 0 (blind). Darkvision = 12 tiles (60ft) or 24 tiles (120ft) in grayscale.
6. **Fog of war updates based on the party member with the BEST vision type** — if any party member can see a tile (through darkvision, tremorsense, etc.), it's revealed for the whole party.
7. **Line of sight blocks fog reveal** — walls and closed doors block fog of war revelation even within perception radius. Opening a door instantly reveals the room.

| Scenario | Normal Vision | Low-Light Vision | Darkvision 60ft |
|----------|--------------|-----------------|-----------------|
| Bright dungeon room | Full vision 8 tiles | Full vision 8 tiles | Full vision 8 tiles |
| Dim corridor (torchlight edge) | 4 tiles, −2 Spot | 8 tiles, no penalty | 8 tiles, no penalty |
| Dark room (no light) | Blind (0 tiles) | Blind (0 tiles) | 12 tiles (grayscale) |
| Dark room + party torch | 8 tiles (within light) | 8 tiles + dim edge | 12 tiles (beyond torch: grayscale) |

#### Blinded Condition

A creature that cannot see (in darkness without darkvision, or under the *blindness* spell):

| Penalty | Effect |
|---------|--------|
| −2 to AC | Cannot see incoming attacks |
| −2 to attack rolls | Swinging blind |
| 50% miss chance | Even on a "hit" roll, 50% chance the attack misses |
| Speed halved | Moving cautiously |
| −4 to Search, Spot | Cannot see to find things |
| Opponents gain +2 attack | Attacking a target that can't defend properly |
| Cannot make Attacks of Opportunity | Cannot see threats to react |
| All opponents effectively have total concealment | Cannot target deliberately |

#### Light Sources

| Source | Radius (bright) | Radius (dim) | Duration | Notes |
|--------|-----------------|-------------|----------|-------|
| Torch | 20ft (4 tiles) | 40ft (8 tiles) | 1 hour (60 turns) | Free hand to hold. Can be dropped (stays lit) |
| Lantern | 30ft (6 tiles) | 60ft (12 tiles) | 6 hours | Belt slot item. Better radius than torch. |
| Cantrip: *Light* | 20ft (4 tiles) | 40ft (8 tiles) | 10 min/level | Cast on any object. Free action to maintain. |
| Spell: *Daylight* (L3) | 60ft (12 tiles) | 120ft (24 tiles) | 10 min/level | Counters *darkness*. Bright as sunlight. |
| Spell: *Continual Flame* (L2) | 20ft (4 tiles) | 40ft (8 tiles) | Permanent | Costs 50 gold component. Permanent until dispelled. |
| Sunrod (consumable) | 30ft (6 tiles) | 60ft (12 tiles) | 6 hours | Inventory item. Alchemical. |
| Glowing Fungi (natural) | 5ft (1 tile) | 10ft (2 tiles) | Permanent | Found naturally in Underdark. Dim light only. |

##### Light Source Stacking Rules

When multiple light sources overlap, the following rules apply:

1. **Bright radii overlap**: The tile uses the **highest** light level from any source (no additive stacking). Two torches next to each other do NOT create "super bright" light.
2. **Dim radii overlap**: If one source's bright radius covers a tile that is in another source's dim radius, the tile is bright (highest wins).
3. **Darkness spells**: *Darkness* suppresses non-magical light sources within its area. A torch inside a *darkness* spell provides no light. *Daylight* (L3+) counters *darkness* (they cancel each other).
4. **Multiple *darkness* spells**: Do not stack. *Deeper darkness* supersedes regular *darkness*.
5. **Carried vs dropped**: A carried light source moves with the character. A dropped torch remains on the tile and continues to illuminate. A *light* cantrip cast on a weapon moves with the wielder.
6. **Light source limit per character**: A character can benefit from only one carried light source at a time (the best one). They cannot stack a torch + lantern for more radius.
7. **Party visibility**: All party members share the combined light from all active sources — if the Fighter holds a torch and the Wizard casts *light*, the combined illumination covers the union of both radii (not additive radius, but additive area coverage).

```
function getTileLightLevel(tile, lightSources) {
  let best = 'darkness'; // default dungeon light level
  for (const source of lightSources) {
    const dist = manhattanDistance(tile, source.position);
    if (dist <= source.brightRadius)
      best = max(best, 'bright');
    else if (dist <= source.dimRadius)
      best = max(best, 'dim');
  }
  // Darkness spells override
  for (const spell of activeDarknessSpells) {
    if (manhattanDistance(tile, spell.center) <= spell.radius) {
      if (spell.level >= 3) // deeper darkness
        return 'magical-darkness';
      if (best !== 'bright' || !anyMagicalLightCovers(tile))
        best = 'darkness';
    }
  }
  return best;
}
```

#### Light in Dungeons

| Dungeon Type | Default Light Level | Notes |
|-------------|--------------------|-|
| Surface dungeon | Dim Light | Torch sconces on walls every ~5 tiles |
| Deep dungeon (floor 3+) | Darkness | Must bring light sources or have darkvision |
| Underdark | Total Darkness | No natural light. Glowing fungi patches every ~20 tiles |
| Shadowfell dungeons | Magical Darkness | Even darkvision only provides dim light |
| Feywild dungeons | Bright Light | Fey luminescence; no vision penalties |
| Nine Hells | Dim Light | Fire-lit; flickering torches on walls |
| The Abyss | Darkness | Chaotic; random patches of dim light from portals |
| Elemental Fire | Bright Light | Lava illuminates everything |
| Elemental Water | Dim Light | Bioluminescence; murky beyond 6 tiles |
| Elemental Earth | Total Darkness | Must bring own light |
| Elemental Air | Bright Light | Open sky; lightning provides flashes in storm areas |
| Astral Plane | Normal Light | Ambient silvery glow; no light sources needed |
| Far Realm | Magical Darkness (flickering) | Light sources flicker unreliably (50% chance to dim for 1 round) |

#### Combat Interaction

- **Concealment from darkness**: Targets in dim light or darkness gain concealment (20% or 50% miss chance). Attacker must succeed on a d100 roll after hitting to confirm the attack isn't spoiled by concealment.
- **Sneak attack**: Rogues can sneak attack targets that are denied DEX bonus (which includes targets who can't see the Rogue due to darkness).
- **Ambush enemies**: Creatures with the Ambush AI pattern are more effective in darkness (+4 to Hide checks).
- **Undead**: Most undead have darkvision 60ft. Skeletons, zombies, and wraiths fight without penalty in total darkness.
- **Light sensitivity**: Some creatures (Shadow, Darkmantle, Deep- variants) suffer −1 to attack in bright light.

#### Fog of War (Exploration)

During dungeon exploration (non-combat), vision determines the fog of war reveal radius:

```
normalVision:    reveal radius = equipped light source radius (0 if no light in darkness)
lowLightVision:  reveal radius = light source radius × 2
darkvision60:    reveal radius = max(light source radius, 12 tiles) — grayscale beyond light
darkvision120:   reveal radius = max(light source radius, 24 tiles)
blindsight:      reveal radius = blindsight range (typically 60ft / 12 tiles)
```

Explored but currently dark tiles are shown as dimmed (like fog of war in RTS games) — the map layout is visible but enemy positions are not updated until re-illuminated.

#### User Stories & Acceptance Criteria -- Vision & Light

**US-LIGHT-01**: As a player, I can see a light radius around my party in dark dungeons.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The light radius is drawn around the party based on the strongest light source |
| AC2 | Tiles outside the light radius are darkened (fog of war) |
| AC3 | Tiles in dim light are rendered at 50% brightness |
| AC4 | Tiles in bright light are rendered normally |
| AC5 | Moving the party updates the light radius in real time |

**US-LIGHT-02**: As a player, I can equip torches or lanterns to see in dark dungeons.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Equipping a torch expands the light radius to 4 tiles (bright) + 8 tiles (dim) |
| AC2 | Torches have a visible countdown (60 turns / 1 hour) displayed as a small circular timer icon next to the party HP bar in the HUD. The icon fills counter-clockwise in orange. At 10 turns remaining, the icon pulses red. At 0, the torch icon disappears. |
| AC3 | When the torch expires, the party is plunged into darkness (if no other light). A toast notification says "Your torch has burned out!" |
| AC4 | Lanterns last 6 hours and provide a larger radius |
| AC5 | Casters can use the *Light* cantrip for free illumination |

**US-LIGHT-03**: As a player, I suffer combat penalties when fighting in darkness without darkvision.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Attacking in darkness applies a 50% miss chance (d100 roll shown) |
| AC2 | Characters with darkvision do not suffer miss chance from darkness |
| AC3 | Characters with low-light vision suffer no penalty in dim light (but full penalty in darkness) |
| AC4 | A "Blinded" icon appears above affected units during combat |
| AC5 | The combat log shows "Miss (darkness)" when concealment causes a miss |

```gherkin
Scenario: Darkvision in the Underdark
  Given a Dwarf (darkvision 60ft) and a Human (normal vision) enter an Underdark dungeon
  And no light sources are equipped
  When combat begins in total darkness
  Then the Dwarf fights normally (no miss chance, no attack penalty)
  And the Human is effectively blind (50% miss chance, −2 Atk, −2 AC)
  And the Human's Spot/Search checks take −4

Scenario: Torch illumination during combat
  Given the party has a torch equipped (4 tiles bright, 8 tiles dim)
  And combat begins in a dark dungeon room
  Then enemies within 4 tiles of the torch-bearer are in bright light (no concealment)
  And enemies 5-8 tiles away are in dim light (20% miss chance for ranged)
  And enemies beyond 8 tiles are in darkness (50% miss chance, or darkvision applies)

Scenario: Light-sensitive creature
  Given a Shadow (light sensitivity) is in an area of bright light
  When the Shadow attacks
  Then it suffers −1 to attack rolls from light sensitivity
  And a "Light Sensitivity" debuff icon appears above the Shadow
```

**US-LIGHT-04**: As a player, Underdark dungeons are more challenging due to total darkness.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Underdark dungeon floors start in total darkness |
| AC2 | Glowing fungi patches appear every ~20 tiles (1 tile dim light radius) |
| AC3 | Parties without darkvision members or light sources have zero visibility |
| AC4 | Deep- variant enemies gain +10 Hide in darkness (harder to spot before combat) |
| AC5 | *Daylight* spell reveals the entire room (12 tiles bright) and disrupts light-sensitive enemies |

---

### 5.8c Map, Camera & Input System

The game uses a scrollable, zoomable viewport with a fog-of-war minimap. All interaction is mouse-driven (tablet-compatible). Keyboard shortcuts exist as accelerators but are never required.

#### Camera & Viewport

| Property | Value |
|----------|-------|
| **Base resolution** | 940×660 internal canvas |
| **Default zoom** | 1.0× (32px per tile → ~29×20 visible tiles) |
| **Zoom range** | 0.25× (zoomed out, 4× area visible) to 2.0× (zoomed in, close-up detail) |
| **Zoom step** | 0.1× per mouse wheel notch, smooth interpolation over 150ms |
| **Pan method** | Hold right mouse button + drag to pan freely |
| **Pan speed** | 1:1 with mouse delta at current zoom level |
| **Camera follow** | Camera auto-centers on party with smooth lerp (speed 0.1/frame); panning breaks follow until party moves |
| **Re-center** | Click party portrait or press [Space] to snap camera back to party |
| **Zoom target** | Zoom toward mouse cursor position (not screen center) |

```
// Camera state
camera = {
  x: 0, y: 0,           // world position (top-left of viewport in tile coords)
  zoom: 1.0,             // current zoom level
  targetX: 0, targetY: 0,// lerp target (party position)
  following: true,        // auto-follow party; false when user pans
  panStartX: 0, panStartY: 0  // right-click drag origin
}

// Zoom toward cursor
onWheel(event) {
  oldZoom = camera.zoom
  camera.zoom = clamp(camera.zoom + event.deltaY * -0.001, 0.25, 2.0)
  // Adjust camera position so the world point under cursor stays fixed
  worldX = camera.x + event.offsetX / (tileSize * oldZoom)
  worldY = camera.y + event.offsetY / (tileSize * oldZoom)
  camera.x = worldX - event.offsetX / (tileSize * camera.zoom)
  camera.y = worldY - event.offsetY / (tileSize * camera.zoom)
}

// Pan with right-click drag
onPointerDown(event) {
  if (event.button === 2) {
    camera.following = false
    camera.panStartX = event.clientX
    camera.panStartY = event.clientY
  }
}

onPointerMove(event) {
  if (rightButtonHeld) {
    dx = (event.clientX - camera.panStartX) / (tileSize * camera.zoom)
    dy = (event.clientY - camera.panStartY) / (tileSize * camera.zoom)
    camera.x -= dx
    camera.y -= dy
    camera.panStartX = event.clientX
    camera.panStartY = event.clientY
  }
}
```

#### Level-of-Detail (LOD) Rendering

| Zoom Level | Tile Rendering | Mob Rendering | UI Elements |
|-----------|----------------|---------------|-------------|
| 2.0×–1.0× | Full 32×32 sprites, animations | Full sprites with paper-doll layers | Full HP bars, names |
| 1.0×–0.5× | Full tiles, reduced animation frames | Simplified sprites (no paper-doll, solid silhouette) | HP bars only, no names |
| 0.5×–0.25× | Tile color blocks (biome color) | Colored dots (green=party, red=enemy, blue=NPC) | No HP bars, no names |

#### Map System

The game provides both a **corner minimap** (always visible) and a **full-screen map** (toggled with [M] or map icon click).

##### Minimap (Corner HUD)

| Property | Value |
|----------|-------|
| **Position** | Bottom-right corner of the canvas |
| **Size** | 160×120 pixels (fixed, not affected by zoom) |
| **Tile size** | 1 pixel per tile |
| **Content** | Explored terrain as biome-colored pixels, unexplored as black |
| **Party indicator** | White blinking dot |
| **Enemy indicators** | Red dots (only for mobs within perception radius) |
| **Town indicators** | Gold squares |
| **Dungeon indicators** | Skull icons (tiny) |
| **Portal indicators** | Purple diamonds |
| **Click behavior** | Clicking on minimap pans camera to that world position |
| **Visibility** | Togglable via settings; auto-hides during combat cut-ins |

##### Full-Screen Map [M]

| Property | Value |
|----------|-------|
| **Toggle** | Click map icon in HUD or press [M] |
| **Size** | Fills entire 940×660 canvas |
| **Tile size** | 2 pixels per tile (covers ~470×330 tile area) |
| **Zoom** | Mouse wheel zooms the map view independently (1px to 4px per tile) |
| **Pan** | Right-click drag pans, same as main viewport |
| **Layers (toggleable)** | Terrain, Roads, Towns, Dungeons, POIs, Party position, Mob positions |
| **Legend** | Right-side panel with color/icon legend |
| **Waypoint** | Left-click to place a waypoint (shown as marker on overworld) |
| **Close** | [M] again, [Escape], or click X button |

##### Dungeon Map

| Property | Value |
|----------|-------|
| **Auto-mapped** | Rooms and corridors are revealed as explored |
| **Floor tabs** | Tabs along the top for each visited floor (Floor 1, Floor 2, ...) |
| **Current floor** | Highlighted tab, party position blinking |
| **Room contents** | Explored rooms show: empty (gray), treasure (gold), trap (red), shrine (blue), boss (skull), stairs (arrow) |
| **Unexplored** | Black/hidden — no layout information leaked |
| **Fog of war** | Previously explored but not currently visible rooms shown dimmed (layout visible, enemy positions NOT updated) |

#### Fog of War

Three visibility states for every tile:

| State | Visual | Information Available |
|-------|--------|---------------------|
| **Unexplored** | Solid black | Nothing — tile has never been seen |
| **Explored (not visible)** | Dimmed terrain (50% opacity, grayscale) | Terrain layout, static structures, roads. NO enemy positions (stale data). |
| **Visible (in sight)** | Full color, full detail | Everything — terrain, enemies, items, traps, NPCs, light sources |

```
tileVisibility(tile) {
  if (tile.neverSeen)
    return UNEXPLORED    // solid black
  if (distanceTo(party, tile) > perceptionRadius)
    return EXPLORED       // dimmed, grayscale, no live entity data
  if (!hasLineOfSight(party, tile))
    return EXPLORED       // walls block LOS even within range
  return VISIBLE          // full render
}
```

- **Line of sight**: Bresenham line from party to tile; blocked by walls, closed doors, and opaque terrain
- **Perception radius**: Determined by vision type + light source (see 5.8b)
- **Minimap updates**: Minimap shows explored tiles permanently; visible tiles blink entities in real-time
- **Combat grid**: Fog of war also applies during tactical combat — enemies in darkness/beyond perception are hidden on the grid

#### Input Mapping

All interactions are mouse-driven. Keyboard shortcuts are accelerators, never the only path.

| Input | Context | Action |
|-------|---------|--------|
| **Left click** | Overworld tile | Move party to adjacent tile |
| **Left click** | Combat grid (own unit) | Select unit, show movement range |
| **Left click** | Combat grid (enemy) | Attack / target with spell |
| **Left click** | UI button | Activate button |
| **Left click** | Minimap | Pan camera to clicked world position |
| **Right click hold + drag** | Any | Pan camera freely |
| **Right click** | Combat (after move) | Undo movement (before action) |
| **Right click** | Item / spell | Show context tooltip (info, compare) |
| **Mouse wheel up** | Any | Zoom in |
| **Mouse wheel down** | Any | Zoom out |
| **Mouse hover** | Any entity/tile | Show tooltip (200ms delay) |
| **[M]** | Overworld / Dungeon | Toggle full-screen map |
| **[Space]** | Any | Re-center camera on party |
| **[Escape]** | Any overlay | Close overlay / cancel action |
| **[I]** | Overworld / Camp | Open inventory |
| **[C]** | Any | Open character sheet |
| **[Tab]** | Combat | Cycle to next unit in turn order |

**Touch / tablet mapping**:

| Touch Input | Maps To |
|-------------|---------|
| Tap | Left click |
| Long press (500ms) | Right click (context menu / tooltip) |
| Two-finger drag | Pan camera (same as right-click drag) |
| Pinch in/out | Zoom in/out (same as mouse wheel) |
| Double tap | Re-center camera on party |

#### User Stories & Acceptance Criteria — Map & Camera

**US-MAP-01**: As a player, I can see a minimap in the corner showing explored terrain.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Minimap is visible in the bottom-right corner during overworld and dungeon exploration |
| AC2 | Explored tiles appear as colored pixels matching the biome |
| AC3 | Unexplored tiles are black |
| AC4 | Party position is shown as a blinking white dot |
| AC5 | Clicking on the minimap pans the main camera to that location |

**US-MAP-02**: As a player, I can open a full-screen map with [M] to see the world I've explored.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Pressing [M] or clicking the map icon opens a full-screen map overlay |
| AC2 | The map shows all explored terrain at 2px/tile scale |
| AC3 | Towns, dungeons, and POIs are marked with distinct icons |
| AC4 | I can zoom and pan the map independently of the main viewport |
| AC5 | Left-clicking places a waypoint visible on the overworld |
| AC6 | Pressing [M] again or [Escape] closes the map |

**US-MAP-03**: As a player, I can pan the camera by holding right-click and dragging.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Holding right mouse button and moving pans the viewport |
| AC2 | Pan is 1:1 with mouse movement at the current zoom level |
| AC3 | Panning disengages auto-follow (camera stops tracking party) |
| AC4 | Moving the party or pressing [Space] re-engages auto-follow |

**US-MAP-04**: As a player, I can zoom in and out using the mouse wheel.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Scrolling mouse wheel up zooms in (tiles appear larger) |
| AC2 | Scrolling mouse wheel down zooms out (more tiles visible) |
| AC3 | Zoom range is 0.25× to 2.0× |
| AC4 | Zoom targets the cursor position (not screen center) |
| AC5 | At low zoom levels, sprites simplify to colored dots (LOD) |
| AC6 | At very low zoom (0.25×), the view resembles the full-screen map |

```gherkin
Scenario: Pan camera with right-click drag
  Given the party is at tile (50, 50) and the camera is centered on it
  When I hold right-click and drag 100 pixels to the right
  Then the camera pans ~3 tiles to the left (revealing terrain east of party)
  And the camera stops auto-following the party
  When I press [Space]
  Then the camera smoothly pans back to center on the party

Scenario: Zoom toward cursor
  Given the camera is at zoom 1.0× and my cursor is over tile (55, 55)
  When I scroll the mouse wheel up 3 notches
  Then zoom increases to 1.3×
  And tile (55, 55) remains under my cursor (zoom pivots on cursor)

Scenario: Fog of war on minimap
  Given the party has explored tiles (0,0) through (30,30)
  And the party is now at (25, 25) with perception radius 12 tiles
  When I look at the minimap
  Then tiles (0,0)-(30,30) appear as biome-colored pixels
  And tiles beyond (30,30) are black
  And enemy dots only appear within 12 tiles of (25,25)

Scenario: Full-screen map with dungeon floors
  Given the party is on floor 3 of a dungeon having explored floors 1-3
  When I press [M]
  Then the full-screen map opens showing floor 3
  And tabs for "Floor 1", "Floor 2", "Floor 3" appear at the top
  And clicking "Floor 1" shows the explored layout of floor 1
  And rooms marked as treasure/trap/shrine/boss have distinct icons
```

**US-MAP-05**: As a player, I see fog of war that reveals terrain as I explore.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Tiles never seen are completely black (no terrain, no entities) |
| AC2 | Tiles previously seen but outside perception are dimmed and grayscale |
| AC3 | Tiles within perception radius are fully rendered with live entity data |
| AC4 | Walls and closed doors block line of sight even within perception radius |
| AC5 | Opening a door reveals the room behind it in real-time |

---

### 5.9 Enemy System

Massive bestiary inspired by the **D&D 3rd Edition Monster Manual** with 120+ enemy types using standard **D&D Challenge Rating (CR)** across 12 dimensions with pack/solo spawn behavior. CR directly maps to D&D 3e encounter balance — a CR N creature is a fair challenge for a party of 4 at level N. The goal is **endless variety** — no two encounters should feel identical.

#### Spawn Behavior

Every monster has a **spawn type** that determines how many appear in an encounter:

| Spawn Type | Count | Description |
|-----------|-------|-------------|
| **Swarm** | 5-8 | Weak individually, dangerous in numbers. Block movement, overwhelm positioning. |
| **Pack** | 3-5 | Coordinated group tactics. Flanking bonuses, morale breaks if leader dies. |
| **Patrol** | 2-3 | Small scouting group. Alert nearby rooms if one escapes. |
| **Pair** | 2 | Bonded duo. One tanks, one supports. Enrage if partner dies. |
| **Solo** | 1 | Powerful individual. High stats, multiple actions per turn, immune to flanking. |
| **Solo + Minions** | 1 + 3-6 | Boss-type with expendable adds. Minions respawn on cooldown. |

##### Morale System

Pack and Swarm enemies have morale that can break, causing them to flee:

| Trigger | Morale Check DC | Effect on Failure |
|---------|----------------|-------------------|
| Leader/alpha killed | DC 10 Will save | Remaining enemies flee (move toward nearest exit) |
| 50%+ of group killed | DC 12 Will save | Survivors flee |
| Hit by fear spell/ability | Spell DC | Affected creatures flee for spell duration |
| Boss enters phase 4 (25% HP) | -- | Minions gain +2 morale (fanaticism, never flee) |
| Party member uses Intimidate | DC = 10 + CHA mod + ½ level | Targets within 3 tiles flee for 2 rounds |

Fleeing behavior:
- Fleeing enemies move at double speed toward the nearest room exit
- Fleeing enemies do not attack and do not provoke attacks of opportunity
- A fleeing enemy that reaches an exit despawns (removed from combat)
- Fleeing enemies can be attacked normally (they are still valid targets)
- If all exits are blocked, fleeing enemies cower instead (−2 AC, no attacks, Will save DC 10 each round to recover)

##### Respawn Rules

Enemies do NOT respawn within a single dungeon run — cleared rooms stay cleared. However:

| Context | Respawn Rule |
|---------|-------------|
| **Cleared room (same run)** | No respawn. Room remains empty for the rest of this dungeon visit. |
| **Cleared dungeon (re-enter)** | Full respawn. Dungeon layout persists (monthly seed) but all enemies and loot reset. |
| **Overworld encounters** | Respawn after leaving the chunk and returning (chunk unloaded → reloaded from seed). |
| **Boss rooms** | Never respawn within the same weekly rotation. Defeating the weekly boss marks it as "cleared" until the next weekly reset. |
| **Solo + Minions (mid-combat)** | Minions respawn on a cooldown (typically 3-5 rounds) as long as the boss is alive. Killing the boss stops all minion respawns. |
| **Patrol that escaped** | An escaped patrol enemy alerts adjacent rooms, adding +1-2 enemies to those rooms' encounter tables (reinforcement, not respawn). |

#### D&D 3e Challenge Rating (CR) XP Table

Standard D&D 3e XP awards per CR. XP is divided equally among surviving party members.

| CR | XP Award | Typical Party Level | Encounter Difficulty |
|----|----------|--------------------|--------------------|
| ¼ | 75 | 1 | Trivial |
| ½ | 150 | 1 | Easy |
| 1 | 300 | 1 | Standard |
| 2 | 600 | 2 | Standard |
| 3 | 900 | 3 | Standard |
| 4 | 1,200 | 4 | Standard |
| 5 | 1,500 | 5 | Standard |
| 6 | 1,800 | 6 | Standard |
| 7 | 2,100 | 7 | Standard |
| 8 | 2,400 | 8 | Standard |
| 9 | 2,700 | 9 | Standard |
| 10 | 3,000 | 10 | Standard |
| 11 | 3,300 | 11 | Standard |
| 12 | 3,600 | 12 | Standard |
| 13 | 3,900 | 13 | Standard |
| 14 | 4,200 | 14 | Standard |
| 15 | 4,500 | 15 | Standard |
| 16 | 4,800 | 16 | Standard |
| 17 | 5,100 | 17 | Standard |
| 18 | 5,400 | 18 | Standard |
| 19 | 5,700 | 19 | Standard |
| 20 | 6,000 | 20 | Standard |

For CR > 20 (epic): `xp = 6000 + (CR - 20) × 300`

**Encounter balance**: A CR N encounter is appropriate for a party of 4 at level N. Higher CR encounters are harder; an encounter 4+ CR above party level is potentially lethal. Dungeon floor progression naturally escalates CR (see Scaling section).

#### Enemy Special Ability DCs, Durations & Triggers

Every enemy special ability listed in the stat blocks follows standardized rules:

##### DC Formula

```
abilityDC = 10 + floor(CR / 2) + relevantAbilityMod
```

| CR Range | Base DC | Typical Save DC Range |
|----------|---------|----------------------|
| ¼–1 | 10 | 10-13 |
| 2–4 | 11-12 | 12-15 |
| 5–8 | 12-14 | 14-18 |
| 9–12 | 14-16 | 17-21 |
| 13–16 | 16-18 | 20-24 |
| 17–20 | 18-20 | 22-26 |
| 21+ | 20+ | 25-30 |

##### Save Types

| Ability Category | Save Type | Examples |
|-----------------|-----------|---------|
| Poison, disease, death effects | **Fortitude** | Giant Rat disease bite, Zombie undead fortitude, Basilisk petrify |
| Gaze, breath weapon, AoE | **Reflex** | Dragon breath, Beholder eye rays, Fireball traps |
| Fear, charm, mind control, illusion | **Will** | Harpy song, Mind Flayer mind blast, Vampire dominate |

##### Duration Categories

| Duration | Meaning | Typical Abilities |
|----------|---------|-------------------|
| **Instant** | One-time effect, no lingering | Damage, knockback, teleport |
| **1 round** | Lasts until end of target's next turn | Stun, daze, entangle (short) |
| **1d4 rounds** | Random short duration (1-4 rounds) | Blind, slow, confusion |
| **Concentration** | Lasts while caster maintains (no other actions) | Hold person, dominate, web |
| **1 minute (10 rounds)** | Extended combat duration | Fear, haste, bless |
| **Until save** | Target repeats save each round to end | Paralysis, petrification (partial), charm |
| **Permanent** | Lasts until dispelled or cured | Petrification (full), energy drain levels, curse |

##### Trigger Types

| Trigger | When It Fires | Cooldown |
|---------|--------------|----------|
| **On hit** | After a successful melee/ranged attack lands | Every hit (no cooldown) |
| **On crit** | Only on natural 20 / critical hit | Every crit |
| **Passive aura** | Continuously active while creature is alive | Always on, no cooldown |
| **Activated (standard)** | Used as the creature's action for the turn | 2-3 round cooldown |
| **Activated (recharge)** | Roll d6 at start of turn; on 5-6 the ability recharges | Variable (avg 3 rounds) |
| **Reaction** | Triggered by specific event (being hit, ally dying, etc.) | 1/round |
| **1/day** | Usable once per combat encounter | Once per encounter |
| **Death trigger** | Fires when the creature reaches 0 HP | Once (on death) |

All stat block entries with "DC" use the formula above unless a specific DC is listed. Entries with duration follow the categories above.

#### Visual Uniqueness System

No two packs should look identical. Each spawned group applies **visual modifiers** seeded by `hash(chunkSeed, encounterId)`:

| Modifier | Application | Examples |
|----------|------------|---------|
| **Palette swap** | Hue-shift the base sprite ±30° | Green goblins, brown goblins, gray goblins |
| **Size variation** | Scale each individual ±10-15% | Runts vs brutes in the same pack |
| **Equipment variation** | Swap weapon/armor sprite layer | Goblin with sword vs goblin with spear vs goblin with club |
| **Markings** | Overlay scars, war paint, tattoos | Skull face paint, claw scars, tribal markings |
| **Accessories** | Add hats, capes, shields, pouches | Helmeted skeleton vs bare skeleton |
| **Elemental tint** | Color overlay for dimensional variants | Blue-tinted frost skeleton, red-tinted fire skeleton |

```
visualSeed = hash(chunkSeed, encounterId, monsterIndex)
paletteHue = (visualSeed % 60) - 30                    // ±30° hue shift
scaleFactor = 0.85 + (visualSeed % 30) / 100           // 0.85x to 1.15x
equipVariant = visualSeed % monster.equipmentVariants   // weapon/armor swap
markingId = visualSeed % monster.markingCount            // scar/paint overlay
```

#### CR ¼–1 — Common Encounters

XP per D&D 3e CR table: CR ¼ = 75 XP, CR ½ = 150 XP, CR 1 = 300 XP | Gold: 2-10

| Enemy | CR | HP | AC | Atk | Init | AI | Spawn | Gold | Special | Home Dimension |
|-------|-----|-----|-----|------|------|-----|-------|------|---------|---------------|
| Goblin | ⅓ | 5 (1d8+1) | 15 | +1 melee (1d6−1) | +1 | Aggressive | Pack (3-5) | 3 | Pack tactics (+2 Atk near ally) | Material |
| Kobold | ¼ | 4 (1d8) | 15 | +1 melee (1d6−1) | +1 | Ambush | Swarm (5-8) | 2 | Trap-setting, flee at low HP | Material |
| Skeleton | ⅓ | 6 (1d12) | 13 | +1 melee (1d6+1) | +5 | Aggressive | Pack (3-5) | 5 | Immune to poison, cold; DR 5/bludgeoning | Material, Shadowfell |
| Zombie | ½ | 16 (2d12+3) | 11 | +2 melee (1d6+1) | −1 | Aggressive | Swarm (5-8) | 3 | Undead fortitude (Fort DC 5 + dmg to survive lethal) | Material, Shadowfell |
| Giant Rat | ¼ | 4 (½d8+1) | 14 | +4 melee (1d4−1) | +3 | Aggressive | Swarm (5-8) | 2 | Disease bite (Fort DC 12 or DOT 1d3/day) | Material, Underdark |
| Wolf | 1 | 13 (2d8+4) | 14 | +3 melee (1d6+1) | +2 | Aggressive | Pack (3-5) | 0 | Trip (free trip on bite hit), pack howl | Material |
| Bandit | ½ | 5 (1d8+1) | 14 | +1 melee (1d6) | +1 | Defensive | Patrol (2-3) | 10 | Steals gold on hit | Material |
| Stirge | ½ | 5 (1d10) | 16 | +7 melee (1d3−4) | +4 | Aggressive | Swarm (5-8) | 0 | Attach + blood drain (1d4 CON/round) | Material, Swamp |
| Fire Beetle | ⅓ | 4 (1d8) | 16 | +1 melee (2d4) | +0 | Aggressive | Swarm (5-8) | 2 | Glow (reveals hidden in 2 tiles), fire bite | Material, Underdark |
| Darkmantle | 1 | 6 (1d10+1) | 17 | +5 melee (1d4+4) | +4 | Ambush | Pair (2) | 4 | Darkness 1/day, grab + constrict (blind target) | Underdark |
| Mephit (any) | 3 | 13 (3d8) | 17 | +4 melee (1d3) | +7 | Support | Pack (3-5) | 5 | Breath weapon (DC 12), explodes on death (1d8) | Elemental Planes |
| Pixie | 4 | 3 (½d6) | 18 | +6 ranged (spell) | +4 | Support | Swarm (5-8) | 8 | Greater invisibility, confusion dust, SR 15 | Feywild |
| Lemure | 1 | 9 (2d8) | 14 | +2 melee (1d4) | +0 | Aggressive | Swarm (5-8) | 0 | DR 5/good or silver, regenerate 2 HP/turn (fire negates) | Nine Hells |
| Manes | ½ | 6 (1d8+2) | 12 | +1 melee (1d2+1) | +0 | Aggressive | Swarm (6-8) | 0 | Stench aura (Fort DC 9 or −2 Atk for adjacent) | The Abyss |
| Shadow | 3 | 19 (3d12) | 13 | +3 melee (1d6 STR drain) | +2 | Ambush | Pack (3-5) | 0 | STR drain on touch, incorporeal (50% miss from physical) | Shadowfell |
| Crawling Claw | ⅛ | 2 (1d4) | 12 | +3 melee (1d4+1) | +0 | Aggressive | Swarm (6-10) | 0 | Tiny, immune to turn undead, climb | Shadowfell |
| Myconid Sprout | ¼ | 7 (2d6) | 10 | +1 melee (1d4−1) | −1 | Defensive | Swarm (5-8) | 2 | Rapport spores (telepathy 30ft), pacifying spores (Will DC 11) | Underdark |
| Needle Blight | ¼ | 11 (2d8+2) | 12 | +3 ranged (2d4 needles) | +1 | Aggressive | Swarm (5-8) | 0 | Needle spray (cone, 2d4), false appearance (looks like bush) | Feywild |
| Twig Blight | ⅛ | 4 (1d6+1) | 13 | +3 melee (1d4+1) | +1 | Ambush | Swarm (6-10) | 0 | False appearance (looks like dead shrub), vulnerability to fire | Feywild |
| Gas Spore | ½ | 1 (1d10−4) | 5 | -- | −3 | Aggressive | Solo | 0 | Looks like Beholder (Spot DC 15), death burst (3d6 poison 10ft, Fort DC 10, infested) | Underdark |
| Flumph | ¼ | 7 (2d6) | 12 | +4 melee (1d4+2 acid) | +3 | Support | Pair (2) | 5 | Telepathic shriek (stun 1 round, Ref DC 10), detect evil/good, ally — helps party | Underdark |
| Violet Fungus | ¼ | 18 (4d8) | 5 | +2 melee (1d8 necrotic, reach 2) | −3 | Aggressive | Pack (3-5) | 0 | Rotting touch (4 tentacle attacks, 1d8 necrotic each, reach 2 tiles) | Underdark |

#### CR 2–4 — Uncommon Encounters

XP per D&D 3e CR table: CR 2 = 600 XP, CR 3 = 900 XP, CR 4 = 1,200 XP | Gold: 10-30

| Enemy | CR | HP | AC | Atk | Init | AI | Spawn | Gold | Special | Home Dimension |
|-------|-----|-----|-----|------|------|-----|-------|------|---------|---------------|
| Orc | ½ | 6 (1d8+2) | 13 | +4 melee (2d4+3) | +0 | Aggressive | Pack (3-5) | 15 | Rage below 50% HP (+2 Atk/DMG, −2 AC) | Material |
| Gnoll | 1 | 11 (2d8+2) | 15 | +3 melee (1d8+2) | +0 | Aggressive | Pack (3-5) | 12 | Rampage (free attack after kill) | Material |
| Ghoul | 1 | 13 (2d12) | 14 | +2 melee (1d6+1) | +2 | Aggressive | Pack (3-5) | 10 | Paralysis touch (Fort DC 12 or stunned 1d4+1 rounds) | Material, Shadowfell |
| Bugbear | 2 | 16 (3d8+3) | 17 | +4 melee (2d6+2) | +1 | Ambush | Patrol (2-3) | 20 | Surprise: +2d6 sneak attack on first round | Material |
| Harpy | 4 | 31 (7d8) | 13 | +7 melee (1d3) | +2 | Support | Pair (2) | 15 | Captivating Song (Will DC 16 or charmed, walks toward) | Material |
| Ogre | 3 | 29 (4d8+11) | 16 | +8 melee (2d8+7) | −1 | Aggressive | Solo | 30 | Sweeping blow (cleave), power attack | Material |
| Worg | 2 | 30 (4d10+8) | 14 | +7 melee (1d6+4) | +2 | Aggressive | Pack (3-5) | 8 | Trip on bite hit, mounted goblin rider | Material |
| Cockatrice | 3 | 27 (5d10) | 14 | +6 melee (1d4−2) | +3 | Defensive | Pair (2) | 15 | Petrifying bite (Fort DC 12 or petrified over 3 rounds) | Material |
| Gelatinous Cube | 3 | 54 (4d10+32) | 3 | +2 melee (1d6+1 acid) | −5 | Aggressive | Solo | 25 | Engulf (Ref DC 13), acid 1d6/round, transparent (Spot DC 15) | Underdark |
| Ettercap | 3 | 27 (5d8+5) | 14 | +3 melee (1d8+2) | +3 | Ambush | Pair (2) | 12 | Web traps (Ref DC 13), spider ally (1d3 medium spiders) | Underdark |
| Lizardfolk | 1 | 11 (2d8+2) | 15 | +2 melee (1d8+1) | +0 | Defensive | Pack (3-5) | 15 | Shield bash (push 1 tile), hold breath 4× CON rounds | Material, Swamp |
| Sahuagin | 2 | 11 (2d8+2) | 16 | +4 melee (1d8+2) | +1 | Aggressive | Pack (3-5) | 12 | Blood frenzy (+2 Atk/DMG vs wounded), underwater advantage | Elemental Water |
| Azer | 2 | 15 (2d8+6) | 23 | +3 melee (1d8+3 + 1d6 fire) | +1 | Defensive | Patrol (2-3) | 25 | Fire body (melee attackers take 1d6 fire), fire immune | Elemental Fire |
| Spined Devil | 3 | 22 (5d8) | 16 | +4 ranged (spine 1d6+1) | +2 | Aggressive | Pack (3-5) | 10 | Spine volley (ranged 3 tiles, multi-target), DR 5/good | Nine Hells |
| Quaggoth | 2 | 30 (4d10+8) | 13 | +6 melee (1d6+4) | +1 | Aggressive | Pack (3-5) | 8 | Frenzy (extra attack when below half HP), climb 20ft | Underdark |
| Dryad | 3 | 14 (2d6+7) | 17 | +6 melee (1d4−1) | +4 | Support | Solo | 20 | Charm person (Will DC 14), tree stride, DR 5/cold iron | Feywild |
| Rust Monster | 3 | 27 (5d10) | 18 | +3 melee (touch) | +3 | Aggressive | Pair (2) | 0 | Rust touch (destroys metal items, Fort DC 17 negates) | Underdark |
| Carrion Crawler | 4 | 19 (3d10+3) | 17 | +2 melee (tentacle 0 + paralysis) | +2 | Aggressive | Solo | 10 | 8 tentacle attacks (Fort DC 13 or paralyzed 2d6 min), ceiling crawl | Underdark |
| Ankheg | 3 | 28 (3d10+12) | 18 | +7 melee (2d6+7 bite + 1d4 acid) | +0 | Ambush | Pair (2) | 20 | Burrow ambush (+2d6 on surprise), acid spray (line 3 tiles, 4d4 acid, Ref DC 13) | Material |
| Peryton | 2 | 33 (6d8+6) | 13 | +5 melee (1d8+3 gore) | +2 | Aggressive | Pair (2) | 15 | Flyby attack (no AoO on move-through), dive attack (double damage from 5+ tiles altitude) | Material, Mountain |
| Intellect Devourer | 2 | 21 (6d4+6) | 12 | +4 melee (1d6+2 claw ×2) | +4 | Ambush | Solo | 0 | Devour Intellect (INT damage, Int DC 12), Body Thief (steal dead host) | Underdark, Far Realm |
| Gibbering Mouther | 2 | 67 (9d8+27) | 9 | +2 melee (5d6 bite swarm) | −1 | Aggressive | Solo | 15 | Gibbering (Will DC 10 or confused 1 round), ground warp (difficult terrain 10ft) | Far Realm |
| Grick | 2 | 27 (6d8) | 14 | +4 melee (1d6+2 tentacle ×2, 1d4+1 beak) | +2 | Ambush | Pair (2) | 10 | Stone camouflage (+10 Hide vs stone), DR 5/magic | Underdark |
| Kenku | 1 | 13 (3d8) | 13 | +3 melee (1d6+1 shortsword) | +1 | Ambush | Pack (3-5) | 12 | Mimicry (distraction, Will DC 12 or flat-footed), ambush tactics (+2d4 sneak on surprise) | Material |
| Kuo-Toa | ½ | 11 (2d8+2) | 13 | +3 melee (1d6+1 spear) | +0 | Defensive | Pack (3-5) | 10 | Sticky shield (disarm on shield block, Ref DC 11), slippery (+4 escape grapple) | Underdark, Elemental Water |

#### CR 5–8 — Rare Encounters

XP per D&D 3e CR table: CR 5 = 1,500 XP, CR 6 = 1,800 XP, CR 7 = 2,100 XP, CR 8 = 2,400 XP | Gold: 30-80

| Enemy | CR | HP | AC | Atk | Init | AI | Spawn | Gold | Special | Home Dimension |
|-------|-----|-----|-----|------|------|-----|-------|------|---------|---------------|
| Minotaur | 4 | 45 (6d10+12) | 14 | +9 melee (1d8+6 gore) | +0 | Aggressive | Solo | 50 | Charge (double damage from 3+ tiles), Power Attack | Material |
| Basilisk | 5 | 45 (6d10+12) | 16 | +8 melee (1d8+4) | −1 | Defensive | Solo | 40 | Petrifying gaze (Fort DC 13 or petrified), DR 5/magic | Material |
| Wraith | 5 | 32 (5d12) | 15 | +5 touch (1d4 + 1d6 CON drain) | +7 | Ambush | Pair (2) | 0 | Incorporeal, life drain, create spawn | Shadowfell |
| Wight | 3 | 26 (4d12) | 15 | +3 slam (1d4+1 + energy drain) | +1 | Aggressive | Pack (3-5) | 30 | Energy drain (1 negative level, Fort DC 14) | Shadowfell |
| Gargoyle | 4 | 37 (4d8+19) | 16 | +6 melee (1d4+2 claw ×2, 1d6+1 bite, 1d6+1 gore) | +2 | Defensive | Patrol (2-3) | 35 | DR 10/magic, freeze (appear as statue) | Material |
| Owlbear | 4 | 52 (5d10+25) | 15 | +9 melee (1d6+5 claw ×2, 1d8+2 bite) | +1 | Aggressive | Pair (2) | 40 | Improved Grab, bear hug (2d6+5 crush) | Material, Feywild |
| Manticore | 5 | 57 (6d10+24) | 17 | +10 melee (1d6+5 claw ×2, 1d8+2 bite) | +2 | Aggressive | Solo | 50 | Tail spikes (ranged 4 tiles, 6/day, 1d8+2 each) | Material |
| Displacer Beast | 4 | 51 (6d10+18) | 16 | +7 melee (1d6+4 tentacle ×2) | +3 | Ambush | Pair (2) | 45 | Displacement (50% miss chance until hit, resets each round) | Feywild |
| Phase Spider | 5 | 32 (5d10+5) | 15 | +7 melee (1d6+4 + poison) | +7 | Ambush | Pack (3-5) | 30 | Ethereal jaunt (phase shift after attack), poison (Fort DC 17, 1d6 CON) | Ethereal |
| Troll | 5 | 63 (6d8+36) | 16 | +9 melee (1d6+6 claw ×2, 1d6+3 bite) | +2 | Aggressive | Pair (2) | 40 | Regeneration 5/round (fire and acid negate) | Material |
| Hill Giant | 7 | 102 (12d8+48) | 20 | +16 melee (2d8+10 greatclub) | −1 | Aggressive | Solo | 60 | Rock throw (ranged 5 tiles, 2d6+7), ground slam (AoE) | Material |
| Xorn | 6 | 48 (6d8+18) | 24 | +7 melee (1d4+3 bite, 1d3+1 claw ×3) | +0 | Aggressive | Solo | 80 | Burrow, all-around vision, earth glide, tremorsense | Elemental Earth |
| Salamander | 6 | 51 (6d8+24) | 18 | +8 melee (1d8+3 + 1d6 fire) | +1 | Aggressive | Pair (2) | 45 | Fire body (1d6 to melee attackers), constrict 2d8+3 + 1d6 fire | Elemental Fire |
| Water Elemental (Large) | 5 | 68 (8d8+32) | 20 | +9 melee (2d8+4 slam) | +2 | Aggressive | Solo | 0 | Whelm (engulf + drown), water mastery (+1 Atk in water) | Elemental Water |
| Air Elemental (Large) | 5 | 60 (8d8+24) | 18 | +10 melee (2d6+3 slam) | +9 | Aggressive | Solo | 0 | Whirlwind (Ref DC 16, scatter), fly 100ft | Elemental Air |
| Bearded Devil | 5 | 45 (6d8+18) | 19 | +8 melee (1d10+3 glaive, reach 2) | +6 | Aggressive | Pack (3-5) | 25 | Infernal wound (bleed 2 HP/round, Heal DC 16), DR 5/silver or good | Nine Hells |
| Hezrou | 7 | 69 (6d8+42) | 23 | +13 melee (1d4+7 claw ×2, 4d4+3 bite) | +0 | Aggressive | Solo | 35 | Stench aura (Fort DC 20 or −2 all rolls, 10ft), SR 19 | The Abyss |
| Hook Horror | 6 | 65 (10d8+20) | 22 | +11 melee (1d8+5 hook ×2) | +3 | Aggressive | Pair (2) | 30 | Hook grab (pull 2 tiles + damage), echolocation (blindsight 60ft) | Underdark |
| Drider | 7 | 45 (6d8+18) | 17 | +7 melee (1d8+3 + poison) | +2 | Spellcaster | Patrol (2-3) | 50 | Spells (darkness, dispel magic), web, poison (Fort DC 16), SR 17 | Underdark |
| Green Hag | 5 | 49 (9d8+9) | 22 | +11 melee (1d4+6 claw ×2) | +1 | Spellcaster | Solo | 60 | Mimicry, weakness (2d4 STR), coven (+2 spell DC if 3 hags within 30ft) | Feywild, Swamp |
| Chuul | 7 | 93 (11d10+33) | 22 | +12 melee (2d6+5 pincer ×2) | +7 | Aggressive | Pair (2) | 50 | Paralytic tentacles (grappled → Fort DC 13 or paralyzed), amphibious, sense magic 120ft | Underdark, Elemental Water |
| Bulette | 5 | 94 (9d10+45) | 17 | +7 melee (4d12+4 bite) | +1 | Aggressive | Solo | 40 | Deadly Leap (jump 3 tiles, Ref DC 16 or prone + 3d6+4), burrow 40ft, tremorsense | Material, Underdark |
| Gorgon (Bull) | 5 | 114 (12d10+48) | 19 | +13 melee (2d12+7 gore) | +0 | Aggressive | Solo | 60 | Petrifying breath (cone 3 tiles, Fort DC 13 or petrified over 2 rounds), trample | Material |
| Revenant | 5 | 136 (16d8+64) | 13 | +7 melee (2d6+4 fist) | +0 | Aggressive | Solo | 0 | Relentless (if destroyed, reforms in 24h near murderer), vengeful tracker, immune to turn | Shadowfell |
| Shambling Mound | 5 | 136 (16d10+48) | 15 | +9 melee (2d8+4 slam ×2) | +0 | Aggressive | Solo | 0 | Engulf (grapple → 2d8+4/round + blind), lightning heals it, fire resistance | Material, Swamp |
| Yuan-Ti Malison | 7 | 66 (12d8+12) | 15 | +6 melee (1d6+3 scimitar ×2) | +5 | Spellcaster | Patrol (2-3) | 70 | Suggestion (Will DC 13), poison immunity, shapechanger, magic resistance (adv on saves vs spells) | Material, Jungle |
| Wyvern | 6 | 110 (13d10+39) | 13 | +7 melee (2d6+4 bite, 2d6+4 stinger) | +0 | Aggressive | Pair (2) | 50 | Poison sting (Fort DC 15, 7d6 poison), flyby, no breath weapon | Material, Mountain |

#### CR 9–14 — Very Rare Encounters

XP per D&D 3e CR table: CR 9 = 2,700 XP, CR 10 = 3,000 XP, CR 12 = 3,600 XP, CR 14 = 4,200 XP | Gold: 80-200

| Enemy | CR | HP | AC | Atk | Init | AI | Spawn | Gold | Special | Home Dimension |
|-------|-----|-----|-----|------|------|-----|-------|------|---------|---------------|
| Mind Flayer | 8 | 44 (8d8+8) | 15 | +8 melee (tentacle 1d4+1 × 4) | +6 | Spellcaster | Solo | 120 | Mind Blast (Will DC 17, 3×3 cone, stun 3d4 rounds), brain extract (grappled + stunned = instant kill), SR 25 | Underdark, Astral |
| Beholder | 13 | 93 (11d8+44) | 26 | +7 ranged (eye rays) | +6 | Spellcaster | Solo | 150 | 10 eye rays (random: charm, paralyze, petrify, disintegrate, etc.), antimagic cone 150ft | Underdark |
| Umber Hulk | 7 | 71 (8d8+35) | 18 | +14 melee (2d4+6 claw ×2, 2d8+3 bite) | +1 | Aggressive | Solo | 80 | Confusing gaze (Will DC 15), burrow through stone | Underdark |
| Gorgon | 8 | 85 (8d10+40) | 20 | +14 melee (2d8+9 gore) | +4 | Aggressive | Solo | 100 | Petrifying breath (cone, Fort DC 18), trample 2d8+9 (Ref DC 22) | Material |
| Chimera | 7 | 76 (9d10+27) | 19 | +11 melee (1d8+4 bite ×3) | +1 | Aggressive | Solo | 90 | Fire breath (3d8, Ref DC 15), triple attack | Material |
| Roper | 12 | 85 (10d8+40) | 24 | +11 melee (2d6+6 bite) | +5 | Ambush | Solo | 80 | 6 tentacle strands (Ref DC 18, pull 10ft/round), DR 10/good, SR 21, false appearance | Underdark |
| Drow Elite | 9 | 60 (10d8+15) | 22 | +12 melee (1d8+3 rapier + poison) | +3 | Support | Patrol (2-3) | 100 | Darkness, faerie fire, SR 20, poison (Fort DC 17, unconscious), spells as 10th-level sorcerer | Underdark |
| Young Dragon (any) | 10 | 136 (16d12+32) | 23 | +20 melee (2d6+6 bite, 1d8+3 claw ×2) | +0 | Aggressive | Solo | 180 | Breath weapon (type varies, Ref DC 18), frightful presence (Will DC 18), fly | Material, all |
| Bone Devil | 9 | 95 (10d8+50) | 25 | +14 melee (1d8+5 sting + poison) | +9 | Aggressive | Solo | 90 | Poison (Fort DC 20, 1d6 STR), fear aura (Will DC 19), fly, DR 10/good | Nine Hells |
| Glabrezu | 13 | 114 (12d8+60) | 27 | +16 melee (1d6+6 pincer ×2) | +0 | Spellcaster | Solo | 100 | Improved Grab, power word stun, mirror image, DR 10/good, SR 21 | The Abyss |
| Vampire Spawn | 4 | 29 (4d12+3) | 15 | +5 slam (1d6+3 + energy drain) | +6 | Aggressive | Pack (3-5) | 80 | Energy drain (1 negative level), fast healing 2, gaseous form, spider climb | Shadowfell |
| Fire Giant | 10 | 142 (15d8+75) | 23 | +21 melee (3d6+10 greatsword) | −1 | Aggressive | Solo | 200 | Rock throw (ranged 5, 2d6+10), fire immune, heated weapons | Elemental Fire |
| Frost Giant | 9 | 133 (14d8+70) | 21 | +20 melee (2d8+13 greataxe) | −1 | Aggressive | Solo | 180 | Rock throw (ranged 5, 2d6+10), cold immune, axe cleave | Material, Tundra |
| Cloud Giant | 11 | 178 (17d8+102) | 25 | +22 melee (4d6+13 morningstar) | +1 | Spellcaster | Solo | 200 | Rock throw (ranged 5, 2d8+13), levitate, obscuring mist, fog cloud | Elemental Air |
| Dao | 10 | 87 (12d8+33) | 22 | +16 melee (2d6+7 slam) | +8 | Spellcaster | Solo | 200 | Earth glide, wall of stone 1/day, passwall 1/day, tremorsense 60ft | Elemental Earth |
| Efreeti | 11 | 95 (10d8+50) | 18 | +15 melee (2d6+6 slam + 1d6 fire) | +7 | Spellcaster | Solo | 200 | Scorching ray, wall of fire, grant wishes, plane shift, fire immune | Elemental Fire |
| Marid | 9 | 84 (8d8+48) | 22 | +14 melee (2d6+6 slam) | +6 | Spellcaster | Solo | 200 | Water jet (line, 1d6+6 + push), control water, water walk, gaseous form | Elemental Water |
| Djinni | 5 | 45 (7d8+14) | 16 | +9 melee (2d6+4 slam) | +8 | Spellcaster | Solo | 200 | Whirlwind (10-50ft, 2d6 damage), invisibility, create food/water, major creation | Elemental Air |
| Githyanki Knight | 9 | 55 (10d8+10) | 22 | +13 melee (2d6+5 silver greatsword + 2d6 psychic) | +2 | Aggressive | Patrol (2-3) | 120 | Plane shift 1/day, telekinesis, innate psi (DC 16), SR 18 | Astral |
| Nothic | 4 | 45 (6d10+12) | 15 | +4 melee (2d6+2 claw ×2) | +2 | Ambush | Solo | 60 | Weird insight (knows weaknesses, +4d6 DMG next attack), rotting gaze (3d6 necrotic, Con DC 12) | Underdark, Far Realm |
| Behir | 11 | 168 (16d10+80) | 17 | +13 melee (3d10+6 bite) | +7 | Aggressive | Solo | 120 | Lightning breath (line 4 tiles, 12d10, Ref DC 16), constrict (2d10+6), swallow medium or smaller | Underdark |
| Spirit Naga | 8 | 75 (10d10+20) | 15 | +7 melee (1d8+4 bite + poison) | +6 | Spellcaster | Solo | 100 | Spells (lightning bolt, fireball, charm, dominate), rejuvenation (reforms in 1d6 days), poison bite (Fort DC 13, 7d8) | Underdark |
| Guardian Naga | 10 | 127 (15d10+45) | 18 | +8 melee (1d8+4 bite + poison) | +8 | Support | Solo | 150 | Spells (cure wounds, flame strike, geas), poison (Fort DC 15, 10d8), divine magic 10th level | Material |
| Couatl | 4 | 97 (13d8+39) | 19 | +8 melee (1d6+4 bite + poison) | +7 | Support | Solo | 80 | Shapechange, divine magic 5th level, poison (Fort DC 13, asleep 24h), detect evil, radiant shield | Material, Celestial |
| Cloaker | 8 | 78 (12d10+12) | 14 | +6 melee (1d10+3 bite + tail) | +2 | Ambush | Solo | 80 | Engulf (auto-damage, target blinded/restrained), moan (Will DC 13: fear/hypnosis), phantasms (mirror images) | Underdark |
| Froghemoth | 10 | 184 (16d12+80) | 14 | +10 melee (4d6+7 bite, 3d8 tentacle ×2) | −1 | Aggressive | Solo | 50 | Swallow whole, tentacle grab (reach 3), shock susceptibility (+1d6 per lightning hit), amphibious | Underdark, Swamp |

#### CR 15+ — Legendary Encounters

XP per D&D 3e CR table: CR 15 = 4,500 XP, CR 17 = 5,100 XP, CR 20 = 6,000 XP, CR 25 = 7,500 XP, CR 30 = 9,000 XP | Gold: 200-1000

| Enemy | CR | HP | AC | Atk | Init | AI | Spawn | Gold | Special | Home Dimension |
|-------|-----|-----|-----|------|------|-----|-------|------|---------|---------------|
| Adult Red Dragon | 15 | 253 (22d12+110) | 29 | +28 melee (2d8+10 bite, 2d6+5 claw ×2) | +0 | Aggressive | Solo | 500 | Fire breath (cone 10 tiles, 14d10, Ref DC 23), frightful presence (Will DC 23), DR 10/magic, SR 22 | Material |
| Adult Blue Dragon | 15 | 237 (19d12+114) | 28 | +26 melee (2d8+9 bite, 2d6+4 claw ×2) | +0 | Spellcaster | Solo | 500 | Lightning breath (line 8 tiles, 12d8, Ref DC 22), burrow, create/destroy water, SR 22 | Material, Desert |
| Adult Black Dragon | 13 | 195 (17d12+85) | 26 | +23 melee (2d6+8 bite, 1d8+4 claw ×2) | +4 | Ambush | Solo | 400 | Acid breath (line 6 tiles, 12d4, Ref DC 21), darkness, water breathing, SR 20 | Material, Swamp |
| Adult White Dragon | 12 | 178 (17d12+68) | 24 | +22 melee (2d6+7 bite, 1d8+3 claw ×2) | +0 | Aggressive | Solo | 350 | Cold breath (cone 8 tiles, 10d6, Ref DC 20), ice walk, fog cloud, SR 19 | Material, Tundra |
| Adult Green Dragon | 14 | 218 (19d12+95) | 27 | +25 melee (2d8+8 bite, 2d6+4 claw ×2) | +0 | Spellcaster | Solo | 450 | Poison breath (cone 8 tiles, Fort DC 22 or 6d6 CON), charm, suggestion, SR 21 | Feywild, Forest |
| Lich | 17 | 104 (16d12) | 27 | +12 touch (paralyzing, Will DC 22) | +5 | Spellcaster | Solo + Minions | 800 | Phylactery (revives 1d10 days), 18th-level spellcaster, fear aura (Will DC 22), DR 15/bludgeoning+magic | Shadowfell |
| Demon (Balor) | 20 | 290 (20d8+200) | 35 | +35 melee (2d6+13 longsword + 2d6 fire, 4d6+6 whip) | +11 | Aggressive | Solo | 600 | Death throes (100ft, 20d6 fire, Ref DC 30), fire whip (pull + grapple), DR 15/cold iron+good, SR 28 | The Abyss |
| Demon (Marilith) | 17 | 216 (16d8+144) | 29 | +22 melee (2d6+7 longsword × 6) | +4 | Aggressive | Solo | 500 | 6 weapon attacks/round, reactive parry (+5 AC), teleport without error, DR 10/good+cold iron, SR 25 | The Abyss |
| Devil (Pit Fiend) | 20 | 325 (26d8+208) | 40 | +37 melee (4d6+17 bite) | +12 | Spellcaster | Solo + Minions | 700 | Fear aura (Will DC 25), fireball at will, poison (Fort DC 27), regeneration 5, DR 15/good+silver, SR 32 | Nine Hells |
| Aboleth | 10 | 76 (8d8+40) | 16 | +12 melee (1d6+5 tentacle × 4) | +1 | Spellcaster | Solo + Minions | 500 | Enslave (Will DC 17), slime (Fort DC 19 or breathe only water), psychic crush, SR 15 | Far Realm, Underdark |
| Purple Worm | 12 | 200 (16d10+112) | 19 | +25 melee (2d8+12 bite, 2d6+6 sting) | −2 | Aggressive | Solo | 300 | Swallow whole (grapple +25, 2d8+12 crush), burrow 20ft, tremorsense 60ft, poison (Fort DC 25) | Underdark |
| Beholder Tyrant | 16 | 120 (16d8+48) | 30 | +10 ranged (eye rays) | +8 | Spellcaster | Solo + Minions | 1000 | Death ray (Fort DC 22), disintegrate, petrify, charm, antimagic cone 150ft, lair actions (3/round) | Underdark |
| Death Knight | 15 | 114 (12d12+36) | 30 | +18 melee (2d6+9 greatsword + 2d6 necrotic) | +5 | Aggressive | Solo + Minions | 600 | Hellfire orb (20ft, 12d6 fire+necrotic, Ref DC 20), command undead, aura of fear, immune turning | Shadowfell |
| Storm Giant | 13 | 199 (19d8+114) | 27 | +28 melee (3d6+14 greatsword) | +2 | Spellcaster | Solo | 800 | Call lightning (10d6), control weather, chain lightning, water breathing, freedom of movement | Elemental Air |
| Elder Brain | 18 | 210 (20d8+120) | 22 | +8 ranged (psychic) | +0 | Spellcaster | Solo + Minions | 600 | Psychic blast (60ft cone, 4d8+8 psychic, Int DC 20), dominate monster (Will DC 22), thrall link | Far Realm, Astral |
| Githyanki Supreme Commander | 16 | 150 (20d8+60) | 28 | +22 melee (2d6+8 silver greatsword + 3d6 psychic) | +5 | Aggressive | Solo + Minions | 500 | Plane shift at will, mass telekinesis, psi abilities (DC 20), gith squad tactics (+2 Atk aura) | Astral |
| Kraken | 20 | 290 (20d10+180) | 20 | +28 melee (2d8+12 tentacle × 4) | +4 | Aggressive | Solo | 400 | Fling (hurl grabbed creature 60ft), lightning storm (3/day, 8d6), ink cloud (blinds all, 3 rounds), swallow whole | Elemental Water |
| Tarrasque | 30 | 858 (48d10+576) | 35 | +57 melee (4d8+17 bite) | +0 | Aggressive | Solo | 0 | Reflective carapace (ranged spells rebound), swallow whole, trample 4d12+25 (Ref DC 43), frightful presence (Will DC 30), regeneration 40/round, rush | Material (mythic) |
| Ancient Dragon (any) | 22 | 462 (28d12+280) | 39 | +38 melee (4d6+14 bite, 2d8+7 claw ×2) | +0 | Aggressive | Solo | 1000 | Legendary actions (3/round), breath weapon (DC 29), frightful presence (DC 29), lair actions, wing attack (2d6+7) | Material, all |
| Planetar | 16 | 200 (16d10+112) | 24 | +22 melee (4d6+8 greatsword + 5d8 radiant) | +7 | Support | Solo | 0 | Heal (6/day), raise dead (1/day), divine aura (30ft, +2 saves allies), fly 120ft, DR 10/evil, SR 25 | Celestial |
| Deva | 10 | 136 (16d8+64) | 17 | +8 melee (1d6+4 mace + 4d8 radiant) | +4 | Support | Solo | 0 | Healing touch (20 HP, 3/day), change shape, magic resistance, fly 90ft | Celestial |
| Nightwalker | 20 | 297 (22d12+154) | 14 | +12 melee (4d6+8 slam) | +6 | Aggressive | Solo | 500 | Annihilating aura (30ft, 4d6 necrotic start-of-turn), life eater (kills with massive dmg cannot be revived), finger of doom (Ref DC 21 or 6d12 necrotic) | Shadowfell |
| Bodak | 6 | 58 (9d8+18) | 15 | +4 melee (1d4+2 fist) | +2 | Aggressive | Pack (3-5) | 0 | Death gaze (30ft, Will DC 13 or drop to 0 HP), aura of annihilation (5ft, 5 necrotic start-of-turn), sunlight vulnerability | Shadowfell |
| Nagpa | 17 | 187 (34d8+34) | 19 | +9 melee (2d8+4 staff) | +3 | Spellcaster | Solo + Minions | 400 | 15th-level spellcaster, paralysis (Will DC 20), corruption (turn creatures against allies), cursed immortality | Shadowfell |
| Retriever | 14 | 210 (20d10+100) | 19 | +11 melee (2d6+5 foreleg ×4) | +3 | Aggressive | Solo | 0 | Eye rays (fire/cold/lightning/force, 4/day each, 12d6, Ref DC 16), relentless tracking, construct immunities | The Abyss |

#### Dimensional Monster Variants

Any Material Plane monster can appear as a **dimensional variant** when encountered in another plane. Variants have the base monster's stats modified by the dimension:

| Dimension | Prefix | Stat Modifier (d20) | Visual Modifier | Bonus Ability |
|-----------|--------|---------------------|-----------------|---------------|
| Feywild | Fey- | +4 Init, +2 spell DCs | Glowing eyes, ethereal shimmer | Charm touch (Will DC 12 + ½ CR or confused 1 round) |
| Shadowfell | Shadow- | +2 HP/HD, −2 Init | Dark silhouette, trailing shadows | Life drain on hit (heals 25% of damage dealt) |
| Nine Hells | Infernal- | +2 Atk, +2 AC | Red skin, burning eyes, horns | Fire shield (1d6+2 fire to melee attackers) |
| The Abyss | Abyssal- | +2 Atk, −2 AC | Chaotic mutations, extra limbs | Random effect on hit (Fort/Will DC 14: poison/fear/bleed/stun) |
| Elemental Fire | Flame- | fire immune, +4 Atk | Wreathed in flames | Burns adjacent tiles (lava terrain for 2 rounds) |
| Elemental Water | Tide- | cold resist 10, +2 AC | Aquatic, translucent | Water jet (push 2 tiles, Ref DC 14) |
| Elemental Earth | Stone- | +4 AC, −2 Init, DR 5/-- | Rocky skin, crystal growths | Earthquake (AoE 2-tile radius, Ref DC 14 or prone) |
| Elemental Air | Storm- | +4 Init, fly speed 8 tiles | Crackling with lightning | Lightning arc (1d6/CR to target + 2 adjacent, Ref DC 15) |
| Astral | Astral- | +2 to all saves, +1 CR | Silver sheen, floating | Psychic resistance (immune to mind-affecting below L5), plane shift on death |
| Far Realm | Aberrant- | random ±2 to all stats | Tentacles, extra eyes, wrong anatomy | Madness aura (Will DC 12 + ½ CR or random debuff, 10ft) |
| Underdark | Deep- | +2 HP/HD, darkvision 120ft | Pale, bioluminescent spots | Superior Stealth (+10 Hide in darkness, +4 surprise attack bonus) |

Example: A "Shadow-Goblin" in the Shadowfell has 7 HP (1d8+3, +2 HP/HD), Init −1 (base +1 − 2), trailing shadow visuals, and drains life on hit.

#### AI Behavior Patterns

| Pattern | Description | Priority Target |
|---------|-------------|----------------|
| **Aggressive** | Moves toward and attacks each turn | Lowest-HP party member |
| **Defensive** | Holds position, attacks units that enter range | Nearest attacker |
| **Ambush** | Hidden until party is adjacent, surprise attack first round | Nearest unit on reveal |
| **Support** | Buffs/heals allies, debuffs party, avoids melee | Wounded allies (heal) or strongest enemy (debuff) |
| **Spellcaster** | Maintains 3+ tile distance, uses highest-impact spell | Clustered enemies (AoE) or isolated targets (single) |
| **Pack Leader** | Commands nearby pack members (+2 attack aura), focuses high-value targets | Healers and casters first |
| **Berserker** | Charges nearest enemy, ignores positioning, attacks twice at low HP | Whatever is closest |
| **Coward** | Flees when below 30% HP, calls for reinforcements from adjacent rooms | Escape route |

#### Scaling (d20)

- **Per-floor**: +1 CR per 2 dungeon floors below the first (e.g., floor 3 enemies are +1 CR over base)
- **Per-dimension**: Dimensional difficulty multiplier (see 5.3b min party level)
- **Pack scaling**: Packs with 5+ members use CR−1 individual stat blocks (weaker individually, compensated by numbers)
- **Solo scaling**: Solo enemies get maximum HP for their Hit Dice, +1 action per turn, flanking immunity
- **Floor scaling formula**: `effectiveCR = baseCR + floor((dungeonFloor - 1) / 2)`

#### User Stories & Acceptance Criteria -- Enemies

**US-ENEMY-01**: As a player, I can see enemy sprites on the tactical grid with health bars.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each enemy type has a distinct base sprite |
| AC2 | Enemies within a pack have visible visual variations (palette, size, equipment) |
| AC3 | HP bar is shown above the sprite, proportional to current/max HP |
| AC4 | HP bar color changes: green (>50%), yellow (25-50%), red (<25%) |
| AC5 | Dimensional variants show the dimension prefix in their name and use appropriate tint |

**US-ENEMY-02**: As a player, I can hover over an enemy to see its name, HP, and special abilities.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Tooltip shows: name (with dimensional prefix if variant), CR, current HP / max HP |
| AC2 | Special abilities are listed with a one-line description |
| AC3 | Spawn type is shown (Pack 3/5, Solo, etc.) |
| AC4 | The enemy's AI pattern is NOT revealed (hidden from player) |

**US-ENEMY-03**: As a player, I can observe different AI behaviors.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Aggressive enemies move toward the lowest-HP party member each turn |
| AC2 | Defensive enemies hold position until a player unit enters their attack range |
| AC3 | Ambush enemies are invisible until a party member is within 2 tiles |
| AC4 | Support enemies prioritize healing wounded allies over attacking |
| AC5 | Spellcaster enemies maintain at least 3 tiles distance from melee threats |
| AC6 | Pack Leader enemies buff nearby allies with +2 attack aura (visible glow) |
| AC7 | Coward enemies flee toward exit when below 30% HP |

```gherkin
Scenario: Aggressive AI targets weakest
  Given a Goblin (Aggressive) and two party members (Fighter 30 HP, Wizard 12 HP)
  When it is the Goblin's turn
  Then the Goblin moves toward the Wizard (lower HP)
  And attacks if in range

Scenario: Ambush AI reveals on proximity
  Given a Bugbear (Ambush) is hidden at tile (7, 3)
  And a party member moves to (6, 3) (adjacent)
  Then the Bugbear becomes visible
  And gains a surprise attack bonus on its first action (+2d6 sneak attack damage)

Scenario: Pack visual uniqueness
  Given a Goblin Pack spawns with 4 members
  Then each goblin has a different palette hue within ±30°
  And at least 2 goblins have different weapon sprites
  And size varies between 0.85x and 1.15x per individual

Scenario: Dimensional variant encounter
  Given a party is exploring a Shadowfell dungeon
  When encountering a pack of goblins
  Then they appear as "Shadow-Goblins"
  And have +2 HP per Hit Die and −2 Initiative compared to base goblins
  And their sprites have dark silhouette visual modifier
  And they drain life on hit (heal 1/4 damage dealt, max 5 HP per hit)
```

**US-ENEMY-04**: As a player, I encounter progressively harder enemies on deeper dungeon floors.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Floor 1-2 enemies are CR ¼–1 |
| AC2 | Floor 2-4 enemies are CR 1–4 |
| AC3 | Floor 4-6 enemies are CR 4–8 |
| AC4 | Floor 5-7 enemies are CR 8–14 |
| AC5 | Boss floor enemies are CR 15+ |
| AC6 | Per-floor scaling: effectiveCR = baseCR + floor((dungeonFloor − 1) / 2) |
| AC7 | Dimension-native monsters appear at 60%+ frequency; Material Plane displacements fill remainder |

**US-ENEMY-05**: As a player, I face unique legendary enemies on boss floors with multi-phase fights.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Boss enemies have 2-4 phases triggered by HP thresholds |
| AC2 | Phase transitions have a visual effect (screen flash, arena change) |
| AC3 | New attack patterns are introduced in later phases |
| AC4 | Boss HP bar is displayed prominently at the top of the screen |
| AC5 | Solo + Minions bosses spawn expendable adds that respawn on a 3-turn cooldown |

**US-ENEMY-06**: As a player, I see enemies use their special abilities contextually.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Orc uses Rage when below 50% HP (attack bonus increases by +3, −2 AC) |
| AC2 | Wolf uses Pack Howl when alone (summons 1-2 wolves if space available) |
| AC3 | Gargoyle uses Stone Form when below 25% HP (invulnerable 1 turn, heals 20%) |
| AC4 | Special abilities have cooldowns (at least 2 turns between uses) |
| AC5 | Pack members scatter when their Pack Leader is killed (morale break: −3 attack rolls for 2 turns) |

**US-ENEMY-07**: As a player, I encounter varied pack compositions where no two groups look identical.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each individual in a pack has a unique visual seed (palette, size, equipment, markings) |
| AC2 | Two packs of the same monster type in the same dungeon have different visual distributions |
| AC3 | Swarm spawns (5-8) are visibly weaker (smaller) than Patrol spawns (2-3) of the same monster |
| AC4 | Solo enemies are visibly larger than pack members of the same type (+15% scale) |

---

### 5.9b Companion Creatures

Each class grants a companion creature that fights alongside the party in a dedicated companion slot.

| Class | Companion | Role | Special Ability |
|-------|-----------|------|-----------------|
| Fighter | War Dog | Melee tank | Intercept (takes hit for adjacent ally) |
| Ranger | Wolf / Hawk | Melee / Scout | Track enemies through fog of war |
| Wizard | Familiar (Owl/Cat/Imp) | Utility | Delivers touch spells at range |
| Cleric | Spirit Guardian | Support | Passive heal aura (1 HP/turn to adjacent) |
| Rogue | Shadow Cat | Scout | Stealth (invisible until attacking) |
| Paladin | Celestial Steed | Transport | +2 movement on overworld (dismounted in dungeons) |
| Barbarian | Bear Cub | Melee DPS | Grows stronger with Barbarian's rage |
| Bard | Songbird | Buffer | Passive +1 to party morale (reduces debuff duration) |
| Warlock | Quasit / Sprite | Debuffer | Applies random debuff on hit |
| Sorcerer | Pseudodragon | Magic DPS | Mirrors 1/4 of Sorcerer's spell damage |

#### Companion Mechanics

- Companions have their own stat blocks (HP, AC, attack bonus, Initiative, damage dice) that scale with owner's level
- Companions level up alongside their owner
- Companions can be equipped with 1 minor item (collar, barding, charm)
- If a companion falls in combat, it returns at the next camp visit with 1 HP
- Companions take a turn in combat like any other unit (placed on the grid)

#### User Stories & Acceptance Criteria -- Companions

**US-COMP-01**: As a player, I can see my companion on the combat grid as a separate unit.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The companion occupies its own tile on the grid |
| AC2 | The companion has its own HP bar and sprite |
| AC3 | The companion appears in the turn order |
| AC4 | The companion is visually smaller (0.75x) than party members |

**US-COMP-02**: As a player, I can command my companion's movement and actions during combat.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | On the companion's turn, I can move it like a party member |
| AC2 | The companion has Attack and its Special Ability as actions |
| AC3 | The companion cannot use items or cast spells (unless its ability allows it) |
| AC4 | The companion can Wait (skip action) |

**US-COMP-03**: As a player, I can equip my companion with a minor item.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Companions have exactly 1 equipment slot |
| AC2 | Only items tagged as "companion-equippable" can be placed |
| AC3 | Equipping an item updates the companion's stat block |

**US-COMP-04**: As a player, I can see my companion's stats in the party management screen.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Companion stats (HP, AC, attack bonus, Initiative) are shown alongside their owner |
| AC2 | The companion's special ability is described |
| AC3 | The companion's level matches the owner's level |

**US-COMP-05**: As a player, I can see my companion grow stronger as I level up.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Companion stats increase by a fixed amount per level |
| AC2 | The stat increase is visible when the level-up screen appears |
| AC3 | Companion max HP increases proportionally |

**US-COMP-06**: As a player, I can revive a fallen companion at camp.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | A KO'd companion is shown with a "fallen" status in the party screen |
| AC2 | Resting at camp or visiting a companion caretaker revives it at 1 HP |
| AC3 | The companion cannot participate in combat while KO'd |

---

### 5.10 Time-Gated Content Rotation

All rotation is driven by seeded PRNG derived from real dates (using `new Date()`). The same date always produces the same rotation for all players.

#### Daily Rotation

| Content | Seed | Description |
|---------|------|-------------|
| Character roster | `YYYY-MM-DD` | 6-8 characters available from the full pool |
| Stat variance | `YYYY-MM-DD + charId` | +/-1 random variance per stat per character |
| Daily bonus stat | `YYYY-MM-DD` | One of STR/DEX/CON/INT/WIS/CHA gets +2 |
| Daily challenge | `YYYY-MM-DD` | Special single-floor dungeon with bonus rewards |

#### Weekly Rotation

| Content | Seed | Description |
|---------|------|-------------|
| Boss encounter | `YYYY-WW` | 1 of 50 boss archetypes as final dungeon boss (see 5.12 Boss Encounters) |
| Weekly quest | `YYYY-WW` | Multi-part quest chain with story and unique reward |

#### Monthly Rotation

| Content | Seed | Description |
|---------|------|-------------|
| Dungeon layout | `YYYY-MM` | All dungeon BSP seeds regenerated |
| Overworld map | `YYYY-MM` | Overworld biomes, roads, towns repositioned |
| Leaderboard reset | `YYYY-MM` | Monthly rankings reset with previous archived |

##### Leaderboard Metrics

| Metric | Description | Tracked Per |
|--------|-------------|-------------|
| **Highest Dungeon Floor** | Deepest floor reached in any dungeon this month | Monthly |
| **Bosses Defeated** | Number of unique bosses killed this month | Monthly |
| **Total XP Earned** | Cumulative XP gained this month | Monthly |
| **Fastest Boss Kill** | Fewest turns to defeat any boss | Monthly |
| **Highest Character Level** | Max level reached by any character | All-time |
| **Monsters Slain** | Total kill count this month | Monthly |
| **Gold Earned** | Total gold picked up (not spent) this month | Monthly |
| **Deaths** | Total party wipes this month (lower is better) | Monthly |

Leaderboards are:
- Stored in localStorage per difficulty setting (4 separate boards)
- Monthly boards archive on the 1st and reset
- "All-time" metrics persist across months
- Displayed on the title screen in a "Hall of Fame" panel
- Only the player's own scores (no server/network — local leaderboard only)

#### Seasonal Rotation

| Season | Months | Exclusive Races/Classes | Theme |
|--------|--------|------------------------|-------|
| Spring | Mar-May | -- | Renewal, nature magic boosted |
| Summer | Jun-Aug | Dragonborn (free window) | Heat, fire spells boosted |
| Autumn | Sep-Nov | Tiefling (free window) | Harvest, dark magic boosted |
| Winter | Dec-Feb | Tiefling (free window) | Frost, ice spells boosted |

#### Holiday Events

| Holiday | Date Range | Content |
|---------|-----------|---------|
| **Christmas** | Dec 20 -- Jan 2 | Frost weapons, Santa companion, Candy Cane Sword, Snowflake Shield, Ice Cavern special dungeon |
| **Valentine's Day** | Feb 10 -- Feb 18 | Cupid's Bow, Heart Shield, Love Potion consumables, Rose Garden dungeon |
| **Easter** | Varies (calculated) | Egg Hunt mini-game, Golden Egg artifacts, Spring Blossom armor set, Rabbit companion |
| **New Year** | Dec 30 -- Jan 5 | Firework spells, Hourglass artifact (time manipulation), Celebration buff |
| **Chinese New Year** | Varies (lunar calendar) | Zodiac animal companion (rotates yearly), Dragon Dance AoE spell, Jade equipment set, Lunar Temple dungeon |
| **Halloween** | Oct 25 -- Nov 3 | Undead character skins, Pumpkin Head helm, Witch's Broom mount, Haunted Mansion dungeon |

#### Time Rotation Invariants

- Same seed always produces identical output (pure function, no side effects)
- Daily rotation seed uses UTC date (not local timezone) to ensure global consistency
- Weekly seed uses ISO week number
- Holiday date ranges are inclusive on both ends
- Overlapping holidays (e.g., Christmas + New Year) combine content (both active)
- Easter date is computed via the Anonymous Gregorian algorithm (see below)
- Chinese New Year date is derived from a lookup table (2024-2050) (see below)

##### Easter Date Algorithm (Anonymous Gregorian / Computus)

```js
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day }; // Easter Sunday
}

// Easter event window: Easter Sunday −3 days to Easter Sunday +7 days (11-day window)
function getEasterWindow(year) {
  const easter = getEasterDate(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);
  const start = new Date(easterDate); start.setDate(start.getDate() - 3);
  const end = new Date(easterDate); end.setDate(end.getDate() + 7);
  return { start, end };
}
```

##### Chinese New Year Lookup Table (2024-2050)

Chinese New Year falls on the second new moon after the winter solstice. Computing this requires a lunisolar calendar, so a lookup table is simpler and more reliable:

```js
const CHINESE_NEW_YEAR_DATES = {
  2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06',
  2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23',
  2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
  2036: '01-28', 2037: '02-15', 2038: '02-04', 2039: '01-24',
  2040: '02-12', 2041: '02-01', 2042: '01-22', 2043: '02-10',
  2044: '01-30', 2045: '02-17', 2046: '02-06', 2047: '01-26',
  2048: '02-14', 2049: '02-02', 2050: '01-23',
};

// Chinese New Year event window: CNY date −2 days to CNY date +12 days (15-day window, matching traditional celebrations)
function getChineseNewYearWindow(year) {
  const [month, day] = CHINESE_NEW_YEAR_DATES[year].split('-').map(Number);
  const cny = new Date(year, month - 1, day);
  const start = new Date(cny); start.setDate(start.getDate() - 2);
  const end = new Date(cny); end.setDate(end.getDate() + 12);
  return { start, end };
}
```

For years beyond 2050, a placeholder algorithm can extrapolate based on the Metonic cycle (19-year lunar repeat), but the table should be extended before then.

#### User Stories & Acceptance Criteria -- Time-Gated Content

**US-TIME-01**: As a player, I see a different character roster every day.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The roster changes at 00:00 UTC |
| AC2 | At least 2 characters differ from the previous day |
| AC3 | The daily bonus stat is different from yesterday (no consecutive repeats) |
| AC4 | The title screen shows "Today's Roster" with the date |

```gherkin
Scenario: Roster updates at midnight UTC
  Given the player is on the character select screen at 23:59 UTC on 2026-06-15
  When the clock rolls to 00:00 UTC on 2026-06-16
  And the player refreshes or re-enters character select
  Then the roster reflects the 2026-06-16 seed
  And at least 2 characters are different from the previous roster
```

**US-TIME-02**: As a player, I can check which boss is active this week.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The title screen shows "This Week's Boss: [Name]" |
| AC2 | The boss rotates on Monday 00:00 UTC |
| AC3 | Boss identity is deterministic per ISO week number |

**US-TIME-03**: As a player, I discover new dungeon layouts and overworld maps each month.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | On the 1st of the month, all dungeon and overworld seeds regenerate |
| AC2 | An in-progress dungeon run is not interrupted mid-floor |
| AC3 | The title screen indicates "New Realm: [Month Year]" |

**US-TIME-04**: As a player, I can access seasonal exclusive races during their designated season.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Dragonborn appears in the roster pool during Jun-Aug |
| AC2 | Tiefling appears in the roster pool during Sep-Feb |
| AC3 | Outside their season, seasonal races only appear if `isEntitled()` returns true |

**US-TIME-05**: As a player, I can participate in holiday events with unique items and dungeons.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Holiday items appear in shop and loot tables during the holiday window |
| AC2 | Special holiday dungeons appear as a new dungeon entrance on the overworld |
| AC3 | Holiday content is removed when the window closes |
| AC4 | Items earned during holidays persist in inventory permanently |

```gherkin
Scenario: Christmas event active
  Given the date is December 25
  When I open the overworld
  Then an "Ice Cavern" dungeon entrance appears
  And the shop stocks Frost weapons, Candy Cane Sword, and Snowflake Shield
  And the Santa companion can appear in encounters as an ally

Scenario: Holiday items persist after event ends
  Given the player earned a Candy Cane Sword during Christmas
  And the date is now January 10 (event over)
  Then the Candy Cane Sword remains in the player's inventory
  But the Ice Cavern dungeon entrance is no longer on the overworld
```

**US-TIME-06**: As a player, I can attempt the daily challenge dungeon for bonus rewards.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The daily challenge is a single-floor dungeon with specific constraints |
| AC2 | Completing it grants a unique daily reward (cannot be earned again that day) |
| AC3 | The challenge is accessible from the overworld as a special entrance |
| AC4 | Difficulty is scaled to the player's average party level |

**US-TIME-07**: As a player, I can complete the weekly quest chain for a unique reward.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The weekly quest has 3 stages (talk to NPC, dungeon objective, boss kill) |
| AC2 | Progress persists across sessions within the week |
| AC3 | Completing all stages grants a unique weekly reward |
| AC4 | The quest chain resets on Monday 00:00 UTC |

**US-TIME-08**: As a returning player, I know today's content is deterministic -- same for everyone.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The seeded PRNG produces identical output for identical seeds |
| AC2 | No randomness depends on runtime state (only on date seeds) |
| AC3 | The title screen indicates the seed date so players can compare |

---

### 5.11 Progression & Camp

#### XP & Leveling

- XP gained from combat (per enemy killed, bonus for boss kills)
- XP shared equally among surviving party members
- **Level cap: 100** -- levels 1-20 are base class levels, levels 21-100 are prestige class levels (see 5.14)
- Prestige promotion requires visiting a town's Promotion Hall at level 20+
- Without prestige promotion, a character remains at their base class but can still level to 100 (slower stat growth, no prestige abilities)
- Each level grants: +HP, +MP, stat point allocation, and ability unlock at key milestones

#### XP Table

##### Base Class Levels (1-20)

| Level | XP Required | Cumulative | Stat Points | Unlocks |
|-------|-------------|-----------|-------------|---------|
| 1 | 0 | 0 | -- | Starting abilities, 2 cantrips (casters), Novice proficiency in class weapons |
| 2 | 100 | 100 | +2 | -- |
| 3 | 200 | 300 | +2 | Ability #1, learn 1 spell (casters) |
| 4 | 300 | 600 | +2 | T2 equipment usable |
| 5 | 400 | 1,000 | +2 | Ability #2, Spell Level 2 access, learn 1 spell (casters) |
| 6 | 500 | 1,500 | +2 | T3 equipment usable |
| 7 | 600 | 2,100 | +2 | Ability #3, learn 1 spell (casters) |
| 8 | 700 | 2,800 | +2 | -- |
| 9 | 800 | 3,600 | +2 | Learn 1 spell (casters) |
| 10 | 1,000 | 4,600 | +2 | Ability #4, Spell Level 3 access, learn 1 spell (casters), T4 equipment usable |
| 11 | 1,200 | 5,800 | +2 | Learn 1 spell (casters) |
| 12 | 1,300 | 7,100 | +2 | -- |
| 13 | 1,500 | 8,600 | +2 | Ability #5, learn 1 spell (casters) |
| 14 | 1,700 | 10,300 | +2 | -- |
| 15 | 1,800 | 12,100 | +2 | Learn 1 spell (casters), T5 equipment usable |
| 16 | 2,000 | 14,100 | +2 | Ability #6, Spell Level 4 access, learn 1 spell (casters) |
| 17 | 2,200 | 16,300 | +2 | Learn 1 spell (casters) |
| 18 | 2,500 | 18,800 | +2 | T6 (Legendary) equipment usable |
| 19 | 3,000 | 21,800 | +2 | Ability #7, learn 1 spell (casters) |
| 20 | 5,000 | 26,800 | +2 | **Prestige eligible**, final base cantrip (casters) |

##### Post-20 XP Scaling Formula

For levels 21-100, XP required per level scales with a quadratic curve:

```
xpForLevel(n) = floor(5000 + 500 * (n - 20) + 50 * (n - 20)^2)
```

| Level | XP Required | Cumulative | Stat Points | Unlocks (Milestone) |
|-------|-------------|-----------|-------------|---------------------|
| 21 | 5,550 | 32,350 | +1 | Prestige Ability #1 (if promoted) |
| 25 | 7,750 | 58,350 | +1 | Prestige Ability #2, Spell Level 5 (prestige casters) |
| 30 | 11,000 | 105,600 | +1 | Prestige Ability #3, T7 Prestige equipment tier |
| 35 | 14,750 | 170,350 | +1 | -- |
| 40 | 19,000 | 254,600 | +1 | Prestige Ability #4, Spell Level 6 (prestige casters), T8 Prestige equipment |
| 50 | 29,000 | 492,600 | +1 | Prestige Ability #5, prestige capstone preview |
| 60 | 41,000 | 842,600 | +1 | Prestige Ability #6, T9 Prestige equipment |
| 70 | 55,000 | 1,322,600 | +1 | Prestige Ability #7 |
| 80 | 71,000 | 1,952,600 | +1 | Prestige Ability #8, T10 Mythic equipment |
| 90 | 89,000 | 2,752,600 | +1 | Prestige Ability #9 |
| 100 | 109,000 | 3,742,600 | +1 | **Level cap**, Prestige Capstone ability, title "Legend of the Realms" |

##### Post-20 Progression Notes

- **Stat points**: +1 per level (reduced from +2 at levels 1-20 to slow power growth)
- **Prestige abilities**: Unlocked at levels 21, 25, 30, 40, 50, 60, 70, 80, 90, 100 (10 total, class-path-specific)
- **Without prestige**: Characters still gain +1 stat point per level and HP/MP growth, but receive no prestige abilities and no prestige equipment tiers. Generic "Veteran" abilities at milestones instead
- **Spell Levels 5-6**: Only accessible through prestige caster paths
- **Equipment Tiers 7-10**: Prestige-exclusive gear with enhanced stat requirements
- **XP curve intent**: Level 20 is reachable in ~10-15 dungeon runs. Level 50 requires ~50-60 runs. Level 100 is a long-term goal requiring ~200+ runs

#### Per-Level Rewards Summary

**Levels 1-20 (Base Class):**

1. **+1 ability score** every 4 levels (4, 8, 12, 16, 20) — D&D 3e standard
2. **+HP**: class hit die + CON modifier per level (e.g., Fighter d10+CON)
3. **+BAB**: per class rate (Full/Medium/Poor — see progression tables)
4. **+Saves**: Fort/Ref/Will per class rate (Good/Poor — see progression tables)
5. **+MP** (casters only): spell slots converted to MP pool, grows per level
6. **Weapon proficiency** continues passively (use-based, not level-gated)
7. **Spell learning** at odd levels for casters (pick 1 spell from class schools)
8. **Ability unlock** at key levels (3, 5, 7, 10, 13, 16, 19) — class-specific active/passive
9. **Equipment tier unlock** at levels 4, 6, 10, 15, 18 — higher-tier gear can now be equipped
10. **Prestige eligibility** at level 20 — can promote at a town's Promotion Hall

**Levels 21-100 (Prestige / Veteran):**

1. **+1 ability score point** every 4 levels (24, 28, 32, ..., 100) — continuing D&D 3e pattern
2. **+HP scaling**: class hit die + CON mod per level (continuing pattern, but capped at ½ HD after level 60)
3. **+MP scaling** (casters only): continues at `2 + floor(caster ability mod / 2)` per level
4. **BAB, saves**: continue at their class rate (see tables below)
5. **Prestige ability** at milestone levels (21, 25, 30, 40, 50, 60, 70, 80, 90, 100) — path-specific
6. **Prestige equipment tier unlock** at levels 30, 40, 60, 80 (T7-T10)
7. **Prestige spell access** at levels 25, 40 (spell levels 7-8, 9 — prestige caster paths only)
8. **Without prestige**: "Veteran" generic abilities at milestones, no prestige tiers, no spell levels above 6
9. **Epic feats**: Bonus feat every 2 levels starting at 21 (21, 23, 25, ...)

#### D&D 3e Progression Tables (Extended to Level 100)

All tables continue the D&D 3e SRD patterns. BAB, saves, and HD use the same formulas at all levels — no "epic ceiling." The power curve flattens naturally because d20 bounded accuracy means diminishing returns at high levels.

##### BAB by Class Type

| Level | Full (+1/lvl) | Medium (¾) | Poor (½) | Ability Increase |
|-------|--------------|-----------|---------|-----------------|
| 1 | +1 | +0 | +0 | -- |
| 2 | +2 | +1 | +1 | -- |
| 3 | +3 | +2 | +1 | -- |
| 4 | +4 | +3 | +2 | +1 to one ability |
| 5 | +5 | +3 | +2 | -- |
| 6 | +6/+1 | +4 | +3 | -- |
| 7 | +7/+2 | +5 | +3 | -- |
| 8 | +8/+3 | +6/+1 | +4 | +1 to one ability |
| 9 | +9/+4 | +6/+1 | +4 | -- |
| 10 | +10/+5 | +7/+2 | +5 | -- |
| 11 | +11/+6/+1 | +8/+3 | +5 | -- |
| 12 | +12/+7/+2 | +9/+4 | +6/+1 | +1 to one ability |
| 13 | +13/+8/+3 | +9/+4 | +6/+1 | -- |
| 14 | +14/+9/+4 | +10/+5 | +7/+2 | -- |
| 15 | +15/+10/+5 | +11/+6/+1 | +7/+2 | -- |
| 16 | +16/+11/+6/+1 | +12/+7/+2 | +8/+3 | +1 to one ability |
| 17 | +17/+12/+7/+2 | +12/+7/+2 | +8/+3 | -- |
| 18 | +18/+13/+8/+3 | +13/+8/+3 | +9/+4 | -- |
| 19 | +19/+14/+9/+4 | +14/+9/+4 | +9/+4 | -- |
| 20 | +20/+15/+10/+5 | +15/+10/+5 | +10/+5 | +1 to one ability |

**Iterative attacks**: At BAB +6, +11, +16 and every +5 thereafter, the character gains an additional attack at −5 cumulative.

##### BAB Post-20 (Extended Pattern)

```
Full BAB:   level
Medium BAB: floor(level × 3 / 4)
Poor BAB:   floor(level / 2)
```

| Level | Full | Medium | Poor | Ability Increase |
|-------|------|--------|------|-----------------|
| 20 | +20 | +15 | +10 | +1 (5th) |
| 24 | +24 | +18 | +12 | +1 (6th) |
| 28 | +28 | +21 | +14 | +1 (7th) |
| 30 | +30 | +22 | +15 | -- |
| 32 | +32 | +24 | +16 | +1 (8th) |
| 36 | +36 | +27 | +18 | +1 (9th) |
| 40 | +40 | +30 | +20 | +1 (10th) |
| 44 | +44 | +33 | +22 | +1 (11th) |
| 48 | +48 | +36 | +24 | +1 (12th) |
| 50 | +50 | +37 | +25 | -- |
| 52 | +52 | +39 | +26 | +1 (13th) |
| 56 | +56 | +42 | +28 | +1 (14th) |
| 60 | +60 | +45 | +30 | +1 (15th) |
| 64 | +64 | +48 | +32 | +1 (16th) |
| 68 | +68 | +51 | +34 | +1 (17th) |
| 70 | +70 | +52 | +35 | -- |
| 72 | +72 | +54 | +36 | +1 (18th) |
| 76 | +76 | +57 | +38 | +1 (19th) |
| 80 | +80 | +60 | +40 | +1 (20th) |
| 84 | +84 | +63 | +42 | +1 (21st) |
| 88 | +88 | +66 | +44 | +1 (22nd) |
| 90 | +90 | +67 | +45 | -- |
| 92 | +92 | +69 | +46 | +1 (23rd) |
| 96 | +96 | +72 | +48 | +1 (24th) |
| 100 | +100 | +75 | +50 | +1 (25th) |

A level 100 Fighter has BAB +100 (21 iterative attacks at +100/+95/+90/.../+5). In practice, only the first 3-4 attacks are likely to hit high-AC enemies; the rest serve as "horde sweepers" against weaker foes.

##### Save Progression Post-20

```
Good save: 2 + floor(level / 2)
Poor save: floor(level / 3)
```

| Level | Good Save | Poor Save |
|-------|-----------|-----------|
| 1 | +2 | +0 |
| 5 | +4 | +1 |
| 10 | +7 | +3 |
| 15 | +9 | +5 |
| 20 | +12 | +6 |
| 25 | +14 | +8 |
| 30 | +17 | +10 |
| 40 | +22 | +13 |
| 50 | +27 | +16 |
| 60 | +32 | +20 |
| 70 | +37 | +23 |
| 80 | +42 | +26 |
| 90 | +47 | +30 |
| 100 | +52 | +33 |

##### Hit Points per Level

HP gained per level = class hit die roll (or average, player choice) + CON modifier.

| Class | Hit Die (d20) | Avg HP/Level (CON +0) | Level 20 HP (avg, CON +2) | Level 50 HP | Level 100 HP |
|-------|-------------|----------------------|--------------------------|-------------|-------------|
| Barbarian | d12 | 6.5 | 170 | 425 | 850 |
| Fighter | d10 | 5.5 | 150 | 375 | 750 |
| Paladin | d10 | 5.5 | 150 | 375 | 750 |
| Ranger | d8 | 4.5 | 130 | 325 | 650 |
| Cleric | d8 | 4.5 | 130 | 325 | 650 |
| Rogue | d6 | 3.5 | 110 | 275 | 550 |
| Bard | d6 | 3.5 | 110 | 275 | 550 |
| Warlock | d6 | 3.5 | 110 | 275 | 550 |
| Wizard | d4 | 2.5 | 90 | 225 | 450 |
| Sorcerer | d4 | 2.5 | 90 | 225 | 450 |

**Post-60 HP cap**: After level 60, HP gained per level is capped at `floor(hitDie / 2) + CON mod` (i.e., always average, no lucky rolls) to prevent runaway HP inflation at extreme levels.

##### Spell Slots per Day (Full Casters, Extended to Level 100)

D&D 3e spell slot tables continued by extrapolating the pattern of +1 slot per 3 levels in the highest unlocked spell level, and existing levels gaining bonus slots at milestone levels.

| Level | L0 | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| 1 | 3 | 1 | -- | -- | -- | -- | -- | -- | -- | -- |
| 3 | 4 | 2 | 1 | -- | -- | -- | -- | -- | -- | -- |
| 5 | 4 | 3 | 2 | 1 | -- | -- | -- | -- | -- | -- |
| 7 | 4 | 3 | 2 | 2 | 1 | -- | -- | -- | -- | -- |
| 9 | 4 | 3 | 3 | 2 | 2 | 1 | -- | -- | -- | -- |
| 11 | 4 | 3 | 3 | 3 | 2 | 2 | 1 | -- | -- | -- |
| 13 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | -- | -- |
| 15 | 4 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | -- |
| 17 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 2 | 1 |
| 19 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 2 |
| 20 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 25 | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 4 |
| 30 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 4 |
| 40 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 |
| 50 | 4 | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | 5 |
| 60 | 4 | 6 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 6 |
| 70 | 4 | 6 | 6 | 5 | 5 | 5 | 5 | 5 | 5 | 6 |
| 80 | 4 | 6 | 6 | 6 | 6 | 5 | 5 | 5 | 5 | 7 |
| 90 | 4 | 7 | 6 | 6 | 6 | 6 | 6 | 5 | 5 | 7 |
| 100 | 4 | 7 | 7 | 6 | 6 | 6 | 6 | 6 | 6 | 8 |

**Bonus spell slots**: High ability scores grant bonus slots per D&D 3e rules: `ability mod / 4` bonus slots at each spell level (e.g., INT 20 = +2 bonus at L1-L5).

Half-casters (Paladin, Ranger) use their character level ÷ 2 for this table (max L4 spells). 2/3 casters (Bard) use level × 2/3 (max L6 spells). Warlock uses pact slot rules (few slots, recharge at shrines).

**MP system note**: Although D&D 3e uses spell slots, this game converts to an MP pool for smoother gameplay. Each spell slot corresponds to MP: `slotMP = 2 + spellLevel × 3`. The total spell slots × slotMP = daily MP pool. Unused MP persists between encounters; restores fully at rest.

##### Ability Score Increases (D&D 3e Pattern to Level 100)

+1 to one ability score of choice every 4 levels. Total increases by level:

```
Level  4: +1 (1st increase)
Level  8: +2
Level 12: +3
Level 16: +4
Level 20: +5
Level 40: +10
Level 60: +15
Level 80: +20
Level 100: +25 total ability increases
```

This means a level 100 character has +25 total ability score increases distributed across their stats since level 1. Combined with racial bonuses and equipment, ability scores at level 100 can reach 35-40+ for primary stats.

#### Camp

The camp is the hub between dungeon runs. Available actions:

| Action | Description | Available |
|--------|-------------|-----------|
| **Party Management** | Swap active party members (4 active from roster) | Always |
| **Inventory** | Manage, equip, and compare items | Always |
| **Shop** | Buy potions, equipment, scrolls, and consumables (stock rotates daily) | Always (better in town) |
| **Trainer** | Learn spells (casters) or gain weapon proficiency XP (all classes) for gold | Always (more options in town) |
| **Promotion Hall** | Promote level 20+ characters to a prestige class (see 5.14 and Promotion Hall below) | Town only |
| **Study Scrolls** | Casters can study scroll items to permanently learn spells | Always |
| **Companion Care** | Revive fallen companions, equip companion items | Always |
| **Crafting** | Rogues can craft Trap Kits; Rangers can craft Camp Rations | Always |
| *(Auto-save)* | *(Invisible -- saves automatically on entry and on any change; no UI)* | *(Always)* |
| **Rest** | Fully heal party HP/MP (or use Camp Rations without inn) | Always |
| **Quest Board** | View daily/weekly quests and progress | Always |

#### Shop

The camp/town shop sells equipment, consumables, and scrolls. Stock depends on context:

| Shop Tab | Stock | Rotation | Price Factor |
|----------|-------|----------|-------------|
| **Weapons** | 3-5 weapons at or below party's max equipment tier | Daily seed | 1.0x (standard) |
| **Armor** | 3-5 armor pieces at or below party's max equipment tier | Daily seed | 1.0x |
| **Potions** | All potion types up to the appropriate tier | Always available | 1.0x |
| **Scrolls** | 1-3 random scrolls up to Level 3 | Daily seed | 1.5x (premium) |
| **Consumables** | Bombs, torches, lockpicks, trap kits | Always available | 1.0x |
| **Trainer** | 2-4 spell lessons + weapon proficiency manuals | Monthly seed | Varies by tier |

Town shops have better stock than camp shops: +1 equipment tier and +1 scroll slot.

Sell price: 50% of buy price. Legendary items cannot be sold (safety against accidental loss).

#### Camp Interface Layout

The camp is presented as a **horizontal menu bar** with icons across the top and a content panel below:

```
┌─────────────────────────────────────────────────────────┐
│ [Party] [Inventory] [Shop] [Trainer] [Quests] [Rest]    │
│ [Companion] [Craft] [Scrolls] [Promotion*]              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│            ← Content panel (selected tab) →             │
│                                                         │
│  * Promotion tab only visible in Town                   │
│                                                         │
│            [Return to Overworld / Dungeon]               │
└─────────────────────────────────────────────────────────┘
```

- **Mouse-only**: All camp actions via click/tap on the horizontal menu
- Camp defaults to the **Party** tab on entry
- A campfire animation plays in the background (pixel art, looped)
- Town version replaces campfire with a town square background
- The **Return** button exits camp: returns to overworld (from town) or continues to next dungeon floor (from dungeon camp)
- Auto-save triggers on camp entry and on every tab interaction that modifies state

#### Camp NPCs

At camp, the party is accompanied by persistent NPCs who provide services:

| NPC | Service | Availability |
|-----|---------|-------------|
| **Merchant Gideon** | Camp shop (buy/sell) | Always |
| **Sage Mirielle** | Trainer (spells, proficiency) | Always (reduced stock) |
| **Brother Tomas** | Rest (full heal, costs 1 Camp Ration or 50 gp) | Always |
| **Companion Keeper** | Companion care (revive, equip) | Always |
| **Town Armorer** | Better shop (+1 tier, weapons/armor focus) | Town only |
| **Town Alchemist** | Potions and scrolls (larger stock) | Town only |
| **Promotion Marshal** | Prestige promotion (see Promotion Hall) | Town only |
| **Quest Board** | View/accept quests | Always |

#### Rest Mechanic

- **Full rest**: Restore all party HP and MP to maximum. Costs 1 Camp Ration (crafted by Rangers) or 50 gp
- **Free rest**: At town inns, resting is free (inn provided)
- **Camp Rations**: Crafted by Rangers (1 Herb + 1 Ration = 1 Camp Ration). Max 5 in inventory
- Rest also: removes Fatigued/Exhausted conditions, restores per-rest abilities (Rage, Turn Undead, etc.)
- Rest does **not** restore items consumed (potions, scrolls, etc.)

#### Promotion Hall (Town Only)

The Promotion Hall is a dedicated NPC interaction in towns. The **Promotion Marshal** manages prestige class promotion.

##### Promotion Hall UI

```
┌─────────────── PROMOTION HALL ───────────────┐
│                                               │
│  Character: [Human Fighter, Lvl 20]           │
│                                               │
│  Available Prestige Paths:                    │
│  ┌─────────────────────────────────────┐      │
│  │ ⚔ Champion     [Quest: ✓] [Promote]│      │
│  │ 🗡 Weapon Master [Quest: ✗] [Locked]│      │
│  │ 🛡 Knight       [Quest: ✗] [Locked]│      │
│  └─────────────────────────────────────┘      │
│                                               │
│  Requirements for Champion:                   │
│  • Level 20+ .............. ✓                 │
│  • STR ≥ 15 ............... ✓ (STR: 18)      │
│  • Quest "Trial of Steel" . ✓ (Completed)     │
│  • 5,000 gp ............... ✓ (Have: 8,200)  │
│                                               │
│  [Promote to Champion]  [Back]                │
└───────────────────────────────────────────────┘
```

- Each base class shows its 3 prestige paths
- Paths with incomplete quests show [Locked] with a link to the quest
- Paths with all requirements met show [Promote] (clickable)
- On promotion: gold deducted, prestige class assigned, level remains unchanged
- **Promotion is irreversible** — once promoted, the character cannot change prestige path
- Characters who reach level 20 without promoting receive a **persistent reminder** icon in the camp menu
- The Promotion Hall quest board shows available prestige quests for the selected character's base class

##### Stat Allocation UI (Level-Up)

When a character levels up, a dedicated screen appears:

```
┌──────────── LEVEL UP! ────────────┐
│                                    │
│  [Portrait] Human Fighter → Lv. 5 │
│                                    │
│  +HP: 10 (d10 + CON mod)          │
│  +MP: 0                           │
│                                    │
│  Stat Points: 2                    │
│  ┌────────────────────────┐        │
│  │ STR: 14  [+] ← 1 pt   │        │
│  │ DEX: 10  [+]           │        │
│  │ CON: 12  [+] ← 1 pt   │        │
│  │ INT: 8   [+]           │        │
│  │ WIS: 10  [+]           │        │
│  │ CHA: 10  [+]           │        │
│  └────────────────────────┘        │
│  Remaining: 0                      │
│                                    │
│  NEW: Ability #2 — Cleave         │
│  NEW: Spell Level 2 access        │
│                                    │
│  [Confirm]  [Reset]               │
└────────────────────────────────────┘
```

- **No stat cap**: Stats can be raised indefinitely via points (D&D 3.5e has no inherent stat maximum)
- **+2 stat points** per level (levels 1-20), **+1 stat point** per level (levels 21-100)
- **Ability Increase**: Every 4 levels (4, 8, 12, 16, 20, 24, ...) an additional +1 to one ability score is granted **on top of** the normal stat points (this is separate and free)
- [Reset] returns points to unallocated state (only available before [Confirm])
- [Confirm] finalizes allocation — cannot be undone
- HP/MP updates shown in real-time as points are placed in CON/INT

#### Trainer

Available in towns and at camp (reduced selection at camp).

| Service | Cost | Effect |
|---------|------|--------|
| Learn Spell (Level 1) | 100 gold | Caster learns a Level 1 spell from their class schools |
| Learn Spell (Level 2) | 250 gold | Caster learns a Level 2 spell (character level 5+ required) |
| Learn Spell (Level 3) | 500 gold | Caster learns a Level 3 spell (character level 10+ required) |
| Learn Spell (Level 4) | 1000 gold | Caster learns a Level 4 spell (character level 16+ required) |
| Weapon Training | 75 gold | Grant +10 proficiency uses toward chosen weapon type |
| Advanced Weapon Training | 200 gold | Grant +25 proficiency uses (Trained+ rank required) |
| Cantrip Lesson | 150 gold | Caster learns a new cantrip |

#### User Stories & Acceptance Criteria -- Progression

**US-PROG-01**: As a player, I can see my party's XP progress and upcoming level milestones.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each party member shows current XP / XP needed for next level |
| AC2 | A progress bar visually indicates progress toward next level |
| AC3 | Upcoming unlocks (abilities, spell tiers) are listed |

**US-PROG-02**: As a player, I can allocate stat points when leveling up.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each level grants 2 stat points to distribute |
| AC2 | Points can be placed in any of the 6 core stats (STR/DEX/CON/INT/WIS/CHA) |
| AC3 | A "Confirm" button finalizes allocation (cannot be undone) |
| AC4 | HP and MP recalculate based on new CON/INT |

```gherkin
Scenario: Level up and allocate stats
  Given a Fighter reaches 100 XP (level 2)
  When the level-up screen appears
  Then I have 2 stat points to allocate
  When I place 1 in STR and 1 in CON
  And click "Confirm"
  Then STR increases by 1, CON increases by 1
  And max HP increases (CON scaling)
```

**US-PROG-03**: As a player, I can swap party members at camp from my recruited roster.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The roster shows all characters recruited across sessions |
| AC2 | I can swap any active member for a rostered one |
| AC3 | Swapped-out members retain their XP, level, and equipment |
| AC4 | Active party cannot exceed 4 members |

**US-PROG-04**: As a player, I can manage inventory and equip items at camp.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Full inventory is visible with sorting and filtering |
| AC2 | Drag-and-drop or click-to-equip both work |
| AC3 | Item comparison is shown when hovering unequipped items |

**US-PROG-05**: As a player, I can buy supplies from the camp shop.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Shop stocks potions, scrolls, and 3-5 equipment pieces |
| AC2 | Stock is seeded by date + shop ID |
| AC3 | Items too expensive are shown but grayed out |
| AC4 | Buying deducts gold; selling adds 50% value |

**US-PROG-06**: As a player, I can heal and revive companions at camp.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Resting at camp fully heals all party members and companions |
| AC2 | KO'd companions revive with 1 HP after resting |
| AC3 | A "Companion Care" section shows companion status |

**US-PROG-07**: As a player, my progress is invisibly persisted -- the game feels server-backed.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Auto-save triggers on every state transition (see 5.15 trigger table) |
| AC2 | Save is invisible -- no "Saving..." indicator, no save button, no load button |
| AC3 | Save data is JSON-serialized to `sz-tactical-realms-save` (single key) |
| AC4 | Save data includes: party, inventory, progression, current state, dungeon progress, prestige |
| AC5 | Save data size stays under 200 KB |
| AC6 | Backup copy is maintained at `sz-tactical-realms-backup` |

```gherkin
Scenario: Invisible auto-save on camp entry
  Given the player completes a dungeon
  When the game transitions to the Camp state
  Then localStorage key "sz-tactical-realms-save" is silently updated
  And the save contains all party state, inventory, prestige, and progression

Scenario: Seamless resume
  Given localStorage contains a valid save
  When the player opens the game and clicks "Continue"
  Then the game restores to the exact state from the save
  And party members have the same HP, MP, XP, equipment, and prestige class
```

**US-PROG-08**: As a player, I can view and track daily/weekly quest progress.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The quest board shows active quests with progress indicators |
| AC2 | Completed quest stages are checked off |
| AC3 | Rewards are previewed before accepting a quest |

**US-PROG-09**: As a player, I can buy progressively better equipment as my characters level up.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Shop weapon/armor tier matches the party's highest character level |
| AC2 | A level 10 party sees T4 equipment in shops |
| AC3 | Items above the party's tier never appear in shops |
| AC4 | Higher-tier items found as loot can be stored and equipped later when requirements are met |

```gherkin
Scenario: Shop stocks appropriate tier
  Given the party's highest level is 8
  When I visit the town shop
  Then weapons up to T3 (Fine, Level Req 6) are available
  And no T4 or higher weapons appear

Scenario: Loot exceeds current tier
  Given a Level 5 party finds a T4 Mithril Sword in a dungeon chest
  Then the sword goes to inventory
  But equipping it fails with "Requires Level 10"
  And the sword is saved for later
```

**US-PROG-10**: As a player, I can visit a trainer at camp or in town to learn spells or improve weapon proficiency.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The trainer shows available spells filtered by the selected character's class |
| AC2 | Already-known spells are marked "Learned" and grayed out |
| AC3 | Weapon training lists all 10 weapon types with current proficiency and cost |
| AC4 | Gold is deducted on purchase; the spell/proficiency is applied immediately |
| AC5 | Camp trainers offer a subset (2 spell options); town trainers offer more (4 options) |

```gherkin
Scenario: Buy weapon training
  Given a Fighter at Novice rank with Axe (5 / 30 uses toward Trained)
  And the player has 75 gold
  When I select "Weapon Training: Axe" at the trainer
  Then 75 gold is deducted
  And Axe use count becomes 15 / 30 (+10)

Scenario: Learn spell from trainer
  Given a Wizard at level 5 who does not know Fireball
  And a town trainer offers Fireball (Level 2, 250 gold)
  When I select "Learn Fireball"
  Then 250 gold is deducted
  And Fireball is added to the Wizard's spell list
```

**US-PROG-11**: As a player, I can see clear feedback when my characters grow stronger through leveling.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Level-up screen shows all stat changes as deltas (e.g., HP +7, MP +4) |
| AC2 | New abilities are presented with name, description, and icon |
| AC3 | Newly unlocked equipment tiers show "New: T3 equipment now available!" |
| AC4 | Spell selection (casters) highlights which schools have new options |
| AC5 | A summary of all changes is shown before confirming |

**US-PROG-12**: As a player, I can craft consumables at camp with the right class.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Rogues can craft Trap Kits at camp (costs 25 gold + 1 Dagger from inventory) |
| AC2 | Rangers can craft Camp Rations (costs 15 gold, available once per camp visit) |
| AC3 | Other classes see "Crafting: No recipes available" |
| AC4 | Crafted items go directly to inventory |

---

### 5.12 Boss Encounters

50 unique bosses organized by CR tier. Each boss has a unique arena, multi-phase AI with tactical behavior patterns, and weekly rotation (determined by `YYYY-WW` seed; same boss cannot appear two consecutive weeks).

#### Boss Roster

##### CR 5-8 — Apprentice Tier (Dungeon Floors 1-3)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 1 | **Goblin Warchief** | 5 | Goblin warren | 2 | Summons goblin waves; rallying cry (+2 attack aura to all goblins) |
| 2 | **Ettercap Broodmother** | 5 | Web-choked cavern | 2 | Web traps (difficult terrain), spider swarm summons, poison bite |
| 3 | **Bandit King** | 6 | Forest clearing fortress | 2 | Ambush reinforcements from forest edges, smoke bomb (concealment) |
| 4 | **Carrion Crawler Matriarch** | 6 | Sewer tunnels | 2 | Paralyzing tentacles (Fort DC 14), ceiling movement, acid secretion |
| 5 | **Werewolf Alpha** | 7 | Moonlit grove | 2 | Regeneration (silver bypasses), howl (summon pack), frenzy at low HP |
| 6 | **Young Black Dragon** | 7 | Acid swamp | 2 | Acid breath (line), swim through acid pools, tail sweep |
| 7 | **Wight Lord** | 8 | Barrow tomb | 2 | Energy drain (−1 level on hit), summon wight minions, create spawn |
| 8 | **Umber Hulk Tunneler** | 8 | Collapsed mine | 2 | Confusing Gaze (Will DC 16), burrow/ambush, collapse ceiling tiles |

##### CR 9-12 — Journeyman Tier (Dungeon Floors 4-6)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 9 | **Beholder** | 9 | Circular chamber | 2 | Random eye ray each turn, anti-magic cone |
| 10 | **Medusa Queen** | 9 | Statue garden | 2 | Petrifying Gaze (Fort DC 17), snake hair attacks, shatter petrified allies |
| 11 | **Frost Giant Jarl** | 10 | Ice throne hall | 2 | Boulder throw, ground slam (ice tiles), winter wolf companion |
| 12 | **Mind Flayer Elder** | 10 | Underdark cavern | 3 | Mass mind blast, brain drain (stat steal), thrall control |
| 13 | **Vampire Lord** | 11 | Gothic castle | 3 | Mist form (invulnerable phase), bat swarm, charm |
| 14 | **Iron Golem** | 11 | Forge chamber | 2 | Immune to magic, reflects spells, ground slam AoE |
| 15 | **Aboleth** | 12 | Flooded temple | 2 | Enslave party member, psychic blast, mucous cloud |
| 16 | **Hydra** | 12 | Swamp pool | 2 | Regrows heads (more attacks per turn), acid spit |

##### CR 13-16 — Veteran Tier (Dungeon Floors 7-9)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 17 | **Death Knight** | 13 | Haunted battlefield | 3 | Abyssal blast (AoE), raise dead soldiers, unholy aura |
| 18 | **Rakshasa Maharaja** | 13 | Illusory palace | 3 | Immune to spells ≤6th, mirror images, dominate person |
| 19 | **Purple Worm** | 14 | Desert sink hole | 2 | Swallow whole, burrow emergence, tail stinger (poison) |
| 20 | **Storm Giant** | 14 | Cloud fortress | 3 | Call lightning, wind wall (deflects ranged), thunder clap AoE |
| 21 | **Nalfeshnee** | 14 | Abyssal rift | 2 | Horror nimbus (Will DC 18), teleport, unholy smite |
| 22 | **Nightwalker** | 15 | Shadow plane breach | 3 | Finger of death, crush (AoE darkness), gaze of despair |
| 23 | **Beholder Hive Mother** | 15 | Eye tyrant lair | 3 | Controls 3 mini-beholders, combined eye ray volleys, anti-magic pulse |
| 24 | **Adult Red Dragon** | 16 | Volcanic caldera | 3 | Breath weapon (cone), wing buffet, frightful presence, lava surge |

##### CR 17-20 — Champion Tier (Dungeon Floors 10-12)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 25 | **Lich King** | 17 | Necropolis throne | 3 | Phylactery must be destroyed, summons undead waves, power word kill |
| 26 | **Pit Fiend** | 17 | Infernal gate | 3 | Fear aura, hellfire wall, summon devil minions |
| 27 | **Balor (Demon Lord)** | 18 | Hellfire pit | 3 | Fire whip, vorpal sword, fire damage aura, death throes explosion |
| 28 | **Kraken** | 18 | Submerged temple | 3 | Tentacle grapple (multiple), ink cloud, lightning storm, whirlpool |
| 29 | **Marilith** | 18 | Abyssal war camp | 3 | 6-sword multiattack, reactive parry, teleport, blade barrier |
| 30 | **Ancient Blue Dragon** | 19 | Desert storm spire | 3 | Lightning breath (line), sandstorm (concealment), wing-created cyclone |
| 31 | **Ancient Green Dragon** | 19 | Poison forest heart | 3 | Poison breath (cone), charm/dominate, vine entangle, miasma cloud |
| 32 | **Demilich** | 20 | Trapped reliquary | 2 | Howl (AoE soul trap), soul gems (buff self), immune to almost everything |

##### CR 21-25 — Epic Tier (Dungeon Floors 13-15)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 33 | **Ancient Red Dragon** | 21 | Mountain peak | 4 | Flight phases, breath weapon charges, tail sweep, lair actions |
| 34 | **Dracolich** | 21 | Bone cathedral | 3 | Dragon abilities + undead immunities + phylactery |
| 35 | **Solar** | 22 | Celestial court | 3 | Slaying longbow, healing aura, holy word, blinding radiance |
| 36 | **Elder Brain** | 22 | Mind Flayer colony | 3 | Psychic scream (mass), dominate multiple targets, tentacle network |
| 37 | **Archdevil (Mephistopheles)** | 23 | Cania frozen waste | 4 | Hellfire (cold+fire), contract bargain mechanic, reshape arena, summon devils |
| 38 | **Empyrean** | 23 | Titan's colosseum | 3 | Bolt (lightning/fire), trembling strike (earthquake), divine buff/debuff |
| 39 | **Aspect of Tiamat** | 24 | Dragon god temple | 4 | 5 breath weapons (1 per head), legendary actions, frightful presence, divine magic |
| 40 | **Marut** | 25 | Mechanus court | 2 | Unerring slam (auto-hit), plane shift banish, immune to most conditions |

##### CR 26-30 — Mythic Tier (Dungeon Floors 16+)

| # | Boss | CR | Arena | Phases | Key Mechanic |
|---|------|----|-------|--------|--------------|
| 41 | **Tarrasque** | 30 | Ruined city | 4 | Massive HP, reflects ranged, swallow whole, regeneration |
| 42 | **Atropal** | 26 | Negative energy plane | 3 | Life drain aura, negative energy burst, summon wraiths |
| 43 | **Hecatoncheires** | 27 | Titan prison | 3 | 100 arms: massive multiattack, throw boulders, grapple multiple |
| 44 | **Ssendam (Slaad Lord)** | 28 | Limbo rift | 4 | Chaos warp (randomize terrain), shapeshift, reality distortion |
| 45 | **Elder Evil: Pandorym** | 28 | Void breach | 4 | Antimagic body, mind-shattering aura, world-ending detonation phase |
| 46 | **Lolth (Avatar)** | 29 | Demonweb Pits | 4 | Spider swarms, web maze, dominate (Will DC 28), darkness, shapeshift |
| 47 | **Orcus (Avatar)** | 29 | Thanatos throne | 4 | Wand of Orcus (instant death Fort DC 30), undead army, necrotic storm |
| 48 | **Asmodeus (Avatar)** | 30 | Nine Hells core | 4 | Alter reality, hellfire storm, contract trap, summon archdevils |
| 49 | **Vecna (Avatar)** | 30 | Citadel Cavitius | 4 | Eye/Hand artifacts, spellcasting at will, secrets (reveal weaknesses to exploit), undead legion |
| 50 | **Ao's Test (The Overgod Trial)** | 30 | Astral void | 5 | Mirrors party abilities, scales to party level +5, divine judgment phases |

#### Boss Multi-Turn Tactical AI

Every boss follows a **multi-turn tactical decision tree** rather than simple single-action patterns. Each turn, the boss evaluates its available abilities, the battlefield state, and its current phase to select an optimal action sequence.

##### AI Decision Priority (evaluated top-to-bottom each turn)

```
function bossTurnAI(boss, battlefield) {
  // 1. Phase transition check
  if (boss.hp <= boss.phaseThresholds[boss.currentPhase])
    return executePhaseTransition(boss);

  // 2. Self-preservation
  if (boss.hp < 25% && boss.hasAbility('heal/shield/mist-form'))
    return executeDefensiveAction(boss);

  // 3. Counter-strategy (react to party composition)
  if (partyHasActiveBuff())
    return dispelOrDebuff(highestThreatTarget());
  if (partyIsClustered())
    return useAoE(bestAoEAbility());

  // 4. Buff cycle (if no active buffs and not urgent)
  if (!boss.hasActiveBuff() && boss.phase > 1)
    return selfBuff(boss);

  // 5. Tactical combo execution
  return executeTacticalCombo(boss, battlefield);
}
```

##### Multi-Turn Combo Patterns

Bosses maintain a **combo state machine** that tracks their current tactical sequence:

| Combo Pattern | Turn 1 | Turn 2 | Turn 3 | Used By |
|---------------|--------|--------|--------|---------|
| **Buff → Debuff → Strike** | Cast self-buff (e.g., Haste, Shield, Mirror Image) | Debuff highest-threat target (e.g., Slow, Blind, Curse) | Full attack on debuffed target | Lich King, Rakshasa, Demilich, Vecna |
| **Summon → Position → AoE** | Summon minions to block chokepoints | Reposition to maximize AoE coverage | Unleash AoE on clustered party | Demon Lord, Pit Fiend, Lolth, Orcus |
| **Debuff → Isolate → Execute** | Mass debuff (Fear, Confusion, Darkness) | Target isolated/debuffed character | Power attack / power word kill | Mind Flayer Elder, Nightwalker, Vampire Lord |
| **Tank → Punish → Heal** | Defensive stance / raise AC | Counter-attack anyone who attacked this turn (AoO) | Self-heal or regenerate | Iron Golem, Tarrasque, Hydra, Marut |
| **Kite → Blast → Retreat** | Move to max range | Ranged/spell attack | Move behind cover or minions | Beholder, Storm Giant, Ancient Blue Dragon |
| **Lockdown → Drain → Overwhelm** | AoE control (Web, Entangle, Wall) | Drain resources (mana burn, ability damage) | Press weakened party with full offense | Aboleth, Elder Brain, Pandorym |
| **Shapeshift → Adapt → Exploit** | Change form to counter party's strongest type | Adapt resistances/immunities | Exploit newly-created weakness | Ssendam, Lolth, Empyrean |

##### Phase-Specific Behavior Escalation

Each boss phase unlocks new tactical options:

| Phase | HP Threshold | AI Behavior Change |
|-------|-------------|-------------------|
| **Phase 1** | 100%-76% | Uses basic attacks + signature ability. Tests party composition. Conservative buff usage |
| **Phase 2** | 75%-51% | Unlocks combo patterns. Begins summoning minions. Uses debuffs reactively |
| **Phase 3** | 50%-26% | Full combo execution. Arena hazards activate. Legendary actions (1/round extra action) |
| **Phase 4** | 25%-1% | Desperation mode: double action economy, strongest abilities off cooldown, enrage (+4 attack/damage) |
| **Phase 5** (Mythic only) | Below 10% | Last stand: unique ultimate ability, all resistances active, 2 legendary actions/round |

##### Boss Reaction System

Bosses have **reactive triggers** that fire outside their normal turn:

| Trigger | Reaction | Example |
|---------|----------|---------|
| Party member casts a spell | Counterspell (if available) or Spell Resistance check | Lich King counterspells Heal, Rakshasa ignores low-level spell |
| Party member heals an ally | Target the healer next turn (threat priority shift) | All bosses: healer becomes priority 1 |
| Party clusters (3+ in adjacent tiles) | Queue AoE for next turn | Dragon queues breath weapon, Balor queues fire whip sweep |
| Boss takes >25% max HP in single hit | Enrage: +2 attack, +1d6 damage for 2 rounds | Tarrasque, Hydra, Barbarian-type bosses |
| Party attempts to flee/retreat | Block escape routes or pursue | Vampire mist-blocks door, Kraken tentacle-blocks exits |
| Minions all defeated | Fury phase: skip buff turns, pure offense | Goblin Warchief, Beholder Hive Mother |

##### Boss Ability Cooldown System

Every boss ability has a cooldown measured in turns. The AI tracks cooldowns and will not attempt to use an ability that is still on cooldown:

| Ability Type | Base Cooldown | Phase 1-2 Modifier | Phase 3-4 Modifier | Phase 5 (Mythic) |
|-------------|--------------|--------------------|--------------------|------------------|
| Basic attack | 0 (no cooldown) | -- | -- | -- |
| Signature ability | 3 rounds | 3 rounds | 2 rounds | 1 round |
| AoE attack | 4 rounds | 4 rounds | 3 rounds | 2 rounds |
| Summon minions | 5 rounds | 5 rounds | 4 rounds | 3 rounds |
| Self-buff | 4 rounds (or until buff expires) | 4 rounds | 3 rounds | 2 rounds |
| Self-heal | 6 rounds | 6 rounds | 4 rounds | 3 rounds |
| Ultimate ability | 8 rounds | Locked (phase 3+) | 6 rounds | 4 rounds |
| Reaction (counterspell, etc.) | 2 rounds | 2 rounds | 1 round | 0 (every round) |

```js
boss.cooldowns = new Map(); // ability_id → rounds remaining

function bossTick(boss) {
  // Decrement all cooldowns at start of boss turn
  for (const [id, cd] of boss.cooldowns)
    if (cd > 0) boss.cooldowns.set(id, cd - 1);
    else boss.cooldowns.delete(id);
}

function canUseAbility(boss, ability) {
  if (boss.cooldowns.has(ability.id)) return false;
  if (ability.phaseMin && boss.currentPhase < ability.phaseMin) return false;
  if (ability.mpCost && boss.currentMp < ability.mpCost) return false;
  return true;
}

function useAbility(boss, ability) {
  const cooldown = ability.baseCooldown - boss.cooldownReduction; // phase modifier
  boss.cooldowns.set(ability.id, Math.max(1, cooldown));
  // execute ability...
}
```

##### Conditional Ability Usage

Bosses only use abilities when tactically optimal:

```
// Boss won't waste AoE on a single target
if (ability.isAoE && targetsInRange < 2)
  skip(ability);

// Boss won't self-buff if already buffed
if (ability.isBuff && boss.hasActiveBuff(ability.buffType))
  skip(ability);

// Boss saves high-cost abilities for later phases
if (ability.isUltimate && boss.phase < 3)
  skip(ability);

// Boss prioritizes dispel when party has strong buffs active
if (partyBuffCount() >= 3 && boss.hasAbility('dispel'))
  prioritize('dispel');

// Boss uses heal only when below threshold and no better option
if (boss.hp > 50% || boss.canOneShot(weakestTarget()))
  skip('heal');
```

#### Phase Transitions

- Boss changes behavior at HP thresholds (75%, 50%, 25%; some bosses also at 10%)
- New attack patterns and combo sequences unlocked per phase
- Visual arena changes (floor cracking, fire spreading, flooding, etc.)
- Some bosses summon reinforcements between phases
- Phase transition is a free action: cannot be interrupted, delayed, or skipped
- 1-2 second cinematic plays during transition (boss gains temporary invulnerability)

#### Boss Loot Tables

Each boss drops 2-3 unique items from their personal loot table, plus standard CR-appropriate gold and XP. Boss-specific items scale with the boss's CR tier and cannot be found anywhere else.

| Boss Tier | CR Range | Unique Drop Rarity | Drop 1 Chance | Drop 2 Chance | Drop 3 Chance | Bonus Gold | Bonus XP |
|-----------|---------|-------------------|---------------|---------------|---------------|-----------|----------|
| Apprentice | 5-8 | Rare (blue) | 40% | 35% | 30% | CR × 50 | CR × 200 |
| Journeyman | 9-12 | Epic (purple) | 40% | 35% | 30% | CR × 80 | CR × 300 |
| Veteran | 13-16 | Legendary (orange) | 35% | 30% | 25% | CR × 100 | CR × 400 |
| Champion | 17-20 | Legendary (orange) | 35% | 30% | 25% | CR × 120 | CR × 500 |
| Epic | 21-25 | Legendary (orange) | 30% | 25% | 20% | CR × 150 | CR × 600 |
| Mythic | 26-30 | Legendary (orange) | 25% | 20% | 15% | CR × 200 | CR × 800 |

Nightmare difficulty adds +15% to all drop chances (see Nightmare Risk/Reward Balance).

##### Apprentice Tier Loot (CR 5-8)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Goblin Warchief** | Warchief's Crown (helmet, +2 CHA, rally cry 1/combat: +1 attack to party for 3 rounds) | Goblin-Tooth Necklace (accessory, +1d6 sneak attack vs flanked) | Warchief's Cleaver (+2 axe, +1d6 vs small creatures) |
| **Ettercap Broodmother** | Broodmother's Spinnerets (accessory, web 1/combat: DC 14 Reflex) | Venomfang Dagger (+2 dagger, poison 1d4 CON, Fort DC 14) | Spider-Silk Cloak (+2 AC, +4 vs entangle/web effects) |
| **Bandit King** | Bandit King's Rapier (+2 sword, +2 Initiative, +1d6 vs flat-footed) | Coin Purse of Holding (accessory, +25% gold from all sources) | Smoke Bomb Belt (accessory, 3/day: concealment in 2-tile radius) |
| **Carrion Crawler Matriarch** | Paralytic Tentacle Whip (+2 flail, paralyze on crit Fort DC 14) | Crawler Carapace (+4 AC, immune to acid) | Matriarch's Eye (accessory, darkvision 60ft, +2 vs ambush) |
| **Werewolf Alpha** | Moonsilver Fang (+2 sword, +1d6 vs shapechangers, silver) | Alpha's Pelt Cloak (+3 AC, regenerate 1 HP/round, vulnerability to silver) | Howling Amulet (accessory, 1/combat: summon 2 wolves for 3 rounds) |
| **Young Black Dragon** | Acidblood Spear (+2 spear, +1d6 acid, acid splash on crit) | Dragonhide Buckler (+2 AC, acid resistance 10) | Hatchling's Fang (accessory, +2 CON, acid breath 1/day: 2d6 cone) |
| **Wight Lord** | Barrow Blade (+2 sword, energy drain on crit: −1 level, Fort DC 16 negates) | Crown of the Barrow (+3 AC, immune to energy drain) | Death's Grasp Ring (accessory, 1/combat: animate dead, raise 1 fallen enemy) |
| **Umber Hulk Tunneler** | Hulk Claw Gauntlets (+2 warhammer, Sunder at +4, +2 STR) | Tunneler's Carapace (+5 AC, immune to confusion) | Tremorsense Amulet (accessory, tremorsense 30ft, +2 Initiative underground) |

##### Journeyman Tier Loot (CR 9-12)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Beholder** | Eye of the Beholder (accessory, +4 INT, 1/day: Antimagic Cone 3 rounds) | Beholder Scale Shield (+4 AC, reflect 1 spell/combat) | Crown of Eyes (helmet, darkvision 120ft, +2 all saves vs spells) |
| **Medusa Queen** | Gorgon's Gaze Mirror (shield, +3 AC, 1/combat: reflect gaze attack) | Petrified Heart (accessory, +4 CON, immune to petrification) | Serpent-Hair Whip (+3 flail, poison 1d6 DEX, Fort DC 17) |
| **Frost Giant Jarl** | Jarlsbane (+3 axe, +2d6 cold, Frost Nova on crit: 10ft AoE cold) | Jarl's Ice Crown (helmet, cold immunity, +2 STR) | Glacial Plate (+7 AC, cold immunity, −2 Initiative) |
| **Mind Flayer Elder** | Crown of the Elder Brain (helmet, +6 INT, Mind Blast 1/combat) | Tentacle Rod (+3 mace, 4 attacks/round, grapple on hit) | Psionic Robes (+4 AC, SR 20, immune to mind-affecting) |
| **Vampire Lord** | Crimson Fang (+3 dagger, life steal 50% damage, +2 DEX) | Cloak of the Night (accessory, greater invisibility 1/combat, +4 Hide) | Blood Chalice (accessory, killing blow restores 50% max HP) |
| **Iron Golem** | Adamantine Full Plate (+8 AC, DR 10/adamantine, immune to crits) | Golem Fist (+3 warhammer, +2d6 damage, Sunder on hit) | Clockwork Heart (accessory, +4 CON, immune to poison/disease) |
| **Aboleth** | Mucus Orb (accessory, underwater breathing, dominate 1 creature 1/combat) | Aboleth-Skin Cloak (+3 AC, slippery: immune to grapple, +4 escape) | Trident of the Deep (+3 spear, +2d6 vs land creatures, waterbreathing) |
| **Hydra** | Hydra-Scale Armor (+6 AC, regenerate 3 HP/round) | Ring of Regeneration (accessory, regenerate 2 HP/round) | Multi-Head Helm (helmet, +3 AC, 1 extra AoO/round) |

##### Veteran Tier Loot (CR 13-16)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Death Knight** | Runeblade of the Fallen (+4 sword, +2d6 necrotic + 1d6 unholy, frightful presence) | Death Knight's Shield (+5 AC, DR 5/good, death ward 1/day) | Abyssal Circlet (helmet, +4 CHA, command undead 3/day) |
| **Rakshasa Maharaja** | Claw of Deception (+4 dagger, +3d6 vs flat-footed, disguise self at will) | Robes of the Maharaja (+5 AC, immune to spells ≤3rd level) | Third Eye Gem (accessory, true seeing 1/combat, +4 WIS) |
| **Purple Worm** | Worm Fang Spear (+4 spear, +2d6 poison Fort DC 18, burrow 1/combat) | Worm Scale Armor (+8 AC, acid/poison resistance 15) | Gullet Stone (accessory, swallowed items return, +4 CON) |
| **Storm Giant** | Stormcaller (+4 warhammer, +2d6 lightning, call lightning 1/combat) | Storm Giant Girdle (accessory, +4 STR, immune to lightning) | Thunderhead Crown (helmet, wind wall 1/combat, +2 all saves) |
| **Nalfeshnee** | Dread Cleaver (+4 axe, +2d6 unholy, horror nimbus on crit) | Abyssal Hide (+7 AC, DR 10/good, fire/lightning resistance 10) | Demon's Third Eye (accessory, true seeing 1/combat, +4 INT) |
| **Nightwalker** | Nightsword (+4 sword, +3d6 necrotic, finger of death 1/combat) | Shadow Mantle (+6 AC, concealment 20%, immune to death effects) | Void Heart (accessory, negative energy immunity, −2 CHA) |
| **Beholder Hive Mother** | Greater Eye of the Beholder (accessory, +6 INT, 2 eye rays/combat) | Hive Mother Carapace (+8 AC, SR 25, reflect 1 spell/round) | Optic Nerve Crown (helmet, darkvision 120ft, dominate 1/combat) |
| **Adult Red Dragon** | Red Dragon Fang (+4 sword, +2d6 fire, fire immunity) | Red Dragon Scale Armor (+8 AC, fire immunity, −1 check penalty) | Dragon's Breath Amulet (accessory, breath weapon 1/combat: 6d6 fire cone) |

##### Champion Tier Loot (CR 17-20)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Lich King** | Lich's Phylactery (accessory, auto-revive once per dungeon at full HP) | Staff of the Lich (+5 staff, +4 spell DC, necrotic spells heal you) | Death's Embrace (armor, +8 AC, immune to death effects/energy drain) |
| **Pit Fiend** | Hellforged Greatsword (+5 sword, +2d6 fire + 1d6 unholy, Fear on crit) | Infernal Aegis (+10 AC, DR 10/good, fire/poison immunity) | Contract of the Damned (accessory, +4 CHA, 1/combat: Gate a devil ally for 3 rounds) |
| **Balor** | Balor's Vorpal Whip (+5 flail, threat range 17-20, vorpal on nat 20) | Abyssal Plate (+10 AC, fire/poison immunity, −2 CHA) | Balor's Wings (accessory, permanent flight, +2d6 fire aura) |
| **Kraken** | Kraken's Maw (+5 spear, +3d6 cold, grapple on hit) | Abyssal Tideplate (+10 AC, waterbreathing, freedom of movement) | Stormcaller's Pearl (accessory, call lightning storm 1/combat, +4 WIS) |
| **Marilith** | Hexblade Array (+5 sword, 2 extra attacks/round) | Serpent Queen's Coils (+8 AC, immune to grapple, reactive parry 1/round) | Six-Armed Amulet (accessory, +4 DEX, blade barrier 1/combat) |
| **Ancient Blue Dragon** | Stormfang (+5 spear, +3d6 lightning, call lightning 1/combat) | Blue Dragon Scale Armor (+10 AC, lightning immunity) | Thundercrown (helmet, +4 Initiative, +2 all saves) |
| **Ancient Green Dragon** | Venomblade (+5 sword, +3d6 poison, charm on crit Will DC 22) | Green Dragon Scale Armor (+10 AC, poison immunity, +4 Hide) | Miasma Orb (accessory, poison cloud 1/combat: 15ft radius, 4d6 poison) |
| **Demilich** | Soul Gem Scepter (+5 staff, trap soul 1/combat Fort DC 24) | Demilich Crown (helmet, +8 INT, immune to all conditions) | Bone Phylactery (accessory, auto-revive at 1 HP 1/day, −1 level) |

##### Epic Tier Loot (CR 21-25)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Ancient Red Dragon** | Dragonslayer Blade (+5 sword, +3d6 fire, fire immunity) | Red Dragon Scale Armor (+12 AC, fire immunity, −1 check penalty) | Dragon's Hoard Ring (accessory, +50% gold from all sources) |
| **Dracolich** | Dragonfang Staff (+5 staff, +4d6 necrotic, animate dead 1/combat) | Bone Dragon Plate (+12 AC, cold/necrotic immunity, frightful presence) | Phylactery Shard (accessory, −1 level on death instead of −1 level on resurrection) |
| **Solar** | Solaris (+5 bow, +3d6 radiant, slaying arrow 1/combat) | Celestial Plate (+12 AC, DR 15/evil, radiant immunity) | Halo of the Solar (helmet, +6 WIS, heal 50 HP 1/combat) |
| **Elder Brain** | Mind's Eye Scepter (+5 staff, +4 spell DC, dominate 1/combat no save) | Thought Shield Diadem (helmet, +6 INT, immune to psychic/mind-affecting) | Neural Web Cloak (+6 AC, telepathy 120ft, detect thoughts at will) |
| **Archdevil (Mephistopheles)** | Cania's Fury (+5 staff, +3d6 fire + 3d6 cold, hellfire storm 1/combat) | Archdevil's Raiment (+12 AC, DR 15/good+silver, fire/cold immunity) | Infernal Contract (accessory, +6 CHA, wish 1/week with devil's bargain drawback) |
| **Empyrean** | Titan's Mace (+5 warhammer, +4d6 thunder, earthquake on crit) | Empyrean Aegis (+12 AC, DR 10/epic, +4 all saves) | Belt of Titan's Might (accessory, +6 STR, enlarge person at will) |
| **Aspect of Tiamat** | Pentachromatic Blade (+5 sword, +1d6 each: fire/cold/lightning/acid/poison) | Tiamat's Scale (+14 AC, resist 20 all energy types) | Crown of the Dragon Queen (helmet, 5 breath weapons 1/day each) |
| **Marut** | Inevitable Fist (+5 warhammer, auto-hit 1/combat, +4d6 thunder) | Mechanus Plate (+14 AC, immune to all conditions) | Seal of the Marut (accessory, plane shift 1/day, +4 to all saves) |

##### Mythic Tier Loot (CR 26-30)

| Boss | Unique Drop 1 (40%) | Unique Drop 2 (35%) | Unique Drop 3 (30%) |
|------|---------------------|---------------------|---------------------|
| **Tarrasque** | Tarrasque Claw (+5 axe, +4d6 damage, ignore DR, threat 18-20) | Tarrasque Hide (+14 AC, DR 15/epic, reflect spells) | Heart of the Tarrasque (accessory, regenerate 10 HP/round, immune to death effects) |
| **Atropal** | Stillborn Scepter (+5 staff, +4d6 necrotic, death aura 10ft: 2d6/round) | Shroud of Unlife (+8 AC, negative energy immunity, undead immunities) | Atropal's Tear (accessory, +6 WIS, raise dead at will on enemies as undead) |
| **Hecatoncheires** | Hundred-Armed Gauntlets (+5 warhammer, 6 attacks/round) | Titan Prison Plate (+16 AC, DR 20/epic, immune to grapple) | Atlas Stone (accessory, +8 STR, can lift/throw terrain objects as weapons) |
| **Ssendam (Slaad Lord)** | Entropy Blade (+5 sword, random energy type each hit, chaos warp on crit) | Slaad Lord's Hide (+10 AC, change shape 1/round, immune to polymorph) | Chaos Gem (accessory, 1/round: reroll any d20 roll, keep either result) |
| **Elder Evil: Pandorym** | Void Blade (+5 sword, +4d6 force, antimagic strike 1/combat) | Pandorym's Shell (+14 AC, immune to magic, DR 20/epic) | Void Heart (accessory, 1/combat: antimagic field 3 rounds centered on self) |
| **Lolth (Avatar)** | Spider Queen's Fang (+5 dagger, +3d6 poison, dominate 1/combat) | Demonweb Plate (+14 AC, immune to web/entangle, spider climb) | Lolth's Blessing (accessory, +6 DEX, summon drider army 1/dungeon) |
| **Orcus (Avatar)** | Wand of Orcus Shard (+5 mace, death touch 1/combat Fort DC 30) | Orcus Plate (+14 AC, undead immunities, command undead at will) | Skull of Orcus (helmet, +6 WIS, animate dead army 1/dungeon) |
| **Asmodeus (Avatar)** | Ruby Rod Shard (+5 staff, +6 spell DC, wish 1/day) | Archfiend's Raiment (+16 AC, DR 20/good+epic, all immunities) | Asmodeus's Seal (accessory, +6 all stats, contract: lose 1 level on death) |
| **Vecna (Avatar)** | Eye of Vecna (accessory, +8 INT, true seeing, death gaze 1/combat, −2 WIS) | Hand of Vecna (accessory, +8 STR, death touch 1/combat, −2 WIS) | Book of Vile Darkness (accessory, +4 all spell DCs, corrupt: −1 CHA/week) |
| **Ao's Test** | Mirror of Perfection (accessory, copy any party member's best stat) | Overgod's Token (accessory, 1/day: auto-succeed any roll) | Astral Crown (helmet, +4 all stats, immune to divine magic) |

#### User Stories & Acceptance Criteria -- Bosses

**US-BOSS-01**: As a player, I can see which boss is active this week before entering the dungeon.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Title screen shows the boss name, portrait, and arena name |
| AC2 | Boss is determined by `YYYY-WW` seed |
| AC3 | The same boss does not appear two consecutive weeks |

**US-BOSS-02**: As a player, I can experience unique boss arenas with distinct visuals.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each boss arena has unique terrain tiles and background |
| AC2 | The arena size matches the boss's combat style (large for Dragon, small for Beholder) |
| AC3 | Arena-specific terrain types affect combat (lava in Hellfire Pit, water in Flooded Temple) |

**US-BOSS-03**: As a player, I can observe boss phase transitions with visual and mechanical changes.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Phase transition triggers at HP thresholds (75%, 50%, 25%) |
| AC2 | A 1-2 second animation plays (screen flash, arena change) |
| AC3 | The boss gains new abilities listed in the boss HP bar tooltip |
| AC4 | Phase transitions cannot be interrupted or skipped |

```gherkin
Scenario: Dragon phase transition at 50% HP
  Given the Ancient Dragon has 120 max HP and currently has 61 HP
  When the party deals 2 damage (dropping to 59 HP, below 50%)
  Then a phase transition animation plays
  And the boss enters Phase 2
  And the breath weapon gains a wider cone pattern
  And the arena floor cracks with lava tiles appearing
```

**US-BOSS-04**: As a player, I must adapt strategy as the boss unlocks new abilities in later phases.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Phase 2+ abilities are stronger or cover more area than Phase 1 |
| AC2 | Some phases add environmental hazards (lava, poison clouds) |
| AC3 | Some phases summon minion reinforcements |

**US-BOSS-05**: As a player, I receive unique loot from boss kills (boss-specific drops).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each boss has a loot table with 2-3 unique items (not found elsewhere) |
| AC2 | Drop rates for boss-specific items are 30-50% per item |
| AC3 | Boss loot is Epic or Legendary rarity |

**US-BOSS-06**: As a player, I cannot retreat from a boss encounter.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The "Retreat" option is disabled / hidden during boss combat |
| AC2 | A tooltip explains "Cannot retreat from boss encounters" |

---

### 5.13 Monetization / Entitlement System

Architecture prepared for a future pay/entitlement service. Currently stubbed to return "all unlocked."

#### Content Tiers

| Tier | Content | Access |
|------|---------|--------|
| **Free** | Human, Elf, Dwarf, Halfling, Half-Orc, Gnome | Always available |
| **Free** | Fighter, Wizard, Cleric, Rogue, Ranger, Paladin, Barbarian | Always available |
| **Free** | Standard dungeons, base equipment, core game loop | Always available |
| **Premium Race** | Tiefling, Dragonborn | Entitlement OR seasonal free window |
| **Premium Class** | Bard, Warlock, Sorcerer | Entitlement required |
| **Expansion** | Additional dungeon themes, boss encounters, equipment sets, overworld biomes | Entitlement required |
| **Cosmetic** | Character skins, companion skins, equipment visual variants | Entitlement required |
| **Convenience** | XP boosters, loot-find boosters, extra daily rerolls | Entitlement required |

#### EntitlementService Interface

```js
class EntitlementService {
  // Returns true if the player owns the given content ID
  async isEntitled(contentId) { /* stub: returns true */ }

  // Returns list of all content IDs the player owns
  async getEntitlements() { /* stub: returns ALL content IDs */ }

  // Check if content is currently in a free seasonal window
  isSeasonallyFree(contentId, date) { /* checks seasonal calendar */ }
}
```

**Design principle**: No gameplay advantage that cannot be earned through play. Pay-to-progress, not pay-to-win. All premium gameplay content (races, classes) has a free access window during seasons. Cosmetics and convenience items are purely optional.

#### User Stories & Acceptance Criteria -- Entitlements

**US-ENT-01**: As a free player, I can access all core races, classes, and the full game loop.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The 6 free races are always available in the roster pool |
| AC2 | The 7 free classes are always available |
| AC3 | All dungeon types, combat, and progression work without entitlements |
| AC4 | No core gameplay mechanic requires premium access |

**US-ENT-02**: As a free player, I can play premium races during their seasonal free window.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | `isSeasonallyFree("dragonborn", date)` returns true during Jun-Aug |
| AC2 | `isSeasonallyFree("tiefling", date)` returns true during Sep-Feb |
| AC3 | During the free window, seasonal races enter the roster pool normally |

```gherkin
Scenario: Dragonborn available in summer
  Given the date is July 15 (Summer)
  When isSeasonallyFree("dragonborn", "2026-07-15") is called
  Then it returns true
  And Dragonborn can appear in the daily roster

Scenario: Dragonborn locked in winter without entitlement
  Given the date is January 10 (Winter)
  And isEntitled("dragonborn") returns false
  When isSeasonallyFree("dragonborn", "2026-01-10") is called
  Then it returns false
  And Dragonborn cannot appear in the roster
```

**US-ENT-03**: As a premium player, I can access premium races and classes year-round.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | `isEntitled("tiefling")` returns true for premium players |
| AC2 | Entitled content bypasses the seasonal check |
| AC3 | Premium races/classes enter the roster pool in every daily rotation |

**US-ENT-04**: As a developer, I can swap the EntitlementService stub for a real backend without changing game code.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | All entitlement checks go through the `EntitlementService` interface |
| AC2 | No game module directly checks entitlement status via hardcoded logic |
| AC3 | The stub is injected via a single configuration point |
| AC4 | Swapping the implementation requires changing only the service class |

**US-ENT-05**: As a player, I never encounter a pay-wall that blocks core gameplay progression.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The main quest chain and standard dungeons are always accessible |
| AC2 | Premium content is additive (new options, not gates) |
| AC3 | No equipment or power level is exclusive to premium (can be earned through play) |

---

### 5.14 Prestige Class System

At level 20, characters become eligible for **prestige promotion** at any town's Promotion Hall. A prestige class is a specialization that replaces the base class's level-up path with a more focused progression. Characters who do not promote continue as "Veterans" -- they still gain levels (up to 100) but receive weaker generic abilities instead of prestige-specific ones.

#### Promotion Requirements

| Requirement | Details |
|-------------|---------|
| **Minimum Level** | 20 (base class) |
| **Location** | Town Promotion Hall (not available at camp) |
| **Gold Cost** | 5,000 gp (all paths; see 5.16 Gold Economy — Gold Sinks) |
| **Prerequisite Quest** | Each prestige path has a one-time unlock quest (fetch/kill/explore) |
| **Stat Minimum** | Primary stat for the prestige path must be >= 15 |

#### Prestige Paths by Base Class

Each base class offers 3 prestige specializations. The character chooses one path permanently upon promotion.

| Base Class | Prestige Path 1 | Prestige Path 2 | Prestige Path 3 |
|------------|-----------------|-----------------|-----------------|
| **Fighter** | **Champion** (raw power, crit mastery) | **Weapon Master** (all weapon proficiency, technique combos) | **Knight** (heavy armor, shield wall, party defense) |
| **Wizard** | **Archmage** (Level 5-6 spells, reduced MP costs) | **Battle Mage** (medium armor casting, melee+spell combos) | **Necrolord** (undead summons, life drain) |
| **Cleric** | **High Priest** (mass heals, resurrection, divine shield) | **War Priest** (melee+healing hybrid, smite) | **Oracle** (divination, debuff immunity, future sight) |
| **Rogue** | **Assassin** (stealth, guaranteed crits from behind, poison) | **Shadow Dancer** (teleportation, evasion, illusions) | **Trickster** (traps, debuffs, steal enemy buffs) |
| **Ranger** | **Beast Lord** (enhanced companion, dual companion) | **Horizon Walker** (terrain mastery, teleport stride) | **Sharpshooter** (extreme range, multi-shot, called shots) |
| **Paladin** | **Holy Avenger** (radiant damage, evil-slaying, auras) | **Oath Breaker** (dark powers, fear aura, necrotic smite) | **Shield Guardian** (invulnerability phases, party aegis) |
| **Barbarian** | **Berserker** (extended rage, damage immunity, frenzy) | **Totem Warrior** (animal spirit buffs, spirit summon) | **Titan** (size increase, AoE slams, earthquake) |
| **Bard** | **Virtuoso** (enhanced party buffs, mass inspiration) | **Blade Singer** (melee+spell dancer, evasive) | **Lore Master** (identify all, learn any school spell) |
| **Warlock** | **Fiend Pact** (hellfire, fear, demon summons) | **Fey Pact** (charms, illusions, teleportation) | **Elder Pact** (psychic damage, madness, tentacles) |
| **Sorcerer** | **Storm Lord** (lightning mastery, chain spells, flight) | **Phoenix Bloodline** (fire mastery, self-resurrection) | **Chronomancer** (time manipulation, extra turns, slow enemies) |

#### Prestige Ability Progression

Prestige abilities unlock at milestone levels:

| Level | Unlock |
|-------|--------|
| 21 | Prestige Ability #1 (path-defining core ability) |
| 25 | Prestige Ability #2 + Spell Level 5 (caster paths) |
| 30 | Prestige Ability #3 + T7 prestige equipment |
| 40 | Prestige Ability #4 + Spell Level 6 (caster paths) + T8 prestige equipment |
| 50 | Prestige Ability #5 (signature move) |
| 60 | Prestige Ability #6 + T9 prestige equipment |
| 70 | Prestige Ability #7 |
| 80 | Prestige Ability #8 + T10 Mythic equipment |
| 90 | Prestige Ability #9 |
| 100 | **Prestige Capstone** (ultimate ability unique to path) |

#### Prestige Ability Definitions

Each prestige path grants 10 abilities at milestone levels (21, 25, 30, 40, 50, 60, 70, 80, 90, 100). Abilities are either **Active** (used as an action in combat, with cooldowns) or **Passive** (always-on bonuses). All DCs use the formula: `DC = 10 + min(½ character level, 20) + primary ability mod` (capped at level 40 contribution to prevent unresistable DCs; maximum base DC is 30 + ability mod).

##### Fighter — Champion

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Improved Critical | Passive | Threat range for all weapons expanded by +1 (e.g., 20→19-20, 19-20→18-20) |
| 25 | Devastating Blow | Active | Single melee attack at +4 to hit, +2d6 damage. 3-round cooldown |
| 30 | Mettle | Passive | On a successful Fort or Will save that would have a partial effect, negate the effect entirely |
| 40 | Supreme Critical | Passive | Critical multiplier increased by ×1 for all weapons (e.g., ×2→×3) |
| 50 | One-Man Army | Active | Full attack action against every adjacent enemy in a single turn. 5-round cooldown |
| 60 | Armor Mastery | Passive | Reduce armor check penalty by 4, increase max DEX bonus by +2 for worn armor |
| 70 | Legendary Resilience | Passive | DR 5/— (reduce all physical damage by 5) |
| 80 | Vorpal Strike | Active | Single attack that, on a natural 20, instantly slays the target (Fort DC or die). 10-round cooldown |
| 90 | Unbreakable | Passive | Once per combat, when reduced to 0 HP, remain at 1 HP instead |
| 100 | **Paragon of Steel** | Passive | +4 to all attack rolls, +4 AC, +2 to all saves. All weapon proficiencies automatically Master rank |

##### Fighter — Weapon Master

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Weapon Versatility | Passive | Gain Novice proficiency in all 10 weapon categories instantly |
| 25 | Technique Chain | Active | Use two weapon techniques in a single action (both resolve). 4-round cooldown |
| 30 | Adaptive Style | Passive | Switch equipped weapon as a free action (no action cost) |
| 40 | Master's Riposte | Passive | AoO deals an additional +2d6 damage and triggers the equipped weapon's Technique #1 |
| 50 | Thousand Cuts | Active | Make 3 attacks at full BAB, each with a different weapon technique. 5-round cooldown |
| 60 | Living Weapon | Passive | Unarmed strikes deal 2d8 + STR mod. Gain proficiency bonuses to unarmed |
| 70 | Flawless Form | Passive | +2 insight bonus to AC and attack rolls (stacks with all other bonuses) |
| 80 | Grand Technique | Active | Perform any Master-rank mastery passive as an active burst (AoE, 3-tile radius). 8-round cooldown |
| 90 | Eternal Student | Passive | Proficiency use counts accumulate at 2× rate. Weapon techniques deal +1d6 damage |
| 100 | **Blade Transcendence** | Passive | All weapons treated as Master rank. Weapon techniques have no cooldown. +3 to all weapon damage dice |

##### Fighter — Knight

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Shield Wall | Active | Grant +4 AC to all adjacent allies for 3 rounds. 4-round cooldown |
| 25 | Bulwark | Passive | Shield AC bonus doubled. Shield block chance +10% |
| 30 | Defensive Stance | Active | Cannot move; gain +4 AC, +4 saves, DR 5/—. Lasts 3 rounds. 5-round cooldown |
| 40 | Inspiring Presence | Passive | Allies within 3 tiles gain +2 morale bonus to attack rolls and saves vs fear |
| 50 | Aegis | Active | Designate one ally; all attacks against that ally target you instead for 3 rounds. 5-round cooldown |
| 60 | Fortress | Passive | Immune to knockback, prone, and forced movement effects |
| 70 | Rally | Active | All allies heal 2d8+CHA mod HP and are cured of fear/charm effects. 6-round cooldown |
| 80 | Invulnerable Armor | Passive | DR 10/— while wearing T5+ plate armor |
| 90 | Unshakable Sentinel | Passive | AoO range extends to 2 tiles. AoO cannot miss (minimum roll treated as 10) |
| 100 | **Eternal Guardian** | Active | For 5 rounds, all party members within 4 tiles take half damage (you absorb the other half). 1/combat |

##### Wizard — Archmage

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Spell Power | Passive | +2 to spell save DCs for all schools |
| 25 | Spell Level 5 Access | Passive | Can learn and cast Level 5 spells |
| 30 | Efficient Casting | Passive | All spells cost 25% less MP (round down, minimum 1) |
| 40 | Spell Level 6 Access | Passive | Can learn and cast Level 6 spells |
| 50 | Arcane Fire | Active | Ranged touch attack (INT mod to hit), deals 1d6 per 2 caster levels, unresistable arcane damage. 2-round cooldown |
| 60 | Mastery of Shaping | Passive | AoE spells can exclude up to 3 tiles from the area (no friendly fire) |
| 70 | Spell Perfection | Passive | Choose one spell; that spell is permanently Empowered (max one damage die) at no extra MP cost |
| 80 | Arcane Absorption | Active | Absorb one incoming spell targeting you; recover MP equal to spell level × 5. 4-round cooldown |
| 90 | Dual Spell | Passive | Once per combat, cast two spells in a single turn (both consume MP) |
| 100 | **Arcane Supremacy** | Passive | All spell DCs +4 (total +6 with Spell Power). Spells that deal damage add INT mod to each damage die. 50% MP cost reduction (stacks with Efficient Casting) |

##### Wizard — Battle Mage

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Armored Caster | Passive | Arcane spell failure from armor reduced by 20% (T2 leather = 0%, T3 chain = 10%) |
| 25 | Spell Sword | Active | Imbue weapon with a known spell; next melee attack delivers the spell on hit (no separate attack roll for spell). 3-round cooldown |
| 30 | Combat Casting | Passive | +4 to concentration checks (casting in melee never provokes AoO) |
| 40 | Arcane Shield | Active | As a reaction, gain +4 shield bonus to AC until next turn. 2-round cooldown |
| 50 | War Magic | Passive | When you cast a spell, gain +2 to attack rolls until end of next turn |
| 60 | Eldritch Strike | Active | Melee attack that deals weapon damage + spell damage (highest known spell level × d6). 4-round cooldown |
| 70 | Mystic Resilience | Passive | Gain temporary HP equal to INT mod at the start of each combat round |
| 80 | Spell Fury | Active | For 3 rounds, melee attacks trigger a cantrip as a free action. 6-round cooldown |
| 90 | Armored Arcanum | Passive | Arcane spell failure completely eliminated for all armor types |
| 100 | **Arcane Warrior** | Passive | Melee attacks use INT instead of STR for attack and damage. All weapon damage dice increased by one step. Spells and melee attacks heal you for 2 HP per hit |

##### Wizard — Necrolord

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Undead Servitor | Active | Raise a permanent skeleton minion (lasts until destroyed). Max 1 at a time. Stats scale with caster level |
| 25 | Life Tap | Passive | Necrotic spell damage heals you for 25% of damage dealt (max 10 HP per spell) |
| 30 | Fear Aura | Passive | Enemies within 2 tiles must make Will save or be Shaken (−2 attack/saves) for 1 round on your turn |
| 40 | Greater Undead | Passive | Undead Servitor upgraded: can now raise Wights (stronger stats, energy drain on hit) |
| 50 | Death Shroud | Active | Become incorporeal for 2 rounds (+4 deflection AC, immune to non-magical weapons, 50% miss chance). 6-round cooldown |
| 60 | Command Undead | Active | Take control of 1 undead enemy (Will save DC). Lasts until combat ends. 1/combat |
| 70 | Necrotic Empowerment | Passive | All necrotic damage spells deal +1d6 damage per 4 caster levels |
| 80 | Lichlike Resilience | Passive | Immune to death effects, energy drain, and negative levels |
| 90 | Army of the Dead | Passive | Max undead servitors increased to 3. All undead gain +2 attack, +2 AC |
| 100 | **Lord of Undeath** | Active | Raise all corpses on the battlefield as undead allies (each with 50% of original creature's stats). Lasts 10 rounds. 1/combat |

##### Cleric — High Priest

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Greater Healing | Passive | All healing spells heal an additional +50% (e.g., Cure Wounds heals 18 instead of 12) |
| 25 | Spell Level 5 Access | Passive | Can learn and cast Level 5 divine spells |
| 30 | Divine Shield | Active | Grant one ally a shield of divine light: absorbs next 30 damage. 4-round cooldown |
| 40 | Spell Level 6 Access | Passive | Can learn and cast Level 6 divine spells |
| 50 | Mass Resurrection | Active | Revive all KO'd party members at 50% HP. 1/combat |
| 60 | Beacon of Hope | Passive | Allies within 4 tiles gain +2 saves and maximized healing dice from your spells |
| 70 | Sanctuary | Active | One ally becomes untargetable by enemies for 2 rounds (breaks if ally attacks). 5-round cooldown |
| 80 | Miracle Worker | Passive | Healing spells that would overheal instead grant temporary HP (max 20) |
| 90 | Channel Divinity: Preserve Life | Active | Distribute up to 100 HP among any allies within 5 tiles. 1/combat |
| 100 | **Avatar of Light** | Passive | All healing doubled. Allies within 5 tiles regenerate 5 HP/round. Undead within 5 tiles take 5 radiant damage/round |

##### Cleric — War Priest

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Sacred Weapon | Active | Imbue weapon with +WIS mod to attack and damage for 5 rounds. 5-round cooldown |
| 25 | Smite | Active | Single melee attack at +CHA mod to hit, +2d8 radiant damage (+3d8 vs undead). 3-round cooldown |
| 30 | Channel Divinity: War God's Blessing | Active | Grant one ally +10 to their next attack roll (before rolling). 4-round cooldown |
| 40 | Extra Attack | Passive | Make two melee attacks per turn instead of one |
| 50 | Holy Avenger's Strike | Active | Melee attack deals weapon damage + 4d8 radiant, heals you for damage dealt. 5-round cooldown |
| 60 | Aura of Courage | Passive | Allies within 3 tiles immune to fear effects |
| 70 | Divine Power | Active | For 3 rounds, gain Full BAB (if not already), +6 STR, +6 temporary HP per level. 1/combat |
| 80 | Righteous Fury | Passive | Critical hits with melee weapons trigger a free Cure Wounds on yourself |
| 90 | Avatar of War | Passive | +4 sacred bonus to attack rolls and AC while wearing T4+ armor |
| 100 | **Wrathful Crusader** | Passive | Melee attacks deal an additional 2d8 radiant damage. Smite has no cooldown. All healing spells can be cast as bonus actions |

##### Cleric — Oracle

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Foresight | Passive | Cannot be surprised. +2 insight bonus to AC and initiative |
| 25 | Divination Mastery | Active | Reveal all enemies, traps, and hidden objects on the current floor. 1/floor |
| 30 | Debuff Immunity | Passive | Immune to Blinded, Confused, and Charmed conditions |
| 40 | Prophetic Ward | Active | Choose one ally; that ally auto-succeeds on their next saving throw. 4-round cooldown |
| 50 | Glimpse of the Future | Active | Preview enemy AI actions for the next 2 turns (shown as ghost overlays on grid). 5-round cooldown |
| 60 | Fate's Favor | Passive | Once per combat, force one enemy to reroll an attack that would hit an ally |
| 70 | All-Seeing Eye | Passive | Fog of war permanently revealed in a 6-tile radius around the Oracle |
| 80 | Prescient Counter | Passive | +4 dodge bonus to AC against attacks from enemies you can see |
| 90 | Temporal Anomaly | Active | Grant one ally an immediate extra turn (out of initiative order). 1/combat |
| 100 | **Omniscience** | Passive | All party members gain +4 insight to AC, attack, and saves. Enemies cannot benefit from concealment, invisibility, or cover against your party |

##### Rogue — Assassin

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Death Attack | Active | If you study a target for 1 round (observe without attacking), your next attack paralyzes (Fort DC) or deals ×3 damage. 5-round cooldown |
| 25 | Poison Use | Passive | Apply poisons to weapons without risk of self-poisoning. Poison save DCs increased by +2 |
| 30 | Improved Sneak Attack | Passive | Sneak attack damage increases by +2d6 (stacks with base sneak attack) |
| 40 | Hide in Plain Sight | Active | Become invisible even while being observed (enemies lose target). 3-round cooldown |
| 50 | Angel of Death | Active | Teleport behind target and attack with auto-critical. 6-round cooldown |
| 60 | Quiet Death | Passive | Kills made from stealth do not break invisibility. Adjacent enemies don't notice |
| 70 | Assassin's Mark | Active | Mark one target; all attacks against marked target by any ally gain +2 attack and deal +1d6 damage. 4-round cooldown |
| 80 | Death Strike | Passive | Death Attack DC increased by +4. On failed save, target is stunned for 1d4 rounds |
| 90 | Shadow Walk | Passive | Can move through enemy-occupied tiles without provoking AoO. +2 tiles movement speed |
| 100 | **Hand of Death** | Passive | Sneak attacks deal +6d6 total bonus damage. Any attack from stealth that reduces target below 25% HP is an instant kill (Fort DC to resist) |

##### Rogue — Shadow Dancer

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Shadow Jump | Active | Teleport up to 4 tiles to any square in dim light or darkness. 2-round cooldown |
| 25 | Uncanny Dodge | Passive | Never flat-footed. Retain DEX bonus to AC even when caught off-guard |
| 30 | Shadow Illusion | Active | Create a shadow duplicate at your former position (lasts 2 rounds, absorbs 1 attack). 3-round cooldown |
| 40 | Improved Shadow Jump | Passive | Shadow Jump range increased to 8 tiles. Usable in any light level |
| 50 | Defensive Roll | Passive | Once per combat, when an attack would reduce you to 0 HP, make a Ref save to take half damage instead |
| 60 | Shadow Cloak | Passive | Permanent concealment (20% miss chance) in any light level below Bright |
| 70 | Summon Shadow | Active | Summon a Shadow creature (undead, incorporeal) ally for 5 rounds. 1/combat |
| 80 | Greater Shadow Cloak | Passive | Concealment increased to 50% miss chance. Immune to blindsight detection |
| 90 | Shadow Master | Passive | In dim light or darkness, gain +4 to attack, AC, and all saves |
| 100 | **One with Shadow** | Passive | Permanent incorporeal state (can toggle). While incorporeal: immune to non-magical weapons, pass through walls, +6 deflection AC. Can still attack normally |

##### Rogue — Trickster

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Steal Buff | Active | Remove one buff from target enemy and apply it to yourself (duration resets). 3-round cooldown |
| 25 | Improved Trap | Passive | Traps deal +2d6 damage and have +2 DC to detect/disarm |
| 30 | Misdirection | Active | Force one enemy to attack a different target (another enemy or empty square). 3-round cooldown |
| 40 | Debilitating Strike | Passive | Sneak attacks inflict one of: −4 AC, −4 attack, or half movement speed for 2 rounds (your choice) |
| 50 | Grand Theft | Active | Steal an enemy's equipped weapon or item (opposed DEX check). 5-round cooldown |
| 60 | Elusive | Passive | Cannot be targeted by AoO. Provoke no reactions from any enemy movement |
| 70 | Master of Deception | Active | Create 3 illusory duplicates of yourself (as Mirror Image) + all allies gain concealment for 2 rounds. 5-round cooldown |
| 80 | Ace up the Sleeve | Passive | Once per combat, use a consumable item as a free action (no action cost) |
| 90 | Luck of the Trickster | Passive | Reroll any one d20 roll per round (take the better result) |
| 100 | **Supreme Trickster** | Passive | Start each combat invisible. All debuffs you inflict last +2 rounds. Steal Buff has no cooldown. Once per combat, swap positions with any visible enemy |

##### Ranger — Beast Lord

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Empathic Link | Passive | Companion gains +2 to all ability scores. You sense what companion senses (shared vision) |
| 25 | Improved Companion | Passive | Companion gains +2 HD, +2 natural armor, +1 attack |
| 30 | Wild Empathy | Active | Pacify one beast-type enemy (Will DC). Pacified beasts leave combat. 4-round cooldown |
| 40 | Dual Companion | Passive | Gain a second companion creature (choose from class list). Both fight simultaneously |
| 50 | Pack Tactics | Passive | When both companions are adjacent to the same enemy, all three (you + 2 companions) gain +4 flanking bonus |
| 60 | Bestial Fury | Active | All companions gain extra attack and +4 STR for 3 rounds. 5-round cooldown |
| 70 | Alpha Command | Passive | Companions can use weapon techniques from your equipped weapon category |
| 80 | Spirit Animal | Passive | If a companion is reduced to 0 HP, it returns as a spirit version after 2 rounds (incorporeal, half HP) |
| 90 | Primal Bond | Passive | You and companions share a healing pool: healing done to any of you is split evenly |
| 100 | **Lord of Beasts** | Active | Summon a pack of 4 dire wolves for the duration of combat. All companions and summoned beasts gain +4 to all stats. 1/combat |

##### Ranger — Horizon Walker

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Terrain Mastery | Passive | Choose 2 terrain types: movement cost in those terrains reduced to 1, +2 attack on those terrains |
| 25 | Planar Attunement | Passive | Gain resistance 5 to one energy type per dimension currently in (fire in Nine Hells, cold in Frostfell, etc.) |
| 30 | Terrain Mastery II | Passive | Choose 2 additional terrain types (total 4). +2 Initiative on mastered terrains |
| 40 | Teleport Stride | Active | Teleport to any visible tile within movement range as a move action (ignores difficult terrain, enemies). 2-round cooldown |
| 50 | Dimensional Anchor | Active | Target enemy cannot teleport, plane-shift, or go ethereal for 5 rounds (Will DC). 4-round cooldown |
| 60 | All-Terrain Master | Passive | All terrain types mastered. Difficult terrain never impedes you |
| 70 | Phase Strike | Active | Attack passes through cover and concealment. Auto-hits ethereal/incorporeal creatures. 3-round cooldown |
| 80 | Planar Adaptation | Passive | Immune to all dimensional environmental effects (lava damage, chaos warp, etc.) |
| 90 | Dimensional Door | Active | Create a linked portal pair on the map; allies can step through one to emerge at the other. Lasts 5 rounds. 1/combat |
| 100 | **Walker Between Worlds** | Passive | Permanently phased: 25% miss chance on all attacks against you, ignore all terrain costs, +4 to saves. Can see invisible and ethereal creatures. All party members gain Planar Attunement while you're alive |

##### Ranger — Sharpshooter

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Far Shot | Passive | All ranged weapon ranges increased by +3 tiles. No penalty for long range |
| 25 | Multi-Shot | Active | Fire at 2 different targets within range (full attack bonus each). 3-round cooldown |
| 30 | Called Shot: Legs | Active | Ranged attack at −2; on hit, target's movement halved for 3 rounds. 2-round cooldown |
| 40 | Penetrating Shot | Passive | Ranged attacks ignore cover bonuses and 5 points of AC from armor |
| 50 | Arrow Storm | Active | Fire at all enemies in a 3×3 area (attack roll each, full damage). 5-round cooldown |
| 60 | Called Shot: Arms | Active | Ranged attack at −4; on hit, target drops weapon and cannot attack for 1 round. 3-round cooldown |
| 70 | Improved Multi-Shot | Passive | Multi-Shot now targets 3 enemies. No attack penalty |
| 80 | Death From Afar | Passive | Ranged attacks from 6+ tiles away gain +2d6 damage and auto-confirm criticals |
| 90 | Pin Cushion | Passive | Each consecutive ranged hit on the same target deals +1d6 cumulative damage (resets on miss or target switch) |
| 100 | **Supreme Marksman** | Passive | Ranged attacks have no maximum range (entire visible grid). Threat range 17-20 with ranged weapons. All ranged attacks deal +3d6 damage |

##### Paladin — Holy Avenger

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Smite Evil | Active | +CHA mod to attack, +level to damage vs evil-aligned enemies. 3-round cooldown |
| 25 | Aura of Good | Passive | Allies within 3 tiles gain +2 sacred bonus to AC and saves |
| 30 | Divine Grace | Passive | Add CHA mod to all saving throws |
| 40 | Holy Sword | Active | Weapon glows: +2d6 radiant damage on all attacks, dispels evil magic on hit for 5 rounds. 5-round cooldown |
| 50 | Lay on Hands (Greater) | Active | Heal one ally for 10 × Paladin level HP. 1/combat |
| 60 | Aura of Warding | Passive | Allies within 3 tiles gain spell resistance equal to 10 + your level |
| 70 | Celestial Champion | Passive | Immune to disease, poison, and death effects. Radiant damage heals you instead |
| 80 | Judgment | Active | Designate one enemy as judged: all party attacks against that target deal +3d6 radiant and have +4 to hit. 1/combat |
| 90 | Angelic Wings | Passive | Gain flight, +4 AC, and radiant aura (2d6 radiant to adjacent enemies at start of your turn) |
| 100 | **Hand of Tyr** | Passive | All melee attacks deal +4d6 radiant. Smite Evil has no cooldown. Aura extends to 5 tiles and grants immunity to fear, charm, and compulsion. Once per combat, fully heal entire party |

##### Paladin — Oath Breaker

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Dread Smite | Active | +CHA mod to attack, +2d8 necrotic damage. +3d8 vs celestials/good-aligned. 3-round cooldown |
| 25 | Aura of Dread | Passive | Enemies within 3 tiles must make Will save or be Shaken (−2 attack/saves, first encounter only) |
| 30 | Unholy Resilience | Passive | Add CHA mod to all saving throws (dark mirror of Divine Grace) |
| 40 | Touch of Corruption | Active | Melee touch: deal 1d6 per 2 levels necrotic damage, heal yourself equal to damage dealt. 3-round cooldown |
| 50 | Animate Champion | Active | Raise one slain enemy as an undead champion (full stats, under your control) for remainder of combat. 1/combat |
| 60 | Fear Aura | Passive | Enemies within 3 tiles who fail Will save are Frightened (flee for 1 round, −2 attack thereafter) |
| 70 | Dark Blessing | Passive | Necrotic damage you deal heals you for 50% of amount |
| 80 | Soul Reaver | Active | On kill, gain the slain creature's highest ability score modifier as a bonus to your attacks for 5 rounds. 1/combat |
| 90 | Dread Knight | Passive | Immune to positive energy effects (healing from enemies). DR 10/good. +4 profane bonus to attack and damage |
| 100 | **Fallen Champion** | Passive | All melee attacks deal +4d6 necrotic. Aura of Dread causes Panicked (flee + drop items) instead of Shaken. Killed enemies automatically rise as zombies under your control (max 4) |

##### Paladin — Shield Guardian

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Guardian's Mark | Active | Mark one ally; redirect all attacks against them to you for 2 rounds. +4 AC while marked. 4-round cooldown |
| 25 | Heavy Guard | Passive | While wielding a shield, +2 AC to all adjacent allies |
| 30 | Immovable | Passive | Immune to knockback, bull rush, and forced movement. Cannot be moved against your will |
| 40 | Shield Sacrifice | Active | As a reaction, negate all damage from one attack against an adjacent ally (you take half instead). 2-round cooldown |
| 50 | Fortress of Faith | Active | Create a 3×3 zone of protection centered on you: allies inside gain +6 AC and DR 5/—. 3 rounds. 6-round cooldown |
| 60 | Stalwart Defender | Passive | While you haven't moved this round, gain +4 AC and all adjacent allies gain +2 AC |
| 70 | Unbreakable Shield | Passive | Shield cannot be sundered or bypassed. Shield block chance +20% |
| 80 | Phalanx | Active | All allies within 2 tiles form a phalanx: +4 AC, +4 saves, AoO against any enemy that enters the area. 5 rounds. 1/combat |
| 90 | Martyr's Resolve | Passive | When reduced below 25% HP, gain +8 AC and regenerate 5 HP/round for 3 rounds |
| 100 | **Impregnable Bastion** | Passive | You and all allies within 3 tiles take half damage from all sources. Shield block chance 50%. Once per combat, become completely invulnerable for 2 rounds |

##### Barbarian — Berserker

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Greater Rage | Passive | Rage bonuses increased to +6 STR, +6 CON, +3 Will saves (up from +4/+4/+2) |
| 25 | Reckless Attack | Active | All attacks this turn gain +4 to hit but you take −4 AC until next turn. 1/round (no cooldown) |
| 30 | Extended Rage | Passive | Rage lasts 5 + CON mod rounds (doubled from base) |
| 40 | Frenzy | Active | Gain one extra melee attack per round at full BAB for 3 rounds. Afterwards, Fatigued for 2 rounds. 5-round cooldown |
| 50 | Deathless Frenzy | Passive | While raging, you don't fall unconscious at 0 HP. You die only if reduced to −CON score HP |
| 60 | Mighty Rage | Passive | Rage bonuses increased to +8 STR, +8 CON, +4 Will saves |
| 70 | Damage Reduction | Passive | DR 5/— while raging (stacks with armor DR) |
| 80 | Tireless Rage | Passive | No longer fatigued after Frenzy or rage ends |
| 90 | Unstoppable | Passive | While raging, immune to paralysis, stun, sleep, and death effects |
| 100 | **Primal Fury** | Passive | Rage bonuses +10 STR, +10 CON, +6 Will. DR 10/— while raging. Frenzy grants 2 extra attacks. On killing an enemy, immediately gain a free move action |

##### Barbarian — Totem Warrior

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Bear Totem | Active | While raging, DR 3/— and +4 natural armor. 5-round duration matches rage |
| 25 | Hawk Totem | Passive | +2 Initiative, +2 Reflex saves, +2 ranged attack rolls |
| 30 | Wolf Totem | Passive | Allies adjacent to you gain +2 flanking bonus (stacks with normal flanking) |
| 40 | Spirit Guide | Active | Summon totem animal spirit (Bear/Wolf/Hawk) as an ally for 5 rounds. 1/combat |
| 50 | Greater Bear Totem | Passive | DR while raging increased to 6/—, +6 natural armor |
| 60 | Eagle Totem | Passive | Gain flight while raging. +4 Initiative |
| 70 | Totem Shift | Active | Take the physical form of your totem animal: Bear (+8 STR, Large size), Wolf (pack flanking, trip), Hawk (flight, +6 DEX). 5 rounds. 5-round cooldown |
| 80 | Spirit Pack | Passive | Spirit Guide now summons 2 totem spirits simultaneously |
| 90 | Multi-Totem | Passive | Gain the passive benefits of all totems simultaneously while raging |
| 100 | **Spirit Avatar** | Active | Merge with your totem spirit: Colossal size, +12 to primary stat, DR 15/—, all totem benefits active, regenerate 10 HP/round. 10 rounds. 1/combat |

##### Barbarian — Titan

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Powerful Build | Passive | Count as Large size for grapple, bull rush, and weapon damage. Can wield Large weapons (increased damage die) |
| 25 | Ground Slam | Active | Strike the ground: all enemies within 2 tiles take 2d6+STR bludgeoning and must make Ref save or fall prone. 3-round cooldown |
| 30 | Mighty Stature | Passive | While raging, actually become Large size: +2 STR, −1 AC, reach 2 tiles |
| 40 | Boulder Throw | Active | Hurl a boulder at any visible tile: 4d6+STR bludgeoning, Ref DC half, 2-tile AoE. 3-round cooldown |
| 50 | Earthquake | Active | All ground-bound enemies on the field make Ref save or take 4d6 and fall prone. Terrain becomes difficult. 1/combat |
| 60 | Titanic Rage | Passive | While raging and Large, weapon damage dice doubled (e.g., 1d12→2d12) |
| 70 | Colossal Stature | Passive | While raging, become Huge size: +4 STR, −2 AC, reach 3 tiles, 15-foot space |
| 80 | World Breaker | Active | Destroy a 5×5 area of terrain (walls crumble, cover destroyed, enemies in area take 6d6). 1/combat |
| 90 | Immovable Object | Passive | While raging, cannot be moved by any effect, immune to knockback/grapple/trip |
| 100 | **Colossus** | Passive | Permanently Large size (Huge when raging). All slam/ground attacks deal +4d6 damage. Earthquake usable every 5 rounds. All enemies within 3 tiles take −2 attack from your intimidating presence |

##### Bard — Virtuoso

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Inspiring Song | Active | All allies gain +2 morale to attack and damage for 5 rounds. 5-round cooldown |
| 25 | Countersong | Active | As a reaction, negate one enemy enchantment/compulsion spell (automatic success). 3-round cooldown |
| 30 | Mass Inspiration | Passive | Bardic music effects extend to 5-tile radius (up from 3) |
| 40 | Song of Healing | Active | All allies in range heal 3d8+CHA mod HP. 4-round cooldown |
| 50 | Dirge of Doom | Active | All enemies in range must make Will save or be Frightened for 2 rounds. 5-round cooldown |
| 60 | Maestro's Touch | Passive | Bardic music no longer requires an action; it's a free action each round |
| 70 | Song of Freedom | Active | Remove all negative conditions (except death) from all allies. 1/combat |
| 80 | Epic Inspiration | Passive | Inspiring Song bonuses increased to +4 morale to attack, damage, and saves |
| 90 | Song of Legends | Active | For 5 rounds, one ally gains +6 to all ability scores. 1/combat |
| 100 | **Eternal Symphony** | Passive | Inspiring Song is always active (no cooldown, no action). All allies within 5 tiles gain +4 attack, +4 AC, +4 saves, and regenerate 3 HP/round. Enemies in range take −4 to all rolls |

##### Bard — Blade Singer

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Bladesong | Active | Enter Bladesong stance: +INT mod to AC, +10ft movement speed, +INT mod to concentration. 5 rounds. 4-round cooldown |
| 25 | Combat Caster | Passive | No AoO provoked by casting spells in melee |
| 30 | Dance of Steel | Passive | +1 dodge AC per enemy adjacent to you (max +4) |
| 40 | Spell Strike | Active | Deliver a melee attack and a spell simultaneously. Both resolve on hit. 3-round cooldown |
| 50 | Defensive Flourish | Passive | After making a melee attack, gain +3 AC until your next turn |
| 60 | Whirling Blade | Active | Move up to your full speed, making one melee attack against each enemy you pass. 4-round cooldown |
| 70 | Song of the Blade | Passive | While in Bladesong, all melee damage adds +CHA mod as sonic damage |
| 80 | Steel Wind Strike | Active | Teleport to each of up to 5 enemies within 5 tiles and make a melee attack against each. 1/combat |
| 90 | Eternal Dance | Passive | Bladesong has no duration limit. Active until you choose to end it or are incapacitated |
| 100 | **Avatar of the Dance** | Passive | While in Bladesong, +6 AC, +6 attack, cannot be flat-footed, AoO against every enemy that moves within 3 tiles. Melee attacks deal +2d6 sonic damage. Movement provokes no AoO |

##### Bard — Lore Master

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Identify | Passive | Automatically identify all items, monsters, traps, and magical effects without a check |
| 25 | Spell Flexibility | Passive | Can learn spells from any school (not limited to Bard schools). Still uses Bard spell slots |
| 30 | Secret Knowledge | Active | Grant one ally +5 insight bonus to their next roll (attack, save, or check). 2-round cooldown |
| 40 | Spell Theft | Active | Copy the last spell an enemy cast; you can cast it once for free. 4-round cooldown |
| 50 | Ancient Secrets | Passive | +2 to all spell DCs. Can use any scroll regardless of class restriction |
| 60 | Lore of Ages | Passive | +1 to all ability scores from accumulated knowledge |
| 70 | Reactive Spell | Passive | Once per round, cast a Level 1-2 spell as a reaction (triggered by enemy action) |
| 80 | Master Linguist | Active | Command one enemy to take a specific action on its next turn (Will DC). 5-round cooldown |
| 90 | Polyglot of Magic | Passive | Can apply Sorcerer metamagic options to your spells (one metamagic per spell) |
| 100 | **Sage of the Realms** | Passive | Know all spells from all schools. +6 to all spell DCs. Once per combat, cast any spell (including Level 5-6) without MP cost. All allies gain +2 insight bonus to all rolls |

##### Warlock — Fiend Pact

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Hellfire Blast | Active | Eldritch Blast becomes Hellfire Blast: +2d6 fire damage, ignores fire resistance. 2-round cooldown |
| 25 | Dark One's Blessing | Passive | On killing an enemy, gain temporary HP equal to CHA mod + Warlock level |
| 30 | Fiendish Resilience | Passive | Resistance 10 to fire, cold, and poison |
| 40 | Summon Fiend | Active | Summon a Lesser Demon (Dretch/Quasit) to fight for 5 rounds. 1/combat |
| 50 | Hurl Through Hell | Active | Banish one enemy for 1 round; it returns taking 10d6 psychic damage (Will DC half). 1/combat |
| 60 | Fiendish Transformation | Passive | Grow horns (+1d6 melee gore attack), wings (flight), tail (+1 AC). Permanent |
| 70 | Greater Fiend | Passive | Summon Fiend upgraded: summons a Glabrezu (much stronger) |
| 80 | Infernal Pact Boon | Passive | +4 to CHA score. Eldritch Blast fires 3 beams instead of 1 |
| 90 | Hellfire Storm | Active | 5-tile radius: 12d6 fire + 6d6 unholy damage, Ref DC half. 1/combat |
| 100 | **Archfiend's Champion** | Passive | Summon a Pit Fiend ally at combat start (1/combat, lasts entire combat). All fire damage you deal ignores resistance and immunity. Hellfire Blast adds +6d6 damage. Permanent DR 10/good |

##### Warlock — Fey Pact

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Fey Presence | Active | All enemies within 3 tiles must make Will save or be Charmed for 1 round. 3-round cooldown |
| 25 | Misty Escape | Passive | When you take damage, you may teleport 3 tiles as a reaction (1/combat) |
| 30 | Beguiling Defenses | Passive | Immune to charm effects. When an enemy tries to charm you, it's charmed instead (Will DC) |
| 40 | Fey Step | Active | Teleport up to 6 tiles; at destination, choose: invisible for 1 round OR enemies within 2 tiles charmed. 3-round cooldown |
| 50 | Twilight Veil | Active | Create 4-tile radius zone of twilight: allies gain concealment, enemies are blinded (Will DC). 4 rounds. 5-round cooldown |
| 60 | Feywild Magic | Passive | All enchantment and illusion spell DCs increased by +3 |
| 70 | Mirror Image (Greater) | Passive | Start each combat with 5 mirror images (each absorbs one attack) |
| 80 | Faerie Ring | Active | Create a 3-tile radius circle: enemies inside cannot leave (Will DC to break free each round), allies inside gain +4 saves. 5 rounds. 1/combat |
| 90 | Archfey's Gift | Passive | +4 CHA. Once per combat, force one enemy to reroll any d20 result |
| 100 | **Sovereign of the Twilight Court** | Passive | All enemies within 5 tiles permanently Charmed (Will DC each round). Charmed enemies attack their allies. Teleportation has no cooldown. Immune to all illusions and enchantments. +6 to all Enchantment/Illusion spell DCs |

##### Warlock — Elder Pact

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Mind Spike | Active | Deal 3d8 psychic damage to one target and learn all its stats/abilities (Will DC half damage). 2-round cooldown |
| 25 | Alien Resilience | Passive | Immune to psychic damage and mind-affecting effects (charm, fear, confusion) |
| 30 | Tentacle Lash | Active | Summon a tentacle from the ground: melee attack +CHA, 2d8+CHA bludgeoning, grapple on hit. 2-round cooldown |
| 40 | Thought Shield | Passive | Psychic damage dealt to you is reflected back to the attacker. +4 to Will saves |
| 50 | Evard's Black Tentacles | Active | 4-tile radius zone: all creatures make Ref save or are grappled and take 2d6+CHA bludgeoning/round. 3 rounds. 5-round cooldown |
| 60 | Madness Gaze | Active | Target enemy makes Will save or gains a random madness effect (attack allies, flee, catatonic) for 2 rounds. 4-round cooldown |
| 70 | Eldritch Hunger | Passive | When you deal psychic damage, heal HP equal to half the damage dealt |
| 80 | Summon Star Spawn | Active | Summon a Star Spawn Hulk to fight for 5 rounds. 1/combat |
| 90 | Warp Reality | Active | Swap the positions of any 4 creatures on the battlefield (no save). 1/combat |
| 100 | **Voice of the Void** | Passive | All damage you deal becomes psychic (ignores physical resistance). Enemies within 3 tiles take 3d6 psychic damage at start of your turn. Once per combat, dominate one enemy permanently (Will DC to resist each round). Immune to all conditions |

##### Sorcerer — Storm Lord

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Storm Sorcery | Passive | All lightning/thunder spells deal +1d6 damage per 3 caster levels |
| 25 | Spell Level 5 Access | Passive | Can learn and cast Level 5 spells |
| 30 | Wind Walker | Passive | Gain flight (30ft). After casting a lightning/thunder spell, fly 3 tiles as a free action |
| 40 | Spell Level 6 Access | Passive | Can learn and cast Level 6 spells |
| 50 | Chain Lightning | Active | Lightning bolt bounces to up to 4 additional targets (each takes half previous damage). 4-round cooldown |
| 60 | Tempest Shield | Passive | When hit by a melee attack, attacker takes 2d8 lightning damage (no save). +2 AC |
| 70 | Eye of the Storm | Active | Create a 5-tile radius storm: enemies inside take 4d6 lightning/round and have −4 to ranged attacks. Allies unaffected. 5 rounds. 1/combat |
| 80 | Lightning Reflexes | Passive | Evasion (successful Ref save = no damage, failed = half). +6 Initiative |
| 90 | Ride the Lightning | Active | Transform into a lightning bolt: teleport up to 10 tiles in a straight line, dealing 10d6 lightning to all in path. 5-round cooldown |
| 100 | **Stormcaller Ascendant** | Passive | All spells gain +lightning subtype (add 2d6 lightning to all spell damage). Permanent flight. Lightning immunity. Chain Lightning has no cooldown. Once per combat, call down a bolt dealing 20d6 to one target (Ref half) |

##### Sorcerer — Phoenix Bloodline

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Fire Affinity | Passive | All fire spells deal +1d6 damage. Fire resistance 10 |
| 25 | Spell Level 5 Access | Passive | Can learn and cast Level 5 spells |
| 30 | Phoenix Spark | Passive | When reduced to 0 HP, explode in fire (3×3, 4d6 fire, Ref half) and return at 25% HP. 1/combat |
| 40 | Spell Level 6 Access | Passive | Can learn and cast Level 6 spells |
| 50 | Cauterize | Active | Touch ally: deal 2d6 fire damage to remove all negative conditions and heal 4d6 HP. 3-round cooldown |
| 60 | Fire Immunity | Passive | Completely immune to fire damage. Fire spells heal you instead of damaging |
| 70 | Inferno Form | Active | Become a fire elemental: immune to physical damage, all attacks deal +3d6 fire, enemies adjacent take 2d6 fire/round. 5 rounds. 1/combat |
| 80 | Phoenix Wings | Passive | Gain flight. Once per combat, dash 8 tiles in a line leaving a Wall of Fire behind you |
| 90 | Rebirth Flame | Passive | Phoenix Spark upgraded: triggers at 25% HP instead of 0 HP, heals to 75% HP |
| 100 | **Phoenix Ascendant** | Passive | Fire damage you deal is doubled. All fire spells gain Empower for free. Phoenix Spark triggers unlimited times per combat. You burn so brightly that enemies within 2 tiles are permanently Dazzled (−1 attack, −1 saves) |

##### Sorcerer — Chronomancer

| Level | Ability | Type | Effect |
|-------|---------|------|--------|
| 21 | Temporal Shift | Active | Take an extra move action this turn (move + action + move). 3-round cooldown |
| 25 | Spell Level 5 Access | Passive | Can learn and cast Level 5 spells |
| 30 | Slow Time | Active | All enemies take −4 Initiative and lose their move action for 2 rounds (Will DC). 5-round cooldown |
| 40 | Spell Level 6 Access | Passive | Can learn and cast Level 6 spells |
| 50 | Time Stop | Active | Take 2 full turns immediately (enemies frozen). Cannot directly damage frozen enemies. 1/combat |
| 60 | Temporal Rewind | Active | Undo the last round of combat (all positions, HP, MP, cooldowns restored to previous state). 1/combat |
| 70 | Haste (Permanent) | Passive | Permanent Haste effect: double movement speed, +1 attack per round, +2 AC |
| 80 | Temporal Clone | Active | Create a time-displaced copy of yourself that acts independently for 3 rounds (same stats, separate turn). 1/combat |
| 90 | Age Ray | Active | Target ages rapidly: −4 to STR, DEX, CON (permanent until combat ends). Fort DC to resist. 4-round cooldown |
| 100 | **Master of Time** | Passive | Act first in initiative regardless of roll. Time Stop usable every 10 rounds. All cooldowns reduced by 2 rounds (minimum 1). Once per combat, reverse one ally's death (they return at full HP at the start of next round) |

#### Veteran Path (No Prestige)

Characters who reach level 20 but do not promote still gain levels. Their progression is:

| Feature | Veteran (No Prestige) | Prestige Class |
|---------|----------------------|----------------|
| Stat points per level | +1 | +1 |
| HP/MP growth | Standard (diminishing) | Standard (diminishing) |
| Abilities at milestones | Generic "Veteran" abilities (e.g., +1 all damage, +1 AC) | Path-specific prestige abilities |
| Equipment tiers | T1-T6 only | T1-T10 (Mythic at 80) |
| Spell levels | Level 1-4 only | Level 1-6 (prestige caster paths) |
| Capstone at 100 | "Veteran's Resolve" (+2 all ability scores) | Unique capstone per path |

#### Prestige Promotion Invariants

- A character can only promote once (prestige class is permanent)
- Promotion does not reset level, XP, stats, equipment, or spells
- Promotion is only available at the town Promotion Hall (never at camp)
- The prestige quest must be completed before promotion is offered
- Gold cost is deducted from party gold on promotion
- If a character does not meet stat requirements, the option is shown but grayed out with the reason

#### User Stories & Acceptance Criteria -- Prestige

**US-PRESTIGE-01**: As a player, I can see which prestige classes are available for my level 20+ characters.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | The Promotion Hall shows 3 prestige paths per character's base class |
| AC2 | Each path displays: name, description, stat requirement, gold cost, quest status |
| AC3 | Paths with unmet requirements are grayed out with the specific reason shown |
| AC4 | Only characters at level 20+ see the promotion options |

**US-PRESTIGE-02**: As a player, I can complete a prestige unlock quest to earn promotion eligibility.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Each prestige path has a unique quest (listed on the Promotion Hall board) |
| AC2 | The quest involves 1-3 objectives (e.g., "Defeat 10 undead" for Necrolord, "Find the Ancient Tome" for Archmage) |
| AC3 | Quest progress persists across sessions |
| AC4 | Completing the quest unlocks the "Promote" button for that path |
| AC5 | The quest is per-account, not per-character (one completion unlocks for all characters of that base class) |

```gherkin
Scenario: Promote Fighter to Champion
  Given a level 20 Fighter with STR >= 15
  And the Champion quest "Defeat 3 bosses" is completed
  And the player has 1000 gold
  When I visit the Promotion Hall in a town
  And select "Champion" and click "Promote"
  Then 1000 gold is deducted
  And the Fighter becomes a Champion
  And the character sheet shows "Champion (Fighter)" with prestige level 0/80
  And Prestige Ability #1 ("Mighty Blow") unlocks at level 21

Scenario: Prestige not available at camp
  Given a level 20 Fighter
  When I enter camp after a dungeon
  Then no "Promotion Hall" option is visible
  And a tooltip says "Visit a town for prestige promotion"

Scenario: Veteran continues without prestige
  Given a level 20 Fighter who has not promoted
  When the Fighter gains enough XP to reach level 21
  Then the Fighter becomes level 21 with +1 stat point
  And receives "Veteran's Tenacity" (+1 melee damage) instead of a prestige ability
```

**US-PRESTIGE-03**: As a player, I can see prestige abilities in my character sheet and use them in combat.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Prestige abilities appear in the ability list with a special border/icon |
| AC2 | Prestige abilities are usable in combat like base class abilities |
| AC3 | The character sheet shows the prestige path name and prestige level |
| AC4 | Prestige abilities scale with prestige level (not base level) |

**US-PRESTIGE-04**: As a player, I can equip prestige-tier equipment (T7-T10) after reaching the required prestige level.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | T7-T10 equipment drops only in higher-tier dungeons (floor 10+) |
| AC2 | Equipping T7+ gear requires the character to be on a prestige path |
| AC3 | Veterans (no prestige) cannot equip T7+ gear; tooltip shows "Requires prestige class" |
| AC4 | T10 Mythic equipment has a visual glow effect on the paper-doll sprite |

```gherkin
Scenario: Prestige equipment requirement
  Given a level 35 Champion (prestige)
  And a T7 "Adamantine Greatsword" is in inventory
  When I try to equip it
  Then equipping succeeds (level 30+ prestige required, level 35 meets it)

Scenario: Veteran cannot equip prestige gear
  Given a level 35 Veteran Fighter (no prestige)
  And a T7 "Adamantine Greatsword" is in inventory
  When I try to equip it
  Then equipping fails with "Requires prestige class"
```

**US-PRESTIGE-05**: As a player, my prestige promotion is saved and persists across sessions.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Prestige class is stored in the save data |
| AC2 | Loading a save restores the prestige path and all prestige abilities |
| AC3 | Prestige quest completion is stored and persists |

---

### 5.15 Save/Load Persistence System

Since Tactical Realms is a static webpage running on `file://` or a static host, all persistence is **client-side only** via `localStorage`. The save system must be robust against browser session endings, tab closures, crashes, and storage corruption.

#### Design Principle: Feels Like a Server

The save system is invisible to the player. There is no "Save" button, no "Load" button, no save slots. The game persists automatically and continuously, exactly like a server-backed online game. The player simply opens the game and continues where they left off. This prevents save-scumming (important for permadeath) and simplifies the UX.

#### Anti-Tamper / Anti-Cheat Save Encryption

Since the game is entirely client-side with no server to validate state, the save must be **cryptographically hardened** to resist tampering and save-editing. The goal is to make it impractical (not impossible -- it's still client-side JS) to modify save data.

**Core principle: Append-only chained blocks**

Each auto-save appends a new `[Block][Header]` pair to the end of the log. To load the current game state, only the **last header** and the **last block** need to be read. The second-to-last block verifies chain integrity. Each block's encryption key is **derived from the ciphertext of the previous block**, creating an unbreakable forward chain -- altering any block invalidates every block after it.

**Save format (append-only log):**

```
localStorage value (single string, base64-encoded binary):

  [Block₀][Header₀][Block₁][Header₁][Block₂][Header₂]...[BlockN][HeaderN]
    ↑ genesis       ↑ 2nd save         ↑ 3rd save          ↑ current (latest)

Reading: scan from the END to find HeaderN → decrypt BlockN → done.
Verification: also read Header_{N-1} and Block_{N-1} to verify the chain link.
```

**Block structure:**

```
Block = AES-GCM(
  key  = derivedKey,
  iv   = header.iv,
  data = JSON.stringify(fullGameState)
)
```

**Header structure (plaintext JSON, appended AFTER its block):**

```
Header = {
  version: 1,                       // Schema version (initial release)
  blockIndex: N,                    // Monotonically increasing sequence number
  iv: <random 12 bytes, base64>,    // Fresh IV for this block's AES-GCM
  salt: <random 16 bytes, base64>,  // Fresh salt mixed into key derivation
  prevBlockHash: <SHA-256 of Block_{N-1} ciphertext, hex>,
  blockOffset: <byte offset where BlockN starts in the log>,
  prevHeaderOffset: <byte offset where Header_{N-1} starts>,
  timestamp: 1710500000000,
  pepper: <build-version hash>      // Changes per game update
}
```

**Key derivation chain:**

```
Genesis block (Block₀):
  key₀ = PBKDF2(
    password = oneTimeKey[randomKeyId] + salt₀ + pepper,
    salt     = salt₀,
    iterations = 10000
  )
  Header₀.genesisKeyId = randomKeyId   // Only the genesis header stores keyId

Subsequent blocks (Block_N where N > 0):
  key_N = HKDF-SHA256(
    ikm  = SHA-256(Block_{N-1} ciphertext),   // Previous block's ciphertext IS the key material
    salt = salt_N,                              // Fresh random salt per block
    info = pepper + blockIndex bytes
  )
```

The key for each block is derived by **hashing the ciphertext of the previous block**. This means:
- Modifying Block₃ changes its ciphertext → Block₄'s key changes → Block₄ can't decrypt → chain is broken
- Removing a block from the middle breaks the chain forward from that point
- Inserting a block requires knowing the key derivation, which depends on the real previous ciphertext
- Replaying an old log mismatches the latest `blockIndex` sequence

**Load algorithm (fast -- reads only from the tail):**

```
1. Read entire log string from localStorage
2. Scan backwards from the end to find HeaderN (last valid JSON object)
3. Parse HeaderN → get blockOffset, prevHeaderOffset, prevBlockHash
4. Extract BlockN ciphertext from blockOffset to HeaderN's start
5. Derive key_N:
   a. Read Block_{N-1} ciphertext using prevHeaderOffset to locate it
   b. key_N = HKDF-SHA256(SHA-256(Block_{N-1} ciphertext), salt_N, pepper + N)
6. Decrypt BlockN with key_N → get plaintext game state JSON
7. VERIFY: compute SHA-256(Block_{N-1} ciphertext) and compare to HeaderN.prevBlockHash
   - If mismatch: chain is broken (tampered). Try the SECOND log buffer.
8. Parse game state JSON, apply migration if version < current, return

For genesis block (blockIndex == 0):
  - key₀ = PBKDF2(oneTimeKey[genesisKeyId] + salt₀ + pepper, salt₀)
  - No prevBlockHash to verify (genesis is the trust anchor)
```

**Dual-log rotation (handles size limits):**

When the append-only log grows too large, the system rotates to a second localStorage key:

```
localStorage keys:
  sz-tactical-realms-log-a         → append-only encrypted log (active or previous)
  sz-tactical-realms-log-b         → append-only encrypted log (active or previous)
  sz-tactical-realms-active        → "a" or "b" (which log is current / being appended to)
  sz-tactical-realms-settings      → { musicVolume, sfxVolume, animationSpeed } (plaintext)
```

**Rotation trigger:**
1. After each append, check log size: `logString.length`
2. If size > **400 KB** (well within 5 MB localStorage limit):
   a. Start a **new genesis block** in the inactive log
   b. The new genesis key is derived from the **last block of the old log** (maintains cross-log chain link)
   c. New genesis header stores: `prevLogKey: "a"` or `"b"` and `crossLogHash: SHA-256(last block of old log)`
   d. Flip `active` pointer to the new log
   e. The old log remains as a backup until the new log also rotates (then it's overwritten)

**Write cycle (per auto-save):**

```
1. Read current active log from localStorage
2. Read the last block's ciphertext from the log (for key derivation)
3. Generate fresh salt (16 bytes) and IV (12 bytes) via crypto.getRandomValues()
4. Derive key_N = HKDF-SHA256(SHA-256(lastBlockCiphertext), salt, pepper + blockIndex)
5. Encrypt full game state JSON with AES-GCM(key_N, IV)
6. Build HeaderN with blockIndex, iv, salt, prevBlockHash, offsets, timestamp
7. Append [BlockN][HeaderN] to the log string
8. Write updated log to localStorage (single atomic setItem)
9. If log > 400 KB: rotate to other log buffer
```

**Anti-tamper properties:**
- **Can't read**: Each block is AES-GCM encrypted; localStorage shows opaque ciphertext
- **Can't modify a block**: Changing any block's ciphertext changes its SHA-256 hash → every subsequent block's key is wrong → chain breaks forward
- **Can't replay old state**: Reverting to an older log mismatches the block index sequence and the cross-log chain hash
- **Can't insert/delete blocks**: Block offsets and prevBlockHash in each header form a strict sequential chain
- **Can't forge a new block**: Requires the ciphertext of the real previous block to derive the key
- **Can't downgrade**: Pepper changes per build version; old pepper produces wrong keys
- **Each save is unique**: Fresh random salt + IV per block; same game state encrypts differently every time

**Practical limitations (documented honestly):**
- A determined attacker with JS debugging skills can extract the key ring and pepper from the game source
- The chain can be reconstructed by someone who reads and understands the key derivation code
- This is "lock on a glass door" security -- it stops casual tampering, hex editors, and JSON manipulation, not dedicated reverse engineers
- Appropriate for a single-player browser game with no real-money stakes

**Web Crypto API usage:**

```js
// All crypto uses the browser's native Web Crypto API (SubtleCrypto)
// No external libraries -- works on file:// in modern browsers

// Key derivation for genesis block
const genesisKey = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' },
  await crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, ['deriveBits']),
  256
);

// Key derivation for chained blocks (HKDF from previous block's ciphertext hash)
const prevHash = await crypto.subtle.digest('SHA-256', prevBlockCiphertext);
const chainedKey = await crypto.subtle.deriveBits(
  { name: 'HKDF', salt, info: pepperAndIndex, hash: 'SHA-256' },
  await crypto.subtle.importKey('raw', prevHash, 'HKDF', false, ['deriveBits']),
  256
);

// Encrypt / decrypt
const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
```

#### Save Architecture

```
localStorage keys:
  sz-tactical-realms-log-a         → append-only chained encrypted log (buffer A)
  sz-tactical-realms-log-b         → append-only chained encrypted log (buffer B)
  sz-tactical-realms-active        → "a" or "b" (which log is being appended to)
  sz-tactical-realms-settings      → { musicVolume, sfxVolume, animationSpeed } (plaintext)
```

#### Save Data Schema

```js
// This is the PLAINTEXT inside each encrypted block.
// Integrity is enforced by the AES-GCM auth tag + chained key derivation.
{
  version: 1,                        // Schema version (initial release)
  gameState: 'camp',                 // Current state machine state
  party: [
    {
      id: 'human-fighter-abc123',
      race: 'human',
      baseClass: 'fighter',
      prestigeClass: 'champion',     // null if not promoted
      // Note: prestigeQuestsCompleted is per-account (see accountData below), not per-character
      level: 35,
      xp: 170350,
      baseStats: { hp: 245, mp: 0, str: 22, dex: 14, con: 18, int: 8, wis: 10, cha: 12, ac: 18, spd: 11 },
      allocatedStats: { str: 12, dex: 4, con: 8, int: 0, wis: 2, cha: 2 },
      unallocatedStatPoints: 0,
      equipment: { weapon: 'item-123', shield: null, helmet: 'item-456', armor: 'item-789', boots: 'item-012', accessory: null },
      proficiencies: { sword: { uses: 180, rank: 'expert' }, axe: { uses: 45, rank: 'trained' } },
      spellBook: null,
      companionId: 'companion-wardog-1',
      currentHp: 200,
      currentMp: 0,
      statusEffects: [],
      prestigeAbilities: ['mightyBlow', 'critMastery', 'powerStrike']
    }
    // ... up to 4 party members
  ],
  roster: [ /* all recruited characters not in active party */ ],
  inventory: [ /* all items with full stat blocks */ ],
  gold: 4500,
  companions: [ /* companion state: hp, equipment, level */ ],
  overworldSeed: 202603,             // YYYYMM seed for current overworld
  currentPosition: { x: 12, y: 8 }, // Overworld or dungeon position
  dungeonProgress: {                 // null if not in dungeon
    dungeonId: 'dungeon-seed-123',
    currentFloor: 3,
    floorsCleared: [1, 2],
    revealedTiles: [[1,2],[3,4]],    // Fog of war state
    roomsVisited: [0, 1, 3]
  },
  questProgress: {
    daily: { id: 'daily-2026-03-15', stages: [true, false, false] },
    weekly: { id: 'weekly-2026-W11', stages: [true, true, false] }
  },
  accountData: {                           // Per-account (shared across all characters)
    prestigeQuestsCompleted: {             // Keyed by base class → completed path quests
      fighter: ['champion', 'weaponMaster'],
      wizard: ['archmage']
    },
    defeatedBosses: ['beholder', 'lich-king'],   // Lifetime boss kills (for quest prereqs)
    clearedDungeons: ['shadow-cavern'],           // Fully cleared dungeons (for quest prereqs)
    saveSlots: 3,                                 // Number of save slots used (max 5)
  },
  // Save Slot Management:
  // - 5 save slots total (numbered 1-5), each with independent dual-buffer log pairs
  // - localStorage keys: sz-tactical-realms-slot-{N}-log-a, sz-tactical-realms-slot-{N}-log-b, sz-tactical-realms-slot-{N}-active
  // - Title screen shows all 5 slots: occupied slots display party summary (level, class icons, gold, playtime)
  // - Empty slots show "New Game" button
  // - Occupied slots show "Continue" and "Delete" buttons
  // - Delete requires double-confirm: "Are you sure?" → "This cannot be undone. Delete slot {N}?"
  // - No "Copy" or "Move" between slots (prevents save scumming)
  // - Auto-save always writes to the currently active slot
  bestiary: {                          // Persistent monster codex
    'goblin': { encounters: 25, kills: 20, state: 'mastered' },
    'beholder': { encounters: 1, kills: 0, state: 'encountered' }
  },
  achievements: {                      // Persistent achievement tracking
    'first-blood': { unlocked: true, date: '2026-03-10' },
    'dragon-slayer': { unlocked: false, progress: 0, target: 1 }
  },
  factionReputation: {                 // Per-town faction standing
    'town-guard': 15,
    'thieves-guild': -5,
    'mages-guild': 30,
    'temple': 20
  },
  settings: {                          // User preferences (also saved separately as a non-encrypted key)
    difficulty: 'normal',
    musicVolume: 0.7,
    sfxVolume: 1.0,
    ambientVolume: 0.5,
    colorblindMode: null,              // null, 'protanopia', 'deuteranopia', 'tritanopia', 'symbols'
    fontSize: 'normal',
    tutorialComplete: true,
    tooltipsDismissed: ['first-equip', 'first-camp']
  },
  activeQuests: [                      // Currently tracked quests (max 3)
    { questId: 'daily-2026-03-15', objectives: [{ current: 5, target: 10 }] },
    { questId: 'weekly-2026-W11', objectives: [{ current: 2, target: 3 }, { current: 1, target: 1 }] }
  ],
  playTime: 43200000,                // Total play time in ms
  statistics: {
    monstersKilled: 1234,
    dungeonsCompleted: 45,
    bossesDefeated: 12,
    highestLevel: 35,
    totalGoldEarned: 125000,
    totalDeaths: 8,
    longestWinStreak: 12
  }
}
```

#### Auto-Save Triggers

Auto-save fires on every significant state transition. The save process is:

1. Serialize full game state to JSON
2. Read current active log from localStorage
3. Locate the last `[Block][Header]` pair in the log (tail scan)
4. Generate fresh salt (16 bytes) and IV (12 bytes) via `crypto.getRandomValues()`
5. Derive key: `HKDF-SHA256(SHA-256(lastBlockCiphertext), salt, pepper + blockIndex)`
6. Encrypt game state JSON with `AES-GCM(key, IV)` → new block ciphertext
7. Build header: `{ version, blockIndex, iv, salt, prevBlockHash, blockOffset, prevHeaderOffset, timestamp, pepper }`
8. Append `[newBlock][newHeader]` to the log string
9. Write updated log to localStorage (single atomic `setItem`)
10. If log size > 400 KB: rotate to the other log buffer (new genesis block linking to old log's tail)
11. If `QuotaExceededError`: compress game state (trim statistics, fog-of-war), re-encrypt, retry

| Trigger | State Transition | What's Saved |
|---------|-----------------|--------------|
| Party confirmed | `CHARACTER_SELECT` → `OVERWORLD` | Full state with new party |
| Enter overworld zone | Zone change within `OVERWORLD` | Position, party state |
| Enter town | `OVERWORLD` → `TOWN` | Position, party state |
| Enter dungeon floor | `OVERWORLD` → `DUNGEON` or floor change | Dungeon progress, fog state |
| Combat victory | `VICTORY` → `DUNGEON` or `CAMP` | XP gains, loot, party HP/MP |
| Retreat from defeat | `DEFEAT` → `CAMP` | Reduced state (XP kept, loot lost) |
| Enter camp | Any → `CAMP` | Full state |
| Rest at camp | Within `CAMP` | HP/MP restored |
| Equip change at camp | Within `CAMP` | Equipment state |
| Buy/sell at shop | Within `CAMP` or `TOWN` | Inventory, gold |
| Prestige promotion | Within `TOWN` | Character prestige class, gold |
| Quest progress | Kill/collect/explore objective met | Quest progress counters |
| Achievement unlock | Achievement condition met | Achievement state |
| Bestiary update | New creature encountered or kill threshold | Bestiary entry |

#### Storage Size Budget

| Component | Estimated Size (JSON) | Notes |
|-----------|----------------------|-------|
| Party (4 members) | ~4 KB | Stats, equipment refs, proficiencies, spells |
| Roster (8 backup) | ~6 KB | Same structure as party but no currentHp/statusEffects |
| Inventory (48 slots) | ~3 KB | Item IDs + affix data |
| Dungeon progress | ~2 KB | Floor state, fog of war (bitfield), rooms visited |
| Quest progress | ~0.5 KB | 3 active quests with objectives |
| Bestiary | ~3 KB (full) | 120 entries × ~25 bytes each |
| Achievements | ~1 KB | 50 entries × ~20 bytes each |
| Settings | ~0.3 KB | User preferences |
| Statistics | ~0.2 KB | Counters |
| **Total (plaintext)** | **~20 KB** | Well within localStorage 5 MB limit |
| **Total (encrypted + chain)** | **~80 KB** | With AES-GCM overhead + 3-4 chain blocks |

Maximum localStorage budget: **400 KB** per save log buffer (two buffers = 800 KB max). If approaching limit, trim: fog-of-war history (keep only current floor), compress bestiary (keep only 'mastered' entries inline, rest as IDs), truncate statistics.

#### Schema Versioning & Migration Architecture

Each save block includes a `version` field. The initial release ships as **version 1**. No migration chain exists yet — it will be added when the schema changes in a future update.

**Migration design (for future use):**

When a schema change is needed post-release, add a numbered migration function:

| From | To | Migration | Status |
|------|----|-----------|--------|
| *(none yet — v1 is the initial release)* | | | |

Migration rules (to follow when adding migrations):
- Migrations are forward-only. There is no downgrade/rollback path.
- Each migration function MUST increment `data.version` to exactly `fromVersion + 1`.
- New fields are always added with sensible defaults (never `undefined`).
- Fields are never deleted during migration — only added or restructured.
- After the full chain runs, the migrated save is re-encrypted at the current version with a fresh salt/IV.
- If `data.version > CURRENT_SAVE_VERSION`, the save was created by a newer game version. Refuse load and show "Game update required".
- If a migration function throws, catch the error, log it, and try the other log buffer. If both fail, show "Save data corrupted".

#### Load-on-Startup Flow

The title screen seamlessly resumes or starts fresh -- no "Load Game" UI. Loading reads only the **tail** of the active log (fast -- no need to scan the entire chain).

```
1. Title screen renders
2. Read "sz-tactical-realms-active" to determine current log (A or B)
3. Attempt to load from the active log:
   a. Read log string from localStorage
   b. Scan backwards from end to find last HeaderN (JSON object)
   c. Parse HeaderN → extract blockOffset, prevHeaderOffset, prevBlockHash, salt, IV
   d. Extract BlockN ciphertext using blockOffset
   e. Extract Block_{N-1} ciphertext using prevHeaderOffset (for key derivation + chain verification)
   f. Derive key_N = HKDF-SHA256(SHA-256(Block_{N-1} ciphertext), salt, pepper + blockIndex)
   g. Decrypt BlockN → parse game state JSON
   h. Verify: SHA-256(Block_{N-1} ciphertext) == HeaderN.prevBlockHash (chain integrity)
   i. If all checks pass: apply migration if needed, show "Continue" with party summary
   j. If any check fails (tampered / corrupted): try the OTHER log buffer
   k. If other log also fails: show "Save data corrupted. Start a new adventure?"
4. If neither log exists: show only "New Game" button
5. "Continue" restores game state → transition to saved gameState (seamless resume)
6. "New Game" → CHARACTER_SELECT (genesis block created on party confirmation)
7. Player never sees a "Save" or "Load" button -- persistence is invisible
```

#### Save Versioning & Migration (Architecture)

The migration pattern is ready for when the schema changes post-release:

```js
const CURRENT_SAVE_VERSION = 1;

const migrations = {
  // Add migration functions here when the schema changes:
  // 1: (data) => { /* v1 → v2: describe changes */ data.version = 2; return data; },
};

function migrateSave(data) {
  while (data.version < CURRENT_SAVE_VERSION)
    data = migrations[data.version](data);
  return data;
}
```

No migrations exist yet — v1 is the initial release schema. The full save data schema (see above) is the v1 definition.

#### Corruption Detection & Recovery

| Check | Method | Recovery |
|-------|--------|----------|
| Missing log key | `localStorage.getItem()` returns null | Try other log buffer; if both null, show "New Game" |
| Tail header parse failure | Backward scan finds no valid JSON header at end | Try other log buffer |
| Decryption failure | AES-GCM `decrypt()` throws (tampered block ciphertext) | Try other log buffer; if both fail, show "Save data corrupted" |
| Chain link broken | `SHA-256(Block_{N-1}) != HeaderN.prevBlockHash` | Chain was tampered; try other log buffer |
| Block index gap | HeaderN.blockIndex != Header_{N-1}.blockIndex + 1 | Blocks were inserted or deleted; try other log buffer |
| Schema version unknown | `data.version > CURRENT_SAVE_VERSION` | Refuse load, show "Game update required" |
| Pepper mismatch | Game build pepper != header pepper | Attempt migration if version is older; else refuse |
| Missing fields | Required field is undefined after decryption | Attempt migration from detected version (if migrations exist) |
| Quota exceeded on append | `localStorage.setItem()` throws `QuotaExceededError` | Rotate to other log buffer; if still fails, compress and retry; last resort: warning toast |
| Active flag corrupted | `active` key is not "a" or "b" | Try both log buffers, use whichever decrypts and verifies |
| Cross-log chain broken | Genesis block's `crossLogHash` doesn't match old log's last block | Old log was tampered after rotation; accept new log if it's internally consistent |

#### Storage Quota Management

- Each encrypted block is ~200 KB max (single game state snapshot)
- Log rotation triggers at **400 KB** per log buffer (allows ~2 blocks + overhead before rotating)
- Two log buffers = ~800 KB max total (well within 5-10 MB localStorage limit)
- Monitor log size after each append: `logString.length`
- On rotation: new genesis block in the other buffer, old buffer becomes backup
- If `QuotaExceededError` even after rotation: compress game state (trim statistics, fog-of-war), re-encrypt, retry; show toast warning as last resort

#### User Stories & Acceptance Criteria -- Save/Load

**US-SAVE-01**: As a player, my progress is automatically saved so I never lose more than one combat encounter of progress.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Auto-save triggers on every state transition listed in the trigger table |
| AC2 | The save completes before the next state begins rendering |
| AC3 | No auto-save occurs during combat (to prevent save-scumming; permadeath has consequences) |
| AC4 | The game silently saves -- no "Saving..." indicator needed (feels like a server) |

```gherkin
Scenario: Auto-save on dungeon floor entry
  Given the player descends to floor 3 of a dungeon
  When the floor transition completes
  Then localStorage "sz-tactical-realms-save" is updated
  And the save contains dungeonProgress.currentFloor = 3
  And the previous save is copied to "sz-tactical-realms-backup"

Scenario: Browser closed mid-session
  Given the player enters camp (auto-save fires)
  And later enters a dungeon floor (auto-save fires again)
  When the browser is closed unexpectedly
  And reopened later
  Then the title screen shows "Continue" with the dungeon floor save
  And the player resumes at the start of the dungeon floor
```

**US-SAVE-02**: As a returning player, I seamlessly continue my game in a new browser session -- no "Load Game" UI.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Opening the game shows "Continue" if a save exists -- no slot selection, no load UI |
| AC2 | Clicking "Continue" restores: party, inventory, gold, position, dungeon progress, quest state, prestige class |
| AC3 | All character stats (HP, MP, XP, equipment, proficiencies, spells) are preserved exactly |
| AC4 | The experience feels identical to a server-backed online game |
| AC5 | There is no "Save" button anywhere in the game |

```gherkin
Scenario: Resume seamlessly
  Given a valid save exists with gameState "camp" and a level 25 Champion
  When I open the game
  Then the title screen shows "Continue" with party summary
  When I click "Continue"
  Then the game loads the camp screen instantly
  And my party's Champion is level 25 with prestige abilities
  And my gold, inventory, and quest progress match exactly

Scenario: First-time player
  Given no save exists in localStorage
  When I open the game
  Then only "New Game" is shown (no "Load Game" or slot selection)
```

**US-SAVE-03**: As a player, my save data survives browser updates and cache clears (as long as localStorage is not cleared).

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Save data uses only `localStorage` (not sessionStorage, IndexedDB, or cookies) |
| AC2 | Keys use a unique prefix `sz-tactical-realms-` to avoid collisions |
| AC3 | The game does not depend on any other browser storage mechanism |

**US-SAVE-04**: As a player, I am protected from save corruption with automatic backup recovery.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | If the primary save is corrupted, the backup is used silently |
| AC2 | If both primary and backup are corrupt, a clean error message is shown |
| AC3 | The player can start a new game if recovery fails |
| AC4 | Corruption never causes a blank screen or JavaScript error |

```gherkin
Scenario: Corrupted save with valid backup
  Given the primary save has an invalid checksum
  And the backup has a valid checksum
  When the title screen loads
  Then the "Continue" button loads from the backup silently
  And a brief toast says "Progress recovered (some recent progress may be lost)"

Scenario: Both saves corrupted
  Given both primary and backup have invalid checksums
  When the title screen loads
  Then a dialog shows "Save data corrupted. Start a new adventure?"
  And no JavaScript errors appear in the console
```

**US-SAVE-05**: As a player, old saves from previous game versions are automatically migrated to the current format.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Loading a save with an older schema version triggers the migration chain silently |
| AC2 | Migrated saves are re-saved in the current format after loading |
| AC3 | No data is lost during migration (fields are added with defaults, never removed) |
| AC4 | A save from a newer version than the game shows "Game update required" |

```gherkin
Scenario: Future migration (not yet applicable — v1 is the initial release)
  Given localStorage contains a save with version: 1
  And the game has been updated to schema version 2
  When the game loads the v1 save
  Then the migration function for v1→v2 runs silently
  And new fields are added with sensible defaults
  And the save is re-written as version 2
```

**US-SAVE-06**: As a player, permadeath is enforced -- I cannot save-scum by reloading.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | No manual save/load UI exists anywhere in the game |
| AC2 | Auto-save occurs before dungeon entry but NOT during combat |
| AC3 | If a party wipe occurs, the defeat state is saved -- the player cannot reload a pre-combat state |
| AC4 | The only way to "start over" is "New Game" on the title screen (erases save) |

```gherkin
Scenario: Permadeath enforced
  Given the party enters a dungeon (auto-save fires)
  And a combat encounter begins (no save)
  And the entire party dies
  When the defeat screen shows
  Then the game saves the defeat state
  And reopening the game shows "Continue" to the post-defeat camp (with losses)
  And there is no way to reload the pre-combat state
```

---

### 5.16 Gold Economy (D&D 3.5e Wealth by Level)

#### Gold Sources

| Source | Gold Amount | Scaling |
|--------|------------|---------|
| Monster drops | Per CR: `gold = 10 × CR` (minimum 1 gp) | Scales with dungeon depth |
| Treasure chests | Per dungeon tier: T1: 20-50, T2: 50-150, T3: 100-400, T4: 200-800, T5+: 500-2000 | Seeded by room |
| Boss kills | `200 × CR` gp (boss CR from stat block) | Weekly boss determines loot |
| Sold equipment | 50% of item buy price | Fixed ratio |
| Quest rewards | 100-500 gp per quest tier | Weekly/daily quest system |

#### Gold-per-CR Reference Table (D&D 3.5e Standard Treasure)

| CR | Expected Gold (solo) | Expected Gold (pack of 4) |
|----|---------------------|--------------------------|
| ¼ | 3 gp | 12 gp |
| ½ | 7 gp | 28 gp |
| 1 | 13 gp | 50 gp |
| 2 | 20 gp | 80 gp |
| 3 | 30 gp | 120 gp |
| 5 | 50 gp | 200 gp |
| 7 | 80 gp | 320 gp |
| 10 | 150 gp | 600 gp |
| 14 | 300 gp | 1,200 gp |
| 20 | 800 gp | 3,200 gp |
| 25 | 2,000 gp | 8,000 gp |
| 30+ | 5,000 gp | 20,000 gp |

#### Expected Wealth by Level (D&D 3.5e)

| Level | Expected Total Wealth | Per-Run Income (approx) |
|-------|----------------------|------------------------|
| 1 | 0 gp | 30-50 gp |
| 3 | 900 gp | 50-100 gp |
| 5 | 9,000 gp | 150-300 gp |
| 10 | 49,000 gp | 500-1,000 gp |
| 15 | 200,000 gp | 1,500-3,000 gp |
| 20 | 760,000 gp | 5,000-10,000 gp |

#### Item Pricing by Rarity

| Rarity | Buy Price Formula | Sell Price | Drop Rate |
|--------|-------------------|-----------|-----------|
| Common | `20 + (itemLevel × 10)` gp | 50% buy | 60% |
| Uncommon | `80 + (itemLevel × 30)` gp | 50% buy | 25% |
| Rare | `200 + (itemLevel × 80)` gp | 50% buy | 10% |
| Epic | `500 + (itemLevel × 200)` gp | 50% buy | 4% |
| Legendary | Not purchasable | Cannot sell | 1% |

#### Gold Sinks (Expenses)

| Expense | Cost | Frequency |
|---------|------|-----------|
| Health Potion (Minor) | 25 gp | Per use |
| Health Potion (Greater) | 120 gp | Per use |
| Mana Potion (Standard) | 70 gp | Per use |
| Inn Rest (full heal) | 50 gp | Per town visit |
| Spell Training (Level 1) | 100 gp | One-time per spell |
| Spell Training (Level 4) | 1,000 gp | One-time per spell |
| Weapon Training | 75 gp | Per use (+10 proficiency) |
| Prestige Promotion | 5,000 gp | One-time |
| Resurrection (Raise Dead) | 5,000 gp (diamond) | Per death |
| Equipment Repair | 10% of item value | After dungeon run |
| Identify Item | 50 gp | Per unidentified item |

#### Economy Invariants

- Gold cannot go negative (insufficient gold = action blocked with message)
- Legendary items cannot be sold (safety against accidental loss)
- Shop prices are fixed per item (no haggling, no random pricing)
- Boss-specific loot has no sell value (unique, cannot be bought or sold)
- Party gold is shared (not per-character)

---

### 5.17 Shop & Trainer System

#### Shop Inventory Generation

Camp and town shops generate inventory using seeded RNG:

```
shopSeed = hash(dateString + shopType + shopLocation)
itemCount = 3 + floor(maxPartyLevel / 5)  // 3-7 items
maxTier = min(floor(maxPartyLevel / 3) + 1, 10)  // T1-T10, clamped at T10
```

#### Shop Types

| Shop | Location | Stock Size | Max Tier | Special |
|------|----------|-----------|----------|---------|
| **Camp Merchant** | Camp (always) | 3-5 | Party max tier | Basic stock, limited |
| **Town Armorer** | Town | 4-7 | Party max tier + 1 | Weapons and armor only |
| **Town Alchemist** | Town | 5-8 | All potion tiers | All consumables, scrolls |
| **Town General Store** | Town | 4-6 | Party max tier | Mix of equipment + consumables |
| **Specialty Shop** | Large towns only | 2-3 | Up to T6 | Monthly rotation: rare/epic items, rare scrolls |
| **Black Market** | Hidden (quest unlock) | 1-2 | T6+ | Legendary-adjacent items, 3× price |

#### Restock Schedule

| Shop Type | Restock Frequency | Seed |
|-----------|-------------------|------|
| Camp Merchant | Every camp visit (new stock) | `date + visitCount` |
| Town Armorer | Daily | `date + townId` |
| Town Alchemist | Always available (potions don't rotate) | Static |
| Specialty Shop | Monthly | `month + townId` |
| Black Market | Weekly | `week + marketId` |

#### Trainer System

Trainers are NPCs found in towns (full selection) and camps (limited).

| Trainer Type | Location | Services |
|-------------|----------|----------|
| **Weapon Trainer** | Town, Camp | Weapon proficiency training (+10 or +25 uses) |
| **Spell Trainer** | Town only | Teach spells from class school list (monthly rotation of 4-6 available spells) |
| **Cantrip Trainer** | Town only | Teach new cantrips (150 gp each) |
| **Prestige Trainer** | Town Promotion Hall only | Prestige promotion quest start, promotion ceremony |

Spell trainer stock generation:
```
trainerSeed = hash(month + townId + trainerType)
availableSpells = allClassSpells.filter(s => s.level <= partyMaxSpellLevel)
trainerStock = seededShuffle(availableSpells, trainerSeed).slice(0, 6)
```

---

### 5.18 Audio & Music System

The audio system has three independent layers: **ambient music**, **battle/action music**, and **SFX**. Ambient music plays continuously during exploration and **pauses/resumes** (not restarts) when combat begins. Battle music is event-driven and changes based on combat actions. SFX fire on discrete game events.

#### Ambient Music Layer (continuous, pausable)

Ambient music loops continuously and is tied to the player's current location. When combat starts the ambient track **pauses** (preserving playback position) and **resumes from the same point** when combat ends.

| Context | Track Style | Variants | Loop | Notes |
|---------|-----------|----------|------|-------|
| **Title Screen** | Orchestral theme (heroic, D&D tavern feel) | 1 | Yes | Plays once on load, 2s fade on start |
| **Character Select** | Light lute/harp melody | 1 | Yes | 1s crossfade from title |
| **Overworld — Plains** | Pastoral strings, flute, birdsong | 2 | Yes | Random variant per session |
| **Overworld — Forest** | Mystical woodwinds, owl calls, rustling leaves | 2 | Yes | 3s crossfade on biome change |
| **Overworld — Mountain** | Epic brass, wind howl, eagle cry | 2 | Yes | |
| **Overworld — Desert** | Exotic oud, sand whisper, heat shimmer | 2 | Yes | |
| **Overworld — Snow** | Somber piano, blizzard wind, ice creak | 2 | Yes | |
| **Overworld — Swamp** | Low drones, bubbling, insect buzz | 2 | Yes | |
| **Overworld — Volcanic** | Deep rumble, lava flow, cracking rock | 1 | Yes | |
| **Town** | Tavern lute, chatter, birdsong, hammering | 3 | Yes | 2s crossfade, variant by town size |
| **Cave Dungeon** | Dripping water, echoing footsteps, low strings | 3 | Yes | Darker variant per floor depth |
| **Crypt Dungeon** | Whispered voices, creaking wood, organ drones | 2 | Yes | |
| **Abyssal Dungeon** | Demonic chanting, fire crackle, screams (distant) | 2 | Yes | |
| **Underwater Dungeon** | Muffled currents, whale song, bubbles | 1 | Yes | |
| **Camp** | Campfire crackle, crickets, gentle guitar | 2 | Yes | 2s crossfade |

##### Ambient Pause/Resume Behavior

```
// When combat encounter begins:
ambientMusic.pause();          // freeze playback position
ambientMusic.fadeOut(500);     // 500ms fade to silence
battleMusic.play(trackId);     // start battle track

// When combat ends (victory or retreat):
battleMusic.fadeOut(1000);     // 1s fade out
resultSting.play();            // victory fanfare or defeat sting
await resultSting.onEnd();     // wait for sting to finish
ambientMusic.fadeIn(2000);     // 2s fade back in
ambientMusic.resume();         // continue from paused position

// When moving between zones (no combat):
ambientMusic.crossfade(newTrack, 3000);  // 3s smooth crossfade
```

#### Battle Music Layer (event-driven, dynamic)

Battle music starts when combat begins and changes dynamically based on **combat events and action types**. The battle music system uses stems/layers that can be mixed in real-time.

##### Battle Music Tracks

| Track | Trigger | Style | Loop |
|-------|---------|-------|------|
| **Normal Battle** | Random encounter starts | Up-tempo Shining Force-style MIDI-inspired | Yes |
| **Ambush Battle** | Party is surprised | Fast, tense, staccato strings | Yes |
| **Boss Battle (Minor)** | Boss CR 5-12 engaged | Dramatic orchestral, moderate tempo | Yes |
| **Boss Battle (Major)** | Boss CR 13-20 engaged | Epic orchestral with choir | Yes |
| **Boss Battle (Mythic)** | Boss CR 21-30 engaged | Full orchestra + choir + organ, highest intensity | Yes |
| **Boss Phase Transition** | Boss enters new phase | 3s dramatic sting → intensified version of current boss track | One-shot → loop |
| **Mini-Boss** | Named elite enemy (not weekly boss) | Slightly elevated version of normal battle | Yes |
| **Near Death** | Any party member at ≤10% HP | Add low heartbeat percussion layer to current track | Layer |

##### Dynamic Music Events (layered over battle track)

| Event | Music Change | Duration |
|-------|-------------|----------|
| **Critical Hit (player)** | Brass flourish + cymbal crash overlaid | 1s one-shot |
| **Critical Hit (enemy)** | Dark stinger + low drum hit overlaid | 1s one-shot |
| **Spell Cast (Evocation)** | Increase percussion intensity for 2s | 2s swell |
| **Spell Cast (Healing)** | Add harp/chime arpeggio layer | 2s overlay |
| **Spell Cast (Necromancy)** | Add low choir/organ drone layer | 2s overlay |
| **Character Falls (0 HP)** | Drop all layers except bass + heartbeat for 2s | 2s dip |
| **Last Enemy Standing** | Accelerate tempo by 10%, add victory anticipation motif | Until end |
| **Party Wipe Imminent** | Slow tempo, minor key shift, remove high instruments | Until recovery or wipe |

##### Result Stings

| Result | Track | Duration | Transition |
|--------|-------|----------|------------|
| **Victory** | Triumphant fanfare (brass + percussion) | 3-5s | → 2s silence → ambient resume |
| **Defeat** | Somber sting (low strings + single bell) | 5s | → 2s fade to silence → game over screen |
| **Level Up** | Ascending jingle (harp + trumpet) | 2s | Over existing music (no interrupt) |
| **Boss Defeated** | Extended victory (full orchestra, 8s) | 8s | → 2s silence → ambient resume |
| **Rare Loot Found** | Sparkle chime + short brass motif | 2s | Over existing music |
| **Quest Complete** | Warm resolution chord + chime | 3s | Over existing music |

#### Sound Effects (SFX)

Every discrete game action has a corresponding SFX. SFX play immediately on the event trigger and never interrupt each other (concurrent pooling).

##### Combat SFX

| Event | Sound | Variants | Priority |
|-------|-------|----------|----------|
| **Attack — Sword** | Metal slash, blade whoosh | 3 | High |
| **Attack — Axe** | Heavy chop, wood crack | 3 | High |
| **Attack — Mace/Hammer** | Blunt impact, crunch | 3 | High |
| **Attack — Dagger** | Quick stab, fabric pierce | 2 | High |
| **Attack — Bow** | String release + arrow whistle | 2 | High |
| **Attack — Crossbow** | Mechanism click + bolt whoosh | 2 | High |
| **Attack — Staff** | Wooden thwack | 2 | High |
| **Attack — Spear** | Thrust whoosh, puncture | 2 | High |
| **Attack — Flail** | Chain rattle + impact | 2 | High |
| **Attack — Unarmed** | Punch thud, slap | 2 | Medium |
| **Hit Received** | Flesh impact, grunt (varies by race) | 4 | High |
| **Critical Hit** | Enhanced weapon sound + bone crack + screen shake trigger | 1 | Critical |
| **Miss / Dodge** | Whoosh (near miss), quick step (dodge) | 2 | Medium |
| **Block (Shield)** | Metal clang, shield ring | 3 | High |
| **Block (Parry)** | Blade scrape, sword clash | 2 | High |
| **Evade** | Quick dash sound, cloth rustle | 2 | Medium |
| **Death** | Death cry (varies by race/creature), body fall | 8+ | High |
| **Death (Boss)** | Extended death roar + rumble + echo | per boss | Critical |

##### Spell SFX

| Event | Sound | Priority |
|-------|-------|----------|
| **Spell Cast — Evocation** | Fire whoosh / lightning crackle / frost burst (per element) | High |
| **Spell Cast — Necromancy** | Dark pulse, ghostly moan, bone rattle | High |
| **Spell Cast — Abjuration** | Shield hum, ward chime, barrier resonance | Medium |
| **Spell Cast — Conjuration** | Portal whoosh, materialization sparkle | Medium |
| **Spell Cast — Divination** | Crystal tone, ethereal whisper | Low |
| **Spell Cast — Enchantment** | Mind whisper, hypnotic chime | Medium |
| **Spell Cast — Illusion** | Shimmer, distortion warble | Medium |
| **Spell Cast — Transmutation** | Morph squelch, metal reshape | Medium |
| **Spell Cast — Restoration** | Warm chime, holy bell, golden shimmer | High |
| **Heal Received** | Ascending chime + sparkle | High |
| **Buff Applied** | Shimmer rise, power hum | Medium |
| **Debuff Applied** | Dark descending tone, curse whisper | Medium |
| **Buff Expired** | Soft fade-out tone | Low |
| **Counterspell** | Disruption crack, fizzle | High |
| **Spell Resisted (SR)** | Deflection ping, ward flash | Medium |

##### UI SFX

| Event | Sound | Priority |
|-------|-------|----------|
| **Button Click** | Soft click | Low |
| **Menu Open** | Page turn, parchment unroll | Low |
| **Menu Close** | Page close, parchment roll | Low |
| **Item Equip** | Metal clink (weapon), leather creak (armor), cloth rustle (robe) | Medium |
| **Item Unequip** | Reverse of equip sound | Medium |
| **Item Drop** | Thud (heavy) or clink (light) | Low |
| **Item Pickup** | Quick grab, pouch sound | Low |
| **Gold Gained** | Coin jingle (scales with amount: few coins → heavy pouch) | Medium |
| **Gold Spent** | Coins counting out | Medium |
| **Notification** | Bell chime | Medium |
| **Error / Invalid Action** | Low buzz, denied tone | Medium |
| **Level Up** | Ascending harp + brass hit | Critical |
| **Achievement Unlocked** | Special chime + sparkle burst | Critical |
| **Quest Accepted** | Parchment unroll + stamp | Medium |
| **Quest Completed** | Triumphant short horn + chime | High |

##### Movement & Exploration SFX

| Event | Sound | Variants | Priority |
|-------|-------|----------|----------|
| **Footstep — Stone** | Hard tap, boot on stone | 3 | Low |
| **Footstep — Grass** | Soft rustle, grass crunch | 3 | Low |
| **Footstep — Water** | Splash, wade | 2 | Low |
| **Footstep — Wood** | Creak, hollow tap | 2 | Low |
| **Footstep — Sand** | Soft scrunch | 2 | Low |
| **Footstep — Snow** | Crunch, compress | 2 | Low |
| **Door Open** | Creak, hinge groan | 2 | Medium |
| **Door Locked** | Rattle, denied thud | 1 | Medium |
| **Chest Open** | Lid creak + latch click | 2 | Medium |
| **Chest (Mimic!)** | Growl + lid snap | 1 | High |
| **Trap Trigger** | Click + mechanism sound (varies: spike, dart, fire) | 3 | High |
| **Stairs Descend** | Echoing footsteps descending | 1 | Medium |
| **Stairs Ascend** | Echoing footsteps ascending | 1 | Medium |
| **Secret Door Found** | Stone grinding + dust fall | 1 | High |
| **Fog of War Reveal** | Soft whoosh, area unveil | 1 | Low |

##### Ability Activation SFX

| Sound | Description | Variants | Priority |
|-------|-------------|----------|----------|
| **Ability Activate (Melee)** | Weapon swish + grunt (power attack, cleave, etc.) | 3 | High |
| **Ability Activate (Ranged)** | String pull + release (aimed shot, volley) | 2 | High |
| **Ability Activate (Buff)** | Rising chime, golden shimmer | 2 | High |
| **Ability Activate (Debuff)** | Descending drone, dark pulse | 2 | High |
| **Rage/Berserk** | Roar + heartbeat acceleration | 1 | Critical |
| **Sneak Attack** | Quick blade + shadow whoosh | 2 | High |
| **Bardic Performance** | Lute strum + harmonic ring | 2 | High |
| **Turn Undead** | Holy burst + choir sting | 1 | High |
| **Metamagic** | Arcane crackle + spell distortion | 2 | High |
| **Companion Attack** | Animal growl/screech + bite/claw | 3 per companion type | Medium |

##### Consumable SFX

| Sound | Description | Variants | Priority |
|-------|-------------|----------|----------|
| **Potion Drink** | Bottle uncork + liquid gulp | 2 | Medium |
| **Scroll Use** | Paper unfurl + arcane whisper + burn | 2 | Medium |
| **Bomb Throw** | Whoosh + explosion | 1 | High |
| **Smoke Bomb** | Puff + hiss | 1 | Medium |
| **Torch Light** | Flint strike + fire catch | 1 | Low |
| **Lockpick Use** | Metal click-click-click + lock open | 2 | Medium |
| **Trap Kit Place** | Mechanical click + arm | 1 | Medium |
| **Camp Rations** | Eating/chewing + satisfied sigh | 1 | Low |

##### Trap & Hazard SFX

| Sound | Description | Variants | Priority |
|-------|-------------|----------|----------|
| **Trap Trigger (dart)** | Click + whoosh + thunk | 2 | High |
| **Trap Trigger (pit)** | Crumble + falling scream | 1 | Critical |
| **Trap Trigger (poison gas)** | Hiss + cough | 1 | High |
| **Trap Trigger (flame)** | Whoosh + roar | 1 | High |
| **Trap Disarmed** | Click + exhale of relief | 1 | Medium |
| **Floor Collapse** | Crack + crumble + dust | 1 | Critical |
| **Cave-in** | Rumble + rocks falling + dust cloud | 1 | Critical |

##### Status Condition SFX

| Sound | Description | Variants | Priority |
|-------|-------------|----------|----------|
| **Poison Applied** | Sizzle + green bubble | 1 | High |
| **Poison Tick** | Low sizzle + grunt | 1 | Medium |
| **Stun** | Bell ring + stars twinkle | 1 | High |
| **Paralysis** | Electric crackle + freeze sound | 1 | High |
| **Blind** | Dark veil whoosh + muffled audio | 1 | High |
| **Fear** | Heartbeat + trembling strings | 1 | High |
| **Charm** | Harp glissando + pink sparkle | 1 | Medium |
| **Slow** | Descending womp + time-stretch | 1 | Medium |
| **Haste** | Ascending womp + clock tick-tick | 1 | Medium |
| **Regen Tick** | Soft green pulse + chime | 1 | Low |
| **Buff Expire** | Dissipating shimmer + fading tone | 1 | Low |
| **Level Up** | Ascending fanfare + golden glow burst | 1 | Critical |
| **XP Gain** | Soft ding + sparkle | 1 | Low |

##### Ambient SFX (environmental loops, separate from music)

| Environment | Ambient SFX Loop | Volume |
|-------------|-----------------|--------|
| **Cave** | Dripping water, distant rumble, bat chirps | 0.3 |
| **Forest** | Birds, wind through leaves, distant stream | 0.4 |
| **Swamp** | Bubbling, frog croaks, insect buzz | 0.3 |
| **Town** | Crowd murmur, cart wheels, hammering, dog bark | 0.4 |
| **Mountain** | Howling wind, eagle cry, rock fall (rare) | 0.3 |
| **Desert** | Sand whisper, heat shimmer drone, distant hawk | 0.2 |
| **Underwater** | Muffled currents, bubble streams | 0.3 |
| **Infernal** | Lava bubbling, distant screams, fire crackle | 0.3 |
| **Combat** | None (ambient SFX pauses during combat, only music + action SFX) | 0.0 |

#### Audio Architecture

```
audioSystem = {
  // === Channel Architecture ===
  ambientMusic: {
    source: null,          // Web Audio BufferSourceNode
    gainNode: null,        // For fade in/out
    pausedAt: 0,           // Playback position when paused (seconds)
    currentTrack: null,    // Track ID currently loaded
    state: 'playing',      // 'playing' | 'paused' | 'stopped'
  },

  battleMusic: {
    source: null,          // Web Audio BufferSourceNode
    gainNode: null,
    layers: [],            // Additional layer nodes for dynamic events
    currentTrack: null,
    state: 'stopped',
  },

  ambientSfx: {
    source: null,          // Looping environmental sound
    gainNode: null,
    currentEnvironment: null,
    state: 'playing',
  },

  sfxPool: new Array(12),  // 12 concurrent SFX channels (up from 8)
  sfxPriority: {},         // Priority queue: Critical > High > Medium > Low

  // === Volume Controls (persisted to localStorage) ===
  masterVolume: 1.0,
  musicVolume: 0.7,
  sfxVolume: 1.0,
  ambientVolume: 0.5,

  // === Core Methods ===
  // Ambient music
  playAmbient(trackId, crossfadeMs = 3000) { /* crossfade to new ambient */ },
  pauseAmbient(fadeMs = 500) { /* fade out + save position */ },
  resumeAmbient(fadeMs = 2000) { /* resume from saved position + fade in */ },

  // Battle music
  startBattle(trackId) { /* pause ambient, start battle track */ },
  endBattle(resultSting) { /* play sting, fade battle, resume ambient */ },
  addBattleLayer(layerId) { /* overlay dynamic event layer */ },
  removeBattleLayer(layerId) { /* remove dynamic layer */ },

  // SFX
  playSfx(soundId, priority = 'medium') {
    /* Pick available channel from pool.
       If all channels busy, evict lowest-priority sound.
       If same priority, evict oldest (by start timestamp).
       If same priority AND same age (within 16ms frame), evict the
       sound with the LOWEST volume (quietest is least noticeable loss).
       Critical-priority sounds are NEVER evicted. If all 12 channels
       hold critical sounds, the new sound is dropped silently. */
  },

  // Ambient SFX
  setEnvironmentSfx(environmentId) { /* crossfade ambient SFX loop */ },
  pauseEnvironmentSfx() { /* pause during combat */ },
  resumeEnvironmentSfx() { /* resume after combat */ },
}
```

##### Battle Music Layer Precedence

When multiple battle music events overlap, a priority state machine determines which track plays:

```
Layer precedence (highest wins):
  1. boss-mythic        (CR 26-30 bosses)
  2. boss-major         (CR 17-25 bosses)
  3. boss-minor         (CR 5-16 bosses)
  4. near-death         (party average HP < 25%)
  5. phase-transition   (plays 3s sting, then reverts to boss tier)
  6. ambush             (surprise round encounters)
  7. normal             (standard combat)

State transitions:
  normal → ambush       : on surprise round start
  normal → boss-*       : on boss encounter start
  any    → near-death   : when avgPartyHp < 25% (overrides current)
  near-death → previous : when avgPartyHp >= 25% (restore previous layer)
  any    → phase-sting  : on boss phase change (3s sting, then return)
  any    → victory      : on combat end (win)
  any    → defeat       : on combat end (loss)

Only ONE battle music track plays at a time. Overlapping dynamic
layers (crit-flourish, heal-chime) are SHORT one-shot overlays on top
of the active battle track, NOT replacement tracks.
```

##### Ambient Pause Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Rapid combat re-entry** (combat ends → new combat within 2s) | Do NOT resume ambient; keep it paused. Restart battle music for new encounter. |
| **Nested events** (boss phase change during near-death) | Phase sting plays for 3s, then returns to near-death track (highest active precedence). |
| **Menu opened during combat** | Battle music continues. SFX pause. Ambient stays paused. |
| **Tab/window loses focus** | All audio pauses (Web Audio API suspend). Resume on refocus from saved positions. |
| **Combat starts while ambient is already fading in** | Cancel the fade-in, save the current position, pause immediately. |
| **Combat ends but a spell animation is still playing** | Wait for the animation SFX to finish (up to 2s max), then begin ambient fade-in. |
| **Zone transition during combat** (e.g., falling through a floor) | End current combat music. Pause briefly (500ms silence). Start new zone's ambient OR new combat music depending on whether combat continues. |

##### Combat Audio Flow (complete sequence)

```
// 1. Combat encounter triggered
ambientMusic.pauseAmbient(500);       // 500ms fade, save position
ambientSfx.pauseEnvironmentSfx();     // silence ambient SFX
battleMusic.startBattle('normal');     // or 'boss-minor', 'boss-major', etc.

// 2. During combat — each action triggers SFX + optional music event
onPlayerAttack(weapon) → playSfx(`attack-${weapon.type}`, 'high');
onHitLanded()         → playSfx('hit-received', 'high');
onCriticalHit()       → playSfx('critical-hit', 'critical');
                         addBattleLayer('crit-flourish', 1000);
onMiss()              → playSfx('miss', 'medium');
onBlock()             → playSfx('block-shield', 'high');
onEvade()             → playSfx('evade', 'medium');
onHeal()              → playSfx('heal-received', 'high');
                         addBattleLayer('heal-chime', 2000);
onSpellCast(school)   → playSfx(`spell-${school}`, 'high');
onDeath(creature)     → playSfx(`death-${creature.race}`, 'high');
onBossPhaseChange()   → battleMusic.crossfade('boss-phase-sting', 500);
                         await 3s;
                         battleMusic.crossfade('boss-track-intensified', 500);

// 3. Combat ends
onVictory() → {
  battleMusic.fadeOut(1000);
  playSfx('victory-fanfare', 'critical');
  await 5s;                               // fanfare duration
  ambientMusic.resumeAmbient(2000);       // 2s fade back in from saved position
  ambientSfx.resumeEnvironmentSfx();
}

onDefeat() → {
  battleMusic.fadeOut(1000);
  playSfx('defeat-sting', 'critical');
  await 5s;
  // transition to game over screen (no ambient resume)
}
```

##### Technical Constraints

- All audio uses the **Web Audio API** (`AudioContext`) for precise timing, gain control, and crossfading
- SFX pool of **12 channels** with priority-based eviction prevents overlap cutoff
- **Variant selection**: When a sound has multiple variants, select randomly (seeded by frame count to prevent repetition)
- Volume controls persisted to localStorage; separate sliders for Master, Music, SFX, Ambient
- All audio optional — game is fully playable with sound off (mute toggle + per-channel mute)
- Audio files are **lazy-loaded on first use** (no preloading at boot to keep startup fast)
- Audio format: **OGG Vorbis** primary (broad browser support), **MP3** fallback
- Total audio budget: ~5MB compressed (music loops ~200KB each, SFX ~5-20KB each)
- `AudioContext` created on first user interaction (browser autoplay policy compliance)

---

### 5.19 Tutorial & Onboarding

#### First-Run Tutorial Flow

New players (no localStorage save detected) are guided through a structured tutorial:

| Step | Trigger | Content | Interaction |
|------|---------|---------|-------------|
| 1 | Title screen (first load) | "Welcome to Tactical Realms" overlay | Click to continue |
| 2 | Character Select | Tooltip arrows pointing to roster, stats, select buttons | Select 2 pre-suggested characters |
| 3 | Overworld (first) | "This is the overworld" highlight; arrow to nearest dungeon | Click highlighted dungeon |
| 4 | Dungeon entry | "Explore rooms, find enemies, collect loot" | Move to first room |
| 5 | First combat | Turn order explanation, movement highlight, attack prompt | Step-by-step first combat |
| 6 | Victory | XP and loot explanation | Collect rewards |
| 7 | Camp | Party management, shop, rest tutorial | Rest and equip |
| 8 | Tutorial complete | "You're ready! Tutorial can be replayed from Settings." | Dismiss |

#### Tutorial Combat (Scripted)

- Pre-set encounter: 2 Goblins (CR ¼) on a small 6×6 grid
- Party: 2 pre-selected characters (Fighter + Cleric recommended)
- Step-by-step prompts:
  1. "Click your Fighter to select them" (highlight Fighter)
  2. "Click a blue tile to move" (highlight movement tiles)
  3. "Click the Goblin to attack" (highlight attack targets)
  4. "Watch the attack cut-in!" (auto-play cut-in)
  5. "Now use your Cleric to heal" (highlight heal spell)
  6. "Victory! You earned XP and loot."

#### Tooltip System

| Tooltip Type | When Shown | Content |
|-------------|------------|---------|
| **First-time** | First time a UI element is encountered | Brief explanation (1-2 sentences) with "Got it" dismiss |
| **Hover** | Mouse hover on any stat, item, spell | Full description, formula if applicable |
| **Contextual** | When player seems stuck (no input for 30s) | Gentle hint: "Try clicking an enemy to attack" |
| **Help overlay** | Press [H] or click "?" button | Full screen overlay explaining current game state |

#### Settings Toggle

- Tutorial can be fully disabled in Settings
- Individual tooltips can be dismissed permanently ("Don't show again" checkbox)
- Tutorial replay available from Settings menu at any time

---

### 5.20 Companion AI Behavior

Companions act independently during combat but follow configurable behavior patterns.

#### AI Behavior Modes (Player-Selectable)

| Mode | Description | Default For |
|------|-------------|-------------|
| **Follow** | Stay within 2 tiles of owner, attack enemies that attack owner | War Dog, Bear Cub |
| **Aggressive** | Target nearest enemy, attack each turn | Wolf, Pseudodragon |
| **Support** | Stay behind party, prioritize buff/heal actions | Spirit Guardian, Songbird |
| **Scout** | Move ahead of party, reveal fog of war, flee from combat | Hawk, Shadow Cat |
| **Guard** | Protect lowest-HP party member, intercept attacks | Celestial Steed |

#### Companion Combat Rules

- Companions act on the same initiative count as their owner (immediately after owner's turn)
- Companions cannot use items or be directly controlled (their AI mode determines behavior)
- Companions occupy a tile on the grid and can be targeted by enemies
- Companions do not provoke AoO when moving (small/nimble)
- Companions gain flanking bonus (+2 attack) when adjacent to an enemy with an ally on the opposite side

#### Companion Stat Scaling

```
companionHP = ownerLevel × companionBaseHD + CON_mod × ownerLevel
companionAC = 10 + naturalArmor + floor(ownerLevel / 3) + DEX_mod
companionAttack = floor(ownerLevel × 0.75) + STR_mod (or DEX_mod for ranged)
companionDamage = companionBaseDamageDie + floor(ownerLevel / 4)
companionInitiative = ownerInitiative - 1  // acts just after owner
```

| Companion | Base HD | Natural Armor | Damage Die | Special Scaling |
|-----------|---------|---------------|-----------|-----------------|
| War Dog | d8 | +2 | 1d6+STR | Trip attack DC scales with owner level |
| Wolf | d8 | +2 | 1d6+STR | Pack flanking bonus +3 (instead of +2) |
| Hawk | d4 | +0 | 1d4+DEX | Fly speed, never in melee danger |
| Familiar (Owl) | d4 | +0 | 1d3 | Deliver touch spells, +2 owner saves |
| Spirit Guardian | d6 | +4 | -- | Heal aura: 1 + floor(ownerLevel/5) HP/round |
| Shadow Cat | d6 | +1 | 1d4+DEX | Stealth, sneak attack 1d6 per 3 owner levels |
| Celestial Steed | d10 | +4 | 1d6+STR | Smite evil 1/combat (owner Paladin level) |
| Bear Cub | d10 | +3 | 1d8+STR | +2 STR while owner raging |
| Songbird | d4 | +0 | -- | +1 morale to all party per 5 owner levels |
| Quasit | d6 | +2 | 1d4+poison | Random debuff on hit (Shaken/Sickened/−2 AC) |
| Pseudodragon | d6 | +2 | 1d6 (elemental) | Mirrors 1/4 of owner's spell damage |

##### Example Stat Block: War Dog at Owner Level 10

```
War Dog (Level 10 Fighter's companion):
  HP  = 10 × d8 avg(4.5) + CON_mod(+2) × 10 = 45 + 20 = 65
  AC  = 10 + 2 (natural) + floor(10/3)=3 + DEX_mod(+1) = 16
  Atk = floor(10 × 0.75)=7 + STR_mod(+3) = +10
  Dmg = 1d6 + STR(+3) + floor(10/4)=2 = 1d6+5
  Init = owner_init − 1
  Special: Trip attack DC = 10 + ½ owner level(5) + STR_mod(3) = 18
```

##### Companion Death and Revival

- Companions reduced to 0 HP are **knocked out** (removed from combat grid)
- Companions cannot be targeted by resurrection spells
- Knocked-out companions return at the **next camp visit** with 1 HP
- In-dungeon revival: "Companion Salve" consumable (100 gp, restores companion to 50% HP)
- Companions that die during a party wipe are revived alongside the party (retreat penalty still applies)

##### Companion Equipment

- Each companion has **1 equipment slot** (collar/barding)
- Equippable items: minor stat items only (e.g., +1 AC collar, +1 attack fang, +2 HP amulet)
- Equipment must be tier ≤ T3 (companion gear is always basic)
- Companions cannot equip weapons, armor, shields, or class-specific items

---

### 5.21 Quest System

#### Quest Types

| Quest Type | Source | Duration | Rewards |
|-----------|--------|----------|---------|
| **Daily Challenge** | Auto-generated | 1 day | 100-300 gp + consumables |
| **Weekly Quest Chain** | Auto-generated | 1 week (3-5 steps) | 500-1500 gp + rare equipment |
| **Monthly Epic Quest** | Auto-generated | 1 month | 2000-5000 gp + epic equipment + title |
| **Prestige Quest** | Town Promotion Hall | Until completed | Prestige class unlock |
| **NPC Side Quest** | Town NPCs | Varies | Gold + unique item + faction reputation |

#### Quest Structure

Each quest consists of:
```
quest = {
  id: string,              // unique quest ID
  title: string,           // "Slay the Shadow Pack"
  description: string,     // flavor text
  type: 'daily'|'weekly'|'monthly'|'prestige'|'side',
  objectives: [            // ordered list of objectives
    { type: 'kill', target: 'Shadow-Goblin', count: 10, current: 0 },
    { type: 'collect', item: 'Shadow Shard', count: 3, current: 0 },
    { type: 'explore', dungeon: 'Shadow Cavern', floor: 3 },
    { type: 'boss', bossId: 'shadow-dragon' },
    { type: 'deliver', npcId: 'town-elder', item: 'Shadow Shard' }
  ],
  rewards: { gold: 500, xp: 200, items: ['rare-shadow-blade'] },
  timeLimit: null,         // or Date for timed quests
  status: 'available'|'active'|'completed'|'expired',

  // === Prerequisites (all must be met for quest to appear as 'available') ===
  prerequisites: {
    level: null,           // minimum party average level (null = no requirement)
    class: null,           // required class in active party (null = any)
    race: null,            // required race in active party (null = any)
    items: [],             // items that must be in inventory (consumed on accept if consumeItems = true)
    consumeItems: false,   // whether prerequisite items are consumed on quest accept
    // Quest Item Consumption Edge Cases:
    // - Items are consumed ONLY on quest ACCEPT, not on quest display/hover
    // - If consumeItems is true and the player declines the quest, items are NOT consumed
    // - If the player accepts but then abandons the quest, consumed items are LOST (not refunded)
    // - If the party wipes during a quest with consumed items, the items remain consumed (incentive to not die)
    // - If consumeItems is true but the item count drops below required (e.g., sold between checking and accepting), the accept button is grayed out
    // - Quest items (items that exist solely as prerequisites) are flagged `questItem: true` and cannot be sold, dropped, or traded
    // - Non-quest items used as prerequisites (e.g., a standard Health Potion) CAN be sold/used before accepting
    quests: [],            // quest IDs that must be completed first (quest chains)
    faction: null,         // { factionId, minReputation } — minimum faction reputation
    event: null,           // yearly event window required (null = always available)
    dayOfWeek: null,       // day-of-week schedule (null = any day)
    season: null,          // season required: 'spring'|'summer'|'autumn'|'winter' (null = any)
    dateRange: null,       // { start: 'MM-DD', end: 'MM-DD' } — specific date window
    bossDefeated: null,    // boss ID that must have been defeated at least once
    dungeonCleared: null,  // dungeon ID that must have been fully cleared
    prestige: null,        // prestige path required (null = any)
  }
}
```

#### Quest Log UI

- Accessible via [Q] key or quest log icon in HUD
- Shows: active quests, available quests, completed quests (history)
- Each quest shows: title, objectives with progress bars, rewards, time remaining
- Active quests have objective tracking displayed on the minimap (quest markers)
- Maximum 3 active quests simultaneously (1 daily, 1 weekly, 1 other)

##### Quest Log Layout

```
┌─── Quest Log ──────────────────────────────────────────────────┐
│  [Active]  [Available]  [Completed]           [X Close]        │
├────────────────────┬───────────────────────────────────────────┤
│  Quest List        │  Quest Detail                             │
│                    │                                           │
│  > ★ Daily Hunt    │  ★ Daily Hunt                             │
│    ⏳ 14h left     │  ─────────────────────────                │
│                    │  Kill 8 Goblins        [████████░░] 6/8   │
│    ★ Weekly Raid   │  Collect 2 Iron Ore    [████░░░░░░] 1/2   │
│    ⏳ 5d left      │                                           │
│                    │  Rewards:                                 │
│    ★ Shadow Chain  │    500 gold, 2400 XP                     │
│      Part 2       │                                           │
│                    │  Time remaining: 14h 23m                  │
│                    │                                           │
│  ── Locked ──      │  [Abandon Quest]                          │
│  🔒 Tiefling's    │                                           │
│     Bargain       │                                           │
│  🔒 ??? Secret    │                                           │
│                    │                                           │
├────────────────────┴───────────────────────────────────────────┤
│  Quest markers: shown on minimap as ★ icons                    │
└────────────────────────────────────────────────────────────────┘
```

- Left panel: scrollable list of quests, grouped by Active/Locked
- Right panel: detail view of selected quest
- Tab buttons at top switch between Active, Available (can accept), and Completed (history)
- Locked quests in Available tab show padlock + prerequisites
- Clicking a quest in the list selects it and shows detail on the right
- "Abandon Quest" button available for non-daily/non-weekly quests (daily/weekly cannot be abandoned)
- Progress bars use filled/empty blocks for each objective
- Time remaining shown for daily (resets at 00:00 UTC) and weekly (resets Monday 00:00 UTC) quests

#### Daily Quest Generation

```
dailySeed = hash(dateString)
dailyQuest = {
  objectives: [
    randomObjective(dailySeed, 'kill', { CR: partyAvgLevel }),
    randomObjective(dailySeed + 1, 'collect', { rarity: 'uncommon' })
  ],
  rewards: { gold: 100 + partyAvgLevel * 20, xp: partyAvgLevel * 50 },
  prerequisites: null  // Daily quests have NO prerequisites (always available)
}

// randomObjective() — deterministic objective generator
function randomObjective(seed, type, params) {
  const rng = seededRNG(seed);
  switch (type) {
    case 'kill': {
      // Pick a monster at or below the specified CR from the bestiary
      const candidates = bestiary.filter(m => m.cr <= params.CR && m.cr >= params.CR - 2);
      const target = candidates[rng.nextInt(candidates.length)];
      const count = 5 + rng.nextInt(11);  // 5-15 kills
      return { type: 'kill', target: target.id, targetName: target.name, count, current: 0 };
    }
    case 'collect': {
      // Pick a collectible item of the specified rarity
      const candidates = lootTable.filter(i => i.rarity === params.rarity);
      const item = candidates[rng.nextInt(candidates.length)];
      const count = 1 + rng.nextInt(3);   // 1-3 items
      return { type: 'collect', item: item.id, itemName: item.name, count, current: 0 };
    }
    case 'explore':
      return { type: 'explore', dungeon: activeDungeon.id, floor: 1 + rng.nextInt(activeDungeon.maxFloors) };
    case 'boss':
      return { type: 'boss', bossId: weeklyBoss.id };
    case 'deliver':
      return { type: 'deliver', npcId: randomNpc(rng).id, item: params.item };
  }
}
```

##### Weekly Quest Generation

```
weeklySeed = hash(yearWeekString)
weeklyQuest = {
  title: weeklyQuestTemplates[weeklySeed % weeklyQuestTemplates.length].title,
  type: 'weekly',
  objectives: [
    randomObjective(weeklySeed, 'kill', { CR: partyAvgLevel + 1 }),
    randomObjective(weeklySeed + 1, 'explore', {}),
    randomObjective(weeklySeed + 2, 'collect', { rarity: 'rare' }),
    // 3-5 objectives (seeded count)
  ],
  rewards: { gold: 500 + partyAvgLevel * 50, xp: partyAvgLevel * 200, items: [randomRareItem(weeklySeed)] },
  prerequisites: null  // Weekly quests have NO prerequisites
}
```

##### Quest Prerequisite Validation (Anti-Circular)

Daily and weekly quests never have prerequisites. Only side quests, prestige quests, and monthly quests can have prerequisites. The system validates against circular chains at quest registration:

```
function validateQuestChain(questId, allQuests, visited = new Set()) {
  if (visited.has(questId)) throw Error(`Circular quest dependency: ${questId}`);
  visited.add(questId);
  const quest = allQuests.get(questId);
  if (quest?.prerequisites?.quests)
    for (const prereqId of quest.prerequisites.quests)
      validateQuestChain(prereqId, allQuests, new Set(visited));
}
// Called at game init for all static quests, and at generation time for procedural quests
```

#### Quest Prerequisites System

Quests can be gated behind one or more prerequisites. A quest only appears as `available` in the quest log when **all** of its prerequisites are satisfied. Locked quests appear as grayed-out entries with a tooltip listing unmet conditions.

##### Prerequisite Types

| Prerequisite | Field | Check Logic | Example |
|-------------|-------|-------------|---------|
| **Level** | `level: 10` | Party average level ≥ value | Epic quests require level 10+ |
| **Class** | `class: 'paladin'` | At least one active party member has that class | "Holy Crusade" requires a Paladin |
| **Race** | `race: 'dwarf'` | At least one active party member is that race | "Mithral Forge" requires a Dwarf |
| **Item Possession** | `items: ['shadow-key']` | All listed items exist in inventory | "Shadowfell Portal" requires Shadow Key |
| **Item Consumption** | `items: ['ancient-scroll'], consumeItems: true` | Items exist and are consumed on quest accept | "Summon the Elder" consumes Ancient Scroll |
| **Quest Chain** | `quests: ['q-shadow-1', 'q-shadow-2']` | All listed quest IDs completed | "Shadow Finale" requires parts 1 & 2 |
| **Faction Reputation** | `faction: { factionId: 'thieves-guild', minReputation: 20 }` | Faction rep ≥ threshold | "Inner Circle" requires Thieves' Guild rep 20+ |
| **Yearly Event** | `event: 'halloween'` | Current date is within the event window | "Haunted Crypt" only during Halloween |
| **Day of Week** | `dayOfWeek: [1, 3, 5]` | Current real-world day (0=Sun..6=Sat) matches | "Monday Market" available Mon/Wed/Fri |
| **Season** | `season: 'winter'` | Current real-world season matches | "Frost Giant's Challenge" only in winter |
| **Date Range** | `dateRange: { start: '12-20', end: '01-02' }` | Current date within MM-DD range (wraps year) | Christmas event quests |
| **Boss Defeated** | `bossDefeated: 'lich-king'` | Player has defeated that boss at least once (lifetime) | "Lich's Legacy" requires Lich King kill |
| **Dungeon Cleared** | `dungeonCleared: 'shadow-cavern'` | Player has cleared all floors of that dungeon | "Deep Secrets" requires full Shadow Cavern clear |
| **Prestige Path** | `prestige: 'assassin'` | At least one party member has that prestige path | "Assassin's Contract" requires Assassin path |

##### Prerequisite Evaluation

```
function isQuestAvailable(quest, gameState) {
  const pre = quest.prerequisites;
  if (!pre) return true;  // no prerequisites = always available

  if (pre.level && gameState.partyAverageLevel < pre.level) return false;
  if (pre.class && !gameState.activeParty.some(m => m.class === pre.class)) return false;
  if (pre.race && !gameState.activeParty.some(m => m.race === pre.race)) return false;
  if (pre.items?.length && !pre.items.every(id => gameState.inventory.has(id))) return false;
  if (pre.quests?.length && !pre.quests.every(id => gameState.completedQuests.has(id))) return false;
  if (pre.faction && gameState.factionReputation[pre.faction.factionId] < pre.faction.minReputation) return false;
  if (pre.event && !isEventActive(pre.event, gameState.currentDate)) return false;
  if (pre.dayOfWeek && !pre.dayOfWeek.includes(gameState.currentDate.getDay())) return false;
  if (pre.season && getCurrentSeason(gameState.currentDate) !== pre.season) return false;
  if (pre.dateRange && !isInDateRange(gameState.currentDate, pre.dateRange)) return false;
  if (pre.bossDefeated && !gameState.defeatedBosses.has(pre.bossDefeated)) return false;
  if (pre.dungeonCleared && !gameState.clearedDungeons.has(pre.dungeonCleared)) return false;
  if (pre.prestige && !gameState.activeParty.some(m => m.prestigePath === pre.prestige)) return false;

  return true;
}
```

##### Example Gated Quests

| Quest | Prerequisites | Flavor |
|-------|--------------|--------|
| **"The Mithral Forge"** | `race: 'dwarf', level: 8, items: ['mithral-ore']` | A Dwarven smith needs mithral ore to reforge an ancient weapon. Only a Dwarf can negotiate access to the Forge. |
| **"Lolth's Web"** | `event: 'halloween', class: 'rogue', bossDefeated: 'ettercap-broodmother'` | During Halloween, a portal to the Demonweb Pits opens. Only a Rogue who has proven themselves against spiders may enter. |
| **"The Sunday Market"** | `dayOfWeek: [0], level: 3` | Every Sunday, a mysterious merchant appears with rare wares and a quest. |
| **"Frost Giant's Challenge"** | `season: 'winter', level: 15` | The Frost Giant Jarl issues a challenge only when winter grips the land. |
| **"Holy Crusade"** | `class: 'paladin', faction: { factionId: 'temple-of-helm', minReputation: 15 }` | The Temple of Helm calls upon a Paladin of proven faith to cleanse a corrupted shrine. |
| **"Shadow Chain: Part 3"** | `quests: ['shadow-chain-1', 'shadow-chain-2'], items: ['shadow-shard']` | The final chapter of the Shadow Chain requires completion of parts 1 & 2 and possession of a Shadow Shard. |
| **"Valentine's Rose Garden"** | `dateRange: { start: '02-10', end: '02-18' }` | A magical rose garden blooms only around Valentine's Day. |
| **"Tiefling's Bargain"** | `race: 'tiefling', prestige: 'fiend-pact'` | A Tiefling Warlock of the Fiend Pact is offered a dangerous bargain by their patron. |
| **"Chinese New Year Dragon Dance"** | `event: 'chinese-new-year', bossDefeated: 'young-black-dragon'` | During Chinese New Year, a dragon spirit challenges those who have slain dragonkind. |
| **"Wednesday Night Fights"** | `dayOfWeek: [3], level: 5` | Every Wednesday, an underground arena opens in the town tavern basement. |

##### Quest Lock UI

- Locked quests appear in the quest log with a **padlock icon** and grayed-out text
- Hovering/tapping shows a tooltip listing all unmet prerequisites in plain language:
  - "Requires: Dwarf in party" / "Requires: Level 8+" / "Requires: Mithral Ore in inventory"
  - "Available during: Halloween event" / "Available on: Sundays"
  - "Requires: Defeat the Lich King first"
- Met prerequisites show with a green checkmark; unmet show with a red X
- Some secret quests have hidden prerequisites that display as "???" until discovered (via NPC dialogue hints or bestiary entries)

##### Secret Quest Prerequisite Discovery

Secret quests show "???" for unmet hidden prerequisites. These are revealed through specific in-game actions:

| Discovery Method | How It Works | Example |
|-----------------|-------------|---------|
| **NPC dialogue hint** | Talking to a specific NPC reveals one "???" prerequisite as readable text | Elminster says "I hear the Underdark holds a key to ancient power..." → reveals "Requires: Clear Underdark dungeon" |
| **Bestiary entry** | Killing enough of a monster type (reaching "Studied" rank) reveals quest prerequisites tied to that monster | Studying Beholders reveals "Defeat Beholder Hive Mother" as a quest prerequisite |
| **Lore item** | Finding a lore book/scroll in a dungeon reveals a hidden prerequisite | Reading "Tome of the Shadow Chain" reveals the prerequisite for Shadow Chain Part 3 |
| **Achievement unlock** | Completing an achievement reveals associated secret quest prerequisites | "Dragon Slayer" achievement reveals dragon-related quest prerequisites |
| **Faction reputation** | Reaching a reputation threshold with a faction reveals their secret quests | Reaching "Trusted" with Thieves' Guild reveals hidden heist quests |

Discovery state is persisted in the save data:
```js
questDiscovery: {
  revealedPrereqs: {
    'secret-quest-001': ['npcHint:elminster', 'bestiaryRank:beholder'],
    'secret-quest-002': ['loreItem:tome-shadow-chain']
  }
}
```

A prerequisite that has been discovered but not yet met shows as normal red-X text (e.g., "Requires: Clear Underdark dungeon ✗"). An undiscovered prerequisite stays as "??? ✗". Once ALL prerequisites are discovered (even if not met), the quest title and description become fully visible.

---

### 5.22 NPC & Dialogue System

#### NPC Types

| NPC Type | Location | Function |
|----------|----------|----------|
| **Shopkeeper** | Town | Opens shop UI on interaction |
| **Trainer** | Town | Opens trainer UI on interaction |
| **Quest Giver** | Town | Offers/tracks quests, dialogue |
| **Innkeeper** | Town | Full party rest (50 gp), rumor/hints |
| **Town Elder** | Town | Lore, world state, seasonal event info |
| **Wandering Merchant** | Overworld (random) | Limited stock, rare items at premium (see Wandering Merchant Rules below) |
| **Mysterious Stranger** | Dungeon (rare) | One-time trade or gamble (see Mysterious Stranger Rules below) |

#### Dialogue System

Dialogue trees use a simple node-based structure:

```
dialogueNode = {
  id: string,
  speaker: string,           // NPC name
  text: string,              // dialogue text
  responses: [
    { text: "Tell me more.", next: 'node_2' },
    { text: "I'll take the quest.", action: 'acceptQuest', questId: 'q001', next: 'node_3' },
    { text: "Goodbye.", next: null }  // null = end dialogue
  ],
  conditions: {              // optional prerequisites
    minLevel: 5,
    hasItem: 'shadow-shard',
    questComplete: 'q001'
  }
}
```

#### Forgotten Realms NPCs (Flavor)

| NPC | Role | Town | Notable |
|-----|------|------|---------|
| **Elminster Aumar** | Sage/Quest Giver | Starting town | Gives main quest hints, monthly lore |
| **Drizzt Do'Urden** | Wandering Merchant | Overworld (rare) | Sells Underdark items at fair price |
| **Volothamp Geddarm** | Innkeeper | Various towns | Rumors, hints, bestiary entries |
| **Durnan** | Innkeeper/Quest Giver | Waterdeep-themed town | Dungeon challenge quests |
| **Xanathar** | Black Market | Hidden (quest unlock) | Rare/forbidden items, 3× price |

#### Faction Reputation (Simple)

| Faction | Reputation Effects |
|---------|-------------------|
| **Town Guard** | +rep from quests: better shop prices (−10% per tier), access to restricted areas |
| **Thieves' Guild** | +rep from stealth quests: black market access, fence stolen items |
| **Mages' Guild** | +rep from arcane quests: spell discount, rare scrolls |
| **Temple** | +rep from holy quests: free healing, resurrection discount |

Reputation is tracked per town, ranges from −100 (hostile) to +100 (revered), starts at 0 (neutral).

#### Wandering Merchant Encounter Rules

| Property | Rule |
|----------|------|
| **Spawn chance** | 15% per overworld chunk the party enters for the first time each day. Rerolled daily (same seed = same merchant positions). |
| **Appearance** | Visible as a distinct NPC sprite on the overworld tile. Does NOT ambush or appear suddenly. |
| **Stock** | 4-8 items, seeded by `hash(dailySeed, chunkX, chunkY)`. Items are 1-2 tiers above what the nearest town sells. Always includes at least 1 consumable and 1 equipment piece. |
| **Pricing** | 1.5× normal shop prices for buying. 0.75× normal sell prices (worse than town). |
| **Rare items** | 25% chance to stock one item from the "rare" pool (items not available in any town shop). |
| **Persistence** | Merchant remains on the tile until the party leaves the chunk. Re-entering the same chunk on the same day: 50% chance the merchant is still there (wandered off). Next day: always gone (new spawn roll). |
| **Interaction limit** | No limit on transactions. The merchant has unlimited gold for buying player items. |
| **Named merchants** | Drizzt Do'Urden, Volothamp Geddarm, and other named NPCs appear as wandering merchants with unique stock pools. |
| **Hostile territory** | Merchants do NOT spawn in chunks with `effectiveDifficulty >= 8` or in dungeon dimensions (too dangerous). |

#### Mysterious Stranger Encounter Rules

| Property | Rule |
|----------|------|
| **Spawn chance** | 5% per dungeon room entered. Only 1 stranger per dungeon run. |
| **Offers** | One of: (a) Trade — swap a specific item for a rare item, (b) Gamble — pay gold for a random item (50% chance great, 50% chance junk), (c) Information — reveals boss weakness or secret room location for 100 gp. |
| **One-time** | The stranger vanishes after the interaction (accept or decline). Cannot be re-encountered in the same dungeon. |
| **Persistence** | Not saved between dungeon runs. Each run gets a fresh stranger roll. |

#### Dialogue Interaction UI

The dialogue system is presented as a simple text-box overlay:

```
┌─────────────────────────────────────────────────────┐
│ ┌─────────┐                                         │
│ │ Portrait│  Speaker Name                           │
│ │  64×64  │                                         │
│ │         │  "Dialogue text displayed here, shown   │
│ └─────────┘   one character at a time (typewriter    │
│               effect, ~30 chars/sec). Click/tap to   │
│               show all text instantly."               │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ > Response option 1 (hover highlight)        │   │
│  │   Response option 2                          │   │
│  │   Response option 3                          │   │
│  │   [Goodbye]                                  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

UI rules:
- **Mouse-only interaction**: Click/tap to advance text, click a response option to select it
- **No keyboard shortcuts** (consistent with mouse-only design principle)
- **Typewriter effect**: Text appears one character at a time. Clicking during typewriter skips to full text.
- **Response options**: Appear only after full text is displayed. Highlighted on hover. Click to select.
- **Conditional responses**: Responses with unmet conditions (too low level, missing item) appear grayed out with a tooltip explaining why
- **Quest-giving**: "Accept quest" responses have a quest icon prefix. Accepting immediately adds the quest to the quest log.
- **Shop/trainer**: "Show me your wares" transitions to the shop/trainer UI overlay
- **Portrait**: NPC portrait is 64×64 pixels, displayed left-aligned. If no portrait exists, show a generic silhouette for the NPC type.
- **Close**: Clicking outside the dialogue box or selecting "Goodbye" closes the dialogue

#### NPC Dialogue User Stories

**US-NPC-01**: As a player, I can talk to NPCs by clicking on them.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Clicking an NPC on the overworld or in town opens the dialogue UI |
| AC2 | The NPC's portrait and name appear in the dialogue box |
| AC3 | Dialogue text appears with a typewriter effect |
| AC4 | Response options appear after text finishes displaying |

**US-NPC-02**: As a player, I can accept quests from NPCs through dialogue.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Quest-giving dialogue options have a quest icon prefix |
| AC2 | Selecting "Accept quest" adds the quest to the quest log |
| AC3 | The NPC's dialogue changes after quest acceptance (acknowledges the quest) |
| AC4 | If the quest has prerequisites I don't meet, the option is grayed out with a tooltip |

**US-NPC-03**: As a player, I can buy and sell items through NPC dialogue.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Selecting "Show me your wares" opens the shop UI |
| AC2 | Closing the shop UI returns to the dialogue |
| AC3 | Trainer NPCs offer training options with gold costs displayed |

**US-NPC-04**: As a player, I can get hints from innkeepers and elders.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Innkeepers offer rumors that hint at secret quests or boss weaknesses |
| AC2 | Town elders provide lore about the current monthly dungeon themes |
| AC3 | Hints rotate monthly (seeded by monthly seed) |
| AC4 | Each hint can reveal a hidden quest prerequisite (see Secret Quest Discovery) |

**US-NPC-05**: As a player, I can interact with wandering merchants on the overworld.

| # | Acceptance Criterion |
|---|---------------------|
| AC1 | Wandering merchants appear as distinct sprites on overworld tiles |
| AC2 | Clicking opens dialogue with "Browse wares" option |
| AC3 | Merchant stock includes items 1-2 tiers above nearest town |
| AC4 | Prices are 1.5× normal (displayed with markup indicator) |
| AC5 | The merchant may disappear when I leave and return to the tile |

---

### 5.23 Inventory Management

#### Inventory Layout

Grid-based inventory with drag-and-drop:

```
inventory = {
  grid: 6 × 8 cells (48 slots),    // main backpack
  equipped: {                        // equipment slots (displayed as paper doll)
    weapon: null, shield: null, helmet: null,
    armor: null, boots: null, accessory: null
  },
  companion: { slot: null },         // companion's single equip slot
  gold: 0                            // party gold (no weight)
}
```

#### Encumbrance (D&D 3.5e Simplified)

| Load | Weight Limit | Effect |
|------|-------------|--------|
| **Light** | ≤ STR × 5 lbs | No penalty |
| **Medium** | ≤ STR × 10 lbs | −1 movement speed, max DEX bonus +3 |
| **Heavy** | ≤ STR × 15 lbs | −2 movement speed, max DEX bonus +1, −6 check penalty |
| **Over** | > STR × 15 lbs | Cannot move. Must drop items. |

Items have weight values:
| Category | Weight |
|----------|--------|
| Weapon (light) | 1-2 lbs |
| Weapon (heavy) | 5-10 lbs |
| Armor (cloth) | 2 lbs |
| Armor (plate) | 30-50 lbs |
| Shield | 5-15 lbs |
| Potion | 0.5 lbs |
| Scroll | 0.1 lbs |
| Accessory | 0.5 lbs |

#### Inventory UI Features

| Feature | Description |
|---------|-------------|
| **Drag-and-drop** | Move items between slots; equip by dragging to paper-doll slot |
| **Right-click context menu** | Use, Equip, Drop, Sell (if in shop), Study (scrolls, if caster) |
| **Comparison tooltip** | Hover over equipment while another is equipped: green/red stat deltas |
| **Sort buttons** | Sort by: Name, Rarity, Type, Value, Weight |
| **Filter tabs** | All, Weapons, Armor, Consumables, Quest Items |
| **Stack display** | Stackable items (potions, scrolls, bombs) show count badge |
| **Locked items** | Quest items and equipped items cannot be accidentally dropped |

##### Drag-and-Drop Visual Feedback

| State | Visual |
|-------|--------|
| **Dragging** | Item follows cursor at 50% opacity. Source slot shows a dashed border ("ghost" of the item). |
| **Valid drop target** | Target slot highlights with green border (2px solid). Comparison tooltip appears if equipping to paper-doll slot. |
| **Invalid drop target** | Target slot highlights with red border + "not allowed" cursor (`cursor: not-allowed`). Tooltip explains why (e.g., "Cannot equip: requires STR 16"). |
| **Drop on empty slot** | Item moves instantly. Source slot clears. No animation. |
| **Drop on occupied slot** | Items swap: the displaced item returns to the source slot. Both slots flash briefly. |
| **Drop outside inventory** | Item returns to source slot with a snap-back animation (200ms ease-out). No item is lost. |
| **Drop on "Sell" zone (shop)** | Confirmation prompt: "Sell [Item Name] for [X] gold?" with Yes/No buttons. |
| **Drop on "Drop" zone** | Confirmation prompt: "Drop [Item Name]? It will be lost permanently." Quest items cannot be dropped. |

#### Stack Sizes

| Item Type | Max Stack |
|-----------|-----------|
| Potions | 20 |
| Scrolls | 10 |
| Bombs | 10 |
| Torches | 10 |
| Lockpicks | 20 |
| Trap Kits | 5 |
| Camp Rations | 5 |

---

### 5.24 Difficulty & Pathfinding

#### Difficulty Settings

| Setting | Enemy HP | Enemy Damage | XP Multiplier | Gold Multiplier | Loot Rate |
|---------|----------|-------------|---------------|-----------------|-----------|
| **Easy** | 75% | 75% | 1.0× | 1.2× | 1.2× |
| **Normal** | 100% | 100% | 1.0× | 1.0× | 1.0× |
| **Hard** | 125% | 125% | 1.25× | 0.9× | 0.9× |
| **Nightmare** | 150% | 150% | 1.5× | 0.8× | 0.8× |

- Difficulty can be changed at any time from Settings (takes effect next combat)
- Leaderboards are separated by difficulty
- Nightmare difficulty enables permadeath: dead characters cannot be resurrected

##### Nightmare Risk/Reward Balance

Nightmare's 1.5× XP multiplier may seem insufficient vs permadeath risk. The full reward profile:

| Reward Category | Nightmare Bonus | Justification |
|----------------|----------------|---------------|
| XP multiplier | 1.5× | Faster leveling partially offsets permadeath time loss |
| Loot rate | 0.8× (penalty) | Fewer drops, but drops that DO occur have +1 rarity tier uplift |
| Rarity uplift | Common→Uncommon, Uncommon→Rare, etc. | Nightmare loot is rarer quality to offset lower drop rate |
| Exclusive cosmetics | Nightmare-only character skins and equipment visuals | Bragging rights; purely cosmetic |
| Leaderboard | Separate Nightmare leaderboard | Competitive prestige |
| Boss loot | +15% boss unique drop chance (45%/50%/45% base → 60%/65%/60%) | Best gear comes from bosses in Nightmare |
| Achievement | Nightmare-exclusive achievements | Permanent account unlock |

Net assessment: Nightmare is for challenge-seekers, not for optimal farming. The rarity uplift and boss loot bonus provide meaningful gear advantages, but the permadeath cost is always higher than the reward. This is intentional — Nightmare is opt-in masochism, not the "correct" way to play.

##### Solo Play CR Adjustment

The game is balanced for a party of 4. Players who run with fewer characters receive a CR adjustment to maintain fairness:

```
partySize = activeParty.length  // 1-4
partySizeModifier = {
  4: 0,   // standard balance
  3: -1,  // encounters slightly easier
  2: -2,  // encounters notably easier
  1: -4,  // solo: significant CR reduction
}[partySize]

encounterCR = max(1, partyAverageLevel + difficultyOffset + partySizeModifier)
bossCR = max(2, partyAverageLevel + 4 + difficultyOffset + partySizeModifier)
```

Additional solo play rules:
- Solo characters gain +2 Initiative (faster reaction without party coordination)
- Solo characters can carry 2× inventory capacity (no party to share load)
- Companion creatures count as 0.5 party members for CR calculation (solo + companion = party size 1.5 → rounds to modifier -3)
- Solo death is instant game over (no allies to revive). On Easy difficulty, solo characters get a free "second wind" 1/dungeon: revive at 25% HP instead of dying.

#### CR-to-Party-Level Encounter Balancing

```
// Standard encounter
encounterCR = max(1, partyAverageLevel + difficultyOffset + partySizeModifier)
// difficultyOffset: Easy = -2, Normal = 0, Hard = +1, Nightmare = +2
// partySizeModifier: 4=0, 3=-1, 2=-2, 1=-4

// Boss encounter (always challenging)
bossCR = max(2, partyAverageLevel + 4 + difficultyOffset + partySizeModifier)
```

#### Pathfinding — Bidirectional A* (cached, shared, async)

The pathfinding system uses **bidirectional A*** for faster convergence, a **shared path cache** across all units, and **asynchronous computation** to avoid blocking the main thread.

##### Algorithm: Bidirectional A*

Standard A* expands from source toward goal. Bidirectional A* expands from **both ends simultaneously** and terminates when the two search frontiers meet. This reduces the search space from O(b^d) to O(b^(d/2)) on average.

```
function bidirectionalAStar(grid, start, goal, costFn) {
  const openForward  = new MinHeap();  // priority queue from start
  const openBackward = new MinHeap();  // priority queue from goal
  const closedForward  = new Map();    // start-side visited nodes
  const closedBackward = new Map();    // goal-side visited nodes

  openForward.push({ node: start, g: 0, f: heuristic(start, goal) });
  openBackward.push({ node: goal, g: 0, f: heuristic(goal, start) });

  let bestPath = null;
  let bestCost = Infinity;

  while (!openForward.empty() && !openBackward.empty()) {
    // Expand whichever frontier has the smaller minimum f-value
    if (openForward.peekF() <= openBackward.peekF())
      expandForward();
    else
      expandBackward();

    // Check if frontiers have met
    const meetNode = findOverlap(closedForward, closedBackward);
    if (meetNode) {
      const cost = closedForward.get(meetNode).g + closedBackward.get(meetNode).g;
      if (cost < bestCost) {
        bestCost = cost;
        bestPath = reconstructPath(closedForward, closedBackward, meetNode);
      }
      // Terminate if no open node can improve
      if (openForward.peekF() + openBackward.peekF() >= bestCost)
        return bestPath;
    }
  }
  return bestPath; // null if no path exists
}

// --- Helper functions ---

function expandForward() {
  const current = openForward.pop();
  closedForward.set(current.node, { g: current.g, parent: current.parent });

  for (const neighbor of grid.neighbors(current.node)) {
    if (closedForward.has(neighbor)) continue;
    const tentativeG = current.g + costFn(current.node, neighbor);
    const existing = openForward.find(neighbor);
    if (!existing || tentativeG < existing.g)
      openForward.push({ node: neighbor, g: tentativeG, f: tentativeG + heuristic(neighbor, goal), parent: current.node });
  }
}

function expandBackward() {
  const current = openBackward.pop();
  closedBackward.set(current.node, { g: current.g, parent: current.parent });

  for (const neighbor of grid.neighbors(current.node)) {
    if (closedBackward.has(neighbor)) continue;
    const tentativeG = current.g + costFn(neighbor, current.node);  // reverse cost
    const existing = openBackward.find(neighbor);
    if (!existing || tentativeG < existing.g)
      openBackward.push({ node: neighbor, g: tentativeG, f: tentativeG + heuristic(neighbor, start), parent: current.node });
  }
}

function findOverlap(closedFwd, closedBwd) {
  // Check the most recently expanded node from each frontier
  // against the opposite closed set. Return first overlap found.
  for (const [node] of closedFwd) {
    if (closedBwd.has(node))
      return node;
  }
  return null;
}

function reconstructPath(closedFwd, closedBwd, meetNode) {
  // Build path from start → meetNode (forward chain)
  const forwardPath = [];
  let node = meetNode;
  while (node !== null) {
    forwardPath.unshift(node);
    node = closedFwd.get(node)?.parent ?? null;
  }
  // Build path from meetNode → goal (backward chain, reversed)
  node = closedBwd.get(meetNode)?.parent ?? null;
  while (node !== null) {
    forwardPath.push(node);
    node = closedBwd.get(node)?.parent ?? null;
  }
  return forwardPath;
}
```

##### Cache Full Invalidation

```
function invalidateAll() {
  ++pathCache.generation;  // all existing entries become stale (generation mismatch)
}
```

##### LRU Eviction

```
function _evictLRU() {
  let oldest = null;
  let oldestTime = Infinity;
  for (const [key, entry] of pathCache.store) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldest = key;
    }
  }
  if (oldest) pathCache.store.delete(oldest);
}

// Note: `lastUsed` is updated on every get() hit, not just on set().
// Cache size is measured in entries (max 256), not bytes.
// Eviction removes 1 entry per overflow (called from set()).
```

##### Movement Cost Rules

| Rule | Description |
|------|-------------|
| **Base movement cost** | Per terrain type (see 5.8 Terrain System): Plains 1, Forest 2, Mountain 3, etc. |
| **Diagonal movement** | Costs 1.5× the terrain cost (alternating 1-2 per D&D 3.5e diagonal rule) |
| **Unit blocking** | Occupied tiles block movement for enemies; allies can move through each other but not end on same tile |
| **Flying units** | Ignore terrain movement costs (always cost 1 per tile), can pass over occupied tiles, immune to ground traps |
| **Teleportation** | Instant move to target tile; ignores all obstacles, terrain, and AoO |
| **Difficult terrain** | Costs 2× normal movement (stacks with base terrain cost) |
| **Charge** | Must move in a straight line, at least 2 tiles, no obstacles. +2 attack, −2 AC |
| **Withdraw** | Full movement action that does not provoke AoO from the first threatened tile left |
| **5-Foot Step** | Move 1 tile without provoking AoO (replaces normal movement action) |

##### Shared Path Cache

All units share a single **path cache** to avoid redundant computation. The cache is keyed by `(start, goal, movementMode)` and stores computed paths.

```
pathCache = {
  store: new Map(),       // key: `${sx},${sy}-${gx},${gy}-${mode}` → path[]
  maxEntries: 256,        // LRU eviction when exceeded
  generation: 0,          // incremented on cache invalidation

  get(start, goal, mode) {
    const key = this._key(start, goal, mode);
    const entry = this.store.get(key);
    if (entry && entry.generation === this.generation)
      return entry.path;  // cache hit
    return null;           // cache miss
  },

  set(start, goal, mode, path) {
    if (this.store.size >= this.maxEntries)
      this._evictLRU();
    const key = this._key(start, goal, mode);
    this.store.set(key, { path, generation: this.generation, lastUsed: Date.now() });
  },

  // Partial cache reuse: if a cached path passes through the requested start,
  // return the sub-path from that point onward (avoids full recompute)
  getPartial(start, goal, mode) {
    for (const [key, entry] of this.store) {
      if (entry.generation !== this.generation) continue;
      const idx = entry.path.findIndex(n => n.x === start.x && n.y === start.y);
      const endIdx = entry.path.findIndex(n => n.x === goal.x && n.y === goal.y);
      if (idx !== -1 && endIdx !== -1 && endIdx > idx)
        return entry.path.slice(idx, endIdx + 1);
    }
    return null;
  }
}
```

##### Cache Invalidation Rules

The cache is invalidated (generation incremented, old entries stale) when:

| Event | Invalidation Scope |
|-------|-------------------|
| **Unit moves** | Invalidate paths passing through old/new position (partial) |
| **Unit dies / removed** | Invalidate paths passing through that tile (partial) |
| **Terrain changes** | Invalidate all paths through affected tiles (partial) |
| **Door opens / closes** | Invalidate all paths through that tile (partial) |
| **New combat round starts** | Full invalidation (unit positions may have changed) |
| **Floor transition** | Full invalidation (entirely new grid) |

Partial invalidation scans only affected entries rather than clearing the entire cache:
```
invalidateTile(x, y) {
  for (const [key, entry] of pathCache.store) {
    if (entry.path.some(n => n.x === x && n.y === y))
      pathCache.store.delete(key);
  }
}
```

##### Async Computation (non-blocking)

Pathfinding runs asynchronously to prevent frame drops during enemy AI turns (when multiple enemies need paths computed in the same frame).

```
// Strategy 1: Chunked computation (no Web Worker, simpler)
async function computePathAsync(grid, start, goal, costFn) {
  const searcher = new BidirectionalAStar(grid, start, goal, costFn);
  const NODES_PER_CHUNK = 50;  // expand 50 nodes per frame

  while (!searcher.isComplete()) {
    searcher.expandNodes(NODES_PER_CHUNK);
    await yieldToMainThread();  // requestAnimationFrame or setTimeout(0)
  }
  return searcher.getResult();
}

// Strategy 2: Web Worker (true parallelism, used when available)
// pathWorker.js runs bidirectional A* in a separate thread
const pathWorker = new Worker('pathWorker.js');

function computePathWorker(grid, start, goal, costFn) {
  return new Promise(resolve => {
    const requestId = ++pathRequestCounter;
    pathWorker.postMessage({ requestId, grid: grid.serialize(), start, goal });
    pendingRequests.set(requestId, resolve);
  });
}

pathWorker.onmessage = (e) => {
  const { requestId, path } = e.data;
  pendingRequests.get(requestId)?.(path);
  pendingRequests.delete(requestId);
};
```

##### Batch Path Requests

During enemy AI turns, all enemy path requests are batched and computed concurrently:

```
async function computeAllEnemyPaths(enemies, grid) {
  const requests = enemies.map(enemy => ({
    enemy,
    cached: pathCache.get(enemy.pos, enemy.targetPos, enemy.moveMode)
  }));

  // Serve cache hits immediately
  const hits = requests.filter(r => r.cached);
  const misses = requests.filter(r => !r.cached);

  // Compute misses in parallel (Web Worker) or chunked (fallback)
  const computed = await Promise.all(
    misses.map(r => computePathAsync(grid, r.enemy.pos, r.enemy.targetPos, r.enemy.costFn))
  );

  // Store in shared cache
  misses.forEach((r, i) => {
    pathCache.set(r.enemy.pos, r.enemy.targetPos, r.enemy.moveMode, computed[i]);
  });

  return [...hits.map(r => r.cached), ...computed];
}
```

##### Memory Budget

| Component | Budget |
|-----------|--------|
| Path cache (256 entries × ~40 nodes avg × 8 bytes/node) | ~80 KB |
| Open/closed sets per search (bidirectional, 2 sets each) | ~20 KB peak |
| Worker serialized grid (30×30 max) | ~7 KB per message |
| **Total peak** | **~110 KB** |

Grid is never copied unnecessarily — the worker receives a compact serialized form (typed array of terrain costs + unit positions).

##### Heuristic Function

Octile distance (consistent heuristic for grids with diagonal movement):
```
function heuristic(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}
```

#### Movement Range Display

- Reachable tiles highlighted in **blue** (full move)
- Tiles reachable with a charge highlighted in **yellow** (straight line only)
- Tiles beyond movement range in **gray** (unreachable)
- Tiles in AoO threat range of enemies highlighted with **red border**
- Movement range computed using **flood fill** from unit position with movement budget (uses same cost function as pathfinding)
- Range display is cached per unit per turn (invalidated when unit moves or terrain changes)

---

### 5.25 Multi-Floor Dungeon Navigation

#### Floor Transitions

| Feature | Rule |
|---------|------|
| **Descent** | Stairs down appear in a room on each floor (seeded position). Click to descend. |
| **Ascent** | Retreat staircase in first room of each floor. Click to go up one floor. |
| **Backtracking** | Players can freely move between explored floors via staircases |
| **Floor memory** | Fog of war state is preserved per-floor (explored tiles remain visible when returning) |
| **Enemy respawn** | Enemies do NOT respawn on cleared floors. Cleared rooms stay empty. |
| **Chest respawn** | Opened chests stay open. No re-looting. |
| **Floor transitions** | Trigger auto-save. Transition animation: screen fade (0.5s). |

#### Dungeon Floor Structure

```
dungeon = {
  floors: [
    {
      floorNumber: 1,
      grid: TileGrid,           // BSP-generated room layout
      rooms: Room[],            // room positions, types, contents
      explored: Set<TileId>,    // fog of war state (persisted)
      enemies: CombatUnit[],    // remaining enemies (cleared = empty)
      loot: LootContainer[],   // remaining unopened chests
      stairs: { up: Position, down: Position },
      cleared: boolean          // all enemies defeated
    },
    // ... more floors
  ],
  currentFloor: 0,
  theme: 'cave'|'temple'|'fortress'|'crypt'|...,
  dimension: 'Material'|'Shadowfell'|...,
  difficulty: 1-5               // determines floor count and CR range
}
```

#### Floor Count by Difficulty

| Difficulty | Floor Count | CR Range | Boss Floor |
|-----------|-------------|----------|------------|
| Tier I (beginner) | 2-3 | CR ¼-1 | Floor 3 |
| Tier II (easy) | 3-4 | CR 1-4 | Floor 4 |
| Tier III (medium) | 4-5 | CR 4-8 | Floor 5 |
| Tier IV (hard) | 5-6 | CR 8-14 | Floor 6 |
| Tier V (deadly) | 6-8 | CR 14-20 | Floor 7-8 |
| Tier VI (epic) | 7-10 | CR 20-30+ | Floor 10 |

---

### 5.26 Accessibility

#### Colorblind Mode

| Mode | Implementation |
|------|---------------|
| **Protanopia** (red-weak) | Replace red indicators with orange + shape change (square vs circle) |
| **Deuteranopia** (green-weak) | Replace green indicators with cyan + shape change |
| **Tritanopia** (blue-weak) | Replace blue with magenta + shape change |
| **Symbols mode** | Add distinct symbols to all color-coded elements (rarity, health bars, terrain) |

#### Other Accessibility Features

| Feature | Description |
|---------|-------------|
| **Key rebinding** | All keyboard shortcuts can be remapped in Settings |
| **Font size** | 3 options: Small, Normal, Large (scales all text and UI elements) |
| **High contrast** | Optional high-contrast mode for UI elements |
| **Screen shake** | Can be disabled in Settings (for motion sensitivity) |
| **Auto-battle** | Toggleable: AI controls party in combat (for players who struggle with tactical decisions) |
| **Damage numbers** | Optional toggle to show/hide floating damage numbers |
| **Minimap zoom** | Minimap can be enlarged (160×120 → 320×240) |

---

### 5.27 Bestiary & Achievements

#### Bestiary (Monster Codex)

As the player encounters creatures, entries are added to a persistent bestiary:

| Bestiary State | Information Shown |
|----------------|-------------------|
| **Undiscovered** | "???" silhouette |
| **Encountered** (seen in combat) | Name, sprite, CR, home dimension |
| **Studied** (killed 5+) | Full stat block: HP, AC, attacks, special abilities, weaknesses |
| **Mastered** (killed 20+) | Flavor text, lore, recommended tactics, drop table |

- Bestiary data persists across runs (stored in localStorage)
- Accessed via [B] key or Bestiary button in camp/town
- Entries sorted by CR, filterable by dimension, type, and discovery status
- Completion percentage shown: "Bestiary: 47/120 creatures discovered"

#### Achievement System

| Category | Examples |
|----------|---------|
| **Combat** | "First Blood" (win first combat), "Dragon Slayer" (defeat any dragon), "Untouchable" (win combat taking 0 damage) |
| **Exploration** | "Cartographer" (fully explore 10 dungeons), "Planeswalker" (visit all 13 dimensions), "Spelunker" (reach floor 10) |
| **Collection** | "Legendary Collector" (find 5 legendary items), "Bestiary Complete" (discover all creatures), "Master of Arms" (Master rank all 10 weapons) |
| **Progression** | "Legend of the Realms" (reach level 100), "Prestige" (promote first character), "Millionaire" (accumulate 1,000,000 gold total) |
| **Challenge** | "Iron Man" (complete a dungeon on Nightmare), "Solo Run" (clear a dungeon with 1 party member), "Pacifist Floor" (clear a floor without attacking) |

Achievements are tracked globally (not per-run) in localStorage. Each achievement has:
```
achievement = {
  id: string,
  title: string,
  description: string,
  icon: string,           // achievement icon
  rarity: 'common'|'rare'|'epic'|'legendary',
  progress: number,       // current progress
  target: number,         // required for unlock
  unlocked: boolean,
  unlockedDate: Date|null
}
```

#### Achievement Rewards

Some achievements unlock cosmetic rewards:
| Achievement | Reward |
|-------------|--------|
| Bestiary Complete | Golden border on character portraits |
| Level 100 | "Legend" title prefix on character name |
| All Prestige Paths | Platinum character select frame |
| All Bosses Defeated | Boss trophy display in camp |

---

## 6. Art Direction

### Style

- **Pixel art**: 32x32 base tiles, 32x32 character sprites, 64x64 portraits
- **Aesthetic**: Shining Force II (Sega Genesis) with muted earth tones
- **Overworld palette**: Greens, browns, sandy yellows -- warm and inviting
- **Dungeon palette**: Dark grays, deep blues, torch-lit oranges -- oppressive and mysterious
- **Planar palettes**: Each dimension has a distinct palette (see 5.3b Planar Dimensions)
- **Spell effects**: Vibrant saturated colors (fire orange, ice cyan, holy gold, necro purple)
- **UI**: Parchment/leather textures for menus, gold borders for buttons

### Animation

- Character walk: 4 frames per direction, 3 authored directions (front, back, side); left mirrored from side at render time
- Combat cut-in: 3-5 frame attack animations
- Spell effects: 6-12 frame particle sequences
- Boss phase transition: Screen flash + arena change animation

---

## 7. Technical Architecture

### Module Structure (IIFE + window.SZ)

```
Applications/Games/tactical-realms/
  index.html              Entry point (canvas + UI)
  styles.css              Game UI styles
  icon.svg                App icon for SZ desktop
  controller.js           Main game loop, state machine
  renderer.js             Canvas rendering engine
  d20-engine.js           D&D 3e d20 system: attack rolls, saves, ability checks, CR math
  combat.js               Tactical combat system (d20 resolution, initiative, AoO, flanking)
  dungeon-gen.js          BSP dungeon generation
  overworld-gen.js        Chunk-based infinite overworld (WFC + simplex noise)
  chunk-manager.js        Chunk LRU cache, lazy generation, boundary stitching, async pre-gen
  chunk-scheduler.js      Async generation queue, idle-time scheduling, move-prediction
  wfc-solver.js           Wave Function Collapse tile solver
  noise.js                Simplex noise (multi-frequency biome generation)
  dimension.js            Planar dimension definitions, portal logic, dimension-specific rules
  character.js            Character/class/race/d20 stat definitions, BAB/save/HD tables
  progression.js          D&D 3e progression tables (levels 1-100), BAB, saves, spell slots
  sprite-engine.js        Paper-doll sprite compositing (3 directions, canvas flip for 4th)
  visual-variation.js     Enemy palette swap, size variation, equipment/marking overlays
  equipment.js            Loot generation, affix system, dimensional loot tables
  enemy-ai.js             Enemy behavior patterns (8 AI types), spawn behavior
  enemy-registry.js       120+ monster definitions, CR stat blocks, dimensional variants
  mob-spawner.js          Perception-based encounter spawning/despawning, mob pooling (1024 max)
  spell-system.js         D&D 3e SRD spell compendium, 8 schools, spell levels 0-9
  terrain.js              Terrain type definitions and d20 modifiers (cover, concealment, per-dimension)
  vision-light.js         Vision types, light levels, fog of war, light source management
  companion.js            Companion creature system
  time-rotation.js        Date-seeded content rotation
  prestige.js             Prestige class definitions and promotion logic
  entitlement.js          EntitlementService stub
  save-manager.js         Invisible localStorage persistence (dual-buffer, versioned, migration)
  save-crypto.js          AES-GCM encryption, HKDF chain derivation, one-time key ring
  assets/                 Sprites, tilesets, portraits (managed by Asset Forge)
  ReadMe.md               This document (PRD)
```

### Rendering

- HTML5 Canvas 2D context at 940x660
- Double-buffered rendering (offscreen canvas for compositing)
- Tile-based renderer with camera offset for scrolling
- Paper-doll sprite compositing via `drawImage()` layering
- 60 FPS game loop via `requestAnimationFrame`

### Game State Machine

```js
const GameState = {
  TITLE: 'title',
  LOAD_GAME: 'loadGame',
  CHARACTER_SELECT: 'characterSelect',
  OVERWORLD: 'overworld',
  TOWN: 'town',
  DUNGEON: 'dungeon',
  COMBAT: 'combat',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  CAMP: 'camp'
};
```

### Seeded PRNG

- `mulberry32` or similar fast 32-bit seeded PRNG
- Seeds derived from date strings via `hashCode()`
- Ensures identical content rotation for all players on the same day

### Persistence (localStorage)

- **4 storage keys**: dual append-only encrypted log buffers (A/B), active pointer, settings (feels like a server -- no save/load UI)
- **Auto-save** on every state transition (see 5.15 trigger table) -- each save appends a `[Block][Header]` pair to the active log
- **Append-only chained blocks**: Each block's AES-GCM key is derived via HKDF from the SHA-256 of the **previous block's ciphertext** -- tampering with any block breaks the entire forward chain
- **Anti-tamper**: 256-key ring (genesis blocks), chained HKDF derivation (subsequent), per-block salt/IV, build-time pepper
- **Fast loading**: Only reads the last 2 blocks from the tail of the log (no full-chain scan needed)
- **Dual-log rotation**: When a log exceeds 400 KB, a new genesis block starts in the other buffer linked to the old tail
- **Migration chain**: Old saves automatically upgraded to current format after decryption
- **Corruption recovery**: Decrypt tail + verify chain link → try other log → graceful "New Game" fallback
- **Quota management**: Log rotation at 400 KB; compression on quota pressure
- **Full save data**: party (with prestige), roster, inventory, gold, companions, overworld seed, position, dungeon progress, quest state, play time, statistics
- See section 5.15 for complete save schema, triggers, and load-on-startup flow

### Pathfinding

- A* for movement range calculation on tactical grid
- Djikstra for overworld road network generation
- BFS for fog-of-war reveal radius

---

## 8. Domain Model (DDD)

### Bounded Contexts

The game is decomposed into 10 bounded contexts. Each context owns its domain logic and communicates with others through domain events or direct method calls (no cross-context database access).

```
+-------------------+     +-------------------+     +--------------------+
|    Character       |     |      Combat       |     |   Dungeon          |
|  (races, classes,  |---->|  (grid, turns,    |<----|  (BSP gen, rooms,  |
|   stats, leveling) |     |   damage, AI)     |     |   fog, objects)    |
+-------------------+     +-------------------+     +--------------------+
        |                         |                          |
        v                         v                          v
+-------------------+     +-------------------+     +--------------------+
|    Equipment       |     |     Overworld     |     |   Time Rotation    |
|  (loot, affixes,   |     |  (biomes, roads,  |     |  (seeds, daily,    |
|   sets, inventory) |     |   towns, POIs)    |     |   weekly, monthly) |
+-------------------+     +-------------------+     +--------------------+
        |                         |                          |
        v                         v                          v
+-------------------+     +-------------------+     +--------------------+
|   Progression      |     |    Prestige       |     |   Entitlement      |
|  (XP, leveling,    |---->|  (promotion,      |     |  (content gates,   |
|   camp, quests)    |     |   paths, abilities)|     |   seasonal access) |
+-------------------+     +-------------------+     +--------------------+
        |                                                    |
        v                                                    v
+--------------------------------------------------------------------+
|   Save / Persistence                                                |
|  (localStorage, versioning, checksum, migration, backup, quota)     |
+--------------------------------------------------------------------+
```

### Aggregates, Entities, and Value Objects

#### Character Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `Character` | A playable character with race, class, stats, level, equipment, proficiencies, spells, prestige, and companion |
| Entity | `Companion` | A companion creature owned by a character |
| Entity | `SpellBook` | Ordered collection of known spells for a caster character |
| Entity | `ProficiencyTracker` | Tracks weapon use counts and ranks per weapon category |
| Entity | `PrestigeProgress` | Tracks prestige class, prestige level, unlocked prestige abilities |
| Value Object | `StatBlock` | Immutable set of 10 stats (HP, MP, STR, DEX, CON, INT, WIS, CHA, AC, Initiative) |
| Value Object | `RaceDefinition` | Immutable race data (name, stat modifiers, availability) |
| Value Object | `ClassDefinition` | Immutable class data (name, role, primary/secondary stats, spell schools, starting proficiencies) |
| Value Object | `PrestigeDefinition` | Immutable prestige path data (name, base class, stat requirement, gold cost, quest id, abilities[]) |
| Value Object | `CharacterId` | Unique identifier for a character instance (race + class + seed hash) |
| Value Object | `ProficiencyRank` | Enum: Untrained, Novice, Trained, Skilled, Expert, Master |
| Value Object | `WeaponCategory` | Enum: Sword, Axe, Mace, Staff, Bow, Crossbow, Dagger, Spear, Warhammer, Flail |
| Value Object | `SpellSlot` | (spellId, tier, school, mpCost) |
| Value Object | `EquipmentRequirement` | (minLevel, minStat, statType, requiresPrestige) -- checked before equipping |

```js
// StatBlock is a value object -- immutable, compared by value
class StatBlock {
  constructor(hp, mp, str, dex, con, int, wis, cha, ac, spd) { /* freeze */ }
  withModifier(stat, delta) { /* returns new StatBlock */ }
  equals(other) { /* deep equality on all 10 fields */ }
  meetsRequirement(req) { /* checks level and stat against EquipmentRequirement */ }
}

// ProficiencyTracker tracks weapon use counts and derived ranks
class ProficiencyTracker {
  #uses;  // Map<WeaponCategory, number>
  #ranks; // Map<WeaponCategory, ProficiencyRank> (derived from uses)

  recordUse(weapon) { /* increments use count, may promote rank, emits ProficiencyGained */ }
  getRank(weapon) { /* returns current ProficiencyRank */ }
  getAtkBonus(weapon) { /* returns bonus based on rank */ }
  getCritBonus(weapon) { /* returns crit % bonus based on rank */ }
  getTechniques(weapon) { /* returns unlocked techniques for rank */ }
  canUse(weapon) { /* checks class "Cannot Use" list */ }
}

// SpellBook tracks known spells and spell slots
class SpellBook {
  #knownSpells;  // Set<SpellSlot>
  #cantrips;     // Set<SpellSlot>

  learnSpell(spell) { /* adds to known, emits SpellLearned */ }
  learnFromScroll(scroll, gold) { /* consumes scroll+gold, adds spell, emits SpellLearned */ }
  learnCantrip(cantrip) { /* adds cantrip */ }
  getAvailableSpells(currentMp) { /* returns castable spells */ }
  knows(spellId) { /* returns boolean */ }
}

// Character is the aggregate root
class Character {
  #id;              // CharacterId
  #race;            // RaceDefinition
  #class;           // ClassDefinition
  #baseStats;       // StatBlock (immutable base)
  #level;           // number (1-100)
  #xp;              // number
  #equipment;       // EquipmentSet (6 slots)
  #companion;       // Companion entity
  #statPoints;      // number (unallocated)
  #proficiencies;   // ProficiencyTracker
  #spellBook;       // SpellBook (null for non-casters)
  #prestige;        // PrestigeProgress (null until promoted)

  effectiveStats() { /* base + race + class + equipment + proficiency bonuses + level bonuses + prestige bonuses */ }
  gainXp(amount) { /* may trigger LeveledUp event; post-20 uses quadratic scaling */ }
  equip(slot, item) { /* checks requirements including prestige tier, may trigger EquipmentChanged event */ }
  canEquip(item) { /* checks level req, stat req, prestige req, returns {ok, reason} */ }
  allocateStat(stat) { /* deducts 1 stat point (2 pre-20, 1 post-20), returns new effective stats */ }
  recordWeaponUse(weapon) { /* delegates to proficiencies */ }
  learnSpell(spell) { /* delegates to spellBook */ }
  spellFailureChance() { /* 0 for non-casters, based on equipped armor tier for casters */ }
  promote(prestigeDef) { /* sets #prestige, emits PrestigePromoted; requires level >= 20 + quest + gold + stat */ }
  isPrestiged() { /* returns boolean */ }
  prestigeLevel() { /* max(0, #level - 20) if prestige, else 0 */ }
  getPrestigeAbilities() { /* returns unlocked abilities for current prestige level */ }

  // Serialization for save system
  serialize() { /* returns plain object for JSON.stringify */ }
  static deserialize(data) { /* reconstructs Character from plain object */ }
}

// PrestigeProgress tracks prestige state within a Character
class PrestigeProgress {
  #definition;       // PrestigeDefinition (path chosen)
  #abilities;        // PrestigeAbility[] (unlocked so far)

  get path() { /* returns prestige path name */ }
  getAbilitiesForLevel(level) { /* returns abilities unlocked at or below given level */ }
  getNextMilestone(level) { /* returns next ability unlock level */ }
}
```

#### Combat Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `CombatEncounter` | A single battle instance with grid, units, and turn order |
| Entity | `CombatUnit` | A unit on the combat grid (party member, companion, or enemy) |
| Value Object | `Position` | (x, y) coordinate on the grid |
| Value Object | `DamageResult` | Calculated damage with breakdown (base, terrain, flank, crit, final) |
| Value Object | `MovementRange` | Set of reachable positions from A* calculation |
| Value Object | `AoEPattern` | Shape definition (single, line, cross, diamond, circle) |
| Value Object | `TurnOrder` | Ordered list of unit IDs sorted by Initiative (d20 + DEX mod) |

```js
// DamageResult is a value object -- computed once, read-only
class DamageResult {
  constructor(base, terrainMod, flankMod, elevMod, critMod) { /* freeze */ }
  get final() { return Math.max(1, Math.floor(this.base * this.terrainMod * this.flankMod * this.elevMod * this.critMod)); }
}

// CombatEncounter is the aggregate root
class CombatEncounter {
  #grid;        // 2D array of TerrainTile
  #units;       // Map<unitId, CombatUnit>
  #turnOrder;   // TurnOrder
  #phase;       // 'placement' | 'active' | 'victory' | 'defeat'

  moveUnit(unitId, target) { /* validates range, emits UnitMoved */ }
  executeAttack(attackerId, defenderId) { /* calculates damage, emits AttackExecuted */ }
  castSpell(casterId, spellId, target) { /* validates MP, emits SpellCast */ }
  advanceTurn() { /* next unit in turn order, emits TurnAdvanced */ }
  checkVictory() { /* returns true if all enemies defeated */ }
  checkDefeat() { /* returns true if all party members KO'd */ }
}
```

#### Dungeon Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `Dungeon` | A multi-floor dungeon instance with difficulty tier |
| Entity | `DungeonFloor` | A single floor with rooms, corridors, and objects |
| Entity | `Room` | A room with type, contents, and boundaries |
| Value Object | `DungeonTier` | Enum: I (Shallow Crypt) through VI (Mythic Lair) -- determines floor count, enemy composition, loot quality, XP multiplier |
| Value Object | `DungeonInfo` | (tier, name, skulls, recLevel, floors, enemyTiers, lootQuality, xpMultiplier, boss) -- displayed to player before entry |
| Value Object | `FloorLayout` | Immutable grid of tiles produced by BSP |
| Value Object | `RoomType` | Enum: Empty, Treasure, Trap, Puzzle, Shrine, Boss |
| Value Object | `FogOfWarState` | Set of revealed tile positions |

#### Equipment Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `Inventory` | Collection of items owned by the player |
| Entity | `Item` | A single item with base stats, rarity, tier, affixes, and requirements |
| Entity | `Consumable` | A single-use item (potion, scroll, bomb, etc.) |
| Value Object | `Affix` | Immutable prefix or suffix with stat modifier |
| Value Object | `Rarity` | Enum: Common, Uncommon, Rare, Epic, Legendary |
| Value Object | `EquipmentSlot` | Enum: Weapon, Shield, Helmet, Armor, Boots, Accessory |
| Value Object | `EquipmentTier` | Enum: T1 (Crude) through T6 (Legendary) with stat multipliers |
| Value Object | `EquipmentRequirement` | (minLevel, minStat, statType) |
| Value Object | `ConsumableType` | Enum: HealthPotion, ManaPotion, Elixir, Antidote, ReviveTonic, PhoenixDown, SpellScroll, Bomb, SmokeBomb, Torch, Lockpick, TrapKit, CampRations, ProficiencyManual, SpellTome |
| Value Object | `SetBonus` | Immutable set bonus definition (threshold, effect) |
| Value Object | `Gold` | Non-negative integer (currency) |
| Value Object | `ShopStock` | Seeded item list for a shop (date + location seed) |

#### Overworld Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `OverworldMap` | The procedurally generated overworld with concentric difficulty zones |
| Entity | `Town` | A visitable town with shop, inn, quest board, promotion hall |
| Entity | `DungeonEntrance` | A clickable entrance linking to a dungeon with visible difficulty info |
| Value Object | `BiomeType` | Enum: Forest, Mountain, Desert, Swamp, Tundra, Volcanic |
| Value Object | `DifficultyZone` | Enum: Inner (safe), Middle, Middle-outer, Outer, Edge (deadly) -- concentric rings from starting town |
| Value Object | `MapTile` | (biome, walkable, feature, position, difficultyZone, encounterRate) |
| Value Object | `EncounterRate` | float 0.0-0.15 per step (0.0 on roads, scales with biome) |

#### Time Rotation Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `ContentRotation` | Computes all time-gated content for a given date |
| Value Object | `DateSeed` | Immutable seed derived from a date string |
| Value Object | `Season` | Enum: Spring, Summer, Autumn, Winter |
| Value Object | `HolidayWindow` | (holiday, startDate, endDate) |

#### Progression Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `PlayerProgression` | All persistent player state (roster, gold, quest progress) |
| Entity | `QuestProgress` | Tracks stages of active quests |
| Value Object | `SaveData` | Serialized snapshot of all progression state |

#### Entitlement Context

| Type | Name | Description |
|------|------|-------------|
| **Service** | `EntitlementService` | Interface for checking content ownership |
| Value Object | `ContentId` | String identifier for gated content |
| Value Object | `EntitlementStatus` | (contentId, entitled, seasonallyFree) |

#### Prestige Context

| Type | Name | Description |
|------|------|-------------|
| **Aggregate Root** | `PrestigeRegistry` | Registry of all prestige paths with definitions, requirements, and ability progressions |
| Entity | `PrestigeQuest` | A one-time unlock quest for a prestige path (completion status per account) |
| Value Object | `PrestigeDefinition` | Immutable prestige path data (name, baseClass, statReq, goldCost, questId, abilityTable) |
| Value Object | `PrestigeAbility` | (abilityId, name, description, unlockLevel, type: 'active'|'passive', effects) |
| Value Object | `PromotionRequirement` | (minLevel, minStat, statType, goldCost, questCompleted) |
| Value Object | `VeteranAbility` | Generic milestone ability for non-prestige characters (+1 damage, +1 AC, etc.) |

```js
// PrestigeRegistry holds all path definitions
class PrestigeRegistry {
  #paths;  // Map<baseClass, PrestigeDefinition[3]>

  getPathsForClass(baseClass) { /* returns 3 prestige definitions */ }
  canPromote(character, pathId, gold, questsCompleted) {
    /* checks level >= 20, stat >= 15, gold >= cost, quest completed; returns {ok, reason} */
  }
  getAbilitiesAtLevel(pathId, level) { /* returns PrestigeAbility[] for milestones at or below level */ }
  getVeteranAbilityAtLevel(level) { /* returns VeteranAbility for non-prestige milestone */ }
}

// PrestigeQuest represents a one-time unlock objective
class PrestigeQuest {
  #questId;      // string
  #objectives;   // { description, type: 'kill'|'find'|'explore', target, progress, required }[]
  #completed;    // boolean

  updateProgress(eventType, eventData) { /* checks objectives, emits PrestigeQuestCompleted if all met */ }
  isCompleted() { /* returns boolean */ }
}
```

#### Save / Persistence Context

| Type | Name | Description |
|------|------|-------------|
| **Service** | `SaveManager` | Orchestrates invisible append-only encrypted save/load/migrate/validate on localStorage (server-like UX, anti-tamper) |
| **Service** | `SaveCrypto` | Handles AES-GCM encryption/decryption, HKDF/PBKDF2 chained key derivation, via Web Crypto API |
| Value Object | `SaveData` | Complete serialized game state (plaintext inside a block) |
| Value Object | `SaveVersion` | Integer schema version (initial: 1) |
| Value Object | `ChainedBlock` | AES-GCM ciphertext whose key is derived from the previous block's ciphertext hash |
| Value Object | `BlockHeader` | (version, blockIndex, iv, salt, prevBlockHash, blockOffset, prevHeaderOffset, timestamp, pepper) |
| Value Object | `LogBuffer` | The complete append-only `[Block₀][Header₀]...[BlockN][HeaderN]` byte string stored in localStorage |

```js
class SaveCrypto {
  #keyRing;      // Uint8Array[256] -- 256 random 32-byte keys (compiled into game JS)
  #pepper;       // Uint8Array -- build-time constant

  async encryptGenesis(plaintext) {
    /* generate salt + IV, pick random keyId from ring */
    /* key = PBKDF2(keyRing[keyId] + salt + pepper, salt, 10000) */
    /* return { ciphertext: AES-GCM(key, IV, plaintext), header: { ..., genesisKeyId } } */
  }
  async encryptChained(plaintext, prevBlockCiphertext, blockIndex) {
    /* generate salt + IV */
    /* key = HKDF-SHA256(SHA-256(prevBlockCiphertext), salt, pepper + blockIndex) */
    /* return { ciphertext: AES-GCM(key, IV, plaintext), header: { ..., prevBlockHash } } */
  }
  async decryptBlock(blockCiphertext, header, prevBlockCiphertext) {
    /* derive key from prevBlockCiphertext (or keyRing for genesis) */
    /* decrypt with AES-GCM → plaintext */
    /* verify: SHA-256(prevBlockCiphertext) == header.prevBlockHash */
    /* returns plaintext or throws ChainBrokenError / TamperDetectedError */
  }
}

class SaveManager {
  #crypto;          // SaveCrypto
  #currentVersion;  // number
  #migrations;      // Map<number, (data) => data>

  async save(gameState) {
    /* read active log → locate tail → derive chained key → encrypt → append [Block][Header] */
    /* if log > 400 KB: rotate to other buffer (new genesis linked to old tail) */
    /* emits SaveCreated { blockIndex, size, timestamp } */
    /* completely invisible to player */
  }
  async load() {
    /* read active log → scan tail for last Header → decrypt last Block (only reads 2 blocks from tail) */
    /* verify chain link: SHA-256(Block_{N-1}) == HeaderN.prevBlockHash */
    /* on tamper/fail: try other log buffer */
    /* on both fail: emits SaveCorrupted { error } */
    /* emits SaveLoaded { version, blockIndex, migrated } */
  }
  hasSave() { /* checks if either log buffer exists in localStorage */ }
  async getSummary() { /* parse last header for timestamp/version, decrypt last block for party summary */ }
  deleteSave() { /* removes all 3 keys (log-a, log-b, active) -- "New Game" erases everything */ }
}
```

### Domain Events

Events flow between bounded contexts. Each event is immutable and carries all data needed by subscribers.

| Event | Emitted By | Consumed By | Payload |
|-------|-----------|-------------|---------|
| `RosterGenerated` | TimeRotation | Character | `{ date, characterIds[], bonusStat }` |
| `PartyFormed` | Character | Combat, Overworld | `{ members[], companions[] }` |
| `CombatStarted` | Dungeon / Overworld | Combat | `{ enemies[], terrain[][], partyPositions[] }` |
| `TurnAdvanced` | Combat | (renderer) | `{ unitId, turnNumber }` |
| `UnitMoved` | Combat | (renderer) | `{ unitId, from, to, path[] }` |
| `AttackExecuted` | Combat | (renderer), Progression | `{ attackerId, defenderId, damage, isCrit, isKill }` |
| `SpellCast` | Combat | (renderer) | `{ casterId, spellId, targets[], damage[] }` |
| `UnitDefeated` | Combat | Progression | `{ unitId, xpValue, lootTable }` |
| `CombatEnded` | Combat | Progression, Dungeon | `{ result: 'victory'|'defeat', xpEarned, loot[] }` |
| `LeveledUp` | Progression | Character | `{ characterId, newLevel, statPoints, unlocks[] }` |
| `EquipmentChanged` | Character | (renderer), Combat | `{ characterId, slot, oldItem, newItem }` |
| `FloorEntered` | Dungeon | (renderer), SaveManager | `{ dungeonId, floor, layout }` |
| `ItemLooted` | Combat / Dungeon | Equipment | `{ item, source }` |
| `GoldChanged` | Equipment / Progression | (UI) | `{ oldAmount, newAmount, reason }` |
| `SaveTriggered` | State Machine | SaveManager | `{ reason: 'camp'|'town'|'floor'|'victory'|'retreat'|'equip'|'shop'|'prestige'|'rest'|'partyConfirm'|'zoneChange' }` |
| `HolidayActivated` | TimeRotation | Equipment, Dungeon, Overworld | `{ holiday, contentIds[] }` |
| `SeasonChanged` | TimeRotation | Character, Entitlement | `{ newSeason, freeContentIds[] }` |
| `BossPhaseChanged` | Combat | (renderer) | `{ bossId, newPhase, newAbilities[] }` |
| `QuestStageCompleted` | Progression | (UI) | `{ questId, stage, reward }` |
| `ProficiencyGained` | Character | (UI) | `{ characterId, weapon, newRank, technique }` |
| `WeaponTechniqueUnlocked` | Character | Combat | `{ characterId, weapon, technique }` |
| `SpellLearned` | Character | (UI) | `{ characterId, spellId, source: 'levelup'|'scroll'|'trainer'|'tome' }` |
| `ConsumableUsed` | Combat / Dungeon | Equipment | `{ itemId, type, target, effect }` |
| `ItemPurchased` | Equipment | Progression | `{ itemId, cost, shopId }` |
| `ItemSold` | Equipment | Progression | `{ itemId, revenue, shopId }` |
| `SpellFailed` | Combat | (renderer) | `{ casterId, spellId, armorType, failChance }` |
| `EquipmentRequirementFailed` | Character | (UI) | `{ characterId, itemId, requirement, current }` |
| `ScrollStudied` | Character | Equipment | `{ characterId, scrollId, spellId, goldCost }` |
| `CraftingCompleted` | Progression | Equipment | `{ characterId, recipe, resultItem }` |
| `PrestigePromoted` | Character | Progression, (UI) | `{ characterId, baseClass, prestigePath, goldCost }` |
| `PrestigeAbilityUnlocked` | Character | Combat, (UI) | `{ characterId, prestigePath, abilityId, level }` |
| `PrestigeQuestCompleted` | Prestige | (UI) | `{ questId, prestigePath, baseClass }` |
| `VeteranMilestoneReached` | Progression | Character | `{ characterId, level, veteranAbility }` |
| `DungeonScouted` | Overworld | (UI) | `{ dungeonId, tier, recLevel, skulls, floors, boss }` |
| `DungeonEntered` | Overworld | Dungeon, SaveManager | `{ dungeonId, tier, partyLevel }` |
| `DungeonRetreated` | Dungeon | Overworld, SaveManager | `{ dungeonId, floorsCleared, xpKept, lootLost }` |
| `PartyWiped` | Combat | Progression, SaveManager | `{ dungeonId, floor, goldPenalty, lootLost }` |
| `TownEntered` | Overworld | SaveManager, (UI) | `{ townId, position, facilities[] }` |
| `OverworldEncounter` | Overworld | Combat | `{ biome, enemyTier, position }` |
| `SaveCreated` | SaveManager | (UI) | `{ slotId, size, timestamp, version }` |
| `SaveLoaded` | SaveManager | All contexts | `{ slotId, version, migrated, gameState }` |
| `SaveCorrupted` | SaveManager | (UI) | `{ slotId, error, backupAvailable }` |
| `SaveMigrated` | SaveManager | (UI) | `{ slotId, fromVersion, toVersion }` |
| `StorageQuotaWarning` | SaveManager | (UI) | `{ usedBytes, availableBytes, percentage }` |

---

## 9. Test Strategy & Architecture

### Approach

All game logic is headless (no DOM/Canvas dependency) and tested via pure function calls. The rendering layer (Canvas 2D) is separated from game state and tested visually in browser. The test suite follows TDD red-green-refactor cycles: write a failing test, implement the minimum code to pass, then refactor.

### Test Runner

Since this project runs on `file://` with no build tools, tests use a minimal custom runner:

```
Applications/Games/tactical-realms/
  tests/
    runner.html            Test runner page (open in browser)
    runner.js              Discovers and executes test functions
    test-character.js      Character system tests
    test-combat.js         Combat system tests
    test-damage.js         Damage formula tests
    test-dungeon-gen.js    Dungeon generation tests
    test-overworld-gen.js  Overworld generation tests
    test-equipment.js      Equipment and loot tests
    test-enemy-ai.js       Enemy AI tests
    test-spell-system.js   Spell system tests
    test-terrain.js        Terrain modifier tests
    test-companion.js      Companion system tests
    test-time-rotation.js  Time rotation tests
    test-entitlement.js    Entitlement service tests
    test-save-manager.js   Save/load tests
    test-pathfinding.js    A* and BFS tests
    test-state-machine.js  Game state transitions
    test-proficiency.js    Weapon proficiency system tests
    test-spellbook.js      Spell learning, scrolls, trainers
    test-consumables.js    Potions, scrolls, bombs, consumable items
    test-shop.js           Shop stock generation, buy/sell, trainer
    test-requirements.js   Equipment tier requirements, stat checks
    test-prestige.js       Prestige promotion, abilities, veteran path
    test-save-crypto.js    AES-GCM encrypt/decrypt, HMAC chain, tamper detection, key derivation
    test-save-migration.js Save versioning, migration architecture, corruption recovery
    test-quest-system.js   Quest prerequisites, generation, chains, secret discovery
    test-audio.js          Audio layer precedence, SFX pool eviction, ambient pause/resume
    test-boss-ai.js        Boss multi-turn AI, cooldowns, phase transitions, combos
    test-vision-light.js   Vision types, fog of war, light source stacking, dungeon light levels
    test-durability.js     Item durability loss, repair, broken item behavior
    test-cover.js          Cover system (half/three-quarter/full), directional cover
    test-morale.js         Morale system, fleeing behavior, respawn rules
    test-portal.js         Portal discovery, return portal mechanics, dimension transitions
    test-inventory.js      Drag-and-drop, encumbrance, sorting, filtering, stack management
    test-npc-dialogue.js   Dialogue tree traversal, conditional responses, quest accept/decline
    test-leaderboard.js    Metric tracking, monthly reset, difficulty separation
    test-integration.js    Cross-module integration tests
```

Tests follow the naming convention: `testModuleName_behaviorDescription_expectedOutcome`

### Test Categories & Module Coverage

#### Unit Tests (per module)

| Module | Key Test Scenarios | Mocking Boundary |
|--------|-------------------|------------------|
| `character.js` | Stat block generation, race/class modifiers, daily variance, stat floor (min 1), level-up stat allocation, XP thresholds, HP/MP scaling on level up, spell failure chance by armor, equipment requirement checking (level + stat), proficiency integration | Mock: PRNG (inject seeded), Date |
| `proficiency.js` | Use counter increments on attack, rank promotion at thresholds (10/30/60/100/150), attack and threat range bonuses per rank, technique unlock at Trained/Skilled/Expert, Master passive activation, Untrained penalty (−4 attack), Cannot-Use penalty (half damage, no XP), starting proficiency by class | Mock: none (pure logic) |
| `spellbook.js` | Learn spell adds to known list, cannot learn duplicate, scroll study consumes scroll + gold, Wizard free scroll study, non-class-school scroll rejection, cantrip damage scaling by level, metamagic cost calculation (Sorcerer only), spell tier gated by character level, half-caster learn rate | Mock: none (pure data) |
| `consumables.js` | Potion HP restoration capped at max HP, MP restoration capped at max MP, buff duration countdown, Revive Tonic 25% HP, Phoenix Down full HP, revive only targets KO'd allies, scroll consumption after use, bomb AoE friendly fire, smoke bomb prevents boss flee, torch fog extension, lockpick auto-success, trap kit placement | Mock: CombatGrid (for AoE) |
| `shop.js` | Stock generation seeded by date + shop ID, equipment tier capped by party level, town shops +1 tier over camp, scroll premium pricing (1.5x), sell price = 50% buy, legendary cannot be sold, trainer spell list filtered by class, weapon training adds +10 uses, insufficient gold rejection | Mock: PRNG (seeded), Date |
| `combat.js` | Turn order by Initiative roll (d20+DEX mod, tie-break DEX), movement range with terrain costs, d20 attack resolution (attack roll vs AC), flanking detection (+2 attack), AoO check, retreat logic, victory/defeat detection | Mock: PRNG (d20 rolls), CombatUnit stats |
| `dungeon-gen.js` | BSP splits produce valid rooms (>= 4x4), all rooms connected, exactly 1 staircase per floor, room type distribution, boss room on final floor, at least 1 shrine per dungeon, floor count matches difficulty tier, retreat staircase in first room, enemy tier matches dungeon tier, loot quality scales with tier and floor, XP diminishing returns formula | Mock: PRNG (seeded) |
| `overworld-gen.js` | Town connectivity (all towns reachable), >= 3 dungeon entrances across >= 2 difficulty tiers, biome coverage (<= 40% per biome), starting position on road adjacent to town + Tier I dungeon, Poisson disc spacing for POIs, difficulty zones concentric from start, road encounter rate = 0%, off-road rate = 5-15% by biome, dungeon info tooltip data matches tier, multiple paths of different difficulty from each town | Mock: PRNG (seeded) |
| `equipment.js` | Rarity drop rates sum to 100%, affix count matches rarity, no duplicate affixes on one item, set bonus activation/deactivation, gold math (buy/sell), two-handed blocks shield, stat never negative | Mock: PRNG (loot rolls) |
| `enemy-ai.js` | Aggressive targets lowest HP, Defensive holds until provoked, Ambush reveals on proximity, Support prioritizes healing, Spellcaster maintains distance, special ability cooldowns | Mock: CombatGrid, Unit positions |
| `spell-system.js` | MP cost deducted, insufficient MP prevents cast, AoE pattern tile calculation, friendly fire in AoE, heal cannot exceed max HP, class spell access restriction, spell tier unlock by level | Mock: none (pure data) |
| `terrain.js` | All 13 terrain modifiers correct, movement cost > 0, Bridge disables flanking, lava 5 DMG/turn, modifier application in damage formula | Mock: none (pure data) |
| `companion.js` | Companion stats scale with owner level, companion KO persists until camp, minor item equip, companion in turn order, companion revival at camp | Mock: Character level |
| `time-rotation.js` | Same seed = same output, daily roster 6-8 chars, daily bonus stat changes daily, weekly boss deterministic, monthly seed changes on 1st, seasonal availability, holiday window detection, Easter/CNY date calculation, no consecutive duplicate bonus stats, **date wrap edge cases**: Dec 31 → Jan 1 year rollover (seed changes correctly), Feb 28 → Mar 1 (non-leap), Feb 29 → Mar 1 (leap year), month rollover (Jan 31 → Feb 1 triggers monthly reset), ISO week 52 → week 1 (boss rotation wraps), holiday window spanning year boundary (Christmas Dec 20 → Jan 2), timezone-independent UTC seeding | Mock: Date.now() |
| `entitlement.js` | Stub returns true for all content, isSeasonallyFree correct for all seasons, premium content gated when not entitled and not in season, interface contract: async isEntitled/getEntitlements | Mock: Date |
| `save-manager.js` | Encrypt/decrypt roundtrip preserves all data, save size under 200 KB (encrypted), AES-GCM decryption rejects tampered ciphertext, HMAC chain detects block reordering, dual-buffer A/B rotation on every save, active pointer flip is atomic, corrupted active buffer falls back to inactive buffer, hasSave() detects existing buffer, getSummary() returns metadata from encrypted header, deleteSave() erases all 3 keys (a, b, active), auto-save on all state transitions per trigger table, fresh salt/IV per save (no replay) | Mock: localStorage, crypto.subtle |
| `save-crypto.js` | Encrypt/decrypt roundtrip produces identical plaintext, different salt/IV per encrypt call, tampered ciphertext throws on decrypt, block reordering breaks HMAC, key derivation produces consistent results for same inputs, all 256 key ring entries produce valid keys, pepper change breaks old saves (version-locked), fallback to basic obfuscation when crypto.subtle unavailable | Mock: crypto.subtle (or real if available) |
| `prestige.js` | 3 paths per base class, promotion requires level 20 + stat 15 + gold + quest, promoted character gains prestige abilities at milestones, veteran path gives generic abilities, prestige equipment tier T7-T10 requires prestige, capstone at level 100, promotion is irreversible, serialization roundtrip | Mock: none (pure logic) |
| `save-migration.js` | Migration architecture: `migrateSave()` runs sequential version upgrades, unknown future version rejects load with "Game update required", migrated save re-encrypted at current version with new salt/IV, pepper mismatch triggers migration attempt for older versions, migration never deletes fields, migration preserves all existing data. **No actual migrations exist yet (v1 is initial release)** — tests validate the migration framework itself, not specific migrations. | Mock: localStorage, crypto.subtle |
| `controller.js` (state machine) | All 10 states have valid transitions, invalid transitions rejected, COMBAT requires alive party + enemies, DEFEAT only from COMBAT, CAMP triggers auto-save, TOWN triggers auto-save, LOAD_GAME validates checksum, TOWN only reachable from OVERWORLD, state transitions are atomic, auto-save fires before new state renders | Mock: none (pure logic) |

#### Pathfinding Tests

| Algorithm | Test Scenarios |
|-----------|---------------|
| A* | Shortest path on uniform grid, terrain cost variations, obstacle avoidance, unreachable target returns empty, diagonal vs cardinal movement (cardinal only), performance < 10ms on 16x12 grid |
| Dijkstra | All-pairs shortest path for road networks, disconnected graph detection |
| BFS | Fog reveal radius 2 from position, edge cases at map boundaries |

#### Integration Tests

| Test | Modules Involved | Scenario |
|------|-----------------|----------|
| Combat-to-Progression | Combat, Progression, Character | After combat victory, XP is distributed to surviving members and level-up triggers stat allocation |
| Dungeon-to-Combat | Dungeon, Combat, Enemy AI | Entering a room with enemies transitions to combat with correct enemy composition |
| TimeRotation-to-Character | TimeRotation, Character, Entitlement | Daily rotation generates a valid roster respecting seasonal availability |
| Equipment-to-Sprite | Equipment, Character, SpriteEngine | Equipping an item updates the paper-doll composite |
| SaveManager roundtrip | SaveManager, Progression, Character, Equipment | Save state, modify nothing, load state: all data matches |
| Full dungeon run | All modules | Title -> Select party -> Enter dungeon -> Complete floor -> Combat -> Victory -> Camp -> Save |
| Proficiency-to-Combat | Character, Combat, Proficiency | Attacking with a weapon increments proficiency; rank-up mid-combat adds technique to action menu |
| SpellLearning-to-Combat | Character, SpellBook, Combat | Learning a spell at camp makes it available in the next combat's spell list |
| Shop-to-Equipment | Shop, Equipment, Character | Buying an item adds it to inventory; equipping checks tier requirements |
| Consumable-in-Combat | Equipment, Combat | Using a potion in combat heals the target and removes the potion from inventory |
| ScrollStudy-at-Camp | Character, Equipment, SpellBook | Caster studies scroll at camp, spell is permanently learned, scroll consumed |
| ArmorSpellFailure | Character, Equipment, Combat | Caster in heavy armor has chance to fail spells, MP wasted, turn lost |
| LevelUp-full-flow | Progression, Character, SpellBook, Proficiency | XP gain triggers level-up: stat points, spell learning, HP/MP growth, equipment tier unlock |
| Prestige-promotion-flow | Character, Prestige, Progression, Equipment | Level 20 character visits town → completes quest → promotes → gains prestige ability at 21 → equips T7 gear at 30 |
| Prestige-in-combat | Character, Prestige, Combat | Prestige abilities appear in combat action menu and deal correct effects |
| Veteran-vs-prestige | Character, Prestige, Progression | Level 30 veteran and level 30 prestige have different abilities; veteran cannot equip T7+ |
| Save-full-roundtrip | SaveManager, All contexts | Save complete game state → clear memory → load save → all data matches (including prestige, proficiency, spellbook, quest progress) |
| Save-migration-chain | SaveManager, Character | Create v1 save → close game → update to v3 → load → migration runs → prestige fields added → game works |
| Save-corruption-recovery | SaveManager | Corrupt autosave → load → backup used → toast message shown → game continues |
| AutoSave-state-transitions | SaveManager, Controller | Walk through TITLE → SELECT → OVERWORLD → TOWN → DUNGEON → COMBAT → VICTORY → CAMP, verify autosave fires at each non-combat transition |
| Town-promotion-hall | Overworld, Prestige, Character | Navigate to town on overworld → enter town → access promotion hall → promote → verify prestige in save |
| Post-20-XP-scaling | Progression, Character | Verify XP curve from level 20 to 25: each level requires quadratic scaling amount, stat points are +1 not +2 |
| Dungeon-difficulty-scouting | Overworld, Dungeon | Hover over entrance → verify tooltip matches dungeon tier data (skulls, level, floors, loot) |
| Risk-reward-underleveled | Overworld, Dungeon, Combat | Level 5 party enters Tier IV dungeon → enemies one-shot party → death penalty applied |
| Risk-reward-overleveled-xp | Overworld, Dungeon, Progression | Level 30 party farms Tier I dungeon → XP reduced to 10% (diminishing returns) |
| Strategic-retreat | Dungeon, Overworld, SaveManager | Clear floors 1-2 → retreat at floor 3 staircase → XP kept, floor 3 loot lost, return to overworld |
| Party-wipe-consequences | Combat, Progression, SaveManager | Full party death → gold halved, dungeon loot lost, characters keep levels, defeat state saved |
| Overworld-encounter-rate | Overworld, Combat | Road travel has 0% encounters; off-road Swamp travel triggers encounters at ~12% per step |
| Difficulty-zone-progression | Overworld, Dungeon | Starting town connects to Tier I/II dungeons; outer biomes connect to Tier IV/V dungeons |

#### Edge Case Tests

| Category | Test Cases |
|----------|-----------|
| Boundary values | Level 1 (min), Level 20 (prestige eligible), Level 100 (cap), 0 HP (KO), 0 MP (no spells), 0 Gold (can't buy), inventory full |
| Stat extremes | All stats at minimum (1), maximum stat stacking (race + class + equipment + level), negative modifier clamped to 1 |
| Grid boundaries | Movement at map edge, AoE pattern at grid corner, flanking at grid boundary, unit at (0,0) and (max,max) |
| Empty/null states | Empty inventory, no equipped items, no companions, empty dungeon floor (only entrance and exit) |
| Date boundaries | Dec 31 -> Jan 1 (year rollover), month boundary, leap year Feb 29, timezone edge (23:59 UTC -> 00:00 UTC) |
| Concurrent state | Lava damage kills unit before their turn, companion KO during combat, boss phase change mid-attack |
| Save edge cases | Tampered ciphertext in localStorage (AES-GCM rejects), missing buffer key, save during combat (should be prevented), exceeding storage quota, active buffer tampered with valid inactive buffer (fallback), both buffers tampered (show error), future version save (reject), migration chain with missing intermediate version, "New Game" deletes all 3 keys, permadeath enforced (defeat state encrypted -- no hex editing), hasSave() after deleteSave() returns false, active pointer corrupted ("a"/"b" neither -- try both), replay attack (old save copied back -- salt/IV mismatch with game state timeline), HMAC chain detects block reordering, crash during buffer write (other buffer intact), Web Crypto API unavailable on file:// (graceful fallback to basic obfuscation) |
| Prestige edges | Promote at exactly level 20 (min), promote at level 100 (already capped), promote with stat exactly at 15 (should work), promote with stat at 14 (should fail), promote at camp (should fail -- town only), promote twice (should fail), veteran at level 100 gets "Veteran's Resolve", prestige quest progress across sessions, T7 equip without prestige (should fail), level 21 prestige ability unlock |
| XP scaling edges | XP for level 21 matches formula (5550), XP for level 100 matches formula (109000), cumulative XP at 100 matches (3742600), stat points at level 21 are +1 not +2, HP growth diminishes post-20 |
| Proficiency edges | Already at Master rank (no further advancement), Cannot-Use weapon (0 XP gain), rank-up exactly on threshold, switching weapons mid-combat |
| Spell learning edges | Spellbook full (max known), learning duplicate spell rejected, non-caster trying to study scroll, scroll tier exceeds character level |
| Consumable edges | Potion heal exceeds max HP (capped), using last potion, revive when no ally is KO'd (grayed out), bomb friendly fire kills party member |
| Equipment requirement edges | Level 1 trying T6 gear, stat exactly at requirement threshold (should work), stat 1 below threshold (should fail), two-handed weapon + shield conflict |
| Shop edges | 0 gold attempting to buy, selling last item, shop stock on seed collision (same day different shop), legendary sell prevention |
| Armor spell failure | 0% failure (cloth), 100% failure (theoretical stacking), non-caster in full plate (no penalty), caster swaps armor mid-combat |
| Risk-reward edges | Level 1 party enters Tier VI dungeon (instant death expected), level 100 party in Tier I dungeon (10% XP minimum), XP diminishing returns at exactly 10 level delta (floor to 10%), retreat on floor 1 (keep nothing, lose nothing), party wipe with 0 gold (stays at 0), party wipe with 1 gold (rounds to 0), dungeon entrance with party level exactly matching recommended range (no warning), road encounter rate exactly 0.0, off-road encounter rate at biome boundary (uses entering biome's rate) |

#### Performance Tests

| Test | Budget | Measurement |
|------|--------|-------------|
| A* pathfinding on 16x12 grid | < 10 ms | `performance.now()` delta |
| BSP dungeon generation (7 floors) | < 50 ms | `performance.now()` delta |
| Overworld generation | < 100 ms | `performance.now()` delta |
| Paper-doll composite (8 layers) | < 5 ms | `performance.now()` delta |
| Combat turn order calculation (20 units) | < 2 ms | `performance.now()` delta |
| Save serialization | < 10 ms | `performance.now()` delta |
| Save encryption (AES-GCM + PBKDF2) | < 50 ms | `performance.now()` delta |
| Save decryption + HMAC verification | < 50 ms | `performance.now()` delta |
| Save migration (post-decrypt) | < 10 ms | `performance.now()` delta |
| Save data size (primary) | < 200 KB | `JSON.stringify().length` |
| Save data size (primary + backup + settings) | < 500 KB | Sum of all localStorage keys |
| XP formula computation (level 1-100) | < 1 ms | `performance.now()` delta |

#### Regression Policy

- Every bug fix gets a regression test reproducing the original failure
- Tests are named `testModuleName_regressionBugId_description`
- Bug ID references the issue tracker or commit hash

### TDD Workflow Per Module

Each module follows this cycle:

1. **Red**: Write a test that describes the desired behavior (from a user story AC or invariant)
2. **Green**: Implement the minimum code in the module to make the test pass
3. **Refactor**: Clean up without changing behavior, re-run tests to verify

Example TDD cycle for `terrain.js`:

```
Red:    test terrain_plains_allModifiersZero -> FAIL (terrain.js doesn't exist)
Green:  Create terrain.js with Plains definition -> PASS
Red:    test terrain_forest_defModIs15Percent -> FAIL
Green:  Add Forest definition -> PASS
Red:    test terrain_lava_movementCostIs3 -> FAIL
Green:  Add Lava definition -> PASS
Refactor: Extract terrain data into a lookup table
Red:    test terrain_allTypes_movementCostPositive -> FAIL
Green:  Add validation -> PASS
...continue until all 13 terrain types are covered
```

### Mocking Strategy

| Dependency | Mock Implementation |
|------------|-------------------|
| `Date.now()` / `new Date()` | Inject a `clock` parameter; tests pass a fixed timestamp |
| `Math.random()` | Never used directly; all randomness goes through `SeededPRNG` which is injected |
| `localStorage` | In-memory `Map<string, string>` implementing `getItem/setItem/removeItem` |
| `crypto.subtle` | Real Web Crypto API where available; otherwise a deterministic stub that exercises the same interface but with hardcoded outputs for known test vectors |
| `crypto.getRandomValues` | Inject a seeded PRNG for deterministic salt/IV generation in tests |
| `Canvas 2D` | Not mocked; rendering is tested visually. Game logic never touches Canvas |
| `requestAnimationFrame` | Not mocked; game loop is tick-driven. Tests call `tick()` directly |
| `postMessage` | Not mocked in unit tests; integration tests use a fake parent frame |

### Coverage Targets

| Metric | Target |
|--------|--------|
| Statement coverage (overall) | >= 90% |
| Branch coverage (overall) | >= 80% |
| Branch coverage (combat.js, damage formula) | 100% |
| Branch coverage (time-rotation.js) | 100% |
| Branch coverage (state machine transitions) | 100% |
| Branch coverage (save-crypto.js) | 100% |
| Branch coverage (save-manager.js) | 100% |
| Diff coverage (per change) | >= 90% |
| Mutation testing (killed mutants) | >= 60% |

### BDD Scenario Index

All Gherkin scenarios in this document are executable specifications. They map to test functions as follows:

| Scenario Location | Test File | Naming Pattern |
|-------------------|-----------|----------------|
| US-CHAR-* | `test-character.js` | `testCharacter_scenarioName` |
| US-SPRITE-* | `test-sprite.js` | `testSprite_scenarioName` |
| US-OW-* | `test-overworld-gen.js` | `testOverworld_scenarioName` |
| US-DUN-* | `test-dungeon-gen.js` | `testDungeon_scenarioName` |
| US-COMBAT-* | `test-combat.js` | `testCombat_scenarioName` |
| US-MAGIC-* | `test-spell-system.js` | `testSpell_scenarioName` |
| US-EQUIP-* | `test-equipment.js` | `testEquipment_scenarioName` |
| US-TERRAIN-* | `test-terrain.js` | `testTerrain_scenarioName` |
| US-ENEMY-* | `test-enemy-ai.js` | `testEnemyAi_scenarioName` |
| US-COMP-* | `test-companion.js` | `testCompanion_scenarioName` |
| US-TIME-* | `test-time-rotation.js` | `testTimeRotation_scenarioName` |
| US-PROG-* | `test-save-manager.js` + `test-integration.js` | `testProgression_scenarioName` |
| US-BOSS-* | `test-combat.js` (boss section) | `testBoss_scenarioName` |
| US-ENT-* | `test-entitlement.js` | `testEntitlement_scenarioName` |
| US-CHAR-10..14 (proficiency) | `test-proficiency.js` | `testProficiency_scenarioName` |
| US-CHAR-11..13 (spells) | `test-spellbook.js` | `testSpellbook_scenarioName` |
| US-MAGIC-06..08 (scrolls/meta) | `test-spellbook.js` + `test-consumables.js` | `testScroll_scenarioName` |
| US-EQUIP-09..13 (tiers/consumables) | `test-requirements.js` + `test-consumables.js` | `testRequirement_scenarioName` |
| US-PROG-09..12 (shop/train/craft) | `test-shop.js` | `testShop_scenarioName` |
| US-PRESTIGE-* | `test-prestige.js` | `testPrestige_scenarioName` |
| US-SAVE-* | `test-save-manager.js` + `test-save-migration.js` + `test-save-crypto.js` | `testSave_scenarioName` |
| US-OW-05..06 (risk/retreat) | `test-overworld-gen.js` | `testOverworld_scenarioName` |
| US-DUN-09..10 (permadeath/risk) | `test-dungeon-gen.js` + `test-integration.js` | `testDungeon_scenarioName` |

---

## 10. Planned Implementation Phases

### Phase 1 -- Core Engine
- [ ] Canvas rendering loop and state machine (10 states including TOWN and LOAD_GAME)
- [ ] Tile-based map renderer with camera
- [ ] Mouse input handler (click, hover, drag)
- [ ] Seeded PRNG and time-rotation system
- [ ] Invisible localStorage persistence: dual-buffer encrypted saves (AES-GCM, PBKDF2, HMAC), versioned schema, migration chain
- [ ] SaveCrypto module: one-time key ring (256 keys), random salt/IV per save, pepper per build, Web Crypto API
- [ ] Auto-save on every state transition (trigger table), dual-buffer A/B rotation (feels like a server -- no save/load UI)
- [ ] Corruption and tamper detection: decrypt → verify block digests → verify HMAC chain → fallback to other buffer
- [ ] Storage quota monitoring and compression fallback
- [ ] Permadeath enforcement: defeat state is saved, no save-scumming possible
- [ ] Test runner setup with first passing test
- [ ] State machine transition tests (100% branch coverage, all 10 states)
- [ ] PRNG determinism tests
- [ ] Save roundtrip tests, checksum tests, migration chain tests, corruption recovery tests

### Phase 2 -- Characters & Sprites
- [ ] Race and class definitions with stat generation
- [ ] Paper-doll sprite compositing engine
- [ ] Character select screen with daily roster
- [ ] Walking animation system (4-direction)
- [ ] Weapon proficiency tracker with rank promotions
- [ ] Spell book entity with learn/study methods
- [ ] Starting proficiency by class initialization
- [ ] Unit tests: stat block generation, variance bounds, stat floor
- [ ] Unit tests: daily roster size (6-8), determinism per date
- [ ] Unit tests: proficiency rank thresholds, attack/threat range bonuses, Cannot-Use penalty
- [ ] Unit tests: spell learning, scroll study, cantrip scaling, metamagic cost

### Phase 3 -- Combat System
- [ ] Tactical grid placement and rendering
- [ ] Turn order calculation and management
- [ ] Movement with A* pathfinding and range display
- [ ] Attack system with damage calculation (including proficiency bonuses)
- [ ] Weapon technique actions unlocked by proficiency rank
- [ ] Spell casting with MP cost, AoE targeting, and armor spell failure
- [ ] Cantrip casting (0 MP, level-scaled damage)
- [ ] Consumable item usage in combat (potions, scrolls, bombs)
- [ ] Revive mechanics (Tonic, Phoenix Down)
- [ ] Shining Force-style attack cut-in screen
- [ ] Terrain bonus application
- [ ] Flanking and elevation mechanics
- [ ] Proficiency use-counter increments on weapon attacks
- [ ] Unit tests: d20 attack resolution (attack roll vs AC, proficiency bonus, enhancement bonus)
- [ ] Unit tests: Initiative roll (d20 + DEX mod, tiebreak)
- [ ] Unit tests: movement range with terrain costs
- [ ] Unit tests: flanking geometry
- [ ] Unit tests: weapon technique effects (Riposte counter bonus, Cleave multi-hit, etc.)
- [ ] Unit tests: spell failure by armor type (0%/10%/30%/35%/40%/25% per Armor Tiers table)
- [ ] Unit tests: consumable effects (heal cap, buff duration, revive target validation)
- [ ] Integration test: combat encounter flow (start -> turns -> victory/defeat)
- [ ] Integration test: proficiency rank-up mid-combat adds technique to menu

### Phase 4 -- Dungeon Generation
- [ ] BSP room generation algorithm
- [ ] Corridor connection
- [ ] Room type placement and features
- [ ] Fog of war system
- [ ] Multi-floor progression with stairs
- [ ] Object interaction (chests, barrels, levers)
- [ ] Unit tests: BSP invariants (room size, connectivity, staircase count)
- [ ] Unit tests: fog of war reveal radius
- [ ] Integration test: dungeon -> combat transition

### Phase 5 -- Overworld Generation
- [ ] Biome placement with seeded Voronoi
- [ ] Road network generation
- [ ] Town and dungeon entrance placement
- [ ] Overworld navigation with transitions
- [ ] Points of interest and exploration
- [ ] Unit tests: connectivity invariant (all towns reachable)
- [ ] Unit tests: biome coverage (< 40% per biome)
- [ ] Unit tests: minimum dungeon entrances (>= 3)

### Phase 6 -- Content Depth
- [ ] Full spell system (9 schools, AoE patterns, scrolls, cantrips, metamagic)
- [ ] Equipment/loot generation with affixes, tiers, and stat requirements
- [ ] Consumable item system (potions, scrolls, bombs, torches, etc.)
- [ ] Shop system with tiered stock, daily rotation, and trainers
- [ ] Crafting system (Rogue trap kits, Ranger rations)
- [ ] Spell learning: level-up choices, scroll study, trainer purchase, tomes
- [ ] Enemy bestiary (all 5 tiers)
- [ ] Companion creature system (10 companions: AI modes, stat scaling, combat integration, death/revival, equipment slot)
- [ ] Boss encounters with phase transitions (50 bosses across 6 CR tiers, multi-turn tactical AI, combo state machine, reaction system)
- [ ] Boss loot tables (50 boss-specific loot tables with unique drops)
- [ ] Camp hub with shop, trainer, party management, quests, rest mechanic, camp NPCs, camp interface layout
- [ ] NPC dialogue system (dialogue tree structure, 7 NPC types, faction reputation)
- [ ] Unit tests: spell AoE patterns, MP deduction, friendly fire, scroll consumable
- [ ] Unit tests: loot rarity distribution, affix rules, set bonuses, equipment tier requirements
- [ ] Unit tests: consumable effects (heal, buff, revive, bomb AoE, torch duration)
- [ ] Unit tests: shop stock generation, buy/sell math, trainer spell filtering
- [ ] Unit tests: all 5 AI patterns, special abilities, cooldowns
- [ ] Unit tests: boss phase transitions at HP thresholds
- [ ] Integration test: full dungeon run (title to camp)
- [ ] Integration test: shop purchase -> equip -> combat with new gear
- [ ] Integration test: spell scroll study -> learned spell available in combat

### Phase 6b -- Prestige & Post-20 Progression
- [ ] Prestige class definitions (3 paths per base class, 30 total)
- [ ] PrestigeRegistry with path lookups and requirement checks
- [ ] Town Promotion Hall UI (show paths, requirements, promote button)
- [ ] Prestige quest system (per-path unlock quests, account-wide completion)
- [ ] Post-20 XP scaling formula implementation
- [ ] Prestige ability progression (10 milestones per path)
- [ ] Veteran path for non-promoted characters (generic abilities)
- [ ] T7-T10 prestige equipment tiers with prestige requirement checks
- [ ] Spell Levels 5-6 for prestige caster paths
- [ ] Prestige serialization in save data
- [ ] Unit tests: promotion requirements (level, stat, gold, quest)
- [ ] Unit tests: XP formula matches table for all milestone levels
- [ ] Unit tests: prestige abilities unlock at correct levels
- [ ] Unit tests: veteran vs prestige abilities differ
- [ ] Unit tests: T7+ equip requires prestige, fails for veteran
- [ ] Integration test: full promotion flow (town → quest → promote → ability → save)
- [ ] Integration test: prestige abilities in combat

### Phase 7 -- Time-Gated Content
- [ ] Daily/weekly/monthly rotation implementation
- [ ] Seasonal race/class availability
- [ ] Holiday event detection and content
- [ ] Daily challenge dungeon
- [ ] Weekly quest system (seeded generation, quest chains)
- [ ] Quest prerequisite system (item possession, yearly events, day-of-week, class, race, faction, boss/dungeon gates)
- [ ] Quest log UI (lock icons, prerequisite tooltips, secret "???" prereqs)
- [ ] EntitlementService stub
- [ ] Unit tests: all rotation seeds (daily, weekly, monthly, seasonal)
- [ ] Unit tests: holiday date ranges, Easter/CNY calculation
- [ ] Unit tests: entitlement stub, seasonal free windows
- [ ] Unit tests: date boundary rollover (Dec 31 -> Jan 1)

### Phase 8 -- Polish & Audio
- [ ] Audio system (Web Audio API): ambient music with pause/resume, battle music with dynamic event layers, result stings
- [ ] SFX system: combat SFX (12 weapon types), spell SFX (9 schools), UI SFX, movement SFX, ambient environment loops
- [ ] Audio crossfade and priority-based channel pooling (12 channels)
- [ ] UI polish (menus, tooltips, transitions)
- [ ] Tutorial / how-to-play overlay (8-step first-run tutorial, scripted combat, tooltip system)
- [ ] Performance optimization (viewport culling, sprite caching)
- [ ] Balance pass on all stats, costs, and drop rates
- [ ] Manifest entry and SZ Desktop integration
- [ ] Performance tests: all budgets met
- [ ] Full regression suite green
- [ ] Coverage targets met (>= 90% statement, >= 80% branch)

### Phase 9 -- Asset Forge Pipeline (Tooling)

The game requires thousands of unique art assets. Since all assets are sourced from **free internet resources** or **generated via image generation networks** (DALL-E, Stable Diffusion, Midjourney, etc.), a dedicated **Asset Forge** tool automates the generation, slicing, verification, and cataloging pipeline.

#### Asset Forge Tool Architecture

The Asset Forge is a **standalone Node.js CLI tool** (separate from the game) that runs locally. It does NOT ship with the game.

```
tools/asset-forge/
  forge.js              CLI entry point
  generators/
    prompt-builder.js   Constructs image generation prompts from asset manifest
    api-client.js       Adapter for image generation APIs (DALL-E, SD WebUI, etc.)
  slicers/
    grid-slicer.js      Splits sprite sheets by 32×32 grid
    animation-slicer.js Extracts animation frames from strips
    tileset-slicer.js   Handles tileset auto-tiling rules (47-tile Wang set)
  verifiers/
    frame-validator.js  Checks for blank frames, size mismatches, transparency errors
    animation-preview.js Renders animated GIF preview for each sprite set
    palette-checker.js  Validates sprite matches dimension palette (hue range, saturation)
    alignment-checker.js Overlays paper-doll layers and checks anchor point alignment
    style-scorer.js     Compares style consistency against reference sheet
  catalog/
    manifest.json       Master asset manifest (every required asset, status, metadata)
    manifest-schema.js  JSON Schema for manifest validation
  output/
    previews/           Generated preview GIFs for visual inspection
    reports/            HTML reports with pass/fail per asset
  package.json
  README.md
```

#### Asset Manifest Schema

Every required asset is tracked in `manifest.json`:

```json
{
  "assetId": "char-body-human-front",
  "category": "character-body",
  "dimension": "all",
  "race": "human",
  "direction": "front",
  "frameCount": 5,
  "tileSize": [32, 32],
  "status": "verified",
  "generationPrompt": "pixel art, 32x32, human male warrior body, front-facing, 5 frames walk cycle, transparent background, Shining Force II style",
  "sourceFile": "assets/characters/bodies/human-front.png",
  "generatedAt": "2026-03-15T10:30:00Z",
  "verifiedAt": "2026-03-15T10:31:00Z",
  "verificationScore": 0.92,
  "issues": []
}
```

Status flow: `missing` → `generating` → `generated` → `slicing` → `sliced` → `verifying` → `verified` → `approved` (manual sign-off)

#### Pipeline Stages

**Stage 1: Prompt Generation**
- Read `manifest.json` for all assets with status `missing`
- Construct image-gen prompts from templates:
  ```
  Template: "pixel art, {tileSize}, {race} {class} {direction}, {frameCount} frames {animation}, transparent background, {styleguide}"
  ```
- Style guide reference: "Shining Force II Sega Genesis, muted earth tones, clean pixel edges, no anti-aliasing"
- Dimension-specific palette constraints appended (e.g., "Feywild: saturated greens and purples")

Example prompts by category:

| Category | Example Prompt |
|----------|---------------|
| Character body | "pixel art sprite sheet, 32x32, human male body, front-facing idle + 4-frame walk cycle, transparent background, Shining Force II Sega Genesis style, muted earth tones, clean pixel edges, no anti-aliasing, no outline glow" |
| Class clothing | "pixel art overlay, 32x32, wizard robes blue/silver, front-facing, 5 frames matching walk cycle, transparent background, layer must align with human body anchor, Shining Force II style" |
| Enemy sprite | "pixel art sprite sheet, 32x32, goblin warrior with rusty sword, front-facing 4-frame idle cycle, green skin, leather scraps, menacing pose, transparent background, SNES RPG style, max 24 colors" |
| Boss sprite | "pixel art sprite sheet, 48x48, ancient red dragon, front-facing, 6-frame animation (idle + wing flap + breath), red/gold/black palette, imposing scale, transparent background, Shining Force II boss style, max 32 colors" |
| Terrain tile | "pixel art tileset, 32x32, grass plains tile, top-down perspective, seamless edges, 3 variants (short grass, tall grass, flowers), muted green/brown palette, Shining Force overworld style" |
| Spell effect | "pixel art animation strip, 32x32, fireball explosion, 8 frames, orange/red/yellow expanding burst, transparent background, SNES RPG magic effect, max 16 colors" |
| Portrait | "pixel art portrait, 64x64, dwarf cleric female, stern expression, holy symbol necklace, braided beard, Shining Force II character select style, warm lighting, detailed face" |
| Feywild tile | "pixel art tileset, 32x32, enchanted forest floor, top-down, glowing mushrooms, crystal grass, saturated greens and purples, magical atmosphere, seamless edges" |

**Stage 2: Image Generation**
- Submit prompts to configured API (supports multiple backends):
  - DALL-E 3 via OpenAI API
  - Stable Diffusion via local WebUI API
  - Midjourney via Discord webhook (fallback)
- Save raw output to `output/raw/`
- Log prompt + seed + model for reproducibility
- Batch mode: generate up to 50 assets in parallel

**Stage 3: Automated Slicing**
- **Grid slicer**: Cut sprite sheet into 32×32 cells, left-to-right, top-to-bottom
- **Animation slicer**: Extract N frames from horizontal strip based on manifest `frameCount`
- **Tileset slicer**: For terrain tiles, generate 47-tile Wang blob set from 5-tile template using edge-matching rules
- **Paper-doll slicer**: Split layered output into separate layers (body, clothing, weapon, etc.) if generated as composite
- Output individual frames as PNG with transparent background
- Naming convention: `{assetId}-frame-{N}.png`

**Stage 4: Automated Verification**

| Check | Pass Criteria | Tool |
|-------|--------------|------|
| **Frame dimensions** | Every frame is exactly `tileSize` pixels | frame-validator |
| **Blank frame detection** | No frame is >95% transparent (empty) | frame-validator |
| **Color count** | Frames use ≤ 32 unique colors (pixel art constraint) | palette-checker |
| **Palette consistency** | All frames in a set share ≥ 80% of their palette | palette-checker |
| **Dimension palette** | Hue range matches target dimension (±15° from reference) | palette-checker |
| **Animation smoothness** | Frame-to-frame pixel change is 5-40% (not too static, not too jumpy) | animation-preview |
| **Anchor alignment** | Paper-doll layers line up within ±2px of reference anchor points | alignment-checker |
| **Style consistency** | Perceptual hash distance from reference sheet < 0.3 | style-scorer |
| **Transparency** | Background is fully transparent (no stray opaque pixels outside sprite) | frame-validator |

**Stage 5: Preview Generation**
- Render each verified sprite set as an animated GIF (150ms/frame)
- Side-by-side preview for all 3 directions (front, back, side)
- Paper-doll composite preview: stack all layers for a given race/class/equipment combo
- Walking cycle preview on terrain background
- Generate HTML report: thumbnail grid of all assets with pass/fail badges

**Stage 6: Manual Approval**
- Review HTML report in browser
- Click-to-approve or click-to-reject with notes
- Rejected assets return to `missing` status with notes for prompt refinement
- Approved assets move to `approved` and are copied to `assets/` game folder

#### Asset Count Estimates

| Category | Count | Notes |
|----------|-------|-------|
| Character bodies | 8 races × 3 directions × 5 frames = **120 sheets** | Paper-doll base layer |
| Class clothing | 10 classes × 3 directions × 5 frames = **150 sheets** | Overlay layer |
| Weapon sprites | 10 categories × 6 tiers × 3 directions = **180 sheets** | Paper-doll weapon layer |
| Armor sprites | 6 armor types × 6 tiers × 3 directions = **108 sheets** | Paper-doll armor layer |
| Shield sprites | 6 types × 6 tiers × 3 directions = **108 sheets** | Paper-doll shield layer |
| Helmet sprites | 6 types × 6 tiers × 3 directions = **108 sheets** | Paper-doll helmet layer |
| Boots sprites | 6 types × 6 tiers × 3 directions = **108 sheets** | Paper-doll boots layer |
| Enemy sprites | 120+ types × 3 directions × 4 frames = **1,440+ sheets** | Each enemy needs idle+walk |
| Companion sprites | 10 creatures × 3 directions × 4 frames = **120 sheets** | Smaller scale (0.75x) |
| Boss sprites | 50 bosses × 3 directions × 6 frames = **900 sheets** | Larger, multi-phase |
| Terrain tilesets | 12 dimensions × ~14 tile types × 3 variants = **~500 tiles** | 32×32 each |
| Spell effects | 60+ spells × 6-12 frames = **~500 animation strips** | Particle sequences |
| UI elements | Buttons, panels, icons, portraits = **~300 assets** | Various sizes |
| Portraits | 80 race/class combos × 2 (normal + prestige) = **160 portraits** | 64×64 |
| **Total estimate** | **~4,500+ individual asset files** | |

#### UI Auto-Testing (Screenshot Regression)

In addition to asset generation, the Asset Forge includes a **UI screenshot regression** module:

1. **Capture**: Headless browser renders each game screen (title, character select, overworld, dungeon, combat, camp, shop, etc.) at 940×660 and saves as PNG
2. **Baseline**: First run establishes golden screenshots per screen
3. **Diff**: Subsequent runs compare against golden screenshots using perceptual hash + pixel-level diff
4. **Report**: HTML report shows side-by-side (expected vs actual) with highlighted differences
5. **Threshold**: Pixel diff > 2% flags as regression; > 10% flags as broken
6. **Trigger**: Runs automatically after any CSS, renderer, or skin change

```
tools/asset-forge/ui-test/
  capture.js          Headless browser screenshot capture
  diff.js             Perceptual hash + pixel diff
  golden/             Baseline screenshots
  reports/            Diff reports (HTML)
```

- [ ] CLI: `node forge.js generate --category character-body --race human`
- [ ] CLI: `node forge.js slice --input raw/human-front.png --grid 32x32 --frames 5`
- [ ] CLI: `node forge.js verify --category all` (batch verification)
- [ ] CLI: `node forge.js preview --output previews/` (generate all GIFs)
- [ ] CLI: `node forge.js report` (generate HTML report)
- [ ] CLI: `node forge.js ui-test --baseline` (capture golden screenshots)
- [ ] CLI: `node forge.js ui-test --diff` (compare against golden)
- [ ] Manifest schema validation on every run
- [ ] Integration with game build: fail if any `missing` or `rejected` assets exist

---

## 11. Known Limitations

- **Browser-only**: No native executable; runs in SZ Desktop iframe
- **No multiplayer**: Single-player only; all content rotation is date-deterministic
- **Canvas performance ceiling**: Complex scenes (many sprites, effects) may drop below 60 FPS on older hardware
- **localStorage size limit**: ~5-10 MB per origin; save data must stay under 200 KB per slot with compression fallback
- **No server-side persistence**: Save data lives in the browser; clearing browser data or localStorage loses progress permanently. Auto-save + backup mitigates crashes but not data wipes
- **No real entitlement backend**: Stub returns "all unlocked"; real monetization requires a backend service
- **Pixel art asset volume**: ~4,000+ individual asset files across 12 dimensions, 120+ enemy types, and full paper-doll layering. Asset Forge pipeline mitigates but requires AI generation quality control
- **Infinite world memory**: LRU cache of 64 chunks; WFC generation must stay under 4ms/chunk or fall back to noise-only
- **WFC boundary stitching**: Generating chunks out-of-order may create suboptimal transitions at boundaries if neighbors generate later
- **120+ enemy types**: Each needs unique sprites, AI tuning, and balance testing; dimensional variants multiply the visual asset count further
- **D&D SRD licensing**: Spell/monster names inspired by D&D 3e SRD (OGL content); avoid Wizards of the Coast product identity terms
- **Holiday date calculation**: Easter and Chinese New Year dates require algorithmic computation (lunisolar calendar)
- **Mouse-only constraint**: No keyboard shortcuts; all interaction must be click/hover/drag accessible
- **Balance at high levels**: Levels 50-100 require extensive playtesting to ensure prestige abilities don't trivialize content or create must-pick paths
- **30 prestige paths**: Each path needs 10 unique abilities; total of 300 prestige abilities to design and balance
- **Save migration complexity**: Each schema change requires a forward-only migration function; no rollback support
- **Client-side crypto limits**: Key ring is in the JS bundle; a dedicated reverse engineer can extract keys. Anti-tamper is a deterrent, not absolute security (appropriate for a single-player game)
- **Web Crypto API availability**: `crypto.subtle` may not be available on `file://` in all browsers; fallback to basic obfuscation needed
- **Encryption performance**: PBKDF2 + AES-GCM adds ~50ms to each save/load cycle; acceptable for state transitions but prohibits per-frame saves

---

## 12. Manifest Entry (Future)

When `index.html` is implemented, this entry will be added to `Applications/manifest.js`:

```js
{
  id: 'tactical-realms',
  title: 'Tactical Realms',
  icon: 'Games/tactical-realms/icon.svg',
  type: 'iframe',
  entry: 'Games/tactical-realms/index.html',
  width: 780,
  height: 620,
  resizable: true,
  minimizable: true,
  maximizable: true,
  singleton: true,
  category: 'Games'
}
```
