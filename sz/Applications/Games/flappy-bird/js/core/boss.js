;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Boss fights as a pure, seeded simulation in screen space (the bird stays at x 360).
   * A boss swoops in, hovers at the right and cycles its attack patterns; sun orbs drift
   * in from the right, and every orb the bird touches launches a sun bolt that strikes the
   * boss. Below half health the boss enters a faster second phase. No DOM, no drawing,
   * so the node tests fly a bot through every fight.
   *
   * update(b, dt, birdY) advances everything and fills b.events; collide(b, x, y, r)
   * returns 'shot' / 'zone' / 'orb' / '' for the bird circle and removes what it touched.
   */

  const C = SZ.FlappyCourse;
  const GROUND_Y = 640;
  const BIRD_X = 360;

  const KINDS = {
    bee: { name: 'Queen Buzzella', title: 'Hive Queen of the Meadow', hp: 8, cd: 1.9, homeX: 1030, bob: 130, bobRate: 1.1 },
    wyrm: { name: 'Dunejaw', title: 'Sandwyrm of the Canyon', hp: 9, cd: 2.2, homeX: 1050, bob: 90, bobRate: 0.7 },
    owl: { name: 'Glacius', title: 'Frost Owl of the Peaks', hp: 10, cd: 2.1, homeX: 1040, bob: 110, bobRate: 0.8 },
    moth: { name: 'Duskmoth', title: 'Moon Moth of the Twilight Woods', hp: 11, cd: 2.2, homeX: 1040, bob: 140, bobRate: 0.9 },
    crowbot: { name: 'MK-7 Crowbot', title: 'Steel Warden of Neon City', hp: 12, cd: 2.0, homeX: 1050, bob: 100, bobRate: 1.0 },
    corvus: { name: 'Corvus', title: 'The Storm Crow', hp: 16, cd: 1.8, homeX: 1030, bob: 150, bobRate: 0.9 }
  };

  const PATTERNS = {
    bee: ['aimed', 'drones', 'aimed', 'fan'],
    wyrm: ['geyser', 'lob', 'geyser', 'aimed'],
    owl: ['rain', 'fan', 'rain', 'aimed'],
    moth: ['ring', 'homing', 'ring', 'fan'],
    crowbot: ['beam', 'missiles', 'beam', 'aimed'],
    corvus: ['fan', 'bolts', 'crows', 'beam', 'ring', 'homing']
  };

  function create(kind, seed, opts) {
    const k = KINDS[kind] ? kind : 'bee';
    const def = KINDS[k];
    opts = opts || {};
    const hp = Math.round(def.hp * (opts.hpScale || 1));
    return {
      kind: k, hp: hp, maxHp: hp, x: 1480, y: 320, t: 0,
      state: 'enter', stateT: 0, atk: 2.4, atkIndex: 0, phase2: false,
      shots: [], zones: [], orbs: [], bolts: [],
      orbT: 1.2, orbEvery: 2.0 / (opts.orbRate || 1), dmg: opts.dmg || 1,
      flash: 0, rs: C.rngState(seed >>> 0), events: [], hitsTaken: 0
    };
  }

  function rand(b) {
    return C.nextRandom(b.rs);
  }

  function shot(b, type, x, y, vx, vy, r, extra) {
    const s = { type: type, x: x, y: y, vx: vx, vy: vy, ay: 0, r: r, life: 6, homing: 0 };
    if (extra)
      Object.assign(s, extra);
    b.shots.push(s);
    return s;
  }

  function aimAngle(b, birdY) {
    return Math.atan2(birdY - b.y, BIRD_X - b.x);
  }

  function attack(b, name, birdY) {
    const mx = b.x - 60, my = b.y;
    if (name === 'aimed') {
      const a = aimAngle(b, birdY);
      for (let i = -1; i <= 1; ++i)
        shot(b, b.kind === 'bee' ? 'stinger' : b.kind === 'wyrm' ? 'sand' : b.kind === 'crowbot' ? 'bullet' : 'shard', mx, my, Math.cos(a + i * 0.2) * 330, Math.sin(a + i * 0.2) * 330, 11);
    } else if (name === 'fan') {
      const n = b.kind === 'corvus' ? 7 : 5;
      const a0 = aimAngle(b, birdY);
      const spread = b.kind === 'corvus' ? 1.1 : 0.9;
      for (let i = 0; i < n; ++i) {
        const a = a0 - spread / 2 + spread * i / (n - 1);
        shot(b, b.kind === 'corvus' ? 'feather' : b.kind === 'owl' ? 'shard' : 'stinger', mx, my, Math.cos(a) * 300, Math.sin(a) * 300, 10);
      }
    } else if (name === 'drones') {
      for (let i = 0; i < 2; ++i)
        shot(b, 'drone', b.x - 40, 160 + rand(b) * 360, -230, 0, 15, { baseY: 0, wave: 70, waveRate: 3 + i, phase: rand(b) * 6, life: 7 });
      for (const s of b.shots)
        if (s.type === 'drone' && !s.baseY)
          s.baseY = s.y;
    } else if (name === 'geyser') {
      const height = 220 + rand(b) * 110;
      b.zones.push({ type: 'geyser', x: BIRD_X + (rand(b) - 0.5) * 60, w: 64, top: GROUND_Y - height, warn: 0.95, active: 0.75 });
    } else if (name === 'lob') {
      for (let i = 0; i < 3; ++i)
        shot(b, 'sand', mx, my - 20, -260 - i * 70, -380 + rand(b) * 120, 13, { ay: 520 });
    } else if (name === 'rain') {
      for (let i = 0; i < 4; ++i)
        shot(b, 'icicle', BIRD_X + 160 + i * 130 + rand(b) * 60, -30, -175, 140 + rand(b) * 90, 12, { ay: 90, life: 7 });
    } else if (name === 'ring') {
      const n = 12;
      const gap = Math.round(((aimAngle(b, birdY) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * n);
      for (let i = 0; i < n; ++i) {
        if ((i - gap + n) % n <= 1 || (gap - i + n) % n <= 1)
          continue;
        const a = i / n * Math.PI * 2;
        shot(b, 'spore', b.x, b.y, Math.cos(a) * 190, Math.sin(a) * 190, 11);
      }
    } else if (name === 'homing') {
      for (let i = 0; i < 2; ++i)
        shot(b, 'spore', mx, my + (i ? 50 : -50), -170, i ? 60 : -60, 12, { homing: 1.5, life: 4.2, speed: 175 });
    } else if (name === 'beam') {
      b.zones.push({ type: 'beam', y: Math.max(70, Math.min(GROUND_Y - 50, birdY)), warn: 1.05, active: 0.5 });
    } else if (name === 'missiles') {
      for (let i = -1; i <= 1; i += 2)
        shot(b, 'missile', mx, Math.max(60, Math.min(GROUND_Y - 40, birdY + i * 75)), -430, 0, 12);
    } else if (name === 'bolts') {
      b.zones.push({ type: 'bolt', x: BIRD_X + (rand(b) - 0.5) * 40, w: 46, bottom: 230 + rand(b) * 80, warn: 0.95, active: 0.55 });
    } else if (name === 'crows') {
      for (let i = 0; i < 3; ++i)
        shot(b, 'crow', 1340 + i * 90, Math.max(80, Math.min(GROUND_Y - 60, birdY + (i - 1) * 110)), -300, 0, 15);
    }
  }

  function update(b, dt, birdY) {
    b.events.length = 0;
    b.t += dt;
    b.stateT += dt;
    b.flash = Math.max(0, b.flash - dt);
    const def = KINDS[b.kind];

    if (b.state === 'enter') {
      const u = Math.min(1, b.stateT / 1.8);
      const e = 1 - Math.pow(1 - u, 3);
      b.x = 1480 + (def.homeX - 1480) * e;
      b.y = 320 + Math.sin(b.t * def.bobRate) * def.bob * e;
      if (u >= 1) {
        b.state = 'fight';
        b.stateT = 0;
        b.events.push('fight');
      }
    } else if (b.state === 'fight') {
      b.x = def.homeX + Math.sin(b.t * 0.5) * 30;
      b.y = 320 + Math.sin(b.t * def.bobRate * (b.phase2 ? 1.3 : 1)) * def.bob;
      b.atk -= dt;
      if (b.atk <= 0) {
        const list = PATTERNS[b.kind];
        const name = list[b.atkIndex % list.length];
        ++b.atkIndex;
        attack(b, name, birdY);
        b.events.push('attack:' + name);
        b.atk = def.cd * (b.phase2 ? 0.72 : 1);
      }
      b.orbT -= dt;
      if (b.orbT <= 0) {
        b.orbT = b.orbEvery;
        b.orbs.push({ x: 1330, y: 150 + rand(b) * 380, baseY: 0, phase: rand(b) * 6 });
        b.orbs[b.orbs.length - 1].baseY = b.orbs[b.orbs.length - 1].y;
      }
    } else if (b.state === 'dying') {
      b.y += 160 * dt * Math.min(3, b.stateT * 2);
      b.x += 40 * dt;
      if (b.stateT > 2.2) {
        b.state = 'dead';
        b.events.push('dead');
      }
    }

    // projectiles
    for (let i = b.shots.length - 1; i >= 0; --i) {
      const s = b.shots[i];
      s.life -= dt;
      if (s.homing) {
        const a = Math.atan2(birdY - s.y, BIRD_X - s.x);
        const cur = Math.atan2(s.vy, s.vx);
        let d = a - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = Math.max(-s.homing * dt, Math.min(s.homing * dt, d));
        s.vx = Math.cos(cur + turn) * s.speed;
        s.vy = Math.sin(cur + turn) * s.speed;
        if (s.x < BIRD_X - 20)
          s.homing = 0;
      }
      s.vy += s.ay * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.type === 'drone')
        s.y = s.baseY + Math.sin(b.t * s.waveRate + s.phase) * s.wave;
      if (s.life <= 0 || s.x < -60 || s.x > 1400 || s.y > GROUND_Y + 30 || s.y < -120)
        b.shots.splice(i, 1);
    }

    // telegraphed zones: warn first, then active
    for (let i = b.zones.length - 1; i >= 0; --i) {
      const z = b.zones[i];
      if (z.warn > 0) {
        z.warn -= dt;
        if (z.warn <= 0)
          b.events.push('zone:' + z.type);
      } else {
        z.active -= dt;
        if (z.active <= 0)
          b.zones.splice(i, 1);
      }
    }

    // sun orbs drift left on a wave
    for (let i = b.orbs.length - 1; i >= 0; --i) {
      const o = b.orbs[i];
      o.x -= 210 * dt;
      o.y = o.baseY + Math.sin(b.t * 2 + o.phase) * 26;
      if (o.x < -40)
        b.orbs.splice(i, 1);
    }

    // sun bolts fly from the bird to the boss
    for (let i = b.bolts.length - 1; i >= 0; --i) {
      const bolt = b.bolts[i];
      bolt.t += dt;
      const u = Math.min(1, bolt.t / 0.35);
      bolt.x = bolt.x0 + (b.x - bolt.x0) * u;
      bolt.y = bolt.y0 + (b.y - bolt.y0) * u - Math.sin(Math.PI * u) * 80;
      if (u >= 1) {
        b.bolts.splice(i, 1);
        if (b.state === 'fight')
          damage(b, b.dmg);
      }
    }
  }

  function damage(b, n) {
    b.hp = Math.max(0, b.hp - n);
    b.flash = 0.25;
    b.events.push('hit');
    if (!b.phase2 && b.hp <= b.maxHp / 2) {
      b.phase2 = true;
      b.events.push('phase2');
    }
    if (b.hp <= 0) {
      b.state = 'dying';
      b.stateT = 0;
      b.shots.length = 0;
      b.zones.length = 0;
      b.orbs.length = 0;
      b.events.push('defeated');
    }
  }

  function zoneHits(z, x, y, r) {
    if (z.warn > 0)
      return false;
    if (z.type === 'geyser')
      return Math.abs(x - z.x) < z.w / 2 + r && y + r > z.top;
    if (z.type === 'beam')
      return Math.abs(y - z.y) < 9 + r;
    if (z.type === 'bolt')
      return Math.abs(x - z.x) < z.w / 2 + r && y - r < z.bottom;
    return false;
  }

  function collide(b, x, y, r) {
    for (let i = b.orbs.length - 1; i >= 0; --i) {
      const o = b.orbs[i];
      const dx = o.x - x, dy = o.y - y, rr = 30 + r;
      if (dx * dx + dy * dy < rr * rr) {
        b.orbs.splice(i, 1);
        b.bolts.push({ x0: x, y0: y, x: x, y: y, t: 0 });
        return 'orb';
      }
    }
    for (let i = b.shots.length - 1; i >= 0; --i) {
      const s = b.shots[i];
      const dx = s.x - x, dy = s.y - y, rr = s.r + r * 0.85;
      if (dx * dx + dy * dy < rr * rr) {
        b.shots.splice(i, 1);
        return 'shot';
      }
    }
    for (let i = 0; i < b.zones.length; ++i)
      if (zoneHits(b.zones[i], x, y, r * 0.85))
        return 'zone';
    return '';
  }

  /* the boss body itself hurts on contact too, but the bird never gets near it */
  function clone(b) {
    return JSON.parse(JSON.stringify(b));
  }

  SZ.FlappyBoss = Object.freeze({ KINDS, PATTERNS, create, update, damage, collide, zoneHits, clone });
})();
