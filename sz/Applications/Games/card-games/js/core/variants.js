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

  /* variants live in js/variants/<id>/ split by concern; when a page from an
     older cache did not list them, load the shared helpers and the variant's
     files here in dependency order, skipping the ones a variant does not have */
  const SHARED = ['solitaire-fallback', 'casino-chips', 'quick-piles', 'quick-hands', 'shedding-hand',
    'trick-rules', 'trick-paint', 'rummy-cards', 'rummy-melds', 'euro-cards', 'euro-layout'];
  const PARTS = ['state', 'layout', 'rules', 'flow', 'game', 'anim', 'ai', 'render', 'render-ui', 'input', 'index'];

  function loadScript(src, done) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => done(true);
    script.onerror = () => done(false);
    document.head.appendChild(script);
  }

  function loadChain(list, done) {
    let i = 0;
    const next = () => (i < list.length ? loadScript(list[i++], next) : done());
    next();
  }

  V.loadVariantModule = function(variant, onReady) {
    if (S.variantModules[variant.id]) {
      onReady(S.variantModules[variant.id]);
      return;
    }
    const folder = 'js/variants/' + variant.id + '/';
    const haveShared = Object.keys(SZ.CardGames.shared || {}).length > 0;
    const needShared = haveShared ? [] : SHARED.map(n => 'js/variants/common/' + n + '.js');
    loadChain(needShared.concat(PARTS.map(p => folder + p + '.js')), function() {
      const mod = S.variantModules[variant.id];
      if (mod)
        onReady(mod);
    });
  };
})();
