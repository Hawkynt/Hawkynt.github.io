/* How to Play, in five illustrated pages: the basics and controls, the twelve power-ups, the
   seven ghost kinds, the worlds' tile twists and bosses, and the modes with progression. Left
   and right flip pages. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { POWERUPS, GHOSTS, MODES } = NS.items;
  const { WORLDS, BOSSES } = NS.worlds;
  const K = NS.artKit;
  const AA = NS.actorArt;
  const IA = NS.itemArt;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const PAGES = ['Basics', 'Power-ups', 'Ghosts', 'Worlds', 'Modes'];

  function basics(x, y) {
    const lines = [
      ['Arrow keys / WASD', 'Steer Pac-Man. Press a turn early - it is remembered until the corner.'],
      ['Swipe or D-pad', 'On touch screens swipe anywhere, or use the on-screen pad.'],
      ['Esc / P', 'Pause. The tech tree, wardrobe and goals open from the pause menu.'],
      ['Dots', 'Eat every dot to clear a maze. Quick dots build a chain and fill the multiplier.'],
      ['Power pellets', 'Ghosts turn blue - eat them for 200, 400, 800, 1600.'],
      ['Multiplier', 'Every point is multiplied. It drains when you dawdle and resets when caught.'],
      ['Autosave', 'Your run saves itself. Close the page any time and press Continue later.'],
    ];
    for (let i = 0; i < lines.length; ++i) {
      kit.text(lines[i][0], x, y + i * 56, 18, UI.accent, { weight: 'bold' });
      kit.text(lines[i][1], x, y + 22 + i * 56, 15, UI.text);
    }
    K.blitEx(ctx, AA.pac(G.profile.skin, AA.mouthIndex(G.time * 8)), 1050, 300, 0, 3, 3);
    K.blit(ctx, AA.scared(Math.floor(G.time * 6) % 2, false), 1160, 300, 2.2);
  }

  function powerups(x, y) {
    for (let i = 0; i < POWERUPS.length; ++i) {
      const p = POWERUPS[i];
      const cx = x + (i % 2) * 580, cy = y + Math.floor(i / 2) * 70;
      K.blit(ctx, IA.capsule(p.id, p.color), cx + 24, cy + 10, 1.1);
      kit.text(p.name, cx + 60, cy, 18, p.color, { weight: 'bold' });
      kit.text(p.desc + (p.dur ? ' (' + p.dur + ' s)' : ''), cx + 60, cy + 22, 14, UI.text);
    }
  }

  function ghosts(x, y) {
    const ids = Object.keys(GHOSTS);
    const desc = {
      blinky: 'Chases you directly - and speeds up as the dots run low.',
      pinky: 'Aims four tiles ahead of you to cut you off.',
      inky: 'Flanks you using Blinky\'s position. Unpredictable.',
      clyde: 'Chases from afar, wanders off when close.',
    };
    for (let i = 0; i < ids.length; ++i) {
      const g = GHOSTS[ids[i]];
      const cy = y + i * 64;
      K.blit(ctx, AA.ghost(g.color, ids[i], Math.floor(G.time * 5) % 2), x + 26, cy + 8, 1.3);
      K.blit(ctx, AA.eyes(2), x + 26, cy + 8, 1.3);
      kit.text(g.name, x + 70, cy, 19, g.color, { weight: 'bold' });
      kit.text(desc[ids[i]] || g.desc, x + 70, cy + 22, 15, UI.text);
    }
  }

  function worlds(x, y) {
    const tw = { pads: 'arrow pads fling you', taffy: 'taffy slows you', ice: 'ice: no turning back', portals: 'portals bend the maze', dark: 'darkness hides the ghosts', vents: 'fire vents erupt' };
    for (let i = 0; i < WORLDS.length; ++i) {
      const w = WORLDS[i];
      const cy = y + i * 80;
      ctx.save();
      kit.roundRect(x, cy - 24, 120, 64, 10);
      ctx.clip();
      ctx.drawImage(NS.backdrop.scene(w.theme), x - 40, cy - 40, 200, 112);
      ctx.restore();
      kit.text((i + 1) + '. ' + w.name, x + 140, cy - 6, 19, w.theme.rim, { weight: 'bold' });
      kit.text(w.features.length ? w.features.map(f => tw[f]).join(', ') : 'the classic rules', x + 140, cy + 18, 15, UI.text);
      kit.text('Boss: ' + BOSSES[w.boss].name, x + 760, cy + 6, 16, BOSSES[w.boss].color, { weight: 'bold' });
    }
    kit.text('Bosses can only be bitten while you are powered up. Each bite needs a fresh pellet.', x, y + 410, 15, UI.textDim);
  }

  function modes(x, y) {
    for (let i = 0; i < MODES.length; ++i) {
      const m = MODES[i];
      kit.icon(m.icon, x + 20, y + i * 58 + 8, 28, m.color);
      kit.text(m.name, x + 56, y + i * 58, 19, m.color, { weight: 'bold' });
      kit.text(m.sub, x + 56, y + i * 58 + 22, 15, UI.text);
    }
    const lines = ['Every mode pays shards. Spend them in the tech tree (25 upgrades in five branches) and the wardrobe.',
      'Three daily quests and a play streak pay extra. Achievements unlock skins, trails and themes.',
      'Seasonal events follow your calendar: collect their tokens for exclusive rewards.'];
    for (let i = 0; i < lines.length; ++i) kit.text(lines[i], x, y + 320 + i * 28, 15, UI.textDim);
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,2,14,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const page = G.ui.helpPage;
    kit.text('HOW TO PLAY', 50, 44, 32, '#ffffff', { weight: 'bold' });
    kit.text(PAGES[page] + '  (' + (page + 1) + '/' + PAGES.length + ')', 1230, 46, 18, UI.accent, { align: 'right', weight: 'bold' });
    kit.panel(40, 84, 1200, 556, { accent: UI.accent2 });
    switch (page) {
      case 0: basics(80, 130); break;
      case 1: powerups(80, 124); break;
      case 2: ghosts(80, 124); break;
      case 3: worlds(80, 140); break;
      default: modes(80, 130);
    }
    W.button('prev', 'Previous', 40, 654, 200, 46, { icon: 'back', disabled: page === 0, action: () => flip(-1) });
    W.button('next', 'Next', 260, 654, 200, 46, { icon: 'play', disabled: page === PAGES.length - 1, action: () => flip(1) });
    W.button('back', 'Done', 1040, 654, 200, 46, { icon: 'check', action: () => scr.back('helpReturn') });
  }

  function flip(d) {
    const n = G.ui.helpPage + d;
    if (n < 0 || n >= PAGES.length) return;
    G.ui.helpPage = n;
    sfx('click');
  }

  function onKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { flip(-1); return true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { flip(1); return true; }
    return false;
  }

  Object.assign(NS.help, {
    draw, onKey, PAGES
  });
})();
