/* War: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.war;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, RANK_VALUES, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y,
    AI_PLAY_X, AI_PLAY_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, PHASE_IDLE, PHASE_SHOW, PHASE_WAR_DEAL,
    PHASE_WAR_SHOW } = V;

  function rankValue(card) {
    return RANK_VALUES[card.rank] || 0;
  }

  function compareCards(playerCard, aiCard) {
    const pv = rankValue(playerCard);
    const av = rankValue(aiCard);
    if (pv > av) return 1;
    if (pv < av) return -1;
    return 0;
  }

  function resolveFlip() {
    const pc = S.playerPlayed[S.playerPlayed.length - 1];
    const ac = S.aiPlayed[S.aiPlayed.length - 1];
    const cmp = compareCards(pc, ac);

    if (cmp > 0) {
      S.resultText = 'You win this round!';
      S.collectTarget = 'player';
      S.phase = PHASE_SHOW;
      S.phaseTimer = 0;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win!', { color: '#4f4', size: 22 });
    } else if (cmp < 0) {
      S.resultText = 'AI wins this round!';
      S.collectTarget = 'ai';
      S.phase = PHASE_SHOW;
      S.phaseTimer = 0;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins!', { color: '#f44', size: 22 });
    } else {
      // WAR!
      S.resultText = 'WAR!';
      S.phase = PHASE_WAR_DEAL;
      S.phaseTimer = 0;
      S.warDealIndex = 0;
      S.warDealTimer = 0;
      S.warFaceDown = { player: [], ai: [] };
      ++S.warRound;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'WAR!', { color: '#ff0', size: 36 });
    }
  }

  function flipWarCards() {
    // Each player flips one more card face-up
    if (S.playerPile.length === 0 && S.aiPile.length === 0) {
      // Neither can flip -- compare last face-down cards flipped up
      if (S.warFaceDown.player.length > 0) {
        const lp = S.warFaceDown.player[S.warFaceDown.player.length - 1];
        lp.faceUp = true;
      }
      if (S.warFaceDown.ai.length > 0) {
        const la = S.warFaceDown.ai[S.warFaceDown.ai.length - 1];
        la.faceUp = true;
      }
      // resolve based on those
      resolveWarResult();
      return;
    }

    let pc = null;
    let ac = null;

    if (S.playerPile.length > 0) {
      pc = S.playerPile.shift();
      pc.faceUp = true;
      S.playerPlayed.push(pc);
      if (S._host) S._host.dealCardAnim(pc, PLAYER_PILE_X, PLAYER_PILE_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, 0);
    }
    if (S.aiPile.length > 0) {
      ac = S.aiPile.shift();
      ac.faceUp = true;
      S.aiPlayed.push(ac);
      if (S._host) S._host.dealCardAnim(ac, AI_PILE_X, AI_PILE_Y, AI_PLAY_X, AI_PLAY_Y, 0.05);
    }

    // If one player ran out, the other wins
    if (!pc && ac) {
      S.collectTarget = 'ai';
      S.phase = PHASE_WAR_SHOW;
      S.phaseTimer = 0;
      S.resultText = 'AI wins the war!';
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins War!', { color: '#f44', size: 24 });
      return;
    }
    if (pc && !ac) {
      S.collectTarget = 'player';
      S.phase = PHASE_WAR_SHOW;
      S.phaseTimer = 0;
      S.resultText = 'You win the war!';
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win War!', { color: '#4f4', size: 24 });
      return;
    }

    // Both flipped -- compare
    const cmp = compareCards(pc, ac);
    if (cmp > 0) {
      S.collectTarget = 'player';
      S.resultText = 'You win the war!';
      S.phase = PHASE_WAR_SHOW;
      S.phaseTimer = 0;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'You Win War!', { color: '#4f4', size: 24 });
    } else if (cmp < 0) {
      S.collectTarget = 'ai';
      S.resultText = 'AI wins the war!';
      S.phase = PHASE_WAR_SHOW;
      S.phaseTimer = 0;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Wins War!', { color: '#f44', size: 24 });
    } else {
      // Another tie -- war again!
      S.resultText = 'DOUBLE WAR!';
      S.phase = PHASE_WAR_DEAL;
      S.phaseTimer = 0;
      S.warDealIndex = 0;
      S.warDealTimer = 0;
      S.warFaceDown = { player: [], ai: [] };
      ++S.warRound;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'DOUBLE WAR!', { color: '#ff0', size: 36 });
    }
  }

  function resolveWarResult() {
    // Compare last face-up cards from each side among playerPlayed/aiPlayed
    const lastPlayerFaceUp = findLastFaceUp(S.playerPlayed);
    const lastAiFaceUp = findLastFaceUp(S.aiPlayed);

    if (!lastPlayerFaceUp && !lastAiFaceUp) {
      S.collectTarget = 'player'; // arbitrary split
    } else if (!lastPlayerFaceUp) {
      S.collectTarget = 'ai';
    } else if (!lastAiFaceUp) {
      S.collectTarget = 'player';
    } else {
      const cmp = compareCards(lastPlayerFaceUp, lastAiFaceUp);
      S.collectTarget = cmp >= 0 ? 'player' : 'ai';
    }

    S.phase = PHASE_WAR_SHOW;
    S.phaseTimer = 0;
    S.resultText = S.collectTarget === 'player' ? 'You win the war!' : 'AI wins the war!';
  }

  function findLastFaceUp(pile) {
    for (let i = pile.length - 1; i >= 0; --i)
      if (pile[i].faceUp) return pile[i];
    return null;
  }

  function collectCards() {
    // All played cards go to winner's pile bottom (shuffled to add randomness)
    const allCards = CE.shuffle([...S.playerPlayed, ...S.aiPlayed]);
    if (S.collectTarget === 'player')
      S.playerPile.push(...allCards);
    else
      S.aiPile.push(...allCards);

    S.playerPlayed = [];
    S.aiPlayed = [];
    S.warFaceDown = [];
    S.warRound = 0;

    // Update score
    S.score = S.playerPile.length;
    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over
    if (S.playerPile.length === 0) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultText = 'GAME OVER - AI wins!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
    } else if (S.aiPile.length === 0) {
      S.gameOver = true;
      S.roundOver = true;
      S.resultText = 'YOU WIN THE GAME!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
        S._host.onRoundOver(true);
      }
    } else {
      S.resultText = '';
      S.phase = PHASE_IDLE;
    }
  }

  Object.assign(V, { resolveFlip, flipWarCards, findLastFaceUp, collectCards });

})();
