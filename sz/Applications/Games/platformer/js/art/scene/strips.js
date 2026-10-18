;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.sceneKit || (NS.sceneKit = {});
  const { STRIP_W, TWO_PI, makeCanvas, mulberry, rgba, mix, loopNoise, linear, grain, ridgeHeights, ridgePath, facetShade, ridgeShade, rimLight, wrapDraw, puffCloud } = Kit;

  /*
   * Scenery: the tileable strip painters (ranges, hills, trees, clouds, seas, light shafts) the
   * world builders combine.
   */

  /* a strip: { img, y, h, f (parallax), vx (drift px/s), fill (below), fillTop (above) } */
  function strip(h) {
    const c = makeCanvas(STRIP_W, h);
    return { c: c, g: c.getContext('2d') };
  }

  /* far snowy or pale ranges with faceted light */
  function paintRange(rand, H, base, amp, body, far, light, dark, snow, rough, haze) {
    const s = strip(H);
    const g = s.g;
    const noise = loopNoise(rand, 6);
    const big = loopNoise(rand, 2);
    const ys = ridgeHeights(STRIP_W, base, amp, noise, rough, true);
    /* a slow swell lifts some massifs and sinks the passes between them */
    for (let i = 0; i < ys.length; ++i)
      ys[i] = base - (base - ys[i]) * (0.45 + 0.75 * big(i / ys.length, 0.3));
    ridgePath(g, ys, H);
    g.fillStyle = linear(g, 0, base - amp, 0, H, [[0, far], [1, body]]);
    g.fill();
    g.save();
    ridgePath(g, ys, H);
    g.clip();
    if (snow) {
      /* snow above a ragged altitude line, running down the gullies */
      const sn = loopNoise(rand, 6);
      let top = 1e9;
      for (const y of ys) top = Math.min(top, y);
      const alt = top + amp * 0.42;
      g.fillStyle = rgba(snow, 0.95);
      g.save();
      ridgePath(g, ys, H);
      g.clip();
      g.beginPath();
      g.moveTo(0, -10);
      for (let i = 0; i < ys.length; ++i) {
        const line = alt + (sn(i / ys.length, 0.7) - 0.5) * amp * 0.5;
        g.lineTo(i * 4, Math.max(ys[i] - 2, line));
      }
      g.lineTo(STRIP_W, -10);
      g.closePath();
      g.fill();
      g.restore();
    }
    /* light and shadow per peak, over rock and snow alike */
    ridgeShade(g, ys, amp * 0.95, dark, light, rand);
    /* atmospheric haze pooling at the foot */
    g.fillStyle = linear(g, 0, base - amp * 0.3, 0, H, [[0, rgba(haze, 0)], [1, rgba(haze, 0.55)]]);
    g.fillRect(0, 0, STRIP_W, H);
    grain(g, STRIP_W, H, rand, 3, 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)');
    g.restore();
    rimLight(g, ys, light, 0.35, 2);
    return { s: s, ys: ys };
  }

  function paintHills(rand, H, base, amp, top, bottom, rim, decorate) {
    const s = strip(H);
    const g = s.g;
    const ys = ridgeHeights(STRIP_W, base, amp, loopNoise(rand, 5), 0.45, false);
    ridgePath(g, ys, H);
    g.fillStyle = linear(g, 0, base - amp, 0, H, [[0, top], [1, bottom]]);
    g.fill();
    g.save();
    ridgePath(g, ys, H);
    g.clip();
    facetShade(g, ys, 60, '#ffffff', '#000000', 0.12);
    grain(g, STRIP_W, H, rand, 5, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.07)');
    g.restore();
    rimLight(g, ys, rim, 0.5, 2.5);
    if (decorate)
      decorate(g, ys, rand);
    return s;
  }

  /* a broadleaf tree: an irregular crown of blobs, shaded dark below, mid in
     the body and lit on the sun side (sunDir 1 = light from the right) */
  function treeClump(g, x, y, r, rand, dark, mid, light, sunDir) {
    const sd = sunDir || -1;
    g.fillStyle = mix(dark, '#2a1a0e', 0.5);
    g.beginPath();
    g.moveTo(x - r * 0.1, y + r * 0.1);
    g.lineTo(x - r * 0.05, y - r * 0.5);
    g.lineTo(x + r * 0.05, y - r * 0.5);
    g.lineTo(x + r * 0.11, y + r * 0.1);
    g.closePath();
    g.fill();
    const blobs = [];
    const n = 4 + Math.floor(rand() * 4);
    const tall = 0.8 + rand() * 0.5;
    for (let i = 0; i < n; ++i) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
      const d = r * (0.2 + rand() * 0.45);
      blobs.push([Math.cos(a) * d, -r * 0.75 * tall + Math.sin(a) * d * tall, r * (0.38 + rand() * 0.3)]);
    }
    g.fillStyle = dark;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0], y + b[1], b[2], 0, TWO_PI); g.fill(); }
    g.fillStyle = mid;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0] + sd * b[2] * 0.12, y + b[1] - b[2] * 0.16, b[2] * 0.8, 0, TWO_PI); g.fill(); }
    g.fillStyle = light;
    for (const b of blobs) {
      if (b[0] * sd < -r * 0.25) continue;
      g.beginPath(); g.arc(x + b[0] + sd * b[2] * 0.3, y + b[1] - b[2] * 0.34, b[2] * 0.4, 0, TWO_PI); g.fill();
    }
  }

  /* a slender poplar */
  function poplar(g, x, y, h, dark, mid, light, sunDir) {
    const w = h * 0.17;
    g.fillStyle = mix(dark, '#2a1a0e', 0.5);
    g.fillRect(x - 2, y - h * 0.15, 4, h * 0.2);
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(x, y - h * 0.55, w, h * 0.48, 0, 0, TWO_PI); g.fill();
    g.fillStyle = mid;
    g.beginPath(); g.ellipse(x + sunDir * w * 0.15, y - h * 0.58, w * 0.78, h * 0.43, 0, 0, TWO_PI); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.ellipse(x + sunDir * w * 0.45, y - h * 0.66, w * 0.3, h * 0.28, 0, 0, TWO_PI); g.fill();
  }

  /* a low round bush */
  function bush(g, x, y, r, rand, dark, mid, light, sunDir) {
    const blobs = [[-r * 0.6, -r * 0.35, r * 0.55], [0, -r * 0.55, r * 0.7], [r * 0.6, -r * 0.35, r * 0.55]];
    g.fillStyle = dark;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0], y + b[1], b[2], 0, TWO_PI); g.fill(); }
    g.fillStyle = mid;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0] + sunDir * b[2] * 0.1, y + b[1] - b[2] * 0.15, b[2] * 0.78, 0, TWO_PI); g.fill(); }
    g.fillStyle = light;
    g.beginPath(); g.arc(x + sunDir * r * 0.35, y - r * 0.8, r * 0.28, 0, TWO_PI); g.fill();
    if (rand() < 0.5) {
      g.fillStyle = rand() < 0.5 ? '#ffffff' : '#ff9ac0';
      for (let k = 0; k < 5; ++k)
        g.fillRect(x + (rand() - 0.5) * r * 1.6, y - r * (0.2 + rand() * 0.7), 2.5, 2.5);
    }
  }

  function pine(g, x, y, h, dark, mid, snow) {
    const w = h * 0.42;
    g.fillStyle = dark;
    g.fillRect(x - h * 0.03, y - h * 0.15, h * 0.06, h * 0.2);
    for (let k = 0; k < 4; ++k) {
      const ty = y - h * 0.15 - k * h * 0.22, tw = w * (1 - k * 0.2);
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(x, ty - h * 0.36);
      g.lineTo(x + tw / 2, ty);
      g.lineTo(x - tw / 2, ty);
      g.closePath();
      g.fill();
      g.fillStyle = mid;
      g.beginPath();
      g.moveTo(x, ty - h * 0.36);
      g.lineTo(x - tw / 2, ty);
      g.lineTo(x - tw * 0.1, ty);
      g.closePath();
      g.fill();
      if (snow) {
        g.fillStyle = snow;
        g.beginPath();
        g.moveTo(x, ty - h * 0.36);
        g.lineTo(x + tw * 0.2, ty - h * 0.22);
        g.lineTo(x - tw * 0.24, ty - h * 0.2);
        g.closePath();
        g.fill();
        g.fillRect(x - tw / 2, ty - 2, tw * 0.7, 2);
      }
    }
  }

  function cloudStrip(rand, H, count, yLo, yHi, sizeLo, sizeHi, top, mid, bottom) {
    const s = strip(H);
    for (let i = 0; i < count; ++i) {
      const x = (i + rand() * 0.6) * STRIP_W / count;
      const y = yLo + rand() * (yHi - yLo);
      const w = sizeLo + rand() * (sizeHi - sizeLo);
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(s.g, xx, y, w, w * 0.32, mulberry(i * 31 + 7), top, mid, bottom); });
    }
    for (let i = 0; i < Math.ceil(count / 2); ++i) {
      const x = rand() * STRIP_W, y = yLo - 30 + rand() * (yHi - yLo + 40), w = sizeLo * (0.3 + rand() * 0.3);
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(s.g, xx, y, w, w * 0.3, mulberry(i * 97 + 3), top, mid, bottom); });
    }
    return s;
  }

  /* grass strokes, flower specks and soft rolling bands below a crest */
  function meadowGround(g, ys, H, r) {
    for (let b = 0; b < 3; ++b) {
      const off = 40 + b * 70;
      g.fillStyle = b % 2 ? 'rgba(20,60,20,0.18)' : 'rgba(180,230,120,0.1)';
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i < ys.length; ++i)
        g.lineTo(i * 4, ys[i] + off + Math.sin(i * 0.05 + b * 2) * 14);
      g.lineTo(STRIP_W, H);
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < 2600; ++i) {
      const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
      const y = y0 + 8 + r() * (H - y0);
      g.fillStyle = r() < 0.5 ? 'rgba(170,230,110,0.35)' : 'rgba(20,60,20,0.35)';
      g.fillRect(x, y, 1.5, 3 + r() * 5);
    }
    const petals = ['#ffffff', '#ffe46a', '#ff9ac0', '#c8a8ff'];
    for (let i = 0; i < 420; ++i) {
      const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
      const y = y0 + 12 + r() * (H - y0 - 12);
      g.fillStyle = petals[i % 4];
      g.globalAlpha = 0.45 + 0.5 * (y - y0) / (H - y0);
      g.fillRect(x, y, 2.5, 2.5);
    }
    g.globalAlpha = 1;
  }

  /* a sea of cloud: a row of big puffs over a solid, softly banded base */
  function seaStrip(rand, H, count, y, sizeLo, sizeHi, top, mid, bottom) {
    const s = cloudStrip(rand, H, count, y - 10, y + 10, sizeLo, sizeHi, top, mid, bottom);
    const g = s.g;
    g.fillStyle = linear(g, 0, y + 20, 0, H, [[0, mid], [1, bottom]]);
    g.fillRect(0, y + 20, STRIP_W, H - y - 20);
    for (let i = 0; i < count * 2; ++i) {
      const x = rand() * STRIP_W, yy = y + 50 + rand() * (H - y - 70), w = sizeLo * 0.5 + rand() * sizeLo * 0.5;
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(g, xx, yy, w, w * 0.25, mulberry(i * 13 + 5), rgba('#ffffff', 0.5), rgba('#ffffff', 0.25), rgba('#b8a0d8', 0.2)); });
    }
    return s;
  }

  /* soft beams of light falling through cracks in a cave roof */
  function shaftStrip(rand, color) {
    const SH = 460;
    const s = strip(SH);
    const g = s.g;
    for (let i = 0; i < 6; ++i) {
      const x = (i + 0.2 + rand() * 0.6) * STRIP_W / 6, w = 30 + rand() * 50, lean = 120 + rand() * 120;
      wrapDraw(STRIP_W, x, w + lean, function(xx) {
        g.fillStyle = linear(g, 0, 0, 0, SH, [[0, rgba(color, 0.24)], [0.6, rgba(color, 0.07)], [1, rgba(color, 0)]]);
        g.beginPath();
        g.moveTo(xx - w * 0.3, 0);
        g.lineTo(xx + w * 0.3, 0);
        g.lineTo(xx + w + lean, SH);
        g.lineTo(xx - w + lean, SH);
        g.closePath();
        g.fill();
      });
    }
    return s;
  }

  Object.assign(Kit, { strip, paintRange, paintHills, treeClump, poplar, bush, pine, cloudStrip, meadowGround, seaStrip, shaftStrip });
})();
