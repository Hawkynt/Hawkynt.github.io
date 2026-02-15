;(function() {
  'use strict';

  // ===== Common patterns library =====

  const COMMON_PATTERNS = [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'gi', test: 'user@example.com\ninvalid@.com\ntest.name+tag@domain.co.uk' },
    { name: 'URL', pattern: 'https?://[^\\s/$.?#][^\\s]*', flags: 'gi', test: 'Visit https://example.com or http://test.org/path?q=1' },
    { name: 'Phone (US)', pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', flags: 'g', test: '(555) 123-4567\n555.123.4567\n5551234567' },
    { name: 'IPv4', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b', flags: 'g', test: '192.168.1.1\n10.0.0.255\n256.1.1.1\n127.0.0.1' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', test: '2024-01-15\n2023-12-31\n2024-13-01' },
    { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'gi', test: '#fff\n#FF5733\n#abcdef\n#xyz' },
    { name: 'HTML Tag', pattern: '<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>(.*?)</\\1>', flags: 'gi', test: '<div class="main">content</div>\n<p>text</p>' },
    { name: 'Integer', pattern: '-?\\d+', flags: 'g', test: '42 -17 0 +5 3.14 100' },
    { name: 'Float', pattern: '-?\\d+\\.\\d+', flags: 'g', test: '3.14 -2.5 42 0.001 .5' },
    { name: 'Word', pattern: '\\b[A-Za-z]+\\b', flags: 'g', test: 'Hello World 123 test_case' },
  ];

  // ===== DOM references =====

  const regexInput = document.getElementById('regex-input');
  const testInput = document.getElementById('test-input');
  const substInput = document.getElementById('subst-input');
  const testHighlight = document.getElementById('test-highlight');
  const lineNumbers = document.getElementById('line-numbers');
  const errorBar = document.getElementById('error-bar');
  const matchList = document.getElementById('match-list');
  const matchCount = document.getElementById('match-count');
  const explainSection = document.getElementById('explain-section');
  const flagsDisplay = document.getElementById('flags-display');
  const replaceSection = document.getElementById('replace-section');
  const replaceResult = document.getElementById('replace-result');
  const matchTableSection = document.getElementById('match-table-section');
  const matchTable = document.getElementById('match-table');
  const middleSection = document.getElementById('middle-section');
  const splitterH = document.getElementById('splitter-h');
  const splitterV = document.getElementById('splitter-v');

  const flagCheckboxes = {
    g: document.getElementById('flag-g'),
    i: document.getElementById('flag-i'),
    m: document.getElementById('flag-m'),
    s: document.getElementById('flag-s'),
    u: document.getElementById('flag-u'),
  };

  // ===== State =====

  let debounceTimer = null;
  let lastMatches = [];
  let matchPanelWidth = 200;
  let matchTableHeight = 150;
  const DEBOUNCE_MS = 150;
  const HISTORY_KEY = 'sz-regex-tester-history';
  const MAX_HISTORY = 20;

  // ===== Utility =====

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFlags() {
    let flags = '';
    for (const [flag, cb] of Object.entries(flagCheckboxes))
      if (cb.checked)
        flags += flag;
    return flags;
  }

  function setFlags(flagStr) {
    for (const [flag, cb] of Object.entries(flagCheckboxes))
      cb.checked = flagStr.includes(flag);
    updateFlagsDisplay();
  }

  function updateFlagsDisplay() {
    flagsDisplay.textContent = getFlags();
  }

  function buildRegex(pattern, flags) {
    if (!pattern)
      return null;
    try {
      const re = new RegExp(pattern, flags);
      errorBar.textContent = '';
      return re;
    } catch (e) {
      errorBar.textContent = e.message;
      return null;
    }
  }

  // ===== Highlight matches in test string =====

  const GROUP_COLORS = ['hl-match', 'hl-group1', 'hl-group2', 'hl-group3', 'hl-group4', 'hl-group5'];

  function highlightMatches(text, regex) {
    if (!regex || !text) {
      testHighlight.innerHTML = escapeHtml(text || '') + '\n';
      return [];
    }

    const matches = [];
    const parts = [];
    let lastIndex = 0;

    // Ensure global flag for iteration
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const re = new RegExp(regex.source, flags);

    let m;
    let safety = 0;
    while ((m = re.exec(text)) !== null) {
      if (++safety > 10000)
        break;
      if (m[0].length === 0) {
        ++re.lastIndex;
        continue;
      }

      matches.push(m);

      // Text before match
      if (m.index > lastIndex)
        parts.push(escapeHtml(text.slice(lastIndex, m.index)));

      // The full match, highlighted
      parts.push('<span class="hl-match">' + escapeHtml(m[0]) + '</span>');
      lastIndex = m.index + m[0].length;
    }

    // Remainder
    if (lastIndex < text.length)
      parts.push(escapeHtml(text.slice(lastIndex)));

    // Trailing newline so the highlight div sizing matches the textarea
    testHighlight.innerHTML = parts.join('') + '\n';
    return matches;
  }

  // ===== Match details panel =====

  function renderMatchDetails(matches) {
    matchCount.textContent = matches.length + (matches.length === 1 ? ' match' : ' matches');

    if (matches.length === 0) {
      matchList.innerHTML = '<div style="color:#808080;font-style:italic;padding:4px;">No matches found.</div>';
      return;
    }

    const frags = [];
    for (let i = 0; i < matches.length; ++i) {
      const m = matches[i];
      frags.push('<div class="match-item">');
      frags.push('<div class="match-item-header">Match ' + (i + 1) + '</div>');
      frags.push('<div><span class="match-item-text">' + escapeHtml(m[0]) + '</span></div>');
      frags.push('<div class="match-item-pos">Position: ' + m.index + '-' + (m.index + m[0].length) + '</div>');

      // Capture groups
      if (m.length > 1) {
        for (let g = 1; g < m.length; ++g) {
          const groupName = m.groups ? Object.entries(m.groups).find(([, v]) => v === m[g]) : null;
          const label = groupName ? groupName[0] + ' (#' + g + ')' : '#' + g;
          const val = m[g] !== undefined ? escapeHtml(m[g]) : '<i>undefined</i>';
          const cls = GROUP_COLORS[g] || GROUP_COLORS[0];
          frags.push('<div class="match-group"><span class="match-group-label">Group ' + label + ':</span> <span class="match-group-value ' + cls + '">' + val + '</span></div>');
        }
      }

      frags.push('</div>');
    }

    matchList.innerHTML = frags.join('');
  }

  // ===== Match table =====

  function renderMatchTable(matches) {
    if (matches.length === 0) {
      matchTableSection.classList.remove('visible');
      applyGridLayout();
      return;
    }

    // Determine max group count across all matches
    let maxGroups = 0;
    for (const m of matches)
      if (m.length - 1 > maxGroups)
        maxGroups = m.length - 1;

    // Build group column headers using named groups when available
    const groupHeaders = [];
    const sampleWithNames = matches.find(m => m.groups);
    const namedKeys = sampleWithNames ? Object.keys(sampleWithNames.groups) : [];
    for (let g = 1; g <= maxGroups; ++g) {
      const named = namedKeys.length >= g ? namedKeys[g - 1] : null;
      groupHeaders.push(named ? named + ' (#' + g + ')' : '#' + g);
    }

    const frags = ['<thead><tr>'];
    frags.push('<th>Match</th><th>Position</th><th>Full Match</th>');
    for (let g = 0; g < groupHeaders.length; ++g) {
      const cls = GROUP_COLORS[g + 1] || GROUP_COLORS[0];
      frags.push('<th class="' + cls + '">' + escapeHtml(groupHeaders[g]) + '</th>');
    }
    frags.push('</tr></thead><tbody>');

    for (let i = 0; i < matches.length; ++i) {
      const m = matches[i];
      frags.push('<tr>');
      frags.push('<td>' + (i + 1) + '</td>');
      frags.push('<td>' + m.index + '-' + (m.index + m[0].length) + '</td>');
      frags.push('<td>' + escapeHtml(m[0]) + '</td>');
      for (let g = 1; g <= maxGroups; ++g)
        frags.push('<td>' + (m[g] !== undefined ? escapeHtml(m[g]) : '') + '</td>');
      frags.push('</tr>');
    }

    frags.push('</tbody>');
    matchTable.innerHTML = frags.join('');
    matchTableSection.classList.add('visible');
    applyGridLayout();
  }

  // ===== CSV / TSV export =====

  function exportTable(separator) {
    const matches = lastMatches;
    if (matches.length === 0)
      return;

    let maxGroups = 0;
    for (const m of matches)
      if (m.length - 1 > maxGroups)
        maxGroups = m.length - 1;

    const groupHeaders = [];
    const sampleWithNames = matches.find(m => m.groups);
    const namedKeys = sampleWithNames ? Object.keys(sampleWithNames.groups) : [];
    for (let g = 1; g <= maxGroups; ++g) {
      const named = namedKeys.length >= g ? namedKeys[g - 1] : null;
      groupHeaders.push(named ? named + ' (#' + g + ')' : '#' + g);
    }

    function quoteField(val) {
      const s = String(val);
      if (s.includes(separator) || s.includes('"') || s.includes('\n') || s.includes('\r'))
        return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    const rows = [];
    const header = ['Match', 'Position', 'Full Match'].concat(groupHeaders);
    rows.push(header.map(quoteField).join(separator));

    for (let i = 0; i < matches.length; ++i) {
      const m = matches[i];
      const cells = [
        i + 1,
        m.index + '-' + (m.index + m[0].length),
        m[0],
      ];
      for (let g = 1; g <= maxGroups; ++g)
        cells.push(m[g] !== undefined ? m[g] : '');
      rows.push(cells.map(quoteField).join(separator));
    }

    navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
  }

  document.getElementById('export-csv').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    exportTable(',');
  });

  document.getElementById('export-tsv').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    exportTable('\t');
  });

  // ===== Splitters =====

  function applyGridLayout() {
    const hasTable = matchTableSection.classList.contains('visible');
    middleSection.style.gridTemplateColumns = '1fr 4px ' + matchPanelWidth + 'px';
    if (hasTable) {
      middleSection.style.gridTemplateRows = '1fr 4px ' + matchTableHeight + 'px';
      splitterV.classList.add('visible');
    } else {
      middleSection.style.gridTemplateRows = '1fr';
      splitterV.classList.remove('visible');
    }
  }

  splitterH.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitterH.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = matchPanelWidth;

    function onMove(ev) {
      const delta = startX - ev.clientX;
      matchPanelWidth = Math.max(100, Math.min(middleSection.clientWidth - 150, startWidth + delta));
      applyGridLayout();
    }

    function onUp(ev) {
      splitterH.releasePointerCapture(ev.pointerId);
      splitterH.removeEventListener('pointermove', onMove);
      splitterH.removeEventListener('pointerup', onUp);
    }

    splitterH.addEventListener('pointermove', onMove);
    splitterH.addEventListener('pointerup', onUp);
  });

  splitterV.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitterV.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startHeight = matchTableHeight;

    function onMove(ev) {
      const delta = startY - ev.clientY;
      matchTableHeight = Math.max(40, Math.min(middleSection.clientHeight - 80, startHeight + delta));
      applyGridLayout();
    }

    function onUp(ev) {
      splitterV.releasePointerCapture(ev.pointerId);
      splitterV.removeEventListener('pointermove', onMove);
      splitterV.removeEventListener('pointerup', onUp);
    }

    splitterV.addEventListener('pointermove', onMove);
    splitterV.addEventListener('pointerup', onUp);
  });

  // ===== Replace preview =====

  function renderReplacePreview(text, regex, substPattern) {
    if (!regex || !substPattern) {
      replaceSection.classList.remove('visible');
      return;
    }

    replaceSection.classList.add('visible');
    try {
      const result = text.replace(regex, substPattern);
      replaceResult.textContent = result;
    } catch (e) {
      replaceResult.textContent = 'Error: ' + e.message;
    }
  }

  // ===== Line numbers =====

  function updateLineNumbers() {
    const text = testInput.value;
    const count = (text.match(/\n/g) || []).length + 1;
    const lines = [];
    for (let i = 1; i <= count; ++i)
      lines.push(i);
    lineNumbers.textContent = lines.join('\n');
  }

  // Sync scroll between textarea and overlay
  function syncScroll() {
    testHighlight.scrollTop = testInput.scrollTop;
    testHighlight.scrollLeft = testInput.scrollLeft;
    lineNumbers.style.top = (-testInput.scrollTop) + 'px';
  }

  // ===== Regex explanation =====

  function explainRegex(pattern) {
    if (!pattern) {
      explainSection.innerHTML = '';
      return;
    }

    const tokens = tokenizeRegex(pattern);
    const frags = [];
    for (const t of tokens) {
      frags.push('<span class="explain-token"><code>' + escapeHtml(t.raw) + '</code><span class="explain-sep"></span><span class="desc">' + escapeHtml(t.desc) + '</span></span> &nbsp; ');
    }
    explainSection.innerHTML = frags.join('');
  }

  function tokenizeRegex(pattern) {
    const tokens = [];
    let i = 0;

    while (i < pattern.length) {
      const ch = pattern[i];

      // Escaped sequences
      if (ch === '\\' && i + 1 < pattern.length) {
        const next = pattern[i + 1];
        const escMap = {
          'd': 'digit [0-9]',
          'D': 'non-digit',
          'w': 'word character [a-zA-Z0-9_]',
          'W': 'non-word character',
          's': 'whitespace',
          'S': 'non-whitespace',
          'b': 'word boundary',
          'B': 'non-word boundary',
          'n': 'newline',
          'r': 'carriage return',
          't': 'tab',
          '0': 'null character',
        };
        if (escMap[next]) {
          tokens.push({ raw: '\\' + next, desc: escMap[next] });
          i += 2;
          continue;
        }
        // Backreference \1-\9
        if (next >= '1' && next <= '9') {
          tokens.push({ raw: '\\' + next, desc: 'backreference to group ' + next });
          i += 2;
          continue;
        }
        // Escaped literal
        tokens.push({ raw: '\\' + next, desc: 'literal "' + next + '"' });
        i += 2;
        continue;
      }

      // Character class
      if (ch === '[') {
        let j = i + 1;
        if (j < pattern.length && pattern[j] === '^')
          ++j;
        if (j < pattern.length && pattern[j] === ']')
          ++j;
        while (j < pattern.length && pattern[j] !== ']') {
          if (pattern[j] === '\\' && j + 1 < pattern.length)
            ++j;
          ++j;
        }
        if (j < pattern.length)
          ++j;
        const raw = pattern.slice(i, j);
        const negated = raw[1] === '^';
        const inner = raw.slice(negated ? 2 : 1, -1);
        const desc = negated ? 'not one of: ' + inner : 'one of: ' + inner;
        tokens.push({ raw, desc });
        i = j;
        continue;
      }

      // Groups
      if (ch === '(') {
        // Lookaheads / lookbehinds / non-capturing / named
        if (pattern.slice(i, i + 3) === '(?=') {
          tokens.push({ raw: '(?=...)', desc: 'positive lookahead' });
          i += 3;
          continue;
        }
        if (pattern.slice(i, i + 3) === '(?!') {
          tokens.push({ raw: '(?!...)', desc: 'negative lookahead' });
          i += 3;
          continue;
        }
        if (pattern.slice(i, i + 4) === '(?<=') {
          tokens.push({ raw: '(?<=...)', desc: 'positive lookbehind' });
          i += 4;
          continue;
        }
        if (pattern.slice(i, i + 4) === '(?<!') {
          tokens.push({ raw: '(?<!...)', desc: 'negative lookbehind' });
          i += 4;
          continue;
        }
        if (pattern.slice(i, i + 3) === '(?:') {
          tokens.push({ raw: '(?:...)', desc: 'non-capturing group' });
          i += 3;
          continue;
        }
        const namedMatch = pattern.slice(i).match(/^\(\?<([^>]+)>/);
        if (namedMatch) {
          tokens.push({ raw: '(?<' + namedMatch[1] + '>...)', desc: 'named capture group "' + namedMatch[1] + '"' });
          i += namedMatch[0].length;
          continue;
        }
        tokens.push({ raw: '(', desc: 'start capturing group' });
        ++i;
        continue;
      }

      if (ch === ')') {
        tokens.push({ raw: ')', desc: 'end group' });
        ++i;
        continue;
      }

      // Quantifiers
      if (ch === '{') {
        const qm = pattern.slice(i).match(/^\{(\d+)(?:,(\d*))?\}/);
        if (qm) {
          const raw = qm[0];
          const min = qm[1];
          const max = qm[2];
          let desc;
          if (max === undefined)
            desc = 'exactly ' + min + ' times';
          else if (max === '')
            desc = min + ' or more times';
          else
            desc = min + ' to ' + max + ' times';
          tokens.push({ raw, desc });
          i += raw.length;
          // Check for lazy
          if (i < pattern.length && pattern[i] === '?') {
            tokens.push({ raw: '?', desc: 'lazy (fewest)' });
            ++i;
          }
          continue;
        }
        // Not a quantifier, literal brace
        tokens.push({ raw: '{', desc: 'literal "{"' });
        ++i;
        continue;
      }

      // Simple quantifiers
      if (ch === '*') {
        const lazy = (i + 1 < pattern.length && pattern[i + 1] === '?');
        if (lazy) {
          tokens.push({ raw: '*?', desc: '0 or more (lazy)' });
          i += 2;
        } else {
          tokens.push({ raw: '*', desc: '0 or more' });
          ++i;
        }
        continue;
      }
      if (ch === '+') {
        const lazy = (i + 1 < pattern.length && pattern[i + 1] === '?');
        if (lazy) {
          tokens.push({ raw: '+?', desc: '1 or more (lazy)' });
          i += 2;
        } else {
          tokens.push({ raw: '+', desc: '1 or more' });
          ++i;
        }
        continue;
      }
      if (ch === '?') {
        tokens.push({ raw: '?', desc: '0 or 1 (optional)' });
        ++i;
        continue;
      }

      // Anchors
      if (ch === '^') {
        tokens.push({ raw: '^', desc: 'start of string/line' });
        ++i;
        continue;
      }
      if (ch === '$') {
        tokens.push({ raw: '$', desc: 'end of string/line' });
        ++i;
        continue;
      }

      // Alternation
      if (ch === '|') {
        tokens.push({ raw: '|', desc: 'or' });
        ++i;
        continue;
      }

      // Dot
      if (ch === '.') {
        tokens.push({ raw: '.', desc: 'any character (except newline)' });
        ++i;
        continue;
      }

      // Literal character -- group consecutive literals
      let literal = '';
      while (i < pattern.length && !'\\[](){}*+?^$.|'.includes(pattern[i])) {
        literal += pattern[i];
        ++i;
      }
      if (literal.length > 0)
        tokens.push({ raw: literal, desc: literal.length === 1 ? 'literal "' + literal + '"' : 'literal "' + literal + '"' });
    }

    return tokens;
  }

  // ===== Core update =====

  function runUpdate() {
    const pattern = regexInput.value;
    const text = testInput.value;
    const flags = getFlags();
    const subst = substInput.value;

    updateFlagsDisplay();
    updateLineNumbers();

    const regex = buildRegex(pattern, flags);
    const matches = highlightMatches(text, regex);
    lastMatches = matches;
    renderMatchDetails(matches);
    renderMatchTable(matches);
    renderReplacePreview(text, regex, subst || null);
    explainRegex(pattern);
  }

  function debouncedUpdate() {
    if (debounceTimer)
      clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runUpdate, DEBOUNCE_MS);
  }

  // ===== Event wiring =====

  regexInput.addEventListener('input', debouncedUpdate);
  testInput.addEventListener('input', () => {
    debouncedUpdate();
    syncScroll();
  });
  testInput.addEventListener('scroll', syncScroll);
  substInput.addEventListener('input', debouncedUpdate);

  for (const cb of Object.values(flagCheckboxes))
    cb.addEventListener('change', debouncedUpdate);

  // Save pattern to history on blur
  regexInput.addEventListener('blur', () => {
    const pat = regexInput.value.trim();
    if (pat)
      addToHistory(pat, getFlags());
  });

  // ===== Sidebar group toggling =====

  document.getElementById('sidebar').addEventListener('pointerdown', (e) => {
    const header = e.target.closest('.sidebar-group-header');
    if (!header)
      return;
    const group = header.parentElement;
    group.classList.toggle('open');
  });

  // ===== Common patterns =====

  function buildCommonPatterns() {
    const container = document.getElementById('common-patterns');
    for (const p of COMMON_PATTERNS) {
      const btn = document.createElement('button');
      btn.className = 'pattern-btn';
      btn.textContent = p.name;
      btn.title = '/' + p.pattern + '/' + p.flags;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        regexInput.value = p.pattern;
        setFlags(p.flags);
        if (p.test)
          testInput.value = p.test;
        runUpdate();
        addToHistory(p.pattern, p.flags);
      });
      container.appendChild(btn);
    }
  }

  // ===== Copy as =====

  document.getElementById('copy-js').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pattern = regexInput.value;
    const flags = getFlags();
    const text = '/' + pattern + '/' + flags;
    navigator.clipboard.writeText(text).catch(() => {});
  });

  document.getElementById('copy-python').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pattern = regexInput.value;
    const text = 'r"' + pattern + '"';
    navigator.clipboard.writeText(text).catch(() => {});
  });

  document.getElementById('copy-java').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pattern = regexInput.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const text = '"' + pattern + '"';
    navigator.clipboard.writeText(text).catch(() => {});
  });

  document.getElementById('copy-csharp').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pattern = regexInput.value.replace(/"/g, '""');
    const flags = getFlags();
    const opts = [];
    if (flags.includes('i')) opts.push('RegexOptions.IgnoreCase');
    if (flags.includes('m')) opts.push('RegexOptions.Multiline');
    if (flags.includes('s')) opts.push('RegexOptions.Singleline');
    const text = opts.length
      ? 'new Regex(@"' + pattern + '", ' + opts.join(' | ') + ')'
      : '@"' + pattern + '"';
    navigator.clipboard.writeText(text).catch(() => {});
  });

  document.getElementById('copy-perl').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const pattern = regexInput.value;
    const flags = getFlags();
    let perlFlags = '';
    if (flags.includes('i')) perlFlags += 'i';
    if (flags.includes('m')) perlFlags += 'm';
    if (flags.includes('s')) perlFlags += 's';
    if (flags.includes('g')) perlFlags += 'g';
    if (flags.includes('u')) perlFlags += 'u';
    const text = 'qr/' + pattern.replace(/\//g, '\\/') + '/' + perlFlags;
    navigator.clipboard.writeText(text).catch(() => {});
  });

  // ===== History =====

  function loadHistory() {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored)
        return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  }

  function saveHistory(hist) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch { /* ignore */ }
  }

  function addToHistory(pattern, flags) {
    let hist = loadHistory();
    // Remove duplicates
    hist = hist.filter(h => h.pattern !== pattern || h.flags !== flags);
    hist.unshift({ pattern, flags });
    if (hist.length > MAX_HISTORY)
      hist = hist.slice(0, MAX_HISTORY);
    saveHistory(hist);
    renderHistory();
  }

  function renderHistory() {
    const container = document.getElementById('history-list');
    const hist = loadHistory();
    if (hist.length === 0) {
      container.innerHTML = '<div style="color:#808080;font-style:italic;padding:2px;">No history yet.</div>';
      return;
    }

    container.innerHTML = '';
    for (let i = 0; i < hist.length; ++i) {
      const item = document.createElement('div');
      item.className = 'history-item';

      const code = document.createElement('code');
      code.textContent = '/' + hist[i].pattern + '/' + hist[i].flags;
      code.title = code.textContent;

      const del = document.createElement('span');
      del.className = 'history-del';
      del.textContent = '\u00D7';
      del.title = 'Remove';

      item.appendChild(code);
      item.appendChild(del);

      code.addEventListener('pointerdown', ((entry) => (e) => {
        e.preventDefault();
        regexInput.value = entry.pattern;
        setFlags(entry.flags);
        runUpdate();
      })(hist[i]));

      del.addEventListener('pointerdown', ((idx) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        let h = loadHistory();
        h.splice(idx, 1);
        saveHistory(h);
        renderHistory();
      })(i));

      container.appendChild(item);
    }
  }

  // ===== URL hash sharing =====

  function encodeToHash() {
    const pattern = regexInput.value;
    const flags = getFlags();
    const text = testInput.value;
    const subst = substInput.value;
    if (!pattern)
      return;
    const data = { p: pattern, f: flags };
    if (text)
      data.t = text;
    if (subst)
      data.s = subst;
    try {
      const hash = '#' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      history.replaceState(null, '', hash);
    } catch { /* ignore */ }
  }

  function decodeFromHash() {
    const hash = location.hash.slice(1);
    if (!hash)
      return false;
    try {
      const json = decodeURIComponent(escape(atob(hash)));
      const data = JSON.parse(json);
      if (data.p) {
        regexInput.value = data.p;
        setFlags(data.f || 'g');
        if (data.t)
          testInput.value = data.t;
        if (data.s)
          substInput.value = data.s;
        return true;
      }
    } catch { /* ignore invalid hash */ }
    return false;
  }

  // Update hash on changes (debounced)
  let hashTimer = null;
  function debouncedHashUpdate() {
    if (hashTimer)
      clearTimeout(hashTimer);
    hashTimer = setTimeout(encodeToHash, 500);
  }

  regexInput.addEventListener('input', debouncedHashUpdate);
  testInput.addEventListener('input', debouncedHashUpdate);
  substInput.addEventListener('input', debouncedHashUpdate);
  for (const cb of Object.values(flagCheckboxes))
    cb.addEventListener('change', debouncedHashUpdate);

  // ===== Init =====

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    buildCommonPatterns();
    renderHistory();
    updateFlagsDisplay();

    // Try loading from URL hash
    if (!decodeFromHash()) {
      // Default example
      regexInput.value = '(\\w+)@(\\w+\\.\\w+)';
      testInput.value = 'Contact us at info@example.com or support@test.org for help.';
    }

    updateLineNumbers();
    runUpdate();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

  // ===== Menu system =====
  ;(function() {
    const menuBar = document.querySelector('.menu-bar');
    if (!menuBar) return;
    let openMenu = null;
    function closeMenus() {
      if (openMenu) { openMenu.classList.remove('open'); openMenu = null; }
    }
    menuBar.addEventListener('pointerdown', function(e) {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const entry = e.target.closest('.menu-entry');
      if (entry) {
        const action = entry.dataset.action;
        closeMenus();
        if (action === 'about') {
          const dlg = document.getElementById('dlg-about');
          if (dlg) dlg.classList.add('visible');
        }
        return;
      }
      if (openMenu === item) { closeMenus(); return; }
      closeMenus();
      item.classList.add('open');
      openMenu = item;
    });
    menuBar.addEventListener('pointerenter', function(e) {
      if (!openMenu) return;
      const item = e.target.closest('.menu-item');
      if (item && item !== openMenu) { closeMenus(); item.classList.add('open'); openMenu = item; }
    }, true);
    document.addEventListener('pointerdown', function(e) {
      if (openMenu && !e.target.closest('.menu-bar')) closeMenus();
    });
  })();

  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });

})();
