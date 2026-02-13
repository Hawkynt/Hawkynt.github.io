;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let leftText = '';
  let rightText = '';
  let leftFileName = 'Original';
  let rightFileName = 'Modified';
  let viewMode = 'side'; // 'side' | 'unified' | 'inline'
  let diffResult = null;
  let diffHunks = [];
  let currentDiffIndex = -1;
  let ignoreWhitespace = false;
  let ignoreCase = false;
  let ignoreLineEndings = false;
  let wordDiff = false;
  let editMode = true;
  let pendingFileTarget = null;

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const btnOpenLeft = document.getElementById('btn-open-left');
  const btnOpenRight = document.getElementById('btn-open-right');
  const btnSwap = document.getElementById('btn-swap');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnSide = document.getElementById('btn-side');
  const btnUnified = document.getElementById('btn-unified');
  const btnInline = document.getElementById('btn-inline');
  const btnPrevDiff = document.getElementById('btn-prev-diff');
  const btnNextDiff = document.getElementById('btn-next-diff');
  const statsEl = document.getElementById('stats');
  const optIgnoreWs = document.getElementById('opt-ignore-ws');
  const optIgnoreCase = document.getElementById('opt-ignore-case');
  const optIgnoreEol = document.getElementById('opt-ignore-eol');
  const optWordDiff = document.getElementById('opt-word-diff');
  const mainArea = document.getElementById('main-area');
  const panelLeft = document.getElementById('panel-left');
  const panelRight = document.getElementById('panel-right');
  const splitter = document.getElementById('splitter');
  const headerLeft = document.getElementById('header-left');
  const headerRight = document.getElementById('header-right');
  const contentLeft = document.getElementById('content-left');
  const contentRight = document.getElementById('content-right');
  const textareaLeft = document.getElementById('textarea-left');
  const textareaRight = document.getElementById('textarea-right');
  const statusLeftLines = document.getElementById('status-left-lines');
  const statusRightLines = document.getElementById('status-right-lines');
  const statusDiffPos = document.getElementById('status-diff-pos');

  // -----------------------------------------------------------------------
  // Title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const title = leftFileName + ' vs ' + rightFileName + ' - Diff Viewer';
    document.title = title;
    SZ.Dlls.User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Myers diff algorithm (LCS-based)
  // -----------------------------------------------------------------------
  function myersDiff(oldArr, newArr) {
    const N = oldArr.length;
    const M = newArr.length;
    const MAX = N + M;

    if (MAX === 0)
      return [];

    // For very large inputs, fall back to a simpler approach
    if (MAX > 20000)
      return simpleDiff(oldArr, newArr);

    const V = new Int32Array(2 * MAX + 2);
    const offset = MAX;
    const trace = [];

    V[offset + 1] = 0;

    for (let d = 0; d <= MAX; ++d) {
      const snapshot = new Int32Array(V);
      trace.push(snapshot);

      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && V[offset + k - 1] < V[offset + k + 1]))
          x = V[offset + k + 1];
        else
          x = V[offset + k - 1] + 1;

        let y = x - k;

        while (x < N && y < M && compareLines(oldArr[x], newArr[y]))
          ++x, ++y;

        V[offset + k] = x;

        if (x >= N && y >= M) {
          return backtrack(trace, offset, N, M, oldArr, newArr);
        }
      }
    }

    return simpleDiff(oldArr, newArr);
  }

  function backtrack(trace, offset, N, M, oldArr, newArr) {
    const edits = [];
    let x = N;
    let y = M;

    for (let d = trace.length - 1; d >= 0; --d) {
      const V = trace[d];
      const k = x - y;

      let prevK;
      if (k === -d || (k !== d && V[offset + k - 1] < V[offset + k + 1]))
        prevK = k + 1;
      else
        prevK = k - 1;

      const prevX = V[offset + prevK];
      const prevY = prevX - prevK;

      // Diagonal (equal lines)
      while (x > prevX && y > prevY) {
        --x;
        --y;
        edits.unshift({ type: 'equal', oldIdx: x, newIdx: y });
      }

      if (d > 0) {
        if (x === prevX) {
          // Insert
          --y;
          edits.unshift({ type: 'insert', newIdx: y });
        } else {
          // Delete
          --x;
          edits.unshift({ type: 'delete', oldIdx: x });
        }
      }
    }

    return edits;
  }

  function simpleDiff(oldArr, newArr) {
    // LCS-based fallback for large inputs
    const edits = [];
    const lcs = computeLCS(oldArr, newArr);
    let oi = 0, ni = 0, li = 0;

    while (oi < oldArr.length || ni < newArr.length) {
      if (li < lcs.length && oi === lcs[li].oldIdx && ni === lcs[li].newIdx) {
        edits.push({ type: 'equal', oldIdx: oi, newIdx: ni });
        ++oi;
        ++ni;
        ++li;
      } else if (oi < oldArr.length && (li >= lcs.length || oi < lcs[li].oldIdx)) {
        edits.push({ type: 'delete', oldIdx: oi });
        ++oi;
      } else {
        edits.push({ type: 'insert', newIdx: ni });
        ++ni;
      }
    }

    return edits;
  }

  function computeLCS(oldArr, newArr) {
    // Hunt-Szymanski inspired simple LCS for large files
    const N = oldArr.length;
    const M = newArr.length;

    // Build hash map of new lines
    const newMap = new Map();
    for (let j = 0; j < M; ++j) {
      const line = normalizeForCompare(newArr[j]);
      if (!newMap.has(line))
        newMap.set(line, []);
      newMap.get(line).push(j);
    }

    // Patience-like: find matching pairs greedily
    const result = [];
    let lastJ = -1;

    for (let i = 0; i < N; ++i) {
      const line = normalizeForCompare(oldArr[i]);
      const positions = newMap.get(line);
      if (!positions)
        continue;

      // Find first position > lastJ
      for (const j of positions) {
        if (j > lastJ) {
          result.push({ oldIdx: i, newIdx: j });
          lastJ = j;
          break;
        }
      }
    }

    return result;
  }

  function normalizeForCompare(line) {
    let s = line;
    if (ignoreLineEndings)
      s = s.replace(/\r$/g, '');
    if (ignoreCase)
      s = s.toLowerCase();
    if (ignoreWhitespace)
      s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function compareLines(a, b) {
    return normalizeForCompare(a) === normalizeForCompare(b);
  }

  // -----------------------------------------------------------------------
  // Build diff hunks from edit script
  // -----------------------------------------------------------------------
  function buildDiffHunks(edits, oldLines, newLines) {
    const hunks = [];
    let i = 0;

    while (i < edits.length) {
      const edit = edits[i];

      if (edit.type === 'equal') {
        hunks.push({
          type: 'equal',
          oldLine: oldLines[edit.oldIdx],
          newLine: newLines[edit.newIdx],
          oldNum: edit.oldIdx + 1,
          newNum: edit.newIdx + 1
        });
        ++i;
      } else if (edit.type === 'delete') {
        // Check if the next edit is an insert -- that makes it a modification
        if (i + 1 < edits.length && edits[i + 1].type === 'insert') {
          hunks.push({
            type: 'modified',
            oldLine: oldLines[edit.oldIdx],
            newLine: newLines[edits[i + 1].newIdx],
            oldNum: edit.oldIdx + 1,
            newNum: edits[i + 1].newIdx + 1
          });
          i += 2;
        } else {
          hunks.push({
            type: 'deleted',
            oldLine: oldLines[edit.oldIdx],
            oldNum: edit.oldIdx + 1
          });
          ++i;
        }
      } else if (edit.type === 'insert') {
        hunks.push({
          type: 'added',
          newLine: newLines[edit.newIdx],
          newNum: edit.newIdx + 1
        });
        ++i;
      } else
        ++i;
    }

    return hunks;
  }

  // -----------------------------------------------------------------------
  // Character-level diff (for modified lines)
  // -----------------------------------------------------------------------
  function charDiff(oldStr, newStr) {
    if (wordDiff)
      return wordLevelDiff(oldStr, newStr);

    const oldChars = Array.from(oldStr);
    const newChars = Array.from(newStr);
    const N = oldChars.length;
    const M = newChars.length;

    if (N === 0 && M === 0)
      return { oldParts: [], newParts: [] };
    if (N === 0)
      return { oldParts: [], newParts: [{ type: 'add', text: newStr }] };
    if (M === 0)
      return { oldParts: [{ type: 'del', text: oldStr }], newParts: [] };

    // Simple LCS for characters
    const dp = [];
    for (let i = 0; i <= N; ++i) {
      dp[i] = new Uint16Array(M + 1);
    }

    for (let i = 1; i <= N; ++i) {
      for (let j = 1; j <= M; ++j) {
        if (charsEqual(oldChars[i - 1], newChars[j - 1]))
          dp[i][j] = dp[i - 1][j - 1] + 1;
        else
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack
    const oldParts = [];
    const newParts = [];
    let oi = N, ni = M;

    const oldSegs = [];
    const newSegs = [];

    while (oi > 0 || ni > 0) {
      if (oi > 0 && ni > 0 && charsEqual(oldChars[oi - 1], newChars[ni - 1])) {
        oldSegs.unshift({ type: 'eq', ch: oldChars[oi - 1] });
        newSegs.unshift({ type: 'eq', ch: newChars[ni - 1] });
        --oi;
        --ni;
      } else if (ni > 0 && (oi === 0 || dp[oi][ni - 1] >= dp[oi - 1][ni])) {
        newSegs.unshift({ type: 'add', ch: newChars[ni - 1] });
        --ni;
      } else {
        oldSegs.unshift({ type: 'del', ch: oldChars[oi - 1] });
        --oi;
      }
    }

    // Merge consecutive segments of same type
    return {
      oldParts: mergeCharSegs(oldSegs),
      newParts: mergeCharSegs(newSegs)
    };
  }

  function charsEqual(a, b) {
    if (ignoreCase)
      return a.toLowerCase() === b.toLowerCase();
    return a === b;
  }

  function mergeCharSegs(segs) {
    const parts = [];
    let curType = null;
    let curText = '';

    for (const seg of segs) {
      if (seg.type !== curType) {
        if (curText)
          parts.push({ type: curType, text: curText });
        curType = seg.type;
        curText = seg.ch;
      } else
        curText += seg.ch;
    }
    if (curText)
      parts.push({ type: curType, text: curText });

    return parts;
  }

  // -----------------------------------------------------------------------
  // Word-level diff
  // -----------------------------------------------------------------------
  function wordLevelDiff(oldStr, newStr) {
    const oldWords = splitWords(oldStr);
    const newWords = splitWords(newStr);
    const N = oldWords.length;
    const M = newWords.length;

    const dp = [];
    for (let i = 0; i <= N; ++i)
      dp[i] = new Uint16Array(M + 1);

    for (let i = 1; i <= N; ++i) {
      for (let j = 1; j <= M; ++j) {
        if (wordsEqual(oldWords[i - 1], newWords[j - 1]))
          dp[i][j] = dp[i - 1][j - 1] + 1;
        else
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const oldSegs = [];
    const newSegs = [];
    let oi = N, ni = M;

    while (oi > 0 || ni > 0) {
      if (oi > 0 && ni > 0 && wordsEqual(oldWords[oi - 1], newWords[ni - 1])) {
        oldSegs.unshift({ type: 'eq', ch: oldWords[oi - 1] });
        newSegs.unshift({ type: 'eq', ch: newWords[ni - 1] });
        --oi;
        --ni;
      } else if (ni > 0 && (oi === 0 || dp[oi][ni - 1] >= dp[oi - 1][ni])) {
        newSegs.unshift({ type: 'add', ch: newWords[ni - 1] });
        --ni;
      } else {
        oldSegs.unshift({ type: 'del', ch: oldWords[oi - 1] });
        --oi;
      }
    }

    return {
      oldParts: mergeCharSegs(oldSegs),
      newParts: mergeCharSegs(newSegs)
    };
  }

  function splitWords(str) {
    return str.match(/\S+|\s+/g) || [];
  }

  function wordsEqual(a, b) {
    if (ignoreWhitespace && /^\s+$/.test(a) && /^\s+$/.test(b))
      return true;
    if (ignoreCase)
      return a.toLowerCase() === b.toLowerCase();
    return a === b;
  }

  // -----------------------------------------------------------------------
  // Compute diff
  // -----------------------------------------------------------------------
  function computeDiff() {
    let leftSrc = leftText;
    let rightSrc = rightText;
    if (ignoreLineEndings) {
      leftSrc = leftSrc.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      rightSrc = rightSrc.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    const oldLines = leftSrc.split('\n');
    const newLines = rightSrc.split('\n');

    const edits = myersDiff(oldLines, newLines);
    diffHunks = buildDiffHunks(edits, oldLines, newLines);
    currentDiffIndex = -1;

    updateStats();
    updateNavButtons();
    renderDiff();
    updateStatusBar();
  }

  function updateStats() {
    let adds = 0, dels = 0, mods = 0, eqs = 0;
    for (const h of diffHunks) {
      if (h.type === 'added') ++adds;
      else if (h.type === 'deleted') ++dels;
      else if (h.type === 'modified') ++mods;
      else ++eqs;
    }

    statsEl.innerHTML =
      '<span class="stat-add">+' + adds + '</span> ' +
      '<span class="stat-del">-' + dels + '</span> ' +
      '<span class="stat-mod">~' + mods + '</span> ' +
      '<span class="stat-eq">' + eqs + ' unchanged</span>';
  }

  function updateNavButtons() {
    const hasDiffs = diffHunks.some(h => h.type !== 'equal');
    btnPrevDiff.disabled = !hasDiffs;
    btnNextDiff.disabled = !hasDiffs;
  }

  // -----------------------------------------------------------------------
  // Escaping
  // -----------------------------------------------------------------------
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -----------------------------------------------------------------------
  // Render char-diff parts as HTML
  // -----------------------------------------------------------------------
  function renderCharParts(parts, side) {
    let html = '';
    for (const part of parts) {
      const text = escapeHtml(part.text);
      if (part.type === 'eq')
        html += text;
      else if (part.type === 'del')
        html += '<span class="char-del">' + text + '</span>';
      else if (part.type === 'add')
        html += '<span class="char-add">' + text + '</span>';
    }
    return html;
  }

  // -----------------------------------------------------------------------
  // Render diff - Side by side
  // -----------------------------------------------------------------------
  function renderSideBySide() {
    if (diffHunks.length === 0 && leftText === '' && rightText === '') {
      contentLeft.innerHTML = '<div class="empty-state">Paste text or open a file</div>';
      contentRight.innerHTML = '<div class="empty-state">Paste text or open a file</div>';
      return;
    }

    let leftHtml = '';
    let rightHtml = '';

    for (let i = 0; i < diffHunks.length; ++i) {
      const h = diffHunks[i];
      const isCurrent = i === currentDiffIndex;
      const currentCls = isCurrent ? ' current-diff' : '';

      if (h.type === 'equal') {
        leftHtml += '<div class="diff-line' + currentCls + '">' +
          '<div class="line-gutter"></div>' +
          '<div class="line-number">' + h.oldNum + '</div>' +
          '<div class="line-text">' + escapeHtml(h.oldLine) + '</div></div>';
        rightHtml += '<div class="diff-line' + currentCls + '">' +
          '<div class="line-gutter"></div>' +
          '<div class="line-number">' + h.newNum + '</div>' +
          '<div class="line-text">' + escapeHtml(h.newLine) + '</div></div>';
      } else if (h.type === 'deleted') {
        leftHtml += '<div class="diff-line deleted' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter">-</div>' +
          '<div class="line-number">' + h.oldNum + '</div>' +
          '<div class="line-text">' + escapeHtml(h.oldLine) + '</div></div>';
        rightHtml += '<div class="diff-line empty-placeholder' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter"></div>' +
          '<div class="line-number"></div>' +
          '<div class="line-text">&nbsp;</div></div>';
      } else if (h.type === 'added') {
        leftHtml += '<div class="diff-line empty-placeholder' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter"></div>' +
          '<div class="line-number"></div>' +
          '<div class="line-text">&nbsp;</div></div>';
        rightHtml += '<div class="diff-line added' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter">+</div>' +
          '<div class="line-number">' + h.newNum + '</div>' +
          '<div class="line-text">' + escapeHtml(h.newLine) + '</div></div>';
      } else if (h.type === 'modified') {
        const cd = charDiff(h.oldLine, h.newLine);
        leftHtml += '<div class="diff-line modified' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter">~</div>' +
          '<div class="line-number">' + h.oldNum + '</div>' +
          '<div class="line-text">' + renderCharParts(cd.oldParts, 'old') + '</div></div>';
        rightHtml += '<div class="diff-line modified' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-gutter">~</div>' +
          '<div class="line-number">' + h.newNum + '</div>' +
          '<div class="line-text">' + renderCharParts(cd.newParts, 'new') + '</div></div>';
      }
    }

    contentLeft.innerHTML = leftHtml;
    contentRight.innerHTML = rightHtml;
  }

  // -----------------------------------------------------------------------
  // Render diff - Unified
  // -----------------------------------------------------------------------
  function renderUnified() {
    if (diffHunks.length === 0 && leftText === '' && rightText === '') {
      contentLeft.innerHTML = '<div class="empty-state">Paste text or open files to see unified diff</div>';
      return;
    }

    // Group into unified hunks with context
    const CONTEXT = 3;
    const groups = [];
    let curGroup = null;

    for (let i = 0; i < diffHunks.length; ++i) {
      const h = diffHunks[i];
      if (h.type !== 'equal') {
        if (!curGroup) {
          curGroup = { start: Math.max(0, i - CONTEXT), entries: [] };
          // Add preceding context
          for (let c = Math.max(0, i - CONTEXT); c < i; ++c)
            curGroup.entries.push({ idx: c, hunk: diffHunks[c] });
        }
        curGroup.entries.push({ idx: i, hunk: h });
        curGroup.end = i;
      } else if (curGroup) {
        curGroup.entries.push({ idx: i, hunk: h });
        // Check if we are beyond the trailing context
        if (i - curGroup.end > CONTEXT) {
          groups.push(curGroup);
          curGroup = null;
        }
      }
    }
    if (curGroup)
      groups.push(curGroup);

    if (groups.length === 0 && diffHunks.length > 0) {
      contentLeft.innerHTML = '<div class="empty-state">Files are identical</div>';
      return;
    }

    let html = '';

    for (const group of groups) {
      // Hunk header
      const firstOld = group.entries.find(e => e.hunk.oldNum)?.hunk.oldNum || 1;
      const firstNew = group.entries.find(e => e.hunk.newNum)?.hunk.newNum || 1;
      html += '<div class="diff-line hunk-header">' +
        '<div class="line-gutter"></div>' +
        '<div class="line-number"></div>' +
        '<div class="line-number"></div>' +
        '<div class="line-text">@@ -' + firstOld + ' +' + firstNew + ' @@</div></div>';

      for (const entry of group.entries) {
        const h = entry.hunk;
        const isCurrent = entry.idx === currentDiffIndex;
        const currentCls = isCurrent ? ' current-diff' : '';

        if (h.type === 'equal') {
          html += '<div class="diff-line unified-ctx' + currentCls + '">' +
            '<div class="line-gutter"></div>' +
            '<div class="line-number">' + h.oldNum + '</div>' +
            '<div class="line-number">' + h.newNum + '</div>' +
            '<div class="line-text"> ' + escapeHtml(h.oldLine) + '</div></div>';
        } else if (h.type === 'deleted') {
          html += '<div class="diff-line unified-del' + currentCls + '" data-diff="' + entry.idx + '">' +
            '<div class="line-gutter">-</div>' +
            '<div class="line-number">' + h.oldNum + '</div>' +
            '<div class="line-number"></div>' +
            '<div class="line-text">-' + escapeHtml(h.oldLine) + '</div></div>';
        } else if (h.type === 'added') {
          html += '<div class="diff-line unified-add' + currentCls + '" data-diff="' + entry.idx + '">' +
            '<div class="line-gutter">+</div>' +
            '<div class="line-number"></div>' +
            '<div class="line-number">' + h.newNum + '</div>' +
            '<div class="line-text">+' + escapeHtml(h.newLine) + '</div></div>';
        } else if (h.type === 'modified') {
          html += '<div class="diff-line unified-del' + currentCls + '" data-diff="' + entry.idx + '">' +
            '<div class="line-gutter">-</div>' +
            '<div class="line-number">' + h.oldNum + '</div>' +
            '<div class="line-number"></div>' +
            '<div class="line-text">-' + escapeHtml(h.oldLine) + '</div></div>';
          html += '<div class="diff-line unified-add' + currentCls + '" data-diff="' + entry.idx + '">' +
            '<div class="line-gutter">+</div>' +
            '<div class="line-number"></div>' +
            '<div class="line-number">' + h.newNum + '</div>' +
            '<div class="line-text">+' + escapeHtml(h.newLine) + '</div></div>';
        }
      }
    }

    contentLeft.innerHTML = html;
  }

  // -----------------------------------------------------------------------
  // Render diff - Inline
  // -----------------------------------------------------------------------
  function renderInline() {
    if (diffHunks.length === 0 && leftText === '' && rightText === '') {
      contentLeft.innerHTML = '<div class="empty-state">Paste text or open files to see inline diff</div>';
      return;
    }

    let html = '';

    for (let i = 0; i < diffHunks.length; ++i) {
      const h = diffHunks[i];
      const isCurrent = i === currentDiffIndex;
      const currentCls = isCurrent ? ' current-diff' : '';
      const num = h.newNum || h.oldNum || '';

      if (h.type === 'equal') {
        html += '<div class="diff-line' + currentCls + '">' +
          '<div class="line-number">' + num + '</div>' +
          '<div class="line-text">' + escapeHtml(h.oldLine) + '</div></div>';
      } else if (h.type === 'deleted') {
        html += '<div class="diff-line' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-number">' + h.oldNum + '</div>' +
          '<div class="line-text"><span class="inline-del">' + escapeHtml(h.oldLine) + '</span></div></div>';
      } else if (h.type === 'added') {
        html += '<div class="diff-line' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-number">' + h.newNum + '</div>' +
          '<div class="line-text"><span class="inline-add">' + escapeHtml(h.newLine) + '</span></div></div>';
      } else if (h.type === 'modified') {
        const cd = charDiff(h.oldLine, h.newLine);
        let lineHtml = '';
        for (const p of cd.oldParts) {
          if (p.type === 'eq')
            lineHtml += escapeHtml(p.text);
          else if (p.type === 'del')
            lineHtml += '<span class="inline-del">' + escapeHtml(p.text) + '</span>';
        }
        for (const p of cd.newParts) {
          if (p.type === 'add')
            lineHtml += '<span class="inline-add">' + escapeHtml(p.text) + '</span>';
        }
        html += '<div class="diff-line' + currentCls + '" data-diff="' + i + '">' +
          '<div class="line-number">' + num + '</div>' +
          '<div class="line-text">' + lineHtml + '</div></div>';
      }
    }

    contentLeft.innerHTML = html;
  }

  // -----------------------------------------------------------------------
  // Render dispatch
  // -----------------------------------------------------------------------
  function renderDiff() {
    setupLayout();

    if (editMode) {
      contentLeft.innerHTML = '';
      contentLeft.appendChild(textareaLeft);
      contentRight.innerHTML = '';
      contentRight.appendChild(textareaRight);
      return;
    }

    if (viewMode === 'side')
      renderSideBySide();
    else if (viewMode === 'unified')
      renderUnified();
    else if (viewMode === 'inline')
      renderInline();
  }

  function setupLayout() {
    if (viewMode === 'side' || editMode) {
      panelLeft.style.display = '';
      splitter.style.display = '';
      panelRight.style.display = '';
      headerLeft.textContent = leftFileName;
      headerRight.textContent = rightFileName;
    } else {
      // Unified or inline: single panel
      panelLeft.style.display = '';
      splitter.style.display = 'none';
      panelRight.style.display = 'none';
      headerLeft.textContent = leftFileName + ' vs ' + rightFileName;
    }
  }

  // -----------------------------------------------------------------------
  // Synchronized scrolling (side-by-side)
  // -----------------------------------------------------------------------
  let syncingScroll = false;

  function syncScroll(source, target) {
    if (syncingScroll)
      return;
    syncingScroll = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    syncingScroll = false;
  }

  contentLeft.addEventListener('scroll', () => {
    if (viewMode === 'side' && !editMode)
      syncScroll(contentLeft, contentRight);
  });

  contentRight.addEventListener('scroll', () => {
    if (viewMode === 'side' && !editMode)
      syncScroll(contentRight, contentLeft);
  });

  // -----------------------------------------------------------------------
  // Splitter drag
  // -----------------------------------------------------------------------
  let splitterDragging = false;

  splitter.addEventListener('pointerdown', (e) => {
    splitterDragging = true;
    splitter.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  splitter.addEventListener('pointermove', (e) => {
    if (!splitterDragging)
      return;
    const rect = mainArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.max(20, Math.min(80, pct));
    panelLeft.style.flex = '0 0 ' + clamped + '%';
    panelRight.style.flex = '1';
  });

  splitter.addEventListener('pointerup', () => {
    splitterDragging = false;
  });

  splitter.addEventListener('lostpointercapture', () => {
    splitterDragging = false;
  });

  // -----------------------------------------------------------------------
  // Navigation between differences
  // -----------------------------------------------------------------------
  function getDiffIndices() {
    const indices = [];
    for (let i = 0; i < diffHunks.length; ++i) {
      if (diffHunks[i].type !== 'equal')
        indices.push(i);
    }
    return indices;
  }

  function navigateNextDiff() {
    const indices = getDiffIndices();
    if (indices.length === 0)
      return;

    let nextIdx = 0;
    for (let i = 0; i < indices.length; ++i) {
      if (indices[i] > currentDiffIndex) {
        nextIdx = i;
        break;
      }
      if (i === indices.length - 1)
        nextIdx = 0; // wrap
    }

    currentDiffIndex = indices[nextIdx];
    renderDiff();
    scrollToDiff(currentDiffIndex);
    updateStatusBar();
  }

  function navigatePrevDiff() {
    const indices = getDiffIndices();
    if (indices.length === 0)
      return;

    let prevIdx = indices.length - 1;
    for (let i = indices.length - 1; i >= 0; --i) {
      if (indices[i] < currentDiffIndex) {
        prevIdx = i;
        break;
      }
      if (i === 0)
        prevIdx = indices.length - 1; // wrap
    }

    currentDiffIndex = indices[prevIdx];
    renderDiff();
    scrollToDiff(currentDiffIndex);
    updateStatusBar();
  }

  function scrollToDiff(idx) {
    const el = contentLeft.querySelector('[data-diff="' + idx + '"]');
    if (el)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (viewMode === 'side') {
      const el2 = contentRight.querySelector('[data-diff="' + idx + '"]');
      if (el2)
        el2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // -----------------------------------------------------------------------
  // Update status bar
  // -----------------------------------------------------------------------
  function updateStatusBar() {
    const leftLines = leftText ? leftText.split('\n').length : 0;
    const rightLines = rightText ? rightText.split('\n').length : 0;
    statusLeftLines.textContent = 'Left: ' + leftLines + ' lines';
    statusRightLines.textContent = 'Right: ' + rightLines + ' lines';

    const indices = getDiffIndices();
    if (currentDiffIndex >= 0 && indices.length > 0) {
      const pos = indices.indexOf(currentDiffIndex) + 1;
      statusDiffPos.textContent = 'Diff ' + pos + ' of ' + indices.length;
    } else if (indices.length > 0)
      statusDiffPos.textContent = indices.length + ' differences';
    else if (diffHunks.length > 0)
      statusDiffPos.textContent = 'Files are identical';
    else
      statusDiffPos.textContent = '';
  }

  // -----------------------------------------------------------------------
  // Switch to diff mode (from edit mode)
  // -----------------------------------------------------------------------
  function enterDiffMode() {
    leftText = textareaLeft.value;
    rightText = textareaRight.value;
    editMode = false;
    computeDiff();
  }

  function refreshDiff() {
    if (editMode) {
      leftText = textareaLeft.value;
      rightText = textareaRight.value;
      if (leftText || rightText)
        enterDiffMode();
    } else
      computeDiff();
  }

  function enterEditMode() {
    editMode = true;
    diffHunks = [];
    currentDiffIndex = -1;
    statsEl.innerHTML = '';
    btnPrevDiff.disabled = true;
    btnNextDiff.disabled = true;
    renderDiff();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Textarea change detection -- auto-diff
  // -----------------------------------------------------------------------
  let diffTimeout = null;

  function scheduleDiff() {
    if (diffTimeout)
      clearTimeout(diffTimeout);
    diffTimeout = setTimeout(() => {
      if (editMode && (textareaLeft.value || textareaRight.value)) {
        leftText = textareaLeft.value;
        rightText = textareaRight.value;
        editMode = false;
        computeDiff();
      }
    }, 800);
  }

  textareaLeft.addEventListener('input', () => {
    leftText = textareaLeft.value;
    scheduleDiff();
  });

  textareaRight.addEventListener('input', () => {
    rightText = textareaRight.value;
    scheduleDiff();
  });

  // Allow switching back to edit with double-click on panels in diff mode
  contentLeft.addEventListener('dblclick', (e) => {
    if (!editMode && e.target.closest('.empty-state'))
      enterEditMode();
  });

  contentRight.addEventListener('dblclick', (e) => {
    if (!editMode && e.target.closest('.empty-state'))
      enterEditMode();
  });

  // -----------------------------------------------------------------------
  // Toolbar events
  // -----------------------------------------------------------------------
  btnOpenLeft.addEventListener('click', () => openFile('left'));
  btnOpenRight.addEventListener('click', () => openFile('right'));
  btnSwap.addEventListener('click', swapSides);
  btnRefresh.addEventListener('click', refreshDiff);
  btnSide.addEventListener('click', () => setViewMode('side'));
  btnUnified.addEventListener('click', () => setViewMode('unified'));
  btnInline.addEventListener('click', () => setViewMode('inline'));
  btnPrevDiff.addEventListener('click', navigatePrevDiff);
  btnNextDiff.addEventListener('click', navigateNextDiff);

  optIgnoreWs.addEventListener('change', () => {
    ignoreWhitespace = optIgnoreWs.checked;
    if (!editMode)
      computeDiff();
  });

  optIgnoreCase.addEventListener('change', () => {
    ignoreCase = optIgnoreCase.checked;
    if (!editMode)
      computeDiff();
  });

  optIgnoreEol.addEventListener('change', () => {
    ignoreLineEndings = optIgnoreEol.checked;
    if (!editMode)
      computeDiff();
  });

  optWordDiff.addEventListener('change', () => {
    wordDiff = optWordDiff.checked;
    if (!editMode)
      renderDiff();
  });

  function setViewMode(mode) {
    viewMode = mode;
    btnSide.classList.toggle('active', mode === 'side');
    btnUnified.classList.toggle('active', mode === 'unified');
    btnInline.classList.toggle('active', mode === 'inline');

    if (editMode && (textareaLeft.value || textareaRight.value))
      enterDiffMode();
    else if (!editMode)
      renderDiff();
  }

  async function openFile(side) {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Text Files', ext: ['txt', 'md', 'js', 'css', 'html', 'json', 'xml', 'csv'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: side === 'left' ? 'Open Original File' : 'Open Modified File',
    });

    if (result.cancelled || !result.path)
      return;

    let text = '';
    if (result.content != null) {
      if (typeof result.content === 'string') {
        // Try base64 decode, fall back to raw string
        try {
          text = atob(result.content);
        } catch (_) {
          text = result.content;
        }
      }
    }

    const parts = result.path.split('/');
    const name = parts[parts.length - 1] || 'Untitled';

    if (side === 'left') {
      leftText = text;
      leftFileName = name;
      textareaLeft.value = text;
    } else {
      rightText = text;
      rightFileName = name;
      textareaRight.value = text;
    }

    updateTitle();

    if (leftText && rightText)
      enterDiffMode();
    else {
      editMode = true;
      renderDiff();
      updateStatusBar();
    }
  }

  function swapSides() {
    const tmpText = leftText;
    const tmpName = leftFileName;
    leftText = rightText;
    leftFileName = rightFileName;
    rightText = tmpText;
    rightFileName = tmpName;
    textareaLeft.value = leftText;
    textareaRight.value = rightText;
    updateTitle();

    if (!editMode)
      computeDiff();
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      navigateNextDiff();
      return;
    }
    if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      navigatePrevDiff();
      return;
    }

    // Enter to run diff when in edit mode
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (editMode)
        enterDiffMode();
      else
        enterEditMode();
      return;
    }
  });

  // -----------------------------------------------------------------------
  // Drag and drop support
  // -----------------------------------------------------------------------
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0)
      return;

    const dropX = e.clientX;
    const mainRect = mainArea.getBoundingClientRect();
    const isLeftSide = dropX < mainRect.left + mainRect.width / 2;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (isLeftSide || files.length >= 2) {
        leftText = text;
        leftFileName = files[0].name;
        textareaLeft.value = text;
      }
      if (!isLeftSide || files.length >= 2) {
        const fileIdx = files.length >= 2 ? 1 : 0;
        if (fileIdx === 0 && isLeftSide)
          return;
        const rdr2 = new FileReader();
        rdr2.onload = () => {
          rightText = rdr2.result;
          rightFileName = files[fileIdx].name;
          textareaRight.value = rdr2.result;
          updateTitle();
          if (leftText && rightText)
            enterDiffMode();
        };
        rdr2.readAsText(files[fileIdx]);
        return;
      }
      updateTitle();
      if (leftText && rightText)
        enterDiffMode();
    };
    reader.readAsText(files[0]);

    // Handle two files dropped at once
    if (files.length >= 2) {
      const reader1 = new FileReader();
      reader1.onload = () => {
        leftText = reader1.result;
        leftFileName = files[0].name;
        textareaLeft.value = reader1.result;

        const reader2 = new FileReader();
        reader2.onload = () => {
          rightText = reader2.result;
          rightFileName = files[1].name;
          textareaRight.value = reader2.result;
          updateTitle();
          enterDiffMode();
        };
        reader2.readAsText(files[1]);
      };
      reader1.readAsText(files[0]);
      return;
    }
  });

  // -----------------------------------------------------------------------
  // Resize observer
  // -----------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(() => {
    if (!editMode)
      renderDiff();
  });
  resizeObserver.observe(mainArea);

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    updateTitle();
    setupLayout();
    updateStatusBar();
    textareaLeft.focus();
  }

  init();
})();
