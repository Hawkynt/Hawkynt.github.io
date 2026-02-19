;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32LE, readU16LE, readU8, readString } = F;

  // =========================================================================
  // Ogg page parser
  // =========================================================================

  function parseOggPages(bytes, maxPages) {
    const limit = maxPages || 64;
    const pages = [];
    let pos = 0;

    while (pos + 27 <= bytes.length && pages.length < limit) {
      const magic = readString(bytes, pos, 4);
      if (magic !== 'OggS') {
        ++pos;
        continue;
      }

      const version = readU8(bytes, pos + 4);
      const headerType = readU8(bytes, pos + 5);
      const granulePos = readU32LE(bytes, pos + 6);
      const serialNumber = readU32LE(bytes, pos + 14);
      const pageSequence = readU32LE(bytes, pos + 18);
      const numSegments = readU8(bytes, pos + 26);

      if (pos + 27 + numSegments > bytes.length) break;

      let pageDataSize = 0;
      for (let i = 0; i < numSegments; ++i)
        pageDataSize += bytes[pos + 27 + i];

      const headerSize = 27 + numSegments;

      pages.push({
        offset: pos,
        headerSize,
        dataSize: pageDataSize,
        totalSize: headerSize + pageDataSize,
        version,
        headerType,
        granulePos,
        serialNumber,
        pageSequence,
        bos: !!(headerType & 0x02),
        eos: !!(headerType & 0x04),
        continued: !!(headerType & 0x01),
      });

      pos += headerSize + pageDataSize;
    }

    return pages;
  }

  function parse(bytes) {
    const pages = parseOggPages(bytes, 16);
    if (pages.length === 0) return null;

    let codecType = 'unknown';
    if (pages.length > 0 && pages[0].bos) {
      const dataOff = pages[0].offset + pages[0].headerSize;
      if (dataOff + 7 <= bytes.length) {
        const sig = readString(bytes, dataOff, 7);
        if (sig === '\x01vorbis') codecType = 'vorbis';
        else if (sig === 'OpusHea') codecType = 'opus';
        else if (sig === '\x7fFLAC') codecType = 'flac';
        else if (sig === '\x80theora') codecType = 'theora';
      }
    }

    return { pages: pages.length, codecType, firstPage: pages[0] || null };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('ogg', {
    name: 'Ogg Container',
    category: 'audio',
    extensions: ['ogg', 'oga', 'ogv', 'ogx'],
    mimeTypes: ['audio/ogg', 'video/ogg', 'application/ogg'],
    access: 'ro',
    detect(bytes) {
      return bytes.length >= 4 && bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
    },
    codec: { parseOggPages },
    parse,
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Audio = F.Codecs.Audio || {};
  F.Codecs.Audio.parseOggPages = parseOggPages;

})();
