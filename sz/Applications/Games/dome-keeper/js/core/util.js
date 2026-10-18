;(function() {
  'use strict';

  // Seeded random generator, offscreen canvas factory and colour helpers.
  // Owns: NS.util

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;

  /* ======================================================================
     DRAWING HELPERS
     ====================================================================== */

  // Seeded pseudo-random generator so cached art looks the same every run
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Mix two '#rrggbb' colours
  function mixHex(a, b, t) {
    const A = parseHex(a), Bc = parseHex(b);
    return `rgb(${A[0] + (Bc[0] - A[0]) * t | 0},${A[1] + (Bc[1] - A[1]) * t | 0},${A[2] + (Bc[2] - A[2]) * t | 0})`;
  }

  NS.util = { makeRng, makeCanvas, mixHex, parseHex, hexToRgba };
})();
