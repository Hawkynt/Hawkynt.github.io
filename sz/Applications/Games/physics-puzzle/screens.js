;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * The menu screens of the Physics Puzzle: the title with a live physics
   * contraption, the world map, the Trick Shot board, the Tech Tree, the
   * illustrated How to Play pages, the pause menu and the results with the
   * star reveal. The controller passes a context G with the canvas, the UI
   * kit, the art and fx modules, the save and its actions; every button is
   * registered as a hit area so mouse, touch and keyboard all work.
   *
   *   const screens = SZ.PhysicsPuzzleScreens.create(G);
   *   screens.drawTitle(dt); screens.key(e); screens.pointerDown(hit, p);
   */

  const DEG = Math.PI / 180;

  function create(G) {
    const ctx = G.ctx, ui = G.ui, Art = G.Art, Scene = G.Scene, Fx = G.Fx, Lv = G.Lv, Prog = G.Prog, Ph = G.Ph;
    const VIEW_W = G.VIEW_W, VIEW_H = G.VIEW_H;
    const WORLDS = Lv.WORLDS;

    /* ── shared bits ── */

    function backdrop(world, dim) {
      const v = G.visibleRect();
      Scene.drawBackdrop(ctx, world, v, G.viewScale);
      Scene.drawLights(ctx, world, v, G.time);
      G.fxMenu.update(G.frameDt);
      Fx.ambient(G.fxMenu, world, v, G.frameDt);
      G.fxMenu.draw(ctx, v);
      if (dim)
        G.veil(dim);
    }

    function coinChip(x, y) {
      ctx.font = ui.uiFont(18, 'bold');
      const text = G.save.coins.toLocaleString();
      const w = ui.drawChip('    ' + text, x, y, 34, { align: 'right', px: 17, color: '#ffe066' });
      drawCoin(x - w + 22, y + 17, 11);
    }

    function drawCoin(x, y, r) {
      const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      rg.addColorStop(0, '#fff6c0');
      rg.addColorStop(0.5, '#ffcf3a');
      rg.addColorStop(1, '#a86a10');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6a3a04';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#a86a10';
      ctx.font = 'bold ' + Math.round(r * 1.2) + 'px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¢', x, y + 1);
    }

    function starIcon(x, y, size, on) {
      const s = Art.starSprite();
      ctx.save();
      ctx.globalAlpha *= on ? 1 : 0.22;
      ctx.drawImage(s.c, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }

    function lockIcon(x, y, s) {
      ctx.save();
      ctx.fillStyle = '#c8ccd8';
      ctx.strokeStyle = '#c8ccd8';
      ctx.lineWidth = s * 0.18;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.25, s * 0.32, Math.PI, 0);
      ctx.stroke();
      ui.roundRectPath(x - s * 0.45, y - s * 0.25, s * 0.9, s * 0.7, s * 0.12);
      ctx.fill();
      ctx.fillStyle = '#3a3e4a';
      ctx.fillRect(x - s * 0.06, y, s * 0.12, s * 0.22);
      ctx.restore();
    }

    function keyHints(list, y) {
      ui.drawKeyHints(list, VIEW_W / 2, y, 900, 1);
    }

    /* ══════════════════════════════════════════════════════════════════
       TITLE: a live contraption of balls, pegs, bumpers and a belt
       ══════════════════════════════════════════════════════════════════ */

    let titleWorld = null, titleSpawn = 0, titleScene = 0, titleSceneT = 0;
    const titleBodies = [];

    function buildTitleWorld() {
      const w = Ph.createWorld({ gravity: [0, 900], bounds: { x0: 440, y0: -200, x1: 1400, y1: 800 } });
      titleBodies.length = 0;
      const add = (spec) => { const b = Ph.addBody(w, spec); titleBodies.push(b); return b; };
      add({ shape: 'box', x: 640, y: 640, w: 1600, h: 80, mat: 'wood', data: { kind: 'ground' } });
      for (let r = 0; r < 4; ++r)
        for (let c = 0; c <= r; ++c)
          add({ shape: 'circle', x: 900 + (c - r / 2) * 70, y: 220 + r * 56, r: 10, mat: 'metal', data: { kind: 'peg' } });
      add({ shape: 'box', x: 650, y: 330, w: 220, h: 16, a: 0.35, mat: 'wood', data: { kind: 'plank', part: true } });
      add({ shape: 'box', x: 1140, y: 360, w: 200, h: 16, a: -0.4, mat: 'wood', data: { kind: 'plank', part: true } });
      add({ shape: 'circle', x: 760, y: 480, r: 24, mat: 'rubber', boost: 700, boostDir: 'any', tag: 'bumper', data: { kind: 'bumper' } });
      add({ shape: 'circle', x: 1050, y: 470, r: 24, mat: 'rubber', boost: 700, boostDir: 'any', tag: 'bumper', data: { kind: 'bumper' } });
      add({ shape: 'box', x: 900, y: 592, w: 420, h: 18, mat: 'rubber', surface: 220, fric: 1.2, data: { kind: 'conveyor' } });
      add({ shape: 'box', x: 560, y: 560, w: 68, h: 20, a: 0.35, mat: 'rubber', boost: 950, tag: 'spring', data: { kind: 'spring' } });
      titleWorld = w;
    }

    function stepTitle(dt) {
      if (!titleWorld)
        buildTitleWorld();
      titleSpawn -= dt;
      if (titleSpawn <= 0) {
        titleSpawn = 0.55 + Math.random() * 0.5;
        const b = Ph.addBody(titleWorld, { shape: 'circle', r: 13, x: 760 + Math.random() * 300, y: -20, vx: (Math.random() - 0.5) * 120, type: 'dynamic', mat: 'ball', tag: 'ball', data: { kind: 'ball' } });
        b.born = G.time;
      }
      const steps = Math.min(16, Math.round(dt / Ph.STEP));
      for (let i = 0; i < steps; ++i) {
        Ph.step(titleWorld);
        for (const e of Ph.takeEvents(titleWorld)) {
          if (e.type === 'boost') {
            const gd = e.a.boost ? e.a : e.b;
            gd.data.hitAt = G.time;
            if (gd.tag === 'bumper')
              Fx.bumperPop(G.fxView, gd.x, gd.y, 24, '#ff7ad0');
            else
              Fx.springPop(G.fxView, e.x, e.y, Math.sin(gd.a), -Math.cos(gd.a));
          } else if (e.type === 'impact' && e.speed > 300) {
            Fx.impact(G.fxView, e.x, e.y, e.nx, e.ny, (e.a.tag === 'ball' ? e.b : e.a).mat, Math.min(1, e.speed / 900) * 0.6);
          }
        }
      }
      /* cap the number of balls */
      let n = 0;
      for (let i = titleWorld.bodies.length - 1; i >= 0; --i) {
        const b = titleWorld.bodies[i];
        if (b.alive && b.tag === 'ball' && ++n > 26)
          b.alive = false;
      }
    }

    function drawTitle(dt) {
      titleSceneT += dt;
      if (titleSceneT > 16) {
        titleSceneT = 0;
        titleScene = (titleScene + 1) % WORLDS.length;
      }
      backdrop(titleScene, 0.18);
      stepTitle(dt);
      const skin = G.currentSkin();
      for (const b of titleWorld.bodies)
        if (b.alive)
          Art.drawBody(ctx, b, titleScene, G.time, skin);
      /* headline */
      const bob = Math.sin(G.time * 1.4) * 4;
      ui.drawHeadline('PHYSICS PUZZLE', 400, 112 + bob, 700, 76, '#ffffff', '#ffb84a');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText('Build it.  Aim it.  Bank it in.', 400, 168, 560, 20, { weight: 'bold', color: '#ffe9c0', outline: 'rgba(0,0,0,0.7)' });
      /* menu */
      const x = 110, w = 380, h = 58, gap = 10;
      let y = 214;
      const stars = Prog.totalStars(G.save, Lv.LEVELS);
      const tricksDone = Lv.TRICKS.filter(t => G.save.tricks[t.id]).length;
      const daily = G.dailyLevel();
      const dailyDone = G.save.daily.date === G.localDate() && G.save.daily.cleared;
      const items = [
        ['campaign', 'Campaign', stars + ' / ' + Lv.LEVELS.length * 3 + ' stars in five worlds', () => G.actions.openMap(), '1'],
        ['tricks', 'Trick Shots', tricksDone + ' / ' + Lv.TRICKS.length + ' challenges', () => G.actions.openTricks(), '2'],
        ['daily', 'Daily Challenge', (dailyDone ? 'Cleared today  -  ' : 'Today: ') + daily.name.replace('Daily: ', ''), () => G.actions.startDaily(), '3'],
        ['sandbox', 'Sandbox', 'Free building with every part you own', () => G.actions.startSandbox(Math.max(0, highestWorld())), '4'],
        ['tree', 'Tech Tree', Prog.treeProgress(G.save).have + ' / ' + Prog.treeProgress(G.save).total + ' upgrades', () => G.actions.openTree('title'), 'T'],
        ['help', 'How to Play', 'Aiming, parts, gadgets and stars', () => G.actions.openHelp('title'), 'H']
      ];
      for (const it of items) {
        G.drawButton(it[0], it[1], x, y, w, h, { sub: it[2], action: it[3], key: it[4], accent: '#ffb84a', px: 21 });
        y += h + gap;
      }
      coinChip(VIEW_W - 24, 20);
      ctx.textAlign = 'right';
      ui.fitText('»SynthelicZ« Desktop', VIEW_W - 24, VIEW_H - 18, 300, 12, { color: 'rgba(255,255,255,0.55)' });
    }

    function highestWorld() {
      let w = 0;
      for (let i = 0; i < WORLDS.length; ++i)
        if (Prog.worldUnlocked(G.save, Lv.LEVELS, i))
          w = i;
      return w;
    }

    /* ══════════════════════════════════════════════════════════════════
       WORLD MAP
       ══════════════════════════════════════════════════════════════════ */

    let mapWorld = 0, mapLevel = 0;

    function openMap(world) {
      mapWorld = world !== undefined ? world : highestWorld();
      const levels = Lv.worldLevels(mapWorld);
      mapLevel = 0;
      for (let i = 0; i < levels.length; ++i)
        if (Prog.levelUnlocked(G.save, Lv.LEVELS, levels[i].id))
          mapLevel = i;
    }

    function mapNodes() {
      const out = [];
      for (let i = 0; i < 8; ++i) {
        const t = i / 7;
        out.push({ x: 150 + t * 980, y: 380 + Math.sin(t * Math.PI * 2.2 + 0.4) * 95 });
      }
      return out;
    }

    function playMapLevel() {
      const l = Lv.worldLevels(mapWorld)[mapLevel];
      if (!l || !Prog.levelUnlocked(G.save, Lv.LEVELS, l.id)) {
        G.sfx('error', { volume: 0.5 });
        if (l && !Prog.worldUnlocked(G.save, Lv.LEVELS, mapWorld))
          G.showToast('Earn ' + Prog.STAR_GATES[mapWorld] + ' stars and clear the previous world to open this one', '#ffe9a0');
        else
          G.showToast('Clear the level before it first', '#ffe9a0');
        return;
      }
      G.actions.startCampaign(l.id);
    }

    function changeWorld(d) {
      mapWorld = (mapWorld + d + WORLDS.length) % WORLDS.length;
      mapLevel = 0;
      G.sfx('click');
    }

    function drawMap() {
      const W = WORLDS[mapWorld];
      backdrop(mapWorld, 0.42);
      const unlockedWorld = Prog.worldUnlocked(G.save, Lv.LEVELS, mapWorld);
      /* world tabs */
      for (let i = 0; i < WORLDS.length; ++i) {
        const w = WORLDS[i], x = 40 + i * 244, y = 18, tw = 228, th = 62;
        const active = i === mapWorld;
        const open = Prog.worldUnlocked(G.save, Lv.LEVELS, i);
        G.registerHit('tab' + i, x, y, tw, th, ((k) => () => { mapWorld = k; mapLevel = 0; })(i));
        if (active)
          Art.drawGlow(ctx, x + tw / 2, y + th / 2, tw * 1.4, w.color, 0.45);
        ui.drawPanel(x, y, tw, th, { radius: 12, noStuds: true, glow: active, accent: w.color,
          top: ui.hexToRgba(ui.shade(w.color, -0.55), active ? 0.96 : 0.7), bottom: ui.hexToRgba(ui.shade(w.color, -0.88), active ? 0.96 : 0.7) });
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(w.name, x + 14, y + 22, tw - 28, 17, { weight: 'bold', color: open ? '#ffffff' : '#9aa0b0', font: ui.TITLE_FONT });
        const st = Prog.totalStars(G.save, Lv.worldLevels(i));
        if (open) {
          starIcon(x + 22, y + 44, 18, true);
          ui.fitText(st + ' / 24', x + 36, y + 45, 80, 13, { weight: 'bold', color: '#ffe066' });
        } else {
          lockIcon(x + 22, y + 44, 16);
          ui.fitText(Prog.STAR_GATES[i] + ' stars', x + 36, y + 45, 120, 12, { color: '#c8ccd8' });
        }
      }
      ctx.textAlign = 'center';
      ui.fitText(W.blurb + (W.gravity < 1000 ? '  -  low gravity' : ''), VIEW_W / 2, 104, 800, 15, { weight: 'bold', color: W.accent, outline: 'rgba(0,0,0,0.7)' });
      /* the path */
      const nodes = mapNodes();
      const levels = Lv.worldLevels(mapWorld);
      ctx.save();
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; ++pass) {
        ctx.strokeStyle = pass ? ui.hexToRgba(W.color, 0.85) : 'rgba(0,0,0,0.45)';
        ctx.lineWidth = pass ? 5 : 11;
        ctx.setLineDash(pass ? [2, 14] : []);
        ctx.lineDashOffset = -G.time * 24;
        ctx.beginPath();
        nodes.forEach((n, i) => i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y));
        ctx.stroke();
      }
      ctx.restore();
      levels.forEach((l, i) => {
        const n = nodes[i];
        const open = Prog.levelUnlocked(G.save, Lv.LEVELS, l.id);
        const rec = Prog.levelRecord(G.save, l.id);
        const sel = i === mapLevel;
        const r = sel ? 40 : 34;
        const idx = G.registerHit('node' + i, n.x - 40, n.y - 40, 80, 80, ((k) => () => {
          if (mapLevel === k) playMapLevel();
          else { mapLevel = k; G.sfx('click'); }
        })(i));
        if (G.isHot(idx, n.x - 40, n.y - 40, 80, 80) && G.pointerMoved)
          mapLevel = i;
        if (sel)
          Art.drawGlow(ctx, n.x, n.y, 190, W.color, 0.55 + 0.15 * Math.sin(G.time * 4));
        ui.drawPanel(n.x - r, n.y - r, r * 2, r * 2, { radius: r, noStuds: true, glow: sel, accent: open ? W.color : '#5a6070',
          top: open ? ui.hexToRgba(ui.shade(W.color, -0.35), 0.98) : 'rgba(40,44,56,0.95)', bottom: open ? ui.hexToRgba(ui.shade(W.color, -0.8), 0.98) : 'rgba(14,16,22,0.95)' });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (open)
          ui.fitText(String(i + 1), n.x, n.y + 1, r * 1.4, sel ? 30 : 26, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
        else
          lockIcon(n.x, n.y, 26);
        for (let s = 0; s < 3; ++s)
          starIcon(n.x - 24 + s * 24, n.y + r + 14 - (s === 1 ? 4 : 0), 22, rec.stars[s]);
      });
      /* info panel */
      const l = levels[mapLevel];
      const open = Prog.levelUnlocked(G.save, Lv.LEVELS, l.id);
      const rec = Prog.levelRecord(G.save, l.id);
      const py = 560, ph = 140;
      ui.drawPanel(40, py, 860, ph, { accent: W.color, title: (mapLevel + 1) + '. ' + l.name, titlePx: 20, headerH: 36,
        titleRight: open ? (rec.best ? 'best ' + rec.best + ' shots' : 'not solved yet') : 'locked' });
      ui.drawTextBlock(open ? l.tip : (unlockedWorld ? 'Solve the level before this one to open it.' : 'Earn ' + Prog.STAR_GATES[mapWorld] + ' stars and clear the last level of ' + WORLDS[Math.max(0, mapWorld - 1)].name + '.'),
        60, py + 46, 560, 52, 15, { color: '#d8e4f0' });
      ctx.textAlign = 'left';
      const lbl = ['Solve it', 'Par ' + l.par + ' shots', l.stars.length ? 'Grab all ' + l.stars.length + ' stars' : 'Solve it'];
      for (let s = 0; s < 3; ++s) {
        starIcon(70 + s * 180, py + 116, 22, rec.stars[s]);
        ui.fitText(lbl[s], 86 + s * 180, py + 117, 150, 13, { color: rec.stars[s] ? '#ffe066' : ui.UI.textDim, weight: 'bold' });
      }
      const inv = Object.keys(l.inv).filter(k => l.inv[k] > 0);
      let ix = 660;
      for (const k of inv) {
        const icon = Art.partIcon(k, mapWorld);
        const s = Math.min(54 / icon.w, 30 / icon.h);
        ctx.drawImage(icon.c, ix, py + 60 - icon.h * s / 2, icon.w * s, icon.h * s);
        ui.fitText('x' + l.inv[k], ix + icon.w * s + 2, py + 62, 30, 13, { weight: 'bold', color: '#ffe066' });
        ix += icon.w * s + 34;
        if (ix > 860) break;
      }
      G.drawButton('play', open ? 'Play' : 'Locked', 920, py, 320, 64, { action: playMapLevel, disabled: !open, accent: W.color, key: 'Enter', px: 26 });
      G.drawButton('tree', 'Tech Tree', 920, py + 74, 154, 50, { action: () => G.actions.openTree('map'), key: 'T', px: 16 });
      G.drawButton('back', 'Back', 1086, py + 74, 154, 50, { action: () => G.actions.title(), key: 'Esc', px: 16 });
      coinChip(VIEW_W - 24, 112);
      keyHints([{ key: 'Left/Right', label: 'Level' }, { key: 'Q/E', label: 'World' }, { key: 'Enter', label: 'Play' }], 136);
    }

    /* ══════════════════════════════════════════════════════════════════
       TRICK SHOTS
       ══════════════════════════════════════════════════════════════════ */

    let trickSel = 0;

    function drawTricks() {
      backdrop(3, 0.5);
      ui.drawHeadline('Trick Shots', VIEW_W / 2, 64, 600, 56, '#ffffff', '#ff7a3a');
      ctx.textAlign = 'center';
      ui.fitText('Campaign levels with a twist. Clear the original level to unlock its trick.', VIEW_W / 2, 112, 800, 15, { color: '#ffe0c8', weight: 'bold' });
      const cw = 226, ch = 200, gx = 20, gy = 22;
      const x0 = VIEW_W / 2 - (5 * cw + 4 * gx) / 2, y0 = 150;
      Lv.TRICKS.forEach((t, i) => {
        const x = x0 + (i % 5) * (cw + gx), y = y0 + Math.floor(i / 5) * (ch + gy);
        const base = Lv.BY_ID[t.base];
        const open = Prog.trickUnlocked(G.save, t);
        const done = !!G.save.tricks[t.id];
        const W = WORLDS[base.world];
        const idx = G.registerHit('trick' + i, x, y, cw, ch, ((tt, ok) => () => {
          if (!ok) { G.sfx('error'); G.showToast('Clear ' + base.name + ' first', '#ffe9a0'); return; }
          G.actions.startTrick(tt);
        })(t, open));
        const hot = G.isHot(idx, x, y, cw, ch);
        if (hot)
          trickSel = i;
        const hv = G.hoverLevel('trick' + i, hot);
        ctx.save();
        if (!open)
          ctx.globalAlpha = 0.55;
        if (hv)
          Art.drawGlow(ctx, x + cw / 2, y + ch / 2, cw * 1.5, W.color, 0.4 * hv);
        ui.drawPanel(x, y - hv * 4, cw, ch, { accent: done ? ui.UI.good : W.color, glow: hot });
        const yy = y - hv * 4;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText('#' + (i + 1), x + cw / 2, yy + 26, cw - 30, 13, { weight: 'bold', color: W.accent });
        ui.fitText(t.name, x + cw / 2, yy + 52, cw - 24, 21, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
        ui.drawTextBlock(t.desc, x + 16, yy + 72, cw - 32, 54, 14, { align: 'center', color: '#d8e4f0' });
        ui.fitText('on ' + base.name, x + cw / 2, yy + 140, cw - 24, 12, { color: ui.UI.textDim });
        if (done)
          ui.drawChip('CLEARED', x + cw / 2, yy + ch - 38, 26, { align: 'center', px: 13, color: ui.UI.good });
        else if (!open) {
          lockIcon(x + cw / 2, yy + ch - 26, 22);
        } else
          ui.drawChip('60 coins', x + cw / 2, yy + ch - 38, 26, { align: 'center', px: 13, color: '#ffe066' });
        ctx.restore();
      });
      G.drawButton('back', 'Back', VIEW_W / 2 - 110, 640, 220, 54, { action: () => G.actions.title(), key: 'Esc' });
      coinChip(VIEW_W - 24, 20);
    }

    /* ══════════════════════════════════════════════════════════════════
       TECH TREE
       ══════════════════════════════════════════════════════════════════ */

    let treeBranch = 0, treeSelected = null, treeFlash = null, treeFromPause = false;

    function openTree() {
      if (!treeSelected)
        treeSelected = Prog.TREE[0].id;
    }

    function treeDepth(node) {
      let d = 0;
      for (const r of node.req)
        d = Math.max(d, 1 + treeDepth(Prog.TREE_BY_ID[r[0]]));
      return d;
    }

    function treeLayout() {
      const branch = Prog.BRANCH_ORDER[treeBranch];
      const nodes = Prog.TREE.filter(n => n.branch === branch);
      const cols = [];
      for (const n of nodes) {
        const d = treeDepth(n);
        (cols[d] = cols[d] || []).push(n);
      }
      const GX = cols.length >= 4 ? 40 : 64, GY = 18, CH = 112;
      const CW = Math.min(300, Math.floor((1200 - (cols.length - 1) * GX) / cols.length));
      const totalW = cols.length * CW + (cols.length - 1) * GX;
      const x0 = VIEW_W / 2 - totalW / 2;
      const cards = [];
      cols.forEach((list, ci) => {
        const totalH = list.length * CH + (list.length - 1) * GY;
        const y0 = 196 + (400 - totalH) / 2;
        list.forEach((n, ri) => cards.push({ node: n, x: x0 + ci * (CW + GX), y: y0 + ri * (CH + GY), w: CW, h: CH, col: ci, row: ri }));
      });
      return cards;
    }

    function equip(n) {
      if (n.skin) {
        G.save.skin = n.skin;
        G.showToast(n.name + ' equipped', '#e8c8ff');
      } else if (n.trail) {
        G.save.trail = G.save.trail === n.trail ? 'none' : n.trail;
        G.showToast(G.save.trail === 'none' ? 'Trail off' : n.name + ' equipped', '#e8c8ff');
      }
      G.writeSave();
      G.sfx('select');
    }

    function buyTreeNode(id) {
      const n = Prog.TREE_BY_ID[id];
      const st = Prog.nodeState(G.save, id);
      if (st === 'maxed' && (n.skin || n.trail)) {
        equip(n);
        return;
      }
      if (st !== 'available') {
        G.sfx('error', { volume: 0.5 });
        if (st === 'expensive')
          G.showToast('Not enough coins yet - solve levels, tricks and dailies', '#ffb0a0');
        else if (st === 'locked')
          G.showToast('Unlock the node before it first', '#ffb0a0');
        return;
      }
      Prog.buy(G.save, id);
      G.writeSave();
      G.refreshStats();
      treeFlash = { id: id, at: G.time };
      G.sfx('levelup');
      G.showToast(n.name + (n.costs.length > 1 ? ' ' + Prog.level(G.save, id) : '') + ' unlocked!', Prog.BRANCHES[n.branch].color);
      const card = treeLayout().find(c => c.node.id === id);
      if (card) {
        Fx.starBurst(G.fxView, card.x + card.w / 2, card.y + card.h / 2);
        Fx.confetti(G.fxView, card.x + card.w / 2, card.y + 20, 24);
      }
      if (n.skin || n.trail)
        equip(n);
    }

    function moveTree(dc, dr) {
      const cards = treeLayout();
      const cur = cards.find(c => c.node.id === treeSelected) || cards[0];
      let best = null, bd = Infinity;
      for (const c of cards) {
        if (c === cur)
          continue;
        const dx = c.col - cur.col, dy = (c.y - cur.y) / 130;
        if (dc && Math.sign(dx) !== dc) continue;
        if (dr && (dx !== 0 || Math.sign(dy) !== dr)) continue;
        const d = Math.abs(dx) * 3 + Math.abs(dy);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        treeSelected = best.node.id;
        G.sfx('click', { volume: 0.4 });
      } else if (dc) {
        treeBranch = (treeBranch + dc + 5) % 5;
        treeSelected = treeLayout()[0].node.id;
        G.sfx('click', { volume: 0.4 });
      }
    }

    function costText(c) {
      return c.toLocaleString() + ' coins';
    }

    function nodeGlyph(n, color, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      const id = n.id;
      if (n.skin) {
        const skin = Prog.SKINS.find(k => k.id === n.skin);
        Art.drawBall(ctx, 0, 0, G.time * 2, skin, s * 0.42, G.time);
      } else if (n.trail) {
        for (let k = 0; k < 4; ++k) {
          ctx.globalAlpha = 0.25 + k * 0.25;
          ctx.beginPath();
          ctx.arc(-s * 0.4 + k * s * 0.22, s * 0.1 - k * s * 0.08, s * (0.06 + k * 0.04), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === 'power' || id === 'multi') {
        ctx.rotate(-0.6);
        ctx.fillRect(-s * 0.4, -s * 0.12, s * 0.75, s * 0.24);
        ctx.beginPath();
        ctx.arc(s * 0.5, 0, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        if (id === 'multi') {
          ctx.beginPath();
          ctx.arc(s * 0.62, -s * 0.3, s * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === 'sight' || id === 'ricochet') {
        for (let k = 0; k < 5; ++k) {
          const t = k / 4;
          ctx.beginPath();
          ctx.arc(-s * 0.45 + t * s * 0.9, s * 0.3 - Math.sin(t * Math.PI) * s * 0.6 + (id === 'ricochet' && t > 0.6 ? (t - 0.6) * s : 0), s * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (id === 'bullet') {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -s * 0.28);
        ctx.moveTo(0, 0);
        ctx.lineTo(s * 0.2, s * 0.1);
        ctx.stroke();
      } else if (id === 'purse' || id === 'bounty' || id === 'dailyBonus' || id === 'trickBonus') {
        ctx.restore();
        drawCoin(x, y, s * 0.36);
        return;
      } else {
        /* a gear */
        ctx.beginPath();
        for (let k = 0; k < 16; ++k) {
          const a = k / 16 * Math.PI * 2, r = k % 2 ? s * 0.3 : s * 0.42;
          if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawTree() {
      const branch = Prog.BRANCHES[Prog.BRANCH_ORDER[treeBranch]];
      const run = G.run;
      if (run && treeFromPause) {
        G.drawField(0);
        G.veil(0.8);
      } else {
        backdrop(Math.floor(G.time / 14) % 5, 0.72);
      }
      const v = G.visibleRect();
      ui.drawPanel(24, 16, 1232, 74, { accent: branch.color });
      ui.drawHeadline('Tech Tree', 180, 54, 300, 46, '#ffffff', branch.color);
      const tp = Prog.treeProgress(G.save);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(tp.have + ' / ' + tp.total + ' upgrades  -  effects apply at once', 360, 54, 420, 14, { weight: 'bold', color: ui.UI.textDim });
      coinChip(1236, 36);
      for (let i = 0; i < 5; ++i) {
        const b = Prog.BRANCHES[Prog.BRANCH_ORDER[i]];
        const x = 90 + i * 224, y = 102, w = 204, h = 46;
        const active = i === treeBranch;
        const nodes = Prog.TREE.filter(n => n.branch === b.id);
        const have = nodes.reduce((a, n) => a + Prog.level(G.save, n.id), 0), total = nodes.reduce((a, n) => a + n.costs.length, 0);
        G.registerHit('tab' + i, x, y, w, h, ((k) => () => { treeBranch = k; treeSelected = treeLayout()[0].node.id; })(i));
        if (active)
          Art.drawGlow(ctx, x + w / 2, y + h / 2, w * 1.5, b.color, 0.4);
        ui.drawPanel(x, y, w, h, { radius: 12, noStuds: true, glow: active, accent: b.color,
          top: ui.hexToRgba(ui.shade(b.color, -0.5), active ? 0.96 : 0.6), bottom: ui.hexToRgba(ui.shade(b.color, -0.85), active ? 0.96 : 0.6) });
        nodeGlyph({ id: b.id === 'launcher' ? 'power' : b.id === 'fortune' ? 'purse' : b.id === 'physics' ? 'bullet' : b.id === 'style' ? 'skinX' : 'gear', skin: b.id === 'style' ? 'gold' : null },
          b.color, x + 26, y + h / 2, 30);
        ctx.textAlign = 'left';
        ui.fitText(b.name, x + 48, y + h / 2 - 6, 110, 16, { weight: 'bold', color: active ? '#ffffff' : '#c8d2ea' });
        ui.fitText(have + ' / ' + total, x + 48, y + h / 2 + 12, 110, 11, { color: ui.UI.textDim });
      }
      const cards = treeLayout();
      if (!cards.some(c => c.node.id === treeSelected))
        treeSelected = cards[0].node.id;
      for (const card of cards)
        if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h && G.pointerMoved)
          treeSelected = card.node.id;
      const byId = {};
      for (const c of cards)
        byId[c.node.id] = c;
      for (const c of cards) {
        for (const [rid, rl] of c.node.req) {
          const from = byId[rid];
          if (!from)
            continue;
          const met = Prog.level(G.save, rid) >= rl;
          const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = c.x, y2 = c.y + c.h / 2, mx = (x1 + x2) / 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
          ctx.lineWidth = 8;
          ctx.strokeStyle = met ? ui.hexToRgba(branch.color, 0.25) : 'rgba(0,0,0,0.4)';
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.strokeStyle = met ? branch.color : '#3a4058';
          ctx.stroke();
          if (met) {
            const k = (G.time * 0.6) % 1;
            const bx = (1 - k) * (1 - k) * (1 - k) * x1 + 3 * (1 - k) * (1 - k) * k * mx + 3 * (1 - k) * k * k * mx + k * k * k * x2;
            const by = (1 - k) * (1 - k) * (1 - k) * y1 + 3 * (1 - k) * (1 - k) * k * y1 + 3 * (1 - k) * k * k * y2 + k * k * k * y2;
            Art.drawGlow(ctx, bx, by, 26, branch.color, 0.9);
          }
        }
      }
      for (const card of cards)
        drawTreeCard(card, branch);
      const sel = byId[treeSelected];
      if (sel) {
        const n = sel.node, lv = Prog.level(G.save, n.id), st = Prog.nodeState(G.save, n.id);
        const y = Math.min(v.y1, VIEW_H) - 104;
        ui.drawPanel(90, y, 1100, 84, { accent: branch.color, radius: 14 });
        nodeGlyph(n, branch.color, 132, y + 42, 46);
        ctx.textAlign = 'left';
        ui.fitText(n.name + (n.costs.length > 1 ? '  ' + lv + ' / ' + n.costs.length : ''), 170, y + 26, 560, 20, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
        ui.fitText(n.desc[Math.min(lv, n.costs.length - 1)], 170, y + 56, 640, 15, { color: '#d0daf0' });
        const styled = (n.skin && G.save.skin === n.skin) || (n.trail && G.save.trail === n.trail);
        const label = st === 'maxed' ? (n.skin || n.trail ? (styled ? (n.trail ? 'Take off' : 'Equipped') : 'Equip') : 'Owned') : 'Buy  ' + costText(n.costs[lv]);
        const canAct = st === 'available' || (st === 'maxed' && (n.skin || n.trail) && !(n.skin && styled));
        G.drawButton('buy', label, 900, y + 14, 270, 56, { action: () => buyTreeNode(n.id), disabled: !canAct, accent: branch.color, key: 'Enter' });
      }
      keyHints([{ key: 'Arrows', label: 'Select' }, { key: 'Tab', label: 'Branch' }, { key: 'Enter', label: 'Buy' }, { key: 'Esc', label: 'Back' }], 168);
    }


    function drawTreeCard(card, branch) {
      const n = card.node, lv = Prog.level(G.save, n.id), st = Prog.nodeState(G.save, n.id);
      const sel = n.id === treeSelected;
      ctx.save();
      if (st === 'locked')
        ctx.globalAlpha = 0.5;
      if (sel)
        Art.drawGlow(ctx, card.x + card.w / 2, card.y + card.h / 2, card.w * 1.4, branch.color, 0.45 + 0.1 * Math.sin(G.time * 3));
      ui.drawPanel(card.x, card.y, card.w, card.h, { accent: st === 'maxed' ? ui.UI.good : branch.color, glow: sel });
      if (st === 'available') {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.lineWidth = 2;
        ctx.strokeStyle = ui.hexToRgba(branch.color, 0.45 + 0.35 * Math.sin(G.time * 4));
        ctx.stroke();
      }
      ui.drawPanel(card.x + 12, card.y + 14, 52, 52, { radius: 26, noStuds: true, accent: branch.color, top: ui.hexToRgba(ui.shade(branch.color, -0.4), 0.95), bottom: ui.hexToRgba(ui.shade(branch.color, -0.85), 0.95) });
      nodeGlyph(n, '#ffffff', card.x + 38, card.y + 40, 32);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(n.name, card.x + 76, card.y + 26, card.w - 140, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.drawChip(lv + ' / ' + n.costs.length, card.x + card.w - 12, card.y + 14, 22, { align: 'right', px: 12, color: st === 'maxed' ? ui.UI.good : ui.UI.textDim });
      ui.drawTextBlock(n.desc[Math.min(lv, n.costs.length - 1)], card.x + 76, card.y + 40, card.w - 90, 40, 13, { color: ui.UI.textDim });
      for (let l = 0; l < n.costs.length; ++l) {
        ui.roundRectPath(card.x + 76 + l * 22, card.y + card.h - 22, 18, 8, 3);
        ctx.fillStyle = l < lv ? branch.color : 'rgba(255,255,255,0.08)';
        ctx.fill();
      }
      ctx.textAlign = 'right';
      const styled = (n.skin && G.save.skin === n.skin) || (n.trail && G.save.trail === n.trail);
      if (st === 'maxed') {
        ui.fitText(styled ? 'EQUIPPED' : n.skin || n.trail ? 'OWNED' : 'MAX', card.x + card.w - 14, card.y + card.h - 18, 90, 13, { weight: 'bold', color: ui.UI.good });
      } else if (st === 'locked') {
        const miss = n.req.filter(r => Prog.level(G.save, r[0]) < r[1]).map(r => Prog.TREE_BY_ID[r[0]].name);
        ui.fitText('needs ' + miss.join(', '), card.x + card.w - 14, card.y + card.h - 18, 170, 12, { color: ui.UI.warn });
      } else {
        ui.fitText(costText(n.costs[lv]), card.x + card.w - 14, card.y + card.h - 18, 170, 13, { weight: 'bold', color: st === 'expensive' ? ui.UI.bad : ui.UI.gold });
      }
      if (treeFlash && treeFlash.id === n.id && G.time - treeFlash.at < 0.35) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - (G.time - treeFlash.at) / 0.35)).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.restore();
      const idx = G.registerHit('card' + n.id, card.x, card.y, card.w, card.h, () => {
        if (treeSelected === n.id) buyTreeNode(n.id);
        else treeSelected = n.id;
      });
      G.hitAreas[idx].card = true;
    }

    /* ══════════════════════════════════════════════════════════════════
       HOW TO PLAY
       ══════════════════════════════════════════════════════════════════ */

    const HELP_PAGES = ['Aim & Fire', 'Parts', 'Gadgets', 'Stars', 'Modes'];
    let helpPage = 0;

    function openHelp() {
      helpPage = 0;
    }

    function helpRow(x, y, w, draw, title, text) {
      ui.drawPanel(x, y, w, 84, { radius: 12, noStuds: true, accent: '#4ad0e0' });
      ctx.save();
      draw(x + 56, y + 42);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(title, x + 112, y + 22, w - 130, 17, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.drawTextBlock(text, x + 112, y + 36, w - 130, 44, 13, { color: '#d0dcea' });
    }

    function partDraw(type) {
      return (cx, cy) => {
        const icon = Art.partIcon(type, 0);
        const s = Math.min(80 / icon.w, 60 / icon.h, 1);
        ctx.drawImage(icon.c, cx - icon.w * s / 2, cy - icon.h * s / 2, icon.w * s, icon.h * s);
      };
    }

    function bodyDraw(spec, world) {
      return (cx, cy) => {
        const w = Ph.createWorld({ gravity: [0, 0] });
        const b = Ph.addBody(w, Object.assign({ x: cx, y: cy }, spec));
        if (b.data && b.data.kind === 'pendulum') {
          b.data = { kind: 'pendulum', ax: cx - 18, ay: cy - 36 };
          b.x = cx + 8;
          b.y = cy + 8;
        }
        if (b.data && b.data.kind === 'lava') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx - 40, cy - 30, 80, 60);
          ctx.clip();
          Art.drawBody(ctx, b, world || 0, G.time);
          ctx.restore();
          return;
        }
        Art.drawBody(ctx, b, world || 0, G.time, G.currentSkin());
      };
    }

    function drawHelp() {
      backdrop(0, 0.72);
      ui.drawPanel(60, 20, 1160, 680, { accent: '#ffb84a', title: 'How to Play  -  ' + HELP_PAGES[helpPage], titlePx: 22, headerH: 44 });
      /* page tabs */
      HELP_PAGES.forEach((p, i) => {
        const x = 90 + i * 220, y = 74, w = 200, h = 38;
        G.registerHit('hp' + i, x, y, w, h, ((k) => () => { helpPage = k; })(i));
        ui.drawPanel(x, y, w, h, { radius: 10, noStuds: true, glow: i === helpPage, accent: '#ffb84a',
          top: i === helpPage ? 'rgba(90,60,20,0.95)' : 'rgba(30,30,40,0.8)', bottom: 'rgba(10,10,14,0.9)' });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(p, x + w / 2, y + h / 2 + 1, w - 20, 15, { weight: 'bold', color: i === helpPage ? '#ffffff' : '#a8b0c0' });
      });
      const x0 = 90, x1 = 650, w = 540;
      let y = 130;
      const rows = [];
      if (helpPage === 0) {
        /* an illustration of the slingshot drag */
        const ix = 90, iy = 130, iw = 1100, ih = 250;
        ui.drawPanel(ix, iy, iw, ih, { radius: 12, noStuds: true, accent: '#4ad0e0', top: 'rgba(10,22,32,0.95)', bottom: 'rgba(4,10,16,0.95)' });
        const lx = ix + 140, ly = iy + 200;
        const k = (G.time * 0.5) % 1;
        const pull = Math.min(1, k * 2);
        const ang = 38;
        for (let i = 0; i < 16; ++i) {
          const t = i * 0.045;
          const sp = 900 * (0.4 + pull * 0.6);
          const px = lx + Math.cos(ang * DEG) * sp * t, py = ly - Math.sin(ang * DEG) * sp * t + 0.5 * 1200 * t * t;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.9 - i * 0.05) + ')';
          ctx.beginPath();
          ctx.arc(px, py, 4.5 - i * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        Art.drawLauncher(ctx, lx, ly, ang, pull, G.time, 0, 0);
        Art.drawTarget(ctx, ix + 900, iy + 160, false, G.time, '#ffb35a');
        Art.drawStar(ctx, ix + 560, iy + 70, G.time, 0);
        const hx = lx + 260 - pull * 140 * Math.cos(ang * DEG), hy = ly - 60 + pull * 140 * Math.sin(ang * DEG) * 0.5;
        ctx.strokeStyle = 'rgba(255,224,102,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(lx + 260, ly - 60);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(hx, hy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ui.fitText('Press anywhere on the field and pull back like a slingshot.', ix + 400, iy + 200, 650, 17, { weight: 'bold', color: '#ffffff' });
        ui.fitText('Direction sets the angle, distance sets the power. Let go to fire.', ix + 400, iy + 226, 650, 14, { color: '#c8d8e8' });
        y = 400;
        rows.push([x0, y, (cx, cy) => Art.drawTarget(ctx, cx, cy, true, G.time, '#ffb35a'), 'Light every target', 'Touch a target with the ball to light it. Light them all to solve the level. Lit targets stay lit.']);
        rows.push([x1, y, (cx, cy) => { Art.drawLauncher(ctx, cx - 10, cy + 10, 30, 0.5, G.time, 0, 0); }, 'Keyboard aiming', 'Arrows turn the barrel and set the power, Space or Enter fires. Shift + arrows nudge finely with Steady Hand.']);
        rows.push([x0, y + 96, (cx, cy) => { ctx.fillStyle = '#fff'; for (let i = 0; i < 6; ++i) { ctx.beginPath(); ctx.arc(cx - 30 + i * 12, cy + 10 - Math.sin(i / 5 * Math.PI) * 24, 3.5, 0, 7); ctx.fill(); } }, 'The aiming guide', 'White dots preview the flight. Long Sight stretches it, Ricochet Sight bends it off walls.']);
        rows.push([x1, y + 96, (cx, cy) => { ctx.strokeStyle = '#7ae8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 20, 0.6, 5.6); ctx.stroke(); }, 'The world remembers', 'Crates you knock over stay down and broken glass stays broken. Reset (R) puts everything back.']);
      } else if (helpPage === 1) {
        rows.push([x0, y, partDraw('plank'), 'Plank', 'A tilting board: ramps, walls and backboards. Tap a placed part to select it, tap again or use the arrows to turn it.']);
        rows.push([x1, y, partDraw('block'), 'Steel Block', 'A solid cube that never moves. Good for blocking and banking.']);
        rows.push([x0, y + 96, partDraw('spring'), 'Spring Pad', 'Launches the ball off its green face at high speed. Turn it to aim the bounce.']);
        rows.push([x1, y + 96, partDraw('bumper'), 'Bumper', 'Kicks the ball away from its centre, whatever the angle.']);
        rows.push([x0, y + 192, partDraw('fan'), 'Fan', 'Blows wind along its nose for about six ball widths.']);
        rows.push([x1, y + 192, partDraw('conveyor'), 'Conveyor', 'Carries whatever rests on it along the arrows. Turn it round to reverse it.']);
        rows.push([x0, y + 288, partDraw('magnet'), 'Magnet', 'Pulls the steel ball toward itself when it flies close.']);
        rows.push([x1, y + 288, (cx, cy) => { ui.drawPanel(cx - 22, cy - 22, 44, 44, { radius: 22, noStuds: true, accent: '#ff6a6a' }); }, 'Building', 'Drag parts from the tray onto the field; they snap to a grid and turn in 15° steps. Drag one back onto the tray, or press its X, to take it away.']);
        rows.push([x0, y + 384, (cx, cy) => { Art.drawBody(ctx, { x: cx, y: cy, a: 0.3, poly: { count: 4, verts: [-24, -24, 24, -24, 24, 24, -24, 24] }, data: { kind: 'crate' }, mat: 'wood', type: 'dynamic' }, 0, G.time); }, 'Sandbox extras', 'Crates, glass and TNT join the Sandbox tray with the Demolition Kit.']);
        rows.push([x1, y + 384, (cx, cy) => { ui.drawKeycap('1-9', cx - 18, cy - 10, 12); }, 'Keys', '1-9 drop a part mid-field, Tab picks the next part, Q / E turn it, Delete removes it.']);
      } else if (helpPage === 2) {
        rows.push([x0, y, bodyDraw({ shape: 'box', w: 80, h: 12, mat: 'glass', data: { kind: 'glass', w: 80 } }), 'Glass', 'Shatters under a hard hit; a gentle touch only bounces off.']);
        rows.push([x1, y, bodyDraw({ shape: 'box', w: 44, h: 44, mat: 'tnt', tnt: {}, data: { kind: 'tnt' } }), 'TNT', 'Explodes when hit hard, sets off other TNT and flings everything near it.']);
        rows.push([x0, y + 96, (cx, cy) => Art.drawZone(ctx, { kind: 'portal', ax: cx - 20, ay: cy, aa: 0, bx: cx + 30, by: cy, ba: 0 }, 0, G.time), 'Portals', 'Whatever enters one mouth leaves the other along its arrow, at the same speed.']);
        rows.push([x1, y + 96, bodyDraw({ shape: 'box', w: 70, h: 16, type: 'kinematic', data: { kind: 'paddle', w: 70 } }, 3), 'Gears and hammers', 'Machines only move while a shot is in flight, so their timing never changes between tries.']);
        rows.push([x0, y + 192, (cx, cy) => Art.drawZone(ctx, { kind: 'water', x0: cx - 40, y0: cy - 14, x1: cx + 40, y1: cy + 30 }, 1, G.time), 'Water', 'Slows the ball down and floats it back to the surface.']);
        rows.push([x1, y + 192, bodyDraw({ shape: 'box', w: 80, h: 40, sensor: true, data: { kind: 'lava' } }, 3), 'Lava', 'Melts the ball on contact - that shot is over.']);
        rows.push([x0, y + 288, bodyDraw({ shape: 'box', w: 80, h: 16, mat: 'ice', data: { kind: 'ice' } }, 2), 'Ice', 'Almost no grip: the ball keeps its speed and slides.']);
        rows.push([x1, y + 288, bodyDraw({ shape: 'circle', r: 18, type: 'dynamic', mat: 'metal', data: { kind: 'pendulum', ax: 0, ay: 0 } }), 'Pendulums and crates', 'Loose bodies tumble, stack and swing. Knock them out of the way, or use them.']);
        rows.push([x0, y + 384, (cx, cy) => { ctx.strokeStyle = 'rgba(200,160,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(cx, cy, 34, 14, -0.3, 0, 7); ctx.stroke(); ctx.setLineDash([]); Art.drawBall(ctx, cx + Math.cos(G.time * 2) * 34, cy + Math.sin(G.time * 2) * 12, G.time, Prog.SKINS[4], 10, G.time); }, 'Low gravity', 'On Orbit Station everything floats longer. Gentle shots fly far.']);
        rows.push([x1, y + 384, bodyDraw({ shape: 'circle', r: 20, mat: 'metal', data: { kind: 'magnet' } }), 'Fixed magnets and fans', 'Some levels come with their own magnets, fans, belts, bumpers and springs.']);
      } else if (helpPage === 3) {
        rows.push([x0, y, (cx, cy) => { for (let s = 0; s < 3; ++s) starIcon(cx - 26 + s * 26, cy, 24, s === 0); }, 'Star 1: solve it', 'Light every target, in any number of shots.']);
        rows.push([x1, y, (cx, cy) => { for (let s = 0; s < 3; ++s) starIcon(cx - 26 + s * 26, cy, 24, s < 2); }, 'Star 2: within par', 'Solve it in no more shots than the level\'s par.']);
        rows.push([x0, y + 96, (cx, cy) => Art.drawStar(ctx, cx, cy, G.time, 0), 'Star 3: grab all stars', 'Pick up every gold star floating in the level. Stars you took in earlier shots of a try count.']);
        rows.push([x1, y + 96, (cx, cy) => drawCoin(cx, cy, 22), 'Coins', 'Solving pays coins, new stars pay a bonus, replays pay a little. Spend them in the Tech Tree.']);
        rows.push([x0, y + 192, (cx, cy) => { Art.drawGlow(ctx, cx, cy, 80, '#8affd0', 0.8); }, 'Slow motion', 'Close calls slow time for a moment. Bullet Time lets you hold Space for it.']);
        rows.push([x1, y + 192, (cx, cy) => { ui.drawKeycap('B', cx - 10, cy - 10, 14); }, 'Blueprint', 'Stuck? With the Blueprint upgrade, B shows where the parts of a known solution go.']);
        rows.push([x0, y + 288, (cx, cy) => lockIcon(cx, cy, 30), 'Opening worlds', 'Each world opens with enough stars and the previous world\'s last level solved.']);
        rows.push([x1, y + 288, (cx, cy) => { ui.drawKeycap('R', cx - 10, cy - 10, 14); }, 'Reset', 'R puts the world back as it was and starts the shot count again. Your parts stay put.']);
      } else {
        rows.push([x0, y, (cx, cy) => { for (let i = 0; i < 5; ++i) { ctx.fillStyle = WORLDS[i].color; ctx.beginPath(); ctx.arc(cx - 32 + i * 16, cy, 7, 0, 7); ctx.fill(); } }, 'Campaign', 'Five worlds of eight levels: Tinker Workshop, Greenhouse Garden, Cryo Lab, Volcano Forge and Orbit Station.']);
        rows.push([x1, y, (cx, cy) => Art.drawTarget(ctx, cx, cy, false, G.time, '#ff7a3a'), 'Trick Shots', 'Ten challenges on campaign levels: everything in one shot, a minimum number of ricochets, or no parts at all.']);
        rows.push([x0, y + 96, (cx, cy) => { ui.drawChip(G.localDate().slice(5), cx, cy - 12, 24, { align: 'center', px: 13, color: '#ffe066' }); }, 'Daily Challenge', 'One level a day with fresh stars along a known solution and a spare part. Pays a bonus on the first clear.']);
        rows.push([x1, y + 96, partDraw('crate'), 'Sandbox', 'Build anything with every part you own. Drag the target where you like and go wild.']);
        rows.push([x0, y + 192, (cx, cy) => nodeGlyph({ id: 'gear' }, '#5ad1ff', cx, cy, 44), 'Tech Tree', 'Launcher, Parts, Physics, Fortune and Style - power, longer guides, more balls, spare parts, slow motion, coins, ball skins and trails.']);
        rows.push([x1, y + 192, (cx, cy) => { ui.drawKeycap('Esc', cx - 18, cy - 10, 12); }, 'Pause anywhere', 'Esc pauses and opens the menu, where the Tech Tree and this guide are one click away.']);
      }
      for (const r of rows)
        helpRow(r[0], r[1], w, r[2], r[3], r[4]);
      G.drawButton('prev', 'Back', 90, 630, 200, 52, { action: () => { if (helpPage > 0) --helpPage; else G.actions.closeHelp(); }, key: 'Left' });
      G.drawButton('next', helpPage < HELP_PAGES.length - 1 ? 'Next' : 'Done', 990, 630, 200, 52, { action: () => { if (helpPage < HELP_PAGES.length - 1) ++helpPage; else G.actions.closeHelp(); }, key: 'Right', accent: '#ffb84a' });
      ctx.textAlign = 'center';
      ui.fitText((helpPage + 1) + ' / ' + HELP_PAGES.length, VIEW_W / 2, 656, 200, 14, { color: ui.UI.textDim, weight: 'bold' });
    }

    /* ══════════════════════════════════════════════════════════════════
       PAUSE AND RESULTS
       ══════════════════════════════════════════════════════════════════ */

    function drawPause() {
      G.veil(0.62);
      const w = 420, h = 430, x = VIEW_W / 2 - w / 2, y = 130;
      ui.drawPanel(x, y, w, h, { accent: '#4ad0e0' });
      ui.drawHeadline('Paused', VIEW_W / 2, y + 50, 300, 48, '#ffffff', '#4ad0e0');
      const items = [
        ['resume', 'Resume', G.actions.resume, 'Esc'],
        ['restart', 'Reset Level', G.actions.restart, 'R'],
        ['tree', 'Tech Tree', () => G.actions.openTree('pause'), 'T'],
        ['help', 'How to Play', () => G.actions.openHelp('pause'), 'H'],
        ['quit', 'Quit Level', G.actions.quit, 'Q']
      ];
      items.forEach((it, i) => G.drawButton(it[0], it[1], x + 40, y + 96 + i * 64, w - 80, 54, { action: it[2], key: it[3] }));
    }

    function drawResults(dt) {
      const r = G.results;
      r.t += dt;
      const run = G.run;
      if (run)
        G.drawField(dt * 0.5);
      G.veil(0.55);
      const W = WORLDS[r.level.world];
      const w = 660, h = 470, x = VIEW_W / 2 - w / 2, y = 110;
      const pop = Math.min(1, r.t / 0.3);
      ctx.save();
      ctx.translate(VIEW_W / 2, y + h / 2);
      ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
      ctx.translate(-VIEW_W / 2, -(y + h / 2));
      ctx.globalAlpha *= pop;
      ui.drawPanel(x, y, w, h, { accent: W.color, glow: true });
      const head = r.mode === 'sandbox' ? 'Nice Shot!' : r.mode === 'trick' ? 'Trick Landed!' : r.stars.every(Boolean) ? 'Perfect!' : 'Solved!';
      ui.drawHeadline(head, VIEW_W / 2, y + 58, w - 80, 58, '#ffffff', W.color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(r.level.name, VIEW_W / 2, y + 104, w - 80, 17, { weight: 'bold', color: W.accent });
      /* the stars pop in one after another */
      const labels = r.mode === 'trick' ? ['Trick', 'Style', 'Flair'] : ['Solved', 'Par ' + r.par, r.starsTotal ? 'Stars ' + r.starsTaken + '/' + r.starsTotal : 'Stars'];
      for (let s = 0; s < 3; ++s) {
        const at = 0.45 + s * 0.38;
        const k = Math.max(0, Math.min(1, (r.t - at) / 0.25));
        const on = r.stars[s];
        const sx = VIEW_W / 2 + (s - 1) * 150, sy = y + 190 - (s === 1 ? 14 : 0);
        if (k > 0 && r.shown <= s) {
          r.shown = s + 1;
          if (on) {
            Fx.starBurst(G.fxView, sx, sy);
            G.sfx('coin', { pitch: 1 + s * 0.2 });
          } else {
            G.sfx('click');
          }
        }
        const sc = k < 1 ? 0.3 + k * 1.0 : 1 + (on ? 0.06 * Math.sin(G.time * 4 + s) : 0);
        if (on && k >= 1)
          Art.drawGlow(ctx, sx, sy, 150, '#ffd84a', 0.5);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(sc, sc);
        ctx.rotate((1 - k) * 2);
        starIcon(0, 0, 96, on && k > 0);
        ctx.restore();
        ui.fitText(labels[s], sx, sy + 66, 140, 14, { weight: 'bold', color: on ? '#ffe066' : ui.UI.textDim });
      }
      /* numbers */
      const tc = Math.max(0, r.t - 1.6);
      r.coinShown = Math.min(r.coins, Math.round(r.coins * Math.min(1, tc / 0.8)));
      if (tc > 0 && tc < 0.85 && Math.floor(tc * 20) !== Math.floor((tc - dt) * 20) && r.coins)
        G.sfx('blip', { volume: 0.3, pitch: 1.5 });
      ui.fitText('Shots: ' + r.shots + (r.mode === 'campaign' || r.mode === 'daily' ? '   (par ' + r.par + ')' : ''), VIEW_W / 2, y + 304, w - 60, 18, { weight: 'bold', color: '#ffffff' });
      drawCoin(VIEW_W / 2 - 70, y + 342, 14);
      ctx.textAlign = 'left';
      ui.fitText('+' + r.coinShown + ' coins', VIEW_W / 2 - 50, y + 343, 240, 22, { weight: 'bold', color: '#ffe066', font: ui.TITLE_FONT });
      ctx.textAlign = 'center';
      if (r.first && tc > 0.9)
        ui.drawChip(r.mode === 'campaign' ? 'FIRST CLEAR' : r.mode === 'daily' ? 'DAILY CLEARED' : 'NEW TRICK', VIEW_W / 2, y + 368, 24, { align: 'center', px: 12, color: '#8affb0' });
      ctx.restore();
      const by = y + h - 80;
      const nextLabel = r.mode === 'campaign' ? 'Next Level' : r.mode === 'trick' ? 'Trick Board' : 'Title';
      G.drawButton('next', nextLabel, x + 30, by, 220, 56, { action: G.actions.next, accent: W.color, key: 'N' });
      G.drawButton('retry', 'Retry', x + 262, by, 150, 56, { action: G.actions.retry, key: 'R' });
      G.drawButton('tree', 'Tech Tree', x + 424, by, 206, 56, { action: () => G.actions.openTree('results'), key: 'T' });
      if (r.t > 0.6 && r.t - dt <= 0.6 && r.stars.every(Boolean))
        for (let k = 0; k < 4; ++k)
          Fx.firework(G.fxView, 200 + k * 300, 560, null);
    }

    /* ── input hooks; return true when handled ── */

    function key(e) {
      const code = e.code;
      if (G.state === 'tree') {
        if (code === 'ArrowLeft' || code === 'KeyA') moveTree(-1, 0);
        else if (code === 'ArrowRight' || code === 'KeyD') moveTree(1, 0);
        else if (code === 'ArrowUp' || code === 'KeyW') moveTree(0, -1);
        else if (code === 'ArrowDown' || code === 'KeyS') moveTree(0, 1);
        else if (code === 'Tab') { treeBranch = (treeBranch + (e.shiftKey ? 4 : 1)) % 5; treeSelected = treeLayout()[0].node.id; G.sfx('click'); }
        else if (/^Digit[1-5]$/.test(code)) { treeBranch = Number(code.charAt(5)) - 1; treeSelected = treeLayout()[0].node.id; }
        else if (code === 'Enter' || code === 'Space') buyTreeNode(treeSelected);
        else return false;
        e.preventDefault();
        return true;
      }
      if (G.state === 'map') {
        const levels = Lv.worldLevels(mapWorld);
        if (code === 'ArrowLeft' || code === 'KeyA') mapLevel = Math.max(0, mapLevel - 1);
        else if (code === 'ArrowRight' || code === 'KeyD') mapLevel = Math.min(levels.length - 1, mapLevel + 1);
        else if (code === 'KeyQ' || code === 'PageUp' || code === 'ArrowUp' || code === 'KeyW') changeWorld(-1);
        else if (code === 'KeyE' || code === 'PageDown' || code === 'ArrowDown' || code === 'KeyS') changeWorld(1);
        else if (code === 'Enter' || code === 'Space') playMapLevel();
        else if (code === 'KeyT') G.actions.openTree('map');
        else return false;
        e.preventDefault();
        return true;
      }
      if (G.state === 'help') {
        if (code === 'ArrowRight' || code === 'Enter' || code === 'Space' || code === 'KeyD') {
          if (helpPage < HELP_PAGES.length - 1) ++helpPage;
          else G.actions.closeHelp();
          G.sfx('click');
        } else if (code === 'ArrowLeft' || code === 'KeyA') {
          if (helpPage > 0) { --helpPage; G.sfx('click'); }
        } else {
          return false;
        }
        e.preventDefault();
        return true;
      }
      if (G.state === 'title' && /^Digit[1-4]$/.test(code)) {
        const n = Number(code.charAt(5));
        if (n === 1) G.actions.openMap();
        else if (n === 2) G.actions.openTricks();
        else if (n === 3) G.actions.startDaily();
        else G.actions.startSandbox(highestWorld());
        return true;
      }
      return false;
    }

    function pointerDown(hit) {
      if (G.state === 'tree' && hit && hit.id === 'tree')
        return false;
      return false;
    }

    function setTreeFromPause(v) {
      treeFromPause = v;
    }

    return {
      drawTitle: drawTitle, drawMap: drawMap, drawTricks: drawTricks, drawTree: drawTree, drawHelp: drawHelp,
      drawPause: drawPause, drawResults: drawResults, openMap: openMap, openTree: openTree, openHelp: openHelp,
      key: key, pointerDown: pointerDown, setTreeFromPause: setTreeFromPause, get mapWorld() { return mapWorld; }
    };
  }

  SZ.PhysicsPuzzleScreens = Object.freeze({ create: create });
})();
