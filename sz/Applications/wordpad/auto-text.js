;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;
  const STORAGE_KEY = 'sz-wordpad-building-blocks';
  let blocks = {};

  // Built-in blocks
  const BUILTIN_BLOCKS = {
    'Confidential Header': '<div style="text-align:center;padding:8px;border-bottom:2px solid #c00;margin-bottom:12px;"><span style="color:#c00;font-weight:bold;font-size:14pt;">CONFIDENTIAL</span><br><span style="font-size:9pt;color:#666;">This document contains proprietary information. Unauthorized distribution is prohibited.</span></div>',
    'Meeting Notes Template': '<h2>Meeting Notes</h2><p><strong>Date:</strong> [Date]</p><p><strong>Attendees:</strong> [Names]</p><p><strong>Location:</strong> [Location]</p><hr><h3>Agenda</h3><ol><li>[Agenda item 1]</li><li>[Agenda item 2]</li><li>[Agenda item 3]</li></ol><h3>Discussion</h3><p>[Notes]</p><h3>Action Items</h3><table><tr><th>Action</th><th>Owner</th><th>Due Date</th></tr><tr><td>[Action 1]</td><td>[Owner]</td><td>[Date]</td></tr><tr><td>[Action 2]</td><td>[Owner]</td><td>[Date]</td></tr></table><h3>Next Meeting</h3><p>[Date and time]</p>',
    'Professional Letter Header': '<div style="margin-bottom:24px;"><p style="font-size:14pt;font-weight:bold;margin-bottom:2px;">[Your Name]</p><p style="font-size:10pt;color:#555;margin-bottom:0;">[Your Address]</p><p style="font-size:10pt;color:#555;margin-bottom:0;">[City, State ZIP]</p><p style="font-size:10pt;color:#555;margin-bottom:0;">[Phone] | [Email]</p><hr style="margin-top:12px;"></div><p style="margin-bottom:24px;">[Date]</p><p>[Recipient Name]<br>[Recipient Title]<br>[Company]<br>[Address]<br>[City, State ZIP]</p><p>Dear [Recipient Name],</p>'
  };

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;

    // Load blocks from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved)
        blocks = JSON.parse(saved);
    } catch (e) { /* ignore */ }

    wireQuickPartsMenu();
  }

  function saveBlocks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
    } catch (e) { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // Block Operations
  // ═══════════════════════════════════════════════════════════════

  function saveBlock(name, html) {
    if (!name || !html)
      return false;
    blocks[name] = html;
    saveBlocks();
    return true;
  }

  function insertBlock(name) {
    // Check built-in first, then user blocks
    const html = BUILTIN_BLOCKS[name] || blocks[name];
    if (!html) {
      alert('Building block "' + name + '" not found.');
      return;
    }

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild)
        frag.appendChild(temp.firstChild);
      range.insertNode(frag);
    } else {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      while (temp.firstChild)
        _editor.appendChild(temp.firstChild);
    }

    _markDirty();
    _editor.focus();
  }

  function getBlocks() {
    const all = {};
    // Built-in blocks first
    for (const [name, html] of Object.entries(BUILTIN_BLOCKS))
      all[name] = { html, builtin: true };
    // User blocks
    for (const [name, html] of Object.entries(blocks))
      all[name] = { html, builtin: false };
    return all;
  }

  function deleteBlock(name) {
    if (BUILTIN_BLOCKS[name])
      return false; // Cannot delete built-in blocks
    if (!blocks[name])
      return false;
    delete blocks[name];
    saveBlocks();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Quick Parts Menu
  // ═══════════════════════════════════════════════════════════════

  function wireQuickPartsMenu() {
    refreshQuickPartsList();
  }

  function refreshQuickPartsList() {
    const list = document.getElementById('quick-parts-list');
    if (!list)
      return;
    list.innerHTML = '';

    // Built-in blocks
    for (const name of Object.keys(BUILTIN_BLOCKS)) {
      const item = document.createElement('div');
      item.className = 'wp-quick-part-item';
      item.innerHTML = '<span>' + _escapeHtml(name) + '</span><span class="wp-quick-part-preview">(Built-in)</span>';
      item.addEventListener('click', () => {
        insertBlock(name);
        closeAllDropdowns();
      });
      list.appendChild(item);
    }

    // User blocks
    for (const name of Object.keys(blocks)) {
      const item = document.createElement('div');
      item.className = 'wp-quick-part-item';
      const preview = blocks[name].replace(/<[^>]+>/g, '').slice(0, 40);
      item.innerHTML = '<span>' + _escapeHtml(name) + '</span><span class="wp-quick-part-preview">' + _escapeHtml(preview) + '</span>';
      item.addEventListener('click', () => {
        insertBlock(name);
        closeAllDropdowns();
      });
      list.appendChild(item);
    }

    if (!Object.keys(blocks).length && !Object.keys(BUILTIN_BLOCKS).length)
      list.innerHTML = '<div style="padding:6px 12px;color:#999;font-size:10px;">No building blocks.</div>';
  }

  function closeAllDropdowns() {
    for (const dd of document.querySelectorAll('.rb-dropdown.open'))
      dd.classList.remove('open');
  }

  function saveSelectionToQuickParts() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      alert('Select content to save as a Quick Part.');
      return;
    }

    const name = prompt('Enter a name for this Quick Part:');
    if (!name)
      return;

    const range = sel.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    const html = container.innerHTML;

    if (saveBlock(name, html)) {
      refreshQuickPartsList();
      alert('Quick Part "' + name + '" saved.');
    }
  }

  function showManageBuildingBlocks() {
    const allBlocks = getBlocks();
    let msg = 'Building Blocks:\n\n';
    const names = Object.keys(allBlocks);

    if (!names.length) {
      alert('No building blocks defined.');
      return;
    }

    for (let i = 0; i < names.length; ++i) {
      const entry = allBlocks[names[i]];
      msg += (i + 1) + '. ' + names[i] + (entry.builtin ? ' (Built-in)' : ' (User)') + '\n';
    }

    msg += '\nEnter number to delete (user blocks only), or press Cancel:';
    const input = prompt(msg);
    if (!input)
      return;

    const idx = parseInt(input, 10) - 1;
    if (idx >= 0 && idx < names.length) {
      const name = names[idx];
      if (allBlocks[name].builtin) {
        alert('Cannot delete built-in blocks.');
        return;
      }
      if (deleteBlock(name)) {
        refreshQuickPartsList();
        alert('Block "' + name + '" deleted.');
      }
    }
  }

  function showQuickPartsMenu() {
    refreshQuickPartsList();
    const dropdown = document.getElementById('quick-parts-menu');
    if (dropdown) {
      const parent = dropdown.closest('.rb-dropdown');
      if (parent)
        parent.classList.toggle('open');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  WP.AutoText = {
    init,
    saveBlock,
    insertBlock,
    getBlocks,
    deleteBlock,
    showQuickPartsMenu,
    saveSelectionToQuickParts,
    showManageBuildingBlocks,
    refreshQuickPartsList
  };
})();
