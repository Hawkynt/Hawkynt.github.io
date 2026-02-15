;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const IMAGE_EXTENSIONS = ['png', 'bmp', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
  const ZOOM_LEVELS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let currentFilePath = null;
  let currentFileName = null;
  let currentDirPath = null;
  let siblingImages = [];
  let siblingIndex = -1;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let imageFileSize = 0;
  let zoomLevel = 1;
  let fitMode = true;
  let rotation = 0;

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const menuBar = document.getElementById('menu-bar');
  const viewport = document.getElementById('viewport');
  const imgContainer = document.getElementById('img-container');
  const viewerImg = document.getElementById('viewer-img');
  const emptyMsg = document.getElementById('empty-msg');
  const statusFile = document.getElementById('status-file');
  const statusDims = document.getElementById('status-dims');
  const statusSize = document.getElementById('status-size');

  function _closestZoomIndex(z) {
    let best = 0;
    for (let i = 1; i < ZOOM_LEVELS.length; ++i)
      if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z))
        best = i;
    return best;
  }

  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 0, max: ZOOM_LEVELS.length - 1, step: 1,
    value: _closestZoomIndex(1),
    formatLabel: idx => Math.round(ZOOM_LEVELS[idx] * 100) + '%',
    parseLabel: text => {
      const raw = parseInt(text, 10);
      if (isNaN(raw) || raw < 1) return null;
      return _closestZoomIndex(raw / 100);
    },
    onChange: idx => {
      fitMode = false;
      zoomLevel = ZOOM_LEVELS[idx];
      applyTransform();
      updateStatusBar();
    },
    onZoomIn: () => doZoomIn(),
    onZoomOut: () => doZoomOut(),
  });

  let openMenu = null;

  const imageControls = [
    'tb-prev', 'tb-next', 'tb-zoom-in', 'tb-zoom-out', 'tb-fit', 'tb-actual',
    'tb-rot-cw', 'tb-rot-ccw',
    'mi-close', 'mi-zoom-in', 'mi-zoom-out', 'mi-fit', 'mi-actual',
    'mi-rot-cw', 'mi-rot-ccw'
  ];

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const title = (currentFileName ? currentFileName + ' - ' : '') + 'Image Viewer';
    document.title = title;
    SZ.Dlls.User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Enable / disable controls
  // -----------------------------------------------------------------------
  function setControlsEnabled(enabled) {
    for (const id of imageControls) {
      const el = document.getElementById(id);
      if (!el)
        continue;
      if (enabled)
        el.classList.remove('disabled');
      else
        el.classList.add('disabled');
    }
    updateNavButtons();
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('tb-prev');
    const nextBtn = document.getElementById('tb-next');
    if (!currentFilePath || siblingImages.length <= 1) {
      prevBtn.classList.add('disabled');
      nextBtn.classList.add('disabled');
    } else {
      prevBtn.classList.remove('disabled');
      nextBtn.classList.remove('disabled');
    }
  }

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Menu/toolbar actions
  // -----------------------------------------------------------------------
  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      if (entry.classList.contains('disabled'))
        return;
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  for (const btn of document.querySelectorAll('.tb-btn')) {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled'))
        return;
      handleAction(btn.dataset.action);
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'open': doOpen(); break;
      case 'close-image': doCloseImage(); break;
      case 'exit': SZ.Dlls.User32.DestroyWindow(); break;
      case 'prev': doNavigate(-1); break;
      case 'next': doNavigate(1); break;
      case 'zoom-in': doZoomIn(); break;
      case 'zoom-out': doZoomOut(); break;
      case 'fit-window': doFitWindow(); break;
      case 'actual-size': doActualSize(); break;
      case 'rotate-cw': doRotate(90); break;
      case 'rotate-ccw': doRotate(-90); break;
      case 'about': showDialog('dlg-about'); break;
    }
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  async function doOpen() {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Images', ext: ['png', 'bmp', 'jpg', 'gif'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open Image',
    });
    if (!result.cancelled && result.path)
      loadImage(result.path, result.content);
  }

  async function loadImage(path, contentArg) {
    let content = contentArg;
    if (content == null) {
      try {
        content = await SZ.Dlls.Kernel32.ReadFile(path);
      } catch (err) {
        await SZ.Dlls.User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }
    content = String(content || '');

    // Estimate file size from data URL
    if (content.startsWith('data:')) {
      const commaIndex = content.indexOf(',');
      if (commaIndex > 0) {
        const base64Part = content.substring(commaIndex + 1);
        imageFileSize = Math.round(base64Part.length * 3 / 4);
      } else {
        imageFileSize = content.length;
      }
    } else {
      imageFileSize = content.length;
    }

    const img = new Image();
    img.onload = () => {
      naturalWidth = img.naturalWidth;
      naturalHeight = img.naturalHeight;
      viewerImg.src = content;
      currentFilePath = path;
      const parts = path.split('/');
      currentFileName = parts[parts.length - 1] || 'Image';
      currentDirPath = parts.slice(0, -1).join('/');
      rotation = 0;
      fitMode = true;
      zoomLevel = 1;

      emptyMsg.style.display = 'none';
      imgContainer.style.display = 'flex';

      setControlsEnabled(true);
      updateTitle();
      applyTransform();
      updateStatusBar();
      fetchSiblings();
    };
    img.onerror = () => {
      SZ.Dlls.User32.MessageBox('Could not decode image. The file may not be a supported image format.', 'Error', MB_OK | MB_ICONERROR);
    };
    img.src = content;
  }

  function doCloseImage() {
    viewerImg.src = '';
    currentFilePath = null;
    currentFileName = null;
    currentDirPath = null;
    siblingImages = [];
    siblingIndex = -1;
    naturalWidth = 0;
    naturalHeight = 0;
    imageFileSize = 0;
    rotation = 0;
    zoomLevel = 1;
    fitMode = true;

    emptyMsg.style.display = 'flex';
    imgContainer.style.display = 'none';

    setControlsEnabled(false);
    updateTitle();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Sibling navigation
  // -----------------------------------------------------------------------
  async function fetchSiblings() {
    siblingImages = [];
    siblingIndex = -1;
    if (!currentDirPath)
      return;

    try {
      const entries = await SZ.Dlls.Kernel32.FindFirstFile(currentDirPath);
      const images = [];
      for (let i = 0; i < entries.length; ++i) {
        const entry = entries[i];
        const name = typeof entry === 'string' ? entry : (entry.name || '');
        if (!name)
          continue;
        const ext = name.split('.').pop().toLowerCase();
        if (IMAGE_EXTENSIONS.indexOf(ext) >= 0)
          images.push(name);
      }

      images.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      siblingImages = images;

      if (currentFileName) {
        for (let i = 0; i < siblingImages.length; ++i)
          if (siblingImages[i] === currentFileName) {
            siblingIndex = i;
            break;
          }
      }
    } catch (_) {
      // Directory listing unavailable
    }

    updateNavButtons();
  }

  async function doNavigate(direction) {
    if (siblingImages.length <= 1 || siblingIndex < 0)
      return;

    let newIndex = siblingIndex + direction;
    if (newIndex < 0)
      newIndex = siblingImages.length - 1;
    else if (newIndex >= siblingImages.length)
      newIndex = 0;

    if (newIndex === siblingIndex)
      return;

    const newName = siblingImages[newIndex];
    const newPath = currentDirPath + '/' + newName;

    try {
      const content = await SZ.Dlls.Kernel32.ReadFile(newPath);
      siblingIndex = newIndex;
      loadImage(newPath, content);
    } catch (err) {
      SZ.Dlls.User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
    }
  }

  // -----------------------------------------------------------------------
  // Zoom
  // -----------------------------------------------------------------------
  function getEffectiveZoom() {
    if (!fitMode)
      return zoomLevel;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (!naturalWidth || !naturalHeight || !vw || !vh)
      return 1;

    const isRotated = (rotation % 180) !== 0;
    const imgW = isRotated ? naturalHeight : naturalWidth;
    const imgH = isRotated ? naturalWidth : naturalHeight;

    const scaleX = vw / imgW;
    const scaleY = vh / imgH;
    return Math.min(scaleX, scaleY, 1);
  }

  function doZoomIn() {
    if (!currentFilePath)
      return;
    fitMode = false;
    const current = zoomLevel;
    for (let i = 0; i < ZOOM_LEVELS.length; ++i)
      if (ZOOM_LEVELS[i] > current + 0.001) {
        zoomLevel = ZOOM_LEVELS[i];
        break;
      }
    applyTransform();
    updateStatusBar();
  }

  function doZoomOut() {
    if (!currentFilePath)
      return;
    fitMode = false;
    const current = zoomLevel;
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; --i)
      if (ZOOM_LEVELS[i] < current - 0.001) {
        zoomLevel = ZOOM_LEVELS[i];
        break;
      }
    applyTransform();
    updateStatusBar();
  }

  function doFitWindow() {
    if (!currentFilePath)
      return;
    fitMode = true;
    zoomLevel = 1;
    applyTransform();
    updateStatusBar();
  }

  function doActualSize() {
    if (!currentFilePath)
      return;
    fitMode = false;
    zoomLevel = 1;
    applyTransform();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Rotation
  // -----------------------------------------------------------------------
  function doRotate(degrees) {
    if (!currentFilePath)
      return;
    rotation = ((rotation + degrees) % 360 + 360) % 360;
    applyTransform();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Apply CSS transform
  // -----------------------------------------------------------------------
  function applyTransform() {
    if (!currentFilePath)
      return;

    if (fitMode) {
      imgContainer.classList.add('fit');
      imgContainer.style.width = '';
      imgContainer.style.height = '';
      viewerImg.style.width = '';
      viewerImg.style.height = '';
      viewerImg.style.transform = rotation !== 0 ? 'rotate(' + rotation + 'deg)' : '';

      if ((rotation % 180) !== 0) {
        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        if (vw && vh && naturalWidth && naturalHeight) {
          const fitScale = Math.min(vw / naturalHeight, vh / naturalWidth, 1);
          const drawW = naturalWidth * fitScale;
          const drawH = naturalHeight * fitScale;
          viewerImg.style.width = drawW + 'px';
          viewerImg.style.height = drawH + 'px';
        }
      }
    } else {
      imgContainer.classList.remove('fit');
      const scale = zoomLevel;
      const isRotated = (rotation % 180) !== 0;
      const displayW = naturalWidth * scale;
      const displayH = naturalHeight * scale;

      viewerImg.style.width = displayW + 'px';
      viewerImg.style.height = displayH + 'px';
      viewerImg.style.transform = rotation !== 0 ? 'rotate(' + rotation + 'deg)' : '';

      if (isRotated) {
        imgContainer.style.minWidth = displayH + 'px';
        imgContainer.style.minHeight = displayW + 'px';
      } else {
        imgContainer.style.minWidth = displayW + 'px';
        imgContainer.style.minHeight = displayH + 'px';
      }
    }
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  function updateStatusBar() {
    if (!currentFilePath) {
      statusFile.textContent = 'No file';
      statusDims.textContent = '';
      statusZoomCtrl.value = _closestZoomIndex(1);
      statusSize.textContent = '';
      return;
    }

    statusFile.textContent = currentFileName || 'Image';

    const isRotated = (rotation % 180) !== 0;
    const displayW = isRotated ? naturalHeight : naturalWidth;
    const displayH = isRotated ? naturalWidth : naturalHeight;
    statusDims.textContent = displayW + ' \u00d7 ' + displayH + ' px';

    const effectiveZoom = fitMode ? getEffectiveZoom() : zoomLevel;
    statusZoomCtrl.value = _closestZoomIndex(effectiveZoom);

    if (imageFileSize > 0) {
      if (imageFileSize >= 1048576)
        statusSize.textContent = (imageFileSize / 1048576).toFixed(1) + ' MB';
      else if (imageFileSize >= 1024)
        statusSize.textContent = (imageFileSize / 1024).toFixed(1) + ' KB';
      else
        statusSize.textContent = imageFileSize + ' B';
    } else {
      statusSize.textContent = '';
    }
  }

  // -----------------------------------------------------------------------
  // Ctrl+mousewheel zoom
  // -----------------------------------------------------------------------
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !currentFilePath)
      return;
    e.preventDefault();

    if (fitMode) {
      zoomLevel = getEffectiveZoom();
      fitMode = false;
    }

    if (e.deltaY < 0)
      doZoomIn();
    else
      doZoomOut();
  }, { passive: false });

  // -----------------------------------------------------------------------
  // Recalculate fit on resize
  // -----------------------------------------------------------------------
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer)
      clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (fitMode && currentFilePath) {
        applyTransform();
        updateStatusBar();
      }
    }, 100);
  });

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      handleAction('open');
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key === '0') {
      e.preventDefault();
      handleAction('fit-window');
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key === '1') {
      e.preventDefault();
      handleAction('actual-size');
      return;
    }

    if (e.ctrlKey && !e.shiftKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      handleAction('zoom-in');
      return;
    }

    if (e.ctrlKey && !e.shiftKey && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      handleAction('zoom-out');
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleAction('rotate-cw');
      return;
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleAction('rotate-ccw');
      return;
    }

    if (!e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
      e.preventDefault();
      handleAction('prev');
      return;
    }

    if (!e.ctrlKey && !e.altKey && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
      e.preventDefault();
      handleAction('next');
      return;
    }

    if (!e.ctrlKey && e.key === 'Home' && siblingImages.length > 1) {
      e.preventDefault();
      const delta = -siblingIndex;
      if (delta !== 0)
        doNavigate(delta);
      return;
    }

    if (!e.ctrlKey && e.key === 'End' && siblingImages.length > 1) {
      e.preventDefault();
      const delta = siblingImages.length - 1 - siblingIndex;
      if (delta !== 0)
        doNavigate(delta);
      return;
    }

    if (e.key === 'Escape') {
      if (currentFilePath)
        doCloseImage();
      return;
    }
  });

  // -----------------------------------------------------------------------
  // Drag-and-drop support
  // -----------------------------------------------------------------------
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          imageFileSize = file.size;
          const img = new Image();
          img.onload = () => {
            naturalWidth = img.naturalWidth;
            naturalHeight = img.naturalHeight;
            viewerImg.src = dataUrl;
            currentFilePath = null;
            currentFileName = file.name;
            currentDirPath = null;
            siblingImages = [];
            siblingIndex = -1;
            rotation = 0;
            fitMode = true;
            zoomLevel = 1;

            emptyMsg.style.display = 'none';
            imgContainer.style.display = 'flex';

            setControlsEnabled(true);
            updateNavButtons();
            updateTitle();
            applyTransform();
            updateStatusBar();
          };
          img.onerror = () => SZ.Dlls.User32.MessageBox('Could not decode dropped image.', 'Error', MB_OK | MB_ICONERROR);
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    const pathData = e.dataTransfer.getData('text/plain');
    if (pathData && pathData.startsWith('/'))
      loadImage(pathData, null);
  });

  // -----------------------------------------------------------------------
  // Dialog helpers
  // -----------------------------------------------------------------------
  function showDialog(id) {
    const overlay = document.getElementById(id);
    overlay.classList.add('visible');
    awaitDialogResult(overlay);
  }

  function awaitDialogResult(overlay, callback) {
    function handleClick(e) {
      const btn = e.target.closest('[data-result]');
      if (!btn)
        return;
      overlay.classList.remove('visible');
      overlay.removeEventListener('click', handleClick);
      if (typeof callback === 'function')
        callback(btn.dataset.result);
    }
    overlay.addEventListener('click', handleClick);
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    updateTitle();
    updateStatusBar();
    setControlsEnabled(false);

    // Check for file path on command line
    const cmd = SZ.Dlls.Kernel32.GetCommandLine();
    if (cmd.path)
      loadImage(cmd.path, null);
  }

  init();
})();
