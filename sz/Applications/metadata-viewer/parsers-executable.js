;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readU64BE, readString, readUTF8, bytesToHex, bytesToDataUrl, formatSize, formatTimestamp, readULEB128, readMUTF8 } = P;

  // =========================================================================
  // .NET Metadata parser — extracts #Strings + table rows for token resolution
  // =========================================================================

  function _parseDotNetMetadata(bytes, metaBase, metaSize) {
    if (metaBase + 16 > bytes.length) return null;
    // Metadata root signature: BSJB (0x424A5342)
    const sig = readU32LE(bytes, metaBase);
    if (sig !== 0x424A5342) return null;

    // Skip: signature(4), major(2), minor(2), reserved(4), version length(4)
    const verLen = readU32LE(bytes, metaBase + 12);
    let pos = metaBase + 16 + ((verLen + 3) & ~3); // version string padded to 4-byte
    if (pos + 4 > bytes.length) return null;

    // Flags(2) + number of streams(2)
    pos += 2; // flags
    const numStreams = readU16LE(bytes, pos); pos += 2;

    // Stream headers: offset(4) + size(4) + name (null-terminated, padded to 4)
    let stringsOff = 0, stringsSz = 0;
    let tablesOff = 0, tablesSz = 0;
    let blobOff = 0, blobSz = 0;
    let guidOff = 0, guidSz = 0;
    for (let i = 0; i < numStreams && pos + 8 < bytes.length; ++i) {
      const sOff = readU32LE(bytes, pos); pos += 4;
      const sSz = readU32LE(bytes, pos); pos += 4;
      let name = '';
      while (pos < bytes.length && bytes[pos] !== 0) name += String.fromCharCode(bytes[pos++]);
      ++pos; // skip null
      pos = (pos + 3) & ~3; // align to 4
      if (name === '#Strings') { stringsOff = metaBase + sOff; stringsSz = sSz; }
      else if (name === '#~' || name === '#-') { tablesOff = metaBase + sOff; tablesSz = sSz; }
      else if (name === '#Blob') { blobOff = metaBase + sOff; blobSz = sSz; }
      else if (name === '#GUID') { guidOff = metaBase + sOff; guidSz = sSz; }
    }

    if (!stringsOff || !tablesOff) return null;

    // Read a #Strings heap string at given offset
    function readHeapString(off) {
      if (off === 0) return '';
      const abs = stringsOff + off;
      if (abs >= bytes.length) return '';
      let s = '';
      for (let j = abs; j < bytes.length && j < abs + 512 && bytes[j] !== 0; ++j)
        s += String.fromCharCode(bytes[j]);
      return s;
    }

    // Read a #Blob heap entry at given offset
    function readHeapBlob(off) {
      if (off === 0 || !blobOff) return null;
      const abs = blobOff + off;
      if (abs >= bytes.length) return null;
      let len, start;
      if ((bytes[abs] & 0x80) === 0) { len = bytes[abs]; start = abs + 1; }
      else if ((bytes[abs] & 0xC0) === 0x80) { len = ((bytes[abs] & 0x3F) << 8) | bytes[abs + 1]; start = abs + 2; }
      else { len = ((bytes[abs] & 0x1F) << 24) | (bytes[abs + 1] << 16) | (bytes[abs + 2] << 8) | bytes[abs + 3]; start = abs + 4; }
      if (start + len > bytes.length) return null;
      return bytes.slice(start, start + len);
    }

    // Parse #~ stream header
    let tp = tablesOff;
    if (tp + 24 > bytes.length) return null;
    tp += 4; // reserved
    const majorVer = bytes[tp++];
    const minorVer = bytes[tp++];
    const heapSizes = bytes[tp++];
    tp += 1; // reserved

    const stringIdxSize = (heapSizes & 0x01) ? 4 : 2;
    const guidIdxSize = (heapSizes & 0x02) ? 4 : 2;
    const blobIdxSize = (heapSizes & 0x04) ? 4 : 2;

    // Valid tables bitmask (8 bytes)
    const validLo = readU32LE(bytes, tp); tp += 4;
    const validHi = readU32LE(bytes, tp); tp += 4;
    tp += 8; // sorted tables bitmask

    // Row counts for each valid table
    const rowCounts = new Array(64).fill(0);
    for (let t = 0; t < 64 && tp + 4 <= bytes.length; ++t) {
      const bit = t < 32 ? (validLo & (1 << t)) : (validHi & (1 << (t - 32)));
      if (bit) {
        rowCounts[t] = readU32LE(bytes, tp); tp += 4;
      }
    }

    // Helper: read index of given size
    function readIdx(size) {
      if (size === 4) { const v = readU32LE(bytes, tp); tp += 4; return v; }
      const v = readU16LE(bytes, tp); tp += 2;
      return v;
    }

    // Coded index sizes — depends on max row counts of referenced tables
    function codedIdxSize(tables) {
      const tagBits = Math.ceil(Math.log2(tables.length));
      const maxRows = Math.max(...tables.map(t => rowCounts[t] || 0));
      return maxRows < (1 << (16 - tagBits)) ? 2 : 4;
    }

    const typeDefOrRefSize = codedIdxSize([0x00, 0x01, 0x02, 0x1B]);
    const hasConstantSize = codedIdxSize([0x04, 0x08, 0x17]);
    const hasCustomAttrSize = codedIdxSize([0x06, 0x04, 0x01, 0x02, 0x08, 0x09, 0x0A, 0x00, 0x0E, 0x17, 0x14, 0x11, 0x1A, 0x1B, 0x20, 0x23, 0x26, 0x27, 0x28]);
    const memberRefParentSize = codedIdxSize([0x01, 0x02, 0x1A, 0x06, 0x1B]);
    const resolutionScopeSize = codedIdxSize([0x00, 0x1A, 0x23, 0x01]);
    const methodDefOrRefSize = codedIdxSize([0x06, 0x0A]);

    // Simple index size for a single table
    function tableIdxSize(t) { return rowCounts[t] > 0xFFFF ? 4 : 2; }

    // Table data starts at tp — read the tables we care about
    const result = { strings: readHeapString, readBlob: readHeapBlob, tables: {} };

    for (let t = 0; t < 64; ++t) {
      const rows = rowCounts[t];
      if (rows === 0) continue;

      if (t === 0x00) { // Module
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(stringIdxSize); readIdx(guidIdxSize); readIdx(guidIdxSize); readIdx(guidIdxSize); }
      } else if (t === 0x01) { // TypeRef
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const scope = readIdx(resolutionScopeSize);
          const nameIdx = readIdx(stringIdxSize);
          const nsIdx = readIdx(stringIdxSize);
          arr.push({ name: nameIdx, ns: nsIdx, scope });
        }
        result.tables[0x01] = arr;
      } else if (t === 0x02) { // TypeDef — preserve flags, extends, fieldList, methodList
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const flags = readU32LE(bytes, tp); tp += 4;
          const nameIdx = readIdx(stringIdxSize);
          const nsIdx = readIdx(stringIdxSize);
          const extends_ = readIdx(typeDefOrRefSize);
          const fieldList = readIdx(tableIdxSize(0x04));
          const methodList = readIdx(tableIdxSize(0x06));
          arr.push({ name: nameIdx, ns: nsIdx, flags, extends: extends_, fieldList, methodList });
        }
        result.tables[0x02] = arr;
      } else if (t === 0x04) { // Field — preserve flags, signature
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const flags = readU16LE(bytes, tp); tp += 2;
          const nameIdx = readIdx(stringIdxSize);
          const sigIdx = readIdx(blobIdxSize);
          arr.push({ name: nameIdx, flags, signature: sigIdx });
        }
        result.tables[0x04] = arr;
      } else if (t === 0x06) { // MethodDef — preserve RVA, flags, signature, paramList
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const rva = readU32LE(bytes, tp); tp += 4;
          const implFlags = readU16LE(bytes, tp); tp += 2;
          const flags = readU16LE(bytes, tp); tp += 2;
          const nameIdx = readIdx(stringIdxSize);
          const sigIdx = readIdx(blobIdxSize);
          const paramList = readIdx(tableIdxSize(0x08));
          arr.push({ name: nameIdx, rva, implFlags, flags, signature: sigIdx, paramList });
        }
        result.tables[0x06] = arr;
      } else if (t === 0x08) { // Param
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const flags = readU16LE(bytes, tp); tp += 2;
          const sequence = readU16LE(bytes, tp); tp += 2;
          const nameIdx = readIdx(stringIdxSize);
          arr.push({ name: nameIdx, flags, sequence });
        }
        result.tables[0x08] = arr;
      } else if (t === 0x0A) { // MemberRef — preserve class, signature
        const arr = [];
        for (let r = 0; r < rows; ++r) {
          const classIdx = readIdx(memberRefParentSize);
          const nameIdx = readIdx(stringIdxSize);
          const sigIdx = readIdx(blobIdxSize);
          arr.push({ name: nameIdx, class: classIdx, signature: sigIdx });
        }
        result.tables[0x0A] = arr;
      } else if (t === 0x09) { // InterfaceImpl
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x02)); readIdx(typeDefOrRefSize); }
      } else if (t === 0x0B) { // Constant
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(hasConstantSize); readIdx(blobIdxSize); }
      } else if (t === 0x0C) { // CustomAttribute
        const customAttrTypeSize = codedIdxSize([0x02, 0x06, 0x0A]);
        for (let r = 0; r < rows; ++r) { readIdx(hasCustomAttrSize); readIdx(customAttrTypeSize); readIdx(blobIdxSize); }
      } else if (t === 0x0E) { // DeclSecurity
        const hasDeclSecSize = codedIdxSize([0x02, 0x06, 0x20]);
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(hasDeclSecSize); readIdx(blobIdxSize); }
      } else if (t === 0x0F) { // ClassLayout
        for (let r = 0; r < rows; ++r) { tp += 6; readIdx(tableIdxSize(0x02)); }
      } else if (t === 0x10) { // FieldLayout
        for (let r = 0; r < rows; ++r) { tp += 4; readIdx(tableIdxSize(0x04)); }
      } else if (t === 0x11) { // StandAloneSig
        for (let r = 0; r < rows; ++r) readIdx(blobIdxSize);
      } else if (t === 0x12) { // EventMap
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x02)); readIdx(tableIdxSize(0x14)); }
      } else if (t === 0x14) { // Event
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(stringIdxSize); readIdx(typeDefOrRefSize); }
      } else if (t === 0x15) { // PropertyMap
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x02)); readIdx(tableIdxSize(0x17)); }
      } else if (t === 0x17) { // Property
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(stringIdxSize); readIdx(blobIdxSize); }
      } else if (t === 0x18) { // MethodSemantics
        const hasSemanticSize = codedIdxSize([0x14, 0x17]);
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(tableIdxSize(0x06)); readIdx(hasSemanticSize); }
      } else if (t === 0x19) { // MethodImpl
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x02)); readIdx(methodDefOrRefSize); readIdx(methodDefOrRefSize); }
      } else if (t === 0x1A) { // ModuleRef
        for (let r = 0; r < rows; ++r) readIdx(stringIdxSize);
      } else if (t === 0x1B) { // TypeSpec
        for (let r = 0; r < rows; ++r) readIdx(blobIdxSize);
      } else if (t === 0x1C) { // ImplMap
        const memberForwardedSize = codedIdxSize([0x04, 0x06]);
        for (let r = 0; r < rows; ++r) { tp += 2; readIdx(memberForwardedSize); readIdx(stringIdxSize); readIdx(tableIdxSize(0x1A)); }
      } else if (t === 0x1D) { // FieldRVA
        for (let r = 0; r < rows; ++r) { tp += 4; readIdx(tableIdxSize(0x04)); }
      } else if (t === 0x20) { // Assembly
        for (let r = 0; r < rows; ++r) { tp += 12; readIdx(blobIdxSize); readIdx(stringIdxSize); readIdx(stringIdxSize); }
      } else if (t === 0x23) { // AssemblyRef
        for (let r = 0; r < rows; ++r) { tp += 12; readIdx(blobIdxSize); readIdx(stringIdxSize); readIdx(stringIdxSize); readIdx(blobIdxSize); }
      } else if (t === 0x26) { // File
        for (let r = 0; r < rows; ++r) { tp += 4; readIdx(stringIdxSize); readIdx(blobIdxSize); }
      } else if (t === 0x27) { // ExportedType
        const implSize = codedIdxSize([0x26, 0x23, 0x27]);
        for (let r = 0; r < rows; ++r) { tp += 8; readIdx(stringIdxSize); readIdx(stringIdxSize); readIdx(implSize); }
      } else if (t === 0x28) { // ManifestResource
        const implSize = codedIdxSize([0x26, 0x23, 0x27]);
        for (let r = 0; r < rows; ++r) { tp += 8; readIdx(stringIdxSize); readIdx(implSize); }
      } else if (t === 0x29) { // NestedClass
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x02)); readIdx(tableIdxSize(0x02)); }
      } else if (t === 0x2A) { // GenericParam
        const typeOrMethodDefSize = codedIdxSize([0x02, 0x06]);
        for (let r = 0; r < rows; ++r) { tp += 4; readIdx(typeOrMethodDefSize); readIdx(stringIdxSize); }
      } else if (t === 0x2B) { // MethodSpec
        for (let r = 0; r < rows; ++r) { readIdx(methodDefOrRefSize); readIdx(blobIdxSize); }
      } else if (t === 0x2C) { // GenericParamConstraint
        for (let r = 0; r < rows; ++r) { readIdx(tableIdxSize(0x2A)); readIdx(typeDefOrRefSize); }
      } else {
        break; // Unknown table
      }
    }

    return result;
  }

  // =========================================================================
  // .NET method signature decoder (ECMA-335)
  // =========================================================================

  const ELEMENT_TYPE_NAMES = {
    0x01: 'void', 0x02: 'bool', 0x03: 'char', 0x04: 'sbyte', 0x05: 'byte',
    0x06: 'short', 0x07: 'ushort', 0x08: 'int', 0x09: 'uint',
    0x0A: 'long', 0x0B: 'ulong', 0x0C: 'float', 0x0D: 'double',
    0x0E: 'string', 0x16: 'typedref', 0x18: 'IntPtr', 0x19: 'UIntPtr',
    0x1C: 'object',
  };

  function _decodeMethodSig(blobBytes, readHeapStr, tables) {
    if (!blobBytes || blobBytes.length < 2) return null;
    let pos = 0;
    const callConv = blobBytes[pos++];
    // Generic method?
    let genParamCount = 0;
    if (callConv & 0x10) {
      genParamCount = blobBytes[pos++];
    }
    const paramCount = blobBytes[pos++];

    function readType() {
      if (pos >= blobBytes.length) return '?';
      const t = blobBytes[pos++];
      if (ELEMENT_TYPE_NAMES[t]) return ELEMENT_TYPE_NAMES[t];
      if (t === 0x10) return readType() + '&'; // byref
      if (t === 0x0F) return readType() + '*'; // ptr
      if (t === 0x1D) return readType() + '[]'; // szarray
      if (t === 0x11 || t === 0x12) { // valuetype or class — read compressed token
        let tokenVal = 0, shift = 0;
        while (pos < blobBytes.length) {
          const b = blobBytes[pos++];
          tokenVal |= (b & 0x7F) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
        }
        const tableIdx = tokenVal & 3;
        const row = (tokenVal >> 2) - 1;
        const tokenTables = [0x02, 0x01, 0x1B];
        const table = tables[tokenTables[tableIdx]];
        if (table && row >= 0 && row < table.length) {
          const entry = table[row];
          const ns = readHeapStr(entry.ns);
          const name = readHeapStr(entry.name);
          return ns ? ns + '.' + name : name;
        }
        return t === 0x11 ? 'valuetype?' : 'class?';
      }
      if (t === 0x14) { // array
        const elemType = readType();
        // skip rank + sizes + lo-bounds (compressed ints)
        if (pos < blobBytes.length) {
          const rank = blobBytes[pos++];
          if (pos < blobBytes.length) { const numSizes = blobBytes[pos++]; pos += numSizes; }
          if (pos < blobBytes.length) { const numLoBounds = blobBytes[pos++]; pos += numLoBounds; }
        }
        return elemType + '[,]';
      }
      if (t === 0x1E) return readType() + '?'; // CMOD_OPT
      if (t === 0x1F) return readType() + '!'; // CMOD_REQD
      if (t === 0x45) return readType() + '^'; // pinned
      return '?';
    }

    const retType = readType();
    const paramTypes = [];
    for (let i = 0; i < paramCount && pos < blobBytes.length; ++i)
      paramTypes.push(readType());

    return { retType, paramTypes, genParamCount };
  }

  // =========================================================================
  // .NET Assembly tree builder — namespace > type > member hierarchy
  // =========================================================================

  function _buildAssemblyTree(meta, rvaToOffset, bytes) {
    if (!meta || !meta.tables) return null;
    const typeDefs = meta.tables[0x02];
    const methodDefs = meta.tables[0x06];
    const fieldDefs = meta.tables[0x04];
    const params = meta.tables[0x08];
    if (!typeDefs || !methodDefs) return null;

    const str = meta.strings;
    const namespaces = {};

    for (let i = 0; i < typeDefs.length; ++i) {
      const td = typeDefs[i];
      const typeName = str(td.name);
      const ns = str(td.ns) || '(global)';
      if (typeName === '<Module>') continue;

      // Determine type kind from flags
      const vis = td.flags & 0x07;
      const isInterface = (td.flags & 0x20) !== 0;
      const isAbstract = (td.flags & 0x80) !== 0;
      const isSealed = (td.flags & 0x100) !== 0;
      const semantics = (td.flags & 0x20) ? 'interface' : (td.flags & 0x100) && (td.flags & 0x80) ? 'static class' : isAbstract ? 'abstract class' : isSealed ? 'sealed class' : 'class';

      // Check for enum/struct via extends
      let isEnum = false, isStruct = false;
      if (td.extends) {
        const extTables = [0x02, 0x01, 0x1B];
        const extTag = td.extends & 3;
        const extRow = (td.extends >> 2) - 1;
        const extTable = meta.tables[extTables[extTag]];
        if (extTable && extRow >= 0 && extRow < extTable.length) {
          const extName = str(extTable[extRow].name);
          if (extName === 'Enum') isEnum = true;
          else if (extName === 'ValueType' && typeName !== 'Enum') isStruct = true;
        }
      }

      const kind = isEnum ? 'enum' : isStruct ? 'struct' : semantics;
      const accessStr = (vis === 1 || vis === 2) ? 'public ' : (vis === 3) ? 'internal ' : '';
      const declaration = accessStr + kind + ' ' + typeName;

      // Resolve methods for this type
      const methodStart = td.methodList - 1; // 1-based to 0-based
      const methodEnd = (i + 1 < typeDefs.length) ? typeDefs[i + 1].methodList - 1 : methodDefs.length;
      const members = [];

      for (let m = methodStart; m < methodEnd && m < methodDefs.length; ++m) {
        const md = methodDefs[m];
        const mName = str(md.name);
        const mVis = md.flags & 0x07;
        const isStatic = (md.flags & 0x10) !== 0;
        const isVirtual = (md.flags & 0x40) !== 0;
        const isAbstractM = (md.flags & 0x400) !== 0;
        const access = mVis === 6 ? 'public' : mVis === 5 ? 'internal' : mVis === 4 ? 'protected' : mVis === 3 ? 'protected internal' : 'private';
        const modifiers = (isStatic ? ' static' : '') + (isAbstractM ? ' abstract' : isVirtual ? ' virtual' : '');

        // Decode signature for return type and param types
        let sigStr = 'void ' + mName + '()';
        if (meta.readBlob && md.signature) {
          const sigBlob = meta.readBlob(md.signature);
          const decoded = _decodeMethodSig(sigBlob, str, meta.tables);
          if (decoded) {
            // Resolve param names
            const pStart = md.paramList - 1;
            const pEnd = (m + 1 < methodDefs.length) ? methodDefs[m + 1].paramList - 1 : (params ? params.length : 0);
            const paramStrs = [];
            for (let p = 0; p < decoded.paramTypes.length; ++p) {
              const pIdx = pStart + p + (params && pStart < params.length && params[pStart].sequence === 0 ? 1 : 0);
              const pName = (params && pIdx >= 0 && pIdx < params.length) ? str(params[pIdx].name) : 'arg' + p;
              paramStrs.push(decoded.paramTypes[p] + ' ' + pName);
            }
            sigStr = decoded.retType + ' ' + mName + '(' + paramStrs.join(', ') + ')';
          }
        }
        members.push({ text: access + modifiers + ' ' + sigStr, rva: md.rva, kind: 'method' });
      }

      // Resolve fields for this type
      if (fieldDefs) {
        const fieldStart = td.fieldList - 1;
        const fieldEnd = (i + 1 < typeDefs.length) ? typeDefs[i + 1].fieldList - 1 : fieldDefs.length;
        for (let f = fieldStart; f < fieldEnd && f < fieldDefs.length; ++f) {
          const fd = fieldDefs[f];
          const fName = str(fd.name);
          const fVis = fd.flags & 0x07;
          const fStatic = (fd.flags & 0x10) !== 0;
          const fAccess = fVis === 6 ? 'public' : fVis === 5 ? 'internal' : fVis === 4 ? 'protected' : 'private';
          members.push({ text: fAccess + (fStatic ? ' static' : '') + ' field ' + fName, kind: 'field' });
        }
      }

      if (!namespaces[ns]) namespaces[ns] = [];
      namespaces[ns].push({ declaration, members });
    }

    const tree = Object.entries(namespaces)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ns, types]) => ({ namespace: ns, types }));

    return tree.length > 0 ? tree : null;
  }

  // =========================================================================
  // .NET method body discovery — extract per-method IL entry points
  // =========================================================================

  function _discoverMethodBodies(meta, rvaToOffset, bytes) {
    if (!meta || !meta.tables) return null;
    const methodDefs = meta.tables[0x06];
    const typeDefs = meta.tables[0x02];
    if (!methodDefs) return null;
    const str = meta.strings;
    const entries = [];

    for (let m = 0; m < methodDefs.length && m < 500; ++m) {
      const md = methodDefs[m];
      if (md.rva === 0) continue;
      const fileOffset = rvaToOffset(md.rva);
      if (fileOffset >= bytes.length) continue;

      // Read method header to determine code size
      const headerByte = bytes[fileOffset];
      let codeOffset, codeSize;
      if ((headerByte & 0x03) === 0x02) {
        // Tiny header: upper 6 bits = code size, header is 1 byte
        codeSize = (headerByte >> 2) & 0x3F;
        codeOffset = fileOffset + 1;
      } else if ((headerByte & 0x03) === 0x03) {
        // Fat header: 12 bytes
        if (fileOffset + 12 > bytes.length) continue;
        codeSize = readU32LE(bytes, fileOffset + 4);
        codeOffset = fileOffset + 12;
      } else continue;

      if (codeSize === 0 || codeOffset + codeSize > bytes.length) continue;

      // Find containing type
      const mName = str(md.name);
      let typeName = '';
      for (let t = 0; t < typeDefs.length; ++t) {
        const td = typeDefs[t];
        const mStart = td.methodList - 1;
        const mEnd = (t + 1 < typeDefs.length) ? typeDefs[t + 1].methodList - 1 : methodDefs.length;
        if (m >= mStart && m < mEnd) {
          const ns = str(td.ns);
          const tn = str(td.name);
          typeName = ns ? ns + '.' + tn : tn;
          break;
        }
      }

      entries.push({
        archId: 'msil',
        offset: codeOffset,
        rva: md.rva,
        label: typeName + '.' + mName,
        options: meta ? { metadata: meta } : undefined,
        codeSection: { start: codeOffset, end: codeOffset + codeSize, rva: md.rva, size: codeSize },
      });
    }
    return entries.length > 0 ? entries : null;
  }

  // =========================================================================
  // PE Resource directory parser — extracts icons, bitmaps, version info, manifests
  // =========================================================================

  const RT_NAMES = {
    1: 'RT_CURSOR', 2: 'RT_BITMAP', 3: 'RT_ICON', 4: 'RT_MENU', 5: 'RT_DIALOG',
    6: 'RT_STRING', 7: 'RT_FONTDIR', 8: 'RT_FONT', 9: 'RT_ACCELERATOR',
    10: 'RT_RCDATA', 11: 'RT_MESSAGETABLE', 12: 'RT_GROUP_CURSOR',
    14: 'RT_GROUP_ICON', 16: 'RT_VERSION', 24: 'RT_MANIFEST',
  };

  function _parsePEResources(bytes, rvaToOffset, dataDirBase, numDataDirs, sections) {
    if (numDataDirs <= 2 || dataDirBase + 3 * 8 > bytes.length) return null;
    const resRVA = readU32LE(bytes, dataDirBase + 2 * 8);
    const resSz = readU32LE(bytes, dataDirBase + 2 * 8 + 4);
    if (resRVA === 0 || resSz === 0) return null;

    const resBase = rvaToOffset(resRVA);
    if (resBase + 16 > bytes.length) return null;

    const fields = [];
    const images = [];
    const iconEntries = [];   // RT_ICON data entries {id, offset, size}
    const groupIcons = [];    // RT_GROUP_ICON data entries
    const bitmapEntries = []; // RT_BITMAP data entries
    let versionData = null;
    let manifestData = null;
    const typeCounts = {};

    // Walk resource directory tree (3 levels: Type -> Name -> Language)
    function walkDir(dirOffset, level, typeId, nameId) {
      if (dirOffset + 16 > bytes.length) return;
      const numNamed = readU16LE(bytes, dirOffset + 12);
      const numId = readU16LE(bytes, dirOffset + 14);
      const total = numNamed + numId;

      for (let i = 0; i < total && i < 200; ++i) {
        const entryOff = dirOffset + 16 + i * 8;
        if (entryOff + 8 > bytes.length) break;
        const nameOrId = readU32LE(bytes, entryOff);
        const dataOrDir = readU32LE(bytes, entryOff + 4);
        const isDir = (dataOrDir & 0x80000000) !== 0;
        const offset = resBase + (dataOrDir & 0x7FFFFFFF);

        const entryId = (nameOrId & 0x80000000) ? 0 : nameOrId;

        if (isDir) {
          if (level === 0)
            walkDir(offset, 1, entryId, 0);
          else if (level === 1)
            walkDir(offset, 2, typeId, entryId);
          else
            walkDir(offset, 3, typeId, nameId);
        } else {
          // Data entry: RVA(4), Size(4), CodePage(4), Reserved(4)
          if (offset + 16 > bytes.length) continue;
          const dataRVA = readU32LE(bytes, offset);
          const dataSize = readU32LE(bytes, offset + 4);
          const dataOff = rvaToOffset(dataRVA);
          if (dataOff + dataSize > bytes.length) continue;

          const tid = level >= 1 ? typeId : entryId;
          typeCounts[tid] = (typeCounts[tid] || 0) + 1;

          if (tid === 3) // RT_ICON
            iconEntries.push({ id: nameId || entryId, offset: dataOff, size: dataSize });
          else if (tid === 14) // RT_GROUP_ICON
            groupIcons.push({ offset: dataOff, size: dataSize });
          else if (tid === 2) // RT_BITMAP
            bitmapEntries.push({ id: nameId || entryId, offset: dataOff, size: dataSize });
          else if (tid === 16 && !versionData) // RT_VERSION
            versionData = { offset: dataOff, size: dataSize };
          else if (tid === 24 && !manifestData) // RT_MANIFEST
            manifestData = { offset: dataOff, size: dataSize };
        }
      }
    }

    walkDir(resBase, 0, 0, 0);

    // Summary fields
    for (const [tid, count] of Object.entries(typeCounts)) {
      const name = RT_NAMES[tid] || 'Type ' + tid;
      fields.push({ key: 'pe.res.' + tid, label: name, value: count + ' entry(ies)' });
    }

    // Reconstruct ICO from RT_GROUP_ICON + RT_ICON entries
    for (let gi = 0; gi < groupIcons.length && gi < 10; ++gi) {
      const g = groupIcons[gi];
      if (g.size < 6) continue;
      const gCount = readU16LE(bytes, g.offset + 4);
      if (gCount === 0 || g.size < 6 + gCount * 14) continue;

      // Calculate total ICO size
      let totalDataSize = 6 + gCount * 16; // ICO header + directory
      const entries = [];
      for (let e = 0; e < gCount; ++e) {
        const eBase = g.offset + 6 + e * 14;
        const id = readU16LE(bytes, eBase + 12);
        const icon = iconEntries.find(ic => ic.id === id);
        if (!icon) continue;
        entries.push({ eBase, icon, dirOffset: totalDataSize });
        totalDataSize += icon.size;
      }

      if (entries.length === 0) continue;

      // Build ICO file
      const ico = new Uint8Array(totalDataSize);
      // ICONDIR header: reserved(2), type=1(2), count(2)
      ico[2] = 1; // type = icon
      ico[4] = entries.length & 0xFF;
      ico[5] = (entries.length >> 8) & 0xFF;

      let dataPos = 6 + entries.length * 16;
      for (let e = 0; e < entries.length; ++e) {
        const { eBase, icon, dirOffset } = entries[e];
        const dBase = 6 + e * 16;
        // Copy width, height, colors, reserved, planes, bpp from group entry
        ico[dBase] = bytes[eBase];       // width
        ico[dBase + 1] = bytes[eBase + 1]; // height
        ico[dBase + 2] = bytes[eBase + 2]; // color count
        ico[dBase + 3] = 0;               // reserved
        ico[dBase + 4] = bytes[eBase + 4]; // planes lo
        ico[dBase + 5] = bytes[eBase + 5]; // planes hi
        ico[dBase + 6] = bytes[eBase + 6]; // bpp lo
        ico[dBase + 7] = bytes[eBase + 7]; // bpp hi
        // Size of image data (4 bytes LE)
        ico[dBase + 8] = icon.size & 0xFF;
        ico[dBase + 9] = (icon.size >> 8) & 0xFF;
        ico[dBase + 10] = (icon.size >> 16) & 0xFF;
        ico[dBase + 11] = (icon.size >> 24) & 0xFF;
        // Offset to image data (4 bytes LE)
        ico[dBase + 12] = dirOffset & 0xFF;
        ico[dBase + 13] = (dirOffset >> 8) & 0xFF;
        ico[dBase + 14] = (dirOffset >> 16) & 0xFF;
        ico[dBase + 15] = (dirOffset >> 24) & 0xFF;

        ico.set(bytes.subarray(icon.offset, icon.offset + icon.size), dirOffset);
        dataPos += icon.size;
      }

      const w = bytes[entries[0].eBase] || 256;
      const h = bytes[entries[0].eBase + 1] || 256;
      images.push({ label: 'Icon Group ' + (gi + 1) + ' (' + w + '\u00D7' + h + ', ' + entries.length + ' images)', mimeType: 'image/x-icon', dataUrl: bytesToDataUrl(ico, 'image/x-icon') });
    }

    // Convert RT_BITMAP to displayable BMP (prepend BITMAPFILEHEADER)
    for (let bi = 0; bi < bitmapEntries.length && bi < 20; ++bi) {
      const b = bitmapEntries[bi];
      if (b.size < 40) continue;
      const dibHeaderSize = readU32LE(bytes, b.offset);
      if (dibHeaderSize < 12) continue;
      const bmpFileSize = 14 + b.size;
      const bmp = new Uint8Array(bmpFileSize);
      bmp[0] = 0x42; bmp[1] = 0x4D; // 'BM'
      bmp[2] = bmpFileSize & 0xFF;
      bmp[3] = (bmpFileSize >> 8) & 0xFF;
      bmp[4] = (bmpFileSize >> 16) & 0xFF;
      bmp[5] = (bmpFileSize >> 24) & 0xFF;
      // Offset to pixel data = 14 + DIB header size + palette
      const bpp = readU16LE(bytes, b.offset + 14);
      const numColors = readU32LE(bytes, b.offset + 32);
      const paletteSize = bpp <= 8 ? (numColors > 0 ? numColors : (1 << bpp)) * 4 : 0;
      const pixelOffset = 14 + dibHeaderSize + paletteSize;
      bmp[10] = pixelOffset & 0xFF;
      bmp[11] = (pixelOffset >> 8) & 0xFF;
      bmp[12] = (pixelOffset >> 16) & 0xFF;
      bmp[13] = (pixelOffset >> 24) & 0xFF;
      bmp.set(bytes.subarray(b.offset, b.offset + b.size), 14);

      const w = readI32LE(bytes, b.offset + 4);
      const h = readI32LE(bytes, b.offset + 8);
      images.push({ label: 'Bitmap ' + (bi + 1) + ' (' + Math.abs(w) + '\u00D7' + Math.abs(h) + ')', mimeType: 'image/bmp', dataUrl: bytesToDataUrl(bmp, 'image/bmp') });
    }

    // Parse RT_VERSION (VS_FIXEDFILEINFO + StringFileInfo)
    if (versionData) {
      const vFields = _parseVersionInfo(bytes, versionData.offset, versionData.size);
      if (vFields.length > 0)
        for (const f of vFields) fields.push(f);
    }

    // Parse RT_MANIFEST as XML text
    if (manifestData) {
      const xml = readUTF8(bytes, manifestData.offset, Math.min(manifestData.size, 8192)).trim();
      if (xml)
        fields.push({ key: 'pe.res.manifest', label: 'Manifest', value: xml });
    }

    if (fields.length === 0 && images.length === 0) return null;
    return { categories: [{ name: 'Resources', icon: 'resource', fields }], images };
  }

  // Parse VS_VERSIONINFO structure from RT_VERSION resource
  function _parseVersionInfo(bytes, offset, size) {
    const fields = [];
    const end = offset + size;
    if (end > bytes.length || size < 40) return fields;

    // Look for VS_FIXEDFILEINFO signature 0xFEEF04BD
    let sigOff = -1;
    for (let i = offset; i < Math.min(end, offset + 200) - 4; ++i)
      if (readU32LE(bytes, i) === 0xFEEF04BD) { sigOff = i; break; }

    if (sigOff >= 0 && sigOff + 52 <= end) {
      const major = readU16LE(bytes, sigOff + 10) + '.' + readU16LE(bytes, sigOff + 8);
      const minor = readU16LE(bytes, sigOff + 14) + '.' + readU16LE(bytes, sigOff + 12);
      fields.push({ key: 'pe.ver.fileVersion', label: 'File Version', value: major + '.' + minor });
      const pMajor = readU16LE(bytes, sigOff + 18) + '.' + readU16LE(bytes, sigOff + 16);
      const pMinor = readU16LE(bytes, sigOff + 22) + '.' + readU16LE(bytes, sigOff + 20);
      fields.push({ key: 'pe.ver.productVersion', label: 'Product Version', value: pMajor + '.' + pMinor });
    }

    // Look for StringFileInfo entries — UTF-16LE key=value pairs
    const knownKeys = ['CompanyName', 'FileDescription', 'FileVersion', 'InternalName',
      'LegalCopyright', 'OriginalFilename', 'ProductName', 'ProductVersion', 'Comments'];
    for (const key of knownKeys) {
      // Search for UTF-16LE encoded key
      const needle = [];
      for (let k = 0; k < key.length; ++k) { needle.push(key.charCodeAt(k)); needle.push(0); }
      needle.push(0); needle.push(0); // null terminator

      for (let i = offset; i < end - needle.length; ++i) {
        let match = true;
        for (let j = 0; j < needle.length; ++j)
          if (bytes[i + j] !== needle[j]) { match = false; break; }
        if (!match) continue;

        // Value follows after the key + padding
        let vStart = i + needle.length;
        while (vStart < end && (vStart & 1)) ++vStart; // align to 2-byte boundary
        let val = '';
        for (let j = vStart; j + 1 < end && j < vStart + 512; j += 2) {
          const code = readU16LE(bytes, j);
          if (code === 0) break;
          val += String.fromCharCode(code);
        }
        if (val)
          fields.push({ key: 'pe.ver.' + key, label: key, value: val });
        break;
      }
    }
    return fields;
  }

  // =========================================================================
  // Embedded strings extraction — scans PE sections for ANSI and Unicode strings
  // =========================================================================

  function _extractStrings(bytes, sections) {
    const results = [];
    const seen = new Set(); // deduplicate by value

    for (const sec of sections) {
      const base = sec.rawDataOffset;
      const end = Math.min(base + sec.rawDataSize, bytes.length);
      const secName = sec.name.replace(/\0/g, '');

      // ANSI strings (printable ASCII runs >= 4 chars, null-terminated)
      let strStart = -1;
      for (let j = base; j < end; ++j) {
        const b = bytes[j];
        if (b >= 0x20 && b < 0x7F) {
          if (strStart < 0) strStart = j;
        } else {
          if (b === 0 && strStart >= 0 && j - strStart >= 4) {
            const val = readString(bytes, strStart, Math.min(j - strStart, 512));
            if (!seen.has(val)) {
              seen.add(val);
              const rva = sec.virtualAddress + (strStart - base);
              results.push({ offset: strStart, rva, value: val, encoding: 'ANSI', section: secName });
            }
          }
          strStart = -1;
        }
      }

      // Unicode (UTF-16LE) strings: character pairs >= 4 chars, null-terminated
      // Supports full BMP range (not just ASCII) — detects printable Unicode chars
      for (let j = base; j + 1 < end; j += 2) {
        const cp = readU16LE(bytes, j);
        // Accept printable characters: space..tilde, Latin-1 Supplement (0xA0+), or common Unicode ranges
        if (cp >= 0x20 && cp !== 0x7F && cp !== 0xFFFE && cp !== 0xFFFF) {
          const uStart = j;
          let uEnd = j;
          while (uEnd + 1 < end) {
            const uc = readU16LE(bytes, uEnd);
            if (uc >= 0x20 && uc !== 0x7F && uc !== 0xFFFE && uc !== 0xFFFF)
              uEnd += 2;
            else
              break;
          }
          const charCount = (uEnd - uStart) / 2;
          if (charCount >= 4 && uEnd + 1 < end && bytes[uEnd] === 0 && bytes[uEnd + 1] === 0) {
            let val = '';
            for (let k = uStart; k < uEnd; k += 2)
              val += String.fromCharCode(readU16LE(bytes, k));
            // Only add if not pure ASCII duplicate of an ANSI entry
            if (!seen.has(val)) {
              seen.add(val);
              const rva = sec.virtualAddress + (uStart - base);
              const isAsciiOnly = charCount === val.length && /^[\x20-\x7E]+$/.test(val);
              results.push({ offset: uStart, rva, value: val, encoding: isAsciiOnly ? 'UTF-16' : 'Unicode', section: secName });
            }
          }
          j = Math.max(j, uEnd - 2); // -2 because the loop does j+=2
        }
      }
    }

    results.sort((a, b) => a.offset - b.offset);

    const fields = results.map((s, i) => ({
      key: 'pe.str.' + i,
      label: '0x' + s.offset.toString(16).toUpperCase(),
      value: s.value,
      encoding: s.encoding,
      section: s.section,
    }));

    return { name: 'Strings (' + results.length + ')', icon: 'strings', fields, _stringData: results };
  }

  // =========================================================================
  // PE (exe/dll) parser — sections, imports, exports, .NET, compiler detection
  // =========================================================================

  function parsePE(bytes) {
    const categories = [];
    const fields = [];
    const images = [];
    const byteRegions = [];
    const empty = { categories: [{ name: 'PE Header', icon: 'exe', fields }], images: [], byteRegions: [] };
    if (bytes.length < 64) return empty;

    // DOS header
    byteRegions.push({ offset: 0, length: 2, label: 'MZ Signature', color: 0 });
    byteRegions.push({ offset: 2, length: 0x3C - 2, label: 'DOS Header', color: 5 });
    byteRegions.push({ offset: 0x3C, length: 4, label: 'PE Offset (e_lfanew)', color: 3 });

    const e_lfanew = readU32LE(bytes, 0x3C);
    if (e_lfanew + 24 > bytes.length)
      return { categories: [{ name: 'PE Header', icon: 'exe', fields: [{ key: 'pe.error', label: 'Error', value: 'Invalid PE offset' }] }], images: [], byteRegions };

    // DOS stub
    if (e_lfanew > 0x40)
      byteRegions.push({ offset: 0x40, length: e_lfanew - 0x40, label: 'DOS Stub', color: 5 });

    if (readU32LE(bytes, e_lfanew) !== 0x00004550)
      return { categories: [{ name: 'PE Header', icon: 'exe', fields: [{ key: 'pe.error', label: 'Error', value: 'Invalid PE signature' }] }], images: [], byteRegions };

    byteRegions.push({ offset: e_lfanew, length: 4, label: 'PE Signature', color: 0 });

    const coffBase = e_lfanew + 4;
    byteRegions.push({ offset: coffBase, length: 20, label: 'COFF Header', color: 1 });
    const machine = readU16LE(bytes, coffBase);
    const numSections = readU16LE(bytes, coffBase + 2);
    const timestamp = readU32LE(bytes, coffBase + 4);
    const optionalHeaderSize = readU16LE(bytes, coffBase + 16);
    const characteristics = readU16LE(bytes, coffBase + 18);

    const machineNames = {
      0x014C: 'x86 (i386)', 0x8664: 'x64 (AMD64)', 0x01C0: 'ARM',
      0x01C4: 'ARM Thumb-2', 0xAA64: 'ARM64', 0x5032: 'RISC-V 32',
      0x5064: 'RISC-V 64', 0x0200: 'IA-64',
    };

    fields.push({ key: 'pe.machine', label: 'Architecture', value: machineNames[machine] || '0x' + machine.toString(16).toUpperCase() });
    fields.push({ key: 'pe.sections', label: 'Sections', value: String(numSections) });
    fields.push({ key: 'pe.timestamp', label: 'Compile Time', value: formatTimestamp(timestamp) });

    const isDLL = (characteristics & 0x2000) !== 0;
    fields.push({ key: 'pe.type', label: 'File Type', value: isDLL ? 'DLL (Dynamic Library)' : 'Executable' });

    const charFlags = [];
    if (characteristics & 0x0020) charFlags.push('Large Address Aware');
    if (characteristics & 0x0100) charFlags.push('32-bit');
    if (characteristics & 0x2000) charFlags.push('DLL');
    if (characteristics & 0x0002) charFlags.push('Executable Image');
    if (charFlags.length > 0)
      fields.push({ key: 'pe.chars', label: 'Characteristics', value: charFlags.join(', ') });

    // Optional header
    const optBase = coffBase + 20;
    let isPE32Plus = false;
    let numDataDirs = 0;
    let dataDirBase = 0;

    if (optBase + 2 <= bytes.length) {
      const optMagic = readU16LE(bytes, optBase);
      isPE32Plus = optMagic === 0x020B;
      fields.push({ key: 'pe.format', label: 'PE Format', value: isPE32Plus ? 'PE32+ (64-bit)' : 'PE32 (32-bit)' });

      const linkerMajor = readU8(bytes, optBase + 2);
      const linkerMinor = readU8(bytes, optBase + 3);
      fields.push({ key: 'pe.linker', label: 'Linker Version', value: linkerMajor + '.' + linkerMinor });

      const subsystemOff = isPE32Plus ? optBase + 68 : optBase + 68;
      if (subsystemOff + 2 <= bytes.length) {
        const subsystem = readU16LE(bytes, subsystemOff);
        const subsystemNames = {
          0: 'Unknown', 1: 'Native', 2: 'Windows GUI', 3: 'Windows Console',
          5: 'OS/2 Console', 7: 'POSIX Console', 9: 'Windows CE',
          10: 'EFI Application', 12: 'EFI Boot Driver', 14: 'Xbox',
        };
        fields.push({ key: 'pe.subsystem', label: 'Subsystem', value: subsystemNames[subsystem] || String(subsystem) });
      }

      const entryRVA = readU32LE(bytes, optBase + 16);
      fields.push({ key: 'pe.entry', label: 'Entry Point', value: '0x' + entryRVA.toString(16).toUpperCase() });

      const sizeOfImage = readU32LE(bytes, isPE32Plus ? optBase + 56 : optBase + 56);
      fields.push({ key: 'pe.imageSize', label: 'Image Size', value: formatSize(sizeOfImage) });

      const numDirsOff = isPE32Plus ? optBase + 108 : optBase + 92;
      if (numDirsOff + 4 <= bytes.length) {
        numDataDirs = readU32LE(bytes, numDirsOff);
        dataDirBase = numDirsOff + 4;
      }
    }

    // ---- Section table ----
    const sectionTableBase = optBase + optionalHeaderSize;
    const sections = [];
    const sectionFields = [];

    for (let i = 0; i < numSections; ++i) {
      const sb = sectionTableBase + i * 40;
      if (sb + 40 > bytes.length) break;
      const name = readString(bytes, sb, 8);
      const virtualSize = readU32LE(bytes, sb + 8);
      const virtualAddress = readU32LE(bytes, sb + 12);
      const rawDataSize = readU32LE(bytes, sb + 16);
      const rawDataOffset = readU32LE(bytes, sb + 20);
      const secChars = readU32LE(bytes, sb + 36);
      sections.push({ name, virtualSize, virtualAddress, rawDataSize, rawDataOffset, characteristics: secChars });

      const sf = [];
      if (secChars & 0x00000020) sf.push('Code');
      if (secChars & 0x00000040) sf.push('InitData');
      if (secChars & 0x00000080) sf.push('UninitData');
      if (secChars & 0x20000000) sf.push('Exec');
      if (secChars & 0x40000000) sf.push('Read');
      if (secChars & 0x80000000) sf.push('Write');
      sectionFields.push({ key: 'pe.sec.' + i, label: name, value: formatSize(virtualSize) + ' (' + sf.join(', ') + ')' });
    }

    if (sectionFields.length > 0)
      categories.push({ name: 'Sections', icon: 'list', fields: sectionFields });

    // RVA → file offset helper
    function rvaToOffset(rva) {
      for (const sec of sections)
        if (rva >= sec.virtualAddress && rva < sec.virtualAddress + sec.rawDataSize)
          return rva - sec.virtualAddress + sec.rawDataOffset;
      return rva;
    }

    // ---- Import Directory (Data Directory[1]) ----
    const dllNames = [];
    if (numDataDirs > 1 && dataDirBase + 16 <= bytes.length) {
      const importRVA = readU32LE(bytes, dataDirBase + 8);
      const importSz = readU32LE(bytes, dataDirBase + 12);
      if (importRVA > 0 && importSz > 0) {
        const importFields = [];
        let pos = rvaToOffset(importRVA);
        while (pos + 20 <= bytes.length && importFields.length < 100) {
          const nameRVA = readU32LE(bytes, pos + 12);
          if (nameRVA === 0) break;
          const origFirstThunk = readU32LE(bytes, pos);
          const firstThunk = readU32LE(bytes, pos + 16);
          const dllName = readString(bytes, rvaToOffset(nameRVA), 256);
          if (!dllName) { pos += 20; continue; }
          dllNames.push(dllName);

          const funcNames = [];
          const thunkRVA = origFirstThunk || firstThunk;
          if (thunkRVA > 0) {
            let tp = rvaToOffset(thunkRVA);
            const ts = isPE32Plus ? 8 : 4;
            const ordinalFlag32 = 0x80000000;
            while (tp + ts <= bytes.length && funcNames.length < 500) {
              const tv = isPE32Plus ? readU64LE(bytes, tp) : readU32LE(bytes, tp);
              if (tv === 0) break;
              if (isPE32Plus) {
                // 64-bit: ordinal flag is bit 63
                const hi = readU32LE(bytes, tp + 4);
                if ((hi & 0x80000000) !== 0)
                  funcNames.push('#' + (tv & 0xFFFF));
                else {
                  const nameOff = rvaToOffset(tv & 0x7FFFFFFF);
                  if (nameOff + 2 < bytes.length) {
                    const name = readString(bytes, nameOff + 2, 256);
                    funcNames.push(name || '#hint(' + readU16LE(bytes, nameOff) + ')');
                  }
                }
              } else {
                if ((tv & ordinalFlag32) !== 0)
                  funcNames.push('#' + (tv & 0xFFFF));
                else {
                  const nameOff = rvaToOffset(tv);
                  if (nameOff + 2 < bytes.length) {
                    const name = readString(bytes, nameOff + 2, 256);
                    funcNames.push(name || '#hint(' + readU16LE(bytes, nameOff) + ')');
                  }
                }
              }
              tp += ts;
            }
          }
          importFields.push({
            key: 'pe.imp.' + importFields.length, label: dllName,
            value: funcNames.length + ' function(s)',
            expandable: true, children: funcNames,
          });
          pos += 20;
        }
        if (importFields.length > 0)
          categories.push({ name: 'Imports (' + importFields.length + ' DLLs)', icon: 'link', fields: importFields });
      }
    }

    // ---- Export Directory (Data Directory[0]) ----
    if (numDataDirs > 0 && dataDirBase + 8 <= bytes.length) {
      const exportRVA = readU32LE(bytes, dataDirBase);
      const exportSz = readU32LE(bytes, dataDirBase + 4);
      if (exportRVA > 0 && exportSz > 0) {
        const eo = rvaToOffset(exportRVA);
        if (eo + 40 <= bytes.length) {
          const exportFields = [];
          const enameRVA = readU32LE(bytes, eo + 12);
          const ename = readString(bytes, rvaToOffset(enameRVA), 256);
          if (ename) exportFields.push({ key: 'pe.exp.name', label: 'DLL Name', value: ename });

          const numFunctions = readU32LE(bytes, eo + 20);
          const numNames = readU32LE(bytes, eo + 24);
          exportFields.push({ key: 'pe.exp.count', label: 'Exported Functions', value: String(numFunctions) });
          exportFields.push({ key: 'pe.exp.named', label: 'Named Exports', value: String(numNames) });

          const namesRVA = readU32LE(bytes, eo + 32);
          if (namesRVA > 0 && numNames > 0) {
            const no = rvaToOffset(namesRVA);
            const exportNames = [];
            for (let i = 0; i < Math.min(numNames, 30) && no + (i + 1) * 4 <= bytes.length; ++i) {
              const fnRVA = readU32LE(bytes, no + i * 4);
              const fn = readString(bytes, rvaToOffset(fnRVA), 256);
              if (fn) exportNames.push(fn);
            }
            if (exportNames.length > 0)
              exportFields.push({ key: 'pe.exp.names', label: 'Export Names', value: exportNames.join('\n') + (numNames > 30 ? '\n... (' + (numNames - 30) + ' more)' : '') });
          }
          if (exportFields.length > 0)
            categories.push({ name: 'Exports', icon: 'link', fields: exportFields });
        }
      }
    }

    // ---- .NET CLR header (Data Directory[14]) ----
    let isDotNet = false;
    let dotNetMetadata = null; // for MSIL disassembler token resolution
    if (numDataDirs > 14 && dataDirBase + 14 * 8 + 8 <= bytes.length) {
      const clrRVA = readU32LE(bytes, dataDirBase + 14 * 8);
      const clrSz = readU32LE(bytes, dataDirBase + 14 * 8 + 4);
      if (clrRVA > 0 && clrSz > 0) {
        isDotNet = true;
        const co = rvaToOffset(clrRVA);
        const clrFields = [{ key: 'pe.clr.runtime', label: 'Runtime', value: '.NET (CLR)' }];
        if (co + 20 <= bytes.length) {
          const clrMajor = readU16LE(bytes, co + 4);
          const clrMinor = readU16LE(bytes, co + 6);
          clrFields.push({ key: 'pe.clr.ver', label: 'CLR Header Version', value: clrMajor + '.' + clrMinor });
          const clrFlags = readU32LE(bytes, co + 16);
          if (clrFlags & 0x01) clrFields.push({ key: 'pe.clr.ilonly', label: 'IL Only', value: 'Yes' });
          if (clrFlags & 0x02) clrFields.push({ key: 'pe.clr.32bit', label: '32-bit Required', value: 'Yes' });
          if (clrFlags & 0x10000) clrFields.push({ key: 'pe.clr.native', label: 'Native Entry Point', value: 'Yes' });
        }
        // Detect .NET type from string scan
        const scanLen = Math.min(bytes.length, 65536);
        const scanStr = readString(bytes, 0, scanLen);
        if (scanStr.includes('.NETCoreApp'))
          clrFields.push({ key: 'pe.clr.type', label: '.NET Type', value: '.NET Core / .NET 5+' });
        else if (scanStr.includes('.NETFramework'))
          clrFields.push({ key: 'pe.clr.type', label: '.NET Type', value: '.NET Framework' });
        categories.push({ name: '.NET CLR', icon: 'exe', fields: clrFields });

        // Parse .NET metadata streams for MSIL token resolution
        if (co + 16 <= bytes.length) {
          const metaRVA = readU32LE(bytes, co + 8);
          const metaSz = readU32LE(bytes, co + 12);
          if (metaRVA > 0 && metaSz > 0)
            dotNetMetadata = _parseDotNetMetadata(bytes, rvaToOffset(metaRVA), metaSz);
        }

        // Build .NET Assembly tree view
        if (dotNetMetadata) {
          const tree = _buildAssemblyTree(dotNetMetadata, rvaToOffset, bytes);
          if (tree)
            categories.push({ name: '.NET Assembly', icon: 'dotnet', fields: [], _assemblyTree: tree });
        }
      }
    }

    // ---- Compiler / Packer / Protector detection ----
    const detFields = [];

    // Rich header → MSVC
    let hasRich = false;
    for (let i = 0x80; i < Math.min(e_lfanew, bytes.length - 4); i += 4)
      if (readU32LE(bytes, i) === 0x68636952) { hasRich = true; break; }
    if (hasRich)
      detFields.push({ key: 'pe.rich', label: 'Rich Header', value: 'Present (MSVC toolchain)' });

    // Section name analysis
    const secNames = sections.map(s => s.name);
    const secNamesStr = secNames.join(',');

    // DLL import analysis
    const dllNamesLower = dllNames.map(n => n.toLowerCase());

    // String scanning (scan first ~256KB for signatures)
    const scanLimit = Math.min(bytes.length, 262144);
    function findString(needle) {
      for (let i = 0; i < scanLimit - needle.length; ++i) {
        let match = true;
        for (let j = 0; j < needle.length; ++j)
          if (bytes[i + j] !== needle.charCodeAt(j)) { match = false; break; }
        if (match) return true;
      }
      return false;
    }

    // Entry point bytes (first 64 bytes at EP for signature matching)
    const entryRVA = readU32LE(bytes, optBase + 16);
    const epOffset = rvaToOffset(entryRVA);
    const epBytes = [];
    for (let i = 0; i < 64 && epOffset + i < bytes.length; ++i) epBytes.push(bytes[epOffset + i]);

    // ---- Packer detection ----
    const packers = [];

    // UPX
    if (secNames.some(n => n.startsWith('UPX')) || (epBytes[0] === 0x60 && epBytes[1] === 0xBE))
      packers.push('UPX');

    // ASPack
    if (secNames.some(n => n === '.aspack') || (epBytes[0] === 0x60 && epBytes[1] === 0xE8 && epBytes[2] === 0x03))
      packers.push('ASPack');

    // PECompact
    if (secNames.some(n => n === '.pec' || n.startsWith('PEC')))
      packers.push('PECompact');

    // MPRESS
    if (secNames.some(n => n.startsWith('.MPRESS')))
      packers.push('MPRESS');

    // FSG
    if (sections.length >= 2 && sections[0].rawDataSize === 0 && sections[1].rawDataSize > 0 && secNames.some(n => n === ''))
      if (epBytes[0] === 0x87 || epBytes[0] === 0xBE) packers.push('FSG');

    // Petite
    if (secNames.some(n => n === '.petite'))
      packers.push('Petite');

    // PECrypt32
    if (secNames.some(n => n === '.PECry'))
      packers.push('PE-Crypt32');

    // NSPack
    if (secNames.some(n => n === '.nsp0' || n === '.nsp1' || n === '.nsp2'))
      packers.push('NsPack');

    // ---- Protector detection ----
    const protectors = [];

    // Themida / WinLicense
    if (secNames.some(n => n === '.themida') || findString('THEMIDA'))
      protectors.push('Themida / WinLicense');

    // VMProtect
    if (secNames.some(n => n.startsWith('.vmp')))
      protectors.push('VMProtect');

    // Obsidium
    if (secNames.some(n => n === '.obsidium'))
      protectors.push('Obsidium');

    // Enigma Protector
    if (secNames.some(n => n === '.enigma') || findString('Enigma protector'))
      protectors.push('Enigma Protector');

    // Armadillo
    if (findString('ADATA') && findString('Silicon Realms'))
      protectors.push('Armadillo');

    // .NET obfuscators
    if (isDotNet) {
      if (findString('ConfuserEx')) protectors.push('ConfuserEx');
      else if (findString('Confuser')) protectors.push('Confuser');
      if (findString('.NETReactor') || findString('Eziriz')) protectors.push('.NET Reactor');
      if (findString('Dotfuscator')) protectors.push('Dotfuscator');
      if (findString('SmartAssembly')) protectors.push('SmartAssembly');
      if (findString('Babel Obfuscator')) protectors.push('Babel Obfuscator');
    }

    // ---- Compiler / Runtime detection ----
    const compilers = [];

    if (isDotNet) {
      if (findString('.NETCoreApp')) compilers.push('.NET Core / .NET 5+');
      else if (findString('.NETFramework')) compilers.push('.NET Framework');
      else compilers.push('.NET (CLR)');
      if (findString('F# ')) compilers.push('F#');
      if (findString('Visual Basic')) compilers.push('Visual Basic .NET');
    }

    // Go
    if (secNames.some(n => n === '.go' || n === '.gopclnt' || n === '.gosymtab') || findString('runtime.main'))
      compilers.push('Go');

    // Rust
    if (secNames.some(n => n === '.rustc') || findString('rust_begin_unwind'))
      compilers.push('Rust (rustc)');

    // Delphi / C++ Builder
    if (dllNamesLower.includes('borlndmm.dll') || findString('Embarcadero') || findString('Borland C++ -'))
      compilers.push('Delphi / C++ Builder (Embarcadero)');
    else if (findString('Object Pascal') || (secNames.includes('.idata') && secNames.includes('CODE') && secNames.includes('DATA')))
      compilers.push('Delphi (Borland)');

    // Free Pascal / Lazarus
    if (findString('Free Pascal') || findString('FPC '))
      compilers.push('Free Pascal / Lazarus');

    // GCC variants
    if (dllNamesLower.includes('cygwin1.dll')) compilers.push('GCC (Cygwin)');
    else if (dllNamesLower.some(n => n.startsWith('msys-'))) compilers.push('GCC (MSYS2)');
    else if (dllNamesLower.some(n => n.startsWith('libgcc') || n.startsWith('libstdc'))) compilers.push('GCC (MinGW)');

    // MSVC
    if (compilers.length === 0 && !isDotNet) {
      if (hasRich || dllNamesLower.some(n => n.startsWith('vcruntime') || n.startsWith('msvcp') || n.startsWith('msvcr')))
        compilers.push('Microsoft Visual C++ (MSVC)');
    }

    // ---- Installer / Framework detection ----
    const frameworks = [];

    // NSIS
    if (findString('Nullsoft Install System') || findString('NSIS '))
      frameworks.push('NSIS Installer');

    // Inno Setup
    if (findString('Inno Setup'))
      frameworks.push('Inno Setup');

    // InstallShield
    if (findString('InstallShield'))
      frameworks.push('InstallShield');

    // AutoIt
    if (findString('AutoIt') || findString('AU3!'))
      frameworks.push('AutoIt Script');

    // AutoHotkey
    if (findString('AutoHotkey'))
      frameworks.push('AutoHotkey');

    // PyInstaller
    if (findString('MEIPASS') || findString('PYZ-00.pyz') || findString('pyiboot'))
      frameworks.push('PyInstaller (Python)');

    // cx_Freeze
    if (findString('cx_Freeze'))
      frameworks.push('cx_Freeze (Python)');

    // Electron / Node.js
    if (dllNamesLower.includes('node.dll') || findString('electron.asar'))
      frameworks.push('Electron / Node.js');

    // Qt
    if (dllNamesLower.some(n => n.startsWith('qt5') || n.startsWith('qt6')))
      frameworks.push('Qt Framework');

    // wxWidgets
    if (dllNamesLower.some(n => n.startsWith('wxmsw')))
      frameworks.push('wxWidgets');

    // Java (Launch4j / JSmooth)
    if (findString('launch4j') || findString('Launch4j'))
      frameworks.push('Launch4j (Java)');
    else if (dllNamesLower.includes('jvm.dll') || findString('jvm.dll'))
      frameworks.push('Java (JNI)');

    // Build detection summary
    if (packers.length > 0)
      detFields.push({ key: 'pe.packer', label: 'Packer', value: packers.join(', ') });
    if (protectors.length > 0)
      detFields.push({ key: 'pe.protector', label: 'Protector / Obfuscator', value: protectors.join(', ') });
    if (compilers.length > 0)
      detFields.push({ key: 'pe.compiler', label: 'Compiler / Runtime', value: compilers.join(', ') });
    if (frameworks.length > 0)
      detFields.push({ key: 'pe.framework', label: 'Framework / Installer', value: frameworks.join(', ') });

    // Overlay detection (data appended after last section)
    const lastSection = sections[sections.length - 1];
    if (lastSection) {
      const imageEnd = lastSection.rawDataOffset + lastSection.rawDataSize;
      if (imageEnd < bytes.length) {
        const overlaySize = bytes.length - imageEnd;
        detFields.push({ key: 'pe.overlay', label: 'Overlay Data', value: formatSize(overlaySize) + ' appended after PE image' });
      }
    }

    // ---- ExeInfo ASL signature database matching ----
    const sigDb = (typeof SZ !== 'undefined' && SZ.PESignatures) || [];
    if (sigDb.length > 0 && epOffset > 0 && epOffset < bytes.length) {
      const matches = [];
      const EP_MAX = 128;
      const epBuf = new Uint8Array(EP_MAX);
      const epAvail = Math.min(EP_MAX, bytes.length - epOffset);
      for (let i = 0; i < epAvail; ++i) epBuf[i] = bytes[epOffset + i];
      for (const entry of sigDb) {
        const epOnly = entry.length < 3 || entry[2] !== 0;
        if (!epOnly) continue; // non-EP sigs would need full file scan — skip for performance
        const hexSig = entry[1];
        const sigLen = hexSig.length >> 1;
        if (sigLen > epAvail) continue;
        let matched = true;
        for (let i = 0; i < sigLen; ++i) {
          const h = hexSig.charCodeAt(i * 2);
          if (h === 0x3F) continue; // '?' — wildcard byte
          const hi = h <= 0x39 ? h - 0x30 : h - 0x57; // '0'-'9' or 'a'-'f'
          const lo_c = hexSig.charCodeAt(i * 2 + 1);
          const lo = lo_c <= 0x39 ? lo_c - 0x30 : lo_c - 0x57;
          if (epBuf[i] !== ((hi << 4) | lo)) { matched = false; break; }
        }
        if (matched)
          matches.push(entry[0]);
      }
      if (matches.length > 0) {
        detFields.push({ key: 'pe.sigdb', label: 'Signature Match', value: matches[0] });
        if (matches.length > 1)
          detFields.push({ key: 'pe.sigdb.alt', label: 'Alternative Matches', value: matches.slice(1, 6).join('; ') + (matches.length > 6 ? ' (+' + (matches.length - 6) + ' more)' : '') });
      }
    }

    if (detFields.length > 0)
      categories.push({ name: 'Detection', icon: 'exe', fields: detFields });

    // Disassembly info for the controller (array — multiple views for .NET/VB6)
    const peArchMap = { 0x014C: 'x86', 0x8664: 'x64', 0x01C0: 'arm', 0x01C4: 'arm', 0xAA64: 'arm64' };
    const nativeArch = peArchMap[machine] || null;
    let disasmEntries = []; // each entry: { archId, offset, rva, options, label, ... }

    if (isDotNet) {
      // .NET: native entry stub + MSIL
      if (nativeArch)
        disasmEntries.push({ archId: nativeArch, offset: epOffset, rva: entryRVA, label: nativeArch.toUpperCase() + ' Entry Stub' });
      const msilEntry = { archId: 'msil', offset: epOffset, rva: entryRVA, label: '.NET MSIL (Entry)', options: dotNetMetadata ? { metadata: dotNetMetadata } : undefined };
      // Attach per-method IL bodies as navigation targets (not separate accordion panels)
      if (dotNetMetadata) {
        const methodEntries = _discoverMethodBodies(dotNetMetadata, rvaToOffset, bytes);
        if (methodEntries)
          msilEntry.methods = methodEntries;
      }
      disasmEntries.push(msilEntry);
    } else if (nativeArch) {
      // VB6 P-code detection: "VB5!" signature at entry point
      let isVB6PCode = false;
      if (epOffset > 0 && epOffset + 6 < bytes.length && epBytes[0] === 0x68 && epBytes.length >= 6) {
        const vbHeaderRVA = readU32LE(bytes, epOffset + 1);
        const vbHeaderOff = rvaToOffset(vbHeaderRVA);
        if (vbHeaderOff > 0 && vbHeaderOff + 4 < bytes.length && readString(bytes, vbHeaderOff, 4) === 'VB5!') {
          if (vbHeaderOff + 0x25 < bytes.length) {
            const vbNativeCode = bytes[vbHeaderOff + 0x24];
            if (vbNativeCode === 0) {
              isVB6PCode = true;
              compilers.push('Visual Basic 6 (P-code)');
              disasmEntries.push({ archId: nativeArch, offset: epOffset, rva: entryRVA, label: nativeArch.toUpperCase() + ' Entry Stub' });
              disasmEntries.push({ archId: 'vbpcode', offset: epOffset, rva: entryRVA, label: 'VB6 P-Code' });
            } else {
              compilers.push('Visual Basic 6 (Native)');
            }
          }
        }
      }
      if (!isVB6PCode)
        disasmEntries.push({ archId: nativeArch, offset: epOffset, rva: entryRVA });
    }

    // ---- PE Resources (Data Directory[2]) ----
    const resResult = _parsePEResources(bytes, rvaToOffset, dataDirBase, numDataDirs, sections);
    if (resResult) {
      if (resResult.categories)
        for (const c of resResult.categories) categories.push(c);
      if (resResult.images)
        for (const img of resResult.images) images.push(img);
    }

    // ---- Embedded Strings ----
    if (sections.length > 0) {
      const strCat = _extractStrings(bytes, sections);
      if (strCat.fields.length > 0)
        categories.push(strCat);
    }

    categories.unshift({ name: 'PE Header', icon: 'exe', fields });

    // ---- Build rich disassembly annotations for each entry ----
    const disasmArch = disasmEntries.length > 0 ? disasmEntries[0].archId : null;
    if (disasmArch) {
      const imageBase = isPE32Plus ? readU64LE(bytes, optBase + 24) : readU32LE(bytes, optBase + 28);

      // IAT address → import name map (using FirstThunk RVAs which hold runtime addresses)
      const importMap = Object.create(null);
      if (numDataDirs > 1 && dataDirBase + 16 <= bytes.length) {
        const impRVA = readU32LE(bytes, dataDirBase + 8);
        const impSz = readU32LE(bytes, dataDirBase + 12);
        if (impRVA > 0 && impSz > 0) {
          let ip = rvaToOffset(impRVA);
          while (ip + 20 <= bytes.length) {
            const inameRVA = readU32LE(bytes, ip + 12);
            if (inameRVA === 0) break;
            const ift = readU32LE(bytes, ip);      // OriginalFirstThunk (ILT)
            const ft = readU32LE(bytes, ip + 16);   // FirstThunk (IAT)
            const dll = readString(bytes, rvaToOffset(inameRVA), 256);
            if (!dll) { ip += 20; continue; }
            const iltRVA = ift || ft;
            let iatRVA = ft || ift;
            if (iltRVA > 0) {
              let rp = rvaToOffset(iltRVA);
              let ap = iatRVA;
              const ts = isPE32Plus ? 8 : 4;
              for (let n = 0; rp + ts <= bytes.length && n < 500; ++n) {
                const tv = isPE32Plus ? readU64LE(bytes, rp) : readU32LE(bytes, rp);
                if (tv === 0) break;
                let fname = null;
                if (isPE32Plus) {
                  const hi = readU32LE(bytes, rp + 4);
                  if ((hi & 0x80000000) !== 0)
                    fname = '#' + (tv & 0xFFFF);
                  else {
                    const noff = rvaToOffset(tv & 0x7FFFFFFF);
                    if (noff + 2 < bytes.length)
                      fname = readString(bytes, noff + 2, 256) || '#' + readU16LE(bytes, noff);
                  }
                } else {
                  if ((tv & 0x80000000) !== 0)
                    fname = '#' + (tv & 0xFFFF);
                  else {
                    const noff = rvaToOffset(tv);
                    if (noff + 2 < bytes.length)
                      fname = readString(bytes, noff + 2, 256) || '#' + readU16LE(bytes, noff);
                  }
                }
                if (fname)
                  importMap[ap] = dll + '!' + fname;
                rp += ts;
                ap += ts;
              }
            }
            ip += 20;
          }
        }
      }

      // Export RVA → name map (with function addresses)
      const exportMap = Object.create(null);
      if (numDataDirs > 0 && dataDirBase + 8 <= bytes.length) {
        const expRVA = readU32LE(bytes, dataDirBase);
        const expSz = readU32LE(bytes, dataDirBase + 4);
        if (expRVA > 0 && expSz > 0) {
          const exo = rvaToOffset(expRVA);
          if (exo + 40 <= bytes.length) {
            const nFuncs = readU32LE(bytes, exo + 20);
            const nNames = readU32LE(bytes, exo + 24);
            const ordBase = readU32LE(bytes, exo + 16);
            const funcTableRVA = readU32LE(bytes, exo + 28);
            const nameTableRVA = readU32LE(bytes, exo + 32);
            const ordTableRVA = readU32LE(bytes, exo + 36);
            if (nameTableRVA > 0 && ordTableRVA > 0 && funcTableRVA > 0) {
              const nto = rvaToOffset(nameTableRVA);
              const oto = rvaToOffset(ordTableRVA);
              const fto = rvaToOffset(funcTableRVA);
              for (let i = 0; i < Math.min(nNames, 500) && nto + (i + 1) * 4 <= bytes.length; ++i) {
                const fnRVA = readU32LE(bytes, nto + i * 4);
                const fn = readString(bytes, rvaToOffset(fnRVA), 256);
                if (!fn) continue;
                if (oto + (i + 1) * 2 <= bytes.length) {
                  const ord = readU16LE(bytes, oto + i * 2);
                  if (fto + (ord + 1) * 4 <= bytes.length) {
                    const funcRVA = readU32LE(bytes, fto + ord * 4);
                    exportMap[funcRVA] = fn;
                  }
                }
              }
            }
          }
        }
      }

      // String extraction from .rdata and .data sections
      const stringMap = Object.create(null);
      for (const sec of sections) {
        const sn = sec.name.toLowerCase().replace(/\0/g, '');
        if (sn !== '.rdata' && sn !== '.data' && sn !== '.rodata') continue;
        const base = sec.rawDataOffset;
        const end = Math.min(base + sec.rawDataSize, bytes.length);
        let strStart = -1;
        for (let j = base; j < end; ++j) {
          const b = bytes[j];
          if (b >= 0x20 && b < 0x7F) {
            if (strStart < 0) strStart = j;
          } else {
            if (b === 0 && strStart >= 0 && j - strStart >= 4) {
              const rva = sec.virtualAddress + (strStart - base);
              stringMap[rva] = readString(bytes, strStart, Math.min(j - strStart, 120));
            }
            strStart = -1;
          }
        }
      }

      // Find .text (code) section boundaries
      let codeSection = null;
      for (const sec of sections) {
        if ((sec.characteristics & 0x00000020) && (sec.characteristics & 0x20000000)) {
          codeSection = {
            start: sec.rawDataOffset,
            end: sec.rawDataOffset + sec.rawDataSize,
            rva: sec.virtualAddress,
            size: sec.rawDataSize,
          };
          break;
        }
      }

      // Enrich each entry with the shared annotation data
      for (const entry of disasmEntries) {
        entry.imageBase = imageBase;
        entry.sections = sections;
        entry.imports = importMap;
        entry.exports = exportMap;
        entry.strings = stringMap;
        if (!entry.codeSection)
          entry.codeSection = codeSection;
      }
    }

    return { categories, images, byteRegions, disassembly: disasmEntries.length > 0 ? disasmEntries : null };
  }

  // =========================================================================
  // ELF parser — sections, dynamic linking, interpreter, compiler detection
  // =========================================================================

  function parseELF(bytes) {
    const categories = [];
    const fields = [];
    const byteRegions = [];
    if (bytes.length < 52) return { categories: [{ name: 'ELF Header', icon: 'exe', fields }], images: [], byteRegions: [] };

    // ELF header regions
    byteRegions.push({ offset: 0, length: 4, label: 'ELF Magic', color: 0 });
    byteRegions.push({ offset: 4, length: 12, label: 'ELF Ident', color: 1 });
    byteRegions.push({ offset: 16, length: bytes[4] === 2 ? 48 : 36, label: 'ELF Header Fields', color: 2 });

    const elfClass = readU8(bytes, 4);
    const elfData = readU8(bytes, 5);
    const osabi = readU8(bytes, 7);
    const le = elfData === 1;
    const is64 = elfClass === 2;
    const readU16 = le ? readU16LE : readU16BE;
    const readU32 = le ? readU32LE : readU32BE;
    const readUPtr = is64 ? (le ? readU64LE : readU64BE) : readU32;

    fields.push({ key: 'elf.class', label: 'Class', value: is64 ? '64-bit' : '32-bit' });
    fields.push({ key: 'elf.endian', label: 'Byte Order', value: le ? 'Little-endian' : 'Big-endian' });

    const osabiNames = { 0: 'UNIX System V', 3: 'Linux', 6: 'Solaris', 9: 'FreeBSD', 12: 'OpenBSD' };
    fields.push({ key: 'elf.osabi', label: 'OS/ABI', value: osabiNames[osabi] || String(osabi) });

    const eType = readU16(bytes, 16);
    const typeNames = { 1: 'Relocatable', 2: 'Executable', 3: 'Shared Object', 4: 'Core Dump' };
    fields.push({ key: 'elf.type', label: 'Object Type', value: typeNames[eType] || String(eType) });

    const eMachine = readU16(bytes, 18);
    const machineNames = {
      0x03: 'x86', 0x3E: 'x86-64', 0x28: 'ARM', 0xB7: 'AArch64',
      0xF3: 'RISC-V', 0x08: 'MIPS', 0x14: 'PowerPC', 0x15: 'PowerPC64', 0x2B: 'SPARC V9',
    };
    fields.push({ key: 'elf.machine', label: 'Architecture', value: machineNames[eMachine] || '0x' + eMachine.toString(16) });

    const entryPoint = is64 ? readUPtr(bytes, 24) : readU32(bytes, 24);
    fields.push({ key: 'elf.entry', label: 'Entry Point', value: '0x' + entryPoint.toString(16).toUpperCase() });

    // Header offsets differ for 32/64-bit
    const phOff = is64 ? readUPtr(bytes, 32) : readU32(bytes, 28);
    const shOff = is64 ? readUPtr(bytes, 40) : readU32(bytes, 32);
    const phEntSize = is64 ? readU16(bytes, 54) : readU16(bytes, 42);
    const phNum = is64 ? readU16(bytes, 56) : readU16(bytes, 44);
    const shEntSize = is64 ? readU16(bytes, 58) : readU16(bytes, 46);
    const shNum = is64 ? readU16(bytes, 60) : readU16(bytes, 48);
    const shStrIdx = is64 ? readU16(bytes, 62) : readU16(bytes, 50);

    fields.push({ key: 'elf.phnum', label: 'Program Headers', value: String(phNum) });
    fields.push({ key: 'elf.shnum', label: 'Section Headers', value: String(shNum) });

    // ---- Section header string table ----
    let shStrTab = null;
    if (shStrIdx < shNum && shOff > 0) {
      const ssBase = shOff + shStrIdx * shEntSize;
      if (is64 && ssBase + 64 <= bytes.length) {
        const ssOff = readUPtr(bytes, ssBase + 24);
        const ssSize = readUPtr(bytes, ssBase + 32);
        shStrTab = { offset: ssOff, size: ssSize };
      } else if (!is64 && ssBase + 40 <= bytes.length) {
        const ssOff = readU32(bytes, ssBase + 16);
        const ssSize = readU32(bytes, ssBase + 20);
        shStrTab = { offset: ssOff, size: ssSize };
      }
    }

    function readSectionName(nameIdx) {
      if (!shStrTab || nameIdx === 0) return '';
      return readString(bytes, shStrTab.offset + nameIdx, 256);
    }

    // ---- Walk sections ----
    const sectionFields = [];
    const sectionNames = [];
    if (shOff > 0 && shNum > 0) {
      for (let i = 0; i < shNum && i < 50; ++i) {
        const sb = shOff + i * shEntSize;
        if (is64 ? sb + 64 > bytes.length : sb + 40 > bytes.length) break;
        const nameIdx = readU32(bytes, sb);
        const shType = readU32(bytes, sb + 4);
        const shSize = is64 ? readUPtr(bytes, sb + 32) : readU32(bytes, sb + 20);
        const name = readSectionName(nameIdx);
        if (!name || name === '') continue;
        sectionNames.push(name);

        const typeNames = { 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 5: 'HASH',
          6: 'DYNAMIC', 7: 'NOTE', 8: 'NOBITS', 9: 'REL', 11: 'DYNSYM' };
        const typeName = typeNames[shType] || '0x' + shType.toString(16);
        sectionFields.push({ key: 'elf.sec.' + i, label: name, value: formatSize(shSize) + ' (' + typeName + ')' });
      }
    }

    if (sectionFields.length > 0)
      categories.push({ name: 'Sections (' + sectionFields.length + ')', icon: 'list', fields: sectionFields });

    // ---- Program headers — find PT_INTERP and PT_DYNAMIC ----
    let interpreter = null;
    let dynamicOffset = 0, dynamicSize = 0;
    if (phOff > 0 && phNum > 0) {
      for (let i = 0; i < phNum; ++i) {
        const pb = phOff + i * phEntSize;
        if (is64 ? pb + 56 > bytes.length : pb + 32 > bytes.length) break;
        const pType = readU32(bytes, pb);

        if (pType === 3) { // PT_INTERP
          const pOff = is64 ? readUPtr(bytes, pb + 8) : readU32(bytes, pb + 4);
          const pSize = is64 ? readUPtr(bytes, pb + 32) : readU32(bytes, pb + 16);
          interpreter = readString(bytes, pOff, pSize);
        }
        if (pType === 2) { // PT_DYNAMIC
          dynamicOffset = is64 ? readUPtr(bytes, pb + 8) : readU32(bytes, pb + 4);
          dynamicSize = is64 ? readUPtr(bytes, pb + 32) : readU32(bytes, pb + 16);
        }
      }
    }

    if (interpreter)
      fields.push({ key: 'elf.interp', label: 'Interpreter', value: interpreter });

    // ---- Dynamic section — linked libraries (DT_NEEDED) ----
    if (dynamicOffset > 0 && dynamicSize > 0) {
      // Find .dynstr string table
      let dynStrOff = 0, dynStrSize = 0;
      if (shOff > 0) {
        for (let i = 0; i < shNum; ++i) {
          const sb = shOff + i * shEntSize;
          if (is64 ? sb + 64 > bytes.length : sb + 40 > bytes.length) break;
          const shType = readU32(bytes, sb + 4);
          const name = readSectionName(readU32(bytes, sb));
          if (shType === 3 && name === '.dynstr') {
            dynStrOff = is64 ? readUPtr(bytes, sb + 24) : readU32(bytes, sb + 16);
            dynStrSize = is64 ? readUPtr(bytes, sb + 32) : readU32(bytes, sb + 20);
            break;
          }
        }
      }

      if (dynStrOff > 0) {
        const libFields = [];
        const entSize = is64 ? 16 : 8;
        let pos = dynamicOffset;
        while (pos + entSize <= bytes.length && libFields.length < 50) {
          const tag = is64 ? readUPtr(bytes, pos) : readU32(bytes, pos);
          const val = is64 ? readUPtr(bytes, pos + 8) : readU32(bytes, pos + 4);
          if (tag === 0) break; // DT_NULL
          if (tag === 1) { // DT_NEEDED
            const libName = readString(bytes, dynStrOff + val, 256);
            if (libName)
              libFields.push({ key: 'elf.lib.' + libFields.length, label: libName, value: 'Shared library' });
          }
          pos += entSize;
        }
        if (libFields.length > 0)
          categories.push({ name: 'Linked Libraries (' + libFields.length + ')', icon: 'link', fields: libFields });
      }
    }

    // ---- Compiler / runtime heuristics ----
    const compilerHints = [];
    if (sectionNames.includes('.go.buildinfo') || sectionNames.includes('.gopclntab'))
      compilerHints.push('Go');
    else if (sectionNames.includes('.rustc'))
      compilerHints.push('Rust (rustc)');
    else if (interpreter && interpreter.includes('ld-musl'))
      compilerHints.push('C/C++ (musl libc)');
    else if (interpreter && interpreter.includes('ld-linux'))
      compilerHints.push('C/C++ (glibc)');

    // Scan for compiler identification strings
    const scanLen = Math.min(bytes.length, 65536);
    const scanStr = readString(bytes, 0, scanLen);
    if (scanStr.includes('GCC:'))
      compilerHints.push('GCC');
    else if (scanStr.includes('clang version'))
      compilerHints.push('Clang/LLVM');

    if (compilerHints.length > 0)
      categories.push({ name: 'Compiler / Runtime', icon: 'exe', fields: [
        { key: 'elf.compiler', label: 'Detected Compiler', value: compilerHints.join(', ') }
      ]});

    // Disassembly info
    const elfArchMap = { 0x03: 'x86', 0x3E: 'x64', 0x28: 'arm', 0xB7: 'arm64', 0x14: 'ppc', 0x15: 'ppc' };
    const disasmArch = elfArchMap[eMachine] || null;
    // ELF entry point is a virtual address; approximate file offset by searching sections
    let epFileOffset = 0;

    // Build full section info array for annotations
    const elfSections = [];
    if (shOff > 0 && shNum > 0) {
      for (let i = 0; i < shNum && i < 50; ++i) {
        const sb = shOff + i * shEntSize;
        if (is64 ? sb + 64 > bytes.length : sb + 40 > bytes.length) break;
        const nameIdx = readU32(bytes, sb);
        const shType = readU32(bytes, sb + 4);
        const shFlags = is64 ? readUPtr(bytes, sb + 8) : readU32(bytes, sb + 8);
        const shAddr = is64 ? readUPtr(bytes, sb + 16) : readU32(bytes, sb + 12);
        const shFileOff = is64 ? readUPtr(bytes, sb + 24) : readU32(bytes, sb + 16);
        const shSz = is64 ? readUPtr(bytes, sb + 32) : readU32(bytes, sb + 20);
        const name = readSectionName(nameIdx);
        elfSections.push({ name, type: shType, flags: shFlags, virtualAddress: shAddr, rawDataOffset: shFileOff, rawDataSize: shSz });

        if (entryPoint > 0 && entryPoint >= shAddr && entryPoint < shAddr + shSz && epFileOffset === 0)
          epFileOffset = entryPoint - shAddr + shFileOff;
      }
    }

    let disasmInfo = null;
    if (disasmArch && epFileOffset > 0) {
      // Symbol table extraction (.dynsym + .dynstr, .symtab + .strtab)
      const symbolMap = Object.create(null);
      const SHT_SYMTAB = 2, SHT_DYNSYM = 11;
      for (const sec of elfSections) {
        if (sec.type !== SHT_SYMTAB && sec.type !== SHT_DYNSYM) continue;
        // Find associated string table (next section or by link field)
        const strSecName = sec.type === SHT_DYNSYM ? '.dynstr' : '.strtab';
        const strSec = elfSections.find(s => s.name === strSecName);
        if (!strSec) continue;
        const symEntSize = is64 ? 24 : 16;
        const symOff = sec.rawDataOffset;
        const symEnd = Math.min(symOff + sec.rawDataSize, bytes.length);
        for (let sp = symOff; sp + symEntSize <= symEnd; sp += symEntSize) {
          const stName = readU32(bytes, sp);
          let stValue, stInfo;
          if (is64) {
            stInfo = readU8(bytes, sp + 4);
            stValue = readUPtr(bytes, sp + 8);
          } else {
            stValue = readU32(bytes, sp + 4);
            stInfo = readU8(bytes, sp + 12);
          }
          const symType = stInfo & 0xF;
          if (stValue === 0 || stName === 0) continue;
          if (symType !== 1 && symType !== 2) continue; // STT_OBJECT=1, STT_FUNC=2
          const symName = readString(bytes, strSec.rawDataOffset + stName, 256);
          if (symName)
            symbolMap[stValue] = symName;
        }
      }

      // String extraction from .rodata, .data sections
      const elfStringMap = Object.create(null);
      for (const sec of elfSections) {
        if (sec.name !== '.rodata' && sec.name !== '.data') continue;
        const base = sec.rawDataOffset;
        const end = Math.min(base + sec.rawDataSize, bytes.length);
        let strStart = -1;
        for (let j = base; j < end; ++j) {
          const b = bytes[j];
          if (b >= 0x20 && b < 0x7F) {
            if (strStart < 0) strStart = j;
          } else {
            if (b === 0 && strStart >= 0 && j - strStart >= 4) {
              const va = sec.virtualAddress + (strStart - base);
              elfStringMap[va] = readString(bytes, strStart, Math.min(j - strStart, 120));
            }
            strStart = -1;
          }
        }
      }

      // Find .text section for code boundaries
      let codeSection = null;
      for (const sec of elfSections) {
        // SHF_EXECINSTR = 0x4, SHF_ALLOC = 0x2
        if (sec.name === '.text' || ((sec.flags & 0x4) && (sec.flags & 0x2) && sec.type === 1)) {
          codeSection = {
            start: sec.rawDataOffset,
            end: sec.rawDataOffset + sec.rawDataSize,
            rva: sec.virtualAddress,
            size: sec.rawDataSize,
          };
          break;
        }
      }

      disasmInfo = {
        archId: disasmArch, offset: epFileOffset, rva: entryPoint,
        imageBase: 0, sections: elfSections, imports: Object.create(null),
        exports: symbolMap, strings: elfStringMap, codeSection,
      };
    }

    categories.unshift({ name: 'ELF Header', icon: 'exe', fields });
    return { categories, images: [], byteRegions, disassembly: disasmInfo ? [disasmInfo] : null };
  }

  // =========================================================================
  // Mach-O parser — load commands, linked libraries, compiler detection
  // =========================================================================

  function parseMachO(bytes) {
    const categories = [];
    const fields = [];
    if (bytes.length < 28) return { categories: [{ name: 'Mach-O Header', icon: 'exe', fields }], images: [] };

    const magic = readU32BE(bytes, 0);
    const reversed = magic === 0xCEFAEDFE || magic === 0xCFFAEDFE;
    const is64 = magic === 0xFEEDFACF || magic === 0xCFFAEDFE;
    const readU32M = reversed ? readU32LE : readU32BE;

    fields.push({ key: 'macho.bits', label: 'Format', value: is64 ? '64-bit' : '32-bit' });

    const cpuType = readU32M(bytes, 4);
    const cpuSubtype = readU32M(bytes, 8);
    const fileType = readU32M(bytes, 12);
    const ncmds = readU32M(bytes, 16);
    const sizeOfCmds = readU32M(bytes, 20);
    const flags = readU32M(bytes, 24);

    const cpuNames = { 7: 'x86', 12: 'ARM', 0x01000007: 'x86-64', 0x0100000C: 'ARM64' };
    fields.push({ key: 'macho.cpu', label: 'CPU Type', value: cpuNames[cpuType] || '0x' + cpuType.toString(16) });

    const fileTypeNames = { 1: 'Object', 2: 'Executable', 3: 'Fixed VM Shared Library', 4: 'Core', 5: 'Preloaded', 6: 'Dylib', 7: 'Dylinker', 8: 'Bundle' };
    fields.push({ key: 'macho.fileType', label: 'File Type', value: fileTypeNames[fileType] || String(fileType) });
    fields.push({ key: 'macho.loadCmds', label: 'Load Commands', value: String(ncmds) });

    const mflagNames = [];
    if (flags & 0x01) mflagNames.push('No Undefs');
    if (flags & 0x04) mflagNames.push('Dyldlink');
    if (flags & 0x80) mflagNames.push('Two-Level');
    if (flags & 0x200000) mflagNames.push('PIE');
    if (mflagNames.length > 0)
      fields.push({ key: 'macho.flags', label: 'Flags', value: mflagNames.join(', ') });

    // Walk load commands
    const headerSize = is64 ? 32 : 28;
    let pos = headerSize;
    const libFields = [];
    let minVersion = null;
    let sourceVersion = null;
    let uuid = null;
    const segmentFields = [];

    for (let i = 0; i < ncmds && pos + 8 <= bytes.length; ++i) {
      const cmd = readU32M(bytes, pos);
      const cmdSize = readU32M(bytes, pos + 4);
      if (cmdSize < 8 || pos + cmdSize > bytes.length) break;

      // LC_SEGMENT / LC_SEGMENT_64
      if (cmd === 0x01 || cmd === 0x19) {
        const segName = readString(bytes, pos + 8, 16);
        const segSize = cmd === 0x19 ? readU64LE(bytes, pos + 48) : readU32M(bytes, pos + 36);
        if (segName)
          segmentFields.push({ key: 'macho.seg.' + segmentFields.length, label: segName, value: formatSize(segSize) });
      }

      // LC_LOAD_DYLIB (0x0C), LC_LOAD_WEAK_DYLIB (0x80000018), LC_REEXPORT_DYLIB (0x1F)
      if (cmd === 0x0C || cmd === 0x80000018 || cmd === 0x1F) {
        const nameOffset = readU32M(bytes, pos + 8);
        const libName = readString(bytes, pos + nameOffset, cmdSize - nameOffset);
        const kind = cmd === 0x0C ? 'Dynamic Library' : cmd === 0x80000018 ? 'Weak Library' : 'Re-export';
        if (libName)
          libFields.push({ key: 'macho.lib.' + libFields.length, label: libName, value: kind });
      }

      // LC_VERSION_MIN_MACOSX (0x24) / LC_BUILD_VERSION (0x32)
      if (cmd === 0x24 && pos + 12 <= bytes.length) {
        const ver = readU32M(bytes, pos + 8);
        minVersion = ((ver >> 16) & 0xFF) + '.' + ((ver >> 8) & 0xFF) + '.' + (ver & 0xFF);
      }
      if (cmd === 0x32 && pos + 16 <= bytes.length) {
        const platform = readU32M(bytes, pos + 8);
        const minos = readU32M(bytes, pos + 12);
        const platNames = { 1: 'macOS', 2: 'iOS', 3: 'tvOS', 4: 'watchOS', 5: 'bridgeOS', 6: 'Mac Catalyst', 7: 'iOS Simulator' };
        const ver = ((minos >> 16) & 0xFFFF) + '.' + ((minos >> 8) & 0xFF) + '.' + (minos & 0xFF);
        minVersion = (platNames[platform] || 'Platform ' + platform) + ' ' + ver;
      }

      // LC_SOURCE_VERSION (0x2A)
      if (cmd === 0x2A && pos + 16 <= bytes.length) {
        const sv = readU64LE(bytes, pos + 8);
        sourceVersion = String(sv);
      }

      // LC_UUID (0x1B)
      if (cmd === 0x1B && pos + 24 <= bytes.length) {
        uuid = bytesToHex(bytes, pos + 8, 16).replace(/ /g, '');
        uuid = uuid.substring(0, 8) + '-' + uuid.substring(8, 12) + '-' + uuid.substring(12, 16) + '-' + uuid.substring(16, 20) + '-' + uuid.substring(20);
      }

      pos += cmdSize;
    }

    if (minVersion) fields.push({ key: 'macho.minVer', label: 'Minimum Version', value: minVersion });
    if (uuid) fields.push({ key: 'macho.uuid', label: 'UUID', value: uuid });

    categories.push({ name: 'Mach-O Header', icon: 'exe', fields });

    if (segmentFields.length > 0)
      categories.push({ name: 'Segments (' + segmentFields.length + ')', icon: 'list', fields: segmentFields });

    if (libFields.length > 0)
      categories.push({ name: 'Linked Libraries (' + libFields.length + ')', icon: 'link', fields: libFields });

    // Compiler heuristics
    const compilerHints = [];
    const libNamesJoined = libFields.map(f => f.label).join(' ');
    if (libNamesJoined.includes('libswiftCore'))
      compilerHints.push('Swift');
    else if (libNamesJoined.includes('libobjc'))
      compilerHints.push('Objective-C');
    const scanStr = readString(bytes, 0, Math.min(bytes.length, 65536));
    if (scanStr.includes('clang version') || scanStr.includes('Apple clang'))
      compilerHints.push('Apple Clang/LLVM');
    else if (scanStr.includes('rustc'))
      compilerHints.push('Rust (rustc)');

    if (compilerHints.length > 0)
      categories.push({ name: 'Compiler / Runtime', icon: 'exe', fields: [
        { key: 'macho.compiler', label: 'Detected Compiler', value: compilerHints.join(', ') }
      ]});

    // Disassembly info
    const machoArchMap = { 7: 'x86', 12: 'arm', 0x01000007: 'x64', 0x0100000C: 'arm64' };
    const disasmArch = machoArchMap[cpuType] || null;

    return { categories, images: [], disassembly: disasmArch ? [{ archId: disasmArch, offset: 0, rva: 0 }] : null };
  }

  // =========================================================================
  // Java .class parser
  // =========================================================================

  function parseJavaClass(bytes) {
    const fields = [];
    if (bytes.length < 10) return { categories: [{ name: 'Java Class', icon: 'exe', fields }], images: [] };

    const minor = readU16BE(bytes, 4);
    const major = readU16BE(bytes, 6);
    const javaVersionMap = {
      45: '1.1', 46: '1.2', 47: '1.3', 48: '1.4', 49: '5', 50: '6', 51: '7', 52: '8',
      53: '9', 54: '10', 55: '11', 56: '12', 57: '13', 58: '14', 59: '15', 60: '16',
      61: '17', 62: '18', 63: '19', 64: '20', 65: '21', 66: '22', 67: '23', 68: '24',
    };

    fields.push({ key: 'class.version', label: 'Class File Version', value: major + '.' + minor });
    fields.push({ key: 'class.java', label: 'Java Version', value: 'Java ' + (javaVersionMap[major] || '?') });

    const cpCount = readU16BE(bytes, 8);
    fields.push({ key: 'class.cpCount', label: 'Constant Pool Entries', value: String(cpCount - 1) });

    // Walk constant pool to find class name
    let cpOffset = 10;
    const cpEntries = [null]; // 1-indexed
    for (let i = 1; i < cpCount && cpOffset < bytes.length; ++i) {
      const tag = readU8(bytes, cpOffset);
      cpEntries[i] = { tag, offset: cpOffset };
      ++cpOffset;
      switch (tag) {
        case 1: { const len = readU16BE(bytes, cpOffset); cpEntries[i].value = readUTF8(bytes, cpOffset + 2, len); cpOffset += 2 + len; break; }
        case 3: case 4: cpOffset += 4; break;
        case 5: case 6: cpOffset += 8; ++i; cpEntries.push(null); break;
        case 7: case 8: case 16: case 19: case 20: cpOffset += 2; break;
        case 9: case 10: case 11: case 12: case 17: case 18: cpOffset += 4; break;
        case 15: cpOffset += 3; break;
        default: cpOffset = bytes.length; break;
      }
    }

    if (cpOffset + 6 <= bytes.length) {
      const accessFlags = readU16BE(bytes, cpOffset);
      const thisClassIdx = readU16BE(bytes, cpOffset + 2);
      const superClassIdx = readU16BE(bytes, cpOffset + 4);

      function resolveClassName(idx) {
        if (!cpEntries[idx] || cpEntries[idx].tag !== 7) return '?';
        const nameIdx = readU16BE(bytes, cpEntries[idx].offset + 1);
        if (!cpEntries[nameIdx] || cpEntries[nameIdx].tag !== 1) return '?';
        return cpEntries[nameIdx].value.replace(/\//g, '.');
      }

      const className = resolveClassName(thisClassIdx);
      const superName = resolveClassName(superClassIdx);
      if (className !== '?') fields.push({ key: 'class.name', label: 'Class Name', value: className });
      if (superName !== '?' && superName !== 'java.lang.Object') fields.push({ key: 'class.super', label: 'Superclass', value: superName });

      const flagNames = [];
      if (accessFlags & 0x0001) flagNames.push('public');
      if (accessFlags & 0x0010) flagNames.push('final');
      if (accessFlags & 0x0200) flagNames.push('interface');
      if (accessFlags & 0x0400) flagNames.push('abstract');
      if (accessFlags & 0x1000) flagNames.push('synthetic');
      if (accessFlags & 0x2000) flagNames.push('annotation');
      if (accessFlags & 0x4000) flagNames.push('enum');
      if (flagNames.length > 0) fields.push({ key: 'class.flags', label: 'Access Flags', value: flagNames.join(', ') });
    }

    // Find first method's Code attribute for disassembly
    let disassembly = null;
    if (cpOffset + 6 <= bytes.length) {
      let pos = cpOffset + 6; // after access_flags, this_class, super_class
      // Skip interfaces
      if (pos + 2 <= bytes.length) {
        const ifCount = readU16BE(bytes, pos); pos += 2;
        pos += ifCount * 2;
      }
      // Skip fields
      if (pos + 2 <= bytes.length) {
        const fieldCount = readU16BE(bytes, pos); pos += 2;
        for (let fi = 0; fi < fieldCount && pos + 8 <= bytes.length; ++fi) {
          pos += 6; // access_flags, name_index, descriptor_index
          const attrCount = readU16BE(bytes, pos); pos += 2;
          for (let ai = 0; ai < attrCount && pos + 6 <= bytes.length; ++ai) {
            pos += 2; // attribute_name_index
            const attrLen = readU32BE(bytes, pos); pos += 4;
            pos += attrLen;
          }
        }
      }
      // Walk methods to find first Code attribute
      if (pos + 2 <= bytes.length) {
        const methodCount = readU16BE(bytes, pos); pos += 2;
        for (let mi = 0; mi < methodCount && pos + 8 <= bytes.length && !disassembly; ++mi) {
          pos += 6; // access_flags, name_index, descriptor_index
          const attrCount = readU16BE(bytes, pos); pos += 2;
          for (let ai = 0; ai < attrCount && pos + 6 <= bytes.length; ++ai) {
            const attrNameIdx = readU16BE(bytes, pos); pos += 2;
            const attrLen = readU32BE(bytes, pos); pos += 4;
            const attrName = (cpEntries[attrNameIdx] && cpEntries[attrNameIdx].tag === 1) ? cpEntries[attrNameIdx].value : '';
            if (attrName === 'Code' && attrLen >= 12 && !disassembly) {
              // Code attribute: max_stack(2) + max_locals(2) + code_length(4) + code[code_length] + ...
              const codeLen = readU32BE(bytes, pos + 4);
              const codeStart = pos + 8;
              if (codeStart + codeLen <= bytes.length && codeLen > 0)
                disassembly = { archId: 'java', offset: codeStart, options: { constantPool: cpEntries } };
            }
            pos += attrLen;
          }
        }
      }
    }

    return { categories: [{ name: 'Java Class', icon: 'exe', fields }], images: [], disassembly: disassembly ? [disassembly] : null };
  }

  // =========================================================================
  // Microsoft PDB (Program Database) parser
  // =========================================================================

  function parsePDB(bytes) {
    const fields = [];
    // "Microsoft C/C++ MSF 7.00\r\n\x1ADS\0\0\0" — 32-byte signature
    const sigStr = readString(bytes, 0, 32);
    fields.push({ key: 'pdb.signature', label: 'Signature', value: sigStr.replace(/[\x00-\x1F]/g, '') });

    if (bytes.length >= 36) {
      const pageSize = readU32LE(bytes, 32);
      fields.push({ key: 'pdb.pageSize', label: 'Page Size', value: formatSize(pageSize) });

      if (bytes.length >= 40) {
        const freePageMap = readU32LE(bytes, 36);
        fields.push({ key: 'pdb.freePageMap', label: 'Free Page Map', value: String(freePageMap) });
      }
      if (bytes.length >= 44) {
        const totalPages = readU32LE(bytes, 40);
        fields.push({ key: 'pdb.totalPages', label: 'Total Pages', value: String(totalPages) });
        if (pageSize > 0)
          fields.push({ key: 'pdb.estSize', label: 'Estimated Data Size', value: formatSize(totalPages * pageSize) });
      }
      if (bytes.length >= 48) {
        const rootStreamSize = readU32LE(bytes, 44);
        fields.push({ key: 'pdb.rootSize', label: 'Root Stream Size', value: formatSize(rootStreamSize) });
      }
    }

    return { categories: [{ name: 'PDB Header', icon: 'info', fields }], images: [] };
  }

  // =========================================================================
  // MetaTrader EX4/EX5 parser
  // =========================================================================

  function parseEX4(bytes) {
    const fields = [];
    // EX4/EX5 format is proprietary; extract what limited header info we can
    if (bytes.length >= 4) {
      const ver = readU32LE(bytes, 0);
      fields.push({ key: 'ex4.headerWord', label: 'Header Word', value: '0x' + ver.toString(16).toUpperCase() });
    }
    fields.push({ key: 'ex4.size', label: 'File Size', value: formatSize(bytes.length) });

    // Try to find copyright or comment strings in the first 4KB
    const scanLen = Math.min(bytes.length, 4096);
    let copyrightFound = false;
    for (let i = 0; i < scanLen - 10; ++i) {
      // Look for "Copyright" or "copyright" ASCII
      if ((bytes[i] === 0x43 || bytes[i] === 0x63) && readString(bytes, i, 9).toLowerCase() === 'copyright') {
        const s = readString(bytes, i, 256);
        fields.push({ key: 'ex4.copyright', label: 'Copyright', value: s });
        copyrightFound = true;
        break;
      }
    }
    if (!copyrightFound)
      fields.push({ key: 'ex4.note', label: 'Note', value: 'Proprietary format — limited metadata available' });

    return { categories: [{ name: 'MetaTrader EA', icon: 'exe', fields }], images: [] };
  }

  // =========================================================================
  // Android DEX (Dalvik Executable) parser
  // =========================================================================

  function parseDEX(bytes) {
    const categories = [];
    const fields = [];
    if (bytes.length < 112) return { categories: [{ name: 'DEX Header', icon: 'exe', fields }], images: [] };

    // DEX header (112 bytes)
    const magic = readString(bytes, 0, 8);
    fields.push({ key: 'dex.magic', label: 'Magic', value: magic.replace(/[\x00-\x1F]/g, '') });

    const checksum = readU32LE(bytes, 8);
    fields.push({ key: 'dex.checksum', label: 'Checksum', value: '0x' + checksum.toString(16).toUpperCase() });

    // SHA-1 signature at offset 12, 20 bytes
    let sha1 = '';
    for (let i = 0; i < 20; ++i) sha1 += bytes[12 + i].toString(16).padStart(2, '0');
    fields.push({ key: 'dex.sha1', label: 'SHA-1', value: sha1.toUpperCase() });

    const fileSize = readU32LE(bytes, 32);
    fields.push({ key: 'dex.fileSize', label: 'File Size', value: formatSize(fileSize) });

    const headerSize = readU32LE(bytes, 36);
    const endianTag = readU32LE(bytes, 40);
    fields.push({ key: 'dex.endian', label: 'Endian', value: endianTag === 0x12345678 ? 'Little-endian' : 'Big-endian' });

    const stringIdsSize = readU32LE(bytes, 56);
    const stringIdsOff = readU32LE(bytes, 60);
    const typeIdsSize = readU32LE(bytes, 64);
    const typeIdsOff = readU32LE(bytes, 68);
    const protoIdsSize = readU32LE(bytes, 72);
    const protoIdsOff = readU32LE(bytes, 76);
    const fieldIdsSize = readU32LE(bytes, 80);
    const fieldIdsOff = readU32LE(bytes, 84);
    const methodIdsSize = readU32LE(bytes, 88);
    const methodIdsOff = readU32LE(bytes, 92);
    const classDefsSize = readU32LE(bytes, 96);
    const classDefsOff = readU32LE(bytes, 100);

    fields.push({ key: 'dex.strings', label: 'String IDs', value: String(stringIdsSize) });
    fields.push({ key: 'dex.types', label: 'Type IDs', value: String(typeIdsSize) });
    fields.push({ key: 'dex.protos', label: 'Proto IDs', value: String(protoIdsSize) });
    fields.push({ key: 'dex.fields', label: 'Field IDs', value: String(fieldIdsSize) });
    fields.push({ key: 'dex.methods', label: 'Method IDs', value: String(methodIdsSize) });
    fields.push({ key: 'dex.classes', label: 'Class Defs', value: String(classDefsSize) });

    categories.push({ name: 'DEX Header', icon: 'exe', fields });

    // Read string table
    const strings = [];
    for (let i = 0; i < Math.min(stringIdsSize, 10000) && stringIdsOff + (i + 1) * 4 <= bytes.length; ++i) {
      const dataOff = readU32LE(bytes, stringIdsOff + i * 4);
      if (dataOff >= bytes.length) { strings.push(''); continue; }
      const r = readULEB128(bytes, dataOff);
      const strLen = r.value;
      const strStart = dataOff + r.bytesRead;
      strings.push(readMUTF8(bytes, strStart, Math.min(strLen + 1, 256)));
    }

    // Read type table
    const types = [];
    for (let i = 0; i < Math.min(typeIdsSize, 10000) && typeIdsOff + (i + 1) * 4 <= bytes.length; ++i) {
      const descIdx = readU32LE(bytes, typeIdsOff + i * 4);
      types.push(descIdx < strings.length ? strings[descIdx] : '?');
    }

    // Read method table
    const methods = [];
    for (let i = 0; i < Math.min(methodIdsSize, 10000) && methodIdsOff + (i + 1) * 8 <= bytes.length; ++i) {
      const classIdx = readU16LE(bytes, methodIdsOff + i * 8);
      const nameIdx = readU32LE(bytes, methodIdsOff + i * 8 + 4);
      const className = classIdx < types.length ? types[classIdx] : '?';
      const methodName = nameIdx < strings.length ? strings[nameIdx] : '?';
      methods.push(className.replace(/^L|;$/g, '').replace(/\//g, '.') + '.' + methodName);
    }

    // Read field table
    const dexFields = [];
    for (let i = 0; i < Math.min(fieldIdsSize, 10000) && fieldIdsOff + (i + 1) * 8 <= bytes.length; ++i) {
      const classIdx = readU16LE(bytes, fieldIdsOff + i * 8);
      const nameIdx = readU32LE(bytes, fieldIdsOff + i * 8 + 4);
      const className = classIdx < types.length ? types[classIdx] : '?';
      const fieldName = nameIdx < strings.length ? strings[nameIdx] : '?';
      dexFields.push(className.replace(/^L|;$/g, '').replace(/\//g, '.') + '.' + fieldName);
    }

    // Read class defs
    const classFields = [];
    let firstCodeOff = 0;
    for (let i = 0; i < Math.min(classDefsSize, 200) && classDefsOff + (i + 1) * 32 <= bytes.length; ++i) {
      const co = classDefsOff + i * 32;
      const classTypeIdx = readU32LE(bytes, co);
      const accessFlags = readU32LE(bytes, co + 4);
      const superIdx = readU32LE(bytes, co + 8);
      const classDataOff = readU32LE(bytes, co + 24);

      const className = classTypeIdx < types.length ? types[classTypeIdx].replace(/^L|;$/g, '').replace(/\//g, '.') : '?';
      const superName = superIdx !== 0xFFFFFFFF && superIdx < types.length ? types[superIdx].replace(/^L|;$/g, '').replace(/\//g, '.') : '';

      const flags = [];
      if (accessFlags & 0x0001) flags.push('public');
      if (accessFlags & 0x0010) flags.push('final');
      if (accessFlags & 0x0200) flags.push('interface');
      if (accessFlags & 0x0400) flags.push('abstract');
      if (accessFlags & 0x4000) flags.push('enum');

      const desc = (flags.length ? flags.join(' ') + ' ' : '') + className + (superName && superName !== 'java.lang.Object' ? ' extends ' + superName : '');
      classFields.push({ key: 'dex.class.' + i, label: className.split('.').pop(), value: desc });

      // Find first code item for disassembly
      if (firstCodeOff === 0 && classDataOff > 0 && classDataOff < bytes.length) {
        let p = classDataOff;
        const sfCount = readULEB128(bytes, p); p += sfCount.bytesRead;
        const ifCount = readULEB128(bytes, p); p += ifCount.bytesRead;
        const dmCount = readULEB128(bytes, p); p += dmCount.bytesRead;
        const vmCount = readULEB128(bytes, p); p += vmCount.bytesRead;
        // Skip static fields
        for (let j = 0; j < sfCount.value && p < bytes.length; ++j) {
          const r1 = readULEB128(bytes, p); p += r1.bytesRead;
          const r2 = readULEB128(bytes, p); p += r2.bytesRead;
        }
        // Skip instance fields
        for (let j = 0; j < ifCount.value && p < bytes.length; ++j) {
          const r1 = readULEB128(bytes, p); p += r1.bytesRead;
          const r2 = readULEB128(bytes, p); p += r2.bytesRead;
        }
        // First direct method
        for (let j = 0; j < dmCount.value && p < bytes.length; ++j) {
          const r1 = readULEB128(bytes, p); p += r1.bytesRead;
          const r2 = readULEB128(bytes, p); p += r2.bytesRead;
          const codeOff = readULEB128(bytes, p); p += codeOff.bytesRead;
          if (codeOff.value > 0 && firstCodeOff === 0)
            firstCodeOff = codeOff.value;
          break;
        }
      }
    }

    if (classFields.length > 0)
      categories.push({ name: 'Classes (' + classFields.length + ')', icon: 'list', fields: classFields });

    // Code item: registers_size(2) + ins_size(2) + outs_size(2) + tries_size(2) + debug_info_off(4) + insns_size(4) + insns[]
    let disassembly = null;
    if (firstCodeOff > 0 && firstCodeOff + 16 <= bytes.length) {
      const insnsSize = readU32LE(bytes, firstCodeOff + 12); // in 16-bit code units
      const codeStart = firstCodeOff + 16;
      if (codeStart < bytes.length && insnsSize > 0)
        disassembly = { archId: 'dalvik', offset: codeStart, options: { strings, types, methods, fields: dexFields } };
    }

    return { categories, images: [], disassembly: disassembly ? [disassembly] : null };
  }

  // =========================================================================
  // Android OAT parser
  // =========================================================================

  function parseOAT(bytes) {
    const fields = [];
    const version = readString(bytes, 4, 4).replace(/\x00/g, '');
    fields.push({ key: 'oat.version', label: 'OAT Version', value: version });
    if (bytes.length >= 20) {
      const adler32 = readU32LE(bytes, 8);
      fields.push({ key: 'oat.checksum', label: 'Checksum', value: '0x' + adler32.toString(16).toUpperCase() });
      const instrSet = readU32LE(bytes, 12);
      const instrSetNames = { 0: 'None', 1: 'ARM', 2: 'ARM64', 3: 'Thumb2', 4: 'x86', 5: 'x86-64', 6: 'MIPS', 7: 'MIPS64' };
      fields.push({ key: 'oat.instrSet', label: 'Instruction Set', value: instrSetNames[instrSet] || String(instrSet) });
    }
    return { categories: [{ name: 'OAT Header', icon: 'exe', fields }], images: [] };
  }

  // =========================================================================
  // Android VDEX parser
  // =========================================================================

  function parseVDEX(bytes) {
    const fields = [];
    const version = readString(bytes, 4, 4).replace(/\x00/g, '');
    fields.push({ key: 'vdex.version', label: 'VDEX Version', value: version });
    if (bytes.length >= 12) {
      const dexCount = readU32LE(bytes, 8);
      fields.push({ key: 'vdex.dexCount', label: 'DEX File Count', value: String(dexCount) });
    }
    return { categories: [{ name: 'VDEX Header', icon: 'exe', fields }], images: [] };
  }

  // =========================================================================
  // Android ART image parser
  // =========================================================================

  function parseART(bytes) {
    const fields = [];
    const version = readString(bytes, 4, 4).replace(/\x00/g, '');
    fields.push({ key: 'art.version', label: 'ART Version', value: version });
    if (bytes.length >= 24) {
      const imageSize = readU32LE(bytes, 16);
      fields.push({ key: 'art.imageSize', label: 'Image Size', value: formatSize(imageSize) });
    }
    return { categories: [{ name: 'ART Image Header', icon: 'exe', fields }], images: [] };
  }

  // =========================================================================
  // Python compiled bytecode (.pyc) parser
  // =========================================================================

  function parsePYC(bytes) {
    const categories = [];
    const fields = [];
    if (bytes.length < 16) return { categories: [{ name: 'Python Bytecode', icon: 'exe', fields }], images: [] };

    const magic = readU16LE(bytes, 0);

    // Python version from magic number
    const pyVersionMap = {
      3390: '3.6', 3391: '3.6', 3392: '3.6', 3393: '3.6', 3394: '3.7',
      3400: '3.7', 3401: '3.7', 3410: '3.7', 3411: '3.7', 3412: '3.7',
      3413: '3.8', 3420: '3.8', 3421: '3.8', 3422: '3.8', 3423: '3.8',
      3424: '3.8', 3425: '3.9', 3430: '3.9', 3431: '3.9', 3432: '3.9',
      3433: '3.10', 3434: '3.10', 3435: '3.10', 3436: '3.10', 3437: '3.10',
      3438: '3.10', 3439: '3.11', 3450: '3.11', 3451: '3.11', 3452: '3.11',
      3453: '3.11', 3454: '3.11', 3455: '3.11', 3456: '3.11', 3457: '3.11',
      3458: '3.11', 3459: '3.11', 3460: '3.11', 3461: '3.11', 3462: '3.12',
      3470: '3.12', 3471: '3.12', 3472: '3.12', 3473: '3.12', 3474: '3.12',
      3475: '3.12', 3476: '3.12', 3477: '3.12', 3478: '3.12', 3479: '3.12',
      3480: '3.12', 3481: '3.12', 3482: '3.12', 3483: '3.12', 3484: '3.12',
      3485: '3.12', 3486: '3.12', 3487: '3.12', 3488: '3.12', 3489: '3.12',
      3490: '3.12', 3491: '3.12', 3492: '3.12', 3493: '3.12', 3494: '3.12',
      3495: '3.13', 3500: '3.13', 3501: '3.13', 3502: '3.13', 3503: '3.13',
      3504: '3.13', 3505: '3.13', 3506: '3.13', 3507: '3.13', 3508: '3.13',
      3509: '3.13', 3510: '3.13', 3511: '3.13', 3512: '3.13', 3513: '3.13',
      3514: '3.13',
    };

    const pyVersion = pyVersionMap[magic] || '?';
    fields.push({ key: 'pyc.magic', label: 'Magic Number', value: String(magic) });
    fields.push({ key: 'pyc.version', label: 'Python Version', value: 'Python ' + pyVersion });

    // Header size depends on version: 3.7+ has 16-byte header, earlier 12-byte or 8-byte
    let headerSize = 16;
    if (magic < 3394) headerSize = 12;
    if (magic < 3200) headerSize = 8;

    if (headerSize >= 12 && bytes.length >= headerSize) {
      const timestamp = readU32LE(bytes, headerSize === 16 ? 8 : 4);
      if (timestamp > 0)
        fields.push({ key: 'pyc.timestamp', label: 'Timestamp', value: formatTimestamp(timestamp) });
      if (headerSize === 16) {
        const sourceSize = readU32LE(bytes, 12);
        if (sourceSize > 0)
          fields.push({ key: 'pyc.sourceSize', label: 'Source Size', value: formatSize(sourceSize) });
      }
    }

    categories.push({ name: 'Python Bytecode', icon: 'exe', fields });

    // Attempt to find code object in marshal data
    // Marshal format: type byte + data. Code object type = 'c' (0x63)
    // The code object has: co_code (bytecode), co_consts, co_names, co_varnames
    let disassembly = null;
    let pos = headerSize;
    // Simple marshal walk to find first code object
    function findCodeObject(p, depth) {
      if (depth > 10 || p >= bytes.length) return null;
      const type = bytes[p] & 0x7F; // strip FLAG_REF bit
      ++p;
      if (type === 0x63) { // TYPE_CODE 'c'
        // Code object: argcount(4) + posonlyargcount(4 if 3.8+) + kwonlyargcount(4) + nlocals(4) + stacksize(4) + flags(4)
        // + code(string) + consts(tuple) + names(tuple) + varnames(tuple) ...
        let skip = 20; // 5 x u32 for 3.6/3.7
        if (magic >= 3413) skip = 24; // 6 x u32 for 3.8+ (posonlyargcount added)
        if (p + skip >= bytes.length) return null;
        p += skip;

        // co_code: marshal string - type byte 's' (0x73) or 'z' (short string)
        const codeType = bytes[p] & 0x7F; ++p;
        let codeLen = 0;
        if (codeType === 0x73) { // TYPE_STRING
          codeLen = readU32LE(bytes, p); p += 4;
        } else if (codeType === 0x7A) { // TYPE_SHORT_ASCII
          codeLen = bytes[p]; ++p;
        } else if (codeType === 0x5A) { // TYPE_SHORT_ASCII_INTERNED
          codeLen = bytes[p]; ++p;
        } else return null;

        const codeStart = p;
        if (codeLen > 0 && codeStart + codeLen <= bytes.length)
          return { offset: codeStart, length: codeLen, codeP: p + codeLen };
        return null;
      }
      return null;
    }

    const codeObj = findCodeObject(pos, 0);
    if (codeObj)
      disassembly = { archId: 'python', offset: codeObj.offset };

    return { categories, images: [], disassembly: disassembly ? [disassembly] : null };
  }

  // =========================================================================
  // Dart Kernel AST binary parser
  // =========================================================================

  function parseDartKernel(bytes) {
    const fields = [];
    fields.push({ key: 'dart.magic', label: 'Magic', value: '0x' + readU32BE(bytes, 0).toString(16).toUpperCase() });
    if (bytes.length >= 8) {
      const formatVersion = readU32BE(bytes, 4);
      fields.push({ key: 'dart.version', label: 'Format Version', value: String(formatVersion) });
    }
    fields.push({ key: 'dart.size', label: 'File Size', value: formatSize(bytes.length) });
    fields.push({ key: 'dart.note', label: 'Note', value: 'Dart Kernel AST binary — structural summary only' });

    // Attempt to extract library/class names by scanning for ASCII strings
    const libraries = [];
    // Simple heuristic: look for "dart:" or "package:" prefixed strings
    const scanStr = readString(bytes, 0, Math.min(bytes.length, 65536));
    const dartLibRe = /(?:dart|package):[a-zA-Z0-9_./]+/g;
    let match;
    const seen = new Set();
    while ((match = dartLibRe.exec(scanStr)) !== null && libraries.length < 50) {
      if (!seen.has(match[0])) {
        seen.add(match[0]);
        libraries.push({ name: match[0], classes: [] });
      }
    }

    return {
      categories: [{ name: 'Dart Kernel', icon: 'exe', fields }],
      images: [],
      disassembly: libraries.length > 0 ? [{ archId: 'dart', offset: 0, options: { libraries } }] : null
    };
  }

  P._parseJavaClass = parseJavaClass;
  P.registerParsers({ pe: parsePE, elf: parseELF, macho: parseMachO, javaclass: parseJavaClass, pdb: parsePDB, ex4: parseEX4, ex5: parseEX4, dex: parseDEX, dart: parseDartKernel, oat: parseOAT, vdex: parseVDEX, art: parseART, pyc: parsePYC });
})();
