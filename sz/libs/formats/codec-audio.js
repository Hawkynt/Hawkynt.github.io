;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Local aliases for binary I/O from format-core.js
  // =========================================================================

  const readU8 = F.readU8;
  const readU16BE = F.readU16BE;
  const readU32BE = F.readU32BE;
  const readU16LE = F.readU16LE;
  const readU32LE = F.readU32LE;
  const readString = F.readString;

  // =========================================================================
  // Constants -- MP3
  // =========================================================================

  const _MPEG_VERSIONS = [2.5, null, 2, 1];
  const _LAYERS = [null, 3, 2, 1];
  const _SAMPLES_PER_FRAME = {
    1:  { 1: 384, 2: 1152, 3: 1152 },
    2:  { 1: 384, 2: 1152, 3: 576  },
    2.5:{ 1: 384, 2: 1152, 3: 576  },
  };

  // Bitrate tables: [version][layer][index] in kbps, 0 = free, -1 = bad
  const _BITRATES = {
    // MPEG1
    1: {
      1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, -1],
      2: [0, 32, 48, 56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, 384, -1],
      3: [0, 32, 40, 48,  56,  64,  80,  96, 112, 128, 160, 192, 224, 256, 320, -1],
    },
    // MPEG2 / MPEG2.5
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

  /**
   * Scan MP3 frames starting at `offset`.
   * @param {Uint8Array} bytes - File data
   * @param {number} [offset=0] - Start offset
   * @param {number} [maxFrames=500] - Maximum frames to parse
   * @returns {{frames, totalFrames, avgBitrate, isVBR, duration}}
   */
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
      // Seek sync word: 11 set bits (0xFFE0 mask on 16-bit big-endian)
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

      // Frame size calculation
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

  /**
   * Parse Xing/Info VBR header from inside the first MP3 frame.
   * @param {Uint8Array} bytes - File data
   * @param {number} frameOffset - Offset of the first MP3 frame
   * @returns {object|null}
   */
  function parseXingHeader(bytes, frameOffset) {
    // Xing/Info tag sits after the MP3 frame header + side information.
    // Search for "Xing" or "Info" within the first 200 bytes of the frame.
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

    // Bit 0: total frames
    if (flags & 0x01) {
      if (pos + 4 > bytes.length) return result;
      result.totalFrames = readU32BE(bytes, pos);
      pos += 4;
    }

    // Bit 1: total bytes
    if (flags & 0x02) {
      if (pos + 4 > bytes.length) return result;
      result.totalBytes = readU32BE(bytes, pos);
      pos += 4;
    }

    // Bit 2: TOC (100 bytes)
    if (flags & 0x04) {
      if (pos + 100 > bytes.length) return result;
      result.toc = Array.from(bytes.slice(pos, pos + 100));
      pos += 100;
    }

    // Bit 3: quality indicator
    if (flags & 0x08) {
      if (pos + 4 > bytes.length) return result;
      result.quality = readU32BE(bytes, pos);
      pos += 4;
    }

    // Try to parse LAME tag immediately after Xing fields
    result.lame = parseLAMETag(bytes, pos);

    return result;
  }

  // =========================================================================
  // LAME tag parser
  // =========================================================================

  /**
   * Parse LAME encoder tag (sits right after the Xing header fields).
   * @param {Uint8Array} bytes - File data
   * @param {number} offset - Expected start of the LAME tag
   * @returns {object|null}
   */
  function parseLAMETag(bytes, offset) {
    if (offset + 9 > bytes.length) return null;

    const encoder = readString(bytes, offset, 9);
    // LAME tags start with "LAME" (most common) or sometimes other encoder names
    if (!encoder.startsWith('LAME') && !encoder.startsWith('L3.9') && !encoder.startsWith('Lavf'))
      return null;

    const result = { encoder };

    if (offset + 36 > bytes.length) return result;

    // Byte 9: info tag revision + VBR method
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

    // Byte 10: lowpass filter frequency (in 100 Hz steps)
    result.lowpassFrequency = readU8(bytes, offset + 10) * 100;

    // Bytes 11-14: replay gain peak signal amplitude (32-bit float)
    const peakRaw = readU32BE(bytes, offset + 11);
    if (peakRaw !== 0) {
      const peakBuf = new ArrayBuffer(4);
      new DataView(peakBuf).setUint32(0, peakRaw);
      result.replayGainPeak = new DataView(peakBuf).getFloat32(0);
    }

    // Bytes 15-16: radio replay gain
    const radioGain = readU16BE(bytes, offset + 15);
    if (radioGain !== 0) {
      const sign = (radioGain & 0x0200) ? -1 : 1;
      result.radioReplayGain = sign * (radioGain & 0x01FF) / 10.0;
    }

    // Bytes 17-18: audiophile replay gain
    const audioGain = readU16BE(bytes, offset + 17);
    if (audioGain !== 0) {
      const sign = (audioGain & 0x0200) ? -1 : 1;
      result.audiophileReplayGain = sign * (audioGain & 0x01FF) / 10.0;
    }

    // Byte 19: encoding flags + ATH type
    const encFlags = readU8(bytes, offset + 19);
    result.encodingFlags = {
      nspsytune: !!(encFlags & 0x10),
      nssafejoint: !!(encFlags & 0x20),
      nogap_next: !!(encFlags & 0x40),
      nogap_prev: !!(encFlags & 0x80),
    };
    result.athType = encFlags & 0x0F;

    // Byte 20: minimum bitrate (or target bitrate for ABR)
    result.bitrateMinOrTarget = readU8(bytes, offset + 20);

    // Bytes 21-23: encoder delays (start + end padding)
    const delay0 = readU8(bytes, offset + 21);
    const delay1 = readU8(bytes, offset + 22);
    const delay2 = readU8(bytes, offset + 23);
    result.encoderDelaySamples = (delay0 << 4) | (delay1 >> 4);
    result.encoderPaddingSamples = ((delay1 & 0x0F) << 8) | delay2;

    // Byte 24: misc
    const misc = readU8(bytes, offset + 24);
    const _SOURCE_FREQS = ['<= 32 kHz', '44.1 kHz', '48 kHz', '> 48 kHz'];
    result.sourceFrequency = _SOURCE_FREQS[(misc >> 6) & 0x03];
    result.noiseShaping = (misc >> 3) & 0x03;
    result.stereoMode = (misc >> 1) & 0x07;
    result.unwise = !!(misc & 0x01);

    // Byte 25: MP3 gain change
    const mp3Gain = readU8(bytes, offset + 25);
    result.mp3GainDb = (mp3Gain > 127 ? mp3Gain - 256 : mp3Gain) * 1.5;

    return result;
  }

  // =========================================================================
  // VBRI header parser
  // =========================================================================

  /**
   * Parse Fraunhofer VBRI header. VBRI is always at offset 36 from frame start.
   * @param {Uint8Array} bytes - File data
   * @param {number} frameOffset - Offset of the first MP3 frame
   * @returns {object|null}
   */
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

    // Parse TOC entries
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
  // Constants -- AAC ADTS
  // =========================================================================

  const _AAC_PROFILES = ['AAC-Main', 'AAC-LC', 'AAC-SSR', 'AAC-LTP'];
  const _AAC_SAMPLE_RATES = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050,
    16000, 12000, 11025,  8000,  7350, null, null, null,
  ];

  // =========================================================================
  // AAC ADTS frame parser
  // =========================================================================

  /**
   * Scan AAC ADTS frames starting at `offset`.
   * @param {Uint8Array} bytes - File data
   * @param {number} [offset=0] - Start offset
   * @param {number} [maxFrames=500] - Maximum frames to parse
   * @returns {{frames, totalFrames, duration}}
   */
  function scanAACFrames(bytes, offset, maxFrames) {
    if (offset == null) offset = 0;
    if (maxFrames == null) maxFrames = 500;

    const frames = [];
    const len = bytes.length;
    let pos = offset;
    let totalSamples = 0;
    let lastSampleRate = 0;

    while (pos + 6 < len && frames.length < maxFrames) {
      // ADTS sync word: 12 bits all set = 0xFFF
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

      // ID bit: 0 = MPEG-4, 1 = MPEG-2
      // const mpegId = (b1 >> 3) & 0x01;

      // Protection absent: 1 = no CRC, 0 = CRC present
      // const protectionAbsent = b1 & 0x01;

      // Profile: 2 bits (0=Main, 1=LC, 2=SSR, 3=LTP)
      const profileIdx = (b2 >> 6) & 0x03;
      const profile = _AAC_PROFILES[profileIdx] || 'Unknown';

      // Sample rate index: 4 bits
      const srIdx = (b2 >> 2) & 0x0F;
      const sampleRate = _AAC_SAMPLE_RATES[srIdx];
      if (!sampleRate) {
        ++pos;
        continue;
      }

      // Channel configuration: 3 bits spanning b2 and b3
      const channelConfig = ((b2 & 0x01) << 2) | ((b3 >> 6) & 0x03);
      const channels = channelConfig === 7 ? 8 : channelConfig;
      if (channels < 1) {
        ++pos;
        continue;
      }

      // Frame length: 13 bits spanning b3, b4, b5
      const frameLength = ((b3 & 0x03) << 11) | (b4 << 3) | ((b5 >> 5) & 0x07);
      if (frameLength < 7) {
        ++pos;
        continue;
      }

      // Number of raw data blocks: last 2 bits of b6
      const numBlocks = (b6 & 0x03) + 1;

      frames.push({
        offset: pos,
        length: frameLength,
        profile,
        sampleRate,
        channels,
      });

      // Each raw data block = 1024 samples
      totalSamples += numBlocks * 1024;
      lastSampleRate = sampleRate;

      pos += frameLength;
    }

    const totalFrames = frames.length;
    const duration = lastSampleRate > 0 ? totalSamples / lastSampleRate : 0;

    return { frames, totalFrames, duration };
  }

  // =========================================================================
  // FLAC frame header parser
  // =========================================================================

  const _FLAC_BLOCK_SIZES = [
    null, 192, 576, 1152, 2304, 4608,
    null, null, // 6=get 8-bit from end, 7=get 16-bit from end
    256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
  ];

  const _FLAC_SAMPLE_RATES = [
    null, 88200, 176400, 192000,
    8000, 16000, 22050, 24000,
    32000, 44100, 48000, 96000,
    null, null, null, null, // 12=get 8-bit kHz, 13=get 16-bit Hz, 14=get 16-bit 10Hz, 15=invalid
  ];

  const _FLAC_SAMPLE_SIZES = [null, 8, 12, null, 16, 20, 24, null];

  const _FLAC_CHANNEL_MODES = [
    '1ch (Mono)', '2ch (Stereo)', '3ch', '4ch', '5ch', '5.1ch', '6.1ch', '7.1ch',
    'Left/Side Stereo', 'Side/Right Stereo', 'Mid/Side Stereo',
  ];

  /**
   * Parse FLAC frame headers from the audio data portion.
   * @param {Uint8Array} bytes - File data
   * @param {number} audioDataOffset - Offset where FLAC audio data begins (after metadata blocks)
   * @param {number} [maxFrames=500] - Maximum frames to parse
   * @returns {{frames, totalFrames}}
   */
  function parseFLACFrameHeaders(bytes, audioDataOffset, maxFrames) {
    if (maxFrames == null) maxFrames = 500;

    const frames = [];
    const len = bytes.length;
    let pos = audioDataOffset;

    while (pos + 4 < len && frames.length < maxFrames) {
      // FLAC frame sync: 14 bits = 0x3FFE followed by 1 reserved bit (0) and blocking strategy bit
      // Byte pattern: 0xFF 0xF8 (fixed block size) or 0xFF 0xF9 (variable block size)
      if (bytes[pos] !== 0xFF || (bytes[pos + 1] & 0xFE) !== 0xF8) {
        ++pos;
        continue;
      }

      const blockingStrategy = bytes[pos + 1] & 0x01;

      if (pos + 4 >= len) break;
      const b2 = bytes[pos + 2];
      const b3 = bytes[pos + 3];

      // Block size code: upper 4 bits of b2
      const bsCode = (b2 >> 4) & 0x0F;
      let blockSize = _FLAC_BLOCK_SIZES[bsCode];

      // Sample rate code: lower 4 bits of b2
      const srCode = b2 & 0x0F;
      let sampleRate = _FLAC_SAMPLE_RATES[srCode];

      // Channel assignment: upper 4 bits of b3
      const chanCode = (b3 >> 4) & 0x0F;
      if (chanCode > 10) {
        ++pos;
        continue;
      }
      const channelMode = _FLAC_CHANNEL_MODES[chanCode] || (chanCode + 1) + 'ch';

      // Sample size: bits 3..1 of b3
      const ssCode = (b3 >> 1) & 0x07;
      const bitDepth = _FLAC_SAMPLE_SIZES[ssCode];

      // Reserved bit (must be 0)
      if (b3 & 0x01) {
        ++pos;
        continue;
      }

      // Skip the UTF-8 coded frame/sample number
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

      // Read block size from end of header if needed
      if (bsCode === 6 && hdrEnd < len) {
        blockSize = bytes[hdrEnd] + 1;
        ++hdrEnd;
      } else if (bsCode === 7 && hdrEnd + 1 < len) {
        blockSize = readU16BE(bytes, hdrEnd) + 1;
        hdrEnd += 2;
      }

      // Read sample rate from end of header if needed
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

      // Validate: block size and sample rate should be resolved
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

      // We don't know the exact compressed frame size, so skip ahead past this header
      // and search for the next sync code. Advance at least past the header.
      pos = hdrEnd + 1;
    }

    return { frames, totalFrames: frames.length };
  }

  // =========================================================================
  // PCM analyzer
  // =========================================================================

  /**
   * Analyze raw PCM sample data.
   * Supports 8-bit unsigned, 16-bit signed LE, 24-bit signed LE,
   * 32-bit signed LE, and 32-bit float LE.
   *
   * @param {Uint8Array} bytes - File data
   * @param {number} dataOffset - Start of PCM data
   * @param {number} dataLength - Length of PCM data in bytes
   * @param {number} bitsPerSample - 8, 16, 24, or 32
   * @param {number} channels - Channel count
   * @param {number} sampleRate - Sample rate in Hz
   * @param {object} [options] - Optional: { isFloat: false }
   * @returns {{rms, peak, peakDb, dcOffset, clipping, silence, sampleCount}}
   */
  function analyzePCM(bytes, dataOffset, dataLength, bitsPerSample, channels, sampleRate, options) {
    const isFloat = (options && options.isFloat) || (bitsPerSample === 32 && options && options.isFloat !== false && options.isFloat);
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = bytesPerSample * channels;
    const totalBytes = Math.min(dataLength, bytes.length - dataOffset);
    const totalSampleFrames = Math.floor(totalBytes / blockAlign);
    const sampleCount = totalSampleFrames * channels;

    if (sampleCount < 1)
      return { rms: 0, peak: 0, peakDb: -Infinity, dcOffset: 0, clipping: { count: 0, percent: 0 }, silence: { leading: 0, trailing: 0 }, sampleCount: 0 };

    // Determine normalization and clipping thresholds
    let maxVal, clipThreshold;
    if (isFloat) {
      maxVal = 1.0;
      clipThreshold = 1.0;
    } else if (bitsPerSample === 8) {
      maxVal = 128; // unsigned 8-bit: range 0..255, center=128
      clipThreshold = 127;
    } else if (bitsPerSample === 16) {
      maxVal = 32768;
      clipThreshold = 32767;
    } else if (bitsPerSample === 24) {
      maxVal = 8388608;
      clipThreshold = 8388607;
    } else {
      // 32-bit signed int
      maxVal = 2147483648;
      clipThreshold = 2147483647;
    }

    let sumSquared = 0;
    let sumValues = 0;
    let peak = 0;
    let clipCount = 0;

    // Silence detection: threshold at -60 dB relative to full scale
    const silenceThreshold = maxVal * 0.001;
    let leadingSilence = 0;
    let trailingSilence = 0;
    let foundNonSilent = false;

    // DataView for float reading
    let dv = null;
    if (isFloat)
      dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let f = 0; f < totalSampleFrames; ++f) {
      const frameOff = dataOffset + f * blockAlign;
      let frameIsSilent = true;

      for (let c = 0; c < channels; ++c) {
        const sampleOff = frameOff + c * bytesPerSample;
        let sample;

        if (isFloat) {
          sample = dv.getFloat32(sampleOff, true);
        } else if (bitsPerSample === 8) {
          // 8-bit unsigned: center at 128
          sample = bytes[sampleOff] - 128;
        } else if (bitsPerSample === 16) {
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8);
          if (sample > 32767) sample -= 65536;
        } else if (bitsPerSample === 24) {
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8) | (bytes[sampleOff + 2] << 16);
          if (sample > 8388607) sample -= 16777216;
        } else {
          // 32-bit signed LE
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8) | (bytes[sampleOff + 2] << 16) | (bytes[sampleOff + 3] << 24);
        }

        const absSample = Math.abs(sample);
        sumSquared += sample * sample;
        sumValues += sample;

        if (absSample > peak) peak = absSample;
        if (!isFloat && absSample >= clipThreshold) ++clipCount;
        else if (isFloat && absSample >= clipThreshold) ++clipCount;

        if (absSample > silenceThreshold) frameIsSilent = false;
      }

      if (frameIsSilent) {
        if (!foundNonSilent)
          ++leadingSilence;
        ++trailingSilence;
      } else {
        foundNonSilent = true;
        trailingSilence = 0;
      }
    }

    const rmsRaw = Math.sqrt(sumSquared / sampleCount);
    const rms = rmsRaw / maxVal;
    const peakNorm = peak / maxVal;
    const peakDb = peakNorm > 0 ? 20 * Math.log10(peakNorm) : -Infinity;
    const dcOffset = (sumValues / sampleCount) / maxVal;

    return {
      rms,
      peak: peakNorm,
      peakDb: Math.round(peakDb * 100) / 100,
      dcOffset: Math.round(dcOffset * 1e6) / 1e6,
      clipping: {
        count: clipCount,
        percent: Math.round(clipCount / sampleCount * 10000) / 100,
      },
      silence: {
        leading: sampleRate > 0 ? Math.round(leadingSilence / sampleRate * 1000) / 1000 : leadingSilence,
        trailing: sampleRate > 0 ? Math.round(trailingSilence / sampleRate * 1000) / 1000 : trailingSilence,
      },
      sampleCount,
    };
  }

  // =========================================================================
  // Export
  // =========================================================================

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = {
    // MP3
    scanMP3Frames,
    parseXingHeader,
    parseLAMETag,
    parseVBRIHeader,

    // AAC
    scanAACFrames,

    // FLAC
    parseFLACFrameHeaders,

    // PCM
    analyzePCM,
  };

})();
