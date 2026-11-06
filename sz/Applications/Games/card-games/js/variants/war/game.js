/* War: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.war;
  const S = V.S;
  const { CANVAS_W, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y, AI_PLAY_X, AI_PLAY_Y,
    PLAYER_PLAY_X, PLAYER_PLAY_Y, PHASE_IDLE, PHASE_FLIP, PHASE_SHOW, PHASE_WAR_FLIP } = V;

  function startFlip() {
    if (S.phase !== PHASE_IDLE || S.roundOver || S.gameOver) return;
    if (S.playerPile.length === 0 || S.aiPile.length === 0) return;

    const pc = S.playerPile.shift();
    pc.faceUp = true;
    S.playerPlayed.push(pc);

    const ac = S.aiPile.shift();
    ac.faceUp = true;
    S.aiPlayed.push(ac);

    if (S._host) {
      S._host.dealCardAnim(pc, PLAYER_PILE_X, PLAYER_PILE_Y, PLAYER_PLAY_X, PLAYER_PLAY_Y, 0);
      S._host.dealCardAnim(ac, AI_PILE_X, AI_PILE_Y, AI_PLAY_X, AI_PLAY_Y, 0.05);
    }

    S.flipAnimProgress = 0;
    S.phase = PHASE_FLIP;
  }

  function dealWarCards() {
    // Each player places up to 3 face-down cards
    const playerAvail = Math.min(3, S.playerPile.length);
    const aiAvail = Math.min(3, S.aiPile.length);
    const count = Math.max(playerAvail, aiAvail);

    if (count === 0) {
      // Cannot wage war -- whoever has the card on the table loses
      if (S.playerPile.length === 0 && S.aiPile.length === 0) {
        // true stalemate: split evenly -- give played cards back
        S.resultText = 'Stalemate!';
        S.collectTarget = 'player';
        S.phase = PHASE_SHOW;
        S.phaseTimer = 0;
        return;
      }
      if (S.playerPile.length === 0) {
        S.collectTarget = 'ai';
      } else {
        S.collectTarget = 'player';
      }
      S.phase = PHASE_SHOW;
      S.phaseTimer = 0;
      return;
    }

    for (let i = 0; i < count; ++i) {
      if (S.playerPile.length > 0) {
        const pc = S.playerPile.shift();
        pc.faceUp = false;
        S.warFaceDown.player.push(pc);
        S.playerPlayed.push(pc);
      }
      if (S.aiPile.length > 0) {
        const ac = S.aiPile.shift();
        ac.faceUp = false;
        S.warFaceDown.ai.push(ac);
        S.aiPlayed.push(ac);
      }
    }

    S.phase = PHASE_WAR_FLIP;
    S.phaseTimer = 0;
  }

  function setupWar() {
    const deck = CE.shuffle(CE.createDeck());
    S.playerPile = deck.slice(0, 26);
    S.aiPile = deck.slice(26, 52);
    S.playerPlayed = [];
    S.aiPlayed = [];
    S.warFaceDown = [];
    S.warRound = 0;
    S.phase = PHASE_IDLE;
    S.phaseTimer = 0;
    S.flipAnimProgress = 0;
    S.collectProgress = 0;
    S.collectTarget = '';
    S.resultText = '';
    S.roundOver = false;
    S.gameOver = false;
    S.score = 26;

    // Animate initial deal
    if (S._host) {
      for (let i = 0; i < 4; ++i)
        S._host.dealCardAnim(S.playerPile[i], CANVAS_W / 2, -CE.CARD_H, PLAYER_PILE_X, PLAYER_PILE_Y, i * 0.08);
      for (let i = 0; i < 4; ++i)
        S._host.dealCardAnim(S.aiPile[i], CANVAS_W / 2, -CE.CARD_H, AI_PILE_X, AI_PILE_Y, (i + 4) * 0.08);
    }
  }

  Object.assign(V, { startFlip, dealWarCards, setupWar });

})();
