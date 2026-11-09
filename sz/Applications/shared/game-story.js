;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // Story scenes for the games: letterboxed dialogue over the paused game, a
  // pixel portrait per speaker (drawn from a few colours and a headpiece, or by
  // the game), the lines typed out; a click, Space or Enter shows the whole line
  // or turns the page, Esc skips the scene. Each scene plays once per save
  // (sz-story-<id>) and can be watched again from the Goals panel.
  //
  //   const story = SZ.GameStory.create({ id, cast: { key: { name, skin, hair,
  //     cloth, trim, eyes, head, foe, draw(g) } }, scenes: { key: { title,
  //     lines: [{ who, text, name? }] } }, pause(), resume() })   name: a speaker name for this line
  //   story.play(key)  story.replay(key)  story.active()  story.list()
  //   head: helm | goggles | hood | crown | cap | visor | chef | wizard | none

  const CPS = 46;

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* a 32 x 34 pixel bust */
  function drawBust(g, p) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const E = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    const P = (pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
    if (p.draw) { p.draw(g, { R, E, P, shade }); return; }
    const cl = p.cloth, sk = p.skin, hr = p.hair, tr = p.trim;
    E(16, 33, 15, 9, shade(cl, -0.25)); E(16, 32, 13, 7, cl);
    P([12, 24, 16, 30, 20, 24], tr);
    R(13, 20, 6, 5, shade(sk, -0.15));
    E(16, 15, 7, 8, sk); E(14, 13, 3, 3, shade(sk, 0.2));
    R(12, 15, 2, 2, p.eyes || '#223'); R(18, 15, 2, 2, p.eyes || '#223');
    R(12, 13, 3, 1, shade(hr, -0.3)); R(17, 13, 3, 1, shade(hr, -0.3));
    R(14, 19, 4, 1, shade(sk, -0.3));
    const head = p.head || 'none';
    if (head === 'hood') {
      P([6, 22, 8, 8, 16, 3, 24, 8, 26, 22, 22, 12, 10, 12], shade(cl, -0.2));
      P([9, 12, 16, 5, 23, 12], shade(cl, 0.15));
    } else if (head !== 'visor') {
      E(16, 9, 8, 5, hr); R(8, 9, 2, 8, shade(hr, -0.2)); R(22, 9, 2, 8, shade(hr, -0.2));
    }
    if (head === 'helm') { E(16, 8, 9, 5, shade(tr, -0.25)); R(7, 9, 18, 2, shade(tr, -0.45)); P([15, 2, 16, 0, 17, 2, 17, 6, 15, 6], shade(cl, 0.2)); }
    else if (head === 'goggles') { R(9, 9, 14, 2, '#3a2a1a'); E(12, 10, 2.5, 2, shade(tr, 0.3)); E(20, 10, 2.5, 2, shade(tr, 0.3)); }
    else if (head === 'crown') { P([8, 9, 9, 2, 12, 6, 16, 0, 20, 6, 23, 2, 24, 9], tr); R(15, 4, 2, 2, '#ff5a3a'); }
    else if (head === 'cap') { E(16, 8, 9, 4, cl); R(16, 9, 10, 2, shade(cl, -0.3)); R(14, 5, 4, 2, tr); }
    else if (head === 'visor') { E(16, 14, 11, 12, shade(tr, -0.1)); E(16, 15, 8, 8, sk); R(9, 12, 14, 3, 'rgba(120,220,255,0.75)'); R(12, 15, 2, 2, p.eyes || '#223'); R(18, 15, 2, 2, p.eyes || '#223'); }
    else if (head === 'chef') { E(16, 4, 8, 5, '#f4f4f8'); R(10, 6, 12, 4, '#e8e8f0'); }
    else if (head === 'wizard') { P([7, 9, 16, -2, 25, 9], cl); R(6, 8, 20, 2, shade(cl, -0.3)); R(15, 3, 2, 2, tr); }
  }

  function create(cfg) {
    const KEY = 'sz-story-' + cfg.id;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { seen = {}; }
    let cur = null, el = null, timer = null, keyHook = null;
    const faces = {};

    function saveSeen() {
      try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (_) {}
    }

    function face(who) {
      if (faces[who] || typeof document === 'undefined') return faces[who];
      const c = document.createElement('canvas');
      c.width = 32; c.height = 34;
      drawBust(c.getContext('2d'), cfg.cast[who] || { cloth: '#556', skin: '#ccc', hair: '#333', trim: '#fff' });
      faces[who] = c;
      return c;
    }

    function start(key) {
      const sc = cfg.scenes[key];
      if (!sc || !sc.lines.length) return false;
      cur = { key, i: 0, t: 0, lines: sc.lines };
      if (cfg.pause) cfg.pause();
      mount();
      return true;
    }

    function play(key) {
      if (seen[key] || cur) return false;
      seen[key] = 1;
      saveSeen();
      return start(key);
    }

    function replay(key) {
      if (cur) return false;
      return start(key);
    }

    function lineDone() {
      return cur.t * CPS >= cur.lines[cur.i].text.length;
    }

    function next() {
      if (!cur) return;
      if (!lineDone()) { cur.t = 99; draw(); return; }
      if (++cur.i >= cur.lines.length) { end(); return; }
      cur.t = 0;
      draw();
    }

    function skip() {
      if (cur) end();
    }

    function end() {
      cur = null;
      unmount();
      if (cfg.resume) cfg.resume();
    }

    /* ── DOM ── */
    function mount() {
      if (typeof document === 'undefined' || !document.body) return;
      if (SZ.GameGoals && SZ.GameGoals.injectStyle) SZ.GameGoals.injectStyle();
      el = document.createElement('div');
      el.className = 'szs-overlay';
      el.innerHTML = '<div class="szs-dim"></div><div class="szs-bar t"></div><div class="szs-bar b"></div><div class="szs-hint">Click / Space: next  ·  Esc: skip</div><div class="szs-box"><div class="szs-face"></div><div class="szs-text"><b></b><span></span><i></i></div></div>';
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); next(); });
      document.body.appendChild(el);
      keyHook = (e) => {
        if (e.key === 'Escape') skip();
        else if (!e.repeat) next();
        e.stopImmediatePropagation();
        e.preventDefault();
      };
      window.addEventListener('keydown', keyHook, true);
      let last = performance.now();
      timer = setInterval(() => {
        const t = performance.now();
        if (cur) { cur.t += (t - last) / 1000; draw(); }
        last = t;
      }, 33);
      draw();
    }

    function unmount() {
      if (timer) clearInterval(timer);
      timer = null;
      if (keyHook) window.removeEventListener('keydown', keyHook, true);
      keyHook = null;
      if (el) el.remove();
      el = null;
    }

    let shownWho = null;
    function draw() {
      if (!el || !cur) return;
      const line = cur.lines[cur.i], p = cfg.cast[line.who] || { name: line.who, trim: '#ffd75a' };
      const box = el.querySelector('.szs-box');
      box.className = 'szs-box' + (p.foe ? ' foe' : '');
      box.style.setProperty('--c', p.trim || '#ffd75a');
      if (shownWho !== line.who) {
        shownWho = line.who;
        const f = el.querySelector('.szs-face');
        f.innerHTML = '';
        const c = face(line.who);
        if (c) { const img = document.createElement('canvas'); img.width = 32; img.height = 34; img.getContext('2d').drawImage(c, 0, 0); f.appendChild(img); }
      }
      el.querySelector('.szs-text b').textContent = line.name || p.name || line.who;
      el.querySelector('.szs-text span').textContent = line.text.slice(0, Math.floor(cur.t * CPS));
      el.querySelector('.szs-text i').textContent = lineDone() && Math.floor(performance.now() / 400) % 2 === 0 ? (cur.i + 1 < cur.lines.length ? '▼' : '■') : '';
    }

    function list() {
      return Object.keys(cfg.scenes).map(k => ({ key: k, title: cfg.scenes[k].title || k, seen: !!seen[k] }));
    }

    return { play, replay, next, skip, active: () => !!cur, seen: k => !!seen[k], list, current: () => cur };
  }

  SZ.GameStory = { create, drawBust };
})();
