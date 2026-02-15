;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readString, readUTF8, readUTF16, formatSize } = P;

  function parsePDF(bytes) {
    const fields = [];
    const headerLine = readString(bytes, 0, 20);
    const versionMatch = headerLine.match(/%PDF-(\d+\.\d+)/);
    if (versionMatch) fields.push({ key: 'pdf.version', label: 'PDF Version', value: versionMatch[1] });

    // Scan for Info dictionary and page count
    const text = readString(bytes, 0, Math.min(bytes.length, 65536));

    const infoPatterns = [
      { key: 'pdf.title', label: 'Title', rx: /\/Title\s*\(([^)]*)\)/ },
      { key: 'pdf.author', label: 'Author', rx: /\/Author\s*\(([^)]*)\)/ },
      { key: 'pdf.subject', label: 'Subject', rx: /\/Subject\s*\(([^)]*)\)/ },
      { key: 'pdf.creator', label: 'Creator', rx: /\/Creator\s*\(([^)]*)\)/ },
      { key: 'pdf.producer', label: 'Producer', rx: /\/Producer\s*\(([^)]*)\)/ },
      { key: 'pdf.keywords', label: 'Keywords', rx: /\/Keywords\s*\(([^)]*)\)/ },
    ];

    for (const pat of infoPatterns) {
      const m = text.match(pat.rx);
      if (m && m[1].trim()) fields.push({ key: pat.key, label: pat.label, value: m[1].trim() });
    }

    // Count pages
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches)
      fields.push({ key: 'pdf.pages', label: 'Pages', value: String(pageMatches.length) });

    // Encryption
    if (text.includes('/Encrypt'))
      fields.push({ key: 'pdf.encrypted', label: 'Encrypted', value: 'Yes' });

    return { categories: [{ name: 'PDF', icon: 'document', fields }], images: [] };
  }

  // =========================================================================
  // OOXML (Office) parser — reads metadata from ZIP local file entries
  // =========================================================================

  function parseOOXML(bytes) {
    const categories = [];
    const archiveFields = [];

    // Walk ZIP local file headers to find core.xml and app.xml
    let pos = 0;
    const fileEntries = [];
    while (pos + 30 <= bytes.length && fileEntries.length < 200) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataStart = pos + 30 + nameLen + extraLen;
      fileEntries.push({ name, method, compSize, uncompSize, dataStart });
      pos = dataStart + compSize;
    }

    archiveFields.push({ key: 'ooxml.files', label: 'Files in Archive', value: String(fileEntries.length) });

    // Classify document type from filenames
    const names = fileEntries.map(e => e.name);
    if (names.some(n => n.startsWith('word/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'Word Document' });
    else if (names.some(n => n.startsWith('xl/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'Excel Spreadsheet' });
    else if (names.some(n => n.startsWith('ppt/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'PowerPoint Presentation' });

    categories.push({ name: 'Archive', icon: 'archive', fields: archiveFields });

    // Try to read docProps/core.xml (Dublin Core metadata)
    const coreEntry = fileEntries.find(e => e.name === 'docProps/core.xml');
    if (coreEntry && coreEntry.method === 0 && coreEntry.uncompSize > 0) {
      const xml = readUTF8(bytes, coreEntry.dataStart, coreEntry.uncompSize);
      const metaFields = parseOOXMLCoreXml(xml, true);
      if (metaFields.length > 0)
        categories.push({ name: 'Document Properties', icon: 'document', fields: metaFields });
    } else if (coreEntry && coreEntry.method !== 0) {
      // DEFLATE compressed — try to parse via simple regex on raw data
      const rawSample = readString(bytes, coreEntry.dataStart, Math.min(coreEntry.compSize, 4096));
      // Cannot decompress without inflate; show note
      categories.push({ name: 'Document Properties', icon: 'document', fields: [
        { key: 'ooxml.note', label: 'Note', value: 'Metadata is compressed (DEFLATE); full parsing requires decompression' }
      ]});
    }

    // Try to read docProps/app.xml
    const appEntry = fileEntries.find(e => e.name === 'docProps/app.xml');
    if (appEntry && appEntry.method === 0 && appEntry.uncompSize > 0) {
      const xml = readUTF8(bytes, appEntry.dataStart, appEntry.uncompSize);
      const appFields = parseOOXMLAppXml(xml);
      if (appFields.length > 0)
        categories.push({ name: 'Application Properties', icon: 'info', fields: appFields });
    }

    return { categories, images: [] };
  }

  function parseOOXMLCoreXml(xml, editable) {
    const fields = [];
    const patterns = [
      { key: 'ooxml.title', label: 'Title', rx: /<dc:title>([^<]*)<\/dc:title>/i },
      { key: 'ooxml.subject', label: 'Subject', rx: /<dc:subject>([^<]*)<\/dc:subject>/i },
      { key: 'ooxml.creator', label: 'Author', rx: /<dc:creator>([^<]*)<\/dc:creator>/i },
      { key: 'ooxml.keywords', label: 'Keywords', rx: /<cp:keywords>([^<]*)<\/cp:keywords>/i },
      { key: 'ooxml.description', label: 'Description', rx: /<dc:description>([^<]*)<\/dc:description>/i },
      { key: 'ooxml.lastModifiedBy', label: 'Last Modified By', rx: /<cp:lastModifiedBy>([^<]*)<\/cp:lastModifiedBy>/i },
      { key: 'ooxml.revision', label: 'Revision', rx: /<cp:revision>([^<]*)<\/cp:revision>/i },
      { key: 'ooxml.created', label: 'Created', rx: /<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/i },
      { key: 'ooxml.modified', label: 'Modified', rx: /<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/i },
      { key: 'ooxml.category', label: 'Category', rx: /<cp:category>([^<]*)<\/cp:category>/i },
    ];
    for (const pat of patterns) {
      const m = xml.match(pat.rx);
      if (m && m[1].trim()) {
        const isEditable = editable && ['ooxml.title', 'ooxml.subject', 'ooxml.creator', 'ooxml.keywords', 'ooxml.description', 'ooxml.category'].includes(pat.key);
        fields.push({ key: pat.key, label: pat.label, value: m[1].trim(), editable: isEditable, editType: isEditable ? 'text' : undefined });
      }
    }
    return fields;

  function parseOOXMLAppXml(xml) {
    const fields = [];
    const patterns = [
      { key: 'ooxml.app', label: 'Application', rx: /<Application>([^<]*)<\/Application>/i },
      { key: 'ooxml.appVer', label: 'App Version', rx: /<AppVersion>([^<]*)<\/AppVersion>/i },
      { key: 'ooxml.company', label: 'Company', rx: /<Company>([^<]*)<\/Company>/i },
      { key: 'ooxml.pages', label: 'Pages', rx: /<Pages>([^<]*)<\/Pages>/i },
      { key: 'ooxml.words', label: 'Words', rx: /<Words>([^<]*)<\/Words>/i },
      { key: 'ooxml.chars', label: 'Characters', rx: /<Characters>([^<]*)<\/Characters>/i },
      { key: 'ooxml.slides', label: 'Slides', rx: /<Slides>([^<]*)<\/Slides>/i },
      { key: 'ooxml.sheets', label: 'Sheets', rx: /<Sheets>([^<]*)<\/Sheets>/i },
    ];
    for (const pat of patterns) {
      const m = xml.match(pat.rx);
      if (m && m[1].trim())
        fields.push({ key: pat.key, label: pat.label, value: m[1].trim() });
    }
    return fields;
  }


  // =========================================================================
  // =========================================================================
  // OLE2 Compound Document parser (legacy .doc, .xls, .ppt)
  // =========================================================================

  function parseOLE2(bytes) {
    const categories = [];
    const fields = [];

    if (bytes.length < 512) return { categories: [{ name: 'OLE2', icon: 'document', fields }], images: [] };

    // OLE2 header
    const sectorSize = 1 << readU16LE(bytes, 30);
    const miniSectorSize = 1 << readU16LE(bytes, 32);
    const fatSectors = readU32LE(bytes, 44);
    const firstDirSector = readU32LE(bytes, 48);
    const firstMiniFATSector = readU32LE(bytes, 60);
    const firstDIFATSector = readU32LE(bytes, 68);

    fields.push({ key: 'ole2.sectorSize', label: 'Sector Size', value: sectorSize + ' bytes' });

    // Read FAT (for sector chain traversal)
    const fat = [];
    for (let i = 0; i < 109 && i < fatSectors; ++i) {
      const fatSecId = readU32LE(bytes, 76 + i * 4);
      if (fatSecId === 0xFFFFFFFE || fatSecId === 0xFFFFFFFF) break;
      const fatOffset = (fatSecId + 1) * sectorSize;
      for (let j = 0; j < sectorSize / 4 && fatOffset + j * 4 + 4 <= bytes.length; ++j)
        fat.push(readU32LE(bytes, fatOffset + j * 4));
    }

    // Read directory entries by following sector chain from firstDirSector
    function readSectorChain(startSector, maxSize) {
      const chunks = [];
      let sec = startSector;
      let total = 0;
      while (sec !== 0xFFFFFFFE && sec !== 0xFFFFFFFF && sec < fat.length && total < maxSize) {
        const offset = (sec + 1) * sectorSize;
        if (offset + sectorSize > bytes.length) break;
        chunks.push(bytes.subarray(offset, offset + sectorSize));
        total += sectorSize;
        sec = fat[sec];
      }
      if (chunks.length === 0) return new Uint8Array(0);
      const result = new Uint8Array(total);
      let wp = 0;
      for (const c of chunks) { result.set(c, wp); wp += c.length; }
      return result;
    }

    const dirData = readSectorChain(firstDirSector, 65536);
    const dirEntries = [];
    for (let i = 0; i + 128 <= dirData.length; ++i) {
      const entryBase = i * 128;
      if (entryBase + 128 > dirData.length) break;
      const nameLen = readU16LE(dirData, entryBase + 64);
      if (nameLen === 0) continue;
      const entryName = readUTF16(dirData, entryBase, Math.min(nameLen, 64), true).replace(/\0+$/, '');
      const entryType = dirData[entryBase + 66]; // 1=storage, 2=stream, 5=root
      const entrySize = readU32LE(dirData, entryBase + 120);
      const startSec = readU32LE(dirData, entryBase + 116);
      dirEntries.push({ name: entryName, type: entryType, size: entrySize, startSector: startSec });
    }

    // Determine document type from directory entries
    const entryNames = dirEntries.map(e => e.name);
    let docType = 'Unknown';
    let specificId = 'ole2';
    if (entryNames.some(n => n === 'WordDocument' || n === '1Table' || n === '0Table')) {
      docType = 'Microsoft Word Document (.doc)';
      specificId = 'doc';
    } else if (entryNames.some(n => n === 'Workbook' || n === 'Book')) {
      docType = 'Microsoft Excel Spreadsheet (.xls)';
      specificId = 'xls';
    } else if (entryNames.some(n => n === 'PowerPoint Document' || n === 'Current User')) {
      docType = 'Microsoft PowerPoint Presentation (.ppt)';
      specificId = 'ppt';
    } else if (entryNames.some(n => n === 'VisioDocument')) {
      docType = 'Microsoft Visio Drawing (.vsd)';
    } else if (entryNames.some(n => n.includes('MSO'))) {
      docType = 'Microsoft Office Document';
    }

    fields.push({ key: 'ole2.docType', label: 'Document Type', value: docType });
    fields.push({ key: 'ole2.streams', label: 'Streams', value: String(dirEntries.filter(e => e.type === 2).length) });
    fields.push({ key: 'ole2.storages', label: 'Storages', value: String(dirEntries.filter(e => e.type === 1).length) });

    // List directory entries
    const entryList = dirEntries.filter(e => e.type === 2).slice(0, 20);
    if (entryList.length > 0)
      fields.push({ key: 'ole2.entries', label: 'Streams (first 20)', value: entryList.map(e => e.name + ' (' + formatSize(e.size) + ')').join('\n') });

    categories.push({ name: 'Document', icon: 'document', fields });

    // Try to parse SummaryInformation stream for document properties
    const summaryEntry = dirEntries.find(e => e.name === '\x05SummaryInformation' || e.name === 'SummaryInformation');
    if (summaryEntry && summaryEntry.startSector !== 0xFFFFFFFE) {
      const propData = readSectorChain(summaryEntry.startSector, summaryEntry.size + sectorSize);
      const propFields = parseOLE2Properties(propData, summaryEntry.size);
      if (propFields.length > 0)
        categories.push({ name: 'Summary Information', icon: 'info', fields: propFields });
    }

    // Try DocSummaryInformation too
    const docSummaryEntry = dirEntries.find(e => e.name === '\x05DocumentSummaryInformation' || e.name === 'DocumentSummaryInformation');
    if (docSummaryEntry && docSummaryEntry.startSector !== 0xFFFFFFFE) {
      const propData = readSectorChain(docSummaryEntry.startSector, docSummaryEntry.size + sectorSize);
      const docPropFields = parseOLE2DocSummary(propData, docSummaryEntry.size);
      if (docPropFields.length > 0)
        categories.push({ name: 'Document Summary', icon: 'info', fields: docPropFields });
    }

    return { categories, images: [] };
  }

  function parseOLE2Properties(data, size) {
    const fields = [];
    if (data.length < 28) return fields;

    // Property set header
    const numSections = readU32LE(data, 24);
    if (numSections === 0) return fields;
    if (data.length < 44) return fields;

    const sectionOffset = readU32LE(data, 44);
    if (sectionOffset + 8 > data.length) return fields;

    const sectionSize = readU32LE(data, sectionOffset);
    const numProps = readU32LE(data, sectionOffset + 4);

    const pidLabels = {
      2: 'Title', 3: 'Subject', 4: 'Author', 5: 'Keywords',
      6: 'Comments', 7: 'Template', 8: 'Last Author', 9: 'Revision Number',
      12: 'Created', 13: 'Last Saved', 14: 'Pages', 15: 'Words',
      16: 'Characters', 18: 'Application', 19: 'Security',
    };

    for (let i = 0; i < numProps && i < 30; ++i) {
      const propBase = sectionOffset + 8 + i * 8;
      if (propBase + 8 > data.length) break;
      const pid = readU32LE(data, propBase);
      const propOffset = readU32LE(data, propBase + 4);
      const absOffset = sectionOffset + propOffset;
      if (absOffset + 8 > data.length || !pidLabels[pid]) continue;

      const propType = readU32LE(data, absOffset);
      let value = null;
      if (propType === 0x1E) {
        // VT_LPSTR
        const strLen = readU32LE(data, absOffset + 4);
        if (absOffset + 8 + strLen <= data.length)
          value = readString(data, absOffset + 8, strLen).replace(/\0+$/, '');
      } else if (propType === 0x03) {
        // VT_I4
        value = String(readI32LE(data, absOffset + 4));
      } else if (propType === 0x40) {
        // VT_FILETIME
        const lo = readU32LE(data, absOffset + 4);
        const hi = readU32LE(data, absOffset + 8);
        if (lo !== 0 || hi !== 0) {
          const ft = hi * 0x100000000 + lo;
          const unixMs = (ft / 10000) - 11644473600000;
          try { value = new Date(unixMs).toLocaleString(); } catch (_) {}
        }
      }

      if (value)
        fields.push({ key: 'ole2.prop.' + pid, label: pidLabels[pid], value });
    }
    return fields;
  }

  function parseOLE2DocSummary(data, size) {
    const fields = [];
    if (data.length < 28) return fields;

    const numSections = readU32LE(data, 24);
    if (numSections === 0 || data.length < 44) return fields;

    const sectionOffset = readU32LE(data, 44);
    if (sectionOffset + 8 > data.length) return fields;

    const numProps = readU32LE(data, sectionOffset + 4);

    const pidLabels = {
      2: 'Category', 14: 'Manager', 15: 'Company', 16: 'Bytes',
      17: 'Lines', 18: 'Paragraphs', 22: 'Slides', 23: 'Notes',
      24: 'Hidden Slides', 26: 'Links Up To Date',
    };

    for (let i = 0; i < numProps && i < 30; ++i) {
      const propBase = sectionOffset + 8 + i * 8;
      if (propBase + 8 > data.length) break;
      const pid = readU32LE(data, propBase);
      const propOffset = readU32LE(data, propBase + 4);
      const absOffset = sectionOffset + propOffset;
      if (absOffset + 8 > data.length || !pidLabels[pid]) continue;

      const propType = readU32LE(data, absOffset);
      let value = null;
      if (propType === 0x1E) {
        const strLen = readU32LE(data, absOffset + 4);
        if (absOffset + 8 + strLen <= data.length)
          value = readString(data, absOffset + 8, strLen).replace(/\0+$/, '');
      } else if (propType === 0x03) {
        value = String(readI32LE(data, absOffset + 4));
      } else if (propType === 0x0B) {
        // VT_BOOL
        value = readU16LE(data, absOffset + 4) !== 0 ? 'Yes' : 'No';
      }

      if (value)
        fields.push({ key: 'ole2.docprop.' + pid, label: pidLabels[pid], value });
    }
    return fields;
  }

  P.registerParsers({ pdf: parsePDF, ole2: parseOLE2, docx: parseOOXML, xlsx: parseOOXML, pptx: parseOOXML, ooxml: parseOOXML }, { zipBased: ['docx', 'xlsx', 'pptx', 'ooxml'] });

})();
