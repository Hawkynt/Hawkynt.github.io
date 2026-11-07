/* The five guardian set-pieces. Two are chases - Thornback the boar and Rime's avalanche roar
   up from behind; the runner keeps a lead (boost pads and dashes widen it, stumbles shrink it)
   until the chaser crashes at the end of the stretch. Three are duels - the Dune Wyrm, Warden
   Mk-II and the Hollow King hold position ahead and fire telegraphed volleys (low: jump, high:
   slide), drop spark orbs that the runner fires back, and hide Spark Shards; the King adds a
   chasing shadow wall at half health. Each guardian keeps its own direction (the avalanche
   thunders down a mountain face, the Warden is fought climbing its spire, the King turns the
   world around); Boss Rush hands over to the next guardian with a turn when it runs another
   way. Owns nothing; all state lives in run.bs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const PH = NS.physics;
  const CO = NS.course;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { WORLD_BY_ID, BOSS_NAMES } = NS.worlds;

  const GY = C.GROUND_Y;
  const LOW = GY - 26, HIGH = GY - 66;
  const OS = {};

  /* each duel boss: hit points, attack patterns (lanes of each volley) and its colours */
  const DEF = {
    boar: { chase: true, lenM: 900, rushM: 450, k0: 1.04, k1: 1.08, color: '#9be08a' },
    avalanche: { chase: true, lenM: 1100, rushM: 450, k0: 1.05, k1: 1.09, color: '#e8f4ff' },
    wyrm: { hp: 4, color: '#ffb04a', vx: -340, gap: 0.85, rest: 2.4, pats: [['L', 'L'], ['H', 'L'], ['L', 'H', 'L'], ['H', 'H']] },
    warden: { hp: 5, color: '#ff4ab8', vx: -420, gap: 0.78, rest: 2.1, pats: [['H', 'L', 'H'], ['L', 'L', 'L'], ['H', 'H', 'L'], ['L', 'H', 'L', 'H']] },
    king: { hp: 7, color: '#c08cff', vx: -460, gap: 0.74, rest: 1.9, pats: [['L', 'H', 'L'], ['H', 'L', 'H', 'L'], ['L', 'L', 'H', 'H'], ['H', 'H', 'H']] },
  };

  function start(run, id, rush) {
    const d = DEF[id];
    const p = run.p;
    run.boss = id;
    run.world = WORLD_BY_ID[bossWorld(id)].index;
    run.bs = {
      id: id, chase: !!d.chase, phase: 'intro', t: 0, startX: p.x, lead: 640,
      endX: d.chase ? p.x + (rush ? d.rushM : d.lenM) * C.PX_PER_M : 0,
      hp: d.hp || 0, maxHp: d.hp || 0, atkT: 2.4, pats: 0, queue: [], flinch: 0, shardsOut: 0, wallLead: 900, defeatT: 0,
    };
    run.course.cfg.boss = !d.chase;
    run.course.cfg.boostEvery = d.chase ? 5200 : 0;
    run.course.cfg.world = run.world;
    run.projs.length = 0;
    if (rush && run.rushIdx > 0) NS.stream.addTurn(run, NS.story.BOSS_DIRS[id], NS.story.BOSS_TURN_LINES[id]);
    if (!run.demo) {
      fx.text(p.x + 340, GY - 300, BOSS_NAMES[id], d.color, 40, 2.4);
      sfx('explode', { volume: 0.4, pitch: 0.6 });
      fx.shake(8);
    }
  }

  function bossWorld(id) {
    for (const k in WORLD_BY_ID) if (WORLD_BY_ID[k].boss === id) return k;
    return 'meadow';
  }

  /* where a duel boss hovers in the world this frame */
  function pos(run) {
    const bs = run.bs;
    const p = run.p;
    const t = G.time;
    const intro = bs.phase === 'intro' ? 1 - Math.min(1, bs.t / 1.6) : 0;
    const out = bs.phase === 'defeat' ? Math.min(1, bs.defeatT / 1.6) : 0;
    let y = GY - 250 + Math.sin(t * 1.7) * 26;
    if (bs.id === 'wyrm') y = GY - 150 + Math.sin(t * 1.3) * 40 + (bs.atkT < 1 || bs.flinch > 0 ? -60 : 40);
    if (bs.id === 'king') y = GY - 300 + Math.sin(t * 1.1) * 30;
    /* a vertical view shows less of the way ahead: the guardian hovers closer */
    const ahead = NS.orient.at(run.course.dirs, p.x, null, OS).vert > 0.5 ? 600 : 820;
    return { x: p.x + ahead + Math.sin(t * 0.9) * 40 + intro * 700, y: y - intro * 200 + out * 500 };
  }

  function lane(ch) {
    return ch === 'L' ? LOW : HIGH;
  }

  function fire(run, y) {
    const d = DEF[run.bs.id];
    const p = run.p;
    run.projs.push({ kind: 'proj', id: ++run.course.uid, x: p.x + 1180, y: y, w: 46, h: 30, vx: d.vx, look: run.bs.id, smash: 1 });
    if (!run.demo) sfx(run.bs.id === 'warden' ? 'laser' : 'shoot', { volume: 0.45, pitch: y === LOW ? 0.8 : 1.2 });
  }

  function update(run, dt) {
    const bs = run.bs;
    if (!bs) return;
    const p = run.p;
    const d = DEF[bs.id];
    bs.t += dt;
    if (bs.flinch > 0) bs.flinch -= dt;
    /* projectiles fly; gone when behind */
    for (let i = run.projs.length - 1; i >= 0; --i) {
      const q = run.projs[i];
      q.x += q.vx * dt;
      if (q.dead || q.x < p.x - 500) run.projs.splice(i, 1);
    }
    for (let i = run.bolts.length - 1; i >= 0; --i) {
      const b = run.bolts[i];
      b.t += dt * 1.6;
      if (b.t >= 1) { run.bolts.splice(i, 1); hurt(run); }
    }
    if (bs.phase === 'defeat') {
      bs.defeatT += dt;
      if (bs.defeatT > 1.8) { bs.phase = 'gone'; next(run); }
      return;
    }
    if (bs.phase === 'gone') return;
    if (bs.phase === 'intro' && bs.t > 1.8) bs.phase = 'fight';
    if (bs.chase || (bs.id === 'king' && bs.hp <= bs.maxHp / 2)) chase(run, dt, d);
    if (bs.chase) {
      if (p.x >= bs.endX) defeat(run);
      return;
    }
    if (bs.phase !== 'fight') return;
    /* telegraphed volleys */
    for (let i = bs.queue.length - 1; i >= 0; --i) {
      const q = bs.queue[i];
      q.t -= dt;
      if (q.t <= 0) { fire(run, q.y); bs.queue.splice(i, 1); }
    }
    bs.atkT -= dt;
    if (bs.atkT <= 0 && !bs.queue.length) {
      const pat = d.pats[(bs.pats + Math.floor(bs.t)) % d.pats.length];
      const speedUp = 1 - 0.25 * (1 - bs.hp / bs.maxHp);
      /* spacing a human can follow: a jump then a slide needs the jump to land first */
      let at = 0.75;
      for (let i = 0; i < pat.length; ++i) {
        if (i) at += Math.max(d.gap * speedUp, pat[i - 1] === 'L' && pat[i] === 'H' ? 1.0 : pat[i - 1] !== pat[i] ? 0.7 : 0.55);
        bs.queue.push({ t: at, y: lane(pat[i]) });
      }
      ++bs.pats;
      bs.atkT = at + d.rest * speedUp;
      if (bs.pats % 2 === 0) dropOrb(run);
      if (bs.pats % 3 === 1 && bs.shardsOut < 3) {
        NS.stream.addItem(run, 'shard', p.x + 1500, GY - 270, { n: bs.shardsOut });
        ++bs.shardsOut;
      }
    }
  }

  /* the chaser's (or the shadow wall's) distance behind the runner */
  function chase(run, dt, d) {
    const bs = run.bs;
    const p = run.p;
    const env = NS.stream.get(run);
    const v = env.speedAt(p.x);
    const prog = bs.endX ? Math.min(1, (p.x - bs.startX) / (bs.endX - bs.startX)) : 0.5;
    const k = bs.chase ? d.k0 + (d.k1 - d.k0) * prog : 1.02;
    const mine = p.fly ? v * 1.6 : PH.speedOf(p, env);
    const key = bs.chase ? 'lead' : 'wallLead';
    if (bs.phase === 'intro') return;
    bs[key] = Math.min(900, bs[key] + (mine - v * k) * dt);
    if (bs[key] <= 0 && run.phase === 'play') {
      if (run.mode === 'zen' || run.demo || run.shieldHits > 0) {
        if (run.shieldHits > 0) { --run.shieldHits; if (run.shieldHits <= 0) run.pw.shield = 0; }
        bs[key] = 420;
        fx.shake(10);
        sfx('hit');
        return;
      }
      NS.player.die(run, 'caught');
    } else if (bs[key] < 220 && !run.demo && Math.floor(G.time * 3) !== Math.floor((G.time - dt) * 3)) sfx('thud', { volume: 0.3, pitch: 0.7 });
  }

  function stumble(run, amount) {
    if (run.bs) run.bs.lead -= amount;
  }

  function boost(run) {
    if (run.bs && run.bs.chase) fx.text(run.p.x, run.p.y - 120, 'Lead +', '#ffd24a', 22, 0.8);
  }

  function dropOrb(run) {
    const p = run.p;
    NS.stream.addItem(run, 'orb', p.x + 1250, GY - 70);
  }

  /* a spark orb was grabbed: a bolt flies at the boss */
  function orb(run, it) {
    const p = run.p;
    if (!run.bs || run.bs.chase) return;
    run.bolts.push({ x0: p.x, y0: p.y - 40, t: 0 });
    fx.burst(it.x, it.y, 20, ['#5ee0ff', '#ffffff'], 360, 0.5, 14);
    sfx('zap', { pitch: 0.8 });
  }

  function hurt(run) {
    const bs = run.bs;
    if (!bs || bs.phase === 'defeat' || bs.phase === 'gone') return;
    --bs.hp;
    bs.flinch = 0.5;
    const b = pos(run);
    fx.burst(b.x, b.y, 40, [DEF[bs.id].color, '#ffffff', '#ffd24a'], 600, 0.8, 18);
    fx.ring(b.x, b.y, 20, 220, 0.5, '#ffffff', 10);
    fx.shake(14);
    fx.flash('#ffffff', 0.35);
    fx.hitstop(0.1);
    sfx('explode', { volume: 0.6 });
    if (!run.demo) NS.run.addScore(run, 500, b.x, b.y - 80, '#ffd24a');
    if (bs.hp <= 0) defeat(run);
    else if (bs.id === 'king' && bs.hp === Math.floor(bs.maxHp / 2) && !run.demo) {
      fx.text(run.p.x + 200, GY - 320, 'The shadow wall rises!', '#c08cff', 30, 2);
      bs.wallLead = 760;
    }
  }

  function defeat(run) {
    const bs = run.bs;
    bs.phase = 'defeat';
    bs.defeatT = 0;
    run.projs.length = 0;
    bs.queue.length = 0;
    const p = run.p;
    const b = bs.chase ? { x: p.x - NS.actors.chaserGap(bs.lead), y: GY - 80 } : pos(run);
    G.slowmo = Math.max(G.slowmo, 1.4);
    fx.burst(b.x, b.y, 80, [DEF[bs.id].color, '#ffffff', '#ffd24a', '#ff6ad5'], 900, 1.4, 22);
    fx.ring(b.x, b.y, 30, 500, 0.9, '#ffffff', 14);
    fx.shake(22);
    fx.flash('#ffffff', 0.7);
    if (!run.demo) sfx('win');
    NS.progress.bossBeaten(run, bs.id);
  }

  /* after a defeat: Boss Rush moves on; otherwise the stage is won */
  function next(run) {
    if (run.mode === 'rush' && run.rushIdx < run.rush.length - 1) {
      ++run.rushIdx;
      start(run, run.rush[run.rushIdx], true);
      return;
    }
    run.bs.phase = 'gone';
    if (!run.demo) NS.run.finish(run);
  }

  Object.assign(NS.bosses, {
    DEF, LOW, HIGH, start, update, pos, stumble, boost, orb, hurt, defeat
  });
})();
