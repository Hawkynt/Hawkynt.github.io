;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;

    document.getElementById('comment-sidebar-close').addEventListener('click', () => {
      document.getElementById('comment-sidebar').style.display = 'none';
    });

    // Show Markup toggle
    document.getElementById('view-show-markup').addEventListener('change', function() {
      _editor.classList.toggle('hide-markup', !this.checked);
    });

    // Placeholder for future insert tracking
    _editor.addEventListener('beforeinput', (e) => {
      if (!trackChangesState.enabled) return;
      if (e.inputType === 'insertText' || e.inputType === 'insertParagraph') {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel.focusNode) return;
        }, 0);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Comments
  // ═══════════════════════════════════════════════════════════════

  const commentStore = { comments: [], nextId: 1 };

  function addComment() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      alert('Select text to add a comment.');
      return;
    }
    const text = prompt('Enter comment:');
    if (!text) return;

    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'wp-comment-range';
    const id = commentStore.nextId++;
    span.dataset.commentId = id;
    range.surroundContents(span);

    commentStore.comments.push({
      id,
      parentId: null,
      author: 'User',
      timestamp: new Date().toISOString(),
      text,
      resolved: false,
      rangeId: id,
    });

    refreshCommentSidebar();
    _markDirty();
    _editor.focus();
  }

  function addReply(parentId) {
    const parent = commentStore.comments.find(c => c.id === parentId);
    if (!parent) return;

    const text = prompt('Reply to comment:');
    if (!text) return;

    const id = commentStore.nextId++;
    commentStore.comments.push({
      id,
      parentId,
      author: 'User',
      timestamp: new Date().toISOString(),
      text,
      resolved: false,
      rangeId: parent.rangeId,
    });

    refreshCommentSidebar();
    _markDirty();
  }

  function deleteCurrentComment() {
    const sel = window.getSelection();
    if (!sel.focusNode) return;
    let node = sel.focusNode;
    if (node.nodeType === 3) node = node.parentElement;
    const span = node.closest('.wp-comment-range');
    if (!span) return;
    const id = parseInt(span.dataset.commentId, 10);
    commentStore.comments = commentStore.comments.filter(c => c.id !== id);
    while (span.firstChild)
      span.parentNode.insertBefore(span.firstChild, span);
    span.remove();
    refreshCommentSidebar();
    _markDirty();
  }

  function navigateComment(dir) {
    const spans = [..._editor.querySelectorAll('.wp-comment-range')];
    if (!spans.length) return;
    const sel = window.getSelection();
    let currentIdx = -1;
    if (sel.focusNode) {
      let node = sel.focusNode;
      if (node.nodeType === 3) node = node.parentElement;
      const current = node.closest('.wp-comment-range');
      if (current) currentIdx = spans.indexOf(current);
    }
    let nextIdx = currentIdx + dir;
    if (nextIdx < 0) nextIdx = spans.length - 1;
    if (nextIdx >= spans.length) nextIdx = 0;
    spans[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    const range = document.createRange();
    range.selectNodeContents(spans[nextIdx]);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function toggleCommentsSidebar() {
    const sidebar = document.getElementById('comment-sidebar');
    const isVisible = sidebar.style.display !== 'none';
    sidebar.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) refreshCommentSidebar();
  }

  function buildCommentCard(comment, isReply) {
    const card = document.createElement('div');
    card.className = 'comment-card' + (comment.resolved ? ' resolved' : '') + (isReply ? ' wp-comment-reply' : '');
    const time = new Date(comment.timestamp);
    const timeStr = time.toLocaleDateString() + ' ' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    card.innerHTML = '<div class="comment-card-header">'
      + '<span class="comment-card-author">' + _escapeHtml(comment.author) + '</span>'
      + '<span class="comment-card-time">' + _escapeHtml(timeStr) + '</span>'
      + '</div>'
      + '<div class="comment-card-text">' + _escapeHtml(comment.text) + '</div>'
      + '<div class="comment-card-actions">'
      + '<button data-caction="resolve" data-cid="' + comment.id + '">' + (comment.resolved ? 'Unresolve' : 'Resolve') + '</button>'
      + '<button data-caction="delete" data-cid="' + comment.id + '">Delete</button>'
      + '<button data-caction="goto" data-cid="' + comment.id + '">Go to</button>'
      + (isReply ? '' : '<button class="wp-comment-reply-btn" data-caction="reply" data-cid="' + comment.id + '">Reply</button>')
      + '</div>';
    return card;
  }

  function refreshCommentSidebar() {
    const body = document.getElementById('comment-sidebar-body');
    body.innerHTML = '';

    // Separate top-level comments from replies
    const topLevel = commentStore.comments.filter(c => !c.parentId);
    const replies = commentStore.comments.filter(c => c.parentId);

    for (const comment of topLevel) {
      body.appendChild(buildCommentCard(comment, false));

      // Add replies for this comment
      const commentReplies = replies.filter(r => r.parentId === comment.id);
      for (const reply of commentReplies)
        body.appendChild(buildCommentCard(reply, true));
    }

    if (!commentStore.comments.length)
      body.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-size:10px;">No comments.</div>';

    for (const btn of body.querySelectorAll('button[data-caction]')) {
      btn.addEventListener('click', () => {
        const action = btn.dataset.caction;
        const id = parseInt(btn.dataset.cid, 10);
        if (action === 'resolve') {
          const c = commentStore.comments.find(c => c.id === id);
          if (c) c.resolved = !c.resolved;
          refreshCommentSidebar();
        } else if (action === 'delete') {
          // Also delete child replies
          commentStore.comments = commentStore.comments.filter(c => c.id !== id && c.parentId !== id);
          const span = _editor.querySelector('.wp-comment-range[data-comment-id="' + id + '"]');
          if (span) {
            while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
            span.remove();
          }
          refreshCommentSidebar();
          _markDirty();
        } else if (action === 'goto') {
          const c = commentStore.comments.find(c => c.id === id);
          const rangeId = c ? (c.rangeId || c.id) : id;
          const span = _editor.querySelector('.wp-comment-range[data-comment-id="' + rangeId + '"]');
          if (span) span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (action === 'reply') {
          addReply(id);
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Track Changes
  // ═══════════════════════════════════════════════════════════════

  const trackChangesState = { enabled: false, author: 'User', changes: [], nextId: 1 };

  function toggleTrackChanges() {
    trackChangesState.enabled = !trackChangesState.enabled;
    const btn = document.getElementById('btn-track-changes');
    if (btn)
      btn.classList.toggle('active', trackChangesState.enabled);

    if (trackChangesState.enabled)
      startTrackingChanges();
    else
      stopTrackingChanges();
  }

  function startTrackingChanges() {
    _editor.addEventListener('keydown', trackChangesKeyDown, true);
  }

  function stopTrackingChanges() {
    _editor.removeEventListener('keydown', trackChangesKeyDown, true);
  }

  function trackChangesKeyDown(e) {
    if (!trackChangesState.enabled) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);

      if (!range.collapsed) {
        e.preventDefault();
        const span = document.createElement('span');
        span.className = 'wp-tc-delete';
        const id = trackChangesState.nextId++;
        span.dataset.changeId = id;
        range.surroundContents(span);
        trackChangesState.changes.push({
          id,
          type: 'deletion',
          author: trackChangesState.author,
          timestamp: new Date().toISOString(),
          rangeId: id,
        });
        sel.collapseToEnd();
        _markDirty();
      }
    }
  }

  function acceptChange(id) {
    const change = trackChangesState.changes.find(c => c.id === id);
    if (!change) return;
    const span = _editor.querySelector('[data-change-id="' + id + '"]');
    if (!span) return;

    if (change.type === 'insertion') {
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.remove();
    } else if (change.type === 'deletion')
      span.remove();

    trackChangesState.changes = trackChangesState.changes.filter(c => c.id !== id);
    _markDirty();
  }

  function rejectChange(id) {
    const change = trackChangesState.changes.find(c => c.id === id);
    if (!change) return;
    const span = _editor.querySelector('[data-change-id="' + id + '"]');
    if (!span) return;

    if (change.type === 'insertion')
      span.remove();
    else if (change.type === 'deletion') {
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.remove();
    }

    trackChangesState.changes = trackChangesState.changes.filter(c => c.id !== id);
    _markDirty();
  }

  function acceptCurrentChange() {
    const sel = window.getSelection();
    if (!sel.focusNode) return;
    let node = sel.focusNode;
    if (node.nodeType === 3) node = node.parentElement;
    const span = node.closest('.wp-tc-insert, .wp-tc-delete');
    if (span) acceptChange(parseInt(span.dataset.changeId, 10));
  }

  function rejectCurrentChange() {
    const sel = window.getSelection();
    if (!sel.focusNode) return;
    let node = sel.focusNode;
    if (node.nodeType === 3) node = node.parentElement;
    const span = node.closest('.wp-tc-insert, .wp-tc-delete');
    if (span) rejectChange(parseInt(span.dataset.changeId, 10));
  }

  function acceptAllChanges() {
    const ids = trackChangesState.changes.map(c => c.id);
    for (const id of ids) acceptChange(id);
  }

  function rejectAllChanges() {
    const ids = trackChangesState.changes.map(c => c.id);
    for (const id of ids) rejectChange(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // Import from DOCX
  // ═══════════════════════════════════════════════════════════════

  function importComments(commentData) {
    if (!commentData || !commentData.length) return;
    commentStore.comments = [];
    let maxId = 0;
    for (const c of commentData) {
      commentStore.comments.push({
        id: c.id,
        parentId: c.parentId || null,
        author: c.author || 'Unknown',
        timestamp: c.timestamp || new Date().toISOString(),
        text: c.text || '',
        resolved: !!c.resolved,
        rangeId: c.rangeId || c.id,
      });
      if (c.id > maxId) maxId = c.id;
    }
    commentStore.nextId = maxId + 1;
    refreshCommentSidebar();
  }

  function importTrackChanges(changeData) {
    if (!changeData || !changeData.length) return;
    trackChangesState.changes = [];
    let maxId = 0;
    for (const tc of changeData) {
      trackChangesState.changes.push({
        id: tc.id,
        type: tc.type || 'insertion',
        author: tc.author || 'Unknown',
        timestamp: tc.timestamp || new Date().toISOString(),
        rangeId: tc.rangeId || tc.id,
      });
      if (tc.id > maxId) maxId = tc.id;
    }
    trackChangesState.nextId = maxId + 1;
  }

  WP.CommentsTracking = {
    init,
    addComment,
    deleteCurrentComment,
    navigateComment,
    toggleTrackChanges,
    acceptCurrentChange,
    rejectCurrentChange,
    acceptAllChanges,
    rejectAllChanges,
    toggleCommentsSidebar,
    refreshCommentSidebar,
    importComments,
    importTrackChanges,
    _getCommentStore: () => commentStore,
    _getTrackChangesState: () => trackChangesState,
  };
})();
