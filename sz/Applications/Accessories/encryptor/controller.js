;(function() {
  'use strict';

  const keyEl = document.getElementById('key');
  const inputEl = document.getElementById('input');
  const outputEl = document.getElementById('output');

  // Text is encrypted with AES-256-GCM. The key is derived from the
  // passphrase with PBKDF2-SHA-256 and a random salt; output is
  // "sze1:" + base64(salt | iv | ciphertext and tag).
  const PREFIX = 'sze1:';
  const ITERATIONS = 250000;
  const SALT_BYTES = 16, IV_BYTES = 12;

  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function fromBase64(text) {
    const bin = atob(text);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i)
      bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encrypt(text, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt);
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
    const out = new Uint8Array(SALT_BYTES + IV_BYTES + sealed.length);
    out.set(salt, 0);
    out.set(iv, SALT_BYTES);
    out.set(sealed, SALT_BYTES + IV_BYTES);
    return PREFIX + toBase64(out);
  }

  async function decrypt(text, passphrase) {
    const data = fromBase64(text.slice(PREFIX.length).replace(/\s+/g, ''));
    if (data.length < SALT_BYTES + IV_BYTES + 16)
      throw new Error('The encrypted text is incomplete.');
    const key = await deriveKey(passphrase, data.subarray(0, SALT_BYTES));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES) }, key, data.subarray(SALT_BYTES + IV_BYTES));
    return new TextDecoder().decode(plain);
  }

  // Older versions wrote XOR'ed characters as two hex digits each; such
  // text can still be decrypted.
  function legacyDecrypt(hex, key) {
    let result = '';
    for (let i = 0; i < hex.length; i += 2)
      result += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key.charCodeAt((i / 2) % key.length));
    return result;
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

  function isLegacyHex(str) {
    return str.length > 0 && str.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(str);
  }

  const cryptoAvailable = !!(window.crypto && crypto.subtle && window.TextEncoder);

  function setOutputError(message) {
    outputEl.value = message;
    outputEl.classList.add('output-error');
  }

  function setOutput(value) {
    outputEl.classList.remove('output-error');
    outputEl.value = value;
  }

  let busy = false;
  async function run(action) {
    const key = validateKey();
    if (!key || busy)
      return;
    if (!cryptoAvailable) {
      setOutputError('This browser offers no Web Crypto here (it needs https or a local page).');
      return;
    }
    busy = true;
    document.body.style.cursor = 'progress';
    try {
      setOutput(await action(key));
    } catch (err) {
      setOutputError(err && err.message ? err.message : String(err));
    } finally {
      busy = false;
      document.body.style.cursor = '';
    }
  }

  document.getElementById('btn-encrypt').addEventListener('click', () => run(key => encrypt(inputEl.value, key)));

  document.getElementById('btn-decrypt').addEventListener('click', () => run(async key => {
    const text = inputEl.value.trim();
    if (!text)
      throw new Error('Nothing to decrypt: the input is empty.');
    if (text.startsWith(PREFIX)) {
      try {
        return await decrypt(text, key);
      } catch (err) {
        if (err && err.name === 'OperationError')
          throw new Error('Cannot decrypt: wrong key, or the text was changed.');
        if (err && err.name === 'InvalidCharacterError')
          throw new Error('Cannot decrypt: the text is not valid encrypted output.');
        throw err;
      }
    }
    if (isLegacyHex(text))
      return legacyDecrypt(text, key);
    throw new Error('Cannot decrypt: this is not encrypted output (it starts with "' + PREFIX + '").');
  }));

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
  new SZ.MenuBar({ onAction: (action) => {
    if (action === 'about')
      SZ.Dialog.show('dlg-about');
  }});

  SZ.Dialog.wireAll();
})();
