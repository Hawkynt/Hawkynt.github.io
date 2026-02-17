;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readString, readUTF8, readUTF16, bytesToDataUrl, formatSize, matchBytes } = P;

  // =========================================================================
  // ZIP parser
  // =========================================================================

  function parseZIP(bytes) {
    const fields = [];
    const byteRegions = [];
    let totalUncompressed = 0;
    let totalCompressed = 0;
    const fileNames = [];

    if (bytes.length >= 4 && readU32LE(bytes, 0) === 0x04034B50)
      byteRegions.push({ offset: 0, length: 4, label: 'Local File Header Signature', color: 0 });

    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); --i) {
      if (readU32LE(bytes, i) === 0x06054B50) { eocdPos = i; break; }
    }

    if (eocdPos >= 0) {
      byteRegions.push({ offset: eocdPos, length: 22, label: 'End of Central Directory', color: 1 });

      const entryCount = readU16LE(bytes, eocdPos + 10);
      const cdSize = readU32LE(bytes, eocdPos + 12);
      const cdOffset = readU32LE(bytes, eocdPos + 16);
      const comment = readString(bytes, eocdPos + 22, readU16LE(bytes, eocdPos + 20));

      if (cdOffset < bytes.length)
        byteRegions.push({ offset: cdOffset, length: Math.min(cdSize, 256), label: 'Central Directory', color: 3 });

      fields.push({ key: 'zip.entries', label: 'Entries', value: String(entryCount) });
      if (comment) fields.push({ key: 'zip.comment', label: 'Comment', value: comment });

      let pos = cdOffset;
      for (let i = 0; i < entryCount && pos + 46 <= bytes.length; ++i) {
        if (readU32LE(bytes, pos) !== 0x02014B50) break;
        const compSize = readU32LE(bytes, pos + 20);
        const uncompSize = readU32LE(bytes, pos + 24);
        const nameLen = readU16LE(bytes, pos + 28);
        const extraLen = readU16LE(bytes, pos + 30);
        const commentLen = readU16LE(bytes, pos + 32);
        const name = readUTF8(bytes, pos + 46, nameLen);
        fileNames.push(name);
        totalCompressed += compSize;
        totalUncompressed += uncompSize;
        pos += 46 + nameLen + extraLen + commentLen;
      }

      fields.push({ key: 'zip.compressedSize', label: 'Compressed Size', value: formatSize(totalCompressed) });
      fields.push({ key: 'zip.uncompressedSize', label: 'Uncompressed Size', value: formatSize(totalUncompressed) });
      if (totalUncompressed > 0)
        fields.push({ key: 'zip.ratio', label: 'Compression Ratio', value: Math.round((1 - totalCompressed / totalUncompressed) * 100) + '%' });
      if (fileNames.length > 0)
        fields.push({ key: 'zip.files', label: 'Files (first 10)', value: fileNames.slice(0, 10).join('\n') + (fileNames.length > 10 ? '\n...' : '') });
    } else {
      fields.push({ key: 'zip.note', label: 'Note', value: 'Could not locate End of Central Directory' });
    }

    return { categories: [{ name: 'ZIP Archive', icon: 'archive', fields }], images: [], byteRegions };
  }

  // =========================================================================
  // JAR parser
  // =========================================================================

  function parseJAR(bytes) {
    const categories = [];
    const fields = [];

    let pos = 0;
    const entries = [];
    while (pos + 30 <= bytes.length && entries.length < 500) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataStart = pos + 30 + nameLen + extraLen;
      entries.push({ name, method, compSize, uncompSize, dataStart });
      pos = dataStart + compSize;
    }

    const manifest = entries.find(e => e.name === 'META-INF/MANIFEST.MF');
    if (manifest && manifest.method === 0 && manifest.uncompSize > 0) {
      const mfText = readUTF8(bytes, manifest.dataStart, manifest.uncompSize);
      const mfLines = mfText.split(/\r?\n/);
      for (const line of mfLines) {
        const sep = line.indexOf(':');
        if (sep > 0) {
          const key = line.substring(0, sep).trim();
          const value = line.substring(sep + 1).trim();
          if (key && value && !key.startsWith('Name'))
            fields.push({ key: 'jar.manifest.' + key, label: key, value });
        }
      }
    }

    const classes = entries.filter(e => e.name.endsWith('.class') && !e.name.includes('$'));
    const innerClasses = entries.filter(e => e.name.endsWith('.class') && e.name.includes('$'));
    const resources = entries.filter(e => !e.name.endsWith('.class') && !e.name.endsWith('/') && e.name !== 'META-INF/MANIFEST.MF');
    fields.push({ key: 'jar.classes', label: 'Classes', value: String(classes.length) });
    if (innerClasses.length > 0)
      fields.push({ key: 'jar.innerClasses', label: 'Inner Classes', value: String(innerClasses.length) });
    if (resources.length > 0)
      fields.push({ key: 'jar.resources', label: 'Resources', value: String(resources.length) });

    const packages = new Set();
    for (const e of classes) {
      const lastSlash = e.name.lastIndexOf('/');
      if (lastSlash > 0) packages.add(e.name.substring(0, lastSlash).replace(/\//g, '.'));
    }
    if (packages.size > 0)
      fields.push({ key: 'jar.packages', label: 'Packages', value: [...packages].sort().join('\n') });

    const classNames = classes.slice(0, 30).map(e => e.name.replace(/\.class$/, '').replace(/\//g, '.'));
    if (classNames.length > 0)
      fields.push({ key: 'jar.classList', label: 'Classes (first 30)', value: classNames.join('\n') + (classes.length > 30 ? '\n...' : '') });

    categories.push({ name: 'JAR Contents', icon: 'archive', fields });

    // Try to parse first .class file for bytecode info (using cross-module reference)
    const parseJavaClass = P._parseJavaClass;
    const firstClass = entries.find(e => e.name.endsWith('.class') && e.method === 0 && e.uncompSize >= 10);
    if (firstClass && parseJavaClass) {
      const classBytes = bytes.subarray(firstClass.dataStart, firstClass.dataStart + firstClass.uncompSize);
      if (classBytes.length >= 10 && readU32BE(classBytes, 0) === 0xCAFEBABE) {
        const classResult = parseJavaClass(classBytes);
        if (classResult.categories.length > 0) {
          const sampleCat = classResult.categories[0];
          sampleCat.name = 'Sample Class (' + firstClass.name.replace(/\.class$/, '').split('/').pop() + ')';
          categories.push(sampleCat);
        }
      }
    }

    return { categories, images: [] };
  }

  // =========================================================================
  // APK parser
  // =========================================================================

  function parseAPK(bytes) {
    const categories = [];
    const apkFields = [];
    const contentFields = [];
    const signingFields = [];
    const images = [];

    const zipFiles = [];
    let pos = 0;
    while (pos + 30 <= bytes.length) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataOffset = pos + 30 + nameLen + extraLen;
      zipFiles.push({ name, method, compSize, uncompSize, dataOffset });
      pos = dataOffset + compSize;
    }

    // DEX files
    const dexFiles = zipFiles.filter(f => /^classes\d*\.dex$/i.test(f.name));
    const totalDexSize = dexFiles.reduce((s, f) => s + f.uncompSize, 0);
    if (dexFiles.length > 0) {
      contentFields.push({ key: 'apk.dexCount', label: 'DEX Files', value: String(dexFiles.length) });
      contentFields.push({ key: 'apk.dexSize', label: 'Total DEX Size', value: formatSize(totalDexSize) });
    }

    // Native libraries
    const nativeArchs = new Set();
    for (const f of zipFiles) {
      const m = f.name.match(/^lib\/([^/]+)\//);
      if (m) nativeArchs.add(m[1]);
    }
    if (nativeArchs.size > 0)
      contentFields.push({ key: 'apk.nativeArchs', label: 'Native Architectures', value: [...nativeArchs].join(', ') });

    const resCount = zipFiles.filter(f => f.name.startsWith('res/')).length;
    const assetCount = zipFiles.filter(f => f.name.startsWith('assets/')).length;
    if (resCount > 0) contentFields.push({ key: 'apk.resCount', label: 'Resource Files', value: String(resCount) });
    if (assetCount > 0) contentFields.push({ key: 'apk.assetCount', label: 'Asset Files', value: String(assetCount) });

    // Signing info
    const rsaFiles = zipFiles.filter(f => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(f.name));
    const sfFiles = zipFiles.filter(f => /^META-INF\/.*\.SF$/i.test(f.name));
    if (rsaFiles.length > 0)
      signingFields.push({ key: 'apk.certPresent', label: 'Certificate', value: rsaFiles.map(f => f.name.split('/').pop()).join(', ') });
    if (sfFiles.length > 0)
      signingFields.push({ key: 'apk.sigFile', label: 'Signature File', value: sfFiles.map(f => f.name.split('/').pop()).join(', ') });

    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); --i) {
      if (readU32LE(bytes, i) === 0x06054B50) { eocdPos = i; break; }
    }
    if (eocdPos >= 0) {
      const cdOffset = readU32LE(bytes, eocdPos + 16);
      if (cdOffset >= 24) {
        const magic = readString(bytes, cdOffset - 16, 16);
        if (magic === 'APK Sig Block 42')
          signingFields.push({ key: 'apk.sigScheme', label: 'Signing Scheme', value: 'v2+ (APK Signature Scheme)' });
      }
    }
    if (signingFields.length === 0)
      signingFields.push({ key: 'apk.sigScheme', label: 'Signing', value: 'Not detected' });

    // Parse AndroidManifest.xml binary XML string pool
    const manifest = zipFiles.find(f => f.name === 'AndroidManifest.xml');
    if (manifest && manifest.method === 0 && manifest.dataOffset + manifest.compSize <= bytes.length) {
      const mData = bytes.subarray(manifest.dataOffset, manifest.dataOffset + manifest.compSize);
      parseAndroidBinaryXml(mData, apkFields);
    }

    // Try to extract app icon
    const iconPaths = [
      'res/mipmap-xxxhdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi/ic_launcher.png',
      'res/mipmap-xxhdpi-v4/ic_launcher.png', 'res/mipmap-xxhdpi/ic_launcher.png',
      'res/mipmap-xhdpi-v4/ic_launcher.png', 'res/mipmap-xhdpi/ic_launcher.png',
      'res/mipmap-hdpi-v4/ic_launcher.png', 'res/mipmap-hdpi/ic_launcher.png',
      'res/drawable-xxxhdpi/icon.png', 'res/drawable-xxhdpi/icon.png',
      'res/drawable-xhdpi/icon.png', 'res/drawable-hdpi/icon.png',
      'res/drawable/icon.png',
    ];
    for (const iconPath of iconPaths) {
      const icon = zipFiles.find(f => f.name === iconPath && f.method === 0);
      if (icon && icon.dataOffset + icon.compSize <= bytes.length) {
        const iconBytes = bytes.subarray(icon.dataOffset, icon.dataOffset + icon.compSize);
        if (iconBytes.length > 8 && iconBytes[0] === 0x89 && iconBytes[1] === 0x50) {
          images.push({ label: 'App Icon', mimeType: 'image/png', dataUrl: bytesToDataUrl(iconBytes, 'image/png') });
          break;
        }
      }
    }

    if (apkFields.length > 0)
      categories.push({ name: 'APK Info', icon: 'archive', fields: apkFields });
    if (contentFields.length > 0)
      categories.push({ name: 'Contents', icon: 'archive', fields: contentFields });
    if (signingFields.length > 0)
      categories.push({ name: 'Signing', icon: 'archive', fields: signingFields });

    return { categories, images };
  }

  function parseAndroidBinaryXml(data, fields) {
    if (data.length < 8) return;

    const xmlType = readU16LE(data, 0);
    if (xmlType !== 0x0003) return;

    let spOffset = -1;
    let off = 8;
    while (off + 8 <= data.length) {
      const chunkType = readU16LE(data, off);
      const chunkSize = readU32LE(data, off + 4);
      if (chunkSize < 8 || off + chunkSize > data.length) break;
      if (chunkType === 0x0001) { spOffset = off; break; }
      off += chunkSize;
    }

    if (spOffset < 0) return;

    const spHeaderSize = readU16LE(data, spOffset + 2);
    const spSize = readU32LE(data, spOffset + 4);
    const stringCount = readU32LE(data, spOffset + 8);
    const spFlags = readU32LE(data, spOffset + 16);
    const stringsStart = readU32LE(data, spOffset + 20);
    const isUtf8 = (spFlags & (1 << 8)) !== 0;

    const offsetsBase = spOffset + spHeaderSize;
    const strings = [];
    for (let i = 0; i < stringCount && i < 5000; ++i) {
      const strOff = readU32LE(data, offsetsBase + i * 4);
      const absOff = spOffset + stringsStart + strOff;
      if (absOff >= data.length) break;

      let str;
      if (isUtf8) {
        let byteOff = absOff;
        const c1 = data[byteOff++];
        if (c1 & 0x80) ++byteOff;
        const b1 = data[byteOff++];
        let byteLen = b1;
        if (b1 & 0x80) byteLen = ((b1 & 0x7F) << 8) | data[byteOff++];
        str = readUTF8(data, byteOff, byteLen);
      } else {
        let byteOff = absOff;
        let charLen = readU16LE(data, byteOff);
        byteOff += 2;
        if (charLen & 0x8000) {
          charLen = ((charLen & 0x7FFF) << 16) | readU16LE(data, byteOff);
          byteOff += 2;
        }
        str = readUTF16(data, byteOff, charLen * 2, true);
      }

      strings.push(str);
    }

    const packagePattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;
    const packageName = strings.find(s => packagePattern.test(s));
    if (packageName)
      fields.push({ key: 'apk.packageName', label: 'Package Name', value: packageName });

    const permissions = strings.filter(s => s.startsWith('android.permission.'));
    if (permissions.length > 0)
      fields.push({ key: 'apk.permissions', label: 'Permissions', value: permissions.map(p => p.replace('android.permission.', '')).join('\n') });

    // Walk XML elements
    const activities = [];
    const services = [];
    const receivers = [];

    off = spOffset + spSize;
    while (off + 8 <= data.length) {
      const chunkType = readU16LE(data, off);
      const chunkHeaderSize = readU16LE(data, off + 2);
      const chunkSize = readU32LE(data, off + 4);
      if (chunkSize < 8 || off + chunkSize > data.length) break;

      if (chunkType === 0x0102 && chunkSize >= 36) {
        const nameIdx = readU32LE(data, off + 12);
        const attrCount = readU16LE(data, off + 20);
        const elemName = nameIdx < strings.length ? strings[nameIdx] : '';

        const attrBase = off + chunkHeaderSize;
        for (let a = 0; a < attrCount; ++a) {
          const ao = attrBase + a * 20;
          if (ao + 20 > data.length) break;
          const attrNameIdx = readU32LE(data, ao + 4);
          const attrRawIdx = readU32LE(data, ao + 8);
          const attrData = readU32LE(data, ao + 16);
          const attrName = attrNameIdx < strings.length ? strings[attrNameIdx] : '';
          const attrRawVal = attrRawIdx < strings.length && attrRawIdx !== 0xFFFFFFFF ? strings[attrRawIdx] : null;

          if (elemName === 'manifest') {
            if (attrName === 'versionCode')
              fields.push({ key: 'apk.versionCode', label: 'Version Code', value: String(attrData) });
            if (attrName === 'versionName' && attrRawVal)
              fields.push({ key: 'apk.versionName', label: 'Version Name', value: attrRawVal });
            if (attrName === 'compileSdkVersion')
              fields.push({ key: 'apk.compileSdk', label: 'Compile SDK', value: String(attrData) });
          }

          if (elemName === 'uses-sdk') {
            if (attrName === 'minSdkVersion')
              fields.push({ key: 'apk.minSdk', label: 'Min SDK', value: String(attrData) });
            if (attrName === 'targetSdkVersion')
              fields.push({ key: 'apk.targetSdk', label: 'Target SDK', value: String(attrData) });
          }

          if (elemName === 'activity' && attrName === 'name' && attrRawVal)
            activities.push(attrRawVal.split('.').pop());
          if (elemName === 'service' && attrName === 'name' && attrRawVal)
            services.push(attrRawVal.split('.').pop());
          if (elemName === 'receiver' && attrName === 'name' && attrRawVal)
            receivers.push(attrRawVal.split('.').pop());
        }
      }

      off += chunkSize;
    }

    if (activities.length > 0)
      fields.push({ key: 'apk.activities', label: 'Activities', value: activities.slice(0, 20).join('\n') + (activities.length > 20 ? '\n...' : '') });
    if (services.length > 0)
      fields.push({ key: 'apk.services', label: 'Services', value: services.slice(0, 10).join('\n') + (services.length > 10 ? '\n...' : '') });
    if (receivers.length > 0)
      fields.push({ key: 'apk.receivers', label: 'Receivers', value: receivers.slice(0, 10).join('\n') + (receivers.length > 10 ? '\n...' : '') });
  }

  // =========================================================================
  // Archive bridge — uses archiver's IArchiveFormat for deep inspection
  // Adds a "Contents" category to any format the archiver can parse,
  // showing a file tree with sizes, dates, and compression info.
  // =========================================================================

  function tryArchiveBridge(bytes, fileName, existingCategories) {
    const A = window.SZ && window.SZ.Archiver;
    if (!A || !A.IArchiveFormat || !A.IArchiveFormat.detectFormat)
      return null;

    const Format = A.IArchiveFormat.detectFormat(bytes, fileName);
    if (!Format)
      return null;

    const categories = [];
    const handler = new Format();

    // parse() is async — wrap in a sync-compatible result with a callback mechanism
    // Since the metadata-viewer's parse pipeline is synchronous, we return a placeholder
    // and populate it when the async parse completes via a deferred pattern
    const contentsFields = [];
    const formatInfo = [];

    formatInfo.push({ key: 'archive.format', label: 'Archive Format', value: Format.displayName || Format.id });
    if (Format.extensions && Format.extensions.length > 0)
      formatInfo.push({ key: 'archive.ext', label: 'Extensions', value: Format.extensions.join(', ') });
    if (Format.canCreate)
      formatInfo.push({ key: 'archive.writable', label: 'Writable', value: 'Yes' });
    if (Format.supportsEncryption)
      formatInfo.push({ key: 'archive.encryption', label: 'Encryption', value: 'Supported' });

    categories.push({ name: 'Archive Format', icon: 'archive', fields: formatInfo });

    // Attempt synchronous parse via try/catch for formats that don't need async
    try {
      const parseResult = handler.parse(bytes, fileName);

      // Handle both sync and async results
      if (parseResult && typeof parseResult.then === 'function') {
        // Async — store a placeholder, the controller will update when ready
        contentsFields.push({ key: 'archive.loading', label: 'Contents', value: '(parsing archive contents...)' });
        categories.push({ name: 'Contents', icon: 'list', fields: contentsFields });

        // Attach the promise for the controller to pick up
        categories._archivePromise = parseResult.then(result => buildContentsCategory(result));
      } else {
        // Synchronous result
        const contentsCat = buildContentsCategory(parseResult);
        if (contentsCat)
          categories.push(contentsCat);
      }
    } catch (_) {
      contentsFields.push({ key: 'archive.err', label: 'Error', value: 'Failed to parse archive contents' });
      categories.push({ name: 'Contents', icon: 'list', fields: contentsFields });
    }

    return categories;
  }

  function buildContentsCategory(parseResult) {
    if (!parseResult || !parseResult.entries || parseResult.entries.length === 0)
      return null;

    const entries = parseResult.entries;
    const fields = [];
    const dirs = entries.filter(e => e.isDirectory);
    const files = entries.filter(e => !e.isDirectory);

    fields.push({ key: 'archive.count', label: 'Total Entries', value: String(entries.length) + ' (' + files.length + ' files, ' + dirs.length + ' folders)' });

    const totalSize = files.reduce((s, e) => s + (e.size || 0), 0);
    const totalPacked = files.reduce((s, e) => s + (e.packed || 0), 0);
    fields.push({ key: 'archive.totalSize', label: 'Total Size', value: formatSize(totalSize) });
    if (totalPacked > 0 && totalPacked !== totalSize) {
      fields.push({ key: 'archive.packed', label: 'Packed Size', value: formatSize(totalPacked) });
      if (totalSize > 0)
        fields.push({ key: 'archive.ratio', label: 'Compression', value: Math.round((1 - totalPacked / totalSize) * 100) + '%' });
    }

    const encryptedCount = entries.filter(e => e.encrypted).length;
    if (encryptedCount > 0)
      fields.push({ key: 'archive.encrypted', label: 'Encrypted', value: String(encryptedCount) + ' entries' });

    // Build tree-like listing (first 100 entries)
    const shown = entries.slice(0, 100);
    for (let i = 0; i < shown.length; ++i) {
      const e = shown[i];
      const parts = [];
      if (e.isDirectory) parts.push('[DIR]');
      else parts.push(formatSize(e.size || 0));
      if (e.packed && e.packed > 0 && !e.isDirectory && e.packed !== e.size)
        parts.push('\u2192 ' + formatSize(e.packed));
      if (e.modified)
        parts.push(formatDateCompact(e.modified));
      if (e.encrypted) parts.push('[encrypted]');

      fields.push({
        key: 'archive.entry.' + i,
        label: e.name || '(unnamed)',
        value: parts.join('  '),
      });
    }

    if (entries.length > 100)
      fields.push({ key: 'archive.more', label: '...', value: (entries.length - 100) + ' more entries' });

    return { name: 'Contents (' + files.length + ' files)', icon: 'list', fields };
  }

  function formatDateCompact(d) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  }

  // Expose bridge for the parse pipeline to call
  P._tryArchiveBridge = tryArchiveBridge;

  P.registerParsers({ zip: parseZIP, jar: parseJAR, apk: parseAPK }, { zipBased: ['jar', 'apk'] });
})();
