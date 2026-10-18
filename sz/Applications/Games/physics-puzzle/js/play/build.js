;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Building: picking parts out of the tray, dragging, snapping and
   * validating them, selecting, turning and removing placed parts, and the
   * round handles around the selected part. Reads and writes G.run (placed,
   * drag, selected) and pushes every change into the live attempt.
   */

  const G = NS.G;
  const Parts = G.Parts, Sim = G.Sim, Fx = G.Fx;
  const DEG = NS.C.DEG, FIELD_H = NS.C.FIELD_H, BAR_Y = NS.C.BAR_Y;

  function canEdit() {
    return G.run && (G.run.phase === 'aim' || G.run.phase === 'intro');
  }

  /* which placed part is under (x, y)? */
  function partAt(x, y) {
    const run = G.run;
    for (let i = run.placed.length - 1; i >= 0; --i) {
      const p = run.placed[i];
      const P = Parts.PARTS[p.type];
      const a = -(p.a || 0) * DEG;
      const dx = x - p.x, dy = y - p.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= P.half[0] + 10 && Math.abs(ly) <= P.half[1] + 12)
        return i;
    }
    return -1;
  }

  function validate(p, skip) {
    return Parts.canPlace(G.run.level, G.run.theme, G.run.placed, p, skip);
  }

  function beginDragNew(type, x, y) {
    if (!canEdit())
      return;
    if (NS.run.partsLeft(type) <= 0) {
      G.sfx('error', { volume: 0.5 });
      G.showToast('No ' + Parts.PARTS[type].name.toLowerCase() + ' left', '#ffb0a0');
      return;
    }
    G.run.phase = 'aim';
    const a = type === 'spring' ? 0 : type === 'fan' ? 270 : 0;
    G.run.drag = { type: type, x: x, y: y, a: a, from: -1, ox: 0, oy: 0, valid: false, reason: '', moved: false, sx: x, sy: y };
    G.run.selected = -1;
    G.sfx('click');
  }

  function beginDragExisting(i, x, y) {
    const p = G.run.placed[i];
    G.run.drag = { type: p.type, x: p.x, y: p.y, a: p.a, from: i, ox: p.x - x, oy: p.y - y, valid: true, reason: '', moved: false, sx: x, sy: y };
  }

  function updateDrag(x, y) {
    const d = G.run.drag;
    if (Math.abs(x - d.sx) + Math.abs(y - d.sy) > 6)
      d.moved = true;
    d.x = Parts.snap(Math.max(20, Math.min(1260, x + d.ox)));
    d.y = Parts.snap(Math.max(20, Math.min(FIELD_H - 10, y + d.oy)));
    const v = validate({ type: d.type, x: d.x, y: d.y, a: d.a }, d.from);
    d.valid = v.ok && y < BAR_Y;
    d.reason = y >= BAR_Y ? (d.from >= 0 ? 'Drop on the tray to remove' : '') : v.reason;
  }

  function endDrag(x, y) {
    const run = G.run;
    const d = run.drag;
    run.drag = null;
    if (d.from >= 0 && !d.moved) {
      /* a tap on a placed part selects it (a second tap rotates) */
      if (run.selected === d.from && Parts.PARTS[d.type].rotatable)
        rotateSelected(1);
      run.selected = d.from;
      return;
    }
    if (y >= BAR_Y) {
      if (d.from >= 0)
        removePart(d.from);
      return;
    }
    if (!d.valid) {
      G.sfx('error', { volume: 0.5 });
      if (d.reason)
        G.showToast(d.reason, '#ffb0a0');
      return;
    }
    const p = { type: d.type, x: d.x, y: d.y, a: d.a };
    if (d.from >= 0)
      run.placed[d.from] = p;
    else
      run.placed.push(p);
    run.selected = d.from >= 0 ? d.from : run.placed.length - 1;
    Sim.setParts(run.att, run.placed);
    Fx.placeBurst(G.fxWorld, p.x, p.y, '#7ae8ff');
    G.sfx('drop');
  }

  function rotateSelected(dir) {
    const run = G.run;
    if (!run || run.selected < 0 || !canEdit())
      return;
    const p = run.placed[run.selected];
    if (!Parts.PARTS[p.type].rotatable)
      return;
    for (let k = 1; k <= 24; ++k) {
      const a = Parts.snapAngle(p.a + dir * Parts.ROT_STEP * k);
      if (validate({ type: p.type, x: p.x, y: p.y, a: a }, run.selected).ok) {
        p.a = a;
        Sim.setParts(run.att, run.placed);
        G.sfx('blip', { pitch: 1.3 });
        return;
      }
    }
    G.sfx('error', { volume: 0.5 });
  }

  function removePart(i) {
    if (i < 0 || !canEdit())
      return;
    const run = G.run;
    const p = run.placed.splice(i, 1)[0];
    run.selected = -1;
    Sim.setParts(run.att, run.placed);
    Fx.poof(G.fxWorld, p.x, p.y);
    G.sfx('whoosh', { volume: 0.5 });
  }

  /* the handles around the selected part: rotate left, rotate right, remove */
  function selectionHandles() {
    const run = G.run;
    if (!run || run.selected < 0 || !canEdit())
      return [];
    const p = run.placed[run.selected];
    const P = Parts.PARTS[p.type];
    const r = Math.max(P.half[0], P.half[1]) + 30;
    const out = [];
    const y = Math.max(40, p.y - r * 0.7);
    if (P.rotatable) {
      out.push({ id: 'rotL', x: p.x - r, y: y, r: 19, action: () => rotateSelected(-1) });
      out.push({ id: 'rotR', x: p.x + r, y: y, r: 19, action: () => rotateSelected(1) });
    }
    out.push({ id: 'del', x: p.x, y: Math.min(FIELD_H - 22, p.y + r * 0.75), r: 17, action: () => removePart(G.run.selected) });
    return out;
  }

  NS.build = {
    canEdit: canEdit, partAt: partAt, beginDragNew: beginDragNew, beginDragExisting: beginDragExisting,
    updateDrag: updateDrag, endDrag: endDrag, rotateSelected: rotateSelected, removePart: removePart,
    selectionHandles: selectionHandles
  };
})();
