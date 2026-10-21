/* The window side: field setup with its background and stars, responsive canvas
   scaling, the window resize request and cycling the selectable field size. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function setupField() {
    const size = C.FIELD_SIZES[S.fieldSizeKey].size;
    S.W = size;
    S.H = size;
    S.uiS = S.W / 520;

    D.canvas.width = S.W * D.dpr;
    D.canvas.height = S.H * D.dpr;
    D.ctx.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);

    if (!document.body.classList.contains('flex-layout')) {
      const cssSize = Math.min(S.W, 520);
      D.canvas.style.width = cssSize + 'px';
      D.canvas.style.height = cssSize + 'px';
    } else if (S.resizeCanvasFn)
      S.resizeCanvasFn();

    S.bgCanvas = NS.background.generateBackground();
    NS.background.initStars();
  }

  function canvasCoords(e) {
    const rect = D.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * S.W,
      y: (e.clientY - rect.top) / rect.height * S.H
    };
  }

  function setupCanvasScaling() {
    const frame = document.querySelector('.game-frame');
    if (!frame) return;

    S.resizeCanvasFn = () => {
      if (!document.body.classList.contains('flex-layout')) return;
      const availW = frame.clientWidth - 10;
      const availH = frame.clientHeight - 10;
      const size = Math.max(50, Math.floor(Math.min(availW, availH)));
      D.canvas.style.width = size + 'px';
      D.canvas.style.height = size + 'px';
    };

    new ResizeObserver(S.resizeCanvasFn).observe(frame);
  }

  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      SZ.Dlls.User32.MoveWindow(w, h);
      document.documentElement.classList.add('flex-layout');
      document.body.classList.add('flex-layout');
      if (S.resizeCanvasFn) S.resizeCanvasFn();
    });
  }

  function cycleFieldSize(dir) {
    const idx = C.FIELD_SIZE_KEYS.indexOf(S.fieldSizeKey);
    const newIdx = (idx + dir + C.FIELD_SIZE_KEYS.length) % C.FIELD_SIZE_KEYS.length;
    S.fieldSizeKey = C.FIELD_SIZE_KEYS[newIdx];
    SZ.GameAudio.play('click');
    try { localStorage.setItem(C.FIELD_STORAGE_KEY, S.fieldSizeKey); } catch (_) {}
    setupField();
  }

  Object.assign(NS.os, { setupField, canvasCoords, setupCanvasScaling, requestWindowResize, cycleFieldSize });
})();
