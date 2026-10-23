/* The one shared mutable state object every module reads and writes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state = NS.state || {};

  /* ── Hint mode ── */
  S.hintsEnabled = true;
  try { const h = localStorage.getItem(K.STORAGE_HINTS); if (h !== null) S.hintsEnabled = h !== 'false'; } catch (_) {}

  /* ── Auto-sort hand ── */
  S.autoSortHand = false;
  try { const s = localStorage.getItem(K.STORAGE_AUTOSORT); if (s !== null) S.autoSortHand = s !== 'false'; } catch (_) {}

  /* ── Game state ── */
  S.state = K.STATE_MENU;
  S.currentVariant = null;
  S.score = 0;
  S.roundNumber = 0;
  S.lastTimestamp = 0;

  /* ── Card animation state (for host-rendered variants) ── */
  S.dealAnimations = [];
  S.flipAnimations = [];
  S.glowCards = [];
  S.chipSparkleTimer = 0;

  /* ── Variant module system ── */
  S.variantModules = {};
  S.activeVariantModule = null;

  /* ── Round bookkeeping ── */
  S.roundStartScore = 0;
  S.lastOutcomeSound = 0;
})();
