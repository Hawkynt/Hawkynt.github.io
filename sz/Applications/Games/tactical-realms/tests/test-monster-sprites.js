;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;

  describe('Monster sprites', () => {

    it('every creature of the registry has a map sprite', () => {
      const missing = TR.CreatureRegistry.getMonsters()
        .filter(m => {
          const e = TR.CREATURE_SPRITE_REGISTRY[m.id];
          return !e || (e.type === 'icon' && !/^assets\/monsters\/(Chaos|Low Level)\/Icon([1-9]|[1-4]\d|50)\.png$/.test(e.path)) || (e.type === 'sheet' && !e.rect);
        })
        .map(m => m.id);
      assert.deepEqual(missing, []);
    });

    it('dragons of different colours look different', () => {
      const red = TR.CREATURE_SPRITE_REGISTRY.red_dragon_adult;
      const blue = TR.CREATURE_SPRITE_REGISTRY.blue_dragon_adult;
      assert.equal(red.path, blue.path);
      assert.ok(red.tint && blue.tint && red.tint !== blue.tint);
    });

    it('every monster doll belongs to a creature the game knows', () => {
      const known = id => TR.CreatureRegistry.getMonster(id) || TR.CombatEngine.ENEMY_TEMPLATES[id];
      const strays = Object.keys(TR.BattleSprites.MONSTER_LOOKS).filter(id => !known(id));
      assert.deepEqual(strays, []);
    });

    it('humanoid monsters fight as dolls', () => {
      for (const id of ['drow_warrior', 'githyanki_warrior', 'djinni', 'vampire', 'storm_giant', 'dryad'])
        assert.ok(TR.BattleSprites.hasDoll({ faction: 'enemy', character: { class: id } }), id);
    });
  });
})();
