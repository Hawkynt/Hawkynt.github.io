;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Controller = TR.Controller;
  let controller = null;

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas)
      return;
    controller = new Controller();
    TR.app.controller = controller;
    controller.init();
  });
})();
