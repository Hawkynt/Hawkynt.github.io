;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { Portal, PlaneRegistry, PRNG, OverworldMap, OverworldTile: Tile, LOCATION_SPACING } = TR;

  // every location on a square of location cells around home
  function locations(map, cells) {
    const out = [];
    for (let gy = -cells; gy <= cells; ++gy)
      for (let gx = -cells; gx <= cells; ++gx)
        for (let r = 0; r < LOCATION_SPACING; ++r)
          for (let c = 0; c < LOCATION_SPACING; ++c) {
            const loc = map.getLocation(gx * LOCATION_SPACING + c, gy * LOCATION_SPACING + r);
            if (loc)
              out.push(loc);
          }
    return out;
  }

  describe('Portal -- connections', () => {

    it('picks only connections of the plane, the common ones more often', () => {
      const prng = new PRNG(3);
      const counts = {};
      for (let i = 0; i < 4000; ++i) {
        const c = Portal.pickConnection('material', prng);
        counts[c.targetPlane] = (counts[c.targetPlane] || 0) + 1;
      }
      const allowed = PlaneRegistry.get('material').connections.map(c => c.targetPlane);
      for (const id of Object.keys(counts))
        assert.ok(allowed.includes(id), id);
      assert.ok(counts.ethereal > counts.shadow && counts.shadow > counts.astral, JSON.stringify(counts));
    });

    it('an unknown plane has no connections', () => {
      assert.equal(Portal.pickConnection('nowhere', new PRNG(1)), null);
    });

    it('names a portal after its kind and target', () => {
      assert.equal(Portal.nameFor({ portalType: 'color_pool', targetPlane: 'mechanus' }), 'Color Pool to Mechanus');
      assert.equal(Portal.nameFor({ portalType: 'vortex', targetPlane: 'elemental_fire' }), 'Vortex to Elemental Fire');
    });

    it('every plane can be reached from the Material Plane and leads back', () => {
      const seen = new Set(['material']);
      const queue = ['material'];
      while (queue.length) {
        const id = queue.shift();
        for (const c of PlaneRegistry.get(id).connections || [])
          if (PlaneRegistry.has(c.targetPlane) && !seen.has(c.targetPlane)) {
            seen.add(c.targetPlane);
            queue.push(c.targetPlane);
          }
      }
      for (const p of PlaneRegistry.getAll())
        assert.ok(seen.has(p.id), `${p.id} unreachable`);
    });

    it('rolls portal placements on a map onto allowed tiles', () => {
      const portals = Portal.generatePortals('astral', 60, 40, new PRNG(11), { maxPortals: 3, tileFilter: (c, r) => (c + r) % 2 === 0 });
      assert.ok(portals.length <= 3);
      for (const p of portals) {
        assert.equal((p.col + p.row) % 2, 0);
        assert.ok(PlaneRegistry.has(p.targetPlane));
      }
    });

    it('describes the plane a portal leads to', () => {
      const t = Portal.transitionToPlane('nine_hells');
      assert.equal(t.plane.id, 'nine_hells');
      assert.ok(t.traits);
      assert.equal(Portal.transitionToPlane('nowhere'), null);
    });
  });

  describe('Portal -- on the map', () => {

    it('the Material Plane holds a few portals, none right by home', () => {
      let total = 0;
      for (const seed of [1, 2, 3]) {
        const map = new OverworldMap(seed);
        const portals = locations(map, 6).filter(l => l.tile === Tile.PORTAL);
        total += portals.length;
        const allowed = PlaneRegistry.get('material').connections.map(c => c.targetPlane);
        for (const p of portals) {
          assert.ok(allowed.includes(p.targetPlane), p.targetPlane);
          assert.ok(Math.max(Math.abs(p.col), Math.abs(p.row)) >= LOCATION_SPACING, `${p.name} at ${p.col},${p.row}`);
          assert.ok(p.name.includes(' to '), p.name);
        }
        // rare: a handful among more than a hundred places
        assert.ok(portals.length < 20, `${portals.length} portals`);
      }
      assert.ok(total > 0, 'no portal anywhere');
    });

    it('portals keep the rest of the Material Plane as it was', () => {
      const map = new OverworldMap(8);
      const others = locations(map, 3).filter(l => l.tile !== Tile.PORTAL);
      assert.ok(others.length > 30);
    });

    it('the other planes hold portals to their neighbours', () => {
      const map = new OverworldMap(4, 'astral');
      const portals = locations(map, 4).filter(l => l.tile === Tile.PORTAL && !l.returnGate);
      assert.ok(portals.length > 0, 'no portal on the Astral');
      const allowed = PlaneRegistry.get('astral').connections.map(c => c.targetPlane);
      for (const p of portals)
        assert.ok(allowed.includes(p.targetPlane), p.targetPlane);
    });

    it('every portal near the gate can be walked to, so no arrival is cut off', () => {
      for (const plane of ['astral', 'ethereal', 'elemental_earth', 'pandemonium', 'abyss']) {
        const map = new OverworldMap(21, plane);
        const portals = locations(map, 2).filter(l => l.tile === Tile.PORTAL && !l.returnGate);
        for (const p of portals) {
          const path = map.findPath({ col: 0, row: 0 }, { col: p.col, row: p.row }, 200);
          assert.ok(path && path.length > 1, `${plane}: ${p.name} at ${p.col},${p.row} cut off`);
        }
      }
    });

    it('portals can be walked onto', () => {
      const map = new OverworldMap(4, 'astral');
      assert.ok(map.isPassable(0, 0));
      const path = map.findPath({ col: 5, row: -3 }, { col: 0, row: 0 }, 60);
      assert.ok(path && path.length > 1);
    });
  });
})();
