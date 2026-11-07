/* One frame: the letterboxed plane with screen shake, the kitchen backdrop, then the current
   screen - title, Zen Kitchen, or the bakery (treat, counter, strip, bakery scenes, store,
   golden treats, combo, buffs, navigation buttons, juice, toasts, tooltip) with any menu
   panel drawn over it - then a cinematic or modal overlay, flash and vignette. Panels and
   overlays reset the hit areas so only the top layer is clickable. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const W = NS.widgets;
  const kit = NS.kit;
  const { ctx } = NS.view;

  const PANELS = {
    paused: () => NS.pause.drawPause(), tree: () => NS.tree.draw(), collection: () => NS.collection.draw(), journal: () => NS.journal.draw(),
    ascend: () => NS.pause.drawAscend(), help: () => NS.pause.drawHelp(), bakeResult: () => NS.pause.drawBakeResult(),
    garden: () => NS.gardenUi.draw(), trials: () => NS.pause.drawTrials(),
  };

  function nav() {
    const p = G.profile;
    const items = [
      ['n-tree', 'Tree', 'tree', UI.notes, () => NS.screens.openTree('game')],
      ['n-coll', 'Collection', 'palette', '#ff9ac8', () => NS.screens.openCollection('game')],
      ['n-journal', 'Journal', 'trophy', UI.gold, () => NS.screens.openJournal('game')],
    ];
    if (NS.garden.unlocked() && !G.bake) items.push(['n-garden', 'Garden', 'leaf', UI.good, () => NS.gardenUi.open('game')]);
    items.push(['n-menu', 'Menu', 'gear', UI.textDim, () => NS.screens.pause()]);
    const x0 = 924, y = 12, h = 66, gap = items.length > 4 ? 6 : 8, w = (344 - gap * (items.length - 1)) / items.length;
    let canResearch = 0;
    for (let i = 0; i < NS.treeData.TREE.length; ++i) if (NS.economy.nodeState(p, NS.treeData.TREE[i].id) === 'available') ++canResearch;
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      const x = x0 + i * (w + gap);
      const hot = W.area(it[0], x, y, w, h, it[4]);
      kit.panel(x, y, w, h, { radius: 12, accent: it[3], glow: hot });
      kit.icon(it[2], x + w / 2, y + 26 + (hot ? -2 : 0), 26, hot ? '#ffffff' : it[3]);
      kit.fitText(it[1], x + w / 2, y + 52, w - 6, 12, { color: hot ? '#ffffff' : UI.textDim, align: 'center', weight: 'bold' });
      if (it[0] === 'n-garden' && ripeCount()) {
        NS.artKit.circle(ctx, x + w - 8, y + 8, 10, UI.good);
        kit.text(String(ripeCount()), x + w - 8, y + 8, 11, '#06240a', { align: 'center', weight: 'bold' });
      }
      if (i === 0 && canResearch) {
        NS.artKit.circle(ctx, x + w - 8, y + 8, 10, UI.good);
        kit.text(String(canResearch), x + w - 8, y + 8, 11, '#06240a', { align: 'center', weight: 'bold' });
      }
    }
  }

  function ripeCount() {
    const g = G.profile.garden;
    let n = 0;
    for (let i = 0; i < 36; ++i) if (NS.garden.inside(g, i) && NS.garden.isMature(g.plots[i])) ++n;
    return n;
  }

  /* the Sanctum Trial under way, under the treat */
  function trialPill() {
    const t = NS.trials.current();
    if (!t || G.bake) return;
    const w = 400, x = NS.constants.LAYOUT.treatX - w / 2, y = 516;
    kit.panel(x, y, w, 44, { radius: 14, accent: UI.crystal, glow: Math.sin(G.time * 2) > 0.6 });
    kit.icon(t.icon, x + 22, y + 22, 18, UI.crystal);
    kit.fitText('Trial: ' + t.name, x + 40, y + 15, w - 52, 13, { weight: 'bold', color: '#ffffff' });
    kit.fitText(NS.trials.goalText(t), x + 40, y + 32, w - 52, 12, { color: UI.textDim });
  }

  const fills = {};
  function opaque(s) {
    const v = NS.view.visible();
    const key = s === 'tree' && G.ui.treePage ? 'sanctum' : s === 'ascend' || s === 'trials' ? 'ascend' : s === 'garden' ? 'garden' : 'menu';
    if (!fills[key]) {
      const gr = ctx.createRadialGradient(640, 300, 80, 640, 360, 900);
      const c = key === 'menu' ? ['#2e1a10', '#120804'] : key === 'garden' ? ['#24402a', '#0a140c'] : ['#2a1238', '#0c0414'];
      gr.addColorStop(0, c[0]);
      gr.addColorStop(1, c[1]);
      fills[key] = gr;
    }
    ctx.fillStyle = fills[key];
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
  }

  function drawGame() {
    NS.sceneRender.draw();
    NS.store.draw();
    NS.hud.drawStrip();
    nav();
    NS.hud.drawCounter();
    NS.hud.drawTreat();
    NS.hud.drawCombo();
    trialPill();
    NS.hud.drawBuffs();
    NS.hud.drawGoldens();
    NS.fxRender.draw();
    NS.screens.drawToasts();
    NS.store.drawTooltip();
  }

  function draw() {
    W.beginFrame();
    G.ui.hover = null;
    NS.view.begin();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    const run = G.active();
    const s = G.screen;
    NS.backdrop.draw(s === 'title' || s === 'zen' ? Math.max(G.profile.stageMax, run ? run.stage : 0) : run.stage);
    NS.backdrop.drawVignette();
    if (s === 'title') {
      NS.title.draw();
      NS.fxRender.draw();
      NS.screens.drawToasts(960, 494, 400);
    } else if (s === 'zen') {
      NS.fxRender.draw();
      NS.pause.drawZen();
    } else if (PANELS[s]) {
      /* menu panels replace the bakery on an opaque backdrop: nothing of the game reads through */
      opaque(s);
      PANELS[s]();
      if (s === 'tree' || s === 'garden') NS.fxRender.draw();
    } else drawGame();
    if (G.cine) {
      W.beginFrame();
      NS.cineRender.draw();
      NS.fxRender.draw();
    }
    if (NS.screens.overlayOpen()) {
      W.beginFrame();
      NS.screens.drawOverlay();
    }
    NS.fxRender.drawFlash();
  }

  Object.assign(NS.frame, { PANELS, nav, ripeCount, trialPill, drawGame, draw });
})();
