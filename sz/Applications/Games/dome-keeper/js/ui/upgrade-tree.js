;(function() {
  'use strict';

  // The full-screen upgrade tree dialog: layout, camera, drawing, keyboard and mouse.
  // Owns: NS.upgradeTree
  // Reads: constants, util, dom, sprites, textLayout, panels, rules, upgradeData, upgrades, gameState,
  //   persistence, artifacts, drones, mineHud, gadgetArt, hud, tooltip
  // Reads state of: gameState, artifacts

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, STATE_PLAYING, STATE_PAUSED, STATE_UPGRADE_DIALOG } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { uiFont, fitText, drawTextBlock } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawMeter } = NS.panels;
  const { BASE_CARRY_CAPACITY } = NS.rules;
  const { UPGRADE_TREE, TREE_BRANCH_ORDER, TREE_BRANCH_LABELS, TREE_BRANCH_COLORS, TREE_GROUP_LABELS,
    TREE_REGION_ROWS, TREE_CARD_W, TREE_CARD_H, TREE_GAP_X, TREE_GAP_Y, TREE_REGION_PAD, TREE_REGION_HEADER,
    TREE_REGION_GAP, TREE_MIN_ZOOM, TREE_MAX_ZOOM, TREE_NAME_EXPANSIONS } = NS.upgradeData;
  const { getTreeNodeLevel, isTreeNodeMaxed, prereqId, isPrereqMet, arePrereqsMet, canAffordTreeNode,
    isTreeNodeAvailable, purchaseTreeNode } = NS.upgrades;
  const { tooltip, TOOLTIP_DELAY, treeCam, treePurchaseFlash } = NS.gameState;
  const { saveRun } = NS.persistence;
  const { ARTIFACTS, hasArtifact, drawArtifactGallery } = NS.artifacts;

  // Compute positions for tree nodes using a strict grid layout.
  // Each branch gets a vertical column section; within a branch nodes are
  // placed on a grid where row = topological depth (max prerequisite row + 1)
  // and columns are assigned left-to-right per row. A fixed cell size
  // guarantees no two nodes can ever overlap.
  function computeTreeLayout() {
    if (G.treeLayout)
      return G.treeLayout.nodes;
    const nodes = [];
    const regions = {};
    const pitchX = TREE_CARD_W + TREE_GAP_X;
    const pitchY = TREE_CARD_H + TREE_GAP_Y;

    // Per branch: depth = longest prerequisite chain (left to right);
    // lanes = chains of nodes continuing a parent, packed into rows.
    const branchGrids = [];
    for (const branch of TREE_BRANCH_ORDER) {
      // Groups of a branch (the Tools branch has tools and bombs) sit side by side
      const groupNames = [];
      for (const n of UPGRADE_TREE)
        if (n.branch === branch && groupNames.indexOf(n.group || '') < 0)
          groupNames.push(n.group || '');
      let colOffset = 0, rows = 0;
      const depthOf = {}, laneOf = {}, groupX = [];
      for (const group of groupNames) {
        const branchNodes = UPGRADE_TREE.filter(n => n.branch === branch && (n.group || '') === group);
        const nodeMap = {};
        branchNodes.forEach((n, i) => { nodeMap[n.id] = { n, i }; });
        const gDepth = {};
        const assignDepth = (n) => {
          if (gDepth[n.id] !== undefined) return gDepth[n.id];
          let maxParent = -1;
          for (const pid of n.prereqs.map(prereqId))
            if (nodeMap[pid])
              maxParent = Math.max(maxParent, assignDepth(nodeMap[pid].n));
          gDepth[n.id] = maxParent + 1;
          return gDepth[n.id];
        };
        branchNodes.forEach(assignDepth);

        const order = branchNodes.slice().sort((a, b) => gDepth[a.id] - gDepth[b.id] || nodeMap[a.id].i - nodeMap[b.id].i);
        const lanes = [];
        const continued = {};
        for (const n of order) {
          const parents = n.prereqs.map(prereqId).filter(p => nodeMap[p]).sort((a, b) => gDepth[b] - gDepth[a]);
          const cont = parents.find(p => !continued[p]);
          let lane;
          if (cont) {
            lane = laneOf[cont];
            continued[cont] = true;
            lane.ids.push(n.id);
          } else {
            lane = { ids: [n.id], parent: parents.length ? laneOf[parents[0]] : null, kids: [] };
            lanes.push(lane);
            if (lane.parent)
              lane.parent.kids.push(lane);
          }
          laneOf[n.id] = lane;
        }
        // Depth-first lane order keeps every sub-chain right below its parent;
        // lanes share a row when their depth ranges leave a free cell between them
        const ordered = [];
        const visit = (l) => {
          ordered.push(l);
          l.kids.forEach(visit);
        };
        lanes.filter(l => !l.parent).forEach(visit);
        const rowSpans = [];
        for (const l of ordered) {
          const ds = l.ids.map(id => gDepth[id]);
          const lo = Math.min(...ds), hi = Math.max(...ds);
          let r = l.parent ? l.parent.row + 1 : rowSpans.length;
          for (;; ++r) {
            rowSpans[r] = rowSpans[r] || [];
            if (rowSpans[r].every(([a, b]) => hi < a - 1 || lo > b + 1))
              break;
          }
          rowSpans[r].push([lo, hi]);
          l.row = r;
        }
        let maxDepth = 0;
        for (const n of branchNodes)
          maxDepth = Math.max(maxDepth, gDepth[n.id]);
        groupX.push({ group, col: colOffset });
        for (const n of branchNodes)
          depthOf[n.id] = gDepth[n.id] + colOffset;
        colOffset += maxDepth + 1 + 0.5;
        rows = Math.max(rows, rowSpans.length);
      }
      branchGrids.push({ branch, branchNodes: UPGRADE_TREE.filter(n => n.branch === branch), depthOf, laneOf, rows, cols: colOffset - 0.5, groupX });
    }

    // Regions row by row (TREE_REGION_ROWS), each row centred
    const regionW = (g) => g.cols * pitchX - TREE_GAP_X + TREE_REGION_PAD * 2;
    const regionH = (g) => TREE_REGION_HEADER + g.rows * pitchY - TREE_GAP_Y + TREE_REGION_PAD;
    const gridOf = {};
    for (const g of branchGrids)
      gridOf[g.branch] = g;
    const rowWidth = TREE_REGION_ROWS.map(row => row.reduce((w, b) => w + regionW(gridOf[b]), 0) + (row.length - 1) * TREE_REGION_GAP);
    const totalW = Math.max(...rowWidth);
    const placeOf = {};
    let rowY = 0;
    TREE_REGION_ROWS.forEach((row, ri) => {
      let x = (totalW - rowWidth[ri]) / 2;
      let h = 0;
      for (const b of row) {
        placeOf[b] = { x, y: rowY };
        x += regionW(gridOf[b]) + TREE_REGION_GAP;
        h = Math.max(h, regionH(gridOf[b]));
      }
      rowY += h + TREE_REGION_GAP;
    });
    const totalH = rowY - TREE_REGION_GAP;
    for (let i = 0; i < branchGrids.length; ++i) {
      const g = branchGrids[i];
      const cx = placeOf[g.branch].x;
      const gy = placeOf[g.branch].y;
      regions[g.branch] = { x: cx, y: gy, w: regionW(g), h: regionH(g), branch: g.branch, groups: g.groupX.map(q => ({ group: q.group, x: cx + TREE_REGION_PAD + q.col * pitchX })) };
      for (const n of g.branchNodes)
        nodes.push({
          node: n,
          x: cx + TREE_REGION_PAD + g.depthOf[n.id] * pitchX,
          y: gy + TREE_REGION_HEADER + g.laneOf[n.id].row * pitchY,
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          branch: g.branch
        });
    }
    const byId = {};
    for (const ln of nodes)
      byId[ln.node.id] = ln;
    regions.all = { x: 0, y: 0, w: totalW, h: totalH };
    G.treeLayout = { nodes, byId, regions };
    return nodes;
  }

  // Screen area the tree is drawn into (below the header, above the footer)
  const TREE_VIEW = { x: 0, y: 156, w: CANVAS_W, h: CANVAS_H - 156 - 58 };

  // Display name and chain info for a tree node: "Shield Cap. L3" becomes
  // "Shield Capacity" shown with level pip 3 of the 7-node chain.
  function getTreeNodeInfo(node) {
    if (G.treeNodeInfo)
      return G.treeNodeInfo[node.id];
    G.treeNodeInfo = {};
    const chains = {};
    for (const n of UPGRADE_TREE) {
      const m = /^(.*?)\s+L(\d+)$/.exec(n.name);
      let base = m ? m[1] : n.name;
      base = TREE_NAME_EXPANSIONS[base] || base;
      const step = m ? parseInt(m[2], 10) : 1;
      const key = n.branch + '|' + base;
      (chains[key] = chains[key] || []).push({ id: n.id, step });
      G.treeNodeInfo[n.id] = { title: base, chain: chains[key] };
    }
    for (const key in chains)
      chains[key].sort((a, b) => a.step - b.step);
    for (const id in G.treeNodeInfo) {
      const info = G.treeNodeInfo[id];
      info.index = info.chain.findIndex(c => c.id === id);
    }
    return G.treeNodeInfo[node.id];
  }

  function fitTreeView(tab, instant) {
    computeTreeLayout();
    if (tab === 'artifacts') tab = 'all';
    const r = G.treeLayout.regions[tab] || G.treeLayout.regions.all;
    const pad = 24;
    const z = Math.max(TREE_MIN_ZOOM, Math.min(1, (TREE_VIEW.w - pad * 2) / r.w, (TREE_VIEW.h - pad * 2) / r.h));
    treeCam.tz = z;
    treeCam.tx = TREE_VIEW.x + TREE_VIEW.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = TREE_VIEW.y + TREE_VIEW.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      G.upgradeZoom = treeCam.tz;
      G.upgradePanX = treeCam.tx;
      G.upgradePanY = treeCam.ty;
    }
  }

  function setTreeTab(tab) {
    if (G.treeTab === tab) {
      fitTreeView(tab);
      return;
    }
    G.treeTab = tab;
    fitTreeView(tab);
    SZ.GameAudio.play('select');
    if (tab !== 'all' && G.treeFocusId && computeTreeLayout() && G.treeLayout.byId[G.treeFocusId].branch !== tab)
      G.treeFocusId = null;
  }

  // Header tabs: all branches plus one per branch
  function getTreeTabs() {
    const ids = ['all'].concat(TREE_BRANCH_ORDER, ['artifacts']);
    const gap = 10;
    const tabW = Math.min(180, Math.floor((CANVAS_W - 48 - (ids.length - 1) * gap) / ids.length));
    const x0 = CANVAS_W / 2 - (ids.length * tabW + (ids.length - 1) * gap) / 2;
    return ids.map((id, i) => ({ id, x: x0 + i * (tabW + gap), y: 66, w: tabW, h: 36 }));
  }

  function treeNodeState(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return 'owned';
    if (!arePrereqsMet(node)) return 'locked';
    return canAffordTreeNode(node) ? 'ready' : 'poor';
  }

  // Cost as "20 [iron] 10 [cobalt]" with per-resource colouring, shrunk to maxW
  function drawCostRow(cost, x, y, maxW, px) {
    const parts = [];
    for (const key in cost)
      if ((cost[key] || 0) > 0)
        parts.push({ key, n: cost[key], ok: (G.resources[key] || 0) >= cost[key] });
    if (!parts.length) return;
    let size = px;
    let total;
    for (;;) {
      ctx.font = uiFont(size, 'bold');
      total = 0;
      for (const p of parts)
        total += ctx.measureText(String(p.n)).width + size * 1.15 + size * 0.5;
      total -= size * 0.5;
      if (total <= maxW || size <= 9) break;
      --size;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x;
    for (const p of parts) {
      if (cx > x + maxW) break;
      ctx.fillStyle = p.ok ? '#d8f5dc' : '#ff8a8a';
      const label = String(p.n);
      ctx.fillText(label, cx, y + 1);
      cx += ctx.measureText(label).width + 2;
      drawSprite(p.key, cx + size * 0.55, y, size * 1.1, p.ok ? 1 : 0.7);
      cx += size * 1.15 + size * 0.5;
    }
  }

  // Orthogonal connector with rounded corners routed through the empty
  // channels between cards (never across a card)
  function strokeTreeConnector(parent, child) {
    const px = parent.x + parent.w, py = parent.y + parent.h / 2;
    const cx = child.x, cy = child.y + child.h / 2;
    const x1 = px + TREE_GAP_X / 2;
    const x2 = cx - TREE_GAP_X / 2;
    const pts = [[px, py]];
    if (Math.abs(py - cy) < 0.5)
      pts.push([cx, cy]);
    else if (Math.abs(x1 - x2) < 0.5) {
      pts.push([x1, py], [x1, cy], [cx, cy]);
    } else {
      // Run along the gap row next to the child's lane
      const chY = cy > py ? child.y - TREE_GAP_Y / 2 : child.y + child.h + TREE_GAP_Y / 2;
      pts.push([x1, py], [x1, chY], [x2, chY], [x2, cy], [cx, cy]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; ++i)
      ctx.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 10);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
  }

  let treeNebulaCanvas = null;

  function drawTreeBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, '#0b0f1e');
    g.addColorStop(1, '#05060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!treeNebulaCanvas) {
      treeNebulaCanvas = document.createElement('canvas');
      treeNebulaCanvas.width = 700;
      treeNebulaCanvas.height = 500;
      const n = treeNebulaCanvas.getContext('2d');
      const blobs = [[160, 140, 220, '60,90,200'], [520, 120, 180, '150,60,190'], [420, 380, 240, '30,130,170'], [120, 420, 160, '190,90,60']];
      for (const [bx, by, br, col] of blobs) {
        const rg = n.createRadialGradient(bx, by, 0, bx, by, br);
        rg.addColorStop(0, `rgba(${col},0.22)`);
        rg.addColorStop(1, `rgba(${col},0)`);
        n.fillStyle = rg;
        n.fillRect(0, 0, 700, 500);
      }
      n.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 140; ++i) {
        const s = ((i * 7919) % 97) / 97;
        n.globalAlpha = 0.15 + s * 0.5;
        n.fillRect((i * 7307) % 700, (i * 5279) % 500, s > 0.8 ? 1.5 : 1, s > 0.8 ? 1.5 : 1);
      }
      n.globalAlpha = 1;
    }
    // Nebula drifts slightly with the pan for depth
    const ox = ((G.upgradePanX * 0.05) % 140) - 70;
    const oy = ((G.upgradePanY * 0.05) % 100) - 50;
    ctx.drawImage(treeNebulaCanvas, ox - 70, oy - 50, CANVAS_W + 140, CANVAS_H + 100);

    // Blueprint grid in tree space
    const step = 64 * G.upgradeZoom;
    if (step >= 10) {
      ctx.save();
      ctx.beginPath();
      const sx = ((G.upgradePanX % step) + step) % step;
      const sy = ((G.upgradePanY % step) + step) % step;
      for (let x = sx; x < CANVAS_W; x += step) {
        ctx.moveTo(Math.round(x) + 0.5, TREE_VIEW.y);
        ctx.lineTo(Math.round(x) + 0.5, TREE_VIEW.y + TREE_VIEW.h);
      }
      for (let y = sy; y < CANVAS_H; y += step) {
        if (y < TREE_VIEW.y || y > TREE_VIEW.y + TREE_VIEW.h) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(CANVAS_W, Math.round(y) + 0.5);
      }
      ctx.strokeStyle = 'rgba(110,150,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTreeCard(ln, st, compact) {
    const node = ln.node;
    const x = ln.x, y = ln.y, w = ln.w, h = ln.h;
    const color = TREE_BRANCH_COLORS[ln.branch];
    const isHover = G.upgradeDialogHover === node.id;
    const isFocus = G.treeFocusId === node.id;
    const info = getTreeNodeInfo(node);
    const dim = st === 'locked';

    ctx.save();
    // Drop shadow (cheap offset rect instead of blur)
    roundRectPath(x + 3, y + 5, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    NS.hud.drawNodeFrame(x, y, w, h, color, st, isHover || isFocus);

    if (isHover || isFocus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 15);
      ctx.lineWidth = isFocus ? 3 : 2;
      ctx.strokeStyle = isFocus ? UI.gold : 'rgba(255,255,255,0.85)';
      if (isFocus) {
        ctx.shadowColor = UI.gold;
        ctx.shadowBlur = 12;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Icon well
    roundRectPath(x + 10, y + 10, 44, 44, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = st === 'locked' ? 'rgba(255,255,255,0.06)' : hexToRgba(color, 0.45);
    ctx.stroke();
    drawSprite(node.icon, x + 32, y + 32, 32, dim ? 0.4 : 1);

    const lvlNode = node.maxLevel > 1;
    const curLvl = getTreeNodeLevel(node.id);
    // Level-up upgrades: level chip and a thin progress bar under the icon
    if (lvlNode) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxed = curLvl >= node.maxLevel;
      fitText(maxed ? 'MAX' : `Lv ${curLvl}/${node.maxLevel}`, x + 32, y + 66, 50, 11, { weight: 'bold', color: dim ? UI.textMute : (maxed ? UI.gold : hexToRgba(color, 0.95)), minPx: 8 });
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 10, y + 75, 44, 4);
      ctx.fillStyle = maxed ? UI.gold : color;
      ctx.fillRect(x + 10, y + 75, 44 * curLvl / node.maxLevel, 4);
    } else if (info.chain.length > 1) {
    // Chain pips under the icon
      const n = info.chain.length;
      const pw = Math.min(8, (40 - (n - 1) * 2) / n);
      const total = n * pw + (n - 1) * 2;
      let px = x + 32 - total / 2;
      for (let i = 0; i < n; ++i) {
        const owned = isTreeNodeMaxed(info.chain[i].id);
        ctx.fillStyle = owned ? color : (i === info.index ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.14)');
        ctx.fillRect(px, y + 62, pw, 6);
        if (i === info.index) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(px, y + 70, pw, 2);
        }
        px += pw + 2;
      }
    } else if (node.type === 'gadget') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('GADGET', x + 32, y + 68, 48, 10, { weight: 'bold', color: dim ? UI.textMute : hexToRgba(color, 0.95), minPx: 8 });
    }

    // State badge (top-right)
    if (st === 'owned')
      drawSprite('check', x + w - 18, y + 18, 22);
    else if (st === 'locked')
      drawSprite('lock', x + w - 18, y + 18, 20, 0.7);

    // Name, then cost
    const textX = x + 64;
    const textW = w - 64 - (st === 'owned' || st === 'locked' ? 32 : 10);
    const nameColor = st === 'locked' ? '#6a7288' : (st === 'owned' ? '#ffffff' : UI.text);
    if (compact) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawTextBlock(info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : ''), textX, y + 8, textW, h - 16, 24, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 14, lineGap: 1.1 });
    } else {
      const titleText = info.title + (info.chain.length > 1 ? ' ' + toRoman(info.index + 1) : '');
      const effect = lvlNode ? levelEffectText(node, curLvl) : '';
      drawTextBlock(titleText, textX, y + 7, textW, effect ? 26 : 44, 17, { weight: 'bold', color: nameColor, valign: 'middle', minPx: 11, lineGap: 1.15 });
      if (effect) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const next = curLvl < node.maxLevel ? ' \u2192 ' + levelEffectText(node, curLvl + 1).replace(/^\D+/, '') : '';
        fitText(effect + next, textX, y + 43, w - 64 - 12, 14, { weight: 'bold', color: dim ? UI.textMute : UI.textDim, minPx: 10 });
      }
      if (st === 'owned' && lvlNode) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText('Maxed', textX, y + h - 18, w - 64 - 12, 14, { weight: 'bold', color: UI.gold });
      } else if (st === 'owned') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText('Owned', textX, y + h - 18, w - 64 - 12, 14, { weight: 'bold', color: color });
      } else {
        const cost = node.costs[Math.min(getTreeNodeLevel(node.id), node.costs.length - 1)];
        ctx.save();
        if (dim)
          ctx.globalAlpha *= 0.55;
        drawCostRow(cost, textX, y + h - 18, w - 64 - 12, 15);
        ctx.restore();
      }
    }

    // Purchase flash
    const flash = treePurchaseFlash[node.id];
    if (flash !== undefined) {
      const t = (performance.now() - flash) / 600;
      if (t >= 1)
        delete treePurchaseFlash[node.id];
      else {
        roundRectPath(x - t * 16, y - t * 16, w + t * 32, h + t * 32, 12 + t * 10);
        ctx.lineWidth = 4 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
        roundRectPath(x, y, w, h, 12);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // What a level-up upgrade gives at a level ('Bag 300')
  function levelEffectText(node, lvl) {
    lvl = Math.min(node.maxLevel, lvl);
    switch (node.upgradeKey) {
      case 'carryCapacity': return 'Bag ' + (BASE_CARRY_CAPACITY + 25 * lvl);
      case 'droneCargo': return 'Cargo ' + (15 + 20 * lvl) * (hasArtifact('hiveLink') ? 2 : 1);
      case 'droneCount': return 'Couriers ' + Math.min(NS.drones.MAX_DRONES_PER_KIND, (G.unlockedTools.droneBay ? 1 : 0) + (G.primaryGadget === 'droneyard' ? 1 : 0) + lvl);
      case 'gunDroneCount': return 'Gun drones ' + Math.min(NS.drones.MAX_DRONES_PER_KIND, 1 + lvl);
      case 'repairDroneCount': return 'Repair drones ' + Math.min(NS.drones.MAX_DRONES_PER_KIND, 1 + lvl);
    }
    return '';
  }

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  }

  function hitTreeNode(mx, my) {
    if (G.treeTab === 'artifacts' || my < TREE_VIEW.y || my > TREE_VIEW.y + TREE_VIEW.h) return null;
    const { x: tx, y: ty } = screenToTreeCoords(mx, my);
    for (const ln of computeTreeLayout())
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h)
        return ln;
    return null;
  }

  function tryPurchaseTreeNode(node) {
    const before = getTreeNodeLevel(node.id);
    if (isTreeNodeAvailable(node) && canAffordTreeNode(node))
      purchaseTreeNode(node);
    else
      SZ.GameAudio.play('error');
    if (getTreeNodeLevel(node.id) > before)
      treePurchaseFlash[node.id] = performance.now();
  }

  // Zoom the tree around a screen point (smoothly animated)
  function zoomTreeAt(mx, my, factor) {
    const z = Math.max(TREE_MIN_ZOOM, Math.min(TREE_MAX_ZOOM, treeCam.tz * factor));
    const ratio = z / treeCam.tz;
    treeCam.tx = mx - (mx - treeCam.tx) * ratio;
    treeCam.ty = my - (my - treeCam.ty) * ratio;
    treeCam.tz = z;
  }

  // Pan the camera target so a card is fully visible
  function revealTreeNode(ln) {
    const z = treeCam.tz;
    const m = 40;
    const sx = treeCam.tx + ln.x * z, sy = treeCam.ty + ln.y * z;
    const sw = ln.w * z, sh = ln.h * z;
    if (sx < TREE_VIEW.x + m) treeCam.tx += TREE_VIEW.x + m - sx;
    else if (sx + sw > TREE_VIEW.x + TREE_VIEW.w - m) treeCam.tx -= sx + sw - (TREE_VIEW.x + TREE_VIEW.w - m);
    if (sy < TREE_VIEW.y + m) treeCam.ty += TREE_VIEW.y + m - sy;
    else if (sy + sh > TREE_VIEW.y + TREE_VIEW.h - m) treeCam.ty -= sy + sh - (TREE_VIEW.y + TREE_VIEW.h - m);
  }

  function focusTreeNode(ln) {
    G.treeFocusId = ln.node.id;
    G.upgradeDialogHover = null;
    revealTreeNode(ln);
    const z = treeCam.tz;
    NS.tooltip.setTooltip(0, 0, NS.tooltip.buildUpgradeNodeTooltip(ln.node), 'focus:' + ln.node.id, { x: treeCam.tx + ln.x * z, y: treeCam.ty + ln.y * z, w: ln.w * z, h: ln.h * z });
    tooltip.delayTimer = TOOLTIP_DELAY;
  }

  // Keyboard control of the upgrade tree; returns true when the key was used
  function handleUpgradeDialogKey(e) {
    const nodes = computeTreeLayout();
    const tabs = ['all'].concat(TREE_BRANCH_ORDER, ['artifacts']);
    if (e.code === 'Tab') {
      const i = tabs.indexOf(G.treeTab);
      setTreeTab(tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
      return true;
    }
    if (/^Digit[1-9]$/.test(e.code) && parseInt(e.code.slice(5), 10) <= tabs.length) {
      setTreeTab(tabs[parseInt(e.code.slice(5), 10) - 1]);
      return true;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+') {
      zoomTreeAt(CANVAS_W / 2, TREE_VIEW.y + TREE_VIEW.h / 2, 1.2);
      return true;
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-') {
      zoomTreeAt(CANVAS_W / 2, TREE_VIEW.y + TREE_VIEW.h / 2, 1 / 1.2);
      return true;
    }
    if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Home') {
      fitTreeView(G.treeTab);
      return true;
    }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    const dir = dirs[e.code];
    if (G.treeTab === 'artifacts')
      return !!dir;
    const inTab = (ln) => G.treeTab === 'all' || ln.branch === G.treeTab;
    if (dir) {
      const cur = G.treeFocusId && G.treeLayout.byId[G.treeFocusId];
      if (!cur || !inTab(cur)) {
        const first = nodes.find(ln => inTab(ln) && treeNodeState(ln.node) === 'ready') || nodes.find(inTab);
        if (first)
          focusTreeNode(first);
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
      if (best)
        focusTreeNode(best);
      return true;
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && G.treeFocusId) {
      const ln = G.treeLayout.byId[G.treeFocusId];
      tryPurchaseTreeNode(ln.node);
      focusTreeNode(ln);
      return true;
    }
    return false;
  }

  // Optionally opens on a branch tab or with a node focused (from the quick panel)
  function openUpgradeDialog(focusId, tab) {
    if (G.state !== STATE_PLAYING && G.state !== STATE_PAUSED) return;
    G.stateBeforeUpgradeDialog = G.state;
    G.state = STATE_UPGRADE_DIALOG;
    G.upgradeDialogHover = null;
    G.upgradePanning = false;
    NS.tooltip.clearTooltip();
    computeTreeLayout();
    const focus = focusId && G.treeLayout.byId[focusId];
    if (focus || tab) {
      G.treeTab = focus ? focus.branch : tab;
      fitTreeView(G.treeTab, true);
      G.upgradeViewCustomized = true;
      if (focus) {
        treeCam.tz = G.upgradeZoom = Math.max(G.upgradeZoom, 0.75);
        treeCam.tx = G.upgradePanX = TREE_VIEW.x + TREE_VIEW.w / 2 - (focus.x + focus.w / 2) * G.upgradeZoom;
        treeCam.ty = G.upgradePanY = TREE_VIEW.y + TREE_VIEW.h / 2 - (focus.y + focus.h / 2) * G.upgradeZoom;
        focusTreeNode(focus);
      }
    } else if (!G.upgradeViewCustomized) {
      // First open of a run fits the selected branch; afterwards the view is kept
      fitTreeView(G.treeTab, true);
      G.upgradeViewCustomized = true;
    }
    treeCam.last = 0;
  }

  function closeUpgradeDialog() {
    NS.tooltip.clearTooltip();
    G.state = G.stateBeforeUpgradeDialog || STATE_PLAYING;
    G.stateBeforeUpgradeDialog = null;
    G.upgradeDialogHover = null;
    saveRun();
  }

  function drawUpgradeDialog() {
    computeTreeLayout();

    // Smooth camera towards its target (frame-rate independent)
    const now = performance.now();
    const dt = treeCam.last ? Math.min(0.1, (now - treeCam.last) / 1000) : 1;
    treeCam.last = now;
    if (!G.upgradePanning) {
      // Keep at least part of the tree on screen
      const all = G.treeLayout.regions.all;
      const keep = 160;
      treeCam.tx = Math.min(TREE_VIEW.x + TREE_VIEW.w - keep - all.x * treeCam.tz, Math.max(TREE_VIEW.x + keep - (all.x + all.w) * treeCam.tz, treeCam.tx));
      treeCam.ty = Math.min(TREE_VIEW.y + TREE_VIEW.h - keep - all.y * treeCam.tz, Math.max(TREE_VIEW.y + keep - (all.y + all.h) * treeCam.tz, treeCam.ty));
      const k = 1 - Math.exp(-dt * 14);
      G.upgradeZoom += (treeCam.tz - G.upgradeZoom) * k;
      G.upgradePanX += (treeCam.tx - G.upgradePanX) * k;
      G.upgradePanY += (treeCam.ty - G.upgradePanY) * k;
    }

    drawTreeBackground();

    // ---- Tree content (zoom & pan), or the artifact gallery ----
    if (G.treeTab === 'artifacts')
      drawArtifactGallery();
    else
      drawTreeContent();
    drawTreeHeader();
  }

  function drawTreeContent() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(TREE_VIEW.x, TREE_VIEW.y, TREE_VIEW.w, TREE_VIEW.h);
    ctx.clip();
    ctx.translate(G.upgradePanX, G.upgradePanY);
    ctx.scale(G.upgradeZoom, G.upgradeZoom);

    const viewL = (TREE_VIEW.x - G.upgradePanX) / G.upgradeZoom;
    const viewT = (TREE_VIEW.y - G.upgradePanY) / G.upgradeZoom;
    const viewR = viewL + TREE_VIEW.w / G.upgradeZoom;
    const viewB = viewT + TREE_VIEW.h / G.upgradeZoom;
    const compact = G.upgradeZoom < 0.6;

    // Branch regions with headers and progress
    for (const branch of TREE_BRANCH_ORDER) {
      const r = G.treeLayout.regions[branch];
      if (r.x > viewR || r.x + r.w < viewL || r.y > viewB || r.y + r.h < viewT) continue;
      const color = TREE_BRANCH_COLORS[branch];
      roundRectPath(r.x, r.y, r.w, r.h, 22);
      ctx.fillStyle = hexToRgba(color, 0.045);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.stroke();
      let owned = 0, total = 0;
      for (const n of UPGRADE_TREE)
        if (n.branch === branch) {
          ++total;
          if (isTreeNodeMaxed(n.id)) ++owned;
        }
      // Header only when its strip is on screen (the clip would hide it anyway)
      if (r.y + TREE_REGION_HEADER < viewT || r.y > viewB || r.x + TREE_REGION_PAD < viewL - 40 || r.x > viewR) continue;
      const headPx = compact ? Math.min(48, 20 / G.upgradeZoom) : 30;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelW = fitText(TREE_BRANCH_LABELS[branch], r.x + TREE_REGION_PAD, r.y + TREE_REGION_HEADER / 2, r.w * 0.5, headPx, { weight: 'bold', color });
      const mx = r.x + TREE_REGION_PAD + labelW + 24;
      const mw = Math.min(260, r.x + r.w - TREE_REGION_PAD - mx - 90);
      if (mw > 40) {
        drawMeter(mx, r.y + TREE_REGION_HEADER / 2 - 6, mw, 12, owned / total, color);
        fitText(`${owned} / ${total}`, mx + mw + 12, r.y + TREE_REGION_HEADER / 2, 80, compact ? headPx * 0.6 : 18, { weight: 'bold', color: UI.textDim });
      }
      for (const g of r.groups || [])
        if (g.group && TREE_GROUP_LABELS[g.group])
          fitText(TREE_GROUP_LABELS[g.group], g.x, r.y + TREE_REGION_HEADER / 2, TREE_CARD_W * 2, headPx * 0.85, { weight: 'bold', color });
    }

    // Connectors: locked first, owned last so the brightest lines sit on top
    const edges = [[], [], []];
    for (const ln of G.treeLayout.nodes)
      for (const pid of ln.node.prereqs) {
        const parent = G.treeLayout.byId[prereqId(pid)];
        if (!parent || parent.branch !== ln.branch) continue;
        const minX = Math.min(parent.x, ln.x) - TREE_GAP_X, maxX = Math.max(parent.x + parent.w, ln.x + ln.w) + TREE_GAP_X;
        const minY = Math.min(parent.y, ln.y) - TREE_GAP_Y, maxY = Math.max(parent.y + parent.h, ln.y + ln.h) + TREE_GAP_Y;
        if (minX > viewR || maxX < viewL || minY > viewB || maxY < viewT) continue;
        const pOwned = isPrereqMet(pid);
        edges[pOwned ? (isTreeNodeMaxed(ln.node.id) ? 2 : 1) : 0].push([parent, ln]);
      }
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 3; ++pass)
      for (const [parent, ln] of edges[pass]) {
        const color = TREE_BRANCH_COLORS[ln.branch];
        if (pass === 0) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(130,140,170,0.28)';
          ctx.setLineDash([7, 7]);
        } else if (pass === 1) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = hexToRgba(color, 0.7);
          ctx.setLineDash([]);
        } else {
          ctx.lineWidth = 4;
          ctx.strokeStyle = color;
          ctx.setLineDash([]);
        }
        strokeTreeConnector(parent, ln);
      }
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';

    // Cards
    for (const ln of G.treeLayout.nodes) {
      if (ln.x > viewR || ln.x + ln.w < viewL || ln.y > viewB || ln.y + ln.h < viewT) continue;
      drawTreeCard(ln, treeNodeState(ln.node), compact);
    }
    ctx.restore();

    // Keep the keyboard tooltip glued to the focused card while the camera moves
    if (G.treeFocusId && tooltip.lastHoverKey === 'focus:' + G.treeFocusId) {
      const ln = G.treeLayout.byId[G.treeFocusId];
      tooltip.anchor = { x: G.upgradePanX + ln.x * G.upgradeZoom, y: G.upgradePanY + ln.y * G.upgradeZoom, w: ln.w * G.upgradeZoom, h: ln.h * G.upgradeZoom };
    }
  }

  function drawTreeHeader() {
    // ---- Header ----
    drawPanel(12, 8, CANVAS_W - 24, 142, { accent: UI.gold, radius: 14 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Upgrade Tree', 34, 38, 360, 30, { weight: 'bold', color: UI.gold });
    let totalPurchased = 0;
    for (const n of UPGRADE_TREE)
      totalPurchased += getTreeNodeLevel(n.id);
    ctx.textAlign = 'right';
    fitText(`${totalPurchased} / ${UPGRADE_TREE.length} upgrades`, CANVAS_W - 300, 38, 220, 18, { weight: 'bold', color: UI.textDim });
    drawMeter(CANVAS_W - 286, 32, 250, 12, totalPurchased / UPGRADE_TREE.length, UI.gold);

    // Tabs
    for (const t of getTreeTabs()) {
      const active = G.treeTab === t.id;
      const hover = G.mouseAimX >= t.x && G.mouseAimX <= t.x + t.w && G.mouseAimY >= t.y && G.mouseAimY <= t.y + t.h;
      const color = t.id === 'all' ? UI.gold : (t.id === 'artifacts' ? '#e0a0ff' : TREE_BRANCH_COLORS[t.id]);
      roundRectPath(t.x, t.y, t.w, t.h, 9);
      ctx.fillStyle = active ? hexToRgba(color, 0.24) : (hover ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fill();
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeStyle = active ? color : 'rgba(255,255,255,0.1)';
      ctx.stroke();
      let label = t.id === 'all' ? 'All' : (t.id === 'artifacts' ? `Artifacts  ${G.artifacts.length}/${ARTIFACTS.length}` : TREE_BRANCH_LABELS[t.id].charAt(0) + TREE_BRANCH_LABELS[t.id].slice(1).toLowerCase());
      if (t.id !== 'all' && t.id !== 'artifacts') {
        let o = 0, c = 0;
        for (const n of UPGRADE_TREE)
          if (n.branch === t.id) {
            ++c;
            if (isTreeNodeMaxed(n.id)) ++o;
          }
        label += `  ${o}/${c}`;
      }
      ctx.beginPath();
      ctx.arc(t.x + 18, t.y + t.h / 2, 5, 0, TWO_PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, t.x + 32, t.y + t.h / 2 + 1, t.w - 42, 17, { weight: 'bold', color: active ? '#fff' : UI.textDim });
    }

    // Resource strip
    const entries = NS.mineHud.RESOURCE_HUD_ENTRIES;
    const slotW = (CANVAS_W - 72) / entries.length;
    for (let i = 0; i < entries.length; ++i) {
      const e = entries[i];
      const sx = 36 + i * slotW;
      const have = G.resources[e.key] || 0;
      drawSprite(e.key, sx + 11, 126, 20, have > 0 ? 1 : 0.35);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(String(have), sx + 25, 127, slotW - 30, 16, { weight: 'bold', color: have > 0 ? e.color : UI.textMute });
    }

    // ---- Footer: legend and controls ----
    const fy = CANVAS_H - 50;
    drawPanel(12, fy, CANVAS_W - 24, 42, { radius: 12, shadow: 8, accent: '#6a8ac8' });
    const legend = [
      ['Owned', 'owned'], ['Can buy', 'ready'], ['Need resources', 'poor'], ['Locked', 'locked']
    ];
    let lx = 30;
    for (const [label, st] of legend) {
      roundRectPath(lx, fy + 13, 26, 16, 5);
      if (st === 'owned') ctx.fillStyle = hexToRgba(UI.accent, 0.35);
      else if (st === 'ready') ctx.fillStyle = hexToRgba(UI.accent, 0.18);
      else if (st === 'poor') ctx.fillStyle = 'rgba(40,36,30,0.95)';
      else ctx.fillStyle = 'rgba(16,18,26,0.95)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : (st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.accent);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lx += 34 + fitText(label, lx + 34, fy + 22, 130, 15, { color: UI.textDim }) + 22;
    }
    NS.gadgetArt.drawKeyHints([
      { key: 'Wheel', label: 'Zoom' },
      { key: 'Drag', label: 'Pan' },
      { key: '←↑→↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Tab', label: 'Branch' },
      { key: 'Esc', label: 'Close' }
    ], (lx + CANVAS_W - 24) / 2, fy + 21, CANVAS_W - 24 - lx - 16);
  }

  // Convert screen coords to tree-local coords (inverse zoom/pan)
  function screenToTreeCoords(mx, my) {
    return {
      x: (mx - G.upgradePanX) / G.upgradeZoom,
      y: (my - G.upgradePanY) / G.upgradeZoom
    };
  }

  function handleUpgradeDialogClick(mx, my) {
    for (const t of getTreeTabs())
      if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) {
        setTreeTab(t.id);
        return true;
      }
    const ln = hitTreeNode(mx, my);
    if (ln) {
      G.treeFocusId = ln.node.id;
      tryPurchaseTreeNode(ln.node);
      return true;
    }
    return my < TREE_VIEW.y || my > TREE_VIEW.y + TREE_VIEW.h;
  }

  function handleUpgradeDialogHover(mx, my) {
    const ln = hitTreeNode(mx, my);
    G.upgradeDialogHover = ln ? ln.node.id : null;
  }

  NS.upgradeTree = { TREE_VIEW, getTreeNodeInfo, treeNodeState, drawCostRow, levelEffectText, toRoman,
    tryPurchaseTreeNode, zoomTreeAt, handleUpgradeDialogKey, openUpgradeDialog, closeUpgradeDialog,
    drawUpgradeDialog, handleUpgradeDialogClick, handleUpgradeDialogHover };
})();
