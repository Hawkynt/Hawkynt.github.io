/* The screen machine (title, modes, map, library, game, paused, results, tree, shop, wardrobe,
   journal, settings, help) with where panels return to, pause (the song stops and saves) and resume
   (it rejoins at its bar after a count-in), the toast queue and the yes/no confirmation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  function setScreen(s, back) {
    if (back) G.back = back;
    if (G.screen === 'title' && s !== 'title') NS.fx.clear();
    G.screen = s;
    G.menuCursor = -1;
    G.ui.hover = null;
    G.ui.scroll = 0;
    if (NS.statusBar.update) NS.statusBar.update();
  }

  function open(s, from) {
    setScreen(s, from || (G.screen === 'paused' ? 'paused' : G.screen === 'game' ? 'paused' : G.screen));
  }

  function back() {
    const to = G.back || 'title';
    G.back = 'title';
    setScreen(to);
  }

  function pause() {
    if (G.screen !== 'game' || G.cine || !G.run || G.run.done) return;
    NS.play.pauseSong();
    setScreen('paused');
    sfx('select', { pitch: 0.8 });
    NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  }

  function resume() {
    if (!G.run || G.run.done) return setScreen('title');
    NS.play.resumeSong();
    setScreen('game');
  }

  /* ---- toasts ---- */
  const SHOWN = 3, LIFE = 3.2;
  function toast(text, color, icon) {
    const list = G.ui.toasts;
    if (list.some(t => t.text === text)) return;
    list.push({ text: text, color: color || UI.text, icon: icon || 'star', t: 0 });
    if (list.length > 12) list.splice(SHOWN, 1);
  }

  function updateToasts(dt) {
    const list = G.ui.toasts;
    for (let i = Math.min(SHOWN, list.length) - 1; i >= 0; --i) {
      list[i].t += dt * (list.length > 5 ? 1.8 : 1);
      if (list[i].t > LIFE) list.splice(i, 1);
    }
  }

  /* on the results the headline owns the top, so popups go below the panels */
  function toastTop() {
    return G.screen === 'results' ? 548 : 14;
  }

  function drawToasts() {
    const list = G.ui.toasts;
    for (let k = 0; k < Math.min(SHOWN, list.length); ++k) {
      const t = list[k];
      const a = Math.min(1, t.t * 5, (LIFE - t.t) * 2);
      const w = Math.min(560, kit.width(t.text, 14, 'bold') + 56);
      const x = 640 - w / 2, y = toastTop() + k * 42;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - Math.min(1, t.t * 5)) * -14);
      kit.panel(x, y, w, 34, { radius: 17, accent: t.color, glow: true });
      kit.icon(t.icon, x + 20, y + 17, 18, t.color);
      kit.fitText(t.text, x + 36, y + 18, w - 46, 14, { weight: 'bold', color: '#ffffff' });
      ctx.restore();
    }
  }

  function confirm(title, text, onYes) {
    G.ui.confirm = { title: title, text: text, onYes: onYes };
    G.menuCursor = -1;
  }

  function drawConfirm() {
    const c = G.ui.confirm;
    if (!c) return false;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,14,0.65)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const x = 380, y = 240, w = 520, h = 230;
    kit.panel(x, y, w, h, { accent: UI.bad, glow: true });
    kit.text(c.title, x + w / 2, y + 42, 26, '#ffffff', { align: 'center', weight: 'bold' });
    kit.wrap(c.text, x + 30, y + 86, w - 60, 16, UI.textDim);
    W.button('confirm-no', 'Cancel', x + 30, y + h - 66, 210, 46, { action: () => { G.ui.confirm = null; } });
    W.button('confirm-yes', 'Yes', x + w - 240, y + h - 66, 210, 46, { accent: UI.bad, action: () => { const f = c.onYes; G.ui.confirm = null; f(); } });
    return true;
  }

  Object.assign(NS.screens, { toastTop, setScreen, open, back, pause, resume, toast, updateToasts, drawToasts, confirm, drawConfirm });
})();
