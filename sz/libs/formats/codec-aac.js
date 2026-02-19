;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Constants
  // =========================================================================

  const _AAC_PROFILES = ['AAC-Main', 'AAC-LC', 'AAC-SSR', 'AAC-LTP'];
  const _AAC_SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025,  8000,  7350, null, null, null,
  ];

  // =========================================================================
  // AAC ADTS frame parser
  // =========================================================================

  function scanAACFrames(bytes, offset, maxFrames) {
    if (offset == null) offset = 0;
    if (maxFrames == null) maxFrames = 500;

    const frames = [];
    const len = bytes.length;
    let pos = offset;
    let totalSamples = 0;
    let lastSampleRate = 0;

    while (pos + 6 < len && frames.length < maxFrames) {
      const sync = (bytes[pos] << 4) | (bytes[pos + 1] >> 4);
      if (sync !== 0xFFF) {
        ++pos;
        continue;
      }

      const b1 = bytes[pos + 1];
      const b2 = bytes[pos + 2];
      const b3 = bytes[pos + 3];
      const b4 = bytes[pos + 4];
      const b5 = bytes[pos + 5];
      const b6 = pos + 6 < len ? bytes[pos + 6] : 0;

      const profileIdx = (b2 >> 6) & 0x03;
      const profile = _AAC_PROFILES[profileIdx] || 'Unknown';

      const srIdx = (b2 >> 2) & 0x0F;
      const sampleRate = _AAC_SAMPLE_RATES[srIdx];
      if (!sampleRate) {
        ++pos;
        continue;
      }

      const channelConfig = ((b2 & 0x01) << 2) | ((b3 >> 6) & 0x03);
      const channels = channelConfig === 7 ? 8 : channelConfig;
      if (channels < 1) {
        ++pos;
        continue;
      }

      const frameLength = ((b3 & 0x03) << 11) | (b4 << 3) | ((b5 >> 5) & 0x07);
      if (frameLength < 7) {
        ++pos;
        continue;
      }

      const numBlocks = (b6 & 0x03) + 1;

      frames.push({
        offset: pos,
        length: frameLength,
        profile,
        sampleRate,
        channels,
      });

      totalSamples += numBlocks * 1024;
      lastSampleRate = sampleRate;

      pos += frameLength;
    }

    const totalFrames = frames.length;
    const duration = lastSampleRate > 0 ? totalSamples / lastSampleRate : 0;

    return { frames, totalFrames, duration };
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('aac', {
    name: 'AAC Audio',
    category: 'audio',
    extensions: ['aac'],
    mimeTypes: ['audio/aac'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 2) return false;
      const sync = (bytes[0] << 4) | (bytes[1] >> 4);
      return sync === 0xFFF;
    },
    codec: { scanAACFrames },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.scanAACFrames = scanAACFrames;

})();
