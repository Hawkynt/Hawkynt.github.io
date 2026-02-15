;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;

  const { readU16BE, readU32BE, readString, readUTF16 } = P;

  function parseFont(bytes) {
    const fields = [];
    if (bytes.length < 12) return { categories: [{ name: 'Font', icon: 'font', fields }], images: [] };

    const numTables = readU16BE(bytes, 4);
    fields.push({ key: 'font.tables', label: 'Tables', value: String(numTables) });

    // Find name table
    let nameTableOffset = 0, nameTableLength = 0;
    let headTableOffset = 0;
    let os2TableOffset = 0;
    for (let i = 0; i < numTables; ++i) {
      const tableBase = 12 + i * 16;
      if (tableBase + 16 > bytes.length) break;
      const tag = readString(bytes, tableBase, 4);
      const offset = readU32BE(bytes, tableBase + 8);
      const length = readU32BE(bytes, tableBase + 12);
      if (tag === 'name') { nameTableOffset = offset; nameTableLength = length; }
      if (tag === 'head') headTableOffset = offset;
      if (tag === 'OS/2') os2TableOffset = offset;
    }

    // Parse name table
    if (nameTableOffset > 0 && nameTableOffset + 6 <= bytes.length) {
      const nameCount = readU16BE(bytes, nameTableOffset + 2);
      const stringOffset = readU16BE(bytes, nameTableOffset + 4);
      const nameIds = { 0: 'Copyright', 1: 'Font Family', 2: 'Font Subfamily', 4: 'Full Name', 5: 'Version', 6: 'PostScript Name' };

      for (let i = 0; i < nameCount; ++i) {
        const recBase = nameTableOffset + 6 + i * 12;
        if (recBase + 12 > bytes.length) break;
        const platformId = readU16BE(bytes, recBase);
        const nameId = readU16BE(bytes, recBase + 6);
        const strLength = readU16BE(bytes, recBase + 8);
        const strOffset = readU16BE(bytes, recBase + 10);

        if (nameIds[nameId] && (platformId === 1 || platformId === 3)) {
          const absOffset = nameTableOffset + stringOffset + strOffset;
          let text;
          if (platformId === 3)
            text = readUTF16(bytes, absOffset, strLength, false);
          else
            text = readString(bytes, absOffset, strLength);
          if (text && !fields.some(f => f.key === 'font.name.' + nameId))
            fields.push({ key: 'font.name.' + nameId, label: nameIds[nameId], value: text });
        }
      }
    }

    // Parse head table
    if (headTableOffset > 0 && headTableOffset + 54 <= bytes.length) {
      const unitsPerEm = readU16BE(bytes, headTableOffset + 18);
      fields.push({ key: 'font.unitsPerEm', label: 'Units Per Em', value: String(unitsPerEm) });
    }

    // Parse OS/2 table
    if (os2TableOffset > 0 && os2TableOffset + 8 <= bytes.length) {
      const weightClass = readU16BE(bytes, os2TableOffset + 4);
      const widthClass = readU16BE(bytes, os2TableOffset + 6);
      const weightNames = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
      fields.push({ key: 'font.weight', label: 'Weight', value: weightNames[weightClass] || String(weightClass) });
    }

    return { categories: [{ name: 'Font', icon: 'font', fields }], images: [] };
  }

  P.registerParsers({ ttf: parseFont, otf: parseFont, woff: parseFont, woff2: parseFont });

})();
