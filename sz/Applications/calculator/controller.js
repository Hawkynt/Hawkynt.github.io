;(function() {
  'use strict';

  const MAX_DIGITS = 16;
  const display = document.getElementById('display');
  const buttonArea = document.getElementById('button-area');
  const menuBar = document.getElementById('menu-bar');
  const baseDisplay = document.getElementById('base-display');
  const bitDisplayEl = document.getElementById('bit-display');
  const programmerSelectors = document.getElementById('programmer-selectors');
  const angleToggle = document.getElementById('angle-toggle');

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let currentMode = 'standard';
  let currentValue = '0';
  let accumulator = null;
  let pendingOp = null;
  let resetOnNextDigit = false;
  let memory = 0;
  let hasError = false;

  // Scientific state
  let angleUnit = 'deg'; // 'deg' or 'rad'

  // Programmer state
  let currentBase = 10;
  let wordSize = 32;
  let openMenu = null;

  // Expression stack for parentheses (scientific mode)
  const parenStack = [];

  // -----------------------------------------------------------------------
  // Utility: two's complement integer handling
  // -----------------------------------------------------------------------
  const WORD_MASKS = {
    8: 0xFFn,
    16: 0xFFFFn,
    32: 0xFFFFFFFFn,
    64: 0xFFFFFFFFFFFFFFFFn
  };

  function clampToWordSize(val) {
    const mask = WORD_MASKS[wordSize];
    let big = BigInt(Math.trunc(val));
    big = big & mask;
    return big;
  }

  function bigIntToSigned(big) {
    const mask = WORD_MASKS[wordSize];
    big = big & mask;
    const signBit = 1n << BigInt(wordSize - 1);
    if (big & signBit)
      return Number(big - (mask + 1n));
    return Number(big);
  }

  function getCurrentIntValue() {
    if (hasError)
      return 0;
    const parsed = parseInt(currentValue, currentBase);
    if (isNaN(parsed))
      return 0;
    return bigIntToSigned(clampToWordSize(parsed));
  }

  function formatIntForBase(val, base) {
    const mask = WORD_MASKS[wordSize];
    let big = BigInt(Math.trunc(val)) & mask;
    return big.toString(base).toUpperCase();
  }

  // -----------------------------------------------------------------------
  // Display
  // -----------------------------------------------------------------------
  function updateDisplay(text) {
    if (text === undefined || text === null)
      text = currentValue;

    display.textContent = text;

    const container = document.getElementById('display-container');
    const maxWidth = container.clientWidth - 8;
    let fontSize = 20;
    display.style.fontSize = fontSize + 'px';

    while (display.scrollWidth > maxWidth && fontSize > 8) {
      --fontSize;
      display.style.fontSize = fontSize + 'px';
    }

    if (currentMode === 'programmer')
      updateBaseDisplay();
  }

  function updateBaseDisplay() {
    const val = getCurrentIntValue();
    document.getElementById('base-hex').textContent = formatIntForBase(val, 16);
    document.getElementById('base-dec').textContent = formatIntForBase(val, 10);
    document.getElementById('base-oct').textContent = formatIntForBase(val, 8);
    document.getElementById('base-bin').textContent = formatIntForBase(val, 2);
    updateBitDisplay();
  }

  function updateBitDisplay() {
    const val = getCurrentIntValue();
    const mask = WORD_MASKS[wordSize];
    const big = BigInt(Math.trunc(val)) & mask;

    bitDisplayEl.innerHTML = '';
    for (let g = wordSize - 4; g >= 0; g -= 4) {
      const group = document.createElement('div');
      group.className = 'bit-group';

      const label = document.createElement('div');
      label.className = 'bit-group-label';
      label.textContent = g + 3;
      group.appendChild(label);

      const bits = document.createElement('div');
      bits.className = 'bit-group-bits';

      for (let b = 3; b >= 0; --b) {
        const bitIndex = g + b;
        const cell = document.createElement('div');
        const isOn = (big >> BigInt(bitIndex)) & 1n;
        cell.className = 'bit-cell' + (isOn ? ' on' : '');
        cell.textContent = isOn ? '1' : '0';
        cell.dataset.bit = bitIndex;
        cell.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          toggleBit(bitIndex);
        });
        bits.appendChild(cell);
      }
      group.appendChild(bits);
      bitDisplayEl.appendChild(group);
    }
  }

  function toggleBit(bitIndex) {
    let val = getCurrentIntValue();
    const mask = WORD_MASKS[wordSize];
    let big = BigInt(Math.trunc(val)) & mask;
    big ^= (1n << BigInt(bitIndex));
    const signed = bigIntToSigned(big);
    currentValue = formatIntForBase(signed, currentBase);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function formatNumber(num) {
    if (!isFinite(num))
      return 'Error';

    const str = String(num);
    if (str.length <= MAX_DIGITS)
      return str;

    const exp = num.toExponential(MAX_DIGITS - 6);
    if (exp.length <= MAX_DIGITS)
      return exp;

    return num.toPrecision(MAX_DIGITS - 4);
  }

  function clearError() {
    hasError = false;
  }

  // -----------------------------------------------------------------------
  // Standard operations
  // -----------------------------------------------------------------------
  function performOperation(op, a, b) {
    // Bitwise binary operations (programmer mode)
    const bitwiseOps = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'LSH', 'RSH', 'ROL', 'ROR'];
    if (bitwiseOps.includes(op))
      return performBitwiseOp(op, a, b);

    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) return NaN;
        return a / b;
      case 'mod':
        if (b === 0) return NaN;
        return a % b;
      case 'pow': return Math.pow(a, b);
      case 'yroot':
        if (b === 0) return NaN;
        return Math.pow(a, 1 / b);
      default: return b;
    }
  }

  // -----------------------------------------------------------------------
  // Programmer bitwise operations
  // -----------------------------------------------------------------------
  function performBitwiseOp(op, a, b) {
    const mask = WORD_MASKS[wordSize];
    let ba = BigInt(Math.trunc(a)) & mask;
    let bb = (b !== undefined) ? BigInt(Math.trunc(b)) & mask : 0n;
    let result;

    switch (op) {
      case 'AND': result = ba & bb; break;
      case 'OR': result = ba | bb; break;
      case 'XOR': result = ba ^ bb; break;
      case 'NOT': result = (~ba) & mask; break;
      case 'NAND': result = (~(ba & bb)) & mask; break;
      case 'NOR': result = (~(ba | bb)) & mask; break;
      case 'LSH': result = (ba << bb) & mask; break;
      case 'RSH': result = ba >> bb; break;
      case 'ROL': {
        const ws = BigInt(wordSize);
        const shift = bb % ws;
        result = ((ba << shift) | (ba >> (ws - shift))) & mask;
        break;
      }
      case 'ROR': {
        const ws = BigInt(wordSize);
        const shift = bb % ws;
        result = ((ba >> shift) | (ba << (ws - shift))) & mask;
        break;
      }
      default: result = ba; break;
    }
    return bigIntToSigned(result);
  }

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  function handleDigit(digit) {
    if (hasError) {
      clearError();
      currentValue = '0';
      accumulator = null;
      pendingOp = null;
    }

    if (currentMode === 'programmer') {
      const validDigits = getValidDigitsForBase();
      if (!validDigits.includes(digit.toUpperCase()))
        return;
    }

    if (resetOnNextDigit) {
      currentValue = '0';
      resetOnNextDigit = false;
    }

    if (currentValue === '0' && digit !== '0')
      currentValue = digit.toUpperCase();
    else if (currentValue === '0' && digit === '0')
      currentValue = '0';
    else
      currentValue = (currentValue + digit).toUpperCase();

    updateDisplay();
  }

  function getValidDigitsForBase() {
    switch (currentBase) {
      case 2: return ['0', '1'];
      case 8: return ['0', '1', '2', '3', '4', '5', '6', '7'];
      case 10: return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      case 16: return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
      default: return [];
    }
  }

  function handleDecimal() {
    if (currentMode === 'programmer')
      return;

    if (hasError) {
      clearError();
      currentValue = '0.';
      accumulator = null;
      pendingOp = null;
      updateDisplay();
      return;
    }

    if (resetOnNextDigit) {
      currentValue = '0.';
      resetOnNextDigit = false;
      updateDisplay();
      return;
    }

    if (!currentValue.includes('.'))
      currentValue += '.';

    updateDisplay();
  }

  function parseCurrentValue() {
    if (currentMode === 'programmer')
      return getCurrentIntValue();
    return parseFloat(currentValue);
  }

  function formatResult(num) {
    if (currentMode === 'programmer') {
      const clamped = bigIntToSigned(clampToWordSize(num));
      return formatIntForBase(clamped, currentBase);
    }
    return formatNumber(num);
  }

  function handleOperator(op) {
    if (hasError)
      return;

    const current = parseCurrentValue();

    if (accumulator !== null && pendingOp && !resetOnNextDigit) {
      const result = performOperation(pendingOp, accumulator, current);
      if (!isFinite(result)) {
        currentValue = 'Error';
        hasError = true;
        accumulator = null;
        pendingOp = null;
        resetOnNextDigit = true;
        updateDisplay('Error');
        return;
      }
      accumulator = (currentMode === 'programmer') ? bigIntToSigned(clampToWordSize(result)) : result;
      currentValue = formatResult(accumulator);
      updateDisplay();
    } else
      accumulator = current;

    pendingOp = op;
    resetOnNextDigit = true;
  }

  function handleEquals() {
    if (hasError)
      return;

    const current = parseCurrentValue();

    if (accumulator !== null && pendingOp) {
      const result = performOperation(pendingOp, accumulator, current);
      if (!isFinite(result)) {
        currentValue = 'Error';
        hasError = true;
        accumulator = null;
        pendingOp = null;
        resetOnNextDigit = true;
        updateDisplay('Error');
        return;
      }
      const finalResult = (currentMode === 'programmer') ? bigIntToSigned(clampToWordSize(result)) : result;
      currentValue = formatResult(finalResult);
      accumulator = null;
      pendingOp = null;
      resetOnNextDigit = true;
      updateDisplay();
    }
  }

  function handleClear() {
    currentValue = '0';
    accumulator = null;
    pendingOp = null;
    resetOnNextDigit = false;
    hasError = false;
    parenStack.length = 0;
    updateDisplay();
  }

  function handleClearEntry() {
    if (hasError) {
      handleClear();
      return;
    }
    currentValue = '0';
    resetOnNextDigit = false;
    updateDisplay();
  }

  function handleBackspace() {
    if (hasError || resetOnNextDigit)
      return;

    if (currentValue.length <= 1 || (currentValue.length === 2 && currentValue[0] === '-'))
      currentValue = '0';
    else
      currentValue = currentValue.slice(0, -1);

    updateDisplay();
  }

  function handleNegate() {
    if (hasError)
      return;

    if (currentMode === 'programmer') {
      const val = getCurrentIntValue();
      const negated = bigIntToSigned(clampToWordSize(-val));
      currentValue = formatIntForBase(negated, currentBase);
      resetOnNextDigit = true;
      updateDisplay();
      return;
    }

    if (currentValue === '0' || currentValue === '0.')
      return;

    if (currentValue[0] === '-')
      currentValue = currentValue.slice(1);
    else
      currentValue = '-' + currentValue;

    updateDisplay();
  }

  function handlePercent() {
    if (hasError || currentMode === 'programmer')
      return;

    const current = parseFloat(currentValue);
    if (accumulator !== null && pendingOp)
      currentValue = formatNumber(accumulator * current / 100);
    else
      currentValue = formatNumber(current / 100);

    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleSqrt() {
    if (hasError)
      return;

    const current = parseCurrentValue();
    if (current < 0) {
      currentValue = 'Error';
      hasError = true;
      resetOnNextDigit = true;
      updateDisplay('Error');
      return;
    }

    currentValue = formatResult(Math.sqrt(current));
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleReciprocal() {
    if (hasError)
      return;

    const current = parseCurrentValue();
    if (current === 0) {
      currentValue = 'Error';
      hasError = true;
      resetOnNextDigit = true;
      updateDisplay('Error');
      return;
    }

    currentValue = formatResult(1 / current);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleMemoryClear() { memory = 0; }

  function handleMemoryRecall() {
    if (hasError) {
      clearError();
      accumulator = null;
      pendingOp = null;
    }
    currentValue = formatResult(memory);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleMemoryStore() {
    if (hasError) return;
    memory = parseCurrentValue();
  }

  function handleMemoryAdd() {
    if (hasError) return;
    memory += parseCurrentValue();
  }

  function handleMemorySubtract() {
    if (hasError) return;
    memory -= parseCurrentValue();
  }

  // -----------------------------------------------------------------------
  // Scientific handlers
  // -----------------------------------------------------------------------
  function toRadians(val) {
    return angleUnit === 'deg' ? val * Math.PI / 180 : val;
  }

  function fromRadians(val) {
    return angleUnit === 'deg' ? val * 180 / Math.PI : val;
  }

  function handleScientific(action) {
    if (hasError) return;
    const current = parseFloat(currentValue);
    let result;

    switch (action) {
      case 'sin': result = Math.sin(toRadians(current)); break;
      case 'cos': result = Math.cos(toRadians(current)); break;
      case 'tan': result = Math.tan(toRadians(current)); break;
      case 'asin':
        if (current < -1 || current > 1) { setError(); return; }
        result = fromRadians(Math.asin(current));
        break;
      case 'acos':
        if (current < -1 || current > 1) { setError(); return; }
        result = fromRadians(Math.acos(current));
        break;
      case 'atan': result = fromRadians(Math.atan(current)); break;
      case 'log':
        if (current <= 0) { setError(); return; }
        result = Math.log10(current);
        break;
      case 'ln':
        if (current <= 0) { setError(); return; }
        result = Math.log(current);
        break;
      case 'exp': result = Math.exp(current); break;
      case '10x': result = Math.pow(10, current); break;
      case 'x2': result = current * current; break;
      case 'x3': result = current * current * current; break;
      case 'cbrt': result = Math.cbrt(current); break;
      case 'abs': result = Math.abs(current); break;
      case 'factorial':
        if (current < 0 || current !== Math.floor(current) || current > 170) { setError(); return; }
        result = factorial(current);
        break;
      case 'pi':
        currentValue = formatNumber(Math.PI);
        resetOnNextDigit = true;
        updateDisplay();
        return;
      case 'euler':
        currentValue = formatNumber(Math.E);
        resetOnNextDigit = true;
        updateDisplay();
        return;
      case 'paren-open':
        parenStack.push({ accumulator, pendingOp });
        accumulator = null;
        pendingOp = null;
        resetOnNextDigit = true;
        return;
      case 'paren-close':
        if (parenStack.length === 0) return;
        handleEquals();
        const frame = parenStack.pop();
        const val = parseFloat(currentValue);
        if (frame.pendingOp) {
          const r = performOperation(frame.pendingOp, frame.accumulator, val);
          if (!isFinite(r)) { setError(); return; }
          currentValue = formatNumber(r);
          accumulator = null;
          pendingOp = null;
        } else {
          accumulator = frame.accumulator;
          pendingOp = frame.pendingOp;
        }
        resetOnNextDigit = true;
        updateDisplay();
        return;
      default: return;
    }

    if (result === undefined || !isFinite(result)) {
      setError();
      return;
    }

    currentValue = formatNumber(result);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function setError() {
    currentValue = 'Error';
    hasError = true;
    accumulator = null;
    pendingOp = null;
    resetOnNextDigit = true;
    updateDisplay('Error');
  }

  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; ++i)
      result *= i;
    return result;
  }

  // -----------------------------------------------------------------------
  // Programmer-specific handlers
  // -----------------------------------------------------------------------
  function handleBitwiseUnary(op) {
    if (hasError) return;
    const current = getCurrentIntValue();
    const result = performBitwiseOp(op, current);
    currentValue = formatIntForBase(result, currentBase);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleBitwiseBinary(op) {
    if (hasError) return;
    handleOperator(op);
  }

  function handleBaseChange(newBase) {
    const val = getCurrentIntValue();
    currentBase = newBase;
    currentValue = formatIntForBase(val, currentBase);
    updateDisplay();
    updateProgrammerButtons();
  }

  function handleWordSizeChange(newSize) {
    wordSize = newSize;
    const val = getCurrentIntValue();
    currentValue = formatIntForBase(val, currentBase);
    resetOnNextDigit = true;
    updateDisplay();
    rebuildBitDisplay();
  }

  function rebuildBitDisplay() {
    updateBitDisplay();
  }

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;
      if (openMenu === menuItem) {
        closeMenus();
        return;
      }
      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });

    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleMenuAction(action, entry);
    });
  }

  function handleMenuAction(action, entry) {
    if (action === 'mode-standard')
      switchMode('standard');
    else if (action === 'mode-scientific')
      switchMode('scientific');
    else if (action === 'mode-programmer')
      switchMode('programmer');
    else if (action === 'about')
      SZ.Dlls.User32.MessageBox('Calculator\nA multi-mode calculator.', 'About Calculator', MB_OK | MB_ICONINFORMATION);
  }

  // -----------------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------------
  const MODE_SIZES = {
    standard: { width: 260, height: 340 },
    scientific: { width: 420, height: 400 },
    programmer: { width: 460, height: 480 }
  };

  const MODE_TITLES = {
    standard: 'Calculator',
    scientific: 'Calculator - Scientific',
    programmer: 'Calculator - Programmer'
  };

  function switchMode(mode) {
    if (mode === currentMode) return;

    // Preserve the displayed value when switching
    let preservedValue;
    if (currentMode === 'programmer') {
      preservedValue = getCurrentIntValue();
    } else {
      preservedValue = parseFloat(currentValue);
      if (isNaN(preservedValue)) preservedValue = 0;
    }

    currentMode = mode;

    // Update menu radio checks
    for (const entry of document.querySelectorAll('.menu-entry.radio'))
      entry.classList.toggle('checked', entry.dataset.mode === mode);

    // Set body class
    document.body.className = 'mode-' + mode;

    // Show/hide mode-specific UI
    baseDisplay.classList.toggle('hidden', mode !== 'programmer');
    bitDisplayEl.classList.toggle('hidden', mode !== 'programmer');
    programmerSelectors.classList.toggle('hidden', mode !== 'programmer');
    angleToggle.classList.toggle('hidden', mode !== 'scientific');

    // Restore value in new mode
    if (mode === 'programmer') {
      currentBase = 10;
      const radio = document.querySelector('input[name="base"][value="10"]');
      if (radio) radio.checked = true;
      const intVal = Math.trunc(preservedValue);
      currentValue = formatIntForBase(bigIntToSigned(clampToWordSize(intVal)), currentBase);
    } else {
      currentValue = formatNumber(preservedValue);
    }

    // Reset operator state but keep display value
    accumulator = null;
    pendingOp = null;
    resetOnNextDigit = true;
    parenStack.length = 0;

    // Rebuild buttons for the new mode
    buildButtons();

    // Resize window
    const size = MODE_SIZES[mode];
    SZ.Dlls.User32.MoveWindow(size.width, size.height);
    SZ.Dlls.User32.SetWindowText(MODE_TITLES[mode]);

    updateDisplay();
  }

  // -----------------------------------------------------------------------
  // Button definitions and building
  // -----------------------------------------------------------------------

  // Each button: { label, action, value?, cls?, span?, disabled? }
  function getStandardButtons() {
    return [
      // Row 1: Memory
      { label: 'MC', action: 'memory-clear', cls: 'special' },
      { label: 'MR', action: 'memory-recall', cls: 'special' },
      { label: 'MS', action: 'memory-store', cls: 'special' },
      { label: 'M+', action: 'memory-add', cls: 'special' },
      // Row 2: editing
      { label: '\u2190', action: 'backspace', cls: 'op' },
      { label: 'CE', action: 'clear-entry', cls: 'op' },
      { label: 'C', action: 'clear', cls: 'op' },
      { label: '\u00B1', action: 'negate', cls: 'op' },
      // Row 3: 7 8 9 /
      { label: '7', action: 'digit', value: '7' },
      { label: '8', action: 'digit', value: '8' },
      { label: '9', action: 'digit', value: '9' },
      { label: '\u00F7', action: 'operator', value: '/', cls: 'op' },
      // Row 4: 4 5 6 *
      { label: '4', action: 'digit', value: '4' },
      { label: '5', action: 'digit', value: '5' },
      { label: '6', action: 'digit', value: '6' },
      { label: '\u00D7', action: 'operator', value: '*', cls: 'op' },
      // Row 5: 1 2 3 -
      { label: '1', action: 'digit', value: '1' },
      { label: '2', action: 'digit', value: '2' },
      { label: '3', action: 'digit', value: '3' },
      { label: '\u2212', action: 'operator', value: '-', cls: 'op' },
      // Row 6: 0 . % +
      { label: '0', action: 'digit', value: '0' },
      { label: '.', action: 'decimal' },
      { label: '%', action: 'percent', cls: 'op' },
      { label: '+', action: 'operator', value: '+', cls: 'op' },
      // Row 7: sqrt 1/x = (span 2)
      { label: '\u221A', action: 'sqrt', cls: 'op' },
      { label: '1/x', action: 'reciprocal', cls: 'op' },
      { label: '=', action: 'equals', cls: 'equals', span: 2 },
    ];
  }

  function getScientificButtons() {
    // 8-column grid: 4 sci columns on left, 4 standard columns on right
    // We interleave rows: each row is [sci1, sci2, sci3, sci4, std1, std2, std3, std4]
    const rows = [];

    // Row 1: sci functions + memory
    rows.push(
      { label: 'MC', action: 'memory-clear', cls: 'special' },
      { label: 'MR', action: 'memory-recall', cls: 'special' },
      { label: 'M+', action: 'memory-add', cls: 'special' },
      { label: 'M\u2212', action: 'memory-subtract', cls: 'special' },
      { label: 'MS', action: 'memory-store', cls: 'special' },
      { label: '\u2190', action: 'backspace', cls: 'op' },
      { label: 'CE', action: 'clear-entry', cls: 'op' },
      { label: 'C', action: 'clear', cls: 'op' },
    );

    // Row 2: trig + editing
    rows.push(
      { label: 'sin', action: 'scientific', value: 'sin', cls: 'sci' },
      { label: 'cos', action: 'scientific', value: 'cos', cls: 'sci' },
      { label: 'tan', action: 'scientific', value: 'tan', cls: 'sci' },
      { label: 'n!', action: 'scientific', value: 'factorial', cls: 'sci' },
      { label: '\u00B1', action: 'negate', cls: 'op' },
      { label: '(', action: 'scientific', value: 'paren-open', cls: 'op' },
      { label: ')', action: 'scientific', value: 'paren-close', cls: 'op' },
      { label: 'mod', action: 'operator', value: 'mod', cls: 'op' },
    );

    // Row 3: inverse trig + 7 8 9 /
    rows.push(
      { label: 'asin', action: 'scientific', value: 'asin', cls: 'sci' },
      { label: 'acos', action: 'scientific', value: 'acos', cls: 'sci' },
      { label: 'atan', action: 'scientific', value: 'atan', cls: 'sci' },
      { label: '\u03C0', action: 'scientific', value: 'pi', cls: 'sci' },
      { label: '7', action: 'digit', value: '7' },
      { label: '8', action: 'digit', value: '8' },
      { label: '9', action: 'digit', value: '9' },
      { label: '\u00F7', action: 'operator', value: '/', cls: 'op' },
    );

    // Row 4: log/exp + 4 5 6 *
    rows.push(
      { label: 'log', action: 'scientific', value: 'log', cls: 'sci' },
      { label: 'ln', action: 'scientific', value: 'ln', cls: 'sci' },
      { label: 'e\u02E3', action: 'scientific', value: 'exp', cls: 'sci' },
      { label: 'e', action: 'scientific', value: 'euler', cls: 'sci' },
      { label: '4', action: 'digit', value: '4' },
      { label: '5', action: 'digit', value: '5' },
      { label: '6', action: 'digit', value: '6' },
      { label: '\u00D7', action: 'operator', value: '*', cls: 'op' },
    );

    // Row 5: power + 1 2 3 -
    rows.push(
      { label: 'x\u00B2', action: 'scientific', value: 'x2', cls: 'sci' },
      { label: 'x\u00B3', action: 'scientific', value: 'x3', cls: 'sci' },
      { label: 'x\u02B8', action: 'operator', value: 'pow', cls: 'sci' },
      { label: '10\u02E3', action: 'scientific', value: '10x', cls: 'sci' },
      { label: '1', action: 'digit', value: '1' },
      { label: '2', action: 'digit', value: '2' },
      { label: '3', action: 'digit', value: '3' },
      { label: '\u2212', action: 'operator', value: '-', cls: 'op' },
    );

    // Row 6: roots/abs + 0 . % +
    rows.push(
      { label: '\u221Ax', action: 'sqrt', cls: 'sci' },
      { label: '\u00B3\u221Ax', action: 'scientific', value: 'cbrt', cls: 'sci' },
      { label: '\u02B8\u221Ax', action: 'operator', value: 'yroot', cls: 'sci' },
      { label: '|x|', action: 'scientific', value: 'abs', cls: 'sci' },
      { label: '0', action: 'digit', value: '0' },
      { label: '.', action: 'decimal' },
      { label: '%', action: 'percent', cls: 'op' },
      { label: '+', action: 'operator', value: '+', cls: 'op' },
    );

    // Row 7: 1/x + = (span 2)
    rows.push(
      { label: '1/x', action: 'reciprocal', cls: 'sci' },
      { label: '', action: 'none', cls: 'sci', disabled: true },
      { label: '', action: 'none', cls: 'sci', disabled: true },
      { label: '', action: 'none', cls: 'sci', disabled: true },
      { label: '\u221A', action: 'sqrt', cls: 'op' },
      { label: '1/x', action: 'reciprocal', cls: 'op' },
      { label: '=', action: 'equals', cls: 'equals', span: 2 },
    );

    return rows;
  }

  function getProgrammerButtons() {
    // 8-column grid: 4 bitwise columns on left, 4 standard columns on right
    const rows = [];

    // Row 1: bitwise ops + editing
    rows.push(
      { label: 'AND', action: 'bitwise-binary', value: 'AND', cls: 'prog' },
      { label: 'OR', action: 'bitwise-binary', value: 'OR', cls: 'prog' },
      { label: 'NOT', action: 'bitwise-unary', value: 'NOT', cls: 'prog' },
      { label: 'XOR', action: 'bitwise-binary', value: 'XOR', cls: 'prog' },
      { label: '\u2190', action: 'backspace', cls: 'op' },
      { label: 'CE', action: 'clear-entry', cls: 'op' },
      { label: 'C', action: 'clear', cls: 'op' },
      { label: '\u00B1', action: 'negate', cls: 'op' },
    );

    // Row 2: more bitwise + A B C /
    rows.push(
      { label: 'NAND', action: 'bitwise-binary', value: 'NAND', cls: 'prog' },
      { label: 'NOR', action: 'bitwise-binary', value: 'NOR', cls: 'prog' },
      { label: 'LSH', action: 'bitwise-binary', value: 'LSH', cls: 'prog' },
      { label: 'RSH', action: 'bitwise-binary', value: 'RSH', cls: 'prog' },
      { label: 'A', action: 'digit', value: 'A', cls: 'hex-digit', id: 'hex-a' },
      { label: 'B', action: 'digit', value: 'B', cls: 'hex-digit', id: 'hex-b' },
      { label: 'C', action: 'digit', value: 'C', cls: 'hex-digit', id: 'hex-c' },
      { label: '\u00F7', action: 'operator', value: '/', cls: 'op' },
    );

    // Row 3: rotate + D E F *
    rows.push(
      { label: 'ROL', action: 'bitwise-binary', value: 'ROL', cls: 'prog' },
      { label: 'ROR', action: 'bitwise-binary', value: 'ROR', cls: 'prog' },
      { label: 'mod', action: 'operator', value: 'mod', cls: 'prog' },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: 'D', action: 'digit', value: 'D', cls: 'hex-digit', id: 'hex-d' },
      { label: 'E', action: 'digit', value: 'E', cls: 'hex-digit', id: 'hex-e' },
      { label: 'F', action: 'digit', value: 'F', cls: 'hex-digit', id: 'hex-f' },
      { label: '\u00D7', action: 'operator', value: '*', cls: 'op' },
    );

    // Row 4: empty + 7 8 9 -
    rows.push(
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '7', action: 'digit', value: '7' },
      { label: '8', action: 'digit', value: '8' },
      { label: '9', action: 'digit', value: '9' },
      { label: '\u2212', action: 'operator', value: '-', cls: 'op' },
    );

    // Row 5: empty + 4 5 6 +
    rows.push(
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '4', action: 'digit', value: '4' },
      { label: '5', action: 'digit', value: '5' },
      { label: '6', action: 'digit', value: '6' },
      { label: '+', action: 'operator', value: '+', cls: 'op' },
    );

    // Row 6: empty + 1 2 3 =
    rows.push(
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '1', action: 'digit', value: '1' },
      { label: '2', action: 'digit', value: '2' },
      { label: '3', action: 'digit', value: '3' },
      { label: '=', action: 'equals', cls: 'equals' },
    );

    // Row 7: empty + 0 (span 2) . =
    rows.push(
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '', action: 'none', cls: 'prog', disabled: true },
      { label: '0', action: 'digit', value: '0', span: 2 },
      { label: '.', action: 'decimal', disabled: true },
      { label: '%', action: 'percent', cls: 'op', disabled: true },
    );

    return rows;
  }

  function buildButtons() {
    buttonArea.innerHTML = '';
    let buttons;

    switch (currentMode) {
      case 'standard': buttons = getStandardButtons(); break;
      case 'scientific': buttons = getScientificButtons(); break;
      case 'programmer': buttons = getProgrammerButtons(); break;
    }

    for (const def of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (def.cls)
        btn.className += ' ' + def.cls;
      if (def.span)
        btn.className += ' span' + def.span;
      if (def.disabled)
        btn.disabled = true;
      if (def.id)
        btn.id = def.id;

      btn.textContent = def.label;
      btn.dataset.action = def.action;
      if (def.value !== undefined)
        btn.dataset.value = def.value;

      buttonArea.appendChild(btn);
    }

    if (currentMode === 'programmer')
      updateProgrammerButtons();
  }

  function updateProgrammerButtons() {
    const hexDigits = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (const btn of buttonArea.querySelectorAll('.btn[data-action="digit"]')) {
      const val = btn.dataset.value;
      if (!val) continue;
      if (hexDigits.includes(val))
        btn.disabled = currentBase < 16;
      else {
        const n = parseInt(val);
        btn.disabled = n >= currentBase;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Event delegation for dynamically built buttons
  // -----------------------------------------------------------------------
  buttonArea.addEventListener('pointerdown', function(e) {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled)
      return;

    e.preventDefault();
    const action = btn.dataset.action;
    const value = btn.dataset.value;

    switch (action) {
      case 'digit': handleDigit(value); break;
      case 'decimal': handleDecimal(); break;
      case 'operator': handleOperator(value); break;
      case 'equals': handleEquals(); break;
      case 'clear': handleClear(); break;
      case 'clear-entry': handleClearEntry(); break;
      case 'backspace': handleBackspace(); break;
      case 'negate': handleNegate(); break;
      case 'percent': handlePercent(); break;
      case 'sqrt': handleSqrt(); break;
      case 'reciprocal': handleReciprocal(); break;
      case 'memory-clear': handleMemoryClear(); break;
      case 'memory-recall': handleMemoryRecall(); break;
      case 'memory-store': handleMemoryStore(); break;
      case 'memory-add': handleMemoryAdd(); break;
      case 'memory-subtract': handleMemorySubtract(); break;
      case 'scientific': handleScientific(value); break;
      case 'bitwise-unary': handleBitwiseUnary(value); break;
      case 'bitwise-binary': handleBitwiseBinary(value); break;
    }
  });

  // -----------------------------------------------------------------------
  // Programmer selectors
  // -----------------------------------------------------------------------
  programmerSelectors.addEventListener('change', (e) => {
    const target = e.target;
    if (target.name === 'base')
      handleBaseChange(parseInt(target.value));
    else if (target.name === 'wordsize')
      handleWordSizeChange(parseInt(target.value));
  });

  // Scientific angle toggle
  angleToggle.addEventListener('change', (e) => {
    if (e.target.name === 'angle')
      angleUnit = e.target.value;
  });

  // -----------------------------------------------------------------------
  // Keyboard support
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', function(e) {
    const key = e.key;

    if (key >= '0' && key <= '9') {
      e.preventDefault();
      handleDigit(key);
    } else if (currentMode === 'programmer' && currentBase === 16 && /^[a-fA-F]$/.test(key)) {
      e.preventDefault();
      handleDigit(key.toUpperCase());
    } else if (key === '.') {
      e.preventDefault();
      handleDecimal();
    } else if (key === '+') {
      e.preventDefault();
      handleOperator('+');
    } else if (key === '-') {
      e.preventDefault();
      handleOperator('-');
    } else if (key === '*') {
      e.preventDefault();
      handleOperator('*');
    } else if (key === '/') {
      e.preventDefault();
      handleOperator('/');
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleEquals();
    } else if (key === 'Escape') {
      e.preventDefault();
      handleClear();
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (key === '%') {
      e.preventDefault();
      handlePercent();
    } else if (key === 'Delete') {
      e.preventDefault();
      handleClearEntry();
    } else if (key === 'F9') {
      e.preventDefault();
      handleNegate();
    } else if (key === '(' && currentMode === 'scientific') {
      e.preventDefault();
      handleScientific('paren-open');
    } else if (key === ')' && currentMode === 'scientific') {
      e.preventDefault();
      handleScientific('paren-close');
    }
  });

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    document.body.className = 'mode-standard';
    buildButtons();
    updateDisplay();
  }

  init();
})();
