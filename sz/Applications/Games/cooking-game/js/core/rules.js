;(function() {
  'use strict';

  /* Layout and rule helpers derived from the venue, the upgrades and the
     running day: seats, stations and pass positions, cooking speed, zones,
     burn threshold, combo multiplier, spawn limit and the date key. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { MENU_SCREENS, SEAT_X0, SEAT_X1, PASS_MAX, PASS_X0, PASS_X1, STATION_X0, STATION_STEP,
    STATION_W, BURN_AT, DAILY_CUSTOMERS } = NS.C;
  const { treeLevel } = NS.persist;

  /* ── layout helpers ── */
  function seatCount() { return G.location.seats + treeLevel('v_table'); }

  function seatX(i) {
    const n = seatCount();
    return n <= 1 ? (SEAT_X0 + SEAT_X1) / 2 : SEAT_X0 + i * (SEAT_X1 - SEAT_X0) / (n - 1);
  }

  function stationX(i) { return STATION_X0 + i * STATION_STEP; }

  function stationCX(id) { return stationX(SZ.KitchenData.STATION_ORDER.indexOf(id)) + STATION_W / 2; }

  /* the chef works from the gap right of a station, so he never hides a gauge */
  function chefSpotX(i) { return stationX(i) + STATION_W + (STATION_STEP - STATION_W) / 2; }

  function passCapacity() { return PASS_MAX + 2 * treeLevel('p_pass'); }

  function passX(i) { return PASS_X0 + i * (PASS_X1 - PASS_X0) / (passCapacity() - 1); }

  /* How much faster a step runs: hot burners everywhere, pre-chopped prep
     and plating, and the Rush Hour Bell on top. */
  function speedFactor(stationId) {
    const prep = (stationId === 'board' || stationId === 'plate') ? 1 + 0.3 * treeLevel('p_prep') : 1;
    return (1 + 0.1 * treeLevel('g_heat')) * prep * (G.rushTimer > 0 ? 1.5 : 1);
  }

  /* The perfect zone of a step, widened around its centre by the timers. */
  function zoneFor(step) {
    const w = 1 + 0.15 * treeLevel('g_timer');
    const c = (step.zone[0] + step.zone[1]) / 2;
    const h = (step.zone[1] - step.zone[0]) / 2 * w;
    return [c - h, c + h];
  }

  /* Non-stick pans push the burn threshold back. */
  function burnAt() { return BURN_AT + 0.2 * treeLevel('g_pan'); }

  function comboMult() { return 1 + Math.min(1, G.combo * 0.1); }

  /* How many guests a day lets in: endless runs have no fixed count, the
     Daily Special stops at twenty. */
  function spawnLimit() { return G.mode === 'daily' ? DAILY_CUSTOMERS : G.dayInfo.customers; }

  function dateKey(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  NS.rules = { dateKey, chefSpotX, seatCount, seatX, stationX, stationCX, passCapacity, passX,
    speedFactor, zoneFor, burnAt, comboMult, spawnLimit, isMenuState };

})();
