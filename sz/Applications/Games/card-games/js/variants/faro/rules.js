/* Faro: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.faro;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_RESULT, RANKS, CELL_W, CELL_H, DRAWN_X, DRAWN_Y,
    DRAWN_GAP, HIGHCARD_BTN } = V;

  function totalBets() {
    let sum = S.highCardBet;
    for (const r of RANKS)
      if (S.bets[r]) sum += S.bets[r];
    return sum;
  }

  function maxRemainingCount() {
    let max = 0;
    for (const r of RANKS)
      if (S.caseKeeper[r] > max) max = S.caseKeeper[r];
    return max;
  }

  function rankValue(rank) {
    return RANKS.indexOf(rank);
  }

  function placeBetOnRank(rank) {
    if (S.phase !== PHASE_BETTING) return;
    if (S.selectedChip > S.score - totalBets()) return;
    if (!S.bets[rank]) S.bets[rank] = 0;
    S.bets[rank] += S.selectedChip;
    if (S.bets[rank] > S.score - totalBets() + S.bets[rank])
      S.bets[rank] = S.score;
  }

  function placeBetHighCard() {
    if (S.phase !== PHASE_BETTING) return;
    if (S.selectedChip > S.score - totalBets()) return;
    S.highCardBet += S.selectedChip;
    if (S.highCardBet > S.score)
      S.highCardBet = S.score;
  }

  function clearAllBets() {
    S.bets = {};
    S.highCardBet = 0;
  }

  function resolveTurn() {
    S.phase = PHASE_RESULT;
    ++S.turnNumber;

    let netChange = 0;
    const isSplit = S.loserCard.rank === S.winnerCard.rank;

    // Resolve rank bets
    for (const r of RANKS) {
      if (!S.bets[r] || S.bets[r] <= 0) continue;

      if (isSplit && r === S.loserCard.rank) {
        // Split: house takes half
        const halfLoss = Math.floor(S.bets[r] / 2);
        netChange -= halfLoss;
        if (S._host)
          S._host.floatingText.add(V.cellPos(RANKS.indexOf(r)).x + CELL_W / 2, V.cellPos(RANKS.indexOf(r)).y, 'SPLIT -' + halfLoss, { color: '#fa0', size: 14 });
        S.bets[r] -= halfLoss;
      } else if (r === S.winnerCard.rank) {
        // Winner: player wins even money
        const win = S.bets[r];
        netChange += win;
        if (S._host) {
          const pos = V.cellPos(RANKS.indexOf(r));
          S._host.floatingText.add(pos.x + CELL_W / 2, pos.y, '+' + win, { color: '#4f4', size: 16 });
          S._host.triggerChipSparkle(pos.x + CELL_W / 2, pos.y + CELL_H / 2);
        }
        S.bets[r] = 0;
      } else if (r === S.loserCard.rank) {
        // Loser: player loses bet
        const loss = S.bets[r];
        netChange -= loss;
        if (S._host) {
          const pos = V.cellPos(RANKS.indexOf(r));
          S._host.floatingText.add(pos.x + CELL_W / 2, pos.y, '-' + loss, { color: '#f44', size: 16 });
        }
        S.bets[r] = 0;
      }
      // else: bet stays for next turn
    }

    // Resolve high-card bet
    if (S.highCardBet > 0) {
      if (isSplit) {
        // Split on high card: push
        if (S._host)
          S._host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, 'PUSH', { color: '#ff8', size: 14 });
      } else {
        const wVal = rankValue(S.winnerCard.rank);
        const lVal = rankValue(S.loserCard.rank);
        if (wVal > lVal) {
          netChange += S.highCardBet;
          if (S._host)
            S._host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, '+' + S.highCardBet, { color: '#4f4', size: 14 });
        } else {
          netChange -= S.highCardBet;
          if (S._host)
            S._host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, '-' + S.highCardBet, { color: '#f44', size: 14 });
        }
        S.highCardBet = 0;
      }
    }

    S.score += netChange;

    if (netChange > 0) {
      S.resultMsg = 'Won ' + netChange + ' chips! Click to continue';
      if (S._host) {
        S._host.particles.confetti(CANVAS_W / 2, 200, 20);
        S._host.addGlow(DRAWN_X + DRAWN_GAP, DRAWN_Y, CE.CARD_W, CE.CARD_H, 1.5);
      }
    } else if (netChange < 0) {
      S.resultMsg = 'Lost ' + Math.abs(netChange) + ' chips. Click to continue';
      if (S._host)
        S._host.screenShake.trigger(5, 250);
    } else {
      S.resultMsg = 'No change. Click to continue';
    }

    S.roundOver = true;

    if (S.score <= 0) {
      S.score = 0;
      S.gameOver = true;
      S.resultMsg = 'GAME OVER - Busted!';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    } else if (S.turnNumber >= S.maxTurns || S.deck.length < 2) {
      V.endGame();
    }

    if (S._host) S._host.onScoreChanged(S.score);
  }

  Object.assign(V, { totalBets, maxRemainingCount, placeBetOnRank, placeBetHighCard, clearAllBets,
    resolveTurn });

})();
