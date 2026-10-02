;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Large side-view fighters for the battle scenes.
  //
  // Humanoids are "paper dolls": legs, torso, arms, head, headgear, cape,
  // shield and weapon are drawn with vector shapes onto a small canvas
  // (one unit = one art pixel), then hardened into pixel art (alpha cut,
  // dark outline) and scaled up with nearest-neighbour. Every class, race
  // and humanoid monster is a different set of parts and colours. Creatures
  // without a doll use their resolved icon or sheet sprite instead.

  const ART_W = 72;          // doll canvas, art pixels
  const ART_H = 72;
  const FOOT_Y = 68;
  const OUTLINE = '#1c1222';
  const POSE_FRAMES = 8;     // cache steps per pose

  // --- looks -------------------------------------------------------------

  const SKIN = Object.freeze({
    light: '#f1c49c', tan: '#d69a6c', brown: '#9c6541', dark: '#6b4430',
    green: '#7fae54', grey: '#a9b2b8', red: '#c8563c', pale: '#c9d6de',
    orange: '#d8844a', blue: '#7fa0c8',
  });

  const CLASS_LOOKS = Object.freeze({
    fighter:   { body: 'mail', bodyColor: '#8d99a8', trim: '#c9a13b', legs: '#5a4636', headgear: 'none', weapon: 'sword', shield: '#8a4a2a', cape: null },
    paladin:   { body: 'plate', bodyColor: '#c9d2dc', trim: '#e8c14a', legs: '#8f99a6', headgear: 'helm', weapon: 'sword', shield: '#2f5aa8', cape: '#2f5aa8' },
    barbarian: { body: 'bare', bodyColor: null, trim: '#7a5230', legs: '#6b4a2e', headgear: 'none', hair: 'wild', weapon: 'greataxe', shield: null, cape: '#8a6a44' },
    ranger:    { body: 'leather', bodyColor: '#4f7a3a', trim: '#8a6a3a', legs: '#4a3a2a', headgear: 'hood', hoodColor: '#3d6a2e', weapon: 'bow', shield: null, cape: '#3d6a2e' },
    rogue:     { body: 'leather', bodyColor: '#3b3446', trim: '#8f7a5a', legs: '#2c2834', headgear: 'bandana', hoodColor: '#8e2f2f', weapon: 'dagger', shield: null, cape: null },
    wizard:    { body: 'robe', bodyColor: '#5a3f9c', trim: '#e3c65a', legs: '#5a3f9c', headgear: 'wizard_hat', hoodColor: '#5a3f9c', beard: '#e8e8f0', weapon: 'staff', gem: '#6fe0ff', shield: null, cape: null },
    sorcerer:  { body: 'robe', bodyColor: '#a8323a', trim: '#f0b44a', legs: '#6e1e28', headgear: 'circlet', weapon: 'orb', gem: '#ff9a3a', shield: null, cape: '#6e1e28' },
    warlock:   { body: 'robe', bodyColor: '#2d2238', trim: '#9b5ad6', legs: '#1f1828', headgear: 'hood', hoodColor: '#241b30', eyes: '#c77dff', weapon: 'rod', gem: '#c77dff', shield: null, cape: '#1f1828' },
    cleric:    { body: 'robe', bodyColor: '#ece6d6', trim: '#d9aa3a', legs: '#bdb4a0', headgear: 'none', weapon: 'mace', shield: '#d9aa3a', cape: null },
    bard:      { body: 'doublet', bodyColor: '#c4523a', trim: '#f2d36b', legs: '#34507a', headgear: 'cap', hoodColor: '#34507a', feather: '#f2f2f2', weapon: 'rapier', shield: null, cape: '#e0a23a' },
    druid:     { body: 'robe', bodyColor: '#6b7a3a', trim: '#b58a4a', legs: '#4f5a2a', headgear: 'circlet', weapon: 'staff', gem: '#8ae07a', shield: null, cape: '#4a3a24' },
    monk:      { body: 'tunic', bodyColor: '#d98a2a', trim: '#6b3a1a', legs: '#6b3a1a', headgear: 'none', hair: 'bald', weapon: 'none', shield: null, cape: null },
  });

  const DEFAULT_LOOK = Object.freeze({ body: 'tunic', bodyColor: '#6a7a8e', trim: '#b89a5a', legs: '#4a3c30', headgear: 'none', weapon: 'sword', shield: null, cape: null });

  const RACE_LOOKS = Object.freeze({
    human:    { skin: 'light', hairColor: '#6b4428', scale: 1, width: 1 },
    elf:      { skin: 'light', hairColor: '#e8d27a', scale: 1.06, width: 0.9, ears: true, hair: 'long' },
    half_elf: { skin: 'light', hairColor: '#3a2a22', scale: 1.02, width: 0.95, ears: true },
    dwarf:    { skin: 'tan', hairColor: '#b8542a', scale: 0.82, width: 1.2, beard: '#b8542a' },
    halfling: { skin: 'light', hairColor: '#8a5a2a', scale: 0.72, width: 1 },
    gnome:    { skin: 'light', hairColor: '#e8e8e8', scale: 0.7, width: 0.95, ears: true },
    half_orc: { skin: 'green', hairColor: '#1a1a1a', scale: 1.05, width: 1.12, tusks: true },
    orc:      { skin: 'green', hairColor: '#1a1a1a', scale: 1.05, width: 1.15, tusks: true },
    tiefling: { skin: 'red', hairColor: '#2a1830', scale: 1, width: 1, horns: '#3a2a3a', eyes: '#ffd84a' },
    dragonborn: { skin: 'orange', hairColor: null, scale: 1.08, width: 1.12, horns: '#e8d2a0', hair: 'bald' },
    aasimar:  { skin: 'light', hairColor: '#f4f0d8', scale: 1.02, width: 1, eyes: '#fff6b0' },
    goliath:  { skin: 'grey', hairColor: null, scale: 1.18, width: 1.2, hair: 'bald' },
  });

  // Humanoid enemies that have no fitting icon get a doll of their own.
  const MONSTER_LOOKS = Object.freeze({
    bandit:     { skin: 'tan', body: 'leather', bodyColor: '#6a4a32', trim: '#3a2a1e', legs: '#3a3024', headgear: 'bandana', hoodColor: '#3d7a3a', weapon: 'dagger', beard: '#4a3020', hairColor: '#4a3020' },
    hobgoblin:  { skin: 'orange', body: 'mail', bodyColor: '#6f6250', trim: '#a8322a', legs: '#4a3a2a', headgear: 'helm', weapon: 'sword', shield: '#a8322a', hairColor: '#1a1a1a', ears: true, tusks: true, scale: 1.05, width: 1.1 },
    dark_mage:  { skin: 'pale', body: 'robe', bodyColor: '#1e1a2a', trim: '#8a2ad6', legs: '#1e1a2a', headgear: 'hood', hoodColor: '#16121e', eyes: '#ff4a6a', weapon: 'staff', gem: '#ff3a5a', cape: '#2a0e1e' },
    wight:      { skin: 'pale', body: 'mail', bodyColor: '#5a5e62', trim: '#3a3e42', legs: '#3a3e42', headgear: 'helm', eyes: '#7ae0ff', weapon: 'sword', shield: null, cape: '#2a2e38', hairColor: '#d8dde2', scale: 1.02 },
    hill_giant: { skin: 'tan', body: 'bare', bodyColor: null, trim: '#6b4a2e', legs: '#6b4a2e', headgear: 'none', hair: 'wild', hairColor: '#4a3020', beard: '#4a3020', weapon: 'club', scale: 1.4, width: 1.35 },
  });

  function lookFor(unit) {
    const ch = unit && unit.character ? unit.character : {};
    const cls = ch.class || '';
    if (unit && unit.faction !== 'party') {
      const m = MONSTER_LOOKS[cls];
      if (!m)
        return null;
      return { ...DEFAULT_LOOK, scale: 1, width: 1, hair: 'short', hairColor: '#3a2a22', ...m, skinColor: SKIN[m.skin] || SKIN.tan, key: 'm:' + cls };
    }
    const cl = CLASS_LOOKS[cls] || DEFAULT_LOOK;
    const race = RACE_LOOKS[ch.race] || RACE_LOOKS[(ch.race || '').replace(/-/g, '_')] || RACE_LOOKS.human;
    const look = { ...DEFAULT_LOOK, hair: 'short', ...race, ...cl };
    // class choices win for gear, race for body; keep race features the class does not override
    look.hair = cl.hair || race.hair || 'short';
    look.beard = cl.beard || race.beard || null;
    look.eyes = cl.eyes || race.eyes || null;
    look.skinColor = SKIN[race.skin] || SKIN.light;
    look.key = `p:${cls}:${ch.race || 'human'}`;
    return look;
  }

  // --- poses ---------------------------------------------------------------
  // Angles are radians from "hanging straight down", positive = swung forward.

  const POSES = Object.freeze({
    idle:   p => ({ lean: 0.02, front: 0.45 + Math.sin(p * Math.PI * 2) * 0.05, back: -0.25, wpn: 2.2, stride: 0.18, crouch: Math.sin(p * Math.PI * 2) * 0.6, head: 0 }),
    ready:  () => ({ lean: 0.1, front: 0.9, back: 0.2, wpn: 1.9, stride: 0.35, crouch: 1.5, head: 0.05 }),
    windup: p => ({ lean: -0.18 * p, front: 0.9 + 2.2 * p, back: -0.5 * p, wpn: 1.6 - 0.4 * p, stride: 0.35, crouch: 2 * p, head: -0.05 }),
    dash:   () => ({ lean: 0.35, front: 2.9, back: -0.9, wpn: 1.2, stride: 0.9, crouch: 2, head: 0.1 }),
    strike: p => ({ lean: 0.1 + 0.3 * p, front: 3.0 - 2.9 * p, back: -0.8, wpn: 1.2 + 0.4 * p, stride: 0.75, crouch: 3 * p, head: 0.15 }),
    recoil: p => ({ lean: 0.3 - 0.28 * p, front: 0.1 + 0.4 * p, back: -0.6 + 0.3 * p, wpn: 1.8, stride: 0.6 - 0.4 * p, crouch: 2 - 2 * p, head: 0.05 }),
    hit:    p => ({ lean: -0.4 * (1 - p * 0.5), front: 1.2, back: -1.2, wpn: 2.4, stride: 0.5, crouch: 1, head: -0.35 }),
    dodge:  p => ({ lean: -0.35 * Math.sin(p * Math.PI), front: 0.2, back: -0.6, wpn: 2.2, stride: 0.6, crouch: 4 * Math.sin(p * Math.PI), head: -0.1 }),
    cast:   p => ({ lean: -0.05 + 0.12 * p, front: 1.4 + 1.0 * p, back: 1.2 + 0.9 * p, wpn: 1.9 - 0.6 * p, stride: 0.3, crouch: -1.5 * p, head: -0.1 * p }),
    shoot:  p => ({ lean: -0.05, front: 1.57, back: 1.45 + 0.1 * (1 - p), draw: 1 - p, wpn: 0, stride: 0.45, crouch: 1, head: 0 }),
    down:   () => ({ lean: -0.5, front: 1.6, back: -1.6, wpn: 2.6, stride: 0.9, crouch: 6, head: -0.5 }),
  });

  function poseParams(pose, p) {
    return (POSES[pose] || POSES.idle)(Math.max(0, Math.min(1, p || 0)));
  }

  // --- drawing -------------------------------------------------------------

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function limb(ctx, x, y, angle, len, width, color) {
    const ex = x + Math.sin(angle) * len;
    const ey = y + Math.cos(angle) * len;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    return { x: ex, y: ey };
  }

  function drawWeapon(ctx, look, hand, angle, pose) {
    const w = look.weapon;
    if (!w || w === 'none')
      return;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    // weapon axis: along the arm, then turned by the pose's wrist angle
    ctx.rotate(-angle);
    ctx.lineCap = 'butt';
    const steel = '#dfe6ee';
    const wood = '#7a5230';
    if (w === 'sword' || w === 'rapier') {
      const len = w === 'rapier' ? 22 : 19;
      ctx.fillStyle = shade('#7a5230', 1);
      ctx.fillRect(-1, -4, 2, 5);                        // grip
      ctx.fillStyle = look.trim || '#c9a13b';
      ctx.fillRect(-4, 0, 8, 2);                         // guard
      ctx.fillStyle = steel;
      ctx.fillRect(w === 'rapier' ? -0.75 : -1.5, 2, w === 'rapier' ? 1.5 : 3, len);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.5, 3, 1, len - 3);                 // edge glint
    } else if (w === 'dagger') {
      ctx.fillStyle = wood;
      ctx.fillRect(-1, -3, 2, 4);
      ctx.fillStyle = '#b0b8c0';
      ctx.fillRect(-3, 0, 6, 1.5);
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.moveTo(-1.5, 1.5); ctx.lineTo(1.5, 1.5); ctx.lineTo(0, 11); ctx.closePath();
      ctx.fill();
    } else if (w === 'greataxe') {
      ctx.fillStyle = wood;
      ctx.fillRect(-1.2, -8, 2.4, 30);
      ctx.fillStyle = '#b8c2cc';
      ctx.beginPath();
      ctx.moveTo(1, 14); ctx.quadraticCurveTo(12, 12, 10, 24); ctx.quadraticCurveTo(6, 20, 1, 21); ctx.closePath();
      ctx.moveTo(-1, 15); ctx.quadraticCurveTo(-8, 15, -7, 22); ctx.lineTo(-1, 20); ctx.closePath();
      ctx.fill();
    } else if (w === 'club') {
      ctx.fillStyle = '#6b4a2a';
      ctx.beginPath();
      ctx.moveTo(-1.5, -3); ctx.lineTo(1.5, -3); ctx.lineTo(4, 20); ctx.quadraticCurveTo(0, 25, -4, 20); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-1, 8, 1.5, 3);
    } else if (w === 'mace') {
      ctx.fillStyle = wood;
      ctx.fillRect(-1, -3, 2, 15);
      ctx.fillStyle = '#b8c2cc';
      ctx.beginPath();
      ctx.arc(0, 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8eef4';
      ctx.fillRect(-5, 13, 10, 2);
      ctx.fillRect(-1, 9, 2, 10);
    } else if (w === 'staff' || w === 'rod') {
      const len = w === 'staff' ? 30 : 14;
      ctx.fillStyle = w === 'staff' ? '#8a6238' : '#3a2a44';
      ctx.fillRect(-1.2, w === 'staff' ? -12 : -2, 2.4, len);
      ctx.fillStyle = look.gem || '#6fe0ff';
      ctx.beginPath();
      ctx.arc(0, (w === 'staff' ? -12 : -2) + len + 2, w === 'staff' ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (w === 'orb') {
      ctx.fillStyle = look.gem || '#ff9a3a';
      ctx.beginPath();
      ctx.arc(0, 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4d0';
      ctx.fillRect(-1.5, 1.5, 2, 2);
    } else if (w === 'bow') {
      // held upright in the front hand regardless of arm angle
      ctx.rotate(angle);
      ctx.strokeStyle = '#8a5a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-6, 0, 14, -1.05, 1.05);
      ctx.stroke();
      const pull = pose && pose.draw ? pose.draw * 7 : 0;
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(1, -12); ctx.lineTo(1 - pull, 0); ctx.lineTo(1, 12);
      ctx.stroke();
      if (pull > 0.5) {
        ctx.fillStyle = '#d8d0b8';
        ctx.fillRect(1 - pull, -0.6, 16, 1.2);
        ctx.fillStyle = steel;
        ctx.fillRect(16 - pull, -1.2, 3, 2.4);
      }
    }
    ctx.restore();
  }

  function drawHead(ctx, look, x, y, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const skin = look.skinColor;
    // hair behind the head
    if (look.hair === 'long' && look.hairColor) {
      ctx.fillStyle = look.hairColor;
      ctx.fillRect(-7, -4, 6, 13);
    }
    if (look.hair === 'wild' && look.hairColor) {
      ctx.fillStyle = look.hairColor;
      ctx.beginPath();
      ctx.moveTo(-9, 6); ctx.lineTo(-10, -2); ctx.lineTo(-6, -9); ctx.lineTo(0, -10); ctx.lineTo(6, -8); ctx.lineTo(3, 0); ctx.closePath();
      ctx.fill();
    }
    // face
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(3, -1, 4, 4);                          // nose/jaw forward
    if (look.ears) {
      ctx.beginPath();
      ctx.moveTo(-2, -1); ctx.lineTo(-8, -6); ctx.lineTo(-3, 3); ctx.closePath();
      ctx.fill();
    }
    // eyes
    ctx.fillStyle = look.eyes || '#1a1420';
    ctx.fillRect(2.5, -2.5, 2, look.eyes ? 2 : 2.5);
    if (look.tusks) {
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(4.5, 3, 1, 2);
    }
    if (look.beard) {
      ctx.fillStyle = look.beard;
      ctx.beginPath();
      ctx.moveTo(-3, 2); ctx.lineTo(7, 2); ctx.lineTo(4, 11); ctx.lineTo(-1, 9); ctx.closePath();
      ctx.fill();
    }
    // hair on top
    if ((look.hair === 'short' || look.hair === 'long') && look.hairColor && look.headgear !== 'helm' && look.headgear !== 'hood' && look.headgear !== 'wizard_hat') {
      ctx.fillStyle = look.hairColor;
      ctx.beginPath();
      ctx.ellipse(-1, -4, 6.8, 4.5, -0.2, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-7, -4, 4, 5);
    }
    if (look.horns) {
      ctx.fillStyle = look.horns;
      ctx.beginPath();
      ctx.moveTo(-1, -6); ctx.quadraticCurveTo(-6, -14, -10, -10); ctx.lineTo(-4, -5); ctx.closePath();
      ctx.fill();
    }
    // headgear
    const hg = look.headgear;
    if (hg === 'helm') {
      ctx.fillStyle = look.bodyColor && look.body === 'plate' ? look.bodyColor : '#9aa4ae';
      ctx.beginPath();
      ctx.ellipse(0, -1, 7.4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20182a';
      ctx.fillRect(1, -2, 7, 1.5);                     // visor slit
      ctx.fillStyle = look.trim || '#e8c14a';
      ctx.fillRect(-1, -9, 2, 6);                      // crest
    } else if (hg === 'hood') {
      ctx.fillStyle = look.hoodColor || '#3d6a2e';
      ctx.beginPath();
      ctx.moveTo(-8, 8); ctx.lineTo(-8, -3); ctx.quadraticCurveTo(-4, -12, 5, -8); ctx.lineTo(7, -3); ctx.lineTo(1, -4); ctx.lineTo(-1, 8); ctx.closePath();
      ctx.fill();
      if (look.eyes) {
        ctx.fillStyle = look.eyes;
        ctx.fillRect(2.5, -2.5, 2, 2);
      }
    } else if (hg === 'wizard_hat') {
      ctx.fillStyle = look.hoodColor || '#5a3f9c';
      ctx.fillRect(-9, -6, 17, 2.5);                   // brim
      ctx.beginPath();
      ctx.moveTo(-6, -5); ctx.lineTo(5, -5); ctx.lineTo(-7, -20); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = look.trim || '#e3c65a';
      ctx.fillRect(-5, -8, 9, 1.5);
    } else if (hg === 'bandana') {
      ctx.fillStyle = look.hoodColor || '#8e2f2f';
      ctx.beginPath();
      ctx.ellipse(-0.5, -4, 6.8, 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-10, -4, 5, 2);
      ctx.fillRect(-11, -3, 3, 4);
    } else if (hg === 'cap') {
      ctx.fillStyle = look.hoodColor || '#34507a';
      ctx.beginPath();
      ctx.ellipse(0, -5, 7.5, 3.6, -0.15, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-7, -6, 13, 2);
      if (look.feather) {
        ctx.strokeStyle = look.feather;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-3, -7); ctx.quadraticCurveTo(-9, -14, -14, -9);
        ctx.stroke();
      }
    } else if (hg === 'circlet') {
      ctx.fillStyle = look.trim || '#e3c65a';
      ctx.fillRect(-6, -5, 12, 1.5);
      ctx.fillStyle = look.gem || '#6fe0ff';
      ctx.fillRect(3, -6, 2, 2);
    }
    ctx.restore();
  }

  // Canvas size grows with the body so giants are not clipped.
  function dollSize(look) {
    const g = Math.max(1, look.scale || 1);
    return { w: Math.ceil(ART_W * g), h: Math.ceil(ART_H * g) };
  }

  function drawDoll(ctx, look, pose) {
    const s = look.scale || 1;
    const wf = look.width || 1;
    const size = dollSize(look);
    ctx.save();
    ctx.translate(size.w / 2 - 4, size.h - (ART_H - FOOT_Y));
    ctx.scale(s, s);
    const skin = look.skinColor;
    const bodyCol = look.body === 'bare' ? skin : (look.bodyColor || '#6a7a8e');
    const legCol = look.legs || '#4a3c30';
    const hipY = -22 + pose.crouch;
    const stride = pose.stride;

    // cape behind everything
    if (look.cape) {
      ctx.fillStyle = shade(look.cape, 0.8);
      ctx.beginPath();
      ctx.moveTo(-3, hipY - 16);
      ctx.quadraticCurveTo(-14 - pose.lean * 10, hipY, -12 - pose.lean * 14, -2);
      ctx.lineTo(-2, hipY + 2);
      ctx.closePath();
      ctx.fill();
    }

    // back leg, back arm (darker, behind the torso)
    const legLen = 12 - pose.crouch * 0.3;
    const backKnee = limb(ctx, -1.5 * wf, hipY, -stride, legLen, 5 * wf, shade(legCol.startsWith('#') ? legCol : '#4a3c30', 0.7));
    limb(ctx, backKnee.x, backKnee.y, -stride * 0.3, legLen - 1, 4.5 * wf, shade(legCol.startsWith('#') ? legCol : '#4a3c30', 0.7));
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(backKnee.x + Math.sin(-stride * 0.3) * (legLen - 1) - 2, -2.5, 6, 3);

    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(pose.lean);
    const shoulderY = -15;
    const backShoulder = { x: -2, y: shoulderY + 1 };
    const backArmCol = look.body === 'bare' || look.body === 'tunic' ? shade(skin, 0.75) : shade(bodyCol, 0.7);
    const backHand = limb(ctx, backShoulder.x, backShoulder.y, pose.back, 12, 4 * wf, backArmCol);
    if (look.weapon === 'bow') {
      ctx.fillStyle = shade(skin, 0.75);
      ctx.fillRect(backHand.x - 1.5, backHand.y - 1.5, 3, 3);
    }
    ctx.restore();

    // front leg
    const frontKnee = limb(ctx, 1.5 * wf, hipY, stride, legLen, 5.5 * wf, legCol);
    const shin = limb(ctx, frontKnee.x, frontKnee.y, stride * 0.2, legLen - 1, 5 * wf, legCol);
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(shin.x - 2, -2.8, 7, 3.2);

    // torso
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(pose.lean);
    const tw = 12 * wf;
    if (look.body === 'robe') {
      ctx.fillStyle = shade(bodyCol, 0.9);
      ctx.beginPath();
      ctx.moveTo(-tw / 2, -16); ctx.lineTo(tw / 2 + 1, -16); ctx.lineTo(tw / 2 + 5, 20 - pose.crouch); ctx.lineTo(-tw / 2 - 5, 20 - pose.crouch); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = look.trim || '#e3c65a';
      ctx.fillRect(-tw / 2 - 5, 18 - pose.crouch, tw + 10, 2);
      ctx.fillRect(1, -16, 2, 36 - pose.crouch);
    }
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.moveTo(-tw / 2, -17); ctx.lineTo(tw / 2 + 1, -17); ctx.lineTo(tw / 2, 1); ctx.lineTo(-tw / 2, 1); ctx.closePath();
    ctx.fill();
    if (look.body === 'plate' || look.body === 'mail') {
      ctx.fillStyle = shade(bodyCol, 1.18);
      ctx.fillRect(-tw / 2 + 2, -15, tw - 3, 4);
      ctx.fillStyle = shade(bodyCol, 0.8);
      for (let y = -9; y < 0; y += 3)
        ctx.fillRect(-tw / 2 + 1, y, tw - 1, 1);
      ctx.fillStyle = shade(bodyCol, 1.1);
      ctx.beginPath();
      ctx.ellipse(-tw / 2 + 2, -16, 5, 3.5, 0, 0, Math.PI * 2);    // pauldron
      ctx.fill();
    } else if (look.body === 'bare') {
      ctx.fillStyle = shade(skin, 0.85);
      ctx.fillRect(1, -12, 3, 1);
      ctx.fillRect(-2, -7, 6, 1);
      ctx.fillStyle = look.trim || '#7a5230';
      ctx.beginPath();
      ctx.moveTo(-tw / 2, -17); ctx.lineTo(-tw / 2 + 3, -17); ctx.lineTo(tw / 2, -2); ctx.lineTo(tw / 2 - 3, -2); ctx.closePath();
      ctx.fill();                                                  // strap
    } else if (look.body === 'leather' || look.body === 'doublet' || look.body === 'tunic') {
      ctx.fillStyle = shade(bodyCol, 1.15);
      ctx.fillRect(-tw / 2 + 1, -16, tw - 1, 2);
      if (look.body === 'doublet') {
        ctx.fillStyle = look.trim;
        for (let y = -13; y < 0; y += 4)
          ctx.fillRect(2, y, 2, 2);
      }
    }
    // belt and tabard
    ctx.fillStyle = look.body === 'robe' ? (look.trim || '#e3c65a') : '#3a2a1e';
    ctx.fillRect(-tw / 2, -2, tw + 1, 2.5);
    if (look.cape && look.body === 'plate') {
      ctx.fillStyle = look.cape;
      ctx.fillRect(-2, -12, 6, 16);
      ctx.fillStyle = look.trim || '#e8c14a';
      ctx.fillRect(0, -8, 2, 6);
    }
    // head
    drawHead(ctx, look, 1.5, -24, pose.head);

    // shield on the back arm, drawn in front of the torso
    if (look.shield) {
      ctx.fillStyle = look.shield;
      ctx.beginPath();
      ctx.moveTo(backHand.x - 2, backHand.y - 9); ctx.lineTo(backHand.x + 8, backHand.y - 9);
      ctx.lineTo(backHand.x + 8, backHand.y + 2); ctx.quadraticCurveTo(backHand.x + 3, backHand.y + 10, backHand.x - 2, backHand.y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(look.shield, 1.35);
      ctx.fillRect(backHand.x + 2, backHand.y - 7, 2, 12);
      ctx.fillRect(backHand.x - 1, backHand.y - 3, 8, 2);
    }

    // front arm and weapon
    const frontShoulder = { x: 2, y: shoulderY };
    const armCol = look.body === 'bare' || look.body === 'tunic' ? skin : shade(bodyCol, 1.05);
    const elbow = limb(ctx, frontShoulder.x, frontShoulder.y, pose.front, 7, 4.5 * wf, armCol);
    const hand = limb(ctx, elbow.x, elbow.y, pose.front + 0.25, 6, 4 * wf, armCol);
    drawWeapon(ctx, look, hand, pose.front + pose.wpn, pose);
    ctx.fillStyle = skin;
    ctx.fillRect(hand.x - 1.8, hand.y - 1.8, 3.6, 3.6);
    ctx.restore();

    ctx.restore();
  }

  // Alpha cut plus 1px outline turns the anti-aliased vector drawing into
  // crisp pixel art that matches the pixel icons.
  function pixelize(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function')
      return canvas;
    let img;
    try {
      img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_) {
      return canvas;
    }
    const d = img.data;
    const w = canvas.width, h = canvas.height;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; ++i) {
      const a = d[i * 4 + 3];
      if (a >= 110) {
        solid[i] = 1;
        // un-premultiply partial coverage to the full colour
        d[i * 4 + 3] = 255;
      } else
        d[i * 4 + 3] = 0;
    }
    const oc = [0x1c, 0x12, 0x22];
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const i = y * w + x;
        if (solid[i])
          continue;
        const n = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
        if (n) {
          d[i * 4] = oc[0]; d[i * 4 + 1] = oc[1]; d[i * 4 + 2] = oc[2]; d[i * 4 + 3] = 255;
        }
      }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function makeCanvas(w, h) {
    if (typeof document === 'undefined')
      return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const _cache = new Map();
  const CACHE_MAX = 400;

  function dollFrame(look, pose, p) {
    const step = Math.round(Math.max(0, Math.min(1, p || 0)) * (POSE_FRAMES - 1));
    const key = `${look.key}|${pose}|${step}`;
    let c = _cache.get(key);
    if (c)
      return c;
    const size = dollSize(look);
    c = makeCanvas(size.w, size.h);
    if (!c)
      return null;
    const ctx = c.getContext('2d');
    if (!ctx)
      return null;
    drawDoll(ctx, look, poseParams(pose, step / (POSE_FRAMES - 1)));
    pixelize(c);
    if (_cache.size >= CACHE_MAX)
      _cache.delete(_cache.keys().next().value);
    _cache.set(key, c);
    return c;
  }

  // Draws a fighter standing on (x, footY), about `height` px tall.
  // facing: 1 looks right, -1 looks left. Returns the drawn box or null.
  function draw(ctx, unit, pose, p, x, footY, height, facing, opts = {}) {
    const look = lookFor(unit);
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = false;
    // turned to stone: grey and still
    if (opts.stone && 'filter' in ctx)
      ctx.filter = 'grayscale(1) brightness(0.85) contrast(1.1)';
    if (look) {
      const frame = dollFrame(look, pose, p);
      if (frame) {
        // height is for a normal-sized body; bigger bodies draw bigger
        const k = Math.max(1, Math.round(height / ART_H));
        const w = frame.width * k, h = frame.height * k;
        ctx.translate(Math.round(x), Math.round(footY));
        ctx.scale(facing, 1);
        if (opts.rotate)
          ctx.rotate(opts.rotate);
        ctx.drawImage(frame, -w / 2, -h + (ART_H - FOOT_Y) * k, w, h);
        if (opts.flash > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, opts.flash) * alpha;
          ctx.drawImage(frame, -w / 2, -h + (ART_H - FOOT_Y) * k, w, h);
        }
        ctx.restore();
        return { w, h, kind: 'doll' };
      }
    }
    const drawn = drawResolved(ctx, unit, x, footY, height, facing, opts);
    ctx.restore();
    return drawn;
  }

  // Icons fill their whole box, so they are scaled by creature size to sit
  // beside the dolls (a medium doll's body is about 0.8 of `height`).
  const SIZE_SCALE = Object.freeze({ F: 0.35, D: 0.42, T: 0.5, S: 0.64, M: 0.8, L: 1.0, H: 1.18, G: 1.32, C: 1.45 });

  function sizeScale(ch) {
    const code = String(ch.size || 'M').charAt(0).toUpperCase();
    return SIZE_SCALE[code] || SIZE_SCALE.M;
  }

  // Icon/sheet sprites get their motion from transforms: squash, lean, bounce.
  function drawResolved(ctx, unit, x, footY, height, facing, opts) {
    const resolver = TR.spriteResolver;
    const ch = unit && unit.character ? unit.character : {};
    const sprite = resolver ? resolver.resolve(ch.class, unit.faction === 'party' ? 'party' : 'enemy') : null;
    const size = Math.round(height * sizeScale(ch));
    const sq = opts.squash || 0;
    const entry = TR.CREATURE_SPRITE_REGISTRY ? TR.CREATURE_SPRITE_REGISTRY[ch.class] : null;
    const faces = entry && entry.faces;
    const mirror = (faces === 'left' && facing > 0) || (faces === 'right' && facing < 0) ? -1 : 1;
    ctx.translate(Math.round(x), Math.round(footY));
    if (opts.rotate)
      ctx.rotate(opts.rotate * facing);
    ctx.scale((1 + sq * 0.5) * mirror, 1 - sq);
    if (!sprite) {
      ctx.fillStyle = unit.faction === 'party' ? '#4488cc' : '#cc4444';
      ctx.beginPath();
      ctx.arc(0, -size / 2, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      return { w: size, h: size, kind: 'circle' };
    }
    const img = sprite.img;
    ctx.drawImage(img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH, -size / 2, -size, size, size);
    if (sprite.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = sprite.tint;
      ctx.fillRect(-size / 2, -size, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= Math.min(1, opts.flash);
      ctx.drawImage(img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH, -size / 2, -size, size, size);
    }
    return { w: size, h: size, kind: 'sprite' };
  }

  function hasDoll(unit) {
    return !!lookFor(unit);
  }

  // Weapon family decides melee vs. ranged staging.
  function weaponOf(unit) {
    const look = lookFor(unit);
    return look ? look.weapon : 'natural';
  }

  TR.BattleSprites = Object.freeze({
    ART_W, ART_H, FOOT_Y, POSES: Object.keys(POSES),
    CLASS_LOOKS, RACE_LOOKS, MONSTER_LOOKS,
    lookFor, poseParams, hasDoll, weaponOf, draw, drawDoll, pixelize, sizeScale,
    clearCache: () => _cache.clear(),
  });
})();
