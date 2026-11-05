/* The tech tree screen: five branches (Survival, Fortune, Demolition, Chrono, Explorer) of
   three tiers each, nodes joined to their prerequisites, level pips and costs, a detail card
   for the selected node with Buy, and the gold purse. Purchases apply at once, also when opened
   from the pause menu. Keyboard: arrows select, Enter buys, Esc returns. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const M = NS.meta;
  const P = NS.progression;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  const ICONS = { survival: 'shield', fortune: 'clover', demolition: 'bomb', chrono: 'slow', explorer: 'lantern' };

  /* node rectangles in plane coordinates */
  function layout() {
    const out = {};
    for (let b = 0; b < M.BRANCHES.length; ++b) {
      const br = M.BRANCHES[b];
      const nodes = M.TREE.filter((n) => n.branch === br.id);
      const colX = 70 + b * 232;
      for (let tier = 0; tier < 3; ++tier) {
        const row = nodes.filter((n) => n.tier === tier);
        for (let k = 0; k < row.length; ++k) {
          const w = 104, h = 92;
          const x = row.length === 1 ? colX + 52 : colX + k * 112;
          out[row[k].id] = { x, y: 150 + tier * 128, w, h, n: row[k] };
        }
      }
    }
    return out;
  }

  function buy(id) {
    const why = P.buyBlocker(G.save, id);
    if (why) {
      scr.toast(why === 'gold' ? 'Not enough gold' : why === 'locked' ? 'Unlock the node above first' : 'Already maxed', '#ff5d5d');
      SZ.GameAudio && SZ.GameAudio.play('hurt', { volume: 0.25 });
      return;
    }
    P.buyNode(G.save, id);
    NS.save.refreshPerks();
    if (G.run) {
      const cv = G.run.cave;
      cv.perks = G.perks;
      cv.escape = G.perks.escape || 0;
      cv.grace = G.perks.grit ? 18 : 10;
    }
    NS.save.writeSave();
    SZ.GameAudio && SZ.GameAudio.play('levelup', { volume: 0.4 });
    scr.toast(P.node(id).name + ' upgraded!', '#7dff8a');
  }

  function move(dx, dy) {
    const L = layout();
    const cur = L[G.ui.treeSel] || L.hardhat;
    let best = null, bd = 1e9;
    for (const id in L) {
      const n = L[id];
      const ddx = n.x - cur.x, ddy = n.y - cur.y;
      if (dx && Math.sign(ddx) !== dx) continue;
      if (dy && Math.sign(ddy) !== dy) continue;
      if (!dx && !dy) continue;
      const d = dx ? Math.abs(ddx) + Math.abs(ddy) * 3 : Math.abs(ddy) + Math.abs(ddx) * 3;
      if (d > 0 && d < bd) { bd = d; best = id; }
    }
    if (best) G.ui.treeSel = best;
  }

  function draw() {
    const v = visible();
    ctx.fillStyle = 'rgba(8,5,3,0.55)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Tech Tree', 70, 50, 34, UI.accent, { weight: 'bold' });
    kit.text('Upgrades last forever and apply in every mode at once.', 70, 84, 15, UI.dim);
    kit.goldLabel(v.x1 - 190, 50, G.save.gold, 24, 'right');
    kit.button('Back', v.x1 - 160, 26, 130, 46, () => scr.back(), { size: 18 });
    const L = layout();
    /* branch headers */
    for (let b = 0; b < M.BRANCHES.length; ++b) {
      const br = M.BRANCHES[b];
      ctx.drawImage(NS.creatureArt.icon(ICONS[br.id]), 70 + b * 232 + 20, 106, 28, 28);
      kit.text(br.name, 70 + b * 232 + 56, 120, 18, br.color, { weight: 'bold' });
    }
    /* links */
    ctx.lineWidth = 3;
    for (const id in L) {
      const n = L[id];
      const reqs = n.n.req || [];
      for (let k = 0; k < reqs.length; ++k) {
        const a = L[reqs[k]];
        if (!a) continue;
        ctx.strokeStyle = (G.save.tree[reqs[k]] | 0) ? 'rgba(255,213,74,0.7)' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(a.x + a.w / 2, a.y + a.h);
        ctx.lineTo(n.x + n.w / 2, n.y);
        ctx.stroke();
      }
    }
    for (const id in L) {
      const r = L[id], n = r.n;
      const lv = G.save.tree[id] | 0;
      const why = P.buyBlocker(G.save, id);
      const br = M.BRANCHES.find((b) => b.id === n.branch);
      const sel = G.ui.treeSel === id;
      G.hitAreas.push({ x: r.x, y: r.y, w: r.w, h: r.h, action: () => { if (G.ui.treeSel === id) buy(id); else G.ui.treeSel = id; }, nav: false });
      const hot = sel || kit.hover(r.x, r.y, r.w, r.h);
      kit.panel(r.x, r.y, r.w, r.h, { accent: br.color, glow: hot, radius: 10, rivets: false, alpha: why === 'locked' ? 0.55 : 1 });
      kit.fitText(n.name, r.x + r.w / 2, r.y + 20, r.w - 12, 14, { align: 'center', weight: 'bold', color: lv ? '#fff3c0' : UI.text });
      for (let k = 0; k < n.max; ++k) {
        const pw = Math.min(14, (r.w - 20) / n.max - 3);
        const px = r.x + r.w / 2 - (n.max * (pw + 3)) / 2 + k * (pw + 3);
        ctx.fillStyle = k < lv ? br.color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(px, r.y + 40, pw, 7);
      }
      if (why === 'maxed') kit.text('MAX', r.x + r.w / 2, r.y + 68, 15, UI.good, { align: 'center', weight: 'bold' });
      else if (why === 'locked') kit.text('locked', r.x + r.w / 2, r.y + 68, 13, UI.faint, { align: 'center' });
      else kit.goldLabel(r.x + r.w / 2, r.y + 68, P.nodeCost(n, lv), 15, 'center');
    }
    /* detail card */
    const sel = L[G.ui.treeSel] || L.hardhat;
    const n = sel.n, lv = G.save.tree[n.id] | 0;
    const why = P.buyBlocker(G.save, n.id);
    const y = 560;
    kit.panel(70, y, 1140, 120, { accent: M.BRANCHES.find((b) => b.id === n.branch).color });
    kit.text(n.name + '  (' + lv + ' / ' + n.max + ')', 96, y + 32, 24, UI.text, { weight: 'bold' });
    kit.text(n.desc, 96, y + 66, 17, UI.dim);
    if (n.req) kit.text('Needs: ' + n.req.map((r) => P.node(r).name).join(', '), 96, y + 94, 13, why === 'locked' ? UI.bad : UI.faint);
    const label = why === 'maxed' ? 'Maxed' : 'Buy for ' + P.nodeCost(n, lv);
    kit.button(label, 960, y + 30, 220, 60, () => buy(n.id), { accent: '#7dff8a', disabled: !!why, size: 20 });
  }

  Object.assign(NS.tree, { draw, buy, move, layout });
})();
