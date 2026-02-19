;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const readU8 = F.readU8;
  const readU16BE = F.readU16BE;
  const readU32BE = F.readU32BE;
  const readString = F.readString;

  // =========================================================================
  // Constants
  // =========================================================================

  const _MPEG_VERSIONS = [2.5, null, 2, 1];
  const _LAYERS = [null, 3, 2, 1];
  const _SAMPLES_PER_FRAME = {
    1:  { 1: 384, 2: 1152, 3: 1152 },
    2:  { 1: 384, 2: 1152, 3: 576  },
    2.5:{ 1: 384, 2: 1152, 3: 576  },
  };

  const _BITRATES = {
    1: {
      1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, -1],
      2: [0, 32, 48, 56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, 384, -1],
      3: [0, 32, 40, 48,  56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, -1],
    },
    2: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, -1],
      2: [0,  8, 16, 24, 32, 40, 48,  56,  64,  80,  96, 112, 128, 144, 160, -1],
      3: [0,  8, 16, 24, 32, 40, 48,  56,  64,  80,  96, 112, 128, 144, 160, -1],
    },
  };

  const _SAMPLE_RATES = {
    1:   [44100, 48000, 32000, null],
    2:   [22050, 24000, 16000, null],
    2.5: [11025, 12000,  8000, null],
  };

  const _CHANNEL_MODES = ['Stereo', 'Joint Stereo', 'Dual Channel', 'Mono'];

  // =========================================================================
  // MP3 frame parser
  // =========================================================================

  function scanMP3Frames(bytes, offset, maxFrames) {
    if (offset == null) offset = 0;
    if (maxFrames == null) maxFrames = 500;

    const frames = [];
    const len = bytes.length;
    let pos = offset;
    let bitrateSum = 0;
    let firstBitrate = null;
    let isVBR = false;
    let totalSamples = 0;
    let lastSampleRate = 0;

    while (pos + 3 < len && frames.length < maxFrames) {
      const header16 = (bytes[pos] << 8) | bytes[pos + 1];
      if ((header16 & 0xFFE0) !== 0xFFE0) {
        ++pos;
        continue;
      }

      if (pos + 3 >= len) break;
      const b1 = bytes[pos + 1];
      const b2 = bytes[pos + 2];
      const b3 = bytes[pos + 3];

      const versionIdx = (b1 >> 3) & 0x03;
      const layerIdx = (b1 >> 1) & 0x03;
      const version = _MPEG_VERSIONS[versionIdx];
      const layer = _LAYERS[layerIdx];

      if (version == null || layer == null) {
        ++pos;
        continue;
      }

      const bitrateKey = version === 1 ? 1 : 2;
      const bitrateIdx = (b2 >> 4) & 0x0F;
      const bitrate = _BITRATES[bitrateKey][layer][bitrateIdx];
      if (bitrate <= 0) {
        ++pos;
        continue;
      }

      const srIdx = (b2 >> 2) & 0x03;
      const sampleRate = _SAMPLE_RATES[version][srIdx];
      if (!sampleRate) {
        ++pos;
        continue;
      }

      const padding = (b2 >> 1) & 0x01;
      const channelMode = (b3 >> 6) & 0x03;
      const channels = channelMode === 3 ? 1 : 2;

      let frameSize;
      if (layer === 1)
        frameSize = Math.floor((12 * bitrate * 1000 / sampleRate + padding) * 4);
      else {
        const samplesPerFrame = _SAMPLES_PER_FRAME[version][layer];
        frameSize = Math.floor(samplesPerFrame / 8 * bitrate * 1000 / sampleRate + padding);
      }

      if (frameSize < 1) {
        ++pos;
        continue;
      }

      frames.push({
        offset: pos,
        length: frameSize,
        bitrate,
        sampleRate,
        version,
        layer,
        channels,
      });

      if (firstBitrate === null)
        firstBitrate = bitrate;
      else if (bitrate !== firstBitrate)
        isVBR = true;

      bitrateSum += bitrate;
      totalSamples += _SAMPLES_PER_FRAME[version][layer];
      lastSampleRate = sampleRate;

      pos += frameSize;
    }

    const totalFrames = frames.length;
    const avgBitrate = totalFrames > 0 ? Math.round(bitrateSum / totalFrames) : 0;
    const duration = lastSampleRate > 0 ? totalSamples / lastSampleRate : 0;

    return { frames, totalFrames, avgBitrate, isVBR, duration };
  }

  // =========================================================================
  // Xing header parser
  // =========================================================================

  function parseXingHeader(bytes, frameOffset) {
    const searchEnd = Math.min(frameOffset + 200, bytes.length - 4);
    let tagOffset = -1;
    let tagId = null;

    for (let i = frameOffset + 4; i <= searchEnd; ++i) {
      const id = readString(bytes, i, 4);
      if (id === 'Xing' || id === 'Info') {
        tagOffset = i;
        tagId = id;
        break;
      }
    }

    if (tagOffset < 0) return null;

    let pos = tagOffset + 4;
    if (pos + 4 > bytes.length) return null;

    const flags = readU32BE(bytes, pos);
    pos += 4;

    const result = { tag: tagId, flags };

    if (flags & 0x01) {
      if (pos + 4 > bytes.length) return result;
      result.totalFrames = readU32BE(bytes, pos);
      pos += 4;
    }

    if (flags & 0x02) {
      if (pos + 4 > bytes.length) return result;
      result.totalBytes = readU32BE(bytes, pos);
      pos += 4;
    }

    if (flags & 0x04) {
      if (pos + 100 > bytes.length) return result;
      result.toc = Array.from(bytes.slice(pos, pos + 100));
      pos += 100;
    }

    if (flags & 0x08) {
      if (pos + 4 > bytes.length) return result;
      result.quality = readU32BE(bytes, pos);
      pos += 4;
    }

    result.lame = parseLAMETag(bytes, pos);

    return result;
  }

  // =========================================================================
  // LAME tag parser
  // =========================================================================

  function parseLAMETag(bytes, offset) {
    if (offset + 9 > bytes.length) return null;

    const encoder = readString(bytes, offset, 9);
    if (!encoder.startsWith('LAME') && !encoder.startsWith('L3.9') && !encoder.startsWith('Lavf'))
      return null;

    const result = { encoder };

    if (offset + 36 > bytes.length) return result;

    const infoByte = readU8(bytes, offset + 9);
    result.infoTagRevision = (infoByte >> 4) & 0x0F;
    const vbrMethod = infoByte & 0x0F;
    const _VBR_METHODS = [
      'Unknown', 'CBR', 'ABR', 'VBR (old/rh)', 'VBR (new/mtrh)',
      'Reserved', 'Reserved', 'Reserved', 'CBR (2-pass)',
      'ABR (2-pass)', 'Reserved', 'Reserved', 'Reserved',
      'Reserved', 'Reserved', 'Reserved',
    ];
    result.vbrMethod = _VBR_METHODS[vbrMethod] || 'Unknown';

    result.lowpassFrequency = readU8(bytes, offset + 10) * 100;

    const peakRaw = readU32BE(bytes, offset + 11);
    if (peakRaw !== 0) {
      const peakBuf = new ArrayBuffer(4);
      new DataView(peakBuf).setUint32(0, peakRaw);
      result.replayGainPeak = new DataView(peakBuf).getFloat32(0);
    }

    const radioGain = readU16BE(bytes, offset + 15);
    if (radioGain !== 0) {
      const sign = (radioGain & 0x0200) ? -1 : 1;
      result.radioReplayGain = sign * (radioGain & 0x01FF) / 10.0;
    }

    const audioGain = readU16BE(bytes, offset + 17);
    if (audioGain !== 0) {
      const sign = (audioGain & 0x0200) ? -1 : 1;
      result.audiophileReplayGain = sign * (audioGain & 0x01FF) / 10.0;
    }

    const encFlags = readU8(bytes, offset + 19);
    result.encodingFlags = {
      nspsytune: !!(encFlags & 0x10),
      nssafejoint: !!(encFlags & 0x20),
      nogap_next: !!(encFlags & 0x40),
      nogap_prev: !!(encFlags & 0x80),
    };
    result.athType = encFlags & 0x0F;

    result.bitrateMinOrTarget = readU8(bytes, offset + 20);

    const delay0 = readU8(bytes, offset + 21);
    const delay1 = readU8(bytes, offset + 22);
    const delay2 = readU8(bytes, offset + 23);
    result.encoderDelaySamples = (delay0 << 4) | (delay1 >> 4);
    result.encoderPaddingSamples = ((delay1 & 0x0F) << 8) | delay2;

    const misc = readU8(bytes, offset + 24);
    const _SOURCE_FREQS = ['<= 32 kHz', '44.1 kHz', '48 kHz', '> 48 kHz'];
    result.sourceFrequency = _SOURCE_FREQS[(misc >> 6) & 0x03];
    result.noiseShaping = (misc >> 3) & 0x03;
    result.stereoMode = (misc >> 1) & 0x07;
    result.unwise = !!(misc & 0x01);

    const mp3Gain = readU8(bytes, offset + 25);
    result.mp3GainDb = (mp3Gain > 127 ? mp3Gain - 256 : mp3Gain) * 1.5;

    return result;
  }

  // =========================================================================
  // VBRI header parser
  // =========================================================================

  function parseVBRIHeader(bytes, frameOffset) {
    const pos = frameOffset + 36;
    if (pos + 26 > bytes.length) return null;

    const tag = readString(bytes, pos, 4);
    if (tag !== 'VBRI') return null;

    const version = readU16BE(bytes, pos + 4);
    const delay = readU16BE(bytes, pos + 6);
    const quality = readU16BE(bytes, pos + 8);
    const totalBytes = readU32BE(bytes, pos + 10);
    const totalFrames = readU32BE(bytes, pos + 14);
    const tocEntries = readU16BE(bytes, pos + 18);
    const tocScaleFactor = readU16BE(bytes, pos + 20);
    const tocEntrySize = readU16BE(bytes, pos + 22);
    const tocFramesPerEntry = readU16BE(bytes, pos + 24);

    const result = {
      tag: 'VBRI',
      version,
      delay,
      quality,
      totalBytes,
      totalFrames,
      tocEntries,
      tocScaleFactor,
      tocEntrySize,
      tocFramesPerEntry,
    };

    if (tocEntries > 0 && tocEntrySize > 0) {
      const tocStart = pos + 26;
      const tocDataLen = tocEntries * tocEntrySize;
      if (tocStart + tocDataLen <= bytes.length) {
        const toc = [];
        for (let i = 0; i < tocEntries; ++i) {
          const entryOff = tocStart + i * tocEntrySize;
          let value = 0;
          if (tocEntrySize === 1)
            value = readU8(bytes, entryOff);
          else if (tocEntrySize === 2)
            value = readU16BE(bytes, entryOff);
          else if (tocEntrySize === 3)
            value = (readU8(bytes, entryOff) << 16) | readU16BE(bytes, entryOff + 1);
          else if (tocEntrySize === 4)
            value = readU32BE(bytes, entryOff);
          toc.push(value * tocScaleFactor);
        }
        result.toc = toc;
      }
    }

    return result;
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('mp3', {
    name: 'MP3 Audio',
    category: 'audio',
    extensions: ['mp3'],
    mimeTypes: ['audio/mpeg', 'audio/mp3'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 3) return false;
      if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
      const sync = (bytes[0] << 8) | bytes[1];
      return (sync & 0xFFE0) === 0xFFE0;
    },
    codec: { scanMP3Frames, parseXingHeader, parseLAMETag, parseVBRIHeader },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.scanMP3Frames = scanMP3Frames;
  F.Codecs.Audio.parseXingHeader = parseXingHeader;
  F.Codecs.Audio.parseLAMETag = parseLAMETag;
  F.Codecs.Audio.parseVBRIHeader = parseVBRIHeader;

})();
