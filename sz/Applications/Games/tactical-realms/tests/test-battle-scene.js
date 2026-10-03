;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { BattleScene, BattleSprites, BattleBackdrop, BattleFx } = TR;

  const hero = (cls, extra = {}) => ({
    id: 'h1', name: 'Hero', faction: 'party', currentHp: 20, maxHp: 24, ac: 15, isAlive: true,
    position: { col: 3, row: 3 }, character: { class: cls, race: 'human', level: 3 }, ...extra,
  });
  const foe = (cls, extra = {}) => ({
    id: 'e1', name: 'Foe', faction: 'enemy', currentHp: 10, maxHp: 18, ac: 13, isAlive: true,
    position: { col: 4, row: 3 }, character: { class: cls, level: 2 }, ...extra,
  });

  function run(scene, seconds = 10) {
    let steps = 0;
    while (!scene.done && steps < seconds * 60) {
      scene.update(1 / 60);
      ++steps;
    }
    return steps / 60;
  }

  const fakeCtx = () => document.createElement('canvas').getContext('2d');

  describe('BattleScene -- staging', () => {

    it('adjacent weapon attacks are melee', () => {
      const s = new BattleScene({ attacker: hero('fighter'), defender: foe('bandit'), result: { hit: true, damage: 4, d20: 12, total: 16 } });
      assert.equal(s.kind, 'melee');
    });

    it('bows and distant targets are ranged', () => {
      assert.equal(new BattleScene({ attacker: hero('ranger'), defender: foe('bandit'), result: { hit: true, damage: 3 } }).kind, 'ranged');
      const far = foe('bandit', { position: { col: 8, row: 3 } });
      assert.equal(new BattleScene({ attacker: hero('fighter'), defender: far, result: { hit: false } }).kind, 'ranged');
    });

    it('spells are split into damage, heal and buff scenes', () => {
      const spell = { id: 'fireball', name: 'Fireball', school: 'evocation' };
      assert.equal(new BattleScene({ attacker: hero('wizard'), defender: foe('orc'), result: { damage: 7, spell }, type: 'spell_cast' }).kind, 'spell');
      assert.equal(new BattleScene({ attacker: hero('cleric'), defender: hero('fighter', { id: 'h2' }), result: { heal: 5, spell: { id: 'cure_wounds' } }, type: 'spell_cast' }).kind, 'heal');
      assert.equal(new BattleScene({ attacker: hero('cleric'), defender: hero('fighter', { id: 'h2' }), result: { spell: { id: 'shield_of_faith' } }, type: 'spell_cast' }).kind, 'buff');
    });

    it('a lethal hit is recognised as a kill', () => {
      const s = new BattleScene({ attacker: hero('fighter'), defender: foe('bandit', { currentHp: 0, isAlive: false }), result: { hit: true, damage: 12 } });
      assert.ok(s.killed);
    });

    it('a miss is never a kill', () => {
      const s = new BattleScene({ attacker: hero('fighter'), defender: foe('bandit', { isAlive: false }), result: { hit: false } });
      assert.equal(s.killed, false);
    });
  });

  describe('BattleScene -- timeline', () => {

    it('every kind of scene finishes', () => {
      const cases = [
        { attacker: hero('fighter'), defender: foe('bandit'), result: { hit: true, damage: 4, critical: true, d20: 20, total: 25 } },
        { attacker: hero('ranger'), defender: foe('bandit'), result: { hit: false, d20: 3, total: 6 } },
        { attacker: hero('wizard'), defender: foe('orc'), result: { damage: 7, spell: { id: 'lightning_bolt' } }, type: 'spell_cast' },
        { attacker: hero('cleric'), defender: hero('fighter', { id: 'h2' }), result: { heal: 5, spell: { id: 'cure_wounds' } }, type: 'spell_cast' },
        { attacker: foe('hill_giant'), defender: hero('paladin'), result: { hit: true, damage: 9 }, type: 'enemy_attack' },
      ];
      for (const c of cases) {
        const s = new BattleScene(c);
        const secs = run(s);
        assert.ok(s.done, `${s.kind} did not finish`);
        assert.ok(secs > 1 && secs < 4, `${s.kind} took ${secs.toFixed(2)}s`);
      }
    });

    it('short mode is quicker than full mode', () => {
      const opts = { attacker: hero('fighter'), defender: foe('bandit'), result: { hit: true, damage: 4 } };
      const full = run(new BattleScene(opts));
      const short = run(new BattleScene({ ...opts, mode: 'short' }));
      assert.ok(short < full * 0.7, `short ${short} vs full ${full}`);
    });

    it('a critical hit holds the frame longer than a normal hit', () => {
      const base = { attacker: hero('fighter'), defender: foe('bandit'), result: { hit: true, damage: 4 } };
      const normal = run(new BattleScene(base));
      const crit = run(new BattleScene({ ...base, result: { hit: true, damage: 8, critical: true } }));
      assert.ok(crit > normal);
    });

    it('skip ends the scene immediately', () => {
      const s = new BattleScene({ attacker: hero('fighter'), defender: foe('bandit'), result: { hit: true, damage: 4 } });
      s.update(0.1);
      s.skip();
      assert.ok(s.done);
    });

    it('draws every phase without throwing', () => {
      const s = new BattleScene({ attacker: hero('barbarian'), defender: foe('bandit', { isAlive: false, currentHp: 0 }), result: { hit: true, damage: 9, critical: true } });
      const ctx = fakeCtx();
      while (!s.done) {
        s.update(1 / 20);
        s.draw(ctx, 1280, 720);
      }
      assert.ok(true);
    });
  });

  describe('BattleSprites', () => {

    it('every party class gets a doll', () => {
      for (const cls of Object.keys(BattleSprites.CLASS_LOOKS))
        assert.ok(BattleSprites.hasDoll(hero(cls)), cls);
    });

    it('humanoid enemies without icons get a doll, others do not', () => {
      for (const id of Object.keys(BattleSprites.MONSTER_LOOKS))
        assert.ok(BattleSprites.hasDoll(foe(id)), id);
      assert.equal(BattleSprites.hasDoll(foe('wolf')), false);
    });

    it('race changes the body, class changes the gear', () => {
      const dwarf = BattleSprites.lookFor(hero('fighter', { character: { class: 'fighter', race: 'dwarf' } }));
      const elf = BattleSprites.lookFor(hero('wizard', { character: { class: 'wizard', race: 'elf' } }));
      assert.ok(dwarf.scale < 1 && dwarf.beard);
      assert.equal(elf.weapon, 'staff');
      assert.ok(elf.ears);
    });

    it('all poses produce finite joint angles', () => {
      for (const pose of BattleSprites.POSES)
        for (const p of [0, 0.5, 1]) {
          const q = BattleSprites.poseParams(pose, p);
          for (const k of ['lean', 'front', 'back', 'wpn', 'stride', 'crouch', 'head'])
            assert.ok(Number.isFinite(q[k]), `${pose}.${k} at ${p}`);
        }
    });
  });

  describe('BattleBackdrop', () => {

    it('every combat biome has a theme', () => {
      for (const b of ['plains', 'forest', 'dungeon', 'cave', 'ruins', 'mountain', 'swamp', 'desert', 'snow', 'lava'])
        assert.ok(BattleBackdrop.THEMES[b], b);
    });

    it('unknown biomes fall back to plains', () => {
      assert.equal(BattleBackdrop.themeFor('nowhere'), BattleBackdrop.THEMES.plains);
    });

    it('the ground line lies in the lower half of the screen', () => {
      const y = BattleBackdrop.groundY(720);
      assert.ok(y > 360 && y < 720);
    });

    it('plane tints use the plane registry ids, one for every plane but the Material', () => {
      for (const id of Object.keys(BattleBackdrop.PLANE_TINTS))
        assert.ok(TR.PlaneRegistry.has(id), `${id} is not a plane`);
      for (const p of TR.PlaneRegistry.getAll())
        if (p.id !== 'material')
          assert.ok(BattleBackdrop.PLANE_TINTS[p.id], `${p.id} has no tint`);
      assert.ok(!BattleBackdrop.PLANE_TINTS.material);
    });
  });

  describe('BattleFx -- spell elements', () => {

    it('maps spells to the right element', () => {
      const cases = {
        fire_bolt: 'fire', burning_hands: 'fire', scorching_ray: 'fire', fireball: 'fire',
        chill_touch: 'necrotic', ice_storm: 'frost', shocking_grasp: 'lightning', lightning_bolt: 'lightning',
        magic_missile: 'force', arcane_bolt: 'arcane', eldritch_blast: 'force', sacred_flame: 'radiant', hex: 'necrotic',
        vicious_mockery: 'psychic', sleep: 'psychic', blight: 'necrotic',
      };
      for (const [id, el] of Object.entries(cases))
        assert.equal(BattleFx.elementOf({ id, name: id }), el, id);
    });

    it('healing always uses the heal element', () => {
      assert.equal(BattleFx.elementOf({ id: 'fireball' }, { heal: true }), 'heal');
    });

    it('every element has a palette', () => {
      for (const el of Object.keys(BattleFx.ELEMENTS))
        assert.ok(BattleFx.palette(el).main, el);
    });
  });

  describe('BattleScene -- monster specials', () => {

    const special = (kind, element, extra = {}) => ({
      attacker: foe('red_dragon_adult'), defender: hero('fighter'), type: 'spell_cast',
      result: { damage: 12, spell: { id: `special_${kind}`, name: kind }, special: { kind, element, shape: 'cone' }, ...extra },
    });

    it('breath, gazes, rays, mind blasts, webs, spit and rocks get their own scene', () => {
      for (const kind of ['breath', 'gaze', 'rays', 'mindblast', 'web', 'spit', 'rock']) {
        const s = new BattleScene(special(kind, kind === 'rock' ? 'earth' : 'fire'));
        assert.equal(s.kind, 'special', kind);
        const ctx = fakeCtx();
        while (!s.done) {
          s.update(1 / 20);
          s.draw(ctx, 1280, 720);
        }
        assert.ok(s.done, kind);
      }
    });

    it('an effect without damage still plays out, statue and all', () => {
      const s = new BattleScene(special('gaze', 'earth', { damage: 0, effects: [{ unitId: 'h1', text: 'Petrified' }] }));
      const ctx = fakeCtx();
      while (!s.done) {
        s.update(1 / 20);
        s.draw(ctx, 1280, 720);
      }
      assert.ok(s.done);
    });

    it('the special drawing helpers draw without throwing', () => {
      const ctx = fakeCtx();
      BattleFx.breath(ctx, 'fire', 0, 0, 200, 50, 0.4, 'cone', 1);
      BattleFx.breath(ctx, 'lightning', 0, 0, 200, 50, 0.4, 'line', 1);
      BattleFx.beam(ctx, 'arcane', 0, 0, 200, 50, 0.5);
      BattleFx.rock(ctx, 50, 50, 20, 1);
      assert.ok(BattleFx.palette('earth').main);
    });
  });
})();
