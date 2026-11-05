;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The story world map: the six lands side by side in their own colours (a cached
     painting), a winding trail with the 24 stage nodes and a boss crest at the end of every
     land, the bird waiting at the selected stage, recovered feathers, and a panel with the
     stage's details and Play / Replay chapter buttons. */

  const { CANVAS_W, CHAPTERS, FEATHERS } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Menu = NS.menu;
  const Nav = NS.nav;
  const Shapes = NS.shapes;
  const Course = SZ.FlappyCourse;

  const BAND = CANVAS_W / 6;
  let mapCanvas = null;

  function nodePos(i) {
    const w = Math.floor(i / 4), s = i % 4;
    const x = w * BAND + 34 + s * 48;
    const y = 360 + Math.sin(i * 0.75) * 110 - (s === 3 ? 10 : 0);
    return { x: x, y: y };
  }

  function buildMap() {
    if (mapCanvas)
      return mapCanvas;
    const c = document.createElement('canvas');
    c.width = CANVAS_W;
    c.height = 720;
    const x = c.getContext('2d');
    const T = SZ.FlappySceneArt.THEMES;
    for (let w = 0; w < 6; ++w) {
      const th = T[Course.BIOME_ORDER[w]];
      const x0 = w * BAND;
      const g = x.createLinearGradient(0, 0, 0, 720);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(1, th.sky[1]);
      x.fillStyle = g;
      x.fillRect(x0, 0, BAND + 1, 720);
      const layers = [[th.far, 420, 60], [th.mid, 500, 45], [th.near, 580, 30]];
      for (let l = 0; l < layers.length; ++l) {
        x.fillStyle = layers[l][0];
        x.beginPath();
        x.moveTo(x0, 720);
        for (let k = 0; k <= 20; ++k) {
          const px = x0 + BAND * k / 20;
          x.lineTo(px, layers[l][1] - layers[l][2] * Math.abs(Math.sin(k * 0.7 + w * 1.3 + l)));
        }
        x.lineTo(x0 + BAND, 720);
        x.closePath();
        x.fill();
      }
      x.fillStyle = th.groundTop;
      x.fillRect(x0, 640, BAND + 1, 8);
      x.fillStyle = th.ground;
      x.fillRect(x0, 648, BAND + 1, 72);
    }
    // soft seams between the lands
    for (let w = 1; w < 6; ++w) {
      const g = x.createLinearGradient(w * BAND - 20, 0, w * BAND + 20, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(w * BAND - 20, 0, 40, 720);
    }
    // the dotted trail
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = 5;
    x.setLineDash([2, 12]);
    x.lineCap = 'round';
    x.beginPath();
    for (let i = 0; i < 24; ++i) {
      const p = nodePos(i);
      if (i === 0)
        x.moveTo(p.x, p.y);
      else
        x.lineTo(p.x, p.y);
    }
    x.stroke();
    x.setLineDash([]);
    mapCanvas = c;
    return c;
  }

  function drawNode(i, hot, sel) {
    const st = Course.STAGES[i];
    const p = nodePos(i);
    const locked = !Prog.stageUnlocked(i);
    const stars = G.save.stars[st.id] || 0;
    const r = st.boss ? 24 : 17;
    ctx.save();
    if (hot) {
      ctx.translate(p.x, p.y);
      ctx.scale(1.15, 1.15);
      ctx.translate(-p.x, -p.y);
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y + 3, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = locked ? '#5a6278' : stars ? (st.boss ? '#ff6a4a' : '#ffd23f') : (st.boss ? '#c83a2a' : '#5ab8ff');
    ctx.fill();
    ctx.lineWidth = sel ? 4 : 2.5;
    ctx.strokeStyle = sel ? '#ffffff' : '#1a2238';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (locked)
      Shapes.drawLock(p.x, p.y, r * 1.1);
    else if (st.boss) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r - 3, 0, Math.PI * 2);
      ctx.clip();
      SZ.FlappyBossArt.drawBoss(ctx, { kind: st.boss, x: p.x + 6, y: p.y + 4, scale: 0.22, t: 0 });
      ctx.restore();
    } else
      ui.fitText(String(st.stage + 1), p.x, p.y + 1, r * 1.6, 16, { weight: 'bold', color: '#1a2238' });
    if (!locked)
      for (let k = 0; k < 3; ++k)
        Shapes.drawStarShape(p.x - 12 + k * 12, p.y + r + 9, 5, k < stars);
    ctx.restore();
  }

  function drawMapScreen() {
    const t = G.globalTime;
    const v = NS.view.visibleRect();
    const img = buildMap();
    ctx.drawImage(img, 0, 0);
    // the outer lands stretch into the letterbox bars
    if (v.x0 < 0)
      ctx.drawImage(img, 0, 0, 2, 720, v.x0, 0, -v.x0, 720);
    if (v.x1 > CANVAS_W)
      ctx.drawImage(img, CANVAS_W - 2, 0, 2, 720, CANVAS_W, 0, v.x1 - CANVAS_W, 720);
    if (v.y0 < 0)
      ctx.drawImage(img, 0, 0, CANVAS_W, 2, v.x0, v.y0, v.x1 - v.x0, -v.y0);
    if (v.y1 > 720)
      ctx.drawImage(img, 0, 718, CANVAS_W, 2, v.x0, 720, v.x1 - v.x0, v.y1 - 720);

    // land names and their feathers
    for (let w = 0; w < 6; ++w) {
      const x0 = w * BAND;
      const done = G.save.bosses[Course.BOSS_ORDER[w]] > 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(Course.BIOMES[Course.BIOME_ORDER[w]].name, x0 + BAND / 2, 120, BAND - 16, 18, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.65)' });
      ui.fitText(CHAPTERS[w].name, x0 + BAND / 2, 144, BAND - 16, 13, { color: '#ffffff', outline: 'rgba(0,0,0,0.6)' });
      ui.fitText(Prog.worldStars(w) + ' / 12', x0 + BAND / 2, 166, BAND - 16, 13, { weight: 'bold', color: '#ffd84a', outline: 'rgba(0,0,0,0.6)' });
      SZ.FlappyStoryArt.drawFeather(ctx, FEATHERS[w].color, x0 + BAND - 28, 210 + Math.sin(t * 2 + w) * 4, 0.4, 0.3);
      if (!done) {
        ctx.fillStyle = 'rgba(10,14,30,0.55)';
        ctx.beginPath();
        ctx.arc(x0 + BAND - 28, 210, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // nodes (hit areas in stage order, so arrows walk the trail)
    let hotIndex = -1;
    for (let i = 0; i < 24; ++i) {
      const p = nodePos(i);
      const r = 26;
      const locked = !Prog.stageUnlocked(i);
      const idx = Menu.registerHit('stage' + i, p.x - r, p.y - r, r * 2, r * 2 + 14, () => Nav.startStage(i), locked);
      const hot = Menu.isHot(idx, p.x - r, p.y - r, r * 2, r * 2 + 14);
      if (hot)
        hotIndex = i;
    }
    if (G.menuCursor < 24)
      G.mapSel = G.menuCursor;
    const sel = hotIndex >= 0 ? hotIndex : G.mapSel;
    for (let i = 0; i < 24; ++i)
      drawNode(i, i === hotIndex, i === sel);

    // the bird waits above the selected stage
    const bp = nodePos(sel);
    SZ.FlappyBirdArt.drawBird(ctx, { x: bp.x, y: bp.y - 54 + Math.sin(t * 4) * 6, birdId: Prog.currentBird(), frame: t * 10, scale: 1.2 });
    const hat = Prog.currentHat();
    if (hat !== 'none')
      SZ.FlappyCosmeticArt.drawHat(ctx, { x: bp.x, y: bp.y - 54 + Math.sin(t * 4) * 6, hatId: hat, scale: 1.2 });

    // the details panel
    const st = Course.STAGES[sel];
    const px = 290, py = 560, pw = 700, ph = 100;
    ui.drawPanel(px, py, pw, ph, { accent: st.boss ? '#ff6a4a' : ui.UI.gold });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('Stage ' + st.id + '  ' + st.name, px + 20, py + 28, 360, 22, { weight: 'bold', color: ui.UI.text });
    const stars = G.save.stars[st.id] || 0;
    let info = st.gates + ' pipes';
    if (st.boss)
      info += '  -  Boss: ' + SZ.FlappyBoss.KINDS[st.boss].name;
    const hz = Course.BIOMES[st.biome].hazard;
    if (hz)
      info += '  -  ' + { gust: 'gusts', icicle: 'icicles', bat: 'bats', laser: 'lasers', fireball: 'fireballs' }[hz];
    if (st.crowChance)
      info += ', crows';
    ui.fitText(info, px + 20, py + 58, 440, 15, { color: ui.UI.textDim });
    ui.fitText('Stars: finish - 60% coins - no hits', px + 20, py + 82, 440, 13, { color: ui.UI.textMute });
    for (let k = 0; k < 3; ++k)
      Shapes.drawStarShape(px + 400 + k * 30, py + 30, 12, k < stars);
    const locked = !Prog.stageUnlocked(sel);
    Menu.drawButton('m-play', locked ? 'Locked' : stars ? 'Replay' : 'Play', px + pw - 180, py + 52, 160, 38, { action: () => Nav.startStage(sel), disabled: locked });
    Menu.drawButton('m-chapter', 'Chapter scene', px + pw - 180, py + 10, 160, 36, { px: 14, action: () => NS.cine.play('chapter' + (st.world + 1)) });

    ui.drawHeadline('Story', 640, 52, 400, 40, ui.UI.gold);
    Menu.drawBackButton();
    Menu.drawButton('m-intro', 'Watch intro', 156, 22, 150, 44, { px: 15, action: () => NS.cine.play('intro') });
    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);
    ui.drawKeyHints([{ key: '←→', label: 'Stage' }, { key: 'Enter', label: 'Play' }, { key: 'Esc', label: 'Title' }], 640, 696, 600, 1);
  }

  Object.assign(NS.map, { nodePos, buildMap, drawMapScreen });
})();
