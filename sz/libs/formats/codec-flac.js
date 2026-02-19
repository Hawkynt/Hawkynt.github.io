;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const readU16BE = F.readU16BE;

  // =========================================================================
  // Constants
  // =========================================================================

  const _FLAC_BLOCK_SIZES = [
    null, 192, 576, 1152, 2304, 4608,
    null, null,
    256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
  ];

  const _FLAC_SAMPLE_RATES = [
    null, 88200, 176400, 192000,
    8000, 16000, 22050, 24000,
    32000, 44100, 48000, 96000,
    null, null, null, null,
  ];

  const _FLAC_SAMPLE_SIZES = [null, 8, 12, null, 16, 20, 24, null];

  const _FLAC_CHANNEL_MODES = [
    '1ch (Mono)', '2ch (Stereo)', '3ch', '4ch', '5ch', '5.1ch', '6.1ch', '7.1ch',
    'Left/Side Stereo', 'Side/Right Stereo', 'Mid/Side Stereo',
  ];

  // =========================================================================
  // FLAC frame header parser
  // =========================================================================

  function parseFLACFrameHeaders(bytes, audioDataOffset, maxFrames) {
    if (maxFrames == null) maxFrames = 500;

    const frames = [];
    const len = bytes.length;
    let pos = audioDataOffset;

    while (pos + 4 < len && frames.length < maxFrames) {
      if (bytes[pos] !== 0xFF || (bytes[pos + 1] & 0xFE) !== 0xF8) {
        ++pos;
        continue;
      }

      const blockingStrategy = bytes[pos + 1] & 0x01;

      if (pos + 4 >= len) break;
      const b2 = bytes[pos + 2];
      const b3 = bytes[pos + 3];

      const bsCode = (b2 >> 4) & 0x0F;
      let blockSize = _FLAC_BLOCK_SIZES[bsCode];

      const srCode = b2 & 0x0F;
      let sampleRate = _FLAC_SAMPLE_RATES[srCode];

      const chanCode = (b3 >> 4) & 0x0F;
      if (chanCode > 10) {
        ++pos;
        continue;
      }
      const channelMode = _FLAC_CHANNEL_MODES[chanCode] || (chanCode + 1) + 'ch';

      const ssCode = (b3 >> 1) & 0x07;
      const bitDepth = _FLAC_SAMPLE_SIZES[ssCode];

      if (b3 & 0x01) {
        ++pos;
        continue;
      }

      let hdrEnd = pos + 4;
      if (hdrEnd < len) {
        const first = bytes[hdrEnd];
        let extraBytes = 0;
        if ((first & 0x80) === 0) extraBytes = 0;
        else if ((first & 0xE0) === 0xC0) extraBytes = 1;
        else if ((first & 0xF0) === 0xE0) extraBytes = 2;
        else if ((first & 0xF8) === 0xF0) extraBytes = 3;
        else if ((first & 0xFC) === 0xF8) extraBytes = 4;
        else if ((first & 0xFE) === 0xFC) extraBytes = 5;
        else extraBytes = 6;
        hdrEnd += 1 + extraBytes;
      }

      if (bsCode === 6 && hdrEnd < len) {
        blockSize = bytes[hdrEnd] + 1;
        ++hdrEnd;
      } else if (bsCode === 7 && hdrEnd + 1 < len) {
        blockSize = readU16BE(bytes, hdrEnd) + 1;
        hdrEnd += 2;
      }

      if (srCode === 12 && hdrEnd < len) {
        sampleRate = bytes[hdrEnd] * 1000;
        ++hdrEnd;
      } else if (srCode === 13 && hdrEnd + 1 < len) {
        sampleRate = readU16BE(bytes, hdrEnd);
        hdrEnd += 2;
      } else if (srCode === 14 && hdrEnd + 1 < len) {
        sampleRate = readU16BE(bytes, hdrEnd) * 10;
        hdrEnd += 2;
      }

      if (!blockSize || blockSize < 1) {
        ++pos;
        continue;
      }

      frames.push({
        offset: pos,
        blockSize,
        sampleRate: sampleRate || 0,
        channelMode,
        bitDepth: bitDepth || 0,
      });

      pos = hdrEnd + 1;
    }

    return { frames, totalFrames: frames.length };
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('flac', {
    name: 'FLAC Audio',
    category: 'audio',
    extensions: ['flac'],
    mimeTypes: ['audio/flac'],
    access: 'ro',
    detect(bytes) {
      return bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43;
    },
    codec: { parseFLACFrameHeaders },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.parseFLACFrameHeaders = parseFLACFrameHeaders;

})();
