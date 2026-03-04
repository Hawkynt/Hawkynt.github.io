;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let _S, _cellKey, _parseKey, _colName, _colIndex, _getCellRaw, _getCellValue;
  let _getSheets, _getActiveSheetIdx, _setActiveSheetIdx;

  function init(ctx) {
    _S = ctx.S;
    _cellKey = ctx.cellKey;
    _parseKey = ctx.parseKey;
    _colName = ctx.colName;
    _colIndex = ctx.colIndex;
    _getCellRaw = ctx.getCellRaw;
    _getCellValue = ctx.getCellValue;
    _getSheets = ctx.getSheets;
    _getActiveSheetIdx = ctx.getActiveSheetIdx;
    _setActiveSheetIdx = ctx.setActiveSheetIdx;
  }

  // ── Formula engine ─────────────────────────────────────────────────
  function evaluateFormula(expr, selfKey) {
    const deps = [];
    const result = { value: '', error: false, deps };
    try {
      result.value = _evalExpression(expr, deps, selfKey);
    } catch (e) {
      result.value = '#ERROR!';
      result.error = true;
    }
    return result;
  }

  function _evalExpression(expr, deps, selfKey) {
    let processed = expr;
    processed = _resolveAllFunctions(processed, deps, selfKey);
    processed = processed.replace(/&/g, '+');
    processed = processed.replace(/\^/g, '**');
    processed = processed.replace(/<>/g, '!==');
    processed = processed.replace(/(?<![<>=!])=(?!=)/g, '===');

    // Named ranges
    const nr = _S().namedRanges;
    for (const [name, range] of Object.entries(nr))
      processed = processed.replace(new RegExp('\\b' + name + '\\b', 'gi'), range);

    // Sheet references like Sheet1!A1
    processed = processed.replace(/([A-Za-z0-9_]+)!([A-Z]+\d+(?::[A-Z]+\d+)?)/gi, (match, sheetName, ref) => {
      const sheets = _getSheets();
      const si = sheets.findIndex(s => s.name.toLowerCase() === sheetName.toLowerCase());
      if (si < 0) return '0';
      const saved = _getActiveSheetIdx();
      _setActiveSheetIdx(si);
      const val = _resolveRef(ref, deps, selfKey);
      _setActiveSheetIdx(saved);
      return val;
    });

    processed = processed.replace(/\b([A-Z]+)(\d+)\b/gi, (match, col, row) => {
      const key = col.toUpperCase() + row;
      if (key === selfKey) return '0';
      deps.push(key);
      const parsed = _parseKey(key);
      if (!parsed) return '0';
      return _cellValueToJS(_getCellValue(parsed.col, parsed.row));
    });

    processed = processed.replace(/(\d+(?:\.\d+)?)%/g, (_, n) => String(Number(n) / 100));

    const fn = new Function('"use strict"; return (' + processed + ');');
    return fn();
  }

  function _resolveRef(ref, deps, selfKey) {
    const rm = ref.match(/^([A-Z]+)(\d+)$/i);
    if (rm) {
      const key = rm[1].toUpperCase() + rm[2];
      deps.push(key);
      const p = _parseKey(key);
      if (!p) return '0';
      return _cellValueToJS(_getCellValue(p.col, p.row));
    }
    return '0';
  }

  function _cellValueToJS(val) {
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string' && val !== '') {
      const n = Number(val);
      if (!isNaN(n) && val.trim() !== '') return String(n);
      return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return '0';
  }

  function _resolveAllFunctions(expr, deps, selfKey) {
    for (let iter = 0; iter < 80; ++iter) {
      const match = expr.match(/([A-Z_][A-Z0-9_.]*)\s*\(([^()]*)\)/i);
      if (!match) break;
      const fn = match[1].toUpperCase();
      const args = match[2];
      const replacement = _evalFunction(fn, args, deps, selfKey);
      expr = expr.substring(0, match.index) + replacement + expr.substring(match.index + match[0].length);
    }
    return expr;
  }

  function _splitArgs(argsStr) {
    const result = [];
    let depth = 0, inString = false, stringChar = '', current = '';
    for (let i = 0; i < argsStr.length; ++i) {
      const ch = argsStr[i];
      if (inString) { current += ch; if (ch === stringChar) inString = false; continue; }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; current += ch; continue; }
      if (ch === '(') ++depth; else if (ch === ')') --depth;
      if (ch === ',' && depth === 0) { result.push(current); current = ''; }
      else current += ch;
    }
    if (current.length > 0) result.push(current);
    return result;
  }

  function _evalSub(expr, deps, selfKey) {
    try { return _evalExpression(expr.trim(), deps, selfKey); }
    catch { return 0; }
  }

  function _evalSubStr(expr, deps, selfKey) {
    const v = _evalSub(expr, deps, selfKey);
    return typeof v === 'string' ? v : String(v);
  }

  function _evalSubNum(expr, deps, selfKey) {
    const v = _evalSub(expr, deps, selfKey);
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function _collectRangeValues(argsStr, deps, selfKey) {
    const values = [];
    const parts = _splitArgs(argsStr);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const rangeMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (rangeMatch) {
        const c1 = _colIndex(rangeMatch[1].toUpperCase());
        const r1 = parseInt(rangeMatch[2], 10) - 1;
        const c2 = _colIndex(rangeMatch[3].toUpperCase());
        const r2 = parseInt(rangeMatch[4], 10) - 1;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); ++r)
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); ++c) {
            const key = _cellKey(c, r);
            if (key !== selfKey) deps.push(key);
            values.push(_getCellValue(c, r));
          }
      } else {
        const val = _evalSub(trimmed, deps, selfKey);
        values.push(typeof val === 'number' ? val : (typeof val === 'string' && val !== '' ? (isNaN(Number(val)) ? val : Number(val)) : val));
      }
    }
    return values;
  }

  function _collectRangeNumericValues(argsStr, deps, selfKey) {
    return _collectRangeValues(argsStr, deps, selfKey).filter(v => typeof v === 'number' && !isNaN(v));
  }

  function _fnRange(argsStr, deps, selfKey, reducer) {
    return reducer(_collectRangeValues(argsStr, deps, selfKey));
  }

  function _getRangeArray(rangeStr, deps, selfKey) {
    const trimmed = rangeStr.trim();
    const rangeMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!rangeMatch) return [];
    const c1 = _colIndex(rangeMatch[1].toUpperCase());
    const r1 = parseInt(rangeMatch[2], 10) - 1;
    const c2 = _colIndex(rangeMatch[3].toUpperCase());
    const r2 = parseInt(rangeMatch[4], 10) - 1;
    const rows = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); ++r) {
      const row = [];
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); ++c) {
        const key = _cellKey(c, r);
        if (key !== selfKey) deps.push(key);
        row.push(_getCellValue(c, r));
      }
      rows.push(row);
    }
    return rows;
  }

  function _conditionMatch(criteria, value) {
    const cs = String(criteria).trim();
    let op = '===', cv = cs;
    const om = cs.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);
    if (om) {
      op = om[1]; cv = om[2].trim();
      if (op === '=') op = '===';
      if (op === '<>' || op === '!=') op = '!==';
    }
    const nv = Number(cv), numVal = Number(value);
    if (!isNaN(nv) && !isNaN(numVal)) {
      switch (op) {
        case '===': return numVal === nv;
        case '!==': return numVal !== nv;
        case '>': return numVal > nv;
        case '<': return numVal < nv;
        case '>=': return numVal >= nv;
        case '<=': return numVal <= nv;
      }
    }
    const sv = String(value).toLowerCase(), scv = cv.toLowerCase();
    if (op === '===') return sv === scv;
    if (op === '!==') return sv !== scv;
    return false;
  }

  function _evalFunction(fname, args, deps, selfKey) {
    const a = () => _splitArgs(args);
    const nums = () => _collectRangeNumericValues(args, deps, selfKey);
    const vals = () => _collectRangeValues(args, deps, selfKey);

    switch (fname) {
      // ── Math ──
      case 'SUM': return String(nums().reduce((s, v) => s + v, 0));
      case 'AVERAGE': { const n = nums(); return n.length ? String(n.reduce((s, v) => s + v, 0) / n.length) : '0'; }
      case 'MIN': { const n = nums(); return n.length ? String(Math.min(...n)) : '0'; }
      case 'MAX': { const n = nums(); return n.length ? String(Math.max(...n)) : '0'; }
      case 'COUNT': return String(vals().filter(v => typeof v === 'number').length);
      case 'COUNTA': return String(vals().filter(v => v !== '' && v !== null && v !== undefined).length);
      case 'COUNTBLANK': return String(vals().filter(v => v === '' || v === null || v === undefined).length);
      case 'ROUND': { const p = a(); return String(Math.round(_evalSubNum(p[0], deps, selfKey) * Math.pow(10, _evalSubNum(p[1] || '0', deps, selfKey))) / Math.pow(10, _evalSubNum(p[1] || '0', deps, selfKey))); }
      case 'ROUNDUP': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), d = _evalSubNum(p[1] || '0', deps, selfKey), f = Math.pow(10, d); return String(Math.ceil(Math.abs(v) * f) / f * Math.sign(v)); }
      case 'ROUNDDOWN': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), d = _evalSubNum(p[1] || '0', deps, selfKey), f = Math.pow(10, d); return String(Math.floor(Math.abs(v) * f) / f * Math.sign(v)); }
      case 'CEILING': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), s = _evalSubNum(p[1] || '1', deps, selfKey); return String(s ? Math.ceil(v / s) * s : 0); }
      case 'FLOOR': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), s = _evalSubNum(p[1] || '1', deps, selfKey); return String(s ? Math.floor(v / s) * s : 0); }
      case 'ABS': return String(Math.abs(_evalSubNum(args, deps, selfKey)));
      case 'SQRT': return String(Math.sqrt(_evalSubNum(args, deps, selfKey)));
      case 'POWER': { const p = a(); return String(Math.pow(_evalSubNum(p[0], deps, selfKey), _evalSubNum(p[1], deps, selfKey))); }
      case 'MOD': { const p = a(); const b = _evalSubNum(p[1], deps, selfKey); return String(b ? _evalSubNum(p[0], deps, selfKey) % b : 0); }
      case 'INT': return String(Math.floor(_evalSubNum(args, deps, selfKey)));
      case 'RAND': return String(Math.random());
      case 'RANDBETWEEN': { const p = a(); const lo = _evalSubNum(p[0], deps, selfKey), hi = _evalSubNum(p[1], deps, selfKey); return String(Math.floor(Math.random() * (hi - lo + 1)) + lo); }
      case 'PI': return String(Math.PI);
      case 'SIN': return String(Math.sin(_evalSubNum(args, deps, selfKey)));
      case 'COS': return String(Math.cos(_evalSubNum(args, deps, selfKey)));
      case 'TAN': return String(Math.tan(_evalSubNum(args, deps, selfKey)));
      case 'LOG': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), b = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 10; return String(Math.log(v) / Math.log(b)); }
      case 'LOG10': return String(Math.log10(_evalSubNum(args, deps, selfKey)));
      case 'LN': return String(Math.log(_evalSubNum(args, deps, selfKey)));
      case 'EXP': return String(Math.exp(_evalSubNum(args, deps, selfKey)));
      case 'FACT': { let n = _evalSubNum(args, deps, selfKey), r = 1; for (let i = 2; i <= n; ++i) r *= i; return String(r); }
      case 'COMBIN': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), k = _evalSubNum(p[1], deps, selfKey); let r = 1; for (let i = 0; i < k; ++i) r = r * (n - i) / (i + 1); return String(Math.round(r)); }
      case 'PERMUT': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), k = _evalSubNum(p[1], deps, selfKey); let r = 1; for (let i = 0; i < k; ++i) r *= (n - i); return String(r); }
      case 'PRODUCT': return String(nums().reduce((p, v) => p * v, 1));
      case 'SUMPRODUCT': {
        const p = a();
        const arrays = p.map(r => _collectRangeNumericValues(r.trim(), deps, selfKey));
        const len = Math.min(...arrays.map(a => a.length));
        let sum = 0;
        for (let i = 0; i < len; ++i) { let prod = 1; for (const arr of arrays) prod *= arr[i]; sum += prod; }
        return String(sum);
      }
      case 'SUMIF': case 'SUMIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        const sumVals = p.length > 2 ? _collectRangeNumericValues(p[2].trim(), deps, selfKey) : rangeVals.map(v => typeof v === 'number' ? v : (Number(v) || 0));
        let sum = 0;
        for (let i = 0; i < rangeVals.length && i < sumVals.length; ++i)
          if (_conditionMatch(criteria, rangeVals[i])) sum += sumVals[i] || 0;
        return String(sum);
      }
      case 'AVERAGEIF': case 'AVERAGEIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        const sumVals = p.length > 2 ? _collectRangeNumericValues(p[2].trim(), deps, selfKey) : rangeVals.map(v => typeof v === 'number' ? v : (Number(v) || 0));
        let sum = 0, cnt = 0;
        for (let i = 0; i < rangeVals.length && i < sumVals.length; ++i)
          if (_conditionMatch(criteria, rangeVals[i])) { sum += sumVals[i] || 0; ++cnt; }
        return String(cnt ? sum / cnt : 0);
      }
      case 'COUNTIF': case 'COUNTIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        let cnt = 0;
        for (const v of rangeVals) if (_conditionMatch(criteria, v)) ++cnt;
        return String(cnt);
      }

      // ── Statistical ──
      case 'MEDIAN': { const n = nums().sort((a, b) => a - b); const m = Math.floor(n.length / 2); return String(n.length % 2 ? n[m] : (n.length ? (n[m - 1] + n[m]) / 2 : 0)); }
      case 'MODE': { const n = nums(); const freq = {}; for (const v of n) freq[v] = (freq[v] || 0) + 1; let best = n[0], bestCnt = 0; for (const [k, c] of Object.entries(freq)) if (c > bestCnt) { best = Number(k); bestCnt = c; } return String(best || 0); }
      case 'STDEV': case 'STDEVS': { const n = nums(); if (n.length < 2) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(Math.sqrt(n.reduce((s, v) => s + (v - avg) ** 2, 0) / (n.length - 1))); }
      case 'STDEVP': { const n = nums(); if (!n.length) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(Math.sqrt(n.reduce((s, v) => s + (v - avg) ** 2, 0) / n.length)); }
      case 'VAR': case 'VARS': { const n = nums(); if (n.length < 2) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(n.reduce((s, v) => s + (v - avg) ** 2, 0) / (n.length - 1)); }
      case 'VARP': { const n = nums(); if (!n.length) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(n.reduce((s, v) => s + (v - avg) ** 2, 0) / n.length); }
      case 'LARGE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => b - a); const k = _evalSubNum(p[1], deps, selfKey); return String(n[k - 1] || 0); }
      case 'SMALL': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const k = _evalSubNum(p[1], deps, selfKey); return String(n[k - 1] || 0); }
      case 'RANK': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey); const n = _collectRangeNumericValues(p[1].trim(), deps, selfKey).sort((a, b) => b - a); return String(n.indexOf(v) + 1 || 0); }
      case 'PERCENTILE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const k = _evalSubNum(p[1], deps, selfKey); const idx = k * (n.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return String(lo === hi ? n[lo] : n[lo] + (n[hi] - n[lo]) * (idx - lo)); }
      case 'PERCENTRANK': { const p = a(); const v = _evalSubNum(p[1], deps, selfKey); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); if (!n.length) return '0'; let rank = 0; for (let i = 0; i < n.length; ++i) if (n[i] <= v) rank = i; return String(rank / (n.length - 1)); }
      case 'QUARTILE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const q = _evalSubNum(p[1], deps, selfKey); const idx = (q / 4) * (n.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return String(lo === hi ? n[lo] : n[lo] + (n[hi] - n[lo]) * (idx - lo)); }
      case 'CORREL': { const p = a(); const x = _collectRangeNumericValues(p[0].trim(), deps, selfKey), y = _collectRangeNumericValues(p[1].trim(), deps, selfKey); const len = Math.min(x.length, y.length); if (len < 2) return '0'; const mx = x.reduce((s, v) => s + v, 0) / len, my = y.reduce((s, v) => s + v, 0) / len; let num = 0, dx = 0, dy = 0; for (let i = 0; i < len; ++i) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return String(dx && dy ? num / Math.sqrt(dx * dy) : 0); }
      case 'FORECAST': { const p = a(); const xv = _evalSubNum(p[0], deps, selfKey); const yArr = _collectRangeNumericValues(p[1].trim(), deps, selfKey), xArr = _collectRangeNumericValues(p[2].trim(), deps, selfKey); const len = Math.min(xArr.length, yArr.length); if (!len) return '0'; const mx = xArr.reduce((s, v) => s + v, 0) / len, my = yArr.reduce((s, v) => s + v, 0) / len; let num = 0, den = 0; for (let i = 0; i < len; ++i) { num += (xArr[i] - mx) * (yArr[i] - my); den += (xArr[i] - mx) ** 2; } const b = den ? num / den : 0; return String(my + b * (xv - mx)); }
      case 'TREND': { const p = a(); const yArr = _collectRangeNumericValues(p[0].trim(), deps, selfKey); const xArr = p.length > 1 ? _collectRangeNumericValues(p[1].trim(), deps, selfKey) : yArr.map((_, i) => i + 1); const len = Math.min(xArr.length, yArr.length); const mx = xArr.reduce((s, v) => s + v, 0) / len, my = yArr.reduce((s, v) => s + v, 0) / len; let num = 0, den = 0; for (let i = 0; i < len; ++i) { num += (xArr[i] - mx) * (yArr[i] - my); den += (xArr[i] - mx) ** 2; } const b = den ? num / den : 0, a2 = my - b * mx; return String(a2 + b * (len + 1)); }
      case 'GROWTH': { const p = a(); const yArr = _collectRangeNumericValues(p[0].trim(), deps, selfKey); if (!yArr.length) return '0'; const last = yArr[yArr.length - 1], first = yArr[0]; return String(first ? last * (last / first) : 0); }

      // ── Text ──
      case 'LEFT': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const n = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1; return '"' + s.substring(0, n) + '"'; }
      case 'RIGHT': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const n = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1; return '"' + s.substring(s.length - n) + '"'; }
      case 'MID': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const start = _evalSubNum(p[1], deps, selfKey) - 1; const n = _evalSubNum(p[2], deps, selfKey); return '"' + s.substring(start, start + n) + '"'; }
      case 'LEN': return String(String(_evalSub(args, deps, selfKey)).length);
      case 'FIND': { const p = a(); const needle = _evalSubStr(p[0], deps, selfKey), haystack = _evalSubStr(p[1], deps, selfKey); const start = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; const idx = haystack.indexOf(needle, start); return String(idx >= 0 ? idx + 1 : -1); }
      case 'SEARCH': { const p = a(); const needle = _evalSubStr(p[0], deps, selfKey).toLowerCase(), haystack = _evalSubStr(p[1], deps, selfKey).toLowerCase(); const start = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; const idx = haystack.indexOf(needle, start); return String(idx >= 0 ? idx + 1 : -1); }
      case 'SUBSTITUTE': { const p = a(); let s = _evalSubStr(p[0], deps, selfKey); const old = _evalSubStr(p[1], deps, selfKey), rep = _evalSubStr(p[2], deps, selfKey); if (p.length > 3) { const n = _evalSubNum(p[3], deps, selfKey); let cnt = 0, idx = 0; while ((idx = s.indexOf(old, idx)) >= 0) { if (++cnt === n) { s = s.substring(0, idx) + rep + s.substring(idx + old.length); break; } idx += old.length; } } else s = s.split(old).join(rep); return '"' + s + '"'; }
      case 'REPLACE': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const start = _evalSubNum(p[1], deps, selfKey) - 1, len = _evalSubNum(p[2], deps, selfKey); const rep = _evalSubStr(p[3], deps, selfKey); return '"' + s.substring(0, start) + rep + s.substring(start + len) + '"'; }
      case 'TRIM': return '"' + _evalSubStr(args, deps, selfKey).trim().replace(/\s+/g, ' ') + '"';
      case 'CLEAN': return '"' + _evalSubStr(args, deps, selfKey).replace(/[\x00-\x1F]/g, '') + '"';
      case 'UPPER': return '"' + _evalSubStr(args, deps, selfKey).toUpperCase() + '"';
      case 'LOWER': return '"' + _evalSubStr(args, deps, selfKey).toLowerCase() + '"';
      case 'PROPER': return '"' + _evalSubStr(args, deps, selfKey).replace(/\b\w/g, c => c.toUpperCase()) + '"';
      case 'TEXT': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey); const fmt = _evalSubStr(p[1], deps, selfKey); return '"' + _formatNumberWithPattern(v, fmt) + '"'; }
      case 'VALUE': return String(Number(_evalSubStr(args, deps, selfKey)) || 0);
      case 'CONCATENATE': case 'CONCAT': { const p = a(); return '"' + p.map(x => _evalSubStr(x, deps, selfKey)).join('') + '"'; }
      case 'REPT': { const p = a(); return '"' + _evalSubStr(p[0], deps, selfKey).repeat(_evalSubNum(p[1], deps, selfKey)) + '"'; }
      case 'EXACT': { const p = a(); return String(_evalSubStr(p[0], deps, selfKey) === _evalSubStr(p[1], deps, selfKey)); }
      case 'CHAR': return '"' + String.fromCharCode(_evalSubNum(args, deps, selfKey)) + '"';
      case 'CODE': return String((_evalSubStr(args, deps, selfKey)).charCodeAt(0) || 0);
      case 'T': { const v = _evalSub(args, deps, selfKey); return typeof v === 'string' ? '"' + v + '"' : '""'; }

      // ── Date/Time ──
      case 'NOW': return String(Date.now());
      case 'TODAY': { const d = new Date(); d.setHours(0, 0, 0, 0); return String(d.getTime()); }
      case 'DATE': { const p = a(); return String(new Date(_evalSubNum(p[0], deps, selfKey), _evalSubNum(p[1], deps, selfKey) - 1, _evalSubNum(p[2], deps, selfKey)).getTime()); }
      case 'TIME': { const p = a(); return String((_evalSubNum(p[0], deps, selfKey) * 3600 + _evalSubNum(p[1], deps, selfKey) * 60 + _evalSubNum(p[2], deps, selfKey)) * 1000); }
      case 'YEAR': return String(new Date(_evalSubNum(args, deps, selfKey)).getFullYear());
      case 'MONTH': return String(new Date(_evalSubNum(args, deps, selfKey)).getMonth() + 1);
      case 'DAY': return String(new Date(_evalSubNum(args, deps, selfKey)).getDate());
      case 'HOUR': return String(new Date(_evalSubNum(args, deps, selfKey)).getHours());
      case 'MINUTE': return String(new Date(_evalSubNum(args, deps, selfKey)).getMinutes());
      case 'SECOND': return String(new Date(_evalSubNum(args, deps, selfKey)).getSeconds());
      case 'WEEKDAY': return String(new Date(_evalSubNum(args, deps, selfKey)).getDay() + 1);
      case 'WEEKNUM': { const d = new Date(_evalSubNum(args, deps, selfKey)); const start = new Date(d.getFullYear(), 0, 1); return String(Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)); }
      case 'DATEDIF': { const p = a(); const d1 = new Date(_evalSubNum(p[0], deps, selfKey)), d2 = new Date(_evalSubNum(p[1], deps, selfKey)); const unit = _evalSubStr(p[2], deps, selfKey).toUpperCase(); if (unit === 'D') return String(Math.floor((d2 - d1) / 86400000)); if (unit === 'M') return String((d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth()); if (unit === 'Y') return String(d2.getFullYear() - d1.getFullYear()); return '0'; }
      case 'DATEVALUE': return String(new Date(_evalSubStr(args, deps, selfKey)).getTime() || 0);
      case 'TIMEVALUE': { const p = _evalSubStr(args, deps, selfKey).split(':'); return String(((Number(p[0]) || 0) * 3600 + (Number(p[1]) || 0) * 60 + (Number(p[2]) || 0)) * 1000); }
      case 'EOMONTH': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); const months = _evalSubNum(p[1], deps, selfKey); d.setMonth(d.getMonth() + months + 1, 0); return String(d.getTime()); }
      case 'EDATE': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); d.setMonth(d.getMonth() + _evalSubNum(p[1], deps, selfKey)); return String(d.getTime()); }
      case 'NETWORKDAYS': { const p = a(); const d1 = new Date(_evalSubNum(p[0], deps, selfKey)), d2 = new Date(_evalSubNum(p[1], deps, selfKey)); let cnt = 0; const cur = new Date(d1); while (cur <= d2) { const dow = cur.getDay(); if (dow !== 0 && dow !== 6) ++cnt; cur.setDate(cur.getDate() + 1); } return String(cnt); }
      case 'WORKDAY': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); let days = _evalSubNum(p[1], deps, selfKey); while (days > 0) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) --days; } return String(d.getTime()); }

      // ── Logical ──
      case 'IF': { const p = a(); const cond = _evalSub(p[0], deps, selfKey); return (cond && cond !== 0 && cond !== '0' && cond !== '' && cond !== false) ? _cellValueToJS(_evalSub(p[1], deps, selfKey)) : (p.length > 2 ? _cellValueToJS(_evalSub(p[2], deps, selfKey)) : '0'); }
      case 'AND': { const p = a(); for (const x of p) { const v = _evalSub(x, deps, selfKey); if (!v || v === 0 || v === '0' || v === false) return 'false'; } return 'true'; }
      case 'OR': { const p = a(); for (const x of p) { const v = _evalSub(x, deps, selfKey); if (v && v !== 0 && v !== '0' && v !== false) return 'true'; } return 'false'; }
      case 'NOT': { const v = _evalSub(args, deps, selfKey); return (!v || v === 0 || v === '0' || v === false) ? 'true' : 'false'; }
      case 'TRUE': return 'true';
      case 'FALSE': return 'false';
      case 'IFERROR': { const p = a(); try { const v = _evalExpression(p[0].trim(), deps, selfKey); if (typeof v === 'string' && v.startsWith('#')) return _cellValueToJS(_evalSub(p[1], deps, selfKey)); return _cellValueToJS(v); } catch { return _cellValueToJS(_evalSub(p[1], deps, selfKey)); } }
      case 'IFNA': { const p = a(); try { const v = _evalExpression(p[0].trim(), deps, selfKey); if (v === '#N/A') return _cellValueToJS(_evalSub(p[1], deps, selfKey)); return _cellValueToJS(v); } catch { return _cellValueToJS(_evalSub(p[1], deps, selfKey)); } }
      case 'IFS': { const p = a(); for (let i = 0; i < p.length - 1; i += 2) { const c = _evalSub(p[i], deps, selfKey); if (c && c !== 0 && c !== '0' && c !== false) return _cellValueToJS(_evalSub(p[i + 1], deps, selfKey)); } return '"#N/A"'; }
      case 'SWITCH': { const p = a(); const v = _evalSub(p[0], deps, selfKey); for (let i = 1; i < p.length - 1; i += 2) if (_evalSub(p[i], deps, selfKey) == v) return _cellValueToJS(_evalSub(p[i + 1], deps, selfKey)); return p.length % 2 === 0 ? _cellValueToJS(_evalSub(p[p.length - 1], deps, selfKey)) : '"#N/A"'; }

      // ── Lookup ──
      case 'VLOOKUP': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const rows = _getRangeArray(p[1].trim(), deps, selfKey); const ci = _evalSubNum(p[2], deps, selfKey) - 1; for (const row of rows) if (row[0] == sv && ci < row.length) return _cellValueToJS(row[ci]); return '"#N/A"'; }
      case 'HLOOKUP': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const rows = _getRangeArray(p[1].trim(), deps, selfKey); const ri = _evalSubNum(p[2], deps, selfKey) - 1; if (!rows.length) return '"#N/A"'; for (let c = 0; c < rows[0].length; ++c) if (rows[0][c] == sv && ri < rows.length) return _cellValueToJS(rows[ri][c]); return '"#N/A"'; }
      case 'INDEX': { const p = a(); const rows = _getRangeArray(p[0].trim(), deps, selfKey); const ri = _evalSubNum(p[1], deps, selfKey) - 1; const ci = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; return (rows[ri] && rows[ri][ci] !== undefined) ? _cellValueToJS(rows[ri][ci]) : '0'; }
      case 'MATCH': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const v = _collectRangeValues(p[1].trim(), deps, selfKey); for (let i = 0; i < v.length; ++i) if (v[i] == sv) return String(i + 1); return '"#N/A"'; }
      case 'OFFSET': return '0';
      case 'INDIRECT': { const ref = _evalSubStr(args, deps, selfKey); const p = _parseKey(ref); if (!p) return '0'; deps.push(ref); return _cellValueToJS(_getCellValue(p.col, p.row)); }
      case 'CHOOSE': { const p = a(); const idx = _evalSubNum(p[0], deps, selfKey); return (idx >= 1 && idx < p.length) ? _cellValueToJS(_evalSub(p[idx], deps, selfKey)) : '0'; }
      case 'ROW': { if (!args.trim()) return String(_parseKey(selfKey)?.row + 1 || 0); const p = _parseKey(args.trim()); return String(p ? p.row + 1 : 0); }
      case 'COLUMN': { if (!args.trim()) return String(_parseKey(selfKey)?.col + 1 || 0); const p = _parseKey(args.trim()); return String(p ? p.col + 1 : 0); }
      case 'ROWS': { const rm = args.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i); return String(rm ? Math.abs(parseInt(rm[4], 10) - parseInt(rm[2], 10)) + 1 : 1); }
      case 'COLUMNS': { const rm = args.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i); return String(rm ? Math.abs(_colIndex(rm[3].toUpperCase()) - _colIndex(rm[1].toUpperCase())) + 1 : 1); }
      case 'TRANSPOSE': return '0';

      // ── Financial ──
      case 'PMT': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pv / n); return String(-pv * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)); }
      case 'PV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pmt = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pmt * n); return String(-pmt * (1 - Math.pow(1 + r, -n)) / r); }
      case 'FV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pmt = _evalSubNum(p[2], deps, selfKey); const pv = p.length > 3 ? _evalSubNum(p[3], deps, selfKey) : 0; if (r === 0) return String(-pv - pmt * n); return String(-pv * Math.pow(1 + r, n) - pmt * (Math.pow(1 + r, n) - 1) / r); }
      case 'NPER': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), pmt = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pv / pmt); return String(Math.log(-pmt / (pv * r - pmt)) / Math.log(1 + r)); }
      case 'RATE': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), pmt = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); let rate = 0.1; for (let i = 0; i < 100; ++i) { const f = pv * Math.pow(1 + rate, n) + pmt * (Math.pow(1 + rate, n) - 1) / rate; const df = n * pv * Math.pow(1 + rate, n - 1) + pmt * (n * Math.pow(1 + rate, n - 1) * rate - Math.pow(1 + rate, n) + 1) / (rate * rate); rate -= f / df; } return String(rate); }
      case 'NPV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey); const cf = p.slice(1).map(x => _evalSubNum(x, deps, selfKey)); let npv = 0; for (let i = 0; i < cf.length; ++i) npv += cf[i] / Math.pow(1 + r, i + 1); return String(npv); }
      case 'IRR': { const p = a(); const cf = _collectRangeNumericValues(p[0].trim(), deps, selfKey); let rate = 0.1; for (let iter = 0; iter < 200; ++iter) { let f = 0, df = 0; for (let i = 0; i < cf.length; ++i) { f += cf[i] / Math.pow(1 + rate, i); df -= i * cf[i] / Math.pow(1 + rate, i + 1); } if (Math.abs(f) < 1e-10) break; rate -= f / df; } return String(rate); }
      case 'SLN': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey); return String(life ? (cost - salvage) / life : 0); }
      case 'DB': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey), period = _evalSubNum(p[3], deps, selfKey); const rate = 1 - Math.pow(salvage / cost, 1 / life); let val = cost; for (let i = 1; i < period; ++i) val -= val * rate; return String(val * rate); }
      case 'DDB': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey), period = _evalSubNum(p[3], deps, selfKey); const factor = p.length > 4 ? _evalSubNum(p[4], deps, selfKey) : 2; let val = cost; for (let i = 1; i < period; ++i) { const dep = val * factor / life; val -= Math.min(dep, val - salvage); } return String(Math.min(val * factor / life, val - salvage)); }

      // ── Info ──
      case 'ISBLANK': { const v = _evalSub(args, deps, selfKey); return String(v === '' || v === null || v === undefined); }
      case 'ISERROR': { try { const v = _evalExpression(args.trim(), deps, selfKey); return String(typeof v === 'string' && v.startsWith('#')); } catch { return 'true'; } }
      case 'ISNUMBER': return String(typeof _evalSub(args, deps, selfKey) === 'number');
      case 'ISTEXT': return String(typeof _evalSub(args, deps, selfKey) === 'string');
      case 'ISLOGICAL': { const v = _evalSub(args, deps, selfKey); return String(v === true || v === false); }
      case 'TYPE': { const v = _evalSub(args, deps, selfKey); if (typeof v === 'number') return '1'; if (typeof v === 'string') return '2'; if (typeof v === 'boolean') return '4'; return '0'; }
      case 'NA': return '"#N/A"';
      case 'ERROR.TYPE': case 'ERRORTYPE': { try { const v = _evalExpression(args.trim(), deps, selfKey); if (typeof v === 'string') { if (v === '#N/A') return '7'; if (v === '#VALUE!') return '3'; if (v === '#REF!') return '4'; if (v === '#NAME?') return '5'; if (v === '#DIV/0!') return '2'; if (v === '#NULL!') return '1'; } return '"#N/A"'; } catch { return '1'; } }

      // ── Dynamic Array / Lookup ──
      case 'XLOOKUP': {
        const p = a();
        const lookupVal = _evalSub(p[0], deps, selfKey);
        const lookupArr = _collectRangeValues(p[1].trim(), deps, selfKey);
        const returnArr = _collectRangeValues(p[2].trim(), deps, selfKey);
        const ifNotFound = p.length > 3 && p[3].trim() !== '' ? _evalSub(p[3], deps, selfKey) : '#N/A';
        const matchMode = p.length > 4 ? _evalSubNum(p[4], deps, selfKey) : 0;
        const searchMode = p.length > 5 ? _evalSubNum(p[5], deps, selfKey) : 1;
        let foundIdx = -1;
        const doWildcard = (pattern, text) => {
          const re = new RegExp('^' + String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
          return re.test(String(text));
        };
        const indices = [];
        if (searchMode === 1 || searchMode === 2)
          for (let i = 0; i < lookupArr.length; ++i) indices.push(i);
        else
          for (let i = lookupArr.length - 1; i >= 0; --i) indices.push(i);
        if (matchMode === 0) {
          for (const i of indices)
            if (String(lookupArr[i]).toLowerCase() === String(lookupVal).toLowerCase()) { foundIdx = i; break; }
        } else if (matchMode === 2) {
          for (const i of indices)
            if (doWildcard(lookupVal, lookupArr[i])) { foundIdx = i; break; }
        } else if (matchMode === -1) {
          let bestIdx = -1, bestVal = -Infinity;
          for (const i of indices) {
            const nv = Number(lookupArr[i]);
            if (!isNaN(nv) && nv <= Number(lookupVal) && nv > bestVal) { bestVal = nv; bestIdx = i; }
          }
          if (bestIdx < 0)
            for (const i of indices)
              if (String(lookupArr[i]).toLowerCase() === String(lookupVal).toLowerCase()) { bestIdx = i; break; }
          foundIdx = bestIdx;
        } else if (matchMode === 1) {
          let bestIdx = -1, bestVal = Infinity;
          for (const i of indices) {
            const nv = Number(lookupArr[i]);
            if (!isNaN(nv) && nv >= Number(lookupVal) && nv < bestVal) { bestVal = nv; bestIdx = i; }
          }
          if (bestIdx < 0)
            for (const i of indices)
              if (String(lookupArr[i]).toLowerCase() === String(lookupVal).toLowerCase()) { bestIdx = i; break; }
          foundIdx = bestIdx;
        }
        if (foundIdx >= 0 && foundIdx < returnArr.length) return _cellValueToJS(returnArr[foundIdx]);
        return _cellValueToJS(ifNotFound);
      }
      case 'XMATCH': {
        const p = a();
        const lookupVal = _evalSub(p[0], deps, selfKey);
        const lookupArr = _collectRangeValues(p[1].trim(), deps, selfKey);
        const matchMode = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) : 0;
        const searchMode = p.length > 3 ? _evalSubNum(p[3], deps, selfKey) : 1;
        const doWildcard = (pattern, text) => {
          const re = new RegExp('^' + String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
          return re.test(String(text));
        };
        const indices = [];
        if (searchMode === 1 || searchMode === 2)
          for (let i = 0; i < lookupArr.length; ++i) indices.push(i);
        else
          for (let i = lookupArr.length - 1; i >= 0; --i) indices.push(i);
        if (matchMode === 0) {
          for (const i of indices)
            if (String(lookupArr[i]).toLowerCase() === String(lookupVal).toLowerCase()) return String(i + 1);
        } else if (matchMode === 2) {
          for (const i of indices)
            if (doWildcard(lookupVal, lookupArr[i])) return String(i + 1);
        } else if (matchMode === -1) {
          let bestIdx = -1, bestVal = -Infinity;
          for (const i of indices) {
            const nv = Number(lookupArr[i]);
            if (!isNaN(nv) && nv <= Number(lookupVal) && nv > bestVal) { bestVal = nv; bestIdx = i; }
          }
          if (bestIdx >= 0) return String(bestIdx + 1);
        } else if (matchMode === 1) {
          let bestIdx = -1, bestVal = Infinity;
          for (const i of indices) {
            const nv = Number(lookupArr[i]);
            if (!isNaN(nv) && nv >= Number(lookupVal) && nv < bestVal) { bestVal = nv; bestIdx = i; }
          }
          if (bestIdx >= 0) return String(bestIdx + 1);
        }
        return '"#N/A"';
      }
      case 'FILTER': {
        const p = a();
        const dataRows = _getRangeArray(p[0].trim(), deps, selfKey);
        const includeArr = _collectRangeValues(p[1].trim(), deps, selfKey);
        const ifEmpty = p.length > 2 ? _evalSub(p[2], deps, selfKey) : '#CALC!';
        const result = [];
        for (let i = 0; i < dataRows.length && i < includeArr.length; ++i) {
          const inc = includeArr[i];
          if (inc && inc !== 0 && inc !== '0' && inc !== false && inc !== 'false' && inc !== 'FALSE')
            result.push(dataRows[i]);
        }
        if (!result.length) return _cellValueToJS(ifEmpty);
        if (result.length === 1 && result[0].length === 1) return _cellValueToJS(result[0][0]);
        return _cellValueToJS(result[0][0]);
      }
      case 'SORT': {
        const p = a();
        const dataRows = _getRangeArray(p[0].trim(), deps, selfKey);
        const sortIdx = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) - 1 : 0;
        const sortOrder = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) : 1;
        const byCol = p.length > 3 ? (_evalSub(p[3], deps, selfKey) === true || _evalSub(p[3], deps, selfKey) === 'TRUE') : false;
        if (byCol) {
          if (!dataRows.length) return '0';
          const colCount = dataRows[0].length;
          const colArrays = [];
          for (let c = 0; c < colCount; ++c) {
            const col = [];
            for (let r = 0; r < dataRows.length; ++r) col.push(dataRows[r][c]);
            colArrays.push(col);
          }
          colArrays.sort((ca, cb) => {
            const va = ca[sortIdx], vb = cb[sortIdx];
            const na = Number(va), nb = Number(vb);
            if (!isNaN(na) && !isNaN(nb)) return sortOrder === 1 ? na - nb : nb - na;
            return sortOrder === 1 ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
          });
          return _cellValueToJS(colArrays[0] ? colArrays[0][0] : 0);
        }
        dataRows.sort((ra, rb) => {
          const va = ra[sortIdx], vb = rb[sortIdx];
          const na = Number(va), nb = Number(vb);
          if (!isNaN(na) && !isNaN(nb)) return sortOrder === 1 ? na - nb : nb - na;
          return sortOrder === 1 ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        if (dataRows.length && dataRows[0].length) return _cellValueToJS(dataRows[0][0]);
        return '0';
      }
      case 'UNIQUE': {
        const p = a();
        const dataRows = _getRangeArray(p[0].trim(), deps, selfKey);
        const byCol = p.length > 1 ? (_evalSub(p[1], deps, selfKey) === true || _evalSub(p[1], deps, selfKey) === 'TRUE') : false;
        const exactlyOnce = p.length > 2 ? (_evalSub(p[2], deps, selfKey) === true || _evalSub(p[2], deps, selfKey) === 'TRUE') : false;
        if (byCol) {
          if (!dataRows.length) return '0';
          const colCount = dataRows[0].length;
          const colKeys = {};
          for (let c = 0; c < colCount; ++c) {
            const key = dataRows.map(r => String(r[c])).join('\x00');
            colKeys[key] = (colKeys[key] || 0) + 1;
          }
          for (let c = 0; c < colCount; ++c) {
            const key = dataRows.map(r => String(r[c])).join('\x00');
            if (exactlyOnce ? colKeys[key] === 1 : true) return _cellValueToJS(dataRows[0][c]);
          }
          return '0';
        }
        const rowKeys = {};
        for (let r = 0; r < dataRows.length; ++r) {
          const key = dataRows[r].map(v => String(v)).join('\x00');
          rowKeys[key] = (rowKeys[key] || 0) + 1;
        }
        const seen = new Set();
        for (let r = 0; r < dataRows.length; ++r) {
          const key = dataRows[r].map(v => String(v)).join('\x00');
          if (seen.has(key)) continue;
          seen.add(key);
          if (exactlyOnce && rowKeys[key] !== 1) continue;
          return _cellValueToJS(dataRows[r][0]);
        }
        return '0';
      }
      case 'TEXTJOIN': {
        const p = a();
        const delimiter = _evalSubStr(p[0], deps, selfKey);
        const ignoreEmpty = _evalSub(p[1], deps, selfKey);
        const skip = (ignoreEmpty && ignoreEmpty !== 0 && ignoreEmpty !== '0' && ignoreEmpty !== false && ignoreEmpty !== 'FALSE');
        const textParts = [];
        for (let i = 2; i < p.length; ++i) {
          const trimmed = p[i].trim();
          const rangeMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
          if (rangeMatch) {
            const rangeVals = _collectRangeValues(trimmed, deps, selfKey);
            for (const v of rangeVals) {
              const sv = String(v === null || v === undefined ? '' : v);
              if (skip && sv === '') continue;
              textParts.push(sv);
            }
          } else {
            const sv = _evalSubStr(trimmed, deps, selfKey);
            if (skip && sv === '') continue;
            textParts.push(sv);
          }
        }
        return '"' + textParts.join(delimiter) + '"';
      }
      case 'MINIFS': {
        const p = a();
        const minRange = _collectRangeNumericValues(p[0].trim(), deps, selfKey);
        const criteriaRange = _collectRangeValues(p[1].trim(), deps, selfKey);
        const criteria = _evalSub(p[2].trim(), deps, selfKey);
        let result = Infinity;
        for (let i = 0; i < criteriaRange.length && i < minRange.length; ++i)
          if (_conditionMatch(criteria, criteriaRange[i]) && minRange[i] < result) result = minRange[i];
        return String(result === Infinity ? 0 : result);
      }
      case 'MAXIFS': {
        const p = a();
        const maxRange = _collectRangeNumericValues(p[0].trim(), deps, selfKey);
        const criteriaRange = _collectRangeValues(p[1].trim(), deps, selfKey);
        const criteria = _evalSub(p[2].trim(), deps, selfKey);
        let result = -Infinity;
        for (let i = 0; i < criteriaRange.length && i < maxRange.length; ++i)
          if (_conditionMatch(criteria, criteriaRange[i]) && maxRange[i] > result) result = maxRange[i];
        return String(result === -Infinity ? 0 : result);
      }
      case 'CEILING.MATH': {
        const p = a();
        const number = _evalSubNum(p[0], deps, selfKey);
        const significance = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1;
        const mode = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) : 0;
        if (significance === 0) return '0';
        if (number < 0 && mode !== 0) return String(-Math.floor(Math.abs(number) / Math.abs(significance)) * Math.abs(significance));
        return String(Math.ceil(number / significance) * significance);
      }
      case 'FLOOR.MATH': {
        const p = a();
        const number = _evalSubNum(p[0], deps, selfKey);
        const significance = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1;
        const mode = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) : 0;
        if (significance === 0) return '0';
        if (number < 0 && mode !== 0) return String(-Math.ceil(Math.abs(number) / Math.abs(significance)) * Math.abs(significance));
        return String(Math.floor(number / significance) * significance);
      }
      case 'AGGREGATE': {
        const p = a();
        const funcNum = _evalSubNum(p[0], deps, selfKey);
        const options = _evalSubNum(p[1], deps, selfKey);
        const rawVals = _collectRangeValues(p.slice(2).join(','), deps, selfKey);
        let filtered = rawVals;
        if (options === 6 || options === 7)
          filtered = filtered.filter(v => !(typeof v === 'string' && String(v).startsWith('#')));
        const numVals = filtered.filter(v => typeof v === 'number' && !isNaN(v));
        switch (funcNum) {
          case 1: return String(numVals.length ? numVals.reduce((s, v) => s + v, 0) / numVals.length : 0);
          case 2: return String(numVals.length);
          case 3: return String(filtered.filter(v => v !== '' && v !== null && v !== undefined).length);
          case 4: return String(numVals.length ? Math.max(...numVals) : 0);
          case 5: return String(numVals.length ? Math.min(...numVals) : 0);
          case 6: return String(numVals.reduce((p2, v) => p2 * v, 1));
          case 7: { if (numVals.length < 2) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(Math.sqrt(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / (numVals.length - 1))); }
          case 8: { if (!numVals.length) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(Math.sqrt(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / numVals.length)); }
          case 9: return String(numVals.reduce((s, v) => s + v, 0));
          case 10: { if (numVals.length < 2) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / (numVals.length - 1)); }
          case 11: { if (!numVals.length) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / numVals.length); }
          case 12: { const sorted = [...numVals].sort((x, y) => x - y); const m = Math.floor(sorted.length / 2); return String(sorted.length % 2 ? sorted[m] : (sorted.length ? (sorted[m - 1] + sorted[m]) / 2 : 0)); }
          case 13: { const freq = {}; for (const v of numVals) freq[v] = (freq[v] || 0) + 1; let best = numVals[0], bestCnt = 0; for (const [k, c] of Object.entries(freq)) if (c > bestCnt) { best = Number(k); bestCnt = c; } return String(best || 0); }
          case 14: { const k = _evalSubNum(p[p.length - 1], deps, selfKey); const sorted = [...numVals].sort((x, y) => y - x); return String(sorted[k - 1] || 0); }
          case 15: { const k = _evalSubNum(p[p.length - 1], deps, selfKey); const sorted = [...numVals].sort((x, y) => x - y); return String(sorted[k - 1] || 0); }
          default: return '0';
        }
      }
      case 'ROMAN': {
        let num = Math.floor(Math.abs(_evalSubNum(args, deps, selfKey)));
        if (num <= 0 || num > 3999) return '"#VALUE!"';
        const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        for (let i = 0; i < vals.length; ++i)
          while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
        return '"' + result + '"';
      }
      case 'ARABIC': {
        const text = _evalSubStr(args, deps, selfKey).toUpperCase().trim();
        const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let result = 0;
        for (let i = 0; i < text.length; ++i) {
          const cur = map[text[i]] || 0;
          const next = i + 1 < text.length ? (map[text[i + 1]] || 0) : 0;
          if (cur < next) result -= cur;
          else result += cur;
        }
        return String(result);
      }
      case 'BASE': {
        const p = a();
        const number = Math.floor(_evalSubNum(p[0], deps, selfKey));
        const radix = _evalSubNum(p[1], deps, selfKey);
        const minLen = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) : 0;
        if (radix < 2 || radix > 36) return '"#VALUE!"';
        let result = Math.abs(number).toString(radix).toUpperCase();
        while (result.length < minLen) result = '0' + result;
        if (number < 0) result = '-' + result;
        return '"' + result + '"';
      }
      case 'DECIMAL': {
        const p = a();
        const text = _evalSubStr(p[0], deps, selfKey).trim();
        const radix = _evalSubNum(p[1], deps, selfKey);
        if (radix < 2 || radix > 36) return '"#VALUE!"';
        const result = parseInt(text, radix);
        return isNaN(result) ? '"#VALUE!"' : String(result);
      }
      case 'SUBTOTAL': {
        const p = a();
        const funcNum = _evalSubNum(p[0], deps, selfKey);
        const dataArgs = p.slice(1).join(',');
        const numVals = _collectRangeNumericValues(dataArgs, deps, selfKey);
        const allVals = _collectRangeValues(dataArgs, deps, selfKey);
        const fn = funcNum > 100 ? funcNum - 100 : funcNum;
        switch (fn) {
          case 1: return String(numVals.length ? numVals.reduce((s, v) => s + v, 0) / numVals.length : 0);
          case 2: return String(numVals.length);
          case 3: return String(allVals.filter(v => v !== '' && v !== null && v !== undefined).length);
          case 4: return String(numVals.length ? Math.max(...numVals) : 0);
          case 5: return String(numVals.length ? Math.min(...numVals) : 0);
          case 6: return String(numVals.reduce((pr, v) => pr * v, 1));
          case 7: { if (numVals.length < 2) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(Math.sqrt(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / (numVals.length - 1))); }
          case 8: { if (!numVals.length) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(Math.sqrt(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / numVals.length)); }
          case 9: return String(numVals.reduce((s, v) => s + v, 0));
          case 10: { if (numVals.length < 2) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / (numVals.length - 1)); }
          case 11: { if (!numVals.length) return '0'; const avg = numVals.reduce((s, v) => s + v, 0) / numVals.length; return String(numVals.reduce((s, v) => s + (v - avg) ** 2, 0) / numVals.length); }
          default: return '0';
        }
      }

      default: return '0';
    }
  }

  function _formatNumberWithPattern(val, fmt) {
    return formatNumberCustom(val, fmt);
  }

  // ── Full Excel-style custom number format parser ──────────────────
  function formatNumberCustom(value, formatCode) {
    if (!formatCode || formatCode === 'General' || formatCode === 'general')
      return String(value);

    // Split into sections: positive;negative;zero;text
    const sections = _splitFormatSections(formatCode);
    const num = typeof value === 'number' ? value : parseFloat(value);
    const isText = isNaN(num);

    // Select section
    let section;
    if (isText) {
      section = sections.length >= 4 ? sections[3] : (sections[0] || '@');
      return _applyTextSection(section, String(value));
    }

    // Check for conditional sections [>100], [<=50], etc.
    const condResult = _tryConditionalFormat(sections, num);
    if (condResult !== null) return condResult;

    if (num > 0) section = sections[0];
    else if (num < 0) section = sections.length >= 2 ? sections[1] : ('-' + sections[0]);
    else section = sections.length >= 3 ? sections[2] : sections[0];

    return _applyNumberSection(section, num);
  }

  function _splitFormatSections(code) {
    const sections = [];
    let depth = 0, inQuote = false, current = '';
    for (let i = 0; i < code.length; ++i) {
      const ch = code[i];
      if (ch === '"') { inQuote = !inQuote; current += ch; continue; }
      if (inQuote) { current += ch; continue; }
      if (ch === '[') ++depth;
      if (ch === ']') --depth;
      if (ch === ';' && depth === 0) { sections.push(current); current = ''; }
      else current += ch;
    }
    sections.push(current);
    return sections;
  }

  function _tryConditionalFormat(sections, num) {
    for (let i = 0; i < sections.length; ++i) {
      const condMatch = sections[i].match(/^\[([<>=!]+)([\d.]+)\]/);
      if (condMatch) {
        const op = condMatch[1], threshold = parseFloat(condMatch[2]);
        const rest = sections[i].substring(condMatch[0].length);
        let match = false;
        switch (op) {
          case '>': match = num > threshold; break;
          case '<': match = num < threshold; break;
          case '>=': match = num >= threshold; break;
          case '<=': match = num <= threshold; break;
          case '=': match = num === threshold; break;
          case '<>': case '!=': match = num !== threshold; break;
        }
        if (match) return _applyNumberSection(rest, num);
      }
    }
    return null;
  }

  function _extractColor(section) {
    const colorMatch = section.match(/^\[(Red|Blue|Green|Yellow|Magenta|Cyan|White|Black)\]/i);
    if (colorMatch)
      return { color: colorMatch[1].toLowerCase(), rest: section.substring(colorMatch[0].length) };
    return { color: null, rest: section };
  }

  function _applyTextSection(section, text) {
    const { rest } = _extractColor(section);
    return rest.replace(/@/g, text).replace(/"([^"]*)"/g, '$1');
  }

  function _applyNumberSection(section, num) {
    const { rest } = _extractColor(section);
    let fmt = rest;

    // Remove conditional brackets if present
    fmt = fmt.replace(/^\[[<>=!]+[\d.]+\]/, '');

    // Handle percentage
    const hasPct = fmt.includes('%');
    if (hasPct) num = num * 100;

    // Handle scientific notation
    const sciMatch = fmt.match(/E([+-])0+/i);
    if (sciMatch) return _formatScientific(num, fmt);

    // Handle date/time tokens
    if (/[ymdhs]/i.test(fmt) && !/[#0]/.test(fmt))
      return _formatDateTime(num, fmt);

    const useNeg = num < 0;
    let absNum = Math.abs(num);

    // Count decimal places from format
    const dotIdx = fmt.indexOf('.');
    let decPlaces = 0;
    if (dotIdx >= 0) {
      let j = dotIdx + 1;
      while (j < fmt.length && (fmt[j] === '0' || fmt[j] === '#')) { ++decPlaces; ++j; }
    }

    // Handle thousands separator
    const hasComma = fmt.includes(',') && (fmt.includes('#') || fmt.includes('0'));
    // Trailing commas = divide by 1000
    const trailingCommas = (fmt.match(/,+(?=[;\]"]|$)/g) || []).join('').length;
    if (trailingCommas > 0) absNum = absNum / Math.pow(1000, trailingCommas);

    // Format the number
    let fixed = absNum.toFixed(decPlaces);
    let [intPart, decPart] = fixed.split('.');
    if (!decPart) decPart = '';

    // Apply integer format
    const intFmt = (dotIdx >= 0 ? fmt.substring(0, dotIdx) : fmt).replace(/[^#0,]/g, '');
    const minIntDigits = (intFmt.match(/0/g) || []).length;
    while (intPart.length < minIntDigits) intPart = '0' + intPart;
    // Remove leading zeros for # tokens
    if (minIntDigits === 0 && intPart === '0' && (decPart !== '' || absNum === 0)) {
      // Keep a single 0 if the format has no # at all
      const hasHash = intFmt.includes('#');
      if (hasHash && absNum === 0) intPart = '';
    }

    // Apply thousands separator
    if (hasComma && !trailingCommas)
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Apply decimal format
    if (dotIdx >= 0) {
      const decFmt = fmt.substring(dotIdx + 1).replace(/[^#0]/g, '');
      while (decPart.length < decFmt.length) decPart += '0';
      // Trim trailing zeros for # tokens in decimal part
      let lastRequired = -1;
      for (let i = 0; i < decFmt.length; ++i)
        if (decFmt[i] === '0') lastRequired = i;
      if (lastRequired >= 0) decPart = decPart.substring(0, Math.max(lastRequired + 1, decPart.replace(/0+$/, '').length));
      else decPart = decPart.replace(/0+$/, '');
    }

    let result = intPart + (decPart ? '.' + decPart : '');
    if (useNeg && result !== '0' && result !== '') result = '-' + result;
    if (hasPct) result += '%';

    // Insert literal text from format
    result = _insertLiterals(fmt, result, hasPct);

    return result;
  }

  function _insertLiterals(fmt, result, hasPct) {
    // Extract quoted strings and place them
    let output = result;
    const literals = [];
    fmt.replace(/"([^"]*)"/g, (match, text, offset) => {
      literals.push({ text, offset });
    });
    if (literals.length) {
      // Simple approach: prepend/append literals found before/after the number pattern
      let prefix = '', suffix = '';
      for (const lit of literals) {
        const before = fmt.substring(0, lit.offset);
        if (!/[#0.]/.test(before)) prefix += lit.text;
        else suffix += lit.text;
      }
      output = prefix + output + suffix;
    }
    return output;
  }

  function _formatScientific(num, fmt) {
    const sciMatch = fmt.match(/E([+-])(0+)/i);
    if (!sciMatch) return String(num);
    const expDigits = sciMatch[2].length;
    const dotIdx = fmt.indexOf('.');
    let decPlaces = 0;
    if (dotIdx >= 0) {
      let j = dotIdx + 1;
      while (j < fmt.length && (fmt[j] === '0' || fmt[j] === '#') && fmt[j] !== 'E' && fmt[j] !== 'e') { ++decPlaces; ++j; }
    }
    const exp = num === 0 ? 0 : Math.floor(Math.log10(Math.abs(num)));
    const mantissa = num / Math.pow(10, exp);
    let expStr = String(Math.abs(exp));
    while (expStr.length < expDigits) expStr = '0' + expStr;
    const sign = sciMatch[1] === '+' ? (exp >= 0 ? '+' : '-') : (exp >= 0 ? '' : '-');
    return mantissa.toFixed(decPlaces) + 'E' + sign + expStr;
  }

  function _formatDateTime(num, fmt) {
    const d = new Date(num);
    if (isNaN(d.getTime())) return String(num);
    let result = fmt;
    const h12 = /AM\/PM|am\/pm/i.test(result);
    let hours = d.getHours();
    let ampm = '';
    if (h12) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
    }
    result = result.replace(/yyyy/gi, String(d.getFullYear()));
    result = result.replace(/yy/gi, String(d.getFullYear()).slice(-2));
    result = result.replace(/mmmm/gi, ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()]);
    result = result.replace(/mmm/gi, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]);
    result = result.replace(/dd/gi, String(d.getDate()).padStart(2, '0'));
    result = result.replace(/\bd\b/gi, String(d.getDate()));
    // Handle mm for minutes vs months: mm after hh or before ss = minutes
    result = result.replace(/hh/gi, String(hours).padStart(2, '0'));
    result = result.replace(/\bh\b/gi, String(hours));
    // mm after h or before s = minutes
    result = result.replace(/(h[h ]?)(mm)/gi, (_, prefix, mm) => prefix + String(d.getMinutes()).padStart(2, '0'));
    result = result.replace(/(mm)([ ]?s)/gi, (_, mm, suffix) => String(d.getMinutes()).padStart(2, '0') + suffix);
    // Remaining mm = month
    result = result.replace(/mm/gi, String(d.getMonth() + 1).padStart(2, '0'));
    result = result.replace(/\bm\b/gi, String(d.getMonth() + 1));
    result = result.replace(/ss/gi, String(d.getSeconds()).padStart(2, '0'));
    result = result.replace(/\bs\b/gi, String(d.getSeconds()));
    result = result.replace(/AM\/PM/gi, ampm);
    result = result.replace(/"([^"]*)"/g, '$1');
    return result;
  }

  SS.FormulaEngine = { init, evaluateFormula, formatNumberCustom };
})();
