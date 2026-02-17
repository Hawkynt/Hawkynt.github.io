;(function() { 'use strict';

const A = window.SZ.Archiver;
const { IArchiveFormat, makeEntry,
        getFileName, getFileExtension, stripExtension,
        crc32Hex } = A;

// FORMAT: Base64
// =======================================================================

class Base64Format extends IArchiveFormat {
  static get id() { return 'base64'; }
  static get displayName() { return 'Base64 Encoded'; }
  static get extensions() { return ['b64']; }
  static get canCreate() { return true; }

  static detect(bytes, fileName) {
    const ext = getFileExtension(fileName || '');
    if (ext === 'b64') return true;
    if (bytes.length > 4 && bytes.length < 1048576) {
      const text = new TextDecoder().decode(bytes).trim();
      return /^[A-Za-z0-9+/\r\n]+=*$/.test(text);
    }
    return false;
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const text = new TextDecoder().decode(bytes).trim().replace(/\s/g, '');
    const binStr = atob(text);
    const data = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; ++i)
      data[i] = binStr.charCodeAt(i);
    const innerName = stripExtension(getFileName(fileName || 'file.b64'));
    return [makeEntry(innerName, data.length, bytes.length, null, crc32Hex(data), false, false, data, handler)];
  }

  async build(entries, _password, _options) {
    const entry = entries.find(e => !e.isDirectory);
    if (!entry || !entry._data) return new Uint8Array(0);
    const data = entry._data instanceof Uint8Array ? entry._data : null;
    if (!data) return new Uint8Array(0);
    let binStr = '';
    const CHUNK = 8192;
    for (let i = 0; i < data.length; i += CHUNK)
      binStr += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK));
    const b64 = btoa(binStr);
    const lines = [];
    for (let i = 0; i < b64.length; i += 76)
      lines.push(b64.substring(i, i + 76));
    return new TextEncoder().encode(lines.join('\r\n') + '\r\n');
  }
}

// FORMAT: UUEncode (.uue)
// =======================================================================

class UueFormat extends IArchiveFormat {
  static get id() { return 'uue'; }
  static get displayName() { return 'UUEncoded'; }
  static get extensions() { return ['uue', 'uu']; }
  static get canCreate() { return true; }

  static detect(bytes, _fileName) {
    if (bytes.length < 10) return false;
    const header = new TextDecoder().decode(bytes.subarray(0, Math.min(100, bytes.length)));
    return /^begin\s+[0-7]{3,4}\s+\S+/m.test(header);
  }

  async parse(bytes, _fileName, _password) {
    const handler = this;
    const text = new TextDecoder().decode(bytes);
    const match = text.match(/^begin\s+[0-7]{3,4}\s+(.+)$/m);
    if (!match) return [];
    const entryName = match[1].trim();
    const lines = text.split('\n');
    const chunks = [];
    let started = false;

    for (const line of lines) {
      if (line.startsWith('begin ')) { started = true; continue; }
      if (!started || line.length === 0) continue;
      if (line === '`' || line.startsWith('end')) break;
      const n = (line.charCodeAt(0) - 32) & 63;
      if (n === 0) break;
      const decoded = new Uint8Array(n);
      let di = 0;
      for (let i = 1; i < line.length && di < n; i += 4) {
        const c = [0, 1, 2, 3].map(j => (line.charCodeAt(i + j) - 32) & 63);
        if (di < n) decoded[di++] = (c[0] << 2) | (c[1] >> 4);
        if (di < n) decoded[di++] = ((c[1] & 0xF) << 4) | (c[2] >> 2);
        if (di < n) decoded[di++] = ((c[2] & 3) << 6) | c[3];
      }
      chunks.push(decoded);
    }

    let total = 0;
    for (const c of chunks) total += c.length;
    const data = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { data.set(c, off); off += c.length; }
    return [makeEntry(entryName, data.length, bytes.length, null, crc32Hex(data), false, false, data, handler)];
  }

  async build(entries, _password, _options) {
    if (entries.length === 0) return new Uint8Array(0);
    const entry = entries[0];
    const data = entry._data instanceof Uint8Array ? entry._data : new Uint8Array(await entry._data());
    const name = entry.name || 'file';
    let text = 'begin 644 ' + name + '\n';
    for (let off = 0; off < data.length; off += 45) {
      const chunk = data.subarray(off, Math.min(off + 45, data.length));
      const n = chunk.length;
      let line = String.fromCharCode(n + 32);
      for (let i = 0; i < n; i += 3) {
        const b0 = chunk[i] || 0, b1 = chunk[i + 1] || 0, b2 = chunk[i + 2] || 0;
        line += String.fromCharCode(((b0 >> 2) & 63) + 32, (((b0 & 3) << 4) | (b1 >> 4)) + 32,
          (((b1 & 0xF) << 2) | (b2 >> 6)) + 32, (b2 & 63) + 32);
      }
      text += line + '\n';
    }
    text += '`\nend\n';
    return new TextEncoder().encode(text);
  }
}

// FORMAT: Intel HEX (.hex / .ihex)
// =======================================================================

class IhexFormat extends IArchiveFormat {
  static get id() { return 'ihex'; }
  static get displayName() { return 'Intel HEX'; }
  static get extensions() { return ['hex', 'ihex', 'ihe', 'h86']; }
  static get canCreate() { return true; }

  static detect(bytes, _fileName) {
    if (bytes.length < 11) return false;
    if (bytes[0] !== 0x3A) return false;
    const header = new TextDecoder().decode(bytes.subarray(0, Math.min(50, bytes.length)));
    return /^:[0-9A-Fa-f]{10,}/m.test(header);
  }

  async parse(bytes, fileName, _password) {
    const handler = this;
    const text = new TextDecoder().decode(bytes);
    const lines = text.split(/\r?\n/).filter(l => l.startsWith(':'));
    const chunks = [];
    let baseAddr = 0;

    for (const line of lines) {
      const byteCount = parseInt(line.substring(1, 3), 16);
      const address = parseInt(line.substring(3, 7), 16);
      const type = parseInt(line.substring(7, 9), 16);
      if (type === 0) {
        const data = new Uint8Array(byteCount);
        for (let i = 0; i < byteCount; ++i)
          data[i] = parseInt(line.substring(9 + i * 2, 11 + i * 2), 16);
        chunks.push({ addr: baseAddr + address, data });
      } else if (type === 2) {
        baseAddr = parseInt(line.substring(9, 13), 16) << 4;
      } else if (type === 4) {
        baseAddr = parseInt(line.substring(9, 13), 16) << 16;
      } else if (type === 1) break;
    }

    if (chunks.length === 0) return [];
    chunks.sort((a, b) => a.addr - b.addr);
    const minAddr = chunks[0].addr;
    const maxAddr = chunks[chunks.length - 1].addr + chunks[chunks.length - 1].data.length;
    const result = new Uint8Array(maxAddr - minAddr);
    for (const c of chunks) result.set(c.data, c.addr - minAddr);
    const baseName = stripExtension(getFileName(fileName || 'firmware.hex')) + '.bin';
    return [makeEntry(baseName, result.length, bytes.length, null, crc32Hex(result), false, false, result, handler)];
  }

  async build(entries, _password, _options) {
    if (entries.length === 0) return new Uint8Array(0);
    const data = entries[0]._data instanceof Uint8Array ? entries[0]._data : new Uint8Array(await entries[0]._data());
    let text = '';
    for (let off = 0; off < data.length; off += 16) {
      const count = Math.min(16, data.length - off);
      let line = ':' + count.toString(16).toUpperCase().padStart(2, '0') +
        off.toString(16).toUpperCase().padStart(4, '0') + '00';
      let checksum = count + ((off >> 8) & 0xFF) + (off & 0xFF);
      for (let i = 0; i < count; ++i) {
        line += data[off + i].toString(16).toUpperCase().padStart(2, '0');
        checksum += data[off + i];
      }
      line += ((~checksum + 1) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
      text += line + '\n';
    }
    text += ':00000001FF\n';
    return new TextEncoder().encode(text);
  }
}

IArchiveFormat.register(Base64Format);
IArchiveFormat.register(UueFormat);
IArchiveFormat.register(IhexFormat);

})();
