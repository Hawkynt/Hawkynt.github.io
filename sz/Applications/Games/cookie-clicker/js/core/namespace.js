/* The game namespace SZ.CookieClicker with one empty object per function module,
   created up front so modules can keep references to modules that load after them.
   state, dom and the data tables are owned by their own modules, not pre-created here. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const MODULES = ['constants', 'format', 'economy', 'purchasing', 'achievements', 'prestige',
    'saveload', 'draw', 'tooltips', 'status', 'input', 'menu', 'app'];
  for (let i = 0; i < MODULES.length; ++i)
    NS[MODULES[i]] = NS[MODULES[i]] || {};
})();
