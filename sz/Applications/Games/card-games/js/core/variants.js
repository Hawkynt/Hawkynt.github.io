/* Variant module registry: variants self-register at load time; the controller
   loads a variant's script on demand only when it has not been loaded already. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const S = NS.state;
  const V = NS.variants = NS.variants || {};

  /* ══════════════════════════════════════════════════════════════════
     VARIANT MODULE SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  SZ.CardGames.registerVariant = function(id, mod) {
    S.variantModules[id] = mod;
  };

  V.loadVariantModule = function(variant, onReady) {
    if (S.variantModules[variant.id]) {
      onReady(S.variantModules[variant.id]);
      return;
    }
    const script = document.createElement('script');
    script.src = variant.module;
    script.onload = function() {
      const mod = S.variantModules[variant.id];
      if (mod)
        onReady(mod);
    };
    document.head.appendChild(script);
  };
})();
