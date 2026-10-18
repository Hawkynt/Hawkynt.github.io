;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const SAMPLES_PER_SEGMENT = 24;
  const POINT_SPACING = 24;
  const HINT_WINDOW = 60;

  /* ── Uniform Catmull-Rom basis for one coordinate ── */
  function catmullRom(a, b, c, d, u) {
    const uu = u * u;
    const uuu = uu * u;
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * uu + (-a + 3 * b - 3 * c + d) * uuu);
  }

  /* ── Laplacian smoothing of a closed polyline, whole array per pass ── */
  function smoothClosed(points, iterations) {
    const n = points.length;
    let current = points;
    for (let it = 0; it < iterations; ++it) {
      const next = new Array(n);
      for (let i = 0; i < n; ++i) {
        const prev = current[(i + n - 1) % n];
        const curr = current[i];
        const nxt = current[(i + 1) % n];
        next[i] = {
          x: 0.5 * curr.x + 0.25 * (prev.x + nxt.x),
          y: 0.5 * curr.y + 0.25 * (prev.y + nxt.y)
        };
      }
      current = next;
    }
    return current;
  }

  /* ── Walk the closed polyline and emit one point every `spacing` units ── */
  function resampleEven(raw, spacing) {
    const n = raw.length;
    let total = 0;
    for (let i = 0; i < n; ++i) {
      const a = raw[i];
      const b = raw[(i + 1) % n];
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const out = [{ x: raw[0].x, y: raw[0].y }];
    let walked = 0;
    let next = spacing;
    for (let i = 0; i < n && next < total; ++i) {
      const a = raw[i];
      const b = raw[(i + 1) % n];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      while (next < total && walked + segLen >= next) {
        const u = segLen > 0 ? (next - walked) / segLen : 0;
        out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
        next += spacing;
      }
      walked += segLen;
    }
    return out;
  }

  function build(def) {
    const cp = def.controlPoints;
    if (!Array.isArray(cp) || cp.length < 4) {
      throw new Error('RacingTrack.build needs at least 4 control points');
    }
    const smooth = Math.max(0, def.smooth | 0);
    const n = cp.length;

    /* a) Catmull-Rom sampling of the closed control polygon */
    const raw = [];
    for (let i = 0; i < n; ++i) {
      const p0 = cp[(i + n - 1) % n];
      const p1 = cp[i];
      const p2 = cp[(i + 1) % n];
      const p3 = cp[(i + 2) % n];
      for (let s = 0; s < SAMPLES_PER_SEGMENT; ++s) {
        const u = s / SAMPLES_PER_SEGMENT;
        raw.push({
          x: catmullRom(p0[0], p1[0], p2[0], p3[0], u),
          y: catmullRom(p0[1], p1[1], p2[1], p3[1], u)
        });
      }
    }

    /* b) smoothing, c) even resampling, d) cumulative lengths and bounds */
    const points = resampleEven(smoothClosed(raw, smooth), POINT_SPACING);
    const count = points.length;
    const cum = new Array(count);
    cum[0] = 0;
    let minX = points[0].x;
    let maxX = minX;
    let minY = points[0].y;
    let maxY = minY;
    for (let i = 1; i < count; ++i) {
      cum[i] = cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (points[i].x < minX) minX = points[i].x;
      if (points[i].x > maxX) maxX = points[i].x;
      if (points[i].y < minY) minY = points[i].y;
      if (points[i].y > maxY) maxY = points[i].y;
    }
    const length = cum[count - 1] + Math.hypot(points[0].x - points[count - 1].x, points[0].y - points[count - 1].y);

    function sampleAt(s) {
      let t = s % length;
      if (t < 0) t += length;
      let lo = 0;
      let hi = count - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cum[mid] <= t) lo = mid;
        else hi = mid - 1;
      }
      const i = lo;
      const j = (i + 1) % count;
      const a = points[i];
      const b = points[j];
      const segEnd = j === 0 ? length : cum[j];
      const segLen = segEnd - cum[i];
      const u = segLen > 0 ? (t - cum[i]) / segLen : 0;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const angle = Math.atan2(dy, dx);
      return { x: a.x + dx * u, y: a.y + dy * u, angle: angle, nx: Math.sin(angle), ny: -Math.cos(angle) };
    }

    function locate(x, y, hint) {
      let start = 0;
      let span = count;
      if (Number.isInteger(hint)) {
        start = ((hint - HINT_WINDOW) % count + count) % count;
        span = Math.min(count, 2 * HINT_WINDOW + 1);
      }
      let bestIndex = 0;
      let bestT = 0;
      let bestDist = Infinity;
      let bestLateral = 0;
      for (let k = 0; k < span; ++k) {
        const i = (start + k) % count;
        const j = (i + 1) % count;
        const a = points[i];
        const b = points[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLenSq = dx * dx + dy * dy;
        const segLen = Math.sqrt(segLenSq);
        let t = 0;
        if (segLenSq > 0) {
          t = ((x - a.x) * dx + (y - a.y) * dy) / segLenSq;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
        }
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        const dist = Math.hypot(x - px, y - py);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
          bestT = t;
          bestLateral = segLen > 0 ? -(dx * (y - a.y) - dy * (x - a.x)) / segLen : 0;
        }
      }
      const nextIndex = (bestIndex + 1) % count;
      const segEnd = nextIndex === 0 ? length : cum[nextIndex];
      const s = cum[bestIndex] + bestT * (segEnd - cum[bestIndex]);
      return { index: bestIndex, s: s, dist: bestDist, lateral: bestLateral };
    }

    function progress(prevS, newS) {
      let d = newS - prevS;
      if (d > length / 2) d -= length;
      else if (d < -length / 2) d += length;
      return d;
    }

    return {
      points: points,
      cum: cum,
      length: length,
      width: def.width,
      bounds: { minX: minX, minY: minY, maxX: maxX, maxY: maxY },
      sampleAt: sampleAt,
      locate: locate,
      progress: progress
    };
  }

  SZ.RacingTrack = Object.freeze({ build });
})();
