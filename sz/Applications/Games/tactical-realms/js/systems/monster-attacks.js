;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Natural attack routines for monsters, after the SRD's natural weapon
  // tables: what a creature attacks with (bite, claws, slam, gore, sting,
  // tentacles or a weapon) and how hard each hits for its size. The stat
  // block's damage stays the primary attack; secondary attacks hit at -5
  // and add half Strength.

  const SIZES = ['F', 'D', 'T', 'S', 'M', 'L', 'H', 'G', 'C'];

  // Damage by size for each natural weapon, Fine .. Colossal.
  const DAMAGE = Object.freeze({
    bite:     [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8], [4, 6]],
    claw:     [[1, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8]],
    slam:     [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8], [4, 6]],
    gore:     [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8], [4, 6]],
    sting:    [[1, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8]],
    tentacle: [[1, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8]],
    hoof:     [[1, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 6], [2, 8]],
  });

  // Routines by creature id, checked first; [primary, ...secondary].
  // Words match whole parts of the id ("rat" in "dire_rat", not "pirate").
  const part = words => new RegExp(`(?:^|_)(?:${words})(?:_|$)`);
  const BY_NAME = [
    [part('[a-z]+_dragon|dragon|wyrm|wyrmling'), ['bite', 'claw', 'claw']],
    [part('bear|dire_bear'), ['claw', 'claw', 'bite']],
    [part('lion|tiger|leopard|cheetah|panther|cat|dire_lion|dire_tiger'), ['claw', 'claw', 'bite']],
    [part('griffon|hippogriff|roc|eagle|owl|hawk|vulture|giant_eagle|giant_owl'), ['claw', 'claw', 'bite']],
    [part('scorpion|monstrous_scorpion'), ['claw', 'claw', 'sting']],
    [part('manticore'), ['claw', 'claw', 'bite']],
    [part('ghoul|ghast|troll'), ['claw', 'claw', 'bite']],
    [part('wolf|dog|hound|jackal|hyena|worg|rat|weasel|badger|wolverine|snake|viper|crocodile|lizard|shark|dire_rat|dire_wolf'), ['bite']],
    [part('boar|rhinoceros|bison|bull|minotaur|dire_boar'), ['gore']],
    [part('horse|pony|mule|camel|unicorn|nightmare|warhorse'), ['hoof', 'hoof', 'bite']],
    [part('spider|ant|beetle|centipede|wasp|bee'), ['bite']],
    [part('octopus|squid|kraken|darkmantle|cloaker|crawler'), ['tentacle', 'tentacle', 'bite']],
    [part('skeleton'), ['claw', 'claw']],
    [part('zombie|mummy|golem|elemental|ooze|jelly|pudding|cube|mound|treant'), ['slam']],
  ];

  // Fallbacks by creature type.
  const BY_TYPE = Object.freeze({
    animal: ['bite'],
    magical_beast: ['bite', 'claw', 'claw'],
    vermin: ['bite'],
    ooze: ['slam'],
    plant: ['slam'],
    elemental: ['slam'],
    construct: ['slam', 'slam'],
    aberration: ['tentacle', 'tentacle', 'bite'],
    undead: ['slam'],
  });

  function sizeIndex(size) {
    const i = SIZES.indexOf(String(size || 'M').charAt(0).toUpperCase());
    return i < 0 ? 4 : i;
  }

  // ch: a combat character (monsters have race 'monster' and class = id).
  // Returns [{ name, dice, sides, primary }]; one entry means a single attack.
  function routine(ch) {
    if (!ch || ch.race !== 'monster')
      return null;
    const id = String(ch.class || '');
    const type = ch.creatureType || '';
    const smart = ch.stats && ch.stats.int >= 6;
    let names = null;
    for (const [re, list] of BY_NAME)
      if (re.test(id)) {
        names = list;
        break;
      }
    // thinking humanoids and giants swing weapons
    if (!names && (type === 'humanoid' || type === 'giant' || type === 'monstrous_humanoid' || ((type === 'outsider' || type === 'fey') && smart)))
      names = ['weapon'];
    if (!names)
      names = BY_TYPE[type] || ['weapon'];
    const si = sizeIndex(ch.size);
    return names.map((name, i) => {
      // the stat block's damage is the primary attack
      if (i === 0 || name === 'weapon')
        return { name, dice: ch.damageDice || 1, sides: ch.damageSides || 6, primary: i === 0 };
      const [dice, sides] = (DAMAGE[name] || DAMAGE.claw)[si];
      return { name, dice, sides, primary: false };
    });
  }

  // Does this creature attack with everything after moving? (SRD pounce)
  function canPounce(ch) {
    return !!(ch && ch.traits && ch.traits.includes('pounce'));
  }

  TR.MonsterAttacks = Object.freeze({ DAMAGE, routine, canPounce, sizeIndex });
})();
