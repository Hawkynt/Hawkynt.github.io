;(function() {
  'use strict';

  const { User32, Kernel32 } = SZ.Dlls;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const STORAGE_KEY = 'sz-browser-bookmarks';
  const HOME_URL = 'about:home';
  const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
  const DIRECT_LOAD_TIMEOUT_MS = 3000;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const historyStack = [];
  let historyIndex = -1;
  let currentUrl = HOME_URL;
  let isLoading = false;
  let isProxyMode = false;
  let activeLoadAbort = null;
  let bookmarks = [];
  let contextTarget = null;

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnHome = document.getElementById('btn-home');
  const btnStop = document.getElementById('btn-stop');
  const urlInput = document.getElementById('url-input');
  const btnGo = document.getElementById('btn-go');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const newtabPage = document.getElementById('newtab-page');
  const browserIframe = document.getElementById('browser-iframe');
  const statusText = document.getElementById('status-text');
  const statusUrl = document.getElementById('status-url');
  const newtabUrlInput = document.getElementById('newtab-url-input');
  const newtabGoBtn = document.getElementById('newtab-go-btn');
  const newtabTiles = document.getElementById('newtab-tiles');
  const contextMenu = document.getElementById('bookmark-context-menu');
  const proxyInfoBar = document.getElementById('proxy-info-bar');
  const proxyDismissBtn = document.getElementById('proxy-dismiss-btn');

  proxyDismissBtn.addEventListener('click', () => {
    proxyInfoBar.classList.remove('visible');
  });

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle(pageTitle) {
    const title = (pageTitle || 'New Tab') + ' - Web Browser';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Bookmark persistence
  // -----------------------------------------------------------------------
  function loadBookmarks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
          bookmarks = parsed;
      }
    } catch (_) {
      bookmarks = [];
    }
  }

  function saveBookmarks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (_) {}
  }

  function renderBookmarksBar() {
    const existing = bookmarksBar.querySelectorAll('.bookmark-btn');
    for (const el of existing)
      el.remove();

    for (let i = 0; i < bookmarks.length; ++i) {
      const bm = bookmarks[i];
      const btn = document.createElement('button');
      btn.className = 'bookmark-btn';
      btn.textContent = bm.title || bm.url;
      btn.title = bm.url;
      btn.dataset.index = String(i);

      btn.addEventListener('click', () => {
        navigateTo(bm.url);
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        contextTarget = i;
        showContextMenu(e.clientX, e.clientY);
      });

      bookmarksBar.appendChild(btn);
    }
  }

  // -----------------------------------------------------------------------
  // Context menu for bookmarks
  // -----------------------------------------------------------------------
  function showContextMenu(x, y) {
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('visible');
  }

  function hideContextMenu() {
    contextMenu.classList.remove('visible');
    contextTarget = null;
  }

  document.addEventListener('pointerdown', (e) => {
    if (!contextMenu.contains(e.target))
      hideContextMenu();
  });

  for (const entry of contextMenu.querySelectorAll('.ctx-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.ctxAction;
      if (action === 'open-bookmark' && contextTarget !== null)
        navigateTo(bookmarks[contextTarget].url);
      else if (action === 'delete-bookmark' && contextTarget !== null) {
        bookmarks.splice(contextTarget, 1);
        saveBookmarks();
        renderBookmarksBar();
      }
      hideContextMenu();
    });
  }

  // -----------------------------------------------------------------------
  // Navigation history
  // -----------------------------------------------------------------------
  function updateNavButtons() {
    btnBack.classList.toggle('disabled', historyIndex <= 0);
    btnForward.classList.toggle('disabled', historyIndex >= historyStack.length - 1);
  }

  function pushHistory(url) {
    if (historyIndex < historyStack.length - 1)
      historyStack.length = historyIndex + 1;
    historyStack.push(url);
    historyIndex = historyStack.length - 1;
    updateNavButtons();
  }

  function goBack() {
    if (historyIndex <= 0)
      return;
    --historyIndex;
    loadUrl(historyStack[historyIndex], false);
    updateNavButtons();
  }

  function goForward() {
    if (historyIndex >= historyStack.length - 1)
      return;
    ++historyIndex;
    loadUrl(historyStack[historyIndex], false);
    updateNavButtons();
  }

  // -----------------------------------------------------------------------
  // URL normalization
  // -----------------------------------------------------------------------
  function normalizeUrl(raw) {
    let url = raw.trim();
    if (!url)
      return '';
    if (url === 'about:home' || url === 'about:blank')
      return url;
    if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url))
      url = 'https://' + url;
    return url;
  }

  // -----------------------------------------------------------------------
  // Core navigation
  // -----------------------------------------------------------------------
  function navigateTo(raw) {
    const url = normalizeUrl(raw);
    if (!url)
      return;
    pushHistory(url);
    loadUrl(url, false);
  }

  function showErrorPage(url, reason) {
    const safeUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const hrefUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html><html><head><style>
      body { font-family: Tahoma, Verdana, sans-serif; background: #fff; color: #333; padding: 40px; }
      h2 { color: #c00; margin-bottom: 8px; }
      p { line-height: 1.6; }
      a { color: #0066cc; }
      .url { word-break: break-all; font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 2px; }
      .btn { display: inline-block; margin-top: 12px; padding: 6px 16px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 3px; cursor: pointer; border: none; font-size: 12px; }
      .btn:hover { background: #0055aa; }
    </style></head><body>
      <h2>This page can&rsquo;t be displayed</h2>
      <p>${reason}</p>
      <p>Address: <span class="url">${safeUrl}</span></p>
      <p style="margin-top:16px; font-size: 11px; color: #666;">
        The website refused the connection or is unreachable.<br>
        Both direct loading and proxy loading were attempted.
      </p>
      <a class="btn" href="${hrefUrl}" target="_blank" rel="noopener">Open in real browser</a>
    </body></html>`;
    writeToIframe(html);
  }

  function writeToIframe(html) {
    browserIframe.removeAttribute('src');
    browserIframe.removeAttribute('srcdoc');
    try {
      const doc = browserIframe.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
    } catch (_) {
      browserIframe.srcdoc = html;
    }
  }

  function showProxyBar() {
    isProxyMode = true;
    proxyInfoBar.classList.add('visible');
  }

  function hideProxyBar() {
    isProxyMode = false;
    proxyInfoBar.classList.remove('visible');
  }

  function isExternalUrl(url) {
    if (!url || url === HOME_URL || url === 'about:blank')
      return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (_) {
      return false;
    }
  }

  function getOrigin(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch (_) {
      return '';
    }
  }

  function abortActiveLoad() {
    if (activeLoadAbort) {
      activeLoadAbort.abort();
      activeLoadAbort = null;
    }
  }

  function loadViaProxy(url) {
    statusText.textContent = 'Loading via proxy...';
    const controller = new AbortController();
    activeLoadAbort = controller;

    fetch(CORS_PROXY + encodeURIComponent(url), { signal: controller.signal })
      .then(response => {
        if (!response.ok)
          throw new Error('Proxy returned ' + response.status);
        return response.text();
      })
      .then(html => {
        if (controller.signal.aborted)
          return;

        const origin = getOrigin(url);
        let baseTag = '';
        if (origin)
          baseTag = '<base href="' + url.replace(/"/g, '&quot;') + '">';

        if (/<head[\s>]/i.test(html))
          html = html.replace(/(<head[^>]*>)/i, '$1' + baseTag);
        else if (/<html[\s>]/i.test(html))
          html = html.replace(/(<html[^>]*>)/i, '$1<head>' + baseTag + '</head>');
        else
          html = '<head>' + baseTag + '</head>' + html;

        browserIframe.removeAttribute('src');
        browserIframe.srcdoc = html;
        showProxyBar();
        setLoading(false);
        statusText.textContent = 'Done (via proxy)';
        statusUrl.textContent = url;
        updateTitle(url);
      })
      .catch(err => {
        if (controller.signal.aborted)
          return;
        setLoading(false);
        hideProxyBar();
        showErrorPage(url, 'The website refused the connection or is unreachable.');
        statusText.textContent = 'Failed to load page';
      });
  }

  function loadUrl(url, skipAddressUpdate) {
    abortActiveLoad();
    currentUrl = url;
    hideProxyBar();

    if (!skipAddressUpdate)
      urlInput.value = url === HOME_URL ? '' : url;

    if (url === HOME_URL || url === 'about:blank') {
      browserIframe.style.display = 'none';
      browserIframe.removeAttribute('src');
      browserIframe.removeAttribute('srcdoc');
      newtabPage.classList.remove('hidden');
      statusText.textContent = 'Ready';
      statusUrl.textContent = '';
      updateTitle('New Tab');
      setLoading(false);
      return;
    }

    newtabPage.classList.add('hidden');
    browserIframe.style.display = '';
    setLoading(true);
    statusText.textContent = 'Loading ' + url + '...';
    statusUrl.textContent = url;
    updateTitle(url);
    urlInput.value = url;

    if (!isExternalUrl(url)) {
      browserIframe.removeAttribute('srcdoc');
      browserIframe.src = url;
      return;
    }

    let directSucceeded = false;
    let timedOut = false;

    const loadTimer = setTimeout(() => {
      timedOut = true;
      if (directSucceeded)
        return;

      let iframeStillBlank = false;
      try {
        const loc = browserIframe.contentWindow.location.href;
        if (loc === 'about:blank' || loc === '')
          iframeStillBlank = true;
      } catch (_) {
        directSucceeded = true;
        setLoading(false);
        statusText.textContent = 'Done';
        return;
      }

      if (iframeStillBlank) {
        statusText.textContent = 'Direct load blocked, trying proxy...';
        loadViaProxy(url);
      }
    }, DIRECT_LOAD_TIMEOUT_MS);

    const onLoad = () => {
      browserIframe.removeEventListener('load', onLoad);
      if (timedOut)
        return;

      clearTimeout(loadTimer);

      let loaded = false;
      try {
        const loc = browserIframe.contentWindow.location.href;
        if (loc && loc !== 'about:blank')
          loaded = true;
        else {
          loadViaProxy(url);
          return;
        }
      } catch (_) {
        loaded = true;
      }

      if (loaded) {
        directSucceeded = true;
        setLoading(false);
        statusText.textContent = 'Done';
      }
    };

    browserIframe.addEventListener('load', onLoad);
    browserIframe.removeAttribute('srcdoc');
    browserIframe.src = url;
  }

  function setLoading(loading) {
    isLoading = loading;
    if (!loading)
      statusText.textContent = 'Done';
  }

  // -----------------------------------------------------------------------
  // iframe load events
  // -----------------------------------------------------------------------
  browserIframe.addEventListener('load', () => {
    let pageTitle = '';
    let pageUrl = '';

    if (isProxyMode) {
      try {
        const doc = browserIframe.contentDocument;
        if (doc)
          pageTitle = doc.title || '';
      } catch (_) {}
      if (pageTitle)
        updateTitle(pageTitle);
      setLoading(false);
      return;
    }

    try {
      const doc = browserIframe.contentDocument;
      if (doc) {
        pageTitle = doc.title || '';
        pageUrl = browserIframe.contentWindow.location.href;
      }
    } catch (_) {}

    if (pageTitle)
      updateTitle(pageTitle);

    if (pageUrl && pageUrl !== 'about:blank') {
      currentUrl = pageUrl;
      urlInput.value = pageUrl;
      statusUrl.textContent = pageUrl;

      if (historyStack[historyIndex] !== pageUrl)
        pushHistory(pageUrl);
    }
  });

  browserIframe.addEventListener('error', () => {
    if (isExternalUrl(currentUrl) && !isProxyMode) {
      loadViaProxy(currentUrl);
      return;
    }
    setLoading(false);
    statusText.textContent = 'Error loading page';
  });

  // -----------------------------------------------------------------------
  // Toolbar button handlers
  // -----------------------------------------------------------------------
  btnBack.addEventListener('click', goBack);
  btnForward.addEventListener('click', goForward);

  btnRefresh.addEventListener('click', () => {
    if (currentUrl === HOME_URL)
      return;
    if (isProxyMode) {
      setLoading(true);
      hideProxyBar();
      loadViaProxy(currentUrl);
      return;
    }
    setLoading(true);
    statusText.textContent = 'Refreshing...';
    try {
      browserIframe.contentWindow.location.reload();
    } catch (_) {
      loadUrl(currentUrl, true);
    }
  });

  btnHome.addEventListener('click', () => {
    navigateTo(HOME_URL);
  });

  btnStop.addEventListener('click', () => {
    if (!isLoading)
      return;
    abortActiveLoad();
    try {
      browserIframe.contentWindow.stop();
    } catch (_) {
      browserIframe.removeAttribute('src');
    }
    setLoading(false);
    statusText.textContent = 'Stopped';
  });

  // -----------------------------------------------------------------------
  // Address bar
  // -----------------------------------------------------------------------
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateTo(urlInput.value);
    }
  });

  btnGo.addEventListener('click', () => {
    navigateTo(urlInput.value);
  });

  urlInput.addEventListener('focus', () => {
    setTimeout(() => urlInput.select(), 0);
  });

  // -----------------------------------------------------------------------
  // New Tab page interactions
  // -----------------------------------------------------------------------
  newtabUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateTo(newtabUrlInput.value);
      newtabUrlInput.value = '';
    }
  });

  newtabGoBtn.addEventListener('click', () => {
    navigateTo(newtabUrlInput.value);
    newtabUrlInput.value = '';
  });

  for (const tile of newtabTiles.querySelectorAll('.newtab-tile')) {
    tile.addEventListener('click', () => {
      const url = tile.dataset.url;
      if (url)
        navigateTo(url);
    });
  }

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
  new SZ.MenuBar({ onAction: handleAction });

  function handleAction(action) {
    switch (action) {
      case 'new-tab':
        navigateTo(HOME_URL);
        break;
      case 'open-location':
        showOpenLocationDialog();
        break;
      case 'exit':
        User32.DestroyWindow();
        break;
      case 'refresh':
        btnRefresh.click();
        break;
      case 'stop':
        btnStop.click();
        break;
      case 'page-source':
        showPageSource();
        break;
      case 'add-bookmark':
        showAddBookmarkDialog();
        break;
      case 'manage-bookmarks':
        showManageBookmarksDialog();
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Open Location dialog
  // -----------------------------------------------------------------------
  function showOpenLocationDialog() {
    const dlgInput = document.getElementById('dlg-url-input');
    dlgInput.value = currentUrl === HOME_URL ? '' : currentUrl;

    function onKeyDown(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        SZ.Dialog.close('dlg-open-location');
        dlgInput.removeEventListener('keydown', onKeyDown);
        const url = dlgInput.value.trim();
        if (url)
          navigateTo(url);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        SZ.Dialog.close('dlg-open-location');
        dlgInput.removeEventListener('keydown', onKeyDown);
      }
    }

    dlgInput.addEventListener('keydown', onKeyDown);

    SZ.Dialog.show('dlg-open-location').then((result) => {
      dlgInput.removeEventListener('keydown', onKeyDown);
      if (result === 'ok') {
        const url = dlgInput.value.trim();
        if (url)
          navigateTo(url);
      }
    });

    dlgInput.focus();
    setTimeout(() => dlgInput.select(), 0);
  }

  // -----------------------------------------------------------------------
  // Add Bookmark dialog
  // -----------------------------------------------------------------------
  function showAddBookmarkDialog() {
    const nameInput = document.getElementById('dlg-bm-name');
    const urlInputDlg = document.getElementById('dlg-bm-url');

    let pageTitle = '';
    try {
      if (browserIframe.contentDocument)
        pageTitle = browserIframe.contentDocument.title || '';
    } catch (_) {}

    nameInput.value = pageTitle || currentUrl || 'Bookmark';
    urlInputDlg.value = currentUrl === HOME_URL ? '' : currentUrl;

    SZ.Dialog.show('dlg-add-bookmark').then((result) => {
      if (result !== 'ok')
        return;
      const name = nameInput.value.trim();
      const url = normalizeUrl(urlInputDlg.value);
      if (!name || !url)
        return;
      bookmarks.push({ title: name, url: url });
      saveBookmarks();
      renderBookmarksBar();
    });

    nameInput.focus();
    setTimeout(() => nameInput.select(), 0);
  }

  // -----------------------------------------------------------------------
  // Manage Bookmarks dialog
  // -----------------------------------------------------------------------
  function showManageBookmarksDialog() {
    const list = document.getElementById('bm-manage-list');

    function render() {
      list.innerHTML = '';
      if (bookmarks.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 12px; text-align: center; color: #888; font-size: 11px;';
        empty.textContent = 'No bookmarks saved.';
        list.appendChild(empty);
        return;
      }
      for (let i = 0; i < bookmarks.length; ++i) {
        const bm = bookmarks[i];
        const item = document.createElement('div');
        item.className = 'bm-list-item';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'bm-title';
        titleSpan.textContent = bm.title;

        const urlSpan = document.createElement('span');
        urlSpan.className = 'bm-url';
        urlSpan.textContent = bm.url;

        const delBtn = document.createElement('button');
        delBtn.className = 'bm-delete';
        delBtn.textContent = 'X';
        delBtn.title = 'Remove bookmark';
        delBtn.addEventListener('click', () => {
          bookmarks.splice(i, 1);
          saveBookmarks();
          renderBookmarksBar();
          render();
        });

        item.appendChild(titleSpan);
        item.appendChild(urlSpan);
        item.appendChild(delBtn);
        list.appendChild(item);
      }
    }

    render();
    SZ.Dialog.show('dlg-manage-bookmarks');
  }

  // -----------------------------------------------------------------------
  // Page Source
  // -----------------------------------------------------------------------
  function showPageSource() {
    const textarea = document.getElementById('page-source-text');
    let source = '';

    if (currentUrl === HOME_URL) {
      source = '<!-- New Tab Page -->\n<p>This is the built-in new tab page.</p>';
    } else {
      try {
        const doc = browserIframe.contentDocument;
        if (doc)
          source = doc.documentElement.outerHTML;
        else
          source = '(Cannot access page source: cross-origin restriction)';
      } catch (_) {
        source = '(Cannot access page source: cross-origin restriction)';
      }
    }

    textarea.value = source;
    SZ.Dialog.show('dlg-page-source');
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      btnRefresh.click();
      return;
    }

    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      btnStop.click();
      return;
    }

    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      goBack();
      return;
    }

    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      goForward();
      return;
    }

    if (!e.ctrlKey)
      return;

    switch (e.key.toLowerCase()) {
      case 't':
        e.preventDefault();
        handleAction('new-tab');
        break;
      case 'l':
        e.preventDefault();
        urlInput.focus();
        urlInput.select();
        break;
      case 'd':
        e.preventDefault();
        handleAction('add-bookmark');
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Periodically poll iframe URL (for same-origin navigations)
  // -----------------------------------------------------------------------
  setInterval(() => {
    if (currentUrl === HOME_URL || browserIframe.style.display === 'none' || isProxyMode)
      return;

    try {
      const loc = browserIframe.contentWindow.location.href;
      if (loc && loc !== 'about:blank' && loc !== currentUrl) {
        currentUrl = loc;
        urlInput.value = loc;
        statusUrl.textContent = loc;

        let pageTitle = '';
        try {
          if (browserIframe.contentDocument)
            pageTitle = browserIframe.contentDocument.title || '';
        } catch (_) {}

        if (pageTitle)
          updateTitle(pageTitle);

        if (historyStack[historyIndex] !== loc)
          pushHistory(loc);
      }
    } catch (_) {}
  }, 1000);

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  loadBookmarks();
  renderBookmarksBar();
  pushHistory(HOME_URL);
  loadUrl(HOME_URL, false);

  // Check command line for URL or path
  const cmdLine = Kernel32.GetCommandLine();
  if (cmdLine.url) {
    navigateTo(cmdLine.url);
  } else if (cmdLine.path) {
    navigateTo(cmdLine.path);
  } else
    updateTitle('New Tab');

})();
