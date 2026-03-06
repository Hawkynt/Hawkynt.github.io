;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});
  const SZ = window.SZ || {};

  let ctx;
  let spellCheckEnabled = true;
  let spellCore = null;
  let spellCheckTimer = null;
  let contextMenu = null;

  function init(c) {
    ctx = c;

    spellCore = new SZ.SpellCheckCore({
      storageKey: 'sz-wordpad-custom-dict',
      activeLanguage: 'auto'
    });

    // Disable native browser spellcheck
    ctx.editor.spellcheck = false;
    ctx.editor.setAttribute('spellcheck', 'false');

    // Create context menu
    contextMenu = document.createElement('div');
    contextMenu.className = 'popup-menu spell-context-menu';
    document.body.appendChild(contextMenu);

    // Schedule initial check
    scheduleSpellCheck();

    // Listen for input changes
    ctx.editor.addEventListener('input', scheduleSpellCheck);

    // Wire contextmenu on spell errors
    ctx.editor.addEventListener('contextmenu', onContextMenu);

    // Close context menu on outside click
    document.addEventListener('pointerdown', (e) => {
      if (contextMenu && !contextMenu.contains(e.target))
        contextMenu.classList.remove('visible');
    });

    // Wire ribbon controls
    const spellCheckBox = document.getElementById('view-spell-check');
    if (spellCheckBox) {
      spellCheckBox.checked = true;
      spellCheckBox.addEventListener('change', function() {
        spellCheckEnabled = this.checked;
        if (!spellCheckEnabled)
          clearSpellMarks();
        else
          runSpellCheck();
      });
    }

    const langSelect = document.getElementById('spell-language');
    if (langSelect) {
      langSelect.addEventListener('change', function() {
        spellCore.activeLanguage = this.value;
        if (spellCheckEnabled)
          runSpellCheck();
      });
    }
  }

  function isWordMisspelled(word) {
    return spellCore ? spellCore.isWordMisspelled(word) : false;
  }

  function runSpellCheck() {
    if (!spellCheckEnabled)
      return;
    clearSpellMarks();

    const walker = document.createTreeWalker(ctx.editor, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    const regex = /\b[a-zA-Z\u00C0-\u017F']+\b/g;

    for (const node of textNodes) {
      if (node.parentElement.closest('.spell-error, .equation, pre, code'))
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

        if (isWordMisspelled(word)) {
          hasErrors = true;
          if (start > lastIndex)
            frag.appendChild(document.createTextNode(text.substring(lastIndex, start)));

          const span = document.createElement('span');
          span.className = 'spell-error';
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

  function clearSpellMarks() {
    const marks = ctx.editor.querySelectorAll('.spell-error');
    for (const mark of marks) {
      const text = document.createTextNode(mark.textContent);
      mark.parentNode.replaceChild(text, mark);
    }
    ctx.editor.normalize();
  }

  function scheduleSpellCheck() {
    if (spellCheckTimer)
      clearTimeout(spellCheckTimer);
    spellCheckTimer = setTimeout(runSpellCheck, 800);
  }

  function onContextMenu(e) {
    const spellErr = e.target.closest('.spell-error');
    if (!spellErr)
      return;

    e.preventDefault();
    const word = spellErr.dataset.word;
    const suggestions = spellCore ? spellCore.getSuggestions(word) : [];

    contextMenu.innerHTML = '';

    if (suggestions.length) {
      for (const sug of suggestions) {
        const entry = document.createElement('div');
        entry.className = 'popup-entry spell-suggestion';
        entry.textContent = sug;
        entry.addEventListener('click', () => {
          spellErr.textContent = sug;
          const text = document.createTextNode(sug);
          spellErr.parentNode.replaceChild(text, spellErr);
          ctx.editor.normalize();
          contextMenu.classList.remove('visible');
          ctx.markDirty();
          scheduleSpellCheck();
        });
        contextMenu.appendChild(entry);
      }
    } else {
      const noSug = document.createElement('div');
      noSug.className = 'popup-entry';
      noSug.textContent = '(No suggestions)';
      noSug.style.fontStyle = 'italic';
      noSug.style.opacity = '0.6';
      contextMenu.appendChild(noSug);
    }

    const sep = document.createElement('div');
    sep.className = 'popup-separator';
    contextMenu.appendChild(sep);

    const ignoreEntry = document.createElement('div');
    ignoreEntry.className = 'popup-entry';
    ignoreEntry.textContent = 'Ignore';
    ignoreEntry.addEventListener('click', () => {
      const text = document.createTextNode(spellErr.textContent);
      spellErr.parentNode.replaceChild(text, spellErr);
      ctx.editor.normalize();
      contextMenu.classList.remove('visible');
    });
    contextMenu.appendChild(ignoreEntry);

    const addEntry = document.createElement('div');
    addEntry.className = 'popup-entry';
    addEntry.textContent = 'Add to Dictionary';
    addEntry.addEventListener('click', () => {
      spellCore.addToCustomDictionary(word);
      const text = document.createTextNode(spellErr.textContent);
      spellErr.parentNode.replaceChild(text, spellErr);
      ctx.editor.normalize();
      contextMenu.classList.remove('visible');
      scheduleSpellCheck();
    });
    contextMenu.appendChild(addEntry);

    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.add('visible');
  }

  // Grammar Check (WordPad-specific, stays local)

  function runGrammarCheck() {
    clearGrammarMarks();

    const walker = document.createTreeWalker(ctx.editor, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      if (node.parentElement.closest('.grammar-error, .spell-error, .equation, pre, code, .wp-field'))
        continue;

      const text = node.textContent;
      const issues = findGrammarIssues(text);
      if (!issues.length)
        continue;

      issues.sort((a, b) => b.start - a.start);

      const parts = [];
      const sorted = issues.slice().sort((a, b) => a.start - b.start);
      let lastIdx = 0;

      for (const issue of sorted) {
        if (issue.start > lastIdx)
          parts.push({ type: 'text', content: text.slice(lastIdx, issue.start) });
        parts.push({ type: 'error', content: text.slice(issue.start, issue.end), suggestion: issue.suggestion, message: issue.message });
        lastIdx = issue.end;
      }
      if (lastIdx < text.length)
        parts.push({ type: 'text', content: text.slice(lastIdx) });

      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (part.type === 'text') {
          frag.appendChild(document.createTextNode(part.content));
        } else {
          const span = document.createElement('span');
          span.className = 'grammar-error';
          span.textContent = part.content;
          span.dataset.suggestion = part.suggestion || '';
          span.dataset.message = part.message || '';
          span.title = part.message + (part.suggestion ? ' (Suggestion: ' + part.suggestion + ')' : '');
          frag.appendChild(span);
        }
      }

      node.parentNode.replaceChild(frag, node);
    }

    for (const err of ctx.editor.querySelectorAll('.grammar-error'))
      err.addEventListener('contextmenu', onGrammarContextMenu);
  }

  function findGrammarIssues(text) {
    const issues = [];
    let match;

    const doubleSpaceRegex = /  +/g;
    while ((match = doubleSpaceRegex.exec(text)) !== null)
      issues.push({ start: match.index, end: match.index + match[0].length, message: 'Multiple consecutive spaces', suggestion: ' ' });

    const repeatedWordRegex = /\b(\w+)\s+\1\b/gi;
    while ((match = repeatedWordRegex.exec(text)) !== null)
      issues.push({ start: match.index, end: match.index + match[0].length, message: 'Repeated word: "' + match[1] + '"', suggestion: match[1] });

    const missingCapRegex = /[.!?]\s+[a-z]/g;
    while ((match = missingCapRegex.exec(text)) !== null) {
      const letterPos = match.index + match[0].length - 1;
      issues.push({ start: letterPos, end: letterPos + 1, message: 'Sentence should start with a capital letter', suggestion: text[letterPos].toUpperCase() });
    }

    const aAnRegex = /\ba\s+([aeiou]\w*)/gi;
    while ((match = aAnRegex.exec(text)) !== null) {
      if (match[0].charAt(0) === 'a' || match[0].charAt(0) === 'A') {
        const article = match[0].charAt(0) === 'A' ? 'An' : 'an';
        issues.push({ start: match.index, end: match.index + match[0].length, message: 'Use "' + article + '" before words starting with a vowel', suggestion: article + ' ' + match[1] });
      }
    }

    // 5. Passive voice detection
    const passiveRe = /\b(is|are|was|were|be|been|being)\s+(\w+ed)\b/gi;
    let pm;
    while ((pm = passiveRe.exec(text)))
      issues.push({ start: pm.index, end: pm.index + pm[0].length, message: 'Passive voice detected', suggestion: 'Consider active voice' });

    // 6. Double negatives
    const dnRe = /\b(not|never|no)\s+\w+\s+\b(no|not|never|none|nothing|nobody|nowhere|neither)\b/gi;
    while ((pm = dnRe.exec(text)))
      issues.push({ start: pm.index, end: pm.index + pm[0].length, message: 'Double negative', suggestion: 'Use a single negative' });

    // 7. Run-on sentences (>40 words between periods)
    const sentences = text.split(/[.!?]+/);
    let sOff = 0;
    for (const s of sentences) {
      const wc = s.trim().split(/\s+/).filter(w => w).length;
      if (wc > 40)
        issues.push({ start: sOff, end: sOff + s.length, message: 'Very long sentence (' + wc + ' words)', suggestion: 'Consider breaking into shorter sentences' });
      sOff += s.length + 1;
    }

    // 8. Commonly confused: its/it's
    const itsRe = /\bits\s+(is|has|was|will|would|could|should|can|may|might|shall)\b/gi;
    while ((pm = itsRe.exec(text)))
      issues.push({ start: pm.index, end: pm.index + 3, message: '"its" should be "it\'s" before a verb', suggestion: "it's" });

    // 9. Commonly confused: your/you're
    const yourRe = /\byour\s+(is|are|was|were|will|would|could|should|going|doing|being)\b/gi;
    while ((pm = yourRe.exec(text)))
      issues.push({ start: pm.index, end: pm.index + 4, message: '"your" should be "you\'re"', suggestion: "you're" });

    // 10. Commonly confused: then/than after comparatives
    const thenRe = /\b(more|less|better|worse|bigger|smaller|greater|fewer|higher|lower|rather)\s+then\b/gi;
    while ((pm = thenRe.exec(text)))
      issues.push({ start: pm.index + pm[1].length + 1, end: pm.index + pm[1].length + 1 + 4, message: '"then" should be "than" after comparative', suggestion: 'than' });

    // 11. Subject-verb disagreement
    const svRe1 = /\b(he|she|it)\s+(are|were|have)\b/gi;
    while ((pm = svRe1.exec(text)))
      issues.push({ start: pm.index, end: pm.index + pm[0].length, message: 'Subject-verb disagreement', suggestion: pm[1] + (pm[2].toLowerCase() === 'are' ? ' is' : pm[2].toLowerCase() === 'were' ? ' was' : ' has') });

    const svRe2 = /\b(they|we)\s+(is|was|has)\b/gi;
    while ((pm = svRe2.exec(text)))
      issues.push({ start: pm.index, end: pm.index + pm[0].length, message: 'Subject-verb disagreement', suggestion: pm[1] + (pm[2].toLowerCase() === 'is' ? ' are' : pm[2].toLowerCase() === 'was' ? ' were' : ' have') });

    // 12. Redundant phrases
    const redundant = [
      [/\bin order to\b/gi, 'to'],
      [/\bat this point in time\b/gi, 'now'],
      [/\bdue to the fact that\b/gi, 'because'],
      [/\bin the event that\b/gi, 'if'],
      [/\bfor the purpose of\b/gi, 'to'],
      [/\bin close proximity\b/gi, 'near'],
      [/\bhas the ability to\b/gi, 'can'],
      [/\buntil such time as\b/gi, 'until'],
      [/\bin spite of the fact that\b/gi, 'although'],
      [/\bon a daily basis\b/gi, 'daily']
    ];
    for (const [re, fix] of redundant)
      while ((pm = re.exec(text)))
        issues.push({ start: pm.index, end: pm.index + pm[0].length, message: 'Redundant phrase', suggestion: fix });

    // 13. "the affect" -> "the effect"
    const affectRe = /\bthe\s+affect\b/gi;
    while ((pm = affectRe.exec(text)))
      issues.push({ start: pm.index + pm[0].indexOf('a'), end: pm.index + pm[0].indexOf('a') + 6, message: '"affect" should be "effect" after article', suggestion: 'effect' });

    const filtered = [];
    for (const issue of issues) {
      const overlaps = filtered.some(f => (issue.start >= f.start && issue.start < f.end) || (issue.end > f.start && issue.end <= f.end));
      if (!overlaps)
        filtered.push(issue);
    }
    return filtered;
  }

  function onGrammarContextMenu(e) {
    const gramErr = e.target.closest('.grammar-error');
    if (!gramErr)
      return;

    e.preventDefault();
    e.stopPropagation();

    const suggestion = gramErr.dataset.suggestion;
    const message = gramErr.dataset.message;

    contextMenu.innerHTML = '';

    const msgEntry = document.createElement('div');
    msgEntry.className = 'popup-entry';
    msgEntry.textContent = message || 'Grammar issue';
    msgEntry.style.fontStyle = 'italic';
    msgEntry.style.opacity = '0.7';
    contextMenu.appendChild(msgEntry);

    if (suggestion) {
      const sep = document.createElement('div');
      sep.className = 'popup-separator';
      contextMenu.appendChild(sep);

      const sugEntry = document.createElement('div');
      sugEntry.className = 'popup-entry spell-suggestion';
      sugEntry.textContent = suggestion;
      sugEntry.style.fontWeight = 'bold';
      sugEntry.addEventListener('click', () => {
        const text = document.createTextNode(suggestion);
        gramErr.parentNode.replaceChild(text, gramErr);
        ctx.editor.normalize();
        contextMenu.classList.remove('visible');
        ctx.markDirty();
      });
      contextMenu.appendChild(sugEntry);
    }

    const sep2 = document.createElement('div');
    sep2.className = 'popup-separator';
    contextMenu.appendChild(sep2);

    const ignoreEntry = document.createElement('div');
    ignoreEntry.className = 'popup-entry';
    ignoreEntry.textContent = 'Ignore';
    ignoreEntry.addEventListener('click', () => {
      const text = document.createTextNode(gramErr.textContent);
      gramErr.parentNode.replaceChild(text, gramErr);
      ctx.editor.normalize();
      contextMenu.classList.remove('visible');
    });
    contextMenu.appendChild(ignoreEntry);

    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.add('visible');
  }

  function clearGrammarMarks() {
    const marks = ctx.editor.querySelectorAll('.grammar-error');
    for (const mark of marks) {
      const text = document.createTextNode(mark.textContent);
      mark.parentNode.replaceChild(text, mark);
    }
    ctx.editor.normalize();
  }

  WP.SpellCheck = { init, runSpellCheck, runGrammarCheck, clearSpellMarks, clearGrammarMarks, scheduleSpellCheck, isWordMisspelled };
})();
