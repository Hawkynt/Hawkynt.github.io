;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  // -----------------------------------------------------------------------
  // ID generation
  // -----------------------------------------------------------------------
  let _commentIdCounter = 0;
  const _generateCommentId = () => 'comment-' + Date.now() + '-' + (++_commentIdCounter);

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let _ctx = null;
  let _panelVisible = false;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  function init(ctx) {
    _ctx = ctx;
  }

  function addComment(slideIndex, x, y, text) {
    const pres = _ctx?.getPresentation?.();
    if (!pres || slideIndex < 0 || slideIndex >= pres.slides.length)
      return null;

    const slide = pres.slides[slideIndex];
    if (!slide.comments)
      slide.comments = [];

    const comment = {
      id: _generateCommentId(),
      x: x || 0,
      y: y || 0,
      author: 'User',
      date: new Date().toISOString(),
      text: text || '',
      resolved: false
    };

    slide.comments.push(comment);
    return comment;
  }

  function deleteComment(slideIndex, commentId) {
    const pres = _ctx?.getPresentation?.();
    if (!pres || slideIndex < 0 || slideIndex >= pres.slides.length)
      return;

    const slide = pres.slides[slideIndex];
    if (!slide.comments)
      return;

    const idx = slide.comments.findIndex(c => c.id === commentId);
    if (idx >= 0)
      slide.comments.splice(idx, 1);
  }

  function toggleResolved(slideIndex, commentId) {
    const pres = _ctx?.getPresentation?.();
    if (!pres || slideIndex < 0 || slideIndex >= pres.slides.length)
      return;

    const slide = pres.slides[slideIndex];
    if (!slide.comments)
      return;

    const comment = slide.comments.find(c => c.id === commentId);
    if (comment)
      comment.resolved = !comment.resolved;
  }

  function renderCommentMarkers(canvas, slide) {
    if (!slide || !slide.comments || !slide.comments.length)
      return;

    for (let i = 0; i < slide.comments.length; ++i) {
      const c = slide.comments[i];
      const marker = document.createElement('div');
      marker.className = 'comment-marker';
      marker.style.left = c.x + 'px';
      marker.style.top = c.y + 'px';
      marker.textContent = String(i + 1);
      marker.title = c.author + ': ' + c.text;
      marker.dataset.commentId = c.id;

      if (c.resolved)
        marker.style.opacity = '0.5';

      canvas.appendChild(marker);
    }
  }

  function showCommentsPanel(slideIndex) {
    const panel = document.getElementById('comments-panel');
    if (!panel)
      return;

    _panelVisible = true;
    panel.style.display = '';

    const layout = document.getElementById('app-layout');
    if (layout)
      layout.classList.add('with-comments-panel');

    refreshCommentsPanel(slideIndex);
  }

  function hideCommentsPanel() {
    const panel = document.getElementById('comments-panel');
    if (!panel)
      return;

    _panelVisible = false;
    panel.style.display = 'none';

    const layout = document.getElementById('app-layout');
    if (layout)
      layout.classList.remove('with-comments-panel');
  }

  function toggleCommentsPanel(slideIndex) {
    if (_panelVisible)
      hideCommentsPanel();
    else
      showCommentsPanel(slideIndex);
  }

  function isPanelVisible() {
    return _panelVisible;
  }

  function refreshCommentsPanel(slideIndex) {
    if (!_panelVisible)
      return;

    const list = document.getElementById('comments-list');
    if (!list)
      return;

    list.innerHTML = '';

    const pres = _ctx?.getPresentation?.();
    if (!pres || slideIndex < 0 || slideIndex >= pres.slides.length) {
      list.innerHTML = '<div style="padding:12px;color:#999;font-size:11px;text-align:center;">No slide selected.</div>';
      return;
    }

    const slide = pres.slides[slideIndex];
    const comments = slide.comments || [];

    if (!comments.length) {
      list.innerHTML = '<div style="padding:12px;color:#999;font-size:11px;text-align:center;">No comments on this slide.</div>';
      return;
    }

    for (const c of comments) {
      const card = document.createElement('div');
      card.className = 'comment-card' + (c.resolved ? ' resolved' : '');

      const authorEl = document.createElement('div');
      authorEl.className = 'comment-author';
      authorEl.textContent = c.author || 'User';
      card.appendChild(authorEl);

      const dateEl = document.createElement('div');
      dateEl.className = 'comment-date';
      try {
        dateEl.textContent = new Date(c.date).toLocaleString();
      } catch (_e) {
        dateEl.textContent = c.date || '';
      }
      card.appendChild(dateEl);

      const textEl = document.createElement('div');
      textEl.style.marginTop = '4px';
      textEl.textContent = c.text;
      card.appendChild(textEl);

      const actions = document.createElement('div');
      actions.className = 'comment-actions';

      const resolveBtn = document.createElement('button');
      resolveBtn.textContent = c.resolved ? 'Reopen' : 'Resolve';
      resolveBtn.addEventListener('click', () => {
        toggleResolved(slideIndex, c.id);
        if (_ctx?.onCommentsChanged)
          _ctx.onCommentsChanged();
        refreshCommentsPanel(slideIndex);
      });
      actions.appendChild(resolveBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        deleteComment(slideIndex, c.id);
        if (_ctx?.onCommentsChanged)
          _ctx.onCommentsChanged();
        refreshCommentsPanel(slideIndex);
      });
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  PresentationsApp.Comments = Object.freeze({
    init,
    addComment,
    deleteComment,
    toggleResolved,
    renderCommentMarkers,
    showCommentsPanel,
    hideCommentsPanel,
    toggleCommentsPanel,
    isPanelVisible,
    refreshCommentsPanel
  });

})();
