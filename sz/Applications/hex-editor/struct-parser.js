;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const HexEditor = SZ.StructEngine || (SZ.StructEngine = {});

  // -----------------------------------------------------------------------
  // C type map
  // -----------------------------------------------------------------------
  const C_TYPE_MAP = {
    'uint8_t': 'uint8', 'int8_t': 'int8',
    'uint16_t': 'uint16', 'int16_t': 'int16',
    'uint32_t': 'uint32', 'int32_t': 'int32',
    'uint64_t': 'uint64', 'int64_t': 'int64',
    'unsigned char': 'uint8', 'signed char': 'int8', 'char': 'char',
    'unsigned short': 'uint16', 'short': 'int16',
    'unsigned int': 'uint32', 'int': 'int32',
    'unsigned long': 'uint32', 'long': 'int32',
    'unsigned long long': 'uint64', 'long long': 'uint64',
    'float': 'float32', 'double': 'float64',
    'BYTE': 'uint8', 'UBYTE': 'uint8',
    'WORD': 'uint16', 'DWORD': 'uint32',
    'USHORT': 'uint16', 'SHORT': 'int16',
    'UINT': 'uint32', 'INT': 'int32',
    'ULONG': 'uint32', 'LONG': 'int32',
    'ULONGLONG': 'uint64', 'LONGLONG': 'int64',
    'BOOL': 'uint32', 'BOOLEAN': 'uint8',
    'CHAR': 'char', 'UCHAR': 'uint8', 'WCHAR': 'uint16',
    'FLOAT': 'float32', 'DOUBLE': 'float64',
    'size_t': 'uint32', 'ssize_t': 'int32',
    'GUID': 'guid', 'UUID': 'guid',
    'FILETIME': 'filetime',
    'COLORREF': 'bgra32',
    'FOURCC': 'fourcc',
  };

  // -----------------------------------------------------------------------
  // C# type map
  // -----------------------------------------------------------------------
  const CS_TYPE_MAP = {
    'byte': 'uint8', 'sbyte': 'int8',
    'short': 'int16', 'ushort': 'uint16',
    'int': 'int32', 'uint': 'uint32',
    'long': 'int64', 'ulong': 'uint64',
    'float': 'float32', 'double': 'float64',
    'bool': 'uint8', 'char': 'uint16',
    'Int16': 'int16', 'UInt16': 'uint16',
    'Int32': 'int32', 'UInt32': 'uint32',
    'Int64': 'int64', 'UInt64': 'uint64',
    'Single': 'float32', 'Double': 'float64',
    'Byte': 'uint8', 'SByte': 'int8',
    'Boolean': 'uint8', 'Char': 'uint16',
    'Guid': 'guid',
    'DateTime': 'dotnet_ticks',
    'TimeSpan': 'int64',
  };

  // -----------------------------------------------------------------------
  // Strip C/C++ comments
  // -----------------------------------------------------------------------
  function stripComments(src) {
    return src
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // -----------------------------------------------------------------------
  // Parse C header
  // -----------------------------------------------------------------------
  function parseCHeader(source, endian) {
    endian = endian || 'le';
    const clean = stripComments(source);
    const results = [];

    // Match: typedef struct { ... } Name;  OR  struct Name { ... };
    // Also:  typedef union { ... } Name;   OR  union Name { ... };
    const pattern = /(?:typedef\s+)?(struct|union)\s*(\w*)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*(\w*)\s*;/g;
    let m;
    while ((m = pattern.exec(clean)) !== null) {
      const kind = m[1]; // 'struct' or 'union'
      const nameInline = m[2] ? m[2].trim() : '';
      const body = m[3];
      const nameTypedef = m[4] ? m[4].trim() : '';
      const name = nameTypedef || nameInline || 'Anonymous';
      const fields = _parseCFields(body, endian);

      results.push({
        label: name,
        endian,
        fields: kind === 'union' ? [{ name, type: 'union', children: fields }] : fields,
      });
    }

    return results;
  }

  function _parseCFields(body, endian) {
    const fields = [];
    const lines = body.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (const line of lines) {
      // Nested struct/union: (struct|union) { ... } name
      const nestedMatch = line.match(/^(struct|union)\s*\{([\s\S]*)\}\s*(\w+)(?:\[(\d+)\])?$/);
      if (nestedMatch) {
        const kind = nestedMatch[1];
        const nestedBody = nestedMatch[2];
        const fname = nestedMatch[3];
        const count = nestedMatch[4] ? parseInt(nestedMatch[4], 10) : undefined;
        const children = _parseCFields(nestedBody, endian);
        const field = { name: fname, type: kind, children };
        if (count)
          field.count = count;
        fields.push(field);
        continue;
      }

      // Bitfield: type name : bits
      const bitMatch = line.match(/^(.+?)\s+(\w+)\s*:\s*(\d+)$/);
      if (bitMatch) {
        const cType = bitMatch[1].trim();
        const fname = bitMatch[2];
        const bits = parseInt(bitMatch[3], 10);
        const mapped = C_TYPE_MAP[cType];
        if (mapped)
          fields.push({ name: fname, type: mapped, bitSize: bits, display: 'dec' });
        continue;
      }

      // Array: type name[N]
      const arrMatch = line.match(/^(.+?)\s+(\w+)\[(\d+)\]$/);
      if (arrMatch) {
        const cType = arrMatch[1].trim();
        const fname = arrMatch[2];
        const count = parseInt(arrMatch[3], 10);
        if (cType === 'char')
          fields.push({ name: fname, type: 'char[' + count + ']', display: 'string' });
        else {
          const mapped = C_TYPE_MAP[cType];
          if (mapped)
            fields.push({ name: fname, type: mapped, count, display: 'hex' });
        }
        continue;
      }

      // Simple: type name
      const simpleMatch = line.match(/^(.+?)\s+(\w+)$/);
      if (simpleMatch) {
        const cType = simpleMatch[1].trim();
        const fname = simpleMatch[2];
        const mapped = C_TYPE_MAP[cType];
        if (mapped)
          fields.push({ name: fname, type: mapped, display: 'dec' });
        continue;
      }
    }

    return fields;
  }

  // -----------------------------------------------------------------------
  // Parse C# struct
  // -----------------------------------------------------------------------
  function parseCSharpStruct(source, endian) {
    endian = endian || 'le';
    const clean = stripComments(source);
    const results = [];

    // Match structs with optional [StructLayout(...)]
    const pattern = /(?:\[StructLayout\([^\)]*\)\]\s*)?(?:public\s+|internal\s+|private\s+)?(?:unsafe\s+)?struct\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let m;
    while ((m = pattern.exec(clean)) !== null) {
      const name = m[1];
      const body = m[2];

      // Check for Explicit layout
      const layoutMatch = clean.substring(Math.max(0, m.index - 200), m.index).match(/StructLayout\s*\(\s*LayoutKind\.Explicit\s*\)/);
      const isExplicit = !!layoutMatch;

      const fields = _parseCSharpFields(body, endian, isExplicit);
      results.push({ label: name, endian, fields });
    }

    return results;
  }

  function _parseCSharpFields(body, endian, isExplicit) {
    const fields = [];
    const lines = body.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (const line of lines) {
      // Check for [FieldOffset(N)] attribute
      let fieldOffset = null;
      let cleanLine = line;
      const offsetMatch = line.match(/\[FieldOffset\((\d+)\)\]\s*/);
      if (offsetMatch) {
        fieldOffset = parseInt(offsetMatch[1], 10);
        cleanLine = line.substring(offsetMatch[0].length).trim();
      }

      // Strip other attributes
      cleanLine = cleanLine.replace(/\[\w+[^\]]*\]\s*/g, '').trim();

      // Fixed array: public fixed type name[N]
      const fixedMatch = cleanLine.match(/(?:public|private|internal)?\s*fixed\s+(\w+)\s+(\w+)\[(\d+)\]/);
      if (fixedMatch) {
        const csType = fixedMatch[1];
        const fname = fixedMatch[2];
        const count = parseInt(fixedMatch[3], 10);
        const mapped = CS_TYPE_MAP[csType];
        if (mapped) {
          const field = { name: fname, type: mapped, count, display: 'hex' };
          if (fieldOffset != null)
            field.offset = fieldOffset;
          fields.push(field);
        }
        continue;
      }

      // Simple field: public type name
      const simpleMatch = cleanLine.match(/(?:public|private|internal)?\s*(\w+)\s+(\w+)$/);
      if (simpleMatch) {
        const csType = simpleMatch[1];
        const fname = simpleMatch[2];
        const mapped = CS_TYPE_MAP[csType];
        if (mapped) {
          const field = { name: fname, type: mapped, display: 'dec' };
          if (fieldOffset != null)
            field.offset = fieldOffset;
          fields.push(field);
        }
        continue;
      }
    }

    return fields;
  }

  // -----------------------------------------------------------------------
  // Exports
  // -----------------------------------------------------------------------
  HexEditor.parseCHeader = parseCHeader;
  HexEditor.parseCSharpStruct = parseCSharpStruct;

})();
