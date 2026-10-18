;(function() {
  'use strict';

  /* Guests: spawning at a free seat, walking in, patience and moods,
     eating, walking out, and taking an order. Owns G.customers and the
     tickets they open; reads the day, the venue and the upgrades. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, SEAT_Y, BUBBLE_DY, GUEST_SCALE, WALK_SPEED } = NS.C;
  const { fx, sfx } = NS.juice;
  const { treeLevel } = NS.persist;
  const { seatCount, seatX } = NS.rules;
  const { pushRing } = NS.effects;
  const { coachAdvance } = NS.coach;

  function freeSeat() {
    const taken = new Set(G.customers.map(c => c.seat));
    for (let i = 0; i < seatCount(); ++i)
      if (!taken.has(i)) return i;
    return -1;
  }

  /* Fancy Decor draws the better crowd: when a plain regular walks in, the
     dice are cast once more and a critic or VIP that shows up is taken. */
  function pickGuestType() {
    let type = SZ.KitchenData.pickCustomerType(G.rand, G.dayIndex, G.hasCritic);
    if (treeLevel('c_decor') > 0 && type.id === 'regular') {
      const alt = SZ.KitchenData.pickCustomerType(G.rand, G.dayIndex, G.hasCritic);
      if (alt.id === 'critic' || alt.id === 'vip') type = alt;
    }
    return type;
  }

  function spawnCustomer() {
    const seat = freeSeat();
    if (seat < 0) return false;         // counter full: the queue waits outside
    const type = pickGuestType();
    if (type.id === 'critic') G.hasCritic = true;
    const order = SZ.KitchenData.pickRecipe(G.rand, G.location, G.recent);
    G.recent.push(order);
    while (G.recent.length > 4) G.recent.shift();
    const patience = G.dayInfo.patience * type.patience * (1 + 0.12 * treeLevel('v_seats'));
    G.customers.push({
      look: SZ.PeopleArt.randomLook(G.rand, type.id),
      type, seat, x: -60, state: 'walkIn',
      order, patience, patienceMax: patience, ticket: null,
      eatTimer: 0, mood: 'happy',
      hop: 0, wave: 0, leaveT: 0, crumbT: 0, rating: 0
    });
    ++G.spawned;
    sfx('blip', { pitch: 1.3, volume: 0.25 });
    if (type.id === 'vip') {
      fx.emit('star', seatX(seat), SEAT_Y - 90, 14, { color: '#ffd23f', speed: 180 });
      fx.emit('glow', seatX(seat), SEAT_Y - 90, 1, { color: '#ffd23f', size: 160 });
      pushRing(seatX(seat), SEAT_Y - 40, 10, '#ffd23f');
      G.carpet = { x: seatX(seat), t: 1.2 };
    }
    return true;
  }

  function moodFor(c) {
    const f = c.patience / c.patienceMax;
    if (f > 0.6) return 'happy';
    if (f < 0.15) return 'angry';
    if (f < 0.35) return 'impatient';
    return 'ok';
  }

  function cancelTicket(c) {
    const t = c.ticket;
    if (!t) return;
    c.ticket = null;
    const i = G.tickets.indexOf(t);
    if (i >= 0) G.tickets.splice(i, 1);
    for (const id of SZ.KitchenData.STATION_ORDER)
      for (const s of G.stations[id].slots)
        if (s.ticket === t && !t.done) { s.ticket = null; s.progress = 0; s.state = 'idle'; }
  }

  function updateCustomers(dt) {
    for (const c of G.customers) {
      if (c.hop > 0) c.hop -= dt;
      if (c.state === 'walkIn') {
        c.x += WALK_SPEED * dt;
        if (c.x >= seatX(c.seat)) { c.x = seatX(c.seat); c.state = 'waiting'; c.bubbleT = G.animT; sfx('blip', { pitch: 1.8, volume: 0.2 }); }
      } else if (c.state === 'waiting') {
        c.patience -= dt;
        c.mood = moodFor(c);
        /* impatient guests sweat, angry ones fume */
        c.emoteT = (c.emoteT || 0) - dt;
        if (c.emoteT <= 0 && (c.mood === 'impatient' || c.mood === 'angry')) {
          const top = SEAT_Y - 95 * GUEST_SCALE;
          if (c.mood === 'angry') {
            c.emoteT = 0.35;
            fx.emit('steam', c.x + (Math.random() < 0.5 ? -22 : 22), top + 8, 2, { color: '#ffffff', speed: 30, scale: 0.8, alpha: 0.8 });
            if (Math.random() < 0.3) fx.emit('smoke', c.x, top, 1, { color: '#e04040', speed: 20, scale: 0.6, alpha: 0.4 });
          } else {
            c.emoteT = 1.1;
            fx.emit('drop', c.x + 20, top + 12, 1, { color: '#6ab8f0', speed: 40, angle: -Math.PI / 3, spread: 0.6 });
          }
        }
        if (c.patience <= 0) {
          c.state = 'leaving';
          c.mood = 'angry';
          c.leaveT = 0;
          G.combo = 0;
          ++G.walkouts;
          cancelTicket(c);
          fx.text(c.x, SEAT_Y - 150, 'Too slow!', { color: '#ff6a5a', size: 24 });
          /* the anger puff: a short red cloud over the empty seat */
          fx.emit('smoke', c.x, SEAT_Y - 100, 7, { color: '#d04040', speed: 70 });
          fx.emit('steam', c.x, SEAT_Y - 110, 4, { color: '#ffffff', speed: 40 });
          pushRing(c.x, SEAT_Y - 90, 8, '#e04545');
          sfx('hurt', { volume: 0.6 });
        }
      } else if (c.state === 'eating') {
        c.eatTimer -= dt;
        /* crumbs fall while the guest chews */
        c.crumbT -= dt;
        if (c.crumbT <= 0) {
          c.crumbT = 0.35;
          fx.emit('crumb', c.x + 8, SEAT_Y - 40, 2, { colors: ['#c8904a', '#e8c070', '#8a5a2a'], speed: 60, angle: -Math.PI / 2, spread: 2.4 });
          if (Math.random() < 0.3) fx.emit('heart', c.x + (Math.random() - 0.5) * 30, SEAT_Y - 90, 1, { color: '#ff5a7a', speed: 30, size: 16 });
        }
        if (c.eatTimer <= 0) {
          c.state = 'leaving';
          c.mood = 'love';
          c.leaveT = 0;
          c.wave = 1.2;
          /* the critic holds up the score card on the way out */
          if (c.type.id === 'critic' && c.rating > 0)
            sfx(c.rating >= 3 ? 'levelup' : 'lose', { volume: 0.6 });
        }
      } else if (c.state === 'leaving') {
        c.x += WALK_SPEED * dt;
        c.leaveT += dt;
        if (c.wave > 0) c.wave -= dt;
      }
    }
    G.customers = G.customers.filter(c => c.x < VIEW_W + 80);
  }

  /* Taking an order: click the guest or the bubble over their head. */
  function takeOrder(c) {
    if (c.state !== 'waiting' || c.ticket) return;
    const recipe = SZ.KitchenData.recipeById(c.order);
    const ticket = { id: ++G.ticketSeq, recipe, customer: c, stepIndex: 0, results: [], waitingFor: recipe.steps[0].station, done: false, born: G.animT };
    fx.emit('star', c.x, SEAT_Y - BUBBLE_DY, 6, { color: '#ffffff', speed: 120 });
    c.ticket = ticket;
    G.tickets.push(ticket);
    sfx('select');
    if (G.coach && G.coach.step === 1) coachAdvance(2, ticket);
  }

  NS.customers = { spawnCustomer, updateCustomers, takeOrder };

})();
