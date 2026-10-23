;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Stateless effect drawers for the battle scenes. Every function takes a
  // progress value p in [0, 1] (or a time) so the scene timeline fully
  // determines what is on screen; particles live in the scene itself.

  const ELEMENTS = Object.freeze({
    fire:      { core: '#fff2a0', main: '#ff7a1a', dark: '#b8260a', particle: ['#ffd24a', '#ff8a2a', '#ff4a1a'] },
    frost:     { core: '#ffffff', main: '#8ad8ff', dark: '#2a78c8', particle: ['#e8f8ff', '#9adcff', '#5aa8e8'] },
    lightning: { core: '#ffffff', main: '#fff27a', dark: '#6a8aff', particle: ['#ffffff', '#fff27a', '#a8c0ff'] },
    acid:      { core: '#f0ffb0', main: '#9ae83a', dark: '#3a8a1a', particle: ['#d8ff7a', '#9ae83a', '#5ab82a'] },
    poison:    { core: '#e8ffd0', main: '#7ac85a', dark: '#3a6a2a', particle: ['#b8e88a', '#7ac85a', '#4a8a3a'] },
    necrotic:  { core: '#e0c8ff', main: '#7a3ab8', dark: '#1a0a2a', particle: ['#b88ae8', '#6a2aa8', '#2a1040'] },
    radiant:   { core: '#ffffff', main: '#ffe68a', dark: '#e8a82a', particle: ['#ffffff', '#fff2b0', '#ffd24a'] },
    arcane:    { core: '#ffffff', main: '#b07aff', dark: '#4a2ab8', particle: ['#e8d8ff', '#b07aff', '#7a4ae8'] },
    force:     { core: '#ffffff', main: '#7ab0ff', dark: '#2a4ab8', particle: ['#d8e8ff', '#7ab0ff', '#4a6ae8'] },
    psychic:   { core: '#fff0ff', main: '#ff7ad8', dark: '#a82a88', particle: ['#ffd8f4', '#ff8ae0', '#c84ab0'] },
    heal:      { core: '#ffffff', main: '#8affb0', dark: '#2aa860', particle: ['#ffffff', '#b0ffd0', '#5ae890'] },
    nature:    { core: '#f0ffd0', main: '#8ad84a', dark: '#4a8a2a', particle: ['#d8ff9a', '#8ad84a', '#5a9a3a'] },
    earth:     { core: '#e8e0d0', main: '#a89a88', dark: '#5a5048', particle: ['#d8d0c0', '#a89a88', '#6a6058'] },
  });

  // Elements travel as a projectile; the others strike in place.
  const PROJECTILE = Object.freeze({ fire: true, frost: true, acid: true, poison: true, necrotic: true, arcane: true, force: true, nature: true });

  const KEYWORDS = [
    [/fire|flame|burn|scorch|inferno|meteor|magma|heat/, 'fire'],
    [/frost|cold|ice|chill|freez|snow|sleet/, 'frost'],
    [/lightning|shock|thunder|storm|electr|spark/, 'lightning'],
    [/acid|corro/, 'acid'],
    [/poison|venom|toxic|stinking|cloudkill/, 'poison'],
    [/cure|heal|restor|regenerat|mending|aid|revivify|raise/, 'heal'],
    [/sacred|radiant|holy|smite|divine|sunbeam|sunburst|daylight|searing|(^|[_ ])light([_ ]|$)/, 'radiant'],
    [/necro|hex|blight|drain|vampir|wither|harm|inflict|death|curse|bane/, 'necrotic'],
    [/missile|force|eldritch|arcane|magic_|bolt/, 'arcane'],
    [/mind|psych|mockery|sleep|charm|confus|fear|illusion|image|dominat|suggest/, 'psychic'],
    [/entangle|thorn|vine|barkskin|druid|goodberry|shillelagh/, 'nature'],
  ];

  // Spells whose names mislead the keyword match (chill touch is necrotic).
  const SPELL_ELEMENTS = Object.freeze({
    chill_touch: 'necrotic', eldritch_blast: 'force', sacred_flame: 'radiant', vicious_mockery: 'psychic',
    divine_smite: 'radiant', ray_of_enfeeblement: 'necrotic', vampiric_touch: 'necrotic', grease: 'nature',
    web: 'nature', hold_person: 'psychic', dispel_magic: 'arcane', haste: 'arcane', invisibility: 'psychic',
    dimension_door: 'arcane', shield_of_faith: 'radiant', light: 'radiant', ice_storm: 'frost',
  });

  const DESCRIPTOR_ELEMENTS = Object.freeze({
    fire: 'fire', cold: 'frost', electricity: 'lightning', acid: 'acid', sonic: 'force', negative: 'necrotic', positive: 'radiant',
    'mind-affecting': 'psychic', light: 'radiant', good: 'radiant', evil: 'necrotic', death: 'necrotic',
    force: 'force', poison: 'poison',
  });

  const SCHOOL_ELEMENTS = Object.freeze({
    necromancy: 'necrotic', restoration: 'heal', evocation: 'arcane', enchantment: 'psychic',
    illusion: 'psychic', conjuration: 'acid', abjuration: 'radiant', transmutation: 'nature',
    divination: 'radiant', telepathy: 'psychic',
  });

  function registrySpell(id) {
    const reg = TR.SpellRegistry;
    if (!reg || !id)
      return null;
    try {
      return typeof reg.getSpell === 'function' ? reg.getSpell(id) : (typeof reg.get === 'function' ? reg.get(id) : null);
    } catch (_) {
      return null;
    }
  }

  // Element of a spell: explicit table, registry damage type, descriptors,
  // name keywords, then school; heals are always 'heal'.
  function elementOf(spell, { heal = false } = {}) {
    if (heal)
      return 'heal';
    if (!spell)
      return 'arcane';
    if (SPELL_ELEMENTS[spell.id])
      return SPELL_ELEMENTS[spell.id];
    const reg = registrySpell(spell.id);
    const dmgType = reg && reg.damage && reg.damage.type;
    if (dmgType && DESCRIPTOR_ELEMENTS[dmgType])
      return DESCRIPTOR_ELEMENTS[dmgType];
    const descriptors = (reg && reg.descriptors) || spell.descriptors || [];
    for (const d of descriptors)
      if (DESCRIPTOR_ELEMENTS[d])
        return DESCRIPTOR_ELEMENTS[d];
    const text = `${spell.id || ''} ${(spell.name || '').toLowerCase()}`;
    for (const [re, el] of KEYWORDS)
      if (re.test(text))
        return el;
    if (spell.healDice > 0 && !(spell.damageDice > 0))
      return 'heal';
    return SCHOOL_ELEMENTS[spell.school] || 'arcane';
  }

  function palette(element) {
    return ELEMENTS[element] || ELEMENTS.arcane;
  }

  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // --- melee -------------------------------------------------------------------

  // Crescent smear left by a weapon swing, centred on (x, y).
  function slash(ctx, x, y, radius, p, facing, color = '#ffffff') {
    if (p <= 0 || p >= 1)
      return;
    const a0 = -2.3, a1 = 0.9;
    const head = a0 + (a1 - a0) * easeOut(clamp01(p * 1.4));
    const tail = a0 + (a1 - a0) * easeOut(clamp01(p * 1.4 - 0.35));
    const fade = 1 - clamp01((p - 0.55) / 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; ++i) {
      ctx.globalAlpha = fade * (0.9 - i * 0.25);
      ctx.strokeStyle = i === 0 ? '#ffffff' : color;
      ctx.lineWidth = (14 - i * 4) * (0.6 + 0.4 * fade);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, radius - i * 10, tail, head);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Comic-style impact burst.
  function impactStar(ctx, x, y, size, p, color = '#fff27a') {
    if (p <= 0 || p >= 1)
      return;
    const s = size * (0.5 + 0.8 * easeOut(p));
    const alpha = 1 - p;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p * 0.6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    const spikes = 10;
    for (let i = 0; i < spikes * 2; ++i) {
      const r = i % 2 ? s * 0.38 : s * (0.9 + (i % 4 === 0 ? 0.25 : 0));
      const a = (i / (spikes * 2)) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function speedLines(ctx, w, h, p, facing) {
    if (p <= 0 || p >= 1)
      return;
    ctx.save();
    ctx.globalAlpha = 0.5 * Math.sin(p * Math.PI);
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 18; ++i) {
      const y = (i * 131) % h;
      const len = 80 + (i * 53) % 160;
      const x = ((i * 211 + p * 2400 * facing) % (w + 400) + w + 400) % (w + 400) - 200;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * facing, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function arrow(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1.7, 1.7);
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(-34, -2, 40, 4);
    ctx.fillStyle = '#e8eef4';
    ctx.beginPath();
    ctx.moveTo(6, -6); ctx.lineTo(18, 0); ctx.lineTo(6, 6); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c84a3a';
    ctx.fillRect(-36, -6, 8, 4);
    ctx.fillRect(-36, 2, 8, 4);
    ctx.restore();
  }

  // --- magic ---------------------------------------------------------------------

  // Rotating rune circle on the ground under a caster.
  function magicCircle(ctx, x, y, radius, t, element, alpha) {
    if (alpha <= 0)
      return;
    const pal = palette(element);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.32);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = pal.main;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(t * 1.6);
    ctx.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = (i / 6) * Math.PI * 2;
      const b = ((i + 2) / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * radius * 0.78, Math.sin(a) * radius * 0.78);
      ctx.lineTo(Math.cos(b) * radius * 0.78, Math.sin(b) * radius * 0.78);
    }
    ctx.stroke();
    ctx.fillStyle = pal.core;
    for (let i = 0; i < 12; ++i) {
      const a = (i / 12) * Math.PI * 2 - t * 3;
      ctx.fillRect(Math.cos(a) * radius * 0.89 - 3, Math.sin(a) * radius * 0.89 - 3, 6, 6);
    }
    ctx.restore();
  }

  // Glowing orb with a trail, travelling along +x (rotate for direction).
  function projectile(ctx, element, x, y, angle, t, scale = 1) {
    const pal = palette(element);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 7; i >= 0; --i) {
      ctx.globalAlpha = 0.12 + (1 - i / 7) * 0.35;
      ctx.fillStyle = i > 3 ? pal.dark : pal.main;
      const r = 20 - i * 1.6 + Math.sin(t * 30 + i) * 2;
      ctx.beginPath();
      ctx.arc(-i * 14, Math.sin(t * 20 + i) * 3, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    if (element === 'frost') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(22, 0); ctx.lineTo(0, -9); ctx.lineTo(-6, 0); ctx.lineTo(0, 9); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Spell impact on the target, p in [0, 1].
  function burst(ctx, element, x, y, p, size = 1) {
    if (p <= 0 || p >= 1)
      return;
    const pal = palette(element);
    const r = 150 * size * easeOut(p);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - p) * 0.9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, pal.core);
    g.addColorStop(0.35, pal.main);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = (1 - p);
    ctx.strokeStyle = pal.core;
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Bolt from the sky (lightning) or a descending column (radiant, psychic).
  function strikeFromAbove(ctx, element, x, groundY, p, t) {
    if (p <= 0 || p >= 1)
      return;
    const pal = palette(element);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (element === 'lightning' && SZ.GameEffects && SZ.GameEffects.drawElectricArc) {
      ctx.globalAlpha = 1 - p * 0.6;
      for (let i = 0; i < 3; ++i)
        SZ.GameEffects.drawElectricArc(ctx, x + (i - 1) * 18, -20, x + Math.sin(t * 40 + i) * 12, groundY - 60, {
          color: i === 1 ? '#ffffff' : pal.main, glowColor: pal.dark, width: i === 1 ? 5 : 3, glowWidth: 14, segments: 14, jitter: 34,
        });
    } else {
      const w = 90 * (1 - Math.abs(p - 0.5) * 1.2);
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, pal.main);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.fillStyle = g;
      ctx.fillRect(x - w, 0, w * 2, groundY);
      ctx.fillStyle = pal.core;
      ctx.fillRect(x - w * 0.12, 0, w * 0.24, groundY);
      if (element === 'psychic') {
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; ++i) {
          const rr = ((p * 3 + i / 4) % 1) * 160;
          ctx.globalAlpha = (1 - rr / 160) * 0.8;
          ctx.beginPath();
          ctx.ellipse(x, groundY - 110, rr, rr * 0.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Soft column of light and rising motes for heals.
  function healLight(ctx, x, groundY, p, t) {
    if (p <= 0 || p >= 1)
      return;
    const pal = palette('heal');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = Math.sin(p * Math.PI);
    const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(160,255,200,${(0.55 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, 0, 180, groundY);
    ctx.fillStyle = pal.core;
    for (let i = 0; i < 26; ++i) {
      const fx = ((i * 37) % 100) / 100;
      const yy = groundY - ((t * 140 + i * 47) % 300);
      ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i)));
      const s = 3 + (i % 3) * 2;
      ctx.fillRect(x - 70 + fx * 140, yy, s, s);
    }
    ctx.restore();
  }

  // --- monster specials ------------------------------------------------------

  // A breath weapon pouring from (x0, y0) toward (x1, y1): a widening cone
  // of puffs, or a crackling line. p in [0, 1].
  function breath(ctx, element, x0, y0, x1, y1, p, shape = 'cone', t = 0) {
    if (p <= 0 || p >= 1)
      return;
    const pal = palette(element);
    const reach = easeOut(clamp01(p * 1.6));
    const fade = 1 - clamp01((p - 0.6) / 0.4);
    const dx = x1 - x0, dy = y1 - y0;
    ctx.save();
    if (shape === 'line') {
      const ex = x0 + dx * reach * 1.25, ey = y0 + dy * reach * 1.25;
      // dark halo, bright body, white-hot core
      for (let i = 0; i < 3; ++i) {
        ctx.globalCompositeOperation = i === 2 ? 'lighter' : 'source-over';
        ctx.globalAlpha = fade * (i === 0 ? 0.45 : 0.9);
        ctx.strokeStyle = i === 0 ? pal.dark : i === 1 ? pal.main : pal.core;
        ctx.lineWidth = i === 0 ? 30 : i === 1 ? 16 : 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        const segs = 10;
        for (let k = 1; k <= segs; ++k) {
          const f = k / segs;
          ctx.lineTo(x0 + (ex - x0) * f, y0 + (ey - y0) * f + Math.sin(t * 40 + k * 1.7) * 6 * (1 - f * 0.3));
        }
        ctx.stroke();
      }
    } else {
      const len = Math.hypot(dx, dy) * 1.2 || 1;
      for (let i = 0; i < 26; ++i) {
        const f = (i / 26) * reach;
        const spread = f * len * 0.42;
        const wob = Math.sin(t * 9 + i * 2.3);
        const px = x0 + dx * f * 1.2 + (-dy / len) * spread * wob;
        const py = y0 + dy * f * 1.2 + (dx / len) * spread * wob;
        const r = 14 + f * 70;
        // the older puffs at the front darken, the fresh ones near the mouth glow
        ctx.globalCompositeOperation = f < 0.35 ? 'lighter' : 'source-over';
        ctx.globalAlpha = fade * (0.6 - f * 0.3);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, f < 0.35 ? pal.core : pal.main);
        g.addColorStop(0.5, f < 0.35 ? pal.main : pal.dark);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // A beam (gazes, eye rays) from (x0, y0) to (x1, y1).
  function beam(ctx, element, x0, y0, x1, y1, p, width = 10) {
    if (p <= 0 || p >= 1)
      return;
    const pal = palette(element);
    const a = Math.sin(p * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; ++i) {
      ctx.globalAlpha = a * (0.9 - i * 0.28);
      ctx.strokeStyle = i === 0 ? pal.core : i === 1 ? pal.main : pal.dark;
      ctx.lineWidth = width * (1 + i);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (x1 - x0) * clamp01(p * 2), y0 + (y1 - y0) * clamp01(p * 2));
      ctx.stroke();
    }
    ctx.restore();
  }

  // A thrown boulder, tumbling.
  function rock(ctx, x, y, size, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#7a7268';
    ctx.beginPath();
    for (let i = 0; i < 9; ++i) {
      const a = (i / 9) * Math.PI * 2;
      const r = size * (0.8 + 0.2 * Math.sin(i * 2.7));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9a9288';
    ctx.fillRect(-size * 0.4, -size * 0.5, size * 0.5, size * 0.25);
    ctx.restore();
  }

  TR.BattleFx = Object.freeze({
    ELEMENTS, PROJECTILE,
    elementOf, palette, isProjectile: el => !!PROJECTILE[el],
    slash, impactStar, speedLines, arrow, magicCircle, projectile, burst, strikeFromAbove, healLight,
    breath, beam, rock,
  });
})();
