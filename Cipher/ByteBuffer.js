/*
 * ByteBuffer - growable byte storage backed by Uint8Array
 * (c)2006-2025 Hawkynt
 *
 * Algorithms in this library accumulate bytes with `array.push(...)` into plain
 * JavaScript arrays. V8 backs a numeric array with 8 bytes per element and each
 * algorithm allocates several intermediates, which measures at roughly 84 bytes
 * of process memory per input byte - so a 50MB input costs ~4.2GB and 100MB
 * fails outright.
 *
 * This is the storage primitive for moving that contract onto typed arrays:
 * one byte per element, amortised doubling growth, and `subarray()` views
 * instead of copies. It is deliberately standalone and additive - nothing is
 * required to use it yet.
 *
 * Usage:
 *   const buffer = new ByteBuffer();
 *   buffer.push(0x41);
 *   buffer.append([0x42, 0x43]);
 *   buffer.toUint8Array();   // zero-copy view of exactly the written bytes
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ByteBuffer = factory();
  }
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function () {
  'use strict';

  const DEFAULT_CAPACITY = 64;

  class ByteBuffer {
    /**
     * @param {int} initialCapacity - starting capacity in bytes
     */
    constructor(initialCapacity = DEFAULT_CAPACITY) {
      const capacity = Math.max(1, initialCapacity | 0);
      this._data = new Uint8Array(capacity);
      this._length = 0;
    }

    /** Number of bytes written. @returns {int} */
    get length() { return this._length; }

    /** Current allocated capacity. @returns {int} */
    get capacity() { return this._data.length; }

    /**
     * Grow so at least `needed` further bytes fit. Doubling keeps appends
     * amortised O(1); without it, append-per-byte degrades to quadratic copying.
     * @param {int} needed
     */
    _ensure(needed) {
      const required = this._length + needed;
      if (required <= this._data.length) return;
      let capacity = this._data.length;
      while (capacity < required) capacity *= 2;
      const grown = new Uint8Array(capacity);
      grown.set(this._data.subarray(0, this._length));
      this._data = grown;
    }

    /**
     * Append a single byte.
     * @param {byte} value
     * @returns {ByteBuffer} this, for chaining
     */
    push(value) {
      this._ensure(1);
      this._data[this._length++] = value;
      return this;
    }

    /**
     * Append a byte sequence. Accepts arrays, typed arrays and Buffers, and
     * copies in one operation rather than element by element.
     * @param {byte[]|Uint8Array} bytes
     * @returns {ByteBuffer} this, for chaining
     */
    append(bytes) {
      if (!bytes || bytes.length === 0) return this;
      this._ensure(bytes.length);
      if (bytes instanceof Uint8Array) {
        this._data.set(bytes, this._length);
        this._length += bytes.length;
        return this;
      }
      for (let i = 0; i < bytes.length; i++) this._data[this._length + i] = bytes[i];
      this._length += bytes.length;
      return this;
    }

    /**
     * Read a byte.
     * @param {int} index
     * @returns {byte}
     */
    get(index) { return this._data[index]; }

    /**
     * Overwrite a byte already written.
     * @param {int} index
     * @param {byte} value
     */
    set(index, value) { this._data[index] = value; }

    /** Discard all written bytes, keeping the allocation. */
    clear() { this._length = 0; }

    /**
     * Zero-copy view of exactly the written bytes. Valid until the next append
     * that triggers growth, so treat it as a borrow rather than an owned copy.
     * @returns {Uint8Array}
     */
    toUint8Array() { return this._data.subarray(0, this._length); }

    /**
     * Independent copy of the written bytes.
     * @returns {Uint8Array}
     */
    toCopy() { return this._data.slice(0, this._length); }

    /**
     * Plain array copy, for the array-based interfaces that still expect one.
     * @returns {byte[]}
     */
    toArray() { return Array.from(this._data.subarray(0, this._length)); }

    /**
     * Build a buffer from an existing byte sequence.
     * @param {byte[]|Uint8Array} bytes
     * @returns {ByteBuffer}
     */
    static from(bytes) {
      const buffer = new ByteBuffer(Math.max(1, bytes ? bytes.length : 0));
      return buffer.append(bytes);
    }
  }

  return ByteBuffer;
}));
