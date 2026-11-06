/* Uno All Wild: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unowild'];
  const S = V.S;
  const { PLAYER_NAMES, CANVAS_W, AI_TURN_DELAY } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const leader = V.findLeadingOpponent(playerIdx);
    const nextP = V.nextPlayer(playerIdx);

    const priorities = [];
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      let prio = 0;
      switch (c.value) {
        case 'Wild Targeted Draw Two':
          prio = 10;
          break;
        case 'Wild Forced Swap':
          prio = hand.length > S.hands[leader].length ? 1 : 9;
          break;
        case 'Wild Draw Two':
          prio = nextP === leader ? 8 : 5;
          break;
        case 'Wild Skip':
          prio = nextP === leader ? 2 : 6;
          break;
        case 'Wild Reverse':
          prio = 5;
          break;
        case 'Wild Gap':
          prio = 4;
          break;
        case 'Wild':
          prio = 3;
          break;
      }
      priorities.push({ idx: i, prio: prio });
    }

    priorities.sort(function(a, b) { return b.prio - a.prio; });
    return priorities[0].idx;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver) return;
    if (S.waitingForTargetChoice || S.waitingForGapChoice) return;

    const hand = S.hands[S.currentPlayer];
    const cardIdx = aiChooseCard(S.currentPlayer);

    if (cardIdx >= 0) {
      V.playCard(S.currentPlayer, cardIdx);
      return;
    }

    const drawn = V.drawFromDeck();
    if (drawn) {
      hand.push(drawn);
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[S.currentPlayer] + ' draws', { color: '#aaa', size: 14 });
    }
    V.advancePlayer();
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver || S.waitingForTargetChoice || S.waitingForGapChoice) return;

    if (S.currentPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= PL.aiDelay(S, AI_TURN_DELAY)) {
        S.aiTurnTimer = 0;
        aiTurn();
      }
    }
  }

  Object.assign(V, { tick, aiTurn });

})();
