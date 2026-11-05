/* The tech tree screen: five branch columns of nodes with prerequisite links, level pips, state
   colours (maxed, available, too expensive, locked) and shard costs; a detail panel with the
   current and next level and buying. Purchases take effect at once - also mid-run when opened
   from the pause menu. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { BRANCHES, TREE, TREE_BY_ID } = NS.treeData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const COL_W = 236, X0 = 52, Y0 = 196, ROW_H = 118, R = 30;

  function nodePos(n) {
    const bi = BRANCHES.findIndex(b => b.id === n.branch);
    return { x: X0 + bi * COL_W + 62 + n.lane * 106, y: Y0 + n.row * ROW_H };
  }

  function branchColor(id) {
    for (let i = 0; i < BRANCHES.length; ++i) if (BRANCHES[i].id === id) return BRANCHES[i].color;
    return UI.accent;
  }

  function buy(id) {
    const n = TREE_BY_ID[id];
    if (!rules.buyNode(G.profile, id)) {
      sfx('error');
      return false;
    }
    applyNow(id);
    NS.save.writeProfile();
    NS.statusBar.update();
    G.ui.treeFlash = 0.6;
    G.ui.treeFlashId = id;
    const p = nodePos(n);
    NS.fx.ring(p.x, p.y, R, R * 3, 0.5, branchColor(n.branch), 5);
    NS.fx.sparks(p.x, p.y, 24, branchColor(n.branch), 300);
    sfx('levelup');
    return true;
  }

  /* bought tech changes the running maze at once */
  function applyNow(id) {
    const before = G.stats;
    NS.save.refreshStats();
    const run = G.run;
    if (!run || run.demo) return;
    if (id === 's_life' && G.stats.lives > before.lives && run.mode !== 'zen') run.lives += G.stats.lives - before.lives;
    if (id === 's_shield' && run.lvl && !(run.lvl.effects.shield > 0)) run.lvl.effects.shield = NS.items.POWERUP_BY_ID.shield.dur * G.stats.powerDur;
  }

  function draw() {
    const p = G.profile;
    const sel = TREE_BY_ID[G.ui.treeSel] || TREE[0];
    const v = NS.view.visible();
    const fromRun = scr.inRun();
    ctx.fillStyle = fromRun ? 'rgba(2,2,14,0.88)' : 'rgba(2,2,14,0.84)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('TECH TREE', 52, 44, 32, '#ffffff', { weight: 'bold' });
    kit.text(fromRun ? 'Run paused - what you buy works the moment you buy it' : 'Shards come from every mode, quests, streaks, achievements and events', 52, 76, 14, UI.textDim);
    kit.shards(p.shards, 1228, 46, 28, 'right');
    const tp = rules.treeProgress(p);
    kit.text(tp.have + ' / ' + tp.all + ' levels', 1228, 78, 13, UI.textDim, { align: 'right' });

    for (let b = 0; b < BRANCHES.length; ++b) {
      const br = BRANCHES[b];
      const x = X0 + b * COL_W;
      ctx.fillStyle = K.rgba(br.color, 0.06);
      kit.roundRect(x, 104, COL_W - 14, 404, 14);
      ctx.fill();
      ctx.strokeStyle = K.rgba(br.color, 0.28);
      ctx.lineWidth = 1;
      ctx.stroke();
      kit.icon(br.icon, x + 24, 128, 20, br.color);
      kit.text(br.name.toUpperCase(), x + 44, 128, 15, br.color, { weight: 'bold' });
      let have = 0, all = 0;
      for (let i = 0; i < TREE.length; ++i)
        if (TREE[i].branch === br.id) { have += rules.nodeLevel(p, TREE[i].id); all += TREE[i].costs.length; }
      kit.text(have + '/' + all, x + COL_W - 30, 128, 12, UI.textDim, { align: 'right' });
    }

    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      const q = nodePos(n);
      for (let k = 0; k < n.req.length; ++k) {
        const o = nodePos(TREE_BY_ID[n.req[k][0]]);
        const met = rules.nodeLevel(p, n.req[k][0]) >= n.req[k][1];
        ctx.strokeStyle = met ? K.rgba(branchColor(n.branch), 0.85) : 'rgba(120,130,160,0.25)';
        ctx.lineWidth = met ? 3.5 : 2;
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + R);
        ctx.bezierCurveTo(o.x, o.y + R + 26, q.x, q.y - R - 26, q.x, q.y - R);
        ctx.stroke();
      }
    }
    for (let i = 0; i < TREE.length; ++i) drawNode(TREE[i], sel, p, i);
    drawDetail(sel, p);
    NS.fxRender.draw();
    W.button('back', fromRun ? 'Back to the pause menu' : 'Back', 52, 654, 280, 46, {
      icon: 'back', accent: fromRun ? UI.good : UI.accent2, action: () => scr.back('treeReturn'),
    });
  }

  function drawNode(n, sel, p, idx) {
    const q = nodePos(n);
    const state = rules.nodeState(p, n.id);
    const lvl = rules.nodeLevel(p, n.id);
    const col = branchColor(n.branch);
    const isSel = sel.id === n.id;
    const hot = W.area(n.id, q.x - R - 8, q.y - R - 8, R * 2 + 16, R * 2 + 30, () => {
      if (G.ui.treeSel === n.id) buy(n.id);
      else G.ui.treeSel = n.id;
    });
    if (hot) G.ui.treeSel = n.id;
    if (state === 'available') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4 + idx) * 0.15;
      K.blit(ctx, K.glow(col), q.x, q.y, 1.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const owned = lvl > 0;
    const gr = ctx.createRadialGradient(q.x - 8, q.y - 10, 2, q.x, q.y, R);
    gr.addColorStop(0, state === 'locked' ? '#1a1a2a' : owned ? K.shade(col, -0.3) : '#2a2a50');
    gr.addColorStop(1, state === 'locked' ? '#06060e' : '#0a0a1a');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(q.x, q.y, R * (hot ? 1.08 : 1), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = state === 'maxed' ? UI.gold : state === 'locked' ? 'rgba(120,130,160,0.4)' : isSel ? '#ffffff' : col;
    ctx.lineWidth = isSel ? 3.5 : 2.5;
    ctx.stroke();
    if (isSel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -G.time * 12;
      ctx.beginPath();
      ctx.arc(q.x, q.y, R + 7, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    kit.icon(n.icon, q.x, q.y, 26, state === 'locked' ? '#4a4a6a' : owned ? '#ffffff' : col);
    const max = n.costs.length;
    if (max > 1) {
      for (let k = 0; k < max; ++k) {
        const a = -Math.PI * (0.22 + 0.56 * (k + 0.5) / max);
        ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(q.x + Math.cos(a) * (R + 1), q.y + Math.sin(a) * (R + 1), 3.4, 0, TAU);
        ctx.fill();
      }
    }
    if (state === 'locked') kit.lock(q.x + R * 0.72, q.y - R * 0.72, 14);
    if (G.ui.treeFlash > 0 && G.ui.treeFlashId === n.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.ui.treeFlash;
      K.blit(ctx, K.glow('#ffffff'), q.x, q.y, 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const label = state === 'maxed' ? 'MAX' : String(rules.nodeCost(p, n.id));
    kit.text(label, q.x, q.y + R + 13, 12, state === 'maxed' ? UI.gold : state === 'expensive' ? UI.bad : state === 'locked' ? UI.textMute : UI.shard, { align: 'center', weight: 'bold' });
  }

  function drawDetail(n, p) {
    const x = 52, y = 520, w = 1176, h = 120;
    const col = branchColor(n.branch);
    const lvl = rules.nodeLevel(p, n.id);
    const max = n.costs.length;
    const state = rules.nodeState(p, n.id);
    kit.panel(x, y, w, h, { accent: col, glow: true });
    kit.icon(n.icon, x + 50, y + 50, 40, col);
    kit.text(n.name, x + 96, y + 32, 24, '#ffffff', { weight: 'bold' });
    kit.text(max > 1 ? 'Level ' + lvl + ' / ' + max : (lvl ? 'Owned' : 'Not owned'), x + 96, y + 60, 14, UI.textDim);
    kit.text('Now:  ' + (lvl ? n.text(lvl) : 'nothing yet'), x + 360, y + 32, 15, lvl ? UI.text : UI.textMute);
    if (lvl < max) kit.text('Next: ' + n.text(lvl + 1), x + 360, y + 60, 15, UI.good);
    if (state === 'locked') {
      const parts = n.req.map(r => TREE_BY_ID[r[0]].name + (TREE_BY_ID[r[0]].costs.length > 1 ? ' ' + r[1] : ''));
      kit.text('Requires ' + parts.join(' and '), x + 360, y + 90, 14, UI.bad);
    }
    const bx = x + w - 290, by = y + 36;
    if (state !== 'maxed') {
      W.button('buy', state === 'locked' ? 'Locked' : 'Buy  -  ' + rules.nodeCost(p, n.id) + ' shards', bx, by, 270, 48, {
        disabled: state !== 'available', accent: UI.shard, icon: 'shard', action: () => buy(n.id),
      });
    } else
      kit.text('Fully upgraded', bx + 135, by + 24, 18, UI.gold, { align: 'center', weight: 'bold' });
    kit.text('B buys the selected node', x + 96, y + 96, 12, UI.textMute);
  }

  function onKey(e) {
    if (e.code === 'KeyB') {
      buy(G.ui.treeSel);
      return true;
    }
    return false;
  }

  Object.assign(NS.tree, {
    draw, buy, onKey, nodePos, applyNow
  });
})();
