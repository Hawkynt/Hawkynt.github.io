;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16BE, readU32BE, readString } = F;

  // =========================================================================
  // MIDI header parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 14) return null;

    const magic = readString(bytes, 0, 4);
    if (magic !== 'MThd') return null;

    const headerSize = readU32BE(bytes, 4);
    const format = readU16BE(bytes, 8);
    const numTracks = readU16BE(bytes, 10);
    const timeDivision = readU16BE(bytes, 12);

    const formatNames = { 0: 'Single Track', 1: 'Multi Track (Sync)', 2: 'Multi Track (Async)' };

    let ticksPerQuarterNote = null;
    let smpte = null;
    if (timeDivision & 0x8000) {
      const fps = -((timeDivision >> 8) - 256);
      const ticksPerFrame = timeDivision & 0xFF;
      smpte = { fps, ticksPerFrame };
    } else
      ticksPerQuarterNote = timeDivision;

    const tracks = [];
    let pos = 8 + headerSize;
    for (let t = 0; t < numTracks && pos + 8 <= bytes.length; ++t) {
      const trackMagic = readString(bytes, pos, 4);
      const trackSize = readU32BE(bytes, pos + 4);
      if (trackMagic === 'MTrk')
        tracks.push({ offset: pos, dataOffset: pos + 8, size: trackSize });
      pos += 8 + trackSize;
    }

    return {
      format,
      formatName: formatNames[format] || 'Unknown',
      numTracks,
      timeDivision,
      ticksPerQuarterNote,
      smpte,
      tracks,
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('midi', {
    name: 'MIDI',
    category: 'audio',
    extensions: ['mid', 'midi', 'smf'],
    mimeTypes: ['audio/midi', 'audio/x-midi'],
    access: 'ro',
    detect(bytes) {
      return bytes.length >= 4 && bytes[0] === 0x4D && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64;
    },
    codec: {},
    parse,
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.parseMIDI = parse;

})();
