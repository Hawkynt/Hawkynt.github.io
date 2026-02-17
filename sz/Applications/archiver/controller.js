;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // Import archive framework symbols
  const A = window.SZ.Archiver;
  const {
    IArchiveFormat, makeEntry,
    escapeHtml, formatSize, formatDate, getFileExtension, stripExtension, getFileName,
    computeCRC32, crc32Hex,
    writeU16LE, writeU32LE,
    decompressDeflateRaw
  } = A;

  // =======================================================================
  // App State
  // =======================================================================

  let currentFormat = null;
  let currentFormatClass = null;
  let entries = [];
  let currentPath = '';
  let currentFilePath = null;
  let currentFileName = null;
  let archiveBytes = null;
  let archivePassword = null;
  let archiveOptions = {};
  let dirty = false;
  let sortColumn = 'name';
  let sortAscending = true;
  let selectedIndices = new Set();
  let lastSelectedIndex = -1;

  // =======================================================================
  // DOM References
  // =======================================================================

  const menuBar = document.getElementById('menu-bar');
  const toolbar = document.getElementById('toolbar');
  const btnUp = document.getElementById('btn-up');
  const addressInput = document.getElementById('address-input');
  const fileListBody = document.getElementById('file-list-body');
  const fileListContainer = document.getElementById('file-list-container');
  const emptyState = document.getElementById('empty-state');
  const statusCount = document.getElementById('status-count');
  const statusSize = document.getElementById('status-size');
  const statusFormat = document.getElementById('status-format');
  const statusSelection = document.getElementById('status-selection');
  let openMenu = null;

  // =======================================================================
  // Window title
  // =======================================================================

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const name = currentFileName || 'Untitled';
    const title = prefix + name + ' - Archiver';
    document.title = title;
    User32.SetWindowText(title);
  }

  // =======================================================================
  // Dialog helpers
  // =======================================================================

  function showDialog(id) {
    const dlg = document.getElementById(id);
    dlg.classList.add('visible');
    const first = dlg.querySelector('input, select, button[data-result="ok"]');
    if (first) setTimeout(() => first.focus(), 50);
    return new Promise(resolve => {
      function handler(e) {
        const btn = e.target.closest('[data-result]');
        if (!btn) return;
        dlg.classList.remove('visible');
        dlg.removeEventListener('click', handler);
        dlg.removeEventListener('keydown', keyHandler);
        resolve(btn.dataset.result);
      }
      function keyHandler(e) {
        if (e.key === 'Escape') {
          dlg.classList.remove('visible');
          dlg.removeEventListener('click', handler);
          dlg.removeEventListener('keydown', keyHandler);
          resolve('cancel');
        } else if (e.key === 'Enter') {
          dlg.classList.remove('visible');
          dlg.removeEventListener('click', handler);
          dlg.removeEventListener('keydown', keyHandler);
          resolve('ok');
        }
      }
      dlg.addEventListener('click', handler);
      dlg.addEventListener('keydown', keyHandler);
    });
  }

  async function promptPassword(forCreation) {
    const title = document.getElementById('dlg-password-title');
    const confirmRow = document.getElementById('password-confirm-row');
    const passInput = document.getElementById('password-input');
    const confirmInput = document.getElementById('password-confirm');
    title.textContent = forCreation ? 'Set Password' : 'Enter Password';
    confirmRow.style.display = forCreation ? 'block' : 'none';
    passInput.value = '';
    confirmInput.value = '';

    const result = await showDialog('dlg-password');
    if (result !== 'ok') return null;
    const pw = passInput.value;
    if (!pw) return null;
    if (forCreation && pw !== confirmInput.value) {
      await User32.MessageBox(null, 'Passwords do not match.', 'Password Error', 0x30);
      return null;
    }
    return pw;
  }

  // =======================================================================
  // Archive operations
  // =======================================================================

  async function openArchive(bytes, fileName) {
    const FormatClass = IArchiveFormat.detectFormat(bytes, fileName);
    if (!FormatClass) {
      await User32.MessageBox(null, 'Unrecognized archive format.', 'Error', 0x10);
      return;
    }

    const handler = new FormatClass();
    let password = null;
    let parsed;

    try {
      parsed = await handler.parse(bytes, fileName, null);
    } catch (e) {
      if (e && e.needPassword) {
        password = await promptPassword(false);
        if (!password) return;
        try {
          parsed = await handler.parse(bytes, fileName, password);
        } catch (e2) {
          await User32.MessageBox(null, 'Failed to open archive: ' + (e2.message || e2), 'Error', 0x10);
          return;
        }
      } else {
        await User32.MessageBox(null, 'Failed to open archive: ' + (e.message || e), 'Error', 0x10);
        return;
      }
    }

    entries = parsed;
    currentFormat = handler;
    currentFormatClass = FormatClass;
    archiveBytes = bytes;
    archivePassword = password;
    archiveOptions = {};
    currentPath = '';
    dirty = false;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    currentFileName = fileName;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  function splitVolumes(bytes, volumeSize, baseName) {
    if (!volumeSize || bytes.length <= volumeSize) return null;
    const parts = [];
    for (let off = 0, n = 1; off < bytes.length; off += volumeSize, ++n)
      parts.push({ name: baseName + '.' + String(n).padStart(3, '0'), data: bytes.slice(off, off + volumeSize) });
    return parts;
  }

  function generateRecoveryRecord(bytes, percent) {
    const BLOCK = 4096;
    const stripe = Math.max(2, Math.round(100 / percent));
    const numBlocks = Math.ceil(bytes.length / BLOCK);
    const numParity = Math.ceil(numBlocks / stripe);
    const parity = new Uint8Array(numParity * BLOCK);
    for (let p = 0; p < numParity; ++p) {
      const parityOff = p * BLOCK;
      for (let s = 0; s < stripe; ++s) {
        const blockIdx = p * stripe + s;
        const srcOff = blockIdx * BLOCK;
        if (srcOff >= bytes.length) break;
        const srcEnd = Math.min(srcOff + BLOCK, bytes.length);
        for (let i = 0; i < srcEnd - srcOff; ++i)
          parity[parityOff + i] ^= bytes[srcOff + i];
      }
    }

    const headerSize = 32;
    const result = new Uint8Array(headerSize + parity.length);
    const magic = new TextEncoder().encode('SZRV');
    result.set(magic, 0);
    writeU16LE(result, 4, 1);
    writeU16LE(result, 6, BLOCK);
    writeU32LE(result, 8, bytes.length);
    writeU16LE(result, 12, stripe);
    writeU32LE(result, 14, computeCRC32(bytes));
    result.set(parity, headerSize);
    return result;
  }

  async function postProcessAndSave(built, baseName, ext) {
    const volumeSize = parseInt(archiveOptions.volumeSize || '0', 10);
    const recoveryPct = archiveOptions.recovery ? parseInt(archiveOptions.recoveryPct || '10', 10) : 0;
    const volumes = splitVolumes(built, volumeSize, baseName + '.' + ext);
    const recovery = recoveryPct > 0 ? generateRecoveryRecord(built, recoveryPct) : null;

    if (volumes || recovery) {
      const zip = new JSZip();
      if (volumes)
        for (const v of volumes) zip.file(v.name, v.data);
      else
        zip.file(baseName + '.' + ext, built);
      if (recovery)
        zip.file(baseName + '.rev', recovery);
      const blob = await zip.generateAsync({ type: 'uint8array' });
      ComDlg32.ExportFile(blob, baseName + '_bundle.zip');
      return;
    }

    return built;
  }

  async function _reparseAfterBuild(built) {
    try {
      const oldOpts = new Map(entries.map(e => [e.name, e._options]));
      const reparsed = await currentFormat.parse(built, currentFileName, archivePassword);
      for (const e of reparsed) {
        const prev = oldOpts.get(e.name);
        if (prev) e._options = prev;
      }
      entries = reparsed;
    } catch (_) {}
    renderFileList();
    updateStatusBar();
  }

  async function saveArchive() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) return;

    try {
      const built = await currentFormat.build(entries, archivePassword, archiveOptions);
      const ext = currentFormatClass.extensions[0];
      const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
      const processed = await postProcessAndSave(built, baseName, ext);
      if (!processed) { dirty = false; updateTitle(); return; }
      archiveBytes = processed;

      if (currentFilePath) {
        await Kernel32.WriteAllBytes(currentFilePath, processed);
      } else {
        const result = await ComDlg32.GetSaveFileName({
          title: 'Save Archive',
          filters: [{ name: currentFormatClass.displayName, ext: [ext] }, { name: 'All Files', ext: ['*'] }],
          defaultName: (currentFileName ? stripExtension(currentFileName) : 'archive') + '.' + ext
        });
        if (!result || result.cancelled) return;
        await Kernel32.WriteAllBytes(result.path, processed);
        currentFilePath = result.path;
        currentFileName = getFileName(result.path);
      }

      dirty = false;
      updateTitle();
      await _reparseAfterBuild(processed);
    } catch (e) {
      await User32.MessageBox(null, 'Failed to save: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function saveArchiveAs() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) return;

    try {
      const built = await currentFormat.build(entries, archivePassword, archiveOptions);
      const ext = currentFormatClass.extensions[0];
      const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
      const processed = await postProcessAndSave(built, baseName, ext);
      if (!processed) { dirty = false; updateTitle(); return; }

      const result = await ComDlg32.GetSaveFileName({
        title: 'Save Archive As',
        filters: [{ name: currentFormatClass.displayName, ext: [ext] }, { name: 'All Files', ext: ['*'] }],
        defaultName: (currentFileName ? stripExtension(currentFileName) : 'archive') + '.' + ext
      });
      if (!result || result.cancelled) return;

      await Kernel32.WriteAllBytes(result.path, processed);
      currentFilePath = result.path;
      currentFileName = getFileName(result.path);
      archiveBytes = processed;
      dirty = false;
      updateTitle();
      await _reparseAfterBuild(processed);
    } catch (e) {
      await User32.MessageBox(null, 'Failed to save: ' + (e.message || e), 'Error', 0x10);
    }
  }

  function buildOptionsPanel(containerId, FormatClass) {
    const panel = document.getElementById(containerId);
    panel.innerHTML = '';
    const opts = FormatClass.getCreateOptions();
    if (!opts.length) return;

    for (const opt of opts) {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.dataset.optionId = opt.id;

      if (opt.visibleWhen)
        row.dataset.visibleWhen = JSON.stringify(opt.visibleWhen);

      const label = document.createElement('label');
      label.textContent = opt.label + ':';
      label.htmlFor = containerId + '-opt-' + opt.id;

      if (opt.type === 'select') {
        const select = document.createElement('select');
        select.id = containerId + '-opt-' + opt.id;
        select.dataset.optionId = opt.id;
        for (const o of opt.options) {
          const option = document.createElement('option');
          option.value = o.value;
          option.textContent = o.label;
          if (o.value === opt.default) option.selected = true;
          select.appendChild(option);
        }
        select.addEventListener('change', () => updateOptionVisibility(containerId));
        row.appendChild(label);
        row.appendChild(select);
      } else if (opt.type === 'checkbox') {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = containerId + '-opt-' + opt.id;
        cb.dataset.optionId = opt.id;
        cb.checked = !!opt.default;
        cb.addEventListener('change', () => updateOptionVisibility(containerId));
        row.appendChild(cb);
        label.style.minWidth = 'auto';
        row.appendChild(label);
      }

      panel.appendChild(row);
    }

    updateOptionVisibility(containerId);
  }

  function updateOptionVisibility(containerId) {
    const panel = document.getElementById(containerId);
    const rows = panel.querySelectorAll('.option-row[data-visible-when]');
    for (const row of rows) {
      const cond = JSON.parse(row.dataset.visibleWhen);
      let visible = true;
      for (const [key, val] of Object.entries(cond)) {
        const el = panel.querySelector('[data-option-id="' + key + '"]');
        if (!el) { visible = false; break; }
        const actual = el.type === 'checkbox' ? el.checked : el.value;
        const sActual = String(actual);
        const sVal = String(val);
        if (sVal.includes('|'))
          visible = sVal.split('|').includes(sActual);
        else
          visible = sActual === sVal;
        if (!visible) break;
      }
      row.classList.toggle('hidden', !visible);
    }
  }

  function collectOptions(containerId) {
    const panel = document.getElementById(containerId);
    const opts = {};
    const elements = panel.querySelectorAll('[data-option-id]');
    for (const el of elements) {
      const id = el.dataset.optionId;
      opts[id] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return opts;
  }

  function populateFormatDropdown(selectId, excludeId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    const creatable = IArchiveFormat.formats.filter(F => F.canCreate && (!excludeId || F.id !== excludeId));
    creatable.sort((a, b) => a.displayName.localeCompare(b.displayName));
    for (const F of creatable) {
      const option = document.createElement('option');
      option.value = F.id;
      option.textContent = F.displayName;
      select.appendChild(option);
    }
  }

  async function newArchive() {
    populateFormatDropdown('new-format');
    const formatSelect = document.getElementById('new-format');
    const initialFormat = IArchiveFormat.findById(formatSelect.value);
    if (initialFormat) buildOptionsPanel('new-options-panel', initialFormat);

    document.getElementById('new-recovery').checked = false;
    document.getElementById('new-recovery-pct-row').classList.add('hidden');
    document.getElementById('new-volume-size').value = '0';

    const result = await showDialog('dlg-new');
    if (result !== 'ok') return;

    const formatId = formatSelect.value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (!FormatClass) return;

    const opts = collectOptions('new-options-panel');
    opts.volumeSize = document.getElementById('new-volume-size').value;
    opts.recovery = document.getElementById('new-recovery').checked;
    opts.recoveryPct = document.getElementById('new-recovery-pct').value;

    const needsPassword = (opts.encryption && opts.encryption !== 'none') ||
      (opts.encrypt) ||
      (FormatClass.supportsEncryption && opts.encryption && opts.encryption !== 'none');

    let password = null;
    if (needsPassword) {
      password = await promptPassword(true);
      if (!password) return;
    }

    entries = [];
    currentFormat = new FormatClass();
    currentFormatClass = FormatClass;
    archiveBytes = null;
    archivePassword = password;
    archiveOptions = opts;
    currentPath = '';
    currentFilePath = null;
    currentFileName = 'New.' + FormatClass.extensions[0];
    dirty = true;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  const _OPEN_FILTERS = [
    { name: 'All Archives', ext: ['zip', 'zipx', 'tar', 'tgz', 'tlz', 'gz', 'bz2', 'xz', 'zst', 'lzma', 'lz', 'lzo', 'b64', 'rar', '7z', 'lzh', 'lha', 'arj', 'sqx', 'ace', 'arc', 'zoo', 'ha', 'sit', 'sitx', 'pak', 'alz', 'pea', 'cpio', 'cab', 'iso', 'wim', 'esd', 'xar', 'pkg', 'msi', 'chm', 'z', 'rpm', 'deb', 'a', 'ar', 'lib', 'jar', 'war', 'ear', 'apk', 'epub', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'uue', 'uu', 'hex', 'ihex', 'par', 'par2', 'mar', 'shar', 'dmg', 'vhd', 'vhdx', 'vdi', 'vmdk', 'qcow2', 'img'] },
    { name: 'ZIP Files', ext: ['zip', 'zipx'] },
    { name: 'TAR Files', ext: ['tar', 'tgz', 'tlz'] },
    { name: '7-Zip Files', ext: ['7z'] },
    { name: 'RAR Files', ext: ['rar'] },
    { name: 'Java / Android', ext: ['jar', 'war', 'ear', 'apk'] },
    { name: 'Office Documents', ext: ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'] },
    { name: 'Compression', ext: ['gz', 'bz2', 'xz', 'zst', 'lzma', 'lz', 'lzo'] },
    { name: 'Disk Images', ext: ['iso', 'dmg', 'vhd', 'vhdx', 'vdi', 'vmdk', 'qcow2', 'wim', 'img'] },
    { name: 'All Files', ext: ['*'] }
  ];

  async function _resolveDialogResult(result) {
    if (!result || result.cancelled) return null;
    let bytes, name;
    if (result.imported && result.content) {
      const b64 = result.content.split(',')[1];
      bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      name = result.path || 'file';
    } else if (result.path) {
      const raw = await Kernel32.ReadAllBytes(result.path);
      bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      name = getFileName(result.path);
    } else return null;
    return { bytes, name, path: result.path };
  }

  async function openFile() {
    const result = await ComDlg32.GetOpenFileName({
      title: 'Open Archive',
      filters: _OPEN_FILTERS
    });
    const resolved = await _resolveDialogResult(result);
    if (!resolved) return;

    currentFilePath = (result.imported) ? null : result.path;
    await openArchive(resolved.bytes, resolved.name);
  }

  async function addFiles() {
    if (!currentFormat || !currentFormatClass) {
      await newArchive();
      if (!currentFormat || !currentFormatClass) return;
    }
    if (!currentFormatClass.canCreate) {
      await User32.MessageBox(null, 'This format does not support adding files.', 'Info', 0x40);
      return;
    }

    const result = await ComDlg32.GetOpenFileName({
      title: 'Add Files to Archive',
      filters: [{ name: 'All Files', ext: ['*'] }]
    });
    const resolved = await _resolveDialogResult(result);
    if (!resolved) return;

    const name = currentPath + resolved.name;
    const data = resolved.bytes;
    const existing = entries.findIndex(e => e.name === name);
    if (existing >= 0)
      entries[existing] = makeEntry(name, data.length, data.length, new Date(), crc32Hex(data), false, false, data, currentFormat);
    else
      entries.push(makeEntry(name, data.length, data.length, new Date(), crc32Hex(data), false, false, data, currentFormat));

    dirty = true;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function deleteSelected() {
    if (!currentFormat || !currentFormatClass || !currentFormatClass.canCreate) {
      await User32.MessageBox(null, 'This format does not support deletion.', 'Info', 0x40);
      return;
    }

    const visible = getVisibleEntries();
    const toDelete = new Set();
    for (const idx of selectedIndices) {
      const entry = visible[idx];
      if (!entry) continue;
      if (entry._synthetic)
        entries = entries.filter(e => !e.name.startsWith(entry.name));
      else
        toDelete.add(entry.name);
    }

    if (toDelete.size > 0)
      entries = entries.filter(e => !toDelete.has(e.name));

    dirty = true;
    selectedIndices.clear();
    lastSelectedIndex = -1;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function extractAll() {
    if (entries.length === 0) return;

    const dataEntries = entries.filter(e => !e.isDirectory && e._data);
    if (dataEntries.length === 0) {
      await User32.MessageBox(null, 'No extractable files in archive.', 'Info', 0x40);
      return;
    }

    if (dataEntries.length === 1) {
      const e = dataEntries[0];
      const data = await resolveEntryData(e);
      if (data)
        ComDlg32.ExportFile(data, getFileName(e.name));
      return;
    }

    try {
      const zip = new JSZip();
      for (const e of dataEntries) {
        const data = await resolveEntryData(e);
        if (data) zip.file(e.name, data);
      }
      const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      const baseName = currentFileName ? stripExtension(currentFileName) : 'extracted';
      ComDlg32.ExportFile(blob, baseName + '.zip');
    } catch (e) {
      await User32.MessageBox(null, 'Failed to extract: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function extractSelected() {
    const visible = getVisibleEntries();
    const selected = [];
    for (const idx of selectedIndices) {
      const entry = visible[idx];
      if (entry && !entry.isDirectory) selected.push(entry);
    }

    if (selected.length === 0) {
      await User32.MessageBox(null, 'No files selected.', 'Info', 0x40);
      return;
    }

    if (selected.length === 1) {
      const data = await resolveEntryData(selected[0]);
      if (data)
        ComDlg32.ExportFile(data, getFileName(selected[0].name));
      return;
    }

    try {
      const zip = new JSZip();
      for (const e of selected) {
        const data = await resolveEntryData(e);
        if (data) zip.file(getFileName(e.name), data);
      }
      const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      ComDlg32.ExportFile(blob, 'selected.zip');
    } catch (e) {
      await User32.MessageBox(null, 'Failed to extract: ' + (e.message || e), 'Error', 0x10);
    }
  }

  async function resolveEntryData(entry) {
    if (!entry._data) return null;
    if (entry._data instanceof Uint8Array) return entry._data;
    if (entry._data.aesEncrypted) {
      try {
        const ae = entry._data;
        const salt = ae.aesEncrypted.slice(0, 16);
        const verification = ae.aesEncrypted.slice(16, 18);
        const encData = ae.aesEncrypted.slice(18, ae.aesEncrypted.length - 10);
        const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(ae.password), 'PBKDF2', false, ['deriveBits']);
        const derived = new Uint8Array(await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-1' }, keyMaterial, (32 + 32 + 2) * 8
        ));
        const aesKey = derived.slice(0, 32);
        if (derived[64] !== verification[0] || derived[65] !== verification[1]) return null;
        const cryptoKey = await crypto.subtle.importKey('raw', aesKey, 'AES-CTR', false, ['decrypt']);
        const counter = new Uint8Array(16);
        counter[0] = 1;
        const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CTR', counter, length: 128 }, cryptoKey, encData));
        const result = ae.size && ae.size !== decrypted.length ? await decompressDeflateRaw(decrypted) : decrypted;
        entry._data = result;
        return result;
      } catch (_) {
        return null;
      }
    }
    if (entry._data.deflated) {
      try {
        const decompressed = await decompressDeflateRaw(entry._data.deflated);
        entry._data = decompressed;
        return decompressed;
      } catch (_) {
        return null;
      }
    }
    if (entry._data.async) {
      try {
        const data = await entry._data.async('uint8array');
        entry._data = data;
        return data;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  async function testArchive() {
    if (entries.length === 0) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    let ok = 0;
    let fail = 0;
    let skip = 0;
    for (const e of entries) {
      if (e.isDirectory) continue;
      if (!e._data) { ++skip; continue; }
      try {
        const data = await resolveEntryData(e);
        if (data) {
          if (e.crc) {
            const check = crc32Hex(data);
            if (check === e.crc) ++ok;
            else ++fail;
          } else
            ++ok;
        } else
          ++skip;
      } catch (_) {
        ++fail;
      }
    }

    await User32.MessageBox(null,
      'Test complete.\n\nOK: ' + ok + '\nFailed: ' + fail + '\nSkipped: ' + skip,
      'Test Results', fail > 0 ? 0x30 : 0x40);
  }

  async function showInfo() {
    if (!currentFormatClass) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    const fileCount = entries.filter(e => !e.isDirectory).length;
    const dirCount = entries.filter(e => e.isDirectory).length;
    const totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
    const totalPacked = entries.reduce((s, e) => s + (e.packed || 0), 0);
    const ratioNum = totalSize > 0 ? Math.round((totalPacked / totalSize) * 100) : 0;
    const ratioStr = totalSize > 0 ? ratioNum + '%' : 'N/A';
    const hasEncrypted = entries.some(e => e.encrypted);
    const archiveSize = archiveBytes ? archiveBytes.length : totalPacked;

    document.getElementById('dlg-info-title').textContent = escapeHtml(currentFileName || 'Untitled');
    document.getElementById('info-format-name').textContent = currentFormatClass.displayName;

    const hostOs = _detectHostOs();
    document.getElementById('info-grid-general').innerHTML =
      _infoRow('Host OS', hostOs) +
      _infoRow('Total files', fileCount.toLocaleString()) +
      _infoRow('Total folders', dirCount.toLocaleString());

    document.getElementById('info-grid-sizes').innerHTML =
      _infoRow('Total size', totalSize.toLocaleString() + ' bytes') +
      _infoRow('Packed size', totalPacked.toLocaleString() + ' bytes') +
      _infoRow('Archive size', archiveSize.toLocaleString() + ' bytes') +
      _infoRow('Ratio', ratioStr);

    const method = _detectMethod();
    const dictSize = _detectDictionary();
    const solid = _detectSolid();
    document.getElementById('info-grid-details').innerHTML =
      _infoRow('Compression', method) +
      _infoRow('Dictionary size', dictSize) +
      _infoRow('Solid archive', solid) +
      _infoRow('Recovery record', _detectRecovery()) +
      _infoRow('Writable', currentFormatClass.canCreate ? 'Yes' : 'Read-only');

    document.getElementById('info-grid-security').innerHTML =
      _infoRow('Encryption', hasEncrypted || archivePassword ? 'Yes' : 'Absent') +
      _infoRow('Passwords', archivePassword ? 'Set' : 'Absent') +
      _infoRow('Header encryption', archiveOptions.encryptNames ? 'Yes' : 'Absent');

    const fillPct = Math.min(100, Math.max(0, ratioNum));
    document.getElementById('info-quader-fill').style.height = fillPct + '%';
    document.getElementById('info-quader-side-fill').style.height = fillPct + '%';
    document.getElementById('info-quader-label').textContent = ratioStr;

    const optsGrid = document.getElementById('info-grid-options');
    let optsHtml = '';
    if (archiveOptions && Object.keys(archiveOptions).length > 0)
      for (const [k, v] of Object.entries(archiveOptions))
        optsHtml += _infoRow(k, String(v));
    else
      optsHtml = '<dt>-</dt><dd>No format options set</dd>';
    optsGrid.innerHTML = optsHtml;

    document.getElementById('info-comment').value = '';

    const tabs = document.querySelectorAll('#dlg-info .info-tab');
    const panels = document.querySelectorAll('#dlg-info .info-tab-panel');
    for (const tab of tabs) {
      tab.onclick = () => {
        for (const t of tabs) t.classList.remove('active');
        for (const p of panels) p.classList.remove('active');
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      };
    }
    tabs[0].click();

    await showDialog('dlg-info');
  }

  function _infoRow(label, value) {
    return '<dt>' + escapeHtml(label) + ':</dt><dd>' + escapeHtml(String(value)) + '</dd>';
  }

  function _detectHostOs() {
    if (!archiveBytes || archiveBytes.length < 10) return 'Unknown';
    const fmtId = currentFormatClass ? currentFormatClass.id : '';
    if (fmtId === 'zip' || fmtId === 'jar' || fmtId === 'apk' || fmtId === 'epub' || fmtId === 'ooxml' || fmtId === 'odf' || fmtId === 'zipx')
      return 'FAT/Windows';
    if (fmtId === 'rar') return 'Windows';
    if (fmtId === '7z') return 'Windows';
    if (fmtId === 'tar' || fmtId === 'targz' || fmtId === 'tarbz2' || fmtId === 'tarxz' || fmtId === 'tarzst' || fmtId === 'tarlzma' || fmtId === 'tarlz') return 'Unix';
    if (fmtId === 'cpio' || fmtId === 'rpm' || fmtId === 'deb' || fmtId === 'ar') return 'Unix';
    if (fmtId === 'lzh' || fmtId === 'arj') return 'DOS/Windows';
    if (fmtId === 'cab' || fmtId === 'msi' || fmtId === 'chm' || fmtId === 'nsis' || fmtId === 'wim') return 'Windows';
    if (fmtId === 'dmg' || fmtId === 'hfs' || fmtId === 'apfs' || fmtId === 'sit' || fmtId === 'sitx') return 'macOS';
    if (fmtId === 'iso' || fmtId === 'udf') return 'Cross-platform';
    if (fmtId === 'squashfs' || fmtId === 'cramfs' || fmtId === 'ext') return 'Linux';
    return 'Unknown';
  }

  function _detectMethod() {
    if (archiveOptions && archiveOptions.method) {
      const m = archiveOptions.method;
      const fmtId = currentFormatClass ? currentFormatClass.id : '';
      if (fmtId === '7z') {
        const map = { store: 'Store', lzma: 'LZMA', lzma2: 'LZMA2', ppmd: 'PPMd', bzip2: 'BZip2', deflate: 'Deflate' };
        return map[m] || m;
      }
      if (fmtId === 'zip' || fmtId === 'zipx') {
        const map = { '0': 'Store', '8': 'Deflate', '9': 'Deflate64', '12': 'BZip2', '14': 'LZMA', '93': 'ZStandard', '95': 'XZ', '98': 'PPMd' };
        return map[m] || 'Method ' + m;
      }
      return m;
    }
    const fmtId = currentFormatClass ? currentFormatClass.id : '';
    if (fmtId === 'gzip' || fmtId === 'targz') return 'Deflate';
    if (fmtId === 'bzip2' || fmtId === 'tarbz2') return 'BZip2';
    if (fmtId === 'xz' || fmtId === 'tarxz' || fmtId === 'lzma' || fmtId === 'tarlzma') return 'LZMA';
    if (fmtId === 'zstd' || fmtId === 'tarzst') return 'ZStandard';
    if (fmtId === 'lzip' || fmtId === 'tarlz') return 'LZMA';
    if (fmtId === 'compress') return 'LZW';
    if (fmtId === 'lzop') return 'LZO';
    return 'Unknown';
  }

  function _detectDictionary() {
    if (archiveOptions && archiveOptions.dictionary) {
      const d = parseInt(archiveOptions.dictionary, 10);
      if (d >= 1048576) return (d / 1048576) + ' MB';
      if (d >= 1024) return (d / 1024) + ' KB';
      return d + ' bytes';
    }
    return 'Default';
  }

  function _detectSolid() {
    if (archiveOptions && archiveOptions.solid) return 'Yes';
    return 'No';
  }

  function _detectRecovery() {
    if (archiveOptions && archiveOptions.recovery) return archiveOptions.recoveryPct ? archiveOptions.recoveryPct + '%' : 'Yes';
    return 'Absent';
  }

  async function convertFormat() {
    if (entries.length === 0) {
      await User32.MessageBox(null, 'No archive loaded.', 'Info', 0x40);
      return;
    }

    populateFormatDropdown('convert-format', currentFormatClass ? currentFormatClass.id : null);
    const convertSelect = document.getElementById('convert-format');
    const initialFormat = IArchiveFormat.findById(convertSelect.value);
    if (initialFormat) buildOptionsPanel('convert-options-panel', initialFormat);

    const result = await showDialog('dlg-convert');
    if (result !== 'ok') return;

    const targetId = convertSelect.value;
    const TargetClass = IArchiveFormat.findById(targetId);
    if (!TargetClass || !TargetClass.canCreate) return;

    const opts = collectOptions('convert-options-panel');

    const resolvedEntries = [];
    for (const e of entries) {
      const data = e.isDirectory ? null : await resolveEntryData(e);
      resolvedEntries.push(makeEntry(e.name, e.size, e.size, e.modified, e.crc, e.isDirectory, false, data, null));
    }

    const handler = new TargetClass();
    currentFormat = handler;
    currentFormatClass = TargetClass;
    entries = resolvedEntries;
    for (const e of entries) e._handler = handler;
    archivePassword = null;
    archiveOptions = opts;
    currentFilePath = null;
    const baseName = currentFileName ? stripExtension(currentFileName) : 'archive';
    currentFileName = baseName + '.' + TargetClass.extensions[0];
    dirty = true;
    updateTitle();
    renderFileList();
    updateStatusBar();
  }

  async function viewFile() {
    const visible = getVisibleEntries();
    if (selectedIndices.size !== 1) return;
    const idx = [...selectedIndices][0];
    const entry = visible[idx];
    if (!entry) return;

    if (entry.isDirectory || entry._synthetic) {
      currentPath = entry.name;
      selectedIndices.clear();
      lastSelectedIndex = -1;
      renderFileList();
      updateAddressBar();
      return;
    }

    const data = await resolveEntryData(entry);
    if (data)
      ComDlg32.ExportFile(data, getFileName(entry.name));
  }

  async function showProperties() {
    const visible = getVisibleEntries();
    const selected = [];
    for (const idx of selectedIndices) {
      const entry = visible[idx];
      if (entry && !entry._synthetic) selected.push(entry);
    }
    if (selected.length === 0) return;

    const grid = document.getElementById('props-info-grid');
    const separator = document.getElementById('props-separator');
    const optionsPanel = document.getElementById('props-options-panel');
    optionsPanel.innerHTML = '';

    if (selected.length === 1) {
      const e = selected[0];
      grid.innerHTML =
        _infoRow('Name', getFileName(e.name)) +
        _infoRow('Path', e.name) +
        _infoRow('Size', (e.size != null ? e.size.toLocaleString() + ' bytes' : '')) +
        _infoRow('Packed', (e.packed != null ? e.packed.toLocaleString() + ' bytes' : '')) +
        _infoRow('CRC-32', e.crc || '') +
        _infoRow('Modified', formatDate(e.modified));
    } else {
      const totalSize = selected.reduce((s, e) => s + (e.size || 0), 0);
      grid.innerHTML =
        _infoRow('Selection', selected.length + ' files') +
        _infoRow('Total size', totalSize.toLocaleString() + ' bytes');
    }

    const methodOpt = currentFormatClass && currentFormatClass.canCreate
      ? currentFormatClass.getCreateOptions().find(o => o.id === 'method')
      : null;

    if (methodOpt) {
      separator.style.display = '';
      const row = document.createElement('div');
      row.className = 'option-row';
      const label = document.createElement('label');
      label.textContent = 'Method:';
      label.htmlFor = 'props-method';
      label.style.minWidth = '110px';
      const select = document.createElement('select');
      select.id = 'props-method';
      select.style.flex = '1';

      const defOption = document.createElement('option');
      defOption.value = '';
      defOption.textContent = 'Archive default';
      select.appendChild(defOption);

      for (const o of methodOpt.options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        select.appendChild(opt);
      }

      const allSame = selected.every(e => e._options && e._options.method != null && e._options.method === selected[0]._options.method);
      if (allSame && selected[0]._options && selected[0]._options.method != null)
        select.value = selected[0]._options.method;
      else
        select.value = '';

      row.appendChild(label);
      row.appendChild(select);
      optionsPanel.appendChild(row);
    } else
      separator.style.display = 'none';

    const result = await showDialog('dlg-properties');
    if (result !== 'ok') return;

    if (methodOpt) {
      const val = document.getElementById('props-method').value;
      for (const e of selected) {
        if (!e._options) e._options = {};
        if (val)
          e._options.method = val;
        else
          delete e._options.method;
      }
      dirty = true;
      updateTitle();
      renderFileList();
    }
  }

  // =======================================================================
  // File list rendering
  // =======================================================================

  function getVisibleEntries() {
    const result = [];
    const seenDirs = new Set();
    const prefixLen = currentPath.length;

    for (const e of entries) {
      const name = e.name;
      if (!name.startsWith(currentPath) && currentPath) continue;

      const rest = name.substring(prefixLen);
      if (!rest) continue;

      const slashIdx = rest.indexOf('/');
      if (slashIdx >= 0 && slashIdx < rest.length - 1) {
        const dirName = rest.substring(0, slashIdx + 1);
        const fullDir = currentPath + dirName;
        if (!seenDirs.has(fullDir)) {
          seenDirs.add(fullDir);
          result.push(makeEntry(fullDir, 0, 0, null, '', true, false, null, null));
          result[result.length - 1]._synthetic = true;
        }
      } else
        result.push(e);
    }

    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory)
        return a.isDirectory ? -1 : 1;
      return compareColumn(a, b, sortColumn, sortAscending);
    });

    return result;
  }

  function compareColumn(a, b, col, asc) {
    let va, vb;
    switch (col) {
      case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
      case 'size': va = a.size || 0; vb = b.size || 0; break;
      case 'packed': va = a.packed || 0; vb = b.packed || 0; break;
      case 'type': va = getFileExtension(a.name); vb = getFileExtension(b.name); break;
      case 'modified': va = a.modified ? a.modified.getTime() : 0; vb = b.modified ? b.modified.getTime() : 0; break;
      case 'crc': va = a.crc || ''; vb = b.crc || ''; break;
      case 'encrypted': va = a.encrypted ? 1 : 0; vb = b.encrypted ? 1 : 0; break;
      default: va = a.name; vb = b.name;
    }
    let cmp;
    if (typeof va === 'string')
      cmp = va.localeCompare(vb);
    else
      cmp = va - vb;
    return asc ? cmp : -cmp;
  }

  function renderFileList() {
    const visible = getVisibleEntries();
    const tbody = fileListBody;

    if (visible.length === 0 && entries.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    const rows = [];
    const prefixLen = currentPath.length;

    for (let i = 0; i < visible.length; ++i) {
      const e = visible[i];
      const displayName = e.name.substring(prefixLen).replace(/\/$/, '');
      const icon = e.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
      const selected = selectedIndices.has(i) ? ' selected' : '';

      rows.push(
        '<tr class="' + selected + '" data-idx="' + i + '">' +
        '<td class="col-name">' + icon + ' ' + escapeHtml(displayName) + '</td>' +
        '<td class="col-size">' + (e.isDirectory ? '' : formatSize(e.size)) + '</td>' +
        '<td class="col-packed">' + (e.isDirectory ? '' : formatSize(e.packed)) + '</td>' +
        '<td class="col-type">' + (e.isDirectory ? 'Folder' : getFileType(e.name)) + '</td>' +
        '<td class="col-modified">' + formatDate(e.modified) + '</td>' +
        '<td class="col-crc">' + escapeHtml(e.crc || '') + '</td>' +
        '<td class="col-encrypted">' + (e.encrypted ? '\uD83D\uDD12' : '') + '</td>' +
        '</tr>'
      );
    }

    tbody.innerHTML = rows.join('');
    updateAddressBar();
  }

  function getFileType(name) {
    const ext = getFileExtension(name);
    if (!ext) return 'File';
    return ext.toUpperCase() + ' File';
  }

  function updateAddressBar() {
    const display = '\\' + currentPath.replace(/\//g, '\\');
    addressInput.value = display;
    btnUp.classList.toggle('disabled', !currentPath);
  }

  function updateStatusBar() {
    const fileCount = entries.filter(e => !e.isDirectory).length;
    const totalSize = entries.reduce((s, e) => s + (e.size || 0), 0);
    statusCount.textContent = fileCount + (fileCount === 1 ? ' file' : ' files');
    statusSize.textContent = formatSize(totalSize);
    statusFormat.textContent = currentFormatClass ? currentFormatClass.displayName : '';
    updateSelectionStatus();
  }

  function updateSelectionStatus() {
    if (selectedIndices.size === 0)
      statusSelection.textContent = '';
    else
      statusSelection.textContent = selectedIndices.size + ' selected';
  }

  // =======================================================================
  // Navigation
  // =======================================================================

  function navigateUp() {
    if (!currentPath) return;
    const trimmed = currentPath.replace(/\/$/, '');
    const slash = trimmed.lastIndexOf('/');
    currentPath = slash >= 0 ? trimmed.substring(0, slash + 1) : '';
    selectedIndices.clear();
    lastSelectedIndex = -1;
    renderFileList();
    updateAddressBar();
  }

  // =======================================================================
  // Selection
  // =======================================================================

  function handleRowClick(e) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx, 10);

    if (e.ctrlKey) {
      if (selectedIndices.has(idx))
        selectedIndices.delete(idx);
      else
        selectedIndices.add(idx);
      lastSelectedIndex = idx;
    } else if (e.shiftKey && lastSelectedIndex >= 0) {
      const lo = Math.min(lastSelectedIndex, idx);
      const hi = Math.max(lastSelectedIndex, idx);
      for (let i = lo; i <= hi; ++i)
        selectedIndices.add(i);
    } else {
      selectedIndices.clear();
      selectedIndices.add(idx);
      lastSelectedIndex = idx;
    }

    renderFileList();
    updateSelectionStatus();
  }

  function handleRowDblClick(e) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx, 10);
    const visible = getVisibleEntries();
    const entry = visible[idx];
    if (!entry) return;

    if (entry.isDirectory || entry._synthetic) {
      currentPath = entry.name;
      selectedIndices.clear();
      lastSelectedIndex = -1;
      renderFileList();
      updateAddressBar();
    } else
      viewFile();
  }

  function selectAll() {
    const visible = getVisibleEntries();
    selectedIndices.clear();
    for (let i = 0; i < visible.length; ++i)
      selectedIndices.add(i);
    renderFileList();
    updateSelectionStatus();
  }

  // =======================================================================
  // Column sorting
  // =======================================================================

  function handleColumnClick(e) {
    const th = e.target.closest('th[data-col]');
    if (!th) return;
    const col = th.dataset.col;
    if (sortColumn === col)
      sortAscending = !sortAscending;
    else {
      sortColumn = col;
      sortAscending = true;
    }

    for (const h of document.querySelectorAll('.file-list th'))
      h.classList.remove('sort-asc', 'sort-desc');
    th.classList.add(sortAscending ? 'sort-asc' : 'sort-desc');

    renderFileList();
  }

  // =======================================================================
  // Menu system
  // =======================================================================

  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;
      if (openMenu === menuItem) {
        closeMenus();
        return;
      }
      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });

    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  // =======================================================================
  // Action dispatch
  // =======================================================================

  function handleAction(action) {
    switch (action) {
      case 'new': newArchive(); break;
      case 'open': openFile(); break;
      case 'save': saveArchive(); break;
      case 'save-as': saveArchiveAs(); break;
      case 'import':
      case 'add': addFiles(); break;
      case 'export':
      case 'extract-selected': extractSelected(); break;
      case 'extract-all': extractAll(); break;
      case 'delete': deleteSelected(); break;
      case 'view': viewFile(); break;
      case 'properties': showProperties(); break;
      case 'test': testArchive(); break;
      case 'convert': convertFormat(); break;
      case 'info': showInfo(); break;
      case 'select-all': selectAll(); break;
      case 'about': showDialog('dlg-about'); break;
      case 'exit': window.close(); break;
    }
  }

  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  for (const btn of toolbar.querySelectorAll('button[data-action]')) {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.action);
    });
  }

  // =======================================================================
  // File list events
  // =======================================================================

  fileListBody.addEventListener('click', handleRowClick);
  fileListBody.addEventListener('dblclick', handleRowDblClick);
  document.querySelector('.file-list thead').addEventListener('click', handleColumnClick);
  btnUp.addEventListener('click', navigateUp);

  // =======================================================================
  // Context menu
  // =======================================================================

  let _ctxMenu = null;

  function _dismissCtxMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  }

  fileListContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    _dismissCtxMenu();

    const tr = e.target.closest('tr[data-idx]');
    if (tr) {
      const idx = parseInt(tr.dataset.idx, 10);
      if (!selectedIndices.has(idx)) {
        selectedIndices.clear();
        selectedIndices.add(idx);
        lastSelectedIndex = idx;
        renderFileList();
        updateSelectionStatus();
      }
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const items = [
      { label: 'View', action: 'view' },
      { label: 'Extract', action: 'extract-selected' },
      { label: 'Delete', action: 'delete' },
      { sep: true },
      { label: 'Properties', action: 'properties' }
    ];

    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'menu-separator';
        menu.appendChild(sep);
      } else {
        const entry = document.createElement('div');
        entry.className = 'menu-entry';
        entry.textContent = item.label;
        entry.addEventListener('click', () => { _dismissCtxMenu(); handleAction(item.action); });
        menu.appendChild(entry);
      }
    }

    document.body.appendChild(menu);
    _ctxMenu = menu;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 2) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 2) + 'px';
  });

  document.addEventListener('pointerdown', (e) => {
    if (_ctxMenu && !_ctxMenu.contains(e.target))
      _dismissCtxMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _ctxMenu) _dismissCtxMenu();
  }, true);

  // =======================================================================
  // Keyboard shortcuts
  // =======================================================================

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('.dialog-overlay.visible')) return;

    if (e.altKey && e.key === 'Enter') { e.preventDefault(); handleAction('properties'); return; }

    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleAction('new'); return;
        case 'o': e.preventDefault(); handleAction('open'); return;
        case 's': e.preventDefault(); handleAction('save'); return;
        case 'e': e.preventDefault(); handleAction('extract-all'); return;
        case 'a': e.preventDefault(); handleAction('select-all'); return;
      }
    }

    switch (e.key) {
      case 'Insert': e.preventDefault(); handleAction('add'); return;
      case 'Delete': e.preventDefault(); handleAction('delete'); return;
      case 'Enter': e.preventDefault(); handleAction('view'); return;
      case 'Backspace': e.preventDefault(); navigateUp(); return;
    }
  });

  // =======================================================================
  // Drag and drop
  // =======================================================================

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    currentFilePath = null;
    await openArchive(bytes, file.name);
  });

  // =======================================================================
  // Dynamic options panel change handlers
  // =======================================================================

  document.getElementById('new-format').addEventListener('change', () => {
    const formatId = document.getElementById('new-format').value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (FormatClass) buildOptionsPanel('new-options-panel', FormatClass);
  });

  document.getElementById('convert-format').addEventListener('change', () => {
    const formatId = document.getElementById('convert-format').value;
    const FormatClass = IArchiveFormat.findById(formatId);
    if (FormatClass) buildOptionsPanel('convert-options-panel', FormatClass);
  });

  document.getElementById('new-recovery').addEventListener('change', () => {
    const checked = document.getElementById('new-recovery').checked;
    document.getElementById('new-recovery-pct-row').classList.toggle('hidden', !checked);
  });

  // =======================================================================
  // Init
  // =======================================================================

  (async function init() {
    updateTitle();
    renderFileList();
    updateStatusBar();

    const defaultTh = document.querySelector('.file-list th[data-col="name"]');
    if (defaultTh) defaultTh.classList.add('sort-asc');

    try {
      const cmdLine = Kernel32.GetCommandLine();
      const filePath = cmdLine && (cmdLine.file || cmdLine.path);
      if (filePath) {
        const raw = await Kernel32.ReadAllBytes(filePath);
        if (raw) {
          const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
          currentFilePath = filePath;
          const name = getFileName(filePath);
          await openArchive(bytes, name);
        }
      }
    } catch (_) {}
  })();

})();
