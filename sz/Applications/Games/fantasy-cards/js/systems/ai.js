/* AI logic — 3 difficulty levels: random play on easy, situational priority on
   normal and weighted strategic scoring on hard, paced by the play timer. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function aiTakeTurn(dt) {
    if (S.state !== C.STATE_PLAYING || S.isPlayerTurn)
      return;

    S.aiPlayTimer -= dt;
    if (S.aiPlayTimer > 0)
      return;

    // Find playable cards
    const playable = [];
    for (let i = 0; i < S.aiHand.length; ++i) {
      if (S.aiMana >= S.aiHand[i].cost)
        playable.push(i);
    }

    if (playable.length === 0) {
      // No playable cards, end AI turn
      NS.turn.startPlayerTurn();
      return;
    }

    let chosenIdx;
    if (S.difficulty === C.DIFF_EASY) {
      // Easy: random card
      chosenIdx = playable[Math.floor(Math.random() * playable.length)];
    } else if (S.difficulty === C.DIFF_NORMAL) {
      // Normal: prioritize by type based on situation
      chosenIdx = aiEvaluateNormal(playable);
    } else {
      // Hard: strategic scoring with weights
      chosenIdx = aiEvaluateHard(playable);
    }

    const card = S.aiHand[chosenIdx];
    S.aiMana -= card.cost;
    S.aiHand.splice(chosenIdx, 1);
    NS.game.applyCardEffect(card, false);
    S.aiDiscard.push(card);

    // Mana shimmer for AI
    S.manaShimmerTimer = 0.3;

    // Card play glow
    D.particles.sparkle(C.CANVAS_W / 2, 100, 12, { color: card.color, speed: 3 });

    NS.game.checkGameEnd();
    NS.status.updateStatusBar();

    if (S.state === C.STATE_PLAYING) {
      // AI might play more cards
      const morePlayable = S.aiHand.filter(c => c.cost <= S.aiMana);
      if (morePlayable.length > 0 && Math.random() < 0.6) {
        S.aiPlayTimer = 0.6;
      } else {
        // End AI turn
        S.aiPlayTimer = 0.5;
        setTimeout(() => {
          if (S.state === C.STATE_PLAYING)
            NS.turn.startPlayerTurn();
        }, 500);
      }
    }
  }

  function aiEvaluateNormal(playable) {
    // Prioritize: heal if low HP, attack if enemy low, defend if no shield
    const scores = playable.map(i => {
      const card = S.aiHand[i];
      let score = card.power;
      if (card.type === 'heal' && S.aiHP < S.aiMaxHP * 0.4)
        score += 10;
      if (card.type === 'attack' && S.playerHP < S.playerMaxHP * 0.3)
        score += 8;
      if (card.type === 'defend' && S.aiShield < 5)
        score += 5;
      return { idx: i, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores[0].idx;
  }

  function aiEvaluateHard(playable) {
    // Strategic: evaluate each card considering all factors
    const scores = playable.map(i => {
      const card = S.aiHand[i];
      let weight = card.power * 2;

      // Health awareness
      if (card.type === 'heal') {
        const hpRatio = S.aiHP / S.aiMaxHP;
        weight += hpRatio < 0.3 ? 25 : hpRatio < 0.5 ? 15 : 3;
      }
      if (card.type === 'attack') {
        const enemyRatio = S.playerHP / S.playerMaxHP;
        weight += enemyRatio < 0.2 ? 20 : 10;
        // Account for shield piercing
        if (S.playerShield > 0 && card.power > S.playerShield)
          weight += 5;
      }
      if (card.type === 'defend') {
        weight += S.aiShield < 3 ? 12 : 4;
      }
      if (card.type === 'buff') {
        weight += S.turnNumber < 5 ? 10 : 5;
      }
      if (card.type === 'debuff') {
        weight += S.playerDamageBuff > 3 ? 15 : 6;
      }

      // Combo synergy seeking
      const hasCombo = S.aiHand.some(c => c.combo === card.combo && c.id !== card.id);
      if (hasCombo)
        weight += 8;

      // Mana efficiency
      weight += (card.power / Math.max(1, card.cost)) * 3;

      return { idx: i, weight };
    });
    scores.sort((a, b) => b.weight - a.weight);
    return scores[0].idx;
  }

  Object.assign(NS.ai, { aiTakeTurn, aiEvaluateNormal, aiEvaluateHard });
})();
