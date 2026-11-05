/* The tech tree screen: five branch columns of levelled nodes with prerequisite links, level
   pips, state colours (maxed, available, too expensive, locked) and costs; a detail panel with
   the current and next level and a Buy button. Purchases take effect at once - also mid-stage
   when opened from the pause menu (the live player gets the new loadout bonuses). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI, TAU } = C;
  const { BRANCHES, TREE, TREE_BY_ID } = NS.meta;
  const K = NS.artKit;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  const COL_W = 236, X0 = 50, Y0 = 186, ROW_H = 96, R = 28;

  function nodePos(n) {
    const bi = BRANCHES.findIndex(b => b.id === n.branch);
    return { x: X0 + bi * COL_W + 62 + n.lane * 102, y: Y0 + n.row * ROW_H };
  }

  function branchColor(id) {
    for (let i = 0; i < BRANCHES.length; ++i) if (BRANCHES[i].id === id) return BRANCHES[i].color;
    return UI.accent;
  }

  /* Applies a purchase to the live run: stat floors rise, abilities switch on */
  function applyLive(id) {
    const run = G.run;
    if (!run || !run.player || run.over) return;
    const p = run.player, P = G.perks;
    p.bombs = Math.max(p.bombs, P.bombs);
    p.fire = Math.max(p.fire, P.fire);
    p.speed = Math.max(p.speed, P.speed);
    if (P.kick) p.kick = true;
    if (P.glove) p.glove = true;
    if (P.remote) p.remote = true;
    if (id === 'g_life' && run.mode !== 'zen' && run.mode !== 'daily') ++run.lives;
    if (id === 'g_shield') p.shield = 1;
    if (id === 't_time' && run.timeLeft > 0) run.timeLeft += 30;
  }

  function buy(id) {
    const n = TREE_BY_ID[id];
    if (!rules.buyNode(G.save, id)) {
      NS.fx.sfx('error');
      return false;
    }
    NS.save.refreshPerks();
    applyLive(id);
    NS.save.writeSave();
    if (G.run && !G.run.over) NS.save.saveRun();
    NS.statusBar.update();
    G.ui.treeFlash = 0.6;
    G.ui.treeFlashId = id;
    const p = nodePos(n);
    NS.fx.ring(p.x, p.y, R, R * 3, 0.5, branchColor(n.branch), 5);
    NS.fx.burst(p.x, p.y, 26, branchColor(n.branch), 300, 0.6, 6, true);
    NS.fx.sfx('levelup');
    NS.tracker.check();
    return true;
  }

  function draw() {
    const save = G.save;
    const sel = TREE_BY_ID[G.ui.treeSel] || TREE[0];
    const fromPause = G.back.tree === 'paused';
    kit.dim(fromPause ? 0.84 : 0.5);
    kit.text('TECH TREE', 60, 44, 32, '#ffffff', { weight: 'bold', stroke: 6 });
    kit.text(fromPause ? 'Stage paused - upgrades apply the moment you buy them' : 'Permanent upgrades for every mode, bought with gems', 60, 78, 14, UI.textDim);
    kit.gems(save.gems, 1220, 46, 26, 'right');
    for (let b = 0; b < BRANCHES.length; ++b) {
      const br = BRANCHES[b];
      const x = X0 + b * COL_W;
      ctx.fillStyle = K.rgba(br.color, 0.08);
      K.roundRect(ctx, x, 104, COL_W - 14, 404, 14); ctx.fill();
      ctx.strokeStyle = K.rgba(br.color, 0.3); ctx.lineWidth = 1.5; ctx.stroke();
      kit.icon(br.icon, x + 26, 128, 22, br.color);
      kit.text(br.name.toUpperCase(), x + 46, 128, 16, br.color, { weight: 'bold' });
      let have = 0, all = 0;
      for (let i = 0; i < TREE.length; ++i) if (TREE[i].branch === br.id) { have += rules.nodeLevel(save, TREE[i].id); all += TREE[i].costs.length; }
      kit.text(have + '/' + all, x + COL_W - 30, 128, 12, UI.textDim, { align: 'right' });
    }
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      const p = nodePos(n);
      for (let k = 0; k < n.req.length; ++k) {
        const q = nodePos(TREE_BY_ID[n.req[k][0]]);
        const met = rules.nodeLevel(save, n.req[k][0]) >= n.req[k][1];
        ctx.strokeStyle = met ? K.rgba(branchColor(n.branch), 0.85) : 'rgba(160,140,160,0.25)';
        ctx.lineWidth = met ? 4 : 2;
        ctx.beginPath(); ctx.moveTo(q.x, q.y + R); ctx.bezierCurveTo(q.x, q.y + R + 22, p.x, p.y - R - 22, p.x, p.y - R); ctx.stroke();
      }
    }
    for (let i = 0; i < TREE.length; ++i) drawNode(TREE[i], sel, save, i);
    detail(sel, save);
    const back = G.back.tree;
    kit.button('back', back === 'paused' ? 'Resume' : 'Back', 50, 656, 220, 46, { icon: back === 'paused' ? 'play' : 'back', accent: back === 'paused' ? UI.good : '#9a8aa0', action: () => back === 'paused' ? scr.setScreen('playing') : scr.back('tree') });
  }

  function drawNode(n, sel, save, i) {
    const p = nodePos(n);
    const state = rules.nodeState(save, n.id);
    const lvl = rules.nodeLevel(save, n.id);
    const col = branchColor(n.branch);
    const isSel = sel.id === n.id;
    const hot = kit.area(n.id, p.x - R - 6, p.y - R - 6, R * 2 + 12, R * 2 + 30, () => {
      if (G.ui.treeSel === n.id) buy(n.id);
      else G.ui.treeSel = n.id;
    });
    if (hot) G.ui.treeSel = n.id;
    if (state === 'available') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4 + i) * 0.15;
      K.blit(ctx, K.glow(col), p.x, p.y, 1.5);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const owned = lvl > 0;
    const gr = ctx.createRadialGradient(p.x - 8, p.y - 10, 2, p.x, p.y, R);
    gr.addColorStop(0, state === 'locked' ? '#2a2230' : owned ? K.shade(col, -0.3) : '#4a3448');
    gr.addColorStop(1, state === 'locked' ? '#0e0a12' : '#1a0e18');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, R * (hot ? 1.08 : 1), 0, TAU); ctx.fill();
    ctx.strokeStyle = state === 'maxed' ? UI.gold : state === 'locked' ? 'rgba(160,140,160,0.4)' : isSel ? '#ffffff' : col;
    ctx.lineWidth = isSel ? 3.5 : 2.5;
    ctx.stroke();
    if (isSel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]); ctx.lineDashOffset = -G.time * 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, R + 7, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    kit.icon(n.icon, p.x, p.y, 28, state === 'locked' ? '#5a5060' : owned ? '#ffffff' : col);
    const max = n.costs.length;
    if (max > 1) for (let k = 0; k < max; ++k) {
      const a = -Math.PI * (0.22 + 0.56 * (k + 0.5) / max);
      ctx.fillStyle = k < lvl ? UI.gold : 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (R + 1), p.y + Math.sin(a) * (R + 1), 3.5, 0, TAU); ctx.fill();
    }
    if (state === 'locked') kit.icon('lock', p.x + R * 0.7, p.y - R * 0.7, 16, '#c8c0d0');
    if (G.ui.treeFlash > 0 && G.ui.treeFlashId === n.id) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = G.ui.treeFlash;
      K.blit(ctx, K.glow('#ffffff'), p.x, p.y, 1.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const label = state === 'maxed' ? 'MAX' : String(rules.nodeCost(save, n.id));
    kit.text(label, p.x, p.y + R + 13, 13, state === 'maxed' ? UI.gold : state === 'expensive' ? UI.bad : state === 'locked' ? UI.textMute : '#bff8ff', { align: 'center', weight: 'bold' });
  }

  function detail(n, save) {
    const x = 300, y = 524, w = 930, h = 118;
    const col = branchColor(n.branch);
    const lvl = rules.nodeLevel(save, n.id);
    const max = n.costs.length;
    const state = rules.nodeState(save, n.id);
    kit.panel(x, y, w, h, { accent: col, glow: true });
    kit.icon(n.icon, x + 46, y + 46, 40, col);
    kit.text(n.name, x + 88, y + 30, 22, '#ffffff', { weight: 'bold' });
    kit.text(max > 1 ? 'Level ' + lvl + ' / ' + max : (lvl ? 'Owned' : 'Not owned'), x + 88, y + 56, 13, UI.textDim);
    kit.fitText('Now:  ' + (lvl ? rules.nodeText(n, lvl) : 'nothing yet'), x + 300, y + 30, 360, 14, { color: lvl ? UI.text : UI.textMute });
    if (lvl < max) kit.fitText('Next: ' + rules.nodeText(n, lvl + 1), x + 300, y + 56, 360, 14, { color: UI.good });
    if (state === 'locked') {
      const parts = n.req.map(r => TREE_BY_ID[r[0]].name + (TREE_BY_ID[r[0]].costs.length > 1 ? ' ' + r[1] : ''));
      kit.text('Requires ' + parts.join(' and '), x + 300, y + 86, 13, UI.bad);
    } else kit.text('Click a selected node or press B to buy', x + 300, y + 86, 12, UI.textMute);
    const bx = x + w - 250, by = y + 36;
    if (state !== 'maxed') kit.button('buy', state === 'locked' ? 'Locked' : 'Buy  ' + rules.nodeCost(save, n.id), bx, by, 230, 48, { icon: 'gem', disabled: state !== 'available', accent: UI.gold, action: () => buy(n.id) });
    else kit.text('Fully upgraded', bx + 115, by + 24, 17, UI.gold, { align: 'center', weight: 'bold' });
  }

  function onKey(e) {
    if (e.code === 'KeyB') { buy(G.ui.treeSel); return true; }
    return false;
  }

  Object.assign(NS.tree, {
    draw, buy, onKey, nodePos, applyLive
  });
})();
