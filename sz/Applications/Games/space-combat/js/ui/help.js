/* How to Play: six illustrated pages - controls (drawn keycaps and mouse), flight and combat,
   weapons and power-ups, the ten enemies, bosses and hazards, modes and progression - with
   page dots and keyboard paging. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ENEMIES, ENEMY_ORDER, BOSSES, BOSS_ORDER } = NS.enemyData;
  const { PRIMARIES, SECONDARIES, POWERUPS, SHIPS } = NS.ships;
  const K = NS.artKit;
  const P = NS.propArt;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const PAGES = ['Controls', 'Flight & Combat', 'Weapons & Power-ups', 'Enemies', 'Bosses & Hazards', 'Modes & Progress'];

  function key(x, y, w, label, hot) {
    ctx.fillStyle = hot ? '#3a4a78' : '#1a2238';
    kit.roundRect(x, y, w, 34, 6);
    ctx.fill();
    ctx.strokeStyle = hot ? UI.gold : 'rgba(150,180,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 3, y + 3, w - 6, 10);
    kit.fitText(label, x + w / 2, y + 18, w - 8, 14, { align: 'center', weight: 'bold', color: '#ffffff' });
  }

  function pageControls(x, y) {
    /* WASD cluster */
    key(x + 60, y, 40, 'W'); key(x + 15, y + 40, 40, 'A'); key(x + 60, y + 40, 40, 'S'); key(x + 105, y + 40, 40, 'D');
    kit.text('Thrust / strafe  (or arrow keys)', x + 170, y + 40, 15, UI.text);
    key(x + 15, y + 92, 130, 'SHIFT');
    kit.text('Boost - builds heat, overheats at 100%', x + 170, y + 108, 15, UI.text);
    key(x + 15, y + 136, 130, 'SPACE');
    kit.text('Dodge roll - brief invulnerability', x + 170, y + 152, 15, UI.text);
    key(x + 15, y + 180, 60, 'E'); key(x + 85, y + 180, 60, 'Q');
    kit.text('Ship special ability', x + 170, y + 196, 15, UI.text);
    key(x + 15, y + 224, 60, 'X'); key(x + 85, y + 224, 60, 'C');
    kit.text('Fire secondary weapon', x + 170, y + 240, 15, UI.text);
    key(x + 60, y + 272, 40, 'I'); key(x + 15, y + 312, 40, 'J'); key(x + 60, y + 312, 40, 'K'); key(x + 105, y + 312, 40, 'L');
    kit.text('Keyboard turret: aim and fire in 8 directions', x + 170, y + 312, 15, UI.text);
    key(x + 15, y + 364, 130, 'ESC / P');
    kit.text('Pause - tech tree from the pause menu', x + 170, y + 380, 15, UI.text);
    /* mouse */
    const mx = x + 700, my = y + 70;
    const body = ctx.createLinearGradient(mx, my, mx + 90, my + 140);
    body.addColorStop(0, '#3a4a70');
    body.addColorStop(1, '#0e1424');
    ctx.fillStyle = body;
    kit.roundRect(mx, my, 90, 140, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,180,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    kit.roundRect(mx, my, 90, 140, 42);
    ctx.clip();
    ctx.fillStyle = K.rgba(UI.accent, 0.35 + (Math.floor(G.time * 2) % 2) * 0.35);
    ctx.fillRect(mx, my, 44, 58);
    ctx.fillStyle = K.rgba(UI.warn, 0.35 + (Math.floor(G.time * 2 + 1) % 2) * 0.35);
    ctx.fillRect(mx + 46, my, 44, 58);
    ctx.restore();
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(mx + 44, my, 2, 58);
    ctx.fillRect(mx, my + 58, 90, 2);
    ctx.fillStyle = '#c8d0e0';
    kit.roundRect(mx + 40, my + 16, 10, 24, 5);
    ctx.fill();
    kit.text('Aim with the mouse', mx + 45, my + 166, 15, UI.text, { align: 'center' });
    kit.text('Left: primary weapon', mx + 45, my + 190, 14, UI.accent, { align: 'center' });
    kit.text('Right: secondary', mx + 45, my + 212, 14, UI.warn, { align: 'center' });
    kit.wrap('Touch screens get two virtual sticks: the left one flies, the right one aims and fires. Buttons for boost, roll, secondary and special sit above the right stick.', x + 560, y + 300, 380, 14, 20, UI.textDim);
  }

  function shipAt(x, y, a, s, bank) {
    const ship = SHIPS[0];
    K.blitRot(ctx, NS.shipArt.shipSprite(ship.id, 'stock', ship.colors, bank || 0), x, y, a, s);
  }

  function pageFlight(x, y) {
    const t = G.time;
    /* drift illustration: ship sliding sideways with a velocity arrow */
    shipAt(x + 120, y + 70, -0.3, 1.6, Math.sin(t * 2));
    ctx.strokeStyle = UI.good;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 120, y + 70); ctx.lineTo(x + 220, y + 120); ctx.stroke();
    kit.text('Inertia and drift', x + 260, y + 50, 18, '#ffffff', { weight: 'bold' });
    kit.wrap('Your ship keeps its momentum. Thrust in any direction while the nose follows your aim - strafe around enemies, drift through turns.', x + 260, y + 66, 640, 14, 20, UI.text);
    /* roll illustration */
    for (let i = 0; i < 5; ++i) {
      ctx.globalAlpha = 0.2 + i * 0.2;
      ctx.save();
      ctx.translate(x + 60 + i * 34, y + 200);
      ctx.scale(1, Math.abs(Math.cos(i * 0.8)) + 0.1);
      shipAt(0, 0, 0, 1.2, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    kit.text('Dodge roll', x + 260, y + 170, 18, '#ffffff', { weight: 'bold' });
    kit.wrap('A burst sideways with a moment of invulnerability. Roll through bullets, beams and solar flares. The Ram Field upgrade turns rolls into weapons.', x + 260, y + 186, 640, 14, 20, UI.text);
    kit.bar(x + 40, y + 300, 160, 12, 0.5 + Math.sin(t) * 0.4, UI.heat, { cells: 10 });
    kit.text('Boost and heat', x + 260, y + 290, 18, '#ffffff', { weight: 'bold' });
    kit.wrap('Boost nearly doubles your speed but heats the engines. Overheat and you must cool down to 35% before boosting again.', x + 260, y + 306, 640, 14, 20, UI.text);
    kit.text('x' + (1 + Math.floor(t % 7)) + ' COMBO', x + 120, y + 400, 26, '#ff9ab8', { align: 'center', weight: 'bold' });
    kit.text('Shields, hull and combos', x + 260, y + 390, 18, '#ffffff', { weight: 'bold' });
    kit.wrap('Shields recharge after a moment without damage; hull does not (except with Nano Repair). Kills in quick succession build a combo for up to x7 score.', x + 260, y + 406, 640, 14, 20, UI.text);
  }

  function pageWeapons(x, y) {
    kit.text('PRIMARY WEAPONS', x, y, 13, UI.accent, { weight: 'bold' });
    for (let i = 0; i < PRIMARIES.length; ++i) {
      const w = PRIMARIES[i];
      const yy = y + 28 + i * 44;
      ctx.globalCompositeOperation = 'lighter';
      K.blitRot(ctx, K.bolt(w.color, NS.ships.COLORS[w.color], 22, 5), x + 24, yy, 0, 1);
      ctx.globalCompositeOperation = 'source-over';
      kit.text(w.name, x + 56, yy - 7, 15, '#ffffff', { weight: 'bold' });
      kit.text(w.desc, x + 56, yy + 11, 12, UI.textDim);
    }
    kit.text('SECONDARY WEAPONS', x, y + 300, 13, UI.accent, { weight: 'bold' });
    for (let i = 0; i < SECONDARIES.length; ++i) {
      const w = SECONDARIES[i];
      const xx = x + (i % 2) * 260, yy = y + 330 + Math.floor(i / 2) * 44;
      kit.text(w.name, xx, yy - 7, 15, '#ffffff', { weight: 'bold' });
      kit.fitText(w.desc, xx, yy + 11, 250, 12, { color: UI.textDim });
    }
    kit.text('POWER-UPS', x + 600, y, 13, UI.accent, { weight: 'bold' });
    const desc = { shield: 'Refills your shield', repair: 'Mends 35% of your hull', overcharge: '+50% damage, faster fire', magnet: 'Pulls in everything nearby', ammo: 'Refills secondary ammo' };
    const keys = Object.keys(POWERUPS);
    for (let i = 0; i < keys.length; ++i) {
      const yy = y + 40 + i * 64;
      K.blit(ctx, P.capsule(keys[i]), x + 624, yy + Math.sin(G.time * 3 + i) * 3, 1.2);
      kit.text(POWERUPS[keys[i]].name, x + 660, yy - 8, 15, POWERUPS[keys[i]].color, { weight: 'bold' });
      kit.text(desc[keys[i]], x + 660, yy + 12, 13, UI.textDim);
    }
    K.blitRot(ctx, P.scrap(), x + 624, y + 370, G.time, 1.4);
    kit.text('Scrap', x + 660, y + 362, 15, UI.gold, { weight: 'bold' });
    kit.text('The currency - spend it in the hangar and tree', x + 660, y + 382, 13, UI.textDim);
  }

  function pageEnemies(x, y) {
    for (let i = 0; i < ENEMY_ORDER.length; ++i) {
      const id = ENEMY_ORDER[i];
      const e = ENEMIES[id];
      const xx = x + (i % 2) * 470, yy = y + Math.floor(i / 2) * 84;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(xx + 36, yy + 30, 32, 0, TAU);
      ctx.fill();
      const spr = NS.enemyArt.enemySprite(id);
      K.blitRot(ctx, spr, xx + 36, yy + 30, -Math.PI / 2 + Math.sin(G.time + i) * 0.2, Math.min(1.1, 60 / spr.w * (e.r > 30 ? 1.25 : 1.6)));
      if (id === 'turret') K.blitRot(ctx, NS.enemyArt.enemySprite('barrel'), xx + 36, yy + 30, G.time, 0.9);
      kit.text(e.name, xx + 84, yy + 18, 17, '#ffffff', { weight: 'bold' });
      kit.fitText(e.role, xx + 84, yy + 42, 370, 13, { color: UI.textDim });
    }
  }

  function pageBosses(x, y) {
    for (let i = 0; i < BOSS_ORDER.length; ++i) {
      const b = BOSSES[BOSS_ORDER[i]];
      const xx = x + i * 188;
      const id = BOSS_ORDER[i];
      const spr = NS.enemyArt.enemySprite(id === 'maw' ? 'maw' : id);
      K.blitRot(ctx, spr, xx + 80, y + 70, -Math.PI / 2 + (id === 'warden' || id === 'overmind' ? G.time * 0.3 : 0), 130 / spr.w);
      kit.text(b.name, xx + 80, y + 150, 16, '#ff8a8a', { align: 'center', weight: 'bold' });
      kit.fitText(b.title, xx + 80, y + 170, 176, 11, { align: 'center', color: UI.textDim });
    }
    const hz = [
      ['Asteroids', 'Break into smaller rocks; ramming hurts.', () => K.blitRot(ctx, P.rock(2, 1, 'kepler'), x + 40, y + 250, G.time * 0.3, 0.8)],
      ['Space mines', 'Blink faster when you are near, then blow.', () => K.blit(ctx, P.mine(false), x + 40, y + 310, 1)],
      ['Nebulae', 'Slow ships and hide them - enemies inside need you close to see you.', () => { ctx.fillStyle = 'rgba(176,74,255,0.35)'; ctx.beginPath(); ctx.arc(x + 40, y + 370, 24, 0, TAU); ctx.fill(); }],
      ['Black holes', 'Pull ships, shots and scrap. The core destroys.', () => K.blit(ctx, P.blackHole(12), x + 40, y + 430, 0.5)],
      ['Solar flares', 'A wall of light crosses the sector - roll through it.', () => { ctx.fillStyle = 'rgba(255,190,90,0.6)'; ctx.fillRect(x + 30, y + 466, 20, 44); }],
    ];
    for (let i = 0; i < hz.length; ++i) {
      const col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
      ctx.save();
      ctx.translate(col * 560, row * 72 - i * 60);
      hz[i][2]();
      ctx.restore();
      kit.text(hz[i][0], x + 90 + col * 560, y + 240 + row * 72, 16, '#ffffff', { weight: 'bold' });
      kit.fitText(hz[i][1], x + 90 + col * 560, y + 260 + row * 72, 440, 13, { color: UI.textDim });
    }
  }

  function pageModes(x, y) {
    const rows = [
      ['Campaign', '#4fc3ff', '5 sectors x 6 missions: survival, assault, escort, defense, salvage and a boss. Stars: finish, keep half your hull, beat the par time.'],
      ['Endless Survival', '#5cff9a', 'Escalating waves; a boss every fifth wave and new scenery every five.'],
      ['Daily Challenge', '#ffd25a', 'Today\'s seeded gauntlet under one mutator - four missions and a boss.'],
      ['Boss Rush', '#ff5c6c', 'All five bosses in a row. Unlocked by beating the Warden.'],
      ['Scrap', '#ffd25a', 'Every mode pays scrap: what you pick up, plus mission rewards or a score bonus.'],
      ['Hangar', '#ffa040', 'Five ships with their own specials, six primaries and four secondaries.'],
      ['Tech Tree', '#d08aff', '36 nodes in Weapons, Defense, Engines, Systems and Style. Open it from the pause menu - it applies at once.'],
    ];
    for (let i = 0; i < rows.length; ++i) {
      const yy = y + i * 62;
      ctx.fillStyle = K.rgba(rows[i][1], 0.8);
      ctx.fillRect(x, yy - 4, 4, 44);
      kit.text(rows[i][0], x + 18, yy + 6, 17, rows[i][1], { weight: 'bold' });
      kit.wrap(rows[i][2], x + 18, yy + 18, 900, 14, 19, UI.text);
    }
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.7)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const page = G.ui.helpPage;
    kit.text('HOW TO PLAY', 60, 46, 30, '#ffffff', { weight: 'bold' });
    kit.text(PAGES[page], 60, 78, 16, UI.gold, { weight: 'bold' });
    kit.panel(50, 100, 1180, 530, { accent: UI.accent });
    const x = 90, y = 140;
    if (page === 0) pageControls(x, y);
    else if (page === 1) pageFlight(x, y);
    else if (page === 2) pageWeapons(x, y);
    else if (page === 3) pageEnemies(x, y);
    else if (page === 4) pageBosses(x, y);
    else pageModes(x, y);
    for (let i = 0; i < PAGES.length; ++i) {
      ctx.fillStyle = i === page ? UI.gold : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(640 + (i - (PAGES.length - 1) / 2) * 22, 612, i === page ? 6 : 4, 0, TAU);
      ctx.fill();
    }
    W.button('prev', 'Previous', 380, 650, 160, 46, { action: () => turn(-1), disabled: page === 0 });
    W.button('next', 'Next', 740, 650, 160, 46, { action: () => turn(1), disabled: page === PAGES.length - 1 });
    W.button('back', G.helpReturn === 'paused' ? 'Back to Pause' : 'Back', 60, 650, 200, 46, { action: () => scr.setScreen(G.helpReturn || 'title') });
  }

  function turn(d) {
    G.ui.helpPage = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
  }

  function onKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { turn(-1); return true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { turn(1); return true; }
    return false;
  }

  Object.assign(NS.help, {
    draw, onKey, PAGES
  });
})();
