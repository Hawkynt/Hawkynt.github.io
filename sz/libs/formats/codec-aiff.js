;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32BE, readU16BE, readString } = F;

  // =========================================================================
  // AIFF/AIFF-C chunk parser
  // =========================================================================

  function _readExtended80(bytes, offset) {
    const exponent = ((bytes[offset] & 0x7F) << 8) | bytes[offset + 1];
    const sign = bytes[offset] & 0x80 ? -1 : 1;
    let mantissa = 0;
    for (let i = 0; i < 8; ++i)
      mantissa = mantissa * 256 + bytes[offset + 2 + i];
    if (exponent === 0 && mantissa === 0) return 0;
    return sign * Math.pow(2, exponent - 16383 - 63) * mantissa;
  }

  function parse(bytes) {
    if (bytes.length < 12) return null;

    const form = readString(bytes, 0, 4);
    if (form !== 'FORM') return null;

    const fileSize = readU32BE(bytes, 4) + 8;
    const type = readString(bytes, 8, 4);
    if (type !== 'AIFF' && type !== 'AIFC') return null;

    const chunks = [];
    let numChannels = 0, numSampleFrames = 0, sampleSize = 0, sampleRate = 0;
    let compressionType = 'NONE';
    let pos = 12;

    while (pos + 8 <= bytes.length) {
      const id = readString(bytes, pos, 4);
      const size = readU32BE(bytes, pos + 4);
      chunks.push(id);

      if (id === 'COMM' && pos + 8 + 18 <= bytes.length) {
        numChannels = readU16BE(bytes, pos + 8);
        numSampleFrames = readU32BE(bytes, pos + 10);
        sampleSize = readU16BE(bytes, pos + 14);
        sampleRate = _readExtended80(bytes, pos + 16);
        if (type === 'AIFC' && pos + 8 + 22 <= bytes.length)
          compressionType = readString(bytes, pos + 26, 4);
      }

      pos += 8 + size + (size & 1);
    }

    const duration = sampleRate > 0 ? numSampleFrames / sampleRate : 0;

    return {
      type,
      numChannels,
      numSampleFrames,
      sampleSize,
      sampleRate,
      compressionType,
      duration,
      chunks,
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('aiff', {
    name: 'AIFF Audio',
    category: 'audio',
    extensions: ['aif', 'aiff', 'aifc'],
    mimeTypes: ['audio/aiff', 'audio/x-aiff'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 12) return false;
      return bytes[0] === 0x46 && bytes[1] === 0x4F && bytes[2] === 0x52 && bytes[3] === 0x4D &&
             (readString(bytes, 8, 4) === 'AIFF' || readString(bytes, 8, 4) === 'AIFC');
    },
    codec: {},
    parse,
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.parseAIFF = parse;

})();
