/* Uno-style games play a round out for the places: the round goes on after the
   first empty hand until min(3, n - 1) players are out, finished players never
   act or get hit again, and the host podium is shown once with the full order.
   Every seat (the player's too) is driven by the variant's own AI.
   Usage: node tests/podium.test.js [id ...] */
'use strict';

const path = require('path');
const { createGame } = require('./harness.js');

const ROOT = path.join(__dirname, '..');
const SEEDS = [3, 11, 29, 47];
const ROUNDS = 3;
const MAX_STEPS = 20000;

/* the registered module of the variant under test (its click handler) */
let MOD = null;

const VARIANTS = {
  uno: { n: 3, hands: 'unoHands', cur: 'unoCurrentPlayer', setup: 'setupUno' },
  unoflip: { n: 3, hands: 'hands', cur: 'currentPlayer', setup: 'setupGame' },
  unowild: { n: 4, hands: 'hands', cur: 'currentPlayer', setup: 'setupGame' },
  liarsuno: { n: 4, hands: 'hands', cur: 'currentPlayer', setup: 'setupGame' },
  unoextreme: { n: 4, hands: 'hands', cur: 'currentPlayer', setup: 'setupGame' },
  unoparty: { n: 6, hands: 'hands', cur: 'currentPlayer', setup: 'setupGame' }
};

function boot(id, seed) {
  const game = createGame(ROOT, { seed });
  const errors = game.load();
  if (errors.length) throw new Error(errors.join(' | '));
  const NS = game.SZ.CardGames;
  const frame = NS.dom.canvas.parentElement;
  frame.clientWidth = 900;
  frame.clientHeight = 600;
  NS.dom.setupCanvas();
  game.frames(3);
  NS.scenes.clear();
  NS.state.skipTitles = true;
  const podiums = [];
  NS.host.showPodium = function(entries, onDone) {
    podiums.push(entries.map(e => Object.assign({}, e)));
    if (onDone) onDone();
  };
  NS.game.selectGame(id);
  game.frames(5);
  return { game, NS, podiums };
}

/* clicks the first button of an overlay the human seat opened */
function clickFirst(V, rects) {
  if (!rects || rects.length === 0) return false;
  const r = rects[0];
  MOD.handleClick(r.x + 2, r.y + 2);
  return true;
}

function resolveOverlay(id, V, S) {
  switch (id) {
    case 'uno':
      if (S.waitingForColorChoice || S.waitingForSwapChoice) {
        V.drawUno();
        return clickFirst(V, S.waitingForSwapChoice ? V.swapChoiceRects : V.colorChoiceRects);
      }
      return false;
    case 'unowild':
      if (S.waitingForTargetChoice || S.waitingForGapChoice) {
        V.drawGame();
        return clickFirst(V, S.waitingForTargetChoice ? V.targetChoiceRects : V.gapChoiceRects);
      }
      return false;
    case 'unoextreme':
      if (S.waitingForColorChoice || S.waitingForTargetChoice) {
        V.drawGame();
        return clickFirst(V, S.waitingForTargetChoice ? V.targetChoiceRects : V.colorChoiceRects);
      }
      return false;
    case 'unoparty':
      if (S.tradeChoiceActive) {
        MOD.handleClick(V.CANVAS_W / 2 - 200 + 4, 234);
        return true;
      }
      return false;
    default:
      return false;
  }
}

/* targets an overlay offers must all still be playing */
function overlayTargets(id, V, S) {
  if (id === 'uno' && S.waitingForSwapChoice) return V.swapChoiceRects.map(r => r.target);
  if ((id === 'unowild' || id === 'unoextreme') && S.waitingForTargetChoice) return V.targetChoiceRects.map(r => r.target);
  if (id === 'unoparty' && S.tradeChoiceActive) return V.tradeTargets();
  return [];
}

function playRound(id, cfg, V, S, podiums, fail) {
  const target = Math.min(3, cfg.n - 1);
  const before = podiums.length;
  let firstOutAt = -1;
  for (let step = 0; step < MAX_STEPS; ++step) {
    if (S.roundOver) break;
    if (S.finished.length > 0 && firstOutAt < 0) firstOutAt = step;
    if (id === 'unowild' || id === 'unoextreme' || id === 'uno' || id === 'unoparty') {
      if (S.waitingForTargetChoice || S.waitingForSwapChoice || S.tradeChoiceActive) {
        if (id === 'unowild') V.drawGame();
        if (id === 'unoextreme') V.drawGame();
        if (id === 'uno') V.drawUno();
        for (const t of overlayTargets(id, V, S))
          if (S.finished.indexOf(t) >= 0) fail('overlay offers finished seat ' + t);
      }
    }
    if (resolveOverlay(id, V, S)) continue;
    const cur = S[cfg.cur];
    if (S.finished.indexOf(cur) >= 0) { fail('finished seat ' + cur + ' is on turn (finished ' + S.finished + ')'); return; }
    V.aiTurn();
    for (const p of S.finished)
      if (S[cfg.hands][p].length !== 0) { fail('finished seat ' + p + ' got cards'); return; }
    if (!S.roundOver && S.finished.indexOf(S[cfg.cur]) >= 0) { fail('turn passed to finished seat ' + S[cfg.cur]); return; }
  }
  if (!S.roundOver) { fail('round did not end within ' + MAX_STEPS + ' steps (finished ' + S.finished + ')'); return; }
  if (S.finished.length !== target) fail('round ended with ' + S.finished.length + ' finished, want ' + target);
  if (firstOutAt < 0 && target > 1) fail('round ended at the first empty hand');
  const order = S.finishOrder || [];
  if (order.length !== cfg.n || new Set(order).size !== cfg.n) fail('finishing order ' + order + ' is not a ranking of ' + cfg.n + ' seats');
  for (let i = 0; i < target; ++i)
    if (order[i] !== S.finished[i]) fail('order does not start with the finishers');
  if (podiums.length !== before + 1) { fail('podium shown ' + (podiums.length - before) + ' times'); return; }
  const entries = podiums[podiums.length - 1];
  if (entries.length !== cfg.n) fail('podium has ' + entries.length + ' entries');
  entries.forEach((e, i) => {
    const p = order[i];
    if (e.isPlayer !== (p === 0)) fail('podium entry ' + i + ' isPlayer mismatch');
    if (e.cards !== S[cfg.hands][p].length) fail('podium entry ' + i + ' cards mismatch');
    if (i < target && e.cards !== 0) fail('finisher with cards on the podium');
    if (typeof e.name !== 'string' || !e.name) fail('podium entry without name');
  });
  if (S.podiumPending) fail('podium result still pending after onDone');
  if (process.env.VERBOSE) console.log('  ' + id + ' order ' + order.join(',') + ' cards ' + entries.map(e => e.cards).join(',') + ' score ' + S.score);
}

function runVariant(id) {
  const cfg = VARIANTS[id];
  const problems = [];
  let rounds = 0;
  for (const seed of SEEDS) {
    let ctx;
    try {
      ctx = boot(id, seed);
    } catch (e) {
      problems.push('seed ' + seed + ': boot ' + e.message);
      continue;
    }
    const V = ctx.NS.v[id];
    const S = V.S;
    MOD = ctx.NS.state.variantModules[id];
    if (id === 'uno' && seed % 2 === 1)
      Object.assign(S.houseRules, { zeroRotate: true, sevenSwap: true, stackPlus2: true, stackPlus4: true, noMercy: seed === 11 });
    for (let r = 0; r < ROUNDS; ++r) {
      const fail = (msg) => problems.push('seed ' + seed + ' round ' + (r + 1) + ': ' + msg);
      try {
        if (r > 0) V[cfg.setup]();
        playRound(id, cfg, V, S, ctx.podiums, fail);
        ctx.game.frames(2);
        ++rounds;
      } catch (e) {
        fail('exception ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e));
      }
      if (typeof S.score !== 'number' || !isFinite(S.score)) fail('variant score ' + S.score);
      if (typeof ctx.NS.state.score !== 'number' || !isFinite(ctx.NS.state.score)) fail('host score ' + ctx.NS.state.score);
    }
  }
  return { rounds, problems };
}

function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VARIANTS);
  let failures = 0;
  for (const id of ids) {
    const r = runVariant(id);
    if (r.problems.length) {
      ++failures;
      console.log('FAIL ' + id + ' (' + r.rounds + ' rounds)');
      for (const p of r.problems.slice(0, 12)) console.log('  ' + p);
    } else
      console.log('PASS ' + id + ' (' + r.rounds + ' rounds)');
  }
  process.exit(failures ? 1 : 0);
}

main();
