;(function() {
  'use strict';
  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});
  const SZ = window.SZ || {};

  let _ctx = null;
  let _spellCore = null;
  let _contextMenu = null;

  function init(ctx) {
    _ctx = ctx;

    _spellCore = new SZ.SpellCheckCore({
      storageKey: 'sz-presentations-custom-dict',
      activeLanguage: 'auto'
    });

    _contextMenu = document.createElement('div');
    _contextMenu.className = 'pp-spell-context-menu';
    _contextMenu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ccc;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:4px 0;min-width:140px;z-index:6000;display:none;font-size:12px;';
    document.body.appendChild(_contextMenu);

    document.addEventListener('pointerdown', (e) => {
      if (_contextMenu && !_contextMenu.contains(e.target))
        _contextMenu.style.display = 'none';
    });
  }

  function runSpellCheck(slide) {
    if (!slide || !_spellCore || !_spellCore.hasDictionary)
      return [];

    const results = [];

    for (const el of slide.elements) {
      if (el.type !== 'textbox')
        continue;

      const plainText = (el.content || '').replace(/<[^>]*>/g, '');
      const regex = /\b[a-zA-Z\u00C0-\u017F']+\b/g;
      let match;
      while ((match = regex.exec(plainText)) !== null) {
        if (_spellCore.isWordMisspelled(match[0]))
          results.push({ elementId: el.id, word: match[0], index: match.index });
      }
    }

    return results;
  }

  function clearSpellMarks(container) {
    if (!container)
      return;
    const marks = container.querySelectorAll('.pp-spell-error');
    for (const mark of marks) {
      const text = document.createTextNode(mark.textContent);
      mark.parentNode.replaceChild(text, mark);
    }
  }

  function markSpellErrors(domEl, element) {
    if (!element || element.type !== 'textbox' || !_spellCore || !_spellCore.hasDictionary)
      return;

    const inner = domEl.querySelector('[contenteditable]') || domEl.querySelector('div');
    if (!inner)
      return;

    const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    const regex = /\b[a-zA-Z\u00C0-\u017F']+\b/g;

    for (const node of textNodes) {
      if (node.parentElement.closest('.pp-spell-error'))
        continue;

      const text = node.textContent;
      const matches = [...text.matchAll(regex)];
      if (!matches.length)
        continue;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let hasErrors = false;

      for (const match of matches) {
        const word = match[0];
        const start = match.index;

        if (_spellCore.isWordMisspelled(word)) {
          hasErrors = true;
          if (start > lastIndex)
            frag.appendChild(document.createTextNode(text.substring(lastIndex, start)));

          const span = document.createElement('span');
          span.className = 'pp-spell-error';
          span.dataset.word = word;
          span.textContent = word;
          frag.appendChild(span);
          lastIndex = start + word.length;
        }
      }

      if (hasErrors) {
        if (lastIndex < text.length)
          frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  }

  function showContextMenu(e, domEl, element, onReplace) {
    const spellErr = e.target.closest('.pp-spell-error');
    if (!spellErr || !_contextMenu)
      return false;

    e.preventDefault();
    const word = spellErr.dataset.word;
    const suggestions = _spellCore ? _spellCore.getSuggestions(word) : [];

    _contextMenu.innerHTML = '';

    if (suggestions.length) {
      for (const sug of suggestions) {
        const entry = document.createElement('div');
        entry.style.cssText = 'padding:6px 16px;cursor:pointer;';
        entry.textContent = sug;
        entry.addEventListener('pointerenter', () => { entry.style.background = '#0078d4'; entry.style.color = '#fff'; });
        entry.addEventListener('pointerleave', () => { entry.style.background = ''; entry.style.color = ''; });
        entry.addEventListener('click', () => {
          spellErr.textContent = sug;
          const text = document.createTextNode(sug);
          spellErr.parentNode.replaceChild(text, spellErr);
          _contextMenu.style.display = 'none';
          if (onReplace)
            onReplace();
        });
        _contextMenu.appendChild(entry);
      }
    } else {
      const noSug = document.createElement('div');
      noSug.style.cssText = 'padding:6px 16px;font-style:italic;opacity:0.6;';
      noSug.textContent = '(No suggestions)';
      _contextMenu.appendChild(noSug);
    }

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#e0e0e0;margin:4px 0;';
    _contextMenu.appendChild(sep);

    const ignoreEntry = document.createElement('div');
    ignoreEntry.style.cssText = 'padding:6px 16px;cursor:pointer;';
    ignoreEntry.textContent = 'Ignore';
    ignoreEntry.addEventListener('pointerenter', () => { ignoreEntry.style.background = '#0078d4'; ignoreEntry.style.color = '#fff'; });
    ignoreEntry.addEventListener('pointerleave', () => { ignoreEntry.style.background = ''; ignoreEntry.style.color = ''; });
    ignoreEntry.addEventListener('click', () => {
      const text = document.createTextNode(spellErr.textContent);
      spellErr.parentNode.replaceChild(text, spellErr);
      _contextMenu.style.display = 'none';
    });
    _contextMenu.appendChild(ignoreEntry);

    const addEntry = document.createElement('div');
    addEntry.style.cssText = 'padding:6px 16px;cursor:pointer;';
    addEntry.textContent = 'Add to Dictionary';
    addEntry.addEventListener('pointerenter', () => { addEntry.style.background = '#0078d4'; addEntry.style.color = '#fff'; });
    addEntry.addEventListener('pointerleave', () => { addEntry.style.background = ''; addEntry.style.color = ''; });
    addEntry.addEventListener('click', () => {
      _spellCore.addToCustomDictionary(word);
      const text = document.createTextNode(spellErr.textContent);
      spellErr.parentNode.replaceChild(text, spellErr);
      _contextMenu.style.display = 'none';
      if (onReplace)
        onReplace();
    });
    _contextMenu.appendChild(addEntry);

    _contextMenu.style.left = e.clientX + 'px';
    _contextMenu.style.top = e.clientY + 'px';
    _contextMenu.style.display = 'block';
    return true;
  }

  PresentationsApp.SpellCheck = {
    init,
    runSpellCheck,
    clearSpellMarks,
    markSpellErrors,
    showContextMenu
  };
})();
