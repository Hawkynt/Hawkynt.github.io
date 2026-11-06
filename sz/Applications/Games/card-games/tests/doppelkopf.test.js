/* Doppelkopf rules, scoring and headless play.
   Usage: node tests/doppelkopf.test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['state', 'rules', 'ai', 'flow', 'render', 'input', 'index'];

let failures = 0;
let passes = 0;
function check(cond, name) {
  if (cond) ++passes;
  else {
    ++failures;
    console.log('FAIL ' + name);
  }
}

function load() {
  const registered = {};
  const window = { SZ: { CardGames: { registerVariant(id, mod) { registered[id] = mod; } } } };
  const sandbox = { window, Math, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/engine/core.js'), 'utf8'), sandbox, { filename: 'core.js' });
  const CE = window.SZ.CardEngine;
  const noop = () => {};
  Object.assign(CE, { drawCardFace: noop, drawCardBack: noop, drawHintGlow: noop, drawButton: noop, drawEmptySlot: noop, drawRoundedRect: noop });
  for (const f of FILES)
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/variants/doppelkopf', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
  return { V: window.SZ.CardGames.v.doppelkopf, CE, mod: registered.doppelkopf };
}

const { V, CE, mod } = load();
const S = V.S;
const C = (suit, rank) => CE.makeCard(suit, rank);
const names = cards => cards.map(c => c.rank + c.suit[0]).join(' ');

/* ---- trump ordering ---- */
{
  const order = [
    C('hearts', '10'), C('clubs', 'Q'), C('spades', 'Q'), C('hearts', 'Q'), C('diamonds', 'Q'),
    C('clubs', 'J'), C('spades', 'J'), C('hearts', 'J'), C('diamonds', 'J'),
    C('diamonds', 'A'), C('diamonds', '10'), C('diamonds', 'K'), C('diamonds', '9')
  ];
  for (let i = 0; i < order.length; ++i) {
    check(V.isTrump(order[i]), 'trump ' + names([order[i]]));
    if (i > 0) {
      check(V.beats(order[i - 1], order[i]), names([order[i - 1]]) + ' beats ' + names([order[i]]));
      check(!V.beats(order[i], order[i - 1]), names([order[i]]) + ' loses to ' + names([order[i - 1]]));
    }
  }
  check(!V.isTrump(C('hearts', 'A')) && !V.isTrump(C('clubs', '10')) && !V.isTrump(C('spades', 'K')), 'plain cards are not trump');
  check(V.beats(C('diamonds', '9'), C('clubs', 'A')), 'lowest trump beats plain ace');
  check(V.beats(C('clubs', '10'), C('clubs', 'K')) && V.beats(C('clubs', 'A'), C('clubs', '10')) && V.beats(C('clubs', 'K'), C('clubs', '9')), 'plain order A 10 K 9');
  check(!V.beats(C('spades', 'A'), C('clubs', '9')), 'off-suit card never wins');
  const d1 = C('hearts', '10');
  const d2 = C('hearts', '10');
  check(V.winningIndex([d1, C('clubs', 'Q'), d2, C('diamonds', '9')]) === 2, 'second Dulle beats the first');
  check(V.winningIndex([C('clubs', 'Q'), d1, C('spades', 'Q'), C('diamonds', 'A')]) === 1, 'Dulle beats Q of clubs');
}

/* ---- identical cards: first played wins ---- */
{
  check(V.winningIndex([C('clubs', 'Q'), C('clubs', 'Q'), C('diamonds', '9'), C('hearts', 'J')]) === 0, 'first Q of clubs wins over the second');
  check(V.winningIndex([C('spades', '9'), C('spades', 'A'), C('spades', 'A'), C('spades', '10')]) === 1, 'first of two plain aces wins');
  check(V.winningIndex([C('hearts', 'K'), C('hearts', 'A'), C('clubs', 'A'), C('hearts', '9')]) === 1, 'led suit wins, off-suit ignored');
}

/* ---- follow-suit legality ---- */
{
  const hand = [C('hearts', '10'), C('hearts', 'A'), C('clubs', 'K'), C('spades', '9')];
  const heartLead = [C('hearts', 'K')];
  check(V.isValidPlay(hand[1], hand, heartLead), 'hearts follow allowed');
  check(!V.isValidPlay(hand[0], hand, heartLead), '10 of hearts is not a heart when hearts are led');
  check(!V.isValidPlay(hand[2], hand, heartLead), 'must follow hearts');
  const trumpLead = [C('diamonds', '9')];
  check(V.isValidPlay(hand[0], hand, trumpLead), '10 of hearts follows a trump lead');
  check(!V.isValidPlay(hand[1], hand, trumpLead), 'heart ace does not follow trump');
  const qLead = [C('spades', 'Q')];
  check(V.isValidPlay(hand[0], hand, qLead) && !V.isValidPlay(hand[3], hand, qLead), 'Q of spades leads trump, not spades');
  const hand2 = [C('clubs', 'J'), C('hearts', '9')];
  check(V.isValidPlay(hand2[0], hand2, [C('spades', 'A')]) && V.isValidPlay(hand2[1], hand2, [C('spades', 'A')]), 'void in spades plays anything');
  const hand3 = [C('diamonds', 'J'), C('spades', 'A')];
  check(!V.isValidPlay(hand3[1], hand3, [C('hearts', '10')]) && V.isValidPlay(hand3[0], hand3, [C('hearts', '10')]), 'Dulle lead demands trump');
  check(V.validIndices(hand, []).length === 4, 'leading allows anything');
}

/* ---- scoring ---- */
function trick(cards, players, winner) { return { cards, players, winner }; }
/* a trick worth exactly `pts`, without clubs (no Karlchen) or diamonds (no fox) */
function pointsTrick(pts, winner) {
  const ranks = ['A', '10', 'K', 'Q', 'J', '9'];
  const suits = ['spades', 'hearts', 'spades', 'hearts'];
  for (const a of ranks) for (const b of ranks) for (const c of ranks) for (const d of ranks) {
    const cards = [a, b, c, d];
    if (cards.reduce((s, r) => s + V.CARD_POINTS[r], 0) === pts)
      return trick(cards.map((r, i) => C(suits[i], r)), [0, 1, 2, 3], winner);
  }
  throw new Error('cannot build trick of ' + pts);
}
/* 12 tricks: reTricks won by seat reSeat worth rePts in total, the rest by kontraSeat */
function round(reSeat, kontraSeat, rePts, reTricks) {
  reTricks = reTricks === undefined ? 6 : reTricks;
  const split = (total, n) => {
    const out = [];
    for (let i = 0; i < n; ++i) {
      let v = Math.min(36, total);
      if (total - v === 1) v -= 2;
      out.push(v);
      total -= v;
    }
    if (total) throw new Error('split overflow');
    return out;
  };
  return split(rePts, reTricks).map(v => pointsTrick(v, reSeat))
    .concat(split(240 - rePts, 12 - reTricks).map(v => pointsTrick(v, kontraSeat)));
}
const sumOf = (ts, pred) => ts.filter(t => pred(t.winner)).reduce((a, t) => a + V.sumPoints(t.cards), 0);
/* adjust plain tricks so the party `pred` totals `target` again (after a special trick was placed) */
function balanceSide(ts, pred, target, skip) {
  let diff = target - sumOf(ts, pred);
  for (let i = 0; i < ts.length && diff; ++i) {
    if (skip.indexOf(i) >= 0 || !pred(ts[i].winner)) continue;
    const cur = V.sumPoints(ts[i].cards);
    let want = Math.max(0, Math.min(36, cur + diff));
    if (want === 1) want = diff > 0 ? 0 : 2;
    diff -= want - cur;
    ts[i] = pointsTrick(want, ts[i].winner);
  }
  if (diff) throw new Error('balance failed');
}
function balance(ts, pred, target, skip) {
  balanceSide(ts, pred, target, skip);
  balanceSide(ts, w => !pred(w), 240 - target, skip);
  check(sumOf(ts, () => true) === 240, 'fixture totals 240');
  return ts;
}
{
  const re = [true, true, false, false];
  const isRe = w => w < 2;
  const has = (r, label, party) => r.lines.some(l => l.label === label && (!party || l.party === party));

  let ts = round(0, 2, 121);
  let r = V.scoreRound(re, -1, ts);
  check(r.reWins && r.rePoints === 121 && r.value === 1, 'Re wins with 121: value 1 (got ' + r.value + ')');
  check(r.playerScores.join() === '1,1,-1,-1', 'Re players +1, Kontra -1');

  r = V.scoreRound(re, -1, round(0, 2, 120));
  check(!r.reWins && r.kontraPoints === 120 && r.value === 2, 'Kontra wins with 120: won + gegen die Alten = 2 (got ' + r.value + ')');
  check(r.playerScores.join() === '-2,-2,2,2', 'Kontra scores');

  r = V.scoreRound(re, -1, round(0, 2, 151));
  check(r.value === 2 && has(r, 'Keine 90'), 'keine 90 (Kontra 89): 2 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 150));
  check(r.value === 1, 'Kontra 90 is not keine 90');
  r = V.scoreRound(re, -1, round(0, 2, 181));
  check(r.value === 3, 'keine 60: 3 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 211, 8));
  check(r.value === 4, 'keine 30: 4 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 240, 12));
  check(r.value === 5 && has(r, 'Schwarz'), 'schwarz: 5 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 240, 11));
  check(r.value === 4 && !has(r, 'Schwarz'), 'a zero-point trick avoids schwarz: 4 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 60));
  check(!r.reWins && r.value === 3, 'Kontra wins, Re 60: won + alten + keine 90 = 3 (got ' + r.value + ')');
  r = V.scoreRound(re, -1, round(0, 2, 59));
  check(!r.reWins && r.value === 4, 'Kontra wins, Re 59: + keine 60 = 4 (got ' + r.value + ')');

  /* Fuchs: Kontra (seat 2) plays the A of diamonds, Re (seat 0) wins the trick */
  ts = round(0, 2, 121);
  ts[0] = trick([C('clubs', 'Q'), C('spades', '9'), C('diamonds', 'A'), C('spades', '9')], [0, 1, 2, 3], 0);
  balance(ts, isRe, 121, [0]);
  r = V.scoreRound(re, -1, ts);
  check(r.rePoints === 121 && has(r, 'Fuchs gefangen', 're') && r.value === 2, 'won + Fuchs = 2 (got ' + r.value + ')');

  /* a fox kept by its own party is not caught */
  ts[0] = trick([C('clubs', 'Q'), C('diamonds', 'A'), C('spades', '9'), C('spades', '9')], [0, 1, 2, 3], 0);
  r = V.scoreRound(re, -1, ts);
  check(!has(r, 'Fuchs gefangen'), 'own fox is not caught');

  /* a fox caught by the losing party offsets the winner */
  ts = round(0, 2, 121);
  ts[11] = trick([C('diamonds', 'A'), C('spades', '9'), C('hearts', '10'), C('spades', '9')], [0, 1, 2, 3], 2);
  balance(ts, isRe, 121, [11]);
  r = V.scoreRound(re, -1, ts);
  check(r.reWins && has(r, 'Fuchs gefangen', 'kontra') && r.value === 0, 'Kontra fox offsets the Re win: value 0 (got ' + r.value + ')');

  /* Karlchen: last trick won with the J of clubs */
  ts = round(0, 2, 121);
  ts[11] = trick([C('spades', '9'), C('spades', '9'), C('clubs', 'J'), C('spades', '9')], [0, 1, 2, 3], 2);
  balance(ts, isRe, 121, [11]);
  r = V.scoreRound(re, -1, ts);
  check(has(r, 'Karlchen', 'kontra') && r.value === 0, 'Karlchen for Kontra offsets Re (got ' + r.value + ')');
  ts[11] = trick([C('clubs', 'J'), C('spades', '9'), C('clubs', 'Q'), C('spades', '9')], [0, 1, 2, 3], 2);
  balance(ts, isRe, 121, [11]);
  r = V.scoreRound(re, -1, ts);
  check(!has(r, 'Karlchen'), 'J of clubs that does not win the last trick is no Karlchen');
  ts[11] = trick([C('spades', '9'), C('clubs', 'J'), C('spades', '9'), C('spades', '9')], [0, 1, 2, 3], 1);
  balance(ts, isRe, 121, [11]);
  r = V.scoreRound(re, -1, ts);
  check(has(r, 'Karlchen', 're') && r.value === 2, 'Karlchen for Re: 2 (got ' + r.value + ')');

  /* Doppelkopf: a trick of 40+ points */
  ts = round(0, 2, 121);
  r = V.scoreRound(re, -1, ts);
  check(!has(r, 'Doppelkopf'), 'no Doppelkopf below 40');
  ts[0] = trick([C('clubs', 'A'), C('spades', 'A'), C('hearts', 'A'), C('clubs', '10')], [0, 1, 2, 3], 0);
  balance(ts, isRe, 121, [0]);
  r = V.scoreRound(re, -1, ts);
  check(r.lines.filter(l => l.label === 'Doppelkopf' && l.party === 're').length === 1 && r.value === 2, 'Doppelkopf +1 (got ' + r.value + ')');
  ts[0] = trick([C('clubs', 'A'), C('spades', 'A'), C('hearts', 'A'), C('clubs', '9')], [0, 1, 2, 3], 0);
  balance(ts, isRe, 121, [0]);
  r = V.scoreRound(re, -1, ts);
  check(!has(r, 'Doppelkopf'), '33-point trick is no Doppelkopf');

  /* silent solo: seat 1 alone, triple for the soloist, no extra points */
  const solo = [false, true, false, false];
  const isSolo = w => w === 1;
  ts = round(1, 3, 181);
  ts[0] = trick([C('diamonds', 'A'), C('clubs', 'Q'), C('spades', '9'), C('spades', '9')], [0, 1, 2, 3], 1);
  balance(ts, isSolo, 181, [0]);
  r = V.scoreRound(solo, 1, ts);
  check(r.isSolo && r.reWins && r.value === 3, 'solo keine 60: value 3 (got ' + r.value + ')');
  check(r.playerScores.join() === '-3,9,-3,-3', 'soloist gets triple: ' + r.playerScores.join());
  check(!has(r, 'Fuchs gefangen'), 'no extra points in a solo');
  r = V.scoreRound(solo, 1, round(1, 3, 100));
  check(!r.reWins && r.value === 1 && r.playerScores.join() === '1,-3,1,1', 'soloist loses triple: ' + r.playerScores.join());
}

/* ---- sorting ---- */
{
  const hand = [C('hearts', 'A'), C('diamonds', '9'), C('clubs', '10'), C('hearts', '10'), C('spades', 'A'), C('clubs', 'Q'), C('clubs', 'A'), C('hearts', '9')];
  V.sortHand(hand);
  check(names(hand) === '10h Qc 9d Ac 10c As Ah 9h', 'sortHand: ' + names(hand));
}

/* ---- headless play ---- */
const host = {
  score: 100,
  roundOvers: [],
  hintsEnabled: true,
  hintTime: 0,
  floatingText: { add() {} },
  getScore() { return this.score; },
  onScoreChanged(s) { this.score = s; },
  onRoundOver(isGameOver) { this.roundOvers.push(isGameOver); },
  dealCardAnim() {}
};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

function playRoundHeadless(useInput) {
  let guard = 0;
  let trickCount = 0;
  while (S.phase !== V.PHASE_ROUND_OVER && ++guard < 5000) {
    mod.draw(ctx, 900, 600);
    if (S.phase === V.PHASE_TRICK_DONE) {
      ++trickCount;
      if (useInput) mod.handleClick(450, 300);
      else V.finishTrick();
      continue;
    }
    const p = S.currentTurn;
    const before = S.hands.reduce((a, h) => a + h.length, 0);
    const idx = V.aiChooseCard(p);
    if (!V.isValidPlay(S.hands[p][idx], S.hands[p], S.trickCards)) {
      check(false, 'AI produced an illegal play');
      return -1;
    }
    if (p === 0 && useInput) mod.handleKey({ key: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='][idx] });
    else if (p === 0 || !useInput) V.playCard(p, idx);
    else mod.tick(1);
    const after = S.hands.reduce((a, h) => a + h.length, 0);
    if (after !== before - 1) {
      check(false, 'a card was not played (seat ' + p + ')');
      return -1;
    }
  }
  mod.draw(ctx, 900, 600);
  return trickCount;
}

{
  mod.setup(ctx, null, 900, 600, host);
  check(S.hands.every(h => h.length === 12), 'deal: 12 cards each');
  const all = [].concat.apply([], S.hands);
  check(all.length === 48 && new Set(all).size === 48, '48 distinct card objects');
  check(all.filter(V.isQueenOfClubs).length === 2, 'two Q of clubs in play');
  check(S.re.filter(Boolean).length === (S.soloist >= 0 ? 1 : 2), 'Re party from Q of clubs');
  const tricks = playRoundHeadless(true);
  check(tricks === 12 && S.tricks.length === 12, 'round completes 12 tricks via input/tick (' + tricks + ')');
  const total = S.tricks.reduce((a, t) => a + V.sumPoints(t.cards), 0);
  check(total === 240, 'card points total 240 (' + total + ')');
  check(S.result.rePoints + S.result.kontraPoints === 240, 'Re + Kontra = 240');
  check(S.result.playerScores.reduce((a, b) => a + b, 0) === 0, 'round scores are zero-sum');
  check(host.score === 100 + S.result.playerScores[0] * 10, 'host score updated by round result x10');
  console.log('  round 1: Re ' + S.result.rePoints + ' / Kontra ' + S.result.kontraPoints + ', value ' + S.result.value + ' [' + S.result.lines.map(l => l.label + ':' + l.party).join(', ') + '] scores ' + S.result.playerScores.join(' '));
  mod.handleClick(450, 300);
  check(host.roundOvers.length === 1 && host.roundOvers[0] === false, 'onRoundOver(false) after round 1');
  mod.handleClick(450, 300);
  check(host.roundOvers.length === 1, 'round reported to the host only once');
}

{
  /* the host re-runs cleanup + setup for each further round */
  let rounds = 1;
  let dealers = [S.dealer];
  let solos = 0;
  while (!S.gameOver && rounds < 20) {
    mod.cleanup();
    mod.setup(ctx, null, 900, 600, host);
    dealers.push(S.dealer);
    if (S.soloist >= 0) ++solos;
    const t = playRoundHeadless(false);
    check(t === 12 && S.tricks.length === 12, 'round ' + (rounds + 1) + ' completes 12 tricks');
    const total = S.tricks.reduce((a, tr) => a + V.sumPoints(tr.cards), 0);
    check(total === 240, 'round ' + (rounds + 1) + ' totals 240');
    ++rounds;
    mod.handleClick(450, 300);
  }
  check(rounds === 8 && S.gameOver, 'match ends after 8 rounds (' + rounds + ')');
  check(dealers.every((d, i) => i === 0 || d === (dealers[i - 1] + 1) % 4), 'dealer rotates: ' + dealers.join(''));
  check([0, 1, 2, 3].every(p => dealers.filter(d => d === p).length === 2), 'each player deals twice');
  check(host.roundOvers.length === 8 && host.roundOvers[7] === true && host.roundOvers.slice(0, 7).every(x => x === false), 'onRoundOver: 7x false then true');
  const sumTotals = S.cumulativeScores.reduce((a, b) => a + b, 0);
  check(sumTotals === 0, 'match totals zero-sum');
  console.log('  match: totals ' + S.cumulativeScores.join(' ') + ', host score ' + host.score + ', silent solos ' + solos);

  /* a new match starts afterwards */
  mod.cleanup();
  mod.setup(ctx, null, 900, 600, host);
  check(S.roundNumber === 0 && !S.gameOver && S.cumulativeScores.every(x => x === 0), 'fresh match after game over');
}

{
  /* many AI rounds: legality and point totals hold */
  let bad = 0;
  for (let i = 0; i < 200; ++i) {
    S.continueMatch = false;
    mod.setup(ctx, null, 900, 600, host);
    playRoundHeadless(false);
    const total = S.tricks.reduce((a, tr) => a + V.sumPoints(tr.cards), 0);
    if (S.tricks.length !== 12 || total !== 240) ++bad;
  }
  check(bad === 0, '200 random rounds all valid');
}

console.log((failures ? 'FAIL' : 'PASS') + ' doppelkopf: ' + passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
