/* Variant selection, game reset and the per-frame AI tick. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const V = NS.variants;
  const OS = NS.os;
  const ST = NS.status;
  const G = NS.game = NS.game || {};

  /* ══════════════════════════════════════════════════════════════════
     VARIANT SELECTION & SETUP
     ══════════════════════════════════════════════════════════════════ */

  G.selectGame = function(variantId, opts) {
    const fresh = !opts || !opts.nextRound;
    const prev = S.currentVariant;
    S.currentVariant = K.VARIANTS.find(v => v.id === variantId) || K.VARIANTS[0];
    if (NS.outcomes) NS.outcomes.reset();
    if (NS.fx) NS.fx.clear();
    if (NS.profile && (fresh || !prev)) NS.profile.onGameStarted(S.currentVariant.id);
    const CE = SZ.CardEngine;
    if (NS.scenes && fresh && !S.skipTitles && (!prev || prev.id !== S.currentVariant.id)) {
      NS.scenes.clear();
      NS.scenes.gameTitle(S.currentVariant, NS.lobby ? NS.lobby.categoryOf(S.currentVariant.id) : null, () => CE.motion.armDeal());
    } else if (CE.motion) CE.motion.armDeal();
    S.state = K.STATE_PLAYING;
    S.roundNumber = 1;
    S.roundStartScore = S.score;
    S.dealAnimations = [];
    S.flipAnimations = [];
    S.glowCards = [];

    // Clean up previous variant module
    if (S.activeVariantModule) {
      if (S.activeVariantModule.cleanup) S.activeVariantModule.cleanup();
      S.activeVariantModule = null;
    }

    // All variants are now module-based
    V.loadVariantModule(S.currentVariant, function(mod) {
      S.activeVariantModule = mod;
      mod.setup(D.ctx, D.canvas, K.CANVAS_W, K.CANVAS_H, NS.host);
      OS.updateWindowTitle();
      ST.updateStatus();
    });
    OS.updateWindowTitle();
    ST.updateStatus();
  };

  G.initGame = function() {
    S.score = 100;
    if (S.activeVariantModule) {
      if (S.activeVariantModule.cleanup) S.activeVariantModule.cleanup();
      S.activeVariantModule = null;
    }
    S.state = K.STATE_MENU;
    S.currentVariant = null;
    if (NS.outcomes) NS.outcomes.reset();
    if (NS.scenes) NS.scenes.clear();
    if (NS.lobby) NS.lobby.tabTime = 0;
    OS.updateWindowTitle();
    ST.updateStatus();
  };

  /* ══════════════════════════════════════════════════════════════════
     AI TICK
     ══════════════════════════════════════════════════════════════════ */

  G.tickAi = function(dt) {
    if (S.state !== K.STATE_PLAYING) return;
    if (S.activeVariantModule) {
      if (S.activeVariantModule.tick) S.activeVariantModule.tick(dt);
    }
  };
})();
