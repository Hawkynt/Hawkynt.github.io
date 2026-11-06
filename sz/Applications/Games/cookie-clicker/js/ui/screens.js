/* The screen state machine (title, game, paused, tree, collection, journal, ascend, help,
   bakeResult, zen) with return targets, opening the panels from anywhere, the toast queue
   with icons, and the two modal overlays: the welcome-back offline report and the
   yes/no confirmation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI, VIEW_W, LAYOUT } = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const MENUS = { title: 1, paused: 1, tree: 1, collection: 1, journal: 1, ascend: 1, help: 1, bakeResult: 1 };

  function setScreen(s) {
    G.screen = s;
    G.menuCursor = -1;
    G.ui.hover = null;
    if (s === 'game' && G.pendingCine && !G.cine) {
      NS.cinematics.play('stage', G.pendingCine);
      G.pendingCine = null;
    }
    if (NS.statusBar.update) NS.statusBar.update();
  }

  function isMenu() {
    return !!MENUS[G.screen];
  }

  function pause() {
    if (G.screen !== 'game') return;
    setScreen('paused');
    sfx('select', { pitch: 0.8 });
    NS.save.write(G);
  }

  function resume() {
    setScreen(G.bake || G.run ? 'game' : 'title');
  }

  function openTree(ret, page) {
    G.ui.treeReturn = ret || 'game';
    if (page != null) {
      G.ui.treePage = page;
      G.ui.treeSel = NS.treeData.TREE.find(n => NS.treeData.BRANCH_BY_ID[n.branch].page === page).id;
    }
    setScreen('tree');
  }

  function openCollection(ret) {
    G.ui.panelReturn = ret || 'game';
    setScreen('collection');
  }

  function openJournal(ret, tab) {
    G.ui.panelReturn = ret || 'game';
    if (tab != null) G.ui.journalTab = tab;
    G.ui.journalScroll = 0;
    setScreen('journal');
  }

  function openAscend(ret) {
    G.ui.panelReturn = ret || 'game';
    setScreen('ascend');
  }

  function openHelp(ret) {
    G.ui.panelReturn = ret || 'title';
    setScreen('help');
  }

  function back() {
    const r = G.screen === 'tree' ? G.ui.treeReturn : G.ui.panelReturn;
    setScreen(r || 'game');
  }

  /* ---- toasts ---- */
  /* a queue: only the first SHOWN toasts are on screen and ageing, the rest wait their turn */
  const SHOWN = 2, LIFE = 3.4, QUEUE = 10;

  function toast(text, color, icon) {
    const list = G.ui.toasts;
    for (let i = 0; i < list.length; ++i) if (list[i].text === text) return;
    list.push({ text: text, color: color || UI.text, icon: icon || 'star', t: 0 });
    if (list.length > QUEUE) list.splice(SHOWN, 1);
  }

  function updateToasts(dt) {
    const list = G.ui.toasts;
    /* a long queue moves faster */
    const k = list.length > 4 ? 1.8 : 1;
    for (let i = Math.min(SHOWN, list.length) - 1; i >= 0; --i) {
      list[i].t += dt * k;
      if (list[i].t > LIFE) list.splice(i, 1);
    }
  }

  /* cx, top: the slot area (the bakery's free corner under the treat, or beside the title menu) */
  function drawToasts(cx, top, maxW) {
    cx = cx || LAYOUT.treatX;
    top = top || 572;
    maxW = maxW || 440;
    const list = G.ui.toasts;
    const n = Math.min(SHOWN, list.length);
    for (let k = 0; k < n; ++k) {
      const tt = list[k];
      const a = Math.min(1, tt.t * 5, (LIFE - tt.t) * 2);
      const y = top + k * 42;
      const w = Math.min(maxW, kit.width(tt.text, 14, 'bold') + 56);
      const x = cx - w / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, (1 - Math.min(1, tt.t * 5)) * 16);
      kit.panel(x, y, w, 34, { radius: 17, accent: tt.color, glow: true, top: 'rgba(40,24,14,0.96)', bottom: 'rgba(22,12,6,0.96)' });
      kit.icon(tt.icon, x + 20, y + 17, 18, tt.color);
      kit.fitText(tt.text, x + 36, y + 18, w - 46, 14, { weight: 'bold', color: '#ffffff' });
      ctx.restore();
    }
  }

  /* ---- overlays ---- */
  function confirm(title, text, onYes) {
    G.ui.confirm = { title: title, text: text, onYes: onYes };
    G.menuCursor = -1;
  }

  function drawOverlay() {
    const v = NS.view.visible();
    if (G.ui.offline) {
      const o = G.ui.offline;
      ctx.fillStyle = 'rgba(10,4,2,0.6)';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      const x = 340, y = 190, w = 600, h = 330;
      kit.panel(x, y, w, h, { accent: UI.gold, glow: true });
      kit.icon('moon', x + w / 2, y + 46, 40, '#c8d8ff');
      kit.text('Welcome back, baker!', x + w / 2, y + 96, 30, UI.gold, { align: 'center', weight: 'bold', shadow: true });
      kit.text('You were away for ' + fmt.duration(o.away) + (o.capped ? ' (ovens rest after ' + fmt.duration(o.cap) + ')' : ''), x + w / 2, y + 136, 16, UI.textDim, { align: 'center' });
      kit.text('While you were gone the bakery baked', x + w / 2, y + 172, 16, UI.text, { align: 'center' });
      kit.fitText('+' + fmt.long(o.cookies), x + w / 2, y + 212, w - 40, 38, { align: 'center', weight: 'bold', color: '#ffffff', shadow: 'rgba(80,30,0,0.9)' });
      kit.text('at ' + Math.round(o.efficiency * 100) + '% efficiency - research Night Shift and Sleepwalking Staff for more', x + w / 2, y + 248, 13, UI.textMute, { align: 'center' });
      W.button('offline-ok', 'Collect', x + w / 2 - 110, y + h - 62, 220, 46, { action: () => { G.ui.offline = null; sfx('coin'); NS.fx.burst(640, 400, 40, ['#ffd25a', '#fff4b0'], 'coins', 420); }, icon: 'coin' });
      return true;
    }
    if (G.ui.confirm) {
      const c = G.ui.confirm;
      ctx.fillStyle = 'rgba(10,4,2,0.6)';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      const x = 380, y = 240, w = 520, h = 230;
      kit.panel(x, y, w, h, { accent: UI.bad, glow: true });
      kit.text(c.title, x + w / 2, y + 42, 26, '#ffffff', { align: 'center', weight: 'bold' });
      kit.wrap(c.text, x + 30, y + 86, w - 60, 16, UI.textDim);
      W.button('confirm-no', 'Cancel', x + 30, y + h - 66, 210, 46, { action: () => { G.ui.confirm = null; } });
      W.button('confirm-yes', 'Yes', x + w - 240, y + h - 66, 210, 46, { accent: UI.bad, action: () => { const f = c.onYes; G.ui.confirm = null; f(); } });
      return true;
    }
    return false;
  }

  function overlayOpen() {
    return !!(G.ui.offline || G.ui.confirm);
  }

  Object.assign(NS.screens, { setScreen, isMenu, pause, resume, openTree, openCollection, openJournal, openAscend, openHelp, back,
    toast, updateToasts, drawToasts, confirm, drawOverlay, overlayOpen, VIEW_W });
})();
