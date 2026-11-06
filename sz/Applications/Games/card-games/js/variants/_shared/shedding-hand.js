/* Shedding games: hand sorting and draw-pile helpers shared by the Uno-style
   variants and the suit-based shedding games (Crazy Eights, Mau-Mau). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  /* colour cards: by colour, then number/action/wild, then value */
  function sortColorHand(hand) {
    const co = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    const to = { number: 0, action: 1, wild: 2 };
    hand.sort((a, b) => {
      const cd = (co[a.color] ?? 4) - (co[b.color] ?? 4);
      if (cd !== 0) return cd;
      const td = (to[a.type] ?? 2) - (to[b.type] ?? 2);
      if (td !== 0) return td;
      const av = parseInt(a.value) || 0, bv = parseInt(b.value) || 0;
      return av - bv || String(a.value).localeCompare(String(b.value));
    });
  }

  /* French cards: by suit, then value */
  function sortSuitHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  /* S is the variant state holding deck, discardPile and hands */
  function refillDeck(S) {
    if (S.deck.length > 0) return;
    if (S.discardPile.length <= 1) return;
    const top = S.discardPile.pop();
    S.deck = CE.shuffle(S.discardPile);
    S.discardPile = [top];
  }

  function drawCards(S, playerIndex, count) {
    for (let i = 0; i < count; ++i) {
      refillDeck(S);
      if (S.deck.length > 0)
        S.hands[playerIndex].push(S.deck.pop());
    }
  }

  SZ.CardGames.shared.sheddingHand = { sortColorHand, sortSuitHand, refillDeck, drawCards };

  /* ================================================================
     PLAYING FOR PLACES (Uno-style games)
     A player who empties the hand leaves the turn order and is recorded in
     S.finished; the round ends once min(3, n - 1) players are out. The rest
     are ranked by cards left, then card points, then seat, the finishing
     order goes to the host podium and the variant settles its scoring after
     the podium is clicked away.
     ================================================================ */

  const PLACE_COLORS = ['#ffd54f', '#d0d8e0', '#d08a4a'];

  function ordinal(n) {
    const t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    return n + (n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
  }

  function placeColor(place) {
    return PLACE_COLORS[place - 1] || '#aaa';
  }

  function resetPlaces(S) {
    S.finished = [];
    S.finishOrder = null;
    S.podiumPending = false;
    S._podiumSettle = null;
  }

  function isFinished(S, p) {
    return !!S.finished && S.finished.indexOf(p) >= 0;
  }

  /* 1-based place of a player who already finished, 0 otherwise */
  function placeOf(S, p) {
    return S.finished ? S.finished.indexOf(p) + 1 : 0;
  }

  function finishTarget(n) {
    return Math.min(3, n - 1);
  }

  function activeCount(S, n) {
    return n - (S.finished ? S.finished.length : 0);
  }

  /* next seat in direction dir that still plays; from itself may be finished */
  function nextActive(S, from, dir, n) {
    let p = from;
    for (let i = 0; i < n; ++i) {
      p = ((p + dir) % n + n) % n;
      if (!isFinished(S, p)) return p;
    }
    return from;
  }

  /* records p as finished when the hand is empty; returns true when that
     completes the round (the caller then ends it via presentPodium) */
  function recordFinish(S, p, hand, n, name, x, y) {
    if (hand.length > 0 || isFinished(S, p)) return false;
    if (!S.finished) S.finished = [];
    S.finished.push(p);
    const place = S.finished.length;
    if (S._host && S._host.floatingText)
      S._host.floatingText.add(x, y, (p === 0 ? 'You finish ' : name + ' finishes ') + ordinal(place) + '!', { color: placeColor(place), size: 22 });
    if (S._host && S._host.particles && S._host.particles.sparkle)
      S._host.particles.sparkle(x, y, 16, { color: placeColor(place), speed: 70, life: 0.7 });
    return S.finished.length >= finishTarget(n);
  }

  /* full finishing order: the finishers, then the rest by fewest cards,
     fewer card points (pointsOf(card), optional) and seat */
  function rankRest(S, hands, n, pointsOf) {
    const order = (S.finished || []).slice();
    const rest = [];
    for (let p = 0; p < n; ++p)
      if (order.indexOf(p) < 0) rest.push(p);
    const pts = (p) => {
      if (!pointsOf) return 0;
      let t = 0;
      for (const c of hands[p]) t += pointsOf(c);
      return t;
    };
    rest.sort((a, b) => (hands[a].length - hands[b].length) || (pts(a) - pts(b)) || (a - b));
    return order.concat(rest);
  }

  /* ends the round: ranks everybody, shows the podium and calls
     settle(winner, order) once it is clicked away (at once without a host) */
  function presentPodium(S, hands, n, names, pointsOf, settle) {
    S.roundOver = true;
    S.finishOrder = rankRest(S, hands, n, pointsOf);
    S.podiumPending = true;
    S._podiumSettle = settle;
    const order = S.finishOrder;
    const done = () => { settlePending(S); };
    if (S._host && S._host.showPodium) {
      const entries = order.map(p => ({ name: names[p], isPlayer: p === 0, cards: hands[p].length }));
      S._host.showPodium(entries, done);
    } else
      done();
  }

  /* a click while the podium result is still pending settles it */
  function settlePending(S) {
    if (!S.podiumPending) return false;
    S.podiumPending = false;
    const order = S.finishOrder || [];
    const settle = S._podiumSettle;
    S._podiumSettle = null;
    if (settle) settle(order[0], order);
    return true;
  }

  /* AI pacing: a third of the delay once the player is out */
  function aiDelay(S, base) {
    return isFinished(S, 0) ? base / 3 : base;
  }

  function finishedStatus(S) {
    const place = placeOf(S, 0);
    return place > 0 && !S.roundOver ? 'You finished ' + ordinal(place) + ' - the others play for places' : '';
  }

  /* status line in place of the turn hint while the AIs play on */
  function drawFinishedStatus(ctx, S, x, y) {
    const text = finishedStatus(S);
    if (!text) return false;
    ctx.save();
    ctx.fillStyle = placeColor(placeOf(S, 0));
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.restore();
    return true;
  }

  /* placement badge for a finished seat; returns false when p still plays */
  function drawPlaceBadge(ctx, S, p, x, y, align, size) {
    const place = placeOf(S, p);
    if (place <= 0) return false;
    ctx.save();
    ctx.font = 'bold ' + (size || 20) + 'px sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(ordinal(place), x, y);
    ctx.fillStyle = placeColor(place);
    ctx.fillText(ordinal(place), x, y);
    ctx.restore();
    return true;
  }

  SZ.CardGames.shared.sheddingPlaces = {
    ordinal, placeColor, resetPlaces, isFinished, placeOf, finishTarget, activeCount, nextActive,
    recordFinish, rankRest, presentPodium, settlePending, aiDelay, finishedStatus, drawFinishedStatus, drawPlaceBadge
  };

})();
