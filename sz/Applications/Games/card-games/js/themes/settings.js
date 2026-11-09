/* The "Table & Cards" panel: painted previews of every table, card back and face
   style, locks with the way to earn each locked one, custom back colours and the
   motion / shadow switches. Open from the lobby or the table's Style button. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  const FX_KEY = 'sz-card-games-fx';
  const BOX = { x: 40, y: 18, w: 820, h: 564 };
  const CUSTOM_COLORS = ['#1a237e', '#8b1a1a', '#1b5e20', '#b8860b', '#4a148c', '#004d40', '#bf360c', '#263238'];
  const TBL = { x: BOX.x + 30, y: BOX.y + 84, w: 88, h: 54, gap: 8, cols: 8 };
  const BCK = { x: BOX.x + 30, y: BOX.y + 250, w: 52, h: 72, gap: 13, cols: 11 };
  const FCE = { x: BOX.x + 30, y: BOX.y + 452, w: 110, h: 74, gap: 12 };
  const CLOSE = { x: BOX.x + BOX.w - 110, y: BOX.y + 18, w: 90, h: 30 };

  let open = false;
  let t = 0;
  let hoverHint = '';
  const previews = new Map();

  /* options persisted next to the theme */
  try {
    const o = JSON.parse(localStorage.getItem(FX_KEY) || '{}');
    if (o.motion === false) CE.motion.enabled = false;
    if (o.shadows === false) CE.cardShadows = false;
  } catch (_) {}
  function saveFx() {
    try { localStorage.setItem(FX_KEY, JSON.stringify({ motion: CE.motion.enabled, shadows: CE.cardShadows })); } catch (_) {}
  }

  function profile() {
    return SZ.CardGames && SZ.CardGames.profile;
  }
  function unlocked(kind, id) {
    /* felts from the goals layer unlock there */
    const T = kind === 'table' && CT.TABLE_THEMES[id];
    if (T && T.unlock && T.unlock.goal) return !!(SZ.CardGames.meta && SZ.CardGames.meta.goals && SZ.CardGames.meta.goals.owns(T.unlock.goal));
    const P = profile();
    return !P || P.isUnlocked(kind, id);
  }

  function preview(key, w, h, paint) {
    const res = Math.max(1, Math.min(2, CE.pixelScale || 1));
    const k = key + '@' + res;
    let c = previews.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(w * res);
      c.height = Math.ceil(h * res);
      const g = c.getContext('2d');
      if (g) { g.scale(res, res); paint(g); }
      previews.set(k, c);
    }
    return c;
  }

  function tableRect(i) {
    return { x: TBL.x + (i % TBL.cols) * (TBL.w + TBL.gap), y: TBL.y + Math.floor(i / TBL.cols) * (TBL.h + 22), w: TBL.w, h: TBL.h };
  }
  function backRect(i) {
    return { x: BCK.x + (i % BCK.cols) * (BCK.w + BCK.gap), y: BCK.y + Math.floor(i / BCK.cols) * (BCK.h + 10), w: BCK.w, h: BCK.h };
  }
  function faceRect(i) {
    return { x: FCE.x + i * (FCE.w + FCE.gap), y: FCE.y, w: FCE.w, h: FCE.h };
  }
  function swatchRect(i) {
    return { x: BOX.x + 540 + (i % 4) * 34, y: BOX.y + 452 + Math.floor(i / 4) * 34, w: 28, h: 28 };
  }
  const TOGGLES = [
    { id: 'motion', label: 'Card motion', x: BOX.x + 690, y: BOX.y + 452, w: 110, h: 28 },
    { id: 'shadows', label: 'Card shadows', x: BOX.x + 690, y: BOX.y + 488, w: 110, h: 28 }
  ];
  const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  function lockOverlay(cx, r, item) {
    cx.save();
    CE.drawRoundedRect(cx, r.x, r.y, r.w, r.h, 6);
    cx.fillStyle = 'rgba(0,0,0,0.62)';
    cx.fill();
    cx.fillStyle = '#d8c8a0';
    cx.font = 'bold 16px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2 - 4);
    const u = item.unlock || {};
    const short = u.level ? 'Level ' + u.level : u.season ? u.season[0].toUpperCase() + u.season.slice(1) : u.event ? 'Event' : 'Trophy';
    cx.font = '9px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    cx.fillText(short, r.x + r.w / 2, r.y + r.h / 2 + 14);
    cx.restore();
  }

  function selectFrame(cx, r, on, hov) {
    if (!on && !hov) return;
    CE.drawRoundedRect(cx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
    cx.strokeStyle = on ? '#ffd54f' : 'rgba(255,220,140,0.5)';
    cx.lineWidth = on ? 2.5 : 1.5;
    cx.stroke();
  }

  function label(cx, text, x, y, color, size, align) {
    cx.font = (size >= 14 ? 'bold ' : '') + size + 'px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    cx.textAlign = align || 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = color;
    cx.fillText(text, x, y);
  }

  function drawSettingsPanel(cx) {
    if (!open) return;
    t += 1 / 60;
    const NS = SZ.CardGames;
    const PA = NS.paint;
    const p = PA.ease.out(PA.clamp01(t / 0.25));
    const ptr = CE.pointer;
    hoverHint = '';
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,' + 0.6 * p + ')';
    cx.fillRect(-2000, -2000, 5000, 5000);
    cx.globalAlpha = p;
    PA.panel(cx, BOX.x, BOX.y, BOX.w, BOX.h, { radius: 14 });
    PA.goldText(cx, 'Table & Cards', BOX.x + 30, BOX.y + 36, 26, { align: 'left' });
    PA.button(cx, CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, 'Close', { hover: inR(CLOSE, ptr.x, ptr.y) });

    /* tables */
    label(cx, 'Table', BOX.x + 30, BOX.y + 70, '#ffe7a8', 14, 'left');
    const tKeys = Object.keys(CT.TABLE_THEMES);
    tKeys.forEach((id, i) => {
      const th = CT.TABLE_THEMES[id], r = tableRect(i);
      const hov = inR(r, ptr.x, ptr.y);
      cx.drawImage(preview('t|' + id, r.w, r.h, (g) => {
        g.save();
        CE.drawRoundedRect(g, 0, 0, r.w, r.h, 6);
        g.clip();
        g.scale(r.w / 300, r.h / 184);
        th.paint(g, 300, 184);
        g.restore();
      }), r.x, r.y, r.w, r.h);
      selectFrame(cx, r, CT.activeTheme.table === id, hov);
      if (!unlocked('table', id)) lockOverlay(cx, r, th);
      label(cx, th.name, r.x + r.w / 2, r.y + r.h + 9, '#d8c8a0', 9);
      if (hov) hoverHint = th.name + (unlocked('table', id) ? '' : '  —  ' + (th.unlock && th.unlock.goal ? SZ.CardGames.meta.goals.unlockText(th.unlock.goal) : profile().unlockHint(th)));
    });

    /* card backs */
    label(cx, 'Card back', BOX.x + 30, BOX.y + 236, '#ffe7a8', 14, 'left');
    const bKeys = Object.keys(CT.CARD_BACK_DESIGNS);
    bKeys.forEach((id, i) => {
      const d = CT.CARD_BACK_DESIGNS[id], r = backRect(i);
      const hov = inR(r, ptr.x, ptr.y);
      const key = 'b|' + id + (id === 'custom' ? CT.activeTheme.customBackColor : '');
      CE.paintCardShadow(cx, r.x + 1, r.y + 2, r.w, r.h);
      cx.drawImage(preview(key, r.w, r.h, (g) => d.draw(g, 0, 0, r.w, r.h)), r.x, r.y, r.w, r.h);
      selectFrame(cx, r, CT.activeTheme.cardBack === id, hov);
      if (!unlocked('back', id)) lockOverlay(cx, r, d);
      if (hov) hoverHint = d.name + (unlocked('back', id) ? '' : '  —  ' + profile().unlockHint(d));
    });

    /* faces */
    label(cx, 'Card faces', BOX.x + 30, BOX.y + 438, '#ffe7a8', 14, 'left');
    const fKeys = Object.keys(CT.CARD_FACE_TEMPLATES);
    fKeys.forEach((id, i) => {
      const r = faceRect(i);
      const hov = inR(r, ptr.x, ptr.y);
      cx.drawImage(preview('f|' + id, r.w, r.h, (g) => {
        const keep = CT.activeTheme.cardFace;
        CT.activeTheme.cardFace = id;
        CE.art.drawFace(g, 4, 4, { suit: 'hearts', rank: 'K' }, 48, 66);
        CE.art.drawFace(g, 58, 4, { suit: 'spades', rank: 'A' }, 48, 66);
        CT.activeTheme.cardFace = keep;
      }), r.x, r.y, r.w, r.h);
      selectFrame(cx, r, CT.activeTheme.cardFace === id, hov);
      label(cx, CT.CARD_FACE_TEMPLATES[id].name, r.x + r.w / 2, r.y + r.h + 10, '#d8c8a0', 9);
    });

    if (CT.activeTheme.cardBack === 'custom') {
      label(cx, 'Back colour', BOX.x + 540, BOX.y + 438, '#ffe7a8', 12, 'left');
      CUSTOM_COLORS.forEach((c, i) => {
        const r = swatchRect(i);
        CE.drawRoundedRect(cx, r.x, r.y, r.w, r.h, 5);
        cx.fillStyle = c;
        cx.fill();
        cx.strokeStyle = CT.activeTheme.customBackColor === c ? '#ffd54f' : 'rgba(255,255,255,0.3)';
        cx.lineWidth = CT.activeTheme.customBackColor === c ? 2.5 : 1;
        cx.stroke();
      });
    }
    for (const tg of TOGGLES) {
      const on = tg.id === 'motion' ? CE.motion.enabled : CE.cardShadows;
      PA.button(cx, tg.x, tg.y, tg.w, tg.h, (on ? '✔ ' : '☐ ') + tg.label, { fontSize: 11, color: on ? '#2f6a32' : '#3a3226', hover: inR(tg, ptr.x, ptr.y) });
    }
    if (hoverHint) label(cx, hoverHint, BOX.x + BOX.w / 2, BOX.y + BOX.h - 14, '#ffe7a8', 12);
    cx.restore();
  }

  function apply(opts) {
    CT.setTheme(opts);
    CE.clearSpriteCache();
    if (SZ.CardGames.lobby) SZ.CardGames.lobby.clearCache();
    if (SZ.GameAudio) SZ.GameAudio.play('select', { volume: 0.5 });
  }

  function handleSettingsClick(mx, my) {
    if (!open) return false;
    if (inR(CLOSE, mx, my) || !inR(BOX, mx, my)) {
      open = false;
      return true;
    }
    const tKeys = Object.keys(CT.TABLE_THEMES);
    for (let i = 0; i < tKeys.length; ++i)
      if (inR(tableRect(i), mx, my)) {
        if (unlocked('table', tKeys[i])) apply({ table: tKeys[i] });
        else if (SZ.GameAudio) SZ.GameAudio.play('error', { volume: 0.5 });
        return true;
      }
    const bKeys = Object.keys(CT.CARD_BACK_DESIGNS);
    for (let i = 0; i < bKeys.length; ++i)
      if (inR(backRect(i), mx, my)) {
        if (unlocked('back', bKeys[i])) apply({ cardBack: bKeys[i] });
        else if (SZ.GameAudio) SZ.GameAudio.play('error', { volume: 0.5 });
        return true;
      }
    const fKeys = Object.keys(CT.CARD_FACE_TEMPLATES);
    for (let i = 0; i < fKeys.length; ++i)
      if (inR(faceRect(i), mx, my)) { apply({ cardFace: fKeys[i] }); return true; }
    if (CT.activeTheme.cardBack === 'custom')
      for (let i = 0; i < CUSTOM_COLORS.length; ++i)
        if (inR(swatchRect(i), mx, my)) { apply({ customBackColor: CUSTOM_COLORS[i] }); return true; }
    for (const tg of TOGGLES)
      if (inR(tg, mx, my)) {
        if (tg.id === 'motion') CE.motion.enabled = !CE.motion.enabled;
        else CE.cardShadows = !CE.cardShadows;
        saveFx();
        return true;
      }
    return true;
  }

  CT.drawSettingsPanel = drawSettingsPanel;
  CT.handleSettingsClick = handleSettingsClick;
  Object.defineProperty(CT, 'settingsPanelOpen', {
    get: function() { return open; },
    set: function(v) { if (v && !open) t = 0; open = v; },
    enumerable: true,
    configurable: true
  });
})();
