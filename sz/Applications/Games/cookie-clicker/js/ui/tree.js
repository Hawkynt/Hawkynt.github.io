/* The tech tree on two pages - the Test Kitchen (recipe notes) and the Sugar Sanctum (sugar
   crystals): branch columns of round nodes with prerequisite links, level pips, state colours
   (maxed, available, too expensive, locked) and prices; a detail panel with the current and
   next level and the research button. Reachable from the title, the bakery and the pause
   menu; every purchase takes effect at once. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { BRANCHES, BRANCH_BY_ID, PAGES, TREE, TREE_BY_ID } = NS.treeData;
  const K = NS.artKit;
  const E = NS.economy;
  const kit = NS.kit;
  const W = NS.widgets;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const COL_W = 236, Y0 = 210, ROW_H = 112, R = 30;

  function pageOf(n) {
    return BRANCH_BY_ID[n.branch].page;
  }

  function pageBranches(p) {
    return BRANCHES.filter(b => b.page === p);
  }

  function columnX(br) {
    const list = pageBranches(br.page);
    return 640 - list.length * COL_W / 2 + list.indexOf(br) * COL_W;
  }

  function nodePos(n) {
    const br = BRANCH_BY_ID[n.branch];
    return { x: columnX(br) + 66 + n.lane * 104, y: Y0 + n.row * ROW_H };
  }

  function setPage(p) {
    G.ui.treePage = p;
    const sel = TREE_BY_ID[G.ui.treeSel];
    if (!sel || pageOf(sel) !== p) G.ui.treeSel = TREE.find(n => pageOf(n) === p).id;
    sfx('click', { volume: 0.4 });
  }

  function buy(id) {
    const n = TREE_BY_ID[id];
    if (!E.buyNode(G.profile, id)) {
      sfx('error');
      return false;
    }
    NS.production.invalidate();
    NS.production.refresh(true);
    NS.save.write(G);
    G.ui.treeFlash = 0.7;
    G.ui.treeFlashId = id;
    const p = nodePos(n);
    const col = BRANCH_BY_ID[n.branch].color;
    NS.fx.ring(p.x, p.y, R, R * 3.2, 0.55, col, 5);
    NS.fx.burst(p.x, p.y, 26, [col, '#ffffff', UI.gold], 'stars', 300, 200);
    sfx('levelup');
    NS.screens.toast('Researched ' + n.name + ' ' + E.nodeLevel(G.profile, id) + ': ' + E.nodeText(n, E.nodeLevel(G.profile, id)), col, n.icon);
    return true;
  }

  function draw() {
    const p = G.profile;
    const page = G.ui.treePage || 0;
    let sel = TREE_BY_ID[G.ui.treeSel] || TREE[0];
    if (pageOf(sel) !== page) sel = TREE.find(n => pageOf(n) === page);
    const v = NS.view.visible();
    ctx.fillStyle = page ? 'rgba(20,6,30,0.94)' : 'rgba(16,8,4,0.93)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('TECH TREE', 40, 40, 34, '#ffffff', { weight: 'bold', shadow: true });
    kit.text(page ? 'Sugar crystals come from ascending. Spending them keeps their production bonus.' : 'Recipe notes come from baking, golden treats, milestones, quests and achievements.',
      40, 74, 14, UI.textDim);
    for (let i = 0; i < PAGES.length; ++i)
      W.button('page' + i, PAGES[i].name, 640 + i * 190, 22, 180, 40, { selected: page === i, icon: i ? 'crystal' : 'flask', px: 16,
        accent: i ? UI.crystal : UI.notes, action: () => setPage(i) });
    const cur = PAGES[page].currency;
    kit.icon(cur === 'notes' ? 'note' : 'crystal', 1040, 42, 24, cur === 'notes' ? UI.notes : UI.crystal);
    kit.text(NS.format.short(E.wallet(p, cur)) + (cur === 'notes' ? ' notes' : ' crystals'), 1058, 43, 22, '#ffffff', { weight: 'bold' });

    for (let b = 0; b < BRANCHES.length; ++b) {
      const br = BRANCHES[b];
      if (br.page !== page) continue;
      const x = columnX(br);
      ctx.fillStyle = K.rgba(br.color, 0.07);
      K.roundRect(ctx, x + 6, 112, COL_W - 12, 380, 14);
      ctx.fill();
      ctx.strokeStyle = K.rgba(br.color, 0.3);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      kit.icon(br.icon, x + 28, 136, 20, br.color);
      kit.text(br.name.toUpperCase(), x + 46, 137, 15, br.color, { weight: 'bold' });
      let have = 0, all = 0;
      for (let i = 0; i < TREE.length; ++i)
        if (TREE[i].branch === br.id) { have += E.nodeLevel(p, TREE[i].id); all += TREE[i].costs.length; }
      kit.text(have + '/' + all, x + COL_W - 20, 137, 12, UI.textDim, { align: 'right' });
    }
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      if (pageOf(n) !== page) continue;
      const a = nodePos(n);
      for (let k = 0; k < n.req.length; ++k) {
        const q = nodePos(TREE_BY_ID[n.req[k][0]]);
        const met = E.nodeLevel(p, n.req[k][0]) >= n.req[k][1];
        ctx.strokeStyle = met ? K.rgba(BRANCH_BY_ID[n.branch].color, 0.85) : 'rgba(160,140,120,0.28)';
        ctx.lineWidth = met ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y + R);
        ctx.bezierCurveTo(q.x, q.y + R + 26, a.x, a.y - R - 26, a.x, a.y - R);
        ctx.stroke();
      }
    }
    for (let i = 0; i < TREE.length; ++i) if (pageOf(TREE[i]) === page) drawNode(TREE[i], sel, p);
    drawDetail(sel, p);
    G.ui.treeFlash = Math.max(0, G.ui.treeFlash - 1 / 60);
    const ret = G.ui.treeReturn;
    W.button('back', ret === 'paused' ? 'Back to the pause menu' : ret === 'title' ? 'Back to the title' : 'Back to the bakery', 40, 650, 280, 48,
      { icon: 'back', action: () => NS.screens.back(), accent: UI.good });
  }

  function drawNode(n, sel, p) {
    const pos = nodePos(n);
    const state = E.nodeState(p, n.id);
    const lvl = E.nodeLevel(p, n.id);
    const col = BRANCH_BY_ID[n.branch].color;
    const isSel = sel.id === n.id;
    const hot = W.area(n.id, pos.x - R - 8, pos.y - R - 8, R * 2 + 16, R * 2 + 30, () => {
      if (G.ui.treeSel === n.id) buy(n.id);
      else G.ui.treeSel = n.id;
    });
    if (hot) G.ui.treeSel = n.id;
    if (state === 'available') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4 + n.row * 1.3 + n.lane) * 0.15;
      K.blit(ctx, K.glow(col), pos.x, pos.y, 1.7);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const owned = lvl > 0;
    const gr = ctx.createRadialGradient(pos.x - 9, pos.y - 11, 2, pos.x, pos.y, R);
    gr.addColorStop(0, state === 'locked' ? '#2a2220' : owned ? K.shade(col, -0.3) : '#4a3428');
    gr.addColorStop(1, state === 'locked' ? '#0e0a08' : '#160c08');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R * (hot ? 1.08 : 1), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = state === 'maxed' ? UI.gold : state === 'locked' ? 'rgba(160,140,120,0.4)' : isSel ? '#ffffff' : col;
    ctx.lineWidth = isSel ? 3.5 : 2.5;
    ctx.stroke();
    if (isSel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -G.time * 12;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, R + 8, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    kit.icon(n.icon, pos.x, pos.y, 26, state === 'locked' ? '#6a5a50' : owned ? '#ffffff' : col);
    const max = n.costs.length;
    if (max > 1)
      for (let k = 0; k < max; ++k) {
        const a = -Math.PI * (0.22 + 0.56 * (k + 0.5) / max);
        K.circle(ctx, pos.x + Math.cos(a) * (R + 1), pos.y + Math.sin(a) * (R + 1), 3.4, k < lvl ? UI.gold : 'rgba(255,255,255,0.18)');
      }
    if (state === 'locked') kit.lock(pos.x + R * 0.72, pos.y - R * 0.72, 14);
    if (G.ui.treeFlash > 0 && G.ui.treeFlashId === n.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.ui.treeFlash;
      K.blit(ctx, K.glow('#ffffff'), pos.x, pos.y, 1.9);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const cur = E.nodeCurrency(n.id);
    const label = state === 'maxed' ? 'MAX' : E.nodeCost(p, n.id) + (cur === 'notes' ? ' notes' : ' crystals');
    kit.text(label, pos.x, pos.y + R + 13, 12, state === 'maxed' ? UI.gold : state === 'expensive' ? UI.bad : state === 'locked' ? UI.textMute : UI.text,
      { align: 'center', weight: 'bold' });
  }

  function drawDetail(n, p) {
    const x = 340, y = 506, w = 900, h = 134;
    const col = BRANCH_BY_ID[n.branch].color;
    const lvl = E.nodeLevel(p, n.id);
    const max = n.costs.length;
    const state = E.nodeState(p, n.id);
    kit.panel(x, y, w, h, { accent: col, glow: true });
    kit.icon(n.icon, x + 46, y + 46, 38, col);
    kit.text(n.name, x + 88, y + 32, 22, '#ffffff', { weight: 'bold' });
    kit.text(max > 1 ? 'Level ' + lvl + ' / ' + max : (lvl ? 'Researched' : 'Not researched'), x + 88, y + 58, 13, UI.textDim);
    kit.fitText('Now:  ' + (lvl ? E.nodeText(n, lvl) : 'nothing yet'), x + 320, y + 32, 560, 15, { color: lvl ? UI.text : UI.textMute });
    if (lvl < max) kit.fitText('Next: ' + E.nodeText(n, lvl + 1), x + 320, y + 58, 560, 15, { color: UI.good });
    if (state === 'locked') {
      const parts = n.req.map(r => TREE_BY_ID[r[0]].name + (TREE_BY_ID[r[0]].costs.length > 1 ? ' ' + r[1] : ''));
      kit.text('Requires ' + parts.join(' and '), x + 320, y + 86, 13, UI.bad);
    }
    const bx = x + w - 270, by = y + 76;
    const cur = E.nodeCurrency(n.id);
    if (state !== 'maxed')
      W.button('buy', state === 'locked' ? 'Locked' : 'Research - ' + E.nodeCost(p, n.id) + (cur === 'notes' ? ' notes' : ' crystals'), bx, by, 250, 44,
        { disabled: state !== 'available', accent: cur === 'notes' ? UI.notes : UI.crystal, action: () => buy(n.id) });
    else kit.text('Fully researched', bx + 125, by + 22, 17, UI.gold, { align: 'center', weight: 'bold' });
    kit.text('Click a node to select, click again (or B) to research - Tab switches pages', x + 88, y + 112, 12, UI.textMute);
  }

  function key(k) {
    if (k === 'b' || k === 'B') {
      buy(G.ui.treeSel);
      return true;
    }
    if (k === 'Tab') {
      setPage(1 - (G.ui.treePage || 0));
      return true;
    }
    return false;
  }

  Object.assign(NS.tree, { nodePos, setPage, buy, draw, key });
})();
