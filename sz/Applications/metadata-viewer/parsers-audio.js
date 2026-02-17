;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readString, readUTF8, readUTF16, bytesToDataUrl, matchBytes } = P;

  // Standard ID3v1 genre list (0-191)
  const ID3_GENRES = [
    'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz','Metal',
    'New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno','Industrial',
    'Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk',
    'Fusion','Trance','Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
    'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop','Instrumental Rock','Ethnic','Gothic',
    'Darkwave','Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta',
    'Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave','Psychedelic','Rave','Showtunes',
    'Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock',
    'Folk','Folk-Rock','National Folk','Swing','Fast Fusion','Bebop','Latin','Revival','Celtic','Bluegrass',
    'Avantgarde','Gothic Rock','Progressive Rock','Psychedelic Rock','Symphonic Rock','Slow Rock','Big Band','Chorus','Easy Listening','Acoustic',
    'Humour','Speech','Chanson','Opera','Chamber Music','Sonata','Symphony','Booty Bass','Primus','Porn Groove',
    'Satire','Slow Jam','Club','Tango','Samba','Folklore','Ballad','Power Ballad','Rhythmic Soul','Freestyle',
    'Duet','Punk Rock','Drum Solo','A capella','Euro-House','Dance Hall','Goa','Drum & Bass','Club-House','Hardcore',
    'Terror','Indie','BritPop','Negerpunk','Polsk Punk','Beat','Christian Gangsta Rap','Heavy Metal','Black Metal','Crossover',
    'Contemporary Christian','Christian Rock','Merengue','Salsa','Thrash Metal','Anime','JPop','Synthpop','Abstract','Art Rock',
    'Baroque','Bhangra','Big Beat','Breakbeat','Chillout','Downtempo','Dub','EBM','Eclectic','Electro',
    'Electroclash','Emo','Experimental','Garage','Global','IDM','Illbient','Industro-Goth','Jam Band','Krautrock',
    'Leftfield','Lounge','Math Rock','New Romantic','Nu-Breakz','Post-Punk','Post-Rock','Psytrance','Shoegaze','Space Rock',
    'Trop Rock','World Music','Neoclassical','Audiobook','Audio Theatre','Neue Deutsche Welle','Podcast','Indie Rock','G-Funk','Dubstep',
    'Garage Rock','Psybient',
  ];

  // Export for controller.js genre autocomplete
  P.ID3_GENRES = ID3_GENRES;

  // =========================================================================
  // MP3 / ID3 parser
  // =========================================================================

  function parseMP3(bytes) {
    const categories = [];
    const images = [];
    const audioFields = [];
    const byteRegions = [];

    // ID3v2
    if (bytes.length >= 10 && matchBytes(bytes, 0, [0x49, 0x44, 0x33])) {
      const id3version = bytes[3] + '.' + bytes[4];
      const flags = bytes[5];
      const size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
      const id3Fields = [];
      id3Fields.push({ key: 'id3.version', label: 'ID3 Version', value: '2.' + id3version });

      byteRegions.push({ offset: 0, length: 10, label: 'ID3v2 Header', color: 0 });

      let pos = 10;
      if (flags & 0x40) pos += readU32BE(bytes, 10) + 4;

      const isV23 = bytes[3] >= 3;
      const headerSize = isV23 ? 10 : 6;

      while (pos + headerSize < 10 + size && pos + headerSize < bytes.length) {
        let frameId, frameSize;
        if (isV23) {
          frameId = readString(bytes, pos, 4);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{4}$/.test(frameId)) break;
          if (bytes[3] >= 4)
            frameSize = ((bytes[pos + 4] & 0x7F) << 21) | ((bytes[pos + 5] & 0x7F) << 14) | ((bytes[pos + 6] & 0x7F) << 7) | (bytes[pos + 7] & 0x7F);
          else
            frameSize = readU32BE(bytes, pos + 4);
          pos += 10;
        } else {
          frameId = readString(bytes, pos, 3);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{3}$/.test(frameId)) break;
          frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
          pos += 6;
        }

        if (frameSize <= 0 || pos + frameSize > bytes.length) break;

        const frameData = pos;
        const frameNames = {
          TIT2: 'Title', TPE1: 'Artist', TALB: 'Album', TYER: 'Year', TDRC: 'Year',
          TCON: 'Genre', TRCK: 'Track', COMM: 'Comment', TCOM: 'Composer',
          TPE2: 'Album Artist', TPOS: 'Disc',
          TIT1: 'Content Group', TIT3: 'Subtitle', TPE3: 'Conductor', TPE4: 'Remixed By',
          TBPM: 'BPM', TCOP: 'Copyright', TENC: 'Encoded By', TPUB: 'Publisher',
          TKEY: 'Initial Key', TLAN: 'Language', TLEN: 'Length', TMED: 'Media Type',
          TOAL: 'Original Album', TOPE: 'Original Artist', TORY: 'Original Year',
          TDOR: 'Original Release Date', TSRC: 'ISRC', TSSE: 'Encoding Settings',
          TSOP: 'Performer Sort', TSOA: 'Album Sort', TSOT: 'Title Sort',
          TCMP: 'Compilation', TFLT: 'File Type', TEXT: 'Lyricist', TOFN: 'Original Filename',
          TOWN: 'File Owner', TDLY: 'Playlist Delay', TDTG: 'Tagging Time',
          TMOO: 'Mood', TPRO: 'Produced Notice', TSST: 'Set Subtitle',
          WORS: 'Radio Station URL', WOAR: 'Artist URL', WPUB: 'Publisher URL',
          TT2: 'Title', TP1: 'Artist', TAL: 'Album', TYE: 'Year', TCO: 'Genre', TRK: 'Track',
          TP2: 'Album Artist', TCM: 'Composer', TP3: 'Conductor', TCR: 'Copyright',
          TEN: 'Encoded By', TPB: 'Publisher', TKE: 'Initial Key', TLA: 'Language',
          TOA: 'Original Artist', TOT: 'Original Album', TOR: 'Original Year',
        };

        if (frameNames[frameId]) {
          const encoding = readU8(bytes, frameData);
          let text = '';
          if (frameId === 'COMM' || frameId === 'COM') {
            const langEnd = frameData + 4;
            let descEnd = langEnd;
            if (encoding === 1 || encoding === 2) {
              while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
              descEnd += 2;
            } else {
              while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
              ++descEnd;
            }
            if (encoding === 0 || encoding === 3)
              text = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
            else
              text = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          } else {
            if (encoding === 0 || encoding === 3)
              text = readUTF8(bytes, frameData + 1, frameSize - 1);
            else if (encoding === 1 || encoding === 2)
              text = readUTF16(bytes, frameData + 1, frameSize - 1, encoding === 1);
          }
          text = text.replace(/\0+$/, '').trim();
          if ((frameId === 'TCON' || frameId === 'TCO') && text) {
            const genreMatch = text.match(/^\((\d+)\)/);
            if (genreMatch) {
              const genreIdx = parseInt(genreMatch[1]);
              const genreName = ID3_GENRES[genreIdx];
              text = genreName || text.substring(genreMatch[0].length) || text;
            }
          }
          if (text) {
            let editType = 'text';
            const numericFrames = ['TYER', 'TDRC', 'TRCK', 'TPOS', 'TBPM'];
            if (frameId === 'TCON' || frameId === 'TCO') editType = 'genre';
            else if (numericFrames.includes(frameId)) editType = 'number';
            id3Fields.push({
              key: 'id3.' + frameId,
              label: frameNames[frameId],
              value: text,
              editable: true,
              editType,
            });
          }
        }

        // TXXX — user-defined text
        if (frameId === 'TXXX' || frameId === 'TXX') {
          const encoding = readU8(bytes, frameData);
          let descEnd = frameData + 1;
          let description = '', value = '';
          if (encoding === 1 || encoding === 2) {
            while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
            description = readUTF16(bytes, frameData + 1, descEnd - frameData - 1, encoding === 1);
            descEnd += 2;
            value = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          } else {
            while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
            description = readUTF8(bytes, frameData + 1, descEnd - frameData - 1);
            ++descEnd;
            value = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
          }
          description = description.replace(/\0+$/, '').trim();
          value = value.replace(/\0+$/, '').trim();
          if (description && value)
            id3Fields.push({ key: 'id3.TXXX.' + description, label: description, value, editable: true, editType: 'text' });
        }

        // USLT — unsynchronized lyrics
        if (frameId === 'USLT' || frameId === 'ULT') {
          const encoding = readU8(bytes, frameData);
          const langEnd = frameData + 4;
          let descEnd = langEnd;
          if (encoding === 1 || encoding === 2) {
            while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
            descEnd += 2;
          } else {
            while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
            ++descEnd;
          }
          let lyrics = '';
          if (encoding === 0 || encoding === 3)
            lyrics = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
          else
            lyrics = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          lyrics = lyrics.replace(/\0+$/, '').trim();
          if (lyrics)
            id3Fields.push({ key: 'id3.USLT', label: 'Lyrics', value: lyrics, editable: true, editType: 'text' });
        }

        // PCNT — play counter
        if (frameId === 'PCNT' || frameId === 'CNT') {
          let count = 0;
          for (let i = 0; i < frameSize && i < 4; ++i) count = (count << 8) | bytes[frameData + i];
          id3Fields.push({ key: 'id3.PCNT', label: 'Play Count', value: String(count) });
        }

        // POPM — popularimeter (rating)
        if (frameId === 'POPM' || frameId === 'POP') {
          let emailEnd = frameData;
          while (emailEnd < frameData + frameSize && bytes[emailEnd] !== 0) ++emailEnd;
          const rating = emailEnd + 1 < frameData + frameSize ? bytes[emailEnd + 1] : 0;
          const stars = rating === 0 ? 0 : rating < 64 ? 1 : rating < 128 ? 2 : rating < 196 ? 3 : rating < 255 ? 4 : 5;
          id3Fields.push({ key: 'id3.POPM', label: 'Rating', value: stars > 0 ? '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars) + ' (' + rating + '/255)' : 'Not rated' });
        }

        // W*** — URL frames
        if (/^W[A-Z]{3}$/.test(frameId) && frameId !== 'WXXX' && frameNames[frameId]) {
          const url = readString(bytes, frameData, frameSize).replace(/\0+$/, '').trim();
          if (url)
            id3Fields.push({ key: 'id3.' + frameId, label: frameNames[frameId], value: url });
        }

        // APIC — album art
        if (frameId === 'APIC' || frameId === 'PIC') {
          const enc = readU8(bytes, frameData);
          let mimeEnd = frameData + 1;
          while (mimeEnd < frameData + frameSize && bytes[mimeEnd] !== 0) ++mimeEnd;
          const mime = readString(bytes, frameData + 1, mimeEnd - frameData - 1);
          let imgStart = mimeEnd + 2;
          if (enc === 1 || enc === 2) {
            while (imgStart + 1 < frameData + frameSize && !(bytes[imgStart] === 0 && bytes[imgStart + 1] === 0)) ++imgStart;
            imgStart += 2;
          } else {
            while (imgStart < frameData + frameSize && bytes[imgStart] !== 0) ++imgStart;
            ++imgStart;
          }
          if (imgStart < frameData + frameSize) {
            const imgBytes = bytes.slice(imgStart, frameData + frameSize);
            const mimeType = mime.includes('png') ? 'image/png' : 'image/jpeg';
            images.push({ label: 'Album Art', mimeType, dataUrl: bytesToDataUrl(imgBytes, mimeType) });
          }
        }

        pos += frameSize;
      }

      if (id3Fields.length > 0)
        categories.push({ name: 'ID3v2', icon: 'music', fields: id3Fields });
    }

    // Find MPEG frame header for audio details
    let mpegStart = 0;
    if (bytes.length >= 10 && matchBytes(bytes, 0, [0x49, 0x44, 0x33])) {
      const size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
      mpegStart = 10 + size;
    }

    for (let i = mpegStart; i < Math.min(bytes.length - 4, mpegStart + 4096); ++i) {
      if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
        const hdr = readU32BE(bytes, i);
        const version = (hdr >> 19) & 3;
        const layer = (hdr >> 17) & 3;
        const brIndex = (hdr >> 12) & 0xF;
        const srIndex = (hdr >> 10) & 3;
        const channelMode = (hdr >> 6) & 3;

        const versionNames = { 0: 'MPEG 2.5', 2: 'MPEG 2', 3: 'MPEG 1' };
        const layerNames = { 1: 'Layer III', 2: 'Layer II', 3: 'Layer I' };
        const channelNames = { 0: 'Stereo', 1: 'Joint Stereo', 2: 'Dual Channel', 3: 'Mono' };

        const bitrateTable = [
          [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
          [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
          [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
        ];
        const sampleRateTable = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

        const layerIdx = layer === 3 ? 0 : layer === 2 ? 1 : 2;
        const bitrate = bitrateTable[layerIdx] ? bitrateTable[layerIdx][brIndex] : 0;
        const sampleRate = sampleRateTable[version] ? sampleRateTable[version][srIndex] : 0;

        if (versionNames[version]) audioFields.push({ key: 'mp3.version', label: 'MPEG Version', value: versionNames[version] });
        if (layerNames[layer]) audioFields.push({ key: 'mp3.layer', label: 'Layer', value: layerNames[layer] });
        if (bitrate) audioFields.push({ key: 'mp3.bitrate', label: 'Bitrate', value: bitrate + ' kbps' });
        if (sampleRate) audioFields.push({ key: 'mp3.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
        audioFields.push({ key: 'mp3.channels', label: 'Channels', value: channelNames[channelMode] || 'Unknown' });

        if (bitrate && sampleRate) {
          const durationSec = Math.floor((bytes.length - mpegStart) * 8 / (bitrate * 1000));
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          audioFields.push({ key: 'mp3.duration', label: 'Duration (est.)', value: min + ':' + String(sec).padStart(2, '0') });
        }
        break;
      }
    }

    // ID3v1 (last 128 bytes)
    if (bytes.length >= 128) {
      const tagStart = bytes.length - 128;
      if (matchBytes(bytes, tagStart, [0x54, 0x41, 0x47])) {
        const id3v1Fields = [];
        const v1Title = readString(bytes, tagStart + 3, 30).trim();
        const v1Artist = readString(bytes, tagStart + 33, 30).trim();
        const v1Album = readString(bytes, tagStart + 63, 30).trim();
        const v1Year = readString(bytes, tagStart + 93, 4).trim();
        const v1Comment = readString(bytes, tagStart + 97, 30).trim();
        const v1Genre = readU8(bytes, tagStart + 127);
        if (v1Title) id3v1Fields.push({ key: 'id3v1.title', label: 'Title', value: v1Title, editable: true, editType: 'text' });
        if (v1Artist) id3v1Fields.push({ key: 'id3v1.artist', label: 'Artist', value: v1Artist, editable: true, editType: 'text' });
        if (v1Album) id3v1Fields.push({ key: 'id3v1.album', label: 'Album', value: v1Album, editable: true, editType: 'text' });
        if (v1Year) id3v1Fields.push({ key: 'id3v1.year', label: 'Year', value: v1Year, editable: true, editType: 'number', min: 0, max: 9999 });
        if (v1Comment) id3v1Fields.push({ key: 'id3v1.comment', label: 'Comment', value: v1Comment, editable: true, editType: 'text' });
        const v1GenreName = ID3_GENRES[v1Genre] || ('Unknown (' + v1Genre + ')');
        id3v1Fields.push({ key: 'id3v1.genre', label: 'Genre', value: v1GenreName });
        if (id3v1Fields.length > 0)
          categories.push({ name: 'ID3v1', icon: 'music', fields: id3v1Fields });
      }
    }

    if (audioFields.length > 0)
      categories.push({ name: 'Audio', icon: 'audio', fields: audioFields });

    // Codec details via shared codec-audio.js library
    const CA = window.SZ && SZ.Formats && SZ.Formats.Codecs && SZ.Formats.Codecs.Audio;
    if (CA) {
      const codecFields = [];
      try {
        // Xing/LAME/VBRI headers
        const xing = CA.parseXingHeader(bytes, mpegStart);
        if (xing) {
          if (xing.totalFrames) codecFields.push({ key: 'codec.mp3.xingFrames', label: 'Total Frames (Xing)', value: String(xing.totalFrames) });
          if (xing.totalBytes) codecFields.push({ key: 'codec.mp3.xingBytes', label: 'Audio Size (Xing)', value: P.formatSize(xing.totalBytes) });
          if (xing.quality != null) codecFields.push({ key: 'codec.mp3.xingQuality', label: 'VBR Quality', value: String(xing.quality) });
          codecFields.push({ key: 'codec.mp3.xingTag', label: 'Header Type', value: xing.tag || 'Xing' });
          if (xing.lame) {
            const l = xing.lame;
            if (l.encoder) codecFields.push({ key: 'codec.mp3.encoder', label: 'Encoder', value: l.encoder });
            if (l.vbrMethod) codecFields.push({ key: 'codec.mp3.vbrMethod', label: 'VBR Method', value: String(l.vbrMethod) });
            if (l.lowpass) codecFields.push({ key: 'codec.mp3.lowpass', label: 'Lowpass', value: (l.lowpass * 100) + ' Hz' });
            if (l.encoderDelay) codecFields.push({ key: 'codec.mp3.delay', label: 'Encoder Delay', value: l.encoderDelay + ' samples' });
            if (l.encoderPadding) codecFields.push({ key: 'codec.mp3.padding', label: 'Encoder Padding', value: l.encoderPadding + ' samples' });
            if (l.mp3Gain != null) codecFields.push({ key: 'codec.mp3.gain', label: 'MP3 Gain', value: l.mp3Gain.toFixed(1) + ' dB' });
          }
        }

        const vbri = CA.parseVBRIHeader(bytes, mpegStart);
        if (vbri) {
          codecFields.push({ key: 'codec.mp3.vbriTag', label: 'Header Type', value: 'VBRI v' + vbri.version });
          if (vbri.totalFrames) codecFields.push({ key: 'codec.mp3.vbriFrames', label: 'Total Frames (VBRI)', value: String(vbri.totalFrames) });
          if (vbri.totalBytes) codecFields.push({ key: 'codec.mp3.vbriBytes', label: 'Audio Size (VBRI)', value: P.formatSize(vbri.totalBytes) });
          if (vbri.quality != null) codecFields.push({ key: 'codec.mp3.vbriQuality', label: 'Quality', value: String(vbri.quality) });
        }

        // Frame scan (limited to first 500 frames)
        const scan = CA.scanMP3Frames(bytes, mpegStart, 500);
        if (scan && scan.totalFrames > 0) {
          codecFields.push({ key: 'codec.mp3.framesScanned', label: 'Frames Scanned', value: String(scan.totalFrames) });
          codecFields.push({ key: 'codec.mp3.vbr', label: 'Bitrate Mode', value: scan.isVBR ? 'VBR' : 'CBR' });
          if (scan.avgBitrate) codecFields.push({ key: 'codec.mp3.avgBitrate', label: 'Average Bitrate', value: Math.round(scan.avgBitrate) + ' kbps' });
          if (scan.duration) {
            const min = Math.floor(scan.duration / 60);
            const sec = Math.floor(scan.duration % 60);
            codecFields.push({ key: 'codec.mp3.scanDuration', label: 'Duration (scan)', value: min + ':' + String(sec).padStart(2, '0') });
          }
        }
      } catch (_) { /* codec analysis is best-effort */ }

      if (codecFields.length > 0)
        categories.push({ name: 'Codec Details', icon: 'audio', fields: codecFields });
    }

    return { categories, images, byteRegions };
  }

  // =========================================================================
  // FLAC parser
  // =========================================================================

  function parseFLAC(bytes) {
    const categories = [];
    const images = [];
    const audioFields = [];

    let pos = 4;
    while (pos < bytes.length) {
      const header = readU8(bytes, pos);
      const isLast = (header & 0x80) !== 0;
      const blockType = header & 0x7F;
      const blockLen = (readU8(bytes, pos + 1) << 16) | (readU8(bytes, pos + 2) << 8) | readU8(bytes, pos + 3);
      const blockData = pos + 4;

      if (blockType === 0 && blockLen >= 34) {
        const sampleRate = (readU8(bytes, blockData + 10) << 12) | (readU8(bytes, blockData + 11) << 4) | (readU8(bytes, blockData + 12) >> 4);
        const channels = ((readU8(bytes, blockData + 12) >> 1) & 0x07) + 1;
        const bitsPerSample = ((readU8(bytes, blockData + 12) & 0x01) << 4) | (readU8(bytes, blockData + 13) >> 4) + 1;
        const totalSamples = ((readU8(bytes, blockData + 13) & 0x0F) * 0x100000000) + readU32BE(bytes, blockData + 14);

        audioFields.push({ key: 'flac.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
        audioFields.push({ key: 'flac.channels', label: 'Channels', value: String(channels) });
        audioFields.push({ key: 'flac.bitsPerSample', label: 'Bits Per Sample', value: String(bitsPerSample) });
        if (totalSamples > 0 && sampleRate > 0) {
          const durationSec = Math.floor(totalSamples / sampleRate);
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          audioFields.push({ key: 'flac.duration', label: 'Duration', value: min + ':' + String(sec).padStart(2, '0') });
        }
      }

      if (blockType === 4 && blockLen > 4) {
        const commentFields = [];
        const vendorLen = readU32LE(bytes, blockData);
        const vendor = readUTF8(bytes, blockData + 4, vendorLen);
        commentFields.push({ key: 'flac.vendor', label: 'Encoder', value: vendor });
        let cPos = blockData + 4 + vendorLen;
        if (cPos + 4 <= blockData + blockLen) {
          const numComments = readU32LE(bytes, cPos);
          cPos += 4;
          for (let i = 0; i < numComments && cPos + 4 <= blockData + blockLen; ++i) {
            const cLen = readU32LE(bytes, cPos);
            cPos += 4;
            const comment = readUTF8(bytes, cPos, cLen);
            cPos += cLen;
            const eq = comment.indexOf('=');
            if (eq > 0) {
              const key = comment.substring(0, eq).toUpperCase();
              const val = comment.substring(eq + 1);
              commentFields.push({ key: 'flac.tag.' + key, label: key.charAt(0) + key.substring(1).toLowerCase(), value: val });
            }
          }
        }
        if (commentFields.length > 0)
          categories.push({ name: 'Vorbis Comments', icon: 'music', fields: commentFields });
      }

      if (blockType === 6 && blockLen > 32) {
        let pPos = blockData;
        pPos += 4;
        const mimeLen = readU32BE(bytes, pPos); pPos += 4;
        const mime = readUTF8(bytes, pPos, mimeLen); pPos += mimeLen;
        const descLen = readU32BE(bytes, pPos); pPos += 4;
        pPos += descLen;
        pPos += 16;
        const dataLen = readU32BE(bytes, pPos); pPos += 4;
        if (pPos + dataLen <= bytes.length) {
          const imgBytes = bytes.slice(pPos, pPos + dataLen);
          images.push({ label: 'Cover Art', mimeType: mime || 'image/jpeg', dataUrl: bytesToDataUrl(imgBytes, mime || 'image/jpeg') });
        }
      }

      pos = blockData + blockLen;
      if (isLast) break;
    }

    if (audioFields.length > 0)
      categories.push({ name: 'Audio', icon: 'audio', fields: audioFields });

    // FLAC codec details via shared library
    const CA = window.SZ && SZ.Formats && SZ.Formats.Codecs && SZ.Formats.Codecs.Audio;
    if (CA && CA.parseFLACFrameHeaders && pos < bytes.length) {
      try {
        const frameInfo = CA.parseFLACFrameHeaders(bytes, pos, 200);
        if (frameInfo && frameInfo.totalFrames > 0) {
          const codecFields = [];
          codecFields.push({ key: 'codec.flac.framesScanned', label: 'Frames Scanned', value: String(frameInfo.totalFrames) });
          const first = frameInfo.frames[0];
          if (first) {
            if (first.blockSize) codecFields.push({ key: 'codec.flac.blockSize', label: 'Block Size', value: String(first.blockSize) + ' samples' });
            if (first.channelMode) codecFields.push({ key: 'codec.flac.channelMode', label: 'Channel Assignment', value: first.channelMode });
          }
          // Check if variable block size
          const sizes = new Set(frameInfo.frames.map(f => f.blockSize));
          codecFields.push({ key: 'codec.flac.blocking', label: 'Blocking', value: sizes.size > 1 ? 'Variable (' + sizes.size + ' sizes)' : 'Fixed' });
          if (codecFields.length > 0)
            categories.push({ name: 'Codec Details', icon: 'audio', fields: codecFields });
        }
      } catch (_) { /* best-effort */ }
    }

    return { categories, images };
  }

  // =========================================================================
  // WAV parser
  // =========================================================================

  function parseWAV(bytes) {
    const fields = [];
    const categories = [];
    if (bytes.length < 44) return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };

    let wavFormat = 0, wavChannels = 0, wavSampleRate = 0, wavBitsPerSample = 0;
    let dataOffset = 0, dataLength = 0;

    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = readString(bytes, pos, 4);
      const chunkSize = readU32LE(bytes, pos + 4);
      const chunkData = pos + 8;

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        wavFormat = readU16LE(bytes, chunkData);
        wavChannels = readU16LE(bytes, chunkData + 2);
        wavSampleRate = readU32LE(bytes, chunkData + 4);
        const byteRate = readU32LE(bytes, chunkData + 8);
        wavBitsPerSample = readU16LE(bytes, chunkData + 14);

        const formatNames = { 1: 'PCM', 3: 'IEEE Float', 6: 'A-law', 7: 'mu-law', 0xFFFE: 'Extensible' };
        fields.push({ key: 'wav.format', label: 'Format', value: formatNames[wavFormat] || String(wavFormat) });
        fields.push({ key: 'wav.channels', label: 'Channels', value: String(wavChannels) });
        fields.push({ key: 'wav.sampleRate', label: 'Sample Rate', value: wavSampleRate + ' Hz' });
        fields.push({ key: 'wav.bitsPerSample', label: 'Bits Per Sample', value: String(wavBitsPerSample) });
        fields.push({ key: 'wav.bitrate', label: 'Bitrate', value: Math.round(byteRate * 8 / 1000) + ' kbps' });
      }

      if (chunkId === 'data') {
        dataOffset = chunkData;
        dataLength = chunkSize;
        const fmtChunkData = 12;
        const byteRate = readU32LE(bytes, fmtChunkData + 16);
        if (byteRate > 0) {
          const durationSec = Math.floor(chunkSize / byteRate);
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          fields.push({ key: 'wav.duration', label: 'Duration', value: min + ':' + String(sec).padStart(2, '0') });
        }
      }

      pos = chunkData + chunkSize + (chunkSize & 1);
    }

    categories.push({ name: 'Audio', icon: 'audio', fields });

    // PCM analysis via shared codec-audio.js library
    const CA = window.SZ && SZ.Formats && SZ.Formats.Codecs && SZ.Formats.Codecs.Audio;
    if (CA && CA.analyzePCM && dataOffset > 0 && dataLength > 0 && (wavFormat === 1 || wavFormat === 3)) {
      try {
        const pcm = CA.analyzePCM(bytes, dataOffset, Math.min(dataLength, bytes.length - dataOffset), wavBitsPerSample, wavChannels, wavSampleRate);
        if (pcm) {
          const pcmFields = [];
          pcmFields.push({ key: 'pcm.rms', label: 'RMS Level', value: pcm.rms.toFixed(4) + ' (' + (20 * Math.log10(Math.max(pcm.rms, 1e-10))).toFixed(1) + ' dB)' });
          pcmFields.push({ key: 'pcm.peak', label: 'Peak Level', value: pcm.peak.toFixed(4) + ' (' + pcm.peakDb.toFixed(1) + ' dB)' });
          pcmFields.push({ key: 'pcm.dc', label: 'DC Offset', value: pcm.dcOffset.toFixed(6) });
          pcmFields.push({ key: 'pcm.clipping', label: 'Clipping', value: pcm.clipping.count > 0 ? pcm.clipping.count + ' samples (' + pcm.clipping.percent.toFixed(2) + '%)' : 'None' });
          if (pcm.silence) {
            if (pcm.silence.leading > 0) pcmFields.push({ key: 'pcm.silenceLead', label: 'Leading Silence', value: pcm.silence.leading.toFixed(3) + ' s' });
            if (pcm.silence.trailing > 0) pcmFields.push({ key: 'pcm.silenceTrail', label: 'Trailing Silence', value: pcm.silence.trailing.toFixed(3) + ' s' });
          }
          pcmFields.push({ key: 'pcm.samples', label: 'Total Samples', value: String(pcm.sampleCount) });
          categories.push({ name: 'PCM Analysis', icon: 'audio', fields: pcmFields });
        }
      } catch (_) { /* best-effort */ }
    }

    return { categories, images: [] };
  }

  // =========================================================================
  // OGG parser
  // =========================================================================

  function parseOGG(bytes) {
    const fields = [];
    if (bytes.length < 58) return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };

    const segments = readU8(bytes, 26);
    let dataStart = 27;
    let payloadSize = 0;
    for (let i = 0; i < segments && dataStart + i < bytes.length; ++i)
      payloadSize += readU8(bytes, dataStart + i);
    dataStart += segments;

    if (dataStart + 30 <= bytes.length && matchBytes(bytes, dataStart, [0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73])) {
      const channels = readU8(bytes, dataStart + 11);
      const sampleRate = readU32LE(bytes, dataStart + 12);
      const nomBitrate = readI32LE(bytes, dataStart + 20);

      fields.push({ key: 'ogg.codec', label: 'Codec', value: 'Vorbis' });
      fields.push({ key: 'ogg.channels', label: 'Channels', value: String(channels) });
      fields.push({ key: 'ogg.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
      if (nomBitrate > 0) fields.push({ key: 'ogg.bitrate', label: 'Nominal Bitrate', value: Math.round(nomBitrate / 1000) + ' kbps' });
    }

    return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };
  }

  P.registerParsers({ mp3: parseMP3, flac: parseFLAC, wav: parseWAV, ogg: parseOGG });
})();
