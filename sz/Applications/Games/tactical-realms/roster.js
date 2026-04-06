;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const { PRNG, Character, RACES, CLASSES } = TR;

  const FIRST_NAMES = Object.freeze([
    'Aelric', 'Brenna', 'Caelum', 'Dahlia', 'Eryndor', 'Fiora', 'Gareth', 'Helena',
    'Isarn', 'Jael', 'Kael', 'Lyra', 'Maren', 'Nyx', 'Orin', 'Petra',
    'Quill', 'Rowan', 'Seren', 'Thane', 'Uma', 'Vesper', 'Wren', 'Xara',
    'Yorick', 'Zara', 'Aldric', 'Belen', 'Corvin', 'Dara', 'Elara', 'Fenn',
    'Gwyn', 'Hadrian', 'Ilya', 'Jarek', 'Kira', 'Leoric', 'Mira', 'Nero',
  ]);

  const LAST_NAMES = Object.freeze([
    'Ashford', 'Blackthorn', 'Crowley', 'Dunmore', 'Everwood', 'Frostborne',
    'Greymane', 'Hawkridge', 'Ironforge', 'Jareth', 'Keldwin', 'Lightfoot',
    'Moorfield', 'Nighthollow', 'Oakenshield', 'Proudfoot', 'Ravencrest',
    'Stonehelm', 'Thornwall', 'Underhill', 'Valewind', 'Winterbourne',
    'Wyrmwood', 'Yarrow', 'Zephyrheart',
  ]);

  const Roster = {

    generateName(prng) {
      const first = prng.pick(FIRST_NAMES);
      const last = prng.pick(LAST_NAMES);
      return `${first} ${last}`;
    },

    generateDailyRoster(dateSeed, season, prng) {
      const rosterPrng = prng.fork('roster');
      const count = rosterPrng.nextInt(6, 8);

      const availableRaces = RACES.filter(r => !r.season || r.season === season);
      const availableClasses = CLASSES.filter(c => !c.season || c.season === season);

      const characters = [];
      for (let i = 0; i < count; ++i) {
        const race = rosterPrng.pick(availableRaces);
        const cls = rosterPrng.pick(availableClasses);
        const name = Roster.generateName(rosterPrng);
        const char = Character.createCharacter(race.id, cls.id, name, 1, rosterPrng);
        const varied = Character.applyDailyVariance(char, rosterPrng, null);
        characters.push(varied);
      }

      return Object.freeze(characters);
    },

    toggleSelection(selectedIndices, index, maxPartySize) {
      const next = new Set(selectedIndices);
      if (next.has(index)) {
        next.delete(index);
        return { selected: next, full: false };
      }
      if (next.size >= maxPartySize)
        return { selected: new Set(selectedIndices), full: true };
      next.add(index);
      return { selected: next, full: false };
    },

    isPartyValid(selectedIndices) {
      return selectedIndices.size >= 1 && selectedIndices.size <= 4;
    },

    selectParty(roster, selectedIndices) {
      const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
      return Object.freeze(sorted.map(i => roster[i]));
    },
  };

  TR.Roster = Roster;
})();
