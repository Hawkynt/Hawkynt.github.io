;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Illustrated backgrounds and framed widgets for the non-combat screens:
  // title, camp, town, shop, victory and defeat. Built from the battle
  // backdrops and the paper-doll fighters so every screen shares one look.

  const W = 1280;
  const H = 720;

  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);

  // Party members are plain characters; the doll renderer wants units.
  function asUnit(ch, i = 0) {
    return { id: `p${i}`, name: ch.name, faction: 'party', character: ch, currentHp: ch.hp, maxHp: ch.maxHp };
  }

  // --- stages ----------------------------------------------------------------

  // Full-screen backdrop; night darkens it and adds stars.
  function stage(ctx, biome, plane, time, { night = false, pan = 0, dim = 0 } = {}) {
    const BB = TR.BattleBackdrop;
    if (BB) {
      BB.draw(ctx, biome, plane, pan, time, W, H);
      const L = BB.layers(biome, plane);
      if (L && !night)
        BB.drawAmbient(ctx, L.ambient, time, W, H);
    } else {
      ctx.fillStyle = '#141824';
      ctx.fillRect(0, 0, W, H);
    }
    if (night) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#34406e';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 70; ++i) {
        const x = (i * 197.3) % W, y = (i * 61.7) % (H * 0.45);
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.3 + i * 1.7));
        const s = i % 7 === 0 ? 3 : 2;
        ctx.fillRect(Math.round(x), Math.round(y), s, s);
      }
      ctx.globalAlpha = 1;
      if (TR.BattleBackdrop)
        TR.BattleBackdrop.drawAmbient(ctx, 'fireflies', time, W, H);
    }
    if (dim > 0) {
      ctx.fillStyle = `rgba(6,6,14,${dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function vignette(ctx, strength = 0.55, color = '0,0,0') {
    const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.95);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(1, `rgba(${color},${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Crackling fire with logs, glow and sparks; (x, y) is the base.
  function campfire(ctx, x, y, time) {
    ctx.save();
    const flick = 0.85 + 0.15 * Math.sin(time * 11) * Math.sin(time * 7.3);
    const glow = ctx.createRadialGradient(x, y - 30, 10, x, y - 30, 360 * flick);
    glow.addColorStop(0, 'rgba(255,170,70,0.55)');
    glow.addColorStop(0.4, 'rgba(255,110,30,0.18)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(x - 380, y - 400, 760, 520);
    ctx.globalCompositeOperation = 'source-over';
    // stones and logs
    ctx.fillStyle = '#6a6470';
    for (let i = 0; i < 9; ++i) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.fillRect(Math.round(x + Math.cos(a) * 58 - 9), Math.round(y + Math.sin(a) * -12 - 6), 18, 12);
    }
    ctx.fillStyle = '#5a3a22';
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.rotate(0.35);
    ctx.fillRect(-52, -7, 104, 14);
    ctx.rotate(-0.7);
    ctx.fillRect(-52, -7, 104, 14);
    ctx.restore();
    // flames: stacked jittering tongues, pixel-snapped
    const tongues = [['#b8260a', 1.0], ['#ff7a1a', 0.78], ['#ffd24a', 0.52], ['#fff6c0', 0.28]];
    for (const [col, k] of tongues) {
      ctx.fillStyle = col;
      for (let i = -3; i <= 3; ++i) {
        const hh = (70 + 36 * Math.sin(time * 9 + i * 1.9) * Math.sin(time * 5.1 + i)) * k * (1 - Math.abs(i) * 0.12);
        const ww = 16 * k + 6;
        const fx = x + i * 11 * k + Math.sin(time * 13 + i) * 3;
        for (let yy = 0; yy < hh; yy += 4) {
          const t = yy / hh;
          const w = ww * (1 - t * t);
          ctx.fillRect(Math.round(fx - w / 2), Math.round(y - 12 - yy), Math.ceil(w), 4);
        }
      }
    }
    // rising sparks
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 16; ++i) {
      const life = (time * 0.6 + i / 16) % 1;
      ctx.globalAlpha = 1 - life;
      ctx.fillRect(Math.round(x + Math.sin(time * 2 + i * 2.3) * 40 * life), Math.round(y - 60 - life * 220), 4, 4);
    }
    ctx.restore();
  }

  // --- party ------------------------------------------------------------------

  // Draws party dolls on a common ground line; returns their x positions.
  function partyLine(ctx, party, { x = W / 2, footY = 600, spacing = 150, height = 216, time = 0, pose = 'idle', facing = null, hop = 0, gap = 0 } = {}) {
    const BS = TR.BattleSprites;
    const xs = [];
    if (!BS || !party)
      return xs;
    const n = party.length;
    for (let i = 0; i < n; ++i) {
      // with a gap the members stand on both sides of x (around a campfire)
      const px = gap > 0
        ? x + (i % 2 ? 1 : -1) * (gap + Math.floor(i / 2) * spacing)
        : x + (i - (n - 1) / 2) * spacing;
      xs.push(px);
      const face = facing != null ? facing : (px < (gap > 0 ? x : W / 2) ? 1 : -1);
      const bounce = hop > 0 ? Math.abs(Math.sin(time * 5 + i * 1.3)) * hop : 0;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(px, footY + 4, 52 - bounce * 0.3, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // pose is a pose name, or a function (i) => { pose, p, opts } per member
      const ps = typeof pose === 'function' ? pose(i) : { pose, p: pose === 'idle' ? (time * 0.8 + i * 0.37) % 1 : 1 };
      BS.draw(ctx, asUnit(party[i], i), ps.pose, ps.p, px, footY - bounce, height, face, ps.opts || {});
    }
    return xs;
  }

  // Head-and-shoulders crop of a character's doll.
  function portrait(ctx, ch, x, y, size, { bg = null } = {}) {
    const BS = TR.BattleSprites;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    if (bg) {
      const g = ctx.createLinearGradient(0, y, 0, y + size);
      g.addColorStop(0, bg[0]);
      g.addColorStop(1, bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, size, size);
    }
    if (BS)
      BS.draw(ctx, asUnit(ch), 'idle', 0, x + size * 0.5, bustFootY(ch, y, size * 2.4, size * 0.07), size * 2.4, 1);
    ctx.restore();
  }

  // Foot position that puts the top of the head `pad` px below `top`, so
  // the upper body fills a portrait whatever the race's height.
  function bustFootY(ch, top, height, pad) {
    const BS = TR.BattleSprites;
    const unit = ch && ch.character ? ch : asUnit(ch);
    const look = BS ? BS.lookFor(unit) : null;
    const scale = look ? look.scale || 1 : 1;
    const k = Math.max(1, Math.round(height / (BS ? BS.ART_H : 72)));
    return top + pad + 58 * scale * k;
  }

  // Cached portrait image for HTML widgets (combat HUD); null until the
  // unit's art is available.
  const _portraits = new Map();

  function portraitURL(unit, size = 40) {
    const BS = TR.BattleSprites;
    if (!BS || !unit || typeof document === 'undefined')
      return null;
    const ch = unit.character || {};
    const key = `${unit.faction}|${ch.class}|${ch.race || ''}|${size}`;
    if (_portraits.has(key))
      return _portraits.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx || typeof c.toDataURL !== 'function')
      return null;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, unit.faction === 'party' ? '#2a3a6a' : '#6a2a2a');
    g.addColorStop(1, '#10121e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    let drawn;
    if (BS.hasDoll(unit))
      drawn = BS.draw(ctx, unit, 'idle', 0, size / 2, bustFootY(unit, 0, size * 2.4, size * 0.07), size * 2.4, 1);
    else {
      // icons: fill the frame whatever the creature's size
      const scale = BS.sizeScale ? BS.sizeScale(ch) : 0.8;
      drawn = BS.draw(ctx, unit, 'idle', 0, size / 2, size * 0.98, size * 0.96 / scale, 1);
    }
    if (!drawn || drawn.kind === 'circle')
      return null;
    let url = null;
    try {
      url = c.toDataURL();
    } catch (_) {
      url = null;          // tainted canvas when opened from file://
    }
    _portraits.set(key, url);
    return url;
  }

  // --- widgets -------------------------------------------------------------------

  function frame(ctx, x, y, w, h, { alpha = 0.94, accent = '#c8a24e' } = {}) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(26,30,64,${alpha})`);
    g.addColorStop(1, `rgba(10,12,30,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = 'rgba(255,236,170,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
    ctx.fillStyle = accent;
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]])
      ctx.fillRect(cx - 4, cy - 4, 8, 8);
  }

  // Gold frame around an area that is already drawn (the combat board).
  function border(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = '#2a1e10';
    ctx.lineWidth = 10;
    ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
    ctx.restore();
    ctx.strokeStyle = '#c8a24e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 5.5, y - 5.5, w + 11, h + 11);
    ctx.strokeStyle = 'rgba(255,236,170,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    ctx.fillStyle = '#c8a24e';
    for (const [cx, cy] of [[x - 5, y - 5], [x + w + 5, y - 5], [x - 5, y + h + 5], [x + w + 5, y + h + 5]])
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
  }

  function banner(ctx, text, y, { size = 40, color = '#f0d890', sub = null } = {}) {
    ctx.save();
    ctx.font = '15px monospace';
    const subW = sub ? ctx.measureText(sub).width : 0;
    ctx.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
    const tw = Math.max(ctx.measureText(text).width, subW, 200) + 80;
    const h = size + (sub ? 34 : 22);
    frame(ctx, W / 2 - tw / 2, y, tw, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y + size + 4);
    if (sub) {
      ctx.fillStyle = '#b8c0d8';
      ctx.font = '15px monospace';
      ctx.fillText(sub, W / 2, y + size + 26);
    }
    ctx.restore();
  }

  // Party roster panel: portrait, name, class and HP bar per member.
  function rosterPanel(ctx, party, hps, x, y, { w = 330 } = {}) {
    if (!party)
      return;
    const rowH = 74;
    frame(ctx, x, y, w, 18 + party.length * rowH);
    for (let i = 0; i < party.length; ++i) {
      const c = party[i];
      const hp = hps ? hps[i] : c.hp;
      const ry = y + 12 + i * rowH;
      portrait(ctx, c, x + 14, ry + 4, 58, { bg: ['#2a3a5a', '#141a2c'] });
      ctx.strokeStyle = '#c8a24e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 14, ry + 4, 58, 58);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8e0c8';
      ctx.font = "bold 17px Georgia, 'Times New Roman', serif";
      ctx.fillText(c.name, x + 84, ry + 24);
      ctx.fillStyle = '#9aa4c0';
      ctx.font = '12px monospace';
      ctx.fillText(`Lv ${c.level || 1} ${cap(c.race)} ${cap(c.class)}`, x + 84, ry + 40);
      const bx = x + 84, by = ry + 48, bw = w - 100, bh = 9;
      const ratio = clamp01(hp / (c.maxHp || 1));
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#3a1418';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = ratio > 0.5 ? '#46d468' : ratio > 0.25 ? '#e8c440' : '#e84838';
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.fillStyle = '#f0ecdc';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${hp}/${c.maxHp}`, x + w - 16, ry + 40);
    }
    ctx.textAlign = 'left';
  }

  function cap(s) {
    return String(s || '').split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Vertical menu in a frame; buttons are { x, y, w, h, label, accent }.
  function menu(ctx, buttons, { hover = -1, title = null } = {}) {
    if (!buttons.length)
      return;
    const x0 = buttons[0].x - 18, y0 = buttons[0].y - (title ? 50 : 18);
    const last = buttons[buttons.length - 1];
    frame(ctx, x0, y0, buttons[0].w + 36, last.y + last.h + 18 - y0);
    if (title) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0d890';
      ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
      ctx.fillText(title, x0 + (buttons[0].w + 36) / 2, y0 + 32);
    }
    buttons.forEach((b, i) => button(ctx, b.x, b.y, b.w, b.h, b.label, { accent: b.accent, hover: i === hover }));
  }

  function button(ctx, x, y, w, h, label, { accent = null, hover = false, font = null } = {}) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, hover ? '#3a4a8a' : '#2a3264');
    g.addColorStop(1, hover ? '#1e2650' : '#141a3a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 6, h);
    }
    ctx.strokeStyle = hover ? '#ffe08a' : '#8a7440';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 2, y + 2, w - 4, h * 0.4);
    ctx.fillStyle = '#f0ead8';
    ctx.font = font || "bold 16px Georgia, 'Times New Roman', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Diagonal wipe that reveals a new screen, p in [0, 1].
  function reveal(ctx, p) {
    if (p >= 1)
      return;
    const bands = 12;
    const bw = (W + H) / bands;
    ctx.save();
    ctx.fillStyle = '#05040a';
    for (let i = 0; i < bands; ++i) {
      const local = clamp01(p * 1.6 - (i / bands) * 0.6);
      const cover = 1 - local;
      if (cover <= 0)
        continue;
      ctx.beginPath();
      const x = i * bw - H;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + bw * cover, 0);
      ctx.lineTo(x + bw * cover + H, H);
      ctx.lineTo(x + H, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // --- confetti for the victory screen (frame-stepped) -------------------------

  let _confetti = null;
  let _confettiT = -1;

  function confetti(ctx, time) {
    const GE = SZ.GameEffects;
    if (!GE)
      return;
    if (!_confetti || time < _confettiT) {
      _confetti = new GE.ParticleSystem();
      _confettiT = 0;
    }
    while (_confettiT < time) {
      _confettiT += 1 / 60;
      // two cannons in the bottom corners
      const frame = Math.floor(_confettiT * 60);
      if (_confettiT < 2.2 && frame % 5 === 0)
        _confetti.confetti(frame % 10 ? 40 : W - 40, H - 20, 8, { colors: ['#ffd24a', '#ff7a5a', '#7ad8ff', '#a8ff8a', '#e08aff'], speed: 13, gravity: 0.16 });
      _confetti.update();
    }
    _confetti.draw(ctx);
  }

  // --- item icons from the dungeon sheet -------------------------------------------

  const ITEM_TILES = [
    [/greatsword/i, 106], [/dagger|knife/i, 103], [/rapier|sword|blade|scimitar/i, 104],
    [/axe/i, 118], [/hammer|mace|flail|club|morning/i, 117], [/staff|wand|rod/i, 130],
    [/greater healing/i, 127], [/healing|cure/i, 115], [/mana/i, 116], [/antidote|poison/i, 114],
    [/elixir|potion/i, 113], [/scroll/i, 131], [/ring|amulet|cloak|boots|necklace/i, 101],
    [/shield|buckler/i, 102],
  ];
  const CATEGORY_TILES = Object.freeze({ weapon: 104, armor: 102, shield: 102, accessory: 101, consumable: 113 });

  function itemIcon(ctx, assets, item, x, y, size) {
    const img = assets && assets.get ? assets.get('dungeon') : null;
    if (!img || !TR.sheetRect || !item)
      return false;
    let idx = CATEGORY_TILES[item.category] || 89;
    for (const [re, i] of ITEM_TILES)
      if (re.test(item.name || '')) {
        idx = i;
        break;
      }
    const r = TR.sheetRect(idx, 'dungeon');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, x, y, size, size);
    return true;
  }

  TR.ScreenArt = Object.freeze({
    itemIcon,
    W, H, asUnit, bustFootY, portraitURL, stage, vignette, campfire, partyLine, portrait,
    frame, border, banner, rosterPanel, menu, button, reveal, confetti,
  });
})();
