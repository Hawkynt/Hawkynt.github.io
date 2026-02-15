;(function() {
  'use strict';

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  const taskBody = document.getElementById('task-body');
  const statusText = document.getElementById('status-text');
  const btnEnd = document.getElementById('btn-end');

  let selectedWindowId = null;
  let windowList = [];
  let activeTab = 'applications';

  // Performance history data (sampled once per second for a 60-second window)
  const HISTORY_SIZE = 60;
  const cpuHistory = new Array(HISTORY_SIZE).fill(0);
  const memHistory = new Array(HISTORY_SIZE).fill(0);
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let currentFps = 0;
  let lastHistorySample = 0;

  const isInsideOS = SZ.Dlls.Kernel32.IsInsideOS();

  // Tab switching
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      for (const t of tabs) t.classList.toggle('active', t === tab);
      for (const p of panels) p.classList.toggle('active', p.id === 'panel-' + activeTab);
      if (activeTab === 'performance') {
        _canvasesResized = false;
        requestAnimationFrame(() => resizeCanvases());
      }
    });
  }

  // Fetch the window list -- prefer direct same-origin access, fall back to SendMessage
  async function fetchWindowList() {
    // Try direct same-origin access first (avoids async postMessage round-trip)
    if (isInsideOS) {
      try {
        const wm = window.parent.SZ?.system?.windowManager;
        if (wm) {
          const all = wm.allWindows;
          if (all) {
            windowList = all.map(w => ({
              id: w.id,
              title: w.title,
              state: w.state,
            }));
            renderApplications();
            return;
          }
        }
      } catch (_) {
        // cross-origin or unavailable -- fall through to SendMessage
      }
      try {
        const result = await SZ.Dlls.User32.SendMessage('sz:getWindows');
        if (result.windows) {
          windowList = result.windows;
          renderApplications();
        }
      } catch (_) {
        // timeout or error
      }
    }
  }

  function renderApplications() {
    const fragment = document.createDocumentFragment();
    for (const win of windowList) {
      const tr = document.createElement('tr');
      const winId = String(win.id);
      if (winId === selectedWindowId) tr.classList.add('selected');
      tr.dataset.id = winId;

      tr.addEventListener('click', () => {
        selectedWindowId = winId;
        btnEnd.disabled = false;
        for (const r of taskBody.querySelectorAll('tr'))
          r.classList.toggle('selected', r.dataset.id === winId);
      });

      const tdTask = document.createElement('td');
      tdTask.textContent = win.title || '(untitled)';
      tr.appendChild(tdTask);

      const tdStatus = document.createElement('td');
      const state = win.state || 'normal';
      tdStatus.textContent = state === 'normal' ? 'Running'
        : state === 'minimized' ? 'Minimized'
        : state === 'maximized' ? 'Maximized'
        : state;
      tr.appendChild(tdStatus);

      const tdId = document.createElement('td');
      tdId.textContent = winId;
      tdId.style.fontFamily = 'monospace';
      tdId.style.fontSize = '10px';
      tr.appendChild(tdId);

      fragment.appendChild(tr);
    }

    taskBody.innerHTML = '';
    taskBody.appendChild(fragment);

    statusText.textContent = `Windows: ${windowList.length}`;
    if (!windowList.find(w => String(w.id) === selectedWindowId)) {
      selectedWindowId = null;
      btnEnd.disabled = true;
    }
  }

  btnEnd.addEventListener('click', () => {
    if (selectedWindowId && isInsideOS) {
      SZ.Dlls.User32.PostMessage('sz:closeWindow', { windowId: selectedWindowId });
      setTimeout(fetchWindowList, 300);
    }
  });

  // Performance graphs
  const canvasCpu = document.getElementById('canvas-cpu');
  const canvasCpuHist = document.getElementById('canvas-cpu-history');
  const canvasMem = document.getElementById('canvas-mem');
  const canvasMemHist = document.getElementById('canvas-mem-history');
  const allCanvases = [canvasCpu, canvasCpuHist, canvasMem, canvasMemHist];

  let _canvasesResized = false;

  function resizeCanvases() {
    if (activeTab !== 'performance')
      return;
    const dpr = window.devicePixelRatio || 1;
    let allGood = true;
    for (const c of allCanvases) {
      const rect = c.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 0 && h > 0) {
        if (c.width !== w * dpr || c.height !== h * dpr) {
          c.width = w * dpr;
          c.height = h * dpr;
        }
      } else
        allGood = false;
    }
    _canvasesResized = allGood;
  }

  // Event loop pressure: measure setTimeout drift as a proxy for main-thread load.
  const EXPECTED_DELAY = 100;
  let _smoothedDrift = 0;
  (function measureLoop() {
    const t0 = performance.now();
    setTimeout(() => {
      const actual = performance.now() - t0;
      const drift = Math.max(0, actual - EXPECTED_DELAY);
      _smoothedDrift = _smoothedDrift * 0.7 + drift * 0.3;
      measureLoop();
    }, EXPECTED_DELAY);
  })();

  function getEventLoopLoad() {
    // Scale 0-50ms drift -> 0-100% load
    return Math.min(100, (_smoothedDrift / 50) * 100);
  }

  function getMemUsage() {
    try {
      const mem = (isInsideOS ? window.parent : window).performance?.memory;
      if (mem)
        return (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
    } catch (_) {
      // cross-origin -- unavailable
    }
    return -1;
  }

  function drawGauge(canvas, value, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = dpr;
    for (let i = 0; i <= 10; ++i) {
      const y = (i / 10) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 10; ++i) {
      const x = (i / 10) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Scale labels on left
    ctx.fillStyle = '#0a4a0a';
    ctx.font = `${9 * dpr}px Tahoma`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; ++i) {
      const pct = (4 - i) * 25;
      const y = (i / 4) * h;
      ctx.fillText(pct + '%', 2 * dpr, y + 1);
    }

    // Bar (ensure minimum 2px visible at any non-zero value)
    const barW = w * 0.35;
    const minBarH = value > 0 ? Math.max(3 * dpr, (value / 100) * h) : 0;
    const barH = (value / 100) * h;
    const drawH = Math.max(barH, minBarH);
    const barX = (w - barW) / 2;
    const gradient = ctx.createLinearGradient(barX, h, barX, h - Math.max(drawH, 1));
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, `${color.slice(0, -1)}, 0.6)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, h - drawH, barW, drawH);

    // Border around bar area
    ctx.strokeStyle = `${color.slice(0, -1)}, 0.3)`;
    ctx.lineWidth = dpr;
    ctx.strokeRect(barX, 0, barW, h);

    // Value text
    ctx.fillStyle = '#0f0';
    ctx.font = `bold ${14 * dpr}px Tahoma`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(value)}%`, w / 2, 4 * dpr);
  }

  function drawGaugeNA(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = dpr;
    for (let i = 0; i <= 10; ++i) {
      const y = (i / 10) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 10; ++i) {
      const x = (i / 10) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.fillStyle = '#555';
    ctx.font = `bold ${12 * dpr}px Tahoma`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N/A', w / 2, h / 2);
  }

  function drawHistory(canvas, data, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = dpr;
    for (let i = 0; i <= 4; ++i) {
      const y = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Line chart
    ctx.beginPath();
    for (let i = 0; i < data.length; ++i) {
      const x = (i / (data.length - 1)) * w;
      const y = h - (data[i] / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Fill under the line
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = `${color.slice(0, -1)}, 0.15)`;
    ctx.fill();
  }

  // FPS counter
  function measureFps() {
    ++frameCount;
    const now = performance.now();
    if (now - lastFrameTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFrameTime = now;
    }
  }

  function getDomNodeCount() {
    try {
      if (isInsideOS)
        return window.parent.document.querySelectorAll('*').length;
    } catch (_) {
      // cross-origin
    }
    return document.querySelectorAll('*').length;
  }

  function getHeapMB() {
    try {
      const mem = (isInsideOS ? window.parent : window).performance?.memory;
      if (mem)
        return Math.round(mem.usedJSHeapSize / 1048576);
    } catch (_) {
      // cross-origin
    }
    return null;
  }

  // Main update loop
  function update() {
    measureFps();

    const cpu = getEventLoopLoad();
    const mem = getMemUsage();
    const memAvailable = mem >= 0;
    const memPct = memAvailable ? mem : 0;

    // Sample history once per second (not every frame)
    const now = performance.now();
    if (now - lastHistorySample >= 1000) {
      lastHistorySample = now;
      cpuHistory.push(cpu);
      cpuHistory.shift();
      memHistory.push(memPct);
      memHistory.shift();
    }

    if (activeTab === 'performance') {
      if (!_canvasesResized)
        resizeCanvases();

      drawGauge(canvasCpu, cpu, 'rgb(0, 255, 0)');
      drawHistory(canvasCpuHist, cpuHistory, 'rgb(0, 255, 0)');
      if (memAvailable) {
        drawGauge(canvasMem, memPct, 'rgb(255, 255, 0)');
        drawHistory(canvasMemHist, memHistory, 'rgb(255, 255, 0)');
      } else {
        drawGaugeNA(canvasMem);
        drawGaugeNA(canvasMemHist);
      }

      document.getElementById('stat-windows').textContent = windowList.length;
      document.getElementById('stat-dom').textContent = getDomNodeCount() || '?';
      const heap = getHeapMB();
      document.getElementById('stat-heap').textContent = heap != null ? heap : 'N/A';
      document.getElementById('stat-fps').textContent = currentFps;
    }

    requestAnimationFrame(update);
  }

  // Kick off -- wait for first frame so layout is settled
  window.addEventListener('resize', () => {
    _canvasesResized = false;
  });

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    fetchWindowList();
    setInterval(fetchWindowList, 1000);
    requestAnimationFrame(update);
  }

  init();

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
