/* European card games: layout helpers for two-player tables on the 900x600 canvas
   (fanned hand positions and the two-card trick spots), shared by several variants. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* x of card idx in the player's face-up fan of total cards */
  function fanCardX(idx, total) {
    const spacing = Math.min(80, 400 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  /* x of card idx in the opponent's half-size face-down fan of total cards */
  function fanBackX(idx, total) {
    const spacing = Math.min(35, 300 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  function duelPlayerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  function duelAiCardY() {
    return 20;
  }

  /* trick spot of player who (0 = human, 1 = AI), slightly offset from the centre */
  function duelTrickCardPos(who) {
    if (who === 0)
      return { x: CANVAS_W / 2 - CE.CARD_W / 2 + 20, y: 310 };
    return { x: CANVAS_W / 2 - CE.CARD_W / 2 - 20, y: 210 };
  }

  SZ.CardGames.shared.euroLayout = { fanCardX, fanBackX, duelPlayerCardY, duelAiCardY, duelTrickCardPos };

})();
