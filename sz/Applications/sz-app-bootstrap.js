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

  function _sendMessage(type, payload, timeoutMs) {
    if (!_isInsideOS)
      return Promise.reject(new Error('Not inside OS'));
    if (timeoutMs === undefined)
      timeoutMs = 10000;
    return new Promise((resolve, reject) => {
      const requestId = 'dll-' + (++_reqId);
      let timer = null;
      if (timeoutMs > 0)
        timer = setTimeout(() => {
          _pending.delete(requestId);
          reject(new Error('Timeout: ' + type));
        }, timeoutMs);
      _pending.set(requestId, (data) => {
        if (timer) clearTimeout(timer);
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
      return _sendMessage('sz:messageBox', { text, caption, flags: flags || 0 }, 0).then(r => r.result);
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

  function _base64ToBytes(base64) {
    const compact = String(base64 || '').replace(/\s+/g, '');
    if (!compact)
      return new Uint8Array(0);
    const binary = atob(compact);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i)
      bytes[i] = binary.charCodeAt(i) & 0xff;
    return bytes;
  }

  function _isArrayBufferLike(value) {
    if (value == null)
      return false;
    return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]';
  }

  function _isTypedArrayLike(value) {
    if (value == null)
      return false;
    if (ArrayBuffer.isView(value))
      return true;
    const tag = Object.prototype.toString.call(value);
    return /\[object (?:Uint8|Uint8Clamped|Int8|Uint16|Int16|Uint32|Int32|Float32|Float64|BigInt64|BigUint64)Array\]/.test(tag);
  }

  function _bytesToBase64(bytes) {
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      let part = '';
      for (let j = 0; j < slice.length; ++j)
        part += String.fromCharCode(slice[j]);
      binary += part;
    }
    return btoa(binary);
  }

  function _toUint8Array(value) {
    if (value == null)
      return new Uint8Array(0);

    if (value instanceof Uint8Array)
      return new Uint8Array(value);

    if (_isArrayBufferLike(value))
      return new Uint8Array(value.slice(0));

    if (_isTypedArrayLike(value))
      return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));

    if (Array.isArray(value))
      return Uint8Array.from(value.map(v => (Number(v) || 0) & 0xff));

    if (typeof value === 'object' && Array.isArray(value.data))
      return Uint8Array.from(value.data.map(v => (Number(v) || 0) & 0xff));

    if (typeof value === 'string') {
      const str = value;
      const dataUrlMatch = str.match(/^data:([^,]*),(.*)$/i);
      if (dataUrlMatch) {
        const meta = dataUrlMatch[1] || '';
        const payload = dataUrlMatch[2] || '';
        if (/;\s*base64/i.test(meta))
          return _base64ToBytes(payload);
        try {
          const decoded = decodeURIComponent(payload);
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; ++i)
            bytes[i] = decoded.charCodeAt(i) & 0xff;
          return bytes;
        } catch (_) {
          const bytes = new Uint8Array(payload.length);
          for (let i = 0; i < payload.length; ++i)
            bytes[i] = payload.charCodeAt(i) & 0xff;
          return bytes;
        }
      }

      const trimmed = str.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const arr = JSON.parse(trimmed);
          if (Array.isArray(arr))
            return Uint8Array.from(arr.map(v => (Number(v) || 0) & 0xff));
        } catch (_) {}
      }

      const rawBytes = (() => {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i)
          bytes[i] = str.charCodeAt(i) & 0xff;
        return bytes;
      })();

      const score = (bytes) => {
        if (!bytes || bytes.length < 2)
          return 0;
        if (bytes.length >= 6 && bytes[0] === 0x00 && bytes[1] === 0x00 && (bytes[2] === 0x01 || bytes[2] === 0x02) && bytes[3] === 0x00)
          return 100;
        if (bytes[0] === 0x4D && bytes[1] === 0x5A)
          return 90;
        if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)
          return 80;
        if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)
          return 70;
        if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61)
          return 70;
        if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D)
          return 70;
        if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08))
          return 60;
        return 0;
      };

      const base64ish = /^[A-Za-z0-9+/=\r\n\s]+$/.test(trimmed) && (trimmed.length % 4 === 0 || trimmed.replace(/\s+/g, '').length % 4 === 0);
      if (base64ish) {
        let b64Bytes = null;
        try { b64Bytes = _base64ToBytes(trimmed); } catch (_) {}
        if (b64Bytes) {
          const b64Score = score(b64Bytes);
          const rawScore = score(rawBytes);
          if (b64Score > rawScore)
            return b64Bytes;
          if (rawScore > b64Score)
            return rawBytes;
          // Equal confidence: prefer base64 for base64-ish payloads.
          return b64Bytes;
        }
      }

      return rawBytes;
    }

    return new Uint8Array(0);
  }

  function _decodeToText(value) {
    if (value == null)
      return '';

    if (typeof value === 'string') {
      const dataUrlMatch = value.match(/^data:([^,]*),(.*)$/i);
      if (dataUrlMatch) {
        const meta = dataUrlMatch[1] || '';
        const payload = dataUrlMatch[2] || '';
        if (/;\s*base64/i.test(meta)) {
          try {
            const bytes = _base64ToBytes(payload);
            return new TextDecoder('utf-8').decode(bytes);
          } catch (_) {
            return '';
          }
        }
        try {
          return decodeURIComponent(payload);
        } catch (_) {
          return payload;
        }
      }

      // Legacy wrapper format from older Explorer uploads.
      if (value.startsWith('{') && value.includes('"type"') && value.includes('"data"')) {
        try {
          const obj = JSON.parse(value);
          if (obj && obj.type === 'text' && typeof obj.data === 'string')
            return obj.data;
          if (obj && obj.type === 'base64' && typeof obj.data === 'string') {
            const bytes = _base64ToBytes(obj.data);
            return new TextDecoder('utf-8').decode(bytes);
          }
        } catch (_) {}
      }

      return value;
    }

    return new TextDecoder('utf-8').decode(_toUint8Array(value));
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
      return _sendMessage('sz:vfs:ReadAllText', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return r.text ?? '';
      });
    },

    ReadAllText(path) {
      return this.ReadFile(path);
    },

    ReadAllBytes(path) {
      return _sendMessage('sz:vfs:ReadAllBytes', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return _toUint8Array(r.bytes);
      });
    },

    ReadUri(path) {
      return _sendMessage('sz:vfs:ReadUri', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return r.uri;
      });
    },

    ReadValue(path) {
      return _sendMessage('sz:vfs:ReadValue', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return r.value;
      });
    },

    WriteFile(path, data) {
      // String → store as bytes (UTF-8 encoded)
      if (typeof data === 'string') {
        const bytes = Array.from(new TextEncoder().encode(data));
        return _sendMessage('sz:vfs:WriteAllBytes', { path, bytes }).then(r => {
          if (r.error)
            throw new Error(r.error.message || r.error);
          return { success: true };
        });
      }

      // JSON-serializable object → store as value node
      if (data != null && typeof data === 'object' && !_isTypedArrayLike(data) && !_isArrayBufferLike(data) && !Array.isArray(data))
        return _sendMessage('sz:vfs:WriteValue', { path, value: data }).then(r => {
          if (r.error)
            throw new Error(r.error.message || r.error);
          return { success: true };
        });

      // Binary / array → store as bytes
      const bytes = Array.from(_toUint8Array(data));
      return _sendMessage('sz:vfs:WriteAllBytes', { path, bytes }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    WriteAllBytes(path, bytes) {
      const payload = Array.from(_toUint8Array(bytes));
      return _sendMessage('sz:vfs:WriteAllBytes', { path, bytes: payload }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    WriteValue(path, value) {
      return _sendMessage('sz:vfs:WriteValue', { path, value }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    WriteUri(path, uri) {
      return _sendMessage('sz:vfs:WriteUri', { path, uri }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    DeleteFile(path) {
      return _sendMessage('sz:vfs:Delete', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    CreateDirectory(path) {
      return _sendMessage('sz:vfs:Mkdir', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    MoveFile(src, dest) {
      return _sendMessage('sz:vfs:Move', { from: src, to: dest }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    CopyFile(src, dest) {
      return _sendMessage('sz:vfs:Copy', { from: src, to: dest }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return { success: true };
      });
    },

    FindFirstFile(path) {
      return _sendMessage('sz:vfs:List', { path }).then(r => {
        if (r.error)
          throw new Error(r.error.message || r.error);
        return r.entries || [];
      });
    },

    GetFileAttributes(path) {
      return _sendMessage('sz:vfs:Stat', { path }).then(r => {
        if (r.error)
          return { exists: false };
        return {
          exists: true,
          kind: r.stat?.kind,
          size: r.stat?.size,
          mtime: r.stat?.mtime,
        };
      });
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
          return Dlls.Kernel32.MoveFile(src, dest);
        default:
          return Promise.reject(new Error('Unknown operation: ' + op));
      }
    },

    SHGetFileTypeAssociations() {
      return _sendMessage('sz:getFileTypeAssociations', {}).then(r => r.associations || {});
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
      }, 0);
    },

    GetSaveFileName(options) {
      return _sendMessage('sz:fileSave', {
        filters: options?.filters,
        initialDir: options?.initialDir,
        defaultName: options?.defaultName,
        title: options?.title,
        content: options?.content,
      }, 0);
    },

    ImportFile(options) {
      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        if (options?.accept) input.accept = options.accept;
        input.style.display = 'none';
        document.body.appendChild(input);
        const cleanup = () => document.body.removeChild(input);
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) { cleanup(); resolve({ cancelled: true }); return; }
          const reader = new FileReader();
          reader.onload = () => { cleanup(); resolve({ cancelled: false, data: reader.result, name: file.name, size: file.size }); };
          reader.onerror = () => { cleanup(); resolve({ cancelled: true }); };
          const readAs = options?.readAs || 'arrayBuffer';
          if (readAs === 'text') reader.readAsText(file);
          else if (readAs === 'dataURL') reader.readAsDataURL(file);
          else reader.readAsArrayBuffer(file);
        });
        input.click();
      });
    },

    ExportFile(data, filename, mimeType) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
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
