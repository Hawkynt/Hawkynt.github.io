/* Injects the SVG icon set into the document root as CSS custom properties. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const T = NS.data;
  const IC = NS.icons;

  IC.injectIcons = function injectIcons() {
    const root = document.documentElement.style;
    root.setProperty('--icon-mine', T.svgToDataUri(T.SVG_ICONS.mine));
    root.setProperty('--icon-flag', T.svgToDataUri(T.SVG_ICONS.flag));
    root.setProperty('--face-normal', T.svgToDataUri(T.SVG_ICONS.faceNormal));
    root.setProperty('--face-click', T.svgToDataUri(T.SVG_ICONS.faceClick));
    root.setProperty('--face-win', T.svgToDataUri(T.SVG_ICONS.faceWin));
    root.setProperty('--face-dead', T.svgToDataUri(T.SVG_ICONS.faceDead));
    root.setProperty('--face-skull', T.svgToDataUri(T.SVG_ICONS.faceSkull));
  };
})();
