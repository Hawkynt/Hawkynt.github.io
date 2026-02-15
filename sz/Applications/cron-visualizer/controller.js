;(function() {
  'use strict';

  const { Kernel32, ComDlg32, User32 } = SZ.Dlls;

  const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  const MONTH_NAMES = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const refs = {
    menuBar: document.getElementById('menu-bar'),
    toolbar: document.getElementById('toolbar'),
    crontabInput: document.getElementById('crontabInput'),
    resultBody: document.getElementById('resultBody'),
    statusMessage: document.getElementById('statusMessage'),
    statusEntries: document.getElementById('statusEntries'),
    statusFile: document.getElementById('statusFile'),
    bMin: document.getElementById('bMin'),
    bHour: document.getElementById('bHour'),
    bDom: document.getElementById('bDom'),
    bMon: document.getElementById('bMon'),
    bDow: document.getElementById('bDow'),
    bCmd: document.getElementById('bCmd'),
    btnBuildPreview: document.getElementById('btnBuildPreview'),
    btnAppend: document.getElementById('btnAppend'),
    buildPreview: document.getElementById('buildPreview'),
    aboutOverlay: document.getElementById('dlg-about'),
    aboutLink: document.getElementById('aboutLink')
  };

  const state = {
    filePath: null,
    fileName: 'Untitled.crontab',
    dirty: false,
    entryCount: 0
  };

  /* ---------- Status ---------- */

  function setStatus(text) {
    refs.statusMessage.textContent = text;
  }

  function updateStatusBar() {
    refs.statusEntries.textContent = `${state.entryCount} ${state.entryCount === 1 ? 'entry' : 'entries'}`;
    refs.statusFile.textContent = (state.dirty ? '* ' : '') + state.fileName;
  }

  function setDirty(v = true) {
    state.dirty = !!v;
    const mark = state.dirty ? '* ' : '';
    const title = `${mark}${state.fileName} - Cron Visualizer`;
    document.title = title;
    try { User32.SetWindowText(title); } catch {}
    updateStatusBar();
  }

  /* ---------- Helpers ---------- */

  function htmlEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Cron parsing (unchanged) ---------- */

  function parseTokenNumber(token, map, min, max, fieldName) {
    const t = String(token).toLowerCase();
    if (map && map[t] != null) return map[t];
    const n = Number(t);
    if (!Number.isInteger(n)) throw new Error(`Invalid ${fieldName} value: ${token}`);
    if (fieldName === 'day-of-week' && n === 7) return 0;
    if (n < min || n > max) throw new Error(`Out-of-range ${fieldName}: ${token}`);
    return n;
  }

  function expandField(raw, min, max, map, fieldName) {
    const src = String(raw || '').trim().toLowerCase();
    if (src === '*')
      return { set: null, any: true, text: `every ${fieldName}` };

    const out = new Set();
    const parts = src.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      const stepSplit = part.split('/');
      const left = stepSplit[0];
      const step = stepSplit.length > 1 ? Number(stepSplit[1]) : 1;
      if (!Number.isInteger(step) || step < 1)
        throw new Error(`Invalid step in ${fieldName}: ${part}`);

      if (left === '*') {
        for (let v = min; v <= max; v += step) out.add(v);
        continue;
      }

      const rangeSplit = left.split('-');
      if (rangeSplit.length === 1) {
        const v = parseTokenNumber(rangeSplit[0], map, min, max, fieldName);
        out.add(v);
      } else if (rangeSplit.length === 2) {
        let a = parseTokenNumber(rangeSplit[0], map, min, max, fieldName);
        let b = parseTokenNumber(rangeSplit[1], map, min, max, fieldName);
        if (fieldName === 'day-of-week' && a === 0 && b === 0) {
          out.add(0);
          continue;
        }
        if (a > b) throw new Error(`Invalid range in ${fieldName}: ${part}`);
        for (let v = a; v <= b; v += step) out.add(v === 7 ? 0 : v);
      } else {
        throw new Error(`Invalid ${fieldName} segment: ${part}`);
      }
    }

    return { set: out, any: false, text: summarizeField(fieldName, out) };
  }

  function summarizeField(name, set) {
    const arr = Array.from(set).sort((a, b) => a - b);
    if (arr.length === 0) return `no ${name} values`;
    if (arr.length > 20) return `${arr.length} selected ${name} values`;
    if (name === 'day-of-week')
      return `${name}: ${arr.map((v) => DOW_NAMES[v] ?? String(v)).join(', ')}`;
    if (name === 'month')
      return `${name}: ${arr.map((v) => MONTH_NAMES[v] ?? String(v)).join(', ')}`;
    return `${name}: ${arr.join(', ')}`;
  }

  function normalizeSpecial(expr) {
    const e = expr.trim().toLowerCase();
    const special = {
      '@yearly': '0 0 1 1 *',
      '@annually': '0 0 1 1 *',
      '@monthly': '0 0 1 * *',
      '@weekly': '0 0 * * 0',
      '@daily': '0 0 * * *',
      '@midnight': '0 0 * * *',
      '@hourly': '0 * * * *'
    };
    return special[e] || expr;
  }

  function parseSchedule(schedule) {
    const norm = normalizeSpecial(schedule);
    if (norm.trim().toLowerCase() === '@reboot')
      return { reboot: true, explain: 'runs once at system startup' };

    const parts = norm.trim().split(/\s+/);
    if (parts.length !== 5)
      throw new Error('Expected 5 cron fields: minute hour day-of-month month day-of-week');

    const min = expandField(parts[0], 0, 59, null, 'minute');
    const hour = expandField(parts[1], 0, 23, null, 'hour');
    const dom = expandField(parts[2], 1, 31, null, 'day-of-month');
    const mon = expandField(parts[3], 1, 12, MONTHS, 'month');
    const dow = expandField(parts[4], 0, 7, DOW, 'day-of-week');

    return {
      reboot: false,
      minute: min,
      hour,
      dom,
      month: mon,
      dow,
      explain: [min.text, hour.text, dom.text, mon.text, dow.text].join('; ')
    };
  }

  function cronMatches(parsed, dt) {
    if (parsed.reboot) return false;

    const m = dt.getMinutes();
    const h = dt.getHours();
    const dom = dt.getDate();
    const mon = dt.getMonth() + 1;
    const dow = dt.getDay();

    const minuteOk = parsed.minute.any || parsed.minute.set.has(m);
    const hourOk = parsed.hour.any || parsed.hour.set.has(h);
    const monthOk = parsed.month.any || parsed.month.set.has(mon);

    const domAny = parsed.dom.any;
    const dowAny = parsed.dow.any;
    const domOk = domAny || parsed.dom.set.has(dom);
    const dowOk = dowAny || parsed.dow.set.has(dow);

    const dayOk = domAny && dowAny ? true : domAny ? dowOk : dowAny ? domOk : (domOk || dowOk);

    return minuteOk && hourOk && monthOk && dayOk;
  }

  function nextRuns(parsed, count = 5) {
    if (parsed.reboot) return ['at boot'];
    const out = [];
    const t = new Date();
    t.setSeconds(0, 0);
    t.setMinutes(t.getMinutes() + 1);

    const limit = 525600 * 2;
    for (let i = 0; i < limit && out.length < count; ++i) {
      if (cronMatches(parsed, t))
        out.push(new Date(t));
      t.setMinutes(t.getMinutes() + 1);
    }

    return out.map((d) => d.toLocaleString());
  }

  function parseCrontab(text) {
    const lines = String(text || '').split(/\r?\n/);
    const entries = [];

    for (let i = 0; i < lines.length; ++i) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) {
        entries.push({
          lineNo: i + 1,
          schedule: '(env)',
          command: line,
          meaning: 'environment variable assignment',
          next: []
        });
        continue;
      }

      try {
        const tokens = line.split(/\s+/);
        let schedule;
        let command;

        if (tokens[0].startsWith('@')) {
          schedule = tokens[0];
          command = line.slice(schedule.length).trim();
          if (!command) throw new Error('Missing command after special schedule');
        } else {
          if (tokens.length < 6) throw new Error('Missing command or schedule fields');
          schedule = tokens.slice(0, 5).join(' ');
          command = tokens.slice(5).join(' ');
        }

        const parsed = parseSchedule(schedule);
        entries.push({
          lineNo: i + 1,
          schedule,
          command,
          meaning: parsed.explain,
          next: nextRuns(parsed, 4)
        });
      } catch (err) {
        entries.push({
          lineNo: i + 1,
          schedule: '(invalid)',
          command: line,
          meaning: `Error: ${err.message}`,
          next: [],
          error: true
        });
      }
    }

    return entries;
  }

  /* ---------- Rendering ---------- */

  function renderEntries(entries) {
    refs.resultBody.innerHTML = '';
    entries.forEach((e) => {
      const tr = document.createElement('tr');
      if (e.error) tr.className = 'error-row';

      const nextText = e.next && e.next.length ? e.next.join('\n') : '-';
      tr.innerHTML = `
        <td>${e.lineNo}</td>
        <td class="code">${htmlEscape(e.schedule)}</td>
        <td class="code">${htmlEscape(e.command)}</td>
        <td>${htmlEscape(e.meaning)}</td>
        <td>${htmlEscape(nextText)}</td>
      `;
      refs.resultBody.appendChild(tr);
    });
  }

  function parseAndRender() {
    const entries = parseCrontab(refs.crontabInput.value);
    renderEntries(entries);
    state.entryCount = entries.length;
    setStatus(`Parsed ${entries.length} entries.`);
    updateStatusBar();
  }

  /* ---------- Builder ---------- */

  function buildExpressionFromBuilder() {
    const schedule = `${refs.bMin.value.trim()} ${refs.bHour.value.trim()} ${refs.bDom.value.trim()} ${refs.bMon.value.trim()} ${refs.bDow.value.trim()}`;
    const cmd = refs.bCmd.value.trim();
    return { schedule, cmd, line: `${schedule} ${cmd}`.trim() };
  }

  function previewBuilder() {
    const { schedule, line } = buildExpressionFromBuilder();
    try {
      const parsed = parseSchedule(schedule);
      const nxt = nextRuns(parsed, 3);
      refs.buildPreview.textContent = `${line}\n\n${parsed.explain}\n\nNext:\n${nxt.join('\n')}`;
      setStatus('Builder preview updated.');
    } catch (err) {
      refs.buildPreview.textContent = `Invalid: ${err.message}`;
      setStatus('Builder has invalid schedule.');
    }
  }

  function appendBuilderLine() {
    const { line } = buildExpressionFromBuilder();
    if (!line.trim()) return;
    const cur = refs.crontabInput.value;
    refs.crontabInput.value = cur ? `${cur.replace(/\s*$/, '')}\n${line}` : line;
    setDirty();
    previewBuilder();
    parseAndRender();
  }

  /* ---------- File I/O ---------- */

  async function openCrontab() {
    const result = await ComDlg32.GetOpenFileName({
      filters: [{ name: 'Crontab', ext: ['txt', 'cron', 'crontab'] }, { name: 'All Files', ext: ['*'] }],
      initialDir: '/user/documents',
      title: 'Open Crontab'
    });
    if (result.cancelled || !result.path) return;
    let content = result.content;
    if (content == null) content = await Kernel32.ReadFile(result.path);
    refs.crontabInput.value = String(content || '');
    state.filePath = result.path;
    state.fileName = result.path.split('/').pop() || 'Opened.crontab';
    setDirty(false);
    parseAndRender();
    setStatus(`Opened ${state.fileName}`);
  }

  async function saveCrontabAs() {
    const content = refs.crontabInput.value;
    const result = await ComDlg32.GetSaveFileName({
      filters: [{ name: 'Crontab', ext: ['txt', 'cron', 'crontab'] }, { name: 'All Files', ext: ['*'] }],
      initialDir: '/user/documents',
      defaultName: state.fileName || 'crontab.txt',
      title: 'Save Crontab As',
      content
    });
    if (result.cancelled || !result.path) return;
    await Kernel32.WriteFile(result.path, content);
    state.filePath = result.path;
    state.fileName = result.path.split('/').pop() || state.fileName;
    setDirty(false);
    setStatus(`Saved ${state.fileName}`);
  }

  function clearAll() {
    refs.crontabInput.value = '';
    refs.resultBody.innerHTML = '';
    refs.buildPreview.textContent = '';
    state.filePath = null;
    state.fileName = 'Untitled.crontab';
    state.entryCount = 0;
    setDirty(false);
    setStatus('Cleared.');
  }

  /* ---------- About dialog ---------- */

  function showAbout() {
    refs.aboutOverlay.classList.add('visible');
  }

  function hideAbout() {
    refs.aboutOverlay.classList.remove('visible');
  }

  /* ---------- Reference link ---------- */

  function openReference() {
    const url = 'https://linuxhandbook.com/crontab/';
    try {
      User32.PostMessage('sz:launchApp', { appId: 'web-browser', urlParams: { url } });
    } catch {}
    setStatus(`Reference: ${url}`);
  }

  /* ---------- Menu logic ---------- */

  let openMenu = null;

  function closeAllMenus() {
    if (!openMenu) return;
    openMenu.classList.remove('open');
    openMenu = null;
  }

  function toggleMenu(item) {
    if (openMenu === item) {
      closeAllMenus();
      return;
    }
    closeAllMenus();
    item.classList.add('open');
    openMenu = item;
  }

  /* ---------- Action dispatch ---------- */

  const actions = {
    open: () => openCrontab().catch((err) => alert(`Open failed: ${err.message}`)),
    save: () => saveCrontabAs().catch((err) => alert(`Save failed: ${err.message}`)),
    parse: parseAndRender,
    clear: clearAll,
    append: appendBuilderLine,
    reference: openReference,
    about: showAbout
  };

  function dispatchAction(name) {
    const fn = actions[name];
    if (fn) fn();
  }

  /* ---------- Bindings ---------- */

  function bind() {
    refs.menuBar.addEventListener('pointerdown', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;

      const entry = e.target.closest('.menu-entry');
      if (entry) {
        const action = entry.dataset.action;
        closeAllMenus();
        dispatchAction(action);
        return;
      }

      toggleMenu(item);
    });

    refs.menuBar.addEventListener('pointerover', (e) => {
      if (!openMenu) return;
      const item = e.target.closest('.menu-item');
      if (item && item !== openMenu && item.parentNode === refs.menuBar) {
        closeAllMenus();
        item.classList.add('open');
        openMenu = item;
      }
    });

    document.addEventListener('pointerdown', (e) => {
      if (openMenu && !e.target.closest('.menu-bar'))
        closeAllMenus();
    });

    refs.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tool-btn');
      if (btn) dispatchAction(btn.dataset.action);
    });

    refs.btnBuildPreview.addEventListener('click', previewBuilder);
    refs.btnAppend.addEventListener('click', appendBuilderLine);

    refs.aboutOverlay.addEventListener('click', (e) => {
      if (e.target === refs.aboutOverlay || e.target.closest('[data-result]'))
        hideAbout();
    });
    refs.aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      openReference();
    });

    refs.crontabInput.addEventListener('input', () => setDirty(true));

    [refs.bMin, refs.bHour, refs.bDom, refs.bMon, refs.bDow, refs.bCmd].forEach((inp) => {
      inp.addEventListener('input', previewBuilder);
    });

    document.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        if (openMenu) {
          closeAllMenus();
          return;
        }
        hideAbout();
        return;
      }
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'o') {
        e.preventDefault();
        await openCrontab();
      } else if (k === 's') {
        e.preventDefault();
        await saveCrontabAs();
      } else if (k === 'enter') {
        e.preventDefault();
        parseAndRender();
      }
    });
  }

  function bootFromCommandLine() {
    const cmd = Kernel32.GetCommandLine();
    if (!cmd || !cmd.path) return;
    Kernel32.ReadFile(cmd.path)
      .then((txt) => {
        refs.crontabInput.value = String(txt || '');
        state.filePath = cmd.path;
        state.fileName = String(cmd.path).split('/').pop() || 'Opened.crontab';
        setDirty(false);
        parseAndRender();
      })
      .catch((err) => setStatus(`Open cmd file failed: ${err.message}`));
  }

  bind();
  previewBuilder();
  parseAndRender();
  setDirty(false);
  bootFromCommandLine();
})();
