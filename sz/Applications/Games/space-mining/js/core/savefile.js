/* Save files: the career written to a file and read back - in this browser or another - signed
   with ECDSA P-256 so an edited file is refused, and encrypted with AES-GCM under a key agreed by
   ECDH P-256 between a fresh key of each file and the game's own, so it cannot be read or patched
   in a text editor. The game's two private keys ship as masked, split pieces: that keeps casual
   tampering out, but a browser game cannot truly hide a key from its own player - whoever takes
   the code apart can find them. Async (WebCrypto); no DOM. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const MAGIC = 'SZSM1.';
  /* public halves in the clear; private scalars masked and split (see mask()) */
  const PUB = {
    sig: { x: '6ZVtgcKlqcuxUxpazMNer_LyZ1aybdqWM1acCmyeWOE', y: 'wV9u_AP9FcRI2ilzf_E6ZqI_q5kHlhelSbflKjrRznY' },
    dh: { x: 'jdbZOcwfD8yDJvutr4QnvSFFV-Hx257KfWpGQxHPxTg', y: 'MtsD05J7wXZP-WzZOKLaEQ7Ud5PXNT0523l-k9Yp1Rc' },
  };
  const PARTS = [
    ['e6e9e5d85eda5d8889439c54db3c966f', 'amber-reach-lanes'],
    ['fa0b7d9d163f13a64d91070e2d10a5f2', 'drift-ore-tithe'],
    ['2ad55b762c54f5839b5428d49206e248', 'amber-reach-lanes'],
    ['fe38473d1c101afa4c85030ae533291a', 'drift-ore-tithe'],
  ];

  function subtle() {
    const c = (typeof crypto !== 'undefined' && crypto) || (typeof window !== 'undefined' && window.crypto);
    return c && c.subtle ? c.subtle : null;
  }

  function available() {
    return !!subtle();
  }

  /* the mask stream of a phrase: a running LCG seeded by the phrase's FNV hash */
  function mask(n, phrase) {
    let h = 2166136261;
    for (let i = 0; i < phrase.length; ++i) h = Math.imul(h ^ phrase.charCodeAt(i), 16777619) >>> 0;
    const out = [];
    for (let i = 0; i < n; ++i) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out.push((h >>> 16) & 255); }
    return out;
  }

  const hexBytes = (h) => { const out = []; for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16)); return out; };
  function b64u(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; ++i) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; ++i) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; ++i) out[i] = s.charCodeAt(i);
    return out;
  }

  /* a private scalar from its two pieces */
  function scalar(a, b) {
    const pa = hexBytes(PARTS[a][0]), pb = hexBytes(PARTS[b][0]);
    const m = mask(pa.length + pb.length, PARTS[a][1]);
    return b64u(pa.concat(pb).map((v, i) => v ^ m[i]));
  }

  function jwk(pub, d) {
    const k = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, ext: true };
    if (d) k.d = d;
    return k;
  }

  const enc = new TextEncoder(), dec = new TextDecoder();

  /* the save as a file's text: SZSM1. + base64 of { e (the file's ECDH key), iv, c } */
  async function exportSave(json) {
    const S = subtle();
    if (!S) throw new Error('This browser cannot encrypt files');
    const signer = await S.importKey('jwk', jwk(PUB.sig, scalar(1, 3)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = await S.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer, enc.encode(json));
    const plain = JSON.stringify({ s: json, g: b64(sig) });
    const eph = await S.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const game = await S.importKey('jwk', jwk(PUB.dh), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const key = await aesKey(S, eph.privateKey, game);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await S.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plain));
    const e = await S.exportKey('raw', eph.publicKey);
    return MAGIC + btoa(JSON.stringify({ e: b64(e), iv: b64(iv), c: b64(c) }));
  }

  async function aesKey(S, priv, pub) {
    const bits = await S.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
    const hk = await S.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('sz-space-mining-save'), info: enc.encode('v1') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* a file's text back to the save's JSON; throws with a reason a player can read */
  async function importSave(text) {
    const S = subtle();
    if (!S) throw new Error('This browser cannot read encrypted files');
    text = String(text || '').trim();
    if (text.indexOf(MAGIC) !== 0) throw new Error('Not a Space Mining save file');
    let box;
    try { box = JSON.parse(atob(text.slice(MAGIC.length))); } catch (_) { throw new Error('The save file is damaged'); }
    let plain;
    try {
      const own = await S.importKey('jwk', jwk(PUB.dh, scalar(0, 2)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
      const eph = await S.importKey('raw', unb64(box.e), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const key = await aesKey(S, own, eph);
      plain = JSON.parse(dec.decode(await S.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.c))));
    } catch (_) { throw new Error('The save file is damaged or was changed'); }
    const verifier = await S.importKey('jwk', jwk(PUB.sig), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await S.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifier, unb64(plain.g), enc.encode(plain.s));
    if (!ok) throw new Error('The save file was changed - it cannot be loaded');
    return plain.s;
  }

  Object.assign(NS.saveFile, {
    MAGIC, available, exportSave, importSave
  });
})();
