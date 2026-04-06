;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const KEY_RING_SIZE = 256;
  const BUILD_PEPPER = 'TacticalRealms-v1-2024';

  function _generateKeyRing() {
    const ring = new Uint8Array(KEY_RING_SIZE * 32);
    let seed = 0x5f3759df;
    for (let i = 0; i < ring.length; ++i) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      ring[i] = (seed >>> 0) & 0xff;
    }
    return ring;
  }

  const KEY_RING = _generateKeyRing();

  function _getKeyBytes(index) {
    const offset = (index & 0xff) * 32;
    return KEY_RING.slice(offset, offset + 32);
  }

  function _pepperHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  function _xorObfuscate(data, keyIndex) {
    const key = _getKeyBytes(keyIndex);
    const pepperVal = _pepperHash(BUILD_PEPPER);
    const bytes = new TextEncoder().encode(data);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; ++i)
      out[i] = bytes[i] ^ key[i % key.length] ^ ((pepperVal >>> ((i % 4) * 8)) & 0xff);
    return out;
  }

  function _xorDeobfuscate(encrypted, keyIndex) {
    const key = _getKeyBytes(keyIndex);
    const pepperVal = _pepperHash(BUILD_PEPPER);
    const out = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; ++i)
      out[i] = encrypted[i] ^ key[i % key.length] ^ ((pepperVal >>> ((i % 4) * 8)) & 0xff);
    return new TextDecoder().decode(out);
  }

  function _uint8ToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; ++i)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function _base64ToUint8(str) {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i)
      bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  class SaveCrypto {

    static isAvailable() {
      try {
        return !!(window.crypto && window.crypto.subtle && typeof window.crypto.subtle.encrypt === 'function');
      } catch (_) {
        return false;
      }
    }

    async encryptGenesis(json) {
      const plaintext = JSON.stringify(json);
      const keyIndex = 0;

      if (!SaveCrypto.isAvailable()) {
        const encrypted = _xorObfuscate(plaintext, keyIndex);
        return {
          cipher: _uint8ToBase64(encrypted),
          header: { v: 1, k: keyIndex, mode: 'xor', idx: 0 }
        };
      }

      const keyBytes = _getKeyBytes(keyIndex);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pepperBytes = new TextEncoder().encode(BUILD_PEPPER);

      const baseKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: pepperBytes, info: new TextEncoder().encode('genesis') },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const encoded = new TextEncoder().encode(plaintext);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

      return {
        cipher: _uint8ToBase64(new Uint8Array(encrypted)),
        header: { v: 1, k: keyIndex, mode: 'aes', iv: _uint8ToBase64(iv), idx: 0 }
      };
    }

    async encryptChained(json, prevBlock, index) {
      const plaintext = JSON.stringify(json);
      const keyIndex = index & 0xff;

      if (!SaveCrypto.isAvailable()) {
        const chainSeed = prevBlock ? _pepperHash(prevBlock.cipher.substring(0, 32)) : 0;
        const combinedKey = keyIndex ^ (chainSeed & 0xff);
        const encrypted = _xorObfuscate(plaintext, combinedKey);
        return {
          cipher: _uint8ToBase64(encrypted),
          header: { v: 1, k: combinedKey & 0xff, mode: 'xor', idx: index, chain: prevBlock ? prevBlock.header.idx : -1 }
        };
      }

      const keyBytes = _getKeyBytes(keyIndex);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pepperBytes = new TextEncoder().encode(BUILD_PEPPER);
      const chainInfo = prevBlock
        ? new TextEncoder().encode('chain-' + prevBlock.header.idx)
        : new TextEncoder().encode('chain-genesis');

      const baseKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: pepperBytes, info: chainInfo },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const encoded = new TextEncoder().encode(plaintext);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

      return {
        cipher: _uint8ToBase64(new Uint8Array(encrypted)),
        header: { v: 1, k: keyIndex, mode: 'aes', iv: _uint8ToBase64(iv), idx: index, chain: prevBlock ? prevBlock.header.idx : -1 }
      };
    }

    async decryptBlock(cipher, header, prevBlock) {
      if (header.mode === 'xor') {
        const encrypted = _base64ToUint8(cipher);
        const plaintext = _xorDeobfuscate(encrypted, header.k);
        return JSON.parse(plaintext);
      }

      const keyBytes = _getKeyBytes(header.k);
      const iv = _base64ToUint8(header.iv);
      const pepperBytes = new TextEncoder().encode(BUILD_PEPPER);
      const chainInfo = (header.chain != null && header.chain >= 0)
        ? new TextEncoder().encode('chain-' + header.chain)
        : new TextEncoder().encode(header.idx === 0 ? 'genesis' : 'chain-genesis');

      const baseKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: pepperBytes, info: chainInfo },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const encrypted = _base64ToUint8(cipher);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encrypted);

      return JSON.parse(new TextDecoder().decode(decrypted));
    }
  }

  TR.SaveCrypto = SaveCrypto;
})();
