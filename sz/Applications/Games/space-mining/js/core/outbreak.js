/* Pure crew, infection and corruption model of an outpost. Crew arrive while there is housing.
   Bloom infection grows inside a staffed building (logistic), spreads along the link network
   unless a building is quarantined, kills crew, and is treated by medical bays (twice as fast
   with serum in stock) or sterilised by hand; an outpost whose crew all die is abandoned.
   Lattice corruption replicates inside a building, spreads along links once it takes hold,
   turns a building rogue at 100% and is purged by EMP or purge tenders. Vaccine and firewall
   research slow both. Returns events for the caller to show. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { BUILDING_BY_ID } = NS.colonyData;
  const C = NS.colony;

  const GROW = 0.045;      /* logistic infection growth per second */
  const SPREAD = 0.03;     /* infection pushed along a link per second at full infection */
  const DECAY = 0.02;      /* spores die off in unstaffed rooms */
  const MORTALITY = 0.035; /* crew deaths per second per staffed crew at full infection */
  const C_GROW = 0.012;    /* corruption self-replication */
  const C_SPREAD = 0.012;  /* corruption pushed along a link once over C_HOLD */
  const C_HOLD = 0.25;

  /* crew arrive one at a time while housing is free (faster with habitats) */
  function crewStep(base, dt, stats) {
    const ev = [];
    if (base.abandoned) return ev;
    const cap = C.housing(base);
    if (base.crew > cap) base.crew = cap;
    if (base.crew >= cap) { base._grow = 0; return ev; }
    const habitats = base.buildings.some(b => b.type === 'habitat' && b.prog >= 1);
    base._grow = (base._grow || 0) + dt / (habitats ? 9 : 22);
    if (base._grow >= 1) {
      base._grow -= 1;
      ++base.crew;
      ev.push({ type: 'arrive' });
    }
    return ev;
  }

  function medCover(base, b, stockSerum, net) {
    let k = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      const m = base.buildings[i];
      if (m.type !== 'medbay' || m.prog < 1 || !net.on[i] || m.rogue || m.quarantine) continue;
      const def = BUILDING_BY_ID.medbay;
      const a = C.centre(m), c = C.centre(b);
      const d = Math.sqrt((a.x - c.x) * (a.x - c.x) + (a.y - c.y) * (a.y - c.y)) * C.CELL;
      if (d <= def.radius) k += def.cure * C.levelMul(m.lvl) * (m._eff === undefined ? 1 : Math.max(0.25, m._eff)) * (stockSerum ? 2 : 1);
    }
    return k;
  }

  /* One infection step over the outpost; w: { base, net, stats, dt }. Events: death, cured,
     abandoned, spread */
  function infectionStep(w) {
    const base = w.base, net = w.net, dt = w.dt;
    const vac = w.stats ? w.stats.vaccine || 0 : 0;
    const list = base.buildings;
    const ev = [];
    if (base.abandoned) return ev;
    const serum = (base.stock.comp.serum || 0) > 0;
    /* a working medical bay with serum in stock vaccinates the whole outpost (one dose every
       30 seconds while anyone is sick) */
    let vacc = 0;
    if (serum && list.some((m, i) => m.type === 'medbay' && m.prog >= 1 && net.on[i] && !m.rogue && !m.quarantine) && list.some(b => (b.inf || 0) > 0)) {
      vacc = 0.6;
      base._dose = (base._dose || 0) + dt;
      if (base._dose >= 30) {
        base._dose = 0;
        if (--base.stock.comp.serum <= 0) delete base.stock.comp.serum;
      }
    }
    const vk = (1 - vac) * (1 - vacc);
    const delta = new Array(list.length);
    for (let i = 0; i < list.length; ++i) delta[i] = 0;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      const inf = b.inf || 0;
      if (inf <= 0) continue;
      const staffed = (b._staff || 0) > 0 || b.type === 'hub';
      if (staffed) delta[i] += GROW * vk * inf * (1 - inf) * dt + 0.004 * vk * dt;
      else delta[i] -= DECAY * dt;
      const cure = medCover(base, b, serum, net);
      if (cure > 0) delta[i] -= cure * dt;
      if (vacc) delta[i] -= 0.02 * dt;
    }
    /* spread along links; quarantine cuts them (links() leaves quarantined buildings out) */
    for (let k = 0; k < net.edges.length; ++k) {
      const a = net.edges[k][0], b = net.edges[k][1];
      const ia = list[a].inf || 0, ib = list[b].inf || 0;
      if (ia > 0.05) delta[b] += SPREAD * ia * vk * dt * (ib < 1 ? 1 : 0);
      if (ib > 0.05) delta[a] += SPREAD * ib * vk * dt * (ia < 1 ? 1 : 0);
    }
    let total = 0;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      const before = b.inf || 0;
      const after = Math.max(0, Math.min(1, before + delta[i]));
      if (before <= 0 && after > 0) ev.push({ type: 'spread', b: b });
      b.inf = after < 0.004 && delta[i] < 0 ? 0 : after;
      if (b.inf > (b._peak || 0)) b._peak = b.inf;
      if (before > 0 && b.inf === 0) {
        if ((b._peak || 0) >= 0.1) ev.push({ type: 'cured', b: b, n: Math.max(1, b._staff || 1) });
        b._peak = 0;
      }
      /* deaths among the staff of an infected building */
      const staff = b._staff || (b.type === 'hub' ? Math.min(base.crew, 2) : 0);
      if (b.inf > 0.15 && staff > 0) {
        b._death = (b._death || 0) + MORTALITY * b.inf * staff * dt * (1 - vac * 0.5);
        while (b._death >= 1 && base.crew > 0) {
          b._death -= 1;
          --base.crew;
          ev.push({ type: 'death', b: b });
        }
      }
      total += b.inf;
    }
    base.infected = list.length ? Math.min(1, total / list.length) : 0;
    if (base.crew <= 0 && list.some(b => b.type === 'hub') && !base.abandoned && list.some(b => (b.inf || 0) > 0)) {
      base.abandoned = true;
      ev.push({ type: 'abandoned' });
    }
    return ev;
  }

  function seedInfection(b, amount) {
    b.inf = Math.min(1, (b.inf || 0) + amount);
  }

  /* Sterilise a building: the spores die, and so do a third of its staff (at least one if any) */
  function sterilize(base, b) {
    const staff = b._staff || 0;
    const killed = (b.inf || 0) > 0.05 && staff > 0 ? Math.max(1, Math.floor(staff / 3)) : 0;
    base.crew = Math.max(0, base.crew - killed);
    b.inf = 0;
    return killed;
  }

  /* One corruption step; w: { base, net, stats, dt }. Events: rogue, corrupt */
  function corruptionStep(w) {
    const base = w.base, net = w.net, dt = w.dt;
    const fw = w.stats ? w.stats.firewall || 0 : 0;
    const list = base.buildings;
    const ev = [];
    const delta = new Array(list.length);
    for (let i = 0; i < list.length; ++i) delta[i] = 0;
    for (let i = 0; i < list.length; ++i) {
      const c = list[i].cor || 0;
      if (c > 0 && !list[i].rogue) delta[i] += C_GROW * (0.4 + c) * (1 - fw) * dt;
    }
    for (let k = 0; k < net.edges.length; ++k) {
      const a = net.edges[k][0], b = net.edges[k][1];
      const ca = list[a].rogue ? 1 : list[a].cor || 0, cb = list[b].rogue ? 1 : list[b].cor || 0;
      if (ca > C_HOLD) delta[b] += C_SPREAD * ca * (1 - fw) * dt;
      if (cb > C_HOLD) delta[a] += C_SPREAD * cb * (1 - fw) * dt;
    }
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (b.rogue || delta[i] <= 0) continue;
      const before = b.cor || 0;
      b.cor = Math.min(b.type === 'hub' ? 0.95 : 1, before + delta[i]);
      if (before <= 0 && b.cor > 0) ev.push({ type: 'corrupt', b: b });
      if (b.cor >= 1 && b.type !== 'hub') {
        b.rogue = true;
        ev.push({ type: 'rogue', b: b });
      }
    }
    return ev;
  }

  function inject(b, amount) {
    if (b.rogue) return false;
    b.cor = Math.min(b.type === 'hub' ? 0.95 : 1, (b.cor || 0) + amount);
    if (b.cor >= 1 && b.type !== 'hub') {
      b.rogue = true;
      return true;
    }
    return false;
  }

  /* Purge a building: corruption gone, control back, a short reboot */
  function purge(b) {
    const was = (b.cor || 0) > 0 || b.rogue;
    b.cor = 0;
    b.rogue = false;
    b._stun = 3;
    return was;
  }

  /* The hub's EMP: purges every building within r cells of the hub; returns how many */
  function emp(base, radiusCells) {
    let hub = null;
    for (let i = 0; i < base.buildings.length; ++i) if (base.buildings[i].type === 'hub') hub = base.buildings[i];
    if (!hub) return 0;
    const h = C.centre(hub);
    let n = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      const c = C.centre(b);
      if (Math.abs(c.x - h.x) <= radiusCells && Math.abs(c.y - h.y) <= radiusCells && purge(b)) ++n;
    }
    return n;
  }

  /* Reclaim an abandoned outpost with new crew: sterilised, purged, staffed */
  function reclaim(base, crew) {
    if (!base.abandoned) return false;
    base.abandoned = false;
    base.crew = Math.max(base.crew, crew);
    base.hive = false;
    base.idleCycles = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      base.buildings[i].inf = 0;
      base.buildings[i].cor = 0;
      base.buildings[i].rogue = false;
    }
    return true;
  }

  Object.assign(NS.outbreak, {
    GROW, SPREAD, MORTALITY, C_GROW, C_SPREAD, C_HOLD, crewStep, infectionStep, seedInfection, sterilize, corruptionStep,
    inject, purge, emp, reclaim
  });
})();
