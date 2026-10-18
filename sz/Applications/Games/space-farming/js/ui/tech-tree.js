/* Space Farming - tech tree dialog: card layout, camera, tabs, focus, purchase and keyboard control.
   Owns: G.treeLayout, G.treeTab, G.treeFocusId, G.treeHoverId, G.treePanning
   Reads: G.UW, G.UH, G.state, G.uiTime, G.dialog */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, celebrate, TREE_BRANCH_ORDER, TREE_REGION_ROWS, TREE_CARD_W, TREE_CARD_H,
    TREE_GAP_X, TREE_GAP_Y, TREE_REGION_PAD, TREE_REGION_HEADER, TREE_REGION_GAP, TREE_MIN_ZOOM,
    TREE_MAX_ZOOM, TECH, treeNodeState, purchaseTreeNode, openDialog } = NS;

  function computeTreeLayout() {
    if (G.treeLayout) return G.treeLayout.nodes;
    const nodes = [];
    const regions = {};
    const pitchX = TREE_CARD_W + TREE_GAP_X;
    const pitchY = TREE_CARD_H + TREE_GAP_Y;
    const grids = [];
    for (const branch of TREE_BRANCH_ORDER) {
      const bn = TECH.filter(n => n.branch === branch);
      const map = {};
      bn.forEach((n, i) => { map[n.id] = { n, i }; });
      const depth = {};
      const assign = (n) => {
        if (depth[n.id] !== undefined) return depth[n.id];
        let d = -1;
        for (const p of n.prereqs)
          if (map[p]) d = Math.max(d, assign(map[p].n));
        depth[n.id] = d + 1;
        return depth[n.id];
      };
      bn.forEach(assign);
      const order = bn.slice().sort((a, b) => depth[a.id] - depth[b.id] || map[a.id].i - map[b.id].i);
      const lanes = [], laneOf = {}, continued = {};
      for (const n of order) {
        const parents = n.prereqs.filter(p => map[p]).sort((a, b) => depth[b] - depth[a]);
        const cont = parents.find(p => !continued[p]);
        let lane;
        if (cont) {
          lane = laneOf[cont];
          continued[cont] = true;
          lane.ids.push(n.id);
        } else {
          lane = { ids: [n.id], parent: parents.length ? laneOf[parents[0]] : null, kids: [] };
          lanes.push(lane);
          if (lane.parent) lane.parent.kids.push(lane);
        }
        laneOf[n.id] = lane;
      }
      const ordered = [];
      const visit = (l) => { ordered.push(l); l.kids.forEach(visit); };
      lanes.filter(l => !l.parent).forEach(visit);
      const rowSpans = [];
      for (const l of ordered) {
        const ds = l.ids.map(id => depth[id]);
        const lo = Math.min(...ds), hi = Math.max(...ds);
        let r = l.parent ? l.parent.row + 1 : rowSpans.length;
        for (;; ++r) {
          rowSpans[r] = rowSpans[r] || [];
          if (rowSpans[r].every(([a, b]) => hi < a - 1 || lo > b + 1)) break;
        }
        rowSpans[r].push([lo, hi]);
        l.row = r;
      }
      let maxDepth = 0;
      for (const n of bn) maxDepth = Math.max(maxDepth, depth[n.id]);
      grids.push({ branch, bn, depth, laneOf, rows: rowSpans.length, cols: maxDepth + 1 });
    }
    const regionW = (g) => g.cols * pitchX - TREE_GAP_X + TREE_REGION_PAD * 2;
    const regionH = (g) => TREE_REGION_HEADER + g.rows * pitchY - TREE_GAP_Y + TREE_REGION_PAD;
    const gridOf = {};
    for (const g of grids) gridOf[g.branch] = g;
    const rowWidth = TREE_REGION_ROWS.map(row => row.reduce((w, b) => w + regionW(gridOf[b]), 0) + (row.length - 1) * TREE_REGION_GAP);
    const totalW = Math.max(...rowWidth);
    const placeOf = {};
    let rowY = 0;
    TREE_REGION_ROWS.forEach((row, ri) => {
      let x = (totalW - rowWidth[ri]) / 2, h = 0;
      for (const b of row) {
        placeOf[b] = { x, y: rowY };
        x += regionW(gridOf[b]) + TREE_REGION_GAP;
        h = Math.max(h, regionH(gridOf[b]));
      }
      rowY += h + TREE_REGION_GAP;
    });
    for (const g of grids) {
      const p = placeOf[g.branch];
      regions[g.branch] = { x: p.x, y: p.y, w: regionW(g), h: regionH(g), branch: g.branch };
      for (const n of g.bn)
        nodes.push({ node: n, branch: g.branch, w: TREE_CARD_W, h: TREE_CARD_H,
          x: p.x + TREE_REGION_PAD + g.depth[n.id] * pitchX,
          y: p.y + TREE_REGION_HEADER + g.laneOf[n.id].row * pitchY });
    }
    const byId = {};
    for (const ln of nodes) byId[ln.node.id] = ln;
    regions.all = { x: 0, y: 0, w: totalW, h: rowY - TREE_REGION_GAP };
    G.treeLayout = { nodes, byId, regions };
    return nodes;
  }
  const treeCam = { tx: 0, ty: 0, tz: 0.5, x: 0, y: 0, z: 0.5, init: false };
  const treeFlash = {};

  function treeView() {
    return { x: 0, y: 112, w: G.UW, h: G.UH - 112 - 50 };
  }

  function fitTreeView(tab, instant) {
    computeTreeLayout();
    const r = G.treeLayout.regions[tab] || G.treeLayout.regions.all;
    const V = treeView();
    const pad = 20;
    const z = Math.max(TREE_MIN_ZOOM, Math.min(1, (V.w - pad * 2) / r.w, (V.h - pad * 2) / r.h));
    treeCam.tz = z;
    treeCam.tx = V.x + V.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = V.y + V.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      treeCam.z = treeCam.tz;
      treeCam.x = treeCam.tx;
      treeCam.y = treeCam.ty;
    }
  }

  function setTreeTab(tab) {
    if (G.treeTab !== tab) {
      G.treeTab = tab;
      SZ.GameAudio.play('select', { volume: 0.6 });
      if (tab !== 'all' && G.treeFocusId && G.treeLayout.byId[G.treeFocusId].branch !== tab)
        G.treeFocusId = null;
    }
    fitTreeView(tab);
  }

  function openTree(focusId, tab) {
    if (G.state !== STATE_PLAYING) return;
    computeTreeLayout();
    openDialog('tree');
    const focus = focusId && G.treeLayout.byId[focusId];
    if (focus || tab) {
      G.treeTab = focus ? focus.branch : tab;
      fitTreeView(G.treeTab, true);
      if (focus) {
        const V = treeView();
        treeCam.tz = treeCam.z = Math.max(treeCam.z, 0.8);
        treeCam.tx = treeCam.x = V.x + V.w / 2 - (focus.x + focus.w / 2) * treeCam.z;
        treeCam.ty = treeCam.y = V.y + V.h / 2 - (focus.y + focus.h / 2) * treeCam.z;
        G.treeFocusId = focus.node.id;
      }
    } else if (!treeCam.init)
      fitTreeView(G.treeTab, true);
    treeCam.init = true;
  }

  function zoomTreeAt(ux, uy, factor) {
    const z = Math.max(TREE_MIN_ZOOM, Math.min(TREE_MAX_ZOOM, treeCam.tz * factor));
    const ratio = z / treeCam.tz;
    treeCam.tx = ux - (ux - treeCam.tx) * ratio;
    treeCam.ty = uy - (uy - treeCam.ty) * ratio;
    treeCam.tz = z;
  }

  function revealTreeNode(ln) {
    const V = treeView();
    const z = treeCam.tz, m = 40;
    const sx = treeCam.tx + ln.x * z, sy = treeCam.ty + ln.y * z, sw = ln.w * z, sh = ln.h * z;
    if (sx < V.x + m) treeCam.tx += V.x + m - sx;
    else if (sx + sw > V.x + V.w - m) treeCam.tx -= sx + sw - (V.x + V.w - m);
    if (sy < V.y + m) treeCam.ty += V.y + m - sy;
    else if (sy + sh > V.y + V.h - m) treeCam.ty -= sy + sh - (V.y + V.h - m);
  }

  function hitTreeNode(ux, uy) {
    const V = treeView();
    if (uy < V.y || uy > V.y + V.h) return null;
    const tx = (ux - treeCam.x) / treeCam.z, ty = (uy - treeCam.y) / treeCam.z;
    for (const ln of computeTreeLayout())
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h)
        return ln;
    return null;
  }

  function tryPurchaseTreeNode(n) {
    if (purchaseTreeNode(n)) {
      treeFlash[n.id] = G.uiTime;
      const ln = G.treeLayout && G.treeLayout.byId[n.id];
      if (ln && G.dialog === 'tree')
        celebrate(treeCam.x + (ln.x + ln.w / 2) * treeCam.z, treeCam.y + (ln.y + ln.h / 2) * treeCam.z, 24);
      return true;
    }
    SZ.GameAudio.play('error');
    return false;
  }

  /* Keyboard control of the tree; returns true when the key was used */
  function handleTreeKey(e) {
    const nodes = computeTreeLayout();
    const tabs = ['all'].concat(TREE_BRANCH_ORDER);
    const V = treeView();
    if (e.code === 'Tab') {
      const i = tabs.indexOf(G.treeTab);
      setTreeTab(tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
      return true;
    }
    if (/^Digit[1-6]$/.test(e.code)) {
      setTreeTab(tabs[parseInt(e.code.slice(5), 10) - 1]);
      return true;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      zoomTreeAt(V.x + V.w / 2, V.y + V.h / 2, 1.2);
      return true;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      zoomTreeAt(V.x + V.w / 2, V.y + V.h / 2, 1 / 1.2);
      return true;
    }
    if (e.code === 'Digit0' || e.code === 'Home') {
      fitTreeView(G.treeTab);
      return true;
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    const dir = dirs[e.code];
    const inTab = (ln) => G.treeTab === 'all' || ln.branch === G.treeTab;
    if (dir) {
      const cur = G.treeFocusId && G.treeLayout.byId[G.treeFocusId];
      if (!cur || !inTab(cur)) {
        const first = nodes.find(ln => inTab(ln) && treeNodeState(ln.node) === 'ready') || nodes.find(inTab);
        if (first) {
          G.treeFocusId = first.node.id;
          revealTreeNode(first);
        }
        return true;
      }
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bestScore = Infinity;
      for (const ln of nodes) {
        if (ln === cur || !inTab(ln)) continue;
        const dx = ln.x + ln.w / 2 - cx, dy = ln.y + ln.h / 2 - cy;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 1) continue;
        const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        const score = along + across * 2.5;
        if (score < bestScore) {
          bestScore = score;
          best = ln;
        }
      }
      if (best) {
        G.treeFocusId = best.node.id;
        revealTreeNode(best);
        SZ.GameAudio.play('click', { volume: 0.4 });
      }
      return true;
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && G.treeFocusId) {
      tryPurchaseTreeNode(G.treeLayout.byId[G.treeFocusId].node);
      return true;
    }
    return false;
  }

  Object.assign(NS, { computeTreeLayout, treeCam, treeFlash, treeView, setTreeTab, openTree, zoomTreeAt,
    hitTreeNode, tryPurchaseTreeNode, handleTreeKey });

})();
