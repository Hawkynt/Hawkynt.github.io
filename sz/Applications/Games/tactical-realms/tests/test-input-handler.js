;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const InputHandler = window.SZ.TacticalRealms.InputHandler;

  function createMockCanvas() {
    const listeners = {};
    return {
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1280, height: 720 };
      },
      addEventListener(type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      removeEventListener(type, fn) {
        if (!listeners[type]) return;
        const idx = listeners[type].indexOf(fn);
        if (idx >= 0) listeners[type].splice(idx, 1);
      },
      setAttribute() {},
      setPointerCapture() {},
      releasePointerCapture() {},
      _dispatch(type, eventProps) {
        const evt = { type, button: 0, pointerId: 1, preventDefault() {}, ...eventProps };
        if (listeners[type])
          for (const fn of listeners[type]) fn(evt);
      },
      _listeners: listeners
    };
  }

  describe('InputHandler', () => {

    it('screenToTile() converts canvas coords to tile coords', () => {
      const handler = new InputHandler(null, { width: 940, height: 660, tileSize: 32 });
      const tile = handler.screenToTile(64, 96, { x: 0, y: 0 });
      assert.equal(tile.col, 2);
      assert.equal(tile.row, 3);
    });

    it('screenToTile() accounts for camera offset', () => {
      const handler = new InputHandler(null, { tileSize: 32 });
      const tile = handler.screenToTile(10, 10, { x: 64, y: 32 });
      assert.equal(tile.col, 2);
      assert.equal(tile.row, 1);
    });

    it('screenToTile() handles zero camera', () => {
      const handler = new InputHandler(null, { tileSize: 32 });
      const tile = handler.screenToTile(0, 0, null);
      assert.equal(tile.col, 0);
      assert.equal(tile.row, 0);
    });

    it('screenToTile() handles partial tile positions', () => {
      const handler = new InputHandler(null, { tileSize: 32 });
      const tile = handler.screenToTile(31, 31, { x: 0, y: 0 });
      assert.equal(tile.col, 0);
      assert.equal(tile.row, 0);
      const tile2 = handler.screenToTile(32, 32, { x: 0, y: 0 });
      assert.equal(tile2.col, 1);
      assert.equal(tile2.row, 1);
    });

    it('fires click event on pointer down+up without drag', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let clicked = null;
      handler.on('click', (e) => { clicked = e; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 200 });
      canvas._dispatch('pointerup', { clientX: 100, clientY: 200 });
      assert.ok(clicked);
      assert.closeTo(clicked.x, 100, 1);
      assert.closeTo(clicked.y, 200, 1);
    });

    it('fires hover event on pointer move without button down', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let hovered = null;
      handler.on('hover', (e) => { hovered = e; });
      canvas._dispatch('pointermove', { clientX: 50, clientY: 50 });
      assert.ok(hovered);
    });

    it('fires dragStart and dragMove when pointer moves past threshold', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let dragStarted = false;
      let dragMoved = false;
      handler.on('dragStart', () => { dragStarted = true; });
      handler.on('dragMove', () => { dragMoved = true; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointermove', { clientX: 100, clientY: 100 });
      assert.ok(!dragStarted);
      canvas._dispatch('pointermove', { clientX: 110, clientY: 110 });
      assert.ok(dragStarted);
      assert.ok(dragMoved);
    });

    it('fires dragEnd on pointer up after drag', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let dragEnded = false;
      handler.on('dragEnd', () => { dragEnded = true; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointermove', { clientX: 120, clientY: 120 });
      canvas._dispatch('pointerup', { clientX: 120, clientY: 120 });
      assert.ok(dragEnded);
    });

    it('does not fire click after drag', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let clicked = false;
      handler.on('click', () => { clicked = true; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointermove', { clientX: 120, clientY: 120 });
      canvas._dispatch('pointerup', { clientX: 120, clientY: 120 });
      assert.ok(!clicked);
    });

    it('fires rightClick on contextmenu', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let rightClicked = null;
      handler.on('rightClick', (e) => { rightClicked = e; });
      canvas._dispatch('contextmenu', { clientX: 200, clientY: 300 });
      assert.ok(rightClicked);
    });

    it('off() removes event listener', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let count = 0;
      const cb = () => ++count;
      handler.on('click', cb);
      canvas._dispatch('pointerdown', { clientX: 0, clientY: 0 });
      canvas._dispatch('pointerup', { clientX: 0, clientY: 0 });
      assert.equal(count, 1);
      handler.off('click', cb);
      canvas._dispatch('pointerdown', { clientX: 0, clientY: 0 });
      canvas._dispatch('pointerup', { clientX: 0, clientY: 0 });
      assert.equal(count, 1);
    });

    it('destroy() removes all canvas event listeners', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      handler.destroy();
      assert.equal((canvas._listeners['pointerdown'] || []).length, 0);
      assert.equal((canvas._listeners['pointermove'] || []).length, 0);
      assert.equal((canvas._listeners['pointerup'] || []).length, 0);
      assert.equal((canvas._listeners['contextmenu'] || []).length, 0);
    });

    it('handles scaled canvas (getBoundingClientRect differs from logical size)', () => {
      const canvas = createMockCanvas();
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 470, height: 330 });
      const handler = new InputHandler(canvas, { width: 940, height: 660 });
      let clicked = null;
      handler.on('click', (e) => { clicked = e; });
      canvas._dispatch('pointerdown', { clientX: 235, clientY: 165 });
      canvas._dispatch('pointerup', { clientX: 235, clientY: 165 });
      assert.ok(clicked);
      assert.closeTo(clicked.x, 470, 1);
      assert.closeTo(clicked.y, 330, 1);
    });

    it('fires doubleClick on two rapid clicks at same position', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let dblClicked = null;
      handler.on('doubleClick', (e) => { dblClicked = e; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerup', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerup', { clientX: 100, clientY: 100 });
      assert.ok(dblClicked, 'doubleClick should fire');
      assert.closeTo(dblClicked.x, 100, 1);
      assert.closeTo(dblClicked.y, 100, 1);
    });

    it('does not fire doubleClick if clicks are too far apart spatially', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let dblClicked = false;
      handler.on('doubleClick', () => { dblClicked = true; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerup', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerdown', { clientX: 200, clientY: 200 });
      canvas._dispatch('pointerup', { clientX: 200, clientY: 200 });
      assert.ok(!dblClicked, 'doubleClick should not fire for distant clicks');
    });

    it('does not fire doubleClick after a drag', () => {
      const canvas = createMockCanvas();
      const handler = new InputHandler(canvas);
      let dblClicked = false;
      handler.on('doubleClick', () => { dblClicked = true; });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerup', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointerdown', { clientX: 100, clientY: 100 });
      canvas._dispatch('pointermove', { clientX: 120, clientY: 120 });
      canvas._dispatch('pointerup', { clientX: 120, clientY: 120 });
      assert.ok(!dblClicked, 'doubleClick should not fire after drag');
    });
  });
})();
