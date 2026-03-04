;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let ctx;

  function init(c) { ctx = c; }

  // ── Data Tables ─────────────────────────────────────────────────

  function computeDataTable(rowInputRef, colInputRef, inputRange) {
    const s = ctx.S();
    const rowInput = rowInputRef ? ctx.parseKey(rowInputRef.toUpperCase()) : null;
    const colInput = colInputRef ? ctx.parseKey(colInputRef.toUpperCase()) : null;
    if (!rowInput && !colInput) return null;

    const parts = inputRange.split(':');
    if (parts.length !== 2) return null;
    const start = ctx.parseKey(parts[0].toUpperCase());
    const end = ctx.parseKey(parts[1].toUpperCase());
    if (!start || !end) return null;

    // The top-left cell is the formula cell
    const formulaCol = start.col;
    const formulaRow = start.row;
    const formulaRaw = ctx.getCellRaw(formulaCol, formulaRow);

    // Save original values
    const origRowVal = rowInput ? ctx.getCellRaw(rowInput.col, rowInput.row) : '';
    const origColVal = colInput ? ctx.getCellRaw(colInput.col, colInput.row) : '';

    const results = [];

    if (rowInput && !colInput) {
      // One-variable: row inputs in first column (start.col), results computed
      for (let r = start.row + 1; r <= end.row; ++r) {
        const inputVal = ctx.getCellValue(start.col, r);
        ctx.setCellData(rowInput.col, rowInput.row, String(inputVal));
        ctx.recalcAll();
        const result = ctx.getCellValue(formulaCol, formulaRow);
        results.push({ row: r, col: start.col + 1, value: result });
      }
    } else if (!rowInput && colInput) {
      // One-variable: column inputs in first row, results computed
      for (let c = start.col + 1; c <= end.col; ++c) {
        const inputVal = ctx.getCellValue(c, start.row);
        ctx.setCellData(colInput.col, colInput.row, String(inputVal));
        ctx.recalcAll();
        const result = ctx.getCellValue(formulaCol, formulaRow);
        results.push({ row: start.row + 1, col: c, value: result });
      }
    } else if (rowInput && colInput) {
      // Two-variable: row inputs in first column, col inputs in first row
      for (let r = start.row + 1; r <= end.row; ++r) {
        const rowVal = ctx.getCellValue(start.col, r);
        for (let c = start.col + 1; c <= end.col; ++c) {
          const colVal = ctx.getCellValue(c, start.row);
          ctx.setCellData(rowInput.col, rowInput.row, String(rowVal));
          ctx.setCellData(colInput.col, colInput.row, String(colVal));
          ctx.recalcAll();
          const result = ctx.getCellValue(formulaCol, formulaRow);
          results.push({ row: r, col: c, value: result });
        }
      }
    }

    // Restore original values
    if (rowInput) ctx.setCellData(rowInput.col, rowInput.row, origRowVal);
    if (colInput) ctx.setCellData(colInput.col, colInput.row, origColVal);
    ctx.recalcAll();

    // Write results
    for (const res of results)
      ctx.setCellData(res.col, res.row, typeof res.value === 'number' ? String(res.value) : res.value);

    ctx.rebuildGrid();
    ctx.setDirty();
    return results;
  }

  async function showDataTableDialog() {
    const overlay = document.getElementById('dlg-data-table');
    if (!overlay) return;

    document.getElementById('dt-row-input').value = '';
    document.getElementById('dt-col-input').value = '';

    const result = await SZ.Dialog.show(overlay.id);
    if (result !== 'ok') return;

    const rowInputRef = document.getElementById('dt-row-input').value.trim();
    const colInputRef = document.getElementById('dt-col-input').value.trim();

    if (!rowInputRef && !colInputRef) {
      await ctx.User32.MessageBox('Please specify at least one input cell.', 'Data Table', 0);
      return;
    }

    const sel = ctx.getSelectionRect();
    const inputRange = ctx.cellKey(sel.c1, sel.r1) + ':' + ctx.cellKey(sel.c2, sel.r2);

    ctx.pushUndo();
    computeDataTable(rowInputRef || null, colInputRef || null, inputRange);
  }

  // ── Scenario Manager ────────────────────────────────────────────

  const scenarios = [];
  let originalValues = {};

  function saveOriginalValues(changingCells) {
    originalValues = {};
    for (const cell of changingCells) {
      const p = ctx.parseKey(cell.ref.toUpperCase());
      if (p)
        originalValues[cell.ref.toUpperCase()] = ctx.getCellRaw(p.col, p.row);
    }
  }

  function showScenario(name) {
    const scenario = scenarios.find(s => s.name === name);
    if (!scenario) return;

    // Save originals if not already saved
    if (!Object.keys(originalValues).length)
      saveOriginalValues(scenario.changingCells);

    for (const cell of scenario.changingCells) {
      const p = ctx.parseKey(cell.ref.toUpperCase());
      if (p) {
        ctx.setCellData(p.col, p.row, String(cell.value));
        ctx.recalcDependents(ctx.cellKey(p.col, p.row));
      }
    }
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  function restoreOriginal() {
    for (const [ref, val] of Object.entries(originalValues)) {
      const p = ctx.parseKey(ref);
      if (p) {
        ctx.setCellData(p.col, p.row, val);
        ctx.recalcDependents(ctx.cellKey(p.col, p.row));
      }
    }
    originalValues = {};
    ctx.rebuildGrid();
  }

  function createScenarioSummary() {
    if (!scenarios.length) return;

    const allSheets = ctx.sheets();
    const newSheet = ctx.createSheet('Scenario Summary');
    allSheets.push(newSheet);
    const sheetIdx = allSheets.length - 1;
    ctx.activeSheetIdx.set(sheetIdx);

    // Collect all unique changing cell refs
    const allRefs = new Set();
    for (const sc of scenarios)
      for (const cc of sc.changingCells)
        allRefs.add(cc.ref.toUpperCase());
    const refList = [...allRefs];

    // Headers
    ctx.setCellData(0, 0, 'Changing Cell');
    ctx.setCellData(1, 0, 'Current Values');
    for (let i = 0; i < scenarios.length; ++i)
      ctx.setCellData(i + 2, 0, scenarios[i].name);

    ctx.setFormat(0, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
    ctx.setFormat(1, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
    for (let i = 0; i < scenarios.length; ++i)
      ctx.setFormat(i + 2, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });

    // Data rows
    for (let r = 0; r < refList.length; ++r) {
      const ref = refList[r];
      ctx.setCellData(0, r + 1, ref);
      const p = ctx.parseKey(ref);
      if (p)
        ctx.setCellData(1, r + 1, String(originalValues[ref] || ctx.getCellRaw(p.col, p.row)));

      for (let s = 0; s < scenarios.length; ++s) {
        const cc = scenarios[s].changingCells.find(c => c.ref.toUpperCase() === ref);
        ctx.setCellData(s + 2, r + 1, cc ? String(cc.value) : '');
      }

      // Alternate row coloring
      const bgColor = r % 2 === 0 ? '#d9e2f3' : '#ffffff';
      for (let c = 0; c <= scenarios.length + 1; ++c)
        ctx.setFormat(c, r + 1, { bgColor });
    }

    ctx.rebuildGrid();
    ctx.setDirty();
  }

  async function showAddScenarioDialog(editScenario) {
    const name = await ctx.showPrompt('Scenario Name', 'Enter scenario name:', editScenario ? editScenario.name : '');
    if (!name || !name.trim()) return null;

    const cellRefs = await ctx.showPrompt('Changing Cells', 'Enter changing cell references (comma separated):', editScenario ? editScenario.changingCells.map(c => c.ref).join(', ') : '');
    if (!cellRefs) return null;

    const refs = cellRefs.split(',').map(r => r.trim().toUpperCase()).filter(r => r);
    const changingCells = [];

    for (const ref of refs) {
      const p = ctx.parseKey(ref);
      if (!p) continue;
      const currentVal = editScenario
        ? (editScenario.changingCells.find(c => c.ref.toUpperCase() === ref) || {}).value || ctx.getCellRaw(p.col, p.row)
        : ctx.getCellRaw(p.col, p.row);
      const val = await ctx.showPrompt('Cell Value', 'Value for ' + ref + ':', String(currentVal));
      if (val === null) return null;
      changingCells.push({ ref, value: isNaN(Number(val)) ? val : Number(val) });
    }

    const comment = await ctx.showPrompt('Comment', 'Comment (optional):', editScenario ? editScenario.comment || '' : '');

    return {
      name: name.trim(),
      changingCells,
      comment: comment || '',
    };
  }

  async function showScenarioManager() {
    const overlay = document.getElementById('dlg-scenario');
    if (!overlay) return;

    const listEl = document.getElementById('scen-list');

    function refreshList() {
      listEl.innerHTML = '';
      for (const sc of scenarios) {
        const opt = document.createElement('option');
        opt.value = sc.name;
        opt.textContent = sc.name + (sc.comment ? ' -- ' + sc.comment : '');
        listEl.appendChild(opt);
      }
    }

    refreshList();

    document.getElementById('scen-add').onclick = async () => {
      const sc = await showAddScenarioDialog(null);
      if (sc) {
        scenarios.push(sc);
        refreshList();
      }
    };

    document.getElementById('scen-edit').onclick = async () => {
      const selected = listEl.value;
      const idx = scenarios.findIndex(s => s.name === selected);
      if (idx < 0) return;
      const sc = await showAddScenarioDialog(scenarios[idx]);
      if (sc) {
        scenarios[idx] = sc;
        refreshList();
      }
    };

    document.getElementById('scen-delete').onclick = () => {
      const selected = listEl.value;
      const idx = scenarios.findIndex(s => s.name === selected);
      if (idx >= 0) {
        scenarios.splice(idx, 1);
        refreshList();
      }
    };

    document.getElementById('scen-show').onclick = () => {
      const selected = listEl.value;
      if (selected) showScenario(selected);
    };

    document.getElementById('scen-summary').onclick = () => {
      createScenarioSummary();
      SZ.Dialog.close('dlg-scenario');
    };

    SZ.Dialog.show(overlay.id);
  }

  // ── Solver ──────────────────────────────────────────────────────

  const solverConstraints = [];

  function solveProblem(targetRef, changingRefs, constraints, objective, targetValue) {
    const targetPos = ctx.parseKey(targetRef.toUpperCase());
    if (!targetPos) return { success: false, reason: 'Invalid target cell' };

    const changingPositions = changingRefs.map(ref => {
      const p = ctx.parseKey(ref.trim().toUpperCase());
      return p ? { ref: ref.trim().toUpperCase(), col: p.col, row: p.row } : null;
    }).filter(Boolean);

    if (!changingPositions.length) return { success: false, reason: 'No valid changing cells' };

    // Save original values
    const originals = {};
    for (const cp of changingPositions)
      originals[cp.ref] = ctx.getCellRaw(cp.col, cp.row);

    const MAX_ITER = 2000;
    const TOLERANCE = 1e-8;
    const DELTA = 1e-7;

    // Initialize current values
    const x = changingPositions.map(cp => {
      const v = parseFloat(ctx.getCellRaw(cp.col, cp.row)) || 0;
      return v === 0 ? 1 : v;
    });

    function setValues(vals) {
      for (let i = 0; i < changingPositions.length; ++i) {
        ctx.setCellData(changingPositions[i].col, changingPositions[i].row, String(vals[i]));
      }
      ctx.recalcAll();
    }

    function getObjective(vals) {
      setValues(vals);
      const result = ctx.getCellValue(targetPos.col, targetPos.row);
      return typeof result === 'number' ? result : parseFloat(result) || 0;
    }

    function checkConstraints(vals) {
      setValues(vals);
      for (const c of constraints) {
        const p = ctx.parseKey(c.cellRef.toUpperCase());
        if (!p) continue;
        const cellVal = ctx.getCellValue(p.col, p.row);
        const nv = typeof cellVal === 'number' ? cellVal : parseFloat(cellVal) || 0;
        const cv = parseFloat(c.value) || 0;
        switch (c.operator) {
          case '<=': if (nv > cv + TOLERANCE) return false; break;
          case '>=': if (nv < cv - TOLERANCE) return false; break;
          case '=': if (Math.abs(nv - cv) > TOLERANCE) return false; break;
          case 'int': if (Math.abs(nv - Math.round(nv)) > TOLERANCE) return false; break;
          case 'bin': if (nv !== 0 && nv !== 1) return false; break;
        }
      }
      return true;
    }

    let bestX = [...x];
    let bestObj = getObjective(x);
    let success = false;
    let reason = '';

    if (objective === 'value') {
      // Goal-seek style: minimize |f(x) - target|
      const target = targetValue;

      for (let iter = 0; iter < MAX_ITER; ++iter) {
        const fx = getObjective(bestX) - target;
        if (Math.abs(fx) < TOLERANCE && checkConstraints(bestX)) {
          success = true;
          reason = 'Converged to target value';
          break;
        }

        // Compute gradient for each variable
        for (let i = 0; i < bestX.length; ++i) {
          const orig = bestX[i];
          bestX[i] = orig + DELTA;
          const fxd = getObjective(bestX) - target;
          const deriv = (fxd - fx) / DELTA;
          bestX[i] = orig;

          if (Math.abs(deriv) > 1e-15) {
            let step = -fx / deriv;
            const maxStep = Math.max(Math.abs(orig) * 10, 100);
            if (Math.abs(step) > maxStep) step = Math.sign(step) * maxStep;

            let damping = 1.0;
            for (let d = 0; d < 5; ++d) {
              const testX = [...bestX];
              testX[i] = orig + step * damping;
              const testFx = Math.abs(getObjective(testX) - target);
              if (testFx < Math.abs(fx)) {
                bestX[i] = testX[i];
                break;
              }
              damping *= 0.5;
            }
          }
        }

        // Apply integer/binary constraints
        for (const c of constraints) {
          const idx = changingPositions.findIndex(cp => cp.ref === c.cellRef.toUpperCase());
          if (idx < 0) continue;
          if (c.operator === 'int') bestX[idx] = Math.round(bestX[idx]);
          else if (c.operator === 'bin') bestX[idx] = bestX[idx] >= 0.5 ? 1 : 0;
        }
      }

      if (!success) reason = 'Maximum iterations reached';
    } else {
      // Maximize or minimize using gradient descent/ascent
      const direction = objective === 'max' ? 1 : -1;
      let stepSize = 1.0;

      for (let iter = 0; iter < MAX_ITER; ++iter) {
        const currentObj = getObjective(bestX);
        let improved = false;

        for (let i = 0; i < bestX.length; ++i) {
          const orig = bestX[i];
          bestX[i] = orig + DELTA;
          const objPlus = getObjective(bestX);
          bestX[i] = orig;

          const grad = (objPlus - currentObj) / DELTA;
          if (Math.abs(grad) < 1e-15) continue;

          const newVal = orig + direction * grad * stepSize;
          const testX = [...bestX];
          testX[i] = newVal;

          if (checkConstraints(testX)) {
            const newObj = getObjective(testX);
            if ((objective === 'max' && newObj > currentObj) || (objective === 'min' && newObj < currentObj)) {
              bestX[i] = newVal;
              improved = true;
            }
          }
        }

        // Apply integer/binary constraints
        for (const c of constraints) {
          const idx = changingPositions.findIndex(cp => cp.ref === c.cellRef.toUpperCase());
          if (idx < 0) continue;
          if (c.operator === 'int') bestX[idx] = Math.round(bestX[idx]);
          else if (c.operator === 'bin') bestX[idx] = bestX[idx] >= 0.5 ? 1 : 0;
        }

        if (!improved) {
          stepSize *= 0.5;
          if (stepSize < 1e-12) {
            success = true;
            reason = 'Converged (gradient near zero)';
            break;
          }
        }
      }

      if (!success && !reason) reason = 'Maximum iterations reached';
      bestObj = getObjective(bestX);
      success = checkConstraints(bestX);
      if (!success) reason = 'Could not satisfy all constraints';
    }

    // Set final values
    setValues(bestX);

    return {
      success,
      reason,
      values: bestX.map((v, i) => ({ ref: changingPositions[i].ref, value: v })),
      objective: bestObj,
    };
  }

  async function showSolverDialog() {
    const overlay = document.getElementById('dlg-solver');
    if (!overlay) return;

    const targetInput = document.getElementById('solv-target');
    const valueInput = document.getElementById('solv-value');
    const changingInput = document.getElementById('solv-changing');
    const constraintsList = document.getElementById('solv-constraints');

    // Pre-fill target from active cell
    const ac = ctx.getActiveCell();
    const acRef = ctx.cellKey(ac.col, ac.row);
    const acRaw = ctx.getCellRaw(ac.col, ac.row);
    if (acRaw && typeof acRaw === 'string' && acRaw.startsWith('='))
      targetInput.value = acRef;
    else
      targetInput.value = '';

    changingInput.value = '';
    valueInput.value = '0';
    solverConstraints.length = 0;

    function refreshConstraintsList() {
      constraintsList.innerHTML = '';
      for (let i = 0; i < solverConstraints.length; ++i) {
        const c = solverConstraints[i];
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = c.cellRef + ' ' + c.operator + ' ' + (c.value || '');
        constraintsList.appendChild(opt);
      }
    }

    refreshConstraintsList();

    document.getElementById('solv-add-constraint').onclick = async () => {
      const cellRef = await ctx.showPrompt('Add Constraint', 'Cell reference:', '');
      if (!cellRef) return;
      const operator = await ctx.showPrompt('Operator', 'Operator (<=, >=, =, int, bin):', '<=');
      if (!operator) return;
      let value = '';
      if (operator !== 'int' && operator !== 'bin') {
        value = await ctx.showPrompt('Constraint Value', 'Value:', '0');
        if (value === null) return;
      }
      solverConstraints.push({ cellRef: cellRef.trim().toUpperCase(), operator: operator.trim(), value: value });
      refreshConstraintsList();
    };

    document.getElementById('solv-del-constraint').onclick = () => {
      const idx = parseInt(constraintsList.value, 10);
      if (!isNaN(idx) && idx >= 0 && idx < solverConstraints.length) {
        solverConstraints.splice(idx, 1);
        refreshConstraintsList();
      }
    };

    document.getElementById('solv-solve').onclick = async () => {
      const targetRef = targetInput.value.trim();
      const changingStr = changingInput.value.trim();
      if (!targetRef || !changingStr) {
        await ctx.User32.MessageBox('Please fill in target and changing cells.', 'Solver', 0);
        return;
      }

      const goalRadios = document.querySelectorAll('input[name="solv-goal"]');
      let objective = 'value';
      for (const r of goalRadios)
        if (r.checked) { objective = r.value; break; }

      const tv = parseFloat(valueInput.value) || 0;
      const changingRefs = changingStr.split(',').map(r => r.trim().toUpperCase());

      // Save undo state
      ctx.pushUndo();

      const result = solveProblem(targetRef, changingRefs, solverConstraints, objective, tv);

      if (result.success) {
        ctx.rebuildGrid();
        ctx.setDirty();
        let msg = 'Solver found a solution.\n\nObjective value: ' + result.objective.toPrecision(10);
        if (result.values)
          for (const v of result.values)
            msg += '\n' + v.ref + ' = ' + v.value.toPrecision(10);
        await ctx.User32.MessageBox(msg, 'Solver', 0);
      } else {
        ctx.rebuildGrid();
        await ctx.User32.MessageBox('Solver could not find a solution.\nReason: ' + result.reason, 'Solver', 0);
      }
    };

    SZ.Dialog.show(overlay.id);
  }

  SS.WhatIf = {
    init,
    showDataTableDialog,
    computeDataTable,
    showScenarioManager,
    showScenario,
    restoreOriginal,
    showSolverDialog,
    solveProblem,
    getScenarios: () => scenarios,
  };
})();
