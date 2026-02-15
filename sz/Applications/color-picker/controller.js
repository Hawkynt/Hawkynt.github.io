;(function() {
  'use strict';

  // ===== Color conversion utilities =====

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function round(v) {
    return Math.round(v);
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [round((r + m) * 255), round((g + m) * 255), round((b + m) * 255)];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return [round(h), round(s), round(v)];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return [round(h), round(s * 100), round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return [round((r + m) * 255), round((g + m) * 255), round((b + m) * 255)];
  }

  function rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1)
      return [0, 0, 0, 100];

    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);
    return [round(c * 100), round(m * 100), round(y * 100), round(k * 100)];
  }

  function cmykToRgb(c, m, y, k) {
    c /= 100; m /= 100; y /= 100; k /= 100;
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    return [round(r), round(g), round(b)];
  }

  function rgbToHex(r, g, b) {
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    return hex.toUpperCase();
  }

  function rgbaToHex(r, g, b, a) {
    if (a < 1) {
      const hex = '#' + [r, g, b, round(a * 255)].map(v => v.toString(16).padStart(2, '0')).join('');
      return hex.toUpperCase();
    }
    return rgbToHex(r, g, b);
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    else if (hex.length === 4)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];

    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const a = parseInt(hex.substring(6, 8), 16) / 255;
      return isNaN(r + g + b + a) ? null : [r, g, b, a];
    }

    if (hex.length !== 6)
      return null;

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return isNaN(r + g + b) ? null : [r, g, b, 1];
  }

  // ===== State =====

  const state = {
    h: 0,      // 0-360
    s: 100,    // 0-100 (HSV saturation)
    v: 100,    // 0-100
    alpha: 1,  // 0-1
    oldR: 255, oldG: 0, oldB: 0, oldA: 1
  };
  const cmdLine = SZ.Dlls.Kernel32.GetCommandLine();

  function getRgb() {
    return hsvToRgb(state.h, state.s, state.v);
  }

  function emitColorToRequester() {
    if (!cmdLine || !cmdLine.returnKey)
      return false;
    const [r, g, b] = getRgb();
    const a = clamp(state.alpha, 0, 1);
    const payload = {
      type: 'color-picker-result',
      r, g, b, a: round(a * 255),
      hex: rgbaToHex(r, g, b, a),
      ts: Date.now()
    };
    try {
      localStorage.setItem(String(cmdLine.returnKey), JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  // ===== DOM references =====

  const svWrap = document.getElementById('sv-wrap');
  const svCanvas = document.getElementById('sv-canvas');
  const svCursor = document.getElementById('sv-cursor');
  const hueWrap = document.getElementById('hue-wrap');
  const hueCanvas = document.getElementById('hue-canvas');
  const hueSlider = document.getElementById('hue-slider');
  const alphaWrap = document.getElementById('alpha-wrap');
  const alphaCanvas = document.getElementById('alpha-canvas');
  const alphaSlider = document.getElementById('alpha-slider');

  const visualArea = document.getElementById('visual-area');
  const wheelArea = document.getElementById('wheel-area');
  const wheelWrap = document.getElementById('wheel-wrap');
  const wheelCanvas = document.getElementById('wheel-canvas');
  const wheelCursor = document.getElementById('wheel-cursor');
  const lvWrap = document.getElementById('lv-wrap');
  const lvCanvas = document.getElementById('lv-canvas');
  const lvSliderEl = document.getElementById('lv-slider');
  const wheelAlphaWrap = document.getElementById('wheel-alpha-wrap');
  const wheelAlphaCanvas = document.getElementById('wheel-alpha-canvas');
  const wheelAlphaSlider = document.getElementById('wheel-alpha-slider');

  const swatchNew = document.getElementById('swatch-new');
  const swatchOld = document.getElementById('swatch-old');

  const hexInput = document.getElementById('hex-input');
  const cssInput = document.getElementById('css-input');

  // ===== Wheel mode tracking =====

  let activeMode = 'rgb'; // 'rgb', 'hsl', 'hsv', 'cmyk'

  // ===== Canvas rendering =====

  function drawSvCanvas() {
    const w = svCanvas.width = svWrap.clientWidth;
    const h = svCanvas.height = svWrap.clientHeight;
    if (w === 0 || h === 0)
      return;

    const ctx = svCanvas.getContext('2d', { willReadFrequently: false });

    // Base hue fill
    const hueColor = hsvToRgb(state.h, 100, 100);
    ctx.fillStyle = `rgb(${hueColor[0]},${hueColor[1]},${hueColor[2]})`;
    ctx.fillRect(0, 0, w, h);

    // White gradient left-to-right (saturation)
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // Black gradient top-to-bottom (value)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawHueCanvas() {
    const w = hueCanvas.width = hueWrap.clientWidth;
    const h = hueCanvas.height = hueWrap.clientHeight;
    if (w === 0 || h === 0)
      return;

    const ctx = hueCanvas.getContext('2d', { willReadFrequently: false });
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const steps = [
      [0, '#ff0000'], [1/6, '#ffff00'], [2/6, '#00ff00'],
      [3/6, '#00ffff'], [4/6, '#0000ff'], [5/6, '#ff00ff'], [1, '#ff0000']
    ];
    for (const [stop, color] of steps)
      grad.addColorStop(stop, color);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawAlphaCanvas() {
    const w = alphaCanvas.width = alphaWrap.clientWidth;
    const h = alphaCanvas.height = alphaWrap.clientHeight;
    if (w === 0 || h === 0)
      return;

    const ctx = alphaCanvas.getContext('2d', { willReadFrequently: false });
    const [r, g, b] = getRgb();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // ===== Color wheel rendering =====

  let wheelImageData = null;
  let wheelLastLV = -1;
  let wheelLastMode = null;

  function drawWheelCanvas() {
    const size = 200;
    wheelCanvas.width = size;
    wheelCanvas.height = size;
    const ctx = wheelCanvas.getContext('2d', { willReadFrequently: false });
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    // Determine current L or V value
    const isHSL = activeMode === 'hsl';
    let lvValue;
    if (isHSL) {
      const [, , l] = rgbToHsl(...getRgb());
      lvValue = l;
    } else
      lvValue = state.v;

    // Cache: only redraw if L/V or mode changed
    if (wheelImageData && wheelLastLV === lvValue && wheelLastMode === activeMode) {
      ctx.putImageData(wheelImageData, 0, 0);
      return;
    }

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; ++y) {
      for (let x = 0; x < size; ++x) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;

        if (dist <= radius) {
          const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const sat = (dist / radius) * 100;
          let r, g, b;
          if (isHSL)
            [r, g, b] = hslToRgb(hue, sat, lvValue);
          else
            [r, g, b] = hsvToRgb(hue, sat, lvValue);

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    wheelImageData = imgData;
    wheelLastLV = lvValue;
    wheelLastMode = activeMode;
  }

  function drawLvCanvas() {
    const w = lvCanvas.width = lvWrap.clientWidth;
    const h = lvCanvas.height = lvWrap.clientHeight;
    if (w === 0 || h === 0)
      return;

    const ctx = lvCanvas.getContext('2d', { willReadFrequently: false });
    const isHSL = activeMode === 'hsl';
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    // For HSL mode, use the HSL saturation derived from current color
    let sat;
    if (isHSL) {
      const [, hslS] = rgbToHsl(...getRgb());
      sat = hslS;
    } else
      sat = state.s;

    for (let y = 0; y < h; ++y) {
      // top = 100%, bottom = 0%
      const lvVal = (1 - y / (h - 1)) * 100;
      let r, g, b;
      if (isHSL)
        [r, g, b] = hslToRgb(state.h, sat, lvVal);
      else
        [r, g, b] = hsvToRgb(state.h, sat, lvVal);

      for (let x = 0; x < w; ++x) {
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function drawWheelAlphaCanvas() {
    const w = wheelAlphaCanvas.width = wheelAlphaWrap.clientWidth;
    const h = wheelAlphaCanvas.height = wheelAlphaWrap.clientHeight;
    if (w === 0 || h === 0)
      return;

    const ctx = wheelAlphaCanvas.getContext('2d', { willReadFrequently: false });
    const [r, g, b] = getRgb();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function updateWheelCursor() {
    const size = 200;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    // Convert hue+saturation to x,y on wheel
    // For HSL mode, we need to derive saturation from HSL saturation
    let sat;
    if (activeMode === 'hsl') {
      const [, hslS] = rgbToHsl(...getRgb());
      sat = hslS;
    } else
      sat = state.s;

    const hueRad = state.h * Math.PI / 180;
    const dist = (sat / 100) * radius;
    const x = centerX + dist * Math.cos(hueRad);
    const y = centerY + dist * Math.sin(hueRad);
    wheelCursor.style.left = x + 'px';
    wheelCursor.style.top = y + 'px';
  }

  function updateLvSlider() {
    const h = lvWrap.clientHeight;
    const isHSL = activeMode === 'hsl';
    let lvVal;
    if (isHSL) {
      const [, , l] = rgbToHsl(...getRgb());
      lvVal = l;
    } else
      lvVal = state.v;

    const y = (1 - lvVal / 100) * h;
    lvSliderEl.style.top = y + 'px';
  }

  function updateWheelAlphaSlider() {
    const h = wheelAlphaWrap.clientHeight;
    const y = (1 - state.alpha) * h;
    wheelAlphaSlider.style.top = y + 'px';
  }

  function isWheelMode() {
    return activeMode === 'hsl' || activeMode === 'hsv';
  }

  function invalidateWheelCache() {
    wheelImageData = null;
    wheelLastLV = -1;
    wheelLastMode = null;
  }

  function updateSvCursor() {
    const w = svWrap.clientWidth;
    const h = svWrap.clientHeight;
    const x = (state.s / 100) * w;
    const y = (1 - state.v / 100) * h;
    svCursor.style.left = x + 'px';
    svCursor.style.top = y + 'px';
  }

  function updateHueSlider() {
    const h = hueWrap.clientHeight;
    const y = (state.h / 360) * h;
    hueSlider.style.top = y + 'px';
  }

  function updateAlphaSlider() {
    const h = alphaWrap.clientHeight;
    const y = (1 - state.alpha) * h;
    alphaSlider.style.top = y + 'px';
  }

  // ===== UI update =====

  let suppressSliderUpdate = false;

  function updateAllUI() {
    const [r, g, b] = getRgb();
    const a = state.alpha;

    // Preview swatches
    swatchNew.style.background = `rgba(${r},${g},${b},${a})`;

    // Hex
    hexInput.value = rgbaToHex(r, g, b, a);

    // CSS string
    if (a < 1)
      cssInput.value = `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    else
      cssInput.value = `rgb(${r}, ${g}, ${b})`;

    // RGB sliders
    if (!suppressSliderUpdate) {
      setSlider('r', r);
      setSlider('g', g);
      setSlider('b', b);
    }

    // HSL
    const [hslH, hslS, hslL] = rgbToHsl(r, g, b);
    if (!suppressSliderUpdate) {
      setSlider('hsl-h', state.h); // preserve hue from state, not from rgb->hsl round-trip
      setSlider('hsl-s', hslS);
      setSlider('hsl-l', hslL);
    }

    // HSV
    if (!suppressSliderUpdate) {
      setSlider('hsv-h', state.h);
      setSlider('hsv-s', state.s);
      setSlider('hsv-v', state.v);
    }

    // CMYK
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    if (!suppressSliderUpdate) {
      setSlider('c', c);
      setSlider('m', m);
      setSlider('y', y);
      setSlider('k', k);
    }

    // Alpha
    if (!suppressSliderUpdate) {
      setSlider('alpha', round(a * 100));
    }

    // Float values
    document.getElementById('float-r').value = (r / 255).toFixed(4);
    document.getElementById('float-g').value = (g / 255).toFixed(4);
    document.getElementById('float-b').value = (b / 255).toFixed(4);
    document.getElementById('float-a').value = a.toFixed(4);

    // Canvas + cursors
    if (isWheelMode()) {
      drawWheelCanvas();
      drawLvCanvas();
      drawWheelAlphaCanvas();
      updateWheelCursor();
      updateLvSlider();
      updateWheelAlphaSlider();
    } else {
      drawSvCanvas();
      drawAlphaCanvas();
      updateSvCursor();
      updateHueSlider();
      updateAlphaSlider();
    }
  }

  function setSlider(name, value) {
    const sl = document.getElementById('sl-' + name);
    const num = document.getElementById('num-' + name);
    if (sl) sl.value = value;
    if (num) num.value = value;
  }

  function setFromRgb(r, g, b, preserveHue) {
    const [h, s, v] = rgbToHsv(r, g, b);
    // Preserve hue when saturation or value is 0 (achromatic)
    if (preserveHue && (s === 0 || v === 0))
      state.s = s, state.v = v;
    else
      Object.assign(state, { h, s, v });
  }

  // ===== Pointer interaction: SV area =====

  function pickSV(e) {
    const rect = svWrap.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    state.s = round((x / rect.width) * 100);
    state.v = round((1 - y / rect.height) * 100);
    updateAllUI();
  }

  let svDragging = false;
  svWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    svDragging = true;
    svWrap.setPointerCapture(e.pointerId);
    pickSV(e);
  });
  svWrap.addEventListener('pointermove', (e) => {
    if (svDragging) pickSV(e);
  });
  svWrap.addEventListener('pointerup', (e) => {
    svDragging = false;
    svWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Pointer interaction: Hue bar =====

  function pickHue(e) {
    const rect = hueWrap.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    state.h = round((y / rect.height) * 360);
    if (state.h >= 360) state.h = 359;
    updateAllUI();
  }

  let hueDragging = false;
  hueWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hueDragging = true;
    hueWrap.setPointerCapture(e.pointerId);
    pickHue(e);
  });
  hueWrap.addEventListener('pointermove', (e) => {
    if (hueDragging) pickHue(e);
  });
  hueWrap.addEventListener('pointerup', (e) => {
    hueDragging = false;
    hueWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Pointer interaction: Alpha bar =====

  function pickAlpha(e) {
    const rect = alphaWrap.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    state.alpha = +(1 - y / rect.height).toFixed(2);
    state.alpha = clamp(state.alpha, 0, 1);
    updateAllUI();
  }

  let alphaDragging = false;
  alphaWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    alphaDragging = true;
    alphaWrap.setPointerCapture(e.pointerId);
    pickAlpha(e);
  });
  alphaWrap.addEventListener('pointermove', (e) => {
    if (alphaDragging) pickAlpha(e);
  });
  alphaWrap.addEventListener('pointerup', (e) => {
    alphaDragging = false;
    alphaWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Pointer interaction: Color wheel =====

  function pickWheel(e) {
    const rect = wheelWrap.getBoundingClientRect();
    const size = rect.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = px - centerX;
    const dy = py - centerY;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius)
      dist = radius;

    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const sat = (dist / radius) * 100;

    if (activeMode === 'hsl') {
      // Get current L
      const [, , curL] = rgbToHsl(...getRgb());
      const [r, g, b] = hslToRgb(hue, sat, curL);
      setFromRgb(r, g, b, true);
      state.h = round(hue);
    } else {
      state.h = round(hue);
      state.s = round(sat);
    }

    updateAllUI();
  }

  let wheelDragging = false;
  wheelWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    wheelDragging = true;
    wheelWrap.setPointerCapture(e.pointerId);
    pickWheel(e);
  });
  wheelWrap.addEventListener('pointermove', (e) => {
    if (wheelDragging) pickWheel(e);
  });
  wheelWrap.addEventListener('pointerup', (e) => {
    wheelDragging = false;
    wheelWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Pointer interaction: L/V slider =====

  function pickLV(e) {
    const rect = lvWrap.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    const lvVal = round((1 - y / rect.height) * 100);

    if (activeMode === 'hsl') {
      // Get current H and HSL-S
      const curH = state.h;
      const [, hslS] = rgbToHsl(...getRgb());
      const [r, g, b] = hslToRgb(curH, hslS, lvVal);
      setFromRgb(r, g, b, true);
      state.h = curH;
    } else {
      state.v = lvVal;
    }

    invalidateWheelCache();
    updateAllUI();
  }

  let lvDragging = false;
  lvWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lvDragging = true;
    lvWrap.setPointerCapture(e.pointerId);
    pickLV(e);
  });
  lvWrap.addEventListener('pointermove', (e) => {
    if (lvDragging) pickLV(e);
  });
  lvWrap.addEventListener('pointerup', (e) => {
    lvDragging = false;
    lvWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Pointer interaction: Wheel alpha bar =====

  function pickWheelAlpha(e) {
    const rect = wheelAlphaWrap.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    state.alpha = +(1 - y / rect.height).toFixed(2);
    state.alpha = clamp(state.alpha, 0, 1);
    updateAllUI();
  }

  let wheelAlphaDragging = false;
  wheelAlphaWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    wheelAlphaDragging = true;
    wheelAlphaWrap.setPointerCapture(e.pointerId);
    pickWheelAlpha(e);
  });
  wheelAlphaWrap.addEventListener('pointermove', (e) => {
    if (wheelAlphaDragging) pickWheelAlpha(e);
  });
  wheelAlphaWrap.addEventListener('pointerup', (e) => {
    wheelAlphaDragging = false;
    wheelAlphaWrap.releasePointerCapture(e.pointerId);
  });

  // ===== Tab switching =====

  const tabBar = document.getElementById('tab-bar');
  tabBar.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn)
      return;

    for (const t of tabBar.querySelectorAll('.tab-btn'))
      t.classList.remove('active');
    btn.classList.add('active');

    for (const p of document.querySelectorAll('.tab-panel'))
      p.classList.remove('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');

    const newMode = btn.dataset.tab;
    const wasWheel = isWheelMode();
    activeMode = newMode;
    const nowWheel = isWheelMode();

    if (wasWheel !== nowWheel) {
      invalidateWheelCache();
      if (nowWheel) {
        visualArea.classList.add('hidden');
        wheelArea.classList.remove('hidden');
      } else {
        wheelArea.classList.add('hidden');
        visualArea.classList.remove('hidden');
      }
    } else if (nowWheel)
      invalidateWheelCache();

    updateAllUI();
  });

  // ===== Slider / numeric input wiring =====

  function wireSlider(name, onChange) {
    const sl = document.getElementById('sl-' + name);
    const num = document.getElementById('num-' + name);

    sl.addEventListener('input', () => {
      num.value = sl.value;
      suppressSliderUpdate = true;
      onChange(parseInt(sl.value, 10));
      suppressSliderUpdate = false;
    });

    num.addEventListener('input', () => {
      const v = clamp(parseInt(num.value, 10) || 0, parseInt(num.min, 10), parseInt(num.max, 10));
      sl.value = v;
      suppressSliderUpdate = true;
      onChange(v);
      suppressSliderUpdate = false;
    });

    num.addEventListener('blur', () => {
      num.value = clamp(parseInt(num.value, 10) || 0, parseInt(num.min, 10), parseInt(num.max, 10));
    });
  }

  // RGB sliders
  wireSlider('r', (v) => { const [, g, b] = getRgb(); setFromRgb(v, g, b, true); invalidateWheelCache(); updateAllUI(); });
  wireSlider('g', (v) => { const [r, , b] = getRgb(); setFromRgb(r, v, b, true); invalidateWheelCache(); updateAllUI(); });
  wireSlider('b', (v) => { const [r, g] = getRgb(); setFromRgb(r, g, v, true); invalidateWheelCache(); updateAllUI(); });

  // HSL sliders
  wireSlider('hsl-h', (v) => { state.h = v; invalidateWheelCache(); updateAllUI(); });
  wireSlider('hsl-s', (v) => {
    const hslH = state.h;
    const hslL = parseInt(document.getElementById('sl-hsl-l').value, 10);
    const [r, g, b] = hslToRgb(hslH, v, hslL);
    setFromRgb(r, g, b, true);
    state.h = hslH;
    invalidateWheelCache();
    updateAllUI();
  });
  wireSlider('hsl-l', (v) => {
    const hslH = state.h;
    const hslS = parseInt(document.getElementById('sl-hsl-s').value, 10);
    const [r, g, b] = hslToRgb(hslH, hslS, v);
    setFromRgb(r, g, b, true);
    state.h = hslH;
    invalidateWheelCache();
    updateAllUI();
  });

  // HSV sliders
  wireSlider('hsv-h', (v) => { state.h = v; invalidateWheelCache(); updateAllUI(); });
  wireSlider('hsv-s', (v) => { state.s = v; invalidateWheelCache(); updateAllUI(); });
  wireSlider('hsv-v', (v) => { state.v = v; invalidateWheelCache(); updateAllUI(); });

  // CMYK sliders
  wireSlider('c', (v) => {
    const m = parseInt(document.getElementById('sl-m').value, 10);
    const y = parseInt(document.getElementById('sl-y').value, 10);
    const k = parseInt(document.getElementById('sl-k').value, 10);
    const [r, g, b] = cmykToRgb(v, m, y, k);
    setFromRgb(r, g, b, true);
    invalidateWheelCache();
    updateAllUI();
  });
  wireSlider('m', (v) => {
    const c = parseInt(document.getElementById('sl-c').value, 10);
    const y = parseInt(document.getElementById('sl-y').value, 10);
    const k = parseInt(document.getElementById('sl-k').value, 10);
    const [r, g, b] = cmykToRgb(c, v, y, k);
    setFromRgb(r, g, b, true);
    invalidateWheelCache();
    updateAllUI();
  });
  wireSlider('y', (v) => {
    const c = parseInt(document.getElementById('sl-c').value, 10);
    const m = parseInt(document.getElementById('sl-m').value, 10);
    const k = parseInt(document.getElementById('sl-k').value, 10);
    const [r, g, b] = cmykToRgb(c, m, v, k);
    setFromRgb(r, g, b, true);
    invalidateWheelCache();
    updateAllUI();
  });
  wireSlider('k', (v) => {
    const c = parseInt(document.getElementById('sl-c').value, 10);
    const m = parseInt(document.getElementById('sl-m').value, 10);
    const y = parseInt(document.getElementById('sl-y').value, 10);
    const [r, g, b] = cmykToRgb(c, m, y, v);
    setFromRgb(r, g, b, true);
    invalidateWheelCache();
    updateAllUI();
  });

  // Alpha slider
  wireSlider('alpha', (v) => {
    state.alpha = v / 100;
    updateAllUI();
  });

  // ===== Hex input =====

  hexInput.addEventListener('change', () => {
    let val = hexInput.value.trim();
    if (!val.startsWith('#'))
      val = '#' + val;

    const result = hexToRgb(val);
    if (result) {
      const [r, g, b, a] = result;
      setFromRgb(r, g, b, false);
      state.alpha = a;
      invalidateWheelCache();
      updateAllUI();
    } else
      updateAllUI(); // revert display
  });

  hexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
      hexInput.dispatchEvent(new Event('change'));
  });

  // ===== Copy buttons =====

  document.getElementById('btn-copy-hex').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(hexInput.value).catch(() => {});
  });

  document.getElementById('btn-copy-css').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(cssInput.value).catch(() => {});
  });

  // ===== Eyedropper =====

  const eyedropperNative = document.getElementById('eyedropper-native');
  const sampleSizeSelect = document.getElementById('sample-size');

  function applyEyeDropperHex(hex) {
    if (hex) {
      hexInput.value = hex;
      hexInput.dispatchEvent(new Event('change'));
    }
  }

  // Native color picker returns #rrggbb
  eyedropperNative.addEventListener('input', () => {
    applyEyeDropperHex(eyedropperNative.value);
  });

  document.getElementById('btn-eyedropper').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const diameter = parseInt(sampleSizeSelect.value, 10) || 1;

    if (diameter <= 1) {
      // 1px mode: open the native color picker (has built-in eyedropper in Chrome/Edge)
      eyedropperNative.click();
      return;
    }

    // Circle sampling mode: ask parent to capture tab and show overlay
    if (window.parent !== window) {
      const requestId = 'eyedrop-circle-' + Date.now();
      const handler = (ev) => {
        if (ev.data?.type !== 'sz:eyeDropperCircleResult' || ev.data?.requestId !== requestId)
          return;
        window.removeEventListener('message', handler);
        if (ev.data.hex)
          applyEyeDropperHex(ev.data.hex);
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'sz:eyeDropperCircle', diameter, requestId }, '*');
    }
  });

  // ===== Palette =====

  const BASIC_COLORS = [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#C0C0C0',
    '#808080', '#FF0000', '#00FF00', '#FFFF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF',
    '#000033', '#003300', '#330000', '#003333', '#330033', '#333300', '#333333', '#666666',
    '#006600', '#660000', '#660066', '#006666', '#666600', '#000066', '#999999', '#CCCCCC'
  ];

  const MAX_CUSTOM = 16;
  let customColors = loadCustomColors();

  function loadCustomColors() {
    try {
      const stored = localStorage.getItem('sz-colorpicker-custom');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr))
          return arr.slice(0, MAX_CUSTOM);
      }
    } catch {
      // ignore
    }
    return [];
  }

  function saveCustomColors() {
    try {
      localStorage.setItem('sz-colorpicker-custom', JSON.stringify(customColors));
    } catch {
      // ignore
    }
  }

  function buildBasicPalette() {
    const container = document.getElementById('basic-palette');
    container.innerHTML = '';
    for (const color of BASIC_COLORS) {
      const el = document.createElement('div');
      el.className = 'palette-swatch';
      el.style.background = color;
      el.title = color;
      el.dataset.color = color;
      container.appendChild(el);
    }
  }

  function buildCustomPalette() {
    const container = document.getElementById('custom-palette');
    container.innerHTML = '';
    for (let i = 0; i < MAX_CUSTOM; ++i) {
      const el = document.createElement('div');
      el.className = 'palette-swatch';
      if (i < customColors.length) {
        el.style.background = customColors[i];
        el.title = customColors[i];
        el.dataset.color = customColors[i];
      } else {
        el.classList.add('empty');
        el.title = 'Empty';
      }
      container.appendChild(el);
    }
  }

  function handlePaletteClick(e) {
    const swatch = e.target.closest('.palette-swatch');
    if (!swatch || !swatch.dataset.color)
      return;

    const result = hexToRgb(swatch.dataset.color);
    if (result) {
      const [r, g, b, a] = result;
      setFromRgb(r, g, b, false);
      state.alpha = a;
      invalidateWheelCache();
      updateAllUI();
    }
  }

  document.getElementById('basic-palette').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handlePaletteClick(e);
  });

  document.getElementById('custom-palette').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handlePaletteClick(e);
  });

  document.getElementById('btn-add-custom').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [r, g, b] = getRgb();
    const hex = rgbToHex(r, g, b);

    // Don't add duplicates
    if (!customColors.includes(hex)) {
      if (customColors.length >= MAX_CUSTOM)
        customColors.shift(); // remove oldest
      customColors.push(hex);
      saveCustomColors();
      buildCustomPalette();
    }
  });

  // ===== OK / Cancel =====

  document.getElementById('btn-ok').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    emitColorToRequester();
    SZ.Dlls.User32.DestroyWindow();
  });

  document.getElementById('btn-cancel').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    SZ.Dlls.User32.DestroyWindow();
  });

  // ===== Resize handling =====

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer)
      clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isWheelMode()) {
        invalidateWheelCache();
        drawWheelCanvas();
        drawLvCanvas();
        drawWheelAlphaCanvas();
        updateWheelCursor();
        updateLvSlider();
        updateWheelAlphaSlider();
      } else {
        drawSvCanvas();
        drawHueCanvas();
        drawAlphaCanvas();
        updateSvCursor();
        updateHueSlider();
        updateAlphaSlider();
      }
    }, 30);
  });

  // ===== Init =====

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    if (cmdLine && cmdLine.hex) {
      const parsed = hexToRgb(String(cmdLine.hex));
      if (parsed) {
        const [r, g, b, a] = parsed;
        setFromRgb(r, g, b, false);
        state.alpha = a;
      }
    }

    buildBasicPalette();
    buildCustomPalette();

    // Set initial old color
    swatchOld.style.background = `rgba(${state.oldR},${state.oldG},${state.oldB},${state.oldA})`;

    // Draw canvases
    drawHueCanvas();
    drawSvCanvas();
    drawAlphaCanvas();
    updateAllUI();
  }

  // Defer to ensure layout is complete
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

  // ===== Menu system =====
  ;(function() {
    const menuBar = document.querySelector('.menu-bar');
    if (!menuBar) return;
    let openMenu = null;
    function closeMenus() {
      if (openMenu) { openMenu.classList.remove('open'); openMenu = null; }
    }
    menuBar.addEventListener('pointerdown', function(e) {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const entry = e.target.closest('.menu-entry');
      if (entry) {
        const action = entry.dataset.action;
        closeMenus();
        if (action === 'about') {
          const dlg = document.getElementById('dlg-about');
          if (dlg) dlg.classList.add('visible');
        }
        return;
      }
      if (openMenu === item) { closeMenus(); return; }
      closeMenus();
      item.classList.add('open');
      openMenu = item;
    });
    menuBar.addEventListener('pointerenter', function(e) {
      if (!openMenu) return;
      const item = e.target.closest('.menu-item');
      if (item && item !== openMenu) { closeMenus(); item.classList.add('open'); openMenu = item; }
    }, true);
    document.addEventListener('pointerdown', function(e) {
      if (openMenu && !e.target.closest('.menu-bar')) closeMenus();
    });
  })();

  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });
})();
