;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const SA = TR.ScreenArt;

  const ctx = () => document.createElement('canvas').getContext('2d');
  const party = [
    { name: 'A', class: 'fighter', race: 'human', level: 1, hp: 8, maxHp: 10 },
    { name: 'B', class: 'wizard', race: 'elf', level: 1, hp: 4, maxHp: 6 },
    { name: 'C', class: 'ranger', race: 'halfling', level: 1, hp: 7, maxHp: 8 },
  ];

  describe('ScreenArt', () => {

    it('lines the party up centred on x', () => {
      const xs = SA.partyLine(ctx(), party, { x: 640, spacing: 100 });
      assert.deepEqual(xs, [540, 640, 740]);
    });

    it('a gap places members on both sides of the fire', () => {
      const xs = SA.partyLine(ctx(), [...party, party[0]], { x: 500, gap: 120, spacing: 150 });
      assert.deepEqual(xs, [380, 620, 230, 770]);
    });

    it('small races stand lower in a portrait so their heads stay in frame', () => {
      const human = SA.bustFootY(party[0], 0, 144, 8);
      const halfling = SA.bustFootY(party[2], 0, 144, 8);
      assert.ok(halfling < human, `${halfling} vs ${human}`);
    });

    it('draws every screen widget without throwing', () => {
      const c = ctx();
      SA.stage(c, 'forest', 'material', 1, { night: true });
      SA.stage(c, 'town', 'arborea', 1, { dim: 0.5 });
      SA.campfire(c, 500, 600, 1.3);
      SA.rosterPanel(c, party, [8, 4, 7], 20, 20);
      SA.menu(c, [{ x: 10, y: 60, w: 200, h: 40, label: 'Go' }], { title: 'Menu' });
      SA.banner(c, 'Camp', 20, { sub: 'rest' });
      for (const p of [0, 0.3, 0.7, 1])
        SA.reveal(c, p);
      SA.confetti(c, 1);
      assert.ok(true);
    });

    it('item icons need the dungeon sheet', () => {
      assert.equal(SA.itemIcon(ctx(), null, { name: 'Dagger', category: 'weapon' }, 0, 0, 24), false);
    });
  });
})();
