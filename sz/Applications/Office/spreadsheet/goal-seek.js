;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let ctx;

  function init(c) { ctx = c; }

  function performGoalSeek(setPos, targetValue, changePos) {
    // Save original value for rollback
    const originalValue = ctx.getCellRaw(changePos.col, changePos.row);

    // f(x) = evaluate(x) - target
    function f(x) {
      ctx.setCellData(changePos.col, changePos.row, String(x));
      ctx.recalcAll();
      const result = ctx.getCellValue(setPos.col, setPos.row);
      return (typeof result === 'number' ? result : parseFloat(result) || 0) - targetValue;
    }

    const MAX_ITER = 1000;
    const TOLERANCE = 1e-10;
    const DELTA = 1e-8;

    let x = parseFloat(originalValue) || 0;
    if (x === 0) x = 1; // Start with non-zero if original is 0

    let success = false;
    let iterations = 0;
    let reason = '';

    for (let i = 0; i < MAX_ITER; ++i) {
      ++iterations;
      const fx = f(x);

      if (Math.abs(fx) < TOLERANCE) {
        success = true;
        reason = 'Converged';
        break;
      }

      // Numerical derivative
      const fxd = f(x + DELTA);
      const derivative = (fxd - fx) / DELTA;

      if (Math.abs(derivative) < 1e-15) {
        reason = 'Derivative too small';
        break;
      }

      // Newton step with damping
      let step = -fx / derivative;

      // Clamp step magnitude
      const maxStep = Math.max(Math.abs(x) * 10, 100);
      if (Math.abs(step) > maxStep)
        step = Math.sign(step) * maxStep;

      // Damping: bisect if needed
      let damping = 1.0;
      let newX = x + step * damping;
      let newFx = f(newX);

      for (let d = 0; d < 5; ++d) {
        if (Math.abs(newFx) < Math.abs(fx)) break;
        damping *= 0.5;
        newX = x + step * damping;
        newFx = f(newX);
      }

      x = newX;
    }

    if (!success && iterations >= MAX_ITER)
      reason = 'Maximum iterations reached';

    return { success, value: x, iterations, reason };
  }

  async function showGoalSeekDialog() {
    const overlay = document.getElementById('dlg-goal-seek');
    if (!overlay) return;

    // Pre-fill set cell from active cell if it contains a formula
    const ac = ctx.getActiveCell();
    const setCellInput = document.getElementById('gs-set-cell');
    const toValueInput = document.getElementById('gs-to-value');
    const changeCellInput = document.getElementById('gs-change-cell');

    const cellRef = ctx.cellKey(ac.col, ac.row);
    const raw = ctx.getCellRaw(ac.col, ac.row);
    if (raw && typeof raw === 'string' && raw.startsWith('='))
      setCellInput.value = cellRef;
    else
      setCellInput.value = '';

    toValueInput.value = '';
    changeCellInput.value = '';

    const result = await SZ.Dialog.show(overlay.id);
    if (result !== 'ok') return;

    const setCellRef = setCellInput.value.trim().toUpperCase();
    const targetStr = toValueInput.value.trim();
    const changeCellRef = changeCellInput.value.trim().toUpperCase();

    if (!setCellRef || !targetStr || !changeCellRef) {
      await ctx.User32.MessageBox('Please fill in all fields.', 'Goal Seek', 0);
      return;
    }

    const setPos = ctx.parseKey(setCellRef);
    const changePos = ctx.parseKey(changeCellRef);

    if (!setPos || !changePos) {
      await ctx.User32.MessageBox('Invalid cell reference.', 'Goal Seek', 0);
      return;
    }

    const targetValue = parseFloat(targetStr);
    if (isNaN(targetValue)) {
      await ctx.User32.MessageBox('Target value must be a number.', 'Goal Seek', 0);
      return;
    }

    // Check that set cell has a formula
    const setRaw = ctx.getCellRaw(setPos.col, setPos.row);
    if (!setRaw || typeof setRaw !== 'string' || !setRaw.startsWith('=')) {
      await ctx.User32.MessageBox('Set cell must contain a formula.', 'Goal Seek', 0);
      return;
    }

    // Save undo state for the change cell
    const oldVal = ctx.getCellRaw(changePos.col, changePos.row);
    const oldFmt = Object.assign({}, ctx.getFormat(changePos.col, changePos.row));

    const gsResult = performGoalSeek(setPos, targetValue, changePos);

    if (gsResult.success) {
      ctx.setCellData(changePos.col, changePos.row, String(gsResult.value));
      ctx.recalcAll();
      ctx.pushUndo({
        type: 'cell', col: changePos.col, row: changePos.row,
        oldVal, newVal: String(gsResult.value),
        oldFmt, newFmt: Object.assign({}, ctx.getFormat(changePos.col, changePos.row)),
      });
      ctx.rebuildGrid();
      ctx.setDirty();
      await ctx.User32.MessageBox(
        'Goal Seek found a solution.\n\nTarget value: ' + targetValue + '\nResult: ' + gsResult.value.toPrecision(10) + '\nIterations: ' + gsResult.iterations,
        'Goal Seek', 0
      );
    } else {
      // Rollback -- restore original value
      ctx.setCellData(changePos.col, changePos.row, oldVal);
      ctx.recalcAll();
      ctx.rebuildGrid();
      await ctx.User32.MessageBox(
        'Goal Seek could not find a solution.\n\nReason: ' + gsResult.reason + '\nClosest value tried: ' + gsResult.value.toPrecision(10) + '\nIterations: ' + gsResult.iterations,
        'Goal Seek', 0
      );
    }
  }

  SS.GoalSeek = { init, showGoalSeekDialog, performGoalSeek };
})();
