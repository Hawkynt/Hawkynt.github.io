/* The desktop status bar: cookies, CPS and the game state string. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const statusCookies = NS.dom.statusCookies;
  const statusCps = NS.dom.statusCps;
  const statusState = NS.dom.statusState;
  /* ── Status ── */
  function updateStatus() {
    statusCookies.textContent = 'Cookies: ' + NS.format.formatNumber(S.displayCookies);
    statusCps.textContent = 'CPS: ' + NS.format.formatNumber(S.cps);
    statusState.textContent = S.state;
  }

  Object.assign(NS.status, { updateStatus });
})();
