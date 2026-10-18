/* The hangar: a Ships tab (five ship cards, a turning preview with stat bars and the special,
   buy or fly) and a Weapons tab (six primaries and four secondaries with a live firing demo,
   buy or equip). Writes the loadout to the save and refreshes the derived stats at once. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { SHIPS, PRIMARIES, SECONDARIES, SKINS, COLORS, byId } = NS.ships;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  function colorsOf(ship) {
    const skin = SKINS[G.save.style.skin];
    return (skin && skin.colors) || ship.colors;
  }

  function changed() {
    NS.save.refreshStats();
    NS.save.writeSave();
    NS.statusBar.update();
  }

  function draw() {
    const save = G.save;
    kit.text('HANGAR', 60, 46, 30, '#ffffff', { weight: 'bold' });
    kit.credits(save.credits, 1220, 46, 22, 'right');
    const tab = G.ui.hangarTab;
    W.button('tabShips', 'Ships', 300, 24, 160, 42, { action: () => { G.ui.hangarTab = 'ships'; }, accent: tab === 'ships' ? UI.gold : UI.accent });
    W.button('tabWeapons', 'Weapons', 470, 24, 160, 42, { action: () => { G.ui.hangarTab = 'weapons'; }, accent: tab === 'weapons' ? UI.gold : UI.accent });
    if (tab === 'ships') drawShips(save);
    else drawWeapons(save);
    const back = G.hangarReturn === 'briefing' ? 'briefing' : G.hangarReturn === 'map' ? 'map' : 'title';
    W.button('back', back === 'briefing' ? 'Back to Briefing' : 'Back', 60, 650, 240, 46, { action: () => scr.setScreen(back) });
    W.button('tree', 'Tech Tree', 980, 650, 240, 46, { action: () => scr.openTree('hangar') });
  }

  /* ── ships ── */
  function drawShips(save) {
    const sel = Math.max(0, Math.min(SHIPS.length - 1, G.ui.hangarSel));
    for (let i = 0; i < SHIPS.length; ++i) {
      const s = SHIPS[i];
      const x = 60, y = 90 + i * 108, w = 340, h = 96;
      const owned = save.ships.indexOf(s.id) >= 0;
      const flying = save.ship === s.id;
      const hot = W.area('ship' + i, x, y, w, h, () => {
        G.ui.hangarSel = i;
        if (owned && !flying) { save.ship = s.id; changed(); }
      });
      kit.panel(x, y, w, h, { accent: i === sel ? UI.gold : hot ? '#ffffff' : s.colors.trim, glow: i === sel, brackets: false });
      const colors = s.colors;
      K.blitRot(ctx, NS.shipArt.shipSprite(s.id, 'stock', colors, 0), x + 56, y + h / 2, -Math.PI / 2, 1.25);
      kit.text(s.name, x + 110, y + 30, 20, '#ffffff', { weight: 'bold' });
      kit.text(s.role, x + 110, y + 54, 13, UI.textDim);
      if (flying) kit.text('FLYING', x + w - 18, y + 30, 13, UI.good, { align: 'right', weight: 'bold' });
      else if (owned) kit.text('OWNED', x + w - 18, y + 30, 13, UI.accent, { align: 'right', weight: 'bold' });
      else kit.credits(s.cost, x + w - 18, y + 30, 15, 'right');
      kit.text(s.ability.name, x + 110, y + 76, 12, s.colors.glow, { weight: 'bold' });
    }
    drawShipDetail(SHIPS[sel], save);
  }

  function drawShipDetail(s, save) {
    const x = 430, y = 90, w = 790, h = 540;
    kit.panel(x, y, w, h, { accent: s.colors.trim });
    const colors = save.ship === s.id ? colorsOf(s) : s.colors;
    const cx = x + 230, cy = y + 220;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    K.blit(ctx, K.glow(colors.glow), cx, cy + 10, 4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    /* a hangar pad under the ship */
    ctx.strokeStyle = K.rgba(s.colors.trim, 0.35);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 30, 120 + i * 26, 34 + i * 8, 0, 0, TAU);
      ctx.stroke();
    }
    const bank = Math.sin(G.time * 1.3) * 0.9;
    K.blitRot(ctx, NS.shipArt.shipSprite(s.id, save.ship === s.id ? save.style.skin : 'stock', colors, bank), cx, cy, -Math.PI / 2 + Math.sin(G.time * 0.6) * 0.35, 3.6);
    kit.text(s.name, x + 30, y + 40, 30, '#ffffff', { weight: 'bold' });
    kit.text(s.role, x + 30, y + 70, 14, UI.textDim);
    kit.wrap(s.desc, x + 30, y + 400, 400, 14, 20, UI.text);

    /* stat bars against the best in class */
    const bars = [
      ['Hull', s.hull / 170, UI.hull], ['Shield', s.shield / 100, UI.shield], ['Top speed', s.speed / 520, '#ffd25a'],
      ['Thrust', s.thrust / 2100, '#ffa040'], ['Firepower', s.dmg / 1.35, '#ff5cf0'], ['Dodge', 0.8 / s.roll, '#5cff9a'],
    ];
    for (let i = 0; i < bars.length; ++i) {
      const by = y + 110 + i * 40;
      kit.text(bars[i][0], x + 480, by, 14, UI.textDim);
      kit.bar(x + 580, by - 7, 180, 14, bars[i][1], bars[i][2], { cells: 10 });
    }
    kit.panel(x + 470, y + 360, 300, 110, { accent: s.colors.glow, brackets: false });
    kit.text('SPECIAL  -  ' + s.ability.name.toUpperCase(), x + 488, y + 384, 13, s.colors.glow, { weight: 'bold' });
    kit.wrap(s.ability.desc, x + 488, y + 404, 266, 14, 19, UI.text);
    kit.text('Cooldown ' + s.ability.cd + ' s  -  key E / Q', x + 488, y + 454, 12, UI.textMute);
    if (s.bonus) kit.text('Bonus: wider radar and a free escort drone', x + 30, y + 470, 13, UI.good);

    const owned = save.ships.indexOf(s.id) >= 0;
    if (!owned) {
      const can = save.credits >= s.cost;
      W.button('buyShip', 'Buy for ' + s.cost, x + 470, y + 482, 300, 46, {
        disabled: !can, accent: UI.gold, sub: can ? '' : 'Not enough scrap',
        action: () => { if (rules.buyShip(save, s.id)) { sfx('coin'); sfx('powerup'); changed(); scr.toast(s.name + ' joins your hangar'); } },
      });
    } else if (save.ship !== s.id)
      W.button('flyShip', 'Fly this ship', x + 470, y + 482, 300, 46, { accent: UI.good, action: () => { save.ship = s.id; changed(); } });
    else
      kit.text('Ready for launch', x + 620, y + 505, 16, UI.good, { align: 'center', weight: 'bold' });
  }

  /* ── weapons ── */
  function drawWeapons(save) {
    const sel = G.ui.weaponSel || { kind: 'primary', id: save.loadout.primary };
    G.ui.weaponSel = sel;
    kit.text('PRIMARY  (left mouse / IJKL)', 60, 100, 13, UI.accent, { weight: 'bold' });
    for (let i = 0; i < PRIMARIES.length; ++i) weaponCard(save, 'primary', PRIMARIES[i], 60, 116 + i * 66, sel);
    kit.text('SECONDARY  (right mouse / X)', 400, 100, 13, UI.accent, { weight: 'bold' });
    for (let i = 0; i < SECONDARIES.length; ++i) weaponCard(save, 'secondary', SECONDARIES[i], 400, 116 + i * 66, sel);
    const list = sel.kind === 'primary' ? PRIMARIES : SECONDARIES;
    drawWeaponDetail(save, sel.kind, byId(list, sel.id) || list[0]);
  }

  function weaponCard(save, kind, wpn, x, y, sel) {
    const w = 320, h = 58;
    const owned = (kind === 'primary' ? save.primaries : save.secondaries).indexOf(wpn.id) >= 0;
    const equipped = save.loadout[kind] === wpn.id;
    const isSel = sel.kind === kind && sel.id === wpn.id;
    const hot = W.area(kind + wpn.id, x, y, w, h, () => {
      G.ui.weaponSel = { kind: kind, id: wpn.id };
      if (owned && !equipped) { save.loadout[kind] = wpn.id; changed(); }
    });
    kit.panel(x, y, w, h, { accent: isSel ? UI.gold : hot ? '#ffffff' : UI.accent, glow: isSel, brackets: false, radius: 8 });
    kit.icon(kind === 'primary' ? 'gun' : wpn.id === 'missiles' ? 'missile' : wpn.id === 'mines' ? 'blast' : wpn.id === 'emp' ? 'bolt' : 'drone', x + 28, y + h / 2, 22, owned ? UI.accent : UI.textMute);
    kit.text(wpn.name, x + 56, y + 22, 16, owned ? '#ffffff' : UI.textDim, { weight: 'bold' });
    kit.fitText(wpn.desc, x + 56, y + 42, w - 70, 12, { color: UI.textDim });
    if (equipped) kit.text('EQUIPPED', x + w - 14, y + 20, 11, UI.good, { align: 'right', weight: 'bold' });
    else if (!owned) kit.credits(wpn.cost, x + w - 14, y + 20, 13, 'right');
  }

  function drawWeaponDetail(save, kind, wpn) {
    const x = 740, y = 90, w = 480, h = 540;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.text(wpn.name, x + 26, y + 38, 26, '#ffffff', { weight: 'bold' });
    kit.wrap(wpn.desc, x + 26, y + 62, w - 52, 14, 20, UI.textDim);
    drawDemo(x + 20, y + 110, w - 40, 220, kind, wpn);
    const st = G.stats;
    const rows = [];
    if (kind === 'primary') {
      if (wpn.kind === 'beam') rows.push(['Damage per second', Math.round(wpn.dps * st.dmgMul)], ['Range', wpn.range]);
      else {
        const per = (wpn.dmg * (wpn.count || 1));
        rows.push(['Damage per shot', Math.round(per * st.dmgMul) + (wpn.count > 1 ? '  (' + wpn.count + ' x ' + Math.round(wpn.dmg * st.dmgMul) + ')' : '')]);
        rows.push(['Shots per second', (1 / wpn.rate * st.rateMul).toFixed(1)]);
        if (wpn.pierce) rows.push(['Pierces', wpn.pierce + ' targets']);
        if (wpn.chains) rows.push(['Chains', wpn.chains + ' jumps']);
        if (wpn.frags) rows.push(['Shrapnel', wpn.frags + ' x ' + Math.round(wpn.frag * st.dmgMul)]);
      }
    } else {
      rows.push(['Ammo', Math.round(wpn.ammo * st.ammoMul) + ' per mission']);
      if (wpn.dmg) rows.push(['Damage', Math.round(wpn.dmg * st.secDmg * st.dmgMul)]);
      if (wpn.radius) rows.push(['Blast radius', wpn.radius]);
      if (wpn.stun) rows.push(['Stun', wpn.stun + ' s']);
      if (wpn.life) rows.push(['Drone lifetime', wpn.life + ' s']);
    }
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 26, y + 356 + i * 28, 14, UI.textDim);
      kit.text(String(rows[i][1]), x + w - 26, y + 356 + i * 28, 15, '#ffffff', { align: 'right', weight: 'bold' });
    }
    const owned = (kind === 'primary' ? save.primaries : save.secondaries).indexOf(wpn.id) >= 0;
    if (!owned) {
      const can = save.credits >= wpn.cost;
      W.button('buyWeapon', 'Buy for ' + wpn.cost, x + 90, y + h - 66, w - 180, 48, {
        disabled: !can, accent: UI.gold, sub: can ? '' : 'Not enough scrap',
        action: () => {
          const ok = kind === 'primary' ? rules.buyPrimary(save, wpn.id) : rules.buySecondary(save, wpn.id);
          if (ok) { sfx('coin'); sfx('powerup'); changed(); scr.toast(wpn.name + ' equipped'); }
        },
      });
    } else if (save.loadout[kind] !== wpn.id)
      W.button('equip', 'Equip', x + 90, y + h - 66, w - 180, 48, { accent: UI.good, action: () => { save.loadout[kind] = wpn.id; changed(); } });
    else
      kit.text('Equipped', x + w / 2, y + h - 42, 17, UI.good, { align: 'center', weight: 'bold' });
  }

  /* A looping firing demo: a ship on the left, a target on the right */
  function drawDemo(x, y, w, h, kind, wpn) {
    ctx.save();
    kit.roundRect(x, y, w, h, 10);
    ctx.clip();
    ctx.fillStyle = 'rgba(2,4,12,0.85)';
    ctx.fillRect(x, y, w, h);
    const sx = x + 50, sy = y + h / 2;
    const tx = x + w - 70, ty = y + h / 2 + Math.sin(G.time * 1.5) * 40;
    const ship = byId(SHIPS, G.save.ship) || SHIPS[0];
    K.blitRot(ctx, NS.enemyArt.enemySprite('fighter'), tx, ty, Math.PI, 1);
    K.blitRot(ctx, NS.shipArt.shipSprite(ship.id, G.save.style.skin, colorsOf(ship), 0), sx, sy, 0, 1.2);
    ctx.globalCompositeOperation = 'lighter';
    const t = G.time;
    const a = Math.atan2(ty - sy, tx - sx);
    const dist = Math.sqrt((tx - sx) * (tx - sx) + (ty - sy) * (ty - sy));
    if (kind === 'primary') {
      const ramp = COLORS[wpn.color];
      if (wpn.kind === 'bolt') {
        for (let i = 0; i < 6; ++i) {
          const f = ((t / (wpn.rate * 3) + i / 6) % 1);
          for (let k = 0; k < wpn.count; ++k) {
            const off = wpn.count > 1 ? (k / (wpn.count - 1) - 0.5) * wpn.arc : 0;
            const d = f * dist * 1.1;
            K.blitRot(ctx, K.bolt(wpn.color, ramp, 22, 5), sx + Math.cos(a + off) * d, sy + Math.sin(a + off) * d, a + off, 1);
          }
        }
      } else if (wpn.kind === 'beam') {
        ctx.strokeStyle = 'rgba(255,90,224,0.35)';
        ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(sx + 20, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        K.blit(ctx, K.glow('#ff9af0'), tx, ty, 0.8);
      } else if (wpn.kind === 'rail') {
        const f = (t / wpn.rate) % 1;
        ctx.globalAlpha = 1 - f;
        ctx.strokeStyle = '#d8e8ff';
        ctx.lineWidth = 2 + (1 - f) * 8;
        ctx.beginPath(); ctx.moveTo(sx + 20, sy); ctx.lineTo(x + w, sy + Math.tan(a) * (x + w - sx)); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (wpn.kind === 'flak') {
        const f = (t / (wpn.rate * 2)) % 1;
        if (f < 0.6) K.blit(ctx, K.orb('amber', ramp, 7), sx + Math.cos(a) * dist * f / 0.6, sy + Math.sin(a) * dist * f / 0.6, 1);
        else {
          const k = (f - 0.6) / 0.4;
          for (let i = 0; i < 10; ++i) {
            const fa = i * TAU / 10;
            K.blitRot(ctx, K.bolt('amber', ramp, 10, 3), tx - 40 + Math.cos(fa) * k * 70, ty + Math.sin(fa) * k * 70, fa, 1);
          }
          ctx.globalAlpha = 1 - k;
          K.blit(ctx, K.glow('#ffd27a'), tx - 40, ty, 1.5);
          ctx.globalAlpha = 1;
        }
      } else if (wpn.kind === 'ion') {
        const rng = NS.rng.makeRng(Math.floor(t * 20));
        ctx.strokeStyle = '#a8c8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + 20, sy);
        for (let i = 1; i <= 8; ++i) ctx.lineTo(sx + 20 + (tx - sx - 20) * i / 8 + (rng() - 0.5) * 10, sy + (ty - sy) * i / 8 + (rng() - 0.5) * 26);
        ctx.stroke();
        K.blit(ctx, K.glow('#a8c8ff'), tx, ty, 0.7);
      }
    } else {
      const f = (t * 0.6) % 1;
      if (wpn.id === 'missiles') {
        for (let s = -1; s <= 1; s += 2) {
          const mx = sx + (tx - sx) * f, my = sy + (ty - sy) * f + Math.sin(f * Math.PI) * 60 * s;
          K.blit(ctx, K.glow('#ffb050'), mx, my, 0.5);
        }
      } else if (wpn.id === 'mines') {
        K.blit(ctx, K.glow('#58c8ff'), sx + 80 + f * 60, sy, 0.5);
      } else if (wpn.id === 'emp') {
        ctx.globalAlpha = 1 - f;
        ctx.strokeStyle = '#8ad8ff';
        ctx.lineWidth = 6 * (1 - f);
        ctx.beginPath(); ctx.arc(sx, sy, f * (w - 60), 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const da = t * 2;
        K.blit(ctx, K.glow('#8affe0'), sx + Math.cos(da) * 40, sy + Math.sin(da) * 40, 0.6);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  Object.assign(NS.hangar, {
    draw
  });
})();
