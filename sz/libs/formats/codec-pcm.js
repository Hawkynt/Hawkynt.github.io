;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // PCM analyzer
  // =========================================================================

  function analyzePCM(bytes, dataOffset, dataLength, bitsPerSample, channels, sampleRate, options) {
    const isFloat = (options && options.isFloat) || (bitsPerSample === 32 && options && options.isFloat !== false && options.isFloat);
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = bytesPerSample * channels;
    const totalBytes = Math.min(dataLength, bytes.length - dataOffset);
    const totalSampleFrames = Math.floor(totalBytes / blockAlign);
    const sampleCount = totalSampleFrames * channels;

    if (sampleCount < 1)
      return { rms: 0, peak: 0, peakDb: -Infinity, dcOffset: 0, clipping: { count: 0, percent: 0 }, silence: { leading: 0, trailing: 0 }, sampleCount: 0 };

    let maxVal, clipThreshold;
    if (isFloat) {
      maxVal = 1.0;
      clipThreshold = 1.0;
    } else if (bitsPerSample === 8) {
      maxVal = 128;
      clipThreshold = 127;
    } else if (bitsPerSample === 16) {
      maxVal = 32768;
      clipThreshold = 32767;
    } else if (bitsPerSample === 24) {
      maxVal = 8388608;
      clipThreshold = 8388607;
    } else {
      maxVal = 2147483648;
      clipThreshold = 2147483647;
    }

    let sumSquared = 0;
    let sumValues = 0;
    let peak = 0;
    let clipCount = 0;

    const silenceThreshold = maxVal * 0.001;
    let leadingSilence = 0;
    let trailingSilence = 0;
    let foundNonSilent = false;

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
          sample = bytes[sampleOff] - 128;
        } else if (bitsPerSample === 16) {
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8);
          if (sample > 32767) sample -= 65536;
        } else if (bitsPerSample === 24) {
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8) | (bytes[sampleOff + 2] << 16);
          if (sample > 8388607) sample -= 16777216;
        } else {
          sample = bytes[sampleOff] | (bytes[sampleOff + 1] << 8) | (bytes[sampleOff + 2] << 16) | (bytes[sampleOff + 3] << 24);
        }

        const absSample = Math.abs(sample);
        sumSquared += sample * sample;
        sumValues += sample;

        if (absSample > peak) peak = absSample;
        if (absSample >= clipThreshold) ++clipCount;

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
  // Registration + backward compat
  // =========================================================================

  F.register('wav', {
    name: 'WAV/PCM Audio',
    category: 'audio',
    extensions: ['wav', 'wave'],
    mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'],
    access: 'rw',
    detect(bytes) {
      if (bytes.length < 12) return false;
      return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
    },
    codec: { analyzePCM },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.analyzePCM = analyzePCM;

})();
