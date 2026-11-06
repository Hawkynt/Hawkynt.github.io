/* The lobby: profile header, category tabs, the daily featured game, and a grid
   of game tiles with painted miniatures and per-game records. Owns its own hit
   testing; NS.input forwards board-space clicks and hover positions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const PA = NS.paint;
  const P = NS.profile;
  const LB = NS.lobby = NS.lobby || {};

  const W = K.CANVAS_W;
  const TAB_X = 14, TAB_Y = 84, TAB_W = 182, TAB_H = 38, TAB_GAP = 4;
  const GRID_X = 212, GRID_Y = 172, GRID_W = 674, COLS = 4, TILE_H = 92, GAP = 10;
  const TILE_W = (GRID_W - GAP * (COLS - 1)) / COLS;
  const FEAT = { x: 212, y: 82, w: 674, h: 78 };

  const TABS = K.SORTED_CATS.map(c => ({ id: c.name, name: c.name, color: c.color, cat: c }))
    .concat([{ id: '★', name: 'Favourites', color: '#6a5a1a' }, { id: '↺', name: 'Recently played', color: '#3a4a5a' }]);

  LB.tab = 0;
  LB.hover = null;
  LB.pointer = { x: -1, y: -1 };
  let time = 0;
  const miniCache = new Map();

  function categoryOf(id) {
    return K.SORTED_CATS.find(c => c.games.some(g => g.variant.id === id)) || null;
  }
  LB.categoryOf = categoryOf;

  function tabGames(i) {
    const t = TABS[i];
    if (t.cat) return t.cat.games.map(g => g.variant);
    const d = P.data();
    if (t.id === '★') return K.VARIANTS.filter(v => d.favorites[v.id]).sort((a, b) => a.name.localeCompare(b.name));
    return d.recent.map(id => K.VARIANTS.find(v => v.id === id)).filter(Boolean);
  }

  function hash(s) {
    let h = 7;
    for (let i = 0; i < s.length; ++i) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  const UNO_COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5'];

  /* a cached miniature for a tile: three fanned cards that suit the game */
  function mini(v) {
    let c = miniCache.get(v.id);
    if (c) return c;
    const res = Math.max(1, Math.min(2, CE.pixelScale || 1));
    c = document.createElement('canvas');
    c.width = Math.ceil(78 * res);
    c.height = Math.ceil(64 * res);
    const g = c.getContext('2d');
    if (g) {
      g.scale(res, res);
      const h = hash(v.id);
      const cat = categoryOf(v.id);
      const colored = cat && cat.name === 'Shedding' && !/crazy|maumau|president/.test(v.id);
      for (let i = 0; i < 3; ++i) {
        g.save();
        g.translate(39, 70);
        g.rotate((i - 1) * 0.28);
        const x = -17, y = -64, cw = 34, ch = 47;
        if (colored) {
          CE.drawRoundedRect(g, x, y, cw, ch, 3);
          g.fillStyle = '#fff';
          g.fill();
          CE.drawRoundedRect(g, x + 2, y + 2, cw - 4, ch - 4, 2.5);
          g.fillStyle = UNO_COLORS[(h >>> (i * 2)) & 3];
          g.fill();
          g.save();
          g.translate(x + cw / 2, y + ch / 2);
          g.rotate(0.5);
          g.beginPath();
          g.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fill();
          g.restore();
          PA.text(g, String((h >>> (i * 3)) % 10), x + cw / 2, y + ch / 2 + 1, 13, '#222', { shadow: false });
        } else {
          const card = { suit: CE.SUITS[(h >>> (i * 2)) & 3], rank: CE.RANKS[(h >>> (i * 4)) % 13], faceUp: true };
          if (i === 0 && cat && cat.name === 'Solitaire') CE.paintCardBack(g, x, y, cw, ch);
          else CE.paintCardFace(g, x, y, card, cw, ch);
        }
        g.restore();
      }
    }
    miniCache.set(v.id, c);
    return c;
  }
  LB.clearCache = () => miniCache.clear();

  function tileRect(i) {
    return { x: GRID_X + (i % COLS) * (TILE_W + GAP), y: GRID_Y + Math.floor(i / COLS) * (TILE_H + GAP), w: TILE_W, h: TILE_H };
  }
  function tabRect(i) {
    return { x: TAB_X, y: TAB_Y + i * (TAB_H + TAB_GAP), w: TAB_W, h: TAB_H };
  }
  const BTN = {
    style: { x: TAB_X, y: 470, w: TAB_W, h: 32, label: '✿  Table & Cards' },
    trophies: { x: TAB_X, y: 508, w: TAB_W, h: 32, label: '♛  Trophies' },
    stats: { x: TAB_X, y: 546, w: TAB_W, h: 32, label: '☰  Statistics' }
  };
  const PLAY_FEAT = { x: FEAT.x + FEAT.w - 124, y: FEAT.y + 22, w: 108, h: 34 };

  const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  /* ── header ── */
  function drawHeader(cx) {
    PA.goldText(cx, 'Card Games Suite', 24, 38, 30, { align: 'left', shine: (time * 0.18) % 1.6 });
    const lp = P.levelProgress();
    const d = P.data();
    const hx = W - 330;
    PA.panel(cx, hx, 12, 316, 56, { radius: 12 });
    cx.beginPath();
    cx.arc(hx + 30, 40, 19, 0, Math.PI * 2);
    const g = cx.createRadialGradient(hx + 24, 34, 3, hx + 30, 40, 19);
    g.addColorStop(0, '#fff3c0');
    g.addColorStop(1, '#a8700c');
    cx.fillStyle = g;
    cx.fill();
    PA.text(cx, String(lp.level), hx + 30, 41, lp.level > 99 ? 12 : 17, '#3a2404', { shadow: false, serif: true });
    PA.text(cx, 'Level ' + lp.level, hx + 58, 28, 13, '#ffe7a8', { align: 'left' });
    PA.bar(cx, hx + 58, 40, 150, 12, lp.xp / lp.need);
    PA.text(cx, lp.xp + ' / ' + lp.need, hx + 133, 60, 9, '#bfb5a0', { weight: 'normal' });
    const fl = 0.75 + 0.25 * Math.sin(time * 6);
    PA.text(cx, '♨ ' + (d.dayStreak || 0), hx + 238, 30, 14, d.dayStreak > 1 ? 'rgb(255,' + Math.round(150 * fl) + ',60)' : '#9a9080', { align: 'left' });
    PA.text(cx, 'day streak', hx + 238, 48, 9, '#bfb5a0', { align: 'left', weight: 'normal' });
    PA.text(cx, '♛ ' + NS.achievements.earned() + '/' + NS.achievements.LIST.length, hx + 238, 62, 9, '#ffd54f', { align: 'left', weight: 'normal' });
  }

  /* ── featured game of the day ── */
  function drawFeatured(cx) {
    const v = P.featured();
    const cat = categoryOf(v.id);
    const hov = LB.hover === 'feat';
    PA.panel(cx, FEAT.x, FEAT.y, FEAT.w, FEAT.h, { radius: 12, border: hov ? 'rgba(255,220,130,0.95)' : undefined,
      top: CE.art.shade(cat ? cat.color : '#333333', -0.1), bottom: 'rgba(14,12,10,0.96)' });
    cx.save();
    CE.drawRoundedRect(cx, FEAT.x, FEAT.y, FEAT.w, FEAT.h, 12);
    cx.clip();
    PA.rays(cx, FEAT.x + 60, FEAT.y + 40, 150, time, 'rgba(255,214,110,0.20)', 12);
    cx.drawImage(mini(v), FEAT.x + 20, FEAT.y + 8, 78, 64);
    cx.restore();
    const ev = P.event();
    PA.text(cx, ev ? '✦ ' + ev.name.toUpperCase() + '  ·  FEATURED TODAY' : '✦ FEATURED TODAY  ·  ' + P.seasonName().toUpperCase(), FEAT.x + 112, FEAT.y + 20, 11, '#ffd54f', { align: 'left' });
    PA.goldText(cx, v.name, FEAT.x + 112, FEAT.y + 44, 24, { align: 'left' });
    PA.text(cx, v.desc + '  —  double XP all day', FEAT.x + 112, FEAT.y + 64, 12, '#e8dcc0', { align: 'left', weight: 'normal' });
    PA.button(cx, PLAY_FEAT.x, PLAY_FEAT.y, PLAY_FEAT.w, PLAY_FEAT.h, '▶  Play', { color: '#2e6b2e', hover: LB.hover === 'featplay' });
  }

  function drawTabs(cx) {
    for (let i = 0; i < TABS.length; ++i) {
      const r = tabRect(i), t = TABS[i];
      const sel = i === LB.tab, hov = LB.hover === 'tab' + i;
      cx.save();
      if (sel || hov) cx.translate(sel ? 6 : 3, 0);
      CE.drawRoundedRect(cx, r.x, r.y, r.w, r.h, 8);
      const g = cx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      g.addColorStop(0, CE.art.shade(t.color, sel ? 0.25 : 0.05));
      g.addColorStop(1, sel ? CE.art.shade(t.color, -0.2) : 'rgba(10,10,10,0.55)');
      cx.fillStyle = g;
      cx.fill();
      cx.strokeStyle = sel ? 'rgba(255,215,120,0.95)' : hov ? 'rgba(255,215,120,0.6)' : 'rgba(255,215,120,0.18)';
      cx.lineWidth = sel ? 1.6 : 1;
      cx.stroke();
      if (t.cat) PA.emblem(cx, t.name, r.x + 20, r.y + r.h / 2, 0.9, sel ? '#ffe082' : '#d8c8a0');
      else PA.text(cx, t.id, r.x + 20, r.y + r.h / 2 + 1, 17, sel ? '#ffe082' : '#d8c8a0');
      PA.text(cx, t.name, r.x + 40, r.y + r.h / 2 - (t.cat ? 6 : 0), 13, sel ? '#fff4d6' : '#e3d6b8', { align: 'left' });
      if (t.cat) {
        const won = t.cat.games.filter(g => P.game(g.variant.id).won > 0).length;
        PA.text(cx, won + ' of ' + t.cat.games.length + ' conquered', r.x + 40, r.y + r.h / 2 + 9, 9.5, '#bfb5a0', { align: 'left', weight: 'normal' });
      }
      cx.restore();
    }
    for (const id in BTN) {
      const b = BTN[id];
      PA.button(cx, b.x, b.y, b.w, b.h, b.label, { hover: LB.hover === id, fontSize: 13 });
    }
  }

  function drawTiles(cx) {
    const games = tabGames(LB.tab);
    const t = TABS[LB.tab];
    if (!games.length) {
      PA.text(cx, t.id === '★' ? 'Click the ☆ on any game tile to keep it here.' : 'Games you play will show up here.', GRID_X + GRID_W / 2, GRID_Y + 120, 14, '#bfb5a0', { weight: 'normal' });
      return;
    }
    const feat = P.featured();
    for (let i = 0; i < games.length && i < 16; ++i) {
      const v = games[i], r = tileRect(i);
      const hov = LB.hover === 'tile' + i;
      const st = P.game(v.id);
      const cat = categoryOf(v.id);
      const intro = PA.ease.out(PA.clamp01((LB.tabTime - i * 0.03) / 0.3));
      cx.save();
      cx.globalAlpha = intro;
      cx.translate(0, (1 - intro) * 14 - (hov ? 3 : 0));
      PA.panel(cx, r.x, r.y, r.w, r.h, { radius: 10, border: hov ? 'rgba(255,220,130,0.95)' : 'rgba(214,170,80,0.4)',
        top: CE.art.shade(cat ? cat.color : '#333333', hov ? 0.12 : -0.05), bottom: 'rgba(12,10,8,0.95)' });
      cx.save();
      CE.drawRoundedRect(cx, r.x, r.y, r.w, r.h, 10);
      cx.clip();
      if (hov) PA.rays(cx, r.x + 40, r.y + 40, 90, time, 'rgba(255,214,110,0.16)', 10);
      cx.drawImage(mini(v), r.x + 2, r.y + 10, 78, 64);
      cx.restore();
      const nameSize = PA.fitText(cx, v.name, r.w - 86, 14, 'bold', true);
      PA.text(cx, v.name, r.x + 80, r.y + 24, nameSize, '#fff4d6', { align: 'left', serif: true });
      const sub = st.played ? st.won + ' won · ' + st.played + ' played' : 'not played yet';
      PA.text(cx, sub, r.x + 80, r.y + 44, 10, st.played ? '#d8c8a0' : '#9a9080', { align: 'left', weight: 'normal' });
      if (st.best > 1) PA.text(cx, '♨ best streak ' + st.best, r.x + 80, r.y + 60, 10, '#ffab40', { align: 'left', weight: 'normal' });
      if (st.won > 0) PA.text(cx, '♛', r.x + r.w - 16, r.y + r.h - 16, 15, '#ffd54f');
      if (!st.played) {
        PA.ribbon(cx, r.x + r.w - 46, r.y + r.h - 24, 40, 15, '#2e7d32');
        PA.text(cx, 'NEW', r.x + r.w - 26, r.y + r.h - 16, 9, '#fff', { shadow: false });
      }
      if (v.id === feat.id) PA.text(cx, '2×XP', r.x + 80, r.y + 76, 10, '#ffd54f', { align: 'left' });
      const fav = P.data().favorites[v.id];
      PA.text(cx, fav ? '★' : '☆', r.x + r.w - 14, r.y + 14, 15, fav ? '#ffd54f' : (LB.hover === 'fav' + i ? '#ffe7a8' : 'rgba(255,240,200,0.45)'));
      cx.restore();
    }
  }

  LB.tabTime = 0;
  LB.update = function(dt) {
    time += dt;
    LB.tabTime += dt;
  };

  LB.draw = function(cx) {
    drawHeader(cx);
    drawFeatured(cx);
    drawTabs(cx);
    drawTiles(cx);
    if (NS.screens) NS.screens.draw(cx);
  };

  function hitTest(x, y) {
    if (inR(PLAY_FEAT, x, y)) return 'featplay';
    if (inR(FEAT, x, y)) return 'feat';
    for (let i = 0; i < TABS.length; ++i) if (inR(tabRect(i), x, y)) return 'tab' + i;
    for (const id in BTN) if (inR(BTN[id], x, y)) return id;
    const games = tabGames(LB.tab);
    for (let i = 0; i < games.length && i < 16; ++i) {
      const r = tileRect(i);
      if (x >= r.x + r.w - 28 && x <= r.x + r.w && y >= r.y && y <= r.y + 26) return 'fav' + i;
      if (inR(r, x, y)) return 'tile' + i;
    }
    return null;
  }

  LB.pointerMove = function(x, y) {
    LB.pointer.x = x; LB.pointer.y = y;
    if (NS.screens && NS.screens.open()) { LB.hover = null; return; }
    const h = hitTest(x, y);
    if (h !== LB.hover && h && h.indexOf('tile') === 0 && SZ.GameAudio) SZ.GameAudio.play('blip', { volume: 0.15 });
    LB.hover = h;
  };

  /* returns a variant id to start, or null */
  LB.click = function(x, y) {
    if (NS.screens && NS.screens.open()) { NS.screens.click(x, y); return null; }
    const h = hitTest(x, y);
    if (!h) return null;
    const play = (n) => SZ.GameAudio && SZ.GameAudio.play(n, { volume: 0.6 });
    if (h === 'feat' || h === 'featplay') return P.featured().id;
    if (h.indexOf('tab') === 0) {
      const i = +h.slice(3);
      if (i !== LB.tab) { LB.tab = i; LB.tabTime = 0; play('select'); }
      return null;
    }
    if (h === 'style') { if (SZ.CardThemes) SZ.CardThemes.settingsPanelOpen = true; play('click'); return null; }
    if (h === 'trophies' || h === 'stats') { NS.screens.show(h); play('click'); return null; }
    const games = tabGames(LB.tab);
    if (h.indexOf('fav') === 0) { P.toggleFavorite(games[+h.slice(3)].id); play('pickup'); return null; }
    if (h.indexOf('tile') === 0) return games[+h.slice(4)].id;
    return null;
  };

  LB.key = function(e) {
    if (NS.screens && NS.screens.open()) {
      if (e.key === 'Escape') NS.screens.close();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      LB.tab = (LB.tab + (e.key === 'ArrowDown' ? 1 : TABS.length - 1)) % TABS.length;
      LB.tabTime = 0;
    }
  };
})();
