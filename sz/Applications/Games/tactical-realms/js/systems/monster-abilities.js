;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Monster special abilities, read from the stat block's trait strings
  // (SRD rules, simplified to the board): defences (spell resistance,
  // damage reduction, energy immunity/resistance/vulnerability, healing),
  // riders on a hit (poison, paralysis, drain, disease, grab), and actions
  // (breath weapons, gazes, fear, webs, spit, rocks, eye rays, mind blasts).
  //
  // Pure rules: the combat engine applies the results.

  const ENERGY = Object.freeze(['fire', 'cold', 'acid', 'electricity', 'sonic']);
  const ENERGY_ALIASES = Object.freeze({ lightning: 'electricity', frost: 'cold', ice: 'cold', thunder: 'sonic' });

  // What creature types are immune to (SRD type traits).
  const TYPE_IMMUNITIES = Object.freeze({
    undead_traits: ['poison', 'paralysis', 'sleep', 'stun', 'mind', 'disease', 'drain', 'death'],
    construct_traits: ['poison', 'paralysis', 'sleep', 'stun', 'mind', 'disease', 'drain', 'death'],
    ooze_traits: ['poison', 'paralysis', 'sleep', 'stun', 'mind', 'petrify'],
    plant_traits: ['poison', 'paralysis', 'sleep', 'stun', 'mind'],
    elemental_traits: ['poison', 'paralysis', 'sleep', 'stun'],
    vermin_traits: ['mind'],
    mindless: ['mind'],
  });

  // Conditions and the immunity that wards them off.
  const CONDITION_IMMUNITY = Object.freeze({
    paralyzed: 'paralysis', stunned: 'stun', confused: 'mind', shaken: 'mind', frightened: 'mind',
    fascinated: 'mind', unconscious: 'sleep', helpless: 'sleep', petrified: 'petrify', sickened: 'disease',
    energy_drained: 'drain', fatigued: 'drain', slowed: null, entangled: null, grappled: null,
  });

  // Breath effects that are not plain energy damage.
  const BREATH_EFFECTS = Object.freeze({
    sleep: { save: 'will', condition: 'unconscious', rounds: [2, 4], element: 'psychic' },
    slow: { save: 'will', condition: 'slowed', rounds: [3, 6], element: 'arcane' },
    paralysis: { save: 'fort', condition: 'paralyzed', rounds: [1, 4], element: 'arcane' },
    weakening: { save: 'fort', condition: 'fatigued', rounds: [4, 8], element: 'necrotic' },
    repulsion: { save: 'will', condition: 'shaken', rounds: [2, 4], element: 'force' },
  });

  const SIZE_ORDER = 'FDTSMLHGC';
  // cone length in tiles by size (lines reach twice as far)
  const CONE_BY_SIZE = Object.freeze({ F: 2, D: 2, T: 3, S: 3, M: 4, L: 6, H: 7, G: 8, C: 9 });

  const _cache = new WeakMap();

  function mod(score) {
    return Math.floor(((score == null ? 10 : score) - 10) / 2);
  }

  function energyOf(word) {
    const w = ENERGY_ALIASES[word] || word;
    return ENERGY.includes(w) ? w : null;
  }

  // --- parsing ----------------------------------------------------------------

  function parse(ch) {
    if (!ch)
      return null;
    if (_cache.has(ch))
      return _cache.get(ch);
    const traits = ch.traits || [];
    const a = {
      sr: 0, dr: null, immune: new Set(), resist: {}, vuln: new Set(), regen: 0, fastHeal: 0,
      incorporeal: false, breath: null, riders: [], gaze: null, aura: null, specials: [], spells: [],
    };
    for (const t of traits) {
      let m;
      if ((m = /^spell_resistance_(\d+)$/.exec(t)))
        a.sr = +m[1];
      else if ((m = /^damage_reduction_(\d+)(?:_(.+))?$/.exec(t)))
        a.dr = { amount: +m[1], bypass: m[2] ? m[2].split(/_(?:and|or)_/) : [], needsAll: /_and_/.test(m[2] || '') };
      else if ((m = /^immunity_(.+)$/.exec(t)))
        for (const w of m[1].split('_')) {
          const e = energyOf(w);
          if (e)
            a.immune.add(e);
          else if (/^(mind|affecting|charm|fear|compulsion|phantasms)$/.test(w))
            a.immune.add('mind');
          else
            a.immune.add(w);
        }
      else if (/resistance/.test(t) && (m = /_(\d+)$/.exec(t))) {
        // resistance_acid_cold_10, fire_resistance_10, cold_and_fire_resistance_10
        for (const w of t.split('_')) {
          const e = energyOf(w);
          if (e)
            a.resist[e] = Math.max(a.resist[e] || 0, +m[1]);
        }
      } else if ((m = /^vulnerability_(.+)$/.exec(t)))
        for (const w of m[1].split('_')) {
          const e = energyOf(w);
          if (e)
            a.vuln.add(e);
        }
      else if ((m = /^regeneration_(\d+)$/.exec(t)))
        a.regen = +m[1];
      else if ((m = /^fast_healing_(\d+)$/.exec(t)))
        a.fastHeal = +m[1];
      else if (t === 'incorporeal')
        a.incorporeal = true;
      else if (TYPE_IMMUNITIES[t])
        for (const i of TYPE_IMMUNITIES[t])
          a.immune.add(i);
      else if (t.startsWith('breath_weapon'))
        a.breath = parseBreath(t, ch);
      else if (/^(poison|poison_sting|poison_bite|poison_thorns|poison_reservoir)$/.test(t))
        a.riders.push('poison');
      else if (/^(paralysis|paralyzing_touch|paralytic_tentacles|paralysis_tentacles|paralyzing_tongue|paralysis_even_elves)$/.test(t))
        a.riders.push('paralysis');
      else if (/^energy_drain/.test(t))
        a.riders.push('drain');
      else if (/^(strength_damage|constitution_drain|wisdom_drain|weakness|corruption_touch)$/.test(t))
        a.riders.push('weaken');
      else if (/^(disease|ghoul_fever|mummy_rot|filth_fever)$/.test(t))
        a.riders.push('disease');
      else if (t === 'blood_drain')
        a.riders.push('blood');
      else if (t === 'improved_grab')
        a.riders.push('grab');
      else if (t === 'constrict' || t === 'crush')
        a.riders.push('constrict');
      else if (t === 'rend')
        a.riders.push('rend');
      else if (/^(petrifying_gaze|petrification_bite)$/.test(t))
        a.gaze = { kind: 'petrify', save: 'fort', ability: 'cha' };
      else if (/^(stun_gaze|stunning_glance)$/.test(t))
        a.gaze = { kind: 'stun', save: 'will', ability: 'cha' };
      else if (/^(confusing_gaze|insanity|madness)$/.test(t))
        a.gaze = { kind: 'confuse', save: 'will', ability: 'cha' };
      else if (t === 'death_gaze')
        a.gaze = { kind: 'death', save: 'fort', ability: 'cha' };
      else if (/^(frightful_presence|fear_aura(?:_\d+)?|horrific_appearance|despair|unnerving_gaze|howl|moan)$/.test(t))
        a.aura = { kind: 'fear', save: 'will', ability: 'cha' };
      else if (/^(web|adhesive|strands|entangle_rope)$/.test(t))
        a.specials.push('web');
      else if (/^(acid_spit|spit_poison|spittle)$/.test(t))
        a.specials.push('spit');
      else if (t === 'rock_throwing')
        a.specials.push('rock');
      else if (/^eye_rays/.test(t))
        a.specials.push('rays');
      else if (/^(mind_blast|stunning_screech)$/.test(t))
        a.specials.push('mindblast');
    }
    a.spells = spellsFor(traits, ch.casterLevel || 0, ch.level || 1);
    _cache.set(ch, a);
    return a;
  }

  function parseBreath(t, ch) {
    const rest = t.replace(/^breath_weapon_?/, '');
    const parts = rest ? rest.split('_') : [];
    const shape = parts.includes('line') ? 'line' : 'cone';
    const word = parts.filter(w => w !== 'line' && w !== 'cone').join('_') || 'fire';
    const effect = BREATH_EFFECTS[word] || null;
    const energy = energyOf(word) || (word === 'steam' || word === 'magma' ? 'fire' : word === 'poison_gas' || word === 'poison' ? null : word === 'dust' || word === 'salt' || word === 'rock' ? null : 'fire');
    const hd = ch.level || 1;
    const dice = ch.breath ? ch.breath.dice : Math.max(1, Math.min(12, Math.floor(hd / 2)));
    const sides = ch.breath ? ch.breath.sides : (word === 'poison_gas' || word === 'poison' ? 6 : 6);
    const size = String(ch.size || 'M').charAt(0);
    const reach = CONE_BY_SIZE[size] || 4;
    return {
      word, shape, effect, energy: effect ? null : energy, poison: word === 'poison_gas' || word === 'poison',
      dice: effect ? 0 : dice, sides, length: shape === 'line' ? reach * 2 : reach,
    };
  }

  // Spellcasters among monsters (dragons, outsiders, hags) get real spells
  // from the game's list, by caster level; named spell-likes are added.
  const CASTER_SPELLS = [
    [1, ['magic_missile', 'burning_hands']],
    [3, ['scorching_ray', 'hold_person']],
    [5, ['fireball', 'lightning_bolt']],
    [7, ['ice_storm', 'blight']],
  ];

  function spellsFor(traits, casterLevel = 0, level = 1) {
    const out = new Set();
    let cl = casterLevel;
    for (const t of traits) {
      const m = /^(?:sorcerer_casting|spellcasting_wizard)_(\d+)$/.exec(t);
      if (m)
        cl = Math.max(cl, +m[1]);
    }
    if (traits.some(t => t === 'spells' || /^sorcerer_spells_/.test(t)))
      cl = Math.max(cl, Math.ceil(level / 2));
    for (const [lvl, ids] of CASTER_SPELLS)
      if (cl >= lvl)
        for (const id of ids)
          out.add(id);
    // spell-like abilities that exist in the game's spell list
    for (const t of traits) {
      const id = t.replace(/^spell_like_/, '');
      if (TR.Spells && TR.Spells.byId && TR.Spells.byId(id))
        out.add(id);
    }
    return [...out].filter(id => !TR.Spells || !TR.Spells.byId || TR.Spells.byId(id));
  }

  // --- rules helpers -----------------------------------------------------------

  // Save DC of a monster ability: 10 + half its HD + the ability's modifier.
  function saveDC(ch, ability = 'con') {
    const stats = ch.stats || {};
    // undead have no Con: they use Charisma
    const ab = ability === 'con' && ch.creatureType === 'undead' ? 'cha' : ability;
    return 10 + Math.floor((ch.level || 1) / 2) + mod(stats[ab]);
  }

  // Save bonus of a unit: party saves exclude ability modifiers, monster
  // stat-block saves include them.
  function saveBonus(unit, kind, penalty = 0) {
    const ch = unit.character;
    const base = (ch.saves && ch.saves[kind]) || 0;
    if (ch.race === 'monster')
      return base + penalty;
    const ab = kind === 'fort' ? 'con' : kind === 'ref' ? 'dex' : 'wis';
    return base + mod(ch.stats && ch.stats[ab]) + penalty;
  }

  function isImmune(unit, what) {
    const a = parse(unit.character);
    return !!(a && what && a.immune.has(what));
  }

  function immuneToCondition(unit, condition) {
    return isImmune(unit, CONDITION_IMMUNITY[condition]);
  }

  // Damage after defences. kind: 'physical' or an energy type.
  // weapon: the attacker's weapon item (for DR bypass), if any.
  // Returns { amount, note }.
  function adjustDamage(unit, amount, kind = 'physical', weapon = null, prng = null) {
    const a = parse(unit.character);
    if (!a || amount <= 0)
      return { amount, note: null };
    if (kind === 'physical') {
      if (a.incorporeal && prng && prng.next() < 0.5)
        return { amount: 0, note: 'passes through' };
      if (a.dr && !bypassesDR(a.dr, weapon)) {
        const after = Math.max(0, amount - a.dr.amount);
        return { amount: after, note: after < amount ? `DR ${a.dr.amount}` : null };
      }
      return { amount, note: null };
    }
    const e = energyOf(kind) || kind;
    if (a.immune.has(e))
      return { amount: 0, note: `immune to ${e}` };
    let out = amount;
    let note = null;
    if (a.resist[e]) {
      out = Math.max(0, out - a.resist[e]);
      note = `resists ${e}`;
    }
    if (a.vuln.has(e)) {
      out = Math.floor(out * 1.5);
      note = `vulnerable to ${e}`;
    }
    return { amount: out, note };
  }

  function weaponDamageType(weapon) {
    const n = (weapon && weapon.name || '').toLowerCase();
    if (/mace|hammer|club|flail|staff|morningstar|sling/.test(n))
      return 'bludgeoning';
    if (/spear|rapier|dagger|arrow|bow|pick|lance|trident/.test(n))
      return 'piercing';
    return 'slashing';
  }

  // Enchanted weapons count as magic; nothing in the game is blessed,
  // silvered or cold-forged, so those reductions hold.
  function bypassesDR(dr, weapon) {
    if (!dr.bypass.length)
      return false;
    const tags = new Set();
    if (weapon) {
      tags.add(weaponDamageType(weapon));
      if (weapon.affixDamage || weapon.affix || (weapon.tier || 1) >= 2 || (weapon.stats && weapon.stats.attack > 0))
        tags.add('magic');
    }
    return dr.needsAll ? dr.bypass.every(b => tags.has(b)) : dr.bypass.some(b => tags.has(b));
  }

  function spellElement(spell) {
    if (!spell)
      return null;
    const el = TR.BattleFx ? TR.BattleFx.elementOf(spell) : null;
    return energyOf(el) || (el === 'frost' ? 'cold' : el === 'lightning' ? 'electricity' : null);
  }

  // --- areas ------------------------------------------------------------------

  // Tiles of a cone or line from (c0, r0) toward direction (dc, dr).
  function areaTiles(c0, r0, dc, dr, shape, length) {
    const out = [];
    if (shape === 'line') {
      for (let i = 1; i <= length; ++i)
        out.push({ col: c0 + dc * i, row: r0 + dr * i });
      return out;
    }
    // cone: widens one tile to each side every step (a quarter circle)
    const len = Math.hypot(dc, dr) || 1;
    const ux = dc / len, uy = dr / len;
    for (let r = r0 - length; r <= r0 + length; ++r)
      for (let c = c0 - length; c <= c0 + length; ++c) {
        const vx = c - c0, vy = r - r0;
        const d = Math.hypot(vx, vy);
        if (d < 0.5 || d > length + 0.5)
          continue;
        if ((vx * ux + vy * uy) / d >= Math.cos(Math.PI / 4) - 1e-9)
          out.push({ col: c, row: r });
      }
    return out;
  }

  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Best direction for a breath or blast: most foes, no friends.
  function bestArea(grid, unit, foes, friends, shape, length) {
    const p = unit.position;
    let best = null;
    for (const [dc, dr] of DIRS8) {
      const tiles = areaTiles(p.col, p.row, dc, dr, shape, length).filter(t => grid.inBounds(t.col, t.row));
      const key = new Set(tiles.map(t => `${t.col},${t.row}`));
      const hit = foes.filter(f => f.isAlive && key.has(`${f.position.col},${f.position.row}`));
      const own = friends.filter(f => f !== unit && f.isAlive && key.has(`${f.position.col},${f.position.row}`));
      const score = hit.length * 3 - own.length * 4;
      if (hit.length && (!best || score > best.score))
        best = { dir: [dc, dr], tiles, hit, own, score };
    }
    return best;
  }

  function distance(a, b) {
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  }

  TR.MonsterAbilities = Object.freeze({
    ENERGY, BREATH_EFFECTS, CONDITION_IMMUNITY, SIZE_ORDER,
    parse, spellsFor, saveDC, saveBonus, isImmune, immuneToCondition, adjustDamage, bypassesDR,
    spellElement, areaTiles, bestArea, distance, energyOf, weaponDamageType, mod,
  });
})();
