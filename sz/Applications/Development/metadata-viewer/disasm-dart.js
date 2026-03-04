;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Dart Kernel (.dill) AST Summary Disassembler
  //
  // Dart Kernel binaries encode an AST rather than bytecode, so this
  // disassembler produces a structural listing of libraries, classes,
  // and methods rather than individual bytecode instructions.
  // =========================================================================

  function makeEntry(mnemonic, operands, pseudoC) {
    return {
      offset: 0,
      length: 0,
      bytes: new Uint8Array(0),
      mnemonic,
      operands: operands || '',
      pseudoC: pseudoC || '',
    };
  }

  function decode(bytes, offset, maxCount, opts) {
    const limit = maxCount || 256;
    const instructions = [];

    if (opts && opts.libraries && opts.libraries.length) {
      for (const lib of opts.libraries) {
        if (instructions.length >= limit)
          break;

        const libName = lib.name || lib.uri || '(unnamed)';
        instructions.push(makeEntry('library', libName, 'library ' + libName));

        if (lib.classes) {
          for (const cls of lib.classes) {
            if (instructions.length >= limit)
              break;

            const extendsStr = cls.superClass ? ' extends ' + cls.superClass : '';
            instructions.push(makeEntry(
              'class',
              cls.name + extendsStr,
              'class ' + cls.name + extendsStr
            ));

            if (cls.fields) {
              for (const f of cls.fields) {
                if (instructions.length >= limit)
                  break;
                const typeStr = f.type ? ': ' + f.type : '';
                instructions.push(makeEntry(
                  'field',
                  f.name + typeStr,
                  (f.isStatic ? 'static ' : '') + f.name + typeStr
                ));
              }
            }

            if (cls.methods) {
              for (const m of cls.methods) {
                if (instructions.length >= limit)
                  break;
                const params = m.params || '';
                const retStr = m.returnType ? ' -> ' + m.returnType : '';
                instructions.push(makeEntry(
                  'method',
                  m.name + '(' + params + ')' + retStr,
                  (m.isStatic ? 'static ' : '') + m.name + '(' + params + ')' + retStr
                ));
              }
            }

            if (cls.constructors) {
              for (const c of cls.constructors) {
                if (instructions.length >= limit)
                  break;
                const cName = c.name || '(default)';
                const cParams = c.params || '';
                instructions.push(makeEntry(
                  'constructor',
                  cls.name + '.' + cName + '(' + cParams + ')',
                  'new ' + cls.name + '.' + cName + '(' + cParams + ')'
                ));
              }
            }
          }
        }

        if (lib.procedures) {
          for (const proc of lib.procedures) {
            if (instructions.length >= limit)
              break;
            const params = proc.params || '';
            const retStr = proc.returnType ? ' -> ' + proc.returnType : '';
            instructions.push(makeEntry(
              'procedure',
              proc.name + '(' + params + ')' + retStr,
              proc.name + '(' + params + ')' + retStr
            ));
          }
        }

        if (lib.typedefs) {
          for (const td of lib.typedefs) {
            if (instructions.length >= limit)
              break;
            instructions.push(makeEntry(
              'typedef',
              td.name + (td.type ? ' = ' + td.type : ''),
              'typedef ' + td.name
            ));
          }
        }
      }
    }

    if (instructions.length === 0)
      instructions.push(makeEntry(
        '.info',
        'Dart Kernel binary (AST summary only)',
        '/* No structural information available */'
      ));

    return instructions.slice(0, limit);
  }

  // =========================================================================
  // Register
  // =========================================================================

  D.registerDisassembler('dart', decode);

})();
