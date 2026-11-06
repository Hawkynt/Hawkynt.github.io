/* Durak: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.durak;
  const S = V.S;
  const { CANVAS_W, MAX_ATTACK_CARDS } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiAttack() {
    if (S.playerHand.length === 0 && S.stock.length === 0) {
      /* Nothing to attack into -- end bout */
      if (S.attackCards.length > 0 && V.allDefended())
        V.defenderSucceeded();
      return;
    }

    if (S.attackCards.length === 0) {
      /* First attack: play lowest non-trump, or lowest trump if no choice */
      let bestIdx = -1;
      let bestStrength = 999;
      for (let i = 0; i < S.aiHand.length; ++i) {
        const s = V.cardStrength(S.aiHand[i]) + (V.isTrump(S.aiHand[i]) ? 100 : 0);
        if (s < bestStrength) {
          bestStrength = s;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const card = S.aiHand.splice(bestIdx, 1)[0];
        card.faceUp = true;
        S.attackCards.push(card);
        S.defenseCards.push(null);

        if (S._host) {
          S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, V.tableAttackX(S.attackCards.length - 1), V.tableAttackY(), 0);
          S._host.floatingText.add(CANVAS_W / 2, 260, 'AI attacks!', { color: '#fa0', size: 18 });
        }

        S.waitingForDefense = true;
      }
      return;
    }

    /* Subsequent attacks: add cards matching table ranks */
    if (!V.allDefended()) return;

    const ranks = V.ranksOnTable();
    let bestIdx = -1;
    let bestStrength = 999;
    for (let i = 0; i < S.aiHand.length; ++i) {
      if (!ranks.has(S.aiHand[i].rank)) continue;
      if (!V.canAddAttackCard(S.aiHand[i], S.playerHand.length)) continue;
      const s = V.cardStrength(S.aiHand[i]) + (V.isTrump(S.aiHand[i]) ? 100 : 0);
      if (s < bestStrength) {
        bestStrength = s;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && S.attackCards.length < MAX_ATTACK_CARDS) {
      const card = S.aiHand.splice(bestIdx, 1)[0];
      card.faceUp = true;
      S.attackCards.push(card);
      S.defenseCards.push(null);

      if (S._host)
        S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, V.tableAttackX(S.attackCards.length - 1), V.tableAttackY(), 0);

      S.waitingForDefense = true;
    } else {
      /* AI done attacking */
      V.defenderSucceeded();
    }
  }

  function aiDefend() {
    /* Find first undefended attack card */
    let targetIdx = -1;
    for (let i = 0; i < S.attackCards.length; ++i) {
      if (!S.defenseCards[i]) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx < 0) return;

    const attCard = S.attackCards[targetIdx];

    /* Find lowest card that can beat it -- prefer non-trump */
    let bestIdx = -1;
    let bestStrength = 999;
    let bestIsTrump = true;
    for (let i = 0; i < S.aiHand.length; ++i) {
      if (!V.canBeat(attCard, S.aiHand[i])) continue;
      const t = V.isTrump(S.aiHand[i]);
      const s = V.cardStrength(S.aiHand[i]);
      /* Prefer non-trump over trump; within same category, prefer lower */
      if (!t && bestIsTrump) {
        bestIdx = i;
        bestStrength = s;
        bestIsTrump = false;
      } else if (t === bestIsTrump && s < bestStrength) {
        bestIdx = i;
        bestStrength = s;
        bestIsTrump = t;
      }
    }

    /* Economic decision: don't waste high trumps unless necessary */
    if (bestIdx >= 0 && bestIsTrump && !V.isTrump(attCard)) {
      /* Only use trump if stock is small or hand is big enough */
      const shouldUseTrump = S.stock.length <= 4 || S.aiHand.length >= 4;
      if (!shouldUseTrump) {
        /* Pick up instead */
        V.defenderPicksUp();
        return;
      }
    }

    if (bestIdx >= 0) {
      const card = S.aiHand.splice(bestIdx, 1)[0];
      card.faceUp = true;
      S.defenseCards[targetIdx] = card;

      if (S._host)
        S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, V.tableDefenseX(targetIdx), V.tableDefenseY(), 0);

      /* Check if all defended */
      if (V.allDefended()) {
        S.waitingForDefense = false;
        S.aiActionPending = false;
        S.aiTurnTimer = 0;
      }
    } else {
      /* Can't defend -- pick up */
      V.defenderPicksUp();
    }
  }

  V.aiAttack = aiAttack;
  V.aiDefend = aiDefend;

})();
