;(function() {
  'use strict';

  /* Coach marks: the guided first order on career day 1-1. Owns G.coach;
     reads guests, tickets, stations and the pass to follow the order. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { SEAT_Y, PASS_Y, STATION_W, BAR_Y, BAR_H, RAIL_Y, RAIL_H, BUBBLE_DY } = NS.C;
  const { writeSave } = NS.persist;
  const { stationX, passX } = NS.rules;

  function coachAdvance(step, ticket) {
    G.coach.step = step;
    if (ticket) G.coach.ticket = ticket;
    G.coach.t = 0;
  }

  function endCoach() {
    G.coach = null;
    G.coachSkip = null;
    G.save.coached = true;
    writeSave();
  }

  /* the first order stays calm: no second guest until its dish is up */
  function coachHoldsSpawn() {
    return !!G.coach && G.coach.step < 4 && G.customers.some(c => c.state === 'walkIn' || c.state === 'waiting');
  }

  function updateCoach(dt) {
    if (!G.coach) return;
    G.coach.t += dt;
    const t = G.coach.ticket;
    if (G.coach.step >= 2 && G.coach.step <= 4) {
      /* the coached order walked out or went to the bin: start over */
      if (G.tickets.indexOf(t) < 0 && !G.pass.some(d => d.ticket === t) && !G.flying.some(f => f.ticket === t)) {
        G.coach.step = 1;
        G.coach.ticket = null;
        G.coach.t = 0;
        return;
      }
      if (G.coach.step < 4 && G.pass.some(d => d.ticket === t)) coachAdvance(4, null);
    } else if (G.coach.step === 5) {
      G.coach.hideT -= dt;
      if (G.coach.hideT <= 0) G.coach.step = 6;
    }
  }

  function slotStationOf(t) {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i)
      for (const s of G.stations[SZ.KitchenData.STATION_ORDER[i]].slots)
        if (s.ticket === t) return i;
    return -1;
  }

  /* What the current hint says and the box it points at (null: nothing). */
  function coachTarget() {
    const t = G.coach.ticket;
    if (G.coach.step === 1) {
      const c = G.customers.find(g => g.state === 'waiting' && !g.ticket);
      if (!c) return null;
      return { text: 'Click the customer to take the order', place: 'side',
        x: c.x - 48, y: SEAT_Y - BUBBLE_DY - 42, w: 96, h: BUBBLE_DY + 48 };
    }
    if (G.coach.step === 2 || G.coach.step === 3) {
      if (!t || t.done) return null;
      let i = slotStationOf(t);
      if (i < 0) {
        if (G.coach.step === 2) return null;
        i = SZ.KitchenData.STATION_ORDER.indexOf(t.waitingFor);
      }
      const name = SZ.KitchenData.STATIONS[SZ.KitchenData.STATION_ORDER[i]].name;
      const text = G.coach.step === 2
        ? 'Click the ' + name + ' (or press ' + (i + 1) + ') while the needle is in the green zone'
        : 'Next step: the ' + name.toLowerCase() + ' station (' + (i + 1) + ')';
      return { text: text, place: 'station',
        x: stationX(i) - 6, y: RAIL_Y + RAIL_H + 4, w: STATION_W + 12, h: BAR_Y + BAR_H + 19 - RAIL_Y - RAIL_H };
    }
    if (G.coach.step === 4) {
      const i = G.pass.findIndex(d => d.ticket === t);
      if (i < 0) return null;
      return { text: 'Click the dish to serve it', place: 'side',
        x: passX(i) - 40, y: PASS_Y - 40, w: 80, h: 80 };
    }
    if (G.coach.step === 5)
      return { text: 'Perfect dishes build your combo and tips. Keep it up!', place: 'center' };
    return null;
  }

  NS.coach = { coachAdvance, endCoach, coachHoldsSpawn, updateCoach, coachTarget };

})();
