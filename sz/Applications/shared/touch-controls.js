;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // On-screen joystick and buttons for the keyboard-driven games. Every
  // control sends the same keydown/keyup events the keyboard would, so the
  // games keep a single input path. Shown on touch screens only (coarse
  // pointer, or after the first touch); each finger is tracked on its own,
  // so moving and jumping work at the same time.
  //
  //   SZ.TouchControls.attach({
  //     container: document.querySelector('.game-frame'),
  //     stick: 'horizontal' | 'four' | 'eight',  // directions the stick sends
  //     repeat: 180,            // grid games: re-send held directions (ms)
  //     buttons: [ { label: 'Jump', code: 'ArrowUp' }, { label: 'Fire', code: 'Space' } ],
  //     extra: [ { label: 'II', code: 'Escape', title: 'Pause' } ]  // small buttons, top of the right cluster
  //   });

  const KEY_FOR_CODE = {
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    Space: ' ', Enter: 'Enter', Escape: 'Escape', ShiftLeft: 'Shift', ShiftRight: 'Shift'
  };

  function keyFor(def) {
    if (def.key != null)
      return def.key;
    if (KEY_FOR_CODE[def.code])
      return KEY_FOR_CODE[def.code];
    if (/^Key[A-Z]$/.test(def.code))
      return def.code.charAt(3).toLowerCase();
    if (/^Digit[0-9]$/.test(def.code))
      return def.code.charAt(5);
    return def.code;
  }

  function send(type, def, repeat) {
    const ev = new KeyboardEvent(type, {
      key: keyFor(def),
      code: def.code,
      repeat: !!repeat,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(ev);
  }

  let styleInjected = false;
  function injectStyle() {
    if (styleInjected)
      return;
    styleInjected = true;
    const css =
      '.sz-touch{position:absolute;inset:0;pointer-events:none;z-index:50;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
      '.sz-touch-stick{position:absolute;left:14px;bottom:14px;width:var(--sz-touch-stick,132px);height:var(--sz-touch-stick,132px);border-radius:50%;' +
        'background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.10),rgba(255,255,255,.04) 70%);border:2px solid rgba(255,255,255,.28);' +
        'box-shadow:0 2px 10px rgba(0,0,0,.35) inset;pointer-events:auto;touch-action:none}' +
      '.sz-touch-stick.sz-horizontal{height:calc(var(--sz-touch-stick,132px) * .62);border-radius:999px}' +
      '.sz-touch-knob{position:absolute;left:50%;top:50%;width:44%;height:auto;aspect-ratio:1;margin:0;transform:translate(-50%,-50%);border-radius:50%;' +
        'background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.6),rgba(200,210,230,.3) 60%,rgba(120,130,150,.3));border:1px solid rgba(255,255,255,.5);pointer-events:none}' +
      '.sz-touch-stick.sz-horizontal .sz-touch-knob{width:auto;height:72%}' +
      '.sz-touch-arrow{position:absolute;color:rgba(255,255,255,.45);font:bold 14px/1 sans-serif;pointer-events:none}' +
      '.sz-touch-buttons{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:row-reverse;align-items:flex-end;gap:12px;pointer-events:none}' +
      '.sz-touch-btn{width:var(--sz-touch-btn,64px);height:var(--sz-touch-btn,64px);border-radius:50%;border:2px solid rgba(255,255,255,.4);' +
        'background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.28),rgba(255,255,255,.08) 70%);color:rgba(255,255,255,.9);' +
        'font:bold 12px/1.1 sans-serif;text-shadow:0 1px 2px #000;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px;' +
        'pointer-events:auto;touch-action:none;box-shadow:0 2px 8px rgba(0,0,0,.35)}' +
      '.sz-touch-btn:nth-child(2){margin-bottom:calc(var(--sz-touch-btn,64px) * .55)}' +
      '.sz-touch-btn.sz-down,.sz-touch-mini.sz-down{background:radial-gradient(circle at 40% 35%,rgba(255,255,255,.55),rgba(255,255,255,.2) 70%);transform:scale(.94)}' +
      '.sz-touch-extra{position:absolute;right:14px;bottom:calc(var(--sz-touch-btn,64px) * 1.55 + 30px);display:flex;gap:8px;pointer-events:none}' +
      '.sz-touch-mini{min-width:36px;height:30px;padding:0 8px;border-radius:15px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.35);' +
        'color:rgba(255,255,255,.9);font:bold 12px/28px sans-serif;text-align:center;pointer-events:auto;touch-action:none}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function attach(options) {
    const container = options.container;
    const mode = options.stick || 'eight';
    const repeatMs = options.repeat || 0;
    const codes = options.directions || {
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown'
    };

    let root = null;
    let shown = false;
    const held = new Map();     // code -> number of fingers holding it
    const stickDirs = new Set();
    let stickPointer = null;
    let repeatTimer = 0;
    let knob = null;
    let stickEl = null;

    function press(code) {
      const n = held.get(code) || 0;
      held.set(code, n + 1);
      if (n === 0)
        send('keydown', { code });
    }

    function release(code) {
      const n = held.get(code) || 0;
      if (n <= 1) {
        held.delete(code);
        if (n === 1)
          send('keyup', { code });
      } else
        held.set(code, n - 1);
    }

    function releaseAll() {
      for (const code of Array.from(held.keys()))
        send('keyup', { code });
      held.clear();
      stickDirs.clear();
      stickPointer = null;
      clearTimeout(repeatTimer);
      if (knob)
        knob.style.transform = 'translate(-50%,-50%)';
      if (root)
        for (const el of root.querySelectorAll('.sz-down'))
          el.classList.remove('sz-down');
    }

    function scheduleRepeat() {
      clearTimeout(repeatTimer);
      if (!repeatMs || !stickDirs.size)
        return;
      repeatTimer = setTimeout(function tick() {
        for (const dir of stickDirs)
          send('keydown', { code: codes[dir] }, true);
        repeatTimer = setTimeout(tick, repeatMs);
      }, Math.max(repeatMs * 1.6, 240));
    }

    function setStickDirs(next) {
      let changed = false;
      for (const dir of Array.from(stickDirs))
        if (!next.has(dir)) {
          stickDirs.delete(dir);
          release(codes[dir]);
          changed = true;
        }
      for (const dir of next)
        if (!stickDirs.has(dir)) {
          stickDirs.add(dir);
          press(codes[dir]);
          changed = true;
        }
      if (changed)
        scheduleRepeat();
    }

    function stickMove(e) {
      const r = stickEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const radius = Math.max(r.width, r.height) / 2;
      const len = Math.hypot(dx, dy);
      const next = new Set();
      if (mode === 'horizontal') {
        dy = 0;
        if (Math.abs(dx) > radius * 0.18)
          next.add(dx < 0 ? 'left' : 'right');
      } else if (len > radius * 0.25) {
        const angle = Math.atan2(dy, dx);
        if (mode === 'four') {
          if (Math.abs(dx) > Math.abs(dy))
            next.add(dx < 0 ? 'left' : 'right');
          else
            next.add(dy < 0 ? 'up' : 'down');
        } else {
          const sector = Math.round(angle / (Math.PI / 4));   // -4..4
          const map = {
            0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['left', 'down'],
            4: ['left'], '-4': ['left'], '-3': ['left', 'up'], '-2': ['up'], '-1': ['right', 'up']
          };
          for (const d of map[sector])
            next.add(d);
        }
      }
      const limit = radius * 0.55;
      const l = Math.hypot(dx, dy);
      if (l > limit) {
        dx = dx / l * limit;
        dy = dy / l * limit;
      }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px))';
      setStickDirs(next);
    }

    function stickEnd(e) {
      if (e.pointerId !== stickPointer)
        return;
      stickPointer = null;
      knob.style.transform = 'translate(-50%,-50%)';
      setStickDirs(new Set());
    }

    function bindButton(el, def) {
      const pointers = new Set();
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        if (pointers.has(e.pointerId))
          return;
        pointers.add(e.pointerId);
        el.classList.add('sz-down');
        press(def.code);
      });
      const end = (e) => {
        if (!pointers.delete(e.pointerId))
          return;
        if (!pointers.size)
          el.classList.remove('sz-down');
        release(def.code);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    function build() {
      injectStyle();
      root = document.createElement('div');
      root.className = 'sz-touch';
      root.setAttribute('aria-hidden', 'true');

      stickEl = document.createElement('div');
      stickEl.className = 'sz-touch-stick' + (mode === 'horizontal' ? ' sz-horizontal' : '');
      knob = document.createElement('div');
      knob.className = 'sz-touch-knob';
      stickEl.appendChild(knob);
      const arrows = mode === 'horizontal'
        ? [['◀', 'left:8px;top:50%;margin-top:-7px'], ['▶', 'right:8px;top:50%;margin-top:-7px']]
        : [['◀', 'left:7px;top:50%;margin-top:-7px'], ['▶', 'right:7px;top:50%;margin-top:-7px'],
           ['▲', 'top:6px;left:50%;margin-left:-6px'], ['▼', 'bottom:6px;left:50%;margin-left:-6px']];
      for (const a of arrows) {
        const s = document.createElement('span');
        s.className = 'sz-touch-arrow';
        s.textContent = a[0];
        s.style.cssText = a[1];
        stickEl.appendChild(s);
      }
      stickEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (stickPointer != null)
          return;
        stickPointer = e.pointerId;
        try { stickEl.setPointerCapture(e.pointerId); } catch (_) {}
        stickMove(e);
      });
      stickEl.addEventListener('pointermove', (e) => {
        if (e.pointerId === stickPointer)
          stickMove(e);
      });
      stickEl.addEventListener('pointerup', stickEnd);
      stickEl.addEventListener('pointercancel', stickEnd);
      stickEl.addEventListener('lostpointercapture', stickEnd);
      stickEl.addEventListener('contextmenu', (e) => e.preventDefault());
      root.appendChild(stickEl);

      const cluster = document.createElement('div');
      cluster.className = 'sz-touch-buttons';
      for (const def of options.buttons || []) {
        const b = document.createElement('div');
        b.className = 'sz-touch-btn';
        b.textContent = def.label;
        if (def.label.length <= 2)
          b.style.fontSize = '26px';
        if (def.title)
          b.title = def.title;
        bindButton(b, def);
        cluster.appendChild(b);
      }
      root.appendChild(cluster);

      if (options.extra && options.extra.length) {
        const extra = document.createElement('div');
        extra.className = 'sz-touch-extra';
        for (const def of options.extra) {
          const b = document.createElement('div');
          b.className = 'sz-touch-mini';
          b.textContent = def.label;
          if (def.title)
            b.title = def.title;
          bindButton(b, def);
          extra.appendChild(b);
        }
        root.appendChild(extra);
      }

      if (getComputedStyle(container).position === 'static')
        container.style.position = 'relative';
      container.appendChild(root);
      sizeControls();
    }

    function sizeControls() {
      if (!root)
        return;
      const r = container.getBoundingClientRect();
      const base = Math.min(r.width, r.height);
      const stick = Math.max(96, Math.min(150, base * 0.34));
      const btn = Math.max(52, Math.min(76, base * 0.17));
      root.style.setProperty('--sz-touch-stick', stick + 'px');
      root.style.setProperty('--sz-touch-btn', btn + 'px');
    }

    function preventScroll(e) {
      if (shown && e.cancelable)
        e.preventDefault();
    }

    function show() {
      if (shown)
        return;
      if (!root)
        build();
      shown = true;
      root.hidden = false;
      container.style.touchAction = 'none';
      container.style.webkitUserSelect = 'none';
      container.style.userSelect = 'none';
      sizeControls();
    }

    function hide() {
      if (!shown)
        return;
      releaseAll();
      shown = false;
      root.hidden = true;
    }

    container.addEventListener('touchstart', preventScroll, { passive: false });
    container.addEventListener('touchmove', preventScroll, { passive: false });
    container.addEventListener('gesturestart', preventScroll, { passive: false });
    container.addEventListener('dblclick', preventScroll);

    function onFirstTouch() {
      window.removeEventListener('touchstart', onFirstTouch, true);
      show();
    }
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      show();
    else
      window.addEventListener('touchstart', onFirstTouch, true);

    window.addEventListener('resize', sizeControls);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden)
        releaseAll();
    });

    return {
      show,
      hide,
      releaseAll,
      get visible() { return shown; }
    };
  }

  SZ.TouchControls = { attach };
})();
