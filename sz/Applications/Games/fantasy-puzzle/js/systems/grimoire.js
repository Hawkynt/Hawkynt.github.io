/* Grimoire rules: node ranks and states, buying, robes, the tree layout and its keyboard selection,
   opening it from a running level. Owns G.tree* and the from-level snapshot; reads G.save and the
   session. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, STATE_PLAYING, STATE_PAUSED, STATE_OUT_OF_MANA, ROBES, TREE, TREE_BY_ID, TREE_ROBES,
    TREE_BRANCH_LIST } = NS.consts;
  const { sfx, floatingText } = NS.context;
  const { writeSave } = NS.store;

  function treeLevel(id) {
    return G.save.tree[id] | 0;
  }

  function nodeState(id) {
    const node = TREE_BY_ID[id];
    if (!node)
      return 'locked';
    const rank = treeLevel(id);
    if (rank >= node.costs.length)
      return 'maxed';
    for (const [reqId, reqLevel] of node.req)
      if (treeLevel(reqId) < reqLevel)
        return 'locked';
    if (G.save.shards < node.costs[rank])
      return 'expensive';
    return 'available';
  }

  /* The Grimoire can be opened from a running level; whatever is bought there
     applies to that level as soon as the player returns to it. */
  let grimoireSnapshot = null;

  function openGrimoireFromLevel() {
    if (G.state !== STATE_PLAYING && G.state !== STATE_PAUSED && G.state !== STATE_OUT_OF_MANA)
      return;
    grimoireSnapshot = { a_well: treeLevel('a_well'), a_deep: treeLevel('a_deep'), i_hint: treeLevel('i_hint'), c_undo: treeLevel('c_undo'), c_free: treeLevel('c_free') };
    G.prevScreen = STATE_PAUSED;
    G.treeLayout = buildTreeLayout();
    selectFirstInBranch();
    NS.screens.setScreen('grimoire');
  }

  function closeGrimoire() {
    if (G.prevScreen === STATE_PAUSED && grimoireSnapshot && G.puzzle) {
      const was = grimoireSnapshot;
      const moreMana = (treeLevel('a_well') - was.a_well) + (treeLevel('a_deep') - was.a_deep);
      G.manaTotal += moreMana;
      G.mana += moreMana;
      G.hintsLeft += treeLevel('i_hint') - was.i_hint;
      if (treeLevel('c_free'))
        G.undosLeft = Infinity;
      else
        G.undosLeft += 5 * (treeLevel('c_undo') - was.c_undo);
      if (moreMana > 0)
        floatingText.add(VIEW_W / 2, 150, '+' + moreMana + ' mana', { color: '#7ad0ff', font: 'bold 22px sans-serif' });
    }
    grimoireSnapshot = null;
    NS.screens.setScreen(G.prevScreen);
  }

  function buyNode(id) {
    if (nodeState(id) !== 'available') {
      sfx('error', { volume: 0.4 });
      return false;
    }
    const node = TREE_BY_ID[id];
    G.save.shards -= node.costs[treeLevel(id)];
    G.save.tree[id] = treeLevel(id) + 1;
    const robes = TREE_ROBES[id];
    if (robes)
      for (const robeId of robes)
        if (G.save.robes.indexOf(robeId) < 0)
          G.save.robes.push(robeId);
    writeSave();
    sfx('powerup');
    sfx('coin');
    return true;
  }

  function selectRobe(id) {
    if (!ROBES[id] || G.save.robes.indexOf(id) < 0) {
      sfx('error', { volume: 0.4 });
      return false;
    }
    G.save.robe = id;
    writeSave();
    sfx('select');
    return true;
  }

  /* which Grimoire node unlocks a robe, for the Wardrobe's lock labels */
  function robeRequirement(id) {
    for (const nodeId in TREE_ROBES)
      if (TREE_ROBES[nodeId].indexOf(id) >= 0)
        return TREE_BY_ID[nodeId].name;
    return '';
  }

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function treeMaxedCount() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  /* column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (const [reqId] of node.req) {
      const parent = TREE_BY_ID[reqId];
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

  /* tabs plus the card grid of the active branch, centered in the card area */
  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE_BRANCH_LIST.length - 1) * 8) / TREE_BRANCH_LIST.length;
    for (let i = 0; i < TREE_BRANCH_LIST.length; ++i) {
      const b = TREE_BRANCH_LIST[i];
      const nodes = TREE.filter(function(n) { return n.branch === b.id; });
      let maxed = 0;
      for (const node of nodes)
        if (treeLevel(node.id) >= node.costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCH_LIST[G.treeBranch];
    const cols = [];
    for (const node of TREE) {
      if (node.branch !== branch.id)
        continue;
      const d = treeDepth(node);
      if (!cols[d]) cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c]) rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c]) continue;
      for (let r = 0; r < cols[c].length; ++r) {
        const node = cols[c][r];
        cards.push({
          node: node,
          col: c,
          row: r,
          x: startX + c * (TREE_CARD_W + TREE_COL_GAP),
          y: startY + r * (TREE_CARD_H + gap),
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          state: nodeState(node.id)
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!G.treeLayout)
      return null;
    return G.treeLayout.cards.find(function(c) { return c.node.id === id; }) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[G.treeBranch].id;
    const first = G.treeLayout ? G.treeLayout.cards.find(function(c) { return c.node.branch === branchId; }) : null;
    G.treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!G.treeLayout)
      G.treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[G.treeBranch].id;
    const cur = treeCardById(G.treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of G.treeLayout.cards) {
      if (card.node.branch !== branchId)
        continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort(function(a, b) { return a - b; });
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      G.treeBranch = (G.treeBranch + (ci < 0 ? -1 : 1) + TREE_BRANCH_LIST.length) % TREE_BRANCH_LIST.length;
      G.treeLayout = buildTreeLayout();
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    G.treeSelected = col[ri].node.id;
    sfx('click', { volume: 0.4 });
  }

  NS.grimoire = { treeLevel, nodeState, openGrimoireFromLevel, buildTreeLayout, selectFirstInBranch, closeGrimoire,
    buyNode, selectRobe, robeRequirement, romanNumeral, treeMaxedCount, moveTreeSelection };
})();
