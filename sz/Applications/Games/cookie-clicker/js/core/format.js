/* Big-number and time formatting: short suffixes (K, M, B ... Vg) with scientific notation
   beyond, long names for headlines, rates with readable small values, compact durations. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
  const LONG = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
    'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion',
    'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

  function group(n) {
    const s = String(Math.floor(n));
    let out = '';
    for (let i = 0; i < s.length; ++i) {
      if (i && (s.length - i) % 3 === 0) out += ',';
      out += s[i];
    }
    return out;
  }

  function tier(n) {
    let idx = 0;
    while (n >= 1000 && idx < SHORT.length - 1) {
      n /= 1000;
      ++idx;
    }
    return { v: n, idx: idx };
  }

  /* 1234 -> "1,234", 1.5e6 -> "1.50M", 1e70 -> "1.00e70" */
  function short(n) {
    if (!isFinite(n)) return 'Infinity';
    if (n < 0) return '-' + short(-n);
    if (n < 1e4) return n < 10 && n !== Math.floor(n) ? n.toFixed(1) : group(n);
    if (n >= 1e66) {
      const e = Math.floor(Math.log10(n));
      return (n / Math.pow(10, e)).toFixed(2) + 'e' + e;
    }
    const t = tier(n);
    return t.v.toFixed(t.v < 10 ? 2 : t.v < 100 ? 1 : 0) + SHORT[t.idx];
  }

  /* headline form: "1.234 million" */
  function long(n) {
    if (!isFinite(n)) return 'Infinity';
    if (n < 1e6) return group(n);
    if (n >= 1e66) return short(n);
    const t = tier(n);
    return t.v.toFixed(3).replace(/\.?0+$/, '') + ' ' + LONG[t.idx];
  }

  /* rates keep decimals while small */
  function rate(n) {
    if (n === 0) return '0';
    if (n < 0.1) return n.toFixed(2);
    if (n < 100) return n.toFixed(1);
    return short(n);
  }

  function duration(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    return s + 's';
  }

  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function percent(f) {
    const p = f * 100;
    return (p < 10 && p !== Math.round(p) ? p.toFixed(1) : Math.round(p)) + '%';
  }

  Object.assign(NS.format, { group, short, long, rate, duration, clock, percent });
})();
