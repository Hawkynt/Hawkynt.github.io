/* Versus: a race against a CPU surveyor on the same field. Both fields are placed from the same
   seed around the same opening click in the middle, which is opened for both, so the race is fair;
   the first to clear wins. A mine does not end the race - it stuns its finder for a few seconds
   and is defused. The rival is the solver bot playing at one of four speeds (Rookie, Pro, Ace,
   Legend): it thinks before every move, Rookie and Pro stop to "re-read" the field now and then,
   and Rival Notes in the tech tree hold it back for a moment at the start. Its choices come from
   its own seeded generator, so a race replays the same. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const E = NS.engine;
  const BOT = NS.bot;
  const { makeRng } = NS.rng;

  const CPUS = [
    { id: 'rookie', name: 'Rookie', think: 1.15, pause: 0.12, pauseT: 2.5, color: '#7be08a' },
    { id: 'pro', name: 'Pro', think: 0.62, pause: 0.06, pauseT: 1.6, color: '#5ad0ff' },
    { id: 'ace', name: 'Ace', think: 0.36, pause: 0.02, pauseT: 1, color: '#ffb14a' },
    { id: 'legend', name: 'Legend', think: 0.2, pause: 0, pauseT: 0, color: '#ff5a8a' },
  ];
  const CPU_BY_ID = {};
  for (const c of CPUS) CPU_BY_ID[c.id] = c;
  const STUN = 4;

  function rnd(vs) {
    const r = makeRng(vs.rng);
    const v = r.next();
    vs.rng = r.s;
    return v;
  }

  /* places both fields around the middle and opens it for both */
  function attach(run, cpu, opts, delay) {
    const def = CPU_BY_ID[cpu] || CPUS[1];
    const g = run.game;
    const start = Math.floor(g.h / 2) * g.w + Math.floor(g.w / 2);
    const rival = E.create(Object.assign({}, opts, { gems: 0, chests: 0, lives: 0 }));
    E.reveal(g, start);
    E.reveal(rival, start);
    E.takeEvents(rival);
    run.rival = rival;
    run.vs = { cpu: def.id, wait: def.think + (delay || 0), rng: (g.rng ^ 0x9e3779b9) >>> 0, stunYou: 0, stunRival: 0, rivalMines: 0, youMines: 0 };
    run.kind = 'versus';
    return run;
  }

  /* a mine in a race: defused, and its finder stunned */
  function onBoom(run, who, i) {
    const g = who === 'you' ? run.game : run.rival;
    g.state = 'play';
    g.hit = -1;
    g.defused[i] = 1;
    g.flag[i] = 1;
    if (who === 'you') { run.vs.stunYou = STUN; ++run.vs.youMines; }
    else { run.vs.stunRival = STUN; ++run.vs.rivalMines; }
    run.events.push({ type: 'stun', who: who, i: i });
  }

  function step(run, dt) {
    const vs = run.vs, g = run.rival, def = CPU_BY_ID[vs.cpu];
    vs.stunYou = Math.max(0, vs.stunYou - dt);
    if (vs.stunRival > 0) { vs.stunRival = Math.max(0, vs.stunRival - dt); return; }
    E.step(g, dt);
    if (!E.playing(g)) return;
    vs.wait -= dt;
    if (vs.wait > 0) return;
    vs.wait = def.think * (0.75 + rnd(vs) * 0.5);
    if (def.pause && rnd(vs) < def.pause) vs.wait += def.pauseT;
    const a = BOT.next(g);
    const r = BOT.act(g, a);
    for (const e of E.takeEvents(g)) run.events.push({ type: 'rival', ev: e });
    if (r === 'boom') onBoom(run, 'rival', a.i);
  }

  /* -> 'you' | 'rival' | '' */
  function winner(run) {
    if (run.game.state === 'won') return 'you';
    if (run.rival.state === 'won') return 'rival';
    return '';
  }

  Object.assign(NS.versus, { CPUS, CPU_BY_ID, STUN, attach, onBoom, step, winner });
})();
