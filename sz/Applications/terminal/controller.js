;(function() {
  'use strict';

  const { User32, Kernel32, Shell32 } = SZ.Dlls;

  // =========================================================================
  // DOM references
  // =========================================================================
  const outputEl = document.getElementById('output');
  const inputEl = document.getElementById('input');
  const promptEl = document.getElementById('prompt');
  const cursorBlock = document.getElementById('cursor-block');
  const cursorMeasure = document.getElementById('cursor-measure');
  const shellSelect = document.getElementById('shell-select');

  // =========================================================================
  // State
  // =========================================================================
  let currentShell = 'cmd';
  let cmdCwd = '/';
  let cmdPromptTemplate = '$P$G';
  let cmdPath = '';
  let cmdVars = {};
  let cmdDelayedExpansion = false;
  let cmdHistory = [];
  let cmdHistoryIndex = -1;
  let cmdDirStack = [];
  let cmdLastExitCode = 0;
  let cmdEchoOn = true;
  let fgColor = 7;
  let bgColor = 0;

  // =========================================================================
  // Console color table (16 standard colors)
  // =========================================================================
  const COLOR_TABLE = [
    '#000000', '#000080', '#008000', '#008080',
    '#800000', '#800080', '#808000', '#c0c0c0',
    '#808080', '#0000ff', '#00ff00', '#00ffff',
    '#ff0000', '#ff00ff', '#ffff00', '#ffffff',
  ];

  function applyColors() {
    document.body.style.background = COLOR_TABLE[bgColor] || '#000';
    document.body.style.color = COLOR_TABLE[fgColor] || '#c0c0c0';
    inputEl.style.color = 'inherit';
  }

  // =========================================================================
  // Output helpers
  // =========================================================================
  function print(text, customColor) {
    const span = document.createElement('span');
    span.className = 'line';
    if (customColor)
      span.style.color = customColor;
    else if (fgColor !== 7)
      span.style.color = COLOR_TABLE[fgColor];
    span.textContent = text;
    outputEl.appendChild(span);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function println(text, customColor) {
    print((text || '') + '\n', customColor);
  }

  function printHtml(html) {
    const span = document.createElement('span');
    span.className = 'line';
    span.innerHTML = html;
    outputEl.appendChild(span);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clearScreen() {
    outputEl.innerHTML = '';
  }

  // =========================================================================
  // VFS wrappers (via DLL APIs)
  // =========================================================================
  async function vfsList(path) {
    try {
      const entries = await Kernel32.FindFirstFile(path);
      return { entries };
    } catch (e) {
      return { error: e.message, entries: [] };
    }
  }

  async function vfsRead(path) {
    try {
      const content = await Kernel32.ReadFile(path);
      return { data: content };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsWrite(path, data) {
    try {
      await Kernel32.WriteFile(path, data);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsMkdir(path) {
    try {
      await Kernel32.CreateDirectory(path);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsDelete(path) {
    try {
      await Kernel32.DeleteFile(path);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsCopy(src, dest) {
    try {
      await Kernel32.CopyFile(src, dest);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsMove(src, dest) {
    try {
      await Kernel32.MoveFile(src, dest);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsRename(oldPath, newPath) {
    try {
      await Shell32.SHFileOperation(FO_RENAME, oldPath, newPath);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsExists(path) {
    try {
      const result = await Kernel32.GetFileAttributes(path);
      return { exists: result.exists };
    } catch (e) {
      return { exists: false };
    }
  }

  // =========================================================================
  // Path helpers
  // =========================================================================
  function toVfsPath(displayPath) {
    let p = displayPath.replace(/\\/g, '/');
    p = p.replace(/^[A-Z]:\/?/i, '/');
    if (!p.startsWith('/')) p = '/' + p;
    return normalizePath(p);
  }

  function toDisplayPath(vfsPath) {
    if (vfsPath === '/') return 'SZ:\\';
    return 'SZ:' + vfsPath.replace(/\//g, '\\');
  }

  function joinPath(base, child) {
    if (base === '/') return '/' + child;
    return base + '/' + child;
  }

  function parentOf(path) {
    if (path === '/') return '/';
    const idx = path.lastIndexOf('/');
    return idx <= 0 ? '/' : path.slice(0, idx);
  }

  function baseName(path) {
    if (path === '/') return '';
    const idx = path.lastIndexOf('/');
    return idx < 0 ? path : path.slice(idx + 1);
  }

  function extName(path) {
    const name = baseName(path);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot) : '';
  }

  function normalizePath(path) {
    const parts = path.split('/');
    const result = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (result.length > 0) result.pop();
      } else
        result.push(part);
    }
    return '/' + result.join('/');
  }

  function resolvePath(base, rel) {
    if (rel.startsWith('/')) return normalizePath(rel);
    const combined = base === '/' ? '/' + rel : base + '/' + rel;
    return normalizePath(combined);
  }

  // =========================================================================
  // Window communication (via DLL APIs)
  // =========================================================================
  function setWindowTitle(title) {
    User32.SetWindowText(title);
  }

  function closeWindow() {
    User32.DestroyWindow();
  }

  function launchApp(appId, params) {
    Shell32.ShellExecute(appId, params || {});
  }

  async function getWindows() {
    try {
      const result = await User32.SendMessage('sz:getWindows', {});
      return result.windows || [];
    } catch (e) {
      return [];
    }
  }

  function closeRemoteWindow(id) {
    User32.PostMessage('sz:closeWindow', { windowId: id });
  }

  // =========================================================================
  // Prompt formatting (cmd.exe)
  // =========================================================================
  function formatCmdPrompt() {
    let result = '';
    for (let i = 0; i < cmdPromptTemplate.length; ++i) {
      if (cmdPromptTemplate[i] === '$' && i + 1 < cmdPromptTemplate.length) {
        const ch = cmdPromptTemplate[++i].toUpperCase();
        switch (ch) {
          case 'P': result += toDisplayPath(cmdCwd); break;
          case 'G': result += '>'; break;
          case 'L': result += '<'; break;
          case 'B': result += '|'; break;
          case 'Q': result += '='; break;
          case 'S': result += ' '; break;
          case 'D': result += new Date().toLocaleDateString(); break;
          case 'T': result += new Date().toLocaleTimeString(); break;
          case 'N': result += 'SZ'; break;
          case 'E': result += '\x1B'; break;
          case 'H': result += '\b'; break;
          case '_': result += '\n'; break;
          case '$': result += '$'; break;
          default: result += '$' + ch;
        }
      } else
        result += cmdPromptTemplate[i];
    }
    return result;
  }

  function showPrompt() {
    if (currentShell === 'cmd') {
      promptEl.textContent = formatCmdPrompt();
      promptEl.className = '';
    } else
      showBashPrompt();
  }

  // =========================================================================
  // Variable expansion (cmd.exe)
  // =========================================================================
  function expandVars(text) {
    let result = text.replace(/%([^%]+)%/g, (m, name) => {
      const upper = name.toUpperCase();
      if (upper === 'CD') return toDisplayPath(cmdCwd);
      if (upper === 'DATE') return new Date().toLocaleDateString();
      if (upper === 'TIME') return new Date().toLocaleTimeString();
      if (upper === 'RANDOM') return String(Math.floor(Math.random() * 32768));
      if (upper === 'ERRORLEVEL') return String(cmdLastExitCode);
      if (upper === 'PATH') return cmdPath;
      if (upper === 'USERNAME') return 'user';
      if (upper === 'COMPUTERNAME') return 'SZ-PC';
      if (upper === 'OS') return 'SynthelicZ';
      if (upper === 'HOMEDRIVE') return 'SZ:';
      if (upper === 'HOMEPATH') return '\\';
      if (upper === 'SYSTEMROOT') return 'SZ:\\System';
      if (upper === 'WINDIR') return 'SZ:\\System';
      if (upper === 'TEMP' || upper === 'TMP') return 'SZ:\\Temp';
      if (upper === 'COMSPEC') return 'SZ:\\System\\cmd.exe';
      if (upper === 'PROCESSOR_ARCHITECTURE') return 'SZ64';
      if (upper === 'NUMBER_OF_PROCESSORS') return String(navigator.hardwareConcurrency || 4);
      if (cmdVars[upper] != null) return cmdVars[upper];
      return m;
    });
    if (cmdDelayedExpansion)
      result = result.replace(/!([^!]+)!/g, (m, name) => {
        const upper = name.toUpperCase();
        if (cmdVars[upper] != null) return cmdVars[upper];
        return m;
      });
    return result;
  }

  // =========================================================================
  // Command line parser (cmd.exe)
  // =========================================================================
  function tokenize(line) {
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === ' ' || line[i] === '\t') { ++i; continue; }
      if (line[i] === '"') {
        let tok = '';
        ++i;
        while (i < line.length && line[i] !== '"') tok += line[i++];
        if (i < line.length) ++i;
        tokens.push(tok);
      } else {
        let tok = '';
        while (i < line.length && line[i] !== ' ' && line[i] !== '\t') tok += line[i++];
        tokens.push(tok);
      }
    }
    return tokens;
  }

  function unquote(s) {
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"')
      return s.slice(1, -1);
    return s;
  }

  function splitChains(line) {
    const chains = [];
    let current = '';
    let inQuote = false;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; current += ch; ++i; continue; }
      if (inQuote) { current += ch; ++i; continue; }
      if (ch === '&' && i + 1 < line.length && line[i + 1] === '&') {
        chains.push({ text: current.trim(), op: '&&' }); current = ''; i += 2; continue;
      }
      if (ch === '|' && i + 1 < line.length && line[i + 1] === '|') {
        chains.push({ text: current.trim(), op: '||' }); current = ''; i += 2; continue;
      }
      if (ch === '&') {
        chains.push({ text: current.trim(), op: '&' }); current = ''; ++i; continue;
      }
      current += ch;
      ++i;
    }
    if (current.trim()) chains.push({ text: current.trim(), op: null });
    return chains;
  }

  function parsePipesAndRedirection(text) {
    const commands = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < text.length; ++i) {
      if (text[i] === '"') { inQuote = !inQuote; current += text[i]; continue; }
      if (!inQuote && text[i] === '|') {
        commands.push(current.trim());
        current = '';
        continue;
      }
      current += text[i];
    }
    if (current.trim()) commands.push(current.trim());

    let outputFile = null;
    let appendMode = false;
    const lastCmd = commands[commands.length - 1];
    const redirMatch = lastCmd.match(/^(.*?)\s*(>>|>)\s*(.+)$/);
    if (redirMatch) {
      commands[commands.length - 1] = redirMatch[1].trim();
      outputFile = unquote(redirMatch[3].trim());
      appendMode = redirMatch[2] === '>>';
    }

    return { commands, outputFile, appendMode };
  }

  // =========================================================================
  // Argument parsing helpers
  // =========================================================================
  function parseArgs(line) {
    const args = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === ' ' || line[i] === '\t') { ++i; continue; }
      if (line[i] === '"') {
        let tok = '"';
        ++i;
        while (i < line.length && line[i] !== '"') tok += line[i++];
        if (i < line.length) { tok += '"'; ++i; }
        args.push(tok);
      } else {
        let tok = '';
        while (i < line.length && line[i] !== ' ' && line[i] !== '\t') tok += line[i++];
        args.push(tok);
      }
    }
    return args;
  }

  function extractSwitches(args) {
    const switches = {};
    const positional = [];
    for (const arg of args) {
      if (arg.startsWith('/'))
        switches[arg.slice(1).toUpperCase()] = true;
      else
        positional.push(arg);
    }
    return { switches, positional };
  }

  // =========================================================================
  // Built-in commands registry (cmd.exe)
  // =========================================================================
  const CMD_COMMANDS = {};

  function defCmd(names, fn) {
    const nameList = Array.isArray(names) ? names : [names];
    for (const name of nameList)
      CMD_COMMANDS[name.toUpperCase()] = fn;
  }

  // -- help --
  defCmd('help', async (args, ctx) => {
    const cmds = Object.keys(CMD_COMMANDS).sort();
    const unique = [...new Set(cmds)];
    ctx.println('Available commands:');
    const cols = 5;
    for (let i = 0; i < unique.length; i += cols) {
      const row = unique.slice(i, i + cols).map(c => c.padEnd(14)).join('');
      ctx.println('  ' + row);
    }
  });

  // -- cls / clear --
  defCmd(['cls', 'clear'], async (args, ctx) => {
    clearScreen();
  });

  // -- echo --
  defCmd('echo', async (args, ctx) => {
    const rest = ctx.rawArgs;
    if (!rest || rest === '.' || rest.toUpperCase() === 'ON' || rest.toUpperCase() === 'OFF') {
      if (!rest || rest === '.') {
        ctx.println(cmdEchoOn ? 'ECHO is on.' : 'ECHO is off.');
        return;
      }
      if (rest.toUpperCase() === 'ON') { cmdEchoOn = true; return; }
      if (rest.toUpperCase() === 'OFF') { cmdEchoOn = false; return; }
    }
    ctx.println(rest);
  });

  // -- ver --
  defCmd('ver', async (args, ctx) => {
    ctx.println('');
    ctx.println('SynthelicZ [Version 2.0.2025]');
  });

  // -- vol --
  defCmd('vol', async (args, ctx) => {
    ctx.println(' Volume in drive SZ is SynthelicZ');
    ctx.println(' Volume Serial Number is SZ00-0001');
  });

  // -- date --
  defCmd('date', async (args, ctx) => {
    const now = new Date();
    ctx.println('The current date is: ' + now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }));
  });

  // -- time --
  defCmd('time', async (args, ctx) => {
    ctx.println('The current time is: ' + new Date().toLocaleTimeString());
  });

  // -- dir --
  defCmd('dir', async (args, ctx) => {
    const { switches, positional } = extractSwitches(args);
    const targetPath = positional.length > 0 ? resolvePath(cmdCwd, toVfsPath(positional[0])) : cmdCwd;
    const result = await vfsList(targetPath);
    if (result.error) { ctx.println('File Not Found'); return; }

    ctx.println(' Volume in drive SZ is SynthelicZ');
    ctx.println(' Volume Serial Number is SZ00-0001');
    ctx.println('');
    ctx.println(' Directory of ' + toDisplayPath(targetPath));
    ctx.println('');

    const entries = result.entries || [];
    let fileCount = 0;
    let dirCount = 0;
    let totalSize = 0;

    const sorted = [...entries].sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (entry.type === 'dir') {
        ctx.println(dateStr + '  ' + timeStr + '    <DIR>          ' + entry.name);
        ++dirCount;
      } else {
        const size = entry.size || 0;
        totalSize += size;
        ctx.println(dateStr + '  ' + timeStr + '    ' + String(size).padStart(14) + ' ' + entry.name);
        ++fileCount;
      }
    }

    ctx.println('');
    ctx.println('               ' + fileCount + ' File(s)    ' + totalSize.toLocaleString() + ' bytes');
    ctx.println('               ' + dirCount + ' Dir(s)');
  });

  // -- cd / chdir --
  defCmd(['cd', 'chdir'], async (args, ctx) => {
    if (args.length === 0) { ctx.println(toDisplayPath(cmdCwd)); return; }
    const target = args.join(' ');
    if (target === '/' || target === '\\') { cmdCwd = '/'; showPrompt(); return; }
    const newPath = resolvePath(cmdCwd, toVfsPath(target));
    const result = await vfsList(newPath);
    if (result.error) { ctx.println('The system cannot find the path specified.'); return; }
    cmdCwd = newPath;
    showPrompt();
  });

  // -- md / mkdir --
  defCmd(['md', 'mkdir'], async (args, ctx) => {
    if (args.length === 0) { ctx.println('The syntax of the command is incorrect.'); return; }
    for (const arg of args) {
      const target = resolvePath(cmdCwd, toVfsPath(arg));
      const result = await vfsWrite(target + '/.keep', '');
      if (result.error) ctx.println('A subdirectory or file ' + arg + ' already exists.');
    }
  });

  // -- rd / rmdir --
  defCmd(['rd', 'rmdir'], async (args, ctx) => {
    if (args.length === 0) { ctx.println('The syntax of the command is incorrect.'); return; }
    for (const arg of args) {
      const target = resolvePath(cmdCwd, toVfsPath(arg));
      const result = await vfsDelete(target);
      if (result.error) ctx.println('The system cannot find the file specified.');
    }
  });

  // -- copy --
  defCmd('copy', async (args, ctx) => {
    if (args.length < 2) { ctx.println('The syntax of the command is incorrect.'); return; }
    const src = resolvePath(cmdCwd, toVfsPath(args[0]));
    const dest = resolvePath(cmdCwd, toVfsPath(args[1]));
    const result = await vfsCopy(src, dest);
    if (result.error) ctx.println('The system cannot find the file specified.');
    else ctx.println('        1 file(s) copied.');
  });

  // -- move --
  defCmd('move', async (args, ctx) => {
    if (args.length < 2) { ctx.println('The syntax of the command is incorrect.'); return; }
    const src = resolvePath(cmdCwd, toVfsPath(args[0]));
    const dest = resolvePath(cmdCwd, toVfsPath(args[1]));
    const result = await vfsMove(src, dest);
    if (result.error) ctx.println('The system cannot find the file specified.');
    else ctx.println('        1 file(s) moved.');
  });

  // -- ren / rename --
  defCmd(['ren', 'rename'], async (args, ctx) => {
    if (args.length < 2) { ctx.println('The syntax of the command is incorrect.'); return; }
    const src = resolvePath(cmdCwd, toVfsPath(args[0]));
    const dest = resolvePath(parentOf(src), toVfsPath(args[1]));
    const result = await vfsRename(src, dest);
    if (result.error) ctx.println('The system cannot find the file specified.');
  });

  // -- del / erase --
  defCmd(['del', 'erase'], async (args, ctx) => {
    if (args.length === 0) { ctx.println('The syntax of the command is incorrect.'); return; }
    for (const arg of args) {
      if (arg.startsWith('/')) continue;
      const target = resolvePath(cmdCwd, toVfsPath(arg));
      const result = await vfsDelete(target);
      if (result.error) ctx.println('Could Not Find ' + arg);
    }
  });

  // -- type --
  defCmd('type', async (args, ctx) => {
    if (args.length === 0) { ctx.println('The syntax of the command is incorrect.'); return; }
    for (const arg of args) {
      const target = resolvePath(cmdCwd, toVfsPath(arg));
      const result = await vfsRead(target);
      if (result.error) ctx.println('The system cannot find the file specified.');
      else ctx.println(result.data);
    }
  });

  // -- more --
  defCmd('more', async (args, ctx) => {
    if (ctx.pipeInput != null) {
      const lines = ctx.pipeInput.split('\n');
      for (const line of lines) ctx.println(line);
      return;
    }
    if (args.length === 0) { ctx.println('The syntax of the command is incorrect.'); return; }
    const target = resolvePath(cmdCwd, toVfsPath(args[0]));
    const result = await vfsRead(target);
    if (result.error) { ctx.println('The system cannot find the file specified.'); return; }
    const lines = result.data.split('\n');
    for (const line of lines) ctx.println(line);
  });

  // -- set --
  defCmd('set', async (args, ctx) => {
    if (args.length === 0) {
      const allVars = { ...cmdVars, CD: toDisplayPath(cmdCwd), PATH: cmdPath, ERRORLEVEL: String(cmdLastExitCode) };
      const keys = Object.keys(allVars).sort();
      for (const key of keys) ctx.println(key + '=' + allVars[key]);
      return;
    }
    const full = ctx.rawArgs;
    if (full.toUpperCase().startsWith('/A ')) {
      const expr = full.slice(3).trim();
      const eqIdx = expr.indexOf('=');
      if (eqIdx < 0) { ctx.println('The syntax of the command is incorrect.'); return; }
      const varName = expr.slice(0, eqIdx).trim().toUpperCase();
      const expression = expr.slice(eqIdx + 1).trim();
      try {
        const expanded = expression.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (m) => {
          const v = cmdVars[m.toUpperCase()];
          return v != null ? v : '0';
        });
        const value = Function('"use strict"; return (' + expanded + ')')();
        cmdVars[varName] = String(value);
      } catch (e) {
        ctx.println('Invalid expression.');
      }
      return;
    }
    if (full.toUpperCase().startsWith('/P ')) {
      const rest = full.slice(3).trim();
      const eqIdx = rest.indexOf('=');
      if (eqIdx < 0) { ctx.println('The syntax of the command is incorrect.'); return; }
      const varName = rest.slice(0, eqIdx).trim().toUpperCase();
      const promptText = rest.slice(eqIdx + 1).trim();
      ctx.println(promptText);
      cmdVars[varName] = '';
      return;
    }
    const eqIdx = full.indexOf('=');
    if (eqIdx < 0) {
      const prefix = full.toUpperCase();
      const keys = Object.keys(cmdVars).filter(k => k.startsWith(prefix)).sort();
      if (keys.length === 0) ctx.println('Environment variable ' + full + ' not defined');
      else for (const key of keys) ctx.println(key + '=' + cmdVars[key]);
      return;
    }
    const varName = full.slice(0, eqIdx).trim().toUpperCase();
    const value = full.slice(eqIdx + 1);
    if (value === '') delete cmdVars[varName];
    else cmdVars[varName] = value;
  });

  // -- color --
  defCmd('color', async (args, ctx) => {
    if (args.length === 0) { fgColor = 7; bgColor = 0; applyColors(); return; }
    const code = args[0];
    if (code.length === 1) { fgColor = parseInt(code, 16) || 7; applyColors(); return; }
    if (code.length >= 2) {
      bgColor = parseInt(code[0], 16) || 0;
      fgColor = parseInt(code[1], 16) || 7;
      if (bgColor === fgColor) { ctx.println('The color attributes are the same.'); return; }
      applyColors();
    }
  });

  // -- title --
  defCmd('title', async (args, ctx) => {
    setWindowTitle(ctx.rawArgs || 'Terminal');
  });

  // -- prompt --
  defCmd('prompt', async (args, ctx) => {
    cmdPromptTemplate = ctx.rawArgs || '$P$G';
    showPrompt();
  });

  // -- path --
  defCmd('path', async (args, ctx) => {
    if (args.length === 0) ctx.println('PATH=' + cmdPath);
    else cmdPath = ctx.rawArgs;
  });

  // -- exit --
  defCmd('exit', async (args, ctx) => {
    closeWindow();
  });

  // -- whoami --
  defCmd('whoami', async (args, ctx) => {
    ctx.println('sz-pc\\user');
  });

  // -- hostname --
  defCmd('hostname', async (args, ctx) => {
    ctx.println('SZ-PC');
  });

  // -- systeminfo --
  defCmd('systeminfo', async (args, ctx) => {
    ctx.println('Host Name:                 SZ-PC');
    ctx.println('OS Name:                   SynthelicZ Desktop');
    ctx.println('OS Version:                2.0.2025');
    ctx.println('System Type:               Browser-based');
    ctx.println('Processor(s):              ' + (navigator.hardwareConcurrency || 4) + ' core(s)');
    ctx.println('Available Physical Memory: ' + (navigator.deviceMemory || 8) + ' GB');
    ctx.println('User Agent:                ' + navigator.userAgent);
  });

  // -- start --
  defCmd('start', async (args, ctx) => {
    if (args.length === 0) { launchApp('explorer'); return; }
    const target = args[0].toLowerCase();
    launchApp(target);
  });

  // -- tasklist --
  defCmd('tasklist', async (args, ctx) => {
    const windows = await getWindows();
    ctx.println('');
    ctx.println('Image Name                     PID Session Name        Mem Usage');
    ctx.println('========================= ======== ================ ===========');
    for (let i = 0; i < windows.length; ++i) {
      const w = windows[i];
      const name = (w.title || w.appId || 'unknown').slice(0, 25).padEnd(25);
      const pid = String(w.id || i).padStart(8);
      ctx.println(name + ' ' + pid + ' Console                  0 K');
    }
  });

  // -- taskkill --
  defCmd('taskkill', async (args, ctx) => {
    const { switches, positional } = extractSwitches(args);
    const pidArg = positional.find((a, i) => positional[i - 1] && positional[i - 1].toUpperCase() === '/PID') || positional[0];
    if (!pidArg) { ctx.println('ERROR: Invalid syntax.'); return; }
    const windows = await getWindows();
    const target = windows.find(w => String(w.id) === pidArg || (w.title || '').toLowerCase().includes(pidArg.toLowerCase()));
    if (!target) { ctx.println('ERROR: The process "' + pidArg + '" not found.'); return; }
    closeRemoteWindow(target.id);
    ctx.println('SUCCESS: Sent termination signal to the process.');
  });

  // -- find --
  defCmd('find', async (args, ctx) => {
    const text = ctx.pipeInput;
    const { switches, positional } = extractSwitches(args);
    const searchStr = positional.length > 0 ? unquote(positional[0]) : '';
    if (!searchStr) { ctx.println('FIND: Parameter format not correct'); return; }
    const content = text != null ? text : (positional.length > 1 ? (await vfsRead(resolvePath(cmdCwd, toVfsPath(positional[1])))).data : '');
    if (!content) return;
    const lines = content.split('\n');
    const ignoreCase = !!switches['I'];
    const countOnly = !!switches['C'];
    const showNums = !!switches['N'];
    let count = 0;
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      const match = ignoreCase ? line.toLowerCase().includes(searchStr.toLowerCase()) : line.includes(searchStr);
      if (switches['V'] ? !match : match) {
        ++count;
        if (!countOnly) ctx.println((showNums ? '[' + (i + 1) + ']' : '') + line);
      }
    }
    if (countOnly) ctx.println('---------- : ' + count);
  });

  // -- findstr --
  defCmd('findstr', async (args, ctx) => {
    const text = ctx.pipeInput;
    const { switches, positional } = extractSwitches(args);
    const pattern = positional.length > 0 ? unquote(positional[0]) : '';
    if (!pattern) { ctx.println('FINDSTR: Bad command line'); return; }
    const content = text != null ? text : (positional.length > 1 ? (await vfsRead(resolvePath(cmdCwd, toVfsPath(positional[1])))).data : '');
    if (!content) return;
    const lines = content.split('\n');
    const ignoreCase = !!switches['I'];
    try {
      const rx = switches['R'] ? new RegExp(pattern, ignoreCase ? 'i' : '') : null;
      for (const line of lines) {
        const match = rx ? rx.test(line) : (ignoreCase ? line.toLowerCase().includes(pattern.toLowerCase()) : line.includes(pattern));
        if (match) ctx.println(line);
      }
    } catch (e) {
      ctx.println('FINDSTR: Invalid regular expression');
    }
  });

  // -- sort --
  defCmd('sort', async (args, ctx) => {
    const text = ctx.pipeInput;
    const { switches, positional } = extractSwitches(args);
    let content = text;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(cmdCwd, toVfsPath(positional[0])))).data;
    if (!content) return;
    const lines = content.split('\n');
    lines.sort((a, b) => switches['R'] ? b.localeCompare(a) : a.localeCompare(b));
    for (const line of lines) ctx.println(line);
  });

  // -- tree --
  defCmd('tree', async (args, ctx) => {
    const targetPath = args.length > 0 ? resolvePath(cmdCwd, toVfsPath(args[0])) : cmdCwd;
    async function printTree(path, prefix) {
      const result = await vfsList(path);
      const entries = (result.entries || []).filter(e => e.type === 'dir');
      for (let i = 0; i < entries.length; ++i) {
        const isLast = i === entries.length - 1;
        ctx.println(prefix + (isLast ? '\\--- ' : '+--- ') + entries[i].name);
        await printTree(joinPath(path, entries[i].name), prefix + (isLast ? '    ' : '|   '));
      }
    }
    ctx.println(toDisplayPath(targetPath));
    await printTree(targetPath, '');
  });

  // -- rem --
  defCmd('rem', async () => {});

  // -- pause --
  defCmd('pause', async (args, ctx) => {
    ctx.println('Press any key to continue . . .');
    await new Promise(resolve => {
      const handler = () => { document.removeEventListener('keydown', handler); resolve(); };
      document.addEventListener('keydown', handler);
    });
  });

  // -- choice --
  defCmd('choice', async (args, ctx) => {
    const { switches } = extractSwitches(args);
    const choices = (switches['C'] ? args[args.indexOf('/C') + 1] : 'YN') || 'YN';
    const message = switches['M'] ? args.slice(args.indexOf('/M') + 1).join(' ') : 'Are you sure?';
    ctx.println(message + ' [' + choices.split('').join(',') + ']?');
    await new Promise(resolve => {
      const handler = (e) => {
        const key = e.key.toUpperCase();
        if (choices.toUpperCase().includes(key)) {
          document.removeEventListener('keydown', handler);
          cmdLastExitCode = choices.toUpperCase().indexOf(key) + 1;
          ctx.println(key);
          resolve();
        }
      };
      document.addEventListener('keydown', handler);
    });
  });

  // -- timeout --
  defCmd('timeout', async (args, ctx) => {
    const secs = parseInt(args[0]) || parseInt(args[1]) || 5;
    for (let i = secs; i > 0; --i) {
      ctx.println('Waiting for ' + i + ' seconds, press a key to continue ...');
      const interrupted = await new Promise(resolve => {
        const timer = setTimeout(() => { document.removeEventListener('keydown', handler); resolve(false); }, 1000);
        const handler = () => { clearTimeout(timer); document.removeEventListener('keydown', handler); resolve(true); };
        document.addEventListener('keydown', handler);
      });
      if (interrupted) break;
    }
  });

  // -- ping --
  defCmd('ping', async (args, ctx) => {
    const host = args[0] || 'localhost';
    ctx.println('');
    ctx.println('Pinging ' + host + ' with 32 bytes of data:');
    for (let i = 0; i < 4; ++i) {
      await Kernel32.Sleep(200);
      const ms = Math.floor(Math.random() * 10) + 1;
      ctx.println('Reply from 127.0.0.1: bytes=32 time=' + ms + 'ms TTL=128');
    }
    ctx.println('');
    ctx.println('Ping statistics for ' + host + ':');
    ctx.println('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),');
  });

  // -- ipconfig --
  defCmd('ipconfig', async (args, ctx) => {
    ctx.println('');
    ctx.println('SynthelicZ IP Configuration');
    ctx.println('');
    ctx.println('Ethernet adapter Local Area Connection:');
    ctx.println('   Connection-specific DNS Suffix  . :');
    ctx.println('   IPv4 Address. . . . . . . . . . . : 192.168.1.100');
    ctx.println('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
    ctx.println('   Default Gateway . . . . . . . . . : 192.168.1.1');
  });

  // -- netstat --
  defCmd('netstat', async (args, ctx) => {
    ctx.println('');
    ctx.println('Active Connections');
    ctx.println('');
    ctx.println('  Proto  Local Address          Foreign Address        State');
    ctx.println('  TCP    192.168.1.100:80       0.0.0.0:0             LISTENING');
  });

  // -- pushd --
  defCmd('pushd', async (args, ctx) => {
    cmdDirStack.push(cmdCwd);
    if (args.length > 0) {
      const target = resolvePath(cmdCwd, toVfsPath(args[0]));
      cmdCwd = target;
    }
    showPrompt();
  });

  // -- popd --
  defCmd('popd', async (args, ctx) => {
    if (cmdDirStack.length === 0) { ctx.println('The directory stack is empty.'); return; }
    cmdCwd = cmdDirStack.pop();
    showPrompt();
  });

  // -- goto (batch only) --
  defCmd('goto', async (args, ctx) => {
    if (ctx.batchContext) ctx.batchContext.gotoLabel = args[0] || '';
  });

  // -- call (batch only) --
  defCmd('call', async (args, ctx) => {
    if (args.length === 0) return;
    const target = args[0];
    if (target.startsWith(':')) {
      if (ctx.batchContext) ctx.batchContext.callLabel = target.slice(1);
      return;
    }
    const filePath = resolvePath(cmdCwd, toVfsPath(target));
    const result = await vfsRead(filePath);
    if (result.error) { ctx.println('"' + target + '" is not recognized.'); return; }
    await executeBatch(result.data, args.slice(1));
  });

  // -- if --
  defCmd('if', async (args, ctx) => {
    const line = ctx.rawArgs;
    let rest = line;
    let negate = false;
    if (rest.toUpperCase().startsWith('NOT ')) { negate = true; rest = rest.slice(4).trim(); }

    let condition = false;
    let thenCmd = '';

    if (rest.toUpperCase().startsWith('EXIST ')) {
      rest = rest.slice(6).trim();
      const spaceIdx = rest.indexOf(' ');
      const filePath = spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest;
      thenCmd = spaceIdx >= 0 ? rest.slice(spaceIdx + 1).trim() : '';
      const result = await vfsExists(resolvePath(cmdCwd, toVfsPath(filePath)));
      condition = result.exists;
    } else if (rest.toUpperCase().startsWith('ERRORLEVEL ')) {
      rest = rest.slice(11).trim();
      const spaceIdx = rest.indexOf(' ');
      const level = parseInt(spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest);
      thenCmd = spaceIdx >= 0 ? rest.slice(spaceIdx + 1).trim() : '';
      condition = cmdLastExitCode >= level;
    } else {
      const match = rest.match(/^"([^"]*)"?\s*(==|EQU|NEQ|LSS|LEQ|GTR|GEQ)\s*"?([^"]*)"?\s*(.*)/i) ||
                    rest.match(/^(\S+)\s*(==|EQU|NEQ|LSS|LEQ|GTR|GEQ)\s*(\S+)\s*(.*)/i);
      if (match) {
        const [, left, op, right, cmd] = match;
        thenCmd = cmd;
        const lVal = left.replace(/^"|"$/g, '');
        const rVal = right.replace(/^"|"$/g, '');
        const lNum = parseFloat(lVal);
        const rNum = parseFloat(rVal);
        const useNum = !isNaN(lNum) && !isNaN(rNum);
        switch (op.toUpperCase()) {
          case '==': case 'EQU': condition = useNum ? lNum === rNum : lVal === rVal; break;
          case 'NEQ': condition = useNum ? lNum !== rNum : lVal !== rVal; break;
          case 'LSS': condition = useNum ? lNum < rNum : lVal < rVal; break;
          case 'LEQ': condition = useNum ? lNum <= rNum : lVal <= rVal; break;
          case 'GTR': condition = useNum ? lNum > rNum : lVal > rVal; break;
          case 'GEQ': condition = useNum ? lNum >= rNum : lVal >= rVal; break;
        }
      }
    }

    if (negate) condition = !condition;
    if (condition && thenCmd) await executeLine(thenCmd);
  });

  // -- for --
  defCmd('for', async (args, ctx) => {
    const line = ctx.rawArgs;
    const match = line.match(/^%%?(\w)\s+IN\s*\(([^)]*)\)\s*DO\s+(.+)/i);
    if (!match) { ctx.println('The syntax of the command is incorrect.'); return; }
    const [, varChar, inList, doCmd] = match;
    const items = inList.trim().split(/\s+/);
    for (const item of items) {
      const expanded = doCmd.replace(new RegExp('%%?' + varChar, 'g'), item);
      await executeLine(expanded);
    }
  });

  // =========================================================================
  // Batch file execution (cmd.exe)
  // =========================================================================
  function expandBatchParams(line, batchArgs) {
    return line.replace(/%(\d)/g, (m, n) => {
      const idx = parseInt(n);
      return idx < batchArgs.length ? batchArgs[idx] : '';
    }).replace(/%\*/g, batchArgs.slice(1).join(' '));
  }

  async function executeBatch(content, batchArgs) {
    const lines = content.split('\n');
    const ctx = { gotoLabel: null, callLabel: null };
    let i = 0;

    while (i < lines.length) {
      let line = lines[i].trimEnd();
      ++i;

      if (ctx.gotoLabel) {
        const label = ctx.gotoLabel;
        ctx.gotoLabel = null;
        if (label.toUpperCase() === ':EOF') break;
        const labelIdx = lines.findIndex(l => l.trim().toUpperCase() === ':' + label.toUpperCase());
        if (labelIdx >= 0) { i = labelIdx + 1; continue; }
        break;
      }

      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('@')) line = line.slice(1);

      line = expandBatchParams(line, ['batch', ...(batchArgs || [])]);
      line = expandVars(line);

      await executeLine(line, ctx);
    }
  }

  // =========================================================================
  // Core command execution (cmd.exe)
  // =========================================================================
  function createContext(pipeInput) {
    return {
      pipeInput: pipeInput || null,
      output: '',
      rawArgs: '',
      batchContext: null,
      println(text) {
        this.output += (text || '') + '\n';
        println(text);
      },
      print(text) {
        this.output += (text || '');
        print(text);
      },
    };
  }

  async function executeLine(line, batchContext) {
    line = expandVars(line.trim());
    if (!line) return;

    const chains = splitChains(line);
    for (const chain of chains) {
      if (!chain.text) continue;
      if (chain.op === '&&' && cmdLastExitCode !== 0) continue;
      if (chain.op === '||' && cmdLastExitCode === 0) continue;

      const { commands, outputFile, appendMode } = parsePipesAndRedirection(chain.text);
      let pipeData = null;

      for (let i = 0; i < commands.length; ++i) {
        const ctx = createContext(pipeData);
        ctx.batchContext = batchContext || null;

        const cmdLine = commands[i].trim();
        if (!cmdLine) continue;

        const allArgs = parseArgs(cmdLine);
        const cmdName = allArgs[0];
        const restArgs = allArgs.slice(1).map(a => unquote(a));
        ctx.rawArgs = cmdLine.slice(cmdName.length).trim();

        const handler = CMD_COMMANDS[cmdName.toUpperCase()];
        if (handler) {
          try {
            await handler(restArgs, ctx);
            cmdLastExitCode = 0;
          } catch (e) {
            ctx.println('Error: ' + e.message);
            cmdLastExitCode = 1;
          }
        } else {
          const filePath = resolvePath(cmdCwd, toVfsPath(cmdName));
          const ext = extName(cmdName).toLowerCase();
          if (ext === '.bat' || ext === '.cmd') {
            const result = await vfsRead(filePath);
            if (result.error) {
              println('"' + cmdName + '" is not recognized as an internal or external command,');
              println('operable program or batch file.');
              cmdLastExitCode = 9009;
            } else
              await executeBatch(result.data, restArgs);
          } else {
            println('"' + cmdName + '" is not recognized as an internal or external command,');
            println('operable program or batch file.');
            cmdLastExitCode = 9009;
          }
        }

        pipeData = ctx.output;
      }

      if (outputFile && pipeData != null) {
        const outPath = resolvePath(cmdCwd, toVfsPath(outputFile));
        if (appendMode) {
          const existing = await vfsRead(outPath);
          const current = existing.error ? '' : (existing.data || '');
          await vfsWrite(outPath, current + pipeData);
        } else
          await vfsWrite(outPath, pipeData);
      }
    }
  }

  // =========================================================================
  // Tab completion
  // =========================================================================
  async function tabComplete(text) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return text;

    const isFirstToken = tokens.length === 1 && !text.endsWith(' ');

    if (isFirstToken) {
      const prefix = tokens[0].toUpperCase();
      const cmds = Object.keys(CMD_COMMANDS).filter(c => c.startsWith(prefix));
      if (cmds.length === 1) return cmds[0].toLowerCase() + ' ';
      if (cmds.length > 1) {
        println('');
        println(cmds.join('  '));
        showPrompt();
        return text;
      }
    }

    const lastToken = tokens[tokens.length - 1] || '';
    const searchPath = lastToken.includes('/') || lastToken.includes('\\')
      ? resolvePath(cmdCwd, toVfsPath(parentOf(lastToken.replace(/\\/g, '/'))))
      : cmdCwd;
    const prefix = baseName(lastToken.replace(/\\/g, '/'));

    const result = await vfsList(searchPath);
    if (result.error) return text;

    const matches = (result.entries || []).filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (matches.length === 0) return text;
    if (matches.length === 1) {
      const completed = matches[0].name;
      const base = text.slice(0, text.length - lastToken.length);
      const pathPrefix = lastToken.includes('/') || lastToken.includes('\\')
        ? lastToken.slice(0, lastToken.lastIndexOf('/') + 1 || lastToken.lastIndexOf('\\') + 1)
        : '';
      return base + pathPrefix + completed + (matches[0].type === 'dir' ? '\\' : ' ');
    }

    println('');
    for (const m of matches) println('  ' + m.name);
    showPrompt();

    const common = findCommonPrefix(matches.map(m => m.name));
    if (common.length > prefix.length) {
      const base = text.slice(0, text.length - lastToken.length);
      const pathPrefix = lastToken.includes('/') || lastToken.includes('\\')
        ? lastToken.slice(0, lastToken.lastIndexOf('/') + 1 || lastToken.lastIndexOf('\\') + 1)
        : '';
      return base + pathPrefix + common;
    }
    return text;
  }

  function findCommonPrefix(strings) {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; ++i) {
      while (!strings[i].toLowerCase().startsWith(prefix.toLowerCase()))
        prefix = prefix.slice(0, -1);
    }
    return prefix;
  }

  // =========================================================================
  // BASH shell interpreter
  // =========================================================================
  let bashCwd = '/';
  let bashEnv = {
    HOME: '/',
    USER: 'user',
    HOSTNAME: 'sz-pc',
    SHELL: '/bin/bash',
    PS1: '\\u@\\h:\\w$ ',
    PATH: '/usr/bin:/bin',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    PWD: '/',
    OLDPWD: '/',
  };
  let bashAliases = {
    ll: 'ls -la',
    la: 'ls -a',
    l: 'ls -CF',
  };
  let bashFunctions = {};
  let bashHistory = [];
  let bashHistoryIndex = -1;
  let bashLastExitCode = 0;
  let bashLastPid = 0;

  // =========================================================================
  // Bash prompt formatting
  // =========================================================================
  function formatBashPrompt() {
    let ps1 = bashEnv.PS1 || '$ ';
    return ps1
      .replace(/\\u/g, bashEnv.USER)
      .replace(/\\h/g, bashEnv.HOSTNAME.split('.')[0])
      .replace(/\\H/g, bashEnv.HOSTNAME)
      .replace(/\\w/g, bashCwd === bashEnv.HOME ? '~' : bashCwd)
      .replace(/\\W/g, bashCwd === '/' ? '/' : baseName(bashCwd))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\s/g, 'bash')
      .replace(/\\v/g, '5.1')
      .replace(/\\d/g, new Date().toDateString())
      .replace(/\\t/g, new Date().toLocaleTimeString('en-US', { hour12: false }))
      .replace(/\\T/g, new Date().toLocaleTimeString('en-US', { hour12: true }))
      .replace(/\\@/g, new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }))
      .replace(/\\A/g, new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
      .replace(/\\!/g, String(bashHistory.length))
      .replace(/\\#/g, String(bashHistory.length))
      .replace(/\\\$/g, bashEnv.USER === 'root' ? '#' : '$')
      .replace(/\\\[|\\\]/g, '')
      .replace(/\\e/g, '\x1B');
  }

  function showBashPrompt() {
    const promptText = formatBashPrompt();
    promptEl.innerHTML = '';
    const userHost = bashEnv.USER + '@' + bashEnv.HOSTNAME.split('.')[0];
    const path = bashCwd === bashEnv.HOME ? '~' : bashCwd;

    const userSpan = document.createElement('span');
    userSpan.className = 'bash-prompt-user';
    userSpan.textContent = userHost;
    promptEl.appendChild(userSpan);

    const colon = document.createElement('span');
    colon.textContent = ':';
    promptEl.appendChild(colon);

    const pathSpan = document.createElement('span');
    pathSpan.className = 'bash-prompt-path';
    pathSpan.textContent = path;
    promptEl.appendChild(pathSpan);

    const dollar = document.createElement('span');
    dollar.className = 'bash-prompt-dollar';
    dollar.textContent = '$ ';
    promptEl.appendChild(dollar);
  }

  // =========================================================================
  // Bash variable expansion
  // =========================================================================
  function bashExpandVars(text) {
    let result = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '\\' && i + 1 < text.length) {
        result += text[i + 1];
        i += 2;
        continue;
      }
      if (text[i] === '\'') {
        ++i;
        while (i < text.length && text[i] !== '\'') result += text[i++];
        if (i < text.length) ++i;
        continue;
      }
      if (text[i] === '$') {
        ++i;
        if (i >= text.length) { result += '$'; continue; }
        if (text[i] === '?') { result += String(bashLastExitCode); ++i; continue; }
        if (text[i] === '$') { result += String(process_pid()); ++i; continue; }
        if (text[i] === '!') { result += String(bashLastPid); ++i; continue; }
        if (text[i] === '0') { result += 'bash'; ++i; continue; }
        if (text[i] === '#') { result += '0'; ++i; continue; }
        if (text[i] === '@' || text[i] === '*') { ++i; continue; }
        if (text[i] === '(') {
          let depth = 1;
          let cmd = '';
          ++i;
          while (i < text.length && depth > 0) {
            if (text[i] === '(') ++depth;
            if (text[i] === ')') --depth;
            if (depth > 0) cmd += text[i];
            ++i;
          }
          // command substitution not fully implemented — skip
          continue;
        }
        if (text[i] === '{') {
          ++i;
          let varExpr = '';
          while (i < text.length && text[i] !== '}') varExpr += text[i++];
          if (i < text.length) ++i;

          const colonDefault = varExpr.match(/^(\w+):-(.*)/);
          const colonAssign = varExpr.match(/^(\w+):=(.*)/);
          const colonAlt = varExpr.match(/^(\w+):\+(.*)/);
          const colonErr = varExpr.match(/^(\w+):\?(.*)/);
          const hashLen = varExpr.match(/^#(\w+)/);

          if (colonDefault) {
            const val = bashEnv[colonDefault[1]];
            result += (val != null && val !== '') ? val : colonDefault[2];
          } else if (colonAssign) {
            const val = bashEnv[colonAssign[1]];
            if (val != null && val !== '') result += val;
            else { bashEnv[colonAssign[1]] = colonAssign[2]; result += colonAssign[2]; }
          } else if (colonAlt) {
            const val = bashEnv[colonAlt[1]];
            if (val != null && val !== '') result += colonAlt[2];
          } else if (colonErr) {
            const val = bashEnv[colonErr[1]];
            if (val == null || val === '') { println('bash: ' + colonErr[1] + ': ' + colonErr[2]); return ''; }
            result += val;
          } else if (hashLen) {
            const val = bashEnv[hashLen[1]] || '';
            result += String(val.length);
          } else {
            result += bashEnv[varExpr] || '';
          }
          continue;
        }

        let varName = '';
        while (i < text.length && /[A-Za-z0-9_]/.test(text[i])) varName += text[i++];
        if (varName) result += bashEnv[varName] || '';
        else result += '$';
        continue;
      }
      result += text[i++];
    }
    return result;
  }

  function process_pid() { return 1000 + Math.floor(Math.random() * 9000); }

  // =========================================================================
  // Bash tokenizer
  // =========================================================================
  function bashTokenize(line) {
    const tokens = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === ' ' || line[i] === '\t') { ++i; continue; }

      if (line[i] === '#') break;

      if (line[i] === '|' && i + 1 < line.length && line[i + 1] === '|') {
        tokens.push({ type: 'op', value: '||' }); i += 2; continue;
      }
      if (line[i] === '&' && i + 1 < line.length && line[i + 1] === '&') {
        tokens.push({ type: 'op', value: '&&' }); i += 2; continue;
      }
      if (line[i] === '|') { tokens.push({ type: 'op', value: '|' }); ++i; continue; }
      if (line[i] === ';') { tokens.push({ type: 'op', value: ';' }); ++i; continue; }
      if (line[i] === '>' && i + 1 < line.length && line[i + 1] === '>') {
        tokens.push({ type: 'op', value: '>>' }); i += 2; continue;
      }
      if (line[i] === '>') { tokens.push({ type: 'op', value: '>' }); ++i; continue; }
      if (line[i] === '<') { tokens.push({ type: 'op', value: '<' }); ++i; continue; }
      if (line[i] === '2' && i + 1 < line.length && line[i + 1] === '>') {
        if (i + 2 < line.length && line[i + 2] === '>') {
          tokens.push({ type: 'op', value: '2>>' }); i += 3;
        } else {
          tokens.push({ type: 'op', value: '2>' }); i += 2;
        }
        continue;
      }

      let word = '';
      while (i < line.length && !/[\s|&;><]/.test(line[i])) {
        if (line[i] === '\\' && i + 1 < line.length) {
          word += line[i + 1]; i += 2; continue;
        }
        if (line[i] === '\'') {
          ++i;
          while (i < line.length && line[i] !== '\'') word += line[i++];
          if (i < line.length) ++i;
          continue;
        }
        if (line[i] === '"') {
          ++i;
          while (i < line.length && line[i] !== '"') {
            if (line[i] === '\\' && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) {
              word += line[i + 1]; i += 2; continue;
            }
            word += line[i++];
          }
          if (i < line.length) ++i;
          continue;
        }
        word += line[i++];
      }
      if (word) tokens.push({ type: 'word', value: word });
    }
    return tokens;
  }

  // =========================================================================
  // Bash built-in commands
  // =========================================================================
  const BASH_COMMANDS = {};

  function defBash(names, fn) {
    const nameList = Array.isArray(names) ? names : [names];
    for (const name of nameList)
      BASH_COMMANDS[name] = fn;
  }

  // -- echo --
  defBash('echo', async (args, ctx) => {
    let noNewline = false;
    let startIdx = 0;
    if (args[0] === '-n') { noNewline = true; startIdx = 1; }
    else if (args[0] === '-e') { startIdx = 1; }
    const text = args.slice(startIdx).join(' ');
    if (noNewline) ctx.print(text);
    else ctx.println(text);
  });

  // -- printf --
  defBash('printf', async (args, ctx) => {
    if (args.length === 0) return;
    let fmt = args[0];
    let argIdx = 1;
    let result = '';
    for (let i = 0; i < fmt.length; ++i) {
      if (fmt[i] === '\\') {
        ++i;
        if (fmt[i] === 'n') result += '\n';
        else if (fmt[i] === 't') result += '\t';
        else if (fmt[i] === '\\') result += '\\';
        else result += '\\' + fmt[i];
      } else if (fmt[i] === '%') {
        ++i;
        if (fmt[i] === 's') result += args[argIdx++] || '';
        else if (fmt[i] === 'd') result += parseInt(args[argIdx++]) || 0;
        else if (fmt[i] === '%') result += '%';
        else result += '%' + fmt[i];
      } else
        result += fmt[i];
    }
    ctx.print(result);
  });

  // -- cd --
  defBash('cd', async (args, ctx) => {
    let target = args[0] || bashEnv.HOME;
    if (target === '-') target = bashEnv.OLDPWD || '/';
    if (target === '~') target = bashEnv.HOME;
    if (target.startsWith('~/')) target = bashEnv.HOME + target.slice(1);
    const newPath = resolvePath(bashCwd, target);
    const result = await vfsList(newPath);
    if (result.error) { ctx.println('bash: cd: ' + target + ': No such file or directory'); bashLastExitCode = 1; return; }
    bashEnv.OLDPWD = bashCwd;
    bashCwd = newPath;
    bashEnv.PWD = newPath;
    showBashPrompt();
  });

  // -- pwd --
  defBash('pwd', async (args, ctx) => { ctx.println(bashCwd); });

  // -- ls --
  defBash('ls', async (args, ctx) => {
    let showAll = false;
    let longFormat = false;
    const paths = [];
    for (const arg of args) {
      if (arg.startsWith('-')) {
        if (arg.includes('a')) showAll = true;
        if (arg.includes('l')) longFormat = true;
      } else
        paths.push(arg);
    }
    const target = paths.length > 0 ? resolvePath(bashCwd, paths[0]) : bashCwd;
    const result = await vfsList(target);
    if (result.error) { ctx.println('ls: cannot access: No such file or directory'); bashLastExitCode = 1; return; }
    let entries = result.entries || [];
    if (!showAll) entries = entries.filter(e => !e.name.startsWith('.'));

    if (longFormat) {
      ctx.println('total ' + entries.length);
      for (const e of entries) {
        const type = e.type === 'dir' ? 'd' : '-';
        const perms = type + 'rwxr-xr-x';
        const size = String(e.size || 0).padStart(8);
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour12: false });
        ctx.println(perms + '  1 user user ' + size + ' ' + date + ' ' + e.name);
      }
    } else {
      const names = entries.map(e => e.type === 'dir' ? e.name + '/' : e.name);
      ctx.println(names.join('  '));
    }
  });

  // -- cat --
  defBash('cat', async (args, ctx) => {
    if (args.length === 0 && ctx.pipeInput != null) { ctx.println(ctx.pipeInput); return; }
    for (const arg of args) {
      const path = resolvePath(bashCwd, arg);
      const result = await vfsRead(path);
      if (result.error) ctx.println('cat: ' + arg + ': No such file or directory');
      else ctx.print(result.data || '');
    }
  });

  // -- mkdir --
  defBash('mkdir', async (args, ctx) => {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const path = resolvePath(bashCwd, arg);
      const result = await vfsWrite(path + '/.keep', '');
      if (result.error) ctx.println('mkdir: cannot create directory: ' + result.error);
    }
  });

  // -- rmdir --
  defBash('rmdir', async (args, ctx) => {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const path = resolvePath(bashCwd, arg);
      const result = await vfsDelete(path);
      if (result.error) ctx.println('rmdir: failed to remove: ' + result.error);
    }
  });

  // -- rm --
  defBash('rm', async (args, ctx) => {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const path = resolvePath(bashCwd, arg);
      const result = await vfsDelete(path);
      if (result.error) ctx.println('rm: cannot remove: ' + result.error);
    }
  });

  // -- cp --
  defBash('cp', async (args, ctx) => {
    const positional = args.filter(a => !a.startsWith('-'));
    if (positional.length < 2) { ctx.println('cp: missing operand'); return; }
    const src = resolvePath(bashCwd, positional[0]);
    const dest = resolvePath(bashCwd, positional[1]);
    const result = await vfsCopy(src, dest);
    if (result.error) ctx.println('cp: error: ' + result.error);
  });

  // -- mv --
  defBash('mv', async (args, ctx) => {
    const positional = args.filter(a => !a.startsWith('-'));
    if (positional.length < 2) { ctx.println('mv: missing operand'); return; }
    const src = resolvePath(bashCwd, positional[0]);
    const dest = resolvePath(bashCwd, positional[1]);
    const result = await vfsMove(src, dest);
    if (result.error) ctx.println('mv: error: ' + result.error);
  });

  // -- touch --
  defBash('touch', async (args, ctx) => {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const path = resolvePath(bashCwd, arg);
      const exists = await vfsExists(path);
      if (!exists.exists) await vfsWrite(path, '');
    }
  });

  // -- head --
  defBash('head', async (args, ctx) => {
    let n = 10;
    const positional = [];
    for (let i = 0; i < args.length; ++i) {
      if (args[i] === '-n' && i + 1 < args.length) { n = parseInt(args[++i]) || 10; }
      else if (!args[i].startsWith('-')) positional.push(args[i]);
    }
    let content = ctx.pipeInput;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, positional[0]))).data;
    if (!content) return;
    const lines = content.split('\n').slice(0, n);
    ctx.println(lines.join('\n'));
  });

  // -- tail --
  defBash('tail', async (args, ctx) => {
    let n = 10;
    const positional = [];
    for (let i = 0; i < args.length; ++i) {
      if (args[i] === '-n' && i + 1 < args.length) { n = parseInt(args[++i]) || 10; }
      else if (!args[i].startsWith('-')) positional.push(args[i]);
    }
    let content = ctx.pipeInput;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, positional[0]))).data;
    if (!content) return;
    const lines = content.split('\n');
    ctx.println(lines.slice(-n).join('\n'));
  });

  // -- wc --
  defBash('wc', async (args, ctx) => {
    const positional = args.filter(a => !a.startsWith('-'));
    let content = ctx.pipeInput;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, positional[0]))).data;
    if (!content) { ctx.println('      0       0       0'); return; }
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    ctx.println('      ' + lines + '       ' + words + '       ' + chars);
  });

  // -- grep --
  defBash('grep', async (args, ctx) => {
    let ignoreCase = false;
    let invert = false;
    let countOnly = false;
    let showNums = false;
    const positional = [];
    for (let i = 0; i < args.length; ++i) {
      const a = args[i];
      if (a === '-i') ignoreCase = true;
      else if (a === '-v') invert = true;
      else if (a === '-c') countOnly = true;
      else if (a === '-n') showNums = true;
      else if (a.startsWith('-') && a.length > 1) {
        for (const ch of a.slice(1)) {
          if (ch === 'i') ignoreCase = true;
          if (ch === 'v') invert = true;
          if (ch === 'c') countOnly = true;
          if (ch === 'n') showNums = true;
        }
      } else positional.push(a);
    }
    const pattern = positional[0] || '';
    let content = ctx.pipeInput;
    if (content == null && positional.length > 1)
      content = (await vfsRead(resolvePath(bashCwd, positional[1]))).data;
    if (!content || !pattern) return;
    try {
      const rx = new RegExp(pattern, ignoreCase ? 'i' : '');
      const lines = content.split('\n');
      let count = 0;
      for (let i = 0; i < lines.length; ++i) {
        const match = rx.test(lines[i]);
        if (invert ? !match : match) {
          ++count;
          if (!countOnly)
            ctx.println((showNums ? (i + 1) + ':' : '') + lines[i]);
        }
      }
      if (countOnly) ctx.println(String(count));
      bashLastExitCode = count > 0 ? 0 : 1;
    } catch (e) {
      ctx.println('grep: invalid regex');
      bashLastExitCode = 2;
    }
  });

  // -- sed (basic s/old/new/ support) --
  defBash('sed', async (args, ctx) => {
    const positional = args.filter(a => !a.startsWith('-'));
    const expr = positional[0] || '';
    let content = ctx.pipeInput;
    if (content == null && positional.length > 1)
      content = (await vfsRead(resolvePath(bashCwd, positional[1]))).data;
    if (!content) return;
    const sedMatch = expr.match(/^s(.)(.+?)\1(.*?)\1([gi]*)$/);
    if (sedMatch) {
      const [, , pattern, replacement, flags] = sedMatch;
      const rx = new RegExp(pattern, flags);
      const lines = content.split('\n');
      for (const line of lines)
        ctx.println(line.replace(rx, replacement));
    } else
      ctx.println(content);
  });

  // -- sort --
  defBash('sort', async (args, ctx) => {
    let reverse = false;
    let unique = false;
    const positional = [];
    for (const a of args) {
      if (a === '-r') reverse = true;
      else if (a === '-u') unique = true;
      else if (!a.startsWith('-')) positional.push(a);
    }
    let content = ctx.pipeInput;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, positional[0]))).data;
    if (!content) return;
    let lines = content.split('\n');
    lines.sort((a, b) => reverse ? b.localeCompare(a) : a.localeCompare(b));
    if (unique) lines = [...new Set(lines)];
    ctx.println(lines.join('\n'));
  });

  // -- uniq --
  defBash('uniq', async (args, ctx) => {
    let content = ctx.pipeInput;
    if (content == null && args.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, args[0]))).data;
    if (!content) return;
    const lines = content.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; ++i) {
      if (i === 0 || lines[i] !== lines[i - 1]) result.push(lines[i]);
    }
    ctx.println(result.join('\n'));
  });

  // -- tr --
  defBash('tr', async (args, ctx) => {
    let content = ctx.pipeInput || '';
    if (args.length >= 2) {
      const from = args[0];
      const to = args[1];
      let result = '';
      for (const ch of content) {
        const idx = from.indexOf(ch);
        result += idx >= 0 && idx < to.length ? to[idx] : ch;
      }
      ctx.print(result);
    } else if (args.length === 1 && args[0] === '-d' && args.length > 1) {
      ctx.print(content);
    } else
      ctx.print(content);
  });

  // -- cut --
  defBash('cut', async (args, ctx) => {
    let delim = '\t';
    let fields = null;
    const positional = [];
    for (let i = 0; i < args.length; ++i) {
      if (args[i] === '-d' && i + 1 < args.length) delim = args[++i];
      else if (args[i] === '-f' && i + 1 < args.length) fields = args[++i];
      else if (!args[i].startsWith('-')) positional.push(args[i]);
    }
    let content = ctx.pipeInput;
    if (content == null && positional.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, positional[0]))).data;
    if (!content || !fields) return;
    const fieldNums = fields.split(',').map(f => parseInt(f) - 1);
    const lines = content.split('\n');
    for (const line of lines) {
      const parts = line.split(delim);
      ctx.println(fieldNums.map(f => parts[f] || '').join(delim));
    }
  });

  // -- rev --
  defBash('rev', async (args, ctx) => {
    let content = ctx.pipeInput;
    if (content == null && args.length > 0)
      content = (await vfsRead(resolvePath(bashCwd, args[0]))).data;
    if (!content) return;
    const lines = content.split('\n');
    for (const line of lines) ctx.println(line.split('').reverse().join(''));
  });

  // -- tee --
  defBash('tee', async (args, ctx) => {
    const content = ctx.pipeInput || '';
    ctx.print(content);
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const path = resolvePath(bashCwd, arg);
      await vfsWrite(path, content);
    }
  });

  // -- date --
  defBash('date', async (args, ctx) => {
    ctx.println(new Date().toString());
  });

  // -- cal --
  defBash('cal', async (args, ctx) => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    ctx.println('     ' + monthName + ' ' + year);
    ctx.println('Su Mo Tu We Th Fr Sa');
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let line = '   '.repeat(firstDay);
    for (let d = 1; d <= daysInMonth; ++d) {
      line += String(d).padStart(2) + ' ';
      if ((firstDay + d) % 7 === 0) { ctx.println(line.trimEnd()); line = ''; }
    }
    if (line.trim()) ctx.println(line.trimEnd());
  });

  // -- whoami --
  defBash('whoami', async (args, ctx) => { ctx.println(bashEnv.USER); });

  // -- hostname --
  defBash('hostname', async (args, ctx) => { ctx.println(bashEnv.HOSTNAME); });

  // -- uname --
  defBash('uname', async (args, ctx) => {
    const all = args.includes('-a');
    if (all) ctx.println('SynthelicZ sz-pc 2.0.2025 SZ Browser ' + navigator.platform);
    else ctx.println('SynthelicZ');
  });

  // -- env --
  defBash('env', async (args, ctx) => {
    for (const [k, v] of Object.entries(bashEnv)) ctx.println(k + '=' + v);
  });

  // -- export --
  defBash('export', async (args, ctx) => {
    for (const arg of args) {
      const eq = arg.indexOf('=');
      if (eq >= 0) bashEnv[arg.slice(0, eq)] = arg.slice(eq + 1);
    }
  });

  // -- unset --
  defBash('unset', async (args, ctx) => {
    for (const arg of args) delete bashEnv[arg];
  });

  // -- alias --
  defBash('alias', async (args, ctx) => {
    if (args.length === 0) {
      for (const [k, v] of Object.entries(bashAliases)) ctx.println('alias ' + k + "='" + v + "'");
      return;
    }
    for (const arg of args) {
      const eq = arg.indexOf('=');
      if (eq >= 0) bashAliases[arg.slice(0, eq)] = arg.slice(eq + 1).replace(/^['"]|['"]$/g, '');
    }
  });

  // -- unalias --
  defBash('unalias', async (args, ctx) => {
    for (const arg of args) delete bashAliases[arg];
  });

  // -- type --
  defBash('type', async (args, ctx) => {
    for (const arg of args) {
      if (BASH_COMMANDS[arg]) ctx.println(arg + ' is a shell builtin');
      else if (bashAliases[arg]) ctx.println(arg + ' is aliased to `' + bashAliases[arg] + "'");
      else if (bashFunctions[arg]) ctx.println(arg + ' is a function');
      else ctx.println('bash: type: ' + arg + ': not found');
    }
  });

  // -- which --
  defBash('which', async (args, ctx) => {
    for (const arg of args) {
      if (BASH_COMMANDS[arg]) ctx.println('/usr/bin/' + arg);
      else ctx.println('which: no ' + arg + ' in (' + bashEnv.PATH + ')');
    }
  });

  // -- read --
  defBash('read', async (args, ctx) => {
    const varName = args[0] || 'REPLY';
    bashEnv[varName] = '';
  });

  // -- test / [ --
  defBash(['test', '['], async (args, ctx) => {
    let testArgs = [...args];
    if (testArgs[testArgs.length - 1] === ']') testArgs.pop();
    if (testArgs.length === 0) { bashLastExitCode = 1; return; }
    if (testArgs.length === 1) { bashLastExitCode = testArgs[0] ? 0 : 1; return; }

    if (testArgs[0] === '-z') { bashLastExitCode = (!testArgs[1] || testArgs[1] === '') ? 0 : 1; return; }
    if (testArgs[0] === '-n') { bashLastExitCode = (testArgs[1] && testArgs[1] !== '') ? 0 : 1; return; }
    if (testArgs[0] === '-e' || testArgs[0] === '-f' || testArgs[0] === '-d') {
      const result = await vfsExists(resolvePath(bashCwd, testArgs[1] || ''));
      bashLastExitCode = result.exists ? 0 : 1;
      return;
    }

    if (testArgs.length >= 3) {
      const [left, op, right] = [testArgs[0], testArgs[1], testArgs[2]];
      const lNum = parseFloat(left);
      const rNum = parseFloat(right);
      switch (op) {
        case '=': case '==': bashLastExitCode = left === right ? 0 : 1; return;
        case '!=': bashLastExitCode = left !== right ? 0 : 1; return;
        case '-eq': bashLastExitCode = lNum === rNum ? 0 : 1; return;
        case '-ne': bashLastExitCode = lNum !== rNum ? 0 : 1; return;
        case '-lt': bashLastExitCode = lNum < rNum ? 0 : 1; return;
        case '-le': bashLastExitCode = lNum <= rNum ? 0 : 1; return;
        case '-gt': bashLastExitCode = lNum > rNum ? 0 : 1; return;
        case '-ge': bashLastExitCode = lNum >= rNum ? 0 : 1; return;
      }
    }
    bashLastExitCode = 1;
  });

  // -- true / false --
  defBash('true', async () => { bashLastExitCode = 0; });
  defBash('false', async () => { bashLastExitCode = 1; });

  // -- seq --
  defBash('seq', async (args, ctx) => {
    let start = 1, step = 1, end = 1;
    if (args.length === 1) end = parseInt(args[0]) || 1;
    else if (args.length === 2) { start = parseInt(args[0]) || 1; end = parseInt(args[1]) || 1; }
    else if (args.length >= 3) { start = parseInt(args[0]) || 1; step = parseInt(args[1]) || 1; end = parseInt(args[2]) || 1; }
    if (step > 0) for (let i = start; i <= end; i += step) ctx.println(String(i));
    else if (step < 0) for (let i = start; i >= end; i += step) ctx.println(String(i));
  });

  // -- basename --
  defBash('basename', async (args, ctx) => {
    if (args.length === 0) { ctx.println('basename: missing operand'); return; }
    let name = baseName(args[0]);
    if (args.length > 1) {
      const suffix = args[1];
      if (name.endsWith(suffix)) name = name.slice(0, -suffix.length);
    }
    ctx.println(name);
  });

  // -- dirname --
  defBash('dirname', async (args, ctx) => {
    if (args.length === 0) { ctx.println('dirname: missing operand'); return; }
    ctx.println(parentOf(args[0]) || '.');
  });

  // -- realpath --
  defBash('realpath', async (args, ctx) => {
    for (const arg of args)
      ctx.println(resolvePath(bashCwd, arg));
  });

  // -- file --
  defBash('file', async (args, ctx) => {
    for (const arg of args) {
      const path = resolvePath(bashCwd, arg);
      const exists = await vfsExists(path);
      if (!exists.exists) { ctx.println(arg + ': cannot open (No such file)'); continue; }
      const result = await vfsRead(path);
      if (result.error) ctx.println(arg + ': directory');
      else ctx.println(arg + ': ASCII text, ' + (result.data || '').length + ' bytes');
    }
  });

  // -- du --
  defBash('du', async (args, ctx) => {
    const target = args.find(a => !a.startsWith('-')) || '.';
    const path = resolvePath(bashCwd, target);
    const result = await vfsList(path);
    let total = 0;
    for (const e of (result.entries || [])) total += e.size || 0;
    ctx.println(total + '\t' + target);
  });

  // -- df --
  defBash('df', async (args, ctx) => {
    ctx.println('Filesystem     1K-blocks    Used Available Use% Mounted on');
    ctx.println('szfs             5120000  512000   4608000  11% /');
  });

  // -- free --
  defBash('free', async (args, ctx) => {
    const mem = (navigator.deviceMemory || 8) * 1024;
    ctx.println('              total        used        free');
    ctx.println('Mem:       ' + String(mem).padStart(8) + '    ' + String(Math.floor(mem * 0.4)).padStart(8) + '    ' + String(Math.floor(mem * 0.6)).padStart(8));
  });

  // -- uptime --
  defBash('uptime', async (args, ctx) => {
    const secs = Math.floor(performance.now() / 1000);
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    ctx.println(' ' + new Date().toLocaleTimeString() + ' up ' + hrs + ':' + String(mins).padStart(2, '0') + ', 1 user, load average: 0.00, 0.00, 0.00');
  });

  // -- ps --
  defBash('ps', async (args, ctx) => {
    const windows = await getWindows();
    ctx.println('  PID TTY          TIME CMD');
    for (let i = 0; i < windows.length; ++i) {
      const w = windows[i];
      ctx.println(String(w.id || 1000 + i).padStart(5) + ' pts/0    00:00:00 ' + (w.appId || 'unknown'));
    }
  });

  // -- kill --
  defBash('kill', async (args, ctx) => {
    for (const arg of args) {
      if (arg.startsWith('-')) continue;
      const windows = await getWindows();
      const target = windows.find(w => String(w.id) === arg);
      if (target) closeRemoteWindow(target.id);
      else ctx.println('bash: kill: (' + arg + ') - No such process');
    }
  });

  // -- history --
  defBash('history', async (args, ctx) => {
    for (let i = 0; i < bashHistory.length; ++i)
      ctx.println(String(i + 1).padStart(5) + '  ' + bashHistory[i]);
  });

  // -- source / . --
  defBash(['source', '.'], async (args, ctx) => {
    if (args.length === 0) { ctx.println('bash: source: filename argument required'); return; }
    const path = resolvePath(bashCwd, args[0]);
    const result = await vfsRead(path);
    if (result.error) { ctx.println('bash: ' + args[0] + ': No such file or directory'); return; }
    const lines = result.data.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.trim().startsWith('#'))
        await executeBashLine(line);
    }
  });

  // -- exec --
  defBash('exec', async (args, ctx) => {
    if (args.length === 0) return;
    await executeBashLine(args.join(' '));
  });

  // -- eval --
  defBash('eval', async (args, ctx) => {
    if (args.length === 0) return;
    await executeBashLine(args.join(' '));
  });

  // -- exit --
  defBash('exit', async (args, ctx) => {
    closeWindow();
  });

  // -- clear --
  defBash('clear', async () => { clearScreen(); });

  // =========================================================================
  // Bash command execution
  // =========================================================================
  function createBashContext(pipeInput) {
    return {
      pipeInput: pipeInput || null,
      output: '',
      println(text) {
        this.output += (text || '') + '\n';
        println(text);
      },
      print(text) {
        this.output += (text || '');
        print(text);
      },
    };
  }

  async function executeBashLine(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    line = bashExpandVars(line);

    const tokens = bashTokenize(line);
    if (tokens.length === 0) return;

    const pipelines = [];
    let currentPipeline = [];
    let chainOp = null;

    for (const token of tokens) {
      if (token.type === 'op' && (token.value === '|' || token.value === '&&' || token.value === '||' || token.value === ';')) {
        if (currentPipeline.length > 0) {
          pipelines.push({ commands: splitBashPipeline(currentPipeline), chainOp });
          currentPipeline = [];
        }
        chainOp = token.value === '|' ? null : token.value;
        if (token.value === '|') {
          if (pipelines.length > 0)
            pipelines[pipelines.length - 1].pipeNext = true;
        }
      } else
        currentPipeline.push(token);
    }
    if (currentPipeline.length > 0)
      pipelines.push({ commands: splitBashPipeline(currentPipeline), chainOp });

    let pipeData = null;
    for (const pipeline of pipelines) {
      if (pipeline.chainOp === '&&' && bashLastExitCode !== 0) continue;
      if (pipeline.chainOp === '||' && bashLastExitCode === 0) continue;
      if (pipeline.chainOp === ';') { /* always run */ }

      for (const cmdTokens of pipeline.commands) {
        if (cmdTokens.length === 0) continue;

        let outputFile = null;
        let appendMode = false;
        const words = [];

        for (let i = 0; i < cmdTokens.length; ++i) {
          if (cmdTokens[i].type === 'op' && (cmdTokens[i].value === '>' || cmdTokens[i].value === '>>')) {
            appendMode = cmdTokens[i].value === '>>';
            if (i + 1 < cmdTokens.length) outputFile = cmdTokens[++i].value;
            continue;
          }
          if (cmdTokens[i].type === 'op') continue;
          words.push(cmdTokens[i].value);
        }

        if (words.length === 0) continue;

        // Handle variable assignment
        if (words.length === 1 && words[0].includes('=') && /^[A-Za-z_]/.test(words[0])) {
          const eq = words[0].indexOf('=');
          bashEnv[words[0].slice(0, eq)] = words[0].slice(eq + 1);
          continue;
        }

        // Expand aliases
        let cmdName = words[0];
        if (bashAliases[cmdName]) {
          const expanded = bashAliases[cmdName] + ' ' + words.slice(1).join(' ');
          await executeBashLine(expanded);
          pipeData = null;
          continue;
        }

        const cmdArgs = words.slice(1);
        const ctx = createBashContext(pipeData);

        const handler = BASH_COMMANDS[cmdName];
        if (handler) {
          try {
            await handler(cmdArgs, ctx);
            if (cmdName !== 'test' && cmdName !== '[' && cmdName !== 'true' && cmdName !== 'false')
              bashLastExitCode = 0;
          } catch (e) {
            ctx.println('bash: ' + cmdName + ': ' + e.message);
            bashLastExitCode = 1;
          }
        } else {
          println('bash: ' + cmdName + ': command not found');
          bashLastExitCode = 127;
        }

        pipeData = ctx.output || null;

        if (outputFile) {
          const path = resolvePath(bashCwd, outputFile);
          if (appendMode) {
            const existing = await vfsRead(path);
            await vfsWrite(path, (existing.data || '') + (pipeData || ''));
          } else
            await vfsWrite(path, pipeData || '');
          pipeData = null;
        }
      }

      if (pipeline.pipeNext) continue;
      pipeData = null;
    }
  }

  function splitBashPipeline(tokens) {
    const commands = [[]];
    for (const token of tokens) {
      if (token.type === 'op' && token.value === '|')
        commands.push([]);
      else
        commands[commands.length - 1].push(token);
    }
    return commands;
  }

  // =========================================================================
  // Bash tab completion
  // =========================================================================
  async function bashTabComplete(text) {
    const tokens = text.split(/\s+/);
    if (tokens.length === 0) return text;

    const isFirstToken = tokens.length === 1;

    if (isFirstToken) {
      const prefix = tokens[0].toLowerCase();
      const cmds = Object.keys(BASH_COMMANDS).filter(c => c.startsWith(prefix));
      if (cmds.length === 1) return cmds[0] + ' ';
      if (cmds.length > 1) {
        println('');
        println(cmds.join('  '));
        showBashPrompt();
        const common = findCommonPrefix(cmds);
        return common.length > prefix.length ? common : text;
      }
    }

    const lastToken = tokens[tokens.length - 1] || '';
    let searchDir, prefix;
    if (lastToken.includes('/')) {
      searchDir = resolvePath(bashCwd, parentOf(lastToken));
      prefix = baseName(lastToken);
    } else {
      searchDir = bashCwd;
      prefix = lastToken;
    }

    const result = await vfsList(searchDir);
    if (result.error) return text;

    const matches = (result.entries || []).filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()));
    if (matches.length === 0) return text;
    if (matches.length === 1) {
      const completed = matches[0].name;
      const base = text.slice(0, text.length - lastToken.length);
      const pathPrefix = lastToken.includes('/') ? lastToken.slice(0, lastToken.lastIndexOf('/') + 1) : '';
      return base + pathPrefix + completed + (matches[0].type === 'dir' ? '/' : ' ');
    }

    println('');
    for (const m of matches) println('  ' + m.name);
    showBashPrompt();
    const common = findCommonPrefix(matches.map(m => m.name));
    if (common.length > prefix.length) {
      const base = text.slice(0, text.length - lastToken.length);
      const pathPrefix = lastToken.includes('/') ? lastToken.slice(0, lastToken.lastIndexOf('/') + 1) : '';
      return base + pathPrefix + common;
    }
    return text;
  }

  // =========================================================================
  // Shell switching
  // =========================================================================
  function switchShell(shell) {
    currentShell = shell;
    clearScreen();
    if (shell === 'cmd') {
      println('SynthelicZ [Version 2.0.2025]');
      println('(c) SynthelicZ Corporation. All rights reserved.');
      println('');
      setWindowTitle('Terminal - cmd.exe');
    } else {
      println('GNU bash, version 5.1.0(1)-release (sz-pc)');
      println('Type "help" for a list of commands.');
      println('');
      setWindowTitle('Terminal - bash');
    }
    showPrompt();
    inputEl.focus();
  }

  shellSelect.addEventListener('change', () => {
    switchShell(shellSelect.value);
  });

  // =========================================================================
  // Cursor block positioning
  // =========================================================================
  function updateCursor() {
    if (document.activeElement !== inputEl) {
      cursorBlock.style.display = 'none';
      return;
    }
    cursorBlock.style.display = 'block';
    cursorMeasure.textContent = inputEl.value.slice(0, inputEl.selectionStart);
    const promptWidth = promptEl.offsetWidth;
    const textWidth = cursorMeasure.offsetWidth;
    cursorBlock.style.left = (promptWidth + textWidth + 6) + 'px';
  }

  inputEl.addEventListener('input', updateCursor);
  inputEl.addEventListener('click', updateCursor);
  inputEl.addEventListener('focus', updateCursor);
  inputEl.addEventListener('blur', () => { cursorBlock.style.display = 'none'; });
  inputEl.addEventListener('keyup', updateCursor);

  // =========================================================================
  // Main input handler
  // =========================================================================
  inputEl.addEventListener('keydown', async (e) => {
    const history = currentShell === 'cmd' ? cmdHistory : bashHistory;
    let historyIndex = currentShell === 'cmd' ? cmdHistoryIndex : bashHistoryIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        if (historyIndex < 0) historyIndex = history.length;
        if (historyIndex > 0) --historyIndex;
        inputEl.value = history[historyIndex] || '';
        if (currentShell === 'cmd') cmdHistoryIndex = historyIndex;
        else bashHistoryIndex = historyIndex;
        updateCursor();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length > 0 && historyIndex >= 0) {
        ++historyIndex;
        if (historyIndex >= history.length) {
          historyIndex = -1;
          inputEl.value = '';
        } else
          inputEl.value = history[historyIndex] || '';
        if (currentShell === 'cmd') cmdHistoryIndex = historyIndex;
        else bashHistoryIndex = historyIndex;
        updateCursor();
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const text = inputEl.value;
      if (currentShell === 'cmd')
        inputEl.value = await tabComplete(text);
      else
        inputEl.value = await bashTabComplete(text);
      updateCursor();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      inputEl.value = '';
      updateCursor();
      return;
    }

    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearScreen();
      showPrompt();
      return;
    }

    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      println(promptEl.textContent + inputEl.value + '^C');
      inputEl.value = '';
      showPrompt();
      updateCursor();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const line = inputEl.value;
      inputEl.value = '';

      if (currentShell === 'cmd') {
        println(formatCmdPrompt() + line);
        if (line.trim()) {
          cmdHistory.push(line);
          cmdHistoryIndex = -1;
          await executeLine(line);
        }
      } else {
        const promptText = formatBashPrompt();
        println(promptText + line);
        if (line.trim()) {
          bashHistory.push(line);
          bashHistoryIndex = -1;
          await executeBashLine(line);
        }
      }
      showPrompt();
      updateCursor();
      outputEl.scrollTop = outputEl.scrollHeight;
    }
  });

  // Focus input on click anywhere
  document.addEventListener('click', (e) => {
    if (e.target !== shellSelect && e.target.tagName !== 'OPTION')
      inputEl.focus();
  });

  // =========================================================================
  // Init
  // =========================================================================
  applyColors();
  const cmdLine = Kernel32.GetCommandLine();
  const initShell = cmdLine.shell || 'cmd';
  shellSelect.value = initShell;
  switchShell(initShell);

})();
