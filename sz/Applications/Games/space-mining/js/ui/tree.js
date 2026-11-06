/* The tech tree screen on two pages (Ship and Colony): branch columns of nodes with
   prerequisite links, level pips,
   state colours (maxed, available, too expensive, locked) and research costs; a detail panel
   with the current and next level and buying. Purchases take effect at once - also mid-trip
   when opened from the pause menu (the Daily Belt keeps its fixed rig). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { BRANCHES, PAGES, TREE, TREE_BY_ID } = NS.treeData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const COL_W = 200, X0 = 40, Y0 = 176, ROW_H = 104, R = 27;

  function pageOf(n) {
    for (let i = 0; i < BRANCHES.length; ++i) if (BRANCHES[i].id === n.branch) return BRANCHES[i].page;
    return 0;
  }

  function pageBranches(p) {
    return BRANCHES.filter(b => b.page === p);
  }

  /* branch column x on its page (pages with fewer branches are centred) */
  function columnX(br) {
    const list = pageBranches(br.page);
    return X0 + (6 - list.length) * COL_W / 2 + list.indexOf(br) * COL_W;
  }

  function nodePos(n) {
    const br = BRANCHES.find(b => b.id === n.branch);
    const x = columnX(br) + 50 + n.lane * 92;
    return { x: x, y: Y0 + n.row * ROW_H };
  }

  function setPage(p) {
    G.ui.treePage = p;
    const sel = TREE_BY_ID[G.ui.treeSel];
    if (!sel || pageOf(sel) !== p) G.ui.treeSel = TREE.find(n => pageOf(n) === p).id;
    sfx('click', { volume: 0.4 });
  }

  function branchColor(id) {
    for (let i = 0; i < BRANCHES.length; ++i)
      if (BRANCHES[i].id === id) return BRANCHES[i].color;
    return UI.accent;
  }

  function buy(id) {
    const save = G.save;
    const n = TREE_BY_ID[id];
    if (!rules.buyNode(save, id)) {
      sfx('error');
      return false;
    }
    applyNow();
    NS.save.writeSave();
    NS.statusBar.update();
    G.ui.treeFlash = 0.6;
    G.ui.treeFlashId = id;
    const p = nodePos(n);
    if (!G.run) {
      NS.fx.ring(p.x, p.y, R, R * 3, 0.5, branchColor(n.branch), 5);
      NS.fx.sparks(p.x, p.y, 0, TAU, 24, branchColor(n.branch), 300, 0.5);
    }
    sfx('levelup');
    return true;
  }

  /* bought tech changes the ship in flight at once */
  function applyNow() {
    if (!G.run) {
      NS.save.refreshStats();
      return;
    }
    const before = G.stats;
    NS.trip.refreshFlightStats();
    const st = G.stats;
    if (st === before) return;
    if (st.drones !== G.drones.length) NS.drones.setup(st);
    if (st.seismic > before.seismic) G.run.charges += st.seismic - before.seismic;
  }

  function draw() {
    const save = G.save;
    const page = G.ui.treePage || 0;
    let sel = TREE_BY_ID[G.ui.treeSel] || TREE[0];
    if (pageOf(sel) !== page) sel = TREE.find(n => pageOf(n) === page);
    const v = NS.view.visible();
    ctx.fillStyle = G.treeReturn === 'paused' ? 'rgba(2,4,12,0.8)' : 'rgba(2,4,12,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('TECH TREE', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.text(G.treeReturn === 'paused' ? (G.run && G.run.mode === 'daily' ? 'The Daily Belt flies a fixed rig - research applies from your next trip' : 'Trip paused - research applies the moment you buy it')
      : 'Research data comes from rare ore, discoveries, contracts and achievements', 60, 74, 14, UI.textDim);
    kit.amount(save.rd, 1220, 46, 26, 'right', 'rd');
    for (let p = 0; p < PAGES.length; ++p)
      W.button('page' + p, PAGES[p], 640 + p * 150, 28, 140, 36, { selected: page === p, icon: p ? 'habitat' : 'engine', px: 15, accent: p ? '#ffb44a' : UI.data,
        action: () => setPage(p) });

    /* branch columns */
    for (let b = 0; b < BRANCHES.length; ++b) {
      const br = BRANCHES[b];
      if (br.page !== page) continue;
      const x = columnX(br);
      ctx.fillStyle = K.rgba(br.color, 0.06);
      kit.roundRect(x, 100, COL_W - 10, 396, 12);
      ctx.fill();
      ctx.strokeStyle = K.rgba(br.color, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      kit.icon(br.icon, x + 22, 122, 18, br.color);
      kit.text(br.name.toUpperCase(), x + 38, 122, 14, br.color, { weight: 'bold' });
      let have = 0, all = 0;
      for (let i = 0; i < TREE.length; ++i)
        if (TREE[i].branch === br.id) { have += rules.nodeLevel(save, TREE[i].id); all += TREE[i].costs.length; }
      kit.text(have + '/' + all, x + COL_W - 22, 122, 12, UI.textDim, { align: 'right' });
    }

    /* prerequisite links */
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      if (pageOf(n) !== page) continue;
      const p = nodePos(n);
      for (let k = 0; k < n.req.length; ++k) {
        const q = nodePos(TREE_BY_ID[n.req[k][0]]);
        const met = rules.nodeLevel(save, n.req[k][0]) >= n.req[k][1];
        ctx.strokeStyle = met ? K.rgba(branchColor(n.branch), 0.8) : 'rgba(120,130,160,0.25)';
        ctx.lineWidth = met ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y + R);
        ctx.bezierCurveTo(q.x, q.y + R + 20, p.x, p.y - R - 20, p.x, p.y - R);
        ctx.stroke();
      }
    }

    /* nodes */
    for (let i = 0; i < TREE.length; ++i) if (pageOf(TREE[i]) === page) drawNode(TREE[i], sel, save);

    drawDetail(sel, save);
    if (!G.run) NS.fxRender.draw({ x0: -200, y0: -200, x1: 1500, y1: 900 });
    const back = G.treeReturn;
    W.button('back', back === 'paused' ? 'Back to the trip' : 'Back', 60, 650, 240, 46, {
      action: () => scr.setScreen(back), accent: back === 'paused' ? UI.good : UI.accent,
    });
  }

  function drawNode(n, sel, save) {
    const p = nodePos(n);
    const state = rules.nodeState(save, n.id);
    const lvl = rules.nodeLevel(save, n.id);
    const col = branchColor(n.branch);
    const isSel = sel.id === n.id;
    const hot = W.area(n.id, p.x - R - 6, p.y - R - 6, R * 2 + 12, R * 2 + 28, () => {
      if (G.ui.treeSel === n.id) buy(n.id);
      else
        G.ui.treeSel = n.id;
    });
    if (hot) G.ui.treeSel = n.id;
    const owned = lvl > 0;
    if (state === 'available') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4 + i(n)) * 0.15;
      K.blit(ctx, K.glow(col), p.x, p.y, 1.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const gr = ctx.createRadialGradient(p.x - 8, p.y - 10, 2, p.x, p.y, R);
    gr.addColorStop(0, state === 'locked' ? '#1a1e2a' : owned ? K.shade(col, -0.35) : '#2a3450');
    gr.addColorStop(1, state === 'locked' ? '#06080e' : '#080c18');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * (hot ? 1.08 : 1), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = state === 'maxed' ? UI.gold : state === 'locked' ? 'rgba(120,130,160,0.4)' : isSel ? '#ffffff' : col;
    ctx.lineWidth = isSel ? 3.5 : 2.5;
    ctx.stroke();
    if (isSel) {
      ctx.strokeStyle = K.rgba('#ffffff', 0.5);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -G.time * 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    kit.icon(n.icon, p.x, p.y, 24, state === 'locked' ? '#4a5470' : owned ? '#ffffff' : col);
    /* level pips around the rim */
    const max = n.costs.length;
    if (max > 1) {
      for (let k = 0; k < max; ++k) {
        const a = -Math.PI * (0.22 + 0.56 * (k + 0.5) / max);
        ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * (R + 1), p.y + Math.sin(a) * (R + 1), 3.2, 0, TAU);
        ctx.fill();
      }
    }
    if (state === 'locked') kit.lock(p.x + R * 0.7, p.y - R * 0.7, 14);
    if (G.ui.treeFlash > 0 && G.ui.treeFlashId === n.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.ui.treeFlash;
      K.blit(ctx, K.glow('#ffffff'), p.x, p.y, 1.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const label = state === 'maxed' ? 'MAX' : rules.nodeCost(save, n.id) + ' rd';
    kit.text(label, p.x, p.y + R + 12, 12, state === 'maxed' ? UI.gold : state === 'expensive' ? UI.bad : state === 'locked' ? UI.textMute : UI.text, { align: 'center', weight: 'bold' });
  }

  function i(n) {
    return n.row * 1.3 + n.lane;
  }

  function drawDetail(n, save) {
    const x = 330, y = 512, w = 890, h = 128;
    const col = branchColor(n.branch);
    const lvl = rules.nodeLevel(save, n.id);
    const max = n.costs.length;
    const state = rules.nodeState(save, n.id);
    kit.panel(x, y, w, h, { accent: col, glow: true });
    kit.icon(n.icon, x + 44, y + 44, 36, col);
    kit.text(n.name, x + 84, y + 30, 22, '#ffffff', { weight: 'bold' });
    kit.text(max > 1 ? 'Level ' + lvl + ' / ' + max : (lvl ? 'Owned' : 'Not owned'), x + 84, y + 56, 13, UI.textDim);
    kit.text('Now:  ' + (lvl ? rules.nodeText(n, lvl) : 'nothing yet'), x + 300, y + 30, 14, lvl ? UI.text : UI.textMute);
    if (lvl < max) kit.text('Next: ' + rules.nodeText(n, lvl + 1), x + 300, y + 56, 14, UI.good);
    if (state === 'locked') {
      const parts = n.req.map(r => TREE_BY_ID[r[0]].name + (TREE_BY_ID[r[0]].costs.length > 1 ? ' ' + r[1] : ''));
      kit.text('Requires ' + parts.join(' and '), x + 300, y + 86, 13, UI.bad);
    }
    const bx = x + w - 260, by = y + 70;
    if (state !== 'maxed') {
      W.button('buy', state === 'locked' ? 'Locked' : 'Research  -  ' + rules.nodeCost(save, n.id) + ' data', bx, by, 240, 44, {
        disabled: state !== 'available', accent: UI.data, action: () => buy(n.id),
      });
    } else
      kit.text('Fully researched', bx + 120, by + 22, 16, UI.gold, { align: 'center', weight: 'bold' });
    kit.text('B researches the selected node  -  Tab switches Ship / Colony', x + 84, y + 100, 12, UI.textMute);
  }

  /* B buys the selected node from the keyboard */
  function onKey(e) {
    if (e.code === 'KeyB') {
      buy(G.ui.treeSel);
      return true;
    }
    if (e.code === 'Tab' || e.code === 'PageDown' || e.code === 'PageUp') {
      setPage(((G.ui.treePage || 0) + 1) % PAGES.length);
      return true;
    }
    return false;
  }

  Object.assign(NS.tree, {
    draw, buy, onKey, nodePos, applyNow, setPage, pageOf
  });
})();
