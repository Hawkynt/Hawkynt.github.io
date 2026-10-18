/* ui/research-screen.js -- the zoomable research screen with its camera, cards and keyboard control.
   Owns state: G.treeDrag, G.treeReturn
   Reads: constants, enemyTypes, env, pixelArt, text, widgets, research, towerArt, towers, savegame and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_BUILD, STATE_RESEARCH, clamp, hexToRgba } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx, audio, updateWindowTitle } = NS.env;
  const { drawIcon } = NS.pixelArt;
  const { fitText, drawTextBlock, toRoman } = NS.text;
  const { UI, roundRectPath, drawPanel, drawMeter, drawChip, drawKeyHints, drawScrim, pointer, addRegion,
      uiButton } = NS.widgets;
  const { TREE_BRANCHES, TREE_BRANCH_INFO, TREE, TREE_BY_ID, techLevel, treeNodeState, buyTreeNode } = NS.research;
  const { drawTowerIcon } = NS.towerArt;
  const { towerMaxHp } = NS.towers;
  const { runIsOpen, saveGame } = NS.savegame;

  /* ══════════════════════════════════════════════════════════════════
     RESEARCH SCREEN -- branch regions with cards, connectors routed in
     the gaps, smooth zoom and pan, keyboard focus
     ══════════════════════════════════════════════════════════════════ */

  const CARD_W = 176, CARD_H = 70, GAP_X = 40, GAP_Y = 16, REGION_PAD = 22, REGION_HEAD = 50, REGION_GAP = 60;
  const treeCam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
  const treeFlash = {};
  let treeTab = 'all';
  let treeFocus = null;
  let treeLayout = null;

  function treeBranches() {
    return TREE_BRANCHES;
  }

  function computeTreeLayout() {
    if (treeLayout) return treeLayout;
    const nodes = [], regions = {};
    // Arsenal on the left, the other branches stacked on its right
    let rx = 0;
    const place = (branch, x, y) => {
      const list = TREE.filter(n => n.branch === branch);
      const cols = Math.max(...list.map(n => n.col)) + 1, rows = Math.max(...list.map(n => n.row)) + 1;
      const w = REGION_PAD * 2 + cols * CARD_W + (cols - 1) * GAP_X;
      const h = REGION_HEAD + REGION_PAD + rows * CARD_H + (rows - 1) * GAP_Y;
      regions[branch] = { x, y, w, h };
      for (const n of list)
        nodes.push({ n, x: x + REGION_PAD + n.col * (CARD_W + GAP_X), y: y + REGION_HEAD + n.row * (CARD_H + GAP_Y), w: CARD_W, h: CARD_H, branch });
      return { w, h };
    };
    const a = place('arsenal', 0, 0);
    rx = a.w + REGION_GAP;
    let ry = 0;
    for (const b of treeBranches().slice(1)) {
      const r = place(b, rx, ry);
      ry += r.h + REGION_GAP;
    }
    let maxX = 0, maxY = 0;
    for (const k in regions) {
      maxX = Math.max(maxX, regions[k].x + regions[k].w);
      maxY = Math.max(maxY, regions[k].y + regions[k].h);
    }
    regions.all = { x: 0, y: 0, w: maxX, h: maxY };
    const byId = {};
    for (const ln of nodes) byId[ln.n.id] = ln;
    treeLayout = { nodes, regions, byId };
    return treeLayout;
  }

  function treeView() {
    return { x: 8, y: 104, w: G.UW - 16, h: G.UH - 104 - 50 };
  }

  function fitTree(tab, instant) {
    const L = computeTreeLayout();
    const r = L.regions[tab] || L.regions.all;
    const v = treeView();
    const z = clamp(Math.min((v.w - 30) / r.w, (v.h - 30) / r.h), 0.25, 1.15);
    treeCam.tz = z;
    treeCam.tx = v.x + v.w / 2 - (r.x + r.w / 2) * z;
    treeCam.ty = v.y + v.h / 2 - (r.y + r.h / 2) * z;
    if (instant) {
      treeCam.x = treeCam.tx; treeCam.y = treeCam.ty; treeCam.z = treeCam.tz;
    }
  }

  // Research opened from a running map: the map pauses (and is saved) behind the tree
  function openResearchFromMap() {
    if (G.state === STATE_PLAYING || G.state === STATE_BUILD) {
      G.pausedFrom = G.state;
      G.state = STATE_PAUSED;
    }
    if (G.state !== STATE_PAUSED)
      return;
    G.overlay = null;
    saveGame();
    openResearch();
  }

  // New research reaches the towers already standing; gold and lives of the run stay as they are
  function applyResearchToRun() {
    if (!runIsOpen())
      return;
    for (const t of G.towers) {
      t.stats = null;
      const newMax = towerMaxHp(t.tier);
      if (newMax > t.maxHp) {
        t.hp += newMax - t.maxHp;
        t.maxHp = newMax;
      }
    }
    ++G.towerVersion;
  }

  function openResearch() {
    G.treeReturn = G.state;
    G.state = STATE_RESEARCH;
    treeLayout = null;
    treeTab = 'all';
    treeFocus = null;
    fitTree('all', true);
    audio.play('select');
    updateWindowTitle();
  }

  function closeResearch() {
    applyResearchToRun();
    G.state = G.treeReturn === STATE_RESEARCH ? STATE_READY : G.treeReturn;
    G.treeDrag = null;
    audio.play('click', { pitch: 0.8 });
    updateWindowTitle();
  }

  function setTreeTab(tab) {
    treeTab = tab;
    fitTree(tab);
    if (treeFocus && tab !== 'all' && computeTreeLayout().byId[treeFocus].branch !== tab)
      treeFocus = null;
    audio.play('click');
  }

  function zoomTreeAt(ux, uy, f) {
    const z = clamp(treeCam.tz * f, 0.25, 1.6);
    const k = z / treeCam.tz;
    treeCam.tx = ux - (ux - treeCam.tx) * k;
    treeCam.ty = uy - (uy - treeCam.ty) * k;
    treeCam.tz = z;
  }

  function treePoint(ux, uy) {
    return { x: (ux - treeCam.x) / treeCam.z, y: (uy - treeCam.y) / treeCam.z };
  }

  function treeNodeAt(ux, uy) {
    const v = treeView();
    if (ux < v.x || uy < v.y || ux > v.x + v.w || uy > v.y + v.h) return null;
    const p = treePoint(ux, uy);
    for (const ln of computeTreeLayout().nodes)
      if ((treeTab === 'all' || ln.branch === treeTab) && p.x >= ln.x && p.x <= ln.x + ln.w && p.y >= ln.y && p.y <= ln.y + ln.h)
        return ln;
    return null;
  }

  function treeNodeTooltip(n) {
    const lvl = techLevel(n.id);
    const st = treeNodeState(n);
    const lines = [n.name + (n.max > 1 ? ` ${toRoman(Math.max(1, lvl))}/${toRoman(n.max)}` : ''), n.desc];
    lines.push('--- Effect ---');
    if (lvl > 0) lines.push(`✔ Now: ${n.effect(lvl)}`);
    if (lvl < n.max) lines.push(`★ Next: ${n.effect(lvl + 1)}`);
    if (st === 'locked' && n.boss) lines.push(`✘ Defeat the ${ENEMY_TYPES[n.boss].name} to unlock it`);
    else if (st === 'locked') lines.push(`✘ Requires ${n.req.map(r => TREE_BY_ID[r].name).join(', ')}`);
    else if (st === 'poor') lines.push(`✘ Costs ${n.cost[lvl]} research (you have ${G.meta.rp})`);
    else if (st === 'ready') lines.push(`✔ Costs ${n.cost[lvl]} research · click or Enter`);
    else lines.push('✔ Fully researched');
    return lines;
  }

  function drawResearch() {
    const L = computeTreeLayout();
    const v = treeView();
    // Smooth camera
    const k = 1 - Math.exp(-G.frameDt * 12);
    if (!G.treeDrag) {
      const all = L.regions.all, keep = 140;
      treeCam.tx = clamp(treeCam.tx, v.x + keep - (all.x + all.w) * treeCam.tz, v.x + v.w - keep - all.x * treeCam.tz);
      treeCam.ty = clamp(treeCam.ty, v.y + keep - (all.y + all.h) * treeCam.tz, v.y + v.h - keep - all.y * treeCam.tz);
    }
    treeCam.x += (treeCam.tx - treeCam.x) * (G.treeDrag ? 1 : k);
    treeCam.y += (treeCam.ty - treeCam.y) * (G.treeDrag ? 1 : k);
    treeCam.z += (treeCam.tz - treeCam.z) * k;

    drawScrim(0.82);
    // Blueprint grid
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, v.h);
    ctx.clip();
    const step = 48 * treeCam.z;
    if (step > 8) {
      ctx.beginPath();
      for (let x = ((treeCam.x % step) + step) % step + v.x - step; x < v.x + v.w; x += step) { ctx.moveTo(Math.round(x) + 0.5, v.y); ctx.lineTo(Math.round(x) + 0.5, v.y + v.h); }
      for (let y = ((treeCam.y % step) + step) % step + v.y - step; y < v.y + v.h; y += step) { ctx.moveTo(v.x, Math.round(y) + 0.5); ctx.lineTo(v.x + v.w, Math.round(y) + 0.5); }
      ctx.strokeStyle = 'rgba(120,160,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.translate(treeCam.x, treeCam.y);
    ctx.scale(treeCam.z, treeCam.z);
    // Regions
    for (const b of treeBranches()) {
      const r = L.regions[b], info = TREE_BRANCH_INFO[b];
      if (!r) continue;
      const dim = treeTab !== 'all' && treeTab !== b;
      ctx.globalAlpha = dim ? 0.25 : 1;
      roundRectPath(r.x, r.y, r.w, r.h, 18);
      ctx.fillStyle = hexToRgba(info.color, 0.05);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = hexToRgba(info.color, 0.3);
      ctx.stroke();
      const list = TREE.filter(n => n.branch === b);
      let owned = 0, total = 0;
      for (const n of list) { total += n.max; owned += techLevel(n.id); }
      drawIcon(info.icon, r.x + REGION_PAD + 10, r.y + REGION_HEAD / 2, 22);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lw = fitText(info.name, r.x + REGION_PAD + 28, r.y + REGION_HEAD / 2 + 1, r.w * 0.45, 24, { weight: 'bold', color: info.color });
      const mx = r.x + REGION_PAD + 40 + lw, mw = Math.min(200, r.x + r.w - REGION_PAD - mx - 70);
      if (mw > 40) {
        drawMeter(mx, r.y + REGION_HEAD / 2 - 5, mw, 10, owned / total, info.color);
        fitText(`${owned}/${total}`, mx + mw + 10, r.y + REGION_HEAD / 2 + 1, 60, 14, { weight: 'bold', color: UI.textDim });
      }
      ctx.globalAlpha = 1;
    }
    // Connectors: locked dashed, owned solid
    ctx.lineCap = 'round';
    for (const ln of L.nodes) {
      for (const rid of ln.n.req) {
        const p = L.byId[rid];
        if (!p) continue;
        const own = techLevel(rid) > 0, done = techLevel(ln.n.id) > 0;
        const color = TREE_BRANCH_INFO[ln.branch].color;
        ctx.globalAlpha = treeTab !== 'all' && treeTab !== ln.branch ? 0.25 : 1;
        ctx.strokeStyle = own ? (done ? color : hexToRgba(color, 0.65)) : 'rgba(140,150,180,0.35)';
        ctx.lineWidth = own ? (done ? 4 : 3) : 2;
        ctx.setLineDash(own ? [] : [6, 6]);
        const x0 = p.x + p.w, y0 = p.y + p.h / 2, x1 = ln.x, y1 = ln.y + ln.h / 2;
        const mx = x0 + GAP_X / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        if (Math.abs(y0 - y1) < 1) ctx.lineTo(x1, y1);
        else if (x1 > x0) {
          ctx.lineTo(mx - 8, y0); ctx.arcTo(mx, y0, mx, y0 + Math.sign(y1 - y0) * 8, 8);
          ctx.lineTo(mx, y1 - Math.sign(y1 - y0) * 8); ctx.arcTo(mx, y1, mx + 8, y1, 8);
          ctx.lineTo(x1, y1);
        } else {
          // Same column, below: drop down from the parent's bottom
          ctx.moveTo(p.x + p.w / 2, p.y + p.h); ctx.lineTo(ln.x + ln.w / 2, ln.y);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Cards
    const hoverLn = pointer.inside ? treeNodeAt(pointer.ux, pointer.uy) : null;
    for (const ln of L.nodes)
      drawTreeCard(ln, hoverLn === ln);
    ctx.restore();
    drawTreeHeader();
    // Tooltip for hover / keyboard focus
    const tipLn = hoverLn || (treeFocus && L.byId[treeFocus]);
    if (tipLn) {
      const z = treeCam.z;
      addRegion({ id: 'tree-node-' + tipLn.n.id, x: treeCam.x + tipLn.x * z, y: treeCam.y + tipLn.y * z, w: tipLn.w * z, h: tipLn.h * z, anchorTip: true,
        tip: () => treeNodeTooltip(tipLn.n), onClick: () => { treeFocus = tipLn.n.id; buyTreeNode(tipLn.n); }, sound: false });
    }
  }

  function drawTreeCard(ln, hover) {
    const n = ln.n, st = treeNodeState(n), lvl = techLevel(n.id);
    const color = TREE_BRANCH_INFO[ln.branch].color;
    const x = ln.x, y = ln.y, w = ln.w, h = ln.h;
    const focus = treeFocus === n.id;
    ctx.save();
    if (treeTab !== 'all' && treeTab !== ln.branch) ctx.globalAlpha = 0.25;
    roundRectPath(x + 3, y + 5, w, h, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (st === 'owned') { g.addColorStop(0, hexToRgba(color, 0.42)); g.addColorStop(1, hexToRgba(color, 0.18)); }
    else if (st === 'ready') { g.addColorStop(0, 'rgba(40,52,84,0.97)'); g.addColorStop(1, 'rgba(18,24,42,0.97)'); }
    else if (st === 'poor') { g.addColorStop(0, 'rgba(46,40,30,0.95)'); g.addColorStop(1, 'rgba(24,20,14,0.95)'); }
    else { g.addColorStop(0, 'rgba(22,24,34,0.95)'); g.addColorStop(1, 'rgba(12,13,20,0.95)'); }
    roundRectPath(x, y, w, h, 10);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = st === 'ready' ? 2.5 : 1.5;
    ctx.strokeStyle = st === 'owned' ? color : st === 'ready' ? hexToRgba(color, 0.95) : st === 'poor' ? 'rgba(255,182,72,0.6)' : 'rgba(120,130,160,0.35)';
    ctx.stroke();
    if (st === 'ready') {
      roundRectPath(x - 3, y - 3, w + 6, h + 6, 12);
      ctx.strokeStyle = hexToRgba(color, 0.25 + 0.2 * Math.sin(G.animTime * 4));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (hover || focus) {
      roundRectPath(x - 4, y - 4, w + 8, h + 8, 13);
      ctx.strokeStyle = focus ? UI.gold : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = focus ? 3 : 2;
      ctx.stroke();
    }
    // Icon well
    roundRectPath(x + 8, y + 8, 44, 44, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    const dim = st === 'locked' ? 0.4 : 1;
    ctx.globalAlpha *= dim;
    if (n.tower !== undefined && !n.icon)
      drawTowerIcon(n.tower, 3, x + 30, y + 30, 40);
    else if (n.tower !== undefined) {
      drawTowerIcon(n.tower, 1, x + 30, y + 30, 36);
      drawIcon(n.icon, x + 44, y + 44, 16);
    } else
      drawIcon(n.icon, x + 30, y + 30, 28);
    ctx.globalAlpha /= dim;
    // Level pips
    if (n.max > 1) {
      const pw = 10;
      for (let i = 0; i < n.max; ++i) {
        ctx.fillStyle = i < lvl ? color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 30 - (n.max * (pw + 2) - 2) / 2 + i * (pw + 2), y + 56, pw, 5);
      }
    }
    if (st === 'owned') drawIcon('check', x + w - 16, y + 15, 18);
    else if (st === 'locked') drawIcon('lock', x + w - 16, y + 15, 16, 0.7);
    // Name and cost
    ctx.textAlign = 'left';
    const tx = x + 60, tw = w - 60 - (st === 'owned' || st === 'locked' ? 28 : 8);
    drawTextBlock(n.name, tx, y + 6, tw, 38, 15, { weight: 'bold', color: st === 'locked' ? '#6a7288' : '#ffffff', valign: 'middle', lineGap: 1.1, minPx: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (st === 'owned')
      fitText('Researched', tx, y + h - 14, w - 70, 12, { weight: 'bold', color });
    else
      fitText(n.boss ? `[[skull]] ${ENEMY_TYPES[n.boss].name}` : `[[flask]] ${n.cost[lvl]}`, tx, y + h - 14, w - 70, 14, { weight: 'bold', color: st === 'ready' ? '#d8f5dc' : st === 'poor' ? '#ff8a8a' : '#6a7288' });
    // Purchase flash
    const f = treeFlash[n.id];
    if (f !== undefined) {
      const t = (performance.now() - f) / 600;
      if (t >= 1) delete treeFlash[n.id];
      else {
        roundRectPath(x - t * 16, y - t * 16, w + t * 32, h + t * 32, 10 + t * 10);
        ctx.lineWidth = 4 * (1 - t);
        ctx.strokeStyle = hexToRgba(color, 1 - t);
        ctx.stroke();
        roundRectPath(x, y, w, h, 10);
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - t)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTreeHeader() {
    drawPanel(8, 8, G.UW - 16, 90, { accent: UI.gold, radius: 12 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Research', 26, 32, 200, 24, { weight: 'bold', color: UI.gold });
    const w = drawChip(`[[flask]] ${G.meta.rp} research`, 150, 20, 26, { px: 14, bg: 'rgba(200,144,255,0.18)', border: 'rgba(200,144,255,0.6)', color: '#ffffff' });
    ctx.textAlign = 'left';
    const fromMap = runIsOpen();
    fitText(fromMap ? 'Map paused - research applies when you return' : 'Earn research by clearing waves, winning maps and earning stars.', 160 + w, 33, G.UW - 170 - w - 150, 12, { weight: fromMap ? 'bold' : undefined, color: fromMap ? UI.warn : UI.textDim });
    uiButton('tree-close', G.UW - 136, 18, 116, 30, fromMap ? 'Back to map' : 'Back', { px: 13, key: 'Esc', onClick: closeResearch });
    const tabs = ['all'].concat(treeBranches());
    const tw = Math.min(170, (G.UW - 48 - (tabs.length - 1) * 8) / tabs.length);
    tabs.forEach((t, i) => {
      const info = TREE_BRANCH_INFO[t];
      let label = t === 'all' ? 'All' : info.name;
      if (t !== 'all') {
        let o = 0, c = 0;
        for (const n of TREE) if (n.branch === t) { c += n.max; o += techLevel(n.id); }
        label += `  ${o}/${c}`;
      }
      uiButton('tree-tab-' + t, 24 + i * (tw + 8), 58, tw, 30, label, { style: treeTab === t ? 'gold' : 'dark', px: 12, icon: info ? info.icon : 'star', key: String(i + 1), onClick: () => setTreeTab(t) });
    });
    // Footer: legend and controls
    const fy = G.UH - 44;
    drawPanel(8, fy, G.UW - 16, 36, { radius: 10, accent: '#6a8ac8' });
    let lx = 22;
    for (const [label, st] of [['Researched', 'owned'], ['Can buy', 'ready'], ['Need research', 'poor'], ['Locked', 'locked']]) {
      roundRectPath(lx, fy + 11, 22, 14, 4);
      ctx.fillStyle = st === 'owned' ? 'rgba(255,215,90,0.35)' : st === 'ready' ? 'rgba(40,52,84,0.97)' : st === 'poor' ? 'rgba(46,40,30,0.95)' : 'rgba(22,24,34,0.95)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st === 'poor' ? 'rgba(255,182,72,0.8)' : st === 'locked' ? 'rgba(120,130,160,0.5)' : UI.gold;
      ctx.stroke();
      ctx.textAlign = 'left';
      lx += 28 + fitText(label, lx + 28, fy + 19, 110, 12, { color: UI.textDim }) + 16;
    }
    drawKeyHints([{ key: 'Wheel', label: 'Zoom' }, { key: 'Drag', label: 'Pan' }, { key: '←↑→↓', label: 'Select' }, { key: 'Enter', label: 'Buy' }, { key: 'Tab', label: 'Branch' }, { key: '0', label: 'Fit' }],
      (lx + G.UW - 16) / 2, fy + 18, G.UW - 24 - lx - 10);
  }

  function handleResearchKey(e) {
    const L = computeTreeLayout();
    const tabs = ['all'].concat(treeBranches());
    const code = e.code;
    if (code === 'Escape') { closeResearch(); return; }
    if (code === 'Tab') { setTreeTab(tabs[(tabs.indexOf(treeTab) + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]); return; }
    if (/^Digit[1-9]$/.test(code)) {
      const i = +code.slice(5) - 1;
      if (i < tabs.length) setTreeTab(tabs[i]);
      return;
    }
    const v = treeView();
    if (code === 'Equal' || code === 'NumpadAdd') { zoomTreeAt(v.x + v.w / 2, v.y + v.h / 2, 1.2); return; }
    if (code === 'Minus' || code === 'NumpadSubtract') { zoomTreeAt(v.x + v.w / 2, v.y + v.h / 2, 1 / 1.2); return; }
    if (code === 'Digit0' || code === 'Numpad0' || code === 'Home') { fitTree(treeTab); return; }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const inTab = (ln) => treeTab === 'all' || ln.branch === treeTab;
    if (dirs[code]) {
      const d = dirs[code];
      const cur = treeFocus && L.byId[treeFocus];
      let next = null;
      if (!cur || !inTab(cur))
        next = L.nodes.find(ln => inTab(ln) && treeNodeState(ln.n) === 'ready') || L.nodes.find(inTab);
      else {
        let best = 1e9;
        for (const ln of L.nodes) {
          if (ln === cur || !inTab(ln)) continue;
          const dx = ln.x + ln.w / 2 - (cur.x + cur.w / 2), dy = ln.y + ln.h / 2 - (cur.y + cur.h / 2);
          const along = dx * d[0] + dy * d[1];
          if (along <= 1) continue;
          const score = along + (Math.abs(dx * d[1]) + Math.abs(dy * d[0])) * 2.5;
          if (score < best) { best = score; next = ln; }
        }
      }
      if (next) {
        treeFocus = next.n.id;
        // Keep the focused card on screen
        const z = treeCam.tz, m = 30;
        const sx = treeCam.tx + next.x * z, sy = treeCam.ty + next.y * z;
        if (sx < v.x + m) treeCam.tx += v.x + m - sx;
        else if (sx + next.w * z > v.x + v.w - m) treeCam.tx -= sx + next.w * z - (v.x + v.w - m);
        if (sy < v.y + m) treeCam.ty += v.y + m - sy;
        else if (sy + next.h * z > v.y + v.h - m) treeCam.ty -= sy + next.h * z - (v.y + v.h - m);
        audio.play('click', { pitch: 1.4, volume: 0.5 });
      }
      return;
    }
    if ((code === 'Enter' || code === 'Space' || code === 'NumpadEnter') && treeFocus)
      buyTreeNode(TREE_BY_ID[treeFocus]);
  }

  NS.researchScreen = { treeCam, treeFlash, treeView, openResearchFromMap, applyResearchToRun, openResearch,
      closeResearch, zoomTreeAt, drawResearch, handleResearchKey };

})();
