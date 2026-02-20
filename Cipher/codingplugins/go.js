/**
 * Go Language Plugin for Multi-Language Code Generation
 * Generates Go code from JavaScript AST using AST pipeline
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Generation flow: JS AST -> GoTransformer -> Go AST -> GoEmitter -> Go code
 */

// Import the framework
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let GoEmitter, GoTransformer;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load AST pipeline components
    const emitterModule = require('./GoEmitter.js');
    GoEmitter = emitterModule.GoEmitter;
    const transformerModule = require('./GoTransformer.js');
    GoTransformer = transformerModule.GoTransformer;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    GoEmitter = window.GoEmitter;
    GoTransformer = window.GoTransformer;
  }

  /**
   * Post-process Go code to merge split IIFE (Immediately Invoked Function Expression) patterns.
   * In Go, `}\n()` inside composite literals causes syntax errors.
   * This merges lines like:
   *   }
   *   (),
   * Into:
   *   }(),
   */
  function _fixSplitIIFE(code) {
    const lines = code.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      const nextLine = i + 1 < lines.length ? lines[i + 1] : null;
      // Check if current line ends with } and next line starts with ()
      if (nextLine !== null && /^\s*\}\s*$/.test(line) && /^\s*\(\)\s*[,.]?\.{0,3}\s*$/.test(nextLine)) {
        // Merge: append the () from next line to current line's }
        const indent = line.match(/^(\s*)/)[1];
        const suffix = nextLine.trim();
        result.push(indent + '}' + suffix);
        ++i; // skip next line
      } else {
        result.push(line);
      }
    }
    return result.join('\n');
  }

  /**
   * Post-process Go code to fix type assertions on concrete (non-interface) types.
   * Go only allows type assertions on interface values.
   * Pattern: `expr.(Type)` where expr is a known concrete type → `Type(expr)` (conversion).
   * If types match: `expr.(Type)` where expr is already Type → `expr` (remove assertion).
   */
  function _fixTypeAssertions(code) {
    const lines = code.split('\n');
    // Build variable type map from declarations in each function
    const GO_TYPES = new Set(['int', 'int8', 'int16', 'int32', 'int64',
      'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'byte', 'rune',
      'float32', 'float64', 'string', 'bool', 'error']);
    const CONCRETE_PREFIXES = ['[]', '*'];

    function isConcreteType(t) {
      if (!t) return false;
      if (GO_TYPES.has(t)) return true;
      if (t.startsWith('[]') || t.startsWith('*') || t.startsWith('map[')) return true;
      // Named struct types (starts with uppercase)
      if (/^[A-Z]/.test(t)) return true;
      return false;
    }

    // Process each function body
    let funcStart = -1;
    let braceDepth = 0;
    const result = [];

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      if (/^func\s/.test(line) || /^\t*func\s/.test(line)) {
        funcStart = i;
        braceDepth = 0;
      }
      for (const ch of line) {
        if (ch === '{') ++braceDepth;
        if (ch === '}') --braceDepth;
      }
      if (funcStart >= 0 && braceDepth === 0 && line.includes('}')) {
        // Process this function body
        const funcBody = lines.slice(funcStart, i + 1);
        const fixed = _fixAssertionsInFunc(funcBody, isConcreteType, GO_TYPES);
        for (let j = funcStart; j <= i; ++j)
          result.push(fixed[j - funcStart]);
        funcStart = -1;
      } else if (funcStart < 0) {
        result.push(line);
      }
    }
    if (funcStart >= 0)
      for (let j = funcStart; j < lines.length; ++j) result.push(lines[j]);
    return result.join('\n');
  }

  function _fixAssertionsInFunc(lines, isConcreteType, GO_TYPES) {
    // Build type map from variable declarations and function parameters
    const varTypes = new Map();

    // Parse function signature parameters: func (r *Type) Name(param1 Type1, param2 Type2) RetType {
    const funcLine = lines[0];
    const paramMatch = funcLine.match(/\(([^)]+)\)\s*(?:\([^)]*\)\s*)?{/);
    if (paramMatch) {
      const params = paramMatch[1];
      // Split by comma, extract name type pairs
      for (const p of params.split(',')) {
        const parts = p.trim().split(/\s+/);
        if (parts.length >= 2) {
          varTypes.set(parts[0], parts.slice(1).join(' '));
        }
      }
    }

    // Scan for variable declarations
    for (const line of lines) {
      const trimmed = line.trim();
      // Short variable declaration: varName := expr
      // Try to infer type from the right side
      const shortDecl = trimmed.match(/^(\w+)\s*:=\s*(.+)$/);
      if (shortDecl) {
        const varName = shortDecl[1];
        const expr = shortDecl[2];
        // Type from explicit conversion: varName := uint32(...)
        const convMatch = expr.match(/^(u?int(?:8|16|32|64)?|float(?:32|64)|byte|string|bool)\(.*/);
        if (convMatch) {
          varTypes.set(varName, convMatch[1]);
          continue;
        }
        // Type from make: varName := make([]uint32, n)
        const makeMatch = expr.match(/^make\((\[\]\w+)/);
        if (makeMatch) {
          varTypes.set(varName, makeMatch[1]);
          continue;
        }
        // Type from composite literal: varName := []uint32{...}
        const litMatch = expr.match(/^(\[\]\w+)\{/);
        if (litMatch) {
          varTypes.set(varName, litMatch[1]);
          continue;
        }
        // Type from type assertion: varName := expr.(Type) or varName := expr.(Type) op literal
        const assertionMatch = expr.match(/\.\((u?int(?:8|16|32|64)?|float(?:32|64)|byte|rune|string|bool|\[\]\w+)\)/);
        if (assertionMatch) {
          varTypes.set(varName, assertionMatch[1]);
          continue;
        }
        // Type from another known variable: varName := knownVar op ...
        const simpleVarRef = expr.match(/^(\w+)\s*(?:[\+\-\*\/\%\&\|\^]|$)/);
        if (simpleVarRef && varTypes.has(simpleVarRef[1])) {
          varTypes.set(varName, varTypes.get(simpleVarRef[1]));
          continue;
        }
      }
      // Var declaration: var varName Type
      const varDecl = trimmed.match(/^var\s+(\w+)\s+(\S+)/);
      if (varDecl) {
        varTypes.set(varDecl[1], varDecl[2]);
        continue;
      }
      // Range-based for loop: for _, elem := range arr
      // If arr type is known as []T, elem is T
      const rangeMatch = trimmed.match(/^for\s+(?:(\w+)\s*,\s*)?(\w+)\s*:=\s*range\s+(\w+)/);
      if (rangeMatch) {
        const idxVar = rangeMatch[1];
        const elemVar = rangeMatch[2];
        const arrVar = rangeMatch[3];
        if (idxVar && idxVar !== '_') varTypes.set(idxVar, 'int');
        const arrType = varTypes.get(arrVar);
        if (arrType && arrType.startsWith('[]'))
          varTypes.set(elemVar, arrType.substring(2));
        continue;
      }
      // For loop with index: for i := 0; ...
      const forIdxMatch = trimmed.match(/^for\s+(\w+)\s*:=\s*\d+/);
      if (forIdxMatch) {
        varTypes.set(forIdxMatch[1], 'int');
        continue;
      }
    }

    // Now fix type assertions
    // Pattern: identifier.(Type) or expr[i].(Type)
    const assertPattern = /(\w+(?:\[[^\]]+\])?)\.(\((?:u?int(?:8|16|32|64)?|float(?:32|64)|byte|string|bool|\[\]\w+|\*\w+)\))/g;

    const result = lines.map(line => {
      return line.replace(assertPattern, (match, expr, assertion) => {
        // Extract the asserted type (remove parens)
        const assertedType = assertion.slice(1, -1);
        // Get the base variable name (strip index)
        const baseVar = expr.replace(/\[.*$/, '');
        const varType = varTypes.get(baseVar);

        if (varType && isConcreteType(varType)) {
          // Variable is a known concrete type
          // Determine element type for slice indexing
          let effectiveType = varType;
          if (expr.includes('[') && varType.startsWith('[]'))
            effectiveType = varType.substring(2);

          if (effectiveType === assertedType || (effectiveType === 'byte' && assertedType === 'uint8') || (effectiveType === 'uint8' && assertedType === 'byte')) {
            // Same type - remove assertion entirely
            return expr;
          }
          if (isConcreteType(effectiveType) && effectiveType !== 'interface{}' && effectiveType !== 'any') {
            // Different concrete type - use type conversion instead
            return `${assertedType}(${expr})`;
          }
        }
        // Unknown or interface type - keep assertion
        return match;
      });
    });
    return result;
  }

  /**
   * Post-process Go code to replace unused variable declarations with blank identifier.
   * Go does not allow declared-but-unused variables, so `x := expr` → `_ = expr`.
   * Only operates on short variable declarations (:=) inside function bodies.
   */
  function _fixUnusedVariables(code) {
    const lines = code.split('\n');
    // Find function bodies and process each one
    const result = [];
    let funcStart = -1;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      // Track function boundaries
      if (/^func\s/.test(line) || /^\tfunc\s/.test(line)) {
        funcStart = i;
        braceDepth = 0;
      }
      for (const ch of line) {
        if (ch === '{') ++braceDepth;
        if (ch === '}') --braceDepth;
      }

      // When we exit a function body, process it
      if (funcStart >= 0 && braceDepth === 0 && line.includes('}')) {
        const funcBody = lines.slice(funcStart, i + 1);
        const fixed = _fixUnusedInBlock(funcBody);
        for (let j = funcStart; j <= i; ++j)
          result.push(fixed[j - funcStart]);
        funcStart = -1;
      } else if (funcStart < 0) {
        result.push(line);
      }
    }
    // If we didn't close the function, just push remaining lines
    if (funcStart >= 0)
      for (let j = funcStart; j < lines.length; ++j) result.push(lines[j]);

    return result.join('\n');
  }

  function _fixUnusedInBlock(lines) {
    // Find short variable declarations: `\tvarName := expr`
    const declPattern = /^(\t+)(\w+)\s*:=\s*(.+)$/;
    const candidates = [];
    for (let i = 0; i < lines.length; ++i) {
      const m = lines[i].match(declPattern);
      if (m) {
        const varName = m[2];
        // Skip _ and common Go keywords
        if (varName === '_' || varName === 'err' || varName === 'ok')
          continue;
        candidates.push({ index: i, varName, indent: m[1], expr: m[3] });
      }
    }
    // For each candidate, check if the variable is used elsewhere in the function
    const result = [...lines];
    for (const { index, varName, indent, expr } of candidates) {
      // Create a regex to find the variable name as a word boundary in other lines
      const nameRe = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      let usedElsewhere = false;
      for (let i = 0; i < lines.length; ++i) {
        if (i === index) continue;
        if (nameRe.test(lines[i])) {
          usedElsewhere = true;
          break;
        }
      }
      if (!usedElsewhere)
        result[index] = `${indent}_ = ${expr}`;
    }
    return result;
  }

/**
 * Go Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class GoPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'Go';
    this.extension = 'go';
    this.icon = '🐹';
    this.description = 'Go language code generator';
    this.mimeType = 'text/x-go';
    this.version = '1.21+';

    // Go-specific options
    this.options = {
      indent: '\t', // Go uses tabs by convention
      lineEnding: '\n',
      packageName: 'cipher',  // Use library package for standalone compilation
      addComments: true,
      useStrictTypes: true,
      // errorHandling and useContext disabled: they add params/returns to function
      // declarations but internal calls aren't updated to match, causing signature errors
      errorHandling: false,
      useInterfaces: true,
      useGoroutines: true,
      useCrypto: true,
      useGenerics: true, // Go 1.18+
      useContext: false,
      useChannels: true
    };
  }

  /**
   * Generate Go code from Abstract Syntax Tree using AST pipeline
   * @param {Object} ast - Parsed/Modified AST representation
   * @param {Object} options - Generation options
   * @returns {CodeGenerationResult}
   */
  GenerateFromAST(ast, options = {}) {
    try {
      // Merge options - accept 'namespace' as alias for 'packageName' for consistency
      const mergedOptions = { ...this.options, ...options };
      // Handle namespace alias
      if (options.namespace && !options.packageName)
        mergedOptions.packageName = options.namespace;

      // Validate AST
      if (!ast || typeof ast !== 'object') {
        return this.CreateErrorResult('Invalid AST: must be an object');
      }

      // Step 1: Transform JS AST to Go AST
      const transformer = new GoTransformer({
        packageName: mergedOptions.packageName,
        typeKnowledge: mergedOptions.typeKnowledge,
        addComments: mergedOptions.addComments,
        useStrictTypes: mergedOptions.useStrictTypes,
        errorHandling: mergedOptions.errorHandling,
        useInterfaces: mergedOptions.useInterfaces,
        useGoroutines: mergedOptions.useGoroutines,
        useCrypto: mergedOptions.useCrypto,
        useGenerics: mergedOptions.useGenerics,
        useContext: mergedOptions.useContext,
        useChannels: mergedOptions.useChannels
      });

      const goAst = transformer.transform(ast);

      // Step 2: Emit Go code from Go AST
      const emitter = new GoEmitter({
        indent: mergedOptions.indent,
        newline: mergedOptions.lineEnding,
        addComments: mergedOptions.addComments
      });

      let code = emitter.emit(goAst);

      // Post-process: replace unused variable declarations with blank identifier
      // Go does not allow declared-but-unused variables, so `x := expr` becomes `_ = expr`
      code = _fixUnusedVariables(code);

      // Post-process: fix type assertions on concrete (non-interface) types
      // Go only allows `.( Type)` on interface values; for concrete types use `Type(expr)` conversion
      code = _fixTypeAssertions(code);

      // Post-process: merge split IIFE patterns where }() is on separate lines
      // In Go, inside composite literals, `}\n()` causes "unexpected newline" syntax errors
      // Fix: merge `}\n\t*()` into `}()` on one line
      code = _fixSplitIIFE(code);

      // Framework stubs are generated by GoTransformer - only add legacy stubs if explicitly requested
      if (mergedOptions.generateFrameworkStubs === true) {
        const lines = code.split('\n');
        let insertIndex = 0;
        let importBlockStart = -1;
        let importBlockEnd = -1;

        // Find import block boundaries
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import (')) {
            importBlockStart = i;
          }
          if (importBlockStart >= 0 && lines[i].trim() === ')') {
            importBlockEnd = i;
            break;
          }
        }

        // Add required imports for stubs if not present
        const requiredImports = ['"encoding/hex"', '"encoding/binary"'];
        if (importBlockStart >= 0 && importBlockEnd > importBlockStart) {
          const importSection = lines.slice(importBlockStart, importBlockEnd + 1).join('\n');
          const missingImports = requiredImports.filter(imp => !importSection.includes(imp));
          if (missingImports.length > 0) {
            // Insert missing imports before the closing )
            lines.splice(importBlockEnd, 0, ...missingImports.map(imp => '\t' + imp));
            importBlockEnd += missingImports.length;
          }
          insertIndex = importBlockEnd + 1;
        } else {
          // No import block found, find end of package line
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('package ')) {
              insertIndex = i + 2; // After package line and blank line
              break;
            }
          }
        }

        lines.splice(insertIndex, 0, this._generateFrameworkStubs());
        code = lines.join('\n');
      }

      // Step 3: Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Step 4: Generate warnings
      const warnings = this._generateWarnings(ast, mergedOptions);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }


  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    const goModContent = `module ${options.moduleName || 'generated-go-code'}

go ${options.goVersion || '1.21'}
`;

    dependencies.push({
      name: 'go.mod',
      content: goModContent,
      description: 'Go module file'
    });

    return dependencies;
  }

  /**
   * Generate warnings
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    warnings.push('Consider adding proper error handling');
    warnings.push('Replace interface{} with specific types for better performance');
    return warnings;
  }

  /**
   * Generate framework type stubs for AlgorithmFramework classes
   * @private
   */
  _generateFrameworkStubs() {
    return `
// Framework Type Stubs for Compilation
// These minimal stubs allow generated code to compile standalone

// Enums
type CategoryType string
const (
	BLOCK      CategoryType = "block"
	STREAM     CategoryType = "stream"
	HASH       CategoryType = "hash"
	MAC        CategoryType = "mac"
	KDF        CategoryType = "kdf"
	AEAD       CategoryType = "aead"
	ASYMMETRIC CategoryType = "asymmetric"
	CLASSICAL  CategoryType = "classical"
	CHECKSUM   CategoryType = "checksum"
	ENCODING   CategoryType = "encoding"
	ECC        CategoryType = "ecc"
	RANDOM     CategoryType = "random"
	MODES      CategoryType = "modes"
	SPECIAL    CategoryType = "special"
)

type SecurityStatus string
const (
	SECURE       SecurityStatus = "secure"
	BROKEN       SecurityStatus = "broken"
	DEPRECATED   SecurityStatus = "deprecated"
	EXPERIMENTAL SecurityStatus = "experimental"
	EDUCATIONAL  SecurityStatus = "educational"
	OBSOLETE     SecurityStatus = "obsolete"
)

type ComplexityType string
const (
	BEGINNER     ComplexityType = "beginner"
	INTERMEDIATE ComplexityType = "intermediate"
	ADVANCED     ComplexityType = "advanced"
	EXPERT       ComplexityType = "expert"
	RESEARCH     ComplexityType = "research"
)

type CountryCode string
const (
	US CountryCode = "US"
	GB CountryCode = "GB"
	DE CountryCode = "DE"
	FR CountryCode = "FR"
	JP CountryCode = "JP"
	CN CountryCode = "CN"
	RU CountryCode = "RU"
	IL CountryCode = "IL"
	BE CountryCode = "BE"
	KR CountryCode = "KR"
	CH CountryCode = "CH"
	AU CountryCode = "AU"
	NL CountryCode = "NL"
	AT CountryCode = "AT"
	FI CountryCode = "FI"
	SE CountryCode = "SE"
	NO CountryCode = "NO"
	DK CountryCode = "DK"
	IT CountryCode = "IT"
	ES CountryCode = "ES"
	CA CountryCode = "CA"
)

// Support types
type LinkItem struct {
	Title string
	URL   string
}

type Vulnerability struct {
	Name        string
	URL         string
	Description string
	Mitigation  string
}

type TestCase struct {
	Input      []byte
	Expected   []byte
	Desc       string
	Source     string
	Text       string
	URI        string
	Key        []byte
	IV         []byte
	Nonce      []byte
	Salt       []byte
	AAD        []byte
	Tag        []byte
	OutputSize int
	Skip       int
	Count      int
	Rounds     int
	BlockSize  int
	Mode       string
	Variant    string
}

type KeySize struct {
	MinSize int
	MaxSize int
	Step    int
}

// Algorithm base interface
type Algorithm interface {
	CreateInstance(isInverse bool) interface{}
}

// Base algorithm struct with common fields
type BaseAlgorithm struct {
	Name                 string
	Description          string
	Inventor             string
	Year                 int
	Category             CategoryType
	SubCategory          string
	SecurityStatus       SecurityStatus
	Complexity           ComplexityType
	Country              CountryCode
	Documentation        []LinkItem
	References           []LinkItem
	KnownVulnerabilities []Vulnerability
	Tests                []interface{}
	SupportedKeySizes    []KeySize
	SupportedBlockSizes  []KeySize
}

// Base instance interface
type IAlgorithmInstance interface {
	Feed(data []byte)
	Result() []byte
}

// OpCodes helper functions
func rotl32(v uint32, n int) uint32 {
	return (v << n) | (v >> (32 - n))
}

func rotr32(v uint32, n int) uint32 {
	return (v >> n) | (v << (32 - n))
}

func xorBytes(a, b []byte) []byte {
	result := make([]byte, len(a))
	for i := range a {
		result[i] = a[i] ^ b[i]
	}
	return result
}

// mustHexDecode decodes hex string, panics on error (for test vectors)
func mustHexDecode(s string) []byte {
	b, err := hex.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return b
}

// pack16BE packs 2 bytes into uint16 (big-endian): b0=MSB, b1=LSB
func pack16BE(b0, b1 uint8) uint16 {
	return (uint16(b0) << 8) | uint16(b1)
}

// pack16LE packs 2 bytes into uint16 (little-endian): b0=LSB, b1=MSB
func pack16LE(b0, b1 uint8) uint16 {
	return uint16(b0) | (uint16(b1) << 8)
}

// pack32BE packs 4 bytes into uint32 (big-endian): b0=MSB
func pack32BE(b0, b1, b2, b3 uint8) uint32 {
	return (uint32(b0) << 24) | (uint32(b1) << 16) | (uint32(b2) << 8) | uint32(b3)
}

// pack32LE packs 4 bytes into uint32 (little-endian): b0=LSB
func pack32LE(b0, b1, b2, b3 uint8) uint32 {
	return uint32(b0) | (uint32(b1) << 8) | (uint32(b2) << 16) | (uint32(b3) << 24)
}

// pack64BE packs 8 bytes into uint64 (big-endian): b0=MSB
func pack64BE(b0, b1, b2, b3, b4, b5, b6, b7 uint8) uint64 {
	return (uint64(b0) << 56) | (uint64(b1) << 48) | (uint64(b2) << 40) | (uint64(b3) << 32) |
		(uint64(b4) << 24) | (uint64(b5) << 16) | (uint64(b6) << 8) | uint64(b7)
}

// pack64LE packs 8 bytes into uint64 (little-endian): b0=LSB
func pack64LE(b0, b1, b2, b3, b4, b5, b6, b7 uint8) uint64 {
	return uint64(b0) | (uint64(b1) << 8) | (uint64(b2) << 16) | (uint64(b3) << 24) |
		(uint64(b4) << 32) | (uint64(b5) << 40) | (uint64(b6) << 48) | (uint64(b7) << 56)
}

// pack16BESlice packs bytes from slice into uint16 (big-endian)
func pack16BESlice(b []byte) uint16 {
	return binary.BigEndian.Uint16(b)
}

// pack16LESlice packs bytes from slice into uint16 (little-endian)
func pack16LESlice(b []byte) uint16 {
	return binary.LittleEndian.Uint16(b)
}

// pack32BESlice packs bytes from slice into uint32 (big-endian)
func pack32BESlice(b []byte) uint32 {
	return binary.BigEndian.Uint32(b)
}

// pack32LESlice packs bytes from slice into uint32 (little-endian)
func pack32LESlice(b []byte) uint32 {
	return binary.LittleEndian.Uint32(b)
}

// pack64BESlice packs bytes from slice into uint64 (big-endian)
func pack64BESlice(b []byte) uint64 {
	return binary.BigEndian.Uint64(b)
}

// pack64LESlice packs bytes from slice into uint64 (little-endian)
func pack64LESlice(b []byte) uint64 {
	return binary.LittleEndian.Uint64(b)
}

// unpack16BE unpacks uint16 to 2 bytes (big-endian)
func unpack16BE(v uint16) []byte {
	b := make([]byte, 2)
	binary.BigEndian.PutUint16(b, v)
	return b
}

// unpack16LE unpacks uint16 to 2 bytes (little-endian)
func unpack16LE(v uint16) []byte {
	b := make([]byte, 2)
	binary.LittleEndian.PutUint16(b, v)
	return b
}

// unpack32BE unpacks uint32 to 4 bytes (big-endian)
func unpack32BE(v uint32) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, v)
	return b
}

// unpack32LE unpacks uint32 to 4 bytes (little-endian)
func unpack32LE(v uint32) []byte {
	b := make([]byte, 4)
	binary.LittleEndian.PutUint32(b, v)
	return b
}

// unpack64BE unpacks uint64 to 8 bytes (big-endian)
func unpack64BE(v uint64) []byte {
	b := make([]byte, 8)
	binary.BigEndian.PutUint64(b, v)
	return b
}

// unpack64LE unpacks uint64 to 8 bytes (little-endian)
func unpack64LE(v uint64) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, v)
	return b
}

// HL64 represents a 64-bit value split into high and low 32-bit words
type HL64 struct {
	H uint32
	L uint32
}

// add3L64 adds three low 32-bit words, returns sum (may overflow 32 bits)
func add3L64(al, bl, cl uint32) uint64 {
	return uint64(al) + uint64(bl) + uint64(cl)
}

// add3H64 adds three high words with carry from low word sum
func add3H64(lowSum uint64, ah, bh, ch uint32) uint32 {
	return uint32(int32(ah) + int32(bh) + int32(ch) + int32(lowSum>>32))
}

// add64_HL adds two 64-bit values represented as high/low pairs
func add64_HL(ah, al, bh, bl uint32) HL64 {
	l := uint64(al) + uint64(bl)
	h := uint32(int32(ah) + int32(bh) + int32(l>>32))
	return HL64{H: h, L: uint32(l)}
}

// xor64_HL XORs two 64-bit values represented as high/low pairs
func xor64_HL(ah, al, bh, bl uint32) HL64 {
	return HL64{H: ah ^ bh, L: al ^ bl}
}

// swap64_HL swaps high and low words (equivalent to 32-bit rotation)
func swap64_HL(high, low uint32) HL64 {
	return HL64{H: low, L: high}
}

// rotR64_HL rotates a 64-bit value right by n bits
func rotR64_HL(high, low uint32, n int) HL64 {
	n &= 63
	if n == 0 {
		return HL64{H: high, L: low}
	} else if n == 32 {
		return HL64{H: low, L: high}
	} else if n < 32 {
		newH := (high >> n) | (low << (32 - n))
		newL := (low >> n) | (high << (32 - n))
		return HL64{H: newH, L: newL}
	} else {
		n -= 32
		newH := (low >> n) | (high << (32 - n))
		newL := (high >> n) | (low << (32 - n))
		return HL64{H: newH, L: newL}
	}
}

// rotL64_HL rotates a 64-bit value left by n bits
func rotL64_HL(high, low uint32, n int) HL64 {
	return rotR64_HL(high, low, 64-n)
}

`;
  }

  /**
   * Validate Go code syntax
   * @override
   */
  ValidateCodeSyntax(code) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      const tempDir = path.join(__dirname, '..', '.agent.tmp', `temp_go_${Date.now()}`);
      const tempFile = path.join(tempDir, 'main.go');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(path.join(tempDir, 'go.mod'), `module tempvalidation\n\ngo 1.21\n`);
      fs.writeFileSync(tempFile, code);

      try {
        execSync(`go build -o nul .`, {
          stdio: 'pipe',
          timeout: 3000,
          cwd: tempDir,
          windowsHide: true
        });

        fs.rmSync(tempDir, { recursive: true, force: true });

        return {
          success: true,
          method: 'go',
          error: null
        };
      } catch (error) {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return {
          success: false,
          method: 'go',
          error: error.stderr?.toString() || error.message
        };
      }
    } catch (error) {
      return {
        success: false,
        method: 'basic',
        error: 'Go compiler not available'
      };
    }
  }

  /**
   * Get Go compiler information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Go',
      downloadUrl: 'https://golang.org/dl/',
      installInstructions: 'Download and install Go from https://golang.org/dl/',
      verifyCommand: 'go version',
      documentation: 'https://golang.org/doc/'
    };
  }
}

// Register the plugin
const goPlugin = new GoPlugin();
LanguagePlugins.Add(goPlugin);

// Export for potential direct use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = goPlugin;
}

})(); // End of IIFE
