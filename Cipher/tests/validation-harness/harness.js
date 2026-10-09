/*
 * Vector harness appended to a transpiled JavaScript algorithm by
 * tests/TranspilerValidation.js (the VALIDATION category).
 * (c)2006-2025 Hawkynt
 *
 * The spec placeholder below is replaced by the harness spec the reference run produced:
 * the algorithms the file registers, and per vector the fields to apply, in
 * TestEngine order, and the checks the reference passed. Each vector is applied
 * with the semantics of TestEngine.ConfigureInstance: a field that reaches no
 * setter or property, or whose setter throws, fails the vector.
 *
 * Output protocol (one line each, parsed by the validation):
 *   @@ALGO <a> MISSING <message>
 *   @@VEC <a> <v> PASS
 *   @@VEC <a> <v> FAIL <message>
 *   @@DONE
 */
(function (SPEC) {
  'use strict';

  const DEFAULT_BYTES = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];
  const CIPHER_NAMES = {
    'AES': 'Rijndael (AES)', 'Rijndael': 'Rijndael (AES)', 'DES': 'DES', '3DES': '3DES (Triple DES)',
    'Blowfish': 'Blowfish', 'Camellia': 'Camellia', 'ARIA': 'ARIA'
  };

  function oneLine(text) { return String(text).replace(/\s*[\r\n]+\s*/g, ' | '); }
  function describe(e) {
    if (e && typeof e === 'object' && 'message' in e) return (e.name || 'Error') + ': ' + e.message;
    return 'thrown: ' + String(e);
  }

  function registry() {
    if (typeof AlgorithmFramework === 'undefined' || !AlgorithmFramework.Algorithms) return [];
    return AlgorithmFramework.Algorithms;
  }

  /** The last registration of that name (bundled dependencies register first). */
  function findAlgorithm(name) {
    const all = registry();
    for (let i = all.length - 1; i >= 0; --i)
      if (all[i] && all[i].name === name) return all[i];
    return null;
  }

  function toList(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value;
    if (ArrayBuffer.isView(value)) return Array.from(value);
    return value;
  }

  function sameBytes(a, b) {
    a = toList(a); b = toList(b);
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;
    return true;
  }

  function hex(value) {
    const list = toList(value);
    if (!Array.isArray(list)) return String(list);
    return list.map(b => typeof b === 'number' && b >= 0 && b < 256 ? b.toString(16).padStart(2, '0') : '<' + b + '>').join('');
  }

  // The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
  function dummyCipher() {
    const algorithm = { name: 'DummyBlockCipher', BlockSize: 16, CreateInstance: () => dummyCipher() };
    return {
      algorithm: algorithm, BlockSize: 16, isInverse: false, _key: null, inputBuffer: [],
      set key(bytes) { this._key = bytes ? Array.from(bytes) : null; },
      get key() { return this._key ? this._key.slice() : null; },
      Feed(data) { if (data && data.length) for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]); },
      Result() {
        if (!this._key) throw new Error('Key not set');
        const out = [];
        for (let i = 0; i < this.inputBuffer.length; i += 16) {
          const block = this.inputBuffer.slice(i, i + 16);
          while (block.length < 16) block.push(0);
          for (let j = 0; j < 16; ++j) out.push(block[j] ^ this._key[j % this._key.length]);
        }
        this.inputBuffer = [];
        return out;
      }
    };
  }

  function setField(field, apply) {
    try {
      apply();
    } catch (e) {
      throw new Error("Setting vector field '" + field + "' failed: " + describe(e));
    }
  }

  // A setter method of that name, else a property of the field's name
  function applyProperty(instance, field, setter, value) {
    if (setter && typeof instance[setter] === 'function') {
      setField(field, () => instance[setter](value));
      return true;
    }
    if (field in instance) {
      setField(field, () => { instance[field] = value; });
      return true;
    }
    return false;
  }

  function configure(spec, plan, instance, vector) {
    const applied = new Set();
    if (spec.isMode) {
      const mode = plan.mode;
      let cipher = null;
      if (mode.cipher !== null) {
        const found = findAlgorithm(CIPHER_NAMES[mode.cipher] || mode.cipher) || findAlgorithm(mode.cipher);
        if (found) cipher = found.CreateInstance(false);
        if (!cipher)
          throw new Error("Vector field 'cipher' is not applied: no block cipher named '" + mode.cipher + "' is registered");
      } else {
        cipher = dummyCipher();
      }
      if (!spec.multiKey) cipher.key = mode.keyTruthy ? vector.key : DEFAULT_BYTES.slice();
      if (plan.fields.indexOf('cipher') >= 0) applied.add('cipher');
      if (plan.fields.indexOf('key') >= 0 && !spec.multiKey) applied.add('key');
      if (typeof instance.setBlockCipher === 'function') instance.setBlockCipher(cipher);
      if (typeof instance.setIV === 'function') {
        if (mode.ivTruthy) {
          setField('iv', () => instance.setIV(vector.iv));
          applied.add('iv');
        } else {
          instance.setIV(DEFAULT_BYTES.slice());
        }
      }
    }

    for (const step of plan.steps) {
      const value = vector[step.field];
      if (step.kind === 'kek') {
        const asKek = applyProperty(instance, 'kek', 'setKEK', value);
        const asKey = typeof instance.setKEK !== 'function' && typeof instance.setKey === 'function'
          && applyProperty(instance, 'key', 'setKey', value);
        if (asKek || asKey) applied.add('kek');
      } else if (applyProperty(instance, step.field, step.setter || null, value)) {
        applied.add(step.field);
      }
    }

    for (const field of plan.fields)
      if (!applied.has(field))
        throw new Error("Vector field '" + field + "' is not applied: " + spec.name + ' has no setter or property of that name');
  }

  function run(algorithm, spec, plan, vector, inverse, input) {
    const instance = algorithm.CreateInstance(inverse);
    if (!instance) throw new Error('Failed to create algorithm instance (inverse=' + inverse + ')');
    configure(spec, plan, instance, vector);
    instance.Feed(input);
    return toList(instance.Result());
  }

  function checkVector(algorithm, spec, plan, vector) {
    const input = vector.input;
    const output = run(algorithm, spec, plan, vector, plan.inverse, input);
    if (plan.expect && !sameBytes(output, vector.expected))
      return 'output ' + hex(output) + ' expected ' + hex(vector.expected);
    if (plan.rt === 'decode') {
      const back = run(algorithm, spec, plan, vector, !plan.inverse, output);
      if (!sameBytes(back, input)) return 'round trip gave ' + hex(back) + ' expected the input ' + hex(input);
    } else if (plan.rt === 'stability') {
      const decoded = run(algorithm, spec, plan, vector, true, output);
      const again = run(algorithm, spec, plan, vector, false, decoded);
      if (!sameBytes(again, output)) return 'encoding is not stable: re-encoding gave ' + hex(again) + ' expected ' + hex(output);
    }
    return null;
  }

  for (let a = 0; a < SPEC.algorithms.length; ++a) {
    const spec = SPEC.algorithms[a];
    let algorithm;
    try {
      algorithm = findAlgorithm(spec.name);
    } catch (e) {
      console.log('@@ALGO ' + a + ' MISSING ' + oneLine(describe(e)));
      continue;
    }
    if (!algorithm) {
      console.log('@@ALGO ' + a + " MISSING no algorithm named '" + oneLine(spec.name) + "' is registered");
      continue;
    }
    const tests = algorithm.tests || [];
    if (tests.length !== spec.vectors.length)
      console.log('@@ALGO ' + a + ' COUNT ' + tests.length);
    for (let v = 0; v < spec.vectors.length; ++v) {
      let failure;
      try {
        failure = v < tests.length ? checkVector(algorithm, spec, spec.vectors[v], tests[v]) : 'vector missing';
      } catch (e) {
        failure = describe(e);
      }
      console.log('@@VEC ' + a + ' ' + v + (failure === null ? ' PASS' : ' FAIL ' + oneLine(failure)));
    }
  }
  console.log('@@DONE');
})(__SPEC_JSON__);
