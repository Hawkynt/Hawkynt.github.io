;(function() {
  'use strict';

  const PaintApp = window.PaintApp || (window.PaintApp = {});
  const Resizing = window.SZ.System.Drawing.Resizing;
  const { getAvailableForResize, apply, resampleNearest, CATEGORY, helpers: { clamp } } = Resizing;

  // =======================================================================
  // Dialog: Scaler Picker
  // =======================================================================

  function _createPreviewSource(srcImageData, maxSize) {
    const sw = srcImageData.width, sh = srcImageData.height;
    if (sw <= maxSize && sh <= maxSize)
      return srcImageData;
    const ratio = Math.min(maxSize / sw, maxSize / sh);
    const dw = Math.max(1, sw * ratio | 0), dh = Math.max(1, sh * ratio | 0);
    return resampleNearest(srcImageData, dw, dh);
  }

  function showScalerDialog(srcImageData, currentW, currentH) {
    return new Promise(resolve => {
      const dlg = document.getElementById('dlg-resize');
      const wInput = document.getElementById('resize-w');
      const hInput = document.getElementById('resize-h');
      const lockCheck = document.getElementById('resize-lock');
      const factorInput = document.getElementById('resize-factor');
      const sizePane = document.getElementById('scaler-dims-size');
      const factorPane = document.getElementById('scaler-dims-factor');
      const modeTabs = dlg.querySelectorAll('.scaler-mode-tab');
      const infoLine = document.getElementById('scaler-info');
      const listEl = document.getElementById('scaler-list');
      const previewCanvas = document.getElementById('scaler-preview');
      const previewCtx = previewCanvas.getContext('2d');
      const okBtn = document.getElementById('scaler-ok');

      wInput.value = currentW;
      hInput.value = currentH;
      wInput.max = 8192;
      hInput.max = 8192;
      lockCheck.checked = true;
      factorInput.value = 2;
      okBtn.disabled = true;

      const aspect = currentW / currentH;
      let selectedAlgorithm = null;
      let selectedAlgoEntry = null;
      let currentParams = {};
      let genId = 0;
      let mode = 'size';
      const paramsEl = document.getElementById('scaler-params');

      const previewSrc = _createPreviewSource(srcImageData, 64);

      // -- Mode switching ---------------------------------------------------

      function setMode(m) {
        mode = m;
        for (const tab of modeTabs) tab.classList.toggle('active', tab.dataset.mode === m);
        sizePane.style.display = m === 'size' ? '' : 'none';
        factorPane.style.display = m === 'factor' ? '' : 'none';
        syncFromMode();
      }

      function syncFromMode() {
        if (mode === 'factor') {
          const f = parseFloat(factorInput.value) || 1;
          wInput.value = Math.max(1, Math.round(currentW * f));
          hInput.value = Math.max(1, Math.round(currentH * f));
        }
        updateInfo();
        rebuildList();
      }

      for (const tab of modeTabs)
        tab.addEventListener('click', () => setMode(tab.dataset.mode));

      // -- Dimensions -------------------------------------------------------

      function getTargetDims() {
        const w = parseInt(wInput.value, 10) || 1;
        const h = parseInt(hInput.value, 10) || 1;
        return { w: clamp(w, 1, 8192), h: clamp(h, 1, 8192) };
      }

      function updateInfo() {
        const { w, h } = getTargetDims();
        const scaleX = w / currentW, scaleY = h / currentH;
        if (w === currentW && h === currentH)
          infoLine.textContent = `${currentW}\u00d7${currentH} (no change)`;
        else if (scaleX >= 1 && scaleY >= 1) {
          if (Number.isInteger(scaleX) && Number.isInteger(scaleY) && scaleX === scaleY)
            infoLine.textContent = `${currentW}\u00d7${currentH} \u2192 ${w}\u00d7${h} (${scaleX}x upscale)`;
          else
            infoLine.textContent = `${currentW}\u00d7${currentH} \u2192 ${w}\u00d7${h} (upscale)`;
        } else
          infoLine.textContent = `${currentW}\u00d7${currentH} \u2192 ${w}\u00d7${h} (downscale)`;
      }

      // -- Algorithm list ---------------------------------------------------

      function rebuildList() {
        ++genId;
        const currentGen = genId;
        listEl.innerHTML = '';
        selectedAlgorithm = null;
        selectedAlgoEntry = null;
        currentParams = {};
        paramsEl.innerHTML = '';
        okBtn.disabled = true;
        previewCtx.clearRect(0, 0, 192, 192);
        previewCtx.fillStyle = '#808080';
        previewCtx.fillRect(0, 0, 192, 192);

        const { w, h } = getTargetDims();
        if (w === currentW && h === currentH) return;

        const algos = getAvailableForResize(currentW, currentH, w, h);
        if (algos.length === 0) return;

        const items = [];
        for (const algo of algos) {
          const item = document.createElement('div');
          item.className = 'scaler-item';
          item.dataset.id = algo.id;

          const thumb = document.createElement('canvas');
          thumb.className = 'scaler-thumb';
          thumb.width = 48;
          thumb.height = 48;

          const label = document.createElement('span');
          label.className = 'scaler-label';
          label.textContent = algo.name;

          const badge = document.createElement('span');
          badge.className = 'scaler-badge' + (algo.category === CATEGORY.PIXEL_ART ? ' pixel-art' : ' resampler');
          badge.textContent = algo.category === CATEGORY.PIXEL_ART ? 'PA' : 'RS';

          item.appendChild(thumb);
          item.appendChild(label);
          item.appendChild(badge);

          item.addEventListener('click', () => {
            listEl.querySelectorAll('.scaler-item.selected').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedAlgorithm = algo.id;
            selectedAlgoEntry = algo;
            okBtn.disabled = false;
            buildParamsPanel(algo);
            updateLargePreview(algo, currentGen);
          });
          item.addEventListener('dblclick', () => {
            selectedAlgorithm = algo.id;
            okBtn.disabled = false;
            dlg.querySelector('[data-result="ok"]').click();
          });

          listEl.appendChild(item);
          items.push({ item, thumb, algo });
        }

        // Batch-render thumbnails
        let idx = 0;
        function renderBatch() {
          if (currentGen !== genId) return;
          for (let i = 0; i < 2 && idx < items.length; ++i, ++idx) {
            const { thumb, algo } = items[idx];
            if (currentGen !== genId) return;
            try {
              const { w: tw, h: th } = getTargetDims();
              const pw = Math.max(1, (previewSrc.width * tw / currentW) | 0);
              const ph = Math.max(1, (previewSrc.height * th / currentH) | 0);
              const result = apply(algo.id, previewSrc, pw, ph);
              const tctx = thumb.getContext('2d');
              _drawCheckerboard(tctx, 48, 48, 4);
              _drawFitImageData(tctx, result, 48, 48);
            } catch (e) { /* thumbnail failed */ }
          }
          if (idx < items.length) setTimeout(renderBatch, 16);
        }
        setTimeout(renderBatch, 0);

        // Auto-select first resampler by default
        const first = algos.find(a => a.type === 'resampler') || algos[0];
        if (first) {
          const item = listEl.querySelector(`[data-id="${first.id}"]`);
          if (item) {
            item.classList.add('selected');
            selectedAlgorithm = first.id;
            selectedAlgoEntry = first;
            okBtn.disabled = false;
            buildParamsPanel(first);
            updateLargePreview(first, currentGen);
          }
        }
      }

      // -- Preview ----------------------------------------------------------

      function updateLargePreview(algo, gen) {
        previewCtx.clearRect(0, 0, 192, 192);
        previewCtx.fillStyle = '#808080';
        previewCtx.fillRect(0, 0, 192, 192);
        previewCtx.fillStyle = '#fff';
        previewCtx.font = '11px sans-serif';
        previewCtx.textAlign = 'center';
        previewCtx.fillText('Rendering\u2026', 96, 100);
        setTimeout(() => {
          if (gen !== genId) return;
          try {
            const { w, h } = getTargetDims();
            const pw = Math.max(1, (previewSrc.width * w / currentW) | 0);
            const ph = Math.max(1, (previewSrc.height * h / currentH) | 0);
            const result = apply(algo.id, previewSrc, pw, ph, currentParams);
            previewCtx.clearRect(0, 0, 192, 192);
            _drawCheckerboard(previewCtx, 192, 192, 6);
            _drawFitImageData(previewCtx, result, 192, 192);
          } catch (e) {
            previewCtx.clearRect(0, 0, 192, 192);
            previewCtx.fillStyle = '#808080';
            previewCtx.fillRect(0, 0, 192, 192);
            previewCtx.fillStyle = '#f00';
            previewCtx.font = '11px sans-serif';
            previewCtx.textAlign = 'center';
            previewCtx.fillText('Error', 96, 100);
          }
        }, 16);
      }

      function _drawCheckerboard(ctx, cw, ch, s) {
        for (let cy = 0; cy < ch; cy += s)
          for (let cx = 0; cx < cw; cx += s) {
            ctx.fillStyle = ((cx / s + cy / s) % 2 === 0) ? '#d8d8d8' : '#f0f0f0';
            ctx.fillRect(cx, cy, s, s);
          }
      }

      function _drawFitImageData(ctx, imgData, maxW, maxH) {
        const tmpC = document.createElement('canvas');
        tmpC.width = imgData.width;
        tmpC.height = imgData.height;
        tmpC.getContext('2d').putImageData(imgData, 0, 0);
        const fitScale = Math.min(maxW / imgData.width, maxH / imgData.height);
        const fw = imgData.width * fitScale, fh = imgData.height * fitScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmpC, (maxW - fw) / 2, (maxH - fh) / 2, fw, fh);
      }

      // -- Params panel ------------------------------------------------------

      function buildParamsPanel(algo) {
        paramsEl.innerHTML = '';
        currentParams = {};
        if (!algo || !algo.params) return;
        for (const p of algo.params) {
          currentParams[p.key] = p.default;
          const row = document.createElement('div');
          row.className = 'scaler-param-row';
          const label = document.createElement('label');
          label.textContent = p.label + ':';
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = p.min;
          slider.max = p.max;
          slider.step = p.step;
          slider.value = p.default;
          const val = document.createElement('span');
          val.textContent = p.default;
          slider.addEventListener('input', () => {
            currentParams[p.key] = parseFloat(slider.value);
            val.textContent = slider.value;
            updateLargePreview(algo, genId);
          });
          row.appendChild(label);
          row.appendChild(slider);
          row.appendChild(val);
          paramsEl.appendChild(row);
        }
      }

      // -- Input event wiring -----------------------------------------------

      let updatingDims = false;
      function onWidthChange() {
        if (updatingDims) return;
        updatingDims = true;
        if (lockCheck.checked) {
          const w = parseInt(wInput.value, 10) || 1;
          hInput.value = Math.max(1, Math.round(w / aspect));
        }
        updatingDims = false;
        updateInfo();
        rebuildList();
      }
      function onHeightChange() {
        if (updatingDims) return;
        updatingDims = true;
        if (lockCheck.checked) {
          const h = parseInt(hInput.value, 10) || 1;
          wInput.value = Math.max(1, Math.round(h * aspect));
        }
        updatingDims = false;
        updateInfo();
        rebuildList();
      }
      function onFactorChange() {
        const f = parseFloat(factorInput.value) || 1;
        wInput.value = Math.max(1, Math.round(currentW * f));
        hInput.value = Math.max(1, Math.round(currentH * f));
        updateInfo();
        rebuildList();
      }

      wInput.addEventListener('input', onWidthChange);
      hInput.addEventListener('input', onHeightChange);
      factorInput.addEventListener('input', onFactorChange);
      lockCheck.addEventListener('change', () => { if (lockCheck.checked) onWidthChange(); });

      setMode('size');
      updateInfo();
      rebuildList();
      dlg.classList.add('visible');
      wInput.focus();
      wInput.select();

      // -- Dialog close -----------------------------------------------------

      function handleClick(e) {
        const btn = e.target.closest('[data-result]');
        if (!btn) return;
        dlg.classList.remove('visible');
        dlg.removeEventListener('click', handleClick);
        wInput.removeEventListener('input', onWidthChange);
        hInput.removeEventListener('input', onHeightChange);
        factorInput.removeEventListener('input', onFactorChange);
        ++genId;
        if (btn.dataset.result === 'ok' && selectedAlgorithm) {
          const { w, h } = getTargetDims();
          resolve({ result: 'ok', w, h, algorithmId: selectedAlgorithm, params: currentParams });
        } else
          resolve({ result: 'cancel' });
      }
      dlg.addEventListener('click', handleClick);
    });
  }

  // =======================================================================
  // Export (Paint app wrapper around SZ.System.Drawing.Resizing)
  // =======================================================================

  PaintApp.ScalerEngine = {
    showScalerDialog,
    apply,
    getAvailableForResize,
    CATEGORY
  };
})();
