;(function() {
  'use strict';

  const MAX_DIGITS = 16;
  const display = document.getElementById('display');

  let currentValue = '0';
  let accumulator = null;
  let pendingOp = null;
  let resetOnNextDigit = false;
  let memory = 0;
  let hasError = false;

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

  function performOperation(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0)
          return NaN;
        return a / b;
      default: return b;
    }
  }

  function handleDigit(digit) {
    if (hasError) {
      clearError();
      currentValue = '0';
      accumulator = null;
      pendingOp = null;
    }

    if (resetOnNextDigit) {
      currentValue = '0';
      resetOnNextDigit = false;
    }

    if (currentValue === '0' && digit !== '0')
      currentValue = digit;
    else if (currentValue === '0' && digit === '0')
      currentValue = '0';
    else if (currentValue.replace(/[^0-9]/g, '').length < MAX_DIGITS)
      currentValue += digit;

    updateDisplay();
  }

  function handleDecimal() {
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

  function handleOperator(op) {
    if (hasError)
      return;

    const current = parseFloat(currentValue);

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
      accumulator = result;
      currentValue = formatNumber(result);
      updateDisplay();
    } else
      accumulator = current;

    pendingOp = op;
    resetOnNextDigit = true;
  }

  function handleEquals() {
    if (hasError)
      return;

    const current = parseFloat(currentValue);

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
      currentValue = formatNumber(result);
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
    if (hasError || currentValue === '0' || currentValue === '0.')
      return;

    if (currentValue[0] === '-')
      currentValue = currentValue.slice(1);
    else
      currentValue = '-' + currentValue;

    updateDisplay();
  }

  function handlePercent() {
    if (hasError)
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

    const current = parseFloat(currentValue);
    if (current < 0) {
      currentValue = 'Error';
      hasError = true;
      resetOnNextDigit = true;
      updateDisplay('Error');
      return;
    }

    currentValue = formatNumber(Math.sqrt(current));
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleReciprocal() {
    if (hasError)
      return;

    const current = parseFloat(currentValue);
    if (current === 0) {
      currentValue = 'Error';
      hasError = true;
      resetOnNextDigit = true;
      updateDisplay('Error');
      return;
    }

    currentValue = formatNumber(1 / current);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleMemoryClear() {
    memory = 0;
  }

  function handleMemoryRecall() {
    if (hasError) {
      clearError();
      accumulator = null;
      pendingOp = null;
    }
    currentValue = formatNumber(memory);
    resetOnNextDigit = true;
    updateDisplay();
  }

  function handleMemoryStore() {
    if (hasError)
      return;
    memory = parseFloat(currentValue);
  }

  function handleMemoryAdd() {
    if (hasError)
      return;
    memory += parseFloat(currentValue);
  }

  // Button click handling via event delegation
  document.body.addEventListener('pointerdown', function(e) {
    const btn = e.target.closest('.btn');
    if (!btn)
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
    }
  });

  // Keyboard support
  document.addEventListener('keydown', function(e) {
    const key = e.key;

    if (key >= '0' && key <= '9') {
      e.preventDefault();
      handleDigit(key);
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
    }
  });

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    updateDisplay();
  }

  init();
})();
