;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { MonsterAbilities: MA, CombatEngine, CombatUnit, PRNG, Character } = TR;

  const monster = id => CombatEngine.templateToCharacter(id, new PRNG(3), 0);
  const abilities = id => MA.parse(monster(id));
  const hero = (name, cls = 'fighter', hp = 400) => ({ ...Character.createCharacter('human', cls, name, 1, new PRNG(1)), hp, maxHp: hp });

  // An engine with the given heroes and one monster, everyone placed by hand.
  function arena(monsterId, heroSpots, monsterSpot, seed = 7) {
    const eng = new CombatEngine(new PRNG(seed));
    eng.initCombat(heroSpots.map((_, i) => hero(`H${i}`)), [{ templateId: monsterId }], 14, 10, 'plains');
    const party = eng.units.filter(u => u.faction === 'party');
    const foe = eng.units.find(u => u.faction === 'enemy');
    // clear the board first so nobody blocks a target spot
    for (const u of eng.units)
      eng.grid.removeUnit(u.id);
    const place = (u, p) => {
      eng.grid.placeUnit(u.id, p.col, p.row);
      u.setPosition(p.col, p.row);
    };
    party.forEach((u, i) => place(u, heroSpots[i]));
    place(foe, monsterSpot);
    return { eng, party, foe };
  }

  // Runs a monster turn and returns what its special did (or null).
  function monsterTurn(eng, foe) {
    let special = null;
    const grab = e => { special = e; };
    eng.on('specialResolved', grab);
    eng.executeEnemyTurn(foe.id);
    eng.off('specialResolved', grab);
    return special;
  }

  describe('MonsterAbilities -- reading the stat block', () => {

    it('an adult red dragon breathes fire, resists magic and frightens', () => {
      const a = abilities('red_dragon_adult');
      assert.equal(a.breath.energy, 'fire');
      assert.equal(a.breath.shape, 'cone');
      assert.ok(a.sr > 0);
      assert.ok(a.immune.has('fire'));
      assert.ok(a.vuln.has('cold'));
      assert.equal(a.aura.kind, 'fear');
    });

    it('blue dragons breathe lightning in a line', () => {
      const a = abilities('blue_dragon_adult');
      assert.equal(a.breath.energy, 'electricity');
      assert.equal(a.breath.shape, 'line');
    });

    it('ghouls paralyse and are immune to what undead shrug off', () => {
      const a = abilities('ghoul');
      assert.ok(a.riders.includes('paralysis'));
      assert.ok(a.immune.has('poison') && a.immune.has('mind'));
    });

    it('a basilisk has a petrifying gaze', () => {
      assert.equal(abilities('basilisk').gaze.kind, 'petrify');
    });

    it('a balor needs cold iron and good to cut through its reduction', () => {
      const a = abilities('balor');
      assert.equal(a.dr.amount, 15);
      assert.ok(a.dr.needsAll);
      assert.ok(a.immune.has('fire') && a.immune.has('electricity'));
      assert.equal(a.resist.acid, 10);
    });

    it('sorcerous dragons know real spells', () => {
      const d = monster('red_dragon_adult');
      assert.ok(d.spells.includes('magic_missile') && d.spells.includes('scorching_ray'), d.spells.join(','));
      assert.ok(d.maxMp > 0);
    });
  });

  describe('MonsterAbilities -- defences', () => {

    it('energy immunity and vulnerability', () => {
      const red = new CombatUnit('e', monster('red_dragon_adult'), 'enemy', 0, 0);
      assert.equal(MA.adjustDamage(red, 20, 'fire').amount, 0);
      assert.equal(MA.adjustDamage(red, 20, 'cold').amount, 30);
    });

    it('damage reduction blunts plain weapons', () => {
      const balor = new CombatUnit('e', monster('balor'), 'enemy', 0, 0);
      assert.equal(MA.adjustDamage(balor, 20, 'physical', { name: 'Longsword' }).amount, 5);
      assert.equal(MA.adjustDamage(balor, 10, 'physical', null).amount, 0);
    });

    it('incorporeal foes let about half the blows pass through', () => {
      const shadow = new CombatUnit('e', monster('shadow'), 'enemy', 0, 0);
      const prng = new PRNG(11);
      let through = 0;
      for (let i = 0; i < 200; ++i)
        if (MA.adjustDamage(shadow, 10, 'physical', null, prng).amount === 0)
          ++through;
      assert.ok(through > 60 && through < 140, `${through} of 200`);
    });

    it('spell resistance turns spells of weak casters', () => {
      const { eng, party, foe } = arena('balor', [{ col: 2, row: 2 }], { col: 5, row: 2 });
      const res = eng.resolveSpell(party[0].id, foe.id, 'arcane_bolt');
      assert.equal(res.damage, 0);
    });
  });

  describe('MonsterAbilities -- areas', () => {

    it('a line runs straight', () => {
      const tiles = MA.areaTiles(0, 0, 1, 0, 'line', 4);
      assert.deepEqual(tiles.map(t => [t.col, t.row]), [[1, 0], [2, 0], [3, 0], [4, 0]]);
    });

    it('a cone widens ahead and never reaches behind', () => {
      const tiles = MA.areaTiles(5, 5, 1, 0, 'cone', 4);
      assert.ok(tiles.some(t => t.col === 8 && t.row === 7), 'widens');
      assert.ok(!tiles.some(t => t.col < 5), 'nothing behind');
    });
  });

  describe('MonsterAbilities -- in battle', () => {

    it('a dragon breathes on a cluster of heroes', () => {
      const { eng, foe } = arena('red_dragon_young', [{ col: 6, row: 2 }, { col: 6, row: 3 }, { col: 7, row: 3 }], { col: 3, row: 3 });
      const sp = monsterTurn(eng, foe);
      assert.ok(sp && sp.special === 'breath', 'breathed');
      assert.ok(sp.targets.length >= 2, `${sp.targets.length} caught`);
      assert.ok(sp.totalDamage > 0);
    });

    it('a breath weapon needs rounds to recharge', () => {
      const { eng, foe } = arena('red_dragon_young', [{ col: 6, row: 2 }, { col: 6, row: 3 }], { col: 3, row: 3 });
      monsterTurn(eng, foe);
      const again = monsterTurn(eng, foe);
      assert.ok(!again || again.special !== 'breath');
    });

    it('a ghoul can paralyse with a hit and the paralysed lose their turn', () => {
      let paralysed = false;
      for (let seed = 1; seed < 60 && !paralysed; ++seed) {
        const { eng, party, foe } = arena('ghoul', [{ col: 4, row: 3 }], { col: 5, row: 3 }, seed);
        eng.resolveAttack(foe.id, party[0].id);
        if (eng.conditionsOf(party[0].id).includes('paralyzed')) {
          paralysed = true;
          assert.ok(party[0].conditions.includes('paralyzed'), 'unit knows its condition');
        }
      }
      assert.ok(paralysed, 'never paralysed in 60 fights');
    });

    it('a basilisk can turn a hero to stone, which takes them out of the fight', () => {
      let stone = false;
      for (let seed = 1; seed < 80 && !stone; ++seed) {
        const { eng, party, foe } = arena('basilisk', [{ col: 3, row: 3 }], { col: 6, row: 3 }, seed);
        monsterTurn(eng, foe);
        if (eng.conditionsOf(party[0].id).includes('petrified')) {
          stone = true;
          assert.ok(eng.checkDefeat(), 'a lone statue loses the battle');
        }
      }
      assert.ok(stone, 'never petrified in 80 tries');
    });

    it('poison sickens the bitten', () => {
      const id = TR.CreatureRegistry.getMonsters().find(m => (m.traits || []).includes('poison') && m.cr <= 3 && !TR.CombatEngine.ENEMY_TEMPLATES[m.id]).id;
      let sick = false;
      for (let seed = 1; seed < 80 && !sick; ++seed) {
        const { eng, party, foe } = arena(id, [{ col: 4, row: 3 }], { col: 5, row: 3 }, seed);
        eng.resolveAttack(foe.id, party[0].id);
        sick = eng.conditionsOf(party[0].id).includes('sickened');
      }
      assert.ok(sick, `${id} never poisoned`);
    });

    it('trolls regenerate at the start of their turn', () => {
      const { eng, foe } = arena('troll', [{ col: 1, row: 1 }], { col: 9, row: 8 });
      foe.takeDamage(10);
      const before = foe.currentHp;
      for (let i = 0; i < 6 && eng.currentUnit !== foe; ++i) {
        eng.nextTurn();
        eng.startTurn();
      }
      assert.ok(foe.currentHp > before, 'healed');
    });

    it('frightful presence shakes heroes nearby once per battle', () => {
      let shaken = false;
      for (let seed = 1; seed < 40 && !shaken; ++seed) {
        const { eng, party, foe } = arena('red_dragon_adult', [{ col: 2, row: 1 }, { col: 2, row: 8 }], { col: 4, row: 4 }, seed);
        monsterTurn(eng, foe);
        shaken = party.some(p => eng.conditionsOf(p.id).includes('shaken'));
      }
      assert.ok(shaken);
    });

    it('legacy templates keep their stats but gain their abilities', () => {
      const g = monster('ghoul');
      assert.equal(g.hp, 22);
      assert.ok(MA.parse(g).riders.includes('paralysis'));
    });
  });
})();
