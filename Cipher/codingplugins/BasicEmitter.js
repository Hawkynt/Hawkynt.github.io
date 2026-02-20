/**
 * BasicEmitter.js - Basic Code Generator from Basic AST
 * Generates properly formatted Basic source code from BasicAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Basic AST -> Basic Emitter -> Basic Source
 */

(function(global) {
  'use strict';

  // Load BasicAST if available
  let BasicAST;
  if (typeof require !== 'undefined') {
    BasicAST = require('./BasicAST.js');
  } else if (global.BasicAST) {
    BasicAST = global.BasicAST;
  }

  /**
   * Basic Code Emitter
   * Generates formatted Basic code from a Basic AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - addComments: boolean - Emit comments. Default: true
   * - variant: string - Basic dialect. Default: 'FREEBASIC'
   * - upperCase: boolean - Use uppercase keywords. Default: false
   */
  // FreeBASIC reserved words that cannot be used as identifiers
  const FREEBASIC_RESERVED_WORDS = new Set([
    // I/O Keywords
    'data', 'input', 'output', 'write', 'read', 'print', 'open', 'close', 'get', 'put',
    'seek', 'loc', 'lof', 'eof', 'lock', 'unlock', 'width', 'name',
    // Control Flow
    'if', 'then', 'else', 'elseif', 'end', 'do', 'loop', 'while', 'wend', 'until',
    'for', 'to', 'step', 'next', 'exit', 'continue', 'goto', 'gosub', 'return',
    'select', 'case', 'with',
    // Data Types
    'type', 'dim', 'redim', 'as', 'const', 'static', 'shared', 'common', 'extern',
    'public', 'private', 'protected', 'integer', 'long', 'short', 'byte', 'ubyte',
    'single', 'double', 'string', 'boolean', 'object', 'variant', 'any', 'ptr',
    'pointer', 'zstring', 'wstring', 'longint', 'ulongint', 'uinteger', 'ulong', 'ushort',
    // Functions/Subs
    'sub', 'function', 'property', 'operator', 'constructor', 'destructor',
    'declare', 'byref', 'byval', 'overload', 'abstract', 'virtual', 'override',
    // Memory
    'new', 'delete', 'allocate', 'deallocate', 'reallocate', 'callocate', 'erase', 'clear',
    // Boolean/Logic
    'and', 'or', 'not', 'xor', 'eqv', 'imp', 'mod', 'shl', 'shr',
    'true', 'false',
    // Classes/OOP
    'class', 'extends', 'implements', 'base', 'this', 'me',
    // Other
    'let', 'set', 'rem', 'option', 'defint', 'deflng', 'defsng', 'defdbl', 'defstr',
    'on', 'error', 'resume', 'err', 'is', 'typeof', 'namespace', 'using', 'import',
    'export', 'include', 'once', 'ifdef', 'ifndef', 'endif', 'define', 'undef', 'macro',
    'endmacro', 'assert', 'scope', 'union', 'enum', 'alias', 'lib', 'cdecl', 'stdcall',
    'pascal', 'naked', 'preserve', 'explicit', 'base', 'field', 'key', 'access',
    'append', 'binary', 'random', 'len', 'event', 'signal', 'wait', 'thread', 'threadcall',
    'mutexcreate', 'mutexlock', 'mutexunlock', 'mutexdestroy', 'condcreate', 'condwait',
    'condsignal', 'condbroadcast', 'conddestroy', 'screenres', 'screenlock', 'screenunlock',
    'screenptr', 'screenset', 'screenlist', 'screencontrol', 'screensync', 'screenevent',
    'screeninfo', 'screenglproc', 'imagecreate', 'imagedestroy', 'imageinfo', 'imageconvertrow',
    'sleep', 'timer', 'date', 'time', 'command', 'environ', 'shell', 'run', 'chain',
    'swap', 'sizeof', 'offsetof', 'va_arg', 'va_first', 'va_next', 'procptr', 'sadd', 'strptr',
    'varptr', 'peek', 'poke', 'cvd', 'cvi', 'cvl', 'cvs', 'cvlongint', 'cvshort',
    'mkd', 'mki', 'mkl', 'mks', 'mklongint', 'mkshort',
    'lbound', 'ubound'
    // Note: count, state, status, result, value, buffer, length, size are NOT reserved in FreeBASIC
  ]);

  class BasicEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
      this.variant = (options.variant || 'FREEBASIC').toUpperCase();
      this.upperCase = options.upperCase || false;
    }

    /**
     * Escape a name if it's a FreeBASIC reserved word
     * Adds underscore suffix to avoid conflicts
     */
    escapeReservedWord(name) {
      if (this.variant !== 'FREEBASIC')
        return name;

      if (FREEBASIC_RESERVED_WORDS.has(name.toLowerCase()))
        return name + '_';

      return name;
    }

    /**
     * Emit Basic code from a Basic AST node
     * @param {BasicNode} node - The AST node to emit
     * @returns {string} Generated Basic code
     */
    emit(node) {
      if (!node) return '';

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `' Unknown node type: ${node.nodeType}${this.newline}`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    /**
     * Format keyword with proper casing
     */
    kw(keyword) {
      return this.upperCase ? keyword.toUpperCase() : keyword;
    }

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // Module comment
      if (node.moduleComment && this.options.addComments !== false) {
        code += this.emit(node.moduleComment);
        code += this.newline;
      }

      // Imports
      for (const imp of node.imports) {
        code += this.emit(imp);
      }
      if (node.imports.length > 0) {
        code += this.newline;
      }

      // Add FreeBASIC helper functions (OpCodes equivalents)
      if (this.variant === 'FREEBASIC' && this.options.includeHelpers !== false) {
        code += this.emitFreeBASICHelpers();
        code += this.newline;
      }

      // Module-level attributes
      for (const attr of node.attributes) {
        code += this.emit(attr);
      }
      if (node.attributes.length > 0) {
        code += this.newline;
      }

      // Type declarations
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      // Module-level declarations
      for (const decl of node.declarations) {
        code += this.emit(decl);
        code += this.newline;
      }

      // Functions/Subs
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      return code;
    }

    /**
     * Generate FreeBASIC helper functions for OpCodes operations
     */
    emitFreeBASICHelpers() {
      let code = '';
      code += this.line("' OpCodes helper functions");
      code += this.newline;

      // BitMask function
      code += this.line("Private Function BitMask(bits As Long) As ULongInt");
      this.indentLevel++;
      code += this.line("If bits >= 64 Then Return &HFFFFFFFFFFFFFFFF");
      code += this.line("Return (1ULL Shl bits) - 1");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Pack16BE - pack 2 bytes to 16-bit big-endian
      code += this.line("Private Function Pack16BE(b0 As UByte, b1 As UByte) As UShort");
      this.indentLevel++;
      code += this.line("Return (Cast(UShort, b0) Shl 8) Or b1");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Pack16LE - pack 2 bytes to 16-bit little-endian
      code += this.line("Private Function Pack16LE(b0 As UByte, b1 As UByte) As UShort");
      this.indentLevel++;
      code += this.line("Return b0 Or (Cast(UShort, b1) Shl 8)");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Pack32BE - pack 4 bytes to 32-bit big-endian
      code += this.line("Private Function Pack32BE(b0 As UByte, b1 As UByte, b2 As UByte, b3 As UByte) As ULong");
      this.indentLevel++;
      code += this.line("Return (Cast(ULong, b0) Shl 24) Or (Cast(ULong, b1) Shl 16) Or (Cast(ULong, b2) Shl 8) Or b3");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Pack32LE - pack 4 bytes to 32-bit little-endian
      code += this.line("Private Function Pack32LE(b0 As UByte, b1 As UByte, b2 As UByte, b3 As UByte) As ULong");
      this.indentLevel++;
      code += this.line("Return b0 Or (Cast(ULong, b1) Shl 8) Or (Cast(ULong, b2) Shl 16) Or (Cast(ULong, b3) Shl 24)");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Unpack16BE - unpack 16-bit big-endian, returns byte at given index
      code += this.line("Private Function Unpack16BE(value As UShort, index_ As Long = 0) As UByte");
      this.indentLevel++;
      code += this.line("Select Case index_");
      this.indentLevel++;
      code += this.line("Case 0: Return (value Shr 8) And &HFF");
      code += this.line("Case Else: Return value And &HFF");
      this.indentLevel--;
      code += this.line("End Select");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Unpack16LE - unpack 16-bit little-endian, returns byte at given index
      code += this.line("Private Function Unpack16LE(value As UShort, index_ As Long = 0) As UByte");
      this.indentLevel++;
      code += this.line("Select Case index_");
      this.indentLevel++;
      code += this.line("Case 0: Return value And &HFF");
      code += this.line("Case Else: Return (value Shr 8) And &HFF");
      this.indentLevel--;
      code += this.line("End Select");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Unpack32BE - unpack 32-bit big-endian, returns byte at given index
      code += this.line("Private Function Unpack32BE(value As ULong, index_ As Long = 0) As UByte");
      this.indentLevel++;
      code += this.line("Select Case index_");
      this.indentLevel++;
      code += this.line("Case 0: Return (value Shr 24) And &HFF");
      code += this.line("Case 1: Return (value Shr 16) And &HFF");
      code += this.line("Case 2: Return (value Shr 8) And &HFF");
      code += this.line("Case Else: Return value And &HFF");
      this.indentLevel--;
      code += this.line("End Select");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Unpack32LE - unpack 32-bit little-endian, returns byte at given index
      code += this.line("Private Function Unpack32LE(value As ULong, index_ As Long = 0) As UByte");
      this.indentLevel++;
      code += this.line("Select Case index_");
      this.indentLevel++;
      code += this.line("Case 0: Return value And &HFF");
      code += this.line("Case 1: Return (value Shr 8) And &HFF");
      code += this.line("Case 2: Return (value Shr 16) And &HFF");
      code += this.line("Case Else: Return (value Shr 24) And &HFF");
      this.indentLevel--;
      code += this.line("End Select");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // RotL32 - 32-bit left rotation
      code += this.line("Private Function RotL32(value As ULong, amount As Long) As ULong");
      this.indentLevel++;
      code += this.line("amount = amount And 31");
      code += this.line("Return ((value Shl amount) Or (value Shr (32 - amount))) And &HFFFFFFFF");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // RotR32 - 32-bit right rotation
      code += this.line("Private Function RotR32(value As ULong, amount As Long) As ULong");
      this.indentLevel++;
      code += this.line("amount = amount And 31");
      code += this.line("Return ((value Shr amount) Or (value Shl (32 - amount))) And &HFFFFFFFF");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // Hex8ToBytes - convert hex string to byte array
      code += this.line("Private Function Hex8ToBytes(hexStr As String) As UByte Ptr");
      this.indentLevel++;
      code += this.line("Dim length As Long = Len(hexStr) \\ 2");
      code += this.line("Dim result As UByte Ptr = Allocate(length)");
      code += this.line("For i As Long = 0 To length - 1");
      this.indentLevel++;
      code += this.line("result[i] = ValUInt(\"&H\" & Mid(hexStr, i * 2 + 1, 2))");
      this.indentLevel--;
      code += this.line("Next i");
      code += this.line("Return result");
      this.indentLevel--;
      code += this.line("End Function");
      code += this.newline;

      // XorArrays - XOR two byte arrays
      code += this.line("Private Sub XorArrays(arr1() As UByte, arr2() As UByte, result_() As UByte)");
      this.indentLevel++;
      code += this.line("Dim length As Long = UBound(arr1) - LBound(arr1) + 1");
      code += this.line("ReDim result_(0 To length - 1)");
      code += this.line("For i As Long = 0 To length - 1");
      this.indentLevel++;
      code += this.line("result_(i) = arr1(LBound(arr1) + i) Xor arr2(LBound(arr2) + i)");
      this.indentLevel--;
      code += this.line("Next i");
      this.indentLevel--;
      code += this.line("End Sub");
      code += this.newline;

      return code;
    }

    emitImport(node) {
      if (this.variant === 'VBNET') {
        // VB.NET uses Imports
        let code = this.kw('Imports') + ' ' + node.namespace;
        if (node.alias) {
          code += ' ' + this.kw('As') + ' ' + node.alias;
        }
        return this.line(code);
      } else if (this.variant === 'FREEBASIC') {
        // FreeBASIC uses #include
        return this.line(`#include "${node.namespace}.bi"`);
      } else {
        // Other variants may not have imports
        return '';
      }
    }

    emitAttribute(node) {
      if (this.variant === 'VBNET') {
        let code = '<' + node.name;
        if (node.arguments && node.arguments.length > 0) {
          code += '(' + node.arguments.join(', ') + ')';
        }
        code += '>';
        return this.line(code);
      }
      return '';
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitTypeDeclaration(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Type declaration
      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Type') + ' ' + node.name;

      code += this.line(decl);
      this.indentLevel++;

      // FreeBASIC requires at least one field in a Type
      if (!node.fields || node.fields.length === 0) {
        code += this.line('dummy ' + this.kw('As') + ' ' + this.kw('Byte'));
      } else {
        for (const field of node.fields) {
          code += this.emit(field);
        }
      }

      this.indentLevel--;
      code += this.line(this.kw('End Type'));

      return code;
    }

    emitField(node) {
      let code = '';

      if (node.visibility && node.visibility !== 'Public') {
        code += node.visibility + ' ';
      }

      // Handle FreeBASIC-specific array syntax: fieldName(Any) As ElementType
      const typeStr = node.type ? node.type.toString() : 'Any';
      const isArray = node.type?.isArray || typeStr.endsWith('[]') || typeStr.endsWith('()');

      if (this.variant === 'FREEBASIC' && isArray) {
        // Extract element type: 'Byte[]' -> 'Byte', 'Byte()' -> 'Byte'
        let elementType = typeStr;
        if (typeStr.endsWith('[]'))
          elementType = typeStr.slice(0, -2);
        else if (typeStr.endsWith('()'))
          elementType = typeStr.slice(0, -2);

        // Determine array dimensions - check for 2D array patterns
        let dimensions = 1;
        if (node.type?.arrayDimensions?.length > 1)
          dimensions = node.type.arrayDimensions.length;
        else if (node.type?.elementType?.isArray)
          dimensions = 2; // Array of arrays = 2D
        else if (typeStr.endsWith('[][]') || typeStr.endsWith('()()'))
          dimensions = 2;

        // Build (Any, Any, ...) for multi-dimensional arrays
        const anyList = Array(dimensions).fill(this.kw('Any')).join(', ');
        code += node.name + '(' + anyList + ') ' + this.kw('As') + ' ' + this.getFreeBASICType(elementType);
      } else if (this.variant === 'FREEBASIC') {
        code += node.name + ' ' + this.kw('As') + ' ' + this.getFreeBASICType(typeStr);
      } else {
        code += node.name + ' ' + this.kw('As') + ' ' + typeStr;
      }

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return this.line(code);
    }

    emitClass(node) {
      // FreeBASIC uses Type with OOP extensions, not Class
      if (this.variant === 'FREEBASIC') {
        return this.emitFreeBASICClass(node);
      }

      if (this.variant !== 'VBNET' && this.variant !== 'VB6' &&
          this.variant !== 'GAMBAS' && this.variant !== 'XOJO') {
        // Fall back to Type for dialects without OOP
        const typeDecl = {
          nodeType: 'TypeDeclaration',
          name: node.name,
          visibility: node.visibility,
          fields: node.fields,
          docComment: node.docComment
        };
        return this.emitTypeDeclaration(typeDecl);
      }

      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Class') + ' ' + node.name;

      if (node.baseClass) {
        code += this.newline + this.indent() + this.kw('Inherits') + ' ' + node.baseClass;
      }

      if (node.implements && node.implements.length > 0) {
        code += this.newline + this.indent() + this.kw('Implements') + ' ' + node.implements.join(', ');
      }

      code += this.line(decl);
      this.indentLevel++;

      // Fields
      for (const field of node.fields) {
        code += this.emitClassField(field);
      }

      if (node.fields.length > 0 && (node.constructors.length > 0 || node.methods.length > 0)) {
        code += this.newline;
      }

      // Constructors
      for (const ctor of node.constructors) {
        code += this.emit(ctor);
        code += this.newline;
      }

      // Properties
      for (const prop of node.properties) {
        code += this.emit(prop);
        code += this.newline;
      }

      // Methods
      for (const method of node.methods) {
        code += this.emit(method);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line(this.kw('End Class'));

      return code;
    }

    /**
     * Emit FreeBASIC-style class using Type with OOP extensions
     * FreeBASIC syntax:
     * Type ClassName Extends BaseClass
     *     Dim field As Type
     *     Declare Constructor()
     *     Declare Sub Method()
     * End Type
     */
    emitFreeBASICClass(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Type declaration with optional Extends
      let decl = this.kw('Type') + ' ' + node.name;
      if (node.baseClass) {
        decl += ' ' + this.kw('Extends') + ' ' + node.baseClass;
      }
      code += this.line(decl);
      this.indentLevel++;

      // Fields
      for (const field of (node.fields || [])) {
        code += this.emitFreeBASICField(field);
      }

      if ((node.fields || []).length > 0 && ((node.constructors || []).length > 0 || (node.methods || []).length > 0)) {
        code += this.newline;
      }

      // Constructor declarations
      for (const ctor of (node.constructors || [])) {
        code += this.emitFreeBASICConstructorDecl(ctor);
      }

      // Method declarations
      for (const method of (node.methods || [])) {
        code += this.emitFreeBASICMethodDecl(method);
      }

      this.indentLevel--;
      code += this.line(this.kw('End Type'));
      code += this.newline;

      // Constructor implementations
      for (const ctor of (node.constructors || [])) {
        code += this.emitFreeBASICConstructorImpl(node.name, ctor);
      }

      // Method implementations
      for (const method of (node.methods || [])) {
        code += this.emitFreeBASICMethodImpl(node.name, method);
      }

      return code;
    }

    emitFreeBASICField(node) {
      // FreeBASIC: Fields inside Type don't use Dim, just: fieldName As Type
      // For dynamic arrays: fieldName(Any) As ElementType
      const typeStr = this.getFreeBASICType(node.type);
      let code;
      if (typeStr.endsWith('()')) {
        // Array type: use fieldName(Any) As ElementType for dynamic arrays
        const elementType = typeStr.slice(0, -2);
        code = node.name + '(' + this.kw('Any') + ') ' + this.kw('As') + ' ' + elementType;
      } else if (typeStr.endsWith(' Ptr')) {
        // Pointer type, might represent dynamic array
        code = node.name + ' ' + this.kw('As') + ' ' + typeStr;
      } else {
        code = node.name + ' ' + this.kw('As') + ' ' + typeStr;
      }
      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }
      return this.line(code);
    }

    emitFreeBASICConstructorDecl(node) {
      const params = (node.parameters || []).map(p =>
        p.name + ' ' + this.kw('As') + ' ' + this.getFreeBASICType(p.type)
      ).join(', ');
      return this.line(this.kw('Declare Constructor') + '(' + params + ')');
    }

    emitFreeBASICMethodDecl(node) {
      const params = (node.parameters || []).map(p =>
        p.name + ' ' + this.kw('As') + ' ' + this.getFreeBASICType(p.type)
      ).join(', ');
      const returnType = node.returnType ? ' ' + this.kw('As') + ' ' + this.getFreeBASICType(node.returnType) : '';
      const keyword = node.returnType ? this.kw('Declare Function') : this.kw('Declare Sub');
      return this.line(keyword + ' ' + node.name + '(' + params + ')' + returnType);
    }

    emitFreeBASICConstructorImpl(className, node) {
      let code = '';
      const params = (node.parameters || []).map(p =>
        p.name + ' ' + this.kw('As') + ' ' + this.getFreeBASICType(p.type)
      ).join(', ');
      code += this.line(this.kw('Constructor') + ' ' + className + '(' + params + ')');
      this.indentLevel++;
      if (node.body) {
        code += this.emitBlock(node.body);
      }
      this.indentLevel--;
      code += this.line(this.kw('End Constructor'));
      code += this.newline;
      return code;
    }

    emitFreeBASICMethodImpl(className, node) {
      let code = '';
      const params = (node.parameters || []).map(p =>
        p.name + ' ' + this.kw('As') + ' ' + this.getFreeBASICType(p.type)
      ).join(', ');
      const returnType = node.returnType ? ' ' + this.kw('As') + ' ' + this.getFreeBASICType(node.returnType) : '';
      const keyword = node.returnType ? this.kw('Function') : this.kw('Sub');
      const endKeyword = node.returnType ? this.kw('End Function') : this.kw('End Sub');
      code += this.line(keyword + ' ' + className + '.' + node.name + '(' + params + ')' + returnType);
      this.indentLevel++;
      if (node.body) {
        code += this.emitBlock(node.body);
      }
      this.indentLevel--;
      code += this.line(endKeyword);
      code += this.newline;
      return code;
    }

    getFreeBASICType(type) {
      if (!type) return 'Any';
      const typeStr = type.toString ? type.toString() : String(type);

      // Handle array types - returns ElementType() which will be handled by field emitter
      if (typeStr.endsWith('[]')) {
        const elementType = typeStr.slice(0, -2);
        return this.getFreeBASICType(elementType) + '()';
      }
      if (typeStr.endsWith('Array')) {
        const elementType = typeStr.slice(0, -5);
        return this.getFreeBASICType(elementType) + '()';
      }

      const typeMap = {
        'int': 'Integer',
        'integer': 'Integer',
        'long': 'Long',
        'byte': 'UByte',
        'ubyte': 'UByte',
        'short': 'Short',
        'ushort': 'UShort',
        'uint': 'UInteger',
        'ulong': 'ULong',
        'single': 'Single',
        'float': 'Single',
        'double': 'Double',
        'string': 'String',
        'boolean': 'Boolean',
        'bool': 'Boolean',
        'object': 'Any',
        'any': 'Any',
        'void': 'Any',
        'uint32': 'ULong',
        'uint8': 'UByte',
        'dword': 'ULong',
        'number': 'Long'
      };
      return typeMap[typeStr.toLowerCase()] || typeStr;
    }

    emitClassField(node) {
      let code = node.visibility === 'Public' ? this.kw('Public') + ' ' : this.kw('Private') + ' ';
      code += node.name + ' ' + this.kw('As') + ' ' + node.type.toString();

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return this.line(code);
    }

    emitProperty(node) {
      let code = '';

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Property') + ' ' + node.name + '() ' + this.kw('As') + ' ' + node.type.toString();

      code += this.line(decl);
      this.indentLevel++;

      if (node.getter) {
        code += this.line(this.kw('Get'));
        this.indentLevel++;
        code += this.emitBlockContents(node.getter);
        this.indentLevel--;
        code += this.line(this.kw('End Get'));
      }

      if (node.setter) {
        code += this.line(this.kw('Set') + '(' + this.kw('value') + ' ' + this.kw('As') + ' ' + node.type.toString() + ')');
        this.indentLevel++;
        code += this.emitBlockContents(node.setter);
        this.indentLevel--;
        code += this.line(this.kw('End Set'));
      }

      this.indentLevel--;
      code += this.line(this.kw('End Property'));

      return code;
    }

    emitConstructor(node) {
      let code = '';

      let decl = node.visibility === 'Public' ? this.kw('Public') + ' ' : '';
      decl += this.kw('Sub') + ' ' + this.kw('New') + '(';

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      code += this.line(decl);

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line(this.kw('End Sub'));

      return code;
    }

    // ========================[ FUNCTIONS ]========================

    emitFunction(node) {
      let code = '';

      if (node.docComment && this.options.addComments !== false) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = '';
      if (node.visibility) decl += node.visibility + ' ';
      if (node.isShared) decl += this.kw('Shared') + ' ';

      decl += node.isSub ? this.kw('Sub') : this.kw('Function');
      decl += ' ' + node.name + '(';

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += params.join(', ');
      decl += ')';

      if (!node.isSub && node.returnType) {
        decl += ' ' + this.kw('As') + ' ' + node.returnType.toString();
      }

      code += this.line(decl);

      if (node.body) {
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
      }

      code += this.line(node.isSub ? this.kw('End Sub') : this.kw('End Function'));

      return code;
    }

    emitParameterDecl(node) {
      let decl = '';

      if (node.isByRef) {
        decl += this.kw('ByRef') + ' ';
      } else if (this.variant === 'VBNET' || this.variant === 'VB6') {
        decl += this.kw('ByVal') + ' ';
      }

      if (node.isOptional) {
        decl += this.kw('Optional') + ' ';
      }

      if (node.isParamArray) {
        decl += this.kw('ParamArray') + ' ';
      }

      // In FreeBASIC, array parameters use: ByRef name() As ElementType
      // Not: name As ElementType()
      const typeStr = node.type ? node.type.toString() : '';
      const isArray = node.type?.isArray || typeStr.endsWith('[]') || typeStr.endsWith('()');

      // Escape reserved words in parameter names
      const paramName = this.escapeReservedWord(node.name);

      if (this.variant === 'FREEBASIC' && isArray) {
        // Extract element type: 'Byte[]' -> 'Byte', 'Byte()' -> 'Byte'
        let elementType = typeStr;
        if (typeStr.endsWith('[]'))
          elementType = typeStr.slice(0, -2);
        else if (typeStr.endsWith('()'))
          elementType = typeStr.slice(0, -2);
        // FreeBASIC: arrays are passed by reference by default, no need for ByRef
        decl += paramName + '() ' + this.kw('As') + ' ' + this.getFreeBASICType(elementType);
      } else {
        decl += paramName;
        if (node.type) {
          decl += ' ' + this.kw('As') + ' ' + (this.variant === 'FREEBASIC' ? this.getFreeBASICType(typeStr) : typeStr);
        }
      }

      if (node.defaultValue) {
        decl += ' = ' + this.emit(node.defaultValue);
      }

      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      return this.emitBlockContents(node);
    }

    emitBlockContents(node) {
      let code = '';

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      return code;
    }

    emitDim(node) {
      let code = '';

      // Check if type is array (FreeBASIC doesn't support Const arrays)
      const typeStr = node.type ? node.type.toString() : '';
      const isArray = node.type?.isArray || typeStr.endsWith('[]') || typeStr.endsWith('()');

      // In FreeBASIC, Const can only be used with compile-time constant values
      // Check if the initializer is a simple literal
      const isConstantExpr = node.initializer &&
        node.initializer.nodeType === 'Literal' &&
        ['int', 'float', 'string', 'boolean', 'hex'].includes(node.initializer.literalType);

      if (node.isConst && !isArray && this.variant === 'FREEBASIC' && !isConstantExpr) {
        // Not a constant expression in FreeBASIC - use Dim instead
        code += this.kw('Dim') + ' ';
      } else if (node.isConst && !isArray) {
        code += this.kw('Const') + ' ';
      } else if (node.isConst && isArray) {
        // Arrays can't be Const in FreeBASIC, use Dim Shared
        code += this.kw('Dim') + ' ' + this.kw('Shared') + ' ';
      } else if (node.isStatic) {
        code += this.kw('Static') + ' ';
      } else {
        code += this.kw('Dim') + ' ';
      }

      code += this.escapeReservedWord(node.name);

      if (node.type) {
        // Handle array type syntax for FreeBASIC
        if (this.variant === 'FREEBASIC' && isArray) {
          let elementType = typeStr;
          if (typeStr.endsWith('[]'))
            elementType = typeStr.slice(0, -2);
          else if (typeStr.endsWith('()'))
            elementType = typeStr.slice(0, -2);
          // For initialized arrays, specify size; otherwise use (Any)
          if (node.initializer && node.initializer.nodeType === 'ArrayLiteral') {
            const size = node.initializer.elements?.length || 0;
            code += '(0 ' + this.kw('To') + ' ' + (size - 1) + ')';
          } else {
            code += '(' + this.kw('Any') + ')';
          }
          code += ' ' + this.kw('As') + ' ' + this.getFreeBASICType(elementType);
        } else {
          code += ' ' + this.kw('As') + ' ' + node.type.toString();
        }
      }

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code);
    }

    emitAssignment(node) {
      // FreeBASIC: Handle empty array assignment with Erase
      if (this.variant === 'FREEBASIC' &&
          node.value?.nodeType === 'ArrayLiteral' &&
          (!node.value.elements || node.value.elements.length === 0)) {
        return this.line(this.kw('Erase') + ' ' + this.emit(node.target));
      }

      // FreeBASIC: Handle array literal assignment to member fields or array elements
      // Dynamic array fields can't be assigned directly with array literals
      // Need to ReDim and assign elements individually
      if (this.variant === 'FREEBASIC' &&
          node.value?.nodeType === 'ArrayLiteral' &&
          node.value.elements && node.value.elements.length > 0) {
        const targetType = node.target?.nodeType;
        if (targetType === 'MemberAccess' || targetType === 'Identifier') {
          const target = this.emit(node.target);
          const elements = node.value.elements;
          const lastIndex = elements.length - 1;

          // Check if this is a 2D array (array of arrays)
          const isNestedArray = elements.length > 0 && elements[0]?.nodeType === 'ArrayLiteral';

          if (isNestedArray) {
            // 2D array - ReDim with two dimensions and assign each element
            const innerSize = elements[0].elements?.length || 0;
            let code = '';
            code += this.line(this.kw('ReDim') + ' ' + target + '(0 ' + this.kw('To') + ' ' + lastIndex + ', 0 ' + this.kw('To') + ' ' + (innerSize - 1) + ')');
            for (let i = 0; i < elements.length; ++i) {
              const innerElements = elements[i].elements || [];
              for (let j = 0; j < innerElements.length; ++j) {
                code += this.line(target + '(' + i + ', ' + j + ') = ' + this.emit(innerElements[j]));
              }
            }
            return code;
          } else {
            // 1D array
            let code = '';
            code += this.line(this.kw('ReDim') + ' ' + target + '(0 ' + this.kw('To') + ' ' + lastIndex + ')');
            for (let i = 0; i < elements.length; ++i) {
              code += this.line(target + '(' + i + ') = ' + this.emit(elements[i]));
            }
            return code;
          }
        } else if (targetType === 'IndexAccess') {
          // Assigning array literal to an indexed element (e.g., arr(0) = {1, 2, 3})
          // This is a 2D array scenario - assign each element individually
          const target = this.emit(node.target);
          const elements = node.value.elements;
          let code = '';
          for (let i = 0; i < elements.length; ++i) {
            // Replace the last index with both indices: arr(0) -> arr(0, i)
            const baseTarget = this.emit(node.target.target);
            const baseIndices = node.target.indices.map(idx => this.emit(idx)).join(', ');
            code += this.line(baseTarget + '(' + baseIndices + ', ' + i + ') = ' + this.emit(elements[i]));
          }
          return code;
        }
      }

      let code = this.emit(node.target);

      // FreeBASIC doesn't support compound assignment operators like +=, -=, etc.
      // Convert them to expanded form: x += 1 becomes x = x + 1
      let op = node.operator || '=';
      if (this.variant === 'FREEBASIC' && op.length > 1 && op.endsWith('=')) {
        const baseOp = op.slice(0, -1); // '+=' -> '+', '-=' -> '-'
        code += ' = ' + this.emit(node.target) + ' ' + baseOp + ' ';
      } else {
        code += ' ' + op + ' ';
      }
      code += this.emit(node.value);

      return this.line(code);
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression));
    }

    emitReturn(node) {
      if (node.isExit) {
        return this.line(this.kw('Exit Function'));
      }

      if (node.expression) {
        // Check if returning Nothing/null - use Exit Function instead
        if (node.expression.nodeType === 'Literal' &&
            (node.expression.type === 'nothing' || node.expression.value === null)) {
          return this.line(this.kw('Exit Function'));
        }

        // FreeBASIC: Handle returning array literals
        // Can't return array literals directly - need to create temp array
        if (this.variant === 'FREEBASIC' && node.expression.nodeType === 'ArrayLiteral') {
          const elements = node.expression.elements || [];
          if (elements.length === 0) {
            // Return empty - use Exit Function
            return this.line(this.kw('Exit Function'));
          } else if (elements.length === 1) {
            // Single element - just return that element (simplified)
            return this.line(this.kw('Return') + ' ' + this.emit(elements[0]));
          } else {
            // Multiple elements - create temp array and return it
            let code = '';
            code += this.line(this.kw('Dim') + ' __tempArray(0 ' + this.kw('To') + ' ' + (elements.length - 1) + ') ' + this.kw('As') + ' Long');
            for (let i = 0; i < elements.length; ++i) {
              code += this.line('__tempArray(' + i + ') = ' + this.emit(elements[i]));
            }
            code += this.line(this.kw('Return') + ' __tempArray()');
            return code;
          }
        }

        // FreeBASIC supports 'Return expression' syntax
        if (this.variant === 'FREEBASIC') {
          return this.line(this.kw('Return') + ' ' + this.emit(node.expression));
        }
        // VB.NET also supports Return
        return this.line(this.kw('Return') + ' ' + this.emit(node.expression));
      }

      return this.line(this.kw('Exit Sub'));
    }

    emitIf(node) {
      let code = '';

      code += this.line(this.kw('If') + ' ' + this.emit(node.condition) + ' ' + this.kw('Then'));
      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;

      // ElseIf branches
      for (const elseIf of node.elseIfBranches) {
        code += this.line(this.kw('ElseIf') + ' ' + this.emit(elseIf.condition) + ' ' + this.kw('Then'));
        this.indentLevel++;
        code += this.emitBlockContents(elseIf.body);
        this.indentLevel--;
      }

      // Else branch
      if (node.elseBranch) {
        code += this.line(this.kw('Else'));
        this.indentLevel++;
        code += this.emitBlockContents(node.elseBranch);
        this.indentLevel--;
      }

      code += this.line(this.kw('End If'));

      return code;
    }

    emitFor(node) {
      // FreeBASIC: Declare loop variable inline with 'For i As Integer = ...'
      const loopVar = this.escapeReservedWord(node.variable);
      let code = this.kw('For') + ' ' + loopVar;
      if (this.variant === 'FREEBASIC') {
        // Add type declaration for the loop variable
        const varType = node.variableType ? node.variableType.toString() : 'Long';
        code += ' ' + this.kw('As') + ' ' + this.getFreeBASICType(varType);
      }
      code += ' = ' + this.emit(node.start) + ' ' + this.kw('To') + ' ' + this.emit(node.end);

      if (node.step) {
        code += ' ' + this.kw('Step') + ' ' + this.emit(node.step);
      }

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('Next') + ' ' + loopVar);

      return code;
    }

    emitForEach(node) {
      const loopVar = this.escapeReservedWord(node.variable);
      let code = this.kw('For Each') + ' ' + loopVar + ' ' + this.kw('In') + ' ' + this.emit(node.collection);

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('Next'));

      return code;
    }

    emitWhile(node) {
      let code = '';

      if (node.isDoWhile) {
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop') + ' ' + (node.isUntil ? this.kw('Until') : this.kw('While')) + ' ' + this.emit(node.condition));
      } else {
        code += this.line(this.kw('While') + ' ' + this.emit(node.condition));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Wend'));
      }

      return code;
    }

    emitDoLoop(node) {
      let code = '';

      if (node.testAtTop && node.condition) {
        // Do While/Until...Loop
        code += this.line(this.kw('Do') + ' ' + (node.isWhile ? this.kw('While') : this.kw('Until')) + ' ' + this.emit(node.condition));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop'));
      } else if (node.condition) {
        // Do...Loop While/Until
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop') + ' ' + (node.isWhile ? this.kw('While') : this.kw('Until')) + ' ' + this.emit(node.condition));
      } else {
        // Infinite loop
        code += this.line(this.kw('Do'));
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line(this.kw('Loop'));
      }

      return code;
    }

    emitSelect(node) {
      let code = this.line(this.kw('Select Case') + ' ' + this.emit(node.expression));
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line(this.kw('End Select'));

      return code;
    }

    emitCase(node) {
      let code = '';

      if (node.isElse) {
        code += this.line(this.kw('Case Else'));
      } else {
        const values = node.values.map(v => this.emit(v));
        code += this.line(this.kw('Case') + ' ' + values.join(', '));
      }

      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    emitTry(node) {
      if (this.variant === 'VBNET' || this.variant === 'FREEBASIC' ||
          this.variant === 'VB6' || this.variant === 'GAMBAS' || this.variant === 'XOJO') {
        let code = this.line(this.kw('Try'));
        this.indentLevel++;
        code += this.emitBlockContents(node.tryBlock);
        this.indentLevel--;

        for (const catchClause of node.catchClauses) {
          code += this.emit(catchClause);
        }

        if (node.finallyBlock) {
          code += this.line(this.kw('Finally'));
          this.indentLevel++;
          code += this.emitBlockContents(node.finallyBlock);
          this.indentLevel--;
        }

        code += this.line(this.kw('End Try'));

        return code;
      } else {
        // Fall back to On Error for legacy dialects
        let code = this.line(this.kw('On Error Resume Next'));
        code += this.emitBlockContents(node.tryBlock);
        return code;
      }
    }

    emitCatch(node) {
      let code = this.kw('Catch');

      if (node.variableName) {
        code += ' ' + node.variableName;
      }

      if (node.exceptionType) {
        code += ' ' + this.kw('As') + ' ' + node.exceptionType;
      }

      code = this.line(code);
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;

      return code;
    }

    emitExit(node) {
      const exitMap = {
        'For': this.kw('Exit For'),
        'Do': this.kw('Exit Do'),
        'While': this.kw('Exit While'),
        'Sub': this.kw('Exit Sub'),
        'Function': this.kw('Exit Function')
      };

      return this.line(exitMap[node.exitType] || this.kw('Exit'));
    }

    emitContinue(node) {
      // Basic doesn't have continue in most dialects
      // Use comment as placeholder
      return this.line(`' Continue ${node.continueType}`);
    }

    emitThrow(node) {
      if (this.variant === 'VBNET' || this.variant === 'FREEBASIC') {
        return this.line(this.kw('Throw') + ' ' + this.emit(node.exception));
      } else {
        // Use Err.Raise for older dialects
        return this.line(this.kw('Err.Raise') + ' ' + this.emit(node.exception));
      }
    }

    emitOnError(node) {
      let code = this.kw('On Error');

      if (node.mode === 'Resume Next') {
        code += ' ' + this.kw('Resume Next');
      } else if (node.mode === 'GoTo 0') {
        code += ' ' + this.kw('GoTo') + ' 0';
      } else if (node.mode === 'GoTo' && node.label) {
        code += ' ' + this.kw('GoTo') + ' ' + node.label;
      }

      return this.line(code);
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'boolean') {
        return node.value ? this.kw('True') : this.kw('False');
      }

      if (node.literalType === 'string') {
        const escaped = String(node.value)
          .replace(/"/g, '""'); // Double quotes for escaping
        return `"${escaped}"`;
      }

      if (node.literalType === 'nothing') {
        // FreeBASIC doesn't have Nothing keyword - use 0 for null/nothing
        if (this.variant === 'FREEBASIC')
          return '0';
        return this.kw('Nothing');
      }

      if (node.literalType === 'hex') {
        return `&H${node.value.toString(16).toUpperCase()}`;
      }

      // Numeric literal
      let result = String(node.value);

      if (node.suffix) {
        result += node.suffix;
      }

      return result;
    }

    emitIdentifier(node) {
      return this.escapeReservedWord(node.name);
    }

    emitBinaryExpression(node) {
      const left = this.emit(node.left);
      const right = this.emit(node.right);

      // Translate JavaScript operators to Basic operators
      let op = node.operator;
      if (this.variant === 'FREEBASIC') {
        const opMap = {
          '<<': 'Shl',
          '>>': 'Shr',
          '>>>': 'Shr',  // Unsigned right shift - same as Shr in FreeBASIC
          '&': 'And',
          '|': 'Or',
          '^': 'Xor',
          '&&': 'AndAlso',
          '||': 'OrElse',
          '===': '=',
          '!==': '<>',
          '==': '=',
          '!=': '<>',
          '%': 'Mod',
        };
        op = opMap[op] || op;
      }

      return `${left} ${op} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);
      return `${node.operator} ${operand}`;
    }

    emitMemberAccess(node) {
      return `${this.emit(node.target)}.${this.escapeReservedWord(node.member)}`;
    }

    emitIndexAccess(node) {
      // For FreeBASIC, flatten nested index accesses: arr(i)(j) -> arr(i, j)
      if (this.variant === 'FREEBASIC' && node.target?.nodeType === 'IndexAccess') {
        const allIndices = [];
        let current = node;

        // Walk up the chain of nested IndexAccess to collect all indices
        while (current?.nodeType === 'IndexAccess') {
          // Add current indices in reverse order (we'll have them in correct order after loop)
          allIndices.unshift(...current.indices.map(i => this.emit(i)));
          current = current.target;
        }

        // Now 'current' is the base (Identifier or MemberAccess)
        const base = this.emit(current);
        return `${base}(${allIndices.join(', ')})`;
      }

      const indices = node.indices.map(i => this.emit(i));
      return `${this.emit(node.target)}(${indices.join(', ')})`;
    }

    emitCall(node) {
      // For FreeBASIC, flatten nested array accesses: arr(i)(j) -> arr(i, j)
      if (this.variant === 'FREEBASIC' && node.callee?.nodeType === 'Call') {
        const allIndices = [];
        let current = node;

        // Walk up the chain of nested calls to collect all indices
        while (current?.nodeType === 'Call') {
          // Add current arguments in reverse order (we'll reverse the whole array later)
          allIndices.unshift(...current.arguments.map(a => this.emit(a)));
          current = current.callee;
        }

        // Now 'current' is the base (Identifier or MemberAccess)
        const base = this.emit(current);
        return `${base}(${allIndices.join(', ')})`;
      }

      // For function calls, don't escape the callee name (function names are not variable names)
      let callee;
      if (typeof node.callee === 'string') {
        callee = node.callee;
      } else if (node.callee.nodeType === 'Identifier') {
        callee = node.callee.name; // Don't escape function names
      } else {
        callee = this.emit(node.callee);
      }
      const args = node.arguments.map(a => this.emit(a));

      let code = '';
      if (node.useCallKeyword) {
        code += this.kw('Call') + ' ';
      }

      code += `${callee}(${args.join(', ')})`;
      return code;
    }

    emitMethodCall(node) {
      const args = node.arguments.map(a => this.emit(a));
      return `${this.emit(node.target)}.${node.methodName}(${args.join(', ')})`;
    }

    emitNew(node) {
      const args = node.arguments.map(a => this.emit(a));
      // FreeBASIC in procedural mode (useClasses: false): Can't directly create instances
      // UDTs need to be Dim'd and then initialized via Create function
      // Return 0 as placeholder - proper implementation needs statement-level transformation
      if (this.variant === 'FREEBASIC' && this.options.useClasses === false) {
        return '0';
      }
      // FreeBASIC with classes: Constructor calls
      if (this.variant === 'FREEBASIC')
        return `${node.typeName}(${args.join(', ')})`;
      return `${this.kw('New')} ${node.typeName}(${args.join(', ')})`;
    }

    emitArrayLiteral(node) {
      const elements = node.elements.map(e => this.emit(e));
      // FreeBASIC uses {} for array initializers (same as VB)
      return `{${elements.join(', ')}}`;
    }

    emitCast(node) {
      if (this.variant === 'VBNET') {
        if (node.castType === 'CType' || node.castType === 'DirectCast' || node.castType === 'TryCast') {
          return `${node.castType}(${this.emit(node.expression)}, ${node.targetType.toString()})`;
        }
      }

      // Use CInt, CLng, etc. for simple casts
      const castFuncs = {
        'Byte': 'CByte',
        'Integer': 'CInt',
        'Long': 'CLng',
        'Single': 'CSng',
        'Double': 'CDbl',
        'String': 'CStr',
        'Boolean': 'CBool'
      };

      const func = castFuncs[node.targetType.name] || 'CType';
      return `${func}(${this.emit(node.expression)})`;
    }

    emitConditional(node) {
      if (this.variant === 'VBNET') {
        // VB.NET has If() ternary operator
        return `${this.kw('If')}(${this.emit(node.condition)}, ${this.emit(node.trueExpression)}, ${this.emit(node.falseExpression)})`;
      } else {
        // Use IIf for other dialects
        return `IIf(${this.emit(node.condition)}, ${this.emit(node.trueExpression)}, ${this.emit(node.falseExpression)})`;
      }
    }

    emitLambda(node) {
      if (this.variant === 'VBNET') {
        const params = node.parameters.map(p => this.emitParameterDecl(p));

        let code = node.isSub ? this.kw('Sub') : this.kw('Function');
        code += '(' + params.join(', ') + ')';

        if (node.body.nodeType === 'Block') {
          code += this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.body);
          this.indentLevel--;
          code += this.indent() + (node.isSub ? this.kw('End Sub') : this.kw('End Function'));
        } else {
          code += ' ' + this.emit(node.body);
        }

        return code;
      } else {
        // Other dialects don't support lambdas - use placeholder
        return '/* Lambda not supported */';
      }
    }

    emitAddressOf(node) {
      return `${this.kw('AddressOf')} ${node.target}`;
    }

    emitTypeOf(node) {
      return `${this.kw('TypeOf')} ${this.emit(node.expression)} ${this.kw('Is')} ${node.typeName}`;
    }

    emitWith(node) {
      let code = this.line(this.kw('With') + ' ' + this.emit(node.expression));
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line(this.kw('End With'));

      return code;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ COMMENTS ]========================

    emitComment(node) {
      if (this.options.addComments === false) {
        return '';
      }

      const lines = node.text.split('\n');
      let code = '';

      if (node.isDoc && this.variant === 'VBNET') {
        // XML documentation comments
        for (const line of lines) {
          code += this.line(`''' ${line.trim()}`);
        }
      } else {
        // Regular comments
        for (const line of lines) {
          code += this.line(`' ${line.trim()}`);
        }
      }

      return code;
    }
  }

  // Export
  const exports = { BasicEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.BasicEmitter = BasicEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
