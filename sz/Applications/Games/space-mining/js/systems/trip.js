/* A trip into a belt from launch to its end: builds the belt (outpost site, hazards, rocks,
   life and gas, geodes, wrecks, the Crown Heart), the ship, drones, the outpost's fleet and
   events, or restores an autosaved trip; watches docking, fuel, hull and mode timers; autosaves;
   handles discoveries, wreck salvage and the Crown; Siege starts a starter outpost and rebuilds
   the ship at the hub; settles the hold at the station (or sells it on the spot in Gold Rush
   and Siege), runs the outposts' market cycle and fills in the results.
   Owns G.run, G.specials, G.dock and G.banner. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, DOCK_R, DOCK_SPEED } = C;
  const { ZONES, ORE_BY_ID } = NS.ores;
  const { MODES } = NS.goals;
  const rules = NS.rules;
  const eco = NS.economy;
  const rng = NS.rng;
  const R = rng.fx;

  function flightStats(mode) {
    return mode === 'daily' ? rules.computeStats(rules.dailyLoadout(), 'prospector') : NS.save.refreshStats();
  }

  /* Tech or hangar changes during a paused trip apply at once (not in the Daily Belt) */
  function refreshFlightStats() {
    if (!G.run) {
      NS.save.refreshStats();
      return;
    }
    if (G.run.mode === 'daily') return;
    G.stats = flightStats(G.run.mode);
    G.run.cargoMax = G.stats.cargo;
    NS.ship.applyStats(G.stats);
  }

  function seedFor(mode, zone) {
    if (mode === 'daily') return rng.hashString('daily:' + rng.dayKey());
    if (mode === 'rush') return (Date.now() ^ 0x2545f491) >>> 0;
    return rng.hashString(zone.id + ':' + G.save.stats.trips + ':' + G.save.cycle);
  }

  function zoneFor(mode, index) {
    if (mode === 'daily') return ZONES[rng.hashString(rng.dayKey()) % 3 + 1];
    return ZONES[Math.max(0, Math.min(ZONES.length - 1, index))];
  }

  function startTrip(mode, zoneIndex, opts) {
    opts = opts || {};
    const snap = opts.resume && NS.resume.valid(opts.resume) ? opts.resume : null;
    const zone = zoneFor(mode, zoneIndex);
    const stats = G.stats = flightStats(mode);
    const seed = snap ? snap.seed : seedFor(mode, zone);
    const r = rng.makeRng(seed);
    const strategic = mode === 'career' || mode === 'siege';
    const mods = strategic ? NS.calendar.mods(new Date(), zone.index) : Object.assign({}, NS.calendar.NEUTRAL);
    G.world.w = C.WORLD_W;
    G.world.h = C.WORLD_H;
    G.dock = { x: G.world.w / 2, y: G.world.h / 2, angle: 0, lights: 0 };
    G.run = {
      mode: mode, zone: zone, zoneIndex: zone.index, seed: seed, t: 0,
      timeLeft: MODES[mode].time || 0, cargo: {}, cargoUsed: 0, cargoMax: stats.cargo, units: 0,
      rd: 0, rdAcc: 0, salvage: 0, sold: 0, fractures: 0, kills: 0, damage: 0, charges: stats.seismic,
      pulseCd: 0, pulse: null, pirateT: (mode === 'career' ? 55 : 35) + r() * 30, respawnT: 2,
      rockTarget: 0, pulled: 0, lasering: false, leftDock: false, ending: null, endT: 0, towT: 0,
      inRad: 0, inWell: 0, crownBroken: false, dronesOut: false, pickT: 0, pickText: null, turretAngle: 0,
      contam: 0, survivors: 0, waves: 0, invaders: 0, bosses: 0, credits: mode === 'siege' ? 2400 : 0, mods: mods, saveT: 12,
      siegeWon: false, reviveT: 0,
    };
    G.specials.length = 0;
    NS.fx.clear();
    NS.mining.clear();
    NS.pirates.clear();
    NS.units.clear();
    NS.enemies.clear();
    NS.command.reset();
    NS.base.prepare(zone, mode);
    if (G.base) G.base.mods = mods;
    if (snap && snap.base && mode === 'siege') NS.base.adopt(snap.base);
    NS.hazards.setup(zone, r);
    NS.asteroids.generate(zone, seed, stats);
    G.run.rockTarget = G.rocks.length;
    placeSpecials(zone, r, mode, stats);
    NS.life.setup(zone, seed, mods);
    NS.ship.create(stats, G.dock.x, G.dock.y + 150);
    NS.drones.setup(stats);
    if (mode === 'siege' && !snap) siegeStart();
    if (G.base && NS.base.claimed()) {
      NS.base.muster();
      NS.waves.arm(true);
    }
    NS.events.setup(zone, seed, mods);
    NS.camera.snap(G.ship.x, G.ship.y);
    NS.backdrop.setZone(zone.index);
    G.banner = null;
    if (mode === 'career') {
      if (G.save.visited.indexOf(zone.id) < 0) {
        G.save.visited.push(zone.id);
        rules.record(G.save, 'zonesVisited', G.save.visited.length);
      }
      G.save.zone = zone.id;
    }
    NS.screens.setScreen('playing');
    if (snap) {
      NS.resume.restore(snap);
      G.ship.control = true;
      banner('RESUMED', zone.name + ' - right where you left off', zone.theme.accent);
    } else NS.cinematics.play('arrival', { zone: zone });
    if (mods.anomaly && strategic) NS.screens.toast('Anomaly belt this week: ' + mods.anomaly.name + ' - ' + mods.anomaly.text, mods.anomaly.color);
    else if (mods.season && strategic) NS.screens.toast(mods.season.name + ': ' + mods.season.text, mods.season.color);
  }

  /* Siege: a starter outpost (hub, power, a rig, a smelter, two lasers) and some stock */
  function siegeStart() {
    const B = NS.base;
    const site = G.base.site;
    B.grant('hub', site.hubX, site.hubY);
    const kit = ['solar', 'solar', 'rig', 'smelter', 'laser', 'laser', 'laser', 'habitat'];
    for (let i = 0; i < kit.length; ++i) {
      const spot = B.findSpot(kit[i]);
      if (spot) B.grant(kit[i], spot.cx, spot.cy);
    }
    const d = G.base.data;
    d.crew = 10;
    d.stock.ore = { iron: 60, copper: 30, nickel: 20, ice: 20 };
    d.stock.bar = { iron: 10, copper: 6, titanium: 4 };
    d.stock.comp = { circuit: 2, alloy: 2 };
    B.refresh();
  }

  function farSpot(r, min) {
    for (let i = 0; i < 80; ++i) {
      const x = 400 + r() * (G.world.w - 800), y = 400 + r() * (G.world.h - 800);
      if (Math.abs(x - G.dock.x) + Math.abs(y - G.dock.y) > min) return { x: x, y: y };
    }
    return { x: 500, y: 500 };
  }

  function placeSpecials(zone, r, mode, stats) {
    const geodeChance = (0.3 + stats.geode * 0.5 + (stats.scanner >= 2 ? 0.15 : 0)) * (mode === 'career' ? 1 : 0.6);
    if (r() < geodeChance) {
      const p = farSpot(r, 1400);
      const ore = zone.index >= 3 ? 'voidCrystal' : zone.index >= 1 ? 'gold' : 'silver';
      const g = NS.asteroids.special('geode', p.x, p.y, ore);
      g.known = stats.scanner >= 3;
    }
    if (r() < 0.25 + stats.geode * 0.4 || (mode === 'career' && G.save.stats.trips === 2)) {
      const p = farSpot(r, 1600);
      G.specials.push({ alive: true, kind: 'derelict', x: p.x, y: p.y, r: 86, angle: r() * TAU, hp: 260 * zone.hardness, maxHp: 260 * zone.hardness,
        known: stats.scanner >= 3, found: false, variant: Math.floor(r() * 2), sparkT: 0 });
    }
    if (zone.id === 'void' && mode === 'career' && !G.save.crownDone) {
      const crown = NS.asteroids.special('crown', G.world.w * 0.85, G.world.h * 0.18, 'voidCrystal');
      crown.known = true;
    }
  }

  function banner(title, sub, color) {
    G.banner = { title: title, sub: sub || '', color: color || '#ffd25a', t: 0 };
  }

  /* ── per step ── */
  function update(dt) {
    const run = G.run;
    const s = G.ship;
    run.t += dt;
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t > 3.4) G.banner = null;
    }
    G.dock.angle += dt * 0.25;
    G.dock.lights += dt;
    if (run.mode === 'career') {
      run.achT = (run.achT || 0) - dt;
      if (run.achT <= 0) {
        run.achT = 1;
        const got = rules.checkAchievements(G.save);
        if (got.length) NS.screens.achievements(got);
      }
    }
    if (run.ending) {
      run.endT -= dt;
      if (run.endT <= 0) endTrip(run.ending);
      return;
    }
    if (run.mode === 'career' || run.mode === 'siege') {
      run.saveT -= dt;
      if (run.saveT <= 0 && !G.cine) {
        run.saveT = 20;
        NS.resume.save();
      }
    }
    if (run.reviveT > 0) {
      run.reviveT -= dt;
      if (run.reviveT <= 0) revive();
      return;
    }
    if (run.timeLeft > 0) {
      run.timeLeft -= dt;
      if (run.timeLeft <= 0) {
        run.timeLeft = 0;
        banner('TIME', 'The belt closes', '#ffd25a');
        finish('time', 1.2);
        return;
      }
    }
    const dx = s.x - G.dock.x, dy = s.y - G.dock.y;
    const dd = Math.sqrt(dx * dx + dy * dy);
    if (dd > DOCK_R * 3) run.leftDock = true;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (run.leftDock && dd < DOCK_R && sp < DOCK_SPEED && !G.cine) {
      if (run.mode !== 'career') quickSell();
      else {
        NS.cinematics.play('docking', {});
        return;
      }
    }
    /* fuel */
    if (s.fuel <= 0 && !run.towT) {
      run.towT = 6;
      banner(G.stats.jump ? 'EMERGENCY JUMP' : 'OUT OF FUEL', G.stats.jump ? 'Spinning up the jump drive...' : 'A tow is on its way - half the hold pays for it', '#ff5c6c');
    }
    if (run.towT > 0) {
      run.towT -= dt;
      if (run.towT <= 0) {
        if (run.mode === 'siege' && NS.base.hub()) {
          run.towT = 0;
          revive();
        } else finish('tow', 0.01);
      }
    }
    discover(s);
  }

  /* first sight of a geode, wreck or the Crown plays the discovery sequence */
  function discover(s) {
    if (G.cine) return;
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (o.kind === 'rock' || o.found || !o.alive) continue;
      const reach = o.kind === 'crown' ? 900 : 560;
      if ((o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y) < reach * reach) {
        o.found = o.known = true;
        NS.cinematics.play('discovery', { kind: o.kind, x: o.x, y: o.y, ore: o.ore });
        return;
      }
    }
    for (let i = 0; i < G.specials.length; ++i) {
      const o = G.specials[i];
      if (o.found || !o.alive) continue;
      if ((o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y) < 560 * 560) {
        o.found = o.known = true;
        NS.cinematics.play('discovery', { kind: 'derelict', x: o.x, y: o.y });
        return;
      }
    }
  }

  /* Gold Rush and Daily: docking sells the hold on the spot at standard prices */
  function quickSell() {
    const run = G.run;
    let v = 0;
    for (const id in run.cargo) v += run.cargo[id] * ORE_BY_ID[id].value;
    if (v <= 0) return;
    run.sold += v;
    if (run.mode === 'siege') run.credits += v;
    run.cargo = {};
    run.cargoUsed = 0;
    run.leftDock = false;
    NS.fx.text(G.dock.x, G.dock.y - 80, 'SOLD +' + v, '#ffd25a', 28, 1.6);
    NS.fx.ring(G.dock.x, G.dock.y, 40, 260, 0.6, '#ffd25a', 8);
    NS.audio.sfx('coin', { volume: 0.8 });
    NS.audio.sfx('levelup', { volume: 0.4 });
    G.ship.fuel = G.ship.maxFuel;
  }

  /* begins the end of a trip after a short delay (explosions play out) */
  function finish(reason, delay) {
    const run = G.run;
    if (!run || run.ending) return;
    run.ending = reason;
    run.endT = delay;
  }

  /* Siege: the ship is rebuilt at the hub while the outpost stands */
  function revive() {
    const s = G.ship, h = NS.base.hub();
    if (!h) { finish('destroyed', 0.5); return; }
    s.alive = true;
    s.hidden = false;
    s.control = true;
    s.x = h.x;
    s.y = h.y + h.r + 60;
    s.vx = s.vy = 0;
    s.hull = s.maxHull;
    s.fuel = s.maxFuel;
    s.shield = s.maxShield;
    NS.fx.ring(s.x, s.y, 10, 160, 0.6, '#4fd8ff', 4);
    banner('SHIP REBUILT', 'The hub crews patched you up', '#4fd8ff');
  }

  function shipDestroyed() {
    const s = G.ship;
    if (!s.alive) return;
    if (G.run.mode === 'siege' && NS.base.hub()) {
      s.alive = false;
      NS.fx.explode(s.x, s.y, 60, NS.fx.FIRE, { debrisColor: G.stats.colors.hull });
      NS.fx.shockwave(s.x, s.y, 320, '#ffb070');
      NS.audio.sfx('explode', { volume: 1, pitch: 0.6 });
      banner('SHIP DOWN', 'Rebuilding at the hub...', '#ff5c6c');
      G.run.reviveT = 6;
      G.run.cargo = {};
      G.run.cargoUsed = 0;
      return;
    }
    s.alive = false;
    NS.fx.explode(s.x, s.y, 60, NS.fx.FIRE, { debrisColor: G.stats.colors.hull });
    NS.fx.shockwave(s.x, s.y, 320, '#ffb070');
    NS.fx.slowMo(1.6, 0.25);
    NS.fx.flash('#ffffff', 0.6);
    NS.audio.sfx('explode', { volume: 1, pitch: 0.6 });
    NS.audio.sfx('lose', { volume: 0.6 });
    banner(G.stats.jump ? 'EMERGENCY JUMP' : 'HULL BREACHED', G.stats.jump ? 'The escape pod jumps home with the hold' : 'The salvage crew tows the wreck home', '#ff5c6c');
    finish('destroyed', 2.4);
  }

  /* lasering a wreck open */
  function cutWreck(w, dmg, hx, hy) {
    w.hp -= dmg;
    w.sparkT -= 1 / 60;
    if (w.sparkT <= 0) {
      w.sparkT = 0.08;
      NS.fx.sparks(hx, hy, R() * TAU, 1.2, 3, '#ffd8a0', 220, 0.3);
    }
    if (w.hp > 0) return;
    w.alive = false;
    const z = G.run.zone;
    NS.fx.explode(w.x, w.y, 50, NS.fx.FIRE, { debrisColor: '#6a6a7a' });
    NS.fx.shockwave(w.x, w.y, 300, '#ffd8a0');
    NS.audio.sfx('explode', { volume: 0.8 });
    NS.mining.spawnSalvage(w.x, w.y, Math.round(500 * z.danger * G.stats.salvage), 8);
    const ores = Object.keys(z.ores).sort((a, b) => ORE_BY_ID[b].value - ORE_BY_ID[a].value);
    for (let i = 0; i < 6 + z.danger * 2; ++i) NS.mining.spawnNugget(w.x, w.y, ores[0], 1, null, 180);
    const rd = Math.round((3 + z.danger) * G.stats.salvage);
    G.run.rd += rd;
    NS.fx.text(w.x, w.y - 60, '+' + rd + ' DATA', '#b48aff', 24, 2);
    if (G.run.mode === 'career') rules.bump(G.save, 'derelicts', 1);
  }

  function onSpecialBroken(rock) {
    const run = G.run;
    if (rock.kind === 'geode') {
      const rd = Math.round(3 * G.stats.dataMul);
      run.rd += rd;
      NS.fx.text(rock.x, rock.y - 60, 'GEODE  +' + rd + ' DATA', '#e8c8ff', 26, 2.2);
      NS.fx.shockwave(rock.x, rock.y, 420, ORE_BY_ID[rock.ore].glow);
      NS.fx.slowMo(0.8, 0.35);
      NS.audio.sfx('win', { volume: 0.6 });
      if (run.mode === 'career') rules.bump(G.save, 'geodes', 1);
    } else if (rock.kind === 'crown') {
      run.crownBroken = true;
      for (let i = 0; i < 40; ++i) NS.mining.spawnNugget(rock.x, rock.y, 'voidCrystal', 1, rock, 420);
      run.rd += 10;
      NS.fx.shockwave(rock.x, rock.y, 900, '#e8c8ff');
      NS.fx.explode(rock.x, rock.y, 110, NS.fx.VIOLET, { noDebris: true });
      NS.fx.slowMo(2.2, 0.2);
      NS.fx.flash('#f0d8ff', 0.9);
      NS.fx.shake(1);
      NS.audio.sfx('win', { volume: 1 });
      banner('THE CROWN HEART SHATTERS', 'Bring the crystals home', '#e8c8ff');
      if (run.mode === 'career') {
        G.save.crownDone = true;
        rules.bump(G.save, 'crown', 1);
      }
    }
  }

  /* how much of the hold survives each kind of ending */
  function keepShare(reason, stats) {
    if (reason === 'dock' || reason === 'time' || reason === 'victory') return 1;
    if (reason === 'fallen') return 0;
    if (stats.jump) return 0.85;
    return reason === 'tow' ? 0.5 : 0;
  }

  /* Settle a finished trip and open the results */
  function endTrip(reason) {
    const run = G.run;
    if (!run) return;
    NS.drones.flush();
    NS.base.sync();
    NS.resume.clear();
    const save = G.save;
    const stats = G.stats;
    const keep = keepShare(reason, stats);
    const hold = {};
    let units = 0;
    for (const id in run.cargo) {
      const n = Math.floor(run.cargo[id] * keep);
      if (n > 0) { hold[id] = n; units += n; }
    }
    const res = { mode: run.mode, reason: reason, zone: run.zone, hold: hold, units: units, lost: run.units - units, rd: run.rd,
      salvage: run.salvage, fractures: run.fractures, kills: run.kills, t: 0, time: run.t, achievements: [], crown: run.crownBroken, jump: stats.jump,
      waves: run.waves, invaders: run.invaders, survivors: run.survivors };
    if (run.mode === 'career') {
      for (const id in hold) save.store.ore[id] = (save.store.ore[id] || 0) + hold[id];
      res.value = eco.cargoValue(save, stats, hold);
      save.credits += run.salvage;
      rules.bump(save, 'earned', run.salvage);
      save.rd += run.rd;
      rules.bump(save, 'trips', 1);
      rules.bump(save, 'units', units);
      if (reason === 'destroyed') rules.bump(save, 'deaths', 1);
      if (reason === 'dock' && run.cargoUsed >= run.cargoMax - 0.5) rules.bump(save, 'fullDocks', 1);
      const s = G.ship;
      const fee = eco.serviceCost(stats, s.maxFuel - s.fuel, reason === 'destroyed' ? s.maxHull * 1.5 : s.maxHull - s.hull);
      res.service = Math.min(save.credits, fee);
      save.credits -= res.service;
      if (run.survivors > 0 && reason !== 'destroyed') {
        res.bounty = run.survivors * 150;
        save.credits += res.bounty;
        rules.bump(save, 'earned', res.bounty);
        rules.bump(save, 'rescued', run.survivors);
      }
      eco.tickMarket(save, stats, rng.makeRng((run.seed ^ save.cycle * 2654435761) >>> 0));
      res.colony = NS.production.cycleBases(save, stats);
      eco.dailyContract(save, rng.dayKey());
      res.news = save.news;
    } else if (run.mode === 'siege') {
      const value = G.base ? NS.colony.baseValue(G.base.data) : 0;
      let v = run.waves * 1000 + run.invaders * 15 + Math.round(value / 10) + (run.siegeWon ? 5000 : 0) + run.sold;
      res.score = v;
      res.won = run.siegeWon;
      res.best = v > save.best.siege;
      if (res.best) save.best.siege = v;
      res.bonus = Math.round(v * 0.2);
      save.credits += res.bonus;
      save.rd += run.rd;
      rules.bump(save, 'earned', res.bonus);
      if (run.siegeWon) rules.bump(save, 'siegeWins', 1);
      rules.addHighScore(save, v, 'siege', run.zone.name + ' - wave ' + run.waves);
    } else {
      let v = run.sold + run.salvage;
      for (const id in hold) v += hold[id] * ORE_BY_ID[id].value;
      res.score = v;
      if (run.mode === 'rush') {
        res.best = v > save.best.rush;
        if (res.best) save.best.rush = v;
        res.bonus = Math.round(v * 0.25);
        save.credits += res.bonus;
        rules.bump(save, 'earned', res.bonus);
      } else {
        const day = rng.dayKey();
        res.best = save.best.daily.day !== day || v > save.best.daily.score;
        if (res.best) save.best.daily = { day: day, score: v };
      }
      rules.addHighScore(save, v, run.mode, run.zone.name);
    }
    /* a running festival collects tokens from every haul */
    const haul = run.mode === 'career' ? (res.value || 0) + run.salvage : (res.score || 0);
    res.tokens = NS.calendar.season(new Date()) ? NS.cosmetics.tokensFor(haul) : 0;
    res.festival = NS.cosmetics.addTokens(save, res.tokens, new Date());
    res.achievements = rules.checkAchievements(save);
    if (res.achievements.length) NS.screens.achievements(res.achievements);
    G.ui.results = res;
    G.run = null;
    G.base = null;
    NS.units.clear();
    NS.enemies.clear();
    NS.command.reset();
    G.distress = null;
    G.ship = null;
    G.cam.focus = null;
    NS.save.refreshStats();
    NS.save.writeSave();
    if (res.crown) NS.cinematics.play('ending', {}, () => NS.screens.setScreen('results'));
    else NS.screens.setScreen('results');
  }

  /* a tow home from the pause menu */
  function abort() {
    if (!G.run || G.run.ending) return;
    NS.screens.setScreen('playing');
    banner('TOW REQUESTED', 'Heading home', '#ffb347');
    finish('tow', 0.6);
  }

  Object.assign(NS.trip, {
    flightStats, refreshFlightStats, startTrip, siegeStart, update, banner, finish, revive, shipDestroyed, cutWreck, onSpecialBroken,
    keepShare, endTrip, abort, quickSell
  });
})();
