;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32LE, readU16LE, readU8, readString } = F;

  // =========================================================================
  // Opus header parser (inside Ogg container)
  // =========================================================================

  function parseOpusHead(bytes, offset) {
    const off = offset || 0;
    if (off + 19 > bytes.length) return null;

    const sig = readString(bytes, off, 8);
    if (sig !== 'OpusHead') return null;

    const version = readU8(bytes, off + 8);
    const channels = readU8(bytes, off + 9);
    const preSkip = readU16LE(bytes, off + 10);
    const sampleRate = readU32LE(bytes, off + 12);
    const outputGain = readU16LE(bytes, off + 16);
    const channelMapping = readU8(bytes, off + 18);

    return { version, channels, preSkip, sampleRate, outputGain, channelMapping };
  }

  function parse(bytes) {
    if (bytes.length < 47) return null;
    if (!(bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53))
      return null;

    const numSegments = readU8(bytes, 26);
    const dataOff = 27 + numSegments;
    return parseOpusHead(bytes, dataOff);
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('opus', {
    name: 'Opus Audio',
    category: 'audio',
    extensions: ['opus'],
    mimeTypes: ['audio/opus'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 36) return false;
      if (!(bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53))
        return false;
      const numSeg = bytes[26];
      const dataOff = 27 + numSeg;
      if (dataOff + 8 > bytes.length) return false;
      return readString(bytes, dataOff, 8) === 'OpusHead';
    },
    codec: { parseOpusHead },
    parse,
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.parseOpusHead = parseOpusHead;

})();
