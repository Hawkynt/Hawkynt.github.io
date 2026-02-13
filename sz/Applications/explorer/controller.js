;(function() {
  'use strict';

  const { User32, Kernel32, Shell32 } = SZ.Dlls;

  // =========================================================================
  // SVG icons for object-browser types (16x16 viewBox)
  // =========================================================================
  const ICONS = {
    root:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="10" rx="1" fill="#6baed6" stroke="#2171b5" stroke-width=".8"/><rect x="2" y="2" width="12" height="8" fill="#deebf7"/><rect x="5" y="12" width="6" height="1" fill="#999"/><rect x="4" y="13" width="8" height="1.5" rx=".5" fill="#bbb"/></svg>',
    object:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#f5d66b" stroke="#c5a028" stroke-width=".5"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#e8c44a" stroke="#c5a028" stroke-width=".5"/></svg>',
    objectOpen: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#f5d66b" stroke="#c5a028" stroke-width=".5"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#e8c44a" stroke="#c5a028" stroke-width=".5"/><path d="M2 6H14L13 14H1Z" fill="#fde68a" stroke="#c5a028" stroke-width=".3"/></svg>',
    array:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="1" width="12" height="14" rx="1" fill="#dbeafe" stroke="#3b82f6" stroke-width=".6"/><rect x="4" y="4" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/><rect x="4" y="7" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/><rect x="4" y="10" width="8" height="1.5" rx=".5" fill="#3b82f6" opacity=".5"/></svg>',
    map:        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="14" height="12" rx="1" fill="#fef3c7" stroke="#d97706" stroke-width=".6"/><line x1="8" y1="2" x2="8" y2="14" stroke="#d97706" stroke-width=".4"/><line x1="1" y1="8" x2="15" y2="8" stroke="#d97706" stroke-width=".4"/></svg>',
    set:        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="8" r="5" fill="none" stroke="#7c3aed" stroke-width=".7"/><circle cx="10" cy="8" r="5" fill="none" stroke="#7c3aed" stroke-width=".7"/></svg>',
    class:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#c084fc" stroke="#7c3aed" stroke-width=".6"/><rect x="3" y="3" width="10" height="3" rx=".5" fill="#7c3aed" opacity=".3"/><rect x="3" y="7" width="7" height="1" fill="#7c3aed" opacity=".4"/><rect x="3" y="9.5" width="9" height="1" fill="#7c3aed" opacity=".4"/><rect x="3" y="12" width="5" height="1" fill="#7c3aed" opacity=".4"/></svg>',
    function:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#86efac" stroke="#16a34a" stroke-width=".6"/><path d="M6 4Q6 3 7.5 3Q9 3 9 4.5V7H6.5M9 7H11M9 7V11Q9 13 7.5 13Q6 13 6 12" fill="none" stroke="#166534" stroke-width="1.2" stroke-linecap="round"/></svg>',
    instance:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L15 5V11L8 15L1 11V5Z" fill="#93c5fd" stroke="#2563eb" stroke-width=".6"/><circle cx="8" cy="8" r="2" fill="#2563eb"/></svg>',
    string:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fed7aa" stroke="#ea580c" stroke-width=".6"/><path d="M5 4V6Q5 7 6 7M5 5Q5 4 6 4M9 4V6Q9 7 10 7M9 5Q9 4 10 4" stroke="#c2410c" stroke-width="1" fill="none" stroke-linecap="round"/></svg>',
    number:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#bfdbfe" stroke="#2563eb" stroke-width=".6"/><path d="M5 4L7 12M9 4L11 12M4 7H12M4 9.5H12" stroke="#1d4ed8" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>',
    boolean:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#bbf7d0" stroke="#16a34a" stroke-width=".6"/><path d="M4 8L7 11L12 5" fill="none" stroke="#166534" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    null:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".6"/><line x1="4" y1="4" x2="12" y2="12" stroke="#94a3b8" stroke-width=".8"/></svg>',
    undefined:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width=".6" stroke-dasharray="2 2"/></svg>',
    symbol:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fecdd3" stroke="#e11d48" stroke-width=".6"/><circle cx="8" cy="7" r="3" fill="none" stroke="#be123c" stroke-width="1"/><line x1="8" y1="10" x2="8" y2="13" stroke="#be123c" stroke-width="1"/></svg>',
    bigint:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#c7d2fe" stroke="#4f46e5" stroke-width=".6"/><path d="M5 4L7 12M9 4L11 12M4 7H12M4 9.5H12" stroke="#4338ca" stroke-width=".8" fill="none" stroke-linecap="round"/></svg>',
    regexp:     '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#fecdd3" stroke="#dc2626" stroke-width=".6"/><path d="M4 12L7 4M9 4L12 12" stroke="#dc2626" stroke-width=".8" fill="none" stroke-linecap="round"/><circle cx="8" cy="9" r="1.5" fill="#dc2626"/></svg>',
    date:       '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="12" rx="1" fill="#fff" stroke="#4b5563" stroke-width=".6"/><rect x="1" y="3" width="14" height="3.5" rx="1" fill="#ef4444"/><circle cx="4.5" cy="9" r=".8" fill="#4b5563"/><circle cx="8" cy="9" r=".8" fill="#4b5563"/><circle cx="11.5" cy="9" r=".8" fill="#4b5563"/><circle cx="4.5" cy="12" r=".8" fill="#4b5563"/><circle cx="8" cy="12" r=".8" fill="#4b5563"/></svg>',
    element:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#e0f2fe" stroke="#0284c7" stroke-width=".6"/><path d="M5 5L2 8L5 11M11 5L14 8L11 11" fill="none" stroke="#0369a1" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error:      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#fca5a5" stroke="#dc2626" stroke-width=".6"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="#dc2626" stroke-width="1.2"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="#dc2626" stroke-width="1.2"/></svg>',
    unknown:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width=".6"/><circle cx="8" cy="7.5" r="3" fill="none" stroke="#64748b" stroke-width="1"/><line x1="8" y1="10.5" x2="8" y2="10.6" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/></svg>',
    // VFS-specific icons
    vfsFolder:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/></svg>',
    vfsFolderOpen: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><path d="M2 6H14L13 14H1Z" fill="#fde68a" stroke="#b45309" stroke-width=".3"/></svg>',
    vfsFile:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 1H10L13 4V14Q13 15 12 15H4Q3 15 3 14Z" fill="#fff" stroke="#6b7280" stroke-width=".6"/><path d="M10 1V4H13" fill="#e5e7eb" stroke="#6b7280" stroke-width=".4"/><line x1="5" y1="7" x2="11" y2="7" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="9" x2="11" y2="9" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="11" x2="9" y2="11" stroke="#9ca3af" stroke-width=".6"/></svg>',
    vfsDrive:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="9" rx="1" fill="#e5e7eb" stroke="#4b5563" stroke-width=".6"/><rect x="3" y="6" width="5" height="3" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".4"/><circle cx="12" cy="10" r="1" fill="#22c55e"/></svg>',
  };

  const CONTAINER_TYPES = new Set(['object', 'array', 'map', 'set', 'instance', 'class', 'element']);

  function iconFor(type) { return ICONS[type] || ICONS.unknown; }
  function iconForVfs(entry) { return entry.type === 'dir' ? ICONS.vfsFolder : ICONS.vfsFile; }

  function treeIcon(type, open) {
    if (type === 'root') return ICONS.root;
    if (type === 'vfsDrive') return ICONS.vfsDrive;
    if (type === 'vfsFolder') return open ? ICONS.vfsFolderOpen : ICONS.vfsFolder;
    if (type === 'array') return ICONS.array;
    if (type === 'map') return ICONS.map;
    if (type === 'set') return ICONS.set;
    if (type === 'class') return ICONS.class;
    if (type === 'instance') return ICONS.instance;
    if (type === 'element') return ICONS.element;
    return open ? ICONS.objectOpen : ICONS.object;
  }

  // =========================================================================
  // State
  // =========================================================================
  let currentPath = '/';
  const backStack = [];
  const forwardStack = [];
  let selectedItems = [];
  let lastClickedIndex = -1;
  let clipboard = null;
  let currentEntries = [];
  let isVfsMode = false;
  let activeRename = null;
  let viewMode = 'icons';
  let searchFilter = '';

  // DOM references
  const sidebar = document.getElementById('sidebar');
  const mainView = document.getElementById('main-view');
  const breadcrumbContainer = document.getElementById('breadcrumb-container');
  const breadcrumbEl = document.getElementById('breadcrumb');
  const addressInput = document.getElementById('address-input');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnUp = document.getElementById('btn-up');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnNewFolder = document.getElementById('btn-newfolder');
  const btnDelete = document.getElementById('btn-delete');
  const btnRename = document.getElementById('btn-rename');
  const btnCopy = document.getElementById('btn-copy');
  const btnCut = document.getElementById('btn-cut');
  const btnPaste = document.getElementById('btn-paste');
  const btnView = document.getElementById('btn-view');
  const btnUpload = document.getElementById('btn-upload');
  const btnDownload = document.getElementById('btn-download');
  const uploadInput = document.getElementById('upload-input');
  const btnOverflow = document.getElementById('btn-overflow');
  const overflowMenu = document.getElementById('overflow-menu');
  const statusCount = document.getElementById('status-count');
  const statusInfo = document.getElementById('status-info');

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

  async function vfsDelete(path) {
    try {
      await Kernel32.DeleteFile(path);
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

  async function vfsRename(oldPath, newPath) {
    try {
      await Shell32.SHFileOperation(FO_RENAME, oldPath, newPath);
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

  async function vfsRead(path) {
    try {
      const content = await Kernel32.ReadAllBytes(path);
      return { data: content };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function vfsWrite(path, data) {
    try {
      const tag = data != null && typeof data === 'object'
        ? Object.prototype.toString.call(data)
        : '';
      const isBinary = tag === '[object ArrayBuffer]' || ArrayBuffer.isView(data);
      if (isBinary)
        await Kernel32.WriteAllBytes(path, data);
      else
        await Kernel32.WriteFile(path, data);
      return {};
    } catch (e) {
      return { error: e.message };
    }
  }

  function browse(path) {
    return User32.SendMessage('sz:browse', { path });
  }

  // =========================================================================
  // Path helpers
  // =========================================================================
  function formatPath(path) {
    if (path === '/') return 'SZ:\\';
    return 'SZ:\\' + path.slice(1).replace(/\//g, '\\');
  }

  function parsePath(input) {
    let path = input.trim().replace(/\\/g, '/');
    path = path.replace(/^SZ:\/?/i, '/');
    if (!path.startsWith('/')) path = '/' + path;
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  }

  function parentPath(path) {
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.length > 0 ? '/' + parts.join('/') : '/';
  }

  function childPath(base, name) {
    return base === '/' ? '/' + name : base + '/' + name;
  }

  function baseName(path) {
    if (path === '/') return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  function isVfsPath(path) {
    return path === '/vfs' || path.startsWith('/vfs/');
  }

  function toVfsRelative(path) {
    if (path === '/vfs') return '/';
    return path.slice(4);
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // =========================================================================
  // Navigation
  // =========================================================================
  async function navigate(path, skipHistory) {
    if (path === currentPath && !skipHistory)
      return;
    if (!skipHistory) {
      backStack.push(currentPath);
      forwardStack.length = 0;
    }
    currentPath = path;
    isVfsMode = isVfsPath(path);
    clearSelection();
    searchFilter = '';
    const _si = document.getElementById('search-input');
    const _sc = document.getElementById('search-clear');
    if (_si) _si.value = '';
    if (_sc) _sc.classList.remove('visible');
    await render();
  }

  async function goBack() {
    if (backStack.length === 0)
      return;
    forwardStack.push(currentPath);
    currentPath = backStack.pop();
    isVfsMode = isVfsPath(currentPath);
    clearSelection();
    await render();
  }

  async function goForward() {
    if (forwardStack.length === 0)
      return;
    backStack.push(currentPath);
    currentPath = forwardStack.pop();
    isVfsMode = isVfsPath(currentPath);
    clearSelection();
    await render();
  }

  async function render() {
    updateBreadcrumb();
    updateToolbarState();

    let result;
    if (isVfsMode) {
      const vfsPath = toVfsRelative(currentPath);
      result = await vfsList(vfsPath);
      if (result.error) {
        renderError(result.error);
        return;
      }
      currentEntries = (result.entries || []).map(e => ({
        name: e.name,
        type: e.type === 'dir' ? 'dir' : 'file',
        isContainer: e.type === 'dir',
        size: e.size || 0,
        preview: e.type === 'dir' ? 'Folder' : formatSize(e.size || 0),
        entryType: e.type === 'dir' ? 'vfsFolder' : 'vfsFile',
      }));
      renderVfsView();
    } else {
      result = await browse(currentPath);
      if (result.error) {
        renderError(result.error || result.preview || 'Unknown error');
        return;
      }
      currentEntries = result.entries || [];
      renderObjectView(result);
    }

    highlightSidebar(currentPath);
    updateToolbarState();
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // =========================================================================
  // Breadcrumb path bar
  // =========================================================================
  function updateBreadcrumb() {
    breadcrumbEl.innerHTML = '';
    const parts = currentPath === '/' ? [''] : currentPath.split('/');

    for (let i = 0; i < parts.length; ++i) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '\u25B8';
        breadcrumbEl.appendChild(sep);
      }

      const crumb = document.createElement('span');
      crumb.className = 'crumb';
      crumb.textContent = i === 0 ? 'SZ:\\' : parts[i];
      const targetPath = i === 0 ? '/' : '/' + parts.slice(1, i + 1).join('/');
      crumb.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(targetPath);
      });
      breadcrumbEl.appendChild(crumb);
    }
  }

  function enterEditMode() {
    breadcrumbContainer.classList.add('editing');
    addressInput.value = formatPath(currentPath);
    addressInput.style.display = 'block';
    addressInput.focus();
    addressInput.select();
  }

  function exitEditMode(doNavigate) {
    breadcrumbContainer.classList.remove('editing');
    addressInput.style.display = '';
    if (doNavigate) {
      const newPath = parsePath(addressInput.value);
      if (newPath !== currentPath)
        navigate(newPath);
    }
  }

  breadcrumbContainer.addEventListener('click', (e) => {
    if (e.target === breadcrumbContainer || e.target === breadcrumbEl)
      enterEditMode();
  });

  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (acActiveIndex < 0) {
        e.preventDefault();
        hideAutocomplete();
        exitEditMode(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (autocompleteDropdown.classList.contains('visible'))
        hideAutocomplete();
      else
        exitEditMode(false);
    }
  });

  addressInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.activeElement !== addressInput) {
        hideAutocomplete();
        exitEditMode(false);
      }
    }, 150);
  });

  // =========================================================================
  // Address bar autocomplete
  // =========================================================================
  const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
  let acItems = [];
  let acActiveIndex = -1;
  let acDebounce = null;

  addressInput.addEventListener('input', () => {
    clearTimeout(acDebounce);
    acDebounce = setTimeout(() => updateAutocomplete(), 150);
  });

  addressInput.addEventListener('keydown', (e) => {
    if (!autocompleteDropdown.classList.contains('visible'))
      return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acActiveIndex = Math.min(acActiveIndex + 1, acItems.length - 1);
      highlightAcItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acActiveIndex = Math.max(acActiveIndex - 1, -1);
      highlightAcItem();
    } else if ((e.key === 'Tab' || e.key === 'Enter') && acActiveIndex >= 0) {
      e.preventDefault();
      selectAcItem(acActiveIndex);
    }
  });

  async function updateAutocomplete() {
    const raw = addressInput.value.trim();
    if (!raw) {
      hideAutocomplete();
      return;
    }
    const fullPath = parsePath(raw);
    const dir = parentPath(fullPath);
    const prefix = baseName(fullPath).toLowerCase();

    try {
      let entries = [];
      if (isVfsPath(dir)) {
        const result = await vfsList(toVfsRelative(dir));
        entries = (result.entries || []).filter(e => e.type === 'dir').map(e => e.name);
      } else {
        const result = await browse(dir);
        entries = (result.entries || []).filter(e => e.isContainer).map(e => e.name);
      }

      const matches = prefix
        ? entries.filter(n => n.toLowerCase().startsWith(prefix))
        : entries;

      if (matches.length === 0) {
        hideAutocomplete();
        return;
      }

      acItems = matches.map(name => childPath(dir, name));
      acActiveIndex = -1;
      autocompleteDropdown.innerHTML = '';

      for (let i = 0; i < Math.min(acItems.length, 20); ++i) {
        const el = document.createElement('div');
        el.className = 'autocomplete-item';
        el.textContent = formatPath(acItems[i]);
        el.dataset.index = String(i);
        el.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          selectAcItem(i);
        });
        autocompleteDropdown.appendChild(el);
      }
      autocompleteDropdown.classList.add('visible');
    } catch (err) {
      hideAutocomplete();
    }
  }

  function hideAutocomplete() {
    autocompleteDropdown.classList.remove('visible');
    autocompleteDropdown.innerHTML = '';
    acItems = [];
    acActiveIndex = -1;
  }

  function highlightAcItem() {
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    for (let i = 0; i < items.length; ++i)
      items[i].classList.toggle('active', i === acActiveIndex);
    if (acActiveIndex >= 0 && items[acActiveIndex])
      items[acActiveIndex].scrollIntoView({ block: 'nearest' });
  }

  function selectAcItem(index) {
    if (index < 0 || index >= acItems.length) return;
    const path = acItems[index];
    addressInput.value = formatPath(path);
    hideAutocomplete();
    exitEditMode(false);
    navigate(path);
  }

  // =========================================================================
  // Search box (recursive in VFS mode, flat filter otherwise)
  // =========================================================================
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  let searchDebounce = null;
  let isSearchResultsView = false;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchFilter = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', searchFilter.length > 0);
    if (!searchFilter) {
      if (isSearchResultsView) {
        isSearchResultsView = false;
        render();
      } else
        applySearchFilterFlat();
      return;
    }
    searchDebounce = setTimeout(() => {
      if (isVfsMode)
        performRecursiveSearch(searchFilter);
      else
        applySearchFilterFlat();
    }, 300);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchFilter = '';
    searchClear.classList.remove('visible');
    if (isSearchResultsView) {
      isSearchResultsView = false;
      render();
    } else
      applySearchFilterFlat();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchFilter = '';
      searchClear.classList.remove('visible');
      if (isSearchResultsView) {
        isSearchResultsView = false;
        render();
      } else
        applySearchFilterFlat();
      searchInput.blur();
    }
  });

  function applySearchFilterFlat() {
    const grid = mainView.querySelector('.file-list');
    if (!grid) return;
    const items = grid.querySelectorAll('.file-item');
    let visibleCount = 0;
    for (const item of items) {
      const name = (item.dataset.name || '').toLowerCase();
      const show = !searchFilter || name.includes(searchFilter);
      item.style.display = show ? '' : 'none';
      if (show) ++visibleCount;
    }
    statusCount.textContent = searchFilter
      ? visibleCount + ' of ' + items.length + ' item(s) shown'
      : statusCount.textContent;
  }

  async function vfsSearchRecursive(basePath, query, results, maxResults) {
    if (results.length >= maxResults) return;
    const resp = await vfsList(basePath);
    const entries = resp.entries || [];
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      const entryPath = basePath === '/' ? '/' + entry.name : basePath + '/' + entry.name;
      if (entry.name.toLowerCase().includes(query))
        results.push({ name: entry.name, vfsPath: entryPath, type: entry.type, size: entry.size || 0 });
      if (entry.type === 'dir')
        await vfsSearchRecursive(entryPath, query, results, maxResults);
    }
  }

  async function performRecursiveSearch(query) {
    if (!isVfsMode || !query) return;
    const vfsBase = toVfsRelative(currentPath);
    statusInfo.textContent = 'Searching...';
    const results = [];
    try {
      await vfsSearchRecursive(vfsBase, query, results, 200);
    } catch (err) {
      // ignore search errors, show partial results
    }
    if (searchFilter !== query) return;

    isSearchResultsView = true;
    mainView.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'file-list';

    currentEntries = results.map(r => ({
      name: r.name,
      type: r.type === 'dir' ? 'dir' : 'file',
      isContainer: r.type === 'dir',
      size: r.size,
      preview: r.type === 'dir' ? 'Folder' : formatSize(r.size),
      entryType: r.type === 'dir' ? 'vfsFolder' : 'vfsFile',
      _vfsPath: r.vfsPath,
      _relPath: r.vfsPath,
    }));

    for (let i = 0; i < currentEntries.length; ++i) {
      const entry = currentEntries[i];
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.name = entry.name;
      item.dataset.index = String(i);
      item.title = entry._relPath + '\n' + entry.preview;

      const iconEl = document.createElement('span');
      iconEl.className = 'item-icon';
      iconEl.innerHTML = iconForVfs(entry);
      item.appendChild(iconEl);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = entry.name;
      item.appendChild(nameSpan);

      const relSpan = document.createElement('span');
      relSpan.className = 'item-relpath';
      relSpan.textContent = entry._relPath;
      item.appendChild(relSpan);

      const typeSpan = document.createElement('span');
      typeSpan.className = 'item-type';
      typeSpan.textContent = entry.preview || '';
      item.appendChild(typeSpan);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectItem(i, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
      });

      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const fullVfsPath = '/vfs' + (entry._vfsPath.startsWith('/') ? '' : '/') + entry._vfsPath;
        if (entry.isContainer || entry.type === 'dir')
          navigate(fullVfsPath);
        else
          openFile(fullVfsPath, entry.name);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedItems.find(s => s.name === entry.name))
          selectItem(i, item, entry, { ctrl: false, shift: false });
        showItemContextMenu(e.clientX, e.clientY);
      });

      grid.appendChild(item);
    }

    grid.addEventListener('click', (e) => {
      if (e.target === grid) clearSelection();
    });

    mainView.appendChild(grid);
    statusCount.textContent = results.length + ' result(s)';
    statusInfo.textContent = 'Search results for "' + query + '"' + (results.length >= 200 ? ' (limited to 200)' : '');
  }

  // =========================================================================
  // Selection management
  // =========================================================================
  function clearSelection() {
    for (const sel of selectedItems)
      if (sel.entryEl)
        sel.entryEl.classList.remove('selected');
    selectedItems = [];
    lastClickedIndex = -1;
    updateToolbarState();
  }

  function selectItem(index, entryEl, entry, modifiers) {
    const item = {
      name: entry.name,
      path: childPath(currentPath, entry.name),
      isDir: entry.isContainer || entry.type === 'dir',
      entryEl,
      index,
    };

    if (modifiers.ctrl) {
      const existingIdx = selectedItems.findIndex(s => s.name === entry.name);
      if (existingIdx >= 0) {
        selectedItems[existingIdx].entryEl.classList.remove('selected');
        selectedItems.splice(existingIdx, 1);
      } else {
        entryEl.classList.add('selected');
        selectedItems.push(item);
      }
      lastClickedIndex = index;
    } else if (modifiers.shift && lastClickedIndex >= 0) {
      clearSelection();
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const grid = mainView.querySelector('.file-list');
      if (grid) {
        const items = grid.querySelectorAll('.file-item');
        for (let i = start; i <= end; ++i) {
          if (i < items.length && i < currentEntries.length) {
            items[i].classList.add('selected');
            selectedItems.push({
              name: currentEntries[i].name,
              path: childPath(currentPath, currentEntries[i].name),
              isDir: currentEntries[i].isContainer || currentEntries[i].type === 'dir',
              entryEl: items[i],
              index: i,
            });
          }
        }
      }
    } else {
      clearSelection();
      entryEl.classList.add('selected');
      selectedItems.push(item);
      lastClickedIndex = index;
    }

    updateToolbarState();
    updateStatusForSelection();
  }

  function selectAll() {
    clearSelection();
    const grid = mainView.querySelector('.file-list');
    if (!grid) return;
    const items = grid.querySelectorAll('.file-item');
    for (let i = 0; i < items.length && i < currentEntries.length; ++i) {
      items[i].classList.add('selected');
      selectedItems.push({
        name: currentEntries[i].name,
        path: childPath(currentPath, currentEntries[i].name),
        isDir: currentEntries[i].isContainer || currentEntries[i].type === 'dir',
        entryEl: items[i],
        index: i,
      });
    }
    updateToolbarState();
    updateStatusForSelection();
  }

  function updateStatusForSelection() {
    if (selectedItems.length === 0) return;
    if (selectedItems.length === 1) {
      const sel = selectedItems[0];
      const entry = currentEntries.find(e => e.name === sel.name);
      if (entry)
        statusInfo.textContent = entry.preview || '';
    } else
      statusInfo.textContent = selectedItems.length + ' items selected';
  }

  // =========================================================================
  // Toolbar state management
  // =========================================================================
  function updateToolbarState() {
    btnBack.disabled = backStack.length === 0;
    btnForward.disabled = forwardStack.length === 0;
    btnUp.disabled = currentPath === '/';

    const hasSelection = selectedItems.length > 0;
    const canModify = isVfsMode;

    btnNewFolder.disabled = !canModify;
    btnDelete.disabled = !canModify || !hasSelection;
    btnRename.disabled = !canModify || selectedItems.length !== 1;
    btnCopy.disabled = !hasSelection;
    btnCut.disabled = !canModify || !hasSelection;
    btnPaste.disabled = !clipboard || !canModify;
    btnUpload.disabled = !canModify;
    btnDownload.disabled = !canModify || !hasSelection || selectedItems.some(s => s.isDir);
  }

  // =========================================================================
  // Rendering: VFS file list
  // =========================================================================
  function renderVfsView() {
    mainView.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'file-list';

    for (let i = 0; i < currentEntries.length; ++i) {
      const entry = currentEntries[i];
      const item = createFileItem(entry, i);
      grid.appendChild(item);
    }

    grid.addEventListener('click', (e) => {
      if (e.target === grid)
        clearSelection();
    });

    grid.addEventListener('contextmenu', (e) => {
      if (e.target === grid) {
        e.preventDefault();
        clearSelection();
        showBackgroundContextMenu(e.clientX, e.clientY);
      }
    });

    mainView.appendChild(grid);

    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;
    for (const entry of currentEntries) {
      if (entry.type === 'dir')
        ++folderCount;
      else {
        ++fileCount;
        totalSize += entry.size || 0;
      }
    }

    const parts = [];
    if (folderCount > 0) parts.push(folderCount + ' folder(s)');
    if (fileCount > 0) parts.push(fileCount + ' file(s)');
    statusCount.textContent = parts.join(', ') || '0 items';
    statusInfo.textContent = totalSize > 0 ? 'Total: ' + formatSize(totalSize) : 'VFS: ' + toVfsRelative(currentPath);
  }

  function createFileItem(entry, index) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.name = entry.name;
    item.dataset.index = String(index);
    item.title = entry.name + '\n' + entry.preview;

    if (clipboard && clipboard.mode === 'cut')
      for (const ci of clipboard.items)
        if (ci.path === childPath(currentPath, entry.name))
          item.classList.add('cut-pending');

    const iconEl = document.createElement('span');
    iconEl.className = 'item-icon';
    iconEl.innerHTML = isVfsMode ? iconForVfs(entry) : iconFor(entry.entryType || entry.type);
    item.appendChild(iconEl);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = entry.name;
    item.appendChild(nameSpan);

    const typeSpan = document.createElement('span');
    typeSpan.className = 'item-type';
    typeSpan.textContent = entry.preview || '';
    item.appendChild(typeSpan);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(index, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (entry.isContainer || entry.type === 'dir')
        navigate(childPath(currentPath, entry.name));
      else if (isVfsMode)
        openFile(childPath(currentPath, entry.name), entry.name);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedItems.find(s => s.name === entry.name))
        selectItem(index, item, entry, { ctrl: false, shift: false });
      showItemContextMenu(e.clientX, e.clientY);
    });

    return item;
  }

  function getFileExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot).toLowerCase() : '';
  }

  // Use sz:shellExecute to let the desktop handle file associations
  function openFile(path, name) {
    const vfsPath = toVfsRelative(path);
    const ext = getFileExtension(name);
    User32.PostMessage('sz:shellExecute', { path: vfsPath, extension: ext });
  }

  // =========================================================================
  // Rendering: Object browser view (non-VFS)
  // =========================================================================
  function renderObjectView(result) {
    mainView.innerHTML = '';
    const entries = result.entries || [];

    if (entries.length === 0 && !CONTAINER_TYPES.has(result.nodeType)) {
      const detail = document.createElement('div');
      detail.className = 'leaf-detail';
      detail.innerHTML = '<div class="leaf-icon">' + iconFor(result.nodeType) + '</div>'
        + '<div class="leaf-type">' + escapeHtml(result.nodeType || 'unknown') + '</div>'
        + '<div class="leaf-value">' + escapeHtml(result.preview || '') + '</div>';
      mainView.appendChild(detail);
      statusCount.textContent = result.nodeType;
      statusInfo.textContent = result.preview || '';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'file-list';

    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i];
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.name = entry.name;
      item.dataset.index = String(i);
      item.title = entry.name + ' (' + entry.type + ')\n' + entry.preview;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectItem(i, item, entry, { ctrl: e.ctrlKey, shift: e.shiftKey });
        statusInfo.textContent = entry.type + ': ' + entry.preview;
      });

      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (entry.isContainer)
          navigate(childPath(currentPath, entry.name));
        else
          showDetailPanel(entry);
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedItems.find(s => s.name === entry.name))
          selectItem(i, item, entry, { ctrl: false, shift: false });
        showItemContextMenu(e.clientX, e.clientY);
      });

      const iconEl = document.createElement('span');
      iconEl.className = 'item-icon';
      iconEl.innerHTML = iconFor(entry.type);
      item.appendChild(iconEl);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = entry.name;
      item.appendChild(nameSpan);

      const typeSpan = document.createElement('span');
      typeSpan.className = 'item-type';
      typeSpan.textContent = entry.type + (entry.childCount > 0 ? ' (' + entry.childCount + ')' : '');
      item.appendChild(typeSpan);

      grid.appendChild(item);
    }

    grid.addEventListener('click', (e) => {
      if (e.target === grid)
        clearSelection();
    });

    grid.addEventListener('contextmenu', (e) => {
      if (e.target === grid) {
        e.preventDefault();
        clearSelection();
        showBackgroundContextMenu(e.clientX, e.clientY);
      }
    });

    mainView.appendChild(grid);
    statusCount.textContent = entries.length + ' item(s)';
    statusInfo.textContent = result.nodeType + ': ' + (result.preview || '');
  }

  // =========================================================================
  // JS syntax highlighting (simple tokenizer)
  // =========================================================================

  const _JS_KEYWORDS = new Set([
    'async','await','break','case','catch','class','const','continue',
    'debugger','default','delete','do','else','enum','export','extends',
    'false','finally','for','function','if','import','in','instanceof',
    'let','new','null','of','return','static','super','switch','this',
    'throw','true','try','typeof','undefined','var','void','while',
    'with','yield','get','set',
  ]);

  function highlightJS(code) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const out = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];

      // Line / block comments
      if (ch === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end);
        out.push('<span class="hl-comment">' + esc(slice) + '</span>');
        i += slice.length;
        continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
        out.push('<span class="hl-comment">' + esc(slice) + '</span>');
        i += slice.length;
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < len && code[j] !== ch) {
          if (code[j] === '\\') ++j;
          ++j;
        }
        if (j < len) ++j;
        out.push('<span class="hl-string">' + esc(code.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // Numbers
      if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(code[i + 1]))) {
        let j = i;
        if (ch === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
          j += 2;
          while (j < len && /[0-9a-fA-F_]/.test(code[j])) ++j;
        } else if (ch === '0' && (code[j + 1] === 'b' || code[j + 1] === 'B')) {
          j += 2;
          while (j < len && /[01_]/.test(code[j])) ++j;
        } else {
          while (j < len && /[\d._eE+\-]/.test(code[j])) ++j;
        }
        if (j < len && code[j] === 'n') ++j; // BigInt
        out.push('<span class="hl-number">' + esc(code.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // Identifiers / keywords
      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i + 1;
        while (j < len && /[\w$]/.test(code[j])) ++j;
        const word = code.slice(i, j);
        if (_JS_KEYWORDS.has(word))
          out.push('<span class="hl-keyword">' + esc(word) + '</span>');
        else if (j < len && code[j] === '(')
          out.push('<span class="hl-func">' + esc(word) + '</span>');
        else
          out.push(esc(word));
        i = j;
        continue;
      }

      // Regex (simple heuristic: after = ( , ; ! & | ? : [ { ~)
      if (ch === '/' && i > 0) {
        const prev = code.slice(0, i).replace(/\s+$/, '');
        const last = prev[prev.length - 1];
        if (last && '=(!&|?:;,[{~+-*%^'.includes(last)) {
          let j = i + 1;
          while (j < len && code[j] !== '/' && code[j] !== '\n') {
            if (code[j] === '\\') ++j;
            ++j;
          }
          if (j < len && code[j] === '/') {
            ++j;
            while (j < len && /[gimsuy]/.test(code[j])) ++j;
            out.push('<span class="hl-regex">' + esc(code.slice(i, j)) + '</span>');
            i = j;
            continue;
          }
        }
      }

      // Operators / punctuation
      out.push(esc(ch));
      ++i;
    }

    return out.join('');
  }

  function showDetailPanel(entry) {
    mainView.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'detail-panel';

    // Header with back button and info
    const header = document.createElement('div');
    header.className = 'detail-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'detail-back';
    backBtn.textContent = '\u25C0 Back';
    backBtn.addEventListener('click', () => render());
    header.appendChild(backBtn);

    const info = document.createElement('div');
    info.className = 'detail-info';

    const iconEl = document.createElement('span');
    iconEl.className = 'detail-icon';
    iconEl.innerHTML = iconFor(entry.type);
    info.appendChild(iconEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'detail-name';
    nameEl.textContent = entry.name;
    info.appendChild(nameEl);

    const typeEl = document.createElement('span');
    typeEl.className = 'detail-type';
    typeEl.textContent = entry.type;
    info.appendChild(typeEl);

    header.appendChild(info);
    panel.appendChild(header);

    // Content area with the full detail
    const content = document.createElement('pre');
    content.className = 'detail-content';
    const rawText = entry.detail || entry.preview || '';
    if (entry.type === 'function' || entry.type === 'class') {
      content.classList.add('detail-code');
      content.innerHTML = highlightJS(rawText);
    } else
      content.textContent = rawText;
    panel.appendChild(content);

    mainView.appendChild(panel);
    statusCount.textContent = entry.type;
    statusInfo.textContent = entry.name;
  }

  function renderError(message) {
    mainView.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'leaf-detail';
    errDiv.innerHTML = '<div class="leaf-icon">' + ICONS.error + '</div>'
      + '<div class="leaf-type">Error</div>'
      + '<div class="leaf-value">' + escapeHtml(message) + '</div>';
    mainView.appendChild(errDiv);
    statusCount.textContent = '';
    statusInfo.textContent = message;
  }

  // =========================================================================
  // Context menu
  // =========================================================================
  let activeContextMenu = null;

  function dismissContextMenu() {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  function createContextMenuEl(x, y) {
    dismissContextMenu();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    activeContextMenu = menu;

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = Math.max(0, x - rect.width) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, y - rect.height) + 'px';
    });

    return menu;
  }

  function addCtxItem(menu, label, callback, disabled) {
    const el = document.createElement('div');
    el.className = 'ctx-item' + (disabled ? ' disabled' : '');
    el.textContent = label;
    if (!disabled)
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissContextMenu();
        callback();
      });
    menu.appendChild(el);
    return el;
  }

  function addCtxSep(menu) {
    const sep = document.createElement('div');
    sep.className = 'ctx-sep';
    menu.appendChild(sep);
  }

  function addCtxSubmenu(menu, label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ctx-item ctx-submenu';
    wrapper.textContent = label;
    const panel = document.createElement('div');
    panel.className = 'ctx-submenu-panel';
    wrapper.appendChild(panel);
    menu.appendChild(wrapper);
    return panel;
  }

  function showItemContextMenu(x, y) {
    const menu = createContextMenuEl(x, y);
    const hasSelection = selectedItems.length > 0;
    const singleSelection = selectedItems.length === 1;
    const canModify = isVfsMode;

    if (hasSelection) {
      const sel = selectedItems[0];
      addCtxItem(menu, 'Open', () => {
        if (sel.isDir)
          navigate(sel.path);
        else if (isVfsMode)
          openFile(sel.path, sel.name);
      });

      const canDownload = canModify && !selectedItems.some(s => s.isDir);
      addCtxItem(menu, 'Download', () => doDownload(), !canDownload);

      addCtxSep(menu);
    }

    addCtxItem(menu, 'Cut', () => doClipboardCut(), !canModify || !hasSelection);
    addCtxItem(menu, 'Copy', () => doClipboardCopy(), !hasSelection);

    addCtxSep(menu);

    addCtxItem(menu, 'Delete', () => doDelete(), !canModify || !hasSelection);
    addCtxItem(menu, 'Rename', () => beginRename(), !canModify || !singleSelection);

    addCtxSep(menu);

    addCtxItem(menu, 'Properties', () => showProperties());
  }

  function showBackgroundContextMenu(x, y) {
    const menu = createContextMenuEl(x, y);
    const canModify = isVfsMode;

    if (canModify) {
      const newPanel = addCtxSubmenu(menu, 'New');
      addCtxItem(newPanel, 'Folder', () => doNewFolder());
      addCtxItem(newPanel, 'Text Document', () => doNewTextDocument());
      addCtxSep(menu);
    }

    addCtxItem(menu, 'Paste', () => doPaste(), !clipboard || !canModify);

    addCtxSep(menu);

    addCtxItem(menu, 'Refresh', () => doRefresh());

    addCtxSep(menu);

    addCtxItem(menu, 'Properties', () => showFolderProperties());
  }

  document.addEventListener('click', () => dismissContextMenu());
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      return;
  });

  // =========================================================================
  // File operations
  // =========================================================================

  // -- New Folder --
  async function doNewFolder() {
    if (!isVfsMode) return;

    let name = 'New Folder';
    let counter = 1;
    const existingNames = new Set(currentEntries.map(e => e.name));
    while (existingNames.has(name))
      name = 'New Folder (' + (++counter) + ')';

    const vfsPath = toVfsRelative(currentPath);
    const folderPath = (vfsPath === '/' ? '/' : vfsPath + '/') + name;
    const result = await vfsWrite(folderPath + '/.keep', '');
    if (result.error) {
      showAlert('Could not create folder: ' + result.error);
      return;
    }
    await doRefresh();
    const newItem = selectedItems.length === 0 ? findItemByName(name) : null;
    if (newItem) {
      selectItem(newItem.index, newItem.el, newItem.entry, { ctrl: false, shift: false });
      beginRename();
    }
  }

  function findItemByName(name) {
    const grid = mainView.querySelector('.file-list');
    if (!grid) return null;
    const items = grid.querySelectorAll('.file-item');
    for (let i = 0; i < items.length; ++i) {
      if (items[i].dataset.name === name)
        return { index: i, el: items[i], entry: currentEntries[i] };
    }
    return null;
  }

  // -- New Text Document --
  async function doNewTextDocument() {
    if (!isVfsMode) return;

    let name = 'New Text Document.txt';
    let counter = 1;
    const existingNames = new Set(currentEntries.map(e => e.name));
    while (existingNames.has(name))
      name = 'New Text Document (' + (++counter) + ').txt';

    const vfsPath = toVfsRelative(currentPath);
    const filePath = (vfsPath === '/' ? '/' : vfsPath + '/') + name;
    const result = await vfsWrite(filePath, '');
    if (result.error) {
      showAlert('Could not create file: ' + result.error);
      return;
    }
    await doRefresh();
    const newItem = findItemByName(name);
    if (newItem) {
      selectItem(newItem.index, newItem.el, newItem.entry, { ctrl: false, shift: false });
      beginRename();
    }
  }

  // -- Delete --
  async function doDelete() {
    if (!isVfsMode || selectedItems.length === 0) return;

    const names = selectedItems.map(s => s.name);
    const msg = names.length === 1
      ? 'Are you sure you want to delete "' + names[0] + '"?'
      : 'Are you sure you want to delete ' + names.length + ' items?';

    const confirmed = await showConfirm(msg);
    if (!confirmed) return;

    for (const sel of selectedItems) {
      const vfsPath = toVfsRelative(sel.path);
      const result = await vfsDelete(vfsPath);
      if (result.error)
        showAlert('Could not delete "' + sel.name + '": ' + result.error);
    }

    clearSelection();
    await doRefresh();
  }

  // -- Rename (inline edit) --
  function beginRename() {
    if (!isVfsMode || selectedItems.length !== 1) return;

    const sel = selectedItems[0];
    const el = sel.entryEl;
    if (!el) return;

    const nameSpan = el.querySelector('.item-name');
    if (!nameSpan) return;

    cancelRename();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename';
    input.value = sel.name;
    activeRename = { input, nameSpan, originalName: sel.name, el };

    nameSpan.style.display = 'none';
    el.insertBefore(input, nameSpan.nextSibling);

    input.focus();
    const dotIdx = sel.name.lastIndexOf('.');
    if (dotIdx > 0)
      input.setSelectionRange(0, dotIdx);
    else
      input.select();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (activeRename && activeRename.input === input)
          commitRename();
      }, 100);
    });
  }

  async function commitRename() {
    if (!activeRename) return;
    const { input, nameSpan, originalName } = activeRename;
    const newName = input.value.trim();

    input.remove();
    nameSpan.style.display = '';
    activeRename = null;

    if (!newName || newName === originalName) return;

    if (newName.includes('/') || newName.includes('\\')) {
      showAlert('File names cannot contain / or \\ characters.');
      return;
    }

    const oldVfsPath = toVfsRelative(childPath(currentPath, originalName));
    const newVfsPath = toVfsRelative(childPath(currentPath, newName));
    const result = await vfsRename(oldVfsPath, newVfsPath);
    if (result.error)
      showAlert('Could not rename: ' + result.error);

    clearSelection();
    await doRefresh();
  }

  function cancelRename() {
    if (!activeRename) return;
    const { input, nameSpan } = activeRename;
    input.remove();
    nameSpan.style.display = '';
    activeRename = null;
  }

  // -- Clipboard: Copy / Cut / Paste --
  function doClipboardCopy() {
    if (selectedItems.length === 0) return;
    clipboard = {
      mode: 'copy',
      items: selectedItems.map(s => ({ name: s.name, path: s.path })),
    };
    updateCutVisuals();
    updateToolbarState();
  }

  function doClipboardCut() {
    if (!isVfsMode || selectedItems.length === 0) return;
    clipboard = {
      mode: 'cut',
      items: selectedItems.map(s => ({ name: s.name, path: s.path })),
    };
    updateCutVisuals();
    updateToolbarState();
  }

  function updateCutVisuals() {
    const grid = mainView.querySelector('.file-list');
    if (!grid) return;
    const items = grid.querySelectorAll('.file-item');
    for (const item of items) {
      item.classList.remove('cut-pending');
      if (clipboard && clipboard.mode === 'cut') {
        const itemPath = childPath(currentPath, item.dataset.name);
        if (clipboard.items.some(ci => ci.path === itemPath))
          item.classList.add('cut-pending');
      }
    }
  }

  async function doPaste() {
    if (!clipboard || !isVfsMode) return;

    for (const ci of clipboard.items) {
      const srcVfs = toVfsRelative(ci.path);
      let destName = ci.name;

      if (clipboard.mode === 'copy' && parentPath(ci.path) === currentPath) {
        const existingNames = new Set(currentEntries.map(e => e.name));
        if (existingNames.has(destName)) {
          const dotIdx = destName.lastIndexOf('.');
          if (dotIdx > 0) {
            const base = destName.slice(0, dotIdx);
            const ext = destName.slice(dotIdx);
            let counter = 1;
            do {
              destName = base + ' - Copy' + (counter > 1 ? ' (' + counter + ')' : '') + ext;
              ++counter;
            } while (existingNames.has(destName));
          } else {
            let counter = 1;
            do {
              destName = ci.name + ' - Copy' + (counter > 1 ? ' (' + counter + ')' : '');
              ++counter;
            } while (existingNames.has(destName));
          }
        }
      }

      const destVfs = toVfsRelative(childPath(currentPath, destName));

      let result;
      if (clipboard.mode === 'copy')
        result = await vfsCopy(srcVfs, destVfs);
      else
        result = await vfsMove(srcVfs, destVfs);

      if (result.error)
        showAlert('Could not ' + clipboard.mode + ' "' + ci.name + '": ' + result.error);
    }

    if (clipboard.mode === 'cut')
      clipboard = null;

    clearSelection();
    await doRefresh();
  }

  // -- Upload files --
  async function doUpload() {
    if (!isVfsMode) return;
    uploadInput.click();
  }

  uploadInput.addEventListener('change', async () => {
    const files = uploadInput.files;
    if (!files || files.length === 0) return;
    const vfsDir = toVfsRelative(currentPath);

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);

        const filePath = (vfsDir === '/' ? '/' : vfsDir + '/') + file.name;
        const result = await vfsWrite(filePath, arrayBuffer);
        if (result.error)
          showAlert('Could not upload "' + file.name + '": ' + result.error);
      } catch (err) {
        showAlert('Failed to read "' + file.name + '": ' + err.message);
      }
    }
    uploadInput.value = '';
    clearSelection();
    await doRefresh();
  });

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function contentToDownloadBlob(content) {
    if (content instanceof Blob)
      return content;
    if (content instanceof ArrayBuffer)
      return new Blob([content], { type: 'application/octet-stream' });
    if (ArrayBuffer.isView(content))
      return new Blob([content], { type: 'application/octet-stream' });

    if (typeof content === 'string') {
      const m = content.match(/^data:([^,]*),(.*)$/i);
      if (m) {
        const meta = m[1] || '';
        const payload = m[2] || '';
        const mime = (meta.split(';')[0] || 'application/octet-stream').trim();
        if (/;\s*base64/i.test(meta)) {
          try {
            const binary = atob(payload.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; ++i)
              bytes[i] = binary.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: mime });
          } catch (_) {}
        } else {
          try {
            const decoded = decodeURIComponent(payload);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; ++i)
              bytes[i] = decoded.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: mime });
          } catch (_) {}
        }
      }

      // Legacy Explorer wrapper
      if (content.startsWith('{') && content.includes('"type"')) {
        try {
          const obj = JSON.parse(content);
          if (obj && obj.type === 'base64' && typeof obj.data === 'string') {
            const binary = atob(obj.data.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; ++i)
              bytes[i] = binary.charCodeAt(i) & 0xff;
            return new Blob([bytes], { type: obj.mime || 'application/octet-stream' });
          }
          if (obj && obj.type === 'text' && typeof obj.data === 'string')
            return new Blob([obj.data], { type: 'text/plain;charset=utf-8' });
        } catch (_) {}
      }
    }

    return new Blob([content ?? ''], { type: 'application/octet-stream' });
  }

  // -- Download files --
  async function doDownload() {
    if (!isVfsMode || selectedItems.length === 0) return;
    for (const sel of selectedItems) {
      if (sel.isDir) continue;
      const vfsPath = toVfsRelative(sel.path);
      const result = await vfsRead(vfsPath);
      if (result.error) {
        showAlert('Could not download "' + sel.name + '": ' + result.error);
        continue;
      }
      const content = result.data != null ? result.data : '';
      const blob = contentToDownloadBlob(content);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sel.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // -- Properties dialog --
  function showProperties() {
    if (selectedItems.length === 0) return;
    const sel = selectedItems[0];
    const entry = currentEntries.find(e => e.name === sel.name);
    if (!entry) return;

    const lines = [];
    lines.push('Name: ' + sel.name);
    lines.push('Path: ' + formatPath(sel.path));
    lines.push('Type: ' + (sel.isDir ? 'Folder' : 'File'));
    if (!sel.isDir && entry.size != null)
      lines.push('Size: ' + formatSize(entry.size));
    if (isVfsMode)
      lines.push('Location: VFS (localStorage)');
    else
      lines.push('Location: SZ Object Tree');

    showAlert(lines.join('\n'));
  }

  function showFolderProperties() {
    const lines = [];
    lines.push('Path: ' + formatPath(currentPath));
    lines.push('Items: ' + currentEntries.length);
    if (isVfsMode) {
      let totalSize = 0;
      for (const e of currentEntries)
        if (e.type !== 'dir')
          totalSize += e.size || 0;
      lines.push('Total file size: ' + formatSize(totalSize));
      lines.push('Location: VFS (localStorage)');
    } else
      lines.push('Location: SZ Object Tree (read-only)');
    showAlert(lines.join('\n'));
  }

  // -- Refresh --
  async function doRefresh() {
    const node = treeNodeMap.get(currentPath);
    if (node) node.refresh();
    clearSelection();
    await navigate(currentPath, true);
  }

  // =========================================================================
  // Confirm / Alert dialogs
  // =========================================================================
  function showConfirm(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';

      const textEl = document.createElement('div');
      textEl.className = 'dlg-text';
      textEl.textContent = message;
      dialog.appendChild(textEl);

      const buttons = document.createElement('div');
      buttons.className = 'dlg-buttons';

      const yesBtn = document.createElement('button');
      yesBtn.textContent = 'Yes';
      yesBtn.addEventListener('click', () => { overlay.remove(); resolve(true); });
      buttons.appendChild(yesBtn);

      const noBtn = document.createElement('button');
      noBtn.textContent = 'No';
      noBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
      buttons.appendChild(noBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      yesBtn.focus();

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { overlay.remove(); resolve(false); }
        if (e.key === 'Enter') { overlay.remove(); resolve(true); }
      });
    });
  }

  function showAlert(message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';

      const textEl = document.createElement('div');
      textEl.className = 'dlg-text';
      textEl.style.whiteSpace = 'pre-wrap';
      textEl.textContent = message;
      dialog.appendChild(textEl);

      const buttons = document.createElement('div');
      buttons.className = 'dlg-buttons';

      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => { overlay.remove(); resolve(); });
      buttons.appendChild(okBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      okBtn.focus();

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') { overlay.remove(); resolve(); }
      });
    });
  }

  // =========================================================================
  // Sidebar tree
  // =========================================================================
  const treeNodeMap = new Map();

  function buildTree() {
    sidebar.innerHTML = '';
    treeNodeMap.clear();
    const rootNode = createTreeNode('/', '\u00BBSynthelicZ\u00AB', 0, 'root');
    sidebar.appendChild(rootNode.container);
    rootNode.expand();
  }

  function createTreeNode(path, label, depth, nodeType) {
    const container = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'tree-node';
    row.style.paddingLeft = (4 + depth * 16) + 'px';
    row.dataset.path = path;

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle has-children';
    toggle.textContent = '\u25B6';
    row.appendChild(toggle);

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = treeIcon(nodeType, false);
    row.appendChild(icon);

    const lbl = document.createElement('span');
    lbl.className = 'tree-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    container.appendChild(row);

    const childContainer = document.createElement('div');
    childContainer.className = 'tree-children';
    container.appendChild(childContainer);

    let expanded = false;
    let loaded = false;
    let actualType = nodeType;

    const api = {
      container,
      expand() {
        if (!loaded) {
          loaded = true;
          const loadingEl = document.createElement('div');
          loadingEl.className = 'tree-loading';
          loadingEl.textContent = 'Loading\u2026';
          childContainer.appendChild(loadingEl);

          const isVfs = isVfsPath(path);

          const loadPromise = isVfs
            ? vfsList(toVfsRelative(path)).then((result) => {
              childContainer.innerHTML = '';
              const dirs = (result.entries || []).filter(e => e.type === 'dir');
              if (dirs.length === 0) {
                toggle.classList.remove('has-children');
                toggle.textContent = '';
              }
              for (const dir of dirs) {
                const cp = childPath(path, dir.name);
                const child = createTreeNode(cp, dir.name, depth + 1, 'vfsFolder');
                childContainer.appendChild(child.container);
              }
            })
            : browse(path).then((result) => {
              childContainer.innerHTML = '';
              actualType = result.nodeType || actualType;
              const containers = (result.entries || []).filter(e => e.isContainer && e.childCount > 0);

              if (containers.length === 0) {
                toggle.classList.remove('has-children');
                toggle.textContent = '';
              }

              for (const entry of containers) {
                const cp = childPath(path, entry.name);
                const child = createTreeNode(cp, entry.name, depth + 1, entry.type);
                childContainer.appendChild(child.container);
              }
            });

          loadPromise.catch(() => {
            childContainer.innerHTML = '';
            toggle.classList.remove('has-children');
            toggle.textContent = '';
          });
        }
        expanded = true;
        childContainer.classList.add('expanded');
        toggle.textContent = '\u25BC';
        icon.innerHTML = treeIcon(actualType, true);
      },
      collapse() {
        expanded = false;
        childContainer.classList.remove('expanded');
        toggle.textContent = '\u25B6';
        icon.innerHTML = treeIcon(actualType, false);
      },
      refresh() {
        loaded = false;
        childContainer.innerHTML = '';
        if (expanded) api.expand();
      },
    };

    treeNodeMap.set(path, api);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(path);
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expanded) api.collapse();
      else api.expand();
    });

    return api;
  }

  function highlightSidebar(path) {
    for (const el of sidebar.querySelectorAll('.tree-node'))
      el.classList.toggle('selected', el.dataset.path === path);
  }

  // =========================================================================
  // Button handlers
  // =========================================================================
  btnBack.addEventListener('click', goBack);
  btnForward.addEventListener('click', goForward);

  btnUp.addEventListener('click', () => {
    if (currentPath !== '/')
      navigate(parentPath(currentPath));
  });

  btnRefresh.addEventListener('click', doRefresh);
  btnNewFolder.addEventListener('click', doNewFolder);
  btnDelete.addEventListener('click', doDelete);
  btnRename.addEventListener('click', beginRename);
  btnCopy.addEventListener('click', doClipboardCopy);
  btnCut.addEventListener('click', doClipboardCut);
  btnPaste.addEventListener('click', doPaste);

  btnUpload.addEventListener('click', doUpload);
  btnDownload.addEventListener('click', doDownload);

  btnView.addEventListener('click', () => {
    // Currently only icons mode; placeholder for future list/detail views
  });

  // =========================================================================
  // Toolbar overflow (chevron menu for hidden buttons)
  // =========================================================================
  const toolbar = document.getElementById('toolbar');

  function getToolbarItems() {
    const items = [];
    for (const child of toolbar.children) {
      if (child === btnOverflow || child === overflowMenu) continue;
      items.push(child);
    }
    return items;
  }

  let overflowVisible = false;

  function toggleOverflowMenu() {
    overflowVisible = !overflowVisible;
    overflowMenu.classList.toggle('visible', overflowVisible);
  }

  function hideOverflowMenu() {
    overflowVisible = false;
    overflowMenu.classList.remove('visible');
  }

  btnOverflow.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOverflowMenu();
  });

  document.addEventListener('click', () => hideOverflowMenu());

  function updateToolbarOverflow() {
    const items = getToolbarItems();
    for (const item of items) {
      item.style.display = '';
      item.dataset.overflowHidden = '';
    }
    btnOverflow.classList.remove('visible');
    overflowMenu.innerHTML = '';

    const toolbarRect = toolbar.getBoundingClientRect();
    const availableWidth = toolbarRect.width - 28;

    let totalWidth = 0;
    let overflowStartIndex = -1;
    for (let i = 0; i < items.length; ++i) {
      const rect = items[i].getBoundingClientRect();
      totalWidth += rect.width + 2;
      if (totalWidth > availableWidth && overflowStartIndex < 0)
        overflowStartIndex = i;
    }

    if (overflowStartIndex < 0) return;

    btnOverflow.classList.add('visible');

    for (let i = overflowStartIndex; i < items.length; ++i) {
      const item = items[i];
      item.style.display = 'none';
      item.dataset.overflowHidden = '1';

      if (item.classList.contains('sep')) continue;
      if (item.tagName !== 'BUTTON') continue;

      const menuItem = document.createElement('div');
      menuItem.className = 'overflow-item' + (item.disabled ? ' disabled' : '');
      menuItem.textContent = item.textContent;
      if (!item.disabled)
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          hideOverflowMenu();
          item.click();
        });
      overflowMenu.appendChild(menuItem);
    }
  }

  const toolbarObserver = new ResizeObserver(() => updateToolbarOverflow());
  toolbarObserver.observe(toolbar);

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      return;

    if (e.key === 'F2' && selectedItems.length === 1 && isVfsMode) {
      e.preventDefault();
      beginRename();
    } else if (e.key === 'Delete' && selectedItems.length > 0 && isVfsMode) {
      e.preventDefault();
      doDelete();
    } else if (e.key === 'F5') {
      e.preventDefault();
      doRefresh();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (currentPath !== '/')
        navigate(parentPath(currentPath));
    } else if (e.key === 'a' && e.ctrlKey) {
      e.preventDefault();
      selectAll();
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      doClipboardCopy();
    } else if (e.key === 'x' && e.ctrlKey && isVfsMode) {
      e.preventDefault();
      doClipboardCut();
    } else if (e.key === 'v' && e.ctrlKey && isVfsMode) {
      e.preventDefault();
      doPaste();
    } else if (e.key === 'Enter' && selectedItems.length === 1) {
      e.preventDefault();
      const sel = selectedItems[0];
      if (sel.isDir)
        navigate(sel.path);
      else if (isVfsMode)
        openFile(sel.path, sel.name);
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      goBack();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      goForward();
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentPath !== '/')
        navigate(parentPath(currentPath));
    }
  });

  // =========================================================================
  // Drag-and-drop file upload
  // =========================================================================
  mainView.addEventListener('dragover', (e) => {
    if (!isVfsMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    mainView.classList.add('drop-target');
  });

  mainView.addEventListener('dragenter', (e) => {
    if (!isVfsMode) return;
    e.preventDefault();
    mainView.classList.add('drop-target');
  });

  mainView.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && mainView.contains(e.relatedTarget)) return;
    mainView.classList.remove('drop-target');
  });

  mainView.addEventListener('drop', async (e) => {
    e.preventDefault();
    mainView.classList.remove('drop-target');
    if (!isVfsMode) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const vfsDir = toVfsRelative(currentPath);
    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      try {
        const content = await readFileAsArrayBuffer(file);
        const filePath = (vfsDir === '/' ? '/' : vfsDir + '/') + file.name;
        const result = await vfsWrite(filePath, content);
        if (result.error)
          showAlert('Could not upload "' + file.name + '": ' + result.error);
      } catch (err) {
        showAlert('Failed to read "' + file.name + '": ' + err.message);
      }
    }
    clearSelection();
    await doRefresh();
  });

  // =========================================================================
  // Init
  // =========================================================================
  const cmdLine = Kernel32.GetCommandLine();
  if (cmdLine.path) {
    currentPath = cmdLine.path;
    isVfsMode = isVfsPath(cmdLine.path);
  }
  buildTree();
  render();
})();
