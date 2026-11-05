/* Touch controls for flight: drag anywhere outside the buttons and the ship follows the finger
   one to one (relative, so the finger never hides it) while the guns fire on their own; four
   buttons in the right panel for dash, secondary, special and a held focus. Shown once the
   screen has been touched. Owns the touch pointers; writes intents into G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const DRAG_GAIN = 1.3;
  const drag = { id: -1, fx: 0, fy: 0, px: 0, py: 0, x: 0, y: 0 };
  const held = {};

  function active() {
    return G.input.touch && G.screen === 'playing';
  }

  /* the cluster sits in the right HUD panel, clear of the play field */
  function buttons() {
    const v = visible();
    const cx = v.x1 - 135, cy = v.y1 - 150;
    return [
      { id: 'dash', label: 'DASH', x: cx + 58, y: cy + 62, r: 44 },
      { id: 'ability', label: 'SPEC', x: cx - 52, y: cy + 74, r: 36 },
      { id: 'secondary', label: 'SEC', x: cx + 62, y: cy - 46, r: 36 },
      { id: 'focus', label: 'FOCUS', x: cx - 48, y: cy - 34, r: 32 },
    ];
  }

  function down(id, x, y) {
    G.input.touch = true;
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < b.r * b.r * 1.4) {
        held[b.id] = id;
        if (b.id === 'dash') G.input.dashQ = true;
        if (b.id === 'ability') G.input.abilityQ = true;
        return;
      }
    }
    if (drag.id !== -1) return;
    const p = G.player;
    drag.id = id;
    drag.fx = drag.x = x;
    drag.fy = drag.y = y;
    drag.px = p ? p.x : 0;
    drag.py = p ? p.y : 0;
  }

  function move(id, x, y) {
    if (drag.id !== id) return;
    drag.x = x;
    drag.y = y;
  }

  function up(id) {
    if (drag.id === id) drag.id = -1;
    for (const k in held)
      if (held[k] === id) delete held[k];
  }

  /* writes this step's touch intents; returns whether touch is steering */
  function sample(inp) {
    if (!inp.touch) return false;
    if (drag.id !== -1) {
      inp.follow = true;
      inp.followX = drag.px + (drag.x - drag.fx) * DRAG_GAIN;
      inp.followY = drag.py + (drag.y - drag.fy) * DRAG_GAIN;
      inp.firing = true;
      /* once the ship hits a wall, re-anchor so a reversal answers at once */
      const p = G.player;
      if (p) {
        const cx = Math.max(0, Math.min(G.world.w, inp.followX)), cy = Math.max(NS.constants.PLAYER_TOP, Math.min(G.world.h, inp.followY));
        if (cx !== inp.followX || cy !== inp.followY) {
          drag.px += cx - inp.followX;
          drag.py += cy - inp.followY;
          inp.followX = cx;
          inp.followY = cy;
        }
      }
    }
    inp.focus = inp.focus || held.focus !== undefined;
    inp.secondary = inp.secondary || held.secondary !== undefined;
    return true;
  }

  function draw() {
    const bs = buttons();
    const p = G.player;
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      const on = held[b.id] !== undefined;
      ctx.globalAlpha = on ? 0.9 : 0.6;
      ctx.fillStyle = on ? 'rgba(80,120,200,0.6)' : 'rgba(10,20,40,0.65)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      let ready = true;
      if (p && b.id === 'ability') ready = p.abilityCd <= 0;
      if (p && b.id === 'dash') ready = p.dashCd <= 0;
      if (p && b.id === 'secondary') ready = p.ammo > 0;
      ctx.strokeStyle = ready ? UI.gold : UI.textMute;
      ctx.lineWidth = 2;
      ctx.stroke();
      kit.text(b.label, b.x, b.y, 12, '#ffffff', { align: 'center', weight: 'bold' });
    }
    /* the drag anchor: where the finger went down */
    if (drag.id !== -1) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = K.rgba(UI.accent, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(drag.x, drag.y, 30, 0, TAU);
      ctx.stroke();
    } else {
      const v = visible();
      ctx.globalAlpha = 0.5;
      kit.text('Drag anywhere to fly - the guns fire on their own', (v.x0 + v.x1) / 2, v.y1 - 18, 13, UI.textDim, { align: 'center' });
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.touch, {
    active, down, move, up, sample, draw, buttons
  });
})();
