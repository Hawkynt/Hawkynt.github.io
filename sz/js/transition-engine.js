;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const ALL_TRANSITIONS = [
    'none','fade','cut','fade-black','fade-white','dissolve','crossfade',
    'push-left','push-right','push-up','push-down',
    'cover-left','cover-right','cover-up','cover-down',
    'uncover-left','uncover-right','uncover-up','uncover-down',
    'wipe-left','wipe-right','wipe-up','wipe-down',
    'split-horizontal-out','split-horizontal-in','split-vertical-out','split-vertical-in',
    'reveal-left','reveal-right',
    'circle-in','circle-out','diamond-in','diamond-out',
    'clock-cw','clock-ccw','wedge',
    'blinds-horizontal','blinds-vertical','checkerboard',
    'comb-horizontal','comb-vertical','pixelate','bars-random',
    'zoom-in','zoom-out','zoom-rotate','spin-cw','spin-ccw',
    'flip-horizontal','flip-vertical',
    'cube-left','cube-right','cube-up','cube-down',
    'blur','glitch','morph',
  ];

  const FRONT_ON_TOP = new Set([
    'uncover-left','uncover-right','uncover-up','uncover-down',
    'circle-out','diamond-out',
    'split-horizontal-in','split-vertical-in',
    'flip-horizontal','flip-vertical',
    'glitch',
  ]);

  let pendingLaters = [];
  let pendingRAFs = [];

  function reset(el) {
    el.style.transition = '';
    el.style.clipPath = '';
    el.style.filter = '';
    el.style.transform = '';
    el.style.opacity = '';
    el.style.transformOrigin = '';
    el.style.zIndex = '';
  }

  function cancelPending(subTimers) {
    for (const id of pendingLaters) clearTimeout(id);
    for (const id of pendingRAFs) cancelAnimationFrame(id);
    pendingLaters.length = 0;
    pendingRAFs.length = 0;
    if (subTimers) {
      for (const id of subTimers) clearInterval(id);
      subTimers.clear();
    }
  }

  function resolveTransition(name) {
    const compat = { 'slide-left': 'push-left', 'slide-right': 'push-right', zoom: 'zoom-in' };
    let t = compat[name] || name;
    if (t === 'random')
      t = ALL_TRANSITIONS[Math.floor(Math.random() * ALL_TRANSITIONS.length)];
    return t;
  }

  function runTransition(front, back, transition, duration, subTimers) {
    const _trackedInterval = (fn, ms) => { const id = setInterval(() => fn(id), ms); subTimers?.add(id); return id; };
    const _clearSub = (id) => { clearInterval(id); subTimers?.delete(id); };

    cancelPending(subTimers);

    const _later = (fn, ms) => { const id = setTimeout(fn, ms); pendingLaters.push(id); };
    const _rAF = (fn) => { const id = requestAnimationFrame(fn); pendingRAFs.push(id); };
    reset(front);
    reset(back);

    if (FRONT_ON_TOP.has(transition)) {
      front.style.zIndex = '1';
      back.style.zIndex = '0';
    } else {
      back.style.zIndex = '1';
      front.style.zIndex = '0';
    }

    const d = duration;
    const ease = 'ease';
    const easeIO = 'ease-in-out';

    switch (transition) {

      // -- Instant --
      case 'none':
      case 'cut':
        back.style.opacity = '1';
        front.style.opacity = '0';
        break;
      case 'fade-black':
        front.style.transition = `opacity ${d * 0.5}s ${ease}`;
        front.style.opacity = '0';
        back.style.opacity = '0';
        _later(() => { back.style.transition = `opacity ${d * 0.5}s ${ease}`; back.style.opacity = '1'; }, d * 500);
        break;
      case 'fade-white':
        front.style.transition = `opacity ${d * 0.5}s ${ease}`;
        front.style.opacity = '0';
        back.style.opacity = '0';
        back.style.filter = 'brightness(5)';
        _later(() => { back.style.transition = `opacity ${d * 0.4}s ${ease}, filter ${d * 0.6}s ${ease}`; back.style.opacity = '1'; back.style.filter = 'brightness(1)'; }, d * 400);
        break;
      case 'dissolve':
        back.style.opacity = '0';
        _rAF(() => { back.style.transition = `opacity ${d * 1.5}s ${ease}`; back.style.opacity = '1'; front.style.transition = `opacity ${d * 1.5}s ${ease}`; front.style.opacity = '0'; });
        break;
      case 'crossfade':
        back.style.opacity = '0';
        _rAF(() => { back.style.transition = `opacity ${d}s linear`; back.style.opacity = '1'; front.style.transition = `opacity ${d}s linear`; front.style.opacity = '0'; });
        break;

      // -- Push --
      case 'push-left':
        back.style.opacity = '1'; back.style.transform = 'translateX(100%)';
        _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateX(-100%)'; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'push-right':
        back.style.opacity = '1'; back.style.transform = 'translateX(-100%)';
        _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateX(100%)'; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'push-up':
        back.style.opacity = '1'; back.style.transform = 'translateY(100%)';
        _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateY(-100%)'; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'push-down':
        back.style.opacity = '1'; back.style.transform = 'translateY(-100%)';
        _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateY(100%)'; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;

      // -- Cover --
      case 'cover-left':
        back.style.opacity = '1'; back.style.transform = 'translateX(100%)';
        _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'cover-right':
        back.style.opacity = '1'; back.style.transform = 'translateX(-100%)';
        _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'cover-up':
        back.style.opacity = '1'; back.style.transform = 'translateY(100%)';
        _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'cover-down':
        back.style.opacity = '1'; back.style.transform = 'translateY(-100%)';
        _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;

      // -- Uncover --
      case 'uncover-left':
        back.style.opacity = '1';
        _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateX(-100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'uncover-right':
        back.style.opacity = '1';
        _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateX(100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'uncover-up':
        back.style.opacity = '1';
        _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateY(-100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'uncover-down':
        back.style.opacity = '1';
        _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateY(100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;

      // -- Wipe --
      case 'wipe-left':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 100% 0 0)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'wipe-right':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 0 100%)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'wipe-up':
        back.style.opacity = '1'; back.style.clipPath = 'inset(100% 0 0 0)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'wipe-down':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 100% 0)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;

      // -- Split --
      case 'split-horizontal-out':
        back.style.opacity = '1'; back.style.clipPath = 'inset(50% 0 50% 0)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'split-horizontal-in':
        back.style.opacity = '1'; front.style.clipPath = 'inset(0 0 0 0)';
        _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'inset(50% 0 50% 0)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
        break;
      case 'split-vertical-out':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 50% 0 50%)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'split-vertical-in':
        back.style.opacity = '1'; front.style.clipPath = 'inset(0 0 0 0)';
        _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'inset(0 50% 0 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
        break;

      // -- Reveal --
      case 'reveal-left':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 100% 0 0)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; front.style.transition = `transform ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; front.style.transform = 'translateX(-100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;
      case 'reveal-right':
        back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 0 100%)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; front.style.transition = `transform ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; front.style.transform = 'translateX(100%)'; _later(() => { front.style.opacity = '0'; reset(front); }, d * 1000); });
        break;

      // -- Shape --
      case 'circle-in':
        back.style.opacity = '1'; back.style.clipPath = 'circle(0% at 50% 50%)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'circle(75% at 50% 50%)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'circle-out':
        back.style.opacity = '1'; front.style.clipPath = 'circle(75% at 50% 50%)';
        _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'circle(0% at 50% 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
        break;
      case 'diamond-in':
        back.style.opacity = '1'; back.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)';
        _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
        break;
      case 'diamond-out':
        back.style.opacity = '1'; front.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)';
        _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
        break;

      // -- Clock / Wedge --
      case 'clock-cw':
      case 'clock-ccw':
      case 'wedge': {
        back.style.opacity = '1';
        const ccw = transition === 'clock-ccw';
        const isWedge = transition === 'wedge';
        const steps = 60, stepTime = (d * 1000) / steps;
        let step = 0;
        const _cx = (a) => Math.sin(a * Math.PI / 180) * 75;
        const _cy = (a) => -Math.cos(a * Math.PI / 180) * 75;
        const _poly = (angle) => {
          const pts = ['50% 50%', '50% 0%'];
          const aa = Math.abs(angle);
          if (aa > 45) pts.push(ccw ? '0% 0%' : '100% 0%');
          if (aa > 135) pts.push(ccw ? '0% 100%' : '100% 100%');
          if (aa > 225) pts.push(ccw ? '100% 100%' : '0% 100%');
          if (aa > 315) pts.push(ccw ? '100% 0%' : '0% 0%');
          pts.push(`${50 + _cx(angle)}% ${50 + _cy(angle)}%`);
          return pts.join(', ');
        };
        _trackedInterval((ct) => {
          ++step;
          const p = step / steps;
          if (isWedge) {
            const a = p * 180;
            back.style.clipPath = p > 0.5
              ? `polygon(50% 50%, ${50 + _cx(a)}% ${50 + _cy(a)}%, ${50 + _cx(a - 30)}% ${50 + _cy(a - 30)}%, 50% 0%, ${50 + _cx(-a + 30)}% ${50 + _cy(-a + 30)}%, ${50 + _cx(-a)}% ${50 + _cy(-a)}%)`
              : `polygon(50% 50%, ${50 + _cx(a)}% ${50 + _cy(a)}%, 50% 0%, ${50 + _cx(-a)}% ${50 + _cy(-a)}%)`;
          } else
            back.style.clipPath = `polygon(${_poly((ccw ? -1 : 1) * p * 360)})`;
          if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
        }, stepTime);
        break;
      }

      // -- Blinds --
      case 'blinds-horizontal':
      case 'blinds-vertical': {
        const horiz = transition === 'blinds-horizontal';
        const n = horiz ? 8 : 10;
        back.style.opacity = '1';
        const steps = 30, stepTime = (d * 1000) / steps;
        let step = 0;
        _trackedInterval((bt) => {
          ++step;
          const rects = [], size = 100 / n;
          for (let i = 0; i < n; ++i) {
            const s = i * size, rev = size * (step / steps);
            rects.push(horiz ? `0% ${s}%, 100% ${s}%, 100% ${s + rev}%, 0% ${s + rev}%` : `${s}% 0%, ${s + rev}% 0%, ${s + rev}% 100%, ${s}% 100%`);
          }
          back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
          if (step >= steps) { _clearSub(bt); back.style.clipPath = ''; front.style.opacity = '0'; }
        }, stepTime);
        break;
      }

      // -- Checkerboard --
      case 'checkerboard': {
        back.style.opacity = '1';
        const cols = 8, rows = 6, cw = 100 / cols, ch = 100 / rows;
        const cells = [];
        for (let r = 0; r < rows; ++r) for (let c = 0; c < cols; ++c) cells.push({ r, c, delay: ((r + c) % 2) * 0.3 + Math.random() * 0.4 });
        cells.sort((a, b) => a.delay - b.delay);
        const revealed = new Set(), steps = 20, stepTime = (d * 1000) / steps;
        let step = 0;
        _trackedInterval((ct) => {
          ++step;
          const p = step / steps;
          for (const cell of cells) if (p >= cell.delay / 1.1 && !revealed.has(`${cell.r},${cell.c}`)) revealed.add(`${cell.r},${cell.c}`);
          if (revealed.size === 0)
            back.style.clipPath = 'polygon(0 0, 0 0, 0 0)';
          else {
            const rects = [];
            for (const key of revealed) { const [r, c] = key.split(',').map(Number); const x = c * cw, y = r * ch; rects.push(`${x}% ${y}%, ${x + cw}% ${y}%, ${x + cw}% ${y + ch}%, ${x}% ${y + ch}%`); }
            back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
          }
          if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
        }, stepTime);
        break;
      }

      // -- Comb --
      case 'comb-horizontal':
      case 'comb-vertical': {
        const horiz = transition === 'comb-horizontal';
        const n = horiz ? 10 : 8;
        back.style.opacity = '1';
        const steps = 30, stepTime = (d * 1000) / steps;
        let step = 0;
        _trackedInterval((ct) => {
          ++step;
          const p = step / steps, rects = [], sz = 100 / n;
          for (let i = 0; i < n; ++i) {
            const s = i * sz, fromLeft = i % 2 === 0, rev = 100 * p;
            if (horiz) { const x0 = fromLeft ? 0 : 100 - rev, x1 = fromLeft ? rev : 100; rects.push(`${x0}% ${s}%, ${x1}% ${s}%, ${x1}% ${s + sz}%, ${x0}% ${s + sz}%`); }
            else { const y0 = fromLeft ? 0 : 100 - rev, y1 = fromLeft ? rev : 100; rects.push(`${s}% ${y0}%, ${s + sz}% ${y0}%, ${s + sz}% ${y1}%, ${s}% ${y1}%`); }
          }
          back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
          if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
        }, stepTime);
        break;
      }

      // -- Pixelate --
      case 'pixelate':
        back.style.opacity = '0'; back.style.filter = 'blur(20px)'; front.style.filter = 'blur(0px)';
        _rAF(() => {
          front.style.transition = `filter ${d * 0.4}s ${ease}`;
          front.style.filter = 'blur(20px)';
          _later(() => {
            front.style.transition = `opacity ${d * 0.2}s ${ease}`;
            front.style.opacity = '0';
            back.style.transition = `opacity ${d * 0.2}s ${ease}`;
            back.style.opacity = '1';
            _later(() => {
              back.style.transition = `filter ${d * 0.4}s ${ease}`;
              back.style.filter = 'blur(0px)';
            }, d * 200);
          }, d * 400);
        });
        break;

      // -- Random Bars --
      case 'bars-random': {
        back.style.opacity = '1';
        const n = 20, bw = 100 / n;
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; --i) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const revealed = new Set(), stepTime = (d * 1000) / n;
        let step = 0;
        _trackedInterval((ct) => {
          revealed.add(order[step]); ++step;
          const rects = []; for (const idx of revealed) { const x = idx * bw; rects.push(`${x}% 0%, ${x + bw}% 0%, ${x + bw}% 100%, ${x}% 100%`); }
          back.style.clipPath = rects.length ? `polygon(evenodd, ${rects.join(', ')})` : '';
          if (step >= n) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
        }, stepTime);
        break;
      }

      // -- Zoom & Spin --
      case 'zoom-in':
        back.style.opacity = '0'; back.style.transform = 'scale(1.5)';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1)'; front.style.transition = `opacity ${d}s ${ease}`; front.style.opacity = '0'; });
        break;
      case 'zoom-out':
        back.style.opacity = '0'; back.style.transform = 'scale(0.5)';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1)'; front.style.transition = `opacity ${d * 0.8}s ${ease}, transform ${d}s ${ease}`; front.style.opacity = '0'; front.style.transform = 'scale(1.5)'; _later(() => reset(front), d * 1000); });
        break;
      case 'zoom-rotate':
        back.style.opacity = '0'; back.style.transform = 'scale(0.3) rotate(90deg)';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1) rotate(0deg)'; front.style.transition = `opacity ${d * 0.7}s ${ease}, transform ${d}s ${ease}`; front.style.opacity = '0'; front.style.transform = 'scale(2) rotate(-45deg)'; _later(() => reset(front), d * 1000); });
        break;
      case 'spin-cw':
        back.style.opacity = '0'; back.style.transform = 'rotate(-180deg) scale(0.5)';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`; back.style.opacity = '1'; back.style.transform = 'rotate(0deg) scale(1)'; front.style.transition = `opacity ${d * 0.6}s ${ease}`; front.style.opacity = '0'; });
        break;
      case 'spin-ccw':
        back.style.opacity = '0'; back.style.transform = 'rotate(180deg) scale(0.5)';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`; back.style.opacity = '1'; back.style.transform = 'rotate(0deg) scale(1)'; front.style.transition = `opacity ${d * 0.6}s ${ease}`; front.style.opacity = '0'; });
        break;

      // -- 3D-like --
      case 'flip-horizontal':
        back.style.opacity = '0'; front.style.transformOrigin = '50% 50%'; back.style.transformOrigin = '50% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`; front.style.transform = 'perspective(800px) rotateY(90deg)'; front.style.opacity = '0';
          _later(() => { back.style.transform = 'perspective(800px) rotateY(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${ease}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
        });
        break;
      case 'flip-vertical':
        back.style.opacity = '0'; front.style.transformOrigin = '50% 50%'; back.style.transformOrigin = '50% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`; front.style.transform = 'perspective(800px) rotateX(-90deg)'; front.style.opacity = '0';
          _later(() => { back.style.transform = 'perspective(800px) rotateX(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${ease}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
        });
        break;
      case 'cube-left':
        back.style.opacity = '0'; front.style.transformOrigin = '100% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateY(90deg)';
          _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '0% 50%'; back.style.transform = 'perspective(800px) rotateY(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
        });
        break;
      case 'cube-right':
        back.style.opacity = '0'; front.style.transformOrigin = '0% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateY(-90deg)';
          _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '100% 50%'; back.style.transform = 'perspective(800px) rotateY(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
        });
        break;
      case 'cube-up':
        back.style.opacity = '0'; front.style.transformOrigin = '50% 100%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateX(-90deg)';
          _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '50% 0%'; back.style.transform = 'perspective(800px) rotateX(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
        });
        break;
      case 'cube-down':
        back.style.opacity = '0'; front.style.transformOrigin = '50% 0%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateX(90deg)';
          _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '50% 100%'; back.style.transform = 'perspective(800px) rotateX(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
        });
        break;

      // -- Effects --
      case 'blur':
        back.style.opacity = '0'; back.style.filter = 'blur(30px)'; front.style.filter = 'blur(0px)';
        _rAF(() => {
          front.style.transition = `filter ${d * 0.4}s ${ease}`;
          front.style.filter = 'blur(30px)';
          _later(() => {
            front.style.transition = `opacity ${d * 0.2}s ${ease}`;
            front.style.opacity = '0';
            back.style.transition = `opacity ${d * 0.2}s ${ease}`;
            back.style.opacity = '1';
            _later(() => {
              back.style.transition = `filter ${d * 0.4}s ${ease}`;
              back.style.filter = 'blur(0px)';
            }, d * 200);
          }, d * 400);
        });
        break;
      case 'glitch': {
        back.style.opacity = '1';
        const steps = 12, stepTime = (d * 1000) / steps;
        let step = 0;
        _trackedInterval((gt) => {
          ++step;
          const rx = (Math.random() - 0.5) * 10, ry = (Math.random() - 0.5) * 6, skew = (Math.random() - 0.5) * 5;
          const show = Math.random() > step / steps;
          front.style.transform = `translate(${rx}px, ${ry}px) skewX(${skew}deg)`;
          front.style.opacity = show ? '1' : '0';
          front.style.filter = show ? `hue-rotate(${Math.random() * 90}deg) saturate(${1 + Math.random() * 2})` : '';
          if (step >= steps) { _clearSub(gt); front.style.opacity = '0'; reset(front); }
        }, stepTime);
        break;
      }
      case 'morph':
        back.style.opacity = '0'; back.style.transform = 'scale(1.1)'; back.style.filter = 'blur(10px) brightness(1.2)';
        _rAF(() => {
          const t = `opacity ${d}s ${ease}, transform ${d}s ${ease}, filter ${d}s ${ease}`;
          front.style.transition = t; front.style.opacity = '0'; front.style.transform = 'scale(0.95)'; front.style.filter = 'blur(10px) brightness(1.2)';
          back.style.transition = t; back.style.opacity = '1'; back.style.transform = 'scale(1)'; back.style.filter = 'blur(0px) brightness(1)';
          _later(() => reset(front), d * 1000);
        });
        break;

      // -- Default / fade --
      case 'fade':
      default:
        back.style.opacity = '0';
        _rAF(() => { back.style.transition = `opacity ${d}s ${ease}`; back.style.opacity = '1'; front.style.transition = `opacity ${d}s ${ease}`; front.style.opacity = '0'; });
        break;
    }
  }

  SZ.TransitionEngine = Object.freeze({
    ALL_TRANSITIONS,
    FRONT_ON_TOP,
    runTransition,
    cancelPending,
    reset,
    resolveTransition,
  });
})();
