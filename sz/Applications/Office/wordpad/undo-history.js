;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // Undo and redo for the document. Every change to the editor is recorded,
  // whether it came from typing, a ribbon command or a tool that edits the
  // page directly, so undo restores exactly what was there before, caret
  // and selection included. Typing is grouped into words.

  const MAX_STEPS = 200;
  const TYPING_GROUP_MS = 1200;

  // characters of text from the start of root to (node, offset)
  function textOffset(root, node, offset) {
    const range = document.createRange();
    range.setStart(root, 0);
    try {
      range.setEnd(node, offset);
    } catch (_) {
      return 0;
    }
    return range.toString().length;
  }

  function pointAt(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (offset <= t.length)
        return [t, offset];
      offset -= t.length;
      last = t;
    }
    return last ? [last, last.length] : [root, root.childNodes.length];
  }

  class UndoHistory {
    #editor;
    #undo = [];
    #redo = [];
    #last;
    #restoring = false;
    #typing = false;
    #lastTypingAt = 0;
    #wordBreak = false;
    #observer;
    #onRestore;

    constructor(editor, { onRestore } = {}) {
      this.#editor = editor;
      this.#onRestore = onRestore || (() => {});
      this.#last = this.#snapshot();

      editor.addEventListener('beforeinput', (e) => {
        this.noteSelection();
        if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
          e.preventDefault();
          if (e.inputType === 'historyUndo')
            this.undo();
          else
            this.redo();
          return;
        }
        this.#typing = e.inputType === 'insertText' || e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward';
        this.#wordBreak = e.inputType === 'insertText' && /\s/.test(e.data || '');
      });
      editor.addEventListener('keydown', (e) => {
        // the browser reports selection changes late: take it as the key arrives
        this.noteSelection();
        if (!(e.ctrlKey || e.metaKey) || e.altKey)
          return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          this.undo();
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          this.redo();
        }
      }, true);
      // the caret moving elsewhere ends a typing group
      editor.addEventListener('pointerdown', () => { this.#lastTypingAt = 0; });

      document.addEventListener('selectionchange', () => this.noteSelection());

      this.#observer = new MutationObserver(() => this.#record());
      this.#observer.observe(editor, { childList: true, subtree: true, characterData: true, attributes: true });
    }

    get canUndo() { return this.#undo.length > 0; }
    get canRedo() { return this.#redo.length > 0; }

    #selection() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount)
        return null;
      const r = sel.getRangeAt(0);
      if (!this.#editor.contains(r.startContainer) || !this.#editor.contains(r.endContainer))
        return null;
      return [textOffset(this.#editor, r.startContainer, r.startOffset), textOffset(this.#editor, r.endContainer, r.endOffset)];
    }

    #snapshot() {
      return { html: this.#editor.innerHTML, sel: this.#selection() };
    }

    #record() {
      if (this.#restoring)
        return;
      const html = this.#editor.innerHTML;
      if (html === this.#last.html)
        return;
      const now = Date.now();
      const grouped = this.#typing && !this.#wordBreak && now - this.#lastTypingAt < TYPING_GROUP_MS && this.#undo.length > 0;
      if (!grouped) {
        this.#undo.push(this.#last);
        if (this.#undo.length > MAX_STEPS)
          this.#undo.shift();
      }
      this.#redo.length = 0;
      this.#lastTypingAt = this.#typing ? now : 0;
      this.#typing = false;
      this.#wordBreak = false;
      this.#last = { html, sel: this.#selection() };
    }

    // the caret moves after the mutation: keep the stored one current
    noteSelection() {
      if (this.#editor.innerHTML === this.#last.html)
        this.#last.sel = this.#selection();
    }

    #restore(state) {
      this.#restoring = true;
      this.#editor.innerHTML = state.html;
      this.#observer.takeRecords();
      this.#restoring = false;
      this.#last = { html: this.#editor.innerHTML, sel: state.sel };
      this.#lastTypingAt = 0;
      this.#editor.focus();
      if (state.sel) {
        const [sn, so] = pointAt(this.#editor, state.sel[0]);
        const [en, eo] = pointAt(this.#editor, state.sel[1]);
        const range = document.createRange();
        try {
          range.setStart(sn, so);
          range.setEnd(en, eo);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) { /* keep the caret where the browser put it */ }
      }
      this.#onRestore();
    }

    undo() {
      this.#flush();
      const state = this.#undo.pop();
      if (!state)
        return false;
      this.#redo.push(this.#snapshot());
      this.#restore(state);
      return true;
    }

    redo() {
      this.#flush();
      const state = this.#redo.pop();
      if (!state)
        return false;
      this.#undo.push(this.#snapshot());
      this.#restore(state);
      return true;
    }

    // pending observer records belong to the step before undo/redo
    #flush() {
      if (this.#observer.takeRecords().length)
        this.#record();
    }

    // a new or opened document starts a fresh history
    reset() {
      this.#observer.takeRecords();
      this.#undo.length = 0;
      this.#redo.length = 0;
      this.#last = this.#snapshot();
    }
  }

  SZ.WordPadUndoHistory = UndoHistory;
})();
