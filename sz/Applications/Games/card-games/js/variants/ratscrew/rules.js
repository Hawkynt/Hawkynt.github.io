/* Rat Screw: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ratscrew;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, HUMAN, FACE_CHANCES, AI_SLAP_MIN, AI_SLAP_MAX, CENTER_X, CENTER_Y,
    PLAYER_POSITIONS, SLAP_BTN, PHASE_IDLE, PHASE_FLIPPING, PHASE_FACE_CHALLENGE, PHASE_SLAP_WINDOW,
    PHASE_COLLECTING, PHASE_PAUSE } = V;

  function isFaceCard(card) {
    return FACE_CHANCES[card.rank] !== undefined;
  }

  function countActivePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (S.playerPiles[i].length > 0) ++count;
    return count;
  }

  function isHumanAlive() {
    return S.playerPiles[HUMAN].length > 0 || !S.eliminated[HUMAN];
  }

  function detectSlapPattern() {
    if (S.centerPile.length < 2) return '';

    const top = S.centerPile[S.centerPile.length - 1];
    const second = S.centerPile[S.centerPile.length - 2];

    // Doubles
    if (top.rank === second.rank) return 'Doubles';

    // Sandwich
    if (S.centerPile.length >= 3) {
      const third = S.centerPile[S.centerPile.length - 3];
      if (top.rank === third.rank) return 'Sandwich';
    }

    // Top-Bottom
    if (S.centerPile.length >= 3) {
      const bottom = S.centerPile[0];
      if (top.rank === bottom.rank) return 'Top-Bottom';
    }

    return '';
  }

  function flipCard(player) {
    if (S.playerPiles[player].length === 0) return null;
    const card = S.playerPiles[player].shift();
    card.faceUp = true;
    S.centerPile.push(card);

    const pos = PLAYER_POSITIONS[player];
    if (S._host)
      S._host.dealCardAnim(card, pos.x, pos.y, CENTER_X, CENTER_Y, 0);

    return card;
  }

  function doFlip(player) {
    const card = flipCard(player);
    if (!card) {
      V.advanceTurnOrEliminate(player);
      return;
    }

    // Check for face card challenge
    if (isFaceCard(card)) {
      S.faceChallenge = true;
      S.challengeChances = FACE_CHANCES[card.rank];
      S.challengeBeneficiary = player;
      S.challengePlayer = V.nextActivePlayer(player);
      if (S.challengePlayer < 0) {
        V.endRound(player);
        return;
      }
      S.phase = PHASE_FACE_CHALLENGE;
      S.phaseTimer = 0;
      S.aiFlipTimer = 0;
      return;
    }

    // If inside a face challenge, decrement chances
    if (S.faceChallenge) {
      --S.challengeChances;
      if (S.challengeChances <= 0) {
        // Challenge failed -- beneficiary wins the pile
        V.startCollect(S.challengeBeneficiary, 'Challenge won!');
        S.faceChallenge = false;
        return;
      }
      // Still in challenge, same player must flip again
      S.phase = PHASE_FACE_CHALLENGE;
      S.phaseTimer = 0;
      S.aiFlipTimer = 0;
      return;
    }

    // Normal flip -- check for slap patterns
    const pattern = detectSlapPattern();
    if (pattern) {
      S.slapPattern = pattern;
      openSlapWindow();
      return;
    }

    // No pattern, advance turn
    S.currentTurn = V.nextActivePlayer(player);
    if (S.currentTurn < 0) {
      V.endRound(player);
      return;
    }
    S.phase = PHASE_IDLE;
    S.phaseTimer = 0;
    S.aiFlipTimer = 0;
  }

  function openSlapWindow() {
    S.phase = PHASE_SLAP_WINDOW;
    S.phaseTimer = 0;
    S.slapWinner = -1;
    S.slapPulsePhase = 0;

    // Schedule AI slap attempts
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (i === HUMAN) { S.aiSlapTimers[i] = Infinity; continue; }
      if (S.eliminated[i] && S.playerPiles[i].length === 0) { S.aiSlapTimers[i] = Infinity; continue; }
      S.aiSlapTimers[i] = AI_SLAP_MIN + Math.random() * (AI_SLAP_MAX - AI_SLAP_MIN);
      S.aiSlapTargets[i] = true;
    }
  }

  function executeSlap(player) {
    if (S.phase !== PHASE_SLAP_WINDOW && S.phase !== PHASE_FACE_CHALLENGE && S.phase !== PHASE_IDLE) return;

    const pattern = detectSlapPattern();
    if (pattern) {
      // Valid slap
      S.slapWinner = player;
      S.slapFlashColor = '#0f0';
      S.slapFlashTimer = 0.6;
      S.faceChallenge = false;

      const name = player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CENTER_Y, name + ' slapped! (' + pattern + ')', { color: '#4f4', size: 22 });
        S._host.particles.sparkle(CANVAS_W / 2, CENTER_Y + CE.CARD_H / 2, 15, {});
      }
      V.startCollect(player, pattern + '!');
    } else {
      // False slap -- penalty
      S.slapFlashColor = '#f00';
      S.slapFlashTimer = 0.5;

      if (S.playerPiles[player].length > 0) {
        const penalty = S.playerPiles[player].shift();
        penalty.faceUp = false;
        S.centerPile.unshift(penalty);
      }

      const name = player === HUMAN ? 'You' : PLAYER_POSITIONS[player].name;
      showFeedback(name + ': False slap! -1 card');
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, SLAP_BTN.y + SLAP_BTN.h + 4, 'False slap!', { color: '#f44', size: 18 });

      V.updateScore();
    }
  }

  function checkGameOver() {
    // Check if one player has all 52 cards
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (S.playerPiles[i].length === 52) {
        V.endRound(i);
        return true;
      }
    }

    // Check if only one player remains
    const active = [];
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (S.playerPiles[i].length > 0) active.push(i);

    if (active.length <= 1 && S.centerPile.length === 0) {
      V.endRound(active.length === 1 ? active[0] : -1);
      return true;
    }

    return false;
  }

  function showFeedback(text) {
    S.feedbackText = text;
    S.feedbackTimer = 0;
  }

  function getCurrentFlipPlayer() {
    if (S.faceChallenge) return S.challengePlayer;
    return S.currentTurn;
  }

  function humanFlip() {
    if (S.roundOver || S.gameOver) return;
    if (S.phase === PHASE_COLLECTING || S.phase === PHASE_PAUSE) return;

    const flipPlayer = getCurrentFlipPlayer();
    if (flipPlayer !== HUMAN) return;
    if (S.playerPiles[HUMAN].length === 0) return;

    S.phase = PHASE_FLIPPING;
    S.phaseTimer = 0;
    doFlip(HUMAN);
  }

  function humanSlap() {
    if (S.roundOver || S.gameOver) return;
    if (S.phase === PHASE_COLLECTING) return;
    if (S.centerPile.length === 0) return;
    if (!isHumanAlive() && S.playerPiles[HUMAN].length === 0) return;

    executeSlap(HUMAN);
  }

  Object.assign(V, { countActivePlayers, isHumanAlive, detectSlapPattern, doFlip, executeSlap,
    checkGameOver, showFeedback, getCurrentFlipPlayer, humanFlip, humanSlap });

})();
