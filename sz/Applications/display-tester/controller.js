;(function() {
  'use strict';

  // ===== Constants =====

  const CATEGORIES = [
    { id: 'dead-pixel', name: 'Dead Pixel Tests', key: '1' },
    { id: 'color', name: 'Color Tests', key: '2' },
    { id: 'uniformity', name: 'Uniformity Tests', key: '3' },
    { id: 'fps', name: 'FPS / Refresh Rate', key: '4' },
    { id: 'motion', name: 'Motion / Response Time', key: '5' },
    { id: 'hdr', name: 'HDR / Dynamic Range', key: '6' },
    { id: 'geometry', name: 'Geometry / Sharpness', key: '7' },
    { id: 'calibration', name: 'Calibration Tools', key: '8' },
  ];

  // ===== Test Registry =====

  const TESTS = [
    // Dead Pixel (6)
    { id: 'solid-red', name: 'Solid Red', category: 'dead-pixel', type: 'solid', color: '#ff0000', description: 'Full red screen for dead/stuck pixel detection' },
    { id: 'solid-green', name: 'Solid Green', category: 'dead-pixel', type: 'solid', color: '#00ff00', description: 'Full green screen for dead/stuck pixel detection' },
    { id: 'solid-blue', name: 'Solid Blue', category: 'dead-pixel', type: 'solid', color: '#0000ff', description: 'Full blue screen for dead/stuck pixel detection' },
    { id: 'solid-white', name: 'Solid White', category: 'dead-pixel', type: 'solid', color: '#ffffff', description: 'Full white screen for dead/stuck pixel detection' },
    { id: 'solid-black', name: 'Solid Black', category: 'dead-pixel', type: 'solid', color: '#000000', description: 'Full black screen for dead/stuck pixel detection' },
    { id: 'solid-gray', name: 'Solid Gray', category: 'dead-pixel', type: 'solid', color: '#808080', description: 'Full gray screen for dead/stuck pixel detection' },

    // Color (7)
    { id: 'rgb-gradient', name: 'RGB Gradient Bars', category: 'color', type: 'canvas', render: renderRgbGradient, description: 'Horizontal red, green, blue gradient strips' },
    { id: 'grayscale-gradient', name: 'Grayscale Gradient', category: 'color', type: 'canvas', render: renderGrayscaleGradient, description: 'Smooth 0-255 horizontal gradient' },
    { id: 'color-checker', name: 'Color Checker', category: 'color', type: 'canvas', render: renderColorChecker, description: 'Grid of known sRGB reference colors' },
    { id: 'gamma-test', name: 'Gamma Test', category: 'color', type: 'canvas', render: renderGammaTest, description: 'Stripe patterns vs gray patches for gamma matching' },
    { id: 'color-bleed', name: 'Color Bleed', category: 'color', type: 'canvas', render: renderColorBleed, description: 'Sharp color rectangles on black to check fringing' },
    { id: 'color-banding', name: 'Color Banding', category: 'color', type: 'canvas', render: renderColorBanding, description: 'Narrow-range gradients to reveal posterization and banding' },
    { id: 'dithering-detect', name: 'Dithering Detection', category: 'color', type: 'canvas', render: renderDitheringDetect, description: 'Adjacent near-identical patches to detect temporal dithering (6-bit+FRC)' },

    // Uniformity (6)
    { id: 'white-uniformity', name: 'White Uniformity', category: 'uniformity', type: 'solid', color: '#ffffff', description: 'Pure white to reveal uneven brightness' },
    { id: 'low-gray-uniformity', name: 'Low Gray Uniformity', category: 'uniformity', type: 'solid', color: '#222222', description: 'Dark gray to reveal backlight bleed' },
    { id: 'five-point', name: '5-Point Brightness', category: 'uniformity', type: 'canvas', render: renderFivePoint, description: 'White screen with 5 measurement points' },
    { id: 'uniformity-sweep', name: 'Uniformity Sweep', category: 'uniformity', type: 'canvas', render: renderUniformitySweep, controls: 'sweep', description: 'Adjustable brightness level to find DSE, banding, and bleed at any gray' },
    { id: 'viewing-angle', name: 'Viewing Angle', category: 'uniformity', type: 'canvas', render: renderViewingAngle, description: 'Mid-gray reference for checking color shift at off-axis viewing angles' },
    { id: 'burn-in-check', name: 'Burn-in / Retention', category: 'uniformity', type: 'canvas', render: renderBurnInCheck, controls: 'burnin', description: 'Static pattern then gray fill to check for image retention (OLED)' },

    // FPS / Refresh Rate (3)
    { id: 'fps-counter', name: 'Frame Counter', category: 'fps', type: 'animated', render: renderFpsCounter, description: 'Measures actual FPS via requestAnimationFrame' },
    { id: 'ufo-test', name: 'UFO Test', category: 'fps', type: 'animated', render: renderUfoTest, controls: 'ufo', description: 'Per-FPS-rate lanes reveal refresh rate and motion interpolation' },
    { id: 'vsync-tear', name: 'Vsync Tear Test', category: 'fps', type: 'animated', render: renderVsyncTear, description: 'Fast vertical bar sweep to detect tearing' },

    // Motion / Response Time (3)
    { id: 'moving-crosshair', name: 'Moving Crosshair', category: 'motion', type: 'animated', render: renderMovingCrosshair, description: 'Orbiting crosshair tests pixel response blur' },
    { id: 'bw-flash', name: 'Black-to-White Flash', category: 'motion', type: 'animated', render: renderBwFlash, description: 'Alternates black/white each frame for response testing' },
    { id: 'pursuit-camera', name: 'Pursuit Camera Test', category: 'motion', type: 'animated', render: renderPursuitCamera, description: 'Scrolling columns show effective response time' },
    { id: 'input-lag', name: 'Input Lag Flasher', category: 'motion', type: 'animated', render: renderInputLag, description: 'Click to flash white -- film with slow-mo camera to measure input lag' },
    { id: 'gray-to-gray', name: 'Gray-to-Gray', category: 'motion', type: 'animated', render: renderGrayToGray, controls: 'g2g', description: 'Patch grid alternating gray levels to reveal per-transition response times' },
    { id: 'scrolling-text', name: 'Scrolling Text', category: 'motion', type: 'animated', render: renderScrollingText, controls: 'scroll-speed', description: 'Scrolling text block to test readability at various motion speeds' },

    // HDR / Dynamic Range (4)
    { id: 'hdr-gradient', name: 'HDR Gradient', category: 'hdr', type: 'webgl', render: renderHdrGradient, description: 'Extended brightness gradient for HDR displays (WebGL2)' },
    { id: 'hdr-clipping', name: 'HDR Highlight Clipping', category: 'hdr', type: 'webgl', render: renderHdrClipping, description: 'Bright patches at 1x-8x to test HDR headroom' },
    { id: 'contrast-ratio', name: 'Contrast Ratio', category: 'hdr', type: 'canvas', render: renderContrastRatio, description: 'Half black, half white to measure contrast' },
    { id: 'shadow-detail', name: 'Shadow Detail', category: 'hdr', type: 'canvas', render: renderShadowDetail, description: 'Near-black patches at 1%-5% to test black crush' },

    // Geometry / Sharpness (5)
    { id: 'pixel-grid', name: '1px Grid', category: 'geometry', type: 'canvas', render: renderPixelGrid, controls: 'grid', description: '1-pixel grid lines for sharpness testing' },
    { id: 'checkerboard', name: 'Checkerboard', category: 'geometry', type: 'canvas', render: renderCheckerboard, controls: 'checker', description: 'Alternating pixel patterns at various sizes' },
    { id: 'circle-line', name: 'Circle / Line Test', category: 'geometry', type: 'canvas', render: renderCircleLine, description: 'Concentric circles + radial lines for distortion check' },
    { id: 'text-sharpness', name: 'Text Sharpness', category: 'geometry', type: 'canvas', render: renderTextSharpness, description: 'Text at various sizes to check subpixel rendering' },
    { id: 'aspect-ratio', name: 'Aspect Ratio', category: 'geometry', type: 'canvas', render: renderAspectRatio, description: 'Circle + rectangle to verify correct aspect ratio' },
    { id: 'subpixel-layout', name: 'Subpixel Layout', category: 'geometry', type: 'canvas', render: renderSubpixelLayout, description: 'Colored single-pixel patterns to identify RGB vs BGR subpixel order' },
    { id: 'moire-pattern', name: 'Moir\u00e9 Pattern', category: 'geometry', type: 'canvas', render: renderMoirePattern, controls: 'moire', description: 'Non-integer-pixel grids to reveal aliasing and scaling artifacts' },

    // Calibration Tools (12)
    { id: 'gamma-calib', name: 'Gamma Calibration', category: 'calibration', type: 'canvas', render: renderGammaCalib, controls: 'gamma', description: 'Adjustable gamma reference -- match stripes to solid gray' },
    { id: 'rgb-balance', name: 'RGB Balance', category: 'calibration', type: 'canvas', render: renderRgbBalance, controls: 'rgb-balance', description: 'R/G/B gain sliders to check neutral gray balance' },
    { id: 'sharpness-pattern', name: 'Sharpness Pattern', category: 'calibration', type: 'canvas', render: renderSharpnessPattern, description: 'Siemens star + line pairs + zone plate for sharpness tuning' },
    { id: 'contrast-calib', name: 'Contrast Calibration', category: 'calibration', type: 'canvas', render: renderContrastCalib, description: 'Near-black and near-white patches for contrast adjustment' },
    { id: 'brightness-calib', name: 'Brightness Calibration', category: 'calibration', type: 'canvas', render: renderBrightnessCalib, description: '20 near-black patches for brightness adjustment' },
    { id: 'keystone-grid', name: 'Keystone Grid', category: 'calibration', type: 'canvas', render: renderKeystoneGrid, description: 'Full-screen grid with corner circles for projector alignment' },
    { id: 'overscan-detect', name: 'Overscan Detection', category: 'calibration', type: 'canvas', render: renderOverscanDetect, description: 'Nested colored borders to detect display overscan' },
    { id: 'color-temp', name: 'Color Temperature', category: 'calibration', type: 'canvas', render: renderColorTemp, controls: 'color-temp', description: 'Full-screen color temperature reference with Kelvin selector' },
    { id: 'convergence-test', name: 'Convergence Test', category: 'calibration', type: 'canvas', render: renderConvergenceTest, description: 'RGB crosshair grid to detect color misconvergence' },
    { id: 'backlight-bleed', name: 'Backlight Bleed', category: 'calibration', type: 'canvas', render: renderBacklightBleed, controls: 'backlight', description: 'Pure black screen to reveal backlight bleed in dark room' },
    { id: 'screen-ruler', name: 'Screen Ruler', category: 'calibration', type: 'canvas', render: renderScreenRuler, controls: 'ruler', description: 'Physical measurement ruler with credit card reference for DPI calibration' },
    { id: 'pixel-clock', name: 'Pixel Clock / Phase', category: 'calibration', type: 'canvas', render: renderPixelClock, description: 'Fine stripe patterns for analog display clock and phase adjustment' },
  ];

  // ===== DOM refs =====

  const testSelector = document.getElementById('test-selector');
  const testArea = document.getElementById('test-area');
  const testCanvas = document.getElementById('test-canvas');
  const glCanvas = document.getElementById('gl-canvas');
  const testOverlay = document.getElementById('test-overlay');
  const btnBack = document.getElementById('btn-back');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const testNameLabel = document.getElementById('test-name-label');
  const testControls = document.getElementById('test-controls');
  const toolbar = document.getElementById('toolbar');
  const statusBar = document.getElementById('status-bar');
  const sbTest = document.getElementById('sb-test');
  const sbResolution = document.getElementById('sb-resolution');
  const sbDpr = document.getElementById('sb-dpr');
  const sbFps = document.getElementById('sb-fps');

  // ===== State =====

  let mode = 'selector'; // 'selector' | 'testing'
  let currentTest = null;
  let animFrameId = null;
  let paused = false;
  let animState = {};
  let showDescriptions = true;
  let ctx = null;
  let gl = null;
  let glPrograms = {};
  let resizeObserver = null;

  // ===== Helpers =====

  function dpr() {
    return window.devicePixelRatio || 1;
  }

  function sizeCanvas(canvas, container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const d = dpr();
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    return { w: canvas.width, h: canvas.height, cssW: w, cssH: h, d };
  }

  function updateStatusBar() {
    sbDpr.textContent = 'DPR: ' + dpr().toFixed(2);
    if (currentTest) {
      sbTest.textContent = currentTest.name;
      const c = currentTest.type === 'webgl' ? glCanvas : testCanvas;
      sbResolution.textContent = c.width + '\u00d7' + c.height;
    } else {
      sbTest.textContent = 'Ready';
      sbResolution.textContent = '';
    }
  }

  // ===== Build test selector grid =====

  function buildSelector() {
    testSelector.innerHTML = '';
    for (const cat of CATEGORIES) {
      const header = document.createElement('div');
      header.className = 'category-header';
      header.textContent = cat.name;
      header.id = 'cat-' + cat.id;
      testSelector.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'test-grid';
      const tests = TESTS.filter(t => t.category === cat.id);
      for (const test of tests) {
        const card = document.createElement('div');
        card.className = 'test-card';
        card.dataset.testId = test.id;

        const preview = document.createElement('div');
        preview.className = 'test-card-preview';
        preview.style.background = previewBackground(test);
        card.appendChild(preview);

        const name = document.createElement('div');
        name.className = 'test-card-name';
        name.textContent = test.name;
        card.appendChild(name);

        if (showDescriptions) {
          const desc = document.createElement('div');
          desc.className = 'test-card-desc';
          desc.textContent = test.description;
          card.appendChild(desc);
        }

        card.addEventListener('click', () => runTest(test.id));
        grid.appendChild(card);
      }
      testSelector.appendChild(grid);
    }
  }

  function previewBackground(test) {
    if (test.type === 'solid')
      return test.color;
    switch (test.id) {
      case 'rgb-gradient': return 'linear-gradient(to right, red, green, blue)';
      case 'grayscale-gradient': return 'linear-gradient(to right, #000, #fff)';
      case 'color-checker': return 'linear-gradient(135deg, #f00 0%, #0f0 33%, #00f 66%, #ff0 100%)';
      case 'gamma-test': return 'repeating-linear-gradient(to right, #000 0px, #000 2px, #fff 2px, #fff 4px)';
      case 'color-bleed': return '#000';
      case 'five-point': return '#fff';
      case 'fps-counter': return '#111';
      case 'ufo-test': return 'linear-gradient(to right, #333, #666)';
      case 'vsync-tear': return '#222';
      case 'moving-crosshair': return '#1a1a2e';
      case 'bw-flash': return 'linear-gradient(to right, #000 50%, #fff 50%)';
      case 'pursuit-camera': return 'repeating-linear-gradient(to right, #000 0px, #000 4px, #fff 4px, #fff 8px)';
      case 'hdr-gradient':
      case 'hdr-clipping': return 'linear-gradient(to right, #333, #fff, #ffe)';
      case 'contrast-ratio': return 'linear-gradient(to right, #000 50%, #fff 50%)';
      case 'shadow-detail': return 'linear-gradient(to right, #000, #0d0d0d)';
      case 'pixel-grid': return 'repeating-conic-gradient(#888 0% 25%, #fff 0% 50%) 0 0/8px 8px';
      case 'checkerboard': return 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0 0/8px 8px';
      case 'circle-line': return 'radial-gradient(circle, #fff, #888)';
      case 'text-sharpness': return '#fff';
      case 'aspect-ratio': return '#333';
      case 'color-banding': return 'linear-gradient(to right, #0a0a0a, #1e1e1e)';
      case 'dithering-detect': return 'linear-gradient(to right, #7f7f7f 50%, #808080 50%)';
      case 'uniformity-sweep': return 'linear-gradient(to right, #000, #808080, #fff)';
      case 'viewing-angle': return '#808080';
      case 'burn-in-check': return 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0 0/16px 16px';
      case 'input-lag': return '#000';
      case 'gray-to-gray': return 'linear-gradient(to right, #000, #404040, #808080, #c0c0c0, #fff)';
      case 'scrolling-text': return '#1a1a2e';
      case 'subpixel-layout': return 'linear-gradient(to right, #f00 33%, #0f0 33% 66%, #00f 66%)';
      case 'moire-pattern': return 'repeating-linear-gradient(45deg, #000 0px, #000 1px, #fff 1px, #fff 3px)';
      case 'screen-ruler': return '#fff';
      case 'pixel-clock': return 'repeating-linear-gradient(to right, #000 0px, #000 1px, #fff 1px, #fff 2px)';
      case 'gamma-calib': return 'repeating-linear-gradient(to right, #000 0px, #000 1px, #fff 1px, #fff 2px)';
      case 'rgb-balance': return 'linear-gradient(to right, #f00, #888, #00f)';
      case 'sharpness-pattern': return 'conic-gradient(#000, #fff, #000, #fff, #000, #fff, #000, #fff)';
      case 'contrast-calib': return 'linear-gradient(to right, #000 50%, #fff 50%)';
      case 'brightness-calib': return '#050505';
      case 'keystone-grid': return 'repeating-conic-gradient(#fff 0% 25%, #000 0% 50%) 0 0/16px 16px';
      case 'overscan-detect': return 'linear-gradient(135deg, #f00, #ff0, #0f0, #00f)';
      case 'color-temp': return 'linear-gradient(to right, #ffc473, #fff, #c9d9ff)';
      case 'convergence-test': return '#000';
      case 'backlight-bleed': return '#000';
      default: return '#666';
    }
  }

  // ===== Run / stop tests =====

  function runTest(testId) {
    const test = TESTS.find(t => t.id === testId);
    if (!test) return;

    stopCurrentTest();
    currentTest = test;
    mode = 'testing';
    paused = false;
    animState = { time: 0, frame: 0, speed: 240, gridSpacing: 32, checkerSize: 1, gamma: 2.2, rGain: 100, gGain: 100, bGain: 100, colorTemp: 6500, showBorder: false, g2gInterval: 8, scrollSpeed: 60, sweepLevel: 128, showBurnPattern: true, moireSpacing: 2.5, rulerDpi: 96, doFlash: false, flashCount: 0 };

    testSelector.style.display = 'none';
    testArea.style.display = '';
    btnBack.disabled = false;
    testNameLabel.textContent = test.name;
    buildTestControls(test);

    if (test.type === 'webgl') {
      testCanvas.style.display = 'none';
      glCanvas.style.display = '';
      initWebGL();
      sizeCanvas(glCanvas, testArea);
      if (gl)
        test.render(gl, glCanvas, 0, animState);
      else
        showWebGLUnsupported();
    } else {
      testCanvas.style.display = '';
      glCanvas.style.display = 'none';
      ctx = testCanvas.getContext('2d');
      sizeCanvas(testCanvas, testArea);

      if (test.type === 'solid')
        renderSolid(ctx, testCanvas, test.color);
      else if (test.type === 'canvas')
        test.render(ctx, testCanvas, animState);
      else if (test.type === 'animated')
        startAnimation(test);
    }

    updateStatusBar();
  }

  function stopCurrentTest() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    testOverlay.innerHTML = '';
    sbFps.textContent = '';
    currentTest = null;
  }

  function exitTest() {
    if (document.fullscreenElement)
      document.exitFullscreen();

    stopCurrentTest();
    mode = 'selector';
    testArea.style.display = 'none';
    testSelector.style.display = '';
    btnBack.disabled = true;
    testNameLabel.textContent = '';
    testControls.innerHTML = '';
    updateStatusBar();
  }

  function buildTestControls(test) {
    testControls.innerHTML = '';
    if (test.controls === 'ufo') {
      const label = document.createElement('label');
      label.textContent = 'Speed: ';
      const sel = document.createElement('select');
      for (const s of [60, 120, 144, 240, 480, 960]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + ' px/s';
        if (s === 240) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { animState.speed = parseInt(sel.value, 10); });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'grid') {
      const label = document.createElement('label');
      label.textContent = 'Spacing: ';
      const sel = document.createElement('select');
      for (const s of [8, 16, 32, 48, 64, 128]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + 'px';
        if (s === 32) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        animState.gridSpacing = parseInt(sel.value, 10);
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'checker') {
      const label = document.createElement('label');
      label.textContent = 'Size: ';
      const sel = document.createElement('select');
      for (const s of [1, 2, 4, 8, 16]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + 'px';
        if (s === 1) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        animState.checkerSize = parseInt(sel.value, 10);
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'gamma') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'Gamma:';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '1.0';
      inp.max = '3.0';
      inp.step = '0.1';
      inp.value = String(animState.gamma);
      const val = document.createElement('span');
      val.className = 'range-val';
      val.textContent = animState.gamma.toFixed(1);
      inp.addEventListener('input', () => {
        animState.gamma = parseFloat(inp.value);
        val.textContent = animState.gamma.toFixed(1);
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      wrap.appendChild(val);
      testControls.appendChild(wrap);
    } else if (test.controls === 'rgb-balance') {
      for (const ch of [{ key: 'rGain', label: 'R' }, { key: 'gGain', label: 'G' }, { key: 'bGain', label: 'B' }]) {
        const wrap = document.createElement('span');
        wrap.className = 'tb-range';
        const lbl = document.createElement('span');
        lbl.className = 'range-label';
        lbl.textContent = ch.label + ':';
        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = '0';
        inp.max = '200';
        inp.step = '1';
        inp.value = String(animState[ch.key]);
        const val = document.createElement('span');
        val.className = 'range-val';
        val.textContent = animState[ch.key];
        inp.addEventListener('input', () => {
          animState[ch.key] = parseInt(inp.value, 10);
          val.textContent = inp.value;
          if (currentTest && currentTest.type === 'canvas')
            currentTest.render(ctx, testCanvas, animState);
        });
        wrap.appendChild(lbl);
        wrap.appendChild(inp);
        wrap.appendChild(val);
        testControls.appendChild(wrap);
      }
    } else if (test.controls === 'color-temp') {
      const label = document.createElement('label');
      label.textContent = 'Temperature: ';
      const sel = document.createElement('select');
      for (const k of [3200, 4000, 5000, 5500, 6500, 7500, 9300]) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k + 'K';
        if (k === animState.colorTemp) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        animState.colorTemp = parseInt(sel.value, 10);
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'backlight') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'Show Border:';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = animState.showBorder;
      inp.addEventListener('change', () => {
        animState.showBorder = inp.checked;
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      testControls.appendChild(wrap);
    } else if (test.controls === 'g2g') {
      const label = document.createElement('label');
      label.textContent = 'Interval: ';
      const sel = document.createElement('select');
      for (const s of [2, 4, 8, 16, 32]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + ' frames';
        if (s === animState.g2gInterval) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { animState.g2gInterval = parseInt(sel.value, 10); });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'scroll-speed') {
      const label = document.createElement('label');
      label.textContent = 'Speed: ';
      const sel = document.createElement('select');
      for (const s of [30, 60, 120, 180, 240, 480]) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s + ' px/s';
        if (s === animState.scrollSpeed) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { animState.scrollSpeed = parseInt(sel.value, 10); });
      label.appendChild(sel);
      testControls.appendChild(label);
    } else if (test.controls === 'sweep') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'Level:';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '0';
      inp.max = '255';
      inp.step = '1';
      inp.value = String(animState.sweepLevel);
      const val = document.createElement('span');
      val.className = 'range-val';
      val.textContent = animState.sweepLevel;
      inp.addEventListener('input', () => {
        animState.sweepLevel = parseInt(inp.value, 10);
        val.textContent = inp.value;
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      wrap.appendChild(val);
      testControls.appendChild(wrap);
    } else if (test.controls === 'burnin') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'Show Pattern:';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = animState.showBurnPattern;
      inp.addEventListener('change', () => {
        animState.showBurnPattern = inp.checked;
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      testControls.appendChild(wrap);
    } else if (test.controls === 'moire') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'Spacing:';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '1.5';
      inp.max = '5.0';
      inp.step = '0.1';
      inp.value = String(animState.moireSpacing);
      const val = document.createElement('span');
      val.className = 'range-val';
      val.textContent = animState.moireSpacing.toFixed(1);
      inp.addEventListener('input', () => {
        animState.moireSpacing = parseFloat(inp.value);
        val.textContent = animState.moireSpacing.toFixed(1);
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      wrap.appendChild(val);
      testControls.appendChild(wrap);
    } else if (test.controls === 'ruler') {
      const wrap = document.createElement('span');
      wrap.className = 'tb-range';
      const lbl = document.createElement('span');
      lbl.className = 'range-label';
      lbl.textContent = 'DPI:';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = '50';
      inp.max = '400';
      inp.step = '1';
      inp.value = String(animState.rulerDpi);
      const val = document.createElement('span');
      val.className = 'range-val';
      val.textContent = animState.rulerDpi;
      inp.addEventListener('input', () => {
        animState.rulerDpi = parseInt(inp.value, 10);
        val.textContent = inp.value;
        if (currentTest && currentTest.type === 'canvas')
          currentTest.render(ctx, testCanvas, animState);
      });
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      wrap.appendChild(val);
      testControls.appendChild(wrap);
    }
  }

  // ===== Navigation =====

  function navigateTest(direction) {
    if (!currentTest) return;
    const categoryTests = TESTS.filter(t => t.category === currentTest.category);
    const idx = categoryTests.findIndex(t => t.id === currentTest.id);
    const next = idx + direction;
    if (next >= 0 && next < categoryTests.length)
      runTest(categoryTests[next].id);
  }

  // ===== Animation loop =====

  function startAnimation(test) {
    let lastTime = null;
    const fpsHistory = [];
    const FPS_WINDOW = 60;

    function loop(timestamp) {
      if (!currentTest || currentTest.id !== test.id) return;

      if (lastTime === null) lastTime = timestamp;
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (dt > 0 && dt < 1) {
        fpsHistory.push(1 / dt);
        if (fpsHistory.length > FPS_WINDOW) fpsHistory.shift();
      }

      if (!paused) {
        animState.time += dt;
        ++animState.frame;
        test.render(ctx, testCanvas, dt, animState);
      }

      const avg = fpsHistory.length ? (fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length) : 0;
      sbFps.textContent = 'FPS: ' + Math.round(avg);

      animFrameId = requestAnimationFrame(loop);
    }

    animFrameId = requestAnimationFrame(loop);
  }

  // ===== Rendering functions =====

  // -- Solid fill --
  function renderSolid(ctx, canvas, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // -- Color: RGB Gradient --
  function renderRgbGradient(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const barH = Math.floor(h / 3);
    const colors = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ];
    for (let b = 0; b < 3; ++b) {
      const y = b * barH;
      const bh = b === 2 ? h - y : barH;
      for (let x = 0; x < w; ++x) {
        const t = x / (w - 1);
        const r = Math.round(colors[b][0] * t);
        const g = Math.round(colors[b][1] * t);
        const bl = Math.round(colors[b][2] * t);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
        ctx.fillRect(x, y, 1, bh);
      }
    }
  }

  // -- Color: Grayscale Gradient --
  function renderGrayscaleGradient(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; ++x) {
      const v = Math.round((x / (w - 1)) * 255);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, 0, 1, h);
    }
  }

  // -- Color: Color Checker --
  function renderColorChecker(ctx, canvas) {
    const patches = [
      '#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa',
      '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e',
      '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1',
      '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a7a', '#555555', '#343434',
    ];
    const cols = 6, rows = 4;
    const w = canvas.width, h = canvas.height;
    const pw = Math.floor(w / cols);
    const ph = Math.floor(h / rows);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < patches.length; ++i) {
      const col = i % cols, row = Math.floor(i / cols);
      ctx.fillStyle = patches[i];
      ctx.fillRect(col * pw + 2, row * ph + 2, pw - 4, ph - 4);
    }
  }

  // -- Color: Gamma Test --
  function renderGammaTest(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const levels = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0];
    const bandH = Math.floor(h / levels.length);
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < levels.length; ++i) {
      const y = i * bandH;
      const gamma = levels[i];
      const halfW = Math.floor(w / 2);

      // Left: alternating 1px stripes (black & white)
      for (let x = 0; x < halfW; ++x) {
        ctx.fillStyle = (x % 2 === 0) ? '#000' : '#fff';
        ctx.fillRect(x, y, 1, bandH);
      }

      // Right: solid gray that should match perceived brightness
      const gray = Math.round(Math.pow(0.5, 1 / gamma) * 255);
      ctx.fillStyle = 'rgb(' + gray + ',' + gray + ',' + gray + ')';
      ctx.fillRect(halfW, y, w - halfW, bandH);

      // Label
      ctx.fillStyle = '#ff0';
      ctx.font = Math.round(10 * d) + 'px monospace';
      ctx.fillText('\u03b3=' + gamma.toFixed(2), halfW + 8 * d, y + bandH - 4 * d);
    }
  }

  // -- Color: Color Bleed --
  function renderColorBleed(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff'];
    const boxW = Math.floor(w * 0.15);
    const boxH = Math.floor(h * 0.4);
    const gap = Math.floor((w - colors.length * boxW) / (colors.length + 1));
    const yOff = Math.floor((h - boxH) / 2);

    for (let i = 0; i < colors.length; ++i) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(gap + i * (boxW + gap), yOff, boxW, boxH);
    }
  }

  // -- Uniformity: 5-Point --
  function renderFivePoint(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    const d = dpr();
    const r = Math.round(12 * d);
    const points = [
      { x: w / 2, y: h / 2, label: 'CENTER' },
      { x: r + 8 * d, y: r + 8 * d, label: 'TL' },
      { x: w - r - 8 * d, y: r + 8 * d, label: 'TR' },
      { x: r + 8 * d, y: h - r - 8 * d, label: 'BL' },
      { x: w - r - 8 * d, y: h - r - 8 * d, label: 'BR' },
    ];

    ctx.strokeStyle = '#f00';
    ctx.lineWidth = Math.max(1, d);
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.fillStyle = '#f00';
    ctx.textAlign = 'center';

    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - r * 1.5, p.y);
      ctx.lineTo(p.x + r * 1.5, p.y);
      ctx.moveTo(p.x, p.y - r * 1.5);
      ctx.lineTo(p.x, p.y + r * 1.5);
      ctx.stroke();
      ctx.fillText(p.label, p.x, p.y + r + 14 * d);
    }
  }

  // -- FPS: Frame Counter --
  function renderFpsCounter(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    if (!state.fpsHistory) {
      state.fpsHistory = [];
      state.fpsMin = Infinity;
      state.fpsMax = 0;
    }

    if (dt > 0 && dt < 1) {
      const fps = 1 / dt;
      state.fpsHistory.push(fps);
      if (state.fpsHistory.length > 300) state.fpsHistory.shift();
      if (fps < state.fpsMin) state.fpsMin = fps;
      if (fps > state.fpsMax) state.fpsMax = fps;
    }

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Graph
    const graphH = h * 0.5;
    const graphY = h * 0.35;
    const hist = state.fpsHistory;
    if (hist.length > 1) {
      const maxFps = Math.max(120, state.fpsMax * 1.1);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = Math.max(1, d);
      ctx.beginPath();
      for (let i = 0; i < hist.length; ++i) {
        const x = (i / (hist.length - 1)) * w;
        const y = graphY + graphH - (hist[i] / maxFps) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Reference lines
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.lineWidth = Math.max(1, d * 0.5);
      for (const ref of [30, 60, 120, 144, 240]) {
        if (ref > maxFps) continue;
        const y = graphY + graphH - (ref / maxFps) * graphH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.font = Math.round(9 * d) + 'px monospace';
        ctx.fillText(ref + '', 4 * d, y - 2 * d);
      }
    }

    // Stats text
    const avg = hist.length ? (hist.reduce((a, b) => a + b, 0) / hist.length) : 0;
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold ' + Math.round(36 * d) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(avg) + ' FPS', w / 2, h * 0.18);

    ctx.font = Math.round(14 * d) + 'px monospace';
    ctx.fillStyle = '#aaa';
    const minVal = state.fpsMin === Infinity ? 0 : state.fpsMin;
    ctx.fillText(
      'Min: ' + Math.round(minVal) + '  Avg: ' + Math.round(avg) + '  Max: ' + Math.round(state.fpsMax) + '  Frames: ' + state.frame,
      w / 2, h * 0.92
    );
    ctx.textAlign = 'start';
  }

  // -- FPS: UFO Test --
  const UFO_FPS_LANES = [24, 25, 30, 50, 60, 75, 100, 120, 144, 165, 240];

  function renderUfoTest(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const speed = state.speed * d;
    const lanes = UFO_FPS_LANES;
    const laneCount = lanes.length;
    const padding = Math.round(4 * d);
    const laneH = Math.floor((h - padding) / laneCount);
    const boxW = Math.round(48 * d);
    const boxH = Math.max(Math.round(laneH * 0.55), Math.round(8 * d));
    const labelW = Math.round(52 * d);
    const trackW = w - labelW;

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);

    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'right';

    for (let i = 0; i < laneCount; ++i) {
      const targetFps = lanes[i];
      const y = i * laneH + padding;
      const boxY = y + Math.round((laneH - boxH) / 2);

      // Lane separator
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelW, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#888';
      ctx.fillText(targetFps + ' fps', labelW - 6 * d, boxY + boxH / 2 + 3 * d);

      // Snap time to target FPS intervals to simulate that update rate
      const snappedTime = Math.floor(state.time * targetFps) / targetFps;
      const x = labelW + ((snappedTime * speed) % (trackW + boxW)) - boxW;

      // Color: highlight common display rates
      const isCommon = targetFps === 60 || targetFps === 120 || targetFps === 144;
      ctx.fillStyle = isCommon ? '#0af' : '#fff';
      ctx.fillRect(x, boxY, boxW, boxH);
    }

    // Bottom hint
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('The smoothest lane matches your display refresh rate. Judder at lower rates reveals motion interpolation.', w / 2, h - 3 * d);
  }

  // -- FPS: Vsync Tear Test --
  function renderVsyncTear(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const barW = Math.round(4 * d);

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    const x = ((state.time * 1200 * d) % (w + barW)) - barW;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, 0, barW, h);
  }

  // -- Motion: Moving Crosshair --
  function renderMovingCrosshair(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const cx = w / 2 + Math.cos(state.time * 1.5) * w * 0.35;
    const cy = h / 2 + Math.sin(state.time * 2.1) * h * 0.35;
    const armLen = Math.round(40 * d);
    const lineW = Math.max(1, Math.round(2 * d));

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(cx - armLen, cy);
    ctx.lineTo(cx + armLen, cy);
    ctx.moveTo(cx, cy - armLen);
    ctx.lineTo(cx, cy + armLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.round(20 * d), 0, Math.PI * 2);
    ctx.stroke();
  }

  // -- Motion: Black-to-White Flash --
  function renderBwFlash(ctx, canvas, dt, state) {
    ctx.fillStyle = (state.frame % 2 === 0) ? '#000' : '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // -- Motion: Pursuit Camera Test --
  function renderPursuitCamera(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const colW = Math.max(1, Math.round(16 * d));
    const speed = 120 * d;
    const offset = (state.time * speed) % (colW * 2);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (let x = -colW * 2 + offset; x < w; x += colW * 2)
      ctx.fillRect(x, 0, colW, h);
  }

  // -- HDR: Contrast Ratio --
  function renderContrastRatio(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(w / 2, 0, w / 2, h);

    const d = dpr();
    ctx.fillStyle = '#888';
    ctx.font = Math.round(14 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLACK (0, 0, 0)', w / 4, h / 2);
    ctx.fillText('WHITE (255, 255, 255)', w * 3 / 4, h / 2);
  }

  // -- HDR: Shadow Detail --
  function renderShadowDetail(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const d = dpr();
    const levels = [1, 2, 3, 4, 5, 7, 10, 15, 20];
    const cols = 3, rows = 3;
    const pw = Math.floor(w * 0.8 / cols);
    const ph = Math.floor(h * 0.8 / rows);
    const offX = Math.floor((w - cols * pw) / 2);
    const offY = Math.floor((h - rows * ph) / 2);

    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < levels.length; ++i) {
      const col = i % cols, row = Math.floor(i / cols);
      const v = Math.round(levels[i] * 2.55);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(offX + col * pw + 4, offY + row * ph + 4, pw - 8, ph - 8);

      ctx.fillStyle = '#666';
      ctx.fillText(levels[i] + '%', offX + col * pw + pw / 2, offY + row * ph + ph - 8 * d);
    }
  }

  // -- Geometry: 1px Grid --
  function renderPixelGrid(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const spacing = state.gridSpacing * dpr();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
  }

  // -- Geometry: Checkerboard --
  function renderCheckerboard(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const sz = state.checkerSize * dpr();
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const cx = Math.floor(x / sz);
        const cy = Math.floor(y / sz);
        const v = ((cx + cy) & 1) ? 255 : 0;
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    ctx.putImageData(imgData, 0, 0);
  }

  // -- Geometry: Circle / Line Test --
  function renderCircleLine(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(cx, cy) * 0.9;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, d);

    // Concentric circles
    for (let r = maxR; r > 10 * d; r -= 20 * d) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Radial lines
    for (let a = 0; a < 360; a += 10) {
      const rad = a * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR);
      ctx.stroke();
    }
  }

  // -- Geometry: Text Sharpness --
  function renderTextSharpness(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
    const sample = 'The quick brown fox jumps over the lazy dog 0123456789';

    ctx.fillStyle = '#000';
    let y = 16 * d;
    for (const sz of sizes) {
      const px = Math.round(sz * d);
      ctx.font = px + 'px sans-serif';
      ctx.fillText(sz + 'px: ' + sample, 8 * d, y + px);
      y += px + 6 * d;
      if (y > h) break;
    }
  }

  // -- Geometry: Aspect Ratio --
  function renderAspectRatio(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, w, h);

    // Circle (should be perfectly round)
    const r = Math.min(w, h) * 0.3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, 2 * d);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();

    // 16:9 rectangle
    const rw = Math.min(w * 0.8, h * 0.8 * 16 / 9);
    const rh = rw * 9 / 16;
    ctx.strokeStyle = '#0af';
    ctx.strokeRect((w - rw) / 2, (h - rh) / 2, rw, rh);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(12 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Circle (should be round)', w / 2, h / 2 + r + 20 * d);
    ctx.fillStyle = '#0af';
    ctx.fillText('16:9 Rectangle', w / 2, (h - rh) / 2 - 8 * d);
  }

  // -- Geometry: Subpixel Layout --
  function renderSubpixelLayout(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const sectionH = Math.floor(h / 4);

    // Section 1: Single-pixel colored vertical lines
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.fillText('Single-pixel vertical lines (R, G, B, W)', 8 * d, 14 * d);
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff'];
    const lineY = Math.round(20 * d);
    const lineH = sectionH - lineY - Math.round(4 * d);
    for (let x = 0; x < w; ++x) {
      ctx.fillStyle = colors[x % 4];
      ctx.fillRect(x, lineY, 1, lineH);
    }

    // Section 2: Alternating R-G-B single-pixel columns
    const s2y = sectionH;
    ctx.fillStyle = '#fff';
    ctx.fillText('Alternating R-G-B columns (should look white/gray if subpixels align)', 8 * d, s2y + 14 * d);
    const s2lineY = s2y + Math.round(20 * d);
    const s2lineH = sectionH - Math.round(24 * d);
    for (let x = 0; x < w; ++x) {
      const c = x % 3;
      ctx.fillStyle = c === 0 ? '#ff0000' : c === 1 ? '#00ff00' : '#0000ff';
      ctx.fillRect(x, s2lineY, 1, s2lineH);
    }

    // Section 3: 1px alternating B&W vertical lines
    const s3y = sectionH * 2;
    ctx.fillStyle = '#fff';
    ctx.fillText('1px alternating black/white lines', 8 * d, s3y + 14 * d);
    const s3lineY = s3y + Math.round(20 * d);
    const s3lineH = sectionH - Math.round(24 * d);
    for (let x = 0; x < w; ++x) {
      ctx.fillStyle = (x & 1) ? '#fff' : '#000';
      ctx.fillRect(x, s3lineY, 1, s3lineH);
    }

    // Section 4: Horizontal colored lines
    const s4y = sectionH * 3;
    ctx.fillStyle = '#fff';
    ctx.fillText('1px horizontal lines (R, G, B, W)', 8 * d, s4y + 14 * d);
    const s4lineY = s4y + Math.round(20 * d);
    for (let y = s4lineY; y < h - Math.round(4 * d); ++y) {
      ctx.fillStyle = colors[y % 4];
      ctx.fillRect(0, y, w, 1);
    }
  }

  // -- Geometry: Moiré Pattern --
  function renderMoirePattern(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const spacing = state.moireSpacing * d;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);

    // Quadrant 1 (top-left): vertical lines at non-integer spacing
    for (let x = 0; x < halfW; x += spacing) {
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(x), 0, 1, halfH);
    }

    // Quadrant 2 (top-right): horizontal lines at non-integer spacing
    for (let y = 0; y < halfH; y += spacing) {
      ctx.fillStyle = '#000';
      ctx.fillRect(halfW, Math.round(y), halfW, 1);
    }

    // Quadrant 3 (bottom-left): diagonal lines
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let i = -halfH; i < halfW + halfH; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, halfH);
      ctx.lineTo(i + halfH, h);
      ctx.stroke();
    }

    // Quadrant 4 (bottom-right): concentric circles
    const cx = halfW + halfW / 2, cy = halfH + halfH / 2;
    const maxR = Math.min(halfW, halfH) * 0.9;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    for (let r = spacing; r < maxR; r += spacing) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#ff0';
    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Vertical ' + state.moireSpacing.toFixed(1) + 'px', halfW / 2, halfH - 4 * d);
    ctx.fillText('Horizontal', halfW + halfW / 2, halfH - 4 * d);
    ctx.fillText('Diagonal', halfW / 2, h - 4 * d);
    ctx.fillText('Concentric', halfW + halfW / 2, h - 4 * d);

    // Divider lines
    ctx.strokeStyle = '#666';
    ctx.lineWidth = Math.max(1, d);
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, h);
    ctx.moveTo(0, halfH);
    ctx.lineTo(w, halfH);
    ctx.stroke();
  }

  // ===== Additional Color Tests =====

  // -- Color: Color Banding --
  function renderColorBanding(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    const bands = [
      { label: 'Dark (0-30)', from: [0, 0, 0], to: [30, 30, 30] },
      { label: 'Low-mid (30-60)', from: [30, 30, 30], to: [60, 60, 60] },
      { label: 'Mid (100-130)', from: [100, 100, 100], to: [130, 130, 130] },
      { label: 'Light (225-255)', from: [225, 225, 225], to: [255, 255, 255] },
      { label: 'Blue sky (30-80)', from: [40, 60, 100], to: [70, 110, 160] },
      { label: 'Skin tone (160-200)', from: [180, 140, 120], to: [220, 180, 160] },
    ];

    const bandH = Math.floor(h / bands.length);

    for (let b = 0; b < bands.length; ++b) {
      const y = b * bandH;
      const bh = b === bands.length - 1 ? h - y : bandH;
      const { from, to, label } = bands[b];

      for (let x = 0; x < w; ++x) {
        const t = x / (w - 1);
        const r = Math.round(from[0] + (to[0] - from[0]) * t);
        const g = Math.round(from[1] + (to[1] - from[1]) * t);
        const bl = Math.round(from[2] + (to[2] - from[2]) * t);
        ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
        ctx.fillRect(x, y, 1, bh);
      }

      // Label
      ctx.fillStyle = b < 2 ? '#666' : b >= 3 ? '#333' : '#ddd';
      ctx.font = Math.round(10 * d) + 'px monospace';
      ctx.textAlign = 'start';
      ctx.fillText(label, 8 * d, y + 14 * d);
    }
  }

  // -- Color: Dithering Detection --
  function renderDitheringDetect(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const pairs = [
      [63, 64], [64, 65],
      [127, 128], [128, 129],
      [191, 192], [192, 193],
      [31, 32], [95, 96],
      [159, 160], [223, 224],
    ];

    const cols = 5, rows = 2;
    const padX = Math.floor(w * 0.04);
    const padY = Math.floor(h * 0.08);
    const patchW = Math.floor((w - padX * (cols + 1)) / cols);
    const patchH = Math.floor((h - padY * (rows + 1) - 30 * d) / rows);

    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < pairs.length; ++i) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padX + col * (patchW + padX);
      const y = padY + row * (patchH + padY);
      const halfW = Math.floor(patchW / 2);
      const [vA, vB] = pairs[i];

      ctx.fillStyle = 'rgb(' + vA + ',' + vA + ',' + vA + ')';
      ctx.fillRect(x, y, halfW, patchH);
      ctx.fillStyle = 'rgb(' + vB + ',' + vB + ',' + vB + ')';
      ctx.fillRect(x + halfW, y, patchW - halfW, patchH);

      ctx.fillStyle = '#888';
      ctx.fillText(vA + ' | ' + vB, x + patchW / 2, y + patchH + 12 * d);
    }

    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('On 6-bit+FRC panels, some patches shimmer due to temporal dithering. True 8-bit panels show solid fills.', w / 2, h - 6 * d);
  }

  // ===== Additional Uniformity Tests =====

  // -- Uniformity: Uniformity Sweep --
  function renderUniformitySweep(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const v = state.sweepLevel;

    ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = v < 128 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)';
    ctx.font = Math.round(12 * d) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Level: ' + v + ' (' + Math.round(v / 2.55) + '%)', w / 2, h / 2);
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.fillText('Sweep slider to find banding, dirty screen effect, or backlight bleed at specific levels', w / 2, h / 2 + 18 * d);
  }

  // -- Uniformity: Viewing Angle --
  function renderViewingAngle(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Center crosshair
    ctx.strokeStyle = 'rgba(0,0,0,.15)';
    ctx.lineWidth = Math.max(1, d);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Corner labels
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RGB(128, 128, 128)', w / 2, h / 2 - 10 * d);
    ctx.fillText('View from 45\u00b0 angles. Check for color shift, brightness loss, or contrast changes.', w / 2, h / 2 + 16 * d);
    ctx.fillText('IPS: minimal shift \u2022 VA: contrast loss at angles \u2022 TN: strong color shift', w / 2, h / 2 + 32 * d);
  }

  // -- Uniformity: Burn-in / Retention --
  function renderBurnInCheck(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    if (state.showBurnPattern) {
      // High-contrast static pattern
      const sz = Math.round(32 * d);
      for (let y = 0; y < h; y += sz)
        for (let x = 0; x < w; x += sz) {
          ctx.fillStyle = ((Math.floor(x / sz) + Math.floor(y / sz)) & 1) ? '#fff' : '#000';
          ctx.fillRect(x, y, sz, sz);
        }

      // Colored bars
      const barH = Math.round(40 * d);
      const barY = Math.floor((h - barH) / 2);
      const barColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      const barW = Math.floor(w / barColors.length);
      for (let i = 0; i < barColors.length; ++i) {
        ctx.fillStyle = barColors[i];
        ctx.fillRect(i * barW, barY, barW, barH);
      }

      // Static text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(24 * d) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BURN-IN TEST PATTERN', w / 2, barY - 12 * d);

      ctx.fillStyle = 'rgba(255,255,0,.7)';
      ctx.font = Math.round(11 * d) + 'px sans-serif';
      ctx.fillText('Leave this pattern visible, then uncheck "Show Pattern" to test for retention on gray', w / 2, h - 8 * d);
    } else {
      // Neutral gray for checking retention
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.font = Math.round(12 * d) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Check for ghost images from the previous pattern. Any visible traces indicate image retention.', w / 2, h / 2);
    }
  }

  // ===== Additional Motion Tests =====

  // -- Motion: Input Lag Flasher --
  function renderInputLag(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    if (state.doFlash) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      state.doFlash = false;
      ++state.flashCount;
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = Math.round(14 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click anywhere to flash white', w / 2, h / 2 - 10 * d);
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.fillText('Film with phone slow-mo camera to count frames between press and flash', w / 2, h / 2 + 14 * d);
    ctx.fillText('Flashes: ' + (state.flashCount || 0) + '  |  Frame: ' + state.frame, w / 2, h / 2 + 36 * d);
  }

  // -- Motion: Gray-to-Gray --
  const G2G_LEVELS = [0, 64, 128, 192, 255];

  function renderGrayToGray(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const levels = G2G_LEVELS;
    const n = levels.length;
    const interval = state.g2gInterval;
    const phase = Math.floor(state.frame / interval) & 1;

    const padX = Math.round(50 * d);
    const padY = Math.round(40 * d);
    const cellW = Math.floor((w - padX * 2) / n);
    const cellH = Math.floor((h - padY * 2) / n);

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);

    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';

    // Column headers ("to" values)
    ctx.fillStyle = '#aaa';
    for (let c = 0; c < n; ++c)
      ctx.fillText(levels[c], padX + c * cellW + cellW / 2, padY - 6 * d);
    ctx.fillText('\u2192 To', padX + n * cellW / 2, padY - 20 * d);

    // Row headers ("from" values)
    ctx.textAlign = 'right';
    for (let r = 0; r < n; ++r)
      ctx.fillText(levels[r], padX - 8 * d, padY + r * cellH + cellH / 2 + 3 * d);
    ctx.save();
    ctx.translate(padX - 30 * d, padY + n * cellH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('From \u2193', 0, 0);
    ctx.restore();

    // Patches
    for (let r = 0; r < n; ++r)
      for (let c = 0; c < n; ++c) {
        const fromV = levels[r];
        const toV = levels[c];
        const v = phase === 0 ? fromV : toV;
        const x = padX + c * cellW;
        const y = padY + r * cellH;
        ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);
      }

    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Each patch alternates between its row and column gray values. Ghosting or overshoot indicates slow G2G response.', w / 2, h - 6 * d);
  }

  // -- Motion: Scrolling Text --
  const SCROLL_TEXT = [
    'The quick brown fox jumps over the lazy dog. 0123456789',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz',
    'Pack my box with five dozen liquor jugs. !@#$%^&*()',
    'How vexingly quick daft zebras jump. 1234567890',
    'The five boxing wizards jump quickly at dawn.',
    'Sphinx of black quartz, judge my vow carefully.',
    'Two driven jocks help fax my big quiz politely.',
    'Crazy Frederick bought many very exquisite opal jewels.',
    'We promptly judged antique ivory buckles for the next prize.',
    'A mad boxer shot a quick, gloved jab to the jaw of his dizzy opponent.',
    'Jackdaws love my big sphinx of quartz under the moonlight.',
    'The jay, pig, fox, zebra and my wolves quack beautifully together.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
  ];

  function renderScrollingText(ctx, canvas, dt, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const speed = state.scrollSpeed * d;
    const lineH = Math.round(20 * d);
    const totalH = SCROLL_TEXT.length * lineH;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = Math.round(13 * d) + 'px sans-serif';
    ctx.textAlign = 'start';

    const offset = (state.time * speed) % totalH;
    for (let i = 0; i < SCROLL_TEXT.length; ++i) {
      let y = i * lineH - offset + h;
      if (y > h) y -= totalH;
      if (y < -lineH) y += totalH;
      ctx.fillText(SCROLL_TEXT[i], Math.round(16 * d), y);
    }

    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Can you read the text while scrolling? Blur indicates slow pixel response.', w / 2, h - 4 * d);
  }

  // ===== Additional Calibration Tests =====

  // -- Calibration: Screen Ruler --
  function renderScreenRuler(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const ppi = state.rulerDpi;
    const pxPerMm = ppi / 25.4;
    const pxPerIn = ppi;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    // Horizontal ruler (inches, top)
    const rulerH = Math.round(60 * d);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = Math.max(1, d);
    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';

    for (let px = 0; px < w; px += pxPerIn / 16) {
      const inches16 = Math.round(px / (pxPerIn / 16));
      const isInch = inches16 % 16 === 0;
      const isHalf = inches16 % 8 === 0;
      const isQuarter = inches16 % 4 === 0;
      const tickH = isInch ? rulerH * 0.7 : isHalf ? rulerH * 0.5 : isQuarter ? rulerH * 0.35 : rulerH * 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, 0);
      ctx.lineTo(Math.round(px) + 0.5, tickH);
      ctx.stroke();
      if (isInch && inches16 > 0)
        ctx.fillText((inches16 / 16) + '"', Math.round(px), tickH + 12 * d);
    }

    // Horizontal ruler (cm, below)
    const cmY = rulerH + Math.round(10 * d);
    ctx.fillStyle = '#0066cc';
    ctx.strokeStyle = '#0066cc';
    for (let px = 0; px < w; px += pxPerMm) {
      const mm = Math.round(px / pxPerMm);
      const isCm = mm % 10 === 0;
      const is5mm = mm % 5 === 0;
      const tickH = isCm ? rulerH * 0.6 : is5mm ? rulerH * 0.4 : rulerH * 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, cmY);
      ctx.lineTo(Math.round(px) + 0.5, cmY + tickH);
      ctx.stroke();
      if (isCm && mm > 0)
        ctx.fillText((mm / 10) + 'cm', Math.round(px), cmY + tickH + 12 * d);
    }

    // Vertical ruler (left side, inches)
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'start';
    for (let px = 0; px < h; px += pxPerIn / 16) {
      const inches16 = Math.round(px / (pxPerIn / 16));
      const isInch = inches16 % 16 === 0;
      const isHalf = inches16 % 8 === 0;
      const isQuarter = inches16 % 4 === 0;
      const tickW = isInch ? rulerH * 0.6 : isHalf ? rulerH * 0.4 : isQuarter ? rulerH * 0.3 : rulerH * 0.15;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(px) + 0.5);
      ctx.lineTo(tickW, Math.round(px) + 0.5);
      ctx.stroke();
      if (isInch && inches16 > 0)
        ctx.fillText((inches16 / 16) + '"', tickW + 4 * d, Math.round(px) + 4 * d);
    }

    // Credit card reference (85.6mm × 53.98mm)
    const ccW = 85.6 * pxPerMm;
    const ccH = 53.98 * pxPerMm;
    const ccX = Math.round((w - ccW) / 2);
    const ccY = Math.round(h * 0.5);
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = Math.max(2, 2 * d);
    ctx.setLineDash([6 * d, 4 * d]);
    ctx.strokeRect(ccX, ccY, ccW, ccH);
    ctx.setLineDash([]);
    ctx.fillStyle = '#cc0000';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Credit card (85.6 \u00d7 54.0 mm) -- adjust DPI until this matches a real card', ccX + ccW / 2, ccY - 6 * d);

    // Info
    ctx.fillStyle = '#666';
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.fillText('DPI: ' + ppi + ' | DPR: ' + dpr().toFixed(2) + ' | Screen: ' + screen.width + '\u00d7' + screen.height, w / 2, h - 8 * d);
  }

  // -- Calibration: Pixel Clock / Phase --
  function renderPixelClock(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const sectionH = Math.floor(h / 4);

    // Section 1: 1px alternating B&W vertical stripes
    const s1data = ctx.createImageData(w, sectionH);
    for (let y = 0; y < sectionH; ++y)
      for (let x = 0; x < w; ++x) {
        const v = (x & 1) ? 255 : 0;
        const i = (y * w + x) * 4;
        s1data.data[i] = s1data.data[i + 1] = s1data.data[i + 2] = v;
        s1data.data[i + 3] = 255;
      }
    ctx.putImageData(s1data, 0, 0);

    // Section 2: 2px alternating stripes
    const s2y = sectionH;
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, s2y, 2, sectionH);
    }

    // Section 3: 1px alternating B&W horizontal stripes
    const s3y = sectionH * 2;
    const s3data = ctx.createImageData(w, sectionH);
    for (let y = 0; y < sectionH; ++y) {
      const v = (y & 1) ? 255 : 0;
      for (let x = 0; x < w; ++x) {
        const i = (y * w + x) * 4;
        s3data.data[i] = s3data.data[i + 1] = s3data.data[i + 2] = v;
        s3data.data[i + 3] = 255;
      }
    }
    ctx.putImageData(s3data, 0, s3y);

    // Section 4: mixed fine patterns
    const s4y = sectionH * 3;
    const s4h = h - s4y;
    for (let y = 0; y < s4h; ++y)
      for (let x = 0; x < w; ++x) {
        const zone = Math.floor(x / (w / 3));
        let on;
        if (zone === 0) on = ((x + y) & 1) === 0;
        else if (zone === 1) on = (x % 3 === 0) || (y % 3 === 0);
        else on = ((x & 1) ^ (y & 1)) === 0;
        if (on) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, s4y + y, 1, 1);
        }
      }

    // Labels
    ctx.fillStyle = '#ff0';
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.textAlign = 'start';
    ctx.fillText('1px vertical stripes', 4 * d, 14 * d);
    ctx.fillText('2px vertical stripes', 4 * d, s2y + 14 * d);
    ctx.fillText('1px horizontal stripes', 4 * d, s3y + 14 * d);
    ctx.fillText('Fine patterns (checkerboard / grid / XOR)', 4 * d, s4y + 14 * d);
    ctx.fillStyle = 'rgba(255,255,0,.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Adjust monitor clock/phase until patterns are crisp with no shimmer or color fringing (analog VGA)', w / 2, h - 4 * d);
  }

  // ===== Calibration Tools =====

  // -- Helper: Kelvin to RGB (Tanner Helland approximation) --
  function kelvinToRgb(K) {
    const temp = K / 100;
    let r, g, b;
    if (temp <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(temp) - 161.1195681661;
      b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
      b = 255;
    }
    return [
      Math.max(0, Math.min(255, Math.round(r))),
      Math.max(0, Math.min(255, Math.round(g))),
      Math.max(0, Math.min(255, Math.round(b))),
    ];
  }

  // -- Calibration: Gamma Calibration --
  function renderGammaCalib(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const gamma = state.gamma;
    const bands = 8;
    const bandH = Math.floor(h / bands);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < bands; ++i) {
      const y = i * bandH;
      const bh = i === bands - 1 ? h - y : bandH;
      const bandGamma = 1.0 + i * (gamma - 1.0) / (bands - 1);
      const halfW = Math.floor(w / 2);

      // Left: alternating 1px B&W stripes
      const imgData = ctx.createImageData(halfW, bh);
      const data = imgData.data;
      for (let row = 0; row < bh; ++row)
        for (let x = 0; x < halfW; ++x) {
          const v = (x & 1) ? 255 : 0;
          const idx = (row * halfW + x) * 4;
          data[idx] = data[idx + 1] = data[idx + 2] = v;
          data[idx + 3] = 255;
        }
      ctx.putImageData(imgData, 0, y);

      // Right: solid gray matching perceived brightness at bandGamma
      const gray = Math.round(Math.pow(0.5, 1 / bandGamma) * 255);
      ctx.fillStyle = 'rgb(' + gray + ',' + gray + ',' + gray + ')';
      ctx.fillRect(halfW, y, w - halfW, bh);

      // Label
      ctx.fillStyle = '#ff0';
      ctx.font = Math.round(10 * d) + 'px monospace';
      ctx.textAlign = 'start';
      ctx.fillText('\u03b3=' + bandGamma.toFixed(2) + ' gray=' + gray, halfW + 8 * d, y + bh - 4 * d);
    }

    // Instruction
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Adjust gamma slider until stripes and solid patches match in brightness', w / 2, h - 2 * d);
  }

  // -- Calibration: RGB Balance --
  function renderRgbBalance(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const rG = state.rGain / 100, gG = state.gGain / 100, bG = state.bGain / 100;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const rampH = Math.floor(h * 0.35);
    const refH = Math.floor(h * 0.1);
    const stripH = Math.floor(h * 0.15);

    // Top: gray ramp with gains applied
    for (let x = 0; x < w; ++x) {
      const v = (x / (w - 1)) * 255;
      const r = Math.max(0, Math.min(255, Math.round(v * rG)));
      const g = Math.max(0, Math.min(255, Math.round(v * gG)));
      const b = Math.max(0, Math.min(255, Math.round(v * bG)));
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(x, 0, 1, rampH);
    }

    // Middle: neutral 50% gray reference band
    const refY = rampH;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, refY, w, refH);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('50% Gray Reference', w / 2, refY + refH / 2 + 4 * d);

    // Bottom: separate R, G, B channel strips
    const chY = refY + refH + Math.round(4 * d);
    for (let x = 0; x < w; ++x) {
      const v = Math.round((x / (w - 1)) * 255);
      ctx.fillStyle = 'rgb(' + v + ',0,0)';
      ctx.fillRect(x, chY, 1, stripH);
      ctx.fillStyle = 'rgb(0,' + v + ',0)';
      ctx.fillRect(x, chY + stripH, 1, stripH);
      ctx.fillStyle = 'rgb(0,0,' + v + ')';
      ctx.fillRect(x, chY + stripH * 2, 1, stripH);
    }

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.textAlign = 'start';
    ctx.fillText('R:' + state.rGain + '% G:' + state.gGain + '% B:' + state.bGain + '%', 4 * d, rampH - 4 * d);
  }

  // -- Calibration: Sharpness Pattern --
  function renderSharpnessPattern(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(cx, cy) * 0.4;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Siemens star (center)
    const sectors = 36;
    for (let i = 0; i < sectors; ++i) {
      const a0 = (i / sectors) * Math.PI * 2;
      const a1 = ((i + 1) / sectors) * Math.PI * 2;
      ctx.fillStyle = (i & 1) ? '#fff' : '#000';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // Zone plate (concentric rings with increasing frequency)
    const zpR = Math.min(w, h) * 0.18;
    const zpCx = w * 0.5, zpCy = h * 0.82;
    const zpData = ctx.createImageData(Math.ceil(zpR * 2), Math.ceil(zpR * 2));
    for (let py = 0; py < zpData.height; ++py)
      for (let px = 0; px < zpData.width; ++px) {
        const dx = px - zpR, dy = py - zpR;
        const r2 = dx * dx + dy * dy;
        if (r2 > zpR * zpR) continue;
        const v = Math.round((Math.cos(r2 * 0.0005 * d) * 0.5 + 0.5) * 255);
        const idx = (py * zpData.width + px) * 4;
        zpData.data[idx] = zpData.data[idx + 1] = zpData.data[idx + 2] = v;
        zpData.data[idx + 3] = 255;
      }
    ctx.putImageData(zpData, Math.round(zpCx - zpR), Math.round(zpCy - zpR));

    // Fine line pairs in corners
    const cornerSize = Math.round(Math.min(w, h) * 0.15);
    const corners = [
      { x: 0, y: 0 },
      { x: w - cornerSize, y: 0 },
      { x: 0, y: h - cornerSize },
      { x: w - cornerSize, y: h - cornerSize },
    ];
    for (const c of corners) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(c.x, c.y, cornerSize, cornerSize);
      ctx.fillStyle = '#000';
      const gaps = [1, 2, 3, 4];
      let yOff = Math.round(4 * d);
      for (const gap of gaps) {
        for (let i = 0; i < 6; ++i) {
          // Horizontal
          ctx.fillRect(c.x + Math.round(4 * d), c.y + yOff, cornerSize - Math.round(8 * d), Math.max(1, gap));
          yOff += gap * 2;
        }
        yOff += Math.round(2 * d);
      }
    }

    // Label
    ctx.fillStyle = '#ff0';
    ctx.font = Math.round(10 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Siemens Star', cx, cy + maxR + 14 * d);
    ctx.fillText('Zone Plate', zpCx, zpCy + zpR + 14 * d);
  }

  // -- Calibration: Contrast Calibration --
  function renderContrastCalib(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const halfW = Math.floor(w / 2);
    const rows = 5, cols = 2;
    const patchW = Math.floor(halfW * 0.35);
    const patchH = Math.floor(h * 0.08);
    const gap = Math.floor(h * 0.015);

    // Left: black with near-black patches (1%-10%)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, halfW, h);
    const startY = Math.floor((h - (rows * (patchH + gap))) / 2);
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 10; ++i) {
      const pct = i + 1;
      const v = Math.round(pct * 2.55);
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = Math.floor(halfW * 0.1) + col * (patchW + Math.floor(halfW * 0.1));
      const y = startY + row * (patchH + gap);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, y, patchW, patchH);
      ctx.fillStyle = '#666';
      ctx.fillText(pct + '%', x + patchW / 2, y + patchH + 12 * d);
    }

    // Right: white with near-white patches (90%-100%)
    ctx.fillStyle = '#fff';
    ctx.fillRect(halfW, 0, w - halfW, h);
    for (let i = 0; i < 10; ++i) {
      const pct = 91 + i;
      const v = Math.round(pct * 2.55);
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = halfW + Math.floor(halfW * 0.1) + col * (patchW + Math.floor(halfW * 0.1));
      const y = startY + row * (patchH + gap);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, y, patchW, patchH);
      ctx.fillStyle = '#888';
      ctx.fillText(pct + '%', x + patchW / 2, y + patchH + 12 * d);
    }

    // Instructions
    ctx.fillStyle = '#ff0';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Adjust contrast until all patches are distinguishable', w / 2, h - 8 * d);
  }

  // -- Calibration: Brightness Calibration --
  function renderBrightnessCalib(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const cols = 5, rows = 4;
    const patchW = Math.floor(w * 0.14);
    const patchH = Math.floor(h * 0.16);
    const totalW = cols * patchW + (cols - 1) * Math.floor(patchW * 0.2);
    const totalH = rows * patchH + (rows - 1) * Math.floor(patchH * 0.2);
    const offX = Math.floor((w - totalW) / 2);
    const offY = Math.floor((h - totalH) / 2);
    const gapX = Math.floor(patchW * 0.2);
    const gapY = Math.floor(patchH * 0.2);

    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < 20; ++i) {
      const pct = i * 0.25;
      const v = Math.round(pct * 2.55);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = offX + col * (patchW + gapX);
      const y = offY + row * (patchH + gapY);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(x, y, patchW, patchH);
      ctx.fillStyle = '#555';
      ctx.fillText(pct.toFixed(2) + '%', x + patchW / 2, y + patchH + 11 * d);
    }

    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Adjust brightness until you can barely see the darkest visible patch', w / 2, h - 6 * d);
  }

  // -- Calibration: Keystone Grid --
  function renderKeystoneGrid(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const cellsX = 10, cellsY = 8;
    const cellW = w / cellsX, cellH = h / cellsY;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, d);
    for (let i = 0; i <= cellsX; ++i) {
      const x = Math.round(i * cellW) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let j = 0; j <= cellsY; ++j) {
      const y = Math.round(j * cellH) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Corner circles
    const cr = Math.min(cellW, cellH) * 0.3;
    const corners = [[0, 0], [w, 0], [0, h], [w, h]];
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = Math.max(1, d * 1.5);
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center crosshair
    const chLen = Math.min(cellW, cellH) * 0.8;
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = Math.max(1, d * 1.5);
    ctx.beginPath();
    ctx.moveTo(cx - chLen, cy);
    ctx.lineTo(cx + chLen, cy);
    ctx.moveTo(cx, cy - chLen);
    ctx.lineTo(cx, cy + chLen);
    ctx.stroke();

    // Edge markers at 10% intervals
    ctx.fillStyle = '#ff0';
    ctx.font = Math.round(9 * d) + 'px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; ++i) {
      const pct = i * 10;
      ctx.fillText(pct + '%', Math.round(i * w / 10), 12 * d);
      ctx.fillText(pct + '%', Math.round(i * w / 10), h - 4 * d);
    }
    ctx.textAlign = 'start';
    for (let i = 0; i <= 8; ++i) {
      const pct = Math.round(i * 12.5);
      ctx.fillText(pct + '%', 4 * d, Math.round(i * h / 8) + 4 * d);
    }
  }

  // -- Calibration: Overscan Detection --
  function renderOverscanDetect(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const borders = [
      { pct: 0.10, color: '#0044ff', label: '10%' },
      { pct: 0.05, color: '#00cc00', label: '5%' },
      { pct: 0.025, color: '#ffcc00', label: '2.5%' },
      { pct: 0.01, color: '#ff0000', label: '1%' },
    ];

    for (const b of borders) {
      const x = Math.round(w * b.pct);
      const y = Math.round(h * b.pct);
      const bw = w - 2 * x;
      const bh = h - 2 * y;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(2, 2 * d);
      ctx.strokeRect(x, y, bw, bh);
    }

    // Labels
    ctx.font = Math.round(10 * d) + 'px monospace';
    ctx.textAlign = 'start';
    for (const b of borders) {
      const x = Math.round(w * b.pct) + 4 * d;
      const y = Math.round(h * b.pct) + 12 * d;
      ctx.fillStyle = b.color;
      ctx.fillText(b.label, x, y);
    }

    // Center crosshair
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, d);
    const chLen = Math.min(w, h) * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx - chLen, cy);
    ctx.lineTo(cx + chLen, cy);
    ctx.moveTo(cx, cy - chLen);
    ctx.lineTo(cx, cy + chLen);
    ctx.stroke();

    // Instructions
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('If all borders are visible, overscan < 1%', w / 2, h / 2 + 30 * d);
  }

  // -- Calibration: Color Temperature --
  function renderColorTemp(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const K = state.colorTemp;
    const rgb = kelvinToRgb(K);

    ctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    ctx.fillRect(0, 0, w, h);

    // Center neutral gray reference patch
    const patchSize = Math.min(w, h) * 0.12;
    const cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#808080';
    ctx.fillRect(cx - patchSize / 2, cy - patchSize / 2, patchSize, patchSize);
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = Math.max(1, d);
    ctx.strokeRect(cx - patchSize / 2, cy - patchSize / 2, patchSize, patchSize);

    // Description
    const descriptions = {
      3200: 'Warm / Tungsten',
      4000: 'Warm Fluorescent',
      5000: 'Horizon Daylight',
      5500: 'Mid-Daylight',
      6500: 'D65 / sRGB Standard',
      7500: 'Cool Daylight',
      9300: 'Cool / Blue bias',
    };
    const desc = descriptions[K] || '';

    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.font = 'bold ' + Math.round(24 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(K + 'K', w / 2, cy - patchSize / 2 - 30 * d);
    ctx.font = Math.round(13 * d) + 'px sans-serif';
    ctx.fillText(desc, w / 2, cy - patchSize / 2 - 12 * d);
    ctx.fillText('Neutral gray reference', w / 2, cy + patchSize / 2 + 16 * d);
  }

  // -- Calibration: Convergence Test --
  function renderConvergenceTest(ctx, canvas) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();
    const spacing = Math.round(40 * d);
    const armLen = Math.round(6 * d);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = Math.max(1, Math.round(d));
    for (let y = spacing; y < h - spacing / 2; y += spacing)
      for (let x = spacing; x < w - spacing / 2; x += spacing) {
        // Red cross (offset left 1px)
        ctx.strokeStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(x - 1 - armLen, y);
        ctx.lineTo(x - 1 + armLen, y);
        ctx.moveTo(x - 1, y - armLen);
        ctx.lineTo(x - 1, y + armLen);
        ctx.stroke();
        // Green cross (center)
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(x - armLen, y);
        ctx.lineTo(x + armLen, y);
        ctx.moveTo(x, y - armLen);
        ctx.lineTo(x, y + armLen);
        ctx.stroke();
        // Blue cross (offset right 1px)
        ctx.strokeStyle = '#0000ff';
        ctx.beginPath();
        ctx.moveTo(x + 1 - armLen, y);
        ctx.lineTo(x + 1 + armLen, y);
        ctx.moveTo(x + 1, y - armLen);
        ctx.lineTo(x + 1, y + armLen);
        ctx.stroke();
      }

    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = Math.round(11 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('All crosshairs should appear white. Colored fringing indicates misconvergence.', w / 2, h - 8 * d);
  }

  // -- Calibration: Backlight Bleed --
  function renderBacklightBleed(ctx, canvas, state) {
    const w = canvas.width, h = canvas.height;
    const d = dpr();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (state.showBorder) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, d);
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }

    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = Math.round(13 * d) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('View in a dark room. Light areas indicate backlight bleed.', w / 2, h / 2);
  }

  // ===== WebGL2 HDR =====

  function initWebGL() {
    if (gl) return;
    try {
      gl = glCanvas.getContext('webgl2', { alpha: false, premultipliedAlpha: false });
    } catch (_) {}
  }

  function showWebGLUnsupported() {
    testOverlay.innerHTML = '<div class="webgl-unsupported">WebGL2 is not supported in this browser.<br>HDR tests require WebGL2.</div>';
  }

  function getOrCreateProgram(gl, id, vsSrc, fsSrc) {
    if (glPrograms[id]) return glPrograms[id];

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('WebGL program link error:', gl.getProgramInfoLog(prog));
      return null;
    }

    glPrograms[id] = prog;
    return prog;
  }

  function drawFullscreenQuad(gl) {
    if (!gl._quadBuf) {
      gl._quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, gl._quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl._quadBuf);
    const loc = 0;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const HDR_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const HDR_GRADIENT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform float uMaxBrightness;
void main() {
  float t = vUV.x;
  float brightness = t * uMaxBrightness;
  fragColor = vec4(brightness, brightness, brightness, 1.0);
}`;

  const HDR_CLIPPING_FS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform float uLevels[8];
uniform int uCount;
void main() {
  int idx = int(vUV.x * float(uCount));
  if (idx >= uCount) idx = uCount - 1;
  float brightness = uLevels[idx];
  float border = step(0.01, fract(vUV.x * float(uCount)));
  float topBot = step(0.05, vUV.y) * step(0.05, 1.0 - vUV.y);
  fragColor = vec4(vec3(brightness * border * topBot), 1.0);
}`;

  // -- HDR: Gradient --
  function renderHdrGradient(gl, canvas) {
    const prog = getOrCreateProgram(gl, 'hdr-gradient', HDR_VS, HDR_GRADIENT_FS);
    if (!prog) { showWebGLUnsupported(); return; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    gl.uniform1f(gl.getUniformLocation(prog, 'uMaxBrightness'), 4.0);
    drawFullscreenQuad(gl);

    testOverlay.innerHTML =
      '<div class="overlay-info">SDR range: left half | HDR range: right half (brightness > 1.0). On HDR displays, right side should appear brighter.</div>';
  }

  // -- HDR: Highlight Clipping --
  function renderHdrClipping(gl, canvas) {
    const prog = getOrCreateProgram(gl, 'hdr-clipping', HDR_VS, HDR_CLIPPING_FS);
    if (!prog) { showWebGLUnsupported(); return; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
    const levels = [0.25, 0.5, 0.75, 1.0, 2.0, 4.0, 6.0, 8.0];
    gl.uniform1fv(gl.getUniformLocation(prog, 'uLevels[0]'), new Float32Array(levels));
    gl.uniform1i(gl.getUniformLocation(prog, 'uCount'), levels.length);
    drawFullscreenQuad(gl);

    testOverlay.innerHTML =
      '<div class="overlay-info">Patches at 0.25x, 0.5x, 0.75x, 1.0x, 2.0x, 4.0x, 6.0x, 8.0x brightness. On HDR displays, patches > 1.0 should be distinguishable.</div>';
  }

  // ===== Fullscreen =====

  function toggleFullscreen() {
    if (document.fullscreenElement)
      document.exitFullscreen();
    else if (testArea.style.display !== 'none')
      testArea.requestFullscreen().catch(() => {});
  }

  document.addEventListener('fullscreenchange', () => {
    btnFullscreen.textContent = document.fullscreenElement ? '\u2716 Exit FS' : '\u2696 Fullscreen';
    handleResize();
  });

  // ===== Resize =====

  function handleResize() {
    if (!currentTest || mode !== 'testing') return;

    if (currentTest.type === 'webgl') {
      sizeCanvas(glCanvas, testArea);
      if (gl && currentTest.render)
        currentTest.render(gl, glCanvas, 0, animState);
    } else {
      sizeCanvas(testCanvas, testArea);
      if (currentTest.type === 'solid')
        renderSolid(ctx, testCanvas, currentTest.color);
      else if (currentTest.type === 'canvas' && currentTest.render)
        currentTest.render(ctx, testCanvas, animState);
      // animated tests auto-redraw on next frame
    }
    updateStatusBar();
  }

  resizeObserver = new ResizeObserver(() => handleResize());
  resizeObserver.observe(testArea);

  // ===== Menu handling =====

  document.querySelectorAll('.menu-entry[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;

      if (action === 'run-test')
        runTest(el.dataset.test);
      else if (action === 'fullscreen')
        toggleFullscreen();
      else if (action === 'exit')
        window.parent !== window
          ? window.parent.postMessage({ type: 'sz:close' }, '*')
          : window.close();
      else if (action === 'toggle-toolbar') {
        el.classList.toggle('checked');
        toolbar.style.display = el.classList.contains('checked') ? '' : 'none';
      } else if (action === 'toggle-statusbar') {
        el.classList.toggle('checked');
        statusBar.style.display = el.classList.contains('checked') ? '' : 'none';
      } else if (action === 'toggle-descriptions') {
        el.classList.toggle('checked');
        showDescriptions = el.classList.contains('checked');
        buildSelector();
      } else if (action === 'shortcuts')
        document.getElementById('dlg-shortcuts').classList.add('visible');
      else if (action === 'about')
        document.getElementById('dlg-about').classList.add('visible');

      // Close menus
      document.querySelectorAll('.menu-item').forEach(mi => mi.blur());
    });
  });

  // Dialog close
  document.querySelectorAll('.dialog-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.dialog-overlay').classList.remove('visible');
    });
  });

  // ===== Toolbar buttons =====

  btnBack.addEventListener('click', exitTest);
  btnFullscreen.addEventListener('click', toggleFullscreen);

  // ===== Keyboard =====

  document.addEventListener('keydown', (e) => {
    // Close dialog first
    const openDialog = document.querySelector('.dialog-overlay.visible');
    if (openDialog) {
      if (e.key === 'Escape' || e.key === 'Enter')
        openDialog.classList.remove('visible');
      return;
    }

    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    if (mode === 'testing') {
      if (e.key === 'Escape') {
        if (document.fullscreenElement)
          document.exitFullscreen();
        else
          exitTest();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        paused = !paused;
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateTest(1);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateTest(-1);
        return;
      }
    }

    if (mode === 'selector') {
      const catKey = e.key;
      const cat = CATEGORIES.find(c => c.key === catKey);
      if (cat) {
        const el = document.getElementById('cat-' + cat.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // ===== Init =====

  testCanvas.addEventListener('pointerdown', () => {
    if (currentTest && currentTest.id === 'input-lag')
      animState.doFlash = true;
  });

  buildSelector();
  updateStatusBar();

})();
