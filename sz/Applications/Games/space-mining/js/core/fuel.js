/* Pure fuel and range rules: the size of a belt (it grows with the belt; Gold Rush and the
   Daily Belt keep the classic sector), how far out a point lies (0 at the dock, 1 at the rim),
   rock density and richness by that distance (thin and poor near the dock, thick and rich at
   the rim), the burn per second (thrust, afterburner, a laden hold, the hull's mass, the
   engine's tuning - a faster engine burns faster, so fuel per distance stays - and the belt),
   the fuel it takes to cruise a distance with a margin (the bingo mark), range in belt widths,
   fuel cells and what the Ramscoop takes from a gas pocket. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const CLASSIC = [6400, 4600];
  const THRUST = 2;
  const IDLE = 0.1;
  const LOAD = 0.5;
  const CRUISE = 0.85;
  const MARGIN = 1.4;
  const SPARE = 4;
  const CELL = 40;
  const CELL_AT = 0.12;
  /* Ramscoop level that takes each gas, and the fuel one unit of it gives */
  const SCOOP = { hydrogen: { level: 1, fuel: 3 }, helium3: { level: 2, fuel: 5 }, xenon: { level: 3, fuel: 7 } };
  const REFUEL = { post: 14, hub: 10, reach: 170, slow: 220 };

  function worldSize(zone, mode) {
    const s = mode === 'rush' || mode === 'daily' || !zone || !zone.size ? CLASSIC : zone.size;
    return { w: s[0], h: s[1] };
  }

  /* 0 at the dock, 1 on the rim of the belt (the larger of the two axis fractions) */
  function reach(x, y, dock, w, h) {
    return Math.min(1, Math.max(Math.abs(x - dock.x) / (w / 2), Math.abs(y - dock.y) / (h / 2)));
  }

  function smooth(a, b, v) {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /* how much of the belt's rubble survives at that distance */
  function density(r) {
    return 0.12 + 0.88 * smooth(0.18, 0.72, r);
  }

  /* ore richness multiplier and the boost to the rare ores (rarity 3 and up) */
  function richness(r) {
    return 0.75 + 0.5 * r;
  }

  function rareBoost(r) {
    return Math.max(0, r - 0.3) * 2.2;
  }

  /* how many rocks a belt gets: grows a little with its area, never past the pool */
  function rockTarget(zone, w, h, max) {
    const area = (w * h) / (CLASSIC[0] * CLASSIC[1]);
    return Math.min(max, Math.round(300 * zone.density * Math.pow(area, 0.4)));
  }

  function beltBurn(zone) {
    return zone && zone.burn || 1;
  }

  /* fuel per second under thrust: power 0..1, fill = hold fraction, boost = afterburner on */
  function rate(stats, zone, power, fill, boost) {
    const b = boost ? 3.6 - (stats.boost || 0) * 0.5 : 1;
    return b * THRUST * power * stats.fuelEff * (stats.burn || 1) * (stats.engine || 1) * beltBurn(zone) * (1 + LOAD * Math.max(0, Math.min(1, fill || 0)));
  }

  function idle(stats, zone) {
    return IDLE * stats.fuelEff * beltBurn(zone);
  }

  /* fuel to cruise a distance with the hold as it is, plus the margin: the bingo mark */
  function homeCost(dist, stats, zone, fill) {
    const secs = dist / (stats.maxSpeed * CRUISE);
    return secs * rate(stats, zone, 1, fill, false) * MARGIN + SPARE;
  }

  /* seconds of full thrust a full tank lasts with an empty hold */
  function thrustSeconds(stats, zone) {
    return stats.fuel / rate(stats, zone, 1, 0, false);
  }

  /* range in half-belt widths: how often a full tank crosses from the dock to the rim */
  function crossings(stats, zone, mode) {
    const size = worldSize(zone, mode);
    return thrustSeconds(stats, zone) * stats.maxSpeed * CRUISE / (size.w / 2);
  }

  function cellFuel(stats) {
    return CELL * (1 + (stats.cells || 0));
  }

  /* fuel one unit of a gas gives through the Ramscoop at that level, 0 when it cannot take it */
  function scoopFuel(level, gas) {
    const s = SCOOP[gas];
    return s && level >= s.level ? s.fuel : 0;
  }

  Object.assign(NS.fuel, {
    CLASSIC, THRUST, IDLE, LOAD, CELL, CELL_AT, SCOOP, REFUEL,
    worldSize, reach, density, richness, rareBoost, rockTarget, rate, idle, homeCost, thrustSeconds, crossings, cellFuel, scoopFuel
  });
})();
