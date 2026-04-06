;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  /**
   * Portal generation and plane-transition logic.
   *
   * A portal is a tile-level feature that links one plane to another.
   * The PlaneRegistry supplies connection data (target, type, frequency);
   * this module turns those records into concrete map placements and
   * handles the mechanical side of transitioning to a new plane.
   */

  // Frequency -> base chance per eligible tile evaluated
  const FREQ_CHANCE = Object.freeze({
    common:   0.06,
    uncommon: 0.03,
    rare:     0.01,
  });

  // Visual glyph per portal type (for ASCII / debug rendering)
  const PORTAL_CHAR = Object.freeze({
    natural:     'O',
    coterminous: '&',
    curtain:     '|',
    color_pool:  '@',
    gate:        '#',
    gate_town:   'G',
    border:      '%',
  });

  const Portal = {

    /**
     * Roll for portal placements on a generated dungeon / map.
     *
     * @param {string}   planeId        Current plane id (looked up in PlaneRegistry).
     * @param {number}   mapWidth       Width of the dungeon / overworld grid.
     * @param {number}   mapHeight      Height of the dungeon / overworld grid.
     * @param {object}   prng           PRNG instance (TR.PRNG).
     * @param {object}   [opts]         Optional overrides.
     * @param {number}   [opts.maxPortals=3]  Hard cap on portals per map.
     * @param {function} [opts.tileFilter]    (col, row) => boolean -- only place on passable tiles.
     * @returns {Array<{col:number, row:number, targetPlane:string, portalType:string, tileChar:string}>}
     */
    generatePortals(planeId, mapWidth, mapHeight, prng, opts) {
      const plane = TR.PlaneRegistry?.get(planeId);
      if (!plane || !plane.connections || plane.connections.length === 0)
        return [];

      const maxPortals = opts?.maxPortals ?? 3;
      const tileFilter = opts?.tileFilter ?? null;
      const portals = [];

      // Build weighted connection pool
      const pool = [];
      for (const conn of plane.connections) {
        const chance = FREQ_CHANCE[conn.frequency] || FREQ_CHANCE.rare;
        pool.push({ ...conn, chance });
      }

      // Walk random candidate tiles until budget exhausted or map scanned
      const totalTiles = mapWidth * mapHeight;
      const candidates = Math.min(totalTiles, Math.max(50, Math.floor(totalTiles * 0.1)));
      const usedPositions = new Set();

      for (let i = 0; i < candidates && portals.length < maxPortals; ++i) {
        const col = prng.nextInt(1, mapWidth - 2);
        const row = prng.nextInt(1, mapHeight - 2);
        const key = `${col},${row}`;
        if (usedPositions.has(key))
          continue;

        if (tileFilter && !tileFilter(col, row))
          continue;

        // Pick a random connection and test its frequency roll
        const conn = pool[prng.nextInt(0, pool.length - 1)];
        if (prng.next() >= conn.chance)
          continue;

        usedPositions.add(key);
        portals.push(Object.freeze({
          col,
          row,
          targetPlane: conn.targetPlane,
          portalType: conn.portalType,
          tileChar: PORTAL_CHAR[conn.portalType] || 'O',
        }));
      }

      return portals;
    },

    /**
     * Look up target plane data for a portal.
     *
     * @param {string} currentPlaneId  Plane the party is currently on.
     * @param {{targetPlane:string}} portal  A portal object (from generatePortals).
     * @returns {object|null}  The full plane record from PlaneRegistry, or null.
     */
    getTargetPlane(currentPlaneId, portal) {
      if (!portal || !portal.targetPlane)
        return null;
      return TR.PlaneRegistry?.get(portal.targetPlane) || null;
    },

    /**
     * Build initial map metadata for a plane transition.
     *
     * This does NOT generate the actual grid (that is the job of
     * DungeonGen / OverworldMap); it returns a descriptor that those
     * generators can consume.
     *
     * @param {string} targetPlaneId  The plane to transition to.
     * @returns {object|null}  { plane, biomeId, traits } or null.
     */
    transitionToPlane(targetPlaneId) {
      const plane = TR.PlaneRegistry?.get(targetPlaneId);
      if (!plane)
        return null;

      // Pick the first biome listed for the target plane (caller may override)
      const biomeId = plane.biomes?.[0] || null;
      const biome = biomeId ? TR.BiomeRegistry?.get(biomeId) : null;

      return Object.freeze({
        plane: Object.freeze({ id: plane.id, name: plane.name, category: plane.category }),
        biomeId,
        biomeName: biome?.name || null,
        traits: Object.freeze({ ...plane.traits }),
      });
    },

    /** Expose glyph table so renderers can draw portals. */
    PORTAL_CHAR,

    /** Expose frequency table for external tuning / tests. */
    FREQ_CHANCE,
  };

  TR.Portal = Portal;
})();
