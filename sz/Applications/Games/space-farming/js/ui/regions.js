/* Space Farming - interactive regions registered while drawing (hover, press, hit testing),
   standard buttons and the tooltip state.
   Owns: G.uiRegions, G.frameRegions, G.hoverRegionId, G.pressRegionId, G.uiTime, G.frameDt */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { ctx, drawSprite, uiFont, layoutLine, fitText, UI, hexToRgba, roundRectPath, drawBaked, rrPath,
    drawChip } = NS;

  /* ══════════════════════════════════════════════════════════════════
     UI REGIONS — every interactive box registers itself while drawing;
     pointer input is routed to the topmost region of the last frame
     ══════════════════════════════════════════════════════════════════ */

  const uiAnim = {};                 // region id -> eased hover value 0..1

  /* r: { id, x, y, w, h, onClick, onWheel, tip, disabled, modal } in UI units */
  function addRegion(r) {
    G.frameRegions.push(r);
    return r;
  }

  function hitRegion(ux, uy) {
    for (let i = G.uiRegions.length - 1; i >= 0; --i) {
      const r = G.uiRegions[i];
      if (ux >= r.x && ux <= r.x + r.w && uy >= r.y && uy <= r.y + r.h)
        return r;
    }
    return null;
  }

  /* Eased hover amount of a region (for lift / glow animations) */
  function hoverAmount(id) {
    const target = G.hoverRegionId === id ? 1 : 0;
    const a = uiAnim[id] === undefined ? target : uiAnim[id];
    const next = a + (target - a) * Math.min(1, G.frameDt * 14);
    uiAnim[id] = next;
    return next;
  }

  function isPressed(id) {
    return G.pressRegionId === id;
  }

  /* Standard button: gradient face, hover lift, press dip */
  function drawButton(b, opts) {
    opts = opts || {};
    const hv = hoverAmount(b.id);
    const pressed = isPressed(b.id) && G.hoverRegionId === b.id;
    const color = opts.color || UI.accent;
    const lift = pressed ? 1 : -hv * 1.5;
    const disabled = !!opts.disabled;
    ctx.save();
    if (disabled)
      ctx.globalAlpha *= 0.55;
    // the face is baked per size, colour and (stepped) hover amount
    const hq = Math.round(hv * 8) / 8;
    const radius = opts.radius || 9;
    drawBaked(['btn', radius, color, opts.primary ? 1 : 0, opts.active ? 1 : 0, pressed ? 1 : 0, hq].join('|'), b.x, b.y + lift, b.w, b.h, 6, (g, x, y, w, h) => {
      rrPath(g, x + 1, y + (pressed ? 2 : 4), w, h, radius);
      g.fillStyle = `rgba(0,0,0,${0.32 + hq * 0.1})`;
      g.fill();
      rrPath(g, x, y, w, h, radius);
      const gr = g.createLinearGradient(0, y, 0, y + h);
      if (opts.primary) {
        gr.addColorStop(0, hexToRgba(color, 0.55 + hq * 0.2));
        gr.addColorStop(1, hexToRgba(color, 0.22 + hq * 0.15));
      } else {
        gr.addColorStop(0, hq ? 'rgba(58,69,96,0.92)' : 'rgba(42,50,72,0.92)');
        gr.addColorStop(1, hq ? 'rgba(35,42,62,0.92)' : 'rgba(24,29,44,0.92)');
      }
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = opts.active ? 2.5 : 1.5;
      g.strokeStyle = opts.active ? color : (opts.primary ? hexToRgba(color, 0.9) : `rgba(140,160,210,${0.35 + hq * 0.4})`);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      rrPath(g, x + 3, y + 3, w - 6, h * 0.42, 6);
      g.fill();
    });
    const hasIcon = !!opts.icon;
    const keyW = opts.key ? 20 : 0;
    if (opts.chevron) {
      const cx = b.x + b.w / 2, cy = b.y + lift + b.h / 2, s = Math.min(b.w, b.h) * 0.22;
      ctx.strokeStyle = '#d0d8ea';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5 * opts.chevron, cy - s);
      ctx.lineTo(cx + s * 0.5 * opts.chevron, cy);
      ctx.lineTo(cx - s * 0.5 * opts.chevron, cy + s);
      ctx.stroke();
    } else if (hasIcon && opts.vertical) {
      drawSprite(opts.icon, b.x + b.w / 2, b.y + lift + b.h * 0.38, Math.min(b.h * 0.46, 30));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(opts.label, b.x + b.w / 2, b.y + lift + b.h * 0.8, b.w - 8, opts.px || 11, { weight: 'bold', color: opts.textColor || (opts.primary ? '#fff' : '#d0d8ea'), minPx: 8 });
    } else {
      const iconW = hasIcon ? Math.min(b.h - 10, 22) + 6 : 0;
      ctx.font = uiFont(opts.px || 14, 'bold');
      const l = layoutLine(opts.label, b.w - 16 - iconW - keyW, opts.px || 14, 9, 'bold');
      const total = iconW + l.width;
      let cx = b.x + (b.w - keyW) / 2 - total / 2;
      if (hasIcon) {
        drawSprite(opts.icon, cx + (iconW - 6) / 2, b.y + lift + b.h / 2, iconW - 6);
        cx += iconW;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(opts.label, cx, b.y + lift + b.h / 2 + 1, b.w - 16 - iconW - keyW, opts.px || 14, { weight: 'bold', color: opts.textColor || (opts.primary ? '#fff' : '#d0d8ea'), minPx: 9 });
    }
    if (opts.key)
      drawChip(opts.key, b.x + b.w - 6, b.y + lift + (b.h - 16) / 2, 16, { align: 'right', px: 10, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.22)', color: UI.textDim });
    ctx.restore();
    addRegion({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, onClick: disabled ? null : opts.onClick, tip: opts.tip, disabledClick: disabled ? opts.onDisabled : null });
  }

  function drawCloseButton(id, x, y, s, onClose) {
    const hv = hoverAmount(id);
    ctx.save();
    roundRectPath(x, y, s, s, 6);
    ctx.fillStyle = `rgba(255,${110 - hv * 40},${110 - hv * 40},${0.12 + hv * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,140,140,${0.35 + hv * 0.5})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#ffd0d0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.32, y + s * 0.32);
    ctx.lineTo(x + s * 0.68, y + s * 0.68);
    ctx.moveTo(x + s * 0.68, y + s * 0.32);
    ctx.lineTo(x + s * 0.32, y + s * 0.68);
    ctx.stroke();
    ctx.restore();
    addRegion({ id, x, y, w: s, h: s, onClick: onClose || NS.closeDialog, tip: () => ['Close', 'Esc'] });
  }

  /* ══════════════════════════════════════════════════════════════════
     TOOLTIP
     ══════════════════════════════════════════════════════════════════ */

  const TOOLTIP_DELAY = 0.3;
  const tooltip = { lines: [], key: '', timer: 0, visible: false, x: 0, y: 0 };

  function clearTooltip() {
    tooltip.lines = [];
    tooltip.key = '';
    tooltip.timer = 0;
    tooltip.visible = false;
  }

  function setTooltip(key, lines) {
    if (key !== tooltip.key) {
      tooltip.key = key;
      tooltip.timer = 0;
      tooltip.visible = false;
    }
    tooltip.lines = lines || [];
  }

  function updateTooltipTimer(dt) {
    if (tooltip.lines.length && !tooltip.visible) {
      tooltip.timer += dt;
      if (tooltip.timer >= TOOLTIP_DELAY)
        tooltip.visible = true;
    }
  }

  Object.assign(NS, { addRegion, hitRegion, hoverAmount, isPressed, drawButton, drawCloseButton,
    TOOLTIP_DELAY, tooltip, clearTooltip, setTooltip, updateTooltipTimer });

})();
