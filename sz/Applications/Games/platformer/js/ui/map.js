/*
 * The world map for Adventure and Time Trial: level nodes, stars, best times and the level card.
 * Owns G.mapWorld, G.mapLevel, G.mapMode.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, WORLDS } = NS.config;
  const Levels = SZ.PlatformerLevels;
  const Prog = SZ.PlatformerProgress;
  const Spr = SZ.PlatformerSprites;
  const Session = NS.module('session');
  const Menu = NS.module('menu');
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { formatTime } = NS.module('util');
  const { drawSprite, drawGlow, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;

  function openMap(mode) {
    G.mapMode = mode;
    if (mode === 'trial' && !Prog.levelDone(G.save, G.mapWorld, G.mapLevel)) {
      outer: for (let w = 0; w < 5; ++w)
        for (let i = 0; i < 6; ++i)
          if (Prog.levelDone(G.save, w, i)) { G.mapWorld = w; G.mapLevel = i; break outer; }
    } else if (!Prog.levelUnlocked(G.save, G.mapWorld, G.mapLevel)) {
      G.mapWorld = 0;
      G.mapLevel = 0;
    }
    Session.setScreen('map');
  }

  function mapNode(i) {
    const x = 170 + i * 188;
    const y = 360 + Math.sin(i * 1.3 + G.mapWorld) * 70;
    return { x: x, y: y };
  }

  function mapPlayable(w, i) {
    return G.mapMode === 'trial' ? Prog.levelDone(G.save, w, i) : Prog.levelUnlocked(G.save, w, i);
  }

  function selectMapLevel(i) {
    if (i < 0 || i > 5)
      return;
    G.mapLevel = i;
    sfx('click', { volume: 0.5 });
  }

  function changeMapWorld(d) {
    const w = G.mapWorld + d;
    if (w < 0 || w > 4)
      return;
    if (!Prog.worldUnlocked(G.save, w)) {
      sfx('error', { volume: 0.4 });
      Session.showToast('Defeat ' + WORLDS[w - 1].bossName + ' to reach ' + WORLDS[w].name, '#ffb0a0');
      return;
    }
    G.mapWorld = w;
    G.mapLevel = 0;
    G.fade = 0.6;
    sfx('whoosh');
  }

  function playMapLevel() {
    if (!mapPlayable(G.mapWorld, G.mapLevel)) {
      sfx('error', { volume: 0.4 });
      return;
    }
    Session.startCampaign(G.mapWorld, G.mapLevel, G.mapMode);
  }

  const parCache = {};
  function parTime(spec) {
    if (!parCache[spec.id])
      parCache[spec.id] = Levels.build(spec).timeTarget;
    return parCache[spec.id];
  }

  function drawMap() {
    const W = WORLDS[G.mapWorld];
    Menu.menuBackdrop(G.mapWorld, 0.25);
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: W.color });
    ui.drawHeadline(G.mapMode === 'trial' ? 'Time Trial' : W.name, 330, 56, 560, 44, '#ffffff', W.accent);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('World ' + (G.mapWorld + 1) + ' of 5  -  ' + Prog.worldStars(G.save, G.mapWorld) + ' / 18 stars', 640, 56, 300, 15, { weight: 'bold', color: W.color });
    Menu.currencyChips(1236, 35);
    /* world arrows */
    Menu.drawButton('wprev', '<', 40, 330, 56, 70, { action: () => changeMapWorld(-1), disabled: G.mapWorld === 0, px: 28 });
    Menu.drawButton('wnext', '>', 1184, 330, 56, 70, { action: () => changeMapWorld(1), disabled: G.mapWorld === 4 || !Prog.worldUnlocked(G.save, G.mapWorld + 1), px: 28 });

    /* the trail between the nodes */
    ctx.save();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; ++pass) {
      ctx.beginPath();
      for (let i = 0; i < 6; ++i) {
        const n = mapNode(i);
        if (i === 0) ctx.moveTo(n.x, n.y);
        else {
          const p = mapNode(i - 1);
          ctx.bezierCurveTo((p.x + n.x) / 2, p.y, (p.x + n.x) / 2, n.y, n.x, n.y);
        }
      }
      ctx.lineWidth = pass ? 6 : 16;
      ctx.strokeStyle = pass ? 'rgba(255,240,200,0.85)' : 'rgba(20,14,30,0.55)';
      if (pass)
        ctx.setLineDash([2, 16]);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 6; ++i) {
      const n = mapNode(i);
      const unlocked = Prog.levelUnlocked(G.save, G.mapWorld, i);
      const playable = mapPlayable(G.mapWorld, i);
      const rec = G.save.levels['w' + G.mapWorld + 'l' + i];
      const sel = i === G.mapLevel;
      const boss = i === 5;
      const rad = boss ? 46 : 36;
      const index = Menu.registerHit('node' + i, n.x - rad, n.y - rad, rad * 2, rad * 2, ((k) => () => {
        if (G.mapLevel === k) playMapLevel();
        else selectMapLevel(k);
      })(i), !unlocked);
      if (G.mouseX >= n.x - rad && G.mouseX <= n.x + rad && G.mouseY >= n.y - rad && G.mouseY <= n.y + rad && G.pointerMoved)
        G.menuCursor = index;
      if (sel)
        drawGlow(n.x, n.y, 220, W.color, 0.45 + 0.15 * Math.sin(G.time * 4));
      ui.drawPanel(n.x - rad, n.y - rad, rad * 2, rad * 2, { radius: rad, noStuds: true, accent: sel ? '#ffd75a' : W.color, glow: sel,
        top: playable ? ui.hexToRgba(ui.shade(W.color, -0.35), 0.96) : 'rgba(40,44,60,0.95)', bottom: playable ? ui.hexToRgba(ui.shade(W.color, -0.75), 0.96) : 'rgba(16,18,28,0.95)' });
      if (!unlocked) {
        drawIcon('lock', '#a0a8c0', n.x, n.y, 30);
      } else if (boss) {
        drawIcon('skull', rec && rec.done ? '#ffd75a' : '#ff8a6a', n.x, n.y, 44);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(String(i + 1), n.x, n.y + 2, 50, 30, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.6)' });
      }
      const stars = Prog.starsOf(rec);
      for (let k = 0; k < 3; ++k) {
        ctx.save();
        ctx.globalAlpha = stars[k] ? 1 : 0.3;
        drawIcon('star', stars[k] ? '#ffd75a' : '#8a90a8', n.x - 26 + k * 26, n.y + rad + 16, 24);
        ctx.restore();
      }
      if (G.mapMode === 'trial' && rec && rec.bestTime) {
        ctx.textAlign = 'center';
        ui.fitText(formatTime(rec.bestTime), n.x, n.y - rad - 14, 120, 13, { weight: 'bold', color: '#bfe8ff', outline: 'rgba(0,0,0,0.7)' });
      }
    }
    /* the hero waits on the selected node */
    const sn = mapNode(G.mapLevel);
    drawSprite(Spr.hero(Session.currentSkin(), 'idle', Math.floor(G.time * 4) % 4), sn.x, sn.y - (G.mapLevel === 5 ? 46 : 36) + 4);

    /* level card */
    const spec = Levels.CAMPAIGN[G.mapWorld][G.mapLevel];
    const rec = G.save.levels[spec.id];
    const cy = Math.min(v.y1, VIEW_H) - 178;
    ui.drawPanel(150, cy, 980, 150, { accent: W.color, title: (G.mapLevel === 5 ? 'Boss - ' : 'Level ' + (G.mapLevel + 1) + ' - ') + spec.name, titleRight: G.mapLevel === 5 ? W.bossName : spec.chunks.length - 2 + ' sections' });
    const stars = Prog.starsOf(rec);
    const labels = ['Reach the goal', 'Find all 3 gems', 'Beat par ' + parTime(spec) + 's'];
    for (let k = 0; k < 3; ++k) {
      const x = 180 + k * 220;
      drawIcon('star', stars[k] ? '#ffd75a' : '#5a6078', x, cy + 64, 30);
      ctx.textAlign = 'left';
      ui.fitText(labels[k], x + 22, cy + 65, 180, 15, { weight: 'bold', color: stars[k] ? '#ffe9a0' : ui.UI.textDim });
    }
    ctx.textAlign = 'left';
    ui.fitText(rec && rec.bestTime ? 'Best time ' + formatTime(rec.bestTime) : 'Not cleared yet', 180, cy + 112, 300, 15, { color: ui.UI.textDim });
    for (let k = 0; k < 3; ++k) {
      ctx.save();
      ctx.globalAlpha = rec && rec.gems[k] ? 1 : 0.25;
      drawSprite(Spr.item('gem', 0, k), 500 + k * 36, cy + 112, false, 0.7, 0.7);
      ctx.restore();
    }
    const playable = mapPlayable(G.mapWorld, G.mapLevel);
    Menu.drawButton('play', G.mapMode === 'trial' ? 'Start Trial' : 'Play', 840, cy + 44, 260, 56, { icon: G.mapMode === 'trial' ? 'clock' : 'flag', action: playMapLevel, disabled: !playable, accent: W.color, key: 'Enter' });
    Menu.drawButton('mback', 'Back', 40, 104, 130, 46, { action: () => Session.setScreen('title'), key: 'Esc', px: 16 });
    ui.drawKeyHints([{ key: '<- ->', label: 'Level' }, { key: 'Q / E', label: 'World' }, { key: 'Enter', label: 'Play' }, { key: 'T', label: 'Tech Tree' }, { key: 'Esc', label: 'Back' }], VIEW_W / 2, Math.min(v.y1, VIEW_H) - 14, 700, 1);
  }

  Object.assign(NS.module('map'), {
    openMap,
    selectMapLevel,
    changeMapWorld,
    playMapLevel,
    drawMap
  });
})();
