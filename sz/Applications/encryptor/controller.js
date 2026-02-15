;(function() {
  'use strict';

  const keyEl = document.getElementById('key');
  const inputEl = document.getElementById('input');
  const outputEl = document.getElementById('output');

  function xorEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; ++i)
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return result;
  }

  function toHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; ++i)
      hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    return hex;
  }

  function fromHex(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2)
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
  }

  function flashError(el) {
    el.classList.remove('input-error');
    void el.offsetWidth;
    el.classList.add('input-error');
  }

  function validateKey() {
    const key = keyEl.value;
    if (!key) {
      flashError(keyEl);
      return null;
    }
    return key;
  }

  function isValidHex(str) {
    if (str.length === 0)
      return false;
    if (str.length % 2 !== 0)
      return false;
    return /^[0-9a-fA-F]+$/.test(str);
  }

  function setOutputError(message) {
    outputEl.value = message;
    outputEl.classList.add('output-error');
  }

  function setOutput(value) {
    outputEl.classList.remove('output-error');
    outputEl.value = value;
  }

  document.getElementById('btn-encrypt').addEventListener('click', () => {
    const key = validateKey();
    if (!key)
      return;
    setOutput(toHex(xorEncrypt(inputEl.value, key)));
  });

  document.getElementById('btn-decrypt').addEventListener('click', () => {
    const key = validateKey();
    if (!key)
      return;

    const hex = inputEl.value.trim();
    if (!isValidHex(hex)) {
      let reason = 'Invalid hex input: ';
      if (hex.length === 0)
        reason += 'input is empty.';
      else if (hex.length % 2 !== 0)
        reason += 'odd number of characters (must be even).';
      else
        reason += 'contains non-hex characters.';
      setOutputError(reason);
      return;
    }

    setOutput(xorEncrypt(fromHex(hex), key));
  });

  document.getElementById('btn-swap').addEventListener('click', () => {
    const tmp = inputEl.value;
    inputEl.value = outputEl.value;
    setOutput(tmp);
  });

  document.getElementById('btn-copy').addEventListener('click', () => {
    if (!outputEl.value)
      return;
    navigator.clipboard.writeText(outputEl.value).catch(() => {
      outputEl.select();
      document.execCommand('copy');
    });
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    keyEl.value = '';
    inputEl.value = '';
    setOutput('');
  });

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
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
