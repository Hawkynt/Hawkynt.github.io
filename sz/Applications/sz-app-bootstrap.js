/**
 * SZ App Bootstrap Library — Windows DLL-like API
 *
 * Include this in any application's <head> to enable:
 *   - Standalone redirect (opens inside the OS if accessed directly)
 *   - Automatic theme injection via postMessage
 *   - Windows API-like DLL namespaces for OS communication
 *
 * Usage: <script src="../sz-app-bootstrap.js"></script>
 *
 * DLL Namespaces:
 *   SZ.Dlls.User32   — window management, messages, dialogs
 *   SZ.Dlls.Kernel32 — VFS file operations, timing, command line
 *   SZ.Dlls.GDI32    — system colors, fonts (synchronous CSS reads)
 *   SZ.Dlls.Shell32  — app launching, special folders
 *   SZ.Dlls.ComDlg32 — file open/save dialogs
 *   SZ.Dlls.Advapi32 — settings (registry-like)
 *
 * WindowProc:
 *   SZ.Dlls.User32.RegisterWindowProc(fn)
 *   fn receives (msg, wParam, lParam) when the OS broadcasts WM_ messages.
 *
 * Constants:
 *   WM_CLOSE, WM_THEMECHANGED, WM_SETTINGCHANGE, etc.
 *   MB_OK, MB_YESNO, IDOK, IDYES, etc.
 *   COLOR_WINDOW, COLOR_BTNFACE, etc.
 *   SM_CXSCREEN, SM_CYSCREEN, etc.
 *   CSIDL_PERSONAL, CSIDL_DESKTOP, etc.
 */
;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const _isInsideOS = (window.parent !== window);

  // ── Standalone redirect ──────────────────────────────────────────
  if (!_isInsideOS) {
    const pathParts = location.pathname.replace(/\\/g, '/').split('/');
    const htmlIndex = pathParts.findIndex(p => p === 'Applications');
    let appId = null;

    if (htmlIndex >= 0 && htmlIndex + 1 < pathParts.length)
      appId = pathParts[htmlIndex + 1];

    if (appId) {
      const baseParts = pathParts.slice(0, htmlIndex);
      const osPath = baseParts.join('/') + '/index.html';
      const redirectUrl = osPath + '?app=' + encodeURIComponent(appId) + '&maximized=1';
      location.replace(redirectUrl);
      return;
    }
  }

  // ── Theme injection via postMessage ──────────────────────────────
  const _injectThemeCSS = (cssText) => {
    if (!cssText)
      return;
    let el = document.getElementById('sz-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'sz-theme';
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = cssText;
  };

  // ── Centralized SendMessage infrastructure ──────────────────────
  let _reqId = 0;
  const _pending = new Map();

  function _sendMessage(type, payload) {
    if (!_isInsideOS)
      return Promise.reject(new Error('Not inside OS'));
    return new Promise((resolve, reject) => {
      const requestId = 'dll-' + (++_reqId);
      const timer = setTimeout(() => {
        _pending.delete(requestId);
        reject(new Error('Timeout: ' + type));
      }, 10000);
      _pending.set(requestId, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      window.parent.postMessage({ type, requestId, ...payload }, '*');
    });
  }

  function _postToParent(type, payload) {
    if (_isInsideOS)
      window.parent.postMessage({ type, ...payload }, '*');
  }

  // ── WindowProc dispatch ─────────────────────────────────────────
  const _windowProcs = [];

  // ── Message listener ────────────────────────────────────────────
  if (_isInsideOS) {
    window.addEventListener('message', (e) => {
      const data = e.data;
      if (!data || typeof data !== 'object')
        return;

      // Theme CSS injection
      if (data.type === 'sz:themeCSS') {
        _injectThemeCSS(data.css);
        // Also dispatch as WM_THEMECHANGED so WindowProc handlers fire
        for (const proc of _windowProcs)
          proc(WM_THEMECHANGED, 0, 0);
        return;
      }

      // Response to a pending SendMessage request
      if (data.requestId && _pending.has(data.requestId)) {
        _pending.get(data.requestId)(data);
        _pending.delete(data.requestId);
        return;
      }

      // WM_ broadcast from OS
      if (data.type === 'sz:wm') {
        for (const proc of _windowProcs)
          proc(data.msg, data.wParam ?? 0, data.lParam ?? 0);
        return;
      }
    });

    // Request theme CSS from parent on load
    const _requestTheme = () => _postToParent('sz:getTheme');
    _requestTheme();
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', _requestTheme);
    else
      _requestTheme();
  }

  // ══════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════════════

  // ── Window Messages ─────────────────────────────────────────────
  const WM_SIZE            = 0x0005;
  const WM_ACTIVATE        = 0x0006;
  const WM_PAINT           = 0x000F;
  const WM_CLOSE           = 0x0010;
  const WM_SETTINGCHANGE   = 0x001A;
  const WM_FONTCHANGE      = 0x001D;
  const WM_DISPLAYCHANGE   = 0x007E;
  const WM_THEMECHANGED    = 0x031A;
  const WM_USER            = 0x0400;

  // ── MessageBox flags ────────────────────────────────────────────
  const MB_OK              = 0x0000;
  const MB_OKCANCEL        = 0x0001;
  const MB_YESNOCANCEL     = 0x0003;
  const MB_YESNO           = 0x0004;
  const MB_ICONERROR       = 0x0010;
  const MB_ICONQUESTION    = 0x0020;
  const MB_ICONWARNING     = 0x0030;
  const MB_ICONINFORMATION = 0x0040;

  // ── MessageBox results ──────────────────────────────────────────
  const IDOK     = 1;
  const IDCANCEL = 2;
  const IDYES    = 6;
  const IDNO     = 7;

  // ── System color indices ────────────────────────────────────────
  const COLOR_SCROLLBAR          = 0;
  const COLOR_BACKGROUND         = 1;
  const COLOR_ACTIVECAPTION      = 2;
  const COLOR_INACTIVECAPTION    = 3;
  const COLOR_MENU               = 4;
  const COLOR_WINDOW             = 5;
  const COLOR_WINDOWFRAME        = 6;
  const COLOR_MENUTEXT           = 7;
  const COLOR_WINDOWTEXT         = 8;
  const COLOR_CAPTIONTEXT        = 9;
  const COLOR_ACTIVEBORDER       = 10;
  const COLOR_INACTIVEBORDER     = 11;
  const COLOR_APPWORKSPACE       = 12;
  const COLOR_HIGHLIGHT          = 13;
  const COLOR_HIGHLIGHTTEXT      = 14;
  const COLOR_BTNFACE            = 15;
  const COLOR_BTNSHADOW          = 16;
  const COLOR_GRAYTEXT           = 17;
  const COLOR_BTNTEXT            = 18;
  const COLOR_INACTIVECAPTIONTEXT = 19;
  const COLOR_BTNHIGHLIGHT       = 20;
  const COLOR_3DDKSHADOW         = 21;
  const COLOR_3DLIGHT            = 22;
  const COLOR_INFOTEXT           = 23;
  const COLOR_INFOBK             = 24;
  const COLOR_HOTLIGHT           = 26;
  const COLOR_GRADIENTACTIVECAPTION   = 27;
  const COLOR_GRADIENTINACTIVECAPTION = 28;

  // ── System metrics indices ──────────────────────────────────────
  const SM_CXSCREEN      = 0;
  const SM_CYSCREEN      = 1;
  const SM_CXFULLSCREEN  = 16;
  const SM_CYFULLSCREEN  = 17;
  const SM_CYCAPTION     = 4;
  const SM_CYMENU        = 15;

  // ── CSIDL (special folder IDs) ──────────────────────────────────
  const CSIDL_DESKTOP    = 0x0000;
  const CSIDL_PERSONAL   = 0x0005;
  const CSIDL_APPDATA    = 0x001A;
  const CSIDL_WINDOWS    = 0x0024;
  const CSIDL_SYSTEM     = 0x0025;
  const CSIDL_PROGRAM_FILES = 0x0026;

  // ── SHFileOperation ops ─────────────────────────────────────────
  const FO_MOVE   = 0x0001;
  const FO_COPY   = 0x0002;
  const FO_DELETE = 0x0003;
  const FO_RENAME = 0x0004;

  // ── Expose constants on window for convenience ──────────────────
  const _constants = {
    WM_SIZE, WM_ACTIVATE, WM_PAINT, WM_CLOSE, WM_SETTINGCHANGE,
    WM_FONTCHANGE, WM_DISPLAYCHANGE, WM_THEMECHANGED, WM_USER,
    MB_OK, MB_OKCANCEL, MB_YESNOCANCEL, MB_YESNO,
    MB_ICONERROR, MB_ICONQUESTION, MB_ICONWARNING, MB_ICONINFORMATION,
    IDOK, IDCANCEL, IDYES, IDNO,
    COLOR_SCROLLBAR, COLOR_BACKGROUND, COLOR_ACTIVECAPTION, COLOR_INACTIVECAPTION,
    COLOR_MENU, COLOR_WINDOW, COLOR_WINDOWFRAME, COLOR_MENUTEXT,
    COLOR_WINDOWTEXT, COLOR_CAPTIONTEXT, COLOR_ACTIVEBORDER, COLOR_INACTIVEBORDER,
    COLOR_APPWORKSPACE, COLOR_HIGHLIGHT, COLOR_HIGHLIGHTTEXT,
    COLOR_BTNFACE, COLOR_BTNSHADOW, COLOR_GRAYTEXT, COLOR_BTNTEXT,
    COLOR_INACTIVECAPTIONTEXT, COLOR_BTNHIGHLIGHT,
    COLOR_3DDKSHADOW, COLOR_3DLIGHT, COLOR_INFOTEXT, COLOR_INFOBK,
    COLOR_HOTLIGHT, COLOR_GRADIENTACTIVECAPTION, COLOR_GRADIENTINACTIVECAPTION,
    SM_CXSCREEN, SM_CYSCREEN, SM_CXFULLSCREEN, SM_CYFULLSCREEN,
    SM_CYCAPTION, SM_CYMENU,
    CSIDL_DESKTOP, CSIDL_PERSONAL, CSIDL_APPDATA,
    CSIDL_WINDOWS, CSIDL_SYSTEM, CSIDL_PROGRAM_FILES,
    FO_MOVE, FO_COPY, FO_DELETE, FO_RENAME,
  };

  for (const [k, v] of Object.entries(_constants))
    window[k] = v;

  // ══════════════════════════════════════════════════════════════════
  // COLOR MAP — maps COLOR_* indices to CSS custom property names
  // ══════════════════════════════════════════════════════════════════

  const _COLOR_MAP = {
    [COLOR_SCROLLBAR]:          '--sz-color-scrollbar',
    [COLOR_BACKGROUND]:         '--sz-color-background',
    [COLOR_ACTIVECAPTION]:      '--sz-color-active-title',
    [COLOR_INACTIVECAPTION]:    '--sz-color-inactive-title',
    [COLOR_MENU]:               '--sz-color-menu',
    [COLOR_WINDOW]:             '--sz-color-window',
    [COLOR_WINDOWFRAME]:        '--sz-color-window-frame',
    [COLOR_MENUTEXT]:           '--sz-color-menu-text',
    [COLOR_WINDOWTEXT]:         '--sz-color-window-text',
    [COLOR_CAPTIONTEXT]:        '--sz-color-title-text',
    [COLOR_ACTIVEBORDER]:       '--sz-color-active-border',
    [COLOR_INACTIVEBORDER]:     '--sz-color-inactive-border',
    [COLOR_APPWORKSPACE]:       '--sz-color-app-workspace',
    [COLOR_HIGHLIGHT]:          '--sz-color-highlight',
    [COLOR_HIGHLIGHTTEXT]:      '--sz-color-highlight-text',
    [COLOR_BTNFACE]:            '--sz-color-button-face',
    [COLOR_BTNSHADOW]:          '--sz-color-button-shadow',
    [COLOR_GRAYTEXT]:           '--sz-color-gray-text',
    [COLOR_BTNTEXT]:            '--sz-color-button-text',
    [COLOR_INACTIVECAPTIONTEXT]: '--sz-color-inactive-title-text',
    [COLOR_BTNHIGHLIGHT]:       '--sz-color-button-highlight',
    [COLOR_3DDKSHADOW]:         '--sz-color-button-dark-shadow',
    [COLOR_3DLIGHT]:            '--sz-color-button-light',
    [COLOR_INFOTEXT]:           '--sz-color-info-text',
    [COLOR_INFOBK]:             '--sz-color-info-window',
    [COLOR_HOTLIGHT]:           '--sz-color-hot-tracking',
    [COLOR_GRADIENTACTIVECAPTION]:   '--sz-color-gradient-active-title',
    [COLOR_GRADIENTINACTIVECAPTION]: '--sz-color-gradient-inactive-title',
  };

  // ── CSIDL path map ─────────────────────────────────────────────
  const _CSIDL_MAP = {
    [CSIDL_DESKTOP]:       '/user/desktop',
    [CSIDL_PERSONAL]:      '/user/documents',
    [CSIDL_APPDATA]:       '/user/appdata',
    [CSIDL_WINDOWS]:       '/system',
    [CSIDL_SYSTEM]:        '/system',
    [CSIDL_PROGRAM_FILES]: '/apps',
  };

  // ══════════════════════════════════════════════════════════════════
  // DLL NAMESPACES
  // ══════════════════════════════════════════════════════════════════

  const Dlls = {};

  // ── SZ.Dlls.User32 ─────────────────────────────────────────────

  Dlls.User32 = {

    EnableVisualStyles() {
      _postToParent('sz:getTheme');
    },

    SetWindowText(title) {
      _postToParent('sz:setTitle', { title });
    },

    DestroyWindow() {
      _postToParent('sz:close');
    },

    MoveWindow(width, height) {
      _postToParent('sz:resize', { width, height });
    },

    PostMessage(type, data) {
      _postToParent(type, data);
    },

    SendMessage(type, data) {
      return _sendMessage(type, data || {});
    },

    MessageBox(text, caption, flags) {
      return _sendMessage('sz:messageBox', { text, caption, flags: flags || 0 }).then(r => r.result);
    },

    GetSystemMetrics(index) {
      return _sendMessage('sz:getSystemMetrics', { index }).then(r => {
        const m = r.metrics;
        switch (index) {
          case SM_CXSCREEN:     return m.screenWidth;
          case SM_CYSCREEN:     return m.screenHeight;
          case SM_CXFULLSCREEN: return m.workAreaWidth;
          case SM_CYFULLSCREEN: return m.workAreaHeight;
          case SM_CYCAPTION:    return m.captionHeight;
          case SM_CYMENU:       return m.taskbarHeight;
          default:              return m;
        }
      });
    },

    RegisterWindowProc(fn) {
      if (typeof fn === 'function')
        _windowProcs.push(fn);
    },

    UnregisterWindowProc(fn) {
      const idx = _windowProcs.indexOf(fn);
      if (idx >= 0)
        _windowProcs.splice(idx, 1);
    },

    GetActiveWindow() {
      return window;
    },
  };

  // ── SZ.Dlls.GDI32 ──────────────────────────────────────────────

  function _parseRgb(cssColor) {
    if (!cssColor)
      return [0, 0, 0];
    const m = cssColor.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m)
      return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    return [0, 0, 0];
  }

  Dlls.GDI32 = {

    GetSysColor(index) {
      const prop = _COLOR_MAP[index];
      if (!prop)
        return [0, 0, 0];
      const val = getComputedStyle(document.documentElement).getPropertyValue(prop);
      return _parseRgb(val);
    },

    GetSysColorBrush(index) {
      const prop = _COLOR_MAP[index];
      if (!prop)
        return 'rgb(0, 0, 0)';
      return getComputedStyle(document.documentElement).getPropertyValue(prop).trim() || 'rgb(0, 0, 0)';
    },

    GetSystemFont() {
      const style = getComputedStyle(document.documentElement);
      return {
        family: style.getPropertyValue('--sz-font-family').trim() || 'Tahoma, Verdana, sans-serif',
        size: style.getPropertyValue('--sz-font-size').trim() || '12px',
      };
    },
  };

  // ── SZ.Dlls.Kernel32 ───────────────────────────────────────────

  Dlls.Kernel32 = {

    IsInsideOS() {
      return _isInsideOS;
    },

    GetCommandLine() {
      const params = {};
      for (const [k, v] of new URLSearchParams(location.search))
        params[k] = v;
      return params;
    },

    CreateFile(path, mode) {
      return { path, mode: mode || 'r' };
    },

    ReadFile(path) {
      return _sendMessage('sz:vfs:read', { path }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return r.content;
      });
    },

    WriteFile(path, data) {
      return _sendMessage('sz:vfs:write', { path, data }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return { success: r.success };
      });
    },

    DeleteFile(path) {
      return _sendMessage('sz:vfs:delete', { path }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return { success: r.success };
      });
    },

    CreateDirectory(path) {
      return _sendMessage('sz:vfs:mkdir', { path }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return { success: r.success };
      });
    },

    MoveFile(src, dest) {
      return _sendMessage('sz:vfs:move', { src, dest }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return { success: r.success };
      });
    },

    CopyFile(src, dest) {
      return _sendMessage('sz:vfs:copy', { src, dest }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return { success: r.success };
      });
    },

    FindFirstFile(path) {
      return _sendMessage('sz:vfs:list', { path }).then(r => {
        if (r.error)
          throw new Error(r.error);
        return r.entries || [];
      });
    },

    GetFileAttributes(path) {
      return _sendMessage('sz:vfs:exists', { path }).then(r => ({
        exists: r.exists,
      }));
    },

    GetTempPath() {
      return '/tmp/';
    },

    Sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    GetTickCount() {
      return performance.now() | 0;
    },
  };

  // ── SZ.Dlls.Shell32 ────────────────────────────────────────────

  Dlls.Shell32 = {

    ShellExecute(appId, params) {
      _postToParent('sz:launchApp', { appId, urlParams: params });
    },

    SHGetFolderPath(csidl) {
      return _CSIDL_MAP[csidl] || '/';
    },

    SHFileOperation(op, src, dest) {
      switch (op) {
        case FO_MOVE:
          return Dlls.Kernel32.MoveFile(src, dest);
        case FO_COPY:
          return Dlls.Kernel32.CopyFile(src, dest);
        case FO_DELETE:
          return Dlls.Kernel32.DeleteFile(src);
        case FO_RENAME:
          return _sendMessage('sz:vfs:rename', { oldPath: src, newPath: dest }).then(r => {
            if (r.error)
              throw new Error(r.error);
            return { success: r.success };
          });
        default:
          return Promise.reject(new Error('Unknown operation: ' + op));
      }
    },
  };

  // ── SZ.Dlls.ComDlg32 ───────────────────────────────────────────

  Dlls.ComDlg32 = {

    GetOpenFileName(options) {
      return _sendMessage('sz:fileOpen', {
        filters: options?.filters,
        initialDir: options?.initialDir,
        multiSelect: options?.multiSelect,
        title: options?.title,
      });
    },

    GetSaveFileName(options) {
      return _sendMessage('sz:fileSave', {
        filters: options?.filters,
        initialDir: options?.initialDir,
        defaultName: options?.defaultName,
        title: options?.title,
        content: options?.content,
      });
    },
  };

  // ── SZ.Dlls.Advapi32 ───────────────────────────────────────────

  Dlls.Advapi32 = {

    RegQueryValue(key) {
      return _sendMessage('sz:regRead', { key }).then(r => r.value);
    },

    RegSetValue(key, value) {
      return _sendMessage('sz:regWrite', { key, value }).then(r => ({ success: r.success }));
    },
  };

  // ── WM constants namespace ──────────────────────────────────────

  Dlls.WM = Object.freeze({
    SIZE: WM_SIZE,
    ACTIVATE: WM_ACTIVATE,
    PAINT: WM_PAINT,
    CLOSE: WM_CLOSE,
    SETTINGCHANGE: WM_SETTINGCHANGE,
    FONTCHANGE: WM_FONTCHANGE,
    DISPLAYCHANGE: WM_DISPLAYCHANGE,
    THEMECHANGED: WM_THEMECHANGED,
    USER: WM_USER,
  });

  // ── Freeze all DLL namespaces ───────────────────────────────────
  for (const key of Object.keys(Dlls))
    Object.freeze(Dlls[key]);
  Object.freeze(Dlls);

  SZ.Dlls = Dlls;

})();
