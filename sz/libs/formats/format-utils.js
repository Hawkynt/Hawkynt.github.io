;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Bitstream reader with Exp-Golomb decoding
  // =========================================================================

  class BitstreamReader {

    #bytes;
    #byteOffset;
    #bitOffset;
    #length;

    constructor(bytes, offset, length) {
      this.#bytes = bytes;
      this.#byteOffset = offset || 0;
      this.#bitOffset = 0;
      this.#length = length != null ? length : bytes.length - this.#byteOffset;
    }

    get bitsRemaining() {
      return (this.#length - (this.#byteOffset - (this.#bytes.byteOffset || 0))) * 8 - this.#bitOffset;
    }

    readBit() {
      if (this.#byteOffset >= this.#bytes.length)
        return 0;
      const bit = (this.#bytes[this.#byteOffset] >> (7 - this.#bitOffset)) & 1;
      if (++this.#bitOffset >= 8) {
        this.#bitOffset = 0;
        ++this.#byteOffset;
      }
      return bit;
    }

    readBits(n) {
      let value = 0;
      for (let i = 0; i < n; ++i)
        value = (value << 1) | this.readBit();
      return value;
    }

    skipBits(n) {
      const totalBits = this.#bitOffset + n;
      this.#byteOffset += (totalBits >> 3);
      this.#bitOffset = totalBits & 7;
    }

    readUE() {
      let leadingZeros = 0;
      while (this.readBit() === 0 && leadingZeros < 32)
        ++leadingZeros;
      if (leadingZeros === 0)
        return 0;
      return (1 << leadingZeros) - 1 + this.readBits(leadingZeros);
    }

    readSE() {
      const code = this.readUE();
      const sign = (code & 1) ? 1 : -1;
      return sign * ((code + 1) >> 1);
    }
  }

  // =========================================================================
  // NAL start code scanner (shared by H.264 and H.265)
  // =========================================================================

  function findNALStartCodes(bytes, offset, maxUnits) {
    const results = [];
    const end = bytes.length;
    let i = offset || 0;
    const limit = maxUnits || Infinity;

    while (i < end - 2 && results.length < limit) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        let startCodeLen = 0;
        if (bytes[i + 2] === 1)
          startCodeLen = 3;
        else if (bytes[i + 2] === 0 && i + 3 < end && bytes[i + 3] === 1)
          startCodeLen = 4;

        if (startCodeLen > 0) {
          if (results.length > 0)
            results[results.length - 1].length = i - results[results.length - 1].offset;

          const nalStart = i + startCodeLen;
          results.push({ offset: nalStart, length: 0, startCodeOffset: i });
          i = nalStart;
          continue;
        }
      }
      ++i;
    }

    if (results.length > 0 && results[results.length - 1].length === 0)
      results[results.length - 1].length = end - results[results.length - 1].offset;

    return results;
  }

  // =========================================================================
  // Remove emulation prevention bytes (0x000003 -> 0x0000)
  // =========================================================================

  function removeEmulationPrevention(bytes, offset, length) {
    const out = [];
    const end = offset + length;
    for (let i = offset; i < end; ++i) {
      if (i + 2 < end && bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 3) {
        out.push(0, 0);
        i += 2;
      } else
        out.push(bytes[i]);
    }
    return new Uint8Array(out);
  }

  // =========================================================================
  // Export
  // =========================================================================

  F.Utils = {
    BitstreamReader,
    findNALStartCodes,
    removeEmulationPrevention,
  };

})();
