;(function() {
  'use strict';

  // ================================================================
  // Constants & Helpers
  // ================================================================

  const STORAGE_ALARMS = 'sz-alarms';
  const STORAGE_WORLD_CLOCKS = 'sz-world-clocks';
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_HEADERS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  const TIMEZONES = [
    { label: 'UTC', tz: 'UTC' },
    { label: 'London (GMT)', tz: 'Europe/London' },
    { label: 'Paris (CET)', tz: 'Europe/Paris' },
    { label: 'Berlin (CET)', tz: 'Europe/Berlin' },
    { label: 'Moscow (MSK)', tz: 'Europe/Moscow' },
    { label: 'Dubai (GST)', tz: 'Asia/Dubai' },
    { label: 'Kolkata (IST)', tz: 'Asia/Kolkata' },
    { label: 'Bangkok (ICT)', tz: 'Asia/Bangkok' },
    { label: 'Shanghai (CST)', tz: 'Asia/Shanghai' },
    { label: 'Tokyo (JST)', tz: 'Asia/Tokyo' },
    { label: 'Sydney (AEST)', tz: 'Australia/Sydney' },
    { label: 'Auckland (NZST)', tz: 'Pacific/Auckland' },
    { label: 'Honolulu (HST)', tz: 'Pacific/Honolulu' },
    { label: 'Anchorage (AKST)', tz: 'America/Anchorage' },
    { label: 'Los Angeles (PST)', tz: 'America/Los_Angeles' },
    { label: 'Denver (MST)', tz: 'America/Denver' },
    { label: 'Chicago (CST)', tz: 'America/Chicago' },
    { label: 'New York (EST)', tz: 'America/New_York' },
    { label: 'Sao Paulo (BRT)', tz: 'America/Sao_Paulo' },
    { label: 'Cairo (EET)', tz: 'Africa/Cairo' },
    { label: 'Nairobi (EAT)', tz: 'Africa/Nairobi' },
    { label: 'Lagos (WAT)', tz: 'Africa/Lagos' },
  ];

  /* City coordinates [longitude, latitude] for map markers */
  const CITY_COORDS = {
    'UTC': [0, 0],
    'Europe/London': [-0.1, 51.5],
    'Europe/Paris': [2.3, 48.9],
    'Europe/Berlin': [13.4, 52.5],
    'Europe/Moscow': [37.6, 55.8],
    'Asia/Dubai': [55.3, 25.3],
    'Asia/Kolkata': [88.4, 22.6],
    'Asia/Bangkok': [100.5, 13.8],
    'Asia/Shanghai': [121.5, 31.2],
    'Asia/Tokyo': [139.7, 35.7],
    'Australia/Sydney': [151.2, -33.9],
    'Pacific/Auckland': [174.8, -36.8],
    'Pacific/Honolulu': [-157.8, 21.3],
    'America/Anchorage': [-149.9, 61.2],
    'America/Los_Angeles': [-118.2, 34.1],
    'America/Denver': [-105.0, 39.7],
    'America/Chicago': [-87.6, 41.9],
    'America/New_York': [-74.0, 40.7],
    'America/Sao_Paulo': [-46.6, -23.5],
    'Africa/Cairo': [31.2, 30.0],
    'Africa/Nairobi': [36.8, -1.3],
    'Africa/Lagos': [3.4, 6.5],
  };

  /* Simplified continent outlines — equirectangular, viewBox 0 0 360 180, x=lon+180, y=90-lat */
  const MAP_LAND = [
    'M10,28L25,30 40,28 55,40 58,48 62,56 70,66 80,70 90,72 98,80 100,64 104,54 106,49 110,47 114,45 125,40 125,35 120,27 115,20 90,18 50,20Z',
    'M127,28L125,18 135,10 148,8 158,14 152,24 140,28Z',
    'M102,83L108,80 120,82 132,88 145,95 143,105 138,112 130,120 122,128 115,135 110,145 105,137 100,108 100,95 102,87Z',
    'M170,52L175,50 172,46 175,42 175,37 185,32 190,30 195,20 210,20 208,28 210,35 210,42 206,48 202,52 195,52 190,47 183,48Z',
    'M170,55L180,56 190,58 200,60 210,60 212,68 210,78 206,90 200,102 195,110 190,118 196,125 190,122 180,118 174,112 170,105 166,95 163,85 162,75 164,65 167,58Z',
    'M210,20L220,20 232,18 248,16 265,14 280,16 295,15 310,16 325,18 335,22 342,28 340,35 335,42 330,46 325,50 318,55 310,56 300,53 290,50 280,48 270,50 265,55 260,58 255,53 250,48 244,50 238,53 232,56 226,54 220,48 214,44 210,42Z',
    'M250,55L258,58 262,65 258,75 252,78 248,72 248,62Z',
    'M270,60L278,58 284,56 288,60 285,68 280,72 275,68 270,64Z',
    'M318,42L322,36 325,30 324,42 320,48Z',
    'M290,108L285,114 284,120 287,128 294,132 304,133 312,128 318,120 314,112 308,108 298,107Z',
    'M350,118L352,124 350,132 348,126Z',
    'M287,82L293,80 300,82 308,84 302,88 294,86Z',
  ];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs)
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') e.className = v;
        else if (k === 'textContent') e.textContent = v;
        else if (k === 'innerHTML') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v);
      }
    if (children)
      for (const c of (Array.isArray(children) ? children : [children])) {
        if (typeof c === 'string') e.appendChild(document.createTextNode(c));
        else if (c) e.appendChild(c);
      }
    return e;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  function saveJSON(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ================================================================
  // Web Audio beep
  // ================================================================

  let audioCtx = null;

  function playBeep(count) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const n = count || 3;
    for (let i = 0; i < n; ++i) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      const start = audioCtx.currentTime + i * 0.3;
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  // ================================================================
  // Tab system
  // ================================================================

  const tabBar = document.getElementById('tab-bar');
  const tabBody = document.getElementById('tab-body');
  const tabs = [];
  let activeTabIndex = 0;

  function addTab(label, buildFn) {
    const idx = tabs.length;
    const btn = el('button', { className: 'tab-btn', textContent: label, onClick: () => switchTab(idx) });
    const panel = el('div', { className: 'tab-panel' });
    tabBar.appendChild(btn);
    tabBody.appendChild(panel);
    tabs.push({ btn, panel, buildFn, built: false });
  }

  function switchTab(idx) {
    activeTabIndex = idx;
    for (let i = 0; i < tabs.length; ++i) {
      tabs[i].btn.classList.toggle('active', i === idx);
      tabs[i].panel.classList.toggle('active', i === idx);
    }
    if (!tabs[idx].built) {
      tabs[idx].buildFn(tabs[idx].panel);
      tabs[idx].built = true;
    }
  }

  // ================================================================
  // Tab 1: Date & Time
  // ================================================================

  function buildDateTimeTab(panel) {
    const layout = el('div', { className: 'datetime-layout' });

    // -- Calendar (left) --
    const left = el('fieldset', { className: 'datetime-left group-box' });
    left.appendChild(el('legend', null, ['Date']));
    const calNav = el('div', { className: 'cal-nav' });

    const monthSelect = el('select', { className: 'xp-select' });
    for (let i = 0; i < 12; ++i)
      monthSelect.appendChild(el('option', { value: i, textContent: MONTH_NAMES[i] }));

    const prevBtn = el('button', { className: 'xp-btn', innerHTML: '&#9668;', title: 'Previous month' });
    const nextBtn = el('button', { className: 'xp-btn', innerHTML: '&#9658;', title: 'Next month' });

    const yearInput = el('input', { className: 'xp-input', type: 'text', maxlength: '4' });
    const yearUp = el('button', { className: 'xp-btn', innerHTML: '&#9650;' });
    const yearDown = el('button', { className: 'xp-btn', innerHTML: '&#9660;' });
    const yearSpinners = el('div', { className: 'cal-year-spinners' }, [yearUp, yearDown]);
    const yearWrap = el('div', { className: 'cal-year-wrap' }, [yearInput, yearSpinners]);

    calNav.appendChild(prevBtn);
    calNav.appendChild(monthSelect);
    calNav.appendChild(yearWrap);
    calNav.appendChild(nextBtn);
    left.appendChild(calNav);

    const calGrid = el('div', { className: 'cal-grid' });
    left.appendChild(calGrid);

    const cwInfo = el('div', { className: 'cal-week-info' });
    left.appendChild(cwInfo);

    let viewMonth, viewYear, selectedDay, selectedMonth, selectedYear;

    function initCalDate() {
      const now = new Date();
      viewMonth = now.getMonth();
      viewYear = now.getFullYear();
      selectedDay = now.getDate();
      selectedMonth = viewMonth;
      selectedYear = viewYear;
    }

    function renderCalendar() {
      monthSelect.value = viewMonth;
      yearInput.value = viewYear;
      calGrid.innerHTML = '';

      // Header row: empty CW corner + day names
      calGrid.appendChild(el('div', { className: 'cal-cw-header', textContent: 'CW' }));
      for (let i = 0; i < DAY_HEADERS.length; ++i) {
        let cls = 'cal-header';
        if (i === 6) cls += ' sunday';
        calGrid.appendChild(el('div', { className: cls, textContent: DAY_HEADERS[i] }));
      }

      const firstDay = new Date(viewYear, viewMonth, 1);
      let startDow = firstDay.getDay();
      if (startDow === 0) startDow = 7;
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

      const today = new Date();
      const todayD = today.getDate();
      const todayM = today.getMonth();
      const todayY = today.getFullYear();

      // Collect all day cells for the grid (flat array)
      const dayCells = [];

      // Previous month's trailing days
      for (let i = startDow - 1; i >= 1; --i) {
        const day = prevMonthDays - i + 1;
        const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
        const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
        dayCells.push({ day, month: prevM, year: prevY, otherMonth: true });
      }
      // Current month days
      for (let d = 1; d <= daysInMonth; ++d)
        dayCells.push({ day: d, month: viewMonth, year: viewYear, otherMonth: false });
      // Next month leading days
      const remaining = (dayCells.length % 7 === 0) ? 0 : 7 - (dayCells.length % 7);
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      for (let d = 1; d <= remaining; ++d)
        dayCells.push({ day: d, month: nextM, year: nextY, otherMonth: true });

      // Render rows: CW label + 7 day cells per row
      for (let row = 0; row < dayCells.length; row += 7) {
        // Calculate CW from the Thursday of this week row
        const thuCell = dayCells[row + 3];
        const thuDate = new Date(thuCell.year, thuCell.month, thuCell.day);
        const cw = getCalendarWeek(thuDate);
        calGrid.appendChild(el('div', { className: 'cal-cw', textContent: cw }));

        for (let col = 0; col < 7; ++col) {
          const cell = dayCells[row + col];
          const isSunday = col === 6;
          let cls = 'cal-day';
          if (isSunday) cls += ' sunday';
          if (cell.otherMonth) {
            cls += ' other-month';
          } else {
            if (cell.day === todayD && cell.month === todayM && cell.year === todayY)
              cls += ' today';
            if (cell.day === selectedDay && cell.month === selectedMonth && cell.year === selectedYear)
              cls += ' selected';
          }
          const dayEl = el('div', { className: cls, textContent: cell.day });
          if (!cell.otherMonth) {
            const dd = cell.day;
            dayEl.addEventListener('pointerdown', () => {
              selectedDay = dd;
              selectedMonth = viewMonth;
              selectedYear = viewYear;
              renderCalendar();
            });
          }
          calGrid.appendChild(dayEl);
        }
      }

      // Calendar week display for selected date
      const selDate = new Date(selectedYear, selectedMonth, selectedDay);
      const cw = getCalendarWeek(selDate);
      cwInfo.innerHTML = 'Calendar Week: <span class="cw-number">CW' + cw + '</span>';
    }

    function getCalendarWeek(d) {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    }

    prevBtn.addEventListener('pointerdown', () => {
      if (--viewMonth < 0) { viewMonth = 11; --viewYear; }
      renderCalendar();
    });
    nextBtn.addEventListener('pointerdown', () => {
      if (++viewMonth > 11) { viewMonth = 0; ++viewYear; }
      renderCalendar();
    });
    monthSelect.addEventListener('change', () => {
      viewMonth = parseInt(monthSelect.value, 10);
      renderCalendar();
    });
    yearUp.addEventListener('pointerdown', () => { ++viewYear; renderCalendar(); });
    yearDown.addEventListener('pointerdown', () => { --viewYear; renderCalendar(); });
    yearInput.addEventListener('change', () => {
      const v = parseInt(yearInput.value, 10);
      if (v > 0) { viewYear = v; renderCalendar(); }
    });

    initCalDate();
    renderCalendar();
    layout.appendChild(left);

    // -- Clock (right) --
    const right = el('fieldset', { className: 'datetime-right group-box' });
    right.appendChild(el('legend', null, ['Time']));
    const clockFace = el('div', { className: 'clock-face' });

    // Build markers
    for (let i = 0; i < 12; ++i) {
      const marker = el('div', { className: 'clock-marker major' });
      marker.style.transform = `translateX(-50%) rotate(${i * 30}deg)`;
      clockFace.appendChild(marker);
    }
    for (let i = 0; i < 60; ++i) {
      if (i % 5 === 0) continue;
      const marker = el('div', { className: 'clock-marker minor' });
      marker.style.transform = `translateX(-50%) rotate(${i * 6}deg)`;
      clockFace.appendChild(marker);
    }

    const hourHand = el('div', { className: 'clock-hand hour' });
    const minuteHand = el('div', { className: 'clock-hand minute' });
    const secondHand = el('div', { className: 'clock-hand second' });
    clockFace.appendChild(hourHand);
    clockFace.appendChild(minuteHand);
    clockFace.appendChild(secondHand);
    clockFace.appendChild(el('div', { className: 'clock-center' }));
    right.appendChild(clockFace);

    const digitalTime = el('div', { className: 'digital-time' });
    right.appendChild(digitalTime);

    const tzDisplay = el('div', { className: 'timezone-display' });
    right.appendChild(tzDisplay);

    function updateClock() {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const ms = now.getMilliseconds();

      const sDeg = (s + ms / 1000) * 6;
      const mDeg = (m + s / 60) * 6;
      const hDeg = ((h % 12) + m / 60) * 30;

      secondHand.style.transform = `rotate(${sDeg}deg)`;
      minuteHand.style.transform = `rotate(${mDeg}deg)`;
      hourHand.style.transform = `rotate(${hDeg}deg)`;

      digitalTime.textContent = pad2(h) + ':' + pad2(m) + ':' + pad2(s);

      try {
        const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
        tzDisplay.textContent = tzName;
      } catch {
        tzDisplay.textContent = 'UTC' + (now.getTimezoneOffset() <= 0 ? '+' : '-') + Math.abs(now.getTimezoneOffset() / 60);
      }
    }

    updateClock();
    setInterval(updateClock, 100);
    layout.appendChild(right);
    panel.appendChild(layout);
  }

  // ================================================================
  // Tab 2: Alarms
  // ================================================================

  let alarms = [];
  let alarmListEl = null;

  function buildAlarmsTab(panel) {
    alarms = loadJSON(STORAGE_ALARMS, []);

    const listFieldset = el('fieldset', { className: 'group-box' });
    listFieldset.appendChild(el('legend', null, ['Active Alarms']));
    alarmListEl = el('div', { className: 'alarm-list' });
    listFieldset.appendChild(alarmListEl);
    panel.appendChild(listFieldset);

    // Add alarm form
    const formFieldset = el('fieldset', { className: 'group-box' });
    formFieldset.appendChild(el('legend', null, ['Add Alarm']));
    const form = el('div', { className: 'alarm-form' });

    const timeInput = el('input', { className: 'xp-input', type: 'time', value: '07:00' });
    const labelInput = el('input', { className: 'xp-input', type: 'text', placeholder: 'Label', value: 'Alarm', style: 'width:80px' });
    const repeatSelect = el('select', { className: 'xp-select' });
    repeatSelect.appendChild(el('option', { value: 'once', textContent: 'Once' }));
    repeatSelect.appendChild(el('option', { value: 'daily', textContent: 'Daily' }));
    repeatSelect.appendChild(el('option', { value: 'weekdays', textContent: 'Weekdays' }));
    const addBtn = el('button', { className: 'xp-btn', textContent: 'Add' });

    form.appendChild(el('label', null, ['Time:']));
    form.appendChild(timeInput);
    form.appendChild(el('label', null, ['Label:']));
    form.appendChild(labelInput);
    form.appendChild(repeatSelect);
    form.appendChild(addBtn);
    formFieldset.appendChild(form);
    panel.appendChild(formFieldset);

    addBtn.addEventListener('pointerdown', () => {
      if (!timeInput.value) return;
      alarms.push({
        id: Date.now(),
        time: timeInput.value,
        label: labelInput.value || 'Alarm',
        repeat: repeatSelect.value,
        enabled: true,
        fired: false
      });
      saveJSON(STORAGE_ALARMS, alarms);
      renderAlarms();
    });

    renderAlarms();
  }

  function renderAlarms() {
    if (!alarmListEl) return;
    alarmListEl.innerHTML = '';
    if (alarms.length === 0) {
      alarmListEl.appendChild(el('div', { style: 'padding:8px;text-align:center;color:gray;font-style:italic', textContent: 'No alarms set.' }));
      return;
    }
    for (const alarm of alarms) {
      const item = el('div', { className: 'alarm-item' });
      item.appendChild(el('span', { className: 'alarm-time', textContent: alarm.time }));
      item.appendChild(el('span', { className: 'alarm-label', textContent: alarm.label }));
      item.appendChild(el('span', { className: 'alarm-repeat', textContent: alarm.repeat }));
      const delBtn = el('button', { className: 'xp-btn', textContent: 'X', title: 'Delete', style: 'padding:0 4px;min-height:18px;font-size:10px' });
      delBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        alarms = alarms.filter(a => a.id !== alarm.id);
        saveJSON(STORAGE_ALARMS, alarms);
        renderAlarms();
      });
      item.appendChild(delBtn);
      alarmListEl.appendChild(item);
    }
  }

  // Alarm checker (runs every second)
  function checkAlarms() {
    const now = new Date();
    const currentTime = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    const dow = now.getDay(); // 0=Sun

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (alarm.time !== currentTime) { alarm.fired = false; continue; }
      if (alarm.fired) continue;

      if (alarm.repeat === 'weekdays' && (dow === 0 || dow === 6))
        continue;

      alarm.fired = true;
      showAlarmNotification(alarm);

      if (alarm.repeat === 'once') {
        alarm.enabled = false;
        saveJSON(STORAGE_ALARMS, alarms);
        renderAlarms();
      }
    }
  }

  function showAlarmNotification(alarm) {
    playBeep(4);
    const notif = document.getElementById('alarm-notification');
    const label = document.getElementById('alarm-notif-label');
    label.textContent = alarm.label + ' - ' + alarm.time;
    notif.classList.add('visible');
  }

  document.getElementById('alarm-notif-dismiss').addEventListener('pointerdown', () => {
    document.getElementById('alarm-notification').classList.remove('visible');
  });

  setInterval(checkAlarms, 1000);

  // ================================================================
  // Tab 3: Stopwatch
  // ================================================================

  function buildStopwatchTab(panel) {
    const display = el('div', { className: 'sw-display', textContent: '00:00.000' });
    panel.appendChild(display);

    const btns = el('div', { className: 'sw-buttons' });
    const startBtn = el('button', { className: 'xp-btn', textContent: 'Start' });
    const lapBtn = el('button', { className: 'xp-btn', textContent: 'Lap' });
    const resetBtn = el('button', { className: 'xp-btn', textContent: 'Reset' });
    btns.appendChild(startBtn);
    btns.appendChild(lapBtn);
    btns.appendChild(resetBtn);
    panel.appendChild(btns);

    const lapFieldset = el('fieldset', { className: 'group-box' });
    lapFieldset.appendChild(el('legend', null, ['Laps']));
    const lapList = el('div', { className: 'lap-list' });
    lapFieldset.appendChild(lapList);
    panel.appendChild(lapFieldset);

    let running = false;
    let startTime = 0;
    let elapsed = 0;
    let lapCount = 0;
    let lastLapTime = 0;
    let rafId = null;

    function formatMs(ms) {
      const totalSec = Math.floor(ms / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const millis = ms % 1000;
      return pad2(mins) + ':' + pad2(secs) + '.' + String(millis).padStart(3, '0');
    }

    function tick() {
      if (!running) return;
      const now = performance.now();
      elapsed = now - startTime;
      display.textContent = formatMs(Math.floor(elapsed));
      rafId = requestAnimationFrame(tick);
    }

    startBtn.addEventListener('pointerdown', () => {
      if (running) {
        running = false;
        startBtn.textContent = 'Start';
        if (rafId) cancelAnimationFrame(rafId);
      } else {
        running = true;
        startTime = performance.now() - elapsed;
        startBtn.textContent = 'Stop';
        tick();
      }
    });

    lapBtn.addEventListener('pointerdown', () => {
      if (!running) return;
      ++lapCount;
      const lapTime = Math.floor(elapsed);
      const split = lapTime - lastLapTime;
      lastLapTime = lapTime;
      const item = el('div', { className: 'lap-item' });
      item.appendChild(el('span', { textContent: 'Lap ' + lapCount }));
      item.appendChild(el('span', { textContent: formatMs(split) + ' (' + formatMs(lapTime) + ')' }));
      lapList.insertBefore(item, lapList.firstChild);
    });

    resetBtn.addEventListener('pointerdown', () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      elapsed = 0;
      lapCount = 0;
      lastLapTime = 0;
      startBtn.textContent = 'Start';
      display.textContent = '00:00.000';
      lapList.innerHTML = '';
    });
  }

  // ================================================================
  // Tab 4: Timer
  // ================================================================

  function buildTimerTab(panel) {
    const inputs = el('div', { className: 'timer-inputs' });
    const hInput = el('input', { className: 'xp-input', type: 'number', min: '0', max: '99', value: '0' });
    const mInput = el('input', { className: 'xp-input', type: 'number', min: '0', max: '59', value: '5' });
    const sInput = el('input', { className: 'xp-input', type: 'number', min: '0', max: '59', value: '0' });
    inputs.appendChild(hInput);
    inputs.appendChild(el('span', { textContent: 'h' }));
    inputs.appendChild(mInput);
    inputs.appendChild(el('span', { textContent: 'm' }));
    inputs.appendChild(sInput);
    inputs.appendChild(el('span', { textContent: 's' }));
    panel.appendChild(inputs);

    const display = el('div', { className: 'timer-display', textContent: '00:05:00' });
    panel.appendChild(display);

    const progressWrap = el('div', { className: 'timer-progress-wrap' });
    const progressBar = el('div', { className: 'timer-progress-bar' });
    progressWrap.appendChild(progressBar);
    panel.appendChild(progressWrap);

    const btns = el('div', { className: 'timer-buttons' });
    const startBtn = el('button', { className: 'xp-btn', textContent: 'Start' });
    const pauseBtn = el('button', { className: 'xp-btn', textContent: 'Pause' });
    const resetBtn = el('button', { className: 'xp-btn', textContent: 'Reset' });
    btns.appendChild(startBtn);
    btns.appendChild(pauseBtn);
    btns.appendChild(resetBtn);
    panel.appendChild(btns);

    let running = false;
    let totalMs = 0;
    let remainMs = 0;
    let lastTick = 0;
    let intervalId = null;

    function formatTimer(ms) {
      const totalSec = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
    }

    function updateTimerDisplay() {
      display.textContent = formatTimer(remainMs);
      const pct = totalMs > 0 ? ((totalMs - remainMs) / totalMs) * 100 : 0;
      progressBar.style.width = Math.min(100, pct) + '%';
    }

    function getInputMs() {
      return (parseInt(hInput.value, 10) || 0) * 3600000 +
             (parseInt(mInput.value, 10) || 0) * 60000 +
             (parseInt(sInput.value, 10) || 0) * 1000;
    }

    function tick() {
      if (!running) return;
      const now = performance.now();
      remainMs -= (now - lastTick);
      lastTick = now;
      if (remainMs <= 0) {
        remainMs = 0;
        running = false;
        clearInterval(intervalId);
        startBtn.textContent = 'Start';
        playBeep(5);
      }
      updateTimerDisplay();
    }

    startBtn.addEventListener('pointerdown', () => {
      if (running) return;
      if (remainMs <= 0) {
        totalMs = getInputMs();
        remainMs = totalMs;
      }
      if (remainMs <= 0) return;
      running = true;
      lastTick = performance.now();
      startBtn.textContent = 'Running';
      intervalId = setInterval(tick, 100);
    });

    pauseBtn.addEventListener('pointerdown', () => {
      if (!running) return;
      running = false;
      clearInterval(intervalId);
      startBtn.textContent = 'Start';
    });

    resetBtn.addEventListener('pointerdown', () => {
      running = false;
      if (intervalId) clearInterval(intervalId);
      totalMs = getInputMs();
      remainMs = totalMs;
      startBtn.textContent = 'Start';
      updateTimerDisplay();
    });

    // Sync display when inputs change
    const onInputChange = () => {
      if (!running) {
        totalMs = getInputMs();
        remainMs = totalMs;
        updateTimerDisplay();
      }
    };
    hInput.addEventListener('change', onInputChange);
    mInput.addEventListener('change', onInputChange);
    sInput.addEventListener('change', onInputChange);

    updateTimerDisplay();
  }

  // ================================================================
  // Tab 5: World Clock
  // ================================================================

  let worldClocks = [];
  let wcListEl = null;
  let mapSvgEl = null;

  function createWorldMap() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 360 180');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const ocean = document.createElementNS(NS, 'rect');
    ocean.setAttribute('width', '360');
    ocean.setAttribute('height', '180');
    ocean.setAttribute('fill', '#1a3a5c');
    svg.appendChild(ocean);

    /* Graticule */
    const grid = document.createElementNS(NS, 'g');
    grid.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    grid.setAttribute('stroke-width', '0.3');
    grid.setAttribute('fill', 'none');
    for (let lat = -60; lat <= 60; lat += 30) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', String(90 - lat));
      line.setAttribute('x2', '360');
      line.setAttribute('y2', String(90 - lat));
      grid.appendChild(line);
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', String(lon + 180));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', String(lon + 180));
      line.setAttribute('y2', '180');
      grid.appendChild(line);
    }
    svg.appendChild(grid);

    /* Continents */
    for (const d of MAP_LAND) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'wc-map-land');
      svg.appendChild(path);
    }

    /* Night overlay group */
    const nightGroup = document.createElementNS(NS, 'g');
    nightGroup.setAttribute('class', 'wc-map-night-group');
    svg.appendChild(nightGroup);

    /* City markers */
    const markerGroup = document.createElementNS(NS, 'g');
    for (const tz of TIMEZONES) {
      const coords = CITY_COORDS[tz.tz];
      if (!coords) continue;
      const cx = coords[0] + 180;
      const cy = 90 - coords[1];

      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', String(cy));
      dot.setAttribute('r', '2');
      dot.setAttribute('class', 'wc-map-dot');
      dot.setAttribute('data-tz', tz.tz);

      const title = document.createElementNS(NS, 'title');
      title.textContent = tz.label;
      dot.appendChild(title);

      dot.addEventListener('pointerdown', () => {
        if (!worldClocks.includes(tz.tz)) {
          worldClocks.push(tz.tz);
          saveJSON(STORAGE_WORLD_CLOCKS, worldClocks);
          renderWorldClocks();
        }
      });

      markerGroup.appendChild(dot);
    }
    svg.appendChild(markerGroup);

    mapSvgEl = svg;
    return svg;
  }

  function updateMapMarkers() {
    if (!mapSvgEl) return;
    const NS = 'http://www.w3.org/2000/svg';

    const dots = mapSvgEl.querySelectorAll('.wc-map-dot');
    for (const dot of dots)
      dot.classList.toggle('active', worldClocks.includes(dot.getAttribute('data-tz')));

    /* Labels for active cities */
    mapSvgEl.querySelectorAll('.wc-map-label').forEach(l => l.remove());
    for (const tz of worldClocks) {
      const coords = CITY_COORDS[tz];
      if (!coords) continue;
      const cx = coords[0] + 180;
      const cy = 90 - coords[1];
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(cx));
      label.setAttribute('y', String(cy - 4));
      label.setAttribute('class', 'wc-map-label');
      label.textContent = tz.split('/').pop().replace(/_/g, ' ');
      mapSvgEl.appendChild(label);
    }
  }

  function updateNightShade() {
    if (!mapSvgEl) return;
    const NS = 'http://www.w3.org/2000/svg';
    const group = mapSvgEl.querySelector('.wc-map-night-group');
    if (!group) return;
    group.innerHTML = '';

    const now = new Date();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    /* Sun longitude: 180° at 00:00 UTC, 0° at 12:00 UTC */
    const sunX = 360 - utcMins / 4;
    const nightCenter = (sunX + 180) % 360;
    const left = nightCenter - 90;
    const right = nightCenter + 90;

    const addRect = (x, w) => {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(w));
      rect.setAttribute('height', '180');
      rect.setAttribute('class', 'wc-map-night');
      group.appendChild(rect);
    };

    if (left < 0) {
      addRect(0, right);
      addRect(left + 360, -left);
    } else if (right > 360) {
      addRect(left, 360 - left);
      addRect(0, right - 360);
    } else
      addRect(left, right - left);
  }

  function buildWorldClockTab(panel) {
    worldClocks = loadJSON(STORAGE_WORLD_CLOCKS, ['America/New_York', 'Europe/London', 'Asia/Tokyo']);

    const addBar = el('div', { className: 'wc-add' });
    const tzSelect = el('select', { className: 'xp-select' });
    for (const tz of TIMEZONES)
      tzSelect.appendChild(el('option', { value: tz.tz, textContent: tz.label }));
    const addBtn = el('button', { className: 'xp-btn', textContent: 'Add' });
    addBar.appendChild(tzSelect);
    addBar.appendChild(addBtn);
    panel.appendChild(addBar);

    /* World map */
    const mapWrap = el('div', { className: 'wc-map-wrap' });
    mapWrap.appendChild(createWorldMap());
    panel.appendChild(mapWrap);

    wcListEl = el('div', { className: 'wc-list' });
    panel.appendChild(wcListEl);

    addBtn.addEventListener('pointerdown', () => {
      const tz = tzSelect.value;
      if (worldClocks.includes(tz)) return;
      worldClocks.push(tz);
      saveJSON(STORAGE_WORLD_CLOCKS, worldClocks);
      renderWorldClocks();
    });

    renderWorldClocks();
    setInterval(updateWorldClocks, 1000);
  }

  function getTimezoneLabel(tz) {
    const entry = TIMEZONES.find(t => t.tz === tz);
    return entry ? entry.label : tz;
  }

  function getTimeInZone(tz) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
      return formatter.format(now);
    } catch {
      return '--:--:--';
    }
  }

  function getOffsetFromLocal(tz) {
    try {
      const now = new Date();
      const localOffset = now.getTimezoneOffset();
      const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const diff = Math.round(((tzTime - now) / 60000 + localOffset));
      const hours = Math.floor(Math.abs(diff) / 60);
      const mins = Math.round(Math.abs(diff) % 60);
      const sign = diff >= 0 ? '+' : '-';
      return sign + hours + (mins > 0 ? ':' + pad2(mins) : '') + 'h';
    } catch {
      return '';
    }
  }

  function renderWorldClocks() {
    if (!wcListEl) return;
    wcListEl.innerHTML = '';
    for (const tz of worldClocks) {
      const card = el('div', { className: 'wc-card' });
      card.dataset.tz = tz;

      const removeBtn = el('button', { className: 'wc-remove', textContent: '\u2715' });
      removeBtn.addEventListener('pointerdown', () => {
        worldClocks = worldClocks.filter(t => t !== tz);
        saveJSON(STORAGE_WORLD_CLOCKS, worldClocks);
        renderWorldClocks();
      });
      card.appendChild(removeBtn);

      card.appendChild(el('div', { className: 'wc-name', textContent: getTimezoneLabel(tz) }));

      // Mini analog clock
      const miniClock = el('div', { className: 'wc-mini-clock' });
      const hHand = el('div', { className: 'clock-hand hour' });
      const mHand = el('div', { className: 'clock-hand minute' });
      miniClock.appendChild(hHand);
      miniClock.appendChild(mHand);
      miniClock.appendChild(el('div', { className: 'clock-center' }));
      card.appendChild(miniClock);

      card.appendChild(el('div', { className: 'wc-time', textContent: getTimeInZone(tz) }));
      card.appendChild(el('div', { className: 'wc-offset', textContent: getOffsetFromLocal(tz) }));
      wcListEl.appendChild(card);
    }
    updateMapMarkers();
    updateWorldClocks();
  }

  function updateWorldClocks() {
    if (!wcListEl) return;
    const cards = wcListEl.querySelectorAll('.wc-card');
    for (const card of cards) {
      const tz = card.dataset.tz;
      const timeEl = card.querySelector('.wc-time');
      const offsetEl = card.querySelector('.wc-offset');
      if (timeEl) timeEl.textContent = getTimeInZone(tz);
      if (offsetEl) offsetEl.textContent = getOffsetFromLocal(tz);

      // Update mini clock hands
      try {
        const now = new Date();
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
        const h = tzTime.getHours();
        const m = tzTime.getMinutes();
        const hDeg = ((h % 12) + m / 60) * 30;
        const mDeg = m * 6;
        const hHand = card.querySelector('.clock-hand.hour');
        const mHand = card.querySelector('.clock-hand.minute');
        if (hHand) hHand.style.transform = `rotate(${hDeg}deg)`;
        if (mHand) mHand.style.transform = `rotate(${mDeg}deg)`;
      } catch { /* timezone unsupported */ }
    }
    updateNightShade();
  }

  // ================================================================
  // Wire up tabs
  // ================================================================

  addTab('Date & Time', buildDateTimeTab);
  addTab('Alarms', buildAlarmsTab);
  addTab('Stopwatch', buildStopwatchTab);
  addTab('Timer', buildTimerTab);
  addTab('World Clock', buildWorldClockTab);

  // ================================================================
  // Init
  // ================================================================
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    switchTab(0);
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
