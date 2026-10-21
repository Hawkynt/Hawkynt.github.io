/* Compact number formatting with the big-number suffixes, and the CPS variant
   that keeps small rates readable. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { SUFFIXES } = NS.constants;
  /* ── Number Formatting ── */
  function formatNumber(n) {
    if (n < 1000)
      return Math.floor(n).toString();
    let idx = 0;
    let val = n;
    while (val >= 1000 && idx < SUFFIXES.length - 1) {
      val /= 1000;
      ++idx;
    }
    return val.toFixed(val < 10 ? 2 : val < 100 ? 1 : 0) + SUFFIXES[idx];
  }

  function formatCPS(n) {
    if (n === 0)
      return '0';
    if (n < 0.01)
      return n.toFixed(3);
    if (n < 1)
      return n.toFixed(2);
    if (n < 10)
      return n.toFixed(1);
    return formatNumber(n);
  }

  Object.assign(NS.format, { formatNumber, formatCPS });
})();
