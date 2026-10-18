;(function() {
  'use strict';

  /* The five cooking stations: tickets entering free slots, progress,
     zones and burning, finishing a step (by click, key or self-burn), the
     move of a finished dish to the pass, ambience and the Rush Hour Bell.
     Owns G.stations; writes G.pass, G.tickets and the chef targets. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, STATE_PLAYING, PASS_Y, STATION_Y, RUSH_TIME, BELL } = NS.C;
  const { fx, screenShake, sfx } = NS.juice;
  const { treeLevel } = NS.persist;
  const { chefSpotX, stationCX, passCapacity, passX, speedFactor, zoneFor, burnAt } = NS.rules;
  const { pushPop } = NS.effects;
  const { coachAdvance } = NS.coach;

  function ticketInSlot(t) {
    for (const id of SZ.KitchenData.STATION_ORDER)
      for (const s of G.stations[id].slots)
        if (s.ticket === t) return true;
    return false;
  }

  /* A finished ticket moves to the pass when there is room; until then the
     plating station holds it and blocks. The dish itself lands at once, a
     copy arcs over for the eye and bounces where it settles. */
  function tryToPass(t, slot, fromId) {
    if (G.pass.length >= passCapacity()) return false;
    const quality = SZ.KitchenData.dishScore(t.results);
    G.pass.push({ recipe: t.recipe.id, quality: quality, ticket: t, bounce: 0 });
    if (fromId) {
      const pi = G.pass.length - 1;
      G.arcs.push({
        recipe: t.recipe.id, quality: quality, ticket: t, t: 0,
        x0: stationCX(fromId), y0: STATION_Y + 30,
        x1: passX(pi), y1: PASS_Y
      });
    }
    const i = G.tickets.indexOf(t);
    if (i >= 0) G.tickets.splice(i, 1);
    if (slot) { slot.ticket = null; slot.progress = 0; slot.state = 'idle'; }
    return true;
  }

  /* forced: Second Chance finishes a burning step as 'ok' instead. */
  function finishStep(stationId, slot, auto, forced) {
    const t = slot.ticket;
    const step = t.recipe.steps[t.stepIndex];
    const quality = forced || SZ.KitchenData.qualityOf(slot.progress, zoneFor(step), burnAt());
    t.results.push(quality);
    ++t.stepIndex;
    slot.progress = 0;
    if (t.stepIndex < t.recipe.steps.length) {
      t.waitingFor = t.recipe.steps[t.stepIndex].station;
      slot.ticket = null;
      slot.state = 'idle';
    } else {
      t.done = true;
      t.waitingFor = null;
      if (!tryToPass(t, slot, stationId)) slot.state = 'ready';
    }
    const cx = stationCX(stationId);
    if (forced) {
      fx.text(cx, STATION_Y - 10, 'Saved!', { color: '#ffd23f', size: 22 });
      fx.emit('star', cx, STATION_Y + 50, 10, { color: '#ffd23f', speed: 160 });
      sfx('powerup', { volume: 0.5 });
    } else if (quality === 'perfect') {
      pushPop(cx, STATION_Y - 16, 'PERFECT!', '#ffd23f', 22);
      fx.emit('glow', cx, STATION_Y + 50, 1, { color: '#ffb030', size: 150, alpha: 0.6 });
      fx.emit('star', cx, STATION_Y + 50, 12, { color: '#ffd23f', speed: 220 });
      fx.emit('spark', cx, STATION_Y + 50, 10, { color: '#fff0a0', speed: 260, gravity: 200 });
      sfx('pickup', { pitch: 1 + G.combo * 0.08 });
      if (!auto) { G.chefTargetX = chefSpotX(SZ.KitchenData.STATION_ORDER.indexOf(stationId)); G.chefPose = 'cheer'; G.chefTimer = 0.5; }
    } else if (quality === 'burnt') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 20);
      fx.emit('smoke', cx, STATION_Y + 40, 10, { color: '#3a3430', speed: 90 });
      fx.emit('spark', cx, STATION_Y + 50, 14, { color: '#ff5a1a', speed: 240 });
      fx.emit('glow', cx, STATION_Y + 50, 1, { color: '#ff3a1a', size: 220 });
      screenShake.trigger(9, 320);
      G.hitFlash = { t: 0.25, color: '255,60,30' };
      sfx('smallExplode');
      sfx('error', { volume: 0.5 });
    } else if (quality === 'raw') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 18);
      fx.emit('smoke', cx, STATION_Y + 40, 6, { color: '#8a8478', speed: 60 });
      screenShake.trigger(5, 220);
      sfx('error', { volume: 0.5 });
    } else {
      pushPop(cx, STATION_Y - 12, 'Good', '#cfd6e4', 14);
      sfx('blip');
    }
    if (G.coach && G.coach.ticket === t && G.coach.step === 2 && !t.done) coachAdvance(3, t);
  }

  /* a ticket landing on a station: each kind gets its own short call */
  function stationArrive(id) {
    if (id === 'grill') sfx('shoot', { pitch: 0.5, volume: 0.25 });
    else if (id === 'stove') sfx('drop', { pitch: 0.6 });
    else if (id === 'oven') sfx('click', { pitch: 0.6 });
    else if (id === 'board') sfx('thud', { pitch: 1.6, volume: 0.3 });
    else sfx('click');
  }

  function updateStations(dt) {
    /* FIFO: a waiting ticket enters the first free slot of its station */
    for (const t of G.tickets) {
      if (t.done || t.waitingFor === null || ticketInSlot(t)) continue;
      for (const s of G.stations[t.waitingFor].slots) {
        if (!s.ticket) {
          s.ticket = t;
          s.progress = 0;
          s.state = 'working';
          stationArrive(t.waitingFor);
          break;
        }
      }
    }
    for (const id of SZ.KitchenData.STATION_ORDER) {
      for (const s of G.stations[id].slots) {
        const t = s.ticket;
        if (!t) continue;
        if (t.done) { tryToPass(t, s, id); continue; }
        const step = t.recipe.steps[t.stepIndex];
        s.progress += dt * speedFactor(id) / step.time;
        if (s.progress >= burnAt()) {
          if (treeLevel('p_rescue') > 0 && !G.rescueUsed) {
            G.rescueUsed = true;
            finishStep(id, s, true, 'ok');
          } else {
            finishStep(id, s, true);
          }
        } else {
          const zone = zoneFor(step);
          s.state = s.progress > 1 ? 'burning'
            : (s.progress >= zone[0] && s.progress <= zone[1] ? 'ready' : 'working');
          stationAmbience(id, s, dt);
        }
      }
    }
  }

  /* The kitchen breathes: sparks on the grill, steam off the pot, wood chips
     with every knife stroke, grey smoke while a step burns. Emission is on a
     small per-slot timer so it reads steady at any frame rate. */
  function stationAmbience(id, s, dt) {
    if (s.fxT === undefined) s.fxT = 0;
    const px = stationCX(id);
    /* the board throws chips on every down-stroke of the knife, in step with
       the four baked art frames rather than a timer */
    if (id === 'board' && s.state === 'working') {
      const cf = Math.floor(G.animT * 6) % 4;
      if (s.chopF !== cf) {
        s.chopF = cf;
        if (cf === 0 || cf === 2) {
          fx.emit('chip', px - 13, STATION_Y + 76, 3, { colors: ['#e8452a', '#6cc04a', '#f2cf5a', '#f4f0e0'], speed: 180, angle: -Math.PI / 2, spread: 2.2 });
          sfx('thud', { pitch: 1.8, volume: 0.12 });
        }
      }
    } else s.chopF = -1;
    s.fxT -= dt;
    if (s.fxT > 0) return;
    if (s.state === 'burning') {
      s.fxT = 0.18;
      fx.emit('smoke', px + (Math.random() - 0.5) * 40, STATION_Y + 40, 1, { color: '#3e3834', speed: 25, scale: 1.4 });
      if (Math.random() < 0.5) fx.emit('spark', px, STATION_Y + 50, 2, { color: '#ff5a1a', speed: 140 });
    } else if (id === 'grill') {
      s.fxT = 0.09;
      fx.emit('ember', px + (Math.random() - 0.5) * 90, STATION_Y + 52, 1, { color: '#ffb03a', speed: 30 });
      if (Math.random() < 0.25) fx.emit('smoke', px + (Math.random() - 0.5) * 50, STATION_Y + 40, 1, { color: '#9a9088', alpha: 0.35, speed: 10 });
    } else if (id === 'stove') {
      s.fxT = 0.22;
      fx.emit('steam', px - 25 + (Math.random() - 0.5) * 20, STATION_Y + 14, 1, { color: '#f4f6f8', speed: 12 });
    } else if (id === 'oven') {
      s.fxT = 0.5;
      fx.emit('steam', px + (Math.random() - 0.5) * 50, STATION_Y + 2, 1, { color: '#f4f0e8', speed: 8, alpha: 0.35 });
    } else {
      s.fxT = 0.35;
      if (s.state === 'ready' || Math.random() < 0.4) fx.emit('star', px + (Math.random() - 0.5) * 60, STATION_Y + 70, 1, { color: '#ffd23f', speed: 30, gravity: -20 });
    }
  }

  function clickStation(i) {
    const id = SZ.KitchenData.STATION_ORDER[i];
    G.chefTargetX = chefSpotX(i);
    G.stationPress[i] = 0.18;
    G.chefPose = id === 'board' ? 'chop' : (id === 'stove' || id === 'grill') ? 'flip' : G.chefPose;
    G.chefTimer = 0.9;
    let slot = null;
    for (const s of G.stations[id].slots)
      if (s.ticket && !s.ticket.done) { slot = s; break; }
    if (!slot) {
      sfx('click');
      return;
    }
    finishStep(id, slot, false);
  }

  /* ── Rush Hour Bell: every station runs 50% faster for ten seconds ── */
  function activateRush() {
    if (G.state !== STATE_PLAYING || treeLevel('p_rush') <= 0) return;
    if (G.rushUsed) {
      fx.text(BELL.x - 30, BELL.y - 30, 'Already used', { color: '#ffb0a0', size: 14 });
      sfx('error', { volume: 0.4 });
      return;
    }
    G.rushUsed = true;
    G.rushTimer = RUSH_TIME;
    fx.text(VIEW_W / 2, 210, 'RUSH HOUR!', { color: '#ffd23f', size: 44, life: 1.6 });
    fx.emit('confetti', VIEW_W / 2, 210, 30, { speed: 420, angle: -Math.PI / 2, spread: 2.4 });
    sfx('zap');
  }

  NS.stations = { ticketInSlot, updateStations, clickStation, activateRush };

})();
