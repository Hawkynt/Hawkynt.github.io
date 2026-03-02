;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _editorWrapper, _markDirty;
  let selectedImage = null;
  let resizeOverlay = null;
  let resizingHandle = null;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let resizeAspect = 1;

  function init(ctx) {
    _editor = ctx.editor;
    _editorWrapper = ctx.editorWrapper;
    _markDirty = ctx.markDirty;

    // Image selection (click to select, show resize handles)
    _editor.addEventListener('click', (e) => {
      // Deselect previous
      for (const img of _editor.querySelectorAll('img.img-selected'))
        img.classList.remove('img-selected');
      hideResizeOverlay();
      selectedImage = null;

      if (e.target.tagName === 'IMG') {
        e.target.classList.add('img-selected');
        selectedImage = e.target;
        createResizeOverlay();
        positionResizeOverlay(e.target);
        showImgWrapPopupOnSelect(e.target);
      }
    });

    // Deselect on click outside editor images
    document.addEventListener('pointerdown', (e) => {
      if (selectedImage && !e.target.closest('.wp-img-resize-overlay') && e.target !== selectedImage && !e.target.closest('#popup-img-wrap')) {
        for (const img of _editor.querySelectorAll('img.img-selected'))
          img.classList.remove('img-selected');
        hideResizeOverlay();
        selectedImage = null;
      }
    });

    // Reposition overlay on scroll/resize
    _editorWrapper.addEventListener('scroll', () => {
      if (selectedImage) positionResizeOverlay(selectedImage);
    });

    window.addEventListener('resize', () => {
      if (selectedImage) positionResizeOverlay(selectedImage);
    });

    // Image Wrapping Popup
    const imgWrapPopup = document.getElementById('popup-img-wrap');
    for (const entry of imgWrapPopup.querySelectorAll('.popup-entry')) {
      entry.addEventListener('click', () => {
        imgWrapPopup.classList.remove('visible');
        if (!selectedImage) return;
        // Check if this is the crop action
        if (entry.dataset.action === 'crop-image') {
          startCrop();
          return;
        }
        const wrap = entry.dataset.wrap;
        if (wrap) {
          applyImageWrap(selectedImage, wrap);
          _editor.focus();
          _markDirty();
        }
      });
    }
  }

  function createResizeOverlay() {
    if (resizeOverlay) return;
    resizeOverlay = document.createElement('div');
    resizeOverlay.className = 'wp-img-resize-overlay';
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const dir of handles) {
      const h = document.createElement('div');
      h.className = 'wp-resize-handle ' + dir;
      h.dataset.dir = dir;
      h.addEventListener('pointerdown', onResizeHandleDown);
      resizeOverlay.appendChild(h);
    }
    document.body.appendChild(resizeOverlay);
  }

  function positionResizeOverlay(img) {
    if (!resizeOverlay) createResizeOverlay();
    const rect = img.getBoundingClientRect();
    resizeOverlay.style.display = 'block';
    resizeOverlay.style.left = (rect.left) + 'px';
    resizeOverlay.style.top = (rect.top) + 'px';
    resizeOverlay.style.width = rect.width + 'px';
    resizeOverlay.style.height = rect.height + 'px';
  }

  function hideResizeOverlay() {
    if (resizeOverlay)
      resizeOverlay.style.display = 'none';
  }

  function onResizeHandleDown(e) {
    if (!selectedImage) return;
    e.preventDefault();
    e.stopPropagation();
    resizingHandle = e.target.dataset.dir;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = selectedImage.offsetWidth;
    resizeStartH = selectedImage.offsetHeight;
    resizeAspect = resizeStartW / (resizeStartH || 1);
    e.target.setPointerCapture(e.pointerId);
    e.target.addEventListener('pointermove', onResizeHandleMove);
    e.target.addEventListener('pointerup', onResizeHandleUp);
  }

  function onResizeHandleMove(e) {
    if (!resizingHandle || !selectedImage) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    let newW = resizeStartW;
    let newH = resizeStartH;
    const dir = resizingHandle;
    const isCorner = dir.length === 2;
    const isShift = e.shiftKey;

    if (dir.includes('e')) newW = resizeStartW + dx;
    if (dir.includes('w')) newW = resizeStartW - dx;
    if (dir.includes('s')) newH = resizeStartH + dy;
    if (dir.includes('n')) newH = resizeStartH - dy;

    newW = Math.max(20, newW);
    newH = Math.max(20, newH);

    // Corner handles: proportional by default, Shift for free aspect
    if (isCorner && !isShift) {
      if (Math.abs(dx) > Math.abs(dy))
        newH = Math.round(newW / resizeAspect);
      else
        newW = Math.round(newH * resizeAspect);
      newW = Math.max(20, newW);
      newH = Math.max(20, newH);
    }

    selectedImage.style.width = newW + 'px';
    selectedImage.style.height = newH + 'px';
    positionResizeOverlay(selectedImage);
  }

  function onResizeHandleUp(e) {
    resizingHandle = null;
    e.target.releasePointerCapture(e.pointerId);
    e.target.removeEventListener('pointermove', onResizeHandleMove);
    e.target.removeEventListener('pointerup', onResizeHandleUp);
    _markDirty();
  }

  function showImgWrapPopupOnSelect(img) {
    const imgWrapPopup = document.getElementById('popup-img-wrap');
    const rect = img.getBoundingClientRect();
    imgWrapPopup.style.left = (rect.right + 4) + 'px';
    imgWrapPopup.style.top = rect.top + 'px';
    imgWrapPopup.classList.add('visible');
  }

  function applyImageWrap(img, wrap) {
    // Remove all wrapping classes
    img.classList.remove('wrap-inline', 'wrap-square-left', 'wrap-square-right', 'wrap-tight', 'wrap-behind', 'wrap-front');
    img.removeAttribute('data-wrap');
    img.style.float = '';
    img.style.position = '';
    img.style.zIndex = '';
    img.style.margin = '';
    img.style.shapeOutside = '';

    if (wrap && wrap !== 'inline') {
      img.classList.add('wrap-' + wrap);
      img.setAttribute('data-wrap', wrap);
    }
  }

  function getSelectedImage() {
    return selectedImage;
  }

  // ═══════════════════════════════════════════════════════════════
  // Image Crop Tool
  // ═══════════════════════════════════════════════════════════════

  let cropOverlay = null;
  let cropImage = null;
  let cropRect = { top: 0, right: 0, bottom: 0, left: 0 };
  let cropDragging = null;
  let cropStartX = 0;
  let cropStartY = 0;
  let cropStartRect = null;
  let cropImgW = 0;
  let cropImgH = 0;

  function startCrop() {
    if (!selectedImage) return;
    cropImage = selectedImage;
    const rect = cropImage.getBoundingClientRect();
    cropImgW = rect.width;
    cropImgH = rect.height;
    cropRect = { top: 0, right: 0, bottom: 0, left: 0 };

    // Create crop overlay
    cropOverlay = document.createElement('div');
    cropOverlay.className = 'wp-crop-overlay';
    cropOverlay.style.left = rect.left + 'px';
    cropOverlay.style.top = rect.top + 'px';
    cropOverlay.style.width = rect.width + 'px';
    cropOverlay.style.height = rect.height + 'px';
    cropOverlay.style.position = 'fixed';
    cropOverlay.style.pointerEvents = 'none';

    // Create shade elements (4 sides)
    const shadeTop = document.createElement('div');
    shadeTop.className = 'wp-crop-shade wp-crop-shade-top';
    const shadeRight = document.createElement('div');
    shadeRight.className = 'wp-crop-shade wp-crop-shade-right';
    const shadeBottom = document.createElement('div');
    shadeBottom.className = 'wp-crop-shade wp-crop-shade-bottom';
    const shadeLeft = document.createElement('div');
    shadeLeft.className = 'wp-crop-shade wp-crop-shade-left';
    cropOverlay.appendChild(shadeTop);
    cropOverlay.appendChild(shadeRight);
    cropOverlay.appendChild(shadeBottom);
    cropOverlay.appendChild(shadeLeft);

    // Create handles
    const dirs = ['crop-nw', 'crop-n', 'crop-ne', 'crop-e', 'crop-se', 'crop-s', 'crop-sw', 'crop-w'];
    for (const dir of dirs) {
      const h = document.createElement('div');
      h.className = 'wp-crop-handle ' + dir;
      h.dataset.cropDir = dir.replace('crop-', '');
      h.addEventListener('pointerdown', onCropHandleDown);
      cropOverlay.appendChild(h);
    }

    // Toolbar (Apply / Cancel)
    const toolbar = document.createElement('div');
    toolbar.className = 'wp-crop-toolbar';
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', applyCrop);
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', cancelCrop);
    toolbar.appendChild(applyBtn);
    toolbar.appendChild(cancelBtn);
    cropOverlay.appendChild(toolbar);

    document.body.appendChild(cropOverlay);
    updateCropShades();
  }

  function updateCropShades() {
    if (!cropOverlay) return;
    const w = cropImgW;
    const h = cropImgH;
    const t = cropRect.top;
    const r = cropRect.right;
    const b = cropRect.bottom;
    const l = cropRect.left;

    const shadeTop = cropOverlay.querySelector('.wp-crop-shade-top');
    const shadeRight = cropOverlay.querySelector('.wp-crop-shade-right');
    const shadeBottom = cropOverlay.querySelector('.wp-crop-shade-bottom');
    const shadeLeft = cropOverlay.querySelector('.wp-crop-shade-left');

    if (shadeTop) {
      shadeTop.style.left = '0';
      shadeTop.style.top = '0';
      shadeTop.style.right = '0';
      shadeTop.style.height = t + 'px';
    }
    if (shadeBottom) {
      shadeBottom.style.left = '0';
      shadeBottom.style.bottom = '0';
      shadeBottom.style.right = '0';
      shadeBottom.style.height = b + 'px';
    }
    if (shadeLeft) {
      shadeLeft.style.left = '0';
      shadeLeft.style.top = t + 'px';
      shadeLeft.style.bottom = b + 'px';
      shadeLeft.style.width = l + 'px';
    }
    if (shadeRight) {
      shadeRight.style.right = '0';
      shadeRight.style.top = t + 'px';
      shadeRight.style.bottom = b + 'px';
      shadeRight.style.width = r + 'px';
    }

    // Reposition handles relative to the crop area
    const cropLeft = l;
    const cropTop = t;
    const cropWidth = w - l - r;
    const cropHeight = h - t - b;

    for (const handle of cropOverlay.querySelectorAll('.wp-crop-handle')) {
      const dir = handle.dataset.cropDir;
      // Position each handle at the edges/corners of the crop rectangle
      if (dir.includes('n')) handle.style.top = (cropTop - 5) + 'px';
      if (dir.includes('s')) handle.style.top = (cropTop + cropHeight - 5) + 'px';
      if (dir.includes('w')) handle.style.left = (cropLeft - 5) + 'px';
      if (dir.includes('e')) handle.style.left = (cropLeft + cropWidth - 5) + 'px';

      if (dir === 'n' || dir === 's')
        handle.style.left = (cropLeft + cropWidth / 2 - 5) + 'px';
      if (dir === 'w' || dir === 'e')
        handle.style.top = (cropTop + cropHeight / 2 - 5) + 'px';

      // Reset margin since we position absolutely
      handle.style.marginLeft = '0';
      handle.style.marginTop = '0';
    }
  }

  function onCropHandleDown(e) {
    e.preventDefault();
    e.stopPropagation();
    cropDragging = e.target.dataset.cropDir;
    cropStartX = e.clientX;
    cropStartY = e.clientY;
    cropStartRect = { ...cropRect };
    e.target.setPointerCapture(e.pointerId);
    e.target.addEventListener('pointermove', onCropHandleMove);
    e.target.addEventListener('pointerup', onCropHandleUp);
  }

  function onCropHandleMove(e) {
    if (!cropDragging) return;
    const dx = e.clientX - cropStartX;
    const dy = e.clientY - cropStartY;
    const dir = cropDragging;

    if (dir.includes('n'))
      cropRect.top = Math.max(0, Math.min(cropImgH - cropRect.bottom - 20, cropStartRect.top + dy));
    if (dir.includes('s'))
      cropRect.bottom = Math.max(0, Math.min(cropImgH - cropRect.top - 20, cropStartRect.bottom - dy));
    if (dir.includes('w'))
      cropRect.left = Math.max(0, Math.min(cropImgW - cropRect.right - 20, cropStartRect.left + dx));
    if (dir.includes('e'))
      cropRect.right = Math.max(0, Math.min(cropImgW - cropRect.left - 20, cropStartRect.right - dx));

    updateCropShades();
  }

  function onCropHandleUp(e) {
    cropDragging = null;
    e.target.releasePointerCapture(e.pointerId);
    e.target.removeEventListener('pointermove', onCropHandleMove);
    e.target.removeEventListener('pointerup', onCropHandleUp);
  }

  function applyCrop() {
    if (!cropImage) {
      cancelCrop();
      return;
    }
    // Apply crop using clip-path: inset()
    const topPct = (cropRect.top / cropImgH * 100).toFixed(2);
    const rightPct = (cropRect.right / cropImgW * 100).toFixed(2);
    const bottomPct = (cropRect.bottom / cropImgH * 100).toFixed(2);
    const leftPct = (cropRect.left / cropImgW * 100).toFixed(2);

    if (cropRect.top > 0 || cropRect.right > 0 || cropRect.bottom > 0 || cropRect.left > 0)
      cropImage.style.clipPath = 'inset(' + topPct + '% ' + rightPct + '% ' + bottomPct + '% ' + leftPct + '%)';

    _markDirty();
    cancelCrop();
  }

  function cancelCrop() {
    if (cropOverlay) {
      cropOverlay.remove();
      cropOverlay = null;
    }
    cropImage = null;
    cropDragging = null;
  }

  WP.ImageTools = { init, applyImageWrap, getSelectedImage, startCrop };
})();
