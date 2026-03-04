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
    },

    // -----------------------------------------------------------------------
    // Blurs
    // -----------------------------------------------------------------------

    motionBlur(imageData, angle, distance) {
      if (distance < 1)
        return imageData;
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let s = -distance; s <= distance; ++s) {
            const sx = Math.round(x + s * dx);
            const sy = Math.round(y + s * dy);
            if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
              const si = (sy * w + sx) * 4;
              r += sd[si];
              g += sd[si + 1];
              b += sd[si + 2];
              ++count;
            }
          }
          const di = (y * w + x) * 4;
          d[di] = Math.round(r / count);
          d[di + 1] = Math.round(g / count);
          d[di + 2] = Math.round(b / count);
        }
      return imageData;
    },

    radialBlur(imageData, amount) {
      if (amount < 1)
        return imageData;
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const cx = w / 2, cy = h / 2;
      const samples = Math.max(3, amount);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          let r = 0, g = 0, b = 0;
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxAngle = (amount / 100) * (dist / Math.max(w, h)) * Math.PI;
          const baseAngle = Math.atan2(dy, dx);
          for (let s = 0; s < samples; ++s) {
            const t = (s / (samples - 1)) * 2 - 1;
            const a = baseAngle + t * maxAngle;
            const sx = Math.round(cx + dist * Math.cos(a));
            const sy = Math.round(cy + dist * Math.sin(a));
            const csx = Math.max(0, Math.min(w - 1, sx));
            const csy = Math.max(0, Math.min(h - 1, sy));
            const si = (csy * w + csx) * 4;
            r += sd[si];
            g += sd[si + 1];
            b += sd[si + 2];
          }
          const di = (y * w + x) * 4;
          d[di] = Math.round(r / samples);
          d[di + 1] = Math.round(g / samples);
          d[di + 2] = Math.round(b / samples);
        }
      return imageData;
    },

    surfaceBlur(imageData, radius, threshold) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const ci = (y * w + x) * 4;
          const cr = sd[ci], cg = sd[ci + 1], cb = sd[ci + 2];
          let sr = 0, sg = 0, sb = 0, sw = 0;
          for (let ky = -radius; ky <= radius; ++ky)
            for (let kx = -radius; kx <= radius; ++kx) {
              const ny = Math.max(0, Math.min(h - 1, y + ky));
              const nx = Math.max(0, Math.min(w - 1, x + kx));
              const ni = (ny * w + nx) * 4;
              const diff = Math.abs(sd[ni] - cr) + Math.abs(sd[ni + 1] - cg) + Math.abs(sd[ni + 2] - cb);
              if (diff <= threshold * 3) {
                const weight = 1 - diff / (threshold * 3 + 1);
                sr += sd[ni] * weight;
                sg += sd[ni + 1] * weight;
                sb += sd[ni + 2] * weight;
                sw += weight;
              }
            }
          if (sw > 0) {
            d[ci] = Math.round(sr / sw);
            d[ci + 1] = Math.round(sg / sw);
            d[ci + 2] = Math.round(sb / sw);
          }
        }
      return imageData;
    },

    boxBlur(imageData, radius) {
      if (radius < 1)
        return imageData;
      const size = radius * 2 + 1;
      const kernel = new Float32Array(size);
      const weight = 1 / size;
      for (let i = 0; i < size; ++i)
        kernel[i] = weight;
      const tmp = _cloneImageData(imageData);
      _separableConvolve(imageData, tmp, kernel, imageData.width, imageData.height);
      return imageData;
    },

    median(imageData, radius) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const side = radius * 2 + 1;
      const area = side * side;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const rs = new Uint8Array(area);
          const gs = new Uint8Array(area);
          const bs = new Uint8Array(area);
          let idx = 0;
          for (let ky = -radius; ky <= radius; ++ky)
            for (let kx = -radius; kx <= radius; ++kx) {
              const ny = Math.max(0, Math.min(h - 1, y + ky));
              const nx = Math.max(0, Math.min(w - 1, x + kx));
              const si = (ny * w + nx) * 4;
              rs[idx] = sd[si];
              gs[idx] = sd[si + 1];
              bs[idx] = sd[si + 2];
              ++idx;
            }
          rs.sort();
          gs.sort();
          bs.sort();
          const mid = area >> 1;
          const di = (y * w + x) * 4;
          d[di] = rs[mid];
          d[di + 1] = gs[mid];
          d[di + 2] = bs[mid];
        }
      return imageData;
    },

    unsharpMask(imageData, amount, radius, threshold) {
      const blurred = _cloneImageData(imageData);
      const kernel = _buildGaussianKernel(radius);
      const tmp = _cloneImageData(blurred);
      _separableConvolve(blurred, tmp, kernel, imageData.width, imageData.height);
      const d = imageData.data, bd = blurred.data;
      const factor = amount / 100;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; ++c) {
          const diff = d[i + c] - bd[i + c];
          if (Math.abs(diff) >= threshold)
            d[i + c] = Math.max(0, Math.min(255, Math.round(d[i + c] + factor * diff)));
        }
      return imageData;
    },

    // -----------------------------------------------------------------------
    // Distort
    // -----------------------------------------------------------------------

    swirl(imageData, angle, radius) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const cx = w / 2, cy = h / 2;
      const rad = angle * Math.PI / 180;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const di = (y * w + x) * 4;
          if (dist < radius) {
            const t = 1 - dist / radius;
            const theta = t * t * rad;
            const cosT = Math.cos(theta), sinT = Math.sin(theta);
            const sx = cx + dx * cosT - dy * sinT;
            const sy = cy + dx * sinT + dy * cosT;
            const x0 = Math.floor(sx), y0 = Math.floor(sy);
            if (x0 >= 0 && x0 < w - 1 && y0 >= 0 && y0 < h - 1) {
              const fx = sx - x0, fy = sy - y0;
              const i00 = (y0 * w + x0) * 4;
              const i10 = i00 + 4;
              const i01 = ((y0 + 1) * w + x0) * 4;
              const i11 = i01 + 4;
              for (let c = 0; c < 3; ++c)
                d[di + c] = Math.round(
                  sd[i00 + c] * (1 - fx) * (1 - fy) + sd[i10 + c] * fx * (1 - fy) +
                  sd[i01 + c] * (1 - fx) * fy + sd[i11 + c] * fx * fy
                );
            } else {
              const csx = Math.max(0, Math.min(w - 1, Math.round(sx)));
              const csy = Math.max(0, Math.min(h - 1, Math.round(sy)));
              const si = (csy * w + csx) * 4;
              d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2];
            }
          }
        }
      return imageData;
    },

    spherize(imageData, amount) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(cx, cy);
      const factor = amount / 100;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const nx = (x - cx) / R, ny = (y - cy) / R;
          const r = Math.sqrt(nx * nx + ny * ny);
          const di = (y * w + x) * 4;
          if (r < 1 && r > 0) {
            const nr = r + factor * r * (1 - r);
            const sx = cx + nx / r * nr * R;
            const sy = cy + ny / r * nr * R;
            const csx = Math.max(0, Math.min(w - 1, Math.round(sx)));
            const csy = Math.max(0, Math.min(h - 1, Math.round(sy)));
            const si = (csy * w + csx) * 4;
            d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2];
          }
        }
      return imageData;
    },

    ripple(imageData, amplitude, wavelength) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const TWO_PI = 2 * Math.PI;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const sx = x + amplitude * Math.sin(TWO_PI * y / wavelength);
          const sy = y + amplitude * Math.sin(TWO_PI * x / wavelength);
          const csx = Math.max(0, Math.min(w - 1, Math.round(sx)));
          const csy = Math.max(0, Math.min(h - 1, Math.round(sy)));
          const si = (csy * w + csx) * 4;
          const di = (y * w + x) * 4;
          d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2];
        }
      return imageData;
    },

    polarCoordinates(imageData) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const cx = w / 2, cy = h / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const r = (x / w) * maxR;
          const theta = (y / h) * 2 * Math.PI;
          const sx = cx + r * Math.cos(theta);
          const sy = cy + r * Math.sin(theta);
          const csx = Math.max(0, Math.min(w - 1, Math.round(sx)));
          const csy = Math.max(0, Math.min(h - 1, Math.round(sy)));
          const si = (csy * w + csx) * 4;
          const di = (y * w + x) * 4;
          d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2]; d[di + 3] = sd[si + 3];
        }
      return imageData;
    },

    frostedGlass(imageData, amount) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const ox = Math.round((Math.random() * 2 - 1) * amount);
          const oy = Math.round((Math.random() * 2 - 1) * amount);
          const sx = Math.max(0, Math.min(w - 1, x + ox));
          const sy = Math.max(0, Math.min(h - 1, y + oy));
          const si = (sy * w + sx) * 4;
          const di = (y * w + x) * 4;
          d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2];
        }
      return imageData;
    },

    // -----------------------------------------------------------------------
    // Stylize
    // -----------------------------------------------------------------------

    oilPaint(imageData, radius, intensity) {
      const w = imageData.width, h = imageData.height;
      const src = _cloneImageData(imageData);
      const sd = src.data, d = imageData.data;
      const buckets = intensity + 1;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const counts = new Uint32Array(buckets);
          const sumR = new Float64Array(buckets);
          const sumG = new Float64Array(buckets);
          const sumB = new Float64Array(buckets);
          for (let ky = -radius; ky <= radius; ++ky)
            for (let kx = -radius; kx <= radius; ++kx) {
              const ny = Math.max(0, Math.min(h - 1, y + ky));
              const nx = Math.max(0, Math.min(w - 1, x + kx));
              const si = (ny * w + nx) * 4;
              const luma = (sd[si] * 0.299 + sd[si + 1] * 0.587 + sd[si + 2] * 0.114) / 255;
              const bucket = Math.min(buckets - 1, Math.floor(luma * intensity));
              ++counts[bucket];
              sumR[bucket] += sd[si];
              sumG[bucket] += sd[si + 1];
              sumB[bucket] += sd[si + 2];
            }
          let maxCount = 0, maxBucket = 0;
          for (let i = 0; i < buckets; ++i)
            if (counts[i] > maxCount) {
              maxCount = counts[i];
              maxBucket = i;
            }
          const di = (y * w + x) * 4;
          d[di] = Math.round(sumR[maxBucket] / maxCount);
          d[di + 1] = Math.round(sumG[maxBucket] / maxCount);
          d[di + 2] = Math.round(sumB[maxBucket] / maxCount);
        }
      return imageData;
    },

    posterize(imageData, levels) {
      const d = imageData.data;
      const n = Math.max(2, levels) - 1;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; ++c)
          d[i + c] = Math.round(Math.round(d[i + c] / 255 * n) / n * 255);
      return imageData;
    },

    threshold(imageData, level) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        const v = gray >= level ? 255 : 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
      }
      return imageData;
    },

    solarize(imageData, threshold) {
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4)
        for (let c = 0; c < 3; ++c)
          d[i + c] = d[i + c] > threshold ? 255 - d[i + c] : d[i + c];
      return imageData;
    },

    relief(imageData) {
      const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
      return _applyKernel3x3(imageData, kernel, 128);
    },

    pencilSketch(imageData, strength) {
      const w = imageData.width, h = imageData.height;
      const d = imageData.data;
      // Convert to grayscale
      const gray = new Uint8Array(w * h);
      for (let i = 0; i < gray.length; ++i)
        gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
      // Invert
      const inv = new ImageData(w, h);
      const id = inv.data;
      for (let i = 0; i < gray.length; ++i) {
        id[i * 4] = 255 - gray[i];
        id[i * 4 + 1] = 255 - gray[i];
        id[i * 4 + 2] = 255 - gray[i];
        id[i * 4 + 3] = 255;
      }
      // Blur the inverted
      const radius = Math.max(1, Math.round(strength / 10));
      const kernel = _buildGaussianKernel(radius);
      const tmp = _cloneImageData(inv);
      _separableConvolve(inv, tmp, kernel, w, h);
      // Color dodge blend: gray / (1 - blurred/255)
      for (let i = 0; i < gray.length; ++i) {
        const blurred = id[i * 4];
        const denom = 255 - blurred;
        const v = denom <= 0 ? 255 : Math.min(255, Math.round(gray[i] * 255 / (denom + 1)));
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v;
      }
      return imageData;
    },

    vignette(imageData, amount, radiusPct) {
      const w = imageData.width, h = imageData.height;
      const d = imageData.data;
      const cx = w / 2, cy = h / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      const innerR = radiusPct / 100;
      const strength = amount / 100;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const dx = (x - cx) / cx, dy = (y - cy) / cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let factor = 1;
          if (dist > innerR) {
            const t = Math.min(1, (dist - innerR) / (1.414 - innerR));
            factor = 1 - strength * t * t;
          }
          const di = (y * w + x) * 4;
          d[di] = Math.round(d[di] * factor);
          d[di + 1] = Math.round(d[di + 1] * factor);
          d[di + 2] = Math.round(d[di + 2] * factor);
        }
      return imageData;
    },

    halftone(imageData, dotSize) {
      const w = imageData.width, h = imageData.height;
      const d = imageData.data;
      // Compute luma for each cell, then fill cell with white bg + black circle
      for (let by = 0; by < h; by += dotSize)
        for (let bx = 0; bx < w; bx += dotSize) {
          const bw = Math.min(dotSize, w - bx);
          const bh = Math.min(dotSize, h - by);
          let lumaSum = 0, count = 0;
          for (let cy = by; cy < by + bh; ++cy)
            for (let cx = bx; cx < bx + bw; ++cx) {
              const i = (cy * w + cx) * 4;
              lumaSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              ++count;
            }
          const avgLuma = lumaSum / count / 255;
          const radius = (1 - avgLuma) * dotSize / 2;
          const ccx = bx + bw / 2, ccy = by + bh / 2;
          for (let cy = by; cy < by + bh; ++cy)
            for (let cx = bx; cx < bx + bw; ++cx) {
              const dx = cx - ccx, dy = cy - ccy;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const i = (cy * w + cx) * 4;
              if (dist <= radius) {
                d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
              } else {
                d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
              }
            }
        }
      return imageData;
    },

    crystallize(imageData, cellSize) {
      const w = imageData.width, h = imageData.height;
      const d = imageData.data;
      // Grid-based Voronoi: seed points at center of each grid cell with slight jitter
      const cols = Math.ceil(w / cellSize);
      const rows = Math.ceil(h / cellSize);
      const seeds = [];
      for (let row = 0; row < rows; ++row)
        for (let col = 0; col < cols; ++col)
          seeds.push({
            x: Math.min(w - 1, Math.floor((col + 0.3 + Math.random() * 0.4) * cellSize)),
            y: Math.min(h - 1, Math.floor((row + 0.3 + Math.random() * 0.4) * cellSize)),
            r: 0, g: 0, b: 0, count: 0
          });
      // Assign each pixel to nearest seed and accumulate color
      const assignment = new Uint32Array(w * h);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const gCol = Math.floor(x / cellSize);
          const gRow = Math.floor(y / cellSize);
          let bestDist = Infinity, bestIdx = 0;
          for (let dr = -1; dr <= 1; ++dr)
            for (let dc = -1; dc <= 1; ++dc) {
              const r = gRow + dr, c = gCol + dc;
              if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
              const idx = r * cols + c;
              const dx = x - seeds[idx].x, dy = y - seeds[idx].y;
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
              }
            }
          assignment[y * w + x] = bestIdx;
          const si = (y * w + x) * 4;
          seeds[bestIdx].r += d[si];
          seeds[bestIdx].g += d[si + 1];
          seeds[bestIdx].b += d[si + 2];
          ++seeds[bestIdx].count;
        }
      // Compute average colors
      for (const s of seeds)
        if (s.count > 0) {
          s.r = Math.round(s.r / s.count);
          s.g = Math.round(s.g / s.count);
          s.b = Math.round(s.b / s.count);
        }
      // Fill pixels with cell colors
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const s = seeds[assignment[y * w + x]];
          const di = (y * w + x) * 4;
          d[di] = s.r; d[di + 1] = s.g; d[di + 2] = s.b;
        }
      return imageData;
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

  // -----------------------------------------------------------------------
  // ImageAnalysis: detection and correction algorithms
  // -----------------------------------------------------------------------
  const ImageAnalysis = {

    _toGrayscale(imageData) {
      const d = imageData.data;
      const len = d.length >> 2;
      const gray = new Float64Array(len);
      for (let i = 0; i < len; ++i)
        gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      return gray;
    },

    _sobelEdges(gray, w, h) {
      const mag = new Float64Array(w * h);
      const angle = new Float64Array(w * h);
      for (let y = 1; y < h - 1; ++y)
        for (let x = 1; x < w - 1; ++x) {
          const idx = y * w + x;
          const gx =
            -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)]
            - 2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)]
            - gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)];
          const gy =
            -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)]
            + gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)];
          mag[idx] = Math.sqrt(gx * gx + gy * gy);
          angle[idx] = Math.atan2(gy, gx);
        }
      return { mag, angle };
    },

    detectSkewAngle(imageData) {
      const w = imageData.width;
      const h = imageData.height;
      // Downsample to 1/4 for performance
      const scale = 4;
      const sw = (w / scale) | 0;
      const sh = (h / scale) | 0;
      if (sw < 4 || sh < 4) return 0;

      const small = document.createElement('canvas');
      small.width = sw;
      small.height = sh;
      const sctx = small.getContext('2d');
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(imageData, 0, 0);
      sctx.drawImage(tmp, 0, 0, w, h, 0, 0, sw, sh);
      const smallData = sctx.getImageData(0, 0, sw, sh);

      const gray = this._toGrayscale(smallData);
      const { mag } = this._sobelEdges(gray, sw, sh);

      const DEG_TO_RAD = Math.PI / 180;
      let bestAngle = 0;
      let bestVariance = -1;

      for (let deg = -150; deg <= 150; ++deg) {
        const angle = deg * 0.1 * DEG_TO_RAD;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const projLen = sh;
        const sums = new Float64Array(projLen);
        const counts = new Float64Array(projLen);

        for (let y = 0; y < sh; ++y)
          for (let x = 0; x < sw; ++x) {
            const m = mag[y * sw + x];
            if (m < 10) continue;
            const py = Math.round(x * sinA + y * cosA);
            if (py >= 0 && py < projLen) {
              sums[py] += m;
              ++counts[py];
            }
          }

        let mean = 0, count = 0;
        for (let i = 0; i < projLen; ++i)
          if (counts[i] > 0) {
            mean += sums[i];
            ++count;
          }
        if (count < 2) continue;
        mean /= count;

        let variance = 0;
        for (let i = 0; i < projLen; ++i)
          if (counts[i] > 0) {
            const d = sums[i] - mean;
            variance += d * d;
          }
        variance /= count;

        if (variance > bestVariance) {
          bestVariance = variance;
          bestAngle = angle;
        }
      }
      return bestAngle;
    },

    detectDominantRotation(imageData) {
      const w = imageData.width;
      const h = imageData.height;
      const gray = this._toGrayscale(imageData);
      const { mag, angle } = this._sobelEdges(gray, w, h);

      // Bin edge directions into 180 1-degree buckets weighted by magnitude
      const bins = new Float64Array(180);
      for (let i = 0; i < mag.length; ++i) {
        if (mag[i] < 20) continue;
        let deg = (angle[i] * 180 / Math.PI + 360) % 180;
        const bin = Math.round(deg) % 180;
        bins[bin] += mag[i];
      }

      // Find dominant bin
      let maxBin = 0, maxVal = 0;
      for (let i = 0; i < 180; ++i)
        if (bins[i] > maxVal) {
          maxVal = bins[i];
          maxBin = i;
        }

      // Snap dominant edge direction to nearest 90 degrees
      // Edge angles: 0=horizontal edges, 90=vertical edges
      // The dominant angle tells us about edge orientation
      const snapped = Math.round(maxBin / 90) * 90;
      const rotation = (snapped - maxBin + 180) % 180;
      // Map to 0, 90, 180, 270
      if (Math.abs(rotation) < 5) return 0;
      if (Math.abs(rotation - 90) < 5 || Math.abs(rotation + 90) < 5) return 90;
      if (Math.abs(rotation - 180) < 5 || Math.abs(rotation + 180) < 5) return 180;
      return 0;
    },

    detectKeystoneCorners(imageData) {
      const w = imageData.width;
      const h = imageData.height;
      const gray = this._toGrayscale(imageData);
      const { mag } = this._sobelEdges(gray, w, h);

      const threshold = 50;
      const margin = Math.max(w, h) * 0.3;

      // Find closest strong edge pixel to each corner
      const corners = [
        { cx: 0, cy: 0 },           // top-left
        { cx: w - 1, cy: 0 },       // top-right
        { cx: w - 1, cy: h - 1 },   // bottom-right
        { cx: 0, cy: h - 1 }        // bottom-left
      ];

      const result = [];
      for (const { cx, cy } of corners) {
        let bestDist = Infinity;
        let bestX = cx, bestY = cy;
        const x0 = Math.max(0, cx - margin | 0);
        const x1 = Math.min(w - 1, cx + margin | 0);
        const y0 = Math.max(0, cy - margin | 0);
        const y1 = Math.min(h - 1, cy + margin | 0);
        for (let y = y0; y <= y1; ++y)
          for (let x = x0; x <= x1; ++x) {
            if (mag[y * w + x] < threshold) continue;
            const dx = x - cx, dy = y - cy;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
              bestDist = d;
              bestX = x;
              bestY = y;
            }
          }
        if (bestDist === Infinity) return null;
        result.push({ x: bestX, y: bestY });
      }
      return result;
    },

    _solvePerspective(src, dst) {
      // Solve 8x8 system for perspective transform coefficients
      // Maps src[i] -> dst[i] for 4 point pairs
      const A = [];
      const b = [];
      for (let i = 0; i < 4; ++i) {
        const sx = src[i].x, sy = src[i].y;
        const dx = dst[i].x, dy = dst[i].y;
        A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
        b.push(dx);
        A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
        b.push(dy);
      }
      // Gaussian elimination
      const n = 8;
      for (let col = 0; col < n; ++col) {
        let maxRow = col, maxVal = Math.abs(A[col][col]);
        for (let row = col + 1; row < n; ++row) {
          const v = Math.abs(A[row][col]);
          if (v > maxVal) { maxVal = v; maxRow = row; }
        }
        if (maxVal < 1e-10) return null;
        if (maxRow !== col) {
          [A[col], A[maxRow]] = [A[maxRow], A[col]];
          [b[col], b[maxRow]] = [b[maxRow], b[col]];
        }
        for (let row = col + 1; row < n; ++row) {
          const factor = A[row][col] / A[col][col];
          for (let k = col; k < n; ++k)
            A[row][k] -= factor * A[col][k];
          b[row] -= factor * b[col];
        }
      }
      // Back-substitution
      const x = new Array(n);
      for (let i = n - 1; i >= 0; --i) {
        let sum = b[i];
        for (let j = i + 1; j < n; ++j)
          sum -= A[i][j] * x[j];
        x[i] = sum / A[i][i];
      }
      return x; // [a, b, c, d, e, f, g, h] where x' = (ax+by+c)/(gx+hy+1), y' = (dx+ey+f)/(gx+hy+1)
    },

    perspectiveWarp(imageData, srcCorners) {
      const w = imageData.width;
      const h = imageData.height;
      const sd = imageData.data;

      const dstCorners = [
        { x: 0, y: 0 },
        { x: w - 1, y: 0 },
        { x: w - 1, y: h - 1 },
        { x: 0, y: h - 1 }
      ];

      // Solve inverse mapping: for each dst pixel, find src pixel
      const coeffs = this._solvePerspective(dstCorners, srcCorners);
      if (!coeffs) return imageData;

      const [a, b, c, d, e, f, g, hh] = coeffs;
      const dst = new ImageData(w, h);
      const dd = dst.data;

      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const denom = g * x + hh * y + 1;
          if (Math.abs(denom) < 1e-10) continue;
          const sx = (a * x + b * y + c) / denom;
          const sy = (d * x + e * y + f) / denom;

          // Bilinear interpolation
          const x0 = Math.floor(sx), y0 = Math.floor(sy);
          const x1 = x0 + 1, y1 = y0 + 1;
          if (x0 < 0 || y0 < 0 || x1 >= w || y1 >= h) continue;

          const fx = sx - x0, fy = sy - y0;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;

          const i00 = (y0 * w + x0) * 4;
          const i10 = (y0 * w + x1) * 4;
          const i01 = (y1 * w + x0) * 4;
          const i11 = (y1 * w + x1) * 4;
          const di = (y * w + x) * 4;

          for (let ch = 0; ch < 4; ++ch)
            dd[di + ch] = Math.round(
              sd[i00 + ch] * w00 + sd[i10 + ch] * w10 +
              sd[i01 + ch] * w01 + sd[i11 + ch] * w11
            );
        }
      return dst;
    }
  };

  PaintApp.Adjustments = Adjustments;
  PaintApp.Effects = Effects;
  PaintApp.ImageAnalysis = ImageAnalysis;
  PaintApp.openEffectDialog = openEffectDialog;
  PaintApp.applyEffectToLayer = applyEffectToLayer;
  PaintApp.cloneImageData = _cloneImageData;
})();
