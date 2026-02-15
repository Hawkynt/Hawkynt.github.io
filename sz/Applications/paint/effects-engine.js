;(function() {
  'use strict';

  const PaintApp = window.PaintApp || (window.PaintApp = {});

  // -----------------------------------------------------------------------
  // Adjustments: pixel-level remapping
  // -----------------------------------------------------------------------
  const Adjustments = {

    brightnessContrast(imageData, brightness, contrast) {
      const d = imageData.data;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.max(0, Math.min(255, factor * (d[i] - 128) + 128 + brightness));
        d[i + 1] = Math.max(0, Math.min(255, factor * (d[i + 1] - 128) + 128 + brightness));
        d[i + 2] = Math.max(0, Math.min(255, factor * (d[i + 2] - 128) + 128 + brightness));
      }
      return imageData;
    },

    hueSaturation(imageData, hueShift, saturationShift, lightnessShift) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        let [h, s, l] = _rgbToHsl(d[i], d[i + 1], d[i + 2]);
        h = (h + hueShift / 360 + 1) % 1;
        s = Math.max(0, Math.min(1, s + saturationShift / 100));
        l = Math.max(0, Math.min(1, l + lightnessShift / 100));
        const [r, g, b] = _hslToRgb(h, s, l);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
      return imageData;
    },

    levels(imageData, blackPoint, whitePoint, gamma) {
      const d = imageData.data;
      const range = Math.max(1, whitePoint - blackPoint);
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; ++c) {
          let v = (d[i + c] - blackPoint) / range;
          v = Math.max(0, Math.min(1, v));
          v = Math.pow(v, 1 / gamma);
          d[i + c] = Math.round(v * 255);
        }
      }
      return imageData;
    },

    invert(imageData) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      return imageData;
    },

    grayscale(imageData) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = gray;
        d[i + 1] = gray;
        d[i + 2] = gray;
      }
      return imageData;
    },

    sepia(imageData) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        d[i] = Math.min(gray + 40, 255);
        d[i + 1] = Math.min(gray + 20, 255);
        d[i + 2] = gray;
      }
      return imageData;
    },

    autoLevels(imageData) {
      const d = imageData.data;
      const minC = [255, 255, 255];
      const maxC = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; ++c) {
          if (d[i + c] < minC[c]) minC[c] = d[i + c];
          if (d[i + c] > maxC[c]) maxC[c] = d[i + c];
        }
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; ++c) {
          const range = maxC[c] - minC[c];
          d[i + c] = range > 0 ? Math.round((d[i + c] - minC[c]) / range * 255) : d[i + c];
        }
      return imageData;
    }
  };

  // -----------------------------------------------------------------------
  // Effects: convolution and pixel effects
  // -----------------------------------------------------------------------
  const Effects = {

    gaussianBlur(imageData, radius) {
      if (radius < 1)
        return imageData;
      const kernel = _buildGaussianKernel(radius);
      const tmp = _cloneImageData(imageData);
      _separableConvolve(imageData, tmp, kernel, imageData.width, imageData.height);
      return imageData;
    },

    sharpen(imageData, amount) {
      // Unsharp mask: sharpened = original + amount * (original - blurred)
      const blurred = _cloneImageData(imageData);
      const kernel = _buildGaussianKernel(2);
      const tmp = _cloneImageData(blurred);
      _separableConvolve(blurred, tmp, kernel, imageData.width, imageData.height);

      const d = imageData.data;
      const bd = blurred.data;
      const factor = amount / 100;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.max(0, Math.min(255, Math.round(d[i] + factor * (d[i] - bd[i]))));
        d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] + factor * (d[i + 1] - bd[i + 1]))));
        d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] + factor * (d[i + 2] - bd[i + 2]))));
      }
      return imageData;
    },

    addNoise(imageData, amount) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; ++c) {
          const noise = (Math.random() * 2 - 1) * amount;
          d[i + c] = Math.max(0, Math.min(255, Math.round(d[i + c] + noise)));
        }
      }
      return imageData;
    },

    pixelate(imageData, size) {
      if (size < 2)
        return imageData;
      const w = imageData.width;
      const h = imageData.height;
      const d = imageData.data;
      for (let by = 0; by < h; by += size)
        for (let bx = 0; bx < w; bx += size) {
          let r = 0, g = 0, b = 0, count = 0;
          const bw = Math.min(size, w - bx);
          const bh = Math.min(size, h - by);
          for (let y = by; y < by + bh; ++y)
            for (let x = bx; x < bx + bw; ++x) {
              const i = (y * w + x) * 4;
              r += d[i];
              g += d[i + 1];
              b += d[i + 2];
              ++count;
            }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          for (let y = by; y < by + bh; ++y)
            for (let x = bx; x < bx + bw; ++x) {
              const i = (y * w + x) * 4;
              d[i] = r;
              d[i + 1] = g;
              d[i + 2] = b;
            }
        }
      return imageData;
    },

    edgeDetect(imageData) {
      const w = imageData.width;
      const h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data;
      const d = imageData.data;

      // Sobel kernels
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < h - 1; ++y)
        for (let x = 1; x < w - 1; ++x) {
          for (let c = 0; c < 3; ++c) {
            let sumX = 0, sumY = 0;
            for (let ky = -1; ky <= 1; ++ky)
              for (let kx = -1; kx <= 1; ++kx) {
                const ki = (ky + 1) * 3 + (kx + 1);
                const si = ((y + ky) * w + (x + kx)) * 4 + c;
                sumX += sd[si] * gx[ki];
                sumY += sd[si] * gy[ki];
              }
            const mag = Math.min(255, Math.sqrt(sumX * sumX + sumY * sumY));
            d[(y * w + x) * 4 + c] = Math.round(mag);
          }
        }
      return imageData;
    },

    emboss(imageData) {
      const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
      return _applyKernel3x3(imageData, kernel, 128);
    }
  };

  // -----------------------------------------------------------------------
  // Helper functions
  // -----------------------------------------------------------------------
  function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [h, s, l];
  }

  function _hslToRgb(h, s, l) {
    if (s === 0)
      return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)];

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    ];
  }

  function _cloneImageData(imgData) {
    return new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
  }

  function _buildGaussianKernel(radius) {
    const size = radius * 2 + 1;
    const sigma = radius / 3;
    const kernel = new Float32Array(size);
    let sum = 0;
    for (let i = 0; i < size; ++i) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    for (let i = 0; i < size; ++i)
      kernel[i] /= sum;
    return kernel;
  }

  function _separableConvolve(imageData, tmp, kernel, w, h) {
    const d = imageData.data;
    const td = tmp.data;
    const r = (kernel.length - 1) / 2;

    // Horizontal pass: imageData -> tmp
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        let rr = 0, gg = 0, bb = 0;
        for (let k = -r; k <= r; ++k) {
          const sx = Math.max(0, Math.min(w - 1, x + k));
          const si = (y * w + sx) * 4;
          const kv = kernel[k + r];
          rr += d[si] * kv;
          gg += d[si + 1] * kv;
          bb += d[si + 2] * kv;
        }
        const di = (y * w + x) * 4;
        td[di] = Math.round(rr);
        td[di + 1] = Math.round(gg);
        td[di + 2] = Math.round(bb);
        td[di + 3] = d[di + 3];
      }

    // Vertical pass: tmp -> imageData
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        let rr = 0, gg = 0, bb = 0;
        for (let k = -r; k <= r; ++k) {
          const sy = Math.max(0, Math.min(h - 1, y + k));
          const si = (sy * w + x) * 4;
          const kv = kernel[k + r];
          rr += td[si] * kv;
          gg += td[si + 1] * kv;
          bb += td[si + 2] * kv;
        }
        const di = (y * w + x) * 4;
        d[di] = Math.round(rr);
        d[di + 1] = Math.round(gg);
        d[di + 2] = Math.round(bb);
      }
  }

  function _applyKernel3x3(imageData, kernel, offset) {
    const w = imageData.width;
    const h = imageData.height;
    const src = _cloneImageData(imageData);
    const sd = src.data;
    const d = imageData.data;

    for (let y = 1; y < h - 1; ++y)
      for (let x = 1; x < w - 1; ++x) {
        for (let c = 0; c < 3; ++c) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ++ky)
            for (let kx = -1; kx <= 1; ++kx) {
              const ki = (ky + 1) * 3 + (kx + 1);
              const si = ((y + ky) * w + (x + kx)) * 4 + c;
              sum += sd[si] * kernel[ki];
            }
          d[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(sum + (offset || 0))));
        }
      }
    return imageData;
  }

  // -----------------------------------------------------------------------
  // Effect dialog system
  // -----------------------------------------------------------------------

  // Opens an effect dialog, returns a Promise resolving to 'ok' or 'cancel'
  // previewFn(imageData, controls) -> applies effect to imageData in place
  function openEffectDialog(dialogId, previewFn, getLayerImageData) {
    return new Promise(resolve => {
      const dlg = document.getElementById(dialogId);
      if (!dlg) {
        resolve('cancel');
        return;
      }
      dlg.classList.add('visible');

      const previewCanvas = dlg.querySelector('.effect-preview');
      const controls = dlg.querySelectorAll('input[type="range"]');
      const spans = dlg.querySelectorAll('.effect-controls span');

      function updatePreview() {
        if (!previewCanvas)
          return;
        const srcData = getLayerImageData();
        const pCtx = previewCanvas.getContext('2d');
        // Scale source to preview size
        const tmp = document.createElement('canvas');
        tmp.width = srcData.width;
        tmp.height = srcData.height;
        const tctx = tmp.getContext('2d');
        tctx.putImageData(srcData, 0, 0);

        const pw = previewCanvas.width;
        const ph = previewCanvas.height;
        pCtx.clearRect(0, 0, pw, ph);
        pCtx.drawImage(tmp, 0, 0, srcData.width, srcData.height, 0, 0, pw, ph);

        const previewData = pCtx.getImageData(0, 0, pw, ph);
        previewFn(previewData, _getControlValues(controls));
        pCtx.putImageData(previewData, 0, 0);
      }

      for (const ctrl of controls) {
        ctrl.addEventListener('input', () => {
          const span = ctrl.parentElement.querySelector('span');
          if (span) span.textContent = ctrl.value;
          updatePreview();
        });
      }

      updatePreview();

      function handleClick(e) {
        const btn = e.target.closest('[data-result]');
        if (!btn)
          return;
        dlg.classList.remove('visible');
        dlg.removeEventListener('click', handleClick);
        resolve({
          result: btn.dataset.result,
          values: _getControlValues(controls)
        });
      }
      dlg.addEventListener('click', handleClick);
    });
  }

  function _getControlValues(controls) {
    const vals = {};
    for (const c of controls)
      vals[c.dataset.param || c.id || c.name] = parseFloat(c.value);
    return vals;
  }

  // Utility: apply an effect to layer image data within a selection mask
  function applyEffectToLayer(layerCtx, selectionEngine, effectFn, w, h) {
    const original = layerCtx.getImageData(0, 0, w, h);
    const working = new ImageData(new Uint8ClampedArray(original.data), w, h);
    effectFn(working);
    layerCtx.putImageData(working, 0, 0);
    if (selectionEngine && selectionEngine.hasMask)
      selectionEngine.applyMaskToLayer(layerCtx, original);
  }

  PaintApp.Adjustments = Adjustments;
  PaintApp.Effects = Effects;
  PaintApp.openEffectDialog = openEffectDialog;
  PaintApp.applyEffectToLayer = applyEffectToLayer;
  PaintApp.cloneImageData = _cloneImageData;
})();
