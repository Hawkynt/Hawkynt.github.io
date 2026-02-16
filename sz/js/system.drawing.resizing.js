;(function(global) {
  'use strict';

  const SZ = global.SZ = global.SZ || {};
  SZ.System = SZ.System || {};
  SZ.System.Drawing = SZ.System.Drawing || {};

  // =======================================================================
  // Color Helpers
  // =======================================================================

  function getPixel(data, w, h, x, y) {
    if (x < 0) x = 0;
    else if (x >= w) x = w - 1;
    if (y < 0) y = 0;
    else if (y >= h) y = h - 1;
    const i = (y * w + x) << 2;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  function setPixel(data, w, x, y, rgba) {
    const i = (y * w + x) << 2;
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }

  // YUV-weighted color equality (thresholds: Y=48, U=7, V=6)
  function colorsEqual(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    const dy = Math.abs(0.299 * dr + 0.587 * dg + 0.114 * db);
    const du = Math.abs(-0.169 * dr - 0.331 * dg + 0.5 * db);
    const dv = Math.abs(0.5 * dr - 0.419 * dg - 0.081 * db);
    return dy < 48 && du < 7 && dv < 6;
  }

  function colorDist(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2], da = a[3] - b[3];
    return dr * dr + dg * dg + db * db + da * da;
  }

  function luma(c) {
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  }

  function lerp2(a, b) {
    return [(a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1, (a[2] + b[2]) >> 1, (a[3] + b[3]) >> 1];
  }

  function lerp2w(a, b, wa, wb) {
    const t = wa + wb;
    return [
      (a[0] * wa + b[0] * wb) / t | 0, (a[1] * wa + b[1] * wb) / t | 0,
      (a[2] * wa + b[2] * wb) / t | 0, (a[3] * wa + b[3] * wb) / t | 0
    ];
  }

  function lerp3w(a, b, c, wa, wb, wc) {
    const t = wa + wb + wc;
    return [
      (a[0] * wa + b[0] * wb + c[0] * wc) / t | 0, (a[1] * wa + b[1] * wb + c[1] * wc) / t | 0,
      (a[2] * wa + b[2] * wb + c[2] * wc) / t | 0, (a[3] * wa + b[3] * wb + c[3] * wc) / t | 0
    ];
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // =======================================================================
  // Registry
  // =======================================================================

  const CATEGORY = { PIXEL_ART: 'Pixel Art', RESAMPLER: 'Resampler' };
  const _scalers = [];
  const _resamplers = [];
  const _byId = new Map();

  function registerScaler(id, name, scales, fn) {
    const entry = { id, name, category: CATEGORY.PIXEL_ART, scales, fn, type: 'scaler' };
    _scalers.push(entry);
    _byId.set(id, entry);
  }

  function registerResampler(id, name, fn, params) {
    const entry = { id, name, category: CATEGORY.RESAMPLER, scales: null, fn, type: 'resampler', params: params || null };
    _resamplers.push(entry);
    _byId.set(id, entry);
  }

  function getAvailableForResize(srcW, srcH, dstW, dstH) {
    const result = [];
    if (dstW > srcW && dstH > srcH) {
      const scaleX = dstW / srcW;
      const scaleY = dstH / srcH;
      if (Number.isInteger(scaleX) && Number.isInteger(scaleY) && scaleX === scaleY)
        for (const s of _scalers)
          if (s.scales.includes(scaleX))
            result.push(s);
    }
    for (const r of _resamplers)
      result.push(r);
    return result;
  }

  function apply(id, srcImageData, targetW, targetH, params) {
    const entry = _byId.get(id);
    if (!entry)
      return srcImageData;
    if (entry.type === 'scaler') {
      const scale = targetW / srcImageData.width;
      return entry.fn(srcImageData, scale);
    }
    if (entry.params && params)
      return entry.fn(srcImageData, targetW, targetH, params);
    return entry.fn(srcImageData, targetW, targetH);
  }

  // =======================================================================
  // Shared Separable 2-Pass Resampler Loop
  // =======================================================================

  function resample(src, dstW, dstH, radius, kernelFn) {
    const srcW = src.width, srcH = src.height;
    const sd = src.data;

    // Pass 1: horizontal (srcW -> dstW, keep srcH)
    const tmpW = dstW, tmpH = srcH;
    const tmp = new Float64Array(tmpW * tmpH * 4);
    const scaleX = srcW / dstW;
    const offsetX = 0.5 * scaleX - 0.5;

    for (let y = 0; y < tmpH; ++y)
      for (let x = 0; x < tmpW; ++x) {
        const srcXf = x * scaleX + offsetX;
        const srcXi = Math.floor(srcXf);
        const fx = srcXf - srcXi;
        let wSum = 0, r = 0, g = 0, b = 0, a = 0;
        for (let k = -radius + 1; k <= radius; ++k) {
          const w = kernelFn(fx - k);
          if (Math.abs(w) < 1e-6) continue;
          const sx = clamp(srcXi + k, 0, srcW - 1);
          const si = (y * srcW + sx) << 2;
          r += sd[si] * w;
          g += sd[si + 1] * w;
          b += sd[si + 2] * w;
          a += sd[si + 3] * w;
          wSum += w;
        }
        const ti = (y * tmpW + x) * 4;
        if (Math.abs(wSum) > 1e-6) {
          tmp[ti] = r / wSum; tmp[ti + 1] = g / wSum;
          tmp[ti + 2] = b / wSum; tmp[ti + 3] = a / wSum;
        }
      }

    // Pass 2: vertical (tmpH -> dstH, keep dstW)
    const dst = new ImageData(dstW, dstH);
    const dd = dst.data;
    const scaleY = srcH / dstH;
    const offsetY = 0.5 * scaleY - 0.5;

    for (let x = 0; x < dstW; ++x)
      for (let y = 0; y < dstH; ++y) {
        const srcYf = y * scaleY + offsetY;
        const srcYi = Math.floor(srcYf);
        const fy = srcYf - srcYi;
        let wSum = 0, r = 0, g = 0, b = 0, a = 0;
        for (let k = -radius + 1; k <= radius; ++k) {
          const w = kernelFn(fy - k);
          if (Math.abs(w) < 1e-6) continue;
          const sy = clamp(srcYi + k, 0, tmpH - 1);
          const ti = (sy * tmpW + x) * 4;
          r += tmp[ti] * w; g += tmp[ti + 1] * w;
          b += tmp[ti + 2] * w; a += tmp[ti + 3] * w;
          wSum += w;
        }
        const di = (y * dstW + x) << 2;
        if (Math.abs(wSum) > 1e-6) {
          dd[di] = clamp(r / wSum | 0, 0, 255);
          dd[di + 1] = clamp(g / wSum | 0, 0, 255);
          dd[di + 2] = clamp(b / wSum | 0, 0, 255);
          dd[di + 3] = clamp(a / wSum | 0, 0, 255);
        }
      }
    return dst;
  }

  function resampleNearest(src, dw, dh) {
    const sw = src.width, sh = src.height;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const scaleX = sw / dw, scaleY = sh / dh;
    for (let y = 0; y < dh; ++y) {
      const sy = clamp((y * scaleY + 0.5 * scaleY - 0.5) | 0, 0, sh - 1);
      for (let x = 0; x < dw; ++x) {
        const sx = clamp((x * scaleX + 0.5 * scaleX - 0.5) | 0, 0, sw - 1);
        const si = (sy * sw + sx) << 2;
        const di = (y * dw + x) << 2;
        dd[di] = sd[si]; dd[di + 1] = sd[si + 1]; dd[di + 2] = sd[si + 2]; dd[di + 3] = sd[si + 3];
      }
    }
    return dst;
  }

  // =======================================================================
  // HQ Pattern Helper (shared by HQ and LQ families)
  // =======================================================================

  function hqComputePattern(neighbors) {
    let pat = 0;
    for (let i = 0; i < 9; ++i) {
      if (i === 4) continue;
      const bit = i < 4 ? i : i - 1;
      if (!colorsEqual(neighbors[4], neighbors[i]))
        pat |= (1 << bit);
    }
    return pat;
  }

  // =======================================================================
  // Shorthand aliases for algorithm code
  // =======================================================================

  const g_ = getPixel, s_ = setPixel, eq = colorsEqual, dist = colorDist;

  // #####################################################################
  // PIXEL ART SCALERS
  // #####################################################################

  // =======================================================================
  // Nearest Neighbor (Simple) 2x-6x
  // =======================================================================

  function _nearestScale(src, scale) {
    const sw = src.width, sh = src.height;
    const dw = sw * scale, dh = sh * scale;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    for (let y = 0; y < dh; ++y) {
      const sy = (y / scale) | 0;
      for (let x = 0; x < dw; ++x) {
        const sx = (x / scale) | 0;
        const si = (sy * sw + sx) << 2;
        const di = (y * dw + x) << 2;
        dd[di] = sd[si]; dd[di + 1] = sd[si + 1]; dd[di + 2] = sd[si + 2]; dd[di + 3] = sd[si + 3];
      }
    }
    return dst;
  }
  registerScaler('nearest-2x', 'Nearest 2x', [2], (s) => _nearestScale(s, 2));
  registerScaler('nearest-3x', 'Nearest 3x', [3], (s) => _nearestScale(s, 3));
  registerScaler('nearest-4x', 'Nearest 4x', [4], (s) => _nearestScale(s, 4));
  registerScaler('nearest-5x', 'Nearest 5x', [5], (s) => _nearestScale(s, 5));
  registerScaler('nearest-6x', 'Nearest 6x', [6], (s) => _nearestScale(s, 6));

  // =======================================================================
  // Eagle 2x
  // =======================================================================

  function _eagle2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const c = g(x, y);
        const a = g(x - 1, y - 1), b = g(x, y - 1), cc = g(x + 1, y - 1);
        const d = g(x - 1, y), f = g(x + 1, y);
        const gg = g(x - 1, y + 1), h = g(x, y + 1), ii = g(x + 1, y + 1);
        let e00 = c, e01 = c, e10 = c, e11 = c;
        if (eq(a, b) && eq(a, d)) e00 = a;
        if (eq(cc, b) && eq(cc, f)) e01 = cc;
        if (eq(gg, d) && eq(gg, h)) e10 = gg;
        if (eq(ii, f) && eq(ii, h)) e11 = ii;
        s_(dd, dw, x * 2, y * 2, e00);
        s_(dd, dw, x * 2 + 1, y * 2, e01);
        s_(dd, dw, x * 2, y * 2 + 1, e10);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e11);
      }
    return dst;
  }
  registerScaler('eagle-2x', 'Eagle 2x', [2], _eagle2x);

  // =======================================================================
  // Eagle 3x
  // =======================================================================

  function _eagle3x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 3, dh = sh * 3;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const c0 = g(x - 1, y - 1), c1 = g(x, y - 1), c2 = g(x + 1, y - 1);
        const c3 = g(x - 1, y), c4 = g(x, y), c5 = g(x + 1, y);
        const c6 = g(x - 1, y + 1), c7 = g(x, y + 1), c8 = g(x + 1, y + 1);
        const e = [c4, c4, c4, c4, c4, c4, c4, c4, c4];
        const corner00 = eq(c0, c1) && eq(c0, c3);
        const corner02 = eq(c2, c1) && eq(c2, c5);
        const corner20 = eq(c6, c3) && eq(c6, c7);
        const corner22 = eq(c8, c5) && eq(c8, c7);
        if (corner00) e[0] = lerp3w(lerp2(c0, c1), c3, c4, 2, 1, 0);
        if (corner02) e[2] = lerp3w(lerp2(c2, c1), c5, c4, 2, 1, 0);
        if (corner20) e[6] = lerp3w(lerp2(c6, c3), c7, c4, 2, 1, 0);
        if (corner22) e[8] = lerp3w(lerp2(c8, c5), c7, c4, 2, 1, 0);
        if (corner00 && corner02) e[1] = lerp2(e[0], e[2]);
        if (corner02 && corner22) e[5] = lerp2(e[2], e[8]);
        if (corner20 && corner22) e[7] = lerp2(e[6], e[8]);
        if (corner00 && corner20) e[3] = lerp2(e[0], e[6]);
        const ox = x * 3, oy = y * 3;
        for (let dy = 0; dy < 3; ++dy)
          for (let dx = 0; dx < 3; ++dx)
            s_(dd, dw, ox + dx, oy + dy, e[dy * 3 + dx]);
      }
    return dst;
  }
  registerScaler('eagle-3x', 'Eagle 3x', [3], _eagle3x);

  // =======================================================================
  // EPX / Scale2x
  // =======================================================================

  function _epx2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const p = g(x, y);
        const a = g(x, y - 1), b = g(x + 1, y);
        const c = g(x - 1, y), d = g(x, y + 1);
        let e0 = p, e1 = p, e2 = p, e3 = p;
        if (eq(c, a) && !eq(c, d) && !eq(a, b)) e0 = a;
        if (eq(a, b) && !eq(a, c) && !eq(b, d)) e1 = b;
        if (eq(d, c) && !eq(d, b) && !eq(c, a)) e2 = c;
        if (eq(b, d) && !eq(b, a) && !eq(d, c)) e3 = d;
        s_(dd, dw, x * 2, y * 2, e0);
        s_(dd, dw, x * 2 + 1, y * 2, e1);
        s_(dd, dw, x * 2, y * 2 + 1, e2);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e3);
      }
    return dst;
  }
  registerScaler('epx-2x', 'EPX / Scale2x', [2], _epx2x);

  // =======================================================================
  // EPX3 / Scale3x
  // =======================================================================

  function _epx3x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 3, dh = sh * 3;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const c0 = g(x - 1, y - 1), c1 = g(x, y - 1), c2 = g(x + 1, y - 1);
        const c3 = g(x - 1, y), c4 = g(x, y), c5 = g(x + 1, y);
        const c6 = g(x - 1, y + 1), c7 = g(x, y + 1), c8 = g(x + 1, y + 1);
        const e = [c4, c4, c4, c4, c4, c4, c4, c4, c4];
        if (!(eq(c3, c5) || eq(c7, c1))) {
          const eq13 = eq(c1, c3) && (!eq(c4, c0) || !eq(c4, c8) || !eq(c1, c2) || !eq(c3, c6));
          const eq37 = eq(c3, c7) && (!eq(c4, c6) || !eq(c4, c2) || !eq(c3, c0) || !eq(c7, c8));
          const eq75 = eq(c7, c5) && (!eq(c4, c8) || !eq(c4, c0) || !eq(c7, c6) || !eq(c5, c2));
          const eq51 = eq(c5, c1) && (!eq(c4, c2) || !eq(c4, c6) || !eq(c5, c8) || !eq(c1, c0));
          if (eq13) e[0] = lerp2(c1, c3);
          if (eq51) e[2] = lerp2(c5, c1);
          if (eq37) e[6] = lerp2(c3, c7);
          if (eq75) e[8] = lerp2(c7, c5);
          if (eq51 && !eq(c4, c0) && eq13 && !eq(c4, c2))
            e[1] = lerp3w(lerp2(c1, c3), c5, c4, 2, 1, 0);
          else if (eq51 && !eq(c4, c0)) e[1] = lerp2(c1, c5);
          else if (eq13 && !eq(c4, c2)) e[1] = lerp2(c1, c3);
          if (eq13 && !eq(c4, c6) && eq37 && !eq(c4, c0))
            e[3] = lerp3w(lerp2(c3, c1), c7, c4, 2, 1, 0);
          else if (eq13 && !eq(c4, c6)) e[3] = lerp2(c3, c1);
          else if (eq37 && !eq(c4, c0)) e[3] = lerp2(c3, c7);
          if (eq75 && !eq(c4, c2) && eq51 && !eq(c4, c8))
            e[5] = lerp3w(lerp2(c5, c1), c7, c4, 2, 1, 0);
          else if (eq75 && !eq(c4, c2)) e[5] = lerp2(c5, c7);
          else if (eq51 && !eq(c4, c8)) e[5] = lerp2(c5, c1);
          if (eq37 && !eq(c4, c8) && eq75 && !eq(c4, c6))
            e[7] = lerp3w(lerp2(c7, c3), c5, c4, 2, 1, 0);
          else if (eq75 && !eq(c4, c6)) e[7] = lerp2(c7, c5);
          else if (eq37 && !eq(c4, c8)) e[7] = lerp2(c7, c3);
        }
        const ox = x * 3, oy = y * 3;
        for (let dy = 0; dy < 3; ++dy)
          for (let dx = 0; dx < 3; ++dx)
            s_(dd, dw, ox + dx, oy + dy, e[dy * 3 + dx]);
      }
    return dst;
  }
  registerScaler('epx-3x', 'EPX3 / Scale3x', [3], _epx3x);

  // =======================================================================
  // 2xSAI
  // =======================================================================

  function _sai2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const a = g(x - 1, y - 1), b = g(x, y - 1), c = g(x + 1, y - 1);
        const d = g(x - 1, y), e = g(x, y), f = g(x + 1, y);
        const gg = g(x - 1, y + 1), h = g(x, y + 1), ii = g(x + 1, y + 1);
        const j = g(x + 2, y - 1), k = g(x + 2, y), l = g(x + 2, y + 1);
        const m = g(x, y + 2), n = g(x + 1, y + 2);
        let e0, e1, e2, e3;
        if (eq(e, k) && eq(e, h)) {
          e0 = e;
          e1 = eq(e, f) ? e : lerp2(e, f);
          e2 = eq(e, gg) ? e : lerp2(e, gg);
          e3 = e;
        } else if (eq(e, b) && eq(e, d)) {
          e0 = e;
          e1 = eq(e, f) ? e : lerp2(e, f);
          e2 = eq(e, h) ? e : lerp2(e, h);
          e3 = e;
        } else {
          e0 = e;
          e1 = (eq(b, f) && !eq(e, j)) ? lerp2(b, f) :
               (eq(e, b) || eq(e, f)) ? e : lerp2(e, lerp2(b, f));
          e2 = (eq(d, h) && !eq(e, m)) ? lerp2(d, h) :
               (eq(e, d) || eq(e, h)) ? e : lerp2(e, lerp2(d, h));
          if (eq(b, f) && eq(d, h))
            e3 = eq(e, h) ? lerp2(e, f) : lerp2(e, lerp2(b, d));
          else if (eq(b, f)) e3 = lerp2(b, f);
          else if (eq(d, h)) e3 = lerp2(d, h);
          else e3 = lerp2(e, lerp2(lerp2(b, f), lerp2(d, h)));
        }
        s_(dd, dw, x * 2, y * 2, e0);
        s_(dd, dw, x * 2 + 1, y * 2, e1);
        s_(dd, dw, x * 2, y * 2 + 1, e2);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e3);
      }
    return dst;
  }
  registerScaler('sai-2x', '2xSAI', [2], _sai2x);

  // =======================================================================
  // Super 2xSAI
  // =======================================================================

  function _superSai2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const a = g(x - 1, y - 1), b = g(x, y - 1), c = g(x + 1, y - 1), d = g(x + 2, y - 1);
        const e = g(x - 1, y), f = g(x, y), gg = g(x + 1, y), h = g(x + 2, y);
        const ii = g(x - 1, y + 1), j = g(x, y + 1), k = g(x + 1, y + 1), l = g(x + 2, y + 1);
        const m = g(x - 1, y + 2), n = g(x, y + 2), o = g(x + 1, y + 2);
        let e0 = f, e1, e2, e3;
        // Top-right
        if (eq(f, k) && !eq(gg, j)) e1 = f;
        else if (eq(gg, j) && !eq(f, k)) e1 = gg;
        else if (eq(f, k) && eq(gg, j)) {
          if (eq(f, gg)) e1 = f;
          else {
            let r = 0;
            if (eq(b, gg)) ++r; if (eq(j, l)) ++r;
            if (eq(e, f)) ++r; if (eq(k, o)) ++r;
            e1 = r <= 2 ? lerp2(f, gg) : gg;
          }
        } else {
          if (eq(gg, b) && eq(gg, n)) e1 = lerp2w(f, gg, 1, 3);
          else if (eq(f, j) && eq(f, c)) e1 = lerp2w(f, gg, 3, 1);
          else e1 = lerp2(f, gg);
        }
        // Bottom-left
        if (eq(f, k) && !eq(j, gg)) e2 = f;
        else if (eq(j, gg) && !eq(f, k)) e2 = j;
        else if (eq(f, k) && eq(j, gg)) {
          if (eq(f, j)) e2 = f;
          else {
            let r = 0;
            if (eq(e, j)) ++r; if (eq(gg, d)) ++r;
            if (eq(ii, f)) ++r; if (eq(k, o)) ++r;
            e2 = r <= 2 ? lerp2(f, j) : j;
          }
        } else {
          if (eq(f, e) && eq(f, k)) e2 = lerp2w(j, f, 1, 3);
          else if (eq(j, ii) && eq(j, n)) e2 = lerp2w(j, f, 3, 1);
          else e2 = lerp2(f, j);
        }
        // Bottom-right
        if (eq(f, k)) e3 = f;
        else if (eq(gg, j)) e3 = lerp2(f, gg);
        else e3 = lerp2(f, lerp2(gg, j));
        s_(dd, dw, x * 2, y * 2, e0);
        s_(dd, dw, x * 2 + 1, y * 2, e1);
        s_(dd, dw, x * 2, y * 2 + 1, e2);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e3);
      }
    return dst;
  }
  registerScaler('super-sai-2x', 'Super 2xSAI', [2], _superSai2x);

  // =======================================================================
  // Super Eagle 2x
  // =======================================================================

  function _superEagle2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const b = g(x, y - 1), c = g(x + 1, y - 1);
        const d = g(x - 1, y), e = g(x, y), f = g(x + 1, y);
        const gg = g(x - 1, y + 1), h = g(x, y + 1), ii = g(x + 1, y + 1);
        let e0, e1, e2, e3;
        if (eq(e, ii) && !eq(f, h)) {
          e0 = eq(e, d) || eq(e, b) ? lerp2(e, lerp2(e, d)) : lerp2(e, f);
          e1 = eq(e, f) || eq(e, b) ? lerp2(e, lerp2(e, f)) : lerp2(e, f);
          e2 = eq(e, d) || eq(e, h) ? lerp2(e, lerp2(e, h)) : lerp2(e, h);
          e3 = e;
        } else if (eq(f, h) && !eq(e, ii)) {
          e0 = eq(f, b) || eq(e, d) ? lerp2(e, lerp2(f, b)) : lerp2(e, f);
          e1 = f;
          e2 = eq(h, gg) || eq(e, d) ? lerp2(e, lerp2(h, gg)) : lerp2(e, h);
          e3 = f;
        } else if (eq(e, ii) && eq(f, h)) {
          if (eq(e, f)) e0 = e1 = e2 = e3 = e;
          else {
            e0 = lerp2(e, d); e1 = lerp2(f, c);
            e2 = lerp2(e, gg); e3 = lerp2(f, ii);
          }
        } else {
          e0 = lerp2(e, lerp2(d, b)); e1 = lerp2(f, lerp2(c, b));
          e2 = lerp2(e, lerp2(gg, h)); e3 = lerp2(f, lerp2(ii, h));
        }
        s_(dd, dw, x * 2, y * 2, e0);
        s_(dd, dw, x * 2 + 1, y * 2, e1);
        s_(dd, dw, x * 2, y * 2 + 1, e2);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e3);
      }
    return dst;
  }
  registerScaler('super-eagle-2x', 'Super Eagle 2x', [2], _superEagle2x);

  // =======================================================================
  // HQ Corner/Edge helpers
  // =======================================================================

  function _hqCorner(pat, w, diag, adj1, adj2) {
    const center = w[4];
    const diagBit = diag < 4 ? diag : diag - 1;
    const adj1Bit = adj1 < 4 ? adj1 : adj1 - 1;
    const adj2Bit = adj2 < 4 ? adj2 : adj2 - 1;
    const dDiff = (pat >> diagBit) & 1;
    const a1Diff = (pat >> adj1Bit) & 1;
    const a2Diff = (pat >> adj2Bit) & 1;
    if (!dDiff && !a1Diff && !a2Diff)
      return lerp3w(center, w[adj1], w[adj2], 2, 1, 1);
    if (!dDiff && a1Diff && a2Diff)
      return lerp2w(center, w[diag], 3, 1);
    if (!a1Diff && a2Diff)
      return dDiff ? lerp2w(center, w[adj1], 3, 1) : lerp3w(center, w[adj1], w[diag], 5, 2, 1);
    if (!a2Diff && a1Diff)
      return dDiff ? lerp2w(center, w[adj2], 3, 1) : lerp3w(center, w[adj2], w[diag], 5, 2, 1);
    return center;
  }

  function _hqEdge(pat, w, idx) {
    const bit = idx < 4 ? idx : idx - 1;
    return ((pat >> bit) & 1) ? w[4] : lerp2w(w[4], w[idx], 3, 1);
  }

  // =======================================================================
  // HQ 2x
  // =======================================================================

  function _hq2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const w = [];
        for (let dy = -1; dy <= 1; ++dy)
          for (let dx = -1; dx <= 1; ++dx)
            w.push(g(x + dx, y + dy));
        const pat = hqComputePattern(w);
        const e00 = _hqCorner(pat, w, 0, 1, 3);
        const e01 = _hqCorner(pat, w, 2, 1, 5);
        const e10 = _hqCorner(pat, w, 6, 3, 7);
        const e11 = _hqCorner(pat, w, 8, 5, 7);
        s_(dd, dw, x * 2, y * 2, e00);
        s_(dd, dw, x * 2 + 1, y * 2, e01);
        s_(dd, dw, x * 2, y * 2 + 1, e10);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e11);
      }
    return dst;
  }
  registerScaler('hq-2x', 'HQ 2x', [2], _hq2x);

  // =======================================================================
  // HQ 3x
  // =======================================================================

  function _hq3x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 3, dh = sh * 3;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const w = [];
        for (let dy = -1; dy <= 1; ++dy)
          for (let dx = -1; dx <= 1; ++dx)
            w.push(g(x + dx, y + dy));
        const pat = hqComputePattern(w);
        const e = new Array(9);
        e[4] = w[4];
        e[0] = _hqCorner(pat, w, 0, 1, 3);
        e[2] = _hqCorner(pat, w, 2, 1, 5);
        e[6] = _hqCorner(pat, w, 6, 3, 7);
        e[8] = _hqCorner(pat, w, 8, 5, 7);
        e[1] = _hqEdge(pat, w, 1);
        e[3] = _hqEdge(pat, w, 3);
        e[5] = _hqEdge(pat, w, 5);
        e[7] = _hqEdge(pat, w, 7);
        const ox = x * 3, oy = y * 3;
        for (let dy = 0; dy < 3; ++dy)
          for (let dx = 0; dx < 3; ++dx)
            s_(dd, dw, ox + dx, oy + dy, e[dy * 3 + dx]);
      }
    return dst;
  }
  registerScaler('hq-3x', 'HQ 3x', [3], _hq3x);

  // =======================================================================
  // HQ 4x (HQ2x then EPX2x)
  // =======================================================================

  registerScaler('hq-4x', 'HQ 4x', [4], (src) => _epx2x(_hq2x(src)));

  // =======================================================================
  // LQ 2x
  // =======================================================================

  function _lq2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const w = [];
        for (let dy = -1; dy <= 1; ++dy)
          for (let dx = -1; dx <= 1; ++dx)
            w.push(g(x + dx, y + dy));
        const pat = hqComputePattern(w);
        let e00 = w[4], e01 = w[4], e10 = w[4], e11 = w[4];
        if (!(pat & 0x01) && !(pat & 0x02) && !(pat & 0x08)) e00 = w[0];
        else if (!(pat & 0x02) && !(pat & 0x08)) e00 = lerp2(w[4], w[0]);
        if (!(pat & 0x04) && !(pat & 0x02) && !(pat & 0x10)) e01 = w[2];
        else if (!(pat & 0x02) && !(pat & 0x10)) e01 = lerp2(w[4], w[2]);
        if (!(pat & 0x20) && !(pat & 0x08) && !(pat & 0x40)) e10 = w[6];
        else if (!(pat & 0x08) && !(pat & 0x40)) e10 = lerp2(w[4], w[6]);
        if (!(pat & 0x80) && !(pat & 0x10) && !(pat & 0x40)) e11 = w[8];
        else if (!(pat & 0x10) && !(pat & 0x40)) e11 = lerp2(w[4], w[8]);
        s_(dd, dw, x * 2, y * 2, e00);
        s_(dd, dw, x * 2 + 1, y * 2, e01);
        s_(dd, dw, x * 2, y * 2 + 1, e10);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e11);
      }
    return dst;
  }
  registerScaler('lq-2x', 'LQ 2x', [2], _lq2x);

  // =======================================================================
  // LQ 3x
  // =======================================================================

  function _lq3x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 3, dh = sh * 3;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const w = [];
        for (let dy = -1; dy <= 1; ++dy)
          for (let dx = -1; dx <= 1; ++dx)
            w.push(g(x + dx, y + dy));
        const pat = hqComputePattern(w);
        const e = new Array(9);
        e[4] = w[4];
        e[0] = !(pat & 0x01) && !(pat & 0x02) && !(pat & 0x08) ? w[0] : w[4];
        e[2] = !(pat & 0x04) && !(pat & 0x02) && !(pat & 0x10) ? w[2] : w[4];
        e[6] = !(pat & 0x20) && !(pat & 0x08) && !(pat & 0x40) ? w[6] : w[4];
        e[8] = !(pat & 0x80) && !(pat & 0x10) && !(pat & 0x40) ? w[8] : w[4];
        e[1] = !(pat & 0x02) ? lerp2w(w[4], w[1], 3, 1) : w[4];
        e[3] = !(pat & 0x08) ? lerp2w(w[4], w[3], 3, 1) : w[4];
        e[5] = !(pat & 0x10) ? lerp2w(w[4], w[5], 3, 1) : w[4];
        e[7] = !(pat & 0x40) ? lerp2w(w[4], w[7], 3, 1) : w[4];
        const ox = x * 3, oy = y * 3;
        for (let dy = 0; dy < 3; ++dy)
          for (let dx = 0; dx < 3; ++dx)
            s_(dd, dw, ox + dx, oy + dy, e[dy * 3 + dx]);
      }
    return dst;
  }
  registerScaler('lq-3x', 'LQ 3x', [3], _lq3x);

  // =======================================================================
  // XBR 2x
  // =======================================================================

  function _xbr2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const e = g(x, y);
        const pa = g(x - 1, y - 1), pb = g(x, y - 1), pc = g(x + 1, y - 1);
        const pd = g(x - 1, y), pf = g(x + 1, y);
        const pg = g(x - 1, y + 1), ph = g(x, y + 1), pi = g(x + 1, y + 1);
        let e0 = e, e1 = e, e2 = e, e3 = e;
        // Bottom-right
        const wd1 = dist(ph, pf) + dist(ph, pd) + dist(pb, pi) + dist(pb, pa) + 4 * dist(e, pg);
        const wd2 = dist(pd, pb) + dist(pf, pb) + dist(pd, ph) + dist(pf, ph) + 4 * dist(e, e);
        if (wd1 < wd2 && !eq(e, ph) && !eq(e, pf))
          e3 = lerp2(e, eq(pd, ph) ? pf : eq(pb, pf) ? ph : lerp2(ph, pf));
        // Bottom-left
        const wd3 = dist(pd, pb) + dist(pd, ph) + dist(pf, pa) + dist(pf, pi) + 4 * dist(e, pg);
        const wd4 = dist(pb, pd) + dist(ph, pd) + dist(pb, pf) + dist(ph, pf) + 4 * dist(e, e);
        if (wd3 < wd4 && !eq(e, pd) && !eq(e, ph))
          e2 = lerp2(e, eq(pb, pd) ? ph : eq(pf, ph) ? pd : lerp2(pd, ph));
        // Top-right
        const wd5 = dist(pb, pd) + dist(pb, pf) + dist(ph, pa) + dist(ph, pi) + 4 * dist(e, pc);
        const wd6 = dist(pd, pb) + dist(pf, pb) + dist(pd, ph) + dist(pf, ph) + 4 * dist(e, e);
        if (wd5 < wd6 && !eq(e, pb) && !eq(e, pf))
          e1 = lerp2(e, eq(pd, pb) ? pf : eq(ph, pf) ? pb : lerp2(pb, pf));
        // Top-left
        const wd7 = dist(pd, pb) + dist(pf, pb) + dist(pd, ph) + dist(pf, pi) + 4 * dist(e, pa);
        const wd8 = dist(pb, pd) + dist(pb, pf) + dist(ph, pd) + dist(ph, pf) + 4 * dist(e, e);
        if (wd7 < wd8 && !eq(e, pd) && !eq(e, pb))
          e0 = lerp2(e, eq(ph, pd) ? pb : eq(pf, pb) ? pd : lerp2(pd, pb));
        s_(dd, dw, x * 2, y * 2, e0);
        s_(dd, dw, x * 2 + 1, y * 2, e1);
        s_(dd, dw, x * 2, y * 2 + 1, e2);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, e3);
      }
    return dst;
  }
  registerScaler('xbr-2x', 'XBR 2x', [2], _xbr2x);

  // =======================================================================
  // XBR 3x (XBR 2x then resample down to 3x)
  // =======================================================================

  registerScaler('xbr-3x', 'XBR 3x', [3], (src) => {
    const tmp = _xbr2x(src);
    const sw = src.width, sh = src.height;
    const dw = sw * 3, dh = sh * 3;
    const dst = new ImageData(dw, dh);
    const tw = tmp.width, th = tmp.height;
    const td = tmp.data, dd = dst.data;
    for (let y = 0; y < dh; ++y) {
      const sy = Math.min((y * th / dh) | 0, th - 1);
      for (let x = 0; x < dw; ++x) {
        const sx = Math.min((x * tw / dw) | 0, tw - 1);
        const si = (sy * tw + sx) << 2;
        const di = (y * dw + x) << 2;
        dd[di] = td[si]; dd[di + 1] = td[si + 1]; dd[di + 2] = td[si + 2]; dd[di + 3] = td[si + 3];
      }
    }
    return dst;
  });

  // =======================================================================
  // XBR 4x (XBR 2x chained)
  // =======================================================================

  registerScaler('xbr-4x', 'XBR 4x', [4], (src) => _xbr2x(_xbr2x(src)));

  // =======================================================================
  // xBRZ 2x-6x (simplified edge-aware upscaler)
  // =======================================================================

  function _xbrz(src, scale) {
    const sw = src.width, sh = src.height;
    const dw = sw * scale, dh = sh * scale;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const e = g(x, y);
        const b = g(x, y - 1), d = g(x - 1, y), f = g(x + 1, y), h = g(x, y + 1);
        const a = g(x - 1, y - 1), c = g(x + 1, y - 1);
        const gg = g(x - 1, y + 1), ii = g(x + 1, y + 1);
        for (let sy = 0; sy < scale; ++sy)
          for (let sx = 0; sx < scale; ++sx) {
            const fx = (sx + 0.5) / scale;
            const fy = (sy + 0.5) / scale;
            let px = e;
            if (fx < 0.5 && fy < 0.5 && eq(d, b) && !eq(d, h) && !eq(b, f)) {
              const blend = (1 - fx) * (1 - fy) * 0.5;
              px = lerp2w(e, lerp2(d, b), (1 - blend) * 1000 | 0, blend * 1000 | 0);
            } else if (fx >= 0.5 && fy < 0.5 && eq(b, f) && !eq(b, d) && !eq(f, h)) {
              const blend = fx * (1 - fy) * 0.5;
              px = lerp2w(e, lerp2(b, f), (1 - blend) * 1000 | 0, blend * 1000 | 0);
            } else if (fx < 0.5 && fy >= 0.5 && eq(d, h) && !eq(d, b) && !eq(h, f)) {
              const blend = (1 - fx) * fy * 0.5;
              px = lerp2w(e, lerp2(d, h), (1 - blend) * 1000 | 0, blend * 1000 | 0);
            } else if (fx >= 0.5 && fy >= 0.5 && eq(f, h) && !eq(f, b) && !eq(h, d)) {
              const blend = fx * fy * 0.5;
              px = lerp2w(e, lerp2(f, h), (1 - blend) * 1000 | 0, blend * 1000 | 0);
            }
            s_(dd, dw, x * scale + sx, y * scale + sy, px);
          }
      }
    return dst;
  }
  registerScaler('xbrz-2x', 'xBRZ 2x', [2], (s) => _xbrz(s, 2));
  registerScaler('xbrz-3x', 'xBRZ 3x', [3], (s) => _xbrz(s, 3));
  registerScaler('xbrz-4x', 'xBRZ 4x', [4], (s) => _xbrz(s, 4));
  registerScaler('xbrz-5x', 'xBRZ 5x', [5], (s) => _xbrz(s, 5));
  registerScaler('xbrz-6x', 'xBRZ 6x', [6], (s) => _xbrz(s, 6));

  // =======================================================================
  // MMPX 2x
  // =======================================================================

  function _mmpx2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    const anyEq3 = (r, a, b, c) => eq(r, a) || eq(r, b) || eq(r, c);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const P = g(x, y - 2);
        const A = g(x - 1, y - 1), B = g(x, y - 1), C = g(x + 1, y - 1);
        const Q = g(x - 2, y), D = g(x - 1, y), E = g(x, y), F = g(x + 1, y), R = g(x + 2, y);
        const G = g(x - 1, y + 1), H = g(x, y + 1), I = g(x + 1, y + 1);
        const S = g(x, y + 2);
        let J = E, K = E, L = E, M = E;
        const lE = luma(E), lB = luma(B), lD = luma(D), lF = luma(F), lH = luma(H);

        if (eq(D, B) && !eq(D, H) && !eq(D, F) && (lE >= lD || eq(E, A)) && anyEq3(E, A, C, G) && (lE < lD || !eq(A, D) || !eq(E, P) || !eq(E, Q)))
          J = lerp2(D, B);
        if (eq(B, F) && !eq(B, D) && !eq(B, H) && (lE >= lB || eq(E, C)) && anyEq3(E, A, C, I) && (lE < lB || !eq(C, B) || !eq(E, P) || !eq(E, R)))
          K = lerp2(B, F);
        if (eq(H, D) && !eq(H, F) && !eq(H, B) && (lE >= lH || eq(E, G)) && anyEq3(E, A, G, I) && (lE < lH || !eq(G, H) || !eq(E, S) || !eq(E, Q)))
          L = lerp2(D, H);
        if (eq(F, H) && !eq(F, B) && !eq(F, D) && (lE >= lF || eq(E, I)) && anyEq3(E, C, G, I) && (lE < lF || !eq(I, H) || !eq(E, R) || !eq(E, S)))
          M = lerp2(F, H);

        if (!eq(E, F) && eq(E, C) && eq(E, I) && eq(E, D) && eq(E, Q) && eq(F, B) && eq(F, H))
          { K = lerp2(F, E); M = lerp2(F, E); }
        if (!eq(E, D) && eq(E, A) && eq(E, G) && eq(E, F) && eq(E, R) && eq(D, B) && eq(D, H))
          { J = lerp2(D, E); L = lerp2(D, E); }
        if (!eq(E, B) && eq(E, A) && eq(E, C) && eq(E, H) && eq(E, S) && eq(B, D) && eq(B, F))
          { J = lerp2(B, E); K = lerp2(B, E); }
        if (!eq(E, H) && eq(E, G) && eq(E, I) && eq(E, B) && eq(E, P) && eq(H, D) && eq(H, F))
          { L = lerp2(H, E); M = lerp2(H, E); }

        if (lB < lE && eq(E, G) && eq(E, H) && eq(E, I) && eq(E, S) && !eq(E, A) && !eq(E, D) && !eq(E, C) && !eq(E, F))
          { J = lerp2(B, E); K = lerp2(B, E); }
        if (lH < lE && eq(E, A) && eq(E, B) && eq(E, C) && eq(E, P) && !eq(E, G) && !eq(E, D) && !eq(E, I) && !eq(E, F))
          { L = lerp2(H, E); M = lerp2(H, E); }
        if (lD < lE && eq(E, C) && eq(E, F) && eq(E, I) && eq(E, R) && !eq(E, A) && !eq(E, B) && !eq(E, G) && !eq(E, H))
          { J = lerp2(D, E); L = lerp2(D, E); }
        if (lF < lE && eq(E, A) && eq(E, D) && eq(E, G) && eq(E, Q) && !eq(E, C) && !eq(E, B) && !eq(E, I) && !eq(E, H))
          { K = lerp2(F, E); M = lerp2(F, E); }

        if (!eq(H, B)) {
          if (eq(E, B) && eq(F, I) && !eq(F, E) && (!eq(E, A) || !eq(E, D) || eq(F, C)))
            { K = lerp2(B, F); M = lerp2(E, F); }
          if (eq(E, B) && eq(D, A) && !eq(D, E) && (!eq(E, C) || !eq(E, F) || eq(D, G)))
            { J = lerp2(B, D); L = lerp2(E, D); }
          if (eq(E, H) && eq(F, C) && !eq(F, E) && (!eq(E, G) || !eq(E, D) || eq(F, I)))
            { K = lerp2(E, F); M = lerp2(H, F); }
          if (eq(E, H) && eq(D, G) && !eq(D, E) && (!eq(E, I) || !eq(E, F) || eq(D, A)))
            { J = lerp2(E, D); L = lerp2(H, D); }
        }
        if (!eq(D, F)) {
          if (eq(E, D) && eq(H, G) && !eq(H, E) && (!eq(E, C) || !eq(E, B) || eq(H, I)))
            { L = lerp2(D, H); M = lerp2(E, H); }
          if (eq(E, D) && eq(B, A) && !eq(B, E) && (!eq(E, I) || !eq(E, H) || eq(B, C)))
            { J = lerp2(D, B); K = lerp2(E, B); }
          if (eq(E, F) && eq(H, I) && !eq(H, E) && (!eq(E, A) || !eq(E, B) || eq(H, G)))
            { L = lerp2(E, H); M = lerp2(F, H); }
          if (eq(E, F) && eq(B, C) && !eq(B, E) && (!eq(E, G) || !eq(E, H) || eq(B, A)))
            { J = lerp2(E, B); K = lerp2(F, B); }
        }
        s_(dd, dw, x * 2, y * 2, J);
        s_(dd, dw, x * 2 + 1, y * 2, K);
        s_(dd, dw, x * 2, y * 2 + 1, L);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, M);
      }
    return dst;
  }
  registerScaler('mmpx-2x', 'MMPX 2x', [2], _mmpx2x);

  // =======================================================================
  // ReverseAA 2x
  // =======================================================================

  function _reverseAa2x(src) {
    const sw = src.width, sh = src.height;
    const dw = sw * 2, dh = sh * 2;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const b1 = g(x, y - 2), b = g(x, y - 1);
        const d0 = g(x - 2, y), d = g(x - 1, y), e = g(x, y), f = g(x + 1, y), f4 = g(x + 2, y);
        const h = g(x, y + 1), h5 = g(x, y + 2);
        const out = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
        for (let ch = 0; ch < 4; ++ch) {
          const eN = e[ch] / 255, bN = b[ch] / 255, b1N = b1[ch] / 255;
          const dN = d[ch] / 255, d0N = d0[ch] / 255;
          const fN = f[ch] / 255, f4N = f4[ch] / 255;
          const hN = h[ch] / 255, h5N = h5[ch] / 255;
          let aa = bN - b1N, bb = eN - bN, cc = hN - eN, dd2 = h5N - hN;
          let tilt = (7 * (bb + cc) - 3 * (aa + dd2)) / 16;
          let m = eN < 0.5 ? 2 * eN : 2 * (1 - eN);
          m = Math.min(m, 2 * Math.abs(bb), 2 * Math.abs(cc));
          tilt = clamp(tilt, -m, m);
          const s1 = eN + tilt / 2, s0 = s1 - tilt;
          aa = dN - d0N; bb = s0 - dN; cc = fN - s0; dd2 = f4N - fN;
          tilt = (7 * (bb + cc) - 3 * (aa + dd2)) / 16;
          m = s0 < 0.5 ? 2 * s0 : 2 * (1 - s0);
          m = Math.min(m, 2 * Math.abs(bb), 2 * Math.abs(cc));
          tilt = clamp(tilt, -m, m);
          const e1v = s0 + tilt / 2, e0v = e1v - tilt;
          bb = s1 - dN; cc = fN - s1;
          tilt = (7 * (bb + cc) - 3 * (aa + dd2)) / 16;
          m = s1 < 0.5 ? 2 * s1 : 2 * (1 - s1);
          m = Math.min(m, 2 * Math.abs(bb), 2 * Math.abs(cc));
          tilt = clamp(tilt, -m, m);
          const e3v = s1 + tilt / 2, e2v = e3v - tilt;
          out[0][ch] = clamp(e0v * 255, 0, 255) | 0;
          out[1][ch] = clamp(e1v * 255, 0, 255) | 0;
          out[2][ch] = clamp(e2v * 255, 0, 255) | 0;
          out[3][ch] = clamp(e3v * 255, 0, 255) | 0;
        }
        s_(dd, dw, x * 2, y * 2, out[0]);
        s_(dd, dw, x * 2 + 1, y * 2, out[1]);
        s_(dd, dw, x * 2, y * 2 + 1, out[2]);
        s_(dd, dw, x * 2 + 1, y * 2 + 1, out[3]);
      }
    return dst;
  }
  registerScaler('reverse-aa-2x', 'ReverseAA 2x', [2], _reverseAa2x);

  // =======================================================================
  // ScaleHQ 2x/4x
  // =======================================================================

  function _scaleHq(src, scale) {
    const sw = src.width, sh = src.height;
    const dw = sw * scale, dh = sh * scale;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    const cdist = (a, b) => {
      const dr = (a[0] - b[0]) / 255, dg = (a[1] - b[1]) / 255, db = (a[2] - b[2]) / 255;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };
    const smoothstep = (t) => t * t * (3 - 2 * t);
    const lerpC = (a, b, t) => [a[0]*(1-t)+b[0]*t|0, a[1]*(1-t)+b[1]*t|0, a[2]*(1-t)+b[2]*t|0, a[3]*(1-t)+b[3]*t|0];
    const blend4 = (c1, w1, c2, w2, c3, w3, c4, w4) => {
      const tot = w1 + w2 + w3 + w4;
      if (tot < 0.001) return c1;
      const r1 = w1/tot, r2 = w2/tot, r3 = w3/tot, r4 = w4/tot;
      return [c1[0]*r1+c2[0]*r2+c3[0]*r3+c4[0]*r4|0, c1[1]*r1+c2[1]*r2+c3[1]*r3+c4[1]*r4|0,
              c1[2]*r1+c2[2]*r2+c3[2]*r3+c4[2]*r4|0, c1[3]*r1+c2[3]*r2+c3[3]*r3+c4[3]*r4|0];
    };
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const a = g(x-1,y-1), b = g(x,y-1), c = g(x+1,y-1);
        const d = g(x-1,y), f = g(x+1,y);
        const gg = g(x-1,y+1), h = g(x,y+1), ii = g(x+1,y+1);
        const wH = 1/(1+cdist(d,f)), wV = 1/(1+cdist(b,h));
        const wD1 = 1/(1+cdist(a,ii)), wD2 = 1/(1+cdist(c,gg));
        for (let sy = 0; sy < scale; ++sy)
          for (let sx = 0; sx < scale; ++sx) {
            const fx = smoothstep((sx+0.5)/scale), fy = smoothstep((sy+0.5)/scale);
            const cH = lerpC(d, f, fx), cV = lerpC(b, h, fy);
            const cD1 = lerpC(a, ii, (fx+fy)/2), cD2 = lerpC(gg, c, (fx+(1-fy))/2);
            s_(dd, dw, x*scale+sx, y*scale+sy, blend4(cH,wH, cV,wV, cD1,wD1, cD2,wD2));
          }
      }
    return dst;
  }
  registerScaler('scalehq-2x', 'ScaleHQ 2x', [2], (s) => _scaleHq(s, 2));
  registerScaler('scalehq-4x', 'ScaleHQ 4x', [4], (s) => _scaleHq(s, 4));

  // =======================================================================
  // SABR 2x-4x (simplified)
  // =======================================================================

  function _sabr(src, scale) {
    const sw = src.width, sh = src.height;
    const dw = sw * scale, dh = sh * scale;
    const dst = new ImageData(dw, dh);
    const sd = src.data, dd = dst.data;
    const g = (x, y) => g_(sd, sw, sh, x, y);
    const smoothstep = (e0, e1, x) => {
      if (x <= e0) return 0;
      if (x >= e1) return 1000;
      const t = ((x - e0) * 1000 / (e1 - e0)) | 0;
      return (t * t * (3000 - 2 * t) / 1000000) | 0;
    };
    for (let y = 0; y < sh; ++y)
      for (let x = 0; x < sw; ++x) {
        const center = g(x, y);
        const b = g(x,y-1), d = g(x-1,y), f = g(x+1,y), h = g(x,y+1);
        for (let oy = 0; oy < scale; ++oy)
          for (let ox = 0; ox < scale; ++ox) {
            const fpx = ((ox*2+1)*100/(2*scale))|0;
            const fpy = ((oy*2+1)*100/(2*scale))|0;
            let px = center;
            const checks = [
              { adj: h, adj2: f, val: fpx + fpy },
              { adj: d, adj2: h, val: (100 - fpx) + fpy },
              { adj: b, adj2: d, val: (100 - fpx) + (100 - fpy) },
              { adj: f, adj2: b, val: fpx + (100 - fpy) }
            ];
            for (const { adj, adj2, val } of checks) {
              const d1 = dist(center, adj), d2 = dist(center, adj2);
              if (d1 > 100 && d2 > 100) {
                const mac = smoothstep(110, 190, val);
                if (mac > 0) {
                  const edgePx = d1 < d2 ? adj : adj2;
                  px = lerp2w(center, edgePx, 1000 - mac, mac);
                  break;
                }
              }
            }
            s_(dd, dw, x*scale+ox, y*scale+oy, px);
          }
      }
    return dst;
  }
  registerScaler('sabr-2x', 'SABR 2x', [2], (s) => _sabr(s, 2));
  registerScaler('sabr-3x', 'SABR 3x', [3], (s) => _sabr(s, 3));
  registerScaler('sabr-4x', 'SABR 4x', [4], (s) => _sabr(s, 4));

  // #####################################################################
  // RESAMPLERS
  // #####################################################################

  // =======================================================================
  // Nearest Neighbor Resampler
  // =======================================================================

  registerResampler('rs-nearest', 'Nearest Neighbor', resampleNearest);

  // =======================================================================
  // Box (Area Average)
  // =======================================================================

  function _boxKernel(x) { return Math.abs(x) <= 0.5 ? 1 : 0; }
  registerResampler('rs-box', 'Box (Area)', (s, w, h) => resample(s, w, h, 1, _boxKernel));

  // =======================================================================
  // Bilinear
  // =======================================================================

  function _bilinearKernel(x) {
    x = Math.abs(x);
    return x < 1 ? 1 - x : 0;
  }
  registerResampler('rs-bilinear', 'Bilinear', (s, w, h) => resample(s, w, h, 1, _bilinearKernel));

  // =======================================================================
  // Hermite
  // =======================================================================

  function _hermiteKernel(x) {
    x = Math.abs(x);
    return x < 1 ? (2 * x - 3) * x * x + 1 : 0;
  }
  registerResampler('rs-hermite', 'Hermite', (s, w, h) => resample(s, w, h, 1, _hermiteKernel));

  // =======================================================================
  // Cosine
  // =======================================================================

  function _cosineKernel(x) {
    x = Math.abs(x);
    return x < 1 ? (1 - Math.cos((1 - x) * Math.PI)) * 0.5 : 0;
  }
  registerResampler('rs-cosine', 'Cosine', (s, w, h) => resample(s, w, h, 1, _cosineKernel));

  // =======================================================================
  // Bicubic (Keys, a=-0.5)
  // =======================================================================

  function _bicubicKernel(x) {
    x = Math.abs(x);
    if (x < 1) return (1.5 * x - 2.5) * x * x + 1;
    if (x < 2) return ((-0.5 * x + 2.5) * x - 4) * x + 2;
    return 0;
  }

  function _bicubicKernelA(a) {
    return function(x) {
      x = Math.abs(x);
      if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
      if (x < 2) return ((a * x - 5 * a) * x + 8 * a) * x - 4 * a;
      return 0;
    };
  }

  registerResampler('rs-bicubic', 'Bicubic', (s, w, h, p) => resample(s, w, h, 2, _bicubicKernelA(p?.a ?? -0.5)), [
    { key: 'a', label: 'Sharpness (a)', min: -2, max: 0, step: 0.1, default: -0.5 }
  ]);

  // =======================================================================
  // Mitchell-Netravali Family
  // =======================================================================

  function _mitchellKernel(B, C) {
    return function(x) {
      x = Math.abs(x);
      if (x < 1)
        return ((12 - 9*B - 6*C) * x*x*x + (-18 + 12*B + 6*C) * x*x + (6 - 2*B)) / 6;
      if (x < 2)
        return ((-B - 6*C) * x*x*x + (6*B + 30*C) * x*x + (-12*B - 48*C) * x + (8*B + 24*C)) / 6;
      return 0;
    };
  }
  registerResampler('rs-mitchell', 'Mitchell-Netravali', (s, w, h, p) => resample(s, w, h, 2, _mitchellKernel(p?.B ?? 1/3, p?.C ?? 1/3)), [
    { key: 'B', label: 'Blur (B)', min: 0, max: 1, step: 0.05, default: 0.333 },
    { key: 'C', label: 'Ring (C)', min: 0, max: 1, step: 0.05, default: 0.333 }
  ]);
  registerResampler('rs-catmull-rom', 'Catmull-Rom', (s, w, h) => resample(s, w, h, 2, _mitchellKernel(0, 0.5)));
  registerResampler('rs-bspline', 'B-Spline 3', (s, w, h) => resample(s, w, h, 2, _mitchellKernel(1, 0)));

  // =======================================================================
  // Gaussian
  // =======================================================================

  registerResampler('rs-gaussian', 'Gaussian', (s, w, h, p) => {
    const sigma = p?.sigma ?? 0.5;
    const coeff = -1 / (2 * sigma * sigma);
    const radius = Math.max(2, Math.ceil(sigma * 3));
    return resample(s, w, h, radius, (x) => Math.exp(x * x * coeff));
  }, [
    { key: 'sigma', label: 'Sigma', min: 0.1, max: 3.0, step: 0.1, default: 0.5 }
  ]);

  // =======================================================================
  // Spline Family
  // =======================================================================

  function _spline16Kernel(x) {
    x = Math.abs(x);
    if (x < 1) return ((x - 9/5) * x - 1/5) * x + 1;
    if (x < 2) { x -= 1; return ((-1/3 * x + 4/5) * x - 7/15) * x; }
    return 0;
  }
  registerResampler('rs-spline16', 'Spline16', (s, w, h) => resample(s, w, h, 2, _spline16Kernel));

  function _spline36Kernel(x) {
    x = Math.abs(x);
    if (x < 1) return ((13/11 * x - 453/209) * x - 3/209) * x + 1;
    if (x < 2) { x -= 1; return ((-6/11 * x + 270/209) * x - 156/209) * x; }
    if (x < 3) { x -= 2; return ((1/11 * x - 45/209) * x + 26/209) * x; }
    return 0;
  }
  registerResampler('rs-spline36', 'Spline36', (s, w, h) => resample(s, w, h, 3, _spline36Kernel));

  function _spline64Kernel(x) {
    x = Math.abs(x);
    if (x < 1) return ((49/41 * x - 6387/2911) * x - 3/2911) * x + 1;
    if (x < 2) { x -= 1; return ((-24/41 * x + 4032/2911) * x - 2328/2911) * x; }
    if (x < 3) { x -= 2; return ((6/41 * x - 1008/2911) * x + 582/2911) * x; }
    if (x < 4) { x -= 3; return ((-1/41 * x + 168/2911) * x - 97/2911) * x; }
    return 0;
  }
  registerResampler('rs-spline64', 'Spline64', (s, w, h) => resample(s, w, h, 4, _spline64Kernel));

  // =======================================================================
  // Lanczos Family
  // =======================================================================

  function _sinc(x) {
    if (x === 0) return 1;
    const px = Math.PI * x;
    return Math.sin(px) / px;
  }

  function _lanczosKernel(a) {
    return function(x) {
      x = Math.abs(x);
      return x >= a ? 0 : _sinc(x) * _sinc(x / a);
    };
  }
  registerResampler('rs-lanczos2', 'Lanczos 2', (s, w, h) => resample(s, w, h, 2, _lanczosKernel(2)));
  registerResampler('rs-lanczos3', 'Lanczos 3', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _lanczosKernel(lobes));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }
  ]);
  registerResampler('rs-lanczos4', 'Lanczos 4', (s, w, h) => resample(s, w, h, 4, _lanczosKernel(4)));

  // =======================================================================
  // Windowed Sinc Family
  // =======================================================================

  function _windowedSincKernel(radius, windowFn) {
    return function(x) {
      if (x === 0) return 1;
      const ax = Math.abs(x);
      return ax >= radius ? 0 : _sinc(x) * windowFn(x, radius);
    };
  }

  const _blackmanWindow = (x, R) => { const t = Math.PI * x / R; return 0.42 + 0.5 * Math.cos(t) + 0.08 * Math.cos(2 * t); };
  const _hannWindow = (x, R) => 0.5 * (1 + Math.cos(Math.PI * x / R));
  const _hammingWindow = (x, R) => 0.54 + 0.46 * Math.cos(Math.PI * x / R);

  function _besselI0(x) {
    const ax = Math.abs(x);
    if (ax < 3.75) {
      let y = x / 3.75; y *= y;
      return 1 + y * (3.5156229 + y * (3.0899424 + y * (1.2067492 + y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))));
    }
    const ay = 3.75 / ax;
    return Math.exp(ax) / Math.sqrt(ax) * (0.39894228 + ay * (0.01328592 + ay * (0.00225319 + ay * (-0.00157565 + ay * (0.00916281 + ay * (-0.02057706 + ay * (0.02635537 + ay * (-0.01647633 + ay * 0.00392377))))))));
  }
  const _kaiserWindow = (x, R) => {
    const r = x / R, arg = 1 - r * r;
    return arg <= 0 ? 0 : _besselI0(8.6 * Math.sqrt(arg)) / _besselI0(8.6);
  };

  registerResampler('rs-blackman', 'Blackman-Sinc', (s, w, h) => resample(s, w, h, 3, _windowedSincKernel(3, _blackmanWindow)));
  registerResampler('rs-hann', 'Hann-Sinc', (s, w, h) => resample(s, w, h, 3, _windowedSincKernel(3, _hannWindow)));
  registerResampler('rs-hamming', 'Hamming-Sinc', (s, w, h) => resample(s, w, h, 3, _windowedSincKernel(3, _hammingWindow)));
  registerResampler('rs-kaiser', 'Kaiser-Sinc', (s, w, h) => resample(s, w, h, 3, _windowedSincKernel(3, _kaiserWindow)));

  // =======================================================================
  // Additional Windowed Sinc Resamplers
  // =======================================================================

  const _triangularWindow = (x, R) => 1 - Math.abs(x) / R;
  const _welchWindow = (x, R) => { const r = x / R; return 1 - r * r; };

  const _nuttallWindow = (x, R) => {
    const t = Math.PI * x / R;
    return 0.355768 + 0.487396 * Math.cos(t) + 0.144232 * Math.cos(2 * t) + 0.012604 * Math.cos(3 * t);
  };

  const _blackmanNuttallWindow = (x, R) => {
    const t = Math.PI * x / R;
    return 0.3635819 + 0.4891775 * Math.cos(t) + 0.1365995 * Math.cos(2 * t) + 0.0106411 * Math.cos(3 * t);
  };

  const _blackmanHarrisWindow = (x, R) => {
    const t = Math.PI * x / R;
    return 0.35875 + 0.48829 * Math.cos(t) + 0.14128 * Math.cos(2 * t) + 0.01168 * Math.cos(3 * t);
  };

  const _flatTopWindow = (x, R) => {
    const t = Math.PI * x / R;
    return 1.0 + 1.93 * Math.cos(t) + 1.29 * Math.cos(2 * t) + 0.388 * Math.cos(3 * t) + 0.028 * Math.cos(4 * t);
  };

  const _bartlettHannWindow = (x, R) => 0.62 - 0.48 * Math.abs(x / R) + 0.38 * Math.cos(Math.PI * x / R);

  const _bohmanWindow = (x, R) => {
    const ax = Math.abs(x) / R;
    return (1 - ax) * Math.cos(Math.PI * ax) + Math.sin(Math.PI * ax) / Math.PI;
  };

  registerResampler('rs-triangular', 'Triangular-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _triangularWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-welch', 'Welch-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _welchWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-nuttall', 'Nuttall-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _nuttallWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-blackman-nuttall', 'Blackman-Nuttall-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _blackmanNuttallWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-blackman-harris', 'Blackman-Harris-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _blackmanHarrisWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-flat-top', 'Flat-Top-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _flatTopWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-bartlett-hann', 'Bartlett-Hann-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _bartlettHannWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-bohman', 'Bohman-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, _bohmanWindow));
  }, [{ key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 }]);

  registerResampler('rs-power-cosine', 'Power-of-Cosine-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    const alpha = p?.alpha ?? 1.5;
    const win = (x, R) => Math.pow(Math.cos(Math.PI * x / (2 * R)), alpha);
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, win));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 },
    { key: 'alpha', label: 'Alpha', min: 0.1, max: 5, step: 0.1, default: 1.5 }
  ]);

  registerResampler('rs-tukey', 'Tukey-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    const alpha = p?.alpha ?? 0.5;
    const win = (x, R) => {
      const ax = Math.abs(x) / R;
      if (ax <= 1 - alpha) return 1;
      return 0.5 * (1 + Math.cos(Math.PI * (ax - (1 - alpha)) / alpha));
    };
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, win));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 },
    { key: 'alpha', label: 'Alpha', min: 0.01, max: 1, step: 0.01, default: 0.5 }
  ]);

  registerResampler('rs-poisson', 'Poisson-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    const alpha = p?.alpha ?? 1;
    const win = (x, R) => Math.exp(-alpha * Math.abs(x) / R);
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, win));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 },
    { key: 'alpha', label: 'Alpha', min: 0.1, max: 5, step: 0.1, default: 1 }
  ]);

  registerResampler('rs-hanning-poisson', 'Hanning-Poisson-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    const alpha = p?.alpha ?? 2;
    const win = (x, R) => _hannWindow(x, R) * Math.exp(-alpha * Math.abs(x) / R);
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, win));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 },
    { key: 'alpha', label: 'Alpha', min: 0.1, max: 5, step: 0.1, default: 2 }
  ]);

  registerResampler('rs-cauchy', 'Cauchy-Sinc', (s, w, h, p) => {
    const lobes = p?.lobes ?? 3;
    const alpha = p?.alpha ?? 3;
    const win = (x, R) => { const r = alpha * x / R; return 1 / (1 + r * r); };
    return resample(s, w, h, lobes, _windowedSincKernel(lobes, win));
  }, [
    { key: 'lobes', label: 'Lobes', min: 1, max: 8, step: 1, default: 3 },
    { key: 'alpha', label: 'Alpha', min: 0.1, max: 10, step: 0.1, default: 3 }
  ]);

  // =======================================================================
  // Fixed-Radius Kernels (Schaum, B-Spline higher orders, o-Moms)
  // =======================================================================

  // Schaum 2 (quadratic, radius 2)
  function _schaum2Kernel(x) {
    x = Math.abs(x);
    if (x < 0.5) return 1 - x * x;
    if (x < 1.5) return 0.5 * (x - 0.5) * (x - 1.5);
    return 0;
  }
  registerResampler('rs-schaum2', 'Schaum 2', (s, w, h) => resample(s, w, h, 2, _schaum2Kernel));

  // Schaum 3 (cubic, radius 2)
  function _schaum3Kernel(x) {
    x = Math.abs(x);
    if (x < 1) return ((1.5 * x - 2.5) * x) * x + 1;
    if (x < 2) return ((-0.5 * x + 2.5) * x - 4) * x + 2;
    return 0;
  }
  registerResampler('rs-schaum3', 'Schaum 3', (s, w, h) => resample(s, w, h, 2, _schaum3Kernel));

  // B-Spline 2 (quadratic, radius 1.5)
  function _bspline2Kernel(x) {
    x = Math.abs(x);
    if (x < 0.5) return 0.75 - x * x;
    if (x < 1.5) { const t = x - 1.5; return 0.5 * t * t; }
    return 0;
  }
  registerResampler('rs-bspline2', 'B-Spline 2', (s, w, h) => resample(s, w, h, 2, _bspline2Kernel));

  // B-Spline 5 (quintic, radius 3)
  function _bspline5Kernel(x) {
    x = Math.abs(x);
    if (x < 1) {
      const x2 = x * x;
      return ((-10 * x2 + 30) * x2 - 33) * x2 / 60 + 11 / 20;
    }
    if (x < 2) {
      const x2 = x * x;
      return ((6 * x2 - 60 * x + 210) * x2 * x - 720 * x2 + 1080 * x - 648) / 720 + 0.55;
    }
    if (x < 3) {
      const t = 3 - x;
      return t * t * t * t * t / 120;
    }
    return 0;
  }
  registerResampler('rs-bspline5', 'B-Spline 5', (s, w, h) => resample(s, w, h, 3, _bspline5Kernel));

  // B-Spline 7 (septic, radius 4)
  function _bspline7Kernel(x) {
    x = Math.abs(x);
    if (x < 1) {
      const x2 = x * x;
      return ((-35 * x2 + 140) * x2 * x2 - 252 * x2 * x2 + 5765 / 21) / 5040 + 151 / 315;
    }
    if (x < 2) {
      const t = 2 - x, t2 = t * t;
      return (120 * t2 * t2 * t * t * t - 7 * (2 - x) + 21 * t2 * (2 - x) * (t2 - 1)) / 5040 + 1 / 5040;
    }
    if (x < 3) {
      const t = 3 - x, t2 = t * t;
      return (21 * t2 * t2 * t2 * t - 7 * t2 * t2 * t2 * 3 + t2 * t2 * t * 21) / 5040;
    }
    if (x < 4) {
      const t = 4 - x;
      return t * t * t * t * t * t * t / 5040;
    }
    return 0;
  }
  registerResampler('rs-bspline7', 'B-Spline 7', (s, w, h) => resample(s, w, h, 4, _bspline7Kernel));

  // B-Spline 9 (9th order, radius 5)
  function _bspline9Kernel(x) {
    x = Math.abs(x);
    if (x < 1) {
      const x2 = x * x;
      return ((-63 * x2 + 315) * x2 * x2 * x2 - 630 * x2 * x2 * x2 + 14175 / 63) / 362880 + 7936 / 14175;
    }
    if (x < 2) {
      const t = 2 - x;
      return (t * t * t * t * t * t * t * t * t * 9 - 36 * t * t * t * t * t * t * t * t + 84 * t * t * t * t * t * t * t) / 362880;
    }
    if (x < 3) {
      const t = 3 - x;
      return (t * t * t * t * t * t * t * t * t - 9 * t * t * t * t * t * t * t * t + 36 * t * t * t * t * t * t * t) / 362880;
    }
    if (x < 4) {
      const t = 4 - x;
      return (t * t * t * t * t * t * t * t * t - 9 * t * t * t * t * t * t * t * t) / 362880;
    }
    if (x < 5) {
      const t = 5 - x;
      return t * t * t * t * t * t * t * t * t / 362880;
    }
    return 0;
  }
  registerResampler('rs-bspline9', 'B-Spline 9', (s, w, h) => resample(s, w, h, 5, _bspline9Kernel));

  // B-Spline 11 (11th order, radius 6)
  function _bspline11Kernel(x) {
    x = Math.abs(x);
    const f = 39916800; // 11!
    if (x >= 6) return 0;
    const t = 6 - x;
    let val = Math.pow(t, 11);
    if (x < 5) val -= 12 * Math.pow(5 - x, 11);
    if (x < 4) val += 66 * Math.pow(4 - x, 11);
    if (x < 3) val -= 220 * Math.pow(3 - x, 11);
    if (x < 2) val += 495 * Math.pow(2 - x, 11);
    if (x < 1) val -= 792 * Math.pow(1 - x, 11);
    return val / f;
  }
  registerResampler('rs-bspline11', 'B-Spline 11', (s, w, h) => resample(s, w, h, 6, _bspline11Kernel));

  // o-Moms 3 (optimal interpolation, radius 2)
  function _omoms3Kernel(x) {
    x = Math.abs(x);
    if (x < 1)
      return ((x * 0.5 - 1) * x + 1 / 14) * x + 13 / 21;
    if (x < 2) {
      const t = 2 - x;
      return ((t * (-7 / 6) + 0.5) * t + 2 / 3) * t + 1 / 42;
    }
    return 0;
  }
  registerResampler('rs-omoms3', 'o-Moms 3', (s, w, h) => resample(s, w, h, 2, _omoms3Kernel));

  // o-Moms 5 (5th order, radius 3)
  function _omoms5Kernel(x) {
    x = Math.abs(x);
    if (x < 1) {
      const x2 = x * x;
      return (((-7 * x2 + 21) * x2 - 0.2) * x2) / 12 + 68 / 105;
    }
    if (x < 2) {
      const x2 = x * x;
      return (((63 * x2 * x - 378 * x2 + 827 * x - 834) * x2 + 348 * x) + 168) / 1260;
    }
    if (x < 3) {
      const t = 3 - x;
      return t * t * t * t * t / 120;
    }
    return 0;
  }
  registerResampler('rs-omoms5', 'o-Moms 5', (s, w, h) => resample(s, w, h, 3, _omoms5Kernel));

  // o-Moms 7 (7th order, radius 4)
  function _omoms7Kernel(x) {
    x = Math.abs(x);
    if (x < 1) {
      const x2 = x * x;
      return (((33 * x2 - 165) * x2 + 286) * x2 * x2 / 7 - 286 * x2 + 5765 / 21) / 720 + 151 / 315;
    }
    if (x < 2) {
      const t = x - 1, t2 = t * t;
      return (((-33 * t2 + 297 * t - 891) * t2 * t + 1320 * t2 - 660 * t + 165) * t) / 5040;
    }
    if (x < 3) {
      const t = 3 - x, t2 = t * t;
      return (t2 * t2 * t2 * t + 7 * t2 * t2 * t2) / 5040;
    }
    if (x < 4) {
      const t = 4 - x;
      return t * t * t * t * t * t * t / 5040;
    }
    return 0;
  }
  registerResampler('rs-omoms7', 'o-Moms 7', (s, w, h) => resample(s, w, h, 4, _omoms7Kernel));

  // =======================================================================
  // Export
  // =======================================================================

  SZ.System.Drawing.Resizing = {
    scalers: _scalers,
    resamplers: _resamplers,
    CATEGORY,
    registerScaler,
    registerResampler,
    getAvailableForResize,
    apply,
    resample,
    resampleNearest,
    helpers: {
      getPixel, setPixel, colorsEqual, colorDist, luma,
      lerp2, lerp2w, lerp3w, clamp, hqComputePattern
    }
  };

})(window);
