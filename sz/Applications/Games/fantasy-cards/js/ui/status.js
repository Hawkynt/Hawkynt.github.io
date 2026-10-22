/* The status bar below the canvas and the high-scores table inside its
   dialog. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const S = NS.state;

  function updateStatusBar() {
    const elTurn = document.getElementById('statusTurn');
    const elMana = document.getElementById('statusMana');
    const elDeck = document.getElementById('statusDeck');
    if (elTurn) elTurn.textContent = `Turn: ${S.turnNumber}`;
    if (elMana) elMana.textContent = `Mana: ${S.playerMana}/${S.playerMaxMana}`;
    if (elDeck) elDeck.textContent = `Deck: ${S.playerDeck?.length ?? 0}`;
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = S.highScores.map((s, i) =>
      `<tr><td>${i + 1}</td><td>${s.difficulty}</td><td>${s.turns} turns</td></tr>`
    ).join('');
  }

  Object.assign(NS.status, { updateStatusBar, renderHighScores });
})();
